---
title: 37-context-capture-layer
artifact_type: architecture-spec
status: approved
loadPolicy: on-demand-only
version: 1.0
updated: 2026-04-28
governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R22 (The Ratchet)
  - Constitution R25 (Context Capture MUST NOT)
note: Reference material. Do NOT load by default (CLAUDE.md Tier 3). Load only the single REQ-ID section cited by the current task.
source_spec: docs/Improvement/context_capture_layer_spec.md
---

# Section 37 — Context Capture Layer

> **See also §07 (Analyze Mode), §09 (Heuristic KB), §19 (Discovery), §25 (Reproducibility).** This layer runs BEFORE perception and gates the audit on context certainty.

## 37.0 Principle

**Context = consultant intake form, automated where possible.** Two input paths: explicit (user-provided, high confidence) and inferred (URL + lightweight HTML signals, variable confidence). Every output field carries `{ value, source, confidence }`. Low-confidence fields trigger blocking clarifying questions before analysis runs. **No silent assumptions.**

This layer does NOT run perception (no headless browser, no state graph). It runs lightweight signal extraction: URL parsing + optional single HTML fetch + JSON-LD parse + user input.

---

## 37.1 Five Context Dimensions

### 37.1.1 Business archetype

**REQ-CONTEXT-DIM-BUSINESS-001:** Capture the kind of business this page belongs to. Highest-leverage piece of context — heuristic library is keyed on this.

```typescript
business: {
  archetype: { value: "D2C" | "marketplace" | "SaaS" | "subscription" | "B2B" | "enterprise" | "lead_gen" | "service"; source: ContextSource; confidence: number };
  aov_tier: { value: "low" | "mid" | "high" | "enterprise"; source: ContextSource; confidence: number };  // <$50, $50-500, $500-5K, >$5K
  cadence: { value: "one_time" | "repeat" | "subscription" | "considered" | "contract"; source: ContextSource; confidence: number };
  vertical: { value: string; source: ContextSource; confidence: number };  // fashion, electronics, beauty, fintech
}
```

**Inference signals (ordered by strength):**
1. JSON-LD `@type`: `Product` → e-commerce, `SoftwareApplication` → SaaS, `Service` → service biz
2. Pricing patterns: `/mo`, `per user`, "annual" → SaaS; "free shipping" → physical goods; "book a demo" → B2B
3. CTA copy: "Add to cart/bag" → D2C, "Request demo/quote" → B2B, "Start free trial" → SaaS, "Get a quote" → service
4. Domain TLD + naming: `.shop`, `.store` → e-commerce; "wholesale/MOQ" → B2B
5. Price points: ≥$1K without ATC → considered or B2B

### 37.1.2 Page type + funnel stage

**REQ-CONTEXT-DIM-PAGE-001:** Capture page role and funnel position. Page type selects which heuristics apply.

```typescript
page: {
  type: { value: "home" | "PLP" | "PDP" | "cart" | "checkout" | "post_purchase" | "category" | "landing" | "blog" | "about" | "pricing" | "comparison"; source: ContextSource; confidence: number };
  funnel_stage: { value: "awareness" | "consideration" | "decision" | "retention"; source: ContextSource; confidence: number };
  job: { value: "educate" | "convert" | "reassure" | "upsell" | "recover" | "retain" | "qualify" | "route"; source: ContextSource; confidence: number };
  is_indexed: { value: boolean; source: ContextSource; confidence: number };  // SEO-driven vs paid landing — Phase 13b
}
```

**Inference signals (highest confidence first):**
- URL pattern: `/`, `/products/`, `/cart`, `/checkout`, `/landing/` → page type
- Schema.org type: `ItemPage`, `CollectionPage`, `CheckoutPage`
- Layout fallback: gallery + price + ATC → PDP; grid + filters → PLP; form + summary → checkout
- Funnel stage from page type + traffic source

**Note on §07 §7.4 `detectPageType`:** Existing `inferredPageType` field becomes a thin reader of `ContextProfile.page.type`. Backward-compat preserved via accessor helper.

### 37.1.3 Audience + intent

**REQ-CONTEXT-DIM-AUDIENCE-001:** Capture who reads the page and how warm. Mostly user-provided; inference is weak (defer detailed inference to Phase 13b).

```typescript
audience: {
  buyer: { value: "consumer" | "prosumer" | "SMB" | "mid_market" | "enterprise" | "technical" | "non_technical"; source: ContextSource; confidence: number };
  awareness_level: { value: "unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware"; source: ContextSource; confidence: number };  // Schwartz model — Phase 13b
  decision_style: { value: "impulse" | "researched" | "committee" | "habitual"; source: ContextSource; confidence: number };  // Phase 13b
  sophistication: { value: "low" | "medium" | "high"; source: ContextSource; confidence: number };  // category-level expertise — deferred indefinitely
}
```

**Phase 4b (MVP):** `buyer` field — user-provided only. Other fields default to enum-default + `confidence: 0`.
**Phase 13b (master):** Add `awareness_level` + `decision_style` inference + per-traffic-source segmentation.

### 37.1.4 Traffic source + device

**REQ-CONTEXT-DIM-TRAFFIC-001:** Capture where visitors come from + device priority.

```typescript
traffic: {
  primary_sources: { value: Array<{
    channel: "paid_search" | "paid_social" | "organic" | "email" | "direct" | "referral" | "affiliate" | "display";
    share?: number;                                     // 0-1
    creative_or_message?: string;                       // ad copy, email subject, referrer expectation — Phase 13b message-match
  }>; source: ContextSource; confidence: number };
  device_priority: { value: "mobile" | "desktop" | "balanced"; source: ContextSource; confidence: number };
  mobile_share: { value: number | null; source: ContextSource; confidence: number };
  geo_primary: { value: string | null; source: ContextSource; confidence: number };  // ISO country — Phase 13b
  locale_primary: { value: string | null; source: ContextSource; confidence: number };  // BCP-47 — Phase 13b
}
```

**Phase 4b (MVP):** `primary_sources[].channel` + `device_priority` user-provided. `creative_or_message` available in schema but not required.
**Phase 13b (master):** Full message-match capture + geo + locale inference.

### 37.1.5 Conversion goal + constraints

**REQ-CONTEXT-DIM-GOAL-001:** Capture what success looks like + what can't be touched. Always explicit. No inference.

```typescript
goal: {
  primary_kpi: { value: "purchase" | "signup" | "lead" | "add_to_cart" | "demo_request" | "trial_start" | "subscribe" | "engagement"; source: "user"; confidence: 1 };
  secondary_kpis: { value: string[]; source: "user"; confidence: 1 };
  current_baseline: { value: number | null; source: "user"; confidence: 1 };  // current conversion rate
  target_lift: { value: number | null; source: "user"; confidence: 1 };       // desired % improvement
  constraints: {
    regulatory: { value: string[]; source: "user"; confidence: 1 };           // GDPR, HIPAA, PCI, FTC, gambling, pharma
    accessibility: { value: "WCAG_AA" | "WCAG_AAA" | "none" | null; source: "user"; confidence: 1 };
    brand: { value: string[]; source: "user"; confidence: 1 };                // forbidden colors, copy rules
    technical: { value: string[]; source: "user"; confidence: 1 };            // CMS limits, no-JS-allowed
  };
}
```

**REQ-CONTEXT-DIM-GOAL-002:** `primary_kpi` is REQUIRED. AuditRequest validation rejects audits without it.

**REQ-CONTEXT-DIM-GOAL-003:** Constraints are REQUIRED for regulated verticals. The validator checks `business.vertical` against a regulated-industry list (pharma, fintech, gambling, healthcare, legal); if matched, `constraints.regulatory` MUST be non-empty.

---

## 37.2 ContextProfile Output

```typescript
type ContextSource =
  | "user"
  | "url_pattern"
  | "schema_org"
  | "copy_inference"
  | "layout_inference"
  | "default";

interface ContextProfile {
  meta: {
    captured_at: string;                                // ISO8601
    capture_method: "intake_form" | "inferred" | "hybrid";
    user_provided_fields: string[];                     // dot-paths of fields from user
    inferred_fields: string[];                          // dot-paths of fields from inference
    overall_confidence: number;                         // 0-1, weighted by field importance
    perception_layer_version: string;                   // hint for Phase 1c PerceptionBundle
  };

  business: BusinessDimension;
  page: PageDimension;
  audience: AudienceDimension;
  traffic: TrafficDimension;
  goal: GoalDimension;

  open_questions: Array<{
    field_path: string;                                 // e.g. "business.archetype"
    question: string;                                   // human-readable question
    blocking: boolean;                                  // halt audit until answered
  }>;

  hash: string;                                         // SHA-256 of profile content (for §25 reproducibility)
}
```

**REQ-CONTEXT-OUT-001:** Confidence thresholds:
- `≥ 0.9`: act on the value; no clarification needed
- `0.6 – 0.9`: use the value but flag in final report
- `< 0.6`: emit as `open_question` (becomes blocking if field is required)

**REQ-CONTEXT-OUT-002:** `blocking: true` on an open_question means analysis CANNOT proceed without an answer. Audit halts at audit_setup and surfaces the question via CLI prompt (Phase 4b) or dashboard form (Phase 13b).

**REQ-CONTEXT-OUT-003:** ContextProfile is immutable after capture (`Object.freeze`). Any consumer needing a derived view produces a new artifact, never modifies the bundle.

---

## 37.3 Capture Flow

```
1. Receive AuditRequest with optional intake fields
2. Parse URL → page type candidate (cheap, high confidence)
3. Optional: HTML fetch (cheerio, no JS) → extract meta, JSON-LD, OG, copy patterns
4. Run inference per dimension → produce candidate ContextProfile
5. Identify low-confidence fields → build open_questions
6. If any blocking questions: surface to user, halt audit
7. Merge user answers → finalize ContextProfile
8. Pass to perception layer + heuristic engine
```

**REQ-CONTEXT-FLOW-001:** Inference fetch (step 3) policy:
- Single GET request via undici/node-fetch — no Playwright at this layer
- Realistic User-Agent (not crawler-spoofed) — per §11.1.1
- Respect robots.txt — per REQ-SAFETY-005
- 5s timeout; gracefully degrade to URL-only inference on failure
- Cache by URL + ETag for re-runs in same audit
- Emit `CONTEXT_FETCH_FAILED` warning on failure (still proceed)

**REQ-CONTEXT-FLOW-002:** HTML parse via cheerio or linkedom. No JSDOM (heavy + unnecessary). No JS execution (perception layer handles JS-rendered content).

---

## 37.4 Inference Signals — Quick Reference

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
| `<link rel="canonical">` | HTML | indexed vs paid landing (Phase 13b) |
| Hreflang tags | HTML | locale support (Phase 13b) |
| Breadcrumb schema | HTML | SEO/organic priority (Phase 13b) |
| Viewport meta | HTML | mobile-designed |
| `@media` breakpoints | CSS | device priority |

---

## 37.5 Plug-In to Downstream

**REQ-CONTEXT-DOWNSTREAM-001:** Heuristic engine (§09) selects heuristics using ContextProfile:

```typescript
const heuristics_to_run = library.select({
  business: ctx.business.archetype.value,
  page: ctx.page.type.value,
  device: ctx.traffic.device_priority.value,
});
```

**REQ-CONTEXT-DOWNSTREAM-002 (Phase 13b only):** Each heuristic carries weight modifiers keyed on context dimensions:

```typescript
heuristic.weight_for(ctx) = base_weight
  * business_modifier(ctx.business.archetype, ctx.business.aov_tier)
  * page_modifier(ctx.page.type, ctx.page.funnel_stage)
  * goal_modifier(ctx.goal.primary_kpi);
```

Example — "trust badges present" heuristic:
- base_weight: 0.5
- B2B + checkout + high AOV → modifier 1.8 → final 0.9
- D2C + PDP + low AOV → modifier 0.6 → final 0.3

**Same heuristic, different priority.** Context-aware analysis vs. generic checklist.

**Phase 4b note:** Weight modifiers deferred. MVP uses `library.select()` filtering only. Phase 13b adds the modifier multiplication.

---

## 37.6 Reproducibility Integration (REQ-CONTEXT-REPRO-001)

ContextProfile is part of `ReproducibilitySnapshot` (§25):

```typescript
ReproducibilitySnapshot {
  // ...existing v2.4 fields...
  context_profile_id: string;
  context_profile_hash: string;                         // SHA-256 of normalized ContextProfile
  context_capture_layer_version: string;                // semver
}
```

Re-running an audit with the same URL + same AuditRequest intake + same inference signals produces the same ContextProfile hash. Differences in hash signal context drift (e.g., a previously-hidden CTA was added, changing CTA-copy inference).

---

## 37.7 Architectural Boundaries

**REQ-CONTEXT-BOUND-001:** Context Capture Layer SHALL NOT (per Constitution R25):

1. Run perception (no headless browser, no state exploration)
2. Make heuristic judgments (don't say "this is a bad page" — only "this is a PDP")
3. Silently guess (every inference records source + confidence)
4. Skip clarification when confidence is low (always surface open_questions)
5. Mutate page state
6. Make assumptions about traffic without user input

**REQ-CONTEXT-BOUND-002:** Context Capture Layer SHALL:

- Capture all 5 dimensions per audit
- Emit per-field provenance (source + confidence)
- Halt analysis when blocking questions exist
- Cache by URL + ETag for re-runs
- Honor robots.txt + realistic UA
- Pin into ReproducibilitySnapshot (§25)

---

## 37.8 Phase Mapping

| Item | Phase | Capability |
|---|---|---|
| ContextProfile contract + provenance | **4b (MVP)** | All 5 dimensions in schema; provenance per field |
| Open questions + blocking flag | **4b** | Halts audit_setup until answered |
| Constraints capture | **4b** | regulatory / accessibility / brand / technical |
| Pre-perception layer ordering | **4b** | audit_setup invokes Context Capture before page queue |
| MUST NOT discipline | **4b** | Constitution R25 |
| URL-pattern + JSON-LD page type inference | **4b** | Ports §07 §7.4 |
| Business archetype CTA + pricing inference | **4b** | High-confidence inference signals only |
| User intake (CLI prompt) | **4b** | Dashboard prompt deferred to 13b |
| Awareness levels (Schwartz) | **13b (master)** | unaware → most_aware |
| Message-match field per traffic source | **13b** | Highest-impact CRO context most audits miss |
| `is_indexed` (SEO vs paid landing) | **13b** | Distinct heuristic sets |
| Decision style (impulse / researched / committee / habitual) | **13b** | Friction tolerance varies |
| Geo + locale formal capture | **13b** | EU GDPR / CA CCPA / BR LGPD binding |
| ContextProfile in ReproducibilitySnapshot | **13b** | Pin context_profile_hash |
| Dashboard intake form | **13b** | Replaces CLI prompt for non-CLI audits |
| Heuristic weight modifiers | **deferred** | Calibration data needed first |

---

## 37.9 Tech Stack Defaults

- HTTP fetch: `undici` or `node-fetch` (no Playwright at this layer)
- HTML parse: `cheerio` or `linkedom` (no JSDOM)
- JSON-LD parse: `jsonld` package (extract `@type`, `name`, `offers`, `description`)
- Schema validation: Zod for ContextProfile shape
- Storage: ContextProfile is small (~5KB) — store inline in `context_profiles` table (§13)

---

**End of §37 — Context Capture Layer**
