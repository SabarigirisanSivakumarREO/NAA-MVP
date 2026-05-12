/**
 * SubstrateExtension parity test — Phase 1b polish (Stage 2.5 fix F-006-1b).
 *
 * Why this exists:
 *   Phase 1b ships `SubstrateExtension.ts` (pure function, jsdom-unit-testable)
 *   AND `SubstrateExtension.script.ts` (IIFE string for Playwright
 *   page.evaluate() runtime). They share extraction logic but live in
 *   separate files because the page.evaluate() sandbox cannot resolve TS
 *   imports / module syntax. This test asserts that critical extraction
 *   invariants stay in sync — drift in either file fails the test.
 *
 *   Reading both files via fs is intentional: we are NOT trying to typecheck
 *   the script string (it's plain JS by design); we're asserting the same
 *   business-logic constants + DOM selectors + output field names appear in
 *   both. If a future edit changes one without the other, this test catches
 *   the divergence before runtime.
 *
 * R10: keep this test ≤ 80 LOC.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../../src/perception/extensions');
const TS_PATH = path.join(SRC_DIR, 'SubstrateExtension.ts');
const SCRIPT_PATH = path.join(SRC_DIR, 'SubstrateExtension.script.ts');

const tsSrc = readFileSync(TS_PATH, 'utf8');
const scriptSrc = readFileSync(SCRIPT_PATH, 'utf8');

/**
 * Critical invariants that MUST appear in both files. Each entry is a
 * substring (literal — no regex) checked for presence in both sources.
 * If you add a new extractor in one file, mirror it in the other AND add
 * the relevant invariant here.
 */
const PARITY_INVARIANTS: ReadonlyArray<{ label: string; needle: string }> = [
  // primaryActions detection — text pattern + size thresholds
  { label: 'PRIMARY_ACTION_TEXT_PATTERN regex body', needle: 'add to (cart|bag|basket)|buy now|sign up|get started|subscribe|book now' },
  { label: 'MIN_PROMINENT_CTA_WIDTH_PX value', needle: '100' },
  { label: 'MIN_PROMINENT_CTA_HEIGHT_PX value', needle: '40' },

  // CTA selector universe (collectCtas)
  { label: 'CTA selector — button', needle: 'button' },
  { label: 'CTA selector — role=button', needle: '[role="button"]' },
  { label: 'CTA selector — input[type=submit]', needle: 'input[type="submit"]' },

  // JSON-LD detector
  { label: 'JSON-LD selector', needle: 'application/ld+json' },

  // og:* meta selector
  { label: 'og: meta selector', needle: 'meta[property^="og:"]' },

  // Output field names (SubstrateResult shape)
  { label: 'output field — ctas', needle: 'ctas' },
  { label: 'output field — formFields', needle: 'formFields' },
  { label: 'output field — schemaOrg', needle: 'schemaOrg' },
  { label: 'output field — ogTags', needle: 'ogTags' },
  { label: 'output field — headings', needle: 'headings' },
  { label: 'output field — primaryActions', needle: 'primaryActions' },
];

describe('SubstrateExtension parity — F-006-1b', () => {
  test('both files contain every critical invariant', () => {
    const missing: string[] = [];
    for (const { label, needle } of PARITY_INVARIANTS) {
      if (!tsSrc.includes(needle)) missing.push(`SubstrateExtension.ts missing: ${label} (${needle})`);
      if (!scriptSrc.includes(needle)) missing.push(`SubstrateExtension.script.ts missing: ${label} (${needle})`);
    }
    expect(missing).toEqual([]);
  });
});
