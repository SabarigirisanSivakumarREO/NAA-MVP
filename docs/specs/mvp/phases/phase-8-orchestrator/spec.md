---
title: Phase 8 — Audit Orchestrator + Cross-Page
artifact_type: spec
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
  - docs/specs/mvp/PRD.md (F-001 audit, F-009 confidence + warm-up, F-014 cross-page pattern detection, F-015 reproducibility snapshot, F-016 two-store + warm-up, F-021 cost accounting)
  - docs/specs/mvp/constitution.md (R7.4 append-only; R8.1 $15 audit cap; R14 cost; R15 quality gates; R20 impact; R23 kill criteria)
  - docs/specs/mvp/architecture.md §6.4, §6.5
  - docs/specs/mvp/tasks-v2.md (Phase 8 section — T135 / T137 / T138 / T145 / T148-T150 MOD v2.0/v2.1)
  - docs/specs/final-architecture/04-orchestration.md (audit graph)
  - docs/specs/final-architecture/05-unified-state.md (AuditState schema + §5.7 extensions)
  - docs/specs/final-architecture/07-analyze-mode.md §7.13 (PageSignals emit + cross-page integration)
  - docs/specs/final-architecture/13-data-layer.md (audit_runs, findings, rejected_findings, audit_log, audit_events, llm_call_log)
  - docs/specs/final-architecture/16-implementation-phases.md (Phase 8 artifact table)
  - docs/specs/final-architecture/18-trigger-gateway.md (AuditRequest contract)
  - docs/specs/final-architecture/25-reproducibility.md (snapshot composition + replay)
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md (T4B-011 AuditState slot prereq)
  - docs/specs/mvp/phases/phase-7-analysis/spec.md (AnalysisGraph + Finding lifecycle producer)
  - docs/specs/mvp/phases/phase-5-browse-mvp/spec.md (BrowseGraph baseline)
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/spec.md (multi-bundle iteration semantics when active)

req_ids:
  - REQ-ORCH-NODE-001               # AuditSetupNode
  - REQ-ORCH-NODE-002               # PageRouterNode
  - REQ-ORCH-NODE-003               # AuditCompleteNode
  - REQ-ORCH-EDGE-001               # routePageRouter
  - REQ-ORCH-EDGE-002               # routeAfterBrowse
  - REQ-ORCH-EDGE-003               # routeAfterAnalyze
  - REQ-ORCH-SUBGRAPH-001           # AuditGraph subgraph composition
  - REQ-STATE-001                   # AuditState base
  - REQ-STATE-EXT-COMPAT-001        # §5.7 extensions backward-compat
  - REQ-CROSSPAGE-PATTERN-001       # PatternDetector (PRD F-014)
  - REQ-REPRO-031a                  # reproducibility_snapshot read at AuditSetupNode
  - REQ-TRIGGER-PERSIST-003         # AuditRequest persistence
  - REQ-CHECKPOINT-001              # PostgresCheckpointer
  - REQ-COST-LOG-001                # R14.1 atomic llm_call_log (Phase 7 produces; Phase 8 audit-level summary consumes)
  - REQ-COST-BUDGET-001             # R14.2 pre-call BudgetGate (audit-level $15 cap)

impact_analysis: docs/specs/mvp/phases/phase-8-orchestrator/impact.md
breaking: false
affected_contracts:
  - AuditState (PRODUCER + CONSUMER — extends with §5.7 fields + context_profile_id/hash slots)
  - AuditPage (PRODUCER — NEW; page queue entry type)
  - AuditRequest (CONSUMER — gateway/CLI produces; AuditSetupNode reads)
  - reproducibility_snapshot (CONSUMER — read at AuditSetupNode; creation is Phase 9 T160 / Gateway)
  - audit_runs (PRODUCER — gateway/CLI creates; Phase 8 advances state)
  - PatternFinding (PRODUCER — NEW; per F-014; emitted by AuditCompleteNode at audit close)
  - PageSignals (CONSUMER — read from Phase 7 emission per §7.13)
  - LangGraph checkpointer state (PRODUCER — PostgresCheckpointer integration)

delta:
  new:
    - Phase 8 spec — orchestrator + cross-page; MVP COMPLETE gate at T148-T150
    - AC-01..AC-21 stable IDs for T135..T155 acceptance
    - R-01..R-13 functional requirements
    - Cross-page PatternDetector folded into T139 AuditCompleteNode per F-014 (no new discrete T-ID)
    - AuditState extension coordinated with Phase 4b T4B-011 (context_profile_id/hash) + Phase 7 T113 (analyze fields)
  changed: []
  impacted:
    - Phase 4b T4B-011 — AuditState slot reservation honored by T135
    - Phase 7 T113 — analyze fields extension; T135 incorporates
    - Phase 9 — consumes Findings + audit_runs.completion state for delivery layer
  unchanged:
    - Phase 5 BrowseGraph subgraph contract
    - Phase 7 AnalysisGraph subgraph contract
    - LLMAdapter / TemperatureGuard (Phase 8 emits no LLM calls)

governing_rules:
  - Constitution R7.4 (append-only audit_log / audit_events / findings / rejected_findings / llm_call_log)
  - Constitution R8.1 (audit budget cap $15) + R8.2 (per-page $5) — Phase 8 enforces audit-level via gateway snapshot
  - Constitution R14.1 (atomic llm_call_log writes — Phase 7 producer; Phase 8 audit summary consumer)
  - Constitution R15.2 (every page gets analysis_status; audit NEVER silently drops a page — Phase 8 reports breakdown)
  - Constitution R17, R18, R20, R23
---

# Feature Specification: Phase 8 — Audit Orchestrator + Cross-Page

> **Summary (~150 tokens — agent reads this first):** Wire BrowseGraph (Phase 5/5b) + AnalysisGraph (Phase 7) into a single LangGraph AuditGraph using subgraph composition. **21 tasks (T135-T155).** AuditState (T135) extends Phase 4b T4B-011 + Phase 7 T113 with §5.7 v2.0 fields (`trigger_source`, `audit_request_id`, `state_graph`, `multi_state_perception`, `current_state_id`, `exploration_*`, `finding_rollups`, `reproducibility_snapshot`, `published_finding_ids`, `warmup_mode_active`) + `context_profile_id` / `context_profile_hash` slots. AuditSetupNode (T137) reads `reproducibility_snapshot` + AuditRequest from DB; runs Stage 1 heuristic filter (`filterByBusinessType`); sets `warmup_mode_active` from client profile. PageRouterNode (T138) runs Stage 2 filter per page (`filterByPageType`) — caps at 30. AuditCompleteNode (T139) folds in **cross-page PatternDetector** per F-014 (groups grounded findings by `heuristic_id`; 3+ pages violating same heuristic → one PatternFinding). PostgresCheckpointer (T144) persists state for resumable audits. CLI (T145) constructs AuditRequest + writes snapshot. **MVP COMPLETE gate:** T148 (example.com) + T149 (amazon.in) + T150 (bbc.com) acceptance tests pass.

**Feature Branch:** `phase-8-orchestrator` (created at implementation time)
**Input:** Phase 8 scope from `INDEX.md` row 8 + `tasks-v2.md` Phase 8 section + `final-architecture/04-orchestration.md` + `05-unified-state.md` §5.7

---

## Mandatory References

When reading this spec, agents must already have loaded:

1. `docs/specs/mvp/constitution.md` — **R7.4** (append-only); **R8.1 + R8.2** (audit + page budget caps); **R14.1** (atomic llm_call_log writes); **R15.2** (analysis_status taxonomy — audit NEVER silently drops a page); **R20** (impact); **R23** (kill criteria).
2. `docs/specs/mvp/PRD.md` §F-001 (audit), §F-009 (confidence + warm-up), §F-014 (cross-page pattern detection), §F-015 (reproducibility snapshot), §F-016 (two-store + warm-up mode), §F-021 (cost accounting).
3. `docs/specs/final-architecture/04-orchestration.md` — outer audit graph + 3 routing edges.
4. `docs/specs/final-architecture/05-unified-state.md` — AuditState schema + §5.7 v2.0 extensions (trigger_source, audit_request_id, state_graph, multi_state_perception, exploration_*, finding_rollups, reproducibility_snapshot, published_finding_ids, warmup_mode_active) + §5.4 + §5.7.3 invariants.
5. `docs/specs/final-architecture/07-analyze-mode.md` §7.13 — PageSignals emit at page completion + cross-page integration handoff.
6. `docs/specs/final-architecture/18-trigger-gateway.md` — AuditRequest contract (REQ-TRIGGER-CONTRACT-001 / REQ-TRIGGER-PERSIST-003).
7. `docs/specs/final-architecture/25-reproducibility.md` — snapshot composition + load + replay (REQ-REPRO-031..034).
8. Predecessor phase rollups (load AFTER they exist):
   - `phase-5-browse-mvp/phase-5-current.md`
   - `phase-5b-multi-viewport-triggers-cookie/phase-5b-current.md` (when 5b active)
   - `phase-7-analysis/phase-7-current.md`
   - `phase-4b-context-capture/phase-4b-current.md`
   - `phase-6-heuristics/phase-6-current.md`

---

## Constraints Inherited from Neural Canonical Specs

- **R8.1 audit budget cap $15.** Audit hard cap; when exhausted, audit terminates with `completion_reason: budget_exceeded`. Pre-page budget check at PageRouterNode skips remaining pages if cumulative cost approaches cap.
- **R8.2 per-page cap $5.** Phase 7 enforces per-page; Phase 8 surfaces audit-level summary across all pages.
- **R14.1 atomic llm_call_log writes.** Phase 7 produces rows; Phase 8 AuditCompleteNode aggregates for `audit_runs.total_cost_usd` summary.
- **R15.2 analysis_status taxonomy.** Every page MUST end with non-null `analysis_status`. Audit NEVER silently drops a page. AuditCompleteNode reports breakdown ("47/50 pages fully analyzed, 2 partially analyzed, 1 skipped").
- **R7.4 append-only tables.** `audit_log`, `audit_events`, `llm_call_log`, `findings`, `rejected_findings`. Phase 8 produces audit_log + audit_events rows; Phase 7 already produces findings/rejected_findings/llm_call_log.
- **F-015 reproducibility snapshot read-only at Phase 8.** AuditSetupNode reads the snapshot from `reproducibility_snapshots` table (created by gateway/CLI in Phase 9 T160 OR by T145 CLI scaffold for MVP). Phase 8 honors temp=0 + heuristic_pack_hash + ContextProfile_hash invariants by passing them through to Phase 7.
- **F-014 cross-page pattern detection.** Deterministic — NOT LLM. Groups `grounded_findings` by `heuristic_id` across all pages in the audit; ≥3 pages violating same heuristic → one `PatternFinding` referencing all affected pages.
- **F-016 two-store + warm-up mode.** Phase 8 sets `warmup_mode_active` on AuditState from client profile; Phase 7 already produced findings with `publish_status: held` by default. Audit completion does NOT auto-publish; Phase 9 dashboard owns publish.
- **Multi-bundle (5b active).** When `viewports = ["desktop", "mobile"]`, Phase 5b emits 2 PerceptionBundles per page; Phase 7 emits viewport-tagged findings; Phase 8 cross-page PatternDetector groups by `heuristic_id` AND can optionally group by `viewport` (mobile-only patterns surface as separate PatternFindings from desktop-only patterns).
- **No new external deps.** LangGraph + Drizzle + Hono already required from Phase 4. Phase 8 is pure orchestration code.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Consultant runs full 3-page audit via CLI (Priority: P1)

A consultant runs `pnpm cro:audit --url https://example.com --pages 3 --output ./test-output`. The CLI constructs an `AuditRequest`, writes `audit_requests` + `reproducibility_snapshots` rows, compiles AuditGraph, and runs. Phase 8 orchestrates: AuditSetupNode loads the snapshot + Stage 1 heuristic filter (~30 → ~20 ecommerce-relevant) → PageRouterNode picks page 1 + Stage 2 filter (~20 → ~15 homepage-relevant) → BrowseGraph runs → AnalysisGraph runs → PageRouterNode picks page 2 → … → AuditCompleteNode runs cross-page PatternDetector + writes audit_runs status + emits session_completed event. ConsoleReporter prints real-time progress; JsonReporter writes summary.json + findings.json + per-page screenshots. Total cost <$5; total time <15 minutes.

**Why this priority:** This is the canonical happy path AND the **MVP COMPLETE gate** (T148 acceptance test). Without it MVP is not shippable.
**Independent Test:** Run `pnpm cro:audit --url https://example.com --pages 3 --output ./test-output`; assert exit code 0; assert summary.json + findings.json + pages/* structure; assert ≥3 grounded findings; assert ≥1 finding rejected by self-critique OR grounding; assert total cost <$5; assert annotated screenshots have visible pins.

**Acceptance Scenarios:**

1. **Given** AuditRequest with `url=https://example.com, pages=3`, **When** CLI runs, **Then** exit code 0, `audit_runs.completion_reason: completed`, output structure matches spec.
2. **Given** the audit, **When** AuditCompleteNode runs, **Then** `cross_page_patterns[]` populated if any heuristic_id violated on ≥3 pages; otherwise empty.
3. **Given** the audit, **When** ConsoleReporter prints, **Then** real-time progress + final summary (pages, findings, cost, duration) visible.
4. **Given** the audit, **When** JsonReporter writes, **Then** summary.json + findings.json + `pages/{slug}/{viewport-annotated.jpg, fullpage-annotated.jpg, findings.json}` per page.

---

### User Story 2 — Audit halts cleanly when budget exhausts (Priority: P1)

A consultant runs `pnpm cro:audit --url https://expensive-site.com --pages 50 --budget 15`. Mid-audit at page 25, cumulative cost reaches $14.50. PageRouterNode budget check sees $0.50 remaining < estimated $1 next-page cost; routes to AuditCompleteNode. Audit terminates with `completion_reason: budget_exceeded`; `audit_runs.pages_completed: 24`; `audit_runs.pages_skipped: 26`; per-page `analysis_status: budget_exhausted_skipped` for pages 25-50. ConsoleReporter prints "Budget exhausted at page 25; 26 pages skipped." Audit_complete still produces a partial cross-page pattern detection over the 24 completed pages.

**Why this priority:** Constitutional invariant R8.1; consultants need predictable cost behavior. Without clean halt, audits can silently exceed budget.
**Independent Test:** Mock LLM cost to $1/page; run audit with budget $5; assert audit halts at page ~5; assert `completion_reason: budget_exceeded`; assert `audit_runs.total_cost_usd ≤ 15`.

**Acceptance Scenarios:**

1. **Given** AuditRequest budget $15, **When** cumulative cost reaches budget cap, **Then** PageRouterNode routes to AuditCompleteNode with `completion_reason: budget_exceeded`.
2. **Given** the budget exhaust, **When** AuditCompleteNode runs, **Then** skipped pages get `analysis_status: budget_exhausted_skipped`; cross-page PatternDetector runs over completed pages only.
3. **Given** budget exhaust, **When** ConsoleReporter prints, **Then** clear "Budget exhausted at page N; M pages skipped" message.

---

### User Story 3 — Resumable audit via PostgresCheckpointer (Priority: P2)

An audit is mid-run (page 12 of 50) when the process is killed (server restart, network timeout). On restart, the consultant runs `pnpm cro:audit --resume <audit_run_id>`. PostgresCheckpointer loads the LangGraph state from DB; AuditGraph resumes at the next node (most likely PageRouterNode for page 13); audit completes normally. No duplicate work; no duplicate LLM cost.

**Why this priority:** F-021 cost discipline + audit reliability. Loss of mid-audit progress would inflate cost. P2 because MVP audits are <15 min so failures are rare; still required for production reliability.
**Independent Test:** Kill mid-audit at page 5; resume; assert audit completes with no duplicate findings (each finding's heuristic_id × page combination unique).

**Acceptance Scenarios:**

1. **Given** a mid-audit kill at page 5, **When** consultant runs `--resume <id>`, **Then** PostgresCheckpointer loads state; AuditGraph resumes at page 6.
2. **Given** the resumed audit, **When** it completes, **Then** total LLM cost = original-projected cost (no duplicate calls); findings table has no duplicate (heuristic_id, page_url) rows.

---

### User Story 4 — Cross-page PatternDetector surfaces systemic issues (Priority: P1)

A consultant runs an audit on an e-commerce site with 10 pages. 6 of 10 pages violate `BAY-CTA-VISIBILITY-001` ("primary CTA below fold"). AuditCompleteNode's cross-page PatternDetector groups grounded findings by `heuristic_id`; sees 6 ≥ 3 threshold; emits ONE `PatternFinding` referencing all 6 affected pages. Per-page findings ALSO remain (so consultant can drill into each page). The pattern surfaces the systemic issue.

**Why this priority:** F-014 explicit MVP scope; consultant value-add — systemic patterns are higher-leverage to fix than per-page findings.
**Independent Test:** Run audit on a fixture with 6 pages all violating same heuristic; assert exactly 1 PatternFinding emitted; assert PatternFinding.affected_pages.length === 6.

**Acceptance Scenarios:**

1. **Given** ≥3 pages violating same heuristic_id, **When** AuditCompleteNode runs PatternDetector, **Then** ONE PatternFinding emitted per heuristic_id with `affected_pages[]` listing all violators.
2. **Given** all heuristics violated by ≤2 pages each, **When** PatternDetector runs, **Then** zero PatternFindings emitted; per-page findings preserved.
3. **Given** multi-bundle (5b active) with desktop-only and mobile-only patterns, **When** PatternDetector runs, **Then** patterns optionally grouped by viewport — desktop-only PatternFinding distinct from mobile-only PatternFinding.

---

### Edge Cases

- **AuditRequest missing `primary_kpi`** → AuditSetupNode rejects with clear error per Phase 4b T4B-009 validation.
- **Reproducibility snapshot missing in DB** → AuditSetupNode fails audit with `completion_reason: snapshot_missing` (per tasks-v2.md T137 v2.0 mod).
- **Audit_runs row already exists with different snapshot** (replay scenario) → AuditSetupNode loads existing snapshot; replay path validates pinned hashes match.
- **All pages skip due to perception quality** → AuditCompleteNode runs with empty `grounded_findings`; emits audit_complete event with `total_findings: 0`; consultant sees a clean "no findings" report (not a crash).
- **PostgresCheckpointer DB unreachable** → AuditGraph falls back to in-memory checkpointing for that run; on next resume attempt, fails cleanly with `completion_reason: checkpoint_unavailable`.
- **AuditRequest references nonexistent client_id** → AuditSetupNode fails with `completion_reason: client_not_found`.
- **Concurrent audits for same client** → multi-tenant Phase 8 supports parallel via `app.client_id` session var (R7.2 RLS); LangGraph state isolated per audit_run_id.
- **Cross-page PatternDetector on 1-page audit** → no patterns possible; emits zero PatternFindings; not an error.
- **F-014 threshold of 3 pages — what about 2/2 split (50% violation rate)?** → Per F-014 strict 3-page minimum; future v1.1 may add percentage threshold. Documented in spec.
- **Phase 5b multi-viewport active — desktop bundle skipped (perception quality), mobile completes** → page's analysis_status is per-bundle; cross-page PatternDetector groups across pages × viewports independently.

---

## Acceptance Criteria *(mandatory — stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked REQ-ID(s) |
|----|-----------|----------------------|------------------|
| AC-01 | T135 AuditState (full schema) extends Phase 7 T113 + Phase 4b T4B-011 with §5.7 v2.0 fields (`trigger_source`, `audit_request_id`, `state_graph`, `multi_state_perception`, `current_state_id`, `exploration_cost_usd`, `exploration_budget_usd`, `exploration_pass_2_triggered`, `finding_rollups`, `reproducibility_snapshot`, `published_finding_ids`, `warmup_mode_active`) + `context_profile_id` + `context_profile_hash` slots; all defaults; serializes to JSON for checkpointing; invariants validated per §5.4 + §5.7.3. | `packages/agent-core/tests/conformance/audit-state-full.test.ts` | REQ-STATE-001, REQ-STATE-EXT-COMPAT-001 |
| AC-02 | T136 AuditPage type with `status: pending | running | completed | skipped | error` enum; queue helpers `nextPage(state)`, `markCompleted(state, url)`, `markSkipped(state, url, reason)`. | `packages/agent-core/tests/conformance/audit-page.test.ts` | — |
| AC-03 | T137 AuditSetupNode (MOD v2.0) loads or creates client; reads `reproducibility_snapshot` from DB (fail with `snapshot_missing` if absent); reads `AuditRequest` from `audit_requests` table; sets `trigger_source` + `audit_request_id` + `warmup_mode_active`; calls `filterByBusinessType` (Stage 1) — reduces full pack ~30 → ~20-25; stores filtered set in `state.heuristic_knowledge_base`; creates `audit_runs` row. | `packages/agent-core/tests/conformance/audit-setup-node.test.ts` | REQ-ORCH-NODE-001, REQ-REPRO-031a, REQ-TRIGGER-PERSIST-003 |
| AC-04 | T138 PageRouterNode (MOD v2.1) returns next URL or signals audit_complete; calls `filterByPageType` (Stage 2) per page on `state.heuristic_knowledge_base` (Stage 1 output); applies `prioritizeHeuristics(filtered, 30)` cap; stores in `state.filtered_heuristics`. | `packages/agent-core/tests/conformance/page-router-node.test.ts` | REQ-ORCH-NODE-002, REQ-HK-020b |
| AC-05 | T139 AuditCompleteNode updates `audit_runs.status: completed | error | budget_exceeded`; generates summary; emits `session_completed` event; **runs cross-page PatternDetector** per F-014 (groups grounded findings by heuristic_id; ≥3 affected pages → emit one PatternFinding); per-page `analysis_status` breakdown reported (R15.2). | `packages/agent-core/tests/conformance/audit-complete-node.test.ts` | REQ-ORCH-NODE-003, REQ-CROSSPAGE-PATTERN-001, R15.2 |
| AC-06 | T140 routePageRouter edge: when next page exists → "browse"; when none + budget OK → "audit_complete"; when budget exhausted → "audit_complete" with `completion_reason: budget_exceeded`. | `packages/agent-core/tests/conformance/route-page-router.test.ts` | REQ-ORCH-EDGE-001 |
| AC-07 | T141 routeAfterBrowse edge: when browse succeeded → "analyze"; when browse error → "page_router" (skip to next page with `analysis_status: browse_failed`). | `packages/agent-core/tests/conformance/route-after-browse.test.ts` | REQ-ORCH-EDGE-002 |
| AC-08 | T142 routeAfterAnalyze edge: always → "page_router" after analyze completes (whether grounded findings produced or not — R15.2 NEVER silently drops). | `packages/agent-core/tests/conformance/route-after-analyze.test.ts` | REQ-ORCH-EDGE-003 |
| AC-09 | T143 AuditGraph compiles BrowseGraph + AnalysisGraph as subgraphs; outer graph contains audit_setup → page_router → browse_subgraph → analyze_subgraph → page_router → … → audit_complete; all edges connected per §04. | `packages/agent-core/tests/conformance/audit-graph.test.ts` | REQ-ORCH-SUBGRAPH-001 |
| AC-10 | T144 PostgresCheckpointer integrates LangGraph PostgresCheckpointer; kill mid-audit → resume from checkpoint → state recovers; no duplicate LLM calls (verified by `llm_call_log` row count). | `packages/agent-core/tests/integration/checkpointer-resume.test.ts` | REQ-CHECKPOINT-001 |
| AC-11 | T145 CLI command `audit` (MOD v2.0) parses --url / --pages / --budget / --output / --resume flags; constructs `AuditRequest` from flags; writes `audit_requests` row + `reproducibility_snapshots` row before graph execution; passes AuditRequest to graph. | `apps/cli/tests/conformance/audit-command.test.ts` | REQ-TRIGGER-CONTRACT-001, REQ-REPRO-031a |
| AC-12 | T146 ConsoleReporter subscribes to StreamEmitter events; prints real-time progress (page N/M, current node, cost-so-far); final summary (pages completed, total findings, total cost, total duration). | `apps/cli/tests/conformance/console-reporter.test.ts` | — |
| AC-13 | T147 JsonReporter generates `summary.json` + `findings.json` + per-page folder `pages/{slug}/{viewport-annotated.jpg, fullpage-annotated.jpg, findings.json}`; output structure matches PRD §F-005 expected layout. | `apps/cli/tests/conformance/json-reporter.test.ts` | F-005 |
| AC-14 | T148 ★★ ACCEPTANCE TEST — `pnpm cro:audit --url https://example.com --pages 3 --output ./test-output`: exit code 0, 3 pages crawled, ≥3 grounded findings, ≥1 rejected by self-critique OR grounding, output structure complete, annotated screenshots have visible pins, total cost <$5, total time <15 min, **NEW v2.0:** `reproducibility_snapshots` row exists with temp=0 + model version pinned, findings have `business_impact + effort + priority` populated, `published_findings` view returns 0 rows (warm-up active), `audit_requests` row exists with `trigger_source: cli`. | `tests/acceptance/example-com.test.ts` | (MVP COMPLETE gate 1/3) |
| AC-15 | T149 ★★ ACCEPTANCE TEST — `pnpm cro:audit --url https://amazon.in --pages 3 --output ./test-amazon`: handles anti-bot gracefully (escalate or successfully extract); findings produced for ≥1 page; **NEW v2.0:** snapshot + warm-up + AuditRequest persisted. | `tests/acceptance/amazon-in.test.ts` | (MVP COMPLETE gate 2/3) |
| AC-16 | T150 ★★ ACCEPTANCE TEST — `pnpm cro:audit --url https://bbc.com --pages 3 --output ./test-bbc`: 3 pages successfully audited with findings; **NEW v2.0:** snapshot + warm-up + AuditRequest persisted. | `tests/acceptance/bbc-com.test.ts` | (MVP COMPLETE gate 3/3) |
| AC-17 | Per-page analysis_status taxonomy is exhaustive — every page in any audit ends with one of: `complete`, `partial_quality`, `partial_budget`, `skipped_perception_quality_low`, `skipped_empty_perception`, `skipped_llm_output_invalid`, `budget_exhausted_skipped`, `browse_failed`, `error_db_unavailable`. AuditCompleteNode summary includes breakdown ("47/50 fully analyzed, 2 partially, 1 skipped"). | `packages/agent-core/tests/conformance/analysis-status-taxonomy.test.ts` | R15.2 |
| AC-18 | Audit_runs.total_cost_usd matches sum of `llm_call_log.cost_usd WHERE audit_run_id = ?` (R14.1 atomic logging end-to-end check). | `packages/agent-core/tests/integration/cost-attribution.test.ts` | R14.1, R14.4 |
| AC-19 | When `viewports = ["desktop", "mobile"]` (Phase 5b active), AuditGraph produces per-page-per-viewport findings; cross-page PatternDetector groups by `(heuristic_id, viewport)`; produces viewport-tagged PatternFindings. | `tests/integration/multi-viewport-audit.test.ts` | (Phase 5b coordinate) |
| AC-20 | T151-T155 reserved for fixes from acceptance testing — no upfront acceptance criteria (caught by T148-T150 failures). | manual review post-T148-T150 | — |
| AC-21 | Phase 8 EXIT GATE = AC-14 (T148) + AC-15 (T149) + AC-16 (T150) all green = **MVP COMPLETE**. | end-to-end acceptance suite | — |

---

## Functional Requirements *(mandatory — cross-ref existing PRD F-IDs where applicable)*

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | AuditState (T135) SHALL extend the AuditState foundation (Phase 5 base + Phase 7 T113 analyze fields + Phase 4b T4B-011 context_profile_id/hash slots) with §5.7 v2.0 fields per `final-architecture/05-unified-state.md`. All new fields SHALL have defaults so existing Phase 1-5 code is unaffected (REQ-STATE-EXT-COMPAT-001). | F-001, F-014, F-015, F-016 | §05 §5.7 |
| R-02 | AuditSetupNode (T137) SHALL read the `reproducibility_snapshot` row by `audit_run_id` from DB; fail audit with `completion_reason: snapshot_missing` if absent. SHALL read `AuditRequest` from `audit_requests` table to populate `trigger_source` + `audit_request_id`. SHALL set `warmup_mode_active` from client profile. | F-015, F-016 | §04, §25 REQ-REPRO-031a |
| R-03 | AuditSetupNode SHALL run **Stage 1 heuristic filter** (`filterByBusinessType(allHeuristics, business_type)`) per §9.6 REQ-HK-020a; store the reduced set in `state.heuristic_knowledge_base` (~30 → ~20-25). | F-012 | §09 §9.6 |
| R-04 | PageRouterNode (T138) SHALL run **Stage 2 heuristic filter** (`filterByPageType(state.heuristic_knowledge_base, currentPageType)`) per §9.6 REQ-HK-020b; apply `prioritizeHeuristics(filtered, 30)` cap; store in `state.filtered_heuristics`. | F-012 | §09 §9.6 |
| R-05 | PageRouterNode SHALL check audit-level budget (R8.1) before each page; if `cumulative_cost + estimated_next_page_cost > budget`, route to AuditCompleteNode with `completion_reason: budget_exceeded`. Skipped pages get `analysis_status: budget_exhausted_skipped`. | F-021 | R8.1 |
| R-06 | AuditCompleteNode (T139) SHALL run **deterministic cross-page PatternDetector** per F-014: group `state.grounded_findings` by `heuristic_id` across all pages; ≥3 affected pages → emit one `PatternFinding` referencing all violators. PatternFindings persisted to `findings` table with `is_pattern: true` flag (or separate column per data layer). | F-014 | §07 §7.13, §13 |
| R-07 | AuditCompleteNode SHALL update `audit_runs.status: completed | error | budget_exceeded`; emit `session_completed` event; report per-page `analysis_status` breakdown ("47/50 fully analyzed, 2 partially, 1 skipped") per R15.2. | F-001 | R15.2 |
| R-08 | AuditGraph (T143) SHALL compile BrowseGraph (Phase 5/5b) + AnalysisGraph (Phase 7) as LangGraph subgraphs; outer graph: `audit_setup → page_router → browse_subgraph → analyze_subgraph → page_router → … → audit_complete`. Three routing edges per REQ-ORCH-EDGE-001..003. | F-001 | §04 |
| R-09 | PostgresCheckpointer (T144) SHALL integrate LangGraph's PostgresCheckpointer; state persists per LangGraph turn; kill mid-audit → resume via `--resume <audit_run_id>` → no duplicate LLM calls. | F-021 | (LangGraph upstream) |
| R-10 | CLI command `audit` (T145, MOD v2.0) SHALL: parse flags; construct `AuditRequest` from flags (target, pages, budget, output, viewports per Phase 5b); write `audit_requests` row + `reproducibility_snapshots` row BEFORE graph execution; compile + run AuditGraph. For MVP, gateway is a thin pass-through (no HTTP, no Temporal — direct function call). | F-001, F-015 | §18 REQ-TRIGGER-CONTRACT-001 |
| R-11 | ConsoleReporter (T146) SHALL subscribe to StreamEmitter events; print real-time progress + final summary. JsonReporter (T147) SHALL produce `summary.json` + `findings.json` + per-page folders matching PRD §F-005 expected layout. | F-005 | F-005 |
| R-12 | Audit_runs.total_cost_usd SHALL equal sum of `llm_call_log.cost_usd WHERE audit_run_id = ?` per R14.1 + R14.4. Conformance test verifies end-to-end cost attribution. | F-021 | R14.1, R14.4 |
| R-13 | When Phase 5b multi-viewport is active, AuditGraph SHALL coordinate per-viewport findings end-to-end; cross-page PatternDetector SHALL group by `(heuristic_id, viewport)` to produce viewport-tagged PatternFindings; downstream Phase 9 deliveries surface viewport-tagged patterns to consultant. | F-014, F-005 | Phase 5b spec |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-01 | T148 (example.com) total wall-clock | <15 min | NF-005 | Acceptance test timer |
| NF-02 | T148 total cost | <$5 | NF-002 | `audit_runs.total_cost_usd` after T148 |
| NF-03 | Phase 8 audit-level budget cap enforcement | $15 hard cap (R8.1) | NF-002 | mocked-cost test runs audit to budget; asserts halt |
| NF-04 | PostgresCheckpointer resume — no duplicate LLM calls | 0 duplicate `(audit_run_id, page_url, node_name)` rows in `llm_call_log` | NF-006 | conformance test |
| NF-05 | Cross-page PatternDetector wall-clock on 50-page audit | <3s | — | unit test with mock 50-page state |
| NF-06 | Reproducibility — same AuditRequest + same snapshot → ≥90% finding ID overlap | 90% within 24h (F-015) | NF-006 | Replay test on T148 fixture |

---

## Key Entities

- **AuditState (full schema):** Phase 5 base + Phase 7 T113 analyze fields + Phase 4b T4B-011 `context_profile_id` + `context_profile_hash` slots + §5.7 v2.0 fields. Zod-validated; serializes to JSON for checkpointer.
- **AuditPage:** Per-page queue entry; `{url, page_index, status: pending|running|completed|skipped|error, page_type?, analysis_status?, viewport_tags[]?}`.
- **AuditRequest:** Phase 4b extended intake schema (per §18.4); read by AuditSetupNode at audit start.
- **PatternFinding:** **NEW** producer contract per F-014. `{pattern_id, heuristic_id, severity, affected_pages[], affected_count, recommendation, confidence_tier}`. Persisted to `findings` table with `is_pattern: true` flag.
- **ReproducibilitySnapshot:** Read at AuditSetupNode (REQ-REPRO-031a); pins model + prompt hashes + heuristic_pack_hash + ContextProfile_hash + temperature_invariant. Phase 9 T160 owns creation.
- **AuditGraph:** LangGraph state graph composing BrowseGraph + AnalysisGraph as subgraphs.
- **PostgresCheckpointer:** LangGraph PostgresCheckpointer integration; per-turn state persistence.
- **PageSignals:** **CONSUMER** — read from Phase 7's per-page emission per §7.13; AuditCompleteNode's PatternDetector consumes the aggregated set.

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** T148 (example.com) acceptance test passes: 3 pages, ≥3 grounded findings, ≥1 rejected, output structure complete, cost <$5, time <15 min, snapshot persisted, AuditRequest persisted.
- **SC-002:** T149 (amazon.in) acceptance test passes: anti-bot handled, ≥1 page yields findings.
- **SC-003:** T150 (bbc.com) acceptance test passes: 3 pages successfully audited.
- **SC-004:** ★ MVP COMPLETE gate ★: SC-001 + SC-002 + SC-003 all green = MVP shippable.
- **SC-005:** Audit-level budget cap enforced — mocked-cost run halts at $15; `audit_runs.total_cost_usd ≤ 15` always.
- **SC-006:** Cost attribution — `audit_runs.total_cost_usd` matches `SUM(llm_call_log.cost_usd WHERE audit_run_id = ?)` end-to-end.
- **SC-007:** Cross-page PatternDetector emits 1 PatternFinding per heuristic violated by ≥3 pages; per-page findings preserved.
- **SC-008:** PostgresCheckpointer resume produces zero duplicate LLM calls vs continuous run.
- **SC-009:** Reproducibility — replay T148 24h later → finding ID overlap ≥ 90% (F-015 / NF-006 acceptance gate).
- **SC-010:** R15.2 analysis_status taxonomy complete — every page has non-null status; AuditCompleteNode summary lists breakdown.

---

## Constitution Alignment Check *(mandatory — must pass before status: approved)*

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — Phase 8 emits no LLM calls; PatternDetector is deterministic; passes-through Phase 7 finding text which already passed GR-007.
- [x] Does NOT auto-publish findings without consultant review (warm-up rule, F-016) — `warmup_mode_active` set from client profile; T148 acceptance asserts `published_findings` view returns 0 rows during MVP audits.
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — `audit_log`, `audit_events`, `findings`, `rejected_findings`, `llm_call_log` all append-only; `audit_runs` updates allowed (mutable status field per data layer §13).
- [x] Does NOT import vendor SDKs outside adapters (R9) — LangGraph used via Phase 4 abstraction; Drizzle via StorageAdapter; no direct Anthropic SDK in Phase 8.
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` (R10) — Phase 8 emits NO LLM calls; constraint is Phase 7's surface; Phase 8 honors via reproducibility snapshot pass-through.
- [x] Does NOT expose heuristic content outside the LLM evaluate prompt (R6) — Phase 8 stores filtered heuristics in `state.heuristic_knowledge_base` + `state.filtered_heuristics` typed arrays; Pino redaction config (Phase 6) inherits; LangSmith trace channel (Phase 7) inherits.
- [x] DOES include a conformance test stub for every AC-NN (PRD §9.6 + R3 TDD) — AC-01..AC-21 each have a test path.
- [x] DOES carry frontmatter delta block on subsequent edits (R18)
- [x] DOES define kill criteria for tasks > 2 hrs OR shared-contract changes (R23) — tracked in plan.md (AuditState merge conflicts, MVP COMPLETE gate failures, cost attribution drift, PatternDetector regression, PostgresCheckpointer resume failure).
- [x] DOES reference REQ-IDs from `docs/specs/final-architecture/` for every R-NN (R11.2) — all 13 cite REQ-ORCH-NODE-NNN / REQ-ORCH-EDGE-NNN / REQ-ORCH-SUBGRAPH-001 / REQ-CROSSPAGE-PATTERN-001 / REQ-REPRO-031a / REQ-TRIGGER-PERSIST-003 / REQ-CHECKPOINT-001 / REQ-COST-LOG-001 / REQ-COST-BUDGET-001.

---

## Out of Scope (cite PRD §3.2 explicit non-goals)

- **Reproducibility snapshot CREATION** — Phase 9 T160 (SnapshotBuilder) owns; Phase 8 only READS the snapshot at AuditSetupNode.
- **Gateway HTTP server** — DEFERRED to v1.1+ (PRD §3.2). MVP CLI calls Gateway as direct function call (T158 in Phase 9).
- **Temporal workflow integration** — DEFERRED to v1.1+. MVP uses LangGraph PostgresCheckpointer.
- **Multi-tenant SaaS** — DEFERRED to v1.2 (single-agency MVP per CLAUDE.md §14).
- **Dashboard / consultant review UI** — Phase 9 owns.
- **PDF report / Email notifications** — Phase 9 owns.
- **Executive Summary / Action Plan generation** — Phase 9 owns (LLM-driven; Phase 8 produces inputs).
- **Pattern detection across audits (cross-audit pattern)** — DEFERRED. F-014 is per-audit only.
- **Conversion-rate prediction** (permanent non-goal, R5.3 + GR-007).
- **Authenticated pages** (PRD §3.2 permanent non-goal).
- **State-graph extension to Phase 8** (REQ-STATE-EXT-001..NNN beyond §5.7) — DEFERRED to Phase 13 master.
- **Persona-based pattern grouping** — DEFERRED; F-014 groups by heuristic_id only in MVP. v1.1 may add persona grouping.

---

## Assumptions

- Phase 5 BrowseGraph + Phase 7 AnalysisGraph shipped + rollups approved before Phase 8 implementation begins.
- Phase 4b T4B-011 reservation honored — context_profile_id/hash slots in AuditState; Phase 4b ContextCaptureNode coordinates with AuditSetupNode (Phase 4b runs BEFORE AuditSetupNode in the outer graph).
- Phase 6 HeuristicLoader + 2-stage filter shipped; T137 + T138 use them.
- Phase 0b 30-heuristic pack shipped — fixture for T148 acceptance.
- AuditRequest schema (Phase 4b T4B-009 extension) shipped; CLI flags align with AuditRequest contract.
- Reproducibility snapshot row creation strategy: MVP T145 CLI scaffolds a stub snapshot before graph execution (per tasks-v2.md T145 v2.0 mod); Phase 9 T160 SnapshotBuilder will replace the scaffold with full composition (model_version + prompt_hash + heuristic_pack_hash + ContextProfile_hash + temperature_invariant).
- T148/T149/T150 fixtures (example.com, amazon.in, bbc.com) accessible from CI runner.
- LangGraph PostgresCheckpointer is stable and integration-tested in MVP environment (Phase 4 schema + connection pool already configured).
- ConsoleReporter + JsonReporter output formats finalized in PRD §F-005 (no late-stage format negotiation).
- No new external deps — LangGraph + Drizzle + Hono + Zod + Pino already wired.

---

## Next Steps

After this spec is approved (`status: draft → validated → approved`):

1. Run `/speckit.plan` to generate plan.md (already drafted alongside this spec).
2. Run `/speckit.tasks` to align tasks.md with `tasks-v2.md` Phase 8 section.
3. Run `/speckit.analyze` for cross-artifact consistency.
4. Phase 8 implementation begins after Phase 7 ships and `phase-7-current.md` rollup is approved.
5. Implementation order: T135-T136 (state types) → T137-T142 (orchestrator nodes + edges) → T143 (graph compile) → T144 (checkpointer) → T145-T147 (CLI + reporters) → T148-T150 (★★ acceptance tests = **MVP COMPLETE gate**) → T151-T155 (reserved for fixes from acceptance).
6. Phase 8 status: `draft → validated → approved → implemented → verified` (verified after T148-T150 all green = MVP shippable).
