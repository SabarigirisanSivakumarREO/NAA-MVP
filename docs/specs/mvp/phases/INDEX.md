---
title: Neural MVP — Phases Index
artifact_type: index
status: approved
version: 1.5
created: 2026-04-22
updated: 2026-05-01
owner: engineering lead
governing_rules:
  - Constitution R17-R21
  - PRD §6.5 (Project Structure Map)
generated_by: pnpm spec:index    # Auto-regenerated when phase folders or sub-phases are added — currently hand-edited until script lands
---

# Phases Index — Neural MVP v1.0

> **Summary (~100 tokens):** Master index of MVP phases — Phase 0 (Setup) and Phase 0b (LLM-assisted heuristic authoring) seed the project; Phases 1 → 9 sequentially deliver perception, MCP tools, verification, safety + infra + cost, browse, heuristic KB, analysis, orchestrator, and delivery. **★ v1.3 (2026-04-29 Session 5): Phase 9 spec corpus shipped — MVP SPEC COMPLETE ★** all 15 phase folders (0, 0b, 1, 1b, 1c, 2, 3, 4, 4b, 5, 5b, 6, 7, 8, 9) are spec-shipped; implementation can start at Phase 0. **v1.2 (2026-04-28 Session 4):** Phase 0b + Phase 7 + Phase 8 spec corpus shipped. tasks-v2.md patched v2.3.2 → v2.3.3 (Phase 0b section + T103-T105 counts reduced to 15/10/5 per F-012 v1.2). **v1.1 (2026-04-28 Session 3):** four NEW sub-phases landed — 1b (Perception Extensions v2.4), 1c (PerceptionBundle Envelope v2.5), 4b (Context Capture Layer v1.0), 5b (Multi-Viewport + Trigger Taxonomy + Cookie Policy). Phase 4 + Phase 6 refreshed for §11.1.1 robots/ToS + ContextProfile filter dependencies. Load this file first when starting or picking up a task. Do NOT load all phase files — use the decision table to find the one you need.

> **Rule:** When working on a task, read this index, identify the phase, then load only `phase-<N>-<name>/README.md` + `spec.md` + `tasks.md` for that phase (plus cited REQ-IDs from architecture specs).

---

## Phase decision table

| Phase | Name | Status | Tasks | Folder | Depends on | Blocks |
|---|---|---|---|---|---|---|
| 0 | Setup | ⚪ not started | M0.1-M0.5 | `phase-0-setup/` | — | 1 |
| **0b** | **Heuristic Authoring (LLM-assisted, engineering-owned)** | ⚪ not started — spec shipped v0.1 | T0B-001..T0B-005 + T103/T104/T105 | `phase-0b-heuristics/` | 0 | 6 |
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
| **7** | **Analysis Pipeline** | ⚪ not started — spec shipped v0.1 | M7.1-M7.22 (T113-T134) | `phase-7-analysis/` | 5, 6, 1c, 4b | 8 |
| **8** | **Orchestrator + Cross-Page** | ⚪ not started — spec shipped v0.1 | M8.1-M8.21 (T135-T155) | `phase-8-orchestrator/` | 7, 4b (T4B-011) | 9 |
| **9** | **Foundations + Delivery** ★ MVP SPEC COMPLETE ★ | ⚪ not started — spec shipped v0.1 | T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261 (35 tasks) | `phase-9-delivery/` | 8, 7, 6, 4b, 4, 0b | ★ MVP shippable for first external pilot (with v1.1 R6.2 AES at-rest hardening) |

**Status legend:** ⚪ not started · 🟡 in progress · 🟢 complete · 🔴 blocked
**Bold rows** = NEW sub-phases added in v1.1 (2026-04-28 Session 3) OR phases with spec corpus shipped in v1.2 (2026-04-28 Session 4) / v1.3 (2026-04-29 Session 5)

---

## ★ v1.3 changes (2026-04-29 Session 5) — MVP SPEC COMPLETE ★

Phase 9 spec corpus shipped (spec/plan/tasks/impact/README/checklist each):

| Phase | Status | Key surface | Risk |
|---|---|---|---|
| **9** — Foundations + Delivery | spec corpus shipped — ★ MVP SPEC COMPLETE ★ | T156-T175 master foundations (AuditRequest contract; Gateway sync MVP; **T160 SnapshotBuilder REPLACES Phase 8 T145 scaffold**; TemperatureGuard; AccessModeMiddleware; WarmupManager; StoreNode + AnnotateNode extensions; 4D ScoringPipeline + IMPACT_MATRIX + EFFORT_MAP; Suppression; Next.js 15 + shadcn + Tailwind + Clerk consultant dashboard 4 pages) + T245-T249 delivery (ExecutiveSummary 1 LLM call $0.10 cap GR-007 enforced; ActionPlan deterministic 4-quadrant; branded PDF Playwright `page.pdf()` 8 sections ≤5MB R2) + T256-T257 DiscoveryStrategy (Sitemap + Manual MVP; Nav-stub deferred) + T260-T261 NotificationAdapter (Resend) + T239-T244 observability (Pino + 22-event audit_events taxonomy + heuristic_health_metrics view + alerting + admin ops dashboard LAST) | **HIGH** — T160 supersedes Phase 8 T145 scaffold; **R6 channels 3 + 4 first runtime activation** (Hono API + Next.js render — heuristic body NEVER serialized); ExecutiveSummary GR-007 retry-then-fallback; AccessModeMiddleware fail-secure default; ★ MVP SPEC COMPLETE gate ★ |

### MVP spec corpus state (15 phase folders shipped; 0% implemented)

After Session 5: **all 15 phase folders are spec-shipped** — 0, 0b, 1, 1b, 1c, 2, 3, 4, 4b, 5, 5b, 6, 7, 8, 9. Implementation can start at Phase 0. After Phase 9 implementation ships → MVP is shippable for first external pilot (with v1.1 R6.2 AES-256-GCM at-rest hardening added BEFORE pilot per PRD §3.2).

### tasks-v2.md drift status (this session)

No drift found in Phase 9 sections — task IDs T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261 are canonical in tasks-v2.md v2.3.3; phase-9-delivery folder is a scoped view referencing them verbatim.

### Punch-list candidates (v2.3.4 — NOT applied this session)

- Add discrete T-IDs for `r6-channel-3.test.ts` + `r6-channel-4.test.ts` conformance tests (currently folded into AC-36)
- Add discrete T-ID for ExecutiveSummary GR-007 retry-then-fallback test (currently folded into AC-22)
- Add discrete T-ID for GR-012 benchmark validation (carry-over from v1.2 punch-list — currently folded into Phase 7 T130 acceptance)
- Add discrete T-ID for cross-page PatternDetector (carry-over from v1.2 — currently folded into Phase 8 T139 acceptance)
- Constitution R22.6 stale xref: PRD §10.1 + R13 cite "(R10)" for temperature=0; should cite R13 directly (carry-over from Session 3)
- Phase 2 "28 vs 29 MCP tools" mismatch in impact.md + plan.md (carry-over from Session 2)
- **(NEW Session 7 / Phase 1 analyze L3)** Phase 1 polish task IDs (`T-PHASE1-TESTS`, `T-PHASE1-DOC`, `T-PHASE1-LOGGER`, `T-PHASE1-ADAPTERS-README`, `T-PHASE1-ROLLUP`) defined in `phase-1-perception/tasks.md` but absent from canonical `tasks-v2.md` Phase 1 section. Add to v2.3.4 alongside T006-T015 (and apply same retroactive treatment to Phase 0's `T-PHASE0-TEST` + Phase 0b's `T-SKELETON-001..010` if not already in v2.3.4 scope).
- **(NEW Session 7 / Phase 1 analyze L4)** `phase-1-perception/{spec,plan,tasks}.md` cite `tasks-v2 v2.3.1` (the version when T007 reduction landed) but canonical version is now v2.3.3 per Session 4 patch. Bump citation to `v2.3.3` (or `v2.3.1 — T007 reduction; current corpus v2.3.3`) when v2.3.4 lands.
- **(NEW Session 7 / Phase 6 analyze L1)** Phase 6 polish task IDs (`T-PHASE6-TESTS`, `T-PHASE6-LOGGER`, `T-PHASE6-FIXTURES`, `T-PHASE6-DOC`, `T-PHASE6-ROLLUP`) defined in `phase-6-heuristics/tasks.md` but absent from canonical `tasks-v2.md` Phase 6 section. Same retroactive treatment as Phase 1 carry-over (above) — bundle when v2.3.4 lands.
- **(NEW Session 7 / Phase 6 analyze L3)** `phase-6-heuristics/tasks.md` derived_from cites "T4B-013 v0.2 extension" / "T4B-013 — v0.2 extension" terminology that was correct at v0.2 but is now mid-version (artifact at v0.4). Cosmetic: rephrase to "T4B-013 — extension landed v0.2; carried in v0.4+" when v2.3.4 lands.

---

## v1.4 changes (2026-04-30 Session 7)

**Phase 1 v0.3 polish:** 8 analyze findings (M1-M4 + L1-L2 + L5-L6) applied across `phase-1-perception/{spec,plan,tasks,impact}.md`. Mechanical fixes only — no AC-NN / R-NN / SC-NNN ID changes (R18 append-only preserved). 2 carry-over items (L3, L4) added to v2.3.4 punch-list above. R17.4 review APPROVED with conditions C1 BINDING + C2/C3 OPTIONAL per [`phase-1-perception/review-notes.md`](phase-1-perception/review-notes.md) v1.0; status bumped to `approved`.

**Phase 6 v0.4 catch-up polish:** 4 analyze findings (H1 + H2 + H3 + M1) applied as a single v0.4 sync across `phase-6-heuristics/{spec,plan,tasks,impact}.md`. Catch-up consolidates two pending updates that never reached plan/impact: (a) v0.2 Pino redaction-pattern → BenchmarkSchema mapping; (b) v0.3 contract surface for T4B-013 + AC-11 + R-09 + REQ-CONTEXT-DOWNSTREAM-001 + manifest selectors (`archetype` / `page_type` / `device`). H1 closes the R6 enforcement gap in T-PHASE6-LOGGER (3 wrong-syntax paths → 6 correct paths matching spec.md:101 authoritative list). Versions: spec.md v0.3→v0.4; plan.md v0.2→v0.4 (skip v0.3 for catch-up); tasks.md v0.3→v0.4; impact.md v0.1→v0.4 (skip v0.2/v0.3 for catch-up). 2 carry-over items (L1, L3) added to v2.3.4 punch-list above. R17.4 review pending.

---

## v1.5 changes (2026-05-01 — Round 1-5 doc hygiene sync)

Five-round sync to align all MVP-root reference files with the per-phase corpus reality + complete the constitution R1-R23 → R1-R26 metadata fix + ship a copy-paste-ready session bootstrap prompt in the entry-point README. **No phase artifacts modified** beyond the Phase 0 README v1.0 → v1.1 paper-cut (Round 4 item 2). All five rounds are doc-hygiene only — zero scope, code, or behavior changes.

| Round | Files modified | Result |
|---|---|---|
| 1 | `docs/specs/mvp/README.md` v1.0 → v2.0 (full rewrite); `CLAUDE.md` (10 surgical edits) | Entry point + reading order + cheat sheet aligned to per-phase corpus; R1-R26 (was R1-R16); architecture.md §6.5 ref (was broken plan.md §3.2); 11 root files + 4 subfolders mapped |
| 2 | `docs/specs/mvp/spec-driven-workflow.md` v1.0 → v1.1 (9 edits) | §12.1 per-phase Spec Kit flow diagram; §12.3 sync table reframed; §12.5.2 reframed REALIZED via phase READMEs + INDEX.md v1.4; §12.5.4 current+v1.2-target split; §12.6 R17.4 review-gate xref; cross-references expanded to R23-R26 + PRD §10.6/§10.9/§10.10 + CLAUDE.md §8c+§8d |
| 3 | `docs/specs/mvp/constitution.md` v1.2 → v1.3 (4 edits); `docs/specs/mvp/architecture.md` (2 edits); `.specify/memory/constitution.md` re-synced + sync notice updated 2026-05-01 | Constitution frontmatter + Summary + R22.4 + R22.6 metadata fixes (body R1-R26 unchanged); R22.6 temperature=0 codification deferred from v1.3 to v1.4 with rationale; architecture.md line 262 R1-R23 → R1-R26 + project-structure tree updated to current per-phase reality (phases/, templates/, scripts/, sessions/, implementation-roadmap files) |
| 4 | `docs/specs/mvp/PRD.md` v1.2 → v1.2.1 (§1 framing); `docs/specs/mvp/phases/phase-0-setup/README.md` v1.0 → v1.1 (lines 41 + 74 + 78 fixes); this INDEX.md v1.4 → v1.5 | PRD §1 Status + "This document's role" reframed to per-phase invocation; Phase 0 README "(generated by Spec Kit CLI from PRD.md)" reframed + R1-R21 → R1-R26 reading-order fix; this changelog entry added |
| 5 | `docs/specs/mvp/README.md` v2.0 → v2.1 (added "## Session bootstrap (kickoff prompt)" section); this INDEX.md v1.5 changelog updated to Round 1-5 | Copy-paste-ready session-bootstrap prompt now lives in the entry-point README. Synthesizes Tier 2-5 reading guidance + every standing directive (skill choice, modular prompt rule, R20 impact / R23 kill criteria triggers, walking-skeleton + Wednesday demo cadence, R17.4 review-gate, R6 heuristic IP boundary, temperature=0 invariant, Phase 0b D1+D2 binding conditions). New sessions paste verbatim — no editing required (just swap active phase if not Phase 0). |

### Outcome (post-Round-5)

All MVP-root reference files now cite **R1-R26** + the **per-phase artifact pattern** consistently. No root-level `spec.md` / `plan.md` / `tasks.md` referenced anywhere. PRD §1 + spec-driven-workflow §12.1 + README v2.1 + CLAUDE.md §1 + architecture.md tree + INDEX.md decision table all describe the same per-phase flow. **README v2.1 ships the session-bootstrap prompt — new sessions can hit the ground running.** Ready for Phase 0 implementation kickoff.

### Known stale references deliberately NOT fixed in Round 1-4

- Phase 2/3/4/5 `plan.md` line 19 still cite `(R1-R23)` — drafts; will self-heal via JIT analyze pattern (CLAUDE.md §8c) when each phase polishes pre-implementation. Touching them now would short-circuit the JIT discipline.
- Other phase READMEs (1, 1b, 1c, 2, 3, 4, 4b, 5, 5b, 6, 7, 8, 9) may have similar minor framing — not audited; treat per-phase JIT.
- `tasks-v2.md` v2.3.4 punch-list (carried in v1.3 / v1.4 changelog sections above) — not in scope for doc-hygiene rounds; lands when next master-plan amendment ships.

---

## v1.2 changes (2026-04-28 Session 4)

Three phase-folder spec corpora shipped (spec/plan/tasks/impact/README/checklist each):

| Phase | Status | Key surface | Risk |
|---|---|---|---|
| **0b** — Heuristic Authoring (LLM-assisted, engineering-owned) | spec corpus shipped | T0B-001..T0B-005 (drafting prompt template, verification protocol, PR Contract Proof block, `pnpm heuristic:lint` CLI, `heuristics-repo/README.md`) + T103/T104/T105 (≈15+10+5=30 heuristics per F-012 v1.2) | LOW — content authoring; HeuristicSchemaExtended already locked in Phase 6 v0.3 |
| **7** — Analysis Pipeline | spec corpus shipped | T113-T134 (22 tasks); 5-step pipeline (deep_perceive → evaluate → self_critique → ground → annotate_and_store); FIRST runtime activation of R10/R13 TemperatureGuard + R6 LangSmith trace channel + R5.6 separate self-critique call; Finding lifecycle producer; 8 GR rules + GR-012 benchmark validation | **HIGH** — analytical apex; 3 first activations; 5 append-only producers |
| **8** — Orchestrator + Cross-Page | spec corpus shipped | T135-T155 (21 tasks); LangGraph subgraph composition (BrowseGraph + AnalysisGraph); AuditState 3-phase coordination (Phase 4b T4B-011 + Phase 7 T113 + Phase 8 T135); cross-page PatternDetector (F-014 folded into T139); reproducibility_snapshot consumer; PostgresCheckpointer; ★ MVP COMPLETE gate ★ (T148 + T149 + T150) | **HIGH** — AuditState extension; PatternFinding contract; MVP COMPLETE gate; 3-phase merge surface |

### tasks-v2.md patch v2.3.3 (this session)

Applied per CLAUDE.md standing directive (Option A drift resolution):

- **Phase 0b section ADDED** (T0B-001..T0B-005 — drafting prompt, verification protocol, PR Contract Proof block, `pnpm heuristic:lint`, repo README) — engineering-owned LLM-assisted authoring infrastructure per PRD F-012 v1.2 amendment 2026-04-26
- **T103-T105 counts REDUCED** from 50/35/15 (=100, v2.0) to 15/10/5 (=30, F-012 v1.2 MVP scope) — additional 70 deferred to v1.1+ to reach §09.3 master target
- **T103-T105 ownership** clarified: definitions remain in Phase 6 section (engine consumes), but OWNED by Phase 0b workstream (content producer)
- See `docs/specs/mvp/phases/phase-0b-heuristics/{spec,plan,tasks,impact,README}.md` for full Phase 0b authoring workflow

### Punch-list candidates (v2.3.4 — NOT applied this session)

- Add discrete T-ID for GR-012 benchmark validation (currently folded into Phase 7 T130 EvidenceGrounder acceptance per phase-7-analysis/plan.md §3)
- Add discrete T-ID for cross-page PatternDetector (currently folded into Phase 8 T139 AuditCompleteNode acceptance per phase-8-orchestrator/plan.md §3)
- Constitution R22.6 stale xref: PRD §10.1 + R13 cite "(R10)" for temperature=0; should cite R13 directly (carry-over from Session 3)
- Phase 2 "28 vs 29 MCP tools" mismatch in impact.md + plan.md (carry-over from Session 2)

---

## v1.1 changes (2026-04-28 Session 3)

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
