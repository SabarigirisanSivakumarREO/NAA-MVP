---
title: Phase 2 Rollup — Current System State
artifact_type: rollup
status: implemented
version: 1.0
phase_number: 2
phase_name: MCP Tool Surface
phase_completed_on: 2026-05-13
created: 2026-05-13
updated: 2026-05-13
owner: engineering lead
authors: [Claude (master orchestrator sessions 16-18)]
reviewers: [Sabari (Gate 2 stamp pending)]
supersedes: phase-1c-perception-bundle/phase-1c-current.md
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-2-tools/spec.md v0.3.1
  - docs/specs/mvp/phases/phase-2-tools/plan.md
  - docs/specs/mvp/phases/phase-2-tools/tasks.md v0.2
  - docs/specs/mvp/phases/phase-2-tools/impact.md v0.2.8 (7 R18 append-only adapter prep blocks)
  - docs/specs/final-architecture/08-tool-manifest.md (canonical 29-tool list)
  - docs/specs/final-architecture/07-analyze-mode.md §07.9 + §07.9.1 (AnalyzePerception v2.3)
req_ids:
  - REQ-MCP-001
  - REQ-MCP-002
  - REQ-MCP-SANDBOX-001
  - REQ-MCP-SANDBOX-002
  - REQ-MCP-SANDBOX-003
  - REQ-TOOL-PA-001
  - REQ-ANALYZE-PERCEPTION-V23-001
  - REQ-BROWSE-HUMAN-001
  - REQ-BROWSE-HUMAN-002
  - REQ-BROWSE-HUMAN-003
  - REQ-BROWSE-HUMAN-004
  - REQ-BROWSE-RATE-001
  - REQ-BROWSE-RATE-002
delta:
  new:
    - 29-tool MCP surface (22 browser_* + 2 agent_* + 5 page_*) registered through MCPServerAdapter; factory pattern locked Wave 4+ (createXTool({session}) closes over BrowserSession, returns MCPToolDefinition)
    - 4 NEW shared contracts — MCPToolSchema + MCPToolRegistry (mcp/types.ts + mcp/ToolRegistry.ts) + AnalyzePerception v2.3 (analysis/types.ts + analyzePerception.subschemas.ts) + RateLimiter (browser-runtime/RateLimiter.ts)
    - R9 boundary — mcp/Server.ts is the SECOND R9 adapter in agent-core (sole `@modelcontextprotocol/sdk` importer after BrowserManager.ts owning playwright); zod-to-json-schema only consumed here for tools/list emission
    - browser_evaluate sandbox (T043) — Proxy-shadowed globalThis + `with(proxyGlobal)` execution scope; 5 attack vectors blocked (a/b/c/d/e per AC-06 + REQ-MCP-SANDBOX-001..003 — document.cookie, localStorage/sessionStorage, fetch/XMLHttpRequest, window.location/history.pushState, Function/eval bypass); v1.1 backlog deferred (WebSocket + IndexedDB + Cache + postMessage)
    - page_analyze v2.3 (T048) — SINGLE page.evaluate invariant (REQ-TOOL-PA-001) producing full §07.9 + §07.9.1 AnalyzePerception (9 baseline + 11 enrichment categories / 38 sub-fields per F-CARRY-1); F-S4 namespace contract honored (returned object literal OMITS `_extensions`); F-S13 IframePurpose 9-value closed enum honored via inline pattern matcher mirroring Phase 1c IframePolicyEngine ordering (captcha → cmp → payment_3ds → checkout → chat → video → analytics → social_embed → other)
    - Wave 16 conformance test scaffolding (T-PHASE2-TESTS) — 13 RED test files authored Wave 0 then driven GREEN across Waves 1-15; +1 integration test (phase2.test.ts) for AC-13 gate
    - Wave 16 logger correlation fields (T-PHASE2-LOGGER) — tool_name + tool_call_id + client_session_id bound via Pino child logger inside MCPServerAdapter.#invokeTool
    - 7 R18 append-only adapter prep blocks (impact.md v0.2.2 → v0.2.8) extending Phase 1 BrowserPage + BrowserSession surfaces — goBack/goForward; reload/url + ContextAssembler.captureFromSession; mouse {move/down/up/click}; keyboard + focus + mouse.wheel + selectOption; setInputFiles; multi-tab pages/activeIndex/setActiveIndex/newPage/closePage + waitForEvent<download> + BrowserDownload; waitForSelector
  changed:
    - BrowserPage / BrowserSession surface extended v0.2.1 → v0.2.8 across 7 R18 append-only delta blocks — zero existing methods touched, zero signatures changed, R9 adapter boundary preserved (no new `playwright` imports outside BrowserManager.ts)
    - BrowserSession.page semantics evolved from FIXED property to DYNAMIC GETTER returning the current active page (Wave 9b multi-tab v0.2.7); Wave 4-8 tools transparently operate on the active page because they read session.page at handler-invocation time (NOT factory-registration time)
    - ContextAssembler.captureFromSession(session, opts?) exposed as ADDITIVE public method for T024 browser_get_state (R20 forward-compat consumer pattern); existing capture(url, opts) signature + behavior PRESERVED (now delegates to captureFromSession after session+navigation setup, still owns session lifecycle via `finally`)
    - tasks.md Phase 2 phase-exit checklist ticked at Stage 4 close (35/35 implementation tasks + T-PHASE2-DOC + T-PHASE2-INSPECTOR done; T-PHASE2-ROLLUP closes this artifact)
  impacted:
    - Phase 5 BrowseNode — primary consumer; will compose the 29-tool surface in LangGraph nodes; MUST read session.page at handler-invocation time (NOT cache the reference) per dynamic-getter contract; MUST acquire RateLimiter token per domain before any goto/click/type
    - Phase 5 BrowseNode — OWNS runtime wiring of 10 Phase 1b extractors into ContextAssembler.captureFromSession() page.evaluate() (carryforward from Phase 1c impact.md §12); page_analyze MAY READ those outputs via Phase 1c accessor when available but MUST NOT mutate
    - Phase 4 SafetyCheck (T067) — consumes MCPToolRegistry.getSafetyClass(toolName); safety class enum (safe / requires_safety_check / requires_hitl / forbidden) LOCKED in Phase 2; all 29 tools classified per impact.md table
    - Phase 7 DeepPerceiveNode (T117) — OWNS AnalyzePerception._extensions namespace (Phase 2 leaves the key absent per F-S4); extends Phase 1c DeepPerceiveNode forward-stub additively
    - Phase 7 grounding rules GR-001..GR-012 + evaluate prompts — consume AnalyzePerception v2.3 field paths verbatim per §07.9 + §07.9.1; field rename = HIGH-impact change requiring fresh impact.md cycle
    - Phase 9 Report generation — embeds AnalyzePerception snapshots in reproducibility_snapshots; consumes frozen schema
  unchanged:
    - Phase 1 conformance suite (browser-manager 2/2 + context-assembler 3/3 + accessibility-extractor + hard-filter + soft-filter + mutation-monitor + screenshot-extractor + stealth-config + perception-types) — zero regression throughout 49-commit Phase 2 development
    - Phase 1b 10-extractor conformance (PricingExtractor + AttentionScorer + ClickTargetSizer + CommerceBlockExtractor + CurrencySwitcherDetector + FrictionScorer + MicrocopyTagger + PopupPresenceDetector + SocialProofDepth + StickyElementDetector) — runtime wiring still pending Phase 5 BrowseNode per Phase 1c impact.md §12
    - Phase 1c PerceptionBundle envelope + assertNamespaceContract + 4 closed Zod enums (IframePurpose 9-value, HiddenReason 7, NondeterminismFlag 9, WarningCode 12) — Phase 2 page_analyze does NOT compose into bundle (orchestration responsibility deferred to Phase 5 BrowseNode); IframePurpose enum referenced verbatim via inline pattern mirror in pageAnalyze.script.ts
    - Walking-skeleton path — apps/cli/src/commands/audit.ts still uses Phase 0/1 BrowserManager.capture() fixture stub; R20 supersession deferred to Phase 5
governing_rules:
  - Constitution R19 (Rollup per Phase)
  - Constitution R17 (Lifecycle — approved → implemented bumped 2026-05-13 at Stage 4 exit)
  - Constitution R20 (Impact Analysis — impact.md v0.2.8 with 7 R18 append-only adapter-prep blocks)
  - Constitution R9 (Single-importer rule — mcp/Server.ts is the second R9 adapter)
  - Constitution R18 (append-only delta — 7 BrowserPage/BrowserSession surface extensions without signature changes)
  - Constitution R23 (Kill Criteria — 5 honored on T048 single-evaluate + namespace contract + IframePurpose closed enum + spec verbatim + perf budget)
  - Constitution R4.5 (EXACT tool names — every tool's MCP-registered name matches v3.1 verbatim)
---

# Phase 2 — MCP Tool Surface — Current System State Rollup

> **Summary (~200 tokens):** Phase 2 ships a 29-tool MCP surface (22 `browser_*` + 2 `agent_*` + 5 `page_*`) behind a typed `MCPServerAdapter` — the SECOND R9 adapter in agent-core after `BrowserManager`. Four new shared contracts materialize: `MCPToolSchema` + `MCPToolRegistry` + `AnalyzePerception` v2.3 + `RateLimiter`. The critical `page_analyze` (T048) honors the single-`page.evaluate` invariant (REQ-TOOL-PA-001), F-S4 namespace contract (returned object omits `_extensions`), and F-S13 IframePurpose 9-value closed enum (inline classifier mirroring Phase 1c IframePolicyEngine ordering). `browser_evaluate` (T043) blocks 5 attack vectors via Proxy-shadowed globalThis + `with(proxyGlobal)` scope. AC-13 integration test (T050) exercises the full surface across 3 fixtures in 37.5s vs 5-min NF-Phase2-04 budget (8x margin). Phase 5 BrowseNode is the primary downstream consumer.

> **Governed by:** Constitution R19. Rollup size cap: 300 lines / ~3000 tokens.

---

## 1. Active modules introduced this phase

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `MCPServerAdapter` | `packages/agent-core/src/mcp/Server.ts` (232 LOC) | T019 — R9 boundary; sole `@modelcontextprotocol/sdk` importer; lifecycle `start()/stop()`; #invokeTool narrows I/O via Zod safeParse + typed-error envelope (`isError: true`) | `tests/conformance/mcp-server.test.ts` (AC-04) |
| `InMemoryToolRegistry` + `ToolRegistry` interface | `packages/agent-core/src/mcp/ToolRegistry.ts` (157 LOC) | T019 — register/list/get/getSafetyClass; boot-time duplicate-name guard throws typed `DuplicateToolNameError` | `tests/conformance/mcp-server.test.ts` (AC-04) |
| `MCPToolDefinition<I,O>` + `SafetyClass` + `ToolContext` | `packages/agent-core/src/mcp/types.ts` (102 LOC) | T-PHASE2-TYPES — base contract for every tool factory; SafetyClass = 'safe' \| 'requires_safety_check' \| 'requires_hitl' \| 'forbidden' (LOCKED per Phase 4 §F-S12) | (consumed by every tool conformance test) |
| `mcp/index.ts` | `packages/agent-core/src/mcp/index.ts` | Barrel re-exporting Server + ToolRegistry + types + tool factories | (consumed by adapter + Phase 5) |
| **22 browser_\* tool factories** (T020-T042) | `packages/agent-core/src/mcp/tools/{navigate,goBack,goForward,reload,getState,screenshot,getMetadata,click,clickCoords,type,scroll,select,hover,pressKey,upload,tabManage,extract,download,findByText,getNetwork,waitFor}.ts` | Each file < 200 LOC; EXACT v3.1 name (R4.5); registers via `createXTool({deps}) → MCPToolDefinition`; calls Playwright via BrowserSession (no direct playwright import) | `tests/conformance/{navigate,go-back,go-forward,reload,get-state,screenshot,get-metadata,click,click-coords,type,scroll,select,hover,press-key,upload,tab-manage,extract,download,find-by-text,get-network,wait-for}-tool.test.ts` (each AC-05 slice) |
| **2 agent_\* tool factories** (T041, T042) | `packages/agent-core/src/mcp/tools/{agentComplete,agentRequestHuman}.ts` | Orchestration signals (NOT page actions); agent_complete safetyClass='safe', agent_request_human='requires_hitl' | `tests/conformance/{agent-complete,agent-request-human}-tool.test.ts` |
| `browserEvaluate.ts` (T043) | `packages/agent-core/src/mcp/tools/browserEvaluate.ts` (180 LOC) | Sandboxed user-JS execution; Proxy-shadowed globalThis + `with(proxyGlobal) { userScript }` execution scope; 5 attack vectors blocked; safetyClass='requires_safety_check' | `tests/conformance/browser-evaluate-sandbox.test.ts` (AC-06; 9 vectors verified) |
| `pageGetElementInfo.ts` (T044) | `packages/agent-core/src/mcp/tools/pageGetElementInfo.ts` | `{ boundingBox, isAboveFold, computedStyles, contrastRatio }`; WCAG luminance formula inline | `tests/conformance/page-get-element-info.test.ts` (AC-07) |
| `pageGetPerformance.ts` (T045) | `packages/agent-core/src/mcp/tools/pageGetPerformance.ts` | 4 baseline metrics (DOMContentLoaded, fullyLoaded, resourceCount, LCP) + 4 v2.3 enrichments (INP, CLS, TTFB, timeToFirstCtaInteractable — partial; observer-hooked fields nullable with reason) | `tests/conformance/page-get-performance.test.ts` (AC-08) |
| `pageScreenshotFull.ts` (T046) | `packages/agent-core/src/mcp/tools/pageScreenshotFull.ts` | Scroll-stitch up to 15000 px via Sharp; JPEG ≤ 2 MB | `tests/conformance/page-screenshot-full.test.ts` (AC-09) |
| `pageAnnotateScreenshot.ts` (T047) | `packages/agent-core/src/mcp/tools/pageAnnotateScreenshot.ts` | Sharp-based severity-colored overlays + non-overlapping label placement + legend | `tests/conformance/page-annotate-screenshot.test.ts` (AC-10) |
| `pageAnalyze.ts` + `pageAnalyze.script.ts` (T048) | `packages/agent-core/src/mcp/tools/pageAnalyze.ts` (98 LOC) + `pageAnalyze.script.ts` (523 LOC string body) | EXACTLY 1 `session.page.evaluate(PAGE_ANALYZE_SCRIPT)` invocation per REQ-TOOL-PA-001; script string contains the in-page 9-baseline + 11-enrichment-category extractor; output `AnalyzePerceptionSchema.parse(raw)` mandatory before return; F-S4 (`_extensions` absent from returned literal) + F-S13 (IframePurpose closed-enum classifier) enforced | `tests/conformance/page-analyze-v23.test.ts` (AC-11; 13/13 tests + amazon.in 336ms vs 5s budget) |
| `MouseBehavior.ts` (T016) | `packages/agent-core/src/browser-runtime/MouseBehavior.ts` (147 LOC) | ghost-cursor Bezier-curve motion + fallback path; ~500ms mean per click | `tests/conformance/mouse-behavior.test.ts` (AC-01) |
| `TypingBehavior.ts` (T017) | `packages/agent-core/src/browser-runtime/TypingBehavior.ts` (147 LOC) | Gaussian inter-char delay (mean ~80ms, σ ~20ms); 1-2% typo + backspace correction | `tests/conformance/typing-behavior.test.ts` (AC-02) |
| `ScrollBehavior.ts` (T018) | `packages/agent-core/src/browser-runtime/ScrollBehavior.ts` (165 LOC) | Variable-momentum eased multi-step scroll; triggers IntersectionObserver lazy-loads on fixture page | `tests/conformance/scroll-behavior.test.ts` (AC-03) |
| `RateLimiter.ts` (T049) | `packages/agent-core/src/browser-runtime/RateLimiter.ts` (268 LOC) | `DomainRateLimiter implements RateLimiter`; 2s min global + per-domain caps (10/min unknown, 30/min trusted); sliding 60s window; FIFO queue; no starvation | `tests/conformance/rate-limiter.test.ts` (AC-12) |
| `BrowserPageWrapper.ts` (Wave 9b split) | `packages/agent-core/src/browser-runtime/BrowserPageWrapper.ts` (122 LOC) | Dynamic-getter glue exposing the active page in multi-tab BrowserSession; mounts mouse/keyboard/setInputFiles/waitForEvent surface | (consumed by BrowserManager; covered by Phase 1 browser-manager.test.ts + Phase 2 tab-manage-tool.test.ts) |
| `AnalyzePerceptionSchema` + `AnalyzePerception` type | `packages/agent-core/src/analysis/types.ts` (127 LOC) | T-PHASE2-TYPES — top-level Zod `.strict()` schema; F-S4 enforced (`_extensions` reservation omitted); F-S13 IframePurpose enum imported from perception | `tests/conformance/page-analyze-v23.test.ts` (AC-11 — Zod parse asserts) |
| Sub-schemas (metadata/structure/textContent/ctas/forms/trustSignals/iframes/navigation/accessibility/performance/inferredPageType) | `packages/agent-core/src/analysis/analyzePerception.subschemas.ts` (417 LOC) | T-PHASE2-TYPES — 11 enrichment-category sub-schemas + 38 sub-fields per §07.9.1 (F-CARRY-1 verbatim) | (composed into AnalyzePerceptionSchema) |
| `analysis/index.ts` | `packages/agent-core/src/analysis/index.ts` | Barrel re-exporting AnalyzePerceptionSchema + AnalyzePerception type + sub-schemas | (consumed by pageAnalyze.ts + Phase 7) |

**Test scaffolding (Wave 0):** 13 conformance + 1 integration test file authored RED at commit `de70689` (T-PHASE2-TESTS); driven GREEN across Waves 1-15.

**Integration test (Wave 15):** `tests/integration/phase2.test.ts` (311 LOC) + `phase2.fixtures.ts` (101 LOC) + `phase2.registry.ts` (93 LOC) — AC-13 gate; 11/11 tests; 37.49s wall-clock vs 5-min NF-Phase2-04 budget (8x margin).

**Operational docs:**
- `README.md` Phase 2 quickstart section + MCP surface table (T-PHASE2-DOC commit `32592f7`)
- `docs/operations/mcp-inspector.md` (T-PHASE2-INSPECTOR commit `61335d2`; 157 LOC maintainer guide for local-debug)

---

## 2. Data contracts now in effect

| Contract | Location | Spec source-of-truth | Notes |
|---|---|---|---|
| `MCPToolDefinition<I, O>` + `SafetyClass` | `packages/agent-core/src/mcp/types.ts` | spec.md R-04 + impact.md §MCPToolRegistry | name/description/inputSchema/outputSchema/safetyClass/handler; safety enum LOCKED for Phase 4 |
| `ToolRegistry` interface + `InMemoryToolRegistry` | `packages/agent-core/src/mcp/ToolRegistry.ts` | spec.md R-14 + impact.md §MCPToolRegistry | register/list/get/getSafetyClass; boot-time duplicate-name throw |
| `AnalyzePerceptionSchema` (Zod, v2.3) | `packages/agent-core/src/analysis/types.ts` + `analyzePerception.subschemas.ts` | spec.md R-12 + impact.md §AnalyzePerception + §07.9 + §07.9.1 | `.strict()` top-level; 9 baseline + 11 enrichment categories / 38 sub-fields per F-CARRY-1; `_extensions` key absent per F-S4; `iframes[].purposeGuess` constrained to Phase 1c IframePurpose closed enum per F-S13 |
| `DomainRateLimiter` + `RateLimiter` interface + `RateLimiterConfig` | `packages/agent-core/src/browser-runtime/RateLimiter.ts` | spec.md R-13 + impact.md §RateLimiter | acquire/release/stats; 2s min + per-domain caps |
| BrowserPage extensions v0.2.8 (7 R18 blocks) | `packages/agent-core/src/adapters/BrowserEngine.ts` + concrete impl in `BrowserManager.ts` + `BrowserPageWrapper.ts` | impact.md v0.2.2 → v0.2.8 | goBack/goForward/reload/url + mouse {move,down,up,click} + keyboard + focus + mouse.wheel + selectOption + setInputFiles + waitForSelector + waitForEvent<download> + BrowserDownload (suggestedFilename + saveAs) |
| BrowserSession multi-tab surface (Wave 9b R20 semantics extension) | `packages/agent-core/src/adapters/BrowserEngine.ts` + `BrowserManager.ts` | impact.md v0.2.7 | session.page evolves to dynamic getter; new methods pages()/activeIndex()/setActiveIndex(i)/newPage()/closePage(i) |
| `ContextAssembler.captureFromSession(session, opts?)` | `packages/agent-core/src/perception/ContextAssembler.ts` | impact.md v0.2.3 (R20 forward-compat + R11.4 T024 spec patch) | Additive public method consumed by T024 browser_get_state; existing `capture(url, opts)` preserved |

---

## 3. System flows now operational

### Flow: Tool registration boot (NF-Phase2-01)

**Trigger:** `new InMemoryToolRegistry()` → `registry.register(createXTool(deps))` × 29 → `new MCPServerAdapter(registry, logger, opts?).start()`.
**Steps:** start() registers tools/list + tools/call handlers with the SDK Server → optional transport.connect() → emit `mcp.server.start` Pino event with `{boot_ms, tools: 29}`. Boot completes < 500 ms per NF-Phase2-01.
**Output:** Adapter `#started = true`; tools/list ready to respond.
**Spec:** AC-04 + R-04 + R-14 + NF-Phase2-01.

### Flow: Tool dispatch (input → handler → output)

**Trigger:** SDK `tools/call` request reaches `setRequestHandler(CallToolRequestSchema, ...)`.
**Steps:** registry.get(name) → if undefined, return `isError: true` envelope → `#invokeTool(def, rawInput)` mints toolCallId + child Pino logger bound with `{tool_name, tool_call_id, client_session_id}` → `def.inputSchema.safeParse(rawInput)` → on failure return typed error envelope → `await def.handler(parsedInput.data, ctx)` → `def.outputSchema.safeParse(output)` → on failure return typed error envelope → return `{content: [{type:'text', text: JSON.stringify(parsedOutput.data)}]}`. Thrown handler errors are caught and propagate as `isError: true` text envelope (NOT re-thrown).
**Output:** SDK `CallToolResult` per MCP protocol.
**Spec:** AC-05 (parameterized across 23 browse tools) + R-05.

### Flow: page_analyze single-evaluate pipeline (REQ-TOOL-PA-001)

**Trigger:** caller settles page (F-G2 — Phase 1c SettlePredicate; caller's responsibility, NOT page_analyze's) → MCP client invokes `page_analyze({})`.
**Steps:** handler reads `deps.session.page` (dynamic getter — current active tab) → `session.page.evaluate(PAGE_ANALYZE_SCRIPT)` exactly once → in-page script extracts 9 baseline + 11 enrichment-category sections, returning a JSON-serializable object literal that OMITS `_extensions` → handler `AnalyzePerceptionSchema.parse(raw)` mandatory before return (catches F-S4 absent-`_extensions` + F-S13 IframePurpose enum + every shape constraint) → handler emits `mcp.tool.page_analyze.done` Pino event with summary counters.
**Output:** Frozen `AnalyzePerception` value ready for Phase 7 consumers.
**Spec:** AC-11 + R-11 + REQ-TOOL-PA-001 + REQ-ANALYZE-PERCEPTION-V23-001. **Empirical wall-clock:** amazon.in 336ms vs 5000ms NF-Phase2-03 budget (15x margin).

### Flow: browser_evaluate sandbox (REQ-MCP-SANDBOX-001..003)

**Trigger:** MCP client invokes `browser_evaluate({script, returnAs?})`.
**Steps:** handler invokes `session.page.evaluate(sandboxRunner, {userScript, returnAs})` → inside Chromium context, sandboxRunner builds a `windowProxy` (Proxy on globalThis) blocking 5 vectors (a) document.cookie, (b) localStorage/sessionStorage, (c) fetch/XMLHttpRequest, (d) window.location/history.pushState, (e) Function/eval bypass — then executes user script via `with(proxyGlobal) { userScript }` inside a NativeFunction-constructed body. Any blocked-property access throws a typed `sandbox: <vector> blocked (AC-06 X)` error that propagates as `isError: true` envelope.
**Output:** `{ ok: true, result: string, returnAs }` OR typed error envelope.
**Spec:** AC-06 + R-06 + REQ-MCP-SANDBOX-001..003.

### Flow: Rate-limited browser action (REQ-BROWSE-RATE-001/002)

**Trigger:** Future Phase 5 BrowseNode acquires before any `session.page.goto`/click/type call.
**Steps:** `await rateLimiter.acquire(domain)` → if under cap, resolves immediately (NF-Phase2-05 < 5 ms when uncongested) → if over cap, enqueues with FIFO discipline; sliding 60s window slides on each release → after Playwright call completes, caller invokes `rateLimiter.release(domain)`.
**Output:** Domain acquired; queue depth observable via `stats()`.
**Spec:** AC-12 + R-13 + NF-Phase2-05.

---

## 4. Known limitations carried forward

| Limitation | Phase to resolve | Workaround in place |
|---|---|---|
| `browser_evaluate` sandbox is MVP 5-vector scope only | v1.1 backlog | T043 file comment documents WebSocket + IndexedDB + Cache API + postMessage extension as v1.1; not a Phase 2 blocker |
| `page_get_performance` v2.3 enrichments (INP/CLS/timeToFirstCtaInteractable) partially populated — require observer-hook wiring at capture time | Phase 5 BrowseNode (observer install) + Phase 7 (consumption) | Fields nullable with reason on the AnalyzePerceptionSchema; baseline 4 metrics always populated |
| LLM not wired | Phase 4 (AnthropicAdapter) + Phase 7 (evaluate/self-critique) | No-op; Phase 2 is pure tool surface |
| LangGraph orchestration not wired | Phase 5 (BrowseNode + ActionNode) + Phase 8 (AuditOrchestrator) | Tools register fine standalone; Inspector + integration test exercise them directly |
| Real authentication / RLS not enforced | Phase 4 (DB + Clerk) | In-memory; no DB writes from Phase 2 |
| No interactive evaluate strategy | v1.2 deferred | StaticEvaluateStrategy interface stub at analysis/strategies/ (Phase 7) |
| `session.page` dynamic getter requires Phase 5 BrowseNode to NEVER cache the reference across calls — caching breaks multi-tab transparency silently | Phase 5 BrowseNode design | Documented in impact.md v0.2.7 + tab-manage-tool.test.ts; Wave 4-8 tools read session.page at handler-invocation time |
| Phase 1b 10 extractors still NOT wired into runtime extraction inside ContextAssembler.captureFromSession (carryforward from Phase 1c §4) | Phase 5 BrowseNode | T1C-012 + phase2.test.ts fixtures pre-populate or skip; EXTENSION_OUTPUT_MISSING warning emitted at runtime gap |
| `page_analyze` does NOT compose into PerceptionBundle envelope — Phase 2 returns AnalyzePerception directly | Phase 5 BrowseNode (orchestration owns composition) | F-G1 design decision: AnalyzePerception is SEPARATE Zod schema; Phase 1c `bundleToAnalyzePerception` accessor coexists |
| Real-network conformance: 5 sandbox Chromium timeout failures pre-existing from Phase 1 (non-regression verified across Phase 2's 35-commit delta) | v0.3 sandbox-tier polish | Documented at Phase 1c rollup §6; Phase 2 didn't reduce or worsen the count |

---

## 5. Open risks for next phase

| Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| Phase 5 BrowseNode caches `session.page` at handler-construction time, breaking multi-tab transparency silently | Multi-tab tool flows (tab_manage → click on new tab) misroute to dead tab reference | Phase 5 lead | impact.md v0.2.7 + tab-manage-tool.test.ts document; Phase 5 spec must include dynamic-getter contract assertion; recommend wrapper helper `getActivePage(session)` |
| Phase 5 BrowseNode runtime-wiring delay on Phase 1b extractors continues to emit EXTENSION_OUTPUT_MISSING warnings at high rate on real network captures | Degraded perception completeness (still functional; warnings advisory) | Phase 5 lead | Phase 5 spec must include T-PHASE-5-EXTENSION-WIRING task; impact.md §12 Phase 1c documents the handover |
| Phase 7 DeepPerceiveNode T117 writes into `AnalyzePerception._extensions.deepPerceive` — must NOT collide with Phase 2's reservation contract | Schema conflict if Phase 2 capture accidentally writes _extensions; AC-11 + AC-13 anchor the runtime assertion | Phase 7 lead | F-S4 enforced via returned-object-literal omission + Zod `.strict()` parse; Phase 7 must use append-only extension only |
| Phase 7 EvaluateNode token budget — full AnalyzePerception per page may exceed 20K cap when stuffed into evaluate prompt blindly | EvaluateNode context overflow on multi-page audits | Phase 7 lead | impact.md §5 + Phase 1c rollup §5 row 3 both flag; recommend per-section slicing in EvaluateNode |
| IframePurpose closed-enum extension demand from new vendors (e.g., emerging captcha providers, new chat platforms) | Detection gaps; misclassification as 'other' | engineering lead | R18 append-only extension path: bump Phase 1c enum + classifier + page_analyze.script.ts pattern mirror in lockstep; never invent ad-hoc strings |
| Field rename on AnalyzePerception schema in Phase 7 hindsight | R23 kill trigger across grounding rules + evaluate + report | Phase 7 lead | impact.md forward-stability promise locks shape; new fields = optional additive only; rename = fresh impact.md cycle |
| `browser_evaluate` sandbox v1.1 attack vectors (WebSocket + IndexedDB + Cache API + postMessage) remain reachable | Sandbox bypass possible on untrusted page domains | v1.1 lead | T043 file comment documents; Phase 4 SafetyCheck DomainPolicy gates the tool's invocation on untrusted domains |

---

## 6. Conformance gate status (at phase exit — 2026-05-13)

| Test | AC | Status | Last run |
|---|---|---|---|
| `tests/conformance/mouse-behavior.test.ts` | AC-01 | ✅ green | 2026-05-13 |
| `tests/conformance/typing-behavior.test.ts` | AC-02 | ✅ green | 2026-05-13 |
| `tests/conformance/scroll-behavior.test.ts` | AC-03 | ✅ green | 2026-05-13 |
| `tests/conformance/mcp-server.test.ts` | AC-04 | ✅ green | 2026-05-13 |
| `tests/conformance/{navigate,go-back,go-forward,reload,get-state,screenshot,get-metadata,click,click-coords,type,scroll,select,hover,press-key,upload,tab-manage,extract,download,find-by-text,get-network,wait-for,agent-complete,agent-request-human}-tool.test.ts` (23 files) + `browse-tools.test.ts` parameterized | AC-05 | ✅ green (all 23 browse tools + 2 agent tools registered with EXACT v3.1 names) | 2026-05-13 |
| `tests/conformance/browser-evaluate-sandbox.test.ts` | AC-06 | ✅ green (5 attack vectors blocked) | 2026-05-13 |
| `tests/conformance/page-get-element-info.test.ts` | AC-07 | ✅ green | 2026-05-13 |
| `tests/conformance/page-get-performance.test.ts` | AC-08 | ✅ green (4 baseline + 4 v2.3 — observer-hooked fields nullable with reason) | 2026-05-13 |
| `tests/conformance/page-screenshot-full.test.ts` | AC-09 | ✅ green | 2026-05-13 |
| `tests/conformance/page-annotate-screenshot.test.ts` | AC-10 | ✅ green | 2026-05-13 |
| `tests/conformance/page-analyze-v23.test.ts` | AC-11 | ✅ green (13/13; amazon.in 336ms vs 5000ms NF-Phase2-03) | 2026-05-13 |
| `tests/conformance/rate-limiter.test.ts` | AC-12 | ✅ green | 2026-05-13 |
| `tests/integration/phase2.test.ts` | AC-13 | ✅ green (11/11; 37.49s wall-clock vs 5min NF-Phase2-04 — 8x margin; F-S4 asserted across homepage 632ms + PDP 735ms + checkout 512ms) | 2026-05-13 |
| Phase 1 + 1b + 1c conformance (regression) | — | ✅ green (zero regression across 49-commit Phase 2 delta) | 2026-05-13 |
| `pnpm typecheck` | — | ✅ clean | 2026-05-13 |
| `pnpm lint` | — | ✅ clean | 2026-05-13 |

---

## 7. What Phase 5 (BrowseNode) should read

When Phase 5 starts, the recommended reading order is:

1. **This file** (`phase-2-tools/phase-2-current.md`) — YOU ARE HERE
2. `phase-2-validation.md` (sibling — ASCII diagrams + 5 spot-checks for ~20-min trust calibration)
3. `docs/specs/mvp/phases/phase-5-browse-mvp/README.md` (when authored)
4. `docs/specs/mvp/phases/phase-5-browse-mvp/spec.md`
5. `packages/agent-core/src/mcp/Server.ts` (R9 boundary precedent — Phase 5 LangGraph nodes will compose the registry, NOT re-import the SDK)
6. `packages/agent-core/src/mcp/types.ts` (MCPToolDefinition shape — Phase 5 reads safetyClass via registry.getSafetyClass())
7. `packages/agent-core/src/mcp/tools/pageAnalyze.ts` (single-evaluate pattern; Phase 5 BrowseNode calls page_analyze post-settle)
8. `docs/specs/mvp/phases/phase-1c-perception-bundle/impact.md §12` (Phase 1b extractor runtime-wiring owner — Phase 5 owns)
9. `docs/specs/mvp/phases/phase-2-tools/impact.md` v0.2.8 (BrowserPage / BrowserSession surface extensions + dynamic-getter contract)

Do NOT load all Phase 2 artifacts. The compression is intentional. Shared contracts you need (`MCPToolDefinition`, `ToolRegistry`, `AnalyzePerceptionSchema`, `DomainRateLimiter`) live in `packages/agent-core/src/{mcp,analysis,browser-runtime}/*.ts` — read those files directly.

---

## 8. Cost + time summary (this phase)

| Metric | Target | Actual |
|---|---|---|
| Duration (sessions) | 2 sessions (planned 16-17) | 3 sessions 2026-05-12 to 2026-05-13 (~2 days; sessions 16-17-18) |
| Tasks completed | 35 implementation + 3 polish (T-PHASE2-DOC + T-PHASE2-INSPECTOR + T-PHASE2-ROLLUP) | 35/35 + 3/3 = 38/38 |
| LLM spend total | $40 initial ceiling (R23) | ~$45-55 (user-approved bump to $60 in Session 18; R23 kill not reached) |
| Phase 2 commits | (no target) | 49 commits on `feat/phase-2-tools` since branch cut `33bc047` → HEAD `2b4fda6` (35 task commits + 7 R18 adapter prep + 7 docs/checkbox + status bumps) |
| Net LOC delta | (no target) | sources ~3,500 + tests ~3,200 + fixtures ~200 + spec/plan/tasks/impact patches + Stage 4 docs (this file + validation) |

---

*End of phase-2-current.md. Sibling: phase-2-validation.md (5 ASCII proof sections + 5 spot-check entries).*
