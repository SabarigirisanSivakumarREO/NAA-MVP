/**
 * SettlePredicate — Phase 1c T1C-001 (AC-01, REQ-PERCEPT-V25-002).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-01 + R-01 + NF-05
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/plan.md §2.2 (v0.2 algorithm)
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-001
 *
 * Contract (R-01 v0.2):
 *   waitForSettle(page, opts?) resolves within 5000ms ± 50ms TOTAL regardless
 *   of which sub-step hangs. The 5s cap is a SINGLE overall guard (Promise.race)
 *   — NOT a sum of soft caps. Sub-step soft caps are budget hints.
 *
 * Sub-steps (each wrapped in .catch(() => {}) so a hang does not abort the whole
 * settle — only that sub-step is dropped; WarningEmitter (T1C-009) handles
 * cause signal propagation downstream):
 *   1. page.waitForLoadState("networkidle", { timeout: 2000 })
 *   2. waitForDomMutationsToStop(page, { idleMs: 300, maxMs: 3000 })
 *   3. page.evaluate(() => document.fonts?.ready)   ← Promise awaited in browser
 *   4. waitForAnimationsToFinish(page, { timeout: 1500 })
 *   5. opts.requireSelector → page.waitForSelector (timeout 2000)
 *
 * Return shape: SettleResult { elapsed_ms, capped_at_5s } — snake_case per
 * v0.2 plan + Key Entities. `capped_at_5s` uses `>= SETTLE_HARD_CAP_MS - 50`
 * to accommodate event-loop drift.
 *
 * Warning emission is OUT OF SCOPE for this file (T1C-009 owns WarningEmitter).
 * The caller (T1C-011 DeepPerceiveNode skeleton) inspects `capped_at_5s` and
 * routes a `SETTLE_TIMEOUT_5S` warning into the bundle.
 *
 * Implementation note: browser-context code is passed as STRING templates (the
 * Phase 1 MutationMonitor pattern) rather than typed callbacks. This avoids
 * needing `lib: ["dom"]` in tsconfig (currently `["ES2022"]` only) and keeps
 * Node-side and browser-side type universes cleanly separated.
 *
 * R9: no direct `import 'playwright'` — uses a local structural Page-like
 *     type compatible with both Playwright's `Page` and Phase 1's `BrowserPage`.
 * R10: file ≤ 300 LOC; functions ≤ 50 LOC.
 * R24 (Perception MUST NOT): pure utility — no LLM, no judgment, no mutation.
 */

/**
 * Minimum Page surface this predicate needs. Matches the relevant subset of
 * Playwright's `Page` AND of the Phase 1 `BrowserPage` adapter. The optional
 * `waitForSelector` is provided by Playwright directly; the Phase 1 adapter
 * does not expose it today — T1C-011 wiring extends the seam if needed per R20.
 */
export interface SettlePage {
  waitForLoadState(
    state: 'load' | 'domcontentloaded' | 'networkidle',
    opts?: { timeout?: number },
  ): Promise<void>;
  evaluate<T = unknown>(fn: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
  waitForSelector?(
    selector: string,
    opts?: { timeout?: number },
  ): Promise<unknown>;
}

/**
 * Caller-tunable knobs. All optional — defaults match plan.md §2.2 v0.2.
 */
export interface SettleOptions {
  /**
   * Wait for this selector to appear inside the settle window (2s soft cap).
   * Hang is non-fatal — same .catch(() => {}) pattern as the other sub-steps.
   */
  requireSelector?: string;
}

/**
 * Result emitted by waitForSettle(). Field names are snake_case per v0.2 plan
 * + spec Key Entities ("SettleResult: { elapsed_ms, capped_at_5s }").
 */
export interface SettleResult {
  /** Wall-clock duration from settle start to resolution (Date.now() based). */
  elapsed_ms: number;
  /**
   * True when the overall 5s guard fired. Caller (T1C-011) emits
   * `SETTLE_TIMEOUT_5S` warning when this is true. Uses
   * `elapsed_ms >= SETTLE_HARD_CAP_MS - 50` for event-loop drift tolerance.
   */
  capped_at_5s: boolean;
}

/**
 * NF-05 contract pin: 5000ms TOTAL hard cap. Public so conformance tests +
 * downstream callers (T1C-011, T1C-012) reference the same constant.
 */
export const SETTLE_HARD_CAP_MS = 5000;

/** Drift tolerance for `capped_at_5s` detection (event-loop scheduling jitter). */
const CAPPED_DRIFT_TOLERANCE_MS = 50;

/** Sub-step soft caps (budget hints — NOT the contract). */
const NETWORKIDLE_SOFT_MS = 2000;
const DOM_IDLE_WINDOW_MS = 300;
const DOM_IDLE_MAX_MS = 3000;
const ANIMATIONS_SOFT_MS = 1500;
const REQUIRE_SELECTOR_SOFT_MS = 2000;

/**
 * waitForSettle — composes the 5 sub-steps under a Promise.race against a
 * single 5000ms timer. Returns a SettleResult describing actual elapsed time
 * + whether the cap fired. See file header for the v0.2 contract.
 */
export async function waitForSettle(
  page: SettlePage,
  opts: SettleOptions = {},
): Promise<SettleResult> {
  const start = Date.now();

  // Each sub-step is wrapped in .catch(() => {}) so a hang propagates a signal
  // (collected by WarningEmitter downstream) but does NOT abort the whole
  // settle. The outer Promise.race enforces the 5s total cap.
  const settleSteps = (async (): Promise<void> => {
    await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_SOFT_MS }).catch(() => {});
    await waitForDomMutationsToStop(page, {
      idleMs: DOM_IDLE_WINDOW_MS,
      maxMs: DOM_IDLE_MAX_MS,
    }).catch(() => {});
    await page.evaluate(FONTS_READY_SCRIPT).catch(() => {});
    await waitForAnimationsToFinish(page, { timeout: ANIMATIONS_SOFT_MS }).catch(() => {});
    if (opts.requireSelector && page.waitForSelector) {
      await page
        .waitForSelector(opts.requireSelector, { timeout: REQUIRE_SELECTOR_SOFT_MS })
        .catch(() => {});
    }
  })();

  const timeout = new Promise<void>((resolve) => setTimeout(resolve, SETTLE_HARD_CAP_MS));

  await Promise.race([settleSteps, timeout]);

  const elapsed_ms = Date.now() - start;
  return {
    elapsed_ms,
    capped_at_5s: elapsed_ms >= SETTLE_HARD_CAP_MS - CAPPED_DRIFT_TOLERANCE_MS,
  };
}

/**
 * Browser-context script awaiting `document.fonts.ready` (a Promise resolved
 * when web fonts finish loading). Runs INSIDE page.evaluate so the Promise is
 * awaited in browser context — fixes v0.1 bug where Node-side
 * `waitForFunction(() => fonts?.ready)` evaluated the Promise object as truthy
 * and skipped waiting entirely.
 */
const FONTS_READY_SCRIPT = `(async () => {
  if (typeof document === 'undefined') return;
  const fontsReady = document.fonts && document.fonts.ready;
  if (fontsReady && typeof fontsReady.then === 'function') {
    await fontsReady;
  }
})();`;

/**
 * Browser-context script installing a MutationObserver on documentElement.
 * Stores last mutation timestamp on `window.__settleMutationLog`. Idempotent:
 * a re-install resets `lastMutationAt` so the idle window anchors at the most
 * recent call. Auto-disconnects after maxMs to avoid leaking observers.
 */
const MUTATION_INSTALL_SCRIPT = `((maxMs) => {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  const w = window;
  const now = Date.now();
  if (w.__settleMutationLog && w.__settleMutationObserver) {
    w.__settleMutationLog.lastMutationAt = now;
    return;
  }
  const log = { lastMutationAt: now };
  w.__settleMutationLog = log;
  const obs = new MutationObserver(() => { log.lastMutationAt = Date.now(); });
  if (document && document.documentElement) {
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  }
  w.__settleMutationObserver = obs;
  setTimeout(() => { try { obs.disconnect(); } catch (_) {} }, maxMs);
})`;

const MUTATION_READ_SCRIPT = `(() => {
  if (typeof window === 'undefined') return 0;
  const w = window;
  return w.__settleMutationLog ? Date.now() - w.__settleMutationLog.lastMutationAt : 0;
})();`;

/**
 * Wait for DOM mutations to go idle for `idleMs` consecutive milliseconds, or
 * give up after `maxMs`. Resolves cleanly on either condition; never throws —
 * caller catches with .catch(() => {}). Private helper (R10: ≤ 30 LOC).
 */
async function waitForDomMutationsToStop(
  page: SettlePage,
  opts: { idleMs: number; maxMs: number },
): Promise<void> {
  const { idleMs, maxMs } = opts;
  await page.evaluate(`(${MUTATION_INSTALL_SCRIPT})(${maxMs});`);

  const start = Date.now();
  const pollInterval = Math.max(50, Math.floor(idleMs / 3));
  while (Date.now() - start < maxMs) {
    const idleFor = (await page.evaluate(MUTATION_READ_SCRIPT)) as number;
    if (idleFor >= idleMs) return;
    await sleep(pollInterval);
  }
}

/**
 * Browser-context script counting CSS animations in `running` state. Uses
 * `document.getAnimations()` (CSS Animations & Transitions Level 2; supported
 * in all evergreen browsers). Returns 0 when API unavailable so the poll loop
 * exits immediately on older surfaces.
 */
const ANIMATIONS_RUNNING_SCRIPT = `(() => {
  if (typeof document === 'undefined' || typeof document.getAnimations !== 'function') return 0;
  return document.getAnimations().filter((a) => a.playState === 'running').length;
})();`;

/**
 * Wait for CSS animations to finish, or give up after `opts.timeout` ms.
 * Resolves cleanly on either condition; never throws — caller catches with
 * .catch(() => {}). Private helper (R10: ≤ 30 LOC).
 */
async function waitForAnimationsToFinish(
  page: SettlePage,
  opts: { timeout: number },
): Promise<void> {
  const start = Date.now();
  const pollInterval = 50;
  while (Date.now() - start < opts.timeout) {
    const running = (await page.evaluate(ANIMATIONS_RUNNING_SCRIPT)) as number;
    if (running === 0) return;
    await sleep(pollInterval);
  }
}

/** Tiny sleep helper — keeps the polling loops above readable. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
