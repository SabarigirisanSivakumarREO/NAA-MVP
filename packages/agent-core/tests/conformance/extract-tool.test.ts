/**
 * T036 browser_extract conformance — AC-04/AC-05 + REQ-MCP-001/REQ-MCP-002.
 *
 * Validates the factory shape (EXACT name + safetyClass='safe'), Zod input
 * boundary (selector non-empty, mode enum, attribute non-empty, strict
 * unknown-key rejection), output schema, mode default, and explicit-mode
 * forwarding to session.page.evaluate.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  ExtractInputSchema,
  ExtractOutputSchema,
  createExtractTool,
} from '../../src/mcp/tools/extract.js';
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

describe('T036 browser_extract factory — AC-04/AC-05', () => {
  it('exposes EXACT name + safe', () => {
    const tool = createExtractTool({
      session: stubSession(async () => ({ values: [], matchCount: 0 })),
    });
    expect(tool.name).toBe('browser_extract');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema accepts valid shapes + rejects empty/bad enum/empty attribute/unknown', () => {
    expect(ExtractInputSchema.safeParse({ selector: '.title' }).success).toBe(true);
    expect(
      ExtractInputSchema.safeParse({ selector: '.title', mode: 'first' }).success,
    ).toBe(true);
    expect(
      ExtractInputSchema.safeParse({ selector: '.title', mode: 'all' }).success,
    ).toBe(true);
    expect(
      ExtractInputSchema.safeParse({ selector: 'a', attribute: 'href' }).success,
    ).toBe(true);
    expect(ExtractInputSchema.safeParse({ selector: '' }).success).toBe(false);
    expect(
      ExtractInputSchema.safeParse({ selector: 'a', mode: 'last' }).success,
    ).toBe(false);
    expect(
      ExtractInputSchema.safeParse({ selector: 'a', attribute: '' }).success,
    ).toBe(false);
    expect(
      ExtractInputSchema.safeParse({ selector: 'a', extra: 1 }).success,
    ).toBe(false);
  });

  it('outputSchema requires { ok: true, values: string[], matchCount: nonneg int }', () => {
    expect(
      ExtractOutputSchema.safeParse({ ok: true, values: [], matchCount: 0 }).success,
    ).toBe(true);
    expect(
      ExtractOutputSchema.safeParse({
        ok: true,
        values: ['a', 'b'],
        matchCount: 2,
      }).success,
    ).toBe(true);
    expect(
      ExtractOutputSchema.safeParse({
        ok: true,
        values: ['a'],
        matchCount: -1,
      }).success,
    ).toBe(false);
    expect(
      ExtractOutputSchema.safeParse({ ok: false, values: [], matchCount: 0 }).success,
    ).toBe(false);
  });

  it('handler defaults mode to "first" + forwards selector + omits undefined attribute', async () => {
    const evalSpy = vi.fn(async () => ({ values: ['Title'], matchCount: 1 }));
    const tool = createExtractTool({ session: stubSession(evalSpy) });
    const out = await tool.handler({ selector: '.title' }, stubCtx());
    const [, args] = evalSpy.mock.calls[0]!;
    expect(args).toEqual({ selector: '.title', mode: 'first' });
    expect(args).not.toHaveProperty('attribute');
    expect(out).toEqual({ ok: true, values: ['Title'], matchCount: 1 });
  });

  it('handler forwards explicit mode + attribute', async () => {
    const evalSpy = vi.fn(async () => ({
      values: ['https://a', 'https://b'],
      matchCount: 2,
    }));
    const tool = createExtractTool({ session: stubSession(evalSpy) });
    const out = await tool.handler(
      { selector: 'a', mode: 'all', attribute: 'href' },
      stubCtx(),
    );
    const [, args] = evalSpy.mock.calls[0]!;
    expect(args).toEqual({ selector: 'a', mode: 'all', attribute: 'href' });
    expect(out).toEqual({
      ok: true,
      values: ['https://a', 'https://b'],
      matchCount: 2,
    });
  });
});
