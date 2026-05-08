/**
 * HeuristicLoader — week-1 stub: load 3 synthetic skeleton fixtures.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-003
 *         (acceptance: returns 3 synthetic heuristics from
 *         `packages/agent-core/tests/fixtures/heuristics/skeleton-{1,2,3}.json`
 *         with body marked `"TEST FIXTURE — not a real heuristic"` AND
 *         embedding the literal sentinel `NEURAL_TEST_FIXTURE_BODY` per
 *         Phase 0b T0B-004 D1 BINDING precedent for cross-package R6
 *         conformance grep).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Reads all
 * `skeleton-*.json` files from the tests/fixtures/heuristics/ directory,
 * Zod-parses each via `HeuristicSchemaExtended.strict()`, returns sorted
 * by id (deterministic per stub conventions).
 *
 * Phase 6 T106 supersedes with real `FileSystemHeuristicLoader` reading
 * `heuristics-repo/` in week 4. R20 impact.md required at that transition
 * (HeuristicLoader interface + R6 channel 1 first runtime activation).
 *
 * R6 IP-boundary discipline (CRITICAL):
 *   - Loader returns Heuristic objects whose `body` field MUST NEVER be
 *     serialized to logs / API responses / dashboards / LangSmith traces.
 *   - Phase 6 T-PHASE6-LOGGER (week 4) tightens Pino redaction config at
 *     the seam; until then, the orchestrator log line for `loadHeuristics`
 *     in audit.ts logs ONLY `count` + `heuristic_ids` — NEVER body.
 *   - Roadmap §6 special kill trigger: stub heuristic body content
 *     appearing in any log = STOP per R23.
 *
 * R3.3 stub conventions: throws on fixture load / Zod parse failure are
 * acceptable runtime errors with specific causes; the orchestrator catches
 * these in apps/cli/src/commands/audit.ts.
 *
 * Why `fs.readdir` (not `glob` dep): kept agent-core deps narrow per Phase
 * 0 baseline. Filtering for `skeleton-*.json` is trivial regex; adding a
 * `glob` dep mirrors apps/cli but here we don't need its full surface.
 *
 * R10 compliance: file ≤ 100 lines.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HeuristicSchemaExtended, type HeuristicExtended } from './types.js';

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'tests',
  'fixtures',
  'heuristics',
);

const SKELETON_FIXTURE_PATTERN = /^skeleton-\d+\.json$/;

export class HeuristicLoader {
  async loadAll(): Promise<HeuristicExtended[]> {
    const entries = await readdir(FIXTURE_DIR);
    const fixtureFiles = entries.filter((name) => SKELETON_FIXTURE_PATTERN.test(name)).sort();

    const heuristics = await Promise.all(
      fixtureFiles.map(async (file) => {
        const raw = JSON.parse(await readFile(join(FIXTURE_DIR, file), 'utf8')) as unknown;
        return HeuristicSchemaExtended.parse(raw);
      }),
    );

    return heuristics.sort((a, b) => a.id.localeCompare(b.id));
  }
}
