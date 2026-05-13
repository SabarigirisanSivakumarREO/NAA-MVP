/**
 * AnalyzePerception — canonical Phase 2 + Phase 7 analysis-perception schema.
 *
 * CANONICAL VERBATIM AUTHORITY: docs/specs/final-architecture/07-analyze-mode.md
 *   §7.9 (baseline 9 sections + v2.3 enrichments inline) + §7.9.1 (v2.3
 *   enrichment summary table). Phase 2 framing: spec.md §R-12 / AC-11;
 *   impact.md §AnalyzePerception (F-G1 / F-S4 / F-S13); tasks.md T-PHASE2-TYPES
 *   + T048.
 *
 * F-CARRY-1 RESOLUTION (recorded in impact.md §AnalyzePerception):
 *   §07.9.1 enumerates 11 enrichment CATEGORIES (rows: metadata, structure
 *   [new], textContent, ctas[], forms[].fields[], trustSignals[], iframes
 *   [new], navigation, accessibility [new], performance, inferredPageType
 *   [new]) and 38 enrichment SUB-FIELDS (6+2+3+4+2+5+6+1+2+4+3). The "14 v2.3
 *   enrichment categories (~30 sub-fields)" wording in spec.md AC-11 was a
 *   draft-era approximation; canonical authority remains §07.9 verbatim.
 *
 * F-G1 (impact.md v0.2): AnalyzePerceptionSchema is SEPARATE from
 *   PageStateModel. Phase 1c `bundleToAnalyzePerception` accessor returns PSM
 *   as alias; this schema materializes the §07.9 v2.3 contract that
 *   page_analyze (T048) produces and Phase 7 DeepPerceiveNode + grounding
 *   rules consume. Both contracts coexist.
 *
 * F-S4 (impact.md v0.2 + Phase 1c impact.md §11): top-level `_extensions:
 *   z.record(z.string(), z.unknown()).optional()` is a RESERVED seam for
 *   Phase 7+ deepPerceive. Phase 2 page_analyze MUST leave this `undefined`
 *   at runtime (asserted at AC-11 conformance).
 *
 * F-S13 (impact.md v0.2): `iframes[].purposeGuess` constrained to Phase 1c
 *   `IframePurposeSchema` (9-value closed enum:
 *   checkout|chat|video|analytics|social_embed|captcha|cmp|payment_3ds|other).
 *   Phase 1c is authoritative; the §07.9 verbatim "map|antibot" values are
 *   superseded. New purposes require append-only Phase 1c enum extension (R18).
 *
 * Module split (T-PHASE2-TYPES brief): sub-schemas live in
 *   `./analyzePerception.subschemas.ts`. This file holds the single canonical
 *   `AnalyzePerceptionSchema` + `AnalyzePerception` type export (R11 single
 *   source of truth).
 *
 * R10: file ≤300 LOC; named exports only; no `any`; .strict() at every object
 *   boundary. REQ-IDs: REQ-ANALYZE-PERCEPTION-001 +
 *   REQ-ANALYZE-PERCEPTION-V23-001 + REQ-ANALYZE-V23-001.
 */
import { z } from 'zod';

import {
  AccessibilitySchema,
  CtaEntrySchema,
  FormEntrySchema,
  HeadingEntrySchema,
  IframeEntrySchema,
  ImageEntrySchema,
  InferredPageTypeSchema,
  LandmarkSchema,
  LayoutSchema,
  MetadataSchema,
  NavigationSchema,
  PerformanceSchema,
  SemanticHTMLSchema,
  StructureSchema,
  TextContentSchema,
  TrustSignalEntrySchema,
  ViewportContextSchema,
} from './analyzePerception.subschemas.js';

/**
 * Canonical analysis-perception output. Strict by design — `_extensions` is
 * the ONLY namespaced-extension surface (Phase 7+ deepPerceive). Phase 2
 * page_analyze (T048) MUST NOT populate `_extensions` (asserted at AC-11
 * conformance per impact.md F-S4).
 *
 * Top-level sections (§07.9 baseline + v2.3 NEW):
 *   - metadata, headingHierarchy, landmarks, semanticHTML            [baseline]
 *   - structure                                                      [v2.3 NEW]
 *   - textContent, ctas, forms, trustSignals, layout, images         [baseline]
 *   - iframes                                                        [v2.3 NEW]
 *   - navigation                                                     [baseline]
 *   - accessibility                                                  [v2.3 NEW]
 *   - performance                                                    [baseline]
 *   - viewport_context                                               [v2.2 OPT]
 *   - inferredPageType                                               [v2.3 NEW]
 *   - _extensions                                                    [RESERVED]
 */
export const AnalyzePerceptionSchema = z
  .object({
    metadata: MetadataSchema,
    headingHierarchy: z.array(HeadingEntrySchema),
    landmarks: z.array(LandmarkSchema),
    semanticHTML: SemanticHTMLSchema,
    structure: StructureSchema,
    textContent: TextContentSchema,
    ctas: z.array(CtaEntrySchema),
    forms: z.array(FormEntrySchema),
    trustSignals: z.array(TrustSignalEntrySchema),
    layout: LayoutSchema,
    images: z.array(ImageEntrySchema),
    iframes: z.array(IframeEntrySchema),
    navigation: NavigationSchema,
    accessibility: AccessibilitySchema,
    performance: PerformanceSchema,
    /** v2.2 optional viewport context. */
    viewport_context: ViewportContextSchema.optional(),
    inferredPageType: InferredPageTypeSchema,
    /**
     * RESERVED for Phase 7+ deepPerceive composition. Phase 2 page_analyze
     * (T048) MUST leave this `undefined` — asserted at AC-11 conformance per
     * impact.md F-S4 + Phase 1c impact.md §11. Phase 7 will namespace under
     * `_extensions.deepPerceive`.
     */
    _extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type AnalyzePerception = z.infer<typeof AnalyzePerceptionSchema>;

/**
 * Sub-shape access pattern for Phase 7 consumers: derive narrow types via
 * `z.infer` on indexed paths rather than importing each sub-schema, e.g.:
 *
 *   type Cta = AnalyzePerception['ctas'][number];
 *   type TrustSignal = AnalyzePerception['trustSignals'][number];
 *
 * For runtime Zod access, use `AnalyzePerceptionSchema.shape.<key>`. The sub-
 * schemas in `./analyzePerception.subschemas.ts` are also re-exported via the
 * `./index.ts` barrel for the rare consumer that needs a parser for a single
 * sub-shape (e.g., a grounding rule that validates pre-extracted CTA data).
 */
