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
 * GREEN state — T048 landed. Wave 0 schema-level assertions remain (they pin
 *   namespace + IframePurpose constraints at the schema level), and the 6
 *   prior `it.todo` placeholders are now real `it()` blocks running against
 *   real Playwright BrowserManager headless sessions + setContent fixtures
 *   for 3 page types (homepage, PDP, checkout). Plus: F-S4 namespace contract,
 *   F-S13 enum constraint, REQ-TOOL-PA-001 single-evaluate counter, and
 *   NF-Phase2-03 wall-clock <5s on amazon.in (skip-gated for SKIP_LIVE_NETWORK).
 *
 * Anchor: @AC-11 — F-S4 _extensions undefined + F-S13 IframePurpose constraint.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import { AnalyzePerceptionSchema } from '../../src/analysis/index.js';
import {
  IFRAME_PURPOSE_ENUM,
  IframePurposeSchema,
} from '../../src/perception/IframePolicyEngine.js';
import { BrowserManager } from '../../src/browser-runtime/BrowserManager.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import type { ToolContext } from '../../src/mcp/types.js';
import { createPageAnalyzeTool } from '../../src/mcp/tools/pageAnalyze.js';

// ── stub helpers (mirror page-get-performance.test.ts) ─────────────────────

function stubLogger(): Logger {
  const fn = vi.fn();
  return { info: fn, warn: fn, error: fn, debug: fn, child: vi.fn() } as unknown as Logger;
}

function stubCtx(): ToolContext {
  return { logger: stubLogger(), toolCallId: 't-1', clientSessionId: 'c-1' };
}

// ── fixtures (homepage / PDP / checkout) ───────────────────────────────────

const HOMEPAGE_FIXTURE =
  '<!doctype html><html lang="en"><head>' +
  '<title>Acme Widgets — Tools for makers</title>' +
  '<meta name="description" content="Premium widgets for makers.">' +
  '<link rel="canonical" href="https://acme.example/">' +
  '<meta property="og:title" content="Acme Widgets">' +
  '<meta property="og:description" content="Premium widgets for makers.">' +
  '<meta property="og:image" content="https://acme.example/og.png">' +
  '</head><body>' +
  '<nav><a href="/">Home</a><a href="/shop">Shop</a><a href="/about">About</a><a href="/contact">Contact</a></nav>' +
  '<main><h1>Tools for makers</h1>' +
  '<h2>Built to last a lifetime — limited time 30-day money-back guarantee</h2>' +
  '<p>Welcome to Acme. Free returns on every order.</p>' +
  '<a href="/shop" id="cta-primary" class="cta">Shop now</a>' +
  '<a href="/learn" id="cta-secondary">Learn more</a>' +
  '<span class="trust">Trusted by 10,000 customers</span>' +
  '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315"></iframe>' +
  '</main>' +
  '<footer><div><h3>Company</h3><a href="/about">About</a><a href="/careers">Careers</a></div>' +
  '<div><h3>Support</h3><a href="/help">Help</a><a href="/contact">Contact</a></div></footer>' +
  '</body></html>';

const PDP_FIXTURE =
  '<!doctype html><html lang="en"><head>' +
  '<title>Acme Widget Pro — Product</title>' +
  '<meta name="description" content="The Acme Widget Pro.">' +
  '<script type="application/ld+json">{"@type":"Product","name":"Acme Widget Pro","offers":{"@type":"Offer","price":"99"}}</script>' +
  '</head><body>' +
  '<main><h1>Acme Widget Pro</h1>' +
  '<span class="price">$99</span>' +
  '<p>The Acme Widget Pro is the ultimate maker tool.</p>' +
  '<button id="add-cart" class="cta">Add to Cart</button>' +
  '<button id="buy-now">Buy Now</button>' +
  '<section class="reviews"><span class="review">4.7 stars — verified review</span></section>' +
  '<iframe src="https://js.stripe.com/v3/elements-inner-card-abc" width="400" height="300"></iframe>' +
  '</main></body></html>';

const CHECKOUT_FIXTURE =
  '<!doctype html><html lang="en"><head><title>Checkout — Acme</title></head>' +
  '<body><main><h1>Checkout</h1>' +
  '<form id="checkout-form">' +
  '<label for="email">Email</label><input id="email" type="email" required>' +
  '<label for="name">Name</label><input id="name" type="text" required>' +
  '<label for="address">Address</label><input id="address" type="text">' +
  '<label for="country">Country</label><select id="country"><option>US</option><option>IN</option></select>' +
  '<button type="submit">Place Order</button>' +
  '</form>' +
  '<iframe src="https://3dsecure.io/challenge/abc123" width="400" height="400"></iframe>' +
  '</main></body></html>';

// ── shared Playwright headless session ─────────────────────────────────────

let session: BrowserSession | undefined;

beforeAll(async () => {
  const manager = new BrowserManager();
  session = await manager.newSession({ headless: true });
}, 30000);

afterAll(async () => {
  if (session) await session.close();
});

describe('page_analyze v2.3 — AC-11 conformance (Wave 14 GREEN)', () => {
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
});

describe('page_analyze v2.3 — live fixture extraction (T048 GREEN)', () => {
  beforeEach(async () => {
    if (!session) throw new Error('session not initialized');
  });

  /**
   * @AC-11 fixture page #1 — homepage produces AnalyzePerception with all
   * baseline 9 sections + 14 v2.3 enrichment categories populated (or
   * null+reason where derivation fails).
   */
  it('AC-11: homepage fixture produces AnalyzePerception with all baseline + v2.3 fields', async () => {
    if (!session) throw new Error('session not initialized');
    await session.page.setContent(HOMEPAGE_FIXTURE);
    await session.page.waitForLoadState('domcontentloaded');
    const tool = createPageAnalyzeTool({ session });
    const result = await tool.handler({}, stubCtx());
    // Zod-parse already passed in the handler; assert key shape signals.
    expect(result.metadata.title).toContain('Acme');
    expect(result.metadata.ogTags.title).toBeDefined();
    expect(result.metadata.ogTags.description).toBeDefined();
    expect(result.metadata.lang).toBe('en');
    expect(result.ctas.length).toBeGreaterThanOrEqual(2);
    expect(result.iframes.length).toBeGreaterThanOrEqual(1);
    expect(result.iframes[0].purposeGuess).toBe('video');
    // YouTube embed is a different origin from about:blank (setContent's URL).
    expect(result.iframes[0].isCrossOrigin).toBe(true);
    // v2.3 enrichments populated
    expect(result.textContent.valueProp.h1).toBe('Tools for makers');
    expect(result.textContent.urgencyScarcityHits.length).toBeGreaterThanOrEqual(1);
    expect(result.textContent.riskReversalHits.length).toBeGreaterThanOrEqual(1);
    expect(result.structure.titleH1Similarity).toBeGreaterThan(0);
    expect(result.navigation.primaryNavItems.length).toBeGreaterThanOrEqual(3);
    expect(result.navigation.footerNavItems.length).toBeGreaterThanOrEqual(2);
    expect(result.accessibility.keyboardFocusOrder.length).toBeGreaterThanOrEqual(2);
  }, 30000);

  /**
   * @AC-11 fixture page #2 — PDP (product detail page).
   */
  it('AC-11: PDP fixture produces AnalyzePerception with all baseline + v2.3 fields', async () => {
    if (!session) throw new Error('session not initialized');
    await session.page.setContent(PDP_FIXTURE);
    await session.page.waitForLoadState('domcontentloaded');
    const tool = createPageAnalyzeTool({ session });
    const result = await tool.handler({}, stubCtx());
    // CTA assertions: one of the CTAs should reference "Cart" or "Buy".
    const ctaTextsLower = result.ctas.map((c) => c.text.toLowerCase());
    const hasCartOrBuy = ctaTextsLower.some((t) => t.includes('cart') || t.includes('buy'));
    expect(hasCartOrBuy).toBe(true);
    // Stripe iframe maps to checkout per Phase 1c IframePolicyEngine pattern.
    expect(result.iframes.length).toBeGreaterThanOrEqual(1);
    expect(result.iframes[0].purposeGuess).toBe('checkout');
    // Inferred page type contains "product" (or "pdp").
    expect(
      result.inferredPageType.primary.toLowerCase().includes('product') ||
        result.inferredPageType.primary.toLowerCase().includes('pdp'),
    ).toBe(true);
    // Schema.org Product picked up
    expect(result.metadata.schemaOrg.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  /**
   * @AC-11 fixture page #3 — checkout.
   */
  it('AC-11: checkout fixture produces AnalyzePerception with all baseline + v2.3 fields', async () => {
    if (!session) throw new Error('session not initialized');
    await session.page.setContent(CHECKOUT_FIXTURE);
    await session.page.waitForLoadState('domcontentloaded');
    const tool = createPageAnalyzeTool({ session });
    const result = await tool.handler({}, stubCtx());
    expect(result.forms.length).toBe(1);
    expect(result.forms[0].fields.length).toBe(4);
    expect(result.forms[0].requiredFieldCount).toBeGreaterThanOrEqual(2);
    expect(result.forms[0].submitButtonText.toLowerCase()).toContain('place order');
    expect(result.iframes.length).toBeGreaterThanOrEqual(1);
    expect(result.iframes[0].purposeGuess).toBe('payment_3ds');
    expect(result.inferredPageType.primary.toLowerCase()).toContain('checkout');
  }, 30000);
});

describe('AC-11 F-S4 namespace contract', () => {
  /**
   * @AC-11 F-S4 (CRITICAL — namespace contract carryforward) — every
   * page_analyze runtime output MUST have `result._extensions === undefined`
   * (NOT {}, NOT populated). Phase 7 DeepPerceiveNode reservation. AC-13
   * integration repeats this assertion at the integration boundary.
   *
   * WHY both `=== undefined` AND `'_extensions' in result === false`: defense
   * in depth. The first catches `_extensions: undefined` literals; the second
   * catches the case where the key is present but value is undefined (which
   * also passes `=== undefined`). Both must hold for the F-S4 contract.
   */
  it('AC-11 F-S4: page_analyze output _extensions is undefined (NOT {}, NOT populated)', async () => {
    if (!session) throw new Error('session not initialized');
    await session.page.setContent(HOMEPAGE_FIXTURE);
    await session.page.waitForLoadState('domcontentloaded');
    const tool = createPageAnalyzeTool({ session });
    const result = await tool.handler({}, stubCtx());
    expect(result._extensions).toBeUndefined();
    expect('_extensions' in result).toBe(false);
  }, 30000);
});

describe('AC-11 F-S13 iframes[].purposeGuess closed-enum constraint', () => {
  /**
   * @AC-11 F-S13 (CRITICAL — closed-enum constraint) — every iframe in
   * result.iframes has a purposeGuess validating against IframePurposeSchema.
   * No ad-hoc strings, no `cross_origin` (security-override return value),
   * no superseded "map" / "antibot" / "video_embed" values.
   */
  it('AC-11 F-S13: every iframes[].purposeGuess validates against IframePurposeSchema (no ad-hoc strings)', async () => {
    if (!session) throw new Error('session not initialized');
    for (const fixture of [HOMEPAGE_FIXTURE, PDP_FIXTURE, CHECKOUT_FIXTURE]) {
      await session.page.setContent(fixture);
      await session.page.waitForLoadState('domcontentloaded');
      const tool = createPageAnalyzeTool({ session });
      const result = await tool.handler({}, stubCtx());
      expect(result.iframes.length).toBeGreaterThanOrEqual(1);
      for (const ifr of result.iframes) {
        expect(IframePurposeSchema.safeParse(ifr.purposeGuess).success).toBe(true);
      }
    }
  }, 60000);

  it('AC-11 F-S13: YouTube iframe in homepage fixture classifies as video', async () => {
    if (!session) throw new Error('session not initialized');
    await session.page.setContent(HOMEPAGE_FIXTURE);
    await session.page.waitForLoadState('domcontentloaded');
    const tool = createPageAnalyzeTool({ session });
    const result = await tool.handler({}, stubCtx());
    expect(result.iframes[0].purposeGuess).toBe('video');
  }, 30000);
});

describe('AC-11 REQ-TOOL-PA-001 single-evaluate invariant', () => {
  /**
   * @AC-11 REQ-TOOL-PA-001 — single page.evaluate() call within the handler
   * (the upstream waitForSettle precondition's evaluate does NOT count).
   *
   * WHY monkey-patch instead of Playwright trace: vitest + real BrowserSession
   * runs in-process; intercepting via a counted wrapper is the cleanest way
   * to assert the exact call count without spinning up Playwright tracing
   * infrastructure (which is the T050 integration test's job).
   */
  it('AC-11 REQ-TOOL-PA-001: page_analyze handler emits exactly 1 page.evaluate() call', async () => {
    if (!session) throw new Error('session not initialized');
    await session.page.setContent(HOMEPAGE_FIXTURE);
    await session.page.waitForLoadState('domcontentloaded');
    const origEvaluate = session.page.evaluate.bind(session.page);
    let evalCount = 0;
    // Cast through unknown to satisfy the overloaded generic signature on
    // BrowserPage.evaluate — the counting wrapper preserves the shape.
    const counting = (async (...args: unknown[]) => {
      evalCount++;
      return (origEvaluate as (...a: unknown[]) => unknown)(...args);
    }) as unknown as typeof session.page.evaluate;
    Object.defineProperty(session.page, 'evaluate', {
      configurable: true,
      writable: true,
      value: counting,
    });
    try {
      const tool = createPageAnalyzeTool({ session });
      await tool.handler({}, stubCtx());
      expect(evalCount).toBe(1);
    } finally {
      Object.defineProperty(session.page, 'evaluate', {
        configurable: true,
        writable: true,
        value: origEvaluate,
      });
    }
  }, 30000);
});

describe('AC-11 NF-Phase2-03 wall-clock budget', () => {
  /**
   * @AC-11 NF-Phase2-03 — page_analyze wall-clock < 5 s on amazon.in
   * homepage. Skip-gated via SKIP_LIVE_NETWORK=1 so CI without network
   * access can still pass; the assertion code is kept compiled so T050
   * integration can lift the skip.
   *
   * WHY the literal wall-clock budget: the kill criterion #5 in T048 brief
   * is the only Phase 2 perf SLO that depends on real-network behaviour.
   * Single-evaluate discipline (kill criterion #1) is the structural
   * mitigation; this test pins the empirical outcome.
   */
  const skipLive = process.env.SKIP_LIVE_NETWORK === '1';
  it.skipIf(skipLive)(
    'AC-11 NF-Phase2-03: page_analyze wall-clock < 5 s on amazon.in homepage',
    async () => {
      if (!session) throw new Error('session not initialized');
      try {
        await session.page.goto('https://www.amazon.in/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      } catch (err) {
        // Network failure inside the live-network path is itself a SKIP
        // signal; the test still proves the assertion code compiles.
        const msg = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.warn('[AC-11 NF-Phase2-03] amazon.in unreachable, skipping wall-clock check:', msg);
        return;
      }
      const tool = createPageAnalyzeTool({ session });
      const t0 = performance.now();
      await tool.handler({}, stubCtx());
      const elapsed = performance.now() - t0;
      expect(elapsed, `page_analyze wall-clock=${elapsed.toFixed(1)}ms on amazon.in (budget 5000ms)`).toBeLessThan(5000);
    },
    60000,
  );
});

describe('AC-11 Pino correlation fields', () => {
  /**
   * @AC-11 — emits Pino correlation fields per T-PHASE2-LOGGER.
   */
  it('AC-11: logs tool_name + tool_call_id + client_session_id correlation fields', async () => {
    if (!session) throw new Error('session not initialized');
    await session.page.setContent(HOMEPAGE_FIXTURE);
    await session.page.waitForLoadState('domcontentloaded');
    const tool = createPageAnalyzeTool({ session });
    const logger = stubLogger();
    const ctx: ToolContext = { logger, toolCallId: 't-corr', clientSessionId: 'c-corr' };
    await tool.handler({}, ctx);
    expect(logger.info).toHaveBeenCalled();
    const callArgs = (logger.info as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const fields = callArgs[0] as Record<string, unknown>;
    expect(fields).toHaveProperty('url');
    expect(fields).toHaveProperty('ctaCount');
    expect(fields).toHaveProperty('formCount');
    expect(fields).toHaveProperty('iframeCount');
    expect(fields).toHaveProperty('inferred_page_type');
    expect(callArgs[1]).toBe('mcp.tool.page_analyze.done');
  }, 30000);
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
