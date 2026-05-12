/**
 * T037 browser_download — Phase 2 Wave 9b MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T037 brief; impact.md MCPToolRegistry
 *         File transfer row (safetyClass = 'requires_hitl'); REQ-MCP-001 +
 *         REQ-MCP-002; R8.4 HITL gate.
 *
 * Factory pattern (locked Wave 4+): createDownloadTool({ session }) closes
 * over BrowserSession + returns MCPToolDefinition with EXACT v3.1 name
 * 'browser_download' and safetyClass 'requires_hitl'. Phase 4 SafetyCheck
 * will gate every invocation behind human approval (R8.4).
 *
 * Handler orchestrates the event-driven download flow:
 *   1. Validate saveDir is absolute (typed error otherwise)
 *   2. Register download listener BEFORE the click (Playwright semantics)
 *   3. Trigger via programmatic page.evaluate click (more reliable than
 *      mouse for downloads — no viewport/pointer constraints)
 *   4. Await the Download event
 *   5. Save to saveDir/suggestedFilename via download.saveAs
 *
 * Consumes BrowserPage.waitForEvent + BrowserDownload surface from Wave 9b
 * prep (ae9627e).
 *
 * R9 boundary: no `playwright` import. R10: ≤120 LOC; named exports only.
 */
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const DownloadInputSchema = z
  .object({
    triggerSelector: z.string().min(1),
    saveDir: z.string().min(1),
    timeout: z.number().int().positive().optional(),
  })
  .strict();

export const DownloadOutputSchema = z
  .object({
    ok: z.literal(true),
    filename: z.string(),
    path: z.string(),
  })
  .strict();

export type DownloadInput = z.infer<typeof DownloadInputSchema>;
export type DownloadOutput = z.infer<typeof DownloadOutputSchema>;

export interface DownloadDeps {
  readonly session: BrowserSession;
}

export class DownloadSaveDirNotAbsoluteError extends Error {
  public override readonly name = 'DownloadSaveDirNotAbsoluteError';
  constructor(public readonly saveDir: string) {
    super(
      `browser_download: saveDir must be an absolute path; got "${saveDir}". ` +
        'Playwright Download.saveAs requires absolute paths to avoid working-dir ambiguity.',
    );
  }
}

const TRIGGER_CLICK_SCRIPT = `(s) => {
  const el = document.querySelector(s);
  if (!el || typeof el.click !== 'function') {
    throw new Error('browser_download: trigger element not found or not clickable: ' + s);
  }
  el.click();
}`;

export function createDownloadTool(
  deps: DownloadDeps,
): MCPToolDefinition<DownloadInput, DownloadOutput> {
  return {
    name: 'browser_download', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Trigger a download via a click on triggerSelector and save the resulting file to absolute saveDir. HITL-gated per R8.4 (Phase 4 SafetyCheck requires human approval).',
    inputSchema: DownloadInputSchema,
    outputSchema: DownloadOutputSchema,
    safetyClass: 'requires_hitl',
    handler: async (input, ctx: ToolContext): Promise<DownloadOutput> => {
      if (!isAbsolute(input.saveDir)) {
        ctx.logger.warn(
          { save_dir: input.saveDir },
          'mcp.tool.download.save_dir_not_absolute',
        );
        throw new DownloadSaveDirNotAbsoluteError(input.saveDir);
      }

      ctx.logger.info(
        { trigger_selector: input.triggerSelector, save_dir: input.saveDir },
        'mcp.tool.download.start',
      );

      // 1. Register download listener BEFORE clicking — Playwright semantics
      //    require the listener be in place before the user gesture that
      //    triggers the download.
      const waitOpts: { timeout?: number } = {};
      if (input.timeout !== undefined) waitOpts.timeout = input.timeout;
      const downloadPromise = deps.session.page.waitForEvent('download', waitOpts);

      // 2. Trigger via programmatic page.evaluate click — bypasses pointer
      //    motion timing and viewport constraints. More reliable than
      //    mouseBehavior for download flows.
      await deps.session.page.evaluate<void>(TRIGGER_CLICK_SCRIPT, input.triggerSelector);

      // 3. Await the Download event
      const download = await downloadPromise;
      const filename = download.suggestedFilename();
      const targetPath = join(input.saveDir, filename);

      // 4. Save to disk
      await download.saveAs(targetPath);

      ctx.logger.info(
        { filename, target_path: targetPath },
        'mcp.tool.download.done',
      );
      return { ok: true, filename, path: targetPath };
    },
  };
}
