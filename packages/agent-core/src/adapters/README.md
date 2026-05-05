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

## Phase 0 status

This directory is the boundary — no concrete adapters yet. First adapter (LLMAdapter via T073) lands in Phase 4.
