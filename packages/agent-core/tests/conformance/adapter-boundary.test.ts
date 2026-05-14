/**
 * F-11 / R9 — Adapter import-boundary conformance (Phase 4 T073 — ESLint co-test).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md SC-006
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T073 (no-restricted-imports + grep)
 *   docs/specs/mvp/constitution.md R9 (Adapter Pattern)
 *
 * Contract:
 *   - `@anthropic-ai/sdk` is imported ONLY in src/adapters/AnthropicAdapter.ts.
 *   - `pg` is imported ONLY in src/adapters/PostgresStorage.ts OR src/db/**.
 *   - `drizzle-orm` is imported ONLY in src/adapters/PostgresStorage.ts OR src/db/**.
 *
 * Defense in depth: ESLint `no-restricted-imports` lands in T073 — this grep
 * test is the safety-net catching anything ESLint misses (e.g. dynamic
 * imports, string-based requires).
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). AnthropicAdapter.ts +
 * PostgresStorage.ts don't exist yet, so the grep finds no offenders (test
 * PASSES under absence-only) — but `expect(allowedAnthropicFiles.length)`
 * to be >= 1 asserts the SUT file landed (FAILS until T073).
 *
 * Anchor: @F-11 / @R9 — adapter import boundary.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(process.cwd(), 'src');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, acc);
    } else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

interface ImportFinding {
  file: string;
  line: string;
}

function findImports(allFiles: string[], pkg: string): ImportFinding[] {
  const re = new RegExp(
    `(?:from|require|import)\\s*\\(?\\s*['\"]${pkg.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['\"]`,
  );
  const out: ImportFinding[] = [];
  for (const f of allFiles) {
    const text = readFileSync(f, 'utf8');
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('//') || line.startsWith('*')) continue;
      if (re.test(line)) out.push({ file: f, line });
    }
  }
  return out;
}

function isUnder(file: string, ...allowedSubpaths: string[]): boolean {
  const norm = file.replace(/\\\\/g, '/');
  return allowedSubpaths.some((p) => norm.includes(p));
}

describe('Adapter import boundary — F-11 / R9 conformance (RED until T073/T074)', () => {
  const allFiles = walk(SRC_ROOT);

  it('R9: @anthropic-ai/sdk imports appear ONLY in src/adapters/AnthropicAdapter.ts', () => {
    const findings = findImports(allFiles, '@anthropic-ai/sdk');
    for (const f of findings) {
      expect(
        isUnder(f.file, '/adapters/AnthropicAdapter.ts'),
        `forbidden import of @anthropic-ai/sdk in ${f.file}: ${f.line}`,
      ).toBe(true);
    }
    // SUT landed assertion — FAILS until T073 creates AnthropicAdapter.ts AND
    // wires the import.
    expect(findings.length, 'expected @anthropic-ai/sdk import inside AnthropicAdapter.ts (T073)').toBeGreaterThanOrEqual(1);
  });

  it('R9: `pg` imports appear ONLY in src/adapters/PostgresStorage.ts OR src/db/**', () => {
    const findings = findImports(allFiles, 'pg');
    for (const f of findings) {
      expect(
        isUnder(f.file, '/adapters/PostgresStorage.ts', '/db/'),
        `forbidden import of pg in ${f.file}: ${f.line}`,
      ).toBe(true);
    }
    expect(findings.length, 'expected pg import in PostgresStorage.ts or db/ (T070/T074)').toBeGreaterThanOrEqual(1);
  });

  it('R9: `drizzle-orm` imports appear ONLY in src/adapters/PostgresStorage.ts OR src/db/**', () => {
    const findings = findImports(allFiles, 'drizzle-orm');
    for (const f of findings) {
      expect(
        isUnder(f.file, '/adapters/PostgresStorage.ts', '/db/'),
        `forbidden import of drizzle-orm in ${f.file}: ${f.line}`,
      ).toBe(true);
    }
    expect(
      findings.length,
      'expected drizzle-orm import in PostgresStorage.ts or db/ (T070/T074)',
    ).toBeGreaterThanOrEqual(1);
  });
});
