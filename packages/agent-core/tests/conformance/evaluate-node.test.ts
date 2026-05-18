/**
 * AC-07 — EvaluateNode (Phase 7 T119, REQ-ANALYZE-NODE-002).
 *
 * Verifies LLM contract (operation:'evaluate', temp=0), heuristic loader
 * wiring, RawFinding Zod validation, retry semantics, budget+temperature
 * guard mapping, persona/viewport tagging.
 *
 * No real Anthropic SDK calls — MockLLMAdapter scripts deterministic
 * responses per case.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { evaluateNodeRun } from '../../src/analysis/nodes/EvaluateNode.js';
import type {
  HeuristicLoaderSurface,
  EvaluateNodeInput,
} from '../../src/analysis/nodes/EvaluateNode.js';
import type { AnalysisState } from '../../src/orchestration/AnalysisState.js';
import type { AnalyzePerception } from '../../src/analysis/types.js';
import type { HeuristicExtended } from '../../src/analysis/heuristics/types.js';
import type {
  LLMAdapter,
  LLMCompleteRequest,
  LLMCompleteResponse,
} from '../../src/adapters/LLMAdapter.js';
import {
  BudgetExceededError,
  TemperatureGuardError,
  LLMUnavailableError,
} from '../../src/adapters/LLMAdapter.js';

const PERCEPTION = {
  metadata: { url: 'https://shop.example/p/123' },
  headingHierarchy: [],
  landmarks: [],
  semanticHTML: {},
  ctas: [{ text: 'Add to bag' }],
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

function makeHeuristic(id: string, weight: number): HeuristicExtended {
  return {
    id,
    body: `SECRET_BODY_${id}`,
    category: 'ctas',
    version: '1.0.0',
    rule_vs_guidance: 'rule',
    business_impact_weight: weight,
    effort_category: 'low',
    preferred_states: ['default'],
    status: 'active',
    benchmark: { value: 44, unit: 'px' },
    provenance: {
      source_url: 'https://baymard.com/x',
      citation_text: 'cite',
      draft_model: 'claude',
      verified_by: 'tester',
      verified_date: '2026-01-01',
    },
    archetype: ['ecommerce'],
    page_type: ['product'],
    device: ['mobile'],
  } as unknown as HeuristicExtended;
}

class MockLLMAdapter implements LLMAdapter {
  public lastRequest: LLMCompleteRequest | null = null;
  public callCount = 0;
  constructor(private readonly responses: ReadonlyArray<string | Error>) {}
  async complete(req: LLMCompleteRequest): Promise<LLMCompleteResponse> {
    this.lastRequest = req;
    const i = Math.min(this.callCount, this.responses.length - 1);
    this.callCount += 1;
    const r = this.responses[i];
    if (r instanceof Error) throw r;
    return {
      text: r as string,
      model: 'claude-sonnet-4',
      usage: { promptTokens: 100, completionTokens: 50, cacheHit: false },
      costUsd: 0.01,
      durationMs: 50,
    };
  }
  async estimateCost(): Promise<number> {
    return 0.01;
  }
}

const VALID_FINDING = {
  heuristic_id: 'BAYMARD-001',
  status: 'violation',
  observation: 'The Add to Bag CTA hit area is 280×48px, exceeding the 44px touch-target benchmark.',
  assessment: 'Touch-target sized appropriately; no friction at this layer.',
  evidence: {
    element_ref: 'Add to bag',
    element_selector: 'button.add-to-bag',
    data_point: 'ctas[0]',
    measurement: '280x48 at y:420',
  },
  severity: 'low',
  confidence_basis: 'Measured against 44px minimum from heuristic benchmark.',
  recommendation: 'No action required.',
  needs_review: false,
};

const VALID_LLM_OUTPUT = JSON.stringify([VALID_FINDING]);

function makeInput(
  llm: LLMAdapter,
  heuristics: HeuristicExtended[],
  overrides: Partial<EvaluateNodeInput> = {},
): EvaluateNodeInput {
  const loader: HeuristicLoaderSurface = {
    async loadForContext() {
      return heuristics;
    },
  };
  return {
    state: {} as AnalysisState,
    perception: PERCEPTION,
    llm,
    heuristicLoader: loader,
    auditRunId: 'audit-test-001',
    currentUrl: 'https://shop.example/p/123',
    pageTypeDetected: 'product',
    businessType: 'ecommerce',
    ...overrides,
  };
}

describe('AC-07 EvaluateNode — happy path', () => {
  let llm: MockLLMAdapter;
  beforeEach(() => {
    llm = new MockLLMAdapter([VALID_LLM_OUTPUT]);
  });

  it('returns validated RawFinding[]', async () => {
    const out = await evaluateNodeRun(makeInput(llm, [makeHeuristic('BAYMARD-001', 0.9)]));
    expect(out.evaluate_findings_raw).toHaveLength(1);
    expect(out.evaluate_findings_raw[0]?.heuristic_id).toBe('BAYMARD-001');
    expect(out.evaluate_findings_raw[0]?.status).toBe('violation');
  });

  it('R10/R13 — invokes LLMAdapter with operation=evaluate temperature=0', async () => {
    await evaluateNodeRun(makeInput(llm, [makeHeuristic('H-1', 0.5)]));
    expect(llm.lastRequest?.operation).toBe('evaluate');
    expect(llm.lastRequest?.temperature).toBe(0);
  });

  it('R5.5 — system prompt is the static EVALUATE_SYSTEM_PROMPT', async () => {
    await evaluateNodeRun(makeInput(llm, [makeHeuristic('H-1', 0.5)]));
    expect(llm.lastRequest?.systemPrompt).toContain('CRO analyst');
  });

  it('R6 — heuristic body MUST NOT leak into LLM userPrompt', async () => {
    await evaluateNodeRun(makeInput(llm, [makeHeuristic('H-SECRET', 0.5)]));
    expect(llm.lastRequest?.userPrompt).not.toContain('SECRET_BODY_H-SECRET');
  });

  it('caps heuristics at 30 via prioritizeHeuristics', async () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      makeHeuristic(`H-${String(i).padStart(3, '0')}`, i / 50),
    );
    await evaluateNodeRun(makeInput(llm, many));
    const matches = llm.lastRequest?.userPrompt.match(/"H-\d{3}"/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(30);
  });

  it('tags findings with persona + viewport when set', async () => {
    const out = await evaluateNodeRun(
      makeInput(llm, [makeHeuristic('H-1', 0.5)], {
        persona: 'price_sensitive_mobile',
        viewport: 'mobile',
      }),
    );
    expect(out.evaluate_findings_raw[0]?.persona).toBe('price_sensitive_mobile');
    expect(out.evaluate_findings_raw[0]?.viewport).toBe('mobile');
  });
});

describe('AC-07 EvaluateNode — edge cases', () => {
  it('empty heuristic set → complete_no_findings (no LLM call)', async () => {
    const llm = new MockLLMAdapter([VALID_LLM_OUTPUT]);
    const out = await evaluateNodeRun(makeInput(llm, []));
    expect(out.evaluate_findings_raw).toEqual([]);
    expect(out.analysis_status).toBe('complete_no_findings');
    expect(llm.callCount).toBe(0);
  });

  it('retries up to 2x on malformed JSON, succeeds on 3rd attempt', async () => {
    const llm = new MockLLMAdapter(['not json', '{also not array}', VALID_LLM_OUTPUT]);
    const out = await evaluateNodeRun(makeInput(llm, [makeHeuristic('H-1', 0.5)]));
    expect(llm.callCount).toBe(3);
    expect(out.evaluate_findings_raw).toHaveLength(1);
  });

  it('retry exhaust on persistent malformed → skipped_llm_output_invalid', async () => {
    const llm = new MockLLMAdapter(['bad', 'still bad', 'always bad']);
    const out = await evaluateNodeRun(makeInput(llm, [makeHeuristic('H-1', 0.5)]));
    expect(llm.callCount).toBe(3);
    expect(out.evaluate_findings_raw).toEqual([]);
    expect(out.analysis_status).toBe('skipped_llm_output_invalid');
  });

  it('BudgetExceededError → budget_exhausted_partial', async () => {
    const llm = new MockLLMAdapter([new BudgetExceededError('over', 1, 0)]);
    const out = await evaluateNodeRun(makeInput(llm, [makeHeuristic('H-1', 0.5)]));
    expect(out.analysis_status).toBe('budget_exhausted_partial');
  });

  it('TemperatureGuardError → error_r10_temperature_guard_violation', async () => {
    const llm = new MockLLMAdapter([new TemperatureGuardError('guard', 'evaluate', 0.5)]);
    const out = await evaluateNodeRun(makeInput(llm, [makeHeuristic('H-1', 0.5)]));
    expect(out.analysis_status).toBe('error_r10_temperature_guard_violation');
  });

  it('LLMUnavailableError → skipped_llm_output_invalid', async () => {
    const llm = new MockLLMAdapter([
      new LLMUnavailableError('down', 3, new Error('5xx')),
    ]);
    const out = await evaluateNodeRun(makeInput(llm, [makeHeuristic('H-1', 0.5)]));
    expect(out.analysis_status).toBe('skipped_llm_output_invalid');
  });

  it('accepts LLM output wrapped in markdown code fence', async () => {
    const llm = new MockLLMAdapter(['```json\n' + VALID_LLM_OUTPUT + '\n```']);
    const out = await evaluateNodeRun(makeInput(llm, [makeHeuristic('H-1', 0.5)]));
    expect(out.evaluate_findings_raw).toHaveLength(1);
  });
});
