/**
 * ScreenshotExtractor — Phase 1 T012 (AC-07).
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-07 + R-09;
 *         docs/specs/mvp/phases/phase-1-perception/plan.md
 *           "Phase 0 Research" item 3 (Sharp compression strategy);
 *         docs/specs/mvp/phases/phase-1-perception/tasks.md T012.
 *
 * Outcome: capture(page) -> Visual where:
 *   - format === 'jpeg'
 *   - sizeBytes <= 153_600 (150 KB)
 *   - width    <= 1280 px
 *
 * Strategy (deterministic, single retry max per spec):
 *   1. page.screenshot({ type: 'jpeg', quality: 80, fullPage: false }) -> Buffer
 *   2. If buf.length > 150 KB OR width > 1280: (Stage 2.5 fix — prior versions
 *        gated only on byte-length, allowing a 1920x1080 JPEG that compresses
 *        to <=150KB to skip Sharp resize and trip VisualSchema.width.max(1280)
 *        when StealthConfig rotates to a 1920-wide viewport)
 *        sharp(buf).resize({ width: 1280, withoutEnlargement: true })
 *                  .jpeg({ mozjpeg: true, quality: 70 }).toBuffer()
 *   3. If still > 150 KB after step 2: SINGLE retry max with width: 1024,
 *        quality: 60. If retry still oversize, accept-and-warn (no throw —
 *        Phase 1 mustn't fail capture on visual-only). Schema-level cap is
 *        enforced via VisualSchema.parse which has .max(SCREENSHOT_MAX_BYTES)
 *        on sizeBytes; if accepted-and-warned at oversize, the parse will
 *        throw an explicit ZodError (deliberate fail-loud signal that the
 *        single-retry budget was insufficient — caller can degrade by
 *        dropping the visual section per ContextAssembler shrink Stage 3).
 *   4. Probe final dimensions via sharp(finalBuf).metadata() -> width/height.
 *
 * Non-goals: no annotation (Phase 7), no R2 upload (Phase 4 — `url`/`base64`
 * fields left undefined; consumer attaches via Visual.url after upload).
 *
 * R10 compliance: file < 150 lines target; functions < 50 lines.
 * R10.3: named exports — class + singleton.
 * R10.6: Pino via createLogger; no console.log.
 * R13: no `any`; Buffer is the boundary type for both Playwright + Sharp.
 * R9: no direct `import 'playwright'` — operates against BrowserPage wrapper.
 */
import sharp from 'sharp';
import { createLogger } from '../observability/logger.js';
import type { BrowserPage } from '../adapters/BrowserEngine.js';
import {
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MAX_WIDTH,
  VisualSchema,
  type Visual,
} from './types.js';

const log = createLogger('screenshot-extractor');

/** Initial Playwright JPEG capture quality. */
const INITIAL_JPEG_QUALITY = 80;

/** Sharp re-encode parameters (first compression pass). */
const RECOMPRESS_WIDTH = SCREENSHOT_MAX_WIDTH; // 1280
const RECOMPRESS_QUALITY = 70;

/** Sharp retry parameters (single retry — kill criterion: no second retry). */
const RETRY_WIDTH = 1024;
const RETRY_QUALITY = 60;

export class ScreenshotExtractor {
  /**
   * Capture a viewport JPEG from `page` and shrink to <= 150 KB / <= 1280 px
   * via Sharp if the native Playwright output is too large.
   *
   * Returns a Visual conforming to VisualSchema. Schema-level enforcement of
   * the 150 KB / 1280 px caps is the final gate — if both Sharp passes still
   * exceed the cap, VisualSchema.parse throws a ZodError. Caller (T013
   * ContextAssembler) is responsible for dropping the visual section per
   * shrink ladder Stage 3 if that happens.
   */
  async capture(page: BrowserPage): Promise<Visual> {
    const initialBuf = await page.screenshot({
      type: 'jpeg',
      quality: INITIAL_JPEG_QUALITY,
      fullPage: false,
    });

    const finalBuf = await this.shrinkIfNeeded(initialBuf);
    const meta = await sharp(finalBuf).metadata();

    if (meta.format !== 'jpeg') {
      // Sharp can fall back when given non-JPEG input; spec mandates JPEG.
      throw new Error(
        `ScreenshotExtractor: expected jpeg output, got ${meta.format ?? 'unknown'}`,
      );
    }

    return VisualSchema.parse({
      format: 'jpeg',
      sizeBytes: finalBuf.length,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    });
  }

  /**
   * Apply Sharp compression iff `buf` exceeds the 150 KB cap OR its native
   * width exceeds the 1280 px cap (Stage 2.5 fix I1 — width-aware gate
   * required because StealthConfig rotates to 1920x1080 viewports; a JPEG
   * that compresses to <=150KB at 1920 wide would otherwise skip Sharp and
   * trip VisualSchema.width.max(1280) downstream). Single retry max if the
   * first re-encode is still over budget (per spec — kill criterion: > 1 retry).
   */
  private async shrinkIfNeeded(buf: Buffer): Promise<Buffer> {
    const initialMeta = await sharp(buf).metadata();
    const initialWidth = initialMeta.width ?? 0;
    const oversizeBytes = buf.length > SCREENSHOT_MAX_BYTES;
    const oversizeWidth = initialWidth > SCREENSHOT_MAX_WIDTH;

    if (!oversizeBytes && !oversizeWidth) {
      return buf;
    }

    log.debug(
      {
        event: 'screenshot.recompress',
        sizeBytes: buf.length,
        widthPx: initialWidth,
        capBytes: SCREENSHOT_MAX_BYTES,
        capWidth: SCREENSHOT_MAX_WIDTH,
        reason: oversizeBytes && oversizeWidth ? 'bytes+width' : oversizeBytes ? 'bytes' : 'width',
      },
      'screenshot exceeds cap; applying sharp recompression',
    );

    const firstPass = await sharp(buf)
      .resize({ width: RECOMPRESS_WIDTH, withoutEnlargement: true })
      .jpeg({ mozjpeg: true, quality: RECOMPRESS_QUALITY })
      .toBuffer();

    if (firstPass.length <= SCREENSHOT_MAX_BYTES) {
      return firstPass;
    }

    log.warn(
      {
        event: 'screenshot.recompress_retry',
        firstPassBytes: firstPass.length,
        cap: SCREENSHOT_MAX_BYTES,
      },
      'first recompression still over cap; single retry with smaller width',
    );

    // SINGLE retry only (kill criterion: no second retry).
    const retry = await sharp(buf)
      .resize({ width: RETRY_WIDTH, withoutEnlargement: true })
      .jpeg({ mozjpeg: true, quality: RETRY_QUALITY })
      .toBuffer();

    if (retry.length > SCREENSHOT_MAX_BYTES) {
      // Accept-and-warn: VisualSchema.parse will surface the oversize as a
      // ZodError, signaling caller to drop the visual section (shrink
      // ladder Stage 3). Do NOT silently truncate.
      log.warn(
        { event: 'screenshot.recompress_oversize', retryBytes: retry.length, cap: SCREENSHOT_MAX_BYTES },
        'screenshot still over cap after single retry; returning for schema-level rejection',
      );
    }

    return retry;
  }
}

/** Singleton instance per R10.3 + R4.5 naming. */
export const screenshotExtractor = new ScreenshotExtractor();
