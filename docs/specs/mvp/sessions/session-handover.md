---
title: Neural MVP — Rolling Session Handover
artifact_type: session-handover
status: complete
version: 1.4
last_updated: 2026-05-05
last_session_number: 10
last_session_outcome: Session 10 (Day 2-3 of week 1 walking-skeleton; date 2026-05-05 per /currentDate) — T-SKELETON-001 LANDED. Orchestrator at packages/agent-core/src/audit.ts (REAL — stays through wk 12) + CLI subcommand at apps/cli/src/commands/audit.ts (raw process.argv per PD-07 option c) + 8 minimal placeholder node modules at canonical paths (BrowserManager, HeuristicLoader, EvaluateNode, SelfCritiqueNode, EvidenceGrounder, AnnotateNode, StoreNode, Report) ready for T-SKELETON-002..009 enrichment. Pino correlation logging active (audit_run_id + page_url + node_name). 12 files NEW/MODIFIED. Build clean; typecheck clean; 73 tests pass (no regression); 5 manual smokes pass (--url=https://example.com → exit 0; no flag → exit 2; --version preserved → exit 0; Peregrine demo URL → exit 0; invalid URL → exit 2). PD-07 RESOLVED (raw process.argv; CLI library deferred to Phase 5). 9 of 10 walking-skeleton tasks remain (T-SKELETON-002..010) plus 3 demo-prep items + Wednesday demo (2026-05-06).

description: "Single rolling handover doc. Replaces per-session handover files from Session 8 onwards. Each session-end Claude updates blocks 1+2+3+5 in place; block 4 is static; block 6 updates when demo target changes. Never create per-session files. Old session detail lives in git history (git log -p docs/specs/mvp/sessions/session-handover.md). Predecessor per-session handovers at session-2026-04-30-handover.md (Session 6) + session-2026-05-01-handover.md (Session 7) preserved for archival reference. Session 9 (Day 2 of week 1) closed with explicit kickoff prompt for Session 10 at sessions/kickoff-session-10.md so the next session can boot on T-SKELETON work without re-deriving context."

cross_references:
  - docs/specs/mvp/phases/INDEX.md (current phase decision table)
  - docs/specs/mvp/implementation-roadmap.md (week-by-week plan)
  - docs/specs/mvp/sessions/session-2026-04-30-handover.md (Session 6 archive — Phase 0/0b approval narrative)
  - docs/specs/mvp/sessions/session-2026-05-01-handover.md (Session 7 archive — Phase 1/6 approval narrative)
  - CLAUDE.md §8c (per-phase artifact maintenance) + §8d (R17.4 phase review)
---

# Neural MVP — Rolling Session Handover

> **Update discipline:** Each session-end Claude updates blocks 1 (current state), 2 (standing conditions), 3 (pending decisions), and 5 (session log — append a 3-line bullet). Block 4 (reading order) is static. Block 6 (demo target) updates when the URL or scope changes. Never create per-session files. Old detail accessible via `git log -p docs/specs/mvp/sessions/session-handover.md`.

---

## 1. Current state ledger

**As of 2026-05-05 (mid-Session 10 / Day 2-3 of week 1; T-SKELETON-001 just landed):**

### Phase status

| Phase | Status | Approved in | Implementation timing |
|---|---|---|---|
| Phase 0 (Setup) | 🟢 **implemented** (5/5 ACs green; Session 8) | Session 6 | Week 1 — **DONE 2026-05-05** |
| **Phase 0b (Heuristics infra)** | ✅ **approved (v0.5)** · 🟡 **infra COMPLETE; content week 4** | Session 6 (v0.3) → R11.4 patches v0.4 + v0.5 in Sessions 8-9 | T0B-001..T0B-005 ✅ **DONE 2026-05-06**; T103/T104/T105 content week 4 |
| **Phase 1 (Browser Perception)** | ✅ **approved** · 🟡 T014 done standalone (forward-pulled) | **Session 7** | T014 ✅ Week 1; rest Week 2 |
| Phase 1b (Perception Ext v2.4) | ⚪ draft | future JIT | Week 3 (ride-along TBD) |
| Phase 1c (PerceptionBundle v2.5) | ⚪ draft | future JIT | Week 3+ |
| Phase 2 (MCP Tools) | ⚪ draft | future JIT | Week 4 |
| Phase 3 (Verification) | ⚪ draft | future JIT | Week 5 |
| Phase 4 (Safety + Infra + Cost) | ⚪ draft | **next analyze target** | Week 3 |
| Phase 4b (Context Capture) | ⚪ draft | future JIT | Week 6 |
| Phase 5 (Browse MVP) | ⚪ draft | future JIT | Week 7-8 |
| Phase 5b (Multi-viewport) | ⚪ draft | future JIT | Week 11 |
| **Phase 6 (Heuristic KB)** | ✅ **approved** · 🟡 T101 done standalone (forward-pulled) | **Session 7** | T101 ✅ Week 1; rest Week 4 |
| Phase 7 (Analysis) | ⚪ draft | future JIT | Week 5-6 |
| Phase 8 (Orchestrator) | ⚪ draft | future JIT | Week 8-9 |
| Phase 9 (Foundations + Delivery) | ⚪ draft | future JIT | Week 10-12 |

**4 of 15 phases approved · 1 implemented · 3 partial (Phase 0b infra-DONE/content-pending; Phase 1 + Phase 6 single-task forward-pulled).** All week-1 + week-2 forward-pulled contract dependencies have spec coverage.

### Week 1 walking-skeleton progress

**Day 1 (2026-05-05) — DONE in Session 8.** 10 commits ending at `791c5e3` (Phase 0 implementation 5/5 ACs + 2 forward-pulled schemas T014 + T101 + 55 unit tests).

**Day 2-3 (2026-05-05; Session 10 in-progress).** Branch `feat/week-1-walking-skeleton` advancing from `dbf17ce` (Session 9 close-out) through T-SKELETON-001 commit. ~17 commits cumulative on branch.

**Day 2 (2026-05-06 per Session 9 frontmatter; Session 9 commits dated 2026-05-06).** Branch `feat/week-1-walking-skeleton` at `a141a49` (6 additional commits, all pushed; 16 commits cumulative on branch since branch-cut):

```
f54c040  T0B-001              (drafting prompt template + Phase 0b spec/plan/tasks v0.3 → v0.4 R11.4 patch — supersession callout for §9.1 → T101 body-string design)
2c1bad1  T0B-002              (verification protocol — 8 steps + 3-strike rule + R6 discipline section setting D2 BINDING precedent)
8c8eaba  T0B-003              (PR Contract Proof block template — extends PRD §10.9 with per-heuristic verification evidence + R6 "what NEVER to include" guard)
62d5e03  Phase 0b v0.5 patch  (R11.4 PATH A continuation — banned-phrase regex target body, not recommendation.summary + .details; 4 stale §9.1 references missed in v0.4 sweep)
b861f04  T0B-004              (pnpm heuristic:lint CLI + Vitest at apps/cli + 18 conformance tests; D1 BINDING SATISFIED — NEURAL_TEST_FIXTURE_BODY sentinel asserted; AC-13 5-channel R6 isolation)
a141a49  T0B-005              (heuristics-repo/README.md — 4-step workflow + D2 BINDING SATISFIED with 8-row forbidden-channel table; D3 OPTIONAL deferred to v1.0.1)
```

**Day 2 deliverables summary:**
- 5 Phase 0b infra tasks DONE; T0B-001..T0B-005 templates + lint CLI + repo README all at canonical paths
- 1 R11.4 spec defect surfaced + patched in flight (commit `62d5e03`; spec/plan/tasks bumped v0.4 → v0.5)
- D1 BINDING (T0B-004) + D2 BINDING (T0B-005) SATISFIED; D3 OPTIONAL deferred to v1.0.1 with documented rationale (4 reasons in tasks.md v0.5 T0B-005 entry)
- Test surface: 55 → 73 (+18 cli conformance tests; FULL TURBO cache; <1s per workspace)
- Vitest wiring at apps/cli: scope-expanded from Phase 0 deferral ("Phase 5+") to NOW, per AC-04 requirement; documented in T0B-004 commit message
- agent-core dist/ is built (cached) — required for `@neural/agent-core/analysis/heuristics/types` exports-map resolution at runtime
- `.gitignore` adds `.heuristic-drafts/` entry (T0B-004 commit `b861f04`)

**Day 2-3 (Session 10) — IN PROGRESS:** Walking-skeleton stubs (10 tasks per `implementation-roadmap.md` §6 T-SKELETON-001..010)

- ✅ T-SKELETON-001 — **DONE 2026-05-05**. Orchestrator at `packages/agent-core/src/audit.ts` (REAL; stays through wk 12) + CLI subcommand at `apps/cli/src/commands/audit.ts` (raw process.argv per PD-07 option c; no commander/yargs) + `apps/cli/src/index.ts` routes `--url=` to subcommand and preserves `--version` from Phase 0 + 8 minimal placeholder node modules at canonical paths (`browser-runtime/BrowserManager.ts`, `analysis/heuristics/loader.ts`, `analysis/nodes/{Evaluate,SelfCritique,Annotate,Store}Node.ts`, `analysis/grounding/EvidenceGrounder.ts`, `delivery/Report.ts`) returning typed empty defaults (no throws per R3.3) ready for T-SKELETON-002..009 enrichment. Pino correlation logging active (`audit_run_id` + `page_url` + `node_name`). agent-core exports `./audit` subpath added. `.gitignore` adds `out/`. Local types at `packages/agent-core/src/audit/types.ts` (AuditInput, RawFinding, CritiqueFinding, GroundedFinding, GroundResult, AuditOutcome — Phase 7/8 supersede). 12 files; 73 tests green (no regression); 5 manual smokes pass.
- ☐ T-SKELETON-002 — `BrowserManager` stub returning **synthetic Peregrine PDP PageStateModel** matching T014 schema (forward-pulled to Day 1; lives at `packages/agent-core/src/perception/types.ts`); fixture at `packages/agent-core/tests/fixtures/perception/peregrine-pdp.json` (NEW); enriches existing placeholder at `packages/agent-core/src/browser-runtime/BrowserManager.ts`
- ☐ T-SKELETON-003 — `HeuristicLoader` stub returning 3 synthetic heuristics matching T101 schema (forward-pulled to Day 1; lives at `packages/agent-core/src/analysis/heuristics/types.ts`); fixtures at `packages/agent-core/tests/fixtures/heuristics/skeleton-{1,2,3}.json` (NEW); body text marked `NEURAL_TEST_FIXTURE_BODY` per R6 + reuses D1 sentinel pattern; enriches existing placeholder at `packages/agent-core/src/analysis/heuristics/loader.ts`
- ☐ T-SKELETON-004 — `EvaluateNode` stub (2 stub findings tagged `{ source: 'skeleton-stub' }`); enriches existing placeholder at `packages/agent-core/src/analysis/nodes/EvaluateNode.ts`
- ☐ T-SKELETON-005 — `SelfCritique` stub (passthrough verdict='KEEP') — current placeholder already does this; T-SKELETON-005 confirms + adds telemetry tag
- ☐ T-SKELETON-006 — `Ground` stub (passthrough) — current placeholder already does this; T-SKELETON-006 confirms
- ☐ T-SKELETON-007 — `Annotate` stub (no-op) — current placeholder already does this; T-SKELETON-007 confirms
- ☐ T-SKELETON-008 — `Storage` stub (JSON to `./out/`) — current placeholder already does this; T-SKELETON-008 enriches with proper telemetry / acceptance hooks
- ☐ T-SKELETON-009 — `Report` stub (TXT to `./out/`) — current placeholder already does this; T-SKELETON-009 enriches output formatting
- ☐ T-SKELETON-010 — `tests/acceptance/walking-skeleton.spec.ts` (real Playwright Test against stubbed pipeline; Phase 0 acceptance test pattern at `tests/acceptance/phase-0-setup.spec.ts` is the reference)

**Days 3-4 (Session 10 — same session, after T-SKELETON-010 lands) — PENDING:** Demo prep (3 items)

- Pin Peregrine URL in demo script (Peregrine PDP: https://www.peregrineclothing.co.uk/collections/t-shirts/products/heavyweight-t-shirt?colour=Navy — locked in block 6)
- Author `docs/specs/mvp/demo-scripts/wk-01.md` dry-run script
- Capture pre-demo happy-path screenshots (terminal output of `pnpm cro:audit --url=<peregrine PDP>` + content of `./out/` files)
- Wednesday demo (2026-05-06 — confirmed today per PD-06 resolution in block 3)
- Post-demo: log feedback to `docs/specs/mvp/demo-feedback.md`

**Total remaining: 12 tasks** (9 T-SKELETON-002..010 + 3 demo prep + 1 Wednesday demo). T-SKELETON-001 done. ~2-3 hr focused work remaining in Session 10 at one-by-one cadence; T-SKELETON-005..009 may collapse into faster cadence since their placeholders already meet the spec (each is just confirmation + minor enrichment).

### Operational integration state

- `/speckit.implement` ↔ `neural-dev-workflow` integration **active** via `.specify/extensions.yml` hooks (commit `e0ed5a0`):
  - `before_implement` → `neural-dev-workflow-brief` (R17.4 verify + Brief + Kill criteria + pacing)
  - `after_implement` → `neural-dev-workflow-pr` (PR Contract + Spec Coverage + R17 status bumps + R19 rollup + INDEX flip)
- **Use `/speckit.implement <task-id>` per task** — hooks handle workflow ceremony automatically.
- Centralized phase-review templates at `docs/specs/mvp/templates/phase-review-{prompt,report.template}.md` v1.0.

---

## 2. Standing conditions (BINDING obligations from past R17.4 reviews — delete when consumed)

These conditions ride along with the implementing task. Delete each row when the implementing task lands and the condition is satisfied.

### Phase 0 — Session 8 implementation (closed)

Phase 0 had no R17.4 BINDING conditions from Session 6 review. During implementation (Session 8), 2 R11.4 spec defects surfaced + were patched in same commits as the implementing tasks. No standing conditions remain for Phase 0.

### Phase 0b — Session 6 review (CONSUMED by Session 9 Day 2 implementation)

All 3 conditions resolved; rows preserved in compressed form for audit trail (delete on next consolidation):

- **D1 SATISFIED 2026-05-06** — T0B-004 commit `b861f04`. `apps/cli/src/commands/heuristic-lint.ts` `lintFile()` extracts ONLY `issue.path` + `issue.code` (NOT `issue.message`); conformance test at `apps/cli/tests/conformance/heuristic-lint.test.ts` asserts via `NEURAL_TEST_FIXTURE_BODY` sentinel embedded in 5 invalid fixtures + 1 valid fixture; all 18 conformance tests green; manual smoke confirmed sentinel never visible in stderr/stdout for any invocation.
- **D2 SATISFIED 2026-05-06** — T0B-005 commit `a141a49`. `heuristics-repo/README.md` §3 "R6 / R15.3.3 IP boundary — what you MUST NOT do" includes 8-row forbidden-channel table covering Slack + email + screenshot + support ticket + 4 defense-in-depth additional rows (unauthorized LLM, non-engineering verifier, pushing .heuristic-drafts/ to git, forwarding committed JSON externally). Each row carries constitutional-rule citation.
- **D3 DEFERRED to v1.0.1 2026-05-06** — T0B-005 entry in tasks.md v0.5 documents 4 deferral reasons: (a) `.husky/pre-commit` infrastructure scope expansion outside Phase 0b; (b) `.gitignore` already excludes `.heuristic-drafts/` (T0B-004 commit `b861f04`); (c) D2 BINDING text + T0B-002 + T0B-003 already enforces at human-protocol layer; (d) v1.0.1 is the right scope for git-infrastructure additions. New backlog item: add to v1.0.1 candidate list.

### Phase 1 — Session 7 review

| ID | Severity | Condition | Implementing task | Source |
|---|---|---|---|---|
| **C1** | BINDING | T015 implementation MUST define explicit per-step Playwright timeout budgets summing to ≤ 20s/site (≤ 60s for 3 sites). Use `waitUntil: 'domcontentloaded'` not `'load'` for `page.goto`. Document budget in T015 brief or plan.md §Phase 1 Design at impl time. | T015 | [phase-1-perception/review-notes.md](../phases/phase-1-perception/review-notes.md) |
| **C2** | OPTIONAL | Append Phase 1b + Phase 1c rows to impact.md §Forward Contract — Phase 1b imports PageStateModel + extends perception layer; Phase 1c wraps PageStateModel into PerceptionBundle envelope. v0.3.1 patch anytime. | impact.md author | same |
| **C3** | OPTIONAL | Add per-task hour estimate + phase-level total to plan.md §9. Phase 0b had ~26h+~7h; Phase 1 should too for week-sequencing calibration. | plan.md author | same |

### Phase 6 — Session 7 review

| ID | Severity | Condition | Implementing task | Source |
|---|---|---|---|---|
| **C1** | BINDING | T106 MUST catch `ZodError` BEFORE logging; emit only `{ heuristic_id?, path: errors[].path.join('.'), error_class: errors[].code }` — NEVER `errors[].message` (contains literal `received: <body>` content). r6-ip-boundary.test.ts MUST include sentinel `NEURAL_TEST_FIXTURE_BODY` assertion. **Mirrors Phase 0b D1 pattern (T0B-004) — propagating R6 lesson forward.** | T106 | [phase-6-heuristics/review-notes.md](../phases/phase-6-heuristics/review-notes.md) |
| **C2** | BINDING | r6-ip-boundary.test.ts (T-PHASE6-TESTS) MUST cover BOTH (a) shaped-object Pino redaction assertions AND (b) string-interpolation anti-pattern detection. Test fails an implementation that template-interpolates body into `logger.info('loaded ' + body)`. | T-PHASE6-TESTS | same |
| **C3** | OPTIONAL | T106 acceptance specs FileSystemHeuristicLoader.loadForContext stub explicitly: throw `Error('not implemented in Phase 6 — Phase 4b T4B-013 owns')`. T112 asserts the stub throws when called directly. | T106 implementer or v0.4.1 polish | same |
| **C4** | OPTIONAL | T106 handles `fs.readdir` ENOENT (heuristics-repo/ missing) — return empty KB + single warn-level log. Distinct from "exists but empty" (silent empty). | T106 implementer | same |
| **C5** | OPTIONAL | README.md "Depends on" updated to `Phase 0 + Phase 0b + Phase 4b` per INDEX.md row 6. Phase 4 dep dropped or downgraded to "infrastructure baseline". | README author | same |

---

## 3. Pending decisions (delete when decided)

| ID | Decision | Owner | Trigger to decide |
|---|---|---|---|
| **PD-01** | Phase 1b + 1c folding — week 2 ride-along vs slip to weeks 3-4. | engineering lead | After Phase 1 ships in week 2 |
| **PD-02** | Phase 2 forward-pull — bring T-PHASE2-TYPES + T019 + T024 + T048 into week 4 to ease week-5 load? | engineering lead | After Phase 6 ships in week 4 |
| **PD-03** | Next JIT analyze target = Phase 4 (week-3 dependency: T070 RLS first runtime + T073 LLM cornerstone temperature=0 first runtime + R6 LangSmith trace channel). NOT urgent during week-1 implementation. | engineering lead | Just-before week 3 begins |
| **PD-04** | Phase 1 T015 integration-test fixture set — current spec is `example.com` (simple) + `amazon.in` (complex/bot) + Shopify demo (TBD). Replace Shopify demo with `peregrineclothing.co.uk` T-shirt PDP (Shopify-powered real D2C — better real-world coverage than `example.com` too)? **Effectively resolved** by Session 8 demo-target lock at the Peregrine PDP — close when T015 lands in week 2 by referencing this PD. | T015 implementer (week 2) | When T015 lands |
| **PD-05 (NEW Session 8)** | Should `.claude/settings.local.json` be untracked from git (it was committed before .gitignore excluded it; now shows as "modified" forever)? `git rm --cached .claude/settings.local.json` would silently fix; per-user file by design. Cosmetic only — fix when convenient or defer. **Status: still modified at end of Session 9; intentionally NOT staged in any Day 2 commit.** | engineering lead | next session that touches git hygiene |
| ~~**PD-06**~~ **RESOLVED 2026-05-06 (Session 9 mid-Day-2)** | Kickoff prompt's "5 calendar days" framing was authored on/around 2026-05-01 (Session 7 end) when 2026-05-06 was genuinely 5 calendar days away. By Session 8 (2026-05-05) the framing went stale. **User confirmed mid-Session-9: demo IS Wednesday 2026-05-06 (TODAY at session-9 close); session date drifted past kickoff-time framing but the date itself stayed put.** Session 9 commits all dated 2026-05-06. Session 10 should treat demo as TODAY; verify against `/currentDate` at session start. | RESOLVED | n/a |
| ~~**PD-07**~~ **RESOLVED 2026-05-05 (Session 10 / mid-Day 2-3)** | Engineering lead chose **option (c): defer to Phase 5; use raw `process.argv` parsing for T-SKELETON-001**. Rationale: T-SKELETON-001 needs exactly one flag (`--url=<value>` plus optional `--output=<value>`) — ~10 LOC of `arg.startsWith('--url=')` parsing in `apps/cli/src/commands/audit.ts:33-44`. Phase 0 T003 already set the no-library precedent for `--version`. Phase 5 (T081-T100) brings the real subcommand surface (browse + audit + multi-page) — that's where commander/yargs earns its keep. Vitest revocation in T0B-004 was forced by AC-04 explicit requirement; no equivalent forcing function exists for CLI library now. Trivial swap later: ~10 LOC refactor when Phase 5 lands. T-SKELETON-001 commit landed 2026-05-05 with this decision. | RESOLVED | n/a |

---

## 4. Reading order for new sessions (static)

When a new Claude session starts:

1. **CLAUDE.md** (auto-loaded) — confirm §8c + §8d present.
2. **This file** (`docs/specs/mvp/sessions/session-handover.md`) — current rolling state.
3. **`docs/specs/mvp/phases/INDEX.md`** — phase decision table; identify the active phase.
4. **`docs/specs/mvp/implementation-roadmap.md`** — week-by-week task plan.
5. **Active phase folder** — `phase-<N>-<name>/{README,tasks,spec,plan}.md` for the phase the session is working on.
6. Per task: invoke `/speckit.implement <task-id>` and let the hook chain (`neural-dev-workflow-brief` → impl → `neural-dev-workflow-pr`) load the right context.

**Do NOT load:**
- All 15 phase folders at once (progressive disclosure per CLAUDE.md §1, PRD §12.5).
- Predecessor per-session handovers (`session-2026-04-30-handover.md`, `session-2026-05-01-handover.md`) unless researching the historical "why" of a specific decision — block 5 below summarizes what each session shipped.

**For BINDING conditions:** check block 2 above before implementing any task whose ID appears in the "Implementing task" column.

---

## 5. Session log (append-only, ~3 lines per session)

- **Session 6 (2026-04-30)** — Phase 0 + Phase 0b R17.4 approved; centralized phase-review templates shipped; walking-skeleton roadmap v0.3 + visual.md + .html; constitution.md sync fix to .specify/memory/. Commits: `b8994a1`, `bbca2a9`, `2ba6b6e`. Per-session archive: [session-2026-04-30-handover.md](session-2026-04-30-handover.md).

- **Session 7 (2026-05-01)** — Phase 1 v0.3 polish (8 analyze findings) + R17.4 review APPROVE with C1 BINDING (T015 timeout budgets); Phase 6 v0.4 catch-up polish (3 HIGH + 1 MEDIUM analyze findings; closed multi-artifact version drift v0.1/v0.2/v0.3 → v0.4) + R17.4 review APPROVE with C1+C2 BINDING (T106 Zod-error sanitization mirroring Phase 0b D1 + r6-ip-boundary.test.ts string-interpolation coverage); INDEX.md v1.4 → v1.6; /speckit.implement ↔ neural-dev-workflow integration via extension hooks; rolling session-handover.md established (this file). Commits: `4bd1f5c`, `e0ed5a0`, `26b7a72`, `2ee7914`, `cc657da`. Per-session archive: [session-2026-05-01-handover.md](session-2026-05-01-handover.md).

- **Session 8 (2026-05-05) — Day 1 of week 1 walking-skeleton COMPLETE.** Two phases of work in one session:

  **Phase 0 implementation (8 tasks, 7 commits):** T-PHASE0-TEST + T001-T005 + T-PHASE0-DOC + T-PHASE0-ROLLUP. Acceptance `tests/acceptance/phase-0-setup.spec.ts` 5/5 green. Two R11.4 spec defects patched in flight (spec.md v0.3 → v0.4 → v0.5: AC-04 `pg_extension` → `pg_available_extensions`; AC-05 `DATABASE_URL` → `POSTGRES_URL` + `CLAUDE_MODEL` dropped). R17 status bumps `approved` → `implemented` on spec/plan/tasks/README. R19 rollup `phase-0-current.md` v1.0 landed. INDEX.md v1.6 → v1.7 with row 0 flip ⚪ → 🟢. Pre-authorized deviations: pnpm 9 → 10.33.3; engines.node:"22"; T004/T005 author → verify reframe. Env side-effect: Microsoft VCRedist installed via `winget install Microsoft.VCRedist.2015+.x64` for UCRT API sets (one-time host fix; documented in root README troubleshooting + phase-0-current.md §4). Commits: `9919449` (T-PHASE0-TEST+T001), `bb63cd0` (T002), `90ab537` (T003), `1e9ff98` (T004 + spec v0.4), `bd09040` (T005 + spec v0.5), `42a21fb` (T-PHASE0-DOC), `5f53b6b` (T-PHASE0-ROLLUP).

  **Forward-pulled schemas (2 tasks, 3 commits):** T014 (PageStateModel Zod schemas, Phase 1 → forward-pulled to week 1; 15 vitest unit tests covering AC-09; +`zod ^3.24` dep; `_extensions` Phase 7+ seam; `checkAxTreeDepth` cyclic-tree guard) + T101 (HeuristicSchema base + Extended, Phase 6 → forward-pulled; 40 vitest unit tests covering AC-01 + AC-02 + AC-11 partial; ProvenanceSchema + BenchmarkSchema discriminatedUnion + 6 enum constants + matchesSelector helper; preliminary archetype/page_type/device enums pending Phase 4b T4B-001 canonical). Browser_Agent reference material (sibling `/Sabari/Neural/Browser_Agent/src/heuristics`) evaluated and explicitly NOT inherited — schema mismatch too deep + their CR-002 removed rule-based heuristics. Commits: `077ec86` (T014), `3d2119c` (T101 schema + tests), `791c5e3` (T101 tasks.md mark-done follow-up — original commit lost the edit because the file was grep'd not Read).

  **Total Day 1: 10 commits, all pushed to `feat/week-1-walking-skeleton`. 5/5 Phase 0 ACs green; 55 unit tests green. Branch ready for Day 2.** Next session resumes at Phase 0b T0B-001..T0B-005 (Day 2 AM) → walking-skeleton T-SKELETON-001..010 (Days 2-3) → demo prep (Days 3-4). 18 tasks remaining for week 1.

  **Operating protocol confirmed mid-session (Day 1, post-T003):** one-by-one task cadence (no batching) + manual validation block in `Input → Expected Output` format appended to every task report. Effective from Day 2 onward; applied retroactively to T014 + T101 reports.

- **Session 9 (2026-05-06) — Day 2 of week 1: Phase 0b INFRASTRUCTURE LAYER COMPLETE.** Branch `feat/week-1-walking-skeleton` advanced from `6c56d70` → `a141a49` (6 additional commits). Two phases of work in one session:

  **Phase 0b infrastructure (5 tasks, 5 task commits + 1 mid-flight spec patch = 6 commits total):** T0B-001 (drafting prompt template) + T0B-002 (verification protocol with 8 steps + 3-strike kill criterion) + T0B-003 (PR Contract Proof block extension) + T0B-004 (`pnpm heuristic:lint` CLI + Vitest at apps/cli + 18 conformance tests; **D1 BINDING SATISFIED** — `NEURAL_TEST_FIXTURE_BODY` sentinel asserted across 5 invalid + 1 valid fixture; AC-13 5-channel R6 isolation green) + T0B-005 (`heuristics-repo/README.md` with **D2 BINDING SATISFIED** — 8-row forbidden-channel table covering Slack/email/screenshot/support-ticket + 4 defense-in-depth rows; **D3 OPTIONAL DEFERRED to v1.0.1** with 4 documented reasons). Test surface 55 → 73 (+18 cli conformance tests; FULL TURBO cache after first run).

  **R11.4 spec defects (continuation of Session 8 PATH A pattern; 2 sweep waves on Day 2):** Wave 1 surfaced at T0B-001 brief load — Phase 0b plan.md §2 referenced §9.1 rich-structured schema (~25 fields) but T101 implementation (forward-pulled Day 1, commit `3d2119c`) landed body-string design (11 fields). User confirmed PATH A: T101 canonical, patch upstream specs. Bumped spec.md/plan.md/tasks.md v0.3 → v0.4 in T0B-001 commit `f54c040` with §Mandatory References supersession callout (§9.1 LEGACY; T101 source-of-truth). Wave 2 surfaced at T0B-004 brief load — 4 stale references missed in v0.4 sweep (AC-04, AC-15, R-04, plan.md §5 — banned-phrase regex target was `recommendation.summary + recommendation.details`, both nonexistent in T101). User confirmed Option (a) extending PATH A. Patched v0.4 → v0.5 in commit `62d5e03` (separate from T0B-004 impl `b861f04` — two commits per Day 1 protocol cadence "fix spec before implementing"). v2.3.4 INDEX.md punch-list extended in T0B-001 with §9.1 v2.4 rewrite + Phase 6 spec.md v0.5 polish queue items.

  **Pre-authorized scope expansion — Vitest wiring at apps/cli:** Phase 0 T003 deferred test scaffolding to Phase 5+ ("unit tests land in Phase 5+ alongside subcommands"). T0B-004 AC-04 explicitly required `apps/cli/tests/conformance/heuristic-lint.test.ts` to be a real Vitest test → deferral revoked NOW. Wired with minimal `vitest.config.ts` mirroring agent-core pattern; test script flipped from `echo` placeholder to `vitest run --passWithNoTests`. Adds: `@neural/agent-core: workspace:*` + `glob: ^11.0.0` + `vitest: ^2.1.0` + `tsx: ^4.19.0` deps. Documented as agent reasoning per CLAUDE.md §8b in T0B-004 commit message.

  **Operating protocol carried forward (Day 1 → Day 2):** one-task-per-`/speckit.implement`-invocation cadence; manual validation block (`Input → Expected Output`) appended to every after_implement closeout; hybrid sync/continuous cadence agreed at session start (sync verify for D1/D2 BINDING tasks T0B-004 + T0B-005; continuous for the 3 Markdown templates T0B-001/002/003). Spec patches as separate commits when R11.4 defects surface (followed for `62d5e03` v0.5 patch — preceded `b861f04` T0B-004 impl).

  **Phase 0b status:** infra layer COMPLETE (5/5 T0B-* tasks); content layer (T103/T104/T105 — 30 heuristics) pending week 4. Phase 0b NOT yet R17 implemented — INDEX row 0b flipped ⚪ "not started" → 🟡 "in progress (infra complete; content week 4)". Will flip to 🟢 + R17 implemented + R19 rollup when T103/T104/T105 + Phase 6 T112 cross-phase acceptance all green in week 4.

  **Total Day 2: 6 commits, all pushed. Phase 0b infra COMPLETE; D1 + D2 BINDINGs SATISFIED; D3 deferred to v1.0.1; 73 tests green; 4 R11.4 spec patches in flight.** Session closed before T-SKELETON work to preserve context window for the more code-intensive walking-skeleton tasks (Session 10 will pick up at T-SKELETON-001 with fresh context, per OPTION 1 break).

  Commits: `f54c040` (T0B-001), `2c1bad1` (T0B-002), `8c8eaba` (T0B-003), `62d5e03` (Phase 0b v0.5 spec patch — R11.4 PATH A continuation), `b861f04` (T0B-004 + Vitest wiring), `a141a49` (T0B-005). Plus this close-out commit (handover v1.3 + INDEX row 0b flip + Session 10 kickoff prompt).

  **For Session 10:** Boot via `docs/specs/mvp/sessions/kickoff-session-10.md` (NEW — authored in this close-out commit). 13 tasks remaining for week 1: T-SKELETON-001 (REAL orchestrator) → T-SKELETON-002..009 (9 stubs) → T-SKELETON-010 (acceptance test + demo gate) → demo prep (3 items) → Wednesday demo. Estimated ~3-4 hr if continuing one-by-one cadence.

- **Session 10 (2026-05-05) — Day 2-3 of week 1: T-SKELETON-001 LANDED.** Branch `feat/week-1-walking-skeleton` advanced from `dbf17ce` (Session 9 close-out) by 1 task commit + 1 PR Contract closeout commit. Walking-skeleton orchestrator is now real; 8 placeholder node modules at canonical paths ready for T-SKELETON-002..009 enrichment.

  **T-SKELETON-001 implementation (Option E — orchestrator + CLI + 8 placeholders in single commit per Brief design choice):** REAL `audit({ url })` orchestrator at `packages/agent-core/src/audit.ts` calls 8 nodes in fixed order (`capture → loadHeuristics → evaluate → critique → ground → annotate → store → report`) with Pino correlation logging (`audit_run_id`, `page_url`, `node_name`). REAL CLI subcommand at `apps/cli/src/commands/audit.ts` uses raw `process.argv` parsing (PD-07 option c) — extracts `--url=<value>` + `--output=<value>` in ~6 LOC; no commander/yargs. `apps/cli/src/index.ts` routes `--url=` arg to subcommand; preserves `--version` from Phase 0 T003. 8 minimal placeholder node modules at canonical paths return typed empty defaults (no throws per R3.3): `BrowserManager.capture()` → minimal `PageStateModel` matching T014 `.strict()` schema; `HeuristicLoader.loadAll()` → `[]`; `EvaluateNode.run()` → `[]`; `SelfCritiqueNode.run()` → input passthrough w/ `verdict='KEEP'`; `EvidenceGrounder.ground()` → `{grounded, rejected: []}`; `AnnotateNode.run()` → input passthrough; `StoreNode.run({findings, outputDir, slug})` → writes JSON to `<outputDir>/<slug>-findings.json`; `Report.render({...})` → returns plain-text report string (orchestrator writes to TXT). Local types at `packages/agent-core/src/audit/types.ts`: AuditInput, RawFinding, CritiqueFinding (with `CritiqueVerdict` literal union), GroundedFinding (alias for now), GroundResult, AuditOutcome — all minimal; Phase 7/8 will supersede with full Finding lifecycle types. agent-core `package.json` exports adds `./audit` subpath. `.gitignore` adds `out/` block. 12 files NEW/MODIFIED.

  **Verification:** `pnpm typecheck` clean (3 successful, FULL TURBO cache); `pnpm test` 73 tests green (55 agent-core unit + 18 cli conformance — no regression from Session 9 baseline); 5 manual smokes pass (V4 `--url=https://example.com` exit 0 in 5ms; V5 no flag exit 2 with clean stderr; V6 `--version` exit 0 prints "0.1.0"; V7 Peregrine demo URL exit 0 in 3ms with slug `www-peregrineclothing-co-uk`; V8 `--url=not-a-url` exit 2 with clean stderr). Output files written to `./out/<slug>-findings.json` (JSON array; empty `[]` until T-SKELETON-004 enriches) + `./out/<slug>-audit.txt` (plain-text report header w/ audit_run_id, URL, duration, findings counts).

  **Constitution compliance:** R3.3 ✅ (no broken paths; placeholders return typed empty defaults, never throw); R5.3+GR-007 ✅ (N/A this task — no findings produced); R6 ✅ (orchestrator logs `heuristic_id` only, never body); R7.4 ✅ (filesystem-only writes; no DB); R10 ✅ (orchestrator 100 LOC; placeholders ≤50 LOC; types 73 LOC); R10/R13 ✅ (N/A — no LLM calls); R14 ✅ (correlation fields populated); R20 ✅ (orchestrator API IS the new contract; week-8 LangGraph refactor will need impact.md per roadmap §8 promotion table); R23 ✅ (no kill-criteria triggers).

  **Pending decisions resolved:** PD-07 RESOLVED (raw `process.argv`, no CLI library; defer to Phase 5).

  **Walking-skeleton progress after T-SKELETON-001:** 1 of 10 walking-skeleton tasks done; 9 remaining (T-SKELETON-002..010). Note: T-SKELETON-005..009 placeholders ALREADY satisfy their spec (passthrough/no-op behaviors are exactly what the placeholders do); subsequent T-SKELETON tasks for those modules collapse to confirmation + minor telemetry tagging — should be faster than T-SKELETON-002..004 which need NEW fixtures. INDEX.md week-1 progress checklist updated to reflect this split.

  **Operating protocol carried forward:** one-task-per-`/speckit.implement`-invocation with sync verify cadence (user reviews manual validation block before commit). Every closeout includes Input → Expected Output verification table appended to task report.

  Commits: T-SKELETON-001 implementation commit (this session) + this closeout commit (handover v1.3 → v1.4 + INDEX.md week-1 progress update).

  **For T-SKELETON-002:** Author `packages/agent-core/tests/fixtures/perception/peregrine-pdp.json` matching T014 `PageStateModelSchema` `.strict()`; enrich `BrowserManager.capture()` to load fixture + return parsed PageStateModel. Verify Zod parse passes; verify orchestrator log shows non-empty `metadata.title`. Same one-task-per-invocation + manual validation protocol.

---

## 6. Demo target URL (week 1 + ongoing)

**Demo command (locked for week 1+):**

```bash
pnpm cro:audit --url='https://www.peregrineclothing.co.uk/collections/t-shirts/products/heavyweight-t-shirt?colour=Navy'
```

**Why this URL:**

- Real D2C clothing brand (Peregrine Clothing — UK heritage); not a placeholder.
- **Shopify-powered** — exercises the same e-commerce platform Phase 1 T015 originally planned to test via "Shopify demo (TBD)" fixture.
- Product Detail Page (PDP) with full e-commerce surface: product gallery, variant selector (`?colour=Navy` query string), price, add-to-cart, related products, breadcrumbs — typical CRO audit target.
- D2C archetype maps to Phase 6 v0.4 manifest selector example (`archetype: ['D2C']`, `page_type: ['PDP']`) — useful as a reference fixture once Phase 4b T4B-013 ContextProfile filtering ships.
- Stable public URL; does not require auth.

**Implications:**

- **Walking-skeleton stubs (T-SKELETON-001..010)** — synthetic PageStateModel in T-SKELETON-002 should reflect Peregrine metadata (`metadata.url = '<peregrine-url>'`, `metadata.title = 'Heavyweight T-Shirt – Navy | Peregrine Clothing'`, etc) so demo output looks real, not synthetic-bland.
- **Phase 1 T015 integration-test fixtures (week 2)** — pending decision PD-04 above. Recommend: replace Shopify demo with this URL (Shopify-powered + real D2C; better coverage than `example.com` too).
- **Phase 1 spec.md AC-10 + R-11** currently cite `example.com` + `amazon.in` + "Shopify demo". When T015 lands in week 2, the implementer should swap the Shopify demo placeholder for this URL — captured in PD-04. Keep `example.com` (simple control) and `amazon.in` (complex + bot detection) for diversity.
- **Wednesday demo headline:** "Same `pnpm cro:audit` command, every Wednesday. This week: every layer stubbed; pipeline runs end-to-end and emits Neural-shaped output for a real D2C product page. In 11 weeks: every layer real."

---

## Cross-references

- [`docs/specs/mvp/phases/INDEX.md`](../phases/INDEX.md) — phase decision table (current at v1.8 after Session 9 close)
- [`docs/specs/mvp/implementation-roadmap.md`](../implementation-roadmap.md) — week-by-week plan
- [`docs/specs/mvp/templates/phase-review-prompt.md`](../templates/phase-review-prompt.md) — R17.4 review template
- [`CLAUDE.md`](../../../CLAUDE.md) §8c + §8d — phase artifact maintenance + R17.4 review gate
- [`docs/specs/mvp/sessions/kickoff-session-10.md`](kickoff-session-10.md) — copy-paste kickoff for Session 10 (T-SKELETON work)
- Predecessor per-session handovers (archival; do not read by default):
  - [`session-2026-04-30-handover.md`](session-2026-04-30-handover.md) — Session 6
  - [`session-2026-05-01-handover.md`](session-2026-05-01-handover.md) — Session 7
