/**
 * T038 browser_find_by_text — Phase 2 Wave 10 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T038; impact.md MCPToolRegistry
 *         Utility row (safetyClass='safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createFindByTextTool({ session }) closes
 * over BrowserSession + returns MCPToolDefinition that walks text nodes via
 * a single session.page.evaluate. No Phase 1 surface extension needed —
 * page.evaluate exists natively on BrowserPage.
 *
 * R9 boundary: no `playwright` import. R10: ≤120 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const FindByTextInputSchema = z
  .object({
    text: z.string().min(1),
    exact: z.boolean().optional(),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();

const MatchSchema = z
  .object({
    text: z.string(),
    tagName: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    visible: z.boolean(),
  })
  .strict();

export const FindByTextOutputSchema = z
  .object({
    ok: z.literal(true),
    matches: z.array(MatchSchema),
    totalCount: z.number().int().nonnegative(),
  })
  .strict();

export type FindByTextInput = z.infer<typeof FindByTextInputSchema>;
export type FindByTextOutput = z.infer<typeof FindByTextOutputSchema>;
export type FindByTextMatch = z.infer<typeof MatchSchema>;

export interface FindByTextDeps {
  readonly session: BrowserSession;
}

/**
 * Page-context script. Walks all text nodes in document.body, matches by
 * trimmed textContent (exact equality or substring), reports the
 * parentElement's tagName + bbox. `visible` is true when bbox has nonzero
 * area (cheap proxy; full visibility test would require getComputedStyle
 * chain walks that bloat the script).
 */
const FIND_BY_TEXT_SCRIPT = `(args) => {
  const { text, exact, limit } = args;
  const target = text;
  const matches = [];
  let totalCount = 0;
  if (document.body) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const content = (node.textContent || '').trim();
      if (content.length === 0) continue;
      const isMatch = exact ? content === target : content.indexOf(target) !== -1;
      if (!isMatch) continue;
      totalCount += 1;
      if (matches.length >= limit) continue;
      const el = node.parentElement;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      matches.push({
        text: content,
        tagName: el.tagName.toLowerCase(),
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
        visible: r.width > 0 && r.height > 0,
      });
    }
  }
  return { matches, totalCount };
}`;

interface ScriptResult {
  matches: FindByTextMatch[];
  totalCount: number;
}

export function createFindByTextTool(
  deps: FindByTextDeps,
): MCPToolDefinition<FindByTextInput, FindByTextOutput> {
  return {
    name: 'browser_find_by_text', // EXACT v3.1 (R4.5)
    description:
      'Find elements containing text. Walks DOM text nodes via TreeWalker. exact=false (default) uses substring; exact=true requires trimmed equality. Returns bbox + tag for each match up to limit (default 20, max 100).',
    inputSchema: FindByTextInputSchema,
    outputSchema: FindByTextOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<FindByTextOutput> => {
      const args = {
        text: input.text,
        exact: input.exact ?? false,
        limit: input.limit ?? 20,
      };
      ctx.logger.info(
        { text: input.text, exact: args.exact, limit: args.limit },
        'mcp.tool.find_by_text.start',
      );

      const result = await deps.session.page.evaluate<ScriptResult>(
        FIND_BY_TEXT_SCRIPT,
        args,
      );

      ctx.logger.info(
        { match_count: result.matches.length, total_count: result.totalCount },
        'mcp.tool.find_by_text.done',
      );
      return { ok: true, matches: result.matches, totalCount: result.totalCount };
    },
  };
}
