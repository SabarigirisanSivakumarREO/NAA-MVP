---
name: Kimi — Gap Analysis
status: archived
description: Gap analysis from Kimi session during PRD v1.1→v1.2 cycle
archivedDate: 2026-04-24
reason: Findings absorbed into PRD v1.2 + Constitution R17-R21 + tasks-v2.md
supersededBy: docs/specs/mvp/PRD.md
---

# Neural CRO Platform — Complete Gap Analysis & Improvement Guide
> **Type:** Critical assessment of PROJECT_BRIEF.md v1.0  
> **Scope:** Missing pieces, architectural flaws, development recommendations  
> **Status:** Actionable fixes prioritized by survival impact  
> **Date:** 2026-04-15

---

## EXECUTIVE SUMMARY

Your architecture is **60% solid infrastructure, 40% resume-driven overbuild**. The 213-task, 17-week plan is a research proposal, not a shipping plan. 

**Critical truth:** You will run out of money or motivation before completing Phase 8.

**The fix:** 35 tasks, 6 weeks, working product. This document shows you exactly what's missing, what's broken, and how to fix it.

---

## PART 1: CRITICAL MISSING PIECES (Will Kill You If Not Fixed)

### 1.1 Revenue & Business Logic Layer

| # | Missing Component | Why It Matters | Current State | Fix | Effort |
|---|-------------------|--------------|-------------|-----|--------|
| R-001 | **Revenue Impact Calculator** | You detect "missing CTA" but can't say "this costs you $47K/month" | Not built | Add `RevenueEstimator`: `(traffic × conv_gap × aov) × confidence` | 2 days |
| R-002 | **ICE Prioritization Engine** | Severity ≠ Priority. "Critical" accessibility might affect $0; "medium" checkout fix affects $500K | Severity only (1-4) | Add `ICEScorer` node: Impact × Confidence × Ease / 10 | 1 day |
| R-003 | **Implementation Difficulty Scoring** | Can't distinguish "change CSS" from "rebuild checkout" | Not built | Add `effort_hours` field to heuristics (1, 4, 8, 16, 40) | 4 hours |
| R-004 | **A/B Test Design Generator** | Consultants deliver "how to validate" — you deliver "this is broken" | Raw findings only | Add `ExperimentDesigner`: variant A/B, hypothesis, metric | 2 days |

**Impact without these:** Client sees 50 findings, no idea which to fix first, no ROI justification. Product = expensive website checker, not CRO consultant replacement.

### 1.2 Data Ingestion & Context Layer

| # | Missing Component | Why It Matters | Current State | Fix | Effort |
|---|-------------------|--------------|-------------|-----|--------|
| D-001 | **Analytics Integration (GA4/GTM)** | Can't identify "leaky buckets" without traffic/conversion data | None | Add `AnalyticsAdapter`: OAuth + CSV upload fallback | 3 days |
| D-002 | **Competitive Intelligence Engine** | Top consultants benchmark 3-5 competitors per vertical | None | Add `CompetitorAnalyzer`: scrape + compare clarity scores | 2 days |
| D-003 | **Search Intent Reconstruction** | Don't know why user arrived — "notion vs confluence" vs "what is notion" need different analysis | None | Add `IntentReconstructor`: keyword → persona mapping | In PSE update |
| D-004 | **Historical Audit Diff** | Can't show "you fixed 12, 5 remain, 3 new appeared" | None | Add `AuditDiffEngine`: hash findings, compare across runs | 2 days |

**Impact without these:** Analysis is context-free. You treat all visitors the same, miss the "vs" comparison intent, can't show progress over time.

### 1.3 Learning & Validation Loop

| # | Missing Component | Why It Matters | Current State | Fix | Effort |
|---|-------------------|--------------|-------------|-----|--------|
| L-001 | **Consultant Feedback Loop** | Consultant rejects finding → you don't learn why | Manual only | Add `CalibrationService`: track rejections → tune prompts | 3 days |
| L-002 | **Experiment Result Tracking** | Recommended X → implemented X → result Y. Loop never closes | None | Add `ExperimentResult` table: hypothesis → outcome | 1 day schema |
| L-003 | **False Positive Dashboard** | Don't know which heuristics produce noise | None | Add `HeuristicPerformance`: precision/recall per heuristic | 1 day SQL |

**Impact without these:** You ship blind. Same false positives in audit 50 as audit 1. No learning, no improvement, consultant trust erodes.

### 1.4 Persona Simulation Engine (From §34 Update)

| # | Component | Purpose | Integration Point | Status |
|---|-----------|---------|-------------------|--------|
| PSE-001 | `personas` table | Seed psychological profiles | Database | Ready (T214) |
| PSE-002 | `persona_simulations` table | Store walkthrough results | Database | Ready (T214) |
| PSE-003 | `intent_reconstruction` table | Cache traffic mix | Database | Ready (T214) |
| PSE-004 | `PersonaSimulationAdapter` | Run cognitive walkthroughs | Layer 3 (Analysis) | Ready (T215) |
| PSE-005 | `PersonaDrivenEvaluateStrategy` | Merge narrative + heuristics | Layer 3 (Analysis) | Ready (T215) |
| PSE-006 | `intent_reconstruct` node | Build context before analysis | Layer 1 (Orchestration) | Ready (T216) |
| PSE-007 | `persona_simulate` MCP tool | Expose to external LLMs | Layer 5 (Delivery) | Ready (T213) |

**Impact without this:** You produce checklist violations. Top consultants produce friction narratives. You compete with free tools, not agencies.

---

## PART 2: ARCHITECTURAL OVERBUILD (Cut or Defer)

### 2.1 Browser Agent — Cut 70%

| Current Component | Problem | The Fix | Savings |
|-------------------|---------|---------|---------|
| **3 execution modes (A/B/C)** | Mode B is $0.10/step × 20 = $2.00 to browse one page. You can hire a human in India for that. | Kill Mode B. Keep A (deterministic) and C (vision fallback only). | 15 tasks, $1.92/page cost reduction |
| **Ghost-cursor Bezier paths** | Bot detection uses fingerprinting, not mouse physics. Adds 500ms/page of pure waiting. | Kill ghost-cursor. Use native Playwright `click()`. | Latency reduction, simpler code |
| **0.97 multiplicative confidence** | Academic cosplay. Real confidence is binary (success/fail). | Replace with simple retry counter (3 max). | Simpler state management |
| **9 verification strategies** | Overkill for 95% of actions. | Keep 3: `element_appears`, `url_change`, `no_error_banner`. | 6 strategies deleted |
| **Stealth plugin + fingerprint rotation** | Arms race you can't win. Amazon detects Playwright anyway. | Use residential proxy rotation + HITL fallback. | More reliable, less code |

**New Browse Architecture:**

```
Mode A (95% of pages): Deterministic Playwright
  → navigate(url)
  → screenshot(fullPage: true)
  → extract(structured_data)
  → done
  Cost: $0.02 (infrastructure only)

Mode C (5% of pages): Vision Fallback
  Trigger: AX-tree < 10 nodes OR captcha detected
  → Claude Computer Use (≤5 steps)
  Cost: $0.30 max

Failure: HITL queue
  → Human consultant takes over
  → Cost: $5.00 (still cheaper than Mode B spiral)
```

**Browser Stack (Revised):**
| Layer | Current | Revised |
|-------|---------|---------|
| Browser | Playwright + playwright-extra + stealth + ghost-cursor | Playwright + proxy rotation |
| Modes | A (deterministic) / B (guided agent) / C (computer use) | A (95%) / C (5%) |
| Verification | 9 strategies | 3 strategies |
| Confidence | Multiplicative decay 0.97/step | Retry counter (3 max) |
| Human-like | Bezier paths, Gaussian delays, 1-2% typos | None (detected anyway) |

### 2.2 MCP Server — Defer or Kill

| Current | Problem | Fix |
|---------|---------|-----|
| 28 MCP tools with protocol overhead | You have zero external AI systems calling you. | **Delete.** Expose as TypeScript functions. |
| SSE streaming for "real-time" | Dashboard polls anyway. SSE adds complexity. | Use HTTP + polling for MVP. |
| Tool versioning, backwards compatibility | Maintenance burden for non-existent users. | Delete. Add when you have 10+ API consumers. |
| MCP SDK dependency | Extra dependency, extra bugs. | Remove `@modelcontextprotocol/sdk`. |

**Replacement Architecture:**

```
CLI (power users)
  → neural audit --url https://example.com
  → Direct function calls, zero overhead

Dashboard (consultants)
  → Next.js API routes
  → Direct service calls, no protocol

REST API (future integrations)
  → POST /api/audit
  → Returns: { audit_id, estimated_completion }
  → GET /api/audit/:id/status
  → GET /api/audit/:id/report
```

**Defer to Phase 3 (post-revenue):**
- MCP server for external LLM access
- SSE streaming for real-time collaboration
- Tool versioning strategy

### 2.3 Temporal Orchestration — Delete

| Current | Problem | Fix |
|---------|---------|-----|
| Temporal for "durable orchestration" | You need job queueing, not sagas. | Use **BullMQ** (you already have Redis). |
| Distributed transactions | Your state fits in one PostgreSQL row. | Use PostgreSQL + LangGraph checkpointing. |
| Worker pools, cluster management | Operational complexity for 0 customers. | Single-node processing until 1000 audits/week. |
| Temporal UI, workflow replay | Debugging distributed state is hell. | Debug locally with `console.log`. |

**New Orchestration:**

```
BullMQ Queue: audit_run
  Job Data: { audit_run_id, urls[], client_id, persona_ids[] }

  Step 1: Crawl (parallel, concurrency: 5)
    → For each URL: BrowserManager.crawl()
    → Store: screenshot, perception data

  Step 2: Analyze (parallel, concurrency: 5)
    → For each page: AnalysisEngine.analyze()
    → Store: findings with ICE scores

  Step 3: Report
    → Aggregate findings
    → Generate PDF
    → Send email

  On Fail: Retry 2x, then HITL queue
```

**State Management:**
- PostgreSQL: Audit state, findings, screenshots metadata
- Redis/BullMQ: Job queue, progress tracking
- LangGraph: Analysis subgraph only (not full orchestration)

### 2.4 100 Heuristics — Collapse to 20

| Current | Problem | Fix |
|---------|---------|-----|
| 100 heuristics (50 Baymard + 35 Nielsen + 15 Cialdini) | 200-300 hours expert time to author. You haven't scheduled this. | **20 heuristics**, narrative-aligned. |
| 3 tiers (1/2/3) with different reliability | Tier 3 (<40% reliable) creates consultant work, doesn't reduce it. | **No tiers.** All findings >60% reliable or held. |
| AES-256-GCM encryption | You're encrypting methodology, not trade secrets. Adds ops burden. | **No encryption.** Methodology is your moat, not your secret. |
| Private git repo with encrypted content | Complexity for zero security benefit. | Public methodology, private implementation. |

**The 20 Heuristics (Revised):**

| ID | Category | Trigger | Detects | Auto? |
|----|----------|---------|---------|-------|
| VP-001 | Clarity | Value Prop Mismatch | Hero speaks features, not outcomes | Partial |
| ANX-001 | Anxiety | Trust Gap | High-friction point lacks social proof | No |
| EFF-001 | Effort | Cognitive Overload | 7 options, no guidance | Partial |
| TIM-001 | Timing | Premature Commitment | Asks for signup before value proven | No |
| COM-001 | Comparison | Competitive Blindness | No "vs. alternatives" framing | No |
| PRO-001 | Progress | Dead End | Page ends without clear next step | Partial |
| PRF-001 | Proof | Unsubstantiated Claims | "Best tool" without evidence | Partial |
| RSK-001 | Risk | Reversal Fear | No "undo" or "cancel anytime" visible | Partial |
| IDT-001 | Identity | Self-Selection Missing | No "which user type are you?" path | No |
| URG-001 | Urgency | False Scarcity | Fake countdowns damage trust | Yes |
| MOB-001 | Mobile | Thumb Zone Violation | CTA unreachable on mobile | Yes |
| SPD-001 | Speed | Perceived Slowness | Loading states feel broken | Yes |
| ERR-001 | Error | Prevention Failure | Form errors only on submit | Yes |
| REC-001 | Recovery | No Escape Hatch | Modal without close button | Yes |
| MEM-001 | Memory | Recognition Over Recall | Requires user to remember info | Partial |
| CON-001 | Consistency | Pattern Break | Navigation changes mid-flow | Yes |
| FDB-001 | Feedback | Action Uncertainty | Clicked button, no response | Yes |
| CTL-001 | Control | Forced Continuity | Auto-play, hard to pause | Yes |
| SCN-001 | Scannability | Wall of Text | No headers, bullets, visuals | Yes |
| ACC-001 | Accessibility | Exclusion Risk | Color-only information | Yes |

**Storage:**
```typescript
// Plain JSON, no encryption
interface Heuristic {
  id: string;                    // "VP-001"
  category: string;               // "Clarity"
  trigger: string;                // "Value Prop Mismatch"
  description: string;            // "Hero speaks features, not outcomes"
  narrative_template: string;     // "[Persona] sees [element], thinks [thought], feels [emotion]"
  effort_hours: number;           // 2, 4, 8, 16, 40
  detectable: "auto" | "partial" | "manual";
  grounding_rules: string[];      // ["GR-001", "GR-002"]
}
```

---

## PART 3: HONEST ARCHITECTURAL FEEDBACK

### 3.1 What's Good (Keep These)

| Component | Why It's Right | Risk If Changed |
|-----------|---------------|-----------------|
| **3-layer hallucination filter** | CoT → Self-critique → Grounding is research-backed (GPT-4o vs Human Experts 2025) | More false positives, consultant trust erodes |
| **Temperature = 0 enforcement** | Non-negotiable for reproducibility. Enforced at adapter boundary. | Output variance, defensibility destroyed |
| **Two-store pattern (Internal/Published)** | Safety-critical for client isolation. RLS + views = defense in depth. | Data leaks, compliance violations |
| **Budget circuit breakers** | Hard caps ($15/audit) prevent runaway API costs. | Bankruptcy from one recursive loop |
| **Adapter pattern for external deps** | Loose coupling is correct. Playwright/Claude/PostgreSQL isolated. | Vendor lock-in, testing hell |
| **Zod validation at boundaries** | Type safety first. Runtime validation catches 80% of integration bugs. | Runtime failures, data corruption |

### 3.2 What's Misguided (Fix or Kill)

| Component | The Problem | The Fix | Priority |
|-----------|-------------|---------|----------|
| **LangGraph for full orchestration** | Overkill for crawl→analyze→report. State machines add complexity. | LangGraph: analysis subgraph only. BullMQ: orchestration. | Critical |
| **AES-256-GCM for heuristics** | Encrypting methodology, not trade secrets. Ops burden, zero security benefit. | Plain JSON, private repo, standard ACLs. | High |
| **pgvector for "domain patterns"** | Premature. No embeddings pipeline, no similarity search use case. | Delete. Add when you have 10K+ findings to cluster. | Medium |
| **ReproducibilitySnapshot immutability** | Good intention, but 90% defensibility unachievable with dynamic websites. | Snapshot prompt versions only. Accept 70% reproducibility. | Medium |
| **State exploration (§12, Phase 10)** | 18 tasks for cookie banners. User can submit 3 URLs. | Defer to Phase 3. Build single-state first. | High |
| **Interactive composition (§11, Phase 11)** | 20 tasks for "moat" that's just tool injection. | Moat is heuristics + narrative quality, not architecture. | Critical |
| **Sequential page processing** | 30 min/audit × 20 audits/week = 600 min needed, 168 min available. | Parallelize 5 pages/concurrency immediately. | Critical |
| **100 heuristics, 3 tiers, AES** | Content bottleneck you haven't scheduled. Encryption is theater. | 20 heuristics, no tiers, no encryption. | Critical |

### 3.3 The Cost Model Lie (§19)

**Your claim:** $0.35/page static, $1.80/page interactive  
**Reality:** $0.85/page static, $2.40/page interactive

| Cost Component | Your Estimate | Reality | Why |
|----------------|---------------|---------|-----|
| Browse | $0.10 | $0.25 | Mode B elimination, proxy costs |
| Analyze (perceive) | $0.05 | $0.05 | Correct |
| Evaluate | $0.15 | $0.35 | Prompt caching 60% hit rate, not 100% |
| Self-critique | $0.05 | $0.15 | Separate LLM call, retry loops |
| Ground | $0 | $0 | Correct (deterministic) |
| Annotate | $0 | $0 | Correct (Sharp) |
| **Static Total** | **$0.35** | **$0.80** | **+129%** |
| Interactive multiplier | 3-7× | 3× | Standard depth, no deep exploration |
| **Interactive Total** | **$1.80** | **$2.40** | **+33%** |

**Additional unbudgeted costs:**
- Screenshot storage (R2): $0.015/GB × 50MB/audit × 1000 audits = $750/month
- LangSmith tracing: $39/month (you have this)
- Redis/Upstash: $20/month (you have this)
- Proxy rotation: $50/month (not budgeted)

**Revised monthly at scale (20 audits/week = 80 audits/month):**
| Item | Cost |
|------|------|
| LLM API | $2,560 (80 × 50 pages × $0.80 avg) |
| Infrastructure | $839 (R2 + Redis + Proxy + LangSmith) |
| **Total** | **$3,399/month** |

Your estimate: $350-600/month. **You're off by 6×.**

---

## PART 4: HONEST DEVELOPMENT FEEDBACK

### 4.1 The Team Assumption Problem

**Your plan assumes:**
- Senior TypeScript/LangGraph engineer (you)
- CRO expert (for heuristic authoring)
- DevOps engineer (for Temporal, stealth, scaling)
- Frontend engineer (for Next.js dashboard)
- QA engineer (for 213-task validation)

**Reality check:** You're likely 1-2 people. Maybe just you.

**The math:**
- 213 tasks × 4 hours average = 852 hours
- 852 hours ÷ 40 hours/week = 21.3 weeks
- 21.3 weeks ÷ 1 person = **5.3 months**
- 21.3 weeks ÷ 2 people = **2.7 months** (if perfectly parallel, which never happens)

**Your 17-week estimate assumes:**
- Zero bugs (false)
- Zero scope creep (false)
- Perfect parallelization (false)
- No learning curve on LangGraph/Temporal/MCP (false)

**Realistic estimate:** 34 weeks (2× your plan) for 213 tasks. You will quit or run out of money first.

### 4.2 The Revised Team-Sized Plan

| Phase | Tasks | Who | Duration | Deliverable |
|-------|-------|-----|----------|-------------|
| 0-1: Core | 15 | You | 2 weeks | Crawl + analyze 10 pages, CLI output |
| 2: PSE | 4 (T213-T216) | You | 1 week | Narrative findings, 3 personas |
| 3: Dashboard | 10 | You + frontend help | 2 weeks | Review UI, PDF export, consultant flow |
| 4: Beta | 6 | You | 1 week | 3 real clients, feedback loop |
| **Total** | **35 tasks** | | **6 weeks** | **Working product** |

**Deferred to "v2.0" (read: post-revenue):**
- 178 remaining tasks
- Temporal, MCP, 100 heuristics, state exploration
- Advanced analytics, competitive intelligence, experiment tracking

### 4.3 The Tech Debt You're Signing Up For

| Decision | Debt Incurred | When It Hits You | Interest Cost |
|----------|---------------|------------------|---------------|
| 100 heuristics now | 200 hours authoring, endless validation debates | Week 3, when quality is poor | 3 weeks delay |
| Temporal now | Operational complexity, debugging distributed state | Week 5, when audit crashes mid-run | 2 weeks debugging |
| MCP now | Protocol maintenance, versioning hell | Week 6, when you need to change API | 1 week refactoring |
| Stealth browser now | Arms race with Cloudflare, constant updates | Week 2, when Amazon blocks you | 1 week pivot to proxies |
| Sequential processing | Can't hit 20 audits/week target | Week 4, when first customer wants scale | Lost customer |
| No revenue calculator | Can't justify $500/month pricing | Week 6, when selling to first customer | Lost revenue |

### 4.4 The Simpler Path (What to Do Instead)

| Instead of | Do This | Result |
|------------|---------|--------|
| 100 heuristics, AES, 3 tiers | 20 heuristics, JSON, no tiers | Ship in 1 week, validate with users |
| Temporal + distributed | BullMQ + PostgreSQL | Debug locally, scale later |
| MCP + 28 tools | REST + CLI + direct calls | Change APIs freely, no protocol tax |
| Stealth + ghost-cursor | Proxy rotation + HITL | Reliable, simpler, cheaper |
| 11 phases, 17 weeks | 4 phases, 6 weeks | Revenue in June, not November |
| 3 execution modes | 2 modes (deterministic + vision fallback) | 50% code reduction |
| 9 verification strategies | 3 strategies | 67% code reduction |
| 213 tasks | 35 tasks | Actually shippable |

---

## PART 5: MISSING META-PIECES (Observability & Operations)

### 5.1 Observability & Alerting

| # | Missing Component | Why | Fix | Effort |
|---|-------------------|-----|-----|--------|
| O-001 | **Cost per audit tracking** | Don't know if you're profitable | Add `cost_tracking` table: tokens + storage + compute per audit | 1 day |
| O-002 | **Quality score dashboard** | Don't know if findings are good | Track: approval rate, implementation rate, revenue impact | 2 days |
| O-003 | **Error classification taxonomy** | All failures look the same | Taxonomy: `transient` (retry), `structural` (HITL), `bot_block` (rotate), `budget` (stop) | 4 hours |
| O-004 | **LLM latency tracking** | Don't know which calls are slow | Log: prompt tokens, completion tokens, duration, model | 4 hours |
| O-005 | **Grounding failure analysis** | Don't know which rules catch what | Log: GR-001 to GR-011 hit rates, false positive rates | 4 hours |

### 5.2 Client Onboarding Flow

| # | Missing Component | Why | Fix | Effort |
|---|-------------------|-----|-----|--------|
| ONB-001 | **Traffic data upload** | Can't calculate revenue impact without GA4 | CSV template + OAuth flow for GA4 | 2 days |
| ONB-002 | **Business type classifier** | Wrong persona = wrong analysis | 3-question wizard: "What do you sell? Who buys? Biggest fear?" | 1 day |
| ONB-003 | **Warm-up mode enforcement** | First 3 audits must be high-quality | All findings held until consultant approval, rejection rate <25% | 1 day |
| ONB-004 | **Competitor input** | Can't do competitive analysis without competitors | Manual input: "Who do you lose deals to?" | 4 hours |

### 5.3 Consultant Workflow Integration

| # | Missing Component | Why | Fix | Effort |
|---|-------------------|-----|-----|--------|
| CON-001 | **Finding edit + comment** | Must correct AI, not just approve/reject | Inline editing, comment thread per finding | 2 days |
| CON-002 | **Report customization** | One-size-fits-all fails | Templates: "Executive summary" vs "Technical" vs "Developer" | 2 days |
| CON-003 | **Speaker notes generation** | Consultant presents findings, needs talking points | Auto-generate: "Say this, show this, expect this question" | 1 day |
| CON-004 | **Client sharing controls** | Need to control what client sees | Toggle per finding: include in report / exclude / mark as "consultant only" | 1 day |

---

## PART 6: THE FINAL SCORECARD

### 6.1 By Category

| Category | Items | Critical | Fixable | Effort to Fix |
|----------|-------|----------|---------|---------------|
| **Missing Pieces** | 12 | 6 | All | 18 days |
| **Overbuild** | 6 | 3 | Kill/defer | -30 days (saved) |
| **Architectural Good** | 6 | — | Keep | — |
| **Development Debt** | 4 | 4 | Avoid by cutting scope | — |
| **Meta-Pieces** | 9 | 3 | Add post-MVP | 10 days |
| **PSE Addition** | 7 | 7 | Ready (T213-T216) | 6 days |

### 6.2 By Survival Impact

| Priority | Items | If Not Fixed |
|----------|-------|--------------|
| **P0 (Death)** | Sequential processing, No revenue calculator, 100 heuristics bottleneck | Can't scale, can't sell, can't ship |
| **P1 (Severe)** | Browser overbuild, MCP overhead, Temporal complexity | 3× cost, 2× time, debugging hell |
| **P2 (Important)** | PSE, ICE scoring, Analytics integration | Compete with free tools, not agencies |
| **P3 (Nice)** | Experiment tracking, Report customization, Speaker notes | Consultant efficiency, not survival |

### 6.3 The Ruthless Cut List

**Delete from PROJECT_BRIEF.md:**
- §6: MCP tools 1-23 (keep 24-28, defer rest)
- §11: Interactive composition Phase 11 (defer to v2.0)
- §12: State exploration Phase 10 (defer to v2.0)
- §3: Temporal from tech stack (delete entirely)
- §5: Mode B execution, ghost-cursor, 0.97 confidence
- §7: 100 heuristics, 3 tiers, AES encryption

**Defer to Phase 3+:**
- MCP server for external LLMs
- State exploration (cookie banners, accordions)
- Competitive intelligence engine
- Experiment result tracking
- Advanced analytics integration

**Keep and Protect:**
- 3-layer hallucination filter
- Temperature = 0 enforcement
- Two-store pattern
- Budget circuit breakers
- Adapter pattern (simplified)
- Zod validation

---

## PART 7: THE 6-WEEK SHIPPING PLAN

### Week 1: Foundation (Days 1-7)

| Day | Task | Output |
|-----|------|--------|
| 1 | Setup monorepo, PostgreSQL, Playwright | `neural` CLI runs |
| 2 | Build deterministic crawler (Mode A only) | Crawl 1 URL, save screenshot |
| 3 | Build `AnalyzePerception` extractor | Structured page data |
| 4 | Build single LLM evaluation call | 20 heuristics, JSON output |
| 5 | Build grounding rules (GR-001 to GR-008) | Filtered findings |
| 6 | Build annotation with Sharp | Annotated screenshot |
| 7 | Integration test: URL → findings → image | End-to-end works |

### Week 2: PSE Integration (Days 8-14)

| Day | Task | Output |
|-----|------|--------|
| 8 | T214: Database schema (3 tables) | Migrations run |
| 9 | T213: `persona_simulate` tool + 3 seed personas | Manual test passes |
| 10 | T215: `PersonaSimulationAdapter` | Walkthrough generates narrative |
| 11 | T215: `PersonaDrivenEvaluateStrategy` | Narrative + heuristics merge |
| 12 | T216: `intent_reconstruct` node | Intent flows to analysis |
| 13 | Integration: Brand → Intent → Simulation → Findings | PSE end-to-end |
| 14 | Quality test: 3 websites, consultant review | Narrative quality ≥80% |

### Week 3: Dashboard (Days 15-21)

| Day | Task | Output |
|-----|------|--------|
| 15 | Next.js setup, auth (Clerk), layout | Dashboard loads |
| 16 | Audit list view, status tracking | See all audits |
| 17 | Finding review UI: approve/reject/edit | Consultant can review |
| 18 | ICE scoring display: Impact/Confidence/Ease | Prioritized list |
| 19 | PDF report generation | Downloadable report |
| 20 | Email delivery, notification | Client gets report |
| 21 | Integration test: Full flow | Beta ready |

### Week 4: Beta (Days 22-28)

| Day | Task | Output |
|-----|------|--------|
| 22 | Recruit 3 beta customers (free audits) | Commitments |
| 23 | Run audit #1, collect feedback | Findings list |
| 24 | Run audit #2, collect feedback | Findings list |
| 25 | Run audit #3, collect feedback | Findings list |
| 26 | Analyze: What did they implement? What did they ignore? | Learning doc |
| 27 | Tune: Adjust heuristics, prompts, personas | Improved quality |
| 28 | Decision: Proceed to pricing or pivot | Go/no-go |

### Week 5-6: Polish & Launch (Days 29-42)

| Week | Focus | Output |
|------|-------|--------|
| 5 | Cost tracking, warm-up mode, onboarding flow | Operations ready |
| 6 | Pricing page, Stripe integration, landing page | Revenue-ready |

**Total: 35 tasks, 6 weeks, working product.**

---

## CONCLUSION: THE RUTH

Your master architecture document is **impressive and dangerous**. It impresses engineers and investors. It kills startups.

**The truth:**
- You don't need 213 tasks. You need 35.
- You don't need 17 weeks. You need 6.
- You don't need Temporal, MCP, 100 heuristics, or stealth browsers. You need Playwright, Claude, PostgreSQL, and 20 good rules.
- You don't need to automate the perfect CRO consultant. You need to automate 80% of the junior consultant, charge 50% less, and let the senior consultant review.

**The choice:**
- **Path A:** Follow the 213-task plan. Ship in November (if ever). Compete with free Lighthouse audits. Die slowly.
- **Path B:** Cut to 35 tasks. Ship in June. Charge $500/audit. Learn from real customers. Build the cathedral later.

**My recommendation:** Take Path B. The architecture in your brief is the cathedral. Build the chapel first. Prove people will pray in it. Then expand.

---

*Document version: 1.0*  
*Author: Ruthless Mentor*  
*Date: 2026-04-15*  
*Status: Actionable — start with Week 1, Day 1*
