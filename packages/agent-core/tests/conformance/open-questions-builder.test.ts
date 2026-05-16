/**
 * AC-08 — OpenQuestionsBuilder conformance (Phase 4b T4B-008).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-08 + R-09 +
 *     §"Edge Cases" L218-225 (default-value emission rule)
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §2.2
 *     (required-field rule R-09; required: business.archetype, page.type,
 *     goal.primary_kpi)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-008 (L139-145)
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.2
 *     (REQ-CONTEXT-OUT-002 — open_questions[] surface for clarification)
 *
 * AC-08 contract:
 *   1. Blocking questions for REQUIRED fields when confidence <0.6 OR missing
 *      (REQUIRED in MVP: business.archetype, page.type, goal.primary_kpi).
 *   2. Non-blocking warnings for any field with confidence ∈ [0.6, 0.9).
 *   3. High-confidence (≥0.9) fields emit no question.
 *   4. Output sorted (blocking desc, field_path asc) for R-03 hash stability.
 *   5. Output array frozen.
 *   6. Every entry validates against OpenQuestionSchema.
 *
 * Anchor: @AC-08 — required-field-aware question surface.
 */
import { describe, expect, it } from 'vitest';

import { buildOpenQuestions } from '../../src/context/OpenQuestionsBuilder.js';
import {
  type AudienceDimension,
  type BrandDimension,
  type BusinessDimension,
  type GoalDimension,
  OpenQuestionSchema,
  type PageDimension,
  type TrafficDimension,
} from '../../src/types/context-profile.js';

// ---------------------------------------------------------------------------
// Fixture factory — minimal-shape 6-dimension input
// ---------------------------------------------------------------------------

interface UniformDimensions {
  business: BusinessDimension;
  page: PageDimension;
  audience: AudienceDimension;
  traffic: TrafficDimension;
  brand: BrandDimension;
  goal: GoalDimension;
}

function uniformDimensions(c: number): UniformDimensions {
  const u = 'user' as const;
  return {
    business: {
      archetype: { value: 'D2C', source: u, confidence: c },
      aov_tier: { value: 'mid', source: u, confidence: c },
      cadence: { value: 'one_time', source: u, confidence: c },
      vertical: { value: 'apparel', source: u, confidence: c },
    },
    page: {
      type: { value: 'PDP', source: u, confidence: c },
      funnel_stage: { value: 'consideration', source: u, confidence: c },
      job: { value: 'convert', source: u, confidence: c },
      is_indexed: { value: true, source: u, confidence: c },
    },
    audience: {
      buyer: { value: 'consumer', source: u, confidence: c },
      awareness_level: { value: 'product_aware', source: u, confidence: c },
      decision_style: { value: 'researched', source: u, confidence: c },
      sophistication: { value: 'medium', source: u, confidence: c },
    },
    traffic: {
      primary_sources: { value: [], source: u, confidence: c },
      device_priority: { value: 'mobile', source: u, confidence: c },
      mobile_share: { value: 0.7, source: u, confidence: c },
      geo_primary: { value: 'US', source: u, confidence: c },
      locale_primary: { value: 'en-US', source: u, confidence: c },
    },
    brand: {
      tone: { value: 'professional', source: u, confidence: c },
      voice: { value: 'confident', source: u, confidence: c },
      forbidden_terms: { value: [], source: u, confidence: c },
    },
    goal: {
      primary_kpi: { value: 'purchase', source: u, confidence: c },
      secondary_kpis: { value: [], source: u, confidence: c },
      current_baseline: { value: null, source: u, confidence: c },
      target_lift: { value: null, source: u, confidence: c },
      constraints: {
        regulatory: { value: [], source: u, confidence: c },
        accessibility: { value: 'WCAG_AA', source: u, confidence: c },
        brand: { value: [], source: u, confidence: c },
        technical: { value: [], source: u, confidence: c },
      },
    },
  };
}

const REQUIRED_PATHS = ['business.archetype', 'goal.primary_kpi', 'page.type'] as const;

// ---------------------------------------------------------------------------
// AC-08 — OpenQuestionsBuilder
// ---------------------------------------------------------------------------

describe('OpenQuestionsBuilder — AC-08 required-field + warning surface', () => {
  it('AC-08 (1): all-required-missing (confidence 0) → 3 blocking questions, no warnings', () => {
    const dims = uniformDimensions(0);
    const { open_questions } = buildOpenQuestions(dims);
    const blocking = open_questions.filter((q) => q.blocking);
    const warnings = open_questions.filter((q) => !q.blocking);
    expect(blocking).toHaveLength(3);
    expect(warnings).toHaveLength(0);
    expect(blocking.map((q) => q.field_path).sort()).toEqual([...REQUIRED_PATHS].sort());
  });

  it('AC-08 (2): all-required-low (confidence 0.5) → 3 blocking questions', () => {
    const dims = uniformDimensions(0.5);
    const { open_questions } = buildOpenQuestions(dims);
    const blocking = open_questions.filter((q) => q.blocking);
    expect(blocking).toHaveLength(3);
    expect(blocking.map((q) => q.field_path).sort()).toEqual([...REQUIRED_PATHS].sort());
    // 0.5 is below 0.6 lower bound → no non-blocking warnings either.
    expect(open_questions.filter((q) => !q.blocking)).toHaveLength(0);
  });

  it('AC-08 (3): all-required-OK (0.95) + mid non-required → 0 blocking + warnings only', () => {
    // Required at 0.95; one non-required (business.aov_tier) at 0.7.
    const dims = uniformDimensions(0.95);
    dims.business.aov_tier = { value: 'mid', source: 'user', confidence: 0.7 };
    const { open_questions } = buildOpenQuestions(dims);
    const blocking = open_questions.filter((q) => q.blocking);
    const warnings = open_questions.filter((q) => !q.blocking);
    expect(blocking).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field_path).toBe('business.aov_tier');
    expect(warnings[0].dimension).toBe('business');
  });

  it('AC-08 (4): mixed — 1 required low + 1 non-required mid + 1 high → 1 blocking + 1 warning', () => {
    const dims = uniformDimensions(0.95); // start all-high
    dims.business.archetype = { value: 'D2C', source: 'user', confidence: 0.4 }; // blocking required
    dims.audience.buyer = { value: 'consumer', source: 'user', confidence: 0.7 }; // warning non-required
    dims.page.type = { value: 'PDP', source: 'user', confidence: 0.95 }; // silent (still high)
    const { open_questions } = buildOpenQuestions(dims);
    const blocking = open_questions.filter((q) => q.blocking);
    const warnings = open_questions.filter((q) => !q.blocking);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].field_path).toBe('business.archetype');
    expect(blocking[0].dimension).toBe('business');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field_path).toBe('audience.buyer');
    expect(warnings[0].dimension).toBe('audience');
  });

  it('AC-08 (5): all-high-confidence (0.95 each) → 0 questions emitted', () => {
    const dims = uniformDimensions(0.95);
    const { open_questions } = buildOpenQuestions(dims);
    expect(open_questions).toHaveLength(0);
  });

  it('AC-08 (6): field_path correctness — exact dot-notated paths for required fields', () => {
    const dims = uniformDimensions(0); // all blocking
    const { open_questions } = buildOpenQuestions(dims);
    const paths = open_questions.map((q) => q.field_path);
    expect(paths).toContain('business.archetype');
    expect(paths).toContain('page.type');
    expect(paths).toContain('goal.primary_kpi');
  });

  it('AC-08 (6b): field_path correctness — non-required dot-notated path on warning', () => {
    const dims = uniformDimensions(0.95);
    dims.traffic.device_priority = { value: 'mobile', source: 'user', confidence: 0.75 };
    const { open_questions } = buildOpenQuestions(dims);
    const w = open_questions.find((q) => !q.blocking);
    expect(w?.field_path).toBe('traffic.device_priority');
    expect(w?.dimension).toBe('traffic');
  });

  it('AC-08 (7): sort order — blocking before non-blocking; field_path asc within group', () => {
    // Build: 2 blocking (business.archetype, page.type) + 2 warnings
    // (audience.buyer, brand.tone). Required goal.primary_kpi stays high (silent).
    const dims = uniformDimensions(0.95);
    dims.business.archetype = { value: 'D2C', source: 'user', confidence: 0.3 }; // blocking
    dims.page.type = { value: 'PDP', source: 'user', confidence: 0.4 }; // blocking
    dims.audience.buyer = { value: 'consumer', source: 'user', confidence: 0.7 }; // warning
    dims.brand.tone = { value: 'professional', source: 'user', confidence: 0.65 }; // warning
    const { open_questions } = buildOpenQuestions(dims);
    expect(open_questions.map((q) => q.field_path)).toEqual([
      // blocking group, alphabetical
      'business.archetype',
      'page.type',
      // non-blocking group, alphabetical
      'audience.buyer',
      'brand.tone',
    ]);
    expect(open_questions.map((q) => q.blocking)).toEqual([true, true, false, false]);
  });

  it('AC-08 (8): every output entry passes OpenQuestionSchema.parse()', () => {
    const dims = uniformDimensions(0.5);
    dims.business.aov_tier = { value: 'mid', source: 'user', confidence: 0.7 };
    const { open_questions } = buildOpenQuestions(dims);
    expect(open_questions.length).toBeGreaterThan(0);
    for (const q of open_questions) {
      expect(() => OpenQuestionSchema.parse(q)).not.toThrow();
    }
  });

  it('AC-08 (9): output array is frozen', () => {
    const { open_questions } = buildOpenQuestions(uniformDimensions(0));
    expect(Object.isFrozen(open_questions)).toBe(true);
  });

  it('AC-08 (10): dimension tag — every question carries the correct parent dimension', () => {
    const dims = uniformDimensions(0); // all 3 required blocking
    const { open_questions } = buildOpenQuestions(dims);
    const dimByPath = new Map(open_questions.map((q) => [q.field_path, q.dimension]));
    expect(dimByPath.get('business.archetype')).toBe('business');
    expect(dimByPath.get('page.type')).toBe('page');
    // goal.primary_kpi is REQUIRED but `goal` is not in the 5-dim
    // ContextDimensionEnum (it's intake-only); dimension is left undefined.
    expect(dimByPath.get('goal.primary_kpi')).toBeUndefined();
  });

  it('AC-08: deterministic — same input → identical sorted output across calls', () => {
    const dims = uniformDimensions(0.5);
    dims.business.aov_tier = { value: 'mid', source: 'user', confidence: 0.7 };
    dims.audience.buyer = { value: 'consumer', source: 'user', confidence: 0.8 };
    const a = buildOpenQuestions(dims);
    const b = buildOpenQuestions(dims);
    expect(a.open_questions.map((q) => q.field_path)).toEqual(
      b.open_questions.map((q) => q.field_path),
    );
    expect(a.open_questions.map((q) => q.blocking)).toEqual(
      b.open_questions.map((q) => q.blocking),
    );
  });

  it('AC-08: required-field 0.6 boundary — confidence === 0.6 is NOT blocking (lower bound exclusive)', () => {
    // R-09 reads "confidence <0.6" for blocking; 0.6 itself falls in the
    // [0.6, 0.9) warning band, NOT the blocking band. Required fields at
    // exactly 0.6 emit a warning (non-blocking).
    const dims = uniformDimensions(0.95);
    dims.business.archetype = { value: 'D2C', source: 'user', confidence: 0.6 };
    const { open_questions } = buildOpenQuestions(dims);
    const blocking = open_questions.filter((q) => q.blocking);
    const warnings = open_questions.filter((q) => !q.blocking);
    expect(blocking).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field_path).toBe('business.archetype');
  });

  it('AC-08: high-confidence 0.9 boundary — confidence === 0.9 is silent (upper bound exclusive)', () => {
    const dims = uniformDimensions(0.95);
    dims.audience.buyer = { value: 'consumer', source: 'user', confidence: 0.9 };
    const { open_questions } = buildOpenQuestions(dims);
    expect(open_questions.filter((q) => q.field_path === 'audience.buyer')).toHaveLength(0);
  });
});
