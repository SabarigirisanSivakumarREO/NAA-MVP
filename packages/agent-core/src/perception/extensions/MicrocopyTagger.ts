/**
 * MicrocopyTagger — Phase 1b T1B-007 (AC-07, REQ-ANALYZE-PERCEPTION-V24-001).
 * Source: phase-1b-perception-extensions/{spec.md R-07+AC-07, plan.md §2.2}.
 * Reads `ctx.ctas[]` (T1B-000 substrate); scans text within 100px CSS
 * proximity of each CTA; applies the 7-category regex taxonomy.
 * Spec §Out-of-Scope v0.2: Cialdini-principle granularity (scarcity,
 * authority, reciprocity, commitment_consistency, liking) deferred to
 * Phase 6 LLM-tagging (regex-only constraint NF-04). Collapse map:
 * scarcity → urgency; authority → social_proof; rest deferred.
 * Constraints: R10 (≤220 LOC, ≤50 LOC/fn), R13 (no `any`), R24 (tags
 * are factual classifications, not judgements), R5.3 + GR-007 (rationales
 * describe linguistic patterns, never predict conversion outcomes).
 */

import type { Cta, FormField, Heading, PrimaryAction } from '../types.js';

// Local DOM shims — agent-core tsconfig omits lib.dom. Real Document /
// jsdom / Playwright in-page Documents satisfy these structurally.
interface DOMRectLike {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}
interface ElementLike {
  readonly textContent: string | null;
  readonly innerText?: string;
  getBoundingClientRect?(): DOMRectLike;
}
interface DocumentLike {
  querySelector(selectors: string): ElementLike | null;
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
}

/** Viewport size in CSS pixels — passed in from ContextAssembler. */
export interface Viewport {
  width: number;
  height: number;
}

/** ExtractCtx subset this extractor reads (plan.md §2.2). */
export interface ExtractCtx {
  ctas: Cta[];
  formFields?: FormField[];
  metadata?: {
    schemaOrg?: Array<Record<string, unknown>>;
    ogTags?: Record<string, string>;
  };
  headings?: Heading[];
  primaryActions?: PrimaryAction | null;
}

/** AC-07 tag taxonomy — exactly 7 values (Cialdini collapse per spec v0.2). */
export type MicrocopyTag =
  | 'risk_reducer'
  | 'urgency'
  | 'security'
  | 'guarantee'
  | 'social_proof'
  | 'value_prop'
  | 'other';

/** Single near-CTA microcopy entry. */
export interface NearCtaTag {
  ctaIndex: number;
  text: string;
  selector: string;
  tags: MicrocopyTag[];
}

/** AC-07 output contract. */
export interface Microcopy {
  nearCtaTags: NearCtaTag[];
}

const PROXIMITY_PX = 100;
const MAX_SNIPPET_CHARS = 200;
const MIN_TEXT_LENGTH = 6;
const CANDIDATE_SELECTOR =
  'p, span, small, em, strong, li, div, label, figcaption';

/** 6 positive tag regexes; the 7th (`other`) is the no-match fallback.
 *  All patterns are evaluated against every snippet. Rationales describe
 *  linguistic pattern only (R24 / R5.3 — never "drives conversion"). */
const MICROCOPY_PATTERNS: ReadonlyArray<{ tag: MicrocopyTag; pattern: RegExp; rationale: string }> = [
  { tag: 'risk_reducer',
    pattern: /\b(free returns?|no (commitment|credit card|risk|obligation)|try (it )?free|cancel (anytime|any time))\b/i,
    rationale: 'language framing the action as low-risk' },
  { tag: 'urgency',
    pattern: /\b(today only|ends? (tonight|soon|today)|sale ends|limited time|expires? \w+|hurry|don'?t miss|only \d+ left|order soon|while supplies last|act (now|fast))\b/i,
    rationale: 'time- or scarcity-bounded phrasing (collapses scarcity per v0.2)' },
  { tag: 'security',
    pattern: /\b(secure(d|ly)? checkout|secure payment|encrypt(ed|ion)|(SSL|TLS|HTTPS|SOC ?2|256[- ]?bit|PCI[- ]?DSS|GDPR)|verified by|trust(ed)? badge|safe (and|&) secure)\b/i,
    rationale: 'trust / cryptographic signal phrasing' },
  { tag: 'guarantee',
    pattern: /\b((money[- ]?back|satisfaction|lifetime) (guarantee|warranty)|\d+[- ]?day (return|refund|money[- ]?back|guarantee|trial)|risk[- ]?free|no questions asked)\b/i,
    rationale: 'explicit promise of refund / outcome' },
  { tag: 'social_proof',
    pattern: /\b((\d{1,3}(,\d{3})+|\d+\s*(million|thousand|k\+?)|over\s+\d+)\s+(customers|users|companies|happy|reviews|sold|members|sign-?ups?|downloads?)|trusted by|loved by|join (the )?(\d|millions|thousands)|rated\s+\d(\.\d)?\s*\/?\s*\d?|\d+\s+stars?|as seen (in|on))\b/i,
    rationale: 'consensus / popularity signal (collapses authority per v0.2)' },
  { tag: 'value_prop',
    pattern: /\b(save\s+\$?\d|\d+%\s*off|free shipping|fast delivery|next[- ]?day( delivery)?|same[- ]?day|instant (access|delivery|download)|one[- ]?click|in (just )?\d+\s+(seconds?|minutes?))\b/i,
    rationale: 'concrete benefit or savings articulation' },
];

/** Centre-to-rect Euclidean distance (0 if rects overlap). */
function rectDistance(a: DOMRectLike, b: DOMRectLike): number {
  const dx = Math.max(b.left - a.right, a.left - b.right, 0);
  const dy = Math.max(b.top - a.bottom, a.top - b.bottom, 0);
  return Math.hypot(dx, dy);
}

/** Extract collapsed visible text from an element (innerText preferred). */
function readText(el: ElementLike): string {
  const raw = el.innerText !== undefined ? el.innerText : (el.textContent ?? '');
  return raw.replace(/\s+/g, ' ').trim();
}

/** Apply every regex; fall back to `other` for non-empty unmatched. */
function tagText(text: string): MicrocopyTag[] {
  const hits: MicrocopyTag[] = [];
  for (const { tag, pattern } of MICROCOPY_PATTERNS) {
    if (pattern.test(text)) hits.push(tag);
  }
  return hits.length === 0 ? ['other'] : hits;
}

/** Best-effort CSS-ish selector hint for a copy element. */
function selectorOf(el: ElementLike, fallback: string): string {
  const id = (el as { id?: string }).id;
  if (id) return `#${id}`;
  const cls = (el as { className?: string }).className;
  const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? 'el';
  if (typeof cls === 'string' && cls.trim().length > 0) {
    return `${tag}.${cls.trim().split(/\s+/)[0]}`;
  }
  return `${fallback} ~ ${tag}`;
}

/** Bound snippet length per MAX_SNIPPET_CHARS. */
function snippet(text: string): string {
  return text.length <= MAX_SNIPPET_CHARS
    ? text
    : `${text.slice(0, MAX_SNIPPET_CHARS - 1)}…`;
}

/** Candidate copy-bearing elements within PROXIMITY_PX of `ctaEl`. */
function collectNearby(doc: DocumentLike, ctaEl: ElementLike): ElementLike[] {
  if (typeof ctaEl.getBoundingClientRect !== 'function') return [];
  const ctaRect = ctaEl.getBoundingClientRect();
  const all = doc.querySelectorAll(CANDIDATE_SELECTOR);
  const out: ElementLike[] = [];
  for (let i = 0; i < all.length; i += 1) {
    const node = all[i];
    if (!node || node === ctaEl) continue;
    if (typeof node.getBoundingClientRect !== 'function') {
      out.push(node); // jsdom 0×0 rect — treat as near per AC-07 v0.2.
      continue;
    }
    if (rectDistance(ctaRect, node.getBoundingClientRect()) <= PROXIMITY_PX) {
      out.push(node);
    }
  }
  return out;
}

/** Per-CTA pass: resolve selector → gather snippets → emit entries. */
function tagOneCta(doc: DocumentLike, cta: Cta): NearCtaTag[] {
  let ctaEl: ElementLike | null = null;
  try {
    ctaEl = doc.querySelector(cta.selector);
  } catch {
    ctaEl = null;
  }
  if (!ctaEl) return [];
  const seen = new Set<string>();
  const out: NearCtaTag[] = [];
  for (const el of collectNearby(doc, ctaEl)) {
    const text = readText(el);
    if (text.length < MIN_TEXT_LENGTH || seen.has(text)) continue;
    seen.add(text);
    out.push({
      ctaIndex: cta.index,
      text: snippet(text),
      selector: selectorOf(el, cta.selector),
      tags: tagText(text),
    });
  }
  return out;
}

/**
 * Public entry. Pure / synchronous. Returns `{ nearCtaTags: [] }` when
 * `ctx.ctas[]` is empty, when no CTA selector resolves, or when no
 * candidate element sits within PROXIMITY_PX of any CTA. Signature
 * follows plan.md §2.2: `(doc, viewport, ctx) => Result`. `viewport`
 * is reserved for signature uniformity; tagging uses bounding-rect
 * distance only (R-07 "within 100px").
 */
export function extractMicrocopyTags(
  doc: DocumentLike,
  _viewport: Viewport,
  ctx: ExtractCtx,
): Microcopy {
  if (!ctx.ctas || ctx.ctas.length === 0) return { nearCtaTags: [] };
  const nearCtaTags: NearCtaTag[] = [];
  for (const cta of ctx.ctas) nearCtaTags.push(...tagOneCta(doc, cta));
  return { nearCtaTags };
}

/** Exposed for inspection / future heuristic-loader hooks (R6 — no IP leak). */
export const MICROCOPY_TAG_PATTERNS = MICROCOPY_PATTERNS;
