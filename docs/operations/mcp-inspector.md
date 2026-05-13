# MCP Inspector — local-debug setup

> **Audience:** Neural engineers who want to poke at the Phase 2 29-tool surface
> manually before Phase 5 BrowseNode wires real transport.
> **Status:** maintainer guide. Not part of the runtime.

## 1. Overview

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
(`@modelcontextprotocol/inspector`) is the official Anthropic web UI for
inspecting any Model Context Protocol server. It connects over a transport
(stdio / HTTP / SSE), lists every registered tool, and lets you click through
`tools/list` + `tools/call` interactively.

Use it when you want to:

- Sanity-check that all 29 Phase 2 tools register cleanly under `MCPServerAdapter`
- Browse generated JSON schemas (the SDK derives these from each tool's Zod
  `inputSchema` via `zod-to-json-schema`)
- Hit tools with edge-case inputs the AC-13 integration test doesn't cover
- Verify the F-S4 namespace contract on `page_analyze` output by eye
  (`_extensions` must be absent in Phase 2)

`MCPServerAdapter.opts.transport` is optional by design: Phase 2 unit +
integration tests boot the adapter in-process without a transport. The
Inspector is the first consumer that wires a real `StdioServerTransport`.

## 2. Prerequisites

- Local checkout at `feat/phase-2-tools` or later (after merge to master)
- Node 22 LTS + pnpm (already required by the repo)
- Chromium binary: `pnpm exec playwright install chromium` if you've never
  run Phase 1 integration tests
- A free terminal tab for the Inspector web UI

## 3. Setup

### 3a. Inspector install

No global install needed — `npx` is enough:

```bash
npx @modelcontextprotocol/inspector --help
```

If you'd rather pin a version, install per-repo:

```bash
pnpm add -D @modelcontextprotocol/inspector
```

### 3b. Bootstrap script (copy-paste; do NOT commit)

Drop this snippet into a scratch path that's gitignored by default (e.g.
`tmp/inspector-server.ts`). The script reuses the same registry helper that
the AC-13 integration test uses, so the surface stays in lockstep.

```ts
// tmp/inspector-server.ts — NOT committed; copy-paste from docs/operations/mcp-inspector.md
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { BrowserManager } from '@neural/agent-core/browser-runtime/BrowserManager.js';
import { MCPServerAdapter } from '@neural/agent-core/mcp/Server.js';
import { createLogger } from '@neural/agent-core/observability/logger.js';
// Reuse the 29-tool wiring from the integration test helper.
import { buildPhase2Registry } from '@neural/agent-core/../tests/integration/phase2.registry.js';

async function main(): Promise<void> {
  const logger = createLogger('mcp-inspector-host');
  const manager = new BrowserManager();
  const session = await manager.newSession({ headless: true });

  const registry = buildPhase2Registry(session);
  const transport = new StdioServerTransport();
  const adapter = new MCPServerAdapter(registry, logger, { transport });

  await adapter.start();
  logger.info({ tools: registry.list().length }, 'mcp.inspector.ready');

  const shutdown = async (): Promise<void> => {
    await adapter.stop();
    await session.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
```

Notes:

- Paths assume you have the `@neural/agent-core` workspace alias resolved by
  `tsx`. If your scratch dir sits outside the monorepo, swap the imports to
  relative paths into `packages/agent-core/src/...`.
- The `StdioServerTransport` export lives at
  `@modelcontextprotocol/sdk/server/stdio.js` — same SDK that
  `MCPServerAdapter` already depends on (no new dep).
- Headless `true` is intentional: the Inspector runs in a browser, so
  rendering a second Chromium would burn cycles for no gain.

## 4. Running the Inspector

```bash
# Optional sanity boot — verify the script wires cleanly first.
pnpm tsx tmp/inspector-server.ts
# Ctrl-C, then launch via the Inspector so it can own the subprocess + stdio.

npx @modelcontextprotocol/inspector pnpm tsx tmp/inspector-server.ts
```

The Inspector spawns the script as a child process and bridges its stdio.
Open the URL it prints in your browser (default `http://localhost:5173` —
check the Inspector README for current default).

## 5. Sanity-check workflow

1. Open the Inspector URL; it auto-connects to the spawned server
2. Click `tools/list` — confirm **29** entries (22 `browser_*`, 2 `agent_*`,
   5 `page_*`)
3. Pick a `safe`-class tool with empty input (e.g. `agent_complete` with
   `{ "summary": "hi" }` or `page_get_performance` against the current page)
   — confirm a Zod-valid response or a typed error
4. Invoke `browser_navigate` with `{ "url": "https://example.com" }`; the
   headless Chromium loads the page (no visible window, but state advances)
5. Call `page_analyze` — output is large. **Confirm the response does NOT
   contain an `_extensions` field** (F-S4 namespace contract; the key is
   reserved for Phase 7 DeepPerceiveNode)
6. Disconnect / Ctrl-C the Inspector when done; the SIGINT handler in the
   script closes the BrowserSession cleanly

## 6. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Inspector hangs at "Connecting…" | The spawned script failed to boot. Run it standalone first (`pnpm tsx tmp/inspector-server.ts`) and read the Pino output. |
| `Unknown tool: ...` in `tools/call` | Registry didn't initialize. Check that `buildPhase2Registry(session)` returned before `adapter.start()`. |
| `page_analyze` output truncated | MCP transport frame size limit. Try a smaller fixture first (the AC-13 integration tests use synthetic pages for exactly this reason). |
| Browser session fails to launch | Chromium binary missing — `pnpm exec playwright install chromium`. |
| R9 violation lint error | You imported `@modelcontextprotocol/sdk/*` from somewhere other than `Server.ts`. The scratch script is OUTSIDE `src/`, so the lint rule doesn't apply; keep it in `tmp/`. |

## 7. References

- Phase 2 spec — `docs/specs/mvp/phases/phase-2-tools/spec.md`
- AC-13 integration test (live registry exercise) —
  `packages/agent-core/tests/integration/phase2.test.ts`
- 29-tool registry builder —
  `packages/agent-core/tests/integration/phase2.registry.ts`
- `MCPServerAdapter` source —
  `packages/agent-core/src/mcp/Server.ts`
- Official Inspector — <https://github.com/modelcontextprotocol/inspector>
- MCP protocol reference — <https://modelcontextprotocol.io/>

---

*Last updated 2026-05-13 — T-PHASE2-INSPECTOR (Phase 2 Wave 16 optional polish).*
