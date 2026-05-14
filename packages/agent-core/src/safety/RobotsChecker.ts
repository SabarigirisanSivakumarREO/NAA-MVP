/**
 * Phase 4 T080a — RobotsChecker: robots.txt + ai-agent.txt compliance utility.
 *
 * Source: phases/phase-4-safety-infra-cost/spec.md AC-16 + R-16 (v0.4);
 *         phases/phase-4-safety-infra-cost/tasks.md T080a
 *         (REQ-SAFETY-005 + REQ-SAFETY-007 + REQ-RATE-003);
 *         docs/specs/final-architecture/11-safety-cost.md §11.1.1; RFC 9309.
 *
 * Contract (AC-16) — `isAllowed(url, userAgent, auditRunId)` returns
 *   - `{ allowed: true }` when no Disallow rule matches the path
 *   - `{ allowed: false, warning_code: 'ROBOTS_TXT_DISALLOWED', matched_directive }`
 *   - **Throws** when `userAgent` impersonates a search-engine crawler
 *     (REQ-SAFETY-007). UA spoofing is REJECTED BEFORE any network fetch —
 *     per-task R23 STOP: R7 honest-output guarantee fails if we ever claim
 *     to be Googlebot et al.
 *
 * Cache (v0.4 — spec.md L212; F-08): `Map<auditRunId, Map<hostRoot, Parsed>>`
 * populated lazily per `(auditRunId, hostRoot)`. TTL = audit lifetime;
 * `cleanup(auditRunId)` is wired by SessionRecorder.recordEvent('audit_completed').
 * Single-process cache; multi-process workers fetch independently (per spec).
 *
 * Failure modes (REQ-SAFETY-005 + REQ-RATE-003): fetcher is responsible for
 * the `<root>/ai-agent.txt` fallback when robots.txt 404s; `null` here means
 * "no policy known" → degrade open. Fetcher throws → degrade open + emit
 * `ROBOTS_TXT_FETCH_FAILED` info-severity log; NO retry (tasks.md L330).
 *
 * Parsing — RFC 9309 subset: `User-agent:` + `Disallow:` only; prefix match
 * per §2.2.2. `Allow:` overrides and `*`/`$` wildcards are v1.1 scope (R11).
 *
 * R10.1: file ≤ 200 lines (tasks.md L330). R10.3: named exports, no `any`.
 */
import { createLogger, type Logger } from '../observability/logger.js';

const log = createLogger('robots-checker');

/** UA spoof blocklist (REQ-SAFETY-007) — case-insensitive substring match. */
const UA_SPOOF_BLOCKLIST = [
  'googlebot', 'bingbot', 'duckduckbot', 'yandexbot', 'baiduspider', 'facebookexternalhit',
] as const;

/** Result of `isAllowed()`. Diagnostic fields populated only when `allowed === false`. */
export interface RobotsCheckResult {
  allowed: boolean;
  matched_directive?: string;
  warning_code?: 'ROBOTS_TXT_DISALLOWED' | 'ROBOTS_TXT_FETCH_FAILED';
}

/**
 * Injection seam for tests + Phase 4b/5 wiring. Fetches `<rootUrl>/robots.txt`
 * (and is responsible for the ai-agent.txt fallback if robots.txt is 404 per
 * REQ-RATE-003). Returns `null` to signal "no policy" (degrade open).
 */
export interface RobotsTxtFetcher {
  fetchRobotsTxt(rootUrl: string): Promise<string | null>;
}

interface ParsedRobotsTxt {
  disallowedPaths: readonly string[];
}

export class RobotsChecker {
  readonly #fetcher: RobotsTxtFetcher;
  readonly #logger: Logger;
  readonly #cache = new Map<string, Map<string, ParsedRobotsTxt>>();

  constructor(fetcher: RobotsTxtFetcher, logger: Logger = log) {
    this.#fetcher = fetcher;
    this.#logger = logger;
  }

  async isAllowed(
    url: string,
    userAgent: string,
    auditRunId: string,
  ): Promise<RobotsCheckResult> {
    // Step 1: reject UA spoofing BEFORE any network IO (R23 STOP — verified by
    // AC-16 cache-call-count assertion that fetchRobotsTxt is never called on
    // spoofed UAs).
    this.#assertNotSpoofing(userAgent);

    const parsed = new URL(url);
    const hostRoot = `${parsed.protocol}//${parsed.host}`;
    const path = parsed.pathname || '/';

    const robots = await this.#getOrFetch(auditRunId, hostRoot, userAgent);
    if (robots === null) return { allowed: true };

    // RFC 9309 §2.2.2 prefix match.
    for (const directive of robots.disallowedPaths) {
      if (path.startsWith(directive)) {
        this.#logger.info(
          { domain: parsed.host, audit_run_id: auditRunId },
          `robots-checker: disallowed path matched directive ${directive}`,
        );
        return {
          allowed: false,
          warning_code: 'ROBOTS_TXT_DISALLOWED',
          matched_directive: `Disallow: ${directive}`,
        };
      }
    }
    return { allowed: true };
  }

  /** Drop per-audit cache. Wired to SessionRecorder.recordEvent('audit_completed'). */
  cleanup(auditRunId: string): void {
    this.#cache.delete(auditRunId);
  }

  #assertNotSpoofing(userAgent: string): void {
    const ua = userAgent.toLowerCase();
    for (const bot of UA_SPOOF_BLOCKLIST) {
      if (ua.includes(bot)) {
        throw new Error(
          `robots-checker: refusing to spoof search-engine crawler '${bot}' (REQ-SAFETY-007)`,
        );
      }
    }
  }

  async #getOrFetch(
    auditRunId: string,
    hostRoot: string,
    userAgent: string,
  ): Promise<ParsedRobotsTxt | null> {
    let perAudit = this.#cache.get(auditRunId);
    if (!perAudit) {
      perAudit = new Map();
      this.#cache.set(auditRunId, perAudit);
    }
    const cached = perAudit.get(hostRoot);
    if (cached !== undefined) return cached;

    let raw: string | null;
    try {
      raw = await this.#fetcher.fetchRobotsTxt(hostRoot);
    } catch (err) {
      // No retry per tasks.md L330 — degrade open + info-severity log.
      this.#logger.info(
        { domain: new URL(hostRoot).host, audit_run_id: auditRunId, err: String(err) },
        'robots-checker: fetch failed — degrade open (ROBOTS_TXT_FETCH_FAILED)',
      );
      raw = null;
    }

    if (raw === null) {
      // Cache "no policy" sentinel so we don't refetch within the same audit.
      perAudit.set(hostRoot, { disallowedPaths: [] });
      return null;
    }

    const parsed = parseRobotsTxt(raw, userAgent);
    perAudit.set(hostRoot, parsed);
    return parsed;
  }
}

/**
 * RFC 9309 subset parser. Returns Disallow paths applicable to `userAgent`:
 * a UA-specific group if one matches (case-insensitive substring against any
 * User-agent line in the group), else the `*` group, else empty.
 *
 * Module-scope (not a method) so parsing is pure and independently testable.
 */
function parseRobotsTxt(raw: string, userAgent: string): ParsedRobotsTxt {
  const ua = userAgent.toLowerCase();
  const groups: Array<{ agents: string[]; disallows: string[] }> = [];
  let current: { agents: string[]; disallows: string[] } | null = null;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.replace(/#.*$/, '').trim();
    if (trimmed === '') continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (key === 'user-agent') {
      // Start a new group whenever a User-agent line follows a Disallow line
      // (RFC 9309 §2.2.1 group delimitation).
      if (current === null || current.disallows.length > 0) {
        current = { agents: [], disallows: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === 'disallow' && current !== null) {
      // Empty Disallow = "allow everything" — no-op.
      if (value !== '') current.disallows.push(value);
    }
  }

  const specific = groups.find((g) =>
    g.agents.some((a) => a !== '*' && ua.includes(a)),
  );
  const wildcard = groups.find((g) => g.agents.includes('*'));
  return { disallowedPaths: (specific ?? wildcard)?.disallows ?? [] };
}
