---
title: Phase 8 — Audit Orchestrator + Cross-Page — Tasks
artifact_type: tasks
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/tasks-v2.md (Phase 8 section — T135 / T137 / T138 / T145 / T148-T150 MOD v2.0/v2.1)
  - docs/specs/mvp/archive/2026-04-07-walking-skeleton/tasks.md lines 840-985 (canonical T135-T155 baseline; T136 / T139-T144 / T146 / T147 / T151-T155 unchanged)
  - docs/specs/mvp/phases/phase-8-orchestrator/spec.md
  - docs/specs/mvp/phases/phase-8-orchestrator/plan.md
  - docs/specs/mvp/phases/phase-8-orchestrator/impact.md

req_ids:
  - REQ-ORCH-NODE-001..003
  - REQ-ORCH-EDGE-001..003
  - REQ-ORCH-SUBGRAPH-001
  - REQ-STATE-001
  - REQ-STATE-EXT-COMPAT-001
  - REQ-CROSSPAGE-PATTERN-001
  - REQ-REPRO-031a
  - REQ-CHECKPOINT-001

impact_analysis: docs/specs/mvp/phases/phase-8-orchestrator/impact.md
breaking: false
affected_contracts:
  - AuditState (PRODUCER + CONSUMER)
  - PatternFinding (PRODUCER — NEW)
  - PageSignals (CONSUMER)

delta:
  new:
    - Phase 8 tasks — 21 tasks scoped view (T135-T155); canonical defs in tasks-v2.md + archived walking-skeleton tasks.md
    - Cross-page PatternDetector folded into T139 acceptance per F-014 (no new discrete T-ID; punch-list candidate for v2.3.4)
    - AuditState (T135) coordination strategy with Phase 4b T4B-011 + Phase 7 T113 documented in plan.md §2
  changed: []
  impacted: []
  unchanged:
    - All 21 task IDs and base acceptance criteria; v2.0/v2.1 mods on T135 / T137 / T138 / T145 / T148-T150 carried verbatim from tasks-v2.md

governing_rules:
  - Constitution R7.4 (append-only)
  - Constitution R8.1 (audit budget cap)
  - Constitution R14.1 (cost attribution)
  - Constitution R15.2 (analysis_status taxonomy)
  - Constitution R20, R23
---

# Phase 8 Tasks (T135 to T155)

> **Summary (~80 tokens):** 21 tasks. Block A (T135-T142) state + nodes + edges. Block B (T143-T147) graph + checkpointer + CLI + reporters. Block C (T148-T150) ★★ MVP COMPLETE acceptance tests on example.com / amazon.in / bbc.com. T151-T155 reserved for fixes from acceptance. Total ~52h ≈ 6-8 engineering days. Canonical definitions in `tasks-v2.md` Phase 8 section + archived walking-skeleton `tasks.md`.

**Source of truth:**
- T135 / T137 / T138 / T145 / T148-T150 — `docs/specs/mvp/tasks-v2.md` Phase 8 section (v2.0/v2.1 MOD)
- T136 / T139-T144 / T146 / T147 / T151-T155 — `docs/specs/mvp/archive/2026-04-07-walking-skeleton/tasks.md` lines 848-967 (declared "unchanged" in tasks-v2.md v2.3.x)

Acceptance criteria, file paths, and dependencies below mirror canonical sources verbatim — **do NOT modify this file in lieu of updating `tasks-v2.md`** (or, for the unchanged subset, the archived walking-skeleton `tasks.md`).

---

## Phase 8 sequencing

Per [plan.md](plan.md) §1: Days 1-3 Block A (state + nodes + edges) → Days 4-5 Block B (graph + checkpointer + CLI + reporters) → Days 6-8 Block C (acceptance tests = MVP COMPLETE gate). T151-T155 reserved for fixes from acceptance.

---

## Block A — State + Nodes + Edges (Days 1-3)

### T135 — AuditState (full schema) [MOD v2.0]
- **dep:** T081 (AuditState foundation), T113 (Phase 7 analyze fields), T4B-011 (Phase 4b context_profile_id/hash slots)
- **spec:** REQ-STATE-001 + REQ-STATE-EXT-COMPAT-001 + `final-architecture/05-unified-state.md` §5.7
- **files:** `packages/agent-core/src/orchestration/AuditState.ts` (extend)
- **v2.0 changes (per tasks-v2.md):** Base browse + analyze fields ✅ unchanged. **NEW §5.7 fields added** with defaults: `trigger_source` (default "consultant_dashboard"), `audit_request_id` (default ""), `state_graph` (default null), `multi_state_perception` (default null), `current_state_id` (default null), `exploration_cost_usd` (default 0), `exploration_budget_usd` (default 0.50), `exploration_pass_2_triggered` (default false), `finding_rollups` (default []), `reproducibility_snapshot` (default null), `published_finding_ids` (default []), `warmup_mode_active` (default true). All new fields have defaults → Phase 1-5 code unaffected (REQ-STATE-EXT-COMPAT-001). **Plus Phase 4b T4B-011 slots:** `context_profile_id` + `context_profile_hash` (both nullable string).
- **acceptance:** All §5.3 + §5.7 fields compile. Invariants validated (§5.4 + §5.7.3). Serializes to JSON for checkpointing. Conformance test (AC-01) green.
- **coordination:** See [plan.md §2](plan.md) — sequential PR protocol with Phase 4b T4B-011 + Phase 7 T113.
- **conformance:** AC-01

### T136 — AuditPage type + page queue helpers
- **dep:** T135
- **files:** `packages/agent-core/src/orchestration/types.ts`
- **acceptance:** AuditPage with status enum (`pending | running | completed | skipped | error`); helpers `nextPage(state)`, `markCompleted(state, url)`, `markSkipped(state, url, reason)`, `markError(state, url, error)`.
- **conformance:** AC-02

### T137 — AuditSetupNode [MOD v2.0]
- **dep:** T135, T106 (HeuristicLoader Phase 6), T074 (DB adapter)
- **spec:** REQ-ORCH-NODE-001 + REQ-REPRO-031a + REQ-TRIGGER-PERSIST-003
- **files:** `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts`
- **smoke test:** Setup audit for example.com.
- **v2.0 changes (per tasks-v2.md):**
  - Original: loads client, builds page queue, creates audit_run ✅ unchanged
  - **NEW: reads `reproducibility_snapshot`** from DB (created by gateway/CLI) into AuditState. If snapshot missing → fail audit with `completion_reason: snapshot_missing`.
  - **NEW: reads `AuditRequest`** from `audit_requests` table to populate `trigger_source`, `audit_request_id`.
  - **NEW: sets `warmup_mode_active`** from client profile.
  - **NEW (v2.1): Stage 1 heuristic filtering** — calls `filterByBusinessType(allHeuristics, business_type)` and stores the reduced set (~30 → ~20-25) in `state.heuristic_knowledge_base` (per §9.6 REQ-HK-020a). Page-type filtering happens later in page_router (Stage 2).
- **acceptance:** Reproducibility snapshot loaded. AuditRequest consumed. Warm-up mode set. `heuristic_knowledge_base` contains only business-type-relevant heuristics (Stage 1 filtered). audit_runs row created.
- **conformance:** AC-03

### T138 — PageRouterNode [MOD v2.1]
- **dep:** T135
- **spec:** REQ-ORCH-NODE-002 + REQ-HK-020b + R8.1 (audit budget cap)
- **files:** `packages/agent-core/src/orchestration/nodes/PageRouterNode.ts`
- **v2.1 changes (per tasks-v2.md):**
  - page_router calls `filterByPageType(state.heuristic_knowledge_base, currentPageType)` (Stage 2, per §9.6 REQ-HK-020b)
  - Input is the BUSINESS-FILTERED set from audit_setup (not all 30)
  - Stores result in `state.filtered_heuristics` (capped at 30 via prioritizeHeuristics)
- **plus:** budget gate per R8.1 — if `cumulative_cost + estimated_next_page_cost > budget`, route to AuditCompleteNode with `completion_reason: budget_exceeded`; skipped pages get `analysis_status: budget_exhausted_skipped`.
- **acceptance:** `filtered_heuristics` contains 15-20 page-relevant heuristics from the business-filtered set. Returns next URL or signals audit_complete. Budget gate routes correctly on cumulative-cost threshold.
- **conformance:** AC-04

### T139 — AuditCompleteNode (cross-page PatternDetector folded)
- **dep:** T135, T130 (EvidenceGrounder produces grounded_findings)
- **spec:** REQ-ORCH-NODE-003 + REQ-CROSSPAGE-PATTERN-001 (F-014) + R15.2
- **files:**
  - `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts`
  - `packages/agent-core/src/analysis/cross-page/PatternDetector.ts` (NEW — folded per [plan.md §3](plan.md))
- **acceptance:**
  - Updates `audit_runs.status: completed | error | budget_exceeded`
  - Generates summary
  - Emits `session_completed` event
  - **Runs cross-page PatternDetector per F-014**: groups `state.grounded_findings` by `heuristic_id` (or `(heuristic_id, viewport)` when 5b active); ≥3 affected pages → emit one PatternFinding referencing all violators; PatternFinding rows persisted to `findings` table with `is_pattern: true`
  - Reports per-page `analysis_status` breakdown ("47/50 fully analyzed, 2 partially, 1 skipped") per R15.2
  - Audit_runs.total_cost_usd computed from `SUM(llm_call_log.cost_usd WHERE audit_run_id = ?)` (R14.4)
- **conformance:** AC-05

### T140 — routePageRouter edge
- **dep:** T138
- **spec:** REQ-ORCH-EDGE-001
- **files:** `packages/agent-core/src/orchestration/auditEdges.ts`
- **acceptance:** Routes browse vs audit_complete correctly. When next page exists → "browse"; when none + budget OK → "audit_complete"; when budget exhausted → "audit_complete" with `completion_reason: budget_exceeded`.
- **conformance:** AC-06

### T141 — routeAfterBrowse edge
- **dep:** T091 (Phase 5 BrowseGraph)
- **spec:** REQ-ORCH-EDGE-002
- **files:** `packages/agent-core/src/orchestration/auditEdges.ts`
- **acceptance:** Routes analyze vs page_router correctly. When browse succeeded → "analyze"; when browse error → "page_router" (skip page with `analysis_status: browse_failed`).
- **conformance:** AC-07

### T142 — routeAfterAnalyze edge
- **dep:** T133 (Phase 7 AnalysisGraph)
- **spec:** REQ-ORCH-EDGE-003
- **files:** `packages/agent-core/src/orchestration/auditEdges.ts`
- **acceptance:** Routes page_router vs audit_complete correctly. Always → "page_router" after analyze completes (R15.2 NEVER silently drops).
- **conformance:** AC-08

---

## Block B — Graph + Checkpointer + CLI + Reporters (Days 4-5)

### T143 — AuditGraph (compile with subgraphs)
- **dep:** T091 (Phase 5 BrowseGraph), T133 (Phase 7 AnalysisGraph), T137, T138, T139, T140-T142
- **spec:** REQ-ORCH-SUBGRAPH-001
- **files:** `packages/agent-core/src/orchestration/AuditGraph.ts`
- **smoke test:** Compile graph with browse + analyze as subgraphs.
- **acceptance:**
  - Outer graph contains BrowseGraph and AnalysisGraph as nodes
  - All edges connected per [plan.md §4](plan.md) topology
  - State flows correctly through subgraphs
  - ContextCaptureNode (Phase 4b) runs BEFORE AuditSetupNode
- **conformance:** AC-09

### T144 — PostgresCheckpointer
- **dep:** T070 (Phase 4 PG schema)
- **spec:** REQ-CHECKPOINT-001
- **files:** `packages/agent-core/src/orchestration/PostgresCheckpointer.ts`
- **smoke test:** Kill mid-audit, resume from checkpoint.
- **acceptance:** LangGraph PostgresCheckpointer integration (`PostgresSaver.fromConnString`); state recovers; `thread_id` = `audit_run_id`. NF-04: zero duplicate LLM calls between continuous run and resume run.
- **conformance:** AC-10

### T145 — CLI command `audit` [MOD v2.0]
- **dep:** T143, T003 (CLI skeleton)
- **spec:** §18 AuditRequest contract (REQ-TRIGGER-CONTRACT-001) + REQ-REPRO-031a
- **files:** `apps/cli/src/commands/audit.ts`
- **v2.0 changes (per tasks-v2.md):**
  - Original: parses flags, compiles AuditGraph, runs directly ✅
  - **NEW: constructs `AuditRequest`** from CLI flags (url, pages, budget, output, viewports per Phase 5b)
  - **NEW: writes `audit_requests` row** + `reproducibility_snapshots` row (MVP scaffold per [plan.md §5](plan.md)) before graph execution
  - **NEW: passes `AuditRequest` to graph** instead of raw params
  - Gateway is a thin pass-through for MVP CLI — no HTTP, no Temporal, direct function call
  - Supports `--resume <audit_run_id>` for PostgresCheckpointer resume
- **acceptance:** AuditRequest created. Snapshot written. Graph receives typed request. Exit code 0 on success.
- **conformance:** AC-11

### T146 — ConsoleReporter
- **dep:** T076 (StreamEmitter), T145
- **files:** `apps/cli/src/output/ConsoleReporter.ts`
- **acceptance:**
  - Subscribes to StreamEmitter events
  - Prints real-time progress (page N/M, current node, cost-so-far)
  - Final summary: pages completed, total findings, total cost, total duration
- **conformance:** AC-12

### T147 — JsonReporter
- **dep:** T145, T132 (StoreNode)
- **files:** `apps/cli/src/output/JsonReporter.ts`
- **acceptance:**
  - Generates `summary.json`, `findings.json`
  - Per-page folder `pages/{slug}/` with screenshots + page-level `findings.json`
  - Output structure matches PRD §F-005 expected layout
- **conformance:** AC-13

---

## Block C — ★★ MVP COMPLETE Acceptance (Days 6-8)

### T148 — ★★ ACCEPTANCE TEST — example.com [MOD v2.0]
- **dep:** T145, T146, T147 + Phase 0b 30-heuristic pack committed (T103/T104/T105)
- **smoke test:** `pnpm cro:audit --url https://example.com --pages 3 --output ./test-output`
- **v2.0 acceptance (per tasks-v2.md):**
  - ✅ Exit code 0
  - ✅ 3 pages crawled
  - ✅ At least 3 grounded findings total
  - ✅ At least 1 finding rejected by self-critique OR grounding
  - ✅ Output structure: `summary.json`, `findings.json`, `pages/*/`
  - ✅ Annotated screenshots have visible pins
  - ✅ Total cost < $5
  - ✅ Total time < 15 minutes
  - ✅ **[NEW v2.0] `reproducibility_snapshots` row exists** with temperature=0, model version pinned
  - ✅ **[NEW v2.0] findings have `business_impact`, `effort`, `priority` columns** populated (not null)
  - ✅ **[NEW v2.0] `published_findings` view** returns 0 rows (warm-up mode active, nothing auto-published)
  - ✅ **[NEW v2.0] `audit_requests` row** exists with `trigger_source: cli`
- **conformance:** AC-14 (MVP COMPLETE gate 1/3)

### T149 — ★★ ACCEPTANCE TEST — amazon.in [MOD v2.0]
- **dep:** T148
- **smoke test:** `pnpm cro:audit --url https://amazon.in --pages 3 --output ./test-amazon`
- **v2.0 acceptance:**
  - Same as T148 v2.0 acceptance plus:
  - Handles anti-bot gracefully (escalate or successfully extract)
  - Findings produced for at least 1 page
- **degraded acceptance (per plan.md §7 kill criteria):** if anti-bot fully blocks all 3 pages, partial pass acceptable — full pass deferred to v1.1 stealth plugin.
- **conformance:** AC-15 (MVP COMPLETE gate 2/3)

### T150 — ★★ ACCEPTANCE TEST — bbc.com [MOD v2.0]
- **dep:** T148
- **smoke test:** `pnpm cro:audit --url https://bbc.com --pages 3 --output ./test-bbc`
- **v2.0 acceptance:**
  - Same as T148 v2.0 acceptance
  - 3 pages successfully audited with findings
- **conformance:** AC-16 (MVP COMPLETE gate 3/3)

### T151-T155 — Reserved for fixes from acceptance testing
- **dep:** T148, T149, T150 outcomes
- **acceptance:** Caught by failing T148/T149/T150 — fixes are typically Phase 5/6/7 surface bugs caught by integration; allocate 5 reserve slots; if all 5 consumed, ESCALATE per plan.md §7 kill criteria.
- **conformance:** AC-20 (manual review post-T148-T150)

---

## ★ MVP COMPLETE ★

The MVP is **DONE** when AC-14 (T148) + AC-15 (T149) + AC-16 (T150) all green = AC-21 satisfied.

This validates:

1. ✅ Browse mode works on real sites
2. ✅ Analysis pipeline produces grounded findings
3. ✅ Audit orchestrator wires browse + analyze correctly
4. ✅ Heuristics filter and inject correctly (2-stage)
5. ✅ Self-critique catches false positives (R5.6)
6. ✅ Evidence grounding catches hallucinations (R5.1 + GR-001..GR-008 + GR-012)
7. ✅ Annotated screenshots render correctly (Sharp)
8. ✅ Database persistence works (findings + rejected_findings + audit_log + audit_events + llm_call_log)
9. ✅ Cost stays under budget (R8.1 + R8.2 + R14.1 + R14.4)
10. ✅ End-to-end CLI experience works
11. ✅ Reproducibility snapshot persisted (F-015 foundation; full replay verification in NF-005)
12. ✅ Cross-page patterns detected (F-014)
13. ✅ Warm-up mode active (F-016)
14. ✅ R10 TemperatureGuard active (Phase 7 first-runtime; verified end-to-end here)
15. ✅ R6 LangSmith trace channel active (Phase 7 first-runtime; verified end-to-end here)
16. ✅ analysis_status taxonomy complete (R15.2)

---

## Phase 8 "Done" definition

All 21 tasks merged AND all of:
- ✅ AC-14 (T148 example.com) green
- ✅ AC-15 (T149 amazon.in) green (or degraded-acceptance per plan.md §7)
- ✅ AC-16 (T150 bbc.com) green
- ✅ AuditState conformance test (AC-01) green — coordination with Phase 4b/Phase 7 verified
- ✅ PostgresCheckpointer resume test (AC-10) green
- ✅ Cost attribution test (AC-18) green — `audit_runs.total_cost_usd` matches `llm_call_log` sum
- ✅ Cross-page PatternDetector test (AC-05 / SC-007) green
- ✅ Reproducibility test (SC-009) green — replay 24h later, finding overlap ≥ 90%
- ✅ Phase 8 status: `verified`
- ✅ `phase-8-current.md` rollup committed (Constitution R19) before Phase 9 begins

★ MVP COMPLETE ★ = AC-14 + AC-15 + AC-16 = AC-21 (Phase 8 EXIT GATE).
