/**
 * Conformance test — AC-06 (T107) filterByPageType (Stage 2 filter).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-06
 *   tasks.md T107 — Stage 2 further reduces a Stage-1 result by page-type
 *     manifest selector; universal heuristics (no selector) ALWAYS pass.
 *
 * Threshold deviation from spec.md:
 *   spec.md quotes 60-70 → 15-20 (~25-30%) for a full library. The Phase 6
 *   30-fixture library Stage-1 D2C produces ~21 entries → page-type 'pdp'
 *   filter is expected to land in proportional band [4, 12].
 *
 * R3.1 TDD: this test is authored BEFORE T107 lands. Failure is expected red.
 *
 * Anchor: @AC-06 — Stage 2 page-type filter.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { HeuristicLoader } from '../../src/analysis/heuristics/loader.js';
import { PlaintextDecryptor } from '../../src/analysis/heuristics/decryption.js';
import {
  filterByBusinessType,
  filterByPageType,
} from '../../src/analysis/heuristics/filters.js';

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'heuristics',
);

describe('@AC-06 filterByPageType (Stage 2)', () => {
  it('reduces Stage-1 D2C result to expected pdp band [4, 12]', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    const all = await loader.loadAll();
    const stage1 = filterByBusinessType(all, 'D2C');
    const stage2 = filterByPageType(stage1, 'pdp');
    expect(stage2.length).toBeGreaterThanOrEqual(4);
    expect(stage2.length).toBeLessThanOrEqual(12);
  });

  it('always includes universal heuristics (no page_type selector)', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    const all = await loader.loadAll();
    const stage1 = filterByBusinessType(all, 'D2C');
    const universals = stage1.filter((h) => !h.page_type || h.page_type.length === 0);
    const stage2 = filterByPageType(stage1, 'pdp');
    for (const u of universals) {
      expect(stage2.map((h) => h.id)).toContain(u.id);
    }
  });

  it('excludes heuristics whose page_type selector excludes filter value', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    const all = await loader.loadAll();
    const stage1 = filterByBusinessType(all, 'D2C');
    const stage2 = filterByPageType(stage1, 'pdp');
    for (const h of stage2) {
      if (h.page_type && h.page_type.length > 0) {
        expect(h.page_type).toContain('pdp');
      }
    }
  });
});
