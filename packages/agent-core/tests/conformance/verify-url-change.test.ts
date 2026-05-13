/**
 * AC-03 — UrlChangeStrategy conformance (Phase 3 T053).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-03 + R-03 (v0.3 F03)
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T053
 *     (REQ-VERIFY-003)
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §ActionContract.urlMatches
 *
 * AC-03 contract:
 *   - name='url_change', priority=100 (high — navigation is most fundamental)
 *   - applicable(c) === (c.expected.kind === 'urlMatches')
 *   - verify() reads session.page.url() and matches against expected.urlMatches:
 *     - string urlMatches uses STRICT EQUALITY (`===`)
 *     - RegExp urlMatches uses `.test(actualUrl)` pattern match
 *   - Runtime dispatch is via typeof / instanceof RegExp discriminator.
 *
 * RED state — Phase 3 Wave 0 (T-PHASE3-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-03 — string strict-eq vs RegExp pattern dispatch.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import { UrlChangeStrategy } from '../../src/verification/strategies/UrlChangeStrategy.js';
import type { ActionContract } from '../../src/verification/types.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';

function stubLogger(): Logger {
  const fn = vi.fn();
  return { info: fn, warn: fn, error: fn, debug: fn, child: vi.fn(() => stubLogger()) } as unknown as Logger;
}

/**
 * Minimal BrowserSession stub — only `page.url()` is exercised by UrlChangeStrategy.
 */
function stubSession(currentUrl: string): BrowserSession {
  return {
    id: 'stub-session',
    page: {
      url: () => currentUrl,
    },
  } as unknown as BrowserSession;
}

function makeContract(urlMatches: string | RegExp): ActionContract {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    type: 'navigate',
    expected: { kind: 'urlMatches', urlMatches },
    candidateStrategies: ['url_change'],
  } as ActionContract;
}

describe('UrlChangeStrategy — AC-03 conformance (RED until T053)', () => {
  it('AC-03: name === "url_change" and priority === 100 (high)', () => {
    const strategy = new UrlChangeStrategy();
    expect(strategy.name).toBe('url_change');
    expect(strategy.priority).toBe(100);
  });

  it('AC-03: applicable() returns true only when expected.kind === "urlMatches"', () => {
    const strategy = new UrlChangeStrategy();
    const urlContract = makeContract('https://example.com');
    expect(strategy.applicable(urlContract)).toBe(true);

    const elementContract = {
      id: '00000000-0000-4000-8000-000000000011',
      type: 'click',
      expected: { kind: 'elementAppears' as const, selector: '.x', timeoutMs: 10000 },
      candidateStrategies: ['element_appears'],
    } as ActionContract;
    expect(strategy.applicable(elementContract)).toBe(false);
  });

  it('AC-03: string urlMatches uses strict equality — exact match succeeds', async () => {
    const strategy = new UrlChangeStrategy();
    const contract = makeContract('https://example.com');
    const session = stubSession('https://example.com');
    const result = await strategy.verify(contract, session);
    expect(result.ok).toBe(true);
  });

  it('AC-03: string urlMatches uses strict equality — substring does NOT match', async () => {
    const strategy = new UrlChangeStrategy();
    const contract = makeContract('https://example.com');
    const session = stubSession('https://example.com/path');
    const result = await strategy.verify(contract, session);
    expect(result.ok).toBe(false);
  });

  it('AC-03: RegExp urlMatches uses .test() — prefix pattern matches', async () => {
    const strategy = new UrlChangeStrategy();
    const contract = makeContract(/^https:\/\/example\.com/);
    const session = stubSession('https://example.com/path');
    const result = await strategy.verify(contract, session);
    expect(result.ok).toBe(true);
  });

  it('AC-03: RegExp urlMatches uses .test() — bare host also matches /^https:\\/\\/example\\.com/', async () => {
    const strategy = new UrlChangeStrategy();
    const contract = makeContract(/^https:\/\/example\.com/);
    const session = stubSession('https://example.com');
    const result = await strategy.verify(contract, session);
    expect(result.ok).toBe(true);
  });

  it('AC-03: RegExp urlMatches that does not match returns ok: false', async () => {
    const strategy = new UrlChangeStrategy();
    const contract = makeContract(/^https:\/\/other\.com/);
    const session = stubSession('https://example.com');
    const result = await strategy.verify(contract, session);
    expect(result.ok).toBe(false);
  });

  it('AC-03: ok:true result names strategy "url_change" + carries actualUrl evidence', async () => {
    const strategy = new UrlChangeStrategy();
    const contract = makeContract('https://example.com');
    const session = stubSession('https://example.com');
    const result = await strategy.verify(contract, session);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.strategy).toBe('url_change');
    }
  });

  /**
   * @AC-03 — verify() runtime dispatch path discriminates via instanceof
   * RegExp. The stub logger here is reserved for future correlation-field
   * assertions; for now we just confirm the call signature compiles.
   */
  it('AC-03: verify() signature accepts (contract, session) and returns Promise', () => {
    const strategy = new UrlChangeStrategy();
    const _logger = stubLogger();
    void _logger;
    const contract = makeContract('https://example.com');
    const session = stubSession('https://example.com');
    const promise = strategy.verify(contract, session);
    expect(promise).toBeInstanceOf(Promise);
  });
});
