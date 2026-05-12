/**
 * DeepPerceiveNode — Phase 7 forward stub (Phase 1c T1C-011, AC-11, REQ-PERCEPT-V25-002).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-11 + R-12
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/plan.md §2.1
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-011
 *
 * Phase scope:
 *   - Phase 1c (this file, T1C-011): SMALL forward-stub. Wires `waitForSettle()`
 *     BEFORE AnalyzePerception capture and propagates settle warnings (notably
 *     `SETTLE_TIMEOUT_5S`) into the bundle via the shared `WarningEmitter`.
 *   - Phase 7 (T117): full LLM-driven enrichments + `_extensions.deepPerceive`
 *     population. NOT IMPLEMENTED HERE — this stub only carries the settle hook
 *     so the rest of the bundle pipeline can compile + integrate now per R20.
 *
 * Contract (AC-11 + R-12):
 *   - `waitForSettle(page, { requireSelector })` runs FIRST.
 *   - When `settle.capped_at_5s === true`, emit `SETTLE_TIMEOUT_5S` so the
 *     warning surfaces in `PerceptionBundle.warnings` at finalize time.
 *   - Sub-step warnings (FONTS_NOT_READY / ANIMATION_NOT_SETTLED / ...) flow
 *     through the same shared emitter (other emit-sites are owned by future
 *     Phase 7 wiring + the SettlePredicate caller seam).
 *   - Return value is the settle result + the current emitter snapshot so the
 *     caller (Phase 7 DeepPerceiveNode, or the Phase 1c integration test seam
 *     in AC-12) can fold the warnings into the bundle envelope.
 *
 * Out of scope for Phase 1c:
 *   - LLM-driven element enrichment, intent classification, persona modeling,
 *     `_extensions.deepPerceive` payload assembly. All Phase 7 T117.
 *   - `ContextAssembler.capture()` invocation — owned by Phase 7's full node
 *     (this stub only guarantees the settle gate fires BEFORE capture per AC-11
 *     wiring expectation; the capture call itself is in T117).
 *
 * Constitutional compliance:
 *   - R3.1  test RED → GREEN (Wave 0 conformance test now compiles + passes)
 *   - R9    no direct Playwright import — uses local structural `PageLike` type
 *           (Stage 2.5 fix I2 — prior `import type { Page } from 'playwright'`
 *           violated R9.1 outside adapters; mirrors SettlePredicate.SettlePage).
 *           Phase 7 T117 will pass a real Playwright `Page` — TypeScript
 *           structural typing accepts it.
 *   - R10   file ≤ 300 LOC (target ≤ 80); functions ≤ 50 LOC
 *   - R13   no `any`
 *   - R20   forward-stub keeps the shared contract surface stable so Phase 7
 *           T117 can grow into it without rewriting the settle wiring
 *   - R24   capture-only; no judgment, no LLM, no scoring
 */
import {
  type SettlePage,
  type SettleResult,
  waitForSettle,
} from '../../perception/SettlePredicate.js';
import {
  type Warning,
  WarningEmitter,
} from '../../perception/WarningEmitter.js';

/**
 * Minimum Page surface this stub needs. Currently equivalent to SettlePredicate's
 * `SettlePage` since the stub only delegates to `waitForSettle`. Phase 7 T117
 * will extend this with the additional Playwright methods deepPerceive needs
 * (evaluate / screenshot / etc.) — additive shape only per R20.
 *
 * Defined here as a re-export alias so future T117 widening doesn't ripple back
 * into SettlePredicate (which keeps its narrower surface for non-deepPerceive
 * callers like waitForSettle's direct conformance tests).
 */
export type PageLike = SettlePage;

/**
 * Caller-tunable options for the Phase 1c stub. Phase 7 T117 will extend this
 * with the full DeepPerceive option set (LLM persona, enrichment toggles, etc.)
 * — additive shape only, no rename / no removal, per R20.
 */
export interface DeepPerceiveOptions {
  /**
   * Forwarded to `waitForSettle`. When provided, settle additionally waits for
   * this selector to appear inside the 5s window (soft cap 2s). Hang is
   * non-fatal per SettlePredicate sub-step contract.
   */
  requireSelector?: string;
}

/**
 * Result of the Phase 1c settle-gated stub. Phase 7 T117 will extend this with
 * the full DeepPerceive enrichment payload — additive shape only per R20.
 */
export interface DeepPerceiveResult {
  /** Raw SettleResult from `waitForSettle` (elapsed_ms + capped_at_5s). */
  settle: SettleResult;
  /** Immutable snapshot of warnings the emitter has accumulated so far. */
  warnings: readonly Warning[];
}

/**
 * deepPerceiveWithSettle — Phase 1c T1C-011 entry point.
 *
 * Runs the settle predicate BEFORE any capture, emits `SETTLE_TIMEOUT_5S` when
 * the 5s hard cap fired, and hands the emitter snapshot back to the caller so
 * downstream PerceptionBundle assembly (T1C-010) can fold it into `warnings`.
 *
 * Phase 7 T117 will wrap this with the full DeepPerceive logic — this stub is
 * intentionally minimal (settle gate + warning propagation only) per R20.
 */
export async function deepPerceiveWithSettle(
  page: PageLike,
  emitter: WarningEmitter,
  opts: DeepPerceiveOptions = {},
): Promise<DeepPerceiveResult> {
  const settle = await waitForSettle(
    page,
    opts.requireSelector !== undefined
      ? { requireSelector: opts.requireSelector }
      : {},
  );

  if (settle.capped_at_5s) {
    emitter.emit(
      'SETTLE_TIMEOUT_5S',
      `Settle hit 5s hard cap (elapsed ${settle.elapsed_ms}ms)`,
    );
  }

  return {
    settle,
    warnings: emitter.collect(),
  };
}

/**
 * DeepPerceiveNode — class-shaped forward stub. Phase 7 T117 supersedes this
 * with the full LangGraph node (state input → enriched perception output).
 *
 * Phase 1c surface: a thin wrapper around `deepPerceiveWithSettle` so callers
 * that consume the conventional node shape (vs. the bare function) compile
 * cleanly today. AC-11 conformance only asserts the symbol is exported and
 * defined; the real node behavior is `it.todo` pending Phase 7 + AC-12.
 */
export class DeepPerceiveNode {
  /**
   * Phase 7 supersession marker — flipped to `true` by T117 when the full
   * implementation lands. Phase 1c integration test (AC-12) reads this to
   * route around enrichment assertions while the stub is in place.
   */
  public static readonly isPhase7Stub: boolean = true;

  /**
   * Invoke the settle gate. Phase 7 T117 will replace / extend this with the
   * full DeepPerceive pipeline; for now it delegates to the bare function so
   * the settle wiring + warning propagation are exercised identically through
   * either entry point.
   */
  async run(
    page: PageLike,
    emitter: WarningEmitter,
    opts: DeepPerceiveOptions = {},
  ): Promise<DeepPerceiveResult> {
    return deepPerceiveWithSettle(page, emitter, opts);
  }
}
