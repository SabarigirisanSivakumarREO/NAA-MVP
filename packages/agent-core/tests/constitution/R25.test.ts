/**
 * Constitution R25 — Context Capture Layer MUST NOT (Phase 4b AC-14, T4B-014).
 *
 * Source authority:
 *   docs/specs/mvp/constitution.md §25 (Context Capture Layer MUST NOT, v3.0)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md §"Constraints
 *     Inherited from Neural Canonical Specs" (R25 invariants)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-014
 *
 * AC-14 invariants enforced (4 hard rules):
 *
 *   Rule 1: No `playwright` / `@playwright/*` import in
 *           `packages/agent-core/src/context/*` (constitution §25.1 item 1).
 *   Rule 2: No `@anthropic-ai/sdk` / `LLMAdapter` / `AnthropicAdapter` import
 *           in `packages/agent-core/src/context/*` (constitution §25.1 item 6
 *           — no LLM calls in MVP; LLM-tagged inference is Phase 13b).
 *   Rule 3: No CRO judgment fields (`severity`, `impact`, `score`, `priority`,
 *           `risk_*`, `recommend_*`) appearing as Zod schema property keys in
 *           `packages/agent-core/src/types/context-profile.ts` (constitution
 *           §25.1 item 2 + item 10 — context layer captures, never judges).
 *   Rule 4: No silent defaults — every `source: 'default'` literal in
 *           `packages/agent-core/src/context/<X>Inferrer.ts` MUST be paired
 *           with `confidence: 0` within the same emission block (constitution
 *           §25.1 item 3 + spec.md L133).
 *
 * Constitution compliance for THIS test file:
 *   R2: no `any` — typed scan helpers throughout.
 *   R3.1 TDD: this task IS the conformance test (no separate impl).
 *   R10.1: target ≤300 LOC.
 *   R10.3: named exports + describe/it blocks; no default exports.
 *   R10.6: no console.log; pure assertions.
 *
 * NOTE: Test failure semantics — a violation here means a Phase 4b file
 * regressed against R25. The test reports the offending file:line in its
 * assertion message so the master orchestrator can decide whether to patch
 * the implementation (recover R25 compliance) or RE-SPEC (rare).
 */

import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Path constants — all relative to packages/agent-core root.
// ---------------------------------------------------------------------------

const PKG_ROOT = resolve(__dirname, '..', '..');
const CONTEXT_DIR = join(PKG_ROOT, 'src', 'context');
const TYPES_FILE = join(PKG_ROOT, 'src', 'types', 'context-profile.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ScannedFile {
  readonly absPath: string;
  readonly relPath: string;
  readonly lines: ReadonlyArray<string>;
  readonly source: string;
}

/** Recursively list `.ts` files under `dir` (no `.test.ts` exclusion needed
 *  here — `src/context/` does not contain test files by convention). */
async function listTsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listTsFiles(full);
      out.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out.sort();
}

async function loadFile(absPath: string): Promise<ScannedFile> {
  const source = await readFile(absPath, 'utf8');
  const relPath = absPath.slice(PKG_ROOT.length + 1).replace(/\\/g, '/');
  return { absPath, relPath, lines: source.split(/\r?\n/), source };
}

/** Match `import ... from '<spec>'`, `import('<spec>')`, `require('<spec>')`. */
function findImportLines(file: ScannedFile, specPattern: RegExp): Array<{ line: number; text: string }> {
  const hits: Array<{ line: number; text: string }> = [];
  file.lines.forEach((text, idx) => {
    // Skip pure single-line comments (// ...) and block-comment continuations (^\s*\*).
    const trimmed = text.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return;
    }
    if (specPattern.test(text)) {
      hits.push({ line: idx + 1, text: text.trim() });
    }
  });
  return hits;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Constitution R25 — Context Capture Layer MUST NOT', () => {
  describe('Rule 1: no Playwright import in src/context/*', () => {
    it('rejects playwright / @playwright/* static + dynamic imports + require()', async () => {
      const files = await listTsFiles(CONTEXT_DIR);
      expect(files.length).toBeGreaterThan(0);

      // Matches: from 'playwright', from '@playwright/test', require('playwright'),
      // import('playwright'), import('@playwright/anything').
      const playwrightPattern =
        /(?:from\s+['"]|require\s*\(\s*['"]|import\s*\(\s*['"])(?:@playwright(?:\/[\w-]+)?|playwright)['"]/;

      const violations: string[] = [];
      for (const abs of files) {
        const file = await loadFile(abs);
        const hits = findImportLines(file, playwrightPattern);
        for (const hit of hits) {
          violations.push(`${file.relPath}:${hit.line} — ${hit.text}`);
        }
      }

      expect(
        violations,
        violations.length === 0
          ? ''
          : `R25.1 item 1 violation — Playwright import found in src/context/*:\n${violations.join('\n')}`,
      ).toEqual([]);
    });
  });

  describe('Rule 2: no LLMAdapter / Anthropic SDK import in src/context/*', () => {
    it('rejects @anthropic-ai/sdk + LLMAdapter + AnthropicAdapter imports', async () => {
      const files = await listTsFiles(CONTEXT_DIR);
      expect(files.length).toBeGreaterThan(0);

      // Three patterns combined into one alternation:
      //   1. from '@anthropic-ai/sdk' (or any subpath)
      //   2. import { LLMAdapter | AnthropicAdapter, ... } from '...'
      //   3. dynamic import('@anthropic-ai/sdk')
      const sdkSpecPattern =
        /(?:from\s+['"]|require\s*\(\s*['"]|import\s*\(\s*['"])@anthropic-ai\/sdk(?:\/[\w-]+)?['"]/;
      const adapterImportPattern =
        /^\s*import\s+(?:type\s+)?[^;]*\b(?:LLMAdapter|AnthropicAdapter)\b[^;]*from\s+['"][^'"]+['"]/;

      const violations: string[] = [];
      for (const abs of files) {
        const file = await loadFile(abs);
        const sdkHits = findImportLines(file, sdkSpecPattern);
        for (const hit of sdkHits) {
          violations.push(`${file.relPath}:${hit.line} (Anthropic SDK) — ${hit.text}`);
        }
        const adapterHits = findImportLines(file, adapterImportPattern);
        for (const hit of adapterHits) {
          violations.push(`${file.relPath}:${hit.line} (LLM adapter) — ${hit.text}`);
        }
      }

      expect(
        violations,
        violations.length === 0
          ? ''
          : `R25.1 item 6 violation — LLM SDK / adapter import found in src/context/*:\n${violations.join('\n')}`,
      ).toEqual([]);
    });
  });

  describe('Rule 3: no judgment fields in ContextProfile schema', () => {
    it('rejects severity/impact/score/priority/risk_*/recommend_* as Zod keys in context-profile.ts', async () => {
      const file = await loadFile(TYPES_FILE);

      // A judgment-field declaration looks like a Zod object property:
      //   severity: z.string(),
      //   risk_score: z.number(),
      // Word-boundary anchored to avoid matching `device_priority`, `kpi_score`,
      // etc. We also require the line NOT to be a comment (`*` / `//` / `/*`).
      const judgmentPattern = /^\s*(severity|impact|score|priority|risk_\w+|recommend_\w+)\s*:/;

      const violations: string[] = [];
      file.lines.forEach((text, idx) => {
        const trimmed = text.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          return; // doc-comment line — R25 ban is allowed in commentary
        }
        const match = judgmentPattern.exec(text);
        if (match) {
          violations.push(
            `src/types/context-profile.ts:${idx + 1} — judgment field "${match[1]}" declared: ${text.trim()}`,
          );
        }
      });

      expect(
        violations,
        violations.length === 0
          ? ''
          : `R25.1 item 2 violation — CRO judgment field declared in ContextProfile:\n${violations.join('\n')}`,
      ).toEqual([]);
    });
  });

  describe('Rule 4: no silent defaults — source:default → confidence:0', () => {
    it('every source:"default" emission in src/context/*Inferrer.ts pairs with confidence:0', async () => {
      const files = (await listTsFiles(CONTEXT_DIR)).filter((p) => /Inferrer\.ts$/.test(p));
      expect(files.length).toBeGreaterThan(0);

      const sourceDefaultPattern = /source\s*:\s*['"]default['"]/;
      const confidencePattern = /confidence\s*:\s*([0-9.]+)/;

      const violations: string[] = [];
      for (const abs of files) {
        const file = await loadFile(abs);
        file.lines.forEach((text, idx) => {
          // Skip doc-comment lines: R25 prose mentions source:'default' freely.
          const trimmed = text.trimStart();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            return;
          }
          if (!sourceDefaultPattern.test(text)) {
            return;
          }

          // Found a `source: 'default'` code emission. Find the nearest
          // `confidence: N` within a ±6-line window (covers both inline-object
          // and multi-line-object styles used by Phase 4b inferrers).
          const start = Math.max(0, idx - 6);
          const end = Math.min(file.lines.length, idx + 7);
          let pairedConfidence: number | null = null;
          for (let j = start; j < end; j += 1) {
            const m = confidencePattern.exec(file.lines[j] ?? '');
            if (m && m[1]) {
              pairedConfidence = Number.parseFloat(m[1]);
              break;
            }
          }

          if (pairedConfidence === null) {
            violations.push(
              `${file.relPath}:${idx + 1} — source:'default' emitted with NO neighboring confidence field: ${text.trim()}`,
            );
          } else if (pairedConfidence !== 0) {
            violations.push(
              `${file.relPath}:${idx + 1} — source:'default' paired with confidence:${pairedConfidence} (must be 0): ${text.trim()}`,
            );
          }
        });
      }

      expect(
        violations,
        violations.length === 0
          ? ''
          : `R25.1 item 3 violation — silent default in src/context/*Inferrer.ts:\n${violations.join('\n')}`,
      ).toEqual([]);
    });
  });
});
