---
title: Tasks — Phase 0 Setup
artifact_type: tasks
status: draft
version: 0.2
created: 2026-04-26
updated: 2026-04-26
owner: engineering lead
authors: [Claude (drafter)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-0-setup/spec.md (AC-01 through AC-05)
  - docs/specs/mvp/phases/phase-0-setup/plan.md (technical decomposition)
  - docs/specs/mvp/tasks-v2.md (T001-T005 verbatim — UNCHANGED)
  - docs/specs/mvp/constitution.md (R3 TDD, R23 Kill Criteria)
  - docs/specs/mvp/testing-strategy.md (§9.6 conformance pattern)
  - .claude/skills/neural-dev-workflow/references/templates.md (Brief format + kill criteria)

req_ids: []

delta:
  new:
    - First phase tasks.md landing under R19 phase folder layout
    - T001-T005 task list pulled verbatim from tasks-v2.md
    - v0.2 — Dependency graph now explicitly shows T-PHASE0-TEST as the TDD prerequisite preceding T001 (analyze finding F11)
  changed:
    - v0.1 → v0.2 dependency graph reordered to make TDD ordering visible (no task body changes)
  impacted: []
  unchanged:
    - T001..T005 acceptance criteria, file lists, kill criteria block

governing_rules:
  - Constitution R3 (TDD)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R17 (Lifecycle)
  - Constitution R23 (Kill Criteria Before Task Start)

description: "Phase 0 task list — T001-T005 from tasks-v2.md; default kill criteria; Playwright Test acceptance."
---

# Tasks: Phase 0 — Setup

**Input:** spec.md + plan.md (this folder)
**Prerequisites:** plan.md `status: approved`
**Test policy:** TDD per R3.1 — write the acceptance test FIRST, watch it FAIL, then implement T001-T005 until it passes.
**Organization:** Single user story (US-1 from spec.md). All tasks contribute to one acceptance scenario.

---

## Task ID Assignment

Phase 0 task IDs are pulled VERBATIM from `docs/specs/mvp/tasks-v2.md` Phase 0 section (T001-T005, marked UNCHANGED in v2.3). No new task IDs introduced.

Format: `[T-NNN] [P?] [US-N?] Description (AC-NN)`
- `[P]` = different files, no dep — parallelizable
- US-1 = "Engineer reaches green local dev"

---

## Path Conventions (from architecture.md §6.5)

Phase 0 only touches:
- repo root (config files)
- `packages/agent-core/` (skeleton)
- `apps/cli/` (skeleton)
- `tests/acceptance/` (Phase 0 acceptance test)

No browser-runtime, MCP, grounding, heuristics, dashboard, or db schema files in Phase 0.

---

## Default Kill Criteria *(applies to T001-T005 — even though each is < 2 hrs, R23 default block applies if any expands)*

```yaml
kill_criteria:
  resource:
    token_budget_pct: 85
    wall_clock_factor: 2x
    iteration_limit: 3
  quality:
    - "any previously-passing test breaks"
    - "pnpm test fails after task supposedly complete"
    - "implementation reveals spec defect (R11.4 — fix spec first)"
  scope:
    - "diff introduces forbidden pattern (R13: any without TODO, console.log in production code, direct SDK import outside adapters/, disabled test)"
    - "task expands beyond stated files (per plan.md table)"
  on_trigger:
    - "snapshot WIP to wip/killed/<task-id>-<reason>"
    - "log to task thread with specific failure mode"
    - "escalate to human"
    - "do NOT silently retry; do NOT --no-verify"
```

---

## Phase 1 — Setup (Shared Infrastructure)

This is itself the master plan's Phase 0; "Phase 1" of the Spec Kit decomposition collapses into the same setup tasks T001-T005.

---

## Phase 2 — Foundational (Blocking Prerequisites)

There is no foundational phase distinct from setup. T001 IS the foundational prerequisite — every other task depends on it.

---

## Phase 3 — User Story 1: Engineer reaches green local dev (Priority: P1) 🎯 MVP

**Goal:** Cloning + `pnpm install` + `pnpm build` + `pnpm cro:audit --version` + `docker-compose up -d` + `pnpm db:migrate` all succeed in under 30 minutes on a clean machine.

**Independent Test:** Run the Phase 0 acceptance test on a fresh clone:
```bash
pnpm install && pnpm build && pnpm cro:audit --version && docker-compose up -d && pnpm db:migrate
```

**AC IDs covered:** AC-01, AC-02, AC-03, AC-04, AC-05

### Tests for User Story 1 (R3 TDD — write FIRST, ensure FAIL, then implement)

- [ ] **T-PHASE0-TEST [P] [US-1]** Author Phase 0 acceptance test at `tests/acceptance/phase-0-setup.spec.ts` (Playwright Test) covering AC-01 through AC-05 via `child_process.execSync` shell exec. Each AC = one `test()` block. Test MUST FAIL initially (no `package.json` exists yet). Note: this is a Phase 0 acceptance test, not a Phase 8/9 audit acceptance test — naming kept distinct.

### Implementation for User Story 1

- [ ] **T001 [P] [US-1] Initialize monorepo** (AC-01)
  - **Brief:**
    - **Outcome:** Repo root has `package.json` (workspace + scripts), `pnpm-workspace.yaml` (declares `packages/*`, `apps/*`), `turbo.json` (pipelines: build, lint, typecheck, test), `tsconfig.json` (strict, base for all packages), `.gitignore` (node_modules, .env, dist, .turbo, *.log).
    - **Context:** plan.md "Project Structure" table shows exact paths. Tech stack pinned: pnpm 9.x + Turborepo 2.x + TypeScript 5.x + Node 22 LTS engines field.
    - **Constraints:** R10.1 file < 300 lines (trivially met). No `any` (no TS yet). pnpm 9 enforced via `packageManager` field.
    - **Non-goals:** No agent-core/ or apps/cli/ contents yet (T002, T003).
    - **Acceptance:** `pnpm install` succeeds; `pnpm build` runs (no-op since no packages have build script yet); turbo.json valid JSON.
    - **Integration:** Provides workspace root for T002, T003.
    - **Verify:** `tests/acceptance/phase-0-setup.spec.ts` AC-01 block goes from FAIL → PASS.
  - **Files:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.gitignore`
  - **dep:** none
  - **Smoke test:** `pnpm install` succeeds at repo root
  - **Kill criteria:** default block above

- [ ] **T002 [US-1] Create agent-core package skeleton** (AC-02)
  - **Brief:**
    - **Outcome:** `packages/agent-core/` exists with `package.json` (`@neural/agent-core`, type: module), `tsconfig.json` (extends root), `vitest.config.ts`, `src/index.ts` (named-export barrel — empty for now), `src/adapters/README.md` (R9 boundary note from plan.md design), `src/observability/logger.ts` (Pino factory skeleton), `src/observability/index.ts` (re-exports), `tests/unit/.gitkeep`.
    - **Context:** plan.md "Phase 1 Design" item 1 (Pino logger) + item 3 (adapter README) define the contents. Pino dependency added to `packages/agent-core/package.json`.
    - **Constraints:** logger.ts < 50 lines (R10.2). Named exports only (R10.3). No `any` without TODO+issue (R2.1). No `console.log` in logger.ts (R10.6 — Pino instead).
    - **Non-goals:** No domain Zod schemas yet (Phase 1+); no actual logger usage (no nodes exist).
    - **Acceptance:** `pnpm -F @neural/agent-core build` compiles cleanly; `pnpm -F @neural/agent-core test` runs (zero tests, exit 0); `import { createLogger } from '@neural/agent-core/observability'` resolves.
    - **Integration:** Used by T003 CLI (which imports the logger factory) and all Phase 1+ work.
    - **Verify:** AC-02 block FAIL → PASS.
  - **Files:** `packages/agent-core/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/adapters/README.md`, `src/observability/logger.ts`, `src/observability/index.ts`, `tests/unit/.gitkeep`
  - **dep:** T001
  - **Smoke test:** `pnpm build` succeeds for agent-core
  - **Kill criteria:** default block

- [ ] **T003 [US-1] Create CLI app skeleton** (AC-03)
  - **Brief:**
    - **Outcome:** `apps/cli/` exists with `package.json` (`@neural/cli`, bin: `cro-audit` → `dist/index.js`), `tsconfig.json` (extends root), `src/index.ts` (entry; reads version from package.json; on `--version` writes version + newline to stdout, exit 0), `src/commands/.gitkeep`, `tests/.gitkeep`. Root `package.json` exposes `pnpm cro:audit` script that invokes `apps/cli`.
    - **Context:** plan.md "Phase 1 Design" item 2 specifies the version handler. CLI stdout is user-facing output, NOT server logging — `process.stdout.write` is permitted (R10.6 applies to server-side console.log, not CLI tool output).
    - **Constraints:** index.ts < 50 lines (R10.2). No external SDK imports (no commander/yargs in Phase 0 — keep minimal). Reads `apps/cli/package.json` version via TypeScript JSON import.
    - **Non-goals:** No `audit` subcommand (Phase 5+). No env reading (`--version` works without `.env`).
    - **Acceptance:** `pnpm build` builds the CLI dist; `pnpm cro:audit --version` prints version from package.json and exits 0.
    - **Integration:** None within Phase 0 beyond the script wiring.
    - **Verify:** AC-03 block FAIL → PASS.
  - **Files:** `apps/cli/package.json`, `tsconfig.json`, `src/index.ts`, `src/commands/.gitkeep`, `tests/.gitkeep`; modify root `package.json` to add `cro:audit` script
  - **dep:** T002
  - **Smoke test:** `pnpm cro:audit --version` prints version
  - **Kill criteria:** default block

- [ ] **T004 [P] [US-1] Setup Docker Compose for Postgres** (AC-04)
  - **Brief:**
    - **Outcome:** `docker-compose.yml` at repo root with one service `postgres` using image `pgvector/pgvector:pg16` (Postgres 16 + pgvector preinstalled), exposing port 5432, healthcheck via `pg_isready`, named volume `neural_postgres_data`, env defaults (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB).
    - **Context:** plan.md "Phase 1 Design" item 4. Image choice: `pgvector/pgvector:pg16` is community-published; preinstalls pgvector against Postgres 16-bullseye base. Avoids manual `CREATE EXTENSION` + custom Dockerfile.
    - **Constraints:** Healthcheck must pass within 30 seconds (NF-Phase0-03). No production secrets in compose file — use env defaults overridable via `.env`.
    - **Non-goals:** No Redis container (Phase 4). No production deployment.
    - **Acceptance:** `docker-compose up -d` starts container; `docker-compose exec postgres psql -U postgres -d postgres -c "SELECT extversion FROM pg_extension WHERE extname='vector'"` returns a non-null version.
    - **Integration:** Provides DB target for T005's stub `db:migrate` script.
    - **Verify:** AC-04 block FAIL → PASS.
  - **Files:** `docker-compose.yml`
  - **dep:** T001 (root for the compose file)
  - **Smoke test:** `docker-compose up -d` starts Postgres + pgvector
  - **Kill criteria:** default block

- [ ] **T005 [US-1] Setup environment variables** (AC-05)
  - **Brief:**
    - **Outcome:** `.env.example` at repo root documents every key needed across Phase 0-9 with one-line comments: DATABASE_URL (Phase 0), ANTHROPIC_API_KEY (Phase 4), CLAUDE_MODEL (Phase 4), R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET (Phase 4), CLERK_SECRET_KEY/CLERK_PUBLISHABLE_KEY (Phase 9), RESEND_API_KEY (Phase 9), REDIS_URL (Phase 4), LANGSMITH_API_KEY (Phase 4 — optional). `.env` listed in `.gitignore` (already added in T001). Root `package.json` script `db:migrate` runs a tiny Node script that connects to Postgres via DATABASE_URL and `CREATE EXTENSION IF NOT EXISTS vector`; prints "OK pgvector vN.N.N".
    - **Context:** spec.md AC-05 + plan.md "Phase 1 Design" item 5. Stub script lives at `scripts/db-migrate-stub.mjs` (project-root-level utility, not under packages/ since no Drizzle yet); plan.md does NOT list this file — adding it now as a Phase 0 utility is acceptable per architecture.md §6.5 (utility scripts at root are permitted).
    - **Constraints:** No real secrets committed. `.env.example` MUST NOT include any plausible-looking key values (use `<your-key-here>` placeholders). Stub script uses Node 22 native `node-postgres` (`pg`) — wait, R9 says no direct `pg` imports outside adapters. Decision: stub script is *infrastructure tooling*, not production code, so it lives at `scripts/db-migrate-stub.mjs` and is exempt — this is the pattern for build/dev scripts. Document this exemption in the script's header comment with a `why:` note.
    - **Non-goals:** No Drizzle config; no actual migrations.
    - **Acceptance:** `cp .env.example .env` succeeds; running `pnpm db:migrate` against the docker-compose Postgres prints "OK pgvector vN.N.N"; CLI `--version` works without `.env` present.
    - **Integration:** Closes the Phase 0 acceptance loop. AC-05 unblocks Phase 1+ work.
    - **Verify:** AC-05 block FAIL → PASS.
  - **Files:** `.env.example`, `scripts/db-migrate-stub.mjs`; modify root `package.json` to add `db:migrate` script
  - **dep:** T004
  - **Smoke test:** `pnpm db:migrate` connects to Postgres and verifies pgvector
  - **Kill criteria:** default block + extra: any attempt to pull a Drizzle dependency in Phase 0 → STOP, that's Phase 4 scope

**Checkpoint:** After T001-T005 complete and the Phase 0 acceptance test goes green, all five exit criteria from `phase-0-setup/README.md` pass. Phase 0 ready for rollup (R19) → `phase-0-current.md`.

---

## Phase N — Polish & Cross-Cutting Concerns

For Phase 0, polish is minimal:

- [ ] **T-PHASE0-DOC [P]** Update root `README.md` with developer quickstart: prerequisites (Node 22, pnpm 9, Docker, Git), `pnpm install`, `docker-compose up -d`, `pnpm db:migrate`, `pnpm cro:audit --version`. Reference `docs/specs/mvp/phases/phase-0-setup/spec.md` for the canonical exit-criteria list.
- [ ] **T-PHASE0-ROLLUP** Author `docs/specs/mvp/phases/phase-0-setup/phase-0-current.md` per R19 + `docs/specs/mvp/templates/phase-rollup.template.md`. Include: active modules introduced, data contracts in effect (none — Phase 0 has no schemas), system flows operational (`pnpm cro:audit --version`, Postgres+pgvector container), known limitations (no Drizzle, no LLM, no browser), open risks for Phase 1 (Pino logger correlation fields untested until first node uses them).

---

## Dependencies & Execution Order

### Within Phase 0

```
T-PHASE0-TEST           # R3.1 TDD — author FIRST; all 5 AC blocks must FAIL
        │
        ▼
      T001               # monorepo root
        │
   ┌────┴────┐
   ▼         ▼
 T002       T004         # agent-core skeleton  +  Postgres container (parallel after T001)
   │         │
   ▼         ▼
 T003       T005         # CLI            +  .env.example & db:migrate stub
   │         │
   └────┬────┘
        ▼
T-PHASE0-DOC, T-PHASE0-ROLLUP   # end-of-phase polish (R19)
```

- **T-PHASE0-TEST runs BEFORE T001 — non-negotiable per R3.1.** All 5 AC blocks must be authored and observed FAILING before any implementation task lands. This is what makes Phase 0 TDD-compliant.
- T001 unlocks everything (workspace + scripts).
- T002 must precede T003 (CLI imports from agent-core observability).
- T004 must precede T005 (`db:migrate` stub needs Postgres running to verify).
- T002 and T004 can run in parallel after T001 (different files, no shared deps).
- T-PHASE0-DOC + T-PHASE0-ROLLUP run after T001-T005 green.

### Comprehension-Debt Pacing (PRD §10.10)

Phase 0 is small enough that parallel subagent dispatch is **not recommended**. Five tightly-coupled config tasks fit one focused session better than 5 parallel agents. Solo-thread implementation per `neural-dev-workflow` Brief format.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Author T-PHASE0-TEST → run, watch all 5 AC blocks FAIL.
2. Implement T001 → re-run test, AC-01 passes.
3. Implement T002 → AC-02 passes.
4. Implement T003 → AC-03 passes.
5. Implement T004 → AC-04 passes.
6. Implement T005 → AC-05 passes.
7. T-PHASE0-DOC + T-PHASE0-ROLLUP.
8. Commit per CLAUDE.md §6 format. Phase 0 done.

### Per-task workflow (apply `neural-dev-workflow` skill)

For each task:
1. Brief format (above) — already declared inline.
2. Kill criteria — default block above.
3. Test-first (R3.1) — T-PHASE0-TEST exists; AC-NN block must FAIL pre-implementation.
4. Implement.
5. Validate: `pnpm lint && pnpm typecheck && pnpm test` (test will be just the Phase 0 acceptance suite at this point).
6. Commit: `feat(setup): T00N <imperative summary> (AC-0N)` per `docs/engineering-practices/git-workflow.md` §2.
7. PR Contract (PRD §10.9) + Spec Coverage (PRD §10.6) in PR body.

---

## Notes

- `[P]` = different files, no dep → parallelizable. T001 unlocks both T002 and T004 in parallel.
- `[US-1]` = single user story for Phase 0.
- TDD: T-PHASE0-TEST must FAIL before any T001-T005 implementation lands (R3.1).
- Commit small atomic commits per R11.5; one task = one commit.
- Apply kill criteria immediately on trigger (R23.4) — do NOT silently retry.
- Phase 0 introduces no Constitution violations and no `why:` provenance overrides.

---

## Cross-references

- spec.md, plan.md (this folder)
- `docs/specs/mvp/tasks-v2.md` — T001-T005 canonical
- `docs/specs/mvp/constitution.md` R3, R10, R11, R17-R19, R23
- `docs/engineering-practices/git-workflow.md` — commit format
- `.claude/skills/neural-dev-workflow/` — Brief, Kill Criteria, PR Contract templates
