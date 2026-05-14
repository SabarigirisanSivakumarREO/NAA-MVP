/**
 * LLM call contracts — canonical Phase 4 shared types.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md §LLMCallRecord
 *     (NEW shared row schema — R14.1) — verbatim Zod shape.
 *   docs/specs/final-architecture/13-data-layer.md §13.7 `llm_call_log` —
 *     DB row shape (Drizzle table mirrors this Zod schema).
 *   docs/specs/final-architecture/11-safety-cost.md — TemperatureGuard +
 *     BudgetGate outcome semantics.
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T-PHASE4-TYPES
 *     brief.
 *
 * Exports (T-PHASE4-TYPES):
 *   - LLMOperationEnum + LLMOperation type (6 values; LOCKED per impact.md
 *     Forward stability promise — Phase 7 hard-references these)
 *   - LLMOutcomeEnum + LLMOutcome type (5 values; impact.md may add via
 *     additive migration but never remove)
 *   - LLMCallRecordSchema + LLMCallRecord type (one row per LLM call;
 *     atomic-write contract per R14.1 — written before adapter return)
 *
 * R10.4 Zod-first: schemas declared BEFORE TS types via z.infer.
 * R10.2 named exports only; no default exports.
 * R2: no `any`; Zod governs every external boundary.
 * R9: this file has NO vendor dependencies — only zod. AnthropicAdapter is
 *   the SOLE importer of `@anthropic-ai/sdk`; PostgresStorage is the SOLE
 *   importer of `pg` / `drizzle-orm`.
 *
 * DB shape divergence (informational; reconciled in T070):
 *   impact.md §LLMCallRecord and §13.7 llm_call_log diverge on field names —
 *   impact.md is canonical for the TypeScript contract; T070 Drizzle schema
 *   reconciles to the impact.md shape (the in-memory contract drives the
 *   migration, not vice versa, per R20 forward-contract direction).
 */
import { z } from 'zod';

/**
 * LLMOperation — operation class binding (R10 reproducibility).
 *
 * The three REPRODUCIBILITY_BOUND_OPS ('evaluate', 'self_critique',
 * 'evaluate_interactive') are TemperatureGuard-gated: temperature > 0
 * throws TemperatureGuardError. 'classify' / 'extract' / 'other' may run
 * non-zero temperature (Phase 4 ActionClassifier + Phase 6 perception
 * extraction).
 *
 * LOCKED enum — additions require Phase 4 impact.md amendment (R20).
 */
export const LLMOperationEnum = z.enum([
  'evaluate',
  'self_critique',
  'evaluate_interactive',
  'classify',
  'extract',
  'other',
]);

export type LLMOperation = z.infer<typeof LLMOperationEnum>;

/**
 * LLMOutcome — terminal disposition of an LLM call (R14.1 atomic logging).
 *
 *   ok                    — call succeeded; cost debited; text returned
 *   budget_blocked        — BudgetGate veto BEFORE call; no API request made
 *   temperature_blocked   — TemperatureGuard veto BEFORE call (R10)
 *   unavailable           — retry exhaustion (3 attempts) → LLMUnavailableError
 *   error                 — non-retryable provider error (4xx other than 429)
 *
 * The log row is written atomically in all five cases — "no silent calls"
 * (R14.1). LOCKED enum may add values via additive migration; never remove.
 */
export const LLMOutcomeEnum = z.enum([
  'ok',
  'budget_blocked',
  'temperature_blocked',
  'unavailable',
  'error',
]);

export type LLMOutcome = z.infer<typeof LLMOutcomeEnum>;

/**
 * LLMCallRecord — row shape for the `llm_call_log` Drizzle table.
 *
 * Written atomically by AnthropicAdapter.complete() BEFORE return (R14.1).
 * Append-only (R7.4) — UPDATE/DELETE blocked at DB level via Postgres
 * trigger `enforce_append_only` (lands with T070).
 *
 * `client_id` carries the RLS scope (R7.2): inserts run under
 * `SET LOCAL app.client_id` derived from the audit_run.
 *
 * `error_class` is nullable: present only when `outcome` ∈ {'unavailable',
 * 'error'}; null for {'ok', 'budget_blocked', 'temperature_blocked'} (those
 * three have distinct error subclasses surfaced as typed errors, not
 * stringly-typed messages).
 *
 * `created_at` is `z.coerce.date()` so callers can pass either Date or an
 * ISO-8601 string (DB returns string; in-process construction passes Date).
 */
export const LLMCallRecordSchema = z
  .object({
    id: z.string().uuid(),
    audit_run_id: z.string().uuid(),
    client_id: z.string().uuid(),
    operation: LLMOperationEnum,
    model: z.string().min(1),
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    cost_usd: z.number().nonnegative(),
    duration_ms: z.number().int().nonnegative(),
    cache_hit: z.boolean(),
    outcome: LLMOutcomeEnum,
    error_class: z.string().nullable(),
    created_at: z.coerce.date(),
  })
  .strict();

export type LLMCallRecord = z.infer<typeof LLMCallRecordSchema>;
