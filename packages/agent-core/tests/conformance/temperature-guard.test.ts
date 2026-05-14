/**
 * AC-09 — TemperatureGuard conformance (Phase 4 T073).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-09 (v0.2 F-27)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T073
 *     (REQ-LLM-TEMPERATURE-GUARD-001 + R10 + R22.6)
 *
 * AC-09 contract:
 *   - REPRODUCIBILITY_BOUND_OPS = { 'evaluate', 'self_critique', 'evaluate_interactive' }
 *   - On bound ops: temp > 0 → THROWS TemperatureGuardError
 *   - On non-bound ops ('classify' | 'extract' | 'other'): ANY temp in [0,1] is allowed
 *   - Conformance test covers BOTH directions (parameterized).
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-09 — bound vs allowed operations × temperature carve-out.
 */
import { describe, expect, it } from 'vitest';

// SUT (does not exist yet — T073 lands this in Wave 2). Import fails → RED.
import { TemperatureGuard, TemperatureGuardError } from '../../src/adapters/TemperatureGuard.js';
import type { LLMCompleteRequest, LLMOperation } from '../../src/adapters/LLMAdapter.js';

const BOUND_OPS: LLMOperation[] = ['evaluate', 'self_critique', 'evaluate_interactive'];
const ALLOWED_OPS: LLMOperation[] = ['classify', 'extract', 'other'];

function req(op: LLMOperation, temperature: number): LLMCompleteRequest {
  return {
    operation: op,
    audit_run_id: '00000000-0000-4000-8000-000000000600',
    userPrompt: 'x',
    temperature,
    maxTokens: 16,
  };
}

describe('TemperatureGuard — AC-09 conformance (RED until T073)', () => {
  // (a) 3 reject cases for the bound ops at temp=0.5
  for (const op of BOUND_OPS) {
    it(`AC-09 REJECT: op="${op}" at temperature=0.5 throws TemperatureGuardError`, () => {
      expect(() => TemperatureGuard.check(req(op, 0.5))).toThrow(TemperatureGuardError);
    });
  }

  // (b) 3 allow cases for non-bound ops at temp=0.5
  for (const op of ALLOWED_OPS) {
    it(`AC-09 ALLOW: op="${op}" at temperature=0.5 does NOT throw`, () => {
      expect(() => TemperatureGuard.check(req(op, 0.5))).not.toThrow();
    });
  }

  it('AC-09: temperature=0 is always allowed on bound ops', () => {
    for (const op of BOUND_OPS) {
      expect(() => TemperatureGuard.check(req(op, 0))).not.toThrow();
    }
  });

  it('AC-09: REPRODUCIBILITY_BOUND_OPS contains exactly the 3 R10/R22.6 ops', () => {
    expect(TemperatureGuard.REPRODUCIBILITY_BOUND_OPS.has('evaluate')).toBe(true);
    expect(TemperatureGuard.REPRODUCIBILITY_BOUND_OPS.has('self_critique')).toBe(true);
    expect(TemperatureGuard.REPRODUCIBILITY_BOUND_OPS.has('evaluate_interactive')).toBe(true);
    expect(TemperatureGuard.REPRODUCIBILITY_BOUND_OPS.has('classify')).toBe(false);
    expect(TemperatureGuard.REPRODUCIBILITY_BOUND_OPS.has('extract')).toBe(false);
    expect(TemperatureGuard.REPRODUCIBILITY_BOUND_OPS.has('other')).toBe(false);
  });
});
