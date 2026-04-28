# Context Capture Layer — Build Spec

Purpose: produce a `ContextProfile` that tells the heuristic engine *what kind of page this is, who it's for, what success means*. Runs BEFORE perception. Bad context = generic advice. Good context = surgical recommendations.

---

## 0. Mental model

Context capture = consultant intake form, automated where possible.

Two input paths:
- **Explicit**: user-provided (brief, form, prior reports). High confidence.
- **Inferred**: derived from URL/page signals. Variable confidence — must be flagged.

Every output field carries `{ value, source, confidence }`. Low-confidence fields trigger clarifying questions before analysis runs. No silent assumptions.

This layer does NOT run perception (no headless browser, no state graph). Only lightweight signals: URL parsing, optional single HTML fetch for inference, user input.

---

## 1. Five context dimensions

### 1.1 Business archetype

**What**: the kind of business this page belongs to.

**Why**: highest-leverage piece of context. Same heuristic ("reduce form fields") fires opposite priorities for D2C vs B2B. Heuristic library is keyed on this.

**When**: capture before perception. Required.

**How**:
- Ask user explicitly when possible (one dropdown).
- Inference signals, ordered by strength:
  - JSON-LD `@type`: `Product` → e-commerce, `SoftwareApplication` → SaaS, `Service` → service biz.
  - Pricing patterns: `/mo`, `per user`, "annual" → SaaS; "free shipping" → physical goods; "book a demo" → B2B.
  - CTA copy: "Add to cart/bag" → D2C, "Request demo/quote" → B2B, "Start free trial" → SaaS, "Get a quote" → service/insurance.
  - Domain TLD + naming: `.shop`, `.store` → e-commerce; "wholesale/MOQ" copy → B2B.
  - Price points: high prices ($1K+) without ATC → considered purchase or B2B.

**Output fields**:
```
business: {
  archetype: "D2C" | "marketplace" | "SaaS" | "subscription" | "B2B" | "enterprise" | "lead_gen" | "service",
  aov_tier: "low" | "mid" | "high" | "enterprise",   // <$50, $50-500, $500-5K, >$5K
  cadence: "one_time" | "repeat" | "subscription" | "considered" | "contract",
  vertical: string                                    // fashion, electronics, beauty, fintech, etc.
}
```

**Decision rules**:
- JSON-LD `Product` + price <$200 + "Add to cart" → confident D2C.
- "Demo" + "talk to sales" + no listed price → confident B2B.
- "/mo" pricing + signup form → confident SaaS.
- Mixed signals → low confidence, ask user.

**Gotchas**:
- Marketplaces look like D2C but heuristics differ — check for "sold by [X]" or seller info.
- Subscription D2C (coffee monthly) overlaps with one-time D2C — check for "Subscribe & save" toggle.
- Enterprise pages often hide pricing entirely — absence of price ≠ B2C.

---

### 1.2 Page type + funnel stage

**What**: role this specific page plays in the funnel.

**Why**: page type selects which heuristics apply. PDP heuristics (variant pickers, gallery, reviews) don't apply to checkout. Funnel stage determines copy depth and trust requirements.

**When**: capture before perception. Required. Strong inference possible.

**How**:
- URL pattern matching (highest confidence):
  - `/`, `/home` → homepage
  - `/products/`, `/p/`, `/item/`, `/dp/` → PDP
  - `/category/`, `/c/`, `/collections/`, `/search` → PLP
  - `/cart`, `/basket` → cart
  - `/checkout`, `/checkout/*` → checkout
  - `/thank-you`, `/order-confirmation` → post-purchase
  - `/landing/`, `/lp/`, UTM-heavy → paid landing
- Schema.org type: `ItemPage`, `CollectionPage`, `CheckoutPage`.
- Layout signals (fallback):
  - One product + gallery + price + ATC → PDP
  - Grid of cards + filters + sort → PLP
  - Form fields + order summary → checkout
  - Hero + multi-section + nav → home or landing
- Funnel stage from page type + traffic source (§1.4):
  - Home/landing from cold paid → awareness
  - PDP/PLP from organic search → consideration
  - Cart/checkout → decision
  - Post-purchase → retention

**Output fields**:
```
page: {
  type: "home" | "PLP" | "PDP" | "cart" | "checkout" | "post_purchase" | "category" | "landing" | "blog" | "about" | "pricing" | "comparison",
  funnel_stage: "awareness" | "consideration" | "decision" | "retention",
  job: "educate" | "convert" | "reassure" | "upsell" | "recover" | "retain" | "qualify" | "route",
  is_indexed: boolean              // SEO-driven vs paid landing
}
```

**Gotchas**:
- SPA routes may not match URL patterns cleanly — fall back to layout signals.
- "Pricing page" is its own type for SaaS — distinct heuristics from PDP.
- Comparison pages (vs competitor) need own ruleset.
- Some sites use `/p/` for both products and pages — check schema.org type.

---

### 1.3 Audience + intent

**What**: who is reading this page and how warm they are.

**Why**: dictates copy depth, social proof type, objection handling. Same structural page needs opposite advice for unaware vs most-aware audiences.

**When**: capture before perception. Mostly user-provided — inference here is weak.

**How**:
- Ask user. This is the dimension where guessing hurts most.
- Weak inference signals (flag low confidence):
  - Technical jargon density → technical audience.
  - Acronyms (ROI, SLA, API) → B2B/professional.
  - Price-anchoring language ("save", "compare", "cheapest") → price-sensitive.
  - "For teams of 50+" → mid-market SaaS buyer.
  - Long-form copy with FAQs → considered/researched purchase.
  - One-CTA hero + minimal copy → impulse/transactional.

**Output fields**:
```
audience: {
  buyer: "consumer" | "prosumer" | "SMB" | "mid_market" | "enterprise" | "technical" | "non_technical",
  awareness_level: "unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware",  // Schwartz
  decision_style: "impulse" | "researched" | "committee" | "habitual",
  sophistication: "low" | "medium" | "high"      // category-level expertise
}
```

**Decision rules**:
- Default to `product_aware` for direct/branded traffic.
- Default to `solution_aware` for organic search.
- Default to `problem_aware` for cold paid social.
- Always flag inferred awareness as low confidence.

**Gotchas**:
- Awareness level varies by traffic source even for the same page. Don't bake one value — capture per traffic-source segment if user provides multiple.
- B2B buyer ≠ B2B user. Decision-maker reads pricing; end-user reads features. Ask which one this page targets.

---

### 1.4 Traffic source + device

**What**: where visitors come from and what device they're on.

**Why**: page doesn't exist in isolation. Cold paid needs more proof than warm email. Mobile and desktop have fundamentally different layouts. Message-match (ad → page) is high-impact and invisible without this context.

**When**: capture before perception. User-provided ideally; inference is partial.

**How**:
- Ask user for primary traffic sources + device priority.
- Inference signals:
  - UTM parameters in test URLs → source attribution.
  - Mobile-specific elements (sticky bottom CTA, hamburger nav) → mobile-priority design.
  - Responsive breakpoints in CSS → which devices are designed for.
  - Schema.org `breadcrumb` depth → SEO-driven (organic).
- For ad-driven pages: ask for ad creative or message-match copy. This is the highest-impact piece of context most audits miss.

**Output fields**:
```
traffic: {
  primary_sources: [{
    channel: "paid_search" | "paid_social" | "organic" | "email" | "direct" | "referral" | "affiliate" | "display",
    share: number,                         // 0-1, optional
    creative_or_message: string | null     // ad copy, email subject, referrer expectation
  }],
  device_priority: "mobile" | "desktop" | "balanced",
  mobile_share: number | null,             // 0-1
  geo_primary: string | null,              // ISO country code
  locale_primary: string | null
}
```

**Gotchas**:
- Mobile-priority + desktop-designed page is a common CRO failure — record both designed-for and actual-traffic device.
- Email traffic is warm but assumes context from the email — ask for the email content, not just "email".
- Affiliate traffic can be hot or cold depending on affiliate type (review site vs coupon site) — clarify.

---

### 1.5 Conversion goal + constraints

**What**: what success looks like, and what can't be touched.

**Why**: heuristics conflict. "Add more social proof" and "reduce fold clutter" can both be true. Without the primary KPI you can't break ties. Constraints are the unsexy part everyone forgets — recommendations that violate them are worthless.

**When**: capture before perception. Always explicit. No inference.

**How**:
- Ask user. Always.
- Primary KPI dropdown + free-text for secondary KPIs.
- Constraints as multi-select + free text.

**Output fields**:
```
goal: {
  primary_kpi: "purchase" | "signup" | "lead" | "add_to_cart" | "demo_request" | "trial_start" | "subscribe" | "engagement",
  secondary_kpis: [string],                      // AOV, email_capture, time_on_page, retention, etc.
  current_baseline: number | null,               // current conversion rate if known
  target_lift: number | null,                    // desired % improvement if known
  constraints: {
    regulatory: [string],                        // GDPR, HIPAA, PCI, FTC, gambling, pharma
    accessibility: string | null,                // WCAG_AA, WCAG_AAA, none
    brand: [string],                             // forbidden colors, copy rules, etc.
    technical: [string]                          // CMS limits, no-JS-allowed, etc.
  }
}
```

**Gotchas**:
- Multiple KPIs without ranking → ask which is primary. Heuristics need a north star.
- "Increase conversion" is not a KPI — push for specifics (purchases? email signups?).
- Regulated industries: capture constraints early. A great recommendation that requires a forbidden claim is wasted work.

---

## 2. ContextProfile output

Every field carries provenance.

```
ContextProfile {
  meta: {
    captured_at,
    capture_method: "intake_form" | "inferred" | "hybrid",
    user_provided_fields: [string],
    inferred_fields: [string],
    overall_confidence: number        // 0-1, weighted by field importance
  },
  business: {
    archetype: { value, source, confidence },
    aov_tier: { value, source, confidence },
    cadence: { value, source, confidence },
    vertical: { value, source, confidence }
  },
  page: {
    type: { value, source, confidence },
    funnel_stage: { value, source, confidence },
    job: { value, source, confidence },
    is_indexed: { value, source, confidence }
  },
  audience: {
    buyer: { value, source, confidence },
    awareness_level: { value, source, confidence },
    decision_style: { value, source, confidence },
    sophistication: { value, source, confidence }
  },
  traffic: {
    primary_sources: { value, source, confidence },
    device_priority: { value, source, confidence },
    geo_primary: { value, source, confidence },
    locale_primary: { value, source, confidence }
  },
  goal: {
    primary_kpi: { value, source, confidence },
    secondary_kpis: { value, source, confidence },
    constraints: { value, source, confidence }
  },
  open_questions: [{
    field_path: string,
    question: string,
    blocking: boolean
  }]
}
```

`source` values: `"user"`, `"url_pattern"`, `"schema_org"`, `"copy_inference"`, `"layout_inference"`, `"default"`.

`confidence` thresholds:
- `>= 0.9`: act on it.
- `0.6 - 0.9`: use it, flag in final report.
- `< 0.6`: ask user (becomes an `open_question`).

`blocking: true` on open_questions means analysis cannot proceed without an answer.

---

## 3. Capture flow

```
1. Receive URL + optional intake form
2. Parse URL → page type candidate (cheap, high confidence)
3. Optional: fetch HTML once → extract meta, JSON-LD, OG, copy patterns
4. Run inference on each dimension → produce candidate ContextProfile
5. Identify low-confidence fields → build open_questions
6. If any blocking questions: surface to user, halt
7. Merge user answers → finalize ContextProfile
8. Pass to perception layer + heuristic engine
```

Inference fetch (step 3) policy:
- Single GET, respect robots.txt, realistic UA.
- No JS execution at this stage (perception layer handles that).
- 5s timeout, gracefully degrade to URL-only inference if fail.
- Cache by URL + ETag for re-runs.

---

## 4. Inference signals — quick reference

| Signal | Source | Tells you |
|---|---|---|
| URL path segments | URL | page type |
| JSON-LD `@type` | HTML | business archetype + page type |
| `<meta name="description">` | HTML | page job, audience tone |
| OpenGraph `og:type` | HTML | page type (article, product, website) |
| Currency in price | HTML | geo, AOV tier |
| Price magnitude | HTML | AOV tier |
| CTA verb | HTML | business archetype, funnel stage |
| Form field count | HTML | lead-gen depth, friction tolerance |
| "Subscribe", "/mo", "free trial" | HTML | subscription/SaaS |
| "Wholesale", "MOQ", "request quote" | HTML | B2B |
| `<link rel="canonical">` | HTML | indexed vs paid landing |
| Hreflang tags | HTML | locale support |
| Breadcrumb schema | HTML | SEO/organic priority |
| Viewport meta | HTML | mobile-designed |
| `@media` breakpoints | CSS | device priority |

---

## 5. Things context layer must NOT do

- No perception (no headless browser, no state exploration).
- No heuristic judgments (don't say "this is a bad page" — only "this is a PDP").
- No silent guessing — every inference must record source + confidence.
- No skipping user when confidence is low — always surface open_questions.
- No mutating page state.
- No assumptions about traffic without user input.

---

## 6. Build order recommendation

If extending an existing context layer, prioritize:

1. **Provenance fields** (`source`, `confidence`). Most context layers store flat values — adding provenance is the single biggest quality jump because it lets downstream layers handle uncertainty correctly.
2. **Open questions / clarification loop** (§3 step 5-6). Without this, low-confidence inferences silently pollute analysis.
3. **Page type inference from URL + schema** (§1.2). Highest accuracy/effort ratio.
4. **Business archetype from CTA + pricing patterns** (§1.1). Cheap signals, high impact on heuristic selection.
5. **Traffic source intake** (§1.4). Often skipped; unlocks message-match analysis.
6. **Constraints capture** (§1.5). Prevents wasted recommendations.
7. **Audience inference** (§1.3) — last because it's the weakest. Lean on user input here.

---

## 7. How this plugs into downstream

Heuristic engine signature:
```
heuristics_to_run = library.select(
  business=ctx.business.archetype.value,
  page=ctx.page.type.value,
  device=ctx.traffic.device_priority.value
)
```

Each heuristic carries weight modifiers keyed on context:
```
heuristic.weight_for(ctx) = base_weight * business_modifier * page_modifier * goal_modifier
```

Example: "trust badges present" heuristic
- base_weight: 0.5
- B2B + checkout + high AOV → modifier 1.8 → final 0.9
- D2C + PDP + low AOV → modifier 0.6 → final 0.3

Same heuristic, different priority. This is what turns a generic checklist into context-aware analysis.

---

## 8. Tech stack defaults

- HTTP fetch: `undici` / `node-fetch` for the inference fetch. No Playwright at this layer.
- HTML parse: `cheerio` (server-side jQuery-like) or `linkedom`. No JSDOM (heavy, unnecessary).
- JSON-LD parse: `jsonld` package or manual — extract `@type`, `name`, `offers`, `description`.
- Schema validation: Zod for ContextProfile shape.
- Storage: ContextProfile is small (~5KB) — store inline with analysis run.
