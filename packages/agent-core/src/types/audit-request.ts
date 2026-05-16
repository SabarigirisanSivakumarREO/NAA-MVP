/**
 * AuditRequest intake schema — canonical Phase 4b T4B-009 shared contract.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/final-architecture/18-trigger-gateway.md §18
 *     REQ-GATEWAY-INTAKE-001 (goal.primary_kpi REQUIRED)
 *     REQ-GATEWAY-INTAKE-002 (constraints.regulatory non-empty for 6 MVP
 *       regulated verticals: pharma / fintech / gambling / healthcare /
 *       legal / insurance)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-09 + R-10 +
 *     §Out-of-Scope act-008 (7 additional regulated verticals deferred to
 *     Phase 13b — NO auto-rejection, NO fuzzy matching in v1.0)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-009 brief
 *
 * SCOPE (T4B-009):
 *   Phase 4b extends AuditRequest with an `intake` block — user-provided
 *   pre-audit context that gets normalized into ContextProfile by the
 *   capture layer. This file declares the intake-only shape needed by the
 *   Phase 4b clarification flow. Full AuditRequest contract (target/scope/
 *   budget/heuristic_set/trigger metadata per §18.4 REQ-TRIGGER-CONTRACT-001)
 *   is Phase 6 deliverable (§18.13 implementation phase mapping) and will
 *   be authored at `src/gateway/AuditRequest.ts` then; until then, callers
 *   compose this intake type into their own AuditRequest envelope.
 *
 * Forward Stability (impact.md §1):
 *   - 6-value BusinessArchetypeEnum + 8-value PrimaryKPIEnum + 6-value
 *     MVP_REGULATED_VERTICALS array are LOCKED.
 *   - Additional archetypes/verticals deferred to v1.1 / Phase 13b per
 *     spec.md §Out-of-Scope (act-007 / act-008 closures).
 *
 * R20 consumed-from contracts (cross-phase dependencies):
 *   - Phase 0 `clients` table — `client_id` (uuid) satisfies RLS scope
 *     (R7.2; `SET LOCAL app.client_id` in transactions touching this row).
 *   - Phase 4 ContextProfile (T4B-001) — `pre_audit_context?: Partial<...>`
 *     here is the explicit intake half of the {explicit, inferred} split
 *     consumed by ContextCaptureNode (T4B-011) and downstream HeuristicLoader
 *     (T4B-013).
 *   - Phase 4 `audit_requests` Drizzle table (db/schema.ts:281) — this Zod
 *     contract is the application-layer shape; the DB row stores
 *     scope_config / budget_config / heuristic_config as JSONB and is
 *     populated post-validation by the Phase 6 gateway service.
 *
 * Constitution compliance:
 *   R10.4 Zod-first: schemas declared BEFORE TS types via z.infer.
 *   R10.2 named exports only; no default exports.
 *   R10.1 file ≤ 300 LOC target.
 *   R2: no `any`; intake fields use precise Zod schemas.
 *   R9: zero vendor deps outside `zod` (no Playwright per R25, no
 *     @anthropic-ai/sdk — pure schema contract).
 *   R25: NO judgment fields (severity, impact, score, priority); the
 *     intake captures consultant declarations, never CRO judgments.
 *
 * Anchor: @T4B-009 — AuditRequest intake schema lock (Phase 4b §18 ext).
 */
import { z } from 'zod';

import {
  BusinessArchetypeEnum,
  ContextProfileSchema,
} from './context-profile.js';

// ---------------------------------------------------------------------------
// LOCKED enums per §18 + AC-09
// ---------------------------------------------------------------------------

/**
 * 8 LOCKED primary KPI values per §18 REQ-GATEWAY-INTAKE-001 (verbatim from
 * `AuditRequestIntake.goal.primary_kpi` interface at L26-27 of §18). REQUIRED
 * — AuditRequest validation rejects audits missing this field.
 */
export const PrimaryKPIEnum = z.enum([
  'purchase',
  'signup',
  'lead',
  'add_to_cart',
  'demo_request',
  'trial_start',
  'subscribe',
  'engagement',
]);
export type PrimaryKPI = z.infer<typeof PrimaryKPIEnum>;

/**
 * 6 MVP regulated verticals per §18 REQ-GATEWAY-INTAKE-002 + AC-09 + R-10.
 * EXACT MATCH required — no fuzzy matching in v1.0 (spec.md §Out-of-Scope
 * act-008 explicitly defers cannabis / firearms / adult_content /
 * tobacco_or_vape / alcohol / financial_advice_or_RIA / telehealth to
 * Phase 13b master track; T4B-009 emits NO warning for unrecognized
 * verticals in MVP).
 *
 * Exported as a const tuple so callers can introspect membership (e.g.,
 * Phase 6 gateway service uses this to drive its rejection branch).
 */
export const MVP_REGULATED_VERTICALS = [
  'pharma',
  'fintech',
  'gambling',
  'healthcare',
  'legal',
  'insurance',
] as const;
export type MvpRegulatedVertical = (typeof MVP_REGULATED_VERTICALS)[number];

/** Type guard: is this vertical one of the 6 MVP auto-reject targets? */
export const isMvpRegulatedVertical = (v: string): v is MvpRegulatedVertical =>
  (MVP_REGULATED_VERTICALS as readonly string[]).includes(v);

// ---------------------------------------------------------------------------
// Intake block — §18 AuditRequestIntake interface, Zod-fied
// ---------------------------------------------------------------------------

/**
 * Goal constraints per §18 L31-36. `regulatory[]` non-empty enforcement
 * lives at the AuditRequestSchema superRefine level (REQ-GATEWAY-INTAKE-002),
 * not here — this shape just declares the array exists.
 */
export const IntakeGoalConstraintsSchema = z
  .object({
    regulatory: z.array(z.string()),
    accessibility: z.enum(['WCAG_AA', 'WCAG_AAA', 'none']).optional(),
    brand: z.array(z.string()).optional(),
    technical: z.array(z.string()).optional(),
  })
  .strict();
export type IntakeGoalConstraints = z.infer<typeof IntakeGoalConstraintsSchema>;

/**
 * Goal block per §18 L26-37. `primary_kpi` REQUIRED (REQ-GATEWAY-INTAKE-001).
 */
export const IntakeGoalSchema = z
  .object({
    primary_kpi: PrimaryKPIEnum,
    secondary_kpis: z.array(z.string()).optional(),
    current_baseline: z.number().optional(),
    target_lift: z.number().optional(),
    constraints: IntakeGoalConstraintsSchema,
  })
  .strict();
export type IntakeGoal = z.infer<typeof IntakeGoalSchema>;

/** Business block per §18 L21-25. All fields optional (intake is best-effort). */
export const IntakeBusinessSchema = z
  .object({
    archetype: BusinessArchetypeEnum.optional(),
    aov_tier: z.enum(['low', 'mid', 'high', 'enterprise']).optional(),
    vertical: z.string().optional(),
  })
  .strict();
export type IntakeBusiness = z.infer<typeof IntakeBusinessSchema>;

/** Per-channel traffic source per §18 L40-43 (intake form). */
export const IntakeTrafficSourceSchema = z
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
export type IntakeTrafficSource = z.infer<typeof IntakeTrafficSourceSchema>;

/** Traffic block per §18 L38-45. */
export const IntakeTrafficSchema = z
  .object({
    primary_sources: z.array(IntakeTrafficSourceSchema).optional(),
    device_priority: z.enum(['mobile', 'desktop', 'balanced']).optional(),
  })
  .strict();
export type IntakeTraffic = z.infer<typeof IntakeTrafficSchema>;

/** Audience block per §18 L46-49. */
export const IntakeAudienceSchema = z
  .object({
    buyer: z
      .enum([
        'consumer',
        'prosumer',
        'SMB',
        'mid_market',
        'enterprise',
        'technical',
        'non_technical',
      ])
      .optional(),
    awareness_level: z
      .enum(['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'])
      .optional(),
  })
  .strict();
export type IntakeAudience = z.infer<typeof IntakeAudienceSchema>;

/**
 * AuditRequestIntake — top-level intake block per §18 L20-51. Composed
 * into AuditRequest (full gateway envelope lands in Phase 6).
 */
export const AuditRequestIntakeSchema = z
  .object({
    business: IntakeBusinessSchema.optional(),
    goal: IntakeGoalSchema,
    traffic: IntakeTrafficSchema.optional(),
    audience: IntakeAudienceSchema.optional(),
  })
  .strict();
export type AuditRequestIntake = z.infer<typeof AuditRequestIntakeSchema>;

// ---------------------------------------------------------------------------
// AuditRequest (Phase 4b slice) — identity + intake + Phase 4b-specific
// warning flags. Full §18.4 REQ-TRIGGER-CONTRACT-001 envelope (target,
// scope, budget, heuristic_set, trigger metadata) lands at Phase 6.
// ---------------------------------------------------------------------------

/**
 * Phase 4b deferred-archetype warning codes — emitted by Pass 2 inference
 * when the inferred archetype falls outside the 6 MVP-supported values
 * (per spec.md §Out-of-Scope act-007). These flags are advisory in v1.0
 * (no auto-reject) and intended for downstream Phase 6 gateway logs +
 * Phase 13b master-track expansion.
 *
 * Set when business.archetype maps to one of {publisher, non_profit,
 * content_subscription, education, government} per act-007 closure.
 */
export const UnsupportedBusinessArchetypeFlag = z.boolean();

/**
 * Phase 4b deferred-vertical warning codes — emitted advisorily when
 * `business.vertical` matches a Phase 13b vertical (cannabis / firearms /
 * adult_content / tobacco_or_vape / alcohol / financial_advice_or_RIA /
 * telehealth per act-008 closure). No auto-reject in v1.0 — consultant
 * must manually populate `goal.constraints.regulatory` when auditing
 * these verticals.
 */
export const UnsupportedRegulatedVerticalFlag = z.boolean();

/**
 * AuditRequest (Phase 4b slice). Carries identity (client_id satisfies
 * Phase 0 RLS scope — R7.2) + URL list + business_type + intake + optional
 * `pre_audit_context` (Partial<ContextProfile> — the explicit half of the
 * {explicit, inferred} split consumed by ContextCaptureNode at T4B-011).
 *
 * REQ-GATEWAY-INTAKE-001 enforcement: `intake.goal.primary_kpi` REQUIRED
 *   (Zod parse rejects absence at the IntakeGoalSchema layer).
 *
 * REQ-GATEWAY-INTAKE-002 enforcement: superRefine — when
 *   `intake.business.vertical` is one of the 6 MVP regulated verticals,
 *   `intake.goal.constraints.regulatory` MUST be non-empty.
 *
 * `pre_audit_context` is `z.unknown()` wrapping a `Partial<ContextProfile>`
 * because Zod doesn't natively express deep-partial — the consumer
 * (T4B-011 ContextCaptureNode) re-parses with a deep-partial helper before
 * merging into ContextProfile.
 */
export const AuditRequestSchema = z
  .object({
    client_id: z.string().uuid(),
    urls: z.array(z.string().url()).min(1),
    business_type: BusinessArchetypeEnum,
    intake: AuditRequestIntakeSchema,
    pre_audit_context: ContextProfileSchema.partial().optional(),
    unsupported_business_archetype: UnsupportedBusinessArchetypeFlag.optional(),
    unsupported_regulated_vertical: UnsupportedRegulatedVerticalFlag.optional(),
  })
  .strict()
  .superRefine((req, ctx) => {
    // REQ-GATEWAY-INTAKE-002: regulated-vertical intake MUST declare regulatory.
    const vertical = req.intake.business?.vertical;
    if (vertical !== undefined && isMvpRegulatedVertical(vertical)) {
      if (req.intake.goal.constraints.regulatory.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['intake', 'goal', 'constraints', 'regulatory'],
          message:
            `REQ-GATEWAY-INTAKE-002: vertical "${vertical}" is regulated; ` +
            `goal.constraints.regulatory MUST be non-empty.`,
        });
      }
    }
  });
export type AuditRequest = z.infer<typeof AuditRequestSchema>;
