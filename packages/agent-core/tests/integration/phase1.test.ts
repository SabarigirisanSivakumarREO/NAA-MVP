/**
 * Phase 1 integration test — AC-10 (T015) acceptance gate.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-10
 *         (line 163); tasks.md T015 acceptance + C1 BINDING.
 *
 * R3.1 TDD: this stub MUST FAIL until T013 (ContextAssembler) lands.
 * Module-not-found at import is the expected failure mode.
 *
 * Anchor: @AC-10 — runs ContextAssembler against 3 fixture URLs
 * (example.com, amazon.in, Peregrine PDP per PD-04 RESOLVED); all 3
 * produce valid PageStateModel < 1500 tokens and the test suite exits 0.
 *
 * --------------------------------------------------------------------
 * C1 BINDING — Per-step Playwright timeout budget table
 * (Source: docs/specs/mvp/phases/phase-1-perception/plan.md §"T015
 *  integration test timeout budget (C1 BINDING)" + Session 7 R17.4
 *  review-notes.md C1).
 *
 *   page.goto({ waitUntil: 'domcontentloaded', timeout: 10000 })
 *      — 'load' is FORBIDDEN; SPAs progressively render past 'load'
 *        which would blow the per-site budget.
 *   mutationMonitor.observe({ timeoutMs: 5000 })
 *   AccessibilityExtractor:  soft-budget 3 s
 *   ScreenshotExtractor:     soft-budget 1 s
 *   Per-site total:    ≤ 20 s
 *   3-site total:      ≤ 60 s (NF-Phase1-03)
 *
 * Kill criterion: a `waitUntil: 'load'` literal in this file triggers
 * R23 STOP per tasks.md T015 per-task kill criteria.
 * --------------------------------------------------------------------
 */
import { describe, expect, test } from 'vitest';
// @ts-expect-error — module deliberately not yet implemented (T013)
import { contextAssembler } from '../../src/perception/ContextAssembler.js';
import { PageStateModelSchema } from '../../src/perception/types.js';

const FIXTURE_URLS: ReadonlyArray<{ name: string; url: string; skipOnFlake: boolean }> = [
  { name: 'example.com', url: 'https://example.com', skipOnFlake: false },
  { name: 'amazon.in', url: 'https://www.amazon.in', skipOnFlake: false },
  {
    name: 'peregrine-pdp',
    url: 'https://www.peregrineclothing.co.uk/collections/t-shirts/products/heavyweight-t-shirt?colour=Navy',
    skipOnFlake: true,
  },
];

const TOKEN_BUDGET = 1500;
const PER_SITE_WALL_CLOCK_MS = 20_000;
const TOTAL_WALL_CLOCK_MS = 60_000;

/** Approx token count via char-length / 4 — final implementation uses
 *  tiktoken cl100k_base (T013 dep). Conservative for the conformance gate. */
function approxTokens(json: string): number {
  return Math.ceil(json.length / 4);
}

describe('Phase 1 integration — AC-10 acceptance gate (3 fixture URLs)', () => {
  /**
   * @AC-10 example.com control fixture — capture returns valid
   * PageStateModel < 1500 tokens within the per-site budget.
   */
  test(
    'AC-10: example.com produces valid PageStateModel < 1500 tokens',
    async () => {
      const start = Date.now();
      const model = await contextAssembler.capture(FIXTURE_URLS[0]!.url);
      const elapsed = Date.now() - start;

      expect(() => PageStateModelSchema.parse(model)).not.toThrow();
      expect(approxTokens(JSON.stringify(model))).toBeLessThan(TOKEN_BUDGET);
      expect(elapsed).toBeLessThanOrEqual(PER_SITE_WALL_CLOCK_MS);
    },
    PER_SITE_WALL_CLOCK_MS + 5000,
  );

  /**
   * @AC-10 amazon.in complex e-commerce fixture — CAPTCHA wall
   * acceptable; PageStateModel still < 1500 tokens.
   */
  test(
    'AC-10: amazon.in produces valid PageStateModel < 1500 tokens (CAPTCHA wall acceptable)',
    async () => {
      const start = Date.now();
      const model = await contextAssembler.capture(FIXTURE_URLS[1]!.url);
      const elapsed = Date.now() - start;

      expect(() => PageStateModelSchema.parse(model)).not.toThrow();
      expect(approxTokens(JSON.stringify(model))).toBeLessThan(TOKEN_BUDGET);
      expect(elapsed).toBeLessThanOrEqual(PER_SITE_WALL_CLOCK_MS);
    },
    PER_SITE_WALL_CLOCK_MS + 5000,
  );

  /**
   * @AC-10 Peregrine PDP — Shopify-powered D2C (PD-04 RESOLVED).
   * Fixture may be skipped if storefront flake / variant retired (per
   * tasks.md T015 kill criterion: do NOT retry on flake).
   */
  test(
    'AC-10: Peregrine PDP produces valid PageStateModel < 1500 tokens',
    async () => {
      const start = Date.now();
      const model = await contextAssembler.capture(FIXTURE_URLS[2]!.url);
      const elapsed = Date.now() - start;

      expect(() => PageStateModelSchema.parse(model)).not.toThrow();
      expect(approxTokens(JSON.stringify(model))).toBeLessThan(TOKEN_BUDGET);
      expect(elapsed).toBeLessThanOrEqual(PER_SITE_WALL_CLOCK_MS);
    },
    PER_SITE_WALL_CLOCK_MS + 5000,
  );

  /**
   * @AC-10 NF-Phase1-03: 3-site total wall-clock < 60 s.
   * Implemented as a sequential capture pass to mirror real CLI usage.
   */
  test(
    'AC-10: NF-Phase1-03 — 3 sites complete in < 60 s sequentially',
    async () => {
      const start = Date.now();
      for (const fixture of FIXTURE_URLS) {
        await contextAssembler.capture(fixture.url);
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(TOTAL_WALL_CLOCK_MS);
    },
    TOTAL_WALL_CLOCK_MS + 5000,
  );

  /**
   * @AC-10 C1 BINDING enforcement — this file MUST NOT contain a
   * `waitUntil: 'load'` literal (kill criterion: SPA progressive render
   * exceeds budget). T013 implementation must use 'domcontentloaded'.
   */
  test('AC-10: C1 BINDING — no waitUntil: "load" literal in this test file', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(__filename, 'utf8');
    // Strip the comment table that documents the kill itself; only
    // `waitUntil: 'load'` as a real argument is forbidden.
    const codeOnly = src
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
      .join('\n');
    expect(codeOnly).not.toMatch(/waitUntil:\s*['"]load['"]/);
  });
});
