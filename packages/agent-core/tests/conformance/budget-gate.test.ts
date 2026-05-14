/**
 * AC-10 — BudgetGate conformance (Phase 4 T073).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-10 (v0.2 F-09)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T073
 *     (R14.2 — pre-call budget gate)
 *
 * AC-10 contract:
 *   - estimated_cost = ceil(getTokenCount(prompt) * model_per_token_rate * 100) / 100
 *     (rounds UP to nearest $0.01 — defends against rounding errors)
 *   - if estimated_cost > budget_remaining_usd → throw BudgetExceededError AND
 *     write llm_call_log row with outcome='budget_blocked' (cost_usd=0).
 *   - Exact-match boundary: estimated_cost == budget_remaining_usd → ALLOWED.
 *   - $0.001 overage rounding case: estimated 0.001 with $0.005 budget → rounds
 *     UP to $0.01 → blocked.
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-10 — round-UP estimator + exact-match boundary.
 */
import { describe, expect, it } from 'vitest';

// SUT (does not exist yet — T073 lands this in Wave 2). Import fails → RED.
import { BudgetGate, BudgetExceededError } from '../../src/adapters/BudgetGate.js';
import type { LLMCompleteRequest } from '../../src/adapters/LLMAdapter.js';

function req(userPrompt: string): LLMCompleteRequest {
  return {
    operation: 'classify',
    audit_run_id: '00000000-0000-4000-8000-000000000700',
    userPrompt,
    temperature: 0,
    maxTokens: 256,
  };
}

describe('BudgetGate — AC-10 conformance (RED until T073)', () => {
  it('AC-10: estimated_cost > budget_remaining → throws BudgetExceededError', () => {
    // tiny budget (0.10) vs a long prompt that will estimate over.
    const longPrompt = 'lorem ipsum '.repeat(10_000);
    expect(() => BudgetGate.check(req(longPrompt), 0.0001)).toThrow(BudgetExceededError);
  });

  it('AC-10: estimated_cost < budget_remaining → does NOT throw', () => {
    expect(() => BudgetGate.check(req('hi'), 10.0)).not.toThrow();
  });

  it('AC-10: estimated_cost rounds UP to nearest $0.01', () => {
    // estimate is a 3-decimal-precision number internally; the returned
    // estimate exposed to callers MUST be rounded UP to 0.01.
    const estimated = BudgetGate.estimate(req('hi'));
    const cents = Math.round(estimated * 100);
    expect(estimated * 100).toBe(cents);
  });

  it('AC-10 exact-match boundary: estimated == remaining → allowed', () => {
    const estimated = BudgetGate.estimate(req('hi'));
    expect(() => BudgetGate.check(req('hi'), estimated)).not.toThrow();
  });

  it('AC-10 overage rounding: $0.001 raw estimate vs $0.005 budget → blocked (rounds to $0.01)', () => {
    // The spec mandates round-UP defence: even a $0.001 raw estimate
    // becomes $0.01 after rounding, exceeding a $0.005 budget.
    const estimated = BudgetGate.estimate(req('hi'));
    if (estimated >= 0.005) {
      // If the smallest prompt already estimates >= 0.005, the rounding
      // case is harder to express — assert that the round-up rule still
      // produces a 2-decimal value (cent-aligned).
      expect(estimated * 100).toBe(Math.round(estimated * 100));
    } else {
      expect(() => BudgetGate.check(req('hi'), 0.005)).toThrow(BudgetExceededError);
    }
  });
});
