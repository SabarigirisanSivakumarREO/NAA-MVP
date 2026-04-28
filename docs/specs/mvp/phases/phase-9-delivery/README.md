---
title: Phase 9 — Foundations + Delivery — README (★ MVP SPEC COMPLETE ★)
artifact_type: readme
status: draft
version: 0.1
created: 2026-04-29
updated: 2026-04-29
owner: engineering lead
---

# Phase 9 — Foundations + Delivery

> **Summary (~150 tokens — agent reads this first):** The final MVP phase. **35 tasks** across 6 sub-blocks: Block A foundations (T156-T168 — AuditRequest contract, Gateway service sync MVP, **T160 SnapshotBuilder REPLACES Phase 8 T145 scaffold**, TemperatureGuard, two-store + warm-up, 4D scoring), Block B dashboard (T169-T173 — Next.js 15 + shadcn + Tailwind + Clerk; review/audits/finding-detail/clients pages — **R6 channel 4 first activation**), Block C delivery (T245-T249 — Executive Summary 1 LLM call $0.10 cap with GR-007 retry-then-fallback, Action Plan deterministic 4-quadrant, branded PDF Playwright `page.pdf()` 8 sections ≤5MB R2 storage), Block D adapters (T256-T257 DiscoveryStrategy Sitemap + Manual; T260-T261 NotificationAdapter Resend), Block E observability (T239-T243 Pino + 22-event audit_events taxonomy + heuristic_health_metrics + alerting), Block F acceptance + ops dashboard LAST (T174-T175, T244 admin-only). **R6 channels 3 + 4 first runtime activation** (Hono API + Next.js render — heuristic body NEVER serialized; only IDs). **★ MVP SPEC COMPLETE ★** when this phase ships → all 4 R6 channels live → first external pilot prereq satisfied (with v1.1 R6.2 AES at-rest hardening) → implementation can start at Phase 0.

---

## What's in this folder

| File | Purpose |
|---|---|
| `spec.md` | Full feature spec (5 user stories, AC-01..AC-37, R-01..R-22, NF-01..NF-13) |
| `plan.md` | Sequencing (6 sub-blocks A→F), T160 supersession protocol, R6 channels 3+4 activation surface, ExecutiveSummary GR-007 enforcement, ★ MVP SPEC COMPLETE ★ acceptance gate, kill criteria |
| `tasks.md` | T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261 phase-scoped view (canonical defs in `tasks-v2.md` Phase 9 sections) |
| `impact.md` | R20 impact analysis — **HIGH risk** (T160 supersedes Phase 8 T145; R6 channels 3+4 first activation; ExecutiveSummary GR-007; AccessModeMiddleware fail-secure default; ★ MVP SPEC COMPLETE gate ★) |
| `checklists/requirements.md` | Spec-quality checklist |

---

## Quick links

- **Architecture specs (canonical):**
  - [`docs/specs/final-architecture/14-delivery-layer.md`](../../../final-architecture/14-delivery-layer.md) (dashboard + API + SSE + PDF + ops dashboard + NotificationAdapter)
  - [`docs/specs/final-architecture/18-trigger-gateway.md`](../../../final-architecture/18-trigger-gateway.md) §18.4 (AuditRequest contract) + §18.7 (validation) + §18.8 (persistence handoff)
  - [`docs/specs/final-architecture/23-findings-engine-extended.md`](../../../final-architecture/23-findings-engine-extended.md) §23.4 (4D scoring) + §23.5 (suppression)
  - [`docs/specs/final-architecture/24-two-store-pattern.md`](../../../final-architecture/24-two-store-pattern.md) (two-store + warm-up)
  - [`docs/specs/final-architecture/25-reproducibility.md`](../../../final-architecture/25-reproducibility.md) §25.3 + §25.4 (snapshot composition + replay)
  - [`docs/specs/final-architecture/34-observability.md`](../../../final-architecture/34-observability.md) (Pino + audit_events + alerting + ops dashboard)
  - [`docs/specs/final-architecture/35-report-generation.md`](../../../final-architecture/35-report-generation.md) (Executive Summary + Action Plan + PDF)
- **Canonical tasks:** [`docs/specs/mvp/tasks-v2.md`](../../tasks-v2.md) Phase 9 sections
- **Predecessor phases:**
  - Phase 8 Orchestrator + Cross-Page (AuditCompleteNode T139 — extended at T246 + T261; CLI T145 — refactored at T159; reproducibility_snapshot scaffold — superseded by T160)
  - Phase 7 AnalysisGraph (Finding lifecycle producer — extended at T167 scoring + T164 two-store; PageSignals + PatternFinding consumer pattern)
  - Phase 6 HeuristicLoader (heuristic_pack_hash input to T160; Pino redaction list canonical for R6 channels 3+4 conformance tests)
  - Phase 4b ContextProfile (ContextProfile_hash input to T160)
  - Phase 4 schema baseline (T070 — DB DDL; may need migration for `audit_runs.executive_summary` + `audit_runs.action_plan` + `audit_runs.report_pdf_url` + `notification_preferences` + `finding_edits` if not pre-defined)
- **Successor phase:** ★ MVP SPEC COMPLETE ★ — Phase 9 is the LAST MVP phase. After this ships → MVP shippable for first external pilot (with v1.1 R6.2 AES at-rest hardening). Implementation can begin at Phase 0.

---

## Status

| Field | Value |
|---|---|
| Status | ⚪ Not started |
| Depends on | Phase 8 (AuditGraph + CLI + reproducibility_snapshot scaffold) — REQUIRED. Phase 7 (AnnotateNode + StoreNode + Finding lifecycle producer) — REQUIRED. Phase 6 (HeuristicLoader + Pino redaction list) — REQUIRED. Phase 4b (ContextProfile) — REQUIRED. Phase 4 schema baseline — REQUIRED. Phase 0b (30-heuristic pack) — REQUIRED for T175 acceptance fixture. Phase 5b (multi-viewport) — OPTIONAL |
| Blocks | ★ MVP SPEC COMPLETE ★ — implementation can start at Phase 0 once Phase 9 ships |
| Estimated effort | ~10-12 engineering days (35 tasks across 6 sub-blocks) |
| Token impact | +1 LLM call per audit (ExecutiveSummary, $0.10 cap, GR-007 enforced) |
| Cost impact | +$0.10 per audit (ExecutiveSummary). Trivial vs $15 audit cap. R2 storage +$0.15/month at 50 audits/day. |
| Affected contracts | AuditRequest (PRODUCER first runtime); reproducibility_snapshot (PRODUCER — T160 SUPERSEDES Phase 8 T145 scaffold); ScoredFinding (PRODUCER); audit_runs (PRODUCER + CONSUMER); finding_edits (PRODUCER NEW); audit_events 22-event taxonomy (PRODUCER first full activation); notification_preferences (PRODUCER NEW); DiscoveryStrategy (PRODUCER NEW interface); NotificationAdapter (PRODUCER NEW interface); LLMAdapter `executive_summary` tag (NEW); heuristic_health_metrics materialized view (PRODUCER NEW); Hono API + Next.js render (PRODUCERS — first R6 channels 3+4 runtime) |
| Risk level | **HIGH** — T160 supersession of Phase 8 T145 scaffold; R6 channels 3+4 first activation (consultant + client visible); ExecutiveSummary GR-007 enforcement (R5.3 + reputational); AccessModeMiddleware fail-secure default; ★ MVP SPEC COMPLETE gate ★ |
| ★ MVP SPEC COMPLETE gate ★ | AC-21 (T175 acceptance) + AC-26 (PDF) + AC-30 (email) + AC-36 (R6 ch3+4) all green = MVP shippable for first external pilot |
| First external pilot prereq | All 4 R6 channels live (Pino Phase 6 + LangSmith Phase 7 + Hono API Phase 9 + Next.js render Phase 9) AND v1.1 R6.2 AES-256-GCM at-rest hardening |

---

## Why this phase is the MVP completion gate

Phase 9 is what turns the audit pipeline (Phases 1-8) into a **shippable consultant-deliverable product**:

- **Without Phase 9**: pipeline produces grounded findings in DB; no PDF; no consultant UI; no email; no scoring; no warm-up safety; reproducibility_snapshot is a placeholder.
- **With Phase 9**: PDF report delivered; dashboard review workflow live; email notifications fired; 4D scored findings sorted by priority; warm-up gates auto-publish; reproducibility_snapshot fully composed for replay; observability (Pino + audit_events + alerting + ops dashboard) live.

After Phase 9 ships → MVP shippable. Phases 10-13 (state exploration, mobile viewport, etc.) are post-MVP per master plan.

---

## Sub-block dependency graph

```
Block A foundations (T156-T168) — sequential within
  ↓
Block B dashboard (T171 → T169 → T170 → T172 → T173) — sequential
  ↓
Block C delivery (T245 → T246 → T247 → T248 → T249) — sequential
  ↓
Block D adapters (T256 → T257; T260 → T261) — parallel pairs
  ↓
Block E observability (T239 → T240 → T241 → T242 → T243) — sequential
  ↓
Block F acceptance + ops dashboard (T174 → T175; T244 LAST) — sequential
  ↓
★ MVP SPEC COMPLETE ★
```

Block A must land first (Gateway + SnapshotBuilder + ScoringPipeline are foundations for everything else). Blocks B/C/D/E can partially overlap if engineering capacity allows. Block F runs LAST.

---

## Reading order for someone picking up Phase 9

1. **This README** (you are here)
2. `spec.md` — full feature spec (35 ACs, 22 R-NN, 13 NF-NN)
3. `tasks.md` — 35 tasks scoped view (canonical defs in tasks-v2.md)
4. `plan.md` — sequencing, T160 supersession protocol §2, R6 channels 3+4 activation §3, ExecutiveSummary GR-007 §4, kill criteria §7
5. `impact.md` — R20 HIGH-risk surface analysis; sign-off requirements §12
6. `checklists/requirements.md` — spec-quality verification

For implementation: start at Block A T156 (AuditRequest contract). Don't start Block B until T156-T168 land + AC-05 + AC-06 conformance gate green.
