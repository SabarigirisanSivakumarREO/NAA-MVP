/**
 * MutationMonitor — Phase 1 T011 (AC-06, REQ-BROWSE-PERCEPT-005/006).
 *
 * Source: spec.md AC-06 + R-08 (lines 160/181); plan.md "Phase 0 Research"
 *         item 4 (settle algorithm); tasks.md T011 Brief.
 *
 * Contract: `observe(page, { timeoutMs, settleWindowMs? })` injects a
 * MutationObserver harness via `addInitScript` AND `evaluate` (covers both
 * pre- and post-navigation install), then polls `window.__neuralMutationLog`
 * every 100 ms until either (a) `Date.now() - lastMutationAt >= settleWindowMs`
 * (default 500ms) → `{ stable: true, mutationsObserved }`, or (b) timeout
 * elapses → `{ stable: false, mutationsObserved }`.
 *
 * Why `addInitScript` AND `evaluate`: addInitScript covers SPA navigations
 * after observe(); evaluate covers the already-loaded current page so the
 * observer is live immediately. Both paths are idempotent (init-script
 * guard).
 *
 * Failures are non-fatal: any throw resolves to
 * `{ stable: false, mutationsObserved: 0 }` with a Pino `warn`.
 *
 * R10: file < 200; injected harness < 30; functions < 50. R10.6: Pino. R13: no bare `any`.
 */
import { createLogger } from '../observability/logger.js';
import type { BrowserPage } from '../adapters/BrowserEngine.js';

const log = createLogger('mutation-monitor');

const DEFAULT_SETTLE_WINDOW_MS = 500;
const POLL_INTERVAL_MS = 100;

/**
 * Per-page harness shape, kept in sync with the injected script below.
 * Same field names + types in both places — the page populates this; we
 * read it back via `page.evaluate`.
 */
interface MutationLog {
  count: number;
  lastMutationAt: number;
  startedAt: number;
  running: boolean;
}

export interface ObserveOpts {
  timeoutMs: number;
  settleWindowMs?: number;
}

export interface ObserveResult {
  stable: boolean;
  mutationsObserved: number;
}

/**
 * Injected harness — runs in PAGE context (NOT Node). Must be self-contained;
 * no closures over Node-side variables. Kept under 30 lines per R10 budget.
 *
 * Idempotent re-install guard: if `__neuralMutationLog` already exists
 * (re-navigation in the same page), reset its counters but reuse the same
 * observer.
 */
const INIT_SCRIPT = `(() => {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  const w = window;
  const now = Date.now();
  if (w.__neuralMutationLog && w.__neuralMutationObserver) {
    w.__neuralMutationLog.count = 0;
    w.__neuralMutationLog.lastMutationAt = now;
    w.__neuralMutationLog.startedAt = now;
    w.__neuralMutationLog.running = true;
    return;
  }
  w.__neuralMutationLog = { count: 0, lastMutationAt: now, startedAt: now, running: true };
  const obs = new MutationObserver((muts) => {
    if (!w.__neuralMutationLog || !w.__neuralMutationLog.running) return;
    w.__neuralMutationLog.count += muts.length;
    w.__neuralMutationLog.lastMutationAt = Date.now();
  });
  const start = () => {
    if (document && document.documentElement) {
      obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  w.__neuralMutationObserver = obs;
  w.addEventListener('unload', () => { if (w.__neuralMutationLog) w.__neuralMutationLog.running = false; }, { once: true });
})();`;

/**
 * Reset script — runs at observe() entry on the live page so the settle
 * window starts NOW (not from page-load time). Cheap, safe, idempotent.
 */
const RESET_SCRIPT = `(() => {
  if (typeof window === 'undefined') return false;
  const w = window;
  const now = Date.now();
  if (!w.__neuralMutationLog) return false;
  w.__neuralMutationLog.count = 0;
  w.__neuralMutationLog.lastMutationAt = now;
  w.__neuralMutationLog.startedAt = now;
  w.__neuralMutationLog.running = true;
  return true;
})();`;

const READ_SCRIPT = `(() => {
  if (typeof window === 'undefined') return null;
  const w = window;
  return w.__neuralMutationLog ? {
    count: w.__neuralMutationLog.count,
    lastMutationAt: w.__neuralMutationLog.lastMutationAt,
    startedAt: w.__neuralMutationLog.startedAt,
    running: w.__neuralMutationLog.running,
  } : null;
})();`;

class MutationMonitor {
  /**
   * Observe DOM mutations on `page` until settle or timeout. See file header
   * for full contract. NEVER throws — failures resolve to
   * `{ stable: false, mutationsObserved: 0 }`.
   */
  async observe(page: BrowserPage, opts: ObserveOpts): Promise<ObserveResult> {
    const settleWindowMs = opts.settleWindowMs ?? DEFAULT_SETTLE_WINDOW_MS;
    const timeoutMs = opts.timeoutMs;
    const startedAt = Date.now();

    // Step 1: ensure harness is installed. addInitScript is the canonical
    // pre-navigation injection seam; calling it post-navigation is safe but
    // the harness only attaches on the NEXT navigation. To cover the
    // already-navigated case, we ALSO evaluate the init script directly so
    // the observer is live immediately on the current page.
    try {
      await page.addInitScript(INIT_SCRIPT);
    } catch (err) {
      log.warn(
        { event: 'mutation_monitor.init_script_failed', err: (err as Error).message },
        'addInitScript failed; observer may miss pre-existing pages',
      );
    }

    // Install/refresh on the live page. If this fails (page navigated away,
    // CSP blocks), we fall back to non-fatal failure mode.
    try {
      await page.evaluate(INIT_SCRIPT);
    } catch (err) {
      log.warn(
        { event: 'mutation_monitor.live_install_failed', err: (err as Error).message },
        'live observer install failed; returning stable: false',
      );
      return { stable: false, mutationsObserved: 0 };
    }

    // Reset counters so the settle window is anchored at observe()-call
    // time, not page-load time (a page that loaded 5s ago and has been
    // quiet should immediately settle).
    try {
      await page.evaluate(RESET_SCRIPT);
    } catch (err) {
      log.warn(
        { event: 'mutation_monitor.reset_failed', err: (err as Error).message },
        'observer reset failed; returning stable: false',
      );
      return { stable: false, mutationsObserved: 0 };
    }

    // Step 2: poll loop. Sample every POLL_INTERVAL_MS until settle or
    // timeout. NOT a busy loop — `setTimeout` yields between polls.
    let lastCount = 0;
    while (true) {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= timeoutMs) {
        log.info(
          {
            event: 'mutation_monitor.timeout',
            elapsed_ms: elapsed,
            mutations_observed: lastCount,
          },
          'mutation monitor hit timeout without settle',
        );
        return { stable: false, mutationsObserved: lastCount };
      }

      let snapshot: MutationLog | null;
      try {
        snapshot = (await page.evaluate(READ_SCRIPT)) as MutationLog | null;
      } catch (err) {
        log.warn(
          { event: 'mutation_monitor.read_failed', err: (err as Error).message },
          'page.evaluate failed during poll; returning stable: false',
        );
        return { stable: false, mutationsObserved: lastCount };
      }

      if (snapshot === null) {
        // Harness absent — page was reset under us. Treat as non-fatal.
        log.warn(
          { event: 'mutation_monitor.harness_missing' },
          'mutation log not present on page; returning stable: false',
        );
        return { stable: false, mutationsObserved: lastCount };
      }

      lastCount = snapshot.count;
      const sinceLast = Date.now() - snapshot.lastMutationAt;
      if (sinceLast >= settleWindowMs) {
        log.info(
          {
            event: 'mutation_monitor.settled',
            settle_ms: elapsed,
            mutations_observed: lastCount,
          },
          'mutation monitor settled',
        );
        return { stable: true, mutationsObserved: lastCount };
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

export const mutationMonitor = new MutationMonitor();
export type { MutationMonitor };
