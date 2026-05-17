/**
 * Conformance AC-14 — T5B-014 FormInputTrigger.
 *
 * Spec: phase-5b spec §20 + AC-14 (REQ-STATE-EXPL-TRIGGER-006).
 *   R26 skip ALL 6 exclusion categories: password / cc / hidden / file /
 *   PII names / captcha iframes. Per-category assertion.
 *
 * @AC-14
 */
import { describe, expect, test } from 'vitest';

import {
  FormInputTrigger,
  isExcluded,
  type FieldDescriptor,
} from '../../src/browser-runtime/triggers/FormInputTrigger.js';

function f(partial: Partial<FieldDescriptor>): FieldDescriptor {
  return {
    selector: partial.selector ?? 'input',
    tag: partial.tag ?? 'input',
    type: partial.type ?? 'text',
    name: partial.name ?? null,
    autocomplete: partial.autocomplete ?? null,
    inIframe: partial.inIframe ?? null,
  };
}

describe('FormInputTrigger R26 exclusions (AC-14)', () => {
  test('cat 1: input[type=password] is excluded', () => {
    expect(isExcluded(f({ type: 'password' })).excluded).toBe(true);
    expect(isExcluded(f({ type: 'password' })).reason).toBe('password');
  });

  test('cat 2: autocomplete=cc-* is excluded', () => {
    expect(isExcluded(f({ autocomplete: 'cc-number' })).reason).toBe('credit_card');
    expect(isExcluded(f({ autocomplete: 'cc-exp' })).excluded).toBe(true);
  });

  test('cat 3: input[type=hidden] is excluded', () => {
    expect(isExcluded(f({ type: 'hidden' })).reason).toBe('hidden');
  });

  test('cat 4: input[type=file] is excluded', () => {
    expect(isExcluded(f({ type: 'file' })).reason).toBe('file');
  });

  test('cat 5: PII names (ssn|tax|pin|nin|aadhaar|passport) excluded', () => {
    for (const n of ['ssn', 'user_tax_id', 'pin', 'nin', 'aadhaar_number', 'passport_no', 'PASSPORT', 'TAX']) {
      const r = isExcluded(f({ name: n }));
      expect(r.excluded, `name=${n}`).toBe(true);
      expect(r.reason).toBe('pii_name');
    }
  });

  test('cat 6: captcha iframes excluded', () => {
    expect(isExcluded(f({ inIframe: 'recaptcha' })).reason).toBe('captcha_iframe');
    expect(isExcluded(f({ inIframe: 'hcaptcha' })).excluded).toBe(true);
  });

  test('safe variant picker is NOT excluded', () => {
    const r = isExcluded(f({ tag: 'select', name: 'variant_color' }));
    expect(r.excluded).toBe(false);
  });

  test('fire skips excluded fields and reports per-category', async () => {
    const trigger = new FormInputTrigger();
    const out = await trigger.fire(
      { url: () => 'https://x.test/', fill: async () => undefined, selectOption: async () => [] },
      [
        f({ type: 'password', selector: '#pw' }),
        f({ tag: 'select', name: 'variant', selector: '#variant' }),
        f({ name: 'ssn', selector: '#ssn' }),
      ],
    );
    expect(out.fired_count).toBe(1);
    expect(out.skipped.length).toBe(2);
    expect(out.skipped.map((s) => s.reason).sort()).toEqual(['password', 'pii_name']);
  });
});
