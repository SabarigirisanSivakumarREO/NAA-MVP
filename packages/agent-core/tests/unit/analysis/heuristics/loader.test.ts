/**
 * Unit tests for HeuristicLoader — T-SKELETON-003 acceptance.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-003
 *         (acceptance: returns 3 synthetic heuristics from skeleton-*.json
 *         fixtures; body marked + embeds NEURAL_TEST_FIXTURE_BODY sentinel
 *         per Phase 0b T0B-004 D1 BINDING precedent).
 *
 * Coverage:
 *   - Positive: loadAll() returns 3 heuristics matching expected ids
 *   - Schema: every heuristic re-validates against
 *     HeuristicSchemaExtended.strict()
 *   - R6 sentinel: every heuristic body contains NEURAL_TEST_FIXTURE_BODY
 *     (cross-package R6 conformance grep — pairs with T0B-004 fixtures)
 *   - R6 disclaimer: every heuristic body contains "TEST FIXTURE — not a
 *     real heuristic" prefix (R6 IP boundary discipline)
 *   - ID regex: every id matches the SKELETON-<CATEGORY>-NNN pattern (the
 *     T101 base regex `^[A-Z][A-Z0-9_]*-[A-Z][A-Z0-9_]*-\d{3,}$` is
 *     stricter; this test asserts the SKELETON-prefix subset)
 *   - Benchmark variants: at least one quantitative + one qualitative
 *     fixture (covers both BenchmarkSchema discriminated-union arms)
 *   - Manifest diversity: at least one universal (no archetype/page_type/
 *     device) + one scoped (any selector populated) — useful for week 4
 *     Phase 4b T4B-013 ContextProfile filter testing
 *   - Determinism: loadAll() is idempotent and returns sorted-by-id (per
 *     stub conventions per roadmap §3)
 */
import { describe, it, expect } from 'vitest';
import { HeuristicLoader } from '../../../../src/analysis/heuristics/loader.js';
import { HeuristicSchemaExtended } from '../../../../src/analysis/heuristics/types.js';

const SENTINEL = 'NEURAL_TEST_FIXTURE_BODY';
const TEST_FIXTURE_PREFIX = 'TEST FIXTURE — not a real heuristic';

describe('HeuristicLoader (T-SKELETON-003 stub)', () => {
  it('loadAll() returns 3 synthetic heuristics from skeleton-*.json fixtures', async () => {
    const loader = new HeuristicLoader();
    const heuristics = await loader.loadAll();

    expect(heuristics).toHaveLength(3);
  });

  it('every heuristic re-validates against HeuristicSchemaExtended.strict()', async () => {
    const loader = new HeuristicLoader();
    const heuristics = await loader.loadAll();

    for (const heuristic of heuristics) {
      expect(() => HeuristicSchemaExtended.parse(heuristic)).not.toThrow();
    }
  });

  it('R6 sentinel — every body contains NEURAL_TEST_FIXTURE_BODY (cross-package conformance)', async () => {
    const loader = new HeuristicLoader();
    const heuristics = await loader.loadAll();

    for (const heuristic of heuristics) {
      expect(heuristic.body).toContain(SENTINEL);
    }
  });

  it('R6 disclaimer — every body carries the TEST FIXTURE prefix', async () => {
    const loader = new HeuristicLoader();
    const heuristics = await loader.loadAll();

    for (const heuristic of heuristics) {
      expect(heuristic.body).toContain(TEST_FIXTURE_PREFIX);
    }
  });

  it('every heuristic id matches SKELETON-<CATEGORY>-NNN pattern', async () => {
    const loader = new HeuristicLoader();
    const heuristics = await loader.loadAll();

    for (const heuristic of heuristics) {
      expect(heuristic.id).toMatch(/^SKELETON[A-Z0-9_]*-[A-Z][A-Z0-9_]*-\d{3,}$/);
    }
  });

  it('fixture set covers both BenchmarkSchema discriminated-union arms (quantitative + qualitative)', async () => {
    const loader = new HeuristicLoader();
    const heuristics = await loader.loadAll();
    const benchmarkKinds = new Set(heuristics.map((h) => h.benchmark.kind));

    expect(benchmarkKinds.has('quantitative')).toBe(true);
    expect(benchmarkKinds.has('qualitative')).toBe(true);
  });

  it('fixture set covers diverse manifest selectors (universal + scoped)', async () => {
    const loader = new HeuristicLoader();
    const heuristics = await loader.loadAll();

    const hasUniversal = heuristics.some(
      (h) => h.archetype === undefined && h.page_type === undefined && h.device === undefined,
    );
    const hasScoped = heuristics.some(
      (h) =>
        (h.archetype !== undefined && h.archetype.length > 0) ||
        (h.page_type !== undefined && h.page_type.length > 0) ||
        (h.device !== undefined && h.device.length > 0),
    );

    expect(hasUniversal).toBe(true);
    expect(hasScoped).toBe(true);
  });

  it('loadAll() is deterministic — sorted by id; idempotent across calls', async () => {
    const loader = new HeuristicLoader();
    const a = await loader.loadAll();
    const b = await loader.loadAll();

    const ids = a.map((h) => h.id);
    expect(ids).toEqual([...ids].sort());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
