/**
 * ScreenshotStorage — R9 adapter interface for screenshot persistence (Phase 4 T075).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-13
 *     (REQ-SCREENSHOT-STORAGE-001)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T075 brief
 *
 * # R9 boundary
 *
 * This file is the PUBLIC interface. It has NO runtime dependency on Node
 * `fs`, `path`, `crypto`, or any cloud-storage SDK. The SOLE concrete in
 * MVP that imports `node:fs/promises` / `node:crypto` at runtime is
 * `LocalDiskStorage.ts` (same folder). An R2-backed concrete is deferred
 * to post-MVP-pilot per PRD §3.2; this interface is the seam it will
 * implement when added.
 *
 * # Contract (AC-13)
 *
 * - `put(buffer, opts)` writes the JPEG bytes for a screenshot and returns
 *   a stable string path/URL that uniquely identifies the artifact. Stable
 *   means: re-running put() for the same `audit_run_id` + `page_url` MUST
 *   yield the same path (idempotent path derivation). The implementation
 *   chooses the encoding (filesystem path for local-disk, https URL for R2).
 * - `get(path)` reads back the bytes that were last written at `path`.
 *
 * Callers (Phase 1 perception, Phase 7 annotation pipeline) never construct
 * paths themselves — they pass the return value of `put()` straight to
 * `get()` (or to the report generator, which records it).
 *
 * R10 compliance: file under 100 lines.
 */

/**
 * Per-call context attached to a screenshot write. Both fields are required:
 * the path derivation is a pure function of `(audit_run_id, page_url)`, so
 * omitting either would collapse the path namespace.
 */
export interface ScreenshotPutOptions {
  /** Audit run that produced the screenshot (uuid). Drives the parent dir. */
  audit_run_id: string;
  /** Fully-qualified page URL the screenshot was taken on. Hashed into filename. */
  page_url: string;
}

/**
 * R9 boundary for screenshot persistence. The Phase 4 MVP concrete is
 * `LocalDiskStorage`; R2/S3 backings are deferred.
 */
export interface ScreenshotStorage {
  /**
   * Write `buffer` to backing storage; return a stable string handle
   * (`get()`-able). Implementations MUST be idempotent — re-writing the
   * same `(audit_run_id, page_url)` overwrites the previous bytes and
   * returns the same path. No timestamps or random suffixes in the path.
   */
  put(buffer: Buffer, opts: ScreenshotPutOptions): Promise<string>;

  /**
   * Read the bytes last written at `path`. Throws if the path does not
   * exist (NodeJS `ENOENT` for local disk; 404 for R2 when implemented).
   */
  get(path: string): Promise<Buffer>;
}
