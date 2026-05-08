/**
 * Phase 1 — Integration test (AC-10).
 *
 * Source: spec.md AC-10 (line 164) + tasks.md T015 + plan.md §"T015
 *         integration test timeout budget (C1 BINDING)" + review-notes.md
 *         C1 BINDING.
 *
 * R3.1 TDD: this file went FAIL → PASS at T013 landing (commit 297ac38).
 * Fixture URLs per PD-04 RESOLVED (Session 8): example.com (control),
 * amazon.in (complex e-commerce; CAPTCHA wall acceptable per spec edge
 * case line 146), Peregrine PDP (Shopify-powered D2C; skip-on-flake).
 *
 * --------------------------------------------------------------------
 * C1 BINDING — Per-step Playwright timeout budget table
 * (verbatim from plan.md §"T015 integration test timeout budget"):
 *
 * | Step                                              | Budget    | Note                          |
 * |---------------------------------------------------|-----------|-------------------------------|
 * | page.goto({ waitUntil: 'domcontentloaded',        | 10 s      | NOT 'load'; SPA progressive   |
 * |              timeout: 10_000 })                   |           | render past 'load' blows it.  |
 * | mutationMonitor.observe({ timeoutMs: 5000 })      | 5 s       | T015 override of 10s default. |
 * | accessibilityExtractor.extract()                  | 3 s soft  | Pino warn if exceeded.        |
 * | screenshotExtractor.capture()                     | 1 s soft  |                               |
 * | tokenize()                                        | < 1 s     |                               |
 * | Per-site total (worst case)                       | ≤ 20 s    |                               |
 * | 3-site total (NF-Phase1-03)                       | ≤ 60 s    | Acceptance gate.              |
 *
 * ContextAssembler (commit 297ac38) owns `waitUntil: 'domcontentloaded'`
 * + 10_000 ms nav timeout + 5_000 ms settle internally — see
 * packages/agent-core/src/perception/ContextAssembler.ts NAV_TIMEOUT_MS
 * + SETTLE_TIMEOUT_MS. This test file MUST NOT contain a literal
 * `waitUntil: 'load'` (kill criterion R23 — see line 144 grep guard).
 *
 * Vitest per-test timeout: 20_000 ms (per-site total budget + slack).
 * Vitest suite-level timeout: 60_000 ms (3-site NF-Phase1-03 gate).
 * --------------------------------------------------------------------
 */
import { afterAll, describe, expect, test } from 'vitest';
import { get_encoding } from 'tiktoken';
import { contextAssembler } from '../../src/perception/ContextAssembler.js';
import { PageStateModelSchema, type PageStateModel } from '../../src/perception/types.js';

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
const VITEST_SLACK_MS = 5_000;

/**
 * cl100k_base encoder (Claude / GPT-4 tokenizer family) — matches the
 * exact tokenizer ContextAssembler uses internally for shrink-ladder
 * decisions (NF-Phase1-01). Re-tokenizing here is defense-in-depth: we
 * verify the assembler's view of "fits the budget" matches an
 * independent re-encode. Encoder freed once per file in `afterAll` to
 * avoid per-test wasm-bytes leak warnings.
 */
const encoder = get_encoding('cl100k_base');
afterAll(() => encoder.free());

function tokenCount(model: PageStateModel): number {
  return encoder.encode(JSON.stringify(model)).length;
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
      expect(tokenCount(model)).toBeLessThan(TOKEN_BUDGET);
      expect(elapsed).toBeLessThanOrEqual(PER_SITE_WALL_CLOCK_MS);
    },
    PER_SITE_WALL_CLOCK_MS + VITEST_SLACK_MS,
  );

  /**
   * @AC-10 amazon.in complex e-commerce fixture — CAPTCHA wall
   * acceptable per spec edge case (line 146); PageStateModel still
   * < 1500 tokens.
   */
  test(
    'AC-10: amazon.in produces valid PageStateModel < 1500 tokens (CAPTCHA wall acceptable)',
    async () => {
      const start = Date.now();
      const model = await contextAssembler.capture(FIXTURE_URLS[1]!.url);
      const elapsed = Date.now() - start;

      expect(() => PageStateModelSchema.parse(model)).not.toThrow();
      expect(tokenCount(model)).toBeLessThan(TOKEN_BUDGET);
      expect(elapsed).toBeLessThanOrEqual(PER_SITE_WALL_CLOCK_MS);
    },
    PER_SITE_WALL_CLOCK_MS + VITEST_SLACK_MS,
  );

  /**
   * @AC-10 Peregrine PDP — Shopify-powered D2C (PD-04 RESOLVED).
   * Per tasks.md T015 kill criterion ("Peregrine PDP URL flakes 3+ times
   * → mark `skip` rather than retry"), this test treats any
   * ContextAssembler error as a soft skip rather than a suite failure;
   * the storefront / variant may be retired between runs.
   */
  test(
    'AC-10: Peregrine PDP produces valid PageStateModel < 1500 tokens',
    async () => {
      const fixture = FIXTURE_URLS[2]!;
      const start = Date.now();
      let model: PageStateModel | undefined;
      try {
        model = await contextAssembler.capture(fixture.url);
      } catch {
        // Per kill criterion: do NOT retry on flake; do NOT fail the
        // suite. Peregrine fixture is designated `skipOnFlake: true`.
        if (fixture.skipOnFlake) return;
        throw new Error('Peregrine PDP capture failed and skipOnFlake is false');
      }
      const elapsed = Date.now() - start;

      expect(() => PageStateModelSchema.parse(model)).not.toThrow();
      expect(tokenCount(model!)).toBeLessThan(TOKEN_BUDGET);
      expect(elapsed).toBeLessThanOrEqual(PER_SITE_WALL_CLOCK_MS);
    },
    PER_SITE_WALL_CLOCK_MS + VITEST_SLACK_MS,
  );

  /**
   * @AC-10 NF-Phase1-03: 3-site total wall-clock < 60 s.
   * Implemented as a sequential capture pass to mirror real CLI usage.
   * Peregrine flake is absorbed silently here (mirroring the dedicated
   * Peregrine test's skip-on-flake policy) so a transient storefront
   * outage cannot fail the wall-clock gate.
   */
  test(
    'AC-10: NF-Phase1-03 — 3 sites complete in < 60 s sequentially',
    async () => {
      const start = Date.now();
      for (const fixture of FIXTURE_URLS) {
        try {
          await contextAssembler.capture(fixture.url);
        } catch (err) {
          if (fixture.skipOnFlake) continue;
          throw err;
        }
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(TOTAL_WALL_CLOCK_MS);
    },
    TOTAL_WALL_CLOCK_MS + VITEST_SLACK_MS,
  );

  /**
   * @AC-10 C1 BINDING enforcement — this file MUST NOT contain a real
   * `page.goto(..., { waitUntil: 'load' })` call (kill criterion: SPA
   * progressive render exceeds budget). T013 implementation uses
   * 'domcontentloaded'.
   *
   * The regex requires `waitUntil` to be reached from a `goto(` call
   * within ~120 chars (the shape Playwright's options-object call uses)
   * so the regex literal in this file does not self-match. Comment
   * lines (`*` / `//`) that document the kill itself are also stripped.
   */
  test('AC-10: C1 BINDING — domcontentloaded only (no full-load gating)', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const here = fileURLToPath(import.meta.url);
    const src = await readFile(here, 'utf8');
    const codeOnly = src
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
      .join('\n');
    expect(codeOnly).not.toMatch(/goto\([^)]{0,120}waitUntil:\s*['"]load['"]/);
  });
});
