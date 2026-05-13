/**
 * AC-06 — VerifyEngine conformance (Phase 3 T062).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-06 + SC-003
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T062
 *     (REQ-VERIFY-002)
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §VerifyEngine
 *
 * AC-06 contract:
 *   - VerifyEngine.register(strategy) accepts any VerifyStrategy whose name
 *     is in the 9-entry VerifyStrategyNames enum (MVP + v1.1 reserved).
 *   - VerifyEngine.verify(contract, session) dispatches strategies in PRIORITY
 *     order (higher first); skips strategies whose applicable() returns false.
 *   - Success path: { ok:true, strategy:<name>, evidence?, failures:[] }.
 *   - All-fail path: { ok:false, attemptedStrategies:[...], failures:[...] }.
 *   - Forward-compat (CRITICAL): registering a v1.1 strategy (e.g. 'no_captcha')
 *     must SUCCEED without engine source-code change. Tests this by registering
 *     a stub against a v1.1 name; assertion fails if engine whitelists MVP only.
 *   - Pino correlation: every dispatch binds `verify_strategy` via a child logger.
 *
 * RED state — Phase 3 Wave 0 (T-PHASE3-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-06 — priority-ordered dispatch + forward-compat v1.1 slot.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import { VerifyEngine } from '../../src/verification/VerifyEngine.js';
import type {
  ActionContract,
  VerifyResult,
  VerifyStrategy,
  VerifyStrategyName,
} from '../../src/verification/types.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';

interface LoggerStubs {
  logger: Logger;
  childCalls: Record<string, unknown>[];
}

function stubLogger(): LoggerStubs {
  const childCalls: Record<string, unknown>[] = [];
  const childFn = vi.fn((bindings?: Record<string, unknown>) => {
    if (bindings !== undefined) childCalls.push(bindings);
    return logger; // children are themselves loggers
  });
  const fn = vi.fn();
  const logger = {
    info: fn,
    warn: fn,
    error: fn,
    debug: fn,
    child: childFn,
  } as unknown as Logger;
  return { logger, childCalls };
}

function stubSession(): BrowserSession {
  return {
    id: 'stub',
    page: { url: () => 'https://example.com', evaluate: vi.fn(async () => null) },
  } as unknown as BrowserSession;
}

function makeStrategy(
  name: VerifyStrategyName,
  priority: number,
  outcome: VerifyResult,
  isApplicable = true,
): VerifyStrategy {
  return {
    name,
    priority,
    applicable: vi.fn(() => isApplicable),
    verify: vi.fn(async () => outcome),
  } as VerifyStrategy;
}

function makeContract(candidates: VerifyStrategyName[]): ActionContract {
  return {
    id: '00000000-0000-4000-8000-000000000040',
    type: 'navigate',
    expected: { kind: 'urlMatches', urlMatches: 'https://example.com' },
    candidateStrategies: candidates,
  } as ActionContract;
}

describe('VerifyEngine — AC-06 conformance (RED until T062)', () => {
  it('AC-06: register() accepts an MVP strategy + verify() returns ok:true', async () => {
    const { logger } = stubLogger();
    const engine = new VerifyEngine(logger);
    const stratOk = makeStrategy('url_change', 100, { ok: true, strategy: 'url_change' });
    engine.register(stratOk);

    const result = await engine.verify(makeContract(['url_change']), stubSession());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.strategy).toBe('url_change');
    }
  });

  it('AC-06: applicable() === false → strategy SKIPPED (verify not invoked)', async () => {
    const { logger } = stubLogger();
    const engine = new VerifyEngine(logger);
    const inapplicable = makeStrategy(
      'element_appears',
      90,
      { ok: false, strategy: 'element_appears', error: 'should-not-run' },
      false,
    );
    const ok = makeStrategy('url_change', 50, { ok: true, strategy: 'url_change' });
    engine.register(inapplicable);
    engine.register(ok);

    const result = await engine.verify(
      makeContract(['element_appears', 'url_change']),
      stubSession(),
    );
    expect(result.ok).toBe(true);
    expect(inapplicable.verify).not.toHaveBeenCalled();
    expect(ok.verify).toHaveBeenCalledTimes(1);
  });

  it('AC-06: dispatch order is PRIORITY-DESC (highest priority runs first)', async () => {
    const { logger } = stubLogger();
    const engine = new VerifyEngine(logger);
    const calls: string[] = [];
    const low = makeStrategy('element_text', 10, { ok: false, strategy: 'element_text', error: 'fail-low' });
    (low.verify as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      calls.push('element_text');
      return { ok: false, strategy: 'element_text', error: 'fail-low' };
    });
    const high = makeStrategy('url_change', 100, { ok: false, strategy: 'url_change', error: 'fail-high' });
    (high.verify as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      calls.push('url_change');
      return { ok: false, strategy: 'url_change', error: 'fail-high' };
    });
    // Register low priority first; engine still runs high first.
    engine.register(low);
    engine.register(high);

    await engine.verify(makeContract(['url_change', 'element_text']), stubSession());
    expect(calls[0]).toBe('url_change');
    expect(calls[1]).toBe('element_text');
  });

  it('AC-06: all-fail → ok:false, attemptedStrategies + failures populated', async () => {
    const { logger } = stubLogger();
    const engine = new VerifyEngine(logger);
    const s1 = makeStrategy('url_change', 100, { ok: false, strategy: 'url_change', error: 'e1' });
    const s2 = makeStrategy('element_text', 80, { ok: false, strategy: 'element_text', error: 'e2' });
    engine.register(s1);
    engine.register(s2);

    const result = await engine.verify(makeContract(['url_change', 'element_text']), stubSession());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attemptedStrategies).toEqual(
        expect.arrayContaining(['url_change', 'element_text']),
      );
      expect(result.failures).toHaveLength(2);
    }
  });

  /**
   * @AC-06 — FORWARD-COMPAT CRITICAL ASSERTION (SC-003).
   * Registering a v1.1 strategy name ('no_captcha') must succeed WITHOUT
   * engine source-code change. If engine whitelists MVP-only names this
   * line throws and the test fails.
   */
  it('AC-06: forward-compat — register({name:"no_captcha", ...}) succeeds without engine change', () => {
    const { logger } = stubLogger();
    const engine = new VerifyEngine(logger);
    const v11Stub = makeStrategy('no_captcha', 60, { ok: true, strategy: 'no_captcha' });
    expect(() => engine.register(v11Stub)).not.toThrow();
  });

  it('AC-06: forward-compat — every v1.1 reserved name registers without throwing', () => {
    const { logger } = stubLogger();
    const engine = new VerifyEngine(logger);
    const v11Names: VerifyStrategyName[] = [
      'network_request',
      'no_error_banner',
      'snapshot_diff',
      'custom_js',
      'no_captcha',
      'no_bot_block',
    ];
    for (const name of v11Names) {
      const stub = makeStrategy(name, 10, { ok: true, strategy: name });
      expect(() => engine.register(stub)).not.toThrow();
    }
  });

  /**
   * @AC-06 — Pino correlation: each dispatched strategy contributes a
   * `verify_strategy` binding via child(). Anchors the
   * T-PHASE3-LOGGER correlation contract.
   */
  it('AC-06: dispatch binds verify_strategy via Pino child logger', async () => {
    const { logger, childCalls } = stubLogger();
    const engine = new VerifyEngine(logger);
    const strat = makeStrategy('url_change', 100, { ok: true, strategy: 'url_change' });
    engine.register(strat);
    await engine.verify(makeContract(['url_change']), stubSession());

    const sawVerifyStrategy = childCalls.some(
      (c) => typeof c['verify_strategy'] === 'string',
    );
    expect(sawVerifyStrategy).toBe(true);
  });
});
