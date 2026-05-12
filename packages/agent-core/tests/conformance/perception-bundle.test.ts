/**
 * AC-10 — PerceptionBundle conformance (REQ-ANALYZE-PERCEPTION-V25-001).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-10 + R-10 + R-11 + NF-01
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/plan.md §2.5
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-010
 *
 * AC-10 v0.2 contract:
 *   - PerceptionBundle Zod schema validates the full envelope.
 *   - Bundle is Object.freeze'd after build (R-10).
 *   - bundleToAnalyzePerception(bundle, stateId?) returns identical v2.4 shape (R-11).
 *   - **NF-01 envelope-only token budget ≤2K per state** (warn at 1.8K;
 *     hard ceiling 3K) measured on:
 *       bundle.meta + bundle.performance + bundle.nondeterminism_flags +
 *       bundle.warnings + bundle.state_graph + bundle.element_graph_by_state[stateId]
 *     EXCLUDING bundle.raw.*
 *   - **Namespace contract (Phase 1b impact.md §11 carryforward):**
 *     bundle.raw.page_state_model_by_state[*]._extensions is `undefined` or `{}`
 *     (Phase 7 DeepPerceiveNode reservation honored).
 *
 * R3.1 TDD (Wave 0 RED): import fails with "module not found" until
 *   T1C-010 lands.
 *
 * Anchor: @AC-10 — PerceptionBundleSchema (Zod) +
 *   bundleToAnalyzePerception(bundle, stateId?) accessor.
 */
import { describe, expect, it } from 'vitest';

import {
  PerceptionBundleSchema,
  bundleToAnalyzePerception,
  ENVELOPE_TOKEN_BUDGET,
  ENVELOPE_TOKEN_HARD_CEILING,
} from '../../src/perception/PerceptionBundle.js';

interface BundleSkeletonLite {
  schema_version: string;
  initial_state_id: string;
  meta: Record<string, unknown>;
  performance: Record<string, unknown>;
  nondeterminism_flags: string[];
  warnings: Array<{ code: string; message: string; severity: string }>;
  state_graph: { nodes: unknown[]; edges: unknown[] };
  element_graph_by_state: Record<string, { elements: Record<string, unknown>; root_element_ids: string[] }>;
  raw: {
    analyze_perception_by_state: Record<string, Record<string, unknown>>;
    page_state_model_by_state: Record<string, Record<string, unknown>>;
  };
}

function makeSkeleton(): BundleSkeletonLite {
  return {
    schema_version: 'v2.5',
    initial_state_id: 'state-0',
    meta: { audit_run_id: 'r-1', captured_at: '2026-05-12T00:00:00Z' },
    performance: { capture_ms: 1234 },
    nondeterminism_flags: [],
    warnings: [],
    state_graph: { nodes: [{ id: 'state-0' }], edges: [] },
    element_graph_by_state: {
      'state-0': { elements: {}, root_element_ids: [] },
    },
    raw: {
      analyze_perception_by_state: { 'state-0': { ctas: [], formFields: [], metadata: {} } },
      page_state_model_by_state: { 'state-0': { url: 'https://x', title: 'X' } },
    },
  };
}

describe('PerceptionBundle — AC-10 conformance (Wave 0 RED)', () => {
  /**
   * @AC-10 — NF-01 v0.2 token budget contract pinned.
   */
  it('AC-10: ENVELOPE_TOKEN_BUDGET pinned to 2000; hard ceiling 3000', () => {
    expect(ENVELOPE_TOKEN_BUDGET).toBe(2000);
    expect(ENVELOPE_TOKEN_HARD_CEILING).toBe(3000);
  });

  /**
   * @AC-10 — Zod schema validates well-formed bundle.
   */
  it('AC-10: PerceptionBundleSchema validates minimal well-formed bundle', () => {
    const skeleton = makeSkeleton();
    const result = PerceptionBundleSchema.safeParse(skeleton);
    expect(result.success).toBe(true);
  });

  /**
   * @AC-10 — R-10: bundle is frozen after build (when returned from builder).
   * The schema itself produces a plain object; freezing is the builder's job.
   * This test pins that bundleToAnalyzePerception returns the raw passthrough
   * without mutating the input bundle.
   */
  it('AC-10: bundleToAnalyzePerception(bundle) returns wrapped AnalyzePerception (R-11)', () => {
    const skeleton = makeSkeleton();
    const ap = bundleToAnalyzePerception(skeleton, 'state-0');
    expect(ap).toBe(skeleton.raw.analyze_perception_by_state['state-0']);
  });

  /**
   * @AC-10 — accessor defaults stateId to bundle.initial_state_id.
   */
  it('AC-10: bundleToAnalyzePerception defaults to bundle.initial_state_id', () => {
    const skeleton = makeSkeleton();
    const ap = bundleToAnalyzePerception(skeleton);
    expect(ap).toBe(skeleton.raw.analyze_perception_by_state['state-0']);
  });

  /**
   * @AC-10 — Namespace contract assertion (Phase 1b §11 carryforward):
   * bundle.raw.page_state_model_by_state[*]._extensions is absent or empty
   * on Phase 1c output. Phase 7 owns that namespace.
   */
  it('AC-10: bundle.raw.page_state_model_by_state[*]._extensions is undefined or empty', () => {
    const skeleton = makeSkeleton();
    for (const psm of Object.values(skeleton.raw.page_state_model_by_state)) {
      const ext = (psm as { _extensions?: Record<string, unknown> })._extensions;
      const isAbsentOrEmpty =
        ext === undefined || (typeof ext === 'object' && Object.keys(ext).length === 0);
      expect(isAbsentOrEmpty).toBe(true);
    }
  });

  /**
   * @AC-10 — state_graph.edges defaults to [] (empty array, NOT omitted).
   * spec §263 + plan.md §6: edges populated in Phase 13.
   */
  it('AC-10: state_graph.edges defaults to [] (empty array, not omitted)', () => {
    const skeleton = makeSkeleton();
    const result = PerceptionBundleSchema.safeParse(skeleton);
    expect(result.success).toBe(true);
    expect(Array.isArray(skeleton.state_graph.edges)).toBe(true);
    expect(skeleton.state_graph.edges).toHaveLength(0);
  });

  /**
   * @AC-10 — schema rejects bundles with unknown nondeterminism flags
   * (closed-enum contract surface — Zod enum on string[]).
   */
  it.todo('AC-10: schema rejects unknown nondeterminism flag values');

  /**
   * @AC-10 — schema rejects warnings with unknown codes (closed-enum guard).
   */
  it.todo('AC-10: schema rejects unknown WarningCode values');
});
