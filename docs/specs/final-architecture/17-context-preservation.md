---
title: 17-context-preservation
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

# Section 17 — Context Preservation, Repo Structure & Development Workflow

## 17.1 Engineering Constitution

1. **Findings are hypotheses, not verdicts.** Every finding survives 3 filters before reaching clients.
2. **Perception first, action second.** Never act without a fresh page snapshot.
3. **Verify everything.** No browse action is "done" until verification passes.
4. **Evidence before assertion.** No finding without specific page data backing it.
5. **Safety is structural.** The LLM cannot override the safety gate.
6. **Cheapest mode first.** Route to Mode A before B before C.
7. **Never predict conversion.** State violations, cite research, recommend fixes.
8. **Tier determines trust level.** Visual/structural = reliable. Emotional = review needed.
9. **Heuristics are secret.** Never exposed to clients, API, or dashboard.
10. **Self-critique is non-negotiable.** Even if it adds 2-3 seconds per page.

## 17.2 Repository Structure

```
ai-cro-audit/
├── .github/
│   └── workflows/                          # CI/CD
│       ├── test.yml
│       ├── deploy-api.yml
│       └── deploy-dashboard.yml
├── .spec/                                  # Formal specifications
│   └── final-architecture/                 # THIS folder
│       ├── README.md
│       ├── 01-system-identity.md
│       ├── ... (17 spec files)
│       └── diagrams/ (13 HTML files)
├── apps/
│   ├── api/                                # Hono API server
│   │   ├── src/
│   │   │   ├── routes/                     # API endpoints
│   │   │   ├── middleware/                  # Auth, RLS, logging
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── dashboard/                          # Next.js dashboard
│   │   ├── src/
│   │   │   ├── app/                        # App Router pages
│   │   │   │   ├── dashboard/              # Client dashboard
│   │   │   │   └── console/                # Consultant dashboard
│   │   │   ├── components/                 # shadcn/ui components
│   │   │   └── lib/                        # Utilities
│   │   ├── package.json
│   │   └── next.config.ts
│   └── workers/                            # Background workers
│       ├── src/
│       │   ├── AuditWorker.ts              # Runs audit jobs
│       │   ├── AuditScheduler.ts           # Schedules recurring audits
│       │   └── ReviewGateWorker.ts         # Publishes delayed findings
│       ├── Dockerfile
│       └── package.json
├── packages/
│   └── agent-core/                         # Core agent logic
│       ├── src/
│       │   ├── orchestration/              # Phase 5 + 8
│       │   │   ├── AgentState.ts           # Browse state (v3.1)
│       │   │   ├── AuditState.ts           # Unified audit state
│       │   │   ├── BrowseGraph.ts          # v3.1 graph
│       │   │   ├── AuditGraph.ts           # Outer orchestrator
│       │   │   ├── edges.ts                # Browse routing
│       │   │   ├── auditEdges.ts           # Audit routing
│       │   │   ├── SystemPrompt.ts
│       │   │   ├── PostgresCheckpointer.ts
│       │   │   └── nodes/
│       │   │       ├── PerceiveNode.ts
│       │   │       ├── ReasonNode.ts
│       │   │       ├── ActNode.ts
│       │   │       ├── VerifyNode.ts
│       │   │       ├── OutputNode.ts
│       │   │       ├── AuditSetupNode.ts
│       │   │       ├── PageRouterNode.ts
│       │   │       └── AuditCompleteNode.ts
│       │   ├── perception/                 # Phase 1
│       │   │   ├── AccessibilityExtractor.ts
│       │   │   ├── HardFilter.ts
│       │   │   ├── SoftFilter.ts
│       │   │   ├── MutationMonitor.ts
│       │   │   ├── ScreenshotExtractor.ts
│       │   │   └── ContextAssembler.ts
│       │   ├── browser-runtime/            # Phase 1
│       │   │   ├── BrowserManager.ts
│       │   │   └── StealthConfig.ts
│       │   ├── mcp/                        # Phase 2
│       │   │   ├── MCPServer.ts
│       │   │   ├── JSSandbox.ts
│       │   │   └── tools/                  # 28 tool files
│       │   ├── human-behavior/             # Phase 2
│       │   │   ├── MouseBehavior.ts
│       │   │   ├── TypingBehavior.ts
│       │   │   └── ScrollBehavior.ts
│       │   ├── verification/               # Phase 3
│       │   │   ├── ActionContract.ts
│       │   │   ├── VerifyNode.ts
│       │   │   ├── FailureClassifier.ts
│       │   │   └── strategies/             # 9 strategy files
│       │   ├── confidence/                 # Phase 3
│       │   │   └── ConfidenceScorer.ts
│       │   ├── safety/                     # Phase 4
│       │   │   ├── ActionClassifier.ts
│       │   │   ├── SafetyCheck.ts
│       │   │   ├── DomainPolicy.ts
│       │   │   ├── CircuitBreaker.ts
│       │   │   └── AuditLogger.ts
│       │   ├── adapters/                   # Phase 4
│       │   │   ├── LLMAdapter.ts
│       │   │   ├── AnthropicAdapter.ts
│       │   │   ├── OpenAIAdapter.ts
│       │   │   └── LLMAdapterFactory.ts
│       │   ├── streaming/                  # Phase 4
│       │   │   ├── StreamEmitter.ts
│       │   │   └── types.ts
│       │   ├── rate-limit/                 # Phase 2
│       │   │   └── RateLimiter.ts
│       │   ├── db/                         # Phase 4
│       │   │   ├── schema.ts               # Drizzle schema
│       │   │   ├── schema.sql              # Raw SQL
│       │   │   ├── migrations/
│       │   │   └── SessionRecorder.ts
│       │   ├── analysis/                   # Phase 6-7
│       │   │   ├── AnalysisState.ts
│       │   │   ├── AnalysisGraph.ts
│       │   │   ├── CostTracker.ts
│       │   │   ├── CompetitorDetector.ts
│       │   │   ├── ConsistencyChecker.ts
│       │   │   ├── VersionDiffEngine.ts
│       │   │   ├── heuristics/
│       │   │   │   ├── schema.ts
│       │   │   │   ├── HeuristicLoader.ts
│       │   │   │   ├── filter.ts
│       │   │   │   ├── encryption.ts
│       │   │   │   └── tierValidator.ts
│       │   │   ├── grounding/
│       │   │   │   ├── EvidenceGrounder.ts
│       │   │   │   └── rules/              # 8 rule files
│       │   │   ├── nodes/
│       │   │   │   ├── DeepPerceiveNode.ts
│       │   │   │   ├── EvaluateNode.ts
│       │   │   │   ├── SelfCritiqueNode.ts
│       │   │   │   ├── AnnotateNode.ts
│       │   │   │   └── StoreNode.ts
│       │   │   ├── strategies/
│       │   │   │   ├── EvaluateStrategy.ts          # Phase 7
│       │   │   │   ├── StaticEvaluateStrategy.ts    # Phase 7
│       │   │   │   └── InteractiveEvaluateStrategy.ts # Phase 11
│       │   │   └── utils/
│       │   │       ├── detectPageType.ts
│       │   │       └── assignTier.ts
│       │   └── storage/                    # Phase 4
│       │       ├── StorageAdapter.ts
│       │       ├── ScreenshotStorage.ts
│       │       └── R2Adapter.ts
│       ├── tests/
│       │   ├── unit/
│       │   └── integration/
│       │       ├── bbc.test.ts
│       │       ├── amazon.test.ts
│       │       ├── workflow.test.ts
│       │       ├── analysis.test.ts
│       │       ├── audit.test.ts
│       │       └── competitor.test.ts
│       ├── package.json
│       └── tsconfig.json
├── docker-compose.yml                      # Postgres + Redis + API + Workers
├── package.json                            # Monorepo root
├── turbo.json                              # Build config
├── pnpm-workspace.yaml
└── .claude/
    └── HANDOVER.md
```

## 17.3 Session Handover Prompt

```
Project: REO Digital AI CRO Audit System — Final Architecture v1.0
Method: Spec-Driven Development (SDD) with Claude Code + GitHub Spec Kit
Current Phase: [UPDATE EACH SESSION]
Last Completed: [UPDATE EACH SESSION]

System: 5-layer AI CRO audit platform
  L1: Orchestration (LangGraph.js, dual-mode, BullMQ)
  L2: Browser Agent (v3.1: 23 tools, Playwright, 10 nodes)
  L3: Analysis Engine (5-step pipeline, 5 tools, 8 grounding rules)
  L4: Data (PostgreSQL+pgvector, R2, Drizzle)
  L5: Delivery (Hono API, Next.js dashboards, MCP server, Clerk)

Modes: Browse (navigate) + Analyze (evaluate against heuristics)
Pipeline: perceive → evaluate/CoT → self-critique → evidence ground → annotate
Tools: 28 (23 browse + 5 analysis)
Heuristics: 60 (Baymard+Nielsen+Cialdini), 3 reliability tiers
Grounding: 8 rules (GR-001 to GR-008), deterministic code
Review: Tier1=auto, Tier2=24hr, Tier3=consultant

Key invariants:
- Findings are hypotheses, not verdicts
- Every finding must pass 3 filters (CoT, self-critique, evidence grounding)
- Never predict conversion impact
- Heuristics never exposed to clients
- Safety gates are deterministic code, not LLM

**§33 Agent Composition Model (Phase 11+):**
The analysis evaluate node supports two modes: static (single-shot, default for Phases 1-10) and interactive (ReAct loop with 9 browser tools injected, Phase 11+). Dual-mode evaluation adds Pass 2 open CRO observation. Browser session is shared between browse and analyze subgraphs via `BrowserSessionManager`. Key interfaces established in earlier phases: `ToolRegistry` (Phase 2), `SafetyContext` (Phase 4), `BrowserSessionManager` (Phase 4), `EvaluateStrategy` (Phase 7), `restore_state` node (Phase 8). See §33 + §33a for full specification.

Spec location: docs/specs/final-architecture/
  README.md — index and map
  01-17 — spec files
  diagrams/ — visual diagrams
```

## 17.4 Development Workflow

### Per-Phase Process

```
1. Read spec section for current phase
2. Open phase diagram for visual context
3. Create branch: phase-{N}/{feature}
4. Write TypeScript types/interfaces FIRST
5. Write Zod schemas for runtime validation
6. Write unit tests (TDD where possible)
7. Implement against tests
8. Run smoke tests from Section 16
9. Run ALL existing tests (no regressions)
10. PR with spec traceability (link to REQ-IDs)
11. Phase exit gate review
12. Merge to main
```

### Definition of Done (per artifact)

- [ ] TypeScript types/interfaces defined
- [ ] Zod schemas for runtime validation
- [ ] Unit tests pass
- [ ] Smoke test from Section 16 passes
- [ ] No regressions in previous phases
- [ ] LangSmith trace working (Phase 4+)
- [ ] REQ-ID traceability documented

### Spec Kit Integration

For Claude Code sessions, use the spec files as context:

```bash
# Start Claude Code with spec context
claude --context docs/specs/final-architecture/README.md

# Reference specific sections
# "Implement Phase 7, artifact 7.3 (EvaluateNode) per Section 7 spec"
```

## 17.5 Loose Coupling — Adapter Interfaces

Every external dependency has a swappable adapter:

| Interface | Default Implementation | Alternatives |
|-----------|----------------------|-------------|
| `BrowserEngine` | Playwright | Puppeteer, BrowserBase, CDP |
| `LLMAdapter` | Anthropic (Claude Sonnet 4) | OpenAI, Gemini, Local/Ollama |
| `StorageAdapter` | PostgreSQL (Drizzle) | Supabase, MongoDB, SQLite |
| `ScreenshotStorage` | Cloudflare R2 | S3, Local Disk, GCS |
| `HeuristicLoader` | JSON File (encrypted) | Database, API, Vector DB |
| `JobScheduler` | BullMQ (Redis) | pg-boss, node-cron, Cloud |
| `EventBus` | SSE (native) | WebSocket, Redis PubSub, Kafka |
| `AuthProvider` | Clerk | Better Auth, Auth.js, Custom JWT |
| `ImageProcessor` | Sharp | Canvas, Jimp, Puppeteer overlay |

## 17.6 Future Extensibility

Interfaces defined, NOT implemented:

```typescript
// Fix code generation (future)
interface FixGenerator {
  generateFix(finding: Finding, pageSource: string): Promise<{
    html: string; css: string; diff: string; explanation: string;
  }>;
}

// A/B test variant generation (future)
interface ABTestGenerator {
  generateVariant(finding: Finding, pageSource: string,
    platform: "vwo" | "optimizely"): Promise<{
    variantCode: string; hypothesis: string; metric: string;
  }>;
}

// Design recommendation (future)
interface DesignRecommender {
  generateMockup(finding: Finding, screenshot: Buffer): Promise<{
    mockupImage: Buffer; changes: string[]; rationale: string;
  }>;
}
```
