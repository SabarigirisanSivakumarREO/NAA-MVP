---
title: Phase 0 Rollup — Current System State
artifact_type: rollup
status: implemented       # immediately implemented at phase exit; → verified when Phase 1 begins; → superseded when Phase 1 rollup exists
version: 1.0
phase_number: 0
phase_name: Setup
phase_completed_on: 2026-05-05
created: 2026-05-05
updated: 2026-05-05
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []
supersedes: null
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-0-setup/tasks.md v0.5
  - docs/specs/mvp/phases/phase-0-setup/spec.md v0.5
  - docs/specs/mvp/phases/phase-0-setup/plan.md v0.3
req_ids: []
delta:
  new:
    - First phase rollup landing under R19 phase folder layout
    - Phase 0 modules + scaffolding listed below
  changed:
    - First phase — no predecessor state to change
  impacted:
    - Phase 0b (Heuristic Authoring infra) — can now begin authoring against agent-core
    - Phase 1 (Browser Perception Foundation) — can now begin against the workspace + adapters/ boundary
  unchanged:
    - First phase — no predecessor state to carry through
governing_rules:
  - Constitution R19 (Rollup per Phase)
---

# Phase 0 — Setup — Current System State Rollup

> **Summary (~200 tokens):** Monorepo + workspace + scaffolding shipped. `pnpm cro:audit --version` runs end-to-end; `docker compose up -d --wait` brings Postgres 16/pgvector + Valkey 8 + Mailpit healthy; `pnpm db:migrate` CREATEs the pgvector extension via a stub script. agent-core skeleton exposes a Pino logger factory + an `adapters/` directory enforcing R9 boundary from day one. apps/cli skeleton handles `--version` only; subcommands land Phase 5+. Five conformance-style acceptance criteria (AC-01..AC-05) all green via `tests/acceptance/phase-0-setup.spec.ts`. NO domain entities, NO Zod schemas, NO LLM calls, NO browser, NO Drizzle migrations exist yet — those land in Phase 1+ + Phase 4.

> **Governed by:** Constitution R19. Rollup size cap: 300 lines / ~3000 tokens.

---

## 1. Active modules introduced this phase

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `createLogger` | `packages/agent-core/src/observability/logger.ts` | Pino logger factory; `base:null` strips pid+hostname; isoTime; dev-only pino-pretty transport | none yet (R3.1 unit tests land Phase 1+ alongside first node that calls it) |
| Adapter boundary marker | `packages/agent-core/src/adapters/README.md` | R9 boundary enforcement note; lists 9 SDKs that MUST be adapter-wrapped + canonical pattern | N/A (documentation-only; ESLint enforcement lands Phase 4 with first concrete adapter) |
| agent-core barrel | `packages/agent-core/src/index.ts` | Named-export barrel; sub-paths (`./observability`) exposed via package.json#exports | N/A (empty surface) |
| CLI version handler | `apps/cli/src/index.ts` | `--version` / `-v` print version+newline to stdout exit 0; any other arg prints "Subcommands not yet implemented (Phase 5+)" to stderr exit 0 | covered by phase-0-setup.spec.ts AC-03 |
| db:migrate stub | `scripts/db-migrate-stub.mjs` | Connects to Postgres via POSTGRES_URL; `CREATE EXTENSION IF NOT EXISTS vector`; prints `OK pgvector vN.N.N`. R9-exempt per spec.md §Assumptions infrastructure-tooling carve-out. Phase 4 replaces with Drizzle migration runner. | covered by phase-0-setup.spec.ts AC-05 |
| Phase 0 acceptance test | `tests/acceptance/phase-0-setup.spec.ts` | 5 `test()` blocks, one per AC-01..AC-05, via @playwright/test + child_process.execSync | self-testing (all 5 green at phase exit) |

---

## 2. Data contracts now in effect

**None.** Phase 0 introduces NO domain entities, NO Zod schemas, NO LLM contracts, NO DB tables. The only contracts are infrastructure config files (package.json, pnpm-workspace.yaml, turbo.json, tsconfig.json, docker-compose.yml, .env.example) which are not modeled as domain types.

First domain contract (`PageStateModel`) lands in Phase 1 T014 (forward-pulled to week 1 per implementation-roadmap.md §6 to unblock walking-skeleton T-SKELETON-002).

---

## 3. System flows now operational

### Flow: install → green dev environment in <30 minutes

**Trigger:** developer clones the repo + runs the README quickstart sequence
**Steps:** `pnpm install` → `docker compose up -d --wait` → `cp .env.example .env` → `pnpm db:migrate` → `pnpm cro:audit --version`
**Output:** all 5 commands exit 0; pgvector v0.8.2 reported; CLI prints `0.1.0`; postgres + valkey + mailpit all healthy
**Spec:** spec.md US-1 + AC-01..AC-05 + NF-Phase0-01 (<30min)

### Flow: workspace build / typecheck / test

**Trigger:** `pnpm build` / `pnpm typecheck` / `pnpm test`
**Steps:** Turborepo 2.x discovers @neural/agent-core + @neural/cli workspaces; runs each pipeline in parallel where possible; caches outputs under `.turbo/`
**Output:** Both workspaces compile clean; agent-core Vitest reports zero tests (passWithNoTests); cli reports placeholder echo
**Spec:** AC-02 (build/test) + AC-03 (CLI build via tsc)

### Flow: db:migrate stub

**Trigger:** `pnpm db:migrate`
**Steps:** Node 22 loads `--env-file-if-exists=.env` → `scripts/db-migrate-stub.mjs` reads `process.env.POSTGRES_URL` → `pg.Client.connect()` → `CREATE EXTENSION IF NOT EXISTS vector` → query `pg_extension` for installed version → print
**Output:** `OK pgvector v0.8.2` on stdout, exit 0
**Spec:** AC-05

---

## 4. Known limitations carried forward

| Limitation | Phase to resolve | Workaround in place |
|---|---|---|
| No Drizzle ORM, no domain DB tables | Phase 4 (T070 schema baseline) | `db:migrate` stub does CREATE EXTENSION only; Phase 4 swaps in Drizzle migration runner |
| No LLM adapter, no Anthropic SDK wrapping | Phase 4 (T073 LLMAdapter cornerstone) | Adapter boundary enforced via README marker only; no enforcement code yet |
| No Playwright browser runtime | Phase 1 (T006) | adapters/README.md lists Playwright as a required wrap |
| No domain Zod schemas (PageStateModel, AnalyzePerception, Finding, etc.) | Phase 1 T014 (PageStateModel forward-pulled) + Phase 1 full + Phase 7 + Phase 9 | None — first schemas land in week 1 forward-pull |
| No ESLint config; lint scripts are stubs (`echo`) | Phase 4 (T073 alongside LLMAdapter) | TypeScript strict + Vitest unit tests catch most defects; ESLint will retroactively catch R13 forbidden patterns |
| Pino logger correlation fields (audit_run_id, page_url, node_name, heuristic_id, trace_id) defined in comment but not wired | Phase 1+ (when first nodes use child loggers) | Logger factory accepts `name` param; correlation comes via `.child({ audit_run_id, ... })` at call sites |
| No conformance test suite | Phase 1+ (per-component as they land) | Acceptance test only (`phase-0-setup.spec.ts`); `pnpm test:conformance` returns nothing |
| Windows VCRedist required for turbo.exe + future Playwright Chromium | one-time host fix | Documented in README troubleshooting; `winget install Microsoft.VCRedist.2015+.x64` |

---

## 5. Open risks for next phase

| Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| Pino logger correlation fields untested until first Phase 1 node uses them; fields could be wrong shape | LOW — fields are just `.child()` keys, fixable at call site | Phase 1 implementer | First node integration test asserts log output shape contains all correlation fields |
| `--env-file-if-exists=.env` is Node 22-specific syntax; older Node would silently fail | MEDIUM if dev uses Node 20 | new-dev onboarding | engines.node:"22" + .nvmrc enforce Node 22; CI uses Node 22; warning surfaces locally |
| pnpm 10 ignores postinstall scripts by default (esbuild warning during install) | LOW — esbuild ships prebuilt binaries via @esbuild/win32-x64 optional dep; works without postinstall | Phase 1 implementer if Vitest has weird issues | Documented warning visible in install output; `pnpm approve-builds` available if specific dep requires it |
| `.claude/settings.local.json` was committed before .gitignore excluded it; shows as "modified" in git status forever | COSMETIC | n/a | Future session can `git rm --cached .claude/settings.local.json` to fully untrack; not urgent |

---

## 6. Conformance gate status

**Phase 0 defined no conformance tests** (spec.md SC-003 explicitly defers ESLint + lint-based conformance to Phase 4 when `T073` lands the first concrete adapter). Acceptance suite is the only test gate.

| Test | Status | Last run |
|---|---|---|
| `pnpm test:integration` (= Phase 0 acceptance, AC-01..AC-05) | ✅ 5/5 green | 2026-05-05 |
| `pnpm typecheck` (workspace-wide) | ✅ 2/2 green (agent-core + cli) | 2026-05-05 |
| `pnpm test` (workspace-wide unit) | ✅ 2/2 green (Vitest passWithNoTests + cli echo placeholder) | 2026-05-05 |
| `pnpm test:conformance` | N/A — no conformance tests defined for Phase 0 | — |

---

## 7. What Phase 1 should read

When Phase 1 starts, the recommended reading order is:

1. **This file** (`phase-0-current.md`) — YOU ARE HERE — compressed Phase 0 state
2. `docs/specs/mvp/phases/phase-1-perception/README.md` — Phase 1 summary + exit criteria
3. `docs/specs/mvp/phases/phase-1-perception/spec.md` — Phase 1 spec (AC-NN list + R-NN requirements)
4. `docs/specs/mvp/phases/phase-1-perception/tasks.md` — T006-T015 task definitions
5. Specific REQ-IDs cited per task (open only what you need from `docs/specs/architecture/§06-§07.x`)

For BINDING conditions from Phase 1's R17.4 review (Session 7): see `docs/specs/mvp/sessions/session-handover.md` block 2 — C1 BINDING (T015 Playwright timeout budgets ≤20s/site).

Do NOT load all Phase 0 artifacts. The compression is intentional.

---

## 8. Cost + time summary (this phase)

| Metric | Target (per spec NF-Phase0-01 + roadmap §7 wk1) | Actual |
|---|---|---|
| Duration | <3 calendar days (per README estimate) | 1 calendar day (2026-05-05; Day 1 of week 1) |
| Engineering hours | ~6-10 hr per README | ~3 hr (one focused session; solo-thread per tasks.md §"Comprehension-Debt Pacing") |
| LLM spend on dev | n/a (Phase 0 has no production LLM calls) | n/a |
| Tasks completed | 5 + TDD scaffold + 2 polish | 8/8 (T-PHASE0-TEST + T001-T005 + T-PHASE0-DOC + T-PHASE0-ROLLUP) |
| Acceptance ACs green | 5/5 | 5/5 ✅ |
| R11.4 spec defects surfaced + patched | 0 expected | 2 (AC-04 wording v0.4; AC-05 env var v0.5) |
| Spec/tasks/plan version bumps | 0 | 2× (v0.3 → v0.4 → v0.5) — spec + tasks; plan stayed v0.3 (no plan changes) |
| Commits on `feat/week-1-walking-skeleton` | 6-8 (one per task or bundled per (iii)) | 7 (T-PHASE0-TEST+T001 bundled; T002, T003, T004, T005, T-PHASE0-DOC, T-PHASE0-ROLLUP individual) |
| Env install side-effects | none expected | Microsoft Visual C++ Redistributable installed (one-time host fix; documented in README troubleshooting) |

---

## Cross-references

- Phase 0 spec: `docs/specs/mvp/phases/phase-0-setup/spec.md` v0.5
- Phase 0 tasks: `docs/specs/mvp/phases/phase-0-setup/tasks.md` v0.5
- Phase 0 plan: `docs/specs/mvp/phases/phase-0-setup/plan.md` v0.3
- Phase 0 README: `docs/specs/mvp/phases/phase-0-setup/README.md` v1.1
- Repo root README: `README.md` (T-PHASE0-DOC; commit `42a21fb`)
- Walking-skeleton roadmap: `docs/specs/mvp/implementation-roadmap.md` v0.3
- Session handover: `docs/specs/mvp/sessions/session-handover.md` block 1 (Phase 0 row to flip from `approved` → `implemented` in same commit as this rollup)
- INDEX.md: `docs/specs/mvp/phases/INDEX.md` row 0 to flip ⚪ → 🟢 in same commit as this rollup
