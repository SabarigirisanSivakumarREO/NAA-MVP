/**
 * T028 browser_click_coords — Phase 2 Wave 6 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T028 brief ("Coordinate-based fallback");
 *         impact.md MCPToolRegistry Interaction row (safetyClass =
 *         'requires_safety_check'); REQ-MCP-001 + REQ-MCP-002 +
 *         REQ-BROWSE-HUMAN-001/002.
 *
 * Factory pattern (locked Wave 4+): createClickCoordsTool({ session, mouse? })
 * closes over BrowserSession + MouseBehavior. The handler invokes
 * mouseBehavior.click with the caller-supplied coords directly — no selector
 * resolution. Consumes BrowserPage.mouse surface from Wave 6 prep (3bd1226).
 *
 * Use case: callers (Phase 5+ orchestrator) holding explicit coords from
 * PageStateModel.interactiveGraph[id].boundingBox can dispatch a click without
 * paying the selector→bbox round-trip cost.
 *
 * R9 boundary: no `playwright` import. R10: ≤100 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import { mouseBehavior } from '../../browser-runtime/MouseBehavior.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const ClickCoordsInputSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .strict();

export const ClickCoordsOutputSchema = z
  .object({
    ok: z.literal(true),
    x: z.number(),
    y: z.number(),
  })
  .strict();

export type ClickCoordsInput = z.infer<typeof ClickCoordsInputSchema>;
export type ClickCoordsOutput = z.infer<typeof ClickCoordsOutputSchema>;

export interface ClickCoordsDeps {
  readonly session: BrowserSession;
  /** Optional MouseBehavior override for tests. Defaults to singleton. */
  readonly mouse?: typeof mouseBehavior;
}

export function createClickCoordsTool(
  deps: ClickCoordsDeps,
): MCPToolDefinition<ClickCoordsInput, ClickCoordsOutput> {
  const mouse = deps.mouse ?? mouseBehavior;

  return {
    name: 'browser_click_coords', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Click at explicit page coordinates with human-shaped pointer motion (MouseBehavior Bezier). Coordinate fallback when no CSS selector is available.',
    inputSchema: ClickCoordsInputSchema,
    outputSchema: ClickCoordsOutputSchema,
    safetyClass: 'requires_safety_check',
    handler: async (input, ctx: ToolContext): Promise<ClickCoordsOutput> => {
      ctx.logger.info({ x: input.x, y: input.y }, 'mcp.tool.click_coords.start');
      await mouse.click(deps.session.page, { x: input.x, y: input.y });
      ctx.logger.info({ x: input.x, y: input.y }, 'mcp.tool.click_coords.done');
      return { ok: true, x: input.x, y: input.y };
    },
  };
}
