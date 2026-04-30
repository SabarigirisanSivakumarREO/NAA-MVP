---
title: Implementation Plan — Phase 0 Setup
artifact_type: plan
status: approved
version: 0.3
created: 2026-04-26
updated: 2026-04-30
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-0-setup/spec.md (the spec this plan implements)
  - docs/specs/mvp/architecture.md §6.4 (tech stack — no overrides allowed)
  - docs/specs/mvp/architecture.md §6.5 (project structure — file decisions)
  - docs/specs/mvp/constitution.md (R1-R26)
  - docs/specs/mvp/testing-strategy.md (§9.6 conformance pattern)
  - docs/specs/mvp/risks.md (§15 risk register)

req_ids: []

impact_analysis: null
breaking: false
affected_contracts: []

delta:
  new:
    - First phase plan landing under R19 phase folder layout
    - Tech stack subset declared (only Phase 0 deps; rest deferred)
    - v0.2 — `scripts/db-migrate-stub.mjs` added to "Files this feature creates" table (analyze finding F1)
    - v0.2 — R10.6 CLI exception explicitly echoed in Constitution Check section (analyze finding F12)
  changed:
    - v0.1 → v0.2 applied analyze-driven fixes (F1, F12); no design changes
    - v0.2 → v0.3 applied 1 analyze-driven fix (L2 — derived_from R1-R23 → R1-R26 + Complexity Tracking "23 rules" → "26 rules" with R24-R26 layer-MUST-NOT N/A note); status bumped draft → approved (R17.4 engineering lead sign-off via 2026-04-30 session)
  impacted: []
  unchanged:
    - Tech stack table, Project Structure narrative, Approval Gates

governing_rules:
  - Constitution R9 (Loose Coupling / Adapter Pattern)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R17 (Lifecycle)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R23 (Kill Criteria Before Task Start)
---

# Implementation Plan: Phase 0 — Setup

> **Summary (~100 tokens):** Build the monorepo foundation in 5 sequential tasks. T001 lands pnpm + Turborepo workspaces. T002 adds the agent-core package skeleton with TypeScript + Vitest. T003 adds the CLI app with `cro:audit --version`. T004 wires Docker Compose Postgres 16 + pgvector. T005 documents `.env.example`. No external risk: pure config, no LLM, no browser, no Drizzle schema. Phase 0 also scaffolds `packages/agent-core/src/adapters/` (R9 boundary) and `observability/` (Pino logger module) so later phases land inside the constitution from day one.

**Branch:** `phase-0-setup` (created at implementation time, not now)
**Date:** 2026-04-26
**Spec:** `docs/specs/mvp/phases/phase-0-setup/spec.md`

---

## Summary

Phase 0 establishes the monorepo skeleton (`pnpm` workspaces, Turborepo pipelines), one shared package (`packages/agent-core`), one app (`apps/cli`), local Postgres 16 + pgvector via Docker Compose, and the env-var contract (`.env.example`). No business logic lands here — the package surface area is empty exports + Vitest config + a logger module. The `adapters/` directory is created empty (with a `README.md` enforcing R9) so subsequent phases default to the right place.

---

## Technical Context

**This is NOT free-form.** All values below are pinned by `docs/specs/mvp/architecture.md` §6.4. Do not propose alternatives.

| Field | Value | Source | Used in Phase 0? |
|---|---|---|---|
| Language | TypeScript 5.x | architecture.md §6.4 | ✅ yes |
| Runtime | Node.js 22 LTS | architecture.md §6.4 | ✅ yes |
| Monorepo | Turborepo 2.x + pnpm 9.x | architecture.md §6.4 | ✅ yes |
| Validation | Zod 3.x | architecture.md §6.4 + R2.2 | ⏸️ scaffold only (no schemas yet) |
| Browser | Playwright | architecture.md §6.4 | ❌ Phase 1 |
| Orchestration | LangGraph.js | architecture.md §6.4 | ❌ Phase 8 |
| MCP | `@modelcontextprotocol/sdk` | architecture.md §6.4 | ❌ Phase 2 |
| Primary LLM | Claude Sonnet 4 | architecture.md §6.4 + R10 | ❌ Phase 4 |
| Database | Postgres 16 + pgvector | architecture.md §6.4 | ✅ yes (container only; schema Phase 4) |
| ORM | Drizzle | architecture.md §6.4 + R7.1 | ⏸️ stub `db:migrate` script; schema Phase 4 |
| Cache / Queue | Redis + BullMQ | architecture.md §6.4 | ❌ Phase 4 |
| API framework | Hono 4.x | architecture.md §6.4 | ❌ Phase 9 (dashboard API) |
| Frontend | Next.js 15 + shadcn/ui + Tailwind | architecture.md §6.4 | ❌ Phase 9 (dashboard) |
| Auth | Clerk | architecture.md §6.4 | ❌ Phase 9 |
| Storage | Cloudflare R2 (LocalDisk fallback dev) | architecture.md §6.4 + §7.5 | ❌ Phase 4 |
| Image annotation | Sharp | architecture.md §6.4 | ❌ Phase 7 (annotate node) |
| PDF | Playwright `page.pdf()` | architecture.md §6.4 | ❌ Phase 9 (delivery) |
| Logging | Pino (JSON structured) | architecture.md §6.4 + R10.6 | ✅ yes (logger module skeleton) |
| Email | Resend | architecture.md §6.4 | ❌ Phase 9 |
| Testing | Vitest + Playwright Test | architecture.md §6.4 + R3 | ✅ yes (Vitest + Playwright Test for acceptance only) |
| Deployment | Fly.io + Vercel | architecture.md §6.4 | ❌ Phase 9 |

**Performance / Scale targets:** Phase 0 has no NF-001..NF-010 targets observable yet (no audits run). Phase-specific targets in spec.md (NF-Phase0-01 through NF-Phase0-03).

**Project Type:** monorepo with `packages/*` shared libraries + `apps/*` deployables — exactly per architecture.md §6.5.

**Constraints (cite PRD NF-IDs):** none active in Phase 0; spec.md NF-Phase0-01..03 govern Phase 0 only.

---

## Constitution Check (GATE — must pass before Phase 0 research)

- [x] R5.3 + GR-007: No conversion-rate predictions — Phase 0 has no findings
- [x] R6: Heuristic content boundary preserved — no heuristics loaded in Phase 0
- [x] R7.1: All DB access via Drizzle — only stub script in Phase 0; no DB access yet
- [x] R7.2: RLS enabled on all client-scoped tables — no tables yet
- [x] R7.4: No UPDATE/DELETE on append-only tables — no tables yet
- [x] R9: All external deps through adapters — `adapters/` directory scaffolded with README.md enforcing rule; no SDK imports yet
- [x] R10: TemperatureGuard enforces temperature=0 — no LLM calls in Phase 0
- [x] R10.1-R10.6: Files < 300 lines, functions < 50 lines, named exports, WHY comments, no commented-out code, no `console.log` — enforced by ESLint + size budgets to be added in T002
- [x] R10.6 (CLI exception): `console.log` is forbidden in **production server code** (`packages/agent-core` modules). The CLI tool `apps/cli` (T003) writes user-facing output to stdout via `process.stdout.write` — this is permitted because it is NOT server-side observability. Pino logger remains the sole observability path for `packages/agent-core`. Spec.md §Constraints Inherited carries the canonical version of this distinction.
- [x] R11.2: Every implementation decision traces to a REQ-ID — Phase 0 cites F-IDs from PRD §3 + spec AC-NN
- [x] R20: No shared contract modified in Phase 0 — `impact.md` not required
- [x] R23: Kill criteria — T001-T005 are each < 2 hrs and touch no shared contract; default block in tasks.md applies if any task expands

All checks pass → plan eligible for `validated → approved`.

---

## Project Structure

### Documentation (this feature)

```text
docs/specs/mvp/phases/phase-0-setup/
├── README.md              # phase summary + exit criteria (already exists)
├── spec.md                # /speckit.specify output (this session)
├── plan.md                # this file
├── tasks.md               # /speckit.tasks output (this session)
├── checklists/
│   └── requirements.md    # spec quality checklist
└── phase-0-current.md     # rollup created at phase exit by user (R19)
```

No `research.md` needed — zero NEEDS CLARIFICATION markers in the spec.
No `data-model.md` — no Zod schemas in Phase 0.
No `quickstart.md` — README.md serves as developer onboarding.
No `contracts/` — no interfaces defined in Phase 0.
No `impact.md` — no shared contracts touched (R20 threshold not crossed).

### Source Code (per architecture.md §6.5 — no deviation)

Phase 0 creates exactly these files / directories:

```text
neural-nba/                                    # repo root (already exists; populated by Phase 0)
├── package.json                               # root workspace; pnpm + Turborepo + cro:audit script
├── pnpm-workspace.yaml                        # declares packages/*, apps/*
├── turbo.json                                 # build/lint/typecheck/test pipelines
├── tsconfig.json                              # shared strict TS config
├── .gitignore                                 # node_modules, .env, dist, .turbo, *.log
├── .env.example                               # all required keys documented
├── docker-compose.yml                         # postgres:16 + pgvector
├── README.md                                  # developer onboarding (created/updated)
│
├── packages/
│   └── agent-core/
│       ├── package.json                       # @neural/agent-core
│       ├── tsconfig.json                      # extends root
│       ├── vitest.config.ts                   # unit test config
│       ├── src/
│       │   ├── index.ts                       # named-export barrel (empty in Phase 0)
│       │   ├── adapters/
│       │   │   └── README.md                  # R9 boundary enforcement note
│       │   └── observability/
│       │       ├── logger.ts                  # Pino logger factory (skeleton)
│       │       └── index.ts                   # re-exports
│       └── tests/
│           └── unit/.gitkeep                  # placeholder
│
├── apps/
│   └── cli/
│       ├── package.json                       # @neural/cli, bin: cro-audit
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                       # entry; --version handler
│       │   └── commands/.gitkeep              # placeholder for Phase 5+ commands
│       └── tests/.gitkeep
│
└── tests/
    └── acceptance/
        └── phase-0-setup.spec.ts              # acceptance test for AC-01..AC-05
```

**Files this feature creates / modifies:**

| File path | Layer | Purpose | New or existing? |
|---|---|---|---|
| `package.json` (root) | repo root | workspace + scripts | new |
| `pnpm-workspace.yaml` | repo root | workspace declarations | new |
| `turbo.json` | repo root | pipeline config | new |
| `tsconfig.json` (root) | repo root | shared TS config | new |
| `.gitignore` | repo root | ignored paths | new |
| `.env.example` | repo root | secrets contract | new |
| `docker-compose.yml` | repo root | local Postgres+pgvector | new |
| `packages/agent-core/package.json` | package | agent-core manifest | new |
| `packages/agent-core/tsconfig.json` | package | TS config | new |
| `packages/agent-core/vitest.config.ts` | package | test config | new |
| `packages/agent-core/src/index.ts` | source | barrel export | new |
| `packages/agent-core/src/adapters/README.md` | source | R9 boundary marker | new |
| `packages/agent-core/src/observability/logger.ts` | source | Pino logger factory skeleton | new |
| `packages/agent-core/src/observability/index.ts` | source | re-exports | new |
| `apps/cli/package.json` | app | CLI manifest, bin entry | new |
| `apps/cli/tsconfig.json` | app | TS config | new |
| `apps/cli/src/index.ts` | source | CLI entry + --version handler | new |
| `scripts/db-migrate-stub.mjs` | repo root utility | Phase 0 stub script: connects to Postgres via `DATABASE_URL`, runs `CREATE EXTENSION IF NOT EXISTS vector`, prints "OK pgvector vN.N.N". Exempt from R9 per spec.md §Assumptions (infrastructure tooling). | new |
| `tests/acceptance/phase-0-setup.spec.ts` | test | Phase 0 acceptance test (Playwright Test) | new |

**Structure Decision:** All paths fit architecture.md §6.5. No new top-level directory. No §6.5 amendment needed.

---

## Phase 0 — Research

**No research needed.** Zero NEEDS CLARIFICATION markers in the spec. All tech stack values pinned by architecture.md §6.4.

The one ambiguity (`pnpm db:migrate` in README vs T001-T005 not including Drizzle) is resolved in spec.md Assumptions: Phase 0 ships a stub script that connects + verifies pgvector; actual schema migrations land in Phase 4.

---

## Phase 1 — Design

Phase 0 design is config + skeleton, not domain modeling. The minimal design decisions:

1. **Pino logger factory** in `packages/agent-core/src/observability/logger.ts`:
   - Exports `createLogger(name: string): Logger` — returns Pino instance with default correlation fields (audit_run_id, page_url, node_name, heuristic_id, trace_id) ready for child loggers.
   - JSON output by default; pretty-print only when `NODE_ENV=development`.
   - File size: < 50 lines (R10.2). Named exports only (R10.3).
   - Test: `tests/unit/observability/logger.test.ts` lands in Phase 1+ alongside the first node that uses it; for Phase 0, just verify import doesn't throw.

2. **CLI version handler** in `apps/cli/src/index.ts`:
   - Reads version from `apps/cli/package.json` at compile time (TypeScript JSON import or build-time inject).
   - On `--version` flag: writes version + newline to `process.stdout.write`, exit code 0.
   - On any other flag in Phase 0: writes "Subcommands not yet implemented (Phase 5+)" to `process.stderr`, exit code 0 (not an error — just informative).
   - File size: < 50 lines.
   - The CLI's user-facing stdout output is permitted (R10.6 forbids server-side `console.log`, not CLI tool stdout — see spec.md "Constraints Inherited" note).

3. **Adapter README.md** in `packages/agent-core/src/adapters/`:
   - One-paragraph note: "All external dependency imports (Anthropic SDK, Playwright, pg/Drizzle, Cloudflare R2 client, Clerk SDK, Resend, BullMQ, MCP SDK) MUST be wrapped in adapters here per Constitution R9. Direct imports outside this folder are forbidden by R13."
   - This is a *living comment* — not enforced by code in Phase 0; ESLint rule lands in Phase 4 when first adapter implementation appears.

4. **Docker Compose service**:
   - One service: `postgres` running `pgvector/pgvector:pg16` (community image; bundles Postgres 16 + pgvector preinstalled).
   - Healthcheck: `pg_isready -U postgres -d postgres` every 5s.
   - Named volume `neural_postgres_data`.
   - Port `5432:5432` exposed locally.
   - No production deployment in Phase 0.

5. **Stub `pnpm db:migrate` script** at root:
   - Defined in root `package.json` scripts.
   - Executes a tiny Node script: connects to Postgres via `DATABASE_URL`, runs `CREATE EXTENSION IF NOT EXISTS vector`, prints "OK" + extension version.
   - No Drizzle invocation yet (Drizzle not in Phase 0 deps; lands in Phase 4).

**Output:** No `data-model.md` / `contracts/` / `quickstart.md` files for Phase 0. Design is captured inline above.

---

## Complexity Tracking

**None — plan respects all 26 Constitution rules** (R1-R23 universal + R24-R26 layer-specific MUST-NOTs; R24-R26 are trivially N/A in Phase 0 since perception, context capture, and state exploration layers don't exist yet).

No violations to justify. No `why:` provenance overrides needed.

---

## Approval Gates

| Gate | Approver | Evidence |
|---|---|---|
| Spec → Plan transition | spec author + product owner | spec.md `status: approved` |
| Tech stack adherence | engineering lead | All §6.4 fields match canonical (table above) |
| Constitution check | engineering lead | All checkboxes ticked above |
| Impact analysis (if applicable) | engineering lead | N/A — no shared contract touched |
| Plan → Tasks transition | engineering lead | This plan `status: approved` |

After all gates pass, run `/speckit.tasks` to decompose into `tasks.md`.

---

## Cross-references

- spec.md (this folder)
- `docs/specs/mvp/architecture.md` §6.4 + §6.5
- `docs/specs/mvp/constitution.md` R9, R10, R11, R17-R20, R22-R23
- `docs/specs/mvp/tasks-v2.md` T001-T005
