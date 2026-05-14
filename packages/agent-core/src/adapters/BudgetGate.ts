/**
 * BudgetGate — Phase 4 T073 pre-call budget enforcement.
 *
 * Source: spec.md AC-10 + tasks.md T073 + 11-safety-cost.md REQ-COST-011/012 +
 * constitution.md R14.2.
 *
 * Formula (AC-10):
 *   estimated_cost = ceil(getTokenCount(prompt) * model_per_token_rate * 100) / 100
 *
 * Round UP to the nearest cent. A $0.001 raw estimate vs $0.005 budget
 * rounds to $0.01 and BLOCKS — false-reject defends against false-accept
 * via float rounding. Exact-match (estimated == remaining) → ALLOWED.
 *
 * `getTokenCount` uses tiktoken cl100k_base (over-estimates Claude ~5-15%;
 * acceptable conservative bias for a pre-call gate).
 *
 * MODEL_PRICING mirrors 11-safety-cost.md REQ-COST-011 (per-million → per-token).
 * Unknown models fall through to DEFAULT_RATE.
 */
import { get_encoding } from 'tiktoken';
import {
  BudgetExceededError,
  type LLMCompleteRequest,
} from './LLMAdapter.js';

export { BudgetExceededError };

const MODEL_PRICING: Record<string, { inputPerToken: number; outputPerToken: number }> = {
  'claude-sonnet-4-20250514': { inputPerToken: 0.000_003, outputPerToken: 0.000_015 },
  'claude-sonnet-4-20260301': { inputPerToken: 0.000_003, outputPerToken: 0.000_015 },
  'claude-sonnet-4-mock':     { inputPerToken: 0.000_003, outputPerToken: 0.000_015 },
};

const DEFAULT_RATE = { inputPerToken: 0.000_003, outputPerToken: 0.000_015 };

const ratesFor = (model: string | undefined): { inputPerToken: number; outputPerToken: number } =>
  (model !== undefined && MODEL_PRICING[model] !== undefined) ? MODEL_PRICING[model] : DEFAULT_RATE;

/** Token count via tiktoken cl100k_base. Encoder freed per call (wasm
 * leaks bytes otherwise — same pattern as Phase 1 ContextAssembler). */
export const getTokenCount = (prompt: string): number => {
  const enc = get_encoding('cl100k_base');
  try {
    return enc.encode(prompt).length;
  } finally {
    enc.free();
  }
};

export class BudgetGate {
  /** USD cost estimate, rounded UP to the nearest $0.01. Uses input-token
   * rate over user + system prompts (worst case for a pre-call gate). */
  public static estimate(req: LLMCompleteRequest): number {
    const fullPrompt = (req.systemPrompt ?? '') + req.userPrompt;
    const tokens = getTokenCount(fullPrompt);
    const { inputPerToken } = ratesFor(req.model);
    const rawUsd = tokens * inputPerToken;
    return Math.ceil(rawUsd * 100) / 100;
  }

  /** Throws BudgetExceededError if estimate(req) > budgetRemainingUsd.
   * Exact-match (==) is ALLOWED. Adapter writes outcome='budget_blocked'
   * (cost_usd=0) and re-throws (R14.1). */
  public static check(req: LLMCompleteRequest, budgetRemainingUsd: number): void {
    const estimated = BudgetGate.estimate(req);
    if (estimated > budgetRemainingUsd) {
      throw new BudgetExceededError(
        `BudgetGate: estimated $${estimated.toFixed(2)} exceeds remaining $${budgetRemainingUsd.toFixed(2)} (R14.2)`,
        estimated,
        budgetRemainingUsd,
      );
    }
  }
}
