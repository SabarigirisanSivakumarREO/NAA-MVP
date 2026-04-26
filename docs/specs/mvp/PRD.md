---
title: Neural MVP — Product Requirements Document
artifact_type: prd
status: approved
version: 1.2
created: 2026-04-22
updated: 2026-04-24
owner: product + engineering lead
authors: [REO Digital team, Claude]
reviewers: [REO Digital team]

supersedes: v1.1
supersededBy: null

derived_from:
  - docs/specs/final-architecture/ (§01-§36 + §33a)
  - docs/specs/mvp/tasks-v2.md
  - docs/engineering-practices/ai-orchestration-research-2026-04-24.md

req_ids: []  # PRD introduces F-001..F-021 + NF-001..NF-010, tracked inline

impact_analysis: null
breaking: false
affected_contracts: []

delta:
  new:
    - §10.9 PR Contract (per code-review-ai research)
    - §10.10 Comprehension-debt pacing (per cognitive-parallel-agents research)
    - R17 lifecycle frontmatter on PRD.md itself (was missing; self-compliance fix)
    - F-012 amendment 2026-04-26 — heuristic authoring switched from CRO-parallel to LLM-assisted with human verification (engineering-owned in Phase 0b)
    - §3.1 item 6 amendment 2026-04-26 — clarified LLM-assisted authoring + provenance requirement
  changed:
    - References throughout aligned to master plan v2.3
    - References throughout cite docs/engineering-practices/ai-orchestration-research-2026-04-24.md
    - F-012 acceptance criteria expanded to require provenance + verification evidence in PR Contract
  impacted:
    - docs/specs/mvp/constitution.md (R22-R23 added; R15.3 expanded with provenance + verification rules on 2026-04-26)
    - docs/specs/mvp/phases/INDEX.md (Phase 0b row updated 2026-04-26 to engineering-owned)
    - .claude/skills/neural-dev-workflow/ (new runtime playbook operationalizing §10.9-10.10)
    - CLAUDE.md (§7 reference drift fix done)
    - HeuristicSchema (Phase 6 implementation must add provenance fields per Constitution R15.3)
  unchanged:
    - F-001..F-011, F-013..F-021 functional requirements (only F-012 amended)
    - NF-001..NF-010 non-functional requirements
    - §6 architecture (5-layer stack)
    - §6.4 tech stack
    - R6 IP protection (still applies regardless of author — restated in R15.3.3 for clarity)

governing_rules:
  - Constitution R17 (Lifecycle)
  - Constitution R18 (Delta)
  - Constitution R22 (Ratchet)
  - PRD §12 (Spec-Driven Workflow)
---

# Neural MVP — Product Requirements Document

> **Summary (~150 tokens — agent reads this first):** Canonical Product Requirements Document for Neural MVP v1.2. Input to Spec Kit CLI. Covers product vision (§2), scope (§3), functional + non-functional requirements (§4-5), 5-layer architecture (§6), component breakdown (§7), commands (§8), testing strategy (§9), Claude Code operational boundaries (§10), domain + policies (§11), spec-driven workflow (§12), success metrics (§13), timeline (§14), risks + mitigations (§15), and appendices with mini-spec pattern and conformance test templates.

> **Product:** Neural — AI CRO Audit Platform
> **Company:** REO Digital (Indian digital agency)
> **Version:** 1.2 (2026-04-22, updated 2026-04-24) — adds Constitution R17-R21 (lifecycle, delta, rollup, impact, traceability) + R22-R23 (Ratchet, Kill criteria) + §10.9-10.10 (PR Contract, Comprehension-debt pacing) + phases/ folder structure + templates/ + scripts/ per scalable SDD framework (see §16)
> **Status:** Approved; ready for Spec Kit CLI → `/speckit.specify` → `/speckit.plan` → `/speckit.tasks`
> **Source of truth (architecture):** `docs/specs/final-architecture/§01-§36 + §33a` (master plan v2.3)
> **This document's role:** Canonical PRD. Spec Kit consumes this to regenerate `spec.md`, `plan.md`, `tasks.md`. All other session-specific docs archived or deleted.

---

## 1. Table of Contents

1. Table of Contents
2. Product Vision
3. Scope
4. Functional Requirements (F-001 through F-021)
5. Non-Functional Requirements (NF-001 through NF-010)
6. Architecture
    6.1 Five-layer architecture
    6.2 Pipeline flow
    6.3 Data contracts
    6.4 Tech stack (precise names + versions)
    6.5 **Project structure map** *(new — where files live)*
7. Component Breakdown
8. Commands + Tooling
    8.0 **Quick command reference** *(new — sidebar cheat sheet)*
    8.1-8.7 (detailed commands)
9. Testing Strategy
    9.1 Philosophy
    9.2 Stack
    9.3 Coverage targets
    9.4 Phase exit criteria
    9.5 Real-LLM policy
    9.6 **Conformance test suite** *(new — per-component sample tests)*
10. Claude Code Operational Boundaries
    10.1 ALWAYS
    10.2 ASK FIRST
    10.3 NEVER
    10.4 Self-check protocol
    10.5 Sub-agent dispatch policy
    10.6 **Agent self-verification against acceptance criteria** *(new)*
    10.7 **Modular prompt rule (one task per prompt)** *(new)*
    10.8 **Agent reasoning log guidelines** *(new)*
11. Domain Knowledge + Policies
    11.1 CRO domain primer
    11.2 Company policies
    11.3 Pointer to examples
    11.4 **Code style + patterns (with examples)** *(new)*
    11.5 **Git workflow (branches, commits, PRs with examples)** *(new)*
12. Spec-Driven Workflow + Versioning
    12.1 Spec Kit integration
    12.2 Version bump rules
    12.3 Cross-doc synchronization
    12.4 Update process
    12.5 Context management + spec summarization (RAG/Context7)
    12.6 **Lifecycle states (Constitution R17)** *(new v1.2)*
    12.7 **Delta-based updates (Constitution R18)** *(new v1.2)*
    12.8 **Phase rollups (Constitution R19)** *(new v1.2)*
    12.9 **Impact analysis for cross-cutting changes (Constitution R20)** *(new v1.2)*
    12.10 **Traceability matrix (Constitution R21)** *(new v1.2)*
13. Success Metrics + Acceptance Criteria
14. Timeline + Resources
15. Risks + Mitigations
    15.1 Primary risk register
    15.2 **Lethal trifecta contingencies (speed × non-determinism × cost)** *(new)*
    15.3 **Fallback protocols** *(new — manual audit, model throttle, circuit breaker)*
16. Changelog
17. Appendix — Reference documents
18. **Appendix A — Mini-spec pattern for simple tasks** *(new)*
19. **Appendix B — Sample conformance test cases** *(new)*

---

## 2. Product Vision

### 2.1 Problem

Manual CRO (Conversion Rate Optimization) audits by senior consultants take **40-80 hours per site**. Agencies can't scale — expertise is the bottleneck. Existing automated tools (Lighthouse, Hotjar, Optimizely) produce checklist output, not consultant-grade findings with evidence and research-backed benchmarks. Clients pay $10K-$50K for CRO audits and wait 4-8 weeks for a report.

### 2.2 Thesis

Large language models can now read accessibility trees, evaluate structured page data against codified heuristics, and produce grounded findings — **when paired with a rigorous hallucination filter and research-backed benchmarks**. The human expert stays in the loop (every finding is a hypothesis, not a verdict), but their time-per-audit drops from 40+ hours to ~2 hours of review.

### 2.3 Users

| Tier | User | Description |
|---|---|---|
| Primary | **CRO Consultant (REO Digital internal)** | Senior consultant, 5+ years CRO experience, familiar with Baymard + Nielsen Norman research. Current workflow: manual audit → Figma/PPT report → client delivery (40-80 hrs). With Neural: trigger audit → review findings → PDF delivered (~2 hrs). |
| Secondary | **Client** (indirect) | Marketing director / growth lead at ecommerce or SaaS company. Pays REO Digital. Receives the branded PDF report. |
| Tertiary | **REO Digital leadership / investors** | See live demo + unit economics during fundraising. |

### 2.4 Success criteria

**Demo-readiness (Week 12):**
- Audit completes end-to-end on a real e-commerce site
- ≥ 10 grounded findings per audit
- ≥ 1 cross-page pattern detected per 10+ page audit
- 5-20% grounding rejection rate (proves hallucination filter works)
- ≤ 30% consultant-rejection rate (false positive proxy)
- Cost per page ≤ $0.50
- PDF render time < 30 seconds
- Repeat-audit finding overlap ≥ 90% (reproducibility)

**Commercial (first 90 days post-MVP):**
- 3 of 3 REO Digital consultants can run audits without engineering help
- ≥ 3 real client audits shipped
- Average consultant review time ≤ 2 hrs (vs 40 hrs manual)
- ≥ 95% system uptime during pilot

---

## 3. Scope

### 3.1 In-scope capabilities

The MVP ships a consultant-pilot-ready product with:

1. Audit trigger via CLI + Next.js consultant dashboard
2. Browser agent: Playwright, overlay dismissal, navigation, stabilization, screenshots, AX-tree perception (no stealth plugin in MVP — defer to v1.1)
3. Two perception layers: `PageStateModel` (browser action decisions) + `AnalyzePerception` (analysis engine, 14-section v2.3 enriched)
4. Three deterministic checks:
    a. Perception quality gate (Step 1b — skip junk pages pre-LLM)
    b. Structural signals baked into `page_analyze`
    c. 12 grounding rules post-LLM (10 active in MVP, GR-010/011 deferred)
5. Analysis pipeline: chain-of-thought `evaluate` → separate-persona `self_critique` → deterministic `ground` → `annotate_and_store`
6. 30 CRO heuristics LLM-drafted with human verification, each carrying quantitative or qualitative benchmarks AND a `provenance` block (source URL, citation, draft model, verifier, date) — engineering-owned in Phase 0b (not parallel CRO workstream); subset of the 100 in the master plan
7. Two-stage heuristic filter (business type → page type → max 20 per page)
8. Persona-based evaluation (2-3 personas per business type injected into evaluate prompt)
9. Cross-page pattern detection (deterministic; 3+ pages violating same heuristic → PatternFinding)
10. Finding outputs:
    a. Rich JSON in Postgres with full lifecycle (raw → reviewed → grounded / rejected)
    b. Annotated screenshots — Sharp pin overlay with severity colors + finding ID boxed over the element
11. Branded PDF report (Next.js HTML template → Playwright `page.pdf()`, R2-stored, < 5 MB)
12. Executive summary (overall score 0-100, grade A-F, top 5 findings, strengths, category breakdown, 3-5 recommended next steps)
13. Action plan (4 quadrants — effort × impact)
14. Consultant review workflow (approve / reject / edit findings before they reach the client)
15. Two-store pattern (internal findings table + published view) + warm-up mode (new clients → all findings held for first 3 audits until rejection rate < 25%)
16. 4-dimensional scoring (severity + confidence + business_impact + effort + priority)
17. Reproducibility snapshot per audit (temperature=0 + model version + prompt hashes + heuristic versions)
18. Email notifications on audit completion (Resend)
19. Token-level cost accounting (`llm_call_log` table, per-call actuals, per-client attribution)
20. Page discovery: sitemap.xml + manual URL list
21. Observability: Pino structured logging + `audit_events` table (22 event types) — no ops dashboard in MVP

### 3.2 Non-goals (explicit exclusions)

**Deferred to v1.1:**
- Stealth plugin + ghost-cursor + fingerprint rotation (default Playwright in MVP)
- AES-256-GCM heuristic encryption at rest (plain JSON in private repo for MVP)
- NavigationCrawlDiscovery (Sitemap + Manual only)
- Full 100 heuristics (30 in MVP)
- GPT-4o LLM failover (Claude only; retry on failure)
- Webhook notifications (email only)
- State exploration (§20) — default-state audits only; PDP audits lose ~30% hidden-content coverage

**Deferred to v1.2+:**
- Agent composition / interactive evaluate (§33) — the competitive moat, post-MVP
- Mobile viewport auditing (Phase 12)
- Full cross-page analysis (consistency + LLM funnel) — pattern only in MVP
- Operational admin dashboard (§34)
- Heuristic health metrics + alerting
- Golden test suite + offline mock mode
- Temporal durable orchestration

**Permanent non-goals:**
- **Conversion prediction.** GR-007 enforces — no "this will increase conversions by X%".
- **Auto-publish without consultant review.** Warm-up mode holds all findings.
- **Authenticated-site audits.** Public pages only.
- **GA4 / analytics integration.** Page content + structure only.
- **Multi-tenant self-serve SaaS.** Internal REO Digital deployment only.

---

## 4. Functional Requirements

### F-001 — Audit Contract (CLI + Dashboard)

Consultant triggers an audit via:
- **CLI:** `pnpm cro:audit --urls urls.txt --business-type ecommerce --output ./out`
- **Dashboard:** "New Audit" form submits via `GatewayService`

Accepts: root URL OR URL list, business type, page discovery strategy, max pages (default 20), audit budget (default $15).

**Acceptance:**
- CLI validates input, exits 0 on success, non-zero on failure
- Dashboard trigger persists `audit_requests` row + creates immutable `reproducibility_snapshots` row
- Live progress via SSE (22 event types) visible in dashboard
- Final summary printed: pages crawled, findings count, total cost, duration

### F-002 — Page Router (Orchestrator)

Advances the page queue; routes to browse or audit_complete based on budget + queue state.

**Acceptance:**
- Stage 1 heuristic filter (by business type) in `audit_setup`
- Stage 2 heuristic filter (by page type) in `page_router`
- Queue capped at 20 pages
- Audit terminates cleanly when budget exhausted

### F-003 — Browser Agent

Opens a Playwright Chromium session, navigates, dismisses overlays, waits for DOM stability, captures screenshots + AX-tree + filtered DOM (PageStateModel).

**Acceptance:**
- Successfully navigates to example.com, amazon.in, Shopify demo
- `OverlayDismisser` dismisses common cookie banners, modals, chat widgets (12 selector patterns)
- `MutationMonitor` detects DOM stability within 10s timeout
- Failed navigation logged but non-fatal — audit continues with remaining pages
- Rate limiter enforces 2s min interval, 10/min unknown domains, 30/min trusted
- Circuit breaker trips after 3 domain failures (1-hour block)

### F-004 — Browser Perception (PageStateModel)

Produces compact action-oriented perception for browser agent decisions.

**Acceptance:**
- `PageStateModel` captured per page
- Size < 1500 tokens (AX-tree + top 30 filtered elements)
- Includes: metadata, accessibilityTree, filteredDOM, interactiveGraph, visual?, diagnostics

### F-005 — Analysis Perception (AnalyzePerception — v2.3 enriched)

Single `page.evaluate()` call extracts 9 structured sections + 14 v2.3 enrichments for CRO analysis.

Baseline sections (v2.2a): metadata, headingHierarchy, landmarks, semanticHTML, textContent, ctas (with boundingBox + contrast), forms, trustSignals, layout, images, navigation, performance.

**v2.3 enrichments:**
- `metadata`: requestedUrl, metaDescription, canonical, lang, ogTags, schemaOrg
- `structure` (new): titleH1Match, titleH1Similarity
- `textContent`: valueProp (H1 + hero subheading + first paragraph), urgencyScarcityHits, riskReversalHits
- `ctas`: accessibleName, role, hoverStyles, focusStyles (via CSS pseudo-class matching)
- `forms.fields`: accessibleName, role
- `trustSignals`: subtype, source (3rd-party vs self-claimed), attribution, freshnessDate, pixelDistanceToNearestCta
- `iframes` (new): src, origin, isCrossOrigin, boundingBox, purposeGuess (Stripe / YouTube / maps / reCAPTCHA)
- `navigation`: footerNavItems
- `accessibility` (new): keyboardFocusOrder, skipLinks
- `performance`: INP, CLS, TTFB, timeToFirstCtaInteractable
- `inferredPageType` (new): primary + alternatives[] with confidence scores

**Acceptance:**
- All baseline + v2.3 fields populated on 3 test pages (checkout, PDP, homepage)
- Single `page.evaluate()` call (REQ-TOOL-PA-001) — no extra round-trips
- Zod validation passes on every extraction

### F-006 — Perception Quality Gate (Step 1b)

7 weighted signals score perception quality before LLM evaluation.

**Signals + weights:** has_meaningful_content (0.25), has_interactive_elements (0.20), has_navigation (0.10), has_heading_structure (0.10), no_overlay_detected (0.15), no_error_state (0.15), page_loaded (0.05).

**Routing:**
- Score ≥ 0.6 → proceed to evaluate normally
- Score 0.3-0.59 → partial analysis (Tier 1 quantitative only, skip LLM)
- Score < 0.3 → skip page, `analysis_status: "perception_insufficient"`, no LLM cost

### F-007 — LLM Evaluate (CoT + Benchmarks + Personas)

Chain-of-thought LLM call evaluating AnalyzePerception against filtered heuristics.

**Acceptance:**
- Heuristics injected in USER MESSAGE (never system prompt)
- Benchmark data injected alongside each heuristic
- 2-3 personas per business type injected into prompt
- Temperature = 0 (enforced by TemperatureGuard)
- Output Zod-validated to `RawFinding[]`
- Malformed output → single retry, then fail page with `analysis_status: "llm_failed"`

### F-008 — Self-Critique

Separate LLM call, different persona (senior quality reviewer), 5 checks per finding.

**Checks:**
1. Element exists in perception
2. Severity proportional to evidence
3. Logic coherent (observation → assessment → recommendation)
4. Context appropriate (no false universal)
5. No duplicate of earlier finding

**Verdicts:** KEEP / REVISE / DOWNGRADE / REJECT.

**Acceptance:** Temperature = 0. Different system prompt persona than evaluate. Reduces false positives by ~30% on test pages.

### F-009 — Evidence Grounding (12 Deterministic Rules)

Deterministic code runs 12 grounding rules on every reviewed finding. Any rule failure → rejection to `rejected_findings` table with rule_id + reason.

**Rules (10 active in MVP):**
- GR-001: Referenced element exists in AnalyzePerception
- GR-002: Fold position claim matches bounding box
- GR-003: Form field count claim matches data
- GR-004: Contrast claim matches computed styles
- GR-005: Heuristic ID valid
- GR-006: Critical/high severity requires measurement
- GR-007: No conversion predictions (absolute ban — banned phrases: "increase conversion", "boost revenue", "%lift", "ROI of N")
- GR-008: data_point references real AnalyzePerception section (dotted path resolves)
- GR-009: State provenance (trivially passes in MVP — no state exploration)
- GR-012: Benchmark claim validation (±20% for quantitative; reference text for qualitative)

**Deferred rules:** GR-010 (workflow cross-step, Phase 11), GR-011 (per-state composition, Phase 11).

### F-010 — 4-Dimensional Scoring + Finding Suppression

Deterministic (no LLM):
- Severity (from heuristic or critique downgrade)
- Confidence (tier × grounding × evidence)
- Business impact (IMPACT_MATRIX[pageType][funnelPosition])
- Effort (EFFORT_MAP[effort_category])
- Priority = `Math.round((severity*2 + impact*1.5 + confidence*1 - effort*0.5) * 100) / 100`

**Suppression:** confidence < 0.3 → reject; evidence empty → reject; exact duplicate → reject.

### F-011 — Annotate Screenshots

Sharp-based overlay: colored box at finding bounding box + numbered pin with finding_id. Severity colors: critical=red, high=orange, medium=yellow, low=blue. Overlap nudge for adjacent pins.

**Acceptance:**
- Annotated viewport JPEG rendered per page with findings
- Pin diameter 28px; box stroke-width 3px; outlines visible over any background
- PNG/JPEG stored in R2 at `/{client_id}/audit_runs/{run_id}/{page_slug}/viewport-annotated.jpg`

### F-012 — Heuristic Knowledge Base

30 heuristics drafted via **LLM-assisted authoring with human verification** in Phase 0b (engineering-owned, not parallel CRO workstream): ~15 Baymard + ~10 Nielsen + ~5 Cialdini. Drafting prompt injects research excerpts (Baymard URLs, Nielsen pages, Cialdini chapters); human verifier manually re-derives each benchmark from the cited source URL and confirms match within ±20% (quantitative) or text reference (qualitative) BEFORE commit. Every heuristic carries a `provenance` block (`source_url`, `citation_text`, `draft_model`, `verified_by`, `verified_date`) AND a required benchmark (quantitative or qualitative per v2.2 schema). JSON files in `heuristics-repo/` (plain JSON for MVP; AES encryption deferred to v1.1). R6 IP boundary applies regardless of author — LLM-drafted heuristic content is still IP-protected (Constitution R6.1-R6.4).

**Acceptance:**
- All 30 heuristics pass `HeuristicSchema` Zod validation at load (benchmark + `provenance` both required per Constitution R15.3)
- Per-heuristic verification evidence captured in PR Contract Proof block (PRD §10.9): `verified_by` name + manual re-derivation outcome
- Spot check: 5 random heuristics re-verified by a different human against the cited source URL; ≤ 1 may diverge (the diverging heuristic is rejected)
- 2-stage filter: `filterByBusinessType` (30 → ~20) then `filterByPageType` (~20 → 15-20)
- Heuristic content never appears in API / dashboard / logs / LangSmith traces (only `heuristic_id`)

### F-013 — Persona-Based Evaluation

2-3 personas per business type (e.g., ecommerce: first-time visitor, returning customer, price-sensitive shopper) injected into evaluate prompt. Each finding tagged with `persona: string | null`.

### F-014 — Cross-Page Pattern Detection

After all pages analyzed, deterministic `PatternDetector` groups `grounded_findings` by `heuristic_id`. 3+ pages violating same heuristic → one `PatternFinding` referencing all affected pages.

### F-015 — Reproducibility Snapshot

Gateway creates immutable snapshot before workflow start: SHA256 hashes of prompt templates, model name + version, heuristic set version + overlay chain hash, normalizer + grounding + scoring versions. DB trigger enforces immutability.

**Acceptance:** Same inputs → ≥ 90% finding overlap within 24 hrs.

### F-016 — Two-Store Pattern + Warm-up Mode

Internal findings table holds all findings; published view (`WHERE publish_status = 'published' AND published_at <= NOW()`) exposes only approved.

**Warm-up:** New clients → ALL findings held regardless of tier until `audits_completed ≥ 3 AND rejection_rate < 25%`.

**Enforcement:** Application layer queries view for client-facing APIs. DB layer enforces via RLS + `SET LOCAL app.access_mode` in transactions.

### F-017 — Executive Summary + Action Plan

Generated at `audit_complete`:
- **Executive Summary:** overall score (0-100), grade (A-F), top 5 findings, strengths (heuristics passing on ≥ 80% of pages), category breakdown, 3-5 recommended next steps (single LLM call, $0.10 cap)
- **Action Plan:** 4 quadrants — quick wins, strategic, incremental, deprioritized. Finding bucketing: high impact = `business_impact ≥ 6`; low effort = effort_hours ≤ 8.

### F-018 — Branded PDF Report

Next.js HTML template at `/api/report/[audit_run_id]/render` → Playwright `page.pdf()`. 8 sections:
1. Cover (client logo, date, grade badge)
2. Executive summary
3. Action plan (4 quadrants)
4. Findings by category
5. Cross-page patterns
6. Methodology note (3-layer filter explanation; "findings are hypotheses" disclaimer)
7. Appendix (full finding table + perception quality summary)
8. Reproducibility note (model version, temperature, heuristic version, run ID)

**Branding:** `ReportTemplate` config per client (logo_url, primary_color, secondary_color, company_name). Default: REO Digital / Neural.

**Storage:** R2 at `/{client_id}/reports/{audit_run_id}/report.pdf`. URL stored in `audit_runs.report_pdf_url`. Max 5 MB.

### F-019 — Consultant Review Workflow (Dashboard)

Next.js 15 + shadcn/ui + Tailwind + Clerk auth.

**Pages:**
- `/console/audits` — audit list, "New Audit" trigger form
- `/console/review` — held findings inbox, sorted by priority, approve/reject/edit
- `/console/review/[id]` — finding detail + annotated screenshot + evidence + edit form
- `/console/clients/[id]` — warm-up status + manual override

**Acceptance:** Consultant can trigger an audit, review held findings, approve/reject/edit, trigger report regeneration, watch email delivery.

### F-020 — Email Notifications

`NotificationAdapter` with `EmailNotificationAdapter` (Resend) implementation.

**Events:** `audit_completed`, `audit_failed`, `findings_ready_for_review`. Notification preferences per user.

### F-021 — Cost Accounting + Budget Gates

Every LLM call logs atomically to `llm_call_log` with model, tokens, cost, duration, cache_hit. Pre-call budget gate estimates from `getTokenCount()` before invoking; skips or splits batch if too expensive. Budget caps: $15 audit / $5 page. Per-client cost attribution via SQL join.

---

## 5. Non-Functional Requirements

### NF-001 — Performance

| Metric | Target |
|---|---|
| Time to first finding | < 60 seconds |
| 20-page audit total time | < 30 minutes |
| PDF render time | < 30 seconds |
| Memory per audit (Node process) | < 1 GB |
| Concurrent audits supported (MVP) | 1 (sequential) |

### NF-002 — Cost

| Metric | Target |
|---|---|
| Cost per page | ≤ $0.50 |
| Cost per 20-page audit | ≤ $12 |
| Cost per LLM call (evaluate) | < $0.20 |

### NF-003 — Quality

| Metric | Target |
|---|---|
| Self-critique rejection rate | ≥ 1 per audit |
| Evidence grounding rejection rate | 5-20% |
| Consultant rejection rate (FP proxy) | ≤ 30% |
| Repeat-audit finding overlap (24h) | ≥ 90% |
| Browse action verification rate | 100% |

### NF-004 — Reliability

| Metric | Target |
|---|---|
| Audit success rate (clean exit) | > 90% |
| Page-level failure tolerance | Audit continues after 1-2 page failures |
| Crash recovery | LangGraph Postgres checkpointer enables resume |
| System uptime during pilot | ≥ 95% |

### NF-005 — Security + IP

- Heuristic JSON in private `heuristics-repo/` (plain JSON in MVP — AES-256-GCM before first external pilot)
- Heuristic content redacted in LangSmith traces / logs / API / dashboard / PDF
- All secrets via `process.env.*`
- RLS on `findings`, `audit_runs`, `screenshots`
- `SET LOCAL app.client_id + app.access_mode` in every transaction
- Append-only tables (`audit_log`, `rejected_findings`, `finding_edits`, `llm_call_log`, `audit_events`) — never UPDATE/DELETE
- No PII captured in screenshots (public pages only; no form pre-filling)

### NF-006 — Reproducibility

- Temperature = 0 enforced at adapter boundary for `evaluate`, `self_critique`, `evaluate_interactive`
- Reproducibility snapshot created by gateway; immutable (DB trigger)
- Same inputs → ≥ 90% finding overlap within 24 hrs

### NF-007 — Observability

- Every log line: JSON (Pino) with mandatory correlation fields (audit_run_id, client_id, page_url, node_name, heuristic_id)
- 22 event types logged to `audit_events` table for SSE streaming + post-hoc analysis
- Per-LLM-call cost logged to `llm_call_log` atomically
- No `console.log` in production code

### NF-008 — Boundaries + Safety

- Rate limiter: 2s min interval, 10/min unknown domains, 30/min trusted
- Robots.txt respected
- Deterministic safety classifier (4 classes: safe / caution / sensitive / blocked)
- Sensitive actions (form submit, purchase, upload, download) → HITL required
- Circuit breaker: 3 domain failures → 1-hour block
- No conversion predictions (GR-007 enforces at runtime)

### NF-009 — Testing (see §9 for full strategy)

- Test-first (Constitution R3)
- Coverage: ≥ 90% on grounding, ≥ 80% on scoring, ≥ 70% on adapters, ≥ 60% on orchestration; overall ≥ 70% on `agent-core`
- Phase exit criteria per Spec Kit `tasks.md` (generated by CLI)
- 3 acceptance tests: example.com (3 pages), amazon.in (3 pages), Shopify demo (5 pages funnel)

### NF-010 — Operational

- Single-region Fly.io deployment (MVP)
- Daily Postgres backups
- Local Docker Compose for dev (Postgres 16 + pgvector)
- Node.js 22 LTS runtime

---

## 6. Architecture

**Canonical location:** [`docs/specs/mvp/architecture.md`](architecture.md)

This section was extracted on 2026-04-24 to separate architecture (how the system is built) from product requirements (what must be built) per good-spec review Option A. Subsection numbering (§6.1 Five-layer architecture, §6.2 Pipeline flow, §6.3 Data contracts, §6.4 Tech stack, §6.5 Project structure map) preserved in the sibling file so existing cross-references continue to resolve.

---

## 7. Component Breakdown

### 7.1 Backend — Browser Agent + Analysis Engine

**Location:** `packages/agent-core/src/browser-runtime/` + `packages/agent-core/src/perception/` + `packages/agent-core/src/mcp/` + `packages/agent-core/src/analysis/`

**Responsibility:**
- Browser lifecycle (BrowserManager, sessions)
- Perception extraction (PageStateModel + AnalyzePerception)
- 12 MCP tools (navigate, reload, wait, click, type, scroll, get_state, screenshot, page_analyze, find_by_text, extract, press_key, request_human)
- 5-step analysis pipeline (DeepPerceiveNode, quality_gate, EvaluateNode, SelfCritiqueNode, EvidenceGrounder, AnnotateNode, StoreNode)
- 12 grounding rules (GR-001 through GR-012, 10 active in MVP)
- Cross-page pattern detection
- Persona context + default personas
- 4-dimensional scoring pipeline

**Contracts:** `§06` browse-mode, `§07` analyze-mode, `§08` tool-manifest, `§09` heuristic-kb, `§20.10` GR-009, `§23` findings-engine-extended.

### 7.2 Backend — Orchestration + Gateway

**Location:** `packages/agent-core/src/orchestration/` + `packages/agent-core/src/gateway/` + `packages/agent-core/src/reproducibility/` + `packages/agent-core/src/storage/` + `packages/agent-core/src/review/`

**Responsibility:**
- AuditState (LangGraph Annotation)
- AuditGraph (orchestrates browse + analyze subgraphs)
- audit_setup, page_router, audit_complete, cross_page_analyze nodes
- AuditRequest Zod + validation + GatewayService
- DiscoveryStrategy adapter (Sitemap + Manual for MVP)
- Reproducibility snapshot builder + loader + TemperatureGuard
- Two-store access-mode middleware
- WarmupManager
- PostgreSQL checkpointer for crash recovery

**Contracts:** `§04` orchestration, `§05` unified-state, `§18` trigger-gateway, `§24` two-store-pattern, `§25` reproducibility.

### 7.3 Frontend — Consultant Dashboard

**Location:** `apps/dashboard/`

**Tech:** Next.js 15 App Router + shadcn/ui + Tailwind CSS + Clerk auth.

**Pages:**
- `/console/audits` — audit list + new audit trigger form
- `/console/review` — held findings inbox sorted by priority
- `/console/review/[id]` — finding detail + annotated screenshot + edit form (approve / reject / edit)
- `/console/clients/[id]` — warm-up status + manual override

**API routes:**
- `/api/report/[audit_run_id]/render` — HTML report template consumed by Playwright for PDF generation
- SSE endpoint for audit progress stream (22 event types)

**Contracts:** `§14` delivery-layer, `§35` report-generation.

### 7.4 Data — PostgreSQL schema + R2 storage

**Location:** `packages/agent-core/src/db/schema.ts` + `packages/agent-core/src/db/migrations/`

**Tables (MVP subset):**
- `clients`, `audit_runs`, `findings` (+ 12 extension columns), `screenshots` (metadata only), `sessions`, `audit_log` (append-only), `rejected_findings` (append-only), `reproducibility_snapshots` (with immutability trigger), `audit_requests`, `llm_call_log` (append-only), `audit_events` (append-only)
- `published_findings` VIEW filtered by status + published_at

**Deferred to v1.1:** `page_states`, `state_interactions`, `finding_rollups`, `templates`, `workflows`, `domain_patterns`, `finding_edits`.

**RLS:** on all client-scoped tables. `SET LOCAL app.client_id + app.access_mode` in every transaction.

**R2 layout:**
- `/{client_id}/audit_runs/{run_id}/{page_slug}/viewport.jpg`
- `/{client_id}/audit_runs/{run_id}/{page_slug}/viewport-annotated.jpg`
- `/{client_id}/audit_runs/{run_id}/{page_slug}/fullpage.jpg`
- `/{client_id}/reports/{run_id}/report.pdf`

**Contracts:** `§13` data-layer, `§24` two-store-pattern.

### 7.5 Integrations + Adapters

**Location:** `packages/agent-core/src/adapters/`

**Adapters (every external dep goes through one):**
- `LLMAdapter` + `AnthropicAdapter` (Claude Sonnet 4 only in MVP)
- `StorageAdapter` + `PostgresStorage` (Drizzle)
- `ScreenshotStorage` + `R2Storage` + `LocalDiskStorage`
- `BrowserEngine` (Playwright)
- `HeuristicLoader` (JSON files; AES wrapper deferred)
- `NotificationAdapter` + `EmailNotificationAdapter` (Resend)
- `DiscoveryStrategy` + `SitemapDiscovery` + `ManualDiscovery`
- `StreamEmitter` (SSE)
- `AuthProvider` (Clerk)

**Rule (Constitution R7, R9):** direct imports of Anthropic SDK / Playwright / pg / Drizzle outside adapter modules are FORBIDDEN.

---

## 8. Commands + Tooling

### 8.0 Quick command reference (sidebar cheat sheet)

For fast lookup. Full details in §8.1-8.7.

```
# Setup
pnpm install                    # workspace deps
docker-compose up -d            # Postgres 16 + pgvector
pnpm db:migrate                 # apply Drizzle migrations

# Dev loop (run before every commit)
pnpm lint                       # ESLint, zero warnings
pnpm typecheck                  # tsc --noEmit
pnpm test                       # Vitest unit

# Build
pnpm build                      # Turborepo all
pnpm dev                        # watch mode

# Run
pnpm cro:audit --urls ./urls.txt --business-type ecommerce
pnpm -F @neural/dashboard dev   # dashboard only

# Test variants
pnpm test:integration           # Playwright Test
pnpm test:coverage              # + coverage report
pnpm test:watch
pnpm test:conformance           # §9.6 per-component conformance suite

# Spec Kit workflow (after updating PRD.md)
specify version
/speckit.specify                # regenerate docs/specs/mvp/spec.md
/speckit.plan                   # regenerate docs/specs/mvp/plan.md
/speckit.tasks                  # regenerate docs/specs/mvp/tasks.md
/speckit.analyze                # cross-artifact consistency
```

**Before every commit:** `pnpm lint && pnpm typecheck && pnpm test` — all three green.

All commands run from repo root. Workspace: `pnpm` + Turborepo.

### 8.1 Install + env setup

```bash
pnpm install                                 # install all workspace deps
cp .env.example .env                         # fill in secrets after
docker-compose up -d                         # Postgres 16 + pgvector
pnpm db:migrate                              # Drizzle migrations
pnpm db:seed                                 # optional: demo client + heuristics
```

### 8.2 Build + dev

```bash
pnpm build                                   # Turborepo: build all
pnpm -F @neural/agent-core build             # single workspace
pnpm dev                                     # watch mode across apps
pnpm -F @neural/dashboard dev                # dashboard only
pnpm typecheck                               # tsc --noEmit
```

### 8.3 Test

```bash
pnpm test                                    # Vitest unit tests
pnpm test:unit                               # alias
pnpm test:integration                        # Playwright Test
pnpm test:watch
pnpm test:coverage
pnpm -F @neural/agent-core test              # single workspace
```

### 8.4 Lint + format

```bash
pnpm lint                                    # ESLint; zero warnings
pnpm lint:fix
pnpm format                                  # Prettier write
pnpm format:check                            # CI check
```

### 8.5 Database

```bash
pnpm db:migrate                              # apply pending migrations
pnpm db:migrate:generate                     # generate from schema diff
pnpm db:reset                                # drop + recreate + migrate (dev only)
pnpm db:studio                               # Drizzle Studio
```

### 8.6 Application entry points

```bash
pnpm cro:audit --urls ./urls.txt --business-type ecommerce --output ./out
pnpm cro:audit --url https://example.com --page-type homepage --business-type ecommerce
pnpm cro:audit --version
pnpm cro:audit --help
```

### 8.7 CI gates (blocks merge to main)

1. `pnpm lint` — zero warnings
2. `pnpm typecheck` — no TS errors
3. `pnpm test` — all Vitest green
4. `pnpm test:integration` — Playwright nightly on main
5. Coverage ≥ 70% on `packages/agent-core/src/analysis/grounding/` + `packages/agent-core/src/analysis/scoring/`

---

## 9. Testing Strategy

**Canonical location:** [`docs/specs/mvp/testing-strategy.md`](testing-strategy.md)

This section was extracted on 2026-04-24 to separate testing conventions from product requirements per good-spec review Option A. Subsection numbering (§9.1 Philosophy, §9.2 Stack, §9.3 Coverage targets, §9.4 Phase exit criteria, §9.5 Real-LLM policy, §9.6 Conformance test suite with matrix) preserved in the sibling file. Conformance templates in Appendix B remain in this PRD pending move to `docs/specs/mvp/templates/` (priority #7).

---

## 10. Claude Code Operational Boundaries

Three-tier guardrails for Claude Code (the implementation agent). Supplements Constitution R1-R16; when a Constitution rule conflicts with anything here, the Constitution wins.

### 10.1 ALWAYS

- Read the relevant spec before writing code (Constitution R11.1). Task-to-spec mapping in Spec Kit-generated `tasks.md`.
- Write the failing test first (R3.1).
- Validate every external boundary with Zod (R2.2) — LLM outputs, MCP I/O, API req/resp, DB writes, adapter returns.
- Use the adapter pattern for external dependencies (R7, R9).
- Reference task ID + REQ-ID in commit messages (R11.5).
- Commit small atomic changes — one task, one commit.
- Run `pnpm lint && pnpm typecheck && pnpm test` before every commit.
- Match tool names from canonical spec EXACTLY (`browser_get_state` not `page_snapshot`) — R4.5.
- Use multiplicative confidence decay — `current × 0.97` (R4.4).
- Cap filtered heuristics at 30 per page (§09.6).
- Enforce `temperature = 0` on evaluate / self_critique / evaluate_interactive via TemperatureGuard (R10).
- Every finding needs evidence — suppress if empty (R5.7).
- Log to Pino; never `console.log` (R10.6).

### 10.2 ASK FIRST

Stop and ask the user when:

- Two specs disagree (R1.4)
- A REQ-ID is missing for a non-trivial decision (R11.2)
- About to break a Constitution rule (R16)
- Crossing a layer boundary (analysis calling browser directly, or vice versa)
- Touching heuristic content (IP-protected per R6)
- Changing `AnalyzePerception` schema (ripples to §07.9, §08.4, grounding rules, evaluate prompt)
- Adding a new MCP tool (requires §08 update + safety classification + registry entry)
- Introducing a new external dependency (must go through an adapter)
- Bypassing safety classification
- Spec appears to have a defect — fix spec FIRST (R11.4)
- Test reveals the spec is wrong
- Tempted to use `any` or disable a test

### 10.3 NEVER

Absolute prohibitions. No exceptions without explicit user override in PR description.

- Never use `any` without `// TODO: type this` + tracking issue (R2.1, R13)
- Never disable a failing test (R3.3, R13)
- Never predict conversion impact (R5.3, R13, GR-007) — banned phrases: "increase conversion", "boost revenue", "%lift", "ROI of N"
- Never expose heuristic content in API / dashboard / logs / LangSmith traces (R6, R13)
- Never skip evidence grounding (R13)
- Never call Anthropic SDK / Playwright / pg / Drizzle directly outside adapter modules (R7.1, R13)
- Never use `console.log` in production (R10.6, R13)
- Never hardcode API keys or secrets (R13)
- Never mix browse-mode and analyze-mode logic in same file (R13)
- Never use Playwright APIs outside `BrowserEngine` (R13)
- Never commit raw LLM output without Zod validation
- Never set temperature > 0 on evaluate / self_critique / evaluate_interactive (R10)
- Never UPDATE or DELETE rows from append-only tables (R7.4)
- Never auto-publish findings during warm-up mode
- Never commit to main without `pnpm lint && pnpm typecheck && pnpm test`

### 10.4 Self-check protocol (after every task)

1. Re-read task acceptance criteria in Spec Kit `tasks.md`.
2. Run task smoke test — passes.
3. `pnpm typecheck` — clean.
4. `pnpm test` (affected workspace) — green.
5. `pnpm lint` — clean.
6. Verify files touched match task scope (no drive-by edits).
7. Commit: `<type>(<scope>): <TaskID> <description> (<REQ-ID>)`.
8. Any failure → STOP. Use `superpowers:systematic-debugging` skill.

### 10.5 Sub-agent dispatch policy

**Dispatch when:** independent tasks within a phase that don't share state; parallel research tasks; independent test scaffolding.

**Do NOT dispatch for:** tasks modifying shared schemas (AnalyzePerception, AuditState, Finding); tasks touching the same file; sequences where Task N depends on Task N-1's implementation details.

**Review after dispatch:** diff for forbidden patterns (`any`, `console.log`, direct external imports, hardcoded secrets, disabled tests); verify acceptance criteria met; run self-check protocol.

**Phase-level review gate:** after each phase, integration test run + phase acceptance test + manual review + human approval before next phase.

**Specialized agent recommendation (post-MVP):** when the codebase grows, consider spinning up specialized sub-agents by domain:
- **Browser layer agent** — owns `browser-runtime/`, `perception/`, `mcp/`, stealth, verification
- **Analysis engine agent** — owns `analysis/` (nodes, grounding, scoring, heuristics, personas, cross-page)
- **Orchestration agent** — owns `orchestration/`, `gateway/`, `reproducibility/`, `storage/`, `review/`
- **Delivery agent** — owns `delivery/` (reports, PDF) + `apps/dashboard/`
- **Infra agent** — owns `db/`, `adapters/`, `observability/`, CI

Each specialized agent receives a domain-scoped context bundle (the relevant sub-section of this PRD + relevant specs from `docs/specs/final-architecture/` + `examples.md` patterns for that domain). Do NOT hand a specialized agent unrelated context — keeps prompt focused + reduces cost + reduces confusion.

### 10.6 Agent self-verification against acceptance criteria

**Before declaring a task complete**, Claude Code MUST self-verify against the task's spec:

1. **Open the task** in Spec Kit `tasks.md` (or `tasks-v2.md` for canonical).
2. **Open the linked spec section** (via REQ-ID) in `docs/specs/final-architecture/`.
3. **Enumerate every acceptance criterion** bullet in the task. List them explicitly in the PR description or commit message.
4. **For each criterion, state:**
   - ✅ Met — what the implementation does to satisfy it (point to file + line)
   - ❌ Not met — what's missing, with rationale
   - 🟡 Partial — what's in, what's out, with rationale
5. **If any criterion is ❌ or 🟡, do NOT declare the task complete.** Either implement the missing piece, or escalate to the user with an explicit question (ASK FIRST — §10.2).
6. **Run the conformance suite** `pnpm test:conformance -- <affected-component>` (§9.6) in addition to the task's smoke test + `pnpm test`. Attach the output to the PR.
7. **List any unaddressed requirements** from the spec that are related but not claimed to be addressed. Flag them explicitly: "NOT covered by this PR: X, Y, Z — tracked in <issue/task-id>."
8. **Gap-list rule:** the commit message or PR body MUST include a "Spec coverage" section. Example:

   ```
   Spec coverage for T117 (DeepPerceiveNode):

   ✅ REQ-ANALYZE-NODE-001: single page.evaluate() → AnalyzePerception populated
     - packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts:45-78
   ✅ REQ-ANALYZE-NODE-001 (v2.3): 14 enrichment fields populated
     - Verified by conformance test: tests/conformance/deep-perceive-v23.test.ts
   ✅ Page type auto-detection: detectPageType() returns ranked list with confidence
   🟡 Per-state screenshot capture (REQ-ANALYZE-NODE-001a-d): Phase 10+ — out of scope for this task; scaffolded only

   Not covered by this PR (tracked elsewhere):
   - Integration with cross_page_analyze node → T222
   - Quality gate routing → T233
   ```

**Enforcement:** Reviewer (human or subagent-reviewer) checks the Spec coverage section. Missing section → PR blocked until added.

### 10.7 Modular prompt rule — one task per prompt

Every Claude Code prompt SHALL be scoped to exactly one atomic unit of work:

- **One task from `tasks.md`** (Spec Kit-generated) OR
- **One bug fix targeting one file** OR
- **One refactor with a defined before/after contract** OR
- **One research question with a bounded scope**

**Do NOT:**
- Combine multiple tasks into a single prompt ("implement T117 and T118 and T120")
- Include unrelated context ("here's the whole PRD, now implement GR-001")
- Ask the agent to make architectural decisions mid-implementation — those belong in brainstorming sessions

**DO:**
- Provide the single target task
- Provide ONLY the spec section(s) referenced by that task's REQ-IDs (use the file-structure map in §6.5 to find them)
- Provide the relevant `examples.md` section if the task involves a pattern with known good/bad examples (grounding rules, findings, heuristic authoring)
- Provide the constitution (it's short — always include)
- Provide this PRD §10 (Claude Code Operational Boundaries) — short reference

**Context budget target:** aim for < 20K tokens of context per task prompt. If you find yourself pasting > 30K tokens, the task is probably too big — split it.

**Exception:** Phase-level review (after a batch of related tasks) can have broader context because its purpose IS cross-task integration verification.

### 10.8 Agent reasoning log guidelines

Claude Code SHOULD log its reasoning at key decision points so developers can inspect for misalignment. Goals: debuggability + trust + audit trail for non-deterministic LLM reasoning.

**What the agent logs (in commit messages, PR descriptions, or inline code comments):**

1. **Interpretation of task:** 1-2 sentences stating what the agent understood the task to require. Developer reads this first to catch misalignment early.
   ```
   // Task T117 interpretation: Implement the deep_perceive analysis node
   // that calls page_analyze and populates analyze_perception in state.
   ```

2. **Spec references used:** exact REQ-IDs and spec files consulted.
   ```
   // Specs consulted:
   //   - REQ-ANALYZE-NODE-001 (docs/specs/final-architecture/07-analyze-mode.md §7.4)
   //   - REQ-ANALYZE-PERCEPTION-V23-001 (same file §7.9.1)
   ```

3. **Key decisions + rationale** for non-obvious choices:
   ```
   // Chose Zod discriminated union over generic object for benchmark field
   // because REQ-HK-BENCHMARK-002 mandates type-safe quantitative/qualitative split.
   ```

4. **Alternatives considered + rejected:**
   ```
   // Considered: calling browser_get_state alongside page_analyze for AX-tree merge.
   // Rejected: violates REQ-TOOL-PA-001 single-call invariant;
   // instead, AX-tree merge happens inside page_analyze's page.evaluate().
   ```

5. **Assumptions** (flagged for developer review):
   ```
   // ASSUMPTION: page_analyze returns non-null on all 3 fixture pages.
   // If this fails on real sites, quality_gate (§7.10) routes to skip.
   ```

6. **Deviations from spec** (must ASK FIRST per §10.2; if proceeding after approval, log why):
   ```
   // DEVIATION from §7.4 code sample: used async/await instead of .then()
   // chain for readability. Behavior identical.
   ```

**What the agent does NOT log:**
- Full chain-of-thought narrations (too noisy)
- Every tool call (that's what LangSmith is for)
- Heuristic content (IP protection — R6)
- Secrets, API keys, PII

**Where logs go:**
- Commit messages: short interpretation (1-2 sentences) + spec references
- PR descriptions: full reasoning log (interpretation + decisions + alternatives + assumptions + deviations + Spec Coverage §10.6)
- Inline code comments: non-obvious decisions with `// REQ-<ID>: <rationale>`
- Never log to stdout in production; no `console.log` (R10.6)

**Developer inspection rule:** When a task's output seems wrong, read the PR description's reasoning log FIRST. Misalignment is usually visible in the "interpretation" sentence.

### 10.9 PR Contract (per code-review-ai research)

Every PR body SHALL include a 4-block PR Contract header BEFORE the §10.6 Spec coverage section:

```
## PR Contract
1. **What / Why** (1-2 sentences): <change + motivation>
2. **Proof** (concrete): <passing test file:line OR screenshot OR log excerpt OR conformance suite output>
3. **Risk tier + AI involvement**: <low / medium / high> + <which files/functions were AI-generated vs human-written>
4. **Review focus**: <3-5 bullets telling reviewer where to look first>
```

**Rationale:** §10.6 Spec coverage tells the reviewer WHAT was built; PR Contract tells the reviewer HOW to review efficiently. Combined, they cut review time and catch AI-specific failure modes (hallucinated imports, plausible-but-wrong logic, missed security implications).

**Risk-tier definitions:**

- **Low** — no shared-contract changes, no auth/payments/secrets/untrusted-input touches, no LLM prompt edits. Examples: typo fixes, internal refactors, isolated test additions.
- **Medium** — single shared-contract touch, single-module LLM prompt edit, new grounding rule implementation. Reviewer verifies impact beyond the diff.
- **High** — touches auth, payments, secrets, RLS policies, untrusted input handling, GR-007 conversion-prediction logic, reproducibility snapshot fields, or any append-only table schema (R7.4). Requires a human threat model walkthrough BEFORE merge, not at-merge.

**Enforcement:** CI check blocks any PR whose body lacks "## PR Contract" heading. Additive to the §10.6 Spec coverage check; neither substitutes for the other.

**Source:** `docs/engineering-practices/ai-orchestration-research-2026-04-24.md` Part 1 §3 (code-review-ai).

### 10.10 Comprehension-debt pacing (per cognitive-parallel-agents research)

When dispatching parallel subagents per §10.5, gate parallelization on **review capacity**, not on task independence alone.

**Guidelines:**

- Start with ONE fewer subagent than feels comfortable. Calibrate UP only after reviewing successive parallel batches without quality regression.
- 3–5 parallel subagents is the realistic ceiling for most humans (research-cited working-memory + vigilance limit).
- Time-box parallel-dispatch review rounds to ≤ 30 minutes before integrating, committing, and resetting context.
- Monitor "ambient anxiety" as a capacity signal — if you're mentally juggling more work than you're reviewing, reduce SCOPE per agent BEFORE reducing AGENT COUNT. Scope reduction lowers per-thread overhead more than count reduction.
- Trust calibration is per-thread, not per-agent: a subagent reliable on `grounding/` may be unreliable on `browser-runtime/`. Do not carry trust across domains.

**Signals that pacing is wrong (stop and calibrate):**

- Review time per diff > implementation time (agents outpacing review) → reduce count or scope
- Same review-comment category repeats across agents (e.g., missing error handling on 3 of 3 diffs) → add to CLAUDE.md or skill instructions BEFORE dispatching more
- Test coverage regresses during parallel work → suspend parallel dispatch until regressions are root-caused

**Source:** `docs/engineering-practices/ai-orchestration-research-2026-04-24.md` Part 1 §6 (cognitive-parallel-agents).

**Cross-ref:** CLAUDE.md §9 (sub-agent dispatch policy — operational companion); `.claude/skills/neural-dev-workflow/` (full playbook with pacing checklists).

---

## 11. Domain Knowledge + Policies

### 11.1 CRO domain primer (brief — full samples in `examples.md`)

- **CRO = Conversion Rate Optimization.** The discipline of improving the percentage of site visitors who take a desired action (purchase, signup, lead).
- **Heuristics = codified best practices** from research: Baymard Institute (ecommerce UX), Nielsen Norman Group (usability), Cialdini (persuasion principles).
- **Tiers 1/2/3** reliability classification:
  - Tier 1 (~42 of 100): visual/structural, > 75% reliable (e.g., form field count, contrast ratio, fold position)
  - Tier 2 (~42 of 100): content/persuasion, ~ 60% (e.g., CTA copy strength, trust signal quality)
  - Tier 3 (~16 of 100): interaction/emotional, < 40% (requires consultant review always)
- **Benchmarks:** every heuristic carries a quantitative or qualitative benchmark with a research source.

### 11.2 Company-specific policies (REO Digital)

- **No conversion predictions ever.** GR-007 enforces. Applies to findings, executive summary, action plan, PDF. Even hypothetical "could increase" is banned.
- **No auto-publish during warm-up.** First 3 audits per client: ALL findings held for consultant review regardless of tier.
- **Heuristic content is IP.** Never in API / dashboard / logs / LangSmith / shared outside team. AES encryption before v1.1 external pilot.
- **Every finding is a HYPOTHESIS.** This language appears in CLI output, dashboard, PDF methodology section. Never phrased as "verdict" or "fact".
- **Reproducibility is non-negotiable.** temperature=0 on analysis LLM calls. Snapshot every audit. ≥ 90% finding overlap in 24 hrs.
- **Cost transparency per client.** Every LLM call logged; per-client SQL attribution queryable.
- **Consultant owns the deliverable.** Neural produces hypothesis findings + annotated screenshots + draft report. Consultant approves, edits, rejects, and delivers to client. Neural does NOT ship reports directly to clients without consultant review.
- **Audit public pages only.** No authenticated / logged-in audits. Credentials explicitly out of scope.

### 11.3 Pointer to examples

Full sample inputs, sample outputs (grounded Finding, rejected Finding, PatternFinding, cost summary, PDF structure), writing style (GOOD vs BAD findings), 25 Claude Code pitfalls, heuristic authoring examples, worked task-flow example: see `docs/specs/mvp/examples.md`.

### 11.4 Code style + patterns

**Canonical location:** [`docs/engineering-practices/code-style.md`](../../engineering-practices/code-style.md)

This content was extracted from PRD §11.4 on 2026-04-24 to separate engineering conventions from product requirements (good-spec review finding #6). The PRD now points to the engineering-practice doc; that file is the source of truth for naming conventions, file organization, TypeScript patterns, error handling, adapter usage, and logging requirements.

Governing Constitution rules remain: R10 (Code Quality), R2 (Type Safety), R7 + R9 (Adapter Pattern), R13 (Forbidden Patterns).

### 11.5 Git workflow

**Canonical location:** [`docs/engineering-practices/git-workflow.md`](../../engineering-practices/git-workflow.md)

This content was extracted from PRD §11.5 on 2026-04-24 to separate engineering conventions from product requirements (good-spec review finding #6). The PRD now points to the engineering-practice doc; that file is the source of truth for branch naming, commit message template, pre-commit checklist, PR policy, and branching model.

Governing Constitution rules remain: R11.5 (commit message format). PR body still requires PRD §10.6 Spec coverage + §10.9 PR Contract.

<!-- deleted-content-begin: PRD §11.4 + §11.5 prior inline content
The following subsections moved to docs/engineering-practices/:
- 11.4.1 Naming conventions → code-style.md §1
- 11.4.2 File organization → code-style.md §2
- 11.4.3 TypeScript patterns → code-style.md §3
- 11.4.4 Error handling → code-style.md §4
- 11.4.5 Adapter pattern → code-style.md §5
- 11.4.6 Logging → code-style.md §6
- 11.5.1 Branch naming → git-workflow.md §1
- 11.5.2 Commit message template → git-workflow.md §2
- 11.5.3 Pre-commit checklist → git-workflow.md §3
- 11.5.4 Pull request policy → git-workflow.md §4
- 11.5.5 Branching model → git-workflow.md §5
deleted-content-end -->

---


## 12. Spec-Driven Workflow + Versioning

**Canonical location:** [`docs/specs/mvp/spec-driven-workflow.md`](spec-driven-workflow.md)

This section was extracted on 2026-04-24 to separate workflow meta from product requirements per good-spec review Option A. Subsection numbering (§12.1 Spec Kit integration, §12.2 Version bump rules, §12.3 Cross-doc sync, §12.4 Update process, §12.5 Context management, §12.6 Lifecycle states, §12.7 Delta updates, §12.8 Phase rollups, §12.9 Impact analysis, §12.10 Traceability matrix) preserved in the sibling file. Constitution R17-R21 rules remain in `constitution.md`; this sibling operationalizes them.

---

## 13. Success Metrics + Acceptance Criteria

### 13.1 Metrics (cross-reference to §2.4)

See §2.4 Success criteria — same targets.

### 13.2 Acceptance criteria (ship/no-ship)

MVP ships when ALL of the following are true:

**Functional:**
- [ ] Consultant triggers audit via dashboard → audit completes → PDF emailed
- [ ] 3 acceptance tests pass (example.com, amazon.in, Shopify demo)
- [ ] 1 real client audit shipped without engineering intervention
- [ ] Cross-page pattern detection produces ≥ 1 pattern on a 10+ page audit
- [ ] Consultant review workflow (approve/reject/edit) persists + respects two-store

**Quality:**
- [ ] ≥ 90% finding overlap on repeat audit (same URL, < 24 hrs)
- [ ] Grounding rejects 5-20% of raw findings
- [ ] ≤ 30% consultant rejection rate
- [ ] No Tier 1 heuristic produces all false positives across 3 demo audits

**Cost + Performance:**
- [ ] Cost per page ≤ $0.50 on real audits
- [ ] 20-page audit completes in ≤ 30 minutes
- [ ] PDF renders in ≤ 30 seconds

**Operational:**
- [ ] Structured logs (Pino JSON) for every audit
- [ ] `llm_call_log` populated for every LLM call
- [ ] `audit_events` records all 22 event types
- [ ] Reproducibility snapshot immutable per audit

**Security / Compliance:**
- [ ] Clerk auth gates dashboard
- [ ] RLS active on `findings` + `audit_runs`
- [ ] Heuristic content never in API / dashboard / PDF / logs
- [ ] No conversion prediction strings in any finding (GR-007 passes)

---

## 14. Timeline + Resources

| Week | Milestone | Engineering | Heuristic authoring (Phase 0b — LLM-assisted, engineering-owned per F-012 v1.2 amendment) |
|---|---|---|---|
| 0 (days 1-3) | Setup + CLI skeleton | Monorepo, Docker, Postgres, env | (Day 1) Heuristic authoring kickoff |
| 1 | Browser perception foundation | PageStateModel on 3 real sites | Top 15 heuristics drafted |
| 2 | 12 MCP tools | Tool-by-tool on amazon.in | Top 15 benchmarks added |
| 3 | Verification + safety + infra start | 3 verify strategies + Postgres + adapters | 22 heuristics drafted |
| 4 | Safety + cost + logging | `llm_call_log`, `audit_events`, Pino | **All 30 heuristics validated + committed** |
| 5 | ★ Browse MVP — 3 real sites end-to-end | — |
| 6 | Heuristic KB engine | 2-stage filter + personas loadable | — |
| 7 | Analysis pipeline (quality gate, evaluate, self-critique) | — | — |
| 8 | ★ MVP AUDIT — CLI end-to-end + cross-page pattern | — |
| 9 | Foundations (gateway, snapshot, scoring, two-store, warm-up) | Dashboard skeleton + Clerk | — |
| 10 | Dashboard (review inbox + finding detail) | — | — |
| 11 | PDF report generation + email | — | — |
| 12 | ★★★ INVESTOR DEMO READY | Integration + polish + demo rehearsal | — |

**Resources:**
- 1 Engineering lead (TypeScript, LangGraph, Playwright) — full-time 12 weeks
- 1 Frontend engineer (Next.js 15, shadcn/ui) — full-time Weeks 9-12
- 1 CRO specialist — full-time Weeks 1-4, then 20%
- 20% Product / demo owner throughout

**Infra cost:** ~$160/mo + Claude usage (~$10/audit for testing).

---

## 15. Risks + Mitigations

**Canonical location:** [`docs/specs/mvp/risks.md`](risks.md)

This section was extracted on 2026-04-24 to separate operational risk + incident playbooks from product requirements per good-spec review Option A. Subsection numbering (§15.1 Primary risk register, §15.2 Lethal trifecta contingencies — non-determinism / cost-spike / speed-vs-quality, §15.3 Fallback protocols — manual audit / model-throttle / circuit breaker / human override) preserved in the sibling file. Read at incident triage time, not for every task.

---

## 16. Changelog

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-04-22 | Claude + REO Digital | Canonical PRD consolidating prior session work (PRD-mvp-v1.md, mvp-plan-v1.md, tasks-mvp-v1.md) into one Spec-Kit-ready document. Superseded April 7 Walking Skeleton `spec.md` (archived). Incorporates master plan v2.3 (14 AnalyzePerception enrichments). Follows the 7-rule PRD template (vision, 6 core areas, modular components, 3-tier boundaries, domain knowledge, spec-driven workflow, continuous testing). |
| 1.1 | 2026-04-22 | Claude + REO Digital | Enhanced per Addy Osmani "good spec" gap analysis (11 improvements): added §6.5 project structure map, §8.0 quick command reference, §9.6 conformance test suite, §10.6 agent self-verification protocol, §10.7 modular prompt rule, §10.8 agent reasoning log guidelines, §11.4 code style with code examples, §11.5 git workflow with concrete commit + branch examples, §12.5 context management + spec summarization (RAG/Context7), §15.2 lethal trifecta contingencies (determinism × cost × speed), §15.3 fallback protocols (manual audit, model throttle, circuit breaker, human override), Appendix A mini-spec pattern for simple tasks, Appendix B sample conformance test cases. |
| 1.2 | 2026-04-22 | Claude + REO Digital | Added Constitution rules R17-R21 (Lifecycle States, Delta-Based Updates, Rollup per Phase, Impact Analysis Before Change, Traceability Matrix). Added PRD §12.6-12.10 covering these. Created `docs/specs/mvp/templates/` with 5 templates (frontmatter, impact, phase-rollup, system-current, spec-to-code-matrix). Created `docs/specs/mvp/scripts/` with 6 script stubs (matrix, rollup, size, validate, index, pack). Created `docs/specs/mvp/phases/` folder with INDEX + phase-0-setup example. Opening principle added to Constitution: "This Constitution is a control system, not documentation." Delta: new lifecycle/delta/rollup/impact/matrix infrastructure; changed PRD TOC + §12; impacted CLAUDE.md (reading rules); unchanged F-001 to F-021 + NF-001 to NF-010 + §6.4 tech stack. |

---

## 17. Appendix — Reference Documents

Read these on demand (linked for Spec Kit CLI context):

| Document | Path | Purpose |
|---|---|---|
| This PRD | `docs/specs/mvp/PRD.md` | Canonical product spec (input to Spec Kit CLI) |
| Constitution | `docs/specs/mvp/constitution.md` | 16 non-negotiable engineering rules (R1-R16) |
| Examples + pitfalls + style | `docs/specs/mvp/examples.md` | Sample AuditRequest, GroundedFinding, PatternFinding, PDF structure, 25 pitfalls, worked task flow |
| Master task catalog | `docs/specs/mvp/tasks-v2.md` | 263-task v2.3 master plan (canonical task source) |
| Master architecture specs | `docs/specs/final-architecture/§01-§36 + §33a` | 38 source-of-truth specs — authoritative for all REQ-IDs |
| Browser agent canonical | `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` | Source of truth for browse mode |
| Analysis agent canonical | `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` | Source of truth for analyze mode |
| Project brief | `docs/PROJECT_BRIEF.md` | 28-section cross-LLM brief (v2.3) |
| Architecture checklist | `docs/master-architecture-checklist.md` | 20-section coverage verification |
| Claude Code entry point | `CLAUDE.md` | Repo root; operational reference for Claude Code |
| Archived walking-skeleton spec | `docs/specs/mvp/archive/2026-04-07-walking-skeleton/` | Historical; superseded |

**Spec Kit CLI input — copy the whole file to `/speckit.specify` prompt, OR reference it via file path per Spec Kit v0.7.4 conventions.**

---

---

## 18. Appendix A — Mini-Spec Pattern for Simple Tasks

Not every task needs this full PRD. For small, bounded work — a utility function, a single regex, a new field on a Zod schema, a CLI flag addition — use a mini-spec inline in the code or a short issue description. A mini-spec has 4 mandatory elements:

### 18.1 Mini-spec template

```markdown
TASK: <single imperative sentence>
CONTEXT: <1-3 sentences on why this matters + where it plugs in>
ACCEPTANCE: <1-3 concrete, testable criteria>
REFERENCES: <REQ-ID or spec file path; if none, state "no spec — mini-spec authorizes">
```

### 18.2 Example — inline mini-spec as TODO comment

```typescript
// MINI-SPEC:
// TASK: Parse --pages CLI flag into a number with bounds 1-20.
// CONTEXT: The CLI accepts audit options (F-001); `max_pages` caps the queue.
// ACCEPTANCE:
//   - `--pages 5` → 5
//   - `--pages 0` or `--pages 21` → throw with helpful error citing bounds
//   - `--pages abc` → throw "must be an integer"
//   - No flag given → default 20
// REFERENCES: F-001, §18.4 AuditRequest
function parsePagesFlag(raw: string | undefined): number {
  if (raw === undefined) return 20;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error("--pages must be an integer");
  if (n < 1 || n > 20) throw new Error("--pages must be between 1 and 20");
  return n;
}
```

### 18.3 Example — mini-spec as short GitHub issue

```
Title: Add `prefer-const` rule to ESLint config

TASK: Extend ESLint config to enforce `prefer-const`.
CONTEXT: Several reviewers noted inconsistent `let` usage where `const` would suffice.
ACCEPTANCE:
  - `.eslintrc.cjs` contains `"prefer-const": "error"`
  - `pnpm lint` catches all current violations; PR fixes them
REFERENCES: no spec — mini-spec authorizes per §11.4 style guide intent

Effort: ~15 minutes.
```

### 18.4 When a mini-spec is sufficient

A mini-spec suffices when ALL of these are true:

- Task fits in a single file (or a single very small file pair — impl + test)
- < 50 lines of code change
- No new architecture / new adapter / new external dependency
- No cross-module ripple
- No spec requires updating
- Estimated < 2 hours of work

When any of the above is false → STOP and write a proper design spec (`superpowers:brainstorming` skill) + `tasks.md` entry. Mini-specs are for trivial work, not "trivial-seeming-but-actually-load-bearing" work.

### 18.5 Enforcement

- Tasks with a mini-spec must still pass pre-commit checklist (§11.5.3) — lint + typecheck + test
- Commit message cites the mini-spec location: `chore(lint): enforce prefer-const (mini-spec: issue #42)`
- If mid-work the task exceeds mini-spec limits (§18.4), STOP and promote to a proper task

---

## 19. Appendix B — Sample Conformance Test Cases

**Canonical location:** [`docs/specs/mvp/templates/conformance-test-templates.md`](templates/conformance-test-templates.md)

This appendix was extracted on 2026-04-24 to the `templates/` directory so copy-paste scaffolds live alongside other templates (frontmatter-lifecycle, impact, phase-rollup, spec-to-code-matrix). Contains TypeScript templates for: grounding rule conformance (GR-007 example), temperature guard (R10), 2-stage heuristic filter, append-only tables (R7.4), reproducibility (§25, nightly-only, real-LLM). Plus §19.6 "How to add a new conformance test" workflow.

The conformance matrix itself lives in [`docs/specs/mvp/testing-strategy.md`](testing-strategy.md) §9.6; templates implement matrix rows.

---

*End of PRD v1.2. Approved 2026-04-22; updated 2026-04-24 (R17 frontmatter + R22-R23 + §10.9-§10.10 + extractions per good-spec review). Source of truth: `docs/specs/final-architecture/§01-§36 + §33a` (master plan v2.3). Every claim traces to a REQ-ID in the spec corpus. Ready for Spec Kit CLI.*
