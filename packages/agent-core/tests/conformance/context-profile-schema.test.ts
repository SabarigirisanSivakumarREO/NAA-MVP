/**
 * Conformance test for AC-01 (T4B-001) — ContextProfile Zod schema.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-01
 *     (Acceptance Criteria table) + R-01 + R-02
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-001
 *     ("Validate fixture profile. All 5 dimensions validate. Every field is
 *      {value, source, confidence}. ContextProfile immutable after
 *      Object.freeze. SHA-256 hash function deterministic.")
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.2
 *     REQ-CONTEXT-OUT-001..003
 *
 * AC-01 scope (this file):
 *   - All 5 LOCKED dimension keys present in ContextDimensionEnum
 *   - Each LOCKED enum's `.options.length` matches the spec count
 *   - ContextProfileSchema.parse() accepts a valid full-shape fixture
 *   - .strict() rejects unknown top-level fields
 *   - Universal `{value, source, confidence}` shape enforced
 *   - Confidence range [0,1] enforced
 *
 * NOT in this file (deferred to siblings):
 *   - Object.freeze immutability (T4B-007 builder owns; tested then)
 *   - SHA-256 hash determinism (T4B-007 builder owns; tested then)
 *   - 30-URL fixture matching (T4B-002 URLPatternMatcher conformance)
 *
 * Anchor: @AC-01 — ContextProfile Zod shape lock (Phase 4b foundation).
 */
import { describe, expect, test } from 'vitest';

import {
  BusinessArchetypeEnum,
  ConfidenceThresholdActionEnum,
  ContextDimensionEnum,
  ContextProfileSchema,
  ContextSourceEnum,
  InferenceMethodEnum,
  OpenQuestionSchema,
  PageTypeEnum,
  ProvenanceEntrySchema,
  contextField,
  type ContextProfile,
} from '../../src/types/context-profile.js';
import { z } from 'zod';

/**
 * Minimal valid ContextProfile fixture. Every dimension populated with
 * universal `{value, source, confidence}` shape. Used as the AC-01
 * positive baseline.
 */
function makeValidFixture(): ContextProfile {
  const now = new Date('2026-05-15T00:00:00.000Z');
  const f = <T,>(value: T, source: 'user' | 'default' = 'user', confidence = 1) => ({
    value,
    source,
    confidence,
  });
  return {
    id: '11111111-1111-4111-8111-111111111111',
    audit_run_id: '22222222-2222-4222-8222-222222222222',
    client_id: '33333333-3333-4333-8333-333333333333',
    meta: {
      captured_at: now,
      capture_method: 'intake_form',
      user_provided_fields: ['business.archetype', 'goal.primary_kpi'],
      inferred_fields: [],
      overall_confidence: 0.92,
      threshold_action: 'act',
      perception_layer_version: '0.1.0',
    },
    business: {
      archetype: f('D2C'),
      aov_tier: f('mid'),
      cadence: f('one_time'),
      vertical: f('fashion'),
    },
    page: {
      type: f('PDP'),
      funnel_stage: f('decision'),
      job: f('convert'),
      is_indexed: f(true),
    },
    audience: {
      buyer: f('consumer'),
      awareness_level: f('product_aware', 'default', 0),
      decision_style: f('researched', 'default', 0),
      sophistication: f('medium', 'default', 0),
    },
    traffic: {
      primary_sources: f([{ channel: 'paid_social' as const, share: 0.6 }]),
      device_priority: f('mobile'),
      mobile_share: f(0.7),
      geo_primary: f('US'),
      locale_primary: f('en-US'),
    },
    brand: {
      tone: f('confident'),
      voice: f('friendly'),
      forbidden_terms: f([]),
    },
    goal: {
      primary_kpi: f('purchase'),
      secondary_kpis: f([]),
      current_baseline: f(0.025),
      target_lift: f(0.1),
      constraints: {
        regulatory: f([]),
        accessibility: f('WCAG_AA'),
        brand: f([]),
        technical: f([]),
      },
    },
    open_questions: [],
    provenance: [
      {
        dimension: 'business',
        source: 'user',
        inference_method: 'deterministic',
        confidence: 1,
        inferred_at: now,
        inferred_value: 'D2C',
      },
    ],
    profile_hash: 'a'.repeat(64),
    created_at: now,
  };
}

describe('AC-01 — ContextProfile Zod schema (T4B-001)', () => {
  /** @AC-01 5 LOCKED dimensions in ContextDimensionEnum. */
  test('AC-01: ContextDimensionEnum has exactly 5 LOCKED values', () => {
    expect(ContextDimensionEnum.options).toEqual([
      'business',
      'page',
      'audience',
      'traffic',
      'brand',
    ]);
    expect(ContextDimensionEnum.options).toHaveLength(5);
  });

  /** @AC-01 6 LOCKED sources per §37.2. */
  test('AC-01: ContextSourceEnum has exactly 6 LOCKED values', () => {
    expect(ContextSourceEnum.options).toEqual([
      'user',
      'url_pattern',
      'schema_org',
      'copy_inference',
      'layout_inference',
      'default',
    ]);
    expect(ContextSourceEnum.options).toHaveLength(6);
  });

  /** @AC-01 3 inference methods per Phase 4b brief. */
  test('AC-01: InferenceMethodEnum has exactly 3 values', () => {
    expect(InferenceMethodEnum.options).toEqual([
      'deterministic',
      'heuristic',
      'llm_judge',
    ]);
  });

  /** @AC-01 6 LOCKED archetypes per AC-05 + §Out-of-Scope act-007 closure. */
  test('AC-01: BusinessArchetypeEnum has exactly 6 LOCKED values', () => {
    expect(BusinessArchetypeEnum.options).toEqual([
      'D2C',
      'B2B',
      'SaaS',
      'marketplace',
      'lead_gen',
      'service',
    ]);
    expect(BusinessArchetypeEnum.options).toHaveLength(6);
  });

  /** @AC-01 12 LOCKED page types per §37.1.2. */
  test('AC-01: PageTypeEnum has exactly 12 LOCKED values', () => {
    expect(PageTypeEnum.options).toHaveLength(12);
    expect(PageTypeEnum.options).toContain('home');
    expect(PageTypeEnum.options).toContain('PDP');
    expect(PageTypeEnum.options).toContain('checkout');
    expect(PageTypeEnum.options).toContain('comparison');
  });

  /** @AC-01 3 threshold actions per REQ-CONTEXT-OUT-001. */
  test('AC-01: ConfidenceThresholdActionEnum has 3 gates', () => {
    expect(ConfidenceThresholdActionEnum.options).toEqual([
      'act',
      'use_and_flag',
      'ask',
    ]);
  });

  /** @AC-01 Universal `{value, source, confidence}` shape. */
  test('AC-01: contextField factory enforces universal shape', () => {
    const schema = contextField(z.string());
    expect(() => schema.parse({ value: 'x', source: 'user', confidence: 1 })).not.toThrow();
    // confidence out of [0,1] range rejected
    expect(() => schema.parse({ value: 'x', source: 'user', confidence: 1.1 })).toThrow();
    expect(() => schema.parse({ value: 'x', source: 'user', confidence: -0.1 })).toThrow();
    // unknown source rejected
    expect(() => schema.parse({ value: 'x', source: 'invented', confidence: 0.5 })).toThrow();
    // missing source rejected
    expect(() => schema.parse({ value: 'x', confidence: 0.5 })).toThrow();
  });

  /** @AC-01 ProvenanceEntrySchema covers (dimension, source, method, conf). */
  test('AC-01: ProvenanceEntrySchema validates a well-formed row', () => {
    const row = {
      dimension: 'business' as const,
      source: 'schema_org' as const,
      inference_method: 'deterministic' as const,
      confidence: 0.9,
      inferred_at: new Date(),
      inferred_value: { archetype: 'D2C' },
      notes: 'JSON-LD @type Product → D2C',
    };
    expect(() => ProvenanceEntrySchema.parse(row)).not.toThrow();
  });

  /** @AC-01 OpenQuestionSchema requires field_path + question + blocking. */
  test('AC-01: OpenQuestionSchema validates blocking + non-blocking entries', () => {
    expect(() =>
      OpenQuestionSchema.parse({
        field_path: 'business.archetype',
        question: 'Is this a D2C or B2B page?',
        blocking: true,
      }),
    ).not.toThrow();
    // empty field_path rejected
    expect(() =>
      OpenQuestionSchema.parse({
        field_path: '',
        question: 'q?',
        blocking: false,
      }),
    ).toThrow();
  });

  /** @AC-01 ContextProfileSchema accepts a full-shape fixture. */
  test('AC-01: ContextProfileSchema.parse() accepts valid full fixture', () => {
    const fx = makeValidFixture();
    const parsed = ContextProfileSchema.parse(fx);
    expect(parsed.business.archetype.value).toBe('D2C');
    expect(parsed.page.type.value).toBe('PDP');
    expect(parsed.traffic.device_priority.value).toBe('mobile');
    expect(parsed.meta.threshold_action).toBe('act');
    expect(parsed.profile_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  /** @AC-01 .strict() rejects unknown top-level fields. */
  test('AC-01: ContextProfileSchema rejects unknown top-level fields', () => {
    const fx = makeValidFixture() as unknown as Record<string, unknown>;
    fx.severity = 'high';
    expect(() => ContextProfileSchema.parse(fx)).toThrow();
  });

  /** @AC-01 R25 — no judgment fields possible at the contract level. */
  test('AC-01 (R25): no judgment field names appear in the top-level schema', () => {
    const schemaShape = ContextProfileSchema.shape;
    const keys = Object.keys(schemaShape);
    const forbidden = [
      'severity',
      'impact',
      'score',
      'priority',
      'risk_score',
      'recommend',
      'recommendation',
    ];
    for (const f of forbidden) {
      expect(keys, `R25 violation: judgment field '${f}' present`).not.toContain(f);
    }
  });

  /** @AC-01 profile_hash must be 64-char hex (SHA-256). */
  test('AC-01: profile_hash regex enforces 64-char hex SHA-256', () => {
    const fx = makeValidFixture() as unknown as Record<string, unknown>;
    fx.profile_hash = 'too-short';
    expect(() => ContextProfileSchema.parse(fx)).toThrow();
    fx.profile_hash = 'g'.repeat(64); // not hex
    expect(() => ContextProfileSchema.parse(fx)).toThrow();
  });

  /** @AC-01 5 dimensions are all present as top-level keys. */
  test('AC-01: all 5 LOCKED dimensions are top-level keys', () => {
    const keys = Object.keys(ContextProfileSchema.shape);
    for (const dim of ContextDimensionEnum.options) {
      expect(keys, `LOCKED dimension '${dim}' missing from top level`).toContain(dim);
    }
  });
});
