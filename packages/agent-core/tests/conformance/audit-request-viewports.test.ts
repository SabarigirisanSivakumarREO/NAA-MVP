/**
 * Conformance test for AC-01 (T5B-001) — AuditRequest.viewports field.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
 *     T5B-001 — Schema accepts ["desktop"] and ["desktop","mobile"]. Default
 *     ["desktop"]. Rejects unknown viewport names. Snake_case `viewports` at
 *     top level (Phase 4b T4B-009 convention).
 *   docs/specs/final-architecture/18-trigger-gateway.md §18
 *     REQ-GATEWAY-AUDITREQ-VIEWPORTS-001
 *
 * Anchor: @AC-01 — AuditRequest.viewports Zod lock (Phase 5b §18 ext).
 */
import { describe, expect, test } from 'vitest';

import { AuditRequestSchema } from '../../src/types/audit-request.js';

const baseRequest = {
  client_id: '00000000-0000-4000-8000-000000000000',
  urls: ['https://example.com'],
  business_type: 'D2C',
  intake: {
    goal: {
      primary_kpi: 'purchase',
      constraints: { regulatory: [] },
    },
  },
} as const;

describe('AC-01 — AuditRequest.viewports', () => {
  test('accepts ["desktop"]', () => {
    const parsed = AuditRequestSchema.parse({ ...baseRequest, viewports: ['desktop'] });
    expect(parsed.viewports).toEqual(['desktop']);
  });

  test('accepts ["desktop","mobile"]', () => {
    const parsed = AuditRequestSchema.parse({
      ...baseRequest,
      viewports: ['desktop', 'mobile'],
    });
    expect(parsed.viewports).toEqual(['desktop', 'mobile']);
  });

  test('defaults to ["desktop"] when omitted', () => {
    const parsed = AuditRequestSchema.parse({ ...baseRequest });
    expect(parsed.viewports).toEqual(['desktop']);
  });

  test('rejects unknown viewport names', () => {
    expect(() =>
      AuditRequestSchema.parse({ ...baseRequest, viewports: ['tablet'] })
    ).toThrow();
  });

  test('rejects empty viewport array', () => {
    expect(() => AuditRequestSchema.parse({ ...baseRequest, viewports: [] })).toThrow();
  });

  test('rejects non-array viewports value', () => {
    expect(() =>
      AuditRequestSchema.parse({ ...baseRequest, viewports: 'desktop' })
    ).toThrow();
  });
});
