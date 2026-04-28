---
title: Implementation Plan — Phase 2 MCP Tools + Human Behavior
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
  - docs/specs/mvp/phases/phase-2-tools/spec.md
  - docs/specs/mvp/phases/phase-2-tools/impact.md
  - docs/specs/mvp/architecture.md (§6.4, §6.5)
  - docs/specs/mvp/constitution.md (R1-R23)
  - docs/specs/mvp/testing-strategy.md (§9.6)
  - docs/specs/mvp/phases/phase-1-perception/impact.md (BrowserEngine + PageStateModel forward contract)

req_ids:
  - REQ-MCP-001
  - REQ-MCP-002
  - REQ-MCP-SANDBOX-001
  - REQ-MCP-SANDBOX-002
  - REQ-MCP-SANDBOX-003
  - REQ-BROWSE-HUMAN-001
  - REQ-BROWSE-HUMAN-002
  - REQ-BROWSE-HUMAN-003
  - REQ-BROWSE-HUMAN-004
  - REQ-BROWSE-RATE-001
  - REQ-BROWSE-RATE-002
  - REQ-TOOL-PA-001
  - REQ-ANALYZE-PERCEPTION-V23-001
  - REQ-ANALYZE-V23-001

impact_analysis: docs/specs/mvp/phases/phase-2-tools/impact.md
breaking: false
affected_contracts:
  - MCPToolRegistry
  - MCPToolSchema
  - AnalyzePerception
  - RateLimiter

delta:
  new:
    - First plan introducing 4 simultaneous shared contracts (HIGH-risk impact)
    - Tech stack adds @modelcontextprotocol/sdk + ghost-cursor (active in Phase 2; rest deferred)
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R4 (browser rules — exact tool names)
  - Constitution R8 (cost+safety — rate limiting structural)
  - Constitution R9 (adapter pattern — MCP server)
  - Constitution R11
  - Constitution R17, R20
  - Constitution R23 (kill criteria)
---

# Implementation Plan: Phase 2 — MCP Tools + Human Behavior

> **Summary (~100 tokens):** Build 35 tasks: 3 human behavior modules (T016-T018), MCP server skeleton (T019), 23 browse tools in parallel batches (T020-T042), 1 sandboxed eval tool (T043), 4 page tools (T044-T047), the critical T048 page_analyze v2.3 producing AnalyzePerception, RateLimiter (T049), and Phase 2 integration test (T050). Adds @modelcontextprotocol/sdk + ghost-cursor deps. impact.md HIGH-risk because 4 simultaneous shared contracts (MCPToolRegistry, MCPToolSchema, AnalyzePerception, RateLimiter) and AnalyzePerception is Neural's highest-fanout schema. Parallelization recommended for T020-T042 (3 batches of ~8 tools).

**Branch:** `phase-2-tools` (created at implementation time)
**Date:** 2026-04-27
**Spec:** `docs/specs/mvp/phases/phase-2-tools/spec.md`
**Impact:** `docs/specs/mvp/phases/phase-2-tools/impact.md`

---

## Summary

Phase 2 implements the action surface. T019 stands up the MCP server adapter wrapping `@modelcontextprotocol/sdk` with a `ToolRegistry`. Tools register one-per-file in `mcp/tools/*.ts` using `MCPToolDefinition<I, O>`. T016-T018 add human behavior modules (ghost-cursor mouse, Gaussian typing with 1-2% typo, momentum scroll). T020-T042 land 23 browse tools (navigate, click, type, get_state, etc.); these are highly parallelizable. T043 implements the sandboxed `browser_evaluate`. T044-T047 add 4 page tools. **T048 is the cornerstone**: a single `page.evaluate()` produces AnalyzePerception with all 14 v2.3 enrichments. T049 RateLimiter enforces 2s min + per-domain caps. T050 integration test exercises all 28 tools.

---

## Technical Context

| Field | Value | Source | Used in Phase 2? |
|---|---|---|---|
| Language | TypeScript 5.x | architecture.md §6.4 | ✅ yes |
| Runtime | Node.js 22 LTS | architecture.md §6.4 | ✅ yes |
| Validation | Zod 3.x | architecture.md §6.4 + R2.2 | ✅ yes (every tool's input + output) |
| Browser | Playwright | architecture.md §6.4 | ✅ yes (consumed via Phase 1's BrowserEngine adapter) |
| MCP | `@modelcontextprotocol/sdk` | architecture.md §6.4 | ✅ NEW Phase 2 dep |
| Mouse motion | `ghost-cursor` | NEW Phase 2 dep (architecture-mentioned) | ✅ yes (T016) |
| Image | Sharp | architecture.md §6.4 | ✅ yes (T046 + T047 page tools) |
| Logging | Pino | architecture.md §6.4 + R10.6 | ✅ yes (new correlation fields: tool_name, tool_call_id, client_session_id) |
| Testing | Vitest + Playwright Test | architecture.md §6.4 + R3 | ✅ yes |
| Orchestration | LangGraph.js | architecture.md §6.4 | ❌ Phase 5 + 8 |
| Primary LLM | Claude Sonnet 4 | architecture.md §6.4 | ❌ Phase 4 |
| Database | Postgres + pgvector | architecture.md §6.4 | ❌ Phase 4 |
| ORM | Drizzle | architecture.md §6.4 | ❌ Phase 4 |
| Cache / Queue | Redis + BullMQ | architecture.md §6.4 | ❌ Phase 4 |
| All deferred deps | (Hono, Next.js, Clerk, R2, Resend, Fly.io, Vercel) | architecture.md §6.4 | ❌ later phases |

**Performance / Scale targets:** NF-Phase2-01 through NF-Phase2-06 (boot < 500 ms, page_analyze < 5 s, integration test < 5 min, etc.).

**Project Type:** monorepo extension. No new top-level structure.

---

## Constitution Check

- [x] R4.1 perception first — tool design enforces `browser_get_state` precedes action tools (registry hint)
- [x] R4.5 EXACT tool names — verified per spec
- [x] R5.3 + GR-007 no conversion predictions — N/A (no findings)
- [x] R6 heuristic boundary — N/A
- [x] R7.1 Drizzle-only DB access — no DB writes in Phase 2
- [x] R7.2 RLS — N/A
- [x] R7.4 append-only — N/A
- [x] R8.3 rate limiting structural — RateLimiter (T049) in code, not prompts; LLM cannot bypass
- [x] R9 adapter pattern — MCP server is the second adapter category; @modelcontextprotocol/sdk imported only in mcp/Server.ts + mcp/tools/*.ts; Phase 1's BrowserEngine boundary preserved
- [x] R10 temperature — no LLM calls
- [x] R10.1-R10.6 file/function size, named exports, no console.log — declared per-task; T048 watch (~250-280 lines, may need split)
- [x] R11.2 REQ-ID tracing — 14 REQ-IDs covered
- [x] R20 impact analysis — REQUIRED, authored at impact.md (HIGH risk; 4 contracts)
- [x] R23 kill criteria — default block + per-task on T048

---

## Project Structure

### Documentation

```
docs/specs/mvp/phases/phase-2-tools/
├── README.md
├── spec.md
├── impact.md          # R20 — REQUIRED (HIGH risk)
├── plan.md            # this file
├── tasks.md
├── checklists/
│   └── requirements.md
└── phase-2-current.md # rollup at exit (R19; created by user)
```

No research.md (zero NEEDS CLARIFICATION); no data-model.md (schemas live in code).

### Source Code (per architecture.md §6.5)

```
packages/agent-core/src/
├── mcp/                                    # NEW directory tree
│   ├── Server.ts                           # adapter wrapping @modelcontextprotocol/sdk
│   ├── ToolRegistry.ts                     # name → MCPToolDefinition
│   ├── types.ts                            # MCPToolSchema base, SafetyClass enum
│   ├── index.ts                            # barrel
│   └── tools/                              # 28 files, one per tool
│       ├── navigate.ts                     # T020
│       ├── goBack.ts                       # T021
│       ├── goForward.ts                    # T022
│       ├── reload.ts                       # T023
│       ├── getState.ts                     # T024
│       ├── screenshot.ts                   # T025
│       ├── getMetadata.ts                  # T026
│       ├── click.ts                        # T027
│       ├── clickCoords.ts                  # T028
│       ├── type.ts                         # T029
│       ├── scroll.ts                       # T030
│       ├── select.ts                       # T031
│       ├── hover.ts                        # T032
│       ├── pressKey.ts                     # T033
│       ├── upload.ts                       # T034
│       ├── tabManage.ts                    # T035
│       ├── extract.ts                      # T036
│       ├── download.ts                     # T037
│       ├── findByText.ts                   # T038
│       ├── getNetwork.ts                   # T039
│       ├── waitFor.ts                      # T040
│       ├── agentComplete.ts                # T041
│       ├── agentRequestHuman.ts            # T042
│       ├── browserEvaluate.ts              # T043 (sandboxed)
│       ├── pageGetElementInfo.ts           # T044
│       ├── pageGetPerformance.ts           # T045
│       ├── pageScreenshotFull.ts           # T046
│       ├── pageAnnotateScreenshot.ts       # T047
│       └── pageAnalyze.ts                  # T048 (the critical one)
│
├── browser-runtime/                        # extends Phase 1
│   ├── MouseBehavior.ts                    # T016 NEW
│   ├── TypingBehavior.ts                   # T017 NEW
│   ├── ScrollBehavior.ts                   # T018 NEW
│   └── RateLimiter.ts                      # T049 NEW
│
├── analysis/                               # NEW directory (just types in Phase 2)
│   ├── types.ts                            # AnalyzePerception Zod schema (T048 dep)
│   └── index.ts                            # barrel
│
└── observability/
    └── logger.ts                           # MODIFIED — add tool_name, tool_call_id, client_session_id
```

**Test layout:**
```
packages/agent-core/tests/
├── conformance/                            # extends Phase 1
│   ├── mouse-behavior.test.ts              # AC-01
│   ├── typing-behavior.test.ts             # AC-02
│   ├── scroll-behavior.test.ts             # AC-03
│   ├── mcp-server.test.ts                  # AC-04
│   ├── browse-tools.test.ts                # AC-05 (parameterized)
│   ├── browser-evaluate-sandbox.test.ts    # AC-06
│   ├── page-get-element-info.test.ts       # AC-07
│   ├── page-get-performance.test.ts        # AC-08
│   ├── page-screenshot-full.test.ts        # AC-09
│   ├── page-annotate-screenshot.test.ts    # AC-10
│   ├── page-analyze-v23.test.ts            # AC-11 (most important)
│   └── rate-limiter.test.ts                # AC-12
└── integration/
    └── phase2.test.ts                       # AC-13
```

`package.json` adds: `@modelcontextprotocol/sdk`, `ghost-cursor`.

**Structure Decision:** All paths fit architecture.md §6.5. New `mcp/` and `analysis/` directories per the existing structure decision tree.

---

## Phase 0 — Research

**One open design choice resolved:**

1. **page_analyze v2.3 implementation strategy** (T048): Single `page.evaluate()` block that runs all extractions inside the page context, returning a single JSON object. NOT 14 separate calls. NOT 9 baseline + extra round-trips. The v2.3 enrichments are STRUCTURAL extensions to existing baseline sections, not new sections (e.g., `metadata.canonical` adds to the existing `metadata` section). Single-call invariant per REQ-TOOL-PA-001 is non-negotiable.
2. **Sandbox implementation for browser_evaluate** (T043): inject a Proxy on `globalThis` before user script executes, blocking property accesses to `document.cookie`, `localStorage`, `sessionStorage`, `fetch`, `XMLHttpRequest`, `window.location` setter, `history.pushState`. Tested via dedicated conformance suite.
3. **RateLimiter queue strategy** (T049): per-domain FIFO queues + global pacer. Sliding 60-second window. No starvation guarantee via queue order preservation.

---

## Phase 1 — Design

### MCP server (T019) — adapter pattern

```ts
// mcp/Server.ts (skeleton)
import { Server as MCPServer } from '@modelcontextprotocol/sdk/server';  // ONE OF TWO permitted import sites
import { ToolRegistry } from './ToolRegistry.js';

export class MCPServerAdapter {
  constructor(private registry: ToolRegistry, private logger: Logger) {}
  async start(): Promise<void> { /* register all from registry; bind transport */ }
  async stop(): Promise<void> { /* clean shutdown */ }
}
```

### Per-tool template

Each tool file has the same shape:

```ts
// mcp/tools/<name>.ts
import { z } from 'zod';
import { MCPToolDefinition } from '../types.js';
// ... business logic uses BrowserSession from Phase 1's BrowserEngine adapter

export const InputSchema = z.object({ /* ... */ }).strict();
export const OutputSchema = z.object({ /* ... */ }).strict();

export const navigateTool: MCPToolDefinition<z.infer<typeof InputSchema>, z.infer<typeof OutputSchema>> = {
  name: 'browser_navigate',                    // EXACT v3.1 (R4.5)
  description: '...',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  safetyClass: 'safe',                         // T066 ActionClassifier in Phase 4 may upgrade per policy
  handler: async (input, ctx) => { /* ... */ },
};
```

### T048 page_analyze (the critical task)

Single `page.evaluate()` returns a JSON object matching `AnalyzePerceptionSchema`. Inside the page context: 14 v2.3 enrichments computed inline alongside the 9 baseline sections. The enrichments are *additional sub-fields*, not new sections — they extend `metadata`, `structure`, `textContent`, `ctas`, `forms`, `trustSignals`, `iframes`, `accessibility`, `performance`, `inferredPageType`. After return, `AnalyzePerceptionSchema.parse()` validates the shape.

Per spec/impact: AnalyzePerception schema is the highest-fanout contract in Neural; T048 conformance test (`page-analyze-v23.test.ts`) verifies every v2.3 field on 3 fixture pages (homepage, PDP, checkout). The schema includes top-level `_extensions: z.record(z.string(), z.unknown()).optional()` reserved for Phase 7+ enrichment (consistent with PageStateModel pattern).

### RateLimiter (T049)

```ts
export class DomainRateLimiter implements RateLimiter {
  // per-domain queues, sliding window timestamps, 2s min interval globally
  async acquire(domain: string): Promise<void> { /* ... */ }
  release(domain: string): void { /* ... */ }
  stats(): { /* ... */ }
}
```

### Forward-compat seam

All four contracts (MCPToolRegistry, MCPToolSchema, AnalyzePerception, RateLimiter) include extensibility hooks (where appropriate) per Phase 1 PageStateModel pattern. AnalyzePerception specifically reserves `_extensions` for Phase 7 deep_perceive composition (per impact.md "Forward Contract" section).

---

## Complexity Tracking

**None — plan respects all 23 Constitution rules.**

The new MCP adapter category is the *expected* outcome of R9 generalization; not a violation. impact.md provides provenance per R22.

---

## Approval Gates

| Gate | Approver | Evidence |
|---|---|---|
| Spec → Plan transition | spec author + product owner | spec `approved` AND impact.md `approved` |
| Tech stack adherence | engineering lead | All §6.4 fields match canonical |
| Constitution check | engineering lead | All checkboxes ticked above |
| Impact analysis approved (HIGH-risk) | engineering lead | impact.md `approved`; 4-contract review explicitly signed off |
| Plan → Tasks transition | engineering lead | This plan `approved` |

---

## Cross-references

- Phase 1 spec, impact (forward contract: BrowserEngine + PageStateModel consumed here)
- `docs/specs/mvp/tasks-v2.md` T016-T050
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` REQ-MCP-* + REQ-BROWSE-HUMAN-* + REQ-BROWSE-RATE-*
- `docs/specs/final-architecture/08-tool-manifest.md` (canonical 28-tool list)
- `docs/specs/final-architecture/07-analyze-mode.md` §07.9 + §07.9.1 (AnalyzePerception v2.3 — T048's primary reference)
- `docs/specs/mvp/constitution.md` R4, R8, R9, R20, R23
