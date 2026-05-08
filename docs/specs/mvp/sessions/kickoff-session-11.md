# Session 11 — Kickoff Prompt (copy-paste verbatim into new Claude Code session)

> **Why this file exists:** Session 10 closed week-1 walking-skeleton work — 10/10 T-SKELETON tasks done + demo prep #1+#2 done + Wednesday demo executed (#3 screenshots deferred per engineering-lead direction). To preserve context budget for week-2 Phase 1 Browser Perception Foundation work, Session 10 broke + authored this kickoff so Session 11 boots cleanly. Paste the block below verbatim as your first message.

> **Author:** Claude Opus 4.7 (Session 10 close-out, 2026-05-06).

> **Last updated:** 2026-05-06.

---

## Copy-paste prompt (start here)

```
Continuing Neural MVP — week 2 Phase 1 Browser Perception Foundation. Week 1
walking-skeleton COMPLETE 2026-05-06 (Session 10) — 12 commits pushed to
feat/week-1-walking-skeleton in Session 10 alone (10 T-SKELETON tasks +
1 wk-01 demo script + 1 demo-prep status flip + 1 close-out = 12; 28
cumulative on branch since branch-cut). T-SKELETON-001..010 ALL DONE;
Wednesday demo gate PASSED via pnpm test:integration 12/12 green;
138 tests total (126 unit + 12 integration). Branch pushed to origin.

Read these in order BEFORE doing anything:
1. CLAUDE.md (auto-loaded — confirm §8c per-phase artifact maintenance +
   §8d R17.4 review gate present)
2. docs/specs/mvp/sessions/session-handover.md v1.5 ← rolling handover
   (block 1 has Day 1+2+3 commit ledgers + remaining task plan; block 2
   has Phase 1 C1 BINDING active + Phase 6 C1+C2 BINDING active for week-4
   work; block 3 has PD-04 RESOLVED + PD-05 still open + PD-07 RESOLVED;
   block 5 has Sessions 6-10 narratives; block 6 demo URL still locked)
3. docs/specs/mvp/phases/INDEX.md v1.9 ← Phase 0 row 🟢 implemented;
   Phase 0b row 🟡 in-progress (infra complete; content week 4); Phase 1
   + Phase 6 rows ✅ approved · 🟡 partial (T014 + T101 forward-pulled
   week 1; rest of Phase 1 lands week 2; rest of Phase 6 lands week 4)
4. docs/specs/mvp/implementation-roadmap.md v0.8 ← week-by-week plan;
   §7 Week 2 has Phase 1 task list verbatim (T-PHASE1-TESTS, T006-T013,
   T015); §8 promotion table marks T-SKELETON-002 → real BrowserManager
5. ACTIVE PHASE: docs/specs/mvp/phases/phase-1-perception/
   {README.md, spec.md, tasks.md, plan.md, impact.md} ← read in this
   order; READMEs are ~150 token summaries per CLAUDE.md §1 progressive
   disclosure
6. packages/agent-core/src/perception/types.ts (T014 PageStateModel —
   already landed Day 1; Phase 1 T013 ContextAssembler will produce
   real PageStateModel matching this schema instead of week-1 stub)
7. packages/agent-core/src/browser-runtime/BrowserManager.ts (T-SKELETON-002
   week-1 stub returning Peregrine PDP fixture; Phase 1 T006+T013
   supersedes with real Playwright capture in week 2 — R20 impact.md
   required at supersession per roadmap §8 promotion table)
8. tests/acceptance/walking-skeleton.spec.ts (T-SKELETON-010 acceptance
   suite; stays real through wk 12; weeks 5+ un-skip behavior tests
   against real Claude output once Phase 7 T117 lands)

Do NOT load:
- All 15 phase folders (progressive disclosure per CLAUDE.md §1)
- Predecessor per-session handover archives (block 5 of rolling handover
  summarizes Sessions 6-10)
- phase-0-setup/ or phase-0b-heuristics/ artifacts (closed; rollup at
  phase-0-setup/phase-0-current.md is the compressed view if you need
  Phase 0 context; Phase 0b infra summarized in INDEX v1.9 changelog)
- T-SKELETON-001..010 implementation files unless touching them in
  Phase 1 supersession (handover block 5 Session 10 narrative + INDEX
  week-1 progress entries summarize what each shipped)

Current state (verify against handover block 1):
- Branch: feat/week-1-walking-skeleton @ <HEAD after close-out push>
  (verify via `git log --oneline -1`; expect close-out commit "docs(handover):
  Session 10 close-out" with handover v1.5 + INDEX v1.9 + Session 11 kickoff)
- Phase 0: 🟢 implemented (5/5 ACs green); rollup at phase-0-current.md
- Phase 0b: ✅ approved (v0.5) · 🟡 infra COMPLETE (T0B-001..T0B-005 ✅
  done 2026-05-06); content (T103/T104/T105) pending week 4
- Phase 1: ✅ approved · 🟡 T014 done standalone (forward-pulled Day 1
  Session 8 commit 077ec86); rest of Phase 1 (T006-T013 + T015 + T-PHASE1-*
  polish) PENDING week 2 — THIS SESSION
- Phase 6: ✅ approved · 🟡 T101 done standalone (forward-pulled Day 1
  Session 8 commit 3d2119c); rest of Phase 6 pending week 4
- 4 of 15 phases approved · 1 implemented · 3 partial
- agent-core exports map: . | ./observability | ./perception/types |
  ./analysis/heuristics/types | ./audit (last added T-SKELETON-001 Day 2)
- agent-core dist/ is BUILT (cached via Turbo; required for runtime)
- apps/cli has Vitest wired (heuristic:lint conformance suite)
- Test surface: 138 tests pass total (108 agent-core unit + 18 cli
  conformance + 12 integration via pnpm test:integration)
- Walking-skeleton acceptance suite at tests/acceptance/walking-skeleton.spec.ts
  is THE Phase 1 supersession gate — must stay green through T006-T015

Remaining week-2 tasks per AUTHORITATIVE phase-1-perception/tasks.md v0.5:
   (NOTE: this kickoff list was misnumbered in v1.5 — corrected 2026-05-08
    Session 12 master orchestrator Gate 1 REVISE per finding L2-F1.
    If anything below disagrees with tasks.md v0.5, tasks.md wins.)

☐ T-PHASE1-TESTS — Author 9 conformance test stubs + 1 integration test stub
   (TDD R3.1 first; full Brief format added in tasks.md v0.5; expected to
   FAIL initially until T006-T015 close the loop)
☐ T006 — BrowserManager (Playwright Chromium wrapper implementing the
   BrowserEngine adapter; first R9 concrete adapter)
☐ T007 — StealthConfig (REDUCED scope: per-session UA + viewport + WebGL
   fingerprint rotation; NO playwright-extra; full stealth deferred to v1.1)
☐ T008 — AccessibilityExtractor (page.accessibility.snapshot wrapper;
   warns at <50 nodes)
☐ T009 — HardFilter (removes hidden/disabled/aria-hidden/zero-dim;
   degenerate-page floor per spec.md AC-04 v0.2)
☐ T010 — SoftFilter top-30 ranking (R4.4 multiplicative-decay invariant;
   verifiable via grep test in T-PHASE1-TESTS)
☐ T011 — MutationMonitor (addInitScript-injected MutationObserver; 500 ms
   quiescence window; 10 s timeout)
☐ T012 — ScreenshotExtractor (Playwright JPEG quality 80 + Sharp
   recompression on >150 KB; ≤1280 px wide)
☐ T013 — ContextAssembler (composes real PageStateModel matching T014
   schema; deterministic shrink ladder; supersedes T-SKELETON-002 stub) —
   R20 forward-compatibility seam already covered by impact.md v0.3.1
☐ T015 — Phase 1 integration test (3-site fixture: example.com + amazon.in
   + Peregrine PDP per PD-04 RESOLVED; C1 BINDING per-step Playwright
   timeout budgets ≤20 s/site / ≤60 s/3-sites with waitUntil:'domcontentloaded'
   — budget table now in plan.md §"T015 integration test timeout budget"
   v0.3.1; T015 brief in tasks.md v0.5 cites it explicitly)
☐ Phase 1 polish tasks: T-PHASE1-DOC + T-PHASE1-LOGGER + T-PHASE1-ADAPTERS-README
   + T-PHASE1-ROLLUP (final R17 lifecycle bump approved → implemented +
   R19 phase-1-current.md rollup per CLAUDE.md §8c)

(T014 PageStateModel schemas was forward-pulled to week 1 commit `077ec86`
 per implementation-roadmap.md §6; already DONE.)

Pre-implementation gates (per CLAUDE.md §8c + §8d):
1. Run /speckit.analyze on Phase 1 — re-verify mechanical consistency
   since Session 7 R17.4 approval (5 days ago; T101 forward-pull may
   have downstream impacts to check, e.g., T013 ContextAssembler's
   PageStateModel composition consuming HeuristicExtended in week-2
   demo flow)
2. Resolve any CRITICAL/HIGH analyze findings via R11.4 patches before
   implementing
3. Phase 1 status already approved per Session 7 R17.4 review — no new
   R17.4 review needed UNLESS analyze surfaces material drift
4. Apply C1 BINDING condition at T015 implementation time:
   - Per-step Playwright timeout budgets summing to ≤20s/site (≤60s
     for 3 sites)
   - Use waitUntil: 'domcontentloaded' (NOT 'load') for page.goto
   - Document budget in T015 brief or plan.md §Phase 1 Design at
     impl time

Demo target URL (locked from Session 8 PD-04; reflected in roadmap v0.8 +
T-SKELETON-002 Peregrine fixture + walking-skeleton.spec.ts):
  https://www.peregrineclothing.co.uk/collections/t-shirts/products/heavyweight-t-shirt?colour=Navy

Demo command (Wednesday demo unchanged — same command, real Chromium now):
  pnpm cro:audit --url='https://www.peregrineclothing.co.uk/collections/t-shirts/products/heavyweight-t-shirt?colour=Navy'

Wednesday week-2 demo headline (per roadmap §7 Week 2):
"Same pnpm cro:audit command. Real Chromium opens. Real AX-tree extracted.
Same output shape but it's all REAL perception data now."

Operating protocols (carried from Sessions 8-10):
1. ONE TASK PER /speckit.implement INVOCATION (no batching) — Session 10
   shipped 10 T-SKELETON tasks via this discipline; 5 lightweight Option G
   roadmap patches caught cleanly (v0.3 → v0.4 → v0.5 → v0.6 → v0.7 → v0.8)
2. EVERY TASK REPORT ENDS WITH MANUAL VALIDATION BLOCK in Input → Expected
   Output format
3. COMMIT CADENCE: one commit per task. Spec patches (R11.4 defects) ship
   as SEPARATE commits BEFORE the implementing task per Day 1 protocol —
   OR rolled into same commit as Option G when artifact is status:draft
   AND patch is mechanical/non-AC-changing (5 Option G patches in
   Session 10 set the precedent)
4. SYNC VERIFY confirmed throughout Session 10: user reviews manual
   validation block before each commit. Recommended for Phase 1 T006-T013
   (real Playwright; first network/browser side-effects in Neural codebase)
5. TASKS NOT IN PER-PHASE tasks.md (T-SKELETON-* sequencing-only) — N/A
   for Session 11; Phase 1 is fully task-tracked at phase-1-perception/tasks.md

Environment state (verified end of Session 10; should still hold):
- Docker 29.4.1 daemon; pgvector:pg16 + valkey:8 + mailpit healthy
  (confirm with: docker compose ps)
- pnpm 10.33.3; Node v24.11.0 local (CI uses Node 22 per engines.node:"22")
- Microsoft VCRedist installed (UCRT API sets — required for turbo.exe +
  Playwright Chromium installation)
- agent-core dist/ built (cached via Turbo)
- All 28 cumulative branch commits pushed to origin (Session 10 close-out
  pushed; branch tracks origin/feat/week-1-walking-skeleton)
- .claude/settings.local.json STILL modified (PD-05 cosmetic; intentionally
  not staged in any Session 6-10 commit; consider git rm --cached fix
  whenever convenient)

Pending decisions to surface FIRST in your acknowledgement:
- PD-01 NEW for Session 11: Phase 1b + 1c folding decision. Per roadmap §11
  cross-references: "Phase 1b + 1c folding: confirm with engineering lead
  whether v2.4 perception extensions (T1B-001..T1B-012) and v2.5
  PerceptionBundle envelope (T1C-001..T1C-012) ride alongside Phase 1 in
  week 2 OR slip to weeks 3-4. Current draft assumes week 2 ride-along;
  if too heavy, split into a week-2/3 stretch." Phase 1 has 10 tasks
  alone; adding 24 more tasks (12+12) for 1b+1c is ~3.4× scope expansion.
  Recommend: SLIP 1b + 1c to weeks 3-4 — Phase 1 alone is a substantial
  week (real Playwright is the first network side-effect in the codebase;
  C1 BINDING + R20 impact.md + 3-site fixture set = ~15 LOC-day equivalent
  of careful work). Decide at session start.
- PD-04 RESOLVED: Phase 1 T015 3-site fixture set MUST include Peregrine
  PDP per Session 8 PD-04 effective resolution + roadmap v0.8 + walking-
  skeleton.spec.ts already asserts against Peregrine. Other 2 sites:
  Phase 1 spec.md AC-10 cites example.com (simple control) + amazon.in
  (complex/bot detection) per Session 7 review notes. T015 implementer
  applies the locked set.
- PD-05 STILL OPEN: .claude/settings.local.json modified-forever cosmetic
  issue; consider git rm --cached fix in Session 11 git-hygiene window
- PD-07 RESOLVED 2026-05-05/06 (Session 10): raw process.argv in
  apps/cli; commander/yargs deferred to Phase 5. T-SKELETON-001 commit
  20d5f95 applied. No re-decision needed Session 11; just inherit.

Acknowledge by:
1. CONFIRM handover v1.5 loaded cleanly (block 1 phase status table
   accurate? block 2 Phase 1 C1 BINDING visible? block 3 PD-04 RESOLVED +
   PD-05 still open + PD-07 RESOLVED visible? block 5 Session 10
   narrative makes sense? block 6 Peregrine URL still locked?)
2. SURFACE date check: /currentDate reading — Session 11 boots ≥1 day
   after Wednesday 2026-05-06 demo; expected /currentDate = 2026-05-07
   (Thu) or later
3. SURFACE PD-01 (Phase 1b+1c folding decision) — your recommendation
4. ASK whether to proceed with /speckit.analyze on Phase 1 first
   (CLAUDE.md §8d gate) OR jump straight to T-PHASE1-TESTS
   (technically allowed since Phase 1 already at status:approved per
   Session 7; analyze re-run is best-practice but not blocking)
```

---

## Why this kickoff prompt is structured the way it is

Modeled on the Session 10 kickoff prompt the user authored at Session 10 start. Key differences from that earlier prompt:

| Element | Session 10 kickoff | This (Session 11) kickoff |
|---|---|---|
| Reading order | handover v1.3 + INDEX v1.8 | handover v1.5 + INDEX v1.9 + active phase folder phase-1-perception/ |
| State snapshot | Branch @ HEAD `a141a49`; walking-skeleton 0/10 | Branch @ HEAD `<close-out>`; walking-skeleton 10/10 ★ COMPLETE ★ |
| Standing conditions | D1+D2 SATISFIED (Phase 0b) + Phase 1 C1 BINDING + Phase 6 C1+C2 BINDING | Phase 1 C1 BINDING ACTIVE for T015 implementation; Phase 6 conditions still pending week 4 |
| Remaining tasks | 13 (10 skeleton + 3 demo) | 10 (Phase 1 T-PHASE1-TESTS + T006-T013 + T015 + 4 polish tasks) |
| Pre-implementation gates | T-SKELETON tasks not phase-bound (no R17.4 needed) | Phase 1 fully phase-bound — re-run /speckit.analyze + apply C1 BINDING at T015 |
| Operating protocols | One-task-per-invocation + sync verify confirmed | Same; carried forward Session 8 → 9 → 10 → 11; 5 Option G patches in Session 10 set the lightweight-spec-patch precedent |
| Pending decisions to surface | PD-06 (date) + PD-07 (CLI library) | PD-01 (Phase 1b+1c folding) + PD-04 reaffirm + PD-05 cosmetic + PD-07 inherited |
| Acknowledge prompts | Confirm handover + verify date + surface PD-07 + ask cadence | Confirm handover + verify date + surface PD-01 + ask /speckit.analyze first |

The prompt is designed to be **self-contained**: a fresh Claude Code session pasting it can boot to productive Phase 1 work in ~3 min without re-reading Session 6/7/8/9/10 archives.

---

## What Session 11 should NOT do (anti-instructions)

- **Do NOT load all 15 phase folders** — only load `phase-1-perception/` files; predecessor phases summarized in handover block 5 + INDEX week-1 progress
- **Do NOT modify T-SKELETON-001..010 implementation files unless touching them via Phase 1 supersession** — those are stable through wk 12 per roadmap §8 promotion table; only T-SKELETON-002 (BrowserManager) gets superseded by Phase 1 T006+T013 in week 2; any other touch requires R20 impact.md
- **Do NOT modify T014 (PageStateModel) schema** — Phase 1 implementation CONSUMES this schema; modifying requires Phase 1 spec amendment + R20 impact.md per CLAUDE.md §1c
- **Do NOT skip /speckit.analyze on Phase 1 before implementation begins** — Session 7 R17.4 approval was 5 days ago; analyze re-run catches drift since approval (specifically: T101 + T014 forward-pulls + Phase 0b infra interactions may surface impact). Best-practice gate per CLAUDE.md §8d.
- **Do NOT bump Phase 1 status to `implemented` until ALL Phase 1 tasks land + T-PHASE1-ROLLUP authored** — partial-implementation status stays 🟡 in-progress per CLAUDE.md §8c; final flip 🟡 → 🟢 happens with last polish task
- **Do NOT break the walking-skeleton acceptance suite** at `tests/acceptance/walking-skeleton.spec.ts` — Phase 1 supersession of T-SKELETON-002 must keep AC-W1..W7 green through week 2 (T-SKELETON-002 placeholder is replaced; AC-W4 locked observation substrings still need to come from upstream EvaluateNode T-SKELETON-004 stub which is unchanged)
- **Do NOT skip C1 BINDING at T015 implementation** — Session 7 review made this BINDING (per-step Playwright timeout budgets ≤20s/site / ≤60s/3-sites; waitUntil:'domcontentloaded'); enforce at T015 brief or plan.md §Phase 1 Design

---

## Cross-references

- [`session-handover.md`](session-handover.md) v1.5 — rolling handover (load this first per the kickoff)
- [`../phases/INDEX.md`](../phases/INDEX.md) v1.9 — phase decision table
- [`../implementation-roadmap.md`](../implementation-roadmap.md) v0.8 — week-by-week plan; §7 Week 2 has Phase 1 task list
- [`../phases/phase-1-perception/`](../phases/phase-1-perception/) — Phase 1 spec corpus (active phase folder for Session 11)
- [`../phases/phase-1-perception/review-notes.md`](../phases/phase-1-perception/review-notes.md) v1.0 — Session 7 R17.4 review with C1 BINDING + C2/C3 OPTIONAL
- [`../phases/phase-0-setup/phase-0-current.md`](../phases/phase-0-setup/phase-0-current.md) — Phase 0 rollup (compressed view; load only if needed)
- Predecessor per-session handovers (do NOT load by default; rolling handover block 5 summarizes):
  - [`session-2026-04-30-handover.md`](session-2026-04-30-handover.md) — Session 6
  - [`session-2026-05-01-handover.md`](session-2026-05-01-handover.md) — Session 7
- Predecessor kickoff prompts (do NOT load by default):
  - [`kickoff-session-10.md`](kickoff-session-10.md) — Session 10 kickoff (Session 9 → 10 boot)

---

*End of Session 11 kickoff. If pasting this into a fresh Claude Code session: just copy the prompt block under "Copy-paste prompt (start here)" — that's the complete bootstrap.*
