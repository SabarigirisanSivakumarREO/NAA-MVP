# AI Analysis Agent Architecture v1.0 — Specification

## CRO Heuristic Evaluation Engine

**REO Digital / Neural Product Team — April 2026**
**Spec ID:** REO-ANALYSIS-AGENT-v1.0
**Status:** Pre-Implementation — Architecture Lock
**Companion to:** AI_Browser_Agent_Architecture_v3.1.md (browse mode)
**Parent system:** Integrated_CRO_System_Architecture_v5.1.md
**Compliance:** RFC 2119 (SHALL/MUST/SHOULD/MAY)

---

## Document Control

| Field | Detail |
|-------|--------|
| **Scope** | Analysis mode ONLY — evaluating pages against CRO heuristics |
| **Out of scope** | Browsing, navigation, interaction — see AI_Browser_Agent_Architecture_v3.1.md |
| **Dependency** | Requires browse mode to deliver a loaded, stable page before analysis begins |
| **Research basis** | 8 papers (GPT-4o vs Experts, MLLM UI Judge, WiserUI-Bench, UXAgent, AIHeurEval, Berkeley CHI 2024, WebUIBench, DesignBench) |

---

## Section 0 — Reality Check

### 0.1 What LLM Analysis CAN Do (Reliably)

| Capability | Reliability | Source |
|-----------|------------|--------|
| Detect missing elements (no CTA, no trust signals, no heading) | **High (>80%)** | MLLM UI Judge |
| Evaluate visual hierarchy and layout | **High (>75%)** | MLLM UI Judge |
| Count form fields and check labels | **High (>90%)** | Deterministic from page data |
| Check above/below fold placement | **High (>90%)** | Deterministic from bounding box |
| Identify color contrast issues | **High (>85%)** | Deterministic from computed styles |
| Assess consistency across pages | **Medium (~65%)** | AIHeurEval |
| Evaluate copy quality and clarity | **Medium (~60%)** | GPT-4o vs Experts |
| Assess persuasion technique usage | **Medium (~55%)** | Requires context understanding |

### 0.2 What LLM Analysis CANNOT Do (Unreliably)

| Capability | Reliability | Source | What We Do Instead |
|-----------|------------|--------|-------------------|
| Predict conversion impact | **Low (<30%)** | WiserUI-Bench | State heuristic violation + research backing. Never predict numbers. |
| Assign reliable severity scores | **Low (~56% agreement)** | GPT-4o vs Experts | Severity tied to measurable evidence, not LLM opinion. |
| Evaluate ease of use | **Low (~40%)** | MLLM UI Judge | Tag as Tier 3, require consultant review. |
| Assess emotional response | **Low (<35%)** | MLLM UI Judge | Tag as Tier 3, require consultant review. |
| Match human expert findings | **Low (21.2% overlap)** | GPT-4o vs Experts | Treat findings as hypotheses. Evidence grounding validates. |

### 0.3 Core Design Principle

> **The analysis agent produces HYPOTHESES, not VERDICTS. Every finding must survive three filters (CoT generation, self-critique review, code-level evidence grounding) before reaching a client. The system's job is to surface probable issues for human experts to validate, not to replace human judgment.**

---

## Section 1 — Architecture Decisions

### 1.1 Locked Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| AA-01 | **5-step pipeline** (perceive → evaluate → self-critique → ground → annotate) | Three-layer hallucination filter: CoT (~50%), self-critique (~30%), evidence grounding (~95%) |
| AA-02 | **Chain-of-thought prompting** for evaluation | Berkeley CHI 2024: structured reasoning reduces hallucination |
| AA-03 | **Self-critique as separate LLM call** | LLM is better at critiquing than generating. Separate call prevents confirmation bias. |
| AA-04 | **Evidence grounding is deterministic code, NOT LLM** | Code validates facts (element exists, measurement matches). LLMs validate reasoning. Different jobs. |
| AA-05 | **Heuristics injected into user message** | System prompt is static (cached). Heuristics change per page type → user message. Not a tool call (no extra round-trip). |
| AA-06 | **Never predict conversion impact** | WiserUI-Bench: LLMs cannot predict which UI converts better. State violations, cite research, recommend fixes. |
| AA-07 | **Pairwise comparison for competitors** | MLLM UI Judge: LLMs are significantly better at "A vs B" than absolute scoring. |
| AA-08 | **3 reliability tiers on heuristics** | MLLM UI Judge: visual/structural >75% reliable, interaction/emotional <40%. Tier determines auto-publish eligibility. |
| AA-09 | **Heuristic KB is encrypted, never exposed** | REO's IP. Compiled at build time, held in memory, never in API responses or client dashboard. |
| AA-10 | **Findings are immutable once grounded** | After evidence grounding, finding content doesn't change. Consultant can approve/reject/edit a COPY, original preserved for audit trail. |

### 1.2 Deferred Decisions

| # | Decision | Defer Until |
|---|----------|-------------|
| DA-01 | Vector search for heuristic retrieval | When heuristic count exceeds 500 |
| DA-02 | Multi-model evaluation (use different LLMs for evaluate vs critique) | After MVP validation |
| DA-03 | Custom fine-tuned model for CRO evaluation | After collecting 1,000+ grounded findings for training data |
| DA-04 | Automated heuristic weight calibration | After 6 months of consultant feedback data |

---

## Section 2 — Analysis Pipeline Graph

### 2.1 Graph Topology

**REQ-ANALYSIS-GRAPH-001:**

```
┌────────────┐    ┌──────────┐    ┌───────────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
│   START    │───→│ deep_    │───→│   evaluate    │───→│  self_   │───→│  ground  │───→│annotate │
│            │    │ perceive │    │   (CoT)       │    │ critique │    │          │    │ + store │
└────────────┘    └──────────┘    └───────┬───────┘    └────┬─────┘    └────┬─────┘    └────┬────┘
                                          │                  │              │              │
                                          │           ┌──────┘              │              │
                                          │           │                     │              │
                                          │    (retry if malformed)         │              │
                                          │           │                     │              │
                                          ▼           ▼                     ▼              ▼
                                   ┌─────────────────────────────────────────────────────────┐
                                   │                       END                                │
                                   │  Output: GroundedFindings[] + AnnotatedScreenshots[]     │
                                   └─────────────────────────────────────────────────────────┘
```

### 2.2 Edge Specifications

**REQ-ANALYSIS-EDGE-001:** `routeAfterEvaluate`:
```typescript
function routeAfterEvaluate(state: AnalysisState): "self_critique" | "retry_evaluate" | "end" {
  // Did the LLM return valid JSON findings?
  if (!state.raw_findings || !Array.isArray(state.raw_findings)) {
    if (state.evaluate_retry_count < 2) return "retry_evaluate";
    return "end";  // give up after 2 retries, log failure
  }
  if (state.raw_findings.length === 0) return "end";  // no findings = clean page
  return "self_critique";
}
```

**REQ-ANALYSIS-EDGE-002:** `routeAfterCritique`:
```typescript
function routeAfterCritique(state: AnalysisState): "ground" | "end" {
  if (!state.reviewed_findings || state.reviewed_findings.length === 0) return "end";
  return "ground";
}
```

**REQ-ANALYSIS-EDGE-003:** `routeAfterGround`:
```typescript
function routeAfterGround(state: AnalysisState): "annotate" | "end" {
  if (!state.grounded_findings || state.grounded_findings.length === 0) return "end";
  return "annotate";
}
```

---

## Section 3 — State Schema

### 3.1 AnalysisState

**REQ-ANALYSIS-STATE-001:**

```typescript
export const AnalysisState = Annotation.Root({
  // === Context (set by audit orchestrator before analysis subgraph runs) ===
  current_url: Annotation<string>(),
  current_page_type: Annotation<string>(),           // "homepage" | "product" | "checkout" | "form" | "landing" | "pricing" | "category" | "other"
  business_type: Annotation<string>(),               // "ecommerce" | "saas" | "leadgen" | "marketplace" | "media"
  client_id: Annotation<string>(),
  audit_run_id: Annotation<string>(),
  session_id: Annotation<string>(),

  // === Heuristics (filtered by orchestrator) ===
  filtered_heuristics: Annotation<Heuristic[]>(),    // 15-20 relevant heuristics for this page
  heuristic_count: Annotation<number>(),

  // === Perception (Step 1 output) ===
  analyze_perception: Annotation<AnalyzePerception | null>(),
  viewport_screenshot: Annotation<string | null>(),  // base64
  fullpage_screenshot: Annotation<string | null>(),  // base64
  page_type_detected: Annotation<string>(),          // auto-detected page type (may differ from provided)

  // === Evaluation (Step 2 output) ===
  raw_findings: Annotation<RawFinding[]>({
    reducer: (_, incoming) => incoming                // replace, not append
  }),
  evaluate_retry_count: Annotation<number>({ default: 0 }),
  evaluate_token_count: Annotation<number>(),        // track token usage

  // === Self-Critique (Step 3 output) ===
  reviewed_findings: Annotation<ReviewedFinding[]>({
    reducer: (_, incoming) => incoming
  }),
  critique_summary: Annotation<CritiqueSummary | null>(),
  critique_token_count: Annotation<number>(),

  // === Evidence Grounding (Step 4 output) ===
  grounded_findings: Annotation<GroundedFinding[]>({
    reducer: (_, incoming) => incoming
  }),
  rejected_findings: Annotation<RejectedFinding[]>({
    reducer: (_, incoming) => incoming
  }),

  // === Annotation (Step 5 output) ===
  annotated_screenshots: Annotation<AnnotatedScreenshot[]>({
    reducer: (existing, incoming) => [...existing, ...incoming]
  }),

  // === Cost tracking ===
  analysis_cost_usd: Annotation<number>({ default: 0 }),
  analysis_budget_usd: Annotation<number>({ default: 5.0 }),  // per page

  // === Status ===
  analysis_complete: Annotation<boolean>({ default: false }),
  analysis_error: Annotation<string | null>(),
  steps_completed: Annotation<string[]>({
    reducer: (existing, incoming) => [...existing, ...incoming]
  }),
});
```

### 3.2 State Invariants

**REQ-ANALYSIS-STATE-INV-001:** `filtered_heuristics.length` SHALL be between 1 and 30. If 0, analysis cannot proceed.

**REQ-ANALYSIS-STATE-INV-002:** `analysis_cost_usd` SHALL NEVER exceed `analysis_budget_usd`. If budget exhausted, skip remaining steps, mark as budget_exceeded.

**REQ-ANALYSIS-STATE-INV-003:** `grounded_findings` SHALL be a subset of `reviewed_findings`. No finding can be grounded without passing self-critique.

**REQ-ANALYSIS-STATE-INV-004:** Every `grounded_finding` SHALL have `evidence_verified === true`.

**REQ-ANALYSIS-STATE-INV-005:** `rejected_findings.length + grounded_findings.length` SHALL equal `reviewed_findings.length` (after filtering REJECT verdicts from self-critique).

---

## Section 4 — Node Specifications

### 4.1 Node: `deep_perceive`

**REQ-ANALYSIS-NODE-001:**

| | |
|---|---|
| **Input** | `current_url`, browser page context (from browse subgraph) |
| **Output** | `analyze_perception`, `viewport_screenshot`, `fullpage_screenshot`, `page_type_detected` |
| **Precondition** | Browse subgraph exited successfully. Page is stable (`pending_mutations === 0`). |
| **Postcondition** | `analyze_perception` has all sections populated. Both screenshots are non-null. |
| **Invariant** | `analyze_perception.metadata.url === current_url` |
| **Tools used** | `page_analyze()`, `browser_screenshot()`, `page_screenshot_full()` |
| **Error handling** | If `page_analyze()` fails, retry once. If still fails, capture screenshot-only fallback + mark `analysis_error`. |

**Implementation detail:**

```typescript
async function deepPerceive(state: AnalysisState, context: BrowserContext): Promise<Partial<AnalysisState>> {
  // 1. Full page scan — single comprehensive DOM evaluation
  const perception = await tools.page_analyze({
    sections: ["structure", "content", "ctas", "forms", "trust", "layout", "images", "navigation", "performance"]
  });

  // 2. Auto-detect page type from content
  const detectedType = detectPageType(perception);

  // 3. Viewport screenshot (what user sees first)
  const viewport = await tools.browser_screenshot({ quality: 85 });

  // 4. Full page screenshot (entire scrollable content)
  const fullpage = await tools.page_screenshot_full({ quality: 80, maxHeight: 15000 });

  return {
    analyze_perception: perception,
    viewport_screenshot: viewport.imageBase64,
    fullpage_screenshot: fullpage.imageBase64,
    page_type_detected: detectedType,
    steps_completed: ["deep_perceive"],
  };
}
```

**`detectPageType` logic:**

```typescript
function detectPageType(perception: AnalyzePerception): string {
  const url = perception.metadata.url.toLowerCase();
  const text = perception.textContent.paragraphs.map(p => p.text).join(" ").toLowerCase();
  const hasCart = perception.ctas.some(c => c.text.toLowerCase().includes("add to cart"));
  const hasCheckout = url.includes("checkout") || url.includes("cart") || text.includes("order summary");
  const hasPricing = url.includes("pricing") || url.includes("plans") || text.includes("per month");
  const hasSignup = perception.forms.some(f => f.submitButtonText.toLowerCase().includes("sign up"));
  const isHomepage = url.endsWith("/") || url.endsWith(".com") || url.endsWith(".in");

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

### 4.2 Node: `evaluate`

**REQ-ANALYSIS-NODE-002:**

| | |
|---|---|
| **Input** | `analyze_perception`, `filtered_heuristics`, `current_page_type`, `business_type` |
| **Output** | `raw_findings[]`, `evaluate_token_count` |
| **Precondition** | `analyze_perception` is non-null. `filtered_heuristics.length > 0`. |
| **Postcondition** | Every `raw_finding` has: `heuristic_id`, `status`, `observation`, `assessment`, `evidence`, `severity`, `recommendation`. |
| **Invariant** | `raw_findings` only reference `heuristic_id` values present in `filtered_heuristics`. No finding contains conversion predictions. |
| **LLM call** | 1 call. ~10,000 input tokens. Expected output: ~2,000-4,000 tokens. |
| **Error handling** | If LLM returns malformed JSON, retry up to 2 times with simplified prompt. If still fails, mark `analysis_error`. |

**System prompt (STATIC — cached):**

```
You are a CRO analyst. Your role is to evaluate web pages against usability
heuristics and identify friction points.

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

**User message template:**

```
PAGE DATA:
URL: {{current_url}}
Page type: {{page_type_detected}}
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
Whitespace ratio: {{analyze_perception.layout.whitespaceRatio}}

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
Resources: {{analyze_perception.performance.resourceCount}}

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
    "element_selector": "CSS selector if identifiable from data",
    "data_point": "which section above proves this (e.g., 'ctas[0]', 'forms[0].fieldCount')",
    "measurement": "exact number/position from the data (e.g., 'y:1400, viewport:800 → below fold')"
  },
  "severity": "critical" | "high" | "medium" | "low",
  "confidence_basis": "what measurable evidence supports this severity",
  "recommendation": "specific, actionable fix",
  "needs_review": boolean
}

Return an array of results, one per heuristic. Include both violations AND passes.
```

**Output schema (Zod):**

```typescript
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

### 4.3 Node: `self_critique`

**REQ-ANALYSIS-NODE-003:**

| | |
|---|---|
| **Input** | `raw_findings[]` (violations only — passes are filtered out), `analyze_perception` |
| **Output** | `reviewed_findings[]`, `critique_summary`, `critique_token_count` |
| **Precondition** | `raw_findings` has at least 1 finding with `status === "violation"` or `status === "needs_review"`. |
| **Postcondition** | Every `reviewed_finding` has a `verdict`: KEEP, REVISE, DOWNGRADE, or REJECT. Rejected findings removed from `reviewed_findings`. |
| **Invariant** | `reviewed_findings.length <= raw_findings.filter(f => f.status !== "pass").length`. |
| **LLM call** | 1 call. ~6,000 input tokens (findings + page data, NO heuristics). Expected output: ~1,000-2,000 tokens. |

**System prompt (STATIC):**

```
You are a senior CRO quality reviewer. You will receive CRO findings
generated by an analyst. Your job is to CHALLENGE each finding with
rigorous scrutiny.

For each finding:

1. VERIFY ELEMENT: Does the finding reference data that exists in the
   provided page data? If the page data contradicts the finding, REJECT.

2. CHECK SEVERITY: Is the severity proportional to the evidence?
   - "critical" requires MEASURABLE evidence (position data, field counts, etc.)
   - "high" requires clear element-level evidence
   - "medium" is appropriate for context-dependent issues
   - "low" is for subjective or minor observations
   If severity is inflated, DOWNGRADE with new severity.

3. CHECK LOGIC: Does the conclusion follow from the observation?
   Example of BAD logic: "Form has 4 fields → too many fields"
   (4 fields is fine for most forms — context matters)
   If logic is flawed, REJECT or REVISE.

4. CHECK CONTEXT: Does the finding account for the page type and business?
   A 10-field form is fine for a mortgage application but bad for a newsletter.
   If context is ignored, REVISE.

5. CHECK DUPLICATES: Are any two findings about the same issue?
   If so, MERGE into one finding.

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

**User message:**

```
ORIGINAL PAGE DATA:
{{analyze_perception — same data the analyst saw}}

FINDINGS TO REVIEW:
{{raw_findings.filter(f => f.status !== "pass") | json}}

Review each finding. Be harsh — it's better to reject a valid finding
than to let a hallucinated one through.
```

**Post-processing (code, not LLM):**

```typescript
function applyVerdicts(rawFindings: RawFinding[], verdicts: CritiqueVerdict[]): ReviewedFinding[] {
  const reviewed: ReviewedFinding[] = [];

  for (const verdict of verdicts) {
    const original = rawFindings[verdict.finding_index];
    if (!original) continue;

    switch (verdict.verdict) {
      case "KEEP":
        reviewed.push({ ...original, critique_verdict: "KEEP", critique_reason: verdict.reason });
        break;
      case "REVISE":
        reviewed.push({
          ...original,
          ...verdict.revised_finding,
          critique_verdict: "REVISE",
          critique_reason: verdict.reason,
          original_finding: original,  // preserve original for audit trail
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
        // NOT added to reviewed — effectively removed
        // Log for system improvement
        logRejection(original, verdict.reason);
        break;
    }
  }

  return reviewed;
}
```

**Critique summary:**

```typescript
interface CritiqueSummary {
  total_reviewed: number;
  kept: number;
  revised: number;
  downgraded: number;
  rejected: number;
  rejection_reasons: string[];  // why each finding was rejected — for system learning
}
```

---

### 4.4 Node: `ground`

**REQ-ANALYSIS-NODE-004:**

| | |
|---|---|
| **Input** | `reviewed_findings[]`, `analyze_perception` |
| **Output** | `grounded_findings[]`, `rejected_findings[]` |
| **Precondition** | `reviewed_findings.length > 0`. |
| **Postcondition** | Every `grounded_finding` has `evidence_verified === true`. Every `rejected_finding` has `rejection_reason`. |
| **Invariant** | No LLM calls. Purely deterministic code. |
| **Side effects** | Rejected findings logged for system improvement tracking. |

**Evidence grounding rules (exhaustive):**

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

  // RULE 1: Referenced element must exist
  {
    id: "GR-001",
    description: "Any element referenced in evidence must exist in page data",
    check: (finding, pageData) => {
      const ref = finding.evidence.element_ref;
      if (!ref) return { pass: true };  // no element reference = skip this check

      // Check in CTAs
      const inCTAs = pageData.ctas.some(c =>
        c.text.toLowerCase().includes(ref.toLowerCase())
      );
      // Check in forms
      const inForms = pageData.forms.some(f =>
        f.fields.some(field => field.label.toLowerCase().includes(ref.toLowerCase()))
        || f.submitButtonText.toLowerCase().includes(ref.toLowerCase())
      );
      // Check in trust signals
      const inTrust = pageData.trustSignals.some(t =>
        t.text.toLowerCase().includes(ref.toLowerCase())
      );
      // Check in navigation
      const inNav = pageData.navigation.primaryNavItems.some(n =>
        n.text.toLowerCase().includes(ref.toLowerCase())
      );
      // Check in headings
      const inHeadings = pageData.headingHierarchy.some(h =>
        h.text.toLowerCase().includes(ref.toLowerCase())
      );

      if (inCTAs || inForms || inTrust || inNav || inHeadings) return { pass: true };
      return { pass: false, reason: `Element "${ref}" not found in any page data section` };
    }
  },

  // RULE 2: "Above/below fold" claims must match bounding box data
  {
    id: "GR-002",
    description: "Above/below fold claims must match actual position data",
    check: (finding, pageData) => {
      const assessment = finding.assessment.toLowerCase();
      const isFoldClaim = assessment.includes("above fold") || assessment.includes("below fold");
      if (!isFoldClaim) return { pass: true };

      const ref = finding.evidence.element_ref;
      if (!ref) return { pass: true };  // can't verify without element ref

      // Find the element's position
      const cta = pageData.ctas.find(c => c.text.toLowerCase().includes(ref.toLowerCase()));
      if (!cta) return { pass: true };  // element not a CTA, can't verify fold position

      const claimsBelow = assessment.includes("below fold") || assessment.includes("below the fold");
      const claimsAbove = assessment.includes("above fold") || assessment.includes("above the fold");

      if (claimsBelow && cta.isAboveFold) {
        return { pass: false, reason: `Claims "${ref}" is below fold, but bounding box shows isAboveFold=true` };
      }
      if (claimsAbove && !cta.isAboveFold) {
        return { pass: false, reason: `Claims "${ref}" is above fold, but bounding box shows isAboveFold=false` };
      }
      return { pass: true };
    }
  },

  // RULE 3: Form field count claims must match actual data
  {
    id: "GR-003",
    description: "Form field count claims must match actual form data",
    check: (finding, pageData) => {
      const measurement = finding.evidence.measurement;
      if (!measurement) return { pass: true };

      // Extract claimed field count
      const fieldCountMatch = measurement.match(/(\d+)\s*(fields|field|required)/i);
      if (!fieldCountMatch) return { pass: true };

      const claimedCount = parseInt(fieldCountMatch[1]);
      const isRequiredClaim = measurement.toLowerCase().includes("required");

      // Check against actual forms
      for (const form of pageData.forms) {
        const actualCount = isRequiredClaim ? form.requiredFieldCount : form.fieldCount;
        if (Math.abs(claimedCount - actualCount) > 1) {
          return { pass: false, reason: `Claims ${claimedCount} ${isRequiredClaim ? 'required ' : ''}fields, actual is ${actualCount}` };
        }
      }
      return { pass: true };
    }
  },

  // RULE 4: Contrast ratio claims must be verifiable
  {
    id: "GR-004",
    description: "Color contrast claims must reference actual computed styles",
    check: (finding, pageData) => {
      const assessment = finding.assessment.toLowerCase();
      if (!assessment.includes("contrast")) return { pass: true };

      // If claiming contrast issue, must reference a CTA or text element with computed styles
      const ref = finding.evidence.element_ref;
      if (!ref) return { pass: false, reason: "Claims contrast issue but doesn't reference specific element" };

      const cta = pageData.ctas.find(c => c.text.toLowerCase().includes(ref.toLowerCase()));
      if (cta && cta.computedStyles && cta.computedStyles.contrastRatio !== undefined) {
        return { pass: true };  // has actual contrast data to check
      }
      return { pass: true };  // can't verify, let it through (conservative)
    }
  },

  // RULE 5: Heuristic ID must be valid
  {
    id: "GR-005",
    description: "heuristic_id must match a known heuristic",
    check: (finding, pageData) => {
      // This check uses the filtered_heuristics from state, not pageData
      // Handled separately in the grounding function
      return { pass: true };  // placeholder — actual check in grounding function
    }
  },

  // RULE 6: Severity must be proportional to evidence type
  {
    id: "GR-006",
    description: "Critical/high severity requires measurable evidence, not subjective claims",
    check: (finding, pageData) => {
      if (finding.severity !== "critical" && finding.severity !== "high") return { pass: true };

      // Critical/high must have a measurement
      if (!finding.evidence.measurement && !finding.evidence.data_point) {
        return { pass: false, reason: `Severity "${finding.severity}" requires measurable evidence, but no measurement or data_point provided` };
      }
      return { pass: true };
    }
  },

  // RULE 7: No conversion predictions
  {
    id: "GR-007",
    description: "Finding must not contain conversion predictions",
    check: (finding, pageData) => {
      const text = `${finding.assessment} ${finding.recommendation}`.toLowerCase();
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

  // RULE 8: Data point reference must be valid
  {
    id: "GR-008",
    description: "data_point must reference a real section of AnalyzePerception",
    check: (finding, pageData) => {
      const validSections = [
        "ctas", "forms", "trustSignals", "layout", "textContent",
        "headingHierarchy", "navigation", "images", "performance",
        "semanticHTML", "landmarks"
      ];
      const dp = finding.evidence.data_point;
      if (!dp) return { pass: true };

      // Extract section name (e.g., "ctas[0]" → "ctas")
      const section = dp.split(/[\[.]/)[0];
      if (!validSections.includes(section)) {
        return { pass: false, reason: `data_point "${dp}" references unknown section "${section}"` };
      }
      return { pass: true };
    }
  },
];
```

**Grounding function:**

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
    // Check heuristic ID validity
    if (!validHeuristicIds.has(finding.heuristic_id)) {
      rejected.push({ ...finding, rejection_reason: `Unknown heuristic_id: ${finding.heuristic_id}`, rejected_by: "GR-005" });
      continue;
    }

    // Run all grounding rules
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
      // Assign confidence tier based on heuristic reliability + evidence strength
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

function assignConfidenceTier(
  finding: ReviewedFinding,
  heuristic: Heuristic,
  pageData: AnalyzePerception
): "high" | "medium" | "low" {
  // Tier determined by intersection of heuristic reliability and evidence strength

  const heuristicTier = heuristic.reliability_tier;  // 1, 2, or 3
  const hasMeasurement = !!finding.evidence.measurement;
  const hasElementRef = !!finding.evidence.element_ref;

  // Heuristic Tier 1 (visual/structural) + measurable evidence = high confidence
  if (heuristicTier === 1 && hasMeasurement) return "high";

  // Heuristic Tier 1 + element ref but no measurement = medium
  if (heuristicTier === 1 && hasElementRef) return "medium";

  // Heuristic Tier 2 (content/persuasion) + any evidence = medium
  if (heuristicTier === 2 && (hasMeasurement || hasElementRef)) return "medium";

  // Heuristic Tier 3 (interaction/emotional) = always low
  if (heuristicTier === 3) return "low";

  // Anything else = low
  return "low";
}
```

---

### 4.5 Node: `annotate_and_store`

**REQ-ANALYSIS-NODE-005:**

| | |
|---|---|
| **Input** | `grounded_findings[]`, `viewport_screenshot`, `fullpage_screenshot`, `audit_run_id`, `client_id` |
| **Output** | `annotated_screenshots[]`, findings + screenshots persisted to DB |
| **Precondition** | `grounded_findings.length >= 0`. Screenshots non-null. |
| **Postcondition** | All findings in DB. All screenshots (clean + annotated) saved to storage. Audit run progress updated. |
| **Invariant** | No LLM calls. Code-only (rendering + DB writes). |
| **Side effects** | Review gate applied. Tier 1 findings published. Tier 2 queued with 24hr delay. Tier 3 held for review. |

**Annotation rendering specification:**

```typescript
interface AnnotationSpec {
  // Pin marker
  pinSize: 28;                      // diameter in pixels
  pinShape: "circle";               // circle with number inside
  pinFontSize: 14;                  // finding number font size
  pinFontWeight: "bold";
  pinFontColor: "#FFFFFF";

  // Severity colors
  colors: {
    critical: "#DC2626";            // red-600
    high: "#EA580C";                // orange-600
    medium: "#CA8A04";              // yellow-600
    low: "#2563EB";                 // blue-600
  };

  // Pin border
  pinBorderWidth: 2;
  pinBorderColor: "#FFFFFF";

  // Label
  labelFontSize: 11;
  labelMaxWidth: 200;               // pixels
  labelBackground: "rgba(0,0,0,0.85)";
  labelPadding: 4;
  labelBorderRadius: 4;
  labelColor: "#FFFFFF";

  // Label format: "F-01: CTA below fold"
  labelTemplate: "F-{{number}}: {{name}}";

  // Positioning
  labelOffset: { x: 16, y: -8 };   // offset from pin center
  overlapAvoidance: true;           // shift labels to avoid overlapping

  // Connection line (pin to element)
  connectionLine: {
    show: true;
    color: "rgba(255,255,255,0.4)";
    width: 1;
    style: "dashed";
  };
}
```

**Annotation placement logic:**

```typescript
function calculateAnnotationPositions(
  findings: GroundedFinding[],
  screenshotDimensions: { width: number; height: number }
): AnnotationPosition[] {
  const positions: AnnotationPosition[] = [];

  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i];
    let position: { x: number; y: number };

    if (finding.boundingBox) {
      // Place pin at top-right corner of the element's bounding box
      position = {
        x: Math.min(finding.boundingBox.x + finding.boundingBox.width, screenshotDimensions.width - 30),
        y: Math.max(finding.boundingBox.y, 15),
      };
    } else {
      // No bounding box — place in margin with arrow pointing to general area
      position = {
        x: screenshotDimensions.width - 40,
        y: 50 + (i * 50),  // stack vertically in right margin
      };
    }

    // Overlap avoidance
    for (const existing of positions) {
      const dist = Math.sqrt((position.x - existing.x) ** 2 + (position.y - existing.y) ** 2);
      if (dist < 35) {
        position.y += 40;  // shift down
      }
    }

    positions.push({
      findingIndex: i + 1,
      findingId: finding.heuristic_id,
      ...position,
      severity: finding.severity,
      label: `F-${String(i + 1).padStart(2, '0')}: ${finding.name}`,
    });
  }

  return positions;
}
```

**Storage operations:**

```typescript
async function storeResults(
  findings: GroundedFinding[],
  screenshots: AnnotatedScreenshot[],
  auditRunId: string,
  clientId: string,
  storage: StorageAdapter,
  screenshotStore: ScreenshotStorage
): Promise<void> {

  // 1. Save screenshots to storage (R2/local)
  for (const ss of screenshots) {
    const cleanPath = await screenshotStore.save(
      Buffer.from(ss.cleanImage, 'base64'),
      `${auditRunId}/${ss.page_url}/${ss.type}_clean.jpg`
    );
    const annotatedPath = await screenshotStore.save(
      Buffer.from(ss.annotatedImage, 'base64'),
      `${auditRunId}/${ss.page_url}/${ss.type}_annotated.jpg`
    );
    ss.cleanImagePath = cleanPath;
    ss.annotatedImagePath = annotatedPath;
  }

  // 2. Save findings to DB with review gate status
  for (const finding of findings) {
    await storage.saveFinding({
      ...finding,
      audit_run_id: auditRunId,
      client_id: clientId,
      publish_status: finding.auto_publish ? "published"
                     : finding.publish_delay_hours > 0 ? "delayed"
                     : "held",
      published_at: finding.auto_publish ? new Date() : null,
      publish_at: finding.publish_delay_hours > 0
                  ? new Date(Date.now() + finding.publish_delay_hours * 3600000)
                  : null,
    });
  }

  // 3. Save screenshot records to DB
  for (const ss of screenshots) {
    await storage.saveScreenshotRecord({
      audit_run_id: auditRunId,
      client_id: clientId,
      page_url: ss.page_url,
      type: ss.type,
      clean_path: ss.cleanImagePath,
      annotated_path: ss.annotatedImagePath,
    });
  }

  // 4. Update audit run progress
  await storage.updateAuditRunProgress(auditRunId, {
    pages_crawled_increment: 1,
    findings_count_increment: findings.length,
  });
}
```

---

## Section 5 — Analysis Tool Manifest

### 5.1 Tools (5 analysis-specific, supplement v3.1's 23 browse tools)

**REQ-ANALYSIS-TOOL-001:**

| # | Tool Name | Description | Safety Class | Params | Returns |
|---|-----------|-------------|-------------|--------|---------|
| 24 | `page_get_element_info` | Get element position, dimensions, computed styles | safe | `{ selector: string; properties?: string[] }` | `{ boundingBox, isAboveFold, computedStyles, contrastRatio? }` |
| 25 | `page_get_performance` | Get page performance metrics | safe | `{}` | `{ domContentLoaded, fullyLoaded, resourceCount, totalTransferSize, lcp? }` |
| 26 | `page_screenshot_full` | Full-page scrollable screenshot | safe | `{ quality?: number; maxHeight?: number }` | `{ imageBase64, width, height }` |
| 27 | `page_annotate_screenshot` | Overlay finding markers on screenshot | safe | `{ screenshotBase64, annotations[] }` | `{ annotatedImageBase64 }` |
| 28 | `page_analyze` | Comprehensive single-call page scan | safe | `{ sections: string[] }` | `AnalyzePerception` |

### 5.2 Full TypeScript Interfaces

```typescript
// Tool 24
interface PageGetElementInfoParams {
  selector: string;
  properties?: string[];
}
interface PageGetElementInfoResult {
  boundingBox: { x: number; y: number; width: number; height: number };
  isAboveFold: boolean;
  computedStyles: Record<string, string>;
  contrastRatio?: number;
}

// Tool 25
interface PageGetPerformanceParams {}
interface PageGetPerformanceResult {
  domContentLoaded: number;
  fullyLoaded: number;
  resourceCount: number;
  totalTransferSize: number;
  largestContentfulPaint?: number;
}

// Tool 26
interface PageScreenshotFullParams {
  quality?: number;     // 1-100, default 80
  maxHeight?: number;   // pixels, default 15000
}
interface PageScreenshotFullResult {
  imageBase64: string;
  width: number;
  height: number;
}

// Tool 27
interface PageAnnotateScreenshotParams {
  screenshotBase64: string;
  annotations: Array<{
    id: string;
    type: "pin" | "box" | "arrow";
    position: { x: number; y: number };
    dimensions?: { width: number; height: number };
    label: string;
    severity: "critical" | "high" | "medium" | "low";
    color?: string;
  }>;
}
interface PageAnnotateScreenshotResult {
  annotatedImageBase64: string;
}

// Tool 28
interface PageAnalyzeParams {
  sections: Array<
    "structure" | "content" | "ctas" | "forms" |
    "trust" | "layout" | "images" | "navigation" | "performance"
  >;
}
type PageAnalyzeResult = AnalyzePerception;
```

### 5.3 `page_analyze` Implementation Detail

**REQ-ANALYSIS-TOOL-002:** `page_analyze` SHALL execute a single Playwright `page.evaluate()` call that collects all requested sections in one DOM traversal. It SHALL NOT make multiple `evaluate()` calls.

```typescript
// Pseudocode for the injected script
async function pageAnalyze(page: Page, sections: string[]): Promise<AnalyzePerception> {
  return await page.evaluate((requestedSections) => {
    const result: any = { metadata: { url: location.href, title: document.title, timestamp: Date.now(), viewport: { width: window.innerWidth, height: window.innerHeight } } };

    if (requestedSections.includes("structure")) {
      // Collect all headings
      result.headingHierarchy = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent.trim().substring(0, 100),
        isAboveFold: h.getBoundingClientRect().top < window.innerHeight,
      }));
      // Collect landmarks
      result.landmarks = Array.from(document.querySelectorAll("[role], main, nav, footer, aside, header")).map(el => ({
        role: el.getAttribute("role") || el.tagName.toLowerCase(),
        label: el.getAttribute("aria-label") || "",
      }));
      // Semantic HTML checks
      result.semanticHTML = {
        hasMain: !!document.querySelector("main"),
        hasNav: !!document.querySelector("nav"),
        hasFooter: !!document.querySelector("footer"),
        formCount: document.querySelectorAll("form").length,
        tableCount: document.querySelectorAll("table").length,
      };
    }

    if (requestedSections.includes("ctas")) {
      result.ctas = Array.from(document.querySelectorAll("a[href], button, [role='button'], input[type='submit']"))
        .filter(el => {
          const rect = el.getBoundingClientRect();
          const styles = window.getComputedStyle(el);
          return rect.width > 40 && rect.height > 20 && styles.display !== "none" && styles.visibility !== "hidden";
        })
        .slice(0, 20)  // max 20 CTAs
        .map(el => {
          const rect = el.getBoundingClientRect();
          const styles = window.getComputedStyle(el);
          return {
            text: el.textContent.trim().substring(0, 80),
            type: classifyCTAType(el, styles),
            isAboveFold: rect.top < window.innerHeight,
            boundingBox: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
            computedStyles: {
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              fontSize: styles.fontSize,
              padding: styles.padding,
              contrastRatio: calculateContrastRatio(styles.color, styles.backgroundColor),
            },
            surroundingContext: getSurroundingText(el, 50),
          };
        });
    }

    // ... similar blocks for forms, trust, layout, images, navigation, performance ...

    return result;
  }, sections);
}
```

---

## Section 6 — Heuristic Knowledge Base Specification

### 6.1 Schema (Zod)

**REQ-HEURISTIC-SCHEMA-001:**

```typescript
const HeuristicSchema = z.object({
  id: z.string().regex(/^[A-Z]{2,8}-[A-Z]+-\d{3}$/),  // e.g., "BAY-CHECKOUT-001"
  source: z.enum(["baymard", "nielsen", "cialdini"]),
  category: z.string(),
  name: z.string().max(80),
  severity_if_violated: z.enum(["critical", "high", "medium", "low"]),

  reliability_tier: z.enum([1, 2, 3]),
  reliability_note: z.string(),

  detection: z.object({
    pageTypes: z.array(z.string()).min(1),
    businessTypes: z.array(z.string()).optional(),  // omit = all business types
    lookFor: z.string().min(20),
    positiveSignals: z.array(z.string()),
    negativeSignals: z.array(z.string()),
    dataPoints: z.array(z.string()).min(1),
    evidenceType: z.enum(["measurable", "observable", "subjective"]),
  }),

  recommendation: z.object({
    summary: z.string().max(120),
    details: z.string(),
    researchBacking: z.string(),
  }),
});

const HeuristicKnowledgeBaseSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  sources: z.array(z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().url(),
  })),
  heuristics: z.array(HeuristicSchema),
});
```

### 6.2 Validation Rules

**REQ-HEURISTIC-VALID-001:** Every heuristic SHALL pass Zod validation before being loaded.

**REQ-HEURISTIC-VALID-002:** `dataPoints` SHALL only reference valid AnalyzePerception sections: `ctas`, `forms`, `trustSignals`, `layout`, `textContent`, `headingHierarchy`, `navigation`, `images`, `performance`, `semanticHTML`, `landmarks`.

**REQ-HEURISTIC-VALID-003:** `pageTypes` SHALL only contain: `homepage`, `product`, `checkout`, `cart`, `form`, `landing`, `pricing`, `category`, `search`, `account`, `all`.

**REQ-HEURISTIC-VALID-004:** `businessTypes` (when present) SHALL only contain: `ecommerce`, `saas`, `leadgen`, `marketplace`, `media`, `fintech`, `healthcare`, `education`.

### 6.3 Filtering Logic

**REQ-HEURISTIC-FILTER-001:**

```typescript
function filterHeuristics(
  allHeuristics: Heuristic[],
  pageType: string,
  businessType: string
): Heuristic[] {
  return allHeuristics.filter(h => {
    const pageMatch = h.detection.pageTypes.includes(pageType)
                   || h.detection.pageTypes.includes("all");

    const businessMatch = !h.detection.businessTypes
                       || h.detection.businessTypes.length === 0
                       || h.detection.businessTypes.includes(businessType);

    return pageMatch && businessMatch;
  });
}
```

**REQ-HEURISTIC-FILTER-002:** Filtered set SHALL contain between 1 and 30 heuristics. If 0 after filtering, use `pageType = "all"` fallback. If > 30, prioritize by `reliability_tier` (Tier 1 first), then by `severity_if_violated`.

---

## Section 7 — Competitor Comparison

### 7.1 Comparison Node

**REQ-COMPARISON-001:** Competitor comparison runs AFTER both client and competitor sites have been analyzed. It is a separate step, NOT part of the per-page analysis pipeline.

**Comparison prompt template:**

```
You are comparing two websites on specific CRO dimensions.

CLIENT PAGE ({{client_page_type}}):
{{client_analyze_perception | selected_fields}}

COMPETITOR PAGE ({{competitor_page_type}}):
{{competitor_analyze_perception | selected_fields}}

Compare on these dimensions:
1. CTA placement and visibility
2. Trust signal usage and placement
3. Form design (if applicable)
4. Value proposition clarity (if homepage/landing)
5. Navigation structure
6. Social proof usage

For each dimension, respond with JSON:
{
  "dimension": "CTA placement",
  "client_observation": "specific observation with data",
  "competitor_observation": "specific observation with data",
  "assessment": "which does it better and why",
  "recommendation": "specific actionable suggestion for the client",
  "evidence": {
    "client_data_point": "e.g., ctas[0].isAboveFold = false",
    "competitor_data_point": "e.g., ctas[0].isAboveFold = true"
  }
}

Only compare dimensions that are relevant to both pages.
Do NOT assign scores or predict conversion impact.
```

### 7.2 Comparison Evidence Grounding

**REQ-COMPARISON-002:** Comparison findings go through the same evidence grounding rules as regular findings, but validated against BOTH page datasets (client + competitor).

---

## Section 8 — Cross-Page Consistency Analysis

### 8.1 Consistency Check Node

**REQ-CONSISTENCY-001:** After ALL pages of a site have been individually analyzed, run a cross-page consistency check.

**What gets compared:**

| Dimension | What to check | Example violation |
|-----------|--------------|-------------------|
| CTA styling | Same primary CTA style across all pages | Homepage CTA is orange button, checkout CTA is blue text link |
| Navigation | Same nav structure on all pages | Product page has different nav items than homepage |
| Color scheme | Consistent brand colors | Different background colors on different pages |
| Font usage | Consistent typography | Different heading fonts across pages |
| Trust signal placement | Consistent trust signal positioning | Reviews on product page but not checkout |
| Footer content | Same footer across pages | Different footer links on different pages |

**Prompt:**
```
You have analyzed {{page_count}} pages of the same website.
Here is a summary of each page's key elements:

{{for each page: url, ctas_summary, navigation_summary, colors_summary}}

Identify any INCONSISTENCIES across pages. Only flag genuine
inconsistencies that could confuse users, not intentional
page-specific differences.
```

---

## Section 9 — Finding Lifecycle State Machine

**REQ-LIFECYCLE-001:**

```
                    ┌──────────┐
                    │ GENERATED│  (by evaluate node)
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │ CRITIQUED│  (by self_critique node)
                    └────┬─────┘
                    │    │    │
             REJECT │    │    │ KEEP/REVISE/DOWNGRADE
                    ▼    │    │
              ┌──────┐   │    │
              │DEAD  │   │    ▼
              │(log) │   │  ┌──────────┐
              └──────┘   │  │ GROUNDED │  (by ground node)
                         │  └────┬─────┘
                    REJECT│ │    │    │
                         ▼ │    │    │
                   ┌──────┐│    │    │
                   │DEAD  ││    │    │
                   │(log) │▼    ▼    ▼
                   └──────┘
                         ┌──────────────────────┐
                         │ REVIEW GATE           │
                         │                       │
                         │ Tier 1 → PUBLISHED    │
                         │ Tier 2 → DELAYED (24h)│
                         │ Tier 3 → HELD         │
                         └───┬────────┬────┬─────┘
                             │        │    │
                             ▼        ▼    ▼
                    ┌──────────┐ ┌─────┐ ┌──────┐
                    │PUBLISHED │ │DELAY│ │ HELD │
                    │(client   │ │(24h)│ │(wait │
                    │ sees it) │ │     │ │ for  │
                    └──────────┘ └──┬──┘ │review│
                                   │    └──┬───┘
                              auto │       │ consultant
                              after│       │ action
                              24hr │       │
                                   ▼       ▼
                              ┌─────────────────┐
                              │ PUBLISHED or     │
                              │ REJECTED by      │
                              │ consultant       │
                              └─────────────────┘
```

**Finding status values:**

```typescript
type FindingStatus =
  | "generated"       // raw output from evaluate
  | "critiqued"       // passed self-critique
  | "grounded"        // passed evidence grounding
  | "published"       // visible to client
  | "delayed"         // waiting for 24hr hold to expire
  | "held"            // waiting for consultant review
  | "approved"        // consultant approved (same as published, but explicitly reviewed)
  | "rejected_critique"    // rejected by self-critique
  | "rejected_ground"      // rejected by evidence grounding
  | "rejected_consultant"  // rejected by consultant
```

---

## Section 10 — Failure Modes

| # | Failure Mode | Detection | Response |
|---|-------------|-----------|----------|
| AF-01 | **Hallucinated finding** | Evidence grounding rejects (element doesn't exist) | Finding killed. Logged for tracking. |
| AF-02 | **Inflated severity** | Self-critique downgrades OR grounding rejects (no measurable evidence for critical/high) | Downgrade severity or reject. |
| AF-03 | **Malformed LLM output** | Zod schema validation fails | Retry with simplified prompt (up to 2x). If still fails, mark page as `analysis_error`. |
| AF-04 | **LLM refuses to evaluate** | Empty response or "I cannot evaluate" | Retry once. If persists, mark all heuristics as `needs_review`, escalate. |
| AF-05 | **Wrong page type detection** | Orchestrator detects mismatch between provided and auto-detected type | Use auto-detected type. Log discrepancy. |
| AF-06 | **Heuristic KB load failure** | File missing, JSON parse error, Zod validation fails | Audit blocked. Cannot proceed without heuristics. Alert immediately. |
| AF-07 | **Screenshot annotation overlap** | Multiple findings at same position | Shift positions using overlap avoidance algorithm. |
| AF-08 | **Budget exceeded mid-analysis** | `analysis_cost_usd > analysis_budget_usd` | Skip remaining steps. Save partial results. Mark as `budget_exceeded`. |
| AF-09 | **Conversion prediction in output** | GR-007 grounding rule detects prediction phrases | Finding rejected. |
| AF-10 | **Context window exceeded** | Page data + heuristics > model context limit | Chunk: send top 10 heuristics first, then remaining in second call. Merge findings. |

---

## Section 11 — Rate Limits & Cost Control

### 11.1 Analysis Rate Limits

**REQ-ANALYSIS-RATE-001:**

| Scope | Limit | Rationale |
|-------|-------|-----------|
| Token budget per page | Max 15,000 input tokens | Prevents oversized prompts |
| Token budget per audit | Max 500,000 total tokens | Prevents runaway costs |
| LLM calls per page | Max 3 (evaluate + critique + 1 retry) | Bounded cost per page |
| Cost cap per audit | Default $15.00 (configurable) | Hard budget limit |
| Cost cap per page | Default $5.00 | Prevents single expensive page from consuming audit budget |
| Concurrent analysis | 1 page at a time | Sequential for simplicity |

### 11.2 Cost Tracking

**REQ-ANALYSIS-COST-001:**

```typescript
function trackCost(state: AnalysisState, llmResponse: LLMResponse): void {
  const cost = llmAdapter.getCostEstimate(llmResponse.inputTokens, llmResponse.outputTokens);
  state.analysis_cost_usd += cost.total_cost_usd;

  if (state.analysis_cost_usd > state.analysis_budget_usd) {
    state.analysis_error = "budget_exceeded";
    state.analysis_complete = true;
  }
}
```

---

## Section 12 — Implementation Phases

### Phase 6 — Heuristic Knowledge Base (Week 7-8)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 6.1 | Heuristic schema | `analysis/heuristics/schema.ts` | Zod validation on sample heuristic | Validates, rejects malformed |
| 6.2 | Heuristic loader | `analysis/heuristics/HeuristicLoader.ts` | Load all heuristics from JSON | 100 heuristics loaded, all pass validation |
| 6.3 | Page type filter | `analysis/heuristics/filter.ts` | `filter("checkout", "ecommerce")` | Returns 12-15 checkout-relevant heuristics |
| 6.4 | Business type filter | `analysis/heuristics/filter.ts` | `filter("homepage", "saas")` | Excludes ecommerce-only heuristics |
| 6.5 | Baymard heuristics | `heuristics-repo/baymard.json` | Zod validation | ~25 heuristics, all valid |
| 6.6 | Nielsen heuristics | `heuristics-repo/nielsen.json` | Zod validation | ~25 heuristics, all valid |
| 6.7 | Cialdini heuristics | `heuristics-repo/cialdini.json` | Zod validation | ~10 heuristics, all valid |
| 6.8 | Encryption wrapper | `analysis/heuristics/encryption.ts` | Encrypt + decrypt round-trip | Content matches after round-trip |
| 6.9 | Tier assignment validation | `analysis/heuristics/tierValidator.ts` | Check all heuristics have valid tier | No heuristic without reliability_tier |

**Exit Gate:**
- ✅ 100 heuristics loaded, all pass Zod validation
- ✅ Filtering returns 10-20 heuristics for any page type + business type combo
- ✅ No heuristic missing reliability_tier
- ✅ Encryption round-trip works

### Phase 7 — Analysis Pipeline (Week 8-10)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 7.1 | AnalysisState schema | `analysis/AnalysisState.ts` | Compile, serialize to JSON | All fields, defaults, invariants enforced |
| 7.2 | deep_perceive node | `analysis/nodes/DeepPerceiveNode.ts` | Scan amazon.in product page | AnalyzePerception populated, both screenshots captured |
| 7.3 | evaluate node | `analysis/nodes/EvaluateNode.ts` | Evaluate product page against 15 heuristics | 3-8 raw findings with valid JSON |
| 7.4 | self_critique node | `analysis/nodes/SelfCritiqueNode.ts` | Critique 5 raw findings | At least 1 rejected or downgraded |
| 7.5 | evidence grounder | `analysis/nodes/EvidenceGrounder.ts` | Ground 5 reviewed findings | At least 1 rejected for hallucination |
| 7.6 | 8 grounding rules | `analysis/grounding/rules/GR-001 through GR-008` | Unit test each rule | Each rule correctly accepts/rejects test cases |
| 7.7 | annotate node | `analysis/nodes/AnnotateNode.ts` | Annotate screenshot with 3 findings | Pins visible, colors correct, no overlap |
| 7.8 | store node | `analysis/nodes/StoreNode.ts` | Store 3 findings + 2 screenshots | Records in DB, files in storage |
| 7.9 | Analysis graph | `analysis/AnalysisGraph.ts` | Compile subgraph | All edges connected, compiles |
| 7.10 | page_analyze tool | `mcp/tools/pageAnalyze.ts` | Analyze bbc.com homepage | Returns full AnalyzePerception in single call |
| 7.11 | page_get_element_info tool | `mcp/tools/pageGetElementInfo.ts` | Get CTA info | Returns boundingBox, isAboveFold, styles |
| 7.12 | page_get_performance tool | `mcp/tools/pageGetPerformance.ts` | Get amazon.in performance | Returns DOMContentLoaded, fullyLoaded |
| 7.13 | page_screenshot_full tool | `mcp/tools/pageScreenshotFull.ts` | Full-page screenshot | Image < 2MB, captures full scroll |
| 7.14 | page_annotate_screenshot tool | `mcp/tools/pageAnnotateScreenshot.ts` | Annotate with 5 pins | Pins rendered, severity colors correct |
| 7.15 | detectPageType function | `analysis/utils/detectPageType.ts` | Detect amazon.in product page | Returns "product" |
| 7.16 | Cost tracker | `analysis/CostTracker.ts` | Track 3 LLM calls | Total cost accurate, budget check works |
| 7.17 | **Integration test** | `tests/integration/analysis-pipeline.test.ts` | Full pipeline on amazon.in product page | 3+ grounded findings, annotated screenshots, stored in DB |

**Exit Gate:**
- ✅ Full pipeline runs end-to-end on 3 different page types
- ✅ Self-critique rejects at least 1 finding per run (proving it works)
- ✅ Evidence grounding rejects at least 1 hallucinated finding per run
- ✅ Annotated screenshots render correctly with pins
- ✅ All findings stored in DB with correct publish status
- ✅ Cost tracking accurate, budget cap enforced

---

## Section 13 — AnalyzePerception Full Schema

**REQ-ANALYSIS-PERCEPTION-001:**

```typescript
interface AnalyzePerception {
  metadata: {
    url: string;
    title: string;
    timestamp: number;
    viewport: { width: number; height: number };
  };

  headingHierarchy: Array<{
    level: number;              // 1-6
    text: string;               // truncated to 100 chars
    isAboveFold: boolean;
  }>;

  landmarks: Array<{
    role: string;               // "navigation", "main", "footer", etc.
    label: string;              // aria-label if present
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
    readabilityScore: number;   // Flesch-Kincaid grade level
    primaryLanguage: string;
    paragraphs: Array<{
      text: string;             // truncated to 200 chars
      position: "above_fold" | "below_fold";
    }>;
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
    visualHierarchy: {
      primaryElement: string;
      secondaryElements: string[];
    };
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
  };
}
```

---

## Section 14 — Context Preservation

### 14.1 Engineering Constitution (Analysis-Specific)

1. **Findings are hypotheses, not verdicts.** Every finding must survive three filters.
2. **Evidence before assertion.** No finding without specific page data backing it.
3. **Never predict conversion.** State violations, cite research, recommend fixes.
4. **Tier determines trust level.** Visual/structural = auto-publish. Emotional = consultant review.
5. **Heuristics are secret.** Never exposed to clients, API, or dashboard.
6. **Self-critique is non-negotiable.** Even if it slows the pipeline by 2-3 seconds per page.

### 14.2 Session Handover Prompt

```
Project: REO Digital AI CRO Audit System — Analysis Agent v1.0
Companion: AI_Browser_Agent_Architecture_v3.1.md (browse mode)
Parent: Integrated_CRO_System_Architecture_v5.1.md (system level)

Analysis Pipeline: 5 steps
  1. deep_perceive: Full page scan + screenshots
  2. evaluate: LLM + CoT against filtered heuristics
  3. self_critique: LLM reviews its own findings
  4. ground: Code-level evidence validation (8 rules)
  5. annotate_and_store: Overlay pins + save to DB

Key numbers:
  28 tools total (23 browse + 5 analysis)
  100 heuristics (50 Baymard + 35 Nielsen + 15 Cialdini)
  3 reliability tiers (visual/structural, content/persuasion, interaction/emotional)
  8 grounding rules (GR-001 through GR-008)
  5 analysis-specific failure modes (AF-01 through AF-10)

Invariants:
  Every finding must pass self-critique AND evidence grounding
  No conversion predictions in any finding
  Heuristics never exposed to clients
  Severity tied to measurable evidence, not LLM opinion
```

---

**End of AI Analysis Agent Architecture v1.0**
