---
title: R20 invalidation note — Phase 4b landed 2026-05-16
artifact_type: r20-note
status: approved
version: 1.0
created: 2026-05-16
updated: 2026-05-16
owner: engineering lead
authors: [Claude (drafter)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md (v0.4 verified 2026-05-16)
  - docs/specs/mvp/phases/phase-4b-context-capture/phase-4b-current.md (v1.0)
  - docs/specs/mvp/phases/phase-4b-context-capture/phase-4b-validation.md
  - packages/agent-core/src/orchestration/state.ts (Phase 4b fwd-stub)

req_ids:
  - REQ-BROWSE-NODE-001

governing_rules:
  - Constitution R20 (Impact-before-implementation)
  - Constitution R25 (Context Capture MUST NOT — informational for Phase 5)
---

# R20 invalidation — Phase 4b landed 2026-05-16

Phase 4b (Context Capture Layer v1.0) shipped 2026-05-16 per `phase-4b-current.md` v1.0 verified. 6 NEW shared contracts:

- `ContextProfile` (Zod schema) — top-level intake profile; SHA-256 hashed + frozen
- `ContextField<T>` factory — `{value, source, confidence}` triple per dimension
- 6 LOCKED enums — `BusinessArchetypeEnum` (6 vals) + `PageTypeEnum` (12 vals) + `ContextSourceEnum` (6 vals) + `ContextDimensionEnum` (5 vals) + `ConfidenceThresholdActionEnum` (3 vals) + `InferenceMethodEnum` (3 vals)
- `ProvenanceEntry`, `OpenQuestion`, `ClarificationAnswer`
- `AuditState` fwd-stub at `packages/agent-core/src/orchestration/state.ts` — 6 base slots (audit_run_id, client_id, current_node, node_status, context_profile_id, context_profile_hash, pending_questions) + `AuditNodeStatusEnum` 5 vals (pending/running/halted/complete/failed)
- `context_profiles` append-only DB table (migration 0004)

**Required before Phase 5 implementation begins:**

1. Re-run `/speckit.analyze` on `phase-5-browse-mvp/` against Phase 4b surface (this v0.3 patch wave satisfies)
2. Read `phase-4b-context-capture/phase-4b-current.md` §1+§2 + `phase-4b-validation.md` §4 AC→impl→test matrix
3. T081 AC-01 AuditStateBrowseSubsetSchema MUST reconcile with Phase 4b's `state.ts` — chosen approach: **EXTEND** Phase 4b's existing schema additively. Phase 5 adds browse-specific fields (`urls_remaining`, `current_url`, `page_state_models`, `session_confidence`, `budget_remaining_usd`, `analysis_cost_usd`, `completion_reason`) via `z.extend()` or `z.merge()`. Phase 4b's existing 6 slots stay in place. `_phase8_extensions` escape hatch retained for Phase 8 widening. R20 additive contract preserved.

**Phase 5 BrowseNode consumes (or MAY consume) Phase 4b ContextProfile:**

- `state.context_profile_id` + `state.context_profile_hash` available for safety gating
- `business.archetype` value MAY inform domain-policy decisions
- `constraints.regulatory` value MAY inform PerceptionBundle warnings
- Phase 5 does NOT write ContextProfile — read-only consumer (R25 honored: Phase 5 is a downstream consumer, not the context capture layer)

**R25 (Context Capture MUST NOT) — informational for Phase 5:**

Phase 5 is NOT a context capture layer. Phase 5 reads ContextProfile read-only. R25's 10 hard prohibitions do not directly govern Phase 5 code, but Phase 5 MUST NOT mutate ContextProfile (it's `Object.freeze`'d) and MUST NOT bypass open_questions blocking-state if any are present on the AuditState.

**Forward compatibility risk:**

If Phase 5 ships AuditStateBrowseSubsetSchema as a SEPARATE schema (option b, replace), Phase 4b's `state.ts` orphans. Chosen approach (option a, extend) keeps Phase 4b live + Phase 5 strictly additive.

**Open question for Phase 5 lead:** Does the BROWSE_AGENT system prompt's tool-name list (29) include the 5 `page_*` analyze-mode tools? Per `08-tool-manifest.md` §8.2, page_* are analyze-mode-only; Phase 5 is browse-mode. Default answer: **EXCLUDE** page_* from BROWSE_AGENT prompt (24 names) but MCPToolRegistry.list() returns 29 (registry is shared). Document decision in T090 brief.
