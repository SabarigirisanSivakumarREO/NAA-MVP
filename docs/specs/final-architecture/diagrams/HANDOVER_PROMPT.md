# Session Handover — Neural Architecture Diagram Build

**Status:** Batch 3a complete. Batch 3b (engineering diagram) pending.
**Last session:** 2026-04-29
**Project root:** `C:\Sabari\Neural\NBA\`

---

## ROLE

You are an architecture mining agent for the Neural AI CRO Audit Platform.

**Behavior rules (do not violate):**
- Do not rush to output
- Do not assume missing information
- Do not hallucinate architecture
- Always link findings to source files
- Mark uncertainty clearly
- Use simple language for explanations
- Prefer structured outputs over paragraphs

**Hard scope rule:** Use ONLY the 38 files in `docs/specs/final-architecture/` as source of truth. Do NOT pull from:
- `CLAUDE.md` (MVP-scoped, numerically out of date relative to master plan — using it leads to wrong numbers)
- `docs/specs/mvp/` (MVP-scoped phase specs)
- `docs/Improvement/` (drafts with no `status:` frontmatter — Constitution R17 forbids loading)

The 38 files are: `README.md` + `01-system-identity.md` through `37-context-capture-layer.md` (with 3 superseded files: `31`, `32-collaborative-agent-protocol.md`, `32-interactive-analysis.md` — all replaced by `33`).

---

## PROJECT CONTEXT

**Product:** Neural — AI CRO Audit Platform for REO Digital. AI-driven conversion-rate-optimization audits delivered as branded PDFs and dashboards. Consultant-operated single-tenant pilot in MVP; multi-tenant SaaS by master plan.

**Architecture:** 4 parts × ~16 phases × 38 weeks. MVP exit at Phase 8 (week 19); Master architecture exit at Phase 16 (week 38).

**Tech (from §02 + §17):** TypeScript, Node 22, Turborepo+pnpm, Playwright, LangGraph.js + Temporal, Postgres+pgvector, Drizzle, Hono 4.x, Next.js 15, Clerk, Cloudflare R2, BullMQ on Redis, Pino, Resend, Vitest+Playwright Test, Fly.io+Vercel.

**Audience:** business stakeholders + engineers + AI agents. We build TWO diagrams to serve both.

---

## DELIVERABLE GOAL

Two interactive Plotly architecture diagrams in `docs/specs/final-architecture/diagrams/`:

| File | Status | Audience | Nodes |
|---|---|---|---|
| `architecture-business.html` | ✅ DONE in Batch 3a | Stakeholders, sales, leadership | 53 |
| `architecture-engineering.html` | ⏳ TO BUILD in Batch 3b | Engineers, architects, AI agents | ~120-140 |

Each node, when clicked, opens a side drawer showing:
1. Layer pill + node id + label
2. Purpose (1-line)
3. **Why it matters** (yellow callout)
4. **Internal architecture** (sub-components + internal flow) — most important field
5. What happens (steps)
6. Inputs / Outputs
7. **Dependencies** (services + data this node consumes)
8. Real example
9. Connected components (clickable)
10. Source spec files

Mermaid + JSON fallbacks accompany each diagram (postponed to Batch 3c).

---

## DECISIONS LOCKED BY USER

| # | Decision |
|---|---|
| 1 | Two diagrams (business + engineering), not one |
| 2 | A7 "AI-Driven Discovery" REMOVED (was not in any spec) |
| 3 | Apply ALL corrections from the gap-and-correction synthesis |
| 4 | CLAUDE.md remains MVP-scoped — do not modify it |
| 5 | Drawer must show: purpose, input, output, dependencies, internal architecture (the "current node architecture") |
| 6 | Strict scope: only the 38 final-architecture files |

---

## CANONICAL NUMBERS (from the 38 specs)

| Concept | Value | Source |
|---|---|---|
| Implementation phases | **16** (3 tracks × 38 weeks) | §16 |
| MVP exit | Phase 8 (week 19) | §16 |
| MCP tools | **28** (23 browse + 5 analysis) | §08 |
| Verify strategies | **9** (3 MVP active, 6 deferred) | §06 |
| Grounding rules | GR-001..GR-012 (~9 active in MVP: GR-001..GR-008 + GR-012) | §07 |
| Heuristics | **~100 in MVP** (50 Baymard + 35 Nielsen + 15 Cialdini), filtered to ~30 per page | §09 |
| Heuristic tier ratio | 42% Tier 1 / 42% Tier 2 / 16% Tier 3 | §09 |
| Storage tables | **40** (12 base + 15 extensions + 3 v2.2 + 1 view) | §13 |
| Audit event types | **22** | §34 |
| Failure modes | **94** (22 base + 72 extensions across 11 categories) | §15 |
| Safety controls | **13** named | §11 |
| Cost gates | **18** (5 budget + 9 runtime + tracker + kill-switch + early-stop) | §26 |
| 4D scoring formula | priority = severity×2 + impact×1.5 + confidence − effort×0.5 (range −3 to 24) | §23 |
| Page hard cap | 50 per audit | §04 |
| Audit budget | $15 default, $100 max | §11/§26 |
| Per-page budget | $2 default, $10 max (CAPS, not allocations) | §26 |

---

## ARCHITECTURE STRUCTURE (per README §)

The README organizes the 38 files into 4 parts:

| Part | Sections | Scope | Phases |
|---|---|---|---|
| **A — Agent Internals** | §01–§17 | Browser, Analysis, Heuristics, Orchestrator, Data, Delivery, Constitution | 1–8 (MVP) |
| **B — Platform Extensions** | §18–§30 | Gateway, Discovery, State Exploration, Workflow, Heuristic Evolution, Two-Store, Reproducibility, Cost, Durable, Learning, Hypothesis, Analytics | 9–14 |
| **C — Agent Composition** | §31, §32×2, §33, §33a | Tool injection. §31, §32a, §32b SUPERSEDED — only §33 + §33a are live | 10–13 |
| **D — Cross-Cutting** | §34–§37 + §20 v3.1 | Observability, Reports, Golden Tests, Context Capture | 4b, 12–16 |

**Master plan §03 layers (5 functional layers):** Orchestration → Browser Agent → Analysis Engine → Data → Delivery.

---

## SUPERSESSIONS (do NOT load)

Per README + Constitution R17:
- `31-state-aware-analysis.md` → superseded by §33
- `32-collaborative-agent-protocol.md` → superseded by §33
- `32-interactive-analysis.md` → superseded by §33

The "AnalysisScopeEnum" (global / per_state / transition) and tool-injection model from these files are absorbed into §33.

---

## DEFERRED FEATURES (post-MVP)

Per §02 (DD-01..DD-07) and various phase markers:
- DD-01 multi-agent coordination
- DD-02 vector search (Phase 12)
- DD-03 fine-tuning
- DD-04 Firefox engine
- DD-05 Kubernetes
- DD-06 weight calibration (after 6mo feedback)
- DD-07 multi-model evaluation
- §28 Learning Service compute (Phase 12; data collection from Phase 6)
- §29 Hypothesis Pipeline (Phase 14)
- §30 Analytics Bindings (Phase 15)
- §33 InteractiveEvaluateStrategy (Phase 11+; static is MVP)
- §36 Golden Test Suite full runner (Phase 7+; mocks Phase 0)
- WAREX daily regression (Phase 13)
- Operations Dashboard (Phase 9, built last)

---

## EXTRACTED COMPONENT INVENTORY

These are the named components from each spec file, extracted by 8 parallel reader agents in this session.

### §01 system-identity
- 3 user roles: CRO Consultant, Client, LLM/AI Agent
- 3 future interfaces (post-MVP): FixGenerator, ABTestGenerator, DesignRecommender
- Findings are HYPOTHESES, not VERDICTS (R5.1)
- Conversion prediction explicitly BANNED (regex-enforced via GR-007)
- 3-layer hallucination filter: CoT → self-critique → evidence grounding

### §02 architecture-decisions
- 25 locked decisions: SD-01..SD-14 + BA-01..BA-12
- 6 deferred decisions: DD-01..DD-07 (above)
- 3 browse modes: A Deterministic ($0), B Guided ($0.10/step, MVP default), C Computer-Use ($0.30/step)
- Hard safety gates at graph level, not LLM-discretionary
- Docker isolation per audit run

### §03 architecture-layers
- Layer 5 Delivery: CRO Audit MCP Server, Client Dashboard, Consultant Dashboard
- Layer 4 Data: PostgreSQL+pgvector, Cloudflare R2, Heuristic Repo (Private Git)
- Layer 3 Analysis Engine: Heuristic Evaluator, Evidence Grounder, Cross-Page Consistency Analyzer, Competitor Comparator, Screenshot Annotator, Version Diff Engine, Review Gate
- Layer 2 Browser Agent v3.1: Browse Mode (8 layers, 10 nodes, 23 tools), Analyze Perception (5 analysis tools)
- Layer 1 Orchestration: Audit Orchestrator, Job Scheduler (BullMQ, 20+ audits/week), Client Manager, Heuristic Filter, Event Emitter (SSE)
- 5-step pipeline: PERCEIVE → EVALUATE → SELF-CRITIQUE → GROUND → ANNOTATE (~6.5s/page)
- REQ-LAYER-005 v3: Layer 3 MAY interact with browser during evaluation (revised by §33)

### §04 orchestration
- Outer graph: audit_setup → page_router → cross_page_analyze (v2.2 NEW) → audit_complete
- 3 routing functions: routePageRouter, routeAfterBrowse, routeAfterAnalyze
- BrowseGraph + AnalyzeGraph as inner subgraphs
- Hard 50-page cap per audit

### §05 unified-state
- AuditState (LangGraph Annotation root)
- Phase 6+ extensions: trigger_source, audit_request_id, templates[], reproducibility_snapshot, state_graph, multi_state_perception, workflow_context, finding_rollups
- v2.2: perception_quality, page_signals[], pattern_findings, consistency_findings, funnel_findings, executive_summary, action_plan
- Maps serialized as tuples for Postgres
- Screenshots cleared after R2 write
- exploration_cost_usd is audit-wide cumulative
- Deterministic scoring config NOT in state (loaded via ScoringConfigLoader)

### §06 browse-mode
- 8 internal layers: Request & Policy, Orchestration, Perception, Action (23 MCP tools), Verification & Reflection, Memory & Replay, Safety & Approval, Evaluation & Observability
- 10 graph nodes (MVP runs 5): perceive, reason, act, verify, output (MVP) + classify_task, load_memory, safety_gate, reflect, hitl (deferred)
- 9 verify strategies: url_change, element_appears, element_text, network_request, no_error_banner, snapshot_diff, custom_js, no_captcha, no_bot_block (3 MVP, 6 deferred)
- 4 memory types (deferred): working, episodic, semantic, procedural
- Multiplicative confidence decay (R4.4 — additive math is a kill trigger)
- Ghost-cursor + Gaussian typing (anti-bot)
- Domain Circuit Breaker (3 fails / 1hr block)
- Overlay dismissal pre-perception (§6.17)
- Mode A: Deterministic, Mode B: Guided (MVP default), Mode C: Computer-Use
- WAREX stress testing (Phase 13)

### §07 analyze-mode
- 5 nodes: DeepPerceive, Evaluate, SelfCritique, Ground, Annotate_and_store
- Grounding rules GR-001..GR-012 (defined; GR-009/010 commented out for Phase 7+/8+):
  - GR-001 element exists
  - GR-002 fold position
  - GR-003 form field count
  - GR-004 contrast ratio
  - GR-005 heuristic_id in filtered set
  - GR-006 severity evidence
  - GR-007 NO conversion predictions (banned regex)
  - GR-008 valid data_point
  - GR-009 per-state provenance (Phase 7+)
  - GR-010 cross-step (Phase 9+)
  - GR-011 per-state evidence (in §33)
  - GR-012 benchmark validation (v2.2: ±20% quantitative or Levenshtein ≥0.6)
- AnalyzePerception versions: v2.3 base / v2.4 enrichments (10 fields: pricing, clickTargets, stickyElements, frictionScore...) / v2.5 PerceptionBundle envelope with ElementGraph
- Per-state screenshot capture (Phase 10+)
- Persona-based evaluation supports multiple personas
- Cross-page analysis uses lightweight PageSignals
- Self-critique uses SEPARATE persona (R5.6, ~30% FP reduction)
- Heuristics injected via USER message (not system prompt)

### §08 tool-manifest — ALL 28 TOOLS
**Browse (23):**
- Navigation (4): browser_navigate, browser_go_back, browser_go_forward, browser_reload
- Perception (3): browser_get_state, browser_screenshot, browser_get_metadata
- Interaction (8): browser_click, browser_click_coords, browser_type, browser_scroll, browser_select, browser_hover, browser_press_key, browser_upload
- Tab Management (1): browser_tab_manage
- Data (2): browser_extract, browser_download
- Discovery (2): browser_find_by_text, browser_get_network
- Control (2): browser_wait_for, agent_complete
- HITL (1): agent_request_human (LLM-triggered interrupt)
- Restricted (1): browser_evaluate (sandboxed, blocked on untrusted domains, no fetch/storage/navigation)

**Analysis (5):**
- page_get_element_info (bbox, computed styles, isAboveFold)
- page_get_performance (LCP, CLS, etc.)
- page_screenshot_full (full-page scrollable)
- page_annotate_screenshot (Sharp pin overlay)
- page_analyze (single-call 15-section comprehensive scan)

**Mode availability matrix:** browser_click_coords ONLY in Mode C; browser_get_state NOT in A or C.
**Safety classes:** safe / caution / sensitive / blocked.
**Deferred (NOT v1.0):** memory_save, memory_recall, browser_set_cookie, browser_drag_drop, browser_record_workflow.

### §09 heuristic-kb
- HeuristicSchema base + HeuristicSchemaExtended
- HeuristicKnowledgeBase, HeuristicLoader, HeuristicFilter (2-stage), TierValidator
- 100 heuristics MVP: 50 Baymard + 35 Nielsen + 15 Cialdini
- Tier ratio: 42/42/16
- Two-stage filter: Stage 1 business (~100→60-70), Stage 2 page (~60-70→15-20), cap 30/page
- Overlay system: base < brand < learned < client (client wins)
- IP protection: AES-256-GCM at rest, plaintext only in memory; never in API responses, logs, or LangSmith traces (Constitution R6/R9)
- Benchmark field REQUIRED on all heuristics (v2.2)
- 4-phase evolution: JSON → tagged JSON+rules → pgvector → learned

### §10 competitor-versioning
- CompetitorDetector (LLM-based)
- VersionDiffEngine (resolved/persisted/new tracking across audit versions)
- ComparisonFinding (pairwise dimension)
- ConsistencyFinding (cross-page, 6 dimensions: CTA, nav, color, typography, trust, footer)
- Competitor is a SEPARATE audit workflow (G1-FIX), not inline

### §11 safety-cost — 13 named controls
1. ActionClassifier (deterministic safe/caution/sensitive/blocked)
2. DomainPolicy (denylist/allowlist/default)
3. NavigationGuard (pre-execution + post-recovery via go_back if JS-triggered nav)
4. RobotsTxtValidator (robots.txt + ai-agent.txt)
5. FormSubmissionGuard (HARD-BLOCKS payment/purchase, no override)
6. CircuitBreaker (3 fails / 1hr block per domain)
7. BrowseRateLimiter (30/min global, 10-30/min per-domain, 2s per-session)
8. AnalysisRateLimiter (15K tokens/page, 500K/audit, max 3 LLM calls/page, sequential)
9. BudgetEnforcer ($15/audit, $5/page caps)
10. LLMCallLogger (atomic to llm_call_log)
11. PreCallBudgetGate (estimate before LLM call)
12. LLMRateLimiter (Redis sliding window)
13. Failover (Claude → GPT-4o per call; both down = pause 5m, retry, give up 15m)

### §12 review-gate
- FindingStatus state machine (13 states): generated → critiqued → grounded → published / delayed / held / rejected
- 4 dashboard sections: Needs Review | Publishing Soon | Published | Rejected
- FindingEdit (preserves original on edit)
- publishDelayedFindings BullMQ job (every 5 min, 24h hold)
- Mode A: real-time pass-through (returns ALL findings); Mode B: async gated
- Tier 1 auto-publish | Tier 2 24h delayed (extendable) | Tier 3 held
- Warm-up active → all findings held
- Evidence grounding failure = silent rejection

### §13 data-layer — 40 tables
- §13.1 base (12): clients, audit_runs, findings, finding_edits, rejected_findings, comparison_findings, consistency_findings, screenshots, sessions, domain_patterns, workflow_recipes, audit_log
- §13.6 extensions (15): heuristic_catalog, templates, template_members, workflows, workflow_steps, page_states, state_interactions, evidence, finding_rollups, heuristic_overlays, heuristic_calibration, reproducibility_snapshots, hypotheses, test_plans, variations, analytics_bindings, analytics_signals, audit_requests, published_findings (view), context_profiles
- §13.7 v2.2 (3+1): llm_call_log, audit_events, heuristic_health_metrics (mat view), published_findings (view materialized in Phase 10 if p95 latency >500ms)
- RLS via `app.client_id` session var
- Heuristic content NEVER in findings (only heuristic_id)
- state_ids[] = TEXT content hashes, not FKs (M9-FIX)
- context_profiles APPEND-ONLY (CREATE RULE no_update/no_delete)
- Reproducibility snapshot immutable + admin escape (`reo_snapshot_admin` role)

### §14 delivery-layer
- MCP Server with 8 read endpoints: cro_get_audit_summary, cro_get_findings, cro_get_finding_detail, cro_get_screenshot, cro_compare_versions, cro_get_competitor_comparison, cro_get_consistency_issues, cro_list_clients (cro_trigger_audit deferred Phase 11)
- Client Dashboard: 7 pages
- Consultant Dashboard: 6 pages (admin)
- Hono REST API: 12 endpoints
- NotificationAdapter: audit_completed / audit_failed / findings_ready_for_review → email (Resend, Postmark fallback) + webhook
- Operations dashboard built LAST (Phase 9)
- API key scoped to client_id; client sees findings + evidence + recommendation only (no heuristic logic)

### §15 failure-modes — 94 modes
- 22 base: F-01..F-12 (browse), AF-01..AF-10 (analysis), OA-01..OA-04 (audit-level)
- 72 extensions across 11 categories: Discovery (DF-01..07), State Exploration (SE-01..10), Workflow (WF-01..08), Heuristic Retrieval (HR-01..06), Trigger (TF-01..08), Reproducibility (RF-01..08), Cost (CG-01..08), Durable (DO-01..08), Learning (LS-01..05), Analytics (AB-01..05), Two-Store (TS-01..05)
- 7 response patterns: transient→retry, structural→reflect, blocked→HITL, hallucination→reject, malformed→retry, budget→graceful stop, crash→checkpoint

### §16 implementation-phases — 16 phases / 3 tracks / 38 weeks / ~130 artifacts
| Phase | Name | Weeks |
|---|---|---|
| 1 | Perception Foundation | 1-2 |
| 1b | Perception Extensions v2.4 | 2-3 |
| 1c | PerceptionBundle Envelope v2.5 | 3-5 |
| 2 | MCP Tools + Human Behavior | 5-7 |
| 3 | Verification & Confidence | 7-8 |
| 4 | Safety + Data Layer | 8-9 |
| 4b | Context Capture Layer v1.0 | 9-11 |
| 5 | Browse Mode MVP | 11-12 |
| 5b | Multi-Viewport + Popup + Triggers + Cookie | 12-15 |
| 6 | Heuristic KB | 15-16 |
| 7 | Analysis Pipeline (Static) | 16-18 |
| **8** | **Audit Orchestrator + Single-Site Audit — MVP MILESTONE** | **18-19** |
| 9 | Competitor + Versioning | 19-21 |
| 10 | Client Mgmt + Review Gate | 21-22 |
| 11 | Delivery + Report Gen | 22-24 |
| **12** | **Production Phase 1 — PRODUCT MILESTONE** | **24-26** |
| 13 | Gateway + Discovery + Workflows + State Exploration Formalization | 26-30 |
| 13b | Context Capture Phase 2 v2.0 | 30-31 |
| 14 | Agent Composition + Interactive Evaluate | 31-33 |
| 15 | Durable + Repro + Two-Store + Cost | 33-35 |
| **16** | **Learning + Evolution + Hypothesis + Analytics + Observability — MASTER MILESTONE** | **35-38** |

Critical ordering: Phase 13 (state exploration) MUST precede Phase 14 (composition).

### §17 context-preservation
- Engineering Constitution (10 rules): Rule 9 "Heuristics are SECRET"
- Repository: monorepo (pnpm + Turbo); apps/{api,dashboard,workers} + packages/agent-core
- 9 swappable adapter interfaces: LLMAdapter, StorageAdapter, ScreenshotStorage, BrowserEngine, NotificationAdapter, HeuristicLoader, Auth, DiscoveryStrategy, DecryptionAdapter
- Future interfaces (NOT implemented): FixGenerator, ABTestGenerator, DesignRecommender
- Session Handover Prompt template for new sessions

### §18 trigger-gateway
- Channel Adapters (5): CLI, MCP read, MCP write, Dashboard, Scheduler
- Auth Resolver (Clerk)
- Normalizer
- Permission Check
- Rate Limiter (per-client concurrency = 1 default)
- Validator (Zod)
- Idempotency window: 24 hours
- ReproducibilitySnapshot CREATED BY GATEWAY (not orchestrator) BEFORE Temporal workflow start
- Scheduler uses Temporal Schedules (not BullMQ); BullMQ for non-audit jobs only
- Webhook delivery uses exponential backoff + DLQ (REQ-TRIGGER-STREAM-003a, M4-FIX)

### §19 discovery-and-templates — 7 stages
1. Seed Acquisition (cap 500)
2. Shallow Fetch
3. Exclusion Filter
4. Template Clustering (HDBSCAN, deterministic; CSS classes excluded; agglomerative fallback)
5. Template Classification (1 batched LLM call, default 'other' if <0.5 confidence)
6. Representative Page Selection
7. Workflow Synthesis (feeds §21)

SPA shell detection: <10 meaningful elements + JS bundles >500KB → flag.
Cost ~$0.05, 5 min hard cap.

### §20 state-exploration
- explore_states node (Phase 7+)
- StateGraph + StateNode + MultiStatePerception
- Pass 1: Heuristic-Primed (always runs)
- Pass 2: Bounded-Exhaustive (12 disclosure rules R1..R12, conditional on auto-escalation)
- 12 disclosure rules: details/summary, tabs, aria-expanded buttons, accordion, size/variant selectors, quantity, dropdowns, filters, modal triggers, form validation, cookie banner, chat widget
- Meaningful-state detector: Jaccard distance on tokenized text, 4 thresholds (textJaccard >0.15, newInteractiveCount >3, aboveFoldDiff >0.10, ctaChanged)
- Self-restoring vs destructive interaction classification (C4-L2-FIX)
- Hybrid reset (Phase 13): reverse_action vs reload+replay
- Storage Snapshot Restoration (cookies + localStorage + sessionStorage)
- Nondeterminism Detector (re-replay first 3 captured states, hash diff)
- 8 trigger types: click, hover, focus, scroll, time-delay, exit-intent, input-change, form-submit
- Cap: ≤15 states/page (C5-FIX)
- GR-009 provenance grounding (gated behind Phase 7)

### §21 workflow-orchestration (Phase 9)
- WorkflowOrchestrator (peer Tier 2b subgraph, separate from page orchestrator)
- 5 nodes: workflow_init, step_router, step_execute, workflow_analyze, workflow_persist
- WorkflowContext state type
- ONE shared Playwright browser context across all funnel steps (S9-L2-FIX)
- 8 cross-step analysis dimensions
- GR-010: cross-step finding must reference ≥2 different steps

### §22 heuristic-retrieval-evolution — 4-phase roadmap
- Phase 1: JSON bundle (encrypted)
- Phase 2: Tagged JSON + overlays + rule/guidance split + RuleHeuristicRegistry (10-15 detectors)
- Phase 3: Postgres catalog + pgvector retrieval (5,000+ heuristics)
- Phase 4: Learned client-specific calibration + analytics signals (Phase 16)
- RuleDetector: confidence 0.9+, LLM only generates recommendation text (C4-FIX, reduced critique)
- Cap 30/page hard limit
- Mixed embedding versions FORBIDDEN
- Failure modes HR-01..HR-06

### §23 findings-engine-extended
- Finding scope hierarchy: atomic → page → template → workflow → audit
- Deduplication: cross-state, cross-page, semantic (Phase 3+ only)
- Deterministic scoring: severity, confidence, business_impact (page_type × funnel_position matrix), effort, priority
- Priority formula: severity×2.0 + impact×1.5 + confidence×1.0 − effort×0.5 (range −3 to 24)
- Dedup threshold: >60% of template pages → template finding
- Suppression rules
- Positive findings (off by default; bypass self-critique; reduced grounding GR-001 + GR-007 + GR-008 only)
- Rollup persistence (finding_rollups table)

### §24 two-store-pattern
- Internal Store (`findings` table, all rows visible to consultants)
- Published Store (`published_findings` view, filtered by `app.access_mode='published_only'`)
- 2-layer enforcement: app queries view + RLS policy on findings table
- SET LOCAL inside transactions (M4-L2-FIX)
- Warm-up state machine: defaults ON for new clients; graduate at audit_count ≥ 3 AND rejection_rate < 25%
- Published view STRIPS heuristic_id (IP), full evidence JSONB (replaced with evidence_summary), critique_verdict, grounding_rules_passed
- Delayed publish worker re-checks warm-up at 24hr expiry

### §25 reproducibility
- ReproducibilitySnapshot (immutable, 6 version pins: model_version + 3 prompt_hashes + heuristic_pack_hash + ContextProfile_hash + perception_schema_version + scoring_version)
- TemperaturePolicy (temp=0 enforced for evaluate/critique/self_critique/evaluate_interactive — REQ-REPRO-001)
- SnapshotImmutabilityTrigger (DB raises EXCEPTION on UPDATE/DELETE; reo_snapshot_admin escape)
- OverlapMeasurer (≥90% target; below = diagnostic, NOT failure; emits `reproducibility_warning` tag)
- FindingDiffExplainer (Phase 9)
- RerunRequest (Phase 11; deprecated heuristic versions remain loadable indefinitely)
- LangSmithTracer
- Snapshot CREATED BY TRIGGER GATEWAY (REQ-REPRO-031, NOT audit_setup which only reads it)

### §26 cost-and-guardrails — 18 gates
- Pre-flight Cost Estimator (estimatePageCost)
- 5 budget gates: audit ($15 default, $100 max), discovery ($0.05 fixed), page ($2 default, $10 max), exploration ($0.50 default, $2 max), workflow ($3 default, $15 max)
- 9 runtime gates: dequeue, before-browse, before-LLM, before-explore-pass-1, before-explore-pass-2, before-evaluate, before-critique, before-workflow-step, before-workflow-analysis
- Post-LLM-Call Cost Tracker (atomic to llm_call_log)
- Kill-Switch (haltClient, haltGlobal, haltAudit via Temporal cancellation)
- Early Stop Detector (budget <10% + ≥70% templates done; or runtime >80% + ≥70% templates; or all funnel-critical templates done)
- Per-item budgets are CAPS, NOT allocations (S8-L2-FIX)
- Exploration cost multiplier: heuristic_primed_only ($0.05) vs thorough_mode ($0.35)
- Interactive mode: 2-8× LLM cost + 15-90s latency overhead

### §27 durable-orchestration (Phase 6)
- AuditWorkflow (Temporal workflow class) WRAPS LangGraph
- 9 Temporal activities: resolveClient, loadReproducibilitySnapshot, runDiscovery, runPageOrchestrator, runWorkflowOrchestrator, runRollupAndScoring, runCrossPageConsistency, applyReviewGate, finalizeAudit
- 2 task queues: audit-orchestration, audit-execution
- Activity timeouts: 10s–12m per type
- Heartbeat interval: 10s
- LangGraph Postgres checkpointer RETAINED for diagnostics ONLY — Temporal handles crash recovery
- Activity retries = FRESH LangGraph session (not from checkpoint)
- continueAsNew() at 40K events / 40MB (M6-L2-FIX)
- Page timeout 5m for escalation loops (S6-L2-FIX)

### §28 learning-service (Phase 12 compute, Phase 6 collect)
- CalibrationJob (batch processor)
- approval_rate → reliability_delta clamped [-0.3, +0.2]
- severity_override (per-client)
- suppress_below_confidence (per-client floor)
- Crystallisation candidates (Phase 16): same heuristic + edits on >5 findings + >70% consistency
- Approval rate thresholds: 0.8 positive, 0.4 negative (tier-specific in Phase 12 — M1-L3-FIX needs Tier 3 negative ~0.3)
- Idempotent
- Stale calibration (>90 days) ignored per HR-05
- Failure modes LS-01..LS-05

### §29 hypothesis-pipeline (Phase 14)
- HypothesisGenerator (LLM, gated)
- TestPlanGenerator (deterministic stats — sample size formula, NOT LLM)
- VariationIdeaGenerator (LLM, gated; code snippets DRAFT only — never auto-deployed, M2-L3-FIX)
- All gated by consultant review
- Confidence majority rule: >50% of source findings determines hypothesis confidence tier
- Max 10 hypotheses per audit
- Phase 15: A/B test result ingestion → Learning Service feedback
- Phase 16: Mockup generation (DesignRecommender interface)

### §30 analytics-bindings — Phase 15 DEFERRED
- AnalyticsBinding (provider config, credential_ref to secret manager)
- AnalyticsSignal (page/template/workflow-scoped, signal_type + signal_unit semantic unit)
- AnalyticsProviderAdapter (per-provider: GA4, Contentsquare, FullStory)
- Analytics Sync Worker (BullMQ, non-audit, rate-limited per provider)
- Aggregated only — no per-user PII
- Custom URL-to-template mapping (page_url_mapping, M3-L3-FIX)

### §33 agent-composition-model (Phase 11+ activation, interfaces in Phase 2-8)
- Tool injection from Browser Agent into Analysis Agent (NOT plugin/orchestrator/merge)
- 9 browser tools injected: click, hover, select, type, press_key, scroll, get_state, screenshot, find_by_text
- 6 analysis tools injected: page_analyze, page_get_element_info, page_get_performance, produce_finding, mark_heuristic_pass, mark_heuristic_needs_review
- 14 browser tools EXCLUDED from analysis: navigate, go_back/forward, tab_manage, download, upload, evaluate, extract, click_coords, reload, get_metadata, get_network, agent_complete, agent_request_human
- HeuristicInteractionTracker (Phase 11)
- SafetyContext (analysis-aware classifier)
- BrowserSessionManager (external session injection — orchestrator owns lifecycle)
- 2-layer Navigation Guard: pre-execution + post-execution recovery (go_back if JS-triggered)
- REQ-COMP-011a: Enter key reclassified to "sensitive" inside `<form>`

### §33a composition-integration
- ToolRegistry (Phase 2; getToolsForContext(context: ToolContext))
- SafetyContext (Phase 4)
- BrowserSessionManager (Phase 4)
- EvaluateStrategy (Phase 7; pluggable: StaticEvaluateStrategy + InteractiveEvaluateStrategy stub)
- restore_state node (Phase 8, no-op in static)
- StateGraph (Phase 10, frozen after explore_states)
- InteractionRecord + OpenObservation (Phase 7 state)
- Interface cost: 2-3 days across Phases 2-8; refactoring savings: 2-3 weeks in Phase 11
- Static mode unchanged with or without §33 interfaces
- Phase 2 SHALL define 3 analysis output tools as schemas

### §34 observability — 3 layers
- Layer 1: Pino structured logging (no console.log; mandatory correlation fields: audit_run_id, client_id, page_url, node_name, heuristic_id, trace_id)
- Layer 2: audit_events table (append-only, 90d retention) + SSE streaming + 22 AuditEventType
- Layer 3 (Phase 9): metrics + 7 alerting rules + Operational Dashboard `/console/admin/operations`
- 22 AuditEventType: audit_started, page_browse_started, finding_produced, grounding_rejected, finding_published, budget_warning, budget_exceeded, llm_call_completed, llm_call_failed, llm_provider_fallback, perception_quality_low, hitl_requested, cross_page_analysis_completed, overlay_dismissed, ...
- 7 alerts: audit stuck, grounding high, heuristic health low (<0.3), cost overrun, llm errors, failure cluster, ... (debounced per audit_run_id, max 1× per hour per type)
- HeuristicHealthMetrics (materialized view; health_score < 0.3 → flag for rewrite, feeds §28)
- 8 audit-level metrics + 8 heuristic-level metrics
- Sensitive data FORBIDDEN in logs (R6/R9): heuristic content (only IDs), credentials, full DOM, PII

### §35 report-generation (Phase 9 v2.2)
- ExecutiveSummary: overall_score 0-100, grade A-F, critical/high/medium/low counts, top 5 by priority, category breakdown, strengths, patterns, recommended_next_steps
- ActionPlan: 4 quadrants (quick_wins / strategic / incremental / deprioritized), deterministic bucketing
- ReportGenerator (Next.js HTML → Playwright page.pdf())
- ReportTemplate (client logo, colors, branding)
- Score is DETERMINISTIC: 100 − (critical×15 + high×8 + medium×3 + low×1), clamped 0-100
- Strengths detected deterministically (≥80% passing pages)
- recommended_next_steps = 1 LLM call only, temp=0, $0.10 budget, GR-007 final regex check
- Action plan bucketing: high impact + low effort = quick_wins (high impact = business_impact ≥6; low effort = effort_hours ≤8)
- 8 sections: Cover, Exec Summary, Action Plan, Findings by Category, Cross-Page Patterns, Funnel, Methodology, Appendix
- PDF < 5MB (JPEGs 70%, max 50 crops, fonts subset)
- ONLY published findings included

### §36 golden-test-suite
- GoldenTestCase (frozen perception + page_type + heuristics + expected_findings + expected_false_positives)
- MockBrowserEngine (saved perceptions + screenshots, no network)
- MockLLMAdapter (cached responses from last nightly)
- Fast Mode (MockLLM, 30s, in PR CI)
- Nightly Mode (real LLM, $1-2, regression detection)
- Pass criteria: ≥80% TP, ≤20% FP, no test < 60% TP
- Regression alert: nightly drop >10% blocks deployment (P1 alert)
- Offline mode: NEURAL_MODE=offline (MockBrowser + MockLLM, dev only, zero cost)
- CLI: `pnpm golden:capture --audit-run-id <id> --page-url <url>`
- Phase 0 mock infrastructure, Phase 1 fixture capture, Phase 7+ runner; built FROM real audits post-Phase 5
- Hand-crafted first 5 during Phase 1-5; target 20 by Phase 9
- Golden tests are regression safety net, NOT development blocker (REQ-GOLDEN-051)

### §37 context-capture-layer (Phase 4b MVP)
- ContextProfile (5 dimensions × per-field {value, source, confidence})
- 6 ContextSources: user, url_pattern, schema_org, copy_inference, layout_inference, default
- 5 dimensions:
  - Business: archetype, aov_tier, cadence, vertical
  - Page: type, funnel_stage, job, is_indexed
  - Audience: buyer, awareness_level, decision_style, sophistication
  - Traffic: primary_sources, device_priority, mobile_share, geo_primary, locale_primary
  - Goal: primary_kpi (REQUIRED), secondary_kpis, current_baseline, target_lift, constraints
  - Constraints: regulatory, accessibility, brand, technical
- Confidence thresholds: ≥0.9 act, 0.6-0.9 use+flag, <0.6 emit as open_question
- Blocking flag halts audit_setup (e.g., missing primary_kpi or required regulatory constraints)
- Inference signal order: JSON-LD @type > pricing patterns > CTA copy > domain TLD > price magnitude
- HTML inference fetch: single GET via undici/node-fetch (NOT Playwright), respect robots.txt, realistic UA, 5s timeout, cache by URL+ETag
- Phase 13b additions: Schwartz awareness levels, message-match, decision_style, weight modifiers
- Constitution R25 MUST NOT list

---

## BUSINESS DIAGRAM (DONE)

File: `docs/specs/final-architecture/diagrams/architecture-business.html`

53 nodes across 16 layers. Each node has full drawer schema (purpose, internal_architecture with components+flow, dependencies, inputs, outputs, why_matters, example, connected_to, source_files).

Layer color palette:
```
1  User/Trigger             #0EA5E9
2  Context Capture          #475569
3  Orchestration             #2563EB
4  Browser Perception        #06B6D4
5  Dynamic State             #14B8A6
6  Evidence Packaging        #10B981
7  Heuristics                #F59E0B
8  AI Analysis               #7C3AED
9  Insight Generation        #C026D3
10 Reporting & Delivery      #16A34A
11 Storage & Observability   #78716C
12 Human Review              #F97316
13 Learning Loop (v1.1+)     #BE185D
14 Roadmap & Future          #6B7280
15 Safety/Cost/Failure       #DC2626
16 Quality & Adapters        #0891B2
```

Verified live in preview: 53 nodes, 16 layer bands, 83 arrows, all drawers render with new dependencies + internal_architecture sections.

---

## ENGINEERING DIAGRAM (BATCH 3b — TO BUILD)

**File:** `docs/specs/final-architecture/diagrams/architecture-engineering.html`

**Target:** ~120-140 nodes, organized per README's 4 parts.

**Audience:** engineers, architects, AI agents (Claude Code) needing full corpus fidelity.

**Same drawer schema as business view.** Each node click opens detail drawer with:
- Purpose
- Why it matters
- Internal architecture (sub-components + internal flow) — most important
- What happens (steps)
- Inputs / Outputs
- Dependencies (typed: service / data / interface)
- Example
- Connected components (clickable navigation)
- Source spec file paths

**Proposed organization (16 layers in engineering view, mapped to README's 4 parts):**

### Part A — Agent Internals (§01–§17) — Layers 1-9
| Layer | Title | Source spec(s) | Approx node count |
|---|---|---|---|
| 1 | Vision & Decisions | §01, §02, §03 | 5-6 |
| 2 | Constitution & Engineering | §17 | 4-5 (10 rules + adapter pattern + 9 adapters) |
| 3 | Audit State Contract | §05 | 4 (AuditState root + browse fields + analyze fields + extensions) |
| 4 | Audit Orchestrator | §04 | 5 (4 nodes + routing) |
| 5 | Browser Mode | §06, §08 | 25 (10 graph nodes + 28 tools by category + 9 verify strategies + 3 modes) |
| 6 | Analyze Mode | §07 | 12 (5 nodes + 9 grounding rules + perception versions) |
| 7 | Heuristic KB | §09 | 6 (schema, tiers, filter stages, IP protection, overlay system, evolution phases) |
| 8 | Competitor & Versioning | §10 | 4 (CompetitorDetector, VersionDiffEngine, ComparisonFinding, ConsistencyFinding) |
| 9 | Safety & Cost (base) | §11 | 13 (all named controls) |
| 10 | Review Gate | §12 | 6 (state machine, modes, tier routing, warmup, edits, dashboard) |
| 11 | Data Layer | §13 | 8 (40 tables in 8 logical groups) |
| 12 | Delivery Layer | §14 | 8 (MCP server, 2 dashboards, Hono API, NotificationAdapter, 4 channels) |
| 13 | Failure Modes | §15 | 4-5 (94 modes by 11 category + 7 response patterns) |
| 14 | Implementation Phases | §16 | 4 (3 tracks + dependency graph + critical ordering) |

### Part B — Platform Extensions (§18–§30) — Layers 15-22
| Layer | Title | Source | Nodes |
|---|---|---|---|
| 15 | Trigger Gateway | §18 | 8 (5 channels + auth + validate + idempotency + rate limit + webhook DLQ) |
| 16 | Discovery Pipeline | §19 | 7 (7 stages) |
| 17 | State Exploration | §20 | 8 (Pass 1, Pass 2, 12 disclosure rules grouped, meaningful-state detector, reset, snapshot, nondeterminism, GR-009) |
| 18 | Workflow Orchestration | §21 | 5 (5 nodes) |
| 19 | Heuristic Evolution | §22 | 4 (4 phases) |
| 20 | Findings Engine | §23 | 6 (5 scopes + scoring + dedup + suppression + positive findings + rollups) |
| 21 | Two-Store Pattern | §24 | 4 (internal, published view, access mode middleware, warm-up state machine) |
| 22 | Reproducibility | §25 | 6 (snapshot, temperature policy, immutability trigger, overlap measurer, diff explainer, rerun) |
| 23 | Cost Architecture | §26 | 8 (estimator, 5 budget gates, kill-switch, early-stop) |
| 24 | Durable Orchestration | §27 | 10 (AuditWorkflow + 9 activities) |
| 25 | Learning Service | §28 | 4 (CalibrationJob, deltas, crystallisation, failure modes) |
| 26 | Hypothesis Pipeline | §29 | 4 (3 generators + sample size deterministic) |
| 27 | Analytics Bindings | §30 | 4 (binding, signal, adapter, sync worker) |

### Part C — Agent Composition (§33, §33a) — Layer 28
| Layer | Title | Source | Nodes |
|---|---|---|---|
| 28 | Agent Composition (Phase 11+) | §33, §33a | 8 (Tool Registry, SafetyContext, BrowserSessionManager, EvaluateStrategy interface, StaticEval, InteractiveEval, HeuristicInteractionTracker, restore_state) |

### Part D — Cross-Cutting (§34–§37) — Layers 29-32
| Layer | Title | Source | Nodes |
|---|---|---|---|
| 29 | Observability | §34 | 6 (Pino, 22 AuditEventType, metrics, alerts, ops dashboard, HeuristicHealthMetrics) |
| 30 | Report Generation | §35 | 5 (ExecSummary, ActionPlan, ReportGenerator, ReportTemplate, 8 PDF sections) |
| 31 | Golden Test Suite | §36 | 5 (GoldenTestCase, MockBrowser, MockLLM, Fast Mode, Nightly Mode) |
| 32 | Context Capture | §37 | 7 (ContextProfile, 5 dimensions, inference pipeline, blocking gate, 6 sources) |

**Total estimated nodes:** ~145 across 32 layers.

**Layout strategy:** unlike the business view (12-layer top-to-bottom funnel), the engineering view should use **swimlanes per Part** with collapsible groups. Or: a multi-band horizontal layout where each Part is a vertical band of layers. Recommend Plotly subplots or shapes for clarity.

**Edge density:** higher — every cross-spec reference (e.g., §07 → §33, §11 → §26 → §27, §13 → §24 → §34) becomes an edge. Use flow-type colors aggressively. Cross-cutting infra edges drawn faded (opacity 0.3).

**Suggested first sub-batch (3b.1):** Build skeleton + Part A (Layers 1-14, ~80 nodes).
**3b.2:** Add Part B (Layers 15-27, ~70 nodes).
**3b.3:** Add Parts C+D (Layers 28-32, ~30 nodes).
**3b.4:** Edges + verify.

Each sub-batch is one Write call (full file rewrite each time, additive).

---

## DRAWER SCHEMA (use exactly this for every node)

```js
{
  id: "string (e.g. T1, A4, SC1)",
  label: "string (e.g. 'Trigger Gateway')",
  layer: number,                              // 1..32
  x: number,                                  // grid position
  y: number,                                  // grid position
  purpose: "1-line plain-English purpose",
  what_happens: ["step 1", "step 2", ...],    // bullets
  inputs: ["typed input 1", ...],
  outputs: ["typed output 1", ...],
  dependencies: [
    { type: "service|data|interface", name: "string", reason: "why this node needs it" }
  ],
  internal_architecture: {
    summary: "1-2 sentences of internal architecture",
    components: [
      { name: "SubComponent", role: "1-line role" }
    ],
    internal_flow: [
      "step 1 → step 2",
      "step 2 → step 3",
      ...
    ]
  },
  why_matters: "Plain-English business value (yellow callout)",
  example: "Concrete real-world example (blue callout)",
  connected_to: ["NodeId1", ...],             // for fallback if edge map fails
  source_files: ["docs/specs/final-architecture/NN-name.md", ...]
}
```

---

## EDGES (engineering view)

Flow types and colors (carry over from business view):

| flow_type | Color | Style | Width | Use |
|---|---|---|---|---|
| control | #1F2937 | solid | 1.5 | Triggering & coordination |
| data | #2563EB | solid | 1.5 | Domain object hand-off |
| evidence | #0D9488 | solid | 1.5 | Screenshots / DOM / traces |
| analysis | #7C3AED | solid | 2.0 | AI-derived outputs |
| report | #16A34A | solid | 2.0 | Deliverable rendering |
| feedback | #F97316 | dashed | 1.5 | Approvals, retries, learning |
| infra | #9CA3AF | dotted | 1.0 | Storage / observability |
| safety | #DC2626 | solid | 1.2 | Safety / cost gates |

---

## FILES IN THE DIAGRAMS FOLDER

```
docs/specs/final-architecture/diagrams/
├── architecture-business.html        ✅ Batch 3a — 53 nodes, 16 layers, drawer with internal_architecture
├── architecture-engineering.html     ⏳ Batch 3b — TO BUILD
├── architecture-interactive.html     🟡 LEGACY — pre-correction; will be retired or merged
├── architecture-nodes.json           🟡 LEGACY
├── architecture-edges.json           🟡 LEGACY
├── architecture-fallback.mmd         🟡 LEGACY (Mermaid for old build)
├── master-architecture.html          (existing static diagram, keep)
├── demo-lifecycle-guide.md           (existing, keep)
├── HANDOVER_PROMPT.md                ← THIS FILE
└── archive/                          (older diagrams)
```

---

## PREVIEW SERVER

A preview server is running at http://localhost:3456 mounted at the docs folder.

URL pattern: `http://localhost:3456/final-architecture/diagrams/<filename-without-ext>`.

Verify with:
```javascript
window.location.href = '/final-architecture/diagrams/architecture-engineering';
```

Then:
```javascript
const div = document.getElementById('diagram');
({
  nodeCount: div.data[0].customdata.length,
  layerCount: (div.layout.annotations || []).filter(a => a.text?.startsWith('<b>')).length,
  arrows: (div.layout.annotations || []).filter(a => a.showarrow).length
})
```

---

## NEXT IMMEDIATE STEP

Build `architecture-engineering.html` in 3b.1 (Part A skeleton). One Write call. ~80 nodes initially. Use the same template as `architecture-business.html` (copy structure). Each node carries the full drawer schema above.

After 3b.1 verifies in preview, continue with 3b.2 (Part B), 3b.3 (Parts C+D), 3b.4 (edges + final verify).

---

## CONSTITUTION GOVERNANCE (from §17 + Constitution R17/R19/R20)

- Every spec carries `status:` in YAML frontmatter
- Load only `validated`, `approved`, `implemented`, `verified` artifacts
- Do NOT load `superseded`, `archived`, `draft`
- Heuristics are SECRET (Rule 9) — never in API responses, logs, or LangSmith traces

---

*End of handover. Resume Batch 3b.*
