/**
 * T046 page_screenshot_full — Phase 2 Wave 13 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T046; spec.md AC-09 + R-09 +
 *         NF-Phase2-06; impact.md MCPToolRegistry Page-perception row
 *         (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory closes over BrowserSession and returns an MCPToolDefinition with
 * EXACT v3.1 name 'page_screenshot_full' and safetyClass 'safe'. Handler
 * validates absolute saveDir, captures full-page JPEG via Playwright
 * fullPage:true (native scroll-stitch), Sharp-crops to maxHeight if needed,
 * fires a re-encode ladder (60→40→25 quality) if oversized, then persists to
 * saveDir/<slug>-<timestamp>.jpg. Returns { ok, path, format, sizeBytes,
 * width, height }.
 *
 * R4.5 EXACT name. R9: no `playwright` import (BrowserPage.screenshot is the
 * adapter seam — Sharp + node:path + node:fs/promises are allowed processing
 * deps). R10: ≤200 LOC; named exports only. R13: no `any`.
 */
import { writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

const DEFAULT_QUALITY = 80;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const DEFAULT_MAX_HEIGHT = 15000; // px — AC-09 cap
const RETRY_QUALITY_LADDER = [60, 40, 25] as const;
const MAX_HEIGHT_HARD_CAP = 20000; // schema-level ceiling

export const PageScreenshotFullInputSchema = z
  .object({
    saveDir: z.string().min(1),
    quality: z.number().int().min(1).max(100).optional(),
    maxBytes: z.number().int().positive().optional(),
    maxHeight: z.number().int().positive().max(MAX_HEIGHT_HARD_CAP).optional(),
  })
  .strict();

export const PageScreenshotFullOutputSchema = z
  .object({
    ok: z.literal(true),
    path: z.string(),
    format: z.literal('jpeg'),
    sizeBytes: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

export type PageScreenshotFullInput = z.infer<typeof PageScreenshotFullInputSchema>;
export type PageScreenshotFullOutput = z.infer<typeof PageScreenshotFullOutputSchema>;

export interface PageScreenshotFullDeps {
  readonly session: BrowserSession;
}

export class ScreenshotFullSaveDirNotAbsoluteError extends Error {
  public override readonly name = 'ScreenshotFullSaveDirNotAbsoluteError';
  constructor(public readonly saveDir: string) {
    super(
      `page_screenshot_full: saveDir must be an absolute path; got "${saveDir}". ` +
        'Absolute paths required to avoid working-dir ambiguity.',
    );
  }
}

export class ScreenshotFullCompressionFailedError extends Error {
  public override readonly name = 'ScreenshotFullCompressionFailedError';
  constructor(
    public readonly finalSizeBytes: number,
    public readonly maxBytes: number,
  ) {
    super(
      `page_screenshot_full: compression ladder exhausted; final ${finalSizeBytes} B > maxBytes ${maxBytes} B. ` +
        'Page is too visually dense to fit the byte budget at quality 25.',
    );
  }
}

/** Filesystem-safe slug — strips protocol, replaces unsafe chars, clamps 80ch. */
function urlToSlug(url: string): string {
  const stripped = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9\-_.]/gi, '_');
  return stripped.slice(0, 80) || 'page';
}

/** Re-encode ladder (60 → 40 → 25). Stops at first quality fitting maxBytes. */
async function compressLadder(
  input: Buffer,
  maxBytes: number,
): Promise<{ buf: Buffer; quality: number }> {
  let best: { buf: Buffer; quality: number } = { buf: input, quality: -1 };
  for (const q of RETRY_QUALITY_LADDER) {
    const next = await sharp(input).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    best = { buf: next, quality: q };
    if (next.length <= maxBytes) return best;
  }
  return best;
}

export function createPageScreenshotFullTool(
  deps: PageScreenshotFullDeps,
): MCPToolDefinition<PageScreenshotFullInput, PageScreenshotFullOutput> {
  return {
    name: 'page_screenshot_full', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Capture a full-page scroll-stitched JPEG of the active page (<=2 MB / <=15000 px tall via Sharp) and write it to an absolute saveDir.',
    inputSchema: PageScreenshotFullInputSchema,
    outputSchema: PageScreenshotFullOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<PageScreenshotFullOutput> => {
      if (!isAbsolute(input.saveDir)) {
        ctx.logger.warn(
          { save_dir: input.saveDir },
          'mcp.tool.page_screenshot_full.save_dir_not_absolute',
        );
        throw new ScreenshotFullSaveDirNotAbsoluteError(input.saveDir);
      }

      const quality = input.quality ?? DEFAULT_QUALITY;
      const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
      const maxHeight = input.maxHeight ?? DEFAULT_MAX_HEIGHT;

      ctx.logger.info(
        { save_dir: input.saveDir, quality, max_bytes: maxBytes, max_height: maxHeight },
        'mcp.tool.page_screenshot_full.start',
      );

      // 1. Native scroll-stitched JPEG via Playwright fullPage:true
      let buf = await deps.session.page.screenshot({
        type: 'jpeg',
        quality,
        fullPage: true,
      });

      // 2. Probe Sharp metadata; crop bottom if height exceeds cap (AC-09 clip,
      //    don't reject — pages exceeding maxHeight produce a maxHeight image)
      const meta = await sharp(buf).metadata();
      const initialWidth = meta.width ?? 0;
      const initialHeight = meta.height ?? 0;
      if (initialWidth <= 0 || initialHeight <= 0) {
        // Unrecoverable: Sharp couldn't parse the JPEG. Surface as compression
        // failure (downstream catches and degrades gracefully).
        throw new ScreenshotFullCompressionFailedError(buf.length, maxBytes);
      }
      let width = initialWidth;
      let height = initialHeight;
      if (height > maxHeight) {
        buf = await sharp(buf)
          .extract({ left: 0, top: 0, width, height: maxHeight })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        height = maxHeight;
      }

      // 3. Byte-budget ladder — only fire if still oversize after crop. Sharp's
      //    jpeg() preserves pixel dimensions, so width/height tracked above
      //    remain authoritative.
      if (buf.length > maxBytes) {
        const { buf: compressed, quality: chosen } = await compressLadder(buf, maxBytes);
        buf = compressed;
        ctx.logger.info(
          { final_quality: chosen, final_size: buf.length },
          'mcp.tool.page_screenshot_full.recompressed',
        );
        if (buf.length > maxBytes) {
          throw new ScreenshotFullCompressionFailedError(buf.length, maxBytes);
        }
      }

      // 5. Persist to disk
      const slug = urlToSlug(deps.session.page.url());
      const filename = `${slug}-${Date.now()}.jpg`;
      const targetPath = join(input.saveDir, filename);
      await writeFile(targetPath, buf);

      ctx.logger.info(
        { target_path: targetPath, size_bytes: buf.length, width, height },
        'mcp.tool.page_screenshot_full.done',
      );

      return {
        ok: true,
        path: targetPath,
        format: 'jpeg',
        sizeBytes: buf.length,
        width,
        height,
      };
    },
  };
}
