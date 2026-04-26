---
title: 29-hypothesis-pipeline
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

# Section 29 — Hypothesis & Test Pipeline (Deferred Contract)

**Status:** Contract reserved. Implementation Phase 14. Tables already created in §13.6.8.

**Cross-references:**
- §13.6.8 (`hypotheses`, `test_plans`, `variations` tables) — storage
- §14.1 (MCP) — `cro_list_hypotheses`, `cro_get_test_plan` tools (Phase 14+)
- §23 (Findings Engine) — findings are the INPUT to this pipeline

---

## 29.1 Principle

> **Findings tell you what's wrong. Hypotheses tell you what to test. Test plans tell you how to test. Variations tell you what to build. This pipeline transforms grounded CRO findings into actionable experimentation artifacts — always gated by consultant approval, never auto-published.**

---

## 29.2 Pipeline

```
GROUNDED FINDINGS (from §23)
    │
    ▼
HYPOTHESIS GENERATOR (LLM, heavily constrained)
    │ "If we [change X], then [metric Y] should [direction]
    │  because [finding Z] shows [evidence]"
    │
    ▼
CONSULTANT REVIEW (mandatory — hypotheses are never auto-approved)
    │
    ▼
TEST PLAN GENERATOR (LLM + deterministic structure)
    │ primary metric, secondary metrics, sample size,
    │ duration, platform (VWO/Optimizely/GA4 Experiments)
    │
    ▼
CONSULTANT REVIEW (mandatory)
    │
    ▼
VARIATION IDEA GENERATOR (LLM, constrained to finding scope)
    │ control description, challenger description,
    │ specific changes, optional mockup prompt
    │
    ▼
CONSULTANT REVIEW (mandatory)
    │
    ▼
EXPORT (to A/B testing platform — Phase 14+)
```

---

## 29.3 Hypothesis Schema

**REQ-HYPO-001:** Every hypothesis traces back to one or more grounded findings:

```typescript
interface Hypothesis {
  id: string;                           // UUID
  audit_run_id: string;
  client_id: string;
  source_finding_ids: string[];          // non-empty; findings that motivate this hypothesis

  // Hypothesis statement (structured)
  title: string;                         // e.g., "Move CTA above fold on product pages"
  statement: string;                     // "If we [X], then [Y] because [Z]"
  independent_variable: string;          // what we're changing
  dependent_variable: string;            // what we're measuring
  expected_direction: "increase" | "decrease" | "no_change";
  rationale: string;                     // grounded in finding evidence

  // Confidence (deterministic, from finding quality)
  confidence: "high" | "medium" | "low";
  confidence_basis: string;

  // Lifecycle
  status: "draft" | "approved" | "rejected" | "in_test" | "completed";
  created_by: "llm" | "consultant";
  approved_by?: string;                  // consultant user id
  approved_at?: string;

  created_at: string;
}
```

**REQ-HYPO-002:** (S1-L3-FIX) Hypothesis confidence uses **majority rule**: the tier representing >50% of source findings wins. If no majority, default to "medium." This prevents one weak finding from dragging down an otherwise well-supported hypothesis. Example: 5 high + 1 low → hypothesis is "high" (83% high).

**REQ-HYPO-003:** The hypothesis generator NEVER predicts specific metric values ("increase conversions by 15%"). It states directional expectations only ("CTA visibility should improve click-through"). This extends GR-007 into the hypothesis layer.

---

## 29.4 Test Plan Schema

**REQ-HYPO-010:**

```typescript
interface TestPlan {
  id: string;                           // UUID
  hypothesis_id: string;
  client_id: string;

  name: string;
  description: string;
  primary_metric: string;               // e.g., "CTA click-through rate"
  secondary_metrics: string[];           // e.g., ["bounce rate", "time on page"]

  // Statistical parameters (deterministic defaults, consultant-adjustable)
  minimum_detectable_effect: number;     // e.g., 0.05 (5% relative lift)
  statistical_significance: number;      // e.g., 0.95
  sample_size_target?: number;           // computed from MDE + significance + baseline
  duration_days?: number;                // estimated from traffic

  // Platform
  platform?: string;                     // vwo | optimizely | google_optimize | custom
  platform_config?: Record<string, any>; // platform-specific settings

  // Lifecycle
  status: "draft" | "approved" | "rejected" | "active" | "completed" | "inconclusive";
  created_at: string;
}
```

**REQ-HYPO-011:** Sample size calculation uses a deterministic formula (not LLM):
```
sample_per_variant = (Z_alpha + Z_beta)^2 * 2 * p * (1-p) / MDE^2
```
Where `p` = estimated baseline conversion rate (from analytics if available, default 0.03), MDE = minimum detectable effect, Z_alpha and Z_beta from significance level.

---

## 29.5 Variation Schema

**REQ-HYPO-020:**

```typescript
interface Variation {
  id: string;                           // UUID
  test_plan_id: string;
  client_id: string;

  variant_name: string;                  // "control" | "challenger_1" | "challenger_2" | ...
  description: string;                   // what this variant changes
  changes: Array<{
    element: string;                     // what element is changed
    change_type: "copy" | "style" | "layout" | "visibility" | "position";
    before: string;                      // current state
    after: string;                       // proposed state
  }>;

  mockup_asset_key?: string;             // R2 key if a mockup was generated
  code_snippet?: string;                 // platform-specific variant code (VWO JS, etc.)
  // M2-L3-FIX: code snippets are DRAFT only. Always consultant-reviewed.
  // Never auto-deployed to production sites. LLM-generated JS on live pages is a security risk.

  created_at: string;
}
```

**REQ-HYPO-021:** Variation changes MUST trace back to the hypothesis's independent variable. A variation that changes something unrelated to the hypothesis is invalid.

---

## 29.6 Constraints

**REQ-HYPO-030:** The entire pipeline is **consultant-gated at every stage**. No hypothesis, test plan, or variation is ever auto-published or auto-activated. The LLM generates drafts; the consultant decides.

**REQ-HYPO-031:** The hypothesis generator operates on **published findings only** (from the published store, §24). It never sees rejected or held findings.

**REQ-HYPO-032:** Maximum hypotheses per audit: 10 (configurable). The generator prioritizes by finding priority score (§23.4).

**REQ-HYPO-032a:** (M8-L3-FIX) Hypothesis generation runs AFTER the consultant review cycle is complete for the audit — i.e., after all findings have been approved/rejected/edited. This ensures hypotheses are based on consultant-validated findings only, not raw AI output awaiting review. Trigger: consultant clicks "Generate Hypotheses" in the dashboard, or auto-triggered 48h after all findings are reviewed (configurable).

**REQ-HYPO-033:** A/B testing platform export (Phase 14+) is read-only from the platform's perspective — the system pushes experiment definitions but does NOT read back results automatically. Result ingestion is Phase 15+ (via analytics bindings).

---

## 29.7 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **14** | Hypothesis generator (LLM + constraints), test plan generator (LLM + deterministic stats), variation idea generator, consultant review UI |
| **14** | VWO/Optimizely export adapters (code snippet generation) |
| **15** | Analytics-informed baseline metrics (analytics_signals → sample size calculation) |
| **15** | A/B test result ingestion → feeds back to Learning Service (§28) |
| **16** | Mockup generation integration (DesignRecommender interface from §17.6) |

---

**End of §29 — Hypothesis & Test Pipeline**
