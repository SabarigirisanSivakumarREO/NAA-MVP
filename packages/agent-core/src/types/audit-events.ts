/**
 * AuditEvent contracts — canonical Phase 4 shared types.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/final-architecture/34-observability.md §34.4 REQ-OBS-011
 *     (event schema) + REQ-OBS-012 (22 canonical event types — LOCKED).
 *   docs/specs/final-architecture/13-data-layer.md §13.7 `audit_events`
 *     table — DB row shape (Drizzle table mirrors this Zod schema).
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md §"Forward
 *     stability promises" — `audit_events` 22-type enum is LOCKED; new
 *     types require Phase 4 amendment + impact.md cycle.
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md
 *     T-PHASE4-TYPES brief L160-183 (verbatim 22-string enumeration).
 *
 * Exports (T-PHASE4-TYPES):
 *   - AuditEventTypeEnum + AuditEventType type (22 values; ORDER-PRESERVING
 *     per tasks.md L160-183; LOCKED)
 *   - AuditEventSchema + AuditEvent type (one row per emitted event;
 *     append-only — DB-enforced via enforce_append_only trigger)
 *
 * R10.4 Zod-first: schemas declared BEFORE TS types via z.infer.
 * R10.2 named exports only; no default exports.
 * R2: no `any`; `metadata` is `z.unknown()` — per-type payload typing is
 *   intentionally NOT enforced at the contract layer (the DB column is
 *   JSONB; SessionRecorder per-call sites supply event-specific Zod
 *   refinements at emit time, NOT at the shared-contract layer).
 * R9: this file has NO vendor dependencies — only zod.
 *
 * 22-type enum stability (impact.md Forward Stability):
 *   New event types require:
 *     1. Phase 4 spec/tasks amendment
 *     2. impact.md cycle (R20)
 *     3. Drizzle schema field-list ratification (T070 conformance test
 *        asserts enum membership)
 *   The 22 strings below MUST string-equal the rows in §34.4 REQ-OBS-012
 *   and the brief in tasks.md L161-182.
 */
import { z } from 'zod';

/**
 * AuditEventTypeEnum — 22 canonical event types.
 *
 * Order mirrors tasks.md L161-182 and §34.4 REQ-OBS-012 row order; the
 * order itself is informational (`z.enum` validates by string membership,
 * not position), but preserving it eases cross-document review.
 *
 * Grouping (per §34.4 emit-by column):
 *   audit lifecycle (1-3)         — audit_setup / audit_complete / any node
 *   page browse lifecycle (4-6)   — page_router / browse subgraph
 *   page analyze lifecycle (7-9)  — deep_perceive / annotate_and_store / any node
 *   finding lifecycle (10-13)     — evaluate / ground / self_critique / store
 *   budget signals (14-15)        — cost tracker
 *   LLM call signals (16-18)      — LLMAdapter
 *   quality + HITL signals (19-20)
 *   cross-page (21)
 *   browse subgraph extension (22) — overlay_dismissed (v2.2a)
 */
export const AuditEventTypeEnum = z.enum([
  'audit_started',
  'audit_completed',
  'audit_failed',
  'page_browse_started',
  'page_browse_completed',
  'page_browse_failed',
  'page_analyze_started',
  'page_analyze_completed',
  'page_analyze_skipped',
  'finding_produced',
  'finding_grounding_rejected',
  'finding_critique_rejected',
  'finding_published',
  'budget_warning',
  'budget_exceeded',
  'llm_call_completed',
  'llm_call_failed',
  'llm_provider_fallback',
  'perception_quality_low',
  'hitl_requested',
  'cross_page_analysis_completed',
  'overlay_dismissed',
]);

export type AuditEventType = z.infer<typeof AuditEventTypeEnum>;

/**
 * AuditEvent — row shape for the `audit_events` Drizzle table.
 *
 * Emitted by SessionRecorder (T074) to both the DB row AND the SSE stream
 * (REQ-OBS-010). One row per significant state transition. Append-only
 * (R7.4) — UPDATE/DELETE blocked at DB level. RLS-scoped via `client_id`
 * (R7.2).
 *
 * `page_url` is nullable — null for audit-level events (audit_started,
 * audit_completed, audit_failed, budget_warning, budget_exceeded,
 * cross_page_analysis_completed); non-null for page-scoped events
 * (per §34.4 metadata column).
 *
 * `metadata` is `z.unknown()` — per-type payload typing is enforced at the
 * emission site, not the shared contract (the DB column is JSONB; tighter
 * typing would couple every consumer to every event type's payload shape,
 * defeating the SSE-stream-as-firehose pattern in §34.4). SessionRecorder
 * MAY layer per-type Zod refinements at emit time.
 *
 * `timestamp` is `z.coerce.date()` so callers can pass either Date or an
 * ISO-8601 string (REQ-OBS-011 calls it ISO 8601; the Postgres TIMESTAMPTZ
 * column returns it as a string from pg).
 */
export const AuditEventSchema = z
  .object({
    id: z.string().uuid(),
    audit_run_id: z.string().uuid(),
    client_id: z.string().uuid(),
    event_type: AuditEventTypeEnum,
    page_url: z.string().url().nullable(),
    metadata: z.unknown(),
    timestamp: z.coerce.date(),
  })
  .strict();

export type AuditEvent = z.infer<typeof AuditEventSchema>;
