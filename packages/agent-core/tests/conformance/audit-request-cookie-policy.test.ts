/**
 * Conformance test for AC-18 (T5B-018) — AuditRequest.cookie_policy field.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
 *     T5B-018 — Schema accepts `dismiss | preserve`. Default `dismiss`.
 *     Rejects `block` with descriptive error (consent breakage; act-015 +
 *     act-008 snake_case `cookie_policy` lock).
 *
 * Anchor: @AC-18 — AuditRequest.cookie_policy Zod lock (Phase 5b §18 ext).
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

describe('AC-18 — AuditRequest.cookie_policy', () => {
  test('accepts "dismiss"', () => {
    const parsed = AuditRequestSchema.parse({ ...baseRequest, cookie_policy: 'dismiss' });
    expect(parsed.cookie_policy).toBe('dismiss');
  });

  test('accepts "preserve"', () => {
    const parsed = AuditRequestSchema.parse({ ...baseRequest, cookie_policy: 'preserve' });
    expect(parsed.cookie_policy).toBe('preserve');
  });

  test('defaults to "dismiss" when omitted', () => {
    const parsed = AuditRequestSchema.parse({ ...baseRequest });
    expect(parsed.cookie_policy).toBe('dismiss');
  });

  test('rejects "block" with descriptive error', () => {
    const result = AuditRequestSchema.safeParse({ ...baseRequest, cookie_policy: 'block' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = JSON.stringify(result.error.issues);
      expect(issues).toMatch(/block|consent|cookie_policy/i);
    }
  });

  test('rejects unknown values', () => {
    expect(() =>
      AuditRequestSchema.parse({ ...baseRequest, cookie_policy: 'invalid' })
    ).toThrow();
  });
});
