---
title: Phase 9 — Impact Analysis (HIGH risk; T160 supersedes Phase 8 T145; R6 channels 3+4 first activation; ★ MVP SPEC COMPLETE gate ★)
artifact_type: impact
status: draft
version: 0.1
created: 2026-04-29
updated: 2026-04-29
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-9-delivery/spec.md
  - docs/specs/mvp/phases/phase-8-orchestrator/impact.md (T145 scaffold supersession surface)
  - docs/specs/mvp/phases/phase-7-analysis/impact.md (Finding lifecycle producer; AnnotateNode + StoreNode extension surface)
  - docs/specs/mvp/phases/phase-6-heuristics/impact.md (R6 channel 1 first activation; redaction list canonical)
  - docs/specs/mvp/phases/phase-4b-context-capture/impact.md (ContextProfile hash input to T160)
  - docs/specs/mvp/constitution.md (R5.3 + GR-007, R6, R7.4, R8.1, R10, R13, R14, R20, R23)
  - docs/specs/final-architecture/14-delivery-layer.md
  - docs/specs/final-architecture/18-trigger-gateway.md §18.4 + §18.7 + §18.8
  - docs/specs/final-architecture/23-findings-engine-extended.md §23.4 + §23.5
  - docs/specs/final-architecture/24-two-store-pattern.md
  - docs/specs/final-architecture/25-reproducibility.md §25.3 + §25.4
  - docs/specs/final-architecture/34-observability.md
  - docs/specs/final-architecture/35-report-generation.md

req_ids:
  - REQ-TRIGGER-CONTRACT-001..004
  - REQ-TRIGGER-VALIDATE-001..003
  - REQ-TRIGGER-PERSIST-001..003
  - REQ-REPRO-001..010
  - REQ-REPRO-031..032
  - REQ-TWOSTORE-001..031
  - REQ-FINDINGS-SCORE-001..051
  - REQ-FINDINGS-SUPPRESS-001..002
  - REQ-DELIVERY-004..007
  - REQ-DELIVERY-REPORT-001..003
  - REQ-DELIVERY-OPS-001..003
  - REQ-DELIVERY-NOTIFY-001..003
  - REQ-REPORT-001..030
  - REQ-OBS-001..042

breaking: false
risk_level: high

affected_contracts:
  - AuditRequest (PRODUCER — first runtime emit; gateway constructs from CLI flags / dashboard form)
  - reproducibility_snapshot (PRODUCER — T160 SnapshotBuilder full composition; SUPERSEDES Phase 8 T145 MVP scaffold)
  - ScoredFinding (PRODUCER — adds business_impact / effort / priority / confidence to Finding via AnnotateNode extension at T167)
  - PatternFinding (CONSUMER — read by ExecutiveSummaryGenerator + ActionPlanGenerator + ReportGenerator; produced by Phase 8)
  - audit_runs (PRODUCER + CONSUMER — gateway creates row at T158; ExecutiveSummary populates state.executive_summary; ReportGenerator writes report_pdf_url)
  - finding_edits (PRODUCER — NEW; created by dashboard Edit action; append-only per R7.4)
  - rejected_findings (PRODUCER — first writes from T168 Suppression at confidence < 0.3 / empty evidence / exact dup)
  - audit_events (PRODUCER — full 22-event taxonomy first activation across all nodes via T241)
  - llm_call_log (PRODUCER — Pino logger at T239; ExecutiveSummary $0.10 LLM call writes 1 row per audit)
  - reproducibility_snapshots row (PRODUCER — T160 full composition; T145 scaffold superseded)
  - notification_preferences (PRODUCER — NEW per-user table created at T260)
  - DiscoveryStrategy (PRODUCER — NEW interface; SitemapDiscovery + NavigationCrawlDiscovery + ManualDiscovery implementations at T256)
  - NotificationAdapter (PRODUCER — NEW interface; EmailNotificationAdapter Resend implementation at T260)
  - heuristic_health_metrics materialized view (PRODUCER — NEW; nightly refresh job at T242)
  - Hono API routes (PRODUCER — REST endpoints for dashboard at T171; FIRST R6 channel 3 activation)
  - Next.js dashboard pages (PRODUCER — `/console/*` at T169-T173; FIRST R6 channel 4 activation)
  - LLMAdapter.executive_summary call site (PRODUCER — first runtime use of `executive_summary` tag; TemperatureGuard wraps)

delta:
  new:
    - Phase 9 impact — required by R20 because: (a) AuditRequest first runtime emit; (b) reproducibility_snapshot WRITER changes (T160 supersedes Phase 8 T145 scaffold); (c) ScoredFinding contract introduced; (d) R6 channels 3 + 4 first runtime activation (Hono API + Next.js render); (e) NotificationAdapter + DiscoveryStrategy NEW interfaces; (f) Phase 9 is ★ MVP SPEC COMPLETE gate ★; (g) all 4 R6 channels live = first external pilot prereq
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R5.3 + GR-007 (focal — ExecutiveSummary LLM output enforcement)
  - Constitution R6 (focal — channels 3 + 4 first activation; ALL 4 channels live for first external pilot)
  - Constitution R7.4 (append-only)
  - Constitution R8.1 ($15 audit cap; gateway pre-validates)
  - Constitution R10 + R13 (focal — ExecutiveSummary tag joins evaluate/self_critique under temp=0 invariant)
  - Constitution R14.1 (atomic llm_call_log — ExecutiveSummary call is 1 additional row per audit)
  - Constitution R18 (Delta-Based Updates)
---

# Phase 9 Impact Analysis

> **Why this file exists:** Constitution R20. Phase 9 introduces THREE NEW shared producer contracts (`AuditRequest` first runtime, `ScoredFinding` extension of Finding, `PatternFinding` consumer pattern), SUPERSEDES the Phase 8 T145 reproducibility_snapshot scaffold writer with T160 full composition, activates THE FINAL TWO of FOUR R6 enforcement channels at runtime (channel 3 — Hono API responses; channel 4 — Next.js dashboard rendering), introduces TWO NEW adapter interfaces (DiscoveryStrategy, NotificationAdapter) and 1 NEW LLMAdapter call tag (`executive_summary`), and is the ★ MVP SPEC COMPLETE gate ★ — Phase 9 ships → MVP spec corpus complete → implementation can start at Phase 0. Risk level **HIGH** because: (a) T160 supersession of T145 scaffold can regress Phase 8 acceptance tests T148-T150 if field shape diverges; (b) any R6 ch3/ch4 leak compromises competitive moat at the consultant-visible AND client-visible boundary (PDF + dashboard); (c) any GR-007 false-negative on ExecutiveSummary LLM output exposes REO Digital to legal/reputational risk (R5.3); (d) any AccessModeMiddleware fail-open default leaks internal data to client-facing routes (post-MVP risk; MVP is consultant-only but middleware is foundational); (e) Phase 9 = MVP SPEC COMPLETE; failure here delays first external pilot.

---

## 1. Contract changes

| Contract | Before | After | Breaking? |
|---|---|---|---|
| AuditRequest | Phase 4b T4B-009 introduced schema; Phase 8 CONSUMES at AuditSetupNode | Phase 9 PRODUCER first runtime — gateway constructs from CLI flags + dashboard form per §18.4 verbatim | **No** — schema unchanged; first runtime emission |
| reproducibility_snapshot | Phase 8 T145 CLI inline scaffold (placeholder); rows existed but with placeholder hashes | T160 SnapshotBuilder full composition with model + 3 prompt SHA-256 hashes + heuristic_pack_hash + ContextProfile_hash + perception_schema_version + scoring_version + normalizer + grounding versions; immutable per DB trigger §13.6.7 | **No** — additive (richer fields); same DDL |
| ScoredFinding (Finding extension) | Phase 7 T131 AnnotateNode produces grounded Finding (annotated + GR rules pass) | T167 extends AnnotateNode to run ScoringPipeline (T165) on each grounded finding BEFORE persist; writes business_impact + effort + priority + confidence to Finding row | **No** — additive scoring fields with deterministic defaults |
| audit_runs row | Phase 8 mutates status / completion_reason | Phase 9 ALSO writes executive_summary (JSONB) + action_plan (JSONB) + report_pdf_url at AuditCompleteNode (T246 + T249); created by gateway at T158 | **No** — additive columns (Phase 4 schema baseline accommodates if columns missing → migration filed as task delta) |
| finding_edits table | — | NEW; append-only per R7.4; created by dashboard Edit action at T172 | New (additive) |
| rejected_findings rows | Phase 7 produces from critique + grounding rejections | T168 Suppression first runtime — confidence < 0.3 + empty evidence + duplicate | **No** — table exists; new producer |
| notification_preferences table | — | NEW per-user mutable table at T260 | New (additive) |
| Hono API routes (REST) | Phase 4 Hono baseline shipped | T171 first activation `/api/audits/*` + `/api/findings/*` + `/api/report/*` + SSE; redactHeuristicBody middleware applied | New (additive routes) |
| Next.js dashboard pages | — | NEW `apps/dashboard` package + `/console/*` routes at T169-T173 + T244 | New (additive package) |
| DiscoveryStrategy | — | NEW adapter interface; 3 implementations at T256 (Sitemap + Manual + Nav-stub) | New (additive) |
| NotificationAdapter | — | NEW adapter interface; EmailNotificationAdapter (Resend) at T260 | New (additive) |
| LLMAdapter `executive_summary` tag | — | NEW tag for ExecutiveSummary $0.10 cap LLM call at T245; TemperatureGuard wraps (temp=0); GR-007 enforced retry-then-fallback | **No** — existing adapter interface; new tag |
| audit_events 22-event taxonomy | Phase 7 + Phase 8 emit subsets | T241 emits ALL 22 event types per REQ-OBS-012 across all graph nodes | **No** — additive event types; existing table |
| heuristic_health_metrics materialized view | — | NEW at T242; nightly refresh; reads audit_events + llm_call_log + findings | New (additive) |

---

## 2. Producers affected

| Producer | File | Change required | Owner |
|---|---|---|---|
| AuditRequest schema | `packages/agent-core/src/gateway/AuditRequest.ts` | NEW (mirrors §18.4 verbatim) | T156 |
| AuditRequest validation | `packages/agent-core/src/gateway/validateRequest.ts` | NEW (defaults + budget cap + regulatory check) | T157 |
| GatewayService | `packages/agent-core/src/gateway/GatewayService.ts` | NEW (sync function call MVP; transaction wraps audit_requests + audit_runs + reproducibility_snapshots writes) | T158 |
| CLI audit command | `apps/cli/src/commands/audit.ts` | Refactor — calls GatewayService.submit; adds `--replay` flag; SUPERSEDES Phase 8 T145 inline scaffold | T159 |
| SnapshotBuilder | `packages/agent-core/src/reproducibility/SnapshotBuilder.ts` | NEW (createSnapshot + loadAndValidateSnapshot); REPLACES Phase 8 T145 scaffold | T160 |
| TemperatureGuard | `packages/agent-core/src/adapters/TemperatureGuard.ts` | NEW (wraps LLMAdapter.invoke; rejects temp ≠ 0 on tagged calls including new `executive_summary` tag) | T161 |
| AccessModeMiddleware | `packages/agent-core/src/storage/AccessModeMiddleware.ts` | NEW (SET LOCAL app.access_mode + app.client_id; fail-secure default `published_only`) | T162 |
| WarmupManager | `packages/agent-core/src/review/WarmupManager.ts` | NEW (graduation criteria; determinePublishAction) | T163 |
| StoreNode extension | `packages/agent-core/src/analysis/nodes/StoreNode.ts` | EXTEND Phase 7 T132 — add warmup-mode publish_status gating | T164 |
| ScoringPipeline | `packages/agent-core/src/analysis/scoring/ScoringPipeline.ts` | NEW (4D deterministic scoring; severity / confidence / business_impact / effort / priority) | T165 |
| Scoring config | `packages/agent-core/src/analysis/scoring/config.ts` | NEW (IMPACT_MATRIX + DEFAULT_FUNNEL_POSITION + EFFORT_MAP + version pinning) | T166 |
| AnnotateNode extension | `packages/agent-core/src/analysis/nodes/AnnotateNode.ts` | EXTEND Phase 7 T131 — run ScoringPipeline before DB persist | T167 |
| Suppression | `packages/agent-core/src/analysis/scoring/Suppression.ts` | NEW (confidence + evidence + duplicate rules) | T168 |
| `apps/dashboard` package | `apps/dashboard/package.json` + `src/app/layout.tsx` + `src/middleware.ts` | NEW (Next.js 15 + shadcn/ui + Tailwind + Clerk) | T171 |
| Review inbox page | `apps/dashboard/src/app/console/review/page.tsx` | NEW; **R6 channel 4 first activation** | T169 |
| Audits list page | `apps/dashboard/src/app/console/audits/page.tsx` | NEW; New Audit form submits via GatewayService | T170 |
| Finding detail page | `apps/dashboard/src/app/console/review/[id]/page.tsx` | NEW; **R6 channel 4 enforcement** | T172 |
| Clients warm-up page | `apps/dashboard/src/app/console/clients/[id]/page.tsx` | NEW; admin-only override toggle | T173 |
| ExecutiveSummaryGenerator | `packages/agent-core/src/delivery/ExecutiveSummaryGenerator.ts` | NEW (1 LLM call $0.10 cap; GR-007 retry-then-fallback; deterministic strengths) | T245 |
| AuditCompleteNode integration (executive summary) | `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts` | EXTEND Phase 8 T139 — populate state.executive_summary | T246 |
| ActionPlanGenerator | `packages/agent-core/src/delivery/ActionPlanGenerator.ts` | NEW (deterministic 4-quadrant bucketing; NO LLM) | T247 |
| Report HTML template | `apps/dashboard/src/app/api/report/[audit_run_id]/render/page.tsx` | NEW (8 sections; **R6 channel 4 enforcement**) | T248 |
| ReportGenerator | `packages/agent-core/src/delivery/ReportGenerator.ts` | NEW (Playwright page.pdf; R2 upload) | T249 |
| DiscoveryStrategy interface + impls | `packages/agent-core/src/gateway/DiscoveryStrategy.ts` | NEW (interface + Sitemap + Manual + Nav-stub) | T256 |
| DiscoveryStrategy integration | `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts` | EXTEND Phase 8 T137 — strategy selection | T257 |
| NotificationAdapter interface + Resend impl | `packages/agent-core/src/adapters/NotificationAdapter.ts` + `EmailNotificationAdapter.ts` | NEW (Resend; Postmark documented as fallback v1.1) | T260 |
| `notification_preferences` table | DB migration | NEW (per-user mutable; defaults from REQ-DELIVERY-NOTIFY-003) | T260 |
| Notification integration | `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts` | EXTEND Phase 8 T139 — fire NotificationAdapter on completion | T261 |
| Pino logger | `packages/agent-core/src/observability/logger.ts` | NEW (correlation fields; redaction; **R6 channel 1 reaffirm**) | T239 |
| `audit_events` table migration | `packages/agent-core/migrations/0004_audit_events.sql` | NEW (Phase 4 baseline DDL extended; 22 event_types) | T240 |
| Event emission across nodes | All graph nodes (Phase 5/7/8/9) | INJECT EventEmitter; emit appropriate event types | T241 |
| heuristic_health_metrics materialized view | DB migration + nightly refresh job | NEW (per §13.7 REQ-DATA-V22-003) | T242 |
| AlertingJob | `packages/agent-core/src/observability/AlertingJob.ts` | NEW (BullMQ; 7 rules; debounced) | T243 |
| Ops dashboard | `apps/dashboard/src/app/console/admin/operations/page.tsx` | NEW (admin-only; 6 sections; build LAST) | T244 |
| Phase 9 integration test | `packages/agent-core/tests/integration/phase9-foundations.test.ts` | NEW | T174 |
| ★ Acceptance test ★ | `tests/acceptance/foundations-bbc-com.test.ts` | NEW | T175 |
| R6 channel 3 conformance test | `packages/agent-core/tests/conformance/r6-channel-3.test.ts` | NEW (recursive deep scan of API responses) | (folded into AC-36) |
| R6 channel 4 conformance test | `apps/dashboard/tests/conformance/r6-channel-4.test.ts` | NEW (rendered HTML scan; uses Phase 6 redaction list) | (folded into AC-36) |

---

## 3. Consumers affected (per R20 audit)

| Consumer | Location | Reads which contract? | Migration required? | Action |
|---|---|---|---|---|
| Phase 8 AuditSetupNode (T137) | `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts` | Reads AuditRequest from `audit_requests` table; reads reproducibility_snapshot from DB via T160 loadAndValidateSnapshot path (NOT createSnapshot — that's gateway) | **No** for Phase 8; T137 already authored to read these contracts; Phase 9 supplies the writers | None for Phase 8 |
| Phase 8 PostgresCheckpointer (T144) | `packages/agent-core/src/orchestration/PostgresCheckpointer.ts` | State persistence per turn — independent of Phase 9 contracts | **No** | None |
| Phase 8 acceptance tests T148-T150 | `tests/acceptance/{example-com,amazon-in,bbc-com}.test.ts` | Read reproducibility_snapshots row produced by T145 scaffold; verify pinned fields | **Yes** — RE-RUN after T159 + T160 land to verify supersession; field PRESENCE assertions pass under both scaffold + full composition | Phase 9 plan §2 protocol; AC-05 + AC-06 conformance gate |
| Phase 7 AnnotateNode (T131) | `packages/agent-core/src/analysis/nodes/AnnotateNode.ts` | Phase 9 EXTENDS via T167; backward-compatible (scoring is appended; original grounded_findings still emitted) | **No** | T167 extension |
| Phase 7 StoreNode (T132) | `packages/agent-core/src/analysis/nodes/StoreNode.ts` | Phase 9 EXTENDS via T164; backward-compatible (warmup logic gates publish_status; original persist semantics preserved) | **No** | T164 extension |
| Phase 7 LLMAdapter | `packages/agent-core/src/adapters/LLMAdapter.ts` | Phase 9 ADDS new tag `executive_summary`; TemperatureGuard wraps via T161 | **No** — adapter interface unchanged; new tag value | T161 |
| Phase 6 Pino logger | `packages/agent-core/src/observability/logger.ts` | Phase 6 first activation; T239 reaffirms end-to-end with full correlation fields | **No** — additive correlation fields | T239 |
| Phase 6 R6 redaction list | (canonical list referenced in Phase 6 + Phase 9) | T239 + T169-T173 + T248 + r6-channel-3/4 tests reuse | **No** | None |
| Phase 4b ContextProfile | `packages/agent-core/src/context/ContextCaptureNode.ts` (Phase 4b T4B-001..) | T160 SnapshotBuilder hashes ContextProfile into snapshot field | **No** — read-only consumer | None |
| Phase 4 Hono baseline | `packages/agent-core/src/api/server.ts` (Phase 4) | Phase 9 mounts new routes at T171 | **No** — additive | None |
| Phase 4 Drizzle baseline | `packages/agent-core/src/db/schema.ts` (Phase 4 T070) | Phase 9 may need schema migrations for `audit_runs.executive_summary` (JSONB) + `audit_runs.action_plan` (JSONB) + `notification_preferences` table + `finding_edits` table | **Maybe** — if Phase 4 baseline didn't include these columns, schema migration filed as Phase 9 task delta | Coordinate with Phase 4 owner |
| External clients (post-MVP v1.1) | `/console/clients/*` (deferred) | NOT activated in MVP; foundation laid via T162 AccessModeMiddleware fail-secure default | **No** for MVP | None |
| First external pilot launch readiness | (operational milestone) | Requires ALL 4 R6 channels live + R6.2 AES at-rest layer (v1.1 prereq) | **Yes** — Phase 9 ships channels 3 + 4; R6.2 AES is v1.1 hardening BEFORE first external pilot | Documented as post-MVP path |

**Net break risk:** Zero for Phase 1-7 backward compatibility (Phase 9 changes are additive extensions of Phase 7/8 nodes; no field renames; no contract removals). Phase 8 T148-T150 acceptance tests must RE-RUN after T159 + T160 land to verify supersession of T145 scaffold (AC-05 + AC-06 conformance gate).

---

## 4. T160 SnapshotBuilder Supersession Surface — highest-coordination-risk

This is the highest-coordination-risk surface in Phase 9. Phase 8 T145 ships a CLI-inline snapshot scaffold per `phase-8-orchestrator/plan.md §5`; T160 must REPLACE it cleanly without breaking Phase 8 acceptance tests T148-T150.

| Aspect | Phase 8 T145 (scaffold) | Phase 9 T160 (full composition) | Risk |
|---|---|---|---|
| Caller | `apps/cli/src/commands/audit.ts` inline | GatewayService.submit() (T158); CLI calls Gateway via T159 refactor | T159 refactor must preserve smoke test exit semantics |
| Field set | `snapshot_id`, `audit_run_id`, `model_version`, `temperature_invariant: 0`, `heuristic_pack_hash`, `context_profile_hash` (empty string default), `perception_schema_version: "v2.5"`, `prompt_hashes: {evaluate, self_critique}` (placeholder hashFile), `created_at` | Same fields PLUS `prompt_hashes.executive_summary` (NEW — Phase 9 prompt) + `normalizer_version` + `grounding_rule_set_version` + `deterministic_scoring_version` + populated `context_profile_hash` (Phase 4b runs before AuditSetupNode) | Field PRESENCE assertions in T148-T150 should pass; field VALUE assertions on hashes will differ (T148-T150 don't assert specific hash values; only presence) |
| DB DDL | Phase 4 T070 baseline | Same | **No DDL change** |
| Immutability | Phase 4 trigger §13.6.7 | Same trigger; T160 honors via re-hash on loadAndValidateSnapshot | **No protocol change** |
| Replay path | (none in MVP) | T160 loadAndValidateSnapshot used by `audit_setup` node + `--replay <id>` CLI flag | New surface; covered by AC-06 |

**Supersession protocol (per plan.md §2):**
1. Same DDL, different writer.
2. CLI refactor (T159) is the surgical handoff point — deletes inline scaffold, calls GatewayService.submit().
3. Sequential merge order: T156 → T157 → T158 → T160 FIRST, then T159 (depends on all of the above + Phase 8 T145).
4. Backward-compat invariant — T160 fields are SUPERSET of T145 fields; assertions check presence, not count.
5. Snapshot immutability enforced by Phase 4 DB trigger — neither writer can mutate post-insert.
6. If T160 ships before Phase 8 T148-T150 land → acceptable; T160 plug-replaces.
7. If T160 ships after Phase 8 T148-T150 land → still acceptable; re-run T148 to verify.

**Risk if supersession fails:** Phase 8 T148-T150 acceptance tests RED after T159 lands. Mitigation: AC-05 + AC-06 conformance gate; kill criterion (plan.md §7).

---

## 5. R6 Channels 3 + 4 First-Runtime Activation Surface

Phase 9 activates the FINAL TWO of FOUR R6 enforcement channels at runtime. After Phase 9 ships, ALL 4 channels are live = first external pilot prereq satisfied (with v1.1 R6.2 AES at-rest layer added before pilot).

### 5.1 R6 channel matrix (after Phase 9 ships)

| Channel | First activation | Mechanism | Conformance test | Risk if leak |
|---|---|---|---|---|
| 1 — Pino logs | Phase 6 (first); Phase 9 reaffirms via T239 | Redaction list filters heuristic body; only heuristic_id logged | `pino-logger.test.ts` (T239) + Phase 6 baseline | Heuristic IP via observability infra (Addy Osmani lethal-trifecta concern) |
| 2 — LangSmith trace metadata | Phase 7 (first) | `metadata.private` for heuristic body; `metadata.public` for IDs | Phase 7 T134 trace inspection | Heuristic IP via 3rd-party trace store (LangSmith retains 90-365 days) |
| 3 — Hono API responses | **Phase 9 (first)** at T171 | Response payload shape includes `heuristic_id` only; ALL `findings`/`patterns`/`audits` routes filtered through `redactHeuristicBody()` middleware | `r6-channel-3.test.ts` (recursive deep scan) | Heuristic IP via consultant-visible API surface |
| 4 — Next.js dashboard render | **Phase 9 (first)** at T169 + T172 + T248 | Server components query findings/patterns; render only `heuristic_id` references; client components NEVER receive heuristic body in props | `r6-channel-4.test.ts` (rendered HTML scan) | Heuristic IP via consultant-visible AND client-visible UI / PDF |

### 5.2 Test design

Both r6-channel-3 + r6-channel-4 tests use the canonical heuristic body fingerprint list maintained by Phase 6 redaction. Recursive deep scan catches:
- Heuristic body in response field at any nesting depth
- Heuristic body in SSE event payloads
- Heuristic body in rendered HTML (client + server components)
- Heuristic body in PDF HTML template (T248)

### 5.3 First-external-pilot prereq

After Phase 9 ships, ALL 4 R6 channels are live. R6.2 AES-256-GCM at rest is the v1.1 hardening layer added BEFORE first external pilot per PRD §3.2 deferred-to-v1.1 list. The 4 channels alone do NOT make the heuristic pack pilot-ready; AES at rest is also required. Phase 9 ships 4-channel enforcement; v1.1 ships R6.2.

---

## 6. ExecutiveSummary GR-007 Enforcement Surface — R5.3 + reputational risk

T245 ExecutiveSummaryGenerator makes 1 LLM call per audit ($0.10 cap, temperature=0) to generate `recommended_next_steps` (3-5 sentences). The output text is consultant-visible AND client-visible (PDF), so GR-007 deterministic regex MUST run before persist.

**Retry-then-fallback pattern:**
1. LLM call generates output
2. GR-007 regex scans for banned phrases ("increase conversions by X%", "lift CR by Y%", "boost revenue by Z%")
3. PASS → persist
4. FAIL → retry once with stricter system prompt
5. FAIL again → fallback to deterministic message ("Review the top 5 findings with your CRO consultant for prioritization. See the action plan for quick-win opportunities.")

Risk: GR-007 regex misses a banned-phrase variant (false negative); banned phrase reaches consultant + client. Mitigation: GR-007 regex maintained in Phase 7 grounding rules; Phase 0b T0B-004 lint catches at heuristic authoring (canonical regex); Phase 9 reuses; manual spot-check during T175 acceptance.

LLM call still logged to `llm_call_log` per R14.1 even on fallback (cost = LLM call cost only; fallback is free). Conformance test (AC-22 + AC-26) inspects PDF for banned-phrase absence.

---

## 7. Cost impact

| Metric | Before | After Phase 9 (50-page audit estimate) |
|---|---|---|
| Phase 9 LLM calls per audit | 0 | 1 (ExecutiveSummary `recommended_next_steps`) |
| Phase 9 LLM cost per audit | $0 | ~$0.10 (hard cap; pre-call BudgetGate) |
| Phase 9 wall-clock per audit (orchestration overhead beyond Phase 5/7/8) | — | ~5-30s (ExecutiveSummary LLM call + ActionPlan deterministic + PDF render <30s + R2 upload + email send <60s) |
| Per-audit total (Phase 5 + Phase 7 + Phase 8 + Phase 9) | $5-15 + ~10-20 min | $5.10-15.10 + ~11-21 min |
| Audit-level budget cap enforcement | Phase 8 enforces $15 cap; Phase 9 ExecutiveSummary $0.10 fits within cap | Phase 9 pre-call BudgetGate ensures `estimated_cost ≤ $0.10` |
| Cost attribution end-to-end | Phase 8 — `audit_runs.total_cost_usd` matches `SUM(llm_call_log.cost_usd)` | Phase 9 — additional 1 row per audit (executive_summary tag); per-client cost attribution via R14.4 JOIN |

Phase 9 adds ~$0.10 per audit. Trivial vs $15 cap.

---

## 8. Storage impact

| Table | Before | After Phase 9 (50-page audit estimate) |
|---|---|---|
| `audit_requests` | Phase 8 T145 first rows | Phase 9 T158 produces from CLI + Dashboard (same DDL); +1 row per audit |
| `audit_runs` | Phase 8 mutates status / completion_reason | Phase 9 ADDS executive_summary (JSONB ~5 KB) + action_plan (JSONB ~3 KB) + report_pdf_url (string); same row per audit |
| `reproducibility_snapshots` | Phase 8 T145 scaffold rows (lighter); ~5 KB | Phase 9 T160 full composition; ~7 KB (additional prompt hashes + version strings); 1 row per audit |
| `findings` | Phase 7 grounded_findings rows | Phase 9 T167 ADDS scoring fields (business_impact int, effort int, priority float, confidence float — ~32 bytes); same row count |
| `rejected_findings` | Phase 7 critique + grounding rejections | Phase 9 T168 Suppression adds confidence < 0.3 + duplicate rejections; +5-15 rows per audit |
| `finding_edits` | — | NEW; +0-N rows per audit (consultant-driven; typical 2-5) |
| `audit_log` | Phase 5/7/8 rows | Phase 9 +5-10 rows per audit (executive_summary_done, action_plan_done, report_generated, email_sent, dashboard_publish_action) |
| `audit_events` | Phase 7 + Phase 8 partial taxonomy | Phase 9 T241 completes 22-event taxonomy; +50-100 rows per audit (5 events per page × 50 pages + 10 audit-level events) |
| `llm_call_log` | Phase 7 evaluate + self_critique × 50 pages | Phase 9 +1 row per audit (executive_summary tag) |
| `notification_preferences` | — | NEW per-user; mutable; ~1 row per consultant; trivial |
| `notification_dead_letter` | — | NEW; +0-N rows on Resend failures (typical 0); 7-day retention |
| `langgraph_checkpoints` | Phase 8 per-turn rows | No change in Phase 9 |
| `heuristic_health_metrics` materialized view | — | NEW; nightly refresh; ~30 rows (one per active heuristic); ~10 KB total |
| Screenshots in R2 | Phase 7 +150 images per audit | No change in Phase 9 (no new screenshots); Phase 9 adds +1 PDF per audit (~3 MB typical) |

50-audit/day × 30 days = 1500 audits/month × ~10 KB Phase 9 incremental DB writes per audit = ~15 MB/month DB growth from Phase 9. R2: +1 PDF × 3 MB × 1500 = ~4.5 GB/month. R2 cost: ~$0.15/month. Trivial.

---

## 9. Reproducibility impact

Phase 9 owns the **CREATION** of reproducibility_snapshots via T160 SnapshotBuilder. Phase 7 honors temp=0 + prompt_hash + heuristic_pack_hash invariants via TemperatureGuard at LLMAdapter boundary; Phase 8 reads the snapshot at AuditSetupNode; Phase 9 produces it at gateway.

Replay path (full):

1. Original audit on day 1 — Gateway T158 → SnapshotBuilder.createSnapshot → DB row immutable.
2. Replay on day 2 — `pnpm cro:audit --replay <audit_run_id>` → CLI calls Gateway with replay flag → SnapshotBuilder.loadAndValidateSnapshot validates immutability (re-hash check) → passes original snapshot to AuditGraph → Phase 7 runs against same model + prompts + heuristics + ContextProfile + temp=0.
3. Compare grounded finding ID sets between original + replay: Jaccard similarity ≥ 0.9 (NF-005 / SC-005).

Phase 7 owns the temperature=0 + prompt-hash invariants; Phase 8 owns the snapshot persistence READ + AuditRequest persistence READ; Phase 9 owns the snapshot CREATION + AuditRequest CREATION + heuristic_pack_hash invariants + ContextProfile_hash invariants.

Risk: Sonnet at temp=0 isn't perfectly deterministic; 90% Jaccard target accommodates day-to-day drift. >10% drift triggers investigation per REQ-REPRO-050 (likely upstream model change, fixture drift, or schema/prompt change).

NF-06 verification: T148 fixture replay (24h delay) — Phase 9 implementation completes the replay path that Phase 8 acceptance tests assumed.

---

## 10. Documentation impact

| Doc | Change |
|---|---|
| `docs/specs/final-architecture/14-delivery-layer.md` | No change — already canonical for Phase 9 |
| `docs/specs/final-architecture/18-trigger-gateway.md` | No change — §18.4 + §18.7 + §18.8 canonical |
| `docs/specs/final-architecture/23-findings-engine-extended.md` | No change — §23.4 + §23.5 canonical |
| `docs/specs/final-architecture/24-two-store-pattern.md` | No change — canonical |
| `docs/specs/final-architecture/25-reproducibility.md` | No change — §25.3 + §25.4 canonical; T160 implements |
| `docs/specs/final-architecture/34-observability.md` | No change — canonical |
| `docs/specs/final-architecture/35-report-generation.md` | No change — canonical |
| `docs/specs/mvp/PRD.md` | F-017, F-018, F-019, F-020, F-021 already specified; no PRD change required |
| `docs/specs/mvp/tasks-v2.md` | Patch v2.3.3 → v2.3.4 if drift found this session; otherwise unchanged |
| `docs/specs/mvp/phases/INDEX.md` | v1.2 → v1.3 — Phase 9 row marked spec-shipped (this session); ★ MVP SPEC COMPLETE ★ noted |
| `docs/specs/mvp/phases/phase-8-orchestrator/impact.md` | Already references Phase 9 T160 supersession + Phase 9 downstream consumer; no change |
| `docs/specs/mvp/phases/phase-7-analysis/impact.md` | Already references Phase 9 downstream consumer; no change |
| `CLAUDE.md` | No change |

---

## 11. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| T160 SnapshotBuilder field shape divergence from Phase 8 T145 scaffold breaks T148-T150 | Medium | High | Sequential merge protocol §4; AC-05 + AC-06 conformance gate; re-run T148-T150 after T159 lands; kill criterion |
| R6 channel 3 leak via Hono response middleware bug | Medium (first activation) | High (constitutional + competitive moat) | `r6-channel-3.test.ts` recursive deep scan; `redactHeuristicBody()` middleware applied to ALL routes by default; kill criterion |
| R6 channel 4 leak via Next.js server-component prop drilling | Medium (first activation) | High (consultant + client visible) | `r6-channel-4.test.ts` rendered-HTML scan; server-only data layer for findings; kill criterion |
| ExecutiveSummary GR-007 false-negative reaches consultant + client | Low (regex maintained from Phase 7) | High (R5.3 + reputational) | Retry-then-fallback pattern; manual spot-check during T175 acceptance; tighten regex if needed |
| ExecutiveSummary $0.10 budget overrun on long inputs | Medium | Medium | Pre-call `getTokenCount()` BudgetGate; truncate top_findings to 5 hard cap; abstract pattern summaries |
| PDF render >30s on findings-heavy audit (50 pages × 5 findings each) | Medium | Medium | Optimize HTML template (no heavy images inline; lazy-load); benchmark on T149 amazon.in fixture |
| PDF size >5MB due to screenshot inclusion | Medium | Low | Downsample annotated screenshots to 1280px; reuse Phase 7 ScreenshotStorage compression |
| Email deliverability — Resend SPF/DKIM not configured for `noreply@reodigital.io` | High (first integration) | Medium | DNS config + Resend domain verification BEFORE T260 implementation; CI test inbox |
| Resend rate limit hit (100/day free tier) on bulk audit completion | Low | Low | MVP audits ≤10/day expected; upgrade if exceeded |
| WarmupManager graduation logic edge case (e.g., 3 audits with 0% rejection but consultant rejects 4th audit's findings post-graduation) | Low | Low | Documented post-graduation path: rejection_rate window slides on next 5 audits |
| AccessModeMiddleware default fail-open (route without explicit access_mode set returns internal data) | Low | High (security regression) | Default `published_only` per REQ-TWOSTORE-002 layered enforcement; conformance test (AC-08); kill criterion |
| Hono SSE stream backpressure on long audits | Low | Low | Phase 4 baseline already wires Hono SSE; reuse |
| 22-event taxonomy incomplete (some node misses an event type) | Medium | Medium | T241 conformance test asserts all 22 event_types emit on T175 run; missing → list + fix; kill criterion |
| Materialized view refresh job conflicts with active audit DB writes | Low | Low | Nightly refresh window 3 AM UTC; T242 schedules during low-traffic |
| Clerk admin role flag missing for ops dashboard testing | Medium | Low | Pre-create test admin user in Clerk dev org; document in T244 setup |
| Postmark fallback NotificationAdapter implementation drift | Low | Low | Documented as v1.1 deferred; interface stub only in MVP |
| `pnpm cro:audit --replay <id>` flag adds CLI surface beyond T159 scope | Low | Low | Documented as small extension; covered in AC-04 acceptance |
| Phase 8 T144 PostgresCheckpointer interaction with T160 snapshot replay produces stale state | Low | Medium | Replay uses fresh state; PostgresCheckpointer is for in-progress audits, not replays |
| Phase 4 schema baseline missing `audit_runs.executive_summary` JSONB column | Medium | Low | Schema migration filed as task delta during T246 implementation; coordinate with Phase 4 owner |
| Phase 0b heuristic pack changes between original audit + replay → snapshot hash mismatch | Low | Medium | Phase 0b T0B-005 commits 30-heuristic pack; subsequent edits require version bump; T160 hashes pinned at audit-time |
| ScoringPipeline non-determinism (e.g., timestamp in formula, random seed) | Low | High (reproducibility) | Pure function; SC-012 conformance test asserts 100 identical invocations; NO Date.now / Math.random |
| ExecutiveSummary LLM call retry consumes 2× $0.10 budget | Low | Low | Retry budget gate: 1 retry max; fallback is free (deterministic); cost-bounded |
| Reproducibility replay <90% finding overlap | Low | Medium | DIAGNOSTIC alert (NOT failure per REQ-REPRO-006); investigate per REQ-REPRO-050 |
| ★ MVP SPEC COMPLETE ★ delays first external pilot | Low | High (project timeline) | Buffer week in plan.md §9; T151-T155 reserved in Phase 8 may absorb early Phase 9 fixes |

---

## 12. Sign-off requirements

Per R20:

- [x] This impact.md exists (R20 hard requirement)
- [ ] Engineering lead sign-off on Phase 9 spec.md (`status: draft → validated → approved`)
- [ ] T160 SnapshotBuilder supersession protocol reviewed by Phase 8 owner BEFORE T159 implementation begins (sequential merge order §4)
- [ ] R6 channel 3 conformance test design reviewed by engineering lead BEFORE T169 implementation begins
- [ ] R6 channel 4 conformance test design reviewed by engineering lead BEFORE T171 implementation begins
- [ ] ExecutiveSummary GR-007 retry-then-fallback design reviewed by product owner BEFORE T245 implementation begins (R5.3 risk surface)
- [ ] AccessModeMiddleware fail-secure default reviewed by engineering lead BEFORE T162 implementation begins
- [ ] Resend domain SPF/DKIM verification + sandbox account provisioned in CI BEFORE T260 implementation begins
- [ ] Cloudflare R2 bucket + access keys provisioned (or local-disk fallback configured) BEFORE T249 implementation begins
- [ ] Clerk admin role flag set for test admin user BEFORE T244 implementation begins
- [ ] Phase 4 schema baseline reviewed for `audit_runs.executive_summary` (JSONB) + `audit_runs.action_plan` (JSONB) + `audit_runs.report_pdf_url` columns + `notification_preferences` table + `finding_edits` table; if missing, schema migration filed as Phase 9 task delta
- [ ] Phase 8 acceptance tests T148-T150 RE-RUN in CI after T159 + T160 land (supersession verification gate)
- [ ] Phase 7 + Phase 8 rollups (`phase-7-current.md` + `phase-8-current.md`) approved BEFORE Phase 9 implementation begins
- [ ] Phase 0b 30-heuristic pack committed (T0B-005) BEFORE T175 acceptance test runs
- [ ] T175 acceptance fixture (bbc.com 2-page) accessible from CI runner

---

## 13. Provenance (R22.2)

```yaml
why:
  source: >
    docs/specs/final-architecture/14-delivery-layer.md (canonical delivery surface)
    docs/specs/final-architecture/18-trigger-gateway.md §18.4 + §18.7 + §18.8 (AuditRequest contract + validation + persistence)
    docs/specs/final-architecture/23-findings-engine-extended.md §23.4 + §23.5 (4D scoring + suppression)
    docs/specs/final-architecture/24-two-store-pattern.md (two-store + warm-up)
    docs/specs/final-architecture/25-reproducibility.md §25.3 + §25.4 (snapshot composition + replay)
    docs/specs/final-architecture/34-observability.md (Pino + audit_events + alerting + ops dashboard)
    docs/specs/final-architecture/35-report-generation.md (Executive Summary + Action Plan + PDF)
    docs/specs/mvp/constitution.md R5.3 + GR-007 (no conversion predictions on ExecutiveSummary output)
    docs/specs/mvp/constitution.md R6 (heuristic IP — channels 3 + 4 first activation)
    docs/specs/mvp/constitution.md R8.1 + R10 + R13 + R14.1 (cost + reproducibility + cost attribution)
    docs/specs/mvp/PRD.md F-017 (Executive Summary + Action Plan) + F-018 (PDF) + F-019 (Dashboard) + F-020 (Email) + F-021 (cost accounting)
  evidence: >
    Phase 9 introduces THREE NEW shared producer contracts (AuditRequest first runtime,
    ScoredFinding extension, PatternFinding consumer pattern) and SUPERSEDES Phase 8 T145
    reproducibility_snapshot scaffold. R20 mandates impact analysis on each.
    Phase 9 activates THE FINAL TWO of FOUR R6 enforcement channels at runtime
    (channel 3 — Hono API responses; channel 4 — Next.js dashboard rendering). Each first
    activation is a critical R20 surface — a leak compromises competitive moat at the
    consultant-visible AND client-visible boundary (PDF + dashboard).
    Phase 9 introduces 1 new LLMAdapter call tag (executive_summary) joining the
    temp=0 invariant under R10/R13 + TemperatureGuard. Phase 9 introduces 2 new adapter
    interfaces (DiscoveryStrategy, NotificationAdapter) per R9 (Loose Coupling).
    Phase 9 = ★ MVP SPEC COMPLETE ★ gate — failure here delays first external pilot;
    success unblocks all 14 predecessor phases for implementation start at Phase 0.
  linked_failure: >
    Anticipated risk class — multi-surface phase combining (a) shared-contract supersession
    (T160 vs T145 scaffold), (b) first-runtime constitutional invariant activation (R6
    channels 3 + 4), (c) consultant + client-visible LLM output (ExecutiveSummary GR-007),
    (d) deterministic scoring pipeline reproducibility (SC-012), (e) cross-cutting access
    mode middleware (fail-secure default). Historical pattern: phases that combine multiple
    first-activations are under-tested at integration boundary; Phase 9 ships 4 conformance
    tests (AC-05 + AC-06 + AC-22 + AC-36) + 1 acceptance test (T175) as layered defense.
```
