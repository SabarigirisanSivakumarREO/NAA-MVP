/**
 * AC-09 — Phase 3 integration test (Phase 3 T065).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-09 + NF-Phase3-03 + SC-001
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T065
 *   docs/specs/mvp/phases/phase-3-verification/impact.md
 *
 * AC-09 contract:
 *   10 synthetic ActionContract fixtures end-to-end through
 *   ActionContract → VerifyEngine.verify() → 3 MVP strategies →
 *   FailureClassifier.classify() → ConfidenceScorer.afterFailure().
 *
 *   - 3 SUCCESS (one per MVP strategy: url_change | element_appears | element_text)
 *   - 3 verify_failed (url_change about:blank; element_appears hidden CSS;
 *                       element_text mismatched substring)
 *   - 2 rate_limited (synthetic { kind:'rate' } injection)
 *   - 2 safety_blocked (synthetic { kind:'safety' } injection)
 *
 *   Wall-clock budget: < 30s (NF-Phase3-03).
 *   Confidence trend: initial × 0.97^N after N failures (float tolerance).
 *
 * RED state — Phase 3 Wave 0 (T-PHASE3-TESTS). Modules absent → imports fail.
 *
 * Anchor: @AC-09 — 10 contracts × 4 routing classes + confidence decay trend.
 */
import { describe, expect, it } from 'vitest';

import { VerifyEngine } from '../../src/verification/VerifyEngine.js';
import { FailureClassifier } from '../../src/verification/FailureClassifier.js';
import { ConfidenceScorer } from '../../src/verification/ConfidenceScorer.js';
import { UrlChangeStrategy } from '../../src/verification/strategies/UrlChangeStrategy.js';
import { ElementAppearsStrategy } from '../../src/verification/strategies/ElementAppearsStrategy.js';
import { ElementTextStrategy } from '../../src/verification/strategies/ElementTextStrategy.js';
import type {
  ActionContract,
  AggregatedVerifyResult,
} from '../../src/verification/types.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import { createLogger } from '../../src/observability/logger.js';

const PHASE3_WALL_CLOCK_MS = 30_000; // NF-Phase3-03

interface VisibilityProbe {
  present: boolean;
  boundingBox: { width: number; height: number } | null;
  computedStyle: { visibility: string; display: string; opacity: string } | null;
}

interface TextProbe {
  tagName: string;
  textContent: string | null;
  value: string | null;
}

interface FixtureScenario {
  url: string;
  visibility?: VisibilityProbe;
  text?: TextProbe;
}

/**
 * Stub MutationMonitor — always stable for integration scenarios.
 */
function stubMonitor() {
  return {
    waitForSettle: async (_opts: { page: unknown; timeoutMs: number }) =>
      ({ stable: true }) as const,
  };
}

function stubSession(scenario: FixtureScenario): BrowserSession {
  return {
    id: 'phase3-int',
    page: {
      url: () => scenario.url,
      evaluate: async (script: unknown) => {
        // The strategy chooses what to evaluate; the integration stub
        // returns the most-recently-relevant probe by inspecting the
        // script shape. Phase 3 strategies pass distinct scripts so we
        // fall through to the matching probe.
        const src = String(script);
        if (src.includes('boundingBox') || src.includes('getBoundingClientRect')) {
          return scenario.visibility ?? null;
        }
        if (src.includes('tagName') || src.includes('textContent') || src.includes('value')) {
          return scenario.text ?? null;
        }
        return null;
      },
    },
  } as unknown as BrowserSession;
}

function buildEngine(): VerifyEngine {
  const logger = createLogger('phase3-int');
  const engine = new VerifyEngine(logger);
  engine.register(new UrlChangeStrategy());
  engine.register(new ElementAppearsStrategy(stubMonitor()));
  engine.register(new ElementTextStrategy());
  return engine;
}

describe('Phase 3 integration — AC-09 acceptance gate (10 synthetic contracts)', () => {
  it(
    'AC-09: end-to-end pipeline routes 3 SUCCESS / 3 verify_failed / 2 rate / 2 safety; confidence trends multiplicatively',
    async () => {
      const engine = buildEngine();
      const logger = createLogger('phase3-int-cls');
      const classifier = new FailureClassifier(logger);
      const scorer = new ConfidenceScorer();

      // ── SUCCESS scenarios (3) ─────────────────────────────────────────
      const successContracts: { contract: ActionContract; session: BrowserSession }[] = [
        {
          contract: {
            id: '00000000-0000-4000-8000-000000000100',
            type: 'navigate',
            expected: { kind: 'urlMatches', urlMatches: 'https://example.com' },
            candidateStrategies: ['url_change'],
          } as ActionContract,
          session: stubSession({ url: 'https://example.com' }),
        },
        {
          contract: {
            id: '00000000-0000-4000-8000-000000000101',
            type: 'click',
            expected: { kind: 'elementAppears', selector: '.cart-count', timeoutMs: 5000 },
            candidateStrategies: ['element_appears'],
          } as ActionContract,
          session: stubSession({
            url: 'https://example.com',
            visibility: {
              present: true,
              boundingBox: { width: 100, height: 50 },
              computedStyle: { visibility: 'visible', display: 'block', opacity: '1' },
            },
          }),
        },
        {
          contract: {
            id: '00000000-0000-4000-8000-000000000102',
            type: 'type',
            expected: { kind: 'elementText', selector: 'input.search', text: 'amazon' },
            candidateStrategies: ['element_text'],
          } as ActionContract,
          session: stubSession({
            url: 'https://example.com',
            text: { tagName: 'INPUT', textContent: null, value: 'shop amazon today' },
          }),
        },
      ];

      for (const { contract, session } of successContracts) {
        const result = await engine.verify(contract, session);
        expect(result.ok, `expected success for ${contract.id}`).toBe(true);
      }

      // ── verify_failed scenarios (3) ────────────────────────────────────
      const failedContracts: { contract: ActionContract; session: BrowserSession; expectedSubclass?: string }[] = [
        {
          contract: {
            id: '00000000-0000-4000-8000-000000000103',
            type: 'navigate',
            expected: { kind: 'urlMatches', urlMatches: 'https://example.com' },
            candidateStrategies: ['url_change'],
          } as ActionContract,
          session: stubSession({ url: 'about:blank' }),
          expectedSubclass: 'navigation_did_not_complete',
        },
        {
          contract: {
            id: '00000000-0000-4000-8000-000000000104',
            type: 'click',
            expected: { kind: 'elementAppears', selector: '.cart-count', timeoutMs: 5000 },
            candidateStrategies: ['element_appears'],
          } as ActionContract,
          session: stubSession({
            url: 'https://example.com',
            visibility: {
              present: true,
              boundingBox: { width: 100, height: 50 },
              computedStyle: { visibility: 'hidden', display: 'block', opacity: '1' },
            },
          }),
        },
        {
          contract: {
            id: '00000000-0000-4000-8000-000000000105',
            type: 'type',
            expected: { kind: 'elementText', selector: 'input.search', text: 'amazon' },
            candidateStrategies: ['element_text'],
          } as ActionContract,
          session: stubSession({
            url: 'https://example.com',
            text: { tagName: 'INPUT', textContent: null, value: 'shop ebay today' },
          }),
        },
      ];

      let confidence = 1;
      let failureCount = 0;
      for (const { contract, session, expectedSubclass } of failedContracts) {
        const result = await engine.verify(contract, session);
        expect(result.ok, `expected fail for ${contract.id}`).toBe(false);
        if (!result.ok) {
          const cls = classifier.classify(result as AggregatedVerifyResult);
          expect(cls.class).toBe('verify_failed');
          if (expectedSubclass !== undefined) {
            expect(cls.subclass).toBe(expectedSubclass);
          }
        }
        confidence = scorer.afterFailure(confidence);
        failureCount++;
      }

      // ── rate_limited scenarios (2) ────────────────────────────────────
      for (let i = 0; i < 2; i++) {
        const cls = classifier.classify({ kind: 'rate' });
        expect(cls.class).toBe('rate_limited');
        expect(cls.shouldRetry).toBe(true);
        confidence = scorer.afterFailure(confidence);
        failureCount++;
      }

      // ── safety_blocked scenarios (2) ──────────────────────────────────
      for (let i = 0; i < 2; i++) {
        const cls = classifier.classify({ kind: 'safety' });
        expect(cls.class).toBe('safety_blocked');
        expect(cls.shouldRetry).toBe(false);
        confidence = scorer.afterFailure(confidence);
        failureCount++;
      }

      // ── confidence-decay trend ────────────────────────────────────────
      expect(failureCount).toBe(7);
      const expected = Math.pow(0.97, failureCount);
      expect(confidence).toBeCloseTo(expected, 10);
      // multiplicative bound: confidence ∈ (0, 1) after any finite N failures
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThan(1);
    },
    PHASE3_WALL_CLOCK_MS,
  );
});
