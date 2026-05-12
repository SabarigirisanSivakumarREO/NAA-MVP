/**
 * AC-04/AC-05 — T026 browser_get_metadata factory + handler conformance.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  createGetMetadataTool,
  GetMetadataInputSchema,
  GetMetadataOutputSchema,
} from '../../src/mcp/tools/getMetadata.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import type { ToolContext } from '../../src/mcp/types.js';

function stubLogger(): Logger {
  const fn = vi.fn();
  return { info: fn, warn: fn, error: fn, debug: fn, child: vi.fn() } as unknown as Logger;
}
function stubCtx(): { ctx: ToolContext; logger: Logger } {
  const logger = stubLogger();
  return { ctx: { logger, toolCallId: 't-1', clientSessionId: 'c-1' }, logger };
}
function stubSession(opts: {
  url?: string;
  evaluate?: (fn: string) => Promise<unknown>;
}): BrowserSession {
  return {
    id: 's-1',
    page: {
      url: () => opts.url ?? 'https://example.test/',
      evaluate: opts.evaluate ?? (async () => 'fixture title'),
    } as unknown as BrowserSession['page'],
    context: { addInitScript: async () => {}, pages: () => [] },
    close: async () => {},
  };
}

describe('T026 browser_get_metadata factory — AC-04/AC-05', () => {
  it('exposes EXACT v3.1 name and safe classification', () => {
    const tool = createGetMetadataTool({ session: stubSession({}) });
    expect(tool.name).toBe('browser_get_metadata');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema accepts empty + rejects unknown keys (strict)', () => {
    expect(GetMetadataInputSchema.safeParse({}).success).toBe(true);
    expect(GetMetadataInputSchema.safeParse({ k: 1 }).success).toBe(false);
  });

  it('outputSchema requires url + title strings; rejects missing or extra keys', () => {
    expect(GetMetadataOutputSchema.safeParse({ url: 'about:blank', title: '' }).success).toBe(true);
    expect(GetMetadataOutputSchema.safeParse({ url: 'about:blank' }).success).toBe(false);
    expect(GetMetadataOutputSchema.safeParse({ url: 'a', title: 't', extra: true }).success).toBe(false);
  });

  it('handler reads url + title from the bound session', async () => {
    const evalSpy = vi.fn(async () => 'My Page');
    const tool = createGetMetadataTool({
      session: stubSession({ url: 'https://amazon.in/', evaluate: evalSpy }),
    });
    const out = await tool.handler({}, stubCtx().ctx);
    expect(out).toEqual({ url: 'https://amazon.in/', title: 'My Page' });
    expect(evalSpy).toHaveBeenCalled();
  });

  it('handler gracefully degrades when page.evaluate throws (returns empty title + warns)', async () => {
    const { ctx, logger } = stubCtx();
    const evalSpy = vi.fn(async () => {
      throw new Error('evaluate failed');
    });
    const tool = createGetMetadataTool({
      session: stubSession({ url: 'https://amazon.in/', evaluate: evalSpy }),
    });
    const out = await tool.handler({}, ctx);
    expect(out).toEqual({ url: 'https://amazon.in/', title: '' });
    expect(logger.warn).toHaveBeenCalled();
  });
});
