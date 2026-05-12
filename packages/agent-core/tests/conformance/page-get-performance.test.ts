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
 * RED state — implementation lands at T045 (Wave 5+). The Wave 0
 *   PerformanceSchema (sub-schema of AnalyzePerception) is REAL, so we run
 *   live shape assertions on the schema NOW; per-fixture metric assertions
 *   are `it.todo` until T045.
 *
 * Anchor: @AC-08 — 4 baseline + 4 v2.3 enrichments per §07.9.1.
 */
import { describe, expect, it } from 'vitest';

import { PerformanceSchema } from '../../src/analysis/index.js';

// NOTE (R3.1): import deliberately commented out so this file compiles +
// loads cleanly until T045 lands. Uncomment when pageGetPerformance.ts exists:
// import { pageGetPerformance } from '../../src/mcp/tools/pageGetPerformance.js';

describe('page_get_performance — AC-08 conformance (Wave 0 RED)', () => {
  /**
   * @AC-08 — Wave 0 PerformanceSchema accepts a well-formed full-population
   * shape with all 4 baseline + 4 v2.3 enrichment metrics.
   */
  it('AC-08: PerformanceSchema validates 4 baseline + 4 v2.3 enrichment fields', () => {
    const result = PerformanceSchema.safeParse({
      // 4 baseline
      domContentLoaded: 1200,
      fullyLoaded: 2400,
      resourceCount: 42,
      largestContentfulPaint: 1800,
      // 4 v2.3 enrichments
      interactionToNextPaint: 80,
      cumulativeLayoutShift: 0.08,
      timeToFirstByte: 240,
      timeToFirstCtaInteractable: 1500,
      // baseline transferSize is required by the schema even though spec.md
      // AC-08 partitioning lists only 4 + 4 (the 8 partitioned ARE the
      // load-bearing metrics; totalTransferSize is a baseline housekeeping
      // field per §07.9 schema source verbatim — see analyzePerception.subschemas.ts).
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
   * @AC-08 — fixture page returns all 4 baseline metrics populated.
   */
  it.todo('AC-08: fixture page returns 4 baseline metrics populated (DCL, FL, resourceCount, LCP)');

  /**
   * @AC-08 — fixture page returns all 4 v2.3 enrichments populated (or
   * explicitly null with documented reason if metric not derivable).
   */
  it.todo(
    'AC-08: fixture page returns 4 v2.3 enrichments populated or null+reason (INP, CLS, TTFB, t1cta)',
  );

  /**
   * @AC-08 — emits Pino correlation fields per T-PHASE2-LOGGER.
   */
  it.todo('AC-08: logs tool_name + tool_call_id + client_session_id correlation fields');
});
