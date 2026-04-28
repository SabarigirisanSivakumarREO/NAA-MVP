---
title: Phase 9 — Foundations + Delivery (★ MVP SPEC COMPLETE ★)
artifact_type: spec
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
  - docs/specs/mvp/PRD.md (F-001 audit, F-015 reproducibility snapshot, F-016 two-store + warm-up, F-017 Executive Summary + Action Plan, F-018 Branded PDF, F-019 Consultant Dashboard, F-020 Email, F-021 cost accounting)
  - docs/specs/mvp/constitution.md (R5.3 + GR-007 no conversion predictions; R6 IP — heuristic body NEVER in API/dashboard; R7.4 append-only; R8.1 audit budget cap; R10/R13 temp=0; R14 cost; R15.3 provenance; R20 impact; R23 kill criteria)
  - docs/specs/mvp/architecture.md §6 (5-layer harness; adapter pattern)
  - docs/specs/mvp/tasks-v2.md (Phase 9 sections — T156-T175 master foundations, T239-T244 observability, T245-T249 report generation, T256-T257 DiscoveryStrategy, T260-T261 NotificationAdapter)
  - docs/specs/final-architecture/14-delivery-layer.md (REQ-DELIVERY-004..007, REQ-DELIVERY-REPORT-001..003, REQ-DELIVERY-OPS-001..003, REQ-DELIVERY-NOTIFY-001..003)
  - docs/specs/final-architecture/18-trigger-gateway.md §18.4 + §18.7 + §18.8 (REQ-TRIGGER-CONTRACT-001..004, REQ-TRIGGER-VALIDATE-001..003, REQ-TRIGGER-PERSIST-001..004)
  - docs/specs/final-architecture/23-findings-engine-extended.md §23.4 + §23.5 (REQ-FINDINGS-SCORE-001..051, REQ-FINDINGS-SUPPRESS-001..002)
  - docs/specs/final-architecture/24-two-store-pattern.md §24.3..§24.5 (REQ-TWOSTORE-001..031)
  - docs/specs/final-architecture/25-reproducibility.md §25.3 + §25.4 (REQ-REPRO-001..010, REQ-REPRO-020, REQ-REPRO-031, REQ-REPRO-031a, REQ-REPRO-031b, REQ-REPRO-032)
  - docs/specs/final-architecture/34-observability.md (REQ-OBS-001..042)
  - docs/specs/final-architecture/35-report-generation.md (REQ-REPORT-001..030)
  - docs/specs/mvp/phases/phase-7-analysis/spec.md (Finding lifecycle producer)
  - docs/specs/mvp/phases/phase-8-orchestrator/spec.md (AuditCompleteNode + cross_page_patterns + audit_runs.completion_reason)

req_ids:
  # Gateway + AuditRequest
  - REQ-TRIGGER-CONTRACT-001
  - REQ-TRIGGER-CONTRACT-002
  - REQ-TRIGGER-CONTRACT-003
  - REQ-TRIGGER-CONTRACT-004
  - REQ-TRIGGER-VALIDATE-001
  - REQ-TRIGGER-VALIDATE-002
  - REQ-TRIGGER-VALIDATE-003
  - REQ-TRIGGER-PERSIST-001
  - REQ-TRIGGER-PERSIST-002
  - REQ-TRIGGER-PERSIST-003
  - REQ-TRIGGER-CLI-001
  - REQ-TRIGGER-CLI-003
  # Reproducibility (T160 master)
  - REQ-REPRO-001
  - REQ-REPRO-002
  - REQ-REPRO-003
  - REQ-REPRO-004
  - REQ-REPRO-020
  - REQ-REPRO-031
  - REQ-REPRO-031a
  - REQ-REPRO-031b
  - REQ-REPRO-032
  # Two-store + warm-up
  - REQ-TWOSTORE-001
  - REQ-TWOSTORE-002
  - REQ-TWOSTORE-003
  - REQ-TWOSTORE-010
  - REQ-TWOSTORE-011
  - REQ-TWOSTORE-012
  - REQ-TWOSTORE-013
  - REQ-TWOSTORE-020
  - REQ-TWOSTORE-021
  - REQ-TWOSTORE-030
  - REQ-TWOSTORE-031
  # Findings scoring + suppression
  - REQ-FINDINGS-SCORE-001
  - REQ-FINDINGS-SCORE-010
  - REQ-FINDINGS-SCORE-020
  - REQ-FINDINGS-SCORE-030
  - REQ-FINDINGS-SCORE-040
  - REQ-FINDINGS-SCORE-050
  - REQ-FINDINGS-SCORE-051
  - REQ-FINDINGS-SUPPRESS-001
  - REQ-FINDINGS-SUPPRESS-002
  # Delivery layer
  - REQ-DELIVERY-004
  - REQ-DELIVERY-005
  - REQ-DELIVERY-006
  - REQ-DELIVERY-007
  - REQ-DELIVERY-REPORT-001
  - REQ-DELIVERY-REPORT-002
  - REQ-DELIVERY-REPORT-003
  - REQ-DELIVERY-OPS-001
  - REQ-DELIVERY-OPS-002
  - REQ-DELIVERY-OPS-003
  - REQ-DELIVERY-NOTIFY-001
  - REQ-DELIVERY-NOTIFY-002
  - REQ-DELIVERY-NOTIFY-003
  # Report generation
  - REQ-REPORT-001
  - REQ-REPORT-002
  - REQ-REPORT-003
  - REQ-REPORT-004
  - REQ-REPORT-005
  - REQ-REPORT-010
  - REQ-REPORT-011
  - REQ-REPORT-012
  - REQ-REPORT-020
  - REQ-REPORT-021
  - REQ-REPORT-022
  - REQ-REPORT-023
  - REQ-REPORT-024
  - REQ-REPORT-025
  - REQ-REPORT-030
  # Observability
  - REQ-OBS-001
  - REQ-OBS-002
  - REQ-OBS-003
  - REQ-OBS-004
  - REQ-OBS-005
  - REQ-OBS-010
  - REQ-OBS-011
  - REQ-OBS-012
  - REQ-OBS-013
  - REQ-OBS-014
  - REQ-OBS-021
  - REQ-OBS-022
  - REQ-OBS-030
  - REQ-OBS-031
  - REQ-OBS-032
  - REQ-OBS-040
  - REQ-OBS-041
  - REQ-OBS-042

impact_analysis: docs/specs/mvp/phases/phase-9-delivery/impact.md
breaking: false
affected_contracts:
  - AuditRequest (PRODUCER — first runtime emit; gateway constructs from CLI flags / dashboard form)
  - reproducibility_snapshot (PRODUCER — T160 SnapshotBuilder REPLACES Phase 8 T145 MVP scaffold; full composition)
  - ScoredFinding (PRODUCER — adds business_impact / effort / priority / confidence to Finding via AnnotateNode extension at T167)
  - PatternFinding (CONSUMER — read by ExecutiveSummaryGenerator + ActionPlanGenerator + ReportGenerator; produced by Phase 8)
  - audit_runs (PRODUCER + CONSUMER — gateway creates row at T158; ExecutiveSummary populates state.executive_summary; ReportGenerator writes report_pdf_url)
  - finding_edits (PRODUCER — NEW; created by dashboard Edit action)
  - rejected_findings (PRODUCER — first writes from T168 Suppression at confidence < 0.3 / empty evidence / exact dup)
  - audit_events (PRODUCER — orchestration events emitted from all nodes via T241; first activation of full 22-event taxonomy)
  - llm_call_log (PRODUCER — Pino logger at T239 captures structured logs; ExecutiveSummary $0.10 LLM call writes 1 row per audit)
  - reproducibility_snapshots row (PRODUCER — T160 full composition; T145 scaffold superseded)
  - notification_preferences (PRODUCER — NEW; per-user table created at T260)
  - DiscoveryStrategy (PRODUCER — NEW interface; SitemapDiscovery + NavigationCrawlDiscovery + ManualDiscovery implementations at T256)
  - NotificationAdapter (PRODUCER — NEW interface; EmailNotificationAdapter Resend implementation at T260)
  - heuristic_health_metrics materialized view (PRODUCER — NEW; nightly refresh job at T242)
  - Hono API routes (PRODUCER — REST endpoints for dashboard at T171; FIRST R6 channel 3 activation — heuristic body NEVER in response)
  - Next.js dashboard pages (PRODUCER — `/console/*` at T169-T173; FIRST R6 channel 4 activation — heuristic body NEVER in render)

delta:
  new:
    - Phase 9 spec — final MVP phase; ★ MVP SPEC COMPLETE ★ at session end
    - AC-01..AC-35 stable IDs for T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261
    - R-01..R-22 functional requirements
    - T160 SnapshotBuilder REPLACES Phase 8 T145 scaffold protocol
    - First runtime activation of R6 channels 3 (Hono API responses) + 4 (Next.js dashboard pages) — completes 4-channel R6 multi-channel enforcement
    - Executive Summary LLM call ($0.10 hard cap; GR-007 deterministic enforcement on output)
    - Two-store + warm-up runtime activation (Phase 7 produces findings at publish_status: held; Phase 9 dashboard owns publish action)
    - 4D scoring runtime activation (severity / confidence / business_impact / effort / priority — all deterministic per §23.4)
    - 22-event audit_events taxonomy first emission across all nodes (Phase 7/8 already produced subsets; Phase 9 completes)
  changed: []
  impacted:
    - Phase 8 T145 CLI MVP snapshot scaffold — superseded by T160 SnapshotBuilder + T159 CLI Gateway integration
    - Phase 7 T131 AnnotateNode — extended at T167 to run scoring pipeline before DB persist
    - Phase 7 T132 StoreNode — extended at T164 to be two-store aware (warmup_mode_active gates publish_status)
  unchanged:
    - LLMAdapter / TemperatureGuard surface (Phase 7 first runtime; Phase 9 ExecutiveSummary LLM call honors via T161 enforcement)
    - Phase 5/5b BrowseGraph + Phase 7 AnalysisGraph + Phase 8 AuditGraph contracts
    - Heuristic IP boundary (R6 channels 1+2 already activated in Phase 6 + Phase 7; channels 3+4 activate here)

governing_rules:
  - Constitution R5.3 + GR-007 (no conversion predictions — applies to ExecutiveSummary LLM output)
  - Constitution R6 (heuristic IP — channels 3+4 activate; ALL 4 channels live for first external pilot prereq)
  - Constitution R7.4 (append-only audit_log / audit_events / findings / rejected_findings / llm_call_log)
  - Constitution R8.1 (audit budget cap $15) — gateway pre-validates AuditRequest.budget within limits
  - Constitution R10 + R13 (temperature=0 on evaluate / self_critique / evaluate_interactive — T161 TemperatureGuard wraps LLMAdapter)
  - Constitution R14.1 (atomic llm_call_log writes — ExecutiveSummary LLM call writes 1 row per audit)
  - Constitution R15 quality gates (warmup graduation criteria; perception quality gate already Phase 7)
  - Constitution R17, R18, R19, R20, R23
---

# Feature Specification: Phase 9 — Foundations + Delivery

> **Summary (~150 tokens — agent reads this first):** The final MVP phase. **35 tasks** across two halves. **Half 1 — Master Foundations (T156-T175):** AuditRequest contract (T156-T157), thin Gateway service (T158, sync function call — no HTTP no Temporal in MVP), CLI gateway integration (T159), full SnapshotBuilder + loader (T160 REPLACES Phase 8 T145 MVP scaffold; pins model_version + prompt_hash + heuristic_pack_hash + ContextProfile_hash + perception_schema_version "v2.5" + temperature_invariant 0), TemperatureGuard (T161), AccessModeMiddleware (T162) + WarmupManager (T163) + extended StoreNode (T164), 4D scoring pipeline + IMPACT_MATRIX + EFFORT_MAP (T165-T167), suppression (T168), consultant dashboard (Next.js 15 + shadcn/ui + Tailwind + Clerk — T169-T173), integration + acceptance test (T174-T175). **Half 2 — Delivery:** Executive Summary generator (T245-T246; 1 LLM call $0.10 cap; GR-007 enforced on output), Action Plan deterministic bucketing (T247; 4 quadrants — quick wins / strategic / incremental / deprioritized), Next.js HTML report template + Playwright PDF (T248-T249; 8 sections; ≤5MB; R2 storage), DiscoveryStrategy adapter (T256-T257; Sitemap + Manual for MVP, NavigationCrawl deferred), NotificationAdapter + EmailNotificationAdapter Resend (T260-T261), Pino logger (T239) + audit_events emission (T240-T241) + heuristic health metrics view (T242) + alerting (T243) + admin operations dashboard (T244 — built LAST). **★ MVP SPEC COMPLETE ★** when this phase ships — implementation can start.

**Feature Branch:** `phase-9-delivery` (created at implementation time)
**Input:** Phase 9 scope from `INDEX.md` row 9 + `tasks-v2.md` Phase 9 sections + `final-architecture/{14,18,23,24,25,34,35}.md`

---

## Mandatory References

When reading this spec, agents must already have loaded:

1. `docs/specs/mvp/constitution.md` — **R5.3 + GR-007** (no conversion predictions on ExecutiveSummary output); **R6** (heuristic IP — channels 3+4 first activation); **R7.4** (append-only); **R8.1** (audit budget $15); **R10 + R13** (temp=0 on ExecutiveSummary LLM call); **R14.1** (atomic llm_call_log); **R20** (impact); **R23** (kill criteria).
2. `docs/specs/mvp/PRD.md` §F-001 (audit), §F-015 (reproducibility snapshot), §F-016 (two-store + warm-up), §F-017 (Executive Summary + Action Plan), §F-018 (Branded PDF), §F-019 (Consultant Dashboard), §F-020 (Email), §F-021 (cost accounting).
3. `docs/specs/final-architecture/14-delivery-layer.md` — dashboard + API + SSE + PDF + ops dashboard + NotificationAdapter (REQ-DELIVERY-004..007, REQ-DELIVERY-REPORT-001..003, REQ-DELIVERY-OPS-001..003, REQ-DELIVERY-NOTIFY-001..003).
4. `docs/specs/final-architecture/18-trigger-gateway.md` §18.4 (AuditRequest contract) + §18.7 (validation pipeline) + §18.8 (persistence handoff) — REQ-TRIGGER-CONTRACT-001..004, REQ-TRIGGER-VALIDATE-001..003, REQ-TRIGGER-PERSIST-001..004.
5. `docs/specs/final-architecture/23-findings-engine-extended.md` §23.4 (4D scoring) + §23.5 (suppression) — REQ-FINDINGS-SCORE-001..051, REQ-FINDINGS-SUPPRESS-001..002.
6. `docs/specs/final-architecture/24-two-store-pattern.md` — REQ-TWOSTORE-001..031.
7. `docs/specs/final-architecture/25-reproducibility.md` §25.3 + §25.4 — REQ-REPRO-001..010, REQ-REPRO-020, REQ-REPRO-031..032.
8. `docs/specs/final-architecture/34-observability.md` — REQ-OBS-001..042.
9. `docs/specs/final-architecture/35-report-generation.md` — REQ-REPORT-001..030.
10. Predecessor phase rollups (load AFTER they exist):
    - `phase-7-analysis/phase-7-current.md`
    - `phase-8-orchestrator/phase-8-current.md`

---

## Constraints Inherited from Neural Canonical Specs

- **R5.3 + GR-007 — no conversion predictions on ExecutiveSummary LLM output.** The single $0.10 LLM call that generates `recommended_next_steps` (REQ-REPORT-004) MUST pass through the same GR-007 deterministic regex check that Phase 7 EvidenceGrounder applies to per-page findings. Banned phrases ("increase conversions by X%", "lift CR by Y%", "boost revenue by Z%") trigger output rejection + retry once + failover to deterministic fallback ("Review the top 5 findings with your CRO consultant for prioritization").
- **R6 IP — channels 3 + 4 first runtime activation.** Phase 6 activated channel 1 (Pino redaction); Phase 7 activated channel 2 (LangSmith metadata.private). Phase 9 activates channels 3 (Hono API responses — heuristic body NEVER in `GET /api/audits/:id/findings` response) and 4 (Next.js dashboard pages — heuristic body NEVER in `/console/review/[id]` render). After Phase 9 ships, ALL 4 R6 channels are live — prerequisite for first external pilot (with R6.2 AES-256-GCM at v1.1 per PRD §3.2).
- **R7.4 append-only.** `audit_log`, `audit_events`, `llm_call_log`, `findings`, `rejected_findings` all append-only. `audit_runs` mutable (status field). NEW Phase 9 tables: `notification_preferences` (mutable per user), `finding_edits` (append-only), `langgraph_checkpoints` (Phase 8 produces; Phase 9 reads). `reproducibility_snapshots` immutable per §13.6.7 trigger (T160 enforces).
- **R8.1 $15 audit budget cap.** Gateway (T158) validates `AuditRequest.budget.audit ≤ 15`; rejects with HTTP 400 if exceeded. ExecutiveSummary LLM call ($0.10 cap) is BUDGET-CONSUMING but enforced via T161 TemperatureGuard's pre-call BudgetGate (estimate from `getTokenCount()` before invoking).
- **R10 + R13 temperature=0.** T161 TemperatureGuard enforces at LLMAdapter boundary for tagged calls (`evaluate`, `self_critique`, `evaluate_interactive`). ExecutiveSummary call is tagged `executive_summary`; the spec ALLOWS non-zero temperature on this tag (§35.2 leaves temp policy to executive summary author) BUT the snapshot pins whatever value is used (REQ-REPRO-004). MVP: temperature=0 for ExecutiveSummary too (consistency + reproducibility).
- **R14.1 atomic llm_call_log writes.** ExecutiveSummary LLM call writes 1 row per audit per R14.1; T239 Pino logger doesn't replace this (logging is auxiliary; llm_call_log is canonical for cost attribution per R14.4).
- **R15.3 + R15.3.1 + R15.3.2 + R15.3.3.** Phase 9 does NOT author heuristics (Phase 0b owns); but `provenance` block fields are read by ReportGenerator for the methodology section appendix (REQ-REPORT-022 §6).
- **F-016 warm-up mode.** Phase 7 produces findings with `publish_status: held` by default during warm-up; Phase 9 dashboard's Approve action (T169) is the consultant-driven publish trigger. All MVP audits run during warm-up (default `warmup_mode_active: true`); the published_findings view (REQ-TWOSTORE-030) returns 0 rows until consultant approves.
- **No new external dependencies beyond what's listed in the tech stack.** Resend (or Postmark fallback) for email; Clerk already required for dashboard auth; Next.js 15 + shadcn/ui + Tailwind already required; Sharp already required (Phase 7 annotation reuse). Playwright already required (Phase 1 browser engine; reused for `page.pdf()` in T249 — no new install).
- **Build order (REQ-DELIVERY-OPS-003 + §35.6).** Build foundations FIRST (T156-T168), then dashboard core (T169-T173), then delivery (T245-T249, T260-T261), then DiscoveryStrategy (T256-T257), then observability (T239-T243), then ops dashboard LAST (T244 — admin only, lowest priority). T174-T175 acceptance gate runs after all of Half 1 + most of Half 2 lands.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Consultant runs audit via Dashboard "New Audit" form (Priority: P1)

A consultant logs into `/console/audits` (Clerk auth), clicks "New Audit", fills the form (URL, pages, budget, business_type, viewports), submits. The dashboard POSTs to Hono `POST /api/audits` which calls `GatewayService.submit(request)`. Gateway validates the AuditRequest (T157), creates `audit_requests` + `audit_runs` + `reproducibility_snapshots` rows in a transaction (T158 + T160), returns `{audit_request_id, audit_run_id}`. Dashboard navigates to `/console/audits/[audit_run_id]` and subscribes to SSE stream for real-time progress. Audit completes; consultant sees notification email (T260); navigates to `/console/review` to approve/reject findings (held during warm-up).

**Why this priority:** F-019 explicit MVP scope; the dashboard trigger path is the consultant's primary interface to Neural. CLI path (User Story 2) is secondary; dashboard is the canonical consultant workflow.
**Independent Test:** Consultant logs into dashboard; submits an audit form for example.com; observes audit_run_id created; observes SSE progress events; observes audit completion email; opens `/console/review`; sees held findings sorted by priority.

**Acceptance Scenarios:**

1. **Given** consultant logged into `/console/audits`, **When** clicks "New Audit" + fills form + submits, **Then** Hono `POST /api/audits` returns `{audit_request_id, audit_run_id}` HTTP 201; dashboard navigates to detail page.
2. **Given** the audit running, **When** SSE stream connected, **Then** real-time events render in dashboard (page progress, current node, cost-so-far).
3. **Given** the audit completes, **When** consultant opens `/console/review`, **Then** held findings list rendered, sorted by priority, with annotated screenshots inline.
4. **Given** consultant approves a finding, **When** Approve clicked, **Then** finding moves to published state; published_findings view (REQ-TWOSTORE-030) now returns the row; appears in client-facing PDF.

---

### User Story 2 — Consultant runs audit via CLI; PDF report generated (Priority: P1)

A consultant runs `pnpm cro:audit --url https://example.com --pages 3 --output ./test-output`. CLI (T159) constructs an `AuditRequest` from flags, calls `GatewayService.submit(request)` (T158 — direct function call, NOT HTTP for MVP). Gateway creates DB rows + full reproducibility snapshot (T160 — no longer T145 scaffold; full composition with model_version, prompt_hash, heuristic_pack_hash, ContextProfile_hash, perception_schema_version "v2.5", temperature_invariant 0). CLI then runs the AuditGraph (Phase 8) with the IDs. Audit completes; AuditCompleteNode (Phase 8 T139) generates `state.cross_page_patterns[]`; **Phase 9 ExecutiveSummaryGenerator (T245)** consumes `grounded_findings + cross_page_patterns`, produces overall score (0-100) + grade (A-F) + top 5 findings + strengths + 3-5 next steps via 1 LLM call ($0.10 cap, GR-007 enforced); **ActionPlanGenerator (T247)** deterministically buckets findings into 4 quadrants; **ReportGenerator (T249)** renders Next.js HTML template via Playwright `page.pdf()` → 8-section PDF ≤5MB → uploads to R2 at `/{client_id}/reports/{audit_run_id}/report.pdf`; URL written to `audit_runs.report_pdf_url`. Email notification (T260) sent with report link.

**Why this priority:** F-001 + F-018 + F-020 explicit MVP scope; CLI is the engineering-validated path used by acceptance tests T148/T149/T150; PDF + email are the consultant-deliverable artifacts at audit completion.
**Independent Test:** Run CLI; assert PDF exists at returned URL; assert PDF has 8 sections; assert PDF size <5MB; assert ExecutiveSummary score in [0,100] + grade in {A,B,C,D,F}; assert email sent (Resend test inbox).

**Acceptance Scenarios:**

1. **Given** CLI invocation, **When** GatewayService.submit returns, **Then** `audit_requests` row + `audit_runs` row + `reproducibility_snapshots` row exist; snapshot has all 6 pinned fields populated (model_version + prompt_hash + heuristic_pack_hash + ContextProfile_hash + perception_schema_version "v2.5" + temperature_invariant 0).
2. **Given** audit completes, **When** ExecutiveSummaryGenerator runs, **Then** `audit_runs.executive_summary` populated; LLM call cost ≤$0.10; GR-007 deterministic regex passes on `recommended_next_steps` text.
3. **Given** audit completes, **When** ActionPlanGenerator runs, **Then** all grounded findings deterministically bucketed into 4 quadrants by `business_impact ≥ 6` × `effort_hours ≤ 8`; sort by priority within bucket.
4. **Given** audit completes, **When** ReportGenerator runs, **Then** PDF generated <30s wall-clock; PDF size ≤5MB; PDF has 8 sections in order (Cover, Executive Summary, Action Plan, Findings by Category, Cross-Page Patterns, Methodology, Appendix, Reproducibility Note); PDF stored at R2 path; URL in `audit_runs.report_pdf_url`.
5. **Given** audit completes, **When** NotificationAdapter fires `audit_completed`, **Then** email sent to consultant with report link.

---

### User Story 3 — Reproducibility replay validates 90% finding overlap (Priority: P1)

A consultant runs an audit on day 1; on day 2, runs `pnpm cro:audit --replay <audit_run_id>` (T160 SnapshotBuilder loadAndValidateSnapshot path). SnapshotBuilder reads the original `reproducibility_snapshots` row; validates immutability (re-hash check); passes the original snapshot to AuditGraph; replay runs against same model_version + prompt_hashes + heuristic_pack_hash + ContextProfile_hash + perception_schema_version + temperature_invariant. Phase 7 produces findings; comparison vs original yields `finding_overlap ≥ 90%` (REQ-REPRO-005 / NF-006).

**Why this priority:** F-015 / NF-006 explicit MVP gate; reproducibility is foundational consultant trust. P1 because without ≥90% replay overlap, the audit can't be defended in client review.
**Independent Test:** Run audit on T148 fixture (example.com); 24h later, replay; compute Jaccard overlap of grounded finding ID sets; assert ≥0.9.

**Acceptance Scenarios:**

1. **Given** audit_run_id with persisted snapshot, **When** `--replay <id>` invoked, **Then** SnapshotBuilder loadAndValidateSnapshot returns the immutable snapshot; hash check passes.
2. **Given** snapshot tampered (DB row modified), **When** loadAndValidateSnapshot runs, **Then** throws `SnapshotImmutabilityError` per REQ-REPRO-032.
3. **Given** replay completes, **When** finding overlap computed, **Then** Jaccard ≥0.9 vs original; below 0.9 emits `finding_overlap_below_target` audit_event for diagnostic alert (NOT a failure per REQ-REPRO-006).

---

### User Story 4 — Consultant approves held finding via Dashboard; warm-up mode tracks graduation (Priority: P1)

A consultant on a new client (warm-up active) reviews held findings at `/console/review`. For each finding, consultant clicks Approve / Reject / Edit. Approve flips `findings.publish_status: held → published`; Reject creates `rejected_findings` row + sets `findings.status: rejected`. Edit creates `finding_edits` row preserving original. WarmupManager (T163) tracks per-audit rejection rate; once `audits_completed ≥ 3 AND rejection_rate < 25%`, can_graduate = true; consultant clicks "Disable warm-up" on `/console/clients/[id]` (T173) → client transitions to post-warm-up mode; future findings auto-published per Tier (Tier 1 → published, Tier 2 → delayed 24h, Tier 3 → held).

**Why this priority:** F-016 explicit MVP scope; warm-up is the consultant-trust handoff mechanism. Without it, Neural can't graduate from supervised → semi-autonomous mode.
**Independent Test:** Set warmup_mode_active=true on client; run 3 audits; reject <25% findings; observe can_graduate=true; toggle off; run 4th audit; observe Tier 1 findings auto-published.

**Acceptance Scenarios:**

1. **Given** warmup_mode_active=true, **When** new audit completes, **Then** all findings have `publish_status: held` regardless of tier (T164 StoreNode extension).
2. **Given** consultant approves finding via dashboard, **When** Approve POSTs to API, **Then** `findings.publish_status: published`; published_findings view returns the row; access mode middleware enforces (REQ-TWOSTORE-001..003).
3. **Given** 3 audits completed + rejection_rate <25%, **When** WarmupManager.canGraduate runs, **Then** returns true; dashboard shows "Ready to graduate" badge.
4. **Given** consultant disables warm-up, **When** next audit completes, **Then** findings publish per Tier (T1 published, T2 delayed, T3 held — REQ-TWOSTORE-020).

---

### User Story 5 — Operations admin views ops dashboard for system health (Priority: P3)

An admin (consultant role + admin flag) navigates to `/console/admin/operations`. Dashboard renders 6 sections (REQ-OBS-041): (1) active audits with live progress; (2) 24h summary (audits, findings, costs); (3) heuristic health table (top 30 by `health_score` from materialized view); (4) alert feed (recent BullMQ-fired alerts); (5) cost trend (rolling 7d); (6) failure breakdown (audit_runs.completion_reason taxonomy). Read-only — no live writes. SQL queries against `audit_events`, `llm_call_log`, `heuristic_health_metrics` materialized view.

**Why this priority:** REQ-DELIVERY-OPS-003 + §35.6 — built LAST in Phase 9 because admin-only and lowest priority. Interim consultants use raw SQL queries; ops dashboard is convenience-tier in MVP.
**Independent Test:** Admin navigates to `/console/admin/operations`; observes 6 sections rendered; non-admin consultant gets 403.

**Acceptance Scenarios:**

1. **Given** admin user, **When** navigates to `/console/admin/operations`, **Then** 6 sections render with current data.
2. **Given** non-admin consultant, **When** navigates to `/console/admin/operations`, **Then** HTTP 403 / redirect to `/console/audits`.
3. **Given** materialized view stale, **When** nightly refresh job runs, **Then** `heuristic_health_metrics` updated; dashboard reflects.

---

### Edge Cases

- **AuditRequest budget exceeds $15** → Gateway T157 rejects with structured 400 error (REQ-TRIGGER-VALIDATE-002); audit not created.
- **AuditRequest missing required field (`primary_kpi`, `client_id`, `target.url`)** → Gateway T157 rejects with field-level error per Zod issues array.
- **SnapshotBuilder loadAndValidateSnapshot detects hash mismatch** → throws `SnapshotImmutabilityError`; replay fails cleanly (NOT silently). Indicates DB tampering or trigger bypass.
- **ExecutiveSummary LLM returns text containing banned phrase ("increase conversions by 25%")** → GR-007 deterministic regex rejects; retry once with stricter system prompt; if retry also fails, fallback to deterministic message; finding_overlap test still passes because executive_summary is meta, not a per-page finding.
- **PDF generation exceeds 5MB target** → log warning; allow upload (no hard fail); flag for manual review (likely indicates excessive screenshots — usually a Phase 7 annotation regression).
- **Email send fails (Resend down)** → NotificationAdapter retries 3× with exponential backoff; after final failure, writes to `notification_dead_letter` table; admin sees in `/console/admin/operations` alert feed; audit_runs.completion_reason unchanged (audit succeeded; email is auxiliary).
- **Dashboard Edit changes finding text containing banned phrase** → GR-007 deterministic check on edit submission; rejects with inline form error; does NOT save.
- **Consultant edits finding then approves; client sees edited version** → `finding_edits` table preserves original (R7.4 append-only); `findings.text` reflects latest edit; `published_findings` view exposes latest text only.
- **Warm-up disable triggered before 3 audits or rejection_rate ≥25%** → WarmupManager.canGraduate returns false; dashboard shows blocking error; manual override via `/console/clients/[id]` toggle is admin-only (logged for audit trail).
- **Gateway concurrency limit (1 audit per client) hit** → returns HTTP 409 `concurrent_audit_in_progress`; dashboard shows "Wait for current audit" message.
- **Idempotency_key conflict (same key, different payload)** → returns HTTP 409 `idempotency_conflict`; per REQ-TRIGGER-IDEM-002a — caller must use new key (not retried).
- **Heuristic body leaks into Hono API response (R6 channel 3 violation)** → Conformance test `r6-channel-3.test.ts` asserts `GET /api/audits/:id/findings` response JSON contains `heuristic_id` only, NEVER `heuristic.body` / `heuristic.text` / `heuristic.full_content`. Test inspects every key recursively; fails if any string contains heuristic body fingerprint.
- **Heuristic body leaks into Next.js dashboard render (R6 channel 4 violation)** → Conformance test `r6-channel-4.test.ts` snapshot-tests rendered HTML for `/console/review/[id]`; asserts no heuristic body fingerprint in DOM. Uses Phase 6 redaction list as fingerprint source.
- **Audit completes with all pages skipped (perception quality low)** → ExecutiveSummary fallback: deterministic message ("Audit completed but no pages met perception quality threshold; review per-page analysis_status in appendix"); ActionPlan empty quadrants; PDF still renders with appendix-only content; consultant notified with `audit_completed` email indicating partial result.
- **Report regeneration triggered after consultant edits** → Dashboard "Regenerate report" button calls `/api/audits/:id/report/regenerate`; ReportGenerator re-runs against latest findings; new R2 key (timestamped); `audit_runs.report_pdf_url` updated.
- **Notification preference disabled** → NotificationAdapter checks `notification_preferences` table per recipient; skips delivery silently; logs to audit_events.
- **DiscoveryStrategy: NavigationCrawl deferred to v1.1** → Gateway accepts `discovery_strategy: "sitemap" | "manual"` for MVP; `"nav-crawl"` returns HTTP 400 `not_implemented_in_mvp`.
- **Two-store access mode middleware not set on a route** → Defaults to `published_only`; safer fail-secure default (REQ-TWOSTORE-002 layered enforcement).

---

## Acceptance Criteria *(mandatory — stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked REQ-ID(s) |
|----|-----------|----------------------|------------------|
| AC-01 | T156 AuditRequest TypeScript interface + Zod schema match §18.4 verbatim — fields: target, scope, budget, heuristic_set, notifications, tags, reason, external_correlation_id (no `metadata` per S5-L2-FIX); idempotency_key optional. | `packages/agent-core/tests/conformance/audit-request-schema.test.ts` | REQ-TRIGGER-CONTRACT-001, REQ-TRIGGER-CONTRACT-002 |
| AC-02 | T157 AuditRequest defaults applied (budget $15, max_pages 50, viewports ["desktop"], discovery "sitemap"); validation rejects missing required fields (client_id, target.url, primary_kpi); rejects budget > 15; rejects regulated-vertical without `constraints.regulatory`; returns structured ValidationError per §18.7. | `packages/agent-core/tests/conformance/audit-request-validate.test.ts` | REQ-TRIGGER-VALIDATE-001, REQ-TRIGGER-VALIDATE-002, REQ-TRIGGER-VALIDATE-003 |
| AC-03 | T158 GatewayService.submit() — validates via T157; creates `audit_requests` + `audit_runs` rows; calls T160 SnapshotBuilder.createSnapshot(); writes `reproducibility_snapshots` row; all in single DB transaction (REQ-TRIGGER-PERSIST-002); returns `{audit_request_id, audit_run_id}`. MVP: synchronous function call; no HTTP; no Temporal. | `packages/agent-core/tests/conformance/gateway-service.test.ts` | REQ-TRIGGER-PERSIST-001, REQ-TRIGGER-PERSIST-002, REQ-TRIGGER-PERSIST-003 |
| AC-04 | T159 CLI `audit` command refactored — constructs AuditRequest from flags; calls `GatewayService.submit()`; receives IDs; runs AuditGraph with IDs; replaces T145 inline graph compilation. | `apps/cli/tests/conformance/audit-command-gateway.test.ts` | REQ-TRIGGER-CLI-001, REQ-TRIGGER-CLI-003 |
| AC-05 | T160 SnapshotBuilder.createSnapshot() — full composition: SHA-256 hashes of `evaluate.ts` + `selfCritique.ts` + `executive_summary.ts` prompt files; reads model name + version from LLMAdapter config; reads heuristic base_pack_version + computes `overlay_chain_hash`; reads normalizer + grounding + scoring versions from config; reads `perception_schema_version: "v2.5"`; reads ContextProfile hash from Phase 4b; sets all temperatures to 0 per REQ-REPRO-001; returns ReproducibilitySnapshot. Called by Gateway BEFORE Temporal/AuditGraph start (REQ-TRIGGER-PERSIST-003). REPLACES Phase 8 T145 MVP scaffold. | `packages/agent-core/tests/conformance/snapshot-builder-create.test.ts` | REQ-REPRO-002, REQ-REPRO-003, REQ-REPRO-004, REQ-REPRO-031 |
| AC-06 | T160 SnapshotBuilder.loadAndValidateSnapshot(auditRunId) — reads existing snapshot from DB; validates immutability via re-hashing pinned input bytes + checking match; throws `SnapshotImmutabilityError` on mismatch (REQ-REPRO-032); returns snapshot for AuditState. Called by `audit_setup` node (NOT a Temporal activity per §27 fix). | `packages/agent-core/tests/conformance/snapshot-builder-load.test.ts` | REQ-REPRO-031a, REQ-REPRO-031b, REQ-REPRO-032 |
| AC-07 | T161 TemperatureGuard wraps LLMAdapter.invoke(); for `node ∈ {evaluate, self_critique, evaluate_interactive, executive_summary}` and `temperature ≠ 0` → throws `R10TemperatureGuardError`. Runtime guard, not compile-time. | `packages/agent-core/tests/conformance/temperature-guard.test.ts` | REQ-REPRO-001, REQ-REPRO-020 |
| AC-08 | T162 AccessModeMiddleware sets `SET LOCAL app.access_mode` + `SET LOCAL app.client_id` on every DB transaction; default access_mode = `published_only` if route doesn't set; all DB ops wrapped in transactions for SET LOCAL to work (M4-L2-FIX). | `packages/agent-core/tests/conformance/access-mode-middleware.test.ts` | REQ-TWOSTORE-001, REQ-TWOSTORE-002, REQ-TWOSTORE-003 |
| AC-09 | T163 WarmupManager — `getStatus(client_id) → { active, audits_completed, rejection_rate, can_graduate }`; computes graduation = `audits_completed ≥ 3 AND rejection_rate < 25%`; stores `warmup_mode_active` on client profile. determinePublishAction(finding, warmup_active, tier) returns `held | published | delayed` per §24.5. | `packages/agent-core/tests/conformance/warmup-manager.test.ts` | REQ-TWOSTORE-010, REQ-TWOSTORE-011, REQ-TWOSTORE-012, REQ-TWOSTORE-013 |
| AC-10 | T164 Extended StoreNode — checks `warmup_mode_active` before publish_status decision; during warm-up: ALL findings stored as `held` regardless of tier; post-warm-up: Tier 1 → `published`, Tier 2 → `delayed` (24h), Tier 3 → `held`; updates `state.published_finding_ids`. | `packages/agent-core/tests/conformance/store-node-twostore.test.ts` | REQ-TWOSTORE-020, REQ-TWOSTORE-021 |
| AC-11 | T165 ScoringPipeline — `determineSeverity` (from heuristic or critique downgrade), `computeConfidence` (tier × grounding × evidence), `computeBusinessImpact` (IMPACT_MATRIX lookup PageType × FunnelPosition), `computeEffort` (EFFORT_MAP lookup), `computePriority` formula `Math.round((severity*2 + impact*1.5 + confidence*1 - effort*0.5) * 100) / 100` (parentheses critical per §23.4 fix). ALL deterministic, NO LLM. | `packages/agent-core/tests/conformance/scoring-pipeline.test.ts` | REQ-FINDINGS-SCORE-001, REQ-FINDINGS-SCORE-010, REQ-FINDINGS-SCORE-020, REQ-FINDINGS-SCORE-030, REQ-FINDINGS-SCORE-040, REQ-FINDINGS-SCORE-050, REQ-FINDINGS-SCORE-051 |
| AC-12 | T166 IMPACT_MATRIX (PageType × FunnelPosition → 0-10) + DEFAULT_FUNNEL_POSITION (PageType → position; C5-L2-FIX) + EFFORT_MAP (EffortCategory → 2-10) + version string for snapshot pinning. | `packages/agent-core/tests/conformance/scoring-config.test.ts` | REQ-FINDINGS-SCORE-030, REQ-FINDINGS-SCORE-040, REQ-FINDINGS-SCORE-051 |
| AC-13 | T167 AnnotateNode extension — runs scoring pipeline on each grounded finding AFTER GR rules pass + BEFORE DB persist; writes business_impact + effort + priority + confidence to finding row. Suppression at confidence < 0.3. | `packages/agent-core/tests/conformance/annotate-node-scoring.test.ts` | REQ-FINDINGS-SCORE-001, REQ-FINDINGS-SUPPRESS-001 |
| AC-14 | T168 Suppression — reject if confidence < 0.3 OR evidence_ids empty OR exact duplicate (heuristic_id + element_ref + page); all suppressed findings logged to `rejected_findings` table (R7.4). | `packages/agent-core/tests/conformance/suppression.test.ts` | REQ-FINDINGS-SUPPRESS-001, REQ-FINDINGS-SUPPRESS-002 |
| AC-15 | T169 `/console/review/page.tsx` — lists findings WHERE `publish_status: held` sorted by priority desc; Approve/Reject/Edit actions; renders annotated screenshot inline; shows evidence + severity + confidence + business_impact + effort + priority; reads with `app.access_mode: internal`; **R6 channel 4 — heuristic body NEVER in render (only heuristic_id reference)**. | `apps/dashboard/tests/conformance/review-page.test.ts` + `r6-channel-4.test.ts` | REQ-DELIVERY-005, R6 |
| AC-16 | T170 `/console/audits/page.tsx` — lists audit runs (status, dates, finding counts); "New Audit" form submits via `GatewayService` (same path as CLI); SSE-subscribes for live progress on detail page. | `apps/dashboard/tests/conformance/audits-page.test.ts` | REQ-DELIVERY-005, REQ-DELIVERY-007 |
| AC-17 | T171 `apps/dashboard` package — Next.js 15 + shadcn/ui + Tailwind + Clerk auth; `/console/*` routes require consultant role; basic layout with sidebar nav. | `apps/dashboard/tests/conformance/auth-middleware.test.ts` | REQ-DELIVERY-004 |
| AC-18 | T172 `/console/review/[id]/page.tsx` — full finding detail (observation, assessment, recommendation, evidence); annotated screenshot with pin highlighted; heuristic source attribution = heuristic_id only (R6 channel 4); Edit form (description/recommendation/severity); Approve/Reject buttons; original preserved in `finding_edits` table. | `apps/dashboard/tests/conformance/review-detail-page.test.ts` + `r6-channel-4.test.ts` | REQ-DELIVERY-005, R6, R7.4 |
| AC-19 | T173 `/console/clients/[id]/page.tsx` — shows audits_completed / required, rejection_rate, can_graduate status; manual override toggle (admin-only; logged to audit_events). | `apps/dashboard/tests/conformance/clients-page.test.ts` | REQ-TWOSTORE-013 |
| AC-20 | T174 Phase 9 integration test — AuditRequest validates + persists; reproducibility snapshot created with temp=0 (full composition T160); scoring pipeline produces 4D scores; two-store: internal store has all findings, published view has only approved; warm-up: new client → all findings held; CLI trigger works end-to-end through gateway. | `packages/agent-core/tests/integration/phase9-foundations.test.ts` | (Phase 9 foundations gate) |
| AC-21 | T175 ★★ ACCEPTANCE TEST — `pnpm cro:audit --url https://bbc.com --pages 2 --output ./test-foundations` — exit 0; reproducibility_snapshots row has temp=0 + all versions pinned (T160 full); findings have business_impact + effort + priority + confidence != null; published_findings view returns 0 rows (warm-up active); audit_requests row exists trigger_source="cli"; consultant dashboard shows held findings sorted by priority. | `tests/acceptance/foundations-bbc-com.test.ts` | (★ MVP SPEC COMPLETE acceptance gate ★) |
| AC-22 | T245 ExecutiveSummaryGenerator — produces ExecutiveSummary type per §35.2: overall_score (0-100, deterministic formula REQ-REPORT-002), grade (A-F mapping), top_findings (top 5 by priority desc, ties → severity → confidence_tier per REQ-REPORT-005), strengths (heuristics passing on ≥80% of applicable pages — pure code, NO LLM per REQ-REPORT-003), category_breakdown, recommended_next_steps (1 LLM call, $0.10 cap, temperature=0, GR-007 enforced per REQ-REPORT-004). | `packages/agent-core/tests/conformance/executive-summary-generator.test.ts` | REQ-REPORT-001, REQ-REPORT-002, REQ-REPORT-003, REQ-REPORT-004, REQ-REPORT-005 |
| AC-23 | T246 ExecutiveSummary integration — extends Phase 8 AuditCompleteNode (T139) to populate `state.executive_summary`; written to `audit_runs.executive_summary` JSONB column; non-null when `audit_runs.status: completed`. | `packages/agent-core/tests/conformance/audit-complete-executive-summary.test.ts` | REQ-REPORT-001 |
| AC-24 | T247 ActionPlanGenerator — deterministic bucketing into 4 quadrants: high_impact = `business_impact ≥ 6`; low_effort = `effort_hours ≤ 8`; quick_wins (high+low), strategic (high+high), incremental (low+low), deprioritized (low+high). Sort by priority desc within each. `estimated_total_effort_hours` computed. NO LLM per REQ-REPORT-011. | `packages/agent-core/tests/conformance/action-plan-generator.test.ts` | REQ-REPORT-010, REQ-REPORT-011, REQ-REPORT-012 |
| AC-25 | T248 Next.js report HTML template — `/api/report/[audit_run_id]/render` returns 8-section HTML page (Cover, Executive Summary, Action Plan, Findings by Category, Cross-Page Patterns, Methodology, Appendix, Reproducibility Note per §35.4 + REQ-REPORT-022); branded per client via ReportTemplate config (logo_url, primary_color, secondary_color, company_name; default REO Digital). **R6 channel 4 — heuristic body NEVER in render**. | `apps/dashboard/tests/conformance/report-template.test.ts` + `r6-channel-4.test.ts` | REQ-REPORT-020, REQ-REPORT-021, REQ-REPORT-022, REQ-REPORT-023, R6 |
| AC-26 | T249 ReportGenerator — Playwright `page.pdf()` invocation against `/api/report/[id]/render`; size ≤5MB (REQ-REPORT-024); render time <30s (NF-001); R2 upload at `/{client_id}/reports/{audit_run_id}/report.pdf`; URL written to `audit_runs.report_pdf_url`; if `analysis_status != complete` for any page, appendix includes "Pages Not Fully Analyzed" section per REQ-REPORT-030. | `packages/agent-core/tests/conformance/report-generator.test.ts` | REQ-REPORT-020, REQ-REPORT-024, REQ-REPORT-025, REQ-REPORT-030, REQ-DELIVERY-REPORT-001, REQ-DELIVERY-REPORT-002 |
| AC-27 | T256 DiscoveryStrategy adapter interface defined; 3 implementations: SitemapDiscovery (parse robots.txt + sitemap.xml), NavigationCrawlDiscovery (DEFERRED to v1.1 — interface stub only), ManualDiscovery (consume AuditRequest.target.urls[] directly). | `packages/agent-core/tests/conformance/discovery-strategy.test.ts` | (v2.2a design spec §1.2) |
| AC-28 | T257 DiscoveryStrategy integration in AuditSetupNode — selects strategy based on `AuditRequest.discovery_strategy` enum; produces `AuditPage[]` for PageRouterNode queue; rejects `nav-crawl` with HTTP 400 (deferred); SitemapDiscovery + ManualDiscovery work end-to-end. | `packages/agent-core/tests/conformance/discovery-strategy-integration.test.ts` | (v2.2a design spec §1.2) |
| AC-29 | T260 NotificationAdapter interface defined; EmailNotificationAdapter Resend implementation (Postmark fallback documented but not implemented in MVP); `notification_preferences` table created (per-user; defaults from REQ-DELIVERY-NOTIFY-003). | `packages/agent-core/tests/conformance/notification-adapter.test.ts` | REQ-DELIVERY-NOTIFY-001, REQ-DELIVERY-NOTIFY-002, REQ-DELIVERY-NOTIFY-003 |
| AC-30 | T261 Notification integration in AuditCompleteNode — fires `audit_completed` (recipient = consultant per REQ-DELIVERY-NOTIFY-002); `audit_failed` on completion_reason ∈ {budget_exceeded, error, snapshot_missing, ...}; `findings_ready_for_review` when warm-up findings published. Honors notification_preferences (skip silently if disabled). | `packages/agent-core/tests/conformance/notification-integration.test.ts` | REQ-DELIVERY-NOTIFY-001, REQ-DELIVERY-NOTIFY-002 |
| AC-31 | T239 Pino structured logging — every log line is JSON with mandatory correlation fields (audit_run_id, page_url, node_name, heuristic_id, trace_id) per REQ-OBS-002; 4 log levels per REQ-OBS-003; sensitive data redacted (heuristic body, secrets, PII) per REQ-OBS-004; `console.log` forbidden in production code per REQ-OBS-005 + R10. **R6 channel 1 reaffirmed (Phase 6 first activation; here verified end-to-end via integration test)**. | `packages/agent-core/tests/conformance/pino-logger.test.ts` + Phase 6 r6-channel-1 inheritance | REQ-OBS-001, REQ-OBS-002, REQ-OBS-003, REQ-OBS-004, REQ-OBS-005, R6 |
| AC-32 | T240 audit_events table migration — table + indexes per §13.7 REQ-DATA-V22-002; 22 event_type values enumerated in TypeScript types per REQ-OBS-012. | `packages/agent-core/tests/conformance/audit-events-table.test.ts` | REQ-OBS-010, REQ-OBS-011, REQ-OBS-012, REQ-OBS-013 |
| AC-33 | T241 Event emission across all graph nodes — EventEmitter injected; running an audit produces all 22 event types per REQ-OBS-012; events appear in `audit_events` table (R7.4 append-only) AND in SSE stream per REQ-DELIVERY-007; trace_id shared per node call per REQ-OBS-014. | `packages/agent-core/tests/conformance/event-emission.test.ts` | REQ-OBS-010, REQ-OBS-011, REQ-OBS-012, REQ-OBS-013, REQ-OBS-014 |
| AC-34 | T242 + T243 — `heuristic_health_metrics` materialized view (per REQ-OBS-021 + §13.7 REQ-DATA-V22-003); nightly refresh job; `health_score < 0.3` flags heuristic for rewrite per REQ-OBS-022. AlertingJob (BullMQ) runs every 5 min; 7 alert rules per REQ-OBS-030; debounced per (audit_run_id, alert_type, hour) per REQ-OBS-032. | `packages/agent-core/tests/conformance/heuristic-health-metrics.test.ts` + `alerting-job.test.ts` | REQ-OBS-021, REQ-OBS-022, REQ-OBS-030, REQ-OBS-031, REQ-OBS-032 |
| AC-35 | T244 `/console/admin/operations` — 6 sections rendered per REQ-OBS-041 (active audits, 24h summary, heuristic health, alert feed, cost trend, failure breakdown); admin-role-only per REQ-OBS-040 + REQ-DELIVERY-OPS-002; queries from `audit_events` + `llm_call_log` + `heuristic_health_metrics` mat view per REQ-OBS-042; build LAST per REQ-DELIVERY-OPS-003. | `apps/dashboard/tests/conformance/ops-dashboard.test.ts` | REQ-OBS-040, REQ-OBS-041, REQ-OBS-042, REQ-DELIVERY-OPS-001, REQ-DELIVERY-OPS-002, REQ-DELIVERY-OPS-003 |
| AC-36 | **R6 channel 3 + 4 first-runtime activation**. Conformance test inspects every `GET /api/audits/:id/findings`, `GET /api/findings/:id`, `GET /api/audits/:id/patterns` response JSON for absence of heuristic body fingerprint (recursive deep scan); inspects rendered HTML of `/console/review`, `/console/review/[id]`, `/api/report/[id]/render` for absence of heuristic body fingerprint. ALL 4 R6 channels live = first external pilot prereq (Phase 6 ch1 + Phase 7 ch2 + Phase 9 ch3 + ch4). | `packages/agent-core/tests/conformance/r6-channel-3.test.ts` + `apps/dashboard/tests/conformance/r6-channel-4.test.ts` | R6 |
| AC-37 | **★ MVP SPEC COMPLETE ★** Phase 9 EXIT GATE = AC-21 (T175 acceptance) + AC-26 (PDF) + AC-30 (email) + AC-36 (R6 channels 3+4) all green. After this, MVP spec corpus is COMPLETE and implementation can start at Phase 0. | end-to-end suite | (★ MVP SPEC COMPLETE ★) |

---

## Functional Requirements *(mandatory — cross-ref existing PRD F-IDs where applicable)*

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | AuditRequest contract (T156) SHALL match §18.4 verbatim — `target { url, urls[]?, sitemap_url? }`, `scope { max_pages, viewports[], discovery_strategy }`, `budget { audit, page }`, `heuristic_set { pack_id, version, overlay? }`, `notifications { email[], webhook_url? }`, `tags[]`, `reason?`, `external_correlation_id?`, `idempotency_key?`. NO `metadata` field per S5-L2-FIX. Zod schema mirrors TypeScript exactly. | F-001 | §18.4 REQ-TRIGGER-CONTRACT-001 |
| R-02 | Gateway validation (T157 + T158) SHALL apply defaults (budget.audit=15, max_pages=50, viewports=["desktop"], discovery_strategy="sitemap"); reject missing required fields; reject `budget.audit > 15` (R8.1); reject regulated vertical without `constraints.regulatory`; return structured ValidationError per §18.7 REQ-TRIGGER-VALIDATE-002. | F-001, F-021 | §18.7 |
| R-03 | GatewayService.submit() (T158) SHALL be a synchronous function call for MVP — no HTTP server, no Temporal. Creates `audit_requests` + `audit_runs` + `reproducibility_snapshots` rows in single DB transaction (REQ-TRIGGER-PERSIST-002). Returns `{audit_request_id, audit_run_id}`. CLI (T159) and Dashboard (T170) both call this same function path. | F-001 | §18.8 |
| R-04 | SnapshotBuilder (T160) SHALL fully compose ReproducibilitySnapshot per §25.4 — pinning model_version + prompt template SHA-256 hashes (evaluate, selfCritique, executive_summary) + heuristic_pack_hash + ContextProfile_hash + perception_schema_version "v2.5" + temperature_invariant 0 + normalizer + grounding + scoring versions. REPLACES Phase 8 T145 MVP scaffold. Created by Gateway BEFORE AuditGraph start (REQ-TRIGGER-PERSIST-003). loadAndValidateSnapshot(auditRunId) called by `audit_setup` node (REQ-REPRO-031a). Immutable post-creation (REQ-REPRO-032). | F-015 | §25.3, §25.4 |
| R-05 | TemperatureGuard (T161) SHALL wrap LLMAdapter.invoke(); for tagged calls (`evaluate`, `self_critique`, `evaluate_interactive`, `executive_summary`) reject `temperature ≠ 0` with `R10TemperatureGuardError`. | F-015 | R10, R13, REQ-REPRO-001, REQ-REPRO-020 |
| R-06 | AccessModeMiddleware (T162) SHALL set `SET LOCAL app.access_mode` + `SET LOCAL app.client_id` on every DB transaction; default `published_only` if route omits (fail-secure layered enforcement per REQ-TWOSTORE-002). | F-016 | §24.3 |
| R-07 | WarmupManager (T163) SHALL compute warm-up status `{active, audits_completed, rejection_rate, can_graduate}`; graduation criteria `audits_completed ≥ 3 AND rejection_rate < 25%`; determinePublishAction(finding, warmup_active, tier) returns `held | published | delayed` per §24.5. | F-016 | §24.4 REQ-TWOSTORE-010..013 |
| R-08 | StoreNode extension (T164) SHALL gate publish_status decision on `warmup_mode_active`; during warm-up: ALL findings → `held` regardless of tier; post-warm-up: Tier 1 → `published`, Tier 2 → `delayed` (24h via §12.4 worker), Tier 3 → `held`; updates `state.published_finding_ids`. | F-016 | §24.5 REQ-TWOSTORE-020, REQ-TWOSTORE-021 |
| R-09 | ScoringPipeline (T165 + T166) SHALL compute 4D scores deterministically — severity / confidence / business_impact / effort / priority — per §23.4 formulas. NO LLM. IMPACT_MATRIX (PageType × FunnelPosition → 0-10), DEFAULT_FUNNEL_POSITION (PageType → position, C5-L2-FIX), EFFORT_MAP (EffortCategory → 2-10) all version-pinned for snapshot. | F-005 | §23.4 REQ-FINDINGS-SCORE-001..051 |
| R-10 | AnnotateNode (T167) SHALL run scoring pipeline AFTER GR rules pass + BEFORE DB persist; writes business_impact + effort + priority + confidence to finding row; suppresses at confidence < 0.3 (REQ-FINDINGS-SUPPRESS-001). Suppression (T168) also rejects empty evidence_ids + exact duplicates (heuristic_id + element_ref + page); suppressed → `rejected_findings` (R7.4). | F-005, F-016 | §23.5 REQ-FINDINGS-SUPPRESS-001..002 |
| R-11 | Consultant dashboard (T169-T173) SHALL run on Next.js 15 + shadcn/ui + Tailwind + Clerk; routes: `/console/audits` (list + New Audit form), `/console/review` (held findings inbox), `/console/review/[id]` (finding detail), `/console/clients/[id]` (warm-up status + override toggle). All `/console/*` require consultant role. **R6 channel 4 — heuristic body NEVER in any rendered page; only heuristic_id references**. | F-019 | §14.3 REQ-DELIVERY-004, REQ-DELIVERY-005 |
| R-12 | Hono REST API (T171 server side; covers T169-T173 backend) SHALL expose endpoints per §14.4 (audits, findings, patterns, report, regenerate, approve/reject/edit) — all routes use AccessModeMiddleware (R-06); SSE stream at `GET /api/audits/:id/stream` per REQ-DELIVERY-007. **R6 channel 3 — heuristic body NEVER in any response payload; only heuristic_id references**. | F-019 | §14.4, §14.5 REQ-DELIVERY-006, REQ-DELIVERY-007 |
| R-13 | ExecutiveSummaryGenerator (T245) SHALL produce ExecutiveSummary per §35.2 — overall_score (0-100, deterministic formula REQ-REPORT-002), grade (A-F via thresholds 90/80/70/60/<60), top_findings (top 5 by priority desc; ties → severity → confidence_tier per REQ-REPORT-005), strengths (heuristics passing on ≥80% of applicable pages, pure code per REQ-REPORT-003), category_breakdown, recommended_next_steps via 1 LLM call ($0.10 cap, temperature=0, GR-007 enforced on output text per REQ-REPORT-004). | F-017 | §35.2 |
| R-14 | ActionPlanGenerator (T247) SHALL deterministically bucket grounded findings into 4 quadrants per REQ-REPORT-010 + REQ-REPORT-011: quick_wins (high impact + low effort), strategic (high+high), incremental (low+low), deprioritized (low+high). High impact = `business_impact ≥ 6`; low effort = `effort_hours ≤ 8`. Sort by priority desc within each. NO LLM. | F-017 | §35.3 |
| R-15 | ReportGenerator (T248 + T249) SHALL produce branded PDF via Next.js HTML template at `/api/report/[id]/render` → Playwright `page.pdf()`; 8 sections in order (Cover, Executive Summary, Action Plan, Findings by Category, Cross-Page Patterns, Methodology, Appendix, Reproducibility Note per REQ-REPORT-022); ≤5MB; <30s render time; ReportTemplate branding per client (logo_url, primary_color, secondary_color, company_name). R2 upload at `/{client_id}/reports/{audit_run_id}/report.pdf`; URL stored in `audit_runs.report_pdf_url` (REQ-DELIVERY-REPORT-001..003). Partial-report appendix per REQ-REPORT-030 when any page `analysis_status != complete`. | F-018 | §35.4, §14.6 REQ-DELIVERY-REPORT-001..003 |
| R-16 | DiscoveryStrategy (T256 + T257) SHALL be an adapter interface; 3 implementations — SitemapDiscovery (parse robots.txt + sitemap.xml), ManualDiscovery (consume `target.urls[]`), NavigationCrawlDiscovery (interface stub; deferred to v1.1). AuditSetupNode selects via `AuditRequest.discovery_strategy` enum; rejects `nav-crawl` with HTTP 400 in MVP. | F-001 | (v2.2a design spec §1.2) |
| R-17 | NotificationAdapter (T260) SHALL be an adapter interface; EmailNotificationAdapter Resend implementation (Postmark documented as fallback). `notification_preferences` table per user (defaults: all enabled for consultants, opt-in for clients per REQ-DELIVERY-NOTIFY-003). Events: `audit_completed`, `audit_failed`, `findings_ready_for_review` per REQ-DELIVERY-NOTIFY-001..002. | F-020 | §14.8 REQ-DELIVERY-NOTIFY-001..003 |
| R-18 | NotificationAdapter integration (T261) — fires from AuditCompleteNode (Phase 8 T139 extension); honors `notification_preferences` (skip silently if disabled); failure → 3× exponential backoff retry; final failure → `notification_dead_letter` table; admin sees in ops dashboard alert feed. | F-020 | §14.8 |
| R-19 | Pino structured logging (T239) SHALL replace any `console.log` in production code per REQ-OBS-005 + R10; every log line is JSON with mandatory correlation fields (audit_run_id, page_url, node_name, heuristic_id, trace_id) per REQ-OBS-002; 4 log levels (info/warn/error/debug) per REQ-OBS-003; sensitive data redacted (heuristic body, secrets, PII) per REQ-OBS-004. **R6 channel 1 reaffirmed end-to-end here (Phase 6 first activation already redacted heuristic body)**. | F-021 | §34.3 REQ-OBS-001..005 |
| R-20 | audit_events table (T240) + emission (T241) SHALL provide append-only event log per REQ-OBS-010..014; 22 canonical event_type values per REQ-OBS-012 (audit_started, audit_completed, audit_failed, page_analyze_started, page_analyze_completed, finding_produced, finding_rejected, llm_call_started, llm_call_completed, ...); EventEmitter injected into all graph nodes; events appear in DB AND in SSE stream per REQ-DELIVERY-007; trace_id shared per node call per REQ-OBS-014. | F-021 | §34.4 |
| R-21 | Heuristic health metrics (T242) — materialized view per §13.7 REQ-DATA-V22-003 + REQ-OBS-021; nightly refresh; health_score < 0.3 flags heuristic for rewrite per REQ-OBS-022 (feeds §28 Learning Service post-MVP). AlertingJob (T243) BullMQ job every 5 min; 7 alert rules per REQ-OBS-030; debounced per (audit_run_id, alert_type, hour) per REQ-OBS-032. | F-021 | §34.5, §34.6 |
| R-22 | Operations dashboard (T244) `/console/admin/operations` — 6 sections per REQ-OBS-041 (active audits, 24h summary, heuristic health table, alert feed, cost trend, failure breakdown); admin-role-only per REQ-OBS-040 + REQ-DELIVERY-OPS-002; queries from `audit_events` + `llm_call_log` + `heuristic_health_metrics` mat view per REQ-OBS-042; **build LAST in Phase 9** per REQ-DELIVERY-OPS-003 + §35.6. | F-021 | §34.7, §14.7 |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-01 | T175 (bbc.com 2-page foundations test) total wall-clock | <10 min | NF-005 | Acceptance test timer |
| NF-02 | T175 total cost | <$3 (2 pages × ~$0.50 + ExecutiveSummary $0.10) | NF-002 | `audit_runs.total_cost_usd` after T175 |
| NF-03 | PDF render wall-clock | <30s per audit | NF-001 | Conformance test (T249) |
| NF-04 | PDF size | ≤5MB per audit | NF-001 | Conformance test (T249) |
| NF-05 | ExecutiveSummary LLM cost | ≤$0.10 per audit | NF-002 | `llm_call_log` row WHERE node="executive_summary" |
| NF-06 | Reproducibility — same AuditRequest + same snapshot → finding ID overlap | ≥90% within 24h (F-015) | NF-006 | Replay test on T148 fixture (Phase 8 acceptance gate; Phase 9 SnapshotBuilder unblocks) |
| NF-07 | Email delivery on `audit_completed` | <60s after AuditCompleteNode emits event | — | Resend webhook ack timing |
| NF-08 | Dashboard page load (any `/console/*` route) | <2s p95 | NF-005 | Lighthouse CI |
| NF-09 | SSE stream latency (event emit → dashboard render) | <1s p95 | NF-005 | Browser perf instrumentation in conformance test |
| NF-10 | R6 channel 3 + 4 conformance — heuristic body fingerprint detected in any API response or rendered HTML | 0 occurrences (zero-tolerance) | — | Conformance test recursive scan |
| NF-11 | audit_events table write latency | <50ms p95 per event | — | Phase 4 baseline DB perf instrumentation |
| NF-12 | heuristic_health_metrics materialized view refresh wall-clock | <60s nightly | — | Refresh job timer |
| NF-13 | T175 acceptance test runs offline against MockLLMAdapter (per §36.6 Phase 0 mock infra) | Offline mode green | — | NEURAL_MODE=offline integration test |

---

## Key Entities

- **AuditRequest:** Phase 9 PRODUCER (CLI flags + Dashboard form → Zod-validated request); Phase 4b T4B-009 originally specified the schema; Phase 8 T137 CONSUMES at AuditSetupNode.
- **ReproducibilitySnapshot (full composition):** Phase 9 T160 PRODUCER. Pins model_version + prompt_hashes (evaluate, selfCritique, executive_summary) + heuristic_pack_hash + ContextProfile_hash + perception_schema_version "v2.5" + temperature_invariant 0 + normalizer / grounding / scoring versions. Immutable post-creation per REQ-REPRO-032 + DB trigger §13.6.7.
- **ScoredFinding:** Extension of Finding adding business_impact / effort / priority / confidence — all deterministic per §23.4.
- **ExecutiveSummary:** Per §35.2 — overall_score + grade + top_findings + strengths + category_breakdown + recommended_next_steps. Persisted to `audit_runs.executive_summary` (JSONB).
- **ActionPlan:** Per §35.3 — 4 quadrants of grounded findings sorted by priority. Persisted to `audit_runs.action_plan` (JSONB).
- **ReportTemplate:** Per-client branding config (logo_url, primary_color, secondary_color, company_name). Default: REO Digital / Neural.
- **DiscoveryStrategy:** Adapter interface; SitemapDiscovery + ManualDiscovery active in MVP; NavigationCrawlDiscovery deferred to v1.1.
- **NotificationAdapter:** Adapter interface; EmailNotificationAdapter Resend in MVP. `notification_preferences` table per user.
- **AccessModeMiddleware:** Sets `app.access_mode` + `app.client_id` SET LOCAL on every DB transaction; `published_only` default fail-secure.
- **WarmupManager:** Computes warm-up state; graduation criteria; determinePublishAction.
- **finding_edits table:** Append-only per R7.4; preserves original on dashboard Edit.
- **notification_preferences table:** Per-user mutable config.
- **heuristic_health_metrics materialized view:** Per §13.7 REQ-DATA-V22-003; nightly refresh.
- **AuditEvent (22 types):** REQ-OBS-012 canonical taxonomy; emitted from all graph nodes; DB + SSE.
- **PinoLogger:** Structured JSON logger; Phase 6 first activation extended to all nodes here.

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** T175 (bbc.com 2-page foundations) acceptance test passes: exit 0; reproducibility_snapshots row has temp=0 + all 6 versions pinned (model_version + prompt_hashes + heuristic_pack_hash + ContextProfile_hash + perception_schema_version + scoring_version); findings have business_impact + effort + priority + confidence != null; published_findings view returns 0 rows (warm-up); audit_requests row trigger_source="cli"; dashboard shows held findings sorted by priority.
- **SC-002:** ExecutiveSummary LLM call cost ≤$0.10 verified via `llm_call_log` query.
- **SC-003:** GR-007 deterministic regex passes on every ExecutiveSummary `recommended_next_steps` text — zero banned-phrase false negatives across 50+ test summaries.
- **SC-004:** PDF renders in <30s; size ≤5MB; 8 sections in order; R2 upload succeeds; URL persisted to `audit_runs.report_pdf_url`.
- **SC-005:** Reproducibility replay (24h delay, same AuditRequest, same snapshot loaded via T160 loadAndValidateSnapshot) → finding overlap ≥90% (F-015 / NF-006).
- **SC-006:** Warm-up flow end-to-end: new client → 3 audits → rejection_rate <25% → can_graduate=true; consultant disables → 4th audit → Tier 1 findings auto-published.
- **SC-007:** R6 channels 3 + 4 conformance — recursive scan of every Hono response + every rendered HTML page detects ZERO heuristic body fingerprints.
- **SC-008:** All 4 R6 channels live (Pino + LangSmith + Hono API + Next.js render) = first external pilot prereq satisfied.
- **SC-009:** Email delivery `audit_completed` succeeds <60s after AuditCompleteNode emits event; failures retry 3× then DLQ.
- **SC-010:** All 22 audit_event types emit on a single end-to-end audit run (verified via DB query post-T175).
- **SC-011:** AccessModeMiddleware fail-secure default — route without explicit access_mode set serves `published_only` queries (no internal data leak).
- **SC-012:** ScoringPipeline determinism — same Finding input → identical score output across 100 invocations (no LLM, no Date.now drift, no random seeds).
- **SC-013:** ★ MVP SPEC COMPLETE ★ — Phase 9 spec corpus shipped (this artifact + plan.md + tasks.md + impact.md + README.md + checklists/requirements.md); INDEX.md v1.3; tasks-v2.md drift patched if any. Implementation can start at Phase 0.

---

## Constitution Alignment Check *(mandatory — must pass before status: approved)*

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — ExecutiveSummary `recommended_next_steps` LLM output passes through GR-007 deterministic regex check; banned phrases trigger retry + deterministic fallback.
- [x] Does NOT auto-publish findings without consultant review during warm-up (R-08 / F-016) — T164 StoreNode extension + WarmupManager gates publish_status.
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — `finding_edits` + `audit_events` + `audit_log` + `llm_call_log` + `findings` + `rejected_findings` all append-only; `audit_runs` mutable status; `notification_preferences` mutable per user; `reproducibility_snapshots` immutable per DB trigger §13.6.7.
- [x] Does NOT import vendor SDKs outside adapters (R9) — Resend via EmailNotificationAdapter; Playwright via existing BrowserEngine reuse for `page.pdf()`; Drizzle via StorageAdapter; Clerk via Next.js middleware (boundary; not business logic).
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` / `executive_summary` (R10 + R13) — T161 TemperatureGuard wraps LLMAdapter; tagged calls require temp=0.
- [x] Does NOT expose heuristic content in API/dashboard/PDF (R6 channels 3 + 4) — conformance tests recursively scan responses + rendered HTML for absence of fingerprints; only heuristic_id references allowed.
- [x] DOES include a conformance test stub for every AC-NN (PRD §9.6 + R3 TDD) — AC-01..AC-37 each have a test path.
- [x] DOES carry frontmatter delta block on subsequent edits (R18)
- [x] DOES define kill criteria for tasks > 2 hrs OR shared-contract changes (R23) — tracked in plan.md (T160 SnapshotBuilder coordination with Phase 8 T145 supersession; ExecutiveSummary GR-007 false-positive rate; PDF render <30s regression; R6 channels 3+4 leak; warmup graduation logic regression).
- [x] DOES reference REQ-IDs from `docs/specs/final-architecture/` for every R-NN (R11.2) — all 22 cite REQ-TRIGGER-* / REQ-REPRO-* / REQ-TWOSTORE-* / REQ-FINDINGS-* / REQ-DELIVERY-* / REQ-REPORT-* / REQ-OBS-*.

---

## Out of Scope (cite PRD §3.2 explicit non-goals)

- **Gateway HTTP server** — DEFERRED to v1.1+ per PRD §3.2. MVP Gateway is sync function call (T158).
- **Temporal workflow integration** — DEFERRED to v1.1+. MVP uses LangGraph PostgresCheckpointer (Phase 8 T144).
- **NavigationCrawlDiscovery** — DEFERRED to v1.1 per master plan. MVP supports SitemapDiscovery + ManualDiscovery only (T256).
- **Postmark notification adapter implementation** — DEFERRED to v1.1 (interface documented; Resend is MVP).
- **Multi-tenant SaaS** — DEFERRED to v1.2 per CLAUDE.md §14 (single-agency MVP).
- **Webhook notifications** — DEFERRED to v1.1 (REQ-DELIVERY-NOTIFY-001 says "Email for MVP. Webhook post-MVP").
- **Client-facing dashboard** (REQ-DELIVERY clients-side) — DEFERRED to v1.1; MVP is consultant-only (`/console/*`).
- **Self-service client audits** (REQ-TRIGGER-CLIENT-001..003) — DEFERRED to v1.1.
- **Audit scheduler** (REQ-TRIGGER-SCHEDULER-001..004) — DEFERRED to Phase 13 master.
- **MCP `cro_trigger_audit` write tool** — DEFERRED to Phase 11 per REQ-TRIGGER-MCP-003.
- **Re-run audit feature with `source_pinned`** (REQ-REPRO-070..072) — Foundation in T160 (replay path); UI button DEFERRED to v1.1.
- **Diff explainer** (REQ-REPRO-060..063) — DEFERRED to v1.1.
- **§28 Learning Service heuristic-rewrite feedback loop** — DEFERRED post-MVP. Phase 9 only flags `health_score < 0.3` for human triage.
- **Conversion-rate prediction** (permanent non-goal, R5.3 + GR-007).
- **Authenticated pages** (PRD §3.2 permanent non-goal).
- **Persona-based ExecutiveSummary variants** — DEFERRED to v1.1; MVP single-summary per audit.

---

## Assumptions

- Phase 7 + Phase 8 spec corpus shipped + rollups approved before Phase 9 implementation begins.
- Phase 8 T145 CLI MVP snapshot scaffold is documented as a placeholder for T160 SnapshotBuilder; T160 plug-replaces with full composition; CLI refactor at T159 unifies the path.
- Phase 0b 30-heuristic pack committed; T175 acceptance fixture available.
- Resend API key + sandbox account provisioned for CI before T260 implementation begins.
- Cloudflare R2 bucket + access keys provisioned; local-disk fallback configured for dev (per PRD tech stack).
- Clerk consultant org configured with admin role for T244 ops dashboard access.
- Next.js 15 + shadcn/ui + Tailwind CSS pinned versions in `apps/dashboard/package.json` per PRD tech stack table.
- Hono 4.x already wired in agent-core (Phase 4 baseline).
- Phase 4 schema baseline (T070) includes `audit_runs.executive_summary` (JSONB) + `audit_runs.action_plan` (JSONB) + `audit_runs.report_pdf_url` columns; if not, schema migration filed as task delta in Phase 9.
- BullMQ + Redis (Upstash in prod) wired in Phase 4 baseline; T243 AlertingJob reuses.
- Pino logger + base config wired in Phase 6; T239 extends with full correlation field set.
- The 4 R6 channels enumeration is canonical: (1) Pino logs — Phase 6 first activation; (2) LangSmith trace metadata — Phase 7 first activation; (3) Hono API responses — Phase 9 first activation; (4) Next.js dashboard pages — Phase 9 first activation. AES-256-GCM at rest (R6.2) is the post-MVP v1.1 layer added BEFORE first external pilot.
- Sharp + Playwright already required by Phase 1/7 — no new install for `page.pdf()`.
- `pnpm cro:audit --replay <id>` flag added to T159 CLI scope (small extension of T145 CLI).

---

## Next Steps

After this spec is approved (`status: draft → validated → approved`):

1. Run `/speckit.plan` to generate plan.md (already drafted alongside this spec).
2. Run `/speckit.tasks` to align tasks.md with `tasks-v2.md` Phase 9 sections.
3. Run `/speckit.analyze` for cross-artifact consistency.
4. Phase 9 implementation begins after Phase 8 ships and `phase-8-current.md` rollup is approved.
5. Implementation order (per plan.md §1):
   - **Block A — Foundations core** (T156-T168): AuditRequest contract → Gateway → SnapshotBuilder → TemperatureGuard → AccessModeMiddleware → WarmupManager → StoreNode extension → ScoringPipeline → Suppression
   - **Block B — Dashboard core** (T171 → T169 → T170 → T172 → T173): auth/layout first, then review, audits list, finding detail, clients page
   - **Block C — Delivery core** (T245 → T246 → T247 → T248 → T249): ExecutiveSummary → integration → ActionPlan → HTML template → PDF
   - **Block D — Adapters** (T256 → T257 → T260 → T261): DiscoveryStrategy → integration; NotificationAdapter → integration
   - **Block E — Observability** (T239 → T240 → T241 → T242 → T243): Pino → events table → emission → metrics view → alerting
   - **Block F — Acceptance + ops dashboard LAST** (T174 → T175 → T244): foundations test → bbc.com acceptance → ops dashboard
6. Phase 9 status: `draft → validated → approved → implemented → verified` (verified after T175 + T244 green = MVP SPEC + IMPL gate complete).
7. After Phase 9 ships → MVP shippable for first external pilot (with v1.1 R6.2 AES at-rest layer added before pilot).
