/**
 * AC-12 — Phase 1c integration test (REQ-ANALYZE-PERCEPTION-V25-001).
 *
 * Spec: docs/specs/mvp/phases/phase-1c-perception-bundle/{spec.md AC-12, tasks.md T1C-012}.
 *
 * v0.2 fixture matrix (5):
 *   1. homepage          — example-com.json     (Phase 1 reuse)
 *   2. PDP               — amazon-in-pdp.json   (Phase 1b reuse)
 *   3. cart              — peregrine-cart.json  (Phase 1b reuse)
 *   4. checkout          — checkout-iframe.json (NEW; same-origin payment iframe)
 *   5. SPA-trait-rich    — spa-trait-rich.json  (NEW; Optimizely + Shadow-DOM-deep + React-Portal-deep)
 *
 * Assertions: all envelope channels populated; envelope-only tokens ≤2K
 * (ENVELOPE_TOKEN_BUDGET); element graph ≤30 (ELEMENT_GRAPH_CAP); namespace
 * contract _extensions absent/empty (Phase 1b §11 carryforward); SPA-trait-rich
 * emits `optimizely_active` flag + `SHADOW_DOM_NOT_TRAVERSED` warning;
 * bundleToAnalyzePerception() returns wrapped v2.4 PageStateModel.
 *
 * Per impact.md §12: fixtures are pre-populated synthetic JSON; this test
 * exercises ENVELOPE ASSEMBLY correctness, not Phase 5 live extraction.
 * T015 + T1B-012 regression suites run separately at Stage 3.
 *
 * Env: `node`.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildPerceptionBundle,
  bundleToAnalyzePerception,
  envelopeTokenCount,
  ENVELOPE_TOKEN_BUDGET,
  type PerceptionBundle,
} from '../../src/perception/PerceptionBundle.js';
import {
  ELEMENT_GRAPH_CAP,
  type ElementGraph,
} from '../../src/perception/ElementGraphBuilder.js';
import type { Warning } from '../../src/perception/WarningEmitter.js';
import type { NondeterminismFlag } from '../../src/perception/NondeterminismDetector.js';
import type { SettleResult } from '../../src/perception/SettlePredicate.js';
import type { PageStateModel } from '../../src/perception/types.js';

interface FixtureRef {
  name: string;
  path: string;
  /** Pre-populated nondeterminism flags this fixture should emit. */
  nondeterminismFlags: NondeterminismFlag[];
  /** Pre-populated warnings this fixture should emit. */
  warnings: Warning[];
}

/**
 * AC-12 v0.2 fixture matrix. Note: nondeterminismFlags + warnings are the
 * SYNTHETIC outputs that the (deferred) Phase 5 runtime would produce for
 * each fixture — they are wired directly into buildPerceptionBundle here
 * to exercise envelope assembly independent of Phase 5 wiring.
 */
const FIXTURES: FixtureRef[] = [
  {
    name: 'homepage (example.com — Phase 1 reuse)',
    path: 'tests/fixtures/perception/example-com.json',
    nondeterminismFlags: [],
    warnings: [],
  },
  {
    name: 'PDP (amazon.in — Phase 1b reuse)',
    path: 'tests/fixtures/perception/amazon-in-pdp.json',
    nondeterminismFlags: [],
    warnings: [],
  },
  {
    name: 'cart (Peregrine — Phase 1b reuse)',
    path: 'tests/fixtures/perception/peregrine-cart.json',
    nondeterminismFlags: [],
    warnings: [],
  },
  {
    name: 'checkout (same-origin payment iframe — NEW Phase 1c fixture)',
    path: 'tests/fixtures/perception/checkout-iframe.json',
    nondeterminismFlags: [],
    warnings: [],
  },
  {
    name: 'SPA-trait-rich (Optimizely + Shadow-DOM-deep + React-Portal-deep)',
    path: 'tests/fixtures/perception/spa-trait-rich.json',
    nondeterminismFlags: ['optimizely_active'],
    warnings: [
      {
        code: 'SHADOW_DOM_NOT_TRAVERSED',
        message:
          'Shadow DOM depth-7 nested roots — traversal halted at depth 5 cap',
        severity: 'warn',
      },
    ],
  },
];

async function loadFixture(relPath: string): Promise<PageStateModel> {
  const fixturePath = resolve(__dirname, '..', '..', relPath);
  const raw = await readFile(fixturePath, 'utf8');
  return JSON.parse(raw) as PageStateModel;
}

/**
 * Minimal stub ElementGraph for envelope assembly. Synthetic per impact.md
 * §12 (envelope correctness, not live extraction). Element count = 2
 * (well under ELEMENT_GRAPH_CAP=30 — satisfies AC-12 ≤30 assertion).
 */
function makeStubElementGraph(stateId: string): ElementGraph {
  const elements = new Map<
    string,
    {
      element_id: string;
      selector: string;
      tag: string;
      text_content: string;
      attrs: Record<string, string>;
      ax: { role?: string; name?: string };
      is_interactive: boolean;
      parent_id: string | null;
      child_ids: string[];
      ref_in_analyze_perception: Record<string, number | string | undefined>;
    }
  >();
  const rootId = `${stateId}-root`;
  const childId = `${stateId}-cta`;
  elements.set(rootId, {
    element_id: rootId,
    selector: 'body',
    tag: 'body',
    text_content: '',
    attrs: {},
    ax: {},
    is_interactive: false,
    parent_id: null,
    child_ids: [childId],
    ref_in_analyze_perception: {},
  });
  elements.set(childId, {
    element_id: childId,
    selector: 'button#cta',
    tag: 'button',
    text_content: 'Action',
    attrs: { id: 'cta' },
    ax: { role: 'button', name: 'Action' },
    is_interactive: true,
    parent_id: rootId,
    child_ids: [],
    ref_in_analyze_perception: {},
  });
  return { elements, root_element_ids: [rootId], truncated_count: 0 };
}

const SETTLE_OK: SettleResult = { elapsed_ms: 1234, capped_at_5s: false };

async function buildBundleForFixture(
  fixture: FixtureRef,
): Promise<PerceptionBundle> {
  const psm = await loadFixture(fixture.path);
  const stateId = 'state-0';
  return buildPerceptionBundle({
    audit_run_id: `audit-${fixture.path}`,
    url: psm.metadata.url,
    initial_state_id: stateId,
    states: [
      {
        state_id: stateId,
        page_state_model: psm,
        full_page_screenshot_url: `r2://screens/${stateId}.jpg`,
        element_graph: makeStubElementGraph(stateId),
      },
    ],
    settle_result: SETTLE_OK,
    nondeterminism_flags: fixture.nondeterminismFlags,
    warnings: fixture.warnings,
    meta: { user_agent: 'neural-test/1.0', viewport: { width: 1280, height: 720 } },
  });
}

describe('Phase 1c integration — AC-12 (5-fixture envelope assembly)', () => {
  /** @AC-12 — buildPerceptionBundle is exported (Wave 0 gate transitioned RED→GREEN). */
  it('AC-12: buildPerceptionBundle is exported', () => {
    expect(typeof buildPerceptionBundle).toBe('function');
  });

  /** Empirical baseline for phase-1c-validation.md (verbose-only output). */
  it('AC-12: empirical envelopeTokenCount + element count per fixture', async () => {
    const rows = await Promise.all(FIXTURES.map(async (f) => {
      const b = await buildBundleForFixture(f);
      const g = b.element_graph_by_state[b.initial_state_id] as { elements: Map<string, unknown> | Record<string, unknown> };
      const count = g.elements instanceof Map ? g.elements.size : Object.keys(g.elements).length;
      return { name: f.name, tokens: envelopeTokenCount(b, b.initial_state_id), elementCount: count };
    }));
    // Stage 2.5 fix F-005-1c — gate diagnostic emission on VITEST_VERBOSE so
    // routine CI stays silent. Run with `VITEST_VERBOSE=1 pnpm test` to surface.
    if (process.env.VITEST_VERBOSE === '1') {
      // eslint-disable-next-line no-console
      console.log('AC-12 empirical metrics:', JSON.stringify(rows, null, 2));
    }
    expect(rows).toHaveLength(5);
  });

  /**
   * @AC-12 — Per-fixture: bundle builds + all channels populated + envelope
   * ≤2K + graph ≤30 + namespace contract honored.
   */
  it.each(FIXTURES)(
    'AC-12: $name — bundle builds + envelope ≤2K + graph ≤30 + namespace contract',
    async (fixture) => {
      const bundle = await buildBundleForFixture(fixture);
      const stateId = bundle.initial_state_id;

      // (1) All channels populated.
      expect(bundle.schema_version).toBe('v2.5');
      expect(bundle.meta).toBeTypeOf('object');
      expect(bundle.meta['audit_run_id']).toBeTypeOf('string');
      expect(bundle.meta['url']).toBeTypeOf('string');
      expect(bundle.meta['captured_at']).toBeTypeOf('string');
      expect(bundle.performance['settle_elapsed_ms']).toBe(SETTLE_OK.elapsed_ms);
      expect(bundle.performance['settle_capped_at_5s']).toBe(false);
      expect(Array.isArray(bundle.nondeterminism_flags)).toBe(true);
      expect(Array.isArray(bundle.warnings)).toBe(true);
      expect(bundle.state_graph.nodes).toHaveLength(1);
      expect(bundle.state_graph.edges).toEqual([]);
      expect(bundle.element_graph_by_state[stateId]).toBeDefined();
      expect(bundle.raw.analyze_perception_by_state[stateId]).toBeDefined();
      expect(bundle.raw.page_state_model_by_state[stateId]).toBeDefined();
      const screenshots = bundle.raw.full_page_screenshot_url_by_state;
      expect(screenshots?.[stateId]).toMatch(/^r2:\/\/screens\//);

      // (2) Envelope-only token count ≤2K per state (NF-01 v0.2).
      const tokens = envelopeTokenCount(bundle, stateId);
      expect(tokens).toBeLessThanOrEqual(ENVELOPE_TOKEN_BUDGET);

      // (3) ElementGraph element count ≤30 per state.
      const graph = bundle.element_graph_by_state[stateId] as { elements: Map<string, unknown> };
      const count = graph.elements instanceof Map ? graph.elements.size : Object.keys(graph.elements as Record<string, unknown>).length;
      expect(count).toBeLessThanOrEqual(ELEMENT_GRAPH_CAP);

      // (4) Namespace contract — _extensions undefined or empty (Phase 1b §11).
      const psm = bundle.raw.page_state_model_by_state[stateId] as { _extensions?: Record<string, unknown> };
      const ext = psm._extensions;
      const isAbsentOrEmpty =
        ext === undefined || (typeof ext === 'object' && Object.keys(ext).length === 0);
      expect(isAbsentOrEmpty).toBe(true);
    },
  );

  /**
   * @AC-12 — SPA-trait-rich fixture: optimizely_active flag + SHADOW_DOM_NOT_TRAVERSED
   * warning emitted simultaneously (v0.2 collapsed-fixture coverage).
   */
  it('AC-12: SPA-trait-rich emits optimizely_active flag AND SHADOW_DOM_NOT_TRAVERSED warning', async () => {
    const fixture = FIXTURES[4]; // SPA-trait-rich
    if (!fixture) throw new Error('SPA-trait-rich fixture missing from matrix');
    const bundle = await buildBundleForFixture(fixture);
    expect(bundle.nondeterminism_flags).toContain('optimizely_active');
    const codes = bundle.warnings.map((w) => w.code);
    expect(codes).toContain('SHADOW_DOM_NOT_TRAVERSED');
  });

  /**
   * @AC-12 / R-11 — bundleToAnalyzePerception accessor returns identical v2.4
   * shape on baseline fixtures (reference identity acceptable per accessor
   * contract — pure pass-through, no transformation).
   */
  it.each(FIXTURES)(
    'AC-12: $name — bundleToAnalyzePerception returns wrapped v2.4 PageStateModel',
    async (fixture) => {
      const bundle = await buildBundleForFixture(fixture);
      const stateId = bundle.initial_state_id;
      const ap = bundleToAnalyzePerception(bundle, stateId);
      expect(ap).toBe(bundle.raw.analyze_perception_by_state[stateId]);
      // Default arg path: stateId omitted → uses bundle.initial_state_id.
      const apDefault = bundleToAnalyzePerception(bundle);
      expect(apDefault).toBe(ap);
    },
  );

  /**
   * @AC-12 — Backward-compat: T015 (Phase 1) + T1B-012 (Phase 1b) integration
   * suites pass unchanged on v2.5 code via bundleToAnalyzePerception() accessor.
   * Master orchestrator re-runs those suites at Stage 3 regression — not
   * invoked here to keep scope tight.
   */
  it.todo('AC-12: T015 + T1B-012 integration suites pass on v2.5 (run by Stage 3 regression)');

  /**
   * @AC-12 / NF-03 / SC-005 — zero net new LLM calls. Asserted at infra
   * level by master orchestrator (llm_call_log diff = 0); not in-process.
   */
  it.todo('AC-12: llm_call_log row count diff = 0 (asserted by Stage 3 regression)');

  /**
   * @AC-12 / NF-04 / SC-004 — element_id stability across re-runs (asserted
   * by ElementGraphBuilder conformance test; integration assertion deferred
   * to live Phase 5 wiring).
   */
  it.todo('AC-12: element_id sets stable across re-runs on identical fixture (Phase 5 live)');
});
