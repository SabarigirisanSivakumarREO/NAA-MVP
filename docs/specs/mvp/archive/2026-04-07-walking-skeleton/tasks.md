# MVP Tasks (T001-T140)

## Numbered, Dependency-Ordered Task List for Claude Code

> **Format:** Each task has ID, dependencies, file path(s), spec REQ-IDs, smoke test, and acceptance criteria. Execute sequentially unless marked `[parallel]`.

> **Conventions:**
> - `T###` = task ID
> - `dep:` = dependencies (other tasks that must complete first)
> - `spec:` = source-of-truth REQ-ID(s) from the architecture docs
> - `[P]` = can run in parallel with sibling tasks

---

## Phase 0: Setup (T001-T005)

### T001: Initialize monorepo
- **dep:** none
- **spec:** plan.md repo structure
- **files:**
  - `package.json` (root)
  - `pnpm-workspace.yaml`
  - `turbo.json`
  - `.gitignore`
  - `.env.example`
- **smoke test:** `pnpm install` succeeds, `pnpm -v` shows correct version
- **acceptance:** Monorepo with `packages/` and `apps/` workspaces. Turborepo configured.

### T002: Create agent-core package skeleton
- **dep:** T001
- **files:**
  - `packages/agent-core/package.json`
  - `packages/agent-core/tsconfig.json`
  - `packages/agent-core/src/index.ts`
  - `packages/agent-core/vitest.config.ts`
- **smoke test:** `cd packages/agent-core && pnpm build` succeeds
- **acceptance:** TypeScript compiles, Vitest runs (no tests yet).

### T003: Create CLI app skeleton
- **dep:** T001
- **files:**
  - `apps/cli/package.json`
  - `apps/cli/tsconfig.json`
  - `apps/cli/src/index.ts` (just prints "CRO Audit CLI v0.0.1")
- **smoke test:** `pnpm cro:audit --version` prints version
- **acceptance:** CLI runnable via pnpm script in root package.json.

### T004: Setup Docker Compose for Postgres
- **dep:** T001
- **files:**
  - `docker-compose.yml` (postgres:16-bullseye + pgvector extension)
- **smoke test:** `docker-compose up -d` starts Postgres, `psql` connects on port 5432
- **acceptance:** Postgres 16 + pgvector running locally.

### T005: Setup environment variables
- **dep:** T004
- **files:**
  - `.env.example`
  - `.env` (gitignored)
- **env vars needed:**
  - `DATABASE_URL=postgresql://localhost:5432/cro_audit_dev`
  - `ANTHROPIC_API_KEY=...`
  - `HEURISTIC_ENCRYPTION_KEY=...` (32-byte hex for AES-256)
- **acceptance:** All required env vars documented in .env.example

---

## Phase 1: Perception Foundation (T006-T015)

### T006: BrowserManager
- **dep:** T002
- **spec:** REQ-BROWSE-NODE-003 (open_session), AI_Browser_Agent_v3.1 §6.6
- **files:** `packages/agent-core/src/browser-runtime/BrowserManager.ts`
- **smoke test:** Launch browser, navigate to amazon.in, close cleanly
- **acceptance:**
  - Wraps Playwright `chromium.launch()`
  - Returns BrowserSession object
  - Implements `BrowserEngine` interface (define interface in same file)
  - No crash on launch/close

### T007: StealthConfig
- **dep:** T006
- **spec:** REQ-BROWSE-HUMAN-005, REQ-BROWSE-HUMAN-006
- **files:** `packages/agent-core/src/browser-runtime/StealthConfig.ts`
- **smoke test:** Navigate to bot.sannysoft.com, all checks pass
- **acceptance:**
  - Uses playwright-extra + stealth plugin
  - Rotates viewport + user-agent + WebGL fingerprint per session
  - bot.sannysoft.com shows no automation detected

### T008: AccessibilityExtractor
- **dep:** T006
- **spec:** REQ-BROWSE-PERCEPT-001, REQ-BROWSE-PERCEPT-002
- **files:** `packages/agent-core/src/perception/AccessibilityExtractor.ts`
- **smoke test:** Extract AX-tree from amazon.in homepage
- **acceptance:**
  - Returns `>50` AX nodes
  - Includes search box (role=searchbox or input[type=search])
  - Returns AXNode[] with role, name, value, children

### T009: HardFilter
- **dep:** T008
- **spec:** REQ-BROWSE-PERCEPT-002 (Hard Filter — Pass 1)
- **files:** `packages/agent-core/src/perception/HardFilter.ts`
- **smoke test:** Filter amazon.in AX-tree
- **acceptance:**
  - Removes invisible (display:none, opacity:0)
  - Removes disabled elements
  - Removes aria-hidden=true
  - Removes zero-dimension elements
  - Node count drops by >50%

### T010: SoftFilter
- **dep:** T009
- **spec:** REQ-BROWSE-PERCEPT-003 (Soft Filter — Pass 2)
- **files:** `packages/agent-core/src/perception/SoftFilter.ts`
- **smoke test:** Filter with task "search for keyboard"
- **acceptance:**
  - Scores remaining elements by relevance
  - Returns top 30 (configurable)
  - Search-related elements score higher than footer

### T011: MutationMonitor
- **dep:** T006
- **spec:** REQ-BROWSE-PERCEPT-005, REQ-BROWSE-PERCEPT-006
- **files:** `packages/agent-core/src/perception/MutationMonitor.ts`
- **smoke test:** Click button on SPA page, observe mutations
- **acceptance:**
  - Injects MutationObserver via page.evaluate
  - `pending_mutations` increments after action
  - Settles to 0 within 2s of stability
  - `mutation_timeout_ms` configurable (default 2000)

### T012: ScreenshotExtractor
- **dep:** T006
- **files:** `packages/agent-core/src/perception/ScreenshotExtractor.ts`
- **smoke test:** Screenshot amazon.in homepage
- **acceptance:**
  - JPEG output `<150KB`
  - Max width `<=1280px`
  - Configurable quality (default 80)

### T013: ContextAssembler
- **dep:** T008, T009, T010, T011, T012
- **spec:** REQ-BROWSE-PERCEPT-001 (PageStateModel)
- **files:** `packages/agent-core/src/perception/ContextAssembler.ts`
- **smoke test:** Assemble PageStateModel for amazon.in
- **acceptance:**
  - Returns PageStateModel matching v3.1 §6.6 schema
  - All 6 fields populated (metadata, accessibilityTree, filteredDOM, interactiveGraph, visual?, diagnostics)

### T014: PageStateModel types + Zod schemas
- **dep:** T002
- **files:** `packages/agent-core/src/perception/types.ts`
- **acceptance:** All PageStateModel sub-types defined with Zod schemas

### T015: Phase 1 integration test
- **dep:** T013
- **files:** `packages/agent-core/tests/integration/phase1.test.ts`
- **smoke test:**
  - Run perception on 3 sites: amazon.in, bbc.com, github.com
  - All return PageStateModel
  - Token count `<1500` per site (estimated via tiktoken)
- **acceptance:** Phase 1 EXIT GATE met. PageStateModel works on real sites.

---

## Phase 2: MCP Tools + Human Behavior (T016-T050)

### T016: MouseBehavior (ghost-cursor)
- **dep:** T006
- **spec:** REQ-BROWSE-HUMAN-001, REQ-BROWSE-HUMAN-002
- **files:** `packages/agent-core/src/human-behavior/MouseBehavior.ts`
- **smoke test:** Move mouse from (0,0) to (500,300) in headful mode
- **acceptance:**
  - Uses ghost-cursor library
  - Bezier curve visible (not straight line)
  - Mean ~500ms, stddev ~150ms

### T017: TypingBehavior
- **dep:** T006
- **spec:** REQ-BROWSE-HUMAN-003, REQ-BROWSE-HUMAN-004
- **files:** `packages/agent-core/src/human-behavior/TypingBehavior.ts`
- **smoke test:** Type "hello world"
- **acceptance:**
  - Takes 3-6 seconds
  - Inter-key delays Gaussian (mean 120ms, stddev 40ms)
  - 1-2% typo rate with backspace correction

### T018: ScrollBehavior
- **dep:** T006
- **files:** `packages/agent-core/src/human-behavior/ScrollBehavior.ts`
- **smoke test:** Scroll down 3 times on a long page
- **acceptance:**
  - Variable momentum (not uniform jumps)
  - Triggers lazy-load on infinite-scroll pages

### T019: MCPServer skeleton
- **dep:** T002
- **spec:** REQ-MCP-001, REQ-MCP-002
- **files:** `packages/agent-core/src/mcp/MCPServer.ts`
- **smoke test:** Start server, list tools (initially empty)
- **acceptance:**
  - Uses @modelcontextprotocol/sdk
  - Exposes server capabilities
  - Tool registration is type-safe via Zod

### T020-T042: 23 Browse Tools [P]
*Each tool is an independent task and can be parallelized after T019.*

| Task | Tool | File | spec |
|------|------|------|------|
| T020 | browser_navigate | `mcp/tools/navigate.ts` | v3.1 §6.4 |
| T021 | browser_go_back | `mcp/tools/goBack.ts` | v3.1 §6.4 |
| T022 | browser_go_forward | `mcp/tools/goForward.ts` | v3.1 §6.4 |
| T023 | browser_reload | `mcp/tools/reload.ts` | v3.1 §6.4 |
| T024 | browser_get_state | `mcp/tools/getState.ts` | v3.1 §6.4 |
| T025 | browser_screenshot | `mcp/tools/screenshot.ts` | v3.1 §6.4 |
| T026 | browser_get_metadata | `mcp/tools/getMetadata.ts` | v3.1 §6.4 |
| T027 | browser_click (uses T016) | `mcp/tools/click.ts` | v3.1 §6.4 |
| T028 | browser_click_coords | `mcp/tools/clickCoords.ts` | v3.1 §6.4 |
| T029 | browser_type (uses T017) | `mcp/tools/type.ts` | v3.1 §6.4 |
| T030 | browser_scroll (uses T018) | `mcp/tools/scroll.ts` | v3.1 §6.4 |
| T031 | browser_select | `mcp/tools/select.ts` | v3.1 §6.4 |
| T032 | browser_hover | `mcp/tools/hover.ts` | v3.1 §6.4 |
| T033 | browser_press_key | `mcp/tools/pressKey.ts` | v3.1 §6.4 |
| T034 | browser_upload | `mcp/tools/upload.ts` | v3.1 §6.4 |
| T035 | browser_tab_manage | `mcp/tools/tabManage.ts` | v3.1 §6.4 |
| T036 | browser_extract | `mcp/tools/extract.ts` | v3.1 §6.4 |
| T037 | browser_download | `mcp/tools/download.ts` | v3.1 §6.4 |
| T038 | browser_find_by_text | `mcp/tools/findByText.ts` | v3.1 §6.4 |
| T039 | browser_get_network | `mcp/tools/getNetwork.ts` | v3.1 §6.4 |
| T040 | browser_wait_for | `mcp/tools/waitFor.ts` | v3.1 §6.4 |
| T041 | agent_complete | `mcp/tools/agentComplete.ts` | v3.1 §6.4 |
| T042 | agent_request_human | `mcp/tools/requestHuman.ts` | v3.1 §6.4 |

**Each tool task acceptance:**
- TypeScript interface matches spec exactly
- Zod schema for params + return
- Implementation calls Playwright via BrowserEngine
- Unit test with at least 1 happy path
- Tool registered with MCPServer

### T043: browser_evaluate (with sandbox)
- **dep:** T019
- **spec:** REQ-MCP-SANDBOX-001, REQ-MCP-SANDBOX-002, REQ-MCP-SANDBOX-003
- **files:**
  - `packages/agent-core/src/mcp/JSSandbox.ts`
  - `packages/agent-core/src/mcp/tools/evaluate.ts`
- **smoke test:**
  - Run `document.title` → returns title
  - Run `document.cookie` → blocked, error returned
- **acceptance:**
  - Sandbox blocks: cookie, localStorage, sessionStorage, fetch, XMLHttpRequest, window.open, window.location
  - blocked on untrusted domains, caution on trusted

### T044: page_get_element_info
- **dep:** T019
- **spec:** AI_Analysis_Agent_v1.0 §5
- **files:** `packages/agent-core/src/mcp/tools/pageGetElementInfo.ts`
- **smoke test:** Get info for a CTA on amazon.in
- **acceptance:** Returns boundingBox, isAboveFold, computedStyles, contrastRatio

### T045: page_get_performance
- **dep:** T019
- **files:** `packages/agent-core/src/mcp/tools/pageGetPerformance.ts`
- **smoke test:** Get metrics for amazon.in
- **acceptance:** Returns DOMContentLoaded, fullyLoaded, resourceCount, totalTransferSize, optionally LCP

### T046: page_screenshot_full
- **dep:** T019
- **files:** `packages/agent-core/src/mcp/tools/pageScreenshotFull.ts`
- **smoke test:** Full-page screenshot of amazon.in product page
- **acceptance:** Captures entire scrollable height, max 15000px, JPEG `<2MB`

### T047: page_annotate_screenshot
- **dep:** T019
- **files:** `packages/agent-core/src/mcp/tools/pageAnnotateScreenshot.ts`
- **smoke test:** Annotate test screenshot with 5 pins
- **acceptance:**
  - Uses Sharp for compositing
  - Pins rendered with severity colors (red/orange/yellow/blue)
  - Labels visible
  - No overlap (uses overlap avoidance algorithm)

### T048: page_analyze (the big one)
- **dep:** T019
- **spec:** AI_Analysis_Agent_v1.0 §5, REQ-TOOL-PA-001
- **files:** `packages/agent-core/src/mcp/tools/pageAnalyze.ts`
- **smoke test:** Analyze bbc.com homepage
- **acceptance:**
  - Single Playwright `page.evaluate()` call (NOT multiple)
  - Returns full AnalyzePerception object
  - Collects: structure, content, ctas, forms, trust, layout, images, navigation, performance
  - All sub-types match Zod schema

### T049: RateLimiter
- **dep:** T019
- **spec:** REQ-BROWSE-RATE-001, REQ-BROWSE-RATE-002
- **files:** `packages/agent-core/src/rate-limit/RateLimiter.ts`
- **smoke test:** Fire 5 actions in 1 second
- **acceptance:**
  - Only first executes immediately
  - Rest queued with 2s minimum interval
  - Respects per-domain limits (10/min unknown, 30/min trusted)

### T050: Phase 2 integration test
- **dep:** All Phase 2 tasks
- **files:** `packages/agent-core/tests/integration/phase2.test.ts`
- **smoke test:** Manual flow on amazon.in: navigate → click search → type "keyboard" → press Enter → scroll → extract
- **acceptance:** Phase 2 EXIT GATE met. All 28 tools work tool-by-tool on a real site.

---

## Phase 3: Verification & Confidence (T051-T065)

### T051: ActionContract type
- **dep:** T002
- **spec:** REQ-BROWSE-VERIFY-003
- **files:** `packages/agent-core/src/verification/ActionContract.ts`
- **acceptance:**
  - Type has tool_name, parameters, expected_outcome, verify_strategy, failure_budget
  - Zod schema validates

### T052: VerifyStrategy union type
- **dep:** T002
- **spec:** REQ-BROWSE-VERIFY-001
- **files:** `packages/agent-core/src/verification/types.ts`
- **acceptance:** Discriminated union with all 9 strategy variants

### T053-T061: 9 Verify Strategies [P]

| Task | Strategy | File |
|------|----------|------|
| T053 | url_change | `verification/strategies/urlChange.ts` |
| T054 | element_appears | `verification/strategies/elementAppears.ts` |
| T055 | element_text | `verification/strategies/elementText.ts` |
| T056 | network_request | `verification/strategies/networkRequest.ts` |
| T057 | no_error_banner | `verification/strategies/noErrorBanner.ts` |
| T058 | snapshot_diff | `verification/strategies/snapshotDiff.ts` |
| T059 | custom_js | `verification/strategies/customJs.ts` |
| T060 | no_captcha | `verification/strategies/noCaptcha.ts` |
| T061 | no_bot_block | `verification/strategies/noBotBlock.ts` |

**Each acceptance:**
- Pure function: `(strategy, page, prevSnapshot) => Promise<VerifyResult>`
- Returns success/failure with failure_type
- Unit test with positive + negative case

### T062: VerifyEngine (mutation-aware)
- **dep:** T053-T061, T011
- **spec:** REQ-BROWSE-VERIFY-001, REQ-BROWSE-PERCEPT-006
- **files:** `packages/agent-core/src/verification/VerifyEngine.ts`
- **smoke test:** Verify after click on SPA page
- **acceptance:** Waits for `pending_mutations === 0` OR timeout before checking strategy

### T063: FailureClassifier
- **dep:** T052
- **spec:** REQ-BROWSE-VERIFY-002
- **files:** `packages/agent-core/src/verification/FailureClassifier.ts`
- **smoke test:** Classify 7 sample failures
- **acceptance:** Returns one of: transient, structural, blocked, bot_detected, extraction_partial, confidence, unknown

### T064: ConfidenceScorer (multiplicative)
- **dep:** T002
- **spec:** REQ-BROWSE-CONF-001, REQ-BROWSE-CONF-002
- **files:** `packages/agent-core/src/confidence/ConfidenceScorer.ts`
- **smoke test:** 50 steps with mixed verify success/failure
- **acceptance:**
  - Multiplicative formula (NOT additive)
  - Score stays in (0, 1) over 50 steps
  - Score < 0.3 returns "needs_hitl" flag
  - Score >= 0.7 allows completion claim

### T065: Phase 3 integration test
- **dep:** T062, T063, T064
- **files:** `packages/agent-core/tests/integration/phase3.test.ts`
- **acceptance:** Phase 3 EXIT GATE met. All 9 strategies work, mutation-aware, confidence stays bounded.

---

## Phase 4: Safety + Infrastructure (T066-T080)

### T066: ActionClassifier
- **dep:** All Phase 2 tools
- **spec:** REQ-BROWSE-SAFETY-001
- **files:** `packages/agent-core/src/safety/ActionClassifier.ts`
- **smoke test:** Classify all 28 tools
- **acceptance:** Returns correct class (safe/caution/sensitive/blocked) per tool per spec

### T067: SafetyCheck (inline gate for MVP)
- **dep:** T066
- **spec:** REQ-BROWSE-SAFETY-001 to 003
- **files:** `packages/agent-core/src/safety/SafetyCheck.ts`
- **smoke test:** browser_download → blocked as sensitive
- **acceptance:**
  - safe → proceed silently
  - caution → log to audit_log, proceed
  - sensitive → fail in MVP (no HITL yet)
  - blocked → throw immediately

### T068: DomainPolicy
- **dep:** T067
- **files:** `packages/agent-core/src/safety/DomainPolicy.ts`
- **smoke test:** Banking domain returns blocked
- **acceptance:** Loads denylist from config, returns policy per domain

### T069: CircuitBreaker
- **dep:** T002
- **spec:** REQ-BROWSE-SAFETY-004
- **files:** `packages/agent-core/src/safety/CircuitBreaker.ts`
- **smoke test:** 3 consecutive failures on test.com → blocked for 1hr
- **acceptance:** Tracks failures per domain, blocks after 3, resets after 1hr

### T070: PostgreSQL schema (Drizzle)
- **dep:** T004
- **spec:** final-architecture/13-data-layer.md
- **files:**
  - `packages/agent-core/src/db/schema.ts`
  - `packages/agent-core/src/db/migrations/0001_initial.sql`
- **smoke test:** `pnpm db:migrate` succeeds
- **acceptance:**
  - All MVP tables: clients, audit_runs, findings, screenshots, sessions, audit_log, rejected_findings
  - Drizzle schema matches SQL exactly
  - pgvector extension enabled

### T071: AuditLogger
- **dep:** T070, T067
- **spec:** REQ-BROWSE-SAFETY-003
- **files:** `packages/agent-core/src/safety/AuditLogger.ts`
- **smoke test:** Log a caution action → row in audit_log
- **acceptance:** Append-only writes, all caution+sensitive actions logged

### T072: SessionRecorder
- **dep:** T070
- **files:** `packages/agent-core/src/db/SessionRecorder.ts`
- **smoke test:** Record 5-step session, retrieve by id
- **acceptance:** Sessions persisted with full action history

### T073: LLMAdapter interface + AnthropicAdapter
- **dep:** T002
- **spec:** REQ-BROWSE-LLM-001
- **files:**
  - `packages/agent-core/src/adapters/LLMAdapter.ts` (interface)
  - `packages/agent-core/src/adapters/AnthropicAdapter.ts`
- **smoke test:** Send prompt with tools, get response with tool calls
- **acceptance:**
  - Interface: invoke, getCostEstimate, getTokenCount
  - Anthropic implementation uses official SDK
  - Returns LLMResponse with tool calls + cost

### T074: StorageAdapter interface + PostgresStorage
- **dep:** T070
- **files:**
  - `packages/agent-core/src/storage/StorageAdapter.ts` (interface)
  - `packages/agent-core/src/storage/PostgresStorage.ts`
- **smoke test:** Save + load checkpoint, save findings
- **acceptance:** Drizzle-based, all CRUD operations typed

### T075: ScreenshotStorage interface + LocalDiskStorage
- **dep:** T002
- **files:**
  - `packages/agent-core/src/storage/ScreenshotStorage.ts` (interface)
  - `packages/agent-core/src/storage/LocalDiskStorage.ts`
- **smoke test:** Save buffer to disk, retrieve by key
- **acceptance:** Path convention: `{outputDir}/audit-{id}/{page_url_hash}/{type}.jpg`

### T076: StreamEmitter
- **dep:** T002
- **spec:** REQ-BROWSE-STREAM-001, REQ-BROWSE-STREAM-002
- **files:** `packages/agent-core/src/streaming/StreamEmitter.ts`
- **smoke test:** Emit `node_entered` event, subscriber receives
- **acceptance:** EventEmitter-based, typed events, all 7 event types from spec

### T077-T080: Reserved for additional infrastructure

### T080: Phase 4 integration test
- **dep:** T066-T076
- **acceptance:** Phase 4 EXIT GATE met.

---

## Phase 5: Browse Mode MVP (T081-T100)

### T081: AgentState (LangGraph Annotation)
- **dep:** T002
- **spec:** REQ-STATE-001 (final-architecture/05-unified-state.md)
- **files:** `packages/agent-core/src/orchestration/AgentState.ts`
- **acceptance:** All v3.1 browse fields defined as LangGraph Annotation

### T082: StateValidators
- **dep:** T081
- **spec:** REQ-STATE-INV-001 to 005
- **files:** `packages/agent-core/src/orchestration/StateValidators.ts`
- **smoke test:** Violate each invariant → error
- **acceptance:** All 5 invariants enforced

### T083: PerceiveNode
- **dep:** T013, T081
- **spec:** REQ-BROWSE-NODE-004
- **files:** `packages/agent-core/src/orchestration/nodes/PerceiveNode.ts`
- **smoke test:** Given URL in state → returns updated state with PageStateModel
- **acceptance:** Wraps ContextAssembler, updates state.page_snapshot

### T084: ReasonNode
- **dep:** T073, T081
- **spec:** REQ-BROWSE-NODE-005
- **files:** `packages/agent-core/src/orchestration/nodes/ReasonNode.ts`
- **smoke test:** Given page state → LLM produces tool calls with action contracts
- **acceptance:**
  - Calls LLMAdapter
  - Validates output: tool_calls have expected_outcome + verify_strategy
  - Updates state with messages

### T085: ActNode
- **dep:** T067, T081, all Phase 2 tools
- **spec:** REQ-BROWSE-NODE-007
- **files:** `packages/agent-core/src/orchestration/nodes/ActNode.ts`
- **smoke test:** Execute click tool call → state updated
- **acceptance:**
  - Inline safety check (no separate gate node in MVP)
  - Rate limiting enforced
  - Updates state with last_action, results

### T086: VerifyNode (graph wrapper)
- **dep:** T062, T081
- **spec:** REQ-BROWSE-NODE-008
- **files:** `packages/agent-core/src/orchestration/nodes/VerifyNode.ts`
- **smoke test:** After action, verify result populates state
- **acceptance:** Wraps VerifyEngine, updates verify_result and confidence

### T087: OutputNode
- **dep:** T072, T081
- **files:** `packages/agent-core/src/orchestration/nodes/OutputNode.ts`
- **smoke test:** State with is_complete=true → session recorded, completion event emitted
- **acceptance:** Records session, emits final event

### T088: routeAfterReason edge
- **dep:** T084
- **spec:** REQ-BROWSE-EDGE-001
- **files:** `packages/agent-core/src/orchestration/edges.ts`
- **acceptance:** Routes act/output/hitl correctly per all conditions

### T089: routeAfterVerify edge
- **dep:** T086
- **spec:** REQ-BROWSE-EDGE-003
- **files:** `packages/agent-core/src/orchestration/edges.ts`
- **acceptance:** Routes success/retry/replan/escalate correctly

### T090: SystemPrompt
- **dep:** T002
- **files:** `packages/agent-core/src/orchestration/SystemPrompt.ts`
- **acceptance:** Renders with: tools list, task description, safety constraints, action contract requirement

### T091: BrowseGraph (compile)
- **dep:** T083, T084, T085, T086, T087, T088, T089
- **spec:** REQ-BROWSE-GRAPH-002 (MVP 5-node graph)
- **files:** `packages/agent-core/src/orchestration/BrowseGraph.ts`
- **smoke test:** Compile graph, run with simple task
- **acceptance:** 5-node graph (perceive → reason → act → verify → output) compiles and runs

### T092: Integration test — BBC headlines
- **dep:** T091
- **files:** `packages/agent-core/tests/integration/bbc.test.ts`
- **smoke test:** Task: "Extract top 3 headlines from bbc.com"
- **acceptance:**
  - Returns 3 headlines
  - Completes in < 30s
  - All actions verified

### T093: Integration test — Amazon search
- **dep:** T091
- **files:** `packages/agent-core/tests/integration/amazon.test.ts`
- **smoke test:** Task: "Search for mechanical keyboard on amazon.in, get first product details"
- **acceptance:**
  - Returns product name, price, rating
  - Completes in < 90s
  - Handles CAPTCHA gracefully (escalate, not crash)

### T094: Integration test — Multi-page workflow
- **dep:** T091
- **files:** `packages/agent-core/tests/integration/workflow.test.ts`
- **acceptance:** 3-page form flow with data captured per step

### T095: Integration test — Error recovery
- **dep:** T091
- **files:** `packages/agent-core/tests/integration/recovery.test.ts`
- **smoke test:** Navigate to 404 page
- **acceptance:** Recognizes error, reports failure cleanly (no crash)

### T096: Integration test — Budget enforcement
- **dep:** T091
- **files:** `packages/agent-core/tests/integration/budget.test.ts`
- **smoke test:** Set budget to $0.05, run complex task
- **acceptance:** Terminates cleanly with completion_reason="budget_exceeded"

### T097-T100: Reserved

### Phase 5 EXIT GATE (after T096)
- ✅ BBC headlines < 30s
- ✅ Amazon search < 90s
- ✅ Multi-page workflow works
- ✅ Error recovery works
- ✅ Budget enforced
- ★ **Browse Mode MVP COMPLETE**

---

## Phase 6: Heuristic Knowledge Base (T101-T112)

### T101: HeuristicSchema (Zod)
- **dep:** T002
- **spec:** REQ-HK-001 (final-architecture/09-heuristic-kb.md)
- **files:** `packages/agent-core/src/analysis/heuristics/schema.ts`
- **acceptance:** All enums + Heuristic schema match spec exactly

### T102: HeuristicKnowledgeBase schema
- **dep:** T101
- **files:** Same file as T101
- **acceptance:** Top-level KB schema with version, sources, heuristics

### T103: Author 50 Baymard heuristics
- **dep:** T101
- **files:** `heuristics-repo/baymard.json`
- **content:** 50 heuristics covering:
  - Homepage (8-10): value prop clarity, hero section, trust above fold, navigation clarity, etc.
  - Product page (10-12): image quality, price visibility, add-to-cart prominence, stock indicators, reviews
  - Checkout (12-15): guest checkout, form field count, progress indicator, error handling, payment options
  - Cart (5-7): summary clarity, shipping visibility, quantity controls, continue shopping
  - Forms (5-8): label alignment, required indicators, inline validation, input masks
  - Mobile (5-8): tap target sizing, thumb zones, mobile navigation
- **tier distribution:** ~22 Tier 1, ~22 Tier 2, ~6 Tier 3
- **acceptance:** All 50 pass Zod validation, tier distribution matches

### T104: Author 35 Nielsen heuristics
- **dep:** T101
- **files:** `heuristics-repo/nielsen.json`
- **content:** 35 heuristics covering:
  - The 10 core heuristics (one each): visibility of system status, match between system and real world, user control and freedom, consistency and standards, error prevention, recognition over recall, flexibility and efficiency, aesthetic and minimalist design, help users recover from errors, help and documentation
  - Sub-heuristics from NN/g research (25): breadcrumbs, search vs navigation, form error messages, progress indicators, loading states, confirmation dialogs, undo/redo, keyboard navigation, contrast ratios, cognitive load, etc.
- **tier distribution:** ~15 Tier 1, ~12 Tier 2, ~8 Tier 3
- **acceptance:** All 35 pass Zod validation, tier distribution matches

### T105: Author 15 Cialdini heuristics
- **dep:** T101
- **files:** `heuristics-repo/cialdini.json`
- **content:** 15 heuristics = 6 principles × 2-3 concrete applications each:
  - **Social Proof (3):** customer reviews, user counts, trusted-by badges
  - **Scarcity (3):** limited-time offers, stock indicators, countdown timers
  - **Authority (2):** expert endorsements, certifications
  - **Reciprocity (2):** free trials, value-first content
  - **Commitment/Consistency (3):** progressive disclosure, small initial asks, saved preferences
  - **Liking (2):** relatable personas, visual warmth
- **tier distribution:** ~5 Tier 1, ~8 Tier 2, ~2 Tier 3
- **acceptance:** All 15 pass Zod validation, tier distribution matches

### T106: HeuristicLoader
- **dep:** T103, T104, T105
- **files:** `packages/agent-core/src/analysis/heuristics/HeuristicLoader.ts`
- **smoke test:** Load all 100 heuristics
- **acceptance:**
  - Reads all JSON files from heuristics-repo/
  - Validates each against schema
  - Throws if any fails
  - Returns flat array of 100 heuristics (50 + 35 + 15)

### T107: filterByPageType
- **dep:** T106
- **spec:** REQ-HK-020
- **files:** `packages/agent-core/src/analysis/heuristics/filter.ts`
- **smoke test:** filter("checkout") → returns checkout-relevant heuristics
- **acceptance:** Returns subset matching page type or "all"

### T108: filterByBusinessType
- **dep:** T107
- **files:** Same file as T107
- **acceptance:** Filters by business type if specified, includes all if undefined

### T109: prioritizeHeuristics
- **dep:** T108
- **spec:** REQ-HK-021
- **files:** Same file
- **acceptance:** Sorts by tier then severity, caps at 30

### T110: EncryptionWrapper (AES-256-GCM)
- **dep:** T002
- **spec:** REQ-HK-051
- **files:** `packages/agent-core/src/analysis/heuristics/encryption.ts`
- **smoke test:** Encrypt + decrypt round-trip preserves content
- **acceptance:** Uses Node crypto, key from env var, GCM mode

### T111: TierValidator
- **dep:** T106
- **files:** `packages/agent-core/src/analysis/heuristics/tierValidator.ts`
- **smoke test:** Validate all 100 heuristics have reliability_tier
- **acceptance:** Throws if any heuristic missing tier. Verifies tier ratio matches target (~42% Tier 1, ~42% Tier 2, ~16% Tier 3).

### T112: Phase 6 integration test
- **dep:** T106-T111
- **acceptance:** Phase 6 EXIT GATE met. 100 heuristics load + filter + encrypt. Filtering returns 15-25 per page type + business type combo.

---

## Phase 7: Analysis Pipeline (T113-T130)

### T113: AnalysisState extension
- **dep:** T081
- **spec:** REQ-STATE-001 (analyze fields)
- **files:** `packages/agent-core/src/orchestration/AuditState.ts` (add analyze fields)
- **acceptance:** All analyze-mode fields added to AuditState

### T114: detectPageType utility
- **dep:** T002
- **files:** `packages/agent-core/src/analysis/utils/detectPageType.ts`
- **smoke test:** Amazon product page returns "product"
- **acceptance:** Returns one of: homepage, product, checkout, form, pricing, other

### T115: assignConfidenceTier utility
- **dep:** T002
- **files:** `packages/agent-core/src/analysis/utils/assignTier.ts`
- **smoke test:** Tier 1 + measurable evidence → "high"
- **acceptance:** Mapping per spec table

### T116: CostTracker
- **dep:** T073
- **files:** `packages/agent-core/src/analysis/CostTracker.ts`
- **smoke test:** Track 3 LLM calls
- **acceptance:** Per-call + cumulative cost, budget cap enforcement

### T117: DeepPerceiveNode
- **dep:** T048, T046, T025, T113
- **spec:** REQ-ANALYZE-NODE-001
- **files:** `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts`
- **smoke test:** Run on amazon.in product page
- **acceptance:**
  - Calls page_analyze, browser_screenshot, page_screenshot_full
  - Returns AnalyzePerception + viewport + fullpage screenshots
  - Calls detectPageType to set current_page_type

### T118: Evaluate prompt template
- **dep:** T002
- **spec:** AI_Analysis_Agent_v1.0 §7.5
- **files:** `packages/agent-core/src/analysis/prompts/evaluate.ts`
- **acceptance:** System prompt + user message template match spec exactly

### T119: EvaluateNode
- **dep:** T117, T118, T106, T073
- **spec:** REQ-ANALYZE-NODE-002
- **files:** `packages/agent-core/src/analysis/nodes/EvaluateNode.ts`
- **smoke test:** Evaluate amazon product page against 5 heuristics
- **acceptance:**
  - Filters heuristics via filter.ts
  - Injects into user message
  - LLM call returns RawFinding[]
  - Validates with Zod
  - Retries up to 2x on malformed output

### T120: Self-critique prompt template
- **dep:** T002
- **spec:** AI_Analysis_Agent_v1.0 §7.6
- **files:** `packages/agent-core/src/analysis/prompts/selfCritique.ts`
- **acceptance:** Matches spec exactly

### T121: SelfCritiqueNode
- **dep:** T119, T120
- **spec:** REQ-ANALYZE-NODE-003
- **files:** `packages/agent-core/src/analysis/nodes/SelfCritiqueNode.ts`
- **smoke test:** Critique 5 raw findings
- **acceptance:**
  - Separate LLM call (NOT combined with evaluate)
  - Applies KEEP/REVISE/DOWNGRADE/REJECT verdicts
  - At least 1 finding rejected on test data

### T122-T129: 8 Grounding Rules [P]
- **dep:** T113

| Task | Rule | What it checks |
|------|------|---------------|
| T122 | GR-001 | Referenced element exists in page data |
| T123 | GR-002 | Above/below fold matches bounding box |
| T124 | GR-003 | Form field count matches actual form |
| T125 | GR-004 | Contrast claims have computed style data |
| T126 | GR-005 | Heuristic ID is valid (in filtered set) |
| T127 | GR-006 | Critical/high severity has measurable evidence |
| T128 | GR-007 | No conversion predictions |
| T129 | GR-008 | data_point references real section |

**Each:** `packages/agent-core/src/analysis/grounding/rules/GR-XXX.ts`

**Each acceptance:** Pure function, returns `{pass: true} | {pass: false, reason}`, unit test for accept and reject case.

### T130: EvidenceGrounder
- **dep:** T122-T129
- **spec:** REQ-ANALYZE-NODE-004
- **files:** `packages/agent-core/src/analysis/grounding/EvidenceGrounder.ts`
- **smoke test:** Ground 5 reviewed findings
- **acceptance:**
  - Runs all 8 rules in order
  - Splits into grounded + rejected
  - At least 1 rejected on test data
  - Assigns confidence tier via assignTier

### T131: AnnotateNode
- **dep:** T047, T130
- **spec:** REQ-ANALYZE-NODE-005
- **files:** `packages/agent-core/src/analysis/nodes/AnnotateNode.ts`
- **smoke test:** Annotate viewport + fullpage screenshots with 3 findings
- **acceptance:**
  - Calls page_annotate_screenshot for both screenshots
  - Calculates positions with overlap avoidance
  - Pins use severity colors

### T132: StoreNode
- **dep:** T074, T075
- **files:** `packages/agent-core/src/analysis/nodes/StoreNode.ts`
- **smoke test:** Store 3 findings + 2 screenshots
- **acceptance:**
  - Findings persisted to DB
  - Screenshots persisted to disk
  - audit_run progress updated

### T133: AnalysisGraph (compile)
- **dep:** T117, T119, T121, T130, T131, T132
- **files:** `packages/agent-core/src/analysis/AnalysisGraph.ts`
- **acceptance:** 5-step graph compiles, all edges connected

### T134: Phase 7 integration test
- **dep:** T133
- **files:** `packages/agent-core/tests/integration/analysis.test.ts`
- **smoke test:** Full pipeline on amazon.in product page
- **acceptance:**
  - Phase 7 EXIT GATE met
  - 3+ grounded findings
  - At least 1 finding rejected by self-critique
  - At least 1 finding rejected by evidence grounding
  - Annotated screenshots saved

---

## Phase 8: Audit Orchestrator (T135-T155)

### T135: AuditState (full schema)
- **dep:** T081, T113
- **spec:** final-architecture/05-unified-state.md
- **files:** `packages/agent-core/src/orchestration/AuditState.ts`
- **acceptance:** Extends AgentState with all audit + analyze fields

### T136: AuditPage type + page queue helpers
- **dep:** T135
- **files:** `packages/agent-core/src/orchestration/types.ts`
- **acceptance:** AuditPage with status enum, helpers for queue management

### T137: AuditSetupNode
- **dep:** T135, T106, T074
- **spec:** REQ-ORCH-NODE-001
- **files:** `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts`
- **smoke test:** Setup audit for example.com
- **acceptance:**
  - Loads or creates client
  - Builds page queue (max 5 for MVP)
  - Loads heuristic KB
  - Creates audit_run record

### T138: PageRouterNode
- **dep:** T135
- **spec:** REQ-ORCH-NODE-002
- **files:** `packages/agent-core/src/orchestration/nodes/PageRouterNode.ts`
- **acceptance:** Returns next URL or signals audit_complete

### T139: AuditCompleteNode
- **dep:** T135
- **spec:** REQ-ORCH-NODE-003
- **files:** `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts`
- **acceptance:**
  - Updates audit_run status
  - Generates summary
  - Emits session_completed event

### T140: routePageRouter edge
- **dep:** T138
- **spec:** REQ-ORCH-EDGE-001
- **files:** `packages/agent-core/src/orchestration/auditEdges.ts`
- **acceptance:** Routes browse vs audit_complete correctly

### T141: routeAfterBrowse edge
- **dep:** T091
- **spec:** REQ-ORCH-EDGE-002
- **acceptance:** Routes analyze vs page_router correctly

### T142: routeAfterAnalyze edge
- **dep:** T133
- **spec:** REQ-ORCH-EDGE-003
- **acceptance:** Routes page_router vs audit_complete correctly

### T143: AuditGraph (compile with subgraphs)
- **dep:** T091, T133, T137, T138, T139, T140-T142
- **spec:** REQ-ORCH-SUBGRAPH-001
- **files:** `packages/agent-core/src/orchestration/AuditGraph.ts`
- **smoke test:** Compile graph with browse + analyze as subgraphs
- **acceptance:**
  - Outer graph contains BrowseGraph and AnalysisGraph as nodes
  - All edges connected
  - State flows correctly through subgraphs

### T144: PostgresCheckpointer
- **dep:** T070
- **files:** `packages/agent-core/src/orchestration/PostgresCheckpointer.ts`
- **smoke test:** Kill mid-audit, resume from checkpoint
- **acceptance:** LangGraph PostgresCheckpointer integration, state recovers

### T145: CLI command — audit
- **dep:** T143, T003
- **files:** `apps/cli/src/commands/audit.ts`
- **acceptance:**
  - Parses --url, --pages, --output flags
  - Validates URL
  - Compiles AuditGraph and runs
  - Exit code 0 on success

### T146: ConsoleReporter
- **dep:** T076, T145
- **files:** `apps/cli/src/output/ConsoleReporter.ts`
- **acceptance:**
  - Subscribes to StreamEmitter events
  - Prints real-time progress
  - Final summary: pages, findings, cost, duration

### T147: JsonReporter
- **dep:** T145, T132
- **files:** `apps/cli/src/output/JsonReporter.ts`
- **acceptance:**
  - Generates summary.json, findings.json
  - Per-page folder with screenshots + page-level findings.json
  - Output structure matches spec.md F-005

### T148: ★★ ACCEPTANCE TEST — Full audit on example.com
- **dep:** T145, T146, T147
- **smoke test:**
  ```bash
  pnpm cro:audit --url https://example.com --pages 3 --output ./test-output
  ```
- **acceptance:** ALL of these:
  - ✅ Exit code 0
  - ✅ 3 pages crawled
  - ✅ At least 3 grounded findings total
  - ✅ At least 1 finding rejected by self-critique OR grounding
  - ✅ Output structure: summary.json, findings.json, pages/*/
  - ✅ Annotated screenshots have visible pins
  - ✅ Total cost < $5
  - ✅ Total time < 15 minutes

### T149: ★★ ACCEPTANCE TEST — Full audit on amazon.in
- **dep:** T148
- **smoke test:**
  ```bash
  pnpm cro:audit --url https://amazon.in --pages 3 --output ./test-amazon
  ```
- **acceptance:**
  - Handles anti-bot gracefully (escalate or successfully extract)
  - Findings produced for at least 1 page

### T150: ★★ ACCEPTANCE TEST — Full audit on bbc.com
- **dep:** T148
- **acceptance:** 3 pages successfully audited with findings

### T151-T155: Reserved for fixes from acceptance testing

---

## ★ MVP COMPLETE ★

The MVP is **DONE** when tasks T148, T149, and T150 all pass. This validates:

1. ✅ Browse mode works on real sites
2. ✅ Analysis pipeline produces grounded findings
3. ✅ Audit orchestrator wires browse + analyze correctly
4. ✅ Heuristics filter and inject correctly
5. ✅ Self-critique catches false positives
6. ✅ Evidence grounding catches hallucinations
7. ✅ Annotated screenshots render correctly
8. ✅ Database persistence works
9. ✅ Cost stays under budget
10. ✅ End-to-end CLI experience works

---

## Task Count Summary

| Phase | Tasks | Cumulative |
|-------|-------|-----------|
| Phase 0: Setup | 5 (T001-T005) | 5 |
| Phase 1: Perception | 10 (T006-T015) | 15 |
| Phase 2: Tools | 35 (T016-T050) | 50 |
| Phase 3: Verification | 15 (T051-T065) | 65 |
| Phase 4: Safety + Infra | 15 (T066-T080) | 80 |
| Phase 5: Browse MVP | 20 (T081-T100) | 100 |
| Phase 6: Heuristics | 12 (T101-T112) | 112 |
| Phase 7: Analysis | 22 (T113-T134) | 134 |
| Phase 8: Orchestrator | 21 (T135-T155) | **155** |

**Total: 155 numbered tasks** to MVP completion.

Many tasks marked `[P]` can run in parallel, especially the 23 browse tools (T020-T042) and 8 grounding rules (T122-T129).
