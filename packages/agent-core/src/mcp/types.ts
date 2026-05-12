/**
 * MCP base types — Phase 2 T-PHASE2-TYPES (R-12, REQ-MCP-002).
 *
 * Source: spec.md §R-12 / AC-04 / AC-05; impact.md §MCPToolRegistry (verbatim
 * authority — DO NOT redefine; mirrors per spec §R11 single-source-of-truth +
 * tasks.md F-T2); tasks.md T-PHASE2-TYPES brief.
 *
 * Phase scope: SafetyClass enum + MCPToolDefinition<I, O> + MCPToolSchema<I, O>
 * alias + assertMCPToolDefinition runtime helper + ToolContext (logger +
 * tool_call_id + client_session_id correlation per T-PHASE2-LOGGER).
 *
 * Out of scope (T019): ToolRegistry → ./ToolRegistry.ts; MCPServerAdapter →
 * ./Server.ts.
 *
 * R10: file ≤300 LOC; functions ≤50 LOC; named exports only; no `any`.
 */
import type { Logger } from 'pino';
import { z, type ZodType } from 'zod';

/**
 * Tool safety classification per impact.md MCPToolRegistry §:
 *   - 'safe'                    — read-only or low-risk; no gating
 *   - 'requires_safety_check'   — Phase 4 SafetyCheck inspects per-call
 *   - 'requires_hitl'           — human-in-the-loop approval required
 *   - 'forbidden'               — Phase 4 escalation; unused at Phase 2 close
 *
 * R18 append-only: values LOCKED at Phase 2 close. Phase 4 may add metadata
 * fields (e.g., riskScore) but MUST NOT alter the enum.
 */
export const SafetyClassSchema = z.enum([
  'safe',
  'requires_safety_check',
  'requires_hitl',
  'forbidden',
]);

export type SafetyClass = z.infer<typeof SafetyClassSchema>;

/**
 * Per-call context passed to every tool handler. Carries Pino correlation
 * fields per T-PHASE2-LOGGER. Phase 2 keeps the surface minimal; Phase 4 may
 * extend with audit_run_id / trace_id when the orchestrator lands.
 */
export interface ToolContext {
  /** Pino logger pre-bound with tool_name + tool_call_id correlation. */
  readonly logger: Logger;
  /** UUID v4 unique per tool invocation (T-PHASE2-LOGGER). */
  readonly toolCallId: string;
  /** Client/session identifier; opaque to the tool. */
  readonly clientSessionId: string;
}

/**
 * Canonical per-tool I/O contract — mirrors impact.md MCPToolRegistry §
 * verbatim. Each of the 29 MCP tools authors one of these in its own
 * `mcp/tools/<name>.ts` file.
 *
 * @typeParam I - Tool input shape (Zod-inferred).
 * @typeParam O - Tool output shape (Zod-inferred).
 */
export interface MCPToolDefinition<I, O> {
  /** EXACT v3.1 name (R4.5) — e.g., 'browser_get_state'. Renaming = R23 kill. */
  readonly name: string;
  /** Human-readable description surfaced in `tools/list`. */
  readonly description: string;
  /** Zod schema for input validation at the adapter boundary (R2.2). */
  readonly inputSchema: ZodType<I>;
  /** Zod schema for output validation at the adapter boundary (R2.2). */
  readonly outputSchema: ZodType<O>;
  /** Phase 4 SafetyCheck gating slot per impact.md MCPToolRegistry F-S12. */
  readonly safetyClass: SafetyClass;
  /** Handler. Input already Zod-validated; output validated before return. */
  readonly handler: (input: I, ctx: ToolContext) => Promise<O>;
}

/**
 * Helper alias re-exporting MCPToolDefinition under the name impact.md §
 * "MCPToolSchema" calls out for per-tool schema references.
 */
export type MCPToolSchema<I, O> = MCPToolDefinition<I, O>;

/**
 * Runtime narrowing of an unknown definition to MCPToolDefinition shape via
 * check on load-bearing fields. Used by ToolRegistry (T019) at boot to fail
 * fast on malformed registrations.
 */
export function assertMCPToolDefinition(
  candidate: unknown,
): asserts candidate is MCPToolDefinition<unknown, unknown> {
  if (
    candidate === null ||
    typeof candidate !== 'object' ||
    typeof (candidate as { name?: unknown }).name !== 'string' ||
    typeof (candidate as { description?: unknown }).description !== 'string' ||
    typeof (candidate as { handler?: unknown }).handler !== 'function'
  ) {
    throw new TypeError(
      'MCPToolDefinition shape violation: missing name/description/handler',
    );
  }
  SafetyClassSchema.parse((candidate as { safetyClass?: unknown }).safetyClass);
}
