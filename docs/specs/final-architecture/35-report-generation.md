# Section 35 — Report Generation & Export

**Status:** Master architecture extension (v2.2). Phase 9 implementation. The deliverable chain: raw findings → executive summary → action plan → branded PDF report.

**Cross-references:**
- §7 (Analyze Mode) — grounded findings are input to report
- §14 (Delivery Layer) — PDF delivery mechanism
- §23 (Findings Engine Extended) — 4D scoring feeds action plan bucketing
- §24 (Two-Store Pattern) — reports only include published findings
- §34 (Observability) — report generation events tracked

---

## 35.1 Principle

> **A diagnostic tool produces a list of issues. A consulting deliverable produces a decision-ready document: this is where you are, this is what's broken, this is what to fix first, this is how much effort it will take. The executive summary is what decision-makers read; the action plan is what development teams implement; the PDF is what gets forwarded in email.**

Raw finding lists do not justify consulting fees. Structured deliverables do.

---

## 35.2 Executive Summary

**REQ-REPORT-001:** The `audit_complete` node produces an `ExecutiveSummary` as typed output:

```typescript
interface ExecutiveSummary {
  overall_score: number;                  // 0-100
  overall_grade: "A" | "B" | "C" | "D" | "F";

  critical_issues_count: number;
  high_issues_count: number;
  medium_issues_count: number;
  low_issues_count: number;

  top_findings: GroundedFinding[];        // top 5 by priority score

  category_breakdown: Array<{
    category: string;                     // "Forms", "CTAs", "Trust", "Navigation", etc.
    finding_count: number;
    avg_severity: number;                 // 1-4 scale
  }>;

  strengths: Array<{                      // things the site does RIGHT
    heuristic_id: string;
    description: string;                  // "Strong trust signal presence across all pages"
    pages_passing: number;
  }>;

  patterns: PatternFinding[];             // from cross-page analysis

  recommended_next_steps: string[];       // 3-5 sentences, LLM-generated, temp=0

  audit_metadata: {
    pages_analyzed: number;
    pages_skipped: number;
    total_findings: number;
    total_cost_usd: number;
    duration_seconds: number;
    heuristic_sources: string[];          // ["Baymard", "Nielsen", "Cialdini"]
  };
}
```

**REQ-REPORT-002:** Overall score formula (deterministic, no LLM):

```
score = 100 - (critical × 15 + high × 8 + medium × 3 + low × 1)
score = clamp(score, 0, 100)
```

Grade thresholds: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, F < 40.

**REQ-REPORT-003:** Strengths detection (deterministic): any heuristic passing on ≥ 80% of applicable pages is added to strengths. No LLM call. Pure code.

**REQ-REPORT-004:** `recommended_next_steps` is one LLM call. Input: top 5 findings + pattern findings. Output: 3-5 sentences. Temperature = 0. Budget cap: $0.10. Grounding: GR-007 applies (no conversion predictions).

**REQ-REPORT-005:** `top_findings` sort by priority score (from §23.4 scoring pipeline), descending. Ties broken by severity, then confidence_tier.

---

## 35.3 Action Plan

**REQ-REPORT-010:** `audit_complete` produces an `ActionPlan` grouping findings into four implementation quadrants:

```typescript
interface ActionPlan {
  quick_wins: ActionPlanPhase;          // high impact + low effort — fix this sprint
  strategic: ActionPlanPhase;           // high impact + high effort — plan for next quarter
  incremental: ActionPlanPhase;         // low impact + low effort — batch when convenient
  deprioritized: ActionPlanPhase;       // low impact + high effort — consider later
}

interface ActionPlanPhase {
  label: string;                        // "Quick Wins" | "Strategic Investments" | etc.
  description: string;                  // "These fixes deliver the most value with minimal effort"
  findings: GroundedFinding[];
  estimated_total_effort_hours: number; // sum of heuristic effort_hours
  page_count: number;                   // unique pages affected
}
```

**REQ-REPORT-011:** Bucketing logic (deterministic, no LLM):

| | Low Effort (≤ 8 hours) | High Effort (> 8 hours) |
|---|---|---|
| **High Impact** (`business_impact ≥ 6`) | Quick Wins | Strategic |
| **Low Impact** (`business_impact < 6`) | Incremental | Deprioritized |

`estimated_total_effort_hours` comes from the heuristic's `effort_category` mapped through `EFFORT_MAP` (§23.4). Pattern findings aggregate effort across affected pages.

**REQ-REPORT-012:** Within each quadrant, findings sort by priority descending.

---

## 35.4 PDF Report Generator

**REQ-REPORT-020:** The `ReportGenerator` service in `packages/agent-core/src/delivery/ReportGenerator.ts` produces a branded PDF from an ExecutiveSummary + ActionPlan + grounded findings.

**REQ-REPORT-021:** Approach — Next.js HTML template → Playwright PDF:

1. Next.js route at `/api/report/[audit_run_id]/render` renders a report-ready HTML page
2. A headless Playwright browser navigates to that route with auth
3. `page.pdf({ format: 'A4', printBackground: true })` converts to PDF
4. PDF uploaded to Cloudflare R2 at `/{client_id}/reports/{audit_run_id}/report.pdf`

No new dependencies — reuses Playwright (already in stack) and Next.js (already in stack).

**REQ-REPORT-022:** Report structure (8 sections, in order):

| # | Section | Content |
|---|---|---|
| 1 | **Cover Page** | Client logo, audit date, site URL, overall grade badge (A-F), Neural branding |
| 2 | **Executive Summary** | Overall score, top 5 findings, strengths, category breakdown chart, recommended next steps |
| 3 | **Action Plan** | 4 quadrants with finding counts, effort estimates, and selected findings |
| 4 | **Findings by Category** | Grouped by category. Each finding: observation, assessment, severity badge, benchmark comparison, annotated screenshot crop, recommendation |
| 5 | **Cross-Page Patterns** | Pattern findings with affected page list and representative evidence |
| 6 | **Funnel Analysis** | If funnel findings exist: journey-level issues, page flow visualization |
| 7 | **Methodology Note** | Brief: "Evaluated against [N] research-backed heuristics. 3-layer validation. Findings are evidence-backed hypotheses for expert review." |
| 8 | **Appendix** | Full finding list table, perception quality summary, pages skipped list |

**REQ-REPORT-023:** Branding — `ReportTemplate` config per client:

```typescript
interface ReportTemplate {
  client_id: string;
  logo_url: string;                     // R2 URL or data URI
  primary_color: string;                // hex
  secondary_color: string;
  company_name: string;
  footer_text: string | null;
}
```

Fallback: REO Digital / Neural branding when client template is missing.

**REQ-REPORT-024:** Size and quality budgets:
- Target < 5MB per PDF
- Screenshots compressed to JPEG 70%
- Max 50 annotated screenshot crops per report (one per finding, prioritized by severity)
- Font embedding: subset Inter (primary) + JetBrains Mono (code/data)

**REQ-REPORT-025:** Delivery:
- Downloadable from consultant dashboard and client dashboard
- Link stored in `audit_runs.report_pdf_url`
- Optionally emailed via NotificationAdapter on `audit_completed` event

---

## 35.5 Partial Reports

**REQ-REPORT-030:** If an audit completes with `analysis_status` other than `complete` for any page, the report includes a "Pages Not Fully Analyzed" section in the appendix with:
- Page URL
- analysis_status value
- Reason (from `audit_events` metadata)
- Recommended manual action

This prevents silent data loss in the deliverable.

---

## 35.6 Build Order (Phase 9)

Build after: consultant dashboard (for review gate), client dashboard (for download). Build before: ops dashboard (which is admin-only and lowest priority).

Tasks: T245-T246 (executive summary), T247 (action plan), T248-T249 (PDF generator).

---

**End of §35 — Report Generation & Export**
