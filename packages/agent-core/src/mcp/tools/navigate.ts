/**
 * T020 browser_navigate — Phase 2 Wave 4 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T020 brief; plan.md per-tool template
 *         (lines 263-284) — Zod .strict() input + output, EXACT v3.1 name (R4.5),
 *         safetyClass at definition site; impact.md MCPToolRegistry table line 165
 *         (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked for Wave 4+): createNavigateTool({ session }) closes
 * over BrowserSession at registration time and returns an MCPToolDefinition.
 * ToolContext does NOT carry BrowserSession — the registry injects ctx
 * (logger + correlation IDs) per call.
 *
 * R9 boundary: this file references the BrowserEngine adapter contract only;
 * no `playwright` import. R10: ≤100 LOC; named exports only; no `any`.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

const WaitUntilSchema = z.enum(['load', 'domcontentloaded', 'networkidle']);

export const NavigateInputSchema = z
  .object({
    url: z.string().url(),
    waitUntil: WaitUntilSchema.optional(),
    timeout: z.number().int().positive().optional(),
  })
  .strict();

export const NavigateOutputSchema = z
  .object({
    url: z.string().url(),
  })
  .strict();

export type NavigateInput = z.infer<typeof NavigateInputSchema>;
export type NavigateOutput = z.infer<typeof NavigateOutputSchema>;

export interface NavigateDeps {
  readonly session: BrowserSession;
}

export function createNavigateTool(
  deps: NavigateDeps,
): MCPToolDefinition<NavigateInput, NavigateOutput> {
  return {
    name: 'browser_navigate', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Navigate the active page to a URL. Wraps page.goto with optional waitUntil + timeout.',
    inputSchema: NavigateInputSchema,
    outputSchema: NavigateOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<NavigateOutput> => {
      // R2.x exactOptionalPropertyTypes: build opts WITHOUT assigning undefined.
      const opts: {
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
        timeout?: number;
      } = {};
      if (input.waitUntil !== undefined) opts.waitUntil = input.waitUntil;
      if (input.timeout !== undefined) opts.timeout = input.timeout;

      ctx.logger.info({ url: input.url, ...opts }, 'mcp.tool.navigate.start');
      await deps.session.page.goto(input.url, opts);
      ctx.logger.info({ url: input.url }, 'mcp.tool.navigate.done');

      return { url: input.url };
    },
  };
}
