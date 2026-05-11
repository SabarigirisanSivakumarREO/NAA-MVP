/**
 * Integration test for AC-12 (T1B-012 phase exit gate).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-12
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-012
 *
 * AC-12 acceptance:
 *   - Run on 5 fixture sites: 3 Phase 1 reuse (example.com homepage,
 *     amazon.in PDP, Peregrine PDP) + 2 new (Peregrine cart, Peregrine
 *     content).
 *   - All 10 Phase 1b extensions populate without error.
 *   - T1B-000 substrate populates without error on all 5.
 *   - Phase 1 integration test (T015) still passes (verified separately
 *     by re-running tests/integration/phase1.test.ts).
 *   - Walking-skeleton 7/7 still passes (verified separately).
 *   - Token budget ≤20K on every fixture (NF-Phase1-01 v0.4 unchanged).
 *   - Zero new LLM calls.
 *
 * R3.1 TDD: this test fails with "module not found" until the
 * pipeline (T1B-000..T1B-011) lands.
 *
 * Anchor: @AC-12 — 5-fixture integration; backward-compat verified.
 */
import { describe, expect, test } from 'vitest';

// These imports WILL FAIL with "module not found" until T1B-000..T1B-011
// ship. That's the R3.1 RED state.
// @ts-expect-error — pipeline module does not exist yet (Wave 6 RED)
import { runPerceptionExtensionsPipeline } from '../../src/perception/extensions/pipeline.js';
import { PageStateModelSchema } from '../../src/perception/types.js';

interface FixtureRef {
  name: string;
  path: string;
  expectedIsCommerce: boolean;
}

const FIXTURES: FixtureRef[] = [
  {
    name: 'example.com homepage (Phase 1 reuse)',
    path: 'tests/fixtures/perception/example-com.json',
    expectedIsCommerce: false,
  },
  {
    name: 'amazon.in PDP (Phase 1 reuse)',
    path: 'tests/fixtures/perception/amazon-in-pdp.json',
    expectedIsCommerce: true,
  },
  {
    name: 'Peregrine PDP (Phase 1 reuse)',
    path: 'tests/fixtures/perception/peregrine-pdp.json',
    expectedIsCommerce: true,
  },
  {
    name: 'Peregrine cart (NEW — T1B-012 authored)',
    path: 'tests/fixtures/perception/peregrine-cart.json',
    expectedIsCommerce: true,
  },
  {
    name: 'Peregrine content (NEW — T1B-012 authored)',
    path: 'tests/fixtures/perception/peregrine-content.json',
    expectedIsCommerce: false,
  },
];

describe('Phase 1b integration — AC-12 conformance (RED)', () => {
  /**
   * @AC-12 — pipeline module exists and exports the runner.
   */
  test('AC-12: perception-extensions pipeline module exists', () => {
    expect(typeof runPerceptionExtensionsPipeline).toBe('function');
  });

  /**
   * @AC-12 — each of the 5 fixtures produces an extended PageStateModel
   * that validates against the extended Zod schema.
   */
  test.each(FIXTURES)(
    'AC-12: $name produces a valid extended PageStateModel',
    async (fixture) => {
      const { readFile } = await import('node:fs/promises');
      const { resolve } = await import('node:path');
      const fixturePath = resolve(__dirname, '..', '..', fixture.path);
      const raw = await readFile(fixturePath, 'utf8');
      const parsed = JSON.parse(raw);
      const extended = await runPerceptionExtensionsPipeline(parsed);
      const result = PageStateModelSchema.safeParse(extended);
      expect(result.success).toBe(true);
    },
  );

  /**
   * @AC-12 — token budget ≤20K on every fixture (NF-Phase1-01 v0.4 cap).
   */
  test('AC-12: token budget ≤20K on every fixture (NF-Phase1-01 v0.4)', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    for (const fixture of FIXTURES) {
      const raw = await readFile(
        resolve(__dirname, '..', '..', fixture.path),
        'utf8',
      );
      const parsed = JSON.parse(raw);
      const extended = await runPerceptionExtensionsPipeline(parsed);
      const serialized = JSON.stringify(extended);
      // Rough proxy for tiktoken cl100k_base count; real test uses tiktoken.
      // 4 chars ≈ 1 token (cl100k_base average).
      const approxTokens = Math.ceil(serialized.length / 4);
      expect(approxTokens).toBeLessThanOrEqual(20_000);
    }
  });

  /**
   * @AC-12 — isCommerce expected values per fixture.
   */
  test.each(FIXTURES)(
    'AC-12: $name has expected isCommerce flag',
    async (fixture) => {
      const { readFile } = await import('node:fs/promises');
      const { resolve } = await import('node:path');
      const raw = await readFile(
        resolve(__dirname, '..', '..', fixture.path),
        'utf8',
      );
      const parsed = JSON.parse(raw);
      const extended = await runPerceptionExtensionsPipeline(parsed);
      expect(extended.commerce.isCommerce).toBe(fixture.expectedIsCommerce);
    },
  );

  /**
   * @AC-12 — every fixture populates all 10 Phase 1b extension top-level
   * groups without error.
   */
  test.each(FIXTURES)(
    'AC-12: $name populates all 10 extension groups',
    async (fixture) => {
      const { readFile } = await import('node:fs/promises');
      const { resolve } = await import('node:path');
      const raw = await readFile(
        resolve(__dirname, '..', '..', fixture.path),
        'utf8',
      );
      const parsed = JSON.parse(raw);
      const extended = await runPerceptionExtensionsPipeline(parsed);
      expect(extended).toHaveProperty('pricing');
      expect(extended).toHaveProperty('clickTargets');
      expect(extended).toHaveProperty('stickyElements');
      expect(extended).toHaveProperty('popups');
      expect(extended).toHaveProperty('frictionScore');
      expect(extended).toHaveProperty('socialProofDepth');
      expect(extended).toHaveProperty('microcopy');
      expect(extended).toHaveProperty('attention');
      expect(extended).toHaveProperty('commerce');
      expect(extended.metadata).toHaveProperty('currencySwitcher');
    },
  );
});
