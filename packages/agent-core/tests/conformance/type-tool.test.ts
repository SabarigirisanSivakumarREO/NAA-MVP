/**
 * AC-04/AC-05 — T029 browser_type factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T029; impact.md MCPToolRegistry
 *       Interaction row (safetyClass = 'requires_safety_check');
 *       REQ-BROWSE-HUMAN-003/004 (Gaussian typing + 1-2% typo rate).
 *
 * Stub-only — no real Playwright, no real TypingBehavior. Integration
 * coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  TypeInputSchema,
  TypeOutputSchema,
  createTypeTool,
} from '../../src/mcp/tools/type.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import { typingBehavior } from '../../src/browser-runtime/TypingBehavior.js';
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

function stubSession(focus: (sel: string) => Promise<void>): BrowserSession {
  return {
    id: 's-1',
    page: {
      focus,
      url: () => 'https://example.test/',
    } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  };
}

describe('T029 browser_type factory — AC-04/AC-05', () => {
  it('exposes EXACT name + requires_safety_check', () => {
    const tool = createTypeTool({
      session: stubSession(async () => {}),
      typing: { type: async () => {} } as unknown as typeof typingBehavior,
    });
    expect(tool.name).toBe('browser_type');
    expect(tool.safetyClass).toBe('requires_safety_check');
  });

  it('inputSchema rejects missing/empty selector + missing text + bad typoRate + unknown keys', () => {
    expect(TypeInputSchema.safeParse({ text: 'hi' }).success).toBe(false);
    expect(TypeInputSchema.safeParse({ selector: '', text: 'hi' }).success).toBe(false);
    expect(TypeInputSchema.safeParse({ selector: '#email' }).success).toBe(false);
    expect(
      TypeInputSchema.safeParse({ selector: '#email', text: 'hi', typoRate: 0.1 }).success,
    ).toBe(false);
    expect(
      TypeInputSchema.safeParse({ selector: '#email', text: 'hi', extra: 1 }).success,
    ).toBe(false);
    expect(TypeInputSchema.safeParse({ selector: '#email', text: 'hi' }).success).toBe(true);
  });

  it('outputSchema requires { ok: true, charCount: nonneg int }', () => {
    expect(TypeOutputSchema.safeParse({ ok: true, charCount: 5 }).success).toBe(true);
    expect(TypeOutputSchema.safeParse({ ok: true, charCount: -1 }).success).toBe(false);
    expect(TypeOutputSchema.safeParse({ ok: false, charCount: 0 }).success).toBe(false);
  });

  it('handler focuses selector BEFORE calling typing.type and forwards opts present-only', async () => {
    const order: string[] = [];
    const focusSpy = vi.fn(async (_sel: string) => {
      order.push('focus');
    });
    const typeSpy = vi.fn(async () => {
      order.push('type');
    });
    const session = stubSession(focusSpy);
    const tool = createTypeTool({
      session,
      typing: { type: typeSpy } as unknown as typeof typingBehavior,
    });
    const out = await tool.handler(
      { selector: '#email', text: 'hello', meanMs: 100, typoRate: 0.02 },
      stubCtx(),
    );
    expect(order).toEqual(['focus', 'type']);
    expect(focusSpy).toHaveBeenCalledWith('#email');
    // typing.type called with (page, selector, text, optsWithCorrelation)
    const call = typeSpy.mock.calls[0]!;
    const [page, target, text, opts] = call as [
      BrowserSession['page'],
      string,
      string,
      Record<string, unknown>,
    ];
    expect(page).toBe(session.page);
    expect(target).toBe('#email');
    expect(text).toBe('hello');
    expect(opts).toMatchObject({
      meanMs: 100,
      typoRate: 0.02,
      tool_name: 'browser_type',
      tool_call_id: 't-1',
      client_session_id: 'c-1',
    });
    expect(opts).not.toHaveProperty('stdMs'); // not supplied → omitted
    expect(out).toEqual({ ok: true, charCount: 5 });
  });
});
