/**
 * Unit tests for StoreNode — T-SKELETON-008 acceptance.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.6 §6 T-SKELETON-008
 *         (acceptance: writes findings to `<outputDir>/<slug>-findings.json`
 *         and returns the absolute path; no DB — Phase 4 not yet landed).
 *
 * Coverage:
 *   - Path return: run() returns the absolute path written
 *   - File contents: findings array round-trips through JSON.parse
 *   - mkdir -p semantics: outputDir is created if it doesn't exist
 *   - Slug interpolation: filename is `<slug>-findings.json` exactly
 *   - Empty input: writes `[]` (valid JSON) and returns the path
 *   - Idempotence: second call overwrites first deterministically
 *
 * Filesystem isolation: each test creates a fresh tempdir via
 * `os.tmpdir() + mkdtemp` and cleans up via afterEach with
 * `fs.rm({recursive: true, force: true})` — Windows-safe.
 *
 * Phase 4 T070-T072 (week 3) supersedes with PostgresStorage write +
 * RLS-enforced + screenshot R2 upload. Test will then expand to assert
 * append-only trigger behavior + RLS isolation per Phase 4 plan.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StoreNode } from '../../../../src/analysis/nodes/StoreNode.js';
import { type GroundedFinding } from '../../../../src/audit/types.js';

const fixtureFindings: readonly GroundedFinding[] = [
  {
    id: 'test-finding-001',
    source: 'skeleton-stub',
    heuristic_id: 'SKELETON-CHECKOUT-001',
    page_url: 'https://example.test/page-a',
    observation: 'Test observation A.',
    verdict: 'KEEP',
  },
  {
    id: 'test-finding-002',
    source: 'skeleton-stub',
    heuristic_id: 'SKELETON-CONTENT-003',
    page_url: 'https://example.test/page-a',
    observation: 'Test observation B.',
    verdict: 'KEEP',
  },
];

describe('StoreNode (T-SKELETON-008 stub)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'neural-storenode-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('run() writes findings JSON and returns the absolute path', async () => {
    const node = new StoreNode();
    const result = await node.run({
      findings: fixtureFindings,
      outputDir: tempDir,
      slug: 'example-com',
    });

    expect(result).toBe(join(tempDir, 'example-com-findings.json'));
    const fileExists = await stat(result).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('JSON output round-trips through JSON.parse with structurally identical findings', async () => {
    const node = new StoreNode();
    const path = await node.run({
      findings: fixtureFindings,
      outputDir: tempDir,
      slug: 'example-com',
    });

    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    expect(parsed).toEqual(fixtureFindings);
  });

  it('creates outputDir if it does not exist (mkdir -p semantics)', async () => {
    const node = new StoreNode();
    const nestedDir = join(tempDir, 'nested', 'deeper');
    const path = await node.run({
      findings: fixtureFindings,
      outputDir: nestedDir,
      slug: 'example-com',
    });

    expect(path).toBe(join(nestedDir, 'example-com-findings.json'));
    const fileExists = await stat(path).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('filename uses `<slug>-findings.json` interpolation exactly', async () => {
    const node = new StoreNode();
    const path = await node.run({
      findings: fixtureFindings,
      outputDir: tempDir,
      slug: 'www-peregrineclothing-co-uk',
    });

    expect(path).toBe(join(tempDir, 'www-peregrineclothing-co-uk-findings.json'));
  });

  it('empty findings array writes `[]` (valid JSON) and returns the path', async () => {
    const node = new StoreNode();
    const path = await node.run({
      findings: [],
      outputDir: tempDir,
      slug: 'example-com',
    });

    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    expect(parsed).toEqual([]);
  });

  it('run() is idempotent — second call overwrites first deterministically', async () => {
    const node = new StoreNode();
    const a = await node.run({ findings: fixtureFindings, outputDir: tempDir, slug: 'example-com' });
    const b = await node.run({ findings: fixtureFindings, outputDir: tempDir, slug: 'example-com' });

    expect(a).toBe(b);
    const rawA = await readFile(a, 'utf8');
    expect(JSON.parse(rawA)).toEqual(fixtureFindings);
  });
});
