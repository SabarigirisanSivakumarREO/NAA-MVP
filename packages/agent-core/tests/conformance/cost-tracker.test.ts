/**
 * CostTracker conformance — Phase 7 T116, AC-04.
 *
 * REQ-COST-LOG-001 (R14.1 atomic) + REQ-COST-BUDGET-001 (R14.2 pre-call).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  CostTracker,
  type AuditEventEmitter,
  type CostCall,
} from '../../src/analysis/CostTracker.js';

const MODEL = 'claude-sonnet-4-mock';

const makeCall = (over: Partial<CostCall> = {}): CostCall => ({
  audit_run_id: 'run-1',
  page_url: 'https://example.com/p',
  operation: 'evaluate',
  cost_usd: 0.10,
  input_tokens: 100,
  output_tokens: 50,
  occurred_at: new Date('2026-05-18T00:00:00Z'),
  ...over,
});

describe('CostTracker (AC-04)', () => {
  it('preCallGate allows when estimate < remaining', async () => {
    const emit = vi.fn<AuditEventEmitter>();
    const t = new CostTracker(emit);
    const res = await t.preCallGate({
      audit_run_id: 'run-1',
      page_url: 'https://example.com/p',
      operation: 'evaluate',
      prompt: 'hi',
      model: MODEL,
      budget_remaining_usd: 10,
    });
    expect(res.allow).toBe(true);
    expect(res.estimated_usd).toBeGreaterThan(0);
    expect(emit).not.toHaveBeenCalled();
  });

  it('preCallGate blocks when estimate > remaining and emits budget_exhausted_partial', async () => {
    const emit = vi.fn<AuditEventEmitter>();
    const t = new CostTracker(emit);
    const bigPrompt = 'word '.repeat(50_000);
    const res = await t.preCallGate({
      audit_run_id: 'run-1',
      page_url: 'https://example.com/p',
      operation: 'evaluate',
      prompt: bigPrompt,
      model: MODEL,
      budget_remaining_usd: 0.01,
    });
    expect(res.allow).toBe(false);
    expect(emit).toHaveBeenCalledTimes(1);
    const ev = emit.mock.calls[0]![0];
    expect(ev.type).toBe('budget_exhausted_partial');
    expect(ev.audit_run_id).toBe('run-1');
    expect(ev.page_url).toBe('https://example.com/p');
    expect(ev.payload.estimated_usd).toBe(res.estimated_usd);
  });

  it('recordCall accumulates cumulativeUsd + callsFor length', async () => {
    const emit = vi.fn<AuditEventEmitter>();
    const t = new CostTracker(emit);
    await t.recordCall(makeCall({ cost_usd: 0.10 }));
    await t.recordCall(makeCall({ cost_usd: 0.20 }));
    await t.recordCall(makeCall({ cost_usd: 0.30 }));
    expect(t.cumulativeUsd('run-1')).toBeCloseTo(0.60, 10);
    expect(t.callsFor('run-1')).toHaveLength(3);
  });

  it('recordCall emits llm_call_completed once per call', async () => {
    const emit = vi.fn<AuditEventEmitter>();
    const t = new CostTracker(emit);
    await t.recordCall(makeCall({ cost_usd: 0.42, operation: 'classify' }));
    expect(emit).toHaveBeenCalledTimes(1);
    const ev = emit.mock.calls[0]![0];
    expect(ev.type).toBe('llm_call_completed');
    expect(ev.payload.cost_usd).toBe(0.42);
    expect(ev.payload.operation).toBe('classify');
    expect(ev.payload.page_url).toBe('https://example.com/p');
  });

  it('isolates state across distinct audit_run_id', async () => {
    const emit = vi.fn<AuditEventEmitter>();
    const t = new CostTracker(emit);
    await t.recordCall(makeCall({ audit_run_id: 'A', cost_usd: 0.10 }));
    await t.recordCall(makeCall({ audit_run_id: 'A', cost_usd: 0.05 }));
    await t.recordCall(makeCall({ audit_run_id: 'B', cost_usd: 0.99 }));
    expect(t.cumulativeUsd('A')).toBeCloseTo(0.15, 10);
    expect(t.cumulativeUsd('B')).toBeCloseTo(0.99, 10);
    expect(t.callsFor('A')).toHaveLength(2);
    expect(t.callsFor('B')).toHaveLength(1);
  });

  it('callsFor returns defensive copy', async () => {
    const emit = vi.fn<AuditEventEmitter>();
    const t = new CostTracker(emit);
    await t.recordCall(makeCall());
    const snap = t.callsFor('run-1') as CostCall[];
    snap.push(makeCall({ cost_usd: 999 }));
    expect(t.callsFor('run-1')).toHaveLength(1);
    expect(t.cumulativeUsd('run-1')).toBeCloseTo(0.10, 10);
  });

  it('propagates emitter rejection from recordCall (R14.1 atomic)', async () => {
    const boom = new Error('emit failed');
    const emit: AuditEventEmitter = vi.fn(async () => {
      throw boom;
    });
    const t = new CostTracker(emit);
    await expect(t.recordCall(makeCall())).rejects.toBe(boom);
  });
});
