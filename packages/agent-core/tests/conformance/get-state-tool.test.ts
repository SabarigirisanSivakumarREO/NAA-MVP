/**
 * AC-04/AC-05 — T024 browser_get_state factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T024; spec.md line 171 (session-based
 *       capture); impact.md MCPToolRegistry safetyClass table (T024 = 'safe');
 *       REQ-MCP-001 + REQ-MCP-002.
 *
 * Stub-only — captureFromSession is mocked to avoid real Playwright.
 * Integration coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  createGetStateTool,
  GetStateInputSchema,
  GetStateOutputSchema,
} from '../../src/mcp/tools/getState.js';
import {
  contextAssembler,
  PageStateModelSchema,
  type PageStateModel,
} from '../../src/perception/index.js';
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
  urlFn: () => string = () => 'https://example.test/',
): BrowserSession {
  return {
    id: 's-1',
    page: { url: urlFn } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  };
}

// Minimal PageStateModelSchema-valid fixture. Includes required
// interactiveGraph (mandatory per schema) + FilteredDOM.top30 (not the
// brief's draft shape — schema is the source of truth).
const fakePsm: PageStateModel = PageStateModelSchema.parse({
  metadata: {
    url: 'https://example.test/',
    title: 'Test',
    statusCode: 200,
    navigationStartedAt: '2026-05-12T00:00:00.000Z',
    navigationEndedAt: '2026-05-12T00:00:01.000Z',
  },
  accessibilityTree: {
    totalNodes: 1,
    root: { role: 'WebArea', name: 'Test' },
  },
  filteredDOM: { top30: [] },
  interactiveGraph: { clickable: [], typeable: [], submittable: [] },
  diagnostics: {
    axNodeCount: 1,
    mutationsObserved: 0,
    stable: true,
    lowAxNodeCount: true,
    unstable: false,
    errors: [],
    warnings: [],
  },
});

describe('T024 browser_get_state factory — AC-04/AC-05', () => {
  it('exposes EXACT v3.1 name and safe classification', () => {
    const tool = createGetStateTool({ session: stubSession() });
    expect(tool.name).toBe('browser_get_state');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema accepts empty + rejects unknown keys (strict)', () => {
    expect(GetStateInputSchema.safeParse({}).success).toBe(true);
    expect(GetStateInputSchema.safeParse({ extra: 1 }).success).toBe(false);
  });

  it('outputSchema is Phase 1 PageStateModelSchema (identity)', () => {
    expect(GetStateOutputSchema).toBe(PageStateModelSchema);
  });

  it('handler delegates to contextAssembler.captureFromSession with the bound session', async () => {
    const spy = vi
      .spyOn(contextAssembler, 'captureFromSession')
      .mockResolvedValue(fakePsm);
    const session = stubSession();
    const tool = createGetStateTool({ session });
    const ctx = stubCtx();
    const out = await tool.handler({}, ctx);
    expect(spy).toHaveBeenCalledWith(session);
    expect(out).toBe(fakePsm);
    expect(ctx.logger.info).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
