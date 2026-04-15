# Section 1 — System Identity

> **G9-FIX: Scope Note.** This section describes the FULL end-state platform identity. §01-§17 (original files) specify the agent internals and MVP platform. §18-§30 (master extensions) specify the platform capabilities that evolve across Phases 6-16. Both layers are architecturally locked. The MVP is a subset extracted from the combined architecture — see §16.5.

## 1.1 What This Is

An AI-powered CRO audit platform that:
1. **Crawls** client websites (and competitor sites) using a browser agent with human-like behavior
2. **Analyzes** each page against a curated heuristic knowledge base (Baymard, Nielsen, Cialdini)
3. **Validates** every finding through a 3-layer anti-hallucination filter (CoT → self-critique → evidence grounding)
4. **Annotates** screenshots with finding markers for visual communication
5. **Compares** client vs competitor implementations using pairwise analysis
6. **Tracks** changes across audit versions (resolved / persisted / new findings)
7. **Exposes** findings via MCP server (for LLM queries) + dashboard (for humans)
8. **Gates** publishing through confidence-based review (auto-publish / delayed / consultant-held)

### Users

| User | Role | Interface |
|------|------|-----------|
| **CRO Consultant** | Runs audits, reviews/approves findings, manages clients | Consultant dashboard |
| **Client** | Views published findings, tracks improvement | Client dashboard |
| **LLM / AI Agent** | Queries findings programmatically | CRO Audit MCP Server |

### Scale Target

20+ audits per week with scheduling, concurrent execution, and automated re-runs.

## 1.2 What This Is NOT (Yet)

| Not Now | Future Phase | Interface Defined? |
|---------|-------------|-------------------|
| Fix code generation (HTML/CSS patches) | Post-MVP | ✅ `FixGenerator` interface |
| A/B test variant generation (VWO, Optimizely) | Post-MVP | ✅ `ABTestGenerator` interface |
| Design recommendation mockups | Post-MVP | ✅ `DesignRecommender` interface |
| SEO audit tooling | Deferred | ❌ |
| WCAG accessibility scoring | Deferred | ❌ |
| DX integrations (GA4, Contentsquare, FullStory) | Deferred | ❌ |
| Conversion prediction | **Never** | N/A — research proves unreliable |

## 1.3 Reality Check

### What LLM Analysis CAN Do (Reliably)

| Capability | Reliability | Source |
|-----------|------------|--------|
| Detect missing elements (no CTA, no trust signals) | **High (>80%)** | MLLM UI Judge (2025) |
| Evaluate visual hierarchy and layout | **High (>75%)** | MLLM UI Judge (2025) |
| Count form fields and check labels | **High (>90%)** | Deterministic from page data |
| Check above/below fold placement | **High (>90%)** | Deterministic from bounding box |
| Color contrast issues | **High (>85%)** | Deterministic from computed styles |
| Cross-page consistency | **Medium (~65%)** | AIHeurEval (CHI 2025) |
| Copy quality and clarity | **Medium (~60%)** | GPT-4o vs Experts (2025) |
| Persuasion technique usage | **Medium (~55%)** | Requires context understanding |

### What LLM Analysis CANNOT Do (Unreliably)

| Capability | Reliability | What We Do Instead |
|-----------|------------|-------------------|
| Predict conversion impact | **Low (<30%)** | State heuristic violation + research backing. Never predict numbers. |
| Assign reliable severity | **Low (~56%)** | Severity tied to measurable evidence, not LLM opinion. |
| Evaluate ease of use | **Low (~40%)** | Tag as Tier 3, require consultant review. |
| Assess emotional response | **Low (<35%)** | Tag as Tier 3, require consultant review. |
| Match human expert findings | **Low (21.2% overlap)** | Treat findings as hypotheses. Evidence grounding validates. |

### Core Design Principle

> **The analysis agent produces HYPOTHESES, not VERDICTS. Every finding must survive three filters (CoT generation, self-critique review, code-level evidence grounding) before reaching a client. The system surfaces probable issues for human experts to validate, not replace human judgment.**

## 1.4 Research-Grounded Design Principles

| # | Principle | Source | How We Apply |
|---|-----------|--------|-------------|
| R-1 | Findings are hypotheses, not verdicts | GPT-4o vs Experts: 21.2% overlap | 3-layer validation filter |
| R-2 | Severity must be evidence-grounded | Krippendorff's Alpha ~0 for LLM severity | Severity from measurable data, not LLM opinion |
| R-3 | Visual/structural reliable, emotional not | MLLM UI Judge: >75% vs <40% | 3 reliability tiers on heuristics |
| R-4 | Multi-screen consistency matters | AIHeurEval (CHI 2025) | Cross-page consistency checks |
| R-5 | Browser interaction catches what screenshots miss | UXAgent (Amazon, CHI 2025) | Dual-mode: browse + analyze |
| R-6 | Pairwise comparison > absolute scoring | WiserUI-Bench, MLLM UI Judge | Competitor comparison is pairwise |
| R-7 | Never predict conversion impact | WiserUI-Bench (2025) | Explicit ban in prompts + grounding rule GR-007 |

## 1.5 Research Papers Referenced

| Paper | Year | Key Finding | How We Use It |
|-------|------|------------|--------------|
| GPT-4o vs Human Experts on Nielsen's Heuristics | 2025 | 21.2% overlap, severity scoring unreliable | Evidence grounding layer, reliability tiers |
| MLLM as a UI Judge | 2025 | >75% on visual, <40% on emotional | Heuristic reliability tier assignment |
| WiserUI-Bench | 2025 | LLMs can't predict which UI converts better | Never predict conversion, pairwise comparison |
| UXAgent (Amazon, CHI 2025) | 2025 | Browser agent catches interaction issues screenshots miss | Dual-mode architecture |
| AIHeurEval (HCI International 2025) | 2025 | Cross-screen consistency evaluation is valuable | Cross-page consistency checks |
| LLM Feedback on UI Mockups (Berkeley, CHI 2024) | 2024 | Configurable heuristic sets + CoT prompting works | Filtered heuristics + CoT |
| WebUIBench | 2025 | UI perception, HTML programming benchmarks | Tool design validation |
| DesignBench | 2025 | Front-end code generation benchmarks | Future fix-generation validation |
