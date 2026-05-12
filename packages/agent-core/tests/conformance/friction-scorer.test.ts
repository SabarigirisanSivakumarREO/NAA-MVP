/**
 * Conformance test for AC-05 (T1B-005 FrictionScorer).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-05
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-005
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/plan.md §2.4
 *     Formula:
 *       raw = totalFormFields*1 + requiredFormFields*1.5
 *           + popupCount*2 + forcedActionCount*4
 *       normalized = clamp(raw / 30, 0, 1)
 *
 * R-05: Deterministic weighted sum; normalized ∈ [0, 1].
 *       Reads ctx.formFields[] (T1B-000) + ctx.popups[] (T1B-004).
 *
 * R3.1 TDD: import fails with "module not found" until T1B-005 lands.
 *
 * Anchor: @AC-05 — frictionScore.{totalFormFields, requiredFormFields,
 *   popupCount, forcedActionCount, raw, normalized}; normalized ∈ [0,1].
 */
import { describe, expect, test } from 'vitest';

import { computeFrictionScore } from '../../src/perception/extensions/FrictionScorer.js';

interface FormFieldShape {
  selector: string;
  type: string;
  required: boolean;
}

function makeCtx(formFields: FormFieldShape[], popups: Array<Record<string, unknown>> = []): {
  ctas: never[];
  formFields: FormFieldShape[];
  metadata: { schemaOrg: never[]; ogTags: Record<string, never> };
  headings: never[];
  primaryActions: null;
  popups: Array<Record<string, unknown>>;
} {
  return {
    ctas: [],
    formFields,
    metadata: { schemaOrg: [], ogTags: {} },
    headings: [],
    primaryActions: null,
    popups,
  };
}

describe('FrictionScorer — AC-05 conformance (RED)', () => {
  /**
   * @AC-05 — empty page: zero raw, zero normalized.
   */
  test('AC-05: empty page produces raw=0 and normalized=0', () => {
    const result = computeFrictionScore(makeCtx([]));
    expect(result.totalFormFields).toBe(0);
    expect(result.popupCount).toBe(0);
    expect(result.raw).toBe(0);
    expect(result.normalized).toBe(0);
  });

  /**
   * @AC-05 — 15 fields, 5 required, 1 popup → raw ≈ 24.5, normalized ≈ 0.82.
   * (Per plan.md §2.4 calibration example.)
   */
  test('AC-05: typical e-comm checkout (15 fields, 5 required, 1 popup) computes per spec formula', () => {
    const fields: FormFieldShape[] = Array.from({ length: 15 }, (_, i) => ({
      selector: `#f${i}`,
      type: 'text',
      required: i < 5,
    }));
    const popups = [{ type: 'modal' }];
    const result = computeFrictionScore(makeCtx(fields, popups));
    expect(result.totalFormFields).toBe(15);
    expect(result.requiredFormFields).toBe(5);
    expect(result.popupCount).toBe(1);
    // raw = 15*1 + 5*1.5 + 1*2 + 0*4 = 15 + 7.5 + 2 = 24.5
    expect(result.raw).toBeCloseTo(24.5, 1);
    // normalized = clamp(24.5 / 30) ≈ 0.817
    expect(result.normalized).toBeGreaterThan(0.8);
    expect(result.normalized).toBeLessThanOrEqual(1);
  });

  /**
   * @AC-05 — normalized is clamped to [0, 1].
   */
  test('AC-05: normalized is clamped to [0, 1] under extreme inputs', () => {
    const fields: FormFieldShape[] = Array.from({ length: 50 }, (_, i) => ({
      selector: `#f${i}`,
      type: 'text',
      required: true,
    }));
    const popups = Array.from({ length: 10 }, () => ({ type: 'modal' }));
    const result = computeFrictionScore(makeCtx(fields, popups));
    expect(result.normalized).toBeGreaterThanOrEqual(0);
    expect(result.normalized).toBeLessThanOrEqual(1);
  });

  /**
   * @AC-05 — frictionScore exposes all 6 contract fields.
   */
  test('AC-05: frictionScore object has all 6 contract fields', () => {
    const result = computeFrictionScore(makeCtx([]));
    expect(result).toHaveProperty('totalFormFields');
    expect(result).toHaveProperty('requiredFormFields');
    expect(result).toHaveProperty('popupCount');
    expect(result).toHaveProperty('forcedActionCount');
    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('normalized');
  });

  /**
   * @AC-05 — same input produces same output (deterministic).
   */
  test('AC-05: function is deterministic across multiple calls', () => {
    const fields: FormFieldShape[] = [
      { selector: '#email', type: 'email', required: true },
      { selector: '#name', type: 'text', required: false },
    ];
    const a = computeFrictionScore(makeCtx(fields));
    const b = computeFrictionScore(makeCtx(fields));
    expect(a.raw).toBe(b.raw);
    expect(a.normalized).toBe(b.normalized);
  });
});
