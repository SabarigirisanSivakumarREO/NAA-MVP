---
title: Phase 7 — Analysis Pipeline
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
  - docs/specs/mvp/PRD.md (F-005 LLM-driven evaluation, F-006 Self-critique, F-007 Evidence grounding, F-008 Confidence tiers, F-010 Persona-based eval, F-011 Annotate screenshots, F-013 Persona, F-021 Cost accounting)
  - docs/specs/mvp/constitution.md (R5 Analysis Agent — focal R5.1/R5.3/R5.6/R5.7; R6 IP — LangSmith channel activation; R10 Code Quality + temperature=0 invariant; R13 Forbidden patterns; R14 Cost accountability; R15.1 perception quality gate; R15.4 GR-012 benchmark validation; R20 impact; R23 kill criteria; R24 perception MUST NOT)
  - docs/specs/mvp/architecture.md §6.4, §6.5
  - docs/specs/mvp/tasks-v2.md (Phase 7 section — T113-T134; T114, T117 MOD v2.3)
  - docs/specs/final-architecture/07-analyze-mode.md §7.3 (pipeline graph) §7.4 (deep_perceive) §7.5 (evaluate) §7.6 (self_critique) §7.7 (ground) §7.8 (annotate_and_store) §7.9 (AnalyzePerception schema) §7.10 (perception quality gate) §7.11 (analysis error recovery) §7.12 (persona-based eval) §7.13 (cross-page integration)
  - docs/specs/final-architecture/09-heuristic-kb.md §9.1 (HeuristicSchema) §9.6 (two-stage filter)
  - docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md (PerceptionBundle accessor + `bundleToAnalyzePerception()`)
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md (T4B-013 `HeuristicLoader.loadForContext()` filter)
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/spec.md (multi-bundle iteration semantics when active)
  - docs/specs/mvp/phases/phase-6-heuristics/spec.md (HeuristicSchemaExtended + 2-stage filter contract)
  - docs/specs/mvp/phases/phase-0b-heuristics/spec.md (heuristic content producer — Phase 7 consumes filtered subset)

req_ids:
  - REQ-ANALYZE-GRAPH-001
  - REQ-ANALYZE-EDGE-001
  - REQ-ANALYZE-EDGE-002
  - REQ-ANALYZE-EDGE-003
  - REQ-ANALYZE-NODE-001               # deep_perceive
  - REQ-ANALYZE-NODE-002               # evaluate
  - REQ-ANALYZE-NODE-003               # self_critique
  - REQ-ANALYZE-NODE-004               # ground
  - REQ-ANALYZE-NODE-005               # annotate_and_store
  - REQ-ANALYZE-PERCEPTION-001
  - REQ-ANALYZE-PERCEPTION-V23-001
  - REQ-ANALYZE-GROUND-001             # 8 grounding rules + GR-012
  - REQ-ANALYZE-QUALITY-001
  - REQ-ANALYZE-QUALITY-002
  - REQ-ANALYZE-QUALITY-003
  - REQ-ANALYZE-RECOVERY-001
  - REQ-ANALYZE-RECOVERY-002
  - REQ-ANALYZE-PERSONA-001
  - REQ-ANALYZE-PERSONA-002
  - REQ-ANALYZE-PERSONA-003
  - REQ-ANALYZE-CROSSPAGE-001
  - REQ-COST-LOG-001                   # R14.1 atomic llm_call_log writes (referenced via §13)
  - REQ-COST-BUDGET-001                # R14.2 pre-call budget gate
  - REQ-CONTEXT-DOWNSTREAM-001         # Phase 4b loadForContext() integration

impact_analysis: docs/specs/mvp/phases/phase-7-analysis/impact.md
breaking: false
affected_contracts:
  - AnalyzePerception (CONSUMER — read via PerceptionBundle accessor)
  - Finding (PRODUCER — Raw / Reviewed / Grounded / Rejected lifecycle states)
  - AuditState (PRODUCER + CONSUMER — analyze fields populated; coordinated with Phase 8 T135 for context_profile_id slot)
  - audit_log (PRODUCER — append-only per R7.4)
  - audit_events (PRODUCER — per-stage events: evaluate_complete, critique_complete, ground_complete)
  - llm_call_log (PRODUCER — atomic write per call per R14.1)
  - findings (PRODUCER — internal storage per F-016 two-store pattern)
  - rejected_findings (PRODUCER — append-only per R7.4)
  - PageSignals (PRODUCER — emitted at page completion; Phase 8 cross-page consumer per §7.13)
  - LLMAdapter.evaluate / .selfCritique calls (FIRST temperature=0 runtime activation per R10/R13)
  - LangSmith trace metadata (FIRST R6 channel activation — heuristic content marked private)

delta:
  new:
    - Phase 7 spec — analysis pipeline; analytical apex of MVP
    - AC-01..AC-22 stable IDs for T113..T134 acceptance
    - R-01..R-15 functional requirements
    - First runtime activation declarations for R10 TemperatureGuard + R6 LangSmith trace channel + Finding lifecycle producer
  changed: []
  impacted:
    - AuditState analyze fields populated (Phase 8 T135 reads via state.findings + state.cross_page_signals)
    - Phase 8 cross-page PatternDetector consumes PageSignals[] emitted from Phase 7
    - R10 TemperatureGuard activates at adapter boundary (R9) — Phase 7 is the FIRST consumer
    - R6 IP boundary multi-channel enforcement: Phase 6 already activated Pino-logs channel; Phase 7 activates LangSmith trace channel; Phase 8/9 activate API + dashboard channels
    - Finding lifecycle (Raw → Reviewed → Grounded / Rejected) introduced by Phase 7 — Phase 8 / Phase 9 consume the lifecycle
  unchanged:
    - HeuristicSchemaExtended (Phase 6 owns)
    - PerceptionBundle / AnalyzePerception schemas (Phase 1/1b/1c own)
    - ContextProfile schema (Phase 4b owns)
    - LLMAdapter interface signature (R9 — Phase 7 uses existing surface)

governing_rules:
  - Constitution R5.1 (findings are HYPOTHESES not VERDICTS)
  - Constitution R5.3 + GR-007 (NEVER predict conversion impact — deterministic regex check)
  - Constitution R5.6 (self-critique is a SEPARATE LLM call with different persona)
  - Constitution R5.7 (severity tied to MEASURABLE evidence; GR-006 enforces)
  - Constitution R6 (heuristic content IP — LangSmith trace channel activation in Phase 7)
  - Constitution R9 (LLMAdapter is the only seam; TemperatureGuard at adapter boundary)
  - Constitution R10 + R13 (temperature=0 on evaluate / self_critique / evaluate_interactive)
  - Constitution R14.1 (atomic llm_call_log writes) + R14.2 (pre-call BudgetGate)
  - Constitution R15.1 (perception quality gate routes proceed / partial / skip)
  - Constitution R15.4 (GR-012 benchmark validation — claim within ±20% of actual quantitative or text-reference qualitative)
  - Constitution R17, R18, R20, R22, R23
  - Constitution R24 (Perception MUST NOT — Phase 7 reuses Phase 1/1b/1c perception via accessor; no new perception logic)
---

# Feature Specification: Phase 7 — Analysis Pipeline

> **Summary (~150 tokens — agent reads this first):** Implement the 5-step LangGraph pipeline (`deep_perceive → evaluate → self_critique → ground → annotate_and_store`) that converts a perceived page + filtered heuristic pack into a list of grounded Finding records ready for consultant review. **22 tasks (T113-T134).** First runtime activation of (a) R10/R13 TemperatureGuard at temperature=0 for evaluate + self_critique LLM calls; (b) R6 LangSmith trace channel — heuristic content marked private metadata; (c) Finding lifecycle as a producer (Raw → Reviewed → Grounded / Rejected). EvaluateNode reads filtered heuristic pack via Phase 4b `loadForContext(profile)`; injects content into LLM user message (R5.5). SelfCritiqueNode runs as a SEPARATE LLM call with a different persona (R5.6) — empirically catches ~30% more false positives than combined evaluate-critique. EvidenceGrounder applies 8 MVP rules (GR-001..GR-008) + GR-012 benchmark validation = 9 deterministic checks. Per-page budget $5 (R8.2); pre-call BudgetGate + atomic llm_call_log writes (R14).

**Feature Branch:** `phase-7-analysis` (created at implementation time)
**Input:** Phase 7 scope from `docs/specs/mvp/phases/INDEX.md` row 7 + `tasks-v2.md` Phase 7 section + `final-architecture/07-analyze-mode.md` §7.3-§7.13

---

## Mandatory References

When reading this spec, agents must already have loaded:

1. `docs/specs/mvp/constitution.md` — **R5** (focal: R5.1 hypotheses-not-verdicts; R5.3 no conversion predictions; R5.6 separate self-critique call; R5.7 severity tied to evidence); **R6** (LangSmith trace channel activation here); **R10 + R13** (temperature=0 on evaluate / self_critique / evaluate_interactive — TemperatureGuard at LLMAdapter boundary R9); **R14** (atomic llm_call_log + pre-call BudgetGate); **R15.1** (perception quality gate); **R15.4** (GR-012 benchmark validation); **R24** (Phase 7 reuses perception; no new perception logic).
2. `docs/specs/mvp/PRD.md` §F-005 (LLM evaluation), §F-006 (self-critique), §F-007 (8 grounding rules + GR-012), §F-008 (confidence tiers Tier 1/2/3), §F-010 (persona-based eval), §F-011 (annotate screenshots Sharp), §F-013 (persona context), §F-021 (cost accounting).
3. `docs/specs/final-architecture/07-analyze-mode.md` — §7.3 (5-step pipeline graph + 3 routing functions); §7.4 (`deep_perceive` REQ-ANALYZE-NODE-001); §7.5 (`evaluate` REQ-ANALYZE-NODE-002 + system prompt + user message template + Zod output schema); §7.6 (`self_critique` REQ-ANALYZE-NODE-003 + KEEP/REVISE/DOWNGRADE/REJECT verdict logic); §7.7 (`ground` REQ-ANALYZE-NODE-004 + 8 + GR-012 grounding rules); §7.8 (`annotate_and_store` REQ-ANALYZE-NODE-005 + Sharp annotation + position algorithm); §7.10 (perception quality gate per R15.1); §7.11 (analysis error recovery); §7.12 (persona-based eval); §7.13 (cross-page integration — emits PageSignals).
4. `docs/specs/final-architecture/09-heuristic-kb.md` — §9.1 (HeuristicSchema); §9.6 (two-stage filter business → page).
5. Predecessor phase rollups (load AFTER they exist):
   - `phase-1-perception/phase-1-current.md` (PageStateModel baseline)
   - `phase-1c-perception-bundle/phase-1c-current.md` (PerceptionBundle envelope + `bundleToAnalyzePerception()` accessor)
   - `phase-4b-context-capture/phase-4b-current.md` (ContextProfile + `loadForContext()`)
   - `phase-5-browse-mvp/phase-5-current.md` (single-bundle output)
   - `phase-5b-multi-viewport-triggers-cookie/phase-5b-current.md` (multi-bundle output, opt-in)
   - `phase-6-heuristics/phase-6-current.md` (HeuristicLoader + filter + decryption)
6. `docs/specs/mvp/phases/phase-0b-heuristics/spec.md` — content producer; the 30 MVP heuristics live in `heuristics-repo/`.

---

## Constraints Inherited from Neural Canonical Specs

- **R10 + R13 temperature=0** on `evaluate` + `self_critique` + `evaluate_interactive` (last is master-scope; MVP only `evaluate` + `self_critique`). TemperatureGuard at LLMAdapter boundary REJECTS calls with `temperature > 0` for these tagged calls. Phase 7 is the **FIRST runtime use** — the guard activates here.
- **R5.6 separate self-critique call.** SelfCritiqueNode MUST run as an independent LLM call with a different system prompt persona ("rigorous critique" persona vs "evaluation" persona). NO combined evaluate-and-critique single-call optimization. Cost surface: 2 LLM calls per page (evaluate + critique). Empirical justification: ~30% false-positive reduction (per Constitution R5 provenance block).
- **R5.5 heuristic injection in USER MESSAGE.** Heuristics are injected into the LLM user message (NOT system prompt — that would inflate cache misses; NOT tool call — that creates a circular dependency). Heuristic body content NEVER appears outside the user message: not in system prompt, not in logs (R6.1), not in LangSmith trace metadata except as private fields (R6.3).
- **R6 LangSmith channel activation.** Phase 6 activated the Pino-logs channel. Phase 7 activates the LangSmith trace channel: heuristic body fields are marked as **private** in trace metadata so LangSmith UI redacts them. Conformance test (T134) inspects emitted traces.
- **R5.3 + GR-007 no conversion predictions.** Deterministic regex check on `recommendation.summary` + `recommendation.details` of every Finding. Banned phrases: `/(increase|lift|boost|raise|grow|improve)\s+(conversion|conversions|CR|cr)\s+by\s+\d+%/i`. GR-007 is the LAST line of defense — also enforced at heuristic authoring time (Phase 0b T0B-004 lint), but Phase 7 enforces on LLM-generated finding text.
- **R5.7 severity tied to measurable evidence.** GR-006 grounding rule rejects Finding records with `severity ∈ {critical, high}` that lack a `measurement` field referencing AnalyzePerception data.
- **R14.1 atomic llm_call_log.** Every LLM call (`evaluate` + `self_critique` + retries) writes one row to `llm_call_log` BEFORE returning to caller. Atomicity: row write + return are a single transaction. R14.4 per-client cost attribution depends on this.
- **R14.2 pre-call BudgetGate.** Before invoking `evaluate` or `self_critique`, estimate cost from `getTokenCount()` against `state.analysis_budget_remaining_usd`. If `estimated > remaining`, route to `analysis_skip` with `reason: budget_exhausted`.
- **R15.1 perception quality gate.** Between `deep_perceive` and `evaluate`, score perception quality (7 weighted signals per §7.10). Score < 0.3 → skip page (`analysis_status: perception_quality_low`); 0.3 ≤ score < 0.6 → partial analysis (Tier 1 only); score ≥ 0.6 → full evaluate proceeds.
- **R15.4 GR-012 benchmark validation.** Quantitative benchmarks: Finding's claimed value within ±20% of actual page measurement. Qualitative benchmarks: Finding's `recommendation.details` references the heuristic's `benchmark.standard` text (Levenshtein-similarity OR substring match).
- **R24 perception MUST NOT.** Phase 7 reuses Phase 1/1b/1c perception via `bundleToAnalyzePerception(bundle)` accessor. NO new perception logic, NO direct Playwright calls, NO `page.evaluate()`. DeepPerceiveNode is a thin orchestrator that calls existing MCP tools (`page_analyze`, `browser_screenshot`, `page_screenshot_full`).
- **R8.2 per-page budget cap $5.** When `analysis_budget_usd` exhausts during a page, remaining steps for THAT page skip; audit moves to next page.
- **No new external deps.** Anthropic SDK already required (Phase 6 LLMAdapter); Sharp already required (Phase 1b annotation); Drizzle / Pino / Zod already wired. Phase 7 introduces ZERO new vendor dependencies.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Single-bundle page audit produces grounded findings (Priority: P1)

A consultant runs an audit on `https://example.com/checkout`. Phase 5 produces a single PerceptionBundle (single viewport, single state). Phase 4b ContextProfile is `{archetype: "ecommerce", page.type: "checkout", device: "desktop"}`. Phase 6 `loadForContext(profile)` returns 18 filtered heuristics. Phase 7 pipeline runs: `deep_perceive` → quality_gate (score 0.8 → proceed) → `evaluate` (LLM at temp=0, 18 heuristics × 1 persona = 18 hypothesis findings) → `self_critique` (separate LLM call rejects 5; revises 2; downgrades 1; keeps 10) → `ground` (8 + GR-012 = 9 rules; rejects 3 more) → `annotate_and_store` (7 grounded findings persisted; viewport screenshot annotated with 7 numbered pins). Total cost ≤$1.50; total wall-clock ≤45s.

**Why this priority:** This is the canonical happy path. Without it the entire MVP audit pipeline is broken.
**Independent Test:** Run the Phase 7 pipeline on a fixture checkout page; assert ≥3 grounded findings; assert ≥1 finding rejected at self-critique; assert ≥1 finding rejected at grounding; assert per-page cost ≤$5.

**Acceptance Scenarios:**

1. **Given** a PerceptionBundle for a checkout page + a ContextProfile + a 30-heuristic pack, **When** Phase 7 pipeline runs, **Then** the audit produces ≥3 grounded findings, with at least 1 rejected at self-critique and at least 1 rejected at grounding.
2. **Given** the LLM produces a finding with `recommendation.details` containing "increase conversions by 15%", **When** `ground` runs, **Then** GR-007 deterministic regex rejects the finding with `reason: r5_3_conversion_prediction_banned`.
3. **Given** the LLM produces a finding with `severity: critical` but no `measurement` field, **When** `ground` runs, **Then** GR-006 rejects with `reason: critical_severity_requires_measurable_evidence`.
4. **Given** the LLM produces a finding citing a heuristic ID not in the filtered set, **When** `ground` runs, **Then** GR-005 rejects with `reason: heuristic_id_not_in_filtered_set`.
5. **Given** the perception quality score is 0.45, **When** `quality_gate` runs, **Then** route is `partial` and only Tier 1 heuristics are evaluated (`analysis_status: partial_analysis_perception_quality_marginal`).
6. **Given** the perception quality score is 0.2, **When** `quality_gate` runs, **Then** route is `skip` and `analysis_status: skipped_perception_quality_low`; no LLM calls made for this page.

---

### User Story 2 — Multi-bundle iteration when Phase 5b multi-viewport active (Priority: P2)

When `AuditRequest.viewports = ["desktop", "mobile"]` (Phase 5b opt-in), Phase 5/5b produces TWO PerceptionBundles per page (one per viewport). Phase 7 EvaluateNode iterates over each bundle, runs evaluate + critique + ground per viewport, and emits viewport-tagged findings (`finding.viewport: "desktop" | "mobile"`). Mobile-only findings (e.g., "click target <44px on mobile") fire only against the mobile bundle; desktop-only findings against the desktop bundle.

**Why this priority:** Phase 5b is opt-in; this user story is P2 because single-viewport audits remain the default. But when 5b is active, Phase 7 MUST iterate cleanly.
**Independent Test:** Run Phase 7 against a page with 2 PerceptionBundles (desktop + mobile); assert per-viewport findings tagged correctly; assert mobile-specific heuristic fires only on mobile bundle.

**Acceptance Scenarios:**

1. **Given** 2 PerceptionBundles (desktop + mobile) for one page, **When** Phase 7 runs, **Then** `findings[]` contains entries with `viewport: "desktop"` AND entries with `viewport: "mobile"`; cost is ~2× single-viewport (NOT 2× linear because heuristic prompt + system prompt cache hits).
2. **Given** a heuristic with `device: "mobile"` and a desktop bundle, **When** EvaluateNode runs against the desktop bundle, **Then** the heuristic is filtered OUT (Phase 4b T4B-013 selector check); not evaluated.

---

### User Story 3 — R10 TemperatureGuard rejects misconfigured calls (Priority: P1 — constitutional)

A developer accidentally passes `temperature: 0.7` to `LLMAdapter.evaluate()`. The TemperatureGuard at the adapter boundary REJECTS the call before it reaches Anthropic SDK. Phase 7 EvaluateNode must surface a clear error and audit fails with `completion_reason: r10_temperature_guard_violation`. This protects reproducibility (NF-006: same inputs → ≥90% finding overlap within 24h).

**Why this priority:** Constitutional invariant. R10/R13 + reproducibility (F-015) depend on temperature=0; misconfiguration is silent at LLM provider but catastrophic for replay.
**Independent Test:** Inject a misconfigured `temperature: 0.7` call into `LLMAdapter.evaluate`; assert TemperatureGuard throws `R10TemperatureGuardError`; assert audit halts cleanly.

**Acceptance Scenarios:**

1. **Given** a developer passes `temperature: 0.7` to `LLMAdapter.evaluate`, **When** the call enters the adapter, **Then** TemperatureGuard rejects with `R10TemperatureGuardError("evaluate must use temperature=0; got 0.7")`.
2. **Given** a developer passes `temperature: 0.7` to `LLMAdapter.selfCritique`, **When** the call enters the adapter, **Then** TemperatureGuard rejects similarly.
3. **Given** TemperatureGuard rejects, **When** Phase 7 catches the error, **Then** audit halts with `completion_reason: r10_temperature_guard_violation`; `audit_events` row records the violation.

---

### User Story 4 — R6 LangSmith trace channel redacts heuristic content (Priority: P1 — constitutional)

LangSmith traces from `evaluate` and `self_critique` calls MUST mark heuristic body fields as private metadata so the LangSmith UI redacts them. A reviewer with LangSmith access SHALL see prompt structure (system + user message) but NOT see heuristic body text — only heuristic IDs.

**Why this priority:** R6 IP boundary constitutional invariant. Phase 7 is where the first LLM calls touching heuristic content fire, so this is the FIRST runtime activation of the LangSmith channel.
**Independent Test:** Run Phase 7 against a fixture with LangSmith capture enabled; inspect emitted trace; assert heuristic body absent from visible payload; assert heuristic IDs present.

**Acceptance Scenarios:**

1. **Given** Phase 7 emits a LangSmith trace for an `evaluate` call, **When** a reviewer inspects the trace, **Then** heuristic body fields are redacted; only heuristic IDs visible.
2. **Given** the trace, **When** the reviewer queries trace metadata for `private` fields, **Then** the heuristic body content is captured under `metadata.private.heuristics_payload` (not surfaced in default UI but accessible to admin role).

---

### User Story 5 — Persona-based evaluation tags findings per persona (Priority: P2)

A consultant configures the client with 2 personas (`first_time_visitor`, `returning_customer`). Phase 7 EvaluateNode runs evaluate ONCE per persona, prompts the LLM with persona context, tags each finding with `persona: "first_time_visitor" | "returning_customer"`. Findings unique to a persona (e.g., "trust badges missing — first-time visitors low trust") are tagged accordingly.

**Why this priority:** F-013 + REQ-ANALYZE-PERSONA-001..004 — the system supports personas, but a single-persona default is fine for MVP. P2 because not all clients use personas.
**Independent Test:** Run Phase 7 with 2 personas; assert findings have `persona` field set; assert per-persona finding diversity (≥1 finding unique to each persona on a fixture).

**Acceptance Scenarios:**

1. **Given** a client with 2 personas, **When** Phase 7 runs, **Then** findings carry `persona` field with one of the persona names or `null` (when no persona context active).
2. **Given** persona = `"first_time_visitor"`, **When** evaluate runs, **Then** the user message includes a `<persona>` block describing the persona's goals + frustrations.
3. **Given** the LLM produces a finding referencing the persona, **When** ground runs, **Then** the finding propagates `persona` from evaluate output unchanged.

---

### Edge Cases

- **Empty perception (no elements captured)** → quality gate routes to `skip`; `analysis_status: skipped_empty_perception`.
- **LLM returns malformed JSON** → EvaluateNode retries up to 2x with stricter system prompt rider; if still malformed, page skipped with `analysis_status: skipped_llm_output_invalid`.
- **LLM call times out (>60s)** → adapter throws `LLMTimeoutError`; Phase 7 retries 1x; on second timeout, page skipped.
- **Heuristic IP leak detected in error message** → R6 violation; throw R6Error; audit halts; engineering review.
- **Self-critique produces no rejections** (KEEP all) → acceptable; SelfCritiqueNode does NOT mandate ≥1 rejection; only logs warning if rejection rate <10% across full audit (audit_complete summary).
- **Grounding rejects all findings** → page completes with 0 grounded findings; `analysis_status: complete_no_findings`. Audit continues.
- **Finding has no bbox in AnalyzePerception** → AnnotateNode emits the finding without a pin (textual reference only); not a fatal error.
- **Multi-bundle (Phase 5b) — desktop bundle quality 0.8, mobile bundle quality 0.2** → desktop proceeds full; mobile skipped; per-bundle `analysis_status` set; cross-page emit reflects partial coverage.
- **GR-012 quantitative benchmark drift > ±20%** → finding rejected with `reason: gr_012_benchmark_drift`. LLM-claimed value wrong; logged for prompt-tuning analysis.
- **Persona context missing for a configured client** → falls back to single null-persona evaluate (REQ-ANALYZE-PERSONA-003 — `persona: null`).
- **AuditRequest.budget exhausted mid-page** → remaining nodes for THAT page skipped; `analysis_status: budget_exhausted_partial`.
- **`audit_log` write fails (DB outage)** → atomic transaction rolls back; LLM call retried once after backoff; if still fails, page errors with `analysis_status: error_db_unavailable`.

---

## Acceptance Criteria *(mandatory — stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked REQ-ID(s) |
|----|-----------|----------------------|------------------|
| AC-01 | T113 AnalysisState extends AuditState with analyze fields (`current_page_perception_bundle`, `current_page_type`, `confidence_tier`, `evaluate_findings_raw[]`, `critique_findings[]`, `grounded_findings[]`, `rejected_findings[]`, `analysis_cost_usd`, `analysis_status`); Zod-validated. | `packages/agent-core/tests/conformance/analysis-state.test.ts` | REQ-STATE-001 |
| AC-02 | T114 detectPageType returns `{primary: PageType, alternatives: Array<{type, confidence}>, signalsUsed}` per v2.3; primary matches pre-v2.3 enum on test fixtures; signal weights URL×0.4 + CTA×0.3 + form×0.2 + schema.org×0.1. | `packages/agent-core/tests/conformance/detect-page-type.test.ts` | REQ-ANALYZE-V23-001 |
| AC-03 | T115 assignConfidenceTier maps `(reliability_tier, evidenceType)` → `confidence_tier ∈ {high, medium, low}` per spec table. | `packages/agent-core/tests/conformance/assign-tier.test.ts` | REQ-ANALYZE-CONF-001 |
| AC-04 | T116 CostTracker maintains per-call + cumulative cost; pre-call budget gate routes to skip when `estimated > remaining`; emits `audit_events` rows on budget exhaust. | `packages/agent-core/tests/conformance/cost-tracker.test.ts` | REQ-COST-LOG-001, REQ-COST-BUDGET-001 |
| AC-05 | T117 DeepPerceiveNode wraps `bundleToAnalyzePerception(bundle)` accessor; calls `browser_screenshot` + `page_screenshot_full` MCP tools; populates `state.current_page_perception_bundle` + `state.current_page_type` (from `state.context_profile.page.type` if set, else from detectPageType). | `packages/agent-core/tests/conformance/deep-perceive-node.test.ts` | REQ-ANALYZE-NODE-001, REQ-ANALYZE-PERCEPTION-V23-001 |
| AC-06 | T118 evaluate prompt template matches §7.5 verbatim (system prompt cached; user message includes perception summary + filtered heuristics + persona context). Heuristic body present in user message ONLY. | `packages/agent-core/tests/conformance/evaluate-prompt.test.ts` | REQ-ANALYZE-NODE-002 |
| AC-07 | T119 EvaluateNode invokes LLMAdapter.evaluate at temperature=0 (TemperatureGuard activates); returns `RawFinding[]` validated by Zod; retries up to 2x on malformed output; emits `audit_events` row per call. | `packages/agent-core/tests/conformance/evaluate-node.test.ts` | REQ-ANALYZE-NODE-002, R10, R13 |
| AC-08 | T120 self-critique prompt template matches §7.6 verbatim with DIFFERENT system prompt persona ("rigorous CRO critic" vs evaluate's "CRO consultant"). | `packages/agent-core/tests/conformance/self-critique-prompt.test.ts` | REQ-ANALYZE-NODE-003, R5.6 |
| AC-09 | T121 SelfCritiqueNode runs as SEPARATE LLM call (not combined with evaluate); applies KEEP / REVISE / DOWNGRADE / REJECT verdicts; ≥1 of 5 raw findings rejected on test fixture. | `packages/agent-core/tests/conformance/self-critique-node.test.ts` | REQ-ANALYZE-NODE-003, R5.6 |
| AC-10 | T122 GR-001 (referenced element exists in perception): pure function `(finding, perception) → {pass, reason?}`; unit test covers pass + reject case. | `packages/agent-core/tests/conformance/gr-001.test.ts` | REQ-ANALYZE-GROUND-001, GR-001 |
| AC-11 | T123 GR-002 (above/below fold matches bbox): pure function; pass + reject. | `packages/agent-core/tests/conformance/gr-002.test.ts` | REQ-ANALYZE-GROUND-001, GR-002 |
| AC-12 | T124 GR-003 (form field count matches actual form): pure function; pass + reject. | `packages/agent-core/tests/conformance/gr-003.test.ts` | REQ-ANALYZE-GROUND-001, GR-003 |
| AC-13 | T125 GR-004 (contrast claims have computed-style data): pure function; pass + reject. | `packages/agent-core/tests/conformance/gr-004.test.ts` | REQ-ANALYZE-GROUND-001, GR-004 |
| AC-14 | T126 GR-005 (heuristic_id is in filtered set): pure function; pass + reject. | `packages/agent-core/tests/conformance/gr-005.test.ts` | REQ-ANALYZE-GROUND-001, GR-005 |
| AC-15 | T127 GR-006 (critical/high severity has measurable evidence): pure function; pass + reject. | `packages/agent-core/tests/conformance/gr-006.test.ts` | REQ-ANALYZE-GROUND-001, GR-006, R5.7 |
| AC-16 | T128 GR-007 (no conversion predictions): deterministic regex on `recommendation.summary` + `recommendation.details`; pass + reject. | `packages/agent-core/tests/conformance/gr-007.test.ts` | REQ-ANALYZE-GROUND-001, GR-007, R5.3 |
| AC-17 | T129 GR-008 (data_point references real section): pure function; pass + reject. | `packages/agent-core/tests/conformance/gr-008.test.ts` | REQ-ANALYZE-GROUND-001, GR-008 |
| AC-18 | T130 EvidenceGrounder runs all 8 GR rules + GR-012 benchmark validation in order; splits findings into `grounded[]` + `rejected[]` with `reason` per rejection; assigns `confidence_tier` via assignTier; ≥1 rejected on test fixture. | `packages/agent-core/tests/conformance/evidence-grounder.test.ts` | REQ-ANALYZE-NODE-004, R15.4 |
| AC-19 | T131 AnnotateNode wraps `page_annotate_screenshot` MCP tool; positions pins with overlap avoidance; severity colors per F-011; viewport + fullpage annotated. | `packages/agent-core/tests/conformance/annotate-node.test.ts` | REQ-ANALYZE-NODE-005 |
| AC-20 | T132 StoreNode persists findings (typed) + screenshots (R2 in prod / disk in dev); audit_run progress updated; atomic transaction (R7.4 append-only). | `packages/agent-core/tests/conformance/store-node.test.ts` | REQ-ANALYZE-NODE-005 |
| AC-21 | T133 AnalysisGraph compiles all 5 nodes + 3 routing edges (`routeAfterEvaluate`, `routeAfterCritique`, `routeAfterGround`) per §7.3; LangGraph state graph well-formed. | `packages/agent-core/tests/conformance/analysis-graph.test.ts` | REQ-ANALYZE-GRAPH-001, REQ-ANALYZE-EDGE-001..003 |
| AC-22 | T134 Phase 7 integration test (end-to-end): full pipeline on 3 test fixtures (homepage, PDP, checkout); each yields ≥3 grounded findings; ≥1 rejected at self-critique; ≥1 rejected at grounding; per-page cost ≤$5; LangSmith trace inspected — no heuristic body content visible (R6); R10 TemperatureGuard active on both LLM calls. | `packages/agent-core/tests/integration/phase7.test.ts` | (Phase 7 EXIT GATE) |

---

## Functional Requirements *(mandatory — cross-ref existing PRD F-IDs where applicable)*

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System SHALL implement the 5-step LangGraph pipeline `deep_perceive → quality_gate → evaluate → self_critique → ground → annotate_and_store` per §7.3 with 3 routing functions per §7.3 REQ-ANALYZE-EDGE-001..003. | F-005 | §7.3 |
| R-02 | DeepPerceiveNode SHALL be a thin orchestrator over Phase 1c PerceptionBundle accessor; SHALL NOT introduce new perception logic (R24). When Phase 5b multi-viewport is active, DeepPerceiveNode iterates over multiple bundles emitted by browse mode. | F-005 | §7.4, R24 |
| R-03 | Quality gate (per §7.10 + R15.1) SHALL run between deep_perceive and evaluate; score < 0.3 → skip; 0.3-0.59 → partial Tier 1 only; ≥ 0.6 → full evaluate. Each non-proceed routing emits an `audit_events` row with `analysis_status` reason. | F-005 + F-021 | §7.10 |
| R-04 | EvaluateNode SHALL invoke `LLMAdapter.evaluate` at temperature=0 (TemperatureGuard at adapter boundary enforces); SHALL inject filtered heuristics into the LLM USER MESSAGE (R5.5); SHALL retry up to 2x on malformed JSON. Returns `RawFinding[]`. | F-005 | §7.5, R5.5, R10, R13 |
| R-05 | SelfCritiqueNode SHALL run as a SEPARATE LLM call (NOT combined with evaluate) using a DIFFERENT system prompt persona (R5.6); SHALL apply KEEP / REVISE / DOWNGRADE / REJECT verdicts to each raw finding; SHALL emit `audit_events` row per call. | F-006 | §7.6, R5.6 |
| R-06 | EvidenceGrounder SHALL run 8 MVP grounding rules (GR-001..GR-008) + GR-012 benchmark validation (R15.4) in order; SHALL split findings into `grounded[]` + `rejected[]` with `reason`; SHALL assign `confidence_tier` via assignTier (T115). Each rule is a pure function with deterministic logic — NO LLM judgment. | F-007 + F-008 | §7.7, R5.7, R15.4 |
| R-07 | GR-007 SHALL be a deterministic regex check enforcing R5.3 (no conversion predictions); regex `/(increase|lift|boost|raise|grow|improve)\s+(conversion|conversions|CR|cr)\s+by\s+\d+%/i`; matches in `recommendation.summary` OR `recommendation.details` reject the finding. | F-007 | §7.7, R5.3 |
| R-08 | GR-012 SHALL validate benchmark claims (R15.4): quantitative — finding's claimed value within ±20% of actual page measurement (e.g., heuristic claims "≤8 form fields"; finding cites 12; perception confirms 12; reject if claim differs >20% from page measurement); qualitative — finding's `recommendation.details` references the heuristic's `benchmark.standard` text via Levenshtein-similarity ≥ 0.6 OR substring match. | F-007 | §7.7, R15.4 |
| R-09 | AnnotateNode SHALL invoke `page_annotate_screenshot` MCP tool (Sharp under the hood per F-011); SHALL position pins with overlap avoidance per §7.8 algorithm; severity colors per F-011 (critical=red, high=orange, medium=yellow, low=blue). | F-011 | §7.8 |
| R-10 | StoreNode SHALL persist `grounded_findings` + `rejected_findings` to DB via `findings` + `rejected_findings` tables (append-only per R7.4); SHALL persist screenshots via `ScreenshotStorage` adapter (R2 in prod, disk in dev per R7.3); SHALL update `audit_runs.progress`. | F-016 | §7.8, R7.3, R7.4 |
| R-11 | EvaluateNode + SelfCritiqueNode SHALL log every LLM call atomically to `llm_call_log` per R14.1; SHALL pass pre-call BudgetGate per R14.2 (estimate from `getTokenCount()`); SHALL be redacted in LangSmith trace metadata for heuristic body fields (R6.3). | F-021 | §7.5, §7.6, R14.1, R14.2, R6.3 |
| R-12 | When Phase 5b multi-viewport is active and `state.perception_bundles.length > 1`, EvaluateNode SHALL iterate over each bundle independently; each finding tagged with `viewport: "desktop" | "mobile"`. Phase 4b `loadForContext()` filter applies per-bundle (mobile-only heuristics excluded from desktop bundle). | F-005 | Phase 5b spec, T4B-013 |
| R-13 | EvaluateNode SHALL inject persona context (REQ-ANALYZE-PERSONA-002) into the LLM user message when client profile has personas configured; each finding tagged with `persona: string | null`. Default 2-3 personas per business type per REQ-ANALYZE-PERSONA-004. | F-013 | §7.12 |
| R-14 | At page completion (after StoreNode), EvaluateNode (or a downstream emitter) SHALL emit a `PageSignals` extract for cross-page analysis (REQ-ANALYZE-CROSSPAGE-001) — Phase 8 cross-page PatternDetector consumes. | F-014 | §7.13 |
| R-15 | Analysis error recovery (§7.11 + REQ-ANALYZE-RECOVERY-001..003): every page gets an `analysis_status` ∈ {complete, partial_quality, partial_budget, skipped_*, error_*}. Audit NEVER silently drops a page. `audit_complete` reports breakdown ("47/50 fully analyzed, 2 partially analyzed, 1 skipped"). | F-005 + F-021 | §7.11 |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-01 | Per-page analysis cost (evaluate + self-critique + retries) | ≤$5 (R8.2) | NF-002 | Sum of `llm_call_log.cost_usd` per audit_run + page |
| NF-02 | Per-page wall-clock time (5 nodes end-to-end) | ≤90s p50 | NF-005 | Phase 7 integration test timer per fixture |
| NF-03 | EvaluateNode evaluate-prompt input tokens (perception + heuristics + persona + system) | ≤32K p99 | NF-001 | `getTokenCount()` log per call |
| NF-04 | SelfCritiqueNode input tokens | ≤12K p99 | NF-001 | Same |
| NF-05 | Reproducibility — same inputs (PerceptionBundle hash + heuristic pack hash + ContextProfile hash + temperature=0) → finding overlap | ≥90% within 24h (F-015) | NF-006 | Replay test against fixtures; Jaccard similarity of finding ID sets |
| NF-06 | Self-critique false-positive reduction (vs combined evaluate-and-critique) | ≥30% (R5.6 evidence) | — | Manual labeling of 30 raw findings; compare KEEP-rate with vs without separate critique |
| NF-07 | Heuristic content leakage to LangSmith trace (R6.3) | 0 occurrences | — | T134 trace inspection asserting no heuristic body in visible payload |
| NF-08 | TemperatureGuard rejection latency (developer-error fast-fail) | <10ms | — | Unit test |

---

## Key Entities

- **AnalysisState (extends AuditState):** Adds `current_page_perception_bundle`, `current_page_type`, `confidence_tier`, `evaluate_findings_raw[]`, `critique_findings[]`, `grounded_findings[]`, `rejected_findings[]`, `analysis_cost_usd`, `analysis_status`, `current_page_signals` (for §7.13 cross-page emission). Zod-validated.
- **RawFinding:** Output of EvaluateNode; matches §7.5 Zod output schema (heuristic_id, name, severity, evidence, recommendation, persona).
- **CritiqueFinding:** Output of SelfCritiqueNode; adds `verdict ∈ {KEEP, REVISE, DOWNGRADE, REJECT}` + `revision_notes`.
- **GroundedFinding:** Output of EvidenceGrounder; CritiqueFinding that passed all grounding rules; gets `confidence_tier` + `measurement` (when severity ≥ high).
- **RejectedFinding:** CritiqueFinding (or RawFinding for early-reject paths) that failed a grounding rule; records `rejected_by_rule` + `rejection_reason`. Persisted to `rejected_findings` (append-only).
- **PageSignals:** Lightweight extract emitted at page completion (REQ-ANALYZE-CROSSPAGE-001) — heuristic IDs that fired, severity counts, page_type, viewport. Phase 8 cross-page consumer.
- **TemperatureGuard:** Decorator/middleware at `LLMAdapter` boundary (R9); rejects calls tagged `evaluate` / `self_critique` / `evaluate_interactive` if `temperature !== 0`. Throws `R10TemperatureGuardError`.
- **PersonaContext:** §7.12 + F-013 entity; configured per client; injected into evaluate user message when present; tagged on each finding.
- **PerceptionQualityScore:** §7.10 + R15.1; 7 weighted signals → score ∈ [0, 1] → routing decision (proceed / partial / skip).

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** Phase 7 integration test passes on 3 fixtures (homepage, PDP, checkout) — each yields ≥3 grounded findings; ≥1 rejected at self-critique; ≥1 rejected at grounding.
- **SC-002:** Per-page analysis cost ≤$5 across all fixtures (R8.2 enforced via budget gate).
- **SC-003:** Per-page wall-clock ≤90s p50 on fixture set.
- **SC-004:** Reproducibility: same fixture + same heuristic pack + temp=0 → finding ID overlap ≥90% across two consecutive runs (NF-005).
- **SC-005:** R10 TemperatureGuard active — no `evaluate` / `self_critique` call escapes adapter boundary with `temperature > 0` (NF-08 + AC-07 / AC-09).
- **SC-006:** R6 LangSmith channel active — heuristic body content NOT visible in trace UI; only IDs present (NF-07 + AC-09 trace inspection assertion).
- **SC-007:** GR-007 deterministic regex catches conversion-rate predictions — 0 published findings contain banned phrasing (R5.3 + AC-16).
- **SC-008:** GR-012 benchmark validation rejects findings whose quantitative claims drift >±20% from page measurement (R15.4 + AC-18 reject case).
- **SC-009:** Analysis status taxonomy complete — every page in fixture run has a non-null `analysis_status` value; audit_complete summary lists breakdown (R-15 / NF — coverage).

---

## Constitution Alignment Check *(mandatory — must pass before status: approved)*

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — T128 GR-007 deterministic regex check, AC-16; LLM also constrained via system prompt.
- [x] Does NOT auto-publish findings without consultant review (warm-up rule, F-016) — Phase 7 produces findings with `publish_status: held`; warm-up enforcement is Phase 8 / Phase 9.
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — `audit_log`, `audit_events`, `llm_call_log`, `findings`, `rejected_findings` all append-only.
- [x] Does NOT import vendor SDKs outside adapters (R9) — Anthropic SDK only via LLMAdapter; Drizzle only via StorageAdapter; Sharp via existing F-011 wrapper.
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` (R10/R13) — TemperatureGuard at adapter boundary; AC-07 / AC-09 / NF-08 verify.
- [x] Does NOT expose heuristic content outside the LLM evaluate prompt (R6) — system prompt cached without heuristics; user message holds heuristics; LangSmith trace channel marks heuristic fields private (R6.3); Pino logs only IDs (R6.4 — Phase 6's redaction config inherits).
- [x] DOES include a conformance test stub for every AC-NN (PRD §9.6 + R3 TDD) — AC-01..AC-22 each have a test path.
- [x] DOES carry frontmatter delta block on subsequent edits (R18)
- [x] DOES define kill criteria for tasks > 2 hrs OR shared-contract changes (R23) — tracked in plan.md (R10 violation, R6 leak, malformed-output cycles, budget overruns, finding-quality regression).
- [x] DOES reference REQ-IDs from `docs/specs/final-architecture/` for every R-NN (R11.2) — all 15 cite REQ-ANALYZE-NODE-NNN / REQ-ANALYZE-GROUND-001 / REQ-ANALYZE-QUALITY-NNN / REQ-COST-LOG-001 / REQ-CONTEXT-DOWNSTREAM-001 / REQ-ANALYZE-PERSONA-NNN / REQ-ANALYZE-CROSSPAGE-001.

---

## Out of Scope (cite PRD §3.2 explicit non-goals)

- **Per-state screenshots** (REQ-ANALYZE-NODE-001a/b/c/d) — DEFERRED to Phase 13 master scope (state graph). Phase 7 captures viewport + fullpage only.
- **`evaluate_interactive` tool** (§33 dual-mode evaluation) — DEFERRED to Phase 13 master. Phase 7 ships single-state evaluation only (`StaticEvaluateStrategy`).
- **MultiAgent / agent composition** (§33a integration) — DEFERRED to Phase 13.
- **Per-state finding consolidation** (state-graph-aware multi-state findings) — DEFERRED.
- **Authoring new heuristics during analysis** — explicit non-goal; Phase 0b owns authoring.
- **Conversion-rate prediction** (permanent non-goal, R5.3 + GR-007).
- **Authenticated pages** (PRD §3.2 permanent non-goal).
- **Dashboard / consultant review UI** — Phase 9 owns.
- **PDF report generation** — Phase 9 owns.
- **Email notifications** — Phase 9 owns.

---

## Assumptions

- Phase 6 HeuristicLoader + 2-stage filter + DecryptionAdapter shipped (T101-T112) before Phase 7 implementation begins.
- Phase 0b heuristic content (T103/T104/T105 — 30 heuristics) committed before Phase 7 integration test (T134) runs.
- Phase 1c PerceptionBundle accessor (`bundleToAnalyzePerception()`) shipped (T1C-001..T1C-012); single-bundle path is default; multi-bundle path activates when Phase 5b is opt-in active.
- Phase 4b ContextProfile + `loadForContext()` shipped (T4B-001..T4B-015); EvaluateNode reads ContextProfile via accessor.
- LLMAdapter interface (Phase 6) supports `evaluate` + `selfCritique` calls with `tag` field that activates TemperatureGuard.
- Anthropic SDK available; primary model `claude-sonnet-4-*`; failover GPT-4o DEFERRED to v1.2 (CLAUDE.md §2 — MVP is Claude-only).
- Sharp wired in Phase 1b (annotation pipeline) — Phase 7 reuses.
- Pino redaction config + LangSmith trace metadata redaction strategy authored in Phase 6 v0.3 — Phase 7 inherits + extends to LangSmith channel.
- Drizzle migrations for `findings`, `rejected_findings`, `audit_events`, `llm_call_log` shipped in Phase 4 schema baseline (T070).
- Cross-page PatternDetector (§F-014) is Phase 8 — Phase 7 only emits PageSignals at page completion.

---

## Next Steps

After this spec is approved (`status: draft → validated → approved`):

1. Run `/speckit.plan` to generate plan.md (already drafted alongside this spec).
2. Run `/speckit.tasks` to align tasks.md with `tasks-v2.md` T113-T134.
3. Run `/speckit.analyze` for cross-artifact consistency.
4. Phase 7 implementation begins after Phase 5 + Phase 6 + Phase 1c + Phase 4b ship and their rollups are approved. Phase 5b is OPTIONAL — Phase 7 supports both single- and multi-bundle paths.
5. Implementation order: T113-T116 (state + utilities) → T117 + T118-T119 (perceive + evaluate) → T120-T121 (self-critique) → T122-T129 + T130 (grounding) → T131-T132 (annotate + store) → T133 (graph) → T134 (integration / EXIT GATE).
