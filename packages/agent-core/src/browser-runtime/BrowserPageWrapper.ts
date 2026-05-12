/**
 * BrowserPageWrapper — extracted helper for BrowserManager (R10 size cap).
 *
 * Source: docs/specs/mvp/phases/phase-2-tools/impact.md v0.2.7 (Wave 9b
 *         prep — T035 multi-tab + T037 download).
 *
 * Why extracted from BrowserManager.ts:
 *   Wave 9b multi-tab refactor adds ~80 LOC to newSession() (active-index
 *   tracking + 4 new BrowserSession methods + context.on('page') auto-tracking).
 *   Inlining the per-page Playwright→BrowserPage wrapper inside newSession()
 *   would push BrowserManager.ts past R10.1's 300-LOC cap. Extracting the
 *   wrapper here keeps both files compliant.
 *
 * R9 boundary note: this file is the SECOND site (after BrowserManager.ts)
 * where `playwright` types appear. It is wholly type-internal — no `chromium`
 * import — and it sits underneath BrowserManager which OWNS the playwright
 * launch. Combined, BrowserManager.ts + BrowserPageWrapper.ts form the
 * single R9 adapter unit; no upstream consumer imports either. Phase 4
 * ESLint rule (T073) will allowlist this file as part of the adapter
 * boundary.
 *
 * R10 compliance: this file under 300 lines; the single exported function
 *   is intentionally over 50 lines because it materializes the
 *   Phase-1-minimal BrowserPage interface verbatim (one method per
 *   Playwright Page method) — splitting would obscure the 1:1 mapping
 *   that is the WHOLE point of this adapter. Documented exception.
 * R13 compliance: minimal `as never` escapes ONLY at the
 *   Playwright→Phase1Minimal boundary (this is the R9 boundary file).
 */
import type { Page as PlaywrightPage } from 'playwright';
import type { BrowserDownload, BrowserPage } from '../adapters/BrowserEngine.js';

/**
 * Wrap a Playwright Page into the Phase-1-minimal BrowserPage interface.
 *
 * Used by BrowserManager.newSession() to wrap:
 *   1. The initial about:blank page created with the context
 *   2. Pages opened via session.newPage() (T035)
 *   3. Pages auto-opened by the page (e.g., target=_blank links) tracked
 *      via playwrightContext.on('page', ...)
 */
export function wrapPlaywrightPage(playwrightPage: PlaywrightPage): BrowserPage {
  return {
    goto: async (url, gotoOpts) => {
      await playwrightPage.goto(url, gotoOpts);
    },
    goBack: async (backOpts) => {
      await playwrightPage.goBack(backOpts);
    },
    goForward: async (fwdOpts) => {
      await playwrightPage.goForward(fwdOpts);
    },
    reload: async (reloadOpts) => {
      await playwrightPage.reload(reloadOpts);
    },
    url: () => playwrightPage.url(),
    mouse: {
      move: async (x, y, mouseOpts) => playwrightPage.mouse.move(x, y, mouseOpts),
      down: async () => playwrightPage.mouse.down(),
      up: async () => playwrightPage.mouse.up(),
      click: async (x, y, mouseOpts) => playwrightPage.mouse.click(x, y, mouseOpts),
      wheel: async (deltaX, deltaY) => playwrightPage.mouse.wheel(deltaX, deltaY),
    },
    keyboard: {
      type: async (text, kbOpts) => playwrightPage.keyboard.type(text, kbOpts),
      press: async (key, kbOpts) => playwrightPage.keyboard.press(key, kbOpts),
    },
    focus: async (selector, focusOpts) => playwrightPage.focus(selector, focusOpts),
    selectOption: async (selector, values, selOpts) => {
      // Playwright's selectOption accepts string | string[] | { value, label, index }[];
      // we expose the simplest contract (string | string[]) and return its readonly array result.
      const result = await playwrightPage.selectOption(
        selector,
        Array.isArray(values) ? [...values] : values,
        selOpts,
      );
      return result;
    },
    setInputFiles: async (selector, files, sifOpts) =>
      playwrightPage.setInputFiles(
        selector,
        Array.isArray(files) ? [...files] : files,
        sifOpts,
      ),
    waitForEvent: async <T extends 'download'>(
      event: T,
      eventOpts?: { timeout?: number },
    ): Promise<BrowserDownload> => {
      // Phase 2 T037 — wrap Playwright Download verbatim. Constrained
      // generic permits future event-type extensions (R18 append-only).
      const download = await playwrightPage.waitForEvent(event, eventOpts);
      return {
        suggestedFilename: () => download.suggestedFilename(),
        saveAs: (path) => download.saveAs(path),
      };
    },
    ariaSnapshot: (snapOpts) => playwrightPage.ariaSnapshot(snapOpts),
    screenshot: (shotOpts) => playwrightPage.screenshot(shotOpts) as Promise<Buffer>,
    addInitScript: async (scriptOrFn) => {
      // Playwright 1.59 returns Promise<Disposable>; we discard.
      await playwrightPage.addInitScript(scriptOrFn as never);
    },
    evaluate: <T = unknown>(fn: string | ((...args: unknown[]) => T), ...args: unknown[]) =>
      playwrightPage.evaluate(fn as never, ...args) as Promise<T>,
    waitForLoadState: (state, waitOpts) => playwrightPage.waitForLoadState(state, waitOpts),
    setViewportSize: (size) => playwrightPage.setViewportSize(size),
    setContent: (html, contentOpts) => playwrightPage.setContent(html, contentOpts),
  };
}
