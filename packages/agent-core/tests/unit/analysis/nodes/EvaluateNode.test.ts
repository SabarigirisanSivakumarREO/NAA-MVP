/**
 * Unit tests for EvaluateNode — T-SKELETON-004 acceptance.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-004
 *         (acceptance: returns 2 hardcoded raw findings tagged
 *         `source: 'skeleton-stub'`; observations MUST NOT contain
 *         banned conversion-prediction phrasing per R5.3 + GR-007 —
 *         static-check unit test enforces).
 *
 * Coverage:
 *   - Positive: run() returns exactly 2 findings against non-empty heuristics
 *   - Shape: each finding has the expected RawFinding fields
 *   - Source tag: every finding tagged `source: 'skeleton-stub'`
 *   - heuristic_id linkage: ids match the SKELETON-* fixture set
 *   - page_url propagation: derived from perception.metadata.url
 *   - **R5.3 + GR-007 banned-phrase static-check (CRITICAL)**: every
 *     observation MUST NOT match any pattern in the representative
 *     banned-phrase regex pack. Phase 7 T123 (week 7) ships canonical
 *     GR-007 grounding rule with full regex coverage.
 *   - Defensive: empty heuristics array → returns []
 *   - Idempotence: two consecutive calls return structurally identical
 *     findings (deterministic stub per roadmap §3 conventions)
 */
import { describe, it, expect } from 'vitest';
import { EvaluateNode } from '../../../../src/analysis/nodes/EvaluateNode.js';
import { type PageStateModel } from '../../../../src/perception/types.js';
import { type HeuristicExtended } from '../../../../src/analysis/heuristics/types.js';

// ----------------------------------------------------------------------
// R5.3 + GR-007 banned-phrase regex pack (representative — Phase 7 T123
// week 7 supersedes with canonical full coverage).
// ----------------------------------------------------------------------

const BANNED_PHRASE_REGEXES: readonly RegExp[] = [
  /\b(increase|boost|lift|drive|grow|improve|raise)\w*\s+(in\s+)?(conversion|revenue|sales|signups|cart\s+adds)/i,
  /\d+\s*%\s*(lift|increase|uplift|gain)/i,
  /\bROI\s+of\s+\d+/i,
  /\buplift\b/i,
  /\bwill\s+(increase|boost|drive|raise)/i,
  /\bestimated\s+revenue\b/i,
  /\bprojected\s+(conversion|revenue|sales)\b/i,
];

// ----------------------------------------------------------------------
// Fixtures (minimal stand-ins for unit-test isolation; production paths
// load from peregrine-pdp.json + skeleton-{1,2,3}.json)
// ----------------------------------------------------------------------

const mockPeregrinePerception: PageStateModel = {
  metadata: {
    url: 'https://www.peregrineclothing.co.uk/test-fixture',
    title: 'Test Fixture',
    statusCode: 200,
    navigationStartedAt: '2026-05-05T00:00:00.000Z',
    navigationEndedAt: '2026-05-05T00:00:00.500Z',
  },
  accessibilityTree: { root: { role: 'WebArea' }, totalNodes: 1 },
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

// Minimal-shape heuristic; satisfies the typing of HeuristicExtended[]
// for input — EvaluateNode stub doesn't dereference body/benchmark/etc.
const mockHeuristics: readonly HeuristicExtended[] = [
  {
    id: 'SKELETON-CHECKOUT-001',
    body: 'TEST FIXTURE',
    category: 'checkout_friction',
    version: '0.0.1',
    rule_vs_guidance: 'rule',
    business_impact_weight: 0.8,
    effort_category: 'quick_win',
    preferred_states: ['default'],
    status: 'active',
    benchmark: { kind: 'quantitative', value: 44, unit: 'px', metric: 'min_touch' },
    provenance: {
      source_url: 'https://example.test/1',
      citation_text: 'TEST',
      draft_model: 'human',
      verified_by: 'test',
      verified_date: '2026-05-05T00:00:00Z',
    },
  },
  {
    id: 'SKELETON-CONTENT-003',
    body: 'TEST FIXTURE',
    category: 'visual_hierarchy',
    version: '0.0.1',
    rule_vs_guidance: 'guidance',
    business_impact_weight: 0.45,
    effort_category: 'incremental',
    preferred_states: ['default'],
    status: 'active',
    benchmark: { kind: 'qualitative', standard_text: 'TEST FIXTURE qualitative' },
    provenance: {
      source_url: 'https://example.test/3',
      citation_text: 'TEST',
      draft_model: 'human',
      verified_by: 'test',
      verified_date: '2026-05-05T00:00:00Z',
    },
  },
];

// ----------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------

describe('EvaluateNode (T-SKELETON-004 stub)', () => {
  it('run() returns exactly 2 findings against non-empty heuristics', async () => {
    const node = new EvaluateNode();
    const findings = await node.run(mockPeregrinePerception, mockHeuristics);

    expect(findings).toHaveLength(2);
  });

  it('every finding is tagged source="skeleton-stub" for telemetry', async () => {
    const node = new EvaluateNode();
    const findings = await node.run(mockPeregrinePerception, mockHeuristics);

    for (const finding of findings) {
      expect(finding.source).toBe('skeleton-stub');
    }
  });

  it('finding heuristic_ids match the SKELETON-* fixture set', async () => {
    const node = new EvaluateNode();
    const findings = await node.run(mockPeregrinePerception, mockHeuristics);
    const heuristicIds = findings.map((f) => f.heuristic_id);

    expect(heuristicIds).toContain('SKELETON-CHECKOUT-001');
    expect(heuristicIds).toContain('SKELETON-CONTENT-003');
  });

  it('every finding propagates page_url from perception.metadata.url', async () => {
    const node = new EvaluateNode();
    const findings = await node.run(mockPeregrinePerception, mockHeuristics);

    for (const finding of findings) {
      expect(finding.page_url).toBe(mockPeregrinePerception.metadata.url);
    }
  });

  it('R5.3 + GR-007 — every observation passes the banned-phrase static-check', async () => {
    const node = new EvaluateNode();
    const findings = await node.run(mockPeregrinePerception, mockHeuristics);

    for (const finding of findings) {
      for (const pattern of BANNED_PHRASE_REGEXES) {
        expect(
          finding.observation,
          `R5.3 violation: observation "${finding.observation}" matched ${pattern}`,
        ).not.toMatch(pattern);
      }
    }
  });

  it('every finding has a non-empty observation referencing observable data', async () => {
    const node = new EvaluateNode();
    const findings = await node.run(mockPeregrinePerception, mockHeuristics);

    for (const finding of findings) {
      expect(finding.observation.length).toBeGreaterThan(0);
      // Sanity: observations should reference pixel coordinates or sizes
      // (observable data from filteredDOM) — not generic prose.
      expect(finding.observation).toMatch(/\d+px|\(\d+,\s*\d+\)/);
    }
  });

  it('defensive — empty heuristics array returns [] (no fabricated findings)', async () => {
    const node = new EvaluateNode();
    const findings = await node.run(mockPeregrinePerception, []);

    expect(findings).toHaveLength(0);
  });

  it('run() is deterministic — two consecutive calls return structurally identical findings', async () => {
    const node = new EvaluateNode();
    const a = await node.run(mockPeregrinePerception, mockHeuristics);
    const b = await node.run(mockPeregrinePerception, mockHeuristics);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
