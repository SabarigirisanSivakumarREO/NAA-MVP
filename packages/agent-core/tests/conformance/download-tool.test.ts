/**
 * AC-04/AC-05 — T037 browser_download factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T037; impact.md MCPToolRegistry File
 *       transfer row (safetyClass = 'requires_hitl'); REQ-MCP-001 +
 *       REQ-MCP-002; R8.4 HITL gate.
 *
 * Stub-only — no real Playwright. Critical assertion: listener-before-
 * trigger ORDER (page.waitForEvent('download') registered BEFORE
 * page.evaluate click). Integration coverage lands later in Phase 2.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  DownloadInputSchema,
  DownloadOutputSchema,
  DownloadSaveDirNotAbsoluteError,
  createDownloadTool,
} from '../../src/mcp/tools/download.js';
import type {
  BrowserDownload,
  BrowserSession,
} from '../../src/adapters/BrowserEngine.js';
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
  waitForEvent: (
    event: 'download',
    opts?: { timeout?: number },
  ) => Promise<BrowserDownload>,
  evaluate: (fn: string, ...args: unknown[]) => Promise<void>,
): BrowserSession {
  return {
    id: 's-1',
    page: {
      waitForEvent,
      evaluate,
      url: () => 'https://example.test/',
    } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  } as unknown as BrowserSession;
}

function mkDownload(
  saveAsSpy: (p: string) => Promise<void>,
  filename = 'report.pdf',
): BrowserDownload {
  return {
    suggestedFilename: () => filename,
    saveAs: saveAsSpy,
  };
}

describe('T037 browser_download factory — AC-04/AC-05 + R8.4 HITL', () => {
  it('exposes EXACT name + requires_hitl classification (R8.4 load-bearing)', () => {
    const tool = createDownloadTool({
      session: stubSession(
        async () => mkDownload(async () => {}),
        async () => {},
      ),
    });
    expect(tool.name).toBe('browser_download');
    expect(tool.safetyClass).toBe('requires_hitl');
  });

  it('inputSchema requires triggerSelector + saveDir; rejects empty/missing/unknown', () => {
    expect(
      DownloadInputSchema.safeParse({ triggerSelector: 'a.dl', saveDir: '/tmp' })
        .success,
    ).toBe(true);
    expect(
      DownloadInputSchema.safeParse({ triggerSelector: '', saveDir: '/tmp' })
        .success,
    ).toBe(false);
    expect(
      DownloadInputSchema.safeParse({ triggerSelector: 'a', saveDir: '' }).success,
    ).toBe(false);
    expect(DownloadInputSchema.safeParse({ saveDir: '/tmp' }).success).toBe(false);
    expect(
      DownloadInputSchema.safeParse({
        triggerSelector: 'a',
        saveDir: '/tmp',
        extra: 1,
      }).success,
    ).toBe(false);
  });

  it('outputSchema requires { ok: true, filename, path }', () => {
    expect(
      DownloadOutputSchema.safeParse({
        ok: true,
        filename: 'a.pdf',
        path: '/tmp/a.pdf',
      }).success,
    ).toBe(true);
    expect(
      DownloadOutputSchema.safeParse({ ok: false, filename: 'a', path: 'p' })
        .success,
    ).toBe(false);
    expect(
      DownloadOutputSchema.safeParse({ ok: true, filename: 'a' }).success,
    ).toBe(false);
  });

  it('handler throws DownloadSaveDirNotAbsoluteError on relative saveDir', async () => {
    const tool = createDownloadTool({
      session: stubSession(
        async () => mkDownload(async () => {}),
        async () => {},
      ),
    });
    await expect(
      tool.handler(
        { triggerSelector: 'a.dl', saveDir: 'relative/path' },
        stubCtx(),
      ),
    ).rejects.toBeInstanceOf(DownloadSaveDirNotAbsoluteError);
  });

  it('handler registers waitForEvent BEFORE evaluate (call order matters)', async () => {
    const order: string[] = [];
    const saveAsSpy = vi.fn(async () => {});
    const waitForEventSpy = vi.fn(async () => {
      order.push('waitForEvent');
      return mkDownload(saveAsSpy);
    });
    const evaluateSpy = vi.fn(async () => {
      order.push('evaluate');
    });
    const tool = createDownloadTool({
      session: stubSession(waitForEventSpy, evaluateSpy),
    });

    const absDir = process.platform === 'win32' ? 'C:\\tmp' : '/tmp';
    const out = await tool.handler(
      { triggerSelector: 'a.dl', saveDir: absDir, timeout: 30000 },
      stubCtx(),
    );

    expect(order).toEqual(['waitForEvent', 'evaluate']);
    expect(waitForEventSpy).toHaveBeenCalledWith('download', { timeout: 30000 });
    expect(saveAsSpy).toHaveBeenCalledWith(expect.stringContaining('report.pdf'));
    expect(out).toMatchObject({ ok: true, filename: 'report.pdf' });
    expect(out.path).toContain('report.pdf');
  });

  it('handler omits undefined timeout (exactOptionalPropertyTypes-safe)', async () => {
    const waitSpy = vi.fn(async () => mkDownload(async () => {}));
    const tool = createDownloadTool({
      session: stubSession(waitSpy, async () => {}),
    });
    const absDir = process.platform === 'win32' ? 'C:\\tmp' : '/tmp';
    await tool.handler(
      { triggerSelector: 'a.dl', saveDir: absDir },
      stubCtx(),
    );
    expect(waitSpy).toHaveBeenCalledWith('download', {});
  });
});
