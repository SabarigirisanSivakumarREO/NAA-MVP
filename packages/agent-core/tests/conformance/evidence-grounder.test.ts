/**
 * AC-18 — EvidenceGrounder + GR-012 (Phase 7 T130, REQ-ANALYZE-NODE-004).
 *
 * Verifies 9-rule pipeline, grounded/rejected split, confidence_tier
 * assignment, GR-012 quantitative ±20% + qualitative Levenshtein/substring.
 */
import { describe, expect, it } from 'vitest';
import { evidenceGrounderRun } from '../../src/analysis/grounding/EvidenceGrounder.js';
import { GR_012_benchmarkValidation } from '../../src/analysis/grounding/rules/GR-012.js';
import type { CritiqueFinding } from '../../src/orchestration/AnalysisState.js';
import type { AnalyzePerception } from '../../src/analysis/types.js';
import type { HeuristicExtended } from '../../src/analysis/heuristics/types.js';

function cf(overrides: Partial<CritiqueFinding> = {}): CritiqueFinding {
  return {
    heuristic_id: 'BAYMARD-CHECKOUT-001',
    status: 'violation',
    observation: 'CTA hit area is 280×48 px on the product page surface.',
    assessment: 'Touch target meets baseline; assessment retained.',
    evidence: {
      element_ref: 'Add to bag',
      element_selector: 'button.add-to-bag',
      data_point: 'ctas[0]',
      measurement: '280×48 at y:400',
    },
    severity: 'medium',
    confidence_basis: 'measured',
    recommendation: null,
    needs_review: false,
    verdict: 'KEEP',
    ...overrides,
  };
}

function ap(overrides: Partial<Record<string, unknown>> = {}): AnalyzePerception {
  return {
    metadata: { url: 'https://x.example' },
    headingHierarchy: [],
    landmarks: [],
    semanticHTML: {},
    structure: {},
    textContent: { wordCount: 100, readabilityScore: 60 },
    ctas: [{ text: 'Add to bag', computedStyles: { contrastRatio: 4.8 } }],
    forms: [],
    trustSignals: [],
    layout: {
      viewportHeight: 800,
      foldPosition: 800,
      contentAboveFold: [],
      visualHierarchy: { primaryElement: '', secondaryElements: [] },
      whitespaceRatio: 0.5,
    },
    images: [],
    iframes: [],
    navigation: {},
    accessibility: {},
    performance: { domContentLoaded: 100, fullyLoaded: 200, resourceCount: 10 },
    inferredPageType: { primary: 'product', confidence: 0.8 },
    ...overrides,
  } as unknown as AnalyzePerception;
}

function h(
  id: string,
  category: string = 'visual_hierarchy',
  benchmark?: { kind: 'quantitative'; value: number; unit: string; metric: string } | { kind: 'qualitative'; standard_text: string },
): HeuristicExtended {
  return { id, category, benchmark } as unknown as HeuristicExtended;
}

describe('AC-18 EvidenceGrounder pipeline', () => {
  it('grounds a clean finding + assigns confidence_tier', () => {
    const out = evidenceGrounderRun({
      critique_findings: [cf()],
      perception: ap(),
      filteredHeuristics: [h('BAYMARD-CHECKOUT-001', 'visual_hierarchy')],
    });
    expect(out.grounded_findings).toHaveLength(1);
    expect(out.rejected_findings).toHaveLength(0);
    expect(out.grounded_findings[0]?.confidence_tier).toBeDefined();
  });

  it('rejects via GR-005 when heuristic_id absent from filtered set', () => {
    const out = evidenceGrounderRun({
      critique_findings: [cf({ heuristic_id: 'GHOST-X-999' })],
      perception: ap(),
      filteredHeuristics: [h('BAYMARD-CHECKOUT-001')],
    });
    expect(out.grounded_findings).toHaveLength(0);
    expect(out.rejected_findings).toHaveLength(1);
    expect(out.rejected_findings[0]?.rejected_by_rule).toBe('GR-005');
  });

  it('rejects via GR-007 on banned conversion phrase', () => {
    const out = evidenceGrounderRun({
      critique_findings: [cf({ recommendation: 'This change will increase conversion rate' })],
      perception: ap(),
      filteredHeuristics: [h('BAYMARD-CHECKOUT-001')],
    });
    expect(out.rejected_findings[0]?.rejected_by_rule).toBe('GR-007');
  });

  it('rejects via GR-006 when severity=critical but measurement empty', () => {
    const out = evidenceGrounderRun({
      critique_findings: [
        cf({
          severity: 'critical',
          evidence: { element_ref: null, element_selector: null, data_point: 'ctas[0]', measurement: null },
        }),
      ],
      perception: ap(),
      filteredHeuristics: [h('BAYMARD-CHECKOUT-001')],
    });
    expect(out.rejected_findings[0]?.rejected_by_rule).toBe('GR-006');
  });

  it('spec — at least 1 rejected on mixed-batch fixture (smoke)', () => {
    const out = evidenceGrounderRun({
      critique_findings: [
        cf({ heuristic_id: 'BAYMARD-CHECKOUT-001' }),
        cf({ heuristic_id: 'GHOST-X-999' }),
        cf({ heuristic_id: 'BAYMARD-CHECKOUT-001', recommendation: 'will drive sales' }),
      ],
      perception: ap(),
      filteredHeuristics: [h('BAYMARD-CHECKOUT-001')],
    });
    expect(out.grounded_findings.length).toBeGreaterThanOrEqual(1);
    expect(out.rejected_findings.length).toBeGreaterThanOrEqual(1);
  });

  it('confidence_tier = high for tier-1 + measurable evidence', () => {
    const out = evidenceGrounderRun({
      critique_findings: [cf()],
      perception: ap(),
      filteredHeuristics: [h('BAYMARD-CHECKOUT-001', 'visual_hierarchy')], // tier 1
    });
    expect(out.grounded_findings[0]?.confidence_tier).toBe('high');
  });
});

describe('AC-18 GR-012 quantitative benchmark', () => {
  it('PASS — observed value within ±20%', () => {
    const r = GR_012_benchmarkValidation(
      cf({ evidence: { element_ref: null, element_selector: null, data_point: 'x', measurement: '46px' } }),
      ap(),
      [h('BAYMARD-CHECKOUT-001', 'visual_hierarchy', { kind: 'quantitative', value: 44, unit: 'px', metric: 'touch' })],
    );
    expect(r.pass).toBe(true);
  });

  it('FAIL — observed value outside ±20%', () => {
    const r = GR_012_benchmarkValidation(
      cf({ evidence: { element_ref: null, element_selector: null, data_point: 'x', measurement: '20px' } }),
      ap(),
      [h('BAYMARD-CHECKOUT-001', 'visual_hierarchy', { kind: 'quantitative', value: 44, unit: 'px', metric: 'touch' })],
    );
    expect(r.pass).toBe(false);
  });

  it('PASS — no number in measurement (skip)', () => {
    const r = GR_012_benchmarkValidation(
      cf({ evidence: { element_ref: null, element_selector: null, data_point: 'x', measurement: 'looks small' } }),
      ap(),
      [h('BAYMARD-CHECKOUT-001', 'visual_hierarchy', { kind: 'quantitative', value: 44, unit: 'px', metric: 'touch' })],
    );
    expect(r.pass).toBe(true);
  });
});

describe('AC-18 GR-012 qualitative benchmark', () => {
  it('PASS — substring match', () => {
    const r = GR_012_benchmarkValidation(
      cf({ observation: 'CTA fails WCAG 2.1 AA contrast ratio of 4.5:1' }),
      ap(),
      [h('BAYMARD-CHECKOUT-001', 'visual_hierarchy', { kind: 'qualitative', standard_text: 'WCAG 2.1 AA contrast ratio' })],
    );
    expect(r.pass).toBe(true);
  });

  it('FAIL — neither substring nor similarity ≥ 0.6', () => {
    const r = GR_012_benchmarkValidation(
      cf({ observation: 'completely unrelated finding about whitespace ratio' }),
      ap(),
      [h('BAYMARD-CHECKOUT-001', 'visual_hierarchy', { kind: 'qualitative', standard_text: 'WCAG 2.1 AA contrast ratio' })],
    );
    expect(r.pass).toBe(false);
  });
});
