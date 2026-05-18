/**
 * AC-10..AC-17 — Phase 7 Block C1 grounding rules T122-T129.
 *
 * Each GR-001..GR-008 has at least one accept case + one reject case.
 * Deterministic — no LLM, no I/O.
 */
import { describe, expect, it } from 'vitest';
import { GR_001_elementExists } from '../../src/analysis/grounding/rules/GR-001.js';
import { GR_002_foldMatchesBoundingBox } from '../../src/analysis/grounding/rules/GR-002.js';
import { GR_003_formFieldCount } from '../../src/analysis/grounding/rules/GR-003.js';
import { GR_004_contrastClaims } from '../../src/analysis/grounding/rules/GR-004.js';
import { GR_005_heuristicInFilteredSet } from '../../src/analysis/grounding/rules/GR-005.js';
import { GR_006_criticalNeedsMeasurement } from '../../src/analysis/grounding/rules/GR-006.js';
import { GR_007_noConversionPredictions } from '../../src/analysis/grounding/rules/GR-007.js';
import { GR_008_dataPointReferencesRealSection } from '../../src/analysis/grounding/rules/GR-008.js';
import type { CritiqueFinding } from '../../src/orchestration/AnalysisState.js';
import type { AnalyzePerception } from '../../src/analysis/types.js';
import type { HeuristicExtended } from '../../src/analysis/heuristics/types.js';

function f(overrides: Partial<CritiqueFinding> = {}): CritiqueFinding {
  return {
    heuristic_id: 'H-1',
    status: 'violation',
    observation: 'baseline observation text for testing purposes',
    assessment: 'baseline assessment text for testing purposes',
    evidence: {
      element_ref: null,
      element_selector: null,
      data_point: 'ctas[0]',
      measurement: null,
    },
    severity: 'medium',
    confidence_basis: null,
    recommendation: null,
    needs_review: false,
    verdict: 'KEEP',
    ...overrides,
  };
}

function p(overrides: Partial<Record<string, unknown>> = {}): AnalyzePerception {
  return {
    metadata: { url: 'https://x.example' },
    headingHierarchy: [],
    landmarks: [],
    semanticHTML: {},
    structure: {},
    textContent: { wordCount: 100, readabilityScore: 60 },
    ctas: [],
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
    inferredPageType: { primary: 'other', confidence: 0.5 },
    ...overrides,
  } as unknown as AnalyzePerception;
}

const HS = (ids: string[]): HeuristicExtended[] =>
  ids.map((id) => ({ id }) as unknown as HeuristicExtended);

describe('AC-10 GR-001 elementExists', () => {
  it('PASS — element_ref matches a CTA text', () => {
    const r = GR_001_elementExists(
      f({ evidence: { element_ref: 'Add to bag', element_selector: null, data_point: 'ctas[0]', measurement: null } }),
      p({ ctas: [{ text: 'Add to bag', accessibleName: null, role: null }] }),
      [],
    );
    expect(r.pass).toBe(true);
  });
  it('PASS — element_ref is null (rule does not fire)', () => {
    expect(GR_001_elementExists(f(), p(), []).pass).toBe(true);
  });
  it('FAIL — element_ref absent from perception', () => {
    const r = GR_001_elementExists(
      f({ evidence: { element_ref: 'Buy now', element_selector: null, data_point: 'ctas[0]', measurement: null } }),
      p({ ctas: [{ text: 'Subscribe' }] }),
      [],
    );
    expect(r.pass).toBe(false);
  });
});

describe('AC-11 GR-002 foldMatchesBoundingBox', () => {
  it('PASS — no fold claim', () => {
    expect(GR_002_foldMatchesBoundingBox(f(), p(), []).pass).toBe(true);
  });
  it('PASS — claims above fold, y < foldPosition', () => {
    const r = GR_002_foldMatchesBoundingBox(
      f({
        observation: 'The CTA is above the fold',
        evidence: { element_ref: null, element_selector: null, data_point: 'ctas[0]', measurement: 'x:100, y:400' },
      }),
      p({
        layout: {
          viewportHeight: 800,
          foldPosition: 800,
          contentAboveFold: [],
          visualHierarchy: { primaryElement: '', secondaryElements: [] },
          whitespaceRatio: 0.5,
        },
      }),
      [],
    );
    expect(r.pass).toBe(true);
  });
  it('FAIL — claims above fold but y > foldPosition', () => {
    const r = GR_002_foldMatchesBoundingBox(
      f({
        observation: 'The CTA is above the fold',
        evidence: { element_ref: null, element_selector: null, data_point: 'ctas[0]', measurement: 'y:1200' },
      }),
      p({
        layout: {
          viewportHeight: 800,
          foldPosition: 800,
          contentAboveFold: [],
          visualHierarchy: { primaryElement: '', secondaryElements: [] },
          whitespaceRatio: 0.5,
        },
      }),
      [],
    );
    expect(r.pass).toBe(false);
  });
  it('FAIL — fold claim but no y coord in measurement', () => {
    const r = GR_002_foldMatchesBoundingBox(
      f({ observation: 'placed below the fold', evidence: { element_ref: null, element_selector: null, data_point: 'x', measurement: null } }),
      p(),
      [],
    );
    expect(r.pass).toBe(false);
  });
});

describe('AC-12 GR-003 formFieldCount', () => {
  it('PASS — no field count claim', () => {
    expect(GR_003_formFieldCount(f(), p(), []).pass).toBe(true);
  });
  it('PASS — claim matches actual form fieldCount', () => {
    const r = GR_003_formFieldCount(
      f({ observation: 'Form has 7 fields requiring user input' }),
      p({ forms: [{ id: 'f1', fieldCount: 7, fields: [], submitButtonText: 'Submit' }] }),
      [],
    );
    expect(r.pass).toBe(true);
  });
  it('FAIL — claim mismatches all forms', () => {
    const r = GR_003_formFieldCount(
      f({ observation: 'Form has 15 fields' }),
      p({ forms: [{ id: 'f1', fieldCount: 3, fields: [] }] }),
      [],
    );
    expect(r.pass).toBe(false);
  });
});

describe('AC-13 GR-004 contrastClaims', () => {
  it('PASS — no contrast claim', () => {
    expect(GR_004_contrastClaims(f(), p(), []).pass).toBe(true);
  });
  it('PASS — contrast claim + perception has contrastRatio on a CTA', () => {
    const r = GR_004_contrastClaims(
      f({ observation: 'CTA fails WCAG AA contrast' }),
      p({ ctas: [{ text: 'X', computedStyles: { contrastRatio: 3.2 } }] }),
      [],
    );
    expect(r.pass).toBe(true);
  });
  it('FAIL — contrast claim but no contrastRatio anywhere', () => {
    const r = GR_004_contrastClaims(
      f({ observation: 'CTA fails WCAG AA contrast threshold' }),
      p({ ctas: [{ text: 'X' }] }),
      [],
    );
    expect(r.pass).toBe(false);
  });
});

describe('AC-14 GR-005 heuristicInFilteredSet', () => {
  it('PASS — id present in filtered set', () => {
    expect(
      GR_005_heuristicInFilteredSet(f({ heuristic_id: 'BAYMARD-001' }), p(), HS(['BAYMARD-001', 'NN-002'])).pass,
    ).toBe(true);
  });
  it('FAIL — id absent (hallucinated)', () => {
    expect(GR_005_heuristicInFilteredSet(f({ heuristic_id: 'GHOST-999' }), p(), HS(['BAYMARD-001'])).pass).toBe(
      false,
    );
  });
});

describe('AC-15 GR-006 criticalNeedsMeasurement (R5.7)', () => {
  it('PASS — low severity, no measurement required', () => {
    expect(GR_006_criticalNeedsMeasurement(f({ severity: 'low' }), p(), []).pass).toBe(true);
  });
  it('PASS — critical with numeric measurement', () => {
    expect(
      GR_006_criticalNeedsMeasurement(
        f({
          severity: 'critical',
          evidence: { element_ref: null, element_selector: null, data_point: 'forms[0]', measurement: '15 fields, y:1200' },
        }),
        p(),
        [],
      ).pass,
    ).toBe(true);
  });
  it('FAIL — critical with null measurement', () => {
    expect(GR_006_criticalNeedsMeasurement(f({ severity: 'critical' }), p(), []).pass).toBe(false);
  });
  it('FAIL — high with non-numeric measurement', () => {
    expect(
      GR_006_criticalNeedsMeasurement(
        f({
          severity: 'high',
          evidence: { element_ref: null, element_selector: null, data_point: 'x', measurement: 'somewhere on the page' },
        }),
        p(),
        [],
      ).pass,
    ).toBe(false);
  });
});

describe('AC-16 GR-007 noConversionPredictions (R5.3)', () => {
  it('PASS — clean recommendation', () => {
    expect(
      GR_007_noConversionPredictions(
        f({ observation: 'CTA hit area is 280x48px', recommendation: 'Increase button to 320x52px' }),
        p(),
        [],
      ).pass,
    ).toBe(true);
  });
  it('FAIL — "increase conversion rate"', () => {
    expect(
      GR_007_noConversionPredictions(
        f({ recommendation: 'This change will increase conversion rate' }),
        p(),
        [],
      ).pass,
    ).toBe(false);
  });
  it('FAIL — "lift by 12%"', () => {
    expect(
      GR_007_noConversionPredictions(f({ observation: 'Expected lift by 12% based on benchmark' }), p(), []).pass,
    ).toBe(false);
  });
  it('FAIL — bare "uplift"', () => {
    expect(GR_007_noConversionPredictions(f({ recommendation: 'See uplift on revenue' }), p(), []).pass).toBe(false);
  });
  it('FAIL — "drive sales"', () => {
    expect(GR_007_noConversionPredictions(f({ recommendation: 'Will drive sales' }), p(), []).pass).toBe(false);
  });
  it('FAIL — "ROI of 3x"', () => {
    expect(GR_007_noConversionPredictions(f({ assessment: 'Likely ROI of 3 within Q2' }), p(), []).pass).toBe(false);
  });
});

describe('AC-17 GR-008 dataPointReferencesRealSection', () => {
  it('PASS — ctas[0]', () => {
    expect(GR_008_dataPointReferencesRealSection(f(), p(), []).pass).toBe(true);
  });
  it('PASS — forms[0].fields[2]', () => {
    expect(
      GR_008_dataPointReferencesRealSection(
        f({ evidence: { element_ref: null, element_selector: null, data_point: 'forms[0].fields[2]', measurement: null } }),
        p(),
        [],
      ).pass,
    ).toBe(true);
  });
  it('FAIL — invented section', () => {
    expect(
      GR_008_dataPointReferencesRealSection(
        f({ evidence: { element_ref: null, element_selector: null, data_point: 'headerCTAs[0]', measurement: null } }),
        p(),
        [],
      ).pass,
    ).toBe(false);
  });
  it('FAIL — empty data_point lacks leading identifier', () => {
    const r = GR_008_dataPointReferencesRealSection(
      // data_point min(1) — use punctuation-only string with no leading identifier
      f({ evidence: { element_ref: null, element_selector: null, data_point: '[0]', measurement: null } }),
      p(),
      [],
    );
    expect(r.pass).toBe(false);
  });
});
