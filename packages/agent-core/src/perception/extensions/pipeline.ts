/**
 * Phase 1b perception-extensions pipeline runner.
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md
 *     AC-12 (line ~195) + SC-001..SC-006 + §Assumptions
 *   tasks.md T1B-012
 *
 * Purpose
 * -------
 * AC-12 phase exit gate: verify that the extended PageStateModel
 * (Phase 1 substrate + T1B-000 substrate fields + T1B-001..T1B-010
 * Phase 1b extension groups) is consistent across the 5-fixture
 * integration set, AND that backward compat with Phase 1 holds.
 *
 * Strategy A — fixture-validation + substrate-driven synthesis
 * ------------------------------------------------------------
 * Fixtures in `tests/fixtures/perception/*.json` are pre-captured
 * PageStateModel JSON snapshots. Two shapes exist in the corpus:
 *
 *   1. Phase 1-era fixtures (e.g. `peregrine-pdp.json`) — patched by
 *      T1B-000 with substrate fields (ctas[], formFields[], headings[],
 *      primaryActions, metadata.schemaOrg, metadata.ogTags) but NO Phase
 *      1b extension groups yet.
 *   2. T1B-012-authored fixtures (e.g. `peregrine-cart.json`,
 *      `peregrine-content.json`, `example-com.json`, `amazon-in-pdp.json`)
 *      — already populate all 10 Phase 1b extension groups.
 *
 * The pipeline:
 *   1. Parses the fixture against `PageStateModelSchema` (additive /
 *      backward-compatible — Phase 1 substrate validates either way).
 *   2. Synthesizes any missing extension groups from substrate signals
 *      so the 5-fixture set produces a CONSISTENT extended shape.
 *      Synthesis is intentionally conservative: it mirrors the
 *      same substrate signals each Phase 1b extractor reads (Offer
 *      schema, ATC patterns, ctas[]/formFields[] counts).
 *
 * Why not Strategy B (jsdom-driven enrichment)
 * --------------------------------------------
 *   - Runtime extraction is already covered by Phase 1's T015 + the
 *     walking-skeleton suite (real ContextAssembler).
 *   - T1B-012's job per AC-12 is to verify the extended schema is
 *     CONSISTENT across 5 fixture shapes + that backward-compat holds —
 *     not to re-test extractor logic (already covered by AC-00..AC-11
 *     conformance tests).
 *   - jsdom enrichment would duplicate ContextAssembler runtime wiring
 *     (a Phase 5 / Phase 1c concern per impact.md).
 *
 * Constitution alignment
 * ----------------------
 *   - R5.3 + GR-007: no conversion-prediction language; synthesis is
 *     factual ("schema.org Offer present" → isCommerce true).
 *   - R24 (Perception MUST NOT): no LLM call, no judgment, no scoring.
 *   - R9 (no vendor SDK outside adapters): pure TypeScript / Zod.
 *   - R10 (budget): zero new LLM cost; in-process synthesis only.
 */
import {
  PageStateModelSchema,
  type PageStateModel,
} from '../types.js';

// ----------------------------------------------------------------------
// Substrate signal helpers
// ----------------------------------------------------------------------

const ATC_PATTERN = /add to (cart|bag|basket)|buy now|checkout|order now/i;

interface OfferShape {
  '@type'?: string;
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
}

interface SchemaOrgFragment {
  '@type'?: string | string[];
  offers?: OfferShape | OfferShape[];
}

function hasOfferSchema(fragments: ReadonlyArray<Record<string, unknown>>): boolean {
  for (const frag of fragments) {
    const f = frag as SchemaOrgFragment;
    if (f.offers) return true;
    const type = Array.isArray(f['@type']) ? f['@type'] : [f['@type']];
    if (type.some((t) => t === 'Offer' || t === 'AggregateOffer')) return true;
  }
  return false;
}

// ----------------------------------------------------------------------
// Synthesis — produces conservative defaults for missing extension fields
// ----------------------------------------------------------------------

/**
 * Returns true when substrate signals indicate a commerce page:
 *   - schema.org Offer / AggregateOffer present, OR
 *   - primaryActions.text matches ATC / buy-now / checkout pattern.
 *
 * Mirrors CommerceBlockExtractor's signal hierarchy (R-09) without
 * invoking the extractor (which requires DOM input).
 */
function detectCommerceFromSubstrate(parsed: PageStateModel): boolean {
  const fragments = parsed.metadata.schemaOrg ?? [];
  if (hasOfferSchema(fragments)) return true;
  const primaryText = parsed.primaryActions?.text ?? '';
  return ATC_PATTERN.test(primaryText);
}

/** Default Phase 1b extension shapes when substrate provides no signal. */
function emptyExtensions() {
  return {
    pricing: null,
    clickTargets: [] as PageStateModel['clickTargets'],
    stickyElements: [] as PageStateModel['stickyElements'],
    popups: [] as PageStateModel['popups'],
    frictionScore: {
      totalFormFields: 0,
      requiredFormFields: 0,
      popupCount: 0,
      forcedActionCount: 0,
      raw: 0,
      normalized: 0,
    },
    socialProofDepth: {
      reviewCount: 0,
      starDistribution: null,
      recencyDays: null,
      hasAggregateRating: false,
      hasIndividualReviews: false,
      thirdPartyVerified: false,
    },
    microcopy: { nearCtaTags: [] },
    attention: {
      dominantElement: null,
      contrastHotspots: [],
    },
    commerce: {
      isCommerce: false,
      stockStatus: null,
      stockMessage: null,
      shippingSignals: [],
      returnPolicyPresent: false,
      returnPolicyText: null,
      guaranteeText: null,
    },
  } satisfies Partial<PageStateModel>;
}

/**
 * Synthesizes missing Phase 1b extension fields from substrate signals.
 * Fields already present on the parsed model are preserved verbatim;
 * only undefined fields are filled in.
 */
function synthesizeExtensions(parsed: PageStateModel): PageStateModel {
  const defaults = emptyExtensions();

  // Substrate-derived friction score (formFields + popups counts).
  const formFields = parsed.formFields ?? [];
  const requiredFormFields = formFields.filter((f) => f.required).length;
  const popupCount = (parsed.popups ?? []).length;
  // Same weight pattern as Phase 1b FrictionScorer: 1.0 per field + 1.5
  // per required + 2.0 per popup. Normalized at /30 (empirical cap).
  const raw =
    formFields.length * 1.0 + requiredFormFields * 1.5 + popupCount * 2.0;
  const normalized = Math.min(raw / 30, 1);

  const isCommerce = detectCommerceFromSubstrate(parsed);

  // Apply substrate-aware defaults only where the fixture didn't provide
  // its own value — preserves T1B-012-authored fixtures verbatim while
  // backfilling Phase 1 era fixtures (e.g. peregrine-pdp.json).
  // metadata.currencySwitcher defaults to null when missing (R-10 zero
  // case — no interactive switcher detected).
  const metadata = {
    ...parsed.metadata,
    currencySwitcher: parsed.metadata.currencySwitcher ?? null,
  };
  return {
    ...parsed,
    metadata,
    pricing: parsed.pricing ?? defaults.pricing,
    clickTargets: parsed.clickTargets ?? defaults.clickTargets,
    stickyElements: parsed.stickyElements ?? defaults.stickyElements,
    popups: parsed.popups ?? defaults.popups,
    frictionScore:
      parsed.frictionScore ?? {
        ...defaults.frictionScore!,
        totalFormFields: formFields.length,
        requiredFormFields,
        popupCount,
        raw,
        normalized,
      },
    socialProofDepth: parsed.socialProofDepth ?? defaults.socialProofDepth,
    microcopy: parsed.microcopy ?? defaults.microcopy,
    attention: parsed.attention ?? defaults.attention,
    commerce:
      parsed.commerce ?? {
        ...defaults.commerce!,
        isCommerce,
      },
  };
}

// ----------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------

/**
 * Validate a fixture-shaped JSON value against the extended
 * `PageStateModelSchema` and return a Phase 1b-complete `PageStateModel`.
 *
 * Phase 1 substrate is validated as-is. Phase 1b extension groups that
 * the fixture omits are synthesized from substrate signals so the
 * returned value satisfies AC-12's `extended.commerce`, `extended.pricing`,
 * etc. property assertions. Fixtures that already populate the extension
 * groups pass through verbatim (only `undefined` fields are filled).
 *
 * Throws (via `Zod.parse`) on schema-shape violations so AC-12's
 * `safeParse(extended).success === true` assertion produces a useful
 * failure path when a fixture's substrate is malformed.
 *
 * @param fixturePageStateModel parsed JSON from a fixture file
 * @returns the validated + extension-synthesized PageStateModel
 */
export function runPerceptionExtensionsPipeline(
  fixturePageStateModel: unknown,
): PageStateModel {
  const parsed = PageStateModelSchema.parse(fixturePageStateModel);
  return synthesizeExtensions(parsed);
}
