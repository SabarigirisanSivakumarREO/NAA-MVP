/**
 * T038 browser_find_by_text conformance — AC-04/AC-05 + REQ-MCP-001/REQ-MCP-002.
 *
 * Validates the factory shape (EXACT name + safetyClass='safe'), Zod input
 * boundary (text required + non-empty, limit ≤ 100, strict unknown-key
 * rejection), output schema, default exact/limit, and explicit-arg forwarding
 * to session.page.evaluate.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  FindByTextInputSchema,
  FindByTextOutputSchema,
  createFindByTextTool,
} from '../../src/mcp/tools/findByText.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
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

function stubSession(
  evaluate: (fn: string, args: unknown) => Promise<unknown>,
): BrowserSession {
  return {
    id: 's-1',
    page: {
      evaluate,
      url: () => 'https://example.test/',
    } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  };
}

describe('T038 browser_find_by_text factory — AC-04/AC-05', () => {
  it('exposes EXACT name + safe', () => {
    const tool = createFindByTextTool({
      session: stubSession(async () => ({ matches: [], totalCount: 0 })),
    });
    expect(tool.name).toBe('browser_find_by_text');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema accepts valid + rejects empty text/over-limit/unknown', () => {
    expect(FindByTextInputSchema.safeParse({ text: 'Buy' }).success).toBe(true);
    expect(
      FindByTextInputSchema.safeParse({ text: 'Buy', exact: true }).success,
    ).toBe(true);
    expect(
      FindByTextInputSchema.safeParse({ text: 'Buy', limit: 50 }).success,
    ).toBe(true);
    expect(FindByTextInputSchema.safeParse({ text: '' }).success).toBe(false);
    expect(
      FindByTextInputSchema.safeParse({ text: 'Buy', limit: 101 }).success,
    ).toBe(false);
    expect(
      FindByTextInputSchema.safeParse({ text: 'Buy', limit: 0 }).success,
    ).toBe(false);
    expect(
      FindByTextInputSchema.safeParse({ text: 'Buy', limit: 1.5 }).success,
    ).toBe(false);
    expect(
      FindByTextInputSchema.safeParse({ text: 'Buy', extra: 1 }).success,
    ).toBe(false);
  });

  it('outputSchema requires { ok: true, matches: Match[], totalCount: nonneg int }', () => {
    expect(
      FindByTextOutputSchema.safeParse({
        ok: true,
        matches: [],
        totalCount: 0,
      }).success,
    ).toBe(true);
    expect(
      FindByTextOutputSchema.safeParse({
        ok: true,
        matches: [
          {
            text: 'Buy',
            tagName: 'button',
            x: 10,
            y: 20,
            width: 80,
            height: 30,
            visible: true,
          },
        ],
        totalCount: 1,
      }).success,
    ).toBe(true);
    expect(
      FindByTextOutputSchema.safeParse({
        ok: true,
        matches: [],
        totalCount: -1,
      }).success,
    ).toBe(false);
    expect(
      FindByTextOutputSchema.safeParse({
        ok: false,
        matches: [],
        totalCount: 0,
      }).success,
    ).toBe(false);
  });

  it('handler defaults exact=false + limit=20 + wraps result', async () => {
    const fixture = {
      matches: [
        {
          text: 'Buy Now',
          tagName: 'button',
          x: 10,
          y: 20,
          width: 80,
          height: 30,
          visible: true,
        },
      ],
      totalCount: 1,
    };
    const evalSpy = vi.fn(async () => fixture);
    const tool = createFindByTextTool({ session: stubSession(evalSpy) });
    const out = await tool.handler({ text: 'Buy' }, stubCtx());
    const [, args] = evalSpy.mock.calls[0]!;
    expect(args).toEqual({ text: 'Buy', exact: false, limit: 20 });
    expect(out).toEqual({ ok: true, matches: fixture.matches, totalCount: 1 });
  });

  it('handler forwards explicit exact + limit', async () => {
    const evalSpy = vi.fn(async () => ({ matches: [], totalCount: 5 }));
    const tool = createFindByTextTool({ session: stubSession(evalSpy) });
    const out = await tool.handler(
      { text: 'Submit', exact: true, limit: 5 },
      stubCtx(),
    );
    const [, args] = evalSpy.mock.calls[0]!;
    expect(args).toEqual({ text: 'Submit', exact: true, limit: 5 });
    expect(out).toEqual({ ok: true, matches: [], totalCount: 5 });
  });
});
