/**
 * TierValidator — maps Heuristic.category to Tier 1/2/3 admission tier.
 *
 * Source: docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-09 (line 161);
 *         tasks.md T109 (lines 188-195).
 *
 * Tier semantics:
 *   - Tier 1 = visual / structural (layout, spacing, contrast, navigation)
 *   - Tier 2 = content / persuasion (microcopy, social proof, trust signals)
 *   - Tier 3 = subjective (brand tone, aesthetic preference, emotional appeal)
 *
 * Unclassified categories are rejected via TierValidationError.
 *
 * R9: categoryMap is constructor-injectable for override.
 * R6: pure; no logging of heuristic body.
 *
 * @AC-09
 */
import type { HeuristicExtended } from './types.js';

export type Tier = 1 | 2 | 3;

export class TierValidationError extends Error {
  public readonly heuristicId: string;
  public readonly category: string;

  constructor(heuristicId: string, category: string) {
    super(
      `TierValidator: heuristic '${heuristicId}' has unclassified category '${category}' — no tier mapping defined.`,
    );
    this.name = 'TierValidationError';
    this.heuristicId = heuristicId;
    this.category = category;
  }
}

/**
 * Default category → tier map.
 *
 * Covers spec defaults plus all categories observed in current fixtures:
 *   packages/agent-core/tests/fixtures/heuristics/*.json
 *   heuristics-repo/{baymard,cialdini,nielsen,multi-viewport}/*.json
 *
 * To add a category, place it in the most-appropriate tier.
 */
export const DEFAULT_CATEGORY_TIER_MAP: Readonly<Record<string, Tier>> = Object.freeze({
  // Tier 1 — visual / structural (layout, navigation, accessibility, performance)
  checkout_friction: 1,
  form_design: 1,
  form_usability: 1,
  checkout_form_design: 1,
  mobile_ux: 1,
  navigation: 1,
  navigation_clarity: 1,
  accessibility: 1,
  visual_hierarchy: 1,
  viewport_layout: 1,
  visibility: 1,
  search: 1,
  search_discoverability: 1,
  filtering: 1,
  cart: 1,
  cart_usability: 1,
  performance: 1,
  error_prevention: 1,
  error_recovery: 1,
  user_control: 1,
  flexibility: 1,
  recognition: 1,
  consistency: 1,
  consistency_standards: 1,
  match_real_world: 1,
  help: 1,
  product_page: 1,
  product_imagery: 1,

  // Tier 2 — content / persuasion (copy, social proof, trust)
  copywriting: 2,
  social_proof: 2,
  trust_signals: 2,
  trust: 2,
  cta_clarity: 2,
  value_prop: 2,
  authority: 2,
  scarcity: 2,
  reciprocity: 2,
  commitment: 2,
  cart_merchandising: 2,
  pricing_display: 2,
  shipping_transparency: 2,
  product_information: 2,
  product_availability: 2,
  homepage_banner_clarity: 2,
  homepage_catalog_scope: 2,

  // Tier 3 — subjective (brand voice, taste, emotion)
  brand_voice: 3,
  brand_tone: 3,
  emotional_appeal: 3,
  aesthetic_preference: 3,
  aesthetic: 3,
  liking: 3,
  unity: 3,
});

export interface ClassifyResult {
  readonly tier: Tier;
}

export class TierValidator {
  private readonly map: Readonly<Record<string, Tier>>;

  constructor(categoryMap?: Record<string, Tier>) {
    this.map = categoryMap ? Object.freeze({ ...categoryMap }) : DEFAULT_CATEGORY_TIER_MAP;
  }

  /**
   * Classify a heuristic into a tier. Throws TierValidationError if the
   * category is not in the map.
   */
  classify(heuristic: HeuristicExtended): ClassifyResult {
    const tier = this.map[heuristic.category];
    if (tier === undefined) {
      throw new TierValidationError(heuristic.id, heuristic.category);
    }
    return { tier };
  }

  /** Alias retained for spec-API convenience. */
  validate(heuristic: HeuristicExtended): Tier {
    return this.classify(heuristic).tier;
  }
}
