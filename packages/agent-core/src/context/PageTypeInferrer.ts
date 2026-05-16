/**
 * Phase 4b T4B-006 — PageTypeInferrer: cascade inference for the `page.type`
 * dimension of ContextProfile.
 *
 * Cascade order (first hit wins):
 *   1. URL pattern        — URLPatternMatcher       (source: 'url_pattern',     conf 0.9)
 *   2. JSON-LD @type      — JsonLdParser blocks     (source: 'schema_org',      conf 0.7-0.9)
 *   3. DOM/copy heuristic — cheerio-loaded HTML     (source: 'layout_inference', conf 0.5-0.7)
 *   4. Default            — 'home' + R25 silent-default ban (source: 'default', conf 0)
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.1.2
 *     (REQ-CONTEXT-DIM-PAGE-001 — cascade signal weighting)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-06 + R-13 + NF-04
 *     (≥0.7 confidence on 90% of fixtures; backward-compat with §07 §7.4)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-006 (L124-129)
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §2.6 (signal weighting)
 *   packages/agent-core/src/types/context-profile.ts — PageTypeEnum (LOCKED 12),
 *     ContextField<T>, ProvenanceEntry.
 *
 * # Backward compatibility (§07 §7.4 — R-13)
 *
 * The §07 §7.4 contract `AnalyzePerception.inferredPageType` is a `PageType`
 * value drawn from the LOCKED 12-value enum. Phase 4b consolidates the
 * inference logic here; the value space is identical, and Phase 5/7 consumers
 * read the same `PageType` value via `ContextProfile.page.type.value`. No
 * accessor change required at the Phase 5/7 read site (R-13 backward-compat).
 *
 * # Determinism (R25.1 item 10 — NO LLM judgment in MVP)
 *
 * Pure inference plumbing — no Anthropic SDK, no LLMAdapter, no Playwright.
 * Inputs are deterministic (URL string, fetched HTML string, parsed JSON-LD
 * blocks); the output is reproducible across runs.
 *
 * # Constitution compliance
 *
 * R10.1 file ≤ 300 LOC. R10.2 named exports only. R10.3 no `console.log`
 * (Pino logging happens upstream in ContextCaptureNode T4B-011 — keeps
 * inferrer pure and unit-testable without log capture).
 * R2 no `any` — `unknown` at the JSON-LD boundary, typed everywhere else.
 * R6 no heuristic body — pure dimension inference plumbing, no REO Digital
 * heuristic content references.
 * R9 zero vendor SDK imports outside `cheerio`, `./URLPatternMatcher.js`,
 * `./JsonLdParser.js`, `../types/context-profile.js`.
 * R25 NO Playwright import; NO LLMAdapter; default branch tagged
 * `source: 'default'` + `confidence: 0` — never silently optimistic.
 * R11.4/R20 — context-profile.ts shape NOT modified (LOCKED).
 */
import * as cheerio from 'cheerio';

import type { JsonLdBlock } from './JsonLdParser.js';
import { URLPatternMatcher } from './URLPatternMatcher.js';
import type {
  ContextField,
  PageType,
  ProvenanceEntry,
} from '../types/context-profile.js';

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface PageTypeInferrerInput {
  /** Page URL — primary signal (URLPatternMatcher). */
  readonly url: string;
  /** Fetched HTML — tertiary signal (DOM/copy heuristics via cheerio). */
  readonly html: string;
  /** Parsed JSON-LD blocks — secondary signal (schema.org @type mapping). */
  readonly jsonLdBlocks: ReadonlyArray<JsonLdBlock>;
}

export interface PageTypeInferrerResult {
  /** {value, source, confidence} per AC-01 universal field shape. */
  readonly type: ContextField<PageType>;
  /** Single audit-row provenance entry. */
  readonly provenance: ProvenanceEntry;
}

// ---------------------------------------------------------------------------
// JSON-LD @type → PageType mapping (LOCKED — extend via Phase 4b spec amendment)
// ---------------------------------------------------------------------------

/**
 * Schema.org `@type` → PageType lookup with per-mapping confidence.
 *
 * Confidence rationale:
 *   - 0.9 — checkout/post_purchase: schema.org defines explicit page types
 *     (CheckoutPage, OrderConfirmationPage) that are unambiguous when present.
 *   - 0.85 — Product / BlogPosting / Article: very strong indicator the page
 *     is a PDP / blog post (rare false positives in practice).
 *   - 0.7 — ItemList: maps to PLP but ItemList is also used for breadcrumbs,
 *     FAQs, and other lists; lower conf accounts for that ambiguity.
 *   - 0.6 — WebSite: only a hint that this MAY be the root home page.
 *
 * Order matters when multiple JSON-LD blocks are present: first mapped block
 * in iteration order wins (preserves caller-supplied JsonLdParser ordering).
 */
const JSON_LD_TYPE_MAP: ReadonlyMap<string, { pageType: PageType; confidence: number }> =
  new Map([
    ['Product', { pageType: 'PDP' as PageType, confidence: 0.85 }],
    ['ItemList', { pageType: 'PLP' as PageType, confidence: 0.7 }],
    ['BlogPosting', { pageType: 'blog' as PageType, confidence: 0.85 }],
    ['Article', { pageType: 'blog' as PageType, confidence: 0.85 }],
    ['NewsArticle', { pageType: 'blog' as PageType, confidence: 0.85 }],
    ['CheckoutPage', { pageType: 'checkout' as PageType, confidence: 0.9 }],
    ['OrderConfirmationPage', { pageType: 'post_purchase' as PageType, confidence: 0.9 }],
    ['WebSite', { pageType: 'home' as PageType, confidence: 0.6 }],
  ]);

// ---------------------------------------------------------------------------
// DOM/copy heuristics — applied in order; first hit wins
// ---------------------------------------------------------------------------

interface DomHeuristicHit {
  readonly pageType: PageType;
  readonly confidence: number;
  readonly signal: string;
}

/** checkout — credit-card form fields (cardnumber / cc-number / payment text). */
function detectCheckoutFromDom($: cheerio.CheerioAPI): DomHeuristicHit | null {
  const hasCardInput =
    $('input[name="cardnumber"]').length > 0 || $('input[name="cc-number"]').length > 0;
  if (hasCardInput) {
    return { pageType: 'checkout', confidence: 0.7, signal: 'cardnumber|cc-number input' };
  }
  const bodyText = $('body').text();
  if (/payment|card number/i.test(bodyText) && $('form').length > 0) {
    return { pageType: 'checkout', confidence: 0.7, signal: 'form + payment/card number copy' };
  }
  return null;
}

/** post_purchase — order confirmation copy. */
function detectPostPurchaseFromDom($: cheerio.CheerioAPI): DomHeuristicHit | null {
  const bodyText = $('body').text();
  if (/order\s+confirmation|thank\s+you\s+for\s+your\s+order/i.test(bodyText)) {
    return {
      pageType: 'post_purchase',
      confidence: 0.7,
      signal: 'order confirmation|thank you for your order',
    };
  }
  return null;
}

/** pricing — multiple "$X/mo" patterns + pricing/plan copy. */
function detectPricingFromDom($: cheerio.CheerioAPI): DomHeuristicHit | null {
  const bodyText = $('body').text();
  const hasPricingCopy = /(?:^|\s)pricing(?:\s|$)|choose\s+(?:a\s+)?plan/i.test(bodyText);
  const moMatches = bodyText.match(/\$\d+\/mo/g) ?? [];
  if (hasPricingCopy && moMatches.length >= 2) {
    return { pageType: 'pricing', confidence: 0.6, signal: `pricing copy + ${moMatches.length} $X/mo` };
  }
  return null;
}

/** comparison — "compare plans" / "side-by-side" copy. */
function detectComparisonFromDom($: cheerio.CheerioAPI): DomHeuristicHit | null {
  const bodyText = $('body').text();
  if (/compare\s+plans|side[-_\s]by[-_\s]side/i.test(bodyText)) {
    return { pageType: 'comparison', confidence: 0.55, signal: 'compare plans|side-by-side' };
  }
  return null;
}

/** landing — email-capture form + signup/get-started CTA copy. */
function detectLandingFromDom($: cheerio.CheerioAPI): DomHeuristicHit | null {
  const hasEmailInput = $('form input[name="email"]').length > 0;
  if (!hasEmailInput) return null;
  const bodyText = $('body').text();
  if (/sign\s*up|create\s+account|get\s+started/i.test(bodyText)) {
    return { pageType: 'landing', confidence: 0.5, signal: 'email form + signup/get-started copy' };
  }
  return null;
}

/** Ordered DOM detector chain — first hit wins. */
const DOM_DETECTORS: ReadonlyArray<(api: cheerio.CheerioAPI) => DomHeuristicHit | null> = [
  detectCheckoutFromDom,
  detectPostPurchaseFromDom,
  detectPricingFromDom,
  detectComparisonFromDom,
  detectLandingFromDom,
];

// ---------------------------------------------------------------------------
// Provenance helpers
// ---------------------------------------------------------------------------

interface ProvenanceArgs {
  readonly source: 'url_pattern' | 'schema_org' | 'layout_inference' | 'default';
  readonly confidence: number;
  readonly step: 'url_pattern' | 'json_ld' | 'dom' | 'default';
  readonly signal: string;
  readonly notes?: string;
}

function buildProvenance(args: ProvenanceArgs): ProvenanceEntry {
  return {
    dimension: 'page',
    source: args.source,
    inference_method: 'deterministic',
    confidence: args.confidence,
    inferred_at: new Date(),
    inferred_value: { step: args.step, signal: args.signal },
    ...(args.notes !== undefined ? { notes: args.notes } : {}),
  };
}

// ---------------------------------------------------------------------------
// PageTypeInferrer
// ---------------------------------------------------------------------------

/**
 * Cascade inference for the `page.type` dimension. Stateless — a single shared
 * instance is safe for concurrent use (URLPatternMatcher and cheerio.load are
 * also stateless / per-call isolated).
 */
export class PageTypeInferrer {
  readonly #urlMatcher: URLPatternMatcher;

  constructor(urlMatcher: URLPatternMatcher = new URLPatternMatcher()) {
    this.#urlMatcher = urlMatcher;
  }

  /**
   * Run the cascade. Returns `{type, provenance}` — never throws.
   *
   * Default branch (R25 silent-default ban): when no signal matches, returns
   * `'home'` with `source: 'default'` + `confidence: 0`. Downstream consumers
   * (ConfidenceScorer T4B-007 + OpenQuestionsBuilder T4B-008) treat conf 0 as
   * "ask the user" and surface a blocking question — never silently confident.
   */
  infer(input: PageTypeInferrerInput): PageTypeInferrerResult {
    // 1. URL pattern (primary)
    const urlHit = this.#tryUrlPattern(input.url);
    if (urlHit !== null) return urlHit;

    // 2. JSON-LD @type (secondary)
    const jsonLdHit = this.#tryJsonLd(input.jsonLdBlocks);
    if (jsonLdHit !== null) return jsonLdHit;

    // 3. DOM/copy heuristics (tertiary)
    const domHit = this.#tryDom(input.html);
    if (domHit !== null) return domHit;

    // 4. Default — R25 silent-default ban
    return this.#defaultResult();
  }

  #tryUrlPattern(url: string): PageTypeInferrerResult | null {
    const match = this.#urlMatcher.match(url);
    if (match.pageType === null) return null;
    const confidence = match.confidence;
    return {
      type: { value: match.pageType, source: 'url_pattern', confidence },
      provenance: buildProvenance({
        source: 'url_pattern',
        confidence,
        step: 'url_pattern',
        signal: match.matchedPattern ?? 'url_pattern hit',
        notes: `matched: ${match.matchedPattern ?? 'unknown'}`,
      }),
    };
  }

  #tryJsonLd(blocks: ReadonlyArray<JsonLdBlock>): PageTypeInferrerResult | null {
    for (const block of blocks) {
      const mapped = JSON_LD_TYPE_MAP.get(block.type);
      if (mapped === undefined) continue;
      return {
        type: { value: mapped.pageType, source: 'schema_org', confidence: mapped.confidence },
        provenance: buildProvenance({
          source: 'schema_org',
          confidence: mapped.confidence,
          step: 'json_ld',
          signal: `@type=${block.type}`,
          notes: `JSON-LD @type "${block.type}" → ${mapped.pageType}`,
        }),
      };
    }
    return null;
  }

  #tryDom(html: string): PageTypeInferrerResult | null {
    if (html.trim() === '') return null;
    const $ = cheerio.load(html);
    for (const detector of DOM_DETECTORS) {
      const hit = detector($);
      if (hit === null) continue;
      return {
        type: { value: hit.pageType, source: 'layout_inference', confidence: hit.confidence },
        provenance: buildProvenance({
          source: 'layout_inference',
          confidence: hit.confidence,
          step: 'dom',
          signal: hit.signal,
          notes: `DOM/copy: ${hit.signal}`,
        }),
      };
    }
    return null;
  }

  #defaultResult(): PageTypeInferrerResult {
    return {
      type: { value: 'home', source: 'default', confidence: 0 },
      provenance: buildProvenance({
        source: 'default',
        confidence: 0,
        step: 'default',
        signal: 'no URL pattern / JSON-LD / DOM signal matched',
        notes: 'R25 silent-default ban — confidence 0 surfaces blocking open_question downstream',
      }),
    };
  }
}

/** Top-level convenience — equivalent to `new PageTypeInferrer().infer(input)`. */
export function inferPageType(input: PageTypeInferrerInput): PageTypeInferrerResult {
  return new PageTypeInferrer().infer(input);
}
