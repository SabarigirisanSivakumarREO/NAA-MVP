/**
 * Conformance test — AC-09 (T109) TierValidator.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-09
 *   tasks.md T109 — TierValidator maps Heuristic.category → Tier 1/2/3:
 *     - Tier 1 = visual + structural (e.g. layout, spacing, contrast)
 *     - Tier 2 = content + persuasion (e.g. microcopy, social proof)
 *     - Tier 3 = subjective (e.g. brand tone, taste)
 *     Rejects unclassified categories with a specific error.
 *
 * R3.1 TDD: this test is authored BEFORE T109 lands. Failure is expected red.
 *
 * Anchor: @AC-09 — TierValidator tier admission.
 */
import { describe, it, expect } from 'vitest';

import { TierValidator } from '../../src/analysis/heuristics/tier-validator.js';
import type { HeuristicExtended } from '../../src/analysis/heuristics/types.js';

function fixture(id: string, category: string): HeuristicExtended {
  return {
    id,
    body: 'TEST FIXTURE — NEURAL_TEST_FIXTURE_BODY.',
    category,
    version: '0.0.1',
    rule_vs_guidance: 'rule',
    business_impact_weight: 0.5,
    effort_category: 'quick_win',
    preferred_states: ['default'],
    status: 'active',
    benchmark: { kind: 'quantitative', value: 1, unit: 'px', metric: 'synth' },
    provenance: {
      source_url: 'https://example.test/' + id,
      citation_text: 'TEST',
      draft_model: 'human',
      verified_by: 'test',
      verified_date: '2026-05-17T00:00:00Z',
    },
  };
}

describe('@AC-09 TierValidator', () => {
  const validator = new TierValidator();

  it('admits a Tier 1 (visual/structural) heuristic', () => {
    const h = fixture('BAYMARD-TEST-101', 'visual_hierarchy');
    const result = validator.classify(h);
    expect(result.tier).toBe(1);
  });

  it('admits a Tier 2 (content/persuasion) heuristic', () => {
    const h = fixture('CIALDINI-TEST-202', 'social_proof');
    const result = validator.classify(h);
    expect(result.tier).toBe(2);
  });

  it('admits a Tier 3 (subjective) heuristic', () => {
    const h = fixture('NIELSEN-TEST-303', 'brand_tone');
    const result = validator.classify(h);
    expect(result.tier).toBe(3);
  });

  it('rejects an unclassified category', () => {
    const h = fixture('UNKNOWN-TEST-999', 'utterly_made_up_category_zzz');
    expect(() => validator.classify(h)).toThrow();
  });
});
