---
title: 19-discovery-and-templates
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

# Section 19 — Discovery & Template Architecture

**Status:** Master architecture extension. Phase 8 implementation. Replaces the sitemap-based `buildPageQueue` function in §4.2 with a template-first bounded discovery strategy.

**Cross-references:**
- §4.2 (`audit_setup` node) — discovery output feeds the page queue
- §5.7.1 (`Template` type) — schema defined there
- §13.6.1 (`templates`, `template_members` tables) — persistence
- §18.4 (`AuditRequest.target`, `AuditRequest.scope.templates`) — inputs from trigger gateway
- §20 (State Exploration) — operates per discovered page
- §21 (Workflow Orchestration) — workflows synthesised from discovered templates

---

## 19.1 Principle

> **Discovery is not crawling. It is controlled identification of what matters on a site — templates, key pages, and funnel paths — with explicit exclusions, bounded cost, and template-level deduplication. The system should analyze 15-25 representative pages, not 500 redundant ones.**

---

## 19.2 Why Sitemap Crawling Is Wrong for CRO

| Problem | Impact |
|---|---|
| Sitemaps contain blog, legal, help, careers, press pages | 60-80% of crawled pages are irrelevant to CRO |
| Every product page crawled individually | 200 identical "missing trust signal" findings on an ecommerce site |
| No concept of templates | No way to say "all product pages share this issue" |
| 50-page arbitrary cap | Either too few (misses funnels) or too many (wastes budget on duplicates) |
| No funnel awareness | Homepage → PLP → PDP → cart → checkout is not modelled as a connected path |
| No exclusion intelligence | Crawls /blog/2019/my-cats-birthday alongside /checkout |

**REQ-DISC-000:** The Phase 1-5 `buildPageQueue` (§4.2) remains functional for MVP. Phase 6 replaces it with the template-first discovery pipeline defined in this section. The replacement is opt-in per client via `AuditRequest.scope.templates`.

---

## 19.3 Discovery Pipeline (7 stages)

```
INPUT: AuditRequest.target (root_url, crawl_scope, exclusion_patterns)
       AuditRequest.scope.templates (max_templates, representatives_per_template)
       ClientProfile (business_type, domain, sector)
  │
  ▼
STAGE 1: Seed Acquisition               (deterministic, parallel)
  │
  ▼
STAGE 2: Shallow Fetch                   (deterministic, Browser Agent Tier A only)
  │
  ▼
STAGE 3: Exclusion Filter                (deterministic, rule-based)
  │
  ▼
STAGE 4: Template Clustering             (deterministic, feature hashing + similarity)
  │
  ▼
STAGE 5: Template Classification         (hybrid: rules-first, LLM fallback)
  │
  ▼
STAGE 6: Representative Page Selection   (deterministic, scoring)
  │
  ▼
STAGE 7: Workflow Synthesis              (deterministic rules + consultant override)
  │
  ▼
OUTPUT: Template[], KeyPage[], Workflow[]
        → feed into unified work queue (§19.8)
```

---

## 19.4 Stage Details

### Stage 1 — Seed Acquisition

**REQ-DISC-001:** Collect candidate URLs from multiple sources in parallel:

| Source | Method | Priority | Max URLs |
|---|---|---|---|
| Client-provided URLs | From `AuditRequest.target.listed_urls` or `ClientProfile.config.seed_urls` | Highest — always included | Unlimited |
| Homepage outbound links | Parse homepage HTML, extract `<a href>` | High | Top 100 by DOM position |
| Sitemap.xml | Fetch + parse (filter by `AuditRequest.target.crawl_scope`) | Medium | Top 200 by `<lastmod>` recency |
| Known funnel paths | Pattern library per `business_type` (see §19.5) | High | 10-20 per business type |
| Robots.txt / ai-agent.txt | Parse for allowed/disallowed paths | N/A — filtering, not sourcing | N/A |

**REQ-DISC-001a:** Total seed cap: 500 URLs. If sources produce more, deduplicate by canonical URL, then truncate by priority.

**REQ-DISC-002:** Canonical URL normalization: strip trailing slashes, lowercase hostname, remove tracking parameters (`utm_*`, `gclid`, `fbclid`, `ref`, `source`), resolve redirects (single hop).

### Stage 2 — Shallow Fetch

**REQ-DISC-010:** (C2-L2-FIX) For each seed URL, perform a lightweight browser load using **direct Playwright** (navigate + extract, no LLM reasoning, no workflow recipe required — this is NOT Mode A/Tier A which requires pre-recorded recipes per §6.2):

1. Navigate to URL (5s timeout)
2. Wait for `DOMContentLoaded`
3. Extract: `<title>`, URL after redirects, DOM structural fingerprint, `<meta>` tags, heading structure, primary nav items, `<body>` text sample (first 500 chars)
4. Do NOT scroll, click, or interact
5. Close page

**REQ-DISC-011:** (S2-L2-FIX) Structural fingerprint = minhash of (tag name sequence + DOM depth histogram + semantic role attributes). CSS class names are **EXCLUDED** because CSS-in-JS frameworks (Tailwind, styled-components, Emotion) produce hash-based class names that change per build, making them unreliable signals. Tag structure + depth + ARIA roles are stable across builds.

**REQ-DISC-012:** (C2-L2-FIX) Cost: ~$0 per page (no LLM, direct Playwright only). Runtime: ~2s per page. Parallelise up to 5 concurrent fetches.

**REQ-DISC-013:** Failed fetches (timeout, 4xx, 5xx, blocked) are logged and excluded. No retry at discovery stage — if a page can't be fetched shallowly, it won't survive deep analysis either.

**REQ-DISC-013a:** (M10-L2-FIX) SPA detection: if a shallow fetch returns a DOM with <10 meaningful elements AND the page has JavaScript bundles >500KB, it is likely an SPA shell that requires client-side rendering. These pages are flagged as `spa_shell_detected` in the discovery log. They are still included in the seed set (they may work fine in the full browse agent with JS execution), but their structural fingerprint is unreliable and they are excluded from template clustering signals. Consultant review is recommended for SPA-heavy sites.

### Stage 3 — Exclusion Filter

**REQ-DISC-020:** Apply exclusion rules in order. Each rule can EXCLUDE a URL from further processing.

**Default exclusion rules by business_type:**

| Business type | Always exclude (unless consultant overrides) |
|---|---|
| All | `/blog/*`, `/legal/*`, `/privacy*`, `/terms*`, `/careers/*`, `/press/*`, `/about/*` (generic pages), `/sitemap*`, `/feed/*`, `/wp-admin/*`, `/wp-json/*`, `*.pdf`, `*.xml` |
| ecommerce | `/help/*`, `/faq/*`, `/returns-policy`, `/shipping-info` (unless in funnel) |
| saas | `/docs/*`, `/api/*`, `/changelog/*`, `/status/*` |
| leadgen | `/resources/*`, `/case-studies/*` (unless configured as funnel entry) |

**REQ-DISC-021:** Custom exclusions from `AuditRequest.target.exclusion_patterns` are applied as regex patterns. They ADD to defaults, they do not replace them.

**REQ-DISC-022:** Consultant override: `ClientProfile.config.force_include_paths[]` — paths that survive exclusion even if matched by a rule. Use case: `/blog/pricing-guide` is a key landing page despite being under `/blog/`.

**REQ-DISC-023:** Exclusion log: every excluded URL + the rule that excluded it is logged to the audit trail. Consultants can review "what was skipped" in the audit detail view.

### Stage 4 — Template Clustering

**REQ-DISC-030:** Group surviving URLs into templates using a 3-signal similarity model:

| Signal | Weight | Method |
|---|---|---|
| URL pattern | 0.4 | Regex extraction: `/product/{slug}`, `/category/{slug}`, etc. |
| Structural fingerprint | 0.4 | Minhash Jaccard similarity on DOM fingerprint (Stage 2) |
| Heading/nav similarity | 0.2 | Jaccard similarity on h1 text + primary nav items |

**REQ-DISC-031:** Clustering algorithm: HDBSCAN (density-based, no need to pre-specify k). Parameters: `min_cluster_size=2`, `min_samples=1`. Singletons become their own template.

**REQ-DISC-031a:** (S1-L2-FIX) Implementation note: HDBSCAN is primarily a Python algorithm. For TypeScript/Node.js, preferred implementation: `hdbscan-js` or equivalent. Fallback: agglomerative hierarchical clustering with dynamic cut (available in `ml-hclust`). Algorithm choice is encapsulated behind a `TemplateClustering` adapter interface and can be swapped without affecting the pipeline. The adapter contract: `cluster(features: number[][], config: ClusterConfig): ClusterResult[]`.

**REQ-DISC-032:** All clustering is deterministic — same inputs, same clusters. No randomness in the algorithm. HDBSCAN with fixed parameters on fixed feature vectors is deterministic.

**REQ-DISC-033:** Template cap: `AuditRequest.scope.templates.max_templates` (default 20). If more clusters produced, merge the smallest clusters into an "other" template. The "other" template gets 1 representative (lowest priority).

**REQ-DISC-034:** Each template gets:
- `id`: deterministic hash of (url_pattern + structural_hash of centroid member)
- `url_pattern`: extracted from URL regex analysis (null if no pattern detected)
- `structural_hash`: minhash of the centroid member
- `member_count`: number of URLs in the cluster
- `tags`: derived from heading content + meta tags (e.g., "product", "long-form", "image-heavy")

### Stage 5 — Template Classification

**REQ-DISC-040:** Classify each template into a `PageType` using a two-tier approach:

**Tier 1 — Rule-based classification (deterministic, always tried first):**

```typescript
function classifyTemplateByRules(template: Template): PageType | null {
  const pattern = template.url_pattern?.toLowerCase() ?? "";
  const centroidTitle = template.centroid_title?.toLowerCase() ?? "";
  const centroidHeadings = template.centroid_headings?.map(h => h.toLowerCase()) ?? [];

  // URL pattern rules
  if (/^\/$|^\/home/i.test(pattern)) return "homepage";
  if (/\/product[s]?\//i.test(pattern)) return "product";
  if (/\/categor[y|ies]\//i.test(pattern)) return "category";
  if (/\/cart/i.test(pattern)) return "cart";
  if (/\/checkout/i.test(pattern)) return "checkout";
  if (/\/pricing/i.test(pattern)) return "pricing";
  if (/\/search/i.test(pattern)) return "search";
  if (/\/account|\/profile|\/dashboard/i.test(pattern)) return "account";
  if (/\/landing|\/lp\//i.test(pattern)) return "landing";
  if (/\/sign[-]?up|\/register/i.test(pattern)) return "form";
  if (/\/confirm|\/thank[-]?you|\/success/i.test(pattern)) return "other"; // post-conversion

  // Content rules
  if (centroidTitle.includes("add to cart") || centroidHeadings.some(h => h.includes("product"))) return "product";
  if (centroidTitle.includes("pricing") || centroidTitle.includes("plans")) return "pricing";

  return null; // fall through to LLM
}
```

**REQ-DISC-041:** Tier 1 success rate target: ≥70% of templates classified without LLM.

**Tier 2 — LLM fallback (only for templates Tier 1 returns null):**

**REQ-DISC-042:** Single LLM call with all unclassified templates batched:

```
Given these URL patterns and page titles, classify each into one of:
homepage, product, checkout, cart, form, landing, pricing, category, search, account, other

Template 1: pattern="/collection/{slug}", title="Summer Collection - BrandName"
Template 2: pattern="/pages/{slug}", title="About Our Story"
...

Respond with JSON: [{ "template_index": 0, "page_type": "category", "confidence": 0.85 }]
```

**REQ-DISC-043:** LLM classification confidence below 0.5 → default to "other". Logged for consultant review.

**REQ-DISC-044:** Classification source ("rule" or "llm_fallback") and confidence stored per template in the `templates` table (§13.6.1).

### Stage 6 — Representative Page Selection

**REQ-DISC-050:** For each template, select 1-3 representative pages (configurable via `AuditRequest.scope.templates.representative_pages_per_template`, default 1 for MVP, 2-3 for thorough mode).

**Selection criteria (scored, highest wins):**

| Signal | Weight | Why |
|---|---|---|
| Path depth (shallower = higher) | 0.3 | Shallower pages tend to be more canonical |
| Content richness (word count + element count) | 0.25 | Richer pages have more to analyze |
| Structural centrality (closest to cluster centroid) | 0.25 | Most representative of the template |
| Recency (from sitemap `<lastmod>`) | 0.1 | More recently updated = more relevant |
| Client-provided flag (from seed URLs) | 0.1 | Client explicitly cares about this URL |

**REQ-DISC-051:** For templates with only 1 member, that member is automatically the representative.

**REQ-DISC-052:** For templates with >10 members and `representative_pages_per_template >= 2`, select pages that MAXIMIZE diversity within the template (furthest from each other in feature space) rather than just top-2 by score. Prevents selecting two nearly-identical pages.

**REQ-DISC-053:** Selected representatives stored in `templates.representative_urls` and `template_members.is_representative = true`.

### Stage 7 — Workflow Synthesis

**REQ-DISC-060:** Synthesise workflow definitions from discovered templates using business-type-specific rules:

```typescript
const WORKFLOW_PRESETS: Record<BusinessType, WorkflowPreset[]> = {
  ecommerce: [
    { name: "purchase-funnel", steps: ["homepage", "category", "product", "cart", "checkout"] },
    { name: "search-to-purchase", steps: ["homepage", "search", "product", "cart", "checkout"] },
  ],
  saas: [
    { name: "signup-funnel", steps: ["homepage", "pricing", "form"] },
    { name: "trial-funnel", steps: ["landing", "form", "account"] },
  ],
  leadgen: [
    { name: "lead-capture", steps: ["landing", "form"] },
    { name: "content-to-lead", steps: ["homepage", "landing", "form"] },
  ],
  marketplace: [
    { name: "buyer-funnel", steps: ["homepage", "search", "product", "checkout"] },
  ],
  media: [],         // no default funnels
  fintech: [
    { name: "application-funnel", steps: ["homepage", "pricing", "form"] },
  ],
  healthcare: [
    { name: "appointment-funnel", steps: ["homepage", "form"] },
  ],
  education: [
    { name: "enrollment-funnel", steps: ["homepage", "pricing", "form"] },
  ],
};
```

**REQ-DISC-061:** A workflow is only synthesised if ALL required template types (step page_types) were discovered. If "cart" was not found for an ecommerce site, the "purchase-funnel" workflow is synthesised without the cart step and flagged as `incomplete`.

**REQ-DISC-062:** Each workflow step maps to a specific representative page from the discovered templates. If a template has multiple representatives, the first (highest-scored) is used for the workflow.

**REQ-DISC-063:** Consultant override via `AuditRequest.scope.workflows.custom_workflows[]`:

```typescript
interface CustomWorkflowDefinition {
  name: string;
  steps: Array<{
    url: string;              // explicit URL
    page_type: PageType;
    funnel_position: FunnelPosition;
  }>;
}
```

Custom workflows bypass template discovery entirely — they use consultant-provided URLs directly.

**REQ-DISC-064:** Workflow output stored in `workflows` and `workflow_steps` tables (§13.6.2).

---

## 19.5 Known Funnel Path Patterns (per business type)

**REQ-DISC-070:** During Stage 1, these paths are added as seeds even if not in sitemap:

| Business type | Paths to probe |
|---|---|
| ecommerce | `/cart`, `/checkout`, `/checkout/shipping`, `/checkout/payment`, `/checkout/confirmation`, `/wishlist`, `/account/orders` |
| saas | `/pricing`, `/signup`, `/register`, `/trial`, `/demo`, `/onboarding` |
| leadgen | `/contact`, `/get-quote`, `/book-demo`, `/free-trial`, `/thank-you` |
| marketplace | `/sell`, `/list-item`, `/buyer/checkout`, `/seller/dashboard` |
| fintech | `/apply`, `/application`, `/verify`, `/kyc` |

**REQ-DISC-071:** Probed paths that return 404 or redirect to unrelated pages are silently dropped.

---

## 19.6 Caps and Budget

| Cap | Default | Configurable via |
|---|---|---|
| Max seed URLs | 500 | Not configurable — hard ceiling |
| Max shallow fetches | 500 | Same as seeds |
| Max templates | 20 | `AuditRequest.scope.templates.max_templates` |
| Representatives per template | 1 (MVP) / 2-3 (thorough) | `AuditRequest.scope.templates.representative_pages_per_template` |
| Max total pages to analyze | 50 | `AuditRequest.budget.max_pages` |
| Max workflows | 5 | Hard ceiling per audit |
| Discovery LLM calls | 1 (batched template classification) | Not configurable |
| Discovery runtime | 5 minutes | Hard ceiling |
| Discovery cost | ~$0.05 (1 LLM call for unclassified templates) | Negligible |

**REQ-DISC-080:** If `max_pages` is reached before all templates have representatives, prioritize templates by: funnel-critical types first (checkout > cart > product > pricing > form > homepage > category > landing > search > account > other).

---

## 19.7 Completion Conditions

**REQ-DISC-090:** Discovery is complete when ALL of these are true:

1. All seeds have been fetched or timed out
2. Exclusion filtering complete
3. Clustering complete
4. All templates classified
5. All representatives selected
6. All workflows synthesised (or marked incomplete)

**REQ-DISC-091:** Discovery failure modes:

| Failure | Response |
|---|---|
| Root URL unreachable | Audit fails with `discovery_failed: root_unreachable` |
| 0 seeds survive exclusion | Audit fails with `discovery_failed: all_excluded`. Consultant reviews exclusion rules. |
| 0 templates produced | Audit fails with `discovery_failed: no_templates`. Likely a very small or broken site. |
| Clustering takes >60s | Truncate to top 200 pages by priority, re-cluster |
| LLM classification fails | All unclassified templates default to "other" |

---

## 19.8 Queue Synthesis

**REQ-DISC-100:** After discovery, the unified work queue is built from:

1. **PAGE items** — one per representative page across all templates
2. **WORKFLOW items** — one per synthesised workflow

STATE items are NOT created during discovery — they are created dynamically during page execution by the State Exploration Engine (§20).

```typescript
interface WorkItem {
  id: string;                           // UUID
  audit_run_id: string;
  type: "page" | "workflow";            // STATE items created at runtime by §20

  // For PAGE items
  page_url?: string;
  template_id?: string;
  page_type?: PageType;

  // For WORKFLOW items
  workflow_id?: string;
  workflow_name?: string;

  // Scheduling
  priority: number;                     // higher = process first
  status: "pending" | "in_flight" | "completed" | "failed" | "budget_skipped" | "checkpointed";
  // `checkpointed` status is set when a Temporal `continueAsNew` boundary occurs mid-work-item
  // processing (§27 DO-06). The item resumes in the new workflow execution from its last checkpoint.
  estimated_cost_usd: number;           // pre-flight estimate
  actual_cost_usd: number;

  // Timing
  queued_at: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
  max_retries: number;                  // default 2
}
```

**REQ-DISC-101:** Queue priority scoring:

```
priority = TEMPLATE_TYPE_WEIGHT[page_type] * 100
         + (is_workflow_step ? 50 : 0)
         + (is_consultant_provided ? 30 : 0)
         + (template.member_count > 5 ? 10 : 0)  // high-traffic template likely matters more
```

| PageType | Weight |
|---|---|
| checkout | 10 |
| cart | 9 |
| product | 8 |
| pricing | 7 |
| form | 7 |
| homepage | 6 |
| landing | 5 |
| category | 4 |
| search | 3 |
| account | 2 |
| other | 1 |

**REQ-DISC-102:** Workflows are queued AFTER all their constituent PAGE items. A workflow item can only run when its step pages have all been individually analyzed (or failed). This ensures the Workflow Analyzer has per-page findings to synthesise cross-step insights from.

---

## 19.9 Discovery Output Contract

**REQ-DISC-110:** The discovery pipeline produces a `DiscoveryResult` that the orchestrator consumes:

```typescript
interface DiscoveryResult {
  templates: Template[];                         // §5.7.1
  key_pages: Array<{
    url: string;
    template_id: TemplateId;
    page_type: PageType;
    is_representative: boolean;
    selection_score: number;
  }>;
  workflows: WorkflowContext[];                  // §5.7.1
  work_queue: WorkItem[];

  // Diagnostics
  seeds_collected: number;
  seeds_after_exclusion: number;
  pages_fetched: number;
  pages_failed: number;
  templates_by_rule: number;
  templates_by_llm: number;
  exclusion_log: Array<{ url: string; rule: string }>;
  discovery_cost_usd: number;
  discovery_runtime_ms: number;
}
```

---

## 19.10 Backward Compatibility with Phase 1-5

**REQ-DISC-120:** Phase 1-5 implementations that use the original `buildPageQueue` (§4.2) continue to work. When `AuditRequest.scope.templates` is not provided, the orchestrator falls back to `buildPageQueue` with the existing sitemap + priority logic.

**REQ-DISC-121:** Phase 6+ implementations that use this section's discovery pipeline populate the `templates`, `template_members`, and `workflows` tables. Phase 1-5 implementations leave those tables empty.

---

## 19.11 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **8** | (FS-1-FIX: corrected from Phase 6 to Phase 8 per §16.5 C1-L3-FIX) Full 7-stage pipeline, template clustering, rule-based classification, representative selection, queue synthesis |
| **8** | Default exclusion rules per business type, known funnel path patterns |
| **9** | (FS-1-FIX: corrected from Phase 8 to Phase 9) Workflow synthesis integration with §21 Workflow Orchestration |
| **11** | Consultant dashboard: discovery review, exclusion override, template inspector |
| **15** | (FS-1-FIX: corrected from Phase 13 to Phase 15) Analytics-informed representative selection (traffic data from §30 F13 DX bindings) |

---

## 19.12 Failure Modes (Additions to §15)

| # | Failure | Detection | Response |
|---|---|---|---|
| **DF-01** | Root URL unreachable | Stage 1 HEAD/GET returns 5xx or timeout | Audit fails: `discovery_failed: root_unreachable` |
| **DF-02** | All seeds excluded by rules | Post-Stage-3 count = 0 | Audit fails: `discovery_failed: all_excluded`. Review exclusion config. |
| **DF-03** | Clustering produces 0 templates | HDBSCAN all-noise | Audit fails: `discovery_failed: no_templates`. Likely tiny/broken site. |
| **DF-04** | LLM classification batch fails | Zod validation or timeout | All unclassified → "other". Log warning. Proceed. |
| **DF-05** | Discovery runtime exceeds 5 min | Timer | Truncate remaining seeds, cluster what's fetched, proceed with partial. |
| **DF-06** | Sitemap missing or unparseable | HTTP 404 or XML parse error | Skip sitemap source. Rely on homepage links + known paths. Not a failure. |
| **DF-07** | Consultant override path returns 404 | Stage 2 fetch fails on forced URL | Include with `status: failed` and flag for consultant review. |

---

**End of §19 — Discovery & Template Architecture**
