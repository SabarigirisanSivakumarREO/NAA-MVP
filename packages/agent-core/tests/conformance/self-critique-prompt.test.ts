/**
 * AC-08 — self-critique prompt invariants (Phase 7 T120).
 *
 * R5.6 — persona MUST diverge from evaluate's "CRO analyst" persona.
 *   Programmatic act-001 metric: persona-descriptor sentences satisfy
 *   token-set Jaccard distance ≥ 0.5 AND zero shared word 5-grams.
 */
import { describe, expect, it } from 'vitest';
import {
  SELF_CRITIQUE_SYSTEM_PROMPT,
  buildSelfCritiqueUserMessage,
} from '../../src/analysis/prompts/selfCritique.js';
import { EVALUATE_SYSTEM_PROMPT } from '../../src/analysis/prompts/evaluate.js';

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function tokenSetJaccardDistance(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  const inter = new Set([...A].filter((x) => B.has(x)));
  const union = new Set([...A, ...B]);
  if (union.size === 0) return 0;
  return 1 - inter.size / union.size;
}

function fiveGrams(s: string): Set<string> {
  const t = tokenize(s);
  const out = new Set<string>();
  for (let i = 0; i + 5 <= t.length; i += 1) {
    out.add(t.slice(i, i + 5).join(' '));
  }
  return out;
}

function sharedFiveGramCount(a: string, b: string): number {
  const A = fiveGrams(a);
  const B = fiveGrams(b);
  let n = 0;
  for (const g of A) if (B.has(g)) n += 1;
  return n;
}

// First sentence ≈ persona descriptor for both prompts.
function firstSentence(s: string): string {
  const i = s.indexOf('.');
  return i === -1 ? s : s.slice(0, i + 1);
}

describe('AC-08 self-critique system prompt content', () => {
  it('contains spec anchors', () => {
    expect(SELF_CRITIQUE_SYSTEM_PROMPT).toContain('senior CRO quality reviewer');
    expect(SELF_CRITIQUE_SYSTEM_PROMPT).toContain('CHALLENGE');
    expect(SELF_CRITIQUE_SYSTEM_PROMPT).toContain('VERIFY ELEMENT');
    expect(SELF_CRITIQUE_SYSTEM_PROMPT).toContain('CHECK SEVERITY');
    expect(SELF_CRITIQUE_SYSTEM_PROMPT).toContain('REJECT');
    expect(SELF_CRITIQUE_SYSTEM_PROMPT).toContain('DOWNGRADE');
  });
});

describe('AC-08 R5.6 persona divergence (act-001 metric)', () => {
  const evalPersona = firstSentence(EVALUATE_SYSTEM_PROMPT);
  const critPersona = firstSentence(SELF_CRITIQUE_SYSTEM_PROMPT);

  it('token-set Jaccard distance ≥ 0.5', () => {
    const d = tokenSetJaccardDistance(evalPersona, critPersona);
    expect(d).toBeGreaterThanOrEqual(0.5);
  });

  it('zero shared word 5-grams', () => {
    const n = sharedFiveGramCount(evalPersona, critPersona);
    expect(n).toBe(0);
  });
});

describe('AC-08 buildSelfCritiqueUserMessage', () => {
  it('injects perception JSON', () => {
    const msg = buildSelfCritiqueUserMessage({
      perception: { metadata: { url: 'https://example.com' } },
      rawFindings: [],
    });
    expect(msg).toContain('https://example.com');
    expect(msg).toContain('ORIGINAL PAGE DATA');
    expect(msg).toContain('FINDINGS TO REVIEW');
  });

  it('filters out status:pass findings (spec line 495)', () => {
    const msg = buildSelfCritiqueUserMessage({
      perception: {},
      rawFindings: [
        { status: 'pass', heuristic_id: 'H-PASS-MARKER-XYZ' },
        { status: 'violation', heuristic_id: 'H-VIOLATION-MARKER-ABC' },
      ],
    });
    expect(msg).not.toContain('H-PASS-MARKER-XYZ');
    expect(msg).toContain('H-VIOLATION-MARKER-ABC');
  });
});
