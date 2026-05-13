/**
 * AC-08 (source-grep enforcement) — ConfidenceScorer no-additive math.
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-08 (v0.3)
 *   docs/specs/mvp/phases/phase-3-verification/plan.md §"ConfidenceScorer (T064)"
 *     — canonical grep regex pack + comment-stripping recipe.
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T064 conformance (c)
 *
 * AC-08 contract — STRUCTURAL R4.4 enforcement:
 *   Reads `packages/agent-core/src/verification/ConfidenceScorer.ts` as text,
 *   STRIPS comments (block + line) so explanatory prose with `+` / `-` is
 *   allowed, then greps each line independently for FORBIDDEN PATTERNS:
 *     /\bc\s*[-+]\s*\d/
 *     /\bc\s*[-+]=/
 *     /\bcurrent\s*[-+]\s*\d/
 *     /\bconfidence\s*[-+]/
 *   Any match = R4.4 violation (R23 kill trigger).
 *
 * RED state — Phase 3 Wave 0 (T-PHASE3-TESTS). Source file does not yet
 * exist; readFile throws ENOENT → test fails. T064 lands the file with
 * `*`-only math → test flips GREEN.
 *
 * Anchor: @AC-08 — multiplicative-only invariant enforced via source grep.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = join(
  __dirname,
  '..',
  '..',
  'src',
  'verification',
  'ConfidenceScorer.ts',
);

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bc\s*[-+]\s*\d/, // c - 0.05, c + 0.01
  /\bc\s*[-+]=/, // c -= ..., c += ...
  /\bcurrent\s*[-+]\s*\d/, // current - 0.05
  /\bconfidence\s*[-+]/, // confidence - X, confidence + X
];

/**
 * Strip JS/TS block + line comments. Comments may contain `+`/`-` for
 * explanatory prose without tripping the grep.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('ConfidenceScorer source-grep — AC-08 block 3 (RED until T064)', () => {
  it('AC-08: ConfidenceScorer.ts source contains NO additive math on confidence (R4.4)', async () => {
    const raw = await readFile(SRC_PATH, 'utf8');
    const stripped = stripComments(raw);
    const lines = stripped.split('\n');
    for (const line of lines) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(
          line,
          `Forbidden additive pattern ${pattern} matched line: ${line}`,
        ).not.toMatch(pattern);
      }
    }
  });
});
