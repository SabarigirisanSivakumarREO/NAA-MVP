/**
 * BrowserEngine — R9 adapter interface (FIRST CONCRETE ADAPTER for Neural).
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-01 + R-01;
 *         docs/specs/mvp/phases/phase-1-perception/impact.md §"BrowserEngine (NEW)"
 *         (lines 87-114, exact interface shape canon);
 *         docs/specs/mvp/phases/phase-1-perception/tasks.md T006.
 *
 * This file is THE R9 boundary for Playwright. Direct
 * `import { chromium } from 'playwright'` is FORBIDDEN outside this file
 * and the single concrete implementor (BrowserManager.ts). Phase 4 ESLint
 * rule (T073) will enforce; until then code-review enforces.
 *
 * Why re-typed wrappers (BrowserPage / BrowserContext) instead of exporting
 * raw `Page`/`BrowserContext` from playwright:
 *   1. Playwright type leakage upstream would force every consumer (Phase 2
 *      MCP tools, Phase 7 deep_perceive) to depend on `playwright` as a
 *      transitive type — defeating R9.
 *   2. The Phase-1-minimal surface advertises only the methods the
 *      perception layer actually needs. Adding methods is non-breaking
 *      forward-compat; renaming/removing requires an impact.md update (R20).
 *   3. Phase-2/4 will compose against this seam (impact.md Forward Contract).
 *
 * R10 compliance: file under 300 lines (currently ~80).
 */
import { z } from 'zod';

/**
 * Session creation options (Zod-validated at the adapter boundary).
 *
 * `headless` defaults true — Phase 1 always headless. Phase 5+ may flip
 * for visible-mode debugging via the same opts.
 */
export const SessionOptsSchema = z
  .object({
    headless: z.boolean().default(true),
    viewport: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .optional(),
    userAgent: z.string().optional(),
  })
  .strict();

export type SessionOpts = z.infer<typeof SessionOptsSchema>;

/**
 * Phase-1-minimal page wrapper. Methods exposed are ONLY those Phase 1
 * perception layer needs:
 *   - goto: AccessibilityExtractor entry navigation
 *   - ariaSnapshot: AccessibilityExtractor data fetch (Playwright 1.57+;
 *     returns YAML string. T008 AccessibilityExtractor owns the YAML→
 *     AccessibilityNodeSchema parse-back step so downstream consumers see
 *     the legacy AX-tree object shape. Replaces removed
 *     `accessibility.snapshot()` API per Phase 1 spec.md v0.3.2 R-05.)
 *   - screenshot: ScreenshotExtractor JPEG capture
 *   - addInitScript: MutationMonitor observer injection
 *   - evaluate: HardFilter / SoftFilter element measurement
 *   - waitForLoadState: ContextAssembler stabilization
 *   - setViewportSize: T007 StealthConfig per-session viewport rotation
 *     (must run on the existing about:blank page before any navigation;
 *     `addInitScript` cannot retroactively resize a page that has already
 *     loaded). Added as part of T007 reduced-scope stealth surface.
 *   - setContent: T011 MutationMonitor conformance test surface — load
 *     synthetic HTML (static or mutating) without going to a real network
 *     URL. Used by `mutation-monitor.test.ts` AC-06 dynamic-page +
 *     non-fatal-failure scenarios. Forward-compatible (Phase 5
 *     OverlayDismisser fixtures may also use this).
 *
 * Phase 2 (MCP tools) + Phase 4 (verification engine) will EXTEND this
 * interface; extensions need their own impact.md if they cross other
 * layer boundaries (R20).
 */
export interface BrowserPage {
  goto(
    url: string,
    opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number },
  ): Promise<void>;
  /** Phase 2 T021/T022 — navigation history wrapper (R18 append-only Phase-2 extension). */
  goBack(opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<void>;
  /** Phase 2 T021/T022 — navigation history wrapper (R18 append-only Phase-2 extension). */
  goForward(opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<void>;
  /** Phase 2 T023 — reload current page (R18 append-only Phase-2 extension). */
  reload(opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<void>;
  /** Phase 2 T024 — read current URL (R18 append-only Phase-2 extension; used by ContextAssembler.captureFromSession to derive metadata.url for the active session). */
  url(): string;
  /**
   * Phase 2 T027/T028 — pointer-event surface (R18 append-only Phase-2
   * extension). Shape is structurally compatible with MouseBehavior's
   * `MousePage.mouse` interface (browser-runtime/MouseBehavior.ts:33-40),
   * letting T027 browser_click + T028 browser_click_coords pass
   * `session.page` directly to `mouseBehavior.click()` without re-typing.
   */
  mouse: {
    move(x: number, y: number, opts?: { steps?: number }): Promise<void>;
    down(): Promise<void>;
    up(): Promise<void>;
    click(x: number, y: number, opts?: { delay?: number }): Promise<void>;
    /** Phase 2 T030 — emit a wheel event for ScrollBehavior momentum scroll. */
    wheel(deltaX: number, deltaY: number): Promise<void>;
  };
  /**
   * Phase 2 T029 — keyboard surface (R18 append-only Phase-2 extension).
   * Structurally compatible with TypingBehavior's TypingKeyboard interface
   * (browser-runtime/TypingBehavior.ts:26-29).
   */
  keyboard: {
    type(text: string, opts?: { delay?: number }): Promise<void>;
    press(key: string, opts?: { delay?: number }): Promise<void>;
  };
  /**
   * Phase 2 T029 — focus an element by selector (R18 append-only Phase-2
   * extension). browser_type focuses the target before delegating to
   * typingBehavior (which expects pre-focused string-target callers per
   * TypingBehavior.ts:116-118).
   */
  focus(selector: string, opts?: { timeout?: number }): Promise<void>;
  /**
   * Phase 2 T031 — wrap Playwright's selectOption (R18 append-only Phase-2
   * extension). Returns the array of values that were actually selected
   * (Playwright contract). Accepts a single value string or array of values.
   */
  selectOption(
    selector: string,
    values: string | readonly string[],
    opts?: { timeout?: number },
  ): Promise<readonly string[]>;
  /**
   * Phase 2 T034 — wrap Playwright's setInputFiles (R18 append-only Phase-2
   * extension). Sets the value of a file <input> element to one or more
   * absolute paths. Phase 4 SafetyCheck gates by safetyClass='requires_hitl'.
   */
  setInputFiles(
    selector: string,
    files: string | readonly string[],
    opts?: { timeout?: number },
  ): Promise<void>;
  /**
   * Phase 2 T037 — wait for a Playwright event on this page. Currently
   * typed for `'download'` only; the constrained generic lets future
   * waves extend to other event types without breaking change. Returns
   * a BrowserDownload wrapper mirroring Playwright's Download verbatim.
   * R18 append-only Phase-2 extension. Phase 4 SafetyCheck gates
   * browser_download invocations via safetyClass='requires_hitl' (R8.4).
   */
  waitForEvent<T extends 'download'>(
    event: T,
    opts?: { timeout?: number },
  ): Promise<BrowserDownload>;
  /**
   * Phase 2 T040 — wait for a selector to reach a target state (R18
   * append-only Phase-2 extension). Returns void; we deliberately don't
   * expose an element handle to Phase 2 consumers (handle lifecycle would
   * complicate the adapter contract). Default state='visible'.
   */
  waitForSelector(
    selector: string,
    opts?: {
      state?: 'attached' | 'detached' | 'visible' | 'hidden';
      timeout?: number;
    },
  ): Promise<void>;
  ariaSnapshot(opts?: { ref?: boolean; timeout?: number }): Promise<string>;
  screenshot(opts?: { type?: 'jpeg' | 'png'; quality?: number; fullPage?: boolean }): Promise<Buffer>;
  addInitScript(scriptOrFn: string | (() => void)): Promise<void>;
  evaluate<T = unknown>(fn: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
  waitForLoadState(
    state?: 'load' | 'domcontentloaded' | 'networkidle',
    opts?: { timeout?: number },
  ): Promise<void>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  setContent(
    html: string,
    opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number },
  ): Promise<void>;
}

/**
 * Phase 2 T037 — download event payload. Mirrors Playwright's Download
 * object verbatim (suggestedFilename + saveAs). Returned by
 * `BrowserPage.waitForEvent('download', opts?)`. Phase 4 SafetyCheck
 * gates browser_download invocations via safetyClass='requires_hitl'
 * (R8.4). R18 append-only Phase-2 extension.
 */
export interface BrowserDownload {
  /** Server-suggested filename from Content-Disposition or URL. */
  suggestedFilename(): string;
  /** Save the download to an absolute path. */
  saveAs(path: string): Promise<void>;
}

/**
 * Phase-1-minimal context wrapper. Phase 1 needs:
 *   - addInitScript: T007 StealthConfig + T011 MutationMonitor — script
 *     runs on every NEW page in the context (including same-origin
 *     navigations).
 *   - pages(): T007 StealthConfig must reach the EXISTING about:blank page
 *     created by `BrowserManager.newSession()` to apply UA / viewport /
 *     fingerprint patches retroactively. `addInitScript` only fires on
 *     subsequent navigations, so existing-page patches go through
 *     `page.evaluate` + `page.setViewportSize` reached via this method.
 */
export interface BrowserContext {
  addInitScript(scriptOrFn: string | (() => void)): Promise<void>;
  pages(): readonly BrowserPage[];
}

/**
 * BrowserSession — owned by the caller; MUST be `close()`d to release OS
 * handles (NF-Phase1-05). The `id` field is a uuid used as the Pino
 * `session_id` correlation field for the lifetime of the session.
 *
 * Phase 2 T035 R20 forward-compat extension: `page` is now a DYNAMIC
 * GETTER returning the page at `activeIndex()`. Tools that read
 * `session.page` at handler-invocation time (not factory-registration
 * time) transparently operate on whichever tab is currently active
 * (set via `setActiveIndex`). The interface signature is identical to
 * Phase 1 (R18 append-only on signature; only implementation semantics
 * extended).
 */
export interface BrowserSession {
  readonly id: string;
  /**
   * Active page. Returns the page at `activeIndex()`. Tools that read
   * `session.page` at handler-invocation time transparently operate on
   * whichever tab is currently active (set via `setActiveIndex`).
   * Phase 2 T035 R20 forward-compat: implementation evolved from fixed
   * property to dynamic getter; signature unchanged (R18 append-only).
   */
  readonly page: BrowserPage;
  readonly context: BrowserContext;
  /**
   * Phase 2 T035 — list all pages in this session's context with stable
   * insertion-order indices. The array is a snapshot; mutation doesn't
   * affect session state (R18 append-only return type). R18 append-only
   * Phase-2 extension.
   */
  pages(): readonly BrowserPage[];
  /**
   * Phase 2 T035 — current active-page index, in [0, pages().length).
   * The `page` getter returns `pages()[activeIndex()]`. R18 append-only
   * Phase-2 extension.
   */
  activeIndex(): number;
  /**
   * Phase 2 T035 — switch active tab. Throws RangeError if index is
   * out of bounds or the page at that index has been closed. Subsequent
   * `session.page` accesses return the new active page. R18 append-only
   * Phase-2 extension.
   */
  setActiveIndex(index: number): void;
  /**
   * Phase 2 T035 — open a new tab in this session's context. Returns
   * the new tab's index. Does NOT switch active; caller must
   * setActiveIndex if desired. R18 append-only Phase-2 extension.
   */
  newPage(): Promise<number>;
  /**
   * Phase 2 T035 — close a tab by index. Throws RangeError if invalid
   * index or if this would leave the session with zero pages. If the
   * closed page was the active page, active index shifts to the next
   * surviving page (or the previous if closing the last). R18
   * append-only Phase-2 extension.
   */
  closePage(index: number): Promise<void>;
  close(): Promise<void>;
}

/**
 * BrowserEngine — the R9 adapter contract. Phase 1 has exactly one
 * implementor (`BrowserManager`). Future implementors (e.g.,
 * `StubBrowserEngine` for offline tests in v1.2) MUST conform to this
 * interface verbatim.
 */
export interface BrowserEngine {
  newSession(opts?: SessionOpts): Promise<BrowserSession>;
}
