/**
 * T029 browser_type — Phase 2 Wave 7 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T029 brief; impact.md MCPToolRegistry
 *         Interaction row (safetyClass = 'requires_safety_check');
 *         REQ-BROWSE-HUMAN-003/004 (Gaussian typing + 1-2% typo rate).
 *
 * Factory pattern (locked Wave 4+): createTypeTool({ session, typing? }) closes
 * over BrowserSession + TypingBehavior. The handler focuses the target via
 * session.page.focus(selector) then delegates to typingBehavior.type for
 * Gaussian-delay character-by-character typing with mistype/backspace/correct
 * self-correction. Consumes BrowserPage.keyboard + BrowserPage.focus from
 * Wave 7 prep (405e8bf).
 *
 * R9 boundary: no `playwright` import. R10: ≤120 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import { typingBehavior } from '../../browser-runtime/TypingBehavior.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const TypeInputSchema = z
  .object({
    selector: z.string().min(1),
    text: z.string(),
    meanMs: z.number().int().positive().optional(),
    stdMs: z.number().int().nonnegative().optional(),
    typoRate: z.number().min(0).max(0.05).optional(),
  })
  .strict();

export const TypeOutputSchema = z
  .object({
    ok: z.literal(true),
    charCount: z.number().int().nonnegative(),
  })
  .strict();

export type TypeInput = z.infer<typeof TypeInputSchema>;
export type TypeOutput = z.infer<typeof TypeOutputSchema>;

export interface TypeDeps {
  readonly session: BrowserSession;
  /** Optional TypingBehavior override for tests. Defaults to singleton. */
  readonly typing?: typeof typingBehavior;
}

interface TypingForwardOpts {
  meanMs?: number;
  stdMs?: number;
  typoRate?: number;
  tool_name: string;
  tool_call_id: string;
  client_session_id: string;
}

export function createTypeTool(
  deps: TypeDeps,
): MCPToolDefinition<TypeInput, TypeOutput> {
  const typing = deps.typing ?? typingBehavior;

  return {
    name: 'browser_type', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Type text into the element matching selector with Gaussian inter-character delays and 1-2% typo/backspace self-correction (TypingBehavior).',
    inputSchema: TypeInputSchema,
    outputSchema: TypeOutputSchema,
    safetyClass: 'requires_safety_check',
    handler: async (input, ctx: ToolContext): Promise<TypeOutput> => {
      ctx.logger.info(
        { selector: input.selector, char_count: input.text.length },
        'mcp.tool.type.start',
      );

      // T029 pattern: focus first — TypingBehavior with a string target does
      // NOT auto-focus (TypingBehavior.ts:116-118 only focuses handle targets).
      await deps.session.page.focus(input.selector);

      // exactOptionalPropertyTypes: build the opts object WITHOUT assigning
      // `undefined` to keys; only spread keys that are actually set.
      const typingOpts: TypingForwardOpts = {
        tool_name: 'browser_type',
        tool_call_id: ctx.toolCallId,
        client_session_id: ctx.clientSessionId,
        ...(input.meanMs !== undefined ? { meanMs: input.meanMs } : {}),
        ...(input.stdMs !== undefined ? { stdMs: input.stdMs } : {}),
        ...(input.typoRate !== undefined ? { typoRate: input.typoRate } : {}),
      };

      await typing.type(deps.session.page, input.selector, input.text, typingOpts);

      ctx.logger.info(
        { selector: input.selector, char_count: input.text.length },
        'mcp.tool.type.done',
      );
      return { ok: true, charCount: input.text.length };
    },
  };
}
