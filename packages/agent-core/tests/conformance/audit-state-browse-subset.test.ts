// AC-01 — AuditState (browse-mode subset) Zod schema
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-01 v0.4
// REQ-IDs: REQ-BROWSE-NODE-001 + R-01 + R-06
// Linked task: T081
// Status: GREEN after T081 (Wave 1)

import { describe, expect, it } from 'vitest';

import { AuditStateBrowseSubsetSchema } from '../../src/orchestration/AuditState.js';

describe('AC-01 — AuditState browse-mode subset', () => {
  // Phase 4b base fields (inherited via .extend()) + minimum Phase 5 required fields.
  const baseFixture = {
    // Phase 4b base (state.ts AuditStateSchema)
    audit_run_id: '11111111-1111-1111-1111-111111111111',
    client_id: '22222222-2222-2222-2222-222222222222',
    current_node: 'audit_setup',
    node_status: 'pending' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-16T00:00:00Z'),
    updated_at: new Date('2026-05-16T00:00:00Z'),
    // Phase 5 browse-specific required (no default)
    urls_remaining: ['https://example.com'],
    budget_remaining_usd: 15.0,
  };

  it('parses minimal valid fixture and applies Phase 5 defaults', () => {
    const result = AuditStateBrowseSubsetSchema.parse(baseFixture);
    expect(result.business_type).toBe('unknown');
    expect(result.session_confidence).toBe(1.0);
    expect(result.analysis_cost_usd).toBe(0);
    expect(result.page_state_models).toEqual([]);
    expect(result.current_url).toBeUndefined();
    expect(result.completion_reason).toBeUndefined();
  });

  it('parses with full Phase 5 fields populated', () => {
    const full = {
      ...baseFixture,
      business_type: 'ecommerce' as const,
      current_url: 'https://example.com/products/1',
      session_confidence: 0.85,
      budget_remaining_usd: 12.5,
      analysis_cost_usd: 2.5,
      completion_reason: 'success' as const,
    };
    const result = AuditStateBrowseSubsetSchema.parse(full);
    expect(result.business_type).toBe('ecommerce');
    expect(result.current_url).toBe('https://example.com/products/1');
    expect(result.session_confidence).toBe(0.85);
    expect(result.analysis_cost_usd).toBe(2.5);
    expect(result.completion_reason).toBe('success');
  });

  it('parses with _phase8_extensions escape hatch populated (R20 forward-compat)', () => {
    const withExtensions = {
      ...baseFixture,
      _phase8_extensions: {
        future_field_a: 'value',
        future_field_b: 42,
        nested: { foo: 'bar' },
      },
    };
    const result = AuditStateBrowseSubsetSchema.parse(withExtensions);
    expect(result._phase8_extensions).toBeDefined();
    const ext = result._phase8_extensions as Record<string, unknown>;
    expect(ext.future_field_a).toBe('value');
    expect(ext.future_field_b).toBe(42);
    expect(ext.nested).toEqual({ foo: 'bar' });
  });

  it('rejects unknown top-level field (strict mode enforces R20 .extend() discipline)', () => {
    const invalid = {
      ...baseFixture,
      rogue_phase5_field: 'should be rejected',
    };
    expect(() => AuditStateBrowseSubsetSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid completion_reason value (enum guard)', () => {
    const invalid = {
      ...baseFixture,
      completion_reason: 'invented_reason',
    };
    expect(() => AuditStateBrowseSubsetSchema.parse(invalid)).toThrow();
  });
});
