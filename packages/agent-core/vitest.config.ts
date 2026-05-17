import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    environment: 'node',
    // Phase 5 T-PHASE5-TESTINFRA-DEADLOCK: pre-apply Drizzle migrations ONCE
    // before any worker spawns. Removes the cold-DDL race that previously
    // forced `--no-file-parallelism` (Phase 4 act-005 W1A; ~30s overhead).
    // When DATABASE_URL is unset, the setup silently skips.
    globalSetup: ['tests/_setup/migrations-once.ts'],
    // Phase 1b T1B-001..T1B-010: per-extractor conformance tests parse HTML
    // with DOMParser, which needs a DOM-providing environment. Keep `node`
    // as the default so Phase 1 conformance + walking-skeleton + AC-00
    // continue to run unchanged.
    environmentMatchGlobs: [
      ['tests/conformance/pricing-extractor.test.ts', 'jsdom'],
      ['tests/conformance/click-target-sizer.test.ts', 'jsdom'],
      ['tests/conformance/sticky-element-detector.test.ts', 'jsdom'],
      ['tests/conformance/popup-presence-detector.test.ts', 'jsdom'],
      ['tests/conformance/social-proof-depth.test.ts', 'jsdom'],
      ['tests/conformance/microcopy-tagger.test.ts', 'jsdom'],
      ['tests/conformance/attention-scorer.test.ts', 'jsdom'],
      ['tests/conformance/commerce-block-extractor.test.ts', 'jsdom'],
      ['tests/conformance/currency-switcher-detector.test.ts', 'jsdom'],
      // Phase 1c T1C-002..T1C-008: DOM-touching conformance tests (Shadow DOM,
      // portals, pseudo-elements, iframe classification, hidden-element capture,
      // element-graph DOMParser, nondeterminism document scan) need jsdom.
      // AC-01 SettlePredicate + AC-09 WarningEmitter + AC-10 PerceptionBundle +
      // AC-11 DeepPerceiveNode skeleton run in `node` (no DOM ops in tests).
      ['tests/conformance/shadow-dom-traverser.test.ts', 'jsdom'],
      ['tests/conformance/portal-scanner.test.ts', 'jsdom'],
      ['tests/conformance/pseudo-element-capture.test.ts', 'jsdom'],
      ['tests/conformance/iframe-policy-engine.test.ts', 'jsdom'],
      ['tests/conformance/hidden-element-capture.test.ts', 'jsdom'],
      ['tests/conformance/element-graph-builder.test.ts', 'jsdom'],
      ['tests/conformance/nondeterminism-detector.test.ts', 'jsdom'],
      // Phase 5b T5B-016 / T5B-017 cookie banner detection — DOM ops.
      ['tests/conformance/cookie-banner-detector.test.ts', 'jsdom'],
      ['tests/conformance/cookie-banner-policy.test.ts', 'jsdom'],
    ],
  },
});
