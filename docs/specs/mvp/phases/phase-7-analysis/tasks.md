---
title: Phase 7 — Analysis Pipeline — Tasks
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
  - docs/specs/mvp/tasks-v2.md (Phase 7 section — T113-T134; T114, T117 MOD v2.3)
  - docs/specs/mvp/archive/2026-04-07-walking-skeleton/tasks.md lines 704-836 (canonical T113-T134 task definitions; declared "unchanged" in tasks-v2.md v2.3.2 except T114 + T117)
  - docs/specs/mvp/phases/phase-7-analysis/spec.md
  - docs/specs/mvp/phases/phase-7-analysis/plan.md
  - docs/specs/mvp/phases/phase-7-analysis/impact.md
  - docs/specs/final-architecture/07-analyze-mode.md §7.3-§7.13

req_ids:
  - REQ-ANALYZE-GRAPH-001
  - REQ-ANALYZE-NODE-001..005
  - REQ-ANALYZE-GROUND-001
  - REQ-ANALYZE-QUALITY-001
  - REQ-CONTEXT-DOWNSTREAM-001

impact_analysis: docs/specs/mvp/phases/phase-7-analysis/impact.md
breaking: false
affected_contracts:
  - AnalyzePerception (CONSUMER)
  - Finding lifecycle (PRODUCER)
  - AuditState (PRODUCER + CONSUMER)
  - audit_log + audit_events + llm_call_log (PRODUCER)

delta:
  new:
    - Phase 7 tasks — 22 tasks scoped view (T113-T134); canonical defs in tasks-v2.md + archived walking-skeleton tasks.md
    - GR-012 explicitly folded into T130 acceptance (no discrete T-ID per current tasks-v2.md; punch-list candidate for v2.3.4)
    - Multi-bundle iteration semantics added to T119 (Phase 5b opt-in)
    - Persona context injection added to T118/T119 per F-013
  changed: []
  impacted: []
  unchanged:
    - All 22 task IDs and base acceptance criteria; T114 + T117 v2.3 mods carried verbatim from tasks-v2.md

governing_rules:
  - Constitution R10 + R13 (temperature=0)
  - Constitution R5.6 (separate self-critique)
  - Constitution R6 (LangSmith channel — first activation)
  - Constitution R14, R15.1, R20, R23
---

# Phase 7 Tasks (T113 to T134)

> **Summary (~80 tokens):** 22 tasks. Block A (T113-T116) state + utilities. Block B (T117-T121) core LLM nodes — FIRST R10 + R5.6 + R6 LangSmith activations. Block C (T122-T134) grounding rules (parallelizable) + EvidenceGrounder + Annotate + Store + Graph + integration EXIT GATE. Total ~48h ≈ 7-9 engineering days. Canonical task definitions live in `tasks-v2.md` Phase 7 section + archived walking-skeleton `tasks.md` (declared "unchanged" except T114 + T117 v2.3 modifications).

**Source of truth:**
- T113, T115, T116, T118-T134 — `docs/specs/mvp/archive/2026-04-07-walking-skeleton/tasks.md` lines 706-832 (declared "unchanged" in `tasks-v2.md` v2.3.2)
- T114 + T117 — `docs/specs/mvp/tasks-v2.md` Phase 7 section (v2.3 MOD)

Acceptance criteria, file paths, and dependencies below mirror the canonical sources verbatim — **do NOT modify this file in lieu of updating `tasks-v2.md`** (or, for T113/T115/T116/T118-T134, the archived walking-skeleton `tasks.md`).

---

## Phase 7 sequencing

Per [plan.md](plan.md) §1: Day 1 Block A (state + utilities) → Days 2-4 Block B (core LLM — first activations) → Days 5-9 Block C (grounding parallelizable + annotation + storage + graph + integration). EXIT GATE = T134 integration test on 3 fixtures.

---

## Block A — State + Utilities (Day 1)

### T113 — AnalysisState extension
- **dep:** T081 (AuditState foundation)
- **spec:** REQ-STATE-001 (analyze fields)
- **files:** `packages/agent-core/src/orchestration/AuditState.ts` (extend with analyze fields)
- **acceptance:** All analyze-mode fields added to AuditState — `current_page_perception_bundle`, `current_page_type`, `confidence_tier`, `evaluate_findings_raw[]`, `critique_findings[]`, `grounded_findings[]`, `rejected_findings[]`, `analysis_cost_usd`, `analysis_status`, `current_page_signals` (for §7.13 cross-page emission). Zod-validated. Backward-compatible (additive only — Phase 1-5 code unaffected).
- **conformance:** AC-01

### T114 — detectPageType utility (MOD v2.3)
- **dep:** T002
- **spec:** REQ-ANALYZE-V23-001
- **files:** `packages/agent-core/src/analysis/utils/detectPageType.ts`
- **v2.3 changes:** Return type `{primary: PageType, alternatives: Array<{type, confidence}>, signalsUsed: {...}}`. Scoring weights: URL keywords × 0.4 + CTA texts × 0.3 + form signals × 0.2 + schema.org × 0.1. Result stored in `AnalyzePerception.inferredPageType`. Backward-compat accessor `.primary` for call sites that only need the enum. **NEW v0.3:** When `state.context_profile.page.type` is set (Phase 4b active), detectPageType becomes a thin reader of that value (REQ-CONTEXT-DOWNSTREAM-001 — confidence-weighted accessor with fallback to URL/CTA/form/schema inference if ContextProfile absent).
- **smoke test:** Amazon product page returns `{primary: "product", alternatives: [...], signalsUsed: {...}}`.
- **acceptance:** Returns one of: homepage, product, checkout, form, pricing, other. Ranked list with confidence scores. Primary matches pre-v2.3 enum result on test fixtures.
- **conformance:** AC-02

### T115 — assignConfidenceTier utility
- **dep:** T002
- **spec:** REQ-ANALYZE-CONF-001 (confidence-tier mapping per §7.7 spec table)
- **files:** `packages/agent-core/src/analysis/utils/assignTier.ts`
- **smoke test:** Tier 1 reliability + measurable evidence → "high" confidence_tier
- **acceptance:** Pure function `(reliability_tier: 1 | 2 | 3, evidenceType: "measurable" | "observable" | "subjective") → "high" | "medium" | "low"`. Mapping per §7.7 spec table.
- **conformance:** AC-03

### T116 — CostTracker
- **dep:** T073 (cost-tracking infra)
- **spec:** REQ-COST-LOG-001 (R14.1 atomic writes) + REQ-COST-BUDGET-001 (R14.2 pre-call gate)
- **files:** `packages/agent-core/src/analysis/CostTracker.ts`
- **smoke test:** Track 3 LLM calls; pre-call gate routes to skip when estimated > remaining; emits `audit_events` row on budget exhaust.
- **acceptance:** Per-call + cumulative cost; budget cap enforcement; pre-call BudgetGate uses `getTokenCount()` to estimate; `audit_events` row emitted on exhaust with `analysis_status: budget_exhausted_partial`.
- **conformance:** AC-04

---

## Block B — Core LLM Nodes (Days 2-4) — FIRST R10/R5.6/R6 ACTIVATIONS

### T117 — DeepPerceiveNode (MOD v2.3)
- **dep:** T048 (page_analyze tool), T046 (browser_screenshot), T025 (page_screenshot_full), T113
- **spec:** REQ-ANALYZE-NODE-001 + REQ-ANALYZE-PERCEPTION-V23-001
- **files:** `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts`
- **v2.3 changes:** Calls extended `page_analyze` with the 4 new sections (`metadata_full`, `iframes`, `accessibility`, `page_type`) alongside the baseline 9. Consumes enriched AnalyzePerception (all 14 v2.3 fields populated). `current_page_type` derived from `AnalyzePerception.inferredPageType.primary` OR from `state.context_profile.page.type` when Phase 4b active.
- **multi-bundle (5b opt-in):** When `state.perception_bundles.length > 1`, DeepPerceiveNode produces N AnalyzePerception views via `bundleToAnalyzePerception(bundle)` accessor; downstream nodes iterate per-bundle.
- **smoke test:** Run on amazon.in product page; AnalyzePerception returned with all baseline + v2.3 fields populated.
- **acceptance:** Calls page_analyze, browser_screenshot, page_screenshot_full. Returns AnalyzePerception + viewport + fullpage screenshots. Calls detectPageType (T114) to set `current_page_type`. R24 compliance: NO new perception logic; ALL perception via existing accessor + tools.
- **conformance:** AC-05

### T118 — Evaluate prompt template
- **dep:** T002
- **spec:** REQ-ANALYZE-NODE-002 + AI_Analysis_Agent_v1.0 §7.5
- **files:** `packages/agent-core/src/analysis/prompts/evaluate.ts`
- **acceptance:** System prompt + user message template match §7.5 verbatim. System prompt cached (static across audits — Anthropic prompt caching). User message contains: perception summary + filtered heuristics (R5.5 — body in user msg only) + persona context (REQ-ANALYZE-PERSONA-002 when configured) + R5.3 banned-phrasing instruction.
- **conformance:** AC-06

### T119 — EvaluateNode (FIRST R10 + R6 ACTIVATIONS)
- **dep:** T117, T118, T106 (HeuristicLoader Phase 6), T073 (cost infra), T4B-013 (Phase 4b loadForContext contract)
- **spec:** REQ-ANALYZE-NODE-002 + Constitution R10/R13 (temperature=0) + R6 (LangSmith trace channel) + R14 (atomic logging + budget gate)
- **files:** `packages/agent-core/src/analysis/nodes/EvaluateNode.ts`
- **smoke test:** Evaluate amazon product page against 5 heuristics; returns ≥3 RawFinding entries; `llm_call_log` has 1 row tag=evaluate; LangSmith trace shows heuristic IDs only (no body) in default UI payload.
- **acceptance:**
  - Filters heuristics via `HeuristicLoader.loadForContext(state.context_profile)` (Phase 4b T4B-013) → typically 12-25 heuristics; capped at 30 via prioritizeHeuristics
  - Injects filtered heuristics into LLM USER MESSAGE (R5.5)
  - Invokes `LLMAdapter.invoke({tag: 'evaluate', temperature: 0, ...})` — TemperatureGuard activates (R10/R13 first runtime)
  - LangSmith trace marks heuristic body fields private metadata (R6 first runtime)
  - Returns RawFinding[] validated by Zod
  - Retries up to 2x on malformed output; if still malformed, page skipped with `analysis_status: skipped_llm_output_invalid`
  - Atomic write to `llm_call_log` per call (R14.1)
  - Pre-call BudgetGate via `getTokenCount()` (R14.2); routes to skip on exhaust
  - When multi-bundle (5b active), iterates per bundle; tags findings with `viewport`
  - Persona injection per REQ-ANALYZE-PERSONA-002 when configured
- **conformance:** AC-07

### T120 — Self-critique prompt template
- **dep:** T002
- **spec:** REQ-ANALYZE-NODE-003 + AI_Analysis_Agent_v1.0 §7.6
- **files:** `packages/agent-core/src/analysis/prompts/selfCritique.ts`
- **acceptance:** System prompt persona DIFFERS from evaluate's persona (R5.6) — "rigorous CRO critic" vs evaluate's "CRO consultant". Code review enforces non-overlap. Levenshtein distance of system prompts ≥ N (chosen empirically post-prompt-authoring; documented in plan.md).
- **conformance:** AC-08

### T121 — SelfCritiqueNode (R5.6 SEPARATE LLM CALL)
- **dep:** T119, T120
- **spec:** REQ-ANALYZE-NODE-003 + R5.6
- **files:** `packages/agent-core/src/analysis/nodes/SelfCritiqueNode.ts`
- **smoke test:** Critique 5 raw findings; returns 5 CritiqueFinding records; ≥1 has verdict REJECT.
- **acceptance:**
  - SEPARATE `LLMAdapter.invoke({tag: 'self_critique', temperature: 0, ...})` call — NOT combined with evaluate (R5.6)
  - Applies KEEP / REVISE / DOWNGRADE / REJECT verdicts to each raw finding
  - At least 1 finding rejected on test fixture data
  - `llm_call_log` shows 2 distinct rows per page (evaluate + self_critique) — NF-06 verifies
  - System prompt persona differs from evaluate (T120)
- **conformance:** AC-09

---

## Block C1 — 8 Grounding Rules (Days 5-7, parallelizable [P])

### T122-T129 — 8 Grounding Rules [P]
- **dep:** T113
- **spec:** REQ-ANALYZE-GROUND-001 + Constitution R5.7 (GR-006) + R5.3 (GR-007)

| Task | Rule | What it checks | Conformance |
|------|------|---------------|-------------|
| T122 | GR-001 | Referenced element exists in perception | AC-10 |
| T123 | GR-002 | Above/below fold matches bounding box | AC-11 |
| T124 | GR-003 | Form field count matches actual form | AC-12 |
| T125 | GR-004 | Contrast claims have computed-style data | AC-13 |
| T126 | GR-005 | heuristic_id is in filtered set (Phase 6 loader output) | AC-14 |
| T127 | GR-006 | Critical/high severity has measurable evidence (R5.7) | AC-15 |
| T128 | GR-007 | No conversion predictions (R5.3 deterministic regex) | AC-16 |
| T129 | GR-008 | data_point references real AnalyzePerception section | AC-17 |

**Each:** `packages/agent-core/src/analysis/grounding/rules/GR-{NNN}.ts`

**Each acceptance:** Pure function signature `(finding: CritiqueFinding, perception: AnalyzePerception, filteredHeuristics: HeuristicExtended[]) → {pass: true} | {pass: false, reason: string}`. Unit test for accept case + reject case. Deterministic — NO LLM judgment.

---

## Block C2 — EvidenceGrounder + Annotate + Store (Day 8)

### T130 — EvidenceGrounder (with GR-012 folded)
- **dep:** T122-T129
- **spec:** REQ-ANALYZE-NODE-004 + R15.4 (GR-012 benchmark validation)
- **files:** `packages/agent-core/src/analysis/grounding/EvidenceGrounder.ts` + `packages/agent-core/src/analysis/grounding/rules/GR-012.ts` (NEW; folded per plan.md §3 — punch-list candidate for tasks-v2.md v2.3.4)
- **smoke test:** Ground 5 reviewed findings; ≥1 rejected.
- **acceptance:**
  - Runs all 8 GR rules (GR-001..GR-008) + GR-012 benchmark validation = 9 rules in order
  - Splits CritiqueFinding[] into `grounded[]` + `rejected[]` with `reason` per rejection
  - At least 1 rejected on test fixture data
  - Assigns `confidence_tier` via assignTier (T115)
  - GR-012 quantitative tolerance ±20% (R15.4); GR-012 qualitative Levenshtein-similarity ≥ 0.6 OR substring match
- **conformance:** AC-18

### T131 — AnnotateNode
- **dep:** T047 (page_annotate_screenshot tool), T130
- **spec:** REQ-ANALYZE-NODE-005 + F-011
- **files:** `packages/agent-core/src/analysis/nodes/AnnotateNode.ts`
- **smoke test:** Annotate viewport + fullpage screenshots with 3 findings.
- **acceptance:**
  - Calls `page_annotate_screenshot` MCP tool (Sharp under the hood) for both screenshots
  - Calculates pin positions with overlap-avoidance algorithm per §7.8
  - Pins use severity colors (critical=red, high=orange, medium=yellow, low=blue) per F-011
  - Pin diameter 28px; box stroke-width 3px; outlines visible over any background
- **conformance:** AC-19

### T132 — StoreNode
- **dep:** T074 (DB adapter), T075 (screenshot storage)
- **spec:** REQ-ANALYZE-NODE-005 + R7.3 + R7.4 + F-016
- **files:** `packages/agent-core/src/analysis/nodes/StoreNode.ts`
- **smoke test:** Store 3 findings + 2 screenshots; verify DB row counts + R2 (or local disk in dev) artifact paths.
- **acceptance:**
  - Findings persisted to `findings` table (publish_status: held by default per F-016 warm-up)
  - `rejected_findings` rows persisted (append-only per R7.4)
  - Screenshots persisted via `ScreenshotStorage` adapter (R2 in prod, disk in dev per R7.3) — NO base64 in DB
  - `audit_runs.progress` updated atomically
  - All writes in single transaction
- **conformance:** AC-20

---

## Block C3 — AnalysisGraph + Integration (Day 9 — EXIT GATE)

### T133 — AnalysisGraph (compile)
- **dep:** T117, T119, T121, T130, T131, T132
- **spec:** REQ-ANALYZE-GRAPH-001 + REQ-ANALYZE-EDGE-001..003
- **files:** `packages/agent-core/src/analysis/AnalysisGraph.ts`
- **acceptance:** 5-step graph compiles; all edges connected per §7.3; 3 routing functions (`routeAfterEvaluate`, `routeAfterCritique`, `routeAfterGround`) implemented per REQ-ANALYZE-EDGE-001..003. LangGraph compile-time validation green.
- **conformance:** AC-21

### T134 — Phase 7 integration test (EXIT GATE)
- **dep:** T133 + Phase 0b 30-heuristic pack committed (T103/T104/T105)
- **files:** `packages/agent-core/tests/integration/phase7.test.ts`
- **smoke test:** Full pipeline on 3 fixtures (homepage, PDP, checkout).
- **acceptance:**
  - **Phase 7 EXIT GATE met**
  - 3+ grounded findings per fixture
  - At least 1 finding rejected by self-critique per fixture
  - At least 1 finding rejected by evidence grounding per fixture
  - Annotated screenshots saved (viewport + fullpage)
  - Per-page cost ≤$5 (R8.2)
  - LangSmith trace inspected: NO heuristic body content in default UI payload (R6 first runtime activation verified)
  - R10 TemperatureGuard active on both LLM calls (evaluate + self_critique)
  - `llm_call_log` rows per page = 2 (evaluate + self_critique) — R5.6 verified
  - Reproducibility: re-run same fixture 24h later → finding ID overlap ≥ 90% (NF-005)
- **conformance:** AC-22 (Phase 7 EXIT GATE)

---

## Phase 7 "Done" definition

All 22 tasks merged AND all of:
- ✅ T134 integration test green on 3 fixtures
- ✅ R10 TemperatureGuard conformance test green (T119/T121)
- ✅ R6 LangSmith channel conformance test green (T134 trace inspection)
- ✅ R5.6 enforcement verified — `llm_call_log` shows 2 rows per page
- ✅ All 9 grounding rules unit tests green (AC-10..AC-18)
- ✅ Per-page cost ≤$5 across all fixtures
- ✅ Reproducibility ≥90% finding overlap (NF-005)
- ✅ Phase 7 status: `verified`
- ✅ `phase-7-current.md` rollup committed (per Constitution R19) before Phase 8 begins
