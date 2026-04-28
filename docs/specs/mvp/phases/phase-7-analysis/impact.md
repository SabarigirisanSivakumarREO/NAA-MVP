---
title: Phase 7 — Impact Analysis (HIGH risk; analytical apex; first temp=0 + first LangSmith channel + Finding lifecycle producer)
artifact_type: impact
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-7-analysis/spec.md
  - docs/specs/mvp/phases/phase-6-heuristics/impact.md (HeuristicSchemaExtended + LLMAdapter forward contract)
  - docs/specs/mvp/phases/phase-4b-context-capture/impact.md (ContextProfile + loadForContext contract)
  - docs/specs/mvp/phases/phase-1c-perception-bundle/impact.md (PerceptionBundle accessor contract)
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/impact.md (multi-bundle iteration semantics)
  - docs/specs/mvp/constitution.md (R5.6, R6, R10, R13, R14, R20, R23, R24)
  - docs/specs/final-architecture/07-analyze-mode.md §7.3-§7.13

req_ids:
  - REQ-ANALYZE-GRAPH-001
  - REQ-ANALYZE-NODE-001..005
  - REQ-ANALYZE-GROUND-001
  - REQ-ANALYZE-QUALITY-001
  - REQ-CONTEXT-DOWNSTREAM-001
  - REQ-COST-LOG-001
  - REQ-COST-BUDGET-001

breaking: false
risk_level: high

affected_contracts:
  - AnalyzePerception (CONSUMER — read via PerceptionBundle accessor)
  - Finding lifecycle (PRODUCER — Raw → Reviewed → Grounded / Rejected; NEW)
  - AuditState (PRODUCER + CONSUMER — analyze fields populated; coordinated with Phase 8 T135)
  - audit_log (PRODUCER — append-only per R7.4)
  - audit_events (PRODUCER — per-stage events)
  - llm_call_log (PRODUCER — atomic write per call per R14.1)
  - findings (PRODUCER — internal storage per F-016 two-store pattern)
  - rejected_findings (PRODUCER — append-only per R7.4)
  - PageSignals (PRODUCER — emitted at page completion; Phase 8 cross-page consumer per §7.13)
  - LLMAdapter.{evaluate, selfCritique} call sites (FIRST temperature=0 runtime activation per R10/R13)
  - LangSmith trace metadata schema (FIRST R6 channel activation — heuristic content marked private)
  - TemperatureGuard middleware (FIRST runtime activation — locks invariant)

delta:
  new:
    - Phase 7 impact — required by R20 because: (a) Finding lifecycle introduced; (b) FIRST R10 TemperatureGuard runtime; (c) FIRST R6 LangSmith trace channel; (d) AuditState analyze fields extended; (e) audit_log + audit_events + llm_call_log producers go live
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R5.6 (focal — separate self-critique LLM call)
  - Constitution R6 (focal — LangSmith channel activation)
  - Constitution R10 + R13 (focal — temperature=0 first runtime use)
  - Constitution R14 (atomic llm_call_log + pre-call BudgetGate)
  - Constitution R15.1 (perception quality gate)
  - Constitution R18 (Delta-Based Updates)
---

# Phase 7 Impact Analysis

> **Why this file exists:** Constitution R20. Phase 7 is the analytical apex — it introduces the Finding lifecycle as a NEW shared producer contract, activates THREE constitutional invariants at runtime for the first time (R10 TemperatureGuard, R6 LangSmith trace channel, R5.6 separate self-critique call), and writes to FIVE append-only DB tables (`audit_log`, `audit_events`, `llm_call_log`, `findings`, `rejected_findings`). Risk level **HIGH** because: (a) any R10 violation breaks reproducibility (F-015 / NF-006); (b) any R6 leak compromises competitive moat (heuristic IP); (c) any GR-007 bypass exposes REO Digital to legal/reputational risk (R5.3); (d) any audit_log / llm_call_log inconsistency breaks cost attribution (R14.4) and incident forensics (R7.4).

---

## 1. Contract changes

| Contract | Before | After | Breaking? |
|---|---|---|---|
| Finding lifecycle | — (no findings produced yet) | NEW lifecycle: Raw → Reviewed (Critique verdict) → Grounded XOR Rejected | New (additive — first producer) |
| AuditState analyze fields | Existing schema (browse-mode only) | Extends with `current_page_perception_bundle`, `current_page_type`, `confidence_tier`, `evaluate_findings_raw[]`, `critique_findings[]`, `grounded_findings[]`, `rejected_findings[]`, `analysis_cost_usd`, `analysis_status`, `current_page_signals` | **No** — additive, all defaults |
| `findings` table | Empty / DDL only | First inserts | New rows; schema unchanged from Phase 4 baseline |
| `rejected_findings` table | Empty / DDL only | First inserts (append-only per R7.4) | Same |
| `audit_log` table | Phase 5 browse-mode rows | Phase 7 analyze-mode rows added | Same |
| `audit_events` table | Phase 5 browse-mode events | Per-stage events: evaluate_complete, critique_complete, ground_complete, annotate_complete, store_complete; analysis_status events on quality gate / budget exhaust | Same |
| `llm_call_log` table | Empty (no LLM calls before Phase 7) | First inserts — atomic per call per R14.1 (FIRST runtime activation of R14.1) | Same |
| LLMAdapter.{evaluate, selfCritique} calls | Defined interface, not yet called | First calls fire — FIRST runtime activation of R10/R13 TemperatureGuard at adapter boundary | **No** — interface unchanged; behavior gates activate |
| TemperatureGuard middleware | Phase 6 ships interface | First runtime activation in Phase 7 | **No** — no signature change |
| LangSmith trace schema | Phase 5 generic traces | Phase 7 emits traces with `private` metadata fields holding heuristic body content | **No** — additive metadata fields |
| PageSignals contract (REQ-ANALYZE-CROSSPAGE-001) | — | NEW emit at page completion; Phase 8 consumer | New (additive) |

---

## 2. Producers affected

| Producer | File | Change required | Owner |
|---|---|---|---|
| AnalysisState extension | `packages/agent-core/src/orchestration/AuditState.ts` | Extend fields (additive) | T113 |
| detectPageType | `packages/agent-core/src/analysis/utils/detectPageType.ts` | NEW (v2.3 ranked-list shape; reads ContextProfile when set) | T114 |
| assignConfidenceTier | `packages/agent-core/src/analysis/utils/assignTier.ts` | NEW | T115 |
| CostTracker | `packages/agent-core/src/analysis/CostTracker.ts` | NEW (atomic llm_call_log writes + pre-call BudgetGate) | T116 |
| DeepPerceiveNode | `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` | NEW; thin orchestrator over Phase 1c PerceptionBundle accessor | T117 |
| evaluate prompt | `packages/agent-core/src/analysis/prompts/evaluate.ts` | NEW | T118 |
| EvaluateNode | `packages/agent-core/src/analysis/nodes/EvaluateNode.ts` | NEW; FIRST R10 + R6 runtime activation | T119 |
| self-critique prompt | `packages/agent-core/src/analysis/prompts/selfCritique.ts` | NEW; DIFFERENT system persona from evaluate (R5.6) | T120 |
| SelfCritiqueNode | `packages/agent-core/src/analysis/nodes/SelfCritiqueNode.ts` | NEW; SEPARATE LLM call (R5.6) | T121 |
| 8 grounding rules | `packages/agent-core/src/analysis/grounding/rules/GR-{001..008}.ts` | NEW (parallelizable) | T122-T129 |
| GR-012 benchmark validation | `packages/agent-core/src/analysis/grounding/rules/GR-012.ts` | NEW (folded into T130 acceptance per plan.md §3) | T130 |
| EvidenceGrounder | `packages/agent-core/src/analysis/grounding/EvidenceGrounder.ts` | NEW; runs 9 rules in order; assigns confidence_tier | T130 |
| AnnotateNode | `packages/agent-core/src/analysis/nodes/AnnotateNode.ts` | NEW; wraps page_annotate_screenshot MCP tool | T131 |
| StoreNode | `packages/agent-core/src/analysis/nodes/StoreNode.ts` | NEW; persists findings + screenshots; atomic txn | T132 |
| AnalysisGraph | `packages/agent-core/src/analysis/AnalysisGraph.ts` | NEW; LangGraph compile of 5 nodes + 3 routing edges | T133 |
| Phase 7 integration test | `packages/agent-core/tests/integration/phase7.test.ts` | NEW; EXIT GATE | T134 |
| LLMAdapter LangSmith trace metadata | `packages/agent-core/src/adapters/LLMAdapter.ts` (modify) | Add `private`/`public` metadata split for evaluate / selfCritique tags | T119 / T121 (or shared adapter PR) |

---

## 3. Consumers affected (per R20 audit)

| Consumer | Location | Reads which contract? | Migration required? | Action |
|---|---|---|---|---|
| Phase 8 AuditSetupNode | `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts` | Reads filtered heuristic_knowledge_base from Phase 7's `loadForContext()` call site | **No** — Phase 8 reads filtered set already filtered by Phase 7 entry; T137 v2.0 reads via state.heuristic_knowledge_base | None for Phase 7; T137 already authored |
| Phase 8 PageRouterNode | `packages/agent-core/src/orchestration/nodes/PageRouterNode.ts` | Reads `state.filtered_heuristics` set produced by Phase 7's filter | **No** — Phase 7 produces, Phase 8 reads | None |
| Phase 8 cross-page PatternDetector | `packages/agent-core/src/analysis/cross-page/PatternDetector.ts` | Reads `state.cross_page_signals[]` (PageSignals emitted by Phase 7 per §7.13) | **Yes** — Phase 8 consumes new contract | Phase 8 spec accommodates |
| Phase 8 audit_complete | `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts` | Reads `analysis_status` per page; reports breakdown | **Yes** — Phase 8 consumes new analysis_status taxonomy | Phase 8 spec accommodates |
| Phase 9 Executive Summary generator | `packages/agent-core/src/delivery/ExecutiveSummaryGenerator.ts` | Reads grounded_findings | **Yes** — first consumer of Finding lifecycle | Phase 9 spec accommodates |
| Phase 9 Action Plan generator | `packages/agent-core/src/delivery/ActionPlanGenerator.ts` | Reads grounded_findings + business_impact / effort scores | **Yes** | Phase 9 spec accommodates |
| Phase 9 PDF report | `packages/agent-core/src/delivery/ReportGenerator.ts` | Reads grounded_findings + annotated screenshots | **Yes** | Phase 9 spec accommodates |
| Phase 9 Dashboard review inbox | `apps/dashboard/app/console/review/page.tsx` | Reads findings WHERE publish_status = 'held' | **Yes** | Phase 9 spec accommodates |
| llm_call_log analyzers | per-client cost SQL queries (R14.4) | Reads llm_call_log rows | **Yes** — first rows materialize | Audit_runs ↔ client_id ↔ llm_call_log JOIN already specified |
| Reproducibility snapshot replay (Phase 8 T160) | `packages/agent-core/src/reproducibility/SnapshotBuilder.ts` | Reads model_version + prompt_hash + heuristic_pack_hash + temp=0 invariant | **Yes** — Phase 7 prompt + LLM call hashes are inputs | Phase 8 spec accommodates |
| `findings` table consumers | Drizzle ORM | Reads typed Finding rows | **Yes** — first inserts | Schema already defined in Phase 4 baseline (T070) |
| Audit forensics during incident | DB queries | Reads audit_log + audit_events + llm_call_log | **Yes** — first analyze-mode rows | append-only per R7.4 |

**Net break risk:** None — all consumers are Phase 8 / Phase 9 (downstream); they're authored AFTER Phase 7 ships; Phase 7 produces typed contracts that downstream consumes via Zod parse.

---

## 4. Constitutional invariant first-runtime activation surface

This is the highest-impact section — Phase 7 is the FIRST runtime use of THREE constitutional invariants. Failures here are critical.

### 4.1 R10 + R13 TemperatureGuard (first runtime)

- **Where:** `LLMAdapter` boundary; tags `evaluate`, `self_critique`, `evaluate_interactive` (last is master scope).
- **What:** TemperatureGuard middleware rejects calls with `temperature !== 0` for tagged calls. Throws `R10TemperatureGuardError`.
- **Why R20 risk:** If a developer accidentally passes `temperature: 0.7` and the guard is missing/bypassed, reproducibility breaks silently (F-015 / NF-006). Same fixture × 2 runs would diverge. Replay against `reproducibility_snapshots` would fail downstream.
- **Verification:** T119 / T121 conformance tests inject `temperature: 0.7` to assert guard fires. T134 integration test asserts `llm_call_log.temperature` column = 0 for all evaluate / self_critique rows.
- **Mitigation if fails:** Phase 7 ships kill criterion (plan.md §5) — any R10 violation found mid-implementation triggers STOP + engineering lead review.

### 4.2 R6 LangSmith trace channel (first runtime)

- **Where:** `LLMAdapter` LangSmith metadata emission for `evaluate` / `self_critique` calls.
- **What:** Heuristic body fields emitted under `metadata.private` (admin-role only); heuristic IDs + counts under `metadata.public` (default UI). LangSmith UI redacts `private` payload for non-admin viewers.
- **Why R20 risk:** Heuristic body content is competitive moat (R6 retroactive audit provenance). A leak via LangSmith is harder to clean up than a Pino log leak (LangSmith retains traces 30+ days; some plans permanent).
- **Verification:** T134 integration test inspects emitted trace; asserts heuristic body NOT in default UI payload; asserts IDs ARE present. Pino transport spy from Phase 6 inherits.
- **Mitigation if fails:** Phase 7 ships kill criterion (plan.md §5) — any R6 leak found triggers STOP + audit + reject all traces from leaked session.

### 4.3 R5.6 separate self-critique LLM call

- **Where:** EvaluateNode (T119) returns; SelfCritiqueNode (T121) takes input + makes NEW LLM call.
- **What:** Two distinct `LLMAdapter.invoke` calls per page. Distinct system prompt personas (Levenshtein-distance-checked).
- **Why R20 risk:** Cost optimization temptation — combining into single call halves LLM cost. R5.6 provenance block cites empirical 30% false-positive reduction; a combined call fails NF-06.
- **Verification:** `llm_call_log` shows 2 distinct rows per page (tag=evaluate + tag=self_critique). Conformance test asserts row count = 2 per page on T134 fixture run.
- **Mitigation if fails:** Phase 7 ships kill criterion (plan.md §5) — R5.6 violation triggers STOP; audit code; revert.

---

## 5. Heuristic engine impact

Phase 7 is the FIRST consumer of Phase 6's `HeuristicLoader.loadAll()` + 2-stage filter (Phase 8 calls Stage 1; Phase 7 internally calls Stage 2 via `loadForContext`). Phase 4b's `loadForContext(profile)` is the integration point — Phase 7 receives the filtered 12-25 heuristic set per page (typically) and prioritizes to top 30 (capped).

GR-005 (heuristic_id in filtered set) is the runtime check that the LLM didn't fabricate a heuristic ID. If GR-005 fails frequently, Phase 7 prompt-protocol-drift signal — investigate evaluate prompt.

GR-012 benchmark validation (R15.4) consumes the heuristic's `benchmark` block. Phase 0b ensures every heuristic has a verified benchmark; GR-012 enforces the LLM-claimed value matches it within tolerance.

---

## 6. Cost impact

| Metric | Before | After | Δ |
|---|---|---|---|
| LLM calls per page | 0 | 2 (evaluate + self_critique) + retries (≤2x evaluate retry on malformed) | +2 minimum |
| LLM cost per page | $0 | ~$0.45-0.90 typical | +~$0.45-0.90 |
| LLM cost per audit (50 pages) | $0 | ~$22-45 | (above $15 cap unless budget gate enforces) |
| Wall-clock per page | 0 (Phase 5 done already) | ~30-90s | +30-90s |
| `llm_call_log` rows per audit | 0 | 100-200 (50 pages × 2-4 calls/page) | +100-200 rows |

**Note on per-audit budget:** $15 hard cap (R8.1) requires aggressive budget gate behavior on long audits. With ~$0.50 per page, $15 supports ~30 pages comfortably; beyond that, gate must skip Tier 2/3 heuristics or partial-analyze. Phase 7 ships partial-analyze paths via R15.1 quality gate (perception quality 0.3-0.59 → Tier 1 only) which doubles as a budget-savings path. Per-page cap $5 (R8.2) prevents single-page runaway cost.

---

## 7. Storage impact

| Table | Before | After Phase 7 (50-page audit estimate) |
|---|---|---|
| `findings` | 0 rows | ~75-200 rows (1.5-4 grounded findings per page) |
| `rejected_findings` | 0 rows | ~150-400 rows (rejected at critique + grounding) |
| `audit_log` | Phase 5 rows | +50 (1 per page Phase 7 entry) |
| `audit_events` | Phase 5 rows | +250 (5 events per page: deep_perceive_done, evaluate_done, critique_done, ground_done, store_done) |
| `llm_call_log` | 0 rows | +100-200 rows (2 calls per page × 50 pages, plus retries) |
| Screenshots in R2/disk | Phase 5 viewport only | +50 fullpage + +50 annotated viewport + +50 annotated fullpage = +150 images per audit |

Per-row sizes typical: findings ~3-5 KB JSON; llm_call_log ~1 KB. ~1-2 MB DB growth per audit. Trivial.

Screenshot storage: ~150 KB per image (JPEG, ≤1280px wide) × 150 = ~22 MB per audit. R2 cost: negligible.

---

## 8. Reproducibility impact

Phase 7 is where reproducibility (F-015 / NF-006) becomes testable end-to-end. Replay path:

1. Reload `reproducibility_snapshot` for the audit_run (Phase 8 owns snapshot creation; Phase 7 honors temp=0 + prompt hash + heuristic pack hash + ContextProfile hash invariants).
2. Re-run Phase 7 pipeline against same PerceptionBundle hash + same heuristic pack hash + same ContextProfile hash + temp=0.
3. Compare grounded finding ID sets: Jaccard similarity ≥ 0.9 (NF-005).

Risk: temp=0 doesn't guarantee perfect determinism (Anthropic Sonnet at temp=0 is _approximately_ deterministic; minor drift across days is documented). 90% Jaccard target accommodates this.

NF-005 verification: Phase 7 integration test (T134) runs 2x sequentially on same fixture; asserts overlap ≥ 90%.

---

## 9. Documentation impact

| Doc | Change |
|---|---|
| `docs/specs/final-architecture/07-analyze-mode.md` | No change — already canonical for Phase 7 |
| `docs/specs/final-architecture/09-heuristic-kb.md` | No change |
| `docs/specs/mvp/PRD.md` | F-005..F-008, F-010, F-011, F-013, F-021 already specified; no PRD change required |
| `docs/specs/mvp/tasks-v2.md` | No change in v2.3.3 (T113, T115, T116, T118-T134 unchanged from v1.0; T114 + T117 v2.3 mods retained); GR-012 discrete T-ID is a v2.3.4 punch-list candidate per plan.md §3 |
| `docs/specs/mvp/phases/INDEX.md` | v1.1 → v1.2 — Phase 7 row marked spec-shipped (this session) |
| `CLAUDE.md` | No change |

---

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| R10 TemperatureGuard accidentally bypassed | Low | High (constitutional + reproducibility) | Conformance test in CI; code review checklist; kill criterion |
| R6 LangSmith leak | Medium (first activation) | High (constitutional + competitive moat) | T134 trace inspection; rotate test traces in CI; engineering review; kill criterion |
| R5.6 violation — combined evaluate-and-critique | Low (cost-temptation scenario) | Medium (NF-06 false-positive rate) | `llm_call_log` row count assertion; kill criterion |
| GR-007 deterministic regex misses a banned phrasing variant | Medium | High (R5.3 + reputational) | Phase 0b T0B-004 lint catches at authoring; Phase 7 GR-007 catches at runtime; double layer |
| GR-012 benchmark drift detection fragile (Levenshtein threshold tuning) | Medium | Medium | Tune via real fixtures; ASK FIRST before relaxing |
| LLM persistently returns malformed JSON | Low | Medium | 2x retry + page skip; T119 handles |
| Multi-bundle cost regression (Phase 5b active) | Low | Medium | Anthropic prompt caching; per-bundle filter via T4B-013 reduces token count |
| Per-page cost spike on dense pages | Medium | Medium | T4B-013 filter caps to 12-25 heuristics; prioritizeHeuristics caps to 30 |
| Reproducibility regression (Sonnet drift across days) | Low | Medium | NF-005 = 90% (not 100%); accommodates minor drift; >10% drift triggers investigation |
| `llm_call_log` write fails atomically | Low | High (R14.1 violation) | Drizzle transaction wraps LLM call + log write; conformance test |
| Phase 8 cross-page PatternDetector reads malformed PageSignals | Low | Medium | Phase 7 emits typed PageSignals; Phase 8 consumes via Zod parse |
| Audit budget exhausts mid-page | Medium | Low | R8.2 budget gate skips remaining steps for that page; analysis_status: budget_exhausted_partial |
| Heuristic pack version mismatch between snapshot + replay | Low | Medium | reproducibility_snapshot pins heuristic_pack_hash; mismatch on replay = clean failure not silent drift |

---

## 11. Sign-off requirements

Per R20:

- [x] This impact.md exists (R20 hard requirement)
- [ ] Engineering lead sign-off on Phase 7 spec.md (`status: draft → validated → approved`)
- [ ] R10 TemperatureGuard conformance test reviewed by engineering lead BEFORE T119 implementation begins
- [ ] R6 LangSmith trace channel design reviewed by engineering lead BEFORE T119 implementation begins
- [ ] R5.6 separate-call invariant reviewed by engineering lead BEFORE T120/T121 implementation begins
- [ ] GR-012 benchmark validation tolerances (±20% quantitative; Levenshtein ≥ 0.6 qualitative) approved by product owner
- [ ] T134 integration test fixtures (homepage, PDP, checkout) curated and committed BEFORE T134 implementation begins
- [ ] Phase 6 integration test (T112) green AND Phase 0b 30-heuristic pack committed BEFORE T134 runs
- [ ] Phase 4b T4B-013 `loadForContext()` implementation green BEFORE T119 EvaluateNode wires it
- [ ] Phase 8 owner agrees to PageSignals contract surface (cross-page consumer)
- [ ] Phase 8 T135 AuditState extension coordinated with Phase 7 T113 AnalysisState extension (single PR or sequenced PRs to avoid merge conflicts)

---

## 12. Provenance (R22.2)

```yaml
why:
  source: >
    docs/specs/final-architecture/07-analyze-mode.md (canonical 5-step pipeline + grounding rules + quality gate)
    docs/specs/mvp/constitution.md R5.6 (separate self-critique provenance: ~30% false-positive reduction)
    docs/specs/mvp/constitution.md R10 + R13 (temperature=0 invariant for reproducibility F-015)
    docs/specs/mvp/constitution.md R6 (heuristic IP — LangSmith trace channel activation)
    docs/specs/mvp/constitution.md R14 (atomic llm_call_log + pre-call BudgetGate)
    docs/specs/mvp/constitution.md R15.1 (perception quality gate routing)
    docs/specs/mvp/constitution.md R15.4 (GR-012 benchmark validation — ±20% quantitative)
  evidence: >
    Phase 7 introduces the Finding lifecycle as a NEW shared producer contract. R20 mandates
    impact analysis for Finding (per R20 affected_contracts list). Five table producers go live
    (audit_log, audit_events, llm_call_log, findings, rejected_findings). Three constitutional
    invariants activate at runtime for the first time (R10 TemperatureGuard, R6 LangSmith trace
    channel, R5.6 separate self-critique). Each first activation is a critical R20 surface — a
    bypass is constitutional violation with broad downstream impact (reproducibility breaks;
    competitive moat compromised; legal/reputational exposure).
  linked_failure: >
    Anticipated risk class — first-runtime activation of constitutional invariants is where
    silent violations slip through if the test surface isn't tight. Phase 7's HIGH risk
    classification reflects: (a) historical pattern that "first-time activation" code paths
    are under-tested (no prior runtime experience to compare against); (b) the LLM call surface
    is opaque (LLM provider may silently process invalid temperature, malformed prompts);
    (c) the IP boundary (R6) extends to a third-party trace store (LangSmith) which has its
    own auth/retention model.
```
