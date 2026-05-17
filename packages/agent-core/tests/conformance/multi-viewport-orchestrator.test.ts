/**
 * Conformance test for AC-03 (T5B-003) — MultiViewportOrchestrator.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
 *     T5B-003 — Run perception per viewport on 1 page. Both desktop+mobile
 *     perceptions stored separately. Correlation ID matches across viewports.
 *     Sequential execution (no parallel browser contexts in MVP).
 *
 * Stubs:
 *   - DeepPerceiveNode (Phase 7 deliverable) is injected as a `perceive`
 *     function dependency so this test can run before Phase 7 lands.
 *   - Page is an opaque `unknown` token here; the orchestrator does not
 *     introspect it.
 *
 * Anchor: @AC-03 — MultiViewportOrchestrator sequential per-viewport (5b).
 */
import { describe, expect, test, vi } from 'vitest';

import { MultiViewportOrchestrator } from '../../src/orchestration/MultiViewportOrchestrator.js';
import { ViewportConfigService } from '../../src/orchestration/ViewportConfigService.js';
import type { ViewportConfig } from '../../src/orchestration/ViewportConfigService.js';

const opaquePage = {} as unknown;

describe('AC-03 — MultiViewportOrchestrator', () => {
  test('invokes perceive once per viewport in order', async () => {
    const calls: string[] = [];
    const perceive = vi.fn(async (vp: ViewportConfig) => {
      calls.push(vp.device_type);
      return { in_fold: [], ctas: [] };
    });
    const orch = new MultiViewportOrchestrator({
      viewportConfigService: new ViewportConfigService(),
      perceive,
    });

    await orch.run({
      viewports: ['desktop', 'mobile'],
      page: opaquePage,
      correlationId: 'corr-1',
    });

    expect(perceive).toHaveBeenCalledTimes(2);
    expect(calls).toEqual(['desktop', 'mobile']);
  });

  test('stores per-viewport bundles keyed by device_type', async () => {
    const perceive = vi.fn(async (vp: ViewportConfig) => ({
      device: vp.device_type,
      width: vp.width,
    }));
    const orch = new MultiViewportOrchestrator({
      viewportConfigService: new ViewportConfigService(),
      perceive,
    });

    const result = await orch.run({
      viewports: ['desktop', 'mobile'],
      page: opaquePage,
      correlationId: 'corr-2',
    });

    expect(result.bundles).toHaveLength(2);
    expect(result.bundles[0].device_type).toBe('desktop');
    expect(result.bundles[0].bundle).toEqual({ device: 'desktop', width: 1440 });
    expect(result.bundles[1].device_type).toBe('mobile');
    expect(result.bundles[1].bundle).toEqual({ device: 'mobile', width: 375 });
  });

  test('propagates correlation_id across all viewport bundles', async () => {
    const perceive = vi.fn(async () => ({}));
    const orch = new MultiViewportOrchestrator({
      viewportConfigService: new ViewportConfigService(),
      perceive,
    });

    const result = await orch.run({
      viewports: ['desktop', 'mobile'],
      page: opaquePage,
      correlationId: 'audit-abc-123',
    });

    expect(result.correlation_id).toBe('audit-abc-123');
    for (const b of result.bundles) {
      expect(b.correlation_id).toBe('audit-abc-123');
    }
  });

  test('runs sequentially (no parallel contexts)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const perceive = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return {};
    };
    const orch = new MultiViewportOrchestrator({
      viewportConfigService: new ViewportConfigService(),
      perceive,
    });

    await orch.run({
      viewports: ['desktop', 'mobile'],
      page: opaquePage,
      correlationId: 'corr-seq',
    });

    expect(maxInFlight).toBe(1);
  });

  test('handles single-viewport audit', async () => {
    const perceive = vi.fn(async () => ({ ok: true }));
    const orch = new MultiViewportOrchestrator({
      viewportConfigService: new ViewportConfigService(),
      perceive,
    });
    const result = await orch.run({
      viewports: ['desktop'],
      page: opaquePage,
      correlationId: 'corr-single',
    });
    expect(result.bundles).toHaveLength(1);
    expect(result.bundles[0].device_type).toBe('desktop');
  });
});
