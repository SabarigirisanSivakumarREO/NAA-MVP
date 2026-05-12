/**
 * Phase 2 — Integration test (AC-13).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-13 + R-15 + SC-001 + NF-Phase2-04
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T050
 *   docs/specs/mvp/phases/phase-2-tools/impact.md §AnalyzePerception §F-S4
 *     (namespace contract carryforward — Phase 1c impact.md §11)
 *
 * AC-13 contract:
 *   - Boots in-process MCP server, registers all 29 MCP tools
 *     (22 browser_* + 2 agent_* + 5 page_*)
 *   - Exercises every tool against amazon.in (or stable fixture if amazon
 *     flakes), asserts Zod-valid output OR documented typed error
 *   - Total wall-clock < 5 minutes (NF-Phase2-04)
 *   - F-S4 NAMESPACE CONTRACT: page_analyze output _extensions === undefined
 *     (Phase 7 DeepPerceiveNode reservation; Phase 1c impact.md §11)
 *
 * RED state — gate test for the entire Phase 2 surface. Lands GREEN once
 *   T016-T049 + T-PHASE2-LOGGER + T-PHASE2-TYPES + T019 all complete.
 *   All exec assertions are `it.todo` until the surface exists; the
 *   F-S4 namespace contract live assertion runs against the (real)
 *   AnalyzePerceptionSchema NOW so the namespace expectation is pinned at
 *   schema level.
 *
 * Per tasks.md T050 constraint: "Test suite organized as one describe()
 *   per tool category. Namespace assertion in its own
 *   describe('namespace contract') block for grep-discoverability."
 *
 * Anchor: @AC-13 — 29-tool exercise + namespace contract assertion.
 */
import { describe, expect, it } from 'vitest';

import { AnalyzePerceptionSchema } from '../../src/analysis/index.js';

// NOTE (R3.1): downstream imports below deliberately commented out so this
// file compiles + loads cleanly until T019 + T020-T050 land. Uncomment when
// MCPServerAdapter + ToolRegistry exist:
// import { MCPServerAdapter } from '../../src/mcp/Server.js';
// import { ToolRegistry } from '../../src/mcp/ToolRegistry.js';

const PHASE2_TOTAL_WALL_CLOCK_MS = 5 * 60 * 1000; // NF-Phase2-04

const TOOL_NAMES_BROWSER = [
  'browser_navigate', 'browser_go_back', 'browser_go_forward', 'browser_reload',
  'browser_get_state', 'browser_screenshot', 'browser_get_metadata',
  'browser_click', 'browser_click_coords', 'browser_type', 'browser_scroll',
  'browser_select', 'browser_hover', 'browser_press_key', 'browser_upload',
  'browser_tab_manage', 'browser_extract', 'browser_download',
  'browser_find_by_text', 'browser_get_network', 'browser_wait_for',
  'browser_evaluate',
] as const;

const TOOL_NAMES_AGENT = ['agent_complete', 'agent_request_human'] as const;

const TOOL_NAMES_PAGE = [
  'page_get_element_info', 'page_get_performance', 'page_screenshot_full',
  'page_annotate_screenshot', 'page_analyze',
] as const;

describe('Phase 2 integration — AC-13 acceptance gate (29 MCP tools on amazon.in)', () => {
  describe('tool surface — 29 MCP tools register', () => {
    /**
     * @AC-13 — Phase 2 surface arity: 22 browser_* + 2 agent_* + 5 page_* = 29.
     */
    it('AC-13: tool surface arity sums to 29 (22 + 2 + 5)', () => {
      expect(TOOL_NAMES_BROWSER).toHaveLength(22);
      expect(TOOL_NAMES_AGENT).toHaveLength(2);
      expect(TOOL_NAMES_PAGE).toHaveLength(5);
      expect(TOOL_NAMES_BROWSER.length + TOOL_NAMES_AGENT.length + TOOL_NAMES_PAGE.length).toBe(29);
    });

    /**
     * @AC-13 — every tool name follows EXACT v3.1 naming (R4.5).
     */
    it('AC-13: every tool name matches /^(browser|agent|page)_[a-z_]+$/ (R4.5)', () => {
      const all = [...TOOL_NAMES_BROWSER, ...TOOL_NAMES_AGENT, ...TOOL_NAMES_PAGE];
      for (const name of all) {
        expect(name).toMatch(/^(browser|agent|page)_[a-z][a-z_]*$/);
      }
    });

    /**
     * @AC-13 — MCP server boots in-process; tools/list returns 29 entries.
     */
    it.todo('AC-13: MCPServerAdapter boots; tools/list returns 29 tool entries');
  });

  describe('browser_* tools — exercise on amazon.in', () => {
    /**
     * @AC-13 — every browser_* tool exercises against amazon.in (or stable
     * fixture on flake), returns Zod-valid output OR documented typed error.
     */
    it.todo(
      'AC-13: all 22 browser_* tools execute against amazon.in fixture; output Zod-valid or typed error',
      PHASE2_TOTAL_WALL_CLOCK_MS,
    );
  });

  describe('agent_* tools — exercise', () => {
    /**
     * @AC-13 — agent_complete + agent_request_human execute (orchestration
     * signals; not page actions).
     */
    it.todo('AC-13: agent_complete returns Zod-valid completion signal');
    it.todo('AC-13: agent_request_human returns Zod-valid HITL pause signal');
  });

  describe('page_* tools — exercise on amazon.in', () => {
    /**
     * @AC-13 — page_get_element_info, page_get_performance,
     * page_screenshot_full, page_annotate_screenshot, page_analyze all run.
     */
    it.todo(
      'AC-13: all 5 page_* tools execute against amazon.in; output Zod-valid or typed error',
      PHASE2_TOTAL_WALL_CLOCK_MS,
    );
  });

  /**
   * GREP-DISCOVERABLE NAMESPACE CONTRACT BLOCK (per tasks.md T050 constraint).
   * Phase 1c impact.md §11 + Phase 2 impact.md §AnalyzePerception §F-S4.
   * Phase 7 DeepPerceiveNode owns AnalyzePerception._extensions; Phase 2
   * MUST leave it `undefined` at runtime.
   */
  describe('namespace contract', () => {
    /**
     * @AC-13 F-S4 — Wave 0 schema-level guarantee: AnalyzePerceptionSchema
     * `_extensions` field is OPTIONAL (so leaving it undefined is valid).
     * This pins that the schema does not silently REQUIRE the field.
     */
    it('AC-13 F-S4: AnalyzePerceptionSchema accepts result with _extensions absent', () => {
      const result = AnalyzePerceptionSchema.safeParse(makeMinimalAnalyzePerception());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data._extensions).toBeUndefined();
      }
    });

    /**
     * @AC-13 F-S4 (CRITICAL — runtime invariant) — page_analyze output's
     * `_extensions` field is `undefined` (NOT {}, NOT populated). Phase 7
     * DeepPerceiveNode reservation. Will fail until T048 lands AND respects
     * the namespace contract.
     */
    it.todo('AC-13 F-S4: page_analyze output _extensions is undefined (NOT {}, NOT populated)');

    /**
     * @AC-13 F-S4 — repeats per page type (homepage / PDP / checkout) to
     * guard against per-fixture drift.
     */
    it.todo('AC-13 F-S4: page_analyze on homepage fixture leaves _extensions undefined');
    it.todo('AC-13 F-S4: page_analyze on PDP fixture leaves _extensions undefined');
    it.todo('AC-13 F-S4: page_analyze on checkout fixture leaves _extensions undefined');
  });

  describe('NF-Phase2-04 — total wall-clock', () => {
    /**
     * @AC-13 NF-Phase2-04 — total wall-clock for the full 29-tool exercise
     * < 5 minutes.
     */
    it.todo('AC-13 NF-Phase2-04: full 29-tool exercise completes in < 5 minutes');
  });
});

/**
 * Minimal AnalyzePerception fixture for SCHEMA-level conformance assertions.
 * Mirrors page-analyze-v23.test.ts; kept here so this file is self-contained
 * (no test-helper sharing across files).
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
