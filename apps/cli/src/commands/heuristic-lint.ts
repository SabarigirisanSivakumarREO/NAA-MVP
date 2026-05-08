#!/usr/bin/env node
/**
 * `pnpm heuristic:lint <file-or-glob>` — heuristic JSON validator.
 *
 * Source: docs/specs/mvp/phases/phase-0b-heuristics/{spec.md v0.5 AC-04 + R-04,
 *         plan.md v0.5 §5} + tasks.md T0B-004.
 *
 * Five checks per AC-04:
 *   (1) Zod parse against HeuristicSchemaExtended (T101 — implementation
 *       source-of-truth at packages/agent-core/src/analysis/heuristics/types.ts)
 *   (2) All 5 provenance fields non-empty (Zod-enforced via T101 .strict() +
 *       .min(1)/url/ISO-8601 regex)
 *   (3) benchmark discriminated union present + well-formed (Zod-enforced)
 *   (4) Manifest selectors archetype + page_type + device PRESENT
 *       (T101 marks these .optional() but Phase 0b R-09 requires presence;
 *       lint enforces)
 *   (5) Banned-phrase regex on `body` field (R5.3 + GR-007; v0.5 patch —
 *       was `recommendation.summary + recommendation.details` per legacy §9.1
 *       references missed in v0.4 sweep, now collapses to T101's body string)
 *
 * D1 BINDING (Phase 0b review-notes.md):
 *   Lint output MUST redact Zod-error `received: <value>` content from
 *   stdout/stderr — ANY heuristic content surfaced via lint errors is an
 *   R6.1 IP boundary violation. Emit ONLY:
 *     `<file>: <field-path> — <error_class>`
 *   The conformance test asserts via `NEURAL_TEST_FIXTURE_BODY` sentinel —
 *   if the sentinel string appears in stderr/stdout, lint has leaked content.
 *
 * R10.6 exception:
 *   Uses process.stdout.write / process.stderr.write directly (NOT Pino).
 *   Same exception as Phase 0 T003 cro-audit handler — CLI dev tool stdout
 *   is user-facing output, not server-side observability. Pino remains the
 *   sole observability path inside packages/agent-core production runtime.
 *
 * R9 boundary:
 *   Imports HeuristicSchemaExtended from @neural/agent-core via the package
 *   exports map (./analysis/heuristics/types). agent-core IS the adapter
 *   boundary; CLI consuming the typed schema is the canonical pattern.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { glob } from 'glob';

import { HeuristicSchemaExtended } from '@neural/agent-core/analysis/heuristics/types';

// R5.3 + GR-007 banned-phrase regex (v0.5 patch — applied to `body` field)
const BANNED_PHRASE_REGEX =
  /(increase|lift|boost|raise|grow|improve)\s+(conversion|conversions|CR|cr)\s+by\s+\d+%/i;

// Manifest selectors required at the Phase 0b authoring layer (T101 marks
// them .optional() at the schema layer for backward-compat; Phase 0b lint
// enforces presence per R-09 + REQ-CONTEXT-DOWNSTREAM-001 so the Phase 4b
// T4B-013 loadForContext() filter has the data it needs).
const REQUIRED_MANIFEST_SELECTORS = ['archetype', 'page_type', 'device'] as const;

interface LintError {
  readonly file: string;
  readonly field_path: string;
  readonly error_class: string;
}

/**
 * Lint a single heuristic JSON file. Returns array of errors (empty = pass).
 *
 * D1 BINDING: this function MUST NEVER include Zod's `received: <value>`
 * content in the returned errors. Only `field_path` (Zod issue.path joined)
 * and `error_class` (Zod issue.code) are extracted. The `issue.message`
 * field is INTENTIONALLY DROPPED because Zod's default messages embed the
 * received value (e.g., "Invalid string: received '<heuristic body content>'").
 */
export function lintFile(filePath: string): LintError[] {
  const errors: LintError[] = [];

  // (0) JSON parse — handle file read / parse failures without leaking content
  let parsedJson: unknown;
  try {
    const content = readFileSync(filePath, 'utf-8');
    parsedJson = JSON.parse(content);
  } catch (e) {
    const errorClass =
      e instanceof SyntaxError ? 'json_parse_error' : 'file_read_error';
    errors.push({
      file: filePath,
      field_path: '<root>',
      error_class: errorClass,
    });
    return errors;
  }

  // (1)+(2)+(3) Zod parse against HeuristicSchemaExtended
  // — Zod schema enforces: id regex, body min(1), category min(1),
  //   version semver, all 6 §9.10 enum/numeric ranges, BenchmarkSchema
  //   discriminated union, ProvenanceSchema 5 strict fields with url +
  //   model regex + ISO-8601 regex.
  const result = HeuristicSchemaExtended.safeParse(parsedJson);
  if (!result.success) {
    for (const issue of result.error.issues) {
      // D1 BINDING: extract ONLY path + code; NEVER include issue.message
      // (Zod messages embed `received: <value>` content — would leak IP).
      errors.push({
        file: filePath,
        field_path: issue.path.length > 0 ? issue.path.join('.') : '<root>',
        error_class: issue.code,
      });
    }
    // Cannot continue with checks (4) + (5) — schema parse failed; data shape
    // is unknown.
    return errors;
  }

  // (4) Manifest selectors PRESENT (T101 marks .optional(); Phase 0b requires)
  for (const selector of REQUIRED_MANIFEST_SELECTORS) {
    const value = result.data[selector];
    if (value === undefined || (Array.isArray(value) && value.length === 0)) {
      errors.push({
        file: filePath,
        field_path: selector,
        error_class: 'missing_manifest_selector',
      });
    }
  }

  // (5) Banned-phrase regex on `body` (R5.3 + GR-007 — v0.5 patch target)
  if (BANNED_PHRASE_REGEX.test(result.data.body)) {
    errors.push({
      file: filePath,
      field_path: 'body',
      error_class: 'banned_phrase_conversion_prediction',
    });
  }

  return errors;
}

/**
 * Format a single error line for stdout/stderr.
 *
 * D1 BINDING: this is the ONLY function that produces user-facing output
 * lines from lint errors. Format is FIXED at:
 *   `<file>: <field_path> — <error_class>`
 * Nothing else. No values. No suggestions referencing data. The message
 * shape itself is part of the IP boundary contract.
 */
export function formatErrorLine(err: LintError): string {
  return `${err.file}: ${err.field_path} — ${err.error_class}`;
}

/**
 * Top-level lint runner.
 *
 * @param patterns - file paths or glob patterns (relative to cwd)
 * @returns process exit code (0 = all files passed; 1 = at least one error)
 */
export async function runLint(patterns: readonly string[]): Promise<number> {
  if (patterns.length === 0) {
    process.stderr.write(
      'usage: pnpm heuristic:lint <file-or-glob> [<file-or-glob> ...]\n',
    );
    return 2;
  }

  // Resolve glob patterns into absolute file paths (deduped).
  const resolved = new Set<string>();
  for (const pattern of patterns) {
    const matches = await glob(pattern, { absolute: true, nodir: true });
    for (const match of matches) {
      resolved.add(match);
    }
  }

  if (resolved.size === 0) {
    process.stderr.write(
      `heuristic:lint: no files matched pattern(s): ${patterns.join(' ')}\n`,
    );
    return 2;
  }

  let totalErrors = 0;
  let totalFiles = 0;
  for (const filePath of resolved) {
    totalFiles += 1;
    // Use relative path for output (cwd-relative; nicer than absolute).
    const relPath = filePath.startsWith(process.cwd())
      ? filePath.slice(process.cwd().length + 1).replace(/\\/g, '/')
      : filePath;
    const errors = lintFile(filePath);
    for (const err of errors) {
      // Re-key the file path to relative form for output consistency.
      process.stderr.write(
        formatErrorLine({ ...err, file: relPath }) + '\n',
      );
      totalErrors += 1;
    }
  }

  if (totalErrors === 0) {
    process.stdout.write(
      `✓ heuristic:lint: ${totalFiles} file(s) passed\n`,
    );
    return 0;
  }
  process.stderr.write(
    `✗ heuristic:lint: ${totalErrors} error(s) across ${totalFiles} file(s)\n`,
  );
  return 1;
}

// CLI entry point — only runs when invoked directly (not when imported by
// tests). Use fileURLToPath for Windows-safe comparison: import.meta.url
// is `file:///C:/...` (three slashes) but process.argv[1] is a plain path
// like `C:\...` — fileURLToPath normalizes both sides.
const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const patterns = process.argv.slice(2);
  const exitCode = await runLint(patterns);
  process.exit(exitCode);
}
