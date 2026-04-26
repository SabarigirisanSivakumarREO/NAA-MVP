# Master Plan Refinement — Design Specification

> **Status:** Approved design. Ready for implementation planning.
> **Date:** 2026-04-15
> **Context:** Four independent LLM gap analyses (GPT, Claude, Deepseek, Kimi) identified ~50 unique gaps in the master architecture. This design addresses the gaps the user chose to promote into the master plan.
> **Scope:** 7 spec modifications + 3 new specs + ~50 new tasks (T213-T262). Revised total: ~263 tasks across 12 phases. Task IDs are preliminary — finalized in tasks-v2.2. v2.2a patch adds 8 tasks from external review feedback (overlay dismissal, discovery, personas, notifications, progressive funnel).

---

## Decisions (Locked by User)

| # | Decision |
|---|----------|
| 1 | Master plan stays at 213+ tasks. No cuts. MVP extracted later as subset. |
| 2 | Full browser agent complexity retained (Mode A/B/C, stealth, ghost-cursor, 9 verify strategies) for future SEO/accessibility expansion. |
| 3 | 100 heuristics retained. Benchmarks added as REQUIRED field (not optional). |
| 4 | MCP + Temporal retained for durable orchestration and external AI consumption. |
| 5 | Six new capabilities added: cross-page analysis, PDF export, cost tracking, golden tests, observability, mobile viewport (mobile is master-plan-only, not MVP). |

---

## Part 1: Spec Modifications

### 1.1 Heuristic Benchmark Schema (§9 Modification)

**What changes:** Every heuristic gets a REQUIRED `benchmark` field. Two types to handle the full spectrum from structural (quantitative) to content/persuasion (qualitative).

**Schema:**

```typescript
// Added to HeuristicSchema / HeuristicSchemaExtended
benchmark:
  | {
      type: "quantitative";
      value: string;              // "6-8" or "4.5:1" or "48px"
      source: string;             // "Baymard Institute 2024"
      unit: string;               // "fields" | "seconds" | "pixels" | "ratio" | "percentage"
      comparison: "less_than" | "greater_than" | "between" | "equals";
      threshold_warning: number;  // yellow zone boundary
      threshold_critical: number; // red zone boundary
    }
  | {
      type: "qualitative";
      standard: string;           // "Primary CTA should be visible above fold without scrolling"
      source: string;             // "Nielsen Norman Group 2023"
      positive_exemplar: string;  // "CTA in top 30% of viewport with high-contrast color"
      negative_exemplar: string;  // "CTA below 3 scrolls, same color as body text"
    }
```

**Integration points:**

1. **Evaluate prompt:** Benchmark data injected alongside each heuristic in the user message. For quantitative: "Industry standard: 6-8 fields (Baymard). This form has 14." For qualitative: "Standard: [standard]. Positive example: [exemplar]. Negative example: [exemplar]."
2. **New grounding rule GR-012:** If a finding claims a benchmark violation with a quantitative benchmark, the claimed measurement must be within +/-20% of the actual page data AND the benchmark must exist in the heuristic. For qualitative benchmarks, the finding must reference the standard text. Prevents LLM from hallucinating industry numbers.
3. **Scoring pipeline:** Benchmark gap magnitude weights `business_impact` — larger deviation from benchmark = higher impact score.
4. **Authoring priority:** Top 30 heuristics (Tier 1 structural) get benchmarks first. Remaining 70 filled iteratively. All 100 must have benchmarks before the heuristic KB is considered complete.

**Zod validation:** `benchmark` field is required (not optional). Heuristics without benchmarks fail schema validation and cannot be loaded.

**Affected tasks:** T101 (HeuristicSchema), T103-T105 (authoring — all 100 heuristics need benchmark data), T107 (filtering — unchanged but heuristics are richer), T127 (evaluate prompt template includes benchmarks).

---

### 1.2 Cross-Page Analysis (§4 + §7 Modification)

**What changes:** New `cross_page_analyze` node added to orchestrator between page loop completion and `audit_complete`.

**Updated orchestrator topology:**

```
audit_setup → page_router → [browse] → [analyze] → page_router (loop)
                                                          |
                                                    (queue empty)
                                                          |
                                                          v
                                                  cross_page_analyze   <-- NEW
                                                          |
                                                          v
                                                    audit_complete
```

**Three sub-capabilities, executed in order:**

**1. Pattern Detection (deterministic, no LLM)**

- Groups `grounded_findings` by `heuristic_id` across all pages.
- If the same heuristic is violated on 3+ pages with similar evidence, produces a `PatternFinding` that references all affected pages.
- Example output: "Trust signals missing on 7 of 10 product pages"
- Individual per-page findings retained for consultant drill-down. The pattern finding becomes the primary deliverable.

```typescript
interface PatternFinding {
  id: string;
  type: "pattern";
  scope: "cross_page_pattern";
  heuristic_id: string;
  affected_pages: Array<{ url: string; finding_id: string }>;
  affected_page_count: number;
  total_applicable_pages: number;       // how many pages this heuristic applied to
  violation_rate: number;               // affected / applicable
  representative_finding: GroundedFinding;  // best example for display
  severity: "critical" | "high" | "medium" | "low";  // inherited from most severe instance
  recommendation: string;               // "Add trust badges to all product pages"
}
```

**2. Consistency Check (deterministic, no LLM)**

- Compares across accumulated page perceptions: CTA styles (color, size, wording), navigation structure, trust signal types, branding elements.
- Flags inconsistencies with specific page references.

```typescript
interface ConsistencyFinding {
  id: string;
  type: "consistency";
  scope: "cross_page_consistency";
  dimension: "cta_style" | "navigation" | "trust_signals" | "branding" | "messaging";
  description: string;                  // "Primary CTA is blue on 8 pages but green on 2"
  pages_majority: Array<{ url: string; value: string }>;   // the "norm"
  pages_outlier: Array<{ url: string; value: string }>;    // the deviants
  severity: "medium";                   // consistency issues are always medium
}
```

**3. Funnel Analysis (LLM-assisted, one call)**

- Input: all page perceptions, all findings, detected page types, optional client-provided `funnel_definition`.
- Single LLM evaluation looking for: promise/delivery mismatches across pages, missing funnel steps, unnecessary friction, navigation dead ends, inconsistent messaging across journey stages.
- Temperature = 0. Budget cap: $1.00 for the entire funnel call.
- All funnel findings assigned Tier 2 (24hr delay) — cross-page LLM reasoning is medium reliability.
- Grounding: GR-001 through GR-008 apply. GR-007 bans conversion predictions.

```typescript
interface FunnelFinding {
  id: string;
  type: "funnel";
  scope: "funnel";
  funnel_stage_from: string;            // "product"
  funnel_stage_to: string;              // "cart"
  issue_type: "promise_mismatch" | "missing_step" | "friction_point" | "dead_end" | "messaging_inconsistency";
  pages_involved: Array<{ url: string; page_type: PageType; role: string }>;
  observation: string;
  assessment: string;
  evidence: { page_refs: string[]; data_points: string[] };
  severity: "critical" | "high" | "medium" | "low";
  recommendation: string;
  confidence_tier: "medium";            // always medium for LLM cross-page reasoning
}
```

**New FindingScope values:** `"cross_page_pattern"`, `"cross_page_consistency"`, `"funnel"` added to the existing FindingScope union.

**Lightweight PageSignals (v2.2a fix):** Instead of accumulating full AnalyzePerception objects (50-100KB each, 50 pages = 2.5-5MB state bloat), extract a lightweight summary after each page analysis:

```typescript
interface PageSignals {
  page_url: string;
  page_type: PageType;
  cta_count: number;
  cta_texts: string[];               // truncated to 50 chars each
  form_field_counts: number[];        // per form
  trust_signal_types: string[];       // "review", "badge", "testimonial", etc.
  nav_link_count: number;
  heading_texts: string[];            // h1/h2 only
  key_metric_violations: string[];    // "14 form fields vs 6-8 benchmark"
  finding_heuristic_ids: string[];    // which heuristics were violated
  finding_count: number;
  perception_quality_score: number;
}
```

**State additions:**

```typescript
// Lightweight signals accumulated across page loop (v2.2a: NOT full perceptions)
page_signals: Annotation<PageSignals[]>({
  reducer: (existing, incoming) => [...existing, ...incoming],
  default: () => []
}),

// Optional client-provided funnel definition
funnel_definition: Annotation<FunnelStage[] | null>({ default: () => null }),

// Optional client-provided personas (v2.2a)
personas: Annotation<PersonaContext[] | null>({ default: () => null }),

// Cross-page outputs
pattern_findings: Annotation<PatternFinding[]>({ default: () => [] }),
consistency_findings: Annotation<ConsistencyFinding[]>({ default: () => [] }),
funnel_findings: Annotation<FunnelFinding[]>({ default: () => [] }),
```

**PersonaContext (v2.2a addition):**

```typescript
interface PersonaContext {
  id: string;                          // "first-time-visitor"
  name: string;                        // "First-time visitor"
  description: string;                 // "Never visited this site before, comparing options"
  goals: string[];                     // ["find the right product", "compare prices", "trust the brand"]
  frustrations: string[];              // ["too many options", "hidden costs", "unclear returns policy"]
  business_type_applicability: BusinessType[];  // ["ecommerce", "saas"]
}
```

Default 2-3 personas per business type (e.g., ecommerce: first-time visitor, returning customer, price-sensitive shopper). Injected into evaluate prompt. Findings get `persona: string | null` field. The LLM evaluates heuristics from each persona's perspective, producing more consultant-like insights vs mechanical checklist output.

**DiscoveryStrategy (v2.2a addition):**

```typescript
interface DiscoveryStrategy {
  discover(rootUrl: string, config: DiscoveryConfig): Promise<AuditPage[]>;
}

// Three implementations:
// SitemapDiscovery: parse sitemap.xml (current default)
// NavigationCrawlDiscovery: BFS from homepage, depth 3, max 200 URLs, classify page types
// ManualDiscovery: accept URL list from client/consultant
```

audit_setup node accepts `discovery_strategy` parameter. MVP: SitemapDiscovery + ManualDiscovery. NavigationCrawlDiscovery added post-MVP.

**NotificationAdapter (v2.2a addition):**

```typescript
interface NotificationAdapter {
  notify(event: NotificationEvent): Promise<void>;
}

type NotificationEvent =
  | { type: "audit_completed"; audit_run_id: string; summary: AuditCompletionReport }
  | { type: "audit_failed"; audit_run_id: string; reason: string }
  | { type: "findings_ready_for_review"; audit_run_id: string; finding_count: number };
```

MVP implementation: email via Resend or Postmark (single API call per notification). Webhook implementation added post-MVP. Notification preferences stored per client/consultant profile.

**Progressive funnel context (v2.2a, master plan Phase 8 enhancement):** For subsequent pages in the audit, inject accumulated `PageSignals` from previous pages into the evaluate prompt. This enables inline funnel-aware findings like "the homepage promises free shipping but this product page doesn't mention it." This is a prompt enrichment change — no new infrastructure. For MVP, the post-hoc cross-page analysis is sufficient.

**FunnelStage type:**

```typescript
interface FunnelStage {
  name: string;                         // "Homepage", "Category", "Product", "Cart", "Checkout"
  expected_page_types: PageType[];      // ["homepage"], ["category"], ["product"], etc.
  expected_conversion_element: string;  // "Add to Cart", "Proceed to Checkout", "Place Order"
  order: number;                        // 1, 2, 3, 4, 5
}
```

---

### 1.3 Token-Level Cost Accounting (§11 + §26 Modification)

**What changes:** Every LLM call is logged atomically with actual token counts and cost. Budget enforcement shifts from estimate-based to actuals-based.

**LLM call record:**

```typescript
interface LLMCallRecord {
  id: string;                           // uuid
  audit_run_id: string;
  page_url: string | null;              // null for cross-page/audit-level calls
  node_name: string;                    // "evaluate" | "self_critique" | "funnel_analysis" | etc.
  heuristic_id: string | null;          // for interactive mode: which heuristic triggered this
  model: string;                        // "claude-sonnet-4-20260301"
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;                     // computed from MODEL_PRICING config
  duration_ms: number;
  cache_hit: boolean;                   // prompt caching hit/miss
  timestamp: string;                    // ISO
}
```

**New table: `llm_call_log`** — append-only. Indexed on `(audit_run_id)` and `(audit_run_id, node_name)`.

**MODEL_PRICING config:**

```typescript
const MODEL_PRICING: Record<string, { input_per_m: number; output_per_m: number }> = {
  "claude-sonnet-4-20260301": { input_per_m: 3.00, output_per_m: 15.00 },
  "gpt-4o-2025-xx-xx":       { input_per_m: 2.50, output_per_m: 10.00 },
  // ... updated as models change
};
```

**Three integration points:**

1. **LLMAdapter wraps every call:** Computes cost from actual token usage. Returns `LLMCallRecord` alongside LLM response. CostTracker writes record to `llm_call_log` and decrements `budget_remaining_usd` with actual cost.

2. **Pre-call budget gate:** Before every LLM call, CostTracker estimates cost from prompt token count via `LLMAdapter.getTokenCount()`. If `estimated_cost > budget_remaining_usd`, the call is skipped and a `budget_exceeded` event emitted. For the evaluate node specifically: if budget is tight, split heuristic batch (20 into two batches of 10) to reduce per-call risk.

3. **Post-audit cost summary:** `audit_complete` node computes from `llm_call_log`: `actual_cost_usd`, `cost_breakdown` by node type, `cost_per_page_avg`, `cache_hit_rate`. Written to `audit_runs.cost_summary` (JSONB). Feeds into §34 observability.

**Per-client cost attribution:** Every `llm_call_log` entry has `audit_run_id` which has `client_id`. Query: `SELECT client_id, SUM(cost_usd) FROM llm_call_log JOIN audit_runs ... GROUP BY client_id`. Enables per-client billing and profitability analysis.

**Changes to existing specs:**
- `LLMAdapter` interface (§6.14): `invoke()` return type extended with `{ response, callRecord: LLMCallRecord }`
- `CostTracker` (T118): refactored from estimate-based to actuals-based
- `AuditState.analysis_cost_usd`: updated from real call records, not estimates
- Budget caps ($15/audit, $5/page) enforced against actual spend

---

### 1.4 Mobile Viewport Support (§6 + §7 + §9 Modification)

**Status: Master plan only. Explicitly excluded from MVP extraction.**

**What changes:** Pages can be audited at multiple viewports. Types designed now, populated for desktop only in MVP phases.

**Schema additions:**

```typescript
// On AuditPage (§5)
viewport_strategy: "desktop_only" | "mobile_only" | "both";  // default: "desktop_only"

// On AnalyzePerception (§7.9) — new field in metadata block (populated as desktop in MVP)
viewport_context: {
  width: number;            // 1440 or 390
  height: number;           // 900 or 844
  device_type: "desktop" | "mobile";
};

// On Heuristic schema (§9) — REQUIRED
viewport_applicability: "desktop" | "mobile" | "both";  // default: "both"

// On Finding types (§5.2)
viewport: "desktop" | "mobile";  // which viewport produced this finding
```

**Pipeline behavior when `viewport_strategy === "both"`:**

1. Browse subgraph runs at 1440px (desktop) — produces desktop `AnalyzePerception`
2. Analysis pipeline runs on desktop perception — produces desktop findings
3. Orchestrator calls `page.setViewportSize({ width: 390, height: 844 })` on existing session
4. `deep_perceive` runs again — produces mobile `AnalyzePerception`
5. Analysis pipeline runs on mobile perception with mobile-filtered heuristics — produces mobile findings
6. Both perception sets stored. Both finding sets tagged with viewport.

**Third-stage heuristic filtering:**

- Stage 1: filterByBusinessType (100 to ~60-70)
- Stage 2: filterByPageType (~60-70 to 15-20)
- Stage 3: filterByViewport (15-20 to subset for current viewport)

Heuristics with `viewport_applicability: "both"` run on both passes. `"mobile"` only on mobile. `"desktop"` only on desktop.

**New mobile-specific heuristics (10-15):**

| ID | Check | Detection | Benchmark |
|---|---|---|---|
| MOB-TAP-001 | Tap target size >= 48px | Quantitative: boundingBox width/height | Google: 48x48px minimum |
| MOB-THUMB-001 | Primary CTA in thumb zone | Quantitative: CTA y-position in bottom 40% of viewport | UX research: bottom-third reachable |
| MOB-SCROLL-001 | No horizontal scroll | Deterministic: `scrollWidth > viewport.width` | Standard: zero horizontal scroll |
| MOB-STICKY-001 | Sticky header <= 15% viewport | Quantitative: header height / viewport height | Standard: <=15% viewport |
| MOB-FONT-001 | Body font >= 16px | Quantitative: computed font-size | Apple HIG: 16px minimum |
| MOB-MENU-001 | Hamburger menu discoverable | Observable: menu icon in top nav area | NNG: visible within first scan |
| MOB-INPUT-001 | Correct input types | Deterministic: email->type="email", phone->type="tel" | HTML spec: correct keyboard |
| MOB-SPACING-001 | Interactive element spacing >= 8px | Quantitative: gap between adjacent clickables | WCAG 2.5.8: target spacing |

Plus 2-3 more for content reflow, image sizing, viewport meta tag.

**Cost impact:** `viewport_strategy: "both"` roughly doubles per-page cost. Both passes share the page's $5 analysis budget.

**State additions:**

```typescript
page_perceptions_by_viewport: Annotation<Record<string, Record<string, AnalyzePerception>>>({
  // outer key: page_url, inner key: "desktop" | "mobile"
  default: () => ({})
}),
```

---

### 1.5 Perception Quality Scoring (§7 Modification)

**What changes:** Quality gate between `deep_perceive` and `evaluate`. Prevents wasted LLM calls on garbage perception data.

**Perception quality score:**

```typescript
interface PerceptionQualityScore {
  overall: number;                        // 0.0 to 1.0
  signals: {
    has_meaningful_content: boolean;       // wordCount > 50
    has_interactive_elements: boolean;     // ctas.length > 0 OR forms.length > 0
    has_navigation: boolean;              // primaryNavItems.length > 2
    has_heading_structure: boolean;        // headingHierarchy.length > 0
    no_overlay_detected: boolean;         // no high-z-index fixed elements covering >30% viewport
    no_error_state: boolean;              // no "access denied", "please verify", captcha indicators
    page_loaded: boolean;                 // DOMContentLoaded < 30000ms AND resourceCount > 5
  };
  blocking_issue: string | null;          // human-readable reason if overall < threshold
}
```

**Signal weights:**

| Signal | Weight | Rationale |
|--------|--------|-----------|
| has_meaningful_content | 0.25 | No content = nothing to evaluate |
| has_interactive_elements | 0.20 | CRO requires CTAs or forms |
| has_navigation | 0.10 | Real pages have navigation |
| has_heading_structure | 0.10 | Structured content signal |
| no_overlay_detected | 0.15 | Overlays corrupt all downstream analysis |
| no_error_state | 0.15 | Error pages are not auditable |
| page_loaded | 0.05 | Baseline sanity |

**Three outcomes:**

| Score | Action | Rationale |
|-------|--------|-----------|
| >= 0.6 | Proceed to evaluate normally | Perception is good enough |
| 0.3 - 0.59 | Partial analysis — run only Tier 1 quantitative heuristics (deterministic checks), skip LLM evaluate | Some data exists but insufficient for confident LLM evaluation. Saves cost. |
| < 0.3 | Skip page — mark `analysis_status: "perception_insufficient"`, log `blocking_issue`, move to next | Page not auditable. No LLM cost incurred. |

**Overlay detection:** Checks in `page_analyze` for elements with `position: fixed/sticky`, `z-index > 999`, bounding box covering >30% viewport area, common class patterns (`cookie`, `consent`, `modal`, `popup`, `overlay`, `chat-widget`).

**Overlay dismissal (v2.2a fix):** Before perception capture, an `overlay_dismissal` step in the browse subgraph attempts to clear detected overlays:

1. Detect overlay elements (same heuristics as quality gate)
2. Attempt to click accept/close/dismiss button using common selector patterns: `[class*="accept"]`, `[class*="close"]`, `[aria-label*="close"]`, `button:has-text("Accept")`, `button:has-text("Got it")`, `button:has-text("OK")`, `.cookie-consent button`, `.modal-close`
3. Wait for DOM stability (MutationObserver settles)
4. If dismissal fails (no matching button, click didn't work), proceed with overlay present — the quality gate handles degraded perception

This is a browser agent concern (pre-perception cleanup in the browse subgraph), not an analysis concern. Runs between page stabilization and `deep_perceive`.

**State additions:**

```typescript
perception_quality: Annotation<PerceptionQualityScore | null>({ default: () => null }),
analysis_status: Annotation<"complete" | "partial" | "perception_insufficient" | "failed" | "budget_exceeded" | "llm_failed" | "grounding_rejected_all">({
  default: () => "complete"
}),
```

---

### 1.6 Analysis Pipeline Error Recovery (§7 Modification)

**What changes:** Explicit recovery paths for every analysis failure mode.

**Recovery matrix:**

| Failure | Detection | Recovery | Status |
|---------|-----------|----------|--------|
| LLM timeout on evaluate | No response within 60s | Retry with split batch: 20 heuristics into 2x10. Both timeout = mark page. | `partial` or `llm_failed` |
| Semantically garbage output | Valid JSON but no real heuristic_ids or observations < 20 chars | Retry once with explicit instruction. Still garbage = skip. | `llm_failed` |
| Self-critique rejects ALL | `reviewed_findings.length === 0` | Skip critique. Send `raw_findings` to grounding. Log `critique_override_all_rejected`. | `complete` |
| Grounding rejects 100% | `grounded_findings.length === 0` AND `rejected_findings.length > 0` | Mark for consultant review. Raw findings + rejection reasons in internal store. | `grounding_rejected_all` |
| Budget exceeded mid-evaluate | `cost_usd > analysis_budget_usd` | Complete current call. Emit partial findings. Skip remaining heuristics. | `budget_exceeded` |
| Zero findings (clean page) | Valid JSON, zero findings | Accept as valid. If page has CTAs + forms + content AND zero findings across 15+ heuristics, log `suspiciously_clean` warning. | `complete` |
| Annotation failure (Sharp) | Image processing exception | Store findings without annotations. Non-fatal. | `complete` |
| Unexpected exception | Uncaught error | Catch at graph level. Log with stack trace. Mark page. Continue. | `failed` |

**Audit completion report:**

```typescript
interface AuditCompletionReport {
  pages_complete: number;
  pages_partial: number;
  pages_skipped_perception: number;
  pages_skipped_budget: number;
  pages_llm_failed: number;
  pages_grounding_rejected_all: number;
  pages_failed: number;
  completion_summary: string;           // "47/50 pages fully analyzed, 2 partial, 1 skipped"
}
```

**Principle:** The audit never silently drops a page. Every page gets a status. Every non-complete page gets a reason. The consultant always knows what happened.

---

### 1.7 LLM Failover & Rate Limiting (§6.14 Modification)

**Rate limiting:** Sliding window rate limiter in Redis per provider. Configurable RPM, TPM, max concurrent per provider. Exponential backoff with jitter (base 1s, 2x multiplier, +/-20% jitter, max 30s).

**Default rate limit configs:**

```typescript
const RATE_LIMITS = {
  anthropic: { requests_per_minute: 50, tokens_per_minute: 80000, max_concurrent: 5 },
  openai:    { requests_per_minute: 60, tokens_per_minute: 150000, max_concurrent: 5 },
};
```

**Failover policy (per-call, not per-audit):**

1. Try primary (Claude Sonnet 4), up to 3 retries with backoff
2. All 3 fail: switch to fallback (GPT-4o) for THIS CALL ONLY
3. Fallback: up to 2 retries
4. All fail: throw `LLMUnavailableError`
5. Next call: try primary again first (no sticky fallback)

**Failure classification:**
- 429 (rate limited), 500/502/503 (server error), 529 (overloaded), timeout, network error: RETRY
- 400 (bad request): DO NOT RETRY — this is a bug, log and fail immediately

**Failover tracking:**

```typescript
interface FailoverEvent {
  audit_run_id: string;
  page_url: string;
  node_name: string;
  primary_provider: string;
  primary_error: string;
  fallback_provider: string;
  fallback_succeeded: boolean;
  timestamp: string;
}
```

Stored in `audit_events`. Finding gets `model_used` field. `finding.model_mismatch = true` if produced by fallback. Consultant sees badge in review UI.

**Both providers down:**
- 3+ consecutive pages with `llm_failed`: audit pauses (`"paused_llm_unavailable"`)
- Critical alert via §34
- BullMQ schedules resume in 5 minutes, up to 3 attempts
- After 15 minutes total: audit marked `"failed"` with reason

**No degraded deterministic-only mode.** The evaluate step IS the product. Deterministic checks alone produce commodity output. Better to pause and resume than deliver junk quality.

---

## Part 2: New Specs

### 2.1 Section 34 — Observability & Operational Monitoring

**Three layers:**

**Layer 1: Structured Logging**

Every log line via Pino with mandatory correlation:

```typescript
interface LogContext {
  audit_run_id?: string;
  client_id?: string;
  page_url?: string;
  node_name?: string;
  heuristic_id?: string;
  trace_id?: string;            // LangSmith correlation
}
```

Rules: No `console.log` in production. All JSON structured. Sensitive data (heuristic content, credentials, full HTML) never logged. Log levels: debug (dev only), info (state transitions), warn (degraded), error (failures), fatal (unrecoverable).

**Layer 2: Audit Events**

New table `audit_events`:

```typescript
interface AuditEvent {
  id: string;
  audit_run_id: string;
  client_id: string;
  event_type: AuditEventType;
  page_url: string | null;
  metadata: Record<string, any>;
  timestamp: string;
}

type AuditEventType =
  | "audit_started"
  | "audit_completed"
  | "audit_failed"
  | "page_browse_started"
  | "page_browse_completed"
  | "page_browse_failed"
  | "page_analyze_started"
  | "page_analyze_completed"
  | "page_analyze_skipped"
  | "finding_produced"
  | "finding_grounding_rejected"
  | "finding_critique_rejected"
  | "finding_published"
  | "budget_warning"
  | "budget_exceeded"
  | "llm_call_completed"
  | "llm_call_failed"
  | "llm_provider_fallback"
  | "perception_quality_low"
  | "hitl_requested"
  | "cross_page_analysis_completed";
```

Powers SSE streaming and post-hoc analysis.

**Layer 3: Derived Metrics & Alerting**

*Audit-level metrics:* duration, actual cost, cost vs estimate ratio, completion rate, pages skipped, findings per page avg, grounding rejection rate, cache hit rate.

*Heuristic-level metrics (most important):*

```typescript
interface HeuristicHealthMetrics {
  heuristic_id: string;
  total_evaluations: number;
  findings_produced: number;
  passes: number;
  grounding_rejections: number;
  critique_rejections: number;
  consultant_approvals: number;
  consultant_rejections: number;
  health_score: number;         // (produced - grounding_rej - consultant_rej) / total
}
```

*Alerting rules (BullMQ scheduled job every 5 minutes):*

| Condition | Severity | Action |
|-----------|----------|--------|
| Audit running > 45 min | Warning | Log + email consultant |
| Audit running > 90 min | Critical | Log + email admin + pause option |
| Grounding rejecting > 80% on page | Warning | Flag page for manual review |
| Heuristic health_score < 0.3 | Warning | Flag heuristic for rewrite |
| Actual cost > 2x estimate | Warning | Log + review cost model |
| LLM provider 5+ errors in 10 min | Critical | Alert admin |
| 3+ audits failed in 1 hour | Critical | Alert admin, possible systemic issue |

Notifications via email (MVP), webhook (later). PostgreSQL is the metrics store.

*Operational dashboard:* `/console/admin/operations` — active audits with progress + ETA, 24h stats, heuristic health table, alert feed, 30-day cost trend. Admin role only.

---

### 2.2 Section 35 — Report Generation & Export

**Executive Summary (typed output from `audit_complete`):**

```typescript
interface ExecutiveSummary {
  overall_score: number;                  // 0-100
  overall_grade: "A" | "B" | "C" | "D" | "F";

  critical_issues_count: number;
  high_issues_count: number;
  medium_issues_count: number;
  low_issues_count: number;

  top_findings: GroundedFinding[];        // top 5 by priority

  category_breakdown: Array<{
    category: string;
    finding_count: number;
    avg_severity: number;
  }>;

  strengths: Array<{                      // from heuristic passes
    heuristic_id: string;
    description: string;
    pages_passing: number;
  }>;

  patterns: PatternFinding[];             // from cross-page analysis

  recommended_next_steps: string[];       // 3-5 sentences, LLM-generated, temp=0, $0.10 cap

  audit_metadata: {
    pages_analyzed: number;
    pages_skipped: number;
    total_findings: number;
    total_cost_usd: number;
    duration_seconds: number;
    heuristic_sources: string[];
  };
}
```

Scoring: `score = 100 - (critical x 15 + high x 8 + medium x 3 + low x 1)`, clamped [0, 100]. Grades: A >= 85, B >= 70, C >= 55, D >= 40, F < 40.

Strengths: heuristics passing on >= 80% of applicable pages. Pure code, no LLM.

**Action Plan (deterministic bucketing):**

```typescript
interface ActionPlan {
  quick_wins: ActionPlanPhase;        // high impact + low effort
  strategic: ActionPlanPhase;         // high impact + high effort
  incremental: ActionPlanPhase;       // low impact + low effort
  deprioritized: ActionPlanPhase;     // low impact + high effort
}

interface ActionPlanPhase {
  label: string;
  description: string;
  findings: GroundedFinding[];
  estimated_total_effort_hours: number;
  page_count: number;
}
```

Bucketing: high impact = `business_impact >= 6`, low effort = effort hours <= 8. Uses existing scoring pipeline output.

**PDF Report Generator:**

- Service: `ReportGenerator` in `packages/agent-core/src/delivery/ReportGenerator.ts`
- Approach: Next.js HTML template at `/api/report/[audit_run_id]/render` converted to PDF via Playwright `page.pdf()`. No new dependencies.
- Report pages: cover (client logo, date, grade badge) -> executive summary -> action plan (4 quadrants) -> findings by category (observation, assessment, severity, benchmark comparison, annotated screenshot, recommendation) -> cross-page patterns -> funnel analysis -> methodology note -> appendix (full finding table, perception quality summary)
- Branding: `ReportTemplate` config per client (logo_url, primary_color, secondary_color, company_name). Fallback: REO Digital / Neural branding.
- Storage: R2 at `/{client_id}/reports/{audit_run_id}/report.pdf`
- Delivery: downloadable from dashboards, optionally emailed via notification adapter
- Size budget: < 5MB. Screenshots at JPEG 70%. Max 50 screenshot crops per report.

---

### 2.3 Section 36 — Golden Test Suite & Quality Assurance

**Golden test case structure:**

```typescript
interface GoldenTestCase {
  id: string;                             // "GT-001"
  name: string;                           // "Amazon PDP — missing size guide"
  source_url: string;                     // original URL (reference only)
  captured_at: string;                    // ISO date
  validated_by: string;                   // consultant who validated

  // Frozen inputs
  perception: AnalyzePerception;
  page_type: PageType;
  business_type: BusinessType;
  filtered_heuristics: Heuristic[];

  // Expected outputs
  expected_findings: Array<{
    heuristic_id: string;
    status: "violation" | "pass";
    severity: "critical" | "high" | "medium" | "low";
    must_contain: string[];               // key phrases in observation/assessment
  }>;

  expected_false_positives: Array<{
    heuristic_id: string;
    reason: string;
  }>;
}
```

**Building golden tests (incremental):**
1. Consultant validates audit findings on a page
2. Developer exports perception + verdicts: `pnpm golden:capture --audit-run-id <id> --page-url <url>`
3. Saves to `test/golden/GT-XXX.json`
4. Target: 5 by Phase 7, 10 by Phase 8, 20 by Phase 9

**CI execution:**

Trigger: PR touches `analysis/`, `heuristics/`, or prompt template files.

Per golden test: load frozen inputs -> run evaluate -> run self_critique -> run grounding -> compare to expectations.

Metrics: true positives (found expected violations), false negatives (missed expected), false positives (flagged things in false positive list), unexpected (not in either list, flagged for human review).

Pass criteria: TP rate >= 80% across all tests, FP rate <= 20%, no individual test below 60% TP.

**Two CI modes:**
- Fast (every PR): `MockLLMAdapter` with cached responses. Tests grounding, filtering, scoring deterministically. Zero API cost.
- Nightly (scheduled): Real LLM calls. ~$1-2 per run. Catches prompt quality regressions.

**Regression alerting:** Nightly scores drop > 10% vs 7-day rolling average triggers P1 alert via §34. Blocks deployment until investigated.

**Offline Mock Mode:**

Environment variable: `NEURAL_MODE=offline`

Two mock adapters:
- `MockBrowserEngine` (implements `BrowserEngine`): returns saved HTML snapshots, perceptions, screenshots from `test/fixtures/`. No Playwright, no network.
- `MockLLMAdapter` (implements `LLMAdapter`): for known inputs returns cached responses. For unknown inputs returns structured placeholder. Tracks simulated calls/tokens/cost. No API calls.

**Fixture directory:**

```
test/
  fixtures/
    sites/
      amazon-pdp/
        perception.json
        page-state.json
        viewport.jpg
        fullpage.jpg
      bbc-homepage/
      shopify-checkout/
    llm-responses/
      evaluate-amazon-pdp.json
      critique-amazon-pdp.json
  golden/
    GT-001.json
    GT-002.json
```

**CLI commands:** `pnpm test:offline` (full pipeline against fixtures), `pnpm test:golden` (golden suite fast mode), `pnpm fixture:capture --url <url>` (one-time network hit, saves fixture).

---

## Part 3: New Task Estimates

| Addition | New Tasks | Suggested Phase | Task IDs |
|----------|-----------|-----------------|----------|
| Benchmark schema + GR-012 | 3 | Phase 6 | T213-T215 |
| Benchmark authoring (100 heuristics) | 1 (large) | Phase 6 | T216 |
| Cross-page pattern detection | 2 | Phase 8 | T217-T218 |
| Cross-page consistency check | 2 | Phase 8 | T219-T220 |
| Funnel analysis node | 3 | Phase 8 | T221-T223 |
| Token-level cost accounting | 3 | Phase 4 | T224-T226 |
| Mobile viewport types + pipeline | 3 | Phase 12 (new) | T227-T229 |
| Mobile heuristics (10-15) | 2 | Phase 12 (new) | T230-T231 |
| Perception quality scoring | 2 | Phase 7 | T232-T233 |
| Analysis error recovery paths | 2 | Phase 7 | T234-T235 |
| LLM rate limiting | 1 | Phase 4 | T236 |
| LLM failover policy | 2 | Phase 4 | T237-T238 |
| §34 Structured logging | 1 | Phase 9 | T239 |
| §34 Audit events table + emission | 2 | Phase 9 | T240-T241 |
| §34 Heuristic health metrics | 1 | Phase 9 | T242 |
| §34 Alerting rules + job | 1 | Phase 9 | T243 |
| §34 Ops dashboard page | 1 | Phase 9 | T244 |
| §35 Executive summary | 2 | Phase 9 | T245-T246 |
| §35 Action plan generator | 1 | Phase 9 | T247 |
| §35 PDF report generator | 2 | Phase 9 | T248-T249 |
| §36 Golden test infrastructure | 2 | Phase 0 + Phase 7 | T250-T251 |
| §36 Offline mock mode | 2 | Phase 0 | T252-T253 |
| §36 Fixture capture CLI | 1 | Phase 1 | T254 |
| **v2.2a additions (from external review):** | | | |
| Overlay dismissal step | 1 | Phase 1/5 | T255 |
| DiscoveryStrategy adapter interface | 2 | Phase 9 | T256-T257 |
| Persona-based evaluation (PersonaContext + prompt) | 2 | Phase 7 (can be MVP) | T258-T259 |
| NotificationAdapter + email implementation | 2 | Phase 9 | T260-T261 |
| Progressive funnel context injection | 1 | Phase 8 | T262 |
| **Total** | **~50** | | **T213-T262** |

**Revised master plan total: ~263 tasks across 12 phases.**

---

## Part 3b: Parallel Workstreams

**Phase 0b: Heuristic Authoring Kickoff (PARALLEL with engineering)**

Starts Day 1 alongside engineering Phase 0. CRO team authors heuristics while engineering builds infrastructure. Convergence at Phase 6.

| Milestone | When | Output |
|-----------|------|--------|
| Top 15 heuristics drafted (structural, Tier 1) | Week 2 | MVP heuristics for development testing |
| Top 15 benchmarks added (quantitative) | Week 3 | Benchmark data for GR-012 validation |
| First 5 golden test cases hand-crafted | Week 4 | Manual audit → validated perception + findings |
| 50 heuristics complete (all Baymard) | Week 6 | Half the KB ready |
| 100 heuristics complete with benchmarks | Week 9 | Full KB ready for Phase 6 integration |

**Critical dependency:** If heuristic authoring doesn't start until Phase 6 (Week 8-9), engineering will have an engine with no fuel. The CRO team must start authoring NOW.

## Part 3c: MVP Extraction Notes

When extracting MVP from this master plan:
- **Cross-page analysis:** Pattern detection only (deterministic). Defer consistency + funnel.
- **Golden tests:** First 5 hand-crafted during development, not via automated pipeline.
- **Ops dashboard:** Build last in Phase 9. Use SQL queries against audit_events in interim.
- **Phase 9 UI priority:** Consultant dashboard → client dashboard → PDF report → ops dashboard (last).
- **Persona evaluation:** Low effort (prompt change), can be in MVP.
- **Notifications:** Email on audit_completed — can be in MVP.

---

## Part 4: What Was Deliberately Not Added

| Gap (from analyses) | Why excluded |
|---------------------|--------------|
| Revenue impact calculator | GR-007 bans conversion predictions. Contradicts core design principle. Benchmarks + severity + evidence is the honest alternative. |
| GA4/analytics integration | External data dependency. System audits page content, not traffic. Client provides context separately. |
| Persona simulation engine (full engine) | Overkill. Persona-based evaluation via prompt enrichment achieves 80% of the value (added in v2.2a). Full PSE deferred. |
| A/B test design generator | Post-audit deliverable, not audit pipeline. Phase 13+ feature. |
| PII redaction on screenshots | Screenshots are of public web pages. System does not fill forms with real PII. Low real risk. |
| Cut Mode B / ghost-cursor / stealth | User decision: keep for SEO/accessibility expansion. |
| Cut to 20 heuristics | User decision: keep 100. |
| Separate DB tables per finding stage | Already handled in state fields. Separate tables add ETL complexity without benefit at this scale. |
| "Degraded deterministic-only mode" when LLM down | Evaluate step IS the product. Deterministic checks alone = commodity output. Better to pause and resume. |
