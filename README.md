# Neural — AI CRO Audit Platform

> Conversion-rate optimization audit platform for REO Digital. Walks a real D2C product page; runs Claude through a deep-perceive → evaluate → self-critique → ground → annotate pipeline; emits grounded, consultant-reviewable findings + a branded PDF.

**Status:** Phase 0 (workspace + scaffolding), Phase 1 (browser perception foundation), Phase 2 (29-tool MCP surface), Phase 3 (verification & confidence — thin), Phase 4 (safety + infra + cost — 15-table Postgres schema + RLS + LLM/Storage/Screenshot adapters + observability), and **Phase 5 (Browse MVP — LangGraph `BrowseSubGraph` end-to-end with `completion_reason` terminal classification)** implementation complete; Phase 6+ (analysis pipeline, full orchestration, delivery) ahead per the [walking-skeleton roadmap](docs/specs/mvp/implementation-roadmap.md).

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

# 3. Copy env template + fill in secrets (see "Environment variables" below)
cp .env.example .env
# edit .env — REQUIRED for Phase 4: ANTHROPIC_API_KEY, DATABASE_URL (or POSTGRES_URL)

# 4. Apply database setup — Phase 4 runs the real Drizzle migrations
#    (Phase 0 stub replaced by scripts/db-migrate.mjs; idempotent).
pnpm db:migrate
# Expected: "OK pgvector v0.8.2" + "Applied 3 migrations" (0001 initial schema,
#           0002 master extensions, 0003 force RLS).

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

### Phase 4 — safety, infra, cost (T070 schema + T073 LLMAdapter + T074/T075 storage)

Phase 4 ships the data spine and external-SDK adapters that Phase 5+ pipelines depend on. After `pnpm db:migrate` lands the 15-table schema + RLS + append-only triggers, the AC-15 acceptance gate exercises every Phase 4 surface end-to-end (1 audit_log row + 3 audit_events + 3 llm_call_log outcomes + 1 screenshot + 15-table queryable check) in under 2 minutes:

```bash
pnpm -F @neural/agent-core test integration/phase4
# Expected: 1 passed (AC-15 acceptance gate)
```

Required env for Phase 4 tests: `DATABASE_URL` (or `POSTGRES_URL`); `ANTHROPIC_API_KEY` (mocked in conformance tests — set any non-empty string to satisfy the loader; live calls hit the mock adapter via the `transport:` seam).

Optional env for Phase 4: `SCREENSHOTS_DIR` (defaults to `./screenshots`); `AUDIT_BUDGET_USD` / `PAGE_BUDGET_USD` (defaults 15 / 5 USD per R8.1 BudgetGate).

Architecture cross-references:
- [`docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md`](docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md) — AC-01..AC-17
- [`packages/agent-core/src/adapters/README.md`](packages/agent-core/src/adapters/README.md) — adapter catalog (R9 boundary)

### Phase 5 — Browse MVP (LangGraph `BrowseSubGraph` end-to-end)

Phase 5 wires the first end-to-end orchestration surface: a compiled LangGraph `BrowseSubGraph` (audit_setup → page_router → browse → audit_complete) that drives a list of URLs through the Phase 1-4 stack and emits a terminal `completion_reason` per page. No analysis, findings, or PDF yet — those land in Phase 7-9.

The browse-mode quickstart command (Phase 5 target surface):

```bash
# 1-URL smoke (single-line --url= form; Phase 0b walking-skeleton path)
pnpm cro:audit --url=https://example.com

# Multi-URL browse-mode (Phase 5 target surface — wires through Phase 9 T-PHASE9-CLI)
pnpm cro:audit --urls ./urls.txt --business-type ecommerce
```

Where `urls.txt` is one URL per line. The Phase 5 browse loop:
1. **audit_setup** — creates one `audit_runs` row + initial `audit_events` (REQ-BROWSE-NODE-001)
2. **page_router** — iterates the URL list; per URL, enters `browse` subgraph
3. **browse** — captures `PageStateModel` via Phase 1 `contextAssembler`; LLM-decides next action through the Phase 2 29-tool MCP surface; loops until perception is stable or budget exhausts
4. **audit_complete** — writes terminal `completion_reason` ∈ `{success, budget_exhausted, max_iterations, error}` + final `audit_events` (REQ-BROWSE-NODE-003)

Output at Phase 5: one `audit_runs` row + per-page `page_browse_*` events + LLM-call log entries — all queryable from Postgres. There is no `findings.json` / report PDF yet (Phase 7 = `AnalyzeSubGraph`; Phase 9 = delivery).

**MVP limitations (documented for honesty):**
- Real Playwright is *not* exercised in the Phase 5 conformance/integration tests — mock browser + mock LLM cover the LangGraph wiring; live Playwright runs land alongside Phase 8 acceptance.
- `DATABASE_URL` provisioning is still ad-hoc per shell — automation (vitest `globalSetup` centralization) is tracked under `T-PHASE5-TESTINFRA-DEADLOCK` (Wave 8 polish).
- CLI flag parsing for `--urls` + `--business-type` is documented as the Phase 5 *target* surface; full wiring lands in Phase 9 `T-PHASE9-CLI`. The Phase 0b walking-skeleton `--url=<URL>` path is the supported invocation today.

Acceptance gate:

```bash
pnpm -F @neural/agent-core test integration/phase5
# Expected: AC-01..AC-18 green (18 ACs); BrowseGraph compiles + invokes end-to-end
#           on mock fixtures in < 60s wall-clock per AC-10.
```

Required env for Phase 5: same as Phase 4 (`DATABASE_URL`, `ANTHROPIC_API_KEY`); no new variables introduced.

Architecture cross-references:
- [`docs/specs/mvp/phases/phase-5-browse-mvp/spec.md`](docs/specs/mvp/phases/phase-5-browse-mvp/spec.md) — AC-01..AC-18 + REQ-BROWSE-* contracts
- [`docs/specs/mvp/phases/phase-5-browse-mvp/plan.md`](docs/specs/mvp/phases/phase-5-browse-mvp/plan.md) — `BrowseSubGraph` node layout + budget threading

---

## Environment variables (Phase 4+)

| Variable | Required? | Default | Used by |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **Required** for Phase 4+ | — | `AnthropicAdapter` (T073) — Claude Sonnet 4 calls |
| `DATABASE_URL` | **Required** for Phase 4+ | — | `db/client.ts` — Postgres connection (canonical) |
| `POSTGRES_URL` | Fallback | — | Honored when `DATABASE_URL` is unset (Phase 0 compat) |
| `SCREENSHOTS_DIR` | Optional | `./screenshots` | `LocalDiskStorage` (T075) — screenshot bytes path |
| `STORAGE_MODE` | Optional | `local_disk` | `ScreenshotStorage` adapter selector (T075) |
| `AUDIT_BUDGET_USD` | Optional | `15` | `BudgetGate` (R8.1) — hard cap per audit |
| `PAGE_BUDGET_USD` | Optional | `5` | `BudgetGate` (R8.1) — hard cap per page |
| `NODE_ENV` / `LOG_LEVEL` | Optional | `development` / `info` | Pino logger + adapter selectors |

Full `.env.example` template covers Cloudflare R2, Resend, Clerk, Upstash for Week 11+ prod swap.

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
pnpm -F @neural/agent-core test integration/phase4   # Phase 4: 15-table DB + adapters (AC-15 gate, < 2 min)

# CLI
pnpm cro:audit --version           # prints version
# pnpm cro:audit --url=<URL>       # full audit — lands Week 1 walking skeleton

# DB
pnpm db:migrate                    # runs scripts/db-migrate.mjs
                                   # Phase 4: applies 0001_initial.sql (15 tables) +
                                   # 0002_master_extensions.sql (master-spec ALTERs) +
                                   # 0003_force_rls.sql (FORCE ROW LEVEL SECURITY).
                                   # Idempotent — safe to re-run.
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `error while loading shared libraries: api-ms-win-crt-*.dll` | Windows: UCRT API sets missing | `winget install Microsoft.VCRedist.2015+.x64` (admin) |
| `pnpm db:migrate` → `DB connection unset` | `.env` not created or `DATABASE_URL`/`POSTGRES_URL` blank | `cp .env.example .env` then edit |
| `pnpm db:migrate` → `ECONNREFUSED 127.0.0.1:5432` | Postgres container not running | `docker compose up -d --wait postgres` |
| Phase 4 conformance tests → `DATABASE_URL must be set` | Env not exported into the vitest process | `pnpm -F @neural/agent-core test integration/phase4` (script loads `.env`); or export `DATABASE_URL` in the shell |
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
│           ├── adapters/         # R9 boundary — external SDKs wrapped here.
│           │                     # Phase 1: BrowserEngine. Phase 4: AnthropicAdapter
│           │                     # (T073) + PostgresStorage (T074) + LocalDiskStorage
│           │                     # (T075) + TemperatureGuard + BudgetGate. See
│           │                     # adapters/README.md for the catalog.
│           ├── analysis/         # Phase 2: AnalyzePerception v2.3 schema + Phase 7 node stubs
│           │                     # (DeepPerceive / Evaluate / SelfCritique / Annotate / Store)
│           ├── browser-runtime/  # Phase 1+1b+2: BrowserManager + Mouse/Typing/Scroll + RateLimiter
│           ├── db/               # Phase 4: Drizzle schema (15 tables) + SQL migrations +
│           │                     # connection client.
│           ├── mcp/              # Phase 2: 29-tool MCP surface (browser_* / agent_* / page_*)
│           │                     # ToolRegistry + Server + per-tool factories under tools/
│           ├── observability/    # Phase 0+4: Pino logger factory + AuditLogger (T071) +
│           │                     # SessionRecorder (T072) + StreamEmitter (T076).
│           ├── perception/       # Phase 1+1c: ContextAssembler + extractors + extensions/ pipeline
│           ├── safety/           # Phase 4: ActionClassifier (T066) + SafetyCheck (T067) +
│           │                     # DomainPolicy (T068) + CircuitBreaker (T069) +
│           │                     # RobotsChecker (T080a).
│           └── types/            # Phase 4: AuditEvent + LLMCallRecord Zod schemas (T-PHASE4-TYPES)
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
