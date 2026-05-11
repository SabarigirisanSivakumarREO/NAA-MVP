---
title: Phase 1b — Perception Extensions (PageStateModel extension) — README
artifact_type: readme
status: implemented
version: 0.2
created: 2026-04-28
updated: 2026-05-09
owner: engineering lead
---

# Phase 1b — Perception Extensions (PageStateModel extension)

> **Summary (~160 tokens — agent reads this first):** Extend Phase 1's `PageStateModel` with 10 new field groups: `pricing`, `clickTargets[]`, `stickyElements[]`, `popups[]` (presence-only; 11-type enum per v0.2), `frictionScore`, `socialProofDepth`, `microcopy.nearCtaTags[]`, `attention`, `commerce`, `metadata.currencySwitcher`. **Path B (Gate 1 REVISE 2026-05-09):** T1B-000 first extends PageStateModel with substrate fields (`ctas[]`, `formFields[]`, `metadata.schemaOrg`, `metadata.ogTags`, `headings[]`, `primaryActions`) that the 10 downstream extractors read via `ExtractCtx`. All extractions live inside `ContextAssembler.capture()`'s single `page.evaluate()` call — zero new LLM calls. Phase 1b's ~1.5K token delta absorbed into Phase 1's 20K NF-Phase1-01 v0.4 budget (cap unchanged). 13 tasks (T1B-000..T1B-012). Runs weeks 3-4 per PD-01 RESOLVED 2026-05-08. Popup BEHAVIOR fields + multi-viewport diff are Phase 5b — Phase 1b is presence + size + structure only.

---

## What's in this folder

| File | Purpose |
|---|---|
| `spec.md` | Full feature spec (P1-P4 user stories, AC-00..AC-12, R-00..R-11, NF-01..NF-04) |
| `plan.md` | Implementation plan: sequencing (Day 0 substrate first per Path B), file layout, ExtractCtx interface, FrictionScorer formula, kill criteria, effort estimate |
| `tasks.md` | T1B-000..T1B-012 phase-scoped view (T1B-001..T1B-012 canonical in `tasks-v2.md` lines 176-251; T1B-000 added in this phase per Path B; pending v2.3.4 alignment) |
| `impact.md` | R20 impact analysis — required because PageStateModel is a shared contract. Includes §11 Namespace contract (closes Phase 1 rollup §5 carry-forward). |
| `review-notes.md` | R17.4 phase review Pass 1 (Gate 1 REVISE 2026-05-09) |

---

## Quick links

- **Source improvement spec:** [`docs/Improvement/perception_layer_spec.md`](../../../../Improvement/perception_layer_spec.md) (gap-closure items 1-10)
- **Architecture spec:** [`docs/specs/final-architecture/07-analyze-mode.md`](../../../final-architecture/07-analyze-mode.md) §7.9.2 *(legacy "AnalyzePerception" name; implementation lives as `PageStateModel` per types.ts — rewrite queued for v2.3.4 punch-list)*
- **Canonical tasks:** [`docs/specs/mvp/tasks-v2.md`](../../tasks-v2.md) lines 176-251 (T1B-001..T1B-012; T1B-000 pending v2.3.4 alignment)
- **Predecessor phase:** [`docs/specs/mvp/phases/phase-1-perception/`](../phase-1-perception/) — `PageStateModel` canonical surface per `phase-1-current.md` rollup
- **Successor phase:** Phase 1c (PerceptionBundle envelope) wraps the extended PageStateModel in a multi-state envelope

---

## Status

| Field | Value |
|---|---|
| Status | ⚪ Not started (spec at validated v0.2; awaiting Pass 2 AI Reviewer + Gate 1 APPROVE stamp) |
| Depends on | Phase 1 implemented (T006-T015 + rollup approved — ✅ done 2026-05-09) |
| Blocks | Phase 6 heuristic authoring against extended PageStateModel fields, Phase 5b popup behavior, Phase 7 LLM evaluate (token budget headroom), Phase 4b T4B-013 ContextProfile filter (commerce + schemaOrg upstream) |
| Estimated effort | ~13.5h ±2.5 (single engineer; T1B-000 substrate adds 2.5h to v0.1's 11h baseline) |
| Token impact | +~1.5K Phase 1b delta absorbed into Phase 1's 20K NF-Phase1-01 v0.4 cap (unchanged) |
| Cost impact | $0 — zero new LLM calls |
| Affected contracts | `PageStateModel` (additive only at top-level / inside `metadata`; backward-compatible; `_extensions` namespace NOT touched per impact.md §11) |
