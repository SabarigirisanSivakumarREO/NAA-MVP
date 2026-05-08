/**
 * Walking-Skeleton — end-to-end acceptance test (T-SKELETON-010).
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.8 §6 T-SKELETON-010
 *         (acceptance: Playwright Test asserting `pnpm cro:audit --url=
 *         <Peregrine PDP>` exits 0 + writes ./out/www-peregrineclothing-
 *         co-uk-audit.txt with exactly 2 stub finding lines; runs in <30s).
 *
 * Wednesday demo gate: this test MUST pass for the week-1 demo to ship.
 *
 * Stays real through week 12 per roadmap §8 promotion table. Weeks 5+
 * un-skip behavior tests against real Claude output once Phase 7 T117
 * lands. Until then, asserts on the deterministic stub-pipeline output
 * locked at T-SKELETON-001 through T-SKELETON-009.
 *
 * R3.1 TDD: this IS the acceptance test — the discipline payoff for
 * the entire walking-skeleton week.
 *
 * R5.3 + GR-007 regression guard (AC-W6): grep banned-phrase regex
 * pack against output files. Catches future commits that might leak
 * conversion-prediction phrasing into observation strings.
 *
 * R6 regression guard (AC-W7): grep heuristic body content against
 * output files. Catches future commits that might leak heuristic
 * body via the data path (find observation referencing body) — the
 * sentinel + disclaimer prefix pattern from T0B-004 + T-SKELETON-003
 * makes leakage greppable.
 *
 * Cross-platform note: shell commands run via child_process.execSync.
 * On Windows the PATH is inherited from the parent shell; pnpm + Node
 * must be on PATH. Test runner is @playwright/test (root devDep).
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..');

const PEREGRINE_URL =
  'https://www.peregrineclothing.co.uk/collections/t-shirts/products/heavyweight-t-shirt?colour=Navy';
const SLUG = 'www-peregrineclothing-co-uk';
const AUDIT_TXT = join(REPO_ROOT, 'out', `${SLUG}-audit.txt`);
const FINDINGS_JSON = join(REPO_ROOT, 'out', `${SLUG}-findings.json`);

/**
 * R5.3 + GR-007 banned-phrase regex pack — representative; mirrors
 * T-SKELETON-004 EvaluateNode.test.ts. Phase 7 T123 (week 7) ships the
 * canonical pack with full coverage.
 */
const BANNED_PHRASE_REGEXES: readonly RegExp[] = [
  /\b(increase|boost|lift|drive|grow|improve|raise)\w*\s+(in\s+)?(conversion|revenue|sales|signups|cart\s+adds)/i,
  /\d+\s*%\s*(lift|increase|uplift|gain)/i,
  /\bROI\s+of\s+\d+/i,
  /\buplift\b/i,
  /\bwill\s+(increase|boost|drive|raise)/i,
  /\bestimated\s+revenue\b/i,
  /\bprojected\s+(conversion|revenue|sales)\b/i,
];

/** R6 sentinel + disclaimer fragments — must NEVER appear in output artifacts. */
const R6_SENTINELS: readonly string[] = ['NEURAL_TEST_FIXTURE_BODY', 'TEST FIXTURE — not a real heuristic'];

/**
 * Run `pnpm cro:audit --url=...` from repo root with a 30s hard cap.
 * execSync throws on non-zero exit OR on timeout — used as implicit
 * exit-code + wall-clock assertion in AC-W1.
 */
function runAudit(): { stdoutMs: number } {
  const start = Date.now();
  execSync(`pnpm cro:audit "--url=${PEREGRINE_URL}"`, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30_000,
  });
  return { stdoutMs: Date.now() - start };
}

test.describe('Walking Skeleton — end-to-end acceptance (T-SKELETON-010)', () => {
  test.beforeAll(() => {
    runAudit();
  });

  test('AC-W1: pnpm cro:audit exits 0 in <30s for Peregrine PDP', () => {
    const { stdoutMs } = runAudit();

    expect(stdoutMs).toBeLessThan(30_000);
  });

  test('AC-W2: orchestrator writes both ./out/<slug>-audit.txt and <slug>-findings.json', () => {
    expect(existsSync(AUDIT_TXT), `audit.txt missing at ${AUDIT_TXT}`).toBe(true);
    expect(existsSync(FINDINGS_JSON), `findings.json missing at ${FINDINGS_JSON}`).toBe(true);
  });

  test('AC-W3: audit.txt contains expected SKELETON-* finding-line markers', () => {
    const audit = readFileSync(AUDIT_TXT, 'utf8');

    expect(audit).toContain('[SKELETON-CHECKOUT-001]');
    expect(audit).toContain('[SKELETON-CONTENT-003]');
  });

  test('AC-W4: audit.txt contains locked observation substrings from T-SKELETON-004', () => {
    const audit = readFileSync(AUDIT_TXT, 'utf8');

    expect(audit).toContain('280×48px hit area');
    expect(audit).toContain('single column at x=640');
  });

  test('AC-W5: findings.json parses as JSON array with exactly 2 GroundedFinding entries', () => {
    const raw = readFileSync(FINDINGS_JSON, 'utf8');
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);

    for (const finding of parsed) {
      expect(finding).toHaveProperty('id');
      expect(finding).toHaveProperty('source', 'skeleton-stub');
      expect(finding).toHaveProperty('heuristic_id');
      expect(finding).toHaveProperty('page_url', PEREGRINE_URL);
      expect(finding).toHaveProperty('observation');
      expect(finding).toHaveProperty('verdict', 'KEEP');
    }
  });

  test('AC-W6: R5.3 + GR-007 — output files contain ZERO banned-phrase matches', () => {
    const audit = readFileSync(AUDIT_TXT, 'utf8');
    const findings = readFileSync(FINDINGS_JSON, 'utf8');
    const combined = `${audit}\n${findings}`;

    for (const pattern of BANNED_PHRASE_REGEXES) {
      expect(combined, `R5.3 violation: output matched ${pattern}`).not.toMatch(pattern);
    }
  });

  test('AC-W7: R6 — output files contain ZERO heuristic body content', () => {
    const audit = readFileSync(AUDIT_TXT, 'utf8');
    const findings = readFileSync(FINDINGS_JSON, 'utf8');
    const combined = `${audit}\n${findings}`;

    for (const sentinel of R6_SENTINELS) {
      expect(combined, `R6 violation: heuristic body fragment "${sentinel}" leaked to output`).not.toContain(sentinel);
    }
  });
});
