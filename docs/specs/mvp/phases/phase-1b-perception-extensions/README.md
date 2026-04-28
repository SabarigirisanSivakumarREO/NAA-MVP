---
title: Phase 1b — Perception Extensions v2.4 — README
artifact_type: readme
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
---

# Phase 1b — Perception Extensions v2.4

> **Summary (~150 tokens — agent reads this first):** Extend `AnalyzePerception` v2.3 → v2.4 by adding 10 new field groups: `pricing`, `clickTargets[]`, `stickyElements[]`, `popups[]` (presence-only), `frictionScore`, `socialProofDepth`, `microcopy.nearCtaTags[]`, `attention`, `commerce`, `metadata.currencySwitcher`. All extractions live inside the same single `page.evaluate()` call as v2.3 — zero new LLM calls, +1.5K tokens (5K → 6.5K, under 8K cap). Twelve tasks (T1B-001..T1B-012). Closes 9 perception gaps from the master-checklist coverage audit + currency-switcher gap. Runs week 2-3, after Phase 1 (v2.3 baseline) ships, before Phase 2 (MCP tools). Popup BEHAVIOR fields and multi-viewport diff are Phase 5b — Phase 1b is presence + size + structure only.

---

## What's in this folder

| File | Purpose |
|---|---|
| `spec.md` | Full feature spec (P1-P4 user stories, AC-01..AC-12, R-01..R-11, NF-01..NF-04) |
| `plan.md` | Implementation plan: sequencing, file layout, FrictionScorer formula, kill criteria, effort estimate |
| `tasks.md` | T1B-001..T1B-012 phase-scoped view (canonical defs in `tasks-v2.md` lines 176-251) |
| `impact.md` | R20 impact analysis — required because AnalyzePerception is a shared contract |

---

## Quick links

- **Source improvement spec:** [`docs/Improvement/perception_layer_spec.md`](../../../../Improvement/perception_layer_spec.md) (gap-closure items 1-10)
- **Architecture spec:** [`docs/specs/final-architecture/07-analyze-mode.md`](../../../final-architecture/07-analyze-mode.md) §7.9.2
- **Canonical tasks:** [`docs/specs/mvp/tasks-v2.md`](../../tasks-v2.md) lines 176-251
- **Predecessor phase:** [`docs/specs/mvp/phases/phase-1-perception/`](../phase-1-perception/) (v2.3 baseline)
- **Successor phase:** Phase 1c (PerceptionBundle envelope) wraps the v2.4 schema in a multi-state envelope

---

## Status

| Field | Value |
|---|---|
| Status | ⚪ Not started |
| Depends on | Phase 1 (T006-T015 ship and rollup approved) |
| Blocks | Phase 6 heuristic authoring against v2.4 fields, Phase 5b popup behavior, Phase 7 LLM evaluate (token budget impact) |
| Estimated effort | ~11h ±2 (single engineer) |
| Token impact | +1.5K to AnalyzePerception (5K → 6.5K, cap 8K) |
| Cost impact | $0 — zero new LLM calls |
| Affected contracts | `AnalyzePerception` (additive only, backward-compatible) |
