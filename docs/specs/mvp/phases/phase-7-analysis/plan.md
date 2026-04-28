---
title: Phase 7 — Analysis Pipeline — Implementation Plan
artifact_type: plan
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
  - docs/specs/mvp/phases/phase-7-analysis/spec.md
  - docs/specs/mvp/tasks-v2.md (T113-T134)
  - docs/specs/final-architecture/07-analyze-mode.md §7.3-§7.13
  - docs/specs/mvp/archive/2026-04-07-walking-skeleton/tasks.md (canonical T113-T134 task definitions)

req_ids:
  - REQ-ANALYZE-GRAPH-001
  - REQ-ANALYZE-NODE-001..005
  - REQ-ANALYZE-GROUND-001
  - REQ-ANALYZE-QUALITY-001
  - REQ-CONTEXT-DOWNSTREAM-001
  - REQ-COST-LOG-001
  - REQ-COST-BUDGET-001

impact_analysis: docs/specs/mvp/phases/phase-7-analysis/impact.md
breaking: false
affected_contracts:
  - AnalyzePerception (CONSUMER)
  - Finding lifecycle (PRODUCER)
  - AuditState (PRODUCER + CONSUMER)
  - audit_log + audit_events + llm_call_log (PRODUCER)
  - LLMAdapter.{evaluate, selfCritique} (FIRST temp=0 runtime)
  - LangSmith trace metadata (FIRST R6 channel)

delta:
  new:
    - Phase 7 plan — sequencing, R10/R5.6/R6 first-activation strategy, kill criteria
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R5.6 (separate self-critique LLM call)
  - Constitution R6 (LangSmith trace channel activation in Phase 7)
  - Constitution R10 + R13 (temperature=0 — first runtime use)
  - Constitution R14 (atomic llm_call_log + pre-call BudgetGate)
  - Constitution R15.1 (perception quality gate)
  - Constitution R20 (Impact Analysis)
  - Constitution R23 (Kill Criteria)
  - Constitution R24 (Perception MUST NOT)
---

# Phase 7 Implementation Plan

> **Summary (~120 tokens):** Implement 22 tasks (T113-T134) over ~7-9 engineering days in 3 sub-blocks: **Block A** state + utilities (T113-T116, ~1 day), **Block B** core LLM nodes (T117-T121, ~3 days — first R10 + first R5.6 + first R6 LangSmith activation), **Block C** grounding + annotation + storage + graph + integration (T122-T134, ~3-5 days, GR rules parallelizable). Kill criteria: any R10/R6 violation found mid-implementation → STOP; >2 self-critique combined-call attempts → STOP (R5.6 non-negotiable); >5 LLM-malformed-output cycles in same fixture → STOP (prompt protocol drift); per-page cost >$5 → STOP (R8.2). Phase 7 EXIT GATE: T134 integration test green on 3 fixtures.

---

## 1. Sequencing

```
Day 1 (Block A — state + utilities; ~6h):
  T113 AnalysisState extension                             — extend AuditState with analyze fields
  T114 detectPageType (MOD v2.3)                           — ranked list + signals; reads ContextProfile.page.type when set
  T115 assignConfidenceTier                                — pure function (reliability_tier × evidenceType) → tier
  T116 CostTracker                                         — per-call + cumulative; pre-call BudgetGate; emits audit_events on exhaust

Day 2-4 (Block B — core LLM nodes; ~16h):
  T117 DeepPerceiveNode (MOD v2.3)                         — wraps bundleToAnalyzePerception; calls page_analyze + screenshots
  T118 evaluate prompt template                            — system (cached) + user (perception + heuristics + persona)
  T119 EvaluateNode                                        — FIRST R10 TemperatureGuard activation; FIRST R6 LangSmith channel
  T120 self-critique prompt template                       — DIFFERENT system persona ("rigorous CRO critic")
  T121 SelfCritiqueNode                                    — SEPARATE LLM call (R5.6); KEEP/REVISE/DOWNGRADE/REJECT verdicts

Day 5-7 (Block C1 — grounding rules; parallelizable ~12h):
  T122 GR-001 element-exists                               (parallel — pure functions)
  T123 GR-002 fold-bbox-match
  T124 GR-003 form-field-count-match
  T125 GR-004 contrast-claims-have-data
  T126 GR-005 heuristic-id-in-filtered-set
  T127 GR-006 critical-severity-has-measurement            (R5.7 enforcement)
  T128 GR-007 no-conversion-predictions                    (R5.3 enforcement; deterministic regex)
  T129 GR-008 data_point-references-real-section
  + GR-012 benchmark-validation                            (R15.4; folded into T130 acceptance — see §3 below)
  T130 EvidenceGrounder                                    — runs all 9 rules in order; assigns confidence_tier

Day 8 (Block C2 — annotation + storage; ~4h):
  T131 AnnotateNode                                        — Sharp via page_annotate_screenshot MCP tool
  T132 StoreNode                                           — findings + screenshots + audit_run progress; atomic txn

Day 9 (Block C3 — graph + integration; EXIT GATE; ~6h):
  T133 AnalysisGraph                                       — compile 5 nodes + 3 routing edges
  T134 Phase 7 integration test                            — full pipeline on 3 fixtures; cost + reproducibility + R6/R10 invariants
```

Dependencies (from tasks-v2.md + archived walking-skeleton):
- T113 ← T081 (AuditState foundation)
- T114, T115, T116 ← T002 (skeleton); T116 also ← T073 (cost-tracking infra)
- T117 ← T048 (page_analyze tool), T046 (browser_screenshot), T025 (page_screenshot_full), T113
- T119 ← T117, T118, T106 (HeuristicLoader Phase 6), T073 (cost infra), T4B-013 (ContextProfile filter — Phase 4b)
- T121 ← T119, T120
- T122-T129 ← T113 (parallelizable)
- T130 ← T122-T129 + GR-012 (folded)
- T131 ← T047 (page_annotate_screenshot tool), T130
- T132 ← T074 (DB adapter), T075 (screenshot storage)
- T133 ← T117, T119, T121, T130, T131, T132
- T134 ← T133 + Phase 0b 30-heuristic pack committed

---

## 2. R10 + R6 + R5.6 First-Activation Strategy

Phase 7 is the FIRST place these constitutional invariants are enforced at runtime. Activation strategy:

### 2.1 R10 + R13 TemperatureGuard activation (T119 + T121)

`LLMAdapter` interface (Phase 6) exposes calls with a `tag` field:

```ts
interface LLMAdapter {
  invoke(args: {
    tag: 'evaluate' | 'self_critique' | 'evaluate_interactive' | 'general';
    system: string;
    messages: Message[];
    temperature: number;
    // ...
  }): Promise<LLMCallResult>;
}
```

TemperatureGuard wraps the adapter:

```ts
function withTemperatureGuard(adapter: LLMAdapter): LLMAdapter {
  const TEMP_ZERO_TAGS = new Set(['evaluate', 'self_critique', 'evaluate_interactive']);
  return {
    async invoke(args) {
      if (TEMP_ZERO_TAGS.has(args.tag) && args.temperature !== 0) {
        throw new R10TemperatureGuardError(
          `[R10/R13] tag=${args.tag} requires temperature=0; got ${args.temperature}`
        );
      }
      return adapter.invoke(args);
    }
  };
}
```

Phase 7 EvaluateNode (T119) and SelfCritiqueNode (T121) pass `tag: 'evaluate'` and `tag: 'self_critique'` respectively, with `temperature: 0`. Conformance test (T119/T121) injects `temperature: 0.7` to assert the guard fires.

### 2.2 R6 LangSmith trace channel activation (T119 + T121)

Phase 6 v0.3 added Pino redaction config for heuristic fields. Phase 7 extends to LangSmith:

```ts
// In LLMAdapter.invoke, when LangSmith tracing is enabled:
const traceMetadata = {
  audit_run_id: state.audit_run_id,
  page_url: state.current_page_url,
  node_name: 'evaluate',
  // PRIVATE fields — LangSmith UI redacts these to admin role only:
  private: {
    heuristics_payload: filteredHeuristics,        // Body content here
  },
  // PUBLIC fields — visible in LangSmith default UI:
  public: {
    heuristic_ids: filteredHeuristics.map(h => h.id),  // IDs only
    heuristic_count: filteredHeuristics.length,
  }
};
```

Conformance test (T134) inspects emitted trace; asserts heuristic body NOT in default UI payload; asserts heuristic IDs ARE present.

### 2.3 R5.6 separate self-critique LLM call (T120 + T121)

EvaluateNode (T119) returns `RawFinding[]`. SelfCritiqueNode (T121) takes `RawFinding[]` as input, makes a NEW `LLMAdapter.invoke({tag: 'self_critique', ...})` call with a DIFFERENT system prompt. Distinct system prompt persona text is the canary — code review enforces it's non-overlapping with evaluate's system text.

Conformance test (T121) asserts: (a) `llm_call_log` has 2 distinct rows per page (one tag=evaluate, one tag=self_critique); (b) the system prompts differ by Levenshtein distance ≥ N (chosen empirically post-prompt-authoring); (c) ≥1 of 5 raw findings rejected on test fixture.

---

## 3. GR-012 benchmark validation handling

§07 line 709-714 declares GR-012 as a v2.2 addition to grounding rules — it validates benchmark claims (R15.4). However, archived `tasks.md` T122-T129 only declares 8 grounding rules (GR-001..GR-008); GR-012 has no discrete T-ID.

**Decision:** Fold GR-012 into T130 EvidenceGrounder acceptance. EvidenceGrounder runs 8 + 1 = 9 rules in order:

```ts
const groundingRules = [
  groundGR001, groundGR002, groundGR003, groundGR004,
  groundGR005, groundGR006, groundGR007, groundGR008,
  groundGR012,  // benchmark validation — added v2.2
];
```

GR-012 implementation lives in `packages/agent-core/src/analysis/grounding/rules/GR-012.ts`. T130 acceptance updated to require all 9 rules in order.

**Punch-list candidate for tasks-v2.md v2.3.4:** add a discrete T-ID for GR-012 (e.g., T129a or T134a). NOT applied this session — Phase 7 spec inherits the `tasks-v2.md` v2.3.3 surface which has 8 GR rules; T130 acceptance carries the 9th.

---

## 4. Multi-bundle iteration handling (Phase 5b opt-in)

When `state.perception_bundles.length > 1` (Phase 5b multi-viewport active), DeepPerceiveNode produces N AnalyzePerception views (one per bundle). EvaluateNode iterates per-bundle:

```ts
for (const bundle of state.perception_bundles) {
  const perception = bundleToAnalyzePerception(bundle);
  const filtered = await heuristicLoader.loadForContext({
    ...state.context_profile,
    device: bundle.viewport,  // override per bundle
  });
  const raw = await evaluate(perception, filtered, state.persona_context);
  raw.forEach(f => f.viewport = bundle.viewport);
  state.evaluate_findings_raw.push(...raw);
}
```

Cost surface: ~1.4× single-bundle (system-prompt cache hits drop linear scaling). Tracked in T119 + T134 acceptance.

---

## 5. Kill Criteria (R23)

Phase 7 PAUSES (reverts to engineering lead review) if any of these triggers fire:

| Category | Trigger | Action |
|---|---|---|
| **R10 violation** | Any `evaluate` / `self_critique` call escapes adapter with `temperature > 0` (caught by TemperatureGuard or via test inspection) | STOP. Audit LLMAdapter call sites. Engineering lead review. |
| **R6 leak** | LangSmith trace contains heuristic body in default UI payload (visible to non-admin) | STOP. Constitutional violation. Audit trace metadata wiring. Reject all traces from that session. |
| **R5.6 violation** | EvaluateNode + SelfCritiqueNode collapsed into single LLM call (cost optimization attempt) | STOP. R5.6 is non-negotiable. Audit code; revert. |
| **Resource — cost** | Per-page cost >$5 on any fixture run (R8.2) | STOP. Inspect prompt token bloat; potentially trim heuristic body or shorten prompt. |
| **Resource — iterations** | Same fixture cycles malformed output >5 times (LLM keeps producing invalid JSON) | STOP. Prompt-protocol drift; engineering review of evaluate / self-critique prompts. |
| **Resource — wall-clock** | Per-page wall-clock >180s (vs 90s p50 target — 2× over) | STOP. Investigate retries / network / model latency. |
| **Quality — finding regression** | Reproducibility test (NF-005) shows finding overlap <80% across two consecutive runs (vs 90% target) | STOP. Investigate determinism — likely a missed temperature=0 path or randomized fixture. |
| **Scope — perception leak** | Phase 7 introduces new perception logic (new `page.evaluate()`, new Playwright call outside adapter) — R24 violation | STOP. Constitutional violation. Refactor to use Phase 1c PerceptionBundle accessor. |
| **Spec contradiction** | Implementation reveals §07 spec defect | STOP. Fix spec first per R11.4. ASK FIRST before patching code-only. |

When kill criteria trigger, the engineering lead snapshots state to `wip/killed/<task-id>-<reason>` branch, logs the trigger reason in audit_events (or task thread for META-scope triggers), escalates with specific failure mode, and does NOT silently retry.

---

## 6. Cost & token budget targets

| Metric | Target | Hard cap |
|---|---|---|
| Per-page evaluate input tokens | 16-24K p50 | 32K p99 (NF-03) |
| Per-page self-critique input tokens | 6-10K p50 | 12K p99 (NF-04) |
| Per-page evaluate output tokens | ~3K (~10 findings × ~300 tokens each) | ~5K |
| Per-page self-critique output tokens | ~1.5K (~10 verdicts × ~150 tokens each) | ~3K |
| Per-call cost (Sonnet 4 pricing) | ~$0.30-0.60 evaluate; ~$0.15-0.30 critique | $5 page cap (R8.2) |
| Per-audit cost (avg 50 pages × ~$1 each) | ~$15 hard cap (R8.1) | enforced by gateway snapshot |

System prompt cache hit rate (Anthropic prompt caching) target: ≥80% for evaluate system prompt across pages in same audit (system prompt is static per audit; user message holds page-specific perception + heuristics).

---

## 7. Effort estimate

| Block | Tasks | Engineering hours |
|---|---|---|
| Block A (state + utilities) | T113-T116 | ~6h |
| Block B (core LLM nodes) | T117-T121 | ~16h (largest — first activations) |
| Block C1 (8 GR rules + GR-012) | T122-T129 + GR-012 in T130 | ~10h (parallelizable to ~5h elapsed) |
| Block C2 (EvidenceGrounder + Annotate + Store) | T130-T132 | ~6h |
| Block C3 (Graph + Integration EXIT GATE) | T133-T134 | ~6h |
| Buffer / re-work / R10/R6 first-activation iteration | — | ~4h |
| **Total** | T113-T134 | **~48h ≈ 7-9 engineering days** |

Calendar: weeks 7-8 of MVP per PRD §14 timeline.

---

## 8. Acceptance gating

Phase 7 ships when ALL of:

1. T113-T134 merged
2. T134 integration test green on 3 fixtures (homepage, PDP, checkout) per §SC-001
3. Reproducibility test green: same fixture × 2 consecutive runs → ≥90% finding overlap (NF-005)
4. R10 TemperatureGuard active — conformance test (T119/T121) green
5. R6 LangSmith channel active — conformance test (T134 trace inspection) green; no heuristic body in default UI payload
6. R5.6 enforcement — `llm_call_log` shows 2 distinct rows per page (evaluate + self_critique)
7. GR-007 deterministic regex check green (AC-16) — 0 published findings contain conversion-rate predictions
8. GR-012 benchmark validation green (AC-18 reject case)
9. All 9 grounding rules unit tests green (AC-10..AC-18)
10. Phase 7 status: `draft → validated → approved → implemented → verified`

Phase 7 EXIT GATE = condition 2 + condition 4 + condition 5 + condition 9.

---

## 9. Risks (specific to Phase 7 execution)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM produces persistently malformed JSON despite prompt | Low | Medium | Retry up to 2x with stricter rider; if still failing, page skipped; T119 acceptance covers |
| TemperatureGuard accidentally bypassed | Low | High (constitutional) | Conformance test in CI; code review checklist; kill criteria fires on detection |
| R6 leak — heuristic body in LangSmith default UI | Medium (first activation) | High (constitutional) | T134 trace inspection; rotate test traces in CI; engineering review during T119 implementation |
| Self-critique false-positive reduction <30% | Medium | Medium | Empirical re-tuning of critique prompt persona; kill criterion does NOT trigger on this — track as quality metric |
| GR-012 benchmark drift detection fragile | Medium | Medium | Quantitative ±20% tolerance + qualitative Levenshtein 0.6 are heuristics; tune via real fixtures |
| Multi-bundle (5b) cost regression — not 1.4× but 2× | Low | Medium | Anthropic prompt caching helps; if still high, system-prompt redesign in v1.1 |
| Per-page cost spike on long-form heuristic packs | Medium | Medium | Phase 4b T4B-013 filter caps to 12-25 heuristics; Phase 6 prioritizeHeuristics caps to 30 |
| LangGraph state graph not well-formed at T133 | Low | Medium | LangGraph compile-time validation; CI test on graph emit |
| Sharp annotation pin overlap on dense pages | Medium | Low | T131 overlap-avoidance algorithm per §7.8 |
| Phase 8 cross-page consumer reads PageSignals incorrectly | Low | Medium | Phase 7 emits typed PageSignals; Phase 8 consumes via Zod parse |
| Reproducibility regression discovered late (during integration test) | Low | High | Run reproducibility check in T119/T121 unit tests too (not just T134); guard via NF-005 in CI |
