/**
 * AC-09 — SelfCritiqueNode (Phase 7 T121, REQ-ANALYZE-NODE-003).
 *
 * R5.6 SEPARATE LLM call (operation='self_critique', distinct from evaluate).
 * Verifies verdict application (KEEP/REVISE/DOWNGRADE/REJECT) + retry +
 * budget/guard error mapping.
 */
import { describe, expect, it } from 'vitest';
import { selfCritiqueNodeRun } from '../../src/analysis/nodes/SelfCritiqueNode.js';
import type { RawFinding } from '../../src/orchestration/AnalysisState.js';
import type { AnalyzePerception } from '../../src/analysis/types.js';
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

const PERCEPTION = { metadata: { url: 'https://x.example' } } as unknown as AnalyzePerception;

function rf(id: string, status: RawFinding['status'] = 'violation'): RawFinding {
  return {
    heuristic_id: id,
    status,
    observation: `Observed something about ${id} on the page surface.`,
    assessment: `Assessment text for ${id} explaining the issue.`,
    evidence: {
      element_ref: null,
      element_selector: null,
      data_point: 'ctas[0]',
      measurement: null,
    },
    severity: 'high',
    confidence_basis: null,
    recommendation: null,
    needs_review: false,
  };
}

class MockLLM implements LLMAdapter {
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
      usage: { promptTokens: 50, completionTokens: 30, cacheHit: false },
      costUsd: 0.005,
      durationMs: 30,
    };
  }
  async estimateCost(): Promise<number> {
    return 0.005;
  }
}

describe('AC-09 SelfCritiqueNode', () => {
  it('R5.6 — invokes LLMAdapter with operation=self_critique temperature=0', async () => {
    const llm = new MockLLM([
      JSON.stringify([{ finding_index: 0, verdict: 'KEEP', reason: 'evidence sound' }]),
    ]);
    await selfCritiqueNodeRun({
      rawFindings: [rf('H-1')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(llm.lastRequest?.operation).toBe('self_critique');
    expect(llm.lastRequest?.temperature).toBe(0);
  });

  it('system prompt is the senior CRO quality reviewer (not evaluate persona)', async () => {
    const llm = new MockLLM([JSON.stringify([])]);
    await selfCritiqueNodeRun({
      rawFindings: [rf('H-1')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(llm.lastRequest?.systemPrompt).toContain('senior CRO quality reviewer');
    expect(llm.lastRequest?.systemPrompt).not.toContain('CRO analyst');
  });

  it('KEEP verdict — preserves raw finding fields + adds verdict + revision_notes', async () => {
    const llm = new MockLLM([
      JSON.stringify([{ finding_index: 0, verdict: 'KEEP', reason: 'evidence is solid' }]),
    ]);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-KEEP')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(out.critique_findings).toHaveLength(1);
    expect(out.critique_findings[0]?.verdict).toBe('KEEP');
    expect(out.critique_findings[0]?.heuristic_id).toBe('H-KEEP');
    expect(out.critique_findings[0]?.revision_notes).toBe('evidence is solid');
  });

  it('DOWNGRADE verdict — applies new_severity', async () => {
    const llm = new MockLLM([
      JSON.stringify([
        { finding_index: 0, verdict: 'DOWNGRADE', reason: 'over-stated', new_severity: 'low' },
      ]),
    ]);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-DOWN')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(out.critique_findings[0]?.verdict).toBe('DOWNGRADE');
    expect(out.critique_findings[0]?.severity).toBe('low');
  });

  it('REJECT verdict — drops finding from output', async () => {
    const llm = new MockLLM([
      JSON.stringify([
        { finding_index: 0, verdict: 'REJECT', reason: 'hallucinated' },
        { finding_index: 1, verdict: 'KEEP', reason: 'sound' },
      ]),
    ]);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-REJECT'), rf('H-KEEP')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(out.critique_findings).toHaveLength(1);
    expect(out.critique_findings[0]?.heuristic_id).toBe('H-KEEP');
  });

  it('REVISE verdict — merges revised_finding patch', async () => {
    const llm = new MockLLM([
      JSON.stringify([
        {
          finding_index: 0,
          verdict: 'REVISE',
          reason: 'tighter wording',
          revised_finding: {
            recommendation: 'Reduce form to 3 fields above the fold.',
          },
        },
      ]),
    ]);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-REV')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(out.critique_findings[0]?.verdict).toBe('REVISE');
    expect(out.critique_findings[0]?.recommendation).toBe(
      'Reduce form to 3 fields above the fold.',
    );
  });

  it('spec requires ≥1 reject on test fixture data (sanity)', async () => {
    const llm = new MockLLM([
      JSON.stringify([
        { finding_index: 0, verdict: 'REJECT', reason: 'no evidence' },
        { finding_index: 1, verdict: 'KEEP', reason: 'solid' },
        { finding_index: 2, verdict: 'DOWNGRADE', reason: 'over-stated', new_severity: 'medium' },
        { finding_index: 3, verdict: 'KEEP', reason: 'solid' },
        { finding_index: 4, verdict: 'KEEP', reason: 'solid' },
      ]),
    ]);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-1'), rf('H-2'), rf('H-3'), rf('H-4'), rf('H-5')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(out.critique_findings).toHaveLength(4);
    const verdicts = out.critique_findings.map((f) => f.verdict);
    expect(verdicts).toContain('DOWNGRADE');
  });

  it('skips reviewable=empty (all pass) without LLM call', async () => {
    const llm = new MockLLM(['unused']);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-PASS', 'pass')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(llm.callCount).toBe(0);
    expect(out.critique_findings).toEqual([]);
  });

  it('retries on malformed JSON, succeeds on 3rd attempt', async () => {
    const llm = new MockLLM([
      'not json',
      '{}',
      JSON.stringify([{ finding_index: 0, verdict: 'KEEP', reason: 'ok' }]),
    ]);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-1')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(llm.callCount).toBe(3);
    expect(out.critique_findings).toHaveLength(1);
  });

  it('retry exhaust → skipped_llm_output_invalid', async () => {
    const llm = new MockLLM(['bad', 'bad', 'bad']);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-1')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(out.critique_findings).toEqual([]);
    expect(out.analysis_status).toBe('skipped_llm_output_invalid');
  });

  it('BudgetExceededError → budget_exhausted_partial', async () => {
    const llm = new MockLLM([new BudgetExceededError('over', 1, 0)]);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-1')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(out.analysis_status).toBe('budget_exhausted_partial');
  });

  it('TemperatureGuardError → error_r10_temperature_guard_violation', async () => {
    const llm = new MockLLM([new TemperatureGuardError('x', 'self_critique', 0.5)]);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-1')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(out.analysis_status).toBe('error_r10_temperature_guard_violation');
  });

  it('LLMUnavailableError → skipped_llm_output_invalid', async () => {
    const llm = new MockLLM([new LLMUnavailableError('down', 3, new Error('5xx'))]);
    const out = await selfCritiqueNodeRun({
      rawFindings: [rf('H-1')],
      perception: PERCEPTION,
      llm,
      auditRunId: 'audit-1',
    });
    expect(out.analysis_status).toBe('skipped_llm_output_invalid');
  });
});
