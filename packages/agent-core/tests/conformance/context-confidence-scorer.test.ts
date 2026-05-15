/**
 * AC-07 — ConfidenceScorer + ProvenanceAssembler conformance (Phase 4b T4B-007).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-07 + R-08 + R-09
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §2.2 (weights table)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-007 (L131-137)
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.2
 *     (REQ-CONTEXT-OUT-001 — weighted overall_confidence + 3-band threshold)
 *
 * AC-07 scope (this file):
 *   1. All-high-confidence path → overall ≈ 0.95, action 'act'
 *   2. Mid-confidence path → overall ≈ 0.7, action 'use_and_flag'
 *   3. Low-confidence path → overall ≈ 0.3, action 'ask'
 *   4. Required-field override #1: business.archetype low → forced 'ask'
 *   5. Required-field override #2: page.type low → forced 'ask'
 *   6. Weight sanity: only business.archetype scored → overall = 0.35 exact
 *   7. ConfidenceScorerResult shape valid (threshold_action enum parse)
 *   8. ProvenanceAssembler — sorted output (dimension, source, inferred_at)
 *   9. ProvenanceAssembler — Zod validation (missing field throws)
 *  10. ProvenanceAssembler — frozen array
 *  11. ProvenanceAssembler — empty input → empty frozen array
 *
 * NOTE on filename: spec.md AC-07 lists the canonical path as
 *   `tests/conformance/confidence-scorer.test.ts`, but that path is occupied
 *   by Phase 3 T064 (the verification ConfidenceScorer in src/verification/).
 *   See stage-1-preflight-outputs.md L39 — "incidental name collision from
 *   Phase 0b". This file uses the disambiguated `context-confidence-scorer`
 *   prefix to coexist with the Phase 3 test of the same conceptual name.
 *
 * Anchor: @AC-07 — weighted confidence aggregation + provenance assembly.
 */
import { describe, expect, it } from 'vitest';

import { scoreConfidence } from '../../src/context/ConfidenceScorer.js';
import { assembleProvenance } from '../../src/context/ProvenanceAssembler.js';
import {
  type AudienceDimension,
  type BrandDimension,
  type BusinessDimension,
  ConfidenceThresholdActionEnum,
  type PageDimension,
  type ProvenanceEntry,
  type TrafficDimension,
} from '../../src/types/context-profile.js';

// ---------------------------------------------------------------------------
// Fixture factories — minimal-shape dimension builders
// ---------------------------------------------------------------------------

/**
 * Build a uniform-confidence 5-dimension fixture. Every dimension field
 * carries `confidence: c`, `source: 'user'`, and a typed value drawn from
 * each enum's first member. The ConfidenceScorer only reads `.confidence`
 * on the 6 weighted subfields; values are otherwise pass-through.
 */
function uniformDimensions(c: number): {
  business: BusinessDimension;
  page: PageDimension;
  audience: AudienceDimension;
  traffic: TrafficDimension;
  brand: BrandDimension;
} {
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
  };
}

// ---------------------------------------------------------------------------
// AC-07 — ConfidenceScorer
// ---------------------------------------------------------------------------

describe('ConfidenceScorer — AC-07 weighted aggregation + threshold gates', () => {
  it('AC-07 (1): all-high-confidence (0.95 each) → overall ≈ 0.95, action "act"', () => {
    const result = scoreConfidence(uniformDimensions(0.95));
    expect(result.overall_confidence).toBeCloseTo(0.95, 6);
    expect(result.threshold_action).toBe('act');
  });

  it('AC-07 (2): mid-confidence (0.7 each) → overall ≈ 0.7, action "use_and_flag"', () => {
    const result = scoreConfidence(uniformDimensions(0.7));
    expect(result.overall_confidence).toBeCloseTo(0.7, 6);
    expect(result.threshold_action).toBe('use_and_flag');
  });

  it('AC-07 (3): low-confidence (0.3 each) → overall ≈ 0.3, action "ask"', () => {
    const result = scoreConfidence(uniformDimensions(0.3));
    expect(result.overall_confidence).toBeCloseTo(0.3, 6);
    expect(result.threshold_action).toBe('ask');
  });

  it('AC-07 (4): required-field override — business.archetype <0.6 forces "ask"', () => {
    // Everything else high; only business.archetype low (0.5).
    const dims = uniformDimensions(0.95);
    dims.business.archetype = { value: 'D2C', source: 'user', confidence: 0.5 };
    const result = scoreConfidence(dims);
    // Raw weighted sum: (0.5 * 0.35) + (0.95 * 0.65) = 0.175 + 0.6175 = 0.7925.
    expect(result.overall_confidence).toBeCloseTo(0.7925, 6);
    // Without R-09 override this would be 'use_and_flag'; with override it MUST be 'ask'.
    expect(result.threshold_action).toBe('ask');
  });

  it('AC-07 (5): required-field override — page.type <0.6 forces "ask"', () => {
    const dims = uniformDimensions(0.95);
    dims.page.type = { value: 'PDP', source: 'user', confidence: 0.4 };
    const result = scoreConfidence(dims);
    // Raw: (0.4 * 0.25) + (0.95 * 0.75) = 0.1 + 0.7125 = 0.8125.
    expect(result.overall_confidence).toBeCloseTo(0.8125, 6);
    expect(result.threshold_action).toBe('ask');
  });

  it('AC-07 (6): weight sanity — only business.archetype=1.0 → overall = 0.35 exactly', () => {
    const dims = uniformDimensions(0);
    dims.business.archetype = { value: 'D2C', source: 'user', confidence: 1.0 };
    const result = scoreConfidence(dims);
    // 1.0 * 0.35 + 0 * (0.25+0.15+0.10+0.10+0.05) = 0.35.
    expect(result.overall_confidence).toBeCloseTo(0.35, 10);
    // overall_confidence < 0.6 AND business.archetype >= 0.6 → 'ask' (raw band).
    expect(result.threshold_action).toBe('ask');
  });

  it('AC-07 (6b): weight sanity — only page.type=1.0 → overall = 0.25 exactly', () => {
    const dims = uniformDimensions(0);
    dims.page.type = { value: 'PDP', source: 'user', confidence: 1.0 };
    const result = scoreConfidence(dims);
    expect(result.overall_confidence).toBeCloseTo(0.25, 10);
  });

  it('AC-07 (6c): weight sanity — only traffic.device_priority=1.0 → overall = 0.15 exactly', () => {
    const dims = uniformDimensions(0);
    dims.traffic.device_priority = { value: 'mobile', source: 'user', confidence: 1.0 };
    const result = scoreConfidence(dims);
    expect(result.overall_confidence).toBeCloseTo(0.15, 10);
  });

  it('AC-07 (6d): weight sanity — only business.aov_tier=1.0 → overall = 0.10 exactly', () => {
    const dims = uniformDimensions(0);
    dims.business.aov_tier = { value: 'mid', source: 'user', confidence: 1.0 };
    const result = scoreConfidence(dims);
    expect(result.overall_confidence).toBeCloseTo(0.1, 10);
  });

  it('AC-07 (6e): weight sanity — only audience.buyer=1.0 → overall = 0.10 exactly', () => {
    const dims = uniformDimensions(0);
    dims.audience.buyer = { value: 'consumer', source: 'user', confidence: 1.0 };
    const result = scoreConfidence(dims);
    expect(result.overall_confidence).toBeCloseTo(0.1, 10);
  });

  it('AC-07 (6f): weight sanity — only brand.tone=1.0 → overall = 0.05 exactly', () => {
    const dims = uniformDimensions(0);
    dims.brand.tone = { value: 'professional', source: 'user', confidence: 1.0 };
    const result = scoreConfidence(dims);
    expect(result.overall_confidence).toBeCloseTo(0.05, 10);
  });

  it('AC-07 (7): result shape — threshold_action parses against ConfidenceThresholdActionEnum', () => {
    const result = scoreConfidence(uniformDimensions(0.95));
    expect(() => ConfidenceThresholdActionEnum.parse(result.threshold_action)).not.toThrow();
    expect(result.overall_confidence).toBeGreaterThanOrEqual(0);
    expect(result.overall_confidence).toBeLessThanOrEqual(1);
  });

  it('AC-07 (7b): boundary — overall = 0.9 exactly → "act"', () => {
    // Construct a config that sums to exactly 0.9 across all 6 weighted fields.
    const dims = uniformDimensions(0.9);
    const result = scoreConfidence(dims);
    expect(result.overall_confidence).toBeCloseTo(0.9, 6);
    expect(result.threshold_action).toBe('act');
  });

  it('AC-07 (7c): boundary — overall = 0.6 exactly → "use_and_flag"', () => {
    const dims = uniformDimensions(0.6);
    const result = scoreConfidence(dims);
    expect(result.overall_confidence).toBeCloseTo(0.6, 6);
    expect(result.threshold_action).toBe('use_and_flag');
  });

  it('AC-07 (7d): boundary — overall just below 0.6 → "ask"', () => {
    const dims = uniformDimensions(0.59);
    const result = scoreConfidence(dims);
    expect(result.overall_confidence).toBeCloseTo(0.59, 6);
    expect(result.threshold_action).toBe('ask');
  });
});

// ---------------------------------------------------------------------------
// AC-07 — ProvenanceAssembler
// ---------------------------------------------------------------------------

describe('ProvenanceAssembler — AC-07 validate + sort + freeze', () => {
  const baseDate = new Date('2026-05-15T12:00:00.000Z');

  function makeEntry(
    dimension: ProvenanceEntry['dimension'],
    source: ProvenanceEntry['source'],
    msOffset: number,
  ): ProvenanceEntry {
    return {
      dimension,
      source,
      inference_method: 'deterministic',
      confidence: 0.8,
      inferred_at: new Date(baseDate.getTime() + msOffset),
      inferred_value: { note: `${dimension}:${source}:${msOffset}` },
    };
  }

  it('AC-07 (8): sorts by (dimension, source, inferred_at) ascending', () => {
    const entries: ProvenanceEntry[] = [
      makeEntry('page', 'url_pattern', 200),
      makeEntry('business', 'schema_org', 100),
      makeEntry('business', 'copy_inference', 50),
      makeEntry('audience', 'user', 0),
      makeEntry('business', 'schema_org', 50), // same dim+source, earlier
    ];
    const { provenance } = assembleProvenance({ entries });
    expect(provenance.length).toBe(5);

    // Expected order: audience<business<page (alpha) ; within business:
    //   copy_inference < schema_org (alpha); within schema_org: 50 < 100.
    const ordering = provenance.map((p) => `${p.dimension}|${p.source}|${p.inferred_at.getTime()}`);
    expect(ordering).toEqual([
      `audience|user|${baseDate.getTime() + 0}`,
      `business|copy_inference|${baseDate.getTime() + 50}`,
      `business|schema_org|${baseDate.getTime() + 50}`,
      `business|schema_org|${baseDate.getTime() + 100}`,
      `page|url_pattern|${baseDate.getTime() + 200}`,
    ]);
  });

  it('AC-07 (9): Zod validation — missing `dimension` field throws', () => {
    const bad = {
      // dimension missing
      source: 'user',
      inference_method: 'deterministic',
      confidence: 0.8,
      inferred_at: baseDate,
      inferred_value: {},
    } as unknown as ProvenanceEntry;
    expect(() => assembleProvenance({ entries: [bad] })).toThrow();
  });

  it('AC-07 (9b): Zod validation — confidence out of [0,1] throws', () => {
    const bad = {
      dimension: 'business',
      source: 'user',
      inference_method: 'deterministic',
      confidence: 1.5, // out of range
      inferred_at: baseDate,
      inferred_value: {},
    } as unknown as ProvenanceEntry;
    expect(() => assembleProvenance({ entries: [bad] })).toThrow();
  });

  it('AC-07 (10): output array is frozen', () => {
    const { provenance } = assembleProvenance({
      entries: [makeEntry('business', 'user', 0)],
    });
    expect(Object.isFrozen(provenance)).toBe(true);
  });

  it('AC-07 (11): empty input → empty frozen array; no throw', () => {
    const { provenance } = assembleProvenance({ entries: [] });
    expect(provenance).toEqual([]);
    expect(Object.isFrozen(provenance)).toBe(true);
  });

  it('AC-07: deterministic — same input → identical sorted order across calls', () => {
    const e1 = makeEntry('brand', 'default', 0);
    const e2 = makeEntry('audience', 'user', 100);
    const e3 = makeEntry('traffic', 'url_pattern', 50);
    const a = assembleProvenance({ entries: [e1, e2, e3] });
    const b = assembleProvenance({ entries: [e3, e1, e2] });
    expect(a.provenance.map((p) => p.dimension)).toEqual(b.provenance.map((p) => p.dimension));
    expect(a.provenance.map((p) => p.source)).toEqual(b.provenance.map((p) => p.source));
  });
});
