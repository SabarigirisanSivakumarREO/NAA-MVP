/**
 * MockAnthropicAdapter — test-only LLM adapter mock (R9 boundary discipline).
 *
 * Used by AC-08 / AC-09 / AC-10 / AC-11 conformance tests + AC-15 integration
 * test (Phase 4). Never reaches production code. Lives in tests/test-utils/
 * per the R9 + Phase 4 tasks.md `Notes` block (mocks live in tests/test-utils/).
 *
 * Behaviour modes:
 *   - 'ok'              → always returns a synthetic completion
 *   - 'fail-5x'         → throws a synthetic 5xx error every call
 *   - 'timeout'         → throws a synthetic timeout
 *   - 'budget-blocked'  → caller pre-empts via BudgetGate; mock unused
 *
 * @AC-08 / @AC-11 — shape proves an LLMAdapter implementation that satisfies
 * Phase 4 contracts can be swapped in for the real AnthropicAdapter.
 */
import type {
  LLMAdapter,
  LLMCompleteRequest,
  LLMCompleteResponse,
} from '../../../src/adapters/LLMAdapter.js';

export type MockBehaviour = 'ok' | 'fail-5x' | 'timeout';

export interface MockAnthropicAdapterOptions {
  readonly behaviour: MockBehaviour;
  readonly model?: string;
}

export class MockAnthropicAdapter implements LLMAdapter {
  public callCount = 0;
  private readonly options: MockAnthropicAdapterOptions;

  constructor(options: MockAnthropicAdapterOptions) {
    this.options = options;
  }

  async complete(req: LLMCompleteRequest): Promise<LLMCompleteResponse> {
    this.callCount += 1;
    if (this.options.behaviour === 'fail-5x') {
      const err = new Error('synthetic 5xx');
      (err as Error & { status?: number }).status = 503;
      throw err;
    }
    if (this.options.behaviour === 'timeout') {
      const err = new Error('synthetic timeout');
      (err as Error & { code?: string }).code = 'ETIMEDOUT';
      throw err;
    }
    return {
      text: `mock-response for op=${req.operation}`,
      model: this.options.model ?? 'claude-sonnet-4-mock',
      usage: { promptTokens: 100, completionTokens: 50, cacheHit: false },
      costUsd: 0.001,
      durationMs: 5,
    };
  }

  async estimateCost(_req: Pick<LLMCompleteRequest, 'userPrompt' | 'systemPrompt' | 'model'>): Promise<number> {
    return 0.001;
  }
}
