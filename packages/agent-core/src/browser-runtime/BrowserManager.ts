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
import { chromium, type Page as PlaywrightPage } from 'playwright';
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
import { wrapPlaywrightPage } from './BrowserPageWrapper.js';

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
    const initialPlaywrightPage = await playwrightContext.newPage();

    log.info({ event: 'session.opened', headless: validated.headless }, 'browser session opened');

    // R9 boundary: re-type wrappers exposing only the Phase-1-minimal
    // surface. The per-page wrap helper lives in BrowserPageWrapper.ts
    // (R10 size cap — Wave 9b multi-tab refactor would push this file
    // past 300 LOC if inlined).
    //
    // R11.4 v0.3.2 — Phase 1 spec/plan/impact/tasks updated to cite
    // `page.ariaSnapshot()` directly (Playwright 1.57+; legacy
    // `accessibility.snapshot()` was removed in 1.57). T008
    // AccessibilityExtractor owns the YAML→AccessibilityNodeSchema parse-back.
    //
    // Phase 2 T035 multi-tab state — parallel arrays of Playwright pages
    // + their wrapped counterparts, kept in lockstep. activeIdx tracks
    // which tab `session.page` (dynamic getter) returns.
    const wrappedPages: BrowserPage[] = [];
    const playwrightPages: PlaywrightPage[] = [];
    let activeIdx = 0;

    const trackPage = (pwPage: PlaywrightPage): number => {
      wrappedPages.push(wrapPlaywrightPage(pwPage));
      playwrightPages.push(pwPage);
      return wrappedPages.length - 1;
    };

    trackPage(initialPlaywrightPage);

    // Auto-track pages opened by the page itself (e.g., target=_blank
    // links, window.open). Also handles racing pages that arrive between
    // `playwrightContext.newPage()` resolve and our trackPage() call —
    // we guard against double-tracking in newPage() below.
    playwrightContext.on('page', (newPlaywrightPage) => {
      if (playwrightPages.includes(newPlaywrightPage)) return;
      const idx = trackPage(newPlaywrightPage);
      log.info({ event: 'session.page_added', index: idx }, 'new page tracked');
    });

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

    const session: BrowserSession = {
      id: sessionId,
      get page(): BrowserPage {
        // Phase 2 T035 — dynamic getter returns the current active page.
        // Tools that read `session.page` at handler-invocation time
        // transparently operate on whichever tab is currently active.
        const p = wrappedPages[activeIdx];
        if (p === undefined) {
          throw new Error(`BrowserSession: no active page at index ${activeIdx}`);
        }
        return p;
      },
      context,
      pages: () => wrappedPages,
      activeIndex: () => activeIdx,
      setActiveIndex(index: number): void {
        if (!Number.isInteger(index) || index < 0 || index >= wrappedPages.length) {
          throw new RangeError(
            `BrowserSession.setActiveIndex: index ${index} out of bounds [0, ${wrappedPages.length})`,
          );
        }
        activeIdx = index;
        log.info(
          { event: 'session.active_index_changed', active_index: index },
          'active tab switched',
        );
      },
      newPage: async (): Promise<number> => {
        const newPwPage = await playwrightContext.newPage();
        // The context.on('page') handler may have already tracked it
        // (Playwright fires the event synchronously in most cases). Find
        // it by reference; if missing, track now.
        const existingIdx = playwrightPages.indexOf(newPwPage);
        if (existingIdx !== -1) return existingIdx;
        return trackPage(newPwPage);
      },
      closePage: async (index: number): Promise<void> => {
        if (!Number.isInteger(index) || index < 0 || index >= wrappedPages.length) {
          throw new RangeError(
            `BrowserSession.closePage: index ${index} out of bounds [0, ${wrappedPages.length})`,
          );
        }
        if (wrappedPages.length === 1) {
          throw new RangeError(
            'BrowserSession.closePage: cannot close the last remaining page; close the session instead',
          );
        }
        const pwPage = playwrightPages[index];
        if (pwPage !== undefined) {
          await pwPage.close();
        }
        wrappedPages.splice(index, 1);
        playwrightPages.splice(index, 1);
        if (activeIdx === index) {
          activeIdx = Math.min(index, wrappedPages.length - 1);
        } else if (activeIdx > index) {
          activeIdx -= 1;
        }
        log.info(
          { event: 'session.page_closed', closed_index: index, active_index: activeIdx },
          'page closed',
        );
      },
      close,
    };

    return session;
  }
}
