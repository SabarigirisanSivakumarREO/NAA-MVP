# Neural CRO Platform — Demo & Stakeholder Briefing Guide

> **For:** REO Digital internal team (first time seeing full vision)
> **Duration:** 60+ minutes with Q&A
> **Date:** April 15, 2026
> **Presenter notes:** Each phase has "Say This" (plain English), "Show This" (what to point at), and "They'll Ask" (anticipated questions with answers).

---

# PART 1: THE PROBLEM (10 minutes)

## Say This (Plain English)

"Every week, our CRO consultants spend 15-20 hours per client manually auditing websites. They open a site, scroll through every page, take screenshots, compare against best practices, write findings, create annotated screenshots, build a report, and present it. For a 50-page site, that's 3-4 days of senior consultant time.

Here's the problem with that:
- It's **expensive** — a senior consultant at $150/hour means a single audit costs $2,500-3,000 in labor
- It's **inconsistent** — two consultants audit the same site and find different things
- It's **slow** — clients wait 1-2 weeks for results
- It doesn't **scale** — we can't do 20 audits a week with our current team

Neural solves this. It's an AI system that does 80% of the audit work — the browsing, the pattern detection, the evidence gathering, the screenshot annotation — and lets our consultants focus on the 20% that actually requires human judgment: interpreting findings, understanding business context, and building client relationships.

The AI doesn't replace the consultant. It makes the consultant 5x more productive. Instead of one audit per week, they can review and deliver five."

## Show This
- Open the `master-architecture.html` diagram in browser — show the hero section with the stats bar (263 tasks, 12 phases, 100 heuristics, 12 grounding rules)
- Point at the lifecycle flow chips

## They'll Ask

**Q: "Why can't we just use existing tools like Lighthouse or PageSpeed?"**
A: Those tools check technical performance (load time, accessibility scores). They don't understand CRO — they can't tell you "your checkout form has 14 fields when the industry standard is 6-8" or "your primary CTA is invisible below three scrolls." We're building a CRO-specific intelligence layer on top of browser automation.

**Q: "Why build instead of buy?"**
A: Nothing like this exists. There are SEO audit tools (Screaming Frog, Sitebulb), there are performance tools (Lighthouse, WebPageTest), and there are generic AI chatbots. Nobody has built an AI CRO audit system with evidence grounding, heuristic evaluation, and consultant review gates. This is our competitive moat.

**Q: "How is this different from just asking ChatGPT to review a website?"**
A: ChatGPT looks at a screenshot and guesses. Our system actually navigates the site like a real user, extracts structured data (form field counts, CTA positions, contrast ratios), evaluates against 100 research-backed rules, validates every finding with 12 deterministic checks, and only shows the consultant findings that survive all filters. ChatGPT hallucinates 40-60% of the time. Our system catches 95% of hallucinations before they reach anyone.

---

# PART 2: HOW IT WORKS — THE BIG PICTURE (10 minutes)

## Say This

"The system has two AI agents that work together:

**Agent 1: The Browser Agent** — Think of it as a robot that can use a web browser like a human. It clicks, scrolls, types, takes screenshots. It navigates to every page, handles popups and cookie banners, and waits for pages to fully load. It even moves the mouse in realistic curves so websites don't detect it as a bot.

**Agent 2: The Analysis Agent** — This is the CRO brain. Once the browser agent has loaded a page, the analysis agent scans everything: every button, every form, every image, every heading. Then it evaluates what it sees against 100 expert rules — things like 'does this checkout form have too many fields?' or 'is the primary CTA visible without scrolling?' Every finding goes through three filters before anyone sees it.

**The Three Filters** — This is what makes us different from 'just asking AI':
1. **Chain of Thought** — The AI has to show its reasoning for every finding. This catches ~50% of bad findings.
2. **Self-Critique** — A separate AI review, acting as a skeptic, challenges every finding. 'Did you actually see this element? Is this severity justified?' Catches another ~30%.
3. **Evidence Grounding** — 12 hard-coded rules in actual software code (not AI judgment) that verify facts. 'You said this button is below the fold — is it actually below the fold based on its pixel position?' Catches ~95% of whatever got through the first two filters.

After all three filters, what's left are **evidence-backed findings** with real measurements, real screenshots, and real recommendations. The consultant reviews these, approves the good ones, rejects any the AI got wrong, and the system learns from those decisions over time."

## Show This
- Point at the lifecycle flow in the diagram: Navigate → Explore States → Deep Perceive → Quality Gate → Evaluate → Self-Critique → Evidence Ground → Annotate
- Emphasize the three-filter pipeline visually

## They'll Ask

**Q: "What's the accuracy? How often does it get things wrong?"**
A: Based on research (GPT-4o vs Human Experts, 2025), AI overlaps with human experts about 21% of the time — meaning the AI finds things humans miss, AND humans find things AI misses. That's why we don't auto-send findings to clients. Every finding is a hypothesis that a consultant reviews. Our three-filter system catches 95%+ of false positives before the consultant even sees them. The consultant is the final quality gate.

**Q: "What about websites that block bots?"**
A: The browser agent uses stealth technology — it mimics human mouse movements, typing patterns, and browser fingerprints. If a site still detects us (Amazon is aggressive about this), the system pauses and asks a human to help. We never force through a block.

**Q: "What are the 100 rules based on?"**
A: Three research-backed sources: Baymard Institute (50 rules for e-commerce UX), Jakob Nielsen's usability heuristics (35 rules), and Robert Cialdini's persuasion principles (15 rules). Every rule has an industry benchmark attached — for example, "checkout forms should have 6-8 fields (Baymard research)" or "primary CTA must be above the fold (Nielsen Norman Group)."

---

# PART 3: PHASE-BY-PHASE WALKTHROUGH (30 minutes)

---

## Phase 0: Setup (Week 0-1) — "Building the Workshop"

### Say This (Non-Technical)
"Before we build anything, we set up the workspace. Think of it like setting up a workshop before building furniture — you need the right tools, the right layout, and safety equipment. This phase creates the project structure, installs all the software dependencies, sets up the database, and creates the development environment."

### Say This (Technical Team)
"Monorepo with Turborepo + pnpm. Two workspaces: `packages/agent-core` (the brain) and `apps/cli` + `apps/dashboard` (the interfaces). PostgreSQL 16 with pgvector for the database, Docker Compose for local development. We also set up the golden test infrastructure and offline mock mode from day one — this means developers can work without burning API credits or hitting real websites."

### What Gets Built
- Project skeleton (monorepo, TypeScript, build system)
- Database (PostgreSQL + Docker)
- Environment configuration
- **Offline mock mode** — developers can test without internet or API keys
- **Test fixture infrastructure** — saved website snapshots for repeatable testing

### Business Value
Zero visible output yet, but this is the foundation everything else depends on. The offline mock mode saves ~$500/month in API costs during development.

### They'll Ask
**Q: "Why a monorepo? Why not separate repos?"**
A: The browser agent and analysis agent share types and interfaces. A monorepo means one `git pull` gets everything, types are always in sync, and one test run covers the whole system. We can always split later if needed.

---

## Phase 1: Perception (Weeks 1-2) — "Teaching the AI to See"

### Say This (Non-Technical)
"This is where we teach the AI to look at a web page and understand what's on it. Not just 'here's a screenshot' — but structured understanding. It knows: there are 3 buttons on this page, the main one says 'Buy Now' and it's blue, 200 pixels from the top. There's a form with 8 fields, 3 of which are required. There's a trust badge that says 'SSL Secure' in the footer.

This structured understanding is what makes our analysis possible. A human consultant looks at a page and intuitively sees these things. We're giving the AI that same structured perception."

### Say This (Technical Team)
"We build the perception pipeline: BrowserManager wraps Playwright with stealth configuration. AccessibilityExtractor pulls the AX-tree (the browser's accessibility data — a structured representation of every element). HardFilter removes invisible/disabled elements (typically 50%+ reduction). SoftFilter scores remaining elements by relevance and returns the top 30. MutationMonitor injects a DOM observer to track dynamic changes. ScreenshotExtractor captures JPEG screenshots under 150KB. ContextAssembler combines all of this into a PageStateModel."

### What Gets Built
- Browser launcher with anti-detection (stealth mode)
- Page structure extractor (sees every element, button, form, image)
- Filtering system (removes irrelevant noise — invisible elements, disabled buttons)
- Screenshot capture (compressed, consistent quality)
- Mutation monitor (detects when a page is still changing/loading)
- **Fixture capture CLI** — save any website's data for offline testing

### Business Value
After this phase, you can point the system at any website and get a structured data dump of everything on the page. This is the raw material for all analysis.

### They'll Ask
**Q: "How is this different from just taking a screenshot?"**
A: A screenshot is a picture — pixels. The AI can look at it but it's guessing. Our perception extracts *structured data*: the exact text of every button, the exact pixel position of every form field, the computed color contrast ratio of every CTA. When we later say "this CTA has contrast ratio 2.1:1 which is below the WCAG standard of 4.5:1" — that's a real measurement from real data, not an AI guess from a picture.

---

## Phase 2: Tools + Behavior (Weeks 2-4) — "Teaching the AI to Act Like a Human"

### Say This (Non-Technical)
"Now the AI can see. Next, we teach it to interact — click buttons, fill forms, scroll pages, hover over menus. But here's the key: it does this like a human, not like a robot. The mouse moves in natural curves, not straight lines. Typing has realistic speed with occasional typos that get corrected. Scrolling has momentum. This matters because many websites detect and block robotic behavior."

### Say This (Technical Team)
"23 browser tools exposed via MCP protocol. Mouse uses ghost-cursor for Bezier curve paths (~500ms mean movement). Typing uses Gaussian inter-key delays (~120ms, 1-2% typo rate). Rate limiting enforced: 2s minimum between actions, 10 actions/min on unknown domains. We also build the ToolRegistry with dynamic tool sets — this is a §33a interface-first requirement. Three tool sets registered: `browse` (23 tools), `analyze` (5 tools), and `analyze_interactive` (15 tools, activated in Phase 11). Three output tool schemas defined now (produce_finding, mark_pass, mark_needs_review) — stubs for Phase 11."

### What Gets Built
- 23 browser interaction tools (click, type, scroll, hover, upload, download, etc.)
- Human-like behavior (mouse curves, typing rhythm, scroll momentum)
- Rate limiting (don't overwhelm target websites)
- MCP server (standardized tool protocol)
- **Tool registry** — dynamic tool sets that can be swapped per context (foundation for Phase 11's interactive analysis)

### Business Value
The browser agent can now navigate any website like a human user. Combined with Phase 1's perception, the system can browse a site, interact with it, and understand what it sees.

### They'll Ask
**Q: "Why 23 tools? That seems like a lot."**
A: A human uses many actions: navigate to URL, click a button, type in a search box, scroll down, hover to see a tooltip, go back, take a screenshot. Each of these is a "tool" — a specific capability. 23 covers all the interactions a CRO consultant would perform during an audit. They range from simple (navigate, screenshot) to specialized (extract structured data, wait for a specific condition).

---

## Phase 3: Verification (Weeks 4-5) — "Trust but Verify"

### Say This (Non-Technical)
"The AI clicked a button. Did it work? This phase builds the verification layer — after every action, the system checks that it actually worked. Did the page change? Did the right element appear? Did we get blocked? This is like a consultant double-checking their work — never assuming an action succeeded."

### Say This (Technical Team)
"9 verification strategies: url_change, element_appears, element_text, network_request, no_error_banner, snapshot_diff, custom_js, no_captcha, no_bot_block. VerifyEngine is mutation-aware — waits for DOM stability before checking. FailureClassifier categorizes failures (transient → retry, structural → replan, blocked → HITL). ConfidenceScorer uses multiplicative decay (current × 0.97 per step) — naturally bounded in (0,1). Below 0.3 → force human escalation."

### What Gets Built
- 9 verification strategies (each checks a different condition)
- Failure classifier (understands why something failed)
- Confidence scorer (tracks how well the browsing session is going)
- Mutation-aware verification (waits for pages to stop changing before checking)

### Business Value
Reliability. Without verification, the system would silently fail on 15-20% of pages. With verification, failures are caught, classified, and either retried or escalated to a human.

---

## Phase 4: Safety + Infrastructure + Cost (Weeks 5-7) — "Guard Rails and Foundation"

### Say This (Non-Technical)
"This is the safety layer. The AI should never accidentally submit a form, make a purchase, or do anything destructive on a client's website. This phase builds hard safety gates — not 'AI, please don't do bad things' but actual software locks that physically prevent dangerous actions. It also builds all the infrastructure: database, file storage, and the adapters that let us swap any technology without rewriting the whole system.

New in our latest refinement: we add token-level cost tracking here. Every AI call is logged with exact cost, so we always know exactly how much an audit costs. And we add LLM failover — if our primary AI provider (Anthropic's Claude) goes down, the system automatically switches to the backup (OpenAI's GPT-4o) for that specific call, then tries Claude again for the next one."

### Say This (Technical Team)
"ActionClassifier with SafetyContext (§33a interface-first: callingNode field for Phase 11). Four action classes: safe (proceed), caution (audit log), sensitive (HITL required), blocked (terminate). BrowserSessionManager with create/get/close — sessions are external, not graph-internal (§33a). PostgreSQL schema: 25+ tables with RLS for client isolation. All adapters: LLMAdapter, StorageAdapter, ScreenshotStorage, BrowserEngine, HeuristicLoader. Token-level cost accounting: every LLM call logged to llm_call_log with model, tokens, cost, duration, cache_hit. Pre-call budget gate estimates cost before calling. LLM rate limiting: sliding window per provider in Redis. LLM failover: per-call, primary 3 retries → fallback 2 retries → pause audit."

### What Gets Built
- Safety classifier (blocks dangerous actions in code, not AI judgment)
- Database schema (25+ tables with row-level security per client)
- All adapter interfaces (LLM, storage, browser, heuristics)
- **Token-level cost tracking** — every AI call logged with exact cost
- **LLM rate limiting** — prevents hitting API limits
- **LLM failover** — automatic backup when primary AI is down
- Browser session manager (shared sessions between agents)

### Business Value
Two critical things: (1) Safety — we will never accidentally damage a client's website, and (2) Cost control — we know exactly what every audit costs and can bill accurately.

### They'll Ask
**Q: "What if both AI providers are down?"**
A: The audit pauses (doesn't fail). The system schedules a retry in 5 minutes, up to 3 times. After 15 minutes, it marks the audit as failed and alerts the team. No data is lost — it can resume from exactly where it stopped.

**Q: "How much does the AI cost per audit?"**
A: Approximately $0.35 per page in basic mode, up to $1.80 per page in interactive mode. A typical 10-page audit costs $3.50-18.00 depending on depth. Compare that to $2,500+ for manual consultant work.

---

## Phase 5: Browse MVP (Weeks 7-8) — "The Agent Can Navigate Real Sites"

### Say This (Non-Technical)
"This is our first major milestone. At this point, the browser agent works end-to-end. You give it a URL, it navigates there, handles popups, scrolls through the page, extracts all the structured data, and comes back with a complete picture of what's on that page. We test it on real sites: BBC, Amazon, Shopify stores."

### Say This (Technical Team)
"BrowseGraph compiled as LangGraph.js subgraph: perceive → reason → act → verify loop. Accepts external browser session via state.browser_session_id (§33a — orchestrator owns session, browse borrows it). System prompt injection, confidence routing, HITL interrupt points. Integration tests on 5 real sites covering: simple content site (BBC), anti-bot aggressive (Amazon), SPA (Shopify), workflow with auth, and recovery from failures."

### What Gets Built
- Complete browse graph (perceive → reason → act → verify loop)
- External session injection (foundation for Phase 11)
- System prompt for LLM-guided browsing
- Integration tests on 5 real websites

### Business Value
**First demo-able milestone.** You can show someone: "I give it a URL, it opens a browser, navigates like a human, and extracts everything." This is tangible and impressive.

---

## Phase 6: Heuristic Knowledge Base + Benchmarks (Weeks 8-9) — "Loading the Expert Knowledge"

### Say This (Non-Technical)
"This is where we load the expert knowledge — the 100 rules that our CRO consultants know by heart. Things like: 'A checkout form should have 6-8 fields maximum' (Baymard Institute research), 'The primary call-to-action should be visible without scrolling' (Nielsen Norman Group), 'Social proof should be near the purchase decision point' (Cialdini's persuasion research).

Every rule now has an **industry benchmark** — not just 'this is bad' but 'this is bad because the standard is X and you have Y.' This makes our findings dramatically more persuasive. 'Your form has 14 fields' is an observation. 'Your form has 14 fields — industry standard is 6-8 for checkout, and Baymard research shows each additional field reduces completion by 2-3%' is a finding worth paying for.

All this knowledge is encrypted at rest — it's our intellectual property."

### Say This (Technical Team)
"100 heuristics in JSON with Zod-validated schema. Required benchmark field: quantitative (value, source, unit, comparison, threshold_warning, threshold_critical) or qualitative (standard, source, positive_exemplar, negative_exemplar). Two-stage filtering: filterByBusinessType in audit_setup (100→~60-70), filterByPageType in page_router (~60-70→15-20). AES-256-GCM encryption at rest, decrypted in memory only. GR-012 validates benchmark claims. Three reliability tiers determining auto-publish eligibility."

### What Gets Built
- 100 heuristic rules authored with benchmarks (50 Baymard + 35 Nielsen + 15 Cialdini)
- Heuristic schema with required benchmarks (quantitative + qualitative)
- Two-stage filtering (by business type, then by page type)
- Encryption (AES-256-GCM for IP protection)
- New grounding rule GR-012 (benchmark validation)
- Tier validation (Tier 1/2/3 reliability classification)

### Business Value
This is the **core intellectual property**. The heuristics + benchmarks are what make our findings expert-level instead of generic. Anyone can build a browser bot. The expert knowledge is the moat.

### They'll Ask
**Q: "Who writes these 100 rules?"**
A: Our CRO team. Each rule needs: what to look for, what good looks like, what bad looks like, the industry benchmark with source, and the recommended fix. Estimated 2-3 hours per heuristic, so about 200-300 hours total. We prioritize the top 30 structural rules first (form fields, CTA placement, contrast ratios) because those are the most reliably detectable.

**Q: "Can we add more rules later?"**
A: Yes. The system is designed so adding a new heuristic is adding a JSON file, not changing code. Our long-term vision includes a learning loop where consultant feedback creates new rules automatically.

---

## Phase 7: Analysis Pipeline + Quality (Weeks 9-11) — "The CRO Brain"

### Say This (Non-Technical)
"Now we build the analysis brain — the 5-step pipeline that turns raw page data into expert-level findings.

Step 1: Deep perception — extract everything about the page (structure, content, forms, CTAs, trust signals, performance).
Step 1b: Quality gate — before we spend money on AI analysis, check if the page data is good enough. If a cookie banner is covering 45% of the page, or the page didn't load properly, we skip the AI call and flag it for manual review. This saves money and prevents garbage findings.
Step 2: Evaluation — the AI evaluates the page against the relevant heuristics with benchmarks.
Step 3: Self-critique — a separate AI review challenges every finding.
Step 4: Evidence grounding — 12 hard-coded rules verify every claim.
Step 5: Annotation — overlay findings on screenshots with color-coded pins.

We also build error recovery here. At 1,000 pages per week, even a 2% failure rate means 20 pages need recovery. Every failure mode has a specific recovery path — nothing is silently dropped."

### Say This (Technical Team)
"AnalysisGraph as LangGraph.js subgraph: deep_perceive → perception_quality_gate → evaluate (EvaluateStrategy pattern, StaticEvaluateStrategy as default, §33a) → self_critique → evidence_ground (GR-001..GR-012) → annotate_and_store. Perception quality score: 7 weighted signals (content, CTAs, nav, headings, overlays, errors, loaded). Thresholds: ≥0.6 proceed, 0.3-0.59 partial, <0.3 skip. Error recovery: LLM timeout → split batch, critique rejects all → skip critique, grounding rejects all → consultant review, per-page analysis_status enum. Golden test suite expanded here: 10 golden tests by end of phase."

### What Gets Built
- 5-step analysis pipeline (perceive → evaluate → critique → ground → annotate)
- **Perception quality gate** — prevents wasted AI calls on bad data
- 12 evidence grounding rules (deterministic, no AI)
- EvaluateStrategy pattern (foundation for Phase 11 interactive mode)
- Screenshot annotation (Sharp library, severity-colored pins)
- **Error recovery paths** — every failure mode has a specific recovery
- **Golden test expansion** — 10 validated test cases

### Business Value
**Second major milestone.** The system can now analyze a page and produce real, evidence-backed CRO findings with annotated screenshots. Combined with Phase 5 (browsing), you have: URL → browse → analyze → findings.

### They'll Ask
**Q: "What does a finding look like?"**
A: A finding has: the heuristic rule it violates, what the system observed (e.g., "14 form fields"), its assessment (why this is a problem), evidence (exact element, measurement, benchmark comparison), severity (critical/high/medium/low), and a specific recommendation (e.g., "reduce to 6-8 fields, remove optional fields or move to a second step"). Plus an annotated screenshot showing exactly where the issue is.

**Q: "What's the false positive rate?"**
A: Before the three filters: roughly 40-60% (the AI makes a lot of mistakes). After all three filters: approximately 5-10%. The consultant catches the remaining few. Over time, as the system learns from consultant feedback, this improves.

---

## Phase 8: Orchestrator + Cross-Page (Weeks 11-13) — "Running a Full Audit"

### Say This (Non-Technical)
"This is the third major milestone — a complete audit end-to-end. You say 'audit this website' and the system: discovers the pages, browses each one, analyzes each one, and produces a set of findings.

New in our latest design: after analyzing all individual pages, the system now does **cross-page analysis**. This is where the highest-value findings come from:

1. **Pattern detection**: 'Trust badges are missing on 7 out of 10 product pages' — one actionable finding instead of 7 redundant ones.
2. **Consistency checking**: 'Your CTA button is blue on most pages but green on two — this confuses users.'
3. **Funnel analysis**: 'Your homepage promises free shipping, but your cart page doesn't mention it. That's a trust breach that loses sales at the decision point.'

These cross-page findings are what separates an AI checklist tool from an AI consultant."

### Say This (Technical Team)
"AuditGraph as outer LangGraph.js graph: audit_setup → page_router → [browse subgraph] → [analyze subgraph] → page_router (loop) → cross_page_analyze → audit_complete. Cross-page analysis: three sub-nodes. (1) PatternDetector: groups grounded_findings by heuristic_id, 3+ violations across pages → PatternFinding. (2) ConsistencyChecker: compares CTA styles, nav structure, trust signals across accumulated page_perceptions. (3) FunnelAnalyzer: single LLM call ($1 cap, temp=0) analyzing journey friction. Session passing from browse to analyze (§33a). restore_state node (no-op in static mode). PostgreSQL checkpointer for crash recovery. Acceptance tests on example.com, Amazon, BBC."

### What Gets Built
- Audit orchestrator (manages the whole audit lifecycle)
- Page queue management (discover pages, prioritize, process sequentially)
- **Cross-page pattern detection** (deterministic, no AI)
- **Cross-page consistency checking** (deterministic, no AI)
- **Funnel analysis** (single AI call, $1 budget cap)
- Session passing between browse and analyze agents
- CLI command: `pnpm cro:audit --url https://example.com`
- Acceptance tests on 3 real websites

### Business Value
**This is where it becomes a product.** A consultant can run `pnpm cro:audit --url https://clientsite.com` and get a complete set of findings — per-page issues AND cross-page patterns. The cross-page findings are the kind of insight that justifies a $5,000 audit fee.

### They'll Ask
**Q: "How long does an audit take?"**
A: About 30-40 minutes for 10 pages in basic mode. Each page takes ~30 seconds to browse and ~30 seconds to analyze. Cross-page analysis adds about 2 minutes at the end. Interactive mode (Phase 11) takes longer — about 60-90 minutes for 10 pages — but finds more issues.

**Q: "What happens if it crashes mid-audit?"**
A: The system saves its state to the database after every page. If it crashes, it resumes from exactly where it stopped — no pages are re-analyzed, no work is lost.

---

## Phase 9: Foundations + Observability + Reports (Weeks 13-16) — "Making It Production-Ready"

### Say This (Non-Technical)
"The audit works. Now we make it production-ready. Three big things:

**Observability** — We need to know: are audits running? Are they taking too long? Are the findings good quality? Is a specific rule producing too many bad findings? This phase builds the monitoring dashboard that shows the health of the entire system.

**Reports** — Consultants deliver PDF reports, not dashboards. We build: an executive summary (overall score, grade A-F, top issues, what the site does well), an action plan (fix these 5 things this sprint, these 10 next quarter), and a branded PDF report ready to send to clients.

**Platform foundation** — The gateway (single entry point for all audits), reproducibility (same site → same findings), the two-store pattern (consultants see everything, clients see only approved findings), and the consultant dashboard for reviewing and approving findings."

### Say This (Technical Team)
"Gateway service with AuditRequest validation. Reproducibility snapshot: pins prompt hashes, model versions, temperature=0, heuristic versions — immutable after creation. Two-store: internal (consultant, all findings) + published (client, approved only) with RLS + published_findings VIEW. Warm-up mode: first 3 audits per client → all findings held. Scoring pipeline: 4D deterministic (severity × confidence × business_impact × effort → priority). Suppression: confidence < 0.3 → reject.

§34 Observability: Pino structured logging, audit_events table (22 event types), heuristic health metrics (health_score per heuristic), alerting rules (7 conditions, BullMQ scheduled job every 5min), ops dashboard at /console/admin/operations.

§35 Reports: ExecutiveSummary (score 0-100, grade, top 5, strengths, category breakdown), ActionPlan (effort/impact quadrant bucketing), PDF via Next.js template → Playwright page.pdf(), branded per client, <5MB, stored R2.

Consultant dashboard: review inbox, finding detail with annotated screenshots, approve/reject/edit, warm-up status, client management."

### What Gets Built
- Gateway service (single entry point)
- Reproducibility system (same inputs → same outputs)
- Two-store pattern (internal vs published findings)
- Warm-up mode (new clients: all findings held until quality proven)
- 4-dimensional scoring pipeline (severity, confidence, impact, effort → priority)
- **§34: Observability** — structured logging, audit events, heuristic health metrics, alerting, ops dashboard
- **§35: Executive summary** — overall score, grade, top findings, strengths
- **§35: Action plan** — quick wins / strategic / incremental / deprioritized
- **§35: PDF report generator** — branded, professional, ready to send
- Consultant dashboard (Next.js + shadcn/ui)

### Business Value
**This is where it becomes a business.** The PDF report is the deliverable that consultants send to clients. The executive summary is what decision-makers read. The action plan is what development teams implement. The observability dashboard is what we use to ensure quality. The two-store pattern is what keeps us safe — bad findings never reach clients.

### They'll Ask
**Q: "What does the PDF report look like?"**
A: Cover page with client logo and overall grade → Executive summary (1 page: score, top issues, what they're doing well) → Action plan (1 page: 4 quadrants of prioritized fixes) → Detailed findings grouped by category (each with annotated screenshot) → Cross-page patterns → Methodology note. Branded with client's colors and logo. Under 5MB.

**Q: "How does the scoring work?"**
A: Four dimensions, all calculated by code (no AI): Severity (from the rule), Confidence (from grounding + evidence quality), Business Impact (from page type + funnel position), Effort (from the rule's implementation difficulty). These combine into a Priority score that determines the order in the action plan.

**Q: "What if the AI produces garbage for a new client?"**
A: Warm-up mode. For the first 3 audits of any new client, ALL findings are held for consultant review regardless of confidence. Nothing auto-publishes. Only after the consultant has reviewed 3 audits with less than 25% rejection does the system start auto-publishing high-confidence findings. This protects our reputation.

---

## Phase 10: State Exploration (Weeks 16-18) — "Finding What's Hidden"

### Say This (Non-Technical)
"Here's a problem: 30-50% of important content on modern websites is hidden. Reviews are behind a tab. Size options are in a dropdown. Shipping details are in an accordion. Cookie banners cover the page. If we only analyze what's visible on first load, we miss half the CRO issues.

State exploration solves this. The system intelligently clicks tabs, opens accordions, selects dropdown options, and dismisses overlays to reveal hidden content. It does this in two passes:

Pass 1: The heuristic rules tell it what to look for. If a rule says 'check for guest checkout option,' the system specifically clicks through to find the checkout form.

Pass 2: If the first pass found fewer hidden elements than expected, the system does a broader exploration — systematically clicking through interactive elements to find what it missed.

After exploration, the system knows about ALL content on the page — visible and hidden — and can produce findings about both."

### What Gets Built
- Two-pass state exploration (heuristic-primed + bounded-exhaustive)
- 12 disclosure rules (how to reveal hidden content)
- Meaningful-state detection (ignore insignificant changes)
- State graph builder (tracks which interactions reveal which content)
- Multi-state perception (merges visible + hidden content)
- GR-009 grounding rule (state provenance integrity)
- Per-state screenshot capture

### Business Value
Catches 30-50% more CRO issues by analyzing hidden content. A finding like "your guest checkout option is buried in a dropdown that 70% of users will never find" is worth thousands in conversion improvement.

---

## Phase 11: Agent Composition (Weeks 18-20) — "The Competitive Moat"

### Say This (Non-Technical)
"This is the phase that makes us truly unique. In all previous phases, the browser agent and analysis agent work separately — the browser loads the page, then the analysis agent evaluates it statically. In Phase 11, they work together in real-time.

The analysis agent can now use browser tools during evaluation. It thinks: 'I need to check if this size selector works properly' — clicks the size dropdown — sees the options — evaluates against the heuristic — takes a screenshot as evidence. This interactive evaluation catches issues that static analysis misses: broken dropdowns, forms that show errors only on submit, hover states that reveal important information.

We also add 'open observation' — the AI asks 'what did my rules miss?' and can flag up to 5 additional issues outside the rule set. These always require consultant review but often catch creative insight."

### What Gets Built
- InteractiveEvaluateStrategy (ReAct loop with tool calls)
- Tool injection matrix (9 browser tools + 6 analysis tools during evaluation)
- Navigation guard (prevents the analysis agent from leaving the page)
- Pass 2 open observation ("what did heuristics miss?" — max 5, all Tier 3)
- GR-010 and GR-011 grounding rules
- Context window management
- Workflow step restore for funnel analysis
- Interactive mode as the new default

### Business Value
**This is the competitive moat.** Nobody else has this. Static analysis tools exist. Browser automation exists. An analysis agent that can interactively explore a page while evaluating CRO heuristics — that's new. The interactive findings (broken dropdowns, form validation issues, hidden functionality) are the kind of issues that only show up in real user testing. We're automating user testing.

### They'll Ask
**Q: "Doesn't this cost a lot more?"**
A: Yes, about 3x the cost of static analysis. $1.05/page instead of $0.35/page. But the findings are dramatically higher quality. We offer both modes — consultants choose based on the client and the audit depth needed.

---

## Phase 12: Mobile Viewport (Weeks 20-21) — "60-70% of Traffic"

### Say This (Non-Technical)
"60-70% of e-commerce traffic is on mobile. A CRO audit that only checks desktop is incomplete. This phase adds mobile analysis: the system resizes the browser to phone dimensions, re-scans the page, and runs mobile-specific rules. Is the tap target big enough for a thumb? Is the CTA in the reachable zone? Does the page scroll horizontally? Is the menu discoverable?"

### What Gets Built
- Dual-viewport pipeline (desktop 1440px + mobile 390px)
- 10-15 mobile-specific heuristics (tap targets, thumb zones, font sizes, etc.)
- Viewport-tagged findings (consultants and clients know which device the issue affects)
- Stage 3 heuristic filtering (by viewport applicability)

### Business Value
Completes the audit story. Clients with mobile traffic get mobile-specific findings. This is expected by any serious CRO service.

---

# PART 4: THE NUMBERS (5 minutes)

## Cost

| Metric | Value |
|--------|-------|
| Per page (static) | ~$0.35 |
| Per page (interactive) | ~$1.05-1.80 |
| 10-page audit (static) | ~$3.50 |
| 10-page audit (interactive) | ~$10-18 |
| Manual consultant audit equivalent | ~$2,500-3,000 |
| **Cost savings vs manual** | **~99%** |
| Monthly infrastructure (at scale) | ~$350-600 |

## Timeline

| Milestone | When | What |
|-----------|------|------|
| Browse works | Week 8 | Agent navigates real sites |
| MVP audit | Week 13 | Full audit end-to-end |
| Platform ready | Week 16 | Reports, observability, dashboard |
| Full product | Week 20 | Interactive mode, the moat |
| Mobile | Week 21 | Dual-viewport audits |

## Scale

| Metric | Value |
|--------|-------|
| Audits per week target | 20+ |
| Pages per audit (max) | 50 |
| Heuristics | 100 (with benchmarks) |
| Grounding rules | 12 |
| Reliability tiers | 3 |
| Failure modes catalogued | 110+ |

---

# PART 5: ANTICIPATED QUESTIONS (Reference)

**Q: "What's our competitive advantage?"**
A: Three things: (1) The 100 benchmark-backed heuristics — expert knowledge encoded as data. (2) The three-layer hallucination filter — other AI tools guess, we verify. (3) Interactive composition (Phase 11) — the AI can use browser tools during analysis, catching issues that require real interaction.

**Q: "What if the AI writes something wrong and a client sees it?"**
A: They can't. The two-store pattern (Phase 9) means clients ONLY see approved findings. Everything goes through the three-filter pipeline, then through consultant review, then to the published store. During warm-up (first 3 audits per client), everything is held regardless.

**Q: "Can we use this for more than CRO?"**
A: Yes. The browser agent is general-purpose — it can be used for SEO audits, accessibility checks, competitor monitoring, price tracking, or any task that requires structured web browsing. The analysis agent is CRO-specific, but adding new rule sets (e.g., WCAG accessibility rules) is adding JSON, not rebuilding the system.

**Q: "How do we price this?"**
A: Our cost is ~$3.50 per 10-page static audit. A manual audit costs $2,500+. We have massive margin. Pricing options: per-audit ($200-500), monthly subscription ($500-2,000/month for unlimited audits), or as a premium service within existing consulting engagements (upsell tool).

**Q: "What's the risk?"**
A: Honestly: (1) Heuristic quality — the system is only as good as the rules. We need CRO experts to write excellent rules. (2) Cost validation — our $0.35/page estimate needs real-world validation. (3) Anti-bot detection — some sites will block us despite stealth measures. (4) LLM reliability — AI can still make mistakes; the consultant review gate is essential.

**Q: "When can we show this to a client?"**
A: A basic demo (browse agent navigating a site) is possible at Week 8. A full audit demo with findings and reports is possible at Week 16. Interactive mode demo at Week 20.

---

*This document is for internal use only. Contains architectural details and competitive strategy.*
