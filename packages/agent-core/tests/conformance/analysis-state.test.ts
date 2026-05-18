// AC-01 — AnalysisState (Phase 7 analyze-mode extension) Zod schema
// Spec: docs/specs/mvp/phases/phase-7-analysis/spec.md AC-01 v0.3
// REQ-IDs: REQ-STATE-001
// Linked task: T113
// Status: GREEN after T113 (Block A foundation)

import { describe, expect, it } from 'vitest';

import {
  AnalysisStateSchema,
  AnalysisStatusEnum,
  ConfidenceTierEnum,
  CritiqueFindingSchema,
  GroundedFindingSchema,
  PageTypeEnum,
  RawFindingSchema,
  RejectedFindingSchema,
} from '../../src/orchestration/AnalysisState.js';
import { AuditStateBrowseSubsetSchema } from '../../src/orchestration/AuditState.js';

describe('AC-01 — AnalysisState analyze-mode extension', () => {
  // Phase 4b base + Phase 5 browse required fields (minimum valid AuditStateBrowseSubset).
  const baseFixture = {
    audit_run_id: '11111111-1111-1111-1111-111111111111',
    client_id: '22222222-2222-2222-2222-222222222222',
    current_node: 'deep_perceive',
    node_status: 'pending' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-18T00:00:00Z'),
    updated_at: new Date('2026-05-18T00:00:00Z'),
    urls_remaining: ['https://example.com'],
    budget_remaining_usd: 15.0,
  };

  it('Test 1 — parses minimal valid AnalysisState and applies analyze defaults', () => {
    const parsed = AnalysisStateSchema.parse(baseFixture);
    expect(parsed.evaluate_findings_raw).toEqual([]);
    expect(parsed.critique_findings).toEqual([]);
    expect(parsed.grounded_findings).toEqual([]);
    expect(parsed.rejected_findings).toEqual([]);
    expect(parsed.analysis_status).toBe('pending');
    expect(parsed.current_page_perception_bundle).toBeUndefined();
    expect(parsed.current_page_type).toBeUndefined();
    expect(parsed.confidence_tier).toBeUndefined();
    expect(parsed.current_page_signals).toBeUndefined();
    // analysis_cost_usd inherited from browse subset (default 0)
    expect(parsed.analysis_cost_usd).toBe(0);
  });

  it('Test 2 — rejects unknown top-level field (.strict())', () => {
    const bad = { ...baseFixture, hypothetical_phase_99_field: 'nope' };
    expect(() => AnalysisStateSchema.parse(bad)).toThrow();
  });

  it('Test 3 — analysis_status rejects out-of-enum value', () => {
    const bad = { ...baseFixture, analysis_status: 'made_up_status' };
    expect(() => AnalysisStateSchema.parse(bad)).toThrow();
    // Spot-check accepted taxonomy values
    expect(() =>
      AnalysisStateSchema.parse({ ...baseFixture, analysis_status: 'complete' }),
    ).not.toThrow();
    expect(() =>
      AnalysisStateSchema.parse({
        ...baseFixture,
        analysis_status: 'skipped_perception_quality_low',
      }),
    ).not.toThrow();
    expect(() =>
      AnalysisStateSchema.parse({
        ...baseFixture,
        analysis_status: 'partial_analysis_perception_quality_marginal',
      }),
    ).not.toThrow();
  });

  it('Test 4 — confidence_tier rejects invalid value', () => {
    const bad = { ...baseFixture, confidence_tier: 'super-high' };
    expect(() => AnalysisStateSchema.parse(bad)).toThrow();
    expect(() =>
      AnalysisStateSchema.parse({ ...baseFixture, confidence_tier: 'high' }),
    ).not.toThrow();
    expect(() =>
      AnalysisStateSchema.parse({ ...baseFixture, confidence_tier: 'medium' }),
    ).not.toThrow();
    expect(() =>
      AnalysisStateSchema.parse({ ...baseFixture, confidence_tier: 'low' }),
    ).not.toThrow();
  });

  it('Test 5 — backward-compat — browse-subset fixture stays valid against analyze schema (R20 additive)', () => {
    // The browse-subset payload (no analyze fields) MUST parse against analyze schema;
    // analyze defaults fill in. Conversely, a payload validated against
    // AuditStateBrowseSubsetSchema must remain valid (the base contract is not broken).
    const browseParsed = AuditStateBrowseSubsetSchema.parse(baseFixture);
    expect(browseParsed.budget_remaining_usd).toBe(15.0);
    const analyzeParsed = AnalysisStateSchema.parse(baseFixture);
    // Browse-only fields still present + correct.
    expect(analyzeParsed.business_type).toBe('unknown');
    expect(analyzeParsed.urls_remaining).toEqual(['https://example.com']);
    expect(analyzeParsed.budget_remaining_usd).toBe(15.0);
  });

  it('Test 6 — forward-stub Finding schemas accept reasonable samples', () => {
    const raw = RawFindingSchema.parse({
      heuristic_id: 'BAYMARD-001',
      status: 'violation',
      observation: 'Form#checkout email field has no visible label.',
      assessment: 'WCAG 3.3.2 requires visible labels for form inputs.',
      evidence: {
        element_ref: 'input[name=email]',
        element_selector: 'form#checkout > input[name=email]',
        data_point: 'forms[0].fields[0]',
        measurement: null,
      },
      severity: 'medium',
      confidence_basis: 'Explicit absence of <label> + no aria-label observed.',
      recommendation: 'Add visible label above the email input.',
      needs_review: false,
      persona: 'first_time_visitor',
    });
    expect(raw.heuristic_id).toBe('BAYMARD-001');
    expect(raw.severity).toBe('medium');

    const crit = CritiqueFindingSchema.parse({ ...raw, verdict: 'KEEP' });
    expect(crit.verdict).toBe('KEEP');

    const grounded = GroundedFindingSchema.parse({
      ...crit,
      confidence_tier: 'high',
      measurement: { form_field_count: 12, page_url: 'https://x/checkout' },
    });
    expect(grounded.confidence_tier).toBe('high');

    const rejected = RejectedFindingSchema.parse({
      ...crit,
      rejected_by_rule: 'GR-007',
      rejection_reason: 'r5_3_conversion_prediction_banned',
    });
    expect(rejected.rejected_by_rule).toBe('GR-007');
    expect(rejected.rejection_reason).toBe('r5_3_conversion_prediction_banned');
  });

  it('exported enums expose expected domain values', () => {
    expect(PageTypeEnum.options).toEqual([
      'homepage',
      'product',
      'checkout',
      'form',
      'pricing',
      'other',
    ]);
    expect(ConfidenceTierEnum.options).toEqual(['high', 'medium', 'low']);
    expect(AnalysisStatusEnum.options).toContain('pending');
    expect(AnalysisStatusEnum.options).toContain('complete');
    expect(AnalysisStatusEnum.options).toContain('skipped_perception_quality_low');
    expect(AnalysisStatusEnum.options).toContain('partial_analysis_perception_quality_marginal');
  });
});
