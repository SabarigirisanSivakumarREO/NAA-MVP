/**
 * T039 browser_get_network — Phase 2 Wave 10 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T039; impact.md MCPToolRegistry
 *         Utility row (safetyClass='safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createGetNetworkTool({ session }) closes
 * over BrowserSession + returns MCPToolDefinition that reads
 * performance.getEntriesByType('resource') via a single session.page.evaluate.
 * Stateless snapshot — does NOT install per-request event listeners (event
 * accumulation is Phase 5+/v1.1 work).
 *
 * No Phase 1 surface extension needed.
 *
 * R9 boundary: no `playwright` import. R10: ≤120 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const GetNetworkInputSchema = z
  .object({
    filterByType: z.string().min(1).optional(),
    since: z.number().nonnegative().optional(),
    limit: z.number().int().positive().max(200).optional(),
  })
  .strict();

const NetworkEntrySchema = z
  .object({
    url: z.string(),
    initiatorType: z.string(),
    transferSize: z.number().nonnegative(),
    duration: z.number().nonnegative(),
    startTime: z.number().nonnegative(),
  })
  .strict();

export const GetNetworkOutputSchema = z
  .object({
    ok: z.literal(true),
    entries: z.array(NetworkEntrySchema),
    totalCount: z.number().int().nonnegative(),
  })
  .strict();

export type GetNetworkInput = z.infer<typeof GetNetworkInputSchema>;
export type GetNetworkOutput = z.infer<typeof GetNetworkOutputSchema>;
export type NetworkEntry = z.infer<typeof NetworkEntrySchema>;

export interface GetNetworkDeps {
  readonly session: BrowserSession;
}

/**
 * Reads performance.getEntriesByType('resource'), filters + caps. Returns
 * the post-filter total alongside the (potentially capped) entries so the
 * caller knows when truncation happened.
 */
const GET_NETWORK_SCRIPT = `(args) => {
  const { filterByType, since, limit } = args;
  const all = performance.getEntriesByType('resource');
  const filtered = [];
  for (const e of all) {
    if (filterByType && e.initiatorType !== filterByType) continue;
    if (since !== undefined && e.startTime < since) continue;
    filtered.push({
      url: e.name,
      initiatorType: e.initiatorType,
      transferSize: typeof e.transferSize === 'number' ? e.transferSize : 0,
      duration: typeof e.duration === 'number' ? e.duration : 0,
      startTime: typeof e.startTime === 'number' ? e.startTime : 0,
    });
  }
  const totalCount = filtered.length;
  const entries = filtered.slice(0, limit);
  return { entries, totalCount };
}`;

interface ScriptResult {
  entries: NetworkEntry[];
  totalCount: number;
}

export function createGetNetworkTool(
  deps: GetNetworkDeps,
): MCPToolDefinition<GetNetworkInput, GetNetworkOutput> {
  return {
    name: 'browser_get_network', // EXACT v3.1 (R4.5)
    description:
      'Snapshot network resources loaded by the active page via Performance API (getEntriesByType "resource"). Stateless — does not install event listeners. Optional filterByType, since (startTime ms), limit (default 50, max 200).',
    inputSchema: GetNetworkInputSchema,
    outputSchema: GetNetworkOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<GetNetworkOutput> => {
      const args: { filterByType?: string; since?: number; limit: number } = {
        limit: input.limit ?? 50,
      };
      if (input.filterByType !== undefined) args.filterByType = input.filterByType;
      if (input.since !== undefined) args.since = input.since;

      ctx.logger.info(args, 'mcp.tool.get_network.start');

      const result = await deps.session.page.evaluate<ScriptResult>(GET_NETWORK_SCRIPT, args);

      ctx.logger.info(
        { entry_count: result.entries.length, total_count: result.totalCount },
        'mcp.tool.get_network.done',
      );
      return { ok: true, entries: result.entries, totalCount: result.totalCount };
    },
  };
}
