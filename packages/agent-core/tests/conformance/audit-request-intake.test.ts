/**
 * Conformance test for AC-09 (T4B-009) — AuditRequest intake schema.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-09 +
 *     R-10 + §Out-of-Scope act-008 (deferred-vertical lock)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-009
 *     ("Validate intake block. goal.primary_kpi REQUIRED — reject without
 *      it. constraints.regulatory non-empty for regulated verticals.")
 *   docs/specs/final-architecture/18-trigger-gateway.md §18
 *     REQ-GATEWAY-INTAKE-001..002
 *
 * AC-09 scope (this file):
 *   - PrimaryKPIEnum has the 8 LOCKED values from §18 L26-27
 *   - MVP_REGULATED_VERTICALS const has exactly the 6 LOCKED entries
 *   - AuditRequestSchema.parse() accepts a valid full-shape request
 *   - REQ-GATEWAY-INTAKE-001: missing primary_kpi rejected
 *   - REQ-GATEWAY-INTAKE-002: regulated vertical with empty regulatory[]
 *     rejected; non-regulated vertical with empty regulatory[] accepted
 *   - .strict() rejects unknown top-level fields (R25 judgment-field smoke)
 *   - Optional Phase 4b deferred-archetype + deferred-vertical warning
 *     flags carry correctly when populated
 *
 * NOT in this file (deferred to siblings):
 *   - Full §18.4 AuditRequest envelope (trigger/scope/budget/heuristic_set)
 *     — Phase 6 deliverable per §18.13
 *   - ContextCaptureNode merge semantics for `pre_audit_context` — T4B-011
 *   - 7 Phase-13b deferred verticals (cannabis / firearms / ... / telehealth)
 *     are intentionally NOT auto-rejected; no test asserts rejection for them
 *
 * Anchor: @AC-09 — AuditRequest intake Zod shape lock (Phase 4b §18 ext).
 */
import { describe, expect, test } from 'vitest';

import {
  AuditRequestIntakeSchema,
  AuditRequestSchema,
  IntakeGoalSchema,
  MVP_REGULATED_VERTICALS,
  PrimaryKPIEnum,
  isMvpRegulatedVertical,
  type AuditRequest,
} from '../../src/types/audit-request.js';

const VALID_CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_URL = 'https://example.com/products/widget';

/** Minimal valid AuditRequest fixture per AC-09. */
function makeValidRequest(): AuditRequest {
  return {
    client_id: VALID_CLIENT_ID,
    urls: [VALID_URL],
    business_type: 'D2C',
    intake: {
      business: { archetype: 'D2C', aov_tier: 'mid', vertical: 'fashion' },
      goal: {
        primary_kpi: 'purchase',
        secondary_kpis: ['add_to_cart'],
        constraints: { regulatory: [] },
      },
      traffic: { device_priority: 'mobile' },
      audience: { buyer: 'consumer' },
    },
  };
}

describe('AC-09 — AuditRequest intake schema (T4B-009)', () => {
  /** @AC-09 PrimaryKPIEnum has exactly 8 LOCKED values per §18 L26-27. */
  test('AC-09: PrimaryKPIEnum exposes 8 LOCKED values', () => {
    expect(PrimaryKPIEnum.options).toEqual([
      'purchase',
      'signup',
      'lead',
      'add_to_cart',
      'demo_request',
      'trial_start',
      'subscribe',
      'engagement',
    ]);
    expect(PrimaryKPIEnum.options).toHaveLength(8);
  });

  /** @AC-09 MVP_REGULATED_VERTICALS — exactly the 6 LOCKED per §18 L55 + R-10. */
  test('AC-09: MVP_REGULATED_VERTICALS has exactly 6 LOCKED entries', () => {
    expect([...MVP_REGULATED_VERTICALS]).toEqual([
      'pharma',
      'fintech',
      'gambling',
      'healthcare',
      'legal',
      'insurance',
    ]);
    expect(MVP_REGULATED_VERTICALS).toHaveLength(6);
  });

  /** @AC-09 isMvpRegulatedVertical narrowing — true for 6, false for others. */
  test('AC-09: isMvpRegulatedVertical type guard — covers MVP set only', () => {
    for (const v of MVP_REGULATED_VERTICALS) expect(isMvpRegulatedVertical(v)).toBe(true);
    // Phase 13b deferred verticals (act-008 closure) — NOT auto-rejected in v1.0
    expect(isMvpRegulatedVertical('cannabis')).toBe(false);
    expect(isMvpRegulatedVertical('firearms')).toBe(false);
    expect(isMvpRegulatedVertical('telehealth')).toBe(false);
    expect(isMvpRegulatedVertical('fashion')).toBe(false);
  });

  /** @AC-09 AuditRequestSchema accepts a full-shape fixture. */
  test('AC-09: AuditRequestSchema.parse() accepts valid full fixture', () => {
    const parsed = AuditRequestSchema.parse(makeValidRequest());
    expect(parsed.client_id).toBe(VALID_CLIENT_ID);
    expect(parsed.urls).toHaveLength(1);
    expect(parsed.business_type).toBe('D2C');
    expect(parsed.intake.goal.primary_kpi).toBe('purchase');
    expect(parsed.intake.traffic?.device_priority).toBe('mobile');
  });

  /** @AC-09 REQ-GATEWAY-INTAKE-001 — `goal.primary_kpi` REQUIRED. */
  test('AC-09 / REQ-GATEWAY-INTAKE-001: missing goal.primary_kpi rejected', () => {
    const bad = makeValidRequest() as unknown as { intake: { goal: Record<string, unknown> } };
    delete bad.intake.goal.primary_kpi;
    expect(() => AuditRequestSchema.parse(bad)).toThrow();
    // Also covered at the IntakeGoalSchema layer directly.
    expect(() =>
      IntakeGoalSchema.parse({ constraints: { regulatory: [] } } as unknown),
    ).toThrow();
  });

  /** @AC-09 PrimaryKPIEnum: out-of-set value rejected. */
  test('AC-09: unknown primary_kpi value rejected', () => {
    const bad = makeValidRequest();
    (bad.intake.goal as { primary_kpi: string }).primary_kpi = 'invented_kpi';
    expect(() => AuditRequestSchema.parse(bad)).toThrow();
  });

  /** @AC-09 REQ-GATEWAY-INTAKE-002 — regulated vertical needs regulatory[]. */
  test('AC-09 / REQ-GATEWAY-INTAKE-002: regulated vertical w/ empty regulatory rejected', () => {
    for (const vertical of MVP_REGULATED_VERTICALS) {
      const req = makeValidRequest();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      req.intake.business!.vertical = vertical;
      req.intake.goal.constraints.regulatory = [];
      const parsed = AuditRequestSchema.safeParse(req);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.message.includes(vertical))).toBe(true);
      }
    }
  });

  /** @AC-09 REQ-GATEWAY-INTAKE-002 — regulated vertical w/ regulatory[] ACCEPTED. */
  test('AC-09 / REQ-GATEWAY-INTAKE-002: regulated vertical w/ declared regulatory passes', () => {
    const req = makeValidRequest();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    req.intake.business!.vertical = 'fintech';
    req.intake.goal.constraints.regulatory = ['PCI', 'KYC'];
    expect(() => AuditRequestSchema.parse(req)).not.toThrow();
  });

  /** @AC-09 act-008 — Phase 13b deferred vertical NOT auto-rejected in v1.0. */
  test('AC-09 / act-008: deferred vertical (cannabis) w/ empty regulatory NOT rejected', () => {
    const req = makeValidRequest();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    req.intake.business!.vertical = 'cannabis';
    req.intake.goal.constraints.regulatory = [];
    // v1.0 emits NO warning + NO rejection per spec.md §Out-of-Scope act-008.
    expect(() => AuditRequestSchema.parse(req)).not.toThrow();
  });

  /** @AC-09 Non-regulated vertical w/ empty regulatory[] ACCEPTED. */
  test('AC-09: non-regulated vertical (fashion) w/ empty regulatory accepted', () => {
    const req = makeValidRequest();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    req.intake.business!.vertical = 'fashion';
    req.intake.goal.constraints.regulatory = [];
    expect(() => AuditRequestSchema.parse(req)).not.toThrow();
  });

  /** @AC-09 R25 + .strict() — unknown top-level fields rejected. */
  test('AC-09: .strict() rejects unknown top-level fields (R25 judgment smoke)', () => {
    const req = makeValidRequest() as unknown as Record<string, unknown>;
    req.severity = 'high';
    expect(() => AuditRequestSchema.parse(req)).toThrow();
    // Also: unknown nested field on intake block
    const req2 = makeValidRequest() as unknown as { intake: Record<string, unknown> };
    req2.intake.score = 0.9;
    expect(() => AuditRequestSchema.parse(req2)).toThrow();
  });

  /** @AC-09 act-007 — unsupported_business_archetype warning flag carries. */
  test('AC-09 / act-007: unsupported_business_archetype warning flag is optional + boolean', () => {
    const req = { ...makeValidRequest(), unsupported_business_archetype: true };
    const parsed = AuditRequestSchema.parse(req);
    expect(parsed.unsupported_business_archetype).toBe(true);
    // Omission still valid (flag is optional).
    expect(() => AuditRequestSchema.parse(makeValidRequest())).not.toThrow();
  });

  /** @AC-09 act-008 — unsupported_regulated_vertical warning flag carries. */
  test('AC-09 / act-008: unsupported_regulated_vertical warning flag is optional + boolean', () => {
    const req = { ...makeValidRequest(), unsupported_regulated_vertical: true };
    const parsed = AuditRequestSchema.parse(req);
    expect(parsed.unsupported_regulated_vertical).toBe(true);
  });

  /** @AC-09 client_id MUST be a UUID (Phase 0 RLS scope; R7.2). */
  test('AC-09: client_id must be UUID (Phase 0 RLS scope contract)', () => {
    const req = makeValidRequest();
    (req as { client_id: string }).client_id = 'not-a-uuid';
    expect(() => AuditRequestSchema.parse(req)).toThrow();
  });

  /** @AC-09 urls MUST be non-empty array of valid URLs. */
  test('AC-09: urls must be non-empty array of valid URLs', () => {
    const req = makeValidRequest();
    (req as { urls: string[] }).urls = [];
    expect(() => AuditRequestSchema.parse(req)).toThrow();
    const req2 = makeValidRequest();
    (req2 as { urls: string[] }).urls = ['not-a-url'];
    expect(() => AuditRequestSchema.parse(req2)).toThrow();
  });

  /** @AC-09 Intake schema parses standalone (Phase 6 gateway re-use point). */
  test('AC-09: AuditRequestIntakeSchema parses standalone for Phase 6 gateway re-use', () => {
    const parsed = AuditRequestIntakeSchema.parse(makeValidRequest().intake);
    expect(parsed.goal.primary_kpi).toBe('purchase');
  });
});
