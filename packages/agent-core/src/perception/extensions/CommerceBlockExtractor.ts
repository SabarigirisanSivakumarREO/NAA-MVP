/**
 * CommerceBlockExtractor — Phase 1b T1B-009 (AC-09, REQ-ANALYZE-PERCEPTION-V24-001).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md R-09 + AC-09
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/plan.md §2.2 ExtractCtx
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-009
 *
 * Detects commerce signals. `isCommerce` requires ANY of (per R-09):
 *   - JSON-LD Offer / AggregateOffer in ctx.metadata.schemaOrg
 *   - ATC-family CTA in ctx.primaryActions.text
 *   - Pricing block present (ctx.pricing populated by T1B-001; runs first)
 *
 * Always returns a CommerceBlock object — never null. When no commerce
 * signal is present, `isCommerce: false` and nullable fields are null /
 * empty arrays.
 *
 * Pure function — no global state, no logging, no LLM calls (R24). No
 * judgment ("good cart UX") — factual capture only (R5.3 + R24 + GR-007:
 * no conversion-prediction language).
 *
 * R10 compliance:
 *   - File ≤ 200 LOC (task budget)
 *   - Functions ≤ 50 LOC (R10.2)
 *   - Named exports only (R10.3)
 *   - No `any` (R13) — local DOM types mirror SubstrateExtension.ts
 */

// ----------------------------------------------------------------------
// Local DOM types — agent-core's tsconfig omits the DOM lib (mirror of
// SubstrateExtension.ts / PricingExtractor.ts). Only used subset declared.
// ----------------------------------------------------------------------

interface ElementLike {
  readonly tagName: string;
  readonly textContent: string | null;
  readonly innerText?: string;
  getAttribute(name: string): string | null;
}

interface DocumentLike {
  querySelector(selectors: string): ElementLike | null;
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
  body?: ElementLike | null;
}

/** Viewport size in CSS pixels — reserved for future fold-aware extraction. */
export interface Viewport {
  width: number;
  height: number;
}

/** Substrate context populated by T1B-000 + T1B-001. */
export interface ExtractCtx {
  metadata: {
    schemaOrg?: Array<Record<string, unknown>>;
    ogTags?: Record<string, string>;
  };
  primaryActions?: { selector: string; text: string } | null;
  pricing?: Record<string, unknown> | null;
}

/** Stock status taxonomy mapped from Schema.org ItemAvailability + on-page text. */
export type StockStatus = 'in_stock' | 'out_of_stock' | 'limited' | 'preorder' | 'unknown';

/** Shipping-signal type classification (R-09). */
export type ShippingSignalType =
  | 'free_shipping'
  | 'flat_rate'
  | 'free_above_threshold'
  | 'expedited'
  | 'other';

export interface ShippingSignal {
  type: ShippingSignalType;
  text: string;
}

export interface CommerceBlock {
  isCommerce: boolean;
  stockStatus: StockStatus | null;
  stockMessage: string | null;
  shippingSignals: ShippingSignal[];
  returnPolicyPresent: boolean;
  returnPolicyText: string | null;
  guaranteeText: string | null;
}

// ----------------------------------------------------------------------
// Pattern constants
// ----------------------------------------------------------------------

const ATC_PATTERN = /add to (cart|bag|basket)|buy now|checkout|order now/i;
const RETURN_LINK_PATTERN = /return|refund/i;
const GUARANTEE_PATTERN =
  /money.?back(?: guarantee)?|satisfaction guarantee|\d{1,3}.?day (?:return|guarantee|money.?back)/i;

const FREE_SHIPPING_PATTERN = /free shipping(?! over| above)|free delivery(?! over| above)/i;
const FREE_THRESHOLD_PATTERN = /free (?:shipping|delivery) (?:over|above) \$?\d/i;
const EXPEDITED_PATTERN = /expedited|next.?day|overnight|prime delivery|same.?day/i;
const FLAT_RATE_PATTERN = /flat[- ]rate (?:shipping|delivery)|\$\d+ shipping/i;

const STOCK_TEXT_PATTERN =
  /(?:only \d+ left|out of stock|sold out|in stock|limited (?:stock|quantity|availability)|pre.?order|back.?order)/i;

const SCHEMA_AVAILABILITY_MAP: Record<string, StockStatus> = {
  instock: 'in_stock',
  outofstock: 'out_of_stock',
  limitedavailability: 'limited',
  preorder: 'preorder',
  backorder: 'preorder',
  discontinued: 'out_of_stock',
  soldout: 'out_of_stock',
};

// ----------------------------------------------------------------------
// JSON-LD Offer detection (recursive scan tolerant of nested Product.offers)
// ----------------------------------------------------------------------

function hasOfferType(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const obj = node as Record<string, unknown>;
  const t = obj['@type'];
  if (typeof t === 'string' && (t === 'Offer' || t === 'AggregateOffer')) return true;
  if (Array.isArray(t) && t.some((x) => x === 'Offer' || x === 'AggregateOffer')) return true;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val)) {
      if (val.some(hasOfferType)) return true;
    } else if (val && typeof val === 'object') {
      if (hasOfferType(val)) return true;
    }
  }
  return false;
}

function findAvailability(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;
  const a = obj['availability'];
  if (typeof a === 'string') return a;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        const r = findAvailability(item);
        if (r) return r;
      }
    } else if (val && typeof val === 'object') {
      const r = findAvailability(val);
      if (r) return r;
    }
  }
  return null;
}

function mapSchemaAvailability(raw: string): StockStatus {
  // Strip URL prefix ("https://schema.org/InStock" -> "InStock"), lowercase.
  const key = raw.split('/').pop()?.toLowerCase() ?? '';
  return SCHEMA_AVAILABILITY_MAP[key] ?? 'unknown';
}

// ----------------------------------------------------------------------
// isCommerce classification — R-09: ANY of Offer schema / ATC CTA / pricing
// ----------------------------------------------------------------------

function classifyIsCommerce(ctx: ExtractCtx): boolean {
  // (1) JSON-LD Offer / AggregateOffer anywhere in schemaOrg fragments.
  const schemas = ctx.metadata.schemaOrg ?? [];
  for (const s of schemas) {
    if (hasOfferType(s)) return true;
  }
  // (2) Primary action text matches ATC-family verbs.
  const pa = ctx.primaryActions;
  if (pa && ATC_PATTERN.test(pa.text)) return true;
  // (3) Pricing block populated by T1B-001 (null-safe — T1B-001 may not have run).
  if (ctx.pricing && typeof ctx.pricing === 'object') return true;
  return false;
}

// ----------------------------------------------------------------------
// On-page text helpers
// ----------------------------------------------------------------------

function readBodyText(doc: DocumentLike): string {
  const body = doc.body ?? doc.querySelector('body');
  if (!body) return '';
  const raw = body.innerText !== undefined ? body.innerText : (body.textContent ?? '');
  return raw.replace(/\s+/g, ' ').trim();
}

function findStock(doc: DocumentLike, schemas: Array<Record<string, unknown>>): {
  status: StockStatus | null;
  message: string | null;
} {
  // Prefer Schema.org availability when present (machine-readable).
  for (const s of schemas) {
    const avail = findAvailability(s);
    if (avail) return { status: mapSchemaAvailability(avail), message: avail };
  }
  // Fall back to DOM attribute + on-page text.
  const itemprop = doc.querySelector('[itemprop="availability"]');
  if (itemprop) {
    const raw = itemprop.getAttribute('href') ?? itemprop.textContent ?? '';
    if (raw) return { status: mapSchemaAvailability(raw), message: raw.trim() };
  }
  const el = doc.querySelector('[class*="stock"], [class*="availability"]');
  if (el) {
    const txt = (el.innerText ?? el.textContent ?? '').trim();
    const m = txt.match(STOCK_TEXT_PATTERN);
    if (m) return { status: classifyStockText(m[0]), message: m[0] };
  }
  const body = readBodyText(doc);
  const bm = body.match(STOCK_TEXT_PATTERN);
  if (bm) return { status: classifyStockText(bm[0]), message: bm[0] };
  return { status: null, message: null };
}

function classifyStockText(text: string): StockStatus {
  const t = text.toLowerCase();
  if (/out of stock|sold out/.test(t)) return 'out_of_stock';
  if (/pre.?order|back.?order/.test(t)) return 'preorder';
  if (/only \d+ left|limited/.test(t)) return 'limited';
  if (/in stock/.test(t)) return 'in_stock';
  return 'unknown';
}

function findShipping(bodyText: string): ShippingSignal[] {
  const out: ShippingSignal[] = [];
  const seen = new Set<string>();
  const push = (type: ShippingSignalType, m: RegExpExecArray | null): void => {
    if (!m) return;
    const text = m[0].trim();
    const key = `${type}:${text.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ type, text });
  };
  push('free_above_threshold', FREE_THRESHOLD_PATTERN.exec(bodyText));
  push('free_shipping', FREE_SHIPPING_PATTERN.exec(bodyText));
  push('expedited', EXPEDITED_PATTERN.exec(bodyText));
  push('flat_rate', FLAT_RATE_PATTERN.exec(bodyText));
  return out;
}

function findReturnPolicy(doc: DocumentLike, bodyText: string): {
  present: boolean;
  text: string | null;
} {
  const links = doc.querySelectorAll('a, [class*="return"], [class*="refund"]');
  for (let i = 0; i < links.length; i += 1) {
    const el = links[i];
    if (!el) continue;
    const txt = (el.innerText ?? el.textContent ?? '').trim();
    if (txt && RETURN_LINK_PATTERN.test(txt)) {
      return { present: true, text: txt.slice(0, 120) };
    }
  }
  const m = bodyText.match(/[^.]*\b(?:return|refund)(?:s|ed)?\b[^.]*\./i);
  if (m) return { present: true, text: m[0].slice(0, 120) };
  return { present: false, text: null };
}

function findGuarantee(bodyText: string): string | null {
  const m = bodyText.match(GUARANTEE_PATTERN);
  if (!m) return null;
  // Expand to the surrounding sentence fragment for human-readable context.
  const idx = bodyText.toLowerCase().indexOf(m[0].toLowerCase());
  const start = Math.max(0, idx - 20);
  const end = Math.min(bodyText.length, idx + m[0].length + 40);
  return bodyText.slice(start, end).trim();
}

// ----------------------------------------------------------------------
// Top-level entry point
// ----------------------------------------------------------------------

/**
 * Extract a CommerceBlock from the page. Always returns an object; when
 * no commerce signal is present, `isCommerce: false` and side fields are
 * null / empty arrays. Pure, synchronous, no I/O (R24).
 */
export function extractCommerce(
  doc: DocumentLike,
  _viewport: Viewport,
  ctx: ExtractCtx,
): CommerceBlock {
  const isCommerce = classifyIsCommerce(ctx);
  if (!isCommerce) {
    return {
      isCommerce: false,
      stockStatus: null,
      stockMessage: null,
      shippingSignals: [],
      returnPolicyPresent: false,
      returnPolicyText: null,
      guaranteeText: null,
    };
  }

  const schemas = ctx.metadata.schemaOrg ?? [];
  const bodyText = readBodyText(doc);
  const stock = findStock(doc, schemas);
  const shipping = findShipping(bodyText);
  const ret = findReturnPolicy(doc, bodyText);
  const guarantee = findGuarantee(bodyText);

  return {
    isCommerce: true,
    stockStatus: stock.status,
    stockMessage: stock.message,
    shippingSignals: shipping,
    returnPolicyPresent: ret.present,
    returnPolicyText: ret.text,
    guaranteeText: guarantee,
  };
}
