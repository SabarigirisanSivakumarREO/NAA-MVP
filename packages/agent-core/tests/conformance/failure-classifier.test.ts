/**
 * AC-07 — FailureClassifier conformance (Phase 3 T063).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-07
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T063
 *     (REQ-VERIFY-FAILURE-001)
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §FailureClassifier
 *
 * AC-07 contract — typed-class enumeration:
 *   FailureClass = 'verify_failed' | 'safety_blocked' | 'rate_limited'
 *                 | 'unverifiable' | 'bot_detected_likely'
 *   bot_detected_likely is PRE-POSITIONED for v1.1 'no_bot_block' strategy
 *   even though no MVP path produces it — type-level assertion only.
 *   classify() returns { class, subclass, shouldRetry }.
 *
 * RED state — Phase 3 Wave 0 (T-PHASE3-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-07 — 5-class enum + per-class subclass/retry routing.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import { FailureClassifier } from '../../src/verification/FailureClassifier.js';
import type {
  AggregatedVerifyResult,
  FailureClass,
} from '../../src/verification/types.js';

interface LoggerStubs {
  logger: Logger;
  childCalls: Record<string, unknown>[];
}

function stubLogger(): LoggerStubs {
  const childCalls: Record<string, unknown>[] = [];
  const childFn = vi.fn((bindings?: Record<string, unknown>) => {
    if (bindings !== undefined) childCalls.push(bindings);
    return logger;
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

describe('FailureClassifier — AC-07 conformance (RED until T063)', () => {
  it('AC-07: { kind:"safety" } → safety_blocked / pre_action_block / shouldRetry:false', () => {
    const { logger } = stubLogger();
    const classifier = new FailureClassifier(logger);
    const result = classifier.classify({ kind: 'safety' });
    expect(result.class).toBe('safety_blocked');
    expect(result.subclass).toBe('pre_action_block');
    expect(result.shouldRetry).toBe(false);
  });

  it('AC-07: { kind:"rate" } → rate_limited / domain_cap_hit / shouldRetry:true', () => {
    const { logger } = stubLogger();
    const classifier = new FailureClassifier(logger);
    const result = classifier.classify({ kind: 'rate' });
    expect(result.class).toBe('rate_limited');
    expect(result.subclass).toBe('domain_cap_hit');
    expect(result.shouldRetry).toBe(true);
  });

  it('AC-07: aggregated result with no applicable strategies → unverifiable / no_applicable_strategy / shouldRetry:false', () => {
    const { logger } = stubLogger();
    const classifier = new FailureClassifier(logger);
    const aggregate: AggregatedVerifyResult = {
      ok: false,
      attemptedStrategies: [],
      failures: [],
    };
    const result = classifier.classify(aggregate);
    expect(result.class).toBe('unverifiable');
    expect(result.subclass).toBe('no_applicable_strategy');
    expect(result.shouldRetry).toBe(false);
  });

  it('AC-07: url_change failure with actualUrl=about:blank → verify_failed / navigation_did_not_complete / shouldRetry:true', () => {
    const { logger } = stubLogger();
    const classifier = new FailureClassifier(logger);
    const aggregate: AggregatedVerifyResult = {
      ok: false,
      attemptedStrategies: ['url_change'],
      failures: [
        {
          ok: false,
          strategy: 'url_change',
          evidence: { actualUrl: 'about:blank' },
        },
      ],
    };
    const result = classifier.classify(aggregate);
    expect(result.class).toBe('verify_failed');
    expect(result.subclass).toBe('navigation_did_not_complete');
    expect(result.shouldRetry).toBe(true);
  });

  /**
   * @AC-07 — bot_detected_likely is PRE-POSITIONED for v1.1 'no_bot_block'.
   * No MVP runtime path produces it; we assert the enum *contains* the value
   * at the type level so v1.1 doesn't have to widen the enum (R18 append-only).
   */
  it('AC-07: FailureClass enum INCLUDES bot_detected_likely (pre-positioned for v1.1)', () => {
    // Type-level: the literal must be assignable to FailureClass.
    const allClasses: readonly FailureClass[] = [
      'verify_failed',
      'safety_blocked',
      'rate_limited',
      'unverifiable',
      'bot_detected_likely',
    ];
    expect(allClasses).toHaveLength(5);
    expect(allClasses).toContain('bot_detected_likely');
  });

  /**
   * @AC-07 — Pino correlation: classify() emits a `failure_class` binding
   * via a child logger. Anchors the T-PHASE3-LOGGER correlation contract
   * (the field is registered in LogBindings as of commit 4e005fd).
   */
  it('AC-07: classify() binds failure_class via Pino child logger', () => {
    const { logger, childCalls } = stubLogger();
    const classifier = new FailureClassifier(logger);
    classifier.classify({ kind: 'safety' });
    const sawFailureClass = childCalls.some(
      (c) => typeof c['failure_class'] === 'string',
    );
    expect(sawFailureClass).toBe(true);
  });

  it('AC-07: every classification carries class + subclass + shouldRetry fields', () => {
    const { logger } = stubLogger();
    const classifier = new FailureClassifier(logger);
    const result = classifier.classify({ kind: 'rate' });
    expect(result).toHaveProperty('class');
    expect(result).toHaveProperty('subclass');
    expect(result).toHaveProperty('shouldRetry');
    expect(typeof result.class).toBe('string');
    expect(typeof result.subclass).toBe('string');
    expect(typeof result.shouldRetry).toBe('boolean');
  });
});
