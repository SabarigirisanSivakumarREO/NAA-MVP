# Neural — AI CRO Audit Platform

> Conversion-rate optimization audit platform for REO Digital. Walks a real D2C product page; runs Claude through a deep-perceive → evaluate → self-critique → ground → annotate pipeline; emits grounded, consultant-reviewable findings + a branded PDF.

**Status:** Phase 0 (workspace + scaffolding), Phase 1 (browser perception foundation), Phase 2 (29-tool MCP surface), and Phase 3 (verification & confidence — thin) implemented; Phase 4+ (safety + infra + cost, browse, analysis pipeline, orchestration, delivery) in progress per the [walking-skeleton roadmap](docs/specs/mvp/implementation-roadmap.md).

Phase 1 ships the `contextAssembler.capture(url)` API in `@neural/agent-core` — opens a Playwright Chromium session, captures an accessibility tree, filters to a compact `PageStateModel` (under 20,000 tokens — NF-Phase1-01 v0.4), monitors DOM mutations, and produces a JPEG screenshot. Phase 1 acceptance is green for example.com, amazon.in, and a Peregrine PDP fixture (5/5 integration tests pass; full 3-site capture in ~9.5 s wall-clock).

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

# 6. Validate Phase 1 perception (3-site integration suite, < 60s wall-clock)
pnpm -F @neural/agent-core test integration/phase1
# Expected: 5 passed (example.com, amazon.in, peregrine — all under 20,000 tokens)

# 7. Validate Phase 2 MCP tool surface (29 tools through in-process server, < 5 min wall-clock)
pnpm -F @neural/agent-core test integration/phase2
# Expected: 11 passed (29 MCP tools registered; namespace contract green;
#           page_analyze._extensions === undefined per Phase 1c §11)

# 8. Validate Phase 3 verification layer (10 synthetic ActionContracts end-to-end, < 30s wall-clock)
pnpm -F @neural/agent-core test integration/phase3
# Expected: 9 passed (3 success + 3 verify_failed + 2 rate_limited + 2 safety_blocked;
#           ConfidenceScorer multiplicative decay verified — R4.4)
```

If all eight commands succeed, you're at Phase 3 green. The `pnpm cro:audit --url=<URL>` end-to-end CLI wires up in Phase 5+ (Browse MVP) per the [implementation roadmap](docs/specs/mvp/implementation-roadmap.md); today the CLI exposes `--version` only, with the walking-skeleton fixture stubbed behind it.

### Phase 1 perception API

Within the monorepo (consumers in `packages/*` and `apps/*`), import `contextAssembler` from the perception module to capture a `PageStateModel` from any public URL. The public sub-path export will be promoted in Phase 2 once MCP tools land — for now, workspace consumers use the source path (mirroring `packages/agent-core/tests/integration/phase1.test.ts`):

```ts
import { contextAssembler } from '@neural/agent-core/dist/perception/index.js';
import type { PageStateModel } from '@neural/agent-core/perception/types';

const model: PageStateModel = await contextAssembler.capture('https://example.com');

console.log(model.metadata.title);                       // page <title>
console.log(model.accessibilityTree.totalNodes);         // > 50 typical
console.log(model.filteredDOM.top30.length);             // ≤ 30 high-relevance nodes
console.log(model.diagnostics.tokenCount);               // < 20,000 (NF-Phase1-01 v0.4)
```

`contextAssembler` owns the full session lifecycle (open → navigate → extract → close) and never throws on token-budget overruns — the deterministic shrink ladder degrades gracefully and surfaces `diagnostics.errors`. See [`docs/specs/mvp/phases/phase-1-perception/spec.md`](docs/specs/mvp/phases/phase-1-perception/spec.md) for the full contract.

### Phase 2 MCP tools

Phase 2 ships a 29-tool MCP surface (22 `browser_*` + 2 `agent_*` + 5 `page_*`) via the `@modelcontextprotocol/sdk` adapter. Tool factories register at boot through `InMemoryToolRegistry`; `MCPServerAdapter` wires them into the SDK's `tools/list` / `tools/call` flows with Zod-derived JSON schemas + safety classifications. `page_analyze` (T048) is the v2.3 AnalyzePerception producer Phase 7's DeepPerceiveNode will consume; its `_extensions` field stays `undefined` per the Phase 1c §11 namespace contract.

Workspace consumers wire a server like this (mirrors `packages/agent-core/tests/integration/phase2.test.ts`):

```ts
import { BrowserManager } from '@neural/agent-core/dist/browser-runtime/BrowserManager.js';
import {
  InMemoryToolRegistry,
  MCPServerAdapter,
} from '@neural/agent-core/dist/mcp/index.js';
import { createNavigateTool } from '@neural/agent-core/dist/mcp/tools/navigate.js';
import { createPageAnalyzeTool } from '@neural/agent-core/dist/mcp/tools/pageAnalyze.js';
// ... 27 more tool factories (browser_* / agent_* / page_*) ...

const session = await new BrowserManager().newSession({ headless: true });

const registry = new InMemoryToolRegistry();
registry.register(createNavigateTool({ session }));
registry.register(createPageAnalyzeTool({ session }));
// ... register the remaining 27 (3 of which take no deps: agent_complete,
//     agent_request_human, page_annotate_screenshot) ...

const server = new MCPServerAdapter(registry, logger);
await server.start();
```

Full tool catalog + per-tool acceptance criteria: [`docs/specs/mvp/phases/phase-2-tools/spec.md`](docs/specs/mvp/phases/phase-2-tools/spec.md) AC-04 through AC-13.

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
pnpm -F @neural/agent-core test integration/phase1   # Phase 1: perception (5 tests, ~10s)
pnpm -F @neural/agent-core test integration/phase2   # Phase 2: 29-tool MCP surface (11 tests, < 5 min)
pnpm -F @neural/agent-core test integration/phase3   # Phase 3: verification & confidence (9 tests, < 30s; R4.4 multiplicative decay)

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
│           ├── adapters/         # R9 boundary — external SDKs wrapped here (BrowserEngine, ...)
│           ├── analysis/         # Phase 2: AnalyzePerception v2.3 schema + Phase 7 node stubs
│           │                     # (DeepPerceive / Evaluate / SelfCritique / Annotate / Store)
│           ├── browser-runtime/  # Phase 1+1b+2: BrowserManager + Mouse/Typing/Scroll + RateLimiter
│           ├── mcp/              # Phase 2: 29-tool MCP surface (browser_* / agent_* / page_*)
│           │                     # ToolRegistry + Server + per-tool factories under tools/
│           ├── observability/    # Pino logger factory
│           └── perception/       # Phase 1+1c: ContextAssembler + extractors + extensions/ pipeline
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
