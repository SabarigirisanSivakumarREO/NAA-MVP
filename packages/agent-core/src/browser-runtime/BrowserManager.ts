/**
 * BrowserManager — week-1 stub: load synthetic Peregrine PDP fixture.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.4 §6 T-SKELETON-002
 *         (fixture path locked to peregrine-pdp.json per Session 8 PD-04
 *         demo-target lock; v0.3 → v0.4 patched alongside this commit).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Fixture loaded
 * from `packages/agent-core/tests/fixtures/perception/peregrine-pdp.json`
 * and returned verbatim through `PageStateModelSchema.strict().parse()`.
 *
 * Phase 1 T006-T013 supersedes with real Playwright capture in week 2. R20
 * impact.md required at that transition (PageStateModel contract surface).
 *
 * Known week-1 quirks (documented for honesty):
 *   - The fixture is returned regardless of `url` argument. If you call
 *     `capture('https://example.com')` you still get the Peregrine PDP
 *     PageStateModel — `metadata.url` will be the Peregrine URL, not the
 *     input. Phase 1 fixes this; the orchestrator's Pino `page_url`
 *     correlation field still carries the user-input URL (not the
 *     captured metadata.url) so log diagnostics remain accurate.
 *
 * R3.3 stub conventions: throws on fixture load / Zod parse failure are
 * acceptable runtime errors with specific causes (R3.3 forbids broken
 * paths in main, NOT all Errors). The orchestrator catches these in
 * apps/cli/src/commands/audit.ts.
 *
 * R10 compliance: file ≤ 100 lines.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PageStateModelSchema, checkAxTreeDepth, type PageStateModel } from '../perception/types.js';

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'tests',
  'fixtures',
  'perception',
  'peregrine-pdp.json',
);

export class BrowserManager {
  async capture(_url: string): Promise<PageStateModel> {
    const raw = JSON.parse(await readFile(FIXTURE_PATH, 'utf8')) as unknown;

    // T014 safety: check ax-tree depth BEFORE z.parse to prevent stack
    // overflow on cyclic/deep tree input. Fixtures are trusted, but using
    // the helper documents the future Phase 1 real-Playwright path which
    // will receive untrusted browser output.
    const rawObj = raw as { accessibilityTree?: { root?: unknown } };
    if (rawObj.accessibilityTree?.root !== undefined) {
      const result = checkAxTreeDepth(rawObj.accessibilityTree.root);
      if (!result.ok) {
        throw new Error(`BrowserManager fixture ax-tree malformed: ${result.reason}`);
      }
    }

    return PageStateModelSchema.parse(raw);
  }
}
