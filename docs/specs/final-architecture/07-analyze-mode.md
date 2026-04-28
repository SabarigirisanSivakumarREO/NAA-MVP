---
title: 07-analyze-mode
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

# Section 7 — Analyze Mode (Analysis Pipeline)

> **See also §33 — Agent Composition Model.** §33 extends the 5-step pipeline below: the `evaluate` node becomes pluggable via `EvaluateStrategy` (§33a Phase 7). The `StaticEvaluateStrategy` is the path defined here; the `InteractiveEvaluateStrategy` (Phase 14) replaces single-shot evaluation with a ReAct loop using injected browser tools. This section remains the canonical static path; for the interactive path, read §33 §33.7b.

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

  // === v2.2 Additions ===

  // GR-012: Benchmark claim validation (v2.2)
  // REQUIRED on all findings that reference benchmarks.
  // For quantitative benchmarks: claimed value must be within ±20% of actual page data
  // For qualitative benchmarks: finding must reference the standard text
  {
    id: "GR-012",
    description: "Benchmark claims must match heuristic benchmark data",
    check: (finding, pageData, heuristic) => {
      if (!finding.evidence.measurement || !heuristic.benchmark) {
        return { pass: true };  // No benchmark claim to validate
      }

      if (heuristic.benchmark.type === "quantitative") {
        // Extract claimed value from measurement string
        const claimedMatch = finding.evidence.measurement.match(/(\d+(?:\.\d+)?)/);
        if (!claimedMatch) return { pass: true };
        const claimedValue = parseFloat(claimedMatch[1]);

        // Get actual value from page data (varies by unit type)
        const actualValue = extractActualValue(pageData, heuristic.benchmark.unit);
        if (actualValue === null) return { pass: true };

        const deviation = Math.abs(claimedValue - actualValue) / actualValue;
        if (deviation > 0.20) {
          return {
            pass: false,
            reason: `Claimed ${claimedValue}, actual ${actualValue} (${(deviation * 100).toFixed(0)}% deviation)`
          };
        }
      } else {
        // Qualitative: finding must reference the standard text or exemplars
        const text = `${finding.observation} ${finding.assessment}`.toLowerCase();
        const standardWords = heuristic.benchmark.standard.toLowerCase().split(/\s+/).slice(0, 5);
        const referencesStandard = standardWords.some(w => w.length > 4 && text.includes(w));
        if (!referencesStandard) {
          return {
            pass: false,
            reason: `Qualitative benchmark not referenced in finding`
          };
        }
      }
      return { pass: true };
    }
  },
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

**REQ-ANALYZE-PERCEPTION-001** (baseline) **+ REQ-ANALYZE-PERCEPTION-V23-001** (v2.3 consultant-grade enrichments):

```typescript
interface AnalyzePerception {
  metadata: {
    url: string;                                       // final URL after redirects
    requestedUrl: string;                              // v2.3: URL as originally requested
    title: string;
    metaDescription: string | null;                    // v2.3: <meta name="description">
    canonical: string | null;                          // v2.3: <link rel="canonical">
    lang: string | null;                               // v2.3: <html lang>
    ogTags: Record<string, string>;                    // v2.3: og:title, og:description, og:image, og:type, etc.
    schemaOrg: Record<string, unknown>[];              // v2.3: JSON-LD + microdata
    timestamp: number;
    viewport: { width: number; height: number };
  };

  headingHierarchy: Array<{
    level: number;                                     // 1-6
    text: string;                                      // truncated to 100 chars
    isAboveFold: boolean;
  }>;

  landmarks: Array<{
    role: string;                                      // "navigation", "main", "footer"
    label: string;
  }>;

  semanticHTML: {
    hasMain: boolean;
    hasNav: boolean;
    hasFooter: boolean;
    formCount: number;
    tableCount: number;
  };

  // v2.3: new top-level structure derivation section
  structure: {
    titleH1Match: boolean;                             // does <title> semantically match first <h1>?
    titleH1Similarity: number;                         // 0.0-1.0 cosine or Jaccard on tokens
  };

  textContent: {
    wordCount: number;
    readabilityScore: number;                          // Flesch-Kincaid
    primaryLanguage: string;
    paragraphs: Array<{ text: string; position: "above_fold" | "below_fold" }>;

    // v2.3 additions
    valueProp: {                                       // extracted value-prop candidates
      h1: string | null;
      heroSubheading: string | null;                   // first <h2> or hero subtitle above fold
      firstParagraph: string | null;                   // first paragraph of main content
    };
    urgencyScarcityHits: Array<{                       // pattern matches: "limited time", "only N left", "ends in HH:MM", "N viewing now"
      pattern: string;
      match: string;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>;
    riskReversalHits: Array<{                          // pattern matches: "money-back", "free returns", "N-day guarantee", "no commitment"
      pattern: string;
      match: string;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>;
  };

  ctas: Array<{
    text: string;
    accessibleName: string | null;                     // v2.3: from AX-tree (aria-label, aria-labelledby, or computed name)
    role: string | null;                               // v2.3: computed ARIA role
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
    // v2.3: pseudo-class computed styles (via CSS matching, no real interaction required)
    hoverStyles: {
      backgroundColor: string;
      color: string;
      contrastRatio: number;
    } | null;
    focusStyles: {
      backgroundColor: string;
      color: string;
      contrastRatio: number;
      outlineVisible: boolean;                         // outline-width > 0 and outline-color visible
    } | null;
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
      accessibleName: string | null;                   // v2.3: AX-tree merge
      role: string | null;                             // v2.3: computed ARIA role
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
    subtype: "payment" | "security_certification" | "industry_cert" | "customer_review" | "expert_endorsement" | "press_mention" | "aggregate_rating" | "other";  // v2.3
    text: string;
    isAboveFold: boolean;
    boundingBox: { x: number; y: number; width: number; height: number };

    // v2.3 additions
    source: "third_party" | "self_claimed" | "unknown";             // third-party iff sourced from external verifiable source (Trustpilot, schema.org AggregateRating, etc.)
    attribution: string | null;                                     // "4.7 stars on Trustpilot", "ISO 27001 certified", etc.
    freshnessDate: string | null;                                   // ISO date — e.g., date of review, date of certification
    pixelDistanceToNearestCta: number | null;                       // Euclidean distance in pixels from trust signal center to nearest CTA center
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

  // v2.3: iframes are a distinct concern from images (embedded third-party content)
  iframes: Array<{
    src: string;
    origin: string;
    isCrossOrigin: boolean;
    boundingBox: { x: number; y: number; width: number; height: number };
    isAboveFold: boolean;
    purposeGuess: "checkout" | "video" | "map" | "chat" | "antibot" | "analytics" | "social_embed" | "other";  // heuristic: stripe.com → checkout, youtube.com → video, maps.google → map, recaptcha → antibot, etc.
  }>;

  navigation: {
    primaryNavItems: Array<{ text: string; url: string; isActive: boolean }>;
    breadcrumbs: string[];
    footerNavItems: Array<{ text: string; url: string; section: string | null }>;  // v2.3
    hasSearch: boolean;
    hasMobileMenu: boolean;
  };

  // v2.3: new top-level accessibility section
  accessibility: {
    keyboardFocusOrder: Array<{                        // enumeration of [tabindex], button, a, input, select, textarea in tab order
      selector: string;
      role: string | null;
      accessibleName: string | null;
      tabindex: number;
    }>;
    skipLinks: Array<{                                 // anchors to #main, #content, etc., positioned in top 100px
      text: string;
      target: string;
      isVisible: boolean;                              // not hidden via display:none or positioned off-screen
    }>;
  };

  performance: {
    domContentLoaded: number;
    fullyLoaded: number;
    resourceCount: number;
    totalTransferSize: number;
    largestContentfulPaint?: number;

    // v2.3 additions — Core Web Vitals + CRO-specific metric
    interactionToNextPaint?: number;                   // INP (via PerformanceObserver)
    cumulativeLayoutShift?: number;                    // CLS (via PerformanceObserver)
    timeToFirstByte?: number;                          // TTFB (performance.timing.responseStart - navigationStart)
    timeToFirstCtaInteractable?: number;               // CRO-specific: timestamp when first CTA has non-zero bounding box + intersects viewport
  };

  // v2.2 Addition
  viewport_context?: {
    width: number;                       // 1440 (desktop) or 390 (mobile)
    height: number;
    device_type: "desktop" | "mobile";
  };

  // v2.3: replaces the separate detectPageType() return value; now attached directly to perception
  inferredPageType: {
    primary: PageType;
    alternatives: Array<{
      type: PageType;
      confidence: number;                              // 0.0-1.0
    }>;
    signalsUsed: {                                     // for transparency + grounding
      urlKeywords: string[];
      ctaTexts: string[];
      formSignals: string[];
      schemaOrgTypes: string[];
    };
  };
}
```

### 7.9.1 v2.3 Enrichment Summary

Added in v2.3 (2026-04-17) — consultant-grade perception signals merged from MVP v1.0 work back into master plan:

**Rationale:** Close real spec defects (accessibility primitives missing, iframes not modeled, CWV INP/CLS/TTFB absent, trust signal provenance shallow, Cialdini heuristics lacked pattern-detection inputs, page type classification had no confidence score per checklist gap G6.2). All extractions happen inside the same single `page.evaluate()` call — REQ-TOOL-PA-001 unchanged; zero cost impact.

| Section | v2.3 additions |
|---|---|
| `metadata` | `requestedUrl`, `metaDescription`, `canonical`, `lang`, `ogTags`, `schemaOrg` (merged from `browser_get_metadata`) |
| `structure` (new) | `titleH1Match`, `titleH1Similarity` |
| `textContent` | `valueProp` (H1 + hero subheading + first paragraph), `urgencyScarcityHits[]`, `riskReversalHits[]` |
| `ctas[]` | `accessibleName`, `role`, `hoverStyles`, `focusStyles` (via CSS pseudo-class matching, no interaction) |
| `forms[].fields[]` | `accessibleName`, `role` |
| `trustSignals[]` | `subtype`, `source`, `attribution`, `freshnessDate`, `pixelDistanceToNearestCta` |
| `iframes` (new top-level) | `src`, `origin`, `isCrossOrigin`, `boundingBox`, `isAboveFold`, `purposeGuess` |
| `navigation` | `footerNavItems[]` |
| `accessibility` (new top-level) | `keyboardFocusOrder[]`, `skipLinks[]` |
| `performance` | `interactionToNextPaint`, `cumulativeLayoutShift`, `timeToFirstByte`, `timeToFirstCtaInteractable` |
| `inferredPageType` (new top-level) | `primary + alternatives[]` with confidence scores; replaces bare `detectPageType()` return |

**Backward compatibility:** All v2.3 fields are additive. No baseline field removed or renamed. Existing code that reads baseline fields continues to work.

**Tooling impact:** `page_analyze` implementation (§08.4) extends to populate new fields within the same `page.evaluate()` call. `detectPageType()` (§07.4) return type changes from `PageType` to `AnalyzePerception.inferredPageType`.

**Grounding impact:** New grounding opportunities — benchmarks on INP/CLS/TTFB (v2.3 Core Web Vitals heuristics), trust-signal provenance checks, accessibility baseline checks. GR-001..GR-012 unchanged; new rules (GR-013+) may be added as heuristics authored against new fields.

---

### 7.9.2 v2.4 Perception Extensions (Phase 1b)

**Status:** Added in v2.4 (2026-04-28). Implemented in **Phase 1b** (Perception Extensions, Week 2-3) per §16 v2.4. Closes the 9 perception gaps identified in the master-checklist coverage audit.

**Rationale:** Top-1% CRO consultants evaluate signals the v2.3 schema doesn't capture — pricing display, click target sizing (Fitt's Law), sticky element behavior, popup quality, friction aggregates, social proof depth, microcopy semantics near CTAs, visual attention, and commerce-specific signals (stock, shipping, returns). All extractions happen inside the same single `page.evaluate()` call. Cost impact: zero (no new LLM calls).

**REQ-ANALYZE-PERCEPTION-V24-001:** The `AnalyzePerception` schema is extended with 10 new field groups (9 top-level + 1 nested in `metadata`). All fields are additive and backward-compatible.

```typescript
interface AnalyzePerceptionV24Extensions {
  // Added to existing metadata block
  metadata: {
    // ...all v2.3 fields...
    currencySwitcher: {
      present: boolean;
      currentCurrency: string | null;                   // matches html.lang region default
      availableCurrencies: string[];                    // e.g., ["USD","EUR","GBP","INR"]
      isAccessibleAt: "header" | "footer" | "none";
    } | null;
  };

  // NEW top-level: pricing display
  pricing: {
    hasPricing: boolean;
    displayFormat: "amount" | "amount_period" | "amount_with_strike" | "from_amount" | "contact_for_quote" | null;
    amount: string | null;                              // raw text e.g. "$49.99"
    amountNumeric: number | null;
    currency: string | null;
    taxInclusion: "inclusive" | "exclusive" | "unspecified";
    anchorPrice: string | null;                         // strikethrough original
    discountPercent: number | null;                     // computed if anchor + amount present
    comparisonShown: boolean;                           // "Save $X" / "Was Y, Now Z" present
    boundingBox?: { x: number; y: number; width: number; height: number };
  } | null;

  // NEW top-level: click target sizing per WCAG 2.5.5 / Fitt's Law
  clickTargets: Array<{
    elementId: string;                                  // selector or stable ref
    elementType: "cta" | "link" | "form_control" | "icon_button";
    sizePx: { width: number; height: number };
    isMobileTapFriendly: boolean;                       // ≥48×48 per WCAG 2.5.5
    isAboveFold: boolean;
  }>;

  // NEW top-level: sticky / fixed elements at rest
  stickyElements: Array<{
    type: "cta" | "cart" | "nav" | "header" | "banner" | "chat_widget";
    positionStrategy: "sticky" | "fixed";
    initialBoundingBox: { x: number; y: number; width: number; height: number };
    viewportCoveragePercent: number;
    isAboveFold: boolean;
    containsPrimaryCta: boolean;
  }>;

  // NEW top-level: popup PRESENCE (behavior probing deferred to Phase 5b)
  popups: Array<{
    type: "modal" | "lightbox" | "drawer" | "toast" | "cookie_banner" | "consent_form";
    isInitiallyOpen: boolean;                           // present at page load
    hasCloseButton: boolean;
    closeButtonAccessibleName: string | null;
    isEscapeDismissible: boolean | null;                // null until tested in Phase 5b
    isClickOutsideDismissible: boolean | null;          // null until tested in Phase 5b
    viewportCoveragePercent: number;
    blocksPrimaryContent: boolean;                      // covers >50% of fold
    // Behavior fields (timing, exit-intent, scroll trigger, dark patterns) → Phase 5b
  }>;

  // NEW top-level: derived friction metric
  frictionScore: {
    totalFormFields: number;
    requiredFormFields: number;
    popupCount: number;
    forcedActionCount: number;                          // popups blocking content
    raw: number;                                        // weighted sum
    normalized: number;                                 // 0-1 scale
  };

  // NEW top-level: enrichment beyond trustSignals[]
  socialProofDepth: {
    reviewCount: number | null;                         // explicit count if shown
    starDistribution: Array<{ stars: 1 | 2 | 3 | 4 | 5; count: number }> | null;
    recencyDays: number | null;                         // age of most recent review
    hasAggregateRating: boolean;                        // schema.org AggregateRating
    hasIndividualReviews: boolean;
    thirdPartyVerified: boolean;                        // sourced from Trustpilot, etc.
  };

  // NEW top-level: semantic tagging of microcopy near CTAs
  microcopy: {
    nearCtaTags: Array<{
      ctaIndex: number;                                 // index into ctas[]
      distance: "adjacent" | "within_50px" | "within_100px";
      tag: "risk_reducer" | "urgency" | "security" | "guarantee" | "social_proof" | "value_prop" | "other";
      text: string;
    }>;
  };

  // NEW top-level: visual attention / saliency
  attention: {
    dominantElement: {
      type: "cta" | "image" | "headline" | "form" | "video" | "popup" | "other";
      selector: string | null;
      score: number;                                    // 0-1, derived from contrast + size + position + saturation
    } | null;
    contrastHotspots: Array<{                           // top 3 highest-contrast regions
      boundingBox: { x: number; y: number; width: number; height: number };
      contrastScore: number;
    }>;
  };

  // NEW top-level: commerce-specific signals
  commerce: {
    isCommerce: boolean;                                // page is part of e-comm flow
    stockStatus: "in_stock" | "low_stock" | "out_of_stock" | "preorder" | "unspecified" | null;
    stockMessage: string | null;                        // raw text e.g. "Only 3 left"
    shippingSignals: Array<{
      text: string;
      type: "free" | "fast" | "estimated_delivery" | "international" | "other";
      isAboveFold: boolean;
    }>;
    returnPolicyPresent: boolean;
    returnPolicyText: string | null;
    guaranteeText: string | null;
  };
}
```

**Phase 1b additions summary:**

| Section | v2.4 additions | Closes gap |
|---|---|---|
| `metadata.currencySwitcher` | `present`, `currentCurrency`, `availableCurrencies`, `isAccessibleAt` | Currency clarity for international audits |
| `pricing` (new top-level) | Display format, amount, currency, tax inclusion, anchor, discount % | Pricing display analysis (huge for e-comm) |
| `clickTargets[]` (new top-level) | Per-element size + mobile-tap-friendly flag | Fitt's Law / mobile UX |
| `stickyElements[]` (new top-level) | Type, position, coverage, primary-CTA flag | Sticky CTA / cart / nav analysis |
| `popups[]` (new top-level) | Type, presence, dismissibility, viewport coverage | Popup quality (presence layer) |
| `frictionScore` (new top-level) | Aggregate friction metric | "How many decisions to convert" |
| `socialProofDepth` (new top-level) | Review count, star distribution, recency | Social proof granularity |
| `microcopy.nearCtaTags[]` (new top-level) | Semantic tagging of CTA microcopy | Risk-reducer / urgency / security tags |
| `attention.dominantElement` (new top-level) | Dominant visual element + contrast hotspots | Visual hierarchy depth |
| `commerce` (new top-level) | Stock status, shipping signals, return policy | E-comm-specific signals |

**Backward compatibility:** All v2.4 fields are additive. No baseline field removed or renamed. Existing v2.3 code paths continue to work without modification.

**Tooling impact:** `page_analyze` (§08.4) extends to populate new fields within the same `page.evaluate()` call. No new MCP tools added. No new LLM calls. Cost impact = zero.

**Token impact:** Estimated +1500 tokens to AnalyzePerception payload (5K → 6.5K). Stays under 8K hard cap. Heuristic prompts that consume new fields will see proportional token increase.

**Grounding impact:** New grounding opportunities — pricing display heuristics, click target size heuristics (mobile-only audits), sticky element behavior, popup intrusiveness scoring, friction-vs-conversion correlation, semantic microcopy heuristics, attention/saliency heuristics, e-comm stock/shipping heuristics. New grounding rules (GR-013+) may be authored against these fields.

**Phase 5b extension (deferred):** The `popups[].isEscapeDismissible`, `popups[].isClickOutsideDismissible`, popup timing, exit-intent triggers, scroll triggers, and dark-pattern detection require browser interaction at runtime and are populated in **Phase 5b** (Multi-Viewport + Popup Behavior). Multi-viewport diff (desktop vs mobile fold composition) is also Phase 5b.

---

### 7.9.3 PerceptionBundle Envelope (Phase 1c)

**Status:** Added in v2.5 (2026-04-28). Implemented in **Phase 1c** (Week 3-4) per §16 v2.5. Adopts the `PerceptionBundle` contract from `docs/Improvement/perception_layer_spec.md`. **Wraps existing `AnalyzePerception` — does not replace it.**

**Rationale:** Cross-channel queries ("low-contrast above-fold buttons") require shared element identity across DOM / AX-tree / layout / visual views. Current parallel arrays (`ctas[]`, `forms[]`, `clickTargets[]`, etc.) implicitly identify by index, which makes correlation fragile. The `PerceptionBundle` envelope adds an `ElementGraph` keyed by stable `element_id`, plus `nondeterminism_flags` and `warnings` for honest output. AnalyzePerception lives inside the bundle unchanged.

**REQ-ANALYZE-PERCEPTION-V25-001:** The top-level perception contract becomes `PerceptionBundle`. Existing `AnalyzePerception` consumers continue to read `bundle.raw.analyze_perception_by_state[bundle.initial_state_id]`. New consumers query `bundle.element_graph_by_state[...]`.

```typescript
interface PerceptionBundle {
  meta: {
    url: string;
    captured_at: string;                                // ISO8601
    viewport: { w: number; h: number; dpr: number };
    user_agent: string;
    auth_state: "anonymous" | "authenticated" | "returning" | null;
    geo: string | null;                                 // ISO country code or null
    locale: string | null;                              // BCP-47, from html.lang or page meta
    perception_layer_version: string;                   // semver
  };

  performance: {
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    page_weight_bytes: number;
    request_count: number;
    blocked_by_tracker_count: number;
    time_to_interactive_ms: number | null;
  };

  nondeterminism_flags: Array<                          // honest output: what may vary across runs
    | "optimizely_active"
    | "vwo_active"
    | "google_optimize_active"
    | "personalization_cookie_set"
    | "ab_test_query_param"
    | "time_based_content_detected"
    | "ad_auction_detected"
  >;

  warnings: Array<{
    code:
      | "SHADOW_DOM_NOT_TRAVERSED"
      | "IFRAME_SKIPPED"
      | "BUDGET_EXHAUSTED_AT_DEPTH_2"
      | "AUTH_REQUIRED_DETECTED"
      | "SETTLE_TIMEOUT_5S"
      | "FONTS_NOT_READY"
      | "ANIMATION_NOT_SETTLED"
      | "COOKIE_BANNER_BLOCKING_FOLD";
    message: string;
    severity: "info" | "warn" | "error";
  }>;

  initial_state_id: string;                             // root state of the StateGraph

  state_graph: {
    nodes: Array<{
      state_id: string;
      parent_state_id: string | null;
      trigger_path: Array<{ element_id: string; action: string; value?: string }>;
      new_content_summary: string | null;              // diff vs parent (Phase 13 master track adds delta_type)
    }>;
    edges: Array<{                                      // formal edges added in Phase 13 (master track) — Phase 1c emits node-only
      from: string;
      to: string;
      trigger: { element_id: string; action: string; value?: string };
    }>;
  };

  element_graph_by_state: Map<string, ElementGraph>;    // one graph per state_id

  raw: {
    analyze_perception_by_state: Map<string, AnalyzePerception>;  // §7.9 + §7.9.2 unchanged, lives here
    page_state_model_by_state: Map<string, PageStateModel>;       // §6.6 unchanged, lives here
    full_page_screenshot_url_by_state: Map<string, string>;       // R2 path
    viewport_screenshot_url_by_state: Map<string, string>;        // R2 path
  };
}

interface ElementGraph {
  state_id: string;
  elements: Map<string, FusedElement>;                  // keyed by element_id
  root_element_ids: string[];                           // direct children of <body>
}

interface FusedElement {
  element_id: string;                                   // stable hash: tag + classes + DOM position + text content prefix
  tag: string;                                          // "button", "div", "input"
  selector: string;                                     // CSS selector for retrieval
  xpath: string;                                        // XPath for retrieval

  text_content: string | null;                          // visible text including pseudo-element ::before/::after content
  attrs: Record<string, string>;                        // id, class, href, src, alt, data-*, etc.

  ax: {
    role: string;
    name: string | null;
    states: { expanded?: boolean; selected?: boolean; checked?: boolean; disabled?: boolean; focused?: boolean; pressed?: boolean };
    properties: { haspopup?: boolean; controls?: string; describedby?: string; required?: boolean };
  } | null;

  bbox: { x: number; y: number; w: number; h: number };
  in_fold: boolean;
  visible: boolean;                                     // computed: in viewport + display!=none + visibility!=hidden
  z_index: number;
  overflow_clipped: boolean;

  style: {
    color: string;
    background_color: string;
    font_size_px: number;
    font_weight: number;
    contrast_ratio: number;                             // WCAG ratio vs background
  };

  crop_url: string | null;                              // bbox reference into full_page_screenshot, NOT a separate image. Populated only for "key elements" (CTAs, hero, price, form fields)

  is_interactive: boolean;                              // ax_role ∈ {button, link, tab, ...} OR onclick/href OR cursor:pointer + click handler

  parent_id: string | null;
  children_ids: string[];

  // Cross-references back to existing v2.3/v2.4 arrays for backward compat
  ref_in_analyze_perception: {
    cta_index?: number;                                  // index into AnalyzePerception.ctas[]
    form_index?: number;                                 // index into AnalyzePerception.forms[]
    field_index?: number;                                // index into AnalyzePerception.forms[].fields[]
    trust_signal_index?: number;
    image_index?: number;
    iframe_index?: number;
    sticky_index?: number;
    popup_index?: number;
    click_target_index?: number;
  } | null;
}
```

**Cross-channel query API (utility, not in MVP — deferred to Phase 14):**

```typescript
// Example query that becomes possible after Phase 1c element fusion:
bundle.element_graph_by_state[stateId].elements
  .filter(e =>
    e.ax?.role === "button" &&
    e.in_fold &&
    e.style.contrast_ratio < 4.5
  );
// → "low-contrast above-fold buttons"
```

The query API itself ships in Phase 14 (§33 interactive evaluate); Phase 1c only ships the data structure that makes it possible.

**`element_id` stability rules:**

| Rule | Detail |
|---|---|
| Hash inputs | `tag + sorted_classes + dom_position_path + text_content_prefix(50)` |
| Stable across re-runs of same URL | Yes (unless DOM changes meaningfully) |
| Stable across viewports | No — different viewports produce different `element_id`s when responsive layout reflows |
| Re-used across states | Yes when DOM node persists; new ID when node is added/removed |

**Token budget impact:**

| Layer | v2.4 | v2.5 (Phase 1c) |
|---|---|---|
| `AnalyzePerception` | ≤6.5K | ≤6.5K (unchanged) |
| `ElementGraph` (top 30 elements per state) | — | ~1.5K |
| `PerceptionBundle` envelope (meta + flags + warnings + state nodes) | — | ~0.5K |
| **Total per state** | ≤6.5K | **≤8.5K** |

The 8K hard cap from §7.9.2 is raised to 9K in v2.5. New cap applies to bundle, not just `AnalyzePerception`.

**Selective fusion — top N elements only:**

`ElementGraph.elements` does NOT contain every DOM node. It contains only:

1. All elements referenced by existing `AnalyzePerception` arrays (CTAs, forms, fields, trust signals, images, iframes, sticky, popups, click targets)
2. All elements with `ax.role` ∈ {button, link, tab, menuitem, checkbox, radio, combobox, textbox}
3. All elements with `is_interactive = true` not already covered above
4. Direct ancestors of any of the above (for parent_id chain integrity)

Default cap: 30 elements per state. Configurable via `AuditRequest.element_graph_size`.

**Settle predicate (Phase 1c REQ-PERCEPT-V25-002):**

```typescript
async function waitForSettle(page: Page, opts: SettleOptions = {}): Promise<SettleResult> {
  const start = Date.now();
  await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});  // soft
  await waitForDomMutationsToStop(page, { idleMs: 300, maxMs: 3000 });
  await page.waitForFunction(() => (document as any).fonts?.ready ?? true).catch(() => {});
  await waitForAnimationsToFinish(page, { timeout: 1500 });                       // poll element.getAnimations()
  if (opts.requireSelector) {
    await page.waitForSelector(opts.requireSelector, { timeout: 2000 });
  }
  const elapsed = Date.now() - start;
  return { elapsed_ms: elapsed, capped_at_5s: elapsed >= 5000 };
}
```

Hard cap: 5 seconds. If exceeded, emit `SETTLE_TIMEOUT_5S` warning and proceed with the state as-captured.

**Backward compatibility:**

| Existing consumer | Reads from | Migration |
|---|---|---|
| `evaluate` node (§7.5) | `state.analyze_perception` | Now `state.bundle.raw.analyze_perception_by_state[state.bundle.initial_state_id]` — accessor helper provided |
| Grounding rules GR-001 to GR-008 | `AnalyzePerception` field paths | Unchanged. All existing field paths still resolve. |
| `annotate_and_store` (§7.10) | Screenshot URL | Now `bundle.raw.full_page_screenshot_url_by_state[stateId]` — accessor helper provided |
| `deep_perceive` output | Returned `AnalyzePerception` | Now returns `PerceptionBundle`; helper `bundleToAnalyzePerception()` for legacy paths |

**Things PerceptionBundle does NOT do (from spec §8):**

- No CRO judgments (no "this CTA is too small" — record size, let heuristics judge)
- No prioritization (don't rank elements by importance — record everything meeting capture criteria)
- No content rewriting (don't normalize copy or fix typos)
- No form submission unless explicitly allowed
- No autonomous auth attempts
- No retries that mutate state

These are **architectural invariants** for the perception layer — captured in `constitution.md` updates for v2.5.

---

## 7.10 Perception Quality Gate (v2.2)

**REQ-ANALYZE-QUALITY-001:** A perception quality gate runs between `deep_perceive` and `evaluate`. It scores the perception data and routes to one of three outcomes: proceed / partial / skip. This prevents wasting LLM calls on pages with corrupted or incomplete perception.

**REQ-ANALYZE-QUALITY-002:** Seven weighted signals:

```typescript
interface PerceptionQualityScore {
  overall: number;                           // 0.0 to 1.0
  signals: {
    has_meaningful_content: boolean;         // textContent.wordCount > 50
    has_interactive_elements: boolean;        // ctas.length > 0 OR forms.length > 0
    has_navigation: boolean;                 // navigation.primaryNavItems.length > 2
    has_heading_structure: boolean;           // headingHierarchy.length > 0
    no_overlay_detected: boolean;            // no high-z-index fixed el covering >30% viewport
    no_error_state: boolean;                 // no "access denied", captcha, "please verify" text
    page_loaded: boolean;                    // DOMContentLoaded < 30000ms AND resourceCount > 5
  };
  blocking_issue: string | null;             // human-readable reason if overall < threshold
}
```

Signal weights: content 0.25, interactive 0.20, overlay 0.15, error_state 0.15, navigation 0.10, headings 0.10, loaded 0.05. Total: 1.00.

**REQ-ANALYZE-QUALITY-003:** Three outcomes:

| Score | Action | analysis_status |
|---|---|---|
| ≥ 0.6 | Proceed to evaluate normally | `complete` (on success) |
| 0.3 – 0.59 | Partial analysis — Tier 1 quantitative heuristics only, skip LLM | `partial` |
| < 0.3 | Skip page, log blocking_issue, move to next | `perception_insufficient` |

**REQ-ANALYZE-QUALITY-004:** Overlay detection — flags elements with `position: fixed/sticky`, `z-index > 999`, bounding box > 30% viewport, common class patterns (`cookie`, `consent`, `modal`, `popup`, `overlay`, `chat-widget`). The quality gate flags them; overlay dismissal (§6.17 v2.2) attempts to remove them before perception runs.

---

## 7.11 Analysis Error Recovery (v2.2)

**REQ-ANALYZE-RECOVERY-001:** Every page gets an `analysis_status`. The audit never silently drops a page.

```typescript
type AnalysisStatus =
  | "complete"                    // all 5 steps ran, findings produced
  | "partial"                     // some steps ran, partial findings produced
  | "perception_insufficient"     // quality gate blocked analysis
  | "budget_exceeded"             // ran out of budget mid-analysis
  | "llm_failed"                  // LLM calls failed after retries
  | "grounding_rejected_all"      // 100% of findings rejected by grounding
  | "failed";                     // unknown/unrecoverable error
```

**REQ-ANALYZE-RECOVERY-002:** Recovery matrix:

| Failure | Detection | Recovery | Status |
|---|---|---|---|
| LLM timeout on evaluate | No response in 60s | Retry with split batch: 20 heuristics → 2×10. Both timeout = mark. | `partial` or `llm_failed` |
| Semantically garbage output | Valid JSON but no real heuristic_ids or observations < 20 chars | Retry once with explicit instruction. Still garbage = skip evaluate. | `llm_failed` |
| Self-critique rejects ALL | `reviewed_findings.length === 0` after critique | Skip critique. Send raw_findings to grounding. Log `critique_override_all_rejected`. | `complete` |
| Grounding rejects 100% | `grounded_findings.length === 0` AND `rejected_findings.length > 0` | Flag page for consultant review. Raw findings + rejection reasons visible in internal store. | `grounding_rejected_all` |
| Budget exceeded mid-evaluate | `cost_usd > analysis_budget_usd` during loop | Complete current call. Emit partial findings. Skip remaining heuristics. | `budget_exceeded` |
| Zero findings (clean page) | Valid JSON, zero findings | Accept as valid. If page has CTAs+forms+content AND zero findings across 15+ heuristics → log `suspiciously_clean` warning. | `complete` |
| Annotation failure (Sharp) | Image processing exception | Store findings without annotations. Findings still valid. | `complete` |
| Unexpected exception | Uncaught error | Catch at graph level. Log with stack trace + audit_run_id + page_url. Mark page. Continue. | `failed` |

**REQ-ANALYZE-RECOVERY-003:** `audit_complete` reports page-status breakdown: "47/50 pages fully analyzed, 2 partially analyzed, 1 skipped (perception quality)."

---

## 7.12 Persona-Based Evaluation (v2.2a)

**REQ-ANALYZE-PERSONA-001:** Client profile may include `personas: PersonaContext[]`. Default 2-3 personas per business type.

```typescript
interface PersonaContext {
  id: string;                          // "first-time-visitor"
  name: string;                        // "First-time visitor"
  description: string;                 // "Never visited this site before"
  goals: string[];
  frustrations: string[];
  business_type_applicability: BusinessType[];
}
```

**REQ-ANALYZE-PERSONA-002:** Personas are injected into the evaluate user message. The LLM evaluates heuristics from each persona's perspective.

**REQ-ANALYZE-PERSONA-003:** Each finding gets a `persona: string | null` field. Null when no persona context is active.

**REQ-ANALYZE-PERSONA-004:** Default personas per business type:
- **ecommerce:** first-time-visitor, returning-customer, price-sensitive-shopper
- **saas:** evaluator, technical-buyer, existing-customer
- **leadgen:** researcher, decision-maker, qualified-lead
- **media:** casual-reader, subscriber, power-user

---

## 7.13 Cross-Page Analysis Integration (v2.2)

**REQ-ANALYZE-CROSSPAGE-001:** After each page's analysis completes, extract and emit a lightweight `PageSignals` object:

```typescript
interface PageSignals {
  page_url: string;
  page_type: PageType;
  cta_count: number;
  cta_texts: string[];                   // truncated to 50 chars each
  form_field_counts: number[];
  trust_signal_types: string[];
  nav_link_count: number;
  heading_texts: string[];               // h1/h2 only
  key_metric_violations: string[];       // "14 form fields vs 6-8 benchmark"
  finding_heuristic_ids: string[];
  finding_count: number;
  perception_quality_score: number;
}
```

**REQ-ANALYZE-CROSSPAGE-002:** PageSignals are accumulated in `state.page_signals` (array). NOT full AnalyzePerception objects — prevents 2.5-5MB state bloat on 50-page audits.

**REQ-ANALYZE-CROSSPAGE-003:** After the page loop completes, `cross_page_analyze` node runs (see §4 orchestration). Produces PatternFinding, ConsistencyFinding, FunnelFinding arrays.

**REQ-ANALYZE-CROSSPAGE-004:** (Master plan, Phase 8 enhancement) Progressive funnel context — for pages beyond the first 2-3, accumulated PageSignals injected into the evaluate prompt. Enables inline funnel-aware findings. MVP uses post-hoc cross-page only.

---

**End of §7 — Analyze Mode (base §7.1-7.9 + v2.2 extensions §7.10-7.13)**
