/**
 * Conformance test for AC-13 (T4B-013) — HeuristicLoader.loadForContext.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-13
 *     ("HeuristicLoader extension loads with ContextProfile; filters by
 *      business.archetype + page.type + traffic.device_priority; returns
 *      12-25 heuristics for typical context when heuristic library ≥40
 *      entries; 8-25 acceptable when library <40 (Phase 0b shipped 30
 *      heuristics — Phase 4b first verification expected to land in the
 *      8-25 band). No weight modifiers — filter only.")
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-013
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.5
 *     REQ-CONTEXT-DOWNSTREAM-001
 *
 * AC-13 scope (this file):
 *   - loadForContext(profile) returns heuristics matching all 3 manifest
 *     selectors (archetype + page_type + device)
 *   - Universal heuristics (no selectors) ALWAYS included
 *   - LOCKED-only enum values (service archetype, post_purchase / category /
 *     blog / about page types) skip that dimension's filter ("applies to
 *     all" semantics — same as matchesSelector with undefined selector)
 *   - Disjointness ≥ 0.5 between two distinct profiles per AC-13.2 / US-5
 *   - Filter count band: returned count is non-zero AND ≤ input set
 *     (8-25 band assumes ≥40 library; in-test fixtures keep band sanity
 *     check rather than absolute lower bound)
 *
 * R3.1 TDD: this conformance test is authored BEFORE the loadForContext
 * implementation lands; the missing-method failure is the expected initial
 * red state. Drives implementation in loader.ts.
 *
 * Test seam (intentional): loadForContext accepts an optional second arg
 * `{ heuristics?: HeuristicExtended[] }`; when supplied, the loader skips
 * the file-system loadAll() call and uses the inline fixture array. This
 * isolates filter logic from filesystem in this conformance test (and is
 * documented in code comment as a test seam, NOT a public API contract).
 *
 * Anchor: @AC-13 — HeuristicLoader manifest-selector filter.
 */
import { describe, expect, test } from 'vitest';

import { HeuristicLoader } from '../../src/analysis/heuristics/loader.js';
import {
  HeuristicSchemaExtended,
  type HeuristicExtended,
} from '../../src/analysis/heuristics/types.js';
import type { ContextProfile } from '../../src/types/context-profile.js';

// ---------------------------------------------------------------------------
// Fixture builders (inline — no filesystem dependency)
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid HeuristicExtended via the canonical Zod schema so
 * the fixture exercises the same shape the file-system loader produces.
 */
function makeHeuristic(
  id: string,
  selectors: {
    archetype?: HeuristicExtended['archetype'];
    page_type?: HeuristicExtended['page_type'];
    device?: HeuristicExtended['device'];
  },
): HeuristicExtended {
  // Build object with optional manifest selectors only when defined to
  // keep the .strict() Zod parse happy under exactOptionalPropertyTypes.
  const base = {
    id,
    body: 'TEST FIXTURE — NEURAL_TEST_FIXTURE_BODY (loader-filter conformance).',
    category: 'fixture_category',
    version: '0.0.1',
    rule_vs_guidance: 'rule' as const,
    business_impact_weight: 0.5,
    effort_category: 'quick_win' as const,
    preferred_states: ['default'],
    status: 'active' as const,
    benchmark: {
      kind: 'qualitative' as const,
      standard_text: 'TEST FIXTURE qualitative benchmark',
    },
    provenance: {
      source_url: 'https://example.test/loader-filter-fixture',
      citation_text: 'TEST FIXTURE — synthetic citation',
      draft_model: 'human' as const,
      verified_by: 'loader-filter-test-author',
      verified_date: '2026-05-15T00:00:00Z',
    },
  };
  const candidate: Record<string, unknown> = { ...base };
  if (selectors.archetype !== undefined) candidate['archetype'] = selectors.archetype;
  if (selectors.page_type !== undefined) candidate['page_type'] = selectors.page_type;
  if (selectors.device !== undefined) candidate['device'] = selectors.device;
  return HeuristicSchemaExtended.parse(candidate);
}

/**
 * 15-heuristic in-memory library mixing each context bucket the AC-13.2
 * disjointness assertion needs, plus universal entries that overlap
 * across all profiles.
 */
function buildLibrary(): HeuristicExtended[] {
  return [
    // 3 D2C/pdp/mobile
    makeHeuristic('FIX-D2CPDP-001', { archetype: ['D2C'], page_type: ['pdp'], device: ['mobile'] }),
    makeHeuristic('FIX-D2CPDP-002', { archetype: ['D2C'], page_type: ['pdp'], device: ['mobile'] }),
    makeHeuristic('FIX-D2CPDP-003', { archetype: ['D2C'], page_type: ['pdp'], device: ['mobile'] }),
    // 3 SaaS/pricing/desktop
    makeHeuristic('FIX-SAAS-001', { archetype: ['SaaS'], page_type: ['pricing'], device: ['desktop'] }),
    makeHeuristic('FIX-SAAS-002', { archetype: ['SaaS'], page_type: ['pricing'], device: ['desktop'] }),
    makeHeuristic('FIX-SAAS-003', { archetype: ['SaaS'], page_type: ['pricing'], device: ['desktop'] }),
    // 3 B2B/comparison/balanced
    makeHeuristic('FIX-B2B-001', { archetype: ['B2B'], page_type: ['comparison'], device: ['balanced'] }),
    makeHeuristic('FIX-B2B-002', { archetype: ['B2B'], page_type: ['comparison'], device: ['balanced'] }),
    makeHeuristic('FIX-B2B-003', { archetype: ['B2B'], page_type: ['comparison'], device: ['balanced'] }),
    // 3 universal (no selectors → "applies to all")
    makeHeuristic('FIX-UNIV-001', {}),
    makeHeuristic('FIX-UNIV-002', {}),
    makeHeuristic('FIX-UNIV-003', {}),
    // 3 D2C+marketplace cart/mobile (multi-archetype)
    makeHeuristic('FIX-CART-001', {
      archetype: ['D2C', 'marketplace'],
      page_type: ['cart'],
      device: ['mobile'],
    }),
    makeHeuristic('FIX-CART-002', {
      archetype: ['D2C', 'marketplace'],
      page_type: ['cart'],
      device: ['mobile'],
    }),
    makeHeuristic('FIX-CART-003', {
      archetype: ['D2C', 'marketplace'],
      page_type: ['cart'],
      device: ['mobile'],
    }),
  ];
}

/**
 * Build a minimal ContextProfile with only the three fields loadForContext
 * reads (business.archetype, page.type, traffic.device_priority). The rest
 * of the schema is satisfied via partial object cast — loadForContext MUST
 * NOT depend on any other field per the spec / R20 contract surface.
 */
function makeProfile(
  archetype: ContextProfile['business']['archetype']['value'],
  pageType: ContextProfile['page']['type']['value'],
  devicePriority: ContextProfile['traffic']['device_priority']['value'],
): ContextProfile {
  // Cast: tests only the three filter-input fields; loadForContext MUST
  // touch nothing else. If implementation reads other fields, tests blow
  // up at runtime (undefined access) — desirable failure mode.
  const skeleton = {
    business: {
      archetype: { value: archetype, source: 'user', confidence: 1 },
    },
    page: {
      type: { value: pageType, source: 'user', confidence: 1 },
    },
    traffic: {
      device_priority: { value: devicePriority, source: 'user', confidence: 1 },
    },
  };
  return skeleton as unknown as ContextProfile;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeuristicLoader.loadForContext — AC-13 conformance', () => {
  /**
   * @AC-13 D2C + PDP + mobile — matches 3 D2C/pdp/mobile heuristics +
   * 3 universal = 6. (FIX-CART-* match D2C+mobile but page_type 'cart'
   * !== 'pdp' so they are excluded.)
   */
  test('AC-13: D2C + PDP + mobile → 6 (3 specific + 3 universal)', async () => {
    const loader = new HeuristicLoader();
    const profile = makeProfile('D2C', 'PDP', 'mobile');
    const result = await loader.loadForContext(profile, { heuristics: buildLibrary() });
    const ids = result.map((h) => h.id).sort();
    expect(ids).toEqual([
      'FIX-D2CPDP-001',
      'FIX-D2CPDP-002',
      'FIX-D2CPDP-003',
      'FIX-UNIV-001',
      'FIX-UNIV-002',
      'FIX-UNIV-003',
    ]);
  });

  /**
   * @AC-13 SaaS + pricing + desktop — matches 3 SaaS + 3 universal = 6.
   */
  test('AC-13: SaaS + pricing + desktop → 6 (3 specific + 3 universal)', async () => {
    const loader = new HeuristicLoader();
    const profile = makeProfile('SaaS', 'pricing', 'desktop');
    const result = await loader.loadForContext(profile, { heuristics: buildLibrary() });
    const ids = result.map((h) => h.id).sort();
    expect(ids).toEqual([
      'FIX-SAAS-001',
      'FIX-SAAS-002',
      'FIX-SAAS-003',
      'FIX-UNIV-001',
      'FIX-UNIV-002',
      'FIX-UNIV-003',
    ]);
  });

  /**
   * @AC-13 B2B + comparison + balanced — matches 3 B2B + 3 universal = 6.
   */
  test('AC-13: B2B + comparison + balanced → 6 (3 specific + 3 universal)', async () => {
    const loader = new HeuristicLoader();
    const profile = makeProfile('B2B', 'comparison', 'balanced');
    const result = await loader.loadForContext(profile, { heuristics: buildLibrary() });
    const ids = result.map((h) => h.id).sort();
    expect(ids).toEqual([
      'FIX-B2B-001',
      'FIX-B2B-002',
      'FIX-B2B-003',
      'FIX-UNIV-001',
      'FIX-UNIV-002',
      'FIX-UNIV-003',
    ]);
  });

  /**
   * @AC-13 D2C + cart + mobile — matches 3 D2CPDP heuristics? NO (page
   * 'pdp' !== 'cart'). Matches FIX-CART-* (3, since cart selector includes
   * D2C and mobile). Plus 3 universal = 6.
   */
  test('AC-13: D2C + cart + mobile → multi-archetype + universal = 6', async () => {
    const loader = new HeuristicLoader();
    const profile = makeProfile('D2C', 'cart', 'mobile');
    const result = await loader.loadForContext(profile, { heuristics: buildLibrary() });
    const ids = result.map((h) => h.id).sort();
    expect(ids).toEqual([
      'FIX-CART-001',
      'FIX-CART-002',
      'FIX-CART-003',
      'FIX-UNIV-001',
      'FIX-UNIV-002',
      'FIX-UNIV-003',
    ]);
  });

  /**
   * @AC-13 LOCKED-only archetype 'service' has no preliminary counterpart.
   * Mapper returns null → archetype filter is SKIPPED (= "applies to all"
   * semantics). Page + device filter still apply. With service + pdp +
   * mobile, ALL pdp/mobile heuristics regardless of archetype + universal
   * heuristics match → 3 (D2CPDP, mobile-pdp matches archetype-skip) + 3
   * universal = 6.
   */
  test('AC-13: service archetype skips archetype filter (LOCKED-only enum)', async () => {
    const loader = new HeuristicLoader();
    const profile = makeProfile('service', 'PDP', 'mobile');
    const result = await loader.loadForContext(profile, { heuristics: buildLibrary() });
    const ids = result.map((h) => h.id).sort();
    // service has no preliminary counterpart → archetype filter skipped;
    // page=pdp and device=mobile filter both apply. FIX-D2CPDP-* match
    // pdp+mobile; FIX-CART-* match mobile but cart !== pdp; FIX-SAAS/B2B
    // pages don't match. Plus universal.
    expect(ids).toEqual([
      'FIX-D2CPDP-001',
      'FIX-D2CPDP-002',
      'FIX-D2CPDP-003',
      'FIX-UNIV-001',
      'FIX-UNIV-002',
      'FIX-UNIV-003',
    ]);
  });

  /**
   * @AC-13 LOCKED-only page type 'post_purchase' has no preliminary
   * counterpart. Mapper returns null → page filter is SKIPPED. With D2C
   * + post_purchase + mobile, all D2C/mobile heuristics regardless of page
   * + universal match → FIX-D2CPDP-* (D2C + mobile) + FIX-CART-* (D2C +
   * mobile) + 3 universal = 9.
   */
  test('AC-13: post_purchase page skips page filter (LOCKED-only enum)', async () => {
    const loader = new HeuristicLoader();
    const profile = makeProfile('D2C', 'post_purchase', 'mobile');
    const result = await loader.loadForContext(profile, { heuristics: buildLibrary() });
    const ids = result.map((h) => h.id).sort();
    expect(ids).toEqual([
      'FIX-CART-001',
      'FIX-CART-002',
      'FIX-CART-003',
      'FIX-D2CPDP-001',
      'FIX-D2CPDP-002',
      'FIX-D2CPDP-003',
      'FIX-UNIV-001',
      'FIX-UNIV-002',
      'FIX-UNIV-003',
    ]);
  });

  /**
   * @AC-13.2 / User Story 5 — disjoint sets between distinct profiles.
   * D2C/pdp/mobile result vs B2B/comparison/balanced result share only
   * the 3 universal heuristics (3/6 = 50%). The non-universal portions
   * are fully disjoint.
   */
  test('AC-13.2: distinct profiles produce disjoint specific sets (≥50%)', async () => {
    const loader = new HeuristicLoader();
    const lib = buildLibrary();
    const aIds = (
      await loader.loadForContext(makeProfile('D2C', 'PDP', 'mobile'), { heuristics: lib })
    ).map((h) => h.id);
    const bIds = (
      await loader.loadForContext(makeProfile('B2B', 'comparison', 'balanced'), {
        heuristics: lib,
      })
    ).map((h) => h.id);
    const aSet = new Set(aIds);
    const intersection = bIds.filter((id) => aSet.has(id));
    const union = new Set([...aIds, ...bIds]);
    const overlapPct = intersection.length / union.size;
    // Universal heuristics overlap (3 of 9 union items = 0.33). Specific
    // portions are fully disjoint. Assert ≥ 0.5 disjointness = ≤ 0.5 overlap.
    expect(overlapPct).toBeLessThanOrEqual(0.5);
  });

  /**
   * @AC-13 / NF-06 filter count sanity band. The 8-25 band in the spec
   * assumes a heuristic library of ≥40 entries; with 15 in-test fixtures,
   * we assert only that the filter (a) returns a non-zero set, (b) does
   * not exceed the input set size, and (c) the universal portion alone
   * (lower bound = 3) is respected. Full 8-25 band is exercised in the
   * Phase 4b integration test (T4B-015) against the real heuristics-repo.
   */
  test('AC-13: filter count is non-zero and bounded by input library size', async () => {
    const loader = new HeuristicLoader();
    const lib = buildLibrary();
    const result = await loader.loadForContext(makeProfile('D2C', 'PDP', 'mobile'), {
      heuristics: lib,
    });
    expect(result.length).toBeGreaterThanOrEqual(3); // universal floor
    expect(result.length).toBeLessThanOrEqual(lib.length);
    expect(result.length).toBeGreaterThan(0);
  });

  /**
   * @AC-13 mapper coverage: every LOCKED BusinessArchetype value loads
   * without throwing. Universal heuristics always come back (they match
   * regardless of mapping). This catches a missing entry in the mapper
   * table at test time rather than via runtime crash.
   */
  test('AC-13: mapper handles all 6 LOCKED BusinessArchetype values', async () => {
    const loader = new HeuristicLoader();
    const lib = buildLibrary();
    const archetypes: ContextProfile['business']['archetype']['value'][] = [
      'D2C',
      'B2B',
      'SaaS',
      'marketplace',
      'lead_gen',
      'service',
    ];
    for (const archetype of archetypes) {
      const result = await loader.loadForContext(makeProfile(archetype, 'PDP', 'mobile'), {
        heuristics: lib,
      });
      // Every result MUST contain the universal heuristics — proves the
      // loader did not throw and the mapper returned a usable filter.
      expect(result.some((h) => h.id === 'FIX-UNIV-001')).toBe(true);
    }
  });

  /**
   * @AC-13 mapper coverage: every LOCKED PageType value loads without
   * throwing. Same rationale as the BusinessArchetype coverage test.
   */
  test('AC-13: mapper handles all 12 LOCKED PageType values', async () => {
    const loader = new HeuristicLoader();
    const lib = buildLibrary();
    const pageTypes: ContextProfile['page']['type']['value'][] = [
      'home',
      'PLP',
      'PDP',
      'cart',
      'checkout',
      'post_purchase',
      'category',
      'landing',
      'blog',
      'about',
      'pricing',
      'comparison',
    ];
    for (const pageType of pageTypes) {
      const result = await loader.loadForContext(makeProfile('D2C', pageType, 'mobile'), {
        heuristics: lib,
      });
      expect(result.some((h) => h.id === 'FIX-UNIV-001')).toBe(true);
    }
  });

  /**
   * @AC-13 mapper coverage: every LOCKED device_priority value loads
   * without throwing. All 3 device values map 1:1 to preliminary enum.
   */
  test('AC-13: mapper handles all 3 LOCKED device_priority values', async () => {
    const loader = new HeuristicLoader();
    const lib = buildLibrary();
    const devices: ContextProfile['traffic']['device_priority']['value'][] = [
      'mobile',
      'desktop',
      'balanced',
    ];
    for (const device of devices) {
      const result = await loader.loadForContext(makeProfile('D2C', 'PDP', device), {
        heuristics: lib,
      });
      expect(result.some((h) => h.id === 'FIX-UNIV-001')).toBe(true);
    }
  });
});
