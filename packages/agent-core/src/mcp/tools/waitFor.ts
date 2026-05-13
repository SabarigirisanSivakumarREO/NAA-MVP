/**
 * T040 browser_wait_for — Phase 2 Wave 10 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T040; impact.md MCPToolRegistry
 *         Utility row (safetyClass='safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createWaitForTool({ session }) closes over
 * BrowserSession + returns MCPToolDefinition. Handler dispatches on the
 * discriminated input.kind: 'selector' delegates to session.page.waitForSelector
 * (Wave 10 prep 67671d4); 'timeout' awaits setTimeout.
 *
 * R9 boundary: no `playwright` import. R10: ≤120 LOC; named exports only.
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

const StateSchema = z.enum(['attached', 'detached', 'visible', 'hidden']);

export const WaitForInputSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('selector'),
      selector: z.string().min(1),
      state: StateSchema.optional(),
      timeout: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('timeout'),
      ms: z.number().int().positive().max(30000),
    })
    .strict(),
]);

export const WaitForOutputSchema = z
  .object({
    ok: z.literal(true),
    kind: z.enum(['selector', 'timeout']),
    elapsedMs: z.number().nonnegative(),
  })
  .strict();

export type WaitForInput = z.infer<typeof WaitForInputSchema>;
export type WaitForOutput = z.infer<typeof WaitForOutputSchema>;

export interface WaitForDeps {
  readonly session: BrowserSession;
}

export function createWaitForTool(
  deps: WaitForDeps,
): MCPToolDefinition<WaitForInput, WaitForOutput> {
  return {
    name: 'browser_wait_for', // EXACT v3.1 (R4.5)
    description:
      'Wait for a selector to reach a target state OR sleep a fixed duration. Discriminated input { kind: "selector", selector, state?, timeout? } | { kind: "timeout", ms }. timeout (max 30000 ms).',
    inputSchema: WaitForInputSchema,
    outputSchema: WaitForOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<WaitForOutput> => {
      const t0 = Date.now();
      ctx.logger.info({ kind: input.kind }, 'mcp.tool.wait_for.start');

      if (input.kind === 'selector') {
        const opts: {
          state?: 'attached' | 'detached' | 'visible' | 'hidden';
          timeout?: number;
        } = {};
        if (input.state !== undefined) opts.state = input.state;
        if (input.timeout !== undefined) opts.timeout = input.timeout;
        await deps.session.page.waitForSelector(input.selector, opts);
      } else {
        await sleep(input.ms);
      }

      const elapsedMs = Date.now() - t0;
      ctx.logger.info(
        { kind: input.kind, elapsed_ms: elapsedMs },
        'mcp.tool.wait_for.done',
      );
      return { ok: true, kind: input.kind, elapsedMs };
    },
  };
}
