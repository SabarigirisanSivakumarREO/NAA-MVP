/**
 * AC-04/AC-05 — T034 browser_upload factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T034; impact.md MCPToolRegistry File
 *       transfer row (safetyClass = 'requires_hitl'); REQ-MCP-001 +
 *       REQ-MCP-002; R8.4 HITL gate.
 *
 * Stub-only — no real Playwright. Integration coverage lands later in Phase 2.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  UploadInputSchema,
  UploadOutputSchema,
  createUploadTool,
} from '../../src/mcp/tools/upload.js';
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
  setInputFiles: (
    sel: string,
    files: string | readonly string[],
    opts?: { timeout?: number },
  ) => Promise<void>,
): BrowserSession {
  return {
    id: 's-1',
    page: {
      setInputFiles,
      url: () => 'https://example.test/',
    } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    },
    close: async () => {},
  };
}

describe('T034 browser_upload factory — AC-04/AC-05 + R8.4 HITL', () => {
  it('exposes EXACT name + requires_hitl classification (R8.4 load-bearing)', () => {
    const tool = createUploadTool({ session: stubSession(async () => {}) });
    expect(tool.name).toBe('browser_upload');
    expect(tool.safetyClass).toBe('requires_hitl');
  });

  it('inputSchema accepts string + non-empty array; rejects empty/missing/unknown', () => {
    expect(
      UploadInputSchema.safeParse({
        selector: 'input[type=file]',
        files: '/tmp/a.pdf',
      }).success,
    ).toBe(true);
    expect(
      UploadInputSchema.safeParse({
        selector: 'input',
        files: ['/a', '/b'],
      }).success,
    ).toBe(true);
    expect(
      UploadInputSchema.safeParse({ selector: 'input', files: '' }).success,
    ).toBe(false);
    expect(
      UploadInputSchema.safeParse({ selector: 'input', files: [] }).success,
    ).toBe(false);
    expect(UploadInputSchema.safeParse({ files: '/a' }).success).toBe(false);
    expect(
      UploadInputSchema.safeParse({
        selector: 'input',
        files: '/a',
        extra: 1,
      }).success,
    ).toBe(false);
  });

  it('outputSchema requires { ok: true, fileCount: positive int }', () => {
    expect(UploadOutputSchema.safeParse({ ok: true, fileCount: 1 }).success).toBe(
      true,
    );
    expect(UploadOutputSchema.safeParse({ ok: true, fileCount: 0 }).success).toBe(
      false,
    );
    expect(UploadOutputSchema.safeParse({ ok: false, fileCount: 1 }).success).toBe(
      false,
    );
  });

  it('handler delegates to setInputFiles with present-only opts; reports fileCount', async () => {
    const sifSpy = vi.fn(async () => {});
    const tool = createUploadTool({ session: stubSession(sifSpy) });
    const out = await tool.handler(
      {
        selector: 'input[type=file]',
        files: ['/tmp/a.pdf', '/tmp/b.pdf'],
        timeout: 10000,
      },
      stubCtx(),
    );
    expect(sifSpy).toHaveBeenCalledWith(
      'input[type=file]',
      ['/tmp/a.pdf', '/tmp/b.pdf'],
      { timeout: 10000 },
    );
    expect(out).toEqual({ ok: true, fileCount: 2 });
  });

  it('handler omits undefined timeout + handles single-string files', async () => {
    const sifSpy = vi.fn(async () => {});
    const tool = createUploadTool({ session: stubSession(sifSpy) });
    const out = await tool.handler(
      { selector: 'input', files: '/tmp/a.pdf' },
      stubCtx(),
    );
    expect(sifSpy).toHaveBeenCalledWith('input', '/tmp/a.pdf', {});
    expect(out).toEqual({ ok: true, fileCount: 1 });
  });
});
