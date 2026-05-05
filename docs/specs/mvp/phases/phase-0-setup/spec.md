---
title: Phase 0 — Setup
artifact_type: spec
status: implemented
version: 0.6
created: 2026-04-26
updated: 2026-05-05
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (canonical product requirements; F-001 through F-006)
  - docs/specs/mvp/constitution.md (R1-R26 non-negotiable rules)
  - docs/specs/mvp/architecture.md (§6.4 tech stack, §6.5 file locations)
  - docs/specs/mvp/tasks-v2.md (T001-T005 verbatim)
  - docs/specs/mvp/phases/phase-0-setup/README.md (phase summary + exit criteria)

req_ids: []

impact_analysis: null
breaking: false
affected_contracts: []

delta:
  new: []
  changed:
    - v0.1 → v0.2 applied 5 polish fixes from /speckit.analyze report (F1, F3, F11, F12, F18) without changing AC-NN IDs (R18 append-only preserved)
    - v0.2 → v0.3 applied 3 analyze-driven fixes (M1 SC-003 lint clause deferred to Phase 4 ESLint scope; M2 NF-Phase0-02 marked observation-only; L2 R1-R23 → R1-R26 in Mandatory References + derived_from + R24-R26 layer-MUST-NOT N/A note); status bumped draft → approved (R17.4 engineering lead sign-off via 2026-04-30 session)
    - v0.3 → v0.4 (2026-05-05 T004 implementation surfaced spec defect per R11.4) — AC-04 wording corrected; original conflated "binaries preinstalled" with "extension CREATEd in DB". Reality: `pgvector/pgvector:pg16` image preinstalls binaries (queryable via `pg_available_extensions`) but does NOT auto-CREATE the extension; the `/docker-entrypoint-initdb.d/` directory ships empty. CREATE EXTENSION is delegated to T005's `pnpm db:migrate` stub per §Assumptions (already documented). Patch: AC-04 now uses `pg_available_extensions` (binaries) instead of `pg_extension` (CREATEd); CREATE EXTENSION verification stays in AC-05's T005 scope. AC-NN ID preserved (R18 append-only); only the criterion text under AC-04 changed. No code/behavior change beyond aligning spec text with documented design.
    - v0.4 → v0.5 (2026-05-05 T005 implementation) — AC-05 wording corrected: env var name `DATABASE_URL` → `POSTGRES_URL`. Original cited DATABASE_URL but the .env.example authored 2026-04-24 (alongside docker-compose.yml) uses POSTGRES_URL — consistent with the docker-compose POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB convention. Patch aligns spec text with the canonical scaffolding env-var name. AC-NN ID preserved. CLAUDE_MODEL also dropped from the AC-05 example list (model name `claude-sonnet-4-*` is hardcoded per CLAUDE.md §2 + architecture.md §6.4; no env var needed).
    - v0.5 → v0.6 (2026-05-05 T-PHASE0-ROLLUP at phase exit) — status bumped `approved` → `implemented` per CLAUDE.md §8c (R17 lifecycle: all tasks done, acceptance tests 5/5 green). No content changes vs v0.5. Status will bump to `verified` when Phase 1 begins per INDEX.md "Rollup locations" convention.
  impacted:
    - tests/acceptance/phase-0-setup.spec.ts AC-04 block — query updated (T004 v0.4 commit)
    - docs/specs/mvp/phases/phase-0-setup/tasks.md T004 + T005 — wording updated in respective commits
  unchanged:
    - AC-01..AC-05 IDs (R18 append-only)
    - R-01..R-06 functional requirement IDs and statements
    - Out of Scope, Success Criteria, Constitution Alignment Check (all preserved)

governing_rules:
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R19 (Rollup per Phase)
  - Constitution R22 (The Ratchet — every claim cites a source)
---

# Feature Specification: Phase 0 — Setup

> **Summary (~150 tokens — agent reads this first):** Bootstrap the Neural monorepo so any new engineer can clone the repo and reach a green local dev environment in under 30 minutes. Five tasks (T001-T005): pnpm + Turborepo workspaces, agent-core skeleton with Vitest, CLI skeleton with `pnpm cro:audit --version`, Docker Compose Postgres 16 + pgvector, and `.env.example`. No browser, no LLM, no analysis logic, no schema migrations. Pure foundation. Blocks every subsequent phase.

**Feature Branch:** `phase-0-setup` (created later; spec authoring runs on master)
**Input:** Phase 0 scope from `docs/specs/mvp/phases/INDEX.md` row 0 + `tasks-v2.md` T001-T005

---

## Mandatory References (Spec Kit MUST read these BEFORE drafting)

1. `docs/specs/mvp/constitution.md` — Rules R1-R26 are non-negotiable. Phase 0 introduces no analysis logic, so R5/R6 (analysis IP) are trivially satisfied; R9 (adapter pattern), R10 (code quality), R11 (spec-driven), R17-R23 (lifecycle/rollup/impact/traceability/Ratchet/Kill) all apply. R24-R26 (perception / context-capture / state-exploration MUST-NOTs) are layer-specific and N/A in Phase 0 — those layers don't exist yet.
2. `docs/specs/mvp/PRD.md` — F-001 through F-006 cover the foundation and CLI command surface. NF-001..NF-010 not yet observable in Phase 0 (no audits run yet).
3. `docs/specs/mvp/architecture.md` — §6.4 tech stack pins (TypeScript 5, Node 22 LTS, Turborepo 2, pnpm 9, Postgres 16 + pgvector, Vitest, Pino) — do NOT propose alternatives. §6.5 file location decision tree.
4. `docs/specs/mvp/tasks-v2.md` — T001-T005 verbatim acceptance criteria; this spec MUST NOT renumber.
5. `docs/specs/mvp/phases/phase-0-setup/README.md` — phase exit criteria + reading order.

---

## Constraints Inherited from Neural Canonical Specs

These constraints apply to every Phase 0 artifact:

- **Tech stack pinned (architecture.md §6.4):** TypeScript 5 + Node 22 LTS + Turborepo 2 + pnpm 9 + Vitest + Pino + Postgres 16 + pgvector. Do NOT propose alternatives.
- **File locations pinned (architecture.md §6.5):** monorepo root + `packages/agent-core/` + `apps/cli/` + `docker-compose.yml` + `.env.example`. Any new top-level directory requires ASK FIRST per R11.3.
- **Adapter pattern (R9):** scaffold the `packages/agent-core/src/adapters/` directory in Phase 0; concrete adapter implementations land in their respective phases (LLMAdapter Phase 4, BrowserEngine Phase 1, StorageAdapter Phase 4, etc.). No direct SDK imports outside `adapters/`.
- **No `console.log` in production** (R10.6). CLI user-facing stdout via a CLI library (or `process.stdout.write`) is permitted; *server-side* `console.log` is forbidden.
- **Pino logger** with correlation fields (audit_run_id, page_url, node_name, heuristic_id, trace_id) — Phase 0 sets up the logger module skeleton; correlation fields populate when nodes exist (Phase 1+).
- **No `any` without `// TODO: type this` + tracking issue** (R2.1, R13).
- **Files SHOULD be under 300 lines, functions under 50 lines, named exports** (R10.1-R10.3).
- **Phase 0 has NO append-only tables yet, NO LLM calls, NO heuristic content** — R5, R6, R7.4, R10 (temperature) checks are trivially satisfied.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A new engineer reaches green local dev in < 30 minutes (Priority: P1) 🎯 MVP

A new engineer clones the Neural repository, follows the README, and reaches a state where every Phase 0 exit criterion passes — without needing tribal knowledge or workarounds.

**Why this priority:** Phase 0 has exactly one user story. Without it, no other phase can begin. It is the entire MVP slice for this phase.

**Independent Test:** On a clean machine with Node 22 LTS, pnpm 9, Docker, and Git installed, run the README quickstart sequence. All five exit-criterion commands should pass on first attempt.

**Acceptance Scenarios:**

1. **Given** a clean clone of the repo, **When** the engineer runs `pnpm install` at the root, **Then** all workspace dependencies resolve and lockfile is consistent (no install warnings about missing peer deps that block the build).
2. **Given** dependencies installed, **When** the engineer runs `pnpm build`, **Then** TypeScript compiles cleanly across `packages/agent-core` and `apps/cli` with zero errors.
3. **Given** `apps/cli` is built, **When** the engineer runs `pnpm cro:audit --version`, **Then** stdout prints a semver-compatible version string and the process exits 0.
4. **Given** Docker is running, **When** the engineer runs `docker-compose up -d`, **Then** a Postgres 16 container with pgvector extension reports healthy within 30 seconds.
5. **Given** `.env.example` exists, **When** the engineer copies it to `.env` and inspects it, **Then** every secret/configuration key required by the MVP is documented with a short comment explaining its purpose, and `.env` is git-ignored.

### Edge Cases

- **Node version mismatch (e.g., Node 20):** the build SHOULD fail loudly via an `engines` declaration in root `package.json` rather than silently producing a broken artifact.
- **pnpm not installed:** documented in README quickstart; out of scope for code-level enforcement.
- **Docker daemon not running:** `docker-compose up -d` exits non-zero with a clear error; not Phase 0's responsibility to detect/wrap.
- **Missing `.env`:** the CLI's `--version` command MUST work without `.env` (no env reads on the version path); other commands may fail on missing keys, but those don't exist yet.
- **Drizzle schema migration on first run:** Phase 0 ships a stub `pnpm db:migrate` script that connects to Postgres and verifies pgvector extension is loaded; *no schema migrations are executed* because no schema is defined yet. Schema lands in Phase 4. See **Assumptions** below.

---

## Acceptance Criteria *(mandatory — stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked task |
|----|-----------|----------------------|-------------|
| AC-01 | `pnpm install` at repo root succeeds; pnpm-workspace.yaml declares `packages/*` and `apps/*`; turbo.json defines `build`, `lint`, `typecheck`, `test` pipelines | `tests/acceptance/phase-0-setup.spec.ts` (T-NNN added in tasks.md; smoke: shell exec) | T001 |
| AC-02 | `pnpm build` compiles `packages/agent-core` (TypeScript 5 strict, Vitest configured); `pnpm test` in agent-core runs zero tests successfully (placeholder for TDD-first phases) | `tests/acceptance/phase-0-setup.spec.ts` | T002 |
| AC-03 | `pnpm cro:audit --version` prints semver-compatible string from `apps/cli/package.json#version`; exit code 0 | `tests/acceptance/phase-0-setup.spec.ts` | T003 |
| AC-04 | `docker compose up -d` starts a Postgres 16 container with `pgvector` **binaries preinstalled** (CREATE EXTENSION delegated to T005's `pnpm db:migrate` per §Assumptions); `docker compose exec postgres psql -tAc 'SELECT default_version FROM pg_available_extensions WHERE name=''vector''';` returns a non-null row | `tests/acceptance/phase-0-setup.spec.ts` | T004 |
| AC-05 | `.env.example` exists at repo root; documents every key required by `tasks-v2.md` Phase 0-9 (POSTGRES_URL, ANTHROPIC_API_KEY, R2 keys, CLERK keys, RESEND key, REDIS_URL); `.env` is in `.gitignore`; CLI `--version` works without `.env` present | `tests/acceptance/phase-0-setup.spec.ts` | T005 |

**Note:** AC-NN IDs are append-only on subsequent edits per Constitution R18. Never renumber.

---

## Functional Requirements *(mandatory — cross-ref existing PRD F-IDs where applicable)*

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST provide a pnpm 9 + Turborepo 2 monorepo with `packages/` and `apps/` workspaces; root `package.json` declares Node 22 LTS engine and `cro:audit` script | F-001 (CLI command surface) | architecture.md §6.5 |
| R-02 | System MUST provide a `packages/agent-core` package with TypeScript 5 strict, Vitest configured, named-export `src/index.ts`, no `any` without TODO+issue | F-002 (Core library structure) | architecture.md §6.5 |
| R-03 | System MUST provide an `apps/cli` package with `pnpm cro:audit --version` printing semver from package.json | F-003 (CLI entry point) | architecture.md §6.5 |
| R-04 | System MUST provide a `docker-compose.yml` running Postgres 16 + pgvector locally with healthcheck and named volume for data persistence | F-004 (Local dev environment) | architecture.md §6.4 |
| R-05 | System MUST provide a `.env.example` documenting all secrets/configuration keys; `.env` MUST be git-ignored; CLI version path MUST NOT read `.env` | F-005 (Configuration & secrets) | architecture.md §6.4 |
| R-06 | System MUST scaffold (empty directory + README.md placeholder) the `packages/agent-core/src/adapters/` directory to enforce R9 boundary from day one | F-002, R9 | architecture.md §6.5 — implemented inside T002 (agent-core skeleton); see tasks.md |

---

## Non-Functional Requirements *(if feature affects observable outcomes)*

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-Phase0-01 | Time to green local environment from `git clone` | < 30 minutes on standard developer hardware (M-series Mac or equivalent) | (new — Phase 0 specific; rolls into NF-009 developer experience) | manual stopwatch on first onboarding; subsequent `tests/acceptance/phase-0-setup.spec.ts` validates command sequence |
| NF-Phase0-02 | TypeScript compile time for `pnpm build` | < 30 seconds on cold cache (observation-only target — no automated gate in Phase 0; revisit if cold builds exceed 60s) | (new — Phase 0 specific) | Turborepo timing output (manual observation; not asserted by acceptance test) |
| NF-Phase0-03 | Postgres container healthy after `docker-compose up -d` | < 30 seconds | (new — Phase 0 specific) | docker healthcheck status |

---

## Key Entities *(if feature involves data)*

Phase 0 introduces NO domain entities (no Zod schemas, no DB tables, no LLM contracts). The only "entities" are infrastructure config files. They live at fixed paths per architecture.md §6.5 and are not modeled as domain types.

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** A new engineer can `git clone` the repo and reach the Phase 0 exit-criterion green state in under 30 minutes (NF-Phase0-01).
- **SC-002:** All five exit criteria (AC-01 through AC-05) pass on a fresh clone via the Phase 0 acceptance test.
- **SC-003:** Zero TypeScript compilation errors across the workspace. (Lint coverage is Phase 4 scope — ESLint configuration lands in T073 alongside the LLM adapter cornerstone; lint gates apply from Phase 4 forward.)
- **SC-004:** The `adapters/` boundary is in place from day one — when later phases add LLM/Browser/Storage code, it lands inside `adapters/` automatically because that's the only path that exists.

---

## Constitution Alignment Check *(mandatory — must pass before status: approved)*

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — Phase 0 has no findings, no LLM calls
- [x] Does NOT auto-publish findings without consultant review (warm-up rule, F-016) — N/A in Phase 0
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — no tables exist yet
- [x] Does NOT import vendor SDKs outside adapters (R9) — `adapters/` scaffold is created in R-06; no imports yet
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` (R10) — no LLM calls in Phase 0
- [x] Does NOT expose heuristic content outside the LLM evaluate prompt (R6) — no heuristics in Phase 0
- [x] DOES include a conformance test stub for every AC-NN — `tests/acceptance/phase-0-setup.spec.ts` (defined in tasks.md)
- [x] DOES carry frontmatter delta block — see frontmatter above
- [x] DOES define kill criteria — N/A inline; T001-T005 are each < 2 hrs and don't touch shared contracts (R23 thresholds not crossed). Default block in tasks.md applies if a task expands.
- [x] DOES reference REQ-IDs — Phase 0 cites PRD F-IDs and architecture §6.4/§6.5 directly; no architecture-spec REQ-IDs apply (those are domain-layer)

All boxes ticked → spec eligible for `status: validated → approved` after review.

---

## Out of Scope (cite PRD §3.2 explicit non-goals)

- Drizzle schema migrations with actual tables — deferred to Phase 4 (DB schema lands with first audit_runs / findings tables)
- LLM adapter implementation — Phase 4 + R9
- Browser runtime / Playwright — Phase 1
- Authentication (Clerk) — Phase 8 or later (Dashboard)
- Heuristic content — Phase 0b (deferred this session per agreed scope; engineering-owned per F-012 amendment 2026-04-26)
- CI/CD pipelines (GitHub Actions) — Phase 9 Foundations & Delivery
- Production deployment configuration (Fly.io, Vercel) — Phase 9
- Observability dashboards (LangSmith, Grafana) — Phase 4 / Phase 9
- Stealth plugin for Playwright — deferred to v1.1 per PRD §3.2

---

## Assumptions

- **Drizzle script in Phase 0 is a stub.** README exit criterion "`pnpm db:migrate` creates initial schema" is honored by a stub script that connects to Postgres + verifies pgvector extension; *no schema migrations exist yet* because no domain entities are defined. Actual schema migrations land in Phase 4. AC-04's pgvector check is the proof of life here.
- **Developer machine prerequisites** (Node 22 LTS, pnpm 9, Docker, Git) are documented in `README.md` quickstart, not enforced by code. The `engines` field in root `package.json` enforces Node version at install time.
- **Single-agency, single-tenant.** Phase 0 sets up a monorepo for REO Digital's pilot deployment. Multi-tenant SaaS is permanent non-goal for MVP per PRD §3.2.
- **Pino logger module skeleton** is created in `packages/agent-core/src/observability/` with default correlation field schema, but no nodes call it yet (no node code exists in Phase 0). Wiring happens in Phase 1+ when nodes appear.
- **Turborepo cache** is local-only in Phase 0 (no remote cache). Remote cache configuration deferred — not on critical path.
- **Lock file is committed** (`pnpm-lock.yaml`) per pnpm convention; never auto-regenerate without approval (R2.3 spec authority).
- **Infrastructure utility scripts at `scripts/` are EXEMPT from the R9 adapter boundary.** *Why:* R9 governs production runtime code that touches external services on behalf of clients (LLM, browser, DB, storage). Build / dev / migration tooling is operational scaffolding, not customer-facing code. *Criteria for exemption:* (a) only invoked manually or via npm scripts during development / CI / one-time migrations; (b) does NOT run in production at customer request (no scheduled jobs, no on-demand triggers from API); (c) is NOT imported as a module by application code in `packages/` or `apps/`. *Examples:* `scripts/db-migrate-stub.mjs` (Phase 0). *Counterexample:* a future `scripts/send-audit-report.mjs` invoked from the production audit pipeline — that would be production code and MUST go through `NotificationAdapter` per R9. *Codification:* this exemption is documented here per Constitution R22.2 (Ratchet — every rule traces to a decision); reviewed quarterly per R22.3.

---

## Next Steps

After this spec reaches `status: approved`:

1. Run `/speckit.plan` (or write `plan.md` directly per agreed workflow) to derive the implementation plan from this spec.
2. Run `/speckit.tasks` to produce `tasks.md` referencing T001-T005 from `tasks-v2.md`.
3. Run `/speckit.analyze` (dispatched to Explore subagent) for cross-artifact consistency check.
4. Phase 0 implementation runs in a separate session per the agreed workflow split (this session = spec authoring; implementation session = code execution per R23 + PR Contract).

---

## Cross-references

- `docs/specs/mvp/phases/INDEX.md` — phase decision table; Phase 0 row
- `docs/specs/mvp/phases/phase-0-setup/README.md` — phase summary + exit criteria
- `docs/specs/mvp/tasks-v2.md` T001-T005 — canonical task definitions
- `docs/specs/mvp/PRD.md` F-001 through F-006 — functional scope
- `docs/specs/mvp/architecture.md` §6.4 + §6.5 — tech stack + file structure
- `docs/specs/mvp/constitution.md` R9, R10, R11, R17-R19, R22-R23 — applicable rules
