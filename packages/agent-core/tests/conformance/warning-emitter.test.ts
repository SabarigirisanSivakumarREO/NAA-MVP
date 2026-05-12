/**
 * AC-09 — WarningEmitter conformance (REQ-ANALYZE-PERCEPTION-V25-001).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-09 + R-09
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-009
 *
 * R-09 (v0.2): Closed 12-code WarningCode enum:
 *   {SETTLE_TIMEOUT_5S, SHADOW_DOM_NOT_TRAVERSED, IFRAME_SKIPPED,
 *    FONTS_NOT_READY, ANIMATION_NOT_SETTLED, COOKIE_BANNER_BLOCKING_FOLD,
 *    AUTH_REQUIRED_DETECTED, ELEMENT_GRAPH_TRUNCATED, EXTENSION_OUTPUT_MISSING,
 *    CAPTCHA_DETECTED, CMP_DETECTED, PAYMENT_3DS_DETECTED}.
 *
 * Each Warning: { code, message, severity }. Severity ∈ {info, warn, error}
 * (no error codes in MVP — reserved).
 *
 * R3.1 TDD (Wave 0 RED): import fails with "module not found" until
 *   T1C-009 lands.
 *
 * Anchor: @AC-09 — WarningEmitter class with .emit(code, message?) and
 *   .collect() → Warning[]. Severity routed per code via WARNING_SEVERITY_MAP.
 */
import { describe, expect, it } from 'vitest';

// @ts-expect-error - module not implemented yet (Wave 0 RED for T1C-009)
import {
  WarningEmitter,
  WARNING_CODE_ENUM,
  WARNING_SEVERITY_MAP,
} from '../../src/perception/WarningEmitter.js';

type WarningCode =
  | 'SETTLE_TIMEOUT_5S'
  | 'SHADOW_DOM_NOT_TRAVERSED'
  | 'IFRAME_SKIPPED'
  | 'FONTS_NOT_READY'
  | 'ANIMATION_NOT_SETTLED'
  | 'COOKIE_BANNER_BLOCKING_FOLD'
  | 'AUTH_REQUIRED_DETECTED'
  | 'ELEMENT_GRAPH_TRUNCATED'
  | 'EXTENSION_OUTPUT_MISSING'
  | 'CAPTCHA_DETECTED'
  | 'CMP_DETECTED'
  | 'PAYMENT_3DS_DETECTED';

interface Warning {
  code: WarningCode;
  message: string;
  severity: 'info' | 'warn' | 'error';
}

const EXPECTED_CODES: WarningCode[] = [
  'SETTLE_TIMEOUT_5S',
  'SHADOW_DOM_NOT_TRAVERSED',
  'IFRAME_SKIPPED',
  'FONTS_NOT_READY',
  'ANIMATION_NOT_SETTLED',
  'COOKIE_BANNER_BLOCKING_FOLD',
  'AUTH_REQUIRED_DETECTED',
  'ELEMENT_GRAPH_TRUNCATED',
  'EXTENSION_OUTPUT_MISSING',
  'CAPTCHA_DETECTED',
  'CMP_DETECTED',
  'PAYMENT_3DS_DETECTED',
];

describe('WarningEmitter — AC-09 conformance (Wave 0 RED)', () => {
  /**
   * @AC-09 — Closed 12-code enum pinned exactly. v0.1 had 9; v0.2 added
   * EXTENSION_OUTPUT_MISSING + CAPTCHA_DETECTED + CMP_DETECTED + PAYMENT_3DS_DETECTED.
   */
  it('AC-09: WARNING_CODE_ENUM is the closed 12-code set', () => {
    expect(Array.isArray(WARNING_CODE_ENUM)).toBe(true);
    expect([...WARNING_CODE_ENUM].sort()).toEqual([...EXPECTED_CODES].sort());
    expect(WARNING_CODE_ENUM).toHaveLength(12);
  });

  /**
   * @AC-09 — Severity routing — security-sensitive + traversal failures = warn;
   * informational skips = info; no error severity in MVP.
   */
  it('AC-09: WARNING_SEVERITY_MAP routes per-code severity correctly', () => {
    expect(WARNING_SEVERITY_MAP.SETTLE_TIMEOUT_5S).toBe('warn');
    expect(WARNING_SEVERITY_MAP.SHADOW_DOM_NOT_TRAVERSED).toBe('warn');
    expect(WARNING_SEVERITY_MAP.AUTH_REQUIRED_DETECTED).toBe('warn');
    expect(WARNING_SEVERITY_MAP.ELEMENT_GRAPH_TRUNCATED).toBe('warn');
    expect(WARNING_SEVERITY_MAP.CAPTCHA_DETECTED).toBe('warn');
    expect(WARNING_SEVERITY_MAP.PAYMENT_3DS_DETECTED).toBe('warn');
    expect(WARNING_SEVERITY_MAP.CMP_DETECTED).toBe('info');
  });

  /**
   * @AC-09 — No code is assigned severity=error in MVP (reserved for future).
   */
  it('AC-09: no code has severity=error in MVP', () => {
    for (const code of EXPECTED_CODES) {
      expect(WARNING_SEVERITY_MAP[code]).not.toBe('error');
    }
  });

  /**
   * @AC-09 — emit + collect round-trip. Each entry has {code, message, severity}.
   */
  it('AC-09: emit + collect returns Warning[] with full contract shape', () => {
    const emitter = new WarningEmitter();
    emitter.emit('SETTLE_TIMEOUT_5S', 'capped at 5s');
    emitter.emit('SHADOW_DOM_NOT_TRAVERSED', 'depth>5 at host=app-root');
    const warnings: Warning[] = emitter.collect();
    expect(warnings).toHaveLength(2);
    for (const w of warnings) {
      expect(EXPECTED_CODES).toContain(w.code);
      expect(typeof w.message).toBe('string');
      expect(['info', 'warn', 'error']).toContain(w.severity);
    }
  });

  /**
   * @AC-09 — emit() with an off-enum code rejected (closed-enum contract).
   */
  it('AC-09: emitting an off-enum code throws (closed-enum guard)', () => {
    const emitter = new WarningEmitter();
    expect(() =>
      // @ts-expect-error — closed-enum contract assertion
      emitter.emit('NOT_A_REAL_CODE', 'should reject'),
    ).toThrow();
  });
});
