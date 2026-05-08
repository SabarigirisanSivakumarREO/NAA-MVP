# Session 10 — Kickoff Prompt (copy-paste verbatim into new Claude Code session)

> **Why this file exists:** Session 9 closed Phase 0b infrastructure layer mid-Day-2 of week 1 walking-skeleton. To preserve context budget for the more code-intensive T-SKELETON tasks, Session 9 broke + authored this kickoff so Session 10 boots cleanly. Paste the block below verbatim as your first message.

> **Author:** Claude Opus 4.7 (Session 9 close-out, 2026-05-06).

> **Last updated:** 2026-05-06.

---

## Copy-paste prompt (start here)

```
Continuing Neural MVP week-1 implementation. Day 2 of week-1 walking-skeleton
shipped 2026-05-06 (Session 9) — 6 commits pushed to feat/week-1-walking-skeleton
ending at a141a49 (16 cumulative commits on branch since branch-cut). Phase 0b
INFRASTRUCTURE LAYER COMPLETE (T0B-001..T0B-005 ✅). Days 2-3 (walking-skeleton
stubs T-SKELETON-001..010) + Days 3-4 (demo prep) + Wednesday demo (TODAY
2026-05-06) remain.

Read these in order BEFORE doing anything:
1. CLAUDE.md (auto-loaded — confirm §8c + §8d present)
2. docs/specs/mvp/sessions/session-handover.md v1.3 ← rolling handover
   (block 1 has Day 1 + Day 2 commit ledgers + remaining task plan; block 2 has
   D1+D2 SATISFIED markers + D3 deferred-to-v1.0.1 rationale; block 3 has PD-06
   resolved + PD-07 NEW; block 5 has Session 9 narrative; block 6 demo URL)
3. docs/specs/mvp/phases/INDEX.md v1.8 ← Phase 0 row 🟢 implemented; Phase 0b
   row 🟡 in-progress (infra complete; content week 4)
4. docs/specs/mvp/implementation-roadmap.md v0.3 ← week-by-week plan;
   §6 has T-SKELETON-001..010 task definitions verbatim
5. NO active phase folder (T-SKELETON tasks live ONLY in implementation-
   roadmap.md, not in any per-phase tasks.md)
6. packages/agent-core/src/perception/types.ts (T014 PageStateModel — already
   landed Day 1; T-SKELETON-002 returns synthetic PageStateModel matching this)
7. packages/agent-core/src/analysis/heuristics/types.ts (T101
   HeuristicSchemaExtended — already landed Day 1; T-SKELETON-003 returns 3
   synthetic heuristics matching this)

Do NOT load:
- All 15 phase folders (progressive disclosure per CLAUDE.md §1)
- Predecessor per-session handover archives (block 5 of rolling handover
  summarizes Sessions 6-9)
- phase-0-setup/ or phase-0b-heuristics/ artifacts (closed; rollup at
  phase-0-setup/phase-0-current.md is the compressed view if you need Phase 0
  context; Phase 0b infra is summarized in INDEX.md v1.8 changelog section)

Current state (verify against handover block 1):
- Branch: feat/week-1-walking-skeleton @ a141a49 (clean, 0 unpushed)
- Phase 0: 🟢 implemented (5/5 ACs green); rollup at phase-0-current.md
- Phase 0b: ✅ approved (v0.5) · 🟡 infra COMPLETE (T0B-001..T0B-005 ✅
  done 2026-05-06); content (T103/T104/T105) pending week 4
- Phase 1: ✅ approved · 🟡 T014 done standalone (forward-pulled Day 1)
- Phase 6: ✅ approved · 🟡 T101 done standalone (forward-pulled Day 1)
- 4 of 15 phases approved · 1 implemented · 3 partial
- agent-core exports: . | ./observability | ./perception/types |
  ./analysis/heuristics/types
- agent-core dist/ is BUILT (cached); required for runtime imports of
  @neural/agent-core/analysis/heuristics/types subpath
- apps/cli now has Vitest wired (was deferred to Phase 5+ in Phase 0 T003;
  revoked by T0B-004 AC-04 requirement; minimal vitest.config.ts present;
  test script flipped from echo to vitest run --passWithNoTests; deps:
  @neural/agent-core workspace + glob + vitest + tsx)
- Test surface: 73 tests pass total (55 agent-core unit + 18 cli conformance)
- pnpm heuristic:lint script wired (root + apps/cli/package.json bin entry)
- .gitignore includes .heuristic-drafts/ (T0B-004 commit b861f04)

Remaining week-1 tasks (13 total):
DAYS 2-3 — Walking-skeleton stubs (10 tasks; T-SKELETON-001..010)
☐ T-SKELETON-001 — REAL orchestrator at packages/agent-core/src/audit.ts +
   apps/cli/src/commands/audit.ts (stays through wk 12; calls 8 stub
   functions in order: capture → loadHeuristics → evaluate → critique →
   ground → annotate → store → report)
☐ T-SKELETON-002 — stubBrowserCapture: BrowserManager.capture(url) returns
   hardcoded synthetic Peregrine PDP PageStateModel matching T014 schema;
   loaded from packages/agent-core/tests/fixtures/perception/peregrine-pdp.json
   (NEW)
☐ T-SKELETON-003 — stubLoadHeuristics: HeuristicLoader.loadAll() returns 3
   synthetic heuristics from packages/agent-core/tests/fixtures/heuristics/
   skeleton-{1,2,3}.json (NEW); body text marked "TEST FIXTURE — not a real
   heuristic" + reuses NEURAL_TEST_FIXTURE_BODY sentinel pattern from D1
   (so future R6 conformance tests can assert)
☐ T-SKELETON-004 — stubEvaluate: EvaluateNode returns 2 hardcoded raw
   findings tagged { source: 'skeleton-stub' } per implementation-roadmap.md §6
☐ T-SKELETON-005 — stubCritique: SelfCritiqueNode passthrough verdict='KEEP'
☐ T-SKELETON-006 — stubGround: EvidenceGrounder passthrough; rejected[] empty
☐ T-SKELETON-007 — stubAnnotate: AnnotateNode no-op
☐ T-SKELETON-008 — stubStore: StoreNode writes findings to ./out/
   <slug>-findings.json (no DB; Phase 4 not yet landed)
☐ T-SKELETON-009 — stubReport: Report.render returns plain-text; written to
   ./out/<slug>-audit.txt
☐ T-SKELETON-010 — Real Playwright Test acceptance at
   tests/acceptance/walking-skeleton.spec.ts asserting pnpm cro:audit
   --url=<peregrine PDP> exits 0 + writes ./out/<slug>-audit.txt with
   ≥1 fake finding line; runs in <30s

DAYS 3-4 — Demo prep (3 items)
☐ Pin Peregrine URL in demo script
☐ Author docs/specs/mvp/demo-scripts/wk-01.md dry-run + capture screenshots
☐ Wednesday demo (TODAY 2026-05-06) + post-feedback log

Demo target URL (locked from Session 8 PD-04 effective resolution):
  https://www.peregrineclothing.co.uk/collections/t-shirts/products/heavyweight-t-shirt?colour=Navy

Demo command (Wednesday demo):
  pnpm cro:audit --url='https://www.peregrineclothing.co.uk/collections/t-shirts/products/heavyweight-t-shirt?colour=Navy'

Operating protocols (carried from Sessions 8-9):
1. ONE TASK PER /speckit.implement INVOCATION (no batching) — lowest margin
   of error per Day 1+2 evidence (4 R11.4 spec defects caught cleanly because
   each task had its own focused verify cycle: 2 in Phase 0 Day 1, 2 in Phase 0b
   Day 2 across Waves 1+2)
2. EVERY TASK REPORT ENDS WITH MANUAL VALIDATION BLOCK in Input → Expected
   Output format so the user can verify with their own eyes (not just trust
   automated tests)
3. COMMIT CADENCE (iii) hybrid: one commit per task. Spec patches (R11.4
   defects) ship as SEPARATE commits BEFORE the implementing task per Day 1
   protocol "fix spec before implementing"
4. HYBRID CADENCE confirmed mid-Session 9: synchronous verify (user reviews
   manual validation block before proceeding) for high-stakes BINDING tasks;
   continuous (fire next task immediately) for template-similar tasks. User
   chooses per task at session start.

Environment state (verified end of Day 2; should still hold):
- Docker 29.4.1 daemon; pgvector:pg16 + valkey:8 + mailpit healthy
  (confirm with: docker compose ps)
- pnpm 10.33.3; Node v24.11.0 local (CI uses Node 22 per engines.node:"22")
- Microsoft VCRedist installed (UCRT API sets — required for turbo.exe +
  future Playwright Chromium)
- agent-core dist/ built (cached via Turbo; Vitest + lint CLI both depend
  on the built dist for @neural/agent-core/* exports-map resolution)
- All 16 cumulative branch commits pushed; branch tracks origin
- .claude/settings.local.json STILL modified (PD-05 cosmetic; intentionally
  not staged in any Day 1+2 commit)

Pending decisions to surface FIRST in your acknowledgement:
- PD-06 RESOLVED 2026-05-06: demo IS Wednesday 2026-05-06 (TODAY at session
  10 boot — verify against /currentDate; if /currentDate is 2026-05-05 then
  demo is tomorrow; if 2026-05-06 then demo is today)
- PD-07 NEW: T-SKELETON-001 will wire an audit subcommand at apps/cli/src/
  commands/audit.ts. Phase 0 T003 used raw process.argv parsing (no
  commander/yargs library) per "minimal until Phase 5 subcommand surface
  forces a proper CLI library". T-SKELETON-001 is THAT moment. Decide:
  (a) Add commander.js or yargs as apps/cli devDep + wire properly;
  (b) Continue with raw process.argv parsing (simpler; matches Phase 0 T003);
  (c) Defer decision to Phase 5; use minimal raw parsing for T-SKELETON-001.
  Recommend (b) or (c) — keep walking-skeleton scope tight; CLI library
  swap is trivial later.
- PD-05 STILL OPEN: .claude/settings.local.json modified-forever cosmetic
  issue; fix anytime convenient.

Acknowledge by:
1. CONFIRM handover v1.3 loaded cleanly (block 1 phase status table accurate?
   block 2 D1+D2 SATISFIED markers visible? block 5 Session 9 narrative makes
   sense? block 6 Peregrine URL still locked?)
2. SURFACE date check: /currentDate reading + whether demo is TODAY or
   TOMORROW based on that reading
3. SURFACE PD-07 (audit subcommand CLI library decision) — your recommendation
4. ASK whether to proceed with /speckit-implement T-SKELETON-001 now OR resolve
   PD-07 + cadence question first (sync vs continuous for T-SKELETON-001
   specifically — it's REAL code that stays through wk 12; sync verify
   recommended)
```

---

## Why this kickoff prompt is structured the way it is

Modeled on the Session 8 kickoff prompt the user provided at Session 8 start. Key differences from that earlier prompt:

| Element | Session 8 kickoff | This (Session 10) kickoff |
|---|---|---|
| Reading order | Sessions 6 + 7 archives + handover v1.0 | handover v1.3 only (rolling) + INDEX v1.8; predecessor archives explicitly DO NOT load |
| State snapshot | Branch @ HEAD `6c56d70`; Phase 0 done | Branch @ HEAD `a141a49`; Phase 0 done + Phase 0b infra done |
| Standing conditions | D1 + D2 BINDING active; D3 OPTIONAL | D1 + D2 SATISFIED (annotated for audit); D3 deferred to v1.0.1 |
| Remaining tasks | 18 (5 infra + 10 skeleton + 3 demo) | 13 (10 skeleton + 3 demo) |
| Operating protocols | Confirmed mid-Day-1 | Carried forward Day 1 → Day 2 → Day 3 |
| Pending decisions to surface | PD-06 (date math) | PD-06 RESOLVED + PD-07 NEW (CLI library) |
| Acknowledge prompts | Confirm handover + surface PD-06 + ask about demo timing | Confirm handover + verify date + surface PD-07 + ask about T-SKELETON-001 cadence |

The prompt is designed to be **self-contained**: a fresh Claude Code session pasting it can boot to productive work in ~2 min without re-reading Session 6/7/8/9 archives.

---

## What Session 10 should NOT do (anti-instructions)

- **Do NOT re-load `.heuristic-drafts/`** — that directory MUST stay gitignored per R6.1; if Session 10 needs to draft a heuristic it should use a Claude Code subagent or one-off script (drafting subprocess isolation per `heuristics-repo/README.md` §3)
- **Do NOT re-author Phase 0b templates** — T0B-001..T0B-005 are DONE; modifying them requires a Phase 0b spec.md amendment + R17 lifecycle bump + new commit chain
- **Do NOT modify T101 or T014 schemas** — both are upstream contracts now consumed by Phase 0b infra + about to be consumed by T-SKELETON-002/003; contract-modification needs Phase 1 + Phase 6 spec coordination per R20
- **Do NOT skip the R11.4 protocol** — if a 5th spec defect surfaces in T-SKELETON work (no specific predictions; pattern just demands vigilance), surface it BEFORE implementing per Day 1+2 cadence; the user's PATH A authorization is for Phase 0b §9.1 → T101 supersession only, NOT a blanket "patch any spec drift you find" license
- **Do NOT bump Phase 0b status to `implemented` yet** — content layer (T103/T104/T105) still pending week 4; INDEX row 0b stays 🟡 until Phase 6 T112 cross-phase acceptance ships in week 4
- **Do NOT auto-flip T-SKELETON-001 stays-real-through-wk-12 status** — the orchestrator IS real on Day 1+ but per §6 each subsequent T-SKELETON week has stub-to-real promotion entries; T-SKELETON-001 stays a "pass-through orchestrator" during week 1 → upgrades to wrap LangGraph subgraphs in week 8 (per implementation-roadmap.md §7 week 8 promotion table)

---

## Cross-references

- [`session-handover.md`](session-handover.md) v1.3 — rolling handover (load this first per the kickoff)
- [`../phases/INDEX.md`](../phases/INDEX.md) v1.8 — phase decision table
- [`../implementation-roadmap.md`](../implementation-roadmap.md) v0.3 — week-by-week plan; §6 T-SKELETON definitions
- [`../phases/phase-0-setup/phase-0-current.md`](../phases/phase-0-setup/phase-0-current.md) — Phase 0 rollup (compressed view; load only if needed)
- Predecessor per-session handovers (do NOT load by default; rolling handover block 5 summarizes):
  - [`session-2026-04-30-handover.md`](session-2026-04-30-handover.md) — Session 6
  - [`session-2026-05-01-handover.md`](session-2026-05-01-handover.md) — Session 7

---

*End of Session 10 kickoff. If pasting this into a fresh Claude Code session: just copy the prompt block under "Copy-paste prompt (start here)" — that's the complete bootstrap.*
