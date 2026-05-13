/**
 * AC-08 (runtime math + constructor bounds) — ConfidenceScorer (Phase 3 T064).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-08 (v0.3 F06)
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T064
 *     (REQ-VERIFY-CONFIDENCE-001)
 *   docs/specs/mvp/phases/phase-3-verification/plan.md §"ConfidenceScorer (T064)"
 *
 * AC-08 contract — multiplicative decay enforcement (R4.4):
 *   - afterFailure(c) = c * failureFactor  (default 0.97; never additive)
 *   - afterSuccess(c) = min(1, c * successFactor)  (default 1.01)
 *   - belowFloor(c)  = c < floor (default 0.10)
 *   - Constructor THROWS RangeError if:
 *       * failureFactor NOT strictly in (0, 1)
 *       * successFactor < 1   (1.0 = no rebound; allowed)
 *
 * This file covers blocks (1) runtime math + (2) constructor bounds.
 * Source-grep enforcement (block 3) lives in confidence-scorer-no-additive.test.ts.
 *
 * RED state — Phase 3 Wave 0 (T-PHASE3-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-08 — multiplicative-only math + constructor bounds validation.
 */
import { describe, expect, it } from 'vitest';

import { ConfidenceScorer } from '../../src/verification/ConfidenceScorer.js';

describe('ConfidenceScorer — runtime math (AC-08 block 1, RED until T064)', () => {
  it('AC-08: afterFailure(1) === 0.97 (proves multiplication, NOT additive)', () => {
    const scorer = new ConfidenceScorer();
    expect(scorer.afterFailure(1).toFixed(2)).toBe('0.97');
  });

  it('AC-08: afterFailure compounds multiplicatively — afterFailure(0.97) === 0.9409', () => {
    const scorer = new ConfidenceScorer();
    expect(scorer.afterFailure(0.97).toFixed(4)).toBe('0.9409');
  });

  it('AC-08: afterSuccess(0.5) returns 0.5 * 1.01 = 0.505', () => {
    const scorer = new ConfidenceScorer();
    expect(scorer.afterSuccess(0.5)).toBe(0.505);
  });

  it('AC-08: afterSuccess clamps at 1 — afterSuccess(0.999) === 1', () => {
    const scorer = new ConfidenceScorer();
    expect(scorer.afterSuccess(0.999)).toBe(1);
  });

  it('AC-08: belowFloor(0.05) === true (below default 0.10 floor)', () => {
    const scorer = new ConfidenceScorer();
    expect(scorer.belowFloor(0.05)).toBe(true);
  });

  it('AC-08: belowFloor(0.15) === false (above default 0.10 floor)', () => {
    const scorer = new ConfidenceScorer();
    expect(scorer.belowFloor(0.15)).toBe(false);
  });

  it('AC-08: N failed verifies trend as initial × 0.97^N within tolerance', () => {
    const scorer = new ConfidenceScorer();
    let c = 1;
    for (let i = 0; i < 5; i++) c = scorer.afterFailure(c);
    expect(c).toBeCloseTo(Math.pow(0.97, 5), 10);
  });
});

describe('ConfidenceScorer — constructor bounds (AC-08 block 2, RED until T064)', () => {
  /**
   * @AC-08 (v0.3 F06) — failureFactor must be strictly in (0, 1).
   * 0 and 1 are excluded; negatives are excluded.
   */
  it('AC-08: constructor THROWS RangeError on failureFactor = 0', () => {
    expect(() => new ConfidenceScorer({ failureFactor: 0, successFactor: 1.01, floor: 0.1 })).toThrow(
      RangeError,
    );
  });

  it('AC-08: constructor THROWS RangeError on failureFactor = 1', () => {
    expect(() => new ConfidenceScorer({ failureFactor: 1, successFactor: 1.01, floor: 0.1 })).toThrow(
      RangeError,
    );
  });

  it('AC-08: constructor THROWS RangeError on negative failureFactor (-0.5)', () => {
    expect(() => new ConfidenceScorer({ failureFactor: -0.5, successFactor: 1.01, floor: 0.1 })).toThrow(
      RangeError,
    );
  });

  it('AC-08: constructor THROWS RangeError on successFactor < 1 (0.5)', () => {
    expect(() => new ConfidenceScorer({ failureFactor: 0.97, successFactor: 0.5, floor: 0.1 })).toThrow(
      RangeError,
    );
  });

  it('AC-08: constructor ACCEPTS default config { 0.97, 1.01, 0.10 }', () => {
    expect(() => new ConfidenceScorer()).not.toThrow();
  });

  /**
   * @AC-08 (v0.3 F06) — successFactor === 1 is ALLOWED (no rebound is a
   * valid configuration; only successFactor < 1 throws).
   */
  it('AC-08: constructor ACCEPTS edge-case { failureFactor:0.5, successFactor:1.0, floor:0.05 }', () => {
    expect(() => new ConfidenceScorer({ failureFactor: 0.5, successFactor: 1.0, floor: 0.05 })).not.toThrow();
  });
});
