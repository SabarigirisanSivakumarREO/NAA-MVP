/**
 * Conformance test — AC-03 (T102) HeuristicKnowledgeBase container.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-03
 *   tasks.md T102 — HeuristicKnowledgeBase indexes by id;
 *     get(id), list(), byBusinessType(archetype), byPageType(pageType)
 *     query helpers; container shape independent of filter logic (T107).
 *
 * R3.1 TDD: this test is authored BEFORE T102 lands; the missing-module /
 * missing-method failure is the expected initial red state.
 *
 * Anchor: @AC-03 — HeuristicKnowledgeBase container.
 *
 * Scope (this file): construction + indexing + query helpers ONLY.
 * Filter business logic (Stage 1 / Stage 2) is covered by
 * filter-business-type.test.ts and filter-page-type.test.ts.
 */
import { describe, it, expect } from 'vitest';

// Planned module (T102) — relative path mirrors existing convention.
import { HeuristicKnowledgeBase } from '../../src/analysis/heuristics/kb.js';
import type { HeuristicExtended } from '../../src/analysis/heuristics/types.js';

function makeHeuristic(
  id: string,
  archetype: HeuristicExtended['archetype'],
  pageType: HeuristicExtended['page_type'],
): HeuristicExtended {
  return {
    id,
    body: 'TEST FIXTURE — not a real heuristic. NEURAL_TEST_FIXTURE_BODY.',
    category: 'test_category',
    version: '0.0.1',
    rule_vs_guidance: 'rule',
    business_impact_weight: 0.5,
    effort_category: 'quick_win',
    preferred_states: ['default'],
    status: 'active',
    benchmark: {
      kind: 'quantitative',
      value: 1,
      unit: 'px',
      metric: 'synthetic',
    },
    provenance: {
      source_url: 'https://example.test/' + id,
      citation_text: 'TEST FIXTURE',
      draft_model: 'human',
      verified_by: 'test',
      verified_date: '2026-05-17T00:00:00Z',
    },
    archetype,
    page_type: pageType,
  };
}

describe('@AC-03 HeuristicKnowledgeBase container', () => {
  const fixtures: HeuristicExtended[] = [
    makeHeuristic('BAYMARD-TEST-001', ['D2C'], ['pdp']),
    makeHeuristic('BAYMARD-TEST-002', ['D2C', 'SaaS'], ['plp']),
    makeHeuristic('NIELSEN-TEST-001', ['B2B'], ['pdp']),
    makeHeuristic('CIALDINI-TEST-001', undefined, undefined), // universal
  ];

  it('indexes by id and exposes get(id)', () => {
    const kb = new HeuristicKnowledgeBase(fixtures);
    const found = kb.get('BAYMARD-TEST-001');
    expect(found?.id).toBe('BAYMARD-TEST-001');
  });

  it('returns undefined for unknown id (not throw)', () => {
    const kb = new HeuristicKnowledgeBase(fixtures);
    expect(kb.get('NONEXISTENT-TEST-999')).toBeUndefined();
  });

  it('list() returns all heuristics', () => {
    const kb = new HeuristicKnowledgeBase(fixtures);
    expect(kb.list()).toHaveLength(4);
  });

  it('byBusinessType returns matching + universal entries', () => {
    const kb = new HeuristicKnowledgeBase(fixtures);
    const d2c = kb.byBusinessType('D2C');
    // Two D2C-tagged + universal (CIALDINI) — at minimum the D2C ones.
    expect(d2c.map((h) => h.id)).toContain('BAYMARD-TEST-001');
    expect(d2c.map((h) => h.id)).toContain('BAYMARD-TEST-002');
  });

  it('byPageType returns matching + universal entries', () => {
    const kb = new HeuristicKnowledgeBase(fixtures);
    const pdp = kb.byPageType('pdp');
    expect(pdp.map((h) => h.id)).toContain('BAYMARD-TEST-001');
    expect(pdp.map((h) => h.id)).toContain('NIELSEN-TEST-001');
  });

  it('treats universal (no manifest selectors) as applies-to-all', () => {
    const kb = new HeuristicKnowledgeBase(fixtures);
    expect(kb.byBusinessType('D2C').map((h) => h.id)).toContain('CIALDINI-TEST-001');
    expect(kb.byPageType('pdp').map((h) => h.id)).toContain('CIALDINI-TEST-001');
  });
});
