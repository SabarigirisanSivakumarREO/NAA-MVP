/**
 * AC-11 — page_analyze v2.3 conformance (Phase 2 T048 — CRITICAL).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-11 + R-11 + R-12
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T048
 *     (REQ-TOOL-PA-001 + REQ-ANALYZE-PERCEPTION-V23-001)
 *   docs/specs/mvp/phases/phase-2-tools/impact.md §AnalyzePerception
 *     §F-S4 (namespace contract) + §F-S13 (IframePurpose closed-enum)
 *
 * AC-11 contract:
 *   - Single page.evaluate() call returns AnalyzePerception with all
 *     baseline 9 sections + 14 v2.3 enrichments populated (or null+reason)
 *   - 3 fixture page types: homepage, PDP, checkout
 *   - F-S4 NAMESPACE CONTRACT: result._extensions MUST be `undefined`
 *     (not {}, not populated) — Phase 7 DeepPerceiveNode reservation
 *   - F-S13 IFRAMEPURPOSE CONSTRAINT: iframes[].purposeGuess MUST validate
 *     against Phase 1c IframePurposeSchema closed 9-value enum
 *     (checkout|chat|video|analytics|social_embed|captcha|cmp|payment_3ds|other)
 *
 * RED state — implementation lands at T048 (Wave 6+). The Wave 0
 *   AnalyzePerceptionSchema + IframePurposeSchema are REAL, so we pin the
 *   namespace + IframePurpose constraints at the SCHEMA level NOW, and
 *   defer per-fixture extraction assertions to `it.todo` until T048.
 *
 * Anchor: @AC-11 — F-S4 _extensions undefined + F-S13 IframePurpose constraint.
 */
import { describe, expect, it } from 'vitest';

import { AnalyzePerceptionSchema } from '../../src/analysis/index.js';
import {
  IFRAME_PURPOSE_ENUM,
  IframePurposeSchema,
} from '../../src/perception/IframePolicyEngine.js';

// NOTE (R3.1): import deliberately commented out so this file compiles +
// loads cleanly until T048 lands. Uncomment when pageAnalyze.ts exists:
// import { pageAnalyze } from '../../src/mcp/tools/pageAnalyze.js';

describe('page_analyze v2.3 — AC-11 conformance (Wave 0 RED)', () => {
  /**
   * @AC-11 F-S13 — IframePurposeSchema closed enum is exactly 9 values.
   * The §07.9 verbatim "map|antibot" wording is superseded by Phase 1c.
   * `cross_origin` is a classifyIframe() security-override return value, NOT
   * an enum member.
   */
  it('AC-11 F-S13: IframePurposeSchema is closed 9-value enum (no cross_origin member)', () => {
    expect(IFRAME_PURPOSE_ENUM).toHaveLength(9);
    expect([...IFRAME_PURPOSE_ENUM].sort()).toEqual(
      [
        'analytics', 'captcha', 'chat', 'checkout', 'cmp', 'other',
        'payment_3ds', 'social_embed', 'video',
      ].sort(),
    );
    // cross_origin is explicitly NOT a member
    expect(IframePurposeSchema.safeParse('cross_origin').success).toBe(false);
    // legacy §07.9 "map" / "antibot" / "video_embed" values are NOT members
    expect(IframePurposeSchema.safeParse('map').success).toBe(false);
    expect(IframePurposeSchema.safeParse('antibot').success).toBe(false);
    expect(IframePurposeSchema.safeParse('video_embed').success).toBe(false);
  });

  /**
   * @AC-11 F-S13 — every closed-enum member parses successfully.
   */
  it('AC-11 F-S13: IframePurposeSchema accepts all 9 enum members', () => {
    for (const value of IFRAME_PURPOSE_ENUM) {
      expect(IframePurposeSchema.safeParse(value).success).toBe(true);
    }
  });

  /**
   * @AC-11 F-S4 — top-level _extensions is OPTIONAL on the schema (RESERVED
   * seam) but Phase 2 page_analyze MUST leave it `undefined` at runtime.
   * Pin the schema-level optionality + add the runtime-undefined check
   * at AC-11 T048 conformance + AC-13 integration (see phase2.test.ts).
   */
  it('AC-11 F-S4: AnalyzePerceptionSchema treats _extensions as OPTIONAL (reserved seam)', () => {
    // Schema accepts result without _extensions present (Phase 2 expected shape)
    const minimal = makeMinimalAnalyzePerception();
    const withoutExt = AnalyzePerceptionSchema.safeParse(minimal);
    expect(withoutExt.success).toBe(true);

    // Schema also accepts result WITH _extensions populated (Phase 7 future shape)
    const withExt = AnalyzePerceptionSchema.safeParse({
      ...minimal,
      _extensions: { deepPerceive: { reasoning: 'phase 7 future' } },
    });
    expect(withExt.success).toBe(true);
  });

  /**
   * @AC-11 — schema is .strict() — rejects unknown top-level keys to guard
   * against silent shape drift.
   */
  it('AC-11: AnalyzePerceptionSchema rejects unknown top-level keys (.strict)', () => {
    const minimal = makeMinimalAnalyzePerception();
    const withUnknown = AnalyzePerceptionSchema.safeParse({
      ...minimal,
      unknownField: 'should be rejected',
    });
    expect(withUnknown.success).toBe(false);
  });

  /**
   * @AC-11 fixture page #1 — homepage produces AnalyzePerception with all
   * baseline 9 sections + 14 v2.3 enrichment categories populated (or
   * null+reason where derivation fails).
   */
  it.todo('AC-11: homepage fixture produces AnalyzePerception with all baseline + v2.3 fields');

  /**
   * @AC-11 fixture page #2 — PDP (product detail page).
   */
  it.todo('AC-11: PDP fixture produces AnalyzePerception with all baseline + v2.3 fields');

  /**
   * @AC-11 fixture page #3 — checkout.
   */
  it.todo('AC-11: checkout fixture produces AnalyzePerception with all baseline + v2.3 fields');

  /**
   * @AC-11 F-S4 (CRITICAL — namespace contract carryforward) — every
   * page_analyze runtime output MUST have `result._extensions === undefined`
   * (NOT {}, NOT populated). Phase 7 DeepPerceiveNode reservation. AC-13
   * integration repeats this assertion at the integration boundary.
   */
  it.todo('AC-11 F-S4: page_analyze output _extensions is undefined (NOT {}, NOT populated)');

  /**
   * @AC-11 F-S13 (CRITICAL — closed-enum constraint) — every iframe in
   * result.iframes has a purposeGuess validating against IframePurposeSchema.
   * No ad-hoc strings, no `cross_origin` (security-override return value),
   * no superseded "map" / "antibot" / "video_embed" values.
   */
  it.todo(
    'AC-11 F-S13: every iframes[].purposeGuess validates against IframePurposeSchema (no ad-hoc strings)',
  );

  /**
   * @AC-11 REQ-TOOL-PA-001 — single page.evaluate() call within the handler
   * (the upstream waitForSettle precondition's evaluate does NOT count).
   * Verifiable via Playwright trace count == 1.
   */
  it.todo('AC-11 REQ-TOOL-PA-001: page_analyze handler emits exactly 1 page.evaluate() call');

  /**
   * @AC-11 NF-Phase2-03 — page_analyze wall-clock < 5 s on amazon.in.
   */
  it.todo('AC-11 NF-Phase2-03: page_analyze wall-clock < 5 s on amazon.in homepage');

  /**
   * @AC-11 — emits Pino correlation fields per T-PHASE2-LOGGER.
   */
  it.todo('AC-11: logs tool_name + tool_call_id + client_session_id correlation fields');
});

/**
 * Minimal AnalyzePerception fixture for SCHEMA-level conformance assertions.
 * Hand-built rather than generated to keep the test self-contained and to
 * make the §07.9 baseline shape explicit. Uses Phase 1c IframePurpose enum
 * member 'video' (NOT the superseded 'video_embed').
 */
function makeMinimalAnalyzePerception() {
  return {
    metadata: {
      url: 'https://example.com',
      requestedUrl: 'https://example.com',
      title: 'Example',
      metaDescription: null,
      canonical: null,
      lang: 'en',
      ogTags: {},
      schemaOrg: [],
      timestamp: 1_700_000_000_000,
      viewport: { width: 1280, height: 800 },
    },
    headingHierarchy: [],
    landmarks: [],
    semanticHTML: {
      hasMain: false,
      hasNav: false,
      hasFooter: false,
      formCount: 0,
      tableCount: 0,
    },
    structure: { titleH1Match: true, titleH1Similarity: 1 },
    textContent: {
      wordCount: 0,
      readabilityScore: null,
      primaryLanguage: 'en',
      paragraphs: [],
      valueProp: { h1: null, heroSubheading: null, firstParagraph: null },
      urgencyScarcityHits: [],
      riskReversalHits: [],
    },
    ctas: [],
    forms: [],
    trustSignals: [],
    layout: {
      viewportHeight: 800,
      foldPosition: 800,
      contentAboveFold: [],
      visualHierarchy: { primaryElement: '', secondaryElements: [] },
      whitespaceRatio: 0.5,
    },
    images: [],
    iframes: [],
    navigation: {
      primaryNavItems: [],
      breadcrumbs: [],
      footerNavItems: [],
      hasSearch: false,
      hasMobileMenu: false,
    },
    accessibility: { keyboardFocusOrder: [], skipLinks: [] },
    performance: {
      domContentLoaded: 0,
      fullyLoaded: 0,
      resourceCount: 0,
      totalTransferSize: 0,
    },
    inferredPageType: {
      primary: 'unknown',
      alternatives: [],
      signalsUsed: { urlKeywords: [], ctaTexts: [], formSignals: [], schemaOrgTypes: [] },
    },
  };
}
