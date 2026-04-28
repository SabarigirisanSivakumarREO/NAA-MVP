---
title: Tasks — Phase 2 MCP Tools + Human Behavior
artifact_type: tasks
status: draft
version: 0.1
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
authors: [Claude (drafter)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-2-tools/spec.md
  - docs/specs/mvp/phases/phase-2-tools/plan.md
  - docs/specs/mvp/phases/phase-2-tools/impact.md
  - docs/specs/mvp/tasks-v2.md (T016-T050)
  - docs/specs/mvp/constitution.md (R3, R4, R9, R23)
  - .claude/skills/neural-dev-workflow/

req_ids:
  - REQ-MCP-001
  - REQ-MCP-002
  - REQ-MCP-SANDBOX-001..003
  - REQ-BROWSE-HUMAN-001..004
  - REQ-BROWSE-RATE-001..002
  - REQ-TOOL-PA-001
  - REQ-ANALYZE-PERCEPTION-V23-001
  - REQ-ANALYZE-V23-001

impact_analysis: docs/specs/mvp/phases/phase-2-tools/impact.md

delta:
  new:
    - Phase 2 tasks.md — 35 tasks (largest single-phase count in MVP)
    - T020-T042 organized as 23-tool table (parallelizable in 3 batches)
    - Per-task explicit kill criteria for T048 (page_analyze v2.3, AnalyzePerception schema author)
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R3 (TDD)
  - Constitution R4 (Browser Agent — exact tool names)
  - Constitution R9 (adapter)
  - Constitution R20 (impact)
  - Constitution R23 (kill criteria)

description: "Phase 2 task list — 35 tasks; tools registered with EXACT v3.1 names; AnalyzePerception authored at T048."
---

# Tasks: Phase 2 — MCP Tools + Human Behavior

**Input:** spec.md + plan.md + impact.md (this folder)
**Prerequisites:** spec.md `approved` AND impact.md `approved` (R20 HIGH-risk)
**Test policy:** TDD per R3.1 — conformance + integration tests authored FIRST, observed FAILING, then T016-T050 implement.
**Organization:** Single user story (US-1 from spec). 35 tasks; the 23 browse tools share AC-05 (parameterized test).

---

## Task ID Assignment

Phase 2 IDs pulled from `docs/specs/mvp/tasks-v2.md` (T016-T050 — UNCHANGED in v2.3 / v2.3.1).

Format: `[T-NNN] [P?] [US-N?] Description (AC-NN, REQ-ID)`

---

## Path Conventions (architecture.md §6.5)

Phase 2 touches:
- `packages/agent-core/src/mcp/` (NEW directory tree)
- `packages/agent-core/src/mcp/tools/` (28 files, one per tool)
- `packages/agent-core/src/browser-runtime/` (4 new files: Mouse/Typing/Scroll/RateLimiter)
- `packages/agent-core/src/analysis/types.ts` (NEW — AnalyzePerception schema, even though pipeline is Phase 7)
- `packages/agent-core/src/observability/logger.ts` (modify — add tool correlation fields)
- `packages/agent-core/tests/conformance/` (12 new tests)
- `packages/agent-core/tests/integration/phase2.test.ts` (T050)
- `packages/agent-core/package.json` (add `@modelcontextprotocol/sdk`, `ghost-cursor`)

No dashboard, db schema, LangGraph, or grounding work.

---

## Default Kill Criteria *(R23 — applies to all tasks)*

```yaml
kill_criteria:
  resource:
    token_budget_pct: 85
    wall_clock_factor: 2x
    iteration_limit: 3
  quality:
    - "any previously-passing test breaks"
    - "pnpm test:conformance -- <component> fails after task supposedly complete"
    - "implementation reveals spec defect (R11.4 — fix spec first)"
    - "tool name does NOT match v3.1 EXACTLY (R4.5 violation)"
    - "@modelcontextprotocol/sdk imported outside mcp/Server.ts + mcp/tools/*.ts (R9 violation)"
    - "any direct Playwright import outside Phase 1 boundary (BrowserManager, BrowserEngine.ts)"
    - "AnalyzePerception schema deviates from §07.9 + §07.9.1 verbatim (R11.1 violation)"
    - "page_analyze uses more than ONE page.evaluate() call (REQ-TOOL-PA-001 violation)"
  scope:
    - "diff introduces forbidden pattern (R13)"
    - "task expands beyond plan.md file table"
    - "tool registers with WRONG safetyClass (must match 08-tool-manifest.md)"
  on_trigger:
    - "snapshot WIP to wip/killed/<task-id>-<reason>"
    - "log to task thread with specific failure mode"
    - "escalate to human"
    - "do NOT silently retry; do NOT --no-verify"
```

T048 carries additional per-task kill criteria.

---

## Phase 1 — Setup (impact.md prerequisite)

`impact.md` MUST be `status: approved` (HIGH risk, 4 contracts) before any T016-T050 begins. R20 enforcement.

Add Phase 2 deps to `packages/agent-core/package.json`:
- `@modelcontextprotocol/sdk` (latest pinned)
- `ghost-cursor` (latest)

---

## Phase 2 — Foundational (Blocking Prerequisites)

- [ ] **T-PHASE2-TESTS [P] [SETUP]** Author all 12 conformance tests + Phase 2 integration test FIRST. Every AC-01..AC-13 block FAILS initially. R3.1 enforcement.
- [ ] **T-PHASE2-TYPES [SETUP]** Author `mcp/types.ts` (MCPToolSchema, SafetyClass enum) + `analysis/types.ts` (AnalyzePerceptionSchema with all baseline 9 sections + 14 v2.3 fields per §07.9.1, top-level `_extensions` reservation). These types unblock every tool.
- [ ] **T-PHASE2-LOGGER [SETUP]** Modify `observability/logger.ts` to register tool_name + tool_call_id + client_session_id correlation fields.

**Checkpoint:** Conformance tests fail; AnalyzePerception schema in place; logger has tool fields. Then proceed to T016-T050.

---

## Phase 3 — User Story 1: An LLM-driven agent drives the browser via MCP tools (Priority: P1) 🎯 MVP

**Goal:** MCP server boots, all 28 tools register, Phase 2 integration test runs every tool against amazon.in.

**Independent Test:** `pnpm -F @neural/agent-core test integration/phase2`.

**AC IDs covered:** AC-01 through AC-13.

### Implementation tasks — Human Behavior

- [ ] **T016 [P] [US-1] MouseBehavior** (AC-01, REQ-BROWSE-HUMAN-001/002)
  - **Brief — Outcome:** `browser-runtime/MouseBehavior.ts` exports `mouseBehavior.click(page, target)` using ghost-cursor for Bezier-curve motion; ~500 ms mean per click verified via Playwright trace timing.
  - **Files:** `packages/agent-core/src/browser-runtime/MouseBehavior.ts`; modify `packages/agent-core/package.json` to add `ghost-cursor`.
  - **dep:** T006 (Phase 1 BrowserManager); T-PHASE2-TESTS, T-PHASE2-LOGGER
  - **Smoke test:** `mouseBehavior.click(page, '#search')` records ~500 ms motion via Playwright trace
  - **Constraints:** File < 150 lines. No `any`. ghost-cursor import isolated to this file.
  - **Kill criteria:** default block

- [ ] **T017 [P] [US-1] TypingBehavior** (AC-02, REQ-BROWSE-HUMAN-003/004)
  - **Brief — Outcome:** `browser-runtime/TypingBehavior.ts` exports `typingBehavior.type(page, target, text)` emitting Gaussian-delayed keystrokes (mean ~80 ms, σ ~20 ms) with 1-2% character typo rate (typo + backspace + correct).
  - **Files:** `packages/agent-core/src/browser-runtime/TypingBehavior.ts`
  - **dep:** T006; T-PHASE2-TESTS
  - **Smoke test:** Typing "amazon" emits 6-8 keystroke events via Playwright trace; ~1% have backspace correction.
  - **Constraints:** File < 150 lines. Pure function on Playwright keyboard API; no other deps.
  - **Kill criteria:** default block

- [ ] **T018 [P] [US-1] ScrollBehavior** (AC-03)
  - **Brief — Outcome:** `browser-runtime/ScrollBehavior.ts` exports `scrollBehavior.scroll(page, direction, distance)` with variable-momentum motion. Verified to trigger at least one lazy-loaded element (e.g., infinite-scroll product list) in single scroll cycle on a fixture page.
  - **Files:** `packages/agent-core/src/browser-runtime/ScrollBehavior.ts`
  - **dep:** T006; T-PHASE2-TESTS
  - **Smoke test:** Scroll on amazon.in homepage triggers `IntersectionObserver` callbacks on previously off-screen images.
  - **Kill criteria:** default block

### Implementation tasks — MCP Server

- [ ] **T019 [US-1] MCPServer skeleton** (AC-04, REQ-MCP-001/002)
  - **Brief — Outcome:** `mcp/Server.ts` exports `MCPServerAdapter` wrapping `@modelcontextprotocol/sdk` with `start()` + `stop()`. `mcp/ToolRegistry.ts` exports `ToolRegistry.register/list/get/getSafetyClass`. Boot fails fast on duplicate tool name. `tools/list` returns 0 tools at this point.
  - **Files:** `packages/agent-core/src/mcp/Server.ts`, `packages/agent-core/src/mcp/ToolRegistry.ts`, `packages/agent-core/src/mcp/index.ts`
  - **dep:** T-PHASE2-TYPES, T-PHASE2-TESTS
  - **Smoke test:** `new MCPServerAdapter(registry).start()` boots in < 500 ms; duplicate registration throws.
  - **Constraints:** Server.ts < 200 lines. ToolRegistry.ts < 150 lines.
  - **Kill criteria:** default block

### Implementation tasks — 23 Browse Tools (T020-T042) [P × 3 batches per PRD §10.10]

All 23 follow the same per-tool template (see [plan.md "Phase 1 Design"](plan.md)):
1. Define InputSchema + OutputSchema (Zod)
2. Implement handler using `BrowserSession` from Phase 1
3. Export `MCPToolDefinition` with EXACT v3.1 name + safetyClass
4. Register at `Server.start()` time
5. Conformance test in `tests/conformance/browse-tools.test.ts` (parameterized over name)

**Comprehension-debt pacing:** dispatch in 3 batches of ~8 tools each — NOT all 23 at once. Each batch reviewed before next dispatched. Per PRD §10.10 working-memory ceiling.

| Task | Tool name (EXACT) | File | Safety class | Notes |
|---|---|---|---|---|
| T020 | `browser_navigate` | `mcp/tools/navigate.ts` | safe | Wraps `BrowserSession.page.goto`; emits `navigation` audit event |
| T021 | `browser_go_back` | `mcp/tools/goBack.ts` | safe | `page.goBack()` wrapper |
| T022 | `browser_go_forward` | `mcp/tools/goForward.ts` | safe | `page.goForward()` wrapper |
| T023 | `browser_reload` | `mcp/tools/reload.ts` | safe | `page.reload()` wrapper |
| T024 | `browser_get_state` | `mcp/tools/getState.ts` | safe | Calls Phase 1 `ContextAssembler.capture()`, returns `PageStateModel` |
| T025 | `browser_screenshot` | `mcp/tools/screenshot.ts` | safe | Calls Phase 1 `ScreenshotExtractor.capture()` |
| T026 | `browser_get_metadata` | `mcp/tools/getMetadata.ts` | safe | Returns metadata sub-section only |
| T027 | `browser_click` | `mcp/tools/click.ts` | requires_safety_check | Uses MouseBehavior (T016); element-target version |
| T028 | `browser_click_coords` | `mcp/tools/clickCoords.ts` | requires_safety_check | Coordinate-based fallback |
| T029 | `browser_type` | `mcp/tools/type.ts` | requires_safety_check | Uses TypingBehavior (T017) |
| T030 | `browser_scroll` | `mcp/tools/scroll.ts` | safe | Uses ScrollBehavior (T018) |
| T031 | `browser_select` | `mcp/tools/select.ts` | requires_safety_check | `page.selectOption` wrapper |
| T032 | `browser_hover` | `mcp/tools/hover.ts` | safe | Uses MouseBehavior |
| T033 | `browser_press_key` | `mcp/tools/pressKey.ts` | requires_safety_check | `page.keyboard.press` |
| T034 | `browser_upload` | `mcp/tools/upload.ts` | requires_hitl | File upload — sensitive, HITL gate per R8.4 |
| T035 | `browser_tab_manage` | `mcp/tools/tabManage.ts` | safe | New tab / switch / close |
| T036 | `browser_extract` | `mcp/tools/extract.ts` | safe | Selector-based text extraction |
| T037 | `browser_download` | `mcp/tools/download.ts` | requires_hitl | File download — sensitive |
| T038 | `browser_find_by_text` | `mcp/tools/findByText.ts` | safe | Locator query |
| T039 | `browser_get_network` | `mcp/tools/getNetwork.ts` | safe | Network event capture |
| T040 | `browser_wait_for` | `mcp/tools/waitFor.ts` | safe | Wait for selector / timeout |
| T041 | `agent_complete` | `mcp/tools/agentComplete.ts` | safe | Orchestration signal — not page action |
| T042 | `agent_request_human` | `mcp/tools/requestHuman.ts` | requires_hitl | HITL pause |

Each task **dep**: T-PHASE2-TYPES, T019, T-PHASE2-TESTS (and T016/T017/T018 for tools that use them).

**Per-tool common kill criteria:** default block + tool name MUST match v3.1 EXACTLY (R4.5 violation = STOP).

**Recommended dispatch (3 parallel batches):**
- Batch A (~8 tools, navigation + state): T020, T021, T022, T023, T024, T025, T026, T030
- Batch B (~8 tools, interaction): T027, T028, T029, T031, T032, T033, T038, T040
- Batch C (~7 tools, advanced): T034, T035, T036, T037, T039, T041, T042

### Implementation tasks — Sandbox + Page tools

- [ ] **T043 [US-1] browser_evaluate (sandboxed)** (AC-06, REQ-MCP-SANDBOX-001/002/003)
  - **Brief — Outcome:** `mcp/tools/browserEvaluate.ts` exports the `browser_evaluate` tool. Before user script executes, injects a Proxy on `globalThis` blocking property access to: (a) `document.cookie`, (b) `localStorage` / `sessionStorage`, (c) `fetch` / `XMLHttpRequest`, (d) `window.location` setter / `history.pushState`. All 4 vectors verified in conformance test.
  - **Files:** `packages/agent-core/src/mcp/tools/browserEvaluate.ts`
  - **dep:** T019, T-PHASE2-TYPES
  - **Smoke test:** AC-06 conformance test passes — all 4 sandbox blocks fire.
  - **Constraints:** File < 200 lines. Sandbox script string < 50 lines (kept inline; documented WHY each line is forbidden).
  - **Kill criteria:** default block + extra: any 4-vector test fails → STOP, sandbox is the security guarantee

- [ ] **T044 [P] [US-1] page_get_element_info** (AC-07)
  - **Brief — Outcome:** Returns `{ boundingBox, isAboveFold, computedStyles, contrastRatio }` for a target id. Contrast computed via WCAG luminance formula.
  - **Files:** `mcp/tools/pageGetElementInfo.ts`
  - **dep:** T019, T-PHASE2-TYPES
  - **Smoke test:** Returns valid contrast (4.5+ for WCAG AA passing fixtures).
  - **Kill criteria:** default block

- [ ] **T045 [P] [US-1] page_get_performance** (AC-08)
  - **Brief — Outcome:** Returns `{ DOMContentLoaded, fullyLoaded, resourceCount, LCP, INP, CLS, TTFB, timeToFirstCtaInteractable }` (the latter 4 are v2.3 additions per T048 enrichment).
  - **Files:** `mcp/tools/pageGetPerformance.ts`
  - **dep:** T019, T-PHASE2-TYPES
  - **Kill criteria:** default block

- [ ] **T046 [P] [US-1] page_screenshot_full** (AC-09)
  - **Brief — Outcome:** Scroll-stitch full-page screenshot up to 15000 px, JPEG ≤ 2 MB via Sharp.
  - **Files:** `mcp/tools/pageScreenshotFull.ts`
  - **dep:** T019, T-PHASE2-TYPES
  - **Kill criteria:** default block

- [ ] **T047 [P] [US-1] page_annotate_screenshot** (AC-10)
  - **Brief — Outcome:** Sharp-based overlay of severity-colored boxes + non-overlapping labels + legend.
  - **Files:** `mcp/tools/pageAnnotateScreenshot.ts`
  - **dep:** T019, T-PHASE2-TYPES
  - **Kill criteria:** default block

### Implementation task — page_analyze v2.3 (THE CRITICAL ONE)

- [ ] **T048 [US-1] page_analyze v2.3** (AC-11, REQ-TOOL-PA-001 + REQ-ANALYZE-PERCEPTION-V23-001) **— extended kill criteria**
  - **Brief — Outcome:** `mcp/tools/pageAnalyze.ts` exports the `page_analyze` tool. **Single `page.evaluate()` call** runs all 9 baseline + 14 v2.3 enrichment extractions inside the page context, returning a JSON object that Zod-parses as `AnalyzePerception`. The 14 v2.3 enrichments per §07.9.1: `metadata.canonical/lang/ogTags/schemaOrg`, `structure.titleH1Match/titleH1Similarity`, `textContent.valueProp/urgencyScarcityHits/riskReversalHits`, `ctas[].accessibleName/role/hoverFocusStyles`, `forms[].fields[].accessibleName/role`, `trustSignals[].subtype/source/attribution/freshnessDate/pixelDistanceToNearestCta`, `iframes[].purposeGuess`, `navigation.footerNavItems`, `accessibility.keyboardFocusOrder/skipLinks`, `performance.INP/CLS/TTFB/timeToFirstCtaInteractable`, `inferredPageType.primary/alternatives/signalsUsed`.
  - **Context:** §07.9 + §07.9.1 are the verbatim authority. impact.md frames this as the highest-fanout schema in Neural; Phase 7 grounding rules + evaluate prompts depend on every field shape.
  - **Constraints:** File < 300 lines (R10.1). The `page.evaluate()` block stays in a single function body (split helpers via string interpolation is OK as long as evaluate fires once). Schema parse is mandatory before return — never emit raw JSON. Phase 1 PageStateModel pattern: `_extensions` field reserved on AnalyzePerception too (Phase 7 will namespace under `_extensions.deepPerceive`).
  - **Non-goals:** No multiple page.evaluate() calls (REQ-TOOL-PA-001 single-call invariant). No LLM call (Phase 7). No grounding (Phase 7).
  - **Acceptance:** AC-11 — conformance test passes on 3 fixture pages (homepage, PDP, checkout); every baseline + v2.3 field is either populated or explicitly null with reason.
  - **Per-task kill criteria (extends default):**
    - "Two or more `page.evaluate()` calls in the handler" → R23 trigger; REQ-TOOL-PA-001 single-call invariant.
    - "AnalyzePerception schema deviates from §07.9 + §07.9.1 verbatim" → R23 trigger; spec authority violation (R11.1).
    - "Phase 2 capture populates `_extensions`" → R23 trigger; that's Phase 7+ scope (R20 forward-compat).
    - "page_analyze wall-clock > 5 s on amazon.in homepage" → R23 trigger; performance regression (NF-Phase2-03).
  - **Files:** `packages/agent-core/src/mcp/tools/pageAnalyze.ts`; modify `packages/agent-core/src/analysis/types.ts` if schema needs adjustment (should already be in place from T-PHASE2-TYPES).
  - **dep:** T019, T-PHASE2-TYPES (AnalyzePerception schema MUST exist), T-PHASE2-TESTS

### Implementation task — RateLimiter

- [ ] **T049 [US-1] RateLimiter** (AC-12, REQ-BROWSE-RATE-001/002)
  - **Brief — Outcome:** `browser-runtime/RateLimiter.ts` exports `DomainRateLimiter implements RateLimiter`. Enforces 2s min interval globally + per-domain caps (10/min unknown, 30/min trusted via configurable map). Sliding 60s window; FIFO queue; no starvation.
  - **Files:** `packages/agent-core/src/browser-runtime/RateLimiter.ts`
  - **dep:** T-PHASE2-TESTS
  - **Smoke test:** Simulated 60-call burst on `amazon.in` paces correctly within rate cap.
  - **Constraints:** File < 200 lines. Pure JS timing; no external timer libs.
  - **Kill criteria:** default block

### Phase 2 acceptance gate

- [ ] **T050 [US-1] Phase 2 integration test** (AC-13)
  - **Brief — Outcome:** `tests/integration/phase2.test.ts` boots an in-process MCP server, registers all 28 tools, exercises every tool against amazon.in (or a stable fixture if amazon.in flakes), asserts Zod-valid output OR documented typed error, total wall-clock < 5 minutes.
  - **Files:** `packages/agent-core/tests/integration/phase2.test.ts`
  - **dep:** T016-T049 (everything)
  - **Constraints:** File < 300 lines. Test suite organized as one `describe()` per tool category.
  - **Kill criteria:** default block + extra: total wall-clock > 5 min → STOP, individual tool perf regression to investigate

**Checkpoint:** After T016-T050 + the 3 SETUP tasks green, all 13 ACs pass. Phase 2 ready for rollup.

---

## Phase N — Polish & Cross-Cutting Concerns

- [ ] **T-PHASE2-DOC [P]** Update root README quickstart with `pnpm test:integration phase2` validator.
- [ ] **T-PHASE2-INSPECTOR [P]** (optional) Document local MCP Inspector setup for manual tool debugging.
- [ ] **T-PHASE2-ROLLUP** Author `phase-2-current.md` per R19. Sections: active modules (mcp/, mcp/tools/, browser-runtime/ Mouse+Typing+Scroll+RateLimiter, analysis/types.ts AnalyzePerception); contracts (MCPToolRegistry, MCPToolSchema, AnalyzePerception, RateLimiter — all NEW); flows operational (28-tool MCP surface); known limitations (no LLM yet, no orchestration yet, sandbox single-vector blocking only); open risks for Phase 5 (LangGraph composition) + Phase 7 (AnalyzePerception schema stability under deep_perceive load).

---

## Dependencies & Execution Order

### Within Phase 2

```
T-PHASE2-TESTS  +  T-PHASE2-TYPES  +  T-PHASE2-LOGGER     # SETUP (parallel)
              │              │              │
              └──────┬───────┴──────────────┘
                     ▼
                   T019                                    # MCP server skeleton
                     │
       ┌─────────────┼─────────────────┐
       ▼             ▼                 ▼
   T016, T017,    T020-T042         T044-T047            # Human behavior, browse tools (3 parallel batches), page tools
   T018           (3 batches)
       │             │                 │
       └─────────────┼─────────────────┘
                     ▼
                   T043, T048, T049                       # Sandbox, page_analyze v2.3, RateLimiter
                     │
                     ▼
                   T050                                   # Phase 2 integration test
                     │
                     ▼
T-PHASE2-DOC, T-PHASE2-INSPECTOR (opt), T-PHASE2-ROLLUP
```

### Comprehension-Debt Pacing (PRD §10.10)

- T020-T042 (23 tools): dispatch in **3 batches of ~8 tools each**. Review each batch before next.
- T048 is single-threaded — do NOT parallelize. Highest review surface in Phase 2.
- T-PHASE2-TYPES (AnalyzePerception schema) MUST land before T048; serial.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. SETUP — author T-PHASE2-TESTS + T-PHASE2-TYPES + T-PHASE2-LOGGER. All AC blocks FAIL.
2. Implement T016 (MouseBehavior), T017 (TypingBehavior), T018 (ScrollBehavior) — parallel.
3. Implement T019 (MCPServer skeleton).
4. Dispatch T020-T042 in 3 batches of ~8 tools (PRD §10.10 pacing). Review each batch.
5. Implement T043 (browser_evaluate sandbox), T044-T047 (page tools), T049 (RateLimiter) — parallel after T019.
6. Implement T048 (page_analyze v2.3) — single-threaded; highest review surface.
7. Implement T050 (integration test) — gate.
8. T-PHASE2-DOC + T-PHASE2-INSPECTOR (opt) + T-PHASE2-ROLLUP.

### Per-task workflow (apply `neural-dev-workflow` skill)

Standard: Brief → Kill criteria → Test-first → Implement → Validate (`pnpm lint && pnpm typecheck && pnpm test && pnpm test:conformance -- <component>`) → Commit (`feat(mcp): T0NN <summary> (REQ-MCP-...)`).

---

## Notes

- `[P]` = parallelizable. T020-T042 are [P] within batches; not all 23 at once (PRD §10.10).
- `[US-1]` = single user story.
- TDD enforced: all conformance + integration tests FAIL before T016-T050 implementation.
- Tool names are EXACT v3.1 (R4.5). Renaming during implementation is a R23 kill trigger.
- AnalyzePerception schema is the highest-fanout contract; treat T048 with extra rigor.
- One task = one commit (R11.5). Tools T020-T042 within a batch may share a single PR if the batch is reviewed atomically.

---

## Cross-references

- spec.md, plan.md, impact.md (this folder)
- Phase 1 spec, impact (forward contract)
- `docs/specs/mvp/tasks-v2.md` T016-T050
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` REQ-MCP-* + REQ-BROWSE-HUMAN-* + REQ-BROWSE-RATE-*
- `docs/specs/final-architecture/08-tool-manifest.md` (canonical 28 tools + safety classes)
- `docs/specs/final-architecture/07-analyze-mode.md` §07.9 + §07.9.1 (T048 primary reference)
- `docs/specs/mvp/constitution.md` R4, R8, R9, R20, R23
