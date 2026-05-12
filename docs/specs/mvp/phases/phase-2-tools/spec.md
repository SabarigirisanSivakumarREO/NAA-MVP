---
title: Phase 2 — MCP Tools + Human Behavior
artifact_type: spec
status: approved
version: 0.3.1
created: 2026-04-27
updated: 2026-05-12
owner: engineering lead
authors: [Claude (drafter), Claude (master orchestrator session 16 — v0.3 Gate 1 Pass 1 patch wave)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (F-003 Browser Agent, F-004 Browser Perception, F-005 Analysis Perception v2.3)
  - docs/specs/mvp/constitution.md (R4 browser rules, R8 cost+safety, R9 adapter, R17-R26)
  - docs/specs/mvp/architecture.md (§6.4 tech stack, §6.5 file structure)
  - docs/specs/mvp/tasks-v2.md (T016-T050)
  - docs/specs/AI_Browser_Agent_Architecture_v3.1.md (REQ-MCP-*, REQ-BROWSE-HUMAN-*, REQ-BROWSE-RATE-*)
  - docs/specs/final-architecture/08-tool-manifest.md (canonical 29-tool spec)
  - docs/specs/final-architecture/07-analyze-mode.md §07.9 + §07.9.1 (AnalyzePerception v2.3)
  - docs/specs/mvp/phases/phase-1-perception/spec.md (Phase 1 prerequisite)
  - docs/specs/mvp/phases/phase-1-perception/impact.md (BrowserEngine + PageStateModel — consumed here)
  # v0.3 — Phase 1b/1c upstream rollups added per CLAUDE.md §1b rollup-first rule (Gate 1 finding F-S3)
  - docs/specs/mvp/phases/phase-1-perception/phase-1-current.md
  - docs/specs/mvp/phases/phase-1b-perception-extensions/phase-1b-current.md
  - docs/specs/mvp/phases/phase-1c-perception-bundle/phase-1c-current.md

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
    - Phase 2 spec — introduces MCP server + 29 tools + AnalyzePerception v2.3 schema
    - AC-01..AC-13 stable IDs (13 ACs; 23 browse tools share AC-05 via parameterized test)
    - R-01..R-15 functional requirements
    - v0.2 — `affected_contracts` frontmatter aligned with impact.md (4 contracts; PageElementInfo + PagePerformanceMetrics removed — they are tool-local return types covered by the MCPToolSchema umbrella, not separate shared contracts) — analyze finding F-D2/F-A1
    - v0.2 — Tool count clarified: 29 MCP tools (22 browser_* + 2 agent_* + 5 page_*) across T020-T048; previous "28" was off-by-one (analyze finding F-A2) — NOTE v0.3: textual sweep was promised in v0.2 delta but not actually executed; v0.3 closes the loop (F-T1)
    - v0.2 — AC-08 explicitly partitions page_get_performance metrics: 4 baseline + 4 v2.3 enrichments (analyze finding F-C1)
    # v0.3 — Gate 1 Pass 1 patch wave (master orchestrator session 16, 2026-05-12) — REVISE
    - v0.3 — Phase 1b/1c upstream rollups added to derived_from (F-S3); §"Constraints Inherited from Phase 1b/1c substrate" section added (F-S1, F-S9)
    - v0.3 — F-T1 textual sweep executed: 7 occurrences of "28 tools" → "29 MCP tools (22 browser_* + 2 agent_* + 5 page_*)" across AC-04, US-1 acceptance #1+#8, SC-001, AC-13 brief
    - v0.3 — AC-02 token budget updated 1500 → 20,000 per NF-Phase1-01 v0.4 canonical (F-S2)
    - v0.3 — R-08 restated to mirror AC-08 partition (4 baseline + 4 v2.3 enrichments) for parallel structure (F-S7)
    - v0.3 — R-11 + Assumption #4 clarified: caller invokes waitForSettle BEFORE page_analyze; single-call invariant counts only the analyze handler's page.evaluate (F-G2)
    - v0.3 — Out of Scope updated: Phase 0b status reflects current implementation reality (F-S11)
    - v0.3 — Constitution range updated R1-R23 → R1-R26 (F-S10)
    - v0.3 — PRD line-number citations replaced with section IDs (F-S8)
  changed:
    - v0.1 → v0.2 — analyze-driven fixes (F-D2/F-A1, F-A2, F-C1); no scope changes
    - v0.2 → v0.3 — Gate 1 Pass 1 patch wave (8 actions act-001..act-008); no scope changes; staleness sweep + drift fixes
    # v0.3.1 — T-PHASE2-TYPES R11.4 correction (commit pending; master orchestrator session 16, 2026-05-12)
    - v0.3 → v0.3.1 — IframePurpose enum value correction discovered by T-PHASE2-TYPES subagent: actual Phase 1c enum is 9-value (checkout, chat, video, analytics, social_embed, captcha, cmp, payment_3ds, other), NOT 10-value; `video` not `video_embed`; `cross_origin` is a classifyIframe() security-override return value, NOT an enum member. v0.3 Pass 1 patch wave cited Phase 1c enum from memory; T-PHASE2-TYPES verified against IframePolicyEngine.ts:44-58 verbatim and reported drift. Corrected in 4 sites across spec.md + impact.md.
  impacted:
    - Constitution R9 — second adapter category (MCP server) lands
    - PRD §F-003 + §F-004 "12 MCP tools" references are legacy (PRD line numbers no longer cited per F-S8); master plan v2.3 + this spec govern (29 tools)
    - tasks-v2.md "28 tools" — same off-by-one; flagged for end-of-session cross-phase audit (do NOT patch in this round)
  unchanged:
    - AC-01..AC-13 stable IDs and acceptance scenarios (R18 append-only)
    - R-01..R-15 functional requirement IDs and statements
    - User Scenarios, Out of Scope structure, Constitution Alignment Check sections preserved (R18 append-only — only field VALUES updated, not IDs or structure)

governing_rules:
  - Constitution R4 (Browser Agent Rules — perception first, exact tool names)
  - Constitution R8 (Cost & Safety — rate limiting structural)
  - Constitution R9 (Loose Coupling / Adapter Pattern — MCP server adapter)
  - Constitution R11 (Spec discipline)
  - Constitution R17 (Lifecycle)
  - Constitution R18 (append-only delta enforced for v0.3 patch wave)
  - Constitution R19 (rollup-first reading order — predecessor rollups primary inputs)
  - Constitution R20 (Impact Analysis — AnalyzePerception v2.3 + RateLimiter shared contracts)
  - Constitution R23 (Kill Criteria)
  - Phase 1c impact.md §11 (namespace contract carryforward — Phase 2 MUST NOT write to bundle.raw.*._extensions)
---

# Feature Specification: Phase 2 — MCP Tools + Human Behavior

> **Summary (~150 tokens):** Build the browser agent's action and analysis-perception surface. 35 tasks (T016-T050) split across human behavior (MouseBehavior, TypingBehavior, ScrollBehavior), MCP server skeleton with Zod tool registration, **29 MCP tools** across T020-T048 (**22 `browser_*` + 1 sandboxed `browser_evaluate` + 2 `agent_*` + 5 `page_*`** including the critical T048 `page_analyze` v2.3) that produces `AnalyzePerception` with all 14 v2.3 enrichment categories (~30 sub-fields), sandbox blocking cookies / localStorage / fetch / navigation, and RateLimiter (2s min interval, 10/min unknown, 30/min trusted). Consumes Phase 1's `BrowserEngine` + `PageStateModel` (≤ 20K tokens per NF-Phase1-01 v0.4) AND Phase 1c's `PerceptionBundle` envelope + `bundleToAnalyzePerception` accessor + `IframePurpose` closed enum. Produces the `AnalyzePerception` contract that Phase 7 deep_perceive consumes. No LLM calls in Phase 2 — pure tool surface. Phase 5 Browse MVP composes these tools into LangGraph nodes; Phase 7 calls page_analyze.

**Feature Branch:** `phase-2-tools` (created at implementation time)
**Input:** Phase 2 scope from `docs/specs/mvp/phases/INDEX.md` row 2 + `tasks-v2.md` T016-T050

---

## Mandatory References

1. `docs/specs/mvp/constitution.md` — R4 (perception first; exact tool names — `browser_get_state` NOT `page_snapshot`), R8 (rate limiting structural in code, not prompts), R9 (MCP server adapter; MCP SDK accessed only via the adapter), R10, R17-R26.
2. `docs/specs/mvp/PRD.md` §F-003 + §F-004 + §F-005 (AnalyzePerception v2.3 enriched).
3. `docs/specs/mvp/architecture.md` §6.4 (`@modelcontextprotocol/sdk` pinned) + §6.5 (`packages/agent-core/src/mcp/tools/<toolName>.ts` decision tree row).
4. `docs/specs/mvp/tasks-v2.md` T016-T050 (verify version at impl start; tasks-v2 has been bumped multiple times in walking-skeleton cycles per session-handover.md).
5. `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` §08 — REQ-MCP-* + REQ-BROWSE-HUMAN-* + REQ-BROWSE-RATE-*.
6. `docs/specs/final-architecture/08-tool-manifest.md` — canonical 29-tool list with safety classifications.
7. `docs/specs/final-architecture/07-analyze-mode.md` §07.9 + §07.9.1 — AnalyzePerception v2.3 enrichment fields (this is the heaviest single dependency; T048 is the focal point).
8. `docs/specs/mvp/phases/phase-1-perception/spec.md` + `impact.md` — Phase 1 prerequisites.
9. **`docs/specs/mvp/phases/phase-1-perception/phase-1-current.md`** — Phase 1 rollup; canonical PSM contract (NF-Phase1-01 v0.4 = 20K tokens) and BrowserEngine R9 boundary precedent.
10. **`docs/specs/mvp/phases/phase-1b-perception-extensions/phase-1b-current.md`** — Phase 1b rollup; 10 perception extractors + extension layer + PSM `_extensions` namespace seam.
11. **`docs/specs/mvp/phases/phase-1c-perception-bundle/phase-1c-current.md`** — Phase 1c rollup; PerceptionBundle envelope + `bundleToAnalyzePerception` accessor + 4 closed Zod enums (IframePurpose, HiddenReason, NondeterminismFlag, WarningCode) + namespace contract reservation for Phase 7.

---

## Constraints Inherited from Phase 1b/1c substrate (v0.3 — F-S1 + F-S9)

Phase 2 sits on top of Phase 1b (extension layer, shipped 2026-05-11) and Phase 1c (PerceptionBundle envelope, shipped 2026-05-12). All Phase 2 contracts MUST honor the upstream substrate:

- **Phase 1b 10 extractors** — PricingExtractor, AttentionScorer, ClickTargetSizer, CommerceBlockExtractor, CurrencySwitcherDetector, FrictionScorer, MicrocopyTagger, PopupPresenceDetector, SocialProofDepth, StickyElementDetector. Outputs reside in `bundle.raw.page_state_model_by_state[stateId]._extensions.<extractor_name>`. Phase 2 `page_analyze` MAY reuse these outputs to avoid re-extraction (recommended); MUST NOT mutate them.
- **Phase 1c PerceptionBundle envelope** — wraps Phase 1 PSM + Phase 1b extensions + screenshots in `bundle.raw.*_by_state[stateId]`, layered with envelope channels (meta + performance + nondeterminism_flags + warnings + state_graph + element_graph_by_state). Backward-compat accessor: `bundleToAnalyzePerception(bundle, stateId?)` returns the PSM at that state. PSM token budget: `PAGE_STATE_MODEL_TOKEN_BUDGET = 20_000` per `packages/agent-core/src/perception/types.ts` (NF-Phase1-01 v0.4).
- **Phase 1c 4 closed Zod enums** (consumers MUST use exact values; append-only extension via R18 only):
  - `IframePurpose` (closed 9-value enum: checkout, chat, video, analytics, social_embed, captcha, cmp, payment_3ds, other) — page_analyze `iframes[].purposeGuess` MUST constrain to this enum (per F-S13 + impact.md AnalyzePerception §F-S13). Note: `cross_origin` is a `classifyIframe()` security-override return value, NOT an enum member (per Phase 1c IframePolicyEngine.ts:44-46).
  - `HiddenReason` (7 values), `NondeterminismFlag` (9 values), `WarningCode` (12 values) — Phase 2 references as-needed
- **Namespace contract carryforward (CRITICAL)** — Phase 2 MUST NOT write to:
  - `bundle.raw.page_state_model_by_state[*]._extensions` (reserved for Phase 7 DeepPerceiveNode per Phase 1c impact.md §11)
  - `bundle.raw.analyze_perception_by_state[*]._extensions` (same reservation)
  - `AnalyzePerception._extensions` (Phase 2-defined seam; Phase 7+ deepPerceive namespace reserved)
  - Runtime enforcement: Phase 1c `assertNamespaceContract` + AC-10/AC-12 conformance tests. Phase 2 T048 conformance MUST add explicit assertion.
- **Walking-skeleton path preserved** — `apps/cli/src/commands/audit.ts` uses Phase 0/1 `BrowserManager.capture()` fixture stub; R20 supersession deferred to Phase 5 BrowseNode. Phase 2 MCP tools do NOT touch `audit.ts`.

---

## Constraints Inherited from Neural Canonical Specs

- **Tech stack pinned:** `@modelcontextprotocol/sdk` (MCP server). Optional dep: `ghost-cursor` for T016 MouseBehavior. Optional dep: `@modelcontextprotocol/inspector` for dev verification only (no production import).
- **R4 Browser Agent Rules:**
  - **R4.1 Perception first, action second** — the 23 browse tools include perception (`browser_get_state`) and action (`browser_click`, etc.); design enforces that any action tool's *implementation* asserts the calling agent has called `browser_get_state` recently (or `browser_get_state` is part of the same tool batch). MCP-level enforcement (not LLM-prompt-level).
  - **R4.5 EXACT tool names** — every tool's MCP-registered name MUST match v3.1: `browser_navigate` / `browser_get_state` / `browser_click` / `browser_type` / `browser_scroll` / `page_analyze` / `agent_complete` / `agent_request_human` / etc. NEVER `page_snapshot`, NEVER `dom_query`, NEVER paraphrased.
- **R8 Cost & Safety:**
  - **R8.3 Rate limiting structural** — RateLimiter enforces 2s min interval + per-domain caps (10/min unknown, 30/min trusted) IN CODE. NOT in prompts. NOT bypassable by the LLM.
  - **R8.4 Sensitive actions require HITL approval** — Phase 4 SafetyCheck handles this; Phase 2 just registers tools and lets safety classification gate them later.
- **R9 Adapter Pattern (second adapter category):** MCP server access is wrapped in an adapter pattern. `@modelcontextprotocol/sdk` direct imports allowed ONLY in `packages/agent-core/src/mcp/Server.ts` (the adapter) + `packages/agent-core/src/mcp/tools/*.ts` (each tool registers via the adapter; no direct SDK import in tool bodies). RateLimiter is its own adapter contract.
- **No `console.log` in production** (R10.6) — every tool logs via Pino. New Phase 2 correlation fields: `tool_name`, `tool_call_id` (uuid per call), `client_session_id`.
- **Tool I/O Zod-validated** (R2.2) — every tool's input AND output validates via Zod at the adapter boundary. No raw MCP messages reach tool implementations or downstream consumers.
- **Files < 300 lines, functions < 50 lines** — most tool files are < 100 lines (single-purpose). T048 `page_analyze.ts` is the largest (~250-280 lines because of the 14 v2.3 enrichments inside one `page.evaluate()` block); split helpers into the same module ONLY if it stays under 300.
- **No conversion-rate predictions** (R5.3) — N/A in Phase 2 (no findings).

---

## User Scenarios & Testing

### User Story 1 — An LLM-driven agent can drive the browser via MCP tools (Priority: P1) 🎯 MVP

The Neural orchestrator (or any MCP client) connects to the Phase 2 MCP server, lists available tools, and invokes them by name to perceive and act on web pages. Every tool input + output is Zod-validated. RateLimiter prevents abuse. `browser_evaluate` cannot escape its sandbox.

**Why this priority:** This is the action half of Phase 1's perception-first split. Without Phase 2, no Phase 5 Browse MVP, no Phase 7 deep_perceive can call `page_analyze`.

**Independent Test:** Run `pnpm test:integration tools/phase2.test.ts` — boots an MCP server in-process, calls every registered tool against amazon.in, asserts Zod-valid outputs.

**Acceptance Scenarios:**

1. **Given** a started MCP server, **When** a client calls `tools/list`, **Then** all 29 MCP tools (22 browser_* + 2 agent_* + 5 page_*) return with Zod-described schemas + safety classifications.
2. **Given** a session created via `browser_navigate`, **When** the client calls `browser_get_state`, **Then** a Zod-valid `PageStateModel` returns (≤ 20,000 tokens per `PAGE_STATE_MODEL_TOKEN_BUDGET` in `packages/agent-core/src/perception/types.ts` — NF-Phase1-01 v0.4).
3. **Given** a stable page, **When** `browser_click` is called with a target id from `PageStateModel.filteredDOM`, **Then** the click executes via MouseBehavior (ghost-cursor Bezier, ~500ms mean motion) and any observable mutation is captured for verification.
4. **Given** a typeable element id, **When** `browser_type` is called with a string, **Then** TypingBehavior emits keystrokes with Gaussian inter-character delay and 1-2% typo rate (typo + correction recorded in audit_events when Phase 4 logger lands).
5. **Given** `page_analyze` invoked on a checkout page, **When** the call returns, **Then** the result Zod-validates as `AnalyzePerception` with EVERY baseline + 14 v2.3 enrichment field populated (or explicitly `null` with a documented reason).
6. **Given** `browser_evaluate` invoked with arbitrary JavaScript, **When** the script attempts `document.cookie`, **Then** it returns `undefined` / throws sandbox violation (sandbox enforces R8.4 + REQ-MCP-SANDBOX-001..003).
7. **Given** rapid sequential calls to the same domain, **When** more than the per-domain cap fires within a minute, **Then** RateLimiter returns a delay or 429 (depends on adapter contract), NOT calls Playwright in tight loop.
8. **Given** all 29 MCP tools registered, **When** Phase 2 integration test runs, **Then** every tool exercises on amazon.in and returns Zod-valid output OR a documented "expected error" path (e.g., `browser_upload` with invalid file → typed error). Conformance asserts `page_analyze` output's `_extensions` field is `undefined` (namespace contract per F-S4 + Phase 1c impact.md §11).

### Edge Cases

- **MCP client disconnects mid-call:** server cleans up the in-flight tool's session reference; no zombie Playwright session.
- **`page_analyze` on a page where one of 14 v2.3 fields cannot be derived (e.g., no schema.org markup):** field returns `null` with `_diagnostics` flag; Zod schema accommodates `nullable()` per field.
- **`browser_evaluate` script attempts to bypass sandbox via Function constructor:** sandbox MUST detect and reject; conformance test asserts.
- **RateLimiter contention between multiple sessions on same domain:** queue order preserved; no starvation; 60s window slides correctly.
- **Tool registry collision (same tool name registered twice):** server boot fails fast with a typed error; never silently overwrites.

---

## Acceptance Criteria *(stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked task(s) |
|----|-----------|----------------------|----------------|
| AC-01 | MouseBehavior produces ghost-cursor Bezier motion with ~500 ms mean per click; verified via Playwright trace timing | `tests/conformance/mouse-behavior.test.ts` | T016 |
| AC-02 | TypingBehavior emits keystrokes with Gaussian inter-char delay; 1-2% of characters produce a typo + correction sequence | `tests/conformance/typing-behavior.test.ts` | T017 |
| AC-03 | ScrollBehavior produces variable-momentum scrolling that triggers lazy-loaded content within one scroll cycle on a fixture page | `tests/conformance/scroll-behavior.test.ts` | T018 |
| AC-04 | MCP server boots; `tools/list` returns 29 MCP tools (22 browser_* + 2 agent_* + 5 page_*) each with a Zod-derived JSON schema + safety classification | `tests/conformance/mcp-server.test.ts` | T019 |
| AC-05 | All 23 browse tools (T020-T042) register, accept Zod-valid input, return Zod-valid output, log via Pino with correlation fields tool_name + tool_call_id + client_session_id | `tests/conformance/browse-tools.test.ts` (parameterized over 23 tools) | T020-T042 |
| AC-06 | `browser_evaluate` sandbox blocks: (a) `document.cookie` access, (b) `localStorage` / `sessionStorage`, (c) `fetch()` / `XMLHttpRequest`, (d) `window.location` mutation / `history.pushState`. All 4 verified in conformance test. | `tests/conformance/browser-evaluate-sandbox.test.ts` | T043 |
| AC-07 | `page_get_element_info` returns `{ boundingBox, isAboveFold, computedStyles, contrastRatio }` for a target id; contrast computed correctly for both light + dark text on light background | `tests/conformance/page-get-element-info.test.ts` | T044 |
| AC-08 | `page_get_performance` returns 8 metrics partitioned as: **4 baseline** ({ DOMContentLoaded, fullyLoaded, resourceCount, LCP }) + **4 v2.3 enrichments** ({ INP, CLS, TTFB, timeToFirstCtaInteractable }) per §07.9.1. Conformance test asserts each of the 8 fields populated (or explicitly null with reason) on the fixture page. | `tests/conformance/page-get-performance.test.ts` | T045 (with v2.3 enrichment definitions consumed from T048's AnalyzePerception schema) |
| AC-09 | `page_screenshot_full` produces a JPEG ≤ 2 MB up to 15000 px tall via scroll-stitch; uses Sharp for compression | `tests/conformance/page-screenshot-full.test.ts` | T046 |
| AC-10 | `page_annotate_screenshot` overlays severity-colored boxes on a screenshot via Sharp; non-overlapping label placement; legend included | `tests/conformance/page-annotate-screenshot.test.ts` | T047 |
| AC-11 | `page_analyze` v2.3: single `page.evaluate()` call returns `AnalyzePerception` with all baseline 9 sections + 14 v2.3 enrichments populated; per-field unit tests on 3 fixture pages (homepage, PDP, checkout) | `tests/conformance/page-analyze-v23.test.ts` | T048 |
| AC-12 | RateLimiter enforces 2s min interval + 10/min unknown / 30/min trusted; queue preserves order; conformance test simulates burst on same domain and verifies pacing | `tests/conformance/rate-limiter.test.ts` | T049 |
| AC-13 | Phase 2 integration test exercises ALL 29 MCP tools tool-by-tool against amazon.in; every tool returns Zod-valid output (or typed error) within 5 minutes total wall-clock; conformance asserts `page_analyze` output's `_extensions` is `undefined` (Phase 1c namespace contract) | `tests/integration/phase2.test.ts` | T050 |

AC-NN IDs are append-only per Constitution R18. (13 AC for 35 tasks because tools T020-T042 share AC-05 by tool category.)

---

## Functional Requirements

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST provide MouseBehavior (`browser-runtime/MouseBehavior.ts`) using ghost-cursor for Bezier-curve motion | F-003 | REQ-BROWSE-HUMAN-001, REQ-BROWSE-HUMAN-002 |
| R-02 | System MUST provide TypingBehavior (`browser-runtime/TypingBehavior.ts`) emitting Gaussian-delayed keystrokes with 1-2% typo rate | F-003 | REQ-BROWSE-HUMAN-003, REQ-BROWSE-HUMAN-004 |
| R-03 | System MUST provide ScrollBehavior (`browser-runtime/ScrollBehavior.ts`) with variable momentum to trigger lazy-load content | F-003 | (no specific REQ-ID) |
| R-04 | System MUST define an MCP server adapter (`mcp/Server.ts`) wrapping `@modelcontextprotocol/sdk`; tools register via Zod schemas | F-003 | REQ-MCP-001, REQ-MCP-002 |
| R-05 | System MUST implement 23 browse tools at `mcp/tools/<toolName>.ts` (one file each) with EXACT v3.1 names | F-003 | tool-manifest.md §1-§3 |
| R-06 | System MUST implement `browser_evaluate` sandbox blocking cookies / localStorage / fetch / navigation | F-003 | REQ-MCP-SANDBOX-001..003 |
| R-07 | System MUST implement `page_get_element_info` returning bounding box + above-fold + computed styles + contrast ratio | F-004 | tool-manifest.md page tools |
| R-08 | System MUST implement `page_get_performance` returning **4 baseline metrics** ({DOMContentLoaded, fullyLoaded, resourceCount, LCP}) + **4 v2.3 enrichments** ({INP, CLS, TTFB, timeToFirstCtaInteractable}) — partition mirrors AC-08 (v0.3 F-S7) | F-004 + F-005 v2.3 | REQ-ANALYZE-PERCEPTION-V23-001 |
| R-09 | System MUST implement `page_screenshot_full` producing JPEG ≤ 2 MB ≤ 15000 px via scroll-stitch | F-004 | tool-manifest.md page tools |
| R-10 | System MUST implement `page_annotate_screenshot` with severity-colored Sharp overlays + non-overlapping labels | F-011 (annotate) | tool-manifest.md page tools |
| R-11 | System MUST implement `page_analyze` v2.3 — single `page.evaluate()` returning `AnalyzePerception` with all baseline + 14 v2.3 enrichment categories (~30 sub-fields). Caller is responsible for invoking `waitForSettle(page)` BEFORE `page_analyze`; the single-call invariant counts ONLY the analyze handler's `page.evaluate()` (not the upstream settle predicate's internal evaluate) — verifiable via Playwright trace count (v0.3 F-G2). | F-005 v2.3 | REQ-TOOL-PA-001 + REQ-ANALYZE-PERCEPTION-V23-001 |
| R-12 | System MUST define `AnalyzePerception` Zod schema (`analysis/types.ts` — even though analysis pipeline is Phase 7, the SCHEMA lands here in Phase 2 because page_analyze produces it) | F-005 | §07.9 + §07.9.1 |
| R-13 | System MUST implement RateLimiter (`browser-runtime/RateLimiter.ts`) enforcing 2s min + per-domain caps | F-003 | REQ-BROWSE-RATE-001, REQ-BROWSE-RATE-002 |
| R-14 | System MUST register a `ToolRegistry` (`mcp/ToolRegistry.ts`) holding tool name → schema + handler + safety classification; collision = boot failure | F-003 | REQ-MCP-002 |
| R-15 | System MUST provide Phase 2 integration test exercising every tool against amazon.in | F-003 + F-004 + F-005 acceptance | (integration test) |

---

## Non-Functional Requirements

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| NF-Phase2-01 | MCP server boot time | < 500 ms | Pino timing |
| NF-Phase2-02 | `tools/list` response size | < 50 KB serialized | Buffer length |
| NF-Phase2-03 | `page_analyze` single call wall-clock on amazon.in | < 5 seconds | Pino timing |
| NF-Phase2-04 | Phase 2 integration test total wall-clock | < 5 minutes | Vitest timing |
| NF-Phase2-05 | RateLimiter overhead per call | < 5 ms when under cap | Pino timing |
| NF-Phase2-06 | `page_screenshot_full` for 15000 px page | < 30 seconds | Pino timing |

---

## Key Entities

**`AnalyzePerception` (NEW shared schema — see impact.md)**
- Lives in `packages/agent-core/src/analysis/types.ts`
- Returned by `page_analyze` (T048)
- Consumed by Phase 7 `DeepPerceiveNode` (T117)
- 9 baseline sections (metadata, headingHierarchy, landmarks, semanticHTML, textContent, ctas, forms, trustSignals, layout, images, navigation, performance) + 14 v2.3 enrichment fields per §07.9.1
- All sub-fields nullable per `null + reason` pattern when extraction fails

**`MCPToolRegistry` (NEW adapter contract — see impact.md)**
- Lives in `packages/agent-core/src/mcp/ToolRegistry.ts`
- Maps tool name → `{ inputSchema: ZodType, outputSchema: ZodType, handler: ToolHandler, safetyClass: SafetyClass }`
- Boot-time validation: name uniqueness, schema validity

**`RateLimiter` (NEW adapter contract)**
- Per-domain queue + global pacer; 2s min, configurable per-domain caps

---

## Success Criteria

- **SC-001:** Phase 2 integration test (T050) exercises all 29 MCP tools against amazon.in within 5 minutes; every tool produces Zod-valid output.
- **SC-002:** AnalyzePerception schema validates fixtures from 3 page types (homepage, PDP, checkout) on first try.
- **SC-003:** browser_evaluate sandbox passes 4-vector security test (cookies, localStorage, fetch, navigation).
- **SC-004:** RateLimiter test simulates 60-call burst on same domain; pacing matches spec; no starvation observed.
- **SC-005:** No direct `import ... from '@modelcontextprotocol/sdk'` outside `mcp/Server.ts` + `mcp/tools/*.ts` (R9 grep verify).

---

## Constitution Alignment Check

- [x] No conversion-rate predictions (R5.3) — no findings in Phase 2
- [x] No auto-publish (F-016) — N/A
- [x] No UPDATE/DELETE on append-only tables (R7.4) — no DB writes in Phase 2
- [x] No vendor SDK imports outside adapters (R9) — `@modelcontextprotocol/sdk` only in `mcp/Server.ts` + `mcp/tools/*.ts`; Playwright still only in BrowserManager + BrowserEngine (Phase 1 boundary preserved)
- [x] No temperature > 0 (R10) — no LLM calls in Phase 2
- [x] No heuristic content exposed (R6) — no heuristics in Phase 2
- [x] DOES include conformance test stubs for every AC-NN — see AC table
- [x] DOES carry frontmatter delta block — see frontmatter
- [x] DOES define kill criteria — default block in tasks.md; T048 (page_analyze v2.3, integration-heavy) gets explicit kill criteria
- [x] DOES reference REQ-IDs — 14 REQ-IDs cited
- [x] DOES include impact.md — required by R20 (4 new shared contracts: MCPToolRegistry, MCPToolSchema, AnalyzePerception, RateLimiter)
- [x] R4.5 EXACT tool names enforced — every tool name verified against v3.1; renaming during implementation is a R23 kill trigger

---

## Out of Scope

- LLM evaluate / self-critique / grounding — Phase 7
- LangGraph orchestration nodes — Phase 5 (Browse MVP) + Phase 8 (Audit Orchestrator)
- Verification engine + 9 verify strategies — Phase 3
- SafetyCheck + ActionClassifier + DomainPolicy + CircuitBreaker — Phase 4
- Drizzle schema + audit_events writes — Phase 4
- LLMAdapter / AnthropicAdapter — Phase 4
- Stealth plugin (`playwright-extra-plugin-stealth`) — v1.1 (deferred per tasks-v2 v2.3.1)
- Heuristics — Phase 0b (infrastructure implemented 2026-05-09; content authoring deferred to week 4) + Phase 6 KB loader (approved Session 7; T101 forward-pulled). Not consumed in Phase 2.
- Dashboard / Clerk / Resend / R2 — Phase 9
- CI / GitHub Actions — Phase 9

---

## Assumptions

- **`@modelcontextprotocol/sdk` is mature enough** for production MCP server use; falls under architecture.md §6.4 pin.
- **`ghost-cursor` for MouseBehavior** is the single human-mouse-motion library; if unavailable, fallback to Bezier interpolation in MouseBehavior.ts itself (still satisfies R-01 because spec says "Bezier", not "ghost-cursor specifically").
- **Phase 2 does NOT introduce LLM calls.** All tools accept inputs from a hypothetical MCP client (could be the Phase 5 LangGraph orchestrator OR a manual Inspector session); no AnthropicAdapter required yet.
- **`page_analyze` v2.3 single-call invariant** (REQ-TOOL-PA-001 — clarified v0.3 per F-G2): EXACTLY ONE `page.evaluate()` call within the `page_analyze` handler produces all baseline + v2.3 fields. NOT two calls within the handler. NOT 9 separate evaluates. The PRECONDITION `waitForSettle(page)` (Phase 1c) is the CALLER's responsibility and its internal `page.evaluate` for fonts.ready does NOT count toward the invariant. Verifiable via Playwright trace count (1 evaluate after settle returns). T048 implementation + AC-11 + AC-13 conformance enforce.
- **AnalyzePerception schema is finalized in Phase 2** (T048) and Phase 7's DeepPerceiveNode CONSUMES it. Per F-G1 design decision (v0.3): AnalyzePerceptionSchema is a SEPARATE Zod schema distinct from PageStateModel; coexists with Phase 1c's `bundleToAnalyzePerception` accessor (which returns PSM as alias). Any later schema change requires a fresh impact.md cycle. R20 enforcement.
- **PRD §F-003 + §F-004 + §13 (Tool Manifest)** "12 MCP tools" references are LEGACY (PRD line numbers no longer cited per F-S8); this spec + tasks-v2.md v2.3 are canonical. Actual count: **29 MCP tools** across T020-T048 (22 `browser_*` + 2 `agent_*` + 5 `page_*`). tasks-v2.md "28 tools" is the same off-by-one drift; flagged for end-of-session cross-phase audit. Does not block Phase 2 implementation.
- **Dispatching parallel subagents for the 23 browse tools (T020-T042) is permitted** but capped at 3-5 parallel per PRD §10.10 comprehension-debt pacing. Each tool is a small file (~50-100 lines) with isolated test, so parallelization is high-leverage. Recommended: 3 parallel batches of ~8 tools each.
- **Phase 1b/1c upstream substrate** (v0.3 per F-S1) — `page_analyze` MAY reuse Phase 1b extractor outputs from `bundle.raw.page_state_model_by_state[*]._extensions` to avoid re-extracting pricing/social-proof/microcopy/etc. Phase 2 MUST NOT MUTATE those outputs nor write into the `_extensions` namespaces (Phase 7 reservation per Phase 1c impact.md §11). T048 conformance (AC-11) MUST assert `_extensions` field is `undefined` on every produced AnalyzePerception.
- **`iframes[].purposeGuess` closed-enum constraint** (v0.3 per F-S13; values corrected v0.3.1 per T-PHASE2-TYPES R11.4 patch 2026-05-12) — `page_analyze`'s `iframes[].purposeGuess` field MUST be one of Phase 1c's `IframePurpose` closed 9-value enum (checkout, chat, video, analytics, social_embed, captcha, cmp, payment_3ds, other). `cross_origin` is a `classifyIframe()` security-override return value, NOT an `IframePurpose` member. New values require append-only Phase 1c enum extension first (R18), never ad-hoc strings in Phase 2.

---

## Next Steps

1. impact.md authored (REQUIRED by R20 — 4 new shared contracts).
2. plan.md drafted (this session).
3. tasks.md drafted with 35 tasks pulled from tasks-v2.md (this session).
4. /speckit.analyze (Explore subagent).
5. Phase 2 implementation in a separate session.

---

## Cross-references

- Phase 1 spec, plan, impact (this folder's parent tree)
- `docs/specs/mvp/tasks-v2.md` T016-T050
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` REQ-MCP-* + REQ-BROWSE-HUMAN-* + REQ-BROWSE-RATE-*
- `docs/specs/final-architecture/08-tool-manifest.md` (canonical 28-tool list)
- `docs/specs/final-architecture/07-analyze-mode.md` §07.9 + §07.9.1 (AnalyzePerception v2.3)
- `docs/specs/mvp/PRD.md` §F-003, §F-004, §F-005, §10.3 (R8.3 rate limiting structural)
- `docs/specs/mvp/architecture.md` §6.4, §6.5
- `docs/specs/mvp/constitution.md` R4, R8, R9, R20, R23
