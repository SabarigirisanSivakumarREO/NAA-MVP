---
title: Tasks — Phase 5 Browse MVP
artifact_type: tasks
status: draft
version: 0.2
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
authors: [Claude (drafter)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-5-browse-mvp/spec.md
  - docs/specs/mvp/phases/phase-5-browse-mvp/plan.md
  - docs/specs/mvp/phases/phase-5-browse-mvp/impact.md
  - docs/specs/mvp/tasks-v2.md (T081-T100; T097-T100 reserved)
  - docs/specs/mvp/constitution.md (R3, R4, R8, R9, R10, R14, R20, R23)

req_ids:
  - REQ-BROWSE-NODE-001
  - REQ-BROWSE-NODE-002
  - REQ-BROWSE-NODE-003
  - REQ-BROWSE-GRAPH-001
  - REQ-BROWSE-PROMPT-001

impact_analysis: docs/specs/mvp/phases/phase-5-browse-mvp/impact.md

delta:
  new:
    - Phase 5 tasks.md — 16 MVP tasks
    - T084 + T091 carry extended kill criteria
    - v0.2 — T090 references canonical 08-tool-manifest.md + adds drift-detection assertion (analyze finding F-002)
  changed:
    - v0.1 → v0.2 — T090 brief polish
  impacted: []
  unchanged:
    - All other task bodies; default kill criteria block; dependency graph

governing_rules:
  - Constitution R3, R4, R9, R23

description: "Phase 5 task list — 16 MVP tasks; first end-to-end browse integration; T097-T100 reserved."
---

# Tasks: Phase 5 — Browse MVP

**Input:** spec.md + plan.md + impact.md
**Prerequisites:** spec + impact `approved` (MEDIUM risk)
**Test policy:** TDD per R3.1.
**Organization:** Single user story; 16 MVP tasks across 4 clusters.

---

## Task ID Assignment

T081-T096 (16 MVP tasks). T097-T100 reserved per tasks-v2.

---

## Path Conventions

Phase 5 touches:
- `packages/agent-core/src/orchestration/` (was empty; now populated)
- `packages/agent-core/src/observability/logger.ts` (modify)
- `packages/agent-core/tests/conformance/` (10 new)
- `packages/agent-core/tests/integration/` (5 new)
- `packages/agent-core/package.json` (add `@langchain/langgraph`)

---

## Default Kill Criteria *(R23)*

```yaml
kill_criteria:
  resource: { token_budget_pct: 85, wall_clock_factor: 2x, iteration_limit: 3 }
  quality:
    - "any previously-passing test breaks"
    - "pnpm test:conformance fails"
    - "spec defect revealed (R11.4 — fix spec first)"
    - "R4.1 perception-first violation: action tool invoked without browser_get_state preceding"
    - "R4.5 exact tool names violated: LLM invokes paraphrased tool name not in MCPToolRegistry"
    - "R4.4 additive math on confidence (Phase 3 grep test still in effect)"
    - "AuditState fields outside browse-mode subset populated by Phase 5 code (Phase 8 scope)"
  scope:
    - "diff introduces forbidden pattern (R13)"
    - "task expands beyond plan.md file table"
    - "T097-T100 implementation lands (reserved)"
  on_trigger:
    - "snapshot WIP, log, escalate, do NOT silently retry or --no-verify"
```

T084 + T091 carry extended kill criteria.

---

## Phase 1 — Setup

`impact.md` MUST be `status: approved`. Add `@langchain/langgraph` to `package.json`.

---

## Phase 2 — Foundational

- [ ] **T-PHASE5-TESTS [P] [SETUP]** Author 10 conformance tests + 5 integration tests FIRST. AC-01..AC-15 FAIL initially.
- [ ] **T-PHASE5-LOGGER [SETUP]** Modify logger to register `node_name`, `subgraph`, `loop_iteration` correlation fields.

---

## Phase 3 — User Story 1: Consultant runs browse audit on real URL list (Priority: P1) 🎯 MVP

**Goal:** BrowseGraph runs end-to-end on real sites; 5 integration tests green.

**Independent Test:** `pnpm -F @neural/agent-core test integration/phase5`.

**AC IDs covered:** AC-01 through AC-15.

### LangGraph state + nodes

- [ ] **T081 [SETUP] [US-1] AuditState (browse-mode subset)** (AC-01, REQ-BROWSE-NODE-001)
  - **Brief — Outcome:** `orchestration/AuditState.ts` exports `AuditStateBrowseSubsetSchema` per impact.md shape; includes `_phase8_extensions` forward-compat seam. `.strict()` for type safety.
  - **Constraints:** File < 200 lines. No `z.any()` outside the typed escape hatch.
  - **Acceptance:** AC-01 — Zod parse on 5 fixtures including one with `_phase8_extensions` populated; reject on schema-violating field.
  - **Files:** `packages/agent-core/src/orchestration/AuditState.ts`
  - **dep:** Phase 4 (DB schema for audit_run linkage), T-PHASE5-TESTS, T-PHASE5-LOGGER
  - **Kill criteria:** default block

- [ ] **T082 [P] [US-1] AuditSetupNode** (AC-02, REQ-BROWSE-NODE-002)
  - **Brief — Outcome:** `orchestration/nodes/AuditSetupNode.ts` exports node function `(state) => Partial<AuditStateBrowseSubset>`. Creates audit_run row via Phase 4 PostgresStorage; emits `audit_events.audit_started` via SessionRecorder; returns initial state.
  - **Constraints:** File < 150 lines.
  - **Acceptance:** AC-02 — DB row created; event emitted.
  - **Files:** `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts`
  - **dep:** T081
  - **Kill criteria:** default block

- [ ] **T083 [P] [US-1] PageRouterNode** (AC-03, REQ-BROWSE-NODE-002)
  - **Brief — Outcome:** Pops next URL from `urls_remaining`; checks `budget_remaining_usd > 0` (R8.1) + DomainPolicy.classify (R4.3) + CircuitBreaker.isOpen (Phase 4); routes to `browse` (continue) OR `audit_complete` (terminate). Sets `current_url`.
  - **Constraints:** File < 200 lines. Pure routing logic; no I/O beyond Phase 4 adapter calls.
  - **Acceptance:** AC-03.
  - **Files:** `packages/agent-core/src/orchestration/nodes/PageRouterNode.ts`
  - **dep:** T081
  - **Kill criteria:** default block

- [ ] **T084 [US-1] BrowseNode (action selection)** (AC-04, REQ-BROWSE-NODE-003) **— extended kill criteria**
  - **Brief — Outcome:** `orchestration/nodes/BrowseNode.ts` exports `selectAction(state) → Partial<state>`. Calls Phase 1 ContextAssembler.capture(current_url) → PageStateModel; calls LLMAdapter (operation='other', temp=0.5, system=BROWSE_AGENT_SYSTEM_PROMPT) for action proposal; Zod-parses ActionProposalSchema; on parse failure retries up to 2x with corrective feedback.
  - **Per-task kill criteria (extends default):**
    - "perception-first violation (action invoked without preceding browser_get_state OR PageStateModel in state)" → R23 STOP. R4.1 violation.
    - "LLM proposes tool name NOT in MCPToolRegistry" → action_proposal validation rejects; FailureClassifier marks `verify_failed/replan`. NOT a kill criterion (expected error path), but recorded.
    - "Browse loop iterations on a single page exceed 5 (NF-Phase5-02)" → R23 STOP. Suspicious — loop runaway.
  - **Constraints:** File < 250 lines (combined with T085 verify+route portion). LLM call uses non-bound operation class.
  - **Acceptance:** AC-04 (action selection portion).
  - **Files:** `packages/agent-core/src/orchestration/nodes/BrowseNode.ts`
  - **dep:** T081, T090 (browse-agent prompt + ActionProposalSchema)

- [ ] **T085 [US-1] BrowseNode (verify + route portion)** (AC-04 cont'd)
  - **Brief — Outcome:** Same file `BrowseNode.ts` (or a sibling file if size > 300 — split decision in T084). After action invocation: SafetyCheck → MCP tool dispatch (with RateLimiter wrap) → VerifyEngine.verify(contract, session) → ConfidenceScorer.afterFailure/afterSuccess → FailureClassifier.classify if failed. Updates state with new PageStateModel + confidence + completion fields.
  - **Constraints:** Functions < 50 lines each.
  - **Acceptance:** AC-04 (verify+route portion).
  - **Files:** `packages/agent-core/src/orchestration/nodes/BrowseNode.ts` (extends T084)
  - **dep:** T084
  - **Kill criteria:** default block + R4.4 additive-math kill (still applies)

- [ ] **T086 [P] [US-1] AuditCompleteNode** (AC-05, REQ-BROWSE-NODE-002)
  - **Brief — Outcome:** Writes terminal state to DB via PostgresStorage: `audit_runs.completion_reason`, `audit_runs.ended_at`. Emits `audit_events.audit_complete`. Returns terminal state slice.
  - **Constraints:** File < 100 lines.
  - **Acceptance:** AC-05.
  - **Files:** `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts`
  - **dep:** T081
  - **Kill criteria:** default block

- [ ] **T087 [P] [US-1] Node-level Zod I/O verification** (AC-06)
  - **Brief — Outcome:** Each of the 4 nodes wraps its state slice input + output in Zod parsing at module boundaries. Conformance test parameterized over the 4 nodes verifies each rejects malformed input.
  - **Constraints:** Each node's wrapping adds ~10 lines; total impact across 4 nodes: ~40 lines.
  - **Acceptance:** AC-06.
  - **Files:** modify all 4 node files (T082, T083, T084-T085, T086)
  - **dep:** T082, T083, T084, T085, T086
  - **Kill criteria:** default block

### Edges + routing

- [ ] **T088 [US-1] Conditional edges + routing** (AC-07, REQ-BROWSE-GRAPH-001)
  - **Brief — Outcome:** `orchestration/edges.ts` exports edge config: `audit_setup → page_router`; `page_router → browse` (urls_remaining > 0 AND budget OK AND domain not blocked) OR `audit_complete` (otherwise); `browse → page_router` (success — page complete) OR `browse` (retry; bounded at 3) OR `audit_complete` (escalate / unrecoverable). Routing function reads FailureClassifier output from state.
  - **Constraints:** File < 200 lines.
  - **Acceptance:** AC-07 — 5 routing fixtures verified.
  - **Files:** `packages/agent-core/src/orchestration/edges.ts`
  - **dep:** T082, T083, T084, T085, T086
  - **Kill criteria:** default block

- [ ] **T089 [P] [US-1] HITL interrupt** (AC-08)
  - **Brief — Outcome:** When SafetyCheck throws SafetyBlockedError with class `requires_hitl`, the browse node calls LangGraph's interrupt API; SessionRecorder emits `audit_events.hitl_requested`. External `resumeAudit(audit_run_id, decision)` resumes (decision='approve' or 'reject'). MVP stub auto-timeout: 5 min → auto-escalate to `audit_complete` with `completion_reason='aborted'`.
  - **Constraints:** Auto-timeout configurable; default 5 min.
  - **Acceptance:** AC-08 — pause + resume cycle verified; auto-timeout verified.
  - **Files:** modifies T084-T085 (BrowseNode); + new helper in `orchestration/hitl.ts` (~80 lines)
  - **dep:** T084, T085
  - **Kill criteria:** default block

### System prompt

- [ ] **T090 [P] [US-1] Browse-agent system prompt + ActionProposalSchema** (AC-09, REQ-BROWSE-PROMPT-001)
  - **Brief — Outcome:** `orchestration/prompts/browse-agent.ts` exports `BROWSE_AGENT_SYSTEM_PROMPT` (TypeScript const string < 2000 tokens; enumerates **29 EXACT v3.1 tool names** sourced from Phase 2 MCPToolRegistry; the registry itself is anchored to the canonical `docs/specs/final-architecture/08-tool-manifest.md` per tasks-v2.md v2.3.1: 24 `browser_*` + 2 `agent_*` + 5 `page_*`). Encodes R4.1 perception-first + R4.5 exact-names + JSON action format. Also exports `ActionProposalSchema` (Zod discriminated union over 29 tool names + args). **Drift-detection assertion** in T090 conformance test: `expect(MCPToolRegistry.list().length).toBe(29)` AND `expect(promptToolNames).toEqual(MCPToolRegistry.list().map(t => t.name).sort())`. Golden snapshot of the prompt fails if either drifts.
  - **Constraints:** Prompt < 2000 tokens. Schema enum has exactly 29 values matching Phase 2 + canonical manifest.
  - **Acceptance:** AC-09 — golden snapshot stable; ActionProposalSchema parses fixtures from each tool category; drift-detection assertion green.
  - **Files:** `packages/agent-core/src/orchestration/prompts/browse-agent.ts`
  - **dep:** Phase 2 MCPToolRegistry (tool names sourced at module load time, not runtime)
  - **Kill criteria:** default block + extra: prompt > 2000 tokens → STOP, prompt is the LLM cost lever; v1.1 may A/B but MVP stays terse. **Plus extra:** drift detection fails (registry count != 29 OR prompt names != registry names) → STOP, requires Phase 2 reconciliation BEFORE Phase 5 prompt edit.

### BrowseGraph assembly

- [ ] **T091 [US-1] BrowseGraph assembly** (AC-10, REQ-BROWSE-GRAPH-001) **— extended kill criteria**
  - **Brief — Outcome:** `orchestration/BrowseGraph.ts` exports `buildBrowseGraph(deps): CompiledStateGraph<AuditStateBrowseSubset>`. Compiles LangGraph from nodes + edges + state schema; injects all Phase 1-4 deps (R9 preserved). Returns runnable graph; `graph.invoke({ initial_state })` runs the loop.
  - **Per-task kill criteria (extends default):**
    - "Phase 1-4 contracts NOT all injected as deps (R9 violation)" → R23 STOP. The whole point of R9 is Phase 5 doesn't import vendor SDKs directly.
    - "BrowseGraph.compile() throws at module-load time on a fixture deps bundle" → R23 STOP. LangGraph composition error.
    - "Compiled graph runs longer than NF-Phase5-01 (30 s) on example.com smoke" → R23 STOP. Performance regression.
  - **Constraints:** File < 300 lines. All deps injected via factory function param; no module-level singletons.
  - **Acceptance:** AC-10 — compile + invoke on fixture exits 0.
  - **Files:** `packages/agent-core/src/orchestration/BrowseGraph.ts`, `packages/agent-core/src/orchestration/index.ts` (barrel)
  - **dep:** T081-T090

### Integration tests (Phase 5 acceptance gate)

- [ ] **T092 [US-1] Integration: example.com + bbc.com** (AC-11)
  - **Brief — Outcome:** `tests/integration/phase5-simple.test.ts` runs BrowseGraph on a 2-URL list (example.com + bbc.com) using MockLLMAdapter (action='agent_complete'). Asserts: both pages browsed, no MCP action invocations, audit_runs.completion_reason='success', wall-clock < 60 s.
  - **Files:** `packages/agent-core/tests/integration/phase5-simple.test.ts`
  - **dep:** T091

- [ ] **T093 [US-1] Integration: amazon.in workflow** (AC-12)
  - **Brief — Outcome:** Multi-step search workflow with deterministic MockLLM proposing search → click first result → verify product page. Asserts: 3 actions, 3 verifies pass (or graceful CAPTCHA-wall acceptance per spec edge case 9), confidence > 0.85.
  - **Files:** `packages/agent-core/tests/integration/phase5-amazon.test.ts`
  - **dep:** T091

- [ ] **T094 [US-1] Integration: multi-step workflow** (AC-13)
  - **Brief — Outcome:** 5-action workflow against a stable fixture (Shopify demo or example login form): navigate → click → type → submit → verify. All 5 pass.
  - **Files:** `packages/agent-core/tests/integration/phase5-workflow.test.ts`
  - **dep:** T091

- [ ] **T095 [US-1] Integration: recovery from verify failure** (AC-14)
  - **Brief — Outcome:** Synthetic verify_failed on action 2 of 4 via MockBrowserEngine returning empty AX-tree. FailureClassifier routes to retry (1x) → replan (LLM picks alternate action) → success → audit_complete.
  - **Files:** `packages/agent-core/tests/integration/phase5-recovery.test.ts`
  - **dep:** T091

- [ ] **T096 [US-1] Integration: budget exhaustion** (AC-15)
  - **Brief — Outcome:** audit_run with `budget_remaining_usd=0.05`; LLM calls debit > $0.05 across pages. Audit terminates after exhaustion with `completion_reason='budget_exceeded'`. Remaining pages NOT entered.
  - **Files:** `packages/agent-core/tests/integration/phase5-budget.test.ts`
  - **dep:** T091

**Checkpoint:** All 15 ACs pass. Phase 5 ready for rollup.

---

## Phase N — Polish

- [ ] **T-PHASE5-DOC [P]** Update root README dev quickstart (`pnpm cro:audit --urls ./urls.txt --business-type ecommerce` works for browse-only end-to-end).
- [ ] **T-PHASE5-ROLLUP** Author `phase-5-current.md` per R19. Active modules: full `orchestration/` populated. Contracts: BrowseSubGraph, BrowseAgentSystemPrompt, AuditStateBrowseSubset (all NEW). Forward risks for Phase 7 (analyze subgraph alongside browse — both write same AuditState), Phase 8 (full AuditState widening), Phase 9 (CLI/dashboard wiring).

---

## Dependencies & Execution Order

```
T-PHASE5-TESTS  +  T-PHASE5-LOGGER                 # SETUP (parallel)
              │              │
              └──────┬───────┘
                     ▼
                   T081                              # AuditState narrow subset
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
     T082          T083          T086              # AuditSetup, PageRouter, AuditComplete (parallel)
                                                   # T084 + T085 wait on T090
                     │
                   T090                              # Browse-agent prompt + ActionProposalSchema (parallel; needed for T084)
                     │
                   T084                              # BrowseNode action selection
                     │
                   T085                              # BrowseNode verify+route
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
     T087          T088          T089              # Node Zod I/O, Edges, HITL interrupt (parallel)
                     │
                   T091                              # BrowseGraph assembly
                     │
       ┌─────────────┼─────────────┬─────────────┐
       ▼             ▼             ▼             ▼
     T092          T093          T094          T095, T096      # 5 integration tests (parallel)
                     │
T-PHASE5-DOC, T-PHASE5-ROLLUP
```

### Comprehension-Debt Pacing

- T084 (BrowseNode action selection) is single-threaded — highest review surface.
- T091 (BrowseGraph assembly) is single-threaded — composition.
- 5 integration tests are parallel-friendly after T091.

---

## Implementation Strategy

1. SETUP — T-PHASE5-TESTS + T-PHASE5-LOGGER.
2. T081 (AuditState).
3. Parallel batch A: T082, T083, T086, T090 (4 agents).
4. T084 → T085 (sequential, same file).
5. Parallel batch B: T087, T088, T089 (3 agents).
6. T091 (BrowseGraph) — single-threaded.
7. Parallel batch C: T092, T093, T094, T095, T096 (5 agents — at ceiling).
8. Polish.

---

## Notes

- T097-T100 reserved per tasks-v2 — kill criterion catches implementation attempts.
- LangGraph's `interrupt` API is the HITL primitive — do NOT roll your own.
- AuditState narrow→wide: Phase 5 ships `_phase8_extensions` escape hatch; Phase 8 widens additively.
- One task = one commit. Integration tests per file = 5 separate commits (one PR is fine).

---

## Cross-references

- spec.md, plan.md, impact.md
- Phase 1, 2, 3, 4 specs (every contract consumed)
- `docs/specs/mvp/tasks-v2.md` T081-T100
- `docs/specs/final-architecture/04-orchestration.md`, `05-unified-state.md`
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md`
- `docs/specs/mvp/constitution.md` R4, R8, R9, R10, R14, R20, R23
