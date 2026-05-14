/**
 * TemperatureGuard — Phase 4 T073 reproducibility-bound temperature check.
 *
 * Source: spec.md AC-09 + tasks.md T073 + constitution.md R10/R22.6.
 *
 * REPRODUCIBILITY_BOUND_OPS = { evaluate, self_critique, evaluate_interactive }
 * drive Phase 7 analysis output that MUST be deterministic across audit
 * reruns. Non-zero temperature on these ops breaks reproducibility (R10).
 * Non-bound ops (classify / extract / other) accept any temperature in
 * [0, 1] — they drive perception extraction + tool-routing.
 *
 * `TemperatureGuard.check(req)` is Step 1 in AnthropicAdapter.complete() —
 * BEFORE BudgetGate, BEFORE any @anthropic-ai/sdk invocation. A violation
 * throws TemperatureGuardError; adapter catches, writes llm_call_log row
 * outcome='temperature_blocked' (R14.1), and re-throws.
 */
import {
  TemperatureGuardError,
  type LLMCompleteRequest,
  type LLMOperation,
} from './LLMAdapter.js';

export { TemperatureGuardError };

const BOUND_OPS = new Set<LLMOperation>([
  'evaluate',
  'self_critique',
  'evaluate_interactive',
]);

export class TemperatureGuard {
  /** Bound-op set — exposed for AC-09 conformance test membership assertions. */
  public static readonly REPRODUCIBILITY_BOUND_OPS: ReadonlySet<LLMOperation> = BOUND_OPS;

  /** Throws TemperatureGuardError if req.operation is bound AND temp > 0.
   * Pure (no I/O, no logs — adapter logs the outcome via llm_call_log). */
  public static check(req: LLMCompleteRequest): void {
    if (!BOUND_OPS.has(req.operation)) return;
    if (req.temperature > 0) {
      throw new TemperatureGuardError(
        `TemperatureGuard: operation='${req.operation}' is reproducibility-bound (R10); ` +
          `received temperature=${req.temperature}, expected 0. ` +
          `Allowed non-zero ops: classify | extract | other.`,
        req.operation,
        req.temperature,
      );
    }
  }
}
