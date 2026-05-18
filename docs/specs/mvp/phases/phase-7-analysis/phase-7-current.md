---
title: Phase 7 Rollup — Current System State
artifact_type: rollup
status: approved
version: 1.0
phase_number: 7
phase_name: analysis
phase_completed_on: 2026-05-18
created: 2026-05-18
updated: 2026-05-18
owner: engineering lead
authors: [Claude (Opus 4.7)]
reviewers: [Sabari]
supersedes: phase-6-current.md
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-7-analysis/tasks.md
  - docs/specs/mvp/phases/phase-7-analysis/spec.md
  - docs/specs/mvp/phases/phase-7-analysis/plan.md
  - docs/specs/mvp/phases/phase-7-analysis/impact.md
req_ids:
  - REQ-STATE-001
  - REQ-ANALYZE-GRAPH-001
  - REQ-ANALYZE-EDGE-001..003
  - REQ-ANALYZE-NODE-001..005
  - REQ-ANALYZE-GROUND-001
  - REQ-ANALYZE-QUALITY-001..003
  - REQ-ANALYZE-RECOVERY-003
  - REQ-ANALYZE-CONF-001
  - REQ-ANALYZE-PERSONA-002
  - REQ-COST-LOG-001
  - REQ-COST-BUDGET-001
delta:
  new:
    - AnalysisState schema (raw → critique → grounded → rejected lifecycle; Zod .strict())
    - AnalysisGraph LangGraph composition (5 nodes + 4 routing edges, incl §7.10 quality gate)
    - DeepPerceiveNode entry (R24 — bundleToAnalyzePerception accessor only)
    - EvaluateNode (FIRST R10/R13 temp=0; FIRST R5.5 heuristics-in-user-msg; FIRST R6 IP boundary at LLM seam)
    - SelfCritiqueNode (R5.6 SEPARATE LLM call, KEEP/REVISE/DOWNGRADE/REJECT verdicts)
    - EvidenceGrounder 9-rule pipeline (GR-001..GR-008 + GR-012 benchmark validation)
    - 9 grounding rule pure functions (R5.3 banned phrases incl probabilistic-bypass guards; R5.7 critical-needs-measurement; R15.4 ±20% / Levenshtein)
    - AnnotateNode (page_annotate_screenshot wiring + overlap-avoidance pin positioning §7.8)
    - StoreNode (findings publishStatus='held' per F-016; rejected_findings append-only with rule+reason)
    - StorageAdapter.appendRejectedFinding (additive R20-compat extension)
    - PerceptionQualityScorer (7-signal weighted score → proceed/partial/skip; offline-shape overlay detection)
    - 4 routing functions (routeAfterPerceive, routeAfterEvaluate, routeAfterCritique, routeAfterGround)
    - confidence_tier assignment via TierValidator + assignConfidenceTier (3x3 lookup)
    - detectPageType utility (T114) — context_profile override when present
    - act-001 R5.6 persona-divergence metric (token-set Jaccard ≥ 0.5 AND zero shared 5-grams) enforced by conformance test
  changed:
    - RawFindingSchema tightened from forward-stub to spec §4.2 (status enum, structured evidence, observation/assessment min length, nullable severity, needs_review default)
    - CritiqueFindingSchema preserved (extends tightened RawFinding + verdict + revision_notes)
    - GroundedFindingSchema extended with confidence_tier (from assignTier)
    - PostgresStorage gains appendRejectedFinding impl (Drizzle rejectedFindings insert under withClient tx)
  impacted:
    - Phase 8 orchestrator consumes Finding lifecycle outputs (raw_findings, reviewed_findings, grounded_findings, rejected_findings) for cross-page aggregation
    - Phase 9 ReportGenerator consumes findings table (publishStatus filter) for PDF + dashboard
    - Phase 9 WarmupManager flips publishStatus 'held' → 'published' per F-016 graduation criteria
  unchanged:
    - Phase 6 HeuristicLoader contract (loadForContext + prioritizeHeuristics consumed unchanged)
    - Phase 4b ContextProfile shape (read via state.context_profile.page.type override seam)
    - Phase 4 LLMAdapter contract (atomic llm_call_log via AnthropicAdapter — R14.1 inherited)
    - Phase 1c PerceptionBundle accessor + WarningEmitter
    - Walking-skeleton audit.ts pipeline (EvaluateNode/SelfCritiqueNode/EvidenceGrounder/AnnotateNode/StoreNode skeleton classes preserved)
governing_rules:
  - Constitution R5.3 (R5.3 absolute conversion-prediction ban — GR-007 deterministic enforcement)
  - Constitution R5.5 (heuristics in USER MESSAGE only — system prompt static cached)
  - Constitution R5.6 (SEPARATE LLM call for self_critique + persona divergence)
  - Constitution R5.7 (critical/high severity requires measurable evidence)
  - Constitution R6 (heuristic body IP boundary — projectHeuristicPublic strips body/provenance/ai_review)
  - Constitution R7.3 (screenshot persistence via adapter — no base64 in DB)
  - Constitution R7.4 (rejected_findings append-only with rule_id + reason)
  - Constitution R9 (sole LangGraph vendor SDK import in AnalysisGraph.ts)
  - Constitution R10/R13 (temperature=0 enforcement via LLMOperation routing)
  - Constitution R14.1 (atomic llm_call_log — delegated to AnthropicAdapter)
  - Constitution R15.4 (GR-012 ±20% quantitative + Levenshtein ≥0.6 qualitative)
  - Constitution R17 (lifecycle gated by AI Reviewer verdict + human stamp)
  - Constitution R19 (Rollup per Phase)
  - Constitution R20 (impact.md for shared-contract changes; additive forward-compat)
  - Constitution R23 (kill criteria checked before each stage transition)
  - Constitution R24 (capture-only DeepPerceive — no new perception logic)
---

# Phase 7 — Analysis — Current System State Rollup

> **Summary (~250 tokens):** Phase 7 ships the analytical apex: 5-node LangGraph pipeline (deep_perceive → evaluate → self_critique → ground → annotate_store) wired with 4 routing edges (3 per §7.3 + 1 quality gate per §7.10). Finding lifecycle producer comes online: raw → critique → grounded/rejected. FIRST runtime activations land: R10/R13 TemperatureGuard (temp=0 on evaluate + self_critique), R5.6 SEPARATE LLM call discipline, R6 IP boundary at LLM serialization seam (heuristic body/provenance/ai_review stripped via `projectHeuristicPublic`), R14.1 atomic llm_call_log delegated to AnthropicAdapter. 9-rule grounding pipeline (GR-001..GR-008 + GR-012 benchmark validation) shipped as pure deterministic predicates; GR-007 enforces R5.3 conversion-prediction ban with 10-pattern regex pack (incl probabilistic-bypass guards added via Stage 2.5 review). Phase 8 orchestrator now has clean typed surface to consume `grounded_findings[]` + `rejected_findings[]` + `current_page_signals` for cross-page aggregation; Phase 9 ReportGenerator reads `findings.publishStatus='held'` (F-016 warm-up default; WarmupManager flips post-pilot).

> **Governed by:** Constitution R5.3 + R5.5 + R5.6 + R5.7 + R6 + R7.3 + R7.4 + R9 + R10 + R13 + R14 + R15.4 + R17 + R19 + R20 + R23 + R24.

---

## 1. Active modules introduced this phase

| Module | Path | Purpose | Tests |
|---|---|---|---|
| AnalysisState | `orchestration/AnalysisState.ts` | Phase 7 state slice (Zod .strict + Finding lifecycle schemas) | `tests/conformance/analysis-state.test.ts` (7) |
| AnalysisGraph | `analysis/AnalysisGraph.ts` | LangGraph 5-node + 4-edge composition (sole `@langchain/langgraph` import in analysis/) | `tests/conformance/analysis-graph.test.ts` (13) |
| edges.ts | `analysis/edges.ts` | `routeAfterEvaluate/Critique/Ground` per REQ-ANALYZE-EDGE-001..003 | (covered by analysis-graph) |
| DeepPerceiveNode entry | `analysis/nodes/DeepPerceiveNode.ts` | T117 `deepPerceiveNodeRun` (R24 — bundleToAnalyzePerception only) | `tests/conformance/deep-perceive-node.test.ts` (10) |
| evaluate prompt | `analysis/prompts/evaluate.ts` | STATIC sys prompt + builder (R5.5 + R6 + R5.3) | `tests/conformance/evaluate-prompt.test.ts` (9) |
| selfCritique prompt | `analysis/prompts/selfCritique.ts` | STATIC sys prompt + builder (R5.6 persona divergence) | `tests/conformance/self-critique-prompt.test.ts` (5) |
| EvaluateNode entry | `analysis/nodes/EvaluateNode.ts` | T119 `evaluateNodeRun` (FIRST R10/R13 + R5.5 + R6 runtime) | `tests/conformance/evaluate-node.test.ts` (13) |
| SelfCritiqueNode entry | `analysis/nodes/SelfCritiqueNode.ts` | T121 `selfCritiqueNodeRun` (R5.6 SEPARATE call) | `tests/conformance/self-critique-node.test.ts` (13) |
| 9 grounding rules | `analysis/grounding/rules/GR-001..008,012.ts` | Pure deterministic predicates | `tests/conformance/grounding-rules.test.ts` (32) |
| EvidenceGrounder | `analysis/grounding/EvidenceGrounder.ts` | T130 9-rule pipeline + confidence_tier assignment | `tests/conformance/evidence-grounder.test.ts` (11) |
| AnnotateNode entry | `analysis/nodes/AnnotateNode.ts` | T131 page_annotate_screenshot wiring + overlap avoidance | `tests/conformance/annotate-node.test.ts` (8) |
| StoreNode entry | `analysis/nodes/StoreNode.ts` | T132 findings + rejected + screenshots persistence | `tests/conformance/store-node.test.ts` (5) |
| PerceptionQualityScorer | `analysis/quality/PerceptionQualityScorer.ts` | 7-signal weighted score + routeFromQuality | `tests/conformance/quality-gate-routing.test.ts` (11) |
| assignConfidenceTier | `analysis/utils/assignTier.ts` | T115 — 3x3 (reliability_tier × evidenceType) lookup | (covered by evidence-grounder + analysis-state) |
| detectPageType | `analysis/utils/detectPageType.ts` | T114 — URL + CTA + form + schema_org inference | `tests/conformance/detect-page-type.test.ts` |
| Phase 7 integration | — | Mock-adapter end-to-end orchestration | `tests/integration/phase7.test.ts` (2 PASS + 6 it.todo env-gated) |
| StorageAdapter.appendRejectedFinding | `adapters/StorageAdapter.ts` + `adapters/PostgresStorage.ts` | Additive R20-compat extension | (covered by store-node) |

**Total Phase 7 conformance + integration: 148 tests PASS (10 it.todo env-gated for real-LLM smoke).**

---

## 2. Data contracts now in effect

| Contract | Location | Spec | Notes |
|---|---|---|---|
| `RawFindingSchema` | `orchestration/AnalysisState.ts` | AI_Analysis_Agent_v1.0 §4.2 | Tightened in T119: status/observation/assessment/structured evidence/nullable severity/needs_review/persona/viewport |
| `CritiqueFindingSchema` | same | §4.3 | Extends RawFinding + verdict + revision_notes |
| `GroundedFindingSchema` | same | §7.7 | Extends CritiqueFinding + confidence_tier + measurement |
| `RejectedFindingSchema` | same | R7.4 | Extends CritiqueFinding + rejected_by_rule + rejection_reason |
| `PageSignalsSchema` | same | §7.13 | Phase 8 cross-page consumer surface |
| `AnalysisStateSchema` | same | REQ-STATE-001 | Extends browse subset; 8 Phase 7 additions |
| `GroundingRule` | `analysis/grounding/rules/types.ts` | Block C1 acceptance | `(finding, perception, filteredHeuristics) → {pass: true} \| {pass: false, reason}` |
| `PerceptionQualityScore` | `analysis/quality/PerceptionQualityScorer.ts` | REQ-ANALYZE-QUALITY-002 | 7 signals + weighted overall + blocking_issue |
| `StorageAdapter.appendRejectedFinding` | `adapters/StorageAdapter.ts` | T132 R20-additive | New method; PostgresStorage impl via Drizzle |
| `LLMAdapter.complete({operation:'self_critique'})` | `adapters/LLMAdapter.ts` (operation seam) | R5.6 | FIRST SEPARATE-call runtime activation |

---

## 3. System flows now operational

### Flow: Per-page 5-node analyze pipeline

**Trigger:** Phase 8 orchestrator invokes `buildAnalysisGraph(deps).invoke(state)` per page.
**Steps:** `START → deep_perceive (settle gate + bundle accessor + 2 screenshots + page_type) → routeAfterPerceive (quality score → proceed/partial/skip) → evaluate (or evaluate_tier1 partial) → routeAfterEvaluate → self_critique → routeAfterCritique → ground (9 rules) → routeAfterGround → annotate_store → END`.
**Output:** `evaluate_findings_raw[]` + `critique_findings[]` + `grounded_findings[]` + `rejected_findings[]` + `analysis_status` + screenshot paths + `current_page_signals` (Phase 8 input).
**Spec:** AC-21 + AC-22 + AC-22a; REQ-ANALYZE-GRAPH-001 + REQ-ANALYZE-EDGE-001..003.

### Flow: R5.6 SEPARATE LLM call discipline

**Trigger:** SelfCritiqueNode invoked with non-empty raw findings.
**Steps:** EvaluateNode `LLMAdapter.complete({operation:'evaluate', temperature: 0, ...})` → llm_call_log row tag=evaluate. THEN SelfCritiqueNode `LLMAdapter.complete({operation:'self_critique', temperature: 0, ...})` → llm_call_log row tag=self_critique. NF-06 verifies 2 distinct rows per page.
**Output:** Two atomic rows in llm_call_log per page (verified by AnthropicAdapter R14.1 inheritance).
**Spec:** R5.6; AC-09.

### Flow: 9-rule evidence grounding

**Trigger:** EvidenceGrounder receives critique_findings.
**Steps:** Per finding, run GR-001 (element exists) → GR-002 (fold) → GR-003 (form fields) → GR-004 (contrast) → GR-005 (heuristic in filtered set) → GR-006 (R5.7 measurement) → GR-007 (R5.3 banned phrases) → GR-008 (real section) → GR-012 (benchmark ±20% / Levenshtein). First-fail wins. On all-pass: `TierValidator.validate(heuristic) → reliability_tier; deriveEvidenceType(finding) → evidenceType; assignConfidenceTier(...) → confidence_tier`. Push to grounded[] or rejected[].
**Output:** `{grounded_findings[], rejected_findings[]}`.
**Spec:** AC-18; REQ-ANALYZE-NODE-004; R5.3 + R5.7 + R15.4.

### Flow: §7.10 quality-gate routing

**Trigger:** `routeAfterPerceive` invoked after deep_perceive.
**Steps:** `computePerceptionQuality(bundle.perception)` → 7 weighted signals → overall [0,1]. Route: ≥0.6 → NODE_EVALUATE; 0.3-0.59 → NODE_EVALUATE_TIER1 (Tier 1 quantitative heuristics only); <0.3 → END (analysis_status=skipped_perception_quality_low).
**Output:** Routing decision per page; status taxonomy per REQ-ANALYZE-RECOVERY-003.
**Spec:** AC-22a; REQ-ANALYZE-QUALITY-001..003 + REQ-ANALYZE-RECOVERY-003.

### Flow: R6 IP boundary at LLM serialization seam

**Trigger:** `buildEvaluateUserMessage` called inside EvaluateNode.
**Steps:** `projectHeuristicPublic(h)` iterates heuristic fields → strips body/provenance/ai_review → JSON.stringifies remainder → injects into USER MESSAGE only. System prompt is STATIC (referentially stable across calls — cache-friendly per R5.5).
**Output:** LLM user message carries id/category/business_impact_weight/benchmark/etc. but NEVER the LLM-evaluable rule body, citation prose, or AI review prose. AC-06 conformance asserts.
**Spec:** R6; AC-06.

---

## 4. Known limitations + deferred work

1. **Real-LLM 3-fixture smoke deferred to on-demand.** `tests/integration/phase7.test.ts` ships 6 `it.todo` placeholders behind `PHASE7_INTEGRATION=1` env flag covering per-page cost ≤$5 (R8.2), R5.6 atomic llm_call_log row count, R6 LangSmith trace channel inspection, R10 TemperatureGuard runtime activation, NF-005 reproducibility ≥90% finding overlap. Manual smoke required before first external pilot. Status `verified` ⇒ requires this smoke; current status `implemented` pending.
2. **PerceptionQualityScorer overlay detection narrow.** Uses iframe `purposeGuess` only (cmp/chat). Cannot detect DOM-driven modals without live page handle. Spec-compliant for offline shape; Phase 8 may extend with `tools.page_get_element_info` integration at scorer call site.
3. **StoreNode atomicity caveat.** Each `appendFinding` / `appendRejectedFinding` opens its own withClient tx (current StorageAdapter contract). Tighter single-tx batch across all rows requires extending StorageTx with insert helpers. Deferred; append-only tables + idempotent screenshot put() bound partial-failure blast radius.
4. **4 pre-existing files >300 LOC.** loader.ts (297), types.ts (291), DeepPerceiveNode.ts (295), analyzePerception.subschemas.ts (417). None new to Phase 7; track for separate refactor PR (PG2-1).
5. **Phase 4 DB-dep tests need CI env hookup.** 6 pre-existing test failures in full suite all gated by `DATABASE_URL` / live network. Not Phase 7 work, but blocks "all tests green" gate. Tracked PG2-5.

---

## 5. Open risks for Phase 8

| Risk | Impact | Mitigation |
|---|---|---|
| `current_page_signals` cross-page consumer shape may need iteration | Phase 8 PatternDetector may request schema additions | PageSignalsSchema uses `.passthrough()` — additive forward-compat per R20 |
| TemperatureGuard runtime first-fire could surface adapter-level edge cases | Phase 8 fan-out parallelism amplifies any such bug | Real-LLM smoke (deferred) is the unblock; Phase 8 dev should pre-run it |
| StoreNode per-finding tx ⇒ partial-failure leaves orphan screenshots if first appendFinding fails | Audit run shows fewer findings than screenshots in storage | PG2-3 single-tx batch resolves; until then, Phase 8 reconciliation can drop orphan screenshot refs |
| GR-007 regex pack may still miss novel idioms emergent in real-LLM output | False-negative on banned phrases | Iterate pack on every real-LLM smoke failure; pattern ids stable so test deltas are localized |

---

## 6. Post-Gate-2 tasklist (deferred work tracked)

| # | Item | Owner | Phase |
|---|---|---|---|
| PG2-1 | Refactor 4 pre-existing files to R10.1 ≤300 LOC | tech-debt | 7a or 8 |
| PG2-2 | Extend PerceptionQualityScorer DOM-modal detection | engineering | 8 |
| PG2-3 | StoreNode single-tx batch helpers on StorageTx | engineering | 8 |
| PG2-4 | Execute real-LLM 3-fixture smoke (`PHASE7_INTEGRATION=1`) pre-pilot | manual | pre-pilot |
| PG2-5 | Phase 4 DB-dep tests need CI env hookup (DATABASE_URL) | infra | 0 |
