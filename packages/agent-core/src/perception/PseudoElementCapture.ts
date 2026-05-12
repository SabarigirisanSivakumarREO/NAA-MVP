/**
 * PseudoElementCapture — AC-04 / R-04 (REQ-BROWSE-PERCEPT-007).
 *
 * Captures text content from `::before` and `::after` pseudo-elements via
 * `getComputedStyle(el, '::before').content` and `getComputedStyle(el, '::after').content`.
 *
 * Skip rules (per AC-04 + R-04):
 *   - Empty content (`""`, `'""'`, `none`, `normal`) — carries no meaning.
 *   - Punctuation/symbol-only content (e.g., `"•"`, `"|"`, `","`) — no semantic meaning.
 *
 * Captured examples: `"NEW"`, `"BESTSELLER"`, required-field markers like `"* Required"`.
 *
 * Downstream: results merge into `FusedElement.text_content` (per R-04).
 *
 * Spec:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-04 + R-04
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-004
 *
 * Note on DOM types: the root tsconfig deliberately omits the `DOM` lib (this
 * is a Node-only library boundary). We declare minimal structural surrogates
 * for `Element` + `window.getComputedStyle` so the module typechecks without
 * pulling DOM globals project-wide. The test runs in jsdom (vitest default for
 * conformance tests), which provides real `Element` + `window`.
 */

/**
 * A single pseudo-element content entry.
 *
 * `which` is a closed enum — only `'before'` or `'after'` are valid per CSS
 * spec (other pseudo-elements like `::first-letter` don't carry semantic
 * `content`).
 *
 * `text` is the stripped, meaningful text content (CSS quotes removed; empty
 * + punctuation-only entries are filtered out before construction).
 */
export interface PseudoContent {
  which: 'before' | 'after';
  text: string;
}

/** Minimal structural shape of `CSSStyleDeclaration` we depend on. */
interface ComputedStyleLike {
  content: string;
}

/** Minimal structural shape of an element passed to `getComputedStyle`. */
type ElementLike = object;

/** Minimal structural shape of `window` we depend on. */
interface WindowLike {
  getComputedStyle(el: ElementLike, pseudo: string): ComputedStyleLike;
}

declare const window: WindowLike | undefined;

/**
 * Strip the surrounding CSS `content` quotes (`"..."` or `'...'`).
 *
 * jsdom + real browsers return `getComputedStyle(el, '::before').content` as a
 * raw CSS value, e.g., `'"NEW"'` (with literal quotes inside the string). We
 * strip one pair of surrounding quotes if present.
 */
function stripCssContentQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

/**
 * `true` if the (already-quote-stripped) content is empty, the literal `none`,
 * or composed only of Unicode punctuation/symbol/whitespace characters
 * (e.g., `•`, `|`, `,`).
 *
 * Rationale (AC-04): empty and decorative punctuation carry no semantic value
 * and would only pollute downstream text fusion.
 *
 * Mixed content like `"* Required"` is NOT filtered — the `Required` portion
 * is semantic. The pure-punctuation case (`"*"` alone) IS filtered (per spec's
 * "•" example).
 */
function isFilterableContent(text: string): boolean {
  if (text.length === 0) {
    return true;
  }
  if (text === 'none') {
    return true;
  }
  // \p{P} = Unicode punctuation, \p{S} = Unicode symbol, \s = whitespace.
  // Match if EVERY character is punctuation/symbol/whitespace → filter.
  return /^[\p{P}\p{S}\s]+$/u.test(text);
}

/**
 * Read `content` from a single pseudo-element and return the meaningful text,
 * or `null` if absent / empty / punctuation-only.
 */
function readPseudoContent(el: ElementLike, which: 'before' | 'after'): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const pseudo = `::${which}` as const;
  let raw: string;
  try {
    raw = window.getComputedStyle(el, pseudo).content;
  } catch {
    // Some environments (older jsdom) throw on pseudo-element queries.
    return null;
  }
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }
  if (raw === 'none' || raw === 'normal') {
    return null;
  }
  const stripped = stripCssContentQuotes(raw);
  if (isFilterableContent(stripped)) {
    return null;
  }
  return stripped;
}

/**
 * Capture `::before` and `::after` `content` text from an element.
 *
 * Returns a (possibly empty) array of `{which, text}` entries — one per
 * pseudo-element that contributes meaningful (non-empty, non-punctuation) text.
 *
 * @param element - DOM element to inspect.
 * @returns Array of meaningful pseudo-content entries; empty if none.
 */
export function capturePseudoElements(element: ElementLike): PseudoContent[] {
  const out: PseudoContent[] = [];
  const before = readPseudoContent(element, 'before');
  if (before !== null) {
    out.push({ which: 'before', text: before });
  }
  const after = readPseudoContent(element, 'after');
  if (after !== null) {
    out.push({ which: 'after', text: after });
  }
  return out;
}
