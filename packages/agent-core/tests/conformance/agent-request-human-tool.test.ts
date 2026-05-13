import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  AgentRequestHumanInputSchema,
  AgentRequestHumanOutputSchema,
  createAgentRequestHumanTool,
} from '../../src/mcp/tools/agentRequestHuman.js';
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

describe('T042 agent_request_human factory — AC-04/AC-05 + R8.4', () => {
  it('exposes EXACT name + requires_hitl (R8.4 load-bearing)', () => {
    const tool = createAgentRequestHumanTool();
    expect(tool.name).toBe('agent_request_human');
    expect(tool.safetyClass).toBe('requires_hitl');
  });

  it('inputSchema requires reason; rejects empty/missing/unknown keys', () => {
    expect(AgentRequestHumanInputSchema.safeParse({ reason: 'captcha' }).success).toBe(true);
    expect(
      AgentRequestHumanInputSchema.safeParse({ reason: 'captcha', context: 'page X' }).success,
    ).toBe(true);
    expect(AgentRequestHumanInputSchema.safeParse({}).success).toBe(false);
    expect(AgentRequestHumanInputSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(AgentRequestHumanInputSchema.safeParse({ context: 'no reason' }).success).toBe(false);
    expect(
      AgentRequestHumanInputSchema.safeParse({ reason: 'r', extra: 1 }).success,
    ).toBe(false);
    expect(AgentRequestHumanInputSchema.safeParse({ reason: 42 }).success).toBe(false);
  });

  it('outputSchema requires { ok: true, signal: "request_human", reason }; allows optional context', () => {
    expect(
      AgentRequestHumanOutputSchema.safeParse({ ok: true, signal: 'request_human', reason: 'r' })
        .success,
    ).toBe(true);
    expect(
      AgentRequestHumanOutputSchema.safeParse({
        ok: true,
        signal: 'request_human',
        reason: 'r',
        context: 'c',
      }).success,
    ).toBe(true);
    expect(
      AgentRequestHumanOutputSchema.safeParse({ ok: true, signal: 'wrong', reason: 'r' }).success,
    ).toBe(false);
    expect(
      AgentRequestHumanOutputSchema.safeParse({ ok: false, signal: 'request_human', reason: 'r' })
        .success,
    ).toBe(false);
    expect(
      AgentRequestHumanOutputSchema.safeParse({ ok: true, signal: 'request_human' }).success,
    ).toBe(false);
  });

  it('handler echoes reason; forwards context when present; omits when undefined', async () => {
    const tool = createAgentRequestHumanTool();
    const out1 = await tool.handler({ reason: 'captcha blocking' }, stubCtx());
    expect(out1).toEqual({ ok: true, signal: 'request_human', reason: 'captcha blocking' });
    expect(out1).not.toHaveProperty('context');

    const out2 = await tool.handler(
      { reason: 'ambiguous dialog', context: 'modal on /checkout' },
      stubCtx(),
    );
    expect(out2).toEqual({
      ok: true,
      signal: 'request_human',
      reason: 'ambiguous dialog',
      context: 'modal on /checkout',
    });
  });
});
