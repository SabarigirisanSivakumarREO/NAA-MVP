# Section 10 — Competitor Analysis, Version Tracking & Cross-Page Consistency

> **G1-FIX (Master Architecture):** Competitor analysis is a **separate audit mode**, NOT inline within the client audit run. This aligns with the source-of-truth Analysis v1.0 REQ-COMPARISON-001: *"runs AFTER both client and competitor sites have been analyzed. It is a separate step, NOT part of the per-page analysis pipeline."* The integrated architecture (§4 orchestrator) previously muddled this by placing competitor comparison inside `audit_complete`. This fix restores the source spec's intent.
>
> **How it works post-fix:**
> 1. Client audit runs as normal (browse → analyze → findings per page)
> 2. Competitor audit runs as a SEPARATE `AuditWorkflow` (§27) with `trigger_source = "competitor_mode"`
> 3. After BOTH complete, a COMPARISON job runs offline, producing `comparison_findings`
> 4. Competitor comparison is triggered by `AuditRequest.competitor.enabled = true` (§18.4)
> 5. Competitor has its own budget, own audit_run_id, own findings (not mixed with client's)
>
> **Cross-references:** §18.4 (`AuditRequest.competitor`), §21.8 (workflow comparison as future extension), §27 (Temporal — competitor as separate workflow)
>
> **M6-L3-FIX:** This note establishes architectural intent. The §4 orchestrator code still references competitor comparison in `audit_complete` — that code change is deferred to Phase 10 implementation, when the orchestrator is refactored to delegate competitor to a separate Temporal workflow.

## 10.1 Competitor Analysis — Pairwise Comparison

### Why Pairwise (Research-Backed)

**REQ-COMP-001:** Competitor comparison SHALL use pairwise comparison, NOT absolute scoring.

WiserUI-Bench (2025) and MLLM UI Judge (2025) both demonstrate that LLMs are significantly better at "which of these two is better on dimension X?" than "rate this on a scale of 1-10."

```
❌ ABSOLUTE (unreliable):
   "Client homepage score: 72/100, Competitor homepage score: 85/100"

✅ PAIRWISE (reliable):
   "Comparing CTA placement:
    Client: CTA at y:1400, blue text link, 14px
    Competitor: CTA at y:300, orange button, 18px, high contrast
    Assessment: Competitor's CTA is above fold with stronger visual weight.
    Recommendation: Move client's CTA above fold with button styling."
```

### Competitor Detection

**REQ-COMP-002:** Competitor detection SHALL be LLM-based for MVP. Manual override available.

```typescript
interface CompetitorDetector {
  detect(params: {
    clientUrl: string;
    pageContent: string;
    metadata: PageMetadata;
  }): Promise<{
    detectedSector: string;
    detectedIndustry: string;
    suggestedCompetitors: Array<{
      domain: string;
      name: string;
      confidence: number;
      reason: string;
    }>;
  }>;
}
```

### Comparison Flow

**REQ-COMP-003:**

```
1. Audit client site (browse + analyze all pages) → client findings
2. Audit competitor site(s) (same pipeline) → competitor findings
3. For each matching page type (homepage vs homepage, product vs product):
   → Run pairwise comparison on specific dimensions
4. Store comparison findings alongside regular findings
```

### Comparison Dimensions

| Dimension | What to Compare | Data Source |
|-----------|----------------|------------|
| CTA placement & visibility | Position, size, contrast, above/below fold | `ctas[]` |
| Trust signal usage | Types present, placement, above/below fold | `trustSignals[]` |
| Form design | Field count, required fields, labels, validation | `forms[]` |
| Value proposition | Headline clarity, benefit-driven, above fold | `textContent`, `layout` |
| Navigation structure | Item count, hierarchy, search availability | `navigation` |
| Social proof | Reviews, testimonials, user counts | `trustSignals[]` |

### Comparison Prompt Template

**REQ-COMP-004:**

```
SYSTEM:
You are comparing two websites on specific CRO dimensions.
Compare ONLY on the dimensions listed. Do NOT assign overall scores.
Do NOT predict which site converts better.

USER:
CLIENT PAGE ({{client_page_type}}):
{{client_analyze_perception | selected_fields}}

COMPETITOR PAGE ({{competitor_page_type}}):
{{competitor_analyze_perception | selected_fields}}

Compare on these dimensions:
{{comparison_dimensions}}

For each dimension, respond with JSON:
{
  "dimension": "CTA placement",
  "client_observation": "specific data-backed observation",
  "competitor_observation": "specific data-backed observation",
  "assessment": "which does it better and why (cite specific data)",
  "recommendation": "specific actionable suggestion for the client",
  "evidence": {
    "client_data_point": "e.g., ctas[0].isAboveFold = false",
    "competitor_data_point": "e.g., ctas[0].isAboveFold = true"
  }
}
```

### Comparison Evidence Grounding

**REQ-COMP-005:** Comparison findings go through the same evidence grounding rules (GR-001 through GR-008), validated against BOTH page datasets.

### ComparisonFinding Schema

```typescript
interface ComparisonFinding {
  id: string;
  audit_run_id: string;
  client_id: string;
  dimension: string;
  client_page_url: string;
  client_page_type: string;
  competitor_domain: string;
  competitor_page_url: string;
  competitor_page_type: string;
  client_observation: string;
  competitor_observation: string;
  assessment: string;
  recommendation: string;
  evidence: {
    client_data_point: string;
    competitor_data_point: string;
  };
  created_at: string;
}
```

---

## 10.2 Version Diff Engine — Before/After Tracking

### How Re-Audits Work

**REQ-VERSION-001:**

```
Audit v1 (January): 45 findings on example.com
    ↓ Client implements fixes
Audit v2 (February): Run same audit, same heuristics
    ↓ Version Diff Engine compares
Report:
  - 12 findings RESOLVED (in v1, not in v2)
  - 28 findings PERSISTED (in both)
  - 5 findings NEW (in v2, not in v1)
  - Net: 12 resolved - 5 new = 7 net fixes
```

### Diff Algorithm

**REQ-VERSION-002:**

```typescript
interface VersionDiffEngine {
  compare(params: {
    previousRun: AuditRun;
    currentRun: AuditRun;
  }): Promise<VersionDiff>;
}

interface VersionDiff {
  resolved: Finding[];
  persisted: Finding[];
  new_findings: Finding[];
  summary: {
    total_v1: number;
    total_v2: number;
    resolved_count: number;
    persisted_count: number;
    new_count: number;
    net_change: number;          // negative = improvement
    improvement_percentage: number;
  };
}
```

### Finding Matching Logic

**REQ-VERSION-003:** Two findings from different audit versions are considered "the same" if:

1. Same `heuristic_id` AND
2. Same `page_url` (or same `page_type` if URL changed) AND
3. Similar evidence (element still exists or semantically similar element exists)

```typescript
function findingsMatch(v1: Finding, v2: Finding): boolean {
  if (v1.heuristic_id !== v2.heuristic_id) return false;

  // Exact URL match
  if (v1.page_url === v2.page_url) return true;

  // Same page type (URL might have changed)
  if (v1.page_type === v2.page_type) {
    // Check if evidence references similar elements
    const v1Ref = v1.evidence?.element_ref?.toLowerCase() || "";
    const v2Ref = v2.evidence?.element_ref?.toLowerCase() || "";
    if (v1Ref && v2Ref && (v1Ref.includes(v2Ref) || v2Ref.includes(v1Ref))) {
      return true;
    }
  }

  return false;
}
```

---

## 10.3 Cross-Page Consistency Analysis

### What Gets Compared

**REQ-CONSISTENCY-001:** After ALL pages of a site are individually analyzed, run cross-page consistency checks.

| Dimension | What to Check | Example Violation |
|-----------|--------------|-------------------|
| CTA styling | Same primary CTA style across pages | Homepage: orange button. Checkout: blue text link. |
| Navigation | Same nav structure on all pages | Product page missing nav items present on homepage. |
| Color scheme | Consistent brand colors | Different background colors on different pages. |
| Typography | Consistent heading fonts | H1 is serif on homepage, sans-serif on product page. |
| Trust signals | Consistent placement | Reviews on product page but absent from checkout. |
| Footer | Same footer across pages | Different footer links on different pages. |

### Consistency Check Prompt

**REQ-CONSISTENCY-002:**

```
SYSTEM:
You are checking design consistency across multiple pages of the same website.
Only flag genuine inconsistencies that could confuse users. Intentional
page-specific differences (e.g., different hero images) are NOT inconsistencies.

USER:
{{page_count}} pages analyzed. Summary of each:

{{for each page}}
Page: {{url}} ({{page_type}})
  CTAs: {{ctas_summary}}
  Navigation: {{nav_item_count}} items
  Trust signals: {{trust_types}}
  Colors: {{primary_colors}}
  Typography: {{heading_fonts}}
{{end}}

Identify INCONSISTENCIES that could harm user experience or brand trust.
For each, cite the specific pages and elements that differ.
```

### ConsistencyFinding Schema

```typescript
interface ConsistencyFinding {
  id: string;
  audit_run_id: string;
  client_id: string;
  dimension: string;
  description: string;
  affected_pages: Array<{
    url: string;
    observation: string;
  }>;
  recommendation: string;
  severity: "high" | "medium" | "low";
  created_at: string;
}
```
