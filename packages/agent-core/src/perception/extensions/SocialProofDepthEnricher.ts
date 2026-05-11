/**
 * SocialProofDepthEnricher — Phase 1b T1B-006 (AC-06, REQ-ANALYZE-PERCEPTION-V24-001).
 *
 * Source: phase-1b-perception-extensions/{spec.md R-06+AC-06, plan.md §2.2, tasks.md T1B-006}.
 *
 * Populates `socialProofDepth` from JSON-LD AggregateRating (via T1B-000
 * `ctx.metadata.schemaOrg`) + on-page review-block scan + third-party widget
 * signatures. R24: counts + booleans only — no judgement, no conversion
 * prediction (R5.3 + GR-007). R10: ≤180 LOC, ≤50 LOC/fn, no `any` (R13).
 */

import type { Cta, FormField, Heading, PrimaryAction } from '../types.js';

// Local DOM shims — agent-core tsconfig omits lib.dom. Real Document /
// jsdom / Playwright in-page objects satisfy these structurally.
interface ElementLike {
  readonly textContent: string | null;
  readonly innerText?: string;
  getAttribute(name: string): string | null;
  querySelectorAll?(selectors: string): ArrayLike<ElementLike>;
}
interface DocumentLike {
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
}

/** Viewport hint — unused here; kept for the unified extension signature. */
export interface Viewport { width: number; height: number }

/**
 * Substrate context from T1B-000 (plan.md §2.2). Only `metadata.schemaOrg`
 * is read; other fields stay on the contract for the unified extension
 * signature. `now` is an optional clock override for deterministic recency.
 */
export interface ExtractCtx {
  ctas?: Cta[];
  formFields?: FormField[];
  metadata: { schemaOrg?: Array<Record<string, unknown>>; ogTags?: Record<string, string> };
  headings?: Heading[];
  primaryActions?: PrimaryAction | null;
  now?: number;
}

/** AC-06 output contract — exactly 6 fields, no more, no less. */
export interface SocialProofDepth {
  reviewCount: number;
  starDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number } | null;
  recencyDays: number | null;
  hasAggregateRating: boolean;
  hasIndividualReviews: boolean;
  thirdPartyVerified: boolean;
}

const MS_PER_DAY = 86_400_000;

/** Selector for individual on-page review blocks (per task brief). */
const REVIEW_BLOCK_SELECTOR =
  '[itemprop="review"], [class*="review" i]:not([class*="reviews-count" i]), [data-review], [role="review"]';

/** Third-party review-widget vendor signatures (case-insensitive substring). */
const THIRD_PARTY_WIDGET_SELECTOR =
  '[class*="trustpilot" i], [data-trustpilot], [class*="yotpo" i], [class*="bazaarvoice" i], [class*="reviews-io" i], [class*="reviewsio" i], [class*="stamped" i], [class*="okendo" i]';

/** Coerce a JSON-LD numeric field (sometimes stringified) to a finite number. */
function coerceNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Walk a JSON-LD fragment for an `AggregateRating` — at top-level OR nested
 * under common parents (`Product.aggregateRating`, `@graph[]`, etc.).
 * Malformed objects are silently tolerated per spec R-06.
 */
function findAggregateRating(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;
  if (obj['@type'] === 'AggregateRating') return obj;
  for (const key of ['aggregateRating', 'mainEntity', 'itemReviewed', '@graph']) {
    const child = obj[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findAggregateRating(item);
        if (found) return found;
      }
    } else if (child) {
      const found = findAggregateRating(child);
      if (found) return found;
    }
  }
  return null;
}

/** Read a 1-5 star value from `aria-label` or visible text within a review block. */
function parseStarRating(el: ElementLike): number | null {
  const aria = el.getAttribute('aria-label') ?? '';
  const ariaMatch = /([1-5])(?:\.\d)?\s*(?:out of|\/|stars?)/i.exec(aria);
  if (ariaMatch?.[1]) return Number.parseInt(ariaMatch[1], 10);
  const raw = el.innerText !== undefined ? el.innerText : (el.textContent ?? '');
  const text = raw.trim().replace(/\s+/g, ' ');
  const textMatch = /\b([1-5])\b\s*(?:\/\s*5|stars?|out of)?/i.exec(text);
  if (textMatch?.[1]) {
    const n = Number.parseInt(textMatch[1], 10);
    if (n >= 1 && n <= 5) return n;
  }
  return null;
}

/** Compute days-since-most-recent from `<time datetime>` inside review blocks. */
function recencyFromTimeElements(block: ElementLike, now: number): number | null {
  if (typeof block.querySelectorAll !== 'function') return null;
  const times = block.querySelectorAll('time[datetime], [itemprop="datePublished"]');
  let most: number | null = null;
  for (let j = 0; j < times.length; j += 1) {
    const t = times[j];
    if (!t) continue;
    const dt = t.getAttribute('datetime') ?? t.getAttribute('content');
    if (!dt) continue;
    const ms = Date.parse(dt);
    if (!Number.isFinite(ms)) continue;
    const days = Math.floor((now - ms) / MS_PER_DAY);
    if (most === null || days < most) most = days < 0 ? 0 : days;
  }
  return most;
}

interface ScanResult {
  count: number;
  stars: { 1: number; 2: number; 3: number; 4: number; 5: number };
  hasAnyStarData: boolean;
  recencyDays: number | null;
}

function scanReviews(doc: DocumentLike, now: number): ScanResult {
  const list = doc.querySelectorAll(REVIEW_BLOCK_SELECTOR);
  const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let hasAnyStarData = false;
  let mostRecent: number | null = null;
  for (let i = 0; i < list.length; i += 1) {
    const el = list[i];
    if (!el) continue;
    count += 1;
    const s = parseStarRating(el);
    if (s !== null) {
      hasAnyStarData = true;
      stars[s as 1 | 2 | 3 | 4 | 5] += 1;
    }
    const r = recencyFromTimeElements(el, now);
    if (r !== null && (mostRecent === null || r < mostRecent)) mostRecent = r;
  }
  return { count, stars, hasAnyStarData, recencyDays: mostRecent };
}

/** Public entry point. Always returns a SocialProofDepth — zero-shape on empty pages. */
export function extractSocialProofDepth(
  doc: DocumentLike,
  _viewport: Viewport,
  ctx: ExtractCtx,
): SocialProofDepth {
  const now = ctx.now ?? Date.now();
  const aggregate = findAggregateRating({ '@graph': ctx.metadata.schemaOrg ?? [] });
  const onpage = scanReviews(doc, now);
  const aggregateReviewCount = aggregate ? coerceNumber(aggregate['reviewCount'] ?? aggregate['ratingCount']) : null;
  const reviewCount = aggregateReviewCount ?? (onpage.count > 0 ? onpage.count : 0);
  const thirdPartyVerified = doc.querySelectorAll(THIRD_PARTY_WIDGET_SELECTOR).length > 0;
  return {
    reviewCount,
    starDistribution: onpage.hasAnyStarData ? onpage.stars : null,
    recencyDays: onpage.recencyDays,
    hasAggregateRating: aggregate !== null,
    hasIndividualReviews: onpage.count > 0,
    thirdPartyVerified,
  };
}
