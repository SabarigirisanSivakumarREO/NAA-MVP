/**
 * T030 browser_scroll — Phase 2 Wave 7 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T030 brief; impact.md MCPToolRegistry
 *         Motion row (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createScrollTool({ session, scroll? }) closes
 * over BrowserSession + ScrollBehavior. The handler delegates to
 * scrollBehavior.scroll for variable-momentum eased scroll (ease-out cubic ~16
 * wheel events / 1000 px). Consumes BrowserPage.mouse.wheel from Wave 7 prep
 * (405e8bf).
 *
 * R9 boundary: no `playwright` import. R10: ≤120 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import { scrollBehavior } from '../../browser-runtime/ScrollBehavior.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const ScrollInputSchema = z
  .object({
    direction: z.enum(['down', 'up']),
    distancePx: z.number().int().positive().max(5000),
    velocityFactor: z.number().positive().optional(),
    frameMs: z.number().int().positive().optional(),
  })
  .strict();

export const ScrollOutputSchema = z
  .object({
    ok: z.literal(true),
    direction: z.enum(['down', 'up']),
    distancePx: z.number().int(),
  })
  .strict();

export type ScrollInput = z.infer<typeof ScrollInputSchema>;
export type ScrollOutput = z.infer<typeof ScrollOutputSchema>;

export interface ScrollDeps {
  readonly session: BrowserSession;
  /** Optional ScrollBehavior override for tests. Defaults to singleton. */
  readonly scroll?: typeof scrollBehavior;
}

export function createScrollTool(
  deps: ScrollDeps,
): MCPToolDefinition<ScrollInput, ScrollOutput> {
  const scroll = deps.scroll ?? scrollBehavior;

  return {
    name: 'browser_scroll', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Scroll the active page with variable-momentum eased motion (ScrollBehavior; ease-out cubic mouse.wheel events). Direction down|up, distance up to 5000 px.',
    inputSchema: ScrollInputSchema,
    outputSchema: ScrollOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<ScrollOutput> => {
      ctx.logger.info(
        { direction: input.direction, distance_px: input.distancePx },
        'mcp.tool.scroll.start',
      );

      // R2.x exactOptionalPropertyTypes: build opts without assigning undefined.
      const scrollOpts: {
        velocityFactor?: number;
        frameMs?: number;
        tool_name: string;
        tool_call_id: string;
        client_session_id: string;
      } = {
        tool_name: 'browser_scroll',
        tool_call_id: ctx.toolCallId,
        client_session_id: ctx.clientSessionId,
      };
      if (input.velocityFactor !== undefined) {
        scrollOpts.velocityFactor = input.velocityFactor;
      }
      if (input.frameMs !== undefined) {
        scrollOpts.frameMs = input.frameMs;
      }

      // Structural narrowing: ScrollPage's narrow `evaluate` signature (used
      // only in the no-mouse.wheel fallback) is not assignable from
      // BrowserPage's broader evaluate. With Wave 7 prep adding mouse.wheel,
      // the fallback never fires; the cast is a structural-narrow at the
      // boundary, not a runtime semantic change.
      const page = deps.session.page as unknown as Parameters<
        typeof scrollBehavior.scroll
      >[0];
      await scroll.scroll(page, input.direction, input.distancePx, scrollOpts);

      ctx.logger.info(
        { direction: input.direction, distance_px: input.distancePx },
        'mcp.tool.scroll.done',
      );
      return { ok: true, direction: input.direction, distancePx: input.distancePx };
    },
  };
}
