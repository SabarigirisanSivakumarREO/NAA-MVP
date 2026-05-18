---
title: Phase 7 Validation — Trust Spot-Check Proof Artifact
artifact_type: validation
status: approved
version: 1.0
phase_number: 7
created: 2026-05-18
owner: engineering lead
sibling: phase-7-current.md
purpose: |
  R19 sibling validation doc. 5 ASCII proof sections + §6 trust spot-checks
  so a human reviewer gains AI-built-code confidence in ~20 min without
  reading every line.
---

# Phase 7 — Validation

## 1. Module Dependency Graph

```
                          ┌────────────────────────────────┐
                          │       AnalysisGraph            │
                          │  (LangGraph composition)       │
                          └──┬──────┬────────┬────────┬────┘
                             │      │        │        │
                ┌────────────┘      │        │        └────────────────┐
                ▼                   ▼        ▼                          ▼
       deepPerceiveNodeRun   evaluateNodeRun  selfCritiqueNodeRun   evidenceGrounderRun
       (T117 + DeepPerceive)  (T119 EvalNode)  (T121 SelfCritique)   (T130)
                │                   │                │                  │
                │                   │                │                  ▼
                │                   │                │           9 GroundingRules
                │                   │                │           GR-001..GR-008 + GR-012
                │                   │                │                  │
                │                   │                │                  ▼
                │                   │                │           assignConfidenceTier
                │                   │                │           (T115 + TierValidator T109)
                │                   │                │                  │
                ▼                   ▼                ▼                  ▼
       bundleToAnalyzePerception   prompts/         prompts/         AnnotateNode + StoreNode
       (R24 perception accessor)   evaluate.ts      selfCritique.ts  (T131 + T132)
                                   │                │                  │
                                   ▼                ▼                  ▼
                                   EVALUATE_SYSTEM  SELF_CRITIQUE_SYS  page_annotate_screenshot
                                   buildEvaluate    buildSelfCritique  + ScreenshotStorage
                                   UserMessage      UserMessage        + StorageAdapter
                                   │                │                  + appendRejectedFinding (NEW)
                                   ▼                ▼
                                   LLMAdapter.complete(operation:'evaluate'  | 'self_critique')
                                   (R5.6 SEPARATE calls; AnthropicAdapter handles R14.1 atomic log)
                                   │
                                   ▼
                                   prioritizeHeuristics + HeuristicLoader.loadForContext (Phase 6)
                                   │
                                   ▼
                                   projectHeuristicPublic (R6 IP boundary — strips body/provenance/ai_review)

       Quality gate (§7.10):  PerceptionQualityScorer (7 signals) → routeFromQuality
                              → routeAfterPerceive (in AnalysisGraph) → proceed/partial/skip
```

**Direction:** top-down execution; left-to-right dep chains.
**Boundaries:** AnalysisGraph is the SOLE `@langchain/langgraph` import (R9). LLMAdapter is the SOLE adapter-boundary into Anthropic (R9 + R14.1).

## 2. Data Flow

```
   Phase 8 orchestrator
        │  AnalysisState slice  (audit_run_id, client_id, current_page_perception_bundle,
        │                        context_profile, _phase8_extensions)
        ▼
   ┌────────────────┐
   │ deep_perceive  │── settle gate (AC-11 preserved) ─→ bundleToAnalyzePerception (R24)
   └────────┬───────┘    ├─→ tools.browser_screenshot (quality=85)         → viewport
            │            ├─→ tools.page_screenshot_full (q=80, maxH=15000) → fullpage
            │            └─→ detectPageType OR state.context_profile.page.type override
            │
            ▼  delta: {current_page_perception_bundle, current_page_type, viewport_screenshot, fullpage_screenshot}
   ┌────────────────────────────┐
   │ routeAfterPerceive (§7.10)│ ── computePerceptionQuality (7 signals × weights)
   └────────┬───────────────────┘     overall ≥ 0.6 ─→ evaluate
            │                         0.3-0.59       ─→ evaluate_tier1 (Tier 1 only)
            │                         < 0.3          ─→ END (skipped_perception_quality_low)
            ▼
   ┌─────────────┐
   │  evaluate   │── HeuristicLoader.loadForContext(context_profile) → ≤30 via prioritize
   │             │── buildEvaluateUserMessage (R5.5 + R6 + R5.3 anti-prediction footer)
   │             │── LLMAdapter.complete(operation:'evaluate', temp=0)  ★ FIRST R10/R13 runtime
   │             │── JSON.parse → RawFindingSchema.parse (Zod tight, spec §4.2)
   │             │── retry ≤2 on malformed; map BudgetExceeded/TemperatureGuard/Unavailable to analysis_status
   └────────┬────┘
            │  delta: {evaluate_findings_raw[], (analysis_status on error path)}
            ▼
   ┌────────────────────┐
   │ routeAfterEvaluate │── raw[] empty → end; status=skipped_llm_output_invalid + retry<2 → retry_evaluate; else → self_critique
   └────────┬───────────┘
            ▼
   ┌────────────────┐
   │ self_critique  │── filter status==='pass' raw findings
   │                │── buildSelfCritiqueUserMessage
   │                │── LLMAdapter.complete(operation:'self_critique', temp=0)  ★ R5.6 SEPARATE CALL
   │                │── parse CritiqueResponseItem[]; applyVerdict (KEEP/REVISE/DOWNGRADE/REJECT)
   │                │── CritiqueFindingSchema.parse
   └────────┬───────┘
            │  delta: {critique_findings[]}
            ▼
   ┌────────────────────┐
   │ routeAfterCritique │── reviewed[] empty → end; else → ground
   └────────┬───────────┘
            ▼
   ┌────────────────────────────┐
   │ evidenceGrounderRun (T130) │── for each finding: 9 rules in order; first-fail → rejected[] with rule+reason
   │                            │── all-pass: TierValidator.validate(h) + deriveEvidenceType(f) → assignConfidenceTier
   └────────┬───────────────────┘
            │  delta: {grounded_findings[], rejected_findings[]}
            ▼
   ┌────────────────────┐
   │ routeAfterGround   │── grounded[] empty → end; else → annotate_store
   └────────┬───────────┘
            ▼
   ┌─────────────────────────┐
   │ annotate_store          │── annotateNodeRun: parseBoundingBox + shiftIfOverlapping (§7.8)
   │                         │── page_annotate_screenshot × 2 (viewport + fullpage)
   │                         │── storeNodeRun: ScreenshotStorage.put × 4 (clean + annotated × 2 viewports)
   │                         │── storage.appendFinding × N (publishStatus='held' per F-016)
   │                         │── storage.appendRejectedFinding × M (R7.4 append-only with rule+reason)
   └─────────┬───────────────┘
             ▼
            END  (delta: {annotated_*_path, finding_ids, rejected_ids, screenshot_paths})
                  → Phase 8 consumes current_page_signals + rejected_findings counts for cross-page rollup
```

## 3. Function Call Graph (LLM seams highlighted)

```
buildAnalysisGraph(deps) [R9 sole LangGraph SDK import]
 └─ StateGraph.compile()                           [R23 #2 — MUST NOT throw on fixture deps]

evaluateNodeRun(input)                              [T119; AC-07]
 ├─ heuristicLoader.loadForContext(profile)        [Phase 6 T106 contract]
 ├─ prioritizeHeuristics(candidates, 30)           [Phase 6 T107]
 ├─ buildEvaluateUserMessage({...})                [T118; R5.5 + R6 + R5.3]
 │   └─ projectHeuristicPublic(h)  [R6 — strips body/provenance/ai_review for each h]
 ├─ llm.complete({operation:'evaluate', temp:0})  ★ R10/R13 runtime; R14.1 via adapter
 ├─ JSON.parse + z.array(RawFindingSchema).parse  [spec §4.2 tight]
 └─ tagFinding(f, persona, viewport)               [REQ-ANALYZE-PERSONA-002 + 5b multi-bundle]

selfCritiqueNodeRun(input)                          [T121; AC-09]
 ├─ rawFindings.filter(f => f.status !== 'pass')   [spec §4.3 line 495]
 ├─ buildSelfCritiqueUserMessage({...})            [T120; persona-diverged per R5.6]
 ├─ llm.complete({operation:'self_critique', temp:0}) ★ R5.6 SEPARATE call; R14.1 via adapter
 ├─ JSON.parse + z.array(CritiqueResponseItem).parse
 └─ applyVerdict(original, item) per item          [KEEP/REVISE/DOWNGRADE/REJECT]

evidenceGrounderRun(input)                          [T130; AC-18]
 ├─ for each critique_finding:
 │   ├─ for each {id, rule} in RULE_PIPELINE [9]:
 │   │   └─ rule(finding, perception, filteredHeuristics) → PASS | {pass:false, reason}
 │   ├─ if rejected: push to rejected_findings[] with rejected_by_rule + rejection_reason
 │   └─ else: tierValidator.validate(h) + deriveEvidenceType(f) → assignConfidenceTier → grounded[]
 └─ return {grounded_findings, rejected_findings}

annotateNodeRun(input)                              [T131; AC-19]
 ├─ buildAnnotations(grounded, viewportDims) [overlap-avoidance: shiftIfOverlapping]
 ├─ annotateTool({inputPath:viewport, annotations})
 ├─ buildAnnotations(grounded, fullpageDims)
 └─ annotateTool({inputPath:fullpage, annotations})

storeNodeRun(input)                                 [T132; AC-20]
 ├─ screenshotStorage.put × 4 (viewport+fullpage × clean+annotated)
 ├─ storage.appendFinding × N (publishStatus='held')
 └─ storage.appendRejectedFinding × M
```

## 4. AC → impl → test traceability

| AC | REQ | Impl file:fn | Test file (PASS count) |
|---|---|---|---|
| AC-01 | REQ-STATE-001 | `orchestration/AnalysisState.ts` (Zod schemas) | `analysis-state.test.ts` (7) |
| AC-02 | REQ-ANALYZE-PERCEPTION-V23-001 | `analysis/utils/detectPageType.ts` | `detect-page-type.test.ts` |
| AC-03 | REQ-ANALYZE-CONF-001 | `analysis/utils/assignTier.ts` (assignConfidenceTier) | (covered by evidence-grounder + analysis-state) |
| AC-04 | REQ-ANALYZE-PERCEPTION-V23-001 | `nodes/DeepPerceiveNode.ts:deepPerceiveWithSettle` | `deep-perceive-settle.test.ts` |
| AC-05 | REQ-ANALYZE-NODE-001 | `nodes/DeepPerceiveNode.ts:deepPerceiveNodeRun` | `deep-perceive-node.test.ts` (10) |
| AC-06 | REQ-ANALYZE-NODE-002 | `prompts/evaluate.ts` | `evaluate-prompt.test.ts` (9) |
| AC-07 | REQ-ANALYZE-NODE-002 | `nodes/EvaluateNode.ts:evaluateNodeRun` | `evaluate-node.test.ts` (13) |
| AC-08 | REQ-ANALYZE-NODE-003 + R5.6 | `prompts/selfCritique.ts` | `self-critique-prompt.test.ts` (5; Jaccard+5-gram) |
| AC-09 | REQ-ANALYZE-NODE-003 | `nodes/SelfCritiqueNode.ts:selfCritiqueNodeRun` | `self-critique-node.test.ts` (13) |
| AC-10..AC-17 | REQ-ANALYZE-GROUND-001 | `grounding/rules/GR-001..GR-008.ts` | `grounding-rules.test.ts` (32 incl 9 GR-007 banned-phrase rejects) |
| AC-18 | REQ-ANALYZE-NODE-004 | `grounding/EvidenceGrounder.ts:evidenceGrounderRun` + `GR-012.ts` | `evidence-grounder.test.ts` (11) |
| AC-19 | REQ-ANALYZE-NODE-005 + F-011 | `nodes/AnnotateNode.ts:annotateNodeRun` | `annotate-node.test.ts` (8) |
| AC-20 | REQ-ANALYZE-NODE-005 + F-016 + R7.3 + R7.4 | `nodes/StoreNode.ts:storeNodeRun` | `store-node.test.ts` (5) |
| AC-21 | REQ-ANALYZE-GRAPH-001 + REQ-ANALYZE-EDGE-001..003 | `analysis/AnalysisGraph.ts` + `analysis/edges.ts` | `analysis-graph.test.ts` (13) |
| AC-22a | REQ-ANALYZE-QUALITY-001..003 + REQ-ANALYZE-RECOVERY-003 | `quality/PerceptionQualityScorer.ts` + AnalysisGraph routeAfterPerceive | `quality-gate-routing.test.ts` (11) |
| AC-22 (EXIT) | REQ-ANALYZE-GRAPH-001 | `tests/integration/phase7.test.ts` | 2 PASS mock-orchestration + 6 it.todo env-gated real-LLM |

**Total: 148 PASS + 10 it.todo (real-LLM deferred to PHASE7_INTEGRATION=1).**

## 5. Resource cost breakdown (analytical estimate, real-LLM deferred to smoke)

```
Per-page estimated cost (Claude Sonnet 4 @ baseline pricing):
 ─ evaluate call:    ~10K input tok + ~3K output tok   ≈ $0.045 (post-cache)
 ─ self_critique:    ~6K input + ~1.5K output           ≈ $0.022
 ─ grounding 9 rules: pure CPU                          $0.000
 ─ annotate × 2:     pure CPU (Sharp)                   $0.000
 ─ store:            DB writes                          $0.000
 ─ screenshots:      Sharp + R2/disk put                $0.000
                                                       ─────────
                                Per-page estimate ≈     $0.067   (well under R8.2 $5 ceiling)

Per-page token budget per spec §7.5 LLM-call row:
 ─ evaluate ~10K input + 2-4K output (target)
 ─ self_critique ~6K input + 1-2K output (target)
 ─ TOTAL bounded by R14.2 BudgetGate pre-call check (AnthropicAdapter)

Storage cost per page:
 ─ 4 screenshots × ~150KB JPEG = ~600KB / page
 ─ findings ≈ 5-25 rows × ~2KB = ~50KB / page
 ─ rejected_findings ≈ 1-10 rows × ~2KB = ~20KB / page
                       Per-page storage ≈ ~700KB
                       100-page audit ≈ ~70MB (R2 standard tier)
```

## 6. Trust Spot-Check List (~20-min human review)

Read these N lines to verify Phase 7 invariants hold:

1. **R5.6 SEPARATE call** — `nodes/SelfCritiqueNode.ts:111-119` (the `llm.complete({operation:'self_critique', ...})` block); cross-check `nodes/EvaluateNode.ts:202-211` (the `llm.complete({operation:'evaluate', ...})` block). Two distinct call sites, distinct operation tags. AC-09 + AC-07 PASS confirms.
2. **R6 IP boundary** — `prompts/evaluate.ts:32-44` (`R6_STRIPPED_KEYS` set + `projectHeuristicPublic` filter). Confirm body/provenance/ai_review are removed before JSON.stringify. `tests/conformance/evaluate-prompt.test.ts:88-94` asserts SECRET_BODY does not appear in output.
3. **R5.3 banned phrases** — `grounding/rules/GR-007.ts:17-30` (10 regex patterns incl probabilistic-bypass guards). `tests/conformance/grounding-rules.test.ts:230-260` covers 9 reject cases.
4. **R9 LangGraph adapter boundary** — `grep -rn "@langchain/langgraph" packages/agent-core/src/analysis/` should match ONLY `AnalysisGraph.ts`. Mirrors BrowseGraph precedent.
5. **R7.4 append-only rejected_findings** — `nodes/StoreNode.ts:96-104` (`buildRejectedInsert` includes `rejectedByRule + rejectionReason + rejectionStage='grounding'`). PostgresStorage uses INSERT only.
6. **R10/R13 temp=0** — `nodes/EvaluateNode.ts:204` (`temperature: 0`) + `nodes/SelfCritiqueNode.ts:114` (`temperature: 0`). LLMAdapter operation routing → TemperatureGuard fires if violated.
7. **R24 capture-only DeepPerceive** — `nodes/DeepPerceiveNode.ts:273-275` (the `// 2. R24 — perception via accessor only; no tools.page_analyze call.` block); calls `bundleToAnalyzePerception(bundle, stateId)` only. AC-05 test #2 asserts `tools.page_analyze` was NOT called.
8. **Quality gate weights total 1.00** — `quality/PerceptionQualityScorer.ts:30-38` (WEIGHTS map sums 0.25+0.20+0.15+0.15+0.10+0.10+0.05=1.00). `quality-gate-routing.test.ts:158-162` asserts overall=1.0 when all signals fire.
9. **Routing function shapes** — `analysis/edges.ts:25-55` (3 routing functions); each is a pure 5-15 line function with no LLM/IO. Same for `routeAfterPerceive` in `AnalysisGraph.ts:108-118`.
10. **Mock-orchestration end-to-end** — `tests/integration/phase7.test.ts:48-112` (the `it('graph compiles and invokes through all 5 nodes on happy path'` block). Asserts call order: `deep_perceive → evaluate → self_critique → ground → annotate_store`.

**Spot-check completion = high-trust signal that Phase 7 implementation matches spec without reading every line.**
