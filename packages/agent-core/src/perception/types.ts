/**
 * PageStateModel — canonical perception output Zod schemas.
 *
 * Sources:
 *   Phase 1  — docs/specs/mvp/phases/phase-1-perception/{spec,plan,tasks,impact}.md
 *              (T014 + AC-09 + R-04 + REQ-BROWSE-PERCEPT-001).
 *   Phase 1b — docs/specs/mvp/phases/phase-1b-perception-extensions/{spec.md AC-00/AC-11,
 *              plan.md §2.3} (T1B-000 substrate + T1B-001..T1B-010 + T1B-011 schema closure).
 *
 * Consumed by: ContextAssembler (T013), Phase 1b extractors (T1B-001..T1B-010),
 *   browser_get_state MCP tool (Phase 2), Browse MVP (Phase 5),
 *   deep_perceive (Phase 7 — uses `_extensions.deepPerceive` namespace).
 *
 * Invariants:
 *   - All sub-schemas .strict(); PageStateModelSchema .strict() with reserved
 *     `_extensions` namespace (Phase 7+; Phase 1/1b MUST NOT populate).
 *   - Phase 1b additions are optional/nullable — Peregrine fixture parses
 *     identically before/after T1B-011 closure (AC-11 backward compat).
 *   - Popup behavior fields (isEscapeDismissible, isClickOutsideDismissible)
 *     are literal `z.null()` per spec R-04 — Phase 5b owns runtime probing.
 *   - Zero z.any() (SC-005); named exports only (R10.3).
 */
import { z } from 'zod';

// ----------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------

/**
 * AccessibilityNode recursion depth limit. Prevents infinite recursion on
 * aria-owns cycles during parse + bounds the tree size for the
 * shrink-ladder Stage 1 (depth 10 → 6).
 *
 * Source: tasks.md T014 constraints; plan.md design item 7.
 */
export const MAX_AX_TREE_DEPTH = 10;

/** Minimum depth (used by ContextAssembler shrink ladder Stage 1). */
export const MIN_AX_TREE_DEPTH = 6;

/** PageStateModel total token budget per NF-Phase1-01. */
export const PAGE_STATE_MODEL_TOKEN_BUDGET = 20_000;

/** ScreenshotExtractor cap per NF-Phase1-04 (150 KB). */
export const SCREENSHOT_MAX_BYTES = 153_600;

/** ScreenshotExtractor max width per spec AC-07 + R-09. */
export const SCREENSHOT_MAX_WIDTH = 1280;

// ----------------------------------------------------------------------
// Primitive sub-schemas
// ----------------------------------------------------------------------

/** Element bounding box (px relative to viewport top-left). */
export const BoundingBoxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().min(0),
    height: z.number().min(0),
  })
  .strict();

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

// ----------------------------------------------------------------------
// AccessibilityNode (recursive via z.lazy)
// ----------------------------------------------------------------------

/**
 * Accessibility tree node. Recursive — depth bounded at extraction time
 * via {@link checkAxTreeDepth} (NOT by Zod itself; z.lazy can't enforce).
 *
 * Field set follows Playwright's AccessibilityNode shape (subset that
 * Phase 1 extractors actually use). Strict — extra Playwright fields are
 * dropped at extraction boundary, NOT preserved through the schema.
 *
 * Why `field: T | undefined` instead of `field?: T`: tsconfig sets
 * `exactOptionalPropertyTypes: true`, which makes the two NOT equivalent.
 * Zod `.optional()` infers `T | undefined`; matching that explicitly here
 * keeps the manual type compatible with `z.ZodType<AccessibilityNode>`.
 */
export type AccessibilityNode = {
  role: string;
  name?: string | undefined;
  value?: string | undefined;
  description?: string | undefined;
  level?: number | undefined;
  expanded?: boolean | undefined;
  required?: boolean | undefined;
  selected?: boolean | undefined;
  hidden?: boolean | undefined;
  disabled?: boolean | undefined;
  focused?: boolean | undefined;
  boundingBox?: BoundingBox | undefined;
  children?: AccessibilityNode[] | undefined;
};

export const AccessibilityNodeSchema: z.ZodType<AccessibilityNode> = z.lazy(() =>
  z
    .object({
      role: z.string(),
      name: z.string().optional(),
      value: z.string().optional(),
      description: z.string().optional(),
      level: z.number().int().optional(),
      expanded: z.boolean().optional(),
      required: z.boolean().optional(),
      selected: z.boolean().optional(),
      hidden: z.boolean().optional(),
      disabled: z.boolean().optional(),
      focused: z.boolean().optional(),
      boundingBox: BoundingBoxSchema.optional(),
      children: z.array(AccessibilityNodeSchema).optional(),
    })
    .strict(),
);

/**
 * Walks an AccessibilityNode tree and returns true if any branch exceeds
 * `maxDepth`. Use BEFORE z.parse on untrusted input to prevent z.lazy
 * from recursing into a cyclic / malicious tree (stack overflow guard).
 *
 * Cycle detection: tracks visited node identity; a repeated reference is
 * treated as exceeding depth.
 */
export function checkAxTreeDepth(
  root: unknown,
  maxDepth: number = MAX_AX_TREE_DEPTH,
): { ok: true } | { ok: false; reason: 'depth-exceeded' | 'cycle-detected' } {
  const visited = new WeakSet<object>();
  function walk(node: unknown, depth: number): { ok: true } | { ok: false; reason: 'depth-exceeded' | 'cycle-detected' } {
    if (depth > maxDepth) return { ok: false, reason: 'depth-exceeded' };
    if (node === null || typeof node !== 'object') return { ok: true };
    if (visited.has(node)) return { ok: false, reason: 'cycle-detected' };
    visited.add(node);
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        const r = walk(child, depth + 1);
        if (!r.ok) return r;
      }
    }
    return { ok: true };
  }
  return walk(root, 0);
}

// ----------------------------------------------------------------------
// AccessibilityTree (root + total node count)
// ----------------------------------------------------------------------

export const AccessibilityTreeSchema = z
  .object({
    root: AccessibilityNodeSchema,
    totalNodes: z.number().int().min(0),
  })
  .strict();

export type AccessibilityTree = z.infer<typeof AccessibilityTreeSchema>;

// ----------------------------------------------------------------------
// FilteredDOM (top-30 ranked elements from SoftFilter)
// ----------------------------------------------------------------------

/** A single ranked element produced by SoftFilter (T010). */
export const FilteredElementSchema = z
  .object({
    /** Selector or AX-tree ref string (extractor-defined). */
    ref: z.string(),
    role: z.string(),
    /** Visible text content (truncated by extractor if long). */
    text: z.string(),
    /** Multiplicative-decay relevance score in (0, 1] per R4.4. */
    score: z.number().gt(0).max(1),
    boundingBox: BoundingBoxSchema,
  })
  .strict();

export type FilteredElement = z.infer<typeof FilteredElementSchema>;

export const FilteredDOMSchema = z
  .object({
    /** Top-30 elements descending by score; capped at 30 (shrink Stage 2 → 20). */
    top30: z.array(FilteredElementSchema).max(30),
  })
  .strict();

export type FilteredDOM = z.infer<typeof FilteredDOMSchema>;

// ----------------------------------------------------------------------
// InteractiveGraph (clickable / typeable / submittable indices)
// ----------------------------------------------------------------------

export const InteractiveGraphSchema = z
  .object({
    clickable: z.array(z.string()),
    typeable: z.array(z.string()),
    submittable: z.array(z.string()),
  })
  .strict();

export type InteractiveGraph = z.infer<typeof InteractiveGraphSchema>;

// ----------------------------------------------------------------------
// Visual (optional screenshot reference)
// ----------------------------------------------------------------------

export const VisualSchema = z
  .object({
    format: z.literal('jpeg'),
    sizeBytes: z.number().int().min(0).max(SCREENSHOT_MAX_BYTES),
    width: z.number().int().min(0).max(SCREENSHOT_MAX_WIDTH),
    height: z.number().int().min(0),
    /** Storage URL (Phase 4 R2 or local filesystem path). */
    url: z.string().optional(),
    /** Inline base64 (dev-only; Phase 4 prefers url). */
    base64: z.string().optional(),
  })
  .strict();

export type Visual = z.infer<typeof VisualSchema>;

// ----------------------------------------------------------------------
// Diagnostics (per spec Key Entities — warnings + errors arrays + flags)
// ----------------------------------------------------------------------

export const DiagnosticsSchema = z
  .object({
    axNodeCount: z.number().int().min(0),
    mutationsObserved: z.number().int().min(0),
    stable: z.boolean(),
    lowAxNodeCount: z.boolean().default(false),
    unstable: z.boolean().default(false),
    /** Errors collected during capture (oversize-after-shrink, etc.). */
    errors: z.array(z.string()).default([]),
    /** Non-fatal warnings (shrunk-from-N-tokens, etc.). */
    warnings: z.array(z.string()).default([]),
  })
  .strict();

export type Diagnostics = z.infer<typeof DiagnosticsSchema>;

// ----------------------------------------------------------------------
// Phase 1b T1B-010 CurrencySwitcher (nested inside Metadata)
// ----------------------------------------------------------------------

/** AC-10 / R-10 location — closed enum. */
export const CurrencySwitcherLocationSchema = z.enum(['header', 'footer', 'none']);
export type CurrencySwitcherLocation = z.infer<typeof CurrencySwitcherLocationSchema>;

/**
 * AC-10 / T1B-010 — `null` at parent level signals absence (R-10);
 * this schema models the populated case (present is literal true).
 */
export const CurrencySwitcherSchema = z
  .object({
    present: z.literal(true),
    currentCurrency: z.string(),
    availableCurrencies: z.array(z.string()),
    isAccessibleAt: CurrencySwitcherLocationSchema,
  })
  .strict();
export type CurrencySwitcher = z.infer<typeof CurrencySwitcherSchema>;

// ----------------------------------------------------------------------
// Metadata
// ----------------------------------------------------------------------

export const MetadataSchema = z
  .object({
    url: z.string().url(),
    title: z.string(),
    statusCode: z.number().int().min(100).max(599),
    /** ISO-8601 navigation start timestamp. */
    navigationStartedAt: z.string().datetime(),
    /** ISO-8601 navigation end timestamp. */
    navigationEndedAt: z.string().datetime(),
    // ----- Phase 1b T1B-000 substrate additions (additive; optional for Phase 1 backward compat) -----
    /**
     * Parsed JSON-LD fragments from <script type="application/ld+json">.
     * Each fragment is an arbitrary JSON-LD object — malformed scripts are
     * silently skipped at extraction time. T1B-000 substrate.
     */
    schemaOrg: z.array(z.record(z.unknown())).optional(),
    /** <meta property="og:*"> tag map. T1B-000 substrate. */
    ogTags: z.record(z.string()).optional(),
    /**
     * Phase 1b T1B-010 currency-switcher block. `null` when no interactive
     * switcher detected (R-10 Edge Case); populated CurrencySwitcher shape
     * otherwise. Closed by T1B-011.
     */
    currencySwitcher: CurrencySwitcherSchema.nullable().optional(),
  })
  .strict();

export type Metadata = z.infer<typeof MetadataSchema>;

// ----------------------------------------------------------------------
// Phase 1b T1B-000 substrate sub-schemas
// ----------------------------------------------------------------------

/** Bounding-rect size of a CTA / form element in CSS pixels. */
export const SizePxSchema = z
  .object({
    width: z.number().min(0),
    height: z.number().min(0),
  })
  .strict();

export type SizePx = z.infer<typeof SizePxSchema>;

/**
 * Single CTA entry — enumerated by T1B-000 SubstrateExtension. Downstream
 * extractors (T1B-002/003/007/009) reference CTAs by `index`.
 */
export const CtaSchema = z
  .object({
    index: z.number().int().min(0),
    text: z.string(),
    selector: z.string(),
    sizePx: SizePxSchema,
    role: z.string().optional(),
  })
  .strict();

export type Cta = z.infer<typeof CtaSchema>;

/** Form-field type taxonomy (T1B-000 substrate; consumed by T1B-005). */
export const FormFieldTypeSchema = z.enum([
  'text',
  'email',
  'password',
  'tel',
  'select',
  'textarea',
  'checkbox',
  'radio',
  'other',
]);

export type FormFieldType = z.infer<typeof FormFieldTypeSchema>;

export const FormFieldSchema = z
  .object({
    selector: z.string(),
    type: FormFieldTypeSchema,
    required: z.boolean(),
  })
  .strict();

export type FormField = z.infer<typeof FormFieldSchema>;

/** Heading entry (h1..h6) — T1B-000 substrate. */
export const HeadingSchema = z
  .object({
    level: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    text: z.string(),
    selector: z.string(),
  })
  .strict();

export type Heading = z.infer<typeof HeadingSchema>;

/** Dominant CTA per page (T1B-000 substrate); null when none meets the heuristic. */
export const PrimaryActionSchema = z
  .object({
    selector: z.string(),
    text: z.string(),
  })
  .strict();

export type PrimaryAction = z.infer<typeof PrimaryActionSchema>;

// ----------------------------------------------------------------------
// Phase 1b T1B-001..T1B-010 extension sub-schemas (T1B-011 closure)
// ----------------------------------------------------------------------
// Per-extractor strict shapes. Stage 2.5 fix F-001 — `displayFormat` and
// `taxInclusion` are closed enums sourced from PricingExtractor (single
// source of truth). Sticky `type` remains open per spec R-03.
// All groups optional/nullable at the parent — Phase 1 backward compat.

/**
 * Closed enum for pricing display layout (PricingExtractor canonical list).
 * `plain` = no anchor + no discount annotation
 * `comparison` = neutral side-by-side comparison
 * `crossed-out` = anchor (strike-through original) + sale price
 * `with-discount` = explicit "% off" / "save $N" annotation visible
 */
export const PricingDisplayFormatSchema = z.enum([
  'plain', 'comparison', 'crossed-out', 'with-discount',
]);
export type PricingDisplayFormat = z.infer<typeof PricingDisplayFormatSchema>;

/** Closed enum for tax inclusion (PricingExtractor canonical list). */
export const TaxInclusionSchema = z.enum(['inclusive', 'exclusive', 'unknown']);
export type TaxInclusion = z.infer<typeof TaxInclusionSchema>;

/** AC-01 / T1B-001 — null at parent when no pricing detected. */
export const PricingSchema = z
  .object({
    displayFormat: PricingDisplayFormatSchema,
    amount: z.string(),
    amountNumeric: z.number(),
    currency: z.string(),
    taxInclusion: TaxInclusionSchema,
    anchorPrice: z.string().nullable(),
    discountPercent: z.number().nullable(),
    comparisonShown: z.boolean(),
    boundingBox: BoundingBoxSchema.nullable(),
  })
  .strict();
export type Pricing = z.infer<typeof PricingSchema>;

/** AC-02 / R-02 click-target element-type taxonomy (closed enum). */
export const ClickTargetElementTypeSchema = z.enum([
  'cta', 'link', 'form_control', 'icon_button',
]);
export type ClickTargetElementType = z.infer<typeof ClickTargetElementTypeSchema>;

/**
 * AC-02 / T1B-002. `index` + `text` are extractor-enriched (lifted from
 * substrate Cta) — both REQUIRED to match the ClickTargetSizer extractor
 * which always populates them. Stage 2.5 fix F-002 — were previously
 * `.optional()` (three-way drift between extractor / schema / fixture);
 * schema is now the canonical surface, fixtures + downstream consumers
 * (ElementGraph cross-references in Phase 1c) can rely on both fields.
 */
export const ClickTargetSchema = z
  .object({
    index: z.number().int().min(0),
    selector: z.string(),
    text: z.string(),
    sizePx: SizePxSchema,
    isMobileTapFriendly: z.boolean(),
    elementType: ClickTargetElementTypeSchema,
    isAboveFold: z.boolean(),
  })
  .strict();
export type ClickTarget = z.infer<typeof ClickTargetSchema>;

/** AC-03 / R-03 — `type` is open string per spec R-03 (no enum lock). */
export const StickyElementSchema = z
  .object({
    type: z.string(),
    positionStrategy: z.enum(['sticky', 'fixed']),
    selector: z.string(),
    viewportCoveragePercent: z.number(),
    isAboveFold: z.boolean(),
    containsPrimaryCta: z.boolean(),
  })
  .strict();
export type StickyElement = z.infer<typeof StickyElementSchema>;

/** AC-04 / R-04 popup type — 11 values (Gate 1 REVISE popup option a). */
export const PopupTypeSchema = z.enum([
  'modal', 'lightbox', 'drawer', 'toast',
  'cookie_banner', 'consent_form', 'slide_in_panel',
  'exit_intent_overlay', 'chat_widget', 'paywall', 'other',
]);
export type PopupType = z.infer<typeof PopupTypeSchema>;

/**
 * AC-04 / T1B-004 — behavior fields are LITERAL NULL per spec R-04;
 * Phase 5b owns runtime-probed dismissibility (R24).
 */
export const PopupSchema = z
  .object({
    type: PopupTypeSchema,
    selector: z.string(),
    isInitiallyOpen: z.boolean(),
    hasCloseButton: z.boolean(),
    closeButtonAccessibleName: z.string().nullable(),
    viewportCoveragePercent: z.number(),
    blocksPrimaryContent: z.boolean(),
    /** Phase 5b reserved — Phase 1b emits literal null (R-04). */
    isEscapeDismissible: z.null(),
    /** Phase 5b reserved — Phase 1b emits literal null (R-04). */
    isClickOutsideDismissible: z.null(),
  })
  .strict();
export type Popup = z.infer<typeof PopupSchema>;

/** AC-05 / R-05 — 6 fields; formula in plan.md §2.4. */
export const FrictionScoreSchema = z
  .object({
    totalFormFields: z.number().int().min(0),
    requiredFormFields: z.number().int().min(0),
    popupCount: z.number().int().min(0),
    forcedActionCount: z.number().int().min(0),
    raw: z.number().min(0),
    normalized: z.number().min(0).max(1),
  })
  .strict();
export type FrictionScore = z.infer<typeof FrictionScoreSchema>;

/** AC-06 1..5 star histogram; null at parent signals no star data. */
export const StarDistributionSchema = z
  .object({
    1: z.number().int().min(0),
    2: z.number().int().min(0),
    3: z.number().int().min(0),
    4: z.number().int().min(0),
    5: z.number().int().min(0),
  })
  .strict();
export type StarDistribution = z.infer<typeof StarDistributionSchema>;

/** AC-06 / T1B-006 — 6 fields per spec contract. */
export const SocialProofDepthSchema = z
  .object({
    reviewCount: z.number().int().min(0),
    starDistribution: StarDistributionSchema.nullable(),
    recencyDays: z.number().nullable(),
    hasAggregateRating: z.boolean(),
    hasIndividualReviews: z.boolean(),
    thirdPartyVerified: z.boolean(),
  })
  .strict();
export type SocialProofDepth = z.infer<typeof SocialProofDepthSchema>;

/** AC-07 microcopy tag — 7 values (R-07 v0.2 Cialdini collapse). */
export const MicrocopyTagSchema = z.enum([
  'risk_reducer', 'urgency', 'security', 'guarantee',
  'social_proof', 'value_prop', 'other',
]);
export type MicrocopyTag = z.infer<typeof MicrocopyTagSchema>;

/** Single near-CTA microcopy tag (T1B-007 output element). */
export const NearCtaTagSchema = z
  .object({
    ctaIndex: z.number().int().min(0),
    text: z.string(),
    selector: z.string(),
    tags: z.array(MicrocopyTagSchema),
  })
  .strict();
export type NearCtaTag = z.infer<typeof NearCtaTagSchema>;

/** AC-07 / T1B-007 — empty `nearCtaTags[]` is the zero shape. */
export const MicrocopySchema = z
  .object({ nearCtaTags: z.array(NearCtaTagSchema) })
  .strict();
export type Microcopy = z.infer<typeof MicrocopySchema>;

/** AC-08 dominant-element type — coarse 5-value taxonomy. */
export const AttentionElementTypeSchema = z.enum([
  'cta', 'image', 'heading', 'form', 'other',
]);
export type AttentionElementType = z.infer<typeof AttentionElementTypeSchema>;

/** AC-08 dominant element (null at parent when score ≤0.3). */
export const AttentionDominantElementSchema = z
  .object({
    type: AttentionElementTypeSchema,
    selector: z.string(),
    score: z.number().min(0).max(1),
  })
  .strict();
export type AttentionDominantElement = z.infer<typeof AttentionDominantElementSchema>;

/** AC-08 contrast-hotspot entry — bbox + 0..1 score. */
export const ContrastHotspotSchema = z
  .object({
    boundingBox: BoundingBoxSchema,
    contrastScore: z.number().min(0).max(1),
  })
  .strict();
export type ContrastHotspot = z.infer<typeof ContrastHotspotSchema>;

/** AC-08 / T1B-008 — always present; nullable dominant. */
export const AttentionSchema = z
  .object({
    dominantElement: AttentionDominantElementSchema.nullable(),
    contrastHotspots: z.array(ContrastHotspotSchema),
  })
  .strict();
export type Attention = z.infer<typeof AttentionSchema>;

/** AC-09 / R-09 stock-status taxonomy (closed enum). */
export const StockStatusSchema = z.enum([
  'in_stock', 'out_of_stock', 'limited', 'preorder', 'unknown',
]);
export type StockStatus = z.infer<typeof StockStatusSchema>;

/** AC-09 / R-09 shipping-signal type — 5-value closed enum. */
export const ShippingSignalTypeSchema = z.enum([
  'free_shipping', 'flat_rate', 'free_above_threshold', 'expedited', 'other',
]);
export type ShippingSignalType = z.infer<typeof ShippingSignalTypeSchema>;

export const ShippingSignalSchema = z
  .object({ type: ShippingSignalTypeSchema, text: z.string() })
  .strict();
export type ShippingSignal = z.infer<typeof ShippingSignalSchema>;

/** AC-09 / T1B-009 — always emitted; `isCommerce:false` zeroes side fields. */
export const CommerceBlockSchema = z
  .object({
    isCommerce: z.boolean(),
    stockStatus: StockStatusSchema.nullable(),
    stockMessage: z.string().nullable(),
    shippingSignals: z.array(ShippingSignalSchema),
    returnPolicyPresent: z.boolean(),
    returnPolicyText: z.string().nullable(),
    guaranteeText: z.string().nullable(),
  })
  .strict();
export type CommerceBlock = z.infer<typeof CommerceBlockSchema>;

// ----------------------------------------------------------------------
// PageStateModel (top-level)
// ----------------------------------------------------------------------

/**
 * Canonical perception output. Strict by design — `_extensions` is the
 * ONLY namespaced-extension surface (Phase 7+ deep_perceive). Phase 1
 * code MUST NOT populate `_extensions` (enforced by unit test).
 */
export const PageStateModelSchema = z
  .object({
    metadata: MetadataSchema,
    accessibilityTree: AccessibilityTreeSchema,
    filteredDOM: FilteredDOMSchema,
    interactiveGraph: InteractiveGraphSchema,
    /** Optional — dropped during ContextAssembler shrink ladder Stage 3. */
    visual: VisualSchema.optional(),
    diagnostics: DiagnosticsSchema,
    // ----- Phase 1b T1B-000 substrate (top-level; additive; optional for Phase 1 backward compat) -----
    /** Enumerated CTAs (T1B-000). Consumed by T1B-002/003/007/009. */
    ctas: z.array(CtaSchema).optional(),
    /** Enumerated <input>/<select>/<textarea> entries (T1B-000). Consumed by T1B-005. */
    formFields: z.array(FormFieldSchema).optional(),
    /** Heading enumeration (T1B-000). */
    headings: z.array(HeadingSchema).optional(),
    /**
     * Dominant CTA on the page (T1B-000). `null` when no element meets the
     * heuristic (see SubstrateExtension.ts). Optional for Phase 1 fixtures.
     */
    primaryActions: PrimaryActionSchema.nullable().optional(),
    // ----- Phase 1b T1B-001..T1B-009 extensions (closed by T1B-011) -----
    // All optional/nullable for backward compat — Phase 1 fixtures
    // (Peregrine PDP, walking-skeleton fixtures) parse without populating
    // any of these. Per-extractor shapes match T1B-001..T1B-009 outputs.
    /** AC-01 / T1B-001. `null` when no pricing detected on the page. */
    pricing: PricingSchema.nullable().optional(),
    /** AC-02 / T1B-002. Empty `[]` when no CTAs in substrate. */
    clickTargets: z.array(ClickTargetSchema).optional(),
    /** AC-03 / T1B-003. Empty `[]` when no sticky/fixed elements. */
    stickyElements: z.array(StickyElementSchema).optional(),
    /** AC-04 / T1B-004. Empty `[]` when no popups detected. */
    popups: z.array(PopupSchema).optional(),
    /** AC-05 / T1B-005. Always emitted when extractors run. */
    frictionScore: FrictionScoreSchema.optional(),
    /** AC-06 / T1B-006. Always emitted; zero-shape when no review data. */
    socialProofDepth: SocialProofDepthSchema.optional(),
    /** AC-07 / T1B-007. Empty `nearCtaTags` when no microcopy in proximity. */
    microcopy: MicrocopySchema.optional(),
    /** AC-08 / T1B-008. Dominant `null` when no candidate scores >0.3. */
    attention: AttentionSchema.optional(),
    /** AC-09 / T1B-009. Always emitted; `isCommerce: false` on content pages. */
    commerce: CommerceBlockSchema.optional(),
    /**
     * RESERVED for Phase 7+ deep_perceive composition. Phase 1 MUST NOT
     * populate this field. Phase 7 will namespace under
     * `_extensions.deepPerceive` per R20 forward-compatibility hygiene.
     */
    _extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type PageStateModel = z.infer<typeof PageStateModelSchema>;
