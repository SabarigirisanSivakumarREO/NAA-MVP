# Product Requirements Document — AI CRO Audit System

**Product Name:** AI CRO Audit System (Neural)
**Owner:** REO Digital — Neural Product Team
**Author:** Sabari
**Date:** April 2026
**Version:** 1.0
**Status:** Draft for Review

---

## Document Map

This PRD answers **WHY** we're building this. For **HOW**, see:

- `docs/specs/final-architecture/` — Complete production architecture (17 spec files + 13 diagrams)
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` — Browse mode source of truth
- `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` — Analyze mode source of truth
- `docs/specs/mvp/` — MVP implementation plan (155 numbered tasks)

---

## 1. Executive Summary

### What We're Building

An AI-powered CRO (Conversion Rate Optimization) audit platform that autonomously crawls websites, evaluates them against industry-standard usability heuristics (Baymard, Nielsen, Cialdini), and produces evidence-grounded findings with annotated screenshots.

### Why Now

Three forces converge:

1. **AI capability inflection** — LLMs (Claude Sonnet 4, GPT-4o) and Vision-Language Models can now reliably evaluate UI structure and visual hierarchy on par with junior CRO consultants for visual/structural heuristics.
2. **Browser automation maturity** — Playwright + stealth plugins enable reliable cross-site automation that avoids most anti-bot detection.
3. **REO Digital's scaling problem** — Manual CRO audits are the bottleneck preventing the agency from serving more clients without hiring more consultants.

### The Bet

By automating ~70% of the data collection and pattern recognition work in a CRO audit, REO can:
- **Reduce audit cost** by ~60-80% per client
- **Reduce audit time** from 5-10 days (manual) to 1-2 hours (automated)
- **Scale audit capacity** from ~5/month per consultant to ~20+/week with the same team
- **Standardize quality** by enforcing the same heuristic library across all audits
- **Position REO as a tech-forward CRO agency** in a market dominated by manual labor

### Success in One Sentence

> A CRO consultant can run an audit on a client's site, get evidence-grounded findings on annotated screenshots within 15 minutes, review and approve them via dashboard, and present polished recommendations to the client the same day.

---

## 2. Problem Statement

### Current Manual CRO Audit Process

A typical CRO audit at REO today:

| Step | Time | Cost (consultant time) |
|------|------|------------------------|
| Manual page-by-page review (10-20 pages) | 8-12 hours | $1,200-1,800 |
| Documenting findings + screenshots | 4-6 hours | $600-900 |
| Compiling report | 3-5 hours | $450-750 |
| Quality review by senior consultant | 1-2 hours | $200-400 |
| **Total per audit** | **16-25 hours** | **$2,450-3,850** |

### Pain Points

| Pain | Impact |
|------|--------|
| **Inconsistency between consultants** | Two consultants auditing the same site produce different findings (~21% overlap per academic studies). Quality varies. |
| **Slow turnaround** | Clients wait 5-10 business days for audit reports. Lost momentum, lost deals. |
| **Limited scale** | Each consultant handles ~5 audits/month max. Hiring more consultants is expensive and slow. |
| **Repetitive work** | 70%+ of an audit is mechanical pattern recognition (CTAs, forms, trust signals) that doesn't need senior expertise. |
| **No version tracking** | Re-auditing a client after fixes is just as expensive as the first audit. No automated diff. |
| **Heuristic knowledge stuck in heads** | Senior consultants' expertise isn't codified. When they leave, knowledge leaves. |
| **Competitor benchmarking is rare** | Manually auditing 2-3 competitor sites doubles or triples the cost. Often skipped. |

### Why Existing Tools Don't Solve This

| Tool | What it does | Why it's not enough |
|------|------------|---------------------|
| **Hotjar / FullStory** | Records user behavior | Reactive (needs traffic). Doesn't evaluate against heuristics. Doesn't produce recommendations. |
| **Optimizely / VWO** | A/B testing platforms | Test execution, not auditing. Requires hypotheses already formed. |
| **Contentsquare** | Heatmaps + journey analytics | Analytics, not opinionated CRO advice. Expensive. |
| **Lighthouse / PageSpeed** | Technical performance | Performance only, no CRO heuristics. |
| **AI tools (Browser Use, Stagehand)** | General browser agents | Built for automation, not CRO evaluation. No heuristic library. No grounding. |
| **Manual consultants** | High-quality but slow | The bottleneck we're trying to remove. |

**The gap:** No tool combines (a) automated browser crawling, (b) opinionated CRO evaluation against research-backed heuristics, (c) evidence-grounded findings, (d) annotated visual output. We're building that.

---

## 3. Target Users & Personas

### Primary Persona — "Sam, Senior CRO Consultant"

| | |
|---|---|
| **Role** | Senior CRO Consultant at REO Digital |
| **Experience** | 6 years in CRO, certified by CXL Institute |
| **Daily work** | Audits client sites, presents findings, designs A/B tests |
| **Tools he uses today** | Hotjar, Figma, Google Sheets, Loom, manual screenshots |
| **Main frustration** | Spends 60% of his time on repetitive pattern-matching that a junior could do, leaving little time for strategic recommendations |
| **What he wants** | A tool that does the mechanical part — find every CTA, form, trust signal, content issue — so he can focus on strategy and client communication |
| **What he fears** | Tool produces false positives that embarrass him in front of clients |
| **Success looks like** | Run audit in morning, review findings over coffee, present to client by afternoon |

### Secondary Persona — "Raj, Marketing Manager (Client)"

| | |
|---|---|
| **Role** | Marketing Manager at an e-commerce SaaS startup |
| **Why he hires REO** | His conversion rate is plateauing and his team lacks CRO expertise |
| **What he expects** | Clear, actionable findings with screenshots, prioritized by impact |
| **What he hates** | Vague reports full of "consider improving..." without specifics |
| **Success looks like** | Receives a report he can hand directly to his dev team for implementation |

### Tertiary Persona — "Marc, REO Digital Founder"

| | |
|---|---|
| **Role** | Founder & Strategy Lead at REO Digital |
| **Concern** | Can't scale the agency without diluting quality or burning out consultants |
| **Hypothesis** | If technology removes 70% of manual audit work, we can grow 5x without proportional headcount |
| **Success looks like** | Audit cost per client drops 60%+, team handles 4x more clients, margins improve |

### Anti-Personas (NOT building for)

| Not For | Why |
|---------|-----|
| Self-serve marketers without CRO expertise | They'd misinterpret findings without consultant guidance |
| Enterprise procurement processes | We're not chasing 6-month sales cycles |
| Free-tier users | The cost per audit is real ($3-5 in LLM API calls) |
| One-off audit requests from outside REO clients | Consultant review gate makes scale-out impractical for MVP |

---

## 4. User Stories

### MVP User Stories (Phase 1-8)

| ID | As a... | I want to... | So that... |
|----|--------|-------------|-----------|
| US-01 | CRO consultant | Run an audit on a client's URL via CLI command | I can start audits without complex setup |
| US-02 | CRO consultant | Have the agent crawl up to 5 pages automatically | I don't manually navigate each page |
| US-03 | CRO consultant | Have each page evaluated against ~100 CRO heuristics | I get consistent coverage without remembering every rule |
| US-04 | CRO consultant | See findings with specific evidence (which element, what's wrong) | I can verify the finding before showing the client |
| US-05 | CRO consultant | Get annotated screenshots showing each finding's location | I can present visually to clients |
| US-06 | CRO consultant | Know when the AI is uncertain vs confident about a finding | I can prioritize which findings to manually verify |
| US-07 | CRO consultant | Have the system reject hallucinated findings automatically | I'm not embarrassed by AI mistakes in front of clients |
| US-08 | CRO consultant | Get a JSON output I can transform into client reports | I can automate report generation downstream |
| US-09 | CRO consultant | See total cost and duration of each audit | I can estimate per-client economics |
| US-10 | CRO consultant | Have the system detect anti-bot pages and report cleanly (not crash) | I don't waste hours debugging |

### Post-MVP User Stories (Phase 9-12)

| ID | As a... | I want to... | So that... | Phase |
|----|--------|-------------|-----------|-------|
| US-11 | CRO consultant | Specify competitor URLs and get pairwise comparison findings | I can show clients how they stack up | 9 |
| US-12 | CRO consultant | Re-audit a client after they implement fixes | I can show measurable improvement | 9 |
| US-13 | CRO consultant | Detect inconsistencies in CTAs/nav across pages of the same site | I catch UX problems that single-page analysis misses | 9 |
| US-14 | Marketing manager (client) | View my audit findings in a web dashboard | I don't need to wait for a PDF report | 11 |
| US-15 | Marketing manager (client) | Compare my latest audit against the previous version | I can see what's been fixed and what's new | 11 |
| US-16 | CRO consultant | Approve, edit, or reject findings before clients see them | I maintain quality control | 10 |
| US-17 | REO admin | Manage multiple client accounts with isolated data | I can scale the agency without data leakage | 10 |
| US-18 | REO admin | Schedule automatic re-audits monthly | I provide ongoing value without manual triggering | 12 |
| US-19 | LLM agent (Claude/ChatGPT) | Query audit findings via MCP protocol | I can build custom integrations | 11 |
| US-20 | CRO consultant | Run audits at production scale (20+ per week) | We can scale REO's audit business | 12 |

---

## 5. Success Metrics

### MVP Success (validate the core hypothesis)

The MVP is successful if **after 4 weeks of consultant usage**:

| Metric | Target | How Measured |
|--------|--------|-------------|
| **Time to first finding** | < 2 minutes from CLI invocation | Automated from event log |
| **End-to-end audit time** (5 pages) | < 15 minutes | Automated from event log |
| **Cost per audit** (5 pages) | < $5 | LLM API spend tracking |
| **Self-critique rejection rate** | At least 1 finding rejected per audit | Confirms anti-hallucination filter works |
| **Evidence grounding rejection rate** | At least 1 finding rejected per audit | Confirms grounding rules work |
| **Consultant approval rate** | > 60% of findings approved without edit | Consultant manual review |
| **False positive rate** | < 25% | Consultant marks "this isn't a real issue" |
| **Time saved per audit** vs manual | > 12 hours | Consultant self-report |
| **Consultant NPS** | > 7/10 | "Would you recommend this tool to a peer?" |

### Beta Success (validate scaling)

After Phase 9-11 ship and 5 clients use it for ~30 days:

| Metric | Target | How Measured |
|--------|--------|-------------|
| **Audits per consultant per week** | > 5 (vs ~1 manual) | DB query on audit_runs table |
| **Cost per client per month** | < $50 in LLM costs | Cost tracking |
| **Findings approved without edit** | > 70% | Review gate analytics |
| **Client satisfaction** | > 4/5 | Post-audit survey |
| **Re-audit improvement detection** | Diff engine catches > 80% of resolved findings | Manual spot-check |

### GA Success (validate business case)

After Phase 12 ships and the system runs for 90 days at scale:

| Metric | Target | How Measured |
|--------|--------|-------------|
| **Total audits per month** | > 80 | DB query |
| **REO consultant capacity increase** | 4x baseline | Headcount vs throughput |
| **Audit cost reduction** | 60%+ vs manual | Internal cost analysis |
| **Client retention** (those receiving regular audits) | > 90% | CRM data |
| **System uptime** | > 99% | Health check monitoring |
| **Average finding accuracy** | > 80% (consultant-validated) | Sampling review |

### Anti-Metrics (things we explicitly don't optimize for)

| Anti-Metric | Why |
|-------------|-----|
| **Number of findings per page** | More findings ≠ better. We want SIGNAL, not noise. |
| **Heuristic count** | Adding more heuristics is easy; making them reliable is hard. Stay focused. |
| **Speed at the cost of quality** | We don't celebrate a 5-minute audit if 50% of findings are wrong. |
| **Conversion rate predictions** | Research shows LLMs can't reliably predict this. We don't try. |

---

## 6. Functional Requirements

### 6.1 MVP Requirements (Phase 1-8) — ~10 weeks

**Reference:** `docs/specs/mvp/spec.md`

#### F-MVP-01: CLI Audit Runner

- **What:** A command `pnpm cro:audit --url <URL> [--pages N]` that triggers a complete audit
- **Where:** `apps/cli/src/commands/audit.ts`
- **Spec REQ:** F-001 in `mvp/spec.md`

#### F-MVP-02: Browse Mode (Browser Agent v3.1)

- **What:** Navigate to URLs, handle cookies/popups, wait for page stability, prepare pages for analysis
- **Where:** `packages/agent-core/src/orchestration/BrowseGraph.ts`
- **Spec REQ:** All sections of `AI_Browser_Agent_Architecture_v3.1.md`
- **Includes:** 23 MCP browse tools, AX-tree perception, dual-stage filtering, mutation monitoring, 9 verify strategies, multiplicative confidence scoring, hard safety gates, human-like behavior (ghost-cursor, Gaussian typing, stealth plugin), rate limiting, circuit breaker, HITL via interrupt()

#### F-MVP-03: Analyze Mode (5-Step Pipeline)

- **What:** Evaluate each loaded page against filtered CRO heuristics with 3-layer hallucination filter
- **Where:** `packages/agent-core/src/analysis/AnalysisGraph.ts`
- **Spec REQ:** All sections of `AI_Analysis_Agent_Architecture_v1.0.md`
- **Pipeline:** perceive → evaluate (CoT) → self-critique → ground (8 rules) → annotate
- **Includes:** 5 analysis MCP tools, CoT prompting, self-critique LLM call, deterministic evidence grounding (GR-001 to GR-008), screenshot annotation with severity colors

#### F-MVP-04: Heuristic Knowledge Base

- **What:** ~100 heuristics (50 Baymard + 35 Nielsen + 15 Cialdini) loaded from JSON, filtered by page type and business type
- **Where:** `heuristics-repo/*.json` + `packages/agent-core/src/analysis/heuristics/`
- **Spec REQ:** F-004 in `mvp/spec.md`, Section 9 in `final-architecture/09-heuristic-kb.md`
- **Security:** AES-256-GCM encryption at rest, content never exposed to clients

#### F-MVP-05: Audit Orchestrator (Dual-Mode Graph)

- **What:** LangGraph state machine that switches between browse and analyze subgraphs per page
- **Where:** `packages/agent-core/src/orchestration/AuditGraph.ts`
- **Spec REQ:** Section 4 in `final-architecture/04-orchestration.md`
- **Includes:** Audit setup, page queue, page router, completion handling, Postgres checkpointing

#### F-MVP-06: PostgreSQL Persistence

- **What:** Store clients, audit_runs, findings, screenshots, sessions, audit_log, rejected_findings
- **Where:** `packages/agent-core/src/db/`
- **Spec REQ:** Section 13 in `final-architecture/13-data-layer.md`
- **ORM:** Drizzle, migrations via Drizzle Kit

#### F-MVP-07: Output Generation

- **What:** Produce structured output: summary.json, findings.json, annotated screenshots per page
- **Where:** `apps/cli/src/output/JsonReporter.ts`
- **Spec REQ:** F-005 in `mvp/spec.md`
- **Format:** Per-audit folder with all artifacts

#### F-MVP-08: Cost Tracking

- **What:** Track LLM API costs per call and per audit, enforce hard budget caps
- **Where:** `packages/agent-core/src/analysis/CostTracker.ts`
- **Cap:** $5 per audit (configurable), terminates gracefully when exceeded

### 6.2 Post-MVP Requirements (Phase 9-12) — ~6 additional weeks

**Reference:** `docs/specs/final-architecture/16-implementation-phases.md`

#### F-POST-09: Competitor Comparison (Phase 9)

- **What:** Crawl 1-2 competitor sites and produce pairwise comparison findings on specific dimensions (CTA placement, trust signals, forms, etc.)
- **Why pairwise:** Research (WiserUI-Bench, MLLM UI Judge) shows LLMs are reliable at "A vs B" but unreliable at absolute scoring
- **Spec REQ:** Section 10 in `final-architecture/10-competitor-versioning.md`
- **Detection:** LLM-based (no external API for MVP)

#### F-POST-10: Version Tracking (Phase 9)

- **What:** Compare audit v1 vs v2, identify resolved / persisted / new findings
- **Spec REQ:** Section 10 in `final-architecture/10-competitor-versioning.md`
- **Algorithm:** Match findings by `heuristic_id` + page_url + element similarity

#### F-POST-11: Cross-Page Consistency (Phase 9)

- **What:** Detect inconsistent CTAs, navigation, colors, typography across pages of the same site
- **Spec REQ:** Section 10.3 in `final-architecture/10-competitor-versioning.md`

#### F-POST-12: Multi-Tenant Client Management (Phase 10)

- **What:** Multiple clients with isolated data via PostgreSQL row-level security and Clerk authentication
- **Spec REQ:** Section 13.2 in `final-architecture/13-data-layer.md`
- **Auth:** Clerk (consultant + client + admin roles)

#### F-POST-13: Confidence-Based Review Gate (Phase 10)

- **What:** Tier 1 findings auto-publish, Tier 2 hold 24hr (consultant can intervene), Tier 3 held until consultant approves
- **Spec REQ:** Section 12 in `final-architecture/12-review-gate.md`
- **Dual mode:** Chatbot returns all with caveats; dashboard uses tiered gate

#### F-POST-14: CRO Audit MCP Server (Phase 11)

- **What:** Expose audit findings to LLMs via MCP protocol with API key scoping
- **Spec REQ:** Section 14 in `final-architecture/14-delivery-layer.md`
- **9 tools:** get_audit_summary, get_findings, compare_versions, etc.

#### F-POST-15: Client Dashboard (Phase 11)

- **What:** Next.js dashboard for clients to view findings, annotated screenshots, version comparisons, competitor benchmarks
- **Spec REQ:** Section 14.2 in `final-architecture/14-delivery-layer.md`
- **Stack:** Next.js 15 + shadcn/ui + Tailwind

#### F-POST-16: Consultant Dashboard (Phase 11)

- **What:** Extended dashboard with review gate workflow, client management, audit scheduling, analytics
- **Spec REQ:** Section 14.3 in `final-architecture/14-delivery-layer.md`

#### F-POST-17: Job Scheduler (Phase 12)

- **What:** BullMQ-based scheduler for recurring audits, retry policies, concurrent execution
- **Spec REQ:** Section 11 in `final-architecture/11-safety-cost.md`
- **Scale target:** 20+ concurrent audits

#### F-POST-18: Production Deployment (Phase 12)

- **What:** Docker Compose for dev, Fly.io for API/workers, Vercel for dashboard, Cloudflare R2 for screenshots, Upstash Redis for queue
- **Spec REQ:** Section 12 in `final-architecture/16-implementation-phases.md`

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | MVP Target | Post-MVP Target |
|--------|-----------|----------------|
| Time to first finding | < 2 min | < 90s |
| 5-page audit duration | < 15 min | < 10 min |
| 50-page audit duration | N/A | < 60 min |
| Memory per audit process | < 1 GB | < 1 GB |
| Concurrent audits | 1 | 20+ |

### 7.2 Cost

| Metric | MVP Target | Post-MVP Target |
|--------|-----------|----------------|
| Cost per page (LLM) | < $1.00 | < $0.40 |
| Cost per 5-page audit | < $5 | < $2 |
| Monthly LLM spend at 80 audits | N/A | < $200 |
| Monthly infrastructure | N/A | < $400 |

### 7.3 Quality

| Metric | MVP Target | Post-MVP Target |
|--------|-----------|----------------|
| Self-critique rejection rate | ≥ 1 per audit | ≥ 15% of raw findings |
| Evidence grounding rejection rate | ≥ 1 per audit | ≥ 10% of reviewed findings |
| False positive rate (consultant-validated) | < 25% | < 15% |
| Browse action verification rate | 100% | 100% |
| Audit success rate (clean exit) | > 90% | > 98% |

### 7.4 Security & IP Protection

| Requirement | Mechanism |
|------------|-----------|
| Heuristic IP protection | AES-256-GCM encryption at rest, redacted in traces, never exposed via API/dashboard |
| Client data isolation | PostgreSQL row-level security (post-MVP) |
| No PII storage | Validated in code review |
| Audit log immutability | Append-only, no UPDATE/DELETE |
| Secrets management | Environment variables, never in code |
| API key scoping | Each key bound to specific client_id (post-MVP) |

### 7.5 Reliability

| Requirement | Mechanism |
|------------|-----------|
| Crash recovery | LangGraph PostgresCheckpointer enables resume from any node |
| Page-level fault tolerance | Failed pages skip, audit continues with remaining |
| Anti-bot graceful degradation | Detect → escalate to HITL or report cleanly, never crash |
| Budget enforcement | Hard cap, terminates cleanly when exceeded |
| Domain circuit breaker | 3 consecutive failures → 1hr cooldown |

---

## 8. Out of Scope (Explicitly Not Building)

These have been considered and rejected for v1.0. They may revisit later but are NOT in scope:

| Out of Scope | Why | Maybe Reconsider When |
|-------------|-----|----------------------|
| **Conversion rate predictions** | Research proves LLMs cannot reliably predict this (WiserUI-Bench 2025) | Never — fundamental LLM limitation |
| **SEO audit features** | Different domain expertise, different heuristics, scope creep | If REO acquires SEO clients |
| **WCAG accessibility scoring** | Requires axe-core integration, different rule set | Phase 13+ |
| **Self-serve marketers (no consultant)** | Findings need consultant interpretation to be safe for clients | Possibly Phase 14+ with simpler output |
| **Mobile-only audits** | Mobile is included in heuristics, not a separate workflow | Phase 13+ if demand exists |
| **Real user behavior data integration** (GA4, Hotjar) | External API integrations are their own project | Phase 14+ |
| **Code generation (HTML/CSS fix patches)** | Interface defined but not implemented | When core MVP is validated |
| **A/B test variant generation** | Interface defined but not implemented | When fix generation works |
| **Design recommendation (mockups)** | Requires generative image models, separate research | Phase 15+ |
| **Multi-language support** | English-only for MVP | When non-English clients arrive |
| **Mobile native apps** | Web dashboard is enough | If consultants demand it |
| **Realtime collaboration** | Not a Google Docs replacement | Probably never |

---

## 9. Competitive Landscape

### Direct Competitors (CRO-focused)

| Competitor | What They Do | How We Differ |
|-----------|-------------|--------------|
| **Baymard Institute (research)** | Premium UX research database | They sell the heuristics; we operationalize them |
| **CXL Institute** | CRO training + consulting | They train humans; we automate the work |
| **Optimizely + custom consultants** | Test execution + manual analysis | We replace the analysis step, they're complementary |
| **Hotjar / FullStory** | Behavior analytics | Reactive (need traffic); we're proactive (heuristics) |
| **Manual CRO agencies** | Human consultants | We're the tool that makes them 5x more productive |

### Adjacent Tools (browser agents)

| Tool | Strengths | Why We're Different |
|------|-----------|---------------------|
| **Browser Use** (50K+ GitHub stars) | General browser automation, simple API | No CRO heuristics, no evidence grounding, no annotation |
| **Stagehand** (Browserbase) | TypeScript-first, 3-primitive API | Same — automation tool, not analysis tool |
| **Anthropic Computer Use** | Native Claude integration | ~22% OSWorld benchmark, screenshot-only, no domain knowledge |
| **Microsoft UFO** | Windows-focused agent | Desktop, not web; no CRO domain |

### Our Unique Positioning

We're NOT building a browser agent. We're building a **CRO analysis platform that uses a browser agent as one component**. The differentiation is:

1. **Opinionated heuristic library** (Baymard + Nielsen + Cialdini) — our IP
2. **Evidence grounding** (8 deterministic rules) — research-backed anti-hallucination
3. **Dual-mode architecture** (browse + analyze) — no other tool combines these
4. **Consultant-in-the-loop** (review gate) — quality control no other AI tool has
5. **Annotated screenshots** — visual output clients understand immediately
6. **Pairwise competitor comparison** — research-backed pattern no competitor uses

---

## 10. Risks & Assumptions

### Critical Assumptions (must be true for MVP to work)

| Assumption | Confidence | Validation Plan |
|-----------|-----------|-----------------|
| LLMs can reliably evaluate visual/structural heuristics | High (>75% per MLLM UI Judge research) | MVP testing on 5 sites, consultant validation |
| Playwright + stealth bypasses most anti-bot detection | Medium-High | Test on Amazon, LinkedIn, target domains |
| 100 heuristics are enough to demonstrate value | Medium | Consultant feedback after MVP |
| Consultants will trust AI findings (with grounding) | Medium | Built-in review gate addresses this |
| Heuristic IP can be protected via encryption | High | Proven crypto pattern |
| MVP cost stays under $5/audit | Medium-High | Token budgeting + measurement |

### Critical Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R-1 | LLMs hallucinate findings even with grounding | Medium | High | 3-layer filter (CoT + self-critique + grounding), measure rejection rate |
| R-2 | Anti-bot detection blocks audits on key client sites | High | Medium | Stealth plugin, fingerprint rotation, HITL escalation, circuit breaker |
| R-3 | Cost overruns from runaway LLM calls | Low | High | Hard budget caps per audit and per page |
| R-4 | Consultants reject the tool as "not good enough" | Medium | Critical | Co-design with consultants, iterate based on feedback |
| R-5 | Heuristic library quality is the ceiling | High | Critical | Start with 100 heuristics (50/35/15 Baymard/Nielsen/Cialdini), expand based on validation |
| R-6 | LangGraph.js subgraph API has fewer examples than Python | Medium | Low | Reference Python docs, translate patterns |
| R-7 | Production scale exposes bugs not seen in MVP | High | Medium | Phase 12 includes load testing |
| R-8 | Anthropic API rate limits or pricing changes | Low | Medium | Adapter pattern allows OpenAI fallback |
| R-9 | Heuristic IP leak via API or trace logs | Low | Critical | Encryption at rest, redaction in traces, never exposed |
| R-10 | Compliance issues with crawling third-party sites | Medium | High | Respect robots.txt, ai-agent.txt, rate limiting, document client-authorized domains |

---

## 11. Release Plan

### MVP — Internal Validation (Week 0-10)

**Goal:** Prove the core hypothesis with 1 consultant on 5 test clients.

**Scope:** Phase 1-8 of `final-architecture/16-implementation-phases.md`
- ✅ Browse mode working (5-node MVP graph)
- ✅ Analyze pipeline working (5-step pipeline)
- ✅ 100 heuristics in JSON (50 Baymard + 35 Nielsen + 15 Cialdini)
- ✅ Audit orchestrator wiring browse + analyze
- ✅ CLI runner with JSON output
- ✅ Postgres persistence

**Out of MVP:** Multi-tenant, dashboard, competitor analysis, scheduled audits, web UI, fix generation

**MVP Success Gate:**
- 5 audits run successfully on real test sites
- Consultant approves > 60% of findings without edit
- Cost per audit < $5
- Time per audit < 15 min

**Reference:** `docs/specs/mvp/`

---

### Beta — Closed Customer Test (Week 10-14)

**Goal:** Ship to 3-5 paying REO clients with consultant supervision.

**Adds:**
- ✅ Phase 9: Competitor comparison + version tracking + consistency
- ✅ Phase 10: Multi-tenant client management + Clerk auth + RLS + review gate
- ✅ Phase 11: Client dashboard + consultant dashboard + MCP server

**Beta Success Gate:**
- 5 clients audited monthly
- Findings approved without edit > 70%
- Consultant NPS > 7/10
- Zero data leakage incidents

---

### GA — Production Launch (Week 14-18)

**Goal:** Open to all REO consultants and clients.

**Adds:**
- ✅ Phase 12: Job scheduler + concurrent workers + production deployment
- ✅ LangSmith observability + Sentry alerts + Bull Board monitoring
- ✅ Health checks + automated failover

**GA Success Gate:**
- 20+ concurrent audits supported
- 99% uptime
- 80+ audits per month
- Cost per client per month < $50

---

### Post-GA Roadmap (Beyond v1.0)

| Phase | Features | Timeline |
|-------|----------|---------|
| v1.1 | Expanded heuristic library (100 → 250+ heuristics) | Month 5-6 |
| v1.2 | Fix code generation (HTML/CSS patches) | Month 6-8 |
| v1.3 | A/B test variant generation (VWO, Optimizely integration) | Month 8-10 |
| v1.4 | DX integrations (GA4, Contentsquare, FullStory) | Month 10-12 |
| v2.0 | Design recommendation (AI-generated mockups) | Year 2 |

---

## 12. Open Questions & Decisions Needed

These need leadership input before/during MVP:

| # | Question | Default if Not Answered | Who Decides |
|---|----------|------------------------|-------------|
| OQ-1 | Pricing model: per-audit, per-client subscription, or REO-internal only? | REO-internal only for MVP/Beta | Marc (founder) |
| OQ-2 | Which 100 heuristics for MVP? Need CRO team to author | Default list in `tasks.md` T103-T105 | Sam + senior consultants |
| OQ-3 | Self-hosted vs managed Postgres in production? | Fly.io managed | Engineering |
| OQ-4 | LangSmith subscription tier? | Developer tier ($39/mo) | Engineering |
| OQ-5 | Consultant access model: SSO via Clerk or simple login? | Clerk SSO | Engineering |
| OQ-6 | Domain denylist: which domains are off-limits for crawling? | Banking + government for MVP | Legal + Marc |
| OQ-7 | How are clients onboarded? (signed contract, internal request) | Internal-only MVP, no client onboarding | Marc |
| OQ-8 | Who owns the heuristic library long-term? | CRO team owns, engineering integrates | Marc + Sam |
| OQ-9 | What happens to a finding rejected by grounding rules — log only or surface to consultant? | Log only for MVP | Engineering |
| OQ-10 | Should the system attempt to bypass CAPTCHAs or always escalate? | Always escalate | Legal + Marc |

---

## 13. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | April 2026 | Sabari | Initial PRD covering full system + MVP scope |

---

## 14. Approvals (when ready)

| Role | Name | Approval Date | Notes |
|------|------|---------------|-------|
| Product Owner | Sabari | Pending | |
| Engineering Lead | TBD | Pending | |
| CRO Lead (Sam) | TBD | Pending | Critical for heuristic authorship |
| Founder (Marc) | TBD | Pending | Business case + scope approval |

---

**End of PRD v1.0**
