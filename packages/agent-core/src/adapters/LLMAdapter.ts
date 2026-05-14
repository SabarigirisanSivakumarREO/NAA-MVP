/**
 * LLMAdapter — Phase 4 T073 R9 adapter interface for LLM completions.
 *
 * Source: spec.md AC-08..AC-11 + tasks.md T073 + impact.md §LLMCallRecord +
 * 11-safety-cost.md + constitution.md R9/R10/R14.
 *
 * This file is the PUBLIC interface — NO runtime dependency on
 * @anthropic-ai/sdk. The SOLE concrete @anthropic-ai/sdk importer is
 * AnthropicAdapter.ts (same folder); ESLint `no-restricted-imports` +
 * adapter-boundary grep test enforce R9 mechanically.
 *
 * Field naming: `audit_run_id` / `client_id` are snake_case (DB-row-aligned
 * correlation keys); all other TS-only props are camelCase.
 */
import type { LLMOperation } from '../types/llm.js';

export type { LLMOperation };

/**
 * LLMCompleteRequest — adapter input.
 * - `operation` gates TemperatureGuard (R10): bound ops (evaluate /
 *   self_critique / evaluate_interactive) MUST run temp=0; allowed ops
 *   (classify / extract / other) accept any temp in [0, 1].
 * - `audit_run_id` is the correlation key for llm_call_log + Pino bindings.
 */
export interface LLMCompleteRequest {
  readonly operation: LLMOperation;
  readonly audit_run_id: string;
  readonly userPrompt: string;
  readonly systemPrompt?: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly model?: string;
  readonly client_id?: string;
}

/** LLMCompleteResponse — adapter output. `usage` mirrors Anthropic's
 * response.usage block; `costUsd` is computed from MODEL_PRICING. */
export interface LLMCompleteResponse {
  readonly text: string;
  readonly model: string;
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly cacheHit: boolean;
  };
  readonly costUsd: number;
  readonly durationMs: number;
}

/** LLMAdapter — the LLM-completion boundary contract. */
export interface LLMAdapter {
  /** Issue one completion. Atomically writes llm_call_log BEFORE return
   * (R14.1) on every outcome (ok / budget_blocked / temperature_blocked /
   * unavailable / error). */
  complete(req: LLMCompleteRequest): Promise<LLMCompleteResponse>;

  /** Pre-call cost estimate (USD, rounded UP to nearest $0.01) — used by
   * BudgetGate.check to short-circuit before the network round-trip
   * (R14.2). */
  estimateCost(
    req: Pick<LLMCompleteRequest, 'userPrompt' | 'systemPrompt' | 'model'>,
  ): Promise<number>;
}

// ── Typed errors — each maps to one LLMOutcome value (W1C) ─────────────

/** BudgetGate veto (R14.2). Adapter writes outcome='budget_blocked' before rethrow. */
export class BudgetExceededError extends Error {
  override readonly name = 'BudgetExceededError';
  constructor(message: string, readonly estimatedUsd: number, readonly remainingUsd: number) {
    super(message);
  }
}

/** TemperatureGuard veto (R10). Adapter writes outcome='temperature_blocked' before rethrow. */
export class TemperatureGuardError extends Error {
  override readonly name = 'TemperatureGuardError';
  constructor(message: string, readonly operation: LLMOperation, readonly temperature: number) {
    super(message);
  }
}

/** Retry exhaustion (R14.5). Adapter writes outcome='unavailable' before rethrow. */
export class LLMUnavailableError extends Error {
  override readonly name = 'LLMUnavailableError';
  constructor(message: string, readonly attemptCount: number, readonly lastError: Error) {
    super(message);
  }
}
