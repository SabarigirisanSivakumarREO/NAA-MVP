/**
 * LocalDiskStorage — local-filesystem ScreenshotStorage (Phase 4 T075).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-13
 *     (REQ-SCREENSHOT-STORAGE-001)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T075 brief
 *
 * # Path scheme
 *
 *   <SCREENSHOTS_DIR>/<audit_run_id>/<page_url_hash>.jpg
 *
 * - `SCREENSHOTS_DIR` is read from `process.env.SCREENSHOTS_DIR` at the
 *   moment of each `put()` call (resolved fresh per-call so tests can
 *   stub the env between cases — see conformance test
 *   `tests/conformance/screenshot-storage.test.ts`). Default: `./screenshots`
 *   relative to `process.cwd()`.
 * - `page_url_hash` is the first 16 hex chars of `sha256(page_url)`. SHA-256
 *   is content-addressed (deterministic) — re-running for the same URL
 *   yields the same filename, satisfying AC-13's "stable path" contract.
 *   Timestamps / random suffixes are FORBIDDEN (kill criterion).
 *
 * # R9 + R10 compliance
 *
 * This is the SOLE concrete implementation of ScreenshotStorage that imports
 * Node `fs` / `crypto` at runtime. File under 200 lines. No S3/R2 SDK
 * dependency — R2-backed concrete deferred to post-MVP-pilot.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { createLogger } from '../observability/logger.js';
import type { ScreenshotPutOptions, ScreenshotStorage } from './ScreenshotStorage.js';

/** Default SCREENSHOTS_DIR when env var unset (resolved per call). */
const DEFAULT_SCREENSHOTS_DIR = './screenshots';

/** SHA-256 prefix length used to keep filenames short but collision-free at MVP scale. */
const URL_HASH_HEX_LEN = 16;

const log = createLogger('local-disk-storage');

/**
 * Resolve `SCREENSHOTS_DIR` against `process.cwd()` at call-time. Per-call
 * resolution (not module-load) so tests that stub `process.env.SCREENSHOTS_DIR`
 * in `beforeEach` see the override on subsequent `put()` calls.
 */
function resolveScreenshotsDir(): string {
  const raw = process.env.SCREENSHOTS_DIR ?? DEFAULT_SCREENSHOTS_DIR;
  return resolve(process.cwd(), raw);
}

/**
 * Hash a page URL into a stable filename stem. SHA-256 is overkill for a
 * filesystem key, but it removes the per-MVP-scale collision concern and
 * keeps the derivation a pure function of the URL string.
 */
function hashPageUrl(page_url: string): string {
  return createHash('sha256').update(page_url).digest('hex').slice(0, URL_HASH_HEX_LEN);
}

/**
 * Local-filesystem implementation of ScreenshotStorage. Used in dev + tests;
 * production swap to R2 happens via the adapter boundary (the interface
 * stays the same, callers don't change).
 */
export class LocalDiskStorage implements ScreenshotStorage {
  async put(buffer: Buffer, opts: ScreenshotPutOptions): Promise<string> {
    const baseDir = resolveScreenshotsDir();
    const runDir = join(baseDir, opts.audit_run_id);
    const filename = `${hashPageUrl(opts.page_url)}.jpg`;
    const filePath = join(runDir, filename);

    // Idempotent mkdir — creates audit_run_id subdir if absent; no-op otherwise.
    await mkdir(runDir, { recursive: true });
    await writeFile(filePath, buffer);

    log.debug(
      {
        audit_run_id: opts.audit_run_id,
        page_url: opts.page_url,
        bytes: buffer.length,
        path: filePath,
      },
      'screenshot written',
    );

    return filePath;
  }

  async get(path: string): Promise<Buffer> {
    const bytes = await readFile(path);
    log.debug(
      {
        path,
        bytes: bytes.length,
        parent: dirname(path),
      },
      'screenshot read',
    );
    return bytes;
  }
}
