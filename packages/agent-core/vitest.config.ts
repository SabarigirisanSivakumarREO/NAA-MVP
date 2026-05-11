import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    environment: 'node',
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
    ],
  },
});
