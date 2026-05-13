---
title: Tasks — Phase 2 MCP Tools + Human Behavior
artifact_type: tasks
status: approved
version: 0.2
created: 2026-04-27
updated: 2026-05-12
owner: engineering lead
authors: [Claude (drafter), Claude (master orchestrator session 16 — v0.2 Gate 1 Pass 1 patch wave)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-2-tools/spec.md
  - docs/specs/mvp/phases/phase-2-tools/plan.md
  - docs/specs/mvp/phases/phase-2-tools/impact.md
  - docs/specs/mvp/tasks-v2.md (T016-T050)
  - docs/specs/mvp/constitution.md (R3, R4, R9, R18, R19, R20, R23)
  - .claude/skills/neural-dev-workflow/
  # v0.2 — Phase 1b/1c upstream rollups added per CLAUDE.md §1b rollup-first rule (Gate 1 finding F-S3)
  - docs/specs/mvp/phases/phase-1-perception/phase-1-current.md
  - docs/specs/mvp/phases/phase-1b-perception-extensions/phase-1b-current.md
  - docs/specs/mvp/phases/phase-1c-perception-bundle/phase-1c-current.md

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
    # v0.2 — Gate 1 Pass 1 patch wave (master orchestrator session 16, 2026-05-12) — REVISE
    - v0.2 — Phase 1b/1c upstream rollups added to derived_from (F-S3)
    - v0.2 — T019 brief: ToolRegistry interface duplicate removed; references impact.md as canonical (F-T2)
    - v0.2 — T042 file path aligned: requestHuman.ts → agentRequestHuman.ts (matches T041 agentComplete.ts convention) (F-S6)
    - v0.2 — T048 brief extended: upstream Phase 1b extractor reuse acknowledged; namespace contract kill criterion added; F-G2 settle precondition; F-S13 IframePurpose closed-enum constraint (F-S4 + F-G2 + F-S13)
    - v0.2 — Explicit safetyClass added for T043 (requires_safety_check) + T044-T048 (safe) — closes F-S12 6-of-29 unclassified gap
    - v0.2 — T050 integration test brief: 28 tools → 29 MCP tools; namespace assertion added (F-T1)
    - v0.2 — Constitution range updated R1-R23 → R1-R26 in governing_rules + R3 default block citations (F-S10)
  changed:
    - v0.1 → v0.2 — Gate 1 Pass 1 patch wave; no scope changes; all task IDs T-PHASE2-* + T016-T050 stable
  impacted: []
  unchanged:
    - All task IDs (T016-T050 + T-PHASE2-{TESTS,TYPES,LOGGER,DOC,INSPECTOR,ROLLUP}) stable per R18 append-only

governing_rules:
  - Constitution R3 (TDD)
  - Constitution R4 (Browser Agent — exact tool names)
  - Constitution R9 (adapter)
  - Constitution R18 (append-only — task IDs preserved through v0.2)
  - Constitution R19 (rollup-first — predecessor rollups in derived_from)
  - Constitution R20 (impact)
  - Constitution R23 (kill criteria)
  - Phase 1c impact.md §11 (namespace contract carryforward)

description: "Phase 2 task list — 35 tasks; tools registered with EXACT v3.1 names; AnalyzePerception authored at T048; v0.2 Gate 1 Pass 1 patch wave acknowledges Phase 1b/1c upstream substrate + closes safetyClass coverage + IframePurpose enum constraint."
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

**Goal:** MCP server boots, all 29 MCP tools register (22 browser_* + 2 agent_* + 5 page_*), Phase 2 integration test runs every tool against amazon.in.

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
  - **Brief — Outcome:** `mcp/Server.ts` exports `MCPServerAdapter` wrapping `@modelcontextprotocol/sdk` with `start()` + `stop()`. `mcp/ToolRegistry.ts` exports `ToolRegistry` interface (canonical shape declared in [impact.md MCPToolRegistry section](impact.md) — DO NOT redefine here). Boot fails fast on duplicate tool name. `tools/list` returns 0 tools at this point.
  - **Files:** `packages/agent-core/src/mcp/Server.ts`, `packages/agent-core/src/mcp/ToolRegistry.ts`, `packages/agent-core/src/mcp/index.ts`
  - **dep:** T-PHASE2-TYPES, T-PHASE2-TESTS
  - **Smoke test:** `new MCPServerAdapter(registry).start()` boots in < 500 ms; duplicate registration throws.
  - **Constraints:** Server.ts < 200 lines. ToolRegistry.ts < 150 lines. Interface shape MUST match impact.md MCPToolRegistry verbatim (R11 single source of truth — F-T2).
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
| T042 | `agent_request_human` | `mcp/tools/agentRequestHuman.ts` | requires_hitl | HITL pause (filename matches T041 agentComplete.ts convention — full prefix retained per F-S6) |

Each task **dep**: T-PHASE2-TYPES, T019, T-PHASE2-TESTS (and T016/T017/T018 for tools that use them).

**Per-tool common kill criteria:** default block + tool name MUST match v3.1 EXACTLY (R4.5 violation = STOP).

**Recommended dispatch (3 parallel batches):**
- Batch A (~8 tools, navigation + state): T020, T021, T022, T023, T024, T025, T026, T030
- Batch B (~8 tools, interaction): T027, T028, T029, T031, T032, T033, T038, T040
- Batch C (~7 tools, advanced): T034, T035, T036, T037, T039, T041, T042

### Implementation tasks — Sandbox + Page tools

- [x] **T043 [US-1] browser_evaluate (sandboxed)** (AC-06, REQ-MCP-SANDBOX-001/002/003)
  - **Brief — Outcome:** `mcp/tools/browserEvaluate.ts` exports the `browser_evaluate` tool. Before user script executes, injects a Proxy on `globalThis` blocking property access to: (a) `document.cookie`, (b) `localStorage` / `sessionStorage`, (c) `fetch` / `XMLHttpRequest`, (d) `window.location` setter / `history.pushState`. All 4 vectors verified in conformance test.
  - **Safety class (v0.2 — F-S12):** `requires_safety_check` — arbitrary JS execution surface even within sandbox; HITL-eligible per Phase 4 SafetyCheck policy
  - **Files:** `packages/agent-core/src/mcp/tools/browserEvaluate.ts`
  - **dep:** T019, T-PHASE2-TYPES
  - **Smoke test:** AC-06 conformance test passes — all 4 sandbox blocks fire.
  - **Constraints:** File < 200 lines. Sandbox script string < 50 lines (kept inline; documented WHY each line is forbidden).
  - **Kill criteria:** default block + extra: any 4-vector test fails → STOP, sandbox is the security guarantee
  - **v1.1 backlog (informational):** sandbox v2 should extend block list to WebSocket + IndexedDB + Cache API + postMessage (per Gate 1 critic surface 4 — not a Phase 2 blocker)

- [x] **T044 [P] [US-1] page_get_element_info** (AC-07)
  - **Brief — Outcome:** Returns `{ boundingBox, isAboveFold, computedStyles, contrastRatio }` for a target id. Contrast computed via WCAG luminance formula.
  - **Safety class (v0.2 — F-S12):** `safe` — read-only perception
  - **Files:** `mcp/tools/pageGetElementInfo.ts`
  - **dep:** T019, T-PHASE2-TYPES
  - **Smoke test:** Returns valid contrast (4.5+ for WCAG AA passing fixtures).
  - **Kill criteria:** default block

- [x] **T045 [P] [US-1] page_get_performance** (AC-08)
  - **Brief — Outcome:** Returns **4 baseline metrics** ({DOMContentLoaded, fullyLoaded, resourceCount, LCP}) + **4 v2.3 enrichments** ({INP, CLS, TTFB, timeToFirstCtaInteractable}) per T048 AnalyzePerception schema.
  - **Safety class (v0.2 — F-S12):** `safe` — read-only perception
  - **Files:** `mcp/tools/pageGetPerformance.ts`
  - **dep:** T019, T-PHASE2-TYPES
  - **Kill criteria:** default block

- [x] **T046 [P] [US-1] page_screenshot_full** (AC-09)
  - **Brief — Outcome:** Scroll-stitch full-page screenshot up to 15000 px, JPEG ≤ 2 MB via Sharp.
  - **Safety class (v0.2 — F-S12):** `safe` — read-only perception
  - **Files:** `mcp/tools/pageScreenshotFull.ts`
  - **dep:** T019, T-PHASE2-TYPES
  - **Kill criteria:** default block

- [x] **T047 [P] [US-1] page_annotate_screenshot** (AC-10)
  - **Brief — Outcome:** Sharp-based overlay of severity-colored boxes + non-overlapping labels + legend.
  - **Safety class (v0.2 — F-S12):** `safe` — read-only perception (annotation produces new image; doesn't mutate page)
  - **Files:** `mcp/tools/pageAnnotateScreenshot.ts`
  - **dep:** T019, T-PHASE2-TYPES
  - **Kill criteria:** default block

### Implementation task — page_analyze v2.3 (THE CRITICAL ONE)

- [x] **T048 [US-1] page_analyze v2.3** (AC-11, REQ-TOOL-PA-001 + REQ-ANALYZE-PERCEPTION-V23-001) **— extended kill criteria**
  - **Brief — Outcome:** `mcp/tools/pageAnalyze.ts` exports the `page_analyze` tool. **Single `page.evaluate()` call within the handler** (the upstream `waitForSettle` precondition's internal evaluate does NOT count — see kill criteria) runs all 9 baseline + 14 v2.3 enrichment extractions inside the page context, returning a JSON object that Zod-parses as `AnalyzePerception` (a SEPARATE Zod schema distinct from PSM — see F-G1 design decision below). The 14 v2.3 enrichments per §07.9.1: `metadata.canonical/lang/ogTags/schemaOrg`, `structure.titleH1Match/titleH1Similarity`, `textContent.valueProp/urgencyScarcityHits/riskReversalHits`, `ctas[].accessibleName/role/hoverFocusStyles`, `forms[].fields[].accessibleName/role`, `trustSignals[].subtype/source/attribution/freshnessDate/pixelDistanceToNearestCta`, `iframes[].purposeGuess`, `navigation.footerNavItems`, `accessibility.keyboardFocusOrder/skipLinks`, `performance.INP/CLS/TTFB/timeToFirstCtaInteractable`, `inferredPageType.primary/alternatives/signalsUsed`.
  - **Safety class (v0.2 — F-S12):** `safe` — read-only perception
  - **Context:** §07.9 + §07.9.1 are the verbatim authority. impact.md frames this as the highest-fanout schema in Neural; Phase 7 grounding rules + evaluate prompts depend on every field shape.
  - **Phase 1b/1c upstream substrate (v0.2 — F-S4):**
    - **Settle precondition (F-G2):** caller invokes `waitForSettle(page)` (Phase 1c SettlePredicate) BEFORE calling `page_analyze`. Settle's internal `page.evaluate` for `fonts.ready` does NOT count toward the single-call invariant. Verifiable via Playwright trace count (expected: 1 evaluate after settle).
    - **Schema relationship (F-G1):** `AnalyzePerceptionSchema` is a SEPARATE Zod schema authored at T-PHASE2-TYPES (extending PSM with v2.3 enrichments). Phase 1c `bundleToAnalyzePerception(bundle, stateId?)` accessor remains as PSM accessor (returns PageStateModel as alias). Phase 7 chooses contract per use case: PSM via accessor for grounding-rule lookups; full AnalyzePerception via direct `page_analyze` call when v2.3 enrichments are needed. Both contracts coexist.
    - **Phase 1b extractor reuse (RECOMMENDED):** if invoked on a state where `bundle.raw.page_state_model_by_state[stateId]._extensions.<extractor_name>` is already populated by Phase 1b extractors (PricingExtractor, AttentionScorer, ClickTargetSizer, CommerceBlockExtractor, CurrencySwitcherDetector, FrictionScorer, MicrocopyTagger, PopupPresenceDetector, SocialProofDepth, StickyElementDetector), `page_analyze` MAY READ those outputs via the accessor to compose its own enrichments — avoiding 2× perf cost. MUST NOT mutate them.
    - **Namespace contract (CRITICAL — F-S4 + Phase 1c impact.md §11):** `page_analyze`'s output `AnalyzePerception._extensions` MUST be `undefined` (not `{}`, not populated). The `_extensions` namespace is reserved for Phase 7 DeepPerceiveNode. AC-11 + AC-13 conformance MUST assert this.
    - **IframePurpose closed-enum constraint (F-S13):** `iframes[].purposeGuess` MUST be one of Phase 1c's `IframePurpose` enum values. Import via `import { IframePurpose } from '@neural/agent-core/perception';` and constrain via Zod `z.enum([...])`. New purposes require append-only Phase 1c enum extension first (R18) — never invent ad-hoc strings.
  - **Constraints:** File < 300 lines (R10.1). The `page.evaluate()` block (single call within the handler) stays in a single function body (split helpers via string interpolation is OK as long as evaluate fires once). Schema parse is mandatory before return — never emit raw JSON. Phase 1 PageStateModel pattern: `_extensions` field RESERVED but MUST stay `undefined` in Phase 2 capture (Phase 7 will namespace under `_extensions.deepPerceive`).
  - **Non-goals:** No multiple page.evaluate() calls in the handler (REQ-TOOL-PA-001 single-call invariant — settle precondition is the caller's responsibility, separate). No LLM call (Phase 7). No grounding (Phase 7).
  - **Acceptance:** AC-11 — conformance test passes on 3 fixture pages (homepage, PDP, checkout); every baseline + v2.3 field is either populated or explicitly null with reason; `_extensions` field MUST be `undefined`; `iframes[].purposeGuess` MUST validate against Phase 1c IframePurpose enum.
  - **Per-task kill criteria (extends default):**
    - "Two or more `page.evaluate()` calls in the page_analyze handler" (excluding upstream settle precondition's evaluate) → R23 trigger; REQ-TOOL-PA-001 single-call invariant.
    - "AnalyzePerception schema deviates from §07.9 + §07.9.1 verbatim" → R23 trigger; spec authority violation (R11.1).
    - "Phase 2 capture populates `_extensions` on PerceptionBundle.raw.* OR AnalyzePerception" → R23 trigger; namespace violation per Phase 1c impact.md §11 (R20 forward-compat) — this is the CRITICAL invariant Phase 7 depends on.
    - "page_analyze emits `iframes[].purposeGuess` with value outside Phase 1c IframePurpose closed enum" → R23 trigger; closed-contract drift (F-S13). Path forward: append to Phase 1c enum first (R18).
    - "page_analyze wall-clock > 5 s on amazon.in homepage" → R23 trigger; performance regression (NF-Phase2-03).
  - **Files:** `packages/agent-core/src/mcp/tools/pageAnalyze.ts`; modify `packages/agent-core/src/analysis/types.ts` if schema needs adjustment (should already be in place from T-PHASE2-TYPES).
  - **dep:** T019, T-PHASE2-TYPES (AnalyzePerception schema MUST exist + IframePurpose enum import wired), T-PHASE2-TESTS

### Implementation task — RateLimiter

- [ ] **T049 [US-1] RateLimiter** (AC-12, REQ-BROWSE-RATE-001/002)
  - **Brief — Outcome:** `browser-runtime/RateLimiter.ts` exports `DomainRateLimiter implements RateLimiter`. Enforces 2s min interval globally + per-domain caps (10/min unknown, 30/min trusted via configurable map). Sliding 60s window; FIFO queue; no starvation.
  - **Files:** `packages/agent-core/src/browser-runtime/RateLimiter.ts`
  - **dep:** T-PHASE2-TESTS
  - **Smoke test:** Simulated 60-call burst on `amazon.in` paces correctly within rate cap.
  - **Constraints:** File < 200 lines. Pure JS timing; no external timer libs.
  - **Kill criteria:** default block

### Phase 2 acceptance gate

- [x] **T050 [US-1] Phase 2 integration test** (AC-13)
  - **Brief — Outcome:** `tests/integration/phase2.test.ts` boots an in-process MCP server, registers all 29 MCP tools (22 browser_* + 2 agent_* + 5 page_*), exercises every tool against amazon.in (or a stable fixture if amazon.in flakes), asserts Zod-valid output OR documented typed error, total wall-clock < 5 minutes. **MUST also assert** (v0.2 — F-S4): `page_analyze` output's `_extensions` field is `undefined` (Phase 1c namespace contract carryforward).
  - **Files:** `packages/agent-core/tests/integration/phase2.test.ts`
  - **dep:** T016-T049 (everything)
  - **Constraints:** File < 300 lines. Test suite organized as one `describe()` per tool category. Namespace assertion in its own `describe('namespace contract', () => {...})` block for grep-discoverability.
  - **Kill criteria:** default block + extra: total wall-clock > 5 min → STOP, individual tool perf regression to investigate; namespace contract assertion failure → STOP, would silently break Phase 7 deepPerceive namespace.

**Checkpoint:** After T016-T050 + the 3 SETUP tasks green, all 13 ACs pass. Phase 2 ready for rollup.

---

## Phase N — Polish & Cross-Cutting Concerns

- [ ] **T-PHASE2-DOC [P]** Update root README quickstart with `pnpm test:integration phase2` validator.
- [ ] **T-PHASE2-INSPECTOR [P]** (optional) Document local MCP Inspector setup for manual tool debugging.
- [ ] **T-PHASE2-ROLLUP** Author `phase-2-current.md` per R19. Sections: active modules (mcp/, mcp/tools/, browser-runtime/ Mouse+Typing+Scroll+RateLimiter, analysis/types.ts AnalyzePerception); contracts (MCPToolRegistry, MCPToolSchema, AnalyzePerception, RateLimiter — all NEW); flows operational (29-tool MCP surface; namespace contract honored); known limitations (no LLM yet, no orchestration yet, sandbox 4-vector MVP scope only — v1.1 backlog); open risks for Phase 5 (LangGraph composition) + Phase 7 (AnalyzePerception schema stability under deep_perceive load + IframePurpose enum extension if new vendors emerge).

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
- `docs/specs/final-architecture/08-tool-manifest.md` (canonical 29 MCP tools + safety classes)
- `docs/specs/final-architecture/07-analyze-mode.md` §07.9 + §07.9.1 (T048 primary reference)
- `docs/specs/mvp/constitution.md` R4, R8, R9, R20, R23
