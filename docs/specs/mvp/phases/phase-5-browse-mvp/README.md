---
title: Phase 5 — Browse Mode MVP
artifact_type: phase-readme
status: approved
version: 1.0
phase_number: 5
phase_name: Browse MVP
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
req_ids:
  - REQ-BROWSE-NODE-001
  - REQ-BROWSE-NODE-002
  - REQ-BROWSE-NODE-003
  - REQ-BROWSE-GRAPH-001
  - REQ-BROWSE-PROMPT-001
delta:
  new:
    - Phase 5 README
  changed: []
  impacted: []
  unchanged: []
governing_rules:
  - Constitution R4 (Browser Agent Rules — every rule converges in Phase 5)
  - Constitution R8 (R8.1 audit budget, R8.2 page budget enforced in browse loop)
  - Constitution R9 (Adapter Pattern — Phase 5 consumes 5 adapter categories)
  - Constitution R17, R19, R20
  - PRD §F-002 (Page Router), §F-003 (Browser Agent)
---

# Phase 5 — Browse Mode MVP

> **Summary (~150 tokens):** First end-to-end browse-mode integration. **16 MVP tasks** (T081-T096; T097-T100 reserved). Builds the LangGraph browse subgraph: state graph + nodes (audit_setup, page_router, browse, page_router → loop, audit_complete), edges with conditional routing, the **browse-agent system prompt** (drives LLM-led action selection), and `BrowseGraph` assembly. Five integration tests exercise the loop on real sites (BBC, Amazon, multi-step workflow, recovery from failure, budget exhaustion). Consumes everything before it: BrowserEngine + PageStateModel (Phase 1), MCP tools + AnalyzePerception schema (Phase 2), ActionContract + VerifyEngine + ConfidenceScorer + FailureClassifier (Phase 3), LLMAdapter + SafetyCheck + ScreenshotStorage + AuditLogger + SessionRecorder (Phase 4). **The first phase where the browser agent autonomously navigates + acts under LLM control with safety, verification, cost, and observability all wired together.**

## Goal

After Phase 5: `pnpm cro:audit --urls ./urls.txt` (still incomplete CLI; full CLI in Phase 9) can run an end-to-end browse session on a list of URLs. Each page enters the browse subgraph: perception captured → LLM decides next action → SafetyCheck gates → MCP tool invokes (with RateLimiter + CircuitBreaker) → VerifyEngine checks → ConfidenceScorer updates → FailureClassifier routes (retry / replan / give up) → AuditLogger writes → SessionRecorder emits events → StreamEmitter publishes for live observation → loop until audit_complete or budget exhausted. No analysis yet (Phase 7); browse session terminates after navigation + workflow completion.

## Tasks (MVP — 16 tasks)

| Group | Tasks | Description |
|---|---|---|
| LangGraph state + nodes | T081-T087 | AuditState (browse-mode subset; full schema Phase 8), 4-5 LangGraph nodes (audit_setup, page_router, browse, audit_complete), node-level Zod I/O |
| Edges + routing | T088-T089 | Conditional edges, fail/retry/replan routing |
| System prompt | T090 | Browse-agent system prompt — LLM-led action selection |
| BrowseGraph assembly | T091 | Compiles nodes + edges + prompt into runnable LangGraph |
| Integration tests | T092 | example.com / BBC simple navigation |
|  | T093 | amazon.in product search workflow |
|  | T094 | Multi-step workflow (navigate → click → type → submit → verify) |
|  | T095 | Recovery from verify failure (replan via FailureClassifier) |
|  | T096 | Budget exhaustion (audit terminates with completion_reason='budget_exceeded') |

T097-T100 reserved (no MVP scope).

Full descriptions: [tasks.md](tasks.md). Cross-reference: [tasks-v2.md T081-T100](docs/specs/mvp/tasks-v2.md).

## Exit criteria

- [ ] BrowseGraph compiles and runs end-to-end on example.com (smoke)
- [ ] Each browse-mode action invocation routes through SafetyCheck → MCP tool → VerifyEngine in that order
- [ ] LLM-led action selection uses operation class `other` (NOT temperature-bound; can use temp > 0 for exploratory diversity)
- [ ] Budget exhaustion terminates the audit cleanly with `audit_runs.completion_reason = 'budget_exceeded'` written
- [ ] Page-level budget exhaustion skips remaining steps for that page (R8.2)
- [ ] FailureClassifier-driven routing observed: verify_failed → retry; safety_blocked → escalate; rate_limited → backoff
- [ ] All 5 integration tests (T092-T096) green
- [ ] No silent LLM calls (R14.1) — every browse-mode LLM call logged to `llm_call_log` with operation='other' or 'classify'

## Depends on

- **Phase 1** (BrowserEngine + PageStateModel + ContextAssembler + MutationMonitor)
- **Phase 2** (28 MCP tools + RateLimiter + AnalyzePerception schema definition)
- **Phase 3** (ActionContract + VerifyEngine + ConfidenceScorer + FailureClassifier)
- **Phase 4** (LLMAdapter + SafetyCheck + DomainPolicy + CircuitBreaker + ScreenshotStorage + AuditLogger + SessionRecorder + StreamEmitter + DB schema)

## Blocks

- **Phase 7** (Analysis Pipeline — runs after browse completes; consumes browse-mode AuditState + persisted page snapshots)
- **Phase 8** (Audit Orchestrator — full audit lifecycle composes browse + analyze subgraphs)
- **Phase 9** (Delivery — needs working browse to demo)

## Rollup on exit

```bash
pnpm spec:rollup --phase 5
```

`phase-5-current.md` per R19. Active modules: `orchestration/` (BrowseGraph + 4-5 nodes). Contracts: BrowseSubGraph, BrowseAgentSystemPrompt, browse-mode AuditState fields (extensions to Phase 4's AuditState seed). Forward risks for Phase 7 (analyze subgraph composes alongside browse subgraph; both write to same AuditState). Phase 8 forward risk: full AuditState schema replaces browse-mode subset — additive, no migration.

## Reading order for Claude Code

1. This README
2. [tasks.md](tasks.md), [spec.md](spec.md), [impact.md](impact.md), [plan.md](plan.md)
3. `docs/specs/final-architecture/04-orchestration.md` — LangGraph orchestration canonical
4. `docs/specs/final-architecture/05-unified-state.md` — AuditState schema (full version Phase 8; subset Phase 5)
5. `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` — browse agent system prompt + decision flow
6. Phase 1, 2, 3, 4 specs + impact.md (every prior phase consumed)
7. `docs/specs/mvp/constitution.md` R4, R8

Do NOT load: analysis pipeline specs (Phase 7), heuristic specs (Phase 6).
