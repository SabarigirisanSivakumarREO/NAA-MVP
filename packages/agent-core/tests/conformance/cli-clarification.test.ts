/**
 * AC-10 — CLI clarification prompt conformance (Phase 4b T4B-010).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-10 + R-15
 *     (CLI clarification prompt reads blocking from stdin, prints non-blocking
 *      warnings to stderr, idempotent)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-010 (L154-159)
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.3 step 6
 *
 * AC-10 contract (this test asserts the I/O surface owned by T4B-010 in
 * `apps/cli/src/contextClarification.ts`; the answer-validation +
 * ContextProfile-merge contract is delegated to T4B-011 ContextCaptureNode
 * and tested in `context-capture-node.test.ts` AC-11):
 *
 *   1. Filter input to blocking questions only; non-blocking → stderr WARN line.
 *   2. Each blocking question prompted on `output` stream.
 *   3. One stdin line per blocking question → `ClarificationAnswer.value`.
 *   4. Returned answers carry `source: 'user'` + `confidence: 1.0`.
 *   5. Whitespace trim on user input.
 *   6. Empty `questions[]` → no I/O, empty result.
 *   7. All-non-blocking → 0 prompts, N warnings, empty result.
 *   8. Idempotent — same questions + same stdin → identical answers.
 *   9. `field_path` preserved exactly.
 *  10. CRLF stdin handled via readline crlfDelay:Infinity.
 *  11. Stream order preserved.
 *  12. Stdin EOF mid-prompt → throws `STDIN_CLOSED_DURING_CLARIFICATION`.
 *
 * Anchor: @AC-10 — CLI clarification stdin/stderr/stdout contract.
 */
import { Readable, Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  promptForClarifications,
  type ClarificationAnswer,
} from '../../../../apps/cli/src/contextClarification.js';
import type { OpenQuestion } from '../../src/types/context-profile.js';

// ---------------------------------------------------------------------------
// Helpers — fixture factories + stream collectors
// ---------------------------------------------------------------------------

function blockingQ(path: string, question: string): OpenQuestion {
  return { field_path: path, question, blocking: true };
}

function nonBlockingQ(path: string, question: string): OpenQuestion {
  return { field_path: path, question, blocking: false };
}

function stdinFrom(lines: ReadonlyArray<string>): Readable {
  // Join with newlines; Readable.from yields a stream of chunks readline can
  // consume. Trailing newline absent on last line is fine — readline still
  // emits 'line' on stream end if buffer is non-empty.
  return Readable.from(lines);
}

interface CollectedStreams {
  readonly stdout: Writable;
  readonly stderr: Writable;
  readonly outChunks: string[];
  readonly errChunks: string[];
}

function collectStreams(): CollectedStreams {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  const stdout = new Writable({
    write(chunk, _enc, cb) {
      outChunks.push(chunk.toString('utf8'));
      cb();
    },
  });
  const stderr = new Writable({
    write(chunk, _enc, cb) {
      errChunks.push(chunk.toString('utf8'));
      cb();
    },
  });
  return { stdout, stderr, outChunks, errChunks };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('@AC-10 promptForClarifications — CLI stdin/stderr prompt surface', () => {
  it('case 1: mixed blocking + non-blocking — prompts blocking only, warns non-blocking', async () => {
    const questions: OpenQuestion[] = [
      blockingQ('business.archetype', 'Pick archetype'),
      nonBlockingQ('brand.tone', 'Confirm tone?'),
      blockingQ('page.type', 'Pick page type'),
    ];
    const streams = collectStreams();
    const stdin = stdinFrom(['D2C\n', 'PDP\n']);

    const answers = await promptForClarifications(questions, {
      input: stdin,
      output: streams.stdout,
      errorOutput: streams.stderr,
    });

    expect(answers).toHaveLength(2);
    expect(answers[0]?.field_path).toBe('business.archetype');
    expect(answers[1]?.field_path).toBe('page.type');
    const errOut = streams.errChunks.join('');
    expect(errOut).toContain('WARN');
    expect(errOut).toContain('Confirm tone?');
    // Non-blocking prompt MUST NOT appear on stdout.
    expect(streams.outChunks.join('')).not.toContain('Confirm tone?');
  });

  it('case 2: 3 blocking questions — answers echo stdin with user/1.0 provenance', async () => {
    const questions: OpenQuestion[] = [
      blockingQ('business.archetype', 'Q1'),
      blockingQ('page.type', 'Q2'),
      blockingQ('goal.primary_kpi', 'Q3'),
    ];
    const streams = collectStreams();
    const stdin = stdinFrom(['D2C\n', 'PDP\n', 'purchase\n']);

    const answers = await promptForClarifications(questions, {
      input: stdin,
      output: streams.stdout,
      errorOutput: streams.stderr,
    });

    expect(answers).toEqual<ClarificationAnswer[]>([
      { field_path: 'business.archetype', value: 'D2C', source: 'user', confidence: 1.0 },
      { field_path: 'page.type', value: 'PDP', source: 'user', confidence: 1.0 },
      { field_path: 'goal.primary_kpi', value: 'purchase', source: 'user', confidence: 1.0 },
    ]);
  });

  it('case 3: whitespace trim — leading/trailing spaces stripped', async () => {
    const questions: OpenQuestion[] = [blockingQ('business.archetype', 'Pick archetype')];
    const streams = collectStreams();
    const stdin = stdinFrom(['  D2C  \n']);

    const answers = await promptForClarifications(questions, {
      input: stdin,
      output: streams.stdout,
      errorOutput: streams.stderr,
    });

    expect(answers[0]?.value).toBe('D2C');
  });

  it('case 4: empty questions[] — no I/O, empty result', async () => {
    const streams = collectStreams();
    const stdin = stdinFrom([]);

    const answers = await promptForClarifications([], {
      input: stdin,
      output: streams.stdout,
      errorOutput: streams.stderr,
    });

    expect(answers).toEqual([]);
    expect(streams.outChunks).toHaveLength(0);
    expect(streams.errChunks).toHaveLength(0);
  });

  it('case 5: all non-blocking — 0 prompts, N stderr warnings, empty answers', async () => {
    const questions: OpenQuestion[] = [
      nonBlockingQ('a.x', 'Warn A'),
      nonBlockingQ('b.y', 'Warn B'),
      nonBlockingQ('c.z', 'Warn C'),
    ];
    const streams = collectStreams();
    const stdin = stdinFrom([]);

    const answers = await promptForClarifications(questions, {
      input: stdin,
      output: streams.stdout,
      errorOutput: streams.stderr,
    });

    expect(answers).toEqual([]);
    expect(streams.outChunks.join('')).toBe('');
    const errOut = streams.errChunks.join('');
    expect(errOut).toContain('Warn A');
    expect(errOut).toContain('Warn B');
    expect(errOut).toContain('Warn C');
  });

  it('case 6: idempotency — same questions + same stdin → identical answers', async () => {
    const questions: OpenQuestion[] = [
      blockingQ('business.archetype', 'Q1'),
      blockingQ('page.type', 'Q2'),
    ];

    const run = async (): Promise<ClarificationAnswer[]> => {
      const s = collectStreams();
      return promptForClarifications(questions, {
        input: stdinFrom(['D2C\n', 'PDP\n']),
        output: s.stdout,
        errorOutput: s.stderr,
      });
    };

    const first = await run();
    const second = await run();
    expect(first).toEqual(second);
  });

  it('case 7: field_path mapping — input path round-trips into answer exactly', async () => {
    const questions: OpenQuestion[] = [
      blockingQ('deeply.nested.field_path.with_underscore', 'Q1'),
    ];
    const streams = collectStreams();
    const stdin = stdinFrom(['answer\n']);

    const answers = await promptForClarifications(questions, {
      input: stdin,
      output: streams.stdout,
      errorOutput: streams.stderr,
    });

    expect(answers[0]?.field_path).toBe('deeply.nested.field_path.with_underscore');
  });

  it('case 8: CRLF handling — \\r\\n line endings stripped via readline crlfDelay', async () => {
    const questions: OpenQuestion[] = [blockingQ('business.archetype', 'Pick archetype')];
    const streams = collectStreams();
    const stdin = stdinFrom(['D2C\r\n']);

    const answers = await promptForClarifications(questions, {
      input: stdin,
      output: streams.stdout,
      errorOutput: streams.stderr,
    });

    expect(answers[0]?.value).toBe('D2C');
  });

  it('case 9: order preservation — answers in same order as blocking input', async () => {
    const questions: OpenQuestion[] = [
      blockingQ('q1.path', 'First'),
      blockingQ('q2.path', 'Second'),
      blockingQ('q3.path', 'Third'),
    ];
    const streams = collectStreams();
    const stdin = stdinFrom(['v1\n', 'v2\n', 'v3\n']);

    const answers = await promptForClarifications(questions, {
      input: stdin,
      output: streams.stdout,
      errorOutput: streams.stderr,
    });

    expect(answers.map((a) => a.field_path)).toEqual(['q1.path', 'q2.path', 'q3.path']);
    expect(answers.map((a) => a.value)).toEqual(['v1', 'v2', 'v3']);
  });

  it('case 10: stream-end mid-prompt — throws STDIN_CLOSED_DURING_CLARIFICATION', async () => {
    const questions: OpenQuestion[] = [
      blockingQ('q1.path', 'First'),
      blockingQ('q2.path', 'Second'),
      blockingQ('q3.path', 'Third'),
    ];
    const streams = collectStreams();
    // Only 1 line — stream closes before Q2 and Q3 prompted.
    const stdin = stdinFrom(['only-one\n']);

    await expect(
      promptForClarifications(questions, {
        input: stdin,
        output: streams.stdout,
        errorOutput: streams.stderr,
      }),
    ).rejects.toThrow(/STDIN_CLOSED_DURING_CLARIFICATION/);
  });
});
