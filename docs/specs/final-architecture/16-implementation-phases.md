---
title: 16-implementation-phases
artifact_type: architecture-spec
status: approved
loadPolicy: on-demand-only
version: 2.4
updated: 2026-04-28
governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R22 (The Ratchet)
note: Reference material. Do NOT load by default (CLAUDE.md Tier 3). Load only the single REQ-ID section cited by the current task.
changelog:
  - v2.4 (2026-04-28) Unified phase plan. Replaces previous §16.1-§16.4 (12-phase scheme) and §16.5 (16-phase master map) with a single 16-phase / 3-track plan. Reconciles with §33a per-phase interface requirements.
---

# Section 16 — Implementation Phases (16 Phases, 3 Tracks)

> **Note on previous scheme:** Earlier revisions of this document carried two competing phase plans — the §16.1 12-phase plan and the §16.5 16-phase master map. These are now consolidated into the single 3-track plan below. §33a's per-phase interface requirements are referenced inline.

---

## 16.1 Three-Track Overview

The full master architecture is delivered across **16 phases organized into 3 tracks**. Each track ends in a hard milestone gate.

| Track | Phases | Scope | Milestone |
|-------|--------|-------|-----------|
| **A — MVP** | 1–8 | Single-tenant, single-channel, single-site CLI audit. Static analyze pipeline. | **MVP audit working end-to-end** |
| **B — Product** | 9–12 | Multi-tenant SaaS, competitor/version diff, dashboards, basic production deployment. | **Production-ready single-channel SaaS** |
| **C — Master** | 13–16 | Master extensions: discovery, workflows, agent composition (interactive evaluate), durable orchestration, learning, analytics, observability. | **Full master architecture** |

### Phase Index

| Phase | Name | Track | Weeks | Primary Specs | Exit Gate |
|-------|------|-------|-------|---------------|-----------|
| **1** | Perception Foundation | A | 1–2 | §06 §6.6 | PageStateModel on 3+ sites |
| **1b** | Perception Extensions (v2.4 gap closure) | A | 2–3 | §07 §7.9.2 | 10 new field groups in AnalyzePerception |
| **1c** | PerceptionBundle Envelope (v2.5) | A | 3–5 | §07 §7.9.3, §06 §6.6 (DOM traversal) | Element fusion + settle predicate + nondeterminism flags + warnings |
| **2** | MCP Tools + Human Behavior | A | 5–7 | §08, §06 §6.4 | All 28 tools MCP-compliant + ToolRegistry (§33a) |
| **3** | Verification & Confidence | A | 7–8 | §06 §6.7 | 9 verify strategies + confidence scoring |
| **4** | Safety + Data Layer | A | 8–9 | §11 (incl. §11.1.1 robots/ToS hard rules), §13, §34 | Safety classifier (§33a SafetyContext), Postgres, LLM adapter, robots.txt enforcement, `context_profiles` table |
| **4b** | Context Capture Layer (v1.0) | A | 9–11 | §37, §13 (context_profiles), §18 (AuditRequest intake) | ContextProfile contract + provenance + clarification loop + URL/JSON-LD inference + constraints |
| **5** | Browse Mode MVP | A | 11–12 | §04, §06 | 5-node browse graph end-to-end (external session, §33a) |
| **5b** | Multi-Viewport + Popup Behavior + Trigger Taxonomy + Cookie Banner | A | 12–15 | §07 §7.9.2, §18 (viewports flag), §20 (trigger taxonomy widening) | Mobile-vs-desktop diff + popup runtime probing + 5 new trigger types + cookie policy |
| **6** | Heuristic Knowledge Base | A | 15–16 | §09 (consumes ContextProfile for filtering) | 60 heuristics, 3 tiers, filtering |
| **7** | Analysis Pipeline (Static) | A | 16–18 | §07 | 5-step pipeline + EvaluateStrategy interface (§33a), reads from PerceptionBundle + ContextProfile |
| **8** | Audit Orchestrator + Single-Site Audit | A | 18–19 | §04 (audit_setup invokes Context Capture first), §05 | **MVP MILESTONE — Single-site audit, CLI, with context-aware heuristic selection** |
| **9** | Competitor + Versioning | B | 19–21 | §10 | Pairwise comparison + version diff |
| **10** | Client Management + Review Gate | B | 21–22 | §12, §13 (RLS), Clerk | Multi-tenant auth + review gate publishing |
| **11** | Delivery Layer + Report Generation | B | 22–24 | §14, §35 | MCP server + dashboards + PDF reports |
| **12** | Production Phase 1 | B | 24–26 | §16.4 ops artifacts | **PRODUCT MILESTONE — Production deployment** |
| **13** | Trigger Gateway + Discovery + Workflows + State Graph Formalization + Hybrid Reset + Storage Restore + Nondeterminism Detection | C | 26–30 | §18, §19, §20 (incl. §20.9.1-§20.9.3), §21, §23 | Multi-channel triggers + funnel auditing + formal StateGraph edges + hybrid state reset + storage snapshot/restore + nondeterministic state warning (v3.1) |
| **13b** | Context Capture Phase 2 (v2.0) | C | 30–31 | §37 §37.8, §25 | Awareness levels + decision style + message-match + is_indexed + geo/locale + dashboard intake form + repro pinning |
| **14** | Agent Composition + Interactive Evaluate + Cross-Channel Query API | C | 31–33 | §33, §33a, §07 §7.9.3 | **Retrofits §07** — interactive evaluate live + bundle.queryElements API |
| **15** | Durable Orchestration + Reproducibility + Two-Store + Cost | C | 33–35 | §24, §25, §26, §27 | Temporal Tier 1, immutable snapshots, hard cost caps |
| **16** | Learning + Heuristic Evolution + Hypothesis + Analytics + Observability + Golden Tests | C | 35–38 | §22, §28, §29, §30, §34, §36 | **MASTER MILESTONE — Full master architecture** |

**Total timeline: ~38 weeks** (MVP at week 19, Product at week 26, Master at week 38). +10 weeks vs. v2.4 baseline due to:
- Phase 1b (perception gap closure, +1w)
- Phase 5b extended scope (multi-viewport + popup behavior + trigger taxonomy + cookie policy, +3w combined)
- Phase 1c (PerceptionBundle envelope, +2w)
- Phase 4b (Context Capture Layer v1.0, +2w)
- Phase 13b (Context Capture Phase 2, +1w in master track)
- Phase 13 v3.1 extension (hybrid state reset + storage restore + nondeterministic state warning, +1w in master track)
- Phase 5c deferred to Phase 13 (no extra MVP cost; master track absorbs)

---

## 16.2 Dependency Graph

```
TRACK A — MVP
─────────────
Phase 1 (Perception)
  └──▶ Phase 1b (Perception Extensions v2.4)             ← gap closure: pricing, click targets, sticky, popups, friction, social proof, microcopy, attention, commerce, currency switcher
        └──▶ Phase 1c (PerceptionBundle Envelope v2.5)   ← element fusion + settle predicate + nondeterminism flags + warnings + Shadow DOM + iframe + pseudo-elements
              └──▶ Phase 2 (Tools + Human Behavior)      ← §33a: ToolRegistry, output tool schemas
                    └──▶ Phase 3 (Verification + Confidence)
                          └──▶ Phase 4 (Safety + Data Layer + robots/ToS hard rules) ← §33a: SafetyContext, BrowserSessionManager + context_profiles table
                                └──▶ Phase 4b (Context Capture Layer v1.0)            ← ContextProfile + provenance + clarification loop + URL/JSON-LD inference + constraints
                                      └──▶ Phase 5 (Browse Mode MVP)                  ← §33a: external session injection
                                      └──▶ Phase 5b (Multi-Viewport + Popup Behavior + Trigger Taxonomy + Cookie Banner) ← desktop+mobile diff, popup probing, 5 new triggers (hover/scroll/time_delay/exit_intent/form_input), cookie policy (dismiss/preserve/block)
                                            └──▶ Phase 6 (Heuristic KB)
                                                  └──▶ Phase 7 (Analysis Pipeline)   ← reads from PerceptionBundle; §33a: EvaluateStrategy
                                                        └──▶ Phase 8 (Orchestrator)  ← §33a: session passing, restore_state node
                                                              │
                                                              ▼  ◆ MVP MILESTONE ◆
TRACK B — PRODUCT
─────────────────
                                            └──▶ Phase 9 (Competitor + Version)
                                                  └──▶ Phase 10 (Client Mgmt + Review Gate)
                                                        └──▶ Phase 11 (Delivery + Report Gen)
                                                              └──▶ Phase 12 (Production Phase 1)
                                                                    │
                                                                    ▼  ◆ PRODUCT MILESTONE ◆
TRACK C — MASTER
────────────────
                                                                    └──▶ Phase 13 (Gateway + Discovery + Workflows)
                                                                          └──▶ Phase 14 (Agent Composition) ◆ retrofits §07
                                                                                └──▶ Phase 15 (Durable + Repro + Two-Store + Cost)
                                                                                      └──▶ Phase 16 (Learning + Hypothesis + Analytics + Observability)
                                                                                            │
                                                                                            ▼  ◆ MASTER MILESTONE ◆
```

**Critical ordering constraint:** Phase 13 (state exploration §20) MUST precede Phase 14 (agent composition §33), because interactive evaluate consumes the StateGraph produced by `explore_states` (§33a Phase 10).

---

## 16.3 Track A — MVP Detail (Phases 1–8 + 1b + 5b)

> **Note on week numbers in detail headers:** Phases 1, 1b, 5, 5b have authoritative weeks. Subsequent phase detail headers retain their original v2.4 week numbers for reference; the phase index in §16.1 reflects the post-1b/post-5b timeline shifts. Both views describe the same phase ordering — only the absolute weeks shift by +3.

### Phase 1 — Perception Foundation (Week 1–2)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 1.1 | BrowserManager | `browser-runtime/BrowserManager.ts` | Launch, navigate to `amazon.in`, close | No crash, page loads, clean shutdown |
| 1.2 | StealthConfig | `browser-runtime/StealthConfig.ts` | Navigate to `bot.sannysoft.com` | All stealth checks pass |
| 1.3 | AX-Tree Extractor | `perception/AccessibilityExtractor.ts` | Extract from `amazon.in` | >50 nodes, includes search box |
| 1.4 | Hard Filter | `perception/HardFilter.ts` | Filter AX-tree | Count drops >50% |
| 1.5 | Soft Filter | `perception/SoftFilter.ts` | Filter with task context | Relevant elements score higher |
| 1.6 | Mutation Monitor | `perception/MutationMonitor.ts` | Click on SPA | Detects mutations, settles within 2s |
| 1.7 | Screenshot Extractor | `perception/ScreenshotExtractor.ts` | Screenshot page | JPEG <150KB, ≤1280px wide |
| 1.8 | Context Assembler | `perception/ContextAssembler.ts` | Full PageStateModel | All fields populated |

**Exit Gate:** PageStateModel on 3 sites (amazon.in, bbc.com, github.com), <1500 tokens each, stealth passes.

### Phase 1b — Perception Extensions v2.4 (Week 2–3)

**Spec:** §07 §7.9.2. **Closes:** 9 perception gaps from master-checklist coverage audit + currency switcher.

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 1b.1 | PricingExtractor | `perception/extensions/PricingExtractor.ts` | Extract from PDP fixture | Display format + amount + currency + tax + anchor + discount % populated when present |
| 1b.2 | ClickTargetSizer | `perception/extensions/ClickTargetSizer.ts` | Compute size on 5 fixtures | `isMobileTapFriendly` true for ≥48×48, false for <48×48 |
| 1b.3 | StickyElementDetector | `perception/extensions/StickyElementDetector.ts` | Detect sticky CTA / cart / nav | Type, position strategy, viewport coverage, isAboveFold, containsPrimaryCta |
| 1b.4 | PopupPresenceDetector | `perception/extensions/PopupPresenceDetector.ts` | Detect modal / cookie / consent at load | Type, presence, hasCloseButton, viewportCoveragePercent, blocksPrimaryContent. (Behavior fields null until Phase 5b) |
| 1b.5 | FrictionScorer | `perception/extensions/FrictionScorer.ts` | Compute on form + popup fixture | `raw` and `normalized` (0-1) computed correctly |
| 1b.6 | SocialProofDepthEnricher | `perception/extensions/SocialProofDepthEnricher.ts` | Extract from review block | reviewCount, starDistribution, recencyDays, hasAggregateRating populated |
| 1b.7 | MicrocopyTagger | `perception/extensions/MicrocopyTagger.ts` | Tag near-CTA microcopy on 5 fixtures | risk_reducer / urgency / security tags applied with ≥80% precision |
| 1b.8 | AttentionScorer | `perception/extensions/AttentionScorer.ts` | Compute dominant element + 3 hotspots | One dominant element, score 0-1, 3 contrast hotspots |
| 1b.9 | CommerceBlockExtractor | `perception/extensions/CommerceBlockExtractor.ts` | Extract on PDP / cart fixtures | stockStatus, shippingSignals[], returnPolicyPresent populated when commerce |
| 1b.10 | CurrencySwitcherDetector | `perception/extensions/CurrencySwitcherDetector.ts` | Detect switcher in nav fixtures | present, currentCurrency, availableCurrencies, isAccessibleAt populated |
| 1b.11 | AnalyzePerception v2.4 schema (Zod) | `perception/schema.ts` | Validate full v2.4 perception | All 10 new field groups validated; backward-compat with v2.3 maintained |
| 1b.12 | **Integration: extensions on test pages** | `tests/integration/perception-extensions.test.ts` | Run on 5 fixture sites | All 10 extensions populate without error; total payload ≤6.5K tokens |

**Exit Gate:** All 10 v2.4 fields populated on PDP / homepage / cart / checkout / content fixture pages. Token budget for AnalyzePerception ≤6.5K (under 8K hard cap). Backward compatibility verified — v2.3-only consumers unaffected.

### Phase 1c — PerceptionBundle Envelope v2.5 (Week 3–5)

**Specs:** §07 §7.9.3 (PerceptionBundle envelope + ElementGraph + FusedElement), §06 §6.6 v2.5 (DOM traversal extensions). **Adopts:** `docs/Improvement/perception_layer_spec.md` build-order items 1, 2, 6, plus Shadow DOM + iframe + pseudo-element traversal. **Wraps existing AnalyzePerception — does not replace.**

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 1c.1 | SettlePredicate | `perception/SettlePredicate.ts` | Wait for settle on SPA fixtures (network idle + mutation stop + fonts ready + animations done) | Returns within 5s hard cap; emits `SETTLE_TIMEOUT_5S` warning if capped |
| 1c.2 | ShadowDomTraverser | `perception/ShadowDomTraverser.ts` | Walk 3 nested shadow roots | Captures all elements; emits `SHADOW_DOM_NOT_TRAVERSED` if depth >5 |
| 1c.3 | PortalScanner | `perception/PortalScanner.ts` | Detect React Portal modals | Marks `is_portal: true`; finds elements outside logical tree |
| 1c.4 | PseudoElementCapture | `perception/PseudoElementCapture.ts` | Capture `::before` content on badge fixture | Returns "NEW" / "BESTSELLER" / required-field markers |
| 1c.5 | IframePolicyEngine | `perception/IframePolicyEngine.ts` | Process 5 iframe types | checkout/chat → descend; video/analytics/social_embed → skip + emit `IFRAME_SKIPPED` warning |
| 1c.6 | HiddenElementCapture | `perception/HiddenElementCapture.ts` | Capture display:none + aria-hidden + offscreen | `hiddenElements[]` populated with reason |
| 1c.7 | ElementGraphBuilder | `perception/ElementGraphBuilder.ts` | Build fused graph from 5 fixture pages | Top-30 elements per state with stable `element_id`, AX + DOM + bbox + style + crop_url joined; `ref_in_analyze_perception` cross-references populated |
| 1c.8 | NondeterminismDetector | `perception/NondeterminismDetector.ts` | Detect Optimizely / VWO / Google Optimize / personalization cookies | `nondeterminism_flags[]` populated; specific flags per detector |
| 1c.9 | WarningEmitter | `perception/WarningEmitter.ts` | Emit warnings during capture | Bundle has `warnings[]` with code, message, severity |
| 1c.10 | PerceptionBundle (Zod schema + envelope) | `perception/PerceptionBundle.ts` | Wrap existing AnalyzePerception + ElementGraph + state nodes | Bundle validates; backward-compat helper `bundleToAnalyzePerception()` works for legacy consumers |
| 1c.11 | Settle integration into deep_perceive | `analysis/nodes/DeepPerceiveNode.ts` (extend) | Run settle before AnalyzePerception capture | Settle predicate gates capture; warnings propagate to bundle |
| 1c.12 | **Phase 1c integration test** | `tests/integration/perception-bundle.test.ts` | Build PerceptionBundle on 5 fixture sites | All channels populated; bundle ≤8.5K tokens per state; element_graph ≤30 elements; backward-compat with v2.4 consumers verified |

**Exit Gate:** PerceptionBundle envelope wraps all v2.4 perception data. ElementGraph populated with top 30 elements per state (cross-channel queryable). Settle predicate caps wait at 5s. Nondeterminism flags emit when A/B testing platforms detected. Shadow DOM, Portals, pseudo-elements, iframe policy all work. Backward compat: existing consumers reading `AnalyzePerception` still work via accessor helpers. Token budget: bundle ≤8.5K per state.

### Phase 2 — MCP Tools + Human Behavior (Week 2–4)

**§33a Interface Prep:** ToolRegistry with dynamic tool sets (REQ-COMP-PHASE2-001) + 3 analysis output tool schemas (REQ-COMP-PHASE2-002) defined now, activated in Phase 14.

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 2.1 | MouseBehavior | `human-behavior/MouseBehavior.ts` | Move (0,0)→(500,300) | Bezier curve, ~500ms |
| 2.2 | TypingBehavior | `human-behavior/TypingBehavior.ts` | Type "hello world" | 3-6s, 1-2% typos |
| 2.3 | ScrollBehavior | `human-behavior/ScrollBehavior.ts` | Scroll 3x | Variable momentum |
| 2.4 | MCP Server | `mcp/MCPServer.ts` | List tools | 28 tools with Zod schemas |
| 2.5 | **ToolRegistry** (§33a) | `mcp/ToolRegistry.ts` | `getToolsForContext({mode:"browse"})` | Returns 23 browse tools |
| 2.6–2.28 | 23 Browse Tools | `mcp/tools/*.ts` | Individual tool tests | Each tool works in isolation |
| 2.29 | page_analyze | `mcp/tools/pageAnalyze.ts` | Analyze bbc.com | Full AnalyzePerception returned |
| 2.30 | page_get_element_info | `mcp/tools/pageGetElementInfo.ts` | Get CTA info | BoundingBox, isAboveFold, styles |
| 2.31 | page_get_performance | `mcp/tools/pageGetPerformance.ts` | Get metrics | DOMContentLoaded, fullyLoaded |
| 2.32 | page_screenshot_full | `mcp/tools/pageScreenshotFull.ts` | Full page | Image <2MB, full scroll |
| 2.33 | page_annotate_screenshot | `mcp/tools/pageAnnotateScreenshot.ts` | 5 pins | Pins rendered, colors correct |
| 2.34 | **Analysis output tool schemas** (§33a) | `mcp/tools/analysisOutputs.ts` | Schemas validate | `produce_finding`, `mark_heuristic_pass`, `mark_heuristic_needs_review` defined |
| 2.35 | JS Sandbox | `mcp/JSSandbox.ts` | Access cookies | Blocked |
| 2.36 | Rate Limiter | `rate-limit/RateLimiter.ts` | 5 actions in 1s | Only first, rest queued |

**Exit Gate:** All 28 tools callable via MCP. ToolRegistry returns correct set per context. Stealth + ghost-cursor working. Sandbox blocks cookies. Rate limiter enforces 2s.

### Phase 3 — Verification & Confidence (Week 4–5)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 3.1 | ActionContract | `verification/ActionContract.ts` | Create contract | Has expected_outcome + verify_strategy |
| 3.2–3.10 | 9 Verify Strategies | `verification/strategies/*.ts` | Individual tests | Each strategy works |
| 3.11 | VerifyNode | `verification/VerifyNode.ts` | Action + verify | Mutation-aware, checks strategy |
| 3.12 | FailureClassifier | `verification/FailureClassifier.ts` | 7 types | Correct routing |
| 3.13–3.15 | ConfidenceScorer | `confidence/ConfidenceScorer.ts` | 50 steps | Stays (0,1), thresholds work |

**Exit Gate:** 9 strategies work. Mutation-aware. Confidence bounded. Failure taxonomy routes correctly.

### Phase 4 — Safety + Data Layer (Week 5–6)

**§33a Interface Prep:** `SafetyContext` parameter (REQ-COMP-PHASE4-001) + `BrowserSessionManager` as shareable handle (REQ-COMP-PHASE4-002).

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 4.1 | ActionClassifier (§33a SafetyContext) | `safety/ActionClassifier.ts` | Classify with `callingNode:"browse"` | Correct class per tool |
| 4.2 | SafetyCheck | `safety/SafetyCheck.ts` | Download action | Blocks sensitive |
| 4.3 | DomainPolicy | `safety/DomainPolicy.ts` | Banking domain | Blocked |
| 4.4 | CircuitBreaker | `safety/CircuitBreaker.ts` | 3 failures | Domain blocked 1hr |
| 4.5 | AuditLogger | `safety/AuditLogger.ts` | Log action | Row in audit_log |
| 4.6 | **BrowserSessionManager** (§33a) | `browser-runtime/BrowserSessionManager.ts` | create + get + close | Session id-addressable, shareable |
| 4.7 | PostgreSQL Schema | `db/schema.sql` | Run migrations | All tables created |
| 4.8 | Drizzle Schema | `db/schema.ts` | TypeScript compiles | All tables defined |
| 4.9 | SessionRecorder | `db/SessionRecorder.ts` | Record session | Session retrievable |
| 4.10 | AnthropicAdapter | `adapters/AnthropicAdapter.ts` | Send prompt | Tool calls returned |
| 4.11 | OpenAIAdapter (deferred to v1.2) | `adapters/OpenAIAdapter.ts` | Same prompt | Same format |
| 4.12 | AdapterFactory | `adapters/LLMAdapterFactory.ts` | Swap config | No code change |
| 4.13 | StreamEmitter | `streaming/StreamEmitter.ts` | Emit event | Event received |

**Exit Gate:** Safety classification correct with `SafetyContext`. BrowserSessionManager works. Postgres deployed. LLM adapter works. Streaming events flowing.

### Phase 4b — Context Capture Layer v1.0 (Week 9–11)

**Spec:** §37 (Context Capture Layer). **Adopts:** `docs/Improvement/context_capture_layer_spec.md` items 1-6 (must-inherit). **Closes:** master plan's fragmented context handling. **Pre-perception layer** — runs before Phase 5 browse and Phase 7 analyze.

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 4b.1 | ContextProfile Zod schema (5 dimensions + provenance) | `packages/agent-core/src/context/ContextProfile.ts` | Validate fixture profile | All 5 dimensions validate; `{value, source, confidence}` per field; immutable after `Object.freeze` |
| 4b.2 | URLPatternMatcher | `packages/agent-core/src/context/URLPatternMatcher.ts` | Match 30 fixture URLs | ≥95% page-type accuracy on `/`, `/products/`, `/cart`, `/checkout`, `/landing/` patterns |
| 4b.3 | HtmlFetcher (cheerio + undici) | `packages/agent-core/src/context/HtmlFetcher.ts` | Fetch 5 sites with realistic UA | Single GET; 5s timeout; respects robots.txt; emits `CONTEXT_FETCH_FAILED` on error; no Playwright dependency |
| 4b.4 | JsonLdParser | `packages/agent-core/src/context/JsonLdParser.ts` | Parse Product / Service / SoftwareApplication fixtures | `@type` extracted; offers / pricing parsed |
| 4b.5 | BusinessArchetypeInferrer (CTA + pricing patterns) | `packages/agent-core/src/context/BusinessArchetypeInferrer.ts` | Infer on D2C / B2B / SaaS fixtures | "Add to cart" → D2C confident; "Request demo" → B2B confident; "/mo" + signup → SaaS confident |
| 4b.6 | PageTypeInferrer (consolidates §07 §7.4 logic) | `packages/agent-core/src/context/PageTypeInferrer.ts` | Infer on 30 fixture URLs | ≥0.7 confidence on 90% of fixtures; emits `inferredPageType` shape compatible with §07 §7.4 |
| 4b.7 | ConfidenceScorer + ProvenanceAssembler | `packages/agent-core/src/context/ConfidenceScorer.ts` | Score 5-dimension fixture | All fields tagged with source + confidence; weighted overall_confidence ∈ [0,1] |
| 4b.8 | OpenQuestionsBuilder | `packages/agent-core/src/context/OpenQuestionsBuilder.ts` | Build questions for low-confidence fixture | `open_questions[]` populated; `blocking: true` when REQUIRED + confidence < 0.6 |
| 4b.9 | AuditRequest intake schema (extend §18) | `packages/agent-core/src/gateway/AuditRequest.ts` | Validate intake block | `goal.primary_kpi` REQUIRED; `constraints.regulatory` non-empty for regulated verticals |
| 4b.10 | CLI clarification prompt | `apps/cli/src/contextClarification.ts` | Prompt user for blocking questions | User answers via stdin; merges into ContextProfile; resumes audit |
| 4b.11 | ContextCaptureNode (audit_setup integration) | `packages/agent-core/src/orchestration/nodes/ContextCaptureNode.ts` | Run before audit_setup on test audit | Halts on blocking; populates `state.context_profile_id`; pinned to `context_profiles` table |
| 4b.12 | context_profiles table migration (Drizzle) | `packages/agent-core/src/db/migrations/0XX_context_profiles.sql` | Run migration | Append-only enforcement; SHA-256 hash stored; foreign key to audit_runs |
| 4b.13 | HeuristicLoader extension (consume ContextProfile) | `packages/agent-core/src/analysis/heuristics/HeuristicLoader.ts` (extend) | Load with ContextProfile | Filter by `business.archetype` + `page.type` + `traffic.device_priority` from profile |
| 4b.14 | Constitution R25 compliance check | `packages/agent-core/tests/constitution/R25.test.ts` | Verify Context Capture MUST NOT list | No perception calls; no judgment fields; provenance recorded; no silent guesses |
| 4b.15 | **Phase 4b integration test** | `tests/integration/context-capture.test.ts` | Run on 5 fixture sites with intake variations | All 5 dimensions populated with provenance; clarification loop fires on weak signals; profile hashed and pinned; audit halts then resumes correctly |

**Exit Gate:** ContextProfile produced for every audit. Provenance per field. Blocking questions halt audit; user answers resume cleanly. Constraints respected (regulated verticals require regulatory list). HeuristicLoader filters by ContextProfile.business + page + device. context_profiles table immutable. R25 compliance verified.

### Phase 5 — Browse Mode MVP (Week 6–7)

**§33a Interface Prep:** Browse subgraph receives external session (REQ-COMP-PHASE5-001), `browser_session_id` added to AuditState (REQ-COMP-PHASE5-002). Session creation/disposal happens in orchestrator, not browse.

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 5.1 | AgentState | `orchestration/AgentState.ts` | Compile, serialize | All fields, invariants, includes `browser_session_id` |
| 5.2 | StateValidators | `orchestration/StateValidators.ts` | Violate invariants | Errors thrown |
| 5.3–5.7 | 5 Graph Nodes | `orchestration/nodes/*.ts` | Individual tests | Each node works (receives session via state) |
| 5.8 | BrowseGraph (external session) | `orchestration/BrowseGraph.ts` | Compile graph | All edges connected, session injected |
| 5.9–5.10 | Routing Functions | `orchestration/edges.ts` | Route tests | Correct routing |
| 5.11 | SystemPrompt | `orchestration/SystemPrompt.ts` | Render | Tools + constraints |
| 5.12 | **Integration: BBC** | `tests/integration/bbc.test.ts` | Extract headlines | 3 headlines <30s |
| 5.13 | **Integration: Amazon** | `tests/integration/amazon.test.ts` | Search product | Name, price, rating <90s |
| 5.14 | **Integration: Workflow** | `tests/integration/workflow.test.ts` | 3-page flow | Data per step |
| 5.15 | **Integration: Recovery** | `tests/integration/recovery.test.ts` | Navigate 404 | Handles error |
| 5.16 | **Integration: Budget** | `tests/integration/budget.test.ts` | Low budget | Terminates cleanly |

**Exit Gate:** BBC <30s. Amazon <90s. Multi-page works. Error recovery works. Budget enforced. Session lifecycle owned by orchestrator.

### Phase 5b — Multi-Viewport + Popup Behavior (Week 8–10)

**Specs:** §07 §7.9.2 (popup behavior fields), §18 (`AuditRequest.viewports`). **Activates:** opt-in mobile audit + popup runtime probing + dark-pattern detection.

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 5b.1 | AuditRequest.viewports field (§18) | `gateway/AuditRequest.ts` | Schema accepts `["desktop"]` and `["desktop","mobile"]` | Zod validates; default `["desktop"]` |
| 5b.2 | ViewportConfigService | `orchestration/ViewportConfigService.ts` | Read viewports from AuditRequest | Returns ordered list of viewport configs |
| 5b.3 | MultiViewportOrchestrator | `orchestration/MultiViewportOrchestrator.ts` | Run perception per viewport | Both desktop+mobile perceptions stored separately; correlation_id matches |
| 5b.4 | ViewportDiffEngine | `analysis/ViewportDiffEngine.ts` | Compare desktop vs mobile perception | Identifies fold composition diff, CTA visibility diff, sticky element diff |
| 5b.5 | PopupBehaviorProbe | `browser/PopupBehaviorProbe.ts` | Watch popup trigger on test fixtures | Captures triggerType (load / time-on-page / scroll / exit-intent), timing in ms |
| 5b.6 | PopupDismissibilityTester | `browser/PopupDismissibilityTester.ts` | Test escape + click-outside on popups | Updates `popups[].isEscapeDismissible` and `isClickOutsideDismissible` |
| 5b.7 | DarkPatternDetector | `analysis/DarkPatternDetector.ts` | Detect deceptive close UI / forced action | Flags dark patterns with type tag |
| 5b.8 | Multi-viewport heuristics pack | `heuristics-repo/multi-viewport.json` | Load + Zod validate | 5 new heuristics for mobile-only / desktop-only issues |
| 5b.9 | HoverTrigger | `browser/triggers/HoverTrigger.ts` | Detect `:hover` rules + aria-haspopup; fire mouseenter + dwell | Reveals tooltips and dropdown previews; settles within 1s |
| 5b.10 | ScrollPositionTrigger | `browser/triggers/ScrollPositionTrigger.ts` | Detect IntersectionObserver patterns + sticky elements; scroll to Y | Captures sticky CTA changes, lazy-loaded content reveal |
| 5b.11 | TimeDelayTrigger | `browser/triggers/TimeDelayTrigger.ts` | Run page for N seconds, diff DOM | Captures time-delayed banners and announcements |
| 5b.12 | ExitIntentTrigger | `browser/triggers/ExitIntentTrigger.ts` | Search scripts for `mouseleave` listeners; simulate mouse to (x, -1) | Triggers exit-intent popups; populates `popups[].triggerType: exit_intent` |
| 5b.13 | FormInputTrigger | `browser/triggers/FormInputTrigger.ts` | Type / select on `<select>` + variant pickers | Captures variant-driven price/availability changes |
| 5b.14 | TriggerCandidateDiscovery | `browser/triggers/TriggerCandidateDiscovery.ts` | Pull all interactive_nodes from ax_tree + add hover/scroll/time/exit candidates | Returns prioritized candidate list per spec §3.3 priority ordering |
| 5b.15 | CookieBannerDetector | `browser/CookieBannerDetector.ts` | Detect OneTrust / Cookiebot / TrustArc + generic fixed-position >20% fold w/ "cookie" text | Returns banner descriptor with selector + library |
| 5b.16 | CookieBannerPolicy | `browser/CookieBannerPolicy.ts` | Execute dismiss / preserve per AuditRequest.cookie_policy | Default = `dismiss`; `preserve` keeps banner for analysis; `block` rejected (consent breakage) |
| 5b.17 | AuditRequest.cookie_policy field | `gateway/AuditRequest.ts` (extend) | Schema accepts `dismiss \| preserve` | Validated by Zod; default `dismiss` |
| 5b.18 | **Integration: multi-viewport + trigger taxonomy + cookie policy** | `tests/integration/phase5b-full.test.ts` | Run 1 audit with `viewports:["desktop","mobile"]`, all 8 trigger types active, both cookie policies tested | Findings include mobile-only / desktop-only + dark patterns + hover-revealed microcopy + exit-intent popups + time-delayed banners; cost ≤2× single-viewport baseline |
| 5b.19 | **Integration: multi-viewport audit (legacy, kept for v2.4 parity)** | `tests/integration/multi-viewport.test.ts` | 1 audit with `viewports:["desktop","mobile"]` | Findings include mobile-only issues; desktop-only issues; cost ≤2× single viewport |

**Exit Gate:** Multi-viewport audit produces distinct desktop and mobile findings. Popup behavior fields (timing, dismissibility) populated. Dark-pattern detector flags ≥1 known dark pattern in fixture set. 5 new trigger types active (hover, scroll, time_delay, exit_intent, form_input). Cookie banner detected on 3 known libraries (OneTrust, Cookiebot, TrustArc) + generic. Both cookie policies (dismiss / preserve) work end-to-end. Total cost on 2-viewport audit ≤2× single-viewport baseline.

### Phase 6 — Heuristic Knowledge Base (Week 7–8)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 6.1 | HeuristicSchema | `analysis/heuristics/schema.ts` | Zod validation | Validates, rejects malformed |
| 6.2 | HeuristicLoader | `analysis/heuristics/HeuristicLoader.ts` | Load all | 60 loaded, all valid |
| 6.3 | PageTypeFilter | `analysis/heuristics/filter.ts` | filter("checkout","ecommerce") | 12-15 heuristics |
| 6.4 | BusinessTypeFilter | `analysis/heuristics/filter.ts` | filter("homepage","saas") | Excludes ecommerce-only |
| 6.5 | Baymard heuristics | `heuristics-repo/baymard.json` | Zod validation | ~25 heuristics |
| 6.6 | Nielsen heuristics | `heuristics-repo/nielsen.json` | Zod validation | ~25 heuristics |
| 6.7 | Cialdini heuristics | `heuristics-repo/cialdini.json` | Zod validation | ~10 heuristics |
| 6.8 | EncryptionWrapper (deferred to v1.1) | `analysis/heuristics/encryption.ts` | Encrypt/decrypt round-trip | Content matches |
| 6.9 | TierValidator | `analysis/heuristics/tierValidator.ts` | Check all | No missing tier |

**Exit Gate:** 60 heuristics loaded + validated. Filtering returns 15-25 per combo. Tiers correctly assigned.

### Phase 7 — Analysis Pipeline (Static) (Week 8–10)

**§33a Interface Prep:** EvaluateStrategy interface (REQ-COMP-PHASE7-001), StaticEvaluateStrategy implementation, §33 state fields with defaults (REQ-COMP-PHASE7-003), analysis subgraph accepts optional BrowserSession (REQ-COMP-PHASE7-002).

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 7.1 | AnalysisState (with §33 fields) | `analysis/AnalysisState.ts` | Compile | All fields, §33 defaults applied |
| 7.2 | DeepPerceiveNode | `analysis/nodes/DeepPerceiveNode.ts` | Scan product page | AnalyzePerception + screenshots |
| 7.3 | **EvaluateStrategy interface** (§33a) | `analysis/strategies/EvaluateStrategy.ts` | Interface compiles | Accepts session: `BrowserSession \| null` |
| 7.4 | **StaticEvaluateStrategy** (§33a) | `analysis/strategies/StaticEvaluateStrategy.ts` | Single-shot eval | Identical to legacy single-shot |
| 7.5 | **InteractiveEvaluateStrategy stub** (§33a) | `analysis/strategies/InteractiveEvaluateStrategy.ts` | Throws "Not implemented" | Stub for Phase 14 |
| 7.6 | EvaluateNode wrapper | `analysis/nodes/EvaluateNode.ts` | Strategy selection | Routes to static (Phase 7) |
| 7.7 | SelfCritiqueNode | `analysis/nodes/SelfCritiqueNode.ts` | Critique 5 findings | ≥1 rejected/downgraded |
| 7.8 | EvidenceGrounder | `analysis/nodes/EvidenceGrounder.ts` | Ground 5 findings | ≥1 hallucination rejected |
| 7.9 | 8 Grounding Rules (GR-001 through GR-008) | `analysis/grounding/rules/*.ts` | Unit test each | Accept/reject correctly |
| 7.10 | AnnotateNode | `analysis/nodes/AnnotateNode.ts` | 3 pins on screenshot | Visible, correct colors |
| 7.11 | StoreNode | `analysis/nodes/StoreNode.ts` | Store findings | DB records + R2 files |
| 7.12 | AnalysisGraph | `analysis/AnalysisGraph.ts` | Compile subgraph | All edges, accepts optional session |
| 7.13 | DetectPageType | `analysis/utils/detectPageType.ts` | Product page | Returns "product" |
| 7.14 | AssignConfidenceTier | `analysis/utils/assignTier.ts` | Tier 1 + measurement | Returns "high" |
| 7.15 | CostTracker | `analysis/CostTracker.ts` | 3 LLM calls | Total accurate |
| 7.16 | **Integration** | `tests/integration/analysis.test.ts` | Full pipeline on amazon product | 3+ grounded findings |

**Exit Gate:** Pipeline end-to-end on 3 page types. EvaluateStrategy pattern wired. Self-critique rejects ≥1. Grounding rejects ≥1. Annotations render. DB + R2 storage works.

### Phase 8 — Audit Orchestrator + Single-Site Audit (Week 10–11)

**§33a Interface Prep:** Orchestrator passes session from browse to analyze (REQ-COMP-PHASE8-001), `restore_state` no-op node added to graph (REQ-COMP-PHASE8-002).

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 8.1 | AuditState | `orchestration/AuditState.ts` | Compile | Extends BrowseState + AnalysisState |
| 8.2 | AuditSetupNode (creates session) | `orchestration/nodes/AuditSetupNode.ts` | Setup audit | Client loaded, queue built, session created |
| 8.3 | PageRouterNode | `orchestration/nodes/PageRouterNode.ts` | Route pages | Correct next/complete |
| 8.4 | AuditCompleteNode | `orchestration/nodes/AuditCompleteNode.ts` | Complete audit | Status updated, summary, session closed |
| 8.5 | **RestoreStateNode** (§33a no-op) | `orchestration/nodes/RestoreStateNode.ts` | Static mode pass-through | No-op when interactions=0 |
| 8.6 | AuditGraph (with restore_state) | `orchestration/AuditGraph.ts` | Compile with subgraphs | Browse + analyze + restore_state nested |
| 8.7 | Routing functions (session-passing) | `orchestration/auditEdges.ts` | All routes | Correct behavior, session flows browse→analyze |
| 8.8 | PostgresCheckpointer | `orchestration/PostgresCheckpointer.ts` | Kill + resume | State recovered |
| 8.9 | **Integration** | `tests/integration/audit.test.ts` | 3-page site audit | Findings for each page |

**Exit Gate (◆ MVP MILESTONE ◆):** Full audit on 3-page site. Browse ↔ analyze switching with shared session. Checkpoint recovery works. Single-tenant CLI invocation works end-to-end.

---

## 16.4 Track B — Product Detail (Phases 9–12)

### Phase 9 — Competitor + Versioning (Week 11–13)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 9.1 | CompetitorDetector | `analysis/CompetitorDetector.ts` | Detect from page | Sector + competitors |
| 9.2 | ComparisonNode | `analysis/nodes/ComparisonNode.ts` | Compare 2 homepages | Pairwise findings |
| 9.3 | ComparisonGrounding | `analysis/ComparisonGrounding.ts` | Ground comparison | Both datasets verified |
| 9.4 | ConsistencyChecker | `analysis/ConsistencyChecker.ts` | Check 3 pages | Inconsistencies found |
| 9.5 | VersionDiffEngine | `analysis/VersionDiffEngine.ts` | Compare v1 vs v2 | Resolved/persisted/new |
| 9.6 | **Integration** | `tests/integration/competitor.test.ts` | Client + 1 competitor | Comparison findings stored |

**Exit Gate:** Competitor comparison works. Version diff works. Cross-page consistency works.

### Phase 10 — Client Management + Review Gate (Week 13–14)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 10.1 | Clerk integration | `auth/ClerkProvider.ts` | Login flow | JWT + roles working |
| 10.2 | Client CRUD | `api/routes/clients.ts` | Create + read client | DB record created |
| 10.3 | API key scoping | `auth/ApiKeyScope.ts` | Key → client_id | Isolation enforced |
| 10.4 | RLS enforcement | `db/rls.sql` | Query cross-client | Blocked by RLS |
| 10.5 | ReviewGateWorker | `workers/ReviewGateWorker.ts` | 24hr delayed finding | Auto-publishes |
| 10.6 | FindingReview API | `api/routes/findings.ts` | Approve/reject | Status updated |
| 10.7 | FindingLifecycleStateMachine (§12) | `review/FindingLifecycle.ts` | All transitions | pending→approved/rejected/published |

**Exit Gate:** Auth works. Client isolation enforced. Review gate publishes/holds correctly.

### Phase 11 — Delivery Layer + Report Generation (Week 14–16)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 11.1 | CRO Audit MCP Server | `mcp/CROAuditMCPServer.ts` | Query findings | Returns filtered results |
| 11.2 | Client Dashboard | `apps/dashboard/` | View findings | Renders with annotations |
| 11.3 | Consultant Dashboard | `apps/dashboard/console/` | Review gate UI | Approve/reject works |
| 11.4 | SSE integration | `api/routes/stream.ts` | Audit progress | Real-time updates |
| 11.5 | Version comparison view | `apps/dashboard/compare/` | v1 vs v2 | Diff displayed |
| 11.6 | Competitor view | `apps/dashboard/competitors/` | Pairwise display | Comparison visible |
| 11.7 | **ExecutiveSummaryGenerator** (§35) | `delivery/ExecutiveSummaryGenerator.ts` | Generate from findings | LLM-composed 3-paragraph summary |
| 11.8 | **ActionPlanGenerator** (§35) | `delivery/ActionPlanGenerator.ts` | Generate prioritized plan | Effort/impact/scoring |
| 11.9 | **ReportGenerator** (§35) | `delivery/ReportGenerator.ts` | Generate PDF | Playwright `page.pdf()` output, R2 stored |

**Exit Gate:** MCP server returns findings. Dashboard renders. Console review works. SSE streaming. PDF reports generate end-to-end.

### Phase 12 — Production Phase 1 (Week 16–18)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 12.1 | Docker Compose | `docker-compose.yml` | All services up | Postgres, Redis, API, workers |
| 12.2 | Fly.io deployment | `fly.toml` | Deploy | API accessible |
| 12.3 | Vercel deployment | `apps/dashboard/vercel.json` | Deploy | Dashboard accessible |
| 12.4 | BullMQ scheduler | `workers/AuditScheduler.ts` | Schedule audit | Runs at configured time |
| 12.5 | Concurrent workers | `workers/AuditWorker.ts` | 4 concurrent | All complete |
| 12.6 | Pino logger (basic, §34) | `observability/logger.ts` | Structured log | JSON, correlation fields |
| 12.7 | Sentry integration | `observability/sentry.ts` | Trigger error | Alert received |
| 12.8 | Bull Board | `apps/api/bull-board.ts` | View queue | Jobs visible |
| 12.9 | Health checks | `api/routes/health.ts` | Check all services | All healthy |

**Exit Gate (◆ PRODUCT MILESTONE ◆):** All services running in Docker. Concurrent audits work. Basic monitoring active. Scheduled audits fire. **Single-channel multi-tenant SaaS in production.**

---

## 16.5 Track C — Master Detail (Phases 13–16)

> **Reading note:** Phases 13–16 implement §18–§30, §33, §33a, §34, §35, §36 master extensions. Artifact tables below list the major components per spec; refer to each spec's REQ-IDs for implementation contracts.

### Phase 13 — Trigger Gateway + Discovery + Workflows + State Graph + State Reset / Storage / Nondeterminism (Week 26–30)

**Specs:** §18, §19, §20, §21, §23

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 13.1 | TriggerGateway service (§18) | `gateway/TriggerGateway.ts` | CLI + MCP + dashboard call | All converge to `AuditRequest` |
| 13.2 | AuditRequest Zod schema (§18) | `gateway/AuditRequest.ts` | Validate per channel | Channel-specific shapes normalize |
| 13.3 | RateLimiter + PermissionCheck (§18) | `gateway/PermissionCheck.ts` | Over-limit + cross-client | Blocked correctly |
| 13.4 | DiscoveryService (§19) | `gateway/DiscoveryService.ts` | 500-page site | ≤20 templates, HDBSCAN clustering |
| 13.5 | TemplateClassifier (§19) | `gateway/TemplateClassifier.ts` | Category vs PDP vs checkout | ≥70% rule classification |
| 13.6 | WorkflowSynthesizer (§19) | `gateway/WorkflowSynthesizer.ts` | E-comm site | Identifies cart→checkout funnel |
| 13.7 | StateExploration `explore_states` node (§20) | `browse/nodes/ExploreStatesNode.ts` | PDP with tabs/accordions | MultiStatePerception built |
| 13.8 | DisclosureRuleLibrary (§20) | `browse/disclosure/*.ts` | Tab/accordion/filter rules | Per-rule unit tests |
| 13.9 | MeaningfulStateDetector (§20) | `browse/MeaningfulStateDetector.ts` | 50 raw states | >30% discarded |
| 13.10 | GR-009 grounding rule (§20) | `analysis/grounding/rules/GR009.ts` | Provenance check | Catches ≥1 violation |
| 13.11 | WorkflowOrchestrator subgraph (§21) | `orchestration/WorkflowGraph.ts` | Cart→checkout funnel | Step-by-step traversal |
| 13.12 | WorkflowAnalyzeNode (§21) | `analysis/nodes/WorkflowAnalyzeNode.ts` | Cross-step synthesis | Funnel-scoped findings |
| 13.13 | GR-010 grounding rule (§21) | `analysis/grounding/rules/GR010.ts` | Workflow data integrity | Catches step mismatch |
| 13.14 | ExtendedFindingsEngine (§23) | `analysis/ExtendedFindingsEngine.ts` | Workflow + cross-page rollups | 4-dim scoring, dedup |
| 13.15 | StateGraph formal edges (deferred from Phase 5c) | `browse/StateGraphBuilder.ts` | Build edges with `trigger`, `delta_type`, `delta_summary` | Edges populated for every state transition |
| 13.16 | StateDiffClassifier (deferred from Phase 5c) | `browse/StateDiffClassifier.ts` | Classify DOM diffs into 5 categories | Returns `content_added \| content_revealed \| content_replaced \| cosmetic \| navigation` |
| 13.17 | Cosmetic-only filter | `browse/CosmeticDiffFilter.ts` | Skip recording cosmetic-only state transitions | Verified on 5 fixtures with style-only mutations |
| 13.18 | ExplorationPriorityQueue | `browse/ExplorationPriorityQueue.ts` | Order candidates per spec §3.3 priority (variant > tabs > accordions > modals > cart > sticky > hover > carousels) | Returns ordered candidate list |
| 13.19 | DepthAndBudgetGuard | `browse/DepthAndBudgetGuard.ts` | Enforce BFS depth ≤ 2 + max 50 states/page | Emits `BUDGET_EXHAUSTED_AT_DEPTH_2` warning |
| 13.20 | **Integration: discovery + workflow** | `tests/integration/discovery-workflow.test.ts` | E-comm 50-page site | Templates + funnel + workflow findings + state graph with classified deltas |
| 13.21 | HybridStateResetClassifier | `browse/HybridStateResetClassifier.ts` | Classify 8 trigger types | Returns `reverse_action` for modal/accordion/tab/hover/focus; `reload_replay` for input_change/scroll/time_delay/exit_intent/form_submit |
| 13.22 | ReverseActionExecutor | `browse/ReverseActionExecutor.ts` | Close modal / collapse accordion / click default tab | Reverts within 1.5s timeout; falls through to reload+replay on failure |
| 13.23 | StorageSnapshotAndRestore | `browse/StorageSnapshotAndRestore.ts` | Snapshot at State 0; restore between branches | Cookies + localStorage + sessionStorage round-trip; exit-intent re-fires after restore |
| 13.24 | NondeterministicStateDetector | `browse/NondeterministicStateDetector.ts` | Replay-sample first 3 non-default states; compare hashes | Mismatch → emit `NONDETERMINISTIC_STATE` warning with suspected_cause classification |
| 13.25 | **Integration: state reset + storage restore + nondeterminism** | `tests/integration/state-reset-restore.test.ts` | Depth-2 audit on 5 fixtures (incl. exit-intent + variant + accordion + modal + scroll) | Reverse-action used for ≥50% of resets; storage restore enables exit-intent re-fire; nondeterministic state detected on Optimizely fixture |

**Exit Gate:** Multi-channel triggers normalized. Discovery produces ≤20 templates. State exploration discards ≥30%. Full funnel traversal produces workflow-scoped findings. **State graph emits formal edges with `delta_type` classification.** Cosmetic-only transitions filtered. Priority queue ordering verified. **Hybrid state reset (reverse-action + reload+replay) reduces total reset budget by ~50% vs reload-only baseline.** Storage restoration verified — exit-intent and promo states reachable repeatedly across branches. Nondeterministic states surfaced via replay-sample, not silently absorbed.

### Phase 13b — Context Capture Phase 2 (Week 29–30)

**Spec:** §37 §37.8 (Phase 13b items). **Adopts:** items 7-12 from `context_capture_layer_spec.md` coverage analysis. **Activates:** richer audience inference + message-match + geo/locale + repro pinning + dashboard intake.

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 13b.1 | AwarenessLevelInferrer (Schwartz model) | `packages/agent-core/src/context/AwarenessLevelInferrer.ts` | Infer on cold-paid / branded-direct / organic-search fixtures | Returns unaware/problem_aware/solution_aware/product_aware/most_aware with confidence; flagged low confidence by default |
| 13b.2 | MessageMatchCapture | `packages/agent-core/src/context/MessageMatchCapture.ts` | Capture per-traffic-source `creative_or_message` | All 8 traffic channels accept message-match string; preserves on AuditRequest update |
| 13b.3 | IsIndexedDetector | `packages/agent-core/src/context/IsIndexedDetector.ts` | Detect from canonical + breadcrumb + UTM | Returns `is_indexed: true` for SEO pages; `false` for paid landing |
| 13b.4 | DecisionStyleInferrer | `packages/agent-core/src/context/DecisionStyleInferrer.ts` | Infer impulse / researched / committee / habitual on 5 fixtures | Returns enum with confidence; defaults to `researched` when uncertain |
| 13b.5 | GeoLocaleCapture (regulatory binding) | `packages/agent-core/src/context/GeoLocaleCapture.ts` | Capture geo from headers + currency + hreflang | `geo_primary` + `locale_primary`; auto-suggests regulatory: EU→GDPR, CA→CCPA, BR→LGPD |
| 13b.6 | ContextProfile in ReproducibilitySnapshot (§25) | `packages/agent-core/src/reproducibility/SnapshotBuilder.ts` (extend) | Pin context_profile_hash | Same URL + intake + signals → same hash; drift surfaces explanation |
| 13b.7 | Per-traffic-source awareness segmentation | `packages/agent-core/src/context/TrafficSegmentedAwareness.ts` | Capture awareness per source | Same page audited with multiple sources gets per-source ContextProfile variants |
| 13b.8 | DashboardIntakeForm (Next.js + shadcn/ui) | `apps/dashboard/intake/` | Render form + submit | Replaces CLI prompt; same Zod schema; supports clarification round-trip |
| 13b.9 | Phase 13b integration test | `tests/integration/context-capture-phase2.test.ts` | Audit with full intake + repro re-run | All 6 master items active; ContextProfile hash stable across runs; finding-set delta <5% |

**Exit Gate:** Awareness levels inferred (with low-confidence flag). Message-match captured per traffic source. SEO vs paid landing distinguished. Decision style inferred. Geo + locale binding to regulatory constraints. ContextProfile pinned in ReproducibilitySnapshot. Dashboard intake form replaces CLI prompt for non-CLI audits.

### Phase 14 — Agent Composition + Interactive Evaluate (Week 21–23)

**Specs:** §33, §33a — **Retrofits Phase 7's static analyze pipeline.**

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 14.1 | InteractiveEvaluateStrategy (§33.7b) | `analysis/strategies/InteractiveEvaluateStrategy.ts` | ReAct loop on PDP | Calls hover/click, re-perceives |
| 14.2 | analyze_interactive tool set (§33.4) | `mcp/ToolRegistry.ts` (extension) | Returns 9 browser + 6 analysis tools | Tool injection works |
| 14.3 | Analyze-mode safety rules (§33.5) | `safety/AnalyzeModeRules.ts` | Enter-key reclass + nav guards | REQ-COMP-011a + REQ-COMP-012 |
| 14.4 | HeuristicInteractionTracker (§33.7c) | `analysis/HeuristicInteractionTracker.ts` | Per-heuristic budget | Cap enforced |
| 14.5 | Pass 2 open observation (§33.10) | `analysis/Pass2OpenObservation.ts` | Surfaces uncertain findings | Relaxed grounding via GR-013 |
| 14.6 | GR-011 (per-state finding correctness) | `analysis/grounding/rules/GR011.ts` | State data correctness | Catches state-finding mismatch |
| 14.7 | workflowStepRestore (§33.11) | `orchestration/nodes/WorkflowStepRestoreNode.ts` | After analyze in workflow | Step reentry verified |
| 14.8 | SessionContaminationTracker (§33.12) | `safety/SessionContaminationTracker.ts` | Transition action detected | Logs contamination event |
| 14.9 | ContextWindowManager (§33.7c) | `analysis/ContextWindowManager.ts` | Long ReAct loop | Message pruning, state-delta compression |
| 14.10 | composition_mode default flip | `config/composition.ts` | Default behavior | `composition_mode: "interactive"` |
| 14.11 | **Integration** | `tests/integration/composition.test.ts` | 3 sites, dual-mode | Static + interactive both work |
| 14.12 | **Acceptance** | `tests/acceptance/dual-mode-quality.test.ts` | Quality benchmark | Interactive finds ≥30% more grounded findings vs static |

**Exit Gate:** Interactive evaluate live. Tool injection works. Dual-mode evaluation produces measurably better findings. RestoreStateNode no longer no-op for interactive mode.

### Phase 15 — Durable Orchestration + Reproducibility + Two-Store + Cost (Week 23–25)

**Specs:** §24, §25, §26, §27

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 15.1 | TemporalWorkflow (§27) | `orchestration/temporal/AuditWorkflow.ts` | Long-running audit | Resume after worker restart |
| 15.2 | TemporalActivity wrappers (§27) | `orchestration/temporal/activities/*.ts` | Per-node activity | Retry policies wired |
| 15.3 | TemporalSchedules (§27) | `orchestration/temporal/Schedules.ts` | Cron-style schedule | Fires on time |
| 15.4 | KillSwitch (§27) | `orchestration/temporal/KillSwitch.ts` | Cancel mid-audit | Workflow halts cleanly |
| 15.5 | ReproducibilitySnapshotBuilder (§25) | `reproducibility/SnapshotBuilder.ts` | Per audit | Pins model, prompts, heuristics, snapshot immutable |
| 15.6 | TemperatureGuard (§25) | `reproducibility/TemperatureGuard.ts` | LLM call check | Temperature=0 enforced for evaluate/critique/ground |
| 15.7 | TwoStorePattern: working store (§24) | `storage/WorkingStore.ts` | Live finding writes | Mutable, consultant-only |
| 15.8 | TwoStorePattern: publish store (§24) | `storage/PublishStore.ts` | Approved findings | Immutable, client-readable |
| 15.9 | AccessModeMiddleware (§24) | `storage/AccessModeMiddleware.ts` | Client query | Routes to publish store |
| 15.10 | LayeredCostGates (§26) | `cost/LayeredCostGates.ts` | Pre-call estimate | Hard cap blocks over-budget calls |
| 15.11 | PerClientCostAttribution (§26) | `cost/PerClientCostAttribution.ts` | SQL query | `llm_call_log` aggregated by client_id |
| 15.12 | GlobalRateLimiter (§26) | `cost/GlobalRateLimiter.ts` | 20 concurrent | Throttles correctly |
| 15.13 | **Integration** | `tests/integration/durable-cost.test.ts` | 20 concurrent audits | All resume after kill, costs attributed |

**Exit Gate:** Temporal Tier 1 live. 20 concurrent audits run, kill-switch works. Two-store separation enforced. Hard cost caps respected. Reproducibility snapshots immutable.

### Phase 16 — Learning + Heuristic Evolution + Hypothesis + Analytics + Observability + Golden Tests (Week 25–28)

**Specs:** §22, §28, §29, §30, §34, §36

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 16.1 | LearningService calibration job (§28) | `learning/CalibrationJob.ts` | Post-audit run | Heuristic reliabilities adjusted |
| 16.2 | WarmupGraduationManager (§28) | `learning/WarmupGraduationManager.ts` | Threshold reached | Warm-up auto-graduates |
| 16.3 | HeuristicVectorIndex (§22) | `analysis/heuristics/VectorIndex.ts` | pgvector loaded | 5k+ heuristics indexed |
| 16.4 | EmbeddingPipeline (§22) | `analysis/heuristics/EmbeddingPipeline.ts` | Embed new heuristic | Vector written to pgvector |
| 16.5 | DynamicHeuristicRetrieval (§22) | `analysis/heuristics/DynamicRetrieval.ts` | Query by perception | Vector rerank > categorical |
| 16.6 | LearnedHeuristicCrystallisation (§22) | `analysis/heuristics/LearnedHeuristicCrystallisation.ts` | Per-client patterns | Client-specific heuristics created |
| 16.7 | HypothesisGenerator (§29) | `hypothesis/HypothesisGenerator.ts` | From findings | Hypothesis structures |
| 16.8 | TestPlanGenerator (§29) | `hypothesis/TestPlanGenerator.ts` | A/B variations | Variation ideas + sample size |
| 16.9 | ABToolExporter (§29) | `hypothesis/ABToolExporter.ts` | VWO export | Format compatible |
| 16.10 | GA4Adapter (§30) | `analytics/GA4Adapter.ts` | OAuth + ingest | Property data flowing |
| 16.11 | MixpanelAdapter (§30) | `analytics/MixpanelAdapter.ts` | API + ingest | Event data flowing |
| 16.12 | AnalyticsBindingScorer (§30) | `analytics/AnalyticsBindingScorer.ts` | Finding + analytics | Behavioral signals applied |
| 16.13 | LangSmithIntegration (§34) | `observability/LangSmithIntegration.ts` | Trace audit | Full trace visible, IP excluded |
| 16.14 | EventEmitter (§34) | `observability/EventEmitter.ts` | All event types | Audit lifecycle events emitted |
| 16.15 | CorrelationFields (§34) | `observability/CorrelationFields.ts` | Pino fields | audit_run_id, page_url, node_name on every log |
| 16.16 | GoldenFixtureSuite (§36) | `tests/golden/fixtures/*.json` | Snapshot compare | Stable findings on golden inputs |
| 16.17 | RegressionDetector (§36) | `tests/golden/RegressionDetector.ts` | Run vs baseline | Diffs flagged |
| 16.18 | AcceptanceTestHarness (§36) | `tests/acceptance/AcceptanceHarness.ts` | E2E runner | Per-phase exit gate runner |
| 16.19 | **Integration** | `tests/integration/master.test.ts` | Full master audit | All extensions live, end-to-end pass |

**Exit Gate (◆ MASTER MILESTONE ◆):** Vector retrieval scales to 5k+ heuristics. Calibration runs after each audit. Hypotheses + A/B tool export work. Analytics binding influences scoring. LangSmith traces complete with IP excluded. Golden tests stable. **Full master architecture in production.**

---

## 16.6 §33a Interface Prep — Cross-Reference Summary

§33a requires interface preparation across MVP phases so Phase 14 (composition activation) is a feature flip, not a rewrite. Summary:

| Phase | Interface Prep | Cost | Risk if Skipped |
|-------|---------------|------|-----------------|
| **Phase 2** | ToolRegistry + 3 output tool schemas | ~0.5 day | Phase 14 tool-list rewrite |
| **Phase 4** | SafetyContext + BrowserSessionManager | ~1 day | Phase 14 classifier rewrite |
| **Phase 5** | External session injection | ~0.5 day | Phase 14 session-ownership rewrite |
| **Phase 7** | EvaluateStrategy + StaticEvaluateStrategy + state fields | ~1 day | Phase 14 evaluate-node rewrite |
| **Phase 8** | Session passing + restore_state no-op | ~0.5 day | Phase 14 orchestrator rewrite |
| **Total** | All interfaces in MVP | **~3.5 days** | **~3 weeks of Phase 14 refactoring** |

See [33a-composition-integration.md](33a-composition-integration.md) for detailed contracts.

---

## 16.7 Total Artifact Count

| Track | Phase Range | Artifacts | Cumulative |
|-------|-------------|-----------|-----------|
| **A — MVP** | 1, 1b, 1c, 2–4, 4b, 5, 5b, 6–8 | 177 (119 baseline + 12 from 1b + 12 from 1c + 15 from 4b + 19 from extended 5b) | 177 |
| **B — Product** | 9–12 | 30 | 207 |
| **C — Master** | 13, 13b, 14–16 | 84 (65 baseline + 5 from Phase 5c absorbed into 13 + 5 from v3.1 state reset / storage / nondeterminism + 9 from 13b) | **291** |

**~291 artifacts total across 20 phase-blocks (16 main + 4 sub-phases), ~38 weeks.**

---

## 16.8 Migration Note (v2.4)

This document was rewritten in v2.4 (2026-04-28) to reconcile three previously-conflicting phase numbering schemes:

1. **§16.1-§16.4 (old)** — 12-phase plan covering MVP + productization only
2. **§16.5 (old)** — 16-phase "master phase map" that *replaced* §16.1 phases 6-12
3. **§33a per-phase (old)** — used Phase 7 = Analysis, Phase 11 = Composition; mismatched both above

The unified 16-phase / 3-track scheme above is now the sole canonical source. Per Constitution R22 (The Ratchet), this consolidation is locked. Future phase additions append to Track C (i.e., Phase 17+) — they do NOT renumber existing phases.

---

## 16.9 Risk Register Reference

**REQ-IMPL-RISK-001:** The 7-item Risk Register from `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` §18.7 (R-1 through R-7) SHALL be tracked at every phase gate review:

| # | Risk | Mitigation Phase |
|---|------|-----------------|
| R-1 | LangGraph.js fewer examples than Python | Phase 5 (browse graph) |
| R-2 | Amazon anti-bot blocks during testing | Phase 1 (stealth) + Phase 5 (integration) |
| R-3 | AX-tree inconsistency across sites | Phase 1 (perception) |
| R-4 | ghost-cursor / playwright-extra compatibility | Phase 2 (human behavior) |
| R-5 | Confidence formula accuracy | Phase 3 (verification) |
| R-6 | MCP protocol overhead | Phase 2 (MCP server) |
| R-7 | Scope creep into SEO / A11y | All phases (gate review) |

---

**End of §16 v2.4 — Implementation Phases**
