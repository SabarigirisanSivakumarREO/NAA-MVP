# AI CRO Audit Platform — Complete Project Brief

> **Purpose:** Self-contained document for LLM analysis. Contains every architectural decision, data flow, interface contract, and implementation constraint. Nothing omitted.
> **Status:** 0% implemented. 38 specs locked (§01-§36 + §33a). 263 tasks across 12 phases. ~21 weeks estimated.
> **Version:** v2.2a — Refined from 4 independent LLM gap analyses + external architecture review.
> **Owner:** REO Digital (Indian digital agency). Product name: Neural.

---

## 1. WHAT THIS IS

An AI-powered Conversion Rate Optimization audit platform. It crawls client websites with a browser agent, evaluates every page against 100 benchmark-backed heuristics (Baymard, Nielsen, Cialdini), validates findings through a 3-layer anti-hallucination filter (12 grounding rules), detects cross-page patterns and funnel issues, generates executive summaries and PDF reports, annotates screenshots, and exposes results through dashboards and an MCP server. Token-level cost accounting, LLM failover, perception quality gating, and operational observability ensure production reliability.

**Users:** CRO Consultants (run audits, review findings), Clients (view published findings), LLM Agents (query via MCP server).

**Scale target:** 20+ audits/week. Max 50 pages/audit. Cost: $0.35/page static, $1.80/page interactive. Mobile viewport auditing supported (master plan, post-MVP).

**Core thesis:** Findings are HYPOTHESES, not VERDICTS. Every finding must survive CoT generation → self-critique → evidence grounding (12 deterministic rules) before reaching a client. The system surfaces probable issues for human experts to validate.

---

## 2. WHAT LLM CAN AND CANNOT DO (Research-Grounded)

### Reliable (>75%)
- Detect missing elements (no CTA, no trust signals)
- Evaluate visual hierarchy and layout
- Count form fields and check labels
- Check above/below fold placement
- Color contrast issues

### Unreliable (<40%)
- Predict conversion impact → **BANNED** (GR-007 enforces)
- Assign reliable severity → Tied to measurable evidence instead
- Evaluate ease of use → Tier 3, consultant review required
- Assess emotional response → Tier 3, consultant review required
- Match human expert findings (21.2% overlap) → Treat as hypotheses

**Research papers driving design:** GPT-4o vs Human Experts (2025), MLLM UI Judge (2025), WiserUI-Bench (2025), UXAgent Amazon CHI 2025, AIHeurEval HCI 2025.

---

## 3. TECH STACK (ALL LOCKED)

| Layer | Tech |
|-------|------|
| **Language** | TypeScript 5.x, Node.js 22 LTS |
| **Monorepo** | Turborepo + pnpm, `packages/` + `apps/` workspaces |
| **Validation** | Zod 3.x for all external boundaries |
| **Browser** | Playwright + playwright-extra + stealth plugin + ghost-cursor |
| **Orchestration** | LangGraph.js (state graphs, checkpointing, interrupt) |
| **Tools** | MCP (Model Context Protocol) via @modelcontextprotocol/sdk |
| **Primary LLM** | Claude Sonnet 4 (Anthropic) |
| **Fallback LLM** | GPT-4o (OpenAI) |
| **Tracing** | LangSmith (~$39/mo) |
| **Database** | PostgreSQL 16 + pgvector, Drizzle ORM |
| **Cache/Queue** | Redis/Upstash + BullMQ |
| **API** | Hono 4.x, SSE for streaming |
| **Frontend** | Next.js 15 (App Router) + shadcn/ui + Tailwind CSS |
| **Auth** | Clerk |
| **Screenshots** | Sharp (annotation), Cloudflare R2 (storage) |
| **Encryption** | AES-256-GCM for heuristic IP at rest |
| **Deployment** | Docker (dev), Fly.io (prod API), Vercel (dashboard) |
| **Durable orchestration** | Temporal (Phase 6+) |
| **Testing** | Vitest (unit), Playwright Test (integration) |

**Monthly cost at scale:** ~$350-600/mo infrastructure + LLM API.

---

## 4. 5-LAYER ARCHITECTURE

```
Layer 5: DELIVERY — MCP Server (Hono), Client Dashboard (Next.js), Consultant Dashboard (Next.js+shadcn)
Layer 4: DATA — PostgreSQL 16+pgvector (RLS), Cloudflare R2 (screenshots), Heuristic Repo (private git, AES encrypted)
Layer 3: ANALYSIS ENGINE — 5-step pipeline: perceive→evaluate→self-critique→ground→annotate
Layer 2: BROWSER AGENT — 8 layers, 23 MCP tools, 3 execution modes, stealth, verification, safety gates
Layer 1: ORCHESTRATION — Audit lifecycle (LangGraph.js), job scheduling (BullMQ), client management (Clerk)
```

**Interface contracts:**
- Layer N only imports from Layer N-1, N, or N+1 via typed adapter interfaces
- All inter-layer communication uses TypeScript interfaces + Zod runtime validation
- Browser tools exposed exclusively through MCP
- Layer 1 emits SSE events for every state transition
- Analysis Engine SHALL NEVER directly control browser (receives AnalyzePerception data)
- Layer 4 enforces client isolation via PostgreSQL RLS on all client-scoped tables
- **REQ-LAYER-005 v3 (§33 revision):** Analysis Engine MAY use browser tools during interactive evaluation (Phase 11), SHALL NOT navigate

---

## 5. THE TWO AGENTS

### Browser Agent (v3.1) — Reusable Capability Library
- **Identity:** General-purpose browser automation (not CRO-specific)
- **Provides:** 23 MCP tools, stealth, human-like behavior, verification, session management
- **Graph:** 10-node browse subgraph: classify_task → load_memory → open_session → perceive → reason → safety_gate → act → verify → reflect → hitl → output
- **MVP graph:** 5 nodes: perceive → reason → act → verify → output (loop)
- **3 execution modes:**
  - Mode A (Deterministic): $0/step, replay pre-recorded workflows, zero LLM
  - Mode B (Guided Agent): ~$0.10/step, LLM reads AX-tree → decides → executes → verifies
  - Mode C (Computer Use): ~$0.30/step, vision model + screenshot, ≤10 steps, when AX-tree < 10 nodes
- **Perception:** AX-tree primary (cheap, reliable) + screenshot fallback. Dual-stage filtering: hard filter (invisible/disabled) → soft filter (relevance-scored top 30)
- **Confidence:** MULTIPLICATIVE decay (current × 0.97 per step), NOT additive. Bounds naturally in (0,1). Thresholds: ≥0.7 complete, 0.3-0.7 continue, <0.3 HITL
- **Verification:** 9 strategies (url_change, element_appears, element_text, network_request, no_error_banner, snapshot_diff, custom_js, no_captcha, no_bot_block). Every action requires a verification strategy.
- **Safety:** Deterministic code gates, NOT LLM judgment. 4 classes: safe/caution/sensitive/blocked. Sensitive → HITL. Domain circuit breaker (3 failures → 1hr block).
- **Rate limiting:** 2s min interval, 10/min unknown domains, 30/min trusted, robots.txt respected.
- **Human-like:** ghost-cursor Bezier mouse paths (~500ms), Gaussian typing delays (~120ms), 1-2% typo rate, fingerprint rotation per session.

### Analysis Agent (v1.0) — CRO Domain Expert
- **Identity:** CRO audit specialist with research-grounded methodology
- **Provides:** 5-step pipeline, heuristic evaluation, finding production, evidence grounding, dual-mode evaluation
- **Graph:** deep_perceive → evaluate → self_critique → ground → annotate_and_store
- **Pipeline timing:** perceive ~200ms → evaluate ~3-5s (LLM) → self-critique ~2-3s (LLM) → ground ~100ms (code) → annotate ~500ms
- **3-layer hallucination filter:**
  - Layer 1 (CoT, Step 2): Catches ~50% — unfounded claims during generation
  - Layer 2 (Self-Critique, Step 3): Catches ~30% of remaining — SEPARATE LLM call with DIFFERENT persona
  - Layer 3 (Evidence Grounding, Step 4): Catches ~95% of remaining — deterministic code, NO LLM
- **12 Grounding Rules (deterministic code):**
  - GR-001: Referenced element must exist in page data
  - GR-002: Above/below fold claims must match bounding box
  - GR-003: Form field count claims must match actual data
  - GR-004: Color contrast claims need actual computed styles
  - GR-005: Heuristic ID must be valid
  - GR-006: Critical/high severity requires measurable evidence
  - GR-007: NO conversion predictions (absolute ban)
  - GR-008: data_point must reference real AnalyzePerception section
  - GR-009: State provenance integrity (Phase 10, §20)
  - GR-010: Workflow finding cross-step requirement (Phase 11, §21)
  - GR-011: Per-state data correctness (Phase 11, §33)
  - GR-012: Benchmark claims must match heuristic benchmark data (±20% for quantitative; standard reference for qualitative) (v2.2)

---

## 6. 31 MCP TOOLS

### 23 Browse Tools
| # | Tool | Safety | Description |
|---|------|--------|-------------|
| 1-4 | browser_navigate, go_back, go_forward, reload | safe | Navigation |
| 5-7 | browser_get_state, screenshot, get_metadata | safe | Perception |
| 8-15 | browser_click, click_coords, type, scroll, select, hover, press_key, upload | caution/sensitive | Interaction |
| 16 | browser_tab_manage | caution | Tab management |
| 17-18 | browser_extract, download | safe/sensitive | Data |
| 19-20 | browser_find_by_text, get_network | safe | Discovery |
| 21-22 | browser_wait_for, agent_complete | safe | Control |
| 23 | agent_request_human | caution | HITL |
| (24) | browser_evaluate | blocked/caution | Restricted JS sandbox |

### 5 Analysis Tools
| # | Tool | Description |
|---|------|-------------|
| 24 | page_get_element_info | Bounding box, computed styles, isAboveFold |
| 25 | page_get_performance | DOMContentLoaded, LCP, resource count |
| 26 | page_screenshot_full | Full scroll capture, max 15000px |
| 27 | page_annotate_screenshot | Sharp-based pin overlay with severity colors |
| 28 | page_analyze | Single page.evaluate() call, returns full AnalyzePerception |

### 3 Composition Output Tools (Phase 11)
| # | Tool | Description |
|---|------|-------------|
| 29 | produce_finding | Record a CRO finding during interactive evaluation |
| 30 | mark_heuristic_pass | Mark heuristic as passing |
| 31 | mark_heuristic_needs_review | Mark heuristic as uncertain |

---

## 7. HEURISTIC KNOWLEDGE BASE

**100 heuristics total:** 50 Baymard + 35 Nielsen + 15 Cialdini
**3 reliability tiers:**
- Tier 1 (~42): Visual/structural. >75% reliable. Auto-publish if grounded.
- Tier 2 (~42): Content/persuasion. ~60% reliable. 24hr delay before publish.
- Tier 3 (~16): Interaction/emotional. <40% reliable. Consultant review required.

**IP Protection:** Heuristic content NEVER in API responses or dashboards. AES-256-GCM encrypted at rest. Decrypted in memory only. Only heuristic_id references stored in DB. Redacted in LangSmith traces.

**Two-stage filtering:**
1. Stage 1 (audit_setup): filterByBusinessType — 100 → ~60-70 heuristics
2. Stage 2 (page_router): filterByPageType — ~60-70 → 15-20 heuristics per page

**Heuristics injected into LLM USER MESSAGE, not system prompt.**

**Extended schema (§9.10):** version, rule_vs_guidance, business_impact_weight, effort_category, preferred_states (for state exploration), status, viewport_applicability (desktop/mobile/both).

**Benchmark schema (REQUIRED on all 100 heuristics, v2.2 addition):**
- **Quantitative** (~40-50 heuristics): value, source, unit, comparison operator, threshold_warning, threshold_critical. Example: "6-8 fields (Baymard), warning at 10, critical at 15"
- **Qualitative** (~50-60 heuristics): standard, source, positive_exemplar, negative_exemplar. Example: "Primary CTA visible above fold (NNG). Good: CTA in top 30%. Bad: CTA below 3 scrolls."
- Benchmark data injected alongside each heuristic in the evaluate prompt
- GR-012 validates benchmark claims against actual page data

---

## 8. UNIFIED STATE (AuditState)

Single LangGraph Annotation object carries ALL state across orchestrator, browse subgraph, and analyze subgraph. Both subgraphs read/write same state; mode-specific fields ignored by inactive subgraph.

### Key Browse Fields
messages, task, task_complexity, current_step, max_steps (50), execution_mode, confidence_score, confidence_threshold (0.7), current_url, page_snapshot (PageStateModel), screenshot_b64, last_action, verify_strategy, verify_result, retry_count (max 3), is_complete, completion_reason, budget_remaining_usd

### Key Orchestrator Fields
audit_run_id, client_id, client_profile, current_mode (browse|analyze), page_queue (AuditPage[]), current_page_index, current_page_type, business_type, heuristic_knowledge_base, filtered_heuristics

### Key Analysis Fields
analyze_perception (AnalyzePerception), viewport_screenshot, fullpage_screenshot, raw_findings, reviewed_findings, grounded_findings, rejected_findings, critique_summary, annotated_screenshots, findings (accumulated across pages), analysis_cost_usd, analysis_budget_usd ($5/page)

### Extension Fields (Phase 6+)
trigger_source, audit_request_id, state_graph (StateGraph), multi_state_perception, exploration_cost_usd, reproducibility_snapshot, published_finding_ids, warmup_mode_active, workflow_context, finding_rollups, browser_session_id

### v2.2 Addition Fields
- `page_signals: PageSignals[]` — lightweight per-page summaries (url, page_type, cta_texts, form_field_counts, trust_signal_types, finding_heuristic_ids) accumulated for cross-page analysis. NOT full perceptions (avoids 2.5-5MB state bloat on 50-page audits).
- `funnel_definition: FunnelStage[] | null` — optional client-provided funnel
- `personas: PersonaContext[] | null` — optional personas for persona-based evaluation (v2.2a)
- `pattern_findings, consistency_findings, funnel_findings` — cross-page analysis outputs
- `perception_quality: PerceptionQualityScore | null` — quality gate score
- `analysis_status: "complete" | "partial" | "perception_insufficient" | "failed" | "budget_exceeded" | "llm_failed" | "grounding_rejected_all"`

### Critical Invariants
- current_step SHALL NEVER exceed max_steps
- confidence_score ∈ [0.0, 1.0]
- budget_remaining_usd SHALL NEVER be negative
- filtered_heuristics.length ∈ [1, 30] when entering analyze
- grounded_findings ⊂ reviewed_findings (no finding grounded without self-critique)
- reproducibility_snapshot IMMUTABLE after creation
- temperature = 0 for evaluate, evaluate_interactive, self_critique

---

## 9. AUDIT ORCHESTRATOR

### Graph Topology
```
audit_setup → page_router → [browse subgraph] → [analyze subgraph] → page_router (loop)
                          ↓ (queue empty)
                    cross_page_analyze → audit_complete → report_generate
```

### Node: audit_setup
Loads client profile, loads heuristic KB, builds page queue (sitemap + priority sort, max 50), creates audit_run DB record, loads reproducibility snapshot, Stage 1 heuristic filter (by business type).

### Node: page_router
Advances page queue, sets current_url/page_type, Stage 2 heuristic filter (by page type, cap 30), routes to browse or audit_complete.

### Routing rules
- routePageRouter: if queue empty OR index ≥ 50 OR budget ≤ 0 → audit_complete, else → browse
- routeAfterBrowse: if success → analyze, if failure → skip page → page_router
- routeAfterAnalyze: advance index, if budget ≤ 0 OR queue done → audit_complete, else → page_router

### Subgraph integration (LangGraph.js)
Browse and analyze compiled as independent subgraphs, nested inside audit orchestrator. PostgreSQL checkpointer for crash recovery.

---

## 10. ANALYSIS PIPELINE DETAIL

### Step 1: deep_perceive
Single page.evaluate() call. Returns AnalyzePerception with: headingHierarchy, landmarks, semanticHTML, textContent (word count, readability, paragraphs), ctas (with bounding boxes, computed styles, contrast ratio), forms (field count, labels, validation), trustSignals, layout (fold position, visual hierarchy, whitespace), images (alt text, lazy load), navigation, performance (DOMContentLoaded, LCP).

Auto-detects page type from perception data.

### Step 1b: Perception Quality Gate (v2.2 addition)
Scores perception data quality before sending to LLM. 7 signals weighted: has_meaningful_content (0.25), has_interactive_elements (0.20), has_navigation (0.10), has_heading_structure (0.10), no_overlay_detected (0.15), no_error_state (0.15), page_loaded (0.05).
- Score ≥ 0.6 → proceed to evaluate normally
- Score 0.3-0.59 → partial analysis (Tier 1 quantitative heuristics only, skip LLM)
- Score < 0.3 → skip page (analysis_status: "perception_insufficient"), no LLM cost
Overlay detection: position fixed/sticky, z-index > 999, covering > 30% viewport, common class patterns (cookie, consent, modal, popup).
**Overlay dismissal (v2.2a):** Before perception, browse subgraph attempts to dismiss detected overlays by clicking accept/close/dismiss buttons using common selectors. If dismissal fails, proceeds with overlay present and lets quality gate handle degraded perception.

### Step 2: evaluate
LLM call with chain-of-thought. System prompt: CRO analyst role with strict methodology (OBSERVE → ASSESS → EVIDENCE → SEVERITY). Heuristics with benchmarks injected in user message (NOT system prompt). **Persona context (v2.2a):** 2-3 personas per business type injected into evaluate prompt (e.g., first-time visitor, returning customer, price-sensitive shopper). LLM evaluates from each persona's perspective. Findings get `persona: string | null` tag. Output: RawFinding[] with heuristic_id, status (violation/pass/needs_review), observation, assessment, evidence (element_ref, selector, data_point, measurement), severity, recommendation, persona.
**Progressive funnel context (v2.2a, master plan):** For subsequent pages, accumulated PageSignals from previous pages injected into evaluate prompt, enabling inline funnel-aware findings.

**Temperature = 0 (enforced at adapter boundary).**

### Step 3: self_critique
SEPARATE LLM call with DIFFERENT persona (senior quality reviewer). 5 checks per finding: verify element exists, check severity proportionality, check logic, check context, check duplicates. Verdicts: KEEP, REVISE, DOWNGRADE, REJECT. Reduces false positives by ~30%.

### Step 4: ground (DETERMINISTIC CODE, NO LLM)
Runs all 11 grounding rules. Each rule: check(finding, pageData) → pass | {fail, reason}. Any failure → finding rejected with rule ID logged.

### Step 5: annotate_and_store
Pin overlay on screenshots using Sharp. Severity colors (critical=red, high=orange, medium=yellow, low=blue). Pin diameter 28px. Overlap avoidance. Connection lines. Persist findings to DB, screenshots to R2. Apply review gate tier routing.

### Confidence Tier Assignment
- Tier 1 heuristic + measurable evidence = high confidence → auto-publish
- Tier 1 + element ref only = medium → 24hr delay
- Tier 2 + any evidence = medium → 24hr delay
- Tier 3 = always low → consultant review required

---

## 11. §33 AGENT COMPOSITION MODEL (THE COMPETITIVE MOAT)

**Supersedes §31 and §32. Do NOT implement from those.**

### Principle
Browser Agent = reusable capability library. Analysis Agent = CRO domain expert. They compose via tool injection — NOT merge, NOT plugin, NOT message bus.

### Tool Injection During Interactive Evaluate
Analysis agent's evaluate node receives 15 tools: 9 browser (click, hover, select, type, press_key, scroll, get_state, screenshot, find_by_text) + 3 perception (page_analyze, page_get_element_info, page_get_performance) + 3 output (produce_finding, mark_heuristic_pass, mark_heuristic_needs_review).

**Navigation tools EXCLUDED** (navigate, go_back, go_forward, tab_manage). Analysis stays on current page.

### Two Operating Modes
- **Static (Phases 1-10 default):** Single-shot evaluate. No browser tools. No Pass 2.
- **Interactive (Phase 11 default):** ReAct loop with tool calls. Browser tools available. Pass 2 enabled. 5-15 interactions/page.

### Dual-Mode Evaluation
- **Pass 1 (Heuristic-driven):** Filtered heuristics, interactive CoT, scope split (global/per_state/transition)
- **Pass 2 (Open observation):** "What did heuristics miss?", static-only evaluation, max 5 findings, all Tier 3, synthetic OPEN-OBS-* IDs, needs consultant review

### Safety During Composition
- Navigation guard: 2-layer (pre-execution URL inspection + post-execution recovery via goBack)
- Enter key reclassified to "sensitive" when focused element is inside a form
- All sensitive actions BLOCKED during analysis
- Session contamination tracking for workflow mode
- Per-heuristic interaction cap (2 standard, configurable)
- Context window management with state-delta compression

### §33a Interface-First Integration
These interfaces MUST be built in earlier phases (not bolted on in Phase 11):
- Phase 2 (T024): ToolRegistry with getToolsForContext()
- Phase 4 (T066): BrowserSessionManager (create/get/close)
- Phase 4 (T071): SafetyContext with callingNode field
- Phase 5 (T081): Browse graph accepts external browser session
- Phase 7 (T127): EvaluateStrategy pattern (StaticEvaluateStrategy default)
- Phase 8 (T143): Session passing browse→analyze, restore_state node

---

## 12. STATE EXPLORATION (§20)

### Problem
30-50% of CRO-relevant content hides behind tabs, accordions, modals, variant selectors. Default-state-only audits miss it.

### Two-Pass Model
**Pass 1 (Heuristic-Primed, always runs):** Collect preferred_states from filtered heuristics. For each: find element → interact → wait stability → capture perception → meaningful check. Self-restoring interactions need no restoration.

**Pass 2 (Bounded-Exhaustive, conditional):** Auto-escalates if: thorough_mode OR unexplored_ratio > 0.5. Applies 12 disclosure rules (R1-R12). R11 cookie + R12 chat = cleanup first. Caps: 15 states/page, depth 2, 25 interactions, $0.50 budget. 1 LLM fallback if <3 meaningful states on interactive page.

### Meaningful State Detection
New state is meaningful if ANY: text Jaccard > 0.15, new interactive elements > 3, above-fold diff > 10%, CTA set changed.

### Multi-State Perception
Merges default + hidden states into merged_view. CTA dedup: text cosine > 0.9 AND bounding box IoU > 0.5. State provenance maps merged_view elements to source states.

---

## 13. TWO-STORE PATTERN & WARM-UP

### Internal Store (findings table, all rows)
All scopes, all statuses, rejected findings visible, grounding metadata visible. Read by: consultant dashboard, admin, learning service, finding diff engine.

### Published Store (published_findings VIEW)
Only approved/auto-published findings. No rejected, held, or delayed. No grounding metadata. Read by: client dashboard, MCP server, client API, PDF export.

### Enforcement
- Application layer: client-facing APIs query view, never table
- Database layer: RLS policy filters by app.access_mode (SET LOCAL in transaction)
- Defense in depth: even if app layer has bug, RLS prevents leakage

### Warm-Up Mode
New clients → ALL findings held regardless of tier until: audits_completed ≥ 3 AND rejection_rate < 25%. Only consultant-approved findings reach published store during warm-up.

---

## 14. REPRODUCIBILITY

### Temperature Policy
temperature = 0 for: evaluate, evaluate_interactive, self_critique. Enforced at adapter boundary (runtime error if violated).

### Reproducibility Snapshot
Created by gateway BEFORE first LLM call. IMMUTABLE after creation (DB trigger prevents mutation). Pins: prompt template hashes, model names+versions, temperatures, heuristic base+overlay chain hash, normalizer/grounding/scoring versions.

### Defensibility Target
Same inputs → ≥90% finding overlap within 24hr. Below 90% → diagnostic alert (not failure).

---

## 15. 4-DIMENSIONAL SCORING

All deterministic, NO LLM calls:
- **Severity:** From heuristic or critique downgrade
- **Confidence:** tier × grounding × evidence
- **Business Impact:** IMPACT_MATRIX[pageType][funnelPosition] × (severity/4)
- **Effort:** EFFORT_MAP[heuristic.effort_category]
- **Priority (derived):** `(severity×2 + impact×1.5 + confidence×1 - effort×0.5)` rounded to 2 decimals

### Suppression Rules
- confidence < 0.3 → reject
- evidence_ids empty → reject
- Exact duplicate (heuristic_id + element_ref + page) → reject

---

## 16. DATABASE SCHEMA (25+ TABLES)

### Core Tables
clients, audit_runs (versioned per client), findings (RLS, 12+ extension columns for §33), screenshots, sessions, audit_log (append-only), rejected_findings (append-only)

### Extension Tables
page_states, state_interactions, finding_rollups, reproducibility_snapshots (immutability trigger), audit_requests, templates, workflows, domain_patterns (pgvector)

### v2.2 Addition Tables
- `llm_call_log` — append-only, per-call: audit_run_id, node_name, model, input_tokens, output_tokens, cost_usd, duration_ms, cache_hit
- `audit_events` — 22 event types: audit_started through cross_page_analysis_completed, powers SSE + observability

### Key Views
published_findings (WHERE publish_status = 'published' AND published_at <= NOW())

### Security
- Row-level security on all client-scoped tables
- app.client_id session variable set before every query
- SET LOCAL within transactions (connection pooling safe)

---

## 17. ADAPTER INTERFACES (LOOSE COUPLING)

ALL external dependencies via adapters. No direct imports outside adapter modules:
- **LLMAdapter** — invoke(), getCostEstimate(), getTokenCount(). Supports Anthropic/OpenAI/Gemini/local.
- **StorageAdapter** — saveCheckpoint, loadCheckpoint, recordSuccess, findSimilarPatterns, saveWorkflowRecipe
- **ScreenshotStorage** — save/load images (R2 prod, local disk dev)
- **BrowserEngine** — wraps Playwright
- **BrowserSessionManager** (§33a) — create/get/close sessions (shared between browse and analyze)
- **ToolRegistry** (§33a) — registerToolSet, getToolsForContext (dynamic per mode)
- **HeuristicLoader** — loadAll, filterByBusinessType, filterByPageType
- **DiscoveryStrategy** (v2.2a) — discover(rootUrl, config) → AuditPage[]. Implementations: SitemapDiscovery, NavigationCrawlDiscovery, ManualDiscovery
- **NotificationAdapter** (v2.2a) — notify(event). Email implementation (Resend/Postmark). Events: audit_completed, audit_failed, findings_ready_for_review
- **JobScheduler** — BullMQ wrapper
- **EventBus** — SSE event streaming
- **AuthProvider** — Clerk wrapper

---

## 18. FAILURE MODES (110 CATALOGUED)

### Browse (12): Infinite loop, hallucinated selectors, cost explosion, CAPTCHA, SPA navigation, stale recipes, context overflow, rate limiting, login walls, circuit breaker, bot detection, partial extraction

### Analysis (10): Hallucinated finding, inflated severity, malformed LLM output, LLM refuses, wrong page type, KB load failure, annotation overlap, budget exceeded, conversion prediction, context exceeded

### Composition (16): Navigation during analysis (blocked), form submission during analysis (blocked), session contamination in workflow, context window overflow in ReAct loop, interaction budget exceeded per heuristic, etc.

### Platform (72): Discovery, state exploration, workflow, scoring, two-store, reproducibility, delivery failures — each with specific detection + response.

### Analysis Error Recovery (v2.2 addition)
Per-page `analysis_status` enum: complete, partial, perception_insufficient, budget_exceeded, llm_failed, grounding_rejected_all, failed. Recovery matrix:
- LLM timeout → split heuristic batch (20→2×10), retry
- Semantically garbage output → retry once with explicit instruction
- Self-critique rejects ALL → skip critique, send raw to grounding
- Grounding rejects 100% → flag for consultant review, raw findings in internal store
- Zero findings (clean page) → accept, log suspiciously_clean if page has CTAs+forms
- Annotation failure → store findings without annotations, non-fatal
- Audit never silently drops a page. Every page gets a status and reason.

### Response hierarchy
- Browse: transient→retry(3x), structural→reflect/replan, blocked→HITL, bot→pause+rotate+retry→HITL
- Analysis: perception gate→skip or partial, hallucination→grounding rejects, malformed→retry+split, budget→graceful stop, all-rejected→consultant review
- LLM failover: primary 3 retries → fallback 2 retries → pause audit → BullMQ resume in 5min
- Audit: all pages fail→HITL, budget exceeded→partial results, crash→checkpoint recovery

---

## 19. COST MODEL

### Per-Page (Static)
Browse ~$0.10 + Analyze ~$0.05 + Evaluate ~$0.15 + Critique ~$0.05 + Ground $0 + Annotate $0 = **~$0.35/page**

### Per-Page (Interactive, Phase 11)
3x-7x multiplier depending on depth: standard ~$1.05/page, deep ~$1.80/page

### Per-Audit
10 pages: ~$3.50 | 50 pages: ~$17.50 | With competitors: ~$7-11.50

### Budget enforcement
- Audit-level: $15 total hard cap
- Page-level: $5 analysis budget
- Exploration: $0.50/page cap
- Kill-switch: budget_remaining_usd ≤ 0 → terminate

### Token-Level Cost Accounting (v2.2 addition)
- Every LLM call logged atomically: model, input_tokens, output_tokens, cost_usd, duration_ms, cache_hit
- Pre-call budget gate: estimate from prompt token count, skip if estimated > remaining
- Post-audit cost summary: actual_cost_usd, cost_breakdown by node, cost_per_page_avg, cache_hit_rate
- Per-client attribution via llm_call_log JOIN audit_runs GROUP BY client_id

### LLM Rate Limiting & Failover (v2.2 addition)
- Sliding window rate limiter per provider in Redis (Anthropic: 50 RPM/80K TPM, OpenAI: 60 RPM/150K TPM)
- Exponential backoff with ±20% jitter
- Per-call failover: primary 3 retries → fallback 2 retries → LLMUnavailableError
- 3+ consecutive page failures → audit pauses, BullMQ schedules resume in 5min (3 attempts)
- Failover findings tagged with model_mismatch = true

---

## 20. DELIVERY LAYER

### CRO Audit MCP Server (Hono)
9 MCP tools for LLM queries. API key scoped. Client isolated. Reads published store only.

### Client Dashboard (Next.js 15)
Published findings, annotated screenshots, version compare, competitor view.

### Consultant Dashboard (Next.js 15 + shadcn/ui)
Review gate management (approve/reject/edit), client management, audit scheduling, progress monitoring, warm-up status, finding detail with annotated screenshots. Operational admin dashboard (/console/admin/operations) for audit health, heuristic performance, cost trends, and alerts (§34).

### PDF Report Generation (v2.2 addition, §35)
- Executive summary: overall score (0-100), grade (A-F), top 5 findings, strengths, category breakdown, recommended next steps
- Action plan: 4 quadrants — quick wins (high impact + low effort), strategic (high impact + high effort), incremental (low impact + low effort), deprioritized (low impact + high effort)
- Full PDF report: cover → exec summary → action plan → findings by category → cross-page patterns → funnel analysis → methodology note → appendix
- Tech: Next.js HTML template → Playwright page.pdf(). Branded per client. <5MB. Stored in R2.

### Streaming
SSE events for: 22 event types including audit_started, page_browsing, page_analyzing, findings_produced, finding_published, page_complete, page_failed, audit_progress, audit_complete, audit_error, perception_quality_low, llm_provider_fallback, cross_page_analysis_completed.

---

## 21. AUDIT LIFECYCLE (7 PHASES)

**Phase 1: Trigger & Init** — Gateway validates → reproducibility snapshot (temp=0) → load client+heuristics (AES-256-GCM) → Stage 1 filter (business type) → discover pages → build queue → budget $15 total

**Phase 2: Page Loop (per page, max 50)** — page_router → browse (navigate+stabilize+HITL if needed) → [explore_states: Pass 1 heuristic-primed + Pass 2 bounded-exhaustive → StateGraph] → deep_perceive (page_analyze+screenshots+per-state screenshots) → **perception quality gate** (≥0.6 proceed / 0.3-0.59 partial / <0.3 skip) → evaluate (interactive CoT or static, scope split, **benchmarks injected**) → Pass 2 open observation (static, max 5, Tier 3) → self_critique (SEPARATE call, 5 checks, KEEP/REVISE/DOWNGRADE/REJECT) → evidence ground (**12 rules** including GR-012 benchmark validation, deterministic, NO LLM) → annotate+store → review gate (Tier 1 auto / Tier 2 24hr / Tier 3 held) → restore_state → back to page_router

**Phase 3: Workflow** — Continuous session → per-step browse+analysis → cross-step synthesis

**Phase 3b: Cross-Page Analysis (v2.2)** — After all pages analyzed: (1) Pattern detection — group findings by heuristic across pages, 3+ violations → PatternFinding. (2) Consistency check — compare CTA styles, nav, trust signals across pages. (3) Funnel analysis — single LLM call ($1 cap, temp=0) for promise/delivery mismatches, missing steps, journey friction. New finding scopes: cross_page_pattern, cross_page_consistency, funnel.

**Phase 4: Completion** — **Executive summary** (overall score 0-100, grade A-F, top 5, strengths, category breakdown) → **action plan** (effort/impact quadrant bucketing) → competitor comparison (pairwise) → version diff → **PDF report generation** (branded, <5MB, stored R2)

**Phase 5: Review Gate + Two-Store** — Internal store (all) → tier routing → warm-up override → consultant review → published store (client-visible)

**Phase 6: Delivery** — CLI + PostgreSQL (RLS) + R2 + MCP Server + dashboards

**Phase 7: Learning Loop** — Consultant decisions → calibration engine (30+ samples) → open observation crystallization → overlay chain → scheduled re-audits with version diff

---

## 22. IMPLEMENTATION PLAN (255 TASKS, 12 PHASES)

| Phase | Tasks | IDs | What |
|-------|-------|-----|------|
| 0: Setup + Golden Test Infra | 7 | T001-T005, T252-T253 | Monorepo, packages, CLI, Docker, env, **offline mock mode, MockBrowserEngine, MockLLMAdapter** |
| 0b: Heuristic Authoring (PARALLEL) | — | — | CRO team authors heuristics in parallel with engineering. Week 2: top 15 heuristics. Week 3: benchmarks. Week 4: first 5 golden tests. Week 9: all 100 complete. |
| 1: Perception | 12 | T006-T015, T254, T255 | BrowserManager, stealth, AX-tree, filters, mutation, screenshots, PageStateModel, **fixture capture CLI**, **overlay dismissal step** |
| 2: Tools + Behavior | 35 | T016-T050 | 23 browse tools, mouse/typing/scroll behavior, MCP server, **ToolRegistry (§33a)** |
| 3: Verification | 15 | T051-T065 | ActionContract, 9 verify strategies, VerifyEngine, FailureClassifier, ConfidenceScorer |
| 4: Safety + Infra + Cost | 21 | T066-T080, T224-T226, T236-T238 | **BrowserSessionManager (§33a)**, **SafetyContext (§33a)**, DB schema (25+ tables), adapters, **token-level cost accounting, LLM rate limiting, LLM failover** |
| 5: Browse MVP | 20 | T081-T100 | Browse graph (**external session §33a**), system prompt, integration tests on BBC/Amazon |
| 6: Heuristic KB + Benchmarks | 16 | T101-T112, T213-T216 | Schemas, 100 heuristics authored **with required benchmarks (quantitative + qualitative)**, loader, two-stage filtering, encryption, tier validation, **GR-012** |
| 7: Analysis Pipeline + Quality | 28 | T113-T134, T232-T235, T250-T251, T258-T259 | AnalysisState, deep_perceive, **perception quality gate**, evaluate (**EvaluateStrategy §33a**, benchmarks in prompt, **persona context**), self_critique, 8 grounding rules, evidence grounder, annotate, store, AnalysisGraph, **error recovery paths, golden test expansion, PersonaContext types + prompt injection** |
| 8: Orchestrator + Cross-Page | 29 | T135-T155, T217-T223, T262 | AuditState, audit_setup, page_router, audit_complete, routing, AuditGraph (**session passing + restore_state §33a**), CLI command, **cross-page pattern detection, consistency check, funnel analysis, progressive funnel context injection**, acceptance tests |
| 9: Foundations + Observability + Reports | 37 | T156-T175, T239-T249, T256-T257, T260-T261 | AuditRequest contract, gateway, reproducibility, two-store, warm-up, scoring pipeline, consultant dashboard, **§34 structured logging + audit events + heuristic health + alerting + ops dashboard (last priority)**, **§35 executive summary + action plan + PDF report**, **DiscoveryStrategy adapter (Sitemap + Manual + NavCrawl)**, **NotificationAdapter (email on complete/fail/review)** |
| 10: State Exploration | 18 | T176-T192 | StateGraph types, disclosure rules, meaningful-state detection, Pass 1/2 explorers, multi-state synthesis, GR-009, extended browse graph |
| 11: Composition | 20 | T193-T212 | InteractiveEvaluateStrategy (ReAct), tool injection, navigation guard, Pass 2 open observation, GR-010/GR-011, workflow restore, context management, cost model, activate interactive default |
| 12: Mobile Viewport | 5 | T227-T231 | Dual-viewport pipeline (1440px + 390px), mobile heuristics (10-15), viewport-tagged findings, Stage 3 filtering by viewport **(master plan only, not MVP)** |

### §33a Interface Modifications (built into earlier phases)
| Task | Phase | Interface Added |
|------|-------|----------------|
| T024 | 2 | ToolRegistry with getToolsForContext() |
| T066 | 4 | BrowserSessionManager (create/get/close) |
| T071 | 4 | SafetyContext with callingNode field |
| T081 | 5 | Browse graph accepts external session via state.browser_session_id |
| T127 | 7 | EvaluateStrategy pattern (StaticEvaluateStrategy default) |
| T143 | 8 | Session passing browse→analyze + restore_state node |

### Milestones
- **Phase 5:** ★ BROWSE WORKS — agent navigates real sites
- **Phase 8:** ★ MVP AUDIT — single-site audit end-to-end with cross-page analysis
- **Phase 9:** ★ PLATFORM READY — observability, PDF reports, executive summary, action plan
- **Phase 10:** ★ MVP v2.0 COMPLETE — state exploration, scoring, two-store, reproducibility
- **Phase 11:** ★ FULL PRODUCT — interactive composition, the competitive moat
- **Phase 12:** ★ MOBILE COMPLETE — dual-viewport audits with mobile-specific heuristics

---

## 23. NON-NEGOTIABLE ENGINEERING RULES

**R1: Source of Truth** — Browse: v3.1. Analyze: v1.0. Composition: §33. System: final-architecture/. Specs disagree → ASK.

**R2: Type Safety First** — Zod schemas BEFORE implementation. No `any` without justification. Every external boundary validated at runtime.

**R3: Test-Driven** — Write test first. Each task has smoke test. NEVER disable a failing test.

**R4: Browse Mode** — Tool names from v3.1 are EXACT. Confidence is MULTIPLICATIVE. Verify EVERY action. Safety gate is CODE. Browser session created by ORCHESTRATOR.

**R5: Analyze Mode** — Findings are HYPOTHESES. Three-layer filter. Self-critique is SEPARATE call with DIFFERENT persona. NEVER predict conversion impact. Two-stage heuristic filtering. Heuristics in USER MESSAGE. EvaluateStrategy pattern.

**R6: Heuristic IP** — Content NEVER in API responses/dashboards. AES-256-GCM at rest. Only IDs in DB. Redacted in traces.

**R7: Loose Coupling** — All external deps via adapters. No direct imports of Playwright/Anthropic SDK/pg outside adapter modules.

**R8: Spec-Driven** — Every decision traces to a REQ-ID. Unclear → ASK. Commit messages: task ID + REQ-ID.

**R9: §33 Interface-First** — Build composition interfaces in earlier phases. Static default. Interactive activates Phase 11.

**R10: Reproducibility** — temperature=0 for evaluate/self_critique. Snapshot by GATEWAY. Snapshot IMMUTABLE. Same inputs → same outputs.

---

## 24. KEY TYPES (TypeScript)

### PageStateModel (Browse Perception)
```
metadata: {url, title, timestamp, viewport}
accessibilityTree: {nodes: AXNode[], nodeCount, interactiveCount}
filteredDOM: {elements: FilteredElement[], totalElements, filteredElements}
interactiveGraph: {controls, controlCount, topControls}
visual?: {screenshotBase64, width, height}
diagnostics: {consoleErrors, failedRequests, pendingMutations}
```

### AnalyzePerception (Analysis Perception)
```
metadata, headingHierarchy, landmarks, semanticHTML, textContent,
ctas (with boundingBox + computedStyles + contrastRatio),
forms (with fields + validation info), trustSignals,
layout (foldPosition + visualHierarchy + whitespaceRatio),
images, navigation, performance (DOMContentLoaded + LCP)
```

### Finding Lifecycle
```
RawFinding (from evaluate) → ReviewedFinding (after self-critique, +critique_verdict)
→ GroundedFinding (after grounding, +evidence_verified +confidence_tier +auto_publish)
→ or RejectedFinding (+rejection_reason +rejected_by rule ID)
```

### StateNode (State Exploration)
```
state_id (sha256 hash), url, interaction_path, discovered_in_pass,
dom_hash, text_hash, is_default_state, parent_state_id,
perception (AnalyzePerception), screenshot_refs, trigger
```

### ReproducibilitySnapshot
```
prompt_versions (SHA256 hashes), model_versions (names + temps = 0),
heuristic_set (base_version + overlay_chain_hash + all IDs),
normalizer_version, grounding_rule_set_version, scoring_version
```

---

## 25. OBSERVABILITY & OPERATIONAL MONITORING (§34, v2.2)

**Three layers:**
1. **Structured logging** — Pino, JSON, mandatory correlation fields (audit_run_id, page_url, node_name, heuristic_id, trace_id). No console.log in production.
2. **Audit events** — 22 event types logged to `audit_events` table in real-time. Powers SSE streaming and post-hoc analysis.
3. **Derived metrics & alerting** — Heuristic health scores (per heuristic: total_evaluations, findings_produced, grounding_rejections, consultant_overrides → health_score). Audit-level: duration, actual cost, cost vs estimate, completion rate. Alerting: audit stuck >45min, grounding >80% rejection, cost >2x estimate, LLM 5+ errors in 10min.

**Operational dashboard:** `/console/admin/operations` — active audits with progress/ETA, 24h stats, heuristic health table (sortable by health_score), alert feed, 30-day cost trend. Admin role only.

---

## 26. GOLDEN TEST SUITE & QUALITY ASSURANCE (§36, v2.2)

**Golden test cases:** 20 saved page snapshots (AnalyzePerception + validated findings) with expected_findings and expected_false_positives per test.
**CI fast mode (every PR):** MockLLMAdapter with cached responses. Tests grounding, filtering, scoring. Zero API cost.
**CI nightly (scheduled):** Real LLM calls. ~$1-2/run. Catches prompt quality regressions.
**Pass criteria:** True positive rate ≥ 80%, false positive rate ≤ 20%, no individual test below 60% TP.
**Regression alerting:** Nightly scores drop >10% vs 7-day rolling average → P1 alert, blocks deployment.
**Offline mock mode:** `NEURAL_MODE=offline` — MockBrowserEngine + MockLLMAdapter from fixtures. Zero network, zero API cost for development.

---

## 27. WHAT COULD GO WRONG (HONEST ASSESSMENT)

1. **LLM reliability ceiling is ~80-86%.** WebArena best: ~62%. Our target is realistic for known sites only. Arbitrary sites will be lower. We mitigate with 3-layer filtering but cannot guarantee zero false positives.

2. **21.2% overlap with human experts.** The system will find things experts wouldn't, and miss things experts would find. This is the fundamental limitation — we can't fix it, only manage it through transparency (findings are hypotheses).

3. **Cost can spiral.** Interactive mode is 3-7x more expensive. Token-level cost accounting (v2.2) and pre-call budget gates mitigate this, but a bug in the CostTracker could still burn API credits. Kimi's gap analysis estimated real costs at $0.80/page static (2.3x our $0.35 estimate) — actual costs must be validated during development.

4. **Anti-bot arms race.** Stealth plugins work today but detection evolves. Amazon, Cloudflare, etc. constantly update. We need ongoing fingerprint rotation and fallback to HITL.

5. **Heuristic quality is the bottleneck.** The system is only as good as the 100 heuristics. Benchmark data (v2.2) improves finding quality, but authoring 100 heuristics with benchmarks is ~200+ hours of expert time. Golden test suite (§36) provides the quality gate, but only after sufficient golden tests are captured.

6. **State exploration complexity.** Two-pass exploration on dynamic SPAs is fragile. Elements may be non-deterministic (A/B tests, personalization). Meaningful-state detection heuristics may false-positive.

7. **Temporal + LangGraph integration (Phase 6+).** Durable orchestration adds significant operational complexity. Failure modes multiply with distributed state.

8. **Single-threaded page analysis.** 50 pages at $0.35/page sequential = ~30 minutes per audit. Parallel analysis is deferred (DD-01). This limits throughput.

9. **Cross-page analysis quality (v2.2).** Funnel analysis uses a single LLM call — medium reliability. Pattern detection and consistency checks are deterministic and reliable, but funnel findings may produce false positives on non-standard site architectures.

10. **Perception quality false negatives.** The quality gate may incorrectly skip pages that are actually auditable (e.g., a legitimate minimal landing page). Threshold tuning (0.6/0.3) needs validation against real sites during development.

---

## 28. REPO STRUCTURE

```
neural-nba/
├── apps/
│   ├── cli/                    # CLI app (pnpm cro:audit)
│   └── dashboard/              # Next.js 15 consultant + client dashboards
├── packages/
│   └── agent-core/             # Core library
│       └── src/
│           ├── browser-runtime/  # BrowserManager, StealthConfig
│           ├── perception/       # AX-tree, filters, mutation, screenshots
│           ├── mcp/              # MCP server, 28 tools, ToolRegistry
│           ├── safety/           # ActionClassifier, NavigationGuard
│           ├── verification/     # 9 verify strategies, VerifyEngine
│           ├── analysis/         # Pipeline nodes, grounding rules, scoring
│           │   ├── nodes/        # DeepPerceive, Evaluate, SelfCritique, Ground, Annotate, Store
│           │   ├── grounding/    # GR-001 through GR-012
│           │   ├── scoring/      # ScoringPipeline, IMPACT_MATRIX, EFFORT_MAP
│           │   ├── strategies/   # StaticEvaluateStrategy, InteractiveEvaluateStrategy
│           │   └── heuristics/   # Schema, loader, filters, encryption
│           ├── orchestration/    # AuditState, AuditGraph, BrowseGraph, nodes
│           ├── exploration/      # StateGraph, Pass 1/2, disclosure rules
│           ├── gateway/          # AuditRequest, validation, GatewayService
│           ├── reproducibility/  # SnapshotBuilder, TemperatureGuard
│           ├── storage/          # AccessModeMiddleware, TwoStore
│           ├── review/           # WarmupManager
│           ├── adapters/         # LLMAdapter, StorageAdapter, BrowserEngine
│           └── db/               # Drizzle schema, migrations
├── heuristics-repo/            # Private, 100 JSON heuristics, encrypted
├── docs/
│   └── specs/
│       ├── final-architecture/   # 35 spec files (§01-§33a)
│       └── mvp/                  # tasks-v2.md, constitution.md
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

*Document generated from 38 architectural specs (§01-§36 + §33a), 263 implementation tasks across 12 phases, and supporting materials. v2.2a refined from 4 independent LLM gap analyses + external architecture review. Every claim traces to a REQ-ID in the specification corpus.*
