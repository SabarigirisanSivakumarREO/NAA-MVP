/**
 * Conformance test for AC-06 (T011) — MutationMonitor.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-06
 *         (line 159); tasks.md T011 acceptance.
 *
 * R3.1 TDD: this stub MUST FAIL until T011 implementation lands.
 * Module-not-found at import is the expected failure mode.
 *
 * Anchor: @AC-06 — mutationMonitor.observe(page, opts) injects a
 * MutationObserver via addInitScript; polls for settle (no mutations
 * in 500 ms window); reports stable: true within 2 s on static pages
 * and stable: false after 10 s timeout on dynamic pages; failures are
 * non-fatal.
 */
import { describe, expect, test } from 'vitest';
// @ts-expect-error — module deliberately not yet implemented (T011)
import { mutationMonitor } from '../../src/perception/MutationMonitor.js';
// @ts-expect-error — module deliberately not yet implemented (T006)
import { BrowserManager } from '../../src/browser-runtime/BrowserManager.js';

const STATIC_URL = 'https://example.com';

describe('MutationMonitor — AC-06 conformance', () => {
  /**
   * @AC-06 Settles with stable: true within 2 s on a static page.
   */
  test('AC-06: settles within 2 s on static page', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    try {
      await session.page.goto(STATIC_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 });
      const result = await mutationMonitor.observe(session.page, { timeoutMs: 5000 });
      expect(result.stable).toBe(true);
    } finally {
      await session.close();
    }
  });

  /**
   * @AC-06 Returns stable: false after timeout on a dynamic page (no
   * settle window achieved).
   */
  test('AC-06: returns stable: false after 10 s on dynamic page', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    try {
      // Inject a page that mutates the DOM every 100 ms forever.
      await session.page.setContent('<div id="x">0</div>');
      await session.page.evaluate(() => {
        let i = 0;
        setInterval(() => {
          const el = document.getElementById('x');
          if (el) el.textContent = String(++i);
        }, 100);
      });
      const result = await mutationMonitor.observe(session.page, { timeoutMs: 10_000 });
      expect(result.stable).toBe(false);
    } finally {
      await session.close();
    }
  }, 15_000);

  /**
   * @AC-06 Failures are non-fatal — observer errors should NOT throw
   * out of observe(); they should resolve with stable: false.
   */
  test('AC-06: observer failures are non-fatal', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    try {
      await session.page.setContent('<div></div>');
      await expect(
        mutationMonitor.observe(session.page, { timeoutMs: 1000 }),
      ).resolves.toBeDefined();
    } finally {
      await session.close();
    }
  });
});
