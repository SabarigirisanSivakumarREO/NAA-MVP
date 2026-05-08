/**
 * Unit tests for HeuristicSchema (base + Extended) — T101 acceptance.
 *
 * Source: docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-01 + AC-02
 *         + AC-11 partial; tasks.md T101 acceptance criteria.
 *
 * Forward-pulled to week 1 alongside the schema itself per
 * implementation-roadmap.md §6 (T101 MUST land in week 1 alongside
 * T-SKELETON-003 for contract test feasibility). The full Phase 6
 * conformance suite (T-PHASE6-TESTS + heuristic-schema-extended.test.ts
 * per spec.md AC-02) will subsume + extend these when Phase 6
 * implementation begins in week 4.
 *
 * R6 discipline: fixtures use sentinel body / benchmark / provenance
 * text strings clearly labeled as test fixtures (NOT real heuristic
 * content) — same pattern Phase 0b D1 will enforce via Zod-error
 * redaction at the loader (T106) + lint CLI (T0B-004).
 */
import { describe, it, expect } from 'vitest';
import {
  HeuristicSchemaBase,
  HeuristicSchemaExtended,
  ProvenanceSchema,
  BenchmarkSchema,
  QuantitativeBenchmarkSchema,
  QualitativeBenchmarkSchema,
  matchesSelector,
  RULE_VS_GUIDANCE_VALUES,
  EFFORT_CATEGORIES,
  STATUS_VALUES,
  PRELIMINARY_BUSINESS_ARCHETYPES,
  PRELIMINARY_PAGE_TYPES,
  PRELIMINARY_DEVICES,
  type HeuristicExtended,
} from '../../../../src/analysis/heuristics/types.js';

// ----------------------------------------------------------------------
// Fixtures (sentinel — NEURAL_TEST_FIXTURE prefix per Phase 0b D1 pattern)
// ----------------------------------------------------------------------

function makeQuantitativeFixture(): HeuristicExtended {
  return {
    id: 'BAYMARD-CHECKOUT-001',
    body: 'NEURAL_TEST_FIXTURE_BODY: checkout cta minimum touch target',
    category: 'cta',
    version: '1.0.0',
    rule_vs_guidance: 'rule',
    business_impact_weight: 0.8,
    effort_category: 'quick_win',
    preferred_states: ['default'],
    status: 'active',
    benchmark: {
      kind: 'quantitative',
      value: 44,
      unit: 'px',
      metric: 'min_touch_target_size',
    },
    provenance: {
      source_url: 'https://example.test/baymard/CHECKOUT-001',
      citation_text: 'NEURAL_TEST_FIXTURE_CITATION: source attribution placeholder',
      draft_model: 'human',
      verified_by: 'NEURAL_TEST_FIXTURE_VERIFIER',
      verified_date: '2026-05-05T12:00:00.000Z',
    },
  };
}

function makeQualitativeFixture(): HeuristicExtended {
  return {
    ...makeQuantitativeFixture(),
    id: 'NIELSEN-USABILITY-002',
    benchmark: {
      kind: 'qualitative',
      standard_text: 'NEURAL_TEST_FIXTURE_BENCHMARK: WCAG 2.1 AA placeholder',
    },
    provenance: {
      source_url: 'https://example.test/nielsen/USABILITY-002',
      citation_text: 'NEURAL_TEST_FIXTURE_CITATION: nielsen attribution placeholder',
      draft_model: 'claude-sonnet-4-5',
      verified_by: 'NEURAL_TEST_FIXTURE_VERIFIER',
      verified_date: '2026-05-05T12:00:00Z',
    },
  };
}

// ----------------------------------------------------------------------
// AC-01 — Schema parses well-formed fixtures
// ----------------------------------------------------------------------

describe('HeuristicSchemaExtended — AC-01 fixture validation', () => {
  it('parses a quantitative-benchmark fixture', () => {
    const r = HeuristicSchemaExtended.safeParse(makeQuantitativeFixture());
    expect(r.success).toBe(true);
  });

  it('parses a qualitative-benchmark fixture', () => {
    const r = HeuristicSchemaExtended.safeParse(makeQualitativeFixture());
    expect(r.success).toBe(true);
  });

  it('parses a fixture with all v0.2 manifest selectors set', () => {
    const fixture = {
      ...makeQuantitativeFixture(),
      archetype: ['D2C', 'SaaS'] as const,
      page_type: ['pdp', 'cart'] as const,
      device: ['mobile', 'desktop'] as const,
    };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(true);
  });

  it('parses a fixture with no manifest selectors (applies-to-all)', () => {
    const fixture = makeQuantitativeFixture();
    expect(fixture.archetype).toBeUndefined();
    expect(fixture.page_type).toBeUndefined();
    expect(fixture.device).toBeUndefined();
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(true);
  });

  it('HeuristicSchemaBase parses a base-only fixture', () => {
    const base = { id: 'BAYMARD-CHECKOUT-001', body: 'fixture body', category: 'cta' };
    expect(HeuristicSchemaBase.safeParse(base).success).toBe(true);
  });
});

// ----------------------------------------------------------------------
// AC-02 — R15.3 enforcement: rejects missing benchmark / provenance
// ----------------------------------------------------------------------

describe('HeuristicSchemaExtended — AC-02 R15.3 enforcement', () => {
  it('rejects a fixture missing benchmark', () => {
    const { benchmark: _benchmark, ...withoutBenchmark } = makeQuantitativeFixture();
    expect(HeuristicSchemaExtended.safeParse(withoutBenchmark).success).toBe(false);
  });

  it('rejects a fixture missing provenance', () => {
    const { provenance: _provenance, ...withoutProvenance } = makeQuantitativeFixture();
    expect(HeuristicSchemaExtended.safeParse(withoutProvenance).success).toBe(false);
  });

  it('rejects a provenance block missing source_url', () => {
    const fixture = makeQuantitativeFixture();
    const { source_url: _url, ...incomplete } = fixture.provenance;
    expect(ProvenanceSchema.safeParse(incomplete).success).toBe(false);
  });

  it('rejects a provenance block missing verified_date', () => {
    const fixture = makeQuantitativeFixture();
    const { verified_date: _vd, ...incomplete } = fixture.provenance;
    expect(ProvenanceSchema.safeParse(incomplete).success).toBe(false);
  });

  it('rejects extra fields on provenance (.strict)', () => {
    const fixture = makeQuantitativeFixture();
    const polluted = { ...fixture.provenance, extra_field: 'not-allowed' };
    expect(ProvenanceSchema.safeParse(polluted).success).toBe(false);
  });
});

// ----------------------------------------------------------------------
// R15.3.1 — provenance field shapes
// ----------------------------------------------------------------------

describe('ProvenanceSchema — R15.3.1 field shapes', () => {
  it('accepts draft_model "human" literal', () => {
    const fixture = makeQuantitativeFixture();
    const r = ProvenanceSchema.safeParse({ ...fixture.provenance, draft_model: 'human' });
    expect(r.success).toBe(true);
  });

  it('accepts draft_model with claude- prefix', () => {
    const fixture = makeQuantitativeFixture();
    const r = ProvenanceSchema.safeParse({
      ...fixture.provenance,
      draft_model: 'claude-sonnet-4-5',
    });
    expect(r.success).toBe(true);
  });

  it('accepts draft_model with gpt- prefix', () => {
    const fixture = makeQuantitativeFixture();
    const r = ProvenanceSchema.safeParse({ ...fixture.provenance, draft_model: 'gpt-4o' });
    expect(r.success).toBe(true);
  });

  it('rejects draft_model with arbitrary string (not human, not LLM-prefixed)', () => {
    const fixture = makeQuantitativeFixture();
    const r = ProvenanceSchema.safeParse({
      ...fixture.provenance,
      draft_model: 'random-author',
    });
    expect(r.success).toBe(false);
  });

  it('accepts verified_date with milliseconds + Z (ISO-8601)', () => {
    const fixture = makeQuantitativeFixture();
    expect(
      ProvenanceSchema.safeParse({
        ...fixture.provenance,
        verified_date: '2026-05-05T12:34:56.789Z',
      }).success,
    ).toBe(true);
  });

  it('accepts verified_date with timezone offset (ISO-8601)', () => {
    const fixture = makeQuantitativeFixture();
    expect(
      ProvenanceSchema.safeParse({
        ...fixture.provenance,
        verified_date: '2026-05-05T18:00:00+05:30',
      }).success,
    ).toBe(true);
  });

  it('rejects verified_date in non-ISO format', () => {
    const fixture = makeQuantitativeFixture();
    expect(
      ProvenanceSchema.safeParse({ ...fixture.provenance, verified_date: '2026-05-05' })
        .success,
    ).toBe(false);
  });
});

// ----------------------------------------------------------------------
// BenchmarkSchema — discriminated union mechanics
// ----------------------------------------------------------------------

describe('BenchmarkSchema — discriminated union', () => {
  it('accepts a quantitative variant', () => {
    const r = BenchmarkSchema.safeParse({
      kind: 'quantitative',
      value: 100,
      unit: 'ms',
      metric: 'p95_response_time',
    });
    expect(r.success).toBe(true);
  });

  it('accepts a qualitative variant', () => {
    const r = BenchmarkSchema.safeParse({
      kind: 'qualitative',
      standard_text: 'NEURAL_TEST_FIXTURE_BENCHMARK: standard ref',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a mixed fixture (quantitative kind with qualitative-only fields)', () => {
    const r = BenchmarkSchema.safeParse({
      kind: 'quantitative',
      standard_text: 'should not be here',
    });
    expect(r.success).toBe(false);
  });

  it('rejects a fixture without a kind discriminator', () => {
    const r = BenchmarkSchema.safeParse({ value: 1, unit: 'px', metric: 'foo' });
    expect(r.success).toBe(false);
  });

  it('QuantitativeBenchmarkSchema rejects unknown fields (.strict)', () => {
    const r = QuantitativeBenchmarkSchema.safeParse({
      kind: 'quantitative',
      value: 1,
      unit: 'px',
      metric: 'foo',
      extra: 'nope',
    });
    expect(r.success).toBe(false);
  });

  it('QualitativeBenchmarkSchema rejects empty standard_text', () => {
    const r = QualitativeBenchmarkSchema.safeParse({ kind: 'qualitative', standard_text: '' });
    expect(r.success).toBe(false);
  });
});

// ----------------------------------------------------------------------
// AC-11 partial — manifest selector behavior
// ----------------------------------------------------------------------

describe('Manifest selectors — AC-11 partial', () => {
  it('matchesSelector returns true when selector is undefined', () => {
    expect(matchesSelector(undefined, 'D2C')).toBe(true);
  });

  it('matchesSelector returns true when selector is empty array', () => {
    expect(matchesSelector([], 'D2C')).toBe(true);
  });

  it('matchesSelector returns true when value is in the array', () => {
    expect(matchesSelector(['D2C', 'SaaS'] as const, 'D2C')).toBe(true);
  });

  it('matchesSelector returns false when value is not in the array', () => {
    expect(matchesSelector(['D2C', 'SaaS'] as const, 'B2B')).toBe(false);
  });

  it('rejects archetype value outside preliminary enum', () => {
    const fixture = {
      ...makeQuantitativeFixture(),
      archetype: ['UNKNOWN_ARCHETYPE'],
    };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(false);
  });

  it('rejects page_type value outside preliminary enum', () => {
    const fixture = {
      ...makeQuantitativeFixture(),
      page_type: ['unknown_page'],
    };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(false);
  });

  it('rejects device value outside preliminary enum', () => {
    const fixture = {
      ...makeQuantitativeFixture(),
      device: ['watch'],
    };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(false);
  });
});

// ----------------------------------------------------------------------
// §9.10 field validation
// ----------------------------------------------------------------------

describe('§9.10 fields', () => {
  it('rejects business_impact_weight outside [0, 1]', () => {
    const fixture = { ...makeQuantitativeFixture(), business_impact_weight: 1.5 };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(false);
  });

  it('rejects unknown rule_vs_guidance values', () => {
    const fixture = { ...makeQuantitativeFixture(), rule_vs_guidance: 'opinion' };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(false);
  });

  it('rejects unknown effort_category values', () => {
    const fixture = { ...makeQuantitativeFixture(), effort_category: 'someday' };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(false);
  });

  it('rejects unknown status values', () => {
    const fixture = { ...makeQuantitativeFixture(), status: 'pending' };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(false);
  });

  it('rejects malformed version (not semver)', () => {
    const fixture = { ...makeQuantitativeFixture(), version: 'v1' };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(false);
  });

  it('exports finite enum values matching spec', () => {
    expect(RULE_VS_GUIDANCE_VALUES).toEqual(['rule', 'guidance']);
    expect(EFFORT_CATEGORIES).toEqual(['quick_win', 'strategic', 'incremental', 'deprioritized']);
    expect(STATUS_VALUES).toEqual(['draft', 'active', 'deprecated']);
  });

  it('exports preliminary archetype + page_type + device enums', () => {
    expect(PRELIMINARY_BUSINESS_ARCHETYPES.length).toBeGreaterThanOrEqual(4);
    expect(PRELIMINARY_PAGE_TYPES).toContain('pdp');
    expect(PRELIMINARY_DEVICES).toContain('mobile');
  });
});

// ----------------------------------------------------------------------
// Schema strictness
// ----------------------------------------------------------------------

describe('.strict() enforcement', () => {
  it('HeuristicSchemaExtended rejects unknown top-level fields', () => {
    const fixture = { ...makeQuantitativeFixture(), unknown_field: 'nope' };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(false);
  });

  it('HeuristicSchemaBase rejects unknown fields', () => {
    const r = HeuristicSchemaBase.safeParse({
      id: 'BAYMARD-CHECKOUT-001',
      body: 'x',
      category: 'cta',
      extra: 'nope',
    });
    expect(r.success).toBe(false);
  });

  it('rejects malformed heuristic id (no dash structure)', () => {
    const fixture = { ...makeQuantitativeFixture(), id: 'invalid-id' };
    expect(HeuristicSchemaExtended.safeParse(fixture).success).toBe(false);
  });
});
