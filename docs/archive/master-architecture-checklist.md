---
title: master-architecture-checklist
artifact_type: architecture-spec
status: approved
loadPolicy: on-demand-only
version: 2.3
updated: 2026-04-24
governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R22 (The Ratchet)
note: Reference material. Do NOT load by default (CLAUDE.md Tier 3). Load only the single REQ-ID section cited by the current task.
---

# Master Architecture Validation Checklist

> **Purpose:** Cross-check the 263-task master plan against a complete-system checklist. Answers: "Does the master plan cover everything a real CRO audit platform needs?"
>
> **Update 2026-04-17 (master plan v2.3):** AnalyzePerception enriched with 14 consultant-grade fields (see §07.9.1). Several items previously marked 🟡 partial or ❌ missing in §4 Tool Inventory, §6 Classification Strategy, §8 Derived Features, §11 Validation, §14 Observability are now ✅ (page type confidence scores, iframes, accessibility primitives, Core Web Vitals INP/CLS/TTFB, trust signal provenance, urgency/scarcity pattern detection). See §20 Final Coverage Checklist for updated status.
>
> **Status legend:**
> - ✅ **PRESENT** — fully specified in source-of-truth specs, task IDs exist
> - 🟡 **PARTIAL** — some aspects covered, gaps noted inline
> - 🔀 **COVERED-DIFFERENTLY** — capability exists via a different mechanism than the checklist names (e.g., unified extractor instead of per-section extractors)
> - 📐 **PLANNED-POST-MVP** — in master plan but deferred past MVP
> - ❌ **MISSING** — not in master plan; real gap
>
> **Sources:**
> - Specs: `docs/specs/final-architecture/§01–§36` + `§33a`
> - Canonical: `AI_Browser_Agent_Architecture_v3.1.md`, `AI_Analysis_Agent_Architecture_v1.0.md`
> - Tasks: `docs/specs/mvp/tasks-v2.md` (T001–T262)
> - Design doc: `docs/superpowers/specs/2026-04-15-master-plan-refinement-design.md`
> - Constitution: `docs/specs/mvp/constitution.md` (R1–R16)
>
> **Date:** 2026-04-16
> **Version:** v2.2a checklist pass #1
> **Total sections:** 20

---

## 1. System Overview

| Item | Status | Source | Notes |
|---|---|---|---|
| Product goal | ✅ | PROJECT_BRIEF §1, §01-system-identity.md | "AI-powered CRO audit platform. Findings are hypotheses, not verdicts. Audits stay within $15 budget." |
| Primary use case | ✅ | PROJECT_BRIEF §1, §01 | CRO consultant runs audit → agent crawls + evaluates → consultant reviews findings → published to client dashboard |
| Supported audit types | ✅ | §19 Discovery & Templates + §21 Workflow | Single-page, full-site (up to 50 pages), competitor pairwise, funnel-workflow (continuous session), versioned re-audits (diff) |
| Target output quality standard | ✅ | §36, PROJECT_BRIEF §26, Constitution R15 | Golden test suite: TP ≥ 80%, FP ≤ 20%, no individual test < 60% TP. Defensibility: ≥ 90% finding overlap within 24 hrs on same inputs (§25) |
| Target page types | ✅ | §07 analyze-mode.md `PageType` enum | homepage, category, product (PDP), cart, checkout, account, search_results, landing, pricing, blog, other |
| Supported business types | ✅ | §05 unified-state, §19.5 | ecommerce, saas, leadgen, media (4 MVP). Set on `ClientProfile.business_type` at onboarding, NOT auto-detected |
| Desktop scope | ✅ | §07.9 viewport_context | 1440×900 default. Populated on every AnalyzePerception |
| Mobile scope | 📐 | Phase 12 (T227-T231) | 390×844 viewport. Master plan only. Explicitly excluded from MVP per HANDOVER |
| MVP scope vs full vision | 🟡 | HANDOVER Option A, design doc §3c | MVP boundary not yet formally extracted. Design doc §3c gives guidance but no `tasks-mvp-v1.md` exists yet |

**Gap callouts:**
- **G1.1** — MVP subset has NOT been extracted from the 263-task master plan. This checklist is a prerequisite; MVP extraction is the next step.
- **G1.2** — No written statement of non-goals (what the system explicitly will NOT do). Some implicit (GR-007 bans conversion predictions, no GA4 integration per design doc §4) but not consolidated.

---

## 2. End-to-End Runtime Flow

Verifying every step from trigger to report exists in specs.

| Step | Status | Node / Owner | Spec | Task IDs |
|---|---|---|---|---|
| Audit triggered | ✅ | `GatewayService.submit()` | §18 Trigger Gateway | T156-T159 |
| AuditRequest validated | ✅ | `validateRequest` | §18.7 REQ-TRIGGER-VALIDATE-002 | T157 |
| Reproducibility snapshot created | ✅ | Gateway (pre-workflow) | §25.4 REQ-REPRO-031 | T160 |
| Audit run persisted | ✅ | Gateway | §18 REQ-TRIGGER-PERSIST-003 | T158 |
| Client profile + heuristics loaded | ✅ | `audit_setup` node | §04 REQ-ORCH-NODE-001 | T137 |
| Stage 1 heuristic filter (by business type) | ✅ | `audit_setup` | §09.6 REQ-HK-020a | T137 (mod) |
| Page discovery | ✅ | `DiscoveryStrategy` adapter | Design §1.2 (v2.2a) | T256-T257 |
| Page queue built (prioritized, capped at 50) | ✅ | `audit_setup` | §04 page_queue | T137 |
| Audit budget initialized ($15) | ✅ | AuditState.budget_remaining_usd | §26, Constitution R8.1 | T137 |
| Page loop: page_router advances queue | ✅ | `page_router` | §04 routePageRouter | T138 |
| Stage 2 heuristic filter (by page type) | ✅ | `page_router` | §09.6 REQ-HK-020b | T138 (mod) |
| Browser session opened by orchestrator | ✅ | `BrowserSessionManager.create()` | §33a REQ-COMP-PHASE4-002, PHASE5-001 | T066, T081 |
| Browser launched with stealth | ✅ | `BrowserManager` + `StealthConfig` | §06.3, REQ-BROWSE-HUMAN-005/006 | T006, T007 |
| Target URL navigated | ✅ | `browser_navigate` tool | §08.3 | T020 |
| Page stabilized (mutation observer) | ✅ | `MutationMonitor` | §06, REQ-BROWSE-PERCEPT-005 | T011 |
| Overlays dismissed (cookies, modals, chat) | ✅ | `OverlayDismisser` (v2.2a) | §06.17 REQ-BROWSE-OVERLAY-001..006 | T255 |
| Rate limiter / bot detection handled | ✅ | `RateLimiter`, `CircuitBreaker` | §11.3, §06.12 | T049, T069 |
| CAPTCHA / login wall → HITL | ✅ | `agent_request_human` tool | §15 failure modes FM-04/05 | T042 |
| State exploration (Pass 1 heuristic-primed) | ✅ | `explore_states` node, Pass1Explorer | §20.3 REQ-STATE-EXPLORE-010..014 | T180 |
| State exploration (Pass 2 bounded-exhaustive) | ✅ | Pass2Explorer + 12 disclosure rules | §20.3 REQ-STATE-EXPLORE-030..042 | T182 |
| Meaningful-state detection | ✅ | `MeaningfulStateDetector` | §20.5 | T178 |
| State graph built + persisted | ✅ | StateGraphBuilder → `page_states` table | §20.4, §20.11 | T183 |
| MultiStatePerception synthesized | ✅ | Multi-state synthesizer | §20.6 | T184 |
| Page perceived (AX-tree + DOM + screenshots) | ✅ | `deep_perceive` + `page_analyze` | §07.4, §08 | T117, T048 |
| Page type auto-detected | ✅ | `detectPageType()` | §07.4 Page Type Detection | T114 |
| Per-state screenshots captured | ✅ | DeepPerceiveNode extended | §07.4a REQ-ANALYZE-NODE-001a..d | T191a |
| Perception quality gate (Step 1b, score ≥0.6 proceed) | ✅ | `PerceptionQualityScorer` | §07.10 REQ-ANALYZE-QUALITY-001..004 | T232-T233 |
| Heuristics evaluated (LLM, CoT) | ✅ | `evaluate` node + EvaluateStrategy | §07.5, §33 | T120, T127 |
| Benchmarks injected into evaluate prompt | ✅ | Prompt template v2.2 | §07.5 user message template | T215 |
| Persona context injected into evaluate | ✅ | Persona injection | §07.12 REQ-ANALYZE-PERSONA-001..004 | T258-T259 |
| Pass 2 open observation (static, max 5, Tier 3) | ✅ | OpenObservationNode | §33 REQ-COMP-040..043 | T199 |
| Self-critique (SEPARATE LLM call) | ✅ | `self_critique` node | §07.6 | T121 |
| Evidence grounding (12 rules, deterministic) | ✅ | `ground` node, GR-001..GR-012 | §07.7 + §20.10 + §36 (GR-012) | T122-T129, T185, T201, T200, T214 |
| Findings scored (4D: severity/confidence/impact/effort/priority) | ✅ | ScoringPipeline | §23.4 REQ-FINDINGS-SCORE-001..051 | T165-T167 |
| Finding suppression | ✅ | Suppression rules | §23.5 REQ-FINDINGS-SUPPRESS-001..002 | T168 |
| Annotated screenshots | ✅ | `annotate_and_store` + `page_annotate_screenshot` | §07.8, §08 | T131, T047 |
| Tier routing + warm-up override | ✅ | StoreNode + WarmupManager | §12, §24.4 | T163, T164 |
| Internal + published store | ✅ | Two-store pattern | §24 | T162, T164 |
| PageSignals emitted for cross-page | ✅ | Lightweight signals accumulator | Design §1.2 (v2.2a fix) | T217 |
| restore_state between pages | ✅ | `restore_state` node (composition-aware) | §33a REQ-COMP-PHASE8-002 | T143, T206 |
| Cross-page pattern detection | ✅ | PatternDetector (deterministic) | Design §1.2 | T217-T218 |
| Cross-page consistency check | ✅ | ConsistencyChecker (deterministic) | Design §1.2 | T219-T220 |
| Cross-page funnel analysis (LLM, $1 cap) | ✅ | FunnelAnalyzer | Design §1.2 | T221-T222 |
| `audit_complete` node | ✅ | AuditCompleteNode | §04 | T140, T235 |
| Executive summary generated | ✅ | ExecutiveSummaryGenerator | §35 REQ-REPORT-001..005 | T245-T246 |
| Action plan generated (4 quadrants) | ✅ | ActionPlanGenerator | §35 REQ-REPORT-010..012 | T247 |
| PDF report generated + stored in R2 | ✅ | ReportGenerator (Playwright page.pdf) | §35 REQ-REPORT-020..024 | T248-T249 |
| Notification sent (email) | ✅ | NotificationAdapter + Resend/Postmark | §14.8 REQ-DELIVERY-NOTIFY-001..003 | T260-T261 |
| Traces logged to LangSmith | 🟡 | LangSmith adapter referenced | §17 context preservation, R6.3 | No dedicated task; referenced in LLMAdapter |
| Structured logs emitted (Pino, JSON) | ✅ | Logger | §34.3 REQ-OBS-001..005 | T239 |
| Audit events emitted (22 types) | ✅ | Event emitter in every node | §34.4 REQ-OBS-010..014 | T240-T241 |
| Cost summary written to audit_runs | ✅ | CostTracker | §11.7 REQ-COST-010..014 | T225 |
| Checkpoint on crash / resume via BullMQ | ✅ | PostgreSQL checkpointer + BullMQ scheduler | §27 durable orchestration | T142 |

**Gap callouts:**
- **G2.1** — LangSmith tracing integration has no dedicated task. Referenced in R6.3 (redact heuristic content) but no explicit `LangSmithTracer` or trace setup task. Implied through LLMAdapter but should be a first-class observability concern alongside Pino logging.
- **G2.2** — No explicit task for "resume from checkpoint after crash" integration test. Phase 4 covers DB schema; Phase 9 covers gateway + snapshot; but a post-crash recovery smoke test is not enumerated.

---

## 3. Core Architecture Layers

| Layer | Status | Primary modules | File path | Maturity |
|---|---|---|---|---|
| Orchestration layer | ✅ | AuditState, AuditGraph, audit_setup, page_router, audit_complete | `packages/agent-core/src/orchestration/` | Specified, 0% coded |
| Browser control layer | ✅ | BrowserManager, BrowserSessionManager, StealthConfig, RateLimiter, CircuitBreaker | `packages/agent-core/src/browser-runtime/` | Specified, 0% coded |
| Extraction / perception layer | ✅ | AccessibilityExtractor, HardFilter, SoftFilter, MutationMonitor, ScreenshotExtractor, ContextAssembler, page_analyze | `packages/agent-core/src/perception/` + `mcp/tools/page_analyze.ts` | Specified, 0% coded |
| Interaction-state exploration layer | ✅ | StateGraph, DisclosureRules (R1-R12), MeaningfulStateDetector, Pass1Explorer, Pass2Explorer, StateRestorer, StateGraphBuilder, MultiStateSynthesiser | `packages/agent-core/src/exploration/` | Specified, 0% coded; Phase 10 |
| Classifier layer | ✅ | detectPageType (heuristic + signals). Business type: client profile lookup | `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` | Specified |
| Derived-feature layer | ✅ | AnalyzePerception (forms, ctas, trustSignals, layout fold, contrast, forms fields, etc.) via single page.evaluate() | `packages/agent-core/src/mcp/tools/pageAnalyze.ts` | Specified, 0% coded |
| Heuristic engine | ✅ | HeuristicSchema + Extended, HeuristicLoader, filterByBusinessType, filterByPageType, filterByViewport, encryption | `packages/agent-core/src/analysis/heuristics/` | Specified, 0% coded |
| LLM reasoning layer | ✅ | LLMAdapter (Anthropic primary / OpenAI fallback), LLMRateLimiter, LLMFailoverAdapter, TemperatureGuard, EvaluateNode, SelfCritiqueNode, FunnelAnalyzer | `packages/agent-core/src/adapters/` + `analysis/nodes/` | Specified, 0% coded |
| Validation layer | ✅ | EvidenceGrounder + 12 grounding rules (deterministic), Zod schemas at every external boundary, Suppression rules | `packages/agent-core/src/analysis/grounding/` | Specified, 0% coded |
| Reporting layer | ✅ | ExecutiveSummaryGenerator, ActionPlanGenerator, ReportGenerator (PDF), NotificationAdapter | `packages/agent-core/src/delivery/` | Specified, 0% coded |
| Observability layer | ✅ | Pino logger, audit_events emitter, HeuristicHealthMetrics materialized view, AlertingJob, Ops Dashboard | `packages/agent-core/src/observability/` + `apps/dashboard/console/admin/operations/` | Specified, 0% coded |
| Storage layer | ✅ | PostgreSQL (25+ tables, RLS), Redis/Upstash (rate limiter, BullMQ), Cloudflare R2 (screenshots, reports). Adapters: StorageAdapter, ScreenshotStorage | `packages/agent-core/src/db/` + `adapters/` | Specified, 0% coded |
| Config / knowledge-base layer | ✅ | heuristics-repo (private, AES-encrypted), IMPACT_MATRIX, EFFORT_MAP, MODEL_PRICING, RATE_LIMITS, DEFAULT_FUNNEL_POSITION | `heuristics-repo/` + `packages/agent-core/src/analysis/scoring/config.ts` | Specified, 0% coded |

**Maturity legend:** "Specified, 0% coded" = spec is locked, no TypeScript exists. All layers are in this state.

**Gap callouts:**
- **G3.1** — "Derived-feature layer" is intentionally subsumed by the single `page_analyze` tool (§08.6 REQ-TOOL-PA-001: one `page.evaluate()` call returns everything). There is NO separate "FeatureCalculator" module. Design choice, not a gap, but worth stating explicitly.
- **G3.2** — No explicit "classifier layer" module. Page type detection is a ~40-line function inside DeepPerceiveNode. Business type is NOT classified — it is read from ClientProfile. Works for MVP; may need a dedicated classifier if client onboarding is skipped later.

---

## 4. Tool Inventory

> **Design note:** Your checklist lists many fine-grained "extractor" tools (product-card, price, review, etc.) that the master plan intentionally collapses into ONE unified `page_analyze` tool. Per §08.6 REQ-TOOL-PA-001, a single `page.evaluate()` call returns the full AnalyzePerception in one DOM traversal. This is documented architectural choice — faster, fewer round-trips, easier to test. Items that are covered this way are marked 🔀 (covered-differently) with explanation.
>
> Similarly, specific state actions (open cart, open menu, expand accordion) are NOT dedicated tools — they are parameterized uses of `browser_click` / `browser_select` / `browser_hover` driven by (a) the disclosure rule library R1-R12 and (b) the `preferred_states` field on heuristics.

### 4.1 Browser tools (15 of your 15 covered)

| Tool | Status | Underlying MCP tool | Input | Output | Det/LLM | Task |
|---|---|---|---|---|---|---|
| Open URL | ✅ | `browser_navigate` | `{ url }` | `{ success, finalUrl }` | Det | T020 |
| Reload | ✅ | `browser_reload` | `{ waitUntil? }` | `{ success }` | Det | T023 |
| Go back | ✅ | `browser_go_back` | — | `{ success, url }` | Det | T021 |
| Wait for ready | ✅ | `browser_wait_for` + MutationMonitor | `{ selector? }` | `{ ready }` | Det | T040 + T011 |
| Dismiss popups | ✅ | `OverlayDismisser` (v2.2a) | auto | `{ dismissed, attempts }` | Det | T255 |
| Accept cookies | 🔀 | same as "Dismiss popups" | — | — | Det | T255 |
| Scroll | ✅ | `browser_scroll` + ScrollBehavior | `{ direction, elementRef?, amount? }` | `{ success }` | Det | T030 + T018 |
| Click | ✅ | `browser_click` + MouseBehavior (ghost-cursor) | `{ elementRef }` | `{ success }` | Det | T027 + T016 |
| Hover | ✅ | `browser_hover` | `{ elementRef }` | `{ success }` | Det | T032 |
| Type | ✅ | `browser_type` + TypingBehavior (Gaussian) | `{ elementRef, text, clearFirst? }` | `{ success }` | Det | T029 + T017 |
| Select | ✅ | `browser_select` | `{ elementRef, value }` | `{ success }` | Det | T031 |
| Keyboard press | ✅ | `browser_press_key` | `{ key, modifiers? }` | `{ success }` | Det | T033 |
| Open cart | 🔀 | `browser_click` on add-to-cart + `browser_find_by_text` + disclosure rule | — | — | Det | T027 + T038 + R9/R10 state rules |
| Open checkout | 🔀 | sequence of `browser_click` via workflow orchestrator | workflow steps | — | Det | T143 + §21 |

### 4.2 Capture tools

| Tool | Status | Underlying MCP tool | Output | Det/LLM | Task |
|---|---|---|---|---|---|
| Viewport screenshot | ✅ | `browser_screenshot` | JPEG base64 | Det | T025 |
| Full-page screenshot | ✅ | `page_screenshot_full` | JPEG, max 15000px, <2MB | Det | T046 |
| Element screenshot | 🟡 | Via `page_get_element_info` + cropping | Bounding box info returned; crop happens in annotate | Det | T044 (info), T131 (crop) |
| DOM snapshot | ✅ | `browser_get_state` (PageStateModel) + `page_analyze` (AnalyzePerception) | Filtered DOM, counts | Det | T024, T048 |
| Accessibility snapshot | ✅ | `browser_get_state` — AX-tree primary | AXNode[], filtered | Det | T008, T024 |
| Visible text extraction | ✅ | `page_analyze` → `textContent` section | paragraphs, headings, wordCount, readability | Det | T048 |
| Network capture | ✅ | `browser_get_network` | Request list | Det | T039 |
| Console capture | ✅ | `PageStateModel.diagnostics.consoleErrors` + `failedRequests` | Console errors + failed XHR | Det | T013, T024 |

**G4.2a** — "Element screenshot" is not a standalone tool — it happens during annotation. If the user wants a first-class element screenshot capture tool, a task is not enumerated. Low priority.

### 4.3 Extraction tools

| Tool | Status | Underlying | Notes |
|---|---|---|---|
| Page metadata extractor | ✅ | `browser_get_metadata` | title, canonicalUrl, meta description, ogTags, schemaOrg, lang (T026) |
| Semantic section extractor | ✅ | `page_analyze` → `semanticHTML` + `landmarks` | Returned as part of AnalyzePerception (T048) |
| Key-node extractor | 🔀 | SoftFilter (top 30 relevance-scored elements) + AnalyzePerception.ctas/forms/trustSignals | No dedicated "key-node" tool (T010 + T048) |
| Navigation extractor | ✅ | `page_analyze` → `navigation` section | primary nav items, breadcrumbs (T048) |
| CTA extractor | ✅ | `page_analyze` → `ctas` | With bounding box, computed styles, contrast ratio (T048) |
| Product-card extractor | 🔀 | `browser_extract` with schema | Generic DOM extractor with Zod schema — user supplies schema for product card shape (T036) |
| Price extractor | 🔀 | `browser_extract` or `page_analyze` → semantic HTML | No dedicated price tool; falls out of extract + textContent |
| Form extractor | ✅ | `page_analyze` → `forms` | fieldCount, labels, validation, required flags (T048) |
| Trust-signal extractor | ✅ | `page_analyze` → `trustSignals` | Auto-detected: reviews, badges, testimonials, certifications (T048) |
| Delivery / returns extractor | 🔀 | `browser_extract` with custom schema OR part of textContent | NOT a dedicated tool; CRO team would need to either (a) add to page_analyze signals OR (b) encode as heuristic benchmark check |
| Review extractor | 🔀 | `browser_extract` with schema + state exploration (R5 accordion) | Reviews often behind tab — state exploration captures them; `browser_extract` can read them |

**G4.3** — **Ecommerce-specific semantic extractors (product-card, price, delivery/returns, review) are NOT first-class.** They rely on the generic `browser_extract` tool + consultant-authored schemas OR emerge from the structured `page_analyze` output. This is fine for MVP (heuristics target generic signals like "trust signals present" not "review count >= 50") but worth noting.
- **If the CRO team needs review-count-based or price-comparison heuristics**, you will need to either:
  1. Extend AnalyzePerception with new sections (small schema change)
  2. Use `browser_extract` with a schema in the heuristic's pre-perception hook (not currently modeled)

### 4.4 State-exploration tools

These are all implemented as parameterized uses of existing browser tools + the 12-rule disclosure library (§20.3 REQ-STATE-EXPLORE-030).

| Action | Status | Implementation | Task |
|---|---|---|---|
| Menu open | ✅ | R3 disclosure rule (hamburger) via browser_click | T177 |
| Filter open / apply | ✅ | R7 (filter panel) + browser_click + browser_select | T177 |
| Sort change | ✅ | R7 + browser_select | T177 |
| Variant select | ✅ | R8 (variant swatch) + browser_click / browser_select | T177 + heuristic `preferred_states` |
| Add-to-bag attempt | ✅ | workflow sequence + browser_click | §21 workflow orchestration |
| Accordion expand | ✅ | R5 (accordion/FAQ) + browser_click | T177 |
| Mini-cart open | ✅ | R10 (cart icon) + browser_click | T177 |
| Checkout step advance | ✅ | workflow orchestrator (§21) + per-step browse+analyze | §21 |
| Validation-error capture | ✅ | Destructive interaction (form submission with empty values) → capture errors → restore via reload | §20.9 + R5/R7 |
| Cookie banner dismissal | ✅ | R11 cleanup rule | T255 |
| Chat widget dismissal | ✅ | R12 cleanup rule | T255 |
| Modal / overlay dismissal | ✅ | OverlayDismisser + R6 rule | T255 + T177 |

All twelve R-rules (R1 tabs, R2 pagination, R3 hamburger, R4 show-more, R5 accordion, R6 modal, R7 filter, R8 variant, R9 hover reveal, R10 mini-cart, R11 cookie, R12 chat) are enumerated in §20.3.

### 4.5 Analysis tools

| Tool | Status | Implementation | Det/LLM | Task |
|---|---|---|---|---|
| Business-type classifier | 🔀 | Read from ClientProfile at audit_setup (NOT auto-detected) | N/A | T137 |
| Page-type classifier | ✅ | `detectPageType()` function | Det (URL + signals heuristic) | T114 |
| Derived-feature calculator | ✅ | `page_analyze` returns everything in one call | Det | T048 |
| Deterministic heuristic checker | 🟡 | Grounding rules (GR-001..GR-012) are deterministic. But "deterministic heuristic pass/fail" for Tier 1 heuristics during partial analysis is enumerated. | Det | T165-T168, T233 (partial analysis) |
| LLM evaluator | ✅ | `evaluate` node + StaticEvaluateStrategy / InteractiveEvaluateStrategy | LLM | T120, T127, T193 |
| Prioritizer | ✅ | ScoringPipeline → `priority = (severity*2 + impact*1.5 + confidence*1 - effort*0.5)` | Det | T165 |
| Hypothesis generator | ✅ | §29 Hypothesis Pipeline (post-audit, from findings) | LLM | §29 (tasks not in MVP plan — post-audit) |
| Synthesis (cross-page) | ✅ | PatternDetector + ConsistencyChecker (det) + FunnelAnalyzer (LLM) | Mixed | T217-T222 |

### 4.6 Validation tools

| Tool | Status | Implementation | Det/LLM | Task |
|---|---|---|---|---|
| Schema validator | ✅ | Zod at every external boundary (LLM output, MCP I/O, API, DB rows) | Det | Throughout — Constitution R2 |
| Evidence validator (element exists, bounding box, etc.) | ✅ | GR-001, GR-002, GR-003, GR-008 | Det | T122-T129 |
| Contradiction checker | 🟡 | Self-critique Check 3 (logic check) catches contradictions. No dedicated pairwise contradiction tool | LLM (critique) | T121 |
| Confidence gating | ✅ | Suppression: confidence < 0.3 → reject; tier routing: Tier 1 auto / Tier 2 24hr / Tier 3 consultant | Det | T168 |
| Targeted re-check | ✅ | Self-critique escalation loop → Pass 2 state exploration | LLM + det | T189, §20.7 |
| Deterministic re-check policy | ✅ | 12 GR rules run AFTER self-critique; any failure rejects | Det | T129 |
| Unsupported-claim rejection | ✅ | GR-001 (element must exist) + GR-008 (data_point must reference real AnalyzePerception section) | Det | T122, T129 |
| Benchmark claim validation | ✅ | GR-012 (±20% for quantitative; reference text for qualitative) | Det | T214 |

### 4.7 Reporting tools

| Tool | Status | Implementation | Task |
|---|---|---|---|
| JSON output builder | ✅ | findings + executive_summary + cost_summary written to DB, exposed via MCP server (published view) | T148 (acceptance), T162 |
| Markdown report builder | 🟡 | Next.js report template (§35) is HTML, not markdown. Markdown not in plan. | T248 |
| PDF export builder | ✅ | ReportGenerator (HTML→PDF via Playwright page.pdf()) | T249 |
| Evidence appendix builder | ✅ | §35 Report Generation — appendix section includes full finding table + perception quality summary | T248 |
| Replay / debug pack builder | 🟡 | SessionRecorder (T072) + reproducibility snapshot (T160) + audit_events (T240). No dedicated "export replay bundle" CLI command. |

**Gap callouts:**
- **G4.7a** — No markdown report builder task. If consultants want copy-paste-to-doc markdown, add a task (small, reuses executive_summary + action_plan data).
- **G4.7b** — Replay bundle has all the raw data (session recording, snapshot, events) but no packaging/export command. Debug = query DB + R2 manually. OK for MVP, but think about adding `pnpm audit:export --run-id <id>` for post-mortems.

---

## 5. PageSnapshot / Data Contracts

Every major data object has a spec reference + Zod schema requirement per Constitution R2.

| Object | Status | Spec | File | Key fields |
|---|---|---|---|---|
| AuditRun | ✅ | §13.3 findings table + §18.4 AuditRequest | `packages/agent-core/src/db/schema.ts` | id, client_id, status, budget, cost_summary (JSONB), report_pdf_url, trigger_source, reproducibility_snapshot_id |
| AuditRequest | ✅ | §18.4 REQ-TRIGGER-CONTRACT-001 | `packages/agent-core/src/gateway/AuditRequest.ts` | target, scope, budget, heuristic_set, notifications, tags, reason, external_correlation_id, discovery_strategy |
| AuditState | ✅ | §05 unified-state.md (981 lines) + §5.7 + §5.8 | `packages/agent-core/src/orchestration/AuditState.ts` | messages, page_queue, current_mode, budget_remaining_usd, filtered_heuristics, analyze_perception, findings, page_signals, personas, etc. |
| PageSnapshot / PageStateModel | ✅ | §06 browse + §05 | `packages/agent-core/src/perception/types.ts` | metadata, accessibilityTree, filteredDOM, interactiveGraph, visual?, diagnostics |
| AnalyzePerception | ✅ | §07.9 AnalyzePerception Schema | `packages/agent-core/src/analysis/types.ts` | metadata (incl. viewport_context), headingHierarchy, landmarks, semanticHTML, textContent, ctas, forms, trustSignals, layout, images, navigation, performance |
| InteractionState / StateNode | ✅ | §05.7.1 StateNode + §20 | `packages/agent-core/src/exploration/types.ts` | state_id (sha256), url, interaction_path, discovered_in_pass, dom_hash, text_hash, is_default_state, parent_state_id, perception, screenshot_refs, trigger |
| DerivedFeatures | 🔀 | Subsumed in AnalyzePerception | N/A — single-pass extraction | No separate DerivedFeatures object; the computed signals (contrast ratio, fold position, word counts, readability scores) are fields on AnalyzePerception |
| HeuristicDefinition | ✅ | §09.1 base + §09.10 Extended + design §1.1 benchmark | `packages/agent-core/src/analysis/heuristics/schema.ts` | id, name, description, tier, source, page_type_applicability, business_type_applicability, viewport_applicability, version, rule_vs_guidance, business_impact_weight, effort_category, preferred_states, status, **benchmark** (required) |
| Finding (Raw / Reviewed / Grounded / Rejected) | ✅ | §05 + §07.5/7.6/7.7 + §23 extended | `packages/agent-core/src/analysis/types.ts` | heuristic_id, status, scope, observation, assessment, evidence, severity, recommendation, persona, confidence_tier, business_impact, effort, priority, source, analysis_scope, interaction_evidence, model_used, model_mismatch, viewport, state_ids, evaluated_state_id |
| PatternFinding / ConsistencyFinding / FunnelFinding | ✅ | Design §1.2 | `packages/agent-core/src/analysis/cross-page/types.ts` | per design doc |
| EvidenceRef | ✅ | Part of Finding.evidence | `analysis/types.ts` | element_ref, selector, data_point, measurement, page_refs (cross-page), state_id (multi-state) |
| LLMCallRecord | ✅ | Design §1.3 | `packages/agent-core/src/adapters/types.ts` | id, audit_run_id, page_url, node_name, heuristic_id, model, input_tokens, output_tokens, cost_usd, duration_ms, cache_hit, timestamp |
| AuditEvent | ✅ | §34.4 | `packages/agent-core/src/observability/types.ts` | 22 event types, metadata JSONB |
| ExecutiveSummary / ActionPlan | ✅ | §35.2, §35.3 | `packages/agent-core/src/delivery/types.ts` | per design doc |
| ReproducibilitySnapshot | ✅ | §25 | `packages/agent-core/src/reproducibility/types.ts` | prompt_versions (SHA256), model_versions, heuristic_set, normalizer_version, grounding_rule_set_version, scoring_version |
| PersonaContext | ✅ | Design §1.2 (v2.2a) | `packages/agent-core/src/analysis/personas/types.ts` | id, name, description, goals, frustrations, business_type_applicability |
| PageSignals | ✅ | Design §1.2 (v2.2a fix for state bloat) | cross-page types | page_url, page_type, cta_count, cta_texts, form_field_counts, trust_signal_types, nav_link_count, heading_texts, key_metric_violations, finding_heuristic_ids, finding_count, perception_quality_score |
| Report | ✅ | §35 (HTML + PDF) | `apps/dashboard/src/app/api/report/[audit_run_id]/render/page.tsx` + `ReportGenerator.ts` | 8 sections |

**Gap callouts:**
- **G5.1** — "DerivedFeatures" as a separate object does NOT exist in the master plan. The design decision (§08.6) is that features are fields on AnalyzePerception, computed in the same `page.evaluate()` call. If you want a persisted DerivedFeatures table for analytics, that's a new schema item.
- **G5.2** — Zod schemas must be written FIRST per R2.1/R2.2. Not yet written (0% code). Each task will add schemas at implementation time.

---

## 6. Classification Strategy

| Item | Status | Notes |
|---|---|---|
| How business type is identified | 🟡 | **Client-provided at onboarding**, stored on ClientProfile. NOT auto-detected per audit. Works for MVP (consultant knows client's business). If self-serve signups come later, a classifier is needed. |
| How page type is identified | ✅ | Auto-detected in `detectPageType()` — heuristic rules based on URL keywords + AnalyzePerception signals (CTAs, form presence, schema.org types, heading hierarchy) |
| Signals used (page type) | ✅ | URL path, textContent, CTA texts ("Add to Cart" → product), form presence, schema.org product/article markers, heading patterns |
| Rules + LLM fallback | 🟡 | Rules only for page type detection. LLM fallback NOT implemented for classification (page type must resolve deterministically). If page type ambiguous, classifier returns `"other"` and a reduced heuristic set applies. |
| Confidence scoring | ❌ | `detectPageType()` returns a PageType, not `{type, confidence}`. No confidence score on classification. |
| Fallback behavior when uncertain | 🟡 | Returns `"other"` enum value. Heuristic filter uses a minimal "other" heuristic set (generic ones). No HITL escalation for ambiguous page type. |

**Gap callouts:**
- **G6.1** — **No business-type classifier.** Acceptable for consultant-driven MVP (consultant sets `business_type` on client onboarding). Flag if you plan self-serve.
- **G6.2** — **No confidence score on page type classification.** Low priority — reduced heuristic set for "other" mitigates most miss-classification risk.
- **G6.3** — **No LLM fallback for classification.** Explicit design choice per §07.4. LLM costs money; rules are fast and reliable enough.

---

## 7. Interaction-State Strategy

| Item | Status | Spec |
|---|---|---|
| What counts as an interaction state | ✅ | §05.7.1 StateNode + §20.5. Default state + any meaningful state after interaction (tabs, accordions, modals, filter/sort, variant selection, etc.). Cookie/chat dismissal do NOT count as states (REQ-STATE-EXPLORE-013c) |
| Meaningful-state criteria | ✅ | §20.5 REQ-STATE-EXPLORE-060: text Jaccard > 0.15 OR new interactive elements > 3 OR above-fold diff > 10% OR CTA set changed. Default state always meaningful. |
| Which states are explored per page type | ✅ | Two-pass. Pass 1: from heuristic `preferred_states` (page-type-specific). Pass 2: 12 disclosure rules R1-R12 applied systematically. |
| How states are prioritized | ✅ | Pass 1 (heuristic-primed) runs first, then Pass 2 if escalation triggers fire. Within Pass 2: R11 cookie + R12 chat first (cleanup), then R1..R10. Self-restoring interactions executed sequentially; destructive scheduled LAST. |
| How duplicate states are avoided | ✅ | Deduplicated by state_id (sha256 of canonicalJSON({url, interactions})). Pass 2 skips elements already explored in Pass 1 (matched by target_ref). REQ-STATE-EXPLORE-033. |
| When exploration stops | ✅ | Caps enforced: 15 states/page, depth 2, 25 interactions, $0.50 budget, 1 LLM fallback call. When ANY cap hit → state graph marked `truncated = true` with reason. REQ-STATE-EXPLORE-090. |
| How evidence is attached to state transitions | ✅ | `interaction_path` on StateNode (array of interactions from default → this state). `state_provenance` maps merged_view elements → source state_id. GR-009 validates findings cite elements with correct provenance. §20.6 + §20.10. |
| Restoration strategy | ✅ | §20.9: Self-restoring (tab clicks) → no restoration needed. Destructive (form submit) → click-to-close / go_back / reload (5s timeout, reload is universal fallback). Destructive scheduled last to minimize restoration churn. |
| Escalation loop (analysis requests more exploration) | ✅ | §20.7 REQ-STATE-EXPLORE-080..082. Max 1 cycle per page. Cost tracked separately. |
| GR-009 state provenance grounding | ✅ | §20.10, T185 |
| GR-011 per-state data correctness (composition) | ✅ | §33 REQ-COMP-070..071, T200 |

**Gap callouts (none — state exploration is the most thoroughly specified area):**
- Every item on your checklist is covered. §20 is 538 lines; it is the second-largest spec after §33 and §07. State exploration is an obsession in this architecture, not a weak area.

---

## 8. Derived Features Strategy

| Item | Status | Notes |
|---|---|---|
| What derived features exist | ✅ | Per AnalyzePerception: heading hierarchy, landmark count, word count, readability score, CTA bounding boxes, CTA computed styles, contrast ratio (CTA vs background), form field count + labels + validation flags, trust signal types, fold position, visual hierarchy score, whitespace ratio, image alt text + lazy load, navigation structure, performance (DOMContentLoaded + LCP) |
| Page-type specificity | ✅ | All features present on all page types (single schema). Page type governs which heuristics run, not which features are computed. |
| How computed | ✅ | Deterministically in single `page.evaluate()` call (§08.6 REQ-TOOL-PA-001). Zero LLM involvement. |
| Deterministic only or mixed | ✅ | **Deterministic only.** No LLM in feature extraction. |
| Versioning | 🟡 | AnalyzePerception schema not explicitly versioned. Relies on git hash + ReproducibilitySnapshot's `normalizer_version`. |
| Downstream consumers | ✅ | (a) evaluate node (LLM prompt), (b) grounding rules (GR-001..GR-012), (c) scoring pipeline (business_impact from IMPACT_MATRIX via page_type), (d) PageSignals accumulator (cross-page), (e) perception quality scorer |

**Gap callouts:**
- **G8.1** — AnalyzePerception schema evolution path not formalized. Additive changes safe. Breaking changes would require migration + re-run. Low priority but document if multi-version support needed.

---

## 9. Heuristic Engine

| Item | Status | Notes |
|---|---|---|
| Heuristic sources | ✅ | Baymard (50), Nielsen (35), Cialdini (15) = 100 total. +10-15 mobile in Phase 12. |
| Storage format | ✅ | JSON files in private `heuristics-repo/` (separate git repo). AES-256-GCM encrypted at rest. Decrypted in memory. Constitution R6.1/6.2. |
| Page-type-specific rules | ✅ | `page_type_applicability` field filters which heuristics apply per page. Stage 2 filter in page_router (§09.6 REQ-HK-020b). |
| Business-type-specific rules | ✅ | `business_type_applicability` field. Stage 1 filter in audit_setup (§09.6 REQ-HK-020a). |
| Viewport-specific rules | ✅ | `viewport_applicability` (desktop/mobile/both). Stage 3 filter in Phase 12 (T230). |
| Severity model | ✅ | 4 levels: critical / high / medium / low. Set on heuristic; may be downgraded by self-critique. Constitution R5.7: critical/high REQUIRE measurable evidence (GR-006). |
| Pass/fail vs scored checks | ✅ | Each finding has `status: "violation" | "pass" | "needs_review"`. Pass findings feed "strengths" in executive summary. |
| Deterministic vs interpretive | ✅ | Deterministic: benchmark validation (GR-012), structural heuristics (tap target size, form field count, fold position). Interpretive: content tone, persuasion, heuristic applicability. Tier 1 = deterministic+interpretive blend with measurable evidence; Tier 3 = purely interpretive (needs consultant review). |
| Evidence required | ✅ | Every finding MUST include `evidence: { element_ref, selector, data_point, measurement? }`. Empty evidence → suppressed (T168). Critical/high severity REQUIRES measurement (GR-006). |
| Benchmark schema | ✅ | REQUIRED on all 100 heuristics. Discriminated union: quantitative (value, source, unit, comparison, threshold_warning, threshold_critical) OR qualitative (standard, source, positive_exemplar, negative_exemplar). Design §1.1. |
| IP protection | ✅ | Constitution R6: content never in API responses / dashboards / traces. Only heuristic_id exposed. AES-256-GCM at rest. Redacted in LangSmith. |
| Two-stage filter (business → page) | ✅ | §09.6 REQ-HK-020a + REQ-HK-020b, T137, T138 |
| Tier system | ✅ | Tier 1 (~42 visual/structural, >75% reliable, auto-publish), Tier 2 (~42 content/persuasion, ~60%, 24hr delay), Tier 3 (~16 interaction/emotional, <40%, consultant required). PROJECT_BRIEF §7. |
| Injection into LLM | ✅ | USER MESSAGE (not system prompt, not tool call). Constitution R5.5. Per-heuristic benchmarks injected inline. |
| Prioritization / cap | ✅ | `prioritizeHeuristics(filtered, 30)` caps per-page heuristic count at 30 to control prompt size and cost. |
| `preferred_states` hook | ✅ | Heuristic authors can declare: "this heuristic requires the reviews tab open." Pass 1 explorer uses this to drive state exploration. §09.10, §20.3. |

**Gap callouts (none — heuristic engine is fully specified):**
- **Critical dependency**: Phase 0b (CRO team authors heuristics) must start Day 1 to be ready by Phase 6. The engineering spec is complete; the CRO content is not.

---

## 10. LLM Usage

| Usage | Status | Where | Input | Output schema | Temp | Budget | Notes |
|---|---|---|---|---|---|---|---|
| Classification fallback | ❌ | NOT USED | — | — | — | — | Page type via rules only (§07.4). Business type from ClientProfile. |
| Interpretive evaluation | ✅ | `evaluate` node | AnalyzePerception + 15-30 filtered heuristics + benchmarks + personas + filtered PageSignals (master plan) | Zod-validated `RawFinding[]` | 0 | ~$0.15/page static, $1.05-1.80/page interactive | Constitution R2.2 + R10 |
| Self-critique | ✅ | `self_critique` node | RawFinding + AnalyzePerception | ReviewedFinding with critique_verdict (KEEP/REVISE/DOWNGRADE/REJECT) | 0 | ~$0.05/page | SEPARATE call with DIFFERENT persona (R5.6) |
| Prioritization | ❌ | Deterministic | — | — | — | — | Purely formula-based (ScoringPipeline). No LLM in prioritization. |
| Recommendation writing | 🟡 | Part of `evaluate` | Same as evaluate | RawFinding.recommendation field | 0 | — | Inline with finding production, not a separate call |
| Experiment hypothesis generation | ✅ | §29 Hypothesis Pipeline | Grounded findings | HypothesisCard[] | 0 | — | §29 exists as spec. NOT in 263-task plan — deferred post-MVP |
| Funnel synthesis | ✅ | `FunnelAnalyzer` (cross-page) | PageSignals + findings + funnel_definition | FunnelFinding[] | 0 | $1 cap | Single LLM call per audit. All Tier 2 (24hr delay) |
| Executive summary recommended-next-steps | ✅ | ExecutiveSummaryGenerator | Top findings + category breakdown | `recommended_next_steps: string[]` (3-5 sentences) | 0 | $0.10 cap | 1 LLM call per audit |
| Pass 2 open observation | ✅ | OpenObservationNode | AnalyzePerception (no heuristics) | RawFinding[] with synthetic OPEN-OBS-* IDs | 0 | Max 5 findings | All Tier 3. Static mode only (REQ-COMP-042a). |
| Interactive ReAct loop | ✅ | InteractiveEvaluateStrategy | Incrementally accumulated via tool-use | RawFinding + interactions | 0 | Budget-gated | Phase 11 activation |

### LLM Guardrails

| Guardrail | Status | Where |
|---|---|---|
| Input context hygiene | ✅ | Heuristics in user message (R5.5). Sensitive data redaction (R6). |
| Output schema enforced | ✅ | Zod validates every LLM response before use. Malformed → retry once then fail gracefully (§07.11 recovery matrix). |
| Prompt guardrails | ✅ | System prompt in §07.5 mandates: OBSERVE → ASSESS → EVIDENCE → SEVERITY structure. No conversion predictions. No evidence fabrication. |
| Hallucination controls | ✅ | 3-layer filter: CoT (~50%) → Self-critique (~30%) → Evidence grounding 12 rules (~95%). PROJECT_BRIEF §5. |
| Temperature enforcement | ✅ | `TemperatureGuard` runtime wrapper. Throws if eval/self_critique/eval_interactive called with temp ≠ 0. Constitution R10. |
| Rate limiting | ✅ | §11.8 LLMRateLimiter (sliding window Redis per provider). |
| Failover | ✅ | Primary Claude 3 retries → fallback GPT-4o 2 retries. Per-call, not sticky. |
| Cost gating | ✅ | Pre-call `getTokenCount()` estimate vs remaining budget. Skip or split batch if too expensive. |
| Per-call logging | ✅ | Every call logged atomically to `llm_call_log` with actual tokens + cost. Constitution R14.1. |
| Model mismatch tagging | ✅ | Findings generated by fallback tagged `model_mismatch = true`. Badge shown in review UI. |

**Gap callouts:**
- **G10.1** — No dedicated "recommendation rewriter" LLM call. Recommendations are generated inline with findings in `evaluate`. If consultants want higher-quality recommendations post-audit, a dedicated pass could be added.

---

## 11. Validation and Grounding

| Item | Status | Implementation |
|---|---|---|
| Schema validation | ✅ | Zod at every external boundary per Constitution R2.2 (LLM out, MCP I/O, API, DB, adapter return) |
| Evidence requirements | ✅ | GR-001 (element exists), GR-008 (data_point refs real section), GR-006 (critical/high need measurement) |
| Contradiction checks | 🟡 | Self-critique Check 3 (logic check). Not a dedicated deterministic contradiction engine. Sufficient for MVP. |
| Confidence thresholds | ✅ | Suppression: confidence < 0.3 rejected. Tier routing: Tier 1 → auto / Tier 2 → 24hr / Tier 3 → consultant. |
| Secondary verification pass | ✅ | Self-critique (separate LLM, different persona, 5 checks). Then evidence grounding (deterministic, NO LLM). |
| Deterministic re-check policy | ✅ | 12 grounding rules run after self-critique. Any single failure rejects the finding with reason logged. |
| Unsupported-claim rejection | ✅ | GR-001, GR-008. Rejected findings persist to `rejected_findings` table with rule_id, making rejections auditable. |
| Benchmark claim validation | ✅ | GR-012 (v2.2). ±20% tolerance for quantitative; reference text match for qualitative. |
| No conversion predictions | ✅ | GR-007 absolute ban. Constitution R5.3. Phrases like "increase conversions by X%" rejected. |
| Three-layer filter | ✅ | Layer 1 CoT (~50% false positive reduction) → Layer 2 Self-critique (~30% of remaining) → Layer 3 Evidence grounding (~95% of remaining) |
| State provenance | ✅ | GR-009 (Phase 10) + GR-011 (Phase 11 per-state composition) |
| Workflow cross-step | ✅ | GR-010 (Phase 11 workflow mode) |
| Append-only rejection log | ✅ | `rejected_findings` table, Constitution R7.4. Never UPDATE/DELETE. |
| Golden test regression | ✅ | §36 golden suite. Nightly drop >10% vs 7-day rolling avg → P1 alert. Blocks deployment. |

**Gap callouts:**
- **G11.1** — Contradiction checking is not deterministic — it relies on LLM self-critique. If two findings on the same page contradict each other directly (e.g., "CTA is above fold" vs "CTA is below fold"), you depend on the LLM to notice. Low priority but could be added as a deterministic post-grounding check.

---

## 12. Output Format

| Output | Status | Format | Spec |
|---|---|---|---|
| Machine-readable JSON | ✅ | Via MCP server (9 tools) + REST API (Hono) + direct DB queries | §14 Delivery |
| Consultant-readable report | ✅ | HTML (Next.js route) → PDF (Playwright). 8 sections: cover / exec summary / action plan / findings by category / cross-page patterns / funnel / methodology / appendix. | §35 REQ-REPORT-020..024 |
| Markdown | ❌ | Not specified. Minor gap. See G4.7a. |
| Evidence appendix | ✅ | Appendix section in PDF: full finding table + perception quality summary per page | §35 |
| Screenshots / artifacts | ✅ | Annotated screenshots in R2 at `/{client_id}/audit_runs/{run_id}/{page_id}/{type}.jpg`. Viewport + fullpage per state. | §07.8 + §13 |
| Replay bundle | 🟡 | Data exists (session recording + snapshot + events) but no pre-built export tool | G4.7b |
| Required fields | ✅ | All Zod-enforced |
| Optional fields | ✅ | All optional fields explicitly marked `| null` or `.optional()` in schemas |
| Score format | ✅ | ExecutiveSummary.overall_score: 0-100 integer; overall_grade: A/B/C/D/F. Formula: `100 - (critical×15 + high×8 + medium×3 + low×1)` clamped. §35. |
| Confidence format | ✅ | Tier enum + numeric confidence ∈ [0.0, 1.0]. Invariant enforced. |
| Citation / evidence format | ✅ | `evidence.element_ref` + `evidence.selector` + `evidence.data_point` (e.g., `ctas[0]`, `forms[1].fields[2]`). Machine-parseable. |

---

## 13. Storage and Persistence

| Store | Status | Contents |
|---|---|---|
| PostgreSQL 16 + pgvector | ✅ | 25+ tables: clients, audit_runs, findings (+ 12 extension columns), screenshots (metadata only), sessions, audit_log (append-only), rejected_findings (append-only), page_states, state_interactions, finding_rollups, reproducibility_snapshots (with immutability trigger), audit_requests, templates, workflows, domain_patterns (pgvector), llm_call_log, audit_events, finding_edits |
| Redis / Upstash | ✅ | BullMQ queues, LLM rate limiter sliding windows, session cache |
| Cloudflare R2 | ✅ | All screenshots (viewport, fullpage, annotated, per-state), PDF reports, HTML report templates. Never base64 in DB (R7.3). |
| Transient state | ✅ | LangGraph.js AuditState during execution (in-memory during run, checkpointed to Postgres) |
| Durable state | ✅ | Postgres (findings, runs, snapshots, events) + R2 (media) |
| Resume / retry | ✅ | PostgreSQL checkpointer for LangGraph (crash recovery). BullMQ retry queue for audit-level pause/resume (3 attempts over 15 min when LLM down). Temporal for durable orchestration Phase 6+. |
| RLS enforcement | ✅ | Row-level security on all client-scoped tables. `app.client_id` + `app.access_mode` session variables set via `SET LOCAL` in transactions. Constitution R7.2. |
| Append-only policy | ✅ | audit_log, rejected_findings, finding_edits, llm_call_log, audit_events — NEVER UPDATE/DELETE. Constitution R7.4. |
| Reproducibility immutability | ✅ | DB trigger prevents mutation of reproducibility_snapshots. §25.4. |

---

## 14. Observability and Replay

| Item | Status | Where |
|---|---|---|
| Structured logs | ✅ | Pino JSON with mandatory correlation fields (audit_run_id, client_id, page_url, node_name, heuristic_id, trace_id). §34.3. T239. |
| Traces | 🟡 | LangSmith referenced for LLM traces but no dedicated integration task. ~$39/mo budget noted. |
| Metrics | ✅ | HeuristicHealthMetrics (materialized view, nightly refresh). Audit-level metrics: duration, cost, completion rate, grounding rejection rate, cache hit rate. §34.5. T242. |
| Screenshots | ✅ | Viewport + fullpage + per-state + annotated, stored in R2. §07.8. |
| Action history | ✅ | SessionRecorder T072 + audit_events table (22 types) + state_interactions table |
| DOM snapshots | ✅ | PageStateModel + AnalyzePerception captured per page per state |
| Run replay capability | 🟡 | Raw data all persisted. Query-by-run-id via DB. No CLI export tool (G4.7b). |
| Audit events | ✅ | 22 event types, appended real-time. Powers SSE streaming + post-hoc analysis. §34.4. T240-T241. |
| Alerting | ✅ | BullMQ job every 5 min checks 7 rules. Warnings + critical. §34.6. T243. |
| Ops dashboard | ✅ | `/console/admin/operations` — active audits, 24h stats, heuristic health, alerts, cost trend. Admin only. Build LAST in Phase 9. T244. |
| SSE streaming to dashboards | ✅ | StreamEmitter T076. audit_events feed it. |

**Gap callouts:**
- **G14.1** — LangSmith setup not a dedicated task. Add a small task or include in LLMAdapter setup.
- **G14.2** — No `pnpm audit:export --run-id <id>` CLI for packaging a debug bundle. Raw data is queryable but not pre-packaged.

---

## 15. Reliability / Failure Handling

| Item | Status | Implementation |
|---|---|---|
| Retry policies | ✅ | Browse: transient → 3x retry. LLM: primary 3 retries → fallback 2 retries → LLMUnavailableError. BullMQ: 3 resume attempts. §15, §11.9. |
| Timeout policies | ✅ | Restoration 5s. LLM 60s (evaluate). Temporal activities: 5min static / 7min interactive / 10min deep (T212). Audit-level: alert >45min, critical >90min. |
| Fallback selectors | ✅ | DOM fallback → AX-tree fallback → vision fallback (Mode C). §06 browse mode three execution modes. |
| Popup / overlay handling | ✅ | OverlayDismisser (T255) + R11/R12 disclosure rules. 12 common selector patterns. Non-fatal on failure. |
| Iframe handling | 🟡 | Playwright handles iframes natively. AX-tree extraction may miss cross-origin iframes. Not specifically called out as a failure mode. |
| Shadow DOM handling | 🟡 | Not explicitly specified. Playwright has shadow DOM support; `page.evaluate()` within AnalyzePerception should handle it. Not a tested scenario. |
| Lazy loading | ✅ | ScrollBehavior (T018) triggers lazy-load. MutationObserver waits for stability. |
| Anti-flakiness rules | ✅ | Verify every action (9 verify strategies). Confidence decay (multiplicative). Stable perception requires mutation settlement. §06.4. |
| Partial audit behavior | ✅ | Every page gets analysis_status. Enum: complete / partial / perception_insufficient / budget_exceeded / llm_failed / grounding_rejected_all / failed. No silent drops. §07.11. |
| Low-confidence behavior | ✅ | <0.3 → reject; 0.3-0.7 → continue with decay; <0.7 for threshold → HITL. §06 + §23. |
| LLM unavailable | ✅ | 3+ consecutive page failures → audit pauses → BullMQ resume in 5 min (3 attempts). No degraded deterministic-only mode (deliberate choice). §11.9. |
| Bot detection | ✅ | Stealth plugin + ghost-cursor + fingerprint rotation. CircuitBreaker: 3 failures → 1hr domain block. Fallback to HITL. §06, §15. |
| Budget exhaustion | ✅ | Hard kill-switch. audit-level $15, page-level $5, exploration $0.50. Constitution R8. |
| Audit never silently drops | ✅ | Every page gets status. Every non-complete page has reason. Completion report shows breakdown (T235). Constitution R15.2. |
| Checkpoint recovery | ✅ | PostgreSQL checkpointer for LangGraph. Temporal Phase 6+. |

**Gap callouts:**
- **G15.1** — **Iframe handling** not specified as an explicit failure mode. If audit pages embed cross-origin iframes (e.g., Stripe checkout iframe on cart page), perception may not see iframe content. Recommend adding to §15 failure modes.
- **G15.2** — **Shadow DOM** not specified. Modern React sites (e.g., Shopify storefronts with custom web components) may use shadow DOM. Playwright supports it but `page_analyze`'s `page.evaluate()` needs `pierce:` selectors or recursive traversal. Verify during Phase 1 implementation.

---

## 16. Security / Compliance / Safety Boundaries

| Item | Status | Implementation |
|---|---|---|
| Domains allowed / disallowed | ✅ | DomainPolicy (T068): allowlist (trusted, relaxed rate limits) + blocklist (blocked, HITL) + default (unknown, strict). §11.3. |
| Authentication handling | 🟡 | Login walls → HITL escalation (FM-05 in §15). System does NOT auto-login. Browser sessions support cookie persistence between pages but not credential input. OK for public sites; weak for authenticated audits. |
| PII handling | 🟡 | Design note (PROJECT_BRIEF §27.5): screenshots are of public pages, forms NOT filled with real PII. Not explicitly enforced by code. Low real risk but not defended in depth. |
| Secrets management | 🟡 | `.env.example` documented. No explicit secrets rotation or vault integration. Clerk handles auth secrets. LLM API keys in env. OK for MVP; needs hardening for enterprise. |
| Rate limits (browse) | ✅ | 2s min interval, 10/min unknown domains, 30/min trusted. §11.3. robots.txt respected (REQ-RATE-002). |
| Rate limits (LLM) | ✅ | Anthropic 50 RPM / 80K TPM; OpenAI 60 RPM / 150K TPM. §11.8. |
| Anti-bot policy | ✅ | Respect CAPTCHA (never bypass) → HITL. Respect robots.txt. Stealth for legitimate mimicry of human browsing, not for evasion of explicit bot bans. |
| Legal/safety limits | ✅ | GR-007 bans conversion predictions (legal risk — no unsupported performance claims). IP protection on heuristics (R6). No publishing to client unless approved (two-store). |
| Heuristic IP protection | ✅ | AES-256-GCM at rest. In-memory decryption only. Never in API/dashboard/logs/traces. Constitution R6. |
| Sensitive actions blocked | ✅ | ActionClassifier: form_submit, purchase, upload, download = sensitive → HITL required. §06.9 + §11. Enter key in form = sensitive (v2.2a). |
| Navigation guard during analysis | ✅ | 2-layer: pre-execution URL inspection + post-execution recovery via goBack. Analysis stays on current page. §33. |
| CSRF / script injection defense | ✅ | `browser_evaluate` sandbox: no cookies/localStorage/fetch/navigation access. Blocked on untrusted domains. §08.5. |
| Append-only audit trail | ✅ | audit_log, rejected_findings, finding_edits, audit_events, llm_call_log — all append-only. |

**Gap callouts:**
- **G16.1** — **PII enforcement is a written convention, not a code defense.** If an audit accidentally captures a logged-in page or a pre-filled form with user data, screenshots will include PII. Recommend a small task: PII detector on captured screenshots (blur credit-card-pattern / email-pattern / phone-pattern text before persisting). Post-MVP.
- **G16.2** — **Authentication audits** (client wants to audit their logged-in members area) are not supported. HITL escalation for login works but credential storage/injection is explicitly out of scope. State this as a non-goal.
- **G16.3** — **Secrets vault** (e.g., HashiCorp Vault, AWS Secrets Manager) not specified. `.env` is fine for MVP but enterprise customers will ask.

---

## 17. MVP vs Future Scope

> **IMPORTANT:** MVP has NOT been formally extracted yet. This section gives the intended boundary based on HANDOVER + design doc §3c. Concrete MVP task list is the next step after this checklist.

### In MVP (target: Phase 8 acceptance = "MVP AUDIT")

| Capability | Phases |
|---|---|
| Monorepo + tooling + Docker + env | 0 |
| Browser perception (AX-tree, DOM, screenshots) | 1 |
| 23 browse tools + 5 analysis tools (static) | 2 |
| Verification engine (9 strategies) | 3 |
| Safety + infrastructure + cost (token-level) + LLM failover | 4 |
| Browse MVP (real sites) | 5 |
| Heuristic KB (top 30 heuristics with benchmarks minimum) | 6 |
| Analysis pipeline (5-step) + perception quality gate + personas | 7 |
| Orchestrator + cross-page pattern detection (deferring consistency + funnel) | 8 |
| Foundations: gateway, reproducibility, two-store, scoring, consultant dashboard, structured logging, audit events, executive summary, PDF report, DiscoveryStrategy (Sitemap + Manual), NotificationAdapter (email) | 9 |

### Deferred post-MVP

| Capability | Reason |
|---|---|
| State exploration (§20 / Phase 10) | Works without; default-state audit delivers value |
| Agent composition / interactive mode (§33 / Phase 11) | The competitive moat; depends on MVP stability |
| Mobile viewport (Phase 12) | Design complete; deferred per HANDOVER explicit choice |
| Cross-page consistency check | MVP = pattern only |
| Cross-page funnel analysis (LLM) | MVP = pattern only |
| Progressive funnel context injection (T262) | Use post-hoc only in MVP |
| NavigationCrawlDiscovery | MVP = Sitemap + Manual only |
| Operational admin dashboard (§34 ops) | Build LAST in Phase 9 |
| Webhook NotificationAdapter | MVP = email only |
| Hypothesis pipeline (§29) | Post-audit deliverable, Phase 13+ |
| Competitor versioning (§10) | Not in 263-task plan |
| Learning service (§28) | Not in MVP; calibration requires 30+ samples |
| Analytics bindings (§30) | Not in 263-task plan |
| Temporal durable orchestration | Phase 6+ of system lifecycle (post-MVP) |
| Mobile-specific heuristics (10-15) | Phase 12 only |

### Experimental / uncertain

| Capability | Risk |
|---|---|
| Interactive mode cost | 3-7x multiplier. Needs real-audit validation in Phase 11. |
| Perception quality threshold (0.6 / 0.3) | Heuristic; needs tuning. PROJECT_BRIEF §27.10. |
| Funnel analysis (single LLM call) | Medium reliability. Always Tier 2 (consultant review). |
| Anti-bot longevity | Stealth works today; detection arms race ongoing. |
| Pages captured per minute | ~30min/audit for 50 pages static. Parallel analysis deferred (DD-01). |

### Requires human review

All Tier 2 findings (24hr delay) and all Tier 3 findings (consultant required). All open observations (Pass 2). All funnel findings (always Tier 2). Warm-up mode: ALL findings held for first 3 audits.

### Later-stage optimization

| Item |
|---|
| Parallel page analysis (DD-01 deferred) |
| Caching (prompt caching for shared context across pages) |
| Fingerprint sophistication upgrades |
| More extensive golden test library (target 50 cases) |
| Multi-language heuristics |

---

## 18. Open Risks / Unknowns

### Unresolved design decisions

- **U1** — MVP boundary not formally drawn. This checklist is the precondition; MVP extraction is next.
- **U2** — Team size + velocity unknown. Timeline estimate of ~21 weeks is aspirational; real pace depends on team.
- **U3** — Benchmark authoring pace. 100 heuristics × benchmark = ~200+ expert hours. Who does this? Phase 0b must start Day 1.
- **U4** — Self-serve vs consultant-led onboarding. Affects whether a business-type classifier is needed.
- **U5** — Authenticated audits. Explicitly out of scope; if a top client needs it, scope change required.

### High-risk modules

| Risk level | Module | Why |
|---|---|---|
| HIGH | InteractiveEvaluateStrategy (ReAct loop) | Cost spiraling. Context window management. State contamination during workflow. Phase 11 complexity. |
| HIGH | LLM reliability on arbitrary sites | Research ceiling ~80-86%. WebArena best ~62%. Our target is realistic only for known categories. |
| HIGH | Funnel analysis LLM call | Medium reliability; false positives on non-standard architectures. Always Tier 2. |
| MEDIUM | State exploration on SPAs | A/B tests, personalization → non-deterministic elements. Meaningful-state heuristics may false-positive. |
| MEDIUM | Temporal + LangGraph integration (Phase 6+) | Distributed state. Failure modes multiply. |
| MEDIUM | Anti-bot arms race | Stealth works today; detection evolves. |
| LOW | Heuristic KB completeness | 100 heuristics is a lot; quality matters more than count. Golden tests gate quality. |
| LOW | Perception quality false negatives | Threshold (0.6/0.3) needs field validation. |

### Assumptions

- **A1** — Claude Sonnet 4 + GPT-4o will remain available and priced as projected.
- **A2** — Playwright + stealth plugin will continue to work on target sites.
- **A3** — Consultants will validate findings at a rate that grows the golden test library (target 5 by Phase 7, 20 by Phase 9).
- **A4** — Budget numbers ($0.35 static, $1.80 interactive) approximately correct. Kimi analysis suggests real cost may be 2.3x — needs validation in Phase 5.
- **A5** — PostgreSQL + Redis + R2 + Fly.io scale adequately for 20+ audits/week.
- **A6** — Heuristic content can be authored at ~10-15 heuristics per week by CRO team.

### Dependencies

| Dep | Type | Risk |
|---|---|---|
| Anthropic API | External | Rate limits / pricing / availability |
| OpenAI API (fallback) | External | Same |
| Clerk (auth) | External | Lock-in |
| Cloudflare R2 | External | Cost of egress for PDF delivery |
| Fly.io (prod API) | External | Regional availability |
| Vercel (dashboard) | External | Pricing at scale |
| Playwright + plugins | Open source | Maintenance |
| LangGraph.js | Open source | API stability (early-stage) |
| Temporal | Phase 6+ | Operational complexity |
| CRO team heuristic authoring | Internal | Phase 0b pace |

### Expected technical debt

- **D1** — Phase 0-2 tasks may outpace Phase 1-2 tests; incidental debt in error paths.
- **D2** — `any` types ban (R2.1) may get exceptions in LLM output parsing; must track via TODOs.
- **D3** — Prompt templates will likely evolve faster than golden test coverage. Expect golden test misses in early phases.
- **D4** — Screenshot storage grows fast; lifecycle management (R2 retention policy) not specified.
- **D5** — DB index tuning will emerge under load; no performance benchmarks in specs yet.

---

## 19. File Map

### Monorepo root

| Module | Path | Responsibility | Status |
|---|---|---|---|
| Monorepo config | `package.json`, `pnpm-workspace.yaml`, `turbo.json` | Workspace orchestration | Specified, 0% coded (T001) |
| Docker dev env | `docker-compose.yml` | Local Postgres 16 + pgvector | Specified, 0% coded (T004) |
| Env template | `.env.example` | Secret + config documentation | Specified, 0% coded (T005) |

### `packages/agent-core/src/`

| Module | Path | Responsibility | Status | Primary tasks |
|---|---|---|---|---|
| Browser runtime | `browser-runtime/` | BrowserManager, BrowserSessionManager (§33a), StealthConfig, RateLimiter, CircuitBreaker, OverlayDismisser | Specified, 0% | T006, T007, T066, T069, T255 |
| Perception | `perception/` | AccessibilityExtractor, HardFilter, SoftFilter, MutationMonitor, ScreenshotExtractor, ContextAssembler, PageStateModel types | Specified, 0% | T008-T015 |
| MCP | `mcp/` | MCPServer + ToolRegistry (§33a) + 28 tools | Specified, 0% | T019-T050, T024 (ToolRegistry) |
| Safety | `safety/` | ActionClassifier + SafetyContext (§33a), SafetyCheck, DomainPolicy, CircuitBreaker, NavigationGuard | Specified, 0% | T066-T069, T071, T196 |
| Verification | `verification/` | ActionContract types, 9 VerifyStrategy implementations, VerifyEngine, FailureClassifier, ConfidenceScorer | Specified, 0% | T051-T065 |
| Analysis — nodes | `analysis/nodes/` | DeepPerceiveNode, EvaluateNode, SelfCritiqueNode, GroundNode, AnnotateNode, StoreNode, OpenObservationNode | Specified, 0% | T117-T134, T167, T199 |
| Analysis — grounding | `analysis/grounding/` | EvidenceGrounder + 12 rules (GR-001..GR-012) | Specified, 0% | T122-T129, T185, T200, T201, T214 |
| Analysis — scoring | `analysis/scoring/` | ScoringPipeline, IMPACT_MATRIX, EFFORT_MAP, Suppression | Specified, 0% | T165-T168 |
| Analysis — strategies | `analysis/strategies/` | EvaluateStrategy (§33a), StaticEvaluateStrategy, InteractiveEvaluateStrategy | Specified, 0% | T127 (§33a mod), T193 |
| Analysis — heuristics | `analysis/heuristics/` | HeuristicSchema (+ Extended), HeuristicLoader, filterByBusinessType, filterByPageType, filterByViewport, encryption | Specified, 0% | T101-T112, T213, T230 |
| Analysis — personas | `analysis/personas/` | PersonaContext type, default personas | Specified, 0% | T258-T259 |
| Analysis — cross-page | `analysis/cross-page/` | PatternDetector, ConsistencyChecker, FunnelAnalyzer, PageSignals types | Specified, 0% | T217-T222 |
| Analysis — quality | `analysis/quality/` | PerceptionQualityScorer | Specified, 0% | T232-T235 |
| Analysis — cost | `analysis/` | CostTracker (refactored to actuals) | Specified, 0% | T118, T225 |
| Orchestration | `orchestration/` | AuditState, AuditGraph, BrowseGraph, AnalysisGraph + nodes (audit_setup, page_router, audit_complete, cross_page_analyze, restore_state) | Specified, 0% | T135-T155, T222-T223, T206 |
| Exploration | `exploration/` | StateGraph, DisclosureRules (R1-R12), MeaningfulStateDetector, Pass1Explorer, Pass2Explorer, StateRestorer, MultiStateSynthesiser | Specified, 0% | T176-T192 |
| Gateway | `gateway/` | AuditRequest + Zod, validateRequest, GatewayService, DiscoveryStrategy adapter (Sitemap / NavCrawl / Manual) | Specified, 0% | T156-T159, T256-T257 |
| Reproducibility | `reproducibility/` | SnapshotBuilder, TemperatureGuard | Specified, 0% | T160-T161 |
| Storage | `storage/` | AccessModeMiddleware, TwoStore enforcement | Specified, 0% | T162, T164 |
| Review | `review/` | WarmupManager | Specified, 0% | T163 |
| Adapters | `adapters/` | LLMAdapter, AnthropicAdapter, OpenAIAdapter, StorageAdapter, PostgresStorage, ScreenshotStorage, LocalDiskStorage / R2Storage, BrowserEngine, HeuristicLoader, DiscoveryStrategy, NotificationAdapter, EmailNotificationAdapter, LLMRateLimiter, LLMFailoverAdapter, StreamEmitter, AuthProvider (Clerk) | Specified, 0% | T073-T076, T236-T238, T260-T261 |
| DB | `db/` | Drizzle schema, migrations | Specified, 0% | T070, T224, T240 |
| Observability | `observability/` | Pino logger, EventEmitter, HeuristicHealthMetrics view, AlertingJob | Specified, 0% | T239-T243 |
| Delivery | `delivery/` | ExecutiveSummaryGenerator, ActionPlanGenerator, ReportGenerator (PDF) | Specified, 0% | T245-T249 |
| Analytics | `analytics/` | costAttribution queries | Specified, 0% | T226 |

### `apps/`

| App | Path | Responsibility | Status |
|---|---|---|---|
| CLI | `apps/cli/` | `pnpm cro:audit` command, fixture-capture, golden-capture | Specified, 0% (T003, T145, T159, T254) |
| Dashboard | `apps/dashboard/` | Next.js 15 — consultant review UI, client dashboard, ops dashboard, report HTML template | Specified, 0% (T169-T173, T244, T248) |

### `heuristics-repo/` (private git repo)

| File | Responsibility | Status |
|---|---|---|
| `baymard.json` | 50 Baymard heuristics with benchmarks | 0% authored (Phase 0b) |
| `nielsen.json` | 35 Nielsen heuristics with benchmarks | 0% authored (Phase 0b) |
| `cialdini.json` | 15 Cialdini heuristics with benchmarks | 0% authored (Phase 0b) |
| `mobile.json` | 10-15 mobile heuristics (Phase 12) | 0% authored (post-MVP) |

### `test/`

| Path | Responsibility | Status |
|---|---|---|
| `test/fixtures/sites/<site>/` | Perception + page-state + screenshots | 0% captured (T254) |
| `test/fixtures/llm-responses/` | Cached LLM responses for MockLLMAdapter | 0% captured (T253) |
| `test/golden/GT-XXX.json` | Golden test cases | 0% authored (incremental, target 5 by Phase 7) |
| `test/mocks/MockBrowserEngine.ts` | Offline browser mock | 0% coded (T252) |
| `test/mocks/MockLLMAdapter.ts` | Offline LLM mock | 0% coded (T253) |

### `docs/`

| Path | Status |
|---|---|
| `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` | Canonical, committed |
| `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` | Canonical, committed |
| `docs/specs/final-architecture/§01-§36 + §33a` | 38 files, committed, v2.2a |
| `docs/specs/mvp/tasks-v2.md` | 263 tasks, committed |
| `docs/specs/mvp/constitution.md` | 16 rules, committed |
| `docs/superpowers/specs/2026-04-15-master-plan-refinement-design.md` | Design doc, committed |
| `docs/PROJECT_BRIEF.md` | v2.2a, committed |
| `docs/DEMO_GUIDE_v2.2.md` | 60-min demo, committed |
| `docs/specs/final-architecture/diagrams/master-architecture.html` | 10-tab interactive diagram, committed |

---

## 20. Final Coverage Checklist

Canonical table. ✅ present / 🟡 partial / 🔀 covered-differently / 📐 planned-post-MVP / ❌ missing.

| # | Capability | Required? | Status | Notes |
|---|---|---|---|---|
| 1.1 | Product goal, use case, audit types documented | Yes | ✅ | §01, PROJECT_BRIEF |
| 1.2 | Target quality standard | Yes | ✅ | §36: TP≥80%, FP≤20%; §25: ≥90% 24hr overlap |
| 1.3 | Supported page types (11) + business types (4) | Yes | ✅ | §05 + §07 |
| 1.4 | Desktop scope | Yes | ✅ | All phases |
| 1.5 | Mobile scope | Nice-to-have | 📐 | Phase 12, post-MVP |
| 1.6 | MVP subset extracted | Yes | ❌ | **NEXT STEP** |
| 1.7 | Non-goals documented | Nice-to-have | 🟡 | Implicit in GR-007, design doc §4; not consolidated |
| 2.1 | End-to-end runtime flow complete (trigger→report) | Yes | ✅ | All 40+ steps have a node/owner/task |
| 2.2 | LangSmith tracing | Yes | 🟡 | Referenced, no dedicated task (G2.1) |
| 2.3 | Crash recovery smoke test | Yes | 🟡 | Components specified, no integration test task (G2.2) |
| 3.1 | All 13 core architecture layers specified | Yes | ✅ | §03 + throughout |
| 3.2 | Dedicated classifier layer | Nice-to-have | 🔀 | Subsumed in `detectPageType()` + ClientProfile (G3.2) |
| 3.3 | Dedicated derived-feature layer | Nice-to-have | 🔀 | Subsumed in `page_analyze` (G3.1) |
| 4.1 | Browser tools (navigation + interaction) | Yes | ✅ | 23 MCP tools + behavior helpers |
| 4.2 | Capture tools (screenshots, DOM, AX-tree, network, console) | Yes | ✅ | 8 capture primitives |
| 4.3 | Extraction — generic | Yes | ✅ | page_analyze returns all 11 sections |
| 4.4 | Ecommerce semantic extractors (product, price, delivery, review) | Situational | 🔀 | Via `browser_extract` + schemas OR via AnalyzePerception fields (G4.3) |
| 4.5 | State-exploration (12 disclosure rules) | Yes | ✅ | §20.3 R1-R12 |
| 4.6 | Cart / checkout workflow orchestration | Yes | ✅ | §21 workflow orchestration |
| 4.7 | Business-type classifier | Nice-to-have | 🔀 | Client-profile driven (G6.1) |
| 4.8 | Page-type classifier with confidence | Yes | 🟡 | Returns type, no confidence score (G6.2) |
| 4.9 | Heuristic evaluator (deterministic + LLM) | Yes | ✅ | evaluate + 12 grounding rules |
| 4.10 | Prioritizer | Yes | ✅ | ScoringPipeline 4D |
| 4.11 | Hypothesis generator | Nice-to-have | 📐 | §29, post-MVP |
| 4.12 | Schema validator (Zod) | Yes | ✅ | Every boundary (R2.2) |
| 4.13 | Evidence validator | Yes | ✅ | GR-001, GR-008 |
| 4.14 | Contradiction checker | Nice-to-have | 🟡 | Via self-critique, not deterministic (G11.1) |
| 4.15 | Confidence gating | Yes | ✅ | <0.3 rejected + tier routing |
| 4.16 | Targeted re-check | Yes | ✅ | Self-critique escalation (§20.7) |
| 4.17 | Benchmark claim validation | Yes | ✅ | GR-012 |
| 4.18 | JSON output | Yes | ✅ | MCP + DB + API |
| 4.19 | Markdown report | Nice-to-have | ❌ | Not in plan (G4.7a) |
| 4.20 | PDF report | Yes | ✅ | §35, T249 |
| 4.21 | Evidence appendix | Yes | ✅ | §35 appendix section |
| 4.22 | Replay bundle | Nice-to-have | 🟡 | Data exists, no export CLI (G4.7b, G14.2) |
| 5.1 | All 12+ major data contracts specified | Yes | ✅ | §05 + §07 + §09 + §23 + §35 + design doc |
| 5.2 | PageSignals lightweight accumulator | Yes | ✅ | Design §1.2 v2.2a fix |
| 5.3 | PersonaContext type | Yes | ✅ | Design §1.2 v2.2a |
| 5.4 | LLMCallRecord with token-level cost | Yes | ✅ | Design §1.3 |
| 6.1 | Page-type classification rules + signals | Yes | ✅ | §07.4 detectPageType |
| 6.2 | Business-type classification | Yes | 🔀 | Profile-driven (G6.1) |
| 6.3 | Confidence scoring on classifications | Nice-to-have | ❌ | Not specified (G6.2) |
| 6.4 | Fallback behavior when uncertain | Yes | 🟡 | "other" enum; no HITL escalation (G6.2) |
| 7.1 | Meaningful-state detection | Yes | ✅ | §20.5 |
| 7.2 | Pass 1 heuristic-primed | Yes | ✅ | §20.3 REQ-STATE-EXPLORE-010-014 |
| 7.3 | Pass 2 bounded-exhaustive (R1-R12) | Yes | ✅ | §20.3 REQ-STATE-EXPLORE-030-042 |
| 7.4 | State deduplication | Yes | ✅ | state_id sha256 + target_ref skip |
| 7.5 | Caps + budget | Yes | ✅ | 15 states, depth 2, 25 interactions, $0.50 |
| 7.6 | Evidence attached via state_provenance | Yes | ✅ | §20.6 + §20.10 GR-009 |
| 7.7 | Restoration strategy | Yes | ✅ | Self-restoring vs destructive + reload fallback |
| 7.8 | Escalation loop | Yes | ✅ | §20.7, max 1 cycle |
| 8.1 | Derived features per page type | Yes | ✅ | AnalyzePerception, all page types |
| 8.2 | Deterministic only | Yes | ✅ | page_analyze single page.evaluate() |
| 8.3 | Versioning of feature schema | Nice-to-have | 🟡 | Via ReproducibilitySnapshot, not explicit (G8.1) |
| 8.4 | Downstream consumers enumerated | Yes | ✅ | evaluate, grounding, scoring, PageSignals, quality scorer |
| 9.1 | Heuristic sources (Baymard + Nielsen + Cialdini) | Yes | ✅ | 100 total |
| 9.2 | Storage format + encryption | Yes | ✅ | JSON + AES-256-GCM |
| 9.3 | Page/business/viewport-type applicability | Yes | ✅ | Three-stage filter |
| 9.4 | Severity model | Yes | ✅ | 4 levels + GR-006 requirement |
| 9.5 | Pass/fail vs scored | Yes | ✅ | status enum + strengths |
| 9.6 | Deterministic vs interpretive mix | Yes | ✅ | Tier system |
| 9.7 | Evidence requirement | Yes | ✅ | GR-006, Suppression |
| 9.8 | Benchmark schema required | Yes | ✅ | Design §1.1 |
| 9.9 | IP protection | Yes | ✅ | R6, encrypted |
| 9.10 | Injection in USER MESSAGE | Yes | ✅ | R5.5 |
| 9.11 | preferred_states hook | Yes | ✅ | §09.10, §20.3 |
| 10.1 | LLM for classification | Design choice | ❌ | **Intentionally absent** (rules only) |
| 10.2 | LLM for interpretive evaluation | Yes | ✅ | evaluate |
| 10.3 | LLM for self-critique | Yes | ✅ | Separate call, different persona |
| 10.4 | LLM for prioritization | Design choice | ❌ | Deterministic only |
| 10.5 | LLM for recommendation writing | Yes | 🟡 | Inline with evaluate (G10.1) |
| 10.6 | LLM for hypothesis generation | Nice-to-have | 📐 | §29, post-MVP |
| 10.7 | LLM for synthesis (cross-page funnel) | Yes | ✅ | FunnelAnalyzer |
| 10.8 | Input context hygiene | Yes | ✅ | R6 redaction |
| 10.9 | Output schema (Zod) | Yes | ✅ | R2.2 |
| 10.10 | Prompt guardrails | Yes | ✅ | §07.5 OBSERVE→ASSESS→EVIDENCE |
| 10.11 | Hallucination controls | Yes | ✅ | 3-layer filter |
| 11.1 | Schema validation | Yes | ✅ | R2 |
| 11.2 | Evidence requirements | Yes | ✅ | GR-001/006/008 |
| 11.3 | Contradiction checks | Nice-to-have | 🟡 | Via self-critique (G11.1) |
| 11.4 | Confidence thresholds | Yes | ✅ | Suppression + tier routing |
| 11.5 | Secondary verification pass | Yes | ✅ | Self-critique + grounding |
| 11.6 | Deterministic re-check policy | Yes | ✅ | 12 GR rules |
| 11.7 | Unsupported-claim rejection | Yes | ✅ | GR-001, GR-008, rejected_findings |
| 12.1 | Machine-readable JSON | Yes | ✅ | MCP server + API |
| 12.2 | Consultant-readable report | Yes | ✅ | §35 PDF, 8 sections |
| 12.3 | Evidence appendix | Yes | ✅ | §35 appendix |
| 12.4 | Screenshots / artifacts | Yes | ✅ | R2, annotated + per-state |
| 12.5 | Replay / debug bundle | Nice-to-have | 🟡 | (G4.7b) |
| 12.6 | Required / optional / score / confidence / citation formats | Yes | ✅ | Specified across §23, §35 |
| 13.1 | Postgres schema (25+ tables) | Yes | ✅ | §13 + migrations |
| 13.2 | Redis for queues + rate limiting | Yes | ✅ | BullMQ + LLMRateLimiter |
| 13.3 | R2 for screenshots + PDFs | Yes | ✅ | R7.3 |
| 13.4 | RLS + SET LOCAL | Yes | ✅ | R7.2 |
| 13.5 | Append-only tables | Yes | ✅ | R7.4 |
| 13.6 | Reproducibility immutability | Yes | ✅ | DB trigger |
| 13.7 | Resume/retry | Yes | ✅ | Checkpointer + BullMQ + Temporal |
| 14.1 | Structured logs (Pino) | Yes | ✅ | §34.3 |
| 14.2 | Traces (LangSmith) | Yes | 🟡 | (G14.1) |
| 14.3 | Metrics (heuristic health + audit) | Yes | ✅ | §34.5 materialized view |
| 14.4 | Screenshots + action history + DOM snapshots | Yes | ✅ | R2 + SessionRecorder + page_states |
| 14.5 | Run replay | Nice-to-have | 🟡 | (G14.2) |
| 14.6 | Audit events (22 types) | Yes | ✅ | §34.4 |
| 14.7 | Alerting rules | Yes | ✅ | §34.6, BullMQ job |
| 14.8 | Ops dashboard | Yes | ✅ | §34.7 |
| 15.1 | Retry + timeout policies | Yes | ✅ | §11, §15 |
| 15.2 | Fallback selectors (Mode A/B/C) | Yes | ✅ | §06 |
| 15.3 | Popup / overlay handling | Yes | ✅ | OverlayDismisser + R11/R12 |
| 15.4 | Iframe handling | Yes | 🟡 | (G15.1) |
| 15.5 | Shadow DOM handling | Yes | 🟡 | (G15.2) |
| 15.6 | Lazy loading | Yes | ✅ | ScrollBehavior + Mutation wait |
| 15.7 | Anti-flakiness | Yes | ✅ | 9 verify strategies + confidence decay |
| 15.8 | Partial audit behavior | Yes | ✅ | analysis_status enum, no silent drops |
| 15.9 | Low-confidence behavior | Yes | ✅ | Suppression + tier routing |
| 15.10 | LLM unavailable pause/resume | Yes | ✅ | BullMQ 3 attempts over 15min |
| 15.11 | Budget exhaustion kill-switch | Yes | ✅ | R8.1 |
| 16.1 | Domain allow/block + rate limits | Yes | ✅ | DomainPolicy + §11 |
| 16.2 | Authentication handling | Situational | 🟡 | HITL only, no auto-login (G16.2) |
| 16.3 | PII handling | Yes | 🟡 | Convention, not enforced (G16.1) |
| 16.4 | Secrets management | Yes | 🟡 | `.env`; no vault (G16.3) |
| 16.5 | Anti-bot policy | Yes | ✅ | Respect CAPTCHA + robots.txt + HITL |
| 16.6 | Legal/safety limits | Yes | ✅ | GR-007 + IP protection + two-store |
| 16.7 | Sensitive actions blocked | Yes | ✅ | ActionClassifier, NavigationGuard |
| 17.1 | MVP scope defined | Yes | ❌ | **NEXT STEP** after this checklist |
| 17.2 | Post-MVP scope defined | Yes | ✅ | §17 of this doc + design doc §3c |
| 17.3 | Experimental items flagged | Yes | ✅ | §17 of this doc |
| 17.4 | Human-review items flagged | Yes | ✅ | Tier 2/3, warm-up, all open observations |
| 18.1 | Open design decisions enumerated | Yes | ✅ | §18 of this doc |
| 18.2 | High-risk modules flagged | Yes | ✅ | §18 of this doc |
| 18.3 | Assumptions documented | Yes | ✅ | §18 of this doc |
| 18.4 | Dependencies mapped | Yes | ✅ | §18 of this doc |
| 19.1 | File map | Yes | ✅ | §19 of this doc |
| 19.2 | Module paths + owners | Partial | 🟡 | Paths yes; owners not assigned (no team structure given) |

---

## Executive verdict

**The 263-task master plan at v2.2a is substantially complete against the 20-section checklist.**

- **✅ Fully covered:** 90 of ~110 capabilities (~82%)
- **🔀 Covered-differently:** 10 capabilities (unified page_analyze subsumes per-section extractors; ClientProfile subsumes business-type classifier; etc.). These are **design choices, not gaps.**
- **🟡 Partial:** 15 capabilities (mostly LangSmith tracing, replay export, iframe/shadow DOM, secrets vault, PII enforcement — all low-to-medium priority for MVP)
- **📐 Planned post-MVP:** 5 capabilities (mobile, §29 hypothesis pipeline, §10 competitor versioning, §28 learning service, §30 analytics bindings)
- **❌ Missing (real gaps):** 4 capabilities
  - **Real gap #1:** MVP subset has not been formally extracted (blocker for starting implementation with confidence)
  - **Real gap #2:** Markdown report not in plan (minor, easy to add)
  - **Real gap #3:** Page-type classification has no confidence score (minor)
  - **Real gap #4:** `pnpm audit:export` replay CLI not in plan (minor)

## Consolidated gap list (for triage before MVP extraction)

| ID | Gap | Priority | Action |
|---|---|---|---|
| G1.1 | MVP subset not extracted | **Blocker** | Do this next. Use this checklist + HANDOVER + design §3c as inputs. |
| G1.2 | Non-goals not consolidated | Low | Add a "Non-goals" section to PROJECT_BRIEF or §01 |
| G2.1 | LangSmith tracing has no task | Medium | Add a small task to Phase 4 alongside LLMAdapter setup |
| G2.2 | No crash-recovery integration test | Medium | Add to Phase 9 acceptance |
| G3.1 | "Derived-feature layer" subsumed in page_analyze | None | Design choice — document in §03 to preempt future confusion |
| G3.2 | No dedicated classifier layer | None | Design choice — consider if self-serve signups are planned |
| G4.2a | Element screenshot not a standalone tool | Low | Ignore for MVP |
| G4.3 | Ecommerce semantic extractors not first-class | Medium (if product/review/price heuristics planned) | Decide whether to extend AnalyzePerception or rely on browser_extract |
| G4.7a | No markdown report builder | Low | Consider for MVP if consultants want it. Small task. |
| G4.7b | No replay-bundle export CLI | Low | Post-MVP. Data is all persisted. |
| G5.1 | No persisted DerivedFeatures table | Low | Design choice. Revisit if analytics-on-features needed. |
| G5.2 | Zod schemas not yet written | Expected | Will be written as each task is implemented (R2.1) |
| G6.1 | No business-type classifier | Medium (if self-serve planned) | Deferred |
| G6.2 | No confidence score on page type | Low | Add if miss-classification becomes observable |
| G6.3 | No LLM fallback for classification | Design choice | Ignore |
| G8.1 | AnalyzePerception schema not versioned | Low | Add version field if breaking changes planned |
| G10.1 | No dedicated recommendation rewriter | Low | Current inline approach is fine for MVP |
| G11.1 | Contradiction check is LLM-based only | Low | Add deterministic post-grounding pass if seen in practice |
| G14.1 | LangSmith integration not a task | Medium | Same as G2.1 |
| G14.2 | No `audit:export` CLI | Low | Post-MVP |
| G15.1 | Iframe handling not a failure mode | Medium | Add to §15. Verify in Phase 1 with a Stripe checkout iframe. |
| G15.2 | Shadow DOM not specified | Medium | Add to §15. Verify in Phase 1 with a modern React site. |
| G16.1 | PII enforcement is convention not code | Low for MVP, Medium post-MVP | Add PII-scrub task to Phase 9 or Phase 13+ |
| G16.2 | Authenticated audits out of scope | Design choice | State as non-goal |
| G16.3 | No secrets vault | Low for MVP | Required for enterprise |

---

## Recommendation

**Before MVP extraction, resolve these 6 items:**

1. **G1.2** — Write a one-paragraph "Non-goals" list (30 min).
2. **G2.1 / G14.1** — Add a LangSmith tracing task to Phase 4 (15 min).
3. **G4.3** — Decide: do MVP heuristics need price/review/delivery-specific signals? If yes, add fields to AnalyzePerception schema. If no, rely on `browser_extract`. (1 hour decision + design doc note).
4. **G4.7a** — Decide: markdown report in MVP? (15 min decision).
5. **G15.1 / G15.2** — Add iframe + shadow DOM to §15 failure modes (30 min).
6. **G16.1** — Decide PII policy: convention-only for MVP (document as non-goal) OR add scrub-before-persist task (decision + potentially 1 task).

**Then extract the MVP**, using:
- HANDOVER "RECOMMENDED PATH" (Phase 8 acceptance = MVP AUDIT milestone)
- Design doc §3c (MVP extraction notes)
- §17 of this checklist (In-MVP / Deferred / Experimental)

Produce `docs/specs/mvp/tasks-mvp-v1.md` with MVP tasks only + estimated timeline based on team size.

---

*End of checklist. Generated from 38 architectural specs (§01–§36 + §33a), 263 implementation tasks, constitution R1–R16, and v2.2a design doc. Every status claim traces to a REQ-ID or task ID in the spec corpus.*
