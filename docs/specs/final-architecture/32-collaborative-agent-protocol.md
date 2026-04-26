---
title: 32-collaborative-agent-protocol
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

# Section 32 — Collaborative Agent Protocol (Analysis ↔ Browse ↔ Web)

**Status:** Architectural extension. Addresses a fundamental limitation: the current analysis pipeline is passive — it evaluates pre-captured data but cannot gather its own evidence. Real CRO consultants interact, research, compare, then conclude. This section gives the Analysis Agent the ability to REQUEST evidence from the Browser Agent and the Web, without breaking the layer separation.

**Preserves REQ-LAYER-005:** Analysis still never imports Playwright or calls browser tools directly. It sends typed requests through a protocol; the orchestrator routes them to the appropriate agent.

---

## 32.1 The Problem

### How a human CRO consultant actually works

```
1. LOOK at the page                    → our deep_perceive does this
2. CLICK around to understand the UX   → our state exploration partially does this
3. WONDER "what happens if I..."       → ❌ NOBODY DOES THIS
4. RESEARCH best practices online      → ❌ NOBODY DOES THIS
5. CHECK competitor implementations    → ❌ NOBODY DOES THIS (competitor is a separate mode)
6. APPLY heuristic knowledge           → our evaluate does this
7. FORM an opinion with evidence       → our grounding does this
8. WRITE the finding                   → our annotate does this
```

Steps 3, 4, and 5 are missing. The analysis agent is BLIND beyond what state exploration pre-captures. It cannot:
- Ask "what happens if I click this suspicious CTA?"
- Look up "what's the Baymard research say about this pattern?"
- Check "how does the competitor handle this same flow?"
- Verify "is this price consistent with what Google Shopping shows?"

### What this costs us

| Missing capability | Finding quality impact |
|---|---|
| Can't verify interactions during analysis | "This CTA probably leads to..." instead of "This CTA leads to a 404" |
| Can't research best practices | Recommendations are generic instead of research-backed |
| Can't check competitors in-context | "Competitor may do better" instead of "Competitor shows reviews inline vs client's tab approach" |
| Can't verify external context | "Price seems high" instead of "Price is 40% above market average per Google Shopping" |

---

## 32.2 Solution: Evidence Request Protocol

### Core Principle

> **Analysis Agent can ASK for evidence. Browser Agent GATHERS it. The orchestrator ROUTES the request. Analysis never touches the browser directly.**

This is a principal-agent model: Analysis is the principal (decides what's needed), Browser is the agent (executes the gathering), the orchestrator is the message bus.

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    ANALYSIS AGENT (Layer 3)                       │
│                                                                   │
│  evaluate → self_critique → ground → score                       │
│       │            │                                              │
│       │    "I need more evidence"                                 │
│       │            │                                              │
│       ▼            ▼                                              │
│  ┌─────────────────────────────────┐                             │
│  │   EVIDENCE REQUEST PROTOCOL     │                             │
│  │                                 │                             │
│  │   Types:                        │                             │
│  │   • BrowserInteractionRequest   │ ──── "click this, tell me   │
│  │   • BrowserObservationRequest   │       what happens"         │
│  │   • WebSearchRequest            │ ──── "search for X"         │
│  │   • CompetitorCheckRequest      │ ──── "check competitor's    │
│  │   • ExternalDataRequest         │       version of this page" │
│  │                                 │                             │
│  └────────────────┬────────────────┘                             │
│                   │                                               │
└───────────────────┼───────────────────────────────────────────────┘
                    │ typed request
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Layer 1)                          │
│                                                                   │
│  Routes request to appropriate executor:                          │
│                                                                   │
│  BrowserInteractionRequest  →  Browser Agent (Layer 2)           │
│  BrowserObservationRequest  →  Browser Agent (read-only tools)   │
│  WebSearchRequest           →  Web Search Service                │
│  CompetitorCheckRequest     →  Competitor Browser Session        │
│  ExternalDataRequest        →  External API Adapter              │
│                                                                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │ evidence response
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ANALYSIS AGENT (continues)                     │
│                                                                   │
│  Receives evidence → incorporates into evaluation → continues     │
│  pipeline (critique → ground → score)                            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### What REQ-LAYER-005 becomes

**REQ-LAYER-005 (revised):** Layer 3 (Analysis Engine) SHALL never DIRECTLY control the browser. It SHALL NOT import Playwright, call browser tools, or hold browser session references. Layer 3 MAY request evidence from Layer 2 via the Evidence Request Protocol. The orchestrator mediates all requests. Layer 2 executes and returns typed evidence. Analysis processes evidence, never sessions.

---

## 32.3 Evidence Request Types

### Type 1: BrowserInteractionRequest

**Purpose:** "What happens if I interact with this element?"

The analysis agent notices something suspicious during evaluation and wants to know what happens when a user interacts with it — without pre-capturing every possible interaction during state exploration.

```typescript
interface BrowserInteractionRequest {
  type: "browser_interaction";
  request_id: string;

  // What to do
  interaction: {
    action: "click" | "hover" | "type" | "select" | "scroll_to";
    target: {
      element_ref?: string;        // AX ref from perception
      text_contains?: string;      // find by text
      selector?: string;           // CSS selector
    };
    value?: string;                // for type/select
  };

  // What to capture after interaction
  capture: {
    screenshot: boolean;
    perception: boolean;            // full AnalyzePerception
    specific_elements?: string[];   // only capture these sections
    network_requests?: boolean;     // did any XHR fire?
    url_after?: boolean;            // did URL change?
  };

  // Why (for audit trail)
  reason: string;                   // "Suspicious CTA — need to verify destination"
  requesting_heuristic_id?: string; // which heuristic triggered this request

  // Budget
  max_cost_usd: number;            // default $0.10 per request
  timeout_ms: number;               // default 10000
}
```

**Examples:**

| Analysis observes | Request | What it learns |
|---|---|---|
| CTA says "Free Trial" but looks like it might go to pricing | Click the CTA | URL changes to `/pricing` not `/trial` → misleading CTA finding |
| "Contact Us" form exists but unclear if it works | Submit the form with test data | Form submits but shows a 500 error → broken form finding |
| "Search" box present but might not function | Type "test" and press Enter | Search returns 0 results with no helpful message → poor search UX finding |
| Dropdown "Sort by" on PLP | Select "Price: Low to High" | Products don't actually re-sort → broken sort finding |
| Hover on product image should show zoom | Hover on image | Nothing happens → missing zoom feature finding |

### Type 2: BrowserObservationRequest

**Purpose:** "Show me more detail about this element." Read-only — no interaction, no state change.

```typescript
interface BrowserObservationRequest {
  type: "browser_observation";
  request_id: string;

  // What to observe
  observe: {
    element_info?: {
      selector: string;
      properties: string[];         // computed styles, bounding box, etc.
    };
    screenshot?: {
      region?: { x: number; y: number; width: number; height: number };
      full_page?: boolean;
    };
    performance?: boolean;
    network?: {
      url_pattern?: string;
    };
    accessibility?: {
      selector: string;             // get full AX subtree for this element
    };
    custom_js?: {
      script: string;               // read-only script (sandboxed)
      description: string;
    };
  };

  reason: string;
  max_cost_usd: number;             // typically $0 (no LLM)
  timeout_ms: number;
}
```

**Examples:**

| Analysis needs | Request | What it learns |
|---|---|---|
| Exact contrast ratio of this CTA | element_info for CTA with computedStyles | Contrast ratio is 2.1:1 → fails WCAG AA (needs 4.5:1) |
| What's below the fold on mobile? | Screenshot at 375px viewport | Primary CTA is below 3 scroll-lengths on mobile |
| Are there hidden elements the AX-tree missed? | custom_js: `document.querySelectorAll('[style*="display:none"]').length` | 15 hidden elements — might contain relevant content |
| How many network requests after page load? | network with url_pattern "*" | 47 third-party requests — performance concern |

### Type 3: WebSearchRequest

**Purpose:** "What does the research say about this pattern?" or "What's the industry benchmark?"

```typescript
interface WebSearchRequest {
  type: "web_search";
  request_id: string;

  // Search parameters
  query: string;
  search_type: "best_practice" | "benchmark" | "competitor" | "research" | "general";

  // Constraints
  max_results: number;              // default 3
  preferred_sources?: string[];     // e.g., ["baymard.com", "nngroup.com"]
  recency?: "any" | "last_year" | "last_6_months";

  // What to extract from results
  extract: {
    summary: boolean;               // short summary of findings
    statistics?: boolean;           // extract specific numbers/percentages
    quotes?: boolean;               // extract relevant quotes with attribution
  };

  reason: string;
  requesting_heuristic_id?: string;
  max_cost_usd: number;             // default $0.05
  timeout_ms: number;               // default 15000
}
```

**Examples:**

| Analysis evaluating | Search | What it learns |
|---|---|---|
| Form has 12 fields for newsletter signup | "ideal form field count newsletter signup conversion" | Baymard: reducing fields from 11 to 4 increased submissions by 120%. Finding now cites real research. |
| Trust badges present but not recognized brands | "most trusted security badges ecommerce 2025" | Norton, McAfee, BBB are top 3. Client uses unknown badge. Recommendation: switch to recognized badge. |
| Checkout has no progress indicator | "checkout progress indicator impact on completion" | NNGroup: progress indicators reduce cart abandonment by ~20%. Finding now has research backing. |
| Pricing page shows 3 tiers | "SaaS pricing page best practices tier count" | Research: 3 tiers optimal, but most successful have a "recommended" highlight. Client doesn't highlight. |

### Type 4: CompetitorCheckRequest

**Purpose:** "How does the competitor handle this same pattern?"

```typescript
interface CompetitorCheckRequest {
  type: "competitor_check";
  request_id: string;

  // What to check
  competitor: {
    url: string;                    // competitor page URL
    page_type: PageType;            // must match client's page type
  };

  // What to compare
  compare: {
    dimensions: string[];           // e.g., ["cta_placement", "trust_signals", "form_design"]
    capture_screenshot: boolean;
    capture_perception: boolean;
  };

  reason: string;
  max_cost_usd: number;             // default $0.20 (needs browser navigation)
  timeout_ms: number;               // default 30000
}
```

**Examples:**

| Client issue found | Competitor check | What it learns |
|---|---|---|
| Client PDP has reviews in a tab (not visible by default) | Check amazon.in PDP | Amazon shows review summary + star rating directly on PDP without tab click. Recommendation becomes specific: "Show review summary inline like Amazon" |
| Client checkout has 5 steps | Check competitor checkout | Competitor has 2-step checkout. Finding: "Client's 5-step checkout is 3 steps more than industry leader" |
| Client has no guest checkout | Check competitor checkout | Competitor offers guest checkout prominently. Finding cites specific competitor example |

### Type 5: ExternalDataRequest

**Purpose:** "Check external data source for factual verification."

```typescript
interface ExternalDataRequest {
  type: "external_data";
  request_id: string;

  source: "google_shopping" | "pagespeed_insights" | "w3c_validator" | "custom_api";
  parameters: Record<string, any>;

  reason: string;
  max_cost_usd: number;
  timeout_ms: number;
}
```

**Examples:**

| What to verify | External source | What it learns |
|---|---|---|
| Is this price competitive? | Google Shopping API | Product is 40% above market average → finding: price competitiveness issue |
| Is this page actually slow? | PageSpeed Insights | Lighthouse score: 35/100, LCP 8.2s → concrete performance data |
| Is the HTML valid? | W3C Validator | 23 validation errors → structural issue |

---

## 32.4 Analysis Agent Loop (Replaces Linear Pipeline)

### Current (linear, passive)

```
deep_perceive → evaluate → self_critique → ground → score → annotate
```

### New (agentic loop, active)

```
deep_perceive
    │
    ▼
┌─────────────────────────────────────────────────┐
│             ANALYSIS AGENT LOOP                  │
│                                                  │
│  evaluate_with_evidence_gathering                │
│       │                                          │
│       ├── evaluate heuristic                     │
│       │     │                                    │
│       │     ├── sufficient evidence? → continue  │
│       │     │                                    │
│       │     └── need more? → EvidenceRequest     │
│       │           │                              │
│       │           ▼                              │
│       │     orchestrator routes request           │
│       │           │                              │
│       │           ▼                              │
│       │     evidence returned                    │
│       │           │                              │
│       │           ▼                              │
│       │     incorporate + re-evaluate            │
│       │                                          │
│       ▼                                          │
│  self_critique (with enriched evidence)          │
│       │                                          │
│       ▼                                          │
│  evidence_ground (deterministic, unchanged)      │
│       │                                          │
│       ▼                                          │
│  score (deterministic, unchanged)                │
│                                                  │
│  BUDGET: max N evidence requests per page        │
│  TIMEOUT: max T seconds for evidence gathering   │
│                                                  │
└─────────────────────────────────────────────────┘
    │
    ▼
annotate + store
```

### How the LLM decides to request evidence

**REQ-CAP-001:** The evaluate node gives the LLM access to evidence request tools alongside heuristic evaluation. The LLM can:

```
SYSTEM PROMPT (extended):

You are a CRO analyst with research capabilities.

For each heuristic, you may:
1. EVALUATE directly if you have sufficient evidence from the page data
2. REQUEST additional evidence if you need to verify something

Available evidence tools:
- browser_interact(target, action, capture): interact with page element, observe result
- browser_observe(what): get detailed info about an element (no interaction)
- web_search(query, type): search for best practices, benchmarks, research
- competitor_check(url, dimensions): check how a competitor handles this pattern

RULES:
- Use evidence tools SPARINGLY — max 5 per page
- Only request evidence when it would CHANGE your assessment
- Do NOT request evidence for heuristics you can evaluate from page data alone
- Each evidence request costs budget — be targeted
- Always evaluate FIRST, then request if uncertain
```

### Orchestrator routing

**REQ-CAP-002:** The orchestrator receives evidence requests as tool calls from the LLM:

```typescript
async function routeEvidenceRequest(
  request: EvidenceRequest,
  browserSession: BrowserSession,
  pageUrl: string,
): Promise<EvidenceResponse> {
  switch (request.type) {
    case "browser_interaction":
      // Route to Browser Agent — execute interaction, capture evidence
      return await browserAgent.executeInteraction(
        browserSession,
        request.interaction,
        request.capture,
      );

    case "browser_observation":
      // Route to Browser Agent — read-only observation
      return await browserAgent.observe(
        browserSession,
        request.observe,
      );

    case "web_search":
      // Route to Web Search Service
      return await webSearchService.search(
        request.query,
        request.search_type,
        request.max_results,
      );

    case "competitor_check":
      // Route to a SEPARATE browser session (don't pollute client's page)
      return await competitorBrowser.checkPage(
        request.competitor.url,
        request.compare,
      );

    case "external_data":
      // Route to External API Adapter
      return await externalDataAdapter.fetch(
        request.source,
        request.parameters,
      );
  }
}
```

### Evidence Response

```typescript
interface EvidenceResponse {
  request_id: string;
  type: EvidenceRequest["type"];
  success: boolean;
  error?: string;

  // For browser_interaction
  interaction_result?: {
    url_after: string;
    url_changed: boolean;
    screenshot_ref?: string;
    perception_after?: AnalyzePerception;
    network_requests?: NetworkRequest[];
    error_detected?: boolean;
    error_message?: string;
  };

  // For browser_observation
  observation?: {
    element_info?: ElementInfo;
    screenshot_ref?: string;
    performance?: PerformanceMetrics;
    accessibility?: AXNode[];
    custom_result?: any;
  };

  // For web_search
  search_results?: Array<{
    title: string;
    url: string;
    summary: string;
    statistics?: string[];
    quotes?: Array<{ text: string; source: string }>;
  }>;

  // For competitor_check
  competitor_data?: {
    screenshot_ref?: string;
    perception?: AnalyzePerception;
    comparison_notes?: string;
  };

  // For external_data
  external_data?: Record<string, any>;

  // Meta
  cost_usd: number;
  duration_ms: number;
}
```

---

## 32.5 Budget and Safety Constraints

### Evidence gathering budget (per page)

| Constraint | Default | Max | Rationale |
|---|---|---|---|
| Total evidence requests per page | 5 | 15 | Prevents unbounded research |
| Browser interaction requests | 3 | 8 | Interactions change state — bounded |
| Browser observation requests | 5 | 15 | Read-only, cheap |
| Web search requests | 3 | 5 | External API cost |
| Competitor check requests | 1 | 3 | Full page load cost |
| External data requests | 2 | 5 | API-dependent |
| Evidence gathering budget USD | $0.50 | $2.00 | Per-page cap |
| Evidence gathering timeout | 30s | 120s | Wall-clock per page |

**REQ-CAP-010:** Evidence gathering costs are tracked SEPARATELY from analysis LLM costs. Both count toward the page budget.

**REQ-CAP-011:** If evidence budget is exhausted, the analysis agent completes evaluation with available evidence. Findings are tagged `evidence_gathering_truncated` if the agent requested more evidence than budget allowed.

### Safety constraints

**REQ-CAP-020:** Browser interaction requests through the protocol inherit ALL safety rules from §6.9 and §11:

- safe actions (screenshot, observe) → auto-approve
- caution actions (click, type) → audit log
- sensitive actions (form submit with real data, purchase) → BLOCKED (not just HITL — analysis cannot trigger sensitive actions)
- blocked actions (JS eval on untrusted domain) → BLOCKED

**REQ-CAP-021:** The analysis agent CANNOT:
- Navigate to a different domain (stays on client's domain)
- Fill forms with real user data
- Trigger purchases, uploads, or downloads
- Execute arbitrary JavaScript
- Modify the page content
- Access cookies, localStorage, or session data

**REQ-CAP-022:** Competitor check requests open a SEPARATE browser session. They never share cookies or state with the client's page session.

### Web search safety

**REQ-CAP-023:** Web search queries are logged to the audit trail. Queries containing client names, proprietary data, or PII are blocked by a pre-filter.

**REQ-CAP-024:** Web search results are treated as UNTRUSTED external data. The analysis agent may cite them in recommendations but they do NOT affect grounding rules or scoring (which remain deterministic).

---

## 32.6 How This Changes Finding Quality

### Before (passive analysis)

```
Finding: "No guest checkout option visible on checkout page"
Evidence: ctas[] does not contain "guest checkout" text
Recommendation: "Add a guest checkout option"
Research backing: (generic, from heuristic description)
```

### After (active analysis with evidence gathering)

```
Finding: "No guest checkout option visible on checkout page"
Evidence: ctas[] does not contain "guest checkout" text
  + browser_interaction: clicked "Checkout" CTA → redirected to /login
    with no guest option visible
  + web_search: "Baymard Institute guest checkout" →
    "24% of users abandon checkout when forced to create an account"
  + competitor_check: amazon.in checkout →
    "Amazon shows 'Continue as guest' prominently above login form"
Recommendation: "Add a prominent guest checkout option above the login form.
  Baymard research shows 24% abandonment without it.
  Amazon's implementation shows the guest option with equal visual weight
  to the login option."
Research backing: Baymard Institute (2024), verified via web search
Competitor reference: Amazon.in checkout page (screenshot attached)
```

The finding is the SAME heuristic violation. But the evidence is 10x richer, the recommendation is specific instead of generic, and the research backing is verified rather than assumed.

---

## 32.7 Integration with Existing Architecture

### What changes

| Component | Change |
|---|---|
| §7 (Analyze Mode) | Evaluate node becomes an agentic loop with evidence tool access |
| §5.7 (AuditState) | Add `evidence_requests[]` and `evidence_responses[]` to state |
| §8 (Tool Manifest) | Add 5 evidence request tools to analysis tool set (available only during evaluate) |
| §13.6 (Data Layer) | Add `evidence_requests` table for audit trail |
| §23 (Findings Engine) | Finding schema gets `evidence_sources[]` with external refs |
| §25 (Reproducibility) | Evidence requests are logged + pinned in snapshot (web search results cached per run) |
| §26 (Cost) | Evidence gathering budget tracked separately |

### What does NOT change

| Component | Why unchanged |
|---|---|
| §6 (Browse Mode) | Browser agent is CALLED by the protocol, not modified |
| §20 (State Exploration) | Still runs before analysis — pre-captures states |
| §31 (State-Aware Analysis) | Per-state + transition analysis still works; evidence requests are additional |
| Grounding rules (GR-001..GR-011) | Still deterministic; external evidence doesn't bypass grounding |
| 4D scoring | Still deterministic; external evidence improves finding TEXT, not scores |
| REQ-LAYER-005 | Preserved — Analysis requests, never executes. Protocol mediates. |

### Revised REQ-LAYER-005

**REQ-LAYER-005 (v2):** Layer 3 (Analysis Engine) SHALL NOT directly control the browser. It SHALL NOT import Playwright, hold browser session references, or call browser tool functions directly. Layer 3 MAY request evidence from Layer 2 via the Evidence Request Protocol (§32). The orchestrator mediates all requests. Layer 2 executes and returns typed evidence. Analysis processes evidence, never sessions. The protocol is bounded by budget, timeout, and safety constraints.

---

## 32.8 The Analysis Agent as a ReAct Agent

With the evidence protocol, the Analysis Agent becomes a proper **ReAct agent** (Reason + Act):

```
For each heuristic:
  1. REASON: Look at page data, apply heuristic
  2. Is evidence sufficient?
     YES → produce finding
     NO  → ACT: request evidence (browser interaction, web search, competitor check)
  3. OBSERVE: receive evidence response
  4. REASON: re-evaluate with enriched evidence
  5. Produce finding with full evidence chain
```

This is the same ReAct pattern the Browse Agent uses (perceive→reason→act→verify), but adapted for the analysis context:

| | Browse Agent ReAct | Analysis Agent ReAct |
|---|---|---|
| **Reason about** | "Which element to click next?" | "Which heuristic needs more evidence?" |
| **Act via** | Browser tools (click, type, navigate) | Evidence Request Protocol |
| **Observe** | Page state after action | Evidence response |
| **Verify** | Did the action succeed? | Does the evidence change my assessment? |
| **Loop bound** | max_steps + confidence | max evidence requests + budget |

---

## 32.9 LLM Prompt for Evidence-Gathering Evaluation

```
SYSTEM:
You are a CRO analyst with research capabilities. You evaluate web pages
against usability heuristics and can gather additional evidence when needed.

EVALUATION METHODOLOGY:
For each heuristic:
1. OBSERVE: Review the page data provided
2. ASSESS: Does the page comply or violate?
3. EVIDENCE CHECK: Do you have sufficient evidence to be confident?
   - If YES: produce the finding
   - If NO: use an evidence tool to gather what you need, then reassess

AVAILABLE EVIDENCE TOOLS:
- browser_interact({ target, action, capture }): Interact with a page element.
  Use when: "I need to know what happens when a user clicks/hovers/types here"
  Example: browser_interact({ target: { text_contains: "Add to Cart" },
           action: "click", capture: { url_after: true, screenshot: true } })

- browser_observe({ element_info | screenshot | accessibility }): Observe without interacting.
  Use when: "I need more detail about this element's styles/position/accessibility"
  Example: browser_observe({ element_info: { selector: ".cta-primary",
           properties: ["contrastRatio", "fontSize"] } })

- web_search({ query, type }): Search for best practices, benchmarks, research.
  Use when: "I want to cite specific research to strengthen this recommendation"
  Example: web_search({ query: "form field count impact on conversion",
           type: "research" })

- competitor_check({ url, dimensions }): Check how a competitor handles this pattern.
  Use when: "I want to show the client a better implementation exists"
  Example: competitor_check({ url: "https://competitor.com/checkout",
           dimensions: ["cta_placement", "guest_checkout"] })

RULES:
- Maximum 5 evidence requests per page
- Only request evidence when it would CHANGE your assessment or STRENGTHEN your recommendation
- DO NOT request evidence for clear-cut violations (e.g., missing heading = obvious)
- DO request evidence when:
  * A CTA destination is unclear (click to verify)
  * You're recommending a specific practice (search for research backing)
  * Competitor comparison would make the recommendation concrete
  * Element behavior is ambiguous (interact to verify)
- Each request costs budget. Be surgical, not exploratory.
- NEVER predict conversion impact, even with research data.
  Say: "Baymard research shows 24% abandonment rate" NOT "this will increase conversions by 24%"
```

---

## 32.10 Example: Full Analysis with Evidence Gathering

**Page:** client.com/product/wireless-headphones

**Heuristic:** BAY-PRODUCT-003 — "Product reviews visible and credible"

**Step 1 — Initial evaluation (from page data):**
```
Observation: Page has a "Reviews" tab but reviews are not visible in default state.
             trustSignals: 0 items with type "review" in default state.
Assessment: Probable violation — reviews hidden behind interaction.
Evidence sufficient? NO — I should verify what the Reviews tab contains.
```

**Step 2 — Evidence request:**
```
browser_interact({
  target: { text_contains: "Reviews" },
  action: "click",
  capture: { perception: true, screenshot: true }
})
```

**Step 3 — Evidence response:**
```
Reviews tab opened. perception.trustSignals now shows:
- 4.2★ average, 342 reviews
- 3 verified purchase reviews visible
- Pagination shows 35 pages of reviews
Screenshot captured: reviews_tab_open.jpg
```

**Step 4 — Re-evaluation with evidence:**
```
Finding: VIOLATION (medium severity, not critical)
  Reviews exist (342 total) but are hidden behind a tab.
  In default state, zero social proof visible above fold.

Evidence: browser interaction confirmed reviews exist behind tab.
```

**Step 5 — Enrich with web search:**
```
web_search({
  query: "product page reviews visibility impact",
  type: "research"
})
```

**Step 6 — Search response:**
```
Result: "Baymard Institute: 95% of shoppers read reviews before buying.
         Hiding reviews behind tabs reduces engagement by ~30%."
Source: baymard.com/blog/reviews-visibility (2024)
```

**Step 7 — Enrich with competitor check:**
```
competitor_check({
  url: "https://amazon.in/dp/similar-headphones",
  dimensions: ["trust_signals", "review_placement"]
})
```

**Step 8 — Competitor response:**
```
Amazon shows: review summary (4.3★, 1,247 ratings) directly on product page,
no tab click needed. Star rating + review count visible above fold next to price.
Screenshot captured.
```

**Final finding:**
```json
{
  "heuristic_id": "BAY-PRODUCT-003",
  "status": "violation",
  "severity": "medium",
  "observation": "Product reviews (342 total, 4.2★) are hidden behind a 'Reviews' tab.
    In the default page state, zero social proof is visible above the fold.",
  "assessment": "Users must actively click to see reviews. Baymard research shows
    95% of shoppers read reviews before buying, and hiding reviews behind tabs
    reduces engagement by ~30%.",
  "evidence": {
    "element_ref": "Reviews tab",
    "data_point": "trustSignals (default state: 0, reviews-tab state: 342 reviews)",
    "measurement": "0 reviews visible in default state vs 342 behind tab click",
    "evidence_sources": [
      { "type": "browser_interaction", "ref": "clicked Reviews tab → 342 reviews revealed" },
      { "type": "web_search", "ref": "Baymard Institute: reviews visibility impact (2024)" },
      { "type": "competitor_check", "ref": "Amazon shows review summary inline without tab" }
    ]
  },
  "recommendation": "Show a review summary (star rating + review count) directly on the
    product page without requiring a tab click. Amazon's implementation shows the summary
    next to the price, above the fold. The full reviews section can remain in a tab,
    but the summary should be immediately visible.",
  "research_backing": "Baymard Institute (2024): 95% of shoppers read reviews.
    Hiding behind tabs reduces engagement ~30%.",
  "competitor_reference": "Amazon.in shows review summary inline (screenshot attached)"
}
```

**This finding is 10x more actionable than what the passive pipeline would produce.** It has verified evidence, cited research, and a specific competitor example — all gathered autonomously by the analysis agent.

---

## 32.11 Implementation Phases

| Phase | Deliverable |
|---|---|
| **MVP (Phase 10)** | `BrowserObservationRequest` only (read-only, zero risk). Analysis can request screenshots, element info, accessibility data. No interactions, no web search. |
| **Phase 11** | `BrowserInteractionRequest` (click, hover, type with safety constraints). Analysis can verify CTA destinations, form behavior. |
| **Phase 12** | `WebSearchRequest`. Analysis can research best practices, cite benchmarks. |
| **Phase 13** | `CompetitorCheckRequest`. Analysis can compare against competitors in-context. |
| **Phase 15** | `ExternalDataRequest`. Analysis can verify against Google Shopping, PageSpeed, etc. |

### MVP scope: observation-only

For MVP, the analysis agent can only OBSERVE — no interactions, no web search, no competitor checks. This is the safest starting point:
- Read-only browser queries ($0)
- No state changes
- No external API calls
- No security risk

This alone is valuable: the agent can request specific element details, targeted screenshots, and accessibility data that deep_perceive didn't capture. Post-MVP phases add progressively more capability.

---

## 32.12 Failure Modes

| # | Failure | Detection | Response |
|---|---|---|---|
| **CAP-01** | Evidence request budget exceeded | Request count/cost check | Analysis continues with available evidence. Finding tagged `evidence_truncated`. |
| **CAP-02** | Browser interaction changes page state unexpectedly | URL change or major DOM diff | Attempt restoration (back/reload). Log state change. Continue analysis with new state. |
| **CAP-03** | Web search returns no relevant results | Empty or irrelevant results | Skip enrichment. Finding uses heuristic's built-in research_backing instead. |
| **CAP-04** | Competitor page unreachable | Timeout or 4xx/5xx | Skip competitor check. Finding omits competitor reference. |
| **CAP-05** | LLM requests evidence for every heuristic (wasteful) | Request count approaching limit on first 3 heuristics | Rate-limit: max 1 evidence request per heuristic. Force direct evaluation for remaining. |
| **CAP-06** | Evidence request returns data that contradicts the finding | Grounding rule catches inconsistency | Finding revised or rejected based on new evidence. This is CORRECT behavior — evidence should change the assessment. |
| **CAP-07** | Analysis agent uses web search results as scoring input | Scoring pipeline detects external data in score calculation | BLOCKED. External data enriches TEXT only. Scoring remains deterministic from page data + heuristic metadata. |
| **CAP-08** | Competitor check reveals client's own page (same company) | URL/domain similarity detection | Skip. Log as "competitor URL matches client domain." |

---

## 32.13 Key Design Decisions

| Decision | Rationale |
|---|---|
| Protocol, not direct access | Preserves layer separation. Analysis is testable without a browser. Mock the protocol for unit tests. |
| Budget per page, not per heuristic | Some heuristics need 3 requests, some need 0. Per-page budget is more flexible. |
| Observation before interaction | MVP starts read-only. Interaction added later once the protocol is proven safe. |
| Web search results are UNTRUSTED | External data enriches recommendations but never bypasses deterministic grounding or scoring. |
| Competitor check in separate session | Client's page state is never polluted by competitor navigation. |
| LLM decides what evidence to gather | The LLM knows which heuristics are uncertain. Static rules can't predict evidence gaps. |
| Max 5 requests per page default | 5 is enough for targeted enrichment without becoming a research project. |

---

**End of §32 — Collaborative Agent Protocol**
