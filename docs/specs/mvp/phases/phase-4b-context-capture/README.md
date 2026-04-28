---
title: Phase 4b — Context Capture Layer v1.0 — README
artifact_type: readme
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
---

# Phase 4b — Context Capture Layer v1.0

> **Summary (~150 tokens — agent reads this first):** Pre-perception "consultant intake form, automated where possible." Captures 5 context dimensions (business / page / audience / traffic / brand). Every field is `{value, source, confidence}` — no silent defaults. Two input paths: explicit (user intake) and inferred (URL pattern + lightweight HTML fetch + JSON-LD; **no Playwright** per R25). Confidence thresholds gate audit progress: ≥0.9 act, 0.6-0.9 use+flag, <0.6 ask. Blocking questions surface to the CLI before perception runs. Output `ContextProfile` is hashed (SHA-256), pinned to a new append-only `context_profiles` table, and consumed by the HeuristicLoader to filter heuristics down to 12-25 relevant rules per audit (cuts Phase 7 LLM cost ~60-70%). Fifteen tasks (T4B-001..T4B-015). Cost: ~$0.01/audit. R25 forbids Playwright, judgment fields, silent defaults, and LLM calls inside this layer in MVP.

---

## What's in this folder

| File | Purpose |
|---|---|
| `spec.md` | Full feature spec (P1-P5 user stories, AC-01..AC-15, R-01..R-15, NF-01..NF-06) |
| `plan.md` | Implementation plan: sequencing, ConfidenceScorer weights, archetype signal weighting, R25 enforcement points, kill criteria, effort estimate |
| `tasks.md` | T4B-001..T4B-015 phase-scoped view (canonical defs in `tasks-v2.md` lines 476-568) |
| `impact.md` | R20 impact analysis — required because multiple shared contracts are extended/added |

---

## Quick links

- **Source improvement spec:** [`docs/Improvement/context_capture_layer_spec.md`](../../../../Improvement/context_capture_layer_spec.md) (full design rationale; items 1-6 adopted)
- **Architecture spec:** [`docs/specs/final-architecture/37-context-capture-layer.md`](../../../final-architecture/37-context-capture-layer.md)
- **Intake schema spec:** [`docs/specs/final-architecture/18-trigger-gateway.md`](../../../final-architecture/18-trigger-gateway.md) §18
- **Data layer spec:** [`docs/specs/final-architecture/13-data-layer.md`](../../../final-architecture/13-data-layer.md)
- **Canonical tasks:** [`docs/specs/mvp/tasks-v2.md`](../../tasks-v2.md) lines 476-568
- **Predecessor phase:** Phase 4 (refreshed) ships robots/ToS utility + T070 DB baseline (prereq for T4B-003 + T4B-012)
- **Successor phase:** Phase 6 (refreshed) consumes `loadForContext()` from T4B-013

---

## Status

| Field | Value |
|---|---|
| Status | ⚪ Not started |
| Depends on | Phase 4 refresh (robots/ToS utility + T070+T080 DB) ships; Phase 0b heuristic-authoring schedules `archetype/page_type/device` manifest selectors |
| Blocks | Phase 6 refresh (consumes loadForContext); Phase 7 EvaluateNode cost reduction; Phase 8 AuditState `context_profile_*` slots |
| Estimated effort | ~22.5h ±3 (single engineer) |
| Token impact | +5K to ContextProfile (new envelope; not part of perception bundle) |
| Cost impact | +~$0.01/audit (HTTP fetch only; no LLM); expected NET COST DECREASE after Phase 7 ships heuristic-filter savings |
| Affected contracts | `ContextProfile` (new); `AuditState` + `AuditRequest` + `HeuristicLoader` extended; `context_profiles` table new |
| Constitution rule enforced | R25 (Context Capture MUST NOT) — T4B-014 enforces |
