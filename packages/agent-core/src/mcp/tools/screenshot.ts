/**
 * T025 browser_screenshot — Phase 2 Wave 5 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T025 brief; impact.md MCPToolRegistry
 *         (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createScreenshotTool({ session }) closes
 * over BrowserSession and returns an MCPToolDefinition wrapping Phase 1's
 * existing screenshotExtractor.capture(page) surface.
 *
 * Output is Phase 1's authoritative VisualSchema — 150 KB cap + 1280 px cap
 * enforced inside the extractor. Returns the Visual struct directly (no
 * Buffer in the MCP surface; downstream consumers attach URL via Visual.url
 * after R2 upload — Phase 4).
 *
 * R9 boundary: no `playwright` import. R10: ≤100 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import { screenshotExtractor, VisualSchema, type Visual } from '../../perception/index.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const ScreenshotInputSchema = z.object({}).strict();

// Output schema is Phase 1's authoritative VisualSchema — R20 forward-compat
// identity (impact.md MCPToolRegistry row).
export const ScreenshotOutputSchema = VisualSchema;

export type ScreenshotInput = z.infer<typeof ScreenshotInputSchema>;
export type ScreenshotOutput = Visual;

export interface ScreenshotDeps {
  readonly session: BrowserSession;
}

export function createScreenshotTool(
  deps: ScreenshotDeps,
): MCPToolDefinition<ScreenshotInput, ScreenshotOutput> {
  return {
    name: 'browser_screenshot', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Capture a viewport JPEG of the current page (<=150 KB / <=1280 px width). Operates on the active MCP session.',
    inputSchema: ScreenshotInputSchema,
    outputSchema: ScreenshotOutputSchema,
    safetyClass: 'safe',
    handler: async (_input, ctx: ToolContext): Promise<ScreenshotOutput> => {
      ctx.logger.info({}, 'mcp.tool.screenshot.start');
      const visual = await screenshotExtractor.capture(deps.session.page);
      ctx.logger.info(
        { size_bytes: visual.sizeBytes, width: visual.width, height: visual.height },
        'mcp.tool.screenshot.done',
      );
      return visual;
    },
  };
}
