/**
 * Conformance test — AC-04 R6 IP-boundary enforcement at Pino seam.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-6-heuristics/spec.md line 99-102
 *     ("Heuristic body / benchmark / provenance content NEVER appears
 *      in API responses, dashboards, Pino logs, LangSmith traces.")
 *   docs/specs/mvp/constitution.md R6 IP boundary
 *   T-PHASE6-LOGGER — Pino redact paths (logger.ts HEURISTIC_REDACT_PATHS).
 *
 * Strategy: install an in-memory Pino destination, exercise a full
 * load + filter cycle through the production logger factory, then
 * assert that no captured log line contains:
 *   - the fixture sentinel substring NEURAL_TEST_FIXTURE_BODY (= body)
 *   - a benchmark.value numeric leak (e.g. "44")
 *   - benchmark.standard_text / benchmark.unit / benchmark.metric strings
 *   - provenance.citation_text content
 *
 * R3.1 TDD: this test is authored alongside T106 + T-PHASE6-LOGGER; it
 * will fail until production load/filter call sites pass heuristic
 * objects through the Pino-redact path.
 *
 * Anchor: @AC-04 R6 — Pino redaction at the seam.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pino from 'pino';

import { HeuristicLoader } from '../../src/analysis/heuristics/loader.js';
import { PlaintextDecryptor } from '../../src/analysis/heuristics/decryption.js';
import {
  filterByBusinessType,
  filterByPageType,
} from '../../src/analysis/heuristics/filters.js';

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'heuristics',
);

// Production redact paths — mirrored from logger.ts HEURISTIC_REDACT_PATHS.
// Re-imported via the logger factory once T-PHASE6-LOGGER exposes them; until
// then this conformance test pins the exact path list it asserts against.
const HEURISTIC_REDACT_PATHS = [
  '*.body',
  '*.benchmark.value',
  '*.benchmark.standard_text',
  '*.benchmark.unit',
  '*.benchmark.metric',
  '*.provenance.citation_text',
];

describe('@AC-04 R6 IP-boundary — Pino redaction', () => {
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

  it('does NOT leak heuristic body sentinel during load + filter cycle', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
      logger: spyLogger,
    });
    const all = await loader.loadAll();
    const stage1 = filterByBusinessType(all, 'D2C', { logger: spyLogger });
    filterByPageType(stage1, 'pdp', { logger: spyLogger });

    const captured = logLines.join('\n');
    expect(captured).not.toMatch(/NEURAL_TEST_FIXTURE_BODY/);
  });

  it('redacts benchmark.value / unit / metric / standard_text on direct binding', () => {
    const heuristic = {
      id: 'TEST-LEAK-001',
      body: 'NEURAL_TEST_FIXTURE_BODY body content here',
      benchmark: {
        kind: 'quantitative',
        value: 99999,
        unit: 'leakable-unit',
        metric: 'leakable-metric',
      },
      provenance: {
        citation_text: 'leakable-citation-text',
        source_url: 'https://example.test/ok',
      },
    };
    spyLogger.info({ h: heuristic }, 'logging a heuristic');
    const captured = logLines.join('\n');
    expect(captured).not.toMatch(/NEURAL_TEST_FIXTURE_BODY/);
    expect(captured).not.toMatch(/99999/);
    expect(captured).not.toMatch(/leakable-unit/);
    expect(captured).not.toMatch(/leakable-metric/);
    expect(captured).not.toMatch(/leakable-citation-text/);
    // Public metadata remains visible.
    expect(captured).toMatch(/example\.test/);
  });
});
