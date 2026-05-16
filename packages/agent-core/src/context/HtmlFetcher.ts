/**
 * Phase 4b T4B-003 — HtmlFetcher: cheap single-GET HTML fetch for the
 * Context Capture Layer (REQ-CONTEXT-FLOW-001 + REQ-SAFETY-005).
 *
 * Canonical sources:
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.3
 *     REQ-CONTEXT-FLOW-001 (single GET, undici/built-in fetch, realistic UA,
 *     5s timeout, robots.txt respected, ETag cache, graceful degrade)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-03 + R-05
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-003 (L101-107)
 *   docs/specs/mvp/phases/phase-4b-context-capture/impact.md §3a entry
 *     "RobotsChecker (REQ-SAFETY-005) → T4B-003 HtmlFetcher: MUST call
 *      RobotsChecker.isAllowed() BEFORE any HTTP GET; halt fetch + degrade
 *      to URL-only on disallow"
 *
 * # Contract (AC-03)
 *
 * `fetch(url, opts)` returns
 *   { html, statusCode, finalUrl, warnings[] }
 *
 *   - Calls `RobotsChecker.isAllowed(url, userAgent, auditRunId)` FIRST.
 *     If `allowed === false` → throw `RobotsDisallowedError` (caller
 *     degrades to URL-only inference + emits CONTEXT_ROBOTS_DISALLOW).
 *   - Single GET via Node 22 built-in `fetch` (powered by undici under the
 *     hood). 5s timeout via AbortController. `redirect: 'follow'` lets
 *     the runtime walk up to ~20 redirect hops; `response.url` surfaces
 *     the resolved `finalUrl`.
 *   - 4xx → throw `HtmlFetchError({ code: 'HTTP_4XX' })`; no retry.
 *   - 5xx → throw `HtmlFetchError({ code: 'HTTP_5XX' })` after one bounded
 *     retry with 250ms backoff (kept conservative — R25 forbids elaborate
 *     fetch infrastructure; Phase 4b is the lightweight pre-perception layer).
 *   - AbortError / network / TLS errors → `HtmlFetchError({ code: 'TIMEOUT' | 'NETWORK' })`.
 *   - Warnings emitted (non-throwing):
 *       * `CONTEXT_HTML_TOO_SHORT` when body < 1024 bytes (likely SPA shell;
 *         spec.md §Edge Cases)
 *       * `LARGE_RESPONSE` when body > 5 MiB (operational signal)
 *       * `SLOW_RESPONSE` when wall time > 3s (operational signal)
 *   - ETag cache: in-memory `Map<url, { etag, html, statusCode, finalUrl }>`.
 *     Subsequent fetches of the same URL within the same process send
 *     `If-None-Match: <etag>`; a 304 response replays the cached body
 *     without re-downloading (idempotency / cost discipline).
 *
 * # R25 compliance (hard constraint)
 *
 * ZERO `playwright` / `@playwright/*` imports in this file or anywhere
 * under `packages/agent-core/src/context/*`. AC-14 (`R25.test.ts`) AST-
 * scans this directory; a single Playwright import is a constitutional
 * violation. The fetcher uses ONLY Node 22 built-in `fetch` (undici-backed)
 * + the standard library — no HTML parsing here (cheerio is consumed
 * downstream by T4B-004 JsonLdParser).
 *
 * # Cross-phase consumed contract (R20 closure)
 *
 * RobotsChecker — Phase 4 task T080a — REQ-SAFETY-005. Verified via the
 * `RobotsCheckerLike` structural interface so this file does not pull the
 * concrete dependency (DI seam keeps the conformance test stub trivial).
 *
 * R10.1: file ≤ 250 LOC. R10.3: named exports, no `any`. R10.4: Zod
 * unused here — return type is structural and consumed by the caller's
 * own ContextProfile/Provenance Zod paths.
 */
import { createLogger, type Logger } from '../observability/logger.js';

const log = createLogger('html-fetcher');

/** Default user agent. Honest, non-spoofing — REQ-SAFETY-005 + REQ-SAFETY-007. */
export const DEFAULT_USER_AGENT = 'NeuralAgent/1.0 (+https://reodigital.com/neural)';

/** Default request timeout (REQ-CONTEXT-FLOW-001: 5s). */
const DEFAULT_TIMEOUT_MS = 5_000;

/** Wall-time threshold above which `SLOW_RESPONSE` is emitted. */
const SLOW_RESPONSE_MS = 3_000;

/** Body-size thresholds for warnings (bytes). */
const SHORT_HTML_BYTES = 1_024;
const LARGE_RESPONSE_BYTES = 5 * 1_024 * 1_024;

/** Single bounded retry on 5xx — keeps the fetcher cheap (R10 cost discipline). */
const RETRY_BACKOFF_MS = 250;

/**
 * Structural shape of RobotsChecker we depend on. Matches the concrete
 * class in `src/safety/RobotsChecker.ts` (REQ-SAFETY-005). Using a
 * structural interface avoids a hard import + keeps the DI seam clean
 * for the conformance test.
 */
export interface RobotsCheckerLike {
  isAllowed(
    url: string,
    userAgent: string,
    auditRunId: string,
  ): Promise<{ allowed: boolean; warning_code?: string; matched_directive?: string }>;
}

/** Minimal `fetch`-compatible signature for DI in tests. */
export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; signal: AbortSignal; redirect: 'follow' },
) => Promise<{
  status: number;
  url: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface HtmlFetchOptions {
  auditRunId: string;
  clientId: string;
  /** Override default UA per-call (e.g. integration-test fixtures). */
  userAgent?: string;
  /** Override default timeout per-call. */
  timeoutMs?: number;
}

export interface HtmlFetchResult {
  html: string;
  statusCode: number;
  finalUrl: string;
  warnings: string[];
}

export interface HtmlFetcherDeps {
  robotsChecker?: RobotsCheckerLike;
  fetch?: FetchLike;
  logger?: Logger;
  userAgent?: string;
}

export class RobotsDisallowedError extends Error {
  readonly code = 'CONTEXT_ROBOTS_DISALLOW';
  readonly matchedDirective: string | undefined;
  constructor(url: string, matchedDirective?: string) {
    super(`html-fetcher: robots.txt disallows ${url}${matchedDirective ? ` (${matchedDirective})` : ''}`);
    this.name = 'RobotsDisallowedError';
    this.matchedDirective = matchedDirective;
  }
}

export type HtmlFetchErrorCode = 'HTTP_4XX' | 'HTTP_5XX' | 'TIMEOUT' | 'NETWORK';

export class HtmlFetchError extends Error {
  readonly code: HtmlFetchErrorCode;
  readonly statusCode: number | undefined;
  constructor(message: string, code: HtmlFetchErrorCode, statusCode?: number) {
    super(message);
    this.name = 'HtmlFetchError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface EtagCacheEntry {
  readonly etag: string;
  readonly html: string;
  readonly statusCode: number;
  readonly finalUrl: string;
}

export class HtmlFetcher {
  readonly #robotsChecker: RobotsCheckerLike | undefined;
  readonly #fetch: FetchLike;
  readonly #logger: Logger;
  readonly #userAgent: string;
  readonly #etagCache = new Map<string, EtagCacheEntry>();

  constructor(deps: HtmlFetcherDeps = {}) {
    this.#robotsChecker = deps.robotsChecker;
    // Cast through unknown so the global fetch (lib.dom) maps onto our
    // narrow FetchLike contract without dragging the entire DOM types in.
    this.#fetch = deps.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.#logger = deps.logger ?? log;
    this.#userAgent = deps.userAgent ?? DEFAULT_USER_AGENT;
  }

  async fetch(url: string, opts: HtmlFetchOptions): Promise<HtmlFetchResult> {
    const userAgent = opts.userAgent ?? this.#userAgent;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const domain = safeHost(url);
    const child = this.#logger.child({
      audit_run_id: opts.auditRunId,
      client_id: opts.clientId,
      domain,
    });

    // Step 1 — robots.txt gate BEFORE any HTTP IO. R23 STOP / R7 honesty:
    // a single fetch fired ahead of this check is a kill criterion.
    if (this.#robotsChecker !== undefined) {
      const verdict = await this.#robotsChecker.isAllowed(url, userAgent, opts.auditRunId);
      if (!verdict.allowed) {
        child.info({ warning_code: verdict.warning_code }, 'html-fetcher: robots.txt disallows; degrading to URL-only');
        throw new RobotsDisallowedError(url, verdict.matched_directive);
      }
    }

    // Step 2 — cache lookup. Conditional GET on a known ETag.
    const cached = this.#etagCache.get(url);
    const warnings: string[] = [];

    const started = Date.now();
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.#fetchWithRetry(url, userAgent, timeoutMs, cached?.etag);
    } catch (err) {
      throw normalizeNetworkError(err);
    }
    const elapsedMs = Date.now() - started;

    // 304 → replay cached body.
    if (response.status === 304 && cached !== undefined) {
      if (elapsedMs > SLOW_RESPONSE_MS) warnings.push('SLOW_RESPONSE');
      child.info({ status: 304, elapsed_ms: elapsedMs }, 'html-fetcher: 304 not modified — cache hit');
      return { html: cached.html, statusCode: cached.statusCode, finalUrl: cached.finalUrl, warnings };
    }

    if (response.status >= 400 && response.status < 500) {
      throw new HtmlFetchError(`html-fetcher: ${response.status} on ${url}`, 'HTTP_4XX', response.status);
    }
    if (response.status >= 500) {
      throw new HtmlFetchError(`html-fetcher: ${response.status} on ${url}`, 'HTTP_5XX', response.status);
    }

    const html = await response.text();
    const byteLen = Buffer.byteLength(html, 'utf8');
    if (byteLen < SHORT_HTML_BYTES) warnings.push('CONTEXT_HTML_TOO_SHORT');
    if (byteLen > LARGE_RESPONSE_BYTES) warnings.push('LARGE_RESPONSE');
    if (elapsedMs > SLOW_RESPONSE_MS) warnings.push('SLOW_RESPONSE');

    const etag = response.headers.get('etag');
    if (etag !== null && etag !== '') {
      this.#etagCache.set(url, { etag, html, statusCode: response.status, finalUrl: response.url });
    }

    child.info(
      { status: response.status, elapsed_ms: elapsedMs, byte_len: byteLen, final_url: response.url },
      'html-fetcher: ok',
    );

    return { html, statusCode: response.status, finalUrl: response.url, warnings };
  }

  /** Clear the per-URL ETag cache (test isolation; not part of public contract). */
  clearCache(): void {
    this.#etagCache.clear();
  }

  async #fetchWithRetry(
    url: string,
    userAgent: string,
    timeoutMs: number,
    etag: string | undefined,
  ): Promise<Awaited<ReturnType<FetchLike>>> {
    const attempt = (): Promise<Awaited<ReturnType<FetchLike>>> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const headers: Record<string, string> = {
        'user-agent': userAgent,
        accept: 'text/html,application/xhtml+xml',
      };
      if (etag !== undefined) headers['if-none-match'] = etag;
      return this.#fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      }).finally(() => clearTimeout(timer));
    };

    const first = await attempt();
    if (first.status < 500) return first;
    // Single bounded retry on 5xx — Phase 4b cost discipline (R10) keeps
    // this conservative; integration tests verify single-GET on the happy path.
    await delay(RETRY_BACKOFF_MS);
    return attempt();
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeNetworkError(err: unknown): HtmlFetchError {
  const message = err instanceof Error ? err.message : String(err);
  const isAbort =
    (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) ||
    /aborted|timed?\s*out/i.test(message);
  if (isAbort) return new HtmlFetchError(`html-fetcher: request timed out — ${message}`, 'TIMEOUT');
  return new HtmlFetchError(`html-fetcher: network failure — ${message}`, 'NETWORK');
}
