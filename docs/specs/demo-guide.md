# AI CRO Audit System — Comprehensive Demo Guide

**Purpose:** Walk through the complete master architecture diagram (`master-architecture.html`) section by section.
**Duration:** ~45-60 minutes for full walkthrough
**Audience:** Technical stakeholders, engineering team, CRO consultants
**File:** `docs/specs/final-architecture/diagrams/master-architecture.html`

---

## Pre-Demo Setup

1. Open `master-architecture.html` in Chrome/Edge (full screen)
2. The page opens to the **Hero Section** — this is your starting point
3. Have this guide on a second screen or printed
4. The 10 tabs below the hero provide deep-dive detail — you'll navigate to them during the demo

---

## PART 1: HERO SECTION (10 minutes)

> **Demo narrative:** "Let me show you the complete audit journey from trigger to delivery."

### 1.1 Header + Stats Bar

**What to show:** The 8 stat boxes at the top.

**Talking points:**
- "This is a 5-layer system with 28 browser tools and 100 research-grounded CRO heuristics"
- "Every finding passes through 11 evidence grounding rules — deterministic code, not LLM opinion"
- "3 reliability tiers determine how much human review each finding needs"
- "110 catalogued failure modes with detection and recovery for each"
- "211 implementation tasks across 11 phases — every task has a REQ-ID, file path, smoke test, and acceptance criteria"
- "Cost per page ranges from $0.35 (static analysis) to $1.80 (deep interactive) depending on the mode"

### 1.2 Horizontal Flow Bar

**What to show:** The color-coded chip flow at the top of the lifecycle section.

**Talking points:**
- "This is the complete audit journey in one line"
- Point to each color: "Blue is orchestration, cyan is the browser agent, purple is state exploration, orange is the analysis pipeline, pink is the self-critique filter, green is evidence grounding, yellow is the review gate, and emerald is delivery"
- "The key insight: Browse and Analyze loop for each page. After all pages, findings go through a review gate before reaching the client"

### 1.3 Audit Lifecycle (7 Phases)

**What to show:** Scroll through the ASCII diagram. This is the centerpiece of the demo.

---

#### Phase 1: Trigger & Initialization

**What to say:**
- "An audit starts with a trigger — CLI command, MCP tool call, consultant dashboard button, client self-service, or scheduled job"
- "The gateway validates the request through an 8-step pipeline and creates a reproducibility snapshot — we pin temperature to 0, lock model versions, and hash the heuristic set. Same inputs always produce same outputs"
- "We load the heuristic knowledge base — 100 heuristics, encrypted at rest with AES-256-GCM, decrypted only in memory"
- "Important: we pre-filter by business type right here. An ecommerce client gets ecommerce-relevant heuristics (~60-70 from 100). This reduces the working set for every page"
- "We discover pages from sitemap.xml, link extraction, or template-first discovery, build a queue, and cap at 50 pages"
- "Budget is set: $15 total audit, $5 per page"

**Key question to anticipate:** "What if the site has no sitemap?" — "We fall back to homepage link extraction. The browse agent follows navigation links to discover pages."

---

#### Phase 2: Page Loop

**What to say:**
- "This is where the real work happens. For each page in the queue..."

**Browse Subgraph:**
- "First, the browser agent navigates to the page. This is a full Playwright browser with stealth — anti-detection, human-like mouse movement with Bezier curves, Gaussian typing delays, fingerprint rotation"
- "The agent runs a perceive → reason → act → verify loop. It handles cookie banners, popups, and modals. If it hits a login wall, it escalates to the consultant via HITL"
- "Cost: about $0.10 per page. Time: 5-15 seconds"

**State Exploration (Phase 10+):**
- "This is where it gets interesting. A modern web page hides 30-50% of its content behind tabs, accordions, dropdowns, and variant selectors"
- "Pass 1 is heuristic-primed — we look at which heuristics need specific states revealed. If a heuristic needs to evaluate 'reviews tab content,' we click the Reviews tab"
- "Pass 2 is bounded-exhaustive — a 12-rule library systematically clicks every tab, accordion, size selector, and filter. We even submit an empty form to test validation"
- "The output is a StateGraph with up to 15 states per page. This graph is FROZEN — it becomes read-only input for the analysis"

**Analyze Subgraph:**
- "Now the 5-step analysis pipeline runs..."

**Step 1: deep_perceive**
- "One Playwright `page.evaluate()` call scans the entire DOM and returns a structured AnalyzePerception — headings, CTAs, forms, trust signals, layout, images, navigation, performance"
- "We capture viewport and fullpage screenshots, plus per-state screenshots for every state in the graph"
- "This is ~200ms. No LLM cost"

**Step 2: evaluate**
- "This is where the LLM evaluates the page against the filtered heuristics"
- "In interactive mode, the LLM has access to 9 browser tools. It can click tabs, select variants, fill form fields to trigger validation — anything that helps evaluate a heuristic"
- "The chain of thought is: OBSERVE → INTERACT (optional, max 2 per heuristic) → ASSESS → EVIDENCE → SEVERITY"
- "Heuristics are split by scope: global heuristics evaluate against the merged view, per-state heuristics evaluate against each individual state, transition heuristics evaluate state pairs"
- "Cost: $0.15-1.20 depending on mode. Time: 3-15 seconds"

**Step 2b: Pass 2 Open Observation**
- "After structured evaluation, we ask a different question: 'What did the heuristics miss?'"
- "This is the consultant-instinct layer. The LLM looks at the page with fresh eyes and reports up to 5 observations that no formal heuristic covers"
- "These are always Tier 3 — consultant must review. But here's the magic: approved observations feed the Learning Service and eventually crystallize into new heuristics. The system gets smarter from its own discoveries"

**Step 3: Self-Critique**
- "CRITICAL: this is a SEPARATE LLM call with a DIFFERENT persona — 'senior CRO quality reviewer'"
- "It challenges every finding with 5 checks: Does the referenced element exist? Is severity proportional to evidence? Does conclusion follow from observation? Did it account for page type and business? Are there duplicates?"
- "Each finding gets a verdict: KEEP, REVISE, DOWNGRADE, or REJECT"
- "This catches ~30% of remaining hallucinations. The LLM is better at critiquing than generating"

**Step 4: Evidence Ground**
- "This is the final filter and it's DETERMINISTIC CODE — no LLM"
- "11 grounding rules. GR-001: Does the referenced element actually exist in the page data? GR-006: Does critical severity have measurable evidence? GR-007: Does the finding predict conversion? If so, reject"
- "This catches ~95% of remaining hallucinations. Combined with CoT and self-critique, the three-layer filter eliminates the vast majority of false positives"

**Step 5: Annotate + Store**
- "Surviving findings get pinned on screenshots with color-coded markers — red for critical, orange for high, yellow for medium, blue for low"
- "Everything goes to PostgreSQL (findings) and Cloudflare R2 (screenshots)"

**Review Gate:**
- "Tier 1 findings auto-publish. Tier 2 wait 24 hours. Tier 3 are held for consultant review"

**Restore State:**
- "After interactive analysis, the page might be in a modified state. We reload to restore default before moving to the next page"

---

#### Phase 3: Workflow Analysis

**What to say:**
- "This is for funnel analysis — Homepage → Category → Product → Cart → Checkout"
- "The browser session stays open across steps. Cookies and cart state persist"
- "At each step: browse → analysis → restore → transition action → next step"
- "After traversal, a cross-step analysis looks at the JOURNEY — funnel friction, CTA continuity, trust signal flow, form complexity, information scent"
- "This catches issues that no single-page analysis can find: 'The checkout flow has 3 friction points across steps 2 and 4'"

---

#### Phase 4: Audit Completion

**What to say:**
- "After all pages are processed..."
- "Cross-page consistency: Are CTAs the same style on every page? Same nav structure? Same trust signals?"
- "Competitor comparison: Pairwise, not absolute scoring. 'Client CTA is below fold, competitor CTA is above fold with stronger visual weight.' Research shows pairwise comparison is reliable; absolute scoring is not"
- "Version diff: If this is a re-audit, we compare against the previous run. Resolved findings are wins. New findings are regressions. Persisted findings are still open"

---

#### Phase 5: Review Gate + Two-Store Pattern

**What to say:**
- "This is the quality gate that prevents AI hallucinations from reaching the client"
- "Two stores: the INTERNAL store has all findings (consultants see everything). The PUBLISHED store has only approved findings (clients see only approved)"
- "Tier-based routing: Tier 1 (visual/structural, >75% reliable) auto-publishes. Tier 2 (content/persuasion, ~60%) waits 24 hours. Tier 3 (interaction/emotional, ~40%) is held for consultant review"
- "Warm-up mode for new clients: ALL findings are held regardless of tier until the system proves itself — at least 3 audits with less than 25% rejection rate. Then normal routing resumes"
- "Consultant actions: Approve publishes to client. Edit creates a new version (original preserved for audit trail). Reject archives with reason — and that reason feeds the learning service"

---

#### Phase 6: Delivery

**What to say:**
- "Findings reach the client through multiple channels"
- "CRO Audit MCP Server: 9 tools for programmatic query by other AI agents"
- "Client Dashboard: published findings with annotated screenshots, version comparison, competitor view"
- "Consultant Dashboard: internal view with review queue, scheduling, quality metrics"
- "Everything is client-isolated via PostgreSQL Row-Level Security"

---

#### Phase 7: Learning Feedback Loop

**What to say:**
- "This is how the system gets smarter over time"
- "Every consultant decision — approve, reject, edit — is tracked per heuristic"
- "After 30+ samples, the Calibration Engine computes a reliability delta. Heuristics that get rejected often are suppressed. Heuristics that get approved consistently are boosted"
- "Open observations from Pass 2 that consultants approve become candidate heuristics. If the same pattern appears across multiple clients, it gets promoted to a real heuristic in the KB"
- "The overlay chain is: base heuristic → brand customization → learned calibration → client-specific override. Consultant intent always wins"
- "Scheduled re-audits run weekly or monthly with automatic version diffs — net improvement tracked over time"

**Key insight to emphasize:** "This means every audit makes the next audit better. The system learns what matters for each client."

---

#### Metrics Box

**What to show:** The audit metrics and checkpointing boxes.

**What to say:**
- "For a 10-page interactive audit: ~$6.80-10.30 total, 3-5 minutes, 30-60 grounded findings, 15-30 rejected by filters, 80-150 screenshots"
- "Crash recovery: Temporal durability plus LangGraph checkpointing. If the server dies mid-audit, it resumes from the last checkpoint. No data loss, no duplicate work"
- "Reproducibility: temperature=0 pinned at session start. Same inputs produce same outputs"

---

## PART 2: TAB DEEP-DIVES (30-40 minutes)

> **Demo narrative:** "Now let me show you the details behind each layer."

### Tab 1: System Architecture (3 minutes)

**What to show:** The 5-layer diagram with expandable boxes.

**Talking points:**
- Click each layer and expand a component box to show details
- "5 layers, each with one responsibility. No layer skipping — Layer N only talks to Layer N-1 or N+1"
- "The key revision: REQ-LAYER-005 v3 — the analysis engine MAY use browser tools during evaluation, but SHALL NOT navigate or trigger sensitive actions"
- Point to the tech stack bar: "All open source or standard tooling. Total monthly cost: $350-600 at 20 audits per week"

### Tab 2: Browse Agent (5 minutes)

**What to show:** 8-layer architecture, 10-node graph, 3 execution modes, 23 tools with safety badges, confidence scoring.

**Talking points:**
- "The browser agent is a REUSABLE capability library — it can be used for any browser automation task, not just CRO auditing"
- Point to the 3 modes: "Mode A is deterministic replay at $0 per step — for known sites. Mode B is the default guided agent at $0.10 per step. Mode C is vision-based fallback at $0.30 per step for canvas-heavy sites"
- Point to confidence scoring: "Multiplicative, not additive. Each step decays by 3%. Verification success boosts 8%. Failure drops 20%. Below 0.3 = HITL escalation"
- Click through the 23 tools: "Each tool has a safety badge. Green is safe, yellow is caution (logged), orange is sensitive (needs human approval), red is blocked"

### Tab 3: Analysis Pipeline (5 minutes)

**What to show:** 5-step pipeline, hallucination filter, all 3 LLM prompts, heuristic loading.

**Talking points:**
- Walk through the 5 pipeline steps with their timings
- "The hallucination filter catches problems at 3 levels: CoT catches ~50%, self-critique catches ~30% of remaining, evidence grounding catches ~95% of remaining"
- Show the evaluate prompt: "Heuristics go in the USER message, not system prompt — this keeps the system prompt cached for cost efficiency"
- Show the self-critique prompt: "Different persona — 'senior quality reviewer.' 5 explicit checks. The instruction is 'be harsh — better to reject a valid finding than let a hallucinated one through'"
- Show the open observation prompt: "Pass 2 is the consultant-instinct layer. Static only, max 5 observations, always Tier 3. Feeds the learning service"
- Show heuristic loading: "Private repo → encrypted at build → decrypted in memory → filtered by business type (once per audit) → filtered by page type (once per page) → injected into prompt. Client never sees the heuristic rules"

### Tab 4: Composition §33 (5 minutes)

**What to show:** Tool injection matrix, interactive CoT, dual-mode evaluation, safety guards, §20/§33 boundary.

**Talking points:**
- "The Browser Agent and Analysis Agent compose — they don't merge. The Browser Agent provides tools, the Analysis Agent borrows 9 of them during evaluation"
- Point to the tool injection matrix: "9 browser tools are injected (click, hover, select, type, press_key, scroll, get_state, screenshot, find_by_text) plus 6 analysis tools. Navigation tools are EXCLUDED — the analysis agent cannot navigate away from the current page"
- "Interactive CoT: OBSERVE → INTERACT (optional, max 2 per heuristic) → ASSESS → EVIDENCE → SEVERITY"
- Point to dual-mode: "Pass 1 is heuristic-driven with scope splitting. Pass 2 is open observation. Both feed into the same self-critique and grounding pipeline"
- Point to safety guards: "Two-layer navigation guard. Enter key reclassified as sensitive when inside a form. Workflow transition actions blocked — only the orchestrator advances the funnel"
- "The §20/§33 boundary is clear: §20 explores BEFORE analysis (rule-driven, StateGraph frozen). §33 interacts DURING analysis (LLM-driven, produces InteractionRecords, not StateNodes)"

### Tab 5: Heuristics & Grounding (5 minutes)

**What to show:** Heuristic schema, 3 reliability tiers, 100 heuristic distribution, 11 grounding rules, IP protection.

**Talking points:**
- "100 heuristics across 3 sources: 50 Baymard (e-commerce research), 35 Nielsen (usability), 15 Cialdini (persuasion psychology)"
- "3 tiers based on research: Tier 1 (visual/structural) the LLM is >75% reliable — auto-publish. Tier 2 (content/persuasion) ~60% reliable — 24hr delay. Tier 3 (interaction/emotional) ~40% reliable — consultant must review"
- Walk through the 11 grounding rules: "GR-001: does the element exist? GR-006: does critical severity have measurable evidence? GR-007: does it predict conversion? GR-011: does a per-state finding reference the correct state?"
- "IP protection: the heuristic detection logic, positive/negative signals, filtering rules — these are REO's intellectual property. Clients see the finding description and recommendation. They NEVER see the heuristic rules"

### Tab 6: State & Findings (4 minutes)

**What to show:** AuditState schema, finding lifecycle state machine, state exploration.

**Talking points:**
- "AuditState is ONE object that carries everything — browse fields, analyze fields, orchestrator fields, §33 composition fields. Two subgraphs read and write to the same state"
- Walk through the finding lifecycle: "GENERATED → CRITIQUED → GROUNDED → TIERED → PUBLISHED. With rejection branches at critique and grounding stages. Terminal states: published, approved, edited, rejected_critique, rejected_ground, rejected_consultant, failed"
- "State exploration: two-pass model. Pass 1 is heuristic-primed. Pass 2 is bounded-exhaustive with a 12-rule disclosure library. Escalation loop: if self-critique suspects hidden content, the orchestrator re-routes back to exploration (max 1 cycle)"

### Tab 7: Safety & Cost (4 minutes)

**What to show:** Safety classification matrix, HITL flow, rate limits, cost breakdown, budget enforcement, failure modes.

**Talking points:**
- "Safety is deterministic code, not LLM judgment. The LLM cannot override the safety gate"
- "5 HITL triggers: sensitive action, login wall, CAPTCHA, confidence below 0.3, or the LLM proactively asks for help"
- Walk through the cost table: "Static mode: $0.35/page. Interactive standard: $0.68-1.03/page. Interactive deep: $1.00-1.80/page"
- "Budget enforcement is hierarchical: audit budget ($15) → page budget ($5) → exploration budget ($0.50) → interaction budget ($0.30 standard / $1.00 deep). Kill-switch available per-client, per-audit, or global"
- "110 failure modes catalogued: 12 browse, 10 analysis, 16 composition, plus 72 from platform extensions. Every one has detection and recovery"

### Tab 8: Orchestration (4 minutes)

**What to show:** Three-tier model, audit orchestrator graph, workflow orchestrator, Temporal + LangGraph.

**Talking points:**
- "Three tiers: Tier 1 is the Audit Orchestrator (Temporal, durable). Tier 2a is the Page Orchestrator (LangGraph). Tier 2b is the Workflow Orchestrator (LangGraph). Tier 2c is Competitor Audit"
- "The audit graph: audit_setup → page_router → browse → analyze → restore_state → page_router (loop) → audit_complete"
- "Temporal provides crash recovery and durable execution. LangGraph runs inside Temporal activities — stateless from Temporal's view. If the server dies, Temporal replays from history"

### Tab 9: Data & Delivery (4 minutes)

**What to show:** Database schema, RLS, R2 storage, review gate + two-store, delivery interfaces, client visibility.

**Talking points:**
- "25+ PostgreSQL tables with Row-Level Security. Every client-scoped table enforces `client_id = current_setting('app.client_id')`"
- "Two access modes: `published_only` for client dashboard and MCP server. `internal` for consultant dashboard. This is enforced at the database level"
- "R2 stores screenshots with a clear key format: client_id / audit_run_id / page_url_hash / type.jpg"
- "Delivery: CRO Audit MCP Server (9 tools), Client Dashboard (7 pages), Consultant Dashboard (6 pages), 10 SSE event types for real-time progress"

### Tab 10: Implementation (3 minutes)

**What to show:** 11-phase table, dependency graph, §33a interface map, phase gates.

**Talking points:**
- "211 tasks across 11 phases, ~17 weeks to full production"
- "Three major milestones: Phase 5 (browse works), Phase 8 (single-site audit — MVP), Phase 11 (interactive composition — the moat)"
- "§33 interfaces are baked into earlier phases: ToolRegistry in Phase 2, SafetyContext in Phase 4, EvaluateStrategy in Phase 7, session passing in Phase 8. Phase 11 just activates the interactive path — no refactoring"
- "Phase gates enforce quality: Phase 5 gate requires browse working on 3 real sites. Phase 8 gate requires end-to-end audit. Phase 11 gate requires measurable quality improvement from interactive mode"
- "Reproducibility: temperature=0, prompt version hashes pinned, 90% overlap target on repeat runs"

---

## PART 3: KEY MESSAGES (5 minutes)

### Why This Architecture Wins

1. **Research-grounded, not opinion-based.** Every design decision traces to a published paper (GPT-4o vs Experts, MLLM UI Judge, WiserUI-Bench, UXAgent). We know what LLMs CAN and CANNOT do reliably.

2. **Three-layer hallucination filter.** CoT → Self-Critique → Evidence Grounding. No other CRO tool has this. The third layer is deterministic code — it cannot be fooled.

3. **Interactive evaluation (§33).** The analysis agent clicks, explores, and tests — like a human consultant. This catches state-dependent issues that static analysis misses entirely. Phase 11 is the competitive moat.

4. **Learning feedback loop.** Every consultant decision makes the next audit better. Open observations crystallize into new heuristics. The system literally gets smarter.

5. **Dual-mode safety.** Findings are hypotheses, not verdicts. Tier-based review gate. Warm-up mode for new clients. Consultant always has final say.

6. **Implementation-ready.** 211 tasks, every one with a REQ-ID, file path, smoke test, and acceptance criteria. Not a wishlist — a build plan.

### The One Slide Summary

```
BROWSE (navigate + explore) → ANALYZE (evaluate + critique + ground) → REVIEW (tier gate + consultant) → DELIVER (dashboard + MCP) → LEARN (calibrate + improve)
```

Everything else is detail. This is the system.

---

## PART 4: ANTICIPATED QUESTIONS

### Architecture Questions

**Q: Why not just use GPT-4o Vision to look at screenshots?**
A: Research proves it. Anthropic Computer Use scored 22% on OSWorld. Vision-only is fragile. We use AX-tree primary perception (cheaper, more reliable) with screenshot fallback only when the AX-tree has <10 nodes.

**Q: Why 3 separate LLM calls (evaluate + critique + open observation)?**
A: Self-critique as a separate call with a different persona (SD-07) prevents confirmation bias. The LLM is better at critiquing than generating. Open observation uses a "fresh eyes" perspective specifically to catch what structured evaluation missed. Combining them into one call reduces quality.

**Q: Why is evidence grounding deterministic code and not LLM?**
A: Because checking "does element X exist in the page data" is a string match — there is zero reason to ask an LLM. Code is 100% reliable, costs $0, and takes 100ms. The LLM evaluates reasoning. Code validates facts.

**Q: What if the LLM hallucinates a new failure mode we haven't catalogued?**
A: The 110 failure modes cover detection and recovery patterns. A new failure would be caught by either the general confidence decay (drops below 0.3 → HITL) or the circuit breaker (3 consecutive failures → domain blocked). Unknown failures always escalate to human.

### Cost Questions

**Q: Is $0.35-1.80 per page expensive?**
A: A human CRO consultant charges $150-300/hour and takes 2-4 hours per page. Even at $1.80 (deep interactive mode), we're ~100x cheaper with 3-5 minute turnaround. Static mode at $0.35 is ~400x cheaper.

**Q: What if costs increase with model price changes?**
A: The LLM Adapter pattern (BA-05) means we can swap providers without changing business logic. If Anthropic raises prices, we switch to OpenAI or Gemini. The architecture is provider-agnostic.

### Quality Questions

**Q: What's the false positive rate?**
A: Target: <25%. The three-layer filter is designed to reject hallucinations aggressively. Self-critique is instructed "be harsh — better to reject a valid finding than let a hallucinated one through." Research shows 21.2% overlap between LLM and human expert findings — we expect to be in the same range but with ZERO hallucinated elements (grounding rules guarantee this).

**Q: Why not predict conversion impact?**
A: WiserUI-Bench (2025) proved LLMs cannot reliably predict which UI converts better. We state the heuristic violation, cite the research backing, and recommend a specific fix. We NEVER say "this will increase conversions by X%." GR-007 enforces this in code.

### Implementation Questions

**Q: How long to first usable product?**
A: Phase 8 (single-site audit MVP) at ~week 11. This produces real findings, real screenshots, real review gate. Phase 11 (full interactive composition) at ~week 17.

**Q: Can we run Phase 1 tomorrow?**
A: Yes. T001 (monorepo setup) has zero dependencies. The first 5 tasks are project scaffolding. By end of week 1, we'll have Playwright launching and extracting AX-trees.

**Q: What's the riskiest phase?**
A: Phase 7 (Analysis Pipeline) — this is where the LLM prompts need to produce actual findings. The evaluate prompt, self-critique prompt, and grounding rules all need real-world tuning. The spec gives us the structure, but prompt engineering is iterative.

---

## Demo Checklist

- [ ] Hero section: Stats bar explained
- [ ] Hero section: Flow chips walked through
- [ ] Phase 1: Trigger + initialization + reproducibility
- [ ] Phase 2: Browse + state exploration + 5-step analysis + review gate
- [ ] Phase 3: Workflow analysis
- [ ] Phase 4: Audit completion + competitor + version diff
- [ ] Phase 5: Two-store pattern + warm-up + consultant review
- [ ] Phase 6: Delivery channels
- [ ] Phase 7: Learning feedback loop + crystallization
- [ ] Tab 1: 5-layer architecture
- [ ] Tab 2: Browse agent (modes, tools, confidence)
- [ ] Tab 3: Analysis pipeline (3 prompts, hallucination filter)
- [ ] Tab 4: Composition model (tool injection, interactive CoT)
- [ ] Tab 5: Heuristics + grounding rules
- [ ] Tab 6: State schema + finding lifecycle
- [ ] Tab 7: Safety + cost + failure modes
- [ ] Tab 8: Orchestration (3-tier, Temporal)
- [ ] Tab 9: Data + delivery + review gate
- [ ] Tab 10: Implementation plan (211 tasks, 11 phases)
- [ ] Key messages delivered
- [ ] Q&A handled

---

**Post-demo action:** Align on implementation start date. First task is T001 (monorepo setup). Target: Phase 5 (browse works) by week 7, Phase 8 (MVP audit) by week 11.
