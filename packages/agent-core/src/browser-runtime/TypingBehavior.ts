/**
 * TypingBehavior — Phase 2 T017 human-typing module.
 *
 * Source: docs/specs/mvp/phases/phase-2-tools/spec.md AC-02 + R-02;
 *         docs/specs/mvp/phases/phase-2-tools/tasks.md T017
 *         (REQ-BROWSE-HUMAN-003 + REQ-BROWSE-HUMAN-004).
 *
 * Types a string one character at a time with Gaussian inter-character
 * delays (mean ~80 ms, σ ~20 ms). With probability `typoRate` per
 * character (default 1.5%), emits wrong-char → Backspace → correct-char
 * to mimic real-user self-correction. Consumed by `browser_type` (T029).
 *
 * Design:
 *   - NO new external deps. Box-Muller transform for Gaussian samples
 *     (inline; ~5 LOC). Keyboard ops route through Playwright's keyboard.
 *   - Structural `TypingPage` / `TypingTarget` interfaces rather than
 *     extending BrowserPage (R9). Phase 2 `browser_type` (T029) will
 *     satisfy these structurally; no cross-phase impact.md needed.
 *   - `typoRate` hard-clamped at 5% (kill criterion in T017 brief).
 *
 * R10.1: file < 150 LOC. R10.6: Pino logger. R13: no bare `any`.
 */
import { createLogger, createChildLogger, type Logger } from '../observability/logger.js';

/** Minimal keyboard surface this module consumes (Playwright-compatible). */
export interface TypingKeyboard {
  type(text: string, opts?: { delay?: number }): Promise<void>;
  press(key: string, opts?: { delay?: number }): Promise<void>;
}

/** Structural typing surface; Playwright `Page` satisfies this. */
export interface TypingPage {
  readonly keyboard: TypingKeyboard;
}

/** Selector hint (caller has focused it) OR a focusable handle. */
export interface TypingTargetHandle {
  focus(opts?: { timeout?: number }): Promise<void>;
}
export type TypingTarget = string | TypingTargetHandle;

export interface TypingOpts {
  /** Mean inter-character delay in ms. Default 80. */
  meanMs?: number;
  /** Stdev of inter-character delay in ms. Default 20. */
  stdMs?: number;
  /** Per-character typo probability in [0, 0.05]. Default 0.015. Clamped at 0.05. */
  typoRate?: number;
  /** Pino correlation field — exact v3.1 tool name (e.g. `browser_type`). */
  tool_name?: string;
  /** Pino correlation field — per-invocation uuid/short-id. */
  tool_call_id?: string;
  /** Pino correlation field — calling MCP client session id. */
  client_session_id?: string;
  /**
   * Deterministic seed for tests. When set, replaces Math.random with a
   * tiny LCG so Gaussian samples + typo decisions are reproducible.
   */
  seed?: number;
}

const DEFAULTS = Object.freeze({ meanMs: 80, stdMs: 20, typoRate: 0.015 });
const MAX_TYPO_RATE = 0.05;
const TYPO_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/** Box-Muller: two uniform[0,1) → one Gaussian. Lower-clamp 1 ms. */
function gaussian(mean: number, stdev: number, rng: () => number): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(1, mean + z0 * stdev);
}

/** Tiny LCG for deterministic test seeds (Numerical Recipes parameters). */
function makeRng(seed: number | undefined): () => number {
  if (seed === undefined) return Math.random;
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Pick an ASCII-alpha char distinct from `intended`. */
function pickWrongChar(intended: string, rng: () => number): string {
  const i = Math.floor(rng() * TYPO_ALPHABET.length);
  const candidate = TYPO_ALPHABET[i] ?? 'x';
  return candidate === intended.toLowerCase() ? (candidate === 'x' ? 'q' : 'x') : candidate;
}

/**
 * `typingBehavior.type(page, target, text, opts?)` — AC-02 surface.
 * Consumed by `browser_type` (T029).
 */
export const typingBehavior = {
  async type(
    page: TypingPage,
    target: TypingTarget,
    text: string,
    opts: TypingOpts = {},
  ): Promise<void> {
    const meanMs = opts.meanMs ?? DEFAULTS.meanMs;
    const stdMs = opts.stdMs ?? DEFAULTS.stdMs;
    const typoRate = Math.min(opts.typoRate ?? DEFAULTS.typoRate, MAX_TYPO_RATE);
    const rng = makeRng(opts.seed);

    const root: Logger = createLogger('typing-behavior');
    const log: Logger = createChildLogger(root, {
      ...(opts.tool_name !== undefined ? { tool_name: opts.tool_name } : {}),
      ...(opts.tool_call_id !== undefined ? { tool_call_id: opts.tool_call_id } : {}),
      ...(opts.client_session_id !== undefined
        ? { client_session_id: opts.client_session_id }
        : {}),
    });

    if (typeof target !== 'string') {
      await target.focus();
    }

    let typoCount = 0;
    for (const ch of text) {
      const delay = gaussian(meanMs, stdMs, rng);
      if (rng() < typoRate) {
        const wrong = pickWrongChar(ch, rng);
        await page.keyboard.type(wrong, { delay });
        await page.keyboard.press('Backspace', { delay: gaussian(meanMs, stdMs, rng) });
        await page.keyboard.type(ch, { delay: gaussian(meanMs, stdMs, rng) });
        typoCount += 1;
      } else {
        await page.keyboard.type(ch, { delay });
      }
    }

    log.info(
      {
        event: 'typing.completed',
        char_count: text.length,
        typo_count: typoCount,
        typo_rate_effective: text.length > 0 ? typoCount / text.length : 0,
        target_hint: typeof target === 'string' ? target : '<handle>',
      },
      'TypingBehavior emitted keystrokes',
    );
  },
};

export type TypingBehavior = typeof typingBehavior;
