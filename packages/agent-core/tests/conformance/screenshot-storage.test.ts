/**
 * AC-13 — ScreenshotStorage conformance (Phase 4 T075).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-13
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T075
 *     (REQ-SCREENSHOT-STORAGE-001)
 *
 * AC-13 contract:
 *   - ScreenshotStorage.put(buf, opts) writes to LocalDisk in dev.
 *   - Returns stable URL/path.
 *   - get(id) reads back the same bytes.
 *   - SCREENSHOTS_DIR env var overrides default (./screenshots).
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Modules absent → import fails.
 *
 * Anchor: @AC-13 — put/get round-trip with stable path + env override.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// SUT (does not exist yet — T075 lands this in Wave 2). Import fails → RED.
import { LocalDiskStorage } from '../../src/adapters/LocalDiskStorage.js';

describe('ScreenshotStorage — AC-13 conformance (RED until T075)', () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'neural-screenshots-'));
    originalEnv = process.env.SCREENSHOTS_DIR;
    process.env.SCREENSHOTS_DIR = tempDir;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SCREENSHOTS_DIR;
    } else {
      process.env.SCREENSHOTS_DIR = originalEnv;
    }
  });

  it('AC-13: put(buf, opts) returns a stable string path', async () => {
    const storage = new LocalDiskStorage();
    const buf = Buffer.from('mock-jpeg-bytes');
    const path = await storage.put(buf, {
      audit_run_id: '00000000-0000-4000-8000-000000000C00',
      page_url: 'https://example.com/page',
    });
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(0);
  });

  it('AC-13: get(id) reads back the same bytes from a put()', async () => {
    const storage = new LocalDiskStorage();
    const original = Buffer.from('round-trip-bytes');
    const path = await storage.put(original, {
      audit_run_id: '00000000-0000-4000-8000-000000000C01',
      page_url: 'https://example.com/round-trip',
    });
    const read = await storage.get(path);
    expect(read.equals(original)).toBe(true);
  });

  it('AC-13: SCREENSHOTS_DIR env var override is honored — path is under tempDir', async () => {
    const storage = new LocalDiskStorage();
    const buf = Buffer.from('env-override');
    const path = await storage.put(buf, {
      audit_run_id: '00000000-0000-4000-8000-000000000C02',
      page_url: 'https://example.com/env',
    });
    expect(path.startsWith(tempDir)).toBe(true);
  });
});
