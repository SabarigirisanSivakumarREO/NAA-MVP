import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  AgentCompleteInputSchema,
  AgentCompleteOutputSchema,
  createAgentCompleteTool,
} from '../../src/mcp/tools/agentComplete.js';
import type { ToolContext } from '../../src/mcp/types.js';

function stubLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger;
}
function stubCtx(): ToolContext {
  return { logger: stubLogger(), toolCallId: 't-1', clientSessionId: 'c-1' };
}

describe('T041 agent_complete factory — AC-04/AC-05', () => {
  it('exposes EXACT name + safe', () => {
    const tool = createAgentCompleteTool();
    expect(tool.name).toBe('agent_complete');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema accepts empty + optional fields; rejects bad shapes', () => {
    expect(AgentCompleteInputSchema.safeParse({}).success).toBe(true);
    expect(AgentCompleteInputSchema.safeParse({ summary: 'done' }).success).toBe(true);
    expect(AgentCompleteInputSchema.safeParse({ reason: 'audit complete' }).success).toBe(true);
    expect(
      AgentCompleteInputSchema.safeParse({ summary: 'done', reason: 'all checks passed' }).success,
    ).toBe(true);
    expect(AgentCompleteInputSchema.safeParse({ extra: 1 }).success).toBe(false);
    expect(AgentCompleteInputSchema.safeParse({ summary: 42 }).success).toBe(false);
  });

  it('outputSchema requires { ok: true, signal: "complete" }; allows optional fields', () => {
    expect(AgentCompleteOutputSchema.safeParse({ ok: true, signal: 'complete' }).success).toBe(true);
    expect(
      AgentCompleteOutputSchema.safeParse({
        ok: true,
        signal: 'complete',
        summary: 'x',
        reason: 'y',
      }).success,
    ).toBe(true);
    expect(AgentCompleteOutputSchema.safeParse({ ok: true, signal: 'wrong' }).success).toBe(false);
    expect(AgentCompleteOutputSchema.safeParse({ ok: false, signal: 'complete' }).success).toBe(false);
  });

  it('handler with empty input returns base signal only', async () => {
    const tool = createAgentCompleteTool();
    const out = await tool.handler({}, stubCtx());
    expect(out).toEqual({ ok: true, signal: 'complete' });
  });

  it('handler forwards summary + reason; omits undefined fields', async () => {
    const tool = createAgentCompleteTool();
    const out1 = await tool.handler({ summary: 'finished' }, stubCtx());
    expect(out1).toEqual({ ok: true, signal: 'complete', summary: 'finished' });
    expect(out1).not.toHaveProperty('reason');

    const out2 = await tool.handler({ summary: 'a', reason: 'b' }, stubCtx());
    expect(out2).toEqual({ ok: true, signal: 'complete', summary: 'a', reason: 'b' });
  });
});
