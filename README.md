# Neural — AI CRO Audit Platform

> Conversion-rate optimization audit platform for REO Digital. Walks a real D2C product page; runs Claude through a deep-perceive → evaluate → self-critique → ground → annotate pipeline; emits grounded, consultant-reviewable findings + a branded PDF.

**Status:** Phase 0 (workspace + scaffolding) implemented; Phase 1+ (browser perception, MCP tools, analysis, orchestration, delivery) in progress per the [walking-skeleton roadmap](docs/specs/mvp/implementation-roadmap.md).

---

## Prerequisites

| Tool | Version | How to install |
|---|---|---|
| Node.js | **22 LTS** (CI-pinned via `.nvmrc` + `engines.node`) | [nodejs.org](https://nodejs.org) or `nvm install 22 && nvm use` |
| pnpm | **10.33.3** (pinned via `packageManager`) | `corepack enable && corepack prepare pnpm@10.33.3 --activate` (preferred) or `npm install -g pnpm@10.33.3` |
| Docker | **24.x+** with Compose v2.17+ (for `--wait`) | [docker.com/get-started](https://www.docker.com/get-started) |
| Git | any recent | OS package manager |
| **Windows only** | Microsoft Visual C++ Redistributable (UCRT API sets) | `winget install Microsoft.VCRedist.2015+.x64` — required for `turbo.exe` and Playwright Chromium |

> **Why VCRedist on Windows:** Turborepo and Playwright ship native Windows binaries that depend on the Universal C Runtime (UCRT) API set forwarders (`api-ms-win-crt-*.dll`). On clean Windows installs these are not present until you install the C++ redistributable. Symptom if missing: `error while loading shared libraries: api-ms-win-crt-string-l1-1-0.dll`.

---

## Quickstart (target: green local dev in <30 minutes)

```bash
git clone https://github.com/SabarigirisanSivakumarREO/NAA-MVP.git neural-nba
cd neural-nba

# 1. Install workspace dependencies
pnpm install

# 2. Bring up local services (Postgres 16 + pgvector, Valkey 8, Mailpit)
docker compose up -d --wait

# 3. Copy env template + fill in secrets you need (ANTHROPIC_API_KEY for Phase 4+)
cp .env.example .env
# edit .env

# 4. Apply database setup (Phase 0: just CREATE EXTENSION vector)
pnpm db:migrate
# Expected: "OK pgvector v0.8.2"

# 5. Smoke-test the CLI
pnpm cro:audit --version
# Expected: "0.1.0"
```

If all five commands succeed, you're at Phase 0 green. Phase 1+ subcommands (the actual audit) land per the [implementation roadmap](docs/specs/mvp/implementation-roadmap.md).

---

## Common commands

```bash
# Build everything
pnpm build

# Per-workspace build / test / typecheck
pnpm -F @neural/agent-core build
pnpm -F @neural/agent-core test
pnpm -F @neural/cli build

# Workspace-wide
pnpm typecheck                     # tsc --noEmit across all packages
pnpm test                          # Vitest unit tests across packages
pnpm test:integration              # Playwright Test acceptance suite
                                   # (currently: tests/acceptance/phase-0-setup.spec.ts)

# CLI
pnpm cro:audit --version           # prints version
# pnpm cro:audit --url=<URL>       # full audit — lands Week 1 walking skeleton

# DB
pnpm db:migrate                    # runs scripts/db-migrate-stub.mjs
                                   # (Phase 0: CREATE EXTENSION vector;
                                   #  Phase 4: real Drizzle migrations)
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `error while loading shared libraries: api-ms-win-crt-*.dll` | Windows: UCRT API sets missing | `winget install Microsoft.VCRedist.2015+.x64` (admin) |
| `pnpm db:migrate` → `ERROR: POSTGRES_URL not set` | `.env` not created | `cp .env.example .env` |
| `pnpm db:migrate` → `ECONNREFUSED 127.0.0.1:5432` | Postgres container not running | `docker compose up -d --wait postgres` |
| `pnpm cro:audit --version` → unknown command | dependencies not installed | `pnpm install` |
| `pnpm install` → `Unsupported engine` warning | Local Node ≠ 22 (e.g. 24) | Warning only — CI uses Node 22; local Node ≥22 works fine |
| Docker compose `--wait` flag not recognized | Docker Compose <v2.17 | Upgrade Docker Desktop or use `docker compose up -d` then poll healthcheck |

---

## Project structure (high level)

```
neural-nba/
├── apps/
│   └── cli/                  # @neural/cli — cro-audit entry point
├── packages/
│   └── agent-core/           # @neural/agent-core — shared library
│       └── src/
│           ├── adapters/     # R9 boundary — all external SDKs wrapped here
│           └── observability/ # Pino logger factory
├── scripts/                  # dev/build tooling (R9-exempt per spec.md §Assumptions)
│   └── db-migrate-stub.mjs   # Phase 0 CREATE EXTENSION; Phase 4 → Drizzle
├── tests/
│   └── acceptance/           # Playwright Test repo-level acceptance suite
├── docs/
│   └── specs/mvp/            # Phase folders, PRD, constitution, roadmap
├── docker-compose.yml        # Postgres 16/pgvector + Valkey 8 + Mailpit
└── ...
```

Full structure: [`docs/specs/mvp/architecture.md`](docs/specs/mvp/architecture.md) §6.5.

---

## Documentation

- [`docs/specs/mvp/README.md`](docs/specs/mvp/README.md) — entry point + reading order for the MVP corpus
- [`docs/specs/mvp/PRD.md`](docs/specs/mvp/PRD.md) — canonical product requirements (F-001..F-021 + NF-001..NF-010)
- [`docs/specs/mvp/constitution.md`](docs/specs/mvp/constitution.md) — 26 non-negotiable engineering rules (R1-R26)
- [`docs/specs/mvp/phases/INDEX.md`](docs/specs/mvp/phases/INDEX.md) — phase decision table (15 phases)
- [`docs/specs/mvp/implementation-roadmap.md`](docs/specs/mvp/implementation-roadmap.md) — 12-week walking-skeleton plan
- [`docs/specs/mvp/architecture.md`](docs/specs/mvp/architecture.md) — five-layer stack, tech stack, file structure
- [`docs/specs/mvp/sessions/session-handover.md`](docs/specs/mvp/sessions/session-handover.md) — rolling session state

---

## Contributing

See [`CLAUDE.md`](CLAUDE.md) for canonical project guidance — reading order, code style, git workflow, three-tier operational boundaries, sub-agent dispatch policy. Constitution rules (R1-R26) override default behavior; user instructions override constitution.

---

*This README is maintained as part of the Phase 0 setup (T-PHASE0-DOC). Updates land via `feat(setup): T-PHASE0-DOC ...` commits per CLAUDE.md §6 git workflow.*
