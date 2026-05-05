---
title: Session 7 (2026-05-01) Handover Notes — Phase 1 + Phase 6 APPROVED + ready for week-1 implementation
artifact_type: session-handover
status: complete
session_number: 7
session_date: 2026-05-01
created: 2026-05-01
updated: 2026-05-01
owner: engineering lead
authors: [Claude (drafter), Sabari (engineering lead)]

description: "Canonical session-state handover for Session 7 (2026-05-01). Captures Phase 1 + Phase 6 R17.4 approvals, completes the spec-prep arc for week-1 + week-2 forward-pulled contract dependencies, and hands off to a fresh implementation session. Lives in /NBA so it travels with the repo and is git-tracked."

cross_references:
  - docs/specs/mvp/phases/phase-1-perception/{spec,plan,tasks,impact}.md (v0.3 — status: approved)
  - docs/specs/mvp/phases/phase-1-perception/review-notes.md v1.0 (R17.4 evidence; conditions C1 BINDING + C2/C3 OPTIONAL)
  - docs/specs/mvp/phases/phase-6-heuristics/{spec,plan,tasks,impact}.md (v0.4 — status: approved)
  - docs/specs/mvp/phases/phase-6-heuristics/review-notes.md v1.0 (R17.4 evidence; conditions C1+C2 BINDING + C3+C4+C5 OPTIONAL)
  - docs/specs/mvp/phases/INDEX.md v1.6
  - docs/specs/mvp/sessions/session-2026-04-30-handover.md (Session 6 — predecessor)
  - .specify/extensions.yml (neural-dev-workflow registered; before_implement + after_implement hooks active)
  - .claude/skills/neural-dev-workflow-brief/SKILL.md (phase-entry hook — R17.4 verify + Brief + Kill criteria + pacing)
  - .claude/skills/neural-dev-workflow-pr/SKILL.md (phase-exit hook — PR Contract + Spec Coverage + R17 bumps + R19 rollup + INDEX flip)
---

# Session 7 (2026-05-01) — Handover Notes

## ★ Phase 1 + Phase 6 APPROVED — spec-prep arc complete for week-1 + week-2 ★

### Critical state changes since Session 6

**Phase status (R17 lifecycle):**
- Phase 1: spec/plan/tasks/impact at v0.3, **status: approved** (was draft)
- Phase 6: spec/plan/tasks/impact at v0.4, **status: approved** (was draft; multi-artifact version drift caught + closed via v0.4 catch-up)
- All other phases (1b, 1c, 2, 3, 4, 4b, 5, 5b, 7, 8, 9): unchanged at status: draft
- INDEX.md v1.6 — Phase 1 + 6 rows still ⚪ "not started" (R17 lifecycle: ⚪ → 🟡 only when first task code lands per CLAUDE.md §8c)

**Audit trail evidence (R17.4):**
- Phase 1: `phase-1-perception/review-notes.md` v1.0 (APPROVE recommendation; 1 BINDING + 2 OPTIONAL conditions)
- Phase 6: `phase-6-heuristics/review-notes.md` v1.0 (APPROVE recommendation; 2 BINDING + 3 OPTIONAL conditions)

---

## What this session shipped

### 1. Phase 1 v0.3 polish (Browser Perception Foundation)

8 analyze findings applied across `phase-1-perception/{spec,plan,tasks,impact}.md`:
- M1: Constitution xref `(R10)` → `(R13)` for temperature=0 invariant (carry-over from Phase 0 fix)
- M2: derived_from `R1-R23` → `R1-R26` (constitution has R24-R26 perception/context/state-exploration MUST NOTs)
- M3: R-05 (AccessibilityExtractor) drops misattributed REQ-BROWSE-PERCEPT-002 — that REQ-ID belongs to HardFilter (R-06). Propagated to tasks.md T008 header.
- M4: R-09 (ScreenshotExtractor) cites REQ-BROWSE-PERCEPT-004 (was "no specific REQ-ID")
- L1: dedupe duplicate `**`BrowserEngine`**` heading
- L2: token operator `≤` → `<` (one stray instance vs all other ACs)
- L5: plan.md HardFilter return shape includes `reductionFloorWaived: boolean` (matches spec AC-04 + tasks T009)
- L6: plan.md derived_from architecture.md double-cite collapsed

R17.4 review surfaced **D5 Playwright timeout budgeting under-specification** for T015 — captured as **BINDING C1**.

### 2. Phase 6 v0.4 catch-up polish (Heuristic KB Engine)

Multi-artifact version drift discovered: spec.md/tasks.md were at v0.3 but plan.md was at v0.2 and impact.md was at v0.1. Two pending updates (v0.2 polish + v0.3 contract additions) had never reached plan/impact. Single v0.4 sync closed the drift.

4 analyze findings applied:
- **H1**: T-PHASE6-LOGGER (R6 enforcement) was specified with 3 wrong-syntax Pino redaction paths (`*.benchmark.*.value` etc — invalid for the discriminated-union flat shape). Fixed to 6 correct paths matching spec.md:101 authoritative list. **R6 first-runtime-activation gap closed.**
- **H2**: impact.md HeuristicSchemaExtended schema sketch + HeuristicLoader interface were stale at v0.1 — missing the v0.3 `archetype`/`page_type`/`device` manifest selectors and `loadForContext()` signature. Updated. Added Phase 4b T4B-013 sub-section to Forward Contract.
- **H3**: plan.md missing v0.3 `REQ-CONTEXT-DOWNSTREAM-001` in req_ids + Phase 1 Design item 6 documenting loadForContext seam + R13 in derived_from. Caught up.
- **M1**: Constitution xref `R10` → `R13` for temperature=0 (same Phase 0/1 carry-over).

R17.4 review surfaced **D1 Zod error message leakage** in T106 implementation — same lesson as Phase 0b D1 (T0B-004 Zod-error sanitization) but didn't propagate forward in spec authoring. Captured as **BINDING C1**. Also surfaced **D2 string-interpolation defeats path-based redaction** — captured as **BINDING C2**.

### 3. INDEX.md v1.4 → v1.6 (via doc-hygiene commits 2ee7914 + e0ed5a0 + 4bd1f5c)

- v2.3.4 punch-list expanded with 4 carry-overs from Phase 1 + Phase 6 analyze passes (L3, L4, L1, L3 respectively)
- v1.4 changes section documents both phases' polish + R17.4 review outcomes
- v1.5 / v1.6 absorbed via parallel doc-hygiene work (2026-05-01 Round 1-4 sync + R5/R6 follow-ups)

### 4. /speckit.implement ↔ neural-dev-workflow integration (commit e0ed5a0)

**This is the operational change that affects HOW the next session implements.** Previously the implementation skill was `neural-dev-workflow` directly. Now `/speckit.implement` is wired to it via `.specify/extensions.yml` hooks:

- `before_implement` → `neural-dev-workflow-brief` skill (phase-entry: verify R17.4 review approved status, load Brief + Kill criteria, set pacing)
- `after_implement` → `neural-dev-workflow-pr` skill (phase-exit: emit PR Contract per PRD §10.9, fill Spec Coverage block, bump R17 status, author R19 rollup, flip INDEX.md row)

**The next session should invoke `/speckit.implement` for task work** — the hooks handle the workflow ceremony automatically. Direct `neural-dev-workflow` skill invocation still works but the wired path is preferred.

---

## ★ BINDING conditions to propagate when implementation begins ★

### Phase 1 (week 2)

| ID | Condition | Owner | When |
|---|---|---|---|
| **C1** | T015 implementation MUST define explicit per-step Playwright timeout budgets summing to ≤ 20s/site (≤ 60s for 3 sites). Use `waitUntil: 'domcontentloaded'` not `'load'` for `page.goto`. Document in T015 brief or plan.md §Phase 1 Design at impl time. | T015 implementer | Phase 1 Week 2 |

C2 (impact.md Forward Contract Phase 1b/1c rows) + C3 (plan.md hour estimate) are OPTIONAL anytime polish.

### Phase 6 (week 4)

| ID | Condition | Owner | When |
|---|---|---|---|
| **C1** | T106 MUST catch ZodError BEFORE logging; emit only `{ heuristic_id?, path: errors[].path.join('.'), error_class: errors[].code }` — NEVER `errors[].message` (contains `received: <body>`). r6-ip-boundary.test.ts MUST include sentinel `NEURAL_TEST_FIXTURE_BODY` assertion. **Mirrors Phase 0b D1 pattern (T0B-004) — propagating the lesson forward.** | T106 implementer | Phase 6 Week 4 |
| **C2** | r6-ip-boundary.test.ts MUST cover BOTH (a) shaped-object Pino redaction assertions AND (b) string-interpolation anti-pattern detection. Test should fail an implementation that template-interpolates body into `logger.info('loaded ' + body)`. | T-PHASE6-TESTS author | Phase 6 Week 4 (precedes T106 per TDD) |

C3 (loadForContext stub spec) + C4 (ENOENT handling) + C5 (README dep list) are OPTIONAL.

### Phase 0b (carry-over from Session 6 — still standing)

D1 + D2 BINDING (T0B-004 + T0B-005); D3 OPTIONAL — surface when Phase 0b implementation begins (T0B tasks land week 1).

---

## Standing decisions / context

- **Walking-skeleton methodology** — week 1 ships stubbed end-to-end pipeline; same `pnpm cro:audit` demo command grows in capability each Wednesday.
- **Wednesday demo cadence** — every Wednesday, 30-min stakeholder demo. Mon: pin URLs + script. Tue: dry-run. Wed: demo + feedback log.
- **JIT analyze pattern** — analyze + R17.4 review per phase BEFORE bumping `status: draft → approved`. Never bulk-analyze 15 phases.
- **APPROVE-with-conditions pattern** — established in Phase 0b (Session 6); used in Phase 1 + Phase 6 (Session 7). Polish-grade findings that are implementation-time concerns (not spec defects) get BINDING conditions in review-notes.md.
- **Modular prompt rule (PRD §10.7)** — one task per `/speckit.implement` invocation. Context budget < 20K tokens per task prompt.
- **TDD enforcement (R3.1)** — T-PHASE*-TESTS authored FIRST; conformance tests FAIL before implementation lands.
- **R17.4 phase review template** — centralized at `docs/specs/mvp/templates/phase-review-{prompt,report.template}.md`. Three reviews so far (Phase 0b, Phase 1, Phase 6) — pattern is converging.

---

## Pending decisions (deferred, not blocking)

1. **Phase 1b + 1c folding** — week 2 ride-along vs slip to wks 3-4. Decide when Phase 1 ships in week 2.
2. **Phase 2 forward-pull** — whether to bring T-PHASE2-TYPES + T019 + T024 + T048 into week 4 to ease week-5 load. Decide when Phase 6 ships in week 4.
3. **Next analyze target** — Phase 4 (week-3 dependency; T070 RLS first runtime + T073 LLM cornerstone temperature=0 first runtime + R6 LangSmith trace channel). Recommended JIT timing: just-before week 3 starts. NOT urgent in this implementation session.

---

## What the next (implementation) session should do

### Suggested first action: start week 1 implementation

Per [implementation-roadmap.md §6 Week 1](../implementation-roadmap.md), week 1 lands:
- T-PHASE0-TEST + T001-T005 (Phase 0 setup) — **APPROVED**
- T014 forward-pulled from Phase 1 (PageStateModel schema) — **APPROVED**
- T101 forward-pulled from Phase 6 (HeuristicSchemaExtended) — **APPROVED**
- T0B-001..T0B-005 (Phase 0b infra) — **APPROVED**
- T-SKELETON-001..010 (walking-skeleton stubs)

**Recommended order (per roadmap):**
1. T-PHASE0-TEST first (R3.1 TDD — conformance tests FAIL before T001 lands)
2. T001 → T002 → T003 → T004 → T005 (Phase 0 setup — sequential)
3. T014 schema + T101 schema (forward-pulls — independent, can parallel)
4. T0B-001..T0B-005 (Phase 0b infra — partly parallel)
5. T-SKELETON-001..010 (skeleton stubs — last)

**Use `/speckit.implement <task-id>` per task** — hooks handle R17.4 verification + Brief + Kill criteria + PR Contract automatically.

**One task per prompt** (PRD §10.7). Context budget < 20K tokens per invocation.

### Reading order for new Claude session

1. `CLAUDE.md` (auto-loaded)
2. **This file** (`docs/specs/mvp/sessions/session-2026-05-01-handover.md`) — canonical handover
3. `docs/specs/mvp/sessions/session-2026-04-30-handover.md` — Session 6 predecessor (Phase 0 + 0b context)
4. `docs/specs/mvp/phases/INDEX.md` v1.6 — phase decision table
5. `docs/specs/mvp/implementation-roadmap.md` v0.3 — week-by-week tasks
6. `docs/specs/mvp/phases/phase-0-setup/{README,tasks}.md` — first phase to implement
7. Per-task: invoke `/speckit.implement <task-id>` and let the hook chain load the right context

### What the next session should NOT touch unless asked

- Phase 0, 0b, 1, 6 spec/plan/tasks/impact (status: approved — per R17.4 don't silent-edit; any change requires version bump + delta + R17.4 re-review if material)
- review-notes.md files (audit trail; immutable once written)
- Constitution.md and `.specify/memory/constitution.md` sync copy
- PRD.md (locked at v1.2.1)
- Templates at `docs/specs/mvp/templates/` (settled)

---

## Files in working tree (state at session end)

**All changes committed.** Working tree clean. Recent commit chain:
- `4bd1f5c` Session 7 — Phase 1 v0.3 + Phase 6 v0.4 approved
- `e0ed5a0` R6: /speckit.implement ↔ neural-dev-workflow integration
- `26b7a72` R5: README v2.0 → v2.1
- `2ee7914` Round 1-4 doc-hygiene sync (README v2.0, CLAUDE.md, workflow v1.1, constitution v1.3, PRD v1.2.1, Phase 0 README v1.1, INDEX v1.5)
- `cc657da` doc hygiene sync (initial)

---

## Key handover principle (unchanged from Session 6)

All session state lives ON DISK in `/NBA` — git-tracked + team-visible. The new Claude session does NOT need to replay the conversation. It loads:
- CLAUDE.md (auto-loaded — with §8c + §8d from Session 6)
- This file (Session 7 handover)
- Session 6 handover (Phase 0 + 0b context)
- Auto-memory pointer at `C:\Users\HP\.claude\projects\C--Sabari-Neural-NBA\memory\` — points back here
- The artifacts on disk (spec/plan/tasks/impact/review-notes per phase)

From there it can pick up at the first implementation task.

---

## Spec-prep state ledger (after this session)

| Phase | Status | Approved in | Implementation timing |
|---|---|---|---|
| Phase 0 (Setup) | ✅ approved | Session 6 | Week 1 |
| Phase 0b (Heuristics) | ✅ approved | Session 6 | Week 1 |
| **Phase 1 (Perception)** | ✅ **approved** | **Session 7** | **Week 1 (T014) + Week 2 (full)** |
| Phase 1b (Perception Ext v2.4) | ⚪ draft | future JIT | Week 3 (ride-along TBD) |
| Phase 1c (PerceptionBundle v2.5) | ⚪ draft | future JIT | Week 3+ |
| Phase 2 (MCP Tools) | ⚪ draft | future JIT | Week 4 (or partial week 4 forward-pull) |
| Phase 3 (Verification) | ⚪ draft | future JIT | Week 5 |
| Phase 4 (Safety + Infra + Cost) | ⚪ draft | **next analyze target** | Week 3 |
| Phase 4b (Context Capture) | ⚪ draft | future JIT | Week 6 |
| Phase 5 (Browse MVP) | ⚪ draft | future JIT | Week 7-8 |
| Phase 5b (Multi-viewport) | ⚪ draft | future JIT | Week 11 |
| **Phase 6 (Heuristic KB)** | ✅ **approved** | **Session 7** | **Week 1 (T101) + Week 4 (full)** |
| Phase 7 (Analysis) | ⚪ draft | future JIT | Week 5-6 |
| Phase 8 (Orchestrator) | ⚪ draft | future JIT | Week 8-9 |
| Phase 9 (Foundations + Delivery) | ⚪ draft | future JIT | Week 10-12 |

**4 of 15 phases approved.** Implementation can begin with full week-1 + week-2 spec-prep coverage.
