/**
 * BrowserManager — Phase 1 R9 first concrete adapter.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-01 + R-02;
 *         docs/specs/mvp/phases/phase-1-perception/tasks.md T006;
 *         docs/specs/mvp/phases/phase-1-perception/impact.md (BrowserEngine NEW).
 *
 * This file is the SOLE site that imports `playwright` (R9 boundary —
 * see adapters/BrowserEngine.ts header). All upstream consumers operate
 * against the Phase-1-minimal `BrowserPage` / `BrowserContext` wrappers.
 *
 * --- Walking-skeleton compatibility ---
 *
 * `capture(url)` is the T-SKELETON-002 fixture stub (week-1; loads
 * peregrine-pdp.json verbatim). It STAYS through Phase 1 implementation
 * because `apps/cli/src/commands/audit.ts` + `tests/acceptance/walking-skeleton.spec.ts`
 * (12 tests, AC-W1..W7) depend on it. T013 (later) lands
 * `ContextAssembler.capture()` and migrates `audit.ts` to use it; at that
 * point this method may be removed or kept as a delegate.
 *
 * `newSession(opts?)` is the NEW Phase 1 R9 method per AC-01 — launches
 * real Playwright Chromium and returns a `BrowserSession` with re-typed
 * Phase-1-minimal page/context wrappers. Used by T007 StealthConfig +
 * T008 AccessibilityExtractor + T011 MutationMonitor + T012
 * ScreenshotExtractor + T013 ContextAssembler.
 *
 * R10 compliance: file under 300 lines; functions under 50 lines.
 * R10.6 compliance: Pino logger via createLogger; no console.log.
 * R13 compliance: no bare `any`; minimal `as never` escapes ONLY at the
 *   Playwright→Phase1Minimal boundary (this is the R9 boundary file).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { PageStateModelSchema, checkAxTreeDepth, type PageStateModel } from '../perception/types.js';
import { createLogger } from '../observability/logger.js';
import {
  SessionOptsSchema,
  type BrowserContext,
  type BrowserEngine,
  type BrowserPage,
  type BrowserSession,
  type SessionOpts,
} from '../adapters/BrowserEngine.js';

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'tests',
  'fixtures',
  'perception',
  'peregrine-pdp.json',
);

const DEFAULT_VIEWPORT: Readonly<{ width: number; height: number }> = Object.freeze({
  width: 1280,
  height: 720,
});

export class BrowserManager implements BrowserEngine {
  /**
   * T-SKELETON-002 walking-skeleton fixture path. KEPT VERBATIM through
   * Phase 1 — see file header. Loads peregrine-pdp.json regardless of
   * `_url` argument. T013 supersedes via ContextAssembler.
   */
  async capture(_url: string): Promise<PageStateModel> {
    const raw = JSON.parse(await readFile(FIXTURE_PATH, 'utf8')) as unknown;

    // T014 safety: check ax-tree depth BEFORE z.parse to prevent stack
    // overflow on cyclic/deep tree input.
    const rawObj = raw as { accessibilityTree?: { root?: unknown } };
    if (rawObj.accessibilityTree?.root !== undefined) {
      const result = checkAxTreeDepth(rawObj.accessibilityTree.root);
      if (!result.ok) {
        throw new Error(`BrowserManager fixture ax-tree malformed: ${result.reason}`);
      }
    }

    return PageStateModelSchema.parse(raw);
  }

  /**
   * T006 / AC-01: launch real Playwright Chromium and return a
   * BrowserSession. Caller MUST `await session.close()` to release OS
   * handles (NF-Phase1-05; no zombie Chromium processes).
   *
   * `close()` is idempotent — second call is a no-op (per AC-01 conformance
   * test).
   */
  async newSession(opts?: SessionOpts): Promise<BrowserSession> {
    const validated = SessionOptsSchema.parse(opts ?? {});
    const sessionId = randomUUID();
    const log = createLogger('browser-manager').child({ session_id: sessionId });

    const browser = await chromium.launch({ headless: validated.headless });

    // exactOptionalPropertyTypes (R2.x) — build context options without
    // assigning `undefined` to optional fields. Spread avoids the issue.
    const contextOpts: { viewport: { width: number; height: number }; userAgent?: string } = {
      viewport: validated.viewport ?? DEFAULT_VIEWPORT,
    };
    if (validated.userAgent !== undefined) {
      contextOpts.userAgent = validated.userAgent;
    }
    const playwrightContext = await browser.newContext(contextOpts);
    const playwrightPage = await playwrightContext.newPage();

    log.info({ event: 'session.opened', headless: validated.headless }, 'browser session opened');

    // R9 boundary: re-type wrappers exposing only the Phase-1-minimal
    // surface. `as never` escapes are localized to THIS file ONLY (the
    // adapter boundary); they encode the deliberate type-narrowing from
    // Playwright's broad signatures to our minimal subset.
    //
    // R11.4 v0.3.2 — Phase 1 spec/plan/impact/tasks updated to cite
    // `page.ariaSnapshot()` directly (Playwright 1.57+; legacy
    // `accessibility.snapshot()` was removed in 1.57). T008
    // AccessibilityExtractor owns the YAML→AccessibilityNodeSchema parse-back.
    const page: BrowserPage = {
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
        move: async (x, y, mouseOpts) =>
          playwrightPage.mouse.move(x, y, mouseOpts),
        down: async () => playwrightPage.mouse.down(),
        up: async () => playwrightPage.mouse.up(),
        click: async (x, y, mouseOpts) =>
          playwrightPage.mouse.click(x, y, mouseOpts),
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

    // T007 stealth surface: `pages()` exposes the existing-page list so
    // StealthConfig can patch the about:blank page created above. We hold
    // a single-page array (Phase 1 only opens one page per session); the
    // adapter contract is `readonly BrowserPage[]` so callers cannot grow
    // the list out of band.
    const wrappedPages: BrowserPage[] = [page];

    const context: BrowserContext = {
      addInitScript: async (scriptOrFn) => {
        await playwrightContext.addInitScript(scriptOrFn as never);
      },
      pages: () => wrappedPages,
    };

    let closed = false;
    const close = async (): Promise<void> => {
      // Idempotent close (AC-01 conformance: second close() MUST NOT throw).
      if (closed) return;
      closed = true;
      try {
        await playwrightContext.close();
        await browser.close();
        log.info({ event: 'session.closed' }, 'browser session closed cleanly');
      } catch (err) {
        log.warn(
          { event: 'session.close_failed', err: (err as Error).message },
          'session close had errors',
        );
        throw err;
      }
    };

    return {
      id: sessionId,
      page,
      context,
      close,
    };
  }
}
