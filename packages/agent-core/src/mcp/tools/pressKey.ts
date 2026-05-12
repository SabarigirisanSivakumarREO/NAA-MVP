/**
 * T033 browser_press_key — Phase 2 Wave 8 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T033 brief; impact.md MCPToolRegistry
 *         Interaction row (safetyClass = 'requires_safety_check'); REQ-MCP-001
 *         + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createPressKeyTool({ session }) closes over
 * BrowserSession + returns MCPToolDefinition wrapping session.page.keyboard.press
 * (Wave 7 prep 405e8bf). Accepts Playwright key syntax (e.g., 'Enter',
 * 'ArrowDown', 'Shift+A', 'Meta+v').
 *
 * R9 boundary: no `playwright` import. R10: ≤100 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const PressKeyInputSchema = z
  .object({
    key: z.string().min(1),
    delay: z.number().int().nonnegative().optional(),
  })
  .strict();

export const PressKeyOutputSchema = z
  .object({
    ok: z.literal(true),
    key: z.string(),
  })
  .strict();

export type PressKeyInput = z.infer<typeof PressKeyInputSchema>;
export type PressKeyOutput = z.infer<typeof PressKeyOutputSchema>;

export interface PressKeyDeps {
  readonly session: BrowserSession;
}

export function createPressKeyTool(
  deps: PressKeyDeps,
): MCPToolDefinition<PressKeyInput, PressKeyOutput> {
  return {
    name: 'browser_press_key', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Press a keyboard key (Playwright key syntax — e.g., Enter, ArrowDown, Shift+A, Meta+v). Wraps session.page.keyboard.press with optional delay.',
    inputSchema: PressKeyInputSchema,
    outputSchema: PressKeyOutputSchema,
    safetyClass: 'requires_safety_check',
    handler: async (input, ctx: ToolContext): Promise<PressKeyOutput> => {
      ctx.logger.info({ key: input.key }, 'mcp.tool.press_key.start');

      // exactOptionalPropertyTypes: build opts WITHOUT assigning undefined.
      const opts: { delay?: number } = {};
      if (input.delay !== undefined) opts.delay = input.delay;

      await deps.session.page.keyboard.press(input.key, opts);

      ctx.logger.info({ key: input.key }, 'mcp.tool.press_key.done');
      return { ok: true, key: input.key };
    },
  };
}
