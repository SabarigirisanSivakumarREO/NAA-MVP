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

req_ids:
  - REQ-CLI-001
  - REQ-DASHBOARD-001
  - REQ-HITL-RESUME-001

governing_rules:
  - Constitution R20 (Impact-before-implementation)
---

# R20 invalidation — Phase 5 landed 2026-05-17

Phase 5 Browse MVP shipped 2026-05-17. Phase 9 (CLI + dashboard + delivery) consumes Phase 5 BrowseGraph as the audit-execution surface.

## Required reading before Phase 9 implementation begins

1. Re-run `/speckit.analyze` on `phase-9-delivery/` against Phase 5 + Phase 8 (when Phase 8 lands) surface.
2. Read `phase-5-current.md` §3 (system flows) + `phase-5-validation.md` §2 (data flow entry point).

## What Phase 5 shipped that Phase 9 must wire

### T-PHASE9-CLI — multi-URL + business-type CLI flags

Current Phase 0b walking-skeleton CLI accepts `pnpm cro:audit --url=<URL>` (singular). Phase 5 README documents the **target** Phase 9 surface: `pnpm cro:audit --urls ./urls.txt --business-type ecommerce`. Phase 9 owns:
- Parse `--urls <path>` → load URL list file (one URL per line)
- Parse `--business-type` → seed `AuditStateBrowseSubset.business_type` (enum `ecommerce | saas | b2b | content | unknown`)
- Wire CLI args → `BrowseGraph.invoke({initialState})`
- Output streaming: SSE or stdout per Phase 4 StreamEmitter
- Report generation: PDF stub (Phase 9 ReportGenerator)

### HitlManager — process-local registry → persistent checkpoint

Phase 5's `createHitlManager()` uses an in-process Map. Phase 9 dashboard may resume audits across process restarts (operator pauses for HITL, comes back next day). Phase 9 MUST:
- Swap MemorySaver → persistent checkpointer (Postgres-backed, e.g., `@langchain/langgraph-checkpoint-postgres` if available)
- Persist HITL pending state in checkpoint (audit_run_id → cause_class)
- Resume API: `POST /api/audits/<id>/resume {decision}` → calls `compiledGraph.invoke(undefined, {configurable: {thread_id: audit_run_id}})` per LangGraph resume pattern
- 5-min auto-timeout: persistent timer; survives process restart (cron or scheduled job rather than `setTimeout`)

### Dashboard: stream + status

Phase 5 emits LOCKED 22-enum AuditEvents via SessionRecorder + StreamEmitter (Phase 4). Phase 9 dashboard MUST:
- Subscribe to SSE stream from BrowseGraph execution
- Render Phase 5 events: `audit_started`, `page_browse_started/completed/failed`, `audit_completed`, `audit_failed` (with `cause_class` metadata)
- Show `session_confidence` real-time (R4.4 multiplicative — never additive)
- Surface HITL pending state via `hitl_requested` event + cause_class metadata

### CLI exit codes

Phase 9 `pnpm cro:audit` exit codes map to terminal `completion_reason`:
- `success` → 0
- `budget_exceeded` → 1 (or 2)
- `aborted` (cause_class varies) → 2 (or distinct codes per cause)
- `timeout` → 3

Document in Phase 9 spec.

### Cost reporting

Phase 5 ships budget debit (Bug-C fix). Phase 9 must surface:
- `audit_runs.budget_remaining_usd` final value
- `audit_runs.total_cost_usd` (sum of llm_call_log per Phase 4)
- Per-audit cost report (queryable per R14.4 client-scoped attribution)

## Forward compatibility risk

If Phase 9 introduces an audit-trigger source beyond what `AuditState.trigger_source` enum (defined Phase 8) supports, that requires R20 cycle.

If Phase 9 CLI consumes `--business-type` other than the LOCKED 5 BusinessType enum values (`ecommerce | saas | b2b | content | unknown`), that requires expanding the enum at Phase 5 source (R18 delta block).

## Owner sign-off for Phase 9

Phase 9 lead reads this note + Phase 8 R20 note (when Phase 8 lands) before bumping any phase-9-delivery artifact from `draft → approved`. Stage 1 pre-flight `/speckit.analyze` will flag R20 violations.
