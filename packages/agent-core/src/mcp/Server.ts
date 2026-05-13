// THIS FILE IS THE ONLY R9 BOUNDARY for @modelcontextprotocol/sdk imports in
// agent-core (the other site for tool registrations is per-tool files in
// mcp/tools/, but those files DO NOT import the SDK directly).
/**
 * Phase 2 T019 — MCPServerAdapter: wraps `@modelcontextprotocol/sdk`'s
 * `Server` behind a typed `start()` / `stop()` lifecycle.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md R-04 + AC-04 + NF-Phase2-01
 *   docs/specs/mvp/phases/phase-2-tools/impact.md §MCPToolRegistry
 *   docs/specs/mvp/phases/phase-2-tools/plan.md §"MCP server (T019) — adapter
 *     pattern" + §"Per-tool template"
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T019 (REQ-MCP-001/002)
 *   docs/specs/mvp/constitution.md R9 (single SDK importer)
 *   packages/agent-core/src/adapters/README.md (R9 boundary conventions —
 *     this is the SECOND concrete R9 adapter category in agent-core after
 *     BrowserEngine for Playwright)
 *
 * # R9 boundary (load-bearing)
 *
 * This file is the ONLY site permitted to import from
 * `@modelcontextprotocol/sdk`. Per spec.md SC-005 + tasks.md kill criteria:
 * any other SDK import in `src/` is a R9 violation that aborts the phase.
 * Per-tool files in `mcp/tools/*.ts` register via the `MCPToolDefinition`
 * shape (typed in `./types.ts`) WITHOUT importing the SDK — they hand the
 * registry a Zod-validated I/O schema + handler, and this adapter wires
 * them into the SDK's `tools/list` / `tools/call` flow.
 *
 * # Lifecycle
 *
 * `new MCPServerAdapter(registry, logger, opts?)` constructs the adapter
 * holding (a) the in-memory `ToolRegistry`, (b) a Pino logger pre-bound
 * with `tool_name` / `tool_call_id` / `client_session_id` correlation
 * fields per T-PHASE2-LOGGER, and (c) optional transport + serverInfo.
 *
 * `start()` registers the two MCP request handlers (`tools/list`,
 * `tools/call`) with the SDK Server, then optionally `connect()`s the
 * transport if one was supplied at construction time. Boot completes
 * in < 500 ms on an empty registry (NF-Phase2-01); verified via Pino
 * timing log on entry/exit.
 *
 * `stop()` closes the SDK Server (which closes the transport) if the
 * adapter was started; idempotent for safety in test teardown.
 *
 * Transport is OPTIONAL by design: Phase 2 unit + integration tests
 * exercise the registry path without binding stdio/http/etc. Phase 5
 * BrowseNode + dev MCP Inspector are the consumers that wire a real
 * transport via constructor opts.
 *
 * R10.1: file ≤ 200 lines.
 */
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';
import { Server as MCPSdkServer } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { Logger } from '../observability/logger.js';
import type { ToolRegistry } from './ToolRegistry.js';
import type { MCPToolDefinition, ToolContext } from './types.js';

/**
 * Implementation metadata advertised to MCP clients on connect.
 * Defaults match Phase 2 walking-skeleton; callers may override.
 */
export interface MCPServerInfo {
  readonly name: string;
  readonly version: string;
}

export interface MCPServerAdapterOptions {
  /**
   * Optional transport. When omitted, `start()` only registers handlers
   * (used by Phase 2 unit + integration tests that boot in-process).
   * Phase 5 BrowseNode + the MCP Inspector wire a real transport here.
   */
  readonly transport?: Transport;
  /** Server name + version surfaced to MCP clients (default below). */
  readonly serverInfo?: MCPServerInfo;
  /**
   * Default `clientSessionId` to bind into every tool's ToolContext when
   * the underlying transport doesn't supply one. Phase 5 will replace
   * with a per-transport session id.
   */
  readonly defaultClientSessionId?: string;
}

const DEFAULT_SERVER_INFO: MCPServerInfo = {
  name: 'neural-agent-core',
  version: '0.1.0',
};

/**
 * F-005 (Wave-18 Stage 2.5 remediation): typed error codes returned to MCP
 * clients in the response envelope. Full Zod / handler messages are logged
 * via Pino (callLogger.warn/.error retain the err field); ONLY the code
 * surfaces to the client to prevent prompt-injection-via-error-envelope on
 * the Phase 5 BrowseNode untrusted-input path.
 */
const ERROR_CODES = {
  INVALID_INPUT: 'MCP-INVALID-INPUT-001',
  INVALID_OUTPUT: 'MCP-INVALID-OUTPUT-001',
  HANDLER_FAILURE: 'MCP-HANDLER-FAILURE-001',
} as const;

/**
 * Crypto-strong tool_call_id generator (Node 22 has `crypto.randomUUID`
 * native; importing via `node:crypto` keeps the dep tree clean).
 */
function newToolCallId(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- node:crypto is built-in
  return globalThis.crypto.randomUUID();
}

export class MCPServerAdapter {
  readonly #registry: ToolRegistry;
  readonly #logger: Logger;
  readonly #server: MCPSdkServer;
  readonly #transport: Transport | undefined;
  readonly #defaultClientSessionId: string;
  #started = false;

  constructor(
    registry: ToolRegistry,
    logger: Logger,
    opts: MCPServerAdapterOptions = {},
  ) {
    this.#registry = registry;
    this.#logger = logger;
    this.#transport = opts.transport;
    this.#defaultClientSessionId = opts.defaultClientSessionId ?? 'local';
    const info = opts.serverInfo ?? DEFAULT_SERVER_INFO;
    this.#server = new MCPSdkServer(
      { name: info.name, version: info.version },
      { capabilities: { tools: {} } },
    );
  }

  async start(): Promise<void> {
    if (this.#started) return;
    const t0 = performance.now();
    this.#registerHandlers();
    if (this.#transport !== undefined) {
      await this.#server.connect(this.#transport);
    }
    this.#started = true;
    this.#logger.info(
      { boot_ms: performance.now() - t0, tools: this.#registry.list().length },
      'mcp.server.start',
    );
  }

  async stop(): Promise<void> {
    if (!this.#started) return;
    await this.#server.close();
    this.#started = false;
    this.#logger.info('mcp.server.stop');
  }

  #registerHandlers(): void {
    this.#server.setRequestHandler(ListToolsRequestSchema, (): ListToolsResult => {
      return {
        tools: this.#registry.list().map((entry) => {
          const def = this.#registry.get(entry.name);
          // def is non-null because list() and get() share the same map
          // (InMemoryToolRegistry); explicit narrow keeps TS strict.
          if (def === undefined) {
            throw new Error(
              `Registry inconsistency: list() yielded "${entry.name}" but get() returned undefined.`,
            );
          }
          return {
            name: def.name,
            description: def.description,
            inputSchema: zodToJsonSchema(def.inputSchema, {
              $refStrategy: 'none',
            }) as ListToolsResult['tools'][number]['inputSchema'],
          };
        }),
      };
    });

    this.#server.setRequestHandler(
      CallToolRequestSchema,
      async (request): Promise<CallToolResult> => {
        const { name, arguments: rawInput } = request.params;
        const def = this.#registry.get(name);
        if (def === undefined) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          };
        }
        return this.#invokeTool(def, rawInput);
      },
    );
  }

  async #invokeTool(
    def: MCPToolDefinition<unknown, unknown>,
    rawInput: unknown,
  ): Promise<CallToolResult> {
    const toolCallId = newToolCallId();
    const callLogger = this.#logger.child({
      tool_name: def.name,
      tool_call_id: toolCallId,
      client_session_id: this.#defaultClientSessionId,
    });
    const parsedInput = def.inputSchema.safeParse(rawInput);
    if (!parsedInput.success) {
      callLogger.warn({ err: parsedInput.error.message }, 'mcp.tool.input_invalid');
      return {
        isError: true,
        content: [{ type: 'text', text: ERROR_CODES.INVALID_INPUT }],
      };
    }
    const ctx: ToolContext = {
      logger: callLogger,
      toolCallId,
      clientSessionId: this.#defaultClientSessionId,
    };
    try {
      const output = await def.handler(parsedInput.data, ctx);
      const parsedOutput = def.outputSchema.safeParse(output);
      if (!parsedOutput.success) {
        callLogger.error({ err: parsedOutput.error.message }, 'mcp.tool.output_invalid');
        return {
          isError: true,
          content: [{ type: 'text', text: ERROR_CODES.INVALID_OUTPUT }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(parsedOutput.data) }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      callLogger.error({ err: msg }, 'mcp.tool.handler_error');
      return { isError: true, content: [{ type: 'text', text: ERROR_CODES.HANDLER_FAILURE }] };
    }
  }
}
