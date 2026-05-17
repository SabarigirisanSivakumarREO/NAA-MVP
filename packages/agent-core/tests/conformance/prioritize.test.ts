/**
 * Conformance test — AC-07 (T108) prioritizeHeuristics.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-07
 *   tasks.md T108 — prioritizeHeuristics(set, cap=30) sorts by
 *     business_impact_weight DESC, tie-break by id ASC; caps the
 *     returned list at the cap; deterministic across repeated calls.
 *
 * Note: Stage-2 output with the 30-fixture library is small (≤ 30 < cap),
 *   so the cap is asserted via a synthetic 40-entry input below. Sort +
 *   determinism are asserted on the real loaded library.
 *
 * R3.1 TDD: this test is authored BEFORE T108 lands. Failure is expected red.
 *
 * Anchor: @AC-07 — prioritize sort + cap + determinism.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { HeuristicLoader } from '../../src/analysis/heuristics/loader.js';
import { PlaintextDecryptor } from '../../src/analysis/heuristics/decryption.js';
import { prioritizeHeuristics } from '../../src/analysis/heuristics/prioritize.js';
import type { HeuristicExtended } from '../../src/analysis/heuristics/types.js';

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'heuristics',
);

function synth(id: string, weight: number): HeuristicExtended {
  return {
    id,
    body: 'TEST FIXTURE — NEURAL_TEST_FIXTURE_BODY.',
    category: 'test',
    version: '0.0.1',
    rule_vs_guidance: 'rule',
    business_impact_weight: weight,
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

describe('@AC-07 prioritizeHeuristics', () => {
  it('sorts by business_impact_weight DESC, tie-break id ASC', () => {
    const input: HeuristicExtended[] = [
      synth('TEST-PACK-002', 0.5),
      synth('TEST-PACK-001', 0.5),
      synth('TEST-PACK-003', 0.9),
      synth('TEST-PACK-004', 0.1),
    ];
    const ranked = prioritizeHeuristics(input, 30);
    expect(ranked.map((h) => h.id)).toEqual([
      'TEST-PACK-003', // 0.9
      'TEST-PACK-001', // 0.5 — id ASC tie-break
      'TEST-PACK-002', // 0.5
      'TEST-PACK-004', // 0.1
    ]);
  });

  it('caps the returned list at the cap (30)', () => {
    const input: HeuristicExtended[] = Array.from({ length: 40 }, (_, i) =>
      synth(`TEST-PACK-${String(i + 1).padStart(3, '0')}`, Math.random()),
    );
    const ranked = prioritizeHeuristics(input, 30);
    expect(ranked).toHaveLength(30);
  });

  it('is deterministic across two calls on the same loaded library', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    const lib = await loader.loadAll();
    const first = prioritizeHeuristics(lib, 30);
    const second = prioritizeHeuristics(lib, 30);
    expect(first.map((h) => h.id)).toEqual(second.map((h) => h.id));
  });

  it('returns all entries when input ≤ cap (no truncation)', () => {
    const input = [synth('TEST-PACK-001', 0.3), synth('TEST-PACK-002', 0.7)];
    expect(prioritizeHeuristics(input, 30)).toHaveLength(2);
  });
});
