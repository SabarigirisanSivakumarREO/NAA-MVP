/**
 * AuditState — Phase 8 T135 FORWARD STUB authored at Phase 4b T4B-011.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md L360 §Assumptions
 *     ("AuditState (T135 Phase 8 prereq) provides the schema slot for
 *      `context_profile_id` + `context_profile_hash`. T4B-011 schedules
 *      cleanly before Phase 8 because T4B-011 extends AuditState's schema
 *      before AuditState is locked.")
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §3 risk register
 *     ("AuditState slot for `context_profile_id` not present — coordinate
 *      with Phase 8 owner; T4B-011's prereq T135 must schedule slot before
 *      Phase 8 finalizes AuditState.")
 *   docs/specs/mvp/phases/phase-4b-context-capture/impact.md §1 (AuditState
 *     listed as affected contract — additive, non-breaking extension)
 *   docs/specs/final-architecture/04-orchestration.md §04 (full AuditState
 *     shape lands at Phase 8 — this stub is the minimal slice required
 *     for Phase 4b ContextCaptureNode halt/resume + orchestration plumbing)
 *
 * SCOPE (T4B-011 stub):
 *   This file ships the minimum AuditState shape Phase 4b's ContextCaptureNode
 *   needs to (a) populate `context_profile_id` + `context_profile_hash` per
 *   AC-11, (b) toggle `node_status` to `'halted'` when blocking open_questions
 *   surface, and (c) carry `pending_questions[]` across the CLI clarification
 *   resume boundary.
 *
 *   Phase 8 T135 EXTENDS this schema (additive, non-breaking) with the full
 *   set of orchestration slots (PageStateModel, Finding[], rolledup_findings,
 *   exploration state, budget tracking). When T135 lands, an R20 impact.md
 *   update is required to declare the extension; this file's `.strict()`
 *   schema means the extension MUST add fields via `.extend({...})` at the
 *   T135 site (Zod composition pattern), not by replacing this contract.
 *
 * R20 sibling contracts:
 *   - ContextProfile (Phase 4b T4B-001) — `context_profile_id` references its `id`;
 *     `context_profile_hash` mirrors its `profile_hash` (SHA-256 hex format).
 *   - OpenQuestion (Phase 4b T4B-001) — `pending_questions[]` carries OpenQuestion[]
 *     in Phase 4b; Phase 8 T135 may widen the union (typed as z.unknown() here
 *     to leave that decision to the T135 owner).
 *
 * Forward Stability LOCK (impact.md §1 — additive only):
 *   The 5-value AuditNodeStatusEnum is LOCKED for Phase 4b. New status values
 *   require Phase 4b spec amendment + impact.md R20 cycle (analogous to the
 *   ContextDimensionEnum / ContextSourceEnum locks in context-profile.ts).
 *
 * Constitution compliance:
 *   R10.4 Zod-first: schema declared BEFORE TS type via z.infer.
 *   R10.2 named exports only; no default exports.
 *   R10.1 file ≤ 300 LOC target (this file ≈ 130 LOC).
 *   R2: no `any`; pending_questions is z.array(z.unknown()) (typed at
 *     consumer site — Phase 4b passes OpenQuestion[]).
 *   R9: zero vendor SDK imports outside `zod`.
 *   R25: no judgment fields (severity, impact, score, priority); state
 *     carries only orchestration plumbing.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// AuditNodeStatusEnum (LOCKED 5 values; Phase 4b additive-only forward stub)
// ---------------------------------------------------------------------------

/**
 * Node-level lifecycle status. Used by ContextCaptureNode and (post-T135)
 * every orchestration node to signal what the audit graph should do next.
 *
 * - `pending`  — node not yet executed (initial state pre-run)
 * - `running`  — node mid-execution (transient; rarely observed at rest)
 * - `halted`   — node paused awaiting external input (e.g., CLI clarification);
 *                Phase 4b uses this when blocking open_questions surface.
 * - `complete` — node finished successfully; state ready for next node
 * - `failed`   — node terminated unrecoverably (Phase 8 may extend with
 *                error-class metadata; Phase 4b carries no error payload)
 */
export const AuditNodeStatusEnum = z.enum([
  'pending',
  'running',
  'halted',
  'complete',
  'failed',
]);
export type AuditNodeStatus = z.infer<typeof AuditNodeStatusEnum>;

// ---------------------------------------------------------------------------
// ClarificationAnswer — shared shape with T4B-010 CLI clarification module
// ---------------------------------------------------------------------------

/**
 * Shape of one user answer harvested by apps/cli/src/contextClarification.ts
 * (T4B-010). Defined locally here to avoid cross-package type coupling —
 * the CLI module imports the SAME shape independently. RECOMMENDED pattern
 * per T4B-011 brief: shared shape, no shared dependency.
 *
 * NOTE: `source` mirrors `ContextSource` from context-profile.ts. Re-declared
 * here as a string union to keep this module's dependency surface to `zod`
 * only (R9). Consumers (ContextCaptureNode) cast at the merge site.
 *
 * Typical values:
 *   - source: 'user' (consultant explicitly answered)
 *   - confidence: 1.0 (user-provided answers are authoritative)
 */
export const ClarificationAnswerSchema = z
  .object({
    field_path: z.string().min(1),
    value: z.unknown(),
    source: z.enum([
      'user',
      'url_pattern',
      'schema_org',
      'copy_inference',
      'layout_inference',
      'default',
    ]),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type ClarificationAnswer = z.infer<typeof ClarificationAnswerSchema>;

// ---------------------------------------------------------------------------
// AuditStateSchema — minimum slice for Phase 4b T4B-011
// ---------------------------------------------------------------------------

/**
 * AuditState — orchestration-graph state object passed between nodes.
 *
 * Phase 4b slice fields:
 *   - `audit_run_id` / `client_id` — identity carrying RLS scope (R7.2).
 *   - `current_node` — name of the node currently executing
 *     (e.g., 'context_capture' for ContextCaptureNode).
 *   - `node_status` — lifecycle slot per AuditNodeStatusEnum.
 *   - `context_profile_id` / `context_profile_hash` — populated by T4B-011
 *     once a ContextProfile is built + persisted; null pre-capture.
 *   - `pending_questions` — OpenQuestion[] surfaced when `node_status: 'halted'`;
 *     read by CLI (T4B-010) to drive the clarification prompt.
 *   - `created_at` / `updated_at` — orchestration audit timestamps.
 *
 * Phase 8 T135 extensions (NOT IN THIS FILE — additive):
 *   - PageStateModel slots, Finding[], rolledup_findings, exploration state,
 *     budget tracking. Extend via `.extend({...})` at the T135 site.
 *
 * `.strict()` — unknown fields rejected. Forces Phase 8 T135 owner to use
 * Zod `.extend()` (additive) rather than silently augmenting the shape.
 */
export const AuditStateSchema = z
  .object({
    audit_run_id: z.string().uuid(),
    client_id: z.string().uuid(),
    current_node: z.string().min(1),
    node_status: AuditNodeStatusEnum,
    context_profile_id: z.string().uuid().nullable(),
    context_profile_hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, 'must be 64-char hex SHA-256')
      .nullable(),
    pending_questions: z.array(z.unknown()),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .strict();
export type AuditState = z.infer<typeof AuditStateSchema>;
