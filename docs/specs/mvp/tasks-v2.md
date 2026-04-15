# MVP Tasks v2.1 (T001-T213)

## Reconciled from Master Architecture + §33 Agent Composition Model

> **Version:** 2.1 — Extended with §33 Agent Composition Model + §33a Integration Plan
> **Prior versions:** v2.0 (T001-T192, §01-§30), v1.0 (T001-T155, original)
> **Methodology:** Q6-R ruling + §33a interface-first integration
> **Total:** 211 tasks across 11 phases
> **Key change in v2.1:** Phase 11 (Agent Composition, T193-T210) added. 6 earlier tasks modified for §33a interfaces (T024, T066, T071, T081, T127, T143).

> **Conventions:**
> - `T###` = task ID
> - `dep:` = dependencies
> - `spec:` = source-of-truth REQ-IDs
> - `[P]` = can run in parallel with sibling tasks
> - `[MOD]` = modified from v1.0 (changes noted)
> - `[NEW]` = added in v2.0

---

## Phase 0: Setup (T001-T005) — UNCHANGED

### T001: Initialize monorepo
- **dep:** none
- **spec:** plan.md repo structure
- **files:** `package.json` (root), `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.env.example`
- **smoke test:** `pnpm install` succeeds
- **acceptance:** Monorepo with `packages/` and `apps/` workspaces. Turborepo configured.

### T002: Create agent-core package skeleton
- **dep:** T001
- **files:** `packages/agent-core/package.json`, `tsconfig.json`, `src/index.ts`, `vitest.config.ts`
- **smoke test:** `pnpm build` succeeds
- **acceptance:** TypeScript compiles, Vitest runs.

### T003: Create CLI app skeleton
- **dep:** T001
- **files:** `apps/cli/package.json`, `tsconfig.json`, `src/index.ts`
- **smoke test:** `pnpm cro:audit --version` prints version
- **acceptance:** CLI runnable via pnpm script.

### T004: Setup Docker Compose for Postgres
- **dep:** T001
- **files:** `docker-compose.yml` (postgres:16-bullseye + pgvector)
- **smoke test:** `docker-compose up -d` starts Postgres
- **acceptance:** Postgres 16 + pgvector running locally.

### T005: Setup environment variables
- **dep:** T004
- **files:** `.env.example`, `.env` (gitignored)
- **acceptance:** All required env vars documented.

---

## Phase 1: Perception Foundation (T006-T015) — UNCHANGED

### T006: BrowserManager
- **dep:** T002
- **spec:** REQ-BROWSE-NODE-003
- **files:** `packages/agent-core/src/browser-runtime/BrowserManager.ts`
- **smoke test:** Launch browser, navigate to amazon.in, close cleanly
- **acceptance:** Wraps Playwright, returns BrowserSession, implements BrowserEngine interface.

### T007: StealthConfig
- **dep:** T006
- **spec:** REQ-BROWSE-HUMAN-005, REQ-BROWSE-HUMAN-006
- **files:** `packages/agent-core/src/browser-runtime/StealthConfig.ts`
- **smoke test:** Navigate to bot.sannysoft.com, all checks pass
- **acceptance:** playwright-extra + stealth, fingerprint rotation per session.

### T008: AccessibilityExtractor
- **dep:** T006
- **spec:** REQ-BROWSE-PERCEPT-001, REQ-BROWSE-PERCEPT-002
- **files:** `packages/agent-core/src/perception/AccessibilityExtractor.ts`
- **smoke test:** Extract AX-tree from amazon.in
- **acceptance:** >50 nodes, includes search box.

### T009: HardFilter
- **dep:** T008
- **spec:** REQ-BROWSE-PERCEPT-002
- **files:** `packages/agent-core/src/perception/HardFilter.ts`
- **acceptance:** Removes invisible/disabled/aria-hidden/zero-dim. Count drops >50%.

### T010: SoftFilter
- **dep:** T009
- **spec:** REQ-BROWSE-PERCEPT-003
- **files:** `packages/agent-core/src/perception/SoftFilter.ts`
- **acceptance:** Scores by relevance, returns top 30.

### T011: MutationMonitor
- **dep:** T006
- **spec:** REQ-BROWSE-PERCEPT-005, REQ-BROWSE-PERCEPT-006
- **files:** `packages/agent-core/src/perception/MutationMonitor.ts`
- **acceptance:** Injects MutationObserver, tracks mutations, settles within 2s.

### T012: ScreenshotExtractor
- **dep:** T006
- **files:** `packages/agent-core/src/perception/ScreenshotExtractor.ts`
- **acceptance:** JPEG <150KB, ≤1280px wide.

### T013: ContextAssembler
- **dep:** T008, T009, T010, T011, T012
- **spec:** REQ-BROWSE-PERCEPT-001
- **files:** `packages/agent-core/src/perception/ContextAssembler.ts`
- **acceptance:** Returns full PageStateModel.

### T014: PageStateModel types + Zod schemas
- **dep:** T002
- **files:** `packages/agent-core/src/perception/types.ts`
- **acceptance:** All sub-types defined with Zod.

### T015: Phase 1 integration test
- **dep:** T013
- **files:** `packages/agent-core/tests/integration/phase1.test.ts`
- **acceptance:** PageStateModel on 3 sites, <1500 tokens each.

---

## Phase 2: MCP Tools + Human Behavior (T016-T050) — UNCHANGED

### T016: MouseBehavior
- **dep:** T006
- **spec:** REQ-BROWSE-HUMAN-001, REQ-BROWSE-HUMAN-002
- **acceptance:** ghost-cursor Bezier, ~500ms mean.

### T017: TypingBehavior
- **dep:** T006
- **spec:** REQ-BROWSE-HUMAN-003, REQ-BROWSE-HUMAN-004
- **acceptance:** Gaussian delays, 1-2% typos.

### T018: ScrollBehavior
- **dep:** T006
- **acceptance:** Variable momentum, triggers lazy-load.

### T019: MCPServer skeleton
- **dep:** T002
- **spec:** REQ-MCP-001, REQ-MCP-002
- **acceptance:** @modelcontextprotocol/sdk, tool registration via Zod.

### T020-T042: 23 Browse Tools [P]

| Task | Tool | File |
|------|------|------|
| T020 | browser_navigate | `mcp/tools/navigate.ts` |
| T021 | browser_go_back | `mcp/tools/goBack.ts` |
| T022 | browser_go_forward | `mcp/tools/goForward.ts` |
| T023 | browser_reload | `mcp/tools/reload.ts` |
| T024 | browser_get_state | `mcp/tools/getState.ts` |
| T025 | browser_screenshot | `mcp/tools/screenshot.ts` |
| T026 | browser_get_metadata | `mcp/tools/getMetadata.ts` |
| T027 | browser_click | `mcp/tools/click.ts` |
| T028 | browser_click_coords | `mcp/tools/clickCoords.ts` |
| T029 | browser_type | `mcp/tools/type.ts` |
| T030 | browser_scroll | `mcp/tools/scroll.ts` |
| T031 | browser_select | `mcp/tools/select.ts` |
| T032 | browser_hover | `mcp/tools/hover.ts` |
| T033 | browser_press_key | `mcp/tools/pressKey.ts` |
| T034 | browser_upload | `mcp/tools/upload.ts` |
| T035 | browser_tab_manage | `mcp/tools/tabManage.ts` |
| T036 | browser_extract | `mcp/tools/extract.ts` |
| T037 | browser_download | `mcp/tools/download.ts` |
| T038 | browser_find_by_text | `mcp/tools/findByText.ts` |
| T039 | browser_get_network | `mcp/tools/getNetwork.ts` |
| T040 | browser_wait_for | `mcp/tools/waitFor.ts` |
| T041 | agent_complete | `mcp/tools/agentComplete.ts` |
| T042 | agent_request_human | `mcp/tools/requestHuman.ts` |

### T043: browser_evaluate (with sandbox)
- **spec:** REQ-MCP-SANDBOX-001..003
- **acceptance:** Sandbox blocks cookies/localStorage/fetch/navigation.

### T044: page_get_element_info
- **acceptance:** Returns boundingBox, isAboveFold, computedStyles, contrastRatio.

### T045: page_get_performance
- **acceptance:** Returns DOMContentLoaded, fullyLoaded, resourceCount, LCP.

### T046: page_screenshot_full
- **acceptance:** Full scroll capture, max 15000px, JPEG <2MB.

### T047: page_annotate_screenshot
- **acceptance:** Sharp-based, severity colors, overlap avoidance.

### T048: page_analyze
- **spec:** REQ-TOOL-PA-001
- **acceptance:** Single page.evaluate(), returns full AnalyzePerception.

### T049: RateLimiter
- **spec:** REQ-BROWSE-RATE-001..002
- **acceptance:** 2s min interval, per-domain limits.

### T050: Phase 2 integration test
- **acceptance:** All 28 tools work tool-by-tool on amazon.in.

---

## Phase 3: Verification & Confidence (T051-T065) — UNCHANGED

### T051: ActionContract type
### T052: VerifyStrategy union type

### T053-T061: 9 Verify Strategies [P]
| Task | Strategy |
|------|----------|
| T053 | url_change |
| T054 | element_appears |
| T055 | element_text |
| T056 | network_request |
| T057 | no_error_banner |
| T058 | snapshot_diff |
| T059 | custom_js |
| T060 | no_captcha |
| T061 | no_bot_block |

### T062: VerifyEngine (mutation-aware)
### T063: FailureClassifier
### T064: ConfidenceScorer (multiplicative)
### T065: Phase 3 integration test

---

## Phase 4: Safety + Infrastructure (T066-T080) — T070 MODIFIED

### T066: ActionClassifier — UNCHANGED
### T067: SafetyCheck — UNCHANGED
### T068: DomainPolicy — UNCHANGED
### T069: CircuitBreaker — UNCHANGED

### T070: PostgreSQL schema (Drizzle) [MOD]
- **dep:** T004
- **spec:** §13-data-layer.md + §13.6 extensions
- **files:**
  - `packages/agent-core/src/db/schema.ts`
  - `packages/agent-core/src/db/migrations/0001_initial.sql`
  - `packages/agent-core/src/db/migrations/0002_master_extensions.sql` **[NEW]**
- **smoke test:** `pnpm db:migrate` succeeds, all tables exist
- **v2.0 changes:**
  - Original 7 tables: clients, audit_runs, findings, screenshots, sessions, audit_log, rejected_findings ✅
  - **NEW tables added:** `page_states`, `state_interactions`, `finding_rollups`, `reproducibility_snapshots`, `audit_requests`
  - **ALTER TABLE on findings:** adds `scope`, `template_id`, `workflow_id`, `state_ids`, `parent_finding_ids`, `polarity`, `business_impact`, `effort`, `priority`, `source`, `analysis_scope`, `interaction_evidence` columns (nullable, backward-compatible)
    - `source TEXT DEFAULT NULL` — `'open_observation'` for Pass 2 findings, NULL for standard (§33)
    - `analysis_scope TEXT DEFAULT 'global'` — `'global'|'per_state'|'transition'` (§33)
    - `interaction_evidence JSONB DEFAULT NULL` — serialized InteractionRecord[] (§33)
  - **published_findings VIEW** created per §13.6.11
  - **RLS policies** on all new client-scoped tables
  - Drizzle schema matches SQL exactly for all tables
- **acceptance:** All tables created. ALTER TABLE columns nullable. View queryable. RLS enforced.

### T071: AuditLogger — UNCHANGED
### T072: SessionRecorder — UNCHANGED
### T073: LLMAdapter + AnthropicAdapter — UNCHANGED
### T074: StorageAdapter + PostgresStorage — UNCHANGED
### T075: ScreenshotStorage + LocalDiskStorage — UNCHANGED
### T076: StreamEmitter — UNCHANGED
### T077-T079: Reserved
### T080: Phase 4 integration test — UNCHANGED

---

## Phase 5: Browse Mode MVP (T081-T100) — UNCHANGED

### T081-T091: Graph nodes, edges, system prompt, BrowseGraph — all UNCHANGED
### T092-T096: Integration tests (BBC, Amazon, workflow, recovery, budget) — all UNCHANGED
### T097-T100: Reserved

---

## Phase 6: Heuristic Knowledge Base (T101-T112) — T101, T103-T105 MODIFIED

### T101: HeuristicSchema (Zod) [MOD]
- **dep:** T002
- **spec:** REQ-HK-001 + §9.10 extensions (REQ-HK-EXT-001..019)
- **files:** `packages/agent-core/src/analysis/heuristics/schema.ts`
- **v2.0 changes:**
  - Base schema per §9.1 ✅ (unchanged)
  - **NEW: `HeuristicSchemaExtended`** added in same file with forward-compat fields:
    - `version` (default "1.0.0")
    - `rule_vs_guidance` (default "guidance")
    - `business_impact_weight` (default 0.5)
    - `effort_category` (default "content")
    - `preferred_states` (optional, StatePattern[])
    - `status` (default "active")
  - Both schemas exported; loader uses Extended with fallback defaults per REQ-HK-EXT-050
- **acceptance:** Base schema validates existing heuristics. Extended schema adds fields with safe defaults. Phase 1 JSON files pass both schemas.

### T102: HeuristicKnowledgeBase schema — UNCHANGED

### T103: Author 50 Baymard heuristics [MOD]
- **dep:** T101
- **files:** `heuristics-repo/baymard.json`
- **v2.0 changes:**
  - All 50 heuristics now include `version: "1.0.0"`, `rule_vs_guidance`, `business_impact_weight`, `effort_category` per §9.10.7 defaults
  - **~8 heuristics get `preferred_states`:** e.g., BAY-CHECKOUT-001 (guest checkout) needs `preferred_states: [{ pattern_id: "checkout_form_visible", interaction_hint: { type: "click", target_text_contains: ["Checkout", "Proceed"] } }]`
  - **~10 heuristics classified as `rule_vs_guidance: "rule"`** (e.g., form field count, CTA presence, guest checkout option, trust badge presence)
- **acceptance:** All 50 pass HeuristicSchemaExtended validation. ~8 have preferred_states. ~10 have rule_vs_guidance="rule".

### T104: Author 35 Nielsen heuristics [MOD]
- **v2.0 changes:** Same pattern as T103. ~5 get preferred_states. ~8 get rule_vs_guidance="rule".

### T105: Author 15 Cialdini heuristics [MOD]
- **v2.0 changes:** Same pattern. ~3 get preferred_states (e.g., social proof heuristic needs reviews tab). ~3 get rule_vs_guidance="rule".

### T106-T112: HeuristicLoader, filters, encryption, tier validator, Phase 6 test [T107 MOD]

**T107 modification (§9.6 two-stage filtering):**
- **spec:** §9.6 REQ-HK-020a, REQ-HK-020b
- **v2.1 changes:**
  - Implement TWO filter functions (not one):
    - `filterByBusinessType(allHeuristics, businessType)` — Stage 1, called in `audit_setup`
    - `filterByPageType(businessFilteredHeuristics, pageType)` — Stage 2, called in `page_router`
  - Old single `filterHeuristics(all, pageType, businessType)` replaced with two-stage
  - `prioritizeHeuristics(filtered, 30)` unchanged — cap at 30 applied after Stage 2
- **acceptance:** Stage 1 reduces 100 → ~60-70. Stage 2 reduces ~60-70 → ~15-20. Two-stage produces identical results to single-stage.

---

## Phase 7: Analysis Pipeline (T113-T134) — UNCHANGED

### T113-T134: All tasks unchanged. AnalysisState, detectPageType, assignConfidenceTier, CostTracker, DeepPerceiveNode, EvaluateNode, SelfCritiqueNode, 8 Grounding Rules, EvidenceGrounder, AnnotateNode, StoreNode, AnalysisGraph, Phase 7 integration test.

---

## Phase 8: Audit Orchestrator (T135-T155) — T135, T137, T145, T148-T150 MODIFIED

### T135: AuditState (full schema) [MOD]
- **dep:** T081, T113
- **spec:** §05-unified-state.md + §5.7 extensions
- **files:** `packages/agent-core/src/orchestration/AuditState.ts`
- **v2.0 changes:**
  - Base browse + analyze fields ✅ (unchanged)
  - **NEW §5.7 fields added** with defaults:
    - `trigger_source` (default "consultant_dashboard")
    - `audit_request_id` (default "")
    - `state_graph` (default null)
    - `multi_state_perception` (default null)
    - `current_state_id` (default null)
    - `exploration_cost_usd` (default 0)
    - `exploration_budget_usd` (default 0.50)
    - `exploration_pass_2_triggered` (default false)
    - `finding_rollups` (default [])
    - `reproducibility_snapshot` (default null)
    - `published_finding_ids` (default [])
    - `warmup_mode_active` (default true)
  - All new fields have defaults → Phase 1-5 code unaffected (REQ-STATE-EXT-COMPAT-001)
- **acceptance:** All §5.3 + §5.7 fields compile. Invariants validated (§5.4 + §5.7.3). Serializes to JSON for checkpointing.

### T136: AuditPage type — UNCHANGED
### T137: AuditSetupNode [MOD]
- **dep:** T135, T106, T074
- **spec:** REQ-ORCH-NODE-001 + §25 REQ-REPRO-031a + §18 REQ-TRIGGER-PERSIST-003
- **v2.0 changes:**
  - Original: loads client, builds page queue, creates audit_run ✅
  - **NEW: reads `reproducibility_snapshot`** from DB (created by gateway/CLI) into AuditState. If snapshot missing → fail audit with `snapshot_missing`.
  - **NEW: reads `AuditRequest`** from `audit_requests` table to populate trigger_source, audit_request_id.
  - **NEW: sets `warmup_mode_active`** from client profile.
  - **NEW (v2.1): Stage 1 heuristic filtering** — calls `filterByBusinessType(allHeuristics, business_type)` and stores the reduced set (~60-70) in `state.heuristic_knowledge_base` (per §9.6 REQ-HK-020a). Page-type filtering happens later in page_router (Stage 2).
- **acceptance:** Reproducibility snapshot loaded. AuditRequest consumed. Warm-up mode set. `heuristic_knowledge_base` contains only business-type-relevant heuristics (Stage 1 filtered).

### T138-T144: PageRouter, AuditComplete, routing edges, AuditGraph, Checkpointer [T138 MOD]

**T138 modification (§9.6 two-stage filtering):**
- **v2.1 changes:**
  - page_router calls `filterByPageType(state.heuristic_knowledge_base, currentPageType)` (Stage 2, per §9.6 REQ-HK-020b)
  - Input is the BUSINESS-FILTERED set from audit_setup (not all 100)
  - Stores result in `state.filtered_heuristics` (capped at 30)
- **acceptance:** `filtered_heuristics` contains 15-20 page-relevant heuristics from the business-filtered set.

### T145: CLI command — audit [MOD]
- **dep:** T143, T003
- **spec:** §18 AuditRequest contract
- **files:** `apps/cli/src/commands/audit.ts`
- **v2.0 changes:**
  - Original: parses flags, compiles AuditGraph, runs directly ✅
  - **NEW: constructs `AuditRequest`** from CLI flags (url, pages, budget, output)
  - **NEW: writes `audit_requests` row** + `reproducibility_snapshots` row before graph execution
  - **NEW: passes `AuditRequest` to graph** instead of raw params
  - Gateway is a thin pass-through for MVP CLI — no HTTP, no Temporal, direct function call
- **acceptance:** AuditRequest created. Snapshot written. Graph receives typed request.

### T146: ConsoleReporter — UNCHANGED
### T147: JsonReporter — UNCHANGED

### T148: ★★ ACCEPTANCE TEST — Full audit on example.com [MOD]
- **dep:** T145, T146, T147
- **smoke test:** `pnpm cro:audit --url https://example.com --pages 3 --output ./test-output`
- **v2.0 acceptance additions:**
  - ✅ All v1.0 criteria (3 pages, 3+ findings, rejection, screenshots, cost, time)
  - ✅ **[NEW] `reproducibility_snapshots` row exists** with temperature=0, model version pinned
  - ✅ **[NEW] findings have `business_impact`, `effort`, `priority` columns** populated (not null)
  - ✅ **[NEW] `published_findings` view** returns 0 rows (warm-up mode active, nothing auto-published)
  - ✅ **[NEW] `audit_requests` row** exists with trigger_source="cli"

### T149: ★★ ACCEPTANCE TEST — Amazon [MOD]
- **v2.0 acceptance additions:** Same as T148 plus: handles anti-bot, findings scored.

### T150: ★★ ACCEPTANCE TEST — BBC [MOD]
- **v2.0 acceptance additions:** Same as T148.

### T151-T155: Reserved for fixes from acceptance testing

---

## Phase 9: Master Foundations [NEW] (T156-T175)

> **Purpose:** Add the 5 must-have-from-day-1 master architecture foundations that cannot be deferred. These run AFTER Phase 8 acceptance tests pass, BEFORE state exploration.

### T156: AuditRequest contract (TypeScript + Zod) [NEW]
- **dep:** T002
- **spec:** §18.4 REQ-TRIGGER-CONTRACT-001
- **files:** `packages/agent-core/src/gateway/AuditRequest.ts`
- **acceptance:**
  - Full `AuditRequest` interface matching §18.4
  - Zod schema for runtime validation
  - Includes: target, scope, budget, heuristic_set, notifications, tags
  - `metadata` replaced with specific fields (tags, reason, external_correlation_id) per S5-L2-FIX

### T157: AuditRequest defaults + validation [NEW]
- **dep:** T156
- **files:** `packages/agent-core/src/gateway/validateRequest.ts`
- **acceptance:**
  - Applies defaults for missing fields (budget $15, max_pages 50, etc.)
  - Validates client_id exists
  - Validates budget within limits
  - Returns structured ValidationError on failure per §18.7 REQ-TRIGGER-VALIDATE-002

### T158: Gateway service (thin, MVP) [NEW]
- **dep:** T156, T157, T074
- **files:** `packages/agent-core/src/gateway/GatewayService.ts`
- **acceptance:**
  - Accepts AuditRequest
  - Validates via T157
  - Creates `audit_requests` row
  - Creates `audit_runs` row
  - Creates `reproducibility_snapshots` row (F3)
  - Returns audit_request_id + audit_run_id
  - For MVP: synchronous function call, no HTTP server, no Temporal

### T159: CLI integration with Gateway [NEW]
- **dep:** T158, T145
- **files:** `apps/cli/src/commands/audit.ts` (refactor)
- **acceptance:**
  - CLI constructs AuditRequest from flags
  - Calls GatewayService.submit(request)
  - GatewayService returns IDs
  - CLI then compiles + runs AuditGraph with IDs
  - Replaces T145's direct graph compilation

### T160: Reproducibility snapshot builder + loader [NEW]
- **dep:** T073, T106
- **spec:** §25.4 REQ-REPRO-031, §27 (loadReproducibilitySnapshot activity)
- **files:** `packages/agent-core/src/reproducibility/SnapshotBuilder.ts`
- **acceptance:**
  - `createSnapshot()`: Computes SHA256 hashes of prompt template files, reads model name + version from LLMAdapter config, reads heuristic base version + computes overlay_chain_hash, reads normalizer/grounding/scoring versions from config. Returns ReproducibilitySnapshot. All temperatures set to 0 per REQ-REPRO-001. Called by **gateway** before Temporal workflow start (§18 REQ-TRIGGER-PERSIST-003).
  - `loadAndValidateSnapshot(auditRunId)`: Reads existing snapshot from DB. Validates immutability (hash check). Returns snapshot for AuditState. Called by **audit_setup** node (NOT Temporal activity — §27 fix).
  - Snapshot is IMMUTABLE after creation — mutation attempt throws Error

### T161: Temperature enforcement guard [NEW]
- **dep:** T073
- **spec:** §25.3 REQ-REPRO-020
- **files:** `packages/agent-core/src/adapters/TemperatureGuard.ts`
- **acceptance:**
  - Wraps LLMAdapter.invoke()
  - If node is "evaluate" or "evaluate_interactive" or "self_critique" and temperature ≠ 0: throws Error
  - Runtime guard, not compile-time

### T162: Two-store access mode middleware [NEW]
- **dep:** T070, T074
- **spec:** §24.3 REQ-TWOSTORE-001..003
- **files:** `packages/agent-core/src/storage/AccessModeMiddleware.ts`
- **acceptance:**
  - Sets `SET LOCAL app.access_mode` on database transactions
  - Sets `SET LOCAL app.client_id` on database transactions
  - All database operations wrapped in transactions for SET LOCAL to work (M4-L2-FIX)

### T163: Warm-up mode state machine [NEW]
- **dep:** T074, T070
- **spec:** §24.4 REQ-TWOSTORE-010..013
- **files:** `packages/agent-core/src/review/WarmupManager.ts`
- **acceptance:**
  - Computes warm-up status: active/can_graduate/blocked
  - Checks: audits_completed >= 3 AND rejection_rate < 25%
  - Stores warmup_mode_active on client profile
  - determinePublishAction() returns held/published/delayed per §24.5

### T164: Extended StoreNode (two-store aware) [NEW]
- **dep:** T132, T163
- **files:** `packages/agent-core/src/analysis/nodes/StoreNode.ts` (extend)
- **acceptance:**
  - Checks warmup_mode_active before auto-publishing
  - During warm-up: ALL findings stored as "held" regardless of tier
  - Post warm-up: Tier 1 → published, Tier 2 → delayed, Tier 3 → held
  - Updates published_finding_ids in state

### T165: Scoring pipeline (4-dimensional) [NEW]
- **dep:** T002, T115
- **spec:** §23.4 REQ-FINDINGS-SCORE-001..051
- **files:** `packages/agent-core/src/analysis/scoring/ScoringPipeline.ts`
- **acceptance:**
  - `determineSeverity(finding, heuristic)` — from heuristic or critique downgrade
  - `computeConfidence(finding, heuristic, rulesPasssed)` — tier × grounding × evidence
  - `computeBusinessImpact(severity, pageType, funnelPosition, weight)` — IMPACT_MATRIX lookup
  - `computeEffort(heuristic)` — EFFORT_MAP lookup
  - `computePriority(severity, confidence, impact, effort)` — formula: `Math.round((severity*2 + impact*1.5 + confidence*1 - effort*0.5) * 100) / 100` (parentheses critical — §23 fix)
  - ALL deterministic, NO LLM calls
  - Unit tests for each function

### T166: IMPACT_MATRIX + EFFORT_MAP config [NEW]
- **dep:** T002
- **spec:** §23.4
- **files:** `packages/agent-core/src/analysis/scoring/config.ts`
- **acceptance:**
  - IMPACT_MATRIX: PageType × FunnelPosition → base impact (0-10)
  - DEFAULT_FUNNEL_POSITION: PageType → default position (C5-L2-FIX)
  - EFFORT_MAP: EffortCategory → effort score (2-10)
  - Version string for reproducibility snapshot

### T167: Scoring integration with AnnotateNode [NEW]
- **dep:** T165, T131
- **files:** `packages/agent-core/src/analysis/nodes/AnnotateNode.ts` (extend)
- **acceptance:**
  - After grounding, run scoring pipeline on each grounded finding
  - Write business_impact, effort, priority to finding before DB persist
  - Finding suppression: confidence < 0.3 → reject (REQ-FINDINGS-SUPPRESS-001)

### T168: Finding suppression rules [NEW]
- **dep:** T165
- **spec:** §23.5 REQ-FINDINGS-SUPPRESS-001..002
- **files:** `packages/agent-core/src/analysis/scoring/Suppression.ts`
- **acceptance:**
  - confidence < 0.3 → reject
  - evidence_ids empty → reject
  - Exact duplicate (heuristic_id + element_ref + page) → reject
  - All suppressed findings logged to rejected_findings table

### T169: Consultant dashboard — basic review UI [NEW]
- **dep:** T070, T162, T163
- **files:** `apps/dashboard/src/app/console/review/page.tsx`
- **acceptance:**
  - Lists findings needing review (status = "held")
  - Sorted by priority (highest first)
  - Actions: Approve, Reject, Edit (creates finding_edit row)
  - Shows annotated screenshot with finding highlighted
  - Shows evidence, severity, confidence, business_impact, effort, priority
  - Reads from internal store (app.access_mode = "internal")

### T170: Consultant dashboard — audit list + trigger [NEW]
- **dep:** T158, T169
- **files:** `apps/dashboard/src/app/console/audits/page.tsx`
- **acceptance:**
  - Lists audit runs with status, dates, finding counts
  - "New Audit" button: form for URL, pages, budget
  - Submits via GatewayService (same as CLI path)

### T171: Consultant dashboard — basic layout + auth [NEW]
- **dep:** T002
- **files:**
  - `apps/dashboard/package.json` (Next.js 15 + shadcn/ui + Tailwind)
  - `apps/dashboard/src/app/layout.tsx`
  - `apps/dashboard/src/app/console/layout.tsx`
  - `apps/dashboard/src/middleware.ts` (Clerk auth)
- **acceptance:**
  - Next.js app with Clerk authentication
  - Consultant role required for `/console/*` routes
  - Basic layout with sidebar navigation

### T172: Consultant dashboard — finding detail [NEW]
- **dep:** T169
- **files:** `apps/dashboard/src/app/console/review/[id]/page.tsx`
- **acceptance:**
  - Full finding detail: observation, assessment, recommendation, evidence
  - Annotated screenshot with pin highlighted
  - Heuristic source attribution (not heuristic content — IP protection)
  - Edit form: change description, recommendation, severity
  - Approve/Reject buttons
  - Original finding preserved (finding_edits table)

### T173: Warm-up status display [NEW]
- **dep:** T163, T171
- **files:** `apps/dashboard/src/app/console/clients/[id]/page.tsx`
- **acceptance:**
  - Shows: audits completed / required, rejection rate, can_graduate status
  - Manual override toggle (enable/disable warm-up)

### T174: Phase 9 integration test [NEW]
- **dep:** T158-T173
- **files:** `packages/agent-core/tests/integration/phase9-foundations.test.ts`
- **acceptance:**
  - AuditRequest validates + persists
  - Reproducibility snapshot created with temperature 0
  - Scoring pipeline produces 4D scores
  - Two-store: internal store has all findings, published view has only approved
  - Warm-up mode: new client → all findings held
  - CLI trigger works end-to-end through gateway

### T175: ★★ ACCEPTANCE TEST — Foundations on real audit [NEW]
- **dep:** T174
- **smoke test:** `pnpm cro:audit --url https://bbc.com --pages 2 --output ./test-foundations`
- **acceptance:**
  - Audit completes with all v1.0 criteria
  - reproducibility_snapshots row: temperature 0, all versions pinned
  - Findings: business_impact ≠ null, effort ≠ null, priority ≠ null for all grounded findings
  - published_findings view: 0 rows (warm-up active)
  - audit_requests row: trigger_source = "cli"
  - Consultant dashboard: findings appear in review inbox sorted by priority

---

## Phase 10: State Exploration [NEW] (T176-T192)

> **Purpose:** Full §20 two-pass state exploration. The browse subgraph gains an `explore_states` node between stabilisation and deep_perceive.

### T176: StateNode + StateGraph types (Zod) [NEW]
- **dep:** T002
- **spec:** §5.7.1 (StateNode, StateGraph, MultiStatePerception, ExplorationTrigger)
- **files:** `packages/agent-core/src/exploration/types.ts`
- **acceptance:**
  - StateNode, StateGraph, MultiStatePerception, InteractionPath, ExplorationTrigger types
  - Zod schemas for all
  - `computeStateId()` function: sha256(canonicalJSON({url, interactions})) per S8-L2-FIX

### T177: Disclosure rule library [NEW]
- **dep:** T002
- **spec:** §20.3 REQ-STATE-EXPLORE-030
- **files:** `packages/agent-core/src/exploration/DisclosureRules.ts`
- **acceptance:**
  - 12 rules (R1-R12) from §20.3
  - Each rule: `detect(pageSnapshot) → DisclosureTarget[]` + `interact(target) → Interaction`
  - Rules categorised: self-restoring vs destructive (C4-L2-FIX)
  - R11 (cookie) + R12 (chat) = cleanup rules, run first

### T178: Meaningful-state detector [NEW]
- **dep:** T176
- **spec:** §20.5 REQ-STATE-EXPLORE-060..062
- **files:** `packages/agent-core/src/exploration/MeaningfulStateDetector.ts`
- **acceptance:**
  - `isMeaningful(newPerception, parentPerception) → boolean`
  - Text Jaccard > 0.15 (word-level tokenisation, M1-L2-FIX)
  - New interactive elements > 3
  - Above-fold diff > 10%
  - CTA set changed
  - Default state always meaningful

### T179: State restoration manager [NEW]
- **dep:** T006
- **spec:** §20.9 REQ-STATE-EXPLORE-100..102
- **files:** `packages/agent-core/src/exploration/StateRestorer.ts`
- **acceptance:**
  - Self-restoring interactions: no restoration needed (C4-L2-FIX)
  - Destructive interactions: click-to-close / go_back / reload fallback
  - 5s timeout on restoration
  - Destructive interactions scheduled last (REQ-STATE-EXPLORE-102)

### T180: Pass 1 — heuristic-primed explorer [NEW]
- **dep:** T177, T178, T179, T048
- **spec:** §20.3 REQ-STATE-EXPLORE-010..014
- **files:** `packages/agent-core/src/exploration/Pass1Explorer.ts`
- **acceptance:**
  - Collects `preferred_states` from filtered heuristics
  - Deduplicates by pattern_id
  - For each pattern: find element → interact → wait stability → capture perception → meaningful check
  - Self-restoring interactions: no restoration between (C4-L2-FIX)
  - Required states that can't be found → log `heuristic_state_unavailable`
  - Returns StateNode[] (meaningful only)

### T181: Auto-escalation check [NEW]
- **dep:** T176
- **spec:** §20.3 REQ-STATE-EXPLORE-020..021
- **files:** `packages/agent-core/src/exploration/EscalationCheck.ts`
- **acceptance:**
  - `shouldEscalateToPass2(stateGraph, pageSnapshot, config) → { escalate, reasons }`
  - Triggers: thorough_mode, unexplored_ratio > 0.5
  - Respects `pass_2_allowed` config
  - `heuristic_primed_only` policy blocks escalation

### T182: Pass 2 — bounded-exhaustive explorer [NEW]
- **dep:** T177, T178, T179, T181
- **spec:** §20.3 REQ-STATE-EXPLORE-030..042
- **files:** `packages/agent-core/src/exploration/Pass2Explorer.ts`
- **acceptance:**
  - Applies disclosure rule library (R1-R12) in order: R11→R12→R1..R10
  - Skips elements already explored in Pass 1
  - Max states: 15 per page
  - Max depth: 2
  - Max interactions: 25
  - LLM fallback: 1 call max if <3 meaningful states on interactive page (REQ-STATE-EXPLORE-040)
  - Budget enforcement per page ($0.50 default)
  - Returns StateNode[] (meaningful only)

### T183: State graph builder [NEW]
- **dep:** T176, T180, T182
- **spec:** §20.4 REQ-STATE-EXPLORE-050
- **files:** `packages/agent-core/src/exploration/StateGraphBuilder.ts`
- **acceptance:**
  - Builds StateGraph from default state + Pass 1 + Pass 2 results
  - Default state always first
  - Edges track parent→child with interaction
  - Sets truncated flag + reason if any cap hit

### T184: MultiStatePerception synthesiser [NEW]
- **dep:** T176, T183
- **spec:** §20.6 REQ-STATE-EXPLORE-070..072
- **files:** `packages/agent-core/src/exploration/MultiStateSynthesiser.ts`
- **acceptance:**
  - Merges default + hidden states into merged_view
  - CTA dedup: text cosine > 0.9 AND bounding box IoU > 0.5 (S4-L2-FIX)
  - Builds state_provenance Record (key = data_point format, value = state_id) per S3-L2-FIX
  - If no hidden states: merged_view = default_state (backward compat)

### T185: GR-009 — state provenance grounding rule [NEW]
- **dep:** T184
- **spec:** §20.10 REQ-STATE-EXPLORE-110..111
- **files:** `packages/agent-core/src/analysis/grounding/rules/GR-009.ts`
- **acceptance:**
  - If finding cites element NOT in default state AND no provenance → reject
  - If finding cites element with provenance pointing to non-existent state → reject
  - If all elements in default state → pass (trivial)
  - Unit tests for accept + reject cases

### T186: `explore_states` graph node [NEW]
- **dep:** T180, T181, T182, T183, T184
- **spec:** §20.2 REQ-STATE-EXPLORE-001..002
- **files:** `packages/agent-core/src/orchestration/nodes/ExploreStatesNode.ts`
- **acceptance:**
  - Sits between page stabilisation and deep_perceive in browse subgraph
  - Runs Pass 1
  - Checks escalation
  - If escalation → runs Pass 2
  - Builds StateGraph → writes to AuditState
  - Builds MultiStatePerception → writes to AuditState
  - Persists states to page_states + state_interactions tables

### T187: Extended deep_perceive (multi-state aware) [NEW]
- **dep:** T117, T184
- **files:** `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` (extend)
- **acceptance:**
  - If multi_state_perception available: use merged_view for heuristic evaluation
  - If not available (Phase 1-5 compat): use single-state perception as before
  - Captures viewport + fullpage screenshots PER meaningful state (stored in R2)

### T188: Extended EvidenceGrounder (GR-009 aware) [NEW]
- **dep:** T130, T185
- **files:** `packages/agent-core/src/analysis/grounding/EvidenceGrounder.ts` (extend)
- **acceptance:**
  - Adds GR-009 to grounding rule chain
  - GR-009 only runs if multi_state_perception has hidden_states
  - If no hidden states (Phase 1-5 compat): GR-009 trivially passes

### T189: Self-critique escalation signal [NEW]
- **dep:** T121, T186
- **spec:** §20.7 REQ-STATE-EXPLORE-080..082
- **files:** `packages/agent-core/src/analysis/nodes/SelfCritiqueNode.ts` (extend)
- **acceptance:**
  - If self-critique flags `insufficient_evidence: hidden_content_suspected` AND Pass 2 not yet run:
    - Sets `escalation_needed: state_exploration` in AuditState
  - Orchestrator reads this flag and routes back to explore_states (max 1 cycle)

### T190: BrowseGraph extended (with explore_states) [NEW]
- **dep:** T186, T091
- **files:** `packages/agent-core/src/orchestration/BrowseGraph.ts` (extend)
- **acceptance:**
  - Adds `explore_states` node between stabilisation and deep_perceive
  - Conditional: if Phase 7+ features enabled, run explore_states. Otherwise skip (Phase 1-5 compat).
  - Escalation loop: if analysis sets escalation flag → route back to explore_states once

### T191: Phase 10 integration test [NEW]
- **dep:** T186-T190
- **files:** `packages/agent-core/tests/integration/phase10-exploration.test.ts`
- **acceptance:**
  - Run on a product page with tabs/accordions (e.g., amazon.in PDP with reviews tab)
  - Pass 1: at least 1 hidden state captured from preferred_states
  - Meaningful-state detection: at least 1 state discarded as not-meaningful
  - StateGraph persisted to page_states table
  - MultiStatePerception merged_view has more CTAs/trust signals than default state
  - GR-009: finding citing reviews-tab content has state provenance

### T191a: Per-state screenshot capture in deep_perceive [NEW]
- **dep:** T191, T127 (EvaluateNode)
- **spec:** REQ-ANALYZE-NODE-001a, REQ-ANALYZE-NODE-001b, REQ-ANALYZE-NODE-001c, REQ-ANALYZE-NODE-001d
- **files:** Edit `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts`
- **smoke test:** After state exploration on PDP with 3 states, `deep_perceive` populates `viewport_screenshot_ref` and `fullpage_screenshot_ref` for all 3 states. Screenshots stored in R2.
- **acceptance:** Per-state screenshots captured via interaction path replay. Default state first, hidden states via replay. Failed replays → null refs (non-fatal). Max 30 screenshots per page.

### T192: ★★ ACCEPTANCE TEST — State exploration on real audit [NEW]
- **dep:** T191
- **smoke test:** `pnpm cro:audit --url https://amazon.in --pages 1 --explore --output ./test-explore`
- **acceptance:**
  - Audit completes
  - page_states table: >1 row for the page (default + at least 1 hidden state)
  - state_interactions table: at least 1 interaction recorded
  - Findings reference state_ids (non-empty for findings from hidden states)
  - Annotated screenshots include findings from both default and hidden states
  - GR-009 active: at least 1 finding validated against state provenance
  - Exploration cost tracked in state
  - Total cost still < budget

---

## ★ MVP v2.0 COMPLETE ★

The MVP v2.0 is **DONE** when T148-T150 (Phase 8 acceptance), T175 (Phase 9 foundations acceptance), and T192 (Phase 10 state exploration acceptance) all pass. This validates:

1. ✅ Browse mode works on real sites (v1.0)
2. ✅ Analysis pipeline produces grounded findings (v1.0)
3. ✅ Audit orchestrator wires browse + analyze correctly (v1.0)
4. ✅ Heuristics filter and inject correctly (v1.0)
5. ✅ Self-critique catches false positives (v1.0)
6. ✅ Evidence grounding catches hallucinations (v1.0)
7. ✅ Annotated screenshots render correctly (v1.0)
8. ✅ Database persistence works (v1.0)
9. ✅ Cost stays under budget (v1.0)
10. ✅ CLI + consultant dashboard work (v1.0 + v2.0)
11. ✅ **[NEW] 4-dimensional deterministic scoring** (severity + confidence + impact + effort + priority)
12. ✅ **[NEW] Two-store pattern** — published findings isolated from internal store
13. ✅ **[NEW] Warm-up mode** — no auto-publish for new clients
14. ✅ **[NEW] Reproducibility snapshots** — temperature 0, version pinning, audit defensibility
15. ✅ **[NEW] AuditRequest contract** — single entry point for all trigger channels
16. ✅ **[NEW] State exploration** — hidden content behind tabs/accordions/modals captured and analyzed
17. ✅ **[NEW] GR-009** — state provenance integrity grounding rule
18. ✅ **[NEW] MultiStatePerception** — merged cross-state evidence for heuristic evaluation

---

## Phase 11: Agent Composition (T193-T210) — ALL NEW (§33 + §33a)

> **Dependency:** Phase 7 (analysis pipeline), Phase 8 (orchestrator), Phase 10 (state exploration)
> **Spec:** §33 (Agent Composition Model), §33a (Composition Integration Plan)
> **Note:** §33 interfaces are ALREADY built into Phases 2, 4, 5, 7, 8 per §33a. Phase 11 activates the interactive path.

### T193: InteractiveEvaluateStrategy (ReAct loop)
- **dep:** T127 (EvaluateNode), T081 (BrowseGraph)
- **spec:** REQ-COMP-039, §33.7b
- **files:** `packages/agent-core/src/analysis/strategies/InteractiveEvaluateStrategy.ts`
- **smoke test:** Interactive evaluate on a PDP with size selector — LLM selects variant, captures state change, produces finding
- **acceptance:** ReAct loop with tool calls. Exits on: all heuristics evaluated, budget exhausted, or max turns. Returns `EvaluateResult` with `raw_findings` + `interactions`.

### T194: Analysis output tools (produce_finding, mark_pass, mark_needs_review)
- **dep:** T024 (MCPServer)
- **spec:** §33.4 (analysis-specific tools 13-15)
- **files:** `packages/agent-core/src/mcp/tools/produceFinding.ts`, `markHeuristicPass.ts`, `markHeuristicNeedsReview.ts`
- **smoke test:** Each tool callable via MCP, returns structured response, validates against Zod schema
- **acceptance:** 3 tools registered in `analyze_interactive` tool set. Zod-validated input/output.

### T195: Tool injection matrix + BrowserToolInjector
- **dep:** T024 (MCPServer), T193
- **spec:** REQ-COMP-001, REQ-COMP-010
- **files:** `packages/agent-core/src/mcp/BrowserToolInjector.ts`
- **smoke test:** `getToolsForContext({mode: "analyze", compositionMode: "interactive"})` returns exactly 15 tools (9 browser + 6 analysis)
- **acceptance:** Injector returns correct tool set per context. Browse tools bound to active session. Navigation tools excluded.

### T196: Navigation guard (2-layer)
- **dep:** T006 (BrowserManager), T193
- **spec:** REQ-COMP-012, REQ-COMP-012a
- **files:** `packages/agent-core/src/safety/NavigationGuard.ts`
- **smoke test:** Layer 1: `inspectClickTarget` on `<a href="/other-page">` returns `safe: false`. Layer 2: `verifyNoNavigation` detects URL path change after JS-triggered navigation, recovers via goBack.
- **acceptance:** Both layers work. Hash/query changes allowed. Path changes blocked. Recovery works.

### T197: Enter key reclassification
- **dep:** T071 (ActionClassifier)
- **spec:** REQ-COMP-011a
- **files:** Edit `packages/agent-core/src/safety/ActionClassifier.ts`
- **smoke test:** `classifyAction({toolName: "browser_press_key", toolArgs: {key: "Enter"}, callingNode: "analyze"})` with focused form input returns `"sensitive"`
- **acceptance:** Enter key in form = sensitive (blocked during analysis). Enter key outside form = caution (allowed).

### T198: HeuristicInteractionTracker
- **dep:** T193
- **spec:** REQ-COMP-062, REQ-COMP-062a, REQ-COMP-062b
- **files:** `packages/agent-core/src/analysis/HeuristicInteractionTracker.ts`
- **smoke test:** Tracker allows 2 interactions per heuristic (standard), blocks 3rd. Advances heuristic pointer on `produce_finding` call.
- **acceptance:** Per-heuristic cap enforced. Fallback attribution works for skipped signals.

### T199: Pass 2 open observation pipeline
- **dep:** T193, T128 (SelfCritiqueNode)
- **spec:** REQ-COMP-040, REQ-COMP-041, REQ-COMP-042, REQ-COMP-042a, REQ-COMP-043
- **files:** `packages/agent-core/src/analysis/nodes/OpenObservationNode.ts`, `packages/agent-core/src/analysis/prompts/openObservation.ts`
- **smoke test:** Pass 2 produces 1-5 observations with synthetic `OPEN-OBS-*` IDs. All Tier 3. All `needs_consultant_review = true`.
- **acceptance:** Observations pass GR-001/GR-007 grounding. GR-005 skipped (REQ-COMP-042a). Dedup with Pass 1 findings.

### T200: GR-011 grounding rule (per-state data correctness)
- **dep:** T129-T131 (Grounding Rules), T185 (GR-009)
- **spec:** REQ-COMP-070, REQ-COMP-071
- **files:** `packages/agent-core/src/analysis/grounding/rules/GR011.ts`
- **smoke test:** Per-state finding with wrong `evaluated_state_id` rejected. Global finding passes trivially.
- **acceptance:** GR-011 validates state_id + element existence. Gated behind state_graph presence.

### T201: GR-010 grounding rule (workflow cross-step)
- **dep:** T129-T131 (Grounding Rules)
- **spec:** §21.6 REQ-WORKFLOW-GROUND-002
- **files:** `packages/agent-core/src/analysis/grounding/rules/GR010.ts`
- **smoke test:** Workflow finding referencing only 1 step rejected. Finding referencing 2+ steps passes.
- **acceptance:** GR-010 enforces cross-step minimum.

### T202: Workflow step restore + funnel state verification
- **dep:** T143 (AuditGraph), T193
- **spec:** REQ-COMP-022a, REQ-COMP-022b
- **files:** `packages/agent-core/src/orchestration/WorkflowStepRestore.ts`
- **smoke test:** After interactive analysis on cart page, reload preserves cart items. `verifyFunnelState` detects empty cart.
- **acceptance:** Reload + funnel state check. Workflow abandoned on state loss.

### T203: Session contamination tracking
- **dep:** T143 (AuditGraph), T193
- **spec:** REQ-COMP-063, REQ-COMP-064
- **files:** `packages/agent-core/src/orchestration/SessionContaminationDetector.ts`
- **smoke test:** In workflow mode, analysis attempts `browser_click` on "Add to Cart" — blocked by transition detection.
- **acceptance:** Transition actions blocked during analysis. Contamination events logged.

### T204: Context window management + message pruning
- **dep:** T193
- **spec:** REQ-COMP-066
- **files:** `packages/agent-core/src/analysis/ContextWindowManager.ts`
- **smoke test:** After 10 tool-use turns, oldest interaction results summarised to 1 line each. Token count stays below 80% of model limit.
- **acceptance:** State-delta compression works. Token budget enforced. Pruning doesn't lose critical evidence.

### T205: Composition state extensions
- **dep:** T135 (AuditState)
- **spec:** REQ-COMP-080, §33.13
- **files:** Edit `packages/agent-core/src/orchestration/AuditState.ts`
- **smoke test:** All §33 fields compile with defaults. `composition_mode = "interactive"` activatable. Invariants validated.
- **acceptance:** All REQ-COMP-INV-001 through 005 enforced.

### T206: restore_state node activation
- **dep:** T143 (AuditGraph), T205
- **spec:** REQ-COMP-090, §33.15
- **files:** Edit `packages/agent-core/src/orchestration/nodes/RestoreStateNode.ts`
- **smoke test:** After interactive analysis (interaction_count > 0), page reloads and URL matches. Static mode: no-op.
- **acceptance:** Reload + stability wait + URL verification. 10s timeout with fallback.

### T207: Interaction screenshot storage
- **dep:** T193, T077 (ScreenshotStorage)
- **spec:** REQ-COMP-080a
- **files:** Edit `packages/agent-core/src/analysis/nodes/AnnotateNode.ts`
- **smoke test:** InteractionRecord with screenshot_ref stored in R2. Finding detail shows interaction evidence.
- **acceptance:** Interaction screenshots persisted. R2 key format follows convention.

### T208: Phase 11 integration test
- **dep:** T193-T207
- **spec:** §33 end-to-end
- **files:** `packages/agent-core/tests/integration/phase11-composition.test.ts`
- **smoke test:** Full audit with `composition_mode = "interactive"` on amazon.in PDP. Produces findings from both static and interactive evaluation. Pass 2 produces at least 1 open observation.
- **acceptance:** Interactive composition works end-to-end. Static mode unchanged. Workflow mode works with step restore.

### T209: Dual-mode evaluation acceptance test
- **dep:** T208
- **files:** `packages/agent-core/tests/acceptance/dual-mode.test.ts`
- **smoke test:** Compare findings from static vs interactive mode on same page. Interactive finds at least 2 additional state-dependent findings.
- **acceptance:** Interactive mode produces higher-quality findings. Cost within budget. Runtime within timeout.

### T210: Activate interactive mode as default
- **dep:** T209
- **spec:** REQ-COMP-050
- **files:** Edit `packages/agent-core/src/orchestration/AuditState.ts` — change `composition_mode` default from `"static"` to `"interactive"`
- **acceptance:** New audits default to interactive mode. Existing tests still pass (backward compatible).

### T211: Interactive evaluation cost model extension [NEW]
- **dep:** T118 (CostTracker), T193 (InteractiveEvaluateStrategy)
- **spec:** §26 REQ-COST-004, REQ-COST-005, REQ-COST-006
- **files:** Edit `packages/agent-core/src/analysis/CostTracker.ts`
- **smoke test:** Pre-flight estimation returns 3x multiplier for `composition_mode = "interactive"` standard, 7x for deep
- **acceptance:**
  - Pre-flight estimator checks `composition_mode`: static=1 LLM call, standard=~5, deep=~15
  - "Before evaluate" budget gate wraps ENTIRE ReAct loop (all turns), not just first call
  - Mid-loop budget exhaustion: complete current turn, emit partial findings, exit gracefully
  - Browser interaction overhead tracked: ~$0 LLM cost but ~1-3s latency per interaction logged

### T212: Composition-mode-aware activity timeout [NEW]
- **dep:** T193, Phase 9 Temporal integration
- **spec:** §27 activity timeout note
- **files:** Edit `packages/agent-core/src/orchestration/TemporalActivities.ts`
- **smoke test:** `runPageOrchestrator` activity uses 5min timeout in static mode, 7min in interactive standard, 10min in interactive deep
- **acceptance:**
  - `startToCloseTimeout` set dynamically based on `composition_mode` from AuditState
  - Heartbeat mechanism covers long-running interactive evaluate loops within timeout
  - Unit test: each mode gets correct timeout value

---

## §33a Interface Modifications to Earlier Phases

> These modifications are REQUIRED in Phases 2, 4, 5, 7, 8 to establish §33 interfaces. They add interface contracts and strategy patterns — NOT §33 functionality. See §33a for full specification.

| Task | Phase | Change | Spec |
|------|-------|--------|------|
| T024 (MCPServer) | 2 | Add `ToolRegistry` with `getToolsForContext(context)`. Register `browse` and `analyze` tool sets. Define 3 output tool schemas (stubs). | REQ-COMP-PHASE2-001, REQ-COMP-PHASE2-002 |
| T071 (ActionClassifier) | 4 | Accept `SafetyContext` parameter (with `callingNode` field). Default: `callingNode = "browse"`. | REQ-COMP-PHASE4-001 |
| T066 (BrowserManager) | 4 | Extract `BrowserSessionManager` with `create/get/close` methods. Sessions are external, not graph-internal. | REQ-COMP-PHASE4-002 |
| T081 (BrowseGraph) | 5 | Accept browser session via `state.browser_session_id` (injected by orchestrator), not created internally. Add `browser_session_id` to AuditState. | REQ-COMP-PHASE5-001, REQ-COMP-PHASE5-002 |
| T127 (EvaluateNode) | 7 | Use `EvaluateStrategy` interface with `StaticEvaluateStrategy` as default. Accept `BrowserSession | null`. Add §33 state fields with defaults. | REQ-COMP-PHASE7-001, REQ-COMP-PHASE7-002, REQ-COMP-PHASE7-003 |
| T143 (AuditGraph) | 8 | Pass `browser_session_id` from browse to analyze. Add `restore_state` node (no-op in static mode). | REQ-COMP-PHASE8-001, REQ-COMP-PHASE8-002 |

---

## Task Count Summary

| Phase | Tasks | IDs | New/Mod | Cumulative |
|-------|-------|-----|---------|-----------|
| Phase 0: Setup | 5 | T001-T005 | — | 5 |
| Phase 1: Perception | 10 | T006-T015 | — | 15 |
| Phase 2: Tools + Behavior | 35 | T016-T050 | 1 mod (§33a) | 50 |
| Phase 3: Verification | 15 | T051-T065 | — | 65 |
| Phase 4: Safety + Infra | 15 | T066-T080 | 2 mod (1 orig + 1 §33a) | 80 |
| Phase 5: Browse MVP | 20 | T081-T100 | 1 mod (§33a) | 100 |
| Phase 6: Heuristic KB | 12 | T101-T112 | 4 mod | 112 |
| Phase 7: Analysis Pipeline | 22 | T113-T134 | 1 mod (§33a) | 134 |
| Phase 8: Orchestrator | 21 | T135-T155 | 6 mod (5 orig + 1 §33a) | 155 |
| Phase 9: Master Foundations | 20 | T156-T175 | **20 new** | 175 |
| Phase 10: State Exploration | 18 | T176-T192 (+T191a) | **18 new** | 193 |
| Phase 11: Agent Composition | 20 | T193-T212 | **20 new** | **213** |

**v2.0 → v2.1 delta (§33 integration):**
- Phases 1-10 tasks modified for §33a interfaces: **6** (T024, T066, T071, T081, T127, T143)
- Phase 11 tasks added: **18** (T193-T210)
- **Total: 213 tasks across 11 phases**

---

## v1.0 → v2.0 Modification Index

For quick reference, every task that differs from v1.0:

| Task | Change type | What changed |
|------|-------------|-------------|
| T024 | Extended (§33a) | +ToolRegistry with `getToolsForContext()`, +3 output tool schemas |
| T066 | Extended (§33a) | +BrowserSessionManager with create/get/close |
| T070 | Extended | +5 new tables, ALTER TABLE on findings (+12 columns incl. source, analysis_scope, interaction_evidence), published_findings view |
| T071 | Extended (§33a) | +SafetyContext parameter with `callingNode` field |
| T081 | Extended (§33a) | +External browser session injection via `state.browser_session_id` |
| T101 | Extended | +HeuristicSchemaExtended with forward-compat fields |
| T103 | Extended | +preferred_states on ~8 heuristics, +rule_vs_guidance on ~10 |
| T104 | Extended | Same pattern as T103 |
| T105 | Extended | Same pattern as T103 |
| T127 | Extended (§33a) | +EvaluateStrategy interface, +StaticEvaluateStrategy, +BrowserSession|null param |
| T135 | Extended | +§5.7 state extension fields with defaults |
| T137 | Extended | +reproducibility snapshot read, +AuditRequest consumption |
| T143 | Extended (§33a) | +Session passing browse→analyze, +restore_state no-op node |
| T145 | Extended | +AuditRequest construction, +gateway call |
| T148 | Extended | +reproducibility, +scoring, +two-store, +audit_requests verification |
| T149 | Extended | Same additions as T148 |
| T150 | Extended | Same additions as T148 |
| T156-T175 | **New** | Master foundations: gateway, reproducibility, two-store, scoring, dashboard |
| T107 | Extended (v2.1) | Two-stage heuristic filtering: filterByBusinessType + filterByPageType |
| T137 | Extended (v2.1) | +Stage 1 heuristic filtering (filterByBusinessType) in audit_setup |
| T138 | Extended (v2.1) | +Stage 2 heuristic filtering (filterByPageType) in page_router |
| T160 | Extended (v2.1) | +loadAndValidateSnapshot() (gateway creates, audit_setup loads) |
| T161 | Extended (v2.1) | +evaluate_interactive to temperature guard node list |
| T165 | Extended (v2.1) | +priority formula parenthesis fix noted |
| T176-T192 | **New** | State exploration: types, rules, detection, Pass 1/2, graph, multi-state, GR-009 |
| T193-T212 | **New (§33)** | Agent composition: interactive evaluate, tool injection, dual-mode, nav guard, grounding rules, workflow restore, cost model, activity timeout |
