/**
 * CurrencySwitcherDetector — Phase 1b T1B-010 (AC-10, REQ-ANALYZE-PERCEPTION-V24-001).
 *
 * Sources: spec.md R-10 + AC-10; plan.md §2.2 ExtractCtx; tasks.md T1B-010.
 *
 * Detects an INTERACTIVE currency-switcher widget (R-10):
 *   1. <select> whose name/id/class/aria-label hints at currency, OR
 *   2. <button>/[role=button] with currency-symbol/code text AND
 *      aria-haspopup OR aria-expanded (dropdown trigger), OR
 *   3. <input type=radio name="currency*"> radio-group.
 *
 * Passive currency LISTs (footer <ul>) return null. Out of Scope per spec:
 * account_menu / settings_modal location → mapped to `none` here; v1.1+ may
 * add tiers. Symbol→ISO-4217 ambiguity ($ could be USD/CAD/AUD): we prefer
 * explicit codes when present, else map $→USD, £→GBP, €→EUR, ¥→JPY, ₹→INR.
 * Pure function (R24). No `any` (R13). Local DOM types mirror SubstrateExtension.
 */

interface ElementLike {
  readonly tagName: string;
  readonly id: string;
  readonly className?: string;
  readonly textContent: string | null;
  readonly innerText?: string;
  readonly parentElement: ElementLike | null;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  closest?(selectors: string): ElementLike | null;
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
}

interface DocumentLike {
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
}

export interface Viewport {
  width: number;
  height: number;
}

/** ExtractCtx: currency switcher scans DOM directly (no substrate dep per plan §2.2). */
export interface ExtractCtx {
  metadata?: { schemaOrg?: unknown[]; ogTags?: Record<string, string> };
}

export interface CurrencySwitcher {
  present: true;
  currentCurrency: string;
  availableCurrencies: string[];
  isAccessibleAt: 'header' | 'footer' | 'none';
}

const CURRENCY_HINT_RE = /currency|curr[_-]?sel|fx\b/i;
const CURRENCY_CODE_RE =
  /\b(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR|SGD|HKD|NZD|SEK|NOK|DKK|MXN|BRL|ZAR|AED|KRW)\b/;
const SYMBOL_TO_CODE: Record<string, string> = {
  $: 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY', '₹': 'INR', '₩': 'KRW', '₣': 'CHF',
};

function readText(el: ElementLike): string {
  const raw = el.innerText !== undefined ? el.innerText : (el.textContent ?? '');
  return raw.trim().replace(/\s+/g, ' ');
}

/** Map a label (option text, button text) to an ISO-4217 code or null. */
function toCurrencyCode(raw: string): string | null {
  if (!raw) return null;
  const code = raw.match(CURRENCY_CODE_RE);
  if (code && code[1]) return code[1].toUpperCase();
  for (const [sym, iso] of Object.entries(SYMBOL_TO_CODE)) {
    if (raw.includes(sym)) return iso;
  }
  return null;
}

function isCurrencyHinted(el: ElementLike): boolean {
  const hay = `${el.id} ${el.getAttribute('name') ?? ''} ${el.className ?? ''} ${el.getAttribute('aria-label') ?? ''}`;
  return CURRENCY_HINT_RE.test(hay);
}

function locate(el: ElementLike): 'header' | 'footer' | 'none' {
  if (!el.closest) return 'none';
  if (el.closest('header, [role="banner"]')) return 'header';
  if (el.closest('footer, [role="contentinfo"]')) return 'footer';
  return 'none';
}

/** <select> path — strongest signal (Tier 1). */
function trySelect(doc: DocumentLike): CurrencySwitcher | null {
  const selects = doc.querySelectorAll('select');
  for (let i = 0; i < selects.length; i += 1) {
    const el = selects[i];
    if (!el || !isCurrencyHinted(el)) continue;
    const opts = el.querySelectorAll('option');
    const codes: string[] = [];
    let current: string | null = null;
    for (let j = 0; j < opts.length; j += 1) {
      const o = opts[j];
      if (!o) continue;
      const code = toCurrencyCode(o.getAttribute('value') || readText(o));
      if (!code) continue;
      codes.push(code);
      if (current === null && (o.hasAttribute('selected') || j === 0)) current = code;
    }
    if (codes.length >= 2 && current) {
      return { present: true, currentCurrency: current, availableCurrencies: codes, isAccessibleAt: locate(el) };
    }
  }
  return null;
}

/** <button>/[role=button] with aria-haspopup OR aria-expanded (Tier 2). */
function tryButton(doc: DocumentLike): CurrencySwitcher | null {
  const btns = doc.querySelectorAll('button, [role="button"]');
  for (let i = 0; i < btns.length; i += 1) {
    const el = btns[i];
    if (!el) continue;
    if (!el.hasAttribute('aria-haspopup') && !el.hasAttribute('aria-expanded')) continue;
    const current = toCurrencyCode(readText(el));
    if (!current) continue;
    const codes = new Set<string>([current]);
    const parent = el.parentElement;
    if (parent) {
      const items = parent.querySelectorAll('a, button, [role="menuitem"], [role="option"], li');
      for (let j = 0; j < items.length; j += 1) {
        const it = items[j];
        if (!it) continue;
        const c = toCurrencyCode(readText(it));
        if (c) codes.add(c);
      }
    }
    return { present: true, currentCurrency: current, availableCurrencies: [...codes], isAccessibleAt: locate(el) };
  }
  return null;
}

/** Radio-group with currency-hinted name (Tier 3). */
function tryRadio(doc: DocumentLike): CurrencySwitcher | null {
  const radios = doc.querySelectorAll('input[type="radio"]');
  const groups = new Map<string, ElementLike[]>();
  for (let i = 0; i < radios.length; i += 1) {
    const r = radios[i];
    if (!r) continue;
    const name = r.getAttribute('name') ?? '';
    if (!CURRENCY_HINT_RE.test(name)) continue;
    const list = groups.get(name) ?? [];
    list.push(r);
    groups.set(name, list);
  }
  for (const [, list] of groups) {
    const codes: string[] = [];
    let current: string | null = null;
    for (const r of list) {
      const code = toCurrencyCode(r.getAttribute('value') ?? '') ?? toCurrencyCode(readText(r));
      if (!code) continue;
      codes.push(code);
      if (current === null && r.hasAttribute('checked')) current = code;
    }
    const [first] = list;
    const [firstCode] = codes;
    if (codes.length >= 2 && first && firstCode) {
      return { present: true, currentCurrency: current ?? firstCode, availableCurrencies: codes, isAccessibleAt: locate(first) };
    }
  }
  return null;
}

/**
 * Tie-breaker on multiple candidates: select > button-with-haspopup > radio
 * (strongest interactive signal first; DOM-order within each tier — first match wins).
 */
export function extractCurrencySwitcher(
  doc: DocumentLike,
  _viewport: Viewport,
  _ctx: ExtractCtx,
): CurrencySwitcher | null {
  return trySelect(doc) ?? tryButton(doc) ?? tryRadio(doc);
}
