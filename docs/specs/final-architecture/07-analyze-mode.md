# Section 7 — Analyze Mode (Analysis Pipeline)

> **Source of truth:** `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md`
> This section is the COMPLETE specification for analyze mode.

---

## 7.1 Overview

Analyze mode is a 5-step pipeline that evaluates a single page against filtered CRO heuristics. It runs once per page after browse mode has navigated to and stabilized the page.

**Core principle:** Findings are HYPOTHESES, not VERDICTS. Every finding must survive 3 layers (CoT generation, self-critique review, code-level evidence grounding) before reaching a client.

---

## 7.2 5-Step Pipeline

```
STEP 1:           STEP 2:            STEP 3:             STEP 4:            STEP 5:
PERCEIVE          EVALUATE           SELF-CRITIQUE       GROUND             ANNOTATE

Full page scan    LLM evaluates      LLM reviews its     Code-level         Overlay finding
+ viewport &      against filtered   own findings:       validation of      pins on screenshots
fullpage          heuristics using   "Did I reference    every claim.       Store to DB
screenshots       chain-of-thought   real elements?      Reject hallucs.
                  prompting          Severity right?"

page_analyze() →  LLM + CoT →        LLM self-review →   evidence_check →   annotate() →
AnalyzePerception RawFindings[]      ReviewedFindings[]  GroundedFindings[] AnnotatedScreenshots

~200ms            ~3-5s (LLM)        ~2-3s (LLM)         ~100ms (code)      ~500ms
```

### Three-Layer Hallucination Filter

| Layer | Type | What it catches | Catch rate |
|-------|------|----------------|-----------|
| CoT (Step 2) | LLM reasoning constraint | Unfounded claims during generation | ~50% |
| Self-Critique (Step 3) | LLM self-review | Logical inconsistencies, severity errors | ~30% of remaining |
| Evidence Ground (Step 4) | Deterministic code | Hallucinated elements, wrong measurements | ~95% of remaining |

---

## 7.3 Pipeline Graph

**REQ-ANALYZE-GRAPH-001:**

```
┌────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
│  START  │───→│  deep_   │───→│ evaluate │───→│  self_   │───→│  ground  │───→│ annotate│
│         │    │ perceive │    │  (CoT)   │    │ critique │    │          │    │ + store │
└─────────┘    └──────────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬────┘
                                    │                │              │              │
                            (retry if malformed)     │              │              │
                                    │                │              │              ▼
                                    └────────────────┴──────────────┴──────────► END
```

### Routing Functions

**REQ-ANALYZE-EDGE-001:** `routeAfterEvaluate`:

```typescript
function routeAfterEvaluate(state: AuditState): "self_critique" | "retry_evaluate" | "end" {
  if (!state.raw_findings || !Array.isArray(state.raw_findings)) {
    if (state.evaluate_retry_count < 2) return "retry_evaluate";
    return "end";
  }
  if (state.raw_findings.length === 0) return "end";
  return "self_critique";
}
```

**REQ-ANALYZE-EDGE-002:** `routeAfterCritique`:

```typescript
function routeAfterCritique(state: AuditState): "ground" | "end" {
  if (!state.reviewed_findings || state.reviewed_findings.length === 0) return "end";
  return "ground";
}
```

**REQ-ANALYZE-EDGE-003:** `routeAfterGround`:

```typescript
function routeAfterGround(state: AuditState): "annotate" | "end" {
  if (!state.grounded_findings || state.grounded_findings.length === 0) return "end";
  return "annotate";
}
```

---

## 7.4 Node: `deep_perceive`

**REQ-ANALYZE-NODE-001:**

| | |
|---|---|
| **Input** | `current_url`, browser page context (from browse subgraph) |
| **Output** | `analyze_perception`, `viewport_screenshot`, `fullpage_screenshot`, `current_page_type` (auto-detected) |
| **Precondition** | Browse subgraph exited successfully. Page stable (`pending_mutations === 0`). |
| **Postcondition** | `analyze_perception` has all sections populated. Both screenshots non-null. |
| **Tools used** | `page_analyze`, `browser_screenshot`, `page_screenshot_full` |

```typescript
async function deepPerceive(state: AuditState, page: Page): Promise<Partial<AuditState>> {
  const perception = await tools.page_analyze({
    sections: ["structure", "content", "ctas", "forms", "trust", "layout", "images", "navigation", "performance"]
  });

  const detectedType = detectPageType(perception);

  const viewport = await tools.browser_screenshot({ quality: 85 });
  const fullpage = await tools.page_screenshot_full({ quality: 80, maxHeight: 15000 });

  return {
    analyze_perception: perception,
    viewport_screenshot: viewport.imageBase64,
    fullpage_screenshot: fullpage.imageBase64,
    current_page_type: detectedType,
    steps_completed: ["deep_perceive"],
  };
}
```

### 7.4a Per-State Screenshot Capture (Phase 10+ Extension)

**REQ-ANALYZE-NODE-001a:** When `state_graph` is non-null (Phase 10+, §20 active), `deep_perceive` SHALL be extended to capture screenshots for EACH meaningful state in the StateGraph. This provides per-state visual evidence for §31/§33 state-aware analysis and consultant review.

```typescript
async function deepPerceiveExtended(
  state: AuditState,
  page: Page,
  browserSession: BrowserSession,
): Promise<Partial<AuditState>> {

  // 1. Default state perception + screenshots (same as base deep_perceive)
  const defaultPerception = await tools.page_analyze({ sections: ALL_SECTIONS });
  const detectedType = detectPageType(defaultPerception);
  const defaultViewport = await tools.browser_screenshot({ quality: 85 });
  const defaultFullpage = await tools.page_screenshot_full({ quality: 80, maxHeight: 15000 });

  // 2. If no state graph, return base perception (Phase 1-9 behavior)
  if (!state.state_graph || state.state_graph.states.length <= 1) {
    return {
      analyze_perception: defaultPerception,
      viewport_screenshot: defaultViewport.imageBase64,
      fullpage_screenshot: defaultFullpage.imageBase64,
      current_page_type: detectedType,
      steps_completed: ["deep_perceive"],
    };
  }

  // 3. Per-state screenshot capture (Phase 10+)
  const stateGraph = state.state_graph;

  for (const stateNode of stateGraph.states) {
    if (stateNode.is_default_state) {
      // Default state already captured above
      stateNode.viewport_screenshot_ref = await screenshotStorage.save(
        defaultViewport.imageBase64,
        `${state.audit_run_id}/${urlHash(state.current_url)}/state_${stateNode.state_id}_viewport.jpg`
      );
      stateNode.fullpage_screenshot_ref = await screenshotStorage.save(
        defaultFullpage.imageBase64,
        `${state.audit_run_id}/${urlHash(state.current_url)}/state_${stateNode.state_id}_fullpage.jpg`
      );
      continue;
    }

    // Replay interaction path to reach this state
    for (const interaction of stateNode.interaction_path) {
      await executeInteraction(browserSession, interaction);
      await waitForStability(browserSession);
    }

    // Capture state-specific screenshots
    const stateViewport = await tools.browser_screenshot({ quality: 85 });
    const stateFullpage = await tools.page_screenshot_full({ quality: 80, maxHeight: 15000 });

    stateNode.viewport_screenshot_ref = await screenshotStorage.save(
      stateViewport.imageBase64,
      `${state.audit_run_id}/${urlHash(state.current_url)}/state_${stateNode.state_id}_viewport.jpg`
    );
    stateNode.fullpage_screenshot_ref = await screenshotStorage.save(
      stateFullpage.imageBase64,
      `${state.audit_run_id}/${urlHash(state.current_url)}/state_${stateNode.state_id}_fullpage.jpg`
    );

    // Restore to default state before next state's interaction path
    await restoreToDefault(browserSession, stateNode.interaction_path);
  }

  // 4. Synthesize MultiStatePerception (§20.6)
  const multiState = synthesiseMultiState(stateGraph, defaultPerception);

  return {
    analyze_perception: defaultPerception,
    multi_state_perception: multiState,
    viewport_screenshot: defaultViewport.imageBase64,
    fullpage_screenshot: defaultFullpage.imageBase64,
    current_page_type: detectedType,
    state_graph: stateGraph,  // now with screenshot refs populated
    steps_completed: ["deep_perceive"],
  };
}
```

**REQ-ANALYZE-NODE-001b:** Per-state screenshot capture follows the same interaction replay order as §20 exploration: non-destructive states first, destructive last. Each state is reached from the default state (not from the previous non-default state) to ensure clean screenshots.

**REQ-ANALYZE-NODE-001c:** Per-state screenshot budget cap: max 15 states × 2 screenshots = 30 screenshots per page. At ~100KB each, this is ~3MB per page — well within R2 storage budget.

**REQ-ANALYZE-NODE-001d:** If a state's interaction path replay fails (element not found, page changed since exploration), the state's screenshot refs remain null. The state is still usable for analysis (its perception was captured during §20), but the consultant won't see a visual for that state. This is logged as `screenshot_capture_failed` but is NOT a fatal error.

### Page Type Detection

```typescript
function detectPageType(perception: AnalyzePerception): PageType {
  const url = perception.metadata.url.toLowerCase();
  const text = perception.textContent.paragraphs.map(p => p.text).join(" ").toLowerCase();
  const hasCart = perception.ctas.some(c => c.text.toLowerCase().includes("add to cart"));
  const hasCheckout = url.includes("checkout") || url.includes("cart") || text.includes("order summary");
  const hasPricing = url.includes("pricing") || url.includes("plans") || text.includes("per month");
  const hasSignup = perception.forms.some(f => f.submitButtonText.toLowerCase().includes("sign up"));
  const isHomepage = url.endsWith("/") || /\.(com|in|io|co)$/.test(url);

  if (hasCheckout) return "checkout";
  if (hasCart) return "product";
  if (hasPricing) return "pricing";
  if (hasSignup) return "form";
  if (isHomepage && perception.navigation.primaryNavItems.length > 3) return "homepage";
  if (perception.forms.length > 0 && perception.forms[0].fieldCount > 3) return "form";
  return "other";
}
```

---

## 7.5 Node: `evaluate`

**REQ-ANALYZE-NODE-002:**

| | |
|---|---|
| **Input** | `analyze_perception`, `filtered_heuristics`, `current_page_type`, `business_type` |
| **Output** | `raw_findings[]`, `evaluate_token_count` |
| **Precondition** | `analyze_perception` non-null. `filtered_heuristics.length > 0`. |
| **Postcondition** | Every `raw_finding` has all required fields. |
| **Invariant** | `raw_findings` only reference `heuristic_id` from `filtered_heuristics`. No conversion predictions. |

### System Prompt (Static, Cached)

```
You are a CRO analyst. Your role is to evaluate web pages against
usability heuristics and identify friction points.

METHODOLOGY:
For each heuristic, follow this exact chain of thought:
1. OBSERVE: What specific elements on the page relate to this heuristic?
2. ASSESS: Does the page comply or violate? Why?
3. EVIDENCE: Point to the exact element, measurement, or data point.
4. SEVERITY: Assign based on evidence strength, NOT gut feeling.

RULES:
- Only report violations you can point to specific page data for.
- If a heuristic is satisfied, respond with status: "pass".
- If you are uncertain, respond with status: "needs_review".
- NEVER predict conversion rates, revenue impact, or percentage improvements.
- NEVER reference elements that are not in the provided page data.
- NEVER make up measurements or positions — use only provided bounding boxes.
```

### User Message Template

```
PAGE DATA:
URL: {{current_url}}
Page type: {{current_page_type}}
Business type: {{business_type}}

STRUCTURE:
Headings: {{analyze_perception.headingHierarchy | json}}
Landmarks: {{analyze_perception.landmarks | json}}
Semantic HTML: {{analyze_perception.semanticHTML | json}}

CALLS TO ACTION:
{{analyze_perception.ctas | json}}

FORMS:
{{analyze_perception.forms | json}}

TRUST SIGNALS:
{{analyze_perception.trustSignals | json}}

LAYOUT:
Viewport height: {{analyze_perception.layout.viewportHeight}}px
Fold position: {{analyze_perception.layout.foldPosition}}px
Content above fold: {{analyze_perception.layout.contentAboveFold | json}}

NAVIGATION:
{{analyze_perception.navigation | json}}

IMAGES:
{{analyze_perception.images | json}}

CONTENT:
Word count: {{analyze_perception.textContent.wordCount}}
Readability: {{analyze_perception.textContent.readabilityScore}}

PERFORMANCE:
DOM Content Loaded: {{analyze_perception.performance.domContentLoaded}}ms
Fully Loaded: {{analyze_perception.performance.fullyLoaded}}ms

---

EVALUATE AGAINST THESE HEURISTICS:
{{filtered_heuristics | json}}

---

For each heuristic, respond with JSON:
{
  "heuristic_id": "string",
  "status": "violation" | "pass" | "needs_review",
  "observation": "what I see on the page (quote specific data)",
  "assessment": "why this is/isn't a violation",
  "evidence": {
    "element_ref": "specific element text or identifier",
    "element_selector": "CSS selector if identifiable",
    "data_point": "which section above proves this (e.g., 'ctas[0]', 'forms[0].fieldCount')",
    "measurement": "exact number/position from the data"
  },
  "severity": "critical" | "high" | "medium" | "low",
  "confidence_basis": "what measurable evidence supports this severity",
  "recommendation": "specific, actionable fix",
  "needs_review": boolean
}

Return an array of results, one per heuristic.
```

### Output Schema (Zod)

```typescript
import { z } from "zod";

const RawFindingSchema = z.object({
  heuristic_id: z.string(),
  status: z.enum(["violation", "pass", "needs_review"]),
  observation: z.string().min(10),
  assessment: z.string().min(10),
  evidence: z.object({
    element_ref: z.string().nullable(),
    element_selector: z.string().nullable(),
    data_point: z.string(),
    measurement: z.string().nullable(),
  }),
  severity: z.enum(["critical", "high", "medium", "low"]).nullable(),
  confidence_basis: z.string().nullable(),
  recommendation: z.string().nullable(),
  needs_review: z.boolean().default(false),
});

const EvaluateOutputSchema = z.array(RawFindingSchema);
```

---

## 7.6 Node: `self_critique`

**REQ-ANALYZE-NODE-003:**

| | |
|---|---|
| **Input** | `raw_findings[]` (violations only — passes filtered out), `analyze_perception` |
| **Output** | `reviewed_findings[]`, `critique_summary`, `critique_token_count` |
| **Precondition** | `raw_findings` has ≥1 finding with `status === "violation"` or `"needs_review"` |
| **Postcondition** | Every `reviewed_finding` has a `critique_verdict`. Rejected findings removed. |

### System Prompt

```
You are a senior CRO quality reviewer. You will receive CRO findings
generated by an analyst. Your job is to CHALLENGE each finding with
rigorous scrutiny.

For each finding:

1. VERIFY ELEMENT: Does the finding reference data that exists in the
   provided page data? If page data contradicts the finding, REJECT.

2. CHECK SEVERITY: Is severity proportional to evidence?
   - "critical" requires MEASURABLE evidence (positions, field counts)
   - "high" requires clear element-level evidence
   - "medium" is appropriate for context-dependent issues
   - "low" is for subjective or minor observations
   If severity is inflated, DOWNGRADE.

3. CHECK LOGIC: Does conclusion follow from observation?
   Example BAD: "Form has 4 fields → too many fields"
   (4 fields is fine for most forms)
   If logic is flawed, REJECT or REVISE.

4. CHECK CONTEXT: Does finding account for page type and business?
   A 10-field form is fine for mortgage but bad for newsletter.
   If context ignored, REVISE.

5. CHECK DUPLICATES: Are any two findings about the same issue?
   If so, MERGE.

RESPOND with JSON for each finding:
{
  "finding_index": 0,
  "heuristic_id": "string",
  "verdict": "KEEP" | "REVISE" | "DOWNGRADE" | "REJECT",
  "reason": "why this verdict",
  "revised_finding": { ... } | null,
  "new_severity": "string" | null
}
```

### User Message

```
ORIGINAL PAGE DATA:
{{analyze_perception | json}}

FINDINGS TO REVIEW:
{{raw_findings.filter(f => f.status !== "pass") | json}}

Review each finding. Be harsh — it's better to reject a valid finding
than to let a hallucinated one through.
```

### Verdict Application

```typescript
function applyVerdicts(rawFindings: RawFinding[], verdicts: CritiqueVerdict[]): ReviewedFinding[] {
  const reviewed: ReviewedFinding[] = [];

  for (const verdict of verdicts) {
    const original = rawFindings[verdict.finding_index];
    if (!original) continue;

    switch (verdict.verdict) {
      case "KEEP":
        reviewed.push({
          ...original,
          critique_verdict: "KEEP",
          critique_reason: verdict.reason,
        });
        break;
      case "REVISE":
        reviewed.push({
          ...original,
          ...verdict.revised_finding,
          critique_verdict: "REVISE",
          critique_reason: verdict.reason,
          original_finding: original,
        });
        break;
      case "DOWNGRADE":
        reviewed.push({
          ...original,
          severity: verdict.new_severity || original.severity,
          critique_verdict: "DOWNGRADE",
          critique_reason: verdict.reason,
        });
        break;
      case "REJECT":
        // NOT added to reviewed — rejected
        logRejection(original, verdict.reason);
        break;
    }
  }

  return reviewed;
}
```

---

## 7.7 Node: `ground`

**REQ-ANALYZE-NODE-004:**

| | |
|---|---|
| **Input** | `reviewed_findings[]`, `analyze_perception` |
| **Output** | `grounded_findings[]`, `rejected_findings[]` |
| **Precondition** | `reviewed_findings.length > 0` |
| **Postcondition** | Every `grounded_finding` has `evidence_verified === true` |
| **Invariant** | No LLM calls. Purely deterministic code. |

### 8 Evidence Grounding Rules

**REQ-ANALYZE-GROUND-001:**

```typescript
interface GroundingRule {
  id: string;
  description: string;
  check: (finding: ReviewedFinding, pageData: AnalyzePerception) => GroundingResult;
}

type GroundingResult =
  | { pass: true }
  | { pass: false; reason: string };

const GROUNDING_RULES: GroundingRule[] = [

  // GR-001: Referenced element must exist
  {
    id: "GR-001",
    description: "Any element referenced in evidence must exist in page data",
    check: (finding, pageData) => {
      const ref = finding.evidence.element_ref;
      if (!ref) return { pass: true };

      const inCTAs = pageData.ctas.some(c => c.text.toLowerCase().includes(ref.toLowerCase()));
      const inForms = pageData.forms.some(f =>
        f.fields.some(field => field.label.toLowerCase().includes(ref.toLowerCase()))
        || f.submitButtonText.toLowerCase().includes(ref.toLowerCase())
      );
      const inTrust = pageData.trustSignals.some(t => t.text.toLowerCase().includes(ref.toLowerCase()));
      const inNav = pageData.navigation.primaryNavItems.some(n => n.text.toLowerCase().includes(ref.toLowerCase()));
      const inHeadings = pageData.headingHierarchy.some(h => h.text.toLowerCase().includes(ref.toLowerCase()));

      if (inCTAs || inForms || inTrust || inNav || inHeadings) return { pass: true };
      return { pass: false, reason: `Element "${ref}" not found in page data` };
    }
  },

  // GR-002: Above/below fold claims must match bounding box
  {
    id: "GR-002",
    description: "Above/below fold claims must match actual position data",
    check: (finding, pageData) => {
      const assessment = finding.assessment.toLowerCase();
      const isFoldClaim = assessment.includes("above fold") || assessment.includes("below fold");
      if (!isFoldClaim) return { pass: true };

      const ref = finding.evidence.element_ref;
      if (!ref) return { pass: true };

      const cta = pageData.ctas.find(c => c.text.toLowerCase().includes(ref.toLowerCase()));
      if (!cta) return { pass: true };

      const claimsBelow = assessment.includes("below fold");
      const claimsAbove = assessment.includes("above fold");

      if (claimsBelow && cta.isAboveFold) {
        return { pass: false, reason: `Claims "${ref}" below fold, but isAboveFold=true` };
      }
      if (claimsAbove && !cta.isAboveFold) {
        return { pass: false, reason: `Claims "${ref}" above fold, but isAboveFold=false` };
      }
      return { pass: true };
    }
  },

  // GR-003: Form field count claims must match
  {
    id: "GR-003",
    description: "Form field count claims must match actual form data",
    check: (finding, pageData) => {
      const measurement = finding.evidence.measurement;
      if (!measurement) return { pass: true };

      const fieldCountMatch = measurement.match(/(\d+)\s*(fields|field|required)/i);
      if (!fieldCountMatch) return { pass: true };

      const claimedCount = parseInt(fieldCountMatch[1]);
      const isRequiredClaim = measurement.toLowerCase().includes("required");

      for (const form of pageData.forms) {
        const actualCount = isRequiredClaim ? form.requiredFieldCount : form.fieldCount;
        if (Math.abs(claimedCount - actualCount) > 1) {
          return { pass: false, reason: `Claims ${claimedCount} fields, actual is ${actualCount}` };
        }
      }
      return { pass: true };
    }
  },

  // GR-004: Contrast ratio claims need actual computed styles
  {
    id: "GR-004",
    description: "Color contrast claims must reference actual computed styles",
    check: (finding, pageData) => {
      const assessment = finding.assessment.toLowerCase();
      if (!assessment.includes("contrast")) return { pass: true };

      const ref = finding.evidence.element_ref;
      if (!ref) return { pass: false, reason: "Claims contrast issue without specific element" };

      return { pass: true };
    }
  },

  // GR-005: Heuristic ID must be valid (checked separately in grounding function)
  {
    id: "GR-005",
    description: "heuristic_id must match a known heuristic",
    check: (finding, pageData) => ({ pass: true })  // placeholder
  },

  // GR-006: Critical/high severity requires measurable evidence
  {
    id: "GR-006",
    description: "Critical/high severity requires measurable evidence",
    check: (finding, pageData) => {
      if (finding.severity !== "critical" && finding.severity !== "high") return { pass: true };

      if (!finding.evidence.measurement && !finding.evidence.data_point) {
        return { pass: false, reason: `Severity "${finding.severity}" requires measurable evidence` };
      }
      return { pass: true };
    }
  },

  // GR-007: NO conversion predictions
  {
    id: "GR-007",
    description: "Finding must not contain conversion predictions",
    check: (finding, pageData) => {
      const text = `${finding.assessment} ${finding.recommendation || ""}`.toLowerCase();
      const conversionPhrases = [
        "increase conversions by",
        "improve conversion rate",
        "boost sales by",
        "increase revenue by",
        "% more conversions",
        "% improvement in",
        "lead to x% more",
      ];
      for (const phrase of conversionPhrases) {
        if (text.includes(phrase)) {
          return { pass: false, reason: `Contains conversion prediction: "${phrase}"` };
        }
      }
      return { pass: true };
    }
  },

  // GR-008: data_point must reference real AnalyzePerception section
  {
    id: "GR-008",
    description: "data_point must reference a real section",
    check: (finding, pageData) => {
      const validSections = [
        "ctas", "forms", "trustSignals", "layout", "textContent",
        "headingHierarchy", "navigation", "images", "performance",
        "semanticHTML", "landmarks"
      ];
      const dp = finding.evidence.data_point;
      if (!dp) return { pass: true };

      const section = dp.split(/[\[.]/)[0];
      if (!validSections.includes(section)) {
        return { pass: false, reason: `data_point "${dp}" references unknown section "${section}"` };
      }
      return { pass: true };
    }
  },

  // === Master Architecture Extensions (G7-FIX, Phase 7+) ===

  // GR-009: State provenance integrity (§20.10)
  // Gated behind Phase 7. Phase 1-5 implementations skip this rule.
  // If a finding cites content only visible in a non-default state,
  // the finding MUST record the state_id via state_provenance.
  // Full implementation: §20.10 REQ-STATE-EXPLORE-110.
  // {
  //   id: "GR-009",
  //   description: "Finding citing hidden-state content must include state provenance",
  //   check: (finding, pageData, multiState) => { ... }  // see §20.10
  // },

  // GR-010: Workflow finding cross-step requirement (§21.6)
  // Gated behind Phase 8. Phase 1-7 implementations skip this rule.
  // Workflow-scoped findings MUST reference at least 2 different steps.
  // Single-step concerns belong at page scope.
  // Full implementation: §21.6 REQ-WORKFLOW-GROUND-002.
  // {
  //   id: "GR-010",
  //   description: "Cross-step finding must reference at least 2 different steps",
  //   check: (finding) => { ... }  // see §21.6
  // },
];
```

### Grounding Function

```typescript
function groundFindings(
  reviewedFindings: ReviewedFinding[],
  pageData: AnalyzePerception,
  filteredHeuristics: Heuristic[]
): { grounded: GroundedFinding[]; rejected: RejectedFinding[] } {

  const grounded: GroundedFinding[] = [];
  const rejected: RejectedFinding[] = [];
  const validHeuristicIds = new Set(filteredHeuristics.map(h => h.id));

  for (const finding of reviewedFindings) {
    // GR-005: Heuristic ID validity
    if (!validHeuristicIds.has(finding.heuristic_id)) {
      rejected.push({
        ...finding,
        rejection_reason: `Unknown heuristic_id: ${finding.heuristic_id}`,
        rejected_by: "GR-005"
      });
      continue;
    }

    // Run all rules
    let failed = false;
    for (const rule of GROUNDING_RULES) {
      const result = rule.check(finding, pageData);
      if (!result.pass) {
        rejected.push({ ...finding, rejection_reason: result.reason, rejected_by: rule.id });
        failed = true;
        break;
      }
    }

    if (!failed) {
      const heuristic = filteredHeuristics.find(h => h.id === finding.heuristic_id)!;
      const tier = assignConfidenceTier(finding, heuristic, pageData);

      grounded.push({
        ...finding,
        evidence_verified: true,
        confidence_tier: tier,
        auto_publish: tier === "high",
        needs_consultant_review: tier === "low" || finding.needs_review,
        publish_delay_hours: tier === "medium" ? 24 : 0,
        grounding_rules_passed: GROUNDING_RULES.map(r => r.id),
      });
    }
  }

  return { grounded, rejected };
}
```

### Confidence Tier Assignment

```typescript
function assignConfidenceTier(
  finding: ReviewedFinding,
  heuristic: Heuristic,
  pageData: AnalyzePerception
): "high" | "medium" | "low" {
  const heuristicTier = heuristic.reliability_tier;
  const hasMeasurement = !!finding.evidence.measurement;
  const hasElementRef = !!finding.evidence.element_ref;

  // Tier 1 heuristic + measurable evidence = high confidence
  if (heuristicTier === 1 && hasMeasurement) return "high";

  // Tier 1 + element ref but no measurement = medium
  if (heuristicTier === 1 && hasElementRef) return "medium";

  // Tier 2 + any evidence = medium
  if (heuristicTier === 2 && (hasMeasurement || hasElementRef)) return "medium";

  // Tier 3 = always low
  if (heuristicTier === 3) return "low";

  return "low";
}
```

---

## 7.8 Node: `annotate_and_store`

**REQ-ANALYZE-NODE-005:**

| | |
|---|---|
| **Input** | `grounded_findings[]`, `viewport_screenshot`, `fullpage_screenshot`, `audit_run_id`, `client_id` |
| **Output** | `annotated_screenshots[]`, findings persisted to DB |
| **Postcondition** | All findings in DB. Screenshots in R2. Audit progress updated. |
| **Side effects** | Review gate applied: Tier 1 published, Tier 2 delayed, Tier 3 held. |

### Annotation Specification

```typescript
const ANNOTATION_SPEC = {
  pinSize: 28,                            // diameter in pixels
  pinShape: "circle",
  pinFontSize: 14,
  pinFontWeight: "bold",
  pinFontColor: "#FFFFFF",

  colors: {
    critical: "#DC2626",                  // red-600
    high: "#EA580C",                      // orange-600
    medium: "#CA8A04",                    // yellow-600
    low: "#2563EB",                       // blue-600
  },

  pinBorderWidth: 2,
  pinBorderColor: "#FFFFFF",

  labelFontSize: 11,
  labelMaxWidth: 200,
  labelBackground: "rgba(0,0,0,0.85)",
  labelPadding: 4,
  labelBorderRadius: 4,
  labelColor: "#FFFFFF",
  labelTemplate: "F-{{number}}: {{name}}",

  labelOffset: { x: 16, y: -8 },
  overlapAvoidance: true,

  connectionLine: {
    show: true,
    color: "rgba(255,255,255,0.4)",
    width: 1,
    style: "dashed",
  },
};
```

### Annotation Placement Algorithm

```typescript
function calculateAnnotationPositions(
  findings: GroundedFinding[],
  dimensions: { width: number; height: number }
): AnnotationPosition[] {
  const positions: AnnotationPosition[] = [];

  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i];
    let position: { x: number; y: number };

    if (finding.boundingBox) {
      position = {
        x: Math.min(finding.boundingBox.x + finding.boundingBox.width, dimensions.width - 30),
        y: Math.max(finding.boundingBox.y, 15),
      };
    } else {
      // No bounding box — stack in right margin
      position = {
        x: dimensions.width - 40,
        y: 50 + (i * 50),
      };
    }

    // Overlap avoidance
    for (const existing of positions) {
      const dist = Math.sqrt((position.x - existing.x) ** 2 + (position.y - existing.y) ** 2);
      if (dist < 35) {
        position.y += 40;
      }
    }

    positions.push({
      findingIndex: i + 1,
      findingId: finding.heuristic_id,
      ...position,
      severity: finding.severity!,
      label: `F-${String(i + 1).padStart(2, '0')}: ${finding.heuristic_id}`,
    });
  }

  return positions;
}
```

---

## 7.9 AnalyzePerception Schema

**REQ-ANALYZE-PERCEPTION-001:**

```typescript
interface AnalyzePerception {
  metadata: {
    url: string;
    title: string;
    timestamp: number;
    viewport: { width: number; height: number };
  };

  headingHierarchy: Array<{
    level: number;                     // 1-6
    text: string;                      // truncated to 100 chars
    isAboveFold: boolean;
  }>;

  landmarks: Array<{
    role: string;                      // "navigation", "main", "footer"
    label: string;
  }>;

  semanticHTML: {
    hasMain: boolean;
    hasNav: boolean;
    hasFooter: boolean;
    formCount: number;
    tableCount: number;
  };

  textContent: {
    wordCount: number;
    readabilityScore: number;          // Flesch-Kincaid
    primaryLanguage: string;
    paragraphs: Array<{ text: string; position: "above_fold" | "below_fold" }>;
  };

  ctas: Array<{
    text: string;
    type: "primary" | "secondary" | "tertiary";
    isAboveFold: boolean;
    boundingBox: { x: number; y: number; width: number; height: number };
    computedStyles: {
      backgroundColor: string;
      color: string;
      fontSize: string;
      padding: string;
      contrastRatio: number;
    };
    surroundingContext: string;
  }>;

  forms: Array<{
    id: string;
    fieldCount: number;
    requiredFieldCount: number;
    fields: Array<{
      type: string;
      label: string;
      hasLabel: boolean;
      isRequired: boolean;
      hasValidation: boolean;
      hasErrorMessage: boolean;
      placeholder: string;
    }>;
    hasInlineValidation: boolean;
    submitButtonText: string;
  }>;

  trustSignals: Array<{
    type: "review" | "badge" | "testimonial" | "guarantee" | "security" | "social_proof";
    text: string;
    isAboveFold: boolean;
    boundingBox: { x: number; y: number; width: number; height: number };
  }>;

  layout: {
    viewportHeight: number;
    foldPosition: number;
    contentAboveFold: string[];
    visualHierarchy: { primaryElement: string; secondaryElements: string[] };
    whitespaceRatio: number;
  };

  images: Array<{
    src: string;
    alt: string;
    hasAlt: boolean;
    width: number;
    height: number;
    isAboveFold: boolean;
    isLazyLoaded: boolean;
  }>;

  navigation: {
    primaryNavItems: Array<{ text: string; url: string; isActive: boolean }>;
    breadcrumbs: string[];
    hasSearch: boolean;
    hasMobileMenu: boolean;
  };

  performance: {
    domContentLoaded: number;
    fullyLoaded: number;
    resourceCount: number;
    totalTransferSize: number;
    largestContentfulPaint?: number;
  };
}
```
