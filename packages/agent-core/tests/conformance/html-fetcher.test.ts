/**
 * AC-03 — HtmlFetcher conformance (Phase 4b T4B-003).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-03 + R-05
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-003 (L101-107)
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.3
 *     REQ-CONTEXT-FLOW-001 + REQ-SAFETY-005
 *   docs/specs/mvp/phases/phase-4b-context-capture/impact.md §3a entry
 *     (RobotsChecker MUST be called BEFORE any GET)
 *
 * AC-03 scope (this file):
 *   1. RobotsChecker.isAllowed() called BEFORE any fetch (R23 kill criterion)
 *   2. robots disallow → RobotsDisallowedError; no fetch invocation
 *   3. happy-path returns { html, statusCode, finalUrl, warnings }
 *   4. realistic UA sent (no crawler spoofing)
 *   5. 5s timeout → TIMEOUT HtmlFetchError
 *   6. 4xx → HTTP_4XX HtmlFetchError; no retry
 *   7. 5xx → HTTP_5XX HtmlFetchError after one retry
 *   8. ETag cache: second fetch sends If-None-Match; 304 replays body
 *   9. `CONTEXT_HTML_TOO_SHORT` warning when body < 1KB
 *  10. R25 — file contains no `playwright` import (grep guard)
 *
 * Anchor: @AC-03 — HtmlFetcher robots-gated single-GET with ETag cache.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  HtmlFetcher,
  HtmlFetchError,
  RobotsDisallowedError,
  DEFAULT_USER_AGENT,
  type FetchLike,
  type RobotsCheckerLike,
} from '../../src/context/HtmlFetcher.js';

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000B03';
const CLIENT_ID = '00000000-0000-4000-8000-000000000B04';

function allowingRobots(): RobotsCheckerLike & { isAllowed: ReturnType<typeof vi.fn> } {
  return { isAllowed: vi.fn(async () => ({ allowed: true })) };
}

function disallowingRobots(): RobotsCheckerLike & { isAllowed: ReturnType<typeof vi.fn> } {
  return {
    isAllowed: vi.fn(async () => ({
      allowed: false,
      warning_code: 'ROBOTS_TXT_DISALLOWED',
      matched_directive: 'Disallow: /',
    })),
  };
}

interface StubResponse {
  status: number;
  url: string;
  body: string;
  etag?: string;
}

function stubFetch(
  responses: StubResponse[],
): { fetch: FetchLike; calls: Array<{ url: string; headers: Record<string, string> }> } {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  let i = 0;
  const fetch: FetchLike = async (input, init) => {
    calls.push({ url: input, headers: init.headers });
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (r === undefined) throw new Error('stubFetch: response queue exhausted');
    return {
      status: r.status,
      url: r.url,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'etag' ? (r.etag ?? null) : null),
      },
      text: async () => r.body,
    };
  };
  return { fetch, calls };
}

describe('HtmlFetcher — AC-03 conformance (Phase 4b T4B-003)', () => {
  it('AC-03 calls RobotsChecker.isAllowed BEFORE any HTTP fetch (R23 kill criterion)', async () => {
    const order: string[] = [];
    const robots: RobotsCheckerLike = {
      isAllowed: vi.fn(async () => {
        order.push('robots');
        return { allowed: true };
      }),
    };
    const fetch: FetchLike = vi.fn(async () => {
      order.push('fetch');
      return {
        status: 200,
        url: 'https://example.com/',
        headers: { get: () => null },
        text: async () => '<!doctype html><html><body>x</body></html>'.padEnd(2048, ' '),
      };
    });
    const fetcher = new HtmlFetcher({ robotsChecker: robots, fetch });
    await fetcher.fetch('https://example.com/', { auditRunId: AUDIT_RUN_ID, clientId: CLIENT_ID });
    expect(order).toEqual(['robots', 'fetch']);
  });

  it('AC-03 robots disallow → RobotsDisallowedError; fetch NEVER invoked', async () => {
    const robots = disallowingRobots();
    const fetchSpy = vi.fn();
    const fetcher = new HtmlFetcher({ robotsChecker: robots, fetch: fetchSpy as unknown as FetchLike });
    await expect(
      fetcher.fetch('https://blocked.example/', { auditRunId: AUDIT_RUN_ID, clientId: CLIENT_ID }),
    ).rejects.toBeInstanceOf(RobotsDisallowedError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('AC-03 happy path returns { html, statusCode, finalUrl, warnings }', async () => {
    const robots = allowingRobots();
    const body = '<!doctype html><html><body>hello world</body></html>'.padEnd(2048, ' ');
    const { fetch } = stubFetch([{ status: 200, url: 'https://example.com/final', body }]);
    const fetcher = new HtmlFetcher({ robotsChecker: robots, fetch });
    const r = await fetcher.fetch('https://example.com/', { auditRunId: AUDIT_RUN_ID, clientId: CLIENT_ID });
    expect(r.statusCode).toBe(200);
    expect(r.finalUrl).toBe('https://example.com/final');
    expect(r.html).toContain('hello world');
    expect(r.warnings).toEqual([]);
  });

  it('AC-03 sends a realistic, non-spoofing User-Agent', async () => {
    const robots = allowingRobots();
    const body = '<html><body>x</body></html>'.padEnd(2048, ' ');
    const { fetch, calls } = stubFetch([{ status: 200, url: 'https://example.com/', body }]);
    const fetcher = new HtmlFetcher({ robotsChecker: robots, fetch });
    await fetcher.fetch('https://example.com/', { auditRunId: AUDIT_RUN_ID, clientId: CLIENT_ID });
    const ua = calls[0]?.headers['user-agent'] ?? '';
    expect(ua).toBe(DEFAULT_USER_AGENT);
    // R7 + REQ-SAFETY-007 — never claim to be a search-engine crawler.
    expect(ua.toLowerCase()).not.toMatch(/googlebot|bingbot|yandexbot|baiduspider/);
  });

  it('AC-03 5s timeout → TIMEOUT HtmlFetchError', async () => {
    const robots = allowingRobots();
    const fetch: FetchLike = async (_input, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('The operation was aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    const fetcher = new HtmlFetcher({ robotsChecker: robots, fetch });
    await expect(
      fetcher.fetch('https://slow.example/', {
        auditRunId: AUDIT_RUN_ID,
        clientId: CLIENT_ID,
        timeoutMs: 20,
      }),
    ).rejects.toMatchObject({ name: 'HtmlFetchError', code: 'TIMEOUT' });
  });

  it('AC-03 4xx → HTTP_4XX HtmlFetchError with statusCode; NO retry', async () => {
    const robots = allowingRobots();
    const { fetch, calls } = stubFetch([{ status: 404, url: 'https://example.com/missing', body: '' }]);
    const fetcher = new HtmlFetcher({ robotsChecker: robots, fetch });
    await expect(
      fetcher.fetch('https://example.com/missing', { auditRunId: AUDIT_RUN_ID, clientId: CLIENT_ID }),
    ).rejects.toMatchObject({ name: 'HtmlFetchError', code: 'HTTP_4XX', statusCode: 404 });
    expect(calls.length).toBe(1);
  });

  it('AC-03 5xx → one bounded retry, then HTTP_5XX HtmlFetchError', async () => {
    const robots = allowingRobots();
    const { fetch, calls } = stubFetch([
      { status: 503, url: 'https://example.com/', body: '' },
      { status: 503, url: 'https://example.com/', body: '' },
    ]);
    const fetcher = new HtmlFetcher({ robotsChecker: robots, fetch });
    await expect(
      fetcher.fetch('https://example.com/', { auditRunId: AUDIT_RUN_ID, clientId: CLIENT_ID }),
    ).rejects.toMatchObject({ name: 'HtmlFetchError', code: 'HTTP_5XX', statusCode: 503 });
    expect(calls.length).toBe(2);
  });

  it('AC-03 ETag cache: second fetch sends If-None-Match; 304 replays body', async () => {
    const robots = allowingRobots();
    const body = '<html><body>cached</body></html>'.padEnd(2048, ' ');
    const { fetch, calls } = stubFetch([
      { status: 200, url: 'https://example.com/', body, etag: 'W/"deadbeef"' },
      { status: 304, url: 'https://example.com/', body: '' },
    ]);
    const fetcher = new HtmlFetcher({ robotsChecker: robots, fetch });
    const r1 = await fetcher.fetch('https://example.com/', { auditRunId: AUDIT_RUN_ID, clientId: CLIENT_ID });
    const r2 = await fetcher.fetch('https://example.com/', { auditRunId: AUDIT_RUN_ID, clientId: CLIENT_ID });
    expect(r1.html).toContain('cached');
    expect(r2.html).toContain('cached');
    expect(r2.statusCode).toBe(200);
    expect(calls[1]?.headers['if-none-match']).toBe('W/"deadbeef"');
  });

  it('AC-03 emits CONTEXT_HTML_TOO_SHORT when body < 1KB', async () => {
    const robots = allowingRobots();
    const { fetch } = stubFetch([{ status: 200, url: 'https://spa.example/', body: '<html></html>' }]);
    const fetcher = new HtmlFetcher({ robotsChecker: robots, fetch });
    const r = await fetcher.fetch('https://spa.example/', { auditRunId: AUDIT_RUN_ID, clientId: CLIENT_ID });
    expect(r.warnings).toContain('CONTEXT_HTML_TOO_SHORT');
  });

  it('AC-03 R25 — HtmlFetcher.ts contains zero `playwright` imports', () => {
    const sutPath = fileURLToPath(new URL('../../src/context/HtmlFetcher.ts', import.meta.url));
    const source = readFileSync(sutPath, 'utf8');
    // AST-equivalent grep over import statements only — comments/docstrings allowed
    // to reference R25 / playwright explicitly (this file's docstring does).
    const importLines = source
      .split(/\r?\n/)
      .filter((l) => /^\s*import\s/.test(l) || /^\s*from\s+['"]/.test(l));
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toMatch(/['"]playwright['"]|['"]@playwright\//);
    }
  });
});
