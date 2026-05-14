/**
 * AC-11 — LLMAdapter failover protocol conformance (Phase 4 T073).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-11
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T073
 *     (REQ-LLM-FAILOVER-001 + R14.5)
 *
 * AC-11 contract:
 *   - On Anthropic 5xx or timeout, retry 3 times with exponential backoff.
 *   - On persistent failure, throw LLMUnavailableError.
 *   - v1.2 will plug fallback adapter via the same protocol — Phase 4 verifies
 *     the retry shape and error propagation.
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Modules absent → import fails.
 *
 * Anchor: @AC-11 — 3-retry failover scaffold.
 */
import { describe, expect, it } from 'vitest';

// SUTs (don't exist yet — T073 lands these in Wave 2). Import fails → RED.
import { AnthropicAdapter, LLMUnavailableError } from '../../src/adapters/AnthropicAdapter.js';
import { MockAnthropicAdapter } from '../test-utils/mocks/MockAnthropicAdapter.js';

describe('LLMAdapter failover — AC-11 conformance (RED until T073)', () => {
  it('AC-11: persistent 5xx → 3 retries → throw LLMUnavailableError', async () => {
    const failingTransport = new MockAnthropicAdapter({ behaviour: 'fail-5x' });
    const adapter = new AnthropicAdapter({
      apiKey: 'mock-key',
      defaultModel: 'claude-sonnet-4-mock',
      transport: failingTransport,
      // T073 will allow shrinking retry backoff in test mode.
      retryBackoffMs: 0,
    });
    await expect(
      adapter.complete({
        operation: 'classify',
        audit_run_id: '00000000-0000-4000-8000-000000000800',
        userPrompt: 'fail-me',
        temperature: 0,
        maxTokens: 16,
      }),
    ).rejects.toThrow(LLMUnavailableError);
    // Initial attempt + 3 retries = 4 transport invocations.
    expect(failingTransport.callCount).toBe(4);
  });

  it('AC-11: timeout class is retry-eligible (same 3-retry budget)', async () => {
    const timingOutTransport = new MockAnthropicAdapter({ behaviour: 'timeout' });
    const adapter = new AnthropicAdapter({
      apiKey: 'mock-key',
      defaultModel: 'claude-sonnet-4-mock',
      transport: timingOutTransport,
      retryBackoffMs: 0,
    });
    await expect(
      adapter.complete({
        operation: 'classify',
        audit_run_id: '00000000-0000-4000-8000-000000000801',
        userPrompt: 'time-me-out',
        temperature: 0,
        maxTokens: 16,
      }),
    ).rejects.toThrow(LLMUnavailableError);
    expect(timingOutTransport.callCount).toBe(4);
  });

  it('AC-11: a recoverable transport (always ok) succeeds without retry', async () => {
    const okTransport = new MockAnthropicAdapter({ behaviour: 'ok' });
    const adapter = new AnthropicAdapter({
      apiKey: 'mock-key',
      defaultModel: 'claude-sonnet-4-mock',
      transport: okTransport,
      retryBackoffMs: 0,
    });
    const result = await adapter.complete({
      operation: 'classify',
      audit_run_id: '00000000-0000-4000-8000-000000000802',
      userPrompt: 'ok-please',
      temperature: 0,
      maxTokens: 16,
    });
    expect(result.text.length).toBeGreaterThan(0);
    expect(okTransport.callCount).toBe(1);
  });
});
