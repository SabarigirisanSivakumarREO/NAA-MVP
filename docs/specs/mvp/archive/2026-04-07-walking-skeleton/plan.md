# MVP Implementation Plan

## How We're Building It

This is the technical plan for implementing the MVP. It's the bridge between `spec.md` (what) and `tasks.md` (step-by-step).

---

## Tech Stack (MVP Subset)

The full production stack has more components. For MVP, we use this minimal subset:

### Core (always required)

```
TypeScript 5.x
Node.js 22 LTS
pnpm + Turborepo
Zod (validation)
```

### Browser

```
Playwright + playwright-extra + stealth
ghost-cursor (Bezier mouse)
@modelcontextprotocol/sdk
LangGraph.js (state graph)
```

### LLM

```
Anthropic SDK (Claude Sonnet 4)  ← Primary
OpenAI SDK (GPT-4o)               ← Fallback only, optional in MVP
```

### Data

```
PostgreSQL 16 + pgvector (Docker)
Drizzle ORM
Sharp (image annotation)
```

### NOT in MVP (defer)

```
❌ Hono / API server          → CLI only
❌ Next.js / dashboard         → No UI
❌ Clerk                       → No auth (single user)
❌ BullMQ / Redis              → No job queue
❌ Cloudflare R2               → Local disk
❌ LangSmith                   → Console logs + Pino
❌ Sentry                      → Local error logs
❌ Fly.io / Vercel             → Local Docker only
```

---

## Repository Structure (MVP)

```
ai-cro-audit/
├── packages/
│   └── agent-core/                    # Single package for MVP
│       ├── src/
│       │   ├── orchestration/
│       │   │   ├── AgentState.ts
│       │   │   ├── AuditState.ts
│       │   │   ├── BrowseGraph.ts
│       │   │   ├── AuditGraph.ts
│       │   │   ├── edges.ts
│       │   │   ├── auditEdges.ts
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
│       │   ├── perception/
│       │   │   ├── AccessibilityExtractor.ts
│       │   │   ├── HardFilter.ts
│       │   │   ├── SoftFilter.ts
│       │   │   ├── MutationMonitor.ts
│       │   │   ├── ScreenshotExtractor.ts
│       │   │   └── ContextAssembler.ts
│       │   ├── browser-runtime/
│       │   │   ├── BrowserManager.ts
│       │   │   └── StealthConfig.ts
│       │   ├── mcp/
│       │   │   ├── MCPServer.ts
│       │   │   ├── JSSandbox.ts
│       │   │   └── tools/                  # 28 tool files
│       │   ├── human-behavior/
│       │   │   ├── MouseBehavior.ts
│       │   │   ├── TypingBehavior.ts
│       │   │   └── ScrollBehavior.ts
│       │   ├── verification/
│       │   │   ├── ActionContract.ts
│       │   │   ├── VerifyEngine.ts
│       │   │   ├── FailureClassifier.ts
│       │   │   └── strategies/             # 9 strategy files
│       │   ├── confidence/
│       │   │   └── ConfidenceScorer.ts
│       │   ├── safety/
│       │   │   ├── ActionClassifier.ts
│       │   │   ├── SafetyCheck.ts
│       │   │   ├── DomainPolicy.ts
│       │   │   ├── CircuitBreaker.ts
│       │   │   └── AuditLogger.ts
│       │   ├── adapters/
│       │   │   ├── LLMAdapter.ts           # Interface
│       │   │   ├── AnthropicAdapter.ts
│       │   │   └── OpenAIAdapter.ts
│       │   ├── streaming/
│       │   │   ├── StreamEmitter.ts
│       │   │   └── types.ts
│       │   ├── rate-limit/
│       │   │   └── RateLimiter.ts
│       │   ├── db/
│       │   │   ├── schema.ts               # Drizzle
│       │   │   ├── migrations/
│       │   │   ├── client.ts
│       │   │   └── SessionRecorder.ts
│       │   ├── storage/
│       │   │   ├── StorageAdapter.ts       # Interface
│       │   │   ├── PostgresStorage.ts
│       │   │   ├── ScreenshotStorage.ts    # Interface
│       │   │   └── LocalDiskStorage.ts
│       │   ├── analysis/
│       │   │   ├── AnalysisGraph.ts
│       │   │   ├── CostTracker.ts
│       │   │   ├── heuristics/
│       │   │   │   ├── schema.ts
│       │   │   │   ├── HeuristicLoader.ts
│       │   │   │   ├── filter.ts
│       │   │   │   └── encryption.ts
│       │   │   ├── grounding/
│       │   │   │   ├── EvidenceGrounder.ts
│       │   │   │   └── rules/              # GR-001 to GR-008
│       │   │   ├── nodes/
│       │   │   │   ├── DeepPerceiveNode.ts
│       │   │   │   ├── EvaluateNode.ts
│       │   │   │   ├── SelfCritiqueNode.ts
│       │   │   │   ├── AnnotateNode.ts
│       │   │   │   └── StoreNode.ts
│       │   │   └── utils/
│       │   │       ├── detectPageType.ts
│       │   │       └── assignTier.ts
│       │   └── index.ts                    # Public exports
│       ├── tests/
│       │   ├── unit/                       # Per-component tests
│       │   └── integration/
│       │       ├── bbc.test.ts
│       │       ├── amazon.test.ts
│       │       ├── analysis.test.ts
│       │       └── audit.test.ts
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   └── cli/                                # CLI runner
│       ├── src/
│       │   ├── index.ts                    # Entry point
│       │   ├── commands/
│       │   │   └── audit.ts                # `cro:audit` command
│       │   └── output/
│       │       ├── ConsoleReporter.ts
│       │       └── JsonReporter.ts
│       ├── package.json
│       └── tsconfig.json
├── heuristics-repo/                        # Heuristic JSON files
│   ├── baymard.json                        # 50 heuristics
│   ├── nielsen.json                        # 35 heuristics
│   ├── cialdini.json                       # 15 heuristics
│   └── README.md
├── docker-compose.yml                      # Postgres only
├── .env.example
├── package.json                            # Root
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## Build Order (8 Phases)

### Phase 1: Perception Foundation (Week 1-2)

**Goal:** Browser opens pages and produces structured PageStateModel.

**Tasks:** T001-T010

**Dependencies:** None (start here)

**Critical artifacts:**
- BrowserManager (Playwright wrapper)
- StealthConfig (anti-detection)
- AccessibilityExtractor (AX-tree)
- HardFilter + SoftFilter (dual filtering)
- MutationMonitor (DOM stability)
- ScreenshotExtractor (compressed JPEGs)
- ContextAssembler (PageStateModel)

**Exit when:** PageStateModel for amazon.in, bbc.com, github.com all < 1500 tokens.

---

### Phase 2: MCP Tools + Human Behavior (Week 2-4)

**Goal:** All 28 tools callable via MCP with human-like execution.

**Tasks:** T011-T045

**Dependencies:** Phase 1

**Critical artifacts:**
- MouseBehavior, TypingBehavior, ScrollBehavior
- MCPServer
- 23 browse tools (one file each)
- 5 analysis tools
- JSSandbox (for browser_evaluate)
- RateLimiter

**Exit when:** All 28 tools callable individually, ghost-cursor visible in headful mode.

---

### Phase 3: Verification & Confidence (Week 4-5)

**Goal:** Every action verified, confidence drives termination.

**Tasks:** T046-T060

**Dependencies:** Phase 2

**Critical artifacts:**
- ActionContract type
- 9 verify strategies (url_change, element_appears, ..., no_captcha, no_bot_block)
- VerifyEngine (mutation-aware)
- FailureClassifier
- ConfidenceScorer (multiplicative)

**Exit when:** All 9 strategies tested, confidence stays in (0,1) over 50 steps.

---

### Phase 4: Safety + Infrastructure (Week 5-6)

**Goal:** Foundation infrastructure ready (DB, LLM, streaming, safety).

**Tasks:** T061-T075

**Dependencies:** Phase 2-3

**Critical artifacts:**
- ActionClassifier (28 tools classified)
- SafetyCheck
- DomainPolicy
- CircuitBreaker
- AuditLogger
- PostgreSQL schema (Drizzle)
- AnthropicAdapter
- StorageAdapter + PostgresStorage
- ScreenshotStorage + LocalDiskStorage
- StreamEmitter

**Exit when:** Postgres deployed, LLM adapter works, audit log writes succeed.

---

### Phase 5: Browse Mode MVP (Week 6-7)

**Goal:** End-to-end browse on real websites.

**Tasks:** T076-T090

**Dependencies:** Phases 1-4

**Critical artifacts:**
- AgentState (LangGraph Annotation)
- StateValidators (invariants)
- 5 graph nodes (Perceive/Reason/Act/Verify/Output)
- BrowseGraph (compiled)
- Routing functions (routeAfterReason, routeAfterVerify)
- SystemPrompt
- 5 integration tests (BBC, Amazon, workflow, recovery, budget)

**Exit when:** BBC headlines < 30s, Amazon search < 90s, multi-page workflow works.

---

### Phase 6: Heuristic Knowledge Base (Week 7-8)

**Goal:** 100 heuristics loaded, filtered, encrypted.

**Tasks:** T091-T100

**Dependencies:** Phase 5

**Critical artifacts:**
- HeuristicSchema (Zod)
- HeuristicLoader
- filterByPageType + filterByBusinessType
- baymard.json (50 heuristics)
- nielsen.json (35 heuristics)
- cialdini.json (15 heuristics)
- EncryptionWrapper (AES-256-GCM)
- TierValidator

**Exit when:** 100 heuristics load + validate, filtering returns 15-25 per page type.

---

### Phase 7: Analysis Pipeline (Week 8-10)

**Goal:** 5-step pipeline produces grounded findings on real pages.

**Tasks:** T101-T120

**Dependencies:** Phases 5-6

**Critical artifacts:**
- AnalysisState (extends AgentState)
- DeepPerceiveNode (uses page_analyze tool)
- EvaluateNode (CoT prompt)
- SelfCritiqueNode (LLM review)
- EvidenceGrounder (8 rules)
- 8 grounding rule files (GR-001 to GR-008)
- AnnotateNode (Sharp pin overlays)
- StoreNode (DB + screenshot storage)
- AnalysisGraph (compiled)
- detectPageType + assignConfidenceTier utilities
- CostTracker
- Integration test on Amazon product page

**Exit when:** Pipeline runs end-to-end, self-critique rejects ≥1, grounding rejects ≥1.

---

### Phase 8: Audit Orchestrator (Week 10-11)

**Goal:** Single-site audit working end-to-end via CLI.

**Tasks:** T121-T140

**Dependencies:** Phases 5, 7

**Critical artifacts:**
- AuditState (extends AgentState + AnalysisState)
- AuditSetupNode (loads client, builds page queue)
- PageRouterNode
- AuditCompleteNode
- AuditGraph (compiled with browse + analyze as subgraphs)
- Audit routing functions
- PostgresCheckpointer (resume on crash)
- CLI command: `cro:audit`
- ConsoleReporter (real-time progress)
- JsonReporter (final output structure)
- **Acceptance test: full audit on example.com → output structure validated**

**Exit when:** `pnpm cro:audit --url https://example.com --pages 3` works end-to-end.

---

## Dependency Graph

```
Phase 1 (Perception)
    │
    └──→ Phase 2 (Tools + Human Behavior)
              │
              ├──→ Phase 3 (Verification + Confidence)
              │         │
              │         └──→ Phase 5 (Browse MVP)
              │                   │
              │                   ├──→ Phase 6 (Heuristics)
              │                   │         │
              │                   │         └──→ Phase 7 (Analysis Pipeline)
              │                   │                   │
              │                   │                   └──→ Phase 8 (Orchestrator) ★ MVP DONE
              │                   │
              │                   └──→ Phase 8 (depends on browse too)
              │
              └──→ Phase 4 (Safety + Infrastructure)
                        │
                        └──→ Phase 5 (Browse MVP needs Postgres + LLM adapter)
```

---

## What Claude Code Should Do First

### Day 1 Setup

```bash
# 1. Read the constitution and spec
> Read docs/specs/mvp/constitution.md
> Read docs/specs/mvp/spec.md
> Read docs/specs/mvp/plan.md
> Read docs/specs/mvp/tasks.md
> Acknowledge you understand the rules and scope

# 2. Read the source-of-truth specs
> Read docs/specs/AI_Browser_Agent_Architecture_v3.1.md sections 0-3
> Read docs/specs/final-architecture/02-architecture-decisions.md
> Read docs/specs/final-architecture/06-browse-mode.md sections 6.1-6.3

# 3. Set up the repo skeleton
> Execute task T001 (initialize monorepo) from tasks.md

# 4. Verify environment
> Run `pnpm install`
> Verify Node 22 LTS is installed
> Verify Docker is running
> Start `docker-compose up -d` for Postgres
```

### Then Work Through Tasks Sequentially

```bash
# For each task in tasks.md:
> Execute task T002 from tasks.md
> [Claude Code reads spec, writes code, runs tests]
> Verify it passes the smoke test
> Commit
> Move to T003
```

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| LangGraph.js subgraph API unfamiliar | Medium | Reference Python LangGraph docs, translate as needed |
| Amazon anti-bot blocks during testing | High | Use bot.sannysoft.com first, test simpler sites before Amazon |
| Heuristic prompt produces malformed JSON | Medium | Zod validation + retry policy in EvaluateNode |
| Self-critique adds unacceptable latency | Low | Measured: ~2-3s. Acceptable. |
| Cost overrun on testing | Medium | Hard $5 cap per audit, $50 cap per day in dev |
| pgvector setup is complex | Low | Use Docker image with pgvector preinstalled |

---

## Definition of MVP Done

When you can run this and it works:

```bash
$ pnpm cro:audit --url https://example.com --pages 3 --output ./test
✓ Audit started: a1b2c3d4
✓ Page 1/3: https://example.com (10s, 2 findings)
✓ Page 2/3: https://example.com/about (8s, 1 finding)
✓ Page 3/3: https://example.com/contact (12s, 3 findings)
✓ 1 finding rejected by self-critique
✓ 1 finding rejected by evidence grounding
✓ Audit complete: 6 findings, $1.85, 38s

$ ls test/audit-a1b2c3d4/
summary.json  findings.json  pages/  trace.json
```

The MVP is **DONE** when this command works on at least 3 of the 5 test sites.
