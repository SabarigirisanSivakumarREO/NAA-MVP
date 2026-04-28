# Heuristic Evaluation Layer — Build Spec

Purpose: apply CRO knowledge to captured facts (context + perception + state graph) and produce evidence-rich findings. The page-type-aware part: which heuristics run and how they're weighted depends on `ContextProfile`.

Sits between state exploration (provides facts) and recommendation report (formats output).

---

## 0. Mental model

Heuristic = a single CRO rule. Has:
- A query (what fact pattern to look for)
- A selector (which contexts it applies to)
- A weight modifier (how priority changes by context)
- A finding template (how to phrase the issue + recommendation)

Heuristic library = collection of heuristics, indexed by tags.

Evaluation = run applicable heuristics against the StateGraph + PerceptionBundles, emit findings, score them, dedupe.

This layer does NOT discover new states. It does NOT decide which experiments to run. It produces a ranked list of findings with evidence.

---

## 1. Heuristic anatomy

Every heuristic is a structured object, not free-text advice. This is what enables consistency, weighting, and evidence linking.

```
Heuristic {
  id: string,                                     # "cta_above_fold", "form_field_count", etc.
  name: string,                                   # human-readable
  category: "clarity" | "friction" | "trust" | "value_prop" | "social_proof" | "urgency" | "navigation" | "performance" | "accessibility",
  
  applies_to: {
    business_archetypes: [string] | "all",        # ["D2C", "marketplace"]
    page_types: [string] | "all",                 # ["PDP", "checkout"]
    devices: [string] | "all",                    # ["mobile", "desktop"]
    funnel_stages: [string] | "all",
    requires_constraints: [string]                # "WCAG_AA" → only fires if accessibility constraint set
  },
  
  query: function(stateGraph, perceptionBundles, context) → [Match],
  # Match = { state_id, element_id, evidence: {...} }
  
  base_weight: number,                            # 0-1, default importance
  weight_modifiers: [
    { when: { business: "B2B", page: "checkout" }, multiplier: 1.8 },
    { when: { aov_tier: "low" }, multiplier: 0.6 }
  ],
  
  severity_fn: function(match, context) → number, # 1-5
  effort_fn: function(match, context) → number,   # 1-5 (5 = high effort)
  confidence_fn: function(match, context) → number, # 0-1
  
  finding_template: {
    issue: string,                                # "{element} has contrast ratio {ratio}, below WCAG AA"
    why_it_matters: string,                       # CRO reasoning
    recommendation: string,                       # actionable
    expected_metric: string                       # "click-through rate", "form completion"
  },
  
  references: [string]                            # links to research/principles
}
```

The query function is the heart of the heuristic — it inspects the perception data and returns matches. Everything else (weighting, scoring, formatting) is mechanical.

---

## 2. Heuristic categories

Universal categories that apply across page types, with different weights:

### 2.1 Clarity

Can the visitor understand what this page offers in 5 seconds?

Examples:
- `value_prop_above_fold`: hero text articulates value within fold.
- `headline_specificity`: headline is concrete, not vague ("Save time" vs "Cut invoice processing from 4hrs to 15min").
- `primary_cta_clarity`: CTA copy describes the action, not just "Submit"/"Click here".
- `single_primary_cta`: one dominant CTA, not five competing ones.
- `cta_above_fold`: primary action visible without scrolling.

### 2.2 Friction

Where does the path narrow or get blocked?

Examples:
- `form_field_count`: vs page-type benchmark (checkout median ~12, lead-gen ~5).
- `required_account_creation`: forced signup before purchase.
- `payment_options_breadth`: cards, wallets, BNPL availability.
- `forced_modal_on_load`: blocking interstitial before content.
- `hidden_total_until_checkout`: shipping/tax revealed late.

### 2.3 Trust

Will the visitor believe this is safe and credible?

Examples:
- `trust_badges_visible`: SSL, payment-processor, review-platform badges present.
- `return_policy_accessible`: linked from PDP/cart, not buried in footer.
- `contact_info_present`: phone/email/address in footer.
- `privacy_policy_in_checkout`: present + linked from form.
- `secure_checkout_signaling`: lock icon, "secure" copy near payment.

### 2.4 Value proposition

Is the offer clear, specific, and differentiated?

Examples:
- `differentiation_articulated`: copy explains "why us" not just "what we do".
- `outcome_focused_copy`: benefits over features.
- `pricing_visible`: not behind "contact us" when shouldn't be.
- `comparison_to_alternatives`: vs competitor, vs status quo.

### 2.5 Social proof

Are real people vouching for this?

Examples:
- `reviews_present`: count + average rating visible.
- `review_recency`: most recent review < 90 days old.
- `review_distribution_shown`: not just "4.8 stars" but distribution histogram.
- `customer_logos_present` (B2B): named brands using the product.
- `case_studies_linked` (B2B): outcome-focused stories.
- `ugc_present` (D2C): real customer photos.
- `testimonial_specificity`: quotes with names, titles, photos — not anonymous.

### 2.6 Urgency / scarcity

Is there a credible reason to act now?

Examples:
- `scarcity_signaling`: "only 3 left" — but only if real (heuristic flags if always shown).
- `time_bound_offer`: countdown + clear deadline.
- `urgency_credibility`: scarcity claims that look fake (always "only 2 left") flagged as anti-pattern.

### 2.7 Navigation / IA

Can the visitor get where they need to go?

Examples:
- `breadcrumbs_present` (PLP/PDP): lineage shown.
- `search_visible_above_fold`: prominent for catalog sites.
- `filter_count_in_facets`: facets show match counts.
- `category_links_in_footer`: secondary nav for SEO + UX.
- `back_to_results_from_pdp`: easy return path.

### 2.8 Performance

Does the page load fast enough to convert?

Examples:
- `lcp_under_2_5s`: largest contentful paint within Core Web Vitals threshold.
- `cls_under_0_1`: cumulative layout shift threshold.
- `inp_under_200ms`: interaction-to-next-paint.
- `total_page_weight`: bytes — affects mobile especially.
- `hero_image_weight`: hero image size vs viewport.

### 2.9 Accessibility (CRO-relevant subset)

Direct conversion impact, not just compliance:

- `cta_contrast_ratio`: WCAG AA minimum (4.5:1) for buttons.
- `form_label_quality`: every input has accessible label.
- `error_message_clarity`: validation errors are descriptive.
- `tap_target_size`: ≥44x44px on mobile.
- `keyboard_nav_works`: critical paths reachable without mouse.

---

## 3. Page-type-specific heuristics

On top of universal categories, page types have their own heuristics. Examples:

### 3.1 PDP

- `gallery_image_count`: count + zoom + variants.
- `variant_picker_clarity`: swatches show name/availability, not color-only.
- `stock_availability_visible`: in-stock/low-stock/out-of-stock signaling.
- `price_prominence`: visible above fold, no hidden fees.
- `shipping_info_on_pdp`: ETA + cost shown without going to cart.
- `reviews_section_present`: count + sort + filter.
- `sticky_atc_on_scroll`: ATC accessible after scrolling past hero.
- `size_guide_accessible` (apparel): linked near size picker.
- `q_and_a_section`: customer questions visible (Amazon-style).
- `cross_sell_relevance`: "frequently bought" or "compare with" present.

### 3.2 PLP

- `filter_breadth`: facets cover key buyer decision dimensions.
- `sort_options`: relevance, price, popularity, new.
- `card_density`: not too sparse, not too crammed (vs viewport).
- `card_info_completeness`: image + name + price + rating + key variant info.
- `pagination_vs_infinite_scroll`: appropriate to catalog size.
- `result_count_shown`: "234 products" — orients the visitor.
- `quick_view_or_atc_from_card`: reduce clicks to convert.

### 3.3 Cart

- `cart_summary_clarity`: line items, qty, subtotal, shipping, tax, total.
- `edit_quantity_in_place`: no separate "update cart" action needed.
- `remove_item_obvious`: trash icon or "remove" link visible.
- `proceed_to_checkout_prominent`: top + bottom of cart.
- `continue_shopping_path`: visible but not competing with checkout.
- `upsell_relevance`: "complete the look", "people also bought".
- `coupon_field_collapsed_by_default`: prevents abandonment-to-search-for-codes.
- `trust_signals_in_cart`: free returns, satisfaction guarantee.

### 3.4 Checkout

- `guest_checkout_option`: prominent, not buried under "create account".
- `progress_indicator`: where am I in the flow.
- `form_field_count`: minimal — only what's needed.
- `address_autocomplete`: typeahead reduces friction.
- `inline_validation`: errors as user types, not on submit.
- `payment_options_breadth`: cards + wallets + BNPL.
- `total_visible_throughout`: order summary persists.
- `trust_badges_near_payment`: PCI, SSL, processor logos.
- `error_recovery_quality`: helpful messages, fields preserve values on error.
- `single_page_vs_multi_step`: appropriate to AOV.

### 3.5 Home

- `value_prop_clear_in_hero`: who/what/why in 5 seconds.
- `audience_targeting_obvious`: it's clear this site is for "you".
- `category_entry_points`: clear routes into the catalog.
- `featured_products_relevance`: bestsellers or seasonal.
- `social_proof_above_fold`: badges, ratings, customer count.
- `email_capture_balance`: present but not aggressive (timing matters).

### 3.6 Pricing (SaaS)

- `tier_count_appropriate`: 3-4 tiers typical, more = decision paralysis.
- `recommended_plan_highlighted`: anchor pricing.
- `feature_matrix_clarity`: easy compare across tiers.
- `monthly_vs_annual_toggle`: visible, default to annual if discount present.
- `enterprise_tier_separately_handled`: "Contact sales" not just price.
- `faq_addressing_objections`: cancellation, refunds, switching.
- `currency_localized`: matches user's geo.

---

## 4. Heuristic selection (page-type aware)

This is the "page-type aware" part. Given a `ContextProfile`, select the applicable heuristic subset.

```
function selectHeuristics(library, context):
  applicable = []
  for each h in library:
    if h.applies_to.business_archetypes != "all" 
       and context.business.archetype.value not in h.applies_to.business_archetypes:
      continue
    if h.applies_to.page_types != "all"
       and context.page.type.value not in h.applies_to.page_types:
      continue
    if h.applies_to.devices != "all"
       and context.traffic.device_priority.value not in h.applies_to.devices:
      continue
    if h.applies_to.requires_constraints:
      if not all required constraints in context.goal.constraints:
        continue
    applicable.add(h)
  return applicable
```

Result: a B2B SaaS pricing page might run ~25 heuristics; a D2C fashion PDP might run ~40 different ones; both share ~15 universal ones.

---

## 5. Weight modulation

Each applicable heuristic computes its effective weight for this context:

```
function effectiveWeight(heuristic, context):
  weight = heuristic.base_weight
  for each modifier in heuristic.weight_modifiers:
    if context matches modifier.when:
      weight *= modifier.multiplier
  return clamp(weight, 0, 1)
```

Example: `trust_badges_present`
- base_weight: 0.5
- modifier: `when business="B2B" + page="checkout" + aov_tier="high"` → multiplier 1.8 → effective 0.9
- modifier: `when business="D2C" + page="PDP" + aov_tier="low"` → multiplier 0.6 → effective 0.3

Same heuristic, different priority by context. This is what turns a generic checklist into surgical recommendations.

---

## 6. Running heuristics across the StateGraph

Heuristics don't run only on State 0. Many issues live in deeper states.

### 6.1 Per-state vs cross-state

- **Per-state heuristics**: evaluate one state. E.g. `cta_above_fold` checks State 0; `modal_dismissibility` checks the modal state.
- **Cross-state heuristics**: evaluate transitions. E.g. `unexpected_total_at_checkout` compares cart total in cart state vs checkout state. `variant_change_updates_price` checks transition behavior.

```
function runHeuristics(heuristics, stateGraph, context):
  findings = []
  for each h in heuristics:
    if h.scope === "per_state":
      for each state in stateGraph.nodes:
        matches = h.query(state, context)
        for each match in matches:
          findings.add(buildFinding(h, match, state, context))
    else if h.scope === "cross_state":
      matches = h.query(stateGraph, context)
      for each match in matches:
        findings.add(buildFinding(h, match, null, context))
  return findings
```

### 6.2 State-relevance filter

Not every state matters for every heuristic.
- `cta_above_fold` → only initial state per viewport.
- `modal_close_button` → only modal states.
- `accordion_content_findability` → only collapsed-then-expanded transitions.

Each heuristic declares which states to evaluate via `state_filter` (e.g. `state_filter: { tags: ["modal"] }`). The state exploration layer should tag states with categories (modal, drawer, tab-content, expanded-accordion, scrolled, etc.) for this filter to work.

---

## 7. Scoring

Every finding gets four scores:

### 7.1 Severity (1-5)

How bad is this for conversion?
- 5: blocks conversion (broken cart, no payment option, missing CTA).
- 4: severely impedes (hidden total, forced signup, no trust signals on $5K product).
- 3: notable friction (unclear CTA, weak social proof).
- 2: minor (suboptimal but functional).
- 1: cosmetic / nice-to-have.

Severity function uses match data (e.g. `cta_contrast_ratio` severity scales with how far below threshold).

### 7.2 Confidence (0-1)

How sure are we this is a real issue?
- 1.0: deterministic (count, ratio, presence/absence).
- 0.7-0.9: pattern match with known good/bad patterns.
- 0.4-0.6: inference from indirect signals.
- < 0.4: don't emit (too noisy).

Confidence drops if context fields involved are themselves low-confidence (e.g. heuristic depends on awareness_level which was inferred at 0.6 → cap finding confidence at 0.6).

### 7.3 Effort (1-5)

How costly to fix?
- 1: copy change, single element.
- 2: small layout/style change.
- 3: component refactor, new section.
- 4: requires backend / data work.
- 5: requires new feature, significant engineering.

### 7.4 Final priority score

```
priority = severity * confidence * effective_weight / effort
```

This is the standard ICE-style ranking but anchored in measurable inputs. Sort findings descending. Top of list = high impact, high confidence, low effort.

Don't bucket into P1/P2/P3 directly — let the score speak. Optionally group: top 20% = "quick wins", next 30% = "experiments", remainder = "research-needed".

---

## 8. Finding shape

Every emitted finding is a fully-evidenced object:

```
Finding {
  finding_id: string,
  heuristic_id: string,
  category: string,                              # from heuristic
  
  state_id: string | null,                       # which state (null if cross-state)
  element_refs: [element_id],                    # which elements involved
  
  scores: {
    severity: number,        # 1-5
    confidence: number,      # 0-1
    effort: number,          # 1-5
    weight: number,          # 0-1, context-adjusted
    priority: number         # computed
  },
  
  evidence: {
    state_path: string,                          # human-readable path to state
    element_selectors: [string],                 # CSS selectors for evidence
    screenshot_crop_url: string,                 # annotated crop showing the issue
    measured_values: object,                     # e.g. { contrast_ratio: 3.1, threshold: 4.5 }
    quote: string                                # relevant DOM text if any
  },
  
  issue: string,                                 # what's wrong
  why_it_matters: string,                        # CRO reasoning
  recommendation: string,                        # what to do
  expected_metric: string,                       # KPI it should affect
  
  context_assumptions: [string],                 # which low-confidence context fields this depends on
  references: [string]
}
```

**Rule**: every finding must point to specific elements with selectors and a screenshot crop. Findings without evidence are speculation.

---

## 9. Deduplication + grouping

Multiple heuristics can fire on the same element. Multiple states can surface the same issue.

### 9.1 Same-element dedup

If two heuristics fire on the same element with overlapping concerns (e.g. `cta_low_contrast` + `cta_clarity_weak` both on the same button) → keep both as findings but group them under the element in output.

### 9.2 Cross-state dedup

If the same heuristic fires on the same element across multiple states (e.g. low-contrast CTA appears in 5 states) → emit ONE finding with state list, not five copies.

State equivalence: same heuristic_id + same element_id + same measured_values within tolerance.

### 9.3 Issue clustering

Group findings into themes for the report:
- By category: all "trust" findings together.
- By element: all findings on the hero CTA.
- By state: all findings in the checkout flow.

Use whichever grouping the report layer requests.

---

## 10. Conflict resolution

Heuristics conflict. Examples:
- "More social proof above fold" vs "Less above-fold clutter".
- "Add testimonials" vs "Reduce page weight".
- "Show full pricing" vs "Use anchoring with hidden enterprise tier".

Resolution rules:
- The `goal.primary_kpi` field breaks ties: optimize for the KPI, accept the trade-off.
- Higher effective_weight wins when conflict is direct.
- When both fire with high weight → emit BOTH but flag with `conflicts_with: [other_finding_id]` so report layer can surface the trade-off explicitly rather than hiding it.

Don't auto-suppress conflicting findings. Honesty over neatness.

---

## 11. Output: FindingsReport

```
findings_report: {
  meta: {
    context_profile_ref: string,
    heuristics_run: number,
    findings_count: number,
    evaluated_at: timestamp,
    heuristic_library_version: string
  },
  findings: [Finding],                           # sorted by priority desc
  groupings: {
    by_category: Map<category, [finding_id]>,
    by_state: Map<state_id, [finding_id]>,
    by_element: Map<element_id, [finding_id]>
  },
  conflicts: [{ finding_a, finding_b, trade_off_summary }],
  warnings: [{ code, message }]
}
```

Warning codes: `LOW_CONTEXT_CONFIDENCE`, `STATE_NOT_CAPTURED` (heuristic needed a state that exploration didn't reach), `BENCHMARK_MISSING` (heuristic compared to a benchmark not available).

---

## 12. Things heuristic layer must NOT do

- No new perception. If a fact isn't in the bundle, the heuristic can't ask for it — must declare a missing-data warning instead.
- No final report formatting. Output is structured findings; report layer formats them.
- No experimentation prioritization beyond the score. Don't pick which to A/B test — surface the ranked list.
- No heuristic invention at runtime. All heuristics are declared in the library; new rules ship via library updates, not LLM-on-the-fly judgments. (Exception below in §13.)
- No silent suppression of low-confidence findings. Surface them with their confidence score and let downstream filter.

---

## 13. LLM-augmented heuristics (optional)

Rules-based heuristics handle ~70% of CRO findings. Some judgments are hard to encode (copy quality, message-match, brand consistency).

For these, define LLM-backed heuristics:

```
LLMHeuristic {
  ...same as Heuristic,
  query: function(state, context) → [Match] {
    # Build prompt with structured context + relevant DOM + screenshot crop
    # Call LLM with constrained JSON output schema
    # Parse to Match objects
  },
  prompt_template: string,
  output_schema: JSONSchema,
  fallback_behavior: "skip" | "lower_confidence"
}
```

Rules:
- LLM-backed heuristics MUST emit findings with `confidence ≤ 0.7` by default (LLMs are non-deterministic).
- Always include screenshot + relevant DOM in prompt — don't ask LLM to imagine the page.
- Output schema is strict JSON; reject malformed responses.
- Cache by (state_hash, heuristic_id) for re-runs.

Examples of LLM-backed heuristics:
- `headline_concreteness`: judge whether hero copy is specific or vague.
- `message_match_score`: compare ad creative to hero copy.
- `tone_consistency`: brand voice across page sections.
- `objection_handling_completeness`: are likely buyer questions answered.

---

## 14. Build order recommendation

If extending an existing heuristic layer:

1. **Heuristic structure** (§1). If your heuristics are free-text rules, restructure to objects with `applies_to`, `query`, `weight_modifiers`. Single biggest leverage.
2. **Evidence linking** (§8). Every finding must point to specific element + screenshot crop. Findings without evidence are noise.
3. **Page-type selector** (§4). Without it, you're running irrelevant heuristics and producing generic advice.
4. **Weight modulation** (§5). Same heuristic should have different priority by context. This is what makes "page-type aware" real.
5. **Cross-state evaluation** (§6). Most layers evaluate State 0 only; running heuristics across the StateGraph surfaces issues hidden behind tabs/modals.
6. **Scoring math** (§7). Move from "P1/P2/P3" to severity × confidence × weight / effort. Defensible, sortable.
7. **Dedup + grouping** (§9). Output quality issue.
8. **Conflict surfacing** (§10). Don't hide conflicts — name them.
9. **LLM heuristics** (§13). Last, only after rules-based foundation is solid.

---

## 15. Tech stack defaults

- Heuristic library: TS/JS file or YAML/JSON, loaded at startup. Versioned.
- Schema validation: Zod for Heuristic + Finding shapes.
- Query functions: pure JS over PerceptionBundle / StateGraph data structures. No browser access.
- LLM heuristics: Anthropic API for structured JSON output, schema-validated.
- Storage: FindingsReport as JSON, screenshot crops as separate files referenced by URL.

---

## 16. How this plugs into the rest

```
ContextProfile + StateGraph + PerceptionBundles
    ↓
Heuristic Selection (§4) — load applicable subset
    ↓
Weight Modulation (§5) — adjust per-context
    ↓
Run Across StateGraph (§6) — per-state + cross-state
    ↓
Score Findings (§7) — severity, confidence, effort, priority
    ↓
Dedup + Group (§9) + Conflict Detection (§10)
    ↓
FindingsReport
    ↓
Recommendation Report Layer (formats for human)
```

The contract: heuristic layer reads context + facts, emits ranked evidenced findings. Doesn't write prose, doesn't decide experiments, doesn't reach back to perception. Pure function of inputs.
