/**
 * ElementAppearsStrategy — `element_appears` MVP strategy (Phase 3 T054).
 *
 * Spec: spec.md AC-04 + R-04 (REQ-VERIFY-003) + v0.3 F05 two-timer edge case;
 *   tasks.md T054; impact.md §ActionContract.elementAppears.
 *
 * Three-criterion visibility (ALL required): (a) querySelector != null;
 *   (b) boundingBox.width > 0 AND height > 0; (c) visibility != 'hidden'
 *   AND display != 'none' AND opacity > 0.
 *
 * Two-timer semantics — SINGLE shared ceiling = expected.timeoutMs:
 *   (1) MutationMonitor settle is a precondition gate; unstable short-circuits
 *       with { ok:false, unstable:true } — visibility probe NOT invoked.
 *   (2) Visibility probe uses only REMAINING budget; exceeding → timedOut.
 *
 * R9: BrowserSession adapter only; MutationMonitor injected via narrow
 *   `MutationSettleWaiter` (matches conformance test stub verbatim).
 * R10: ≤ 150 LOC; named exports; no `any`; no console.log.
 */
import type { Logger } from 'pino';

import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { ActionContract, VerifyResult, VerifyStrategy } from '../types.js';

/** Narrow injectable wrapper around Phase 1 MutationMonitor (test stub shape). */
export interface MutationSettleWaiter {
  waitForSettle(opts: { page: unknown; timeoutMs: number }): Promise<{ stable: boolean; unstable?: boolean }>;
}

/** In-page visibility snapshot — built by a single page.evaluate() call. */
interface VisibilityProbe {
  present: boolean;
  boundingBox: { width: number; height: number } | null;
  computedStyle: { visibility: string; display: string; opacity: string } | null;
}

/** Criterion (a) — DOM presence. */
export function criterionA_present(probe: VisibilityProbe): boolean {
  return probe.present;
}

/** Criterion (b) — non-zero bounding box in both dimensions. */
export function criterionB_boundingBox(probe: VisibilityProbe): boolean {
  const bb = probe.boundingBox;
  return bb !== null && bb.width > 0 && bb.height > 0;
}

/** Criterion (c) — computed style not hidden / not display:none / opacity > 0. */
export function criterionC_computedStyle(probe: VisibilityProbe): boolean {
  const cs = probe.computedStyle;
  if (cs === null) return false;
  if (cs.visibility === 'hidden' || cs.display === 'none') return false;
  return parseFloat(cs.opacity) > 0;
}

/**
 * `element_appears` strategy. Priority 80 — below url_change (100, navigation
 * is the most fundamental verification) but high amongst content checks.
 */
export class ElementAppearsStrategy implements VerifyStrategy {
  readonly name = 'element_appears' as const;
  readonly priority = 80;

  constructor(
    private readonly mutationWaiter: MutationSettleWaiter,
    private readonly logger?: Logger,
  ) {}

  applicable(contract: ActionContract): boolean {
    return contract.expected.kind === 'elementAppears';
  }

  async verify(contract: ActionContract, session: BrowserSession): Promise<VerifyResult> {
    if (contract.expected.kind !== 'elementAppears') {
      throw new Error('ElementAppearsStrategy received non-elementAppears contract');
    }
    const { selector, timeoutMs } = contract.expected;
    const log = this.logger?.child({ verify_strategy: 'element_appears', action_id: contract.id });

    const startedAt = Date.now();

    // (1) MutationMonitor settle precondition gate (shared ceiling).
    const settle = await this.mutationWaiter.waitForSettle({ page: session.page, timeoutMs });
    if (settle.unstable === true || settle.stable === false) {
      log?.debug({ selector }, 'verify.unstable');
      return { ok: false, strategy: 'element_appears', evidence: { selector }, unstable: true, error: 'mutation_unstable' };
    }

    // (2) Race visibility probe against remaining budget.
    const remaining = timeoutMs - (Date.now() - startedAt);
    const probe = remaining <= 0 ? null : await raceProbe(session, selector, remaining);
    if (probe === null) {
      log?.debug({ selector }, 'verify.timedOut');
      return { ok: false, strategy: 'element_appears', evidence: { selector }, timedOut: true, error: 'visibility_check_timed_out' };
    }

    // (3) Three criteria, first failure wins for diagnostic clarity.
    if (!criterionA_present(probe)) {
      return { ok: false, strategy: 'element_appears', evidence: { selector }, failedCriterion: 'a', error: 'element_not_present' };
    }
    if (!criterionB_boundingBox(probe)) {
      return { ok: false, strategy: 'element_appears', evidence: { selector, boundingBox: probe.boundingBox }, failedCriterion: 'b', error: 'element_zero_dimension' };
    }
    if (!criterionC_computedStyle(probe)) {
      return { ok: false, strategy: 'element_appears', evidence: { selector, computedStyle: probe.computedStyle }, failedCriterion: 'c', error: 'element_not_visible' };
    }

    log?.debug({ selector }, 'verify.ok');
    return {
      ok: true,
      strategy: 'element_appears',
      evidence: { selector, boundingBox: probe.boundingBox, computedStyle: probe.computedStyle },
    };
  }
}

/** In-page probe script — string literal (matches Phase 2 hover.ts:53 pattern). */
const PROBE_SCRIPT = `(selector) => {
  const el = document.querySelector(selector);
  if (el === null) return { present: false, boundingBox: null, computedStyle: null };
  const bb = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  return {
    present: true,
    boundingBox: { width: bb.width, height: bb.height },
    computedStyle: { visibility: cs.visibility, display: cs.display, opacity: cs.opacity },
  };
}`;

/** Race the probe against `budgetMs`; returns null on timeout. Single evaluate(). */
async function raceProbe(
  session: BrowserSession,
  selector: string,
  budgetMs: number,
): Promise<VisibilityProbe | null> {
  const probePromise = session.page.evaluate<VisibilityProbe>(PROBE_SCRIPT, selector);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), budgetMs);
  });
  try {
    return await Promise.race([probePromise, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
