/**
 * Phase 4b T4B-007 — ConfidenceScorer: weighted aggregate of 5-dimension
 * confidence values into a single `overall_confidence ∈ [0, 1]` plus a
 * 3-band threshold action (`act` / `use_and_flag` / `ask`).
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.2
 *     (REQ-CONTEXT-OUT-001 — weighted overall_confidence + 3-band threshold)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-07 + R-08 + R-09
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §2.2
 *     (weights table — IMPLEMENTED VERBATIM)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-007 (L131-137)
 *   packages/agent-core/src/types/context-profile.ts —
 *     ContextField<T>, ConfidenceThresholdActionEnum (3-value LOCKED).
 *
 * # Algorithm (plan.md §2.2 verbatim)
 *
 * `overall_confidence = Σ(weight × dimension_field.confidence)`
 *
 * | Dimension field                  | Weight |
 * |----------------------------------|--------|
 * | business.archetype               |  0.35  |
 * | page.type                        |  0.25  |
 * | traffic.device_priority          |  0.15  |
 * | business.aov_tier                |  0.10  |
 * | audience.buyer                   |  0.10  |
 * | brand.tone (representative)      |  0.05  |
 *
 * Sum of weights = 1.00 → overall_confidence ∈ [0, 1] when each input
 * confidence ∈ [0, 1] (Zod-enforced upstream by contextField()).
 *
 * # Threshold gates (REQ-CONTEXT-OUT-001 + plan.md §2.2)
 *
 *   - overall ≥ 0.9       → 'act'           (proceed without questions)
 *   - 0.6 ≤ overall < 0.9 → 'use_and_flag'  (proceed with non-blocking warnings)
 *   - overall < 0.6       → 'ask'           (blocking question via CLI)
 *
 * # Required-field override (R-09)
 *
 * If `business.archetype.confidence < 0.6` OR `page.type.confidence < 0.6`,
 * the threshold_action is FORCED to `'ask'` regardless of overall_confidence.
 * Required fields in MVP: `business.archetype`, `page.type`. (`goal.primary_kpi`
 * is required at the AuditRequest layer T4B-009 — not this scorer's concern.)
 *
 * # Brand representative subfield
 *
 * Plan.md §2.2 specifies the brand dimension carries a 0.05 weight ("Style /
 * voice — minor in MVP") without naming a specific subfield. Per the task
 * brief instruction "pick one brand subfield as proxy per spec", this scorer
 * uses `brand.tone.confidence` as the representative subfield. Rationale:
 * `tone` is the most semantically central style attribute and is the first
 * field declared in BrandDimensionSchema (context-profile.ts L271).
 *
 * # Constitution compliance
 *
 * R3.1 TDD: conformance test (AC-07) written first; this impl follows.
 * R10.1 file ≤ 300 LOC. R10.3 named exports only.
 * R2 no `any` — typed everywhere. No Zod parse here (input shape is the
 *   already-Zod-parsed dimension types from upstream inferrers).
 * R6 no heuristic-content reference (pure aggregation plumbing).
 * R9 zero vendor SDK imports — only `../types/context-profile.js`.
 * R14 NOT applicable — pure functional scorer with no IO/logging; no Pino.
 * R25 NO Playwright; NO LLMAdapter; NO judgment fields (`overall_confidence`
 *   is a confidence aggregation, NOT a judgment per spec.md L239 + R25.1
 *   item 2 — judgment fields are severity/impact/score/priority).
 * R11.4/R20 — context-profile.ts shape NOT modified (LOCKED).
 */
import type {
  AudienceDimension,
  BrandDimension,
  BusinessDimension,
  ConfidenceThresholdAction,
  PageDimension,
  TrafficDimension,
} from '../types/context-profile.js';

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface ConfidenceScorerInput {
  readonly business: BusinessDimension;
  readonly page: PageDimension;
  readonly audience: AudienceDimension;
  readonly traffic: TrafficDimension;
  readonly brand: BrandDimension;
}

export interface ConfidenceScorerResult {
  /** Weighted aggregate ∈ [0, 1]. */
  readonly overall_confidence: number;
  /** 3-band gate per REQ-CONTEXT-OUT-001 (with R-09 required-field override). */
  readonly threshold_action: ConfidenceThresholdAction;
}

// ---------------------------------------------------------------------------
// Weights (plan.md §2.2 — sum = 1.00)
// ---------------------------------------------------------------------------

const W_BUSINESS_ARCHETYPE = 0.35;
const W_PAGE_TYPE = 0.25;
const W_TRAFFIC_DEVICE = 0.15;
const W_BUSINESS_AOV = 0.1;
const W_AUDIENCE_BUYER = 0.1;
const W_BRAND_TONE = 0.05;

/** Threshold gate boundaries (REQ-CONTEXT-OUT-001). */
const ACT_THRESHOLD = 0.9;
const FLAG_THRESHOLD = 0.6;

/** Required-field minimum confidence per R-09. */
const REQUIRED_FIELD_MIN = 0.6;

// ---------------------------------------------------------------------------
// Pure scorer
// ---------------------------------------------------------------------------

/**
 * Compute overall_confidence + threshold_action from a 5-dimension input.
 *
 * Stateless; safe for concurrent use. Does not mutate inputs. Does not
 * perform IO or logging.
 *
 * @param input — 5 dimensions, each already Zod-validated upstream.
 * @returns `{overall_confidence, threshold_action}` per AC-07.
 */
export function scoreConfidence(input: ConfidenceScorerInput): ConfidenceScorerResult {
  const businessArchetypeConf = input.business.archetype.confidence;
  const pageTypeConf = input.page.type.confidence;
  const trafficDeviceConf = input.traffic.device_priority.confidence;
  const businessAovConf = input.business.aov_tier.confidence;
  const audienceBuyerConf = input.audience.buyer.confidence;
  const brandToneConf = input.brand.tone.confidence;

  const overall =
    businessArchetypeConf * W_BUSINESS_ARCHETYPE +
    pageTypeConf * W_PAGE_TYPE +
    trafficDeviceConf * W_TRAFFIC_DEVICE +
    businessAovConf * W_BUSINESS_AOV +
    audienceBuyerConf * W_AUDIENCE_BUYER +
    brandToneConf * W_BRAND_TONE;

  // Defensive clamp — confidences are already ∈ [0, 1] via Zod, weights
  // sum to 1.00, so overall ∈ [0, 1] mathematically. The Math.min/max guard
  // against floating-point drift (e.g., 1.0000000000000002).
  const clamped = Math.min(1, Math.max(0, overall));

  // R-09 required-field override: business.archetype + page.type.
  const requiredFieldFailed =
    businessArchetypeConf < REQUIRED_FIELD_MIN || pageTypeConf < REQUIRED_FIELD_MIN;

  const threshold_action: ConfidenceThresholdAction = requiredFieldFailed
    ? 'ask'
    : pickThresholdBand(clamped);

  return {
    overall_confidence: clamped,
    threshold_action,
  };
}

/**
 * Map raw `overall_confidence` to the 3-band action enum.
 * `≥ 0.9` → act, `[0.6, 0.9)` → use_and_flag, `< 0.6` → ask.
 */
function pickThresholdBand(overall: number): ConfidenceThresholdAction {
  if (overall >= ACT_THRESHOLD) return 'act';
  if (overall >= FLAG_THRESHOLD) return 'use_and_flag';
  return 'ask';
}
