/**
 * AnalyzePerception sub-schemas — internal module split from `./types.ts`.
 *
 * Source: docs/specs/final-architecture/07-analyze-mode.md §7.9 + §7.9.1
 *   (canonical verbatim authority). See ./types.ts header for full provenance,
 *   F-CARRY-1 resolution, F-G1 / F-S4 / F-S13 design decisions, nullable
 *   convention.
 *
 * Split rationale: T-PHASE2-TYPES brief permitted sibling module when
 *   types.ts > 400 LOC. Kept one canonical schema export
 *   (`AnalyzePerceptionSchema` in types.ts); sub-schemas are an
 *   implementation detail of that one schema and are NOT re-exported as
 *   a public surface (R11 single-source-of-truth).
 *
 * R10: file ≤500 LOC; no `any`; .strict() at every object boundary.
 */
import { z } from 'zod';

import { IframePurposeSchema } from '../perception/IframePolicyEngine.js';

// ── Shared sub-schemas ─────────────────────────────────────────────────────

/** Bounding box (px relative to viewport). Used by ctas, trust signals, iframes, etc. */
export const BoundingBoxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().min(0),
    height: z.number().min(0),
  })
  .strict();

const OptionalBoundingBoxSchema = BoundingBoxSchema.optional();

// ── metadata (baseline + v2.3) ─────────────────────────────────────────────

export const MetadataSchema = z
  .object({
    url: z.string(),
    /** v2.3: URL as originally requested (pre-redirect). */
    requestedUrl: z.string(),
    title: z.string(),
    /** v2.3: <meta name="description"> — null when absent. */
    metaDescription: z.string().nullable(),
    /** v2.3: <link rel="canonical">. */
    canonical: z.string().nullable(),
    /** v2.3: <html lang>. */
    lang: z.string().nullable(),
    /** v2.3: og:* tag map. */
    ogTags: z.record(z.string(), z.string()),
    /** v2.3: parsed JSON-LD + microdata fragments. */
    schemaOrg: z.array(z.record(z.string(), z.unknown())),
    timestamp: z.number(),
    viewport: z.object({ width: z.number(), height: z.number() }).strict(),
  })
  .strict();

// ── headingHierarchy / landmarks / semanticHTML / structure ────────────────

export const HeadingEntrySchema = z
  .object({
    level: z.number().int().min(1).max(6),
    text: z.string(),
    isAboveFold: z.boolean(),
  })
  .strict();

export const LandmarkSchema = z
  .object({ role: z.string(), label: z.string() })
  .strict();

export const SemanticHTMLSchema = z
  .object({
    hasMain: z.boolean(),
    hasNav: z.boolean(),
    hasFooter: z.boolean(),
    formCount: z.number().int().min(0),
    tableCount: z.number().int().min(0),
  })
  .strict();

/** v2.3 NEW top-level. */
export const StructureSchema = z
  .object({
    titleH1Match: z.boolean(),
    /** 0.0-1.0 cosine or Jaccard on tokens. */
    titleH1Similarity: z.number().min(0).max(1),
  })
  .strict();

// ── textContent (baseline + v2.3) ──────────────────────────────────────────

const ParagraphPositionSchema = z.enum(['above_fold', 'below_fold']);

const ParagraphEntrySchema = z
  .object({ text: z.string(), position: ParagraphPositionSchema })
  .strict();

const ValuePropSchema = z
  .object({
    h1: z.string().nullable(),
    heroSubheading: z.string().nullable(),
    firstParagraph: z.string().nullable(),
  })
  .strict();

/** v2.3: pattern hit for urgency/scarcity OR risk-reversal microcopy. */
const PatternHitSchema = z
  .object({
    pattern: z.string(),
    match: z.string(),
    boundingBox: OptionalBoundingBoxSchema,
  })
  .strict();

export const TextContentSchema = z
  .object({
    wordCount: z.number().int().min(0),
    /** Flesch-Kincaid; nullable when text too sparse to score. */
    readabilityScore: z.number().nullable(),
    primaryLanguage: z.string(),
    paragraphs: z.array(ParagraphEntrySchema),
    /** v2.3 */
    valueProp: ValuePropSchema,
    /** v2.3: "limited time" / "only N left" / etc. */
    urgencyScarcityHits: z.array(PatternHitSchema),
    /** v2.3: "money-back" / "free returns" / etc. */
    riskReversalHits: z.array(PatternHitSchema),
  })
  .strict();

// ── ctas (baseline + v2.3 pseudo-class styles) ─────────────────────────────

const CtaTypeSchema = z.enum(['primary', 'secondary', 'tertiary']);

const CtaComputedStylesSchema = z
  .object({
    backgroundColor: z.string(),
    color: z.string(),
    fontSize: z.string(),
    padding: z.string(),
    /** WCAG luminance ratio. */
    contrastRatio: z.number(),
  })
  .strict();

/** v2.3: pseudo-class :hover styles (CSS matching, no interaction). */
const CtaHoverStylesSchema = z
  .object({
    backgroundColor: z.string(),
    color: z.string(),
    contrastRatio: z.number(),
  })
  .strict();

/** v2.3: pseudo-class :focus styles + outline-visibility check. */
const CtaFocusStylesSchema = z
  .object({
    backgroundColor: z.string(),
    color: z.string(),
    contrastRatio: z.number(),
    outlineVisible: z.boolean(),
  })
  .strict();

export const CtaEntrySchema = z
  .object({
    text: z.string(),
    /** v2.3: AX-tree merge (aria-label / aria-labelledby / computed name). */
    accessibleName: z.string().nullable(),
    /** v2.3: computed ARIA role. */
    role: z.string().nullable(),
    type: CtaTypeSchema,
    isAboveFold: z.boolean(),
    boundingBox: BoundingBoxSchema,
    computedStyles: CtaComputedStylesSchema,
    /** v2.3: nullable when CSS does not declare :hover styles. */
    hoverStyles: CtaHoverStylesSchema.nullable(),
    /** v2.3: nullable when CSS does not declare :focus styles. */
    focusStyles: CtaFocusStylesSchema.nullable(),
    surroundingContext: z.string(),
  })
  .strict();

// ── forms (baseline + v2.3 fields[].accessibleName/role) ───────────────────

const FormFieldEntrySchema = z
  .object({
    type: z.string(),
    label: z.string(),
    hasLabel: z.boolean(),
    /** v2.3 */
    accessibleName: z.string().nullable(),
    /** v2.3 */
    role: z.string().nullable(),
    isRequired: z.boolean(),
    hasValidation: z.boolean(),
    hasErrorMessage: z.boolean(),
    placeholder: z.string(),
  })
  .strict();

export const FormEntrySchema = z
  .object({
    id: z.string(),
    fieldCount: z.number().int().min(0),
    requiredFieldCount: z.number().int().min(0),
    fields: z.array(FormFieldEntrySchema),
    hasInlineValidation: z.boolean(),
    submitButtonText: z.string(),
  })
  .strict();

// ── trustSignals (baseline + v2.3 provenance) ──────────────────────────────

const TrustSignalTypeSchema = z.enum([
  'review', 'badge', 'testimonial', 'guarantee', 'security', 'social_proof',
]);

/** v2.3: trust-signal provenance subtype (8 values per §07.9). */
const TrustSignalSubtypeSchema = z.enum([
  'payment', 'security_certification', 'industry_cert', 'customer_review',
  'expert_endorsement', 'press_mention', 'aggregate_rating', 'other',
]);

/** v2.3: third-party iff sourced from external verifiable source. */
const TrustSignalSourceSchema = z.enum(['third_party', 'self_claimed', 'unknown']);

export const TrustSignalEntrySchema = z
  .object({
    type: TrustSignalTypeSchema,
    /** v2.3 */
    subtype: TrustSignalSubtypeSchema,
    text: z.string(),
    isAboveFold: z.boolean(),
    boundingBox: BoundingBoxSchema,
    /** v2.3 */
    source: TrustSignalSourceSchema,
    /** v2.3: e.g., "4.7 stars on Trustpilot". */
    attribution: z.string().nullable(),
    /** v2.3: ISO date — review date / certification date. */
    freshnessDate: z.string().nullable(),
    /** v2.3: Euclidean distance to nearest CTA center. */
    pixelDistanceToNearestCta: z.number().nullable(),
  })
  .strict();

// ── layout / images ────────────────────────────────────────────────────────

const VisualHierarchySchema = z
  .object({
    primaryElement: z.string(),
    secondaryElements: z.array(z.string()),
  })
  .strict();

export const LayoutSchema = z
  .object({
    viewportHeight: z.number(),
    foldPosition: z.number(),
    contentAboveFold: z.array(z.string()),
    visualHierarchy: VisualHierarchySchema,
    whitespaceRatio: z.number().min(0).max(1),
  })
  .strict();

export const ImageEntrySchema = z
  .object({
    src: z.string(),
    alt: z.string(),
    hasAlt: z.boolean(),
    width: z.number().min(0),
    height: z.number().min(0),
    isAboveFold: z.boolean(),
    isLazyLoaded: z.boolean(),
  })
  .strict();

// ── iframes (v2.3 NEW top-level; F-S13 closed-enum purposeGuess) ───────────

export const IframeEntrySchema = z
  .object({
    src: z.string(),
    origin: z.string(),
    isCrossOrigin: z.boolean(),
    boundingBox: BoundingBoxSchema,
    isAboveFold: z.boolean(),
    /**
     * F-S13: constrained to Phase 1c IframePurpose closed enum (9 values:
     * checkout|chat|video|analytics|social_embed|captcha|cmp|payment_3ds|other).
     * Phase 1c IframePolicyEngine is the authoritative classifier; the §07.9
     * verbatim "map|antibot" values are superseded.
     */
    purposeGuess: IframePurposeSchema,
  })
  .strict();

// ── navigation (baseline + v2.3 footerNavItems) ────────────────────────────

const PrimaryNavItemSchema = z
  .object({ text: z.string(), url: z.string(), isActive: z.boolean() })
  .strict();

/** v2.3: footer nav with optional grouping section. */
const FooterNavItemSchema = z
  .object({
    text: z.string(),
    url: z.string(),
    section: z.string().nullable(),
  })
  .strict();

export const NavigationSchema = z
  .object({
    primaryNavItems: z.array(PrimaryNavItemSchema),
    breadcrumbs: z.array(z.string()),
    /** v2.3 */
    footerNavItems: z.array(FooterNavItemSchema),
    hasSearch: z.boolean(),
    hasMobileMenu: z.boolean(),
  })
  .strict();

// ── accessibility (v2.3 NEW top-level) ─────────────────────────────────────

const KeyboardFocusEntrySchema = z
  .object({
    selector: z.string(),
    role: z.string().nullable(),
    accessibleName: z.string().nullable(),
    tabindex: z.number().int(),
  })
  .strict();

const SkipLinkEntrySchema = z
  .object({
    text: z.string(),
    target: z.string(),
    /** Not hidden via display:none or off-screen positioning. */
    isVisible: z.boolean(),
  })
  .strict();

export const AccessibilitySchema = z
  .object({
    keyboardFocusOrder: z.array(KeyboardFocusEntrySchema),
    skipLinks: z.array(SkipLinkEntrySchema),
  })
  .strict();

// ── performance (baseline + v2.3 Core Web Vitals + CRO metric) ─────────────

export const PerformanceSchema = z
  .object({
    domContentLoaded: z.number(),
    fullyLoaded: z.number(),
    resourceCount: z.number().int().min(0),
    totalTransferSize: z.number().min(0),
    /** Optional in §07.9 (`?`). Largest Contentful Paint. */
    largestContentfulPaint: z.number().optional(),
    /** v2.3: Interaction to Next Paint (PerformanceObserver). */
    interactionToNextPaint: z.number().optional(),
    /** v2.3: Cumulative Layout Shift (PerformanceObserver). */
    cumulativeLayoutShift: z.number().optional(),
    /** v2.3: Time To First Byte. */
    timeToFirstByte: z.number().optional(),
    /** v2.3: CRO-specific — first CTA paint + intersect viewport. */
    timeToFirstCtaInteractable: z.number().optional(),
  })
  .strict();

// ── viewport_context (v2.2 addition; OPTIONAL per §07.9) ───────────────────

export const ViewportContextSchema = z
  .object({
    width: z.number(),
    height: z.number(),
    device_type: z.enum(['desktop', 'mobile']),
  })
  .strict();

// ── inferredPageType (v2.3 NEW top-level) ──────────────────────────────────

/**
 * PageType taxonomy. §07.9 references PageType opaquely without enumerating;
 * Phase 7 will narrow this when page-type detection lands (§07.4). Phase 2
 * emits as `string` to keep T-PHASE2-TYPES decoupled from Phase 7 page-type
 * vocabulary; Phase 7 will tighten via R18 enum append. NOT a forbidden
 * ad-hoc string — there is no Phase 1c authoritative enum to constrain to
 * (unlike F-S13's IframePurpose case).
 */
const PageTypeSchema = z.string();

const InferredPageTypeAlternativeSchema = z
  .object({
    type: PageTypeSchema,
    confidence: z.number().min(0).max(1),
  })
  .strict();

const InferredPageTypeSignalsSchema = z
  .object({
    urlKeywords: z.array(z.string()),
    ctaTexts: z.array(z.string()),
    formSignals: z.array(z.string()),
    schemaOrgTypes: z.array(z.string()),
  })
  .strict();

export const InferredPageTypeSchema = z
  .object({
    primary: PageTypeSchema,
    alternatives: z.array(InferredPageTypeAlternativeSchema),
    /** Transparency + grounding signals — exposes WHAT drove classification. */
    signalsUsed: InferredPageTypeSignalsSchema,
  })
  .strict();
