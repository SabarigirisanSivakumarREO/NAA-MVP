/**
 * Conformance test for `pnpm heuristic:lint` CLI helper — T0B-004 acceptance.
 *
 * Source: docs/specs/mvp/phases/phase-0b-heuristics/{spec.md v0.5 AC-04 + AC-13,
 *         plan.md v0.5 §5} + tasks.md T0B-004.
 *
 * Coverage:
 *   AC-04 — 5 fail cases + 1 pass case + D1 BINDING (Zod-error redaction +
 *           NEURAL_TEST_FIXTURE_BODY sentinel assertion)
 *   AC-13 — 5-channel R6 isolation:
 *           (a) .gitignore contains .heuristic-drafts/    [ASSERT]
 *           (b) drafting subprocess does NOT import langsmith / @langsmith/*
 *               [VACUOUS — drafting subprocess not yet authored;
 *                test logs TODO + passes; un-skip when scripts/draft-heuristic.ts lands]
 *           (c) drafting subprocess does NOT import packages/agent-core/src/observability/*
 *               [VACUOUS — same reason]
 *           (d) drafting subprocess script is NOT imported by any apps/ or packages/ runtime module
 *               [VACUOUS — same reason]
 *           (e) apps/dashboard/**\/* source does NOT reference drafting subprocess paths
 *               [VACUOUS — apps/dashboard not yet authored (Phase 9); test logs TODO + passes;
 *                un-skip when Phase 9 ships]
 *
 * D1 BINDING (focal):
 *   The lint output MUST NEVER include heuristic body / benchmark / provenance
 *   field VALUES (only field paths + error class codes). The fixtures embed
 *   the sentinel `NEURAL_TEST_FIXTURE_BODY` in body so we can assert the
 *   sentinel does NOT appear in stderr/stdout — proving the redaction holds.
 *
 * R10.6 exception:
 *   Lint CLI uses process.stdout.write / process.stderr.write — no Pino.
 *   This test captures via Vitest spies.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lintFile, runLint, formatErrorLine } from '../../src/commands/heuristic-lint.js';

// Sentinel string from D1 BINDING (Phase 0b review-notes.md). All test
// fixtures embed this in their body field — if the lint CLI leaks body
// content, it will appear in stderr/stdout and fail the redaction assertion.
const D1_SENTINEL = 'NEURAL_TEST_FIXTURE_BODY';

// Resolve fixtures dir relative to this test file (works regardless of cwd
// at test invocation time).
const FIXTURES_DIR = resolve(__dirname, '../fixtures/heuristics');

// Repo root — climb three levels up from this test file
// (apps/cli/tests/conformance/heuristic-lint.test.ts → repo root).
const REPO_ROOT = resolve(__dirname, '../../../..');

const fixturePath = (name: string): string => join(FIXTURES_DIR, name);

// ----------------------------------------------------------------------
// AC-04 — 5 fail cases + 1 pass case (lintFile direct invocation)
// ----------------------------------------------------------------------

describe('AC-04: lintFile — schema + manifest + banned-phrase checks', () => {
  it('passes a valid heuristic JSON (1 pass case)', () => {
    const errors = lintFile(fixturePath('valid.json'));
    expect(errors).toEqual([]);
  });

  it('rejects when provenance.source_url is missing (Zod fail — strict)', () => {
    const errors = lintFile(
      fixturePath('invalid-missing-provenance-source-url.json'),
    );
    expect(errors.length).toBeGreaterThan(0);
    // Zod issue path should reference provenance / source_url
    const fieldPaths = errors.map((e) => e.field_path);
    expect(fieldPaths.some((p) => p.includes('provenance'))).toBe(true);
  });

  it('rejects when benchmark is missing (Zod fail — discriminated union)', () => {
    const errors = lintFile(fixturePath('invalid-missing-benchmark.json'));
    expect(errors.length).toBeGreaterThan(0);
    const fieldPaths = errors.map((e) => e.field_path);
    expect(fieldPaths.some((p) => p.includes('benchmark'))).toBe(true);
  });

  it('rejects when archetype manifest selector is missing (Phase 0b R-09 enforcement)', () => {
    const errors = lintFile(
      fixturePath('invalid-missing-archetype-selector.json'),
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.some(
        (e) =>
          e.field_path === 'archetype' &&
          e.error_class === 'missing_manifest_selector',
      ),
    ).toBe(true);
  });

  it('rejects when body contains banned conversion-rate phrase (R5.3 + GR-007 — v0.5 patch target)', () => {
    const errors = lintFile(fixturePath('invalid-banned-phrase.json'));
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.some(
        (e) =>
          e.field_path === 'body' &&
          e.error_class === 'banned_phrase_conversion_prediction',
      ),
    ).toBe(true);
  });

  it('rejects malformed JSON (check 0 — JSON parse failure)', () => {
    const errors = lintFile(fixturePath('invalid-json-syntax.json'));
    expect(errors.length).toBe(1);
    expect(errors[0]?.error_class).toBe('json_parse_error');
    expect(errors[0]?.field_path).toBe('<root>');
  });
});

// ----------------------------------------------------------------------
// D1 BINDING — Zod-error redaction + sentinel assertion
// ----------------------------------------------------------------------

describe('D1 BINDING: lint output redacts heuristic content (NEURAL_TEST_FIXTURE_BODY sentinel)', () => {
  it('formatErrorLine output does NOT contain D1 sentinel', () => {
    // Even with a hostile field_path/error_class, formatErrorLine must not
    // surface anything beyond the documented shape.
    const line = formatErrorLine({
      file: 'fixtures/foo.json',
      field_path: 'body',
      error_class: 'banned_phrase_conversion_prediction',
    });
    expect(line).not.toContain(D1_SENTINEL);
    expect(line).toBe(
      'fixtures/foo.json: body — banned_phrase_conversion_prediction',
    );
  });

  it('lintFile errors NEVER include heuristic body content (sentinel check)', () => {
    // All 5 invalid fixtures contain D1_SENTINEL in their body.
    // If lintFile somehow surfaced body content (via Zod issue.message
    // leaking through), the sentinel would appear in the returned errors.
    const fixtures = [
      'invalid-missing-provenance-source-url.json',
      'invalid-missing-benchmark.json',
      'invalid-missing-archetype-selector.json',
      'invalid-banned-phrase.json',
      // NOT invalid-json-syntax.json — that file fails before body is parsed
    ];
    for (const fixture of fixtures) {
      const errors = lintFile(fixturePath(fixture));
      for (const err of errors) {
        const serialized = JSON.stringify(err);
        expect(serialized).not.toContain(D1_SENTINEL);
        expect(formatErrorLine(err)).not.toContain(D1_SENTINEL);
      }
    }
  });

  it('runLint stderr output NEVER contains D1 sentinel even on schema failures', async () => {
    // Spy on process.stderr.write to capture all output.
    const stderrWrites: string[] = [];
    const stdoutWrites: string[] = [];
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        stderrWrites.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      });
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        stdoutWrites.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      });

    try {
      const fixturesPattern = fixturePath('invalid-*.json').replace(/\\/g, '/');
      const exitCode = await runLint([fixturesPattern]);
      expect(exitCode).toBe(1); // at least one failure
    } finally {
      stderrSpy.mockRestore();
      stdoutSpy.mockRestore();
    }

    const allOutput = stderrWrites.join('') + stdoutWrites.join('');
    expect(allOutput).not.toContain(D1_SENTINEL);
  });
});

// ----------------------------------------------------------------------
// runLint — top-level invocation behavior
// ----------------------------------------------------------------------

describe('runLint: top-level invocation', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((): boolean => true);
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((): boolean => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it('exits with code 0 when valid.json passes', async () => {
    const exitCode = await runLint([fixturePath('valid.json')]);
    expect(exitCode).toBe(0);
  });

  it('exits with code 1 when at least one file fails', async () => {
    const exitCode = await runLint([fixturePath('invalid-banned-phrase.json')]);
    expect(exitCode).toBe(1);
  });

  it('exits with code 2 when no patterns provided (usage error)', async () => {
    const exitCode = await runLint([]);
    expect(exitCode).toBe(2);
  });

  it('exits with code 2 when patterns match no files', async () => {
    const exitCode = await runLint([
      fixturePath('does-not-exist-anywhere.json'),
    ]);
    expect(exitCode).toBe(2);
  });
});

// ----------------------------------------------------------------------
// AC-13 — 5-channel R6 isolation
// ----------------------------------------------------------------------

describe('AC-13: R6 IP-boundary isolation (5 channels)', () => {
  it('(a) .gitignore contains .heuristic-drafts/ — drafting transcripts NEVER committed', () => {
    const gitignorePath = join(REPO_ROOT, '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);
    const content = readFileSync(gitignorePath, 'utf-8');
    expect(content).toContain('.heuristic-drafts/');
  });

  it('(b) drafting subprocess does NOT import langsmith / @langsmith/* [VACUOUS — script not yet authored]', () => {
    const draftingScript = join(REPO_ROOT, 'scripts/draft-heuristic.ts');
    if (!existsSync(draftingScript)) {
      // VACUOUS PASS — TODO: re-run when scripts/draft-heuristic.ts lands.
      // Per plan.md v0.5 §6 R6/R15.3.3 isolation strategy: when this file
      // lands, it MUST use @anthropic-ai/sdk DIRECTLY (NOT via agent-core's
      // LLMAdapter which wires LangSmith).
      expect(existsSync(draftingScript)).toBe(false);
      return;
    }
    const content = readFileSync(draftingScript, 'utf-8');
    expect(content).not.toMatch(/from\s+['"]langsmith['"]/);
    expect(content).not.toMatch(/from\s+['"]@langsmith\//);
    expect(content).not.toMatch(/import\s+['"]langsmith['"]/);
  });

  it('(c) drafting subprocess does NOT import Pino observability module [VACUOUS — script not yet authored]', () => {
    const draftingScript = join(REPO_ROOT, 'scripts/draft-heuristic.ts');
    if (!existsSync(draftingScript)) {
      expect(existsSync(draftingScript)).toBe(false);
      return;
    }
    const content = readFileSync(draftingScript, 'utf-8');
    expect(content).not.toMatch(
      /from\s+['"]@neural\/agent-core\/observability['"]/,
    );
    expect(content).not.toMatch(/from\s+['"]pino['"]/);
  });

  it('(d) drafting subprocess is NOT imported by apps/ or packages/ runtime [VACUOUS — script not yet authored]', () => {
    const draftingScript = join(REPO_ROOT, 'scripts/draft-heuristic.ts');
    if (!existsSync(draftingScript)) {
      expect(existsSync(draftingScript)).toBe(false);
      return;
    }
    // Recursive grep on apps/ + packages/ for imports of the drafting script
    const importPattern = /from\s+['"][^'"]*scripts\/draft-heuristic[^'"]*['"]/;
    const offenders = findFilesContaining(
      [join(REPO_ROOT, 'apps'), join(REPO_ROOT, 'packages')],
      importPattern,
      ['.ts', '.tsx', '.js', '.mjs'],
    );
    expect(offenders).toEqual([]);
  });

  it('(e) apps/dashboard does NOT reference drafting subprocess paths [VACUOUS — apps/dashboard not yet authored]', () => {
    const dashboardDir = join(REPO_ROOT, 'apps/dashboard');
    if (!existsSync(dashboardDir)) {
      // VACUOUS PASS — TODO: re-run when apps/dashboard lands in Phase 9.
      expect(existsSync(dashboardDir)).toBe(false);
      return;
    }
    const referencePattern = /draft-heuristic|\.heuristic-drafts/;
    const offenders = findFilesContaining(
      [dashboardDir],
      referencePattern,
      ['.ts', '.tsx', '.js', '.mjs', '.json'],
    );
    expect(offenders).toEqual([]);
  });
});

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/**
 * Recursively walk directories looking for files matching `extensions` whose
 * content matches `pattern`. Returns relative paths (cwd-relative). Used by
 * AC-13 (d) + (e) grep tests.
 */
function findFilesContaining(
  roots: readonly string[],
  pattern: RegExp,
  extensions: readonly string[],
): string[] {
  const offenders: string[] = [];
  const stack: string[] = [...roots];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    if (!existsSync(dir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (
        entry === 'node_modules' ||
        entry === 'dist' ||
        entry === '.turbo' ||
        entry === 'tests'
      ) {
        // Skip build / dep / test directories — only check production source.
        continue;
      }
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (stat.isFile()) {
        const hasMatchingExt = extensions.some((ext) => entry.endsWith(ext));
        if (!hasMatchingExt) continue;
        try {
          const content = readFileSync(full, 'utf-8');
          if (pattern.test(content)) {
            offenders.push(full);
          }
        } catch {
          // unreadable file — skip
        }
      }
    }
  }
  return offenders;
}
