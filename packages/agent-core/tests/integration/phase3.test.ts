/**
 * AC-09 — Phase 3 integration test (T065).
 *
 * Spec: phases/phase-3-verification/{spec,tasks,impact}.md — AC-09 + NF-Phase3-03 + SC-001.
 * Reqs: REQ-VERIFY-001/002/003, REQ-VERIFY-FAILURE-001, REQ-VERIFY-CONFIDENCE-001.
 *
 * 10 synthetic ActionContracts end-to-end:
 *   ActionContract → VerifyEngine → {UrlChange|ElementAppears|ElementText}Strategy
 *     → FailureClassifier.classify(...) → ConfidenceScorer.afterFailure(c)
 *
 *   3 SUCCESS (one per MVP strategy) +
 *   3 verify_failed (one per MVP strategy + subclass assertion) +
 *   2 rate_limited (synthetic {kind:'rate'} injection) +
 *   2 safety_blocked (synthetic {kind:'safety'} injection)
 *   → confidence 1.0 × 0.97^7 ≈ 0.808 (R4.4 multiplicative decay).
 *
 * Wall-clock budget < 30 s (NF-Phase3-03); stub-based — typical < 20 ms.
 * R10: file ≤ 250 LOC; named exports; no `any`; no console.log; no Playwright.
 *
 * Anchor: @AC-09 — 10 contracts × 4 routing classes + decay trend.
 */
import { describe, expect, it } from 'vitest';

import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import { createLogger } from '../../src/observability/logger.js';
import {
  ConfidenceScorer,
  FailureClassifier,
  VerifyEngine,
} from '../../src/verification/index.js';
import { ElementAppearsStrategy } from '../../src/verification/strategies/ElementAppearsStrategy.js';
import { ElementTextStrategy } from '../../src/verification/strategies/ElementTextStrategy.js';
import { UrlChangeStrategy } from '../../src/verification/strategies/UrlChangeStrategy.js';
import type {
  ActionContract,
  AggregatedVerifyResult,
} from '../../src/verification/types.js';

const PHASE3_WALL_CLOCK_MS = 30_000;

interface VizProbe {
  present: boolean;
  boundingBox: { width: number; height: number } | null;
  computedStyle: { visibility: string; display: string; opacity: string } | null;
}
interface TextProbe { tagName: string; textContent: string | null; value: string | null }
interface Scenario { url: string; viz?: VizProbe; text?: TextProbe }

const VIZ_OK: VizProbe = {
  present: true,
  boundingBox: { width: 100, height: 30 },
  computedStyle: { visibility: 'visible', display: 'block', opacity: '1' },
};
const VIZ_HIDDEN: VizProbe = {
  ...VIZ_OK,
  computedStyle: { visibility: 'visible', display: 'none', opacity: '1' },
};

const stubMonitor = () => ({
  waitForSettle: async (_o: { page: unknown; timeoutMs: number }) =>
    ({ stable: true }) as const,
});

/** Stub BrowserSession. evaluate() routes by script SHAPE — visibility probe
 *  contains `boundingBox`, text probe contains `tagName`. */
function stubSession(s: Scenario): BrowserSession {
  return {
    id: 'phase3-int',
    page: {
      url: () => s.url,
      evaluate: async (script: unknown) => {
        const src = String(script);
        if (src.includes('boundingBox') || src.includes('getBoundingClientRect')) {
          return s.viz ?? null;
        }
        if (src.includes('tagName')) return s.text ?? null;
        return null;
      },
    },
  } as unknown as BrowserSession;
}

function buildEngine(): VerifyEngine {
  const engine = new VerifyEngine(createLogger('phase3-int'));
  engine.register(new UrlChangeStrategy());
  engine.register(new ElementAppearsStrategy(stubMonitor()));
  engine.register(new ElementTextStrategy());
  return engine;
}

const mkContract = (id: string, c: Omit<ActionContract, 'id'>): ActionContract => ({ id, ...c } as ActionContract);
const URL_OK = mkContract('00000000-0000-4000-8000-000000000100', {
  type: 'navigate',
  expected: { kind: 'urlMatches', urlMatches: 'https://example.com' },
  candidateStrategies: ['url_change'],
});
const APPEARS_OK = mkContract('00000000-0000-4000-8000-000000000101', {
  type: 'click',
  expected: { kind: 'elementAppears', selector: '.cart-count', timeoutMs: 5000 },
  candidateStrategies: ['element_appears'],
});
const TEXT_OK = mkContract('00000000-0000-4000-8000-000000000102', {
  type: 'type',
  expected: { kind: 'elementText', selector: 'input.search', text: 'amazon' },
  candidateStrategies: ['element_text'],
});
const URL_FAIL: ActionContract = { ...URL_OK, id: '00000000-0000-4000-8000-000000000103' };
const APPEARS_FAIL: ActionContract = { ...APPEARS_OK, id: '00000000-0000-4000-8000-000000000104' };
const TEXT_FAIL: ActionContract = { ...TEXT_OK, id: '00000000-0000-4000-8000-000000000105' };

describe('Phase 3 integration — AC-09 acceptance gate (10 synthetic contracts)', () => {
  describe('success contracts — one per MVP strategy', () => {
    it('AC-09: url_change SUCCESS — URL strict-equals https://example.com', async () => {
      const r = await buildEngine().verify(URL_OK, stubSession({ url: 'https://example.com' }));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.strategy).toBe('url_change');
    });

    it('AC-09: element_appears SUCCESS — visible .cart-count passes 3 criteria', async () => {
      const r = await buildEngine().verify(
        APPEARS_OK,
        stubSession({ url: 'https://example.com', viz: VIZ_OK }),
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.strategy).toBe('element_appears');
    });

    it('AC-09: element_text SUCCESS — INPUT.value substring match', async () => {
      const r = await buildEngine().verify(
        TEXT_OK,
        stubSession({
          url: 'https://example.com',
          text: { tagName: 'INPUT', textContent: null, value: 'amazon shopping' },
        }),
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.strategy).toBe('element_text');
    });
  });

  describe('verify_failed contracts — one per MVP strategy with subclass routing', () => {
    const classifier = new FailureClassifier(createLogger('phase3-int-cls'));

    it('AC-09: url_change FAIL → verify_failed/navigation_did_not_complete', async () => {
      const r = await buildEngine().verify(URL_FAIL, stubSession({ url: 'about:blank' }));
      expect(r.ok).toBe(false);
      expect(classifier.classify(r as AggregatedVerifyResult)).toMatchObject({
        class: 'verify_failed',
        subclass: 'navigation_did_not_complete',
        shouldRetry: true,
      });
    });

    it('AC-09: element_appears FAIL display:none → verify_failed/visibility_criterion_c', async () => {
      const r = await buildEngine().verify(
        APPEARS_FAIL,
        stubSession({ url: 'https://example.com', viz: VIZ_HIDDEN }),
      );
      expect(r.ok).toBe(false);
      expect(classifier.classify(r as AggregatedVerifyResult)).toMatchObject({
        class: 'verify_failed',
        subclass: 'visibility_criterion_c',
        shouldRetry: true,
      });
    });

    it('AC-09: element_text FAIL substring miss → verify_failed/text_mismatch', async () => {
      const r = await buildEngine().verify(
        TEXT_FAIL,
        stubSession({
          url: 'https://example.com',
          text: { tagName: 'INPUT', textContent: null, value: 'walmart deals' },
        }),
      );
      expect(r.ok).toBe(false);
      expect(classifier.classify(r as AggregatedVerifyResult)).toMatchObject({
        class: 'verify_failed',
        subclass: 'text_mismatch',
        shouldRetry: true,
      });
    });
  });

  describe('pre-action injection — synthetic safety + rate inputs', () => {
    const classifier = new FailureClassifier();

    it('AC-09: rate (×2) → rate_limited/domain_cap_hit (idempotent across contexts)', () => {
      for (let i = 0; i < 2; i++) {
        expect(classifier.classify({ kind: 'rate' })).toEqual({
          class: 'rate_limited',
          subclass: 'domain_cap_hit',
          shouldRetry: true,
        });
      }
    });

    it('AC-09: safety (×2) → safety_blocked/pre_action_block (idempotent across contexts)', () => {
      for (let i = 0; i < 2; i++) {
        expect(classifier.classify({ kind: 'safety' })).toEqual({
          class: 'safety_blocked',
          subclass: 'pre_action_block',
          shouldRetry: false,
        });
      }
    });
  });

  describe('confidence trend — R4.4 multiplicative decay across 7 failures', () => {
    it(
      'AC-09: 1.0 × 0.97^7 ≈ 0.808 after 3 verify_failed + 2 rate + 2 safety',
      async () => {
        const engine = buildEngine();
        const scorer = new ConfidenceScorer();
        let confidence = 1.0;
        let failures = 0;

        const failScenarios: Array<[ActionContract, Scenario]> = [
          [URL_FAIL, { url: 'about:blank' }],
          [APPEARS_FAIL, { url: 'https://example.com', viz: VIZ_HIDDEN }],
          [
            TEXT_FAIL,
            {
              url: 'https://example.com',
              text: { tagName: 'INPUT', textContent: null, value: 'walmart' },
            },
          ],
        ];
        for (const [contract, scenario] of failScenarios) {
          const r = await engine.verify(contract, stubSession(scenario));
          expect(r.ok).toBe(false);
          confidence = scorer.afterFailure(confidence);
          failures++;
        }
        // 2 rate + 2 safety synthetic injections — classifier covered above;
        // here we exercise the scorer-decay leg only.
        for (let i = 0; i < 4; i++) {
          confidence = scorer.afterFailure(confidence);
          failures++;
        }

        expect(failures).toBe(7);
        expect(confidence).toBeCloseTo(Math.pow(0.97, 7), 10);
        expect(confidence).toBeGreaterThan(0.8);
        expect(confidence).toBeLessThan(0.82);
      },
      PHASE3_WALL_CLOCK_MS,
    );
  });
});
