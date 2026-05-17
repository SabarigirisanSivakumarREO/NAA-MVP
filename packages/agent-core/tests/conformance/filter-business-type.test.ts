/**
 * Conformance test — AC-05 (T107) filterByBusinessType (Stage 1 filter).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-05
 *   tasks.md T107 — Stage 1 reduces a heuristic library by business
 *     archetype manifest selector; universal heuristics (no selector)
 *     ALWAYS pass through.
 *
 * Threshold deviation from spec.md:
 *   spec.md quotes 100 → 60-70 (~70%) for a full library. The Phase 6
 *   synthetic library is 30 fixtures, so this test uses the proportional
 *   band [18, 25] (~60-83%) when filter = 'D2C'.
 *
 * R3.1 TDD: this test is authored BEFORE T107 lands. Failure is expected red.
 *
 * Anchor: @AC-05 — Stage 1 business-type filter.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { HeuristicLoader } from '../../src/analysis/heuristics/loader.js';
import { PlaintextDecryptor } from '../../src/analysis/heuristics/decryption.js';
import { filterByBusinessType } from '../../src/analysis/heuristics/filters.js';

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'heuristics',
);

describe('@AC-05 filterByBusinessType (Stage 1)', () => {
  it('reduces 30-fixture library to expected D2C band [18, 25]', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    const all = await loader.loadAll();
    const stage1 = filterByBusinessType(all, 'D2C');
    expect(stage1.length).toBeGreaterThanOrEqual(18);
    expect(stage1.length).toBeLessThanOrEqual(25);
  });

  it('always includes universal heuristics (no archetype selector)', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    const all = await loader.loadAll();
    const universals = all.filter((h) => !h.archetype || h.archetype.length === 0);
    const stage1 = filterByBusinessType(all, 'D2C');
    for (const u of universals) {
      expect(stage1.map((h) => h.id)).toContain(u.id);
    }
  });

  it('excludes heuristics whose archetype selector excludes filter value', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    const all = await loader.loadAll();
    const stage1 = filterByBusinessType(all, 'D2C');
    for (const h of stage1) {
      if (h.archetype && h.archetype.length > 0) {
        expect(h.archetype).toContain('D2C');
      }
    }
  });
});
