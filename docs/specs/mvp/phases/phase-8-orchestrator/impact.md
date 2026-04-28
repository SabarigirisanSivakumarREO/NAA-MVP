---
title: Phase 8 — Impact Analysis (HIGH risk; AuditState extension + cross-page synthesis + repro composition; MVP COMPLETE gate)
artifact_type: impact
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-8-orchestrator/spec.md
  - docs/specs/mvp/phases/phase-7-analysis/impact.md (Finding lifecycle producer; PageSignals contract)
  - docs/specs/mvp/phases/phase-4b-context-capture/impact.md (T4B-011 AuditState slot prereq)
  - docs/specs/mvp/phases/phase-1c-perception-bundle/impact.md (PerceptionBundle accessor)
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/impact.md (multi-bundle iteration)
  - docs/specs/mvp/constitution.md (R7.4, R8.1, R14, R15.2, R20, R23)
  - docs/specs/final-architecture/04-orchestration.md
  - docs/specs/final-architecture/05-unified-state.md §5.7
  - docs/specs/final-architecture/25-reproducibility.md

req_ids:
  - REQ-ORCH-NODE-001..003
  - REQ-ORCH-EDGE-001..003
  - REQ-ORCH-SUBGRAPH-001
  - REQ-STATE-001
  - REQ-STATE-EXT-COMPAT-001
  - REQ-CROSSPAGE-PATTERN-001
  - REQ-REPRO-031a
  - REQ-CHECKPOINT-001

breaking: false
risk_level: high

affected_contracts:
  - AuditState (PRODUCER + CONSUMER — extends with §5.7 v2.0 fields + Phase 4b T4B-011 slots)
  - AuditPage (PRODUCER — NEW; page queue entry type)
  - AuditRequest (CONSUMER — Phase 4b T4B-009 producer; AuditSetupNode reads)
  - reproducibility_snapshot (CONSUMER — read at AuditSetupNode; creation is Phase 9 T160 / Gateway / T145 MVP scaffold)
  - audit_runs (PRODUCER — gateway/CLI creates; Phase 8 advances state.completion_reason)
  - PatternFinding (PRODUCER — NEW per F-014; emitted by AuditCompleteNode at audit close)
  - PageSignals (CONSUMER — read from Phase 7 emission per §7.13)
  - LangGraph checkpointer state (PRODUCER — PostgresCheckpointer per-turn persistence)
  - audit_events (PRODUCER — orchestration-level events)

delta:
  new:
    - Phase 8 impact — required by R20 because: (a) AuditState extends with §5.7 fields + Phase 4b T4B-011 slots simultaneously; (b) PatternFinding contract introduced; (c) PostgresCheckpointer state persistence first activation; (d) reproducibility_snapshot consumer first activation; (e) MVP COMPLETE gate hangs on Phase 8 acceptance tests
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R7.4 (append-only)
  - Constitution R8.1 (audit budget cap $15)
  - Constitution R14.1 (atomic llm_call_log + cost attribution end-to-end)
  - Constitution R15.2 (analysis_status taxonomy)
  - Constitution R18 (Delta-Based Updates)
---

# Phase 8 Impact Analysis

> **Why this file exists:** Constitution R20. Phase 8 introduces a NEW shared contract (`PatternFinding`), extends `AuditState` simultaneously across 3 phase surfaces (Phase 4b T4B-011 + Phase 7 T113 + Phase 8 T135), activates THREE additional cross-cutting surfaces at runtime (PostgresCheckpointer state persistence; reproducibility_snapshot consumer; gateway/CLI AuditRequest persistence pattern), and is the **MVP COMPLETE gate** — all downstream consumer phases (Phase 9 delivery) and product launch readiness depend on Phase 8 acceptance. Risk level **HIGH** because: (a) AuditState coordination across 3 phase-PRs is the highest merge-conflict surface in the MVP; (b) cross-page PatternDetector regression silently degrades consultant value (3-page minimum threshold + grouping correctness); (c) cost attribution drift breaks R14.4 per-client cost queries; (d) PostgresCheckpointer resume regression causes duplicate LLM calls (R14.1 violation + cost overrun); (e) MVP COMPLETE gate failure blocks investor demo + first-pilot readiness.

---

## 1. Contract changes

| Contract | Before | After | Breaking? |
|---|---|---|---|
| AuditState | Phase 5 base + Phase 7 T113 analyze fields + Phase 4b T4B-011 context_profile_id/hash slots | Adds §5.7 v2.0 fields: `trigger_source`, `audit_request_id`, `state_graph`, `multi_state_perception`, `current_state_id`, `exploration_*`, `finding_rollups`, `reproducibility_snapshot`, `published_finding_ids`, `warmup_mode_active` | **No** — additive, all defaults; REQ-STATE-EXT-COMPAT-001 ensures Phase 1-5 unaffected |
| AuditPage | — | NEW; queue entry with status enum | New (additive) |
| PatternFinding | — | NEW shared producer contract per F-014 | New (additive) |
| AuditRequest | Phase 4b T4B-009 introduced | Phase 8 CONSUMES via AuditSetupNode | **No** — consumer-only |
| reproducibility_snapshot row | DDL exists (Phase 4 baseline T070) | First inserts via T145 MVP scaffold (or Phase 9 T160 SnapshotBuilder) | **No** — first rows |
| audit_runs row | DDL exists | Mutation expanded — `completion_reason` enum populated; `total_cost_usd` summed end-of-audit | **No** — schema unchanged; mutation pattern formalized |
| PageSignals | Phase 7 emit (REQ-ANALYZE-CROSSPAGE-001) | Phase 8 CONSUMER (cross-page PatternDetector input) | **No** — consumer-only |
| LangGraph checkpointer state | — | PostgresCheckpointer per-turn rows in `langgraph_checkpoints` | New (additive) |

---

## 2. Producers affected

| Producer | File | Change required | Owner |
|---|---|---|---|
| AuditState extension | `packages/agent-core/src/orchestration/AuditState.ts` | Extend Zod schema with §5.7 fields (additive) | T135 |
| AuditPage type + queue helpers | `packages/agent-core/src/orchestration/types.ts` | NEW | T136 |
| AuditSetupNode | `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts` | NEW; reads snapshot + AuditRequest; Stage 1 filter; warm-up | T137 |
| PageRouterNode | `packages/agent-core/src/orchestration/nodes/PageRouterNode.ts` | NEW; Stage 2 filter; budget gate | T138 |
| AuditCompleteNode | `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts` | NEW; cross-page PatternDetector folded; analysis_status breakdown | T139 |
| Cross-page PatternDetector | `packages/agent-core/src/analysis/cross-page/PatternDetector.ts` | NEW; deterministic grouping by heuristic_id (or (heuristic_id, viewport)) | T139 (folded) |
| Routing edges | `packages/agent-core/src/orchestration/auditEdges.ts` | NEW; 3 routing functions | T140-T142 |
| AuditGraph | `packages/agent-core/src/orchestration/AuditGraph.ts` | NEW; LangGraph subgraph composition | T143 |
| PostgresCheckpointer | `packages/agent-core/src/orchestration/PostgresCheckpointer.ts` | NEW; LangGraph PostgresSaver integration | T144 |
| CLI audit command | `apps/cli/src/commands/audit.ts` | Modify; constructs AuditRequest + writes snapshot scaffold; supports --resume | T145 |
| ConsoleReporter | `apps/cli/src/output/ConsoleReporter.ts` | NEW | T146 |
| JsonReporter | `apps/cli/src/output/JsonReporter.ts` | NEW | T147 |
| Acceptance tests | `tests/acceptance/{example-com,amazon-in,bbc-com}.test.ts` | NEW | T148-T150 |
| `langgraph_checkpoints` table | DB migration (Phase 4 baseline + LangGraph upstream) | Migration runs at T144 setup | T144 |

---

## 3. Consumers affected (per R20 audit)

| Consumer | Location | Reads which contract? | Migration required? | Action |
|---|---|---|---|---|
| Phase 9 Executive Summary generator | `packages/agent-core/src/delivery/ExecutiveSummaryGenerator.ts` | Reads `audit_runs.completion_reason` + `grounded_findings[]` + `cross_page_patterns[]` | **Yes** — first downstream consumer of Phase 8 outputs | Phase 9 spec accommodates |
| Phase 9 Action Plan generator | `packages/agent-core/src/delivery/ActionPlanGenerator.ts` | Reads grounded_findings + business_impact / effort scores | **Yes** | Phase 9 spec accommodates |
| Phase 9 PDF report | `packages/agent-core/src/delivery/ReportGenerator.ts` | Reads audit_runs + findings + annotated screenshots + cross_page_patterns | **Yes** | Phase 9 spec accommodates |
| Phase 9 Email notifications | `packages/agent-core/src/delivery/NotificationAdapter.ts` | Reads audit_runs.completion_reason + URL | **Yes** | Phase 9 spec accommodates |
| Phase 9 Dashboard review inbox | `apps/dashboard/app/console/review/page.tsx` | Reads findings WHERE publish_status = 'held' | **Yes** | Phase 9 spec accommodates |
| Phase 9 SnapshotBuilder | `packages/agent-core/src/reproducibility/SnapshotBuilder.ts` | T160 replaces T145 MVP scaffold | **Yes** — coordination with Phase 8 T145 | Phase 9 spec sequences T160 after Phase 8 ships |
| `audit_runs` table consumers | DB queries (R14.4 per-client cost attribution) | Reads audit_runs.total_cost_usd + client_id | **Yes** — first non-stub rows | SQL queries already specified in §13 |
| Reproducibility replay (Phase 9 T160 + future) | `packages/agent-core/src/reproducibility/SnapshotBuilder.ts` | Loads snapshot; replays audit | **Yes** — Phase 8 produces snapshot rows that replay reads | Phase 9 spec accommodates |
| Phase 8 own AuditCompleteNode | `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts` | Consumes Phase 7 PageSignals from `state.cross_page_signals[]` | **Yes** — internal Phase 8 consumer | T139 acceptance |
| Phase 8 own PageRouterNode | Same | Consumes `state.heuristic_knowledge_base` (Stage 1 filtered) | **Yes** — internal | T138 acceptance |
| Phase 1-5 backward-compat readers | per-file across codebase | Reads AuditState fields | **No** — REQ-STATE-EXT-COMPAT-001 ensures defaults; Phase 1-5 unchanged | None |
| `langgraph_checkpoints` consumers | LangGraph upstream | Reads / writes per turn | **Yes** — first activation | T144 setup |

**Net break risk:** Zero for Phase 1-5 (REQ-STATE-EXT-COMPAT-001 invariant). Phase 9 accommodates Phase 8 outputs by spec design (planned downstream consumer).

---

## 4. AuditState 3-Phase Coordination Surface

This is the highest-risk coordination surface in Phase 8 — three phases simultaneously extend AuditState:

| Phase | Task | Adds | When |
|---|---|---|---|
| Phase 4b | T4B-011 | `context_profile_id` + `context_profile_hash` slots | Lands BEFORE Phase 8 (Phase 4b shipped 2026-04-28) |
| Phase 7 | T113 | analyze fields (current_page_perception_bundle, current_page_type, confidence_tier, evaluate_findings_raw[], critique_findings[], grounded_findings[], rejected_findings[], analysis_cost_usd, analysis_status, current_page_signals) | Lands BEFORE Phase 8 (Phase 7 implementation) |
| Phase 8 | T135 | §5.7 v2.0 fields (trigger_source, audit_request_id, state_graph, multi_state_perception, current_state_id, exploration_*, finding_rollups, reproducibility_snapshot, published_finding_ids, warmup_mode_active) | Lands AFTER Phase 4b + Phase 7 |

**Coordination protocol** (per `plan.md` §2):
1. **Single source-of-truth file:** `packages/agent-core/src/orchestration/AuditState.ts`
2. **Sequential PRs:** Phase 4b T4B-011 → Phase 7 T113 → Phase 8 T135
3. **Zod schema augmentation:** each phase appends fields to a shared `AuditStateSchema` via `.extend()`
4. **Conformance test gate:** `audit-state-full.test.ts` runs after T135 lands; verifies all field groups + invariants
5. **Backward-compat invariant (REQ-STATE-EXT-COMPAT-001):** all new fields have defaults; Phase 1-5 unaffected

**Risk if coordination fails:** T135 conformance test red → Phase 7 + Phase 4b regression on AuditState load/save. Mitigation: kill criterion (plan.md §7) triggers STOP on conformance regression.

---

## 5. Cross-Page PatternDetector — F-014 implementation surface

PatternDetector is the FIRST runtime consumer of Phase 7's PageSignals emission (REQ-ANALYZE-CROSSPAGE-001 + §7.13). Implementation is deterministic — NO LLM:

- **Input:** `state.grounded_findings[]` (across all completed pages)
- **Grouping:** by `heuristic_id` (default) OR `(heuristic_id, viewport)` when Phase 5b multi-viewport active
- **Threshold:** ≥3 affected pages → emit one PatternFinding
- **Output:** PatternFinding[] (with representative recommendation from highest-severity group member)
- **Persistence:** `findings` table with `is_pattern: true` flag (or separate `pattern_findings` table per data layer §13)

NF-05 target: <3s on 50-page audit. Pure function; O(N) where N ≈ 200 grounded findings; should complete <100ms. Test surface: 0/1/2/3+ page cases.

Risk if regresses: consultant value lost — systemic patterns are higher-leverage than per-page findings. Conformance test (AC-05 / SC-007) catches regression.

---

## 6. Cost impact

| Metric | Before | After Phase 8 (50-page audit estimate) |
|---|---|---|
| Phase 8 LLM calls per audit | 0 (Phase 8 emits no LLM calls) | 0 |
| Phase 8 wall-clock per audit (orchestration overhead beyond Phase 5/7 nodes) | — | ~5-15s (PatternDetector + AuditCompleteNode summary) |
| Per-audit total (Phase 5 + Phase 7 + Phase 8) | $0 / N/A | $5-15 + ~10-20 min |
| Audit-level budget cap enforcement | not enforced | $15 hard cap (R8.1) — PageRouterNode budget gate |
| Cost attribution end-to-end | not testable | `audit_runs.total_cost_usd` matches `SUM(llm_call_log.cost_usd WHERE audit_run_id = ?)` (R14.4) |

Phase 8 itself adds ZERO LLM cost; it just orchestrates Phase 7's calls.

---

## 7. Storage impact

| Table | Before | After Phase 8 (50-page audit estimate) |
|---|---|---|
| `audit_runs` | Phase 5 stub rows | Mutated rows with `completion_reason` + `total_cost_usd` populated |
| `audit_requests` | Phase 4b T4B-009 first rows | +1 row per audit (CLI write) |
| `reproducibility_snapshots` | DDL only | +1 row per audit (T145 MVP scaffold or T160 full) |
| `findings` | Phase 7 rows | +PatternFinding rows (typically 5-15 per multi-page audit) with `is_pattern: true` |
| `audit_log` | Phase 7 page-level rows | +1 row per audit-orchestration milestone (audit_setup_complete, audit_complete) |
| `audit_events` | Phase 7 per-stage events | +session_completed event |
| `langgraph_checkpoints` | — | NEW — per-turn LangGraph state rows (~5-10 per audit) |

Per-row sizes typical: audit_runs ~2 KB; reproducibility_snapshots ~5 KB; PatternFinding ~3 KB; langgraph_checkpoints ~10-50 KB (full state snapshot per turn).

50-audit/day × 30 days = 1500 audits/month × ~100 KB total Phase 8 storage per audit = ~150 MB/month. Trivial.

---

## 8. Reproducibility impact

Phase 8 is where reproducibility (F-015 / NF-006) becomes **end-to-end testable**. Replay path:

1. Reload `reproducibility_snapshot` for the audit_run_id (T145 wrote on original run; Phase 9 T160 owns full composition)
2. Reload `AuditRequest` from `audit_requests` table
3. Run AuditGraph with the same `thread_id = audit_run_id` against PostgresCheckpointer (or fresh state)
4. Compare grounded finding ID sets between original + replay: Jaccard similarity ≥ 0.9 (NF-005 / SC-009)

Phase 7 owns the temperature=0 + prompt-hash invariants; Phase 8 owns the snapshot persistence + AuditRequest persistence + heuristic_pack_hash invariants.

Risk: Sonnet-at-temp=0 isn't perfectly deterministic; 90% Jaccard target accommodates day-to-day drift. >10% drift triggers investigation (likely upstream model change or fixture drift).

---

## 9. Documentation impact

| Doc | Change |
|---|---|
| `docs/specs/final-architecture/04-orchestration.md` | No change — already canonical for Phase 8 |
| `docs/specs/final-architecture/05-unified-state.md` §5.7 | No change — already canonical |
| `docs/specs/final-architecture/25-reproducibility.md` | No change |
| `docs/specs/final-architecture/18-trigger-gateway.md` | No change |
| `docs/specs/mvp/PRD.md` | F-001, F-014, F-015, F-016, F-021 already specified; no PRD change required |
| `docs/specs/mvp/tasks-v2.md` | No additional change in v2.3.3 (T135 / T137 / T138 / T145 / T148-T150 v2.0/v2.1 mods retained); cross-page PatternDetector folded into T139 acceptance per plan.md §3 — punch-list candidate for v2.3.4 (add discrete T-ID for PatternDetector) |
| `docs/specs/mvp/phases/INDEX.md` | v1.1 → v1.2 — Phase 8 row marked spec-shipped (this session) |
| `docs/specs/mvp/phases/phase-4b-context-capture/impact.md` | Already references Phase 8 AuditState slot prereq; no change |
| `docs/specs/mvp/phases/phase-7-analysis/impact.md` | Already references Phase 8 cross-page consumer; no change |
| `CLAUDE.md` | No change |

---

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AuditState merge conflicts across 3 PRs (Phase 4b/7/8) | Medium | High | Sequential PR protocol; conformance test gate; coordination doc in plan.md §2; kill criterion |
| Cross-page PatternDetector regression (incorrect grouping) | Low | Medium | AC-05 / SC-007 conformance test; pure-function + unit-test coverage of 0/1/2/3+ page cases |
| Cost attribution drift (audit_runs vs llm_call_log) | Low | High (R14.1 + R14.4) | AC-18 conformance test in CI; transaction wrapping in StoreNode (Phase 7) + AuditCompleteNode (Phase 8) |
| PostgresCheckpointer resume produces duplicate LLM calls | Low | High (R14.1 + cost overrun) | AC-10 conformance test; thread_id audit; kill criterion |
| MVP COMPLETE gate fails on first run (T148/T149/T150) | High (first integration) | Medium (timeline) | T151-T155 reserved (5 fix slots); ~1-2 day buffer; if all 5 consumed, ESCALATE |
| Anti-bot blocks T149 amazon.in entirely | Medium | Medium | Spec allows degraded acceptance per plan.md §7; v1.1 stealth plugin addresses |
| Reproducibility regression on T148 replay (NF-005) | Low | Medium | 90% target accommodates Sonnet drift; >10% drift triggers investigation |
| LangGraph PostgresCheckpointer schema migration breaks Phase 4 baseline | Low | Medium | Run migration in CI before T144 implementation; rollback plan documented |
| Multi-tenant RLS interferes with PostgresCheckpointer | Low | Medium | Configure `app.client_id` SET LOCAL in checkpointer transactions |
| F-014 3-page threshold yields 0 PatternFindings on small audits | Medium | Low | Documented as expected; per-page findings preserved |
| Phase 5b multi-viewport changes PatternFinding emission semantics | Low | Medium | viewportGrouping flag in PatternDetector accepts both modes |
| Phase 9 T160 SnapshotBuilder replaces T145 scaffold and breaks compatibility | Low | Low | T145 scaffold documented as MVP placeholder; T160 plug-replaces |
| Audit budget cap enforcement bypass (R8.1 violation) | Low | High | NF-03 conformance test; PageRouterNode pre-page check |
| Per-page analysis_status taxonomy incomplete | Low | Medium | AC-17 conformance test ensures every page has non-null status |
| Phase 8 ships before Phase 0b 30-heuristic pack — T148 has no fixtures | Low | High (acceptance gate) | Phase 0b is upstream; Phase 8 sequencing waits for Phase 0b commit |

---

## 11. Sign-off requirements

Per R20:

- [x] This impact.md exists (R20 hard requirement)
- [ ] Engineering lead sign-off on Phase 8 spec.md (`status: draft → validated → approved`)
- [ ] AuditState 3-phase coordination protocol reviewed by engineering lead BEFORE T135 implementation begins
- [ ] Cross-page PatternDetector pure-function design reviewed by engineering lead + product owner BEFORE T139 implementation
- [ ] T148/T149/T150 fixture URLs confirmed accessible from CI runner BEFORE T148 implementation begins
- [ ] Phase 7 T134 integration test green AND Phase 0b 30-heuristic pack committed BEFORE T148 runs
- [ ] LangGraph PostgresCheckpointer migration reviewed + run in CI BEFORE T144 implementation begins
- [ ] Phase 9 owner agrees to consume Phase 8 outputs (audit_runs + findings + cross_page_patterns + reproducibility_snapshot) — Phase 9 spec authoring deferred to next session
- [ ] Reproducibility replay strategy (T160 in Phase 9) sequenced AFTER Phase 8 ships
- [ ] T145 MVP scaffold for snapshot creation reviewed (acknowledge it's a placeholder for T160)

---

## 12. Provenance (R22.2)

```yaml
why:
  source: >
    docs/specs/final-architecture/04-orchestration.md (canonical audit graph)
    docs/specs/final-architecture/05-unified-state.md §5.7 (AuditState extensions)
    docs/specs/final-architecture/25-reproducibility.md (snapshot composition + replay)
    docs/specs/mvp/constitution.md R8.1 (audit budget $15) + R14.1/R14.4 (cost attribution) + R15.2 (analysis_status taxonomy)
    docs/specs/mvp/PRD.md F-014 (cross-page PatternDetector) + F-015 (reproducibility snapshot) + F-016 (warm-up two-store)
  evidence: >
    Phase 8 introduces a NEW shared producer contract (PatternFinding) and extends AuditState
    simultaneously across 3 phase surfaces (Phase 4b T4B-011 + Phase 7 T113 + Phase 8 T135) —
    R20 mandates impact analysis when ≥1 shared contract changes. The 3-phase AuditState
    coordination is the highest merge-conflict surface in the MVP. Phase 8 is also the
    MVP COMPLETE gate (T148-T150 acceptance tests) — failure here blocks investor demo
    and first-pilot readiness.
  linked_failure: >
    Anticipated risk class — multi-phase shared-state extension fails when PRs merge in wrong
    order or skip the conformance test gate. Historical pattern: Phase 1-5 backward-compat
    invariants silently regress when AuditState extension PRs don't run conformance tests
    pre-merge. REQ-STATE-EXT-COMPAT-001 + plan.md §2 protocol + AC-01 conformance test are
    the layered defense.
```
