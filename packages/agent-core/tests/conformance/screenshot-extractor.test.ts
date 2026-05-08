/**
 * Conformance test for AC-07 (T012) — ScreenshotExtractor.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-07
 *         (line 160); tasks.md T012 acceptance.
 *
 * R3.1 TDD: this stub MUST FAIL until T012 implementation lands.
 * Module-not-found at import is the expected failure mode.
 *
 * Anchor: @AC-07 — screenshotExtractor.capture(page) returns a JPEG
 * Buffer ≤ 150 KB and ≤ 1280 px wide; uses Sharp for compression if
 * Playwright's native output exceeds the cap.
 */
import { describe, expect, test } from 'vitest';
// @ts-expect-error — module deliberately not yet implemented (T012)
import { screenshotExtractor } from '../../src/perception/ScreenshotExtractor.js';
// @ts-expect-error — module deliberately not yet implemented (T006)
import { BrowserManager } from '../../src/browser-runtime/BrowserManager.js';

const SCREENSHOT_MAX_BYTES = 150 * 1024; // 153_600
const SCREENSHOT_MAX_WIDTH = 1280;

describe('ScreenshotExtractor — AC-07 conformance', () => {
  /**
   * @AC-07 capture() returns a JPEG Visual with sizeBytes ≤ 150 KB.
   */
  test('AC-07: returns JPEG Buffer <= 150 KB', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    try {
      await session.page.goto('https://www.amazon.in', {
        waitUntil: 'domcontentloaded',
        timeout: 10_000,
      });
      const visual = await screenshotExtractor.capture(session.page);
      expect(visual.format).toBe('jpeg');
      expect(visual.sizeBytes).toBeLessThanOrEqual(SCREENSHOT_MAX_BYTES);
    } finally {
      await session.close();
    }
  });

  /**
   * @AC-07 Output width ≤ 1280 px.
   */
  test('AC-07: returns image width <= 1280 px', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    try {
      await session.page.goto('https://www.amazon.in', {
        waitUntil: 'domcontentloaded',
        timeout: 10_000,
      });
      const visual = await screenshotExtractor.capture(session.page);
      expect(visual.width).toBeLessThanOrEqual(SCREENSHOT_MAX_WIDTH);
    } finally {
      await session.close();
    }
  });
});
