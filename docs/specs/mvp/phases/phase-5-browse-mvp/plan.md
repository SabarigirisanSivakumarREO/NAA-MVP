---
title: Implementation Plan — Phase 5 Browse MVP
artifact_type: plan
status: draft
version: 0.1
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-5-browse-mvp/spec.md
  - docs/specs/mvp/phases/phase-5-browse-mvp/impact.md
  - docs/specs/mvp/architecture.md (§6.4, §6.5)
  - docs/specs/mvp/constitution.md (R1-R23)

req_ids:
  - REQ-BROWSE-NODE-001
  - REQ-BROWSE-NODE-002
  - REQ-BROWSE-NODE-003
  - REQ-BROWSE-GRAPH-001
  - REQ-BROWSE-PROMPT-001

impact_analysis: docs/specs/mvp/phases/phase-5-browse-mvp/impact.md
breaking: false
affected_contracts:
  - BrowseSubGraph
  - BrowseAgentSystemPrompt
  - AuditStateBrowseSubset

delta:
  new:
    - First plan introducing LangGraph.js as orchestration runtime
    - 16 MVP tasks (T081-T096; T097-T100 reserved)
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R4 (full convergence)
  - Constitution R8
  - Constitution R9
  - Constitution R10 (non-bound ops in Phase 5)
  - Constitution R14
  - Constitution R17, R20, R23
---

# Implementation Plan: Phase 5 — Browse MVP

> **Summary (~120 tokens):** 16 MVP tasks land the LangGraph browse subgraph: T081 AuditState (browse-mode subset), T082-T086 four LangGraph nodes, T087 node-level Zod I/O verification, T088-T089 edges + HITL interrupt, T090 browse-agent system prompt with action-proposal Zod schema, T091 BrowseGraph assembly, T092-T096 five integration tests. T084 + T091 carry extended kill criteria (integration-heavy + LangGraph composition risk). Adds `langgraph` dep. impact.md MEDIUM-risk (3 new contracts; AuditState narrow→wide forward-compat is the focal concern).

**Branch:** `phase-5-browse-mvp`
**Date:** 2026-04-27
**Spec / Impact:** see this folder.

---

## Summary

Phase 5 wires every prior phase contract into a working LangGraph browse subgraph. Implementation flows: define AuditState narrow subset → implement 4 nodes → verify Zod I/O at node boundaries → wire conditional edges + HITL interrupt → author browse-agent system prompt + action-proposal Zod schema → assemble BrowseGraph (compile-time wiring of all deps) → run 5 integration tests. T084 BrowseNode is the largest single component (~250 lines); T091 BrowseGraph assembly is the integration apex.

---

## Technical Context

| Field | Value | Used in Phase 5? |
|---|---|---|
| TypeScript / Node | 5.x / 22 LTS | ✅ |
| Zod | 3.x | ✅ (AuditState, ActionProposal, node I/O) |
| LangGraph.js | latest (NEW Phase 5 dep) | ✅ |
| Anthropic SDK | (via Phase 4 LLMAdapter) | ✅ indirectly |
| Playwright | (via Phase 1 BrowserEngine) | ✅ indirectly |
| MCP SDK | (via Phase 2 ToolRegistry) | ✅ indirectly |
| Drizzle / pg | (via Phase 4 PostgresStorage) | ✅ indirectly |
| Pino | (extends with new fields) | ✅ |
| Vitest + Playwright Test | already pinned | ✅ |
| All other stack items | various | later phases |

**No new vendor SDKs in Phase 5.** Adds LangGraph.js but consumes everything else through Phase 4's adapter contracts. R9 boundary preserved.

**Performance / Scale:** NF-Phase5-01..04.

**Project Type:** monorepo extension. No new top-level structure.

---

## Constitution Check

- [x] R4.1 perception first — encoded in browse-agent system prompt + node logic (browse node calls ContextAssembler before LLM action proposal)
- [x] R4.2 verify everything — VerifyEngine called after every action; FailureClassifier routes
- [x] R4.3 safety structural — SafetyCheck called before tool invocation
- [x] R4.4 multiplicative confidence — ConfidenceScorer used; additive math forbidden by Phase 3 grep test still in effect
- [x] R4.5 exact tool names — system prompt enumerates 29 names; ActionProposalSchema enum constrains
- [x] R5.* — N/A (no findings in Phase 5)
- [x] R6 heuristic boundary — N/A
- [x] R7.* — DB writes via Phase 4 PostgresStorage; RLS preserved
- [x] R8.1 audit budget cap — page_router enforces
- [x] R8.2 page budget — browse skips on exhaustion
- [x] R8.3 rate limiting — Phase 2 RateLimiter inside browse node
- [x] R8.4 HITL — LangGraph interrupt
- [x] R9 — interfaces only; no direct vendor SDKs
- [x] R10 — Phase 5 LLM ops are non-bound (`other` / `classify` / `extract`); TemperatureGuard inactive on these by design
- [x] R10.1-R10.6 — files/functions sized; Pino correlation extended
- [x] R11.2 — REQ-IDs cited
- [x] R14.1 atomic LLM logging — preserved
- [x] R20 impact.md — REQUIRED, MEDIUM risk; authored
- [x] R23 kill criteria — default + per-task on T084 + T091

---

## Project Structure

```
docs/specs/mvp/phases/phase-5-browse-mvp/
├── README.md
├── spec.md
├── impact.md           # R20 — MEDIUM risk
├── plan.md             # this file
├── tasks.md
├── checklists/requirements.md
└── phase-5-current.md  # rollup at exit
```

### Source Code

```
packages/agent-core/src/
├── orchestration/                              # extends Phase 4 (was empty)
│   ├── AuditState.ts                           # T081 — browse-mode subset Zod
│   ├── BrowseGraph.ts                          # T091 — assembly + compile
│   ├── edges.ts                                # T088 conditional edges
│   ├── nodes/
│   │   ├── AuditSetupNode.ts                   # T082
│   │   ├── PageRouterNode.ts                   # T083
│   │   ├── BrowseNode.ts                       # T084 (action selection) + T085 (verify+route) — split into one file with two clear sections OR two files; decision in T084
│   │   └── AuditCompleteNode.ts                # T086
│   ├── prompts/
│   │   └── browse-agent.ts                     # T090 — system prompt + ActionProposalSchema
│   └── index.ts                                # barrel
└── observability/
    └── logger.ts                               # MODIFIED — add node_name, subgraph, loop_iteration correlation fields
```

### Tests

```
packages/agent-core/tests/
├── conformance/                                # 10 new
│   ├── audit-state-browse-subset.test.ts       # AC-01
│   ├── node-audit-setup.test.ts                # AC-02
│   ├── node-page-router.test.ts                # AC-03
│   ├── node-browse.test.ts                     # AC-04 (action selection)
│   ├── node-browse-verify-route.test.ts        # AC-04 (verify+route portion)
│   ├── node-audit-complete.test.ts             # AC-05
│   ├── node-io-zod.test.ts                     # AC-06 (parameterized over 4 nodes)
│   ├── edges-routing.test.ts                   # AC-07
│   ├── hitl-interrupt.test.ts                  # AC-08
│   ├── browse-prompt.test.ts                   # AC-09 (golden snapshot)
│   └── browse-graph-compile.test.ts            # AC-10
└── integration/                                # 5 new
    ├── phase5-simple.test.ts                   # AC-11 (example.com + bbc.com)
    ├── phase5-amazon.test.ts                   # AC-12
    ├── phase5-workflow.test.ts                 # AC-13
    ├── phase5-recovery.test.ts                 # AC-14
    └── phase5-budget.test.ts                   # AC-15
```

`package.json` adds `@langchain/langgraph` (or whatever the canonical LangGraph.js package name is at install time per architecture.md §6.4).

**Structure Decision:** All paths fit architecture.md §6.5 (`orchestration/` directory existed empty from prior phases; now populated). No §6.5 amendment needed.

---

## Phase 0 — Research

**Open design choices resolved:**

1. **AuditState forward-compat:** chose `_phase8_extensions: z.record(z.string(), z.unknown()).optional()` over `.passthrough()`. Phase 8 will EXTEND the schema with concrete typed fields; `_phase8_extensions` is a transitional escape hatch, deprecated when all Phase 8 fields are typed. Documented in impact.md.
2. **BrowseNode file split:** single file `BrowseNode.ts` with two exported functions (`selectAction` + `verifyAndRoute`) rather than two files. Keeps related logic adjacent; both share state shape. File expected ~250 lines (under R10.1 cap); if it exceeds, split to two files at that point.
3. **Browse-agent prompt — token budget:** target < 2000 tokens. The 29 tool names are the largest contributor (~600 tokens). Static at compile time; not regenerated per call (reproducibility — same prompt always = same hash).
4. **Action proposal validation:** LLM output Zod-parsed via `ActionProposalSchema.safeParse()`; on failure, retry up to 2 times with feedback ("invalid JSON, must match schema X") before escalating to FailureClassifier as `verify_failed/replan`.
5. **HITL interrupt resumption:** LangGraph supports interrupts natively. Phase 5 stubs auto-timeout (5 min → escalate). Phase 9 dashboard wires real human resumption via Hono API endpoint that calls `BrowseGraph.continue(audit_run_id, decision)`.
6. **LangGraph state checkpointing:** Phase 5 runs in-memory (no Postgres checkpoint adapter yet). Phase 8 wires Postgres checkpoint adapter for crash recovery.

---

## Phase 1 — Design

(Detailed in spec + impact; key inline notes:)

1. **AuditState narrow subset** uses `.strict()` not `.passthrough()` for type safety; `_phase8_extensions` is the explicit escape hatch.
2. **Each LangGraph node** is a pure function `(state) => Partial<state>` returning the slice to merge. No mutation of input state. No global state.
3. **Browse-agent system prompt** is a single TypeScript const string interpolating the tool name list at module load time (build-time freeze). Golden snapshot test catches drift.
4. **Conditional edges** use LangGraph's standard `addConditionalEdges` API; routing function reads FailureClassifier output from state.
5. **BrowseGraph** is a factory function `buildBrowseGraph(deps)` returning a compiled graph. All Phase 1-4 contracts injected as deps (R9 preserved).
6. **Mock LLM in tests:** `MockLLMAdapter` from Phase 4's test-utils; configured with deterministic action proposals per fixture URL.

---

## Complexity Tracking

**None — plan respects all 23 Constitution rules.**

LangGraph as new dep is canonical per architecture.md §6.4 — not a violation.

---

## Approval Gates

| Gate | Approver | Evidence |
|---|---|---|
| Spec → Plan transition | spec author + product owner | spec `approved` AND impact.md `approved` |
| Tech stack adherence | engineering lead | LangGraph.js pinned per §6.4 |
| Constitution check | engineering lead | All checkboxes ticked |
| AuditState forward-compat strategy | engineering lead | `_phase8_extensions` strategy documented |
| Plan → Tasks transition | engineering lead | This plan `approved` |

---

## Cross-references

- Phase 1, 2, 3, 4 specs + impact.md (every contract consumed)
- `docs/specs/mvp/tasks-v2.md` T081-T096
- `docs/specs/final-architecture/04-orchestration.md`, `05-unified-state.md`
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md`
- `docs/specs/mvp/constitution.md` R4, R8, R9, R10, R14, R20, R23
