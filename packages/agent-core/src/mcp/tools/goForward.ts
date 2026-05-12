/**
 * T022 browser_go_forward — Phase 2 Wave 4 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T022 brief; plan.md per-tool template
 *         (lines 263-284) — Zod .strict() input + output, EXACT v3.1 name (R4.5),
 *         safetyClass at definition site; impact.md MCPToolRegistry table line 165
 *         (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createGoForwardTool({ session }) closes over
 * BrowserSession at registration time and returns an MCPToolDefinition.
 * ToolContext does NOT carry BrowserSession — the registry injects ctx
 * (logger + correlation IDs) per call.
 *
 * Consumes the `BrowserPage.goForward` surface extension prep-committed in
 * Wave 4 (b4a2e86) on BrowserEngine.ts. R9 boundary preserved: no `playwright`
 * import. R10: ≤100 LOC; named exports only; no `any`.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

const WaitUntilSchema = z.enum(['load', 'domcontentloaded', 'networkidle']);

export const GoForwardInputSchema = z
  .object({
    waitUntil: WaitUntilSchema.optional(),
    timeout: z.number().int().positive().optional(),
  })
  .strict();

export const GoForwardOutputSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();

export type GoForwardInput = z.infer<typeof GoForwardInputSchema>;
export type GoForwardOutput = z.infer<typeof GoForwardOutputSchema>;

export interface GoForwardDeps {
  readonly session: BrowserSession;
}

export function createGoForwardTool(
  deps: GoForwardDeps,
): MCPToolDefinition<GoForwardInput, GoForwardOutput> {
  return {
    name: 'browser_go_forward', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Navigate the active page forward in history. Wraps page.goForward with optional waitUntil + timeout.',
    inputSchema: GoForwardInputSchema,
    outputSchema: GoForwardOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<GoForwardOutput> => {
      // R2.x exactOptionalPropertyTypes: build opts WITHOUT assigning undefined.
      const opts: {
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
        timeout?: number;
      } = {};
      if (input.waitUntil !== undefined) opts.waitUntil = input.waitUntil;
      if (input.timeout !== undefined) opts.timeout = input.timeout;

      ctx.logger.info(opts, 'mcp.tool.go_forward.start');
      await deps.session.page.goForward(opts);
      ctx.logger.info({}, 'mcp.tool.go_forward.done');

      return { ok: true };
    },
  };
}
