---
title: Phase 5b — Multi-Viewport + Triggers + Cookie — README
artifact_type: readme
status: draft
version: 0.3
created: 2026-04-28
updated: 2026-05-17
owner: engineering lead
---

# Phase 5b — Multi-Viewport + Trigger Taxonomy + Cookie Policy

> **Summary (~150 tokens — agent reads this first):** Three opt-in browse-mode extensions on top of Phase 5: (a) Multi-viewport — `AuditRequest.viewports: ["desktop","mobile"]` runs perception per viewport sequentially and produces a `ViewportDiffFinding` for fold/CTA/sticky differences. (b) Popup behavior — runtime probe + dismissibility tester + dark-pattern detector populates the popups[] behavior fields that Phase 1b emitted as null. (c) Trigger taxonomy — five new triggers (hover, scroll-position, time-delay, exit-intent, form-input) join click to form an 8-trigger set with prioritized candidate discovery. (d) Cookie policy — detect (OneTrust/Cookiebot/TrustArc + generic) + dismiss/preserve per `AuditRequest.cookie_policy`. 19 tasks (T5B-001..T5B-019). Cost: ~2× browse cost when multi-viewport ON; opt-in only — default desktop-only keeps cost flat. Zero new LLM calls. R26 enforces no destructive triggers (cc-*/password skipped), no cross-origin trigger, no infinite loops, per-trigger budget ≤10.

---

## What's in this folder

| File | Purpose |
|---|---|
| `spec.md` | Full feature spec (P1-P5 user stories, AC-01..AC-19, R-01..R-19, NF-01..NF-06) |
| `plan.md` | Implementation plan: 4 work-streams, viewport presets, ViewportDiffEngine algorithm, dark-pattern taxonomy, cookie banner library signatures, R26 enforcement points, kill criteria, effort estimate |
| `tasks.md` | T5B-001..T5B-019 phase-scoped view (canonical defs in `tasks-v2.md` lines 580-696) |
| `impact.md` | R20 impact analysis — required because multiple shared contracts modified |

---

## Quick links

- **Source improvement spec:** [`docs/Improvement/perception_layer_spec.md`](../../../../Improvement/perception_layer_spec.md) §3.1 trigger taxonomy + §4.1 multi-viewport + §4.4 cookie banners
- **Architecture spec (popups + multi-viewport):** [`docs/specs/final-architecture/07-analyze-mode.md`](../../../final-architecture/07-analyze-mode.md) §7.9.2
- **Architecture spec (trigger taxonomy):** [`docs/specs/final-architecture/20-state-exploration.md`](../../../final-architecture/20-state-exploration.md)
- **AuditRequest spec:** [`docs/specs/final-architecture/18-trigger-gateway.md`](../../../final-architecture/18-trigger-gateway.md)
- **Canonical tasks:** [`docs/specs/mvp/tasks-v2.md`](../../tasks-v2.md) lines 580-696
- **Predecessor phase:** Phase 5 (T081-T100) browse-mode baseline + Phase 1b popups[] presence + Phase 1c ElementGraph
- **Successor phase:** Phase 6 (heuristics consume multi-viewport pack); Phase 7 (EvaluateNode iterates multi-viewport bundles)

---

## Status

| Field | Value |
|---|---|
| Status | ⚪ Not started |
| Depends on | Phase 5 ships + Phase 1b ships + Phase 1c ships; coordination with Phase 4b for AuditRequest schema (T4B-009 lands first) |
| Blocks | Mobile-priority audits, popup-quality findings, variant-driven CRO findings, cookie-banner-aware audits |
| Estimated effort | ~28.5h ±3 (single engineer across 2-3 weeks; 28h base + 0.5h T5B-PRE-001 R20 widening) |
| Token impact | Per-page bundle count grows from 1 → 2 when multi-viewport ON; per-bundle size unchanged |
| Cost impact | ~2× browse cost when multi-viewport ON; opt-in only. $0 new LLM cost. Default behavior cost-neutral. |
| Affected contracts | `AuditRequest` extended; `AnalyzePerception popups[]` behavior fields populated; multi-bundle when multi-viewport; BrowseGraph extended |
| Constitution rule enforced | R26 (State Exploration MUST NOT) — per-trigger budget, cross-origin refusal, cc-*/password skip, no infinite loops, no navigation |

---

## Delta Log

### v0.2 → v0.3 — 2026-05-17 (Pass 2 micro-wave per preflight-correctness-pass2.json)

Applied findings: F3.

- F3 (LOW) — Effort locked to **28.5h ±3** (was ~28h ±3; aligned with plan §4 per-task sum which includes T5B-PRE-001 R20 widening).

### v0.1 → v0.2 — 2026-05-17 (Pass 1 patch wave per review-notes.md)

Applied actions: act-013, act-014.

- act-013 — Estimated effort confirmed at **~28h ±3** (aligned with plan.md §4 unified total; was already consistent in README).
- act-014 — frontmatter `updated: 2026-05-17`, version `0.1 → 0.2`, delta block appended (R18).

> No other acts touch this README — README is a navigation index, not a contract surface. Substantive patches landed in spec.md / plan.md / tasks.md / impact.md.

