---
title: Neural MVP — Phases Index
artifact_type: index
status: approved
version: 1.1
created: 2026-04-22
updated: 2026-04-28
owner: engineering lead
governing_rules:
  - Constitution R17-R21
  - PRD §6.5 (Project Structure Map)
generated_by: pnpm spec:index    # Auto-regenerated when phase folders or sub-phases are added — currently hand-edited until script lands
---

# Phases Index — Neural MVP v1.0

> **Summary (~100 tokens):** Master index of MVP phases — Phase 0 (Setup) and Phase 0b (LLM-assisted heuristic authoring) seed the project; Phases 1 → 9 sequentially deliver perception, MCP tools, verification, safety + infra + cost, browse, heuristic KB, analysis, orchestrator, and delivery. **v1.1 (2026-04-28):** four NEW sub-phases land — 1b (Perception Extensions v2.4), 1c (PerceptionBundle Envelope v2.5), 4b (Context Capture Layer v1.0), 5b (Multi-Viewport + Trigger Taxonomy + Cookie Policy). Phase 4 + Phase 6 refreshed for §11.1.1 robots/ToS + ContextProfile filter dependencies. Load this file first when starting or picking up a task. Do NOT load all phase files — use the decision table to find the one you need.

> **Rule:** When working on a task, read this index, identify the phase, then load only `phase-<N>-<name>/README.md` + `spec.md` + `tasks.md` for that phase (plus cited REQ-IDs from architecture specs).

---

## Phase decision table

| Phase | Name | Status | Tasks | Folder | Depends on | Blocks |
|---|---|---|---|---|---|---|
| 0 | Setup | ⚪ not started | M0.1-M0.5 | `phase-0-setup/` | — | 1 |
| 0b | Heuristic Authoring (LLM-assisted, engineering-owned) | ⚪ not started | T-NNN range pending PRD F-012 task expansion | `phase-0b-heuristics/` (pending) | 0 | 6 |
| 1 | Browser Perception Foundation | ⚪ not started | M1.1-M1.10 (T006-T015) | `phase-1-perception/` | 0 | 1b, 2, 5 |
| **1b** | **Perception Extensions v2.4** | ⚪ not started | T1B-001..T1B-012 | `phase-1b-perception-extensions/` | 1 | 1c, 6, 7 |
| **1c** | **PerceptionBundle Envelope v2.5** | ⚪ not started | T1C-001..T1C-012 | `phase-1c-perception-bundle/` | 1b | 7 (EvaluateNode token budget); 13 (state graph master) |
| 2 | MCP Tools (subset) | ⚪ not started | M2.1-M2.20 (T016-T050) | `phase-2-tools/` | 1 | 5 |
| 3 | Verification (thin) | ⚪ not started | M3.1-M3.8 (T053-T055 MVP; T056-T061 v1.1) | `phase-3-verification/` | 2 | 5 |
| 4 | Safety + Infrastructure + Cost | ⚪ not started | M4.1-M4.20 (T066-T076 + T080 + T080a) — refreshed v0.3 | `phase-4-safety-infra-cost/` | 2, 3 | 4b, 5, 7 |
| **4b** | **Context Capture Layer v1.0** | ⚪ not started | T4B-001..T4B-015 | `phase-4b-context-capture/` | 4 (refreshed) + 0b | 6 (refreshed); 7 (EvaluateNode cost reduction) |
| 5 | Browse MVP | ⚪ not started | M5.1-M5.8 (T081-T100) | `phase-5-browse-mvp/` | 1, 2, 3, 4 | 5b, 7, 8 |
| **5b** | **Multi-Viewport + Trigger Taxonomy + Cookie Policy** | ⚪ not started | T5B-001..T5B-019 | `phase-5b-multi-viewport-triggers-cookie/` | 5, 1b, 1c | 7 (multi-bundle iteration); 8 (multi-viewport coordinate) |
| 6 | Heuristic KB Engine | ⚪ not started | M6.1-M6.11 (T101, T102, T106-T112) — refreshed v0.3 | `phase-6-heuristics/` | 4, 0b, 4b (T4B-013 contract) | 7 |
| 7 | Analysis Pipeline | ⚪ not started | M7.1-M7.28 | `phase-7-analysis/` (pending) | 5, 6, 1c | 8 |
| 8 | Orchestrator + Cross-Page | ⚪ not started | M8.1-M8.17 | `phase-8-orchestrator/` (pending) | 7 | 9 |
| 9 | Foundations + Delivery | ⚪ not started | M9.1-M9.28 | `phase-9-delivery/` (pending) | 8 | ★ MVP |

**Status legend:** ⚪ not started · 🟡 in progress · 🟢 complete · 🔴 blocked
**Bold rows** = NEW sub-phases added in v1.1 (2026-04-28)

---

## v1.1 changes (2026-04-28)

Four NEW sub-phase folders + two refreshes:

### NEW sub-phases
| Sub-phase | Source | Adds |
|---|---|---|
| 1b — Perception Extensions v2.4 | `docs/Improvement/perception_layer_spec.md` items 1-10; §07 §7.9.2 | 10 perception extractors (pricing, click target, sticky, popups, friction, social proof, microcopy, attention, commerce, currency switcher) + v2.4 Zod schema |
| 1c — PerceptionBundle Envelope v2.5 | `docs/Improvement/perception_layer_spec.md` items 1, 2, 6 + Shadow DOM/iframe/pseudo-element; §07 §7.9.3 | PerceptionBundle envelope with ElementGraph + FusedElement + settle predicate + 5 traversal extensions + nondeterminism flags + warnings |
| 4b — Context Capture Layer v1.0 | `docs/Improvement/context_capture_layer_spec.md` items 1-6; §37 | Pre-perception "consultant intake form" — 5 dimensions (business / page / audience / traffic / brand) with `{value, source, confidence}`; URLPattern + HtmlFetch + JSON-LD inference; CLI clarification; `context_profiles` table; HeuristicLoader filter (T4B-013) |
| 5b — Multi-Viewport + Triggers + Cookie | §07 §7.9.2 multi-viewport + §20 trigger taxonomy + improvement spec §4.4 | Multi-viewport audit (opt-in); 5 new triggers (hover/scroll/time/exit-intent/form-input); cookie banner detect+policy; popup behavior probing |

### Phase refreshes
| Phase | Version | Adds |
|---|---|---|
| 4 (Safety + Infra + Cost) | v0.2 → v0.3 | T080a RobotsChecker (§11.1.1 / REQ-SAFETY-005) + context_profiles table slot reservation in T070 schema baseline |
| 6 (Heuristic KB) | v0.2 → v0.3 | AC-11 + R-09 contract surface for `HeuristicLoader.loadForContext(profile)` (T4B-013); HeuristicSchemaExtended manifest selectors (`archetype`/`page_type`/`device`) |

---

## Reading rules

Per Constitution R17-R21 + PRD §12.5:

1. **Load this INDEX first.** Identify the target phase.
2. **Load `phase-<N>-<name>/README.md`** (summary, ~150 tokens).
3. **Decide whether full spec/tasks are needed.** Most tasks only need the README + task description + cited REQ-IDs.
4. **For full context:** run `pnpm spec:pack --phase <N>` to get the pre-bundled context-pack (when the script lands).
5. **Never load ALL phases at once.** Progressive disclosure (Rule: CLAUDE.md §1, PRD §12.5.1).
6. **For inter-phase context:** read the predecessor phase's rollup (`phase-<N-1>-current.md`), NOT the full predecessor artifacts.
7. **Sub-phases (1b, 1c, 4b, 5b) load AFTER the parent phase's rollup** (see Depends on column).

---

## Rollup locations (once phases complete)

| After phase N completes | Rollup location | State transition |
|---|---|---|
| Phase 0 | `phase-0-setup/phase-0-current.md` | approved → verified when Phase 1 starts |
| Phase 1 | `phase-1-perception/phase-1-current.md` | approved → verified when Phase 1b starts |
| **Phase 1b** | `phase-1b-perception-extensions/phase-1b-current.md` | approved → verified when Phase 1c starts |
| **Phase 1c** | `phase-1c-perception-bundle/phase-1c-current.md` | approved → verified when Phase 2 starts |
| Phase 2 | `phase-2-tools/phase-2-current.md` | approved → verified when Phase 3 starts |
| Phase 3 | `phase-3-verification/phase-3-current.md` | approved → verified when Phase 4 starts |
| Phase 4 | `phase-4-safety-infra-cost/phase-4-current.md` | approved → verified when Phase 4b/5 start |
| **Phase 4b** | `phase-4b-context-capture/phase-4b-current.md` | approved → verified when Phase 6 starts |
| Phase 5 | `phase-5-browse-mvp/phase-5-current.md` | approved → verified when Phase 5b/7 start |
| **Phase 5b** | `phase-5b-multi-viewport-triggers-cookie/phase-5b-current.md` | approved → verified when Phase 7 starts (or independently if 5b deferred to v1.1) |
| Phase 6 | `phase-6-heuristics/phase-6-current.md` | approved → verified when Phase 7 starts |
| Phase 7 | `phase-7-analysis/phase-7-current.md` | approved → verified when Phase 8 starts |
| Phase 8 | `phase-8-orchestrator/phase-8-current.md` | approved → verified when Phase 9 starts |
| Phase 9 (MVP complete) | `phase-9-delivery/phase-9-current.md` | approved → verified on first real client audit |

At each phase exit:
1. `pnpm spec:rollup --phase N` scaffolds the rollup (when the script lands; currently hand-authored)
2. Engineering lead fills the manual sections
3. Reviewer approves; status → `approved`
4. Phase N+1 work begins by reading the rollup
5. When Phase N+1 completes, phase N rollup → `verified`

---

## File layout per phase

```
phase-<N>-<name>/
├── README.md               ~150 token summary (required)
├── spec.md                 phase-scoped spec (<500 lines; split if larger)
├── tasks.md                phase tasks (<500 lines)
├── plan.md                 implementation plan (<500 lines; sequencing + kill criteria)
├── impact.md               (required when shared contracts touched per R20)
├── checklists/
│   └── requirements.md     spec-quality checklist
├── context-pack.md         pre-bundled agent context (generated by pnpm spec:pack — pending)
└── phase-<N>-current.md    rollup (created at phase exit)
```

---

## Maintenance

This index SHALL be regenerated by `pnpm spec:index` whenever a phase is added, status changes, or rollup lands. Until that script lands, hand-edits are the operating mode — bump the `version` field and `updated` date on each edit, and add a row to "v1.1 changes" or open a new "v1.X changes" section.

**Hand-edit policy:** prefer surgical Edit calls over full file rewrites once `pnpm spec:index` exists; until then, rewrites are acceptable when adding sub-phases.
