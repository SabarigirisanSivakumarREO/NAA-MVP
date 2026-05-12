/**
 * T023 browser_reload — Phase 2 Wave 5 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T023 brief; plan.md per-tool template
 *         — Zod .strict() input + output, EXACT v3.1 name (R4.5), safetyClass
 *         at definition site; impact.md MCPToolRegistry navigation row
 *         (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createReloadTool({ session }) closes over
 * BrowserSession at registration time and returns an MCPToolDefinition.
 * Consumes BrowserPage.reload surface extension from Wave 5 prep (4737e17).
 *
 * R9 boundary: this file references the BrowserEngine adapter contract only;
 * no `playwright` import. R10: ≤100 LOC; named exports only; no `any`.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

const WaitUntilSchema = z.enum(['load', 'domcontentloaded', 'networkidle']);

export const ReloadInputSchema = z
  .object({
    waitUntil: WaitUntilSchema.optional(),
    timeout: z.number().int().positive().optional(),
  })
  .strict();

export const ReloadOutputSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();

export type ReloadInput = z.infer<typeof ReloadInputSchema>;
export type ReloadOutput = z.infer<typeof ReloadOutputSchema>;

export interface ReloadDeps {
  readonly session: BrowserSession;
}

export function createReloadTool(
  deps: ReloadDeps,
): MCPToolDefinition<ReloadInput, ReloadOutput> {
  return {
    name: 'browser_reload', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Reload the active page. Wraps page.reload with optional waitUntil + timeout.',
    inputSchema: ReloadInputSchema,
    outputSchema: ReloadOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<ReloadOutput> => {
      // R2.x exactOptionalPropertyTypes: build opts WITHOUT assigning undefined.
      const opts: {
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
        timeout?: number;
      } = {};
      if (input.waitUntil !== undefined) opts.waitUntil = input.waitUntil;
      if (input.timeout !== undefined) opts.timeout = input.timeout;

      ctx.logger.info(opts, 'mcp.tool.reload.start');
      await deps.session.page.reload(opts);
      ctx.logger.info({}, 'mcp.tool.reload.done');

      return { ok: true };
    },
  };
}
