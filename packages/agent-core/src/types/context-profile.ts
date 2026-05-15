/**
 * ContextProfile contracts — canonical Phase 4b shared types (T4B-001).
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.1..§37.2
 *     (REQ-CONTEXT-DIM-* + REQ-CONTEXT-OUT-001..003)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md §"Key Entities"
 *     + AC-01 + AC-07 + §"Out of Scope" (act-007/008 archetype/vertical lock)
 *   docs/specs/mvp/phases/phase-4b-context-capture/impact.md §1 (NEW shared
 *     contract; Forward Stability LOCK)
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §2.2 (weights —
 *     confirms `brand` as the 5th dimension); §2.3 (SHA-256 hash helper)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-001 brief
 *
 * Forward Stability LOCK (impact.md §1):
 *   - 5-value ContextDimensionEnum + 6-value ContextSourceEnum +
 *     6-value BusinessArchetypeEnum + 12-value PageTypeEnum are LOCKED.
 *   - New values require Phase 4b spec amendment + impact.md R20 cycle.
 *
 * R20 sibling contracts (Zod-first pattern reference): see audit-events.ts
 *   (AuditEvent 22-type enum) and llm.ts (LLMCallRecord) — W1C templates.
 *
 * Constitution compliance:
 *   R10.4 Zod-first: schemas declared BEFORE TS types via z.infer.
 *   R10.2 named exports only; no default exports.
 *   R10.1 file ≤ 300 LOC target.
 *   R2: no `any`; provenance.inferred_value is `z.unknown()` (typed
 *     dimension schemas are the source of truth for parsed values).
 *   R9: zero vendor deps outside `zod` (no Playwright per R25, no
 *     @anthropic-ai/sdk, no drizzle-orm/pg — types are pure schema).
 *   R25: NO judgment fields (severity, impact, score, priority, risk_X,
 *     recommend_X) anywhere; every field carries explicit provenance.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (LOCKED per impact.md Forward Stability)
// ---------------------------------------------------------------------------

/** 5 LOCKED universal context dimensions. Order = plan.md §2.2 weight desc. */
export const ContextDimensionEnum = z.enum([
  'business',
  'page',
  'audience',
  'traffic',
  'brand',
]);
export type ContextDimension = z.infer<typeof ContextDimensionEnum>;

/** 6 LOCKED inference sources per §37.2. `default` MUST carry confidence:0. */
export const ContextSourceEnum = z.enum([
  'user',
  'url_pattern',
  'schema_org',
  'copy_inference',
  'layout_inference',
  'default',
]);
export type ContextSource = z.infer<typeof ContextSourceEnum>;

/**
 * 3 inference method classes. `llm_judge` is FORBIDDEN in Phase 4b MVP
 * per R25.1 item 10 — reserved for Phase 13b master track forward compat.
 */
export const InferenceMethodEnum = z.enum([
  'deterministic',
  'heuristic',
  'llm_judge',
]);
export type InferenceMethod = z.infer<typeof InferenceMethodEnum>;

/**
 * 6 LOCKED archetypes per AC-05 + R-07 + §Out-of-Scope act-007 closure.
 * Deferred to Phase 13b: publisher, non_profit, content_subscription,
 * education, government.
 */
export const BusinessArchetypeEnum = z.enum([
  'D2C',
  'B2B',
  'SaaS',
  'marketplace',
  'lead_gen',
  'service',
]);
export type BusinessArchetype = z.infer<typeof BusinessArchetypeEnum>;

/** 12 LOCKED page types per §37.1.2. */
export const PageTypeEnum = z.enum([
  'home',
  'PLP',
  'PDP',
  'cart',
  'checkout',
  'post_purchase',
  'category',
  'landing',
  'blog',
  'about',
  'pricing',
  'comparison',
]);
export type PageType = z.infer<typeof PageTypeEnum>;

/** 3 threshold gates per REQ-CONTEXT-OUT-001: ≥0.9 / 0.6-0.9 / <0.6. */
export const ConfidenceThresholdActionEnum = z.enum(['act', 'use_and_flag', 'ask']);
export type ConfidenceThresholdAction = z.infer<typeof ConfidenceThresholdActionEnum>;

// ---------------------------------------------------------------------------
// Universal `{value, source, confidence}` shape per AC-01
// ---------------------------------------------------------------------------

/** Factory: wraps a typed value with provenance. Confidence ∈ [0,1]. */
export const contextField = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z
    .object({
      value: valueSchema,
      source: ContextSourceEnum,
      confidence: z.number().min(0).max(1),
    })
    .strict();

export type ContextField<T> = {
  value: T;
  source: ContextSource;
  confidence: number;
};

// ---------------------------------------------------------------------------
// Provenance + open questions
// ---------------------------------------------------------------------------

/**
 * ProvenanceEntry — single (dimension, source) audit row. `inferred_value`
 * is `z.unknown()` because per-dimension shape varies; the typed dimension
 * schemas below are the source of truth for the parsed value.
 */
export const ProvenanceEntrySchema = z
  .object({
    dimension: ContextDimensionEnum,
    source: ContextSourceEnum,
    inference_method: InferenceMethodEnum,
    confidence: z.number().min(0).max(1),
    inferred_at: z.coerce.date(),
    inferred_value: z.unknown(),
    notes: z.string().optional(),
  })
  .strict();
export type ProvenanceEntry = z.infer<typeof ProvenanceEntrySchema>;

/** Surfaced to CLI clarification (T4B-010). `blocking:true` halts audit. */
export const OpenQuestionSchema = z
  .object({
    field_path: z.string().min(1),
    question: z.string().min(1),
    blocking: z.boolean(),
    dimension: ContextDimensionEnum.optional(),
  })
  .strict();
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

// ---------------------------------------------------------------------------
// Five LOCKED dimensions
// ---------------------------------------------------------------------------

/** REQ-CONTEXT-DIM-BUSINESS-001 (§37.1.1). */
export const BusinessDimensionSchema = z
  .object({
    archetype: contextField(BusinessArchetypeEnum),
    aov_tier: contextField(z.enum(['low', 'mid', 'high', 'enterprise'])),
    cadence: contextField(
      z.enum(['one_time', 'repeat', 'subscription', 'considered', 'contract']),
    ),
    vertical: contextField(z.string()),
  })
  .strict();
export type BusinessDimension = z.infer<typeof BusinessDimensionSchema>;

/**
 * REQ-CONTEXT-DIM-PAGE-001 (§37.1.2). `is_indexed` nullable — Phase 13b
 * SEO-vs-paid distinction; MVP populates null + source:"default".
 */
export const PageDimensionSchema = z
  .object({
    type: contextField(PageTypeEnum),
    funnel_stage: contextField(
      z.enum(['awareness', 'consideration', 'decision', 'retention']),
    ),
    job: contextField(
      z.enum([
        'educate',
        'convert',
        'reassure',
        'upsell',
        'recover',
        'retain',
        'qualify',
        'route',
      ]),
    ),
    is_indexed: contextField(z.boolean().nullable()),
  })
  .strict();
export type PageDimension = z.infer<typeof PageDimensionSchema>;

/**
 * REQ-CONTEXT-DIM-AUDIENCE-001 (§37.1.3). MVP populates `buyer` from intake;
 * other fields default to confidence:0 (Phase 13b adds inference).
 */
export const AudienceDimensionSchema = z
  .object({
    buyer: contextField(
      z.enum([
        'consumer',
        'prosumer',
        'SMB',
        'mid_market',
        'enterprise',
        'technical',
        'non_technical',
      ]),
    ),
    awareness_level: contextField(
      z.enum(['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware']),
    ),
    decision_style: contextField(z.enum(['impulse', 'researched', 'committee', 'habitual'])),
    sophistication: contextField(z.enum(['low', 'medium', 'high'])),
  })
  .strict();
export type AudienceDimension = z.infer<typeof AudienceDimensionSchema>;

/** Per-channel traffic source (§37.1.4). */
export const TrafficSourceSchema = z
  .object({
    channel: z.enum([
      'paid_search',
      'paid_social',
      'organic',
      'email',
      'direct',
      'referral',
      'affiliate',
      'display',
    ]),
    share: z.number().min(0).max(1).optional(),
    creative_or_message: z.string().optional(),
  })
  .strict();
export type TrafficSource = z.infer<typeof TrafficSourceSchema>;

/**
 * REQ-CONTEXT-DIM-TRAFFIC-001 (§37.1.4). `device_priority` drives
 * T4B-013 HeuristicLoader.loadForContext() mobile-vs-desktop filter.
 */
export const TrafficDimensionSchema = z
  .object({
    primary_sources: contextField(z.array(TrafficSourceSchema)),
    device_priority: contextField(z.enum(['mobile', 'desktop', 'balanced'])),
    mobile_share: contextField(z.number().min(0).max(1).nullable()),
    geo_primary: contextField(z.string().nullable()),
    locale_primary: contextField(z.string().nullable()),
  })
  .strict();
export type TrafficDimension = z.infer<typeof TrafficDimensionSchema>;

/**
 * 5th dimension per spec.md "Key Entities" + plan.md §2.2 (0.05 weight).
 * §37 architecture spec does NOT enumerate per-field shape; Phase 4b v1.0
 * captures minimal style/voice fields. Richer inference = Phase 13b.
 */
export const BrandDimensionSchema = z
  .object({
    tone: contextField(z.string()),
    voice: contextField(z.string()),
    forbidden_terms: contextField(z.array(z.string())),
  })
  .strict();
export type BrandDimension = z.infer<typeof BrandDimensionSchema>;

// ---------------------------------------------------------------------------
// Goal (intake-only per §37.1.5; all source:"user", confidence:1 at runtime)
// ---------------------------------------------------------------------------

/** §37.1.5 nested under goal.constraints. */
export const GoalConstraintsSchema = z
  .object({
    regulatory: contextField(z.array(z.string())),
    accessibility: contextField(z.enum(['WCAG_AA', 'WCAG_AAA', 'none']).nullable()),
    brand: contextField(z.array(z.string())),
    technical: contextField(z.array(z.string())),
  })
  .strict();
export type GoalConstraints = z.infer<typeof GoalConstraintsSchema>;

/**
 * REQ-CONTEXT-DIM-GOAL-001..003 (§37.1.5). `primary_kpi` REQUIRED at the
 * AuditRequest validation layer (T4B-009 owns the rejection rule; this
 * schema declares only the universal shape).
 */
export const GoalDimensionSchema = z
  .object({
    primary_kpi: contextField(
      z.enum([
        'purchase',
        'signup',
        'lead',
        'add_to_cart',
        'demo_request',
        'trial_start',
        'subscribe',
        'engagement',
      ]),
    ),
    secondary_kpis: contextField(z.array(z.string())),
    current_baseline: contextField(z.number().nullable()),
    target_lift: contextField(z.number().nullable()),
    constraints: GoalConstraintsSchema,
  })
  .strict();
export type GoalDimension = z.infer<typeof GoalDimensionSchema>;

// ---------------------------------------------------------------------------
// Meta + top-level ContextProfile
// ---------------------------------------------------------------------------

/** §37.2 meta block. */
export const ContextProfileMetaSchema = z
  .object({
    captured_at: z.coerce.date(),
    capture_method: z.enum(['intake_form', 'inferred', 'hybrid']),
    user_provided_fields: z.array(z.string()),
    inferred_fields: z.array(z.string()),
    overall_confidence: z.number().min(0).max(1),
    threshold_action: ConfidenceThresholdActionEnum,
    perception_layer_version: z.string().min(1),
  })
  .strict();
export type ContextProfileMeta = z.infer<typeof ContextProfileMetaSchema>;

/**
 * Top-level Phase 4b shared contract. SHAPE LOCK per impact.md §1.
 *
 * `id`/`audit_run_id`/`client_id` carry RLS scope (R7.2) for the
 * context_profiles DB row (T4B-012 owns the migration).
 *
 * `profile_hash` = SHA-256 hex of canonical-JSON profile content
 * (plan.md §2.3); computed by builder (T4B-007), validated here as shape only.
 *
 * Immutability (REQ-CONTEXT-OUT-003): Object.freeze applied at build time
 * by the builder, NOT by Zod parse — the AC-01 conformance test asserts
 * freeze post-build separately from this Zod parse.
 */
export const ContextProfileSchema = z
  .object({
    id: z.string().uuid(),
    audit_run_id: z.string().uuid(),
    client_id: z.string().uuid(),
    meta: ContextProfileMetaSchema,
    business: BusinessDimensionSchema,
    page: PageDimensionSchema,
    audience: AudienceDimensionSchema,
    traffic: TrafficDimensionSchema,
    brand: BrandDimensionSchema,
    goal: GoalDimensionSchema,
    open_questions: z.array(OpenQuestionSchema),
    provenance: z.array(ProvenanceEntrySchema),
    profile_hash: z.string().regex(/^[a-f0-9]{64}$/i, 'must be 64-char hex SHA-256'),
    created_at: z.coerce.date(),
  })
  .strict();
export type ContextProfile = z.infer<typeof ContextProfileSchema>;
