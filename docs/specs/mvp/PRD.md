# Neural MVP — Product Requirements Document

> **Product:** Neural — AI CRO Audit Platform
> **Company:** REO Digital (Indian digital agency)
> **Version:** 1.2 (2026-04-22) — adds Constitution R17-R21 (lifecycle, delta, rollup, impact, traceability) + phases/ folder structure + templates/ + scripts/ per scalable SDD framework (see §16)
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
6. 30 CRO heuristics authored with quantitative or qualitative benchmarks (subset of the 100 in the master plan)
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

30 heuristics authored by CRO team in parallel Phase 0b: ~15 Baymard + ~10 Nielsen + ~5 Cialdini. Every heuristic has a required benchmark (quantitative or qualitative per v2.2 schema). JSON files in `heuristics-repo/` (plain JSON for MVP; AES encryption deferred to v1.1).

**Acceptance:**
- All 30 heuristics pass `HeuristicSchema` Zod validation at load
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

### 6.1 Five-layer architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  Layer 5 — DELIVERY                                               │
│    CLI (`pnpm cro:audit`) + Consultant Dashboard (Next.js 15 +    │
│    shadcn/ui + Clerk) + PDF (Playwright page.pdf) + Email (Resend)│
├───────────────────────────────────────────────────────────────────┤
│  Layer 4 — DATA                                                   │
│    PostgreSQL 16 + pgvector (clients, audit_runs, findings,       │
│    screenshots, reproducibility_snapshots, llm_call_log,          │
│    audit_events) + R2 (screenshots, PDFs) + heuristics-repo       │
├───────────────────────────────────────────────────────────────────┤
│  Layer 3 — ANALYSIS ENGINE                                        │
│    deep_perceive → quality_gate → evaluate → self_critique →      │
│    ground (12 rules) → annotate_and_store → cross_page_analyze    │
├───────────────────────────────────────────────────────────────────┤
│  Layer 2 — BROWSER AGENT                                          │
│    BrowserManager + MutationMonitor + OverlayDismisser +          │
│    ScreenshotExtractor + AccessibilityExtractor + HardFilter +    │
│    SoftFilter + ContextAssembler → PageStateModel. 12 MCP tools.  │
│    RateLimiter + CircuitBreaker.                                  │
├───────────────────────────────────────────────────────────────────┤
│  Layer 1 — ORCHESTRATION                                          │
│    AuditRequest + GatewayService + AuditState (LangGraph.js) +    │
│    audit_setup + page_router + audit_complete +                   │
│    cross_page_analyze + WarmupManager + 4D ScoringPipeline +      │
│    ReproducibilitySnapshot + TemperatureGuard                     │
└───────────────────────────────────────────────────────────────────┘
```

### 6.2 Pipeline flow

```
Trigger → AuditRequest (Zod) → GatewayService → audit_setup → page_router
  → browse subgraph (navigate + dismiss + stabilize + capture)
  → deep_perceive (page_analyze → AnalyzePerception v2.3)
  → quality_gate (skip / partial / proceed)
  → evaluate (Claude Sonnet 4, temp=0, heuristics + benchmarks + personas)
  → self_critique (separate LLM, different persona, 5 checks)
  → ground (12 deterministic rules)
  → score (4D) + suppress
  → annotate + store (R2 + Postgres)
  → emit PageSignals → accumulator
  → back to page_router (loop)
  → (queue empty) → cross_page_analyze (pattern detection, deterministic)
  → audit_complete (exec summary + action plan + PDF + email)
  → consultant review (approve/reject/edit in dashboard)
  → published store (client-visible)
```

### 6.3 Data contracts (full Zod schemas in `docs/specs/final-architecture/`)

- `AuditRequest` — trigger payload (see `§18 trigger-gateway.md`)
- `AuditState` — LangGraph Annotation, all fields (see `§05 unified-state.md`)
- `PageStateModel` — browser perception (see `§06 browse-mode.md`)
- `AnalyzePerception` — v2.3 enriched analysis perception (see `§07.9` + `§07.9.1`)
- `Heuristic` — with required benchmark (see `§09 heuristic-kb.md`)
- `Finding` lifecycle — Raw → Reviewed → Grounded / Rejected (see `§07` + `§23`)
- `PatternFinding` — cross-page (see design doc `§1.2`)
- `PersonaContext` — personas (see design doc `§1.2`)
- `ReproducibilitySnapshot` — immutable (see `§25`)
- `LLMCallRecord` — per-call logging (see `§11.7`)
- `AuditEvent` — 22 event types (see `§34.4`)
- `ExecutiveSummary` / `ActionPlan` — (see `§35`)

### 6.4 Tech stack (precise names + versions)

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 22 LTS |
| Monorepo | Turborepo + pnpm | Turborepo 2.x, pnpm 9.x |
| Validation | Zod | 3.x |
| Browser | Playwright | latest (default; stealth plugin deferred to v1.1) |
| Orchestration | LangGraph.js | latest |
| MCP | `@modelcontextprotocol/sdk` | latest |
| Primary LLM | Claude Sonnet 4 via `@anthropic-ai/sdk` | `claude-sonnet-4-20260301` |
| Fallback LLM | (Deferred to v1.2) GPT-4o | — |
| Database | PostgreSQL + pgvector | Postgres 16, pgvector latest |
| ORM | Drizzle | latest |
| Cache / Queue | Redis (Upstash in prod) + BullMQ | latest |
| API framework | Hono | 4.x |
| Frontend | Next.js App Router | 15 |
| UI components | shadcn/ui + Tailwind CSS | latest |
| Auth | Clerk | latest |
| Storage | Cloudflare R2 (S3-compatible); LocalDisk fallback in dev | — |
| Image annotation | Sharp | latest |
| PDF generation | Playwright `page.pdf()` | — |
| Logging | Pino (JSON structured) | latest |
| Email | Resend (or Postmark) | latest |
| Testing | Vitest (unit) + Playwright Test (integration + acceptance) | latest |
| Deployment | Fly.io (API) + Vercel (dashboard) | — |
| Containerization | Docker + docker-compose | latest |

Exact version pins go to `package.json` + `pnpm-lock.yaml`. Never upgrade a pinned version without approval.

### 6.5 Project structure map

Top-level layout. Every file belongs somewhere; if a task wants a file outside these locations, STOP and ask.

```
neural-nba/                                    # repo root
├── CLAUDE.md                                  # Claude Code operational entry point
├── README.md                                  # human-readable repo intro
├── .env.example                               # secret KEY=VALUE documentation (no real values)
├── .env                                       # gitignored; real secrets
├── package.json                               # workspace root config
├── pnpm-workspace.yaml                        # workspace declarations
├── turbo.json                                 # Turborepo pipeline
├── tsconfig.json                              # shared TS config
├── docker-compose.yml                         # local Postgres 16 + pgvector
├── .specify/                                  # Spec Kit managed (created by `specify init`)
│   ├── memory/
│   │   └── constitution.md                    # Spec Kit constitution (symlink → docs/specs/mvp/)
│   ├── scripts/                               # Spec Kit shell scripts
│   └── templates/                             # spec/plan/tasks templates
│
├── apps/                                      # deployable apps (Turborepo workspace)
│   ├── cli/                                   # `pnpm cro:audit` command
│   │   ├── src/
│   │   │   ├── index.ts                       # entry point
│   │   │   ├── commands/
│   │   │   │   └── audit.ts                   # cro:audit subcommand
│   │   │   └── output/
│   │   │       ├── ConsoleReporter.ts
│   │   │       └── JsonReporter.ts
│   │   ├── tests/
│   │   │   ├── unit/                          # fast, isolated
│   │   │   └── integration/                   # real DB, real browser
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── dashboard/                             # Next.js 15 consultant UI
│       ├── src/
│       │   ├── app/                           # App Router pages
│       │   │   ├── layout.tsx
│       │   │   ├── console/
│       │   │   │   ├── audits/page.tsx
│       │   │   │   ├── review/page.tsx
│       │   │   │   ├── review/[id]/page.tsx
│       │   │   │   └── clients/[id]/page.tsx
│       │   │   └── api/
│       │   │       └── report/[audit_run_id]/
│       │   │           └── render/page.tsx    # HTML for PDF rendering
│       │   ├── components/                    # shadcn/ui components
│       │   ├── lib/                           # Dashboard-local utilities
│       │   └── middleware.ts                  # Clerk auth gate
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/                                  # shared libraries (Turborepo workspace)
│   └── agent-core/                            # THE core library
│       ├── src/                               # ★ all source code here
│       │   ├── index.ts                       # public exports
│       │   ├── orchestration/                 # AuditState, AuditGraph, nodes
│       │   │   ├── AuditState.ts
│       │   │   ├── AuditGraph.ts
│       │   │   └── nodes/
│       │   │       ├── AuditSetupNode.ts
│       │   │       ├── PageRouterNode.ts
│       │   │       ├── AuditCompleteNode.ts
│       │   │       └── CrossPageAnalyzeNode.ts
│       │   ├── gateway/                       # AuditRequest + GatewayService
│       │   ├── reproducibility/               # Snapshot + TemperatureGuard
│       │   ├── browser-runtime/               # BrowserManager, OverlayDismisser, Rate/Circuit
│       │   ├── perception/                    # PageStateModel extractors
│       │   ├── mcp/                           # MCP server + 12 tools + ToolRegistry
│       │   │   └── tools/                     # 1 file per tool
│       │   ├── safety/                        # ActionClassifier, DomainPolicy
│       │   ├── verification/                  # ActionContract, 3 strategies, VerifyEngine
│       │   ├── analysis/
│       │   │   ├── nodes/                     # DeepPerceive, Evaluate, SelfCritique, Ground, Annotate, Store
│       │   │   ├── grounding/
│       │   │   │   └── rules/                 # GR-001 to GR-012, 1 file each
│       │   │   ├── scoring/                   # 4D scoring + IMPACT_MATRIX + EFFORT_MAP
│       │   │   ├── heuristics/                # Schema, loader, 2-stage filter
│       │   │   ├── personas/                  # PersonaContext + defaults
│       │   │   ├── cross-page/                # PatternDetector
│       │   │   ├── quality/                   # PerceptionQualityScorer
│       │   │   └── strategies/                # StaticEvaluateStrategy
│       │   ├── storage/                       # AccessModeMiddleware, TwoStore
│       │   ├── review/                        # WarmupManager
│       │   ├── delivery/                      # ExecSummary, ActionPlan, ReportGenerator
│       │   ├── observability/                 # Pino logger, EventEmitter
│       │   ├── adapters/                      # LLMAdapter, StorageAdapter, etc.
│       │   ├── db/                            # Drizzle schema + migrations
│       │   └── types/                         # cross-cutting Zod schemas + TS types
│       ├── tests/
│       │   ├── unit/                          # ★ per-module unit tests
│       │   └── integration/                   # ★ cross-module integration
│       ├── package.json
│       └── tsconfig.json
│
├── heuristics-repo/                           # 30 heuristics, JSON (private)
│   ├── README.md
│   ├── baymard.json
│   ├── nielsen.json
│   └── cialdini.json
│
├── tests/                                     # top-level acceptance suite (Playwright Test)
│   ├── acceptance/
│   │   ├── example-com.spec.ts                # T148
│   │   ├── amazon-in.spec.ts                  # T149
│   │   └── shopify-demo.spec.ts               # T150
│   └── fixtures/                              # cached pages for offline tests (v1.2)
│
└── docs/                                      # all specs + documentation
    ├── PROJECT_BRIEF.md                       # 28-section cross-LLM brief
    ├── master-architecture-checklist.md
    ├── specs/
    │   ├── AI_Browser_Agent_Architecture_v3.1.md      # CANONICAL
    │   ├── AI_Analysis_Agent_Architecture_v1.0.md     # CANONICAL
    │   ├── final-architecture/                        # §01–§36 + §33a (38 specs)
    │   └── mvp/
    │       ├── PRD.md                         # ★ CANONICAL PRD (this file)
    │       ├── README.md
    │       ├── constitution.md                # engineering rules R1-R16
    │       ├── examples.md                    # samples, pitfalls, style guide
    │       ├── tasks-v2.md                    # 263-task master catalog
    │       ├── spec.md                        # (generated by Spec Kit CLI)
    │       ├── plan.md                        # (generated by Spec Kit CLI)
    │       ├── tasks.md                       # (generated by Spec Kit CLI)
    │       └── archive/
    │           └── 2026-04-07-walking-skeleton/
    └── superpowers/
        ├── specs/                             # design specs (from brainstorming skill)
        └── plans/                             # implementation plans (from writing-plans)
```

#### Where things go (decision tree)

| Kind of file | Location |
|---|---|
| Browser agent code | `packages/agent-core/src/browser-runtime/` or `perception/` |
| MCP tool implementation | `packages/agent-core/src/mcp/tools/<toolName>.ts` |
| Grounding rule | `packages/agent-core/src/analysis/grounding/rules/GR<NNN>.ts` |
| Heuristic JSON | `heuristics-repo/<source>.json` |
| Orchestration graph node | `packages/agent-core/src/orchestration/nodes/<NodeName>.ts` |
| External dependency wrapper | `packages/agent-core/src/adapters/<Name>Adapter.ts` |
| Zod schema | Adjacent to the module that owns it (e.g., `.../analysis/types.ts`) |
| Dashboard page | `apps/dashboard/src/app/console/<route>/page.tsx` |
| CLI subcommand | `apps/cli/src/commands/<name>.ts` |
| Unit test | `packages/*/tests/unit/<same-path>.test.ts` |
| Integration test | `packages/*/tests/integration/<name>.test.ts` |
| Acceptance (end-to-end) test | `tests/acceptance/<name>.spec.ts` |
| Design spec (new feature) | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` |
| Implementation plan | `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` |
| Architecture spec | `docs/specs/final-architecture/§NN-<name>.md` (extend existing, don't create new without approval) |

**If a new category of file doesn't fit above: STOP and ASK** (Constitution R11.3).

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

### 9.1 Philosophy

- **Test-first** (Constitution R3.1): write the failing test, see it fail, then implement
- **Never disable a failing test** (R3.3): fix the implementation
- **Every task has a smoke test** (R3.2) — defined in Spec Kit `tasks.md` (generated by CLI)
- **Findings-as-hypotheses applies to tests too:** tests assert concrete behavior, not opinions

### 9.2 Stack

| Level | Tool | Location | Purpose |
|---|---|---|---|
| Unit | Vitest | `packages/*/tests/unit/` | Function-level, isolated, <5s suite |
| Integration | Vitest + test DB + Playwright browser | `packages/*/tests/integration/` | Cross-module; real Postgres; real Chromium |
| Acceptance | Playwright Test | `tests/acceptance/` | Full CLI audit on 3 sites (example.com, amazon.in, Shopify demo) |
| Smoke (per task) | Inline in task description | Varies | Quick verification |

### 9.3 Coverage targets

| Path | Target | Rationale |
|---|---|---|
| `packages/agent-core/src/analysis/grounding/` | ≥ 90% | Hallucination filter; regressions are quality failures |
| `packages/agent-core/src/analysis/scoring/` | ≥ 80% | Deterministic 4D; easy to test; high downstream impact |
| `packages/agent-core/src/adapters/` | ≥ 70% | External boundaries; runtime failures expensive |
| `packages/agent-core/src/orchestration/` | ≥ 60% | Integration-heavy; acceptance suite catches rest |
| `packages/agent-core/src/browser-runtime/` | ≥ 50% | Real browser in integration catches most |
| `apps/dashboard/` | ≥ 40% | Smoke-tested in acceptance |
| Overall `packages/agent-core/` | **≥ 70%** | |

### 9.4 Phase exit criteria

Each phase in Spec Kit-generated `tasks.md` has exit criteria. A phase is "done" only when all pass. Final MVP exit: all 3 acceptance tests pass + 1 real client audit shippable.

### 9.5 Real-LLM policy

- Acceptance tests call real Claude Sonnet 4 (budget: ≤ $15 per acceptance run)
- Unit + integration: may mock LLM responses
- MVP: do NOT mock Claude in acceptance tests — catch prompt regressions against real model

### 9.6 Conformance test suite

Every critical component has a conformance test that verifies it meets its spec requirement, not just "does it run". Claude Code must run the conformance suite before declaring a task complete.

**Command:** `pnpm test:conformance` — runs the per-component conformance matrix below. See Appendix B for full sample test cases.

**Conformance matrix (critical components):**

| Component | Conformance check | Expected behavior | Sample spec requirement |
|---|---|---|---|
| GR-001 (element exists) | Given a finding citing `ctas[5]` and a perception with `ctas.length === 3` → REJECT | Rejection with rule_id=GR-001, reason="element not found" | REQ-GROUND-001 |
| GR-007 (no conversion predictions) | Given a finding recommendation `"this will increase conversion by 15%"` → REJECT | Rejection with rule_id=GR-007, pattern match logged | R5.3 + REQ-GROUND-007 |
| GR-012 (benchmark validation) | Finding claims 14 fields against benchmark `6-8` (threshold_critical: 15) → PASS at `severity: "high"` | Accept; measurement cited | REQ-GROUND-012 |
| GR-012 (benchmark hallucination) | Finding claims 30 fields against benchmark `6-8` but actual form has 5 → REJECT | Actual-vs-claimed deviation > ±20% | REQ-GROUND-012 |
| Self-critique separation | Evaluate LLM + Self-critique LLM must have different system prompts | Snapshot test on prompt hashes | R5.6 |
| Temperature guard | Calling LLMAdapter.invoke({nodeName: "evaluate", temperature: 0.7}) → throws | Runtime Error: "temperature must be 0 for evaluate" | R10 |
| 2-stage heuristic filter | 30 heuristics → Stage 1 (ecommerce) → ~20 → Stage 2 (checkout) → 15-20 | Counts in expected range | §09.6 |
| Warm-up mode | New client (audits_completed=0) → publish any finding → finding.status = "held" | Not auto-published | §24.4 |
| AnalyzePerception schema | `page_analyze` output passes Zod validation on 3 fixture pages | Zod parse returns no errors | §07.9 |
| `page_analyze` single-call invariant | Playwright trace shows exactly 1 `page.evaluate()` call per analysis | Count === 1 | REQ-TOOL-PA-001 |
| Reproducibility | Run audit twice on same URL + same snapshot → finding overlap ≥ 90% | Jaccard similarity ≥ 0.9 | §25 |
| Annotate renders box + pin + ID | Output PNG has readable finding_id at correct bounding box | Pixel-level visual snapshot | §07.8 |
| Append-only tables | `UPDATE rejected_findings SET ...` → DB error | Constraint or trigger blocks | R7.4 |

**Policy:**
- Conformance tests run in CI **on every PR** (unlike acceptance tests which run nightly on main)
- A PR cannot merge if any conformance test fails
- New grounding rule or scoring component requires a new conformance test in the same PR
- Conformance tests live at `packages/agent-core/tests/conformance/<component>.test.ts`

**Claude Code usage rule:** After completing a task, run `pnpm test:conformance -- <component>` for every component the task touched. If any fails, debug before declaring complete (§10.6 self-verification).

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

### 11.4 Code style + patterns (with examples)

#### 11.4.1 Naming conventions

| Element | Convention | Example |
|---|---|---|
| Class | PascalCase | `BrowserManager`, `EvidenceGrounder`, `AnthropicAdapter` |
| Interface / type | PascalCase | `AnalyzePerception`, `LLMAdapter`, `GroundedFinding` |
| Zod schema const | PascalCase + `Schema` | `FindingSchema`, `AnalyzePerceptionSchema` |
| Function (non-component) | camelCase | `detectPageType()`, `filterByBusinessType()`, `groundGR007()` |
| React component | PascalCase | `AuditList`, `FindingDetailCard`, `ReviewInbox` |
| Variable (local, private) | camelCase | `auditRunId`, `groundedFindings`, `perceptionScore` |
| Database column | snake_case | `audit_run_id`, `business_type`, `cost_usd` |
| JSON key (external API, MCP tool I/O) | snake_case | `heuristic_id`, `element_ref`, `bounding_box` |
| Environment variable | SCREAMING_SNAKE | `ANTHROPIC_API_KEY`, `POSTGRES_URL`, `NEURAL_MODE` |
| Constant (module-scope) | SCREAMING_SNAKE | `MAX_PAGES_PER_AUDIT`, `DEFAULT_BUDGET_USD`, `MODEL_PRICING` |
| File (module) | kebab-case.ts OR PascalCase.ts (matches default export) | `browser-manager.ts` OR `BrowserManager.ts` — per workspace convention |
| Test file | `<name>.test.ts` (unit) OR `<name>.spec.ts` (Playwright) | `grounding.test.ts`, `amazon-in.spec.ts` |
| Spec REQ-ID | `REQ-<DOMAIN>-<NAME>-<NNN>` | `REQ-ANALYZE-NODE-001`, `REQ-GROUND-007` |
| Grounding rule | `GR-NNN` (3-digit) | `GR-001`, `GR-012` |
| Task ID (MVP/phase) | `M<phase>.<n>` | `M7.16`, `M2.19a` |
| Task ID (master catalog) | `T<NNN>` | `T117`, `T255` |

#### 11.4.2 File organization (one concern per file)

**RULE:** Files < 300 lines; functions < 50 lines (Constitution R10.1-R10.2). Split when they grow. Each file has ONE responsibility.

**Good:**
```typescript
// packages/agent-core/src/analysis/grounding/rules/GR007.ts
// REQ-GROUND-007: NEVER predict conversion impact.
// This file exports a single pure function that checks a finding's text
// for banned conversion-prediction phrases.

import type { ReviewedFinding, GroundingResult } from "../types";

const BANNED_PATTERNS: RegExp[] = [
  /\bincrease(s|d)?\s+conversion/i,
  /\bboost(s|ed)?\s+(conversion|revenue|sales)/i,
  /\b\d+\s*%\s*(lift|increase|improvement)/i,
  /\bROI\s+of\s+\d+/i,
];

export function groundGR007(
  finding: Pick<ReviewedFinding, "observation" | "assessment" | "recommendation">,
): GroundingResult {
  const corpus = [finding.observation, finding.assessment, finding.recommendation].join(" ");
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(corpus)) {
      return {
        pass: false,
        reason: `GR-007: conversion prediction detected (${pattern} matched)`,
      };
    }
  }
  return { pass: true };
}
```

**Bad:**
```typescript
// all-grounding-rules.ts — 800 lines, 12 rules, hard to test or find

// Also bad: mixing grounding with scoring in same file
// Also bad: default export — prefer named exports for refactor-friendliness
```

#### 11.4.3 TypeScript patterns

**Zod before TypeScript:** define the Zod schema, infer the type.

```typescript
// ✅ GOOD — schema is source of truth
export const FindingSchema = z.object({
  heuristic_id: z.string(),
  status: z.enum(["violation", "pass", "needs_review"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  // ...
});
export type Finding = z.infer<typeof FindingSchema>;

// ❌ BAD — type without schema; runtime validation impossible
export type Finding = {
  heuristic_id: string;
  status: string;  // no enum constraint
  severity: string;
};
```

**Narrow `unknown`, don't use `any`:**

```typescript
// ✅ GOOD
function parseLLMResponse(raw: unknown): Finding {
  return FindingSchema.parse(raw);  // Zod throws on invalid
}

// ❌ BAD
function parseLLMResponse(raw: any): Finding {
  return raw as Finding;  // no runtime check, type lies
}
```

**Named exports; avoid default:**

```typescript
// ✅ GOOD
export function groundGR007(...) { ... }
export const GR007_RULE_ID = "GR-007" as const;

// ❌ BAD
export default function(...) { ... }  // refactor-hostile
```

**Pure functions for grounding + scoring:**

```typescript
// ✅ GOOD — deterministic, easy to test
export function computePriority(
  severity: number,
  confidence: number,
  impact: number,
  effort: number,
): number {
  return Math.round(
    (severity * 2 + impact * 1.5 + confidence * 1 - effort * 0.5) * 100,
  ) / 100;
}

// ❌ BAD — hidden dependency, untestable
export function computePriority(finding: Finding): number {
  return globalConfig.scoringWeights.severity * finding.severity + ...;
}
```

#### 11.4.4 Error handling

```typescript
// ✅ GOOD — structured, includes context, correlation ID
throw new Error(
  `[GR-001] Element not found in perception. ` +
  `Finding references 'ctas[5]' but perception.ctas.length === 3. ` +
  `audit_run_id=${auditRunId} page=${pageUrl} heuristic=${heuristicId}`,
);

// ❌ BAD — opaque
throw new Error("Element not found");

// ❌ BAD — leaks IP (heuristic content)
throw new Error(`Heuristic '${heuristic.name}: ${heuristic.description}' failed`);
```

Never `catch {}` silently. Either handle (log + recover), or re-throw with added context.

#### 11.4.5 Adapter pattern (R7, R9)

All external dependencies go through adapter modules. Direct imports of Anthropic SDK / Playwright / `pg` / Drizzle outside `adapters/` are FORBIDDEN.

```typescript
// ✅ GOOD — packages/agent-core/src/adapters/AnthropicAdapter.ts
import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMResponse } from "./types";

export class AnthropicAdapter implements LLMAdapter {
  constructor(private readonly client = new Anthropic()) {}
  async invoke<T>(args: ...): Promise<LLMResponse<T>> { ... }
}

// ❌ BAD — packages/agent-core/src/analysis/nodes/EvaluateNode.ts
import Anthropic from "@anthropic-ai/sdk";  // FORBIDDEN outside adapter
```

#### 11.4.6 Logging — Pino only, correlation fields mandatory

```typescript
// ✅ GOOD
import { logger } from "../../observability/logger";

logger.info(
  { audit_run_id, page_url, node_name: "deep_perceive", heuristic_id: null },
  "Perception captured",
);

// ❌ BAD
console.log("Perception captured");  // R10.6 forbids
console.log(perception);  // also dumps 50-150KB
```

### 11.5 Git workflow (branches, commits, PRs with examples)

#### 11.5.1 Branch naming

```
<type>/<phase>-<task-id>-<short-kebab-name>

Types: feat, fix, refactor, test, docs, chore, perf
```

**Examples:**
```
feat/phase-1-m1.5-mutation-monitor
feat/phase-7-m7.16-gr-007-no-conversion-predictions
fix/m7.10-gr-001-off-by-one
refactor/heuristic-loader-async
test/phase-8-m8.15-example-com-acceptance
docs/prd-v1.1-add-conformance-suite
chore/bump-claude-sonnet-to-latest
```

**Rules:**
- Lowercase only
- Kebab-case for the short name
- Include task ID (`m7.16`, not just "gr-007")
- Keep `<short-kebab-name>` under 40 chars

#### 11.5.2 Commit message template

**Full form:**
```
<type>(<scope>): <TaskID> <imperative summary> (<REQ-ID>)

<body explaining WHY — not WHAT>

<optional: Spec coverage section per §10.6>

<trailer>
```

**Real example — grounding rule implementation:**

```
feat(grounding): M7.16 add GR-007 no-conversion-predictions rule (REQ-GROUND-007)

GR-007 is the absolute ban on conversion impact predictions. The rule
runs deterministically after self-critique and rejects any finding whose
observation, assessment, or recommendation contains banned phrases
("increase conversion", "%lift", "ROI of N", etc.).

Design choice: regex-based pattern list rather than LLM check, because
grounding must be deterministic (R13, REQ-GROUND-007). Patterns cover
the most common LLM hallucinations observed during prompt testing.

Spec coverage for M7.16 (REQ-GROUND-007):
  ✅ Regex pattern list covers "increase conversion", "%lift", "ROI of N"
     - packages/agent-core/src/analysis/grounding/rules/GR007.ts:5-10
  ✅ Case-insensitive matching (i flag on every pattern)
  ✅ Scans observation + assessment + recommendation (not just one field)
  ✅ Returns structured {pass, reason} result
  ✅ Conformance test added: tests/conformance/gr007.test.ts

Not covered by this PR:
  - Integration into EvidenceGrounder chain → M7.22 (separate PR)
  - Rejected-finding storage → M7.26 (StoreNode task)

Task: M7.16
Spec: docs/specs/final-architecture/07-analyze-mode.md §7.7 GR-007
```

**Short form (for small / unambiguous changes):**
```
fix(grounding): M7.10 off-by-one on GR-001 element index lookup (REQ-GROUND-001)

Array index was 1-based in spec example but 0-based in implementation.
Aligned to 0-based per TypeScript/JS convention.
```

**Rules:**
- Lowercase `<type>`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`
- `<scope>` in parentheses. Common: `grounding`, `perception`, `orchestration`, `dashboard`, `adapters`, `scoring`, `prd`, `docs`
- `<TaskID>` always present for implementation commits (`M7.16` or `T117`)
- `<REQ-ID>` in parens at end of subject
- Subject line < 72 chars including prefix
- Body required for any non-trivial change; explain WHY, not WHAT
- **Spec coverage section required** (per §10.6) for tasks tied to acceptance criteria

#### 11.5.3 Pre-commit checklist

Claude Code (and humans) MUST run before every commit:

1. `pnpm lint` → zero warnings
2. `pnpm typecheck` → no TS errors
3. `pnpm test` (affected workspace) → green
4. `pnpm test:conformance -- <component>` if task touches a component with a conformance test (§9.6)
5. Task's smoke test → passes (from `tasks-v2.md`)
6. Verify changed files match task scope — no drive-by edits (§10.6)
7. Sanity-check `.env` is NOT staged; no secrets, no large logs, no `node_modules`
8. Commit message follows §11.5.2 format; Spec coverage section present (§10.6)

#### 11.5.4 Pull request policy

- **One task = one PR** (unless tasks are trivially sequential and break intermediate state)
- **PR title = commit subject line format**
- **PR body** MUST include:
  1. Spec coverage section (§10.6)
  2. Test output (paste CI check summary)
  3. Screenshots if UI-touching
  4. Any deviations from spec + approval reference (§10.8)
- **Phase exit criteria met** before merging the last PR of a phase (Spec Kit `tasks.md` has these)
- **No** `--no-verify` / hook bypass / signing bypass without written approval in PR body
- **Never** force-push to `main`
- **Never** merge a PR with any red CI check

#### 11.5.5 Branching model

```
main ────────────────────────────────────────────────────────────────►
  │                                                    ▲
  ├──► feat/phase-1-m1.5-mutation-monitor  ────────────┤
  │                                                    │  (PR, review, merge)
  ├──► fix/m7.10-gr-001-off-by-one  ───────────────────┤
  │                                                    │
  └──► docs/prd-v1.1-add-conformance-suite ────────────┘
```

- `main` is always deployable
- No long-lived feature branches (merge after each task)
- Short-lived branches (1-3 days max)
- If a task is truly multi-day, split it into smaller tasks first

---

## 12. Spec-Driven Workflow + Versioning

### 12.1 Spec Kit integration

The workflow follows GitHub Spec Kit's gated progression. This PRD is the input; Spec Kit CLI produces the downstream artifacts.

```
PRD.md (this document)
    │  (run Spec Kit CLI)
    ▼
/speckit.constitution   → updates docs/specs/mvp/constitution.md if needed
/speckit.specify        → generates docs/specs/mvp/spec.md from this PRD
/speckit.plan           → generates docs/specs/mvp/plan.md from spec.md + tech stack in §6.4
/speckit.tasks          → generates docs/specs/mvp/tasks.md from plan.md
/speckit.analyze        → cross-artifact consistency check
/speckit.implement      → executes tasks (or hand off to Claude Code + superpowers skills)
```

**Never skip a gate.** If a gate reveals ambiguity, return to the previous artifact and fix before proceeding.

### 12.2 Version bump rules

| Change type | Version bump |
|---|---|
| Typos, clarifications | 1.0.0 → 1.0.1 |
| Scope additions (new feature in §3.1) | 1.0.x → 1.1.0 |
| Scope removals (cut a feature) | 1.0.x → 1.1.0 (document rationale) |
| Breaking acceptance criteria change | 1.x.y → 2.0.0 |

Bump triggers:
- Minor clarifications: inline edit + §16 changelog entry
- Scope additions: product owner approval required; PR with rationale
- Scope removals: product owner + engineering lead approval
- Breaking: all stakeholders + version bump

### 12.3 Cross-doc synchronization

When this PRD changes, check for downstream sync:

| This PRD changes | Sync to |
|---|---|
| Scope (§3.1) | Regenerate `spec.md` via `/speckit.specify` |
| Tech stack (§6.4) | Regenerate `plan.md` via `/speckit.plan` |
| Functional req (§4) | Regenerate `spec.md` + `tasks.md` |
| Boundaries (§10) | Update `CLAUDE.md` §7 + `constitution.md` if new non-negotiable |
| Commands (§8) | Update `CLAUDE.md` §3 |
| Domain knowledge (§11) | Update `examples.md` |

### 12.4 Update process

- **Minor:** edit inline, add §16 changelog entry, commit `docs(prd): clarify <section>`.
- **Scope:** PR + rationale + product-owner approval.
- **Review cadence:** weekly during implementation (engineering lead checks §13 acceptance + §4 success metrics). End of each phase: full PRD re-read, update §16 with drift. Post-demo: incorporate feedback.

### 12.5 Context management + spec summarization

This PRD is ~1200 lines. The master plan is 38 specs. Loading everything per task wastes context, costs money, and increases agent drift. We manage this actively.

#### 12.5.1 Rule — load only the relevant section

When Claude Code works on a task, the prompt MUST include:
1. **This PRD §10** (Claude Code Operational Boundaries) — always
2. **`constitution.md`** — always (it's short)
3. **The task** from Spec Kit `tasks.md` — always
4. **Only the spec section(s) cited by the task's REQ-IDs** — use file-structure map in §6.5
5. **Relevant `examples.md` section** if a pattern exists (grounding, findings, heuristics)
6. **This PRD's component section (§7.N)** matching the workspace being touched

**Do NOT load:**
- The full PRD (too big, most sections irrelevant per task)
- Unrelated architecture specs (e.g., don't give dashboard tasks §20 state-exploration spec)
- `PROJECT_BRIEF.md` for implementation tasks (it's for LLM analysis / gap analysis; strategic, not operational)

#### 12.5.2 Per-phase spec summary (to be generated)

For each phase in Spec Kit `tasks.md`, maintain a concise phase summary (~ 200-400 tokens) that captures:
- Phase goal (1 sentence)
- List of tasks in phase (IDs + 1-line descriptions)
- Required specs (REQ-IDs with file paths)
- Exit criteria
- Common pitfalls for this phase (from `examples.md`)

**Script (planned):** `pnpm spec:summarize --phase <N>` generates `docs/specs/mvp/phase-summaries/phase-<N>.md` from `tasks.md` + referenced specs. Target post-MVP but can be manual until then.

**Usage:** when starting a task in Phase N, load `phase-<N>.md` as the phase-level context instead of the entire PRD + master plan.

#### 12.5.3 Context-management tooling options

For MVP: manual discipline per §12.5.1.

**Post-MVP options** to manage larger spec corpus:

| Option | Purpose | Integration |
|---|---|---|
| **Context7 MCP server** | Fetch current library docs at runtime (TypeScript, Playwright, LangGraph, Zod, Drizzle, Clerk) | Already available as MCP tool; Claude Code can call `mcp__plugin_context7_context7__query-docs` |
| **Pgvector-backed RAG** | Embed the 38 architecture specs; retrieve top-k relevant chunks per query | `packages/agent-core/src/db/` has pgvector; one script to embed specs, one RAG query function |
| **Per-component spec extracts** | Pre-generate small (<500 token) summaries per §07.N spec section | Automated via summarization script; output committed alongside source specs |
| **Spec Kit `/speckit.analyze`** | Cross-artifact consistency — not RAG, but catches drift between spec/plan/tasks | Already in Spec Kit v0.7.4 |

**Recommendation:** start with Context7 (free, already available) for external library docs. Add pgvector RAG in v1.2 when the spec corpus + golden test library grow. Don't over-engineer context management before the MVP ships.

#### 12.5.4 Spec summarization pipeline (target state, v1.2)

```
docs/specs/final-architecture/§NN-<name>.md              (source of truth, 500-1500 lines each)
   │
   ▼ (summarization script, prompts Claude Sonnet 4)
docs/specs/mvp/phase-summaries/phase-<N>.md              (200-400 tokens, auto-regenerated)
   │
   ▼ (Spec Kit tasks.md references phase summary)
Claude Code prompt context                                (compact, targeted)
```

Until that pipeline exists, the rule is manual discipline: load only what §12.5.1 says to load.

### 12.6 Lifecycle states (Constitution R17)

Every spec artifact carries a `status:` field in YAML frontmatter. Allowed states: `draft | validated | approved | implemented | verified | superseded | archived`. Claude Code and humans SHALL skip `draft`, `superseded`, `archived` artifacts when loading context for implementation.

**Frontmatter template:** `docs/specs/mvp/templates/frontmatter-lifecycle.template.md`.

**State transitions:**
- `draft → validated`: author self-review complete
- `validated → approved`: PR approved by product owner or engineering lead
- `approved → implemented`: code lands referencing the artifact's REQ-IDs
- `implemented → verified`: conformance + acceptance tests green
- `verified → superseded`: newer version replaces it (the new version carries `supersedes:` pointer)

Enforcement: `pnpm spec:validate` (stub; full implementation Phase 9) checks frontmatter on every PR.

### 12.7 Delta-based updates (Constitution R18)

Every spec update MUST include a `delta:` block in frontmatter AND a changelog entry enumerating what is `new`, `changed`, `impacted`, `unchanged`. Silent edits are rejected in PR review. Delta entries are append-only — when v1.1 supersedes v1.0, both deltas remain in the changelog with v1.0 marked `superseded by v1.1`.

### 12.8 Phase rollups (Constitution R19)

At the end of every phase, a `phase-<N>-current.md` rollup SHALL be produced by `pnpm spec:rollup --phase <N>` before the next phase starts. The rollup is the compressed current-system baseline that Phase N+1 reads; Phase N+1 does NOT re-load Phase N's full artifacts.

**Rollup capture** (~200 lines max, per Rule R19.5):
- Active modules introduced
- Data contracts in effect
- System flows now operational
- Known limitations carried forward
- Open risks for next phase
- Conformance gate status

**Template:** `docs/specs/mvp/templates/phase-rollup.template.md`.

**State:** `approved` immediately at phase exit; transitions to `verified` when N+1 starts; to `superseded` when N+1 rollup lands (earlier rollups retained as `verified` history).

### 12.9 Impact analysis for cross-cutting changes (Constitution R20)

Any PR modifying a shared contract — `AnalyzePerception`, `PageStateModel`, `AuditState`, `Finding`, any adapter interface, DB schema, MCP tool interface, or grounding rule interface — MUST include an `impact.md` analysis documenting:
- Affected modules
- Affected contracts (before / after)
- Breaking / not breaking + migration steps
- Risk level (low / medium / high)
- Conformance tests that guard the change
- Downstream ripple (which other artifacts need updating)

**Template:** `docs/specs/mvp/templates/impact.template.md`.

For additive-only changes (new fields with defaults, new adapters, new grounding rules), `impact.md` is still required — the discipline of producing it catches ripple effects; content can be short.

Breaking-change PRs without an approved `impact.md` are rejected.

### 12.10 Traceability matrix (Constitution R21)

A central traceability matrix (`docs/specs/mvp/spec-to-code-matrix.md`) maps every REQ-ID → spec section → implementation file + lines → tests → status. Auto-generated by `pnpm spec:matrix`. CI runs `pnpm spec:matrix --check` on every PR; a REQ-ID referenced in a spec with `status: implemented` but no code reference fails the build.

**Template:** `docs/specs/mvp/templates/spec-to-code-matrix.template.md`.

**Code-side convention:** every REQ-ID implementation carries a comment marker:

```typescript
// REQ-GROUND-007: NEVER predict conversion impact
// Implements rule GR-007 from §07.7 (§07 analyze-mode.md).
export function groundGR007(...) { ... }
```

The matrix is read-only reference — never hand-edited (Rule 21.5). Changes flow: update specs or code → re-run `pnpm spec:matrix` → commit.

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

| Week | Milestone | Engineering | CRO (parallel Phase 0b) |
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

### 15.1 Primary risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Heuristic authoring slips | Medium | High | Phase 0b starts Day 1; top 15 by Week 2 is gating milestone |
| Claude rate limit / outage during demo | Low | High | Pre-cache demo audit results; live demo has fallback replay |
| Target site has aggressive bot detection | Medium | Medium | Curate demo sites known to work; stealth deferred to v1.1 |
| PDF layout breaks on complex findings | Medium | Low | Build PDF template early (Week 11 start); test on 5 audits before demo |
| Grounding rejects too aggressively → empty reports | Low | Medium | Tunable thresholds; "review needed" fallback for borderline cases |
| Consultant finds output "not better than Lighthouse" | Low | High | Heuristic depth + benchmark citation + grounded evidence is differentiator — CRO team must deliver depth, not just breadth |
| Cost exceeds $0.50 per page | Medium | Medium | Kimi gap analysis estimated ~$0.80/page; validate in Phase 5 and tune |
| Anti-bot detection during demo | Medium | Medium | Safe demo sites (example.com, known-friendly Shopify) |
| 12 weeks too long for fundraising | — | — | Can compress to 8 weeks by dropping dashboard (CLI-only) — loses investor polish |
| Scope creep from stakeholders | High | Medium | This PRD locked; new requests → v1.1 backlog |

### 15.2 Lethal trifecta contingencies — speed × non-determinism × cost

AI-assisted systems that move fast, produce non-deterministic output, AND burn variable cost per call are a combined risk that individual mitigations miss. Neural faces all three vectors.

#### 15.2.1 Non-determinism contingency

**Risk:** same audit inputs produce meaningfully different findings across runs, undermining consultant trust + client defensibility.

**Prevention:**
- Temperature=0 enforced on evaluate / self_critique / evaluate_interactive (R10)
- Reproducibility snapshot per audit (immutable; model version + prompt hashes + heuristic version) — §F-015
- Target: ≥ 90% finding overlap on repeat audit within 24 hrs

**Detection:**
- Every audit's reproducibility snapshot logged to `reproducibility_snapshots` table
- Nightly job (post-MVP) re-runs a golden audit; diffs findings; alerts if overlap drops below 85%

**Recovery when triggered:**
1. Pause audits for the affected client
2. Alert consultant + engineering lead (email via `NotificationAdapter`)
3. Diagnose: compare prompt hash vs previous; check LLM provider for silent model update (Anthropic doesn't version-lock aggressively)
4. If a silent model change: pin an older model version in `MODEL_PRICING` / adapter config; roll forward with stable pin
5. Re-run affected audits with the pinned model; communicate with consultant before re-delivering to client
6. **If determinism cannot be restored within 48 hrs:** manual-audit fallback per §15.3.1

#### 15.2.2 Cost-spike contingency

**Risk:** per-audit cost exceeds budget unexpectedly (Kimi gap analysis estimated real costs at ~2.3× projections; complex sites + retry loops compound).

**Prevention:**
- Hard budget cap: $15/audit, $5/page, $0.50/exploration (enforced at runtime, not advisory)
- Token-level cost accounting in `llm_call_log` (per-call actuals, not estimates — NF-002, F-021)
- Pre-call budget gate: estimate from `getTokenCount()` before invoking; skip or split batch if over
- Per-client cost attribution queryable for profitability tracking

**Detection:**
- BullMQ-scheduled cost-sanity job (post-MVP) checks last 24 hrs of `llm_call_log`:
    - Any audit where `actual_cost_usd > 2 × projected_cost_usd` → alert
    - Any client where rolling 7-day cost exceeds revenue share → alert engineering lead
- Dashboard `/console/admin/operations` (deferred to v1.2) surfaces cost trend chart

**Recovery when triggered:**
1. **Immediate:** audit hits $15 cap → `budget_exceeded` termination (already implemented); partial findings delivered with note
2. **Client-level cost spike (recurring):** throttle per §15.3.2 — reduce max_pages, disable persona iteration, fall back to Tier 1 quantitative heuristics only (skip LLM evaluate on low-quality pages via quality gate)
3. **System-wide cost spike:** circuit-break new audit starts (BullMQ pause job); engineering investigates before resuming
4. **Catastrophic:** if a bug causes runaway calls (> 10× projected), revoke the Anthropic API key immediately via dashboard; rotate key after fix + cost-reconciliation with Anthropic billing

#### 15.2.3 Speed-vs-quality contingency

**Risk:** under demo pressure, engineering cuts corners (skip tests, widen `any`, bypass grounding) — a single compromised commit can erode trust in the entire audit output.

**Prevention:**
- Pre-commit checklist enforced by CI (§11.5.3): lint + typecheck + test + conformance + Spec coverage (§10.6)
- Constitution R3.3: never disable a failing test; §10.3 NEVER rules are absolute
- Phase-level review gate (§10.5) before merging last PR of a phase
- Reviewer (human or subagent-reviewer) must confirm Spec coverage section present

**Detection:**
- CI blocks any PR lacking Spec coverage section
- Reviewer checks that `any` additions have `// TODO: type this` + tracking issue link (R2.1)
- Quarterly review of `rejected_findings` table: if same grounding rule is firing on many real-client findings, the prompt or heuristic likely has a systemic quality gap

**Recovery when triggered:**
1. A bad commit discovered in production → revert PR, do NOT try to patch forward
2. Root cause: did a reviewer miss the Spec coverage, or did `--no-verify` bypass the checklist? Update reviewer guidelines or CI hook
3. If a whole set of findings already shipped to a client were based on broken code: pause delivery of new audits for that client; communicate proactively; offer re-audit with fixed pipeline at no additional cost

### 15.3 Fallback protocols

#### 15.3.1 Manual audit fallback

**When to invoke:** Determinism unrecoverable (§15.2.1) OR pipeline broken mid-engagement OR client-critical finding must be verified OR system-wide outage.

**Protocol:**
1. Consultant is informed via email/Slack within 1 hour of system failure detection
2. Consultant opens the consultant dashboard (if still functional) OR raw CLI logs; reviews last captured perception data per page
3. Consultant drafts findings manually using:
    - Annotated screenshots from R2 (if already captured)
    - Heuristic reference docs (available to consultants outside the `heuristics-repo/` IP barrier)
    - Consultant's own CRO expertise
4. Consultant delivers manual PDF through existing REO Digital template (pre-Neural workflow)
5. Post-incident review documents what failed + adds regression test

**Goal:** zero client-facing disruption. Consultant experience degrades (back to 40 hr workflow) but client never sees the break.

#### 15.3.2 Model-throttle protocol

**When to invoke:** Cost spike detected (§15.2.2) OR Anthropic rate-limit sustained > 10 min OR budget alert fires.

**Throttle levels (applied in order until issue resolves):**

| Level | Action | Expected effect |
|---|---|---|
| 1 — Gentle | Reduce `max_pages` from 20 to 10 per audit | ~50% LLM cost cut per audit |
| 2 — Moderate | Disable persona iteration (single default persona only) | ~30% additional cut on evaluate cost |
| 3 — Aggressive | Enable "skip if perception quality < 0.8" (stricter gate) | ~20% additional cut; more pages skip to partial |
| 4 — Maximum | Evaluate only Tier 1 quantitative heuristics deterministically; skip LLM evaluate entirely for low-quality pages | ~70% cost cut; quality drops to "checklist-grade" |
| 5 — Circuit break | Pause all new audits via BullMQ; drain in-flight; engineering investigates | No new cost incurred; in-flight audits finish |

Throttle config lives in `AuditRequest.throttle_level` (new field for v1.2; MVP accepts it as optional and ignores if absent).

#### 15.3.3 Circuit breaker on repeated failures

**Already implemented** (Constitution references § 11.3, §15):
- Domain-level: 3 failures → 1-hour block per domain
- LLM provider-level: 5 errors in 10 min → alert (v1.1 adds failover to GPT-4o)
- Audit-level: 3 consecutive page failures → pause audit; BullMQ resume in 5 min (3 attempts over 15 min)

**When circuit triggers:**
1. Audit paused → consultant notified
2. Engineering investigates root cause (check Pino logs correlated by `audit_run_id`)
3. If fixable in < 15 min: fix + resume
4. If not: audit marked `failed`, partial findings delivered with explicit status, consultant escalates per §15.3.1

#### 15.3.4 Human override at every gate

Humans can override the system at four gates:

| Gate | Human action | Effect |
|---|---|---|
| Audit trigger | Consultant chooses manual URL list instead of sitemap | Full control over page queue |
| Warm-up mode | Engineering / admin manually toggles `warmup_mode_active: false` for a trusted client | Bypasses the "first 3 audits held" rule |
| Consultant review | Reject or edit any finding before publication | Finding never reaches client without consultant approval |
| PDF delivery | Consultant previews PDF, can regenerate with edits | No auto-delivery to client |

There is no scenario where the system sends output to a client without at least one human approval gate (Constitution §6-R6.1, §24 two-store pattern, §F-019 review workflow).

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

These are templates for the `pnpm test:conformance` suite referenced in §9.6. Implement in `packages/agent-core/tests/conformance/`. One file per component.

### 19.1 Template: grounding rule conformance

```typescript
// packages/agent-core/tests/conformance/gr007.test.ts
// CONFORMANCE: REQ-GROUND-007 — no conversion predictions
// See PRD §9.6 matrix row "GR-007"

import { describe, it, expect } from "vitest";
import { groundGR007 } from "@/analysis/grounding/rules/GR007";

describe("GR-007 conformance: no conversion predictions", () => {
  const banned = [
    { field: "recommendation", text: "Adding trust badges will increase conversion by 15%." },
    { field: "assessment", text: "The 14-field form causes a conversion-rate decrease of 10%." },
    { field: "observation", text: "Expected ROI of 3x if the CTA is above the fold." },
    { field: "recommendation", text: "This change would boost revenue significantly." },
    { field: "assessment", text: "A 20% lift is likely with this tweak." },
  ];

  for (const { field, text } of banned) {
    it(`rejects banned phrase in ${field}: "${text.slice(0, 40)}..."`, () => {
      const finding = {
        observation: field === "observation" ? text : "",
        assessment: field === "assessment" ? text : "",
        recommendation: field === "recommendation" ? text : "",
      };
      const result = groundGR007(finding);
      expect(result.pass).toBe(false);
      expect(result.reason).toMatch(/conversion prediction/i);
    });
  }

  const safe = [
    "Add trust badges above the fold. Measure with an A/B test.",
    "Reduce form fields to 8. Research shows 6-8 is the Baymard benchmark.",
    "CTA color contrast is 4.2:1, below WCAG AA 4.5:1.",
    "Prior similar sites have reported improvements with trust badges (Baymard 2024).",
  ];
  for (const text of safe) {
    it(`accepts safe recommendation: "${text.slice(0, 40)}..."`, () => {
      const result = groundGR007({
        observation: "",
        assessment: "",
        recommendation: text,
      });
      expect(result.pass).toBe(true);
    });
  }
});
```

### 19.2 Template: temperature guard conformance

```typescript
// packages/agent-core/tests/conformance/temperature-guard.test.ts
// CONFORMANCE: R10 reproducibility — temperature=0 on analysis LLM calls
// See PRD §9.6 matrix row "Temperature guard"

import { describe, it, expect } from "vitest";
import { LLMAdapterWithGuard } from "@/adapters/LLMAdapterWithGuard";
import { MockLLMAdapter } from "@/adapters/MockLLMAdapter";

describe("Temperature guard conformance", () => {
  const guarded = new LLMAdapterWithGuard(new MockLLMAdapter());

  it("rejects temperature > 0 for evaluate", async () => {
    await expect(
      guarded.invoke({ system: "x", user: "y", nodeName: "evaluate", temperature: 0.7 }),
    ).rejects.toThrow(/temperature must be 0 for evaluate/i);
  });

  it("rejects temperature > 0 for self_critique", async () => {
    await expect(
      guarded.invoke({ system: "x", user: "y", nodeName: "self_critique", temperature: 0.3 }),
    ).rejects.toThrow(/temperature must be 0/i);
  });

  it("allows temperature=0 for evaluate", async () => {
    const r = await guarded.invoke({ system: "x", user: "y", nodeName: "evaluate", temperature: 0 });
    expect(r).toBeDefined();
  });

  it("allows any temperature for non-analysis nodes (e.g., executive_summary)", async () => {
    // Executive summary recommended_next_steps allows slight variation
    const r = await guarded.invoke({ system: "x", user: "y", nodeName: "executive_summary", temperature: 0.2 });
    expect(r).toBeDefined();
  });
});
```

### 19.3 Template: 2-stage heuristic filter conformance

```typescript
// packages/agent-core/tests/conformance/heuristic-filter.test.ts
// CONFORMANCE: §09.6 REQ-HK-020a/b — two-stage filter
// See PRD §9.6 matrix row "2-stage heuristic filter"

import { describe, it, expect } from "vitest";
import { filterByBusinessType, filterByPageType } from "@/analysis/heuristics/filter";
import { loadHeuristics } from "@/analysis/heuristics/HeuristicLoader";

describe("2-stage heuristic filter conformance", () => {
  const all = loadHeuristics(); // 30 heuristics from heuristics-repo/

  it("Stage 1: filterByBusinessType(ecommerce) reduces 30 to ~20", () => {
    const s1 = filterByBusinessType(all, "ecommerce");
    expect(s1.length).toBeGreaterThanOrEqual(15);
    expect(s1.length).toBeLessThanOrEqual(25);
    expect(s1.every((h) => h.business_type_applicability.includes("ecommerce"))).toBe(true);
  });

  it("Stage 2: filterByPageType(checkout) reduces ~20 to 10-18", () => {
    const s1 = filterByBusinessType(all, "ecommerce");
    const s2 = filterByPageType(s1, "checkout");
    expect(s2.length).toBeGreaterThanOrEqual(10);
    expect(s2.length).toBeLessThanOrEqual(18);
    expect(s2.every((h) => h.page_type_applicability.includes("checkout"))).toBe(true);
  });

  it("Two-stage filter ≡ single-stage filter (no drift)", () => {
    const twoStage = filterByPageType(filterByBusinessType(all, "ecommerce"), "checkout");
    const singleStage = all.filter(
      (h) =>
        h.business_type_applicability.includes("ecommerce") &&
        h.page_type_applicability.includes("checkout"),
    );
    expect(twoStage.map((h) => h.id).sort()).toEqual(singleStage.map((h) => h.id).sort());
  });

  it("Stage 2 cap at 30 applied after filtering", () => {
    // Contrived case: load a mock set with > 30 heuristics matching everything
    const mockAll = Array(50).fill(null).map((_, i) => ({
      id: `MOCK-${i}`,
      business_type_applicability: ["ecommerce"],
      page_type_applicability: ["checkout"],
      // ...minimum valid heuristic shape
    }));
    const filtered = filterByPageType(filterByBusinessType(mockAll as any, "ecommerce"), "checkout");
    expect(filtered.length).toBeLessThanOrEqual(30);
  });
});
```

### 19.4 Template: append-only table conformance

```typescript
// packages/agent-core/tests/conformance/append-only.test.ts
// CONFORMANCE: R7.4 — append-only tables
// See PRD §9.6 matrix row "Append-only tables"

import { describe, it, expect } from "vitest";
import { getTestDb, closeTestDb, insertRejectedFinding } from "../helpers/db";

describe("Append-only table conformance", () => {
  const db = getTestDb();
  afterAll(() => closeTestDb(db));

  const appendOnlyTables = [
    "audit_log",
    "rejected_findings",
    "finding_edits",
    "llm_call_log",
    "audit_events",
  ];

  for (const table of appendOnlyTables) {
    it(`${table}: UPDATE is rejected`, async () => {
      const row = await insertRejectedFinding(db, { ... });
      await expect(
        db.execute(`UPDATE ${table} SET rejection_reason = 'tampered' WHERE id = $1`, [row.id]),
      ).rejects.toThrow();
    });

    it(`${table}: DELETE is rejected`, async () => {
      const row = await insertRejectedFinding(db, { ... });
      await expect(
        db.execute(`DELETE FROM ${table} WHERE id = $1`, [row.id]),
      ).rejects.toThrow();
    });
  }
});
```

### 19.5 Template: reproducibility conformance (nightly only)

```typescript
// packages/agent-core/tests/conformance/reproducibility.test.ts
// CONFORMANCE: §25 + NF-006 — same inputs → ≥90% finding overlap
// See PRD §9.6 matrix row "Reproducibility"
// NOTE: this test makes REAL LLM calls. Run nightly, not on every PR.

import { describe, it, expect } from "vitest";
import { runAudit } from "@/orchestration/AuditGraph";
import { computeJaccardOverlap } from "../helpers/finding-diff";

describe("Reproducibility conformance (real LLM)", () => {
  it("Same URL + snapshot → ≥90% finding overlap", async () => {
    const url = "https://example-stable.test.neural.dev/checkout";

    const run1 = await runAudit({ url, business_type: "ecommerce", page_type: "checkout" });
    const run2 = await runAudit({ url, business_type: "ecommerce", page_type: "checkout" });

    const overlap = computeJaccardOverlap(run1.findings, run2.findings);
    expect(overlap).toBeGreaterThanOrEqual(0.9);
  }, 120000); // 2 min timeout
});
```

### 19.6 How to add a new conformance test

When adding a new critical component:

1. Open PRD §9.6 matrix; add a row with component + conformance check + expected behavior + spec REQ-ID
2. Create `packages/agent-core/tests/conformance/<component>.test.ts` following the templates above
3. Ensure the test covers the §9.6 matrix expected behavior at minimum
4. Run `pnpm test:conformance` — new test should pass
5. Commit with `test(conformance): add <component> conformance per PRD §9.6 (REQ-...)`

---

*End of PRD v1.1. Approved 2026-04-22. Source of truth: `docs/specs/final-architecture/§01-§36 + §33a` (master plan v2.3). Every claim traces to a REQ-ID in the spec corpus. Ready for Spec Kit CLI.*
