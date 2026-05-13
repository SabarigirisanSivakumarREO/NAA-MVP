/**
 * Phase 2 T019 — ToolRegistry: name → MCPToolDefinition map.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md R-14 + AC-04 + Edge Cases
 *   docs/specs/mvp/phases/phase-2-tools/impact.md §MCPToolRegistry
 *     (CANONICAL interface shape — mirrored verbatim per R11 single
 *      source of truth; tasks.md F-T2 forbids re-declaration elsewhere).
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T019 (REQ-MCP-002).
 *
 * # Contract
 *
 * `ToolRegistry` is the boot-time map that the MCPServerAdapter consults
 * when the SDK's `tools/list` / `tools/call` flows fire. Each of the 29
 * Phase 2 MCP tools (22 browser_* + 2 agent_* + 5 page_*) registers
 * exactly once at startup; duplicate registration MUST fail fast with a
 * typed `DuplicateToolNameError` (spec.md AC-04 "boot fails fast on
 * duplicate tool name"). Unknown-name lookups return `undefined` from
 * `get()` and throw a typed `UnknownToolNameError` from
 * `getSafetyClass()` so callers can pattern-match the failure.
 *
 * # R9 boundary
 *
 * This file deliberately DOES NOT import `@modelcontextprotocol/sdk`.
 * The SDK is imported ONLY in `./Server.ts` (R9 single-importer rule
 * per tasks.md "@modelcontextprotocol/sdk imported outside mcp/Server.ts
 * + mcp/tools/*.ts" kill criterion). ToolRegistry is a pure in-memory
 * data structure with no transport, no protocol awareness.
 *
 * R10.1: file ≤ 150 lines.
 */
import type {
  MCPToolDefinition,
  SafetyClass,
} from './types.js';

/**
 * Subset of `MCPToolDefinition` returned by `list()`. Intentionally omits
 * `inputSchema` / `outputSchema` / `handler` because:
 *   1. Tools/list response surface is name+description+safetyClass-only
 *      per spec.md AC-04 (Zod schemas are converted to JSON Schema by
 *      the Server adapter, not surfaced here).
 *   2. Handlers MUST NEVER be exposed to introspection APIs (defense in
 *      depth against accidental serialization).
 */
export type ToolListEntry = Pick<
  MCPToolDefinition<unknown, unknown>,
  'name' | 'description' | 'safetyClass'
>;

/**
 * Canonical ToolRegistry interface — VERBATIM mirror of impact.md
 * §MCPToolRegistry. Do NOT modify field shapes here without
 * propagating to impact.md (R11 / R20).
 */
export interface ToolRegistry {
  /**
   * Register a tool. Throws `DuplicateToolNameError` if `def.name` is
   * already registered (spec.md AC-04 "boot fails fast on duplicate
   * tool name"; never silently overwrites).
   */
  register<I, O>(def: MCPToolDefinition<I, O>): void;
  /**
   * Three-field summary suitable for `tools/list` projection. Never
   * exposes inputSchema/outputSchema/handler.
   */
  list(): readonly ToolListEntry[];
  /**
   * Full tool definition for a registered name; `undefined` for unknown.
   * Returns the erased `MCPToolDefinition<unknown, unknown>` because the
   * registry stores tools heterogeneously; the caller (Server.ts) narrows
   * back via the Zod schemas at the adapter boundary.
   */
  get(name: string): MCPToolDefinition<unknown, unknown> | undefined;
  /**
   * Safety class lookup. Throws `UnknownToolNameError` (NOT `undefined`)
   * so callers don't accidentally treat unknown tools as `safe`. Phase 4
   * SafetyCheck depends on a fail-fast signal here.
   */
  getSafetyClass(name: string): SafetyClass;
}

/**
 * Thrown when `register()` is called with a name already present.
 * Carries the offending name so observability + tests can assert
 * structured failure.
 */
export class DuplicateToolNameError extends Error {
  public override readonly name = 'DuplicateToolNameError';
  constructor(public readonly toolName: string) {
    super(
      `MCP tool "${toolName}" is already registered. Duplicate registration ` +
        'is a boot-time failure (Phase 2 spec.md AC-04, never silent overwrite).',
    );
  }
}

/**
 * Thrown when `getSafetyClass()` is called with an unregistered name.
 * Phase 4 SafetyCheck depends on this so an unknown name cannot be
 * silently treated as `safe`.
 */
export class UnknownToolNameError extends Error {
  public override readonly name = 'UnknownToolNameError';
  constructor(public readonly toolName: string) {
    super(
      `MCP tool "${toolName}" is not registered. getSafetyClass throws so ` +
        'callers cannot accidentally treat unknown tools as safe.',
    );
  }
}

/**
 * Default in-memory `ToolRegistry`. Map-backed for O(1) lookup; iteration
 * order matches insertion order which keeps `tools/list` output stable
 * across boots (deterministic snapshots — R14).
 */
export class InMemoryToolRegistry implements ToolRegistry {
  readonly #tools = new Map<string, MCPToolDefinition<unknown, unknown>>();

  register<I, O>(def: MCPToolDefinition<I, O>): void {
    if (this.#tools.has(def.name)) {
      throw new DuplicateToolNameError(def.name);
    }
    // Erase the I/O type parameters at storage time; the Zod schemas
    // inside the definition retain runtime validation power, and the
    // Server adapter re-narrows via those schemas at the boundary.
    this.#tools.set(
      def.name,
      def as unknown as MCPToolDefinition<unknown, unknown>,
    );
  }

  list(): readonly ToolListEntry[] {
    const entries: ToolListEntry[] = [];
    for (const def of this.#tools.values()) {
      entries.push({
        name: def.name,
        description: def.description,
        safetyClass: def.safetyClass,
      });
    }
    return entries;
  }

  get(name: string): MCPToolDefinition<unknown, unknown> | undefined {
    return this.#tools.get(name);
  }

  getSafetyClass(name: string): SafetyClass {
    const def = this.#tools.get(name);
    if (def === undefined) {
      throw new UnknownToolNameError(name);
    }
    return def.safetyClass;
  }
}
