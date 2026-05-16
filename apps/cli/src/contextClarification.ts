/**
 * Phase 4b T4B-010 — CLI clarification prompt: prompts the user via stdin for
 * each BLOCKING open_question, prints NON-blocking questions to stderr as
 * warnings, and returns ClarificationAnswer[] in input order.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.3 step 6
 *     (CLI clarification flow — read blocking from stdin, surface
 *     non-blocking to stderr, return answers to ContextCaptureNode)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-10 + R-15
 *     (CLI clarification prompt contract; idempotent on stdin replay)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-010 (L154-159)
 *   packages/agent-core/src/types/context-profile.ts —
 *     OpenQuestionSchema (input contract) + ContextSource (provenance).
 *
 * # Scope (pure I/O — caller owns validation + merge)
 *
 * This module is the stdin/stderr/stdout surface only. It does NOT:
 *   - Validate `value` against ContextProfile schema (T4B-011 ContextCaptureNode
 *     does that via Zod parse before merging the answer into the profile).
 *   - Merge answers into ContextProfile (T4B-011 owns merge + hash recompute).
 *   - Recompute provenance / confidence beyond stamping `source:'user'` +
 *     `confidence:1.0` per AC-10.
 *
 * # Algorithm
 *
 * 1. Filter input → BLOCKING-only list; for each non-blocking question, write
 *    a single `"WARN: <question>\n"` line to `errorOutput` (default stderr).
 * 2. For each blocking question (in input order):
 *    a. Write `question.question + "\n"` to `output`.
 *    b. Read ONE line from `input` via `node:readline` (crlfDelay:Infinity).
 *    c. If stream closes before a line is received → throw
 *       `STDIN_CLOSED_DURING_CLARIFICATION` (defensive contract — caller can
 *       distinguish input failure from a successful empty answer).
 *    d. Build `ClarificationAnswer { field_path, value: trimmed,
 *       source: 'user', confidence: 1.0 }`.
 * 3. Return answers in BLOCKING-input order (not sorted; deterministic).
 *
 * # Idempotency contract (AC-10)
 *
 * No Date.now(), no random IDs, no env-dependent defaults. Same `questions`
 * input + same `input` stdin contents → identical answers array. Caller
 * (T4B-011) relies on this for ContextProfile hash stability (R-03).
 *
 * # Constitution compliance
 *
 * R3.1 TDD: cli-clarification.test.ts written FIRST; this impl follows.
 * R2 no `any` — `value` typed `unknown` per locked interface.
 * R6 no heuristic body — pure plumbing.
 * R9 zero vendor SDK — only `node:readline` + @neural/agent-core type imports.
 * R10.1 file ≤ 300 LOC; functions ≤ 50 LOC.
 * R10.3 named exports only.
 * R14 — NO console.log; writes go to injected output/errorOutput streams
 *   (process.stdout/stderr by default). Reason: testability via Writable
 *   collectors; CLI seam discipline mirrors apps/cli/src/commands/audit.ts.
 * R25 NOT applicable — this file lives outside packages/agent-core/src/context/*
 *   and never touches Playwright or the LLMAdapter.
 */
import { createInterface } from 'node:readline';

import type { ContextSource, OpenQuestion } from '@neural/agent-core/types/context-profile';

// ---------------------------------------------------------------------------
// Public contract (LOCKED — sibling T4B-011 ContextCaptureNode imports these)
// ---------------------------------------------------------------------------

export interface ClarificationAnswer {
  /** Dot-notated path, e.g. "business.archetype" — mirrors OpenQuestion.field_path. */
  readonly field_path: string;
  /**
   * User-entered raw string (trimmed). Typed `unknown` because the
   * downstream T4B-011 ContextCaptureNode validates + coerces per the
   * target dimension's Zod schema (e.g. BusinessArchetypeEnum.parse).
   */
  readonly value: unknown;
  /** Always `'user'` for answers collected here (per AC-10). */
  readonly source: ContextSource;
  /** Always `1.0` when `source === 'user'`. */
  readonly confidence: number;
}

export interface ClarificationPromptOptions {
  /** Optional stdin replacement (test injection). Defaults to `process.stdin`. */
  readonly input?: NodeJS.ReadableStream;
  /** Optional stdout replacement (test injection). Defaults to `process.stdout`. */
  readonly output?: NodeJS.WritableStream;
  /** Optional stderr replacement for non-blocking warnings. Defaults to `process.stderr`. */
  readonly errorOutput?: NodeJS.WritableStream;
}

/**
 * Prompts the user via stdin for every blocking question in `questions`.
 * Non-blocking questions are printed to `errorOutput` (stderr) as warnings
 * only — not prompted. Returns answers in blocking-input order.
 *
 * Idempotency: identical `questions` + identical stdin input → identical
 * answers (no random IDs, no Date.now(), no env-dependent defaults).
 *
 * @throws Error with message containing `STDIN_CLOSED_DURING_CLARIFICATION`
 *   if the input stream closes before all blocking questions are answered.
 */
export async function promptForClarifications(
  questions: ReadonlyArray<OpenQuestion>,
  options?: ClarificationPromptOptions,
): Promise<ClarificationAnswer[]> {
  const input = options?.input ?? process.stdin;
  const output = options?.output ?? process.stdout;
  const errorOutput = options?.errorOutput ?? process.stderr;

  // Pass 1: emit stderr WARN lines for every non-blocking question.
  //         Pass before stdin reads so the user sees context first.
  for (const q of questions) {
    if (!q.blocking) {
      errorOutput.write(`WARN: ${q.question}\n`);
    }
  }

  const blocking = questions.filter((q) => q.blocking);
  if (blocking.length === 0) {
    return [];
  }

  // readline owns the input stream while iterating; await its async iterator
  // so we read EXACTLY one line per blocking question, in order.
  const rl = createInterface({ input, crlfDelay: Infinity });
  const lineIterator = rl[Symbol.asyncIterator]();
  const answers: ClarificationAnswer[] = [];

  try {
    for (const q of blocking) {
      output.write(`${q.question}\n`);
      const next = await lineIterator.next();
      if (next.done === true) {
        throw new Error(
          `STDIN_CLOSED_DURING_CLARIFICATION: stdin closed before answer for field_path='${q.field_path}'`,
        );
      }
      const raw = typeof next.value === 'string' ? next.value : String(next.value);
      answers.push({
        field_path: q.field_path,
        value: raw.trim(),
        source: 'user',
        confidence: 1.0,
      });
    }
  } finally {
    rl.close();
  }

  return answers;
}
