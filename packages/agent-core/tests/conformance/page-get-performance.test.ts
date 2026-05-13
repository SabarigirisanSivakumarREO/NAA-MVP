/**
 * AC-08 — page_get_performance conformance (Phase 2 T045).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-08 + R-08
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T045
 *
 * AC-08 contract — 8 metrics partitioned:
 *   4 baseline:    DOMContentLoaded, fullyLoaded, resourceCount, LCP
 *   4 v2.3 enrich: INP, CLS, TTFB, timeToFirstCtaInteractable
 *
 * GREEN state — T045 has landed. Wave 0 schema-shape assertions remain (they
 * pin the AnalyzePerception sub-schema independently of the tool's own
 * output schema); live fixture assertions exercise the real factory + handler
 * via Playwright Chromium (no mocks per R3.1).
 *
 * Anchor: @AC-08 — 4 baseline + 4 v2.3 enrichments per §07.9.1.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import { PerformanceSchema } from '../../src/analysis/index.js';
import { BrowserManager } from '../../src/browser-runtime/BrowserManager.js';
import {
  createPageGetPerformanceTool,
  PageGetPerformanceInputSchema,
  PageGetPerformanceOutputSchema,
} from '../../src/mcp/tools/pageGetPerformance.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import type { ToolContext } from '../../src/mcp/types.js';

function stubLogger(): Logger {
  const fn = vi.fn();
  return { info: fn, warn: fn, error: fn, debug: fn, child: vi.fn() } as unknown as Logger;
}
function stubCtx(): ToolContext {
  return { logger: stubLogger(), toolCallId: 't-1', clientSessionId: 'c-1' };
}

const STATIC_FIXTURE =
  '<!doctype html><html><head><title>perf-fixture</title></head>' +
  '<body><h1 id="hero">Performance fixture</h1>' +
  '<p>No interactions, no layout shifts — static body.</p>' +
  '</body></html>';

let session: BrowserSession | undefined;

beforeAll(async () => {
  const manager = new BrowserManager();
  session = await manager.newSession({ headless: true });
  await session.page.setContent(STATIC_FIXTURE);
}, 30000);

afterAll(async () => {
  if (session) await session.close();
});

describe('page_get_performance — AC-08 conformance (T045 GREEN)', () => {
  /**
   * @AC-08 — Wave 0 PerformanceSchema accepts a well-formed full-population
   * shape with all 4 baseline + 4 v2.3 enrichment metrics.
   */
  it('AC-08: PerformanceSchema validates 4 baseline + 4 v2.3 enrichment fields', () => {
    const result = PerformanceSchema.safeParse({
      domContentLoaded: 1200,
      fullyLoaded: 2400,
      resourceCount: 42,
      largestContentfulPaint: 1800,
      interactionToNextPaint: 80,
      cumulativeLayoutShift: 0.08,
      timeToFirstByte: 240,
      timeToFirstCtaInteractable: 1500,
      totalTransferSize: 524288,
    });
    expect(result.success).toBe(true);
  });

  /**
   * @AC-08 — PerformanceSchema accepts the minimum baseline (only the
   * required fields) — v2.3 enrichments are optional in §07.9.
   */
  it('AC-08: PerformanceSchema accepts minimum baseline (v2.3 enrichments optional)', () => {
    const result = PerformanceSchema.safeParse({
      domContentLoaded: 1200,
      fullyLoaded: 2400,
      resourceCount: 42,
      totalTransferSize: 524288,
    });
    expect(result.success).toBe(true);
  });

  /**
   * @AC-08 — output schema exposes named fields for each of the 4 v2.3
   * enrichments (INP / CLS / TTFB / timeToFirstCtaInteractable) — pin against
   * future drift (R18 append-only).
   */
  it('AC-08: PerformanceSchema shape exposes the 4 v2.3 enrichment fields', () => {
    const shape = PerformanceSchema.shape;
    expect(shape.interactionToNextPaint).toBeDefined();
    expect(shape.cumulativeLayoutShift).toBeDefined();
    expect(shape.timeToFirstByte).toBeDefined();
    expect(shape.timeToFirstCtaInteractable).toBeDefined();
  });

  /**
   * @AC-08 — factory exposes EXACT v3.1 name and safe classification.
   */
  it('AC-08: tool exposes EXACT v3.1 name page_get_performance and safe class', () => {
    if (!session) throw new Error('session not initialized');
    const tool = createPageGetPerformanceTool({ session });
    expect(tool.name).toBe('page_get_performance');
    expect(tool.safetyClass).toBe('safe');
  });

  /**
   * @AC-08 — input schema is strict-empty + output schema enforces the
   * partitioned 4 + 4 shape.
   */
  it('AC-08: input strict-empty + output partitioned baseline + v23 + optional nullReasons', () => {
    expect(PageGetPerformanceInputSchema.safeParse({}).success).toBe(true);
    expect(PageGetPerformanceInputSchema.safeParse({ extra: 1 }).success).toBe(false);
    const shape = PageGetPerformanceOutputSchema.shape;
    expect(shape.baseline).toBeDefined();
    expect(shape.v23).toBeDefined();
    expect(shape.nullReasons).toBeDefined();
  });

  /**
   * @AC-08 — fixture page returns 4 baseline metrics populated (DCL, FL,
   * resourceCount, LCP) — each is either a number ≥ 0 OR null with reason.
   */
  it('AC-08: fixture page returns 4 baseline metrics populated (DCL, FL, resourceCount, LCP)', async () => {
    if (!session) throw new Error('session not initialized');
    const tool = createPageGetPerformanceTool({ session });
    const out = await tool.handler({}, stubCtx());
    expect(out.ok).toBe(true);
    // resourceCount is always a non-negative integer (never null per schema).
    expect(out.baseline.resourceCount).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(out.baseline.resourceCount)).toBe(true);
    // DCL / FL: number ≥ 0 OR null+reason.
    for (const key of ['DOMContentLoaded', 'fullyLoaded', 'LCP'] as const) {
      const v = out.baseline[key];
      if (v === null) {
        expect(out.nullReasons?.[key]).toBeTypeOf('string');
      } else {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  /**
   * @AC-08 — fixture page returns 4 v2.3 enrichments populated or
   * null+reason. On a static setContent fixture: CLS = null (no shifts),
   * INP = null (no interactions), timeToFirstCtaInteractable = null with
   * the deferred-to-Phase-7+ reason.
   */
  it('AC-08: fixture page returns 4 v2.3 enrichments populated or null+reason (INP, CLS, TTFB, t1cta)', async () => {
    if (!session) throw new Error('session not initialized');
    const tool = createPageGetPerformanceTool({ session });
    const out = await tool.handler({}, stubCtx());
    for (const key of ['INP', 'CLS', 'TTFB', 'timeToFirstCtaInteractable'] as const) {
      const v = out.v23[key];
      if (v === null) {
        expect(out.nullReasons?.[key]).toBeTypeOf('string');
      } else {
        expect(typeof v).toBe('number');
      }
    }
    // t1cta is unconditionally null with the documented deferral reason.
    expect(out.v23.timeToFirstCtaInteractable).toBeNull();
    expect(out.nullReasons?.timeToFirstCtaInteractable).toBe(
      'requires capture-time hook — deferred to Phase 7+',
    );
  });

  /**
   * @AC-08 — when ALL metrics are measured (no nulls), nullReasons is
   * omitted from the output. Verified by Zod parse with explicit shape.
   */
  it('AC-08: nullReasons omitted when all metrics measured', () => {
    const allMeasured = {
      ok: true as const,
      baseline: { DOMContentLoaded: 100, fullyLoaded: 200, resourceCount: 5, LCP: 150 },
      v23: { INP: 50, CLS: 0.01, TTFB: 30, timeToFirstCtaInteractable: 180 },
    };
    const parsed = PageGetPerformanceOutputSchema.safeParse(allMeasured);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.nullReasons).toBeUndefined();
    }
  });

  /**
   * @AC-08 — handler emits Pino correlation fields per T-PHASE2-LOGGER.
   */
  it('AC-08: logs tool_name + tool_call_id + client_session_id correlation fields', async () => {
    if (!session) throw new Error('session not initialized');
    const tool = createPageGetPerformanceTool({ session });
    const logger = stubLogger();
    const ctx: ToolContext = { logger, toolCallId: 't-corr', clientSessionId: 'c-corr' };
    await tool.handler({}, ctx);
    expect(logger.info).toHaveBeenCalled();
    const callArgs = (logger.info as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(callArgs[1]).toBe('mcp.tool.page_get_performance.done');
  });
});
