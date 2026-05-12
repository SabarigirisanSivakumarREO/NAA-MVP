/**
 * T032 browser_hover — Phase 2 Wave 8 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T032 brief; impact.md MCPToolRegistry
 *         Motion row (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002 +
 *         REQ-BROWSE-HUMAN-001/002.
 *
 * Factory pattern (locked Wave 4+): createHoverTool({ session, mouse? }) closes
 * over BrowserSession + MouseBehavior. The handler resolves the target
 * element's bounding box via page.evaluate, computes center coords, then
 * invokes mouseBehavior.move for human-shaped Bezier motion to the hover
 * position (NO click — hover is read-only pointer motion). Consumes
 * BrowserPage.mouse surface from Wave 6 prep (3bd1226).
 *
 * Closely mirrors T027 browser_click but uses mouse.move instead of mouse.click.
 *
 * R9 boundary: no `playwright` import. R10: ≤120 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import { mouseBehavior } from '../../browser-runtime/MouseBehavior.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const HoverInputSchema = z
  .object({
    selector: z.string().min(1),
    timeout: z.number().int().positive().optional(),
  })
  .strict();

export const HoverOutputSchema = z
  .object({
    ok: z.literal(true),
    x: z.number(),
    y: z.number(),
  })
  .strict();

export type HoverInput = z.infer<typeof HoverInputSchema>;
export type HoverOutput = z.infer<typeof HoverOutputSchema>;

export interface HoverDeps {
  readonly session: BrowserSession;
  /** Optional MouseBehavior override for tests. Defaults to singleton. */
  readonly mouse?: typeof mouseBehavior;
}

/**
 * Page-context script that resolves selector → bbox. Returns null if no element.
 * Kept as a string literal so it can be passed to page.evaluate without a
 * function reference (which Playwright would try to serialize).
 */
const RESOLVE_BBOX_SCRIPT = `(selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}`;

interface ResolvedBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class HoverTargetNotFoundError extends Error {
  public override readonly name = 'HoverTargetNotFoundError';
  constructor(public readonly selector: string) {
    super(
      `browser_hover: selector "${selector}" did not match any element on the active page.`,
    );
  }
}

export function createHoverTool(
  deps: HoverDeps,
): MCPToolDefinition<HoverInput, HoverOutput> {
  const mouse = deps.mouse ?? mouseBehavior;

  return {
    name: 'browser_hover', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Hover the pointer over the first element matching selector with human-shaped Bezier motion (MouseBehavior.move). Returns the center coords hovered.',
    inputSchema: HoverInputSchema,
    outputSchema: HoverOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<HoverOutput> => {
      ctx.logger.info({ selector: input.selector }, 'mcp.tool.hover.start');

      const bbox = await deps.session.page.evaluate<ResolvedBbox | null>(
        RESOLVE_BBOX_SCRIPT,
        input.selector,
      );
      if (bbox === null) {
        ctx.logger.warn(
          { selector: input.selector },
          'mcp.tool.hover.target_not_found',
        );
        throw new HoverTargetNotFoundError(input.selector);
      }

      const x = bbox.x + bbox.width / 2;
      const y = bbox.y + bbox.height / 2;
      await mouse.move(deps.session.page, { x, y });

      ctx.logger.info({ selector: input.selector, x, y }, 'mcp.tool.hover.done');
      return { ok: true, x, y };
    },
  };
}
