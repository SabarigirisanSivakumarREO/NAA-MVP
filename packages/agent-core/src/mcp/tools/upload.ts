/**
 * T034 browser_upload — Phase 2 Wave 8 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T034 brief; impact.md MCPToolRegistry
 *         File transfer row (safetyClass = 'requires_hitl'); REQ-MCP-001 +
 *         REQ-MCP-002; R8.4 HITL gate.
 *
 * Factory pattern (locked Wave 4+): createUploadTool({ session }) closes over
 * BrowserSession + returns MCPToolDefinition wrapping session.page.setInputFiles
 * (Wave 8 prep 742b662). Accepts a single absolute path or array of paths for
 * multi-file upload. safetyClass='requires_hitl' so Phase 4 SafetyCheck gates
 * every invocation behind human approval (R8.4 file-upload sensitivity).
 *
 * R9 boundary: no `playwright` import. R10: ≤100 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const UploadInputSchema = z
  .object({
    selector: z.string().min(1),
    files: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    timeout: z.number().int().positive().optional(),
  })
  .strict();

export const UploadOutputSchema = z
  .object({
    ok: z.literal(true),
    fileCount: z.number().int().positive(),
  })
  .strict();

export type UploadInput = z.infer<typeof UploadInputSchema>;
export type UploadOutput = z.infer<typeof UploadOutputSchema>;

export interface UploadDeps {
  readonly session: BrowserSession;
}

export function createUploadTool(
  deps: UploadDeps,
): MCPToolDefinition<UploadInput, UploadOutput> {
  return {
    name: 'browser_upload', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Attach file(s) to a file <input> by absolute path. HITL-gated per R8.4 (Phase 4 SafetyCheck requires human approval). Accepts single path or array.',
    inputSchema: UploadInputSchema,
    outputSchema: UploadOutputSchema,
    safetyClass: 'requires_hitl',
    handler: async (input, ctx: ToolContext): Promise<UploadOutput> => {
      const fileCount = Array.isArray(input.files) ? input.files.length : 1;
      ctx.logger.info(
        { selector: input.selector, file_count: fileCount },
        'mcp.tool.upload.start',
      );

      // exactOptionalPropertyTypes: build opts WITHOUT assigning `undefined`.
      const opts: { timeout?: number } = {};
      if (input.timeout !== undefined) opts.timeout = input.timeout;

      await deps.session.page.setInputFiles(input.selector, input.files, opts);

      ctx.logger.info(
        { selector: input.selector, file_count: fileCount },
        'mcp.tool.upload.done',
      );
      return { ok: true, fileCount };
    },
  };
}
