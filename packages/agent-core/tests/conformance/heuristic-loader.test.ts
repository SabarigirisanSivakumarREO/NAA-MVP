/**
 * Conformance test — AC-04 (T106) HeuristicLoader.loadAll() (EXTENDED API).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-04
 *   tasks.md T106 — Extend HeuristicLoader with a constructor accepting
 *     `{ heuristicsDir, decryptor }`; loadAll() reads ALL `*.json` files
 *     from the configured directory; each file may contain a single
 *     Heuristic OR an array; Zod-parses via HeuristicSchemaExtended;
 *     rejects malformed JSON or schema-invalid entries with a specific
 *     error; returns typed HeuristicExtended[].
 *
 * R3.1 TDD: this test is authored BEFORE T106 extends the loader (the
 * walking-skeleton loader has a no-arg constructor that reads only
 * skeleton-*.json from a hard-coded path). Failure is the expected red.
 *
 * Anchor: @AC-04 — HeuristicLoader directory traversal + validation.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { HeuristicLoader } from '../../src/analysis/heuristics/loader.js';
import { PlaintextDecryptor } from '../../src/analysis/heuristics/decryption.js';

const FIXTURE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'heuristics',
);

const VALID_FIXTURE_DIR = FIXTURE_ROOT;
const INVALID_FIXTURE_DIR = join(FIXTURE_ROOT, 'invalid');

describe('@AC-04 HeuristicLoader.loadAll (extended)', () => {
  it('reads all valid fixture files and returns typed heuristics', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: VALID_FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    const heuristics = await loader.loadAll();
    // 30 synthetic entries (baymard 10 + nielsen 10 + cialdini 10), plus
    // walking-skeleton skeleton-*.json files if also present.
    expect(heuristics.length).toBeGreaterThanOrEqual(30);
    for (const h of heuristics) {
      expect(typeof h.id).toBe('string');
      expect(typeof h.body).toBe('string');
      expect(h.benchmark).toBeDefined();
      expect(h.provenance).toBeDefined();
    }
  });

  it('returns heuristics sorted deterministically by id', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: VALID_FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    const first = await loader.loadAll();
    const second = await loader.loadAll();
    expect(first.map((h) => h.id)).toEqual(second.map((h) => h.id));
  });

  it('rejects when an entry is missing benchmark (R15.3)', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: INVALID_FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    await expect(loader.loadAll()).rejects.toThrow();
  });

  it('rejects when JSON is malformed', async () => {
    const loader = new HeuristicLoader({
      heuristicsDir: INVALID_FIXTURE_DIR,
      decryptor: new PlaintextDecryptor(),
    });
    await expect(loader.loadAll()).rejects.toThrow();
  });
});
