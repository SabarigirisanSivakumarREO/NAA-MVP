/**
 * StickyElementDetector — Phase 1b T1B-003 (AC-03, R-03, REQ-ANALYZE-PERCEPTION-V24-001).
 *
 * Source: phase-1b spec.md AC-03/R-03; plan.md §2.2 (ExtractCtx).
 *
 * Detects sticky/fixed elements via computed-style `position` ∈ {sticky, fixed};
 * emits {type (open string), positionStrategy, selector, viewportCoveragePercent,
 * isAboveFold, containsPrimaryCta}.
 *
 * Pure + synchronous. R10: ≤150 LOC, functions ≤50 LOC, no `any`.
 * Viewport: caller supplies CSS-px dimensions (Phase 1b standard 1280 × 800).
 */
import type { Cta, PrimaryAction } from '../types.js';

interface DOMRectLike {
  readonly width: number; readonly height: number;
  readonly top: number; readonly left: number;
  readonly right: number; readonly bottom: number;
}
interface ElementLike {
  readonly tagName: string;
  readonly id: string;
  readonly textContent: string | null;
  readonly parentElement: ElementLike | null;
  readonly children: ArrayLike<ElementLike>;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  getBoundingClientRect(): DOMRectLike;
}
interface DocumentLike {
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
  querySelector(selector: string): ElementLike | null;
  defaultView?: { getComputedStyle(el: ElementLike): { position: string } } | null;
}
declare const CSS: { escape(value: string): string } | undefined;

/** Viewport size in CSS pixels (passed in by ContextAssembler). */
export interface Viewport { width: number; height: number }

/** Subset of ExtractCtx that this extractor consumes. */
export interface StickyExtractCtx { ctas: Cta[]; primaryActions: PrimaryAction | null }

/** Output shape per AC-03 contract. */
export interface StickyElement {
  type: string;
  positionStrategy: 'sticky' | 'fixed';
  selector: string;
  viewportCoveragePercent: number;
  isAboveFold: boolean;
  containsPrimaryCta: boolean;
}

const ABOVE_FOLD_TOP_FRACTION = 0.7;
const ANNOUNCEMENT_BAR_MAX_HEIGHT_PX = 60;
const CTA_TEXT_PATTERN = /add to (cart|bag|basket)|buy now|checkout/i;
const CART_TEXT_PATTERN = /cart|bag|basket|checkout/i;
const CHAT_TEXT_PATTERN = /chat|message|help|support/i;

function buildSelector(el: ElementLike): string {
  const escape = (s: string): string =>
    typeof CSS !== 'undefined' && CSS ? CSS.escape(s) : s;
  if (el.id) return `#${escape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const name = el.getAttribute('name');
  if (name) return `${tag}[name="${escape(name)}"]`;
  const parent = el.parentElement;
  if (!parent) return tag;
  const sibs: ElementLike[] = [];
  for (let i = 0; i < parent.children.length; i += 1) {
    const c = parent.children[i];
    if (c && c.tagName === el.tagName) sibs.push(c);
  }
  if (sibs.length === 1) return tag;
  return `${tag}:nth-of-type(${sibs.indexOf(el) + 1})`;
}

function readPosition(doc: DocumentLike, el: ElementLike): string {
  const view = doc.defaultView;
  if (view && typeof view.getComputedStyle === 'function') {
    return view.getComputedStyle(el).position;
  }
  const m = /position\s*:\s*([a-z-]+)/i.exec(el.getAttribute('style') ?? '');
  return m && m[1] ? m[1].toLowerCase() : '';
}

function classifyType(el: ElementLike, rect: DOMRectLike, vp: Viewport): string {
  const tag = el.tagName.toLowerCase();
  const role = (el.getAttribute('role') ?? '').toLowerCase();
  const text = (el.textContent ?? '').trim().toLowerCase();
  const nearTop = rect.top <= 10;
  const nearBottom = rect.bottom >= vp.height - 10;
  if (nearTop && (tag === 'nav' || tag === 'header' || role === 'navigation')) return 'sticky_nav';
  if (nearTop && rect.height <= ANNOUNCEMENT_BAR_MAX_HEIGHT_PX) return 'sticky_announcement_bar';
  if (nearBottom && CHAT_TEXT_PATTERN.test(text) && rect.width < vp.width * 0.4) return 'sticky_chat_widget';
  if (nearBottom && CART_TEXT_PATTERN.test(text)) return 'sticky_cart';
  if (nearBottom && CTA_TEXT_PATTERN.test(text)) return 'sticky_cta';
  return 'sticky_other';
}

function containsAnyCta(doc: DocumentLike, el: ElementLike, ctx: StickyExtractCtx): boolean {
  const selectors = ctx.ctas.map((c) => c.selector);
  if (ctx.primaryActions) selectors.push(ctx.primaryActions.selector);
  const elText = (el.textContent ?? '').trim();
  if (!elText) return false;
  for (const sel of selectors) {
    if (!sel) continue;
    try {
      const found = doc.querySelector(sel);
      const ftext = found ? (found.textContent ?? '').trim() : '';
      if (ftext && elText.includes(ftext)) return true;
    } catch { /* invalid selector — skip */ }
  }
  return false;
}

/** Top-level entry. Pure + synchronous. */
export function extractStickyElements(
  doc: DocumentLike,
  viewport: Viewport,
  ctx: StickyExtractCtx,
): StickyElement[] {
  const all = doc.querySelectorAll('*');
  const out: StickyElement[] = [];
  const vpArea = Math.max(1, viewport.width * viewport.height);
  for (let i = 0; i < all.length; i += 1) {
    const el = all[i];
    if (!el) continue;
    const pos = readPosition(doc, el);
    if (pos !== 'sticky' && pos !== 'fixed') continue;
    const rect = el.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    out.push({
      type: classifyType(el, rect, viewport),
      positionStrategy: pos,
      selector: buildSelector(el),
      viewportCoveragePercent: Math.min(100, (area / vpArea) * 100),
      isAboveFold: rect.top <= 10 || rect.top >= viewport.height * ABOVE_FOLD_TOP_FRACTION,
      containsPrimaryCta: containsAnyCta(doc, el, ctx),
    });
  }
  return out;
}
