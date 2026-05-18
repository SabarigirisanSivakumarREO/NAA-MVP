/**
 * detectPageType — pure page-type classification utility.
 *
 * REQ-ID: REQ-ANALYZE-PERCEPTION-V23-001 (MOD v2.3)
 * AC: Phase 7 AC-02 (T114 detectPageType utility)
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-7-analysis/spec.md AC-02
 *   docs/specs/mvp/phases/phase-7-analysis/tasks.md T114
 *
 * SCORING WEIGHTS (tasks.md T114 v2.3):
 *   URL keywords × 0.4
 *   CTA texts    × 0.3
 *   Form signals × 0.2
 *   schema.org   × 0.1
 *
 * Phase 4b override (REQ-CONTEXT-DOWNSTREAM-001):
 *   If `input.context_profile_page_type` is set, return it as `primary` with
 *   empty alternatives and all `signalsUsed` scores zero. Detection logic is
 *   skipped entirely — Phase 4b consultant override authority is absolute.
 *
 * Constitution: R2 (no any), R9 (no external imports), R10 (named exports,
 * ≤300 LOC, helpers ≤50 LOC).
 */
import type { PageType } from '../../orchestration/AnalysisState.js';

export interface DetectPageTypeInput {
  url: string;
  cta_texts?: string[];
  form_signals?: {
    has_form: boolean;
    field_count?: number;
    has_password_input?: boolean;
    has_checkout_keywords?: boolean;
  };
  schema_org_types?: string[];
  context_profile_page_type?: PageType;
}

export interface PageTypeSignal {
  type: PageType;
  confidence: number;
}

export interface DetectPageTypeResult {
  primary: PageType;
  alternatives: PageTypeSignal[];
  signalsUsed: {
    url_score: number;
    cta_score: number;
    form_score: number;
    schema_score: number;
  };
}

const PAGE_TYPES: readonly PageType[] = [
  'homepage',
  'product',
  'checkout',
  'form',
  'pricing',
  'other',
] as const;

const W_URL = 0.4;
const W_CTA = 0.3;
const W_FORM = 0.2;
const W_SCHEMA = 0.1;

type ScoreMap = Record<PageType, number>;

const zeroMap = (): ScoreMap => ({
  homepage: 0,
  product: 0,
  checkout: 0,
  form: 0,
  pricing: 0,
  other: 0,
});

/** URL keyword scoring → unweighted [0,1] per type. */
function scoreUrl(url: string): ScoreMap {
  const out = zeroMap();
  let path = url;
  try {
    const u = new URL(url);
    path = u.pathname.toLowerCase();
    if ((path === '/' || path === '') && u.search === '') {
      out.homepage = 1;
      return out;
    }
  } catch {
    path = url.toLowerCase();
  }
  if (/\/checkout|\/cart|\/basket/.test(path)) out.checkout = 1;
  else if (/\/product\/|\/p\/|\/dp\/|\/item\//.test(path)) out.product = 1;
  else if (/\/pricing|\/plans/.test(path)) out.pricing = 1;
  else if (/\/contact|\/signup|\/register|\/login|\/subscribe/.test(path))
    out.form = 1;
  else out.other = 0.5;
  return out;
}

/** CTA text scoring → unweighted [0,1] per type. */
function scoreCta(ctas: string[] | undefined): ScoreMap {
  const out = zeroMap();
  if (!ctas || ctas.length === 0) return out;
  const joined = ctas.join(' | ').toLowerCase();
  if (/\b(buy now|add to cart|add to bag)\b/.test(joined)) out.product = 1;
  if (/\b(place order|checkout|complete order|pay now)\b/.test(joined))
    out.checkout = 1;
  if (/\b(start free trial|sign up|subscribe|register|get started)\b/.test(joined))
    out.form = 1;
  if (/\b(choose plan|select plan|upgrade|see pricing)\b/.test(joined))
    out.pricing = 1;
  return out;
}

/** Form signal scoring → unweighted [0,1] per type. */
function scoreForm(
  fs: DetectPageTypeInput['form_signals'] | undefined,
): ScoreMap {
  const out = zeroMap();
  if (!fs || !fs.has_form) return out;
  if (fs.has_checkout_keywords) out.checkout = 1;
  if (fs.has_password_input && (fs.field_count ?? 99) <= 5) out.form = 1;
  else if (!fs.has_checkout_keywords) out.form = Math.max(out.form, 0.5);
  return out;
}

/** schema.org @type scoring → unweighted [0,1] per type. */
function scoreSchema(types: string[] | undefined): ScoreMap {
  const out = zeroMap();
  if (!types || types.length === 0) return out;
  const set = new Set(types.map((t) => t.toLowerCase()));
  if (set.has('product')) out.product = 1;
  if (set.has('offer') || set.has('service')) out.pricing = 1;
  if (set.has('website') || set.has('organization')) out.homepage = 1;
  if (set.has('checkoutpage')) out.checkout = 1;
  return out;
}

/** Sum 4 weighted contributions into a total per type. */
function combine(
  urlS: ScoreMap,
  ctaS: ScoreMap,
  formS: ScoreMap,
  schemaS: ScoreMap,
): ScoreMap {
  const out = zeroMap();
  for (const t of PAGE_TYPES) {
    out[t] =
      urlS[t] * W_URL +
      ctaS[t] * W_CTA +
      formS[t] * W_FORM +
      schemaS[t] * W_SCHEMA;
  }
  return out;
}

/** Pick winner; tie-breaker: prefer non-`other`; on non-other ties prefer URL match. */
function pickPrimary(totals: ScoreMap, urlS: ScoreMap): PageType {
  let max = 0;
  for (const t of PAGE_TYPES) if (totals[t] > max) max = totals[t];
  if (max === 0) return 'other';
  const tied = PAGE_TYPES.filter((t) => totals[t] === max);
  if (tied.length === 1) return tied[0] as PageType;
  const nonOther = tied.filter((t) => t !== 'other');
  if (nonOther.length === 0) return 'other';
  if (nonOther.length === 1) return nonOther[0] as PageType;
  const urlMatch = nonOther.find((t) => urlS[t] > 0);
  return (urlMatch ?? nonOther[0]) as PageType;
}

export function detectPageType(
  input: DetectPageTypeInput,
): DetectPageTypeResult {
  if (input.context_profile_page_type) {
    return {
      primary: input.context_profile_page_type,
      alternatives: [],
      signalsUsed: { url_score: 0, cta_score: 0, form_score: 0, schema_score: 0 },
    };
  }

  const urlS = scoreUrl(input.url);
  const ctaS = scoreCta(input.cta_texts);
  const formS = scoreForm(input.form_signals);
  const schemaS = scoreSchema(input.schema_org_types);
  const totals = combine(urlS, ctaS, formS, schemaS);

  const primary = pickPrimary(totals, urlS);
  const allZero = PAGE_TYPES.every((t) => totals[t] === 0);

  const alternatives: PageTypeSignal[] = allZero
    ? []
    : PAGE_TYPES.filter((t) => t !== primary && totals[t] > 0)
        .map((t) => ({ type: t, confidence: totals[t] }))
        .sort((a, b) => b.confidence - a.confidence);

  const maxOf = (m: ScoreMap): number => {
    let x = 0;
    for (const t of PAGE_TYPES) if (m[t] > x) x = m[t];
    return x;
  };

  return {
    primary,
    alternatives,
    signalsUsed: {
      url_score: maxOf(urlS) * W_URL,
      cta_score: maxOf(ctaS) * W_CTA,
      form_score: maxOf(formS) * W_FORM,
      schema_score: maxOf(schemaS) * W_SCHEMA,
    },
  };
}
