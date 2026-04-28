---
title: Phase 2 — MCP Tools + Human Behavior
artifact_type: phase-readme
status: approved
version: 1.0
phase_number: 2
phase_name: Tools
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
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
delta:
  new:
    - Phase 2 README
  changed: []
  impacted: []
  unchanged: []
governing_rules:
  - Constitution R4 (Browser Agent Rules — R4.1 perception first, R4.5 exact tool names)
  - Constitution R8 (Cost & Safety — R8.3 rate limiting)
  - Constitution R9 (Adapter Pattern — MCP server adapter)
  - Constitution R17, R19, R20
  - PRD §F-003, §F-004, §F-005 (AnalyzePerception v2.3)
---

# Phase 2 — MCP Tools + Human Behavior

> **Summary (~150 tokens):** Build the action surface of the browser agent. 35 tasks (T016-T050) covering: human behavior layer (MouseBehavior + ghost-cursor, TypingBehavior + Gaussian delays, ScrollBehavior); MCP server skeleton over @modelcontextprotocol/sdk with Zod-registered tools; **29 MCP tools** across T020-T048 — 24 `browser_*` (navigate / click / type / scroll / get_state / screenshot / find_by_text / browser_evaluate sandboxed / etc.), 2 `agent_*` (complete, request_human), and 5 `page_*` (element_info, performance, screenshot_full, annotate, analyze); browser_evaluate sandbox blocking cookies/localStorage/fetch/navigation; RateLimiter (2s min interval, per-domain caps); and Phase 2 integration test exercising every tool on amazon.in. **The critical task is T048 page_analyze v2.3** producing the AnalyzePerception with 14 v2.3 enrichments — the contract that Phase 7 analysis pipeline will consume. No LLM calls, no orchestration graph, no findings — pure tool surface.

## Goal

After Phase 2: an MCP server boots, registers all 29 tools (24 `browser_*` + 2 `agent_*` + 5 `page_*`), and a Phase 2 integration test exercises every tool tool-by-tool on amazon.in returning Zod-validated results. `page_analyze` returns AnalyzePerception with every baseline + v2.3 enrichment field populated. RateLimiter enforces 2s minimum + per-domain caps. browser_evaluate sandbox blocks the four forbidden surfaces.

## Tasks (categorical view; 35 total)

| Group | Tasks | Tool count | Description |
|---|---|---|---|
| Human behavior | T016, T017, T018 | (browser-runtime layer; not MCP tools) | MouseBehavior (ghost-cursor), TypingBehavior (Gaussian + 1-2% typos), ScrollBehavior (lazy-load triggers) |
| MCP server | T019 | (server itself; not a tool) | @modelcontextprotocol/sdk skeleton + Zod tool registration |
| 23 Browse + Agent tools `[P]` | T020-T042 | 21 `browser_*` + 2 `agent_*` | navigate, go_back, go_forward, reload, get_state, screenshot, get_metadata, click, click_coords, type, scroll, select, hover, press_key, upload, tab_manage, extract, download, find_by_text, get_network, wait_for, agent_complete, agent_request_human |
| Sandboxed browser tool | T043 | 1 `browser_evaluate` | Blocks cookies/localStorage/fetch/navigation |
| 4 page perception tools | T044-T047 | 4 `page_*` | element_info, performance, screenshot_full, annotate_screenshot |
| Analysis perception tool | T048 | 1 `page_analyze` | Single page.evaluate() returning full AnalyzePerception with 14 v2.3 enrichments |
| Rate limiting | T049 | (infrastructure; not a tool) | RateLimiter (2s min, per-domain) |
| Integration | T050 | (acceptance test; not a tool) | Phase 2 acceptance test on amazon.in |

**Tool count totals:** 22 `browser_*` (T020-T040 + T043) + 2 `agent_*` (T041, T042) + 5 `page_*` (T044-T048) = **29 MCP tools**. (Note: tasks-v2.md line 250 says "28 tools" — same off-by-one drift; flagged for end-of-session cross-phase audit.)

Full descriptions in [tasks.md](tasks.md). Cross-reference: [tasks-v2.md T016-T050](docs/specs/mvp/tasks-v2.md).

## Exit criteria

- [ ] MCP server boots; all 29 tools register with Zod schemas
- [ ] Phase 2 integration test (T050) green: every tool exercised on amazon.in
- [ ] `page_analyze` returns AnalyzePerception with all baseline + 14 v2.3 enrichments populated on 3 fixture pages
- [ ] `browser_evaluate` sandbox blocks cookies/localStorage/fetch/navigation (4 dedicated assertions)
- [ ] RateLimiter enforces 2s min + per-domain limits (10/min unknown, 30/min trusted)
- [ ] No direct Playwright imports outside `BrowserEngine` / `BrowserManager` (R9 still holds)

## Depends on

- **Phase 1** (BrowserManager + BrowserSession + PageStateModel + AccessibilityExtractor + ContextAssembler — every browse tool consumes these)

## Blocks

- **Phase 5** (Browse MVP — needs full MCP tool surface to assemble graph nodes)
- **Phase 7** (Analysis Pipeline — DeepPerceiveNode calls T048 page_analyze)

## Rollup on exit

```bash
pnpm spec:rollup --phase 2
```

Generates `phase-2-current.md` per R19. Active modules: human behavior + MCP server + 28 tools + RateLimiter. Data contracts in effect: MCP tool I/O schemas + AnalyzePerception v2.3. Forward risks for Phase 5: tool composition into LangGraph nodes; for Phase 7: AnalyzePerception consumed by deep_perceive.

## Reading order for Claude Code

When picking up a Phase 2 task:

1. This README
2. [tasks.md](tasks.md) — find target task
3. [spec.md](spec.md) — AC/R-NN context
4. [plan.md](plan.md) — tech context + file map
5. `docs/specs/final-architecture/08-tool-manifest.md` — canonical 28-tool spec
6. `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` — REQ-MCP-* + REQ-BROWSE-HUMAN-* + REQ-BROWSE-RATE-*
7. `docs/specs/final-architecture/07-analyze-mode.md` §07.9 + §07.9.1 — AnalyzePerception v2.3 schema for T048
8. `docs/specs/mvp/constitution.md` R4 (browser rules), R8 (cost+safety), R9 (adapter)

Do NOT load:
- `06-browse-mode.md` in full (Phase 1 covered)
- Analysis pipeline specs (§07.4-§07.8 — Phase 7)
- Other phase folders

## Known cross-references / discrepancies to resolve

- PRD §7 line 563 + §13 line 1135 reference "12 MCP tools" (legacy v3.1 count). tasks-v2.md line 250 says "28 tools" (off-by-one). Master plan v2.3 task list (T020-T048) actually contains **29 MCP tools** (22 `browser_*` + 2 `agent_*` + 5 `page_*`). Phase 2 implements 29; PRD references + tasks-v2 line 250 are summary-level drift. Flag for end-of-session cross-phase audit.
