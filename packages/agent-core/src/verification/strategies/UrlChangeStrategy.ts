/**
 * UrlChangeStrategy — `url_change` MVP verify strategy (Phase 3 T053).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-03 + R-03
 *     (REQ-VERIFY-003) + Scenario 1.
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T053 brief
 *     (v0.3 F03 closure — string=strict-eq vs RegExp=.test()).
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §ActionContract
 *     `urlMatches` field — string = strict equality (===); RegExp = pattern.
 *
 * AC-03 contract:
 *   - name='url_change' (literal), priority=100 (high — navigation is the
 *     most fundamental verification).
 *   - applicable(c) iff `c.expected.kind === 'urlMatches'`.
 *   - verify() reads `session.page.url()` (synchronous Playwright wrapper);
 *     runtime-dispatches via `instanceof RegExp` on `expected.urlMatches`:
 *       - RegExp branch → `expected.urlMatches.test(actualUrl)`
 *       - String branch → `actualUrl === expected.urlMatches` (STRICT eq;
 *         substring/prefix needs a RegExp per impact.md F03).
 *   - Returns `VerifyResult` with `strategy: 'url_change'` and
 *     `evidence: { actualUrl, expected: <printable> }`; on mismatch
 *     `error: 'url_mismatch'`.
 *
 * R9 boundary: consumes `BrowserSession` from Phase 1's BrowserEngine
 *   adapter; NEVER imports Playwright directly.
 * R10: file ≤ 100 LOC; named export only; no `any`; no console.log.
 */
import type { Logger } from 'pino';

import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { ActionContract, VerifyResult, VerifyStrategy } from '../types.js';

/**
 * `url_change` strategy — post-navigation URL match.
 *
 * Optional logger correlation: when constructed with a Pino logger, binds
 * `verify_strategy: 'url_change'` + `action_id: contract.id` on a child
 * logger per the T-PHASE3-LOGGER convention (commit 4e005fd). The stub
 * logger pattern from `tests/conformance/page-analyze-v23.test.ts` is the
 * structural reference.
 */
export class UrlChangeStrategy implements VerifyStrategy {
  readonly name = 'url_change' as const;
  readonly priority = 100;

  constructor(private readonly logger?: Logger) {}

  applicable(contract: ActionContract): boolean {
    return contract.expected.kind === 'urlMatches';
  }

  async verify(contract: ActionContract, session: BrowserSession): Promise<VerifyResult> {
    // Defensive: should be unreachable when VerifyEngine respects applicable().
    if (contract.expected.kind !== 'urlMatches') {
      throw new Error('UrlChangeStrategy received non-urlMatches contract');
    }

    const child = this.logger?.child({
      verify_strategy: 'url_change',
      action_id: contract.id,
    });
    child?.debug('verify.dispatch');

    const actualUrl = session.page.url();
    const expected = contract.expected.urlMatches;

    // Runtime discriminator: RegExp uses .test() pattern match; string uses
    // strict equality. Order matters — RegExp is also a typeof === 'object',
    // so check instanceof FIRST.
    const ok = expected instanceof RegExp
      ? expected.test(actualUrl)
      : actualUrl === expected;

    const expectedDescription = expected instanceof RegExp ? expected.toString() : expected;

    if (ok) {
      child?.debug({ actualUrl }, 'verify.ok');
      return {
        ok: true,
        strategy: 'url_change',
        evidence: { actualUrl, expected: expectedDescription },
      };
    }

    child?.debug({ actualUrl, expected: expectedDescription }, 'verify.mismatch');
    return {
      ok: false,
      strategy: 'url_change',
      evidence: { actualUrl, expected: expectedDescription },
      error: 'url_mismatch',
    };
  }
}
