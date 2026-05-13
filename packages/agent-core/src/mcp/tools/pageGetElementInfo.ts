/**
 * T044 page_get_element_info — Phase 2 Wave 12 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T044 (line 256-262);
 *         phases/phase-2-tools/spec.md AC-07 (line 199);
 *         phases/phase-2-tools/impact.md MCPToolRegistry (safetyClass='safe');
 *         REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createPageGetElementInfoTool({ session })
 * closes over BrowserSession + returns MCPToolDefinition. Handler executes a
 * SINGLE session.page.evaluate (R4.1 discipline) reading
 * getBoundingClientRect + getComputedStyle + WCAG luminance contrast for the
 * target selector. No Phase 1 surface extension needed.
 *
 * R9 boundary: no `playwright` import. R10.1: ≤150 LOC; named exports only.
 *
 * WCAG contrast: relativeLuminance(rgb) = 0.2126*f(R/255)+0.7152*f(G/255)+
 *   0.0722*f(B/255), f(c)=c<=0.03928?c/12.92:((c+0.055)/1.055)^2.4. Ratio =
 *   (L_lighter+0.05)/(L_darker+0.05). Null when rgba parsing fails (e.g.,
 *   `transparent` background).
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const PageGetElementInfoInputSchema = z
  .object({
    selector: z.string().min(1),
  })
  .strict();

const BoundingBoxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .strict();

const ComputedStylesSchema = z
  .object({
    color: z.string(),
    backgroundColor: z.string(),
    fontSize: z.string(),
    fontWeight: z.string(),
    display: z.string(),
    visibility: z.string(),
    opacity: z.string(),
  })
  .strict();

export const PageGetElementInfoOutputSchema = z
  .object({
    ok: z.literal(true),
    boundingBox: BoundingBoxSchema,
    isAboveFold: z.boolean(),
    computedStyles: ComputedStylesSchema,
    contrastRatio: z.number().nullable(),
  })
  .strict();

export type PageGetElementInfoInput = z.infer<typeof PageGetElementInfoInputSchema>;
export type PageGetElementInfoOutput = z.infer<typeof PageGetElementInfoOutputSchema>;
export type PageGetElementInfoBoundingBox = z.infer<typeof BoundingBoxSchema>;
export type PageGetElementInfoComputedStyles = z.infer<typeof ComputedStylesSchema>;

export interface PageGetElementInfoDeps {
  readonly session: BrowserSession;
}

/**
 * Typed error thrown when the selector does not match any element. Phase 4
 * SafetyCheck / orchestrator may map this to a user-facing error envelope.
 */
export class ElementNotFoundError extends Error {
  public override readonly name = 'ElementNotFoundError';
  constructor(public readonly selector: string) {
    super(`page_get_element_info: selector "${selector}" did not match any element.`);
  }
}

/**
 * Page-context script. Returns null when selector unmatched (handler throws
 * ElementNotFoundError). Single-pass: querySelector + getBoundingClientRect +
 * getComputedStyle + WCAG luminance.
 */
const ELEMENT_INFO_SCRIPT = `(selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  function parseRgb(s) {
    const m = String(s).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return null;
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  }
  function lum(rgb) {
    const f = (c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  const fg = parseRgb(cs.color);
  const bg = parseRgb(cs.backgroundColor);
  let contrastRatio = null;
  if (fg && bg) {
    const Lfg = lum(fg);
    const Lbg = lum(bg);
    const lighter = Math.max(Lfg, Lbg);
    const darker = Math.min(Lfg, Lbg);
    contrastRatio = (lighter + 0.05) / (darker + 0.05);
  }
  return {
    boundingBox: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    isAboveFold: rect.top < window.innerHeight,
    computedStyles: {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
    },
    contrastRatio,
  };
}`;

interface ScriptResult {
  boundingBox: PageGetElementInfoBoundingBox;
  isAboveFold: boolean;
  computedStyles: PageGetElementInfoComputedStyles;
  contrastRatio: number | null;
}

export function createPageGetElementInfoTool(
  deps: PageGetElementInfoDeps,
): MCPToolDefinition<PageGetElementInfoInput, PageGetElementInfoOutput> {
  return {
    name: 'page_get_element_info', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Read bounding box, above-fold flag, computed styles, and WCAG contrast ratio for the element matching `selector`. Single page.evaluate. Throws ElementNotFoundError if selector unmatched. contrastRatio is null when rgba parsing fails (e.g., transparent backgrounds).',
    inputSchema: PageGetElementInfoInputSchema,
    outputSchema: PageGetElementInfoOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<PageGetElementInfoOutput> => {
      ctx.logger.info({ selector: input.selector }, 'mcp.tool.page_get_element_info.start');
      const result = await deps.session.page.evaluate<ScriptResult | null>(
        ELEMENT_INFO_SCRIPT,
        input.selector,
      );
      if (result === null) {
        ctx.logger.warn(
          { selector: input.selector },
          'mcp.tool.page_get_element_info.not_found',
        );
        throw new ElementNotFoundError(input.selector);
      }
      ctx.logger.info(
        {
          selector: input.selector,
          is_above_fold: result.isAboveFold,
          contrast_ratio: result.contrastRatio,
        },
        'mcp.tool.page_get_element_info.done',
      );
      return {
        ok: true,
        boundingBox: result.boundingBox,
        isAboveFold: result.isAboveFold,
        computedStyles: result.computedStyles,
        contrastRatio: result.contrastRatio,
      };
    },
  };
}
