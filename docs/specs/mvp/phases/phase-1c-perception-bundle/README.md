---
title: Phase 1c — PerceptionBundle Envelope v2.5 — README
artifact_type: readme
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
---

# Phase 1c — PerceptionBundle Envelope v2.5

> **Summary (~150 tokens — agent reads this first):** Wrap `AnalyzePerception` v2.4 inside a `PerceptionBundle` envelope that adds shared element identity (`ElementGraph` of `FusedElement`s keyed by stable `element_id`), `meta` + `performance` + `nondeterminism_flags` + `warnings` + `state_graph` for honest output, Shadow DOM / React Portal / pseudo-element / iframe-policy / hidden-element traversal extensions, and a 5-second-capped settle predicate (network idle + DOM mutation stop + fonts ready + animations done). All AnalyzePerception fields preserved and accessible via `bundleToAnalyzePerception(bundle)`. Twelve tasks (T1C-001..T1C-012). Token impact: per-state bundle ≤8.5K. Cost impact: zero LLM calls; ~+200ms per state. Three direct-call-site edits required (EvaluateNode + AnnotateAndStore + DeepPerceiveNode); all other consumers unchanged via accessor helper.

---

## What's in this folder

| File | Purpose |
|---|---|
| `spec.md` | Full feature spec (P1-P4 user stories, AC-01..AC-12, R-01..R-12, NF-01..NF-05) |
| `plan.md` | Implementation plan: sequencing, settle composition, ElementGraph stability rules, IframePolicyEngine classifier, kill criteria, effort estimate |
| `tasks.md` | T1C-001..T1C-012 phase-scoped view (canonical defs in `tasks-v2.md` lines 254-329) |
| `impact.md` | R20 impact analysis — required because PerceptionBundle is a new shared contract and `deep_perceive` output type changes |

---

## Quick links

- **Source improvement spec:** [`docs/Improvement/perception_layer_spec.md`](../../../../Improvement/perception_layer_spec.md) (build-order items 1, 2, 6 + Shadow DOM / iframe / pseudo-element)
- **Architecture spec:** [`docs/specs/final-architecture/07-analyze-mode.md`](../../../final-architecture/07-analyze-mode.md) §7.9.3
- **Browse traversal spec:** [`docs/specs/final-architecture/06-browse-mode.md`](../../../final-architecture/06-browse-mode.md) §6.6 v2.5
- **Canonical tasks:** [`docs/specs/mvp/tasks-v2.md`](../../tasks-v2.md) lines 254-329
- **Predecessor phase:** [`docs/specs/mvp/phases/phase-1b-perception-extensions/`](../phase-1b-perception-extensions/)
- **Successor phase:** Phase 2 (MCP tools) consumes the bundle via `page_analyze` / `deep_perceive`

---

## Status

| Field | Value |
|---|---|
| Status | ⚪ Not started |
| Depends on | Phase 1b ships and rollup approved; T013 ContextAssembler; T117 DeepPerceiveNode skeleton (Phase 7) — forward-stub OK |
| Blocks | Phase 7 EvaluateNode token budget calibration; multi-state interaction discovery (Phase 13 master track) |
| Estimated effort | ~16h ±2 (single engineer) |
| Token impact | per-state bundle ≤8.5K (was AnalyzePerception ≤6.5K standalone) |
| Cost impact | $0 — zero new LLM calls |
| Affected contracts | `PerceptionBundle` (new); `AnalyzePerception` + `PageStateModel` wrapped only; `deep_perceive` return type changes (accessor helper provided) |
