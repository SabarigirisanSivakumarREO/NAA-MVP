/**
 * ConfidenceScorer (T064) — R4.4 multiplicative confidence decay enforcement.
 *
 * Constitution R4.4: confidence MUST decay multiplicatively (current * factor),
 * NEVER additively. Multiplicative naturally bounds in (0, 1); additive
 * accumulates unboundedly. This file uses ONLY the `*` operator on
 * confidence in live code. Comments may discuss additive math for context;
 * source-grep enforcement (confidence-scorer-no-additive.test.ts) strips
 * comments before pattern matching.
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-08
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T064 (REQ-VERIFY-CONFIDENCE-001)
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §ConfidenceScorer
 *   docs/specs/mvp/phases/phase-3-verification/plan.md v0.3 Phase 1 Design item 4
 *
 * F06 closure (v0.3): Constructor validates factor bounds at construction.
 * Closes subtle additive-mimicking config BEFORE any afterFailure() call.
 */

export interface ConfidenceScorerConfig {
  /** Decay factor on failure. MUST be strictly greater than 0 AND strictly less than 1. */
  failureFactor: number;
  /** Rebound factor on success. MUST be greater than or equal to 1 (1 = no rebound). */
  successFactor: number;
  /** Threshold below which confidence is considered exhausted. */
  floor: number;
}

const DEFAULT_CONFIG: ConfidenceScorerConfig = {
  failureFactor: 0.97,
  successFactor: 1.01,
  floor: 0.1,
};

export class ConfidenceScorer {
  constructor(private readonly cfg: ConfidenceScorerConfig = DEFAULT_CONFIG) {
    // F06 closure — bounds validation at construction (R4.4 structural guard)
    if (!(cfg.failureFactor > 0 && cfg.failureFactor < 1)) {
      throw new RangeError(
        `ConfidenceScorer: failureFactor must be strictly within open interval (0, 1); got ${cfg.failureFactor}`,
      );
    }
    if (!(cfg.successFactor >= 1)) {
      throw new RangeError(
        `ConfidenceScorer: successFactor must be greater than or equal to 1; got ${cfg.successFactor}`,
      );
    }
  }

  /** Multiplicative decay on failure (R4.4). */
  afterFailure(c: number): number {
    return c * this.cfg.failureFactor;
  }

  /** Multiplicative rebound on success, clamped at 1 (R4.4). */
  afterSuccess(c: number): number {
    return Math.min(1, c * this.cfg.successFactor);
  }

  /** True when confidence has fallen below the configured floor. */
  belowFloor(c: number): boolean {
    return c < this.cfg.floor;
  }
}
