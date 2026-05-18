/**
 * EvidenceGrounder — week-1 stub: passthrough; rejected[] empty.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-006
 *         (acceptance: returns input passthrough — all critiqued findings
 *         → grounded; rejected[] empty).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Maps every
 * input CritiqueFinding to a GroundedFinding (alias for now); returns
 * empty `rejected` array. No rule evaluation, no element-exists check,
 * no benchmark validation, no banned-phrase filter — week 1 is
 * happy-path-only.
 *
 * Phase 7 T122-T130 forward path (★ second critical risk gate — week 7 ★):
 *   The real EvidenceGrounder ships 9 grounding rules per Phase 7 spec:
 *     - GR-001 element-exists       (T122) — verifies cited element refs
 *                                            resolve in PageStateModel
 *     - GR-002 element-rendered     (T123) — bounding box / non-zero area
 *     - GR-003 element-interactive  (T124) — interactiveGraph membership
 *     - GR-004 element-visible      (T125) — viewport visibility check
 *     - GR-005 element-content      (T126) — text content match
 *     - GR-006 element-position     (T127) — coordinate plausibility
 *     - GR-007 banned-phrase        (T128) — REUSES + EXTENDS T-SKELETON-004
 *                                            R5.3 regex pack; canonical pack
 *     - GR-008 element-uniqueness   (T129) — selector ambiguity check
 *     - GR-012 benchmark-validation (T130) — quantitative benchmark
 *                                            comparison + qualitative match
 *   All 9 rules + EvidenceGrounder integration land week 7 as ONE bundle
 *   (per implementation-roadmap.md §7 week 7). First REAL grounded finding
 *   ★ second critical risk gate ★ — failure modes: 0% rejection (rules
 *   too lenient), 95% rejection (rules too strict), GR-007 false positives.
 *
 * R20 impact.md required at week-7 transition (Finding lifecycle gates:
 * raw → critiqued → grounded/rejected; rejected_findings DB rows with
 * rule_id + reason per Phase 7 plan).
 *
 * R10/R13 — N/A (no LLM; pure rule evaluation).
 *
 * R5.3 + GR-007 — week-1 N/A (passthrough). Week-7 GR-007 implementation
 * EXTENDS the representative regex pack from T-SKELETON-004 EvaluateNode
 * test fixtures into the canonical full pack at runtime.
 *
 * R6 — N/A (passthrough doesn't reference heuristic body).
 *
 * R10 compliance: file ≤ 80 lines.
 */
import { type CritiqueFinding, type GroundResult } from '../../audit/types.js';

export class EvidenceGrounder {
  async ground(critiqued: readonly CritiqueFinding[]): Promise<GroundResult> {
    return { grounded: [...critiqued], rejected: [] };
  }
}

// ─── Phase 7 T130: evidenceGrounderRun (AC-18, REQ-ANALYZE-NODE-004) ────
//
// Runs 9 grounding rules in order: GR-001..GR-008 + GR-012 (folded per
// plan.md §3). First fail → push to rejected with rule_id + reason. All
// pass → assign confidence_tier via TierValidator (T109) +
// assignConfidenceTier (T115); push to grounded.
//
// R7.4 — rejected_findings append-only; preserved with rejection rationale.
import type { AnalyzePerception } from '../types.js';
import type { HeuristicExtended } from '../heuristics/types.js';
import type {
  CritiqueFinding as Phase7CritiqueFinding,
  GroundedFinding as Phase7GroundedFinding,
  RejectedFinding as Phase7RejectedFinding,
} from '../../orchestration/AnalysisState.js';
import { TierValidator } from '../heuristics/tier-validator.js';
import {
  assignConfidenceTier,
  type EvidenceType,
  type ReliabilityTier,
} from '../utils/assignTier.js';
import type { GroundingRule } from './rules/types.js';
import { GR_001_elementExists } from './rules/GR-001.js';
import { GR_002_foldMatchesBoundingBox } from './rules/GR-002.js';
import { GR_003_formFieldCount } from './rules/GR-003.js';
import { GR_004_contrastClaims } from './rules/GR-004.js';
import { GR_005_heuristicInFilteredSet } from './rules/GR-005.js';
import { GR_006_criticalNeedsMeasurement } from './rules/GR-006.js';
import { GR_007_noConversionPredictions } from './rules/GR-007.js';
import { GR_008_dataPointReferencesRealSection } from './rules/GR-008.js';
import { GR_012_benchmarkValidation } from './rules/GR-012.js';

/**
 * Rule pipeline — id matched to spec REQ-ANALYZE-GROUND-001 names. Order
 * matters for telemetry only (first-fail wins).
 */
const RULE_PIPELINE: ReadonlyArray<{ readonly id: string; readonly rule: GroundingRule }> = [
  { id: 'GR-001', rule: GR_001_elementExists },
  { id: 'GR-002', rule: GR_002_foldMatchesBoundingBox },
  { id: 'GR-003', rule: GR_003_formFieldCount },
  { id: 'GR-004', rule: GR_004_contrastClaims },
  { id: 'GR-005', rule: GR_005_heuristicInFilteredSet },
  { id: 'GR-006', rule: GR_006_criticalNeedsMeasurement },
  { id: 'GR-007', rule: GR_007_noConversionPredictions },
  { id: 'GR-008', rule: GR_008_dataPointReferencesRealSection },
  { id: 'GR-012', rule: GR_012_benchmarkValidation },
];

export interface EvidenceGrounderInput {
  readonly critique_findings: ReadonlyArray<Phase7CritiqueFinding>;
  readonly perception: AnalyzePerception;
  readonly filteredHeuristics: ReadonlyArray<HeuristicExtended>;
  /** Test seam. Defaults to `new TierValidator()` with built-in category map. */
  readonly tierValidator?: TierValidator;
}

export interface EvidenceGrounderResult {
  readonly grounded_findings: Phase7GroundedFinding[];
  readonly rejected_findings: Phase7RejectedFinding[];
}

const DIGIT_RE = /\d/;

function deriveEvidenceType(finding: Phase7CritiqueFinding): EvidenceType {
  const m = finding.evidence.measurement;
  if (m !== null && DIGIT_RE.test(m)) return 'measurable';
  if (finding.evidence.element_ref !== null || finding.evidence.element_selector !== null) {
    return 'observable';
  }
  return 'subjective';
}

function coerceReliabilityTier(tier: number): ReliabilityTier {
  // TierValidator.validate returns 1 | 2 | 3 by construction.
  return (tier === 1 || tier === 2 ? tier : 3) as ReliabilityTier;
}

export function evidenceGrounderRun(input: EvidenceGrounderInput): EvidenceGrounderResult {
  const { critique_findings, perception, filteredHeuristics } = input;
  const tierValidator = input.tierValidator ?? new TierValidator();
  const grounded_findings: Phase7GroundedFinding[] = [];
  const rejected_findings: Phase7RejectedFinding[] = [];

  for (const finding of critique_findings) {
    let rejectedBy: { id: string; reason: string } | null = null;
    for (const { id, rule } of RULE_PIPELINE) {
      const r = rule(finding, perception, filteredHeuristics);
      if (!r.pass) {
        rejectedBy = { id, reason: r.reason };
        break;
      }
    }

    if (rejectedBy !== null) {
      rejected_findings.push({
        ...finding,
        rejected_by_rule: rejectedBy.id,
        rejection_reason: rejectedBy.reason,
      });
      continue;
    }

    // All rules passed → assign confidence_tier.
    const heuristic = filteredHeuristics.find(
      (h) => (h as { id: string }).id === finding.heuristic_id,
    );
    const reliability_tier: ReliabilityTier = heuristic
      ? coerceReliabilityTier(tierValidator.validate(heuristic))
      : 3;
    const evidenceType = deriveEvidenceType(finding);
    const confidence_tier = assignConfidenceTier({ reliability_tier, evidenceType });
    grounded_findings.push({ ...finding, confidence_tier });
  }

  return { grounded_findings, rejected_findings };
}
