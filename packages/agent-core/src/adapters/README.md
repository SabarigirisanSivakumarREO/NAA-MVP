# adapters/ — R9 Boundary

All external dependency imports MUST be wrapped in an adapter under this directory. This includes (but is not limited to):

- `@anthropic-ai/sdk` (LLMAdapter — Phase 4 T073)
- `playwright` / `playwright-core` (BrowserEngine — Phase 1 T006)
- `pg`, `drizzle-orm`, `postgres` (StorageAdapter / DB clients — Phase 4 T070)
- `@aws-sdk/client-s3` or Cloudflare R2 client (ScreenshotStorage — Phase 4 T076)
- `@clerk/nextjs` / `@clerk/backend` (AuthProvider — Phase 9)
- `resend`, `nodemailer` (NotificationAdapter — Phase 9 T260)
- `bullmq` (QueueAdapter — Phase 4)
- `@modelcontextprotocol/sdk` (MCP server — Phase 2 T019)
- `sharp` (image annotation — Phase 7 T131)
- `ioredis` / Upstash client (RedisAdapter — Phase 4)

**Direct imports of these packages from anywhere outside `adapters/` are forbidden by Constitution R13.** ESLint rule lands in Phase 4 alongside the first concrete adapter (LLMAdapter via T073). Until then this README is the living comment.

## Why this rule exists (R9 — Loose Coupling)

Provenance: `docs/specs/mvp/constitution.md` R9 + R13.

Every external service Neural touches has at least one of: an SLA we can't control, a vendor lock-in cost, a credential we must redact (R6), or a failure mode (timeouts, rate limits, malformed responses) we MUST normalize before it hits domain logic. The adapter layer:

1. Centralizes credential handling — single place to enforce `process.env.*` only.
2. Enforces R6 redaction at the boundary (heuristic body NEVER serialized to LLM prompt logs, dashboard JSON, etc).
3. Lets us swap implementations (LocalDisk ↔ R2, Mailpit ↔ Resend, Anthropic ↔ a future fallback) without touching domain code.
4. Gives us one place to apply circuit-breakers, retries, and budget gates (R8 + R14.1).
5. Makes the test suite tractable — every adapter has a stub that conforms to the same Zod-validated interface.

## Adapter pattern (canonical)

```
src/adapters/
├── README.md              ← you are here
├── llm/
│   ├── LLMAdapter.ts      ← interface (Zod-validated invoke / stream / count_tokens)
│   ├── AnthropicAdapter.ts
│   └── StubLLMAdapter.ts
├── browser/
│   ├── BrowserEngine.ts
│   ├── PlaywrightEngine.ts
│   └── StubBrowserEngine.ts
├── storage/
│   ├── ScreenshotStorage.ts
│   ├── R2ScreenshotStorage.ts
│   └── LocalDiskScreenshotStorage.ts
└── ...
```

Each adapter file:

- Exports a Zod schema describing inputs + outputs (R2.2).
- Wraps the SDK in a typed function that returns the schema-conformant shape.
- Logs to Pino with correlation fields (`audit_run_id`, `node_name`, `trace_id`) — never the raw heuristic body or full prompt content (R6).
- Surfaces errors as typed unions, not raw SDK errors.

## Concrete R9 adapters

Append to this section as each phase ships its first adapter implementor. Order is chronological by phase landing order so the table doubles as a build log.

### Phase 1 — `BrowserEngine` (FIRST CONCRETE R9 ADAPTER)

- **Interface:** [`BrowserEngine.ts`](./BrowserEngine.ts) — Phase 1 R9 boundary for `playwright`. Defines `BrowserEngine.newSession(opts)` plus the Phase-1-minimal `BrowserPage` / `BrowserContext` / `BrowserSession` wrapper types.
- **Impl:** [`../browser-runtime/BrowserManager.ts`](../browser-runtime/BrowserManager.ts) — single concrete implementor; the only file in the repo permitted to `import { chromium } from 'playwright'`.
- **Surface (Phase-1-minimal):** `BrowserPage` exposes `goto`, `ariaSnapshot`, `screenshot`, `addInitScript`, `evaluate`, `waitForLoadState`, `setViewportSize`, `setContent`. `BrowserContext` exposes `addInitScript` + `pages()` (the latter so `StealthConfig` can patch the existing about:blank page that `addInitScript` cannot retroactively reach).
- **Provenance:** `phase-1-perception/spec.md` AC-01 + R-01; `phase-1-perception/impact.md` §"BrowserEngine (NEW)" (lines 87-114, exact interface canon); `phase-1-perception/tasks.md` T006.
- **Forward contract:** Phase 2 (MCP tools) and Phase 4 (verification engine) compose against this seam. Adding methods is non-breaking forward-compat; renaming/removing requires an `impact.md` update (R20).

### Phase 4 — `LLMAdapter` / `AnthropicAdapter` / `TemperatureGuard` / `BudgetGate` (T073)

- **Interface:** [`LLMAdapter.ts`](./LLMAdapter.ts) — typed `complete({ operation, audit_run_id, ... })` + `estimateCost(...)`. The `operation` discriminator (`classify` / `evaluate` / `critique` / `vision`) drives temperature locking and model routing.
- **Impl:** [`AnthropicAdapter.ts`](./AnthropicAdapter.ts) — the only file in the repo permitted to `import Anthropic from '@anthropic-ai/sdk'`. Wraps Sonnet 4 with: pinned-model contract (R10.3), `TemperatureGuard` (T=0 forced on `evaluate` / `critique` per R10), `BudgetGate` pre-call check (R8.1 — per-audit hard cap), retry-with-backoff on 5xx (1 + 3 retries → `outcome='unavailable'`), and atomic `llm_call_log` write before return (R14.1).
- **Co-located helpers:** [`TemperatureGuard.ts`](./TemperatureGuard.ts) — pure validation function (`asserts temperature is 0` for locked operations). [`BudgetGate.ts`](./BudgetGate.ts) — SELECT ... FOR UPDATE the parent `audit_runs.budget_remaining_usd` then throw `LLMBudgetExceededError` if the estimated call cost would overrun.
- **Provenance:** `phase-4-safety-infra-cost/spec.md` AC-08 / AC-09 / AC-10 / AC-11; `tasks.md` T073 (REQ-LLM-ADAPTER-001 + REQ-LLM-COST-LOG-001 + R14.1).
- **Forward contract:** Phase 7 (DeepPerceive / Evaluate / SelfCritique nodes) compose against `LLMAdapter`. A v1.2 fallback adapter (GPT-4o) plugs into the same interface; defer is intentional (MVP is Claude-only).

### Phase 4 — `StorageAdapter` / `PostgresStorage` (T074)

- **Interface:** [`StorageAdapter.ts`](./StorageAdapter.ts) — `withClient(client_id, fn)` (the canonical RLS-scoped transactional seam) + typed `appendLLMCallLog` / `appendAuditEvent` / `appendAuditLog` writers + named query helpers for the 10 client-scoped tables.
- **Impl:** [`PostgresStorage.ts`](./PostgresStorage.ts) — the only file in `src/adapters/` permitted to `import 'pg'` or `'drizzle-orm'` (the parallel exemption: `src/db/**` for the Drizzle schema + migration runner). `withClient` sets `SET LOCAL app.client_id = $1` exactly once per transaction (NEVER per-statement — R7.2) so RLS policies on the 10 client-scoped tables (clients, audit_runs, findings, screenshots, sessions, page_states, state_interactions, finding_rollups, reproducibility_snapshots, audit_requests) isolate cross-tenant reads.
- **Provenance:** `phase-4-safety-infra-cost/spec.md` AC-05 / AC-12 / AC-17; `tasks.md` T070 (schema) + T074 (adapter); REQ-STORAGE-ADAPTER-001 + R7.2 RLS + R7.4 append-only.

### Phase 4 — `ScreenshotStorage` / `LocalDiskStorage` (T075)

- **Interface:** [`ScreenshotStorage.ts`](./ScreenshotStorage.ts) — `put(bytes, { audit_run_id, page_url })` returns `{ storage_key, storage_url }`. Pluggable backend selected by `STORAGE_MODE` env (`local_disk` for dev, `r2` for prod — R2 implementor lands Week 11 prod swap).
- **Impl:** [`LocalDiskStorage.ts`](./LocalDiskStorage.ts) — writes JPEG bytes under `SCREENSHOTS_DIR` (default `./screenshots`), partitioned by `audit_run_id`. Path-traversal-safe (no `..` in derived keys); idempotent on re-put of the same `(audit_run_id, page_url, ts)` tuple.
- **Provenance:** `phase-4-safety-infra-cost/spec.md` AC-13; `tasks.md` T075.

### Phase 2 / 5 / 7 / 9 — pending

MCP server adapter (Phase 2 T019 — already landed as `mcp/MCPServerAdapter.ts`, not under `adapters/` for historical reasons; future R9 migration may consolidate), image annotation (Phase 7 T131), NotificationAdapter (Phase 9 T260) will each land their first concrete implementors and append a section above.

## ESLint enforcement (Phase 4+)

Phase 4 T073 lands the `no-restricted-imports` ESLint rule banning direct imports of `@anthropic-ai/sdk`, `pg`, and `drizzle-orm` outside their designated adapter files. The companion conformance test [`tests/conformance/adapter-boundary.test.ts`](../../tests/conformance/adapter-boundary.test.ts) is the safety net catching anything ESLint misses (dynamic imports, string-based requires). Future external SDKs (R2 client, Resend, BullMQ, Clerk, sharp) extend the rule as they land per the chronological build log above.
