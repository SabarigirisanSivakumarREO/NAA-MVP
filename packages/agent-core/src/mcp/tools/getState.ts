/**
 * T024 browser_get_state — Phase 2 Wave 5 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T024 brief; spec.md line 171 (current-
 *         session capture semantics); impact.md v0.2.3 (R11.4 capture mechanism
 *         clarified as session-based); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createGetStateTool({ session }) closes
 * over BrowserSession and returns an MCPToolDefinition. Consumes
 * ContextAssembler.captureFromSession added in Wave 5 prep (4737e17).
 *
 * The MCP client holds a persistent BrowserSession across many tool calls;
 * browser_get_state runs the Phase 1 extractor pipeline on the current page
 * state and returns a Zod-valid PageStateModel without owning lifecycle.
 *
 * R9 boundary: no `playwright` import. R10: ≤100 LOC; named exports only.
 */
import { z, type ZodType } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import {
  contextAssembler,
  PageStateModelSchema,
  type PageStateModel,
} from '../../perception/index.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

// Input: no required params at MVP. The active session is closed-over via deps.
// Reserved seam for future overrides (e.g., explicit timeout per call); empty
// strict object for now.
export const GetStateInputSchema = z.object({}).strict();

// Output schema is Phase 1's authoritative PageStateModelSchema (R20
// forward-compat: T024 returns the Phase 1 contract verbatim per impact.md
// line 83 DECISION v0.2 — backward compat with the < 20K token budget).
// Identity reference (same instance) — tests assert via `.toBe(...)`. The
// `ZodType<PageStateModel>` cast widens to MCPToolDefinition's single-param
// ZodType slot; PageStateModelSchema has `.default()` fields whose input type
// diverges from the output type (`exactOptionalPropertyTypes`), but the
// runtime schema is unchanged — parse/validate behavior is identical.
export const GetStateOutputSchema: ZodType<PageStateModel> =
  PageStateModelSchema as unknown as ZodType<PageStateModel>;

export type GetStateInput = z.infer<typeof GetStateInputSchema>;
export type GetStateOutput = PageStateModel;

export interface GetStateDeps {
  readonly session: BrowserSession;
}

export function createGetStateTool(
  deps: GetStateDeps,
): MCPToolDefinition<GetStateInput, GetStateOutput> {
  return {
    name: 'browser_get_state', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Capture a Zod-valid PageStateModel for the current page (AX tree + filtered DOM + visual + metadata + diagnostics). Operates on the active MCP session; does not navigate.',
    inputSchema: GetStateInputSchema,
    outputSchema: GetStateOutputSchema,
    safetyClass: 'safe',
    handler: async (_input, ctx: ToolContext): Promise<GetStateOutput> => {
      const url = deps.session.page.url();
      ctx.logger.info({ url }, 'mcp.tool.get_state.start');
      const psm = await contextAssembler.captureFromSession(deps.session);
      ctx.logger.info(
        {
          url: psm.metadata.url,
          ax_nodes: psm.diagnostics.axNodeCount,
          stable: psm.diagnostics.stable,
        },
        'mcp.tool.get_state.done',
      );
      return psm;
    },
  };
}
