/**
 * T031 browser_select — Phase 2 Wave 7 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T031 brief; impact.md MCPToolRegistry
 *         Interaction row (safetyClass = 'requires_safety_check');
 *         REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createSelectTool({ session }) closes over
 * BrowserSession + returns MCPToolDefinition wrapping session.page.selectOption
 * (Wave 7 prep 405e8bf). Accepts a single value or array of values for
 * multi-select dropdowns; returns the array of values Playwright confirms
 * were actually selected.
 *
 * R9 boundary: no `playwright` import. R10: ≤100 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const SelectInputSchema = z
  .object({
    selector: z.string().min(1),
    values: z.union([z.string(), z.array(z.string()).min(1)]),
    timeout: z.number().int().positive().optional(),
  })
  .strict();

export const SelectOutputSchema = z
  .object({
    ok: z.literal(true),
    selected: z.array(z.string()),
  })
  .strict();

export type SelectInput = z.infer<typeof SelectInputSchema>;
export type SelectOutput = z.infer<typeof SelectOutputSchema>;

export interface SelectDeps {
  readonly session: BrowserSession;
}

export function createSelectTool(
  deps: SelectDeps,
): MCPToolDefinition<SelectInput, SelectOutput> {
  return {
    name: 'browser_select', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Select option(s) from a <select> element by value. Wraps page.selectOption; accepts single value or array; returns confirmed-selected values.',
    inputSchema: SelectInputSchema,
    outputSchema: SelectOutputSchema,
    safetyClass: 'requires_safety_check',
    handler: async (input, ctx: ToolContext): Promise<SelectOutput> => {
      ctx.logger.info(
        { selector: input.selector, values: input.values },
        'mcp.tool.select.start',
      );

      // exactOptionalPropertyTypes: build opts WITHOUT assigning `undefined`.
      const opts: { timeout?: number } = {};
      if (input.timeout !== undefined) opts.timeout = input.timeout;

      const selected = await deps.session.page.selectOption(
        input.selector,
        input.values,
        opts,
      );

      ctx.logger.info(
        { selector: input.selector, selected_count: selected.length },
        'mcp.tool.select.done',
      );
      // Spread to fresh array so the readonly Playwright result satisfies
      // SelectOutputSchema's mutable string[] expectation under Zod parse.
      return { ok: true, selected: [...selected] };
    },
  };
}
