# Neural MVP — Examples, Style Guide, and Pitfalls

> **Purpose:** Reference samples for Claude Code and human engineers. What does a correct AuditRequest look like? What does a grounded Finding look like vs one that grounding would reject? What writing style do findings follow? What mistakes should Claude Code avoid?
>
> **Audience:** Engineers implementing MVP v1.0 + Claude Code sub-agents + CRO team authoring heuristics.
>
> **Version:** v1.0 (2026-04-17)

---

## 1. Sample `AuditRequest` (input)

### Minimal — single URL, ecommerce

```json
{
  "audit_request_id": "req_2026-04-17_001",
  "client_id": "client_reo_demo",
  "trigger_source": "cli",
  "target": {
    "root_url": "https://shop.example.com",
    "discovery_strategy": "manual",
    "urls": [
      "https://shop.example.com/",
      "https://shop.example.com/products/widget-pro",
      "https://shop.example.com/cart",
      "https://shop.example.com/checkout"
    ]
  },
  "scope": {
    "max_pages": 4,
    "business_type": "ecommerce"
  },
  "budget": {
    "audit_budget_usd": 15.00,
    "per_page_budget_usd": 5.00
  },
  "heuristic_set": {
    "version": "v1.0",
    "tier_filter": ["tier_1", "tier_2"]
  },
  "notifications": {
    "on_complete": ["consultant@reo.digital"]
  },
  "tags": ["pilot-client", "demo"],
  "external_correlation_id": null
}
```

### Larger — sitemap discovery, up to 20 pages

```json
{
  "audit_request_id": "req_2026-04-17_002",
  "client_id": "client_acme_co",
  "trigger_source": "dashboard",
  "target": {
    "root_url": "https://acme.co",
    "discovery_strategy": "sitemap",
    "sitemap_url": "https://acme.co/sitemap.xml"
  },
  "scope": {
    "max_pages": 20,
    "business_type": "saas",
    "include_patterns": ["/pricing", "/features", "/signup", "/"],
    "exclude_patterns": ["/blog/*", "/docs/*", "/careers/*"]
  },
  "budget": {
    "audit_budget_usd": 15.00,
    "per_page_budget_usd": 5.00
  },
  "heuristic_set": { "version": "v1.0" },
  "notifications": {
    "on_complete": ["priya@reo.digital", "rahul@reo.digital"]
  },
  "tags": ["acme-q2-audit"]
}
```

---

## 2. Sample `urls.txt` (CLI input)

```
# Lines starting with # are comments and ignored.
# Blank lines ignored.

https://shop.example.com/
https://shop.example.com/category/widgets
https://shop.example.com/products/widget-pro
https://shop.example.com/products/widget-basic
https://shop.example.com/cart
https://shop.example.com/checkout
https://shop.example.com/about
```

Invoke: `pnpm cro:audit --urls ./urls.txt --business-type ecommerce --output ./out/run-2026-04-17`.

---

## 3. Sample `GroundedFinding` (output)

A finding that survived all 3 filter layers (CoT + self-critique + 12 grounding rules):

```json
{
  "finding_id": "F-2026-04-17-0042",
  "audit_run_id": "run_abc123",
  "page_url": "https://shop.example.com/checkout",
  "heuristic_id": "BAY-CHECKOUT-FORM-001",
  "status": "violation",
  "scope": "per_state",
  "severity": "high",
  "persona": "first-time-visitor",
  "observation": "The checkout form requires 14 fields (name, email, phone, street_1, street_2, city, state, zip, country, card_number, card_expiry, card_cvc, billing_name, billing_zip). The submit button is labeled 'Place Order'.",
  "assessment": "The 14-field count exceeds the Baymard Institute 2024 benchmark of 6-8 fields for a checkout form by 75%. This is above the threshold_warning (10) and approaches threshold_critical (15). For a first-time visitor unfamiliar with the brand, the cognitive load of a 14-field form is a significant friction point. The form does not offer guest checkout, which Baymard research identifies as a critical abandonment driver.",
  "evidence": {
    "element_ref": "form#checkout-main",
    "selector": "form#checkout-main",
    "data_point": "forms[0].fieldCount",
    "measurement": "14 (benchmark: 6-8, threshold_warning: 10, threshold_critical: 15)"
  },
  "recommendation": "Reduce checkout form to essential fields. Combine street_1 + street_2 into a single address field with optional secondary. Auto-detect country from IP. Defer non-essential fields (e.g., phone) to post-purchase. Consider offering guest checkout to reduce field count further.",
  "benchmark_citation": {
    "source": "Baymard Institute 2024 — Checkout Form Field Study",
    "type": "quantitative",
    "value": "6-8",
    "unit": "fields",
    "threshold_warning": 10,
    "threshold_critical": 15
  },
  "critique_verdict": "KEEP",
  "critique_reasons": [
    "Element exists in perception (forms[0])",
    "Severity 'high' proportional to 75% benchmark exceedance",
    "Logic coherent; recommendation actionable",
    "No contextual override (no schema.org indicating custom checkout)",
    "No duplicate finding on this page"
  ],
  "grounding_rules_passed": ["GR-001", "GR-002", "GR-003", "GR-005", "GR-006", "GR-007", "GR-008", "GR-012"],
  "confidence_tier": "high",
  "confidence_score": 0.85,
  "business_impact": 8.5,
  "effort": 3,
  "priority": 22.5,
  "annotated_screenshot_ref": "r2://neural-screenshots/client_reo_demo/run_abc123/checkout/F-2026-04-17-0042.jpg",
  "auto_publish": false,
  "model_used": "claude-sonnet-4-20260301",
  "model_mismatch": false,
  "viewport": "desktop",
  "created_at": "2026-04-17T10:42:13.221Z"
}
```

### Key invariants

- `evidence.data_point` MUST reference a real path into `AnalyzePerception` (GR-008). `forms[0].fieldCount` is valid because `AnalyzePerception.forms[0].fieldCount` exists.
- `evidence.measurement` SHOULD cite the benchmark (GR-012 validates: claimed 14 is within ±20% of actual 14).
- `severity: "high"` requires measurement (GR-006).
- `recommendation` MUST NOT predict conversion impact (GR-007 rejects). Notice: no "increase conversions by X%".
- `benchmark_citation` matches the heuristic's `benchmark` field.

---

## 4. Sample `RejectedFinding` (grounding caught a hallucination)

Example of a finding that did NOT survive grounding — the LLM hallucinated a non-existent element:

```json
{
  "finding_id": "F-2026-04-17-0043-REJECTED",
  "audit_run_id": "run_abc123",
  "page_url": "https://shop.example.com/checkout",
  "heuristic_id": "BAY-TRUST-SECURITY-001",
  "status_before_rejection": "violation",
  "severity_before_rejection": "medium",
  "observation_before_rejection": "The SSL badge in the footer is outdated and expired, reducing user trust.",
  "rejected_by_rule": "GR-001",
  "rejection_reason": "Referenced element not found in AnalyzePerception. Claimed 'SSL badge in footer' does not match any trustSignals entry. Closest match: trustSignals[2] type='badge' text='PCI Compliant' — but this is payment-security, not SSL, and has no expiry metadata. Finding appears to describe an element that does not exist on the page.",
  "critique_verdict_before_rejection": "KEEP",
  "raw_findings_stored": true,
  "consultant_review_required": false,
  "created_at": "2026-04-17T10:42:14.881Z"
}
```

### Why grounding caught this

1. LLM evaluated the page, noted a footer badge, inferred "SSL" (wrong — it was PCI Compliance)
2. Self-critique (different persona) didn't catch it — the claim sounded plausible
3. GR-001 check: does an element with selector/ref matching "SSL badge footer" exist in `AnalyzePerception.trustSignals`? No.
4. Rejected. Stored in `rejected_findings` table with rule_id + reason for consultant visibility.

---

## 5. Sample `PatternFinding` (cross-page, deterministic)

Emerges from the `cross_page_analyze` node when 3+ pages violate the same heuristic:

```json
{
  "finding_id": "PF-2026-04-17-0007",
  "audit_run_id": "run_abc123",
  "type": "pattern",
  "scope": "cross_page_pattern",
  "heuristic_id": "BAY-TRUST-REVIEWS-001",
  "severity": "high",
  "affected_pages": [
    { "url": "https://shop.example.com/products/widget-pro", "finding_id": "F-2026-04-17-0011" },
    { "url": "https://shop.example.com/products/widget-basic", "finding_id": "F-2026-04-17-0022" },
    { "url": "https://shop.example.com/products/widget-lite", "finding_id": "F-2026-04-17-0031" },
    { "url": "https://shop.example.com/products/widget-premium", "finding_id": "F-2026-04-17-0038" }
  ],
  "affected_page_count": 4,
  "total_applicable_pages": 5,
  "violation_rate": 0.80,
  "representative_finding": "F-2026-04-17-0022",
  "recommendation": "Customer reviews are absent on 4 of 5 product pages audited. Add review aggregation (schema.org AggregateRating) to all product pages. The one product with reviews (widget-X) shows a 4.7-star average and is a proof point that the pattern can be implemented.",
  "confidence_tier": "high",
  "created_at": "2026-04-17T10:50:02.100Z"
}
```

---

## 6. Sample cost summary line (per LLM call)

Stored in `llm_call_log`:

```json
{
  "id": "llmcall_2026-04-17_0213",
  "audit_run_id": "run_abc123",
  "page_url": "https://shop.example.com/checkout",
  "node_name": "evaluate",
  "heuristic_id": null,
  "model": "claude-sonnet-4-20260301",
  "input_tokens": 8234,
  "output_tokens": 1421,
  "cost_usd": 0.0466,
  "duration_ms": 3127,
  "cache_hit": false,
  "timestamp": "2026-04-17T10:42:10.000Z"
}
```

Audit-level cost summary written to `audit_runs.cost_summary` (JSONB):

```json
{
  "actual_cost_usd": 7.42,
  "estimated_cost_usd": 8.00,
  "cost_breakdown": {
    "evaluate": 4.82,
    "self_critique": 2.14,
    "executive_summary": 0.11,
    "cross_page_analyze": 0.35
  },
  "cost_per_page_avg": 0.37,
  "cache_hit_rate": 0.00,
  "total_tokens": { "input": 142050, "output": 28910 },
  "llm_calls_count": 87
}
```

---

## 7. Sample PDF report structure

8-section structure rendered via Next.js template at `/api/report/[audit_run_id]/render`, converted to PDF via Playwright `page.pdf()`:

```
╔══════════════════════════════════════════════════╗
║  COVER                                           ║
║    Client logo + name                            ║
║    Audit date + run ID                           ║
║    Grade badge (e.g., B+)                        ║
║    Prepared by REO Digital / Neural              ║
╠══════════════════════════════════════════════════╣
║  1. EXECUTIVE SUMMARY                            ║
║    Overall score (0-100)                         ║
║    Grade (A–F)                                   ║
║    Issue counts (critical/high/medium/low)       ║
║    Top 5 findings (priority-ranked)              ║
║    Strengths (heuristics passing ≥80% of pages)  ║
║    Category breakdown                            ║
║    Recommended next steps (3-5 bullets)          ║
╠══════════════════════════════════════════════════╣
║  2. ACTION PLAN                                  ║
║    4 quadrants (effort × impact):                ║
║      [Quick Wins] [Strategic]                    ║
║      [Incremental] [Deprioritized]               ║
║    Per quadrant: finding list + effort hours     ║
╠══════════════════════════════════════════════════╣
║  3. FINDINGS BY CATEGORY                         ║
║    Trust / CTA / Forms / Content / Performance   ║
║    Per finding:                                  ║
║      Observation                                 ║
║      Assessment                                  ║
║      Severity                                    ║
║      Benchmark comparison                        ║
║      Annotated screenshot                        ║
║      Recommendation                              ║
╠══════════════════════════════════════════════════╣
║  4. CROSS-PAGE PATTERNS                          ║
║    Each PatternFinding with affected pages       ║
╠══════════════════════════════════════════════════╣
║  5. FUNNEL ANALYSIS                              ║
║    (Deferred to v1.2 — MVP shows pattern only)   ║
╠══════════════════════════════════════════════════╣
║  6. METHODOLOGY NOTE                             ║
║    How the audit works (1 page)                  ║
║    Research sources (Baymard/Nielsen/Cialdini)   ║
║    3-layer filter explanation                    ║
║    "Findings are hypotheses" disclaimer          ║
╠══════════════════════════════════════════════════╣
║  7. APPENDIX                                     ║
║    Full finding table (CSV-like)                 ║
║    Perception quality summary per page           ║
║    Pages skipped + why                           ║
╠══════════════════════════════════════════════════╣
║  8. REPRODUCIBILITY NOTE                         ║
║    Model version, temperature, heuristic version ║
║    Audit run ID for re-run verification          ║
╚══════════════════════════════════════════════════╝
```

**Constraints:** < 5MB, branded per client (REO Digital default), JPEG 70% for screenshots, max 50 screenshot crops per report.

---

## 8. Writing style — good vs bad findings

### ✅ GOOD finding — grounded, specific, benchmark-cited, actionable

> **Observation:** The checkout form has 14 fields. The submit button text reads "Place Order".
>
> **Assessment:** The 14-field count exceeds the Baymard 2024 benchmark of 6-8 fields by 75%, above the threshold_warning of 10 and approaching threshold_critical of 15. For a first-time visitor unfamiliar with the brand, cognitive load is significant. No guest-checkout option is present.
>
> **Recommendation:** Reduce to essential fields. Combine address lines. Auto-detect country. Defer phone to post-purchase. Offer guest checkout.

**Why this works:**
- Observation cites the specific measurement
- Assessment compares against the benchmark (threshold_warning, threshold_critical)
- Recommendation is actionable, specific
- No conversion prediction
- References research source (Baymard)

### ❌ BAD finding #1 — vague, unfalsifiable

> "The checkout process could be improved to reduce friction and increase conversions."

**Why this fails:**
- No evidence
- No measurement
- "Increase conversions" — GR-007 rejects
- "Could be improved" — unfalsifiable
- No actionable recommendation

### ❌ BAD finding #2 — hallucinated element

> "The SSL badge in the footer appears outdated."

**Why this fails:**
- GR-001 rejects — "SSL badge" not in `trustSignals[]`
- No selector
- No `data_point`
- Fabricated observation

### ❌ BAD finding #3 — severity inflated

> **Observation:** The "Add to Cart" button uses #007BFF blue at 18px with contrast ratio 4.6:1.
>
> **Assessment:** CRITICAL — the blue shade is suboptimal.
>
> **Severity:** critical

**Why this fails:**
- Contrast 4.6:1 passes WCAG AA
- No benchmark violation
- Severity "critical" with no measurable threshold breach → GR-006 rejects
- Self-critique should catch this and DOWNGRADE to "low" or REJECT

### ❌ BAD finding #4 — conversion prediction

> **Recommendation:** "Adding trust badges above the fold will increase conversion by 15-30% based on similar ecommerce sites."

**Why this fails:**
- Banned phrase "increase conversion"
- GR-007 rejects at runtime
- Even if "15-30%" is based on real research, we cannot promise outcomes for THIS site
- Correct form: "Similar sites have reported conversion improvements when trust badges are placed above fold (Baymard 2024). Consider adding above fold and measure with A/B test."

---

## 9. Pitfalls Claude Code should avoid

### Code-level pitfalls

1. **Don't call `new Anthropic()` outside `LLMAdapter`.** Goes through `adapters/LLMAdapter.ts` only. If a task needs to call the LLM, use the adapter.
2. **Don't call `chromium.launch()` outside `BrowserManager`.** Playwright APIs live in `browser-runtime/`.
3. **Don't call `drizzle()` / raw Postgres queries outside `adapters/PostgresStorage.ts`.** Exception: migrations in `db/migrations/`.
4. **Don't use `zod` types in database schema.** Drizzle has its own type system; use Drizzle types at DB boundary, Zod at API/LLM boundary, and convert between them at the adapter layer.
5. **Don't define types in the component that uses them.** Types live in `types.ts` adjacent to the schema / interface that owns them.
6. **Don't use `any` to silence TypeScript.** Use `unknown` and narrow; or fix the root type.
7. **Don't log full `AnalyzePerception` objects.** They're 50-150KB each — blow up log volume. Log correlation IDs only.
8. **Don't concatenate SQL strings.** Drizzle parameterizes — never do `sql\`SELECT ... WHERE id = ${userInput}\`` without the param type.
9. **Don't catch errors silently** (`catch {}`). Either handle, re-throw, or log + re-throw.
10. **Don't hardcode model names in business logic.** `claude-sonnet-4-20260301` lives in `adapters/LLMAdapter.ts` config only.

### Design-level pitfalls

11. **Don't trust LLM output without Zod validation.** Every LLM response parsed through a Zod schema before use. Parse failure = retry or fail, not silently accept.
12. **Don't merge an LLM call into another LLM call** for efficiency. Self-critique MUST be a separate call with DIFFERENT persona (R5.6).
13. **Don't inject heuristics into the system prompt.** USER MESSAGE only (R5.5).
14. **Don't let the LLM choose whether to apply grounding.** Grounding is deterministic CODE that runs after every LLM response. No LLM judgment.
15. **Don't let a single page block the whole audit.** Every page gets `analysis_status`; orchestrator handles `perception_insufficient`, `budget_exceeded`, `llm_failed`, `failed` as non-fatal (§07.11).
16. **Don't capture more perception than you need.** `AnalyzePerception` is rich but once-per-page. `PageStateModel` is small but potentially per-step. Don't use the wrong one.
17. **Don't implement state exploration in MVP.** §20 is Phase 10 post-MVP. Default state only.
18. **Don't implement interactive composition in MVP.** §33 is Phase 11 post-MVP. Static evaluation only.
19. **Don't implement mobile viewport in MVP.** Phase 12 post-MVP. Desktop only.
20. **Don't add Temporal for MVP.** Synchronous BullMQ + Postgres checkpointer is sufficient.

### Process-level pitfalls

21. **Don't skip the spec.** Every task has a REQ-ID. Open the spec, read the REQ, then code.
22. **Don't commit without running lint + typecheck + test.** Three commands, every time.
23. **Don't commit drive-by edits.** If a task is "implement GR-001", don't also refactor scoring pipeline in the same commit.
24. **Don't dispatch sub-agents across shared schema changes.** Sequential updates to `AnalyzePerception`.
25. **Don't invent requirements.** If a spec is ambiguous, ASK. Constitution §16.

---

## 10. Heuristic authoring examples (for CRO team)

### ✅ GOOD heuristic — quantitative benchmark

```json
{
  "id": "BAY-CHECKOUT-FORM-001",
  "name": "Checkout form field count",
  "description": "Checkout forms with more than 8 fields show measurable abandonment increase per Baymard 2024 research.",
  "tier": 1,
  "source": "Baymard",
  "page_type_applicability": ["checkout"],
  "business_type_applicability": ["ecommerce"],
  "viewport_applicability": "both",
  "severity": "high",
  "version": "1.0.0",
  "rule_vs_guidance": "rule",
  "business_impact_weight": 0.85,
  "effort_category": "content",
  "status": "active",
  "benchmark": {
    "type": "quantitative",
    "value": "6-8",
    "source": "Baymard Institute 2024 — Checkout Form Field Study",
    "unit": "fields",
    "comparison": "between",
    "threshold_warning": 10,
    "threshold_critical": 15
  }
}
```

### ✅ GOOD heuristic — qualitative benchmark

```json
{
  "id": "NNG-CTA-FOLD-001",
  "name": "Primary CTA above fold",
  "description": "The primary conversion CTA should be visible without scrolling on landing pages.",
  "tier": 1,
  "source": "Nielsen",
  "page_type_applicability": ["homepage", "category", "product", "landing"],
  "business_type_applicability": ["ecommerce", "saas", "leadgen"],
  "viewport_applicability": "both",
  "severity": "high",
  "version": "1.0.0",
  "rule_vs_guidance": "guidance",
  "business_impact_weight": 0.75,
  "effort_category": "design",
  "status": "active",
  "benchmark": {
    "type": "qualitative",
    "standard": "The primary CTA should be visible above the fold, ideally in the top 30% of viewport.",
    "source": "Nielsen Norman Group 2023 — Landing Page Best Practices",
    "positive_exemplar": "Primary CTA in top 30% of viewport, high contrast against background, minimum 44×44px tap target.",
    "negative_exemplar": "Primary CTA below 3 scrolls, same color family as surrounding content, smaller than body text."
  }
}
```

### ❌ BAD heuristic — no benchmark

```json
{
  "id": "CUSTOM-VAGUE-001",
  "name": "Improve checkout",
  "description": "Make the checkout process better",
  "tier": 1,
  "source": "Custom",
  "severity": "high"
}
```

**Why this fails:**
- No benchmark (v2.2 schema rejects — benchmark REQUIRED)
- No page_type / business_type
- Description is vague — LLM has nothing to ground against
- Would fail Zod validation at load time

---

## 11. Company-specific policies (REO Digital)

- **No conversion predictions ever.** GR-007 enforces. Applies to findings, executive summary, action plan, PDF report. Even hypothetical "could increase" language is banned.
- **No auto-publish to clients during warm-up mode.** First 3 audits per client: ALL findings held for consultant review regardless of tier. Graduation: ≥ 3 audits + rejection rate < 25%.
- **Heuristic content is IP.** Never in API, dashboard, logs, LangSmith traces, or shared outside the team. In MVP (plain JSON), heuristics-repo is private; AES-256-GCM encryption before v1.1 external pilot.
- **Every finding is a HYPOTHESIS.** This language appears in: CLI output, dashboard, PDF report methodology section. Never phrase findings as "verdicts" or "facts".
- **Reproducibility is non-negotiable.** temperature=0 on evaluate / self_critique / evaluate_interactive. Snapshot every audit. Same inputs → ≥90% finding overlap within 24 hours.
- **Cost transparency per client.** Every LLM call logged atomically; per-client SQL attribution queryable. No "hidden costs".
- **Consultant owns the deliverable.** Neural produces hypothesis findings + annotated screenshots + draft report. Consultant approves, edits, rejects, and delivers to client. The system does NOT send reports directly to clients without consultant review.
- **Audit pages are public only.** MVP does not audit authenticated / logged-in pages. Credential handling is explicitly out of scope.

---

## 12. Error message style

When implementing error paths, use consistent structured messages:

```typescript
// GOOD — structured, includes context
throw new Error(
  `[GR-001] Element not found in perception. ` +
  `Finding references 'ctas[5]' but perception.ctas.length === 3. ` +
  `audit_run_id=${auditRunId} page=${pageUrl} heuristic=${heuristicId}`
);

// BAD — opaque
throw new Error("Element not found");

// BAD — leaks heuristic content
throw new Error(`Heuristic '${heuristic.name}: ${heuristic.description}' failed`);
```

---

## 13. Typical task flow (worked example)

You're implementing **M7.16 (GR-007 no conversion predictions)** in the MVP task list.

**Step 1 — Read the spec.** Task M7.16 references master plan task T128, which references §07.7 in `docs/specs/final-architecture/07-analyze-mode.md`. Open that file, find GR-007 spec.

**Step 2 — Read the examples.** Open THIS file §8 "BAD finding #4 — conversion prediction" to see what GR-007 catches.

**Step 3 — Write the failing test.**

```typescript
// packages/agent-core/tests/unit/analysis/grounding/gr007.test.ts
import { describe, it, expect } from "vitest";
import { groundGR007 } from "@/analysis/grounding/rules/GR007";

describe("GR-007 no conversion predictions", () => {
  it("rejects 'increase conversion' in recommendation", () => {
    const finding = {
      recommendation: "Adding trust badges will increase conversion by 15%.",
      observation: "No trust badges above fold.",
      assessment: "Missing social proof.",
    };
    const result = groundGR007(finding);
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/conversion prediction/i);
  });

  it("accepts recommendation without conversion language", () => {
    const finding = {
      recommendation: "Add trust badges above the fold. Measure with A/B test.",
      observation: "No trust badges above fold.",
      assessment: "Missing social proof.",
    };
    const result = groundGR007(finding);
    expect(result.pass).toBe(true);
  });
});
```

**Step 4 — Run the test, see it fail.**
`pnpm -F @neural/agent-core test:unit -- gr007.test.ts` → FAIL (module not found).

**Step 5 — Implement minimal code to pass.**

```typescript
// packages/agent-core/src/analysis/grounding/rules/GR007.ts
import type { GroundingResult, ReviewedFinding } from "@/analysis/types";

const BANNED_PATTERNS = [
  /\bincrease(s|d)?\s+conversion/i,
  /\bboost(s|ed)?\s+(conversion|revenue|sales)/i,
  /\b\d+\s*%\s*(lift|increase|improvement)/i,
  /\bROI\s+of\s+\d+/i,
  /\bconversion\s+(rate\s+)?(by|of)\s+\d+/i,
];

// REQ-GROUND-007: NEVER predict conversion impact. Catches both the finding
// text and the recommendation — both are client-facing and both are banned.
export function groundGR007(finding: Pick<ReviewedFinding, "observation" | "assessment" | "recommendation">): GroundingResult {
  const corpus = [finding.observation, finding.assessment, finding.recommendation].join(" ");
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(corpus)) {
      return {
        pass: false,
        reason: `GR-007: conversion prediction detected — pattern ${pattern} matched in finding text.`,
      };
    }
  }
  return { pass: true };
}
```

**Step 6 — Run test.** `pnpm -F @neural/agent-core test:unit -- gr007.test.ts` → PASS.

**Step 7 — Run full suite.** `pnpm test` → green. `pnpm typecheck` → clean. `pnpm lint` → clean.

**Step 8 — Commit.**
```
git add packages/agent-core/src/analysis/grounding/rules/GR007.ts \
        packages/agent-core/tests/unit/analysis/grounding/gr007.test.ts
git commit -m "feat(grounding): M7.16 add GR-007 no-conversion-predictions rule (REQ-GROUND-007)"
```

---

---

## 14. Mini-spec pattern (for simple tasks)

For small, bounded work that doesn't warrant a full PRD section or Spec Kit task, use a mini-spec inline. Template + enforcement live in PRD §18 (Appendix A). Two quick examples here:

### 14.1 Inline as TODO comment

```typescript
// MINI-SPEC:
// TASK: Parse --budget CLI flag, default 15, min 1, max 50.
// CONTEXT: F-001 AuditRequest.budget_usd needs CLI entry path.
// ACCEPTANCE:
//   - `--budget 20` → 20
//   - No flag → 15 (default)
//   - `--budget 0` or `--budget 100` → throw "must be 1-50"
//   - `--budget abc` → throw "must be a number"
// REFERENCES: F-001, §18.4 AuditRequest contract
function parseBudgetFlag(raw: string | undefined): number {
  if (raw === undefined) return 15;
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) throw new Error("--budget must be a number");
  if (n < 1 || n > 50) throw new Error("--budget must be between 1 and 50");
  return n;
}
```

### 14.2 Short GitHub issue

```
Title: Switch Pino log level default from "info" to "debug" in NEURAL_MODE=dev

TASK: Set default Pino level conditional on NEURAL_MODE.
CONTEXT: Developers reported info-level logs are too sparse for debugging
local integration test failures.
ACCEPTANCE:
  - NEURAL_MODE=dev → logger level defaults to "debug"
  - NEURAL_MODE unset or "prod" → level stays at "info"
  - Test: 2 unit tests covering both cases
REFERENCES: NF-007, Constitution R10.6. No spec needed — mini-spec authorizes.

Effort: ~20 minutes.
```

### 14.3 When to use mini-spec vs full PRD task

Mini-spec suffices when ALL true:
- Single file change (or tiny paired impl + test)
- < 50 lines of code
- No new adapter / no new external dep
- No architecture ripple
- No spec update needed
- < 2 hours work

Anything bigger → `superpowers:brainstorming` → design spec → writing-plans → tasks.md entry. See PRD §18.4.

---

## 15. Good vs bad persona-based findings

Building on §8 (generic good/bad findings), here are examples of findings evaluated from a **persona perspective** — one of the v2.2a enrichments (PersonaContext).

### 15.1 ✅ GOOD finding with persona anchor

```
Persona: "first-time-visitor"

Observation: The checkout form asks for "Account password" as a required
field before purchase. No label explains whether this is for an existing
account or creating a new one.

Assessment: A first-time visitor with no prior account will interpret this
as "I must create an account to check out" — violating Baymard's
guest-checkout guidance (BAY-CHECKOUT-GUEST-001). The field is required,
so the visitor cannot bypass it. For a user whose goal is "buy quickly
without commitment" (persona frustrations), this is a high-friction dead end.

Evidence:
  - element_ref: form#checkout-main input[name="account_password"]
  - data_point: forms[0].fields[7]
  - measurement: field.required === true AND no descriptive label

Recommendation: Make account creation optional post-purchase. Add a
"Continue as guest" path that does not require a password field. Rename
ambiguous field label to "Create account password (optional)" if account
creation remains available.
```

**Why good:** persona lens motivates the severity (first-time visitor with "buy quickly" goal) without inventing facts; cites the structural evidence; recommendation is concrete; no conversion prediction.

### 15.2 ❌ BAD finding — persona abused for speculation

```
Persona: "price-sensitive-shopper"

Observation: Product price is shown as $99.

Assessment: A price-sensitive shopper will hesitate at $99 and likely
abandon. They probably won't buy.

Recommendation: Reduce the price to $89.99 to appeal to this persona.
```

**Why bad:** persona used as a pretext for speculation (no evidence the price is too high); "likely abandon" is close to conversion prediction (borderline GR-007); recommendation is pricing advice, which is out of CRO scope; no benchmark or structural evidence.

### 15.3 Persona writing guidelines for CRO authors

When writing the default personas in `packages/agent-core/src/analysis/personas/defaults.ts`:

- **Goals** should be observable user intents ("find the right product", "compare prices", "trust the brand") — not purchase outcomes
- **Frustrations** should be friction points a heuristic can detect ("hidden costs", "too many form fields", "unclear returns policy") — not emotional speculation
- **Description** should be grounded — "Never visited this site before, comparing 3 alternatives" — not personas invented from thin air
- **business_type_applicability** should be a concrete list — `["ecommerce"]` not `["any"]`

---

*End of examples.md. Last updated 2026-04-22 for PRD v1.1.*
