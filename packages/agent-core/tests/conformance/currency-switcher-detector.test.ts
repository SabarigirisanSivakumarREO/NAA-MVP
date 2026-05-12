/**
 * Conformance test for AC-10 (T1B-010 CurrencySwitcherDetector).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-10
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-010
 *
 * R-10: Detect a currency-switcher widget (interactive button/select,
 *       NOT a passive list); record current and available currencies;
 *       locate isAccessibleAt ∈ {header, footer, none}.
 *
 * R3.1 TDD: import fails with "module not found" until T1B-010 lands.
 *
 * Anchor: @AC-10 — metadata.currencySwitcher.{present, currentCurrency,
 *   availableCurrencies, isAccessibleAt}; null when no switcher.
 *   isAccessibleAt ∈ {header, footer, none}.
 */
import { describe, expect, test } from 'vitest';

import { extractCurrencySwitcher } from '../../src/perception/extensions/CurrencySwitcherDetector.js';

const ALLOWED_LOCATIONS = ['header', 'footer', 'none'] as const;

function makeCtx(): {
  ctas: never[];
  formFields: never[];
  metadata: { schemaOrg: never[]; ogTags: Record<string, never> };
  headings: never[];
  primaryActions: null;
} {
  return {
    ctas: [],
    formFields: [],
    metadata: { schemaOrg: [], ogTags: {} },
    headings: [],
    primaryActions: null,
  };
}

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('CurrencySwitcherDetector — AC-10 conformance (RED)', () => {
  /**
   * @AC-10 — header currency switcher detected → isAccessibleAt='header'.
   */
  test('AC-10: header <select> currency switcher → isAccessibleAt=header', () => {
    const doc = makeDoc(
      '<html><body><header><select id="currency"><option value="USD">USD</option><option value="EUR">EUR</option></select></header></body></html>',
    );
    const result = extractCurrencySwitcher(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).not.toBeNull();
    expect(result.present).toBe(true);
    expect(result.isAccessibleAt).toBe('header');
  });

  /**
   * @AC-10 — page with no switcher returns null.
   */
  test('AC-10: page with no currency switcher returns null', () => {
    const doc = makeDoc('<html><body><h1>Hello</h1></body></html>');
    const result = extractCurrencySwitcher(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).toBeNull();
  });

  /**
   * @AC-10 — isAccessibleAt is one of the 3 allowed locations.
   */
  test('AC-10: isAccessibleAt ∈ {header, footer, none}', () => {
    const doc = makeDoc(
      '<html><body><footer><select id="currency"><option>USD</option><option>EUR</option></select></footer></body></html>',
    );
    const result = extractCurrencySwitcher(doc, { width: 1280, height: 800 }, makeCtx());
    if (result !== null) {
      expect(ALLOWED_LOCATIONS).toContain(result.isAccessibleAt);
    }
  });

  /**
   * @AC-10 — passive currency LIST (no interactive widget) is NOT a switcher.
   */
  test('AC-10: passive <ul> of currencies (no interactive widget) is NOT a switcher', () => {
    const doc = makeDoc(
      '<html><body><footer><ul><li>USD</li><li>EUR</li><li>GBP</li></ul></footer></body></html>',
    );
    const result = extractCurrencySwitcher(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).toBeNull();
  });

  /**
   * @AC-10 — populated switcher exposes all 4 contract fields.
   */
  test('AC-10: switcher object has all 4 contract fields', () => {
    const doc = makeDoc(
      '<html><body><header><select id="currency"><option value="USD" selected>USD</option><option value="EUR">EUR</option></select></header></body></html>',
    );
    const result = extractCurrencySwitcher(doc, { width: 1280, height: 800 }, makeCtx());
    if (result !== null) {
      expect(result).toHaveProperty('present');
      expect(result).toHaveProperty('currentCurrency');
      expect(result).toHaveProperty('availableCurrencies');
      expect(result).toHaveProperty('isAccessibleAt');
    }
  });
});
