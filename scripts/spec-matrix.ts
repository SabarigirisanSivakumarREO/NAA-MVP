#!/usr/bin/env tsx
/**
 * pnpm spec:matrix — AC ↔ test traceability matrix.
 *
 * Source: Day 0 artifact #2 spec; consumed by `neural-ai-reviewer` skill's
 * coverage-audit and by `neural-master-orchestrator` Stage 1 pre-flight.
 *
 * Why parse the spec TABLE (not test files) for AC ownership:
 *   - AC IDs collide across phases (Phase 0's AC-01 ≠ Phase 1's AC-01).
 *   - Each phase's spec.md table maps AC-NN → expected test path canonically:
 *       | AC-NN | description | `path/to/test.test.ts` | T-NN |
 *   - Coverage = test file at the spec-listed path exists on disk.
 *   - Orphan = test file in repo NOT listed in any phase's spec table.
 *
 * Constraints (R10):
 *   - File ≤ 300 lines.
 *   - Pure read-only except writing JSON to .phase-state/<N>/preflight-coverage.json
 *     when --json requested.
 *
 * Invocation surface:
 *   pnpm spec:matrix --phase=<N>              # human summary (default)
 *   pnpm spec:matrix --phase=<N> --json       # JSON to .phase-state/<N>/
 *   pnpm spec:matrix --phase=<N> --markdown   # markdown table to stdout
 *   pnpm spec:matrix --all                     # summary across all 15 phases
 */

import { readFile, writeFile, mkdir, stat, glob } from 'node:fs/promises';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ParsedArgs {
  phase: string | undefined;
  all: boolean;
  format: 'json' | 'markdown' | 'summary';
}

interface AcEntry {
  id: string;
  spec_section: string;
  expected_test: string | null;
  test_refs: string[];
  status: 'covered' | 'missing';
}

interface TestEntry {
  path: string;
  status: 'anchored' | 'orphan';
}

interface MatrixOutput {
  phase: string;
  generated_at: string;
  acs: AcEntry[];
  tests: TestEntry[];
  summary: {
    total_acs: number;
    covered_acs: number;
    missing_acs: number;
    total_tests: number;
    anchored_tests: number;
    orphan_tests: number;
    coverage_pct: number;
  };
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PHASE_FOLDER_GLOB = 'docs/specs/mvp/phases/phase-*-*';
const TEST_GLOBS = [
  'packages/*/tests/**/*.test.ts',
  'apps/*/tests/**/*.test.ts',
  'tests/acceptance/**/*.spec.ts',
];

// Phase corpus uses TABLE format `| AC-NN | desc | test_path | T-ID |`.
// Heading format `### AC-NN` accepted as defensive fallback for future phases.
const AC_TABLE_LINE = /^\|\s*AC-(\d{2,3})\s*\|/;
const AC_HEADING_LINE = /^#{1,4}\s+AC-(\d{2,3})\b/;
const TEST_PATH_PATTERN = /[\w./\\-]+\.(?:test|spec)\.ts/;
const PHASE_FROM_FOLDER = /phase-([0-9a-z]+)-/;

function parseArgs(argv: readonly string[]): ParsedArgs {
  const args: ParsedArgs = { phase: undefined, all: false, format: 'summary' };
  for (const arg of argv) {
    if (arg.startsWith('--phase=')) args.phase = arg.slice('--phase='.length);
    else if (arg === '--all') args.all = true;
    else if (arg === '--json') args.format = 'json';
    else if (arg === '--markdown') args.format = 'markdown';
  }
  return args;
}

async function findPhaseFolders(phase: string | undefined): Promise<string[]> {
  const folders: string[] = [];
  for await (const entry of glob(PHASE_FOLDER_GLOB, { cwd: REPO_ROOT })) {
    folders.push(entry);
  }
  if (phase === undefined) return folders.sort();
  return folders.filter((f) => f.match(PHASE_FROM_FOLDER)?.[1] === phase);
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await stat(absPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeTestPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^`|`$/g, '').trim();
}

interface SpecAc {
  id: string;
  line: number;
  expected_test: string | null;
}

async function extractAcsFromSpec(specPath: string): Promise<SpecAc[]> {
  let content: string;
  try {
    content = await readFile(specPath, 'utf8');
  } catch {
    return [];
  }
  const lines = content.split('\n');
  const acs: SpecAc[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tableMatch = AC_TABLE_LINE.exec(line);
    const headingMatch = AC_HEADING_LINE.exec(line);
    const match = tableMatch ?? headingMatch;
    if (!match) continue;
    const id = `AC-${match[1]}`;
    if (seen.has(id)) continue;
    seen.add(id);

    let expectedTest: string | null = null;
    if (tableMatch) {
      // Table row: | AC-NN | description | test_path | T-NN |
      // After split on '|', cells = ['', 'AC-NN', desc, test, T-NN, '']
      const cells = line.split('|').map((c) => c.trim());
      const testCell = cells[3] ?? '';
      const pathMatch = TEST_PATH_PATTERN.exec(testCell);
      if (pathMatch) expectedTest = normalizeTestPath(pathMatch[0]);
    }
    acs.push({ id, line: i + 1, expected_test: expectedTest });
  }
  return acs;
}

async function findTestFiles(): Promise<string[]> {
  const files = new Set<string>();
  for (const pattern of TEST_GLOBS) {
    for await (const file of glob(pattern, {
      cwd: REPO_ROOT,
      exclude: (path) => path.includes('node_modules') || path.includes('dist'),
    })) {
      files.add(file.replace(/\\/g, '/'));
    }
  }
  return Array.from(files).sort();
}

async function buildAnchoredTestSet(): Promise<Set<string>> {
  const folders = await findPhaseFolders(undefined);
  const set = new Set<string>();
  for (const folder of folders) {
    const specPath = resolve(REPO_ROOT, folder, 'spec.md');
    const acs = await extractAcsFromSpec(specPath);
    for (const ac of acs) {
      if (ac.expected_test) set.add(ac.expected_test);
    }
  }
  return set;
}

async function buildMatrix(phaseFolder: string, anchoredSet: Set<string>): Promise<MatrixOutput> {
  const phase = phaseFolder.match(PHASE_FROM_FOLDER)?.[1] ?? 'unknown';
  const specPath = resolve(REPO_ROOT, phaseFolder, 'spec.md');
  const specRel = relative(REPO_ROOT, specPath).replace(/\\/g, '/');
  const acEntries = await extractAcsFromSpec(specPath);
  const allTests = await findTestFiles();

  const acs: AcEntry[] = await Promise.all(
    acEntries.map(async ({ id, line, expected_test }) => {
      const exists = expected_test ? await fileExists(resolve(REPO_ROOT, expected_test)) : false;
      return {
        id,
        spec_section: `${specRel}:${line}`,
        expected_test,
        test_refs: exists && expected_test ? [expected_test] : [],
        status: exists ? ('covered' as const) : ('missing' as const),
      };
    }),
  );

  const tests: TestEntry[] = allTests.map((path) => ({
    path,
    status: anchoredSet.has(path) ? ('anchored' as const) : ('orphan' as const),
  }));

  const totalAcs = acs.length;
  const coveredAcs = acs.filter((a) => a.status === 'covered').length;
  const totalTests = tests.length;
  const anchoredTests = tests.filter((t) => t.status === 'anchored').length;
  const coveragePct = totalAcs === 0 ? 0 : Math.round((coveredAcs / totalAcs) * 100);

  return {
    phase,
    generated_at: new Date().toISOString(),
    acs,
    tests,
    summary: {
      total_acs: totalAcs,
      covered_acs: coveredAcs,
      missing_acs: totalAcs - coveredAcs,
      total_tests: totalTests,
      anchored_tests: anchoredTests,
      orphan_tests: totalTests - anchoredTests,
      coverage_pct: coveragePct,
    },
  };
}

function formatSummary(matrix: MatrixOutput): string {
  const s = matrix.summary;
  const warnEmpty = s.total_acs === 0 ? ' ⚠ no ACs found — likely incomplete spec' : '';
  return (
    `Phase ${matrix.phase}: ${s.total_acs} ACs | ${s.covered_acs} covered | ` +
    `${s.missing_acs} missing | ${s.coverage_pct}% coverage | ` +
    `${s.orphan_tests}/${s.total_tests} orphan tests${warnEmpty}`
  );
}

function formatMarkdown(matrix: MatrixOutput): string {
  const s = matrix.summary;
  const lines: string[] = [];
  lines.push(`# Phase ${matrix.phase} — Spec ↔ Test Matrix`);
  lines.push('');
  lines.push(`**Generated:** ${matrix.generated_at}`);
  lines.push('');
  lines.push(
    `**Summary:** ${s.total_acs} ACs · ${s.covered_acs} covered · ${s.missing_acs} missing · ` +
      `${s.coverage_pct}% coverage · ${s.orphan_tests}/${s.total_tests} orphan tests`,
  );
  lines.push('');
  lines.push('## Acceptance Criteria');
  lines.push('');
  lines.push('| AC | Status | Expected Test | Exists? |');
  lines.push('|---|---|---|---|');
  for (const ac of matrix.acs) {
    const icon = ac.status === 'covered' ? '✅' : '❌';
    const test = ac.expected_test ?? '— (no test path in spec)';
    const exists = ac.test_refs.length > 0 ? '✅' : '❌';
    lines.push(`| ${ac.id} | ${icon} ${ac.status} | ${test} | ${exists} |`);
  }
  const orphans = matrix.tests.filter((t) => t.status === 'orphan');
  if (orphans.length > 0) {
    lines.push('');
    lines.push('## Orphan Tests (not anchored to any phase spec)');
    lines.push('');
    for (const t of orphans) lines.push(`- ${t.path}`);
  }
  return lines.join('\n') + '\n';
}

async function writeJsonOutput(matrix: MatrixOutput): Promise<string> {
  const outDir = resolve(REPO_ROOT, '.phase-state', matrix.phase);
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'preflight-coverage.json');
  await writeFile(outPath, JSON.stringify(matrix, null, 2) + '\n', 'utf8');
  return relative(REPO_ROOT, outPath).replace(/\\/g, '/');
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.phase && !args.all) {
    process.stderr.write('Usage: pnpm spec:matrix --phase=<N> [--json|--markdown]\n');
    process.stderr.write('       pnpm spec:matrix --all\n');
    return 2;
  }

  const phaseFolders = await findPhaseFolders(args.phase);
  if (phaseFolders.length === 0) {
    process.stderr.write(`Phase ${args.phase ?? '(any)'} folder not found.\n`);
    return 2;
  }

  const anchoredSet = await buildAnchoredTestSet();

  for (const folder of phaseFolders) {
    const matrix = await buildMatrix(folder, anchoredSet);
    if (args.format === 'json') {
      const out = await writeJsonOutput(matrix);
      process.stdout.write(`Wrote ${out}\n`);
    } else if (args.format === 'markdown') {
      process.stdout.write(formatMarkdown(matrix));
    } else {
      process.stdout.write(formatSummary(matrix) + '\n');
    }
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  });
