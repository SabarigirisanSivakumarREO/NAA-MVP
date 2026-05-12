/**
 * T027 browser_click — Phase 2 Wave 6 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T027 brief ("Uses MouseBehavior; element-
 *         target version"); impact.md MCPToolRegistry Interaction row
 *         (safetyClass = 'requires_safety_check'); REQ-MCP-001 + REQ-MCP-002 +
 *         REQ-BROWSE-HUMAN-001/002.
 *
 * Factory pattern (locked Wave 4+): createClickTool({ session, mouse? }) closes
 * over BrowserSession + MouseBehavior. The handler resolves the target
 * element's bounding box via page.evaluate(selector), computes the center
 * coords, then invokes mouseBehavior.click for human-shaped motion. Consumes
 * BrowserPage.mouse surface from Wave 6 prep (3bd1226).
 *
 * Why bbox-then-coords instead of page.click(selector): R-01 mandates human-
 * shaped pointer motion; page.click bypasses MouseBehavior's Bezier path
 * generator and emits a single-step jump that trips bot signals.
 *
 * R9 boundary: no `playwright` import. R10: ≤120 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import { mouseBehavior } from '../../browser-runtime/MouseBehavior.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const ClickInputSchema = z
  .object({
    selector: z.string().min(1),
    timeout: z.number().int().positive().optional(),
  })
  .strict();

export const ClickOutputSchema = z
  .object({
    ok: z.literal(true),
    x: z.number(),
    y: z.number(),
  })
  .strict();

export type ClickInput = z.infer<typeof ClickInputSchema>;
export type ClickOutput = z.infer<typeof ClickOutputSchema>;

export interface ClickDeps {
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

export class ClickTargetNotFoundError extends Error {
  public override readonly name = 'ClickTargetNotFoundError';
  constructor(public readonly selector: string) {
    super(
      `browser_click: selector "${selector}" did not match any element on the active page.`,
    );
  }
}

export function createClickTool(
  deps: ClickDeps,
): MCPToolDefinition<ClickInput, ClickOutput> {
  const mouse = deps.mouse ?? mouseBehavior;

  return {
    name: 'browser_click', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Click the first element matching selector with human-shaped pointer motion (MouseBehavior Bezier). Returns the center coords clicked.',
    inputSchema: ClickInputSchema,
    outputSchema: ClickOutputSchema,
    safetyClass: 'requires_safety_check',
    handler: async (input, ctx: ToolContext): Promise<ClickOutput> => {
      ctx.logger.info({ selector: input.selector }, 'mcp.tool.click.start');

      const bbox = await deps.session.page.evaluate<ResolvedBbox | null>(
        RESOLVE_BBOX_SCRIPT,
        input.selector,
      );
      if (bbox === null) {
        ctx.logger.warn(
          { selector: input.selector },
          'mcp.tool.click.target_not_found',
        );
        throw new ClickTargetNotFoundError(input.selector);
      }

      const x = bbox.x + bbox.width / 2;
      const y = bbox.y + bbox.height / 2;
      await mouse.click(deps.session.page, { x, y });

      ctx.logger.info({ selector: input.selector, x, y }, 'mcp.tool.click.done');
      return { ok: true, x, y };
    },
  };
}
