/**
 * AnalysisState — Phase 7 analyze-mode extension.
 *
 * REQ-STATE-001 / AC-01 — extends Phase 5 `AuditStateBrowseSubsetSchema`
 * additively per R20. Browse + Phase 4b base contracts stay untouched.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-7-analysis/spec.md AC-01 + Key Entities §L312
 *   docs/specs/mvp/phases/phase-7-analysis/tasks.md T113
 *
 * SCOPE (T113):
 *   Forward-stub Finding lifecycle schemas (Raw → Critique → Grounded /
 *   Rejected) are declared here with permissive shapes. T119 (EvaluateNode),
 *   T121 (SelfCritiqueNode), T130 (EvidenceGrounder), T132 (StoreNode) tighten
 *   them at their respective sites via `.extend()` or replacement when the
 *   LLM output Zod schemas (spec §7.5, §7.6, §7.7) are wired.
 *
 * `analysis_status` taxonomy covers spec.md L229-241 edge cases + AC-22a
 * routing + REQ-ANALYZE-RECOVERY-003 completeness.
 *
 * Constitution:
 *   R2: no `any` — forward-stub fields use `z.unknown()` with TODO markers.
 *   R10.4 Zod-first; R10.2 named exports only; R10.1 ≤300 LOC target.
 *   R20: additive — `AuditStateBrowseSubsetSchema` not modified.
 */
import { z } from 'zod';

import { PerceptionBundleSchema } from '../perception/PerceptionBundle.js';
import { AuditStateBrowseSubsetSchema } from './AuditState.js';

// ---------------------------------------------------------------------------
// PageTypeEnum — 6 page-type categories (T114 detectPageType output domain).
// ---------------------------------------------------------------------------
export const PageTypeEnum = z.enum([
  'homepage',
  'product',
  'checkout',
  'form',
  'pricing',
  'other',
]);
export type PageType = z.infer<typeof PageTypeEnum>;

// ---------------------------------------------------------------------------
// ConfidenceTierEnum — assignTier output domain (T115).
// ---------------------------------------------------------------------------
export const ConfidenceTierEnum = z.enum(['high', 'medium', 'low']);
export type ConfidenceTier = z.infer<typeof ConfidenceTierEnum>;

// ---------------------------------------------------------------------------
// SeverityEnum — Finding severity per F-011 (annotation pin colors).
// ---------------------------------------------------------------------------
export const SeverityEnum = z.enum(['critical', 'high', 'medium', 'low']);
export type Severity = z.infer<typeof SeverityEnum>;

// ---------------------------------------------------------------------------
// AnalysisStatusEnum — per-page analysis status taxonomy.
//
// Bound to AC-22a + REQ-ANALYZE-RECOVERY-003 (every page non-null).
// Covers spec.md edge cases L229-241 + quality-gate routing + error paths.
// ---------------------------------------------------------------------------
export const AnalysisStatusEnum = z.enum([
  'pending',
  'complete',
  'complete_no_findings',
  'partial_analysis_perception_quality_marginal',
  'partial_analysis_budget',
  'skipped_empty_perception',
  'skipped_perception_quality_low',
  'skipped_llm_output_invalid',
  'budget_exhausted_partial',
  'error_db_unavailable',
  'error_r10_temperature_guard_violation',
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusEnum>;

// ---------------------------------------------------------------------------
// CritiqueVerdictEnum — SelfCritiqueNode per-finding verdict.
// ---------------------------------------------------------------------------
export const CritiqueVerdictEnum = z.enum([
  'KEEP',
  'REVISE',
  'DOWNGRADE',
  'REJECT',
]);
export type CritiqueVerdict = z.infer<typeof CritiqueVerdictEnum>;

// ---------------------------------------------------------------------------
// Finding lifecycle forward-stub schemas.
//
// TODO (T119): RawFindingSchema tightened to spec §7.5 Zod output schema once
//   evaluate prompt template (T118) is authored.
// TODO (T121): CritiqueFindingSchema tightened to spec §7.6 once self-critique
//   prompt is authored.
// TODO (T130): GroundedFindingSchema + RejectedFindingSchema tightened in the
//   EvidenceGrounder site once GR-001..GR-008 + GR-012 are wired.
// ---------------------------------------------------------------------------

/**
 * RawFinding — EvaluateNode output. Forward-stub: permissive `recommendation`
 * shape to be tightened in T119 against spec §7.5 Zod schema.
 */
export const RawFindingSchema = z
  .object({
    heuristic_id: z.string().min(1),
    name: z.string().min(1),
    severity: SeverityEnum,
    evidence: z.unknown(),
    recommendation: z.unknown(),
    persona: z.string().nullable().optional(),
    viewport: z.enum(['desktop', 'mobile', 'tablet']).optional(),
  })
  .passthrough();
export type RawFinding = z.infer<typeof RawFindingSchema>;

/**
 * CritiqueFinding — SelfCritiqueNode output. Extends RawFinding with verdict.
 */
export const CritiqueFindingSchema = RawFindingSchema.extend({
  verdict: CritiqueVerdictEnum,
  revision_notes: z.string().optional(),
});
export type CritiqueFinding = z.infer<typeof CritiqueFindingSchema>;

/**
 * GroundedFinding — EvidenceGrounder pass output. Adds confidence_tier +
 * optional measurement (R5.7: required when severity ∈ {critical, high}).
 */
export const GroundedFindingSchema = CritiqueFindingSchema.extend({
  confidence_tier: ConfidenceTierEnum,
  measurement: z.unknown().optional(),
});
export type GroundedFinding = z.infer<typeof GroundedFindingSchema>;

/**
 * RejectedFinding — EvidenceGrounder reject output. Records the rule that
 * rejected + the reason string. Persisted append-only per R7.4.
 */
export const RejectedFindingSchema = CritiqueFindingSchema.extend({
  rejected_by_rule: z.string().min(1),
  rejection_reason: z.string().min(1),
});
export type RejectedFinding = z.infer<typeof RejectedFindingSchema>;

// ---------------------------------------------------------------------------
// PageSignals forward-stub — §7.13 cross-page emission consumed by Phase 8.
// TODO (T132 / Phase 8): tighten to the lightweight extract schema.
// ---------------------------------------------------------------------------
export const PageSignalsSchema = z
  .object({
    page_url: z.string().url(),
    page_type: PageTypeEnum,
    viewport: z.enum(['desktop', 'mobile', 'tablet']).optional(),
    heuristic_ids_fired: z.array(z.string()),
    severity_counts: z.record(z.string(), z.number()),
  })
  .passthrough();
export type PageSignals = z.infer<typeof PageSignalsSchema>;

// ---------------------------------------------------------------------------
// AnalysisStateSchema — Phase 7 extension of Phase 5 browse subset.
//
// Phase 5 + Phase 4b base fields inherited via `.extend()`. Phase 7 ADDITIONS
// (T113):
//   - current_page_perception_bundle — Phase 1c PerceptionBundle for active page
//   - current_page_type — T114 output
//   - confidence_tier — T115 output (per-page)
//   - evaluate_findings_raw[] — T119 output
//   - critique_findings[] — T121 output
//   - grounded_findings[] — T130 pass output (FINAL — consultant-visible)
//   - rejected_findings[] — T130 reject output (append-only audit trail)
//   - analysis_status — taxonomy enum (AC-22a + REQ-ANALYZE-RECOVERY-003)
//   - current_page_signals — §7.13 cross-page emission (Phase 8 consumer)
//
// NOTE: `analysis_cost_usd` already present in browse subset (L118 AuditState.ts);
//       NOT re-declared here — inherited.
//
// `.strict()` rejects unknowns. Phase 8 widening uses `_phase8_extensions`
// escape hatch (inherited from browse subset).
// ---------------------------------------------------------------------------
export const AnalysisStateSchema = AuditStateBrowseSubsetSchema.extend({
  current_page_perception_bundle: PerceptionBundleSchema.optional(),
  current_page_type: PageTypeEnum.optional(),
  confidence_tier: ConfidenceTierEnum.optional(),
  evaluate_findings_raw: z.array(RawFindingSchema).default([]),
  critique_findings: z.array(CritiqueFindingSchema).default([]),
  grounded_findings: z.array(GroundedFindingSchema).default([]),
  rejected_findings: z.array(RejectedFindingSchema).default([]),
  analysis_status: AnalysisStatusEnum.default('pending'),
  current_page_signals: PageSignalsSchema.optional(),
}).strict();
export type AnalysisState = z.infer<typeof AnalysisStateSchema>;
