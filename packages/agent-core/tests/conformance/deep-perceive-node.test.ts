/**
 * AC-05 — DeepPerceiveNode (Phase 7 T117) conformance.
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-7-analysis/spec.md AC-05
 *   docs/specs/mvp/phases/phase-7-analysis/tasks.md T117
 *
 * REQ: REQ-ANALYZE-NODE-001 + REQ-ANALYZE-PERCEPTION-V23-001
 *
 * R24 compliance: bundleToAnalyzePerception is sole perception source.
 * tools.page_analyze MUST NOT be called from DeepPerceiveNode.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  DeepPerceiveNode,
  deepPerceiveNodeRun,
} from '../../src/analysis/nodes/DeepPerceiveNode.js';
import { WarningEmitter } from '../../src/perception/WarningEmitter.js';
import type { PerceptionBundle } from '../../src/perception/PerceptionBundle.js';

// ─── Fixtures ────────────────────────────────────────────────────────────

function makePerception(url = 'https://shop.example.com/product/widget'): Record<string, unknown> {
  return {
    metadata: {
      url,
      title: 'Widget',
      statusCode: 200,
      navigationStartedAt: '2026-05-18T00:00:00.000Z',
      navigationEndedAt: '2026-05-18T00:00:01.000Z',
      schemaOrg: [{ '@type': 'Product' }],
    },
    accessibilityTree: { root: { role: 'WebArea', children: [] } },
    filteredDOM: { rootNodes: [] },
    interactiveGraph: { elements: [] },
    diagnostics: {},
    ctas: [{ text: 'Buy Now' }],
    formFields: [],
  };
}

function makeBundle(url?: string): PerceptionBundle {
  const psm = makePerception(url);
  return {
    schema_version: 'v2.5',
    initial_state_id: 'state-0',
    meta: { audit_run_id: 'r-1', url: psm.metadata && (psm.metadata as { url: string }).url, captured_at: '2026-05-18T00:00:00Z' },
    performance: { settle_elapsed_ms: 1200, settle_capped_at_5s: false },
    nondeterminism_flags: [],
    warnings: [],
    state_graph: { nodes: [{ id: 'state-0' }], edges: [] },
    element_graph_by_state: { 'state-0': { elements: {}, root_element_ids: [] } },
    raw: {
      analyze_perception_by_state: { 'state-0': psm },
      page_state_model_by_state: { 'state-0': psm },
      full_page_screenshot_url_by_state: {},
    },
  } as unknown as PerceptionBundle;
}

function makePageStub(): {
  waitForLoadState: ReturnType<typeof vi.fn>;
  evaluate: ReturnType<typeof vi.fn>;
  waitForSelector: ReturnType<typeof vi.fn>;
} {
  return {
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
  };
}

function makeTools(): {
  page_analyze: ReturnType<typeof vi.fn>;
  browser_screenshot: ReturnType<typeof vi.fn>;
  page_screenshot_full: ReturnType<typeof vi.fn>;
} {
  return {
    page_analyze: vi.fn().mockResolvedValue({}),
    browser_screenshot: vi.fn().mockResolvedValue({ imageBase64: 'VIEW' }),
    page_screenshot_full: vi.fn().mockResolvedValue({ imageBase64: 'FULL' }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('AC-05 DeepPerceiveNode (T117)', () => {
  it('flips isPhase7Stub to false (Phase 7 supersession marker)', () => {
    expect(DeepPerceiveNode.isPhase7Stub).toBe(false);
  });

  it('wraps bundleToAnalyzePerception accessor (R24 — no new perception logic)', async () => {
    const page = makePageStub();
    const tools = makeTools();
    const emitter = new WarningEmitter();
    const bundle = makeBundle();
    const delta = await deepPerceiveNodeRun({
      state: { urls_remaining: [], budget_remaining_usd: 10 } as never,
      page,
      tools,
      emitter,
      bundle,
    });
    expect(delta.current_page_perception_bundle).toBe(bundle);
  });

  it('does NOT call tools.page_analyze (R24)', async () => {
    const page = makePageStub();
    const tools = makeTools();
    const emitter = new WarningEmitter();
    await deepPerceiveNodeRun({
      state: { urls_remaining: [], budget_remaining_usd: 10 } as never,
      page,
      tools,
      emitter,
      bundle: makeBundle(),
    });
    expect(tools.page_analyze).not.toHaveBeenCalled();
  });

  it('calls browser_screenshot with quality=85', async () => {
    const page = makePageStub();
    const tools = makeTools();
    const emitter = new WarningEmitter();
    await deepPerceiveNodeRun({
      state: { urls_remaining: [], budget_remaining_usd: 10 } as never,
      page,
      tools,
      emitter,
      bundle: makeBundle(),
    });
    expect(tools.browser_screenshot).toHaveBeenCalledWith({ quality: 85 });
  });

  it('calls page_screenshot_full with quality=80, maxHeight=15000', async () => {
    const page = makePageStub();
    const tools = makeTools();
    const emitter = new WarningEmitter();
    await deepPerceiveNodeRun({
      state: { urls_remaining: [], budget_remaining_usd: 10 } as never,
      page,
      tools,
      emitter,
      bundle: makeBundle(),
    });
    expect(tools.page_screenshot_full).toHaveBeenCalledWith({
      quality: 80,
      maxHeight: 15000,
    });
  });

  it('populates current_page_perception_bundle + current_page_type in state delta', async () => {
    const page = makePageStub();
    const tools = makeTools();
    const emitter = new WarningEmitter();
    const bundle = makeBundle('https://shop.example.com/product/widget');
    const delta = await deepPerceiveNodeRun({
      state: { urls_remaining: [], budget_remaining_usd: 10 } as never,
      page,
      tools,
      emitter,
      bundle,
    });
    expect(delta.current_page_perception_bundle).toBeDefined();
    expect(delta.current_page_type).toBe('product');
    expect(delta.viewport_screenshot).toBe('VIEW');
    expect(delta.fullpage_screenshot).toBe('FULL');
  });

  it('uses state.context_profile.page.type when set', async () => {
    const page = makePageStub();
    const tools = makeTools();
    const emitter = new WarningEmitter();
    const state = {
      urls_remaining: [],
      budget_remaining_usd: 10,
      context_profile: { page: { type: 'checkout' } },
    } as never;
    const delta = await deepPerceiveNodeRun({
      state,
      page,
      tools,
      emitter,
      bundle: makeBundle('https://shop.example.com/product/widget'),
    });
    expect(delta.current_page_type).toBe('checkout');
  });

  it('falls back to detectPageType(perception).primary when context_profile absent', async () => {
    const page = makePageStub();
    const tools = makeTools();
    const emitter = new WarningEmitter();
    const delta = await deepPerceiveNodeRun({
      state: { urls_remaining: [], budget_remaining_usd: 10 } as never,
      page,
      tools,
      emitter,
      bundle: makeBundle('https://acme.example.com/checkout'),
    });
    expect(delta.current_page_type).toBe('checkout');
  });

  it('runs settle gate BEFORE screenshots (AC-11 preservation)', async () => {
    const order: string[] = [];
    const page = {
      waitForLoadState: vi.fn(async () => {
        order.push('settle');
      }),
      evaluate: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
    };
    const tools = {
      page_analyze: vi.fn().mockResolvedValue({}),
      browser_screenshot: vi.fn(async () => {
        order.push('viewport');
        return { imageBase64: 'V' };
      }),
      page_screenshot_full: vi.fn(async () => {
        order.push('fullpage');
        return { imageBase64: 'F' };
      }),
    };
    const emitter = new WarningEmitter();
    await deepPerceiveNodeRun({
      state: { urls_remaining: [], budget_remaining_usd: 10 } as never,
      page,
      tools,
      emitter,
      bundle: makeBundle(),
    });
    expect(order[0]).toBe('settle');
    expect(order.indexOf('settle')).toBeLessThan(order.indexOf('viewport'));
    expect(order.indexOf('settle')).toBeLessThan(order.indexOf('fullpage'));
  });

  it('propagates SETTLE_TIMEOUT_5S warning when settle.capped_at_5s', async () => {
    // Force the 5s cap by making every sub-step hang past 5s.
    const hang = (): Promise<void> => new Promise(() => {});
    const page = {
      waitForLoadState: vi.fn(hang),
      evaluate: vi.fn(hang),
      waitForSelector: vi.fn(hang),
    };
    const tools = makeTools();
    const emitter = new WarningEmitter();
    await deepPerceiveNodeRun({
      state: { urls_remaining: [], budget_remaining_usd: 10 } as never,
      page,
      tools,
      emitter,
      bundle: makeBundle(),
    });
    const codes = emitter.collect().map((w) => w.code);
    expect(codes).toContain('SETTLE_TIMEOUT_5S');
  }, 10000);
});
