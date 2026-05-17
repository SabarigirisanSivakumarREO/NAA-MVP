/**
 * CostTracker — Phase 7 T116 per-audit_run cost accumulator + soft budget gate.
 *
 * Source: AC-04 + REQ-COST-LOG-001 (R14.1 atomic llm_call_log semantics) +
 *         REQ-COST-BUDGET-001 (R14.2 pre-call estimate).
 *
 * Layered above BudgetGate (Phase 4 T073):
 *   - BudgetGate.check THROWS on exceed (adapter-boundary hard gate).
 *   - CostTracker.preCallGate uses BudgetGate.estimate and returns a SOFT
 *     route { allow: false } so the LangGraph state machine can branch to
 *     partial-finish instead of unwinding the stack.
 *
 * State is pure in-memory keyed by audit_run_id. No DB; persistence is a
 * caller concern (emitter side-effect: llm_call_log row + audit_event row).
 */
import { BudgetGate } from '../adapters/BudgetGate.js';

export interface CostCall {
  audit_run_id: string;
  page_url: string;
  operation: 'evaluate' | 'self_critique' | 'classify' | 'extract' | 'other';
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  occurred_at: Date;
}

export interface PreCallGateInput {
  audit_run_id: string;
  page_url: string;
  operation: CostCall['operation'];
  prompt: string;
  model: string;
  budget_remaining_usd: number;
}

export type AuditEventEmitter = (event: {
  audit_run_id: string;
  type: 'budget_exhausted_partial' | 'llm_call_completed';
  page_url?: string;
  payload: Record<string, unknown>;
}) => void | Promise<void>;

interface RunState {
  calls: CostCall[];
  cumulative: number;
}

export class CostTracker {
  private readonly state = new Map<string, RunState>();

  constructor(private readonly emitAuditEvent: AuditEventEmitter) {}

  public async preCallGate(
    input: PreCallGateInput,
  ): Promise<{ allow: boolean; estimated_usd: number }> {
    const estimated_usd = BudgetGate.estimate({
      operation: input.operation,
      audit_run_id: input.audit_run_id,
      userPrompt: input.prompt,
      temperature: 0,
      maxTokens: 0,
      model: input.model,
    });
    if (estimated_usd > input.budget_remaining_usd) {
      await this.emitAuditEvent({
        audit_run_id: input.audit_run_id,
        type: 'budget_exhausted_partial',
        page_url: input.page_url,
        payload: {
          estimated_usd,
          budget_remaining_usd: input.budget_remaining_usd,
          operation: input.operation,
        },
      });
      return { allow: false, estimated_usd };
    }
    return { allow: true, estimated_usd };
  }

  public async recordCall(call: CostCall): Promise<void> {
    const run = this.state.get(call.audit_run_id) ?? { calls: [], cumulative: 0 };
    run.calls.push(call);
    run.cumulative += call.cost_usd;
    this.state.set(call.audit_run_id, run);
    await this.emitAuditEvent({
      audit_run_id: call.audit_run_id,
      type: 'llm_call_completed',
      page_url: call.page_url,
      payload: {
        cost_usd: call.cost_usd,
        operation: call.operation,
        page_url: call.page_url,
      },
    });
  }

  public cumulativeUsd(audit_run_id: string): number {
    return this.state.get(audit_run_id)?.cumulative ?? 0;
  }

  public callsFor(audit_run_id: string): readonly CostCall[] {
    return [...(this.state.get(audit_run_id)?.calls ?? [])];
  }
}
