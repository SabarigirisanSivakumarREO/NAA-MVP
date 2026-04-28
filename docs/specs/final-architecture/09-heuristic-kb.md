---
title: 09-heuristic-kb
artifact_type: architecture-spec
status: approved
loadPolicy: on-demand-only
version: 2.3
updated: 2026-04-24
governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R22 (The Ratchet)
note: Reference material. Do NOT load by default (CLAUDE.md Tier 3). Load only the single REQ-ID section cited by the current task.
---

# Section 9 — Heuristic Knowledge Base

> **See also §33 — Agent Composition Model.** §33.6 adds dual-mode evaluation to the heuristic schema: each heuristic can declare a `static` evaluation strategy, an `interactive` strategy, or both. The schema extension is backward-compatible — heuristics without an `interactive` strategy fall back to static. See §33 §33.6 for the dual-mode contract.

> **Source of truth:** `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` Section 6

---

## 9.1 Heuristic Schema (Zod)

**REQ-HK-001:** Every heuristic SHALL conform to this Zod schema before being loaded.

```typescript
import { z } from "zod";

// === Enumerations (locked from v5.1) ===

export const PageTypeEnum = z.enum([
  "homepage",
  "product",
  "checkout",
  "cart",
  "form",
  "landing",
  "pricing",
  "category",
  "search",
  "account",
  "all",
]);

export const BusinessTypeEnum = z.enum([
  "ecommerce",
  "saas",
  "leadgen",
  "marketplace",
  "media",
  "fintech",
  "healthcare",
  "education",
]);

export const DataPointEnum = z.enum([
  "ctas",
  "forms",
  "trustSignals",
  "layout",
  "textContent",
  "headingHierarchy",
  "navigation",
  "images",
  "performance",
  "semanticHTML",
  "landmarks",
]);

export const HeuristicSourceEnum = z.enum([
  "baymard",
  "nielsen",
  "cialdini",
]);

export const SeverityEnum = z.enum(["critical", "high", "medium", "low"]);

export const EvidenceTypeEnum = z.enum(["measurable", "observable", "subjective"]);

// === Heuristic Schema ===

export const HeuristicSchema = z.object({
  // Unique identifier — pattern: {SOURCE}-{CATEGORY}-{NUMBER}
  // Examples: BAY-CHECKOUT-001, NIELSEN-USABILITY-005, CIALDINI-PERSUASION-003
  id: z.string().regex(/^[A-Z]{2,8}-[A-Z]+-\d{3}$/),

  source: HeuristicSourceEnum,
  category: z.string(),
  name: z.string().max(80),
  severity_if_violated: SeverityEnum,

  // Reliability tier — numeric, NOT string
  reliability_tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reliability_note: z.string(),

  detection: z.object({
    pageTypes: z.array(PageTypeEnum).min(1),
    businessTypes: z.array(BusinessTypeEnum).optional(),  // omit = applies to all
    lookFor: z.string().min(20),
    positiveSignals: z.array(z.string()),
    negativeSignals: z.array(z.string()),
    dataPoints: z.array(DataPointEnum).min(1),
    evidenceType: EvidenceTypeEnum,
  }),

  recommendation: z.object({
    summary: z.string().max(120),
    details: z.string(),
    researchBacking: z.string(),
  }),

  // === v2.2 Additions ===

  // Benchmark — REQUIRED on all heuristics (v2.2)
  // Either quantitative (structural/measurable) or qualitative (content/persuasion)
  benchmark: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("quantitative"),
      value: z.string(),                            // "6-8" or "4.5:1" or "48px"
      source: z.string(),                           // "Baymard Institute 2024"
      unit: z.string(),                             // "fields" | "seconds" | "pixels" | "ratio"
      comparison: z.enum(["less_than", "greater_than", "between", "equals"]),
      threshold_warning: z.number(),                // yellow zone boundary
      threshold_critical: z.number(),               // red zone boundary
    }),
    z.object({
      type: z.literal("qualitative"),
      standard: z.string(),                         // "Primary CTA visible above fold without scrolling"
      source: z.string(),                           // "Nielsen Norman Group 2023"
      positive_exemplar: z.string(),                // "CTA in top 30% of viewport with high-contrast color"
      negative_exemplar: z.string(),                // "CTA below 3 scrolls, same color as body text"
    }),
  ]),

  // Viewport applicability (v2.2, Phase 12 master plan only)
  viewport_applicability: z.enum(["desktop", "mobile", "both"]).default("both"),
});

export type Heuristic = z.infer<typeof HeuristicSchema>;

// === v2.2 Benchmark Requirements ===
// REQ-HK-BENCHMARK-001: Every heuristic MUST have a benchmark. No heuristic loads without one.
// REQ-HK-BENCHMARK-002: Structural heuristics (Tier 1 mostly) use quantitative benchmarks.
// REQ-HK-BENCHMARK-003: Content/persuasion heuristics use qualitative benchmarks.
// REQ-HK-BENCHMARK-004: The evaluate prompt injects benchmark data alongside each heuristic.
// REQ-HK-BENCHMARK-005: GR-012 validates benchmark claims against actual page data (see §7.7).

// === Knowledge Base Schema ===

export const HeuristicKnowledgeBaseSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  sources: z.array(z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().url(),
  })),
  heuristics: z.array(HeuristicSchema),
});

export type HeuristicKnowledgeBase = z.infer<typeof HeuristicKnowledgeBaseSchema>;
```

---

## 9.2 Reliability Tiers

**REQ-HK-002:** Heuristics SHALL be tagged with one of 3 reliability tiers based on research.

| Tier | Heuristic Types | LLM Reliability | Auto-Publish? | Source |
|------|----------------|----------------|---------------|--------|
| **1: Visual/Structural** | CTA visibility, form field count, heading hierarchy, trust signal presence, above/below fold, color contrast, image alt text, navigation structure | **High (>75%)** | Yes, if evidence grounded | MLLM UI Judge (2025) |
| **2: Content/Persuasion** | Copy quality, value proposition clarity, persuasion techniques, information architecture, content relevance | **Medium (~60%)** | After 24hr delay | GPT-4o vs Experts (2025) |
| **3: Interaction/Emotional** | Ease of use, flow intuitiveness, error prevention, flexibility, emotional response, conversion likelihood | **Low (~40%)** | No — consultant review required | MLLM UI Judge (2025) |

---

## 9.3 MVP Heuristic Counts

**REQ-HK-003:** MVP SHALL include ~100 heuristics across 3 sources and 3 tiers. Tier ratio: ~42% Tier 1 (visual/structural) · ~42% Tier 2 (content/persuasion) · ~16% Tier 3 (interaction/emotional).

| Source | Tier 1 | Tier 2 | Tier 3 | Total |
|--------|--------|--------|--------|-------|
| **Baymard** | ~22 | ~22 | ~6 | **50** |
| **Nielsen** | ~15 | ~12 | ~8 | **35** |
| **Cialdini** | ~5 | ~8 | ~2 | **15** |
| **Total** | **~42** | **~42** | **~16** | **~100** |

### Baymard Breakdown (50 heuristics)

| Category | Count |
|----------|-------|
| Homepage | 8-10 |
| Product page | 10-12 |
| Checkout | 12-15 |
| Cart | 5-7 |
| Forms | 5-8 |
| Mobile | 5-8 |

### Nielsen Breakdown (35 heuristics)

| Category | Count |
|----------|-------|
| 10 core Nielsen heuristics | 10 |
| NN/g sub-heuristics (forms, errors, navigation, accessibility, loading states) | 25 |

### Cialdini Breakdown (15 heuristics)

| Principle | Count |
|-----------|-------|
| Social Proof | 3 |
| Scarcity | 3 |
| Authority | 2 |
| Reciprocity | 2 |
| Commitment/Consistency | 3 |
| Liking | 2 |

---

## 9.4 Example Heuristics

### Example 1: Baymard (Tier 1, Visual/Structural)

```json
{
  "id": "BAY-CHECKOUT-001",
  "source": "baymard",
  "category": "checkout",
  "name": "Guest Checkout Option",
  "severity_if_violated": "critical",

  "reliability_tier": 1,
  "reliability_note": "Visual/structural — LLM can reliably detect presence/absence of guest checkout option",

  "detection": {
    "pageTypes": ["checkout", "cart"],
    "businessTypes": ["ecommerce", "marketplace"],
    "lookFor": "Check if there is a guest checkout option visible before requiring account creation. The option should be prominent, not hidden behind a 'create account' flow.",
    "positiveSignals": ["guest checkout", "continue as guest", "checkout without account", "skip sign up"],
    "negativeSignals": ["create account to continue", "sign up required", "register to checkout"],
    "dataPoints": ["ctas", "forms", "textContent"],
    "evidenceType": "measurable"
  },

  "recommendation": {
    "summary": "Add a prominent guest checkout option",
    "details": "Allow users to complete purchase without creating an account. Place the guest checkout option with equal or greater visual weight than the login/register option.",
    "researchBacking": "Baymard Institute found that 24% of users abandon checkout because the site required account creation."
  }
}
```

### Example 2: Nielsen (Tier 3, Interaction)

```json
{
  "id": "NIELSEN-USABILITY-001",
  "source": "nielsen",
  "category": "usability",
  "name": "Visibility of System Status",
  "severity_if_violated": "high",

  "reliability_tier": 3,
  "reliability_note": "Interaction heuristic — requires temporal evaluation of system feedback. LLM can detect presence of indicators but cannot verify timing reliably.",

  "detection": {
    "pageTypes": ["all"],
    "lookFor": "Check if the system provides appropriate feedback within reasonable time. Look for: loading indicators during async operations, progress bars in multi-step flows, confirmation messages after actions, clear error states.",
    "positiveSignals": ["loading", "progress", "step 1 of", "processing", "success", "saved"],
    "negativeSignals": [],
    "dataPoints": ["forms", "ctas", "navigation", "textContent"],
    "evidenceType": "observable"
  },

  "recommendation": {
    "summary": "Add system status feedback for user actions",
    "details": "Users should always know what is happening. Add loading spinners, progress indicators for multi-step processes, and confirmation messages after form submissions.",
    "researchBacking": "Nielsen's #1 usability heuristic. Users need to feel in control and know the system is responding."
  }
}
```

### Example 3: Cialdini (Tier 2, Content/Persuasion)

```json
{
  "id": "CIALDINI-PERSUASION-001",
  "source": "cialdini",
  "category": "persuasion",
  "name": "Social Proof",
  "severity_if_violated": "medium",

  "reliability_tier": 2,
  "reliability_note": "Persuasion heuristic — LLM can detect presence of social proof elements but quality assessment is subjective.",

  "detection": {
    "pageTypes": ["homepage", "product", "landing"],
    "lookFor": "Check if the page includes social proof elements: customer reviews, testimonials, user counts, trust badges, media mentions, case studies, star ratings. These should be visible and credible.",
    "positiveSignals": ["reviews", "customers", "rated", "stars", "testimonial", "trusted by", "as seen in", "case study"],
    "negativeSignals": [],
    "dataPoints": ["trustSignals", "textContent", "images"],
    "evidenceType": "observable"
  },

  "recommendation": {
    "summary": "Add social proof elements to increase trust",
    "details": "Include customer reviews, testimonials with real names/photos, user counts, or trust badges. Place at least one social proof element above the fold near the primary CTA.",
    "researchBacking": "Cialdini's principle of Social Proof: people follow the actions of others, especially under uncertainty."
  }
}
```

---

## 9.5 Validation Rules

**REQ-HK-010:** Every heuristic SHALL pass `HeuristicSchema.parse()` before being loaded into the system.

**REQ-HK-011:** `dataPoints` SHALL only reference valid `AnalyzePerception` sections (enforced by `DataPointEnum`).

**REQ-HK-012:** `pageTypes` SHALL only contain values from `PageTypeEnum`.

**REQ-HK-013:** `businessTypes` (when present) SHALL only contain values from `BusinessTypeEnum`.

**REQ-HK-014:** `id` SHALL match pattern `/^[A-Z]{2,8}-[A-Z]+-\d{3}$/`. Examples: `BAY-CHECKOUT-001`, `NIELSEN-USABILITY-005`, `CIALDINI-PERSUASION-003`.

**REQ-HK-015:** `reliability_tier` SHALL be the numeric literal 1, 2, or 3 (NOT a string).

---

## 9.6 Two-Stage Filtering Logic

Heuristic filtering happens in **two stages** at two different points in the audit lifecycle:

### Stage 1: Business Type Filter (once per audit, in `audit_setup`)

**REQ-HK-020a:** The orchestrator SHALL pre-filter heuristics by business type during `audit_setup`. This reduces the working set for the entire audit.

```typescript
function filterByBusinessType(
  allHeuristics: Heuristic[],
  businessType: BusinessType
): Heuristic[] {
  return allHeuristics.filter(h => {
    // No businessTypes declared = applies to all businesses
    if (!h.detection.businessTypes || h.detection.businessTypes.length === 0) return true;
    return h.detection.businessTypes.includes(businessType);
  });
}

// In audit_setup:
const allHeuristics = await heuristicLoader.loadAll();          // 100 heuristics
const businessFiltered = filterByBusinessType(allHeuristics, client.business_type);  // ~60-70
state.heuristic_knowledge_base = businessFiltered;              // stored in state (smaller checkpoint)
```

### Stage 2: Page Type Filter (once per page, in `page_router`)

**REQ-HK-020b:** The page_router SHALL filter the business-filtered set by page type for each page. This produces the final heuristic set for the evaluate node.

```typescript
function filterByPageType(
  businessFilteredHeuristics: Heuristic[],
  pageType: PageType
): Heuristic[] {
  return businessFilteredHeuristics.filter(h => {
    return h.detection.pageTypes.includes(pageType)
        || h.detection.pageTypes.includes("all");
  });
}

// In page_router:
const pageFiltered = filterByPageType(state.heuristic_knowledge_base, currentPageType);  // ~15-20
state.filtered_heuristics = prioritizeHeuristics(pageFiltered, 30);  // cap at 30
```

### Why Two Stages

| Aspect | Stage 1 (Business) | Stage 2 (Page) |
|---|---|---|
| **When** | Once per audit | Once per page |
| **Where** | `audit_setup` node | `page_router` node |
| **Input** | All 100 heuristics | ~60-70 business-filtered |
| **Output** | ~60-70 business-relevant | ~15-20 page-relevant |
| **Changes between pages?** | No — business type is per client | Yes — page type changes per page |
| **Stored in state** | `heuristic_knowledge_base` (reduced) | `filtered_heuristics` (final) |

This two-stage approach:
1. **Reduces state checkpoint size** — 60-70 heuristics in state instead of 100
2. **Reduces per-page filter work** — filtering 60-70 instead of 100 (marginal at MVP, significant at 500+)
3. **Future-proof** — at 500+ heuristics (Phase 2), business pre-filter reduces from 500 → ~300, making per-page filter faster
4. **Produces identical results** — `filter(business AND page)` = `filter(business) then filter(page)`
```

**REQ-HK-021:** Filtered set SHALL contain between 1 and 30 heuristics. If 0 after filtering, fall back to `pageType = "all"`. If > 30, prioritize by:
1. `reliability_tier` (Tier 1 first)
2. `severity_if_violated` (critical → high → medium → low)

```typescript
function prioritizeHeuristics(heuristics: Heuristic[], maxCount: number = 30): Heuristic[] {
  const tierOrder: Record<number, number> = { 1: 0, 2: 1, 3: 2 };
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  return heuristics
    .sort((a, b) => {
      const tierDiff = tierOrder[a.reliability_tier] - tierOrder[b.reliability_tier];
      if (tierDiff !== 0) return tierDiff;
      return severityOrder[a.severity_if_violated] - severityOrder[b.severity_if_violated];
    })
    .slice(0, maxCount);
}
```

---

## 9.7 Loading Strategy

**REQ-HK-030:** Heuristics SHALL be injected into the LLM **user message**, NOT the system prompt, NOT via a tool call.

### Why not system prompt?

System prompts are cached by LLM providers (Anthropic caches system prompts). If heuristics change per page type, you'd bust the cache every page = slower + more expensive.

### Why not a tool?

Tool calls add round-trips (LLM calls tool → waits → reasons). Since the orchestrator already knows the page type, it can pre-filter and inject directly. Faster, cheaper, same result.

### Token budget

```
System prompt (STATIC, cached):           ~500 tokens
User message — page data:                  ~5,000 tokens
User message — filtered heuristics (15-20): ~3,500 tokens
User message — instructions:               ~1,000 tokens
─────────────────────────────────────────────────────────
Total per evaluate call:                  ~10,000 tokens
```

### When a tool WOULD make sense

At 500+ heuristics where even filtered sets exceed context. Then use vector search to find semantically relevant heuristics. Deferred to post-MVP.

---

## 9.8 "Never Predict Conversion Impact"

**REQ-HK-040:** No heuristic recommendation SHALL contain conversion predictions. This is enforced by grounding rule GR-007.

### Prohibited Patterns

| Phrase | Why Banned |
|--------|-----------|
| "increase conversions by X%" | LLMs cannot predict (WiserUI-Bench 2025) |
| "improve conversion rate" | Too vague + implies prediction |
| "boost sales by X%" | Same problem |
| "lead to X% more conversions" | Same problem |
| "% improvement in" | Numeric prediction |

### What the System DOES Say

> "This page is missing social proof above the fold — a violation of Cialdini's Social Proof principle. Baymard research shows 88% of consumers trust user reviews as much as personal recommendations. **Recommendation:** Add customer reviews near the primary CTA."

### What the System NEVER Says

> "Adding social proof will increase conversions by 15-25%."

The difference: state the **heuristic violation** (factual), cite **research backing** (Baymard/Cialdini data), recommend **specific actions** (actionable). Do NOT predict **conversion numbers** (unreliable).

---

## 9.9 IP Protection Architecture

**REQ-HK-050:** The heuristic knowledge base is REO's intellectual property. Protection is mandatory.

### Storage & Distribution

```
PRIVATE GIT REPO: reo-digital/cro-heuristics
  Access: CRO team + CI/CD pipeline only
  Format: JSON files, version controlled
       │
       │ CI/CD pulls at build time
       ▼
APPLICATION BUNDLE
  Heuristics compiled into app as encrypted asset (AES-256-GCM)
  Decrypted at runtime, held in memory only
  Never written to disk in plaintext
       │
       │ Filtered heuristics injected into LLM prompt
       ▼
LLM EVALUATION
  LLM sees heuristic content (necessary for evaluation)
  LLM output (findings) does NOT include raw heuristic rules
       │
       │ Findings stored in DB
       ▼
CLIENT RESPONSE
  Clients see: finding description, evidence, recommendation, source attribution
  Clients do NOT see: heuristic ID, detection logic, signals, filtering rules
```

### Security Layers

**REQ-HK-051:**

| Layer | Protection |
|-------|-----------|
| **Repository** | Private repo, SSO access, commit audit log |
| **Build** | Compiled into app at build time, not fetched at runtime |
| **Runtime** | Decrypted in memory only, never written to temp files |
| **API/MCP** | Returns findings only, never raw heuristic content |
| **Dashboard** | Shows finding description + recommendation, not heuristic rules |
| **Database** | Stores `heuristic_id` reference string, not full heuristic JSON |
| **Encryption** | AES-256-GCM, key from environment variable |
| **LLM tracing** | Heuristics sent to LLM but **REDACTED** in LangSmith traces |

### What Clients See vs Don't See

| Visible to Client | Hidden (REO IP) |
|---|---|
| Finding description | Heuristic detection logic |
| Evidence from their page | Positive/negative signal patterns |
| Severity + confidence tier | Reliability tier classification rules |
| Recommendation | Heuristic filtering rules |
| Annotated screenshot | Which heuristics were skipped |
| Source attribution ("Based on Baymard research") | Raw heuristic JSON content |
| | Specific heuristic ID and rule structure |

---

## 9.10 Master Architecture Extensions — Forward-Compatible Schema (Phase 2-4)

**Status:** The §9.1 schema is the Phase 1 (MVP) locked schema. This section adds forward-compatible fields and enumerations required by Phases 2-4 of the master architecture. Phase 1 implementations MAY omit the §9.10 fields; Phase 2+ implementations SHALL populate them.

**Phase evolution recap:**
- **Phase 1:** JSON bundle, ~100 heuristics, categorical filter (§9.1-9.9 is complete for this)
- **Phase 2:** JSON + tags + overlays, ~500 heuristics, multi-key filter + prioritize
- **Phase 3:** Postgres catalog + pgvector, ~5,000 heuristics, filter → vector rerank → cap
- **Phase 4:** Phase 3 + learned client-specific calibration, TB-scale corpus, filter → vector → client reweight → cap

Full retrieval pipeline and phase transition plan lives in §22 Heuristic Retrieval Evolution (F5).

### 9.10.1 Extended Enumerations

```typescript
// === Existing (from §9.1) — retained ===
// PageTypeEnum, BusinessTypeEnum, DataPointEnum,
// HeuristicSourceEnum, SeverityEnum, EvidenceTypeEnum

// === New for Phase 2+ ===

export const RuleVsGuidanceEnum = z.enum(["rule", "guidance"]);
// "rule"     = binary detection, LLM only writes recommendation text
// "guidance" = interpretive, full LLM CoT evaluation required

export const EffortCategoryEnum = z.enum([
  "copy",          // word/text changes — lowest effort
  "content",       // add/remove content blocks
  "visual",        // styling, color, contrast
  "layout",        // structural reflow
  "code",          // engineering changes
  "architecture"   // significant refactor — highest effort
]);

export const HeuristicStatusEnum = z.enum([
  "experimental",  // under test, excluded from default runs
  "active",        // in use
  "deprecated"     // excluded from new runs, preserved for reproducibility
]);

export const FunnelPositionEnum = z.enum([
  "entry",
  "discovery",
  "decision",
  "intent",
  "conversion",
  "post_conversion"
]);

export const BrandTraitEnum = z.enum([
  "luxury",
  "mass_market",
  "discount",
  "enterprise",
  "consumer",
  "trust_sensitive",      // fintech, health, gov
  "impulse_purchase",
  "considered_purchase"
]);

// === Phase 3+: Preferred states (§20 State Exploration) ===

// A preferred_state is a StatePattern that tells the State Exploration Engine
// what interaction path is likely needed to evaluate this heuristic.
// Used by Pass 1 (heuristic-primed) exploration per Q2-R ruling.

export const StatePatternSchema = z.object({
  pattern_id: z.string(),                    // e.g., "reviews_tab_open"
  description: z.string(),                   // human-readable
  interaction_hint: z.object({
    type: z.enum(["click", "hover", "select", "scroll_to"]),
    target_text_contains: z.array(z.string()).optional(),   // e.g., ["Reviews", "Customer ratings"]
    target_role: z.string().optional(),                     // e.g., "tab"
    target_selector: z.string().optional(),                 // fallback CSS selector
  }),
  required: z.boolean().default(false),      // if true, heuristic cannot evaluate without this state
});

export type StatePattern = z.infer<typeof StatePatternSchema>;
```

### 9.10.2 Extended Heuristic Schema

**REQ-HK-EXT-001:** The `HeuristicSchema` from §9.1 SHALL be extended with the following fields. Phase 1 implementations MAY omit them; Phase 2+ SHALL populate them.

```typescript
export const HeuristicSchemaExtended = HeuristicSchema.extend({
  // === Versioning (Phase 2+) — required for reproducibility ===
  version: z.string().regex(/^\d+\.\d+\.\d+$/),          // semver
  status: HeuristicStatusEnum.default("active"),
  parent_id: z.string().optional(),                       // for overlays/variants
  deprecated_at: z.string().optional(),                   // ISO timestamp
  replaced_by: z.string().optional(),                     // heuristic id

  // === Rule vs guidance split (Phase 2+) ===
  rule_vs_guidance: RuleVsGuidanceEnum,
  // Rule heuristics: deterministic detection, LLM only writes recommendation
  // Guidance heuristics: full LLM CoT pipeline

  // === Business impact inputs (Phase 2+) — feeds deterministic scoring ===
  business_impact_weight: z.number().min(0).max(1),      // 0..1, per-heuristic multiplier
  funnel_positions: z.array(FunnelPositionEnum).optional(),

  // === Effort category (Phase 2+) — feeds deterministic effort scoring ===
  effort_category: EffortCategoryEnum,

  // === Overlay scoping (Phase 2+) ===
  brand_traits: z.array(BrandTraitEnum).optional(),       // null = applies to all brands
  client_overlay_only: z.boolean().default(false),        // true = only loaded for specific clients

  // === State exploration hints (Phase 3+) — §20 F3 ===
  preferred_states: z.array(StatePatternSchema).optional(),

  // === Vector retrieval (Phase 3+) — §22 F5 ===
  embedding: z.array(z.number()).optional(),                  // M2-FIX: unconstrained length (model-dependent)
  embedding_dimension: z.number().int().positive().optional(), // M2-FIX: e.g., 1536 for ada-002, 3072 for text-embedding-3-large
  embedding_model_version: z.string().optional(),             // which model produced the embedding; dimension derived from this
  retrieval_keywords: z.array(z.string()).optional(),         // full-text fallback

  // === Learned calibration (Phase 4+) — §28 F11 Learning Service ===
  learned_adjustments: z.array(z.object({
    client_id: z.string(),
    reliability_delta: z.number().min(-0.5).max(0.5),         // adjusts tier weight
    severity_override: SeverityEnum.optional(),
    suppress_below_confidence: z.number().min(0).max(1).optional(),
    approval_rate: z.number().min(0).max(1),                  // consultant feedback
    sample_size: z.number().int().min(0),
    last_calibrated_at: z.string(),
  })).optional(),
});

export type HeuristicExtended = z.infer<typeof HeuristicSchemaExtended>;
```

### 9.10.3 Extended Validation Rules

**REQ-HK-EXT-010:** Every Phase 2+ heuristic SHALL have `version`, `rule_vs_guidance`, `business_impact_weight`, and `effort_category` set.

**REQ-HK-EXT-011:** If `status === "deprecated"`, then `deprecated_at` SHALL be non-null. `replaced_by` is RECOMMENDED but not required.

**REQ-HK-EXT-012:** Deprecated heuristics SHALL NOT be included in new audit runs but SHALL remain queryable for reproducibility of past runs (REQ-STATE-EXT-INV-010).

**REQ-HK-EXT-013:** If `rule_vs_guidance === "rule"`, then `detection.evidenceType` SHALL be `"measurable"` and the heuristic SHALL have a deterministic detector function registered in the Rule Heuristic Registry (§22 F5).

**REQ-HK-EXT-014:** If `parent_id` is set, then `version` SHALL be greater than the parent's version OR differ in brand/client scoping fields. A child overlay cannot have the same effective scope as its parent.

**REQ-HK-EXT-015:** `business_impact_weight` combined with the impact matrix (§23 F6) SHALL produce finding business_impact scores. No LLM may directly set business_impact (Q4 locked).

**REQ-HK-EXT-016:** `preferred_states[]` with `required: true` SHALL be honoured by Pass 1 state exploration (§20 F3). If Pass 1 cannot satisfy a required state, the heuristic is skipped for that page and logged.

**REQ-HK-EXT-017:** `embedding` SHALL be produced by the `embedding_model_version` specified. On model upgrade, all embeddings SHALL be re-computed in a batch job; mixed-version retrieval is forbidden.

**REQ-HK-EXT-018:** `learned_adjustments[].reliability_delta` SHALL only be applied when `sample_size >= 30`. Below that, the adjustment is recorded but NOT applied to tier weighting.

**REQ-HK-EXT-019:** (S2-FIX) Overlays (brand, client, learned) SHALL compose additively. Conflicts resolve in priority order: **client > learned > brand > base**. Consultant intent (client overlay) always overrides statistical learning. Learned overrides brand defaults. Brand overrides global base. The resolution order is part of `overlay_chain_hash` in the reproducibility snapshot (REQ-STATE-EXT-INV-010).

### 9.10.4 Overlay System

**REQ-HK-EXT-020:** The heuristic KB supports a four-layer overlay chain applied in order:

```
BASE heuristic (source: baymard/nielsen/cialdini/research)
    │
    ▼ (optional, lowest priority override)
BRAND OVERLAY   ← filtered by brand_traits[]
    │              (e.g., "luxury" brand suppresses "cheap trust signal" heuristics)
    ▼ (optional)
LEARNED CALIBRATION  ← statistical from past audits (learned_adjustments)
    │                    (S2-FIX: learned overrides brand, but NOT client)
    ▼ (optional, highest priority override)
CLIENT OVERLAY  ← consultant-written rules for one client (client_overlay_only = true)
    │              consultant intent ALWAYS wins over statistical learning
    ▼
EFFECTIVE HEURISTIC used at runtime
```

**REQ-HK-EXT-021:** Each overlay application produces an immutable snapshot. The full chain is hashed (`overlay_chain_hash`) and stored in the `reproducibility_snapshot` for the audit run.

**REQ-HK-EXT-021a:** (S9-FIX) Canonical `overlay_chain_hash` computation: `sha256(canonicalJSON(overlays.map(o => ({ type: o.overlay_type, scope_key: o.scope_key, base_heuristic_id: o.base_heuristic_id, version: o.version }))))`. Overlays are ordered by resolution priority: base → brand → learned → client. `canonicalJSON` = sorted keys, no whitespace, UTF-8. Two audit runs with the same overlay chain produce the same hash.

**REQ-HK-EXT-022:** Overlays NEVER modify the base heuristic in-place. They produce a derived `HeuristicExtended` object held in memory for the duration of the audit run.

### 9.10.5 Rule vs Guidance — Runtime Split

**REQ-HK-EXT-030:** At analysis time, filtered heuristics are split into two lanes:

```
filtered_heuristics
    │
    ├──▶ rule_heuristics[]       (rule_vs_guidance === "rule")
    │       │
    │       ▼
    │    Deterministic Rule Runner (§22 F5)
    │       │
    │       ▼
    │    Pre-scored findings (severity + confidence already determined)
    │       │
    │       ▼
    │    LLM called ONLY to generate recommendation text (optional)
    │
    └──▶ guidance_heuristics[]   (rule_vs_guidance === "guidance")
            │
            ▼
         Analysis Pipeline (§7 existing: evaluate → critique → ground)
```

**REQ-HK-EXT-031:** The Rule Heuristic Registry SHALL provide a deterministic detector for every heuristic with `rule_vs_guidance === "rule"`. Detectors are pure functions: `(AnalyzePerception) => RuleDetectionResult`.

**REQ-HK-EXT-032:** (C4-FIX) Rule heuristic findings go through a **reduced** self-critique, NOT a full bypass. The reduced critique checks: (a) is the LLM-generated recommendation text appropriate for the deterministically-detected violation, (b) is the severity consistent with the rule's declared `severity_if_violated`, (c) are there logical errors in the recommendation. The "did you hallucinate the element" check IS skipped because detection was deterministic. This preserves the three-layer filter while acknowledging that rule detections are grounded by construction.

**REQ-HK-EXT-032a:** The reduced self-critique uses a **shorter** system prompt than the full guidance critique (§7.6). Target: ~2,000 input tokens vs ~6,000, saving ~65% of critique cost per rule finding while maintaining recommendation quality.

**REQ-HK-EXT-033:** Token savings from the rule/guidance split SHALL be tracked per audit run. Target: ≥30% token reduction vs pure-guidance evaluation at Phase 2 (revised from 40% — reduced critique retains more cost than full bypass).

### 9.10.6 Filtering Logic (Phase 2+)

**REQ-HK-EXT-040:** The Phase 1 filter (§9.6) is extended to apply overlays and calibration:

```typescript
function filterHeuristicsExtended(
  kb: HeuristicKnowledgeBaseExtended,
  pageType: PageType,
  businessType: BusinessType,
  clientId: string,
  brandTraits: BrandTrait[],
  templateTags: string[],
  funnelPosition?: FunnelPosition,
): HeuristicExtended[] {

  // 1. Categorical filter (Phase 1 behavior)
  let candidates = kb.heuristics.filter(h => {
    if (h.status !== "active") return false;
    const pageMatch = h.detection.pageTypes.includes(pageType)
                   || h.detection.pageTypes.includes("all");
    const businessMatch = !h.detection.businessTypes
                       || h.detection.businessTypes.includes(businessType);
    return pageMatch && businessMatch;
  });

  // 2. Brand trait filter (Phase 2+)
  candidates = candidates.filter(h => {
    if (!h.brand_traits || h.brand_traits.length === 0) return true;
    return h.brand_traits.some(t => brandTraits.includes(t));
  });

  // 3. Client overlay application (Phase 2+)
  candidates = applyClientOverlays(candidates, clientId);

  // 4. Funnel position boost (Phase 2+)
  if (funnelPosition) {
    candidates = candidates.map(h => ({
      ...h,
      _funnel_boost: h.funnel_positions?.includes(funnelPosition) ? 1.2 : 1.0,
    }));
  }

  // 5. Learned calibration (Phase 4+)
  candidates = applyLearnedCalibration(candidates, clientId);

  // 6. Vector rerank (Phase 3+)
  // candidates = vectorRerank(candidates, buildPageContextEmbedding(...));

  // 7. Prioritize + cap (extends §9.6 REQ-HK-021)
  return prioritizeExtended(candidates, 30);
}
```

**REQ-HK-EXT-041:** Filtered set SHALL still be bounded to 1-30 heuristics (unchanged from REQ-HK-021) regardless of overlay complexity.

### 9.10.7 Backward Compatibility

**REQ-HK-EXT-050:** Phase 1 heuristic JSON files (without §9.10 extensions) SHALL continue to load and validate against the base `HeuristicSchema` from §9.1. A Phase 2+ loader SHALL apply defaults when §9.10 fields are missing:

| Missing field | Default |
|---|---|
| `version` | `"1.0.0"` |
| `status` | `"active"` |
| `rule_vs_guidance` | `"guidance"` (safer — runs through full pipeline) |
| `business_impact_weight` | `0.5` |
| `effort_category` | `"content"` |
| `brand_traits` | `undefined` (applies to all) |
| `preferred_states` | `undefined` (no state hints) |
| `embedding` | `undefined` (falls back to categorical filter only) |
| `learned_adjustments` | `undefined` (no calibration applied) |

**REQ-HK-EXT-051:** Reproducibility snapshots (§25 F8) SHALL capture the loader version + default values used for missing fields, so that a Phase 2+ rerun of a Phase 1 audit produces bit-identical heuristic effective sets.

### 9.10.8 Cross-Reference Map

| §9.10 field | Consumed by | Phase introduced |
|---|---|---|
| `version`, `status`, `parent_id` | §25 Reproducibility (F8) | 2 |
| `rule_vs_guidance` | §22 Heuristic Retrieval (F5), Rule Heuristic Registry | 2 |
| `business_impact_weight` | §23 Findings Engine Extended (F6) | 2 |
| `effort_category` | §23 Findings Engine Extended (F6) | 2 |
| `brand_traits` | Overlay system (§22 F5) | 2 |
| `preferred_states` | §20 State Exploration (F3) Pass 1 | 3 |
| `embedding` | §22 Heuristic Retrieval (F5) | 3 |
| `learned_adjustments` | §28 Learning Service (F11) | 4 |

---

**End of §9 — Heuristic Knowledge Base (base §9.1-9.9 + master extensions §9.10)**
