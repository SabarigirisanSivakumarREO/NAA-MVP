/**
 * T4B-002 — URLPatternMatcher (Phase 4b context capture).
 *
 * Pure URL-pattern classifier returning a `PageType` from the LOCKED
 * 12-value enum (or `null` when no pattern matches).
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.1.2
 *     (REQ-CONTEXT-DIM-PAGE-001 — URL pattern inference signals)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-02 + R-04 +
 *     NF-03 (≥95% precision on 30-fixture URL set; confidence 0.9 on match)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-002
 *   packages/agent-core/src/types/context-profile.ts — PageTypeEnum (LOCKED).
 *
 * # Contract (AC-02)
 *
 * `URLPatternMatcher.match(url)` returns:
 *   - `{ pageType, matchedPattern, confidence: 0.9 }` when a pattern hits.
 *   - `{ pageType: null, confidence: 0 }` when no pattern matches OR the
 *     URL is unparseable (defense-in-depth: never throws — caller falls
 *     back to JSON-LD / layout inference).
 *
 * `confidence: 0.9` is the canonical value for `source: "url_pattern"`
 * matches (spec.md AC-02 + R-04). Higher only when user-provided.
 *
 * # Constitution compliance
 *
 * R10.1: file ≤ 200 LOC target. R10.3: named exports only.
 * R2: no `any`.
 * R9: zero vendor SDK imports — pure WHATWG URL parsing.
 * R25: NO Playwright import here OR anywhere in `packages/agent-core/src/context/*`.
 *      T4B-014 AST scan verifies; this module imports only `../types/context-profile.js`.
 *
 * # Pattern ordering
 *
 * Patterns are matched in array order. Earlier patterns win — the array
 * is curated so that more specific patterns (e.g. `/post-purchase/`)
 * appear before broader ones (e.g. `/checkout`) that could otherwise
 * shadow them. Each pattern is anchored to path-segment boundaries to
 * avoid spurious substring hits (e.g. `/blog` must NOT match `/blogger`).
 */
import type { PageType } from '../types/context-profile.js';

/** Public result shape. `pageType: null` when no pattern matched. */
export interface URLPatternMatchResult {
  /** Matched page type from LOCKED PageTypeEnum, or null on miss. */
  pageType: PageType | null;
  /** Source string of the first pattern that hit (for provenance audit). */
  matchedPattern?: string;
  /** 0.9 on hit (spec.md AC-02 + R-04). 0 on miss or parse failure. */
  confidence: number;
}

/**
 * Curated URL-path pattern catalog. Order = match priority (first hit wins).
 *
 * Patterns are case-insensitive (`/i`) and anchored with `(/|$|\?)` lookaheads
 * where needed to prevent substring false-positives (`/blog` !== `/bloggers`).
 *
 * Maintenance: when adding a new pattern, place specific BEFORE generic and
 * extend the conformance test (`url-pattern-matcher.test.ts`) with a fixture.
 */
const PATTERNS: ReadonlyArray<{ regex: RegExp; pageType: PageType; source: string }> = [
  // ===== post_purchase — MUST precede /checkout (substring overlap) =====
  { regex: /\/(thank[-_]?you|order[-_]?confirmation|post[-_]?purchase|order[-_]?complete|receipt)(\/|$|\?)/i, pageType: 'post_purchase', source: 'thank-you|order-confirmation|post-purchase|receipt' },

  // ===== checkout =====
  { regex: /\/(checkout|secure[-_]?checkout|payment|billing)(\/|$|\?)/i, pageType: 'checkout', source: '/checkout|/payment|/billing' },

  // ===== cart =====
  { regex: /\/(cart|basket|bag|shopping[-_]?cart)(\/|$|\?)/i, pageType: 'cart', source: '/cart|/basket|/bag' },

  // ===== PDP — anchor patterns: /products/<slug>, /product/<slug>, /p/<id>, /dp/<asin>, /item/<id> =====
  { regex: /\/(products?|p|dp|item|items|sku)\/[^/?]+/i, pageType: 'PDP', source: '/products/<slug>|/p/<id>|/dp/<asin>|/item/<id>' },

  // ===== PLP — collections, listings, search results =====
  { regex: /\/(collections?|shop|store|catalog|listing|search|s)(\/|$|\?)/i, pageType: 'PLP', source: '/collections|/shop|/catalog|/search' },

  // ===== category — taxonomy nodes (must follow PLP; some sites overlap) =====
  { regex: /\/(category|categories|c|department|departments)(\/|$|\?)/i, pageType: 'category', source: '/category|/c/<slug>|/department' },

  // ===== pricing =====
  { regex: /\/(pricing|plans|subscribe|subscription[-_]?plans)(\/|$|\?)/i, pageType: 'pricing', source: '/pricing|/plans' },

  // ===== comparison =====
  { regex: /\/(compare|comparison|vs|versus)(\/|$|\?)/i, pageType: 'comparison', source: '/compare|/vs|/versus' },

  // ===== landing — paid/campaign landing pages =====
  { regex: /\/(lp|landing|landing[-_]?page|campaigns?|promo|offers?)(\/|$|\?)/i, pageType: 'landing', source: '/lp|/landing|/campaign|/promo' },

  // ===== blog =====
  { regex: /\/(blog|articles|news|posts|insights|resources|stories)(\/|$|\?)/i, pageType: 'blog', source: '/blog|/articles|/news|/posts' },

  // ===== about =====
  { regex: /\/(about|about[-_]?us|company|team|who[-_]?we[-_]?are)(\/|$|\?)/i, pageType: 'about', source: '/about|/about-us|/company' },

  // ===== home — exact root path (must be LAST; most-permissive) =====
  { regex: /^\/?$/, pageType: 'home', source: '/' },
];

/** Sentinel for "no match" — single shared object to avoid per-call allocation. */
const NO_MATCH: URLPatternMatchResult = Object.freeze({ pageType: null, confidence: 0 });

/**
 * Pure URL → PageType classifier. Stateless, allocation-light, no IO.
 *
 * Matching strategy: parse via WHATWG `new URL()`; iterate the curated
 * pattern catalog in order; return the first hit. On unparseable input
 * (relative path with no base, malformed scheme, etc.), return NO_MATCH
 * — the caller (PageTypeInferrer T4B-006) falls back to other signals.
 */
export class URLPatternMatcher {
  /**
   * Classify `url` by path pattern. Returns `{ pageType: null, confidence: 0 }`
   * when no pattern matches OR the URL is unparseable.
   *
   * Confidence is fixed at 0.9 on hit per spec.md AC-02 + R-04 — URL pattern
   * is a high-but-not-absolute signal (`source: "url_pattern"`). Only
   * `source: "user"` carries confidence 1.0.
   */
  match(url: string): URLPatternMatchResult {
    const pathname = this.#extractPathname(url);
    if (pathname === null) {
      return NO_MATCH;
    }
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(pathname)) {
        return {
          pageType: pattern.pageType,
          matchedPattern: pattern.source,
          confidence: 0.9,
        };
      }
    }
    return NO_MATCH;
  }

  /**
   * Extract `pathname` (e.g. `/products/widget`) from `url`, or `null` if
   * parsing fails. Same defensive pattern as DomainPolicy: never throws;
   * caller falls back to other inference signals on parse failure.
   *
   * Why WHATWG URL not regex: handles IDN, port stripping, query / fragment
   * separation, percent-encoding consistently. A regex would diverge from
   * the parser used elsewhere (RobotsChecker, DomainPolicy) and re-introduce
   * edge-case bugs.
   */
  #extractPathname(url: string): string | null {
    try {
      return new URL(url).pathname;
    } catch {
      return null;
    }
  }
}

/** Convenience top-level function — equivalent to `new URLPatternMatcher().match(url)`. */
export function matchUrlPattern(url: string): URLPatternMatchResult {
  return new URLPatternMatcher().match(url);
}
