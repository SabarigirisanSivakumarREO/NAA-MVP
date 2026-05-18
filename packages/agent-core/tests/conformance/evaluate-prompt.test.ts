/**
 * AC-06 — evaluate prompt template invariants (Phase 7 T118).
 *
 * Asserts R5.5 (heuristic content in user msg only), R6 (no heuristic body
 * across IP boundary), R5.3 (anti-prediction instruction appended).
 */
import { describe, expect, it } from 'vitest';
import {
  EVALUATE_SYSTEM_PROMPT,
  buildEvaluateUserMessage,
  type EvaluateUserMessageInput,
} from '../../src/analysis/prompts/evaluate.js';
import type { AnalyzePerception } from '../../src/analysis/types.js';
import type { HeuristicExtended } from '../../src/analysis/heuristics/types.js';

const PERCEPTION = {
  metadata: { url: 'https://example.com' },
  headingHierarchy: [],
  landmarks: [],
  semanticHTML: {},
  ctas: [],
  forms: [],
  trustSignals: [],
  layout: {
    viewportHeight: 800,
    foldPosition: 800,
    contentAboveFold: [],
    whitespaceRatio: 0.5,
  },
  navigation: {},
  images: [],
  textContent: { wordCount: 500, readabilityScore: 60 },
  performance: { domContentLoaded: 100, fullyLoaded: 200, resourceCount: 10 },
} as unknown as AnalyzePerception;

const SECRET_BODY = 'SECRET_HEURISTIC_BODY_DO_NOT_LEAK';
const SECRET_PROVENANCE_CITATION = 'SECRET_PROVENANCE_CITATION_PROSE';
const SECRET_AI_REVIEW_PROSE = 'SECRET_AI_REVIEW_PROSE';

const HEURISTIC_FIXTURE = {
  id: 'H-TEST-001',
  category: 'ctas',
  page_type: ['product'],
  archetype: ['ecommerce'],
  business_impact_weight: 0.8,
  benchmark: { value: 44, unit: 'px' },
  // R6-stripped fields — MUST NOT leak across.
  body: SECRET_BODY,
  provenance: { citation_text: SECRET_PROVENANCE_CITATION },
  ai_review: { why_generated: SECRET_AI_REVIEW_PROSE },
} as unknown as HeuristicExtended;

function baseInput(overrides: Partial<EvaluateUserMessageInput> = {}): EvaluateUserMessageInput {
  return {
    perception: PERCEPTION,
    filteredHeuristics: [HEURISTIC_FIXTURE],
    currentUrl: 'https://example.com/p/123',
    pageTypeDetected: 'product',
    businessType: 'ecommerce',
    ...overrides,
  };
}

describe('AC-06 evaluate system prompt', () => {
  it('contains the spec methodology + rules anchors', () => {
    expect(EVALUATE_SYSTEM_PROMPT).toContain('CRO analyst');
    expect(EVALUATE_SYSTEM_PROMPT).toContain('OBSERVE:');
    expect(EVALUATE_SYSTEM_PROMPT).toContain('ASSESS:');
    expect(EVALUATE_SYSTEM_PROMPT).toContain('EVIDENCE:');
    expect(EVALUATE_SYSTEM_PROMPT).toContain('SEVERITY:');
    expect(EVALUATE_SYSTEM_PROMPT).toContain('NEVER predict conversion rates');
  });

  it('is referentially stable (module-level const → cache-friendly)', () => {
    // R5.5 — system prompt MUST be the same string instance across calls.
    const a = EVALUATE_SYSTEM_PROMPT;
    const b = EVALUATE_SYSTEM_PROMPT;
    expect(a).toBe(b);
  });

  it('R5.5 — system prompt contains no heuristic identity', () => {
    expect(EVALUATE_SYSTEM_PROMPT).not.toContain('H-TEST-001');
    expect(EVALUATE_SYSTEM_PROMPT).not.toContain('ctas');
  });
});

describe('AC-06 buildEvaluateUserMessage', () => {
  it('injects URL, page type, business type', () => {
    const msg = buildEvaluateUserMessage(baseInput());
    expect(msg).toContain('https://example.com/p/123');
    expect(msg).toContain('Page type: product');
    expect(msg).toContain('Business type: ecommerce');
  });

  it('injects filtered heuristics public fields', () => {
    const msg = buildEvaluateUserMessage(baseInput());
    expect(msg).toContain('H-TEST-001');
    expect(msg).toContain('ctas');
    expect(msg).toContain('product');
  });

  it('R6 — heuristic body / provenance / ai_review MUST NOT leak', () => {
    const msg = buildEvaluateUserMessage(baseInput());
    expect(msg).not.toContain(SECRET_BODY);
    expect(msg).not.toContain(SECRET_PROVENANCE_CITATION);
    expect(msg).not.toContain(SECRET_AI_REVIEW_PROSE);
  });

  it('R5.3 — anti-prediction instruction appended', () => {
    const msg = buildEvaluateUserMessage(baseInput());
    expect(msg).toMatch(/Do NOT predict conversion rates/);
    expect(msg).toMatch(/uplift/);
  });

  it('persona block appears when input.persona set', () => {
    const msg = buildEvaluateUserMessage(baseInput({ persona: 'price-sensitive mobile shopper' }));
    expect(msg).toContain('PERSONA CONTEXT:');
    expect(msg).toContain('price-sensitive mobile shopper');
  });

  it('persona block absent when persona omitted', () => {
    const msg = buildEvaluateUserMessage(baseInput());
    expect(msg).not.toContain('PERSONA CONTEXT:');
  });
});
