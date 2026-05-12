/**
 * T036 browser_extract — Phase 2 Wave 9 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T036 brief; impact.md MCPToolRegistry
 *         Utility row (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createExtractTool({ session }) closes over
 * BrowserSession + returns MCPToolDefinition that reads text/attribute values
 * from elements matching selector via session.page.evaluate (no Phase 1
 * surface extension needed — evaluate exists on BrowserPage natively).
 *
 * Modes:
 *   - 'first' (default): returns first match value, single-element array
 *   - 'all': returns all matches
 *
 * Value source:
 *   - default (no attribute): trimmed textContent
 *   - attribute='<name>': getAttribute result; null-attribute matches are
 *     omitted from the output (deliberate — Phase 5 callers want a clean
 *     non-null array)
 *
 * R9 boundary: no `playwright` import. R10: ≤120 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const ExtractInputSchema = z
  .object({
    selector: z.string().min(1),
    mode: z.enum(['first', 'all']).optional(),
    attribute: z.string().min(1).optional(),
  })
  .strict();

export const ExtractOutputSchema = z
  .object({
    ok: z.literal(true),
    values: z.array(z.string()),
    matchCount: z.number().int().nonnegative(),
  })
  .strict();

export type ExtractInput = z.infer<typeof ExtractInputSchema>;
export type ExtractOutput = z.infer<typeof ExtractOutputSchema>;

export interface ExtractDeps {
  readonly session: BrowserSession;
}

/**
 * Page-context extraction script. Takes (selector, mode, attribute) and
 * returns { values: string[], matchCount: number }. Null/empty attribute
 * values are omitted; textContent is trimmed.
 *
 * Kept as a string literal so it can be passed to page.evaluate without
 * function-reference serialization concerns.
 */
const EXTRACT_SCRIPT = `(args) => {
  const { selector, mode, attribute } = args;
  const nodes = document.querySelectorAll(selector);
  const matchCount = nodes.length;
  const elements = mode === 'all' ? Array.from(nodes) : (nodes[0] ? [nodes[0]] : []);
  const values = [];
  for (const el of elements) {
    let v;
    if (attribute) {
      v = el.getAttribute(attribute);
      if (v === null) continue;
    } else {
      v = (el.textContent || '').trim();
    }
    values.push(v);
  }
  return { values, matchCount };
}`;

interface ExtractScriptResult {
  values: string[];
  matchCount: number;
}

export function createExtractTool(
  deps: ExtractDeps,
): MCPToolDefinition<ExtractInput, ExtractOutput> {
  return {
    name: 'browser_extract', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Extract text or attribute values from elements matching selector. Mode "first" (default) returns one value; "all" returns every match. With attribute="<name>", reads getAttribute; otherwise reads trimmed textContent. Null attribute values are omitted.',
    inputSchema: ExtractInputSchema,
    outputSchema: ExtractOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<ExtractOutput> => {
      const mode = input.mode ?? 'first';
      ctx.logger.info(
        { selector: input.selector, mode, attribute: input.attribute },
        'mcp.tool.extract.start',
      );

      const args: { selector: string; mode: 'first' | 'all'; attribute?: string } = {
        selector: input.selector,
        mode,
      };
      if (input.attribute !== undefined) args.attribute = input.attribute;

      const result = await deps.session.page.evaluate<ExtractScriptResult>(
        EXTRACT_SCRIPT,
        args,
      );

      ctx.logger.info(
        {
          selector: input.selector,
          mode,
          match_count: result.matchCount,
          value_count: result.values.length,
        },
        'mcp.tool.extract.done',
      );
      return { ok: true, values: result.values, matchCount: result.matchCount };
    },
  };
}
