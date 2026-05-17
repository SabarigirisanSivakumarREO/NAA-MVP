/**
 * AuditState — Phase 5 browse-mode subset.
 *
 * REQ-BROWSE-NODE-001 — extends Phase 4b T4B-011 forward-stub additively (R20).
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-01 v0.4
 *   docs/specs/mvp/phases/phase-5-browse-mvp/impact.md §1 (AuditState extension)
 *   docs/specs/mvp/phases/phase-5-browse-mvp/plan.md §3 (T081)
 *
 * SCOPE (T081):
 *   This file ships the browse-mode slice of AuditState by EXTENDING the
 *   Phase 4b base schema via `z.extend()`. It adds the 9 browse-specific
 *   fields the BrowseGraph nodes (Setup / SelectAction / ExecuteAction /
 *   Perceive / Verify / Reflect / Complete) need to carry between nodes,
 *   plus a typed `_phase8_extensions` escape hatch for the Phase 8 widening
 *   that lands T135.
 *
 *   The Phase 4b base schema (state.ts) is NOT modified — additive only per
 *   R20 cross-phase forward-compatibility. The base contract (audit_run_id,
 *   client_id, current_node, node_status, context_profile_id,
 *   context_profile_hash, pending_questions, created_at, updated_at) stays
 *   exactly as authored at T4B-011.
 *
 * R20 sibling contracts:
 *   - Phase 4b AuditStateSchema (state.ts) — base, locked, additive-only.
 *   - Phase 1 PageStateModelSchema (../perception/types.ts) — referenced by
 *     `page_state_models[]`; locked, not re-shaped here.
 *
 * `.strict()` — unknown fields rejected. Phase 8 widening MUST use the typed
 * `_phase8_extensions` slot or `.extend()` again at the T135 site.
 *
 * Constitution compliance:
 *   R10.4 Zod-first: schema declared BEFORE TS type via z.infer.
 *   R10.2 named exports only; no default exports.
 *   R10.1 file ≤ 200 LOC target (T081 brief cap).
 *   R2: no `any`; `_phase8_extensions` is z.record(z.string(), z.unknown()).
 *   R9: zero vendor SDK imports outside `zod`.
 *   R25: no judgment fields (severity, impact, score, priority); state
 *     carries only orchestration plumbing.
 */
import { z } from 'zod';

import { PageStateModelSchema } from '../perception/types.js';
import { AuditStateSchema } from './state.js';

// ---------------------------------------------------------------------------
// BusinessTypeEnum — coarse business-archetype hint (refined by Phase 4b
// archetype inferrer at orchestration time; carried in state for downstream
// browse-mode prompts).
// ---------------------------------------------------------------------------

/**
 * Coarse business archetype hint. Default `unknown` allows the audit run to
 * start without prior inference; downstream nodes (Phase 4b ArchetypeInferrer)
 * may refine it post-context-capture.
 */
export const BusinessTypeEnum = z.enum([
  'ecommerce',
  'saas',
  'b2b',
  'content',
  'unknown',
]);
export type BusinessType = z.infer<typeof BusinessTypeEnum>;

// ---------------------------------------------------------------------------
// CompletionReasonEnum — terminal classification for a finished audit run.
// ---------------------------------------------------------------------------

/**
 * Terminal status classifier set by the Complete node (or budget/abort/timeout
 * watchdog). `undefined` while the run is still in progress.
 */
export const CompletionReasonEnum = z.enum([
  'success',
  'budget_exceeded',
  'aborted',
  'timeout',
]);
export type CompletionReason = z.infer<typeof CompletionReasonEnum>;

// ---------------------------------------------------------------------------
// AuditStateBrowseSubsetSchema — Phase 5 extension of Phase 4b base
// ---------------------------------------------------------------------------

/**
 * AuditState (browse-mode subset).
 *
 * Phase 4b base fields (inherited via `.extend()`):
 *   audit_run_id, client_id, current_node, node_status,
 *   context_profile_id, context_profile_hash, pending_questions,
 *   created_at, updated_at.
 *
 * Phase 5 ADDITIONS (T081 / REQ-BROWSE-NODE-001):
 *   - `business_type` — coarse archetype hint; default `unknown`.
 *   - `urls_remaining` — queue of pages still to audit.
 *   - `current_url` — URL the active browse loop is on (undefined pre-Setup).
 *   - `page_state_models` — perception snapshots accumulated across pages.
 *   - `session_confidence` — ConfidenceScorer-managed [0..1]; default 1.0.
 *   - `budget_remaining_usd` — pre-call gate input (R14).
 *   - `analysis_cost_usd` — accumulated spend; default 0.
 *   - `completion_reason` — terminal classifier; undefined while running.
 *   - `_phase8_extensions` — typed escape hatch for Phase 8 widening (R20
 *     forward-compatibility); `z.record(z.string(), z.unknown())`.
 *
 * `.strict()` rejects unknown fields. Phase 8 owners MUST either populate
 * `_phase8_extensions` (loose, opt-in) or re-`extend()` this schema at the
 * T135 site (tight, schema-level).
 */
export const AuditStateBrowseSubsetSchema = AuditStateSchema.extend({
  business_type: BusinessTypeEnum.default('unknown'),
  urls_remaining: z.array(z.string().url()),
  current_url: z.string().url().optional(),
  page_state_models: z.array(PageStateModelSchema).default([]),
  session_confidence: z.number().min(0).max(1).default(1.0),
  budget_remaining_usd: z.number().nonnegative(),
  analysis_cost_usd: z.number().nonnegative().default(0),
  completion_reason: CompletionReasonEnum.optional(),
  _phase8_extensions: z.record(z.string(), z.unknown()).optional(),
}).strict();
export type AuditStateBrowseSubset = z.infer<typeof AuditStateBrowseSubsetSchema>;
