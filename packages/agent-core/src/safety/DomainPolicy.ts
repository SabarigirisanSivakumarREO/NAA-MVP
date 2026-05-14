/**
 * Phase 4 T068 — DomainPolicy: three-way URL classification.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-03 (v0.4)
 *     + Acceptance Scenario #7 (unknown → 10/min, trusted → 30/min, blocked → refusal)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T068
 *     (REQ-SAFETY-DOMAIN-POLICY-001 / R-03)
 *
 * # Contract (AC-03)
 *
 * `DomainPolicy.classify(url)` returns one of:
 *   - `'trusted'` — host appears in `config.trusted`
 *   - `'blocked'` — host appears in `config.blocked` (PRECEDENCE over trusted)
 *   - `'unknown'` — default; neither list matches (includes unparseable URLs)
 *
 * Classification is **domain-based, not path-based**: only `new URL(url).hostname`
 * is consulted. Per the Wave 1 conformance test (`tests/conformance/domain-policy.test.ts`),
 * matches are exact-host equality — subdomain wildcarding is intentionally NOT
 * implemented in MVP (test L24 + L48-49 only assert exact host equality;
 * adding wildcard logic would be untested behavior, R11 ratchet).
 *
 * # Why blocked > trusted precedence?
 *
 * Defense-in-depth (CLAUDE.md §7 NEVER tier + R12 default-deny): if a domain
 * appears in BOTH lists (config-drift incident), the safer interpretation wins.
 * Test L52-58 pins this behavior.
 *
 * # Unparseable URLs
 *
 * `new URL()` throws on malformed input; we catch and return `'unknown'` so
 * downstream rate-limiting still applies (10/min unknown cap per Acceptance #7)
 * rather than failing the audit. The caller (`SafetyCheck`) is responsible for
 * any stricter pre-validation; we never propagate the parse error.
 *
 * R10.1: file ≤ 150 lines (tasks.md T068). R10.3: named exports only.
 */
import { createLogger } from '../observability/logger.js';

const log = createLogger('domain-policy');

/**
 * Three-way classification output. Drives downstream rate-limit selection
 * (Acceptance #7) and `SafetyCheck` enforcement (T067 AC-02).
 */
export type DomainClassification = 'trusted' | 'unknown' | 'blocked';

/**
 * Constructor config. Both lists are exact-host strings (no scheme, no path,
 * no wildcard). Lists may be empty; if both are empty every URL classifies
 * as `'unknown'`. The shape matches the Wave 1 conformance test fixtures
 * (e.g. `{ trusted: ['amazon.in', 'flipkart.com'], blocked: [] }`).
 */
export interface DomainPolicyConfig {
  /** Hostnames classified as `'trusted'` (exact match). */
  trusted: readonly string[];
  /** Hostnames classified as `'blocked'` (exact match, takes precedence). */
  blocked: readonly string[];
}

/**
 * Pure in-memory classifier. No IO, no persistence, no state mutation after
 * construction — `classify()` is a referentially-transparent function of
 * `(url, config)`. Lists are frozen to `Set<string>` for O(1) lookup.
 */
export class DomainPolicy {
  readonly #trusted: ReadonlySet<string>;
  readonly #blocked: ReadonlySet<string>;

  constructor(config: DomainPolicyConfig) {
    this.#trusted = new Set(config.trusted);
    this.#blocked = new Set(config.blocked);
  }

  /**
   * Classify `url` by hostname. Order: blocked → trusted → unknown.
   *
   * Returns `'unknown'` for malformed URLs (e.g. missing scheme) so the
   * caller's rate-limiter still has a bucket key; the malformed-URL event
   * is logged for observability but does not throw.
   */
  classify(url: string): DomainClassification {
    const host = this.#extractHost(url);
    if (host === null) {
      // Malformed URL — log + default to 'unknown' (defense-in-depth via
      // unknown's 10/min cap rather than blowing up the audit).
      log.warn({ domain: '<unparseable>' }, 'domain-policy: unparseable URL classified as unknown');
      return 'unknown';
    }
    if (this.#blocked.has(host)) {
      log.debug({ domain: host }, 'domain-policy: blocked');
      return 'blocked';
    }
    if (this.#trusted.has(host)) {
      log.debug({ domain: host }, 'domain-policy: trusted');
      return 'trusted';
    }
    log.debug({ domain: host }, 'domain-policy: unknown');
    return 'unknown';
  }

  /**
   * Parse `url` and return the hostname, or `null` if parsing fails.
   *
   * Why a try/catch and not a regex: WHATWG URL is the canonical parser the
   * rest of the codebase uses (e.g. RateLimiter bucketing); replicating its
   * edge cases (IDN, port stripping, IPv6) in a regex is bug-prone.
   */
  #extractHost(url: string): string | null {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }
}
