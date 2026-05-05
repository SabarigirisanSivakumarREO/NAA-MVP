/**
 * HeuristicSchema (base + Extended) — canonical heuristic content shape.
 *
 * Source: docs/specs/mvp/phases/phase-6-heuristics/{spec,tasks}.md
 *         (T101 + AC-01 + AC-02 + AC-11 partial +
 *          REQ-HK-001 + REQ-HK-EXT-001..019 + REQ-CONTEXT-DOWNSTREAM-001).
 *
 * Why this lands week 1 (forward-pulled from Phase 6): walking-skeleton
 * T-SKELETON-003 needs a Zod-validated heuristic contract before any
 * stubbed HeuristicLoader can return synthetic fixtures. See
 * implementation-roadmap.md §6 cross-week ordering note: "T101 MUST land
 * in week 1 alongside T-SKELETON-003."
 *
 * R20 contract surface — consumed by:
 *   - Phase 6 T106 FileSystemHeuristicLoader (real producer)
 *   - Phase 6 T107 two-stage filter (filterByBusinessType + filterByPageType)
 *   - Phase 6 T109 TierValidator (maps category → Tier 1/2/3)
 *   - Phase 4b T4B-013 HeuristicLoader.loadForContext (reads manifest selectors)
 *   - Phase 7 T119 EvaluateNode (serializes filtered subset into LLM user message)
 *
 * R6 IP-boundary discipline (Phase 6 spec line 99-102):
 *   - Heuristic body / benchmark / provenance content NEVER appears in:
 *     API responses, dashboards, Pino logs (only ids), LangSmith traces.
 *   - This file defines the *shape*; downstream loader (T106) + Pino
 *     redaction config (T-PHASE6-LOGGER) enforce at the seam.
 *
 * R15.3 mandatory fields:
 *   - benchmark (quantitative or qualitative discriminated union)
 *   - provenance (5 fields: source_url, citation_text, draft_model,
 *     verified_by, verified_date)
 *
 * R10 compliance:
 *   - File ≤ 300 lines (R10.1)
 *   - Zero z.any() (SC-005-equivalent for Phase 6)
 *   - Named exports only (R10.3)
 *
 * Why `field?: T | undefined` instead of `field?: T`: tsconfig sets
 * `exactOptionalPropertyTypes: true`; same pattern as PageStateModel
 * (perception/types.ts).
 */
import { z } from 'zod';

// ----------------------------------------------------------------------
// Constants — finite enums for §9.10 fields
// ----------------------------------------------------------------------

export const RULE_VS_GUIDANCE_VALUES = ['rule', 'guidance'] as const;
export const EFFORT_CATEGORIES = ['quick_win', 'strategic', 'incremental', 'deprioritized'] as const;
export const STATUS_VALUES = ['draft', 'active', 'deprecated'] as const;

// ----------------------------------------------------------------------
// Preliminary v0.2 manifest-selector enums
// ----------------------------------------------------------------------

/**
 * Preliminary business archetype enum. Canonical authority lands in
 * Phase 4b T4B-001 (ContextProfile schema); the values here cover the
 * archetypes Phase 6 spec.md AC-11 cites ("D2C/PDP/mobile, SaaS/pricing/
 * desktop, B2B/comparison/balanced, lead_gen/landing/mobile") plus a
 * conservative `other` escape hatch for fixtures during week 1
 * walking-skeleton work.
 */
export const PRELIMINARY_BUSINESS_ARCHETYPES = [
  'D2C',
  'SaaS',
  'B2B',
  'lead_gen',
  'marketplace',
  'media',
  'other',
] as const;

/** Preliminary page-type enum — canonical: Phase 4b T4B-001. */
export const PRELIMINARY_PAGE_TYPES = [
  'homepage',
  'pdp',
  'plp',
  'cart',
  'checkout',
  'pricing',
  'comparison',
  'landing',
  'other',
] as const;

/** Preliminary device enum — canonical: Phase 4b T4B-001. */
export const PRELIMINARY_DEVICES = ['mobile', 'desktop', 'tablet', 'balanced'] as const;

// ----------------------------------------------------------------------
// ProvenanceSchema (R15.3.1 — 5 mandatory fields)
// ----------------------------------------------------------------------

/**
 * ISO-8601 datetime regex. Tighter than z.string().datetime() because we
 * need to control the exact accepted shape per spec.md T101 constraint
 * "provenance.verified_date ISO-8601 regex".
 *
 * Accepts: YYYY-MM-DDTHH:MM:SS[.fff][Z|±HH:MM]
 */
const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * LLM model id pattern. Accepts the common provider prefixes; the
 * canonical claim "draft_model is either 'human' literal OR an LLM
 * model id" (T101 constraint) maps to the union below.
 */
const LLM_MODEL_ID_REGEX = /^(claude|gpt|gemini|llama|mistral|qwen)-[\w.-]+$/i;

export const ProvenanceSchema = z
  .object({
    source_url: z.string().url(),
    citation_text: z.string().min(1),
    draft_model: z.union([z.literal('human'), z.string().regex(LLM_MODEL_ID_REGEX)]),
    verified_by: z.string().min(1),
    verified_date: z.string().regex(ISO_8601_REGEX),
  })
  .strict();

export type Provenance = z.infer<typeof ProvenanceSchema>;

// ----------------------------------------------------------------------
// BenchmarkSchema (R15.3 — discriminated union)
// ----------------------------------------------------------------------

export const QuantitativeBenchmarkSchema = z
  .object({
    kind: z.literal('quantitative'),
    /** The measured value (e.g., 44 for "44px touch target"). */
    value: z.number(),
    /** The unit of measurement (e.g., "px", "ms", "%"). */
    unit: z.string().min(1),
    /** What is measured (e.g., "min_touch_target_size", "p95_load_time_ms"). */
    metric: z.string().min(1),
  })
  .strict();

export type QuantitativeBenchmark = z.infer<typeof QuantitativeBenchmarkSchema>;

export const QualitativeBenchmarkSchema = z
  .object({
    kind: z.literal('qualitative'),
    /** The qualitative reference (e.g., "WCAG 2.1 AA contrast ratio"). */
    standard_text: z.string().min(1),
  })
  .strict();

export type QualitativeBenchmark = z.infer<typeof QualitativeBenchmarkSchema>;

export const BenchmarkSchema = z.discriminatedUnion('kind', [
  QuantitativeBenchmarkSchema,
  QualitativeBenchmarkSchema,
]);

export type Benchmark = z.infer<typeof BenchmarkSchema>;

// ----------------------------------------------------------------------
// HeuristicSchemaBase (§9.1 — minimal LLM-evaluable surface)
// ----------------------------------------------------------------------

/**
 * Heuristic id pattern: `<PACK>-<CATEGORY>-<NNN>` (e.g., BAYMARD-CHECKOUT-001).
 * Pack + category use uppercase letters / digits + dashes; NNN is a
 * 3+ digit numeric suffix.
 */
const HEURISTIC_ID_REGEX = /^[A-Z][A-Z0-9_]*-[A-Z][A-Z0-9_]*-\d{3,}$/;

export const HeuristicSchemaBase = z
  .object({
    id: z.string().regex(HEURISTIC_ID_REGEX),
    /**
     * The LLM-evaluable rule text. R6: NEVER serialized to logs / API /
     * dashboard / traces — Pino redaction (T-PHASE6-LOGGER) enforces.
     */
    body: z.string().min(1),
    /**
     * Category string. T109 TierValidator maps to Tier 1 / 2 / 3
     * (visual+structural / content+persuasion / subjective).
     */
    category: z.string().min(1),
  })
  .strict();

export type HeuristicBase = z.infer<typeof HeuristicSchemaBase>;

// ----------------------------------------------------------------------
// HeuristicSchemaExtended (§9.10 + R15.3 + v0.2 manifest selectors)
// ----------------------------------------------------------------------

export const HeuristicSchemaExtended = HeuristicSchemaBase.extend({
  // §9.10 fields (REQ-HK-EXT-001..019)
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  rule_vs_guidance: z.enum(RULE_VS_GUIDANCE_VALUES),
  /** 0-1 weight; T107 prioritizeHeuristics sorts by this descending. */
  business_impact_weight: z.number().min(0).max(1),
  effort_category: z.enum(EFFORT_CATEGORIES),
  /** State conditional: e.g., ['default'], ['authenticated', 'cart_nonempty']. */
  preferred_states: z.array(z.string().min(1)),
  status: z.enum(STATUS_VALUES),

  // R15.3 REQUIRED — enforced by schema, NOT by loader
  benchmark: BenchmarkSchema,
  provenance: ProvenanceSchema,

  // v0.2 manifest selectors — OPTIONAL; absent/empty array = "applies to all"
  // Phase 4b T4B-013 HeuristicLoader.loadForContext reads these against
  // ContextProfile.business.archetype / page.type / traffic.device_priority.
  archetype: z.array(z.enum(PRELIMINARY_BUSINESS_ARCHETYPES)).optional(),
  page_type: z.array(z.enum(PRELIMINARY_PAGE_TYPES)).optional(),
  device: z.array(z.enum(PRELIMINARY_DEVICES)).optional(),
}).strict();

export type HeuristicExtended = z.infer<typeof HeuristicSchemaExtended>;

// ----------------------------------------------------------------------
// Helper: applies-to-all check for manifest selectors
// ----------------------------------------------------------------------

/**
 * Returns true if a heuristic's manifest selector matches a given
 * ContextProfile dimension value, OR if the selector is absent / empty
 * (= "applies to all" per Phase 6 spec.md AC-11). Used by Phase 6 T107
 * filter functions and Phase 4b T4B-013 loadForContext.
 *
 * @example
 *   matchesSelector(heuristic.archetype, 'D2C')  // true if archetype is undefined OR includes 'D2C'
 */
export function matchesSelector<T extends string>(
  selector: readonly T[] | undefined,
  value: T,
): boolean {
  if (!selector || selector.length === 0) return true;
  return selector.includes(value);
}
