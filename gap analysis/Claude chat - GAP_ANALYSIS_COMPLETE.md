# Neural CRO Platform — Complete Gap Analysis

> **Ruthless, honest, no sugarcoating.**
> Every gap is tagged: what's missing, why it matters, how to fix it architecturally and developmentally.
> Organized by workflow stage, then by system concern.

---

## PART 1: GAPS IN THE CRO AUDIT WORKFLOW

These are things a top 1% CRO consultant does that your system cannot do or has not accounted for.

---

### GAP-01: No Intelligent Site Discovery From Brand Name

**What's missing:** Your spec assumes URLs are provided. There is no mechanism to go from "Audit Nike" → find nike.com → discover key conversion pages. The audit_setup node loads from sitemap + priority sort, but many sites have incomplete sitemaps, no sitemaps, or SPAs where sitemaps are useless. There is no crawler that follows navigation links to discover the funnel organically.

**Why it matters:** Your stated use case is "give me a brand name or set of URLs." The brand-name path is completely unspecified. A consultant given "audit this brand" would Google them, find the site, browse the navigation, identify the funnel pages, and prioritize. Your system can only do the URL-list path.

**Architectural fix:** Add a `site_discovery` node before `audit_setup`. It takes a brand name or root URL and produces a prioritized page queue. Three strategies: (1) sitemap.xml parsing, (2) navigation-link crawling with page-type classification (homepage, category, product, cart, checkout, landing, blog, about), (3) LLM-assisted prioritization of discovered pages by conversion relevance. This node outputs the same `AuditPage[]` your page_router already consumes.

**Development fix:** Build this as a standalone module behind an adapter (`DiscoveryAdapter`). MVP: just parse sitemap.xml and extract nav links from the homepage. Later: add intelligent crawling with depth limits. This can be Phase 0.5 work — before the main audit pipeline.

---

### GAP-02: No Mobile Viewport Auditing

**What's missing:** Your entire architecture captures pages at a single viewport (implied desktop). There is no mention of running perception at 375px or 390px mobile widths. No mobile-specific heuristics. No responsive behavior comparison. The AnalyzePerception type captures `foldPosition` and `visualHierarchy` but these are viewport-dependent — a CTA above the fold on desktop is below the fold on mobile.

**Why it matters:** 60-70% of e-commerce traffic is mobile. Mobile CRO issues are fundamentally different: tap target sizes (48px minimum), content reflow, hamburger menu discoverability, sticky header viewport consumption, horizontal scroll, font readability, thumb-zone placement. A CRO audit without mobile is an incomplete audit. Your competitors will do this.

**Architectural fix:** Add a `viewport_strategy` field to `AuditPage` in the page queue. Each page gets audited at 1-2 viewports (desktop 1440px, mobile 390px). The perception step must capture viewport-specific data. Your `AnalyzePerception` type needs a `viewport` field. Heuristic schema needs a `viewport_applicability` field (desktop_only, mobile_only, both). Findings need a `viewport` tag so clients know which device the issue affects.

**Development fix:** This doubles your per-page cost and time. For MVP, do desktop-only. Add mobile as a toggle in Phase B. The Playwright viewport change is trivial (`page.setViewportSize()`), but you need to re-run `page_analyze` at the new viewport, which means your perception data structures need to be viewport-aware from the start. Design the types with `viewport` now, populate only desktop initially.

---

### GAP-03: No Funnel/Journey Awareness

**What's missing:** Your architecture treats pages independently. The page_router processes them sequentially, and the analysis pipeline evaluates each page in isolation. There is no concept of: "the homepage CTA promises free shipping, but the cart page doesn't mention it" or "the product page has 12 variants but the category page shows no filtering." Cross-page findings — the most valuable kind — are impossible in your current pipeline.

**Why it matters:** The highest-impact CRO findings are almost always about journey friction, not single-page issues. A top 1% consultant audits the funnel as a connected experience. "The user journey from homepage to checkout has 7 unnecessary clicks" is a $100K finding. "This button has low contrast" is a $500 finding. Your system can only produce the second kind.

**Architectural fix:** Add a `funnel_context` object to AuditState that accumulates cross-page signals as the audit progresses. After all pages are individually analyzed, add a `cross_page_analysis` node before `audit_complete`. This node receives all page perceptions and findings, and runs a separate LLM evaluation looking for: promise/delivery mismatches across pages, inconsistent trust signals, missing funnel steps, unnecessary friction points, navigation dead ends. These produce cross-page findings with references to multiple pages.

**Development fix:** For MVP, skip the LLM cross-page analysis. Instead, build a deterministic `funnel_consistency_checker` that flags: CTAs pointing to 404s, inconsistent branding/messaging across pages (simple text comparison), missing pages in standard funnels (e.g., product page exists but no cart page discovered). Add the LLM-powered cross-page analysis in Phase C.

---

### GAP-04: No User Persona / Journey-Based Evaluation

**What's missing:** Your evaluation prompt uses OBSERVE → ASSESS → EVIDENCE → SEVERITY. This is element-focused: "look at this element, judge it against this heuristic." A top consultant thinks in user journeys: "I'm a first-time visitor looking for running shoes. I land on this page and I can't tell if they sell shoes because the hero image is about a lifestyle brand." Your system evaluates what's wrong with the page. A consultant evaluates what's wrong with the experience.

**Why it matters:** LLMs are actually decent at persona-based reasoning. Asking "evaluate this CTA button against heuristic H-042" produces mechanical findings. Asking "you are a price-sensitive first-time visitor — what confuses you on this page, and does it violate any of these heuristics?" produces findings that match how real users experience the page. This is the difference between a checklist tool and an AI consultant.

**Architectural fix:** Add a `persona_context` to the evaluate step. The system prompt should include 2-3 user personas relevant to the business type (e.g., for e-commerce: first-time visitor, returning customer, price-sensitive shopper). The evaluation should consider each heuristic from the perspective of these personas. Add a `persona` field to the Finding type.

**Development fix:** This is a prompt engineering change, not an architectural one. Start with hardcoded personas per business type in your heuristic KB. Add a `personas` field to the client profile. No new infrastructure needed — just better prompts. Can be done in MVP if you keep it simple (2 personas per audit).

---

### GAP-05: No Page Load Experience Capture

**What's missing:** You capture `DOMContentLoaded` and `LCP` as performance numbers, but not the loading experience. A page might have: layout shift that pushes the primary CTA below the fold for 2 seconds, a cookie consent banner covering the hero section, a loading spinner that blocks interaction for 3 seconds, lazy-loaded images that pop in and disrupt reading flow. Your perception captures the final rendered state, not the journey to that state.

**Why it matters:** CLS (Cumulative Layout Shift) is one of the top conversion killers. A consultant watches the page load and notices these issues instinctively. Your system sees only the final state and misses temporal problems entirely. Google's own research shows CLS above 0.1 correlates with significant bounce rate increases.

**Architectural fix:** Add CLS capture to `page_get_performance`. Playwright can capture this via the Performance Observer API. Add a `loading_sequence` capture: take 3 screenshots at 1s, 3s, and load-complete, then compare them to detect layout shift regions. Add `cls_score` and `layout_shift_regions` to AnalyzePerception.

**Development fix:** CLS capture via Playwright is straightforward — inject a Performance Observer before navigation, collect entries after load. The screenshot-comparison approach is more expensive (3 screenshots + image diffing) — defer that to Phase C. For MVP, just capture the CLS number and feed it to the evaluate step as data. If CLS > 0.1, flag it.

---

### GAP-06: No Scroll Depth / Content Density Analysis

**What's missing:** Your perception captures `foldPosition` (where the fold is) but not how long the page is relative to the viewport, or where key content sits in that scroll depth. A 14-screen-long product page with the "Add to Cart" button at screen 11 is a critical CRO problem. Your system has no concept of page length, content density per scroll-section, or CTA placement relative to total page depth.

**Why it matters:** Content placement relative to page length is a core CRO signal. "Primary CTA is at 85% scroll depth" is an actionable finding. "52% of users never scroll past 3 screens" is industry data that makes placement findings powerful. Your full-page screenshot (max 15000px) captures the data, but nothing in your analysis uses it.

**Architectural fix:** Add to AnalyzePerception: `pageHeight` (total scrollable height in px), `viewportCount` (pageHeight / viewportHeight), `ctaDepth` (each CTA's position as percentage of total page), `contentDensity` (word count per viewport-height section). Add a grounding rule: GR-012: CTA depth claims must match actual scroll position data.

**Development fix:** All of this is extractable in the `page_analyze` call via `document.body.scrollHeight` and element `getBoundingClientRect()`. Minimal additional code. Add it to the AnalyzePerception extraction in the MVP — the data is cheap to collect even if you don't use it immediately.

---

### GAP-07: No Industry Benchmarks in Heuristic Schema

**What's missing:** Your heuristic schema (§9.10) has: version, rule_vs_guidance, business_impact_weight, effort_category, preferred_states, status. It does NOT have: benchmark data, industry standards, or quantitative thresholds. When a consultant sees a form with 12 fields, they know the benchmark is 4-6 fields. When they see a page load time of 4.5s, they know the industry standard is under 2.5s. Your heuristics have no way to express "the standard is X, this page has Y, the gap is Z."

**Why it matters:** Findings with benchmarks are dramatically more persuasive and actionable. "Your checkout form has 14 fields" is an observation. "Your checkout form has 14 fields — industry benchmark is 6-8 for your category, and Baymard research shows each additional field reduces completion by 2-3%" is a finding worth paying for. The LLM can sometimes hallucinate benchmarks (which GR-007 partially addresses by banning conversion predictions), but real embedded benchmark data in the heuristic itself would be grounded and reliable.

**Architectural fix:** Add to heuristic schema: `benchmark` object with `value` (the standard), `source` (where it comes from), `unit` (fields, seconds, pixels, percentage), `comparison_operator` (less_than, greater_than, between). The evaluate step can compare perception data against heuristic benchmarks deterministically. Add GR-012 (or GR-013): benchmark claims must match heuristic benchmark data.

**Development fix:** This is a heuristic authoring task, not a code task. Add the schema field now, populate benchmarks for your top 20 heuristics first. The grounding rule is simple comparison code. High value, low effort.

---

### GAP-08: No Cross-Page Pattern Detection During Evaluation

**What's missing:** Separate from GAP-03 (funnel awareness). This is about detecting patterns across pages: "Every product page is missing social proof," "None of your category pages have filtering," "Trust badges are inconsistent — some pages have them, others don't." Your architecture has no mechanism for this because each page is evaluated independently, and accumulated findings aren't fed back into subsequent page evaluations.

**Why it matters:** Pattern findings are the most efficient recommendations. "Add trust badges to all product pages" is one fix for 30 pages. 30 individual findings saying "this page lacks trust badges" is noise that overwhelms the client. A consultant naturally spots patterns — your system produces redundant findings instead.

**Architectural fix:** Two options. (A) After all pages are analyzed, run a `pattern_detection` node that groups findings by heuristic_id across pages and produces rollup findings. This is simpler. (B) Feed accumulated findings from previous pages into the evaluate step for the current page, so the LLM can say "this is the same issue as pages 1, 3, and 5" and produce a rollup in real-time. Option B is more complex but produces cleaner output.

**Development fix:** Start with Option A. After the page loop completes, group `grounded_findings` by `heuristic_id`. If the same heuristic is violated on 3+ pages with similar evidence, create a `PatternFinding` that references all affected pages. This is pure code — no LLM needed. Add to `audit_complete` node.

---

### GAP-09: No Prioritized Action Plan Generation

**What's missing:** Your system produces findings with 4D scores (severity, confidence, impact, effort). But it doesn't produce an actionable implementation plan. Clients don't want a list of 47 findings. They want: "Fix these 5 things this sprint (high impact, low effort), these 10 next month (high impact, medium effort), and these are long-term (high impact, high effort)." Your scoring pipeline calculates priority, but nothing groups findings into an action roadmap.

**Why it matters:** This is the difference between a diagnostic tool and a consulting deliverable. Consultants charge $5K-$20K for audit reports. The report isn't 47 bullet points — it's a structured action plan with phases. Without this, your output looks like a bug tracker, not a strategy document.

**Architectural fix:** Add an `action_plan_generator` node after scoring. It groups findings into 3-4 implementation phases based on effort/impact quadrants (quick wins, strategic investments, incremental improvements, deprioritize). Each phase gets an estimated implementation timeline and expected impact range. This can be LLM-generated or deterministic based on scoring thresholds.

**Development fix:** For MVP, do this deterministically. Quick wins = high impact + low effort. Strategic = high impact + high effort. Nice-to-have = low impact + low effort. Deprioritized = low impact + high effort. Simple bucketing of your existing priority scores. No LLM needed. Add to the delivery layer.

---

### GAP-10: No Executive Summary Generation

**What's missing:** Your `audit_complete` node produces a "summary" but the spec doesn't define its structure, content, or quality bar. A real CRO audit report starts with a 1-page executive summary: overall site health score, top 3 critical issues, estimated revenue impact of fixing them, comparison to industry standards, and a recommended next step.

**Why it matters:** Decision-makers read the executive summary. CRO consultants read the findings. If you can't produce a compelling executive summary, the audit report doesn't get read by the people who approve the budget to fix things.

**Architectural fix:** Define `ExecutiveSummary` as a typed output of `audit_complete`. Fields: `overall_score` (from scoring pipeline), `critical_issues_count`, `top_findings` (top 3-5 by priority), `category_breakdown` (how many findings per category: forms, CTAs, trust, navigation, etc.), `strengths` (what the site does well — this is important), `recommended_next_steps`, `comparison_context` (if competitor data available).

**Development fix:** The overall_score comes from your scoring pipeline. The top findings come from sorting by priority. Category breakdown is a group-by on heuristic category. Strengths come from `mark_heuristic_pass` results. The recommended_next_steps can be a single LLM call that takes the top 5 findings and produces 3-5 sentences. Low effort, high value. Build this in Phase B.

---

### GAP-11: No Competitor Awareness During Evaluation

**What's missing:** Your architecture has competitor comparison in Phase 4 (audit_complete) — after all analysis is done. But the most valuable competitor insights inform the evaluation itself. "This site doesn't have a size guide" is a finding. "This site doesn't have a size guide, but all 3 competitors do" is a much stronger finding with built-in benchmarking.

**Why it matters:** Competitor context during evaluation produces findings that are more persuasive and harder to dismiss. It also helps prioritize: if every competitor does something, not doing it is a critical gap. If no competitor does it, it's a nice-to-have.

**Architectural fix:** If competitor audits have been run (or are part of the same batch), inject `competitor_signals` into the evaluate step. This doesn't mean re-running competitor audits — it means storing high-level signals from previous competitor audits (which pages exist, which features they have, key perception data like form field counts, CTA counts, trust signal types) and making them available to the evaluation prompt as context.

**Development fix:** This requires competitor audits to exist first. Defer to Phase C. But design the data model now: a `competitor_profile` table that stores aggregated signals from competitor audits. When evaluating a client page, optionally inject competitor signals for the same page type. The evaluate prompt gets: "Competitor A has X, Competitor B has Y. Does this site match?"

---

### GAP-12: No Accessibility Compliance Checking

**What's missing:** You capture the AX-tree, which is the accessibility tree. You use it primarily for element discovery and interaction. But you don't evaluate accessibility compliance as a CRO concern. Missing alt text, no ARIA labels, non-semantic HTML, keyboard navigation failures, color contrast below WCAG AA — these are both accessibility violations and conversion barriers.

**Why it matters:** Accessibility issues are conversion issues. Screen reader users can't buy if the form isn't labeled. Low-contrast text reduces readability for 10-15% of users. Missing alt text on product images is both an SEO and conversion problem. Accessibility audits are also increasingly mandated by law (ADA, EAA). A CRO audit that includes accessibility findings has dual value.

**Architectural fix:** Add 10-15 accessibility-focused heuristics to your KB. Your perception already captures: heading hierarchy, landmarks, semantic HTML, alt text, form labels, contrast ratios. You have the data — you just need heuristics that evaluate it. These should be Tier 1 (structural, highly reliable for LLM evaluation) with deterministic grounding rules (GR for WCAG contrast ratio thresholds, GR for missing alt text, GR for missing form labels).

**Development fix:** Author 10 accessibility heuristics using data you already extract. Add 2-3 new grounding rules for WCAG thresholds (e.g., contrast ratio >= 4.5:1 for AA, >= 7:1 for AAA). These are deterministic checks against data already in AnalyzePerception. Very low development cost.

---

### GAP-13: No Cookie Consent / Popup Handling Strategy

**What's missing:** Your state exploration mentions R11 (cookie cleanup) and R12 (chat cleanup), but the core browse+perceive flow has no strategy for handling cookie consent banners, email popups, chat widgets, and other overlays that appear on first load. These overlays cover page content, affect above-the-fold calculations, and interfere with screenshot capture.

**Why it matters:** On the majority of commercial websites, the first thing a user sees is a cookie consent banner or a popup. Your perception captures the page with these overlays present, which means: your fold calculations are wrong (the overlay pushes content down or covers it), your screenshots show a cluttered state that doesn't match the real user experience after dismissal, and your CTA analysis may detect the cookie button as the primary CTA.

**Architectural fix:** Add a `pre_perception_cleanup` step between page load and perception capture. This step: (1) detects common overlay patterns (cookie banners, email signup modals, chat widgets) via CSS/DOM heuristics (z-index > 1000, position: fixed, common class names), (2) dismisses or closes them, (3) waits for DOM stability, (4) then proceeds to perception. Additionally, the overlays themselves should be evaluated as a CRO concern — an intrusive popup that blocks content for 3 seconds is a finding.

**Development fix:** Build a simple `overlay_detector` that checks for high-z-index fixed/sticky elements after page load. Attempt to click the "accept" or "close" button using common selectors. This is a heuristic approach that won't work 100% of the time, but catches 80%+ of cases. Add to the browse subgraph between navigation and perception capture. MVP scope.

---

### GAP-14: No Screenshot Comparison / Visual Diff

**What's missing:** You have annotated screenshots showing problems, but no visual comparison between: the current state and a previous audit (for version tracking), the client site and a competitor (for competitive context), desktop and mobile viewports (for responsive issues). Your Version Diff (§21, audit_complete) is mentioned but its mechanism is undefined.

**Why it matters:** Visual diffs are incredibly powerful for client communication. "Here's your site 3 months ago, here's your site now, here's what changed" is immediately understandable. Text-based finding diffs are hard to parse. Visual diffs sell the value of ongoing audits.

**Architectural fix:** Add a `visual_diff_engine` that takes two screenshots (same page, different audit runs or different viewports) and produces a diff overlay (highlight changed regions). Store previous audit screenshots with `audit_run_id` + `page_url` as the key. In the delivery layer, expose a "compare with previous" view.

**Development fix:** Image diffing libraries exist (pixelmatch, looks-same). This is a Phase C feature — you need at least 2 audits of the same site before diffs are useful. But design your screenshot storage schema to support retrieval by `client_id + page_url + audit_run_id` from the start so you don't have to migrate later.

---

### GAP-15: No Before/After Recommendation Visualization

**What's missing:** Top CRO consultants don't just say "this CTA has low contrast." They show a mockup: "Here's what it looks like now → here's what it should look like." Your system produces text recommendations but no visual recommendation artifacts.

**Why it matters:** Clients implement findings faster when they can see the fix. A text recommendation ("increase CTA contrast to WCAG AA standard") requires interpretation. A visual mockup with the actual page showing the fix applied is immediately actionable by a designer or developer.

**Architectural fix:** This is advanced and should be Phase D. The approach: for certain finding types (color contrast, CTA sizing, element positioning), use Sharp or CSS injection to generate a "fixed" version of the annotated screenshot. For example, if the finding is "CTA contrast ratio is 2.1:1, should be 4.5:1," modify the screenshot to show the CTA with the recommended color. This is limited to visual findings only.

**Development fix:** Defer entirely. This is polish, not core value. But note it as a competitive differentiator for later.

---

## PART 2: GAPS IN SYSTEM ARCHITECTURE

These are structural, infrastructure, and design issues in your technical architecture.

---

### GAP-16: No Error Recovery Strategy for the Analysis Pipeline

**What's missing:** Your browse agent has detailed failure modes and recovery strategies (retry 3x, reflect/replan, HITL, circuit breaker). Your analysis pipeline has: "hallucination→grounding rejects, malformed→retry(2x), budget→graceful stop." What happens when: the LLM returns a response that's valid JSON but semantically nonsensical? The LLM times out mid-evaluation? The self-critique LLM disagrees with every finding (rejects all)? The grounding step rejects 100% of findings on a page?

**Why it matters:** At 20+ audits/week with 50 pages each, you'll process ~1000 pages/week. Even a 2% failure rate means 20 pages/week need recovery. If recovery isn't specified, those pages get silently skipped or produce empty results, which undermines audit completeness and client trust.

**Architectural fix:** Define explicit recovery paths for the analysis pipeline: (1) LLM timeout → retry with shorter heuristic batch (split 20 heuristics into 2 batches of 10), (2) 100% grounding rejection → flag page for consultant review with raw findings visible, (3) self-critique rejects all → skip self-critique for this page, proceed to grounding (let grounding be the safety net), (4) malformed output after 2 retries → extract whatever partial findings are parseable, flag page as partially analyzed. Add a `page_analysis_status` enum: complete, partial, failed, needs_review.

**Development fix:** Implement these as conditional branches in the analysis pipeline. The key type change: add `analysis_status` to the per-page result in AuditState. The audit_complete node should report: "47/50 pages fully analyzed, 2 partially analyzed, 1 failed." Build these branches in Phase B — MVP can silently skip failed pages.

---

### GAP-17: No Prompt Versioning and A/B Testing Infrastructure

**What's missing:** Your reproducibility snapshot pins prompt template hashes, which is good. But there's no mechanism to: test a new prompt version against the old one, compare finding quality between prompt versions, gradually roll out prompt changes, or roll back a bad prompt. You have immutable snapshots but no prompt lifecycle management.

**Why it matters:** Your prompt quality IS your product quality. You will iterate on prompts constantly — especially the evaluate and self_critique prompts. Without A/B testing, you're flying blind on whether prompt changes improve or degrade finding quality. A bad prompt change deployed to all audits could produce garbage for days before you notice.

**Architectural fix:** Add a `prompt_registry` that stores named prompt versions with metadata (created_at, author, test_results). The gateway should support a `prompt_version_override` parameter. For A/B testing: run the same page through two prompt versions, compare findings using finding overlap metrics (Jaccard similarity on heuristic_id + element_ref). Store prompt performance metrics (findings_per_page, grounding_pass_rate, consultant_approval_rate) per prompt version.

**Development fix:** For MVP, just use version-numbered prompt files (evaluate_v1.ts, evaluate_v2.ts) with the version stored in the reproducibility snapshot. The A/B testing infrastructure is Phase C. But start tracking `grounding_pass_rate` and `consultant_approval_rate` per audit from day one — this is the data you'll need for prompt optimization later.

---

### GAP-18: No Rate Limiting / Throttling for LLM API Calls

**What's missing:** Your browse agent has rate limiting (2s min interval, 10/min unknown domains). Your LLM API calls have no rate limiting. Claude and OpenAI both have rate limits (RPM, TPM). If you run 3 audits concurrently, each evaluating 20 heuristics per page, you could easily hit API rate limits.

**Why it matters:** Rate limit errors from LLM providers are the most common cause of audit failures in production. They're transient, unpredictable (depend on your tier and current load), and can cascade (one retry creates two more requests, which hit the limit again).

**Architectural fix:** Add rate limiting to the LLMAdapter. It should: track requests per minute and tokens per minute per provider, implement exponential backoff with jitter on 429 responses, queue requests when approaching limits, and report rate limit headroom via metrics. Your BullMQ job scheduler should also throttle concurrent audits to stay within API limits.

**Development fix:** Use a simple token bucket or sliding window rate limiter in the LLMAdapter. The key parameters (RPM, TPM) should be configurable per provider and adjustable without code deployment. Critical for production. Add in Phase B alongside your first concurrent audit capability.

---

### GAP-19: No Observability / Monitoring Beyond Tracing

**What's missing:** You have LangSmith for tracing (~$39/mo). That's it. No application metrics (audits per hour, findings per page, grounding rejection rates, average audit duration, cost per audit). No alerting (audit stuck for 30 minutes, budget burn rate exceeding threshold, grounding rejecting >80% of findings). No health checks. No dashboard for operational monitoring.

**Why it matters:** At 20+ audits/week, you need to know: are audits completing successfully? Is cost per audit stable? Is finding quality degrading? Is a specific site repeatedly failing? Without observability, you'll discover problems when a client complains that their audit has been "processing" for 6 hours.

**Architectural fix:** Add an `observability` layer. Minimum viable: (1) structured logging with audit_run_id correlation, (2) key metrics emitted as structured events (audit_started, audit_completed, page_analyzed, finding_grounded, finding_rejected, budget_exceeded, error_occurred), (3) a simple operational dashboard showing audit pipeline health. Use your existing PostgreSQL — store metrics in an `audit_metrics` table. No need for Prometheus/Grafana at this scale.

**Development fix:** Add structured logging from day one (use pino or similar). Every log line should include `audit_run_id` and `page_url`. Add a `metrics` table in Phase B. Build a simple admin dashboard page in Phase C. The key metric to track from MVP: `grounding_rejection_rate` per heuristic — this tells you which heuristics are producing hallucinated findings and need rewriting.

---

### GAP-20: No Graceful Degradation When LLM Provider Is Down

**What's missing:** You have Claude Sonnet 4 as primary and GPT-4o as fallback. But the failover mechanism is unspecified. When does it switch? After 1 failure? 3 failures? A timeout? Does it switch for the whole audit or just the failed call? Does it switch back? What if both are down? How do you handle the fact that different models will produce different findings for the same input (violating reproducibility)?

**Why it matters:** LLM APIs go down. Anthropic and OpenAI both have outages. Your clients don't care why — they care that their audit is stuck. Without a clear failover spec, you'll have partial audits with mixed-model findings that are neither reproducible nor consistent.

**Architectural fix:** Define failover policy in the LLMAdapter: (1) retry same provider 3x with exponential backoff, (2) if all 3 fail, switch to fallback provider for this specific call, (3) log the provider switch in the reproducibility snapshot, (4) if both providers fail, pause the audit and alert (don't silently continue with no LLM). Add a `model_used` field to each Finding so you can track which model produced what. Accept that cross-model reproducibility is impossible — document this as a known limitation.

**Development fix:** The LLMAdapter already abstracts the provider. Add a retry wrapper with provider fallback logic. The key implementation detail: the failover should be per-call, not per-audit. If Claude fails on page 7, use GPT-4o for page 7's evaluate, then try Claude again for page 8. This limits the blast radius.

---

### GAP-21: No Data Retention / Cleanup Policy

**What's missing:** Your database stores: findings, screenshots, audit runs, sessions, rejected findings, page states, state interactions, audit logs. Nothing in the spec defines how long data is kept. Screenshots in R2 accumulate indefinitely. Old audit data fills the database. There is no archival or cleanup strategy.

**Why it matters:** At 20 audits/week × 50 pages × 2 screenshots/page (viewport + fullpage) = 2000 screenshots/week. After 6 months, that's 50,000+ screenshots in R2. Database rows for findings, states, and interactions accumulate. Storage costs grow linearly with no bound. Clients expect to see their audit history, but how far back? Forever?

**Architectural fix:** Define retention tiers: (1) active data: last 3 audits per client — full access, all screenshots, all findings. (2) archived data: 3-12 months — findings and summary stored, screenshots compressed or thumbnailed, full screenshots deleted from R2. (3) deleted: >12 months — anonymized aggregate metrics retained for learning loop, all PII and screenshots deleted. Add a `data_retention_worker` to BullMQ that runs nightly.

**Development fix:** Add `created_at` and `expires_at` to all data tables. Build the cleanup worker in Phase C. For MVP, don't worry about it — you won't have enough data to matter for months.

---

### GAP-22: No Multi-Tenancy Isolation Beyond RLS

**What's missing:** Your RLS policy isolates client data at the database level. Good. But what about: LLM API keys (are all clients using your key, or do enterprise clients bring their own?), audit scheduling (one client's 50-page audit blocks another's 10-page audit), R2 storage (all screenshots in one bucket?), BullMQ queues (one queue for all audits?), cost tracking (can you attribute LLM costs per client for billing?).

**Why it matters:** The moment you have 2+ paying clients running audits simultaneously, tenant isolation becomes critical. A client's 50-page audit monopolizing the queue while another client waits is a support ticket waiting to happen. And if you can't attribute costs per client, you can't price correctly.

**Architectural fix:** Add per-client cost tracking in the LLMAdapter (track tokens and cost per `client_id + audit_run_id`). Add per-client queue priority in BullMQ (fair scheduling, not FIFO). Use client-prefixed paths in R2 (`/{client_id}/screenshots/...`). These are all simple additions to existing adapters.

**Development fix:** Add `client_id` to every LLM call's metadata for cost attribution. Use BullMQ's built-in priority queues. Use client-prefixed R2 paths. All of these are small additions to your adapter layer. Do them in Phase B when you onboard your second client.

---

### GAP-23: No Heuristic Performance Tracking

**What's missing:** You track findings per heuristic, but not heuristic performance metrics: which heuristics produce the most grounding rejections? Which ones do consultants override most often? Which ones produce findings that clients actually implement? Without this data, you can't optimize your heuristic KB — which you correctly identified as the quality bottleneck (§25, item 5).

**Why it matters:** Your system is only as good as your heuristics. If heuristic H-042 produces findings that get rejected 80% of the time, you need to know that so you can rewrite it or reclassify its tier. If H-017 produces findings that clients rave about, you need to know that too. Currently, you have no feedback signal from heuristic performance to heuristic quality.

**Architectural fix:** Add a `heuristic_metrics` table or view: per heuristic, track `total_evaluations`, `findings_produced`, `grounding_rejections`, `consultant_overrides` (approved/rejected), `client_implementations` (if tracked). Compute a `heuristic_health_score` = (findings_produced - grounding_rejections - consultant_rejections) / total_evaluations. Alert when health_score drops below 0.3. Feed this back into the learning loop (Phase 7).

**Development fix:** The data already flows through your pipeline — you just need to aggregate it. Add a `heuristic_id` index to your findings table (you probably already have this). Build a simple query that groups findings by `heuristic_id` and computes pass/fail/reject counts. Add as a dashboard widget for consultants. MVP scope — it's just a SQL query over existing data.

---

### GAP-24: No Handling of Internationalized / Non-English Sites

**What's missing:** Your entire spec assumes English-language websites. The heuristics are in English. The evaluation prompts assume English page content. The text analysis (word count, readability, paragraph detection) assumes English prose. What happens when a client asks you to audit a Spanish, Japanese, or Arabic website?

**Why it matters:** If REO Digital serves international clients (likely, given it's an Indian agency), non-English sites are inevitable. RTL layouts (Arabic, Hebrew) have completely different CRO considerations. Japanese e-commerce conventions differ from Western ones. Even basic text analysis (readability scores) requires language-aware processing.

**Architectural fix:** Add `language` and `locale` to the client profile and to AnalyzePerception (auto-detect from page `lang` attribute or content). For MVP, support English only but design the heuristic schema with a `language` field so heuristics can be tagged as language-specific or language-agnostic. Structural heuristics (CTA placement, form field count, contrast) are language-agnostic. Content heuristics (readability, microcopy, trust language) are language-specific.

**Development fix:** Auto-detect page language in `page_analyze` via the `html[lang]` attribute. Store it in AnalyzePerception. For non-English pages, skip language-specific heuristics and only run structural ones. This is a filter condition in your two-stage heuristic filtering. Low effort, prevents garbage output on non-English sites.

---

### GAP-25: No Webhook / Notification System for Audit Completion

**What's missing:** Your delivery layer has: CLI, dashboards, MCP server, SSE streaming. But there's no way to notify a consultant or client when an audit completes. Audits take 30+ minutes. No one is watching the SSE stream for 30 minutes. They start the audit and go do something else.

**Why it matters:** This is basic UX for an async processing system. Without notifications, consultants have to keep checking the dashboard. This feels broken and unprofessional, even if the audit ran perfectly.

**Architectural fix:** Add a `notification_service` adapter with implementations for: email (via any transactional email service), webhook (POST to a configured URL), and optionally Slack. Emit notifications on: audit_completed, audit_failed, findings_ready_for_review (for warm-up mode), HITL_required (for browse agent). Store notification preferences per client/consultant.

**Development fix:** For MVP, send an email when the audit completes. Use Resend, Postmark, or any transactional email service — a single API call. Add the webhook capability in Phase B for clients who want programmatic integration. Very low effort.

---

### GAP-26: No Testing Strategy for Heuristic Quality

**What's missing:** You have Vitest for unit tests and Playwright Test for integration tests. You have no testing strategy for the thing that matters most: do your heuristics produce good findings? There's no test suite that says "given this page with these known issues, the system should detect issues A, B, C and should NOT detect false positives X, Y, Z."

**Why it matters:** Heuristic quality is your #1 product risk (you said so yourself in §25). But you have no quality gate for heuristics. A consultant could write a badly-worded heuristic, deploy it, and it would produce garbage findings for weeks before anyone notices. You need golden test cases — pages with known CRO issues — that validate heuristic quality on every change.

**Architectural fix:** Create a `golden_test_suite`: 10-20 saved page snapshots (HTML + perception data) with manually annotated expected findings. On every heuristic change or prompt change, run the pipeline against golden tests and compare output to expected findings. Track: true positives (found expected issues), false negatives (missed expected issues), false positives (found non-existent issues). This is your regression test for audit quality.

**Development fix:** Start building golden tests during MVP development. Every time you test the pipeline on a real site and a consultant validates the findings, save that page's perception data + validated findings as a golden test case. By Phase B, you should have 10+ golden tests. Run them in CI on every prompt or heuristic change. This is the single most valuable testing investment you can make.

---

### GAP-27: No Concept of Audit Templates / Presets

**What's missing:** Your system treats every audit the same way: load all heuristics, filter by business type and page type, run everything. But different audit scenarios need different configurations: a quick-check audit (10 heuristics, 5 pages, fast), a deep audit (100 heuristics, 50 pages, thorough), a checkout-focused audit (checkout-specific heuristics, cart+checkout pages only), a post-redesign audit (compare with previous audit, focus on changed pages).

**Why it matters:** Consultants need flexibility. A client says "we just redesigned the checkout — can you check it?" The consultant doesn't want to run a full 50-page audit. They want a checkout-focused audit on 3-5 pages with relevant heuristics. Without templates, every audit is the same heavyweight process.

**Architectural fix:** Add an `AuditTemplate` type: `name`, `page_selection_strategy` (all, specific_types, specific_urls), `heuristic_filter_overrides` (include/exclude specific heuristic IDs or categories), `depth` (quick/standard/deep), `budget_override`, `viewport_strategy` (desktop, mobile, both). Templates are reusable and stored in the DB. The gateway accepts a `template_id` or inline template config.

**Development fix:** For MVP, hardcode a single "standard" template. Add the template system in Phase B when consultants start requesting different audit configurations. The key is to design your `AuditRequest` schema with a `template` field from the start, even if you only support one template initially.

---

### GAP-28: No Handling of Authentication-Required Pages

**What's missing:** Your browse agent handles login walls as a failure mode (§18) with HITL fallback. But many high-value CRO pages require authentication: account dashboards, checkout flows (with saved payment), personalized recommendations, loyalty program pages. The spec has no strategy for providing credentials, maintaining authenticated sessions, or handling 2FA.

**Why it matters:** The checkout flow is the most conversion-critical set of pages, and on many sites it requires authentication. If your system can't audit authenticated pages, you're missing the most valuable part of the funnel.

**Architectural fix:** Add a `credentials_vault` to the client profile — encrypted storage for test account credentials (email, password). The browse agent checks if the current page requires authentication (login form detected, redirect to login URL), and if credentials are available, performs the login flow before proceeding. 2FA is HITL — the consultant provides the code when prompted. Session cookies are preserved across pages within an audit.

**Development fix:** For MVP, have the consultant manually log in and pass the session cookies to the browse agent. The browse agent maintains the session across pages. This is simpler and avoids the complexity of automated login. Add automated login with stored credentials in Phase C.

---

### GAP-29: No PDF/Report Export

**What's missing:** Your delivery layer has dashboards and MCP server. There's no PDF report export. CRO consultants deliver PDF reports to clients — this is a core deliverable. Your dashboard is great for ongoing access, but the initial audit delivery is almost always a PDF or PowerPoint.

**Why it matters:** The PDF report is what the consultant sends to the client's VP of Marketing or Head of E-commerce. It's the artifact that justifies the consulting fee. Without it, your consultants have to manually create reports from dashboard data, which defeats the purpose of automation.

**Architectural fix:** Add a `report_generator` service that takes audit results and produces a branded PDF. Content: cover page, executive summary (GAP-10), findings grouped by priority/category, annotated screenshots, action plan (GAP-09), methodology note. Use a PDF generation library (puppeteer printing, or a template engine like Docmosis).

**Development fix:** Build a report-ready HTML template in Next.js that renders an audit report. Use Playwright's `page.pdf()` to convert to PDF. This leverages your existing stack (Playwright + Next.js) without new dependencies. Add in Phase B — your consultants need this before your product is useful to them.

---

### GAP-30: No Audit Scheduling / Recurring Audits

**What's missing:** Your system supports triggering audits via CLI and gateway. There's no concept of: scheduled recurring audits (run this audit every month), triggered audits (run when the client deploys a new site version), or batch audits (run audits for all clients on Tuesday nights).

**Why it matters:** The ongoing value of a CRO audit tool is continuous monitoring, not one-shot audits. "Your site health improved from 62 to 78 over the last 3 months" is a story that retains clients. Without scheduling, every audit is manual.

**Architectural fix:** Add a `scheduler` service using BullMQ's repeatable jobs. Store schedules per client: `audit_template_id`, `cron_expression`, `notification_config`. On trigger, create an `AuditRequest` through the gateway. Store schedule metadata alongside audit runs for historical tracking.

**Development fix:** BullMQ supports repeatable jobs natively. The implementation is: add a `schedules` table, a CRUD API for schedules, and a BullMQ repeatable job that creates audit requests on schedule. Phase C feature, but the schema design should account for it now (add `schedule_id` as an optional FK on `audit_runs`).

---

## PART 3: DEVELOPMENT PROCESS GAPS

These aren't feature gaps — they're gaps in how you plan to build and ship.

---

### GAP-31: No Definition of "Done" Per Task

**What's missing:** You have 213 tasks across 11 phases with task IDs. But there's no definition of what "done" means for each task. Does done mean: code written? Code reviewed? Tests passing? Integrated with adjacent components? Deployed? Smoke tested on a real site? Without this, task completion is subjective and progress tracking is unreliable.

**Improvement:** Define a universal DoD: (1) code written and self-reviewed, (2) unit tests passing, (3) smoke test on a real page (for browse/analyze tasks), (4) types compile with no errors, (5) integrated with adjacent nodes. This should be in your constitution.md.

---

### GAP-32: No Real-Site Test Suite From Day One

**What's missing:** Your integration tests are "on BBC/Amazon" (Phase 5). But you should be testing against real sites from the first perception code, not waiting until Phase 5.

**Improvement:** Pick 5 real e-commerce sites of varying complexity (a simple Shopify store, a mid-size retailer, a complex marketplace, a SPA-based store, a heavily-protected site). Save their HTML snapshots. Use these as your integration test fixtures from Phase 1. Every perception change, every analysis change gets tested against these 5 sites.

---

### GAP-33: No Incremental Demo Cadence

**What's missing:** Your milestones are at Phase 5 (browse works), Phase 8 (MVP audit), Phase 10 (MVP v2), Phase 11 (full product). That's 4 demo points across 17 weeks — too few. You need weekly demos to catch design mistakes early.

**Improvement:** Define a weekly demo target. Week 1: "I can load a page and extract the AX tree." Week 2: "I can extract AnalyzePerception from a real product page." Week 3: "I can evaluate 5 heuristics against a product page and get findings." Week 4: "Self-critique filters out bad findings." These micro-demos force integration early and prevent "Phase 5 surprise" where nothing works together.

---

### GAP-34: No Cost Tracking From Day One

**What's missing:** Your cost model is beautifully specified ($0.35/page static) but you have no plan to measure actual costs during development. You'll discover your cost model is wrong only if you track it.

**Improvement:** From the first LLM call in development, log: model, input_tokens, output_tokens, cost. Store in a simple table. After 50 pages of test audits, you'll know your real cost per page. Adjust budget caps and pricing based on real data, not estimates.

---

### GAP-35: Monorepo Complexity vs. Team Size

**What's missing:** You've specified Turborepo + pnpm workspaces with `packages/` + `apps/`. This is designed for teams of 5+ engineers working on independent packages. If you're 1-3 developers, the monorepo overhead (workspace configuration, cross-package type resolution, build caching, dependency hoisting issues) will slow you down more than it helps.

**Improvement:** For MVP, use a single package. One `src/` directory. No workspace resolution. No Turborepo build orchestration. You can always extract packages later when you have distinct deployment units. Don't pay the monorepo tax at 1-3 developers.

---

## SUMMARY: Priority-Ranked Gaps

| Priority | Gap | Impact | Effort |
|----------|-----|--------|--------|
| Critical | GAP-02: Mobile viewport | Half the audit missing | Medium |
| Critical | GAP-26: Heuristic quality testing | No quality gate for core value | Medium |
| Critical | GAP-16: Analysis error recovery | Silent failures in production | Low |
| Critical | GAP-34: Cost tracking from day one | Flying blind on economics | Low |
| High | GAP-01: Site discovery | Core use case unsupported | High |
| High | GAP-03: Funnel/journey awareness | Missing highest-value findings | High |
| High | GAP-13: Cookie/popup handling | Perception data polluted | Low |
| High | GAP-29: PDF report export | Consultants can't deliver | Medium |
| High | GAP-18: LLM rate limiting | Production failures | Low |
| High | GAP-19: Observability | Blind in production | Medium |
| High | GAP-32: Real-site test suite | Late integration surprises | Low |
| Medium | GAP-04: Persona-based evaluation | Mechanical vs. insightful findings | Low |
| Medium | GAP-07: Industry benchmarks | Weaker findings | Low |
| Medium | GAP-08: Cross-page patterns | Redundant findings | Medium |
| Medium | GAP-09: Action plan generation | Diagnostic vs. deliverable | Low |
| Medium | GAP-10: Executive summary | Missing client-facing output | Low |
| Medium | GAP-20: LLM failover | Outage vulnerability | Low |
| Medium | GAP-22: Multi-tenancy isolation | 2+ client issues | Medium |
| Medium | GAP-23: Heuristic performance tracking | Can't optimize core value | Low |
| Medium | GAP-25: Notifications | Bad async UX | Low |
| Medium | GAP-27: Audit templates | Inflexible for consultants | Medium |
| Medium | GAP-33: Weekly demos | Late failure discovery | Low |
| Lower | GAP-05: Page load experience | CLS issues missed | Medium |
| Lower | GAP-06: Scroll depth analysis | Missing a signal | Low |
| Lower | GAP-11: Competitor during eval | Weaker competitive findings | High |
| Lower | GAP-12: Accessibility checking | Missed dual-value findings | Low |
| Lower | GAP-14: Visual diff | Nice-to-have | Medium |
| Lower | GAP-17: Prompt A/B testing | Can't optimize prompts scientifically | High |
| Lower | GAP-21: Data retention | Won't matter for 6 months | Low |
| Lower | GAP-24: Non-English sites | Only if serving international | Medium |
| Lower | GAP-28: Auth pages | Limits funnel coverage | High |
| Lower | GAP-30: Recurring audits | Manual trigger is fine initially | Medium |
| Lower | GAP-15: Before/after visualization | Polish feature | High |
| Lower | GAP-31: Definition of done | Process improvement | Low |
| Lower | GAP-35: Monorepo simplification | Dev speed at small scale | Low |

---

*35 gaps. 12 critical/high priority. Your architecture is 75-80% there for the core pipeline. The gaps are in the edges: what happens before the pipeline (discovery, overlays), what happens after (reports, summaries, action plans), what happens across pages (patterns, funnels), and what happens when things go wrong (recovery, failover, monitoring). Fix the critical gaps first, design for the high ones, and defer the rest.*
