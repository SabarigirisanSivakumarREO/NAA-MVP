# Section 16 — Implementation Phases (12 Phases)

## 16.1 Phase Overview

| Phase | Name | Weeks | Entry Gate | Exit Gate | Milestone |
|-------|------|-------|-----------|-----------|-----------|
| **1** | Perception Foundation | 1-2 | Project start | PageStateModel on 3+ sites | Agent can see |
| **2** | MCP Tools + Human Behavior | 2-4 | Phase 1 ✅ | All 28 tools MCP-compliant | Agent can act + scan |
| **3** | Verification & Confidence | 4-5 | Phase 2 ✅ | 9 strategies + confidence scoring | Agent verifies |
| **4** | Safety & Infrastructure | 5-6 | Phase 3 ✅ | Safety, Postgres, LLM adapter, streaming | Foundation solid |
| **5** | Browse Mode MVP | 6-7 | Phase 4 ✅ | 5-node browse graph end-to-end | **Browse works** |
| **6** | Heuristic Knowledge Base | 7-8 | Phase 5 ✅ | 100 heuristics, filtering, tiers | Knowledge ready |
| **7** | Analysis Pipeline | 8-10 | Phase 6 ✅ | 5-step pipeline end-to-end | **Analysis works** |
| **8** | Audit Orchestrator | 10-11 | Phase 7 ✅ | Dual-mode graph, page queue | **Single-site audit** |
| **9** | Competitor + Versioning | 11-13 | Phase 8 ✅ | Pairwise comparison, version diff | **Full audit** |
| **10** | Client Management | 13-14 | Phase 9 ✅ | Clerk auth, review gate, RLS | **Multi-tenant** |
| **11** | Delivery Layer | 14-16 | Phase 10 ✅ | MCP server, dashboards | **Usable product** |
| **12** | Production | 16-18 | Phase 11 ✅ | Job scheduler, Docker, monitoring | **Production-ready** |

## 16.2 Dependency Graph

```
Phase 1 (Perception)
    │
    └──→ Phase 2 (Tools + Human Behavior)
              │
              └──→ Phase 3 (Verification + Confidence)
                        │
                        └──→ Phase 4 (Safety + Infrastructure)
                                  │
                                  └──→ Phase 5 (Browse Mode MVP) ← BROWSE WORKS
                                            │
                                            └──→ Phase 6 (Heuristic KB)
                                                      │
                                                      └──→ Phase 7 (Analysis Pipeline)
                                                                │
                                                                └──→ Phase 8 (Orchestrator) ← MVP AUDIT
                                                                          │
                                                                          └──→ Phase 9 (Competitor + Version)
                                                                                    │
                                                                                    └──→ Phase 10 (Client Mgmt)
                                                                                              │
                                                                                              └──→ Phase 11 (Delivery)
                                                                                                        │
                                                                                                        └──→ Phase 12 (Production)
```

## 16.3 Phase Artifact Details

### Phase 1 — Perception Foundation (Week 1-2)

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

---

### Phase 2 — MCP Tools + Human Behavior (Week 2-4)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 2.1 | MouseBehavior | `human-behavior/MouseBehavior.ts` | Move (0,0)→(500,300) | Bezier curve, ~500ms |
| 2.2 | TypingBehavior | `human-behavior/TypingBehavior.ts` | Type "hello world" | 3-6s, 1-2% typos |
| 2.3 | ScrollBehavior | `human-behavior/ScrollBehavior.ts` | Scroll 3x | Variable momentum |
| 2.4 | MCP Server | `mcp/MCPServer.ts` | List tools | 28 tools with Zod schemas |
| 2.5-2.27 | 23 Browse Tools | `mcp/tools/*.ts` | Individual tool tests | Each tool works in isolation |
| 2.28 | page_analyze | `mcp/tools/pageAnalyze.ts` | Analyze bbc.com | Full AnalyzePerception returned |
| 2.29 | page_get_element_info | `mcp/tools/pageGetElementInfo.ts` | Get CTA info | BoundingBox, isAboveFold, styles |
| 2.30 | page_get_performance | `mcp/tools/pageGetPerformance.ts` | Get metrics | DOMContentLoaded, fullyLoaded |
| 2.31 | page_screenshot_full | `mcp/tools/pageScreenshotFull.ts` | Full page | Image <2MB, full scroll |
| 2.32 | page_annotate_screenshot | `mcp/tools/pageAnnotateScreenshot.ts` | 5 pins | Pins rendered, colors correct |
| 2.33 | JS Sandbox | `mcp/JSSandbox.ts` | Access cookies | Blocked |
| 2.34 | Rate Limiter | `rate-limit/RateLimiter.ts` | 5 actions in 1s | Only first, rest queued |

**Exit Gate:** All 28 tools callable via MCP. Stealth + ghost-cursor working. Sandbox blocks cookies. Rate limiter enforces 2s.

---

### Phase 3 — Verification & Confidence (Week 4-5)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 3.1 | ActionContract | `verification/ActionContract.ts` | Create contract | Has expected_outcome + verify_strategy |
| 3.2-3.10 | 9 Verify Strategies | `verification/strategies/*.ts` | Individual tests | Each strategy works |
| 3.11 | VerifyNode | `verification/VerifyNode.ts` | Action + verify | Mutation-aware, checks strategy |
| 3.12 | FailureClassifier | `verification/FailureClassifier.ts` | 7 types | Correct routing |
| 3.13-3.15 | ConfidenceScorer | `confidence/ConfidenceScorer.ts` | 50 steps | Stays (0,1), thresholds work |

**Exit Gate:** 9 strategies work. Mutation-aware. Confidence bounded. Failure taxonomy routes correctly.

---

### Phase 4 — Safety & Infrastructure (Week 5-6)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 4.1 | ActionClassifier | `safety/ActionClassifier.ts` | Classify 28 tools | Correct class per tool |
| 4.2 | SafetyCheck | `safety/SafetyCheck.ts` | Download action | Blocks sensitive |
| 4.3 | DomainPolicy | `safety/DomainPolicy.ts` | Banking domain | Blocked |
| 4.4 | CircuitBreaker | `safety/CircuitBreaker.ts` | 3 failures | Domain blocked 1hr |
| 4.5 | AuditLogger | `safety/AuditLogger.ts` | Log action | Row in audit_log |
| 4.6 | PostgreSQL Schema | `db/schema.sql` | Run migrations | All tables created |
| 4.7 | Drizzle Schema | `db/schema.ts` | TypeScript compiles | All tables defined |
| 4.8 | SessionRecorder | `db/SessionRecorder.ts` | Record session | Session retrievable |
| 4.9 | AnthropicAdapter | `adapters/AnthropicAdapter.ts` | Send prompt | Tool calls returned |
| 4.10 | OpenAIAdapter | `adapters/OpenAIAdapter.ts` | Same prompt | Same format |
| 4.11 | AdapterFactory | `adapters/LLMAdapterFactory.ts` | Swap config | No code change |
| 4.12 | StreamEmitter | `streaming/StreamEmitter.ts` | Emit event | Event received |

**Exit Gate:** Safety classification correct. Postgres deployed. LLM adapter works. Streaming events flowing.

---

### Phase 5 — Browse Mode MVP (Week 6-7)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 5.1 | AgentState | `orchestration/AgentState.ts` | Compile, serialize | All fields, invariants |
| 5.2 | StateValidators | `orchestration/StateValidators.ts` | Violate invariants | Errors thrown |
| 5.3-5.7 | 5 Graph Nodes | `orchestration/nodes/*.ts` | Individual tests | Each node works |
| 5.8 | BrowseGraph | `orchestration/BrowseGraph.ts` | Compile graph | All edges connected |
| 5.9-5.10 | Routing Functions | `orchestration/edges.ts` | Route tests | Correct routing |
| 5.11 | SystemPrompt | `orchestration/SystemPrompt.ts` | Render | Tools + constraints |
| 5.12 | **Integration: BBC** | `tests/integration/bbc.test.ts` | Extract headlines | 3 headlines <30s |
| 5.13 | **Integration: Amazon** | `tests/integration/amazon.test.ts` | Search product | Name, price, rating <90s |
| 5.14 | **Integration: Workflow** | `tests/integration/workflow.test.ts` | 3-page flow | Data per step |
| 5.15 | **Integration: Recovery** | `tests/integration/recovery.test.ts` | Navigate 404 | Handles error |
| 5.16 | **Integration: Budget** | `tests/integration/budget.test.ts` | Low budget | Terminates cleanly |

**Exit Gate:** BBC <30s. Amazon <90s. Multi-page works. Error recovery works. Budget enforced.

---

### Phase 6 — Heuristic Knowledge Base (Week 7-8)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 6.1 | HeuristicSchema | `analysis/heuristics/schema.ts` | Zod validation | Validates, rejects malformed |
| 6.2 | HeuristicLoader | `analysis/heuristics/HeuristicLoader.ts` | Load all | 60 loaded, all valid |
| 6.3 | PageTypeFilter | `analysis/heuristics/filter.ts` | filter("checkout","ecommerce") | 12-15 heuristics |
| 6.4 | BusinessTypeFilter | `analysis/heuristics/filter.ts` | filter("homepage","saas") | Excludes ecommerce-only |
| 6.5 | Baymard heuristics | `heuristics-repo/baymard.json` | Zod validation | ~25 heuristics |
| 6.6 | Nielsen heuristics | `heuristics-repo/nielsen.json` | Zod validation | ~25 heuristics |
| 6.7 | Cialdini heuristics | `heuristics-repo/cialdini.json` | Zod validation | ~10 heuristics |
| 6.8 | EncryptionWrapper | `analysis/heuristics/encryption.ts` | Encrypt/decrypt round-trip | Content matches |
| 6.9 | TierValidator | `analysis/heuristics/tierValidator.ts` | Check all | No missing tier |

**Exit Gate:** 100 heuristics loaded + validated. Filtering returns 15-25 per combo. Encryption works.

---

### Phase 7 — Analysis Pipeline (Week 8-10)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 7.1 | AnalysisState | `analysis/AnalysisState.ts` | Compile | All fields, invariants |
| 7.2 | DeepPerceiveNode | `analysis/nodes/DeepPerceiveNode.ts` | Scan product page | AnalyzePerception + screenshots |
| 7.3 | EvaluateNode | `analysis/nodes/EvaluateNode.ts` | Evaluate 15 heuristics | 3-8 raw findings |
| 7.4 | SelfCritiqueNode | `analysis/nodes/SelfCritiqueNode.ts` | Critique 5 findings | ≥1 rejected/downgraded |
| 7.5 | EvidenceGrounder | `analysis/nodes/EvidenceGrounder.ts` | Ground 5 findings | ≥1 hallucination rejected |
| 7.6 | 8 Grounding Rules | `analysis/grounding/rules/*.ts` | Unit test each | Accept/reject correctly |
| 7.7 | AnnotateNode | `analysis/nodes/AnnotateNode.ts` | 3 pins on screenshot | Visible, correct colors |
| 7.8 | StoreNode | `analysis/nodes/StoreNode.ts` | Store findings | DB records + R2 files |
| 7.9 | AnalysisGraph | `analysis/AnalysisGraph.ts` | Compile subgraph | All edges connected |
| 7.10 | DetectPageType | `analysis/utils/detectPageType.ts` | Product page | Returns "product" |
| 7.11 | AssignConfidenceTier | `analysis/utils/assignTier.ts` | Tier 1 + measurement | Returns "high" |
| 7.12 | CostTracker | `analysis/CostTracker.ts` | 3 LLM calls | Total accurate |
| 7.13 | **Integration** | `tests/integration/analysis.test.ts` | Full pipeline on amazon product | 3+ grounded findings |

**Exit Gate:** Pipeline end-to-end on 3 page types. Self-critique rejects ≥1. Grounding rejects ≥1. Annotations render. DB + R2 storage works.

---

### Phase 8 — Audit Orchestrator (Week 10-11)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 8.1 | AuditState | `orchestration/AuditState.ts` | Compile | Extends BrowseState + AnalysisState |
| 8.2 | AuditSetupNode | `orchestration/nodes/AuditSetupNode.ts` | Setup audit | Client loaded, queue built |
| 8.3 | PageRouterNode | `orchestration/nodes/PageRouterNode.ts` | Route pages | Correct next/complete |
| 8.4 | AuditCompleteNode | `orchestration/nodes/AuditCompleteNode.ts` | Complete audit | Status updated, summary |
| 8.5 | AuditGraph | `orchestration/AuditGraph.ts` | Compile with subgraphs | Browse + analyze nested |
| 8.6 | Routing functions | `orchestration/auditEdges.ts` | All routes | Correct behavior |
| 8.7 | PostgresCheckpointer | `orchestration/PostgresCheckpointer.ts` | Kill + resume | State recovered |
| 8.8 | **Integration** | `tests/integration/audit.test.ts` | 3-page site audit | Findings for each page |

**Exit Gate:** Full audit on 3-page site. Browse ↔ analyze switching works. Checkpoint recovery works.

---

### Phase 9 — Competitor + Versioning (Week 11-13)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 9.1 | CompetitorDetector | `analysis/CompetitorDetector.ts` | Detect from page | Sector + competitors |
| 9.2 | ComparisonNode | `analysis/nodes/ComparisonNode.ts` | Compare 2 homepages | Pairwise findings |
| 9.3 | ComparisonGrounding | `analysis/ComparisonGrounding.ts` | Ground comparison | Both datasets verified |
| 9.4 | ConsistencyChecker | `analysis/ConsistencyChecker.ts` | Check 3 pages | Inconsistencies found |
| 9.5 | VersionDiffEngine | `analysis/VersionDiffEngine.ts` | Compare v1 vs v2 | Resolved/persisted/new |
| 9.6 | **Integration** | `tests/integration/competitor.test.ts` | Client + 1 competitor | Comparison findings stored |

**Exit Gate:** Competitor comparison works. Version diff works. Cross-page consistency works.

---

### Phase 10 — Client Management (Week 13-14)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 10.1 | Clerk integration | `auth/ClerkProvider.ts` | Login flow | JWT + roles working |
| 10.2 | Client CRUD | `api/routes/clients.ts` | Create + read client | DB record created |
| 10.3 | API key scoping | `auth/ApiKeyScope.ts` | Key → client_id | Isolation enforced |
| 10.4 | RLS enforcement | `db/rls.sql` | Query cross-client | Blocked by RLS |
| 10.5 | ReviewGateWorker | `workers/ReviewGateWorker.ts` | 24hr delayed finding | Auto-publishes |
| 10.6 | FindingReview API | `api/routes/findings.ts` | Approve/reject | Status updated |

**Exit Gate:** Auth works. Client isolation enforced. Review gate publishes/holds correctly.

---

### Phase 11 — Delivery Layer (Week 14-16)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 11.1 | CRO Audit MCP Server | `mcp/CROAuditMCPServer.ts` | Query findings | Returns filtered results |
| 11.2 | Client Dashboard | `apps/dashboard/` | View findings | Renders with annotations |
| 11.3 | Consultant Dashboard | `apps/dashboard/console/` | Review gate UI | Approve/reject works |
| 11.4 | SSE integration | `api/routes/stream.ts` | Audit progress | Real-time updates |
| 11.5 | Version comparison view | `apps/dashboard/compare/` | v1 vs v2 | Diff displayed |
| 11.6 | Competitor view | `apps/dashboard/competitors/` | Pairwise display | Comparison visible |

**Exit Gate:** MCP server returns findings. Dashboard renders. Console review works. SSE streaming.

---

### Phase 12 — Production (Week 16-18)

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 12.1 | Docker Compose | `docker-compose.yml` | All services up | Postgres, Redis, API, workers |
| 12.2 | Fly.io deployment | `fly.toml` | Deploy | API accessible |
| 12.3 | Vercel deployment | `apps/dashboard/vercel.json` | Deploy | Dashboard accessible |
| 12.4 | BullMQ scheduler | `workers/AuditScheduler.ts` | Schedule audit | Runs at configured time |
| 12.5 | Concurrent workers | `workers/AuditWorker.ts` | 4 concurrent | All complete |
| 12.6 | LangSmith integration | `observability/langsmith.ts` | Trace audit | Full trace visible |
| 12.7 | Sentry integration | `observability/sentry.ts` | Trigger error | Alert received |
| 12.8 | Bull Board | `apps/api/bull-board.ts` | View queue | Jobs visible |
| 12.9 | Health checks | `api/routes/health.ts` | Check all services | All healthy |

**Exit Gate:** All services running in Docker. Concurrent audits work. Monitoring active. Scheduled audits fire.

---

## 16.4 Total Artifact Count

| Phase | Artifacts | Cumulative |
|-------|----------|-----------|
| Phase 1 | 8 | 8 |
| Phase 2 | 34 | 42 |
| Phase 3 | 15 | 57 |
| Phase 4 | 12 | 69 |
| Phase 5 | 16 | 85 |
| Phase 6 | 9 | 94 |
| Phase 7 | 13 | 107 |
| Phase 8 | 8 | 115 |
| Phase 9 | 6 | 121 |
| Phase 10 | 6 | 127 |
| Phase 11 | 6 | 133 |
| Phase 12 | 9 | **142** |

**142 artifacts total across 12 phases.**

---

## 16.5 Master Architecture — Extended Phase Map (G8-FIX)

**Status:** Phases 1-5 above cover the MVP (agent internals). The master architecture adds Phases 6-16 for the full platform. Phase numbering below aligns with the master roadmap, NOT with the original §16.1 numbering (which used Phases 1-12 for a smaller scope).

> **Important:** The original Phases 6-12 in §16.1-16.3 covered heuristic KB, analysis pipeline, orchestrator, competitor, client mgmt, delivery, production — all scoped to the EXISTING spec. The master Phases 6-16 below REPLACE §16.1 Phases 6-12 with expanded scope from the F-series sections. When the new MVP is extracted from the master, task numbering will be reconciled.

### Master Phase Overview

| Phase | Name | Spec sections | Key deliverables | Exit gate |
|---|---|---|---|---|
| **1-5** | **Agent MVP** | §1-§17 (existing) | Browse agent, analysis pipeline, heuristic KB Phase 1, orchestrator, basic review gate | §16.3 exit gates (unchanged) |
| **6** | **Platform Foundation** | §18, §24, §25, §26 | Trigger gateway, two-store pattern, warm-up mode, reproducibility snapshots, layered cost gates, Temporal introduction | `AuditRequest` contract working. Published store enforced. Snapshot immutability. Temperature 0. |
| **7** | **State Exploration** | §20 | `explore_states` node, disclosure rule library, Pass 1 + Pass 2, meaningful-state detection, GR-009, `MultiStatePerception` | Pass 1 runs on 5 sites. Meaningful detection discards >30% of raw states. GR-009 catches ≥1 provenance violation. |
| **8** | **Discovery & Templates** (C1-L3-FIX: moved before Workflow — discovery produces templates + workflow definitions that Workflow consumes) | §19 | Template-first discovery, HDBSCAN clustering, classification, representative selection, workflow synthesis, queue synthesis | Discovery produces ≤20 templates from a 500-page site. Rule classification ≥70%. Queue synthesis prioritises correctly. |
| **9** | **Workflow + Rollups** (C1-L3-FIX: moved after Discovery — depends on §19 output) | §21, §23 | Workflow orchestrator subgraph, cross-step analysis, GR-010, 4-dimensional scoring, dedup/merge/rollups, finding scope hierarchy | Full funnel traversal on ecommerce site. Workflow findings produced. Template rollups working. Priority scoring correct. |
| **10** | **Client Delivery** | §14 (extended) | Client dashboard reads published store, MCP server reads published store, version diff, competitor view | Client sees only published findings. MCP returns correct scoped results. |
| **11** | **Consultant Tools** | §14 (extended) | Consultant dashboard: state graph viewer, workflow visualiser, template inspector, finding tree view, warm-up controls, discovery review | Consultant can inspect all evidence, approve/reject/edit with full context. |
| **12** | **Learning Service** | §28 | Calibration batch job, heuristic reliability adjustments, warm-up graduation automation | Calibration runs after each audit. Warm-up auto-graduates at threshold. |
| **13** | **Production Hardening** | §27 (extended), §26 (extended) | Temporal Schedules, concurrent workers, kill-switch, global rate limiting, health checks, monitoring | 20 concurrent audits. Kill-switch works. Scheduled audits fire on time. |
| **14** | **Hypothesis Pipeline** | §29 | Hypothesis generator, test plan generator, variation idea generator, A/B tool export | Hypotheses generated from findings. Consultant approves. VWO export works. |
| **15** | **Analytics Bindings** | §30 | GA4/Contentsquare/FullStory adapters, signal ingestion, analytics-informed scoring | Analytics sync runs. Traffic data improves representative selection. Behavioral signals feed calibration. |
| **16** | **Heuristic KB Phase 3-4** | §22 (extended) | Vector retrieval, pgvector catalog, embedding pipeline, learned heuristic crystallisation | Retrieval handles 5k+ heuristics. Vector rerank improves over categorical. Client-specific learned heuristics created. |

### Master Phase Dependency Graph

```
Phase 1-5 (Agent MVP — existing §16.1-16.3)
    │
    └──▶ Phase 6 (Platform Foundation)
              │
              ├──▶ Phase 7 (State Exploration)
              │         │
              │         └──▶ Phase 8 (Discovery & Templates)   ← C1-L3-FIX: Discovery BEFORE Workflow
              │                   │
              │                   └──▶ Phase 9 (Workflow + Rollups)   ← consumes Discovery output
              │                             │
              │                             ├──▶ Phase 10 (Client Delivery)
              │                             │         │
              │                             │         └──▶ Phase 11 (Consultant Tools)
              │                             │
              │                             └──▶ Phase 12 (Learning Service)
              │
              └──▶ Phase 13 (Production Hardening)
                        │
                        └──▶ Phase 14 (Hypothesis Pipeline)
                                  │
                                  └──▶ Phase 15 (Analytics Bindings)
                                            │
                                            └──▶ Phase 16 (Heuristic KB Phase 3-4)
```

### New MVP Extraction Note

**REQ-IMPL-EXT-REF-001:** (G4 coverage gap fix) The v3.1 source-of-truth file (`AI_Browser_Agent_Architecture_v3.1.md` §18.5) contains DETAILED post-MVP browser artifact tables for: Memory & Replay (StorageAdapter, SemanticMemory, WorkflowRecorder, ModeARunner), Full Orchestration (10-node graph, ClassifyTask, LoadMemory, SafetyGate, Reflect, HITL, PostgresCheckpointer), Evaluation (BenchmarkSuite, WAREXInjector, ScorecardGenerator, RegressionDetector), Computer-Use (ScreenshotInteractor, ComputerUseRouter, Docker isolation). These are the canonical browser-specific artifact specs and SHALL be consulted during implementation of Phases 7-13. This section (§16.5) provides the MASTER phase plan; v3.1 §18.5 provides the browser ARTIFACT detail within those phases.

**REQ-IMPL-EXT-REF-002:** (G4 coverage gap fix) The v3.1 source-of-truth file (`AI_Browser_Agent_Architecture_v3.1.md` §18.7) contains a 7-item Risk Register (R-1 through R-7) specific to browser agent implementation: LangGraph.js fewer examples than Python (R-1), Amazon anti-bot blocks during testing (R-2), AX-tree inconsistency across sites (R-3), ghost-cursor/playwright-extra compatibility (R-4), confidence formula accuracy (R-5), MCP protocol overhead (R-6), scope creep into SEO/A11y (R-7). These risks SHALL be tracked in the project risk register and reviewed at each phase gate.

**REQ-IMPL-EXT-000:** (M7-L3-FIX) Each master phase (6-16) SHALL include integration tests following the same pattern as §16.3 — per-phase smoke tests, exit gates, and pass criteria. Test specifications will be detailed during MVP re-extraction and per-phase task generation.

**REQ-IMPL-EXT-001:** The new MVP will be re-extracted from the master architecture after all F/G sections are locked. Expected scope: Phase 1-5 (agent internals, unchanged) + selected Phase 6 foundations (trigger gateway skeleton, two-store pattern, reproducibility snapshot, scoring extensions). The 155-task plan will be diffed against the new MVP; ~130 tasks reused, ~15-20 new tasks added, ~5-10 retired. See Q6-R ruling.

**REQ-IMPL-EXT-002:** Per Q6-R: the existing 155 tasks from `docs/specs/mvp/tasks.md` are NOT invalidated. They are the starting set. New MVP extraction produces a reconciled task list, not a rewrite.
