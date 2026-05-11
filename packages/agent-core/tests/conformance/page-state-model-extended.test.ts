/**
 * Conformance test for AC-00 (T1B-000 PageStateModel substrate extension)
 *                 AND AC-11 (T1B-011 extended PageStateModelSchema Zod closure).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md
 *     AC-00 (~line 183) — Path B substrate fields
 *     AC-11 (~line 194) — Zod schema closure validates all 10 Phase 1b groups
 *
 * Plan source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/plan.md §2.2
 *     ExtractCtx TypeScript interface (substrate contract).
 *
 * R3.1 TDD discipline: this test MUST FAIL at the T-PHASE1B-TESTS commit.
 *   - The fixture below populates the extended substrate + 10 Phase 1b
 *     extension top-level groups. Phase 1's current PageStateModelSchema
 *     (at packages/agent-core/src/perception/types.ts) does NOT yet
 *     accept these fields (it is .strict()), so .parse() will FAIL.
 *   - Additionally, the SubstrateExtension module import below will fail
 *     with "module not found" until T1B-000 lands the implementation.
 *
 * Anchors:
 *   @AC-00 — substrate (ctas[], formFields[], metadata.schemaOrg,
 *            metadata.ogTags, headings[], primaryActions) populated.
 *   @AC-11 — extended PageStateModelSchema validates all 10 Phase 1b
 *            field groups (pricing, clickTargets[], stickyElements[],
 *            popups[], frictionScore, socialProofDepth, microcopy,
 *            attention, commerce, metadata.currencySwitcher) and all
 *            Phase 1 sub-schemas continue to validate unchanged.
 */
import { describe, expect, test } from 'vitest';
import { PageStateModelSchema } from '../../src/perception/types.js';

// This import WILL FAIL with "module not found" until T1B-000 ships.
// That's the R3.1 RED state we want.
// @ts-expect-error — module does not exist yet (T1B-000 RED state)
import { extractSubstrate } from '../../src/perception/extensions/SubstrateExtension.js';

interface ExtendedFixture {
  metadata: Record<string, unknown>;
  accessibilityTree: Record<string, unknown>;
  filteredDOM: Record<string, unknown>;
  interactiveGraph: Record<string, unknown>;
  diagnostics: Record<string, unknown>;
  // T1B-000 substrate additions:
  ctas: Array<Record<string, unknown>>;
  formFields: Array<Record<string, unknown>>;
  headings: Array<Record<string, unknown>>;
  primaryActions: Record<string, unknown> | null;
  // T1B-001..T1B-010 extensions:
  pricing: Record<string, unknown> | null;
  clickTargets: Array<Record<string, unknown>>;
  stickyElements: Array<Record<string, unknown>>;
  popups: Array<Record<string, unknown>>;
  frictionScore: Record<string, unknown>;
  socialProofDepth: Record<string, unknown>;
  microcopy: Record<string, unknown>;
  attention: Record<string, unknown>;
  commerce: Record<string, unknown>;
}

function makeExtendedFixture(): ExtendedFixture {
  return {
    metadata: {
      url: 'https://example.com/pdp',
      title: 'Example PDP',
      statusCode: 200,
      navigationStartedAt: '2026-05-11T00:00:00.000Z',
      navigationEndedAt: '2026-05-11T00:00:00.300Z',
      // T1B-000 substrate inside metadata:
      schemaOrg: [{ '@type': 'Product', name: 'Example Product' }],
      ogTags: { 'og:title': 'Example Product', 'og:type': 'product' },
      // T1B-010 currency switcher nested inside metadata:
      currencySwitcher: {
        present: true,
        currentCurrency: 'USD',
        availableCurrencies: ['USD', 'EUR', 'GBP'],
        isAccessibleAt: 'header',
      },
    },
    accessibilityTree: {
      root: { role: 'WebArea', name: 'Example PDP', children: [] },
      totalNodes: 1,
    },
    filteredDOM: { top30: [] },
    interactiveGraph: { clickable: [], typeable: [], submittable: [] },
    diagnostics: {
      axNodeCount: 1,
      mutationsObserved: 0,
      stable: true,
      lowAxNodeCount: false,
      unstable: false,
      errors: [],
      warnings: [],
    },
    // T1B-000 substrate top-level additions:
    ctas: [
      {
        index: 0,
        text: 'Add to bag',
        selector: 'button.atc',
        sizePx: { width: 200, height: 48 },
      },
    ],
    formFields: [{ selector: 'input#email', type: 'email', required: true }],
    headings: [{ level: 1, text: 'Example Product', selector: 'h1' }],
    primaryActions: { selector: 'button.atc', text: 'Add to bag' },
    // T1B-001..T1B-009 extension top-level groups:
    pricing: {
      displayFormat: 'simple',
      amount: '$49',
      amountNumeric: 49,
      currency: 'USD',
      taxInclusion: 'exclusive',
      anchorPrice: '$99',
      discountPercent: 50,
      comparisonShown: true,
      boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    },
    clickTargets: [
      {
        selector: 'button.atc',
        sizePx: { width: 200, height: 48 },
        isMobileTapFriendly: true,
        elementType: 'cta',
        isAboveFold: true,
      },
    ],
    stickyElements: [],
    popups: [],
    frictionScore: {
      totalFormFields: 1,
      requiredFormFields: 1,
      popupCount: 0,
      forcedActionCount: 0,
      raw: 2.5,
      normalized: 0.083,
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
    attention: { dominantElement: null, contrastHotspots: [] },
    commerce: {
      isCommerce: true,
      stockStatus: 'in_stock',
      stockMessage: null,
      shippingSignals: [],
      returnPolicyPresent: false,
      returnPolicyText: null,
      guaranteeText: null,
    },
  };
}

describe('PageStateModel extended schema — AC-00 + AC-11 conformance (RED)', () => {
  /**
   * @AC-00 / @AC-11 — extended PageStateModelSchema accepts substrate
   * fields (ctas[], formFields[], metadata.schemaOrg, metadata.ogTags,
   * headings[], primaryActions) AND all 10 Phase 1b extension groups.
   *
   * THIS TEST IS EXPECTED TO FAIL until T1B-000 + T1B-011 land. Phase 1's
   * .strict() schema rejects every new top-level key.
   */
  test('AC-00 + AC-11: extended schema validates substrate + 10 extension groups', () => {
    const fixture = makeExtendedFixture();
    const result = PageStateModelSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  /**
   * @AC-00 — Phase 1 backward-compat: Phase 1 fixtures still validate.
   * (When T1B-011 lands, the new fields must be additive/optional so
   * Phase 1 fixtures without substrate still parse.)
   */
  test('AC-00: Phase 1 baseline fixture still validates under extended schema', () => {
    const phase1Fixture = {
      metadata: {
        url: 'https://example.com/',
        title: 'Example Domain',
        statusCode: 200,
        navigationStartedAt: '2026-05-11T00:00:00.000Z',
        navigationEndedAt: '2026-05-11T00:00:00.300Z',
      },
      accessibilityTree: {
        root: { role: 'WebArea', name: 'Example Domain', children: [] },
        totalNodes: 1,
      },
      filteredDOM: { top30: [] },
      interactiveGraph: { clickable: [], typeable: [], submittable: [] },
      diagnostics: {
        axNodeCount: 1,
        mutationsObserved: 0,
        stable: true,
        lowAxNodeCount: false,
        unstable: false,
        errors: [],
        warnings: [],
      },
    };
    const result = PageStateModelSchema.safeParse(phase1Fixture);
    expect(result.success).toBe(true);
  });

  /**
   * @AC-00 — SubstrateExtension module must exist and export extractSubstrate.
   * This test will fail with "module not found" until T1B-000 ships.
   */
  test('AC-00: SubstrateExtension module exports extractSubstrate', () => {
    expect(typeof extractSubstrate).toBe('function');
  });

  /**
   * @AC-11 — _extensions namespace remains reserved for Phase 7 (R20).
   * Phase 1b additions are top-level / inside metadata; NOT under _extensions.
   */
  test('AC-11: _extensions reserved-for-Phase-7 namespace stays untouched by Phase 1b', () => {
    const fixture = makeExtendedFixture();
    const result = PageStateModelSchema.safeParse(fixture);
    if (result.success) {
      expect((result.data as { _extensions?: unknown })._extensions).toBeUndefined();
    } else {
      // While the schema is still pre-extension (RED state), assert the
      // fixture itself has no _extensions key — Phase 1b never sets it.
      expect(Object.keys(fixture)).not.toContain('_extensions');
    }
  });
});
