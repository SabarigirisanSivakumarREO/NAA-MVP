/**
 * Conformance test for T5B-PRE-001 — popups[] behavior fields Zod widening.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
 *     T5B-PRE-001 — Widen `popups[].isEscapeDismissible` +
 *     `popups[].isClickOutsideDismissible` from z.null() to
 *     z.boolean().nullable(). NON-BREAKING — null still accepted.
 *
 * R20 cross-phase: lands BEFORE T5B-005 / T5B-006 mutate behavior fields
 * from null to boolean at runtime.
 *
 * Anchor: @T5B-PRE-001 — popups[] Zod widening (Phase 1b → Phase 5b R20).
 */
import { describe, expect, test } from 'vitest';

import { PopupSchema } from '../../src/perception/types.js';

const validBase = {
  type: 'cookie_banner',
  selector: '#banner',
  isInitiallyOpen: true,
  hasCloseButton: true,
  closeButtonAccessibleName: 'Close',
  viewportCoveragePercent: 12,
  blocksPrimaryContent: false,
} as const;

describe('T5B-PRE-001 — popups[] behavior fields Zod widened to boolean | null', () => {
  test('accepts null (Phase 1b legacy emission)', () => {
    expect(() =>
      PopupSchema.parse({
        ...validBase,
        isEscapeDismissible: null,
        isClickOutsideDismissible: null,
      })
    ).not.toThrow();
  });

  test('accepts true (Phase 5b T5B-006 post-probe mutation)', () => {
    expect(() =>
      PopupSchema.parse({
        ...validBase,
        isEscapeDismissible: true,
        isClickOutsideDismissible: true,
      })
    ).not.toThrow();
  });

  test('accepts false (Phase 5b T5B-006 post-probe mutation)', () => {
    expect(() =>
      PopupSchema.parse({
        ...validBase,
        isEscapeDismissible: false,
        isClickOutsideDismissible: false,
      })
    ).not.toThrow();
  });

  test('rejects string (type safety preserved)', () => {
    expect(() =>
      PopupSchema.parse({
        ...validBase,
        isEscapeDismissible: 'yes',
        isClickOutsideDismissible: null,
      })
    ).toThrow();
  });

  test('rejects number (type safety preserved)', () => {
    expect(() =>
      PopupSchema.parse({
        ...validBase,
        isEscapeDismissible: null,
        isClickOutsideDismissible: 1,
      })
    ).toThrow();
  });
});
