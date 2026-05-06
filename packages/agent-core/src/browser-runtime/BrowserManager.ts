/**
 * BrowserManager — placeholder for T-SKELETON-001 orchestrator scaffolding.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 T-SKELETON-002.
 *
 * Status: minimal placeholder — returns the smallest PageStateModel that
 * satisfies T014 .strict() schema. T-SKELETON-002 enriches to load
 * `packages/agent-core/tests/fixtures/perception/peregrine-pdp.json` per
 * the synthetic-Peregrine-PDP fixture plan.
 *
 * Phase 1 (T006-T013) supersedes with real Playwright capture in week 2.
 *
 * Determinism (R10/NF-006 stub conventions per roadmap §3): no Math.random,
 * no Date.now in capture body — timestamps are hardcoded ISO-8601 strings
 * matching the Zod regex.
 *
 * R10 compliance: file ≤ 50 lines (function ≤ 50 lines).
 */
// TODO(T-SKELETON-002): replace empty defaults with synthetic Peregrine PDP
// fixture loaded from packages/agent-core/tests/fixtures/perception/peregrine-pdp.json.
import { type PageStateModel } from '../perception/types.js';

const PLACEHOLDER_TIMESTAMP = '2026-05-06T00:00:00.000Z';

export class BrowserManager {
  async capture(url: string): Promise<PageStateModel> {
    return {
      metadata: {
        url,
        title: '',
        statusCode: 200,
        navigationStartedAt: PLACEHOLDER_TIMESTAMP,
        navigationEndedAt: PLACEHOLDER_TIMESTAMP,
      },
      accessibilityTree: {
        root: { role: 'WebArea' },
        totalNodes: 1,
      },
      filteredDOM: { top30: [] },
      interactiveGraph: { clickable: [], typeable: [], submittable: [] },
      diagnostics: {
        axNodeCount: 1,
        mutationsObserved: 0,
        stable: true,
        lowAxNodeCount: false,
        unstable: false,
        errors: [],
        warnings: [],
      },
    };
  }
}
