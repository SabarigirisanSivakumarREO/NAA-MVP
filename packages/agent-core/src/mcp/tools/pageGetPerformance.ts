/**
 * T045 page_get_performance — Phase 2 Wave 12 page-introspection tool.
 *
 * Source: phases/phase-2-tools/tasks.md T045; spec.md AC-08 + R-08;
 *         impact.md MCPToolRegistry "Page perception" (safetyClass='safe');
 *         REQ-ANALYZE-PERCEPTION-V23-001.
 *
 * Single session.page.evaluate (R4.1) reads Performance API entries; returns
 * 8 metrics partitioned per AC-08: baseline (DOMContentLoaded, fullyLoaded,
 * resourceCount, LCP) + v2.3 (INP, CLS, TTFB, timeToFirstCtaInteractable).
 * Each null metric is documented in nullReasons. timeToFirstCtaInteractable
 * unconditionally null until Phase 7+ capture-time hook lands.
 *
 * R4.5 EXACT name; R9 no playwright import; R10 LOC; R13 no `any`.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const PageGetPerformanceInputSchema = z.object({}).strict();

const MetricValue = z.union([z.number(), z.null()]);

export const PageGetPerformanceOutputSchema = z
  .object({
    ok: z.literal(true),
    baseline: z
      .object({
        DOMContentLoaded: MetricValue,
        fullyLoaded: MetricValue,
        resourceCount: z.number().int().nonnegative(),
        LCP: MetricValue,
      })
      .strict(),
    v23: z
      .object({
        INP: MetricValue,
        CLS: MetricValue,
        TTFB: MetricValue,
        timeToFirstCtaInteractable: MetricValue,
      })
      .strict(),
    /** Populated only when one or more metrics returned null. Omitted when all measured. */
    nullReasons: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export type PageGetPerformanceInput = z.infer<typeof PageGetPerformanceInputSchema>;
export type PageGetPerformanceOutput = z.infer<typeof PageGetPerformanceOutputSchema>;

export interface PageGetPerformanceDeps {
  readonly session: BrowserSession;
}

interface RawMetricsBundle {
  readonly baseline: {
    readonly DOMContentLoaded: number | null;
    readonly fullyLoaded: number | null;
    readonly resourceCount: number;
    readonly LCP: number | null;
  };
  readonly v23: {
    readonly INP: number | null;
    readonly CLS: number | null;
    readonly TTFB: number | null;
    readonly timeToFirstCtaInteractable: number | null;
  };
  readonly nullReasons: Record<string, string>;
}

/** Single-evaluate extraction. Empty entry lists → null + reason (AC-08). */
const PERFORMANCE_SCRIPT = `(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
  const layoutShifts = performance.getEntriesByType('layout-shift');
  const events = performance.getEntriesByType('event');

  const baseline = {
    DOMContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
    fullyLoaded: nav ? nav.loadEventEnd : null,
    resourceCount: performance.getEntriesByType('resource').length,
    LCP: lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : null,
  };

  let cls = 0;
  let hasShift = false;
  for (const ls of layoutShifts) {
    if (!ls.hadRecentInput) { cls += ls.value; hasShift = true; }
  }

  const byInteraction = new Map();
  for (const e of events) {
    if (e.interactionId) {
      const cur = byInteraction.get(e.interactionId) || 0;
      byInteraction.set(e.interactionId, Math.max(cur, e.duration));
    }
  }
  const inp = byInteraction.size > 0 ? Math.max.apply(null, Array.from(byInteraction.values())) : null;

  const v23 = {
    INP: inp,
    CLS: hasShift ? cls : null,
    TTFB: nav ? nav.responseStart : null,
    timeToFirstCtaInteractable: null,
  };

  const nullReasons = {};
  if (baseline.DOMContentLoaded === null) nullReasons.DOMContentLoaded = 'navigation timing not available';
  if (baseline.fullyLoaded === null) nullReasons.fullyLoaded = 'navigation timing not available';
  if (baseline.LCP === null) nullReasons.LCP = 'no LCP entry recorded';
  if (v23.INP === null) nullReasons.INP = 'no interaction events recorded';
  if (v23.CLS === null) nullReasons.CLS = 'no layout shift entries recorded';
  if (v23.TTFB === null) nullReasons.TTFB = 'navigation timing not available';
  nullReasons.timeToFirstCtaInteractable = 'requires capture-time hook — deferred to Phase 7+';

  return { baseline, v23, nullReasons };
})()`;

export function createPageGetPerformanceTool(
  deps: PageGetPerformanceDeps,
): MCPToolDefinition<PageGetPerformanceInput, PageGetPerformanceOutput> {
  return {
    name: 'page_get_performance', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Read Performance API metrics from the active page: 4 baseline (DOMContentLoaded, fullyLoaded, resourceCount, LCP) + 4 v2.3 enrichments (INP, CLS, TTFB, timeToFirstCtaInteractable). Null fields are documented in nullReasons.',
    inputSchema: PageGetPerformanceInputSchema,
    outputSchema: PageGetPerformanceOutputSchema,
    safetyClass: 'safe',
    handler: async (_input, ctx: ToolContext): Promise<PageGetPerformanceOutput> => {
      const raw = await deps.session.page.evaluate<RawMetricsBundle>(PERFORMANCE_SCRIPT);
      const output: PageGetPerformanceOutput = {
        ok: true,
        baseline: raw.baseline,
        v23: raw.v23,
        ...(Object.keys(raw.nullReasons).length > 0 ? { nullReasons: raw.nullReasons } : {}),
      };
      ctx.logger.info(
        {
          lcp: raw.baseline.LCP,
          ttfb: raw.v23.TTFB,
          cls: raw.v23.CLS,
          inp: raw.v23.INP,
          null_count: Object.keys(raw.nullReasons).length,
        },
        'mcp.tool.page_get_performance.done',
      );
      return output;
    },
  };
}
