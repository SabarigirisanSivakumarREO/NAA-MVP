/**
 * T026 browser_get_metadata — Phase 2 Wave 6 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T026 brief; impact.md MCPToolRegistry
 *         Perception read row (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createGetMetadataTool({ session }) closes
 * over BrowserSession and returns an MCPToolDefinition. Handler reads current
 * URL + title inline from the active session — no Phase 1 surface dependency
 * (the full PageStateModel.metadata struct including timestamps is captured
 * by T024 browser_get_state; T026 is the lightweight snapshot variant).
 *
 * R9 boundary: no `playwright` import. R10: ≤100 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const GetMetadataInputSchema = z.object({}).strict();

export const GetMetadataOutputSchema = z
  .object({
    url: z.string(),
    title: z.string(),
  })
  .strict();

export type GetMetadataInput = z.infer<typeof GetMetadataInputSchema>;
export type GetMetadataOutput = z.infer<typeof GetMetadataOutputSchema>;

export interface GetMetadataDeps {
  readonly session: BrowserSession;
}

const READ_TITLE_SCRIPT = `(() => {
  try { return typeof document !== 'undefined' ? document.title : ''; }
  catch { return ''; }
})()`;

export function createGetMetadataTool(
  deps: GetMetadataDeps,
): MCPToolDefinition<GetMetadataInput, GetMetadataOutput> {
  return {
    name: 'browser_get_metadata', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Read lightweight current-page metadata (url + title) from the active MCP session. Does not navigate or capture full state.',
    inputSchema: GetMetadataInputSchema,
    outputSchema: GetMetadataOutputSchema,
    safetyClass: 'safe',
    handler: async (_input, ctx: ToolContext): Promise<GetMetadataOutput> => {
      const url = deps.session.page.url();
      let title = '';
      try {
        title = await deps.session.page.evaluate<string>(READ_TITLE_SCRIPT);
      } catch (err) {
        ctx.logger.warn(
          { err: (err as Error).message },
          'mcp.tool.get_metadata.title_read_failed',
        );
        // Fall through with empty title — minimal data is better than handler error.
      }
      ctx.logger.info({ url, title }, 'mcp.tool.get_metadata.done');
      return { url, title };
    },
  };
}
