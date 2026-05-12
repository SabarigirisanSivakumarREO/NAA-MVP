/**
 * T039 browser_get_network conformance — AC-04/AC-05 + REQ-MCP-001/REQ-MCP-002.
 *
 * Validates the factory shape (EXACT name + safetyClass='safe'), Zod input
 * boundary (all optional, limit cap 200, since nonneg, unknown rejection),
 * output schema, default limit application, explicit-args forwarding, and
 * exactOptionalPropertyTypes-safe omission of undefined optionals.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  GetNetworkInputSchema,
  GetNetworkOutputSchema,
  createGetNetworkTool,
} from '../../src/mcp/tools/getNetwork.js';
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

describe('T039 browser_get_network factory — AC-04/AC-05', () => {
  it('exposes EXACT name + safe', () => {
    const tool = createGetNetworkTool({
      session: stubSession(async () => ({ entries: [], totalCount: 0 })),
    });
    expect(tool.name).toBe('browser_get_network');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema: all fields optional; limit cap 200; since nonneg; rejects unknown', () => {
    expect(GetNetworkInputSchema.safeParse({}).success).toBe(true);
    expect(
      GetNetworkInputSchema.safeParse({ filterByType: 'xmlhttprequest' }).success,
    ).toBe(true);
    expect(GetNetworkInputSchema.safeParse({ since: 0 }).success).toBe(true);
    expect(GetNetworkInputSchema.safeParse({ since: 1234.5 }).success).toBe(true);
    expect(GetNetworkInputSchema.safeParse({ limit: 1 }).success).toBe(true);
    expect(GetNetworkInputSchema.safeParse({ limit: 200 }).success).toBe(true);
    expect(GetNetworkInputSchema.safeParse({ limit: 201 }).success).toBe(false);
    expect(GetNetworkInputSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(GetNetworkInputSchema.safeParse({ limit: 1.5 }).success).toBe(false);
    expect(GetNetworkInputSchema.safeParse({ since: -1 }).success).toBe(false);
    expect(GetNetworkInputSchema.safeParse({ filterByType: '' }).success).toBe(false);
    expect(GetNetworkInputSchema.safeParse({ extra: 1 }).success).toBe(false);
  });

  it('outputSchema requires entries[] + totalCount nonneg int', () => {
    expect(
      GetNetworkOutputSchema.safeParse({ ok: true, entries: [], totalCount: 0 }).success,
    ).toBe(true);
    expect(
      GetNetworkOutputSchema.safeParse({
        ok: true,
        entries: [
          {
            url: 'https://a/x.js',
            initiatorType: 'script',
            transferSize: 1024,
            duration: 12.5,
            startTime: 100,
          },
        ],
        totalCount: 1,
      }).success,
    ).toBe(true);
    expect(
      GetNetworkOutputSchema.safeParse({ ok: true, entries: [], totalCount: -1 }).success,
    ).toBe(false);
    expect(
      GetNetworkOutputSchema.safeParse({ ok: false, entries: [], totalCount: 0 }).success,
    ).toBe(false);
  });

  it('handler applies default limit=50 + omits undefined filterByType/since', async () => {
    const evalSpy = vi.fn(async () => ({ entries: [], totalCount: 0 }));
    const tool = createGetNetworkTool({ session: stubSession(evalSpy) });
    const out = await tool.handler({}, stubCtx());
    const [, args] = evalSpy.mock.calls[0]!;
    expect(args).toEqual({ limit: 50 });
    expect(args).not.toHaveProperty('filterByType');
    expect(args).not.toHaveProperty('since');
    expect(out).toEqual({ ok: true, entries: [], totalCount: 0 });
  });

  it('handler forwards explicit filterByType + since + limit', async () => {
    const sample = {
      url: 'https://api/x',
      initiatorType: 'xmlhttprequest',
      transferSize: 500,
      duration: 8,
      startTime: 200,
    };
    const evalSpy = vi.fn(async () => ({ entries: [sample], totalCount: 3 }));
    const tool = createGetNetworkTool({ session: stubSession(evalSpy) });
    const out = await tool.handler(
      { filterByType: 'xmlhttprequest', since: 100, limit: 1 },
      stubCtx(),
    );
    const [, args] = evalSpy.mock.calls[0]!;
    expect(args).toEqual({ filterByType: 'xmlhttprequest', since: 100, limit: 1 });
    expect(out).toEqual({ ok: true, entries: [sample], totalCount: 3 });
  });
});
