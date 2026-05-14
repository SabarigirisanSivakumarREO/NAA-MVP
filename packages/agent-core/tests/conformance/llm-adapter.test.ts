/**
 * AC-08 — LLMAdapter conformance (Phase 4 T073).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-08
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T073
 *     (REQ-LLM-ADAPTER-001 + REQ-LLM-COST-LOG-001 + R14.1)
 *
 * AC-08 contract:
 *   - LLMAdapter.complete({ operation, ... }) calls AnthropicAdapter with the
 *     pinned `claude-sonnet-4-*` model.
 *   - Atomically writes a row to `llm_call_log` BEFORE returning (R14.1).
 *   - Sets correlation fields (audit_run_id, client_id, llm_call_id, etc.).
 *
 * Uses MockAnthropicAdapter from tests/test-utils/mocks/.
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Modules absent → import fails.
 *
 * Anchor: @AC-08 — atomic llm_call_log + correlation binding.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// SUTs (don't exist yet — T073 lands these in Wave 2). Import fails → RED.
import { AnthropicAdapter } from '../../src/adapters/AnthropicAdapter.js';
import type { LLMAdapter } from '../../src/adapters/LLMAdapter.js';
import { getDbClient, runMigrations } from '../../src/db/client.js';
import { MockAnthropicAdapter } from '../test-utils/mocks/MockAnthropicAdapter.js';

describe('LLMAdapter — AC-08 conformance (RED until T073)', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-08: DATABASE_URL must be set; tests must NOT silently skip');
    }
    await runMigrations();
  });

  afterAll(async () => {
    const db = getDbClient();
    await db.end?.();
  });

  it('AC-08: LLMAdapter interface is implemented by AnthropicAdapter', () => {
    const adapter: LLMAdapter = new AnthropicAdapter({
      apiKey: 'mock-key',
      defaultModel: 'claude-sonnet-4-mock',
    });
    expect(typeof adapter.complete).toBe('function');
    expect(typeof adapter.estimateCost).toBe('function');
  });

  it('AC-08: complete() returns a typed LLMCompleteResponse with usage + costUsd', async () => {
    // The mock plays the role of the real adapter so we can prove the
    // contract shape; the live AnthropicAdapter conforms to the same.
    const mock: LLMAdapter = new MockAnthropicAdapter({ behaviour: 'ok' });
    const result = await mock.complete({
      operation: 'classify',
      audit_run_id: '00000000-0000-4000-8000-000000000500',
      userPrompt: 'hello',
      temperature: 0,
      maxTokens: 256,
    });
    expect(typeof result.text).toBe('string');
    expect(result.usage.promptTokens).toBeGreaterThanOrEqual(0);
    expect(result.costUsd).toBeGreaterThanOrEqual(0);
  });

  it('AC-08 R14.1: a successful complete() writes a row to llm_call_log atomically before return', async () => {
    const adapter = new AnthropicAdapter({
      apiKey: 'mock-key',
      defaultModel: 'claude-sonnet-4-mock',
      // T073 will accept an injected transport for testability; the seam
      // here is the MockAnthropicAdapter behaviour.
      transport: new MockAnthropicAdapter({ behaviour: 'ok' }),
    });
    const auditRunId = '00000000-0000-4000-8000-000000000501';
    await adapter.complete({
      operation: 'classify',
      audit_run_id: auditRunId,
      userPrompt: 'ping',
      temperature: 0,
      maxTokens: 16,
    });
    const db = getDbClient();
    const r = await db.query<{ outcome: string }>(
      `SELECT outcome FROM llm_call_log WHERE audit_run_id = $1`,
      [auditRunId],
    );
    expect(r.rows.some((row) => row.outcome === 'ok')).toBe(true);
  });
});
