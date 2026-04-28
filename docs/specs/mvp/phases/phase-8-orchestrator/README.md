---
title: Phase 8 — Audit Orchestrator + Cross-Page — README
artifact_type: readme
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
---

# Phase 8 — Audit Orchestrator + Cross-Page

> **Summary (~150 tokens — agent reads this first):** The audit-level orchestrator. **21 tasks (T135-T155)** wire BrowseGraph (Phase 5/5b) + AnalysisGraph (Phase 7) into a single AuditGraph using LangGraph subgraphs, drive a multi-page audit end-to-end via CLI (`pnpm cro:audit`), persist findings + screenshots + reproducibility snapshot, and produce ConsoleReporter + JsonReporter output. **AuditState extension** (T135) MUST add `context_profile_id` + `context_profile_hash` slots (Phase 4b T4B-011 prereq) plus §5.7 v2.0 fields (trigger_source, audit_request_id, state_graph, multi_state_perception, exploration_*, finding_rollups, reproducibility_snapshot, published_finding_ids, warmup_mode_active). **Cross-page PatternDetector** (folded into T139 AuditCompleteNode per F-014) groups grounded findings by heuristic_id; 3+ pages violating same heuristic → one PatternFinding. **Reproducibility snapshot** loaded by AuditSetupNode (creation is Phase 9 T160 / Gateway). Three ★★ acceptance tests (example.com, amazon.in, bbc.com) are the **MVP COMPLETE gate**.

---

## What's in this folder

| File | Purpose |
|---|---|
| `spec.md` | Full feature spec (P1-P4 user stories, AC-01..AC-21, R-01..R-13, NF-01..NF-06) |
| `plan.md` | Sequencing (3 sub-blocks), AuditState coordination with Phase 4b/Phase 7, cross-page PatternDetector design, MVP COMPLETE gate, kill criteria |
| `tasks.md` | T135-T155 phase-scoped view (canonical defs in `tasks-v2.md` Phase 8 section + archived walking-skeleton `tasks.md`) |
| `impact.md` | R20 impact analysis — **HIGH risk** (AuditState extension; cross-page synthesis producer; reproducibility composition; PatternFinding contract introduction) |
| `checklists/requirements.md` | Spec-quality checklist |

---

## Quick links

- **Architecture spec (canonical):** [`docs/specs/final-architecture/04-orchestration.md`](../../../final-architecture/04-orchestration.md) (orchestrator graph) + [`05-unified-state.md`](../../../final-architecture/05-unified-state.md) (AuditState schema + §5.7 extensions)
- **Reproducibility spec:** [`docs/specs/final-architecture/25-reproducibility.md`](../../../final-architecture/25-reproducibility.md) (snapshot composition + replay)
- **Cross-page spec:** [`docs/specs/final-architecture/07-analyze-mode.md`](../../../final-architecture/07-analyze-mode.md) §7.13 (PageSignals emission) + PRD F-014 (PatternDetector behavior)
- **Trigger gateway spec:** [`docs/specs/final-architecture/18-trigger-gateway.md`](../../../final-architecture/18-trigger-gateway.md) (AuditRequest contract)
- **Canonical tasks:** [`docs/specs/mvp/tasks-v2.md`](../../tasks-v2.md) Phase 8 section (T135 v2.0 / T137 v2.0 / T138 v2.1 / T145 v2.0 / T148-T150 v2.0 mods) + archived walking-skeleton `tasks.md` (unchanged baseline T135-T155)
- **Predecessor phases:**
  - Phase 5 BrowseGraph (subgraph 1)
  - Phase 7 AnalysisGraph (subgraph 2 — produces Findings + PageSignals)
  - Phase 4b ContextCapture (T4B-011 AuditState slot prereq)
  - Phase 6 HeuristicLoader (Stage 1 + Stage 2 filter integration)
- **Successor phase:** Phase 9 Foundations + Delivery (Executive Summary, Action Plan, PDF, Email, Dashboard)

---

## Status

| Field | Value |
|---|---|
| Status | ⚪ Not started |
| Depends on | Phase 7 (AnalysisGraph + Finding lifecycle) — REQUIRED. Phase 5 (BrowseGraph) — REQUIRED. Phase 4b (T4B-011 AuditState slot) — REQUIRED. Phase 6 (HeuristicLoader) — REQUIRED. Phase 5b (multi-viewport) — OPTIONAL |
| Blocks | Phase 9 (Foundations + Delivery) — consumes findings + audit_runs + audit_complete state for Executive Summary, Action Plan, PDF report, Email, Dashboard |
| Estimated effort | ~6-8 engineering days (orchestration wiring + 3 acceptance tests on real sites) |
| Token impact | None new (orchestrator emits no LLM calls; Phase 7 owns all LLM cost) |
| Cost impact | Audit-level budget cap $15 (R8.1) — enforced by gateway snapshot + per-page $5 cap (R8.2) from Phase 7 |
| Affected contracts | AuditState (PRODUCER + CONSUMER — extended); PageSignals (CONSUMER); PatternFinding (PRODUCER — NEW per F-014); reproducibility_snapshot (CONSUMER — read; Phase 9 produces); audit_runs (PRODUCER — created by gateway/CLI); AuditRequest (CONSUMER); checkpointer state (PRODUCER) |
| Risk level | **HIGH** — AuditState extension touches Phase 4b T4B-011 + Phase 7 T113 + Phase 8 T135 in coordinated fashion; cross-page PatternDetector is the F-014 producer; reproducibility composition is the foundation for F-015 NF-006 90% finding-overlap acceptance; MVP COMPLETE gate (T148-T150) hangs on Phase 8 |
| MVP COMPLETE gate | T148 (example.com), T149 (amazon.in), T150 (bbc.com) all pass = MVP shippable |
