/**
 * SubstrateExtension — Phase 1b T1B-000 (AC-00, REQ-ANALYZE-PERCEPTION-V24-001).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md R-00 + AC-00
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/plan.md §2.1-2.3
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-000
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/impact.md §11
 *
 * Populates the PageStateModel substrate fields that downstream Phase 1b
 * extractors (T1B-001..T1B-010) read via ExtractCtx:
 *   - ctas[]            — enumerated CTAs (buttons + button-role links + submit inputs)
 *   - formFields[]      — <input>/<select>/<textarea> enumeration
 *   - metadata.schemaOrg — parsed JSON-LD fragments
 *   - metadata.ogTags   — <meta property="og:*"> tag map
 *   - headings[]        — h1..h6 enumeration
 *   - primaryActions    — dominant CTA per page (nullable)
 *
 * Pure function — no global state, no Pino logging from inside (logs come
 * from ContextAssembler outside the evaluate boundary, R14). Serializable;
 * runs inside Playwright's `page.evaluate()` sandbox via
 * SUBSTRATE_EXTRACTION_SCRIPT in ContextAssembler.ts.
 *
 * R10 compliance:
 *   - File ≤ 300 lines (R10.1)
 *   - Functions ≤ 50 lines (R10.2)
 *   - Named exports only (R10.3)
 *   - No `any` (R13) — Document / Element typed via TS lib.dom
 *
 * R20 namespace contract (impact.md §11): substrate lands at top-level of
 * PageStateModel or inside `metadata`. NEVER under `_extensions.*` (that
 * namespace is reserved for Phase 7 DeepPerceiveNode).
 *
 * R24 perception MUST NOT: no judgment, no scoring of "good" vs "bad" CTAs.
 * primaryActions detection uses a deterministic structural heuristic, not
 * judgement — see PRIMARY_ACTION_TEXT_PATTERN + MIN_PROMINENT_CTA_*.
 */

import type {
  Cta,
  FormField,
  FormFieldType,
  Heading,
  PrimaryAction,
} from '../types.js';

/**
 * Minimal DOM types — agent-core's tsconfig does not include the DOM lib
 * (intentional; the package is mostly Node-side). The actual runtime
 * objects are real browser Document/Element instances injected by
 * Playwright's `page.evaluate()` sandbox; this module is also unit-
 * testable against jsdom (which satisfies the same shape).
 *
 * Only the subset of fields/methods actually used by this module is
 * declared. R10/R13: zero `any` — every leaf is explicit.
 */
interface DOMRectLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

interface ElementLike {
  readonly tagName: string;
  readonly id: string;
  readonly textContent: string | null;
  readonly innerText?: string;
  readonly parentElement: ElementLike | null;
  readonly children: ArrayLike<ElementLike>;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  getBoundingClientRect(): DOMRectLike;
}

interface DocumentLike {
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
}

// Minimal CSS.escape shim (declared at runtime by browsers; agent-core
// doesn't include DOM lib so we declare its existence here).
declare const CSS: { escape(value: string): string } | undefined;

/** Viewport size in CSS pixels — passed in from ContextAssembler. */
export interface Viewport {
  width: number;
  height: number;
}

/** Result returned by extractSubstrate (mirrored into PageStateModel). */
export interface SubstrateResult {
  ctas: Cta[];
  formFields: FormField[];
  schemaOrg: Array<Record<string, unknown>>;
  ogTags: Record<string, string>;
  headings: Heading[];
  primaryActions: PrimaryAction | null;
}

/**
 * NN-LL1 BINDING — primaryActions detection heuristic (per CLAUDE.md §13 +
 * spec R-00 prompt resolution):
 *
 *   1. The first <button type="submit"> within viewport, OR
 *   2. The first <button> whose visible text matches
 *      /add to (cart|bag|basket)|buy now|sign up|get started|subscribe|book now/i
 *      within viewport, FALLING BACK TO
 *   3. The first "prominent" <button> (≥ 100 × 40 CSS px) within viewport,
 *      FALLING BACK TO
 *   4. null.
 *
 * Rationale: deterministic, structural, no judgement (R24). "Add-to-bag"-
 * family verbs cover D2C/e-comm; "sign up / get started / subscribe / book
 * now" covers SaaS + lead-gen + booking; submit-button fallback covers
 * forms; size-prominence fallback covers branded outliers ("Configure",
 * "Order Now"). Tunable later via Phase 6 ContextProfile if needed.
 */
const PRIMARY_ACTION_TEXT_PATTERN =
  /add to (cart|bag|basket)|buy now|sign up|get started|subscribe|book now/i;

const MIN_PROMINENT_CTA_WIDTH_PX = 100;
const MIN_PROMINENT_CTA_HEIGHT_PX = 40;

/** Internal: extract visible text for an element (innerText fallback to textContent). */
function readVisibleText(el: ElementLike): string {
  const raw = el.innerText !== undefined ? el.innerText : (el.textContent ?? '');
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Build a stable-ish CSS selector for an element. Prefers `#id`, then
 * `tag[name="..."]`, then nth-of-type fallback. Best-effort: this is a
 * read-only structural reference, not a click target (Phase 5 owns that).
 */
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
  const idx = sibs.indexOf(el) + 1;
  return `${tag}:nth-of-type(${idx})`;
}

/** True if any part of the element's bounding-rect overlaps the viewport. */
function isInViewport(el: ElementLike, viewport: Viewport): boolean {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.right > 0 && r.top < viewport.height && r.left < viewport.width;
}

/** Build a Cta entry from an interactive element + assigned index. */
function makeCta(el: ElementLike, index: number): Cta {
  const r = el.getBoundingClientRect();
  const role = el.getAttribute('role');
  const cta: Cta = {
    index,
    text: readVisibleText(el),
    selector: buildSelector(el),
    sizePx: { width: r.width, height: r.height },
  };
  if (role) cta.role = role;
  return cta;
}

/**
 * Enumerate CTAs: <button>, [role="button"], <a role="button">, and
 * <input type="submit" | "button">.
 */
function collectCtas(doc: DocumentLike): Cta[] {
  const selector =
    'button, [role="button"], a[role="button"], input[type="submit"], input[type="button"]';
  const list = doc.querySelectorAll(selector);
  const out: Cta[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const el = list[i];
    if (el) out.push(makeCta(el, i));
  }
  return out;
}

/** Map an <input>/<select>/<textarea> element to a FormFieldType. */
function classifyFormField(el: ElementLike): FormFieldType {
  const tag = el.tagName.toLowerCase();
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'input') {
    const t = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (t === 'text' || t === 'email' || t === 'password' || t === 'tel') return t;
    if (t === 'checkbox') return 'checkbox';
    if (t === 'radio') return 'radio';
    return 'other';
  }
  return 'other';
}

/** Enumerate <input>/<select>/<textarea> entries with their required flag. */
function collectFormFields(doc: DocumentLike): FormField[] {
  const list = doc.querySelectorAll('input, select, textarea');
  const out: FormField[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const el = list[i];
    if (!el) continue;
    out.push({
      selector: buildSelector(el),
      type: classifyFormField(el),
      required: el.hasAttribute('required'),
    });
  }
  return out;
}

/**
 * Parse <script type="application/ld+json"> blocks. Malformed JSON is
 * silently skipped per spec R-00 ("tolerate parse errors silently"). Arrays
 * at the top level are flattened so each Offer/Product is one fragment.
 */
function collectSchemaOrg(doc: DocumentLike): Array<Record<string, unknown>> {
  const list = doc.querySelectorAll('script[type="application/ld+json"]');
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < list.length; i += 1) {
    const s = list[i];
    if (!s) continue;
    const raw = s.textContent;
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') out.push(item as Record<string, unknown>);
        }
      } else if (parsed && typeof parsed === 'object') {
        out.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Silently skip malformed JSON-LD blocks per spec R-00.
    }
  }
  return out;
}

/** Read <meta property="og:*"> tags into a flat Record. */
function collectOgTags(doc: DocumentLike): Record<string, string> {
  const list = doc.querySelectorAll('meta[property^="og:"]');
  const out: Record<string, string> = {};
  for (let i = 0; i < list.length; i += 1) {
    const m = list[i];
    if (!m) continue;
    const prop = m.getAttribute('property');
    const content = m.getAttribute('content');
    if (prop && content !== null) out[prop] = content;
  }
  return out;
}

/** Enumerate <h1>..<h6> elements with level + text + selector. */
function collectHeadings(doc: DocumentLike): Heading[] {
  const list = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const out: Heading[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const el = list[i];
    if (!el) continue;
    const lvl = Number.parseInt(el.tagName.substring(1), 10);
    if (lvl < 1 || lvl > 6) continue;
    out.push({
      level: lvl as 1 | 2 | 3 | 4 | 5 | 6,
      text: readVisibleText(el),
      selector: buildSelector(el),
    });
  }
  return out;
}

/**
 * Resolve `primaryActions` using the NN-LL1 BINDING heuristic. Returns
 * `null` when no candidate matches — downstream extractors must handle
 * the nullable case.
 */
function detectPrimaryActions(doc: DocumentLike, viewport: Viewport): PrimaryAction | null {
  const list = doc.querySelectorAll('button, input[type="submit"]');
  const inView: ElementLike[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const el = list[i];
    if (el && isInViewport(el, viewport)) inView.push(el);
  }

  // 1. First <button type="submit"> OR <input type="submit"> in viewport.
  const submitBtn = inView.find(
    (el) => (el.getAttribute('type') ?? '').toLowerCase() === 'submit',
  );
  if (submitBtn) {
    return { selector: buildSelector(submitBtn), text: readVisibleText(submitBtn) };
  }

  // 2. First <button> whose text matches the canonical-CTA regex.
  const canonical = inView.find((el) =>
    PRIMARY_ACTION_TEXT_PATTERN.test(readVisibleText(el)),
  );
  if (canonical) {
    return { selector: buildSelector(canonical), text: readVisibleText(canonical) };
  }

  // 3. First "prominent" <button> (≥ 100 × 40 px) in viewport.
  const prominent = inView.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width >= MIN_PROMINENT_CTA_WIDTH_PX && r.height >= MIN_PROMINENT_CTA_HEIGHT_PX;
  });
  if (prominent) {
    return { selector: buildSelector(prominent), text: readVisibleText(prominent) };
  }

  // 4. Fallback: null.
  return null;
}

/**
 * Top-level entry point. Pure function — no side effects, no logging from
 * inside. Runs both directly (jsdom unit-testable) and as a string payload
 * inside Playwright's `page.evaluate()` via ContextAssembler.
 */
export function extractSubstrate(doc: DocumentLike, viewport: Viewport): SubstrateResult {
  return {
    ctas: collectCtas(doc),
    formFields: collectFormFields(doc),
    schemaOrg: collectSchemaOrg(doc),
    ogTags: collectOgTags(doc),
    headings: collectHeadings(doc),
    primaryActions: detectPrimaryActions(doc, viewport),
  };
}
