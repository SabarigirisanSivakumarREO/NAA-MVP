---
title: Phase 7 — Analysis Pipeline — README
artifact_type: readme
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
---

# Phase 7 — Analysis Pipeline

> **Summary (~150 tokens — agent reads this first):** The analytical apex of the MVP. **22 tasks** (T113-T134) implement the 5-step pipeline: `deep_perceive → evaluate → self_critique → ground → annotate_and_store`. **First runtime activation** of: (a) Constitution R10/R13 TemperatureGuard at temperature=0 (`evaluate` + `self_critique` calls); (b) R6 IP boundary's LangSmith trace channel (heuristic content marked private metadata); (c) the Finding lifecycle producer (Raw → Reviewed → Grounded / Rejected). EvaluateNode injects context-filtered heuristics from Phase 4b `loadForContext()` into the LLM user message (R5.5). SelfCritiqueNode is a SEPARATE LLM call with a different persona (R5.6). EvidenceGrounder runs 8 MVP grounding rules (GR-001..GR-008) + GR-012 benchmark validation = 9 deterministic checks. Per-page budget cap $5 (R8.2); pre-call BudgetGate + atomic llm_call_log writes (R14). Reads ContextProfile (Phase 4b) + filtered heuristic pack (Phase 6 + 4b T4B-013) + PerceptionBundle (Phase 1c; multi-bundle when Phase 5b active).

---

## What's in this folder

| File | Purpose |
|---|---|
| `spec.md` | Full feature spec (P1-P5 user stories, AC-01..AC-22, R-01..R-15, NF-01..NF-08) |
| `plan.md` | Implementation plan: sequencing (3 sub-blocks), R10/R5.6 first-activation strategy, kill criteria, effort estimate |
| `tasks.md` | T113-T134 phase-scoped view (canonical defs in `tasks-v2.md` + archived walking-skeleton `tasks.md`) |
| `impact.md` | R20 impact analysis — **HIGH risk** (first temp=0 + first LangSmith channel + Finding lifecycle producer + 5 contract surfaces) |
| `checklists/requirements.md` | Spec-quality checklist |

---

## Quick links

- **Architecture spec (canonical):** [`docs/specs/final-architecture/07-analyze-mode.md`](../../../final-architecture/07-analyze-mode.md) §7.3-7.13 (pipeline graph, 5 nodes, grounding rules, quality gate, recovery, persona, cross-page)
- **Heuristic engine spec:** [`docs/specs/final-architecture/09-heuristic-kb.md`](../../../final-architecture/09-heuristic-kb.md) §9.1, §9.6 two-stage filter
- **Canonical tasks:** [`docs/specs/mvp/tasks-v2.md`](../../tasks-v2.md) Phase 7 section + archived walking-skeleton `tasks.md` (T113-T134 unchanged from v1.0 except T114 + T117 v2.3 mods)
- **Predecessor phases:**
  - Phase 1c PerceptionBundle envelope (DeepPerceiveNode reads via accessor)
  - Phase 4b ContextCapture (EvaluateNode reads ContextProfile via accessor; T4B-013 `loadForContext()`)
  - Phase 5b multi-viewport / triggers / cookie (multi-bundle iteration when active)
  - Phase 6 Heuristic KB engine (HeuristicLoader + 2-stage filter + DecryptionAdapter)
- **Successor phase:** Phase 8 Orchestrator + Cross-Page (consumes Findings + cross-page PageSignals)

---

## Status

| Field | Value |
|---|---|
| Status | ⚪ Not started |
| Depends on | Phase 5 (browse mode) + Phase 6 (heuristic engine) + Phase 1c (PerceptionBundle accessor) + Phase 4b (ContextProfile + `loadForContext()`) — REQUIRED. Phase 5b (multi-viewport) — OPTIONAL (Phase 7 supports both single-bundle and multi-bundle paths) |
| Blocks | Phase 8 (Orchestrator + Cross-Page) — Findings producer; Phase 9 Delivery (consumes Findings for Executive Summary, Action Plan, PDF report) |
| Estimated effort | ~7-9 engineering days (largest spec; ~22 tasks across analysis core + grounding + annotation + storage + integration) |
| Token impact | Per-page evaluate prompt ~12-32K input (perception + heuristics + persona + system) → ~2-4K output; self-critique ~8-12K input → ~1-2K output |
| Cost impact | Per-page budget cap $5 (R8.2) — evaluate + self-critique + retries; budget gate enforces |
| Affected contracts | AnalyzePerception (CONSUMER); Finding lifecycle (PRODUCER — Raw → Reviewed → Grounded / Rejected); AuditState analyze fields (PRODUCER); audit_log + audit_events + llm_call_log (PRODUCER); R10 TemperatureGuard (FIRST activation); R6 LangSmith channel (FIRST activation) |
| Risk level | **HIGH** — analytical apex; multiple cross-cutting first activations; Finding lifecycle producer; LLM cost surface; GR-007 is the last line of defense against R5.3 |
