---
title: R20 invalidation note — Phase 5 landed 2026-05-17
artifact_type: r20-note
status: draft
version: 1.0
created: 2026-05-17
owner: engineering lead
authors: [Claude (master orchestrator)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-5-browse-mvp/spec.md (v0.5 verified)
  - docs/specs/mvp/phases/phase-5-browse-mvp/phase-5-current.md (v1.1 verified)
  - docs/specs/mvp/phases/phase-5-browse-mvp/phase-5-validation.md (v1.0 verified)

req_ids:
  - REQ-ANALYSIS-EVALUATE-001
  - REQ-ANALYSIS-GROUND-001
  - REQ-ANALYSIS-CRITIQUE-001
  - REQ-ANALYSIS-STORE-001

governing_rules:
  - Constitution R20 (Impact-before-implementation)
---

# R20 invalidation — Phase 5 landed 2026-05-17

Phase 5 Browse MVP shipped 2026-05-17 (Gate 2 stamped; INDEX flipped 🟢). 4 NEW shared contracts + 1 helper (BudgetMutex) + LangGraph runtime dep.

## Required reading before Phase 7 implementation begins

1. Re-run `/speckit.analyze` on `phase-7-analysis/` against Phase 5 surface — Phase 7 AnalyzeSubGraph composes alongside Phase 5 BrowseSubGraph in Phase 8 AuditGraph. State channel reducer behavior (LastValue) may force Phase 7 to copy Bug-A merge-slices pattern in node-internal multi-phase orchestration.
2. Read `phase-5-current.md` §1+§2 + `phase-5-validation.md` §1+§4 for active modules + traceability.

## What Phase 5 shipped that Phase 7 must respect

### AuditStateBrowseSubsetSchema (T081) — extend additively (R20)

Phase 7 nodes (DeepPerceive / Evaluate / SelfCritique / Ground / Annotate / Store) write to the SAME AuditState as Phase 5 BrowseSubGraph. Phase 7 MUST:
- EXTEND `AuditStateBrowseSubsetSchema` via `z.extend()` — never replace.
- Use `_phase8_extensions` escape hatch for transient analyze-mode fields (or wait for Phase 8 widening at T135).
- Honor the 7 Phase 5 transient fields already on `_phase8_extensions`: `browse_loop_iteration`, `last_action_proposal`, `last_verify_result`, `last_failure_class`, `cause_class`, `hitl_pending`, `last_llm_cost`.

### BrowseSubGraph (T091) — LangGraph composition

Phase 7 AnalyzeSubGraph + Phase 5 BrowseSubGraph compose in Phase 8 AuditGraph (`buildAuditGraph` at T135). LangGraph state channels are SHARED across both subgraphs. Bug-A pattern lesson: any multi-phase node that writes via multiple internal functions MUST merge slices before returning to the channel — LastValue reducer overwrites.

### BROWSE_AGENT_SYSTEM_PROMPT + ActionProposalSchema (T090) — 24 names

Phase 7 introduces ANALYZE_AGENT_SYSTEM_PROMPT (separate from BROWSE_AGENT). The 5 `page_*` tools (page_analyze, page_get_performance, page_get_element_info, page_annotate_screenshot, page_screenshot_full) are ANALYZE-mode-only per `08-tool-manifest.md` §8.2 — Phase 7 should enumerate them in its analyze prompt.

### FailureClass enum (5 LOCKED) + edges.ts routing

`packages/agent-core/src/verification/types.ts` L221-226. Phase 7 analyze nodes may produce additional failure classes if they emit new ones; current MVP enum is LOCKED at 5. Adding new classes requires R20 cycle (impact.md update + tasks-v2.md amendment).

### BudgetMutex (T-PHASE5-CONCURRENCY-HARDEN) — wiring deferred

`packages/agent-core/src/orchestration/BudgetMutex.ts` exports `createBudgetMutex().withLock(auditRunId, fn)` for serializing concurrent LLM-call budget debits per audit_run. **NOT YET WIRED**. Phase 7/8 LLMAdapter+BudgetGate integration site owns the wiring. If Phase 7 ships parallel analyze+browse subgraphs before Phase 8 composes, BudgetMutex MUST be wired first.

### BrowseNode.success/failure/abort budget debit (Bug-C fix)

`state.budget_remaining_usd -= lastLlmCost` from `_phase8_extensions.last_llm_cost`. Phase 7 EvaluateNode + GroundNode + SelfCritiqueNode SHOULD adopt the same pattern (debit budget on every LLM call). Reference: `BrowseNode.ts:117` (totalCost capture) + L186-200 (success debit) + L195-220 (failure debit) + L230-244 (abort with cost param).

### F-015 fix — terminal FailureClass must set completion_reason

Bug-fix lesson (1636e26): when a node routes directly to audit_complete via a FailureClass terminal row (safety_blocked, bot_detected_likely), the node MUST set `completion_reason='aborted'` + `cause_class` in the returned slice. AuditCompleteNode requires completion_reason on entry. Phase 7 nodes that produce terminal-routed failures should follow this pattern.

## Phase 7 may consume Phase 5 contracts

- Phase 7 ANALYZE_AGENT prompt may reuse the prompt-engineering pattern from `browse-agent.ts` (golden snapshot + drift assertion + Zod discriminated union over LOCKED tool names).
- Phase 7 nodes may consume `_phase8_extensions.last_action_proposal` / `last_verify_result` if analyze runs after browse on the same page (cross-phase observability).
- Phase 7 may reuse `BudgetMutex` once wired into Phase 7 LLMAdapter integration site.

## Forward compatibility risk

If Phase 7 introduces a new `node_status` value beyond Phase 4b's 5 LOCKED enum (`pending | running | halted | complete | failed`), that requires R20 cycle. Phase 5 used 'running' (selectAction intermediate) + 'complete' (verify+route success/failure) + 'halted' (HITL) + 'failed' (abort) — no new values introduced.

## Owner sign-off for Phase 7

Phase 7 lead reads this note + the validation doc spot-check list before bumping any phase-7-analysis artifact from `draft → approved`. Acceptance: master invokes `/speckit.analyze` on phase-7-analysis (Stage 1 pre-flight) — analyze flags any R20 violations against this note.
