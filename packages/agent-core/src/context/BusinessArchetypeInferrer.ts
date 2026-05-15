/**
 * Phase 4b T4B-005 — BusinessArchetypeInferrer: deterministic archetype
 * inference from JSON-LD + CTA copy + URL TLD signals per the LOCKED
 * 6-value BusinessArchetypeEnum.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.1.1
 *     (REQ-CONTEXT-DIM-BUSINESS-001 — JSON-LD + CTA copy + TLD signals)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-05 + R-07
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §2.6
 *     (signal weighting table — IMPLEMENTED VERBATIM)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-005 (L116-122)
 *   packages/agent-core/src/types/context-profile.ts — BusinessArchetypeEnum
 *     (LOCKED 6 values: D2C / B2B / SaaS / marketplace / lead_gen / service)
 *
 * # Contract (AC-05)
 *
 * `infer(input)` returns `{ archetype, provenance }`:
 *   - `archetype: ContextField<BusinessArchetype>` — `{value, source, confidence}`
 *   - `provenance: ProvenanceEntry` — single audit row tagged with the
 *     strongest contributing source (`schema_org` > `copy_inference` >
 *     `url_pattern` > `default`).
 *
 * # Algorithm (plan.md §2.6 verbatim)
 *
 * Per-signal weights aggregate per archetype. Final archetype = argmax
 * of summed weights. Confidence = winning weight, capped at 0.95.
 *
 *   - JSON-LD `@type` Product            → +0.4 D2C
 *   - JSON-LD `@type` SoftwareApplication → +0.4 SaaS
 *   - JSON-LD `@type` Service             → +0.4 service
 *   - Pricing pattern `/mo` or "per month" → +0.3 SaaS
 *   - "Add to cart/bag/basket" CTA       → +0.4 D2C
 *   - "Request demo/quote" CTA           → +0.4 B2B
 *   - "Start/begin free trial" CTA       → +0.3 SaaS
 *   - TLD `.shop` / `.store`             → +0.2 D2C
 *   - Price ≥$1K AND no ATC seen         → +0.2 B2B (mapped from "considered/B2B")
 *
 * Tie / close-call rule (gap <0.15 between top two): confidence forced
 * to 0.5. The OpenQuestionsBuilder downstream (T4B-008) uses the <0.6
 * threshold rule (ConfidenceThresholdActionEnum 'ask') to surface this
 * as a blocking open_question.
 *
 * # Default branch (R25 silent-default ban)
 *
 * Zero matched signals → `{archetype: {value:'service', source:'default',
 * confidence:0}, provenance: {source:'default', confidence:0, ...}}`.
 * Every default carries explicit provenance — no silent fallbacks.
 *
 * # `marketplace` / `lead_gen` archetypes
 *
 * §2.6 enumerates no deterministic signals for these. They remain in
 * the LOCKED 6-value enum for forward stability but will never win in
 * Phase 4b MVP — Phase 13b adds LLM-tag inference for them.
 *
 * # Constitution compliance
 *
 * R3.1 TDD: conformance test (AC-05) written first.
 * R10.1 file ≤ 300 LOC. R10.2 named exports only. R10.3 no console.log.
 * R2 no `any`. R6 no heuristic-content reference (pure plumbing).
 * R9 zero vendor SDK imports outside cheerio + JsonLdParser + types.
 * R14 no Pino import — pure inference, logging happens upstream in
 *   ContextCaptureNode (T4B-011).
 * R25 no Playwright import; no LLMAdapter import; no judgment fields
 *   (severity/impact/score/priority); every default tagged source:'default',
 *   confidence:0; T4B-014 AST scan verifies.
 */
import * as cheerio from 'cheerio';

import {
  type BusinessArchetype,
  BusinessArchetypeEnum,
  type ContextField,
  type ContextSource,
  type ProvenanceEntry,
} from '../types/context-profile.js';
import type { JsonLdBlock } from './JsonLdParser.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BusinessArchetypeInferrerInput {
  /** Page URL (used for TLD signal — `.shop` / `.store`). */
  readonly url: string;
  /** Raw HTML (used for CTA copy + price regex on visible text). */
  readonly html: string;
  /** JSON-LD blocks from JsonLdParser.parse() (AC-04 contract). */
  readonly jsonLdBlocks: ReadonlyArray<JsonLdBlock>;
}

export interface BusinessArchetypeInferrerResult {
  readonly archetype: ContextField<BusinessArchetype>;
  readonly provenance: ProvenanceEntry;
}

// ---------------------------------------------------------------------------
// Detection regexes (compiled once)
// ---------------------------------------------------------------------------

/** "Add to cart/bag/basket" CTA copy — case-insensitive. */
const ATC_CTA_RE = /\badd\s+to\s+(?:cart|bag|basket)\b/i;
/** "Request demo/quote" CTA copy — case-insensitive. */
const DEMO_CTA_RE = /\brequest\s+(?:a\s+)?(?:demo|quote)\b/i;
/** "Start/begin free trial" CTA copy. */
const TRIAL_CTA_RE = /\b(?:start|begin)\s+(?:a\s+)?(?:free\s+)?trial\b/i;
/** Pricing pattern: `$29/mo`, `$29 / mo`, etc. */
const PRICE_PER_MO_RE = /\$\d+(?:\.\d+)?\s*\/?\s*mo\b/i;
/** Pricing pattern: "per month" / "/month". */
const PER_MONTH_RE = /per\s+month/i;
/** Numeric price extraction: matches `$1,499` or `$1499.00`. */
const PRICE_NUM_RE = /\$([\d,]+)(?:\.\d{2})?/g;
/** TLD signal — hostname ends with `.shop` or `.store`. */
const TLD_RE = /\.(shop|store)$/i;
/** High-price threshold for B2B fallback signal. */
const HIGH_PRICE_THRESHOLD = 1000;
/** Cap on max confidence per §2.6. */
const MAX_CONFIDENCE = 0.95;
/** Close-call gap threshold per §2.6 — below this, confidence forced to 0.5. */
const TIE_GAP_THRESHOLD = 0.15;
/** Forced confidence on tie/close-call per §2.6. */
const TIE_CONFIDENCE = 0.5;

// ---------------------------------------------------------------------------
// Internal aggregation state
// ---------------------------------------------------------------------------

/**
 * Per-archetype weight accumulator. Initialized to 0 for the LOCKED 6.
 * Using `Record<BusinessArchetype, number>` keeps the type tight without
 * mutating the enum.
 */
function emptyScores(): Record<BusinessArchetype, number> {
  return {
    D2C: 0,
    B2B: 0,
    SaaS: 0,
    marketplace: 0,
    lead_gen: 0,
    service: 0,
  };
}

/**
 * Strongest source ranking — used to pick the provenance.source when
 * multiple signal categories contributed. Higher-ranked sources win.
 */
const SOURCE_RANK: Record<Exclude<ContextSource, 'user' | 'layout_inference' | 'default'>, number> = {
  schema_org: 3,
  copy_inference: 2,
  url_pattern: 1,
};

// ---------------------------------------------------------------------------
// Inferrer
// ---------------------------------------------------------------------------

/**
 * Pure deterministic archetype inferrer. Stateless — safe for concurrent
 * use. The single shared `infer()` method is the only public surface.
 */
export class BusinessArchetypeInferrer {
  infer(input: BusinessArchetypeInferrerInput): BusinessArchetypeInferrerResult {
    const scores = emptyScores();
    const matched: string[] = [];
    /** Tracks which source categories contributed to the winning signal. */
    const contributingSources = new Set<keyof typeof SOURCE_RANK>();

    // 1. JSON-LD signals (+0.4 each).
    let sawProductJsonLd = false;
    for (const block of input.jsonLdBlocks) {
      if (block.type === 'Product') {
        scores.D2C += 0.4;
        matched.push('jsonld:Product');
        contributingSources.add('schema_org');
        sawProductJsonLd = true;
      } else if (block.type === 'SoftwareApplication') {
        scores.SaaS += 0.4;
        matched.push('jsonld:SoftwareApplication');
        contributingSources.add('schema_org');
      } else if (block.type === 'Service') {
        scores.service += 0.4;
        matched.push('jsonld:Service');
        contributingSources.add('schema_org');
      }
    }

    // 2. Visible-text-derived signals — extract once via cheerio.
    const visibleText = extractVisibleText(input.html);

    // CTA: "Add to cart/bag/basket" → +0.4 D2C
    const sawAtcCta = ATC_CTA_RE.test(visibleText);
    if (sawAtcCta) {
      scores.D2C += 0.4;
      matched.push('cta:add_to_cart');
      contributingSources.add('copy_inference');
    }

    // CTA: "Request demo/quote" → +0.4 B2B
    if (DEMO_CTA_RE.test(visibleText)) {
      scores.B2B += 0.4;
      matched.push('cta:request_demo');
      contributingSources.add('copy_inference');
    }

    // CTA: "Start/begin free trial" → +0.3 SaaS
    if (TRIAL_CTA_RE.test(visibleText)) {
      scores.SaaS += 0.3;
      matched.push('cta:free_trial');
      contributingSources.add('copy_inference');
    }

    // Pricing pattern: `/mo` or "per month" → +0.3 SaaS
    if (PRICE_PER_MO_RE.test(visibleText) || PER_MONTH_RE.test(visibleText)) {
      scores.SaaS += 0.3;
      matched.push('price:per_month');
      contributingSources.add('copy_inference');
    }

    // High-price + no ATC → +0.2 B2B (per §2.6 "considered/B2B" mapping)
    if (!sawAtcCta && hasHighPrice(visibleText)) {
      scores.B2B += 0.2;
      matched.push('price:high_no_atc');
      contributingSources.add('copy_inference');
    }

    // 3. TLD signal: `.shop` / `.store` → +0.2 D2C
    if (matchesShopTld(input.url)) {
      scores.D2C += 0.2;
      matched.push('tld:shop_or_store');
      contributingSources.add('url_pattern');
    }

    // Suppress unused-binding lint while keeping the local for future use.
    void sawProductJsonLd;

    // 4. Aggregate → pick winner + apply tie/cap/default rules.
    return assemble(scores, matched, contributingSources);
  }
}

// ---------------------------------------------------------------------------
// Aggregation helpers (kept ≤50 LOC each per R10.1)
// ---------------------------------------------------------------------------

/**
 * Pick the winning archetype, apply close-call + cap rules, and assemble
 * the provenance row. Returns the final `{archetype, provenance}` pair.
 */
function assemble(
  scores: Record<BusinessArchetype, number>,
  matched: string[],
  contributingSources: Set<keyof typeof SOURCE_RANK>,
): BusinessArchetypeInferrerResult {
  const inferredAt = new Date();

  // Sorted [archetype, weight] pairs descending by weight.
  const ranked = (Object.keys(scores) as BusinessArchetype[])
    .map((a) => [a, scores[a]] as const)
    .sort((a, b) => b[1] - a[1]);

  const top = ranked[0]!;
  const second = ranked[1]!;

  // Default branch — zero signals matched.
  if (top[1] === 0) {
    return {
      archetype: { value: 'service', source: 'default', confidence: 0 },
      provenance: {
        dimension: 'business',
        source: 'default',
        inference_method: 'deterministic',
        confidence: 0,
        inferred_at: inferredAt,
        inferred_value: { candidate_scores: scores, matched_signals: matched },
        notes: 'No deterministic signals matched; defaulted to service.',
      },
    };
  }

  // Compute confidence: capped at MAX_CONFIDENCE; forced to 0.5 on close call.
  const gap = top[1] - second[1];
  const cappedTop = Math.min(top[1], MAX_CONFIDENCE);
  const confidence = gap < TIE_GAP_THRESHOLD ? TIE_CONFIDENCE : cappedTop;

  // Pick provenance.source = highest-ranked contributing source.
  const source = pickStrongestSource(contributingSources);
  const archetype = BusinessArchetypeEnum.parse(top[0]);

  return {
    archetype: { value: archetype, source, confidence },
    provenance: {
      dimension: 'business',
      source,
      inference_method: 'deterministic',
      confidence,
      inferred_at: inferredAt,
      inferred_value: { candidate_scores: scores, matched_signals: matched },
      notes: buildNotes(archetype, matched, gap < TIE_GAP_THRESHOLD),
    },
  };
}

/** Rank sources; return the highest-ranked contributor. */
function pickStrongestSource(
  contributingSources: Set<keyof typeof SOURCE_RANK>,
): ContextSource {
  let best: keyof typeof SOURCE_RANK | null = null;
  let bestRank = -1;
  for (const s of contributingSources) {
    const rank = SOURCE_RANK[s];
    if (rank > bestRank) {
      best = s;
      bestRank = rank;
    }
  }
  return best ?? 'default';
}

/** Build a short human-readable provenance note. */
function buildNotes(
  archetype: BusinessArchetype,
  matched: string[],
  closeCall: boolean,
): string {
  const sigList = matched.length > 0 ? matched.join(' + ') : 'no signals';
  const tieFlag = closeCall ? ' (close call — confidence forced to 0.5)' : '';
  return `${archetype} from ${sigList}${tieFlag}`;
}

/**
 * Strip script/style content and collapse to text. cheerio.load is the same
 * permissive parser used by JsonLdParser, so SPA shells and malformed HTML
 * don't throw. We DO NOT remove `<button>`/`<a>` content — CTA copy lives
 * inside those nodes.
 */
function extractVisibleText(html: string): string {
  if (html.length === 0) return '';
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();
  return $('body').length > 0 ? $('body').text() : $.root().text();
}

/**
 * Returns true if any extracted price ≥ $1000. Tolerates `$1,499` thousands
 * separator. Returns false on empty / non-matching text.
 */
function hasHighPrice(text: string): boolean {
  // Reset regex lastIndex (global flag persists state).
  PRICE_NUM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PRICE_NUM_RE.exec(text)) !== null) {
    const numeric = Number(match[1]!.replace(/,/g, ''));
    if (Number.isFinite(numeric) && numeric >= HIGH_PRICE_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if the URL hostname ends with `.shop` or `.store`.
 * Defensive: malformed URLs silently return false (caller still emits
 * a result via other signals or the default branch).
 */
function matchesShopTld(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return TLD_RE.test(hostname);
  } catch {
    return false;
  }
}
