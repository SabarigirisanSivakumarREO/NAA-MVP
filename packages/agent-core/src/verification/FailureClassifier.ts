/**
 * FailureClassifier — typed failure-class routing (Phase 3 T063).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-07 + R-07
 *     (REQ-VERIFY-FAILURE-001) + Scenario 7 (about:blank routing).
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T063 brief.
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §FailureClassifier
 *     (NEW) — canonical FailureClass union + FailureClassification shape;
 *     `bot_detected_likely` pre-positioned for v1.1.
 *   docs/specs/mvp/phases/phase-3-verification/plan.md Phase 1 — Design
 *     §FailureClassifier (T063) — canonical pseudo-code.
 *
 * AC-07 contract:
 *   - classify(input) is PURE — no async, no I/O, no external state.
 *   - Maps ClassifyInput → FailureClassification { class, subclass,
 *     shouldRetry, context? }.
 *   - Five FailureClass values are LOCKED (impact.md §Forward stability):
 *     verify_failed | safety_blocked | rate_limited | unverifiable |
 *     bot_detected_likely (last pre-positioned for v1.1 no_bot_block).
 *   - Pino correlation: child logger bound with `failure_class` field
 *     per T-PHASE3-LOGGER (commit 4e005fd) + matches T062 VerifyEngine
 *     stubLogger pattern.
 *
 * R10: file ≤ 200 LOC; named exports only; no `any`; no console.log;
 *   single-responsibility pure-function table.
 * R20: FailureClassifier is a shared contract; consumed by Phase 4
 *   SafetyCheck (kind:'safety' veto) and Phase 5 BrowseNode (verify-result
 *   routing). FailureClass + FailureClassification + ClassifyInput types
 *   live in types.ts (the shared-contracts module) so the conformance test
 *   imports them from the canonical location.
 *
 * Design notes:
 *   - The classifier inspects only `failures[0]` for subclass routing
 *     (plan.md Phase 1 Design §FailureClassifier); deeper inspection is
 *     deferred to v1.1 if Phase 5 retry telemetry indicates need.
 *   - Defensive ok:true branch returns `unverifiable / classifier_called_on_success`
 *     — Phase 5 orchestrator typically doesn't call classifier on success,
 *     but the branch keeps the function total over its declared input type.
 *   - `bot_detected_likely` has no MVP runtime production path (v1.1 will
 *     populate it from the no_bot_block strategy); the enum slot keeps the
 *     R18 append-only promise intact.
 */
import type { Logger } from 'pino';

import type {
  AggregatedVerifyResult,
  ClassifyInput,
  FailureClassification,
  VerifyResult,
} from './types.js';

/**
 * Narrow ClassifyInput to AggregatedVerifyResult.
 *
 * The {kind:'safety'|'rate'} variants are tagged-union shapes that don't
 * appear on AggregatedVerifyResult. After eliminating those, the remainder
 * IS an AggregatedVerifyResult — no `as` cast needed.
 */
function isAggregated(input: ClassifyInput): input is AggregatedVerifyResult {
  return !('kind' in input);
}

/**
 * Subclass for url_change failures. Mirrors spec.md Scenario 7
 * (about:blank → navigation_did_not_complete) + spec.md Edge Cases
 * (unexpected redirect → unexpected_url).
 */
function urlChangeSubclass(failure: VerifyResult): string {
  const evidence = failure.evidence as { actualUrl?: string } | undefined;
  if (evidence?.actualUrl === 'about:blank') {
    return 'navigation_did_not_complete';
  }
  return 'unexpected_url';
}

/**
 * Subclass for element_appears failures. Reflects ElementAppearsStrategy's
 * two-timer + 3-criterion semantics (spec.md AC-04 + Edge Cases):
 *   - unstable=true            → dom_unstable (MutationMonitor settle failed)
 *   - timedOut=true            → visibility_timed_out
 *   - failedCriterion='a'|'b'|'c' → visibility_criterion_<letter>
 *   - else                      → element_not_found
 */
function elementAppearsSubclass(failure: VerifyResult): string {
  if (failure.unstable === true) return 'dom_unstable';
  if (failure.timedOut === true) return 'visibility_timed_out';
  if (failure.failedCriterion !== undefined) {
    return `visibility_criterion_${failure.failedCriterion}`;
  }
  return 'element_not_found';
}

/**
 * Resolve a verify_failed subclass from the first failure entry. Order
 * matters: strategy-specific routing first, then a generic fallback. The
 * orchestrator (Phase 5) uses this subclass to pick the recovery
 * sub-strategy (retry vs replan vs HITL).
 */
function verifyFailedSubclass(failures: readonly VerifyResult[]): string {
  const first = failures[0];
  if (first === undefined) return 'unknown';
  if (first.strategy === 'url_change') return urlChangeSubclass(first);
  if (first.strategy === 'element_appears') return elementAppearsSubclass(first);
  if (first.strategy === 'element_text') return 'text_mismatch';
  return 'unknown';
}

/**
 * Pure FailureClassifier — discriminated-union pattern match over
 * ClassifyInput → FailureClassification. The (optional) Pino logger
 * receives a `failure_class`-bound child line per classify() call,
 * matching the T-PHASE3-LOGGER correlation contract.
 */
export class FailureClassifier {
  constructor(private readonly logger?: Logger) {}

  classify(input: ClassifyInput): FailureClassification {
    const classification = this.route(input);
    this.logger
      ?.child({ failure_class: classification.class })
      .debug(
        { subclass: classification.subclass, shouldRetry: classification.shouldRetry },
        'failure.classified',
      );
    return classification;
  }

  /**
   * Pure routing table — no logging side effect. Split out so classify()
   * stays under R10 50-LOC function ceiling and the routing logic is
   * straightforwardly testable in isolation if needed later.
   */
  private route(input: ClassifyInput): FailureClassification {
    // 1. Pre-action safety veto (Phase 4 SafetyCheck).
    if (!isAggregated(input) && input.kind === 'safety') {
      return {
        class: 'safety_blocked',
        subclass: 'pre_action_block',
        shouldRetry: false,
      };
    }

    // 2. Domain rate cap (Phase 4 RateLimiter).
    if (!isAggregated(input) && input.kind === 'rate') {
      return {
        class: 'rate_limited',
        subclass: 'domain_cap_hit',
        shouldRetry: true,
      };
    }

    // From here, narrowing guarantees AggregatedVerifyResult.
    const result = input as AggregatedVerifyResult;

    // 3. Defensive: classifier called on success. Phase 5 typically only
    // routes failures here, but keep the function total over its input.
    if (result.ok) {
      return {
        class: 'unverifiable',
        subclass: 'classifier_called_on_success',
        shouldRetry: false,
      };
    }

    // 4. No applicable strategy (engine returned empty attemptedStrategies).
    if (result.attemptedStrategies.length === 0) {
      return {
        class: 'unverifiable',
        subclass: 'no_applicable_strategy',
        shouldRetry: false,
      };
    }

    // 5. At least one strategy attempted and failed → verify_failed with
    // strategy-specific subclass derived from failures[0].
    return {
      class: 'verify_failed',
      subclass: verifyFailedSubclass(result.failures),
      shouldRetry: true,
    };
  }
}
