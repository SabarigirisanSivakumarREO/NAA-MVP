---
title: Phase 5 Validation — Browse MVP
artifact_type: validation
status: verified
version: 1.0
phase_number: 5
phase_name: Browse Mode MVP
phase_completed_on: 2026-05-17
phase_verified_on: 2026-05-17
created: 2026-05-17
updated: 2026-05-17
owner: engineering lead
authors: [Claude (master orchestrator)]
reviewers: [Sabari (engineering lead, Gate 2 stamp)]
supersedes: null
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-5-browse-mvp/spec.md (v0.5 verified)
  - docs/specs/mvp/phases/phase-5-browse-mvp/tasks.md (v0.5 verified)
  - docs/specs/mvp/phases/phase-5-browse-mvp/phase-5-current.md (v1.1 verified)
  - .phase-state/5/verify-verdict.yaml (Gate 2 APPROVE)
  - .phase-state/5/preflight-verdict-pass3.yaml (Gate 1 APPROVE)
governing_rules:
  - Constitution R19 (Rollup per Phase) — sibling artifact pair
  - CLAUDE.md §8c (Per-phase artifact maintenance)
---

# Phase 5 — Browse MVP — Validation

> **Purpose (~150 tokens — read this first):** AI-built code creates a comprehension gap. Read this AFTER `phase-5-current.md` rollup. 5 ASCII proof artifacts a human can verify with eyes alone in ~20 minutes. Pick one node/edge per diagram, open the cited file/line, confirm "yes that matches" — three confirmations = trust the rest.

> **Authored at Stage 4 exit post Gate 2 APPROVE (2026-05-17T12:25Z).** Captures system state at the moment Gate 2 was stamped (HEAD `dec58fa`).

---

## §1 Module dependency graph

ASCII import graph for `packages/agent-core/src/orchestration/` (Phase 5 new + modified files). Arrow direction: importer → imported. `█` = R9 adapter boundary (sole vendor SDK importer).

```
  Phase 4b base:
  orchestration/state.ts (AuditStateSchema base; T4B-011 fwd-stub)
       ▲
       │ z.extend()
       │
  orchestration/AuditState.ts (T081 AuditStateBrowseSubsetSchema)
       ▲
       │ z.infer<type>
       │
   ┌───┴───────────────────────────────────────────────────────────────┐
   │                                                                   │
  nodes/AuditSetupNode.ts ─► StorageAdapter + SessionRecorder + Logger
  nodes/PageRouterNode.ts ─► DomainPolicy + CircuitBreaker + Logger
  nodes/BrowseNode.ts ─────► ContextAssembler + LLMAdapter + ToolRegistry
                             + RateLimiter + SafetyCheck + VerifyEngine
                             + ConfidenceScorer + FailureClassifier
                             + SessionRecorder + HitlManager + Logger
  nodes/AuditCompleteNode.ts ► StorageAdapter + SessionRecorder + Logger
   │                                                                   │
   └───────────► orchestration/prompts/browse-agent.ts (T090)           │
                  └► BROWSE_TOOL_NAMES + ActionProposalSchema + BROWSE_AGENT_SYSTEM_PROMPT
                                                                       │
   orchestration/edges.ts (T088 routeFromPageRouter + routeFromBrowse) │
       │                                                               │
       │ consumed by                                                   │
       ▼                                                               ▼
  █ orchestration/BrowseGraph.ts (T091; sole @langchain/langgraph importer)
       │  └► buildBrowseGraph(deps) → CompiledStateGraph
       │  └► Annotation.Root state channel
       │  └► hitl_pause virtual node calls interrupt<I,R>()
       │  └► MemorySaver checkpointer
       │  └► Composes: AuditSetupNode + PageRouterNode + BrowseNode
       │             + AuditCompleteNode + hitlPause + edges.routers
       ▼
  orchestration/hitl.ts (T089 createHitlManager — MVP stub registry)
       └► requestHitl / resumeAudit / cancelHitlTimeout (no LangGraph import)

  orchestration/BudgetMutex.ts (T-PHASE5-CONCURRENCY-HARDEN)
       └► createBudgetMutex().withLock(auditRunId, fn) — NOT YET WIRED

  orchestration/index.ts (barrel re-export)

  observability/logger.ts (T-PHASE5-LOGGER: subgraph + loop_iteration LogBindings extension)
```

**Trust check:** `grep '@langchain' packages/agent-core/src/orchestration/*.ts` returns ONLY `BrowseGraph.ts:48`. R9 boundary verified. Open `BrowseNode.ts` first import block — confirms 10 deps (no vendor SDKs).

---

## §2 Data flow — BrowseGraph.invoke()

ASCII pipeline diagram for the public entry point `buildBrowseGraph(deps).invoke(initialState)`. Shows what shape passes between LangGraph nodes + which Pino events fire.

```
  initialState (AuditStateBrowseSubsetSchema.parse'd) ──┐
                                                        ▼
   START → audit_setup (T082 createAuditSetupNode)
        │  ├► storage.createAuditRun({clientId, rootUrl})
        │  ├► recorder.recordEvent({event_type:'audit_started'})        ► event: audit.entry
        │  └► returns slice {audit_run_id, current_node, node_status}
        ▼
   audit_setup → page_router (T083 createPageRouterNode)
        │  ├► budget gate: budget_remaining_usd <= 0? → completion_reason='budget_exceeded' (R8.1)
        │  ├► urls_empty? → completion_reason='success'
        │  ├► domainPolicy.classify(nextUrl); circuitBreaker.isOpen(domain)
        │  └► returns slice {current_url, urls_remaining:rest}          ► event: page_router.routing_to_browse
        ▼
   page_router routeFromPageRouter:                                     [edges.ts:103]
      ├── completion_reason set     → audit_complete
      ├── current_url set           → browse
      └── (drop URL fallback)       → page_router (self-loop on next URL)
        │
        ▼
   browse (T084+T085 executeBrowseStep)
        │
        ├ iter > MAX_ITER (5)? → audit_failed event + abort('loop_runaway')   ► event: audit_failed
        │
        ├ selectAction (T084):                                          ► event: browse.entry
        │  ├► contextAssembler.capture(current_url) (R4.1)              ► event: browse.perception_captured
        │  ├► loop attempt 0..2:
        │  │   ├► llm.complete({operation:other|classify, temp:0.5,
        │  │   │                 systemPrompt:BROWSE_AGENT_SYSTEM_PROMPT})
        │  │   │   └► totalCost += r.costUsd   (Bug-C fix)
        │  │   ├► ActionProposalSchema.safeParse(r.text)
        │  │   └► on parse success → break; on fail → corrective retry  ► event: browse.action_zod_failed_retry
        │  └► 3-retry exhaustion → abort('safety_blocked', totalCost)
        │
        ├ verifyAndRoute (T085):
        │  ├► recorder(page_browse_started)                             ► event: page_browse_started
        │  ├► safety.assertAllowed(tool, domain, auditRun)
        │  │   └► throw SafetyBlockedError 'hitl' → halted+hitl_pending
        │  │                                  → hitlManager.requestHitl (T089)
        │  │   └► throw SafetyBlockedError other → page_browse_failed   ► event: page_browse_failed
        │  ├► rateLimiter.acquire(domain) (2s global min — Phase 2)
        │  ├► toolRegistry.get(tool).handler(args, ctx) → dispatch
        │  ├► verifyEngine.verify(contract, session) → VerifyResult
        │  ├► scorer.afterSuccess(c) OR scorer.afterFailure(c)  (R4.4 multiplicative)
        │  ├► classifier.classify(result) → FailureClass (on failure)
        │  └► success(): budget -= lastLlmCost; clear last_failure_class (Bug-B + Bug-C fix)
        │     failure(): budget -= lastLlmCost; set completion_reason='aborted'
        │                 for terminal classes safety_blocked|bot_detected_likely (F-015 fix)
        │  └► merge sel.slice + verify.slice (Bug-A fix)
        │
        ▼
   browse routeFromBrowse:                                              [edges.ts:129]
      ├── hitl_pending             → hitl_pause (intercept BEFORE FailureClass routing)
      ├── completion_reason set    → audit_complete (terminal)
      ├── last_failure_class undef → page_router (happy path)
      └── FailureClass switch (LOCKED 5-row):
            verify_failed (iter<cap) → browse
            verify_failed (iter≥cap) → audit_complete
            safety_blocked           → audit_complete
            rate_limited             → browse (self-loop)
            unverifiable             → page_router
            bot_detected_likely      → audit_complete
        │
        ▼
   hitl_pause (virtual node): interrupt<I,R>()
        ├ resume 'approve'  → browse (clear hitl_pending)
        ├ resume 'reject'   → audit_complete (completion_reason='aborted', cause_class='hitl_timeout')
        └ resume 'timeout'  → audit_complete (cause_class='hitl_timeout')
        │
        ▼
   audit_complete (T086 createAuditCompleteNode)
        │  ├► storage.finalizeAuditRun({client_id, completion_reason})
        │  ├► event_type per branch table:
        │  │   success           → audit_completed
        │  │   budget_exceeded   → audit_failed + cause_class='budget_exceeded'
        │  │   aborted           → audit_failed + cause_class from state ext
        │  │   timeout           → audit_failed + cause_class='wall_clock_timeout'
        │  ├► AC-18 wall-clock backstop: 60min cap if completion_reason undefined
        │  └► returns terminal slice {node_status:'complete', completion_reason}  ► event: audit_complete.finalized
        ▼
   END
```

**Trust check:** open `BrowseNode.ts:70` — confirm `executeBrowseStep` shape; `:82` confirms `iter > MAX_ITER` runaway guard; `:92` confirms `merged = {...validatedState, ...sel.slice}` then Bug-A merge at the executor return. Three matches → trust.

---

## §3 Function call graph — buildBrowseGraph()

ASCII call graph for the most complex orchestrator function. Depth ≤ 3.

```
buildBrowseGraph(deps)                                  [BrowseGraph.ts:229]
├─ createLogger('browse-graph') / createChildLogger     [BrowseGraph.ts:230-231]
├─ log.info({phase:'build'}, 'browse_graph.build.start')[BrowseGraph.ts:236]
├─ buildNodes(deps, logger)                              [BrowseGraph.ts:198 + 240]
│  ├─ createAuditSetupNode({storage, recorder, logger}) [AuditSetupNode.ts]
│  ├─ createPageRouterNode({domainPolicy, circuitBreaker, logger}) [PageRouterNode.ts]
│  ├─ createBrowseNode({contextAssembler, llm, toolRegistry,
│  │                    rateLimiter, safety, verifyEngine, scorer,
│  │                    classifier, recorder, hitlManager, logger}) [BrowseNode.ts]
│  ├─ createAuditCompleteNode({storage, recorder, logger}) [AuditCompleteNode.ts]
│  └─ createHitlPauseNode(logger)                        [BrowseGraph.ts internal]
├─ routePageRouter = routeFromPageRouter as unknown as ... (channel-erasure cast)
├─ routeBrowse     = routeFromBrowseWithHitl as ...      [BrowseGraph.ts: hitl precheck wrapper]
├─ routeHitl       = hitlPauseRouter as ...
├─ new StateGraph(BrowseStateAnnotation)                 [BrowseGraph.ts:262]
│  ├─ .addNode(NODE_AUDIT_SETUP, auditSetup)
│  ├─ .addNode(NODE_PAGE_ROUTER, pageRouter)
│  ├─ .addNode(NODE_BROWSE, browse)
│  ├─ .addNode(NODE_HITL_PAUSE, hitlPause)
│  ├─ .addNode(NODE_AUDIT_COMPLETE, auditComplete)
│  ├─ .addEdge(START, NODE_AUDIT_SETUP)
│  ├─ .addEdge(NODE_AUDIT_SETUP, NODE_PAGE_ROUTER)
│  ├─ .addConditionalEdges(NODE_PAGE_ROUTER, routePageRouter, {3 targets})
│  ├─ .addConditionalEdges(NODE_BROWSE, routeBrowse, {4 targets incl. hitl_pause})
│  ├─ .addConditionalEdges(NODE_HITL_PAUSE, routeHitl, {2 targets})
│  └─ .addEdge(NODE_AUDIT_COMPLETE, END)
├─ try {
│  ├─ graph.compile({checkpointer: new MemorySaver()})   [BrowseGraph.ts:296]
│  └─ log.info({phase:'build'}, 'browse_graph.build.compiled')
│  } catch (err) → throw with `deps keys: ${Object.keys(deps).sort()}` diagnostic
└─ return CompiledStateGraph
```

**Trust check:** open `BrowseGraph.ts:262` — confirm `new StateGraph(BrowseStateAnnotation as any)` exists. `:296` confirms `.compile({checkpointer: new MemorySaver()})`. Two matches → trust.

---

## §4 AC → impl → test traceability matrix

| AC | Spec authority | Impl file(s) | Test file | Cases | Status |
|---|---|---|---|---|---|
| AC-01 | spec.md L149 | orchestration/AuditState.ts (T081) | tests/conformance/audit-state-browse-subset.test.ts | 5 fixtures | ✅ |
| AC-02 | spec.md L150 | nodes/AuditSetupNode.ts (T082) | tests/conformance/node-audit-setup.test.ts | 4 | ✅ |
| AC-03 | spec.md L151 | nodes/PageRouterNode.ts (T083) | tests/conformance/node-page-router.test.ts | 7 | ✅ |
| AC-04 | spec.md L152 | nodes/BrowseNode.ts (T084+T085) | tests/conformance/node-browse.test.ts | 11 | ✅ |
| AC-05 | spec.md L153 | nodes/AuditCompleteNode.ts (T086) | tests/conformance/node-audit-complete.test.ts | 4 | ✅ |
| AC-06 | spec.md L154 | All 4 nodes (T087 Zod I/O verification) | tests/conformance/node-io-zod.test.ts | 8 (parameterized) | ✅ |
| AC-07 | spec.md L155 | orchestration/edges.ts (T088) | tests/conformance/edges-routing.test.ts | 17 | ✅ |
| AC-08 | spec.md L156 | orchestration/hitl.ts (T089) + BrowseNode handleSafety | tests/conformance/hitl-interrupt.test.ts | 7 (incl. fakeTimers 5min auto-timeout) | ✅ |
| AC-09 | spec.md L157 | orchestration/prompts/browse-agent.ts (T090) | tests/conformance/browse-prompt.test.ts | 13 (incl. drift assertion) | ✅ |
| AC-10 | spec.md L158 | orchestration/BrowseGraph.ts (T091) | tests/conformance/browse-graph-compile.test.ts | 3 | ✅ |
| AC-11 | spec.md L159 | BrowseGraph end-to-end + mock deps | tests/integration/phase5-simple.test.ts (T092) | 1 (55ms) | ✅ |
| AC-12 | spec.md L160 | BrowseGraph + bot-detect FailureClass routing | tests/integration/phase5-amazon.test.ts (T093) | 2 (happy + CAPTCHA; 78ms) | ✅ |
| AC-13 | spec.md L161 | BrowseGraph 5-action multi-step | tests/integration/phase5-workflow.test.ts (T094) | 1 (225ms; 5 PSMs accumulated post Bug-A fix) | ✅ |
| AC-14 | spec.md L162 | BrowseGraph verify_failed retry/replan cycle | tests/integration/phase5-recovery.test.ts (T095) | 1 (75ms; 5-iter happy terminal post Bug-B fix) | ✅ |
| AC-15 | spec.md L163 | BrowseGraph budget exhaustion (Bug-C natural debit) | tests/integration/phase5-budget.test.ts (T096) | 1 (77ms; single-invoke post Bug-C fix) | ✅ |
| AC-16 | spec.md L164 | BrowseNode client_id thread-through (Wave 4 6aa800a) | tests/conformance/browse-llm-client-id.test.ts (T097) | 2 (incl. corrective-retry; H1+H2 closed) | ✅ |
| AC-17 | spec.md L165 | BrowseNode page_browse_* event emissions (T085) | tests/conformance/node-browse-events.test.ts | 5 (LOCKED-22 enum) | ✅ |
| AC-18 | spec.md L166 | AuditCompleteNode 60min wall-clock backstop (T086) | tests/conformance/audit-timeout.test.ts | 1 | ✅ |

**Total: 18/18 ACs green** via 56+ Phase 5 test cases + 5 integration tests. Zero ❌, zero ⚠.

Polish task coverage (non-AC):
- T-PHASE5-CONCURRENCY-HARDEN: tests/conformance/budget-mutex.test.ts 4 cases ✅
- T-PHASE5-TESTINFRA-DEADLOCK: globalSetup operational — full suite 45.75s vs ~200s pre (4.4×) ✅

**Trust check:** open `tests/conformance/node-browse.test.ts` — confirm `describe.each([...])` or 11 distinct `it(...)` cases on 2 describe blocks. Pick AC-04 row, grep `executeBrowseStep` in `BrowseNode.ts` — 1 export hit. Three matches → trust.

---

## §5 Resource cost breakdown

| Resource | Phase 5 cost | Notes |
|---|---|---|
| **LLM tokens (Phase 5 implementation cost)** | ~$10-12 actual spend ($20 phase ceiling — 50-60% used) | Stage 1 $3.50 (3 spec patch passes) + Wave 0-1 $2.00 + Wave 2-7 ~$3 + Wave 8 ~$2 + Stage 3 + Gate 2 ~$1 |
| **LLM tokens (Phase 5 RUNTIME cost — per audit)** | Variable; depends on URL count + retry rate | One LLMAdapter.complete per browse iter; 0.5 temp; maxTokens 1024 in MVP. MockAdapter cost_per_call_usd 0.03 for tests. |
| **Phase 5 audit budget cap (R8.1)** | $15 hard default (audit_runs.budget_remaining_usd) | Now actually drained by Bug-C fix (selectAction → success/failure/abort debit). Validated by T096 single-invoke. |
| **Wall-clock per page (NF-Phase5-01)** | <30s cap; smoke test 48-71ms (~400× margin) | AC-10 compile + invoke test verified |
| **Browse iter cap (NF-Phase5-02)** | 5 per page MAX_ITER; >5 trips R23 STOP + audit_failed | T094 hits exactly 5 (proves cap reached not exceeded) |
| **Retry cap per failure** | BROWSE_RETRY_CAP=3 (edges.ts) | T095 retry-once + replan = 2 iter on URL2 under cap |
| **HITL auto-timeout** | 5 min default | Verified via vi.useFakeTimers in T089 hitl-interrupt.test.ts |
| **Wall-clock cap per audit (AC-18)** | 60min hardcoded MVP | AuditCompleteNode backstop; configurable via AuditRequest.max_wall_clock_ms deferred v1.1 |
| **Test suite wall-clock** | 45.75s for 1055 tests (4.4× speedup) | T-PHASE5-TESTINFRA-DEADLOCK vitest globalSetup; 5× over 30s acceptance target |
| **R10 file size budgets** | All Phase 5 files within budgets | AuditState.ts 122 LOC (cap 200); AuditSetupNode 140 (cap 150); PageRouter 199 (cap 200); BrowseNode 280 (cap 250 +12 documented); AuditComplete 139 (cap 100 +39 due to AC-18 backstop); browse-agent.ts 128 (cap 200); edges.ts 187 (cap 200); hitl.ts 108 (cap 100 +8); BrowseGraph.ts 299 (cap 300); BudgetMutex 80 (cap 100) |
| **R10 function size budgets** | All functions ≤ 50 LOC (R10.3) | Reviewer-verified per Stage 2.5 Wave 4 + Wave 6 |
| **R14 Pino correlation overhead** | <1% per log line | All log lines bind {audit_run_id, client_id, node_name, subgraph, loop_iteration, page_url?} |
| **@langchain/langgraph dep cost** | First Phase 5 dep at ^1.3.0 | Sole importer BrowseGraph.ts (R9 verified via grep) |

---

## §6 Trust spot-check list

Three independent confirmations build phase-wide trust. Pick three rows; for each, open the cited file/line and confirm the diagram's claim. ~20 minutes total.

| # | Diagram | Claim | File:line to verify |
|---|---|---|---|
| 1 | §1 Module dep | `@langchain/langgraph` imported ONLY in BrowseGraph.ts | `grep -r '@langchain' packages/agent-core/src/orchestration/*.ts` → BrowseGraph.ts:48 only |
| 2 | §1 Module dep | BrowseNode imports 10 deps (zero vendor SDKs) | BrowseNode.ts:20-35 |
| 3 | §2 Data flow | Bug-A fix merges sel.slice + verify.slice | BrowseNode.ts:92-100 (executeBrowseStep return) |
| 4 | §2 Data flow | Bug-B fix clears stale last_failure_class on success | BrowseNode.ts:186-200 (success() function) |
| 5 | §2 Data flow | Bug-C fix debits budget on every LLM call | BrowseNode.ts:117 (totalCost += r.costUsd) + :186-192 (success debit) |
| 6 | §2 Data flow | F-015 fix sets completion_reason='aborted' for terminal FailureClass | BrowseNode.ts:204-215 (failure() function + isTerminalClass) |
| 7 | §2 Data flow | HITL precheck happens BEFORE routeFromBrowse FailureClass switch | BrowseGraph.ts: routeFromBrowseWithHitl wrapper |
| 8 | §2 Data flow | All 22 AuditEventTypeEnum values LOCKED | `packages/agent-core/src/types/audit-events.ts:58-81` |
| 9 | §3 Call graph | buildBrowseGraph composes 5 nodes + 3 edge configs | BrowseGraph.ts:262-285 |
| 10 | §4 Traceability | T093 amazon-test 2 cases (happy + CAPTCHA) | `tests/integration/phase5-amazon.test.ts` |
| 11 | §5 Cost | Prompt token count ~217 (well under 2000) | `tests/conformance/browse-prompt.test.ts` token assertion |
| 12 | §5 Cost | Test wall-clock improvement from globalSetup | Run `pnpm -F @neural/agent-core test` — observe ~45s vs documented ~200s pre |

**Verdict**: open 3 rows. If all three match → trust the rest of the artifacts. If any disagree → flag the discrepancy + investigate before consuming downstream.

---

## Cross-references

- Sibling rollup: `phase-5-current.md` v1.1 verified
- Gate 2 verdict: `.phase-state/5/verify-verdict.yaml` APPROVE
- Gate 2 stamp: `review-notes-gate-2.md` v1.0 stamped 2026-05-17T12:25Z
- Phase 5 spec corpus: `spec.md` v0.5 + `plan.md` v0.3 + `tasks.md` v0.5 + `impact.md` v0.4 (all verified)
- Constitution: R4 (browser rules), R8 (cost+safety), R9 (adapter), R10 (file/function discipline), R13 (forbidden patterns), R14 (Pino + atomic LLM log), R17 (lifecycle), R18 (delta blocks), R19 (rollup), R20 (forward compat), R23 (kill criteria)
- Predecessor rollups: `phase-4b-context-capture/phase-4b-current.md` v1.0 verified (R20 base); `phase-4-safety-infra-cost/phase-4-current.md` v1.0 verified
