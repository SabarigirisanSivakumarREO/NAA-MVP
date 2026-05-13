/**
 * AC-01 — ActionContract Zod schema conformance (Phase 3 T051).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-01 + R-01
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T051
 *     (REQ-VERIFY-001)
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §ActionContract
 *
 * AC-01 contract:
 *   - ActionContractSchema validates { id (uuid), type (z.string), target?,
 *     expected (discriminated union: urlMatches | elementAppears | elementText),
 *     candidateStrategies (string[]) }
 *   - .strict() — rejects unknown top-level keys
 *   - Fixtures: 1 valid + 4 invalid (missing id; wrong type; missing expected.kind;
 *     invalid candidateStrategies)
 *
 * RED state — Phase 3 Wave 0 (T-PHASE3-TESTS).
 * `packages/agent-core/src/verification/` directory does not yet exist; this
 * test fails at import-resolution time. T051 (ActionContract type) lands the
 * source module and flips this test GREEN.
 *
 * Anchor: @AC-01 — ActionContract Zod schema + .strict() guard.
 */
import { describe, expect, it } from 'vitest';

import { ActionContractSchema } from '../../src/verification/types.js';

const VALID_CONTRACT = {
  id: '00000000-0000-4000-8000-000000000001',
  type: 'navigate',
  target: { url: 'https://example.com' },
  expected: {
    kind: 'urlMatches' as const,
    urlMatches: 'https://example.com',
  },
  candidateStrategies: ['url_change'],
};

const INVALID_MISSING_ID = {
  type: 'navigate',
  expected: { kind: 'urlMatches' as const, urlMatches: 'https://example.com' },
  candidateStrategies: ['url_change'],
};

const INVALID_WRONG_TYPE = {
  id: '00000000-0000-4000-8000-000000000002',
  type: 42, // type must be string per impact.md v0.2
  expected: { kind: 'urlMatches' as const, urlMatches: 'https://example.com' },
  candidateStrategies: ['url_change'],
};

const INVALID_MISSING_KIND = {
  id: '00000000-0000-4000-8000-000000000003',
  type: 'click',
  expected: { selector: '.cart-count' }, // missing discriminator `kind`
  candidateStrategies: ['element_appears'],
};

const INVALID_BAD_CANDIDATE_STRATEGIES = {
  id: '00000000-0000-4000-8000-000000000004',
  type: 'type',
  expected: {
    kind: 'elementText' as const,
    selector: 'input.search',
    text: 'amazon',
  },
  candidateStrategies: 'element_text', // must be array, not string
};

describe('ActionContractSchema — AC-01 conformance (RED until T051)', () => {
  it('AC-01: parses a valid navigate contract', () => {
    const parsed = ActionContractSchema.safeParse(VALID_CONTRACT);
    expect(parsed.success).toBe(true);
  });

  it('AC-01: rejects contract missing id', () => {
    const parsed = ActionContractSchema.safeParse(INVALID_MISSING_ID);
    expect(parsed.success).toBe(false);
  });

  it('AC-01: rejects contract with non-string type', () => {
    const parsed = ActionContractSchema.safeParse(INVALID_WRONG_TYPE);
    expect(parsed.success).toBe(false);
  });

  it('AC-01: rejects expected without discriminator kind', () => {
    const parsed = ActionContractSchema.safeParse(INVALID_MISSING_KIND);
    expect(parsed.success).toBe(false);
  });

  it('AC-01: rejects candidateStrategies that is not an array of strings', () => {
    const parsed = ActionContractSchema.safeParse(INVALID_BAD_CANDIDATE_STRATEGIES);
    expect(parsed.success).toBe(false);
  });

  it('AC-01: .strict() rejects unknown top-level keys', () => {
    const withUnknown = {
      ...VALID_CONTRACT,
      unknownField: 'should be rejected',
    };
    const parsed = ActionContractSchema.safeParse(withUnknown);
    expect(parsed.success).toBe(false);
  });

  it('AC-01: accepts elementAppears variant with default timeoutMs', () => {
    const parsed = ActionContractSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000005',
      type: 'click',
      expected: { kind: 'elementAppears', selector: '.cart-count' },
      candidateStrategies: ['element_appears'],
    });
    expect(parsed.success).toBe(true);
  });

  it('AC-01: accepts elementText variant with string text', () => {
    const parsed = ActionContractSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000006',
      type: 'type',
      expected: {
        kind: 'elementText',
        selector: 'input.search',
        text: 'amazon',
      },
      candidateStrategies: ['element_text'],
    });
    expect(parsed.success).toBe(true);
  });
});
