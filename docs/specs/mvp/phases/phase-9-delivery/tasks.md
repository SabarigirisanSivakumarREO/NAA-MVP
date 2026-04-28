---
title: Phase 9 — Foundations + Delivery — Tasks
artifact_type: tasks
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/tasks-v2.md (Phase 9 sections — T156-T175 master foundations + T239-T244 observability + T245-T249 report generation + T256-T257 DiscoveryStrategy + T260-T261 NotificationAdapter)
  - docs/specs/mvp/phases/phase-9-delivery/spec.md
  - docs/specs/mvp/phases/phase-9-delivery/plan.md
  - docs/specs/mvp/phases/phase-9-delivery/impact.md

req_ids:
  - REQ-TRIGGER-CONTRACT-001..004
  - REQ-TRIGGER-VALIDATE-001..003
  - REQ-TRIGGER-PERSIST-001..003
  - REQ-REPRO-001..010, REQ-REPRO-031..032
  - REQ-TWOSTORE-001..031
  - REQ-FINDINGS-SCORE-001..051
  - REQ-FINDINGS-SUPPRESS-001..002
  - REQ-DELIVERY-004..007, REQ-DELIVERY-REPORT-001..003, REQ-DELIVERY-OPS-001..003, REQ-DELIVERY-NOTIFY-001..003
  - REQ-REPORT-001..030
  - REQ-OBS-001..042

impact_analysis: docs/specs/mvp/phases/phase-9-delivery/impact.md
breaking: false
affected_contracts:
  - AuditRequest (PRODUCER — first runtime)
  - reproducibility_snapshot (PRODUCER — T160 supersedes Phase 8 T145)
  - ScoredFinding (PRODUCER)
  - Hono API + Next.js render (PRODUCERS — first R6 ch3+4 runtime)
  - NotificationAdapter (PRODUCER — NEW)
  - DiscoveryStrategy (PRODUCER — NEW)

delta:
  new:
    - Phase 9 tasks — 35 tasks scoped view (T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261)
    - T160 SnapshotBuilder supersession of Phase 8 T145 scaffold protocol documented in plan.md §2
    - R6 channels 3 + 4 first-runtime activation surface + conformance tests documented in plan.md §3
    - ExecutiveSummary GR-007 retry-then-fallback enforcement documented in plan.md §4
  changed: []
  impacted: []
  unchanged:
    - All 35 task IDs and acceptance criteria carried verbatim from tasks-v2.md Phase 9 sections

governing_rules:
  - Constitution R5.3 + GR-007 (no conversion predictions)
  - Constitution R6 (heuristic IP — channels 3+4 activate)
  - Constitution R7.4 (append-only)
  - Constitution R8.1 ($15 cap)
  - Constitution R10 + R13 (temp=0)
  - Constitution R14.1 (atomic llm_call_log)
  - Constitution R20, R23
---

# Phase 9 Tasks (T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261)

> **Summary (~80 tokens):** 35 tasks across 6 sub-blocks: A foundations (T156-T168), B dashboard (T169-T173), C delivery (T245-T249), D adapters (T256-T257, T260-T261), E observability (T239-T243), F acceptance + ops dashboard LAST (T174-T175, T244). Total ~90h ≈ 10-12 engineering days. Canonical definitions in `tasks-v2.md` Phase 9 sections — this file is a phase-scoped view; do NOT modify in lieu of updating `tasks-v2.md`.

**Source of truth:**
- T156-T175 — `docs/specs/mvp/tasks-v2.md` "Phase 9: Master Foundations [NEW]" section
- T239-T244 — `docs/specs/mvp/tasks-v2.md` "Phase 9: §34 Observability" section
- T245-T249 — `docs/specs/mvp/tasks-v2.md` "Phase 9: §35 Report Generation" section
- T256-T257 — `docs/specs/mvp/tasks-v2.md` "Phase 9: DiscoveryStrategy" section
- T260-T261 — `docs/specs/mvp/tasks-v2.md` "Phase 9: NotificationAdapter" section

Acceptance criteria, file paths, and dependencies below mirror canonical sources verbatim — **do NOT modify this file in lieu of updating `tasks-v2.md`**.

---

## Phase 9 sequencing

Per [plan.md §1](plan.md): Block A foundations (Days 1-3) → Block B dashboard (Days 4-5) → Block C delivery (Days 6-7) → Block D adapters (Day 8) → Block E observability (Days 9-10) → Block F acceptance + ops dashboard LAST (Days 11-12). T244 ops dashboard built LAST per REQ-DELIVERY-OPS-003 + §35.6.

---

## Block A — Foundations core (Days 1-3)

### T156 — AuditRequest contract (TypeScript + Zod) [NEW]
- **dep:** T002
- **spec:** §18.4 REQ-TRIGGER-CONTRACT-001..002
- **files:** `packages/agent-core/src/gateway/AuditRequest.ts`
- **acceptance:**
  - Full AuditRequest interface matching §18.4
  - Zod schema for runtime validation
  - Includes target, scope, budget, heuristic_set, notifications, tags, reason, external_correlation_id, idempotency_key
  - NO `metadata` field per S5-L2-FIX
- **conformance:** AC-01

### T157 — AuditRequest defaults + validation [NEW]
- **dep:** T156
- **spec:** §18.7 REQ-TRIGGER-VALIDATE-001..003
- **files:** `packages/agent-core/src/gateway/validateRequest.ts`
- **acceptance:**
  - Applies defaults (budget.audit=15, max_pages=50, viewports=["desktop"], discovery_strategy="sitemap")
  - Validates client_id exists
  - Validates budget within limits (R8.1)
  - Returns structured ValidationError per §18.7 REQ-TRIGGER-VALIDATE-002
- **conformance:** AC-02

### T158 — Gateway service (thin, MVP) [NEW]
- **dep:** T156, T157, T074
- **spec:** §18.8 REQ-TRIGGER-PERSIST-001..003
- **files:** `packages/agent-core/src/gateway/GatewayService.ts`
- **acceptance:**
  - Accepts AuditRequest
  - Validates via T157
  - Creates `audit_requests` row
  - Creates `audit_runs` row
  - Creates `reproducibility_snapshots` row via T160 SnapshotBuilder.createSnapshot()
  - Single DB transaction (REQ-TRIGGER-PERSIST-002)
  - Returns `{audit_request_id, audit_run_id}`
  - For MVP: synchronous function call, no HTTP server, no Temporal
- **conformance:** AC-03

### T159 — CLI integration with Gateway [NEW]
- **dep:** T158, T145 (Phase 8 CLI)
- **spec:** §18.3.1 REQ-TRIGGER-CLI-001, REQ-TRIGGER-CLI-003
- **files:** `apps/cli/src/commands/audit.ts` (refactor from Phase 8 T145)
- **acceptance:**
  - CLI constructs AuditRequest from flags (url, urls, pages, budget, output, viewports, business_type)
  - Calls GatewayService.submit(request)
  - GatewayService returns IDs
  - CLI then compiles + runs AuditGraph with IDs
  - Replaces T145's direct graph compilation + inline snapshot scaffold
  - Adds `--replay <audit_run_id>` flag (small extension; replay path uses T160 loadAndValidateSnapshot)
- **conformance:** AC-04

### T160 — Reproducibility snapshot builder + loader [NEW]
- **dep:** T073 (LLMAdapter), T106 (HeuristicLoader)
- **spec:** §25.4 REQ-REPRO-031, §27 (loadAndValidateSnapshot is `audit_setup` node call, NOT Temporal activity per S5 fix)
- **files:** `packages/agent-core/src/reproducibility/SnapshotBuilder.ts`
- **acceptance:**
  - `createSnapshot()`: Computes SHA256 hashes of prompt template files (evaluate, selfCritique, executive_summary), reads model_version from LLMAdapter config, reads heuristic base_pack_version + computes overlay_chain_hash, reads normalizer + grounding + scoring versions from config, reads `perception_schema_version: "v2.5"`, reads ContextProfile hash from Phase 4b, returns ReproducibilitySnapshot. All temperatures set to 0 per REQ-REPRO-001. Called by **gateway** before AuditGraph start (REQ-TRIGGER-PERSIST-003).
  - `loadAndValidateSnapshot(auditRunId)`: Reads existing snapshot from DB. Validates immutability (re-hash check). Throws `SnapshotImmutabilityError` on mismatch (REQ-REPRO-032) + `SnapshotMissingError` if absent (REQ-REPRO-031b). Returns snapshot for AuditState. Called by **audit_setup** node (NOT Temporal activity — §27 fix).
  - Snapshot is IMMUTABLE after creation — DB trigger §13.6.7 enforces; SnapshotBuilder honors via re-hash check.
  - **REPLACES Phase 8 T145 MVP scaffold** per [plan.md §2](plan.md) supersession protocol.
- **conformance:** AC-05, AC-06

### T161 — Temperature enforcement guard [NEW]
- **dep:** T073
- **spec:** §25.3 REQ-REPRO-020 + R10 + R13
- **files:** `packages/agent-core/src/adapters/TemperatureGuard.ts`
- **acceptance:**
  - Wraps LLMAdapter.invoke()
  - For tagged calls (`evaluate`, `evaluate_interactive`, `self_critique`, `executive_summary`) and `temperature ≠ 0` → throws `R10TemperatureGuardError`
  - Runtime guard, not compile-time
- **conformance:** AC-07

### T162 — Two-store access mode middleware [NEW]
- **dep:** T070, T074
- **spec:** §24.3 REQ-TWOSTORE-001..003
- **files:** `packages/agent-core/src/storage/AccessModeMiddleware.ts`
- **acceptance:**
  - Sets `SET LOCAL app.access_mode` on database transactions
  - Sets `SET LOCAL app.client_id` on database transactions
  - Default `published_only` if route omits (fail-secure layered enforcement per REQ-TWOSTORE-002)
  - All database operations wrapped in transactions for SET LOCAL to work (M4-L2-FIX)
- **conformance:** AC-08

### T163 — Warm-up mode state machine [NEW]
- **dep:** T074, T070
- **spec:** §24.4 REQ-TWOSTORE-010..013
- **files:** `packages/agent-core/src/review/WarmupManager.ts`
- **acceptance:**
  - Computes warm-up status: `{active, audits_completed, rejection_rate, can_graduate}`
  - Checks: audits_completed ≥ 3 AND rejection_rate < 25%
  - Stores warmup_mode_active on client profile
  - determinePublishAction(finding, warmup_active, tier) returns `held | published | delayed` per §24.5
- **conformance:** AC-09

### T164 — Extended StoreNode (two-store aware) [NEW]
- **dep:** T132 (Phase 7 StoreNode), T163
- **spec:** §24.5 REQ-TWOSTORE-020..021
- **files:** `packages/agent-core/src/analysis/nodes/StoreNode.ts` (extend)
- **acceptance:**
  - Checks warmup_mode_active before auto-publishing
  - During warm-up: ALL findings stored as "held" regardless of tier
  - Post warm-up: Tier 1 → "published", Tier 2 → "delayed" (24h via §12.4 worker), Tier 3 → "held"
  - Updates `state.published_finding_ids`
- **conformance:** AC-10

### T165 — Scoring pipeline (4-dimensional) [NEW]
- **dep:** T002, T115 (Phase 7 confidence tier)
- **spec:** §23.4 REQ-FINDINGS-SCORE-001..051
- **files:** `packages/agent-core/src/analysis/scoring/ScoringPipeline.ts`
- **acceptance:**
  - `determineSeverity(finding, heuristic)` — from heuristic or critique downgrade
  - `computeConfidence(finding, heuristic, rulesPassed)` — tier × grounding × evidence
  - `computeBusinessImpact(severity, pageType, funnelPosition, weight)` — IMPACT_MATRIX lookup
  - `computeEffort(heuristic)` — EFFORT_MAP lookup
  - `computePriority(severity, confidence, impact, effort)` — formula: `Math.round((severity*2 + impact*1.5 + confidence*1 - effort*0.5) * 100) / 100` (parentheses critical — §23 fix)
  - ALL deterministic, NO LLM calls
  - Unit tests for each function
- **conformance:** AC-11

### T166 — IMPACT_MATRIX + EFFORT_MAP config [NEW]
- **dep:** T002
- **spec:** §23.4
- **files:** `packages/agent-core/src/analysis/scoring/config.ts`
- **acceptance:**
  - IMPACT_MATRIX: PageType × FunnelPosition → base impact (0-10)
  - DEFAULT_FUNNEL_POSITION: PageType → default position (C5-L2-FIX)
  - EFFORT_MAP: EffortCategory → effort score (2-10)
  - Version string for reproducibility snapshot pinning (REQ-FINDINGS-SCORE-051)
- **conformance:** AC-12

### T167 — Scoring integration with AnnotateNode [NEW]
- **dep:** T165, T131 (Phase 7 AnnotateNode)
- **files:** `packages/agent-core/src/analysis/nodes/AnnotateNode.ts` (extend)
- **acceptance:**
  - After grounding, run scoring pipeline on each grounded finding
  - Write business_impact + effort + priority + confidence to finding row before DB persist
  - Finding suppression: confidence < 0.3 → reject (REQ-FINDINGS-SUPPRESS-001)
- **conformance:** AC-13

### T168 — Finding suppression rules [NEW]
- **dep:** T165
- **spec:** §23.5 REQ-FINDINGS-SUPPRESS-001..002
- **files:** `packages/agent-core/src/analysis/scoring/Suppression.ts`
- **acceptance:**
  - confidence < 0.3 → reject
  - evidence_ids empty → reject
  - Exact duplicate (heuristic_id + element_ref + page) → reject
  - All suppressed findings logged to `rejected_findings` table (R7.4 append-only)
- **conformance:** AC-14

---

## Block B — Dashboard core (Days 4-5)

Build order within block: T171 (auth/layout) → T169 (review inbox) → T170 (audits list) → T172 (finding detail) → T173 (clients page).

### T171 — Consultant dashboard — basic layout + auth [NEW]
- **dep:** T002
- **spec:** §14.3 REQ-DELIVERY-004
- **files:**
  - `apps/dashboard/package.json` (Next.js 15 + shadcn/ui + Tailwind)
  - `apps/dashboard/src/app/layout.tsx`
  - `apps/dashboard/src/app/console/layout.tsx`
  - `apps/dashboard/src/middleware.ts` (Clerk auth)
- **acceptance:**
  - Next.js 15 app with Clerk authentication
  - Consultant role required for `/console/*` routes (admin role required for `/console/admin/*`)
  - Basic layout with sidebar navigation
- **conformance:** AC-17

### T169 — Consultant dashboard — basic review UI [NEW]
- **dep:** T070, T162, T163
- **spec:** §14.3 REQ-DELIVERY-005 + R6 channel 4
- **files:** `apps/dashboard/src/app/console/review/page.tsx`
- **acceptance:**
  - Lists findings WHERE `publish_status: held`
  - Sorted by priority (highest first)
  - Actions: Approve, Reject, Edit (creates `finding_edits` row preserving original)
  - Renders annotated screenshot inline with finding highlighted
  - Shows evidence + severity + confidence + business_impact + effort + priority
  - Reads with `app.access_mode: internal`
  - **R6 channel 4 first activation — heuristic body NEVER in render; only heuristic_id reference**
- **conformance:** AC-15, AC-36

### T170 — Consultant dashboard — audit list + trigger [NEW]
- **dep:** T158, T169
- **spec:** §14.3 REQ-DELIVERY-005, §14.5 REQ-DELIVERY-007
- **files:** `apps/dashboard/src/app/console/audits/page.tsx`
- **acceptance:**
  - Lists audit runs with status, dates, finding counts
  - "New Audit" form: URL, pages, budget, business_type, viewports
  - Submits via GatewayService (same path as CLI)
  - SSE-subscribes for live progress on detail page
- **conformance:** AC-16

### T172 — Consultant dashboard — finding detail [NEW]
- **dep:** T169
- **spec:** §14.3 REQ-DELIVERY-005 + R6 channel 4 + R7.4
- **files:** `apps/dashboard/src/app/console/review/[id]/page.tsx`
- **acceptance:**
  - Full finding detail (observation, assessment, recommendation, evidence)
  - Annotated screenshot with pin highlighted
  - Heuristic source attribution = heuristic_id only (R6 channel 4 — NOT heuristic content/body)
  - Edit form (description, recommendation, severity)
  - Approve/Reject buttons
  - Original finding preserved in `finding_edits` table (R7.4)
- **conformance:** AC-18, AC-36

### T173 — Warm-up status display [NEW]
- **dep:** T163, T171
- **spec:** §24.4 REQ-TWOSTORE-013
- **files:** `apps/dashboard/src/app/console/clients/[id]/page.tsx`
- **acceptance:**
  - Shows: audits_completed / required, rejection_rate, can_graduate status
  - Manual override toggle (admin-only; logged to audit_events)
- **conformance:** AC-19

---

## Block C — Delivery core (Days 6-7)

### T245 — ExecutiveSummary type + generator [NEW v2.2]
- **dep:** T144 (Phase 8 AuditCompleteNode T139), T217 (PatternFinding consumer — Phase 8 T139 produces PatternFinding rows)
- **spec:** §35.2 REQ-REPORT-001..005
- **files:** `packages/agent-core/src/delivery/ExecutiveSummaryGenerator.ts`
- **smoke test:** Audit with 15 findings produces summary with overall_score, grade, top 5, strengths
- **acceptance:**
  - Deterministic score formula (REQ-REPORT-002)
  - Grade A-F via thresholds 90/80/70/60/<60
  - top_findings sort by priority desc, ties → severity → confidence_tier (REQ-REPORT-005)
  - Strengths from heuristics passing on ≥80% of pages — pure code, NO LLM (REQ-REPORT-003)
  - 1 LLM call for `recommended_next_steps` ($0.10 cap, temperature=0, GR-007 enforced via retry-then-fallback per [plan.md §4](plan.md))
- **conformance:** AC-22

### T246 — ExecutiveSummary integration [NEW v2.2]
- **dep:** T245
- **spec:** §35.2 REQ-REPORT-001
- **files:** `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts` (extend Phase 8 T139)
- **acceptance:**
  - AuditCompleteNode populates `state.executive_summary`
  - Written to `audit_runs.executive_summary` JSONB column
  - Non-null when audit_runs.status = "completed"
- **conformance:** AC-23

### T247 — ActionPlan generator [NEW v2.2]
- **dep:** T135 (findings producer Phase 7), T165 (ScoringPipeline)
- **spec:** §35.3 REQ-REPORT-010..012
- **files:** `packages/agent-core/src/delivery/ActionPlanGenerator.ts`
- **smoke test:** Findings bucketed into 4 quadrants based on business_impact and effort_hours
- **acceptance:**
  - Deterministic bucketing into 4 quadrants:
    - quick_wins (business_impact ≥ 6, effort_hours ≤ 8)
    - strategic (business_impact ≥ 6, effort_hours > 8)
    - incremental (business_impact < 6, effort_hours ≤ 8)
    - deprioritized (business_impact < 6, effort_hours > 8)
  - Sort by priority desc within each quadrant
  - estimated_total_effort_hours computed
  - NO LLM
- **conformance:** AC-24

### T248 — Next.js report HTML template [NEW v2.2]
- **dep:** T245, T247
- **spec:** §35.4 REQ-REPORT-020..023 + R6 channel 4
- **files:** `apps/dashboard/src/app/api/report/[audit_run_id]/render/page.tsx`
- **smoke test:** GET /api/report/:id/render returns 8-section HTML page
- **acceptance:**
  - 8 sections in order (REQ-REPORT-022): Cover, Executive Summary, Action Plan, Findings by Category, Cross-Page Patterns, Methodology, Appendix, Reproducibility Note
  - Branded per client (logo_url, primary_color, secondary_color, company_name); default REO Digital
  - **R6 channel 4 — heuristic body NEVER in rendered HTML; only heuristic_id references**
- **conformance:** AC-25, AC-36

### T249 — PDF generator via Playwright [NEW v2.2]
- **dep:** T248
- **spec:** §35.4 REQ-REPORT-020 + REQ-REPORT-024 + REQ-REPORT-025 + REQ-REPORT-030 + §14.6 REQ-DELIVERY-REPORT-001..003
- **files:** `packages/agent-core/src/delivery/ReportGenerator.ts`
- **smoke test:** ReportGenerator.generate(auditRunId) produces PDF under 5MB, stored in R2
- **acceptance:**
  - Playwright `page.pdf()` against `/api/report/[id]/render`
  - Render time <30s (NF-03)
  - PDF size ≤5MB (NF-04 / REQ-REPORT-024)
  - R2 upload at `/{client_id}/reports/{audit_run_id}/report.pdf`
  - URL stored in `audit_runs.report_pdf_url`
  - When `analysis_status != complete` for any page, appendix includes "Pages Not Fully Analyzed" section per REQ-REPORT-030
- **conformance:** AC-26

---

## Block D — Adapters (Day 8)

### T256 — DiscoveryStrategy adapter interface [NEW v2.2a]
- **dep:** T002
- **spec:** v2.2a design spec §1.2 (DiscoveryStrategy)
- **files:** `packages/agent-core/src/gateway/DiscoveryStrategy.ts`
- **acceptance:**
  - Interface defined
  - Three implementations: SitemapDiscovery, NavigationCrawlDiscovery (deferred to v1.1 — interface stub only), ManualDiscovery
- **conformance:** AC-27

### T257 — DiscoveryStrategy integration in audit_setup [NEW v2.2a]
- **dep:** T256, T137 (Phase 8 AuditSetupNode)
- **files:** `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts` (extend)
- **smoke test:** `--discovery sitemap` parses sitemap.xml; `--discovery manual` consumes target.urls[]; `--discovery nav-crawl` returns HTTP 400 not_implemented_in_mvp
- **acceptance:**
  - audit_setup selects strategy based on AuditRequest.discovery_strategy
  - SitemapDiscovery + ManualDiscovery produce AuditPage[] for PageRouterNode queue
  - NavigationCrawlDiscovery rejects with HTTP 400 (deferred to v1.1)
- **conformance:** AC-28

### T260 — NotificationAdapter + email implementation [NEW v2.2a]
- **dep:** T002
- **spec:** §14.8 REQ-DELIVERY-NOTIFY-001..003
- **files:**
  - `packages/agent-core/src/adapters/NotificationAdapter.ts`
  - `packages/agent-core/src/adapters/EmailNotificationAdapter.ts`
  - DB migration: `notification_preferences` table (per user)
- **smoke test:** notify({ type: "audit_completed", ... }) sends email via Resend
- **acceptance:**
  - Adapter interface defined
  - EmailNotificationAdapter via Resend (Postmark fallback documented but not implemented in MVP)
  - notification_preferences table per user (defaults: all enabled for consultants, opt-in for clients per REQ-DELIVERY-NOTIFY-003)
- **conformance:** AC-29

### T261 — Notification integration in audit_complete [NEW v2.2a]
- **dep:** T260, T144 (Phase 8 AuditCompleteNode T139)
- **files:** `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts` (extend)
- **smoke test:** Completed audit triggers email with report URL to consultant
- **acceptance:**
  - audit_completed (recipient = consultant per REQ-DELIVERY-NOTIFY-002)
  - audit_failed (on completion_reason ∈ {budget_exceeded, error, snapshot_missing, ...})
  - findings_ready_for_review (when warm-up findings published by consultant approve)
  - Honors notification_preferences (skip silently if disabled)
  - Failure → 3× exponential backoff retry → notification_dead_letter table
- **conformance:** AC-30

---

## Block E — Observability (Days 9-10)

### T239 — Pino structured logging [NEW v2.2]
- **dep:** T002
- **spec:** §34.3 REQ-OBS-001..005 + R6 channel 1 reaffirm + R10
- **files:** `packages/agent-core/src/observability/logger.ts`
- **smoke test:** Log line includes audit_run_id, page_url, node_name as JSON fields
- **acceptance:**
  - JSON-structured via Pino (REQ-OBS-001)
  - Mandatory correlation fields: audit_run_id, page_url, node_name, heuristic_id, trace_id (REQ-OBS-002)
  - 4 log levels (info/warn/error/debug) per REQ-OBS-003
  - Sensitive data redacted (heuristic body, secrets, PII) per REQ-OBS-004
  - `console.log` forbidden in production code per REQ-OBS-005 + R10
  - **R6 channel 1 reaffirmed end-to-end (Phase 6 first activation)**
- **conformance:** AC-31

### T240 — audit_events table [NEW v2.2]
- **dep:** T070
- **spec:** §34.4 REQ-OBS-010..014, §13.7 REQ-DATA-V22-002
- **files:** `packages/agent-core/migrations/0004_audit_events.sql`
- **acceptance:**
  - Table + indexes created per §13.7
  - 22 event_type values enumerated in TypeScript types per REQ-OBS-012
  - Append-only per R7.4 + REQ-OBS-013
- **conformance:** AC-32

### T241 — Event emission in nodes [NEW v2.2]
- **dep:** T240
- **spec:** §34.4 REQ-OBS-011..014, §14.5 REQ-DELIVERY-007
- **files:** Inject EventEmitter into all graph nodes (Phase 5/7/8 + Phase 9 nodes)
- **smoke test:** Running an audit produces all 22 event types: audit_started, page_analyze_started, finding_produced, page_analyze_completed, audit_completed, etc.
- **acceptance:**
  - All 22 event types emitted from appropriate nodes per REQ-OBS-012
  - Events appear in `audit_events` table (R7.4 append-only)
  - Events appear in SSE stream per REQ-DELIVERY-007
  - trace_id shared per node call per REQ-OBS-014
- **conformance:** AC-33

### T242 — Heuristic health metrics materialized view [NEW v2.2]
- **dep:** T070, T240
- **spec:** §34.5 REQ-OBS-021..022, §13.7 REQ-DATA-V22-003
- **files:** Migration for materialized view + nightly refresh job
- **acceptance:**
  - View queryable: `heuristic_health_metrics`
  - Nightly refresh job (3 AM UTC default)
  - health_score < 0.3 flags heuristic for rewrite per REQ-OBS-022 (feeds §28 Learning Service post-MVP)
- **conformance:** AC-34

### T243 — Alerting rules + BullMQ job [NEW v2.2]
- **dep:** T241, T242, T260 (NotificationAdapter)
- **spec:** §34.6 REQ-OBS-030..032
- **files:** `packages/agent-core/src/observability/AlertingJob.ts`
- **smoke test:** Audit running >45 min triggers warning alert within 5 min of threshold
- **acceptance:**
  - 7 alert rules per REQ-OBS-030
  - Scheduled every 5 min (BullMQ)
  - Debounced per (audit_run_id, alert_type, hour) per REQ-OBS-032
  - Notifications via NotificationAdapter (REQ-OBS-031)
- **conformance:** AC-34

---

## Block F — Acceptance + ops dashboard LAST (Days 11-12)

### T174 — Phase 9 integration test [NEW]
- **dep:** T158-T173 + T245-T249 + T256-T257 + T260-T261 + T239-T243
- **files:** `packages/agent-core/tests/integration/phase9-foundations.test.ts`
- **acceptance:**
  - AuditRequest validates + persists
  - Reproducibility snapshot created with temperature=0 (T160 full composition; supersedes T145 scaffold)
  - Scoring pipeline produces 4D scores
  - Two-store: internal store has all findings, published view has only approved
  - Warm-up mode: new client → all findings held
  - CLI trigger works end-to-end through gateway
  - ExecutiveSummary populated; ActionPlan bucketed; PDF generated; email sent
- **conformance:** AC-20

### T175 — ★★ ACCEPTANCE TEST — Foundations on real audit [NEW]
- **dep:** T174
- **smoke test:** `pnpm cro:audit --url https://bbc.com --pages 2 --output ./test-foundations`
- **acceptance:**
  - Audit completes with all v1.0 acceptance criteria (Phase 8 T148/T149/T150 carry-over)
  - reproducibility_snapshots row: temperature=0, all 6 versions pinned (model + prompt_hashes + heuristic_pack_hash + ContextProfile_hash + perception_schema_version + scoring_version)
  - Findings: business_impact + effort + priority + confidence != null for all grounded findings
  - published_findings view: 0 rows (warm-up active)
  - audit_requests row: trigger_source = "cli"
  - Consultant dashboard: findings appear in review inbox sorted by priority
  - PDF report generated; size ≤5MB; render <30s
  - Email notification fired
  - All 22 audit_event types emitted (DB query post-T175)
  - R6 channels 3+4 conformance — recursive scan of API responses + rendered HTML detects ZERO heuristic body fingerprints
- **conformance:** AC-21 (★ MVP SPEC COMPLETE acceptance gate ★)

### T244 — Operational dashboard [NEW v2.2] [BUILD LAST]
- **dep:** T241, T242, T171 (dashboard infrastructure)
- **spec:** §34.7 REQ-OBS-040..042, §14.7 REQ-DELIVERY-OPS-001..003
- **files:** `apps/dashboard/src/app/console/admin/operations/page.tsx`
- **acceptance:**
  - 6 sections rendered per REQ-OBS-041:
    1. Active audits with live progress
    2. 24h summary (audits, findings, costs)
    3. Heuristic health table (top 30 by health_score from materialized view)
    4. Alert feed (recent BullMQ-fired alerts)
    5. Cost trend (rolling 7d)
    6. Failure breakdown (audit_runs.completion_reason taxonomy)
  - Admin role only (REQ-OBS-040 + REQ-DELIVERY-OPS-002)
  - Queries from `audit_events` + `llm_call_log` + `heuristic_health_metrics` mat view (REQ-OBS-042)
  - Read-only (no live writes)
  - **Build LAST per REQ-DELIVERY-OPS-003 + §35.6**
- **conformance:** AC-35

---

## ★ MVP SPEC COMPLETE ★

The MVP is **SPEC COMPLETE** when AC-21 (T175 acceptance) + AC-26 (PDF) + AC-30 (email) + AC-36 (R6 channels 3+4) all green = AC-37 satisfied.

This validates:

1. ✅ Gateway service path — CLI + Dashboard both produce AuditRequest → submit → IDs (T158)
2. ✅ Reproducibility snapshot full composition — T160 supersedes T145 scaffold (model + 3 prompt hashes + heuristic_pack_hash + ContextProfile_hash + schema_version + scoring_version, temp=0)
3. ✅ TemperatureGuard runtime enforcement on `evaluate / self_critique / executive_summary` (T161 + R10/R13)
4. ✅ Two-store + warm-up — internal vs published; warm-up holds all findings (T162-T164 + F-016)
5. ✅ 4D scoring pipeline deterministic — severity / confidence / business_impact / effort / priority (T165-T167)
6. ✅ Suppression — confidence < 0.3 + empty evidence + duplicate (T168)
7. ✅ Consultant dashboard — review inbox + audits list + finding detail + clients page (T169-T173)
8. ✅ Executive Summary — score 0-100 + grade A-F + top 5 + strengths + 3-5 next steps (T245-T246; LLM $0.10 cap; GR-007 enforced)
9. ✅ Action Plan — deterministic 4-quadrant bucketing (T247)
10. ✅ Branded PDF — Playwright page.pdf + 8 sections + ≤5MB + R2 (T248-T249 + F-018)
11. ✅ Email — NotificationAdapter + Resend + audit_completed/failed/findings_ready (T260-T261 + F-020)
12. ✅ DiscoveryStrategy — Sitemap + Manual MVP; NavigationCrawl deferred (T256-T257)
13. ✅ Pino structured logs — all correlation fields; R6 channel 1 reaffirm (T239)
14. ✅ audit_events 22-event taxonomy emitted end-to-end (T240-T241)
15. ✅ Heuristic health metrics + alerting (T242-T243)
16. ✅ Ops dashboard — admin only; 6 sections (T244)
17. ✅ R6 channels 3 + 4 first runtime — heuristic body NEVER in API/render
18. ✅ ALL 4 R6 channels live = first external pilot prereq satisfied

---

## Phase 9 "Done" definition

All 35 tasks merged AND all of:
- ✅ AC-21 (T175 bbc.com 2-page foundations) green
- ✅ AC-26 (PDF render <30s, ≤5MB, 8 sections, R2 upload) green
- ✅ AC-30 (email `audit_completed` <60s) green
- ✅ AC-36 (R6 channels 3+4 conformance — zero heuristic body fingerprint in API responses + rendered HTML) green
- ✅ AC-05 + AC-06 (T160 SnapshotBuilder createSnapshot + loadAndValidateSnapshot) green
- ✅ Phase 8 T148-T150 RE-RUN green after T159 CLI refactor + T160 SnapshotBuilder land — supersession of T145 scaffold verified
- ✅ Reproducibility replay (NF-06) — finding overlap ≥90% on T148 fixture replay (DIAGNOSTIC, not gate)
- ✅ All 22 audit_event types emit on a single end-to-end audit run (verified via DB query)
- ✅ ScoringPipeline determinism — 100 invocations on same Finding input → identical output
- ✅ AccessModeMiddleware fail-secure default — route without explicit access_mode set serves `published_only`
- ✅ Phase 9 status: `verified`
- ✅ `phase-9-current.md` rollup committed (Constitution R19) — last MVP rollup

★ MVP SPEC COMPLETE ★ = AC-37 = Phase 9 EXIT GATE = MVP shippable for first external pilot (with v1.1 R6.2 AES at-rest layer added BEFORE pilot).
