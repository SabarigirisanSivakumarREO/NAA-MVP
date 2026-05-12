/**
 * PricingExtractor — Phase 1b T1B-001 (AC-01, REQ-ANALYZE-PERCEPTION-V24-001).
 *
 * Spec: docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md R-01 + AC-01
 * Plan: phase-1b-perception-extensions/plan.md §2.2 ExtractCtx.
 *
 * Populates `pricing` when on-page text OR JSON-LD reveals a price; emits
 * `null` when no pricing is detected (R-01 + Edge Case). R-01 runs FIRST
 * within the evaluate pipeline so T1B-009 CommerceBlockExtractor can read
 * `ctx.pricing` downstream. Pure function — no global state, no LLM calls
 * (R24); no judgment ("this price is high") — factual capture only (R5.3).
 * Local DOM types mirror SubstrateExtension.ts (R13 no `any`).
 */

interface DOMRectLike { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
interface ElementLike {
  readonly tagName: string;
  readonly textContent: string | null;
  readonly innerText?: string;
  getAttribute(name: string): string | null;
  getBoundingClientRect(): DOMRectLike;
  querySelectorAll?(selectors: string): ArrayLike<ElementLike>;
}
interface DocumentLike {
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
  body?: ElementLike | null;
}

/** Viewport size in CSS pixels — passed from ContextAssembler. */
export interface Viewport { width: number; height: number }

/** Substrate context populated by T1B-000 SubstrateExtension. */
export interface ExtractCtx {
  metadata: { schemaOrg?: Array<Record<string, unknown>>; ogTags?: Record<string, string> };
}

// Stage 2.5 fix F-001 — re-export from types.ts (single source of truth).
// Local string-literal types removed; PricingSchema in types.ts is canonical.
export type { PricingDisplayFormat, TaxInclusion } from '../types.js';
import type { PricingDisplayFormat, TaxInclusion } from '../types.js';

/** AC-01 contract: 9 fields populated when pricing is detected. */
export interface PricingResult {
  displayFormat: PricingDisplayFormat;
  amount: string;
  amountNumeric: number;
  currency: string;
  taxInclusion: TaxInclusion;
  anchorPrice: string | null;
  discountPercent: number | null;
  comparisonShown: boolean;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
}

// ---- Price parsing --------------------------------------------------------

// Matches a price token, optionally prefixed by symbol or suffixed by ISO 4217 code.
const PRICE_PATTERN =
  /(?:(\$|£|€|¥|₹|₽|R\$|kr)\s?)?([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?:\s?([A-Z]{3}))?/;

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  $: 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY',
  '₹': 'INR', '₽': 'RUB', R$: 'BRL', kr: 'SEK',
};

interface ParsedPrice {
  text: string;
  numeric: number;
  currency: string | null;
}

function parsePriceText(raw: string): ParsedPrice | null {
  const match = PRICE_PATTERN.exec(raw);
  if (!match) return null;
  const [whole, sym, numStr, iso] = match;
  if (!numStr) return null;
  const numeric = Number.parseFloat(numStr.replace(/[,\s]/g, ''));
  if (!Number.isFinite(numeric)) return null;
  const currency = iso ?? (sym ? (SYMBOL_TO_CURRENCY[sym] ?? null) : null);
  return { text: whole.trim(), numeric, currency };
}

// ---- JSON-LD Offer extraction --------------------------------------------

/** Walk a JSON-LD fragment to find the first Offer / AggregateOffer object. */
function findOffer(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  if (type === 'Offer' || type === 'AggregateOffer') return obj;
  for (const key of ['offers', 'mainEntity', 'itemOffered']) {
    const child = obj[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findOffer(item);
        if (found) return found;
      }
    } else if (child) {
      const found = findOffer(child);
      if (found) return found;
    }
  }
  return null;
}

function readOfferPrice(offer: Record<string, unknown>): ParsedPrice | null {
  const raw = offer['price'] ?? offer['lowPrice'];
  if (raw === undefined || raw === null) return null;
  const numeric = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(numeric)) return null;
  const currency = typeof offer['priceCurrency'] === 'string' ? offer['priceCurrency'] : null;
  return { text: String(raw), numeric, currency };
}

// ---- On-page DOM scanning -------------------------------------------------

const ONPAGE_PRICE_SELECTORS = [
  '[itemprop="price"]', '[data-price]', '[class*="price" i]', '[id*="price" i]',
];

const STRIKE_SELECTOR =
  's, del, .strikethrough, [class*="strike" i], [class*="original" i], [class*="was-price" i]';

function visibleText(el: ElementLike): string {
  const raw = el.innerText !== undefined ? el.innerText : (el.textContent ?? '');
  return raw.trim().replace(/\s+/g, ' ');
}

function collectPriceElements(doc: DocumentLike): ElementLike[] {
  const seen = new Set<ElementLike>();
  const out: ElementLike[] = [];
  for (const sel of ONPAGE_PRICE_SELECTORS) {
    const list = doc.querySelectorAll(sel);
    for (let i = 0; i < list.length && out.length < 20; i += 1) {
      const el = list[i];
      if (el && !seen.has(el)) { seen.add(el); out.push(el); }
    }
  }
  return out;
}

function findStrikeAnchor(doc: DocumentLike): ParsedPrice | null {
  const list = doc.querySelectorAll(STRIKE_SELECTOR);
  for (let i = 0; i < list.length; i += 1) {
    const el = list[i];
    if (!el) continue;
    const parsed = parsePriceText(visibleText(el));
    if (parsed) return parsed;
  }
  return null;
}

/**
 * Parse a sale price within an element while excluding strikethrough
 * children. Important for `<div><s>$99</s> <span>$49</span></div>` where
 * the naive regex would otherwise grab `$99` first.
 */
function parsePriceExcludingStrike(el: ElementLike): ParsedPrice | null {
  const strikes = el.querySelectorAll?.(STRIKE_SELECTOR);
  const strikeTexts = new Set<string>();
  if (strikes) {
    for (let i = 0; i < strikes.length; i += 1) {
      const s = strikes[i];
      if (s) strikeTexts.add(visibleText(s));
    }
  }
  let full = visibleText(el);
  for (const t of strikeTexts) if (t) full = full.split(t).join(' ');
  return parsePriceText(full);
}

function scanOnPagePrice(doc: DocumentLike): { primary: ParsedPrice; element: ElementLike } | null {
  for (const el of collectPriceElements(doc)) {
    const attr = el.getAttribute('content') ?? el.getAttribute('data-price');
    if (attr) {
      const parsed = parsePriceText(attr);
      if (parsed) return { primary: parsed, element: el };
    }
    const parsed = parsePriceExcludingStrike(el);
    if (parsed) return { primary: parsed, element: el };
  }
  if (doc.body) {
    const parsed = parsePriceExcludingStrike(doc.body);
    if (parsed) return { primary: parsed, element: doc.body };
  }
  return null;
}

// ---- Tax inclusion + display format --------------------------------------

const TAX_INCLUSIVE_PATTERN = /\b(incl\.?|including)\s+(tax|vat|gst)\b/i;
const TAX_EXCLUSIVE_PATTERN = /\b(excl\.?|excluding|plus)\s+(tax|vat|gst)\b/i;
const DISCOUNT_ANNOTATION_PATTERN = /\b\d{1,2}\s?%\s?(off|discount)\b|\bsave\s+\$?\d/i;

function detectTaxInclusion(doc: DocumentLike): TaxInclusion {
  const text = doc.body ? visibleText(doc.body) : '';
  if (TAX_INCLUSIVE_PATTERN.test(text)) return 'inclusive';
  if (TAX_EXCLUSIVE_PATTERN.test(text)) return 'exclusive';
  return 'unknown';
}

function deriveDisplayFormat(anchor: ParsedPrice | null, bodyText: string): PricingDisplayFormat {
  if (anchor) return 'crossed-out';
  if (DISCOUNT_ANNOTATION_PATTERN.test(bodyText)) return 'with-discount';
  return 'plain';
}

// ---- Top-level extractor --------------------------------------------------

/**
 * Floor (not round) to integer percent — `$99 → $49` reports `50`
 * (50.50% → 50), matching conventional retail "% off" labels.
 */
function computeDiscountPercent(anchor: ParsedPrice | null, sale: ParsedPrice): number | null {
  if (!anchor || anchor.numeric <= sale.numeric || anchor.numeric === 0) return null;
  return Math.floor(((anchor.numeric - sale.numeric) / anchor.numeric) * 100);
}

function rectToBoundingBox(
  el: ElementLike | null,
): { x: number; y: number; width: number; height: number } | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

/**
 * Returns `null` when no pricing is detected on the page (R-01 Edge Case).
 * The `_viewport` parameter is currently unused but reserved for future
 * fold-aware pricing (e.g., distinguishing hero price from cart-summary).
 */
export function extractPricing(
  doc: DocumentLike,
  _viewport: Viewport,
  ctx: ExtractCtx,
): PricingResult | null {
  // 1. JSON-LD path — authoritative when present.
  let offerPrice: ParsedPrice | null = null;
  for (const frag of ctx.metadata.schemaOrg ?? []) {
    const offer = findOffer(frag);
    if (offer) {
      offerPrice = readOfferPrice(offer);
      if (offerPrice) break;
    }
  }

  // 2. On-page DOM scan + strike-through anchor.
  const onpage = scanOnPagePrice(doc);
  const anchor = findStrikeAnchor(doc);

  // 3. Nothing detected anywhere → null per R-01 Edge Case.
  if (!offerPrice && !onpage) return null;

  // 4. Reconcile sources — on-page text wins for display, JSON-LD fills gaps.
  const sale: ParsedPrice = onpage?.primary ?? (offerPrice as ParsedPrice);
  const saleElement = onpage?.element ?? null;
  const currency =
    sale.currency ?? offerPrice?.currency ?? ctx.metadata.ogTags?.['og:price:currency'] ?? 'USD';
  const bodyText = doc.body ? visibleText(doc.body) : '';

  return {
    displayFormat: deriveDisplayFormat(anchor, bodyText),
    amount: sale.text || `${sale.numeric}`,
    amountNumeric: sale.numeric,
    currency,
    taxInclusion: detectTaxInclusion(doc),
    anchorPrice: anchor ? anchor.text : null,
    discountPercent: computeDiscountPercent(anchor, sale),
    comparisonShown: anchor !== null,
    boundingBox: rectToBoundingBox(saleElement),
  };
}
