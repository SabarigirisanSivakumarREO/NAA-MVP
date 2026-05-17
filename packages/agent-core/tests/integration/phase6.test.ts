/**
 * Integration test — AC-10 Phase 6 full heuristics-KB cycle.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-10
 *   tasks.md T-PHASE6-TESTS — full cycle: loadAll → KB →
 *     filterByBusinessType('D2C') → filterByPageType('pdp') →
 *     prioritizeHeuristics(30) → tier-validate each → R6 Pino spy assert.
 *     Wall-clock budget < 30 s on the 30-fixture synthetic library.
 *
 * R3.1 TDD: this integration test is authored alongside T106/T107/T108/
 * T109/T-PHASE6-LOGGER; it will fail until all five land. Expected red.
 *
 * Threshold deviations from spec.md (30-fixture library, not 100):
 *   - Stage 1 D2C band : [18, 25]   (spec quotes ~60-70 for 100)
 *   - Stage 2 pdp band : [4, 12]    (spec quotes ~15-20 for 100)
 *   - Prioritize cap   : 30         (matches spec)
 *
 * Anchor: @AC-10 — Phase 6 full pipeline.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pino from 'pino';

import { HeuristicLoader } from '../../src/analysis/heuristics/loader.js';
import { PlaintextDecryptor } from '../../src/analysis/heuristics/decryption.js';
import { HeuristicKnowledgeBase } from '../../src/analysis/heuristics/kb.js';
import {
  filterByBusinessType,
  filterByPageType,
} from '../../src/analysis/heuristics/filters.js';
import { prioritizeHeuristics } from '../../src/analysis/heuristics/prioritize.js';
import { TierValidator } from '../../src/analysis/heuristics/tier-validator.js';

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'heuristics',
);

const HEURISTIC_REDACT_PATHS = [
  '*.body',
  '*.benchmark.value',
  '*.benchmark.standard_text',
  '*.benchmark.unit',
  '*.benchmark.metric',
  '*.provenance.citation_text',
];

describe('@AC-10 Phase 6 full pipeline integration', () => {
  let logLines: string[];
  let spyLogger: ReturnType<typeof pino>;

  beforeEach(() => {
    logLines = [];
    const destination = { write: (msg: string) => void logLines.push(msg) };
    spyLogger = pino(
      {
        level: 'debug',
        base: null,
        redact: { paths: HEURISTIC_REDACT_PATHS, censor: '[REDACTED]' },
      },
      destination,
    );
  });

  it('runs load → KB → filter → prioritize → tier-validate without leaking IP', async () => {
    const start = Date.now();

    // 1. Load
    const loader = new HeuristicLoader({
      heuristicsDir: FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
      logger: spyLogger,
    });
    const all = await loader.loadAll();
    expect(all.length).toBeGreaterThanOrEqual(30);

    // 2. KB container
    const kb = new HeuristicKnowledgeBase(all);
    expect(kb.list().length).toBe(all.length);

    // 3. Stage 1 filter
    const stage1 = filterByBusinessType(all, 'D2C', { logger: spyLogger });
    expect(stage1.length).toBeGreaterThanOrEqual(18);
    expect(stage1.length).toBeLessThanOrEqual(25);

    // 4. Stage 2 filter
    const stage2 = filterByPageType(stage1, 'pdp', { logger: spyLogger });
    expect(stage2.length).toBeGreaterThanOrEqual(4);
    expect(stage2.length).toBeLessThanOrEqual(12);

    // 5. Prioritize (≤30 input → no truncation, but sort + determinism)
    const ranked = prioritizeHeuristics(stage2, 30);
    expect(ranked.length).toBe(stage2.length);

    // 6. Tier-validate each
    const validator = new TierValidator();
    for (const h of ranked) {
      const result = validator.classify(h);
      expect([1, 2, 3]).toContain(result.tier);
    }

    // 7. R6 boundary assert — no body / IP leaked to logs
    const captured = logLines.join('\n');
    expect(captured).not.toMatch(/NEURAL_TEST_FIXTURE_BODY/);

    // 8. Wall-clock budget
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30_000);
  });
});
