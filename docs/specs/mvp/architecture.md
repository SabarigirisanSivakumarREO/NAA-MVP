---
title: Neural MVP — Architecture
artifact_type: spec
status: approved
version: 1.0
created: 2026-04-24
updated: 2026-04-24
owner: engineering lead
authors: [REO Digital team, Claude]

supersedes: "docs/specs/mvp/PRD.md §6 (v1.2 inline content extracted to this file on 2026-04-24)"
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (v1.2 §6 — extracted)
  - docs/specs/final-architecture/ (§01-§36 + §33a for per-module specs)

governing_rules:
  - Constitution R9 (Loose Coupling / Adapter Pattern)
  - Constitution R17 (Lifecycle States)

delta:
  new:
    - File created by extracting PRD §6 to separate architecture spec (good-spec review Option A, 2026-04-24)
  changed: []
  impacted:
    - docs/specs/mvp/PRD.md §6 (replaced with pointer)
    - CLAUDE.md (cross-refs to §6.x now resolve here)
  unchanged:
    - All architectural content (verbatim extraction; subsection numbering preserved as 6.1-6.5 for cross-ref stability)
---

# Neural MVP — Architecture

> **Summary (~100 tokens — agent reads this first):** Five-layer stack (Orchestration → Browser Agent → Analysis Engine → Data → Delivery), pipeline flow (trigger → audit → publish), data contracts (12 Zod types), tech stack with precise versions, project structure map + where-things-go decision tree. Extracted from PRD §6 to separate concerns. Subsection numbering (6.1-6.5) preserved so existing cross-references continue to resolve.

### 6.1 Five-layer architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  Layer 5 — DELIVERY                                               │
│    CLI (`pnpm cro:audit`) + Consultant Dashboard (Next.js 15 +    │
│    shadcn/ui + Clerk) + PDF (Playwright page.pdf) + Email (Resend)│
├───────────────────────────────────────────────────────────────────┤
│  Layer 4 — DATA                                                   │
│    PostgreSQL 16 + pgvector (clients, audit_runs, findings,       │
│    screenshots, reproducibility_snapshots, llm_call_log,          │
│    audit_events) + R2 (screenshots, PDFs) + heuristics-repo       │
├───────────────────────────────────────────────────────────────────┤
│  Layer 3 — ANALYSIS ENGINE                                        │
│    deep_perceive → quality_gate → evaluate → self_critique →      │
│    ground (12 rules) → annotate_and_store → cross_page_analyze    │
├───────────────────────────────────────────────────────────────────┤
│  Layer 2 — BROWSER AGENT                                          │
│    BrowserManager + MutationMonitor + OverlayDismisser +          │
│    ScreenshotExtractor + AccessibilityExtractor + HardFilter +    │
│    SoftFilter + ContextAssembler → PageStateModel. 12 MCP tools.  │
│    RateLimiter + CircuitBreaker.                                  │
├───────────────────────────────────────────────────────────────────┤
│  Layer 1 — ORCHESTRATION                                          │
│    AuditRequest + GatewayService + AuditState (LangGraph.js) +    │
│    audit_setup + page_router + audit_complete +                   │
│    cross_page_analyze + WarmupManager + 4D ScoringPipeline +      │
│    ReproducibilitySnapshot + TemperatureGuard                     │
└───────────────────────────────────────────────────────────────────┘
```

### 6.2 Pipeline flow

```
Trigger → AuditRequest (Zod) → GatewayService → audit_setup → page_router
  → browse subgraph (navigate + dismiss + stabilize + capture)
  → deep_perceive (page_analyze → AnalyzePerception v2.3)
  → quality_gate (skip / partial / proceed)
  → evaluate (Claude Sonnet 4, temp=0, heuristics + benchmarks + personas)
  → self_critique (separate LLM, different persona, 5 checks)
  → ground (12 deterministic rules)
  → score (4D) + suppress
  → annotate + store (R2 + Postgres)
  → emit PageSignals → accumulator
  → back to page_router (loop)
  → (queue empty) → cross_page_analyze (pattern detection, deterministic)
  → audit_complete (exec summary + action plan + PDF + email)
  → consultant review (approve/reject/edit in dashboard)
  → published store (client-visible)
```

### 6.3 Data contracts (full Zod schemas in `docs/specs/final-architecture/`)

- `AuditRequest` — trigger payload (see `§18 trigger-gateway.md`)
- `AuditState` — LangGraph Annotation, all fields (see `§05 unified-state.md`)
- `PageStateModel` — browser perception (see `§06 browse-mode.md`)
- `AnalyzePerception` — v2.3 enriched analysis perception (see `§07.9` + `§07.9.1`)
- `Heuristic` — with required benchmark (see `§09 heuristic-kb.md`)
- `Finding` lifecycle — Raw → Reviewed → Grounded / Rejected (see `§07` + `§23`)
- `PatternFinding` — cross-page (see design doc `§1.2`)
- `PersonaContext` — personas (see design doc `§1.2`)
- `ReproducibilitySnapshot` — immutable (see `§25`)
- `LLMCallRecord` — per-call logging (see `§11.7`)
- `AuditEvent` — 22 event types (see `§34.4`)
- `ExecutiveSummary` / `ActionPlan` — (see `§35`)

### 6.4 Tech stack (precise names + versions)

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 22 LTS |
| Monorepo | Turborepo + pnpm | Turborepo 2.x, pnpm 9.x |
| Validation | Zod | 3.x |
| Browser | Playwright | latest (default; stealth plugin deferred to v1.1) |
| Orchestration | LangGraph.js | latest |
| MCP | `@modelcontextprotocol/sdk` | latest |
| Primary LLM | Claude Sonnet 4 via `@anthropic-ai/sdk` | `claude-sonnet-4-20260301` |
| Fallback LLM | (Deferred to v1.2) GPT-4o | — |
| Database | PostgreSQL + pgvector | Postgres 16, pgvector latest |
| ORM | Drizzle | latest |
| Cache / Queue | Redis (Upstash in prod) + BullMQ | latest |
| API framework | Hono | 4.x |
| Frontend | Next.js App Router | 15 |
| UI components | shadcn/ui + Tailwind CSS | latest |
| Auth | Clerk | latest |
| Storage | Cloudflare R2 (S3-compatible); LocalDisk fallback in dev | — |
| Image annotation | Sharp | latest |
| PDF generation | Playwright `page.pdf()` | — |
| Logging | Pino (JSON structured) | latest |
| Email | Resend (or Postmark) | latest |
| Testing | Vitest (unit) + Playwright Test (integration + acceptance) | latest |
| Deployment | Fly.io (API) + Vercel (dashboard) | — |
| Containerization | Docker + docker-compose | latest |

Exact version pins go to `package.json` + `pnpm-lock.yaml`. Never upgrade a pinned version without approval.

### 6.5 Project structure map

Top-level layout. Every file belongs somewhere; if a task wants a file outside these locations, STOP and ask.

```
neural-nba/                                    # repo root
├── CLAUDE.md                                  # Claude Code operational entry point
├── README.md                                  # human-readable repo intro
├── .env.example                               # secret KEY=VALUE documentation (no real values)
├── .env                                       # gitignored; real secrets
├── package.json                               # workspace root config
├── pnpm-workspace.yaml                        # workspace declarations
├── turbo.json                                 # Turborepo pipeline
├── tsconfig.json                              # shared TS config
├── docker-compose.yml                         # local Postgres 16 + pgvector
├── .specify/                                  # Spec Kit managed (created by `specify init`)
│   ├── memory/
│   │   └── constitution.md                    # Spec Kit constitution (symlink → docs/specs/mvp/)
│   ├── scripts/                               # Spec Kit shell scripts
│   └── templates/                             # spec/plan/tasks templates
│
├── apps/                                      # deployable apps (Turborepo workspace)
│   ├── cli/                                   # `pnpm cro:audit` command
│   │   ├── src/
│   │   │   ├── index.ts                       # entry point
│   │   │   ├── commands/
│   │   │   │   └── audit.ts                   # cro:audit subcommand
│   │   │   └── output/
│   │   │       ├── ConsoleReporter.ts
│   │   │       └── JsonReporter.ts
│   │   ├── tests/
│   │   │   ├── unit/                          # fast, isolated
│   │   │   └── integration/                   # real DB, real browser
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── dashboard/                             # Next.js 15 consultant UI
│       ├── src/
│       │   ├── app/                           # App Router pages
│       │   │   ├── layout.tsx
│       │   │   ├── console/
│       │   │   │   ├── audits/page.tsx
│       │   │   │   ├── review/page.tsx
│       │   │   │   ├── review/[id]/page.tsx
│       │   │   │   └── clients/[id]/page.tsx
│       │   │   └── api/
│       │   │       └── report/[audit_run_id]/
│       │   │           └── render/page.tsx    # HTML for PDF rendering
│       │   ├── components/                    # shadcn/ui components
│       │   ├── lib/                           # Dashboard-local utilities
│       │   └── middleware.ts                  # Clerk auth gate
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/                                  # shared libraries (Turborepo workspace)
│   └── agent-core/                            # THE core library
│       ├── src/                               # ★ all source code here
│       │   ├── index.ts                       # public exports
│       │   ├── orchestration/                 # AuditState, AuditGraph, nodes
│       │   │   ├── AuditState.ts
│       │   │   ├── AuditGraph.ts
│       │   │   └── nodes/
│       │   │       ├── AuditSetupNode.ts
│       │   │       ├── PageRouterNode.ts
│       │   │       ├── AuditCompleteNode.ts
│       │   │       └── CrossPageAnalyzeNode.ts
│       │   ├── gateway/                       # AuditRequest + GatewayService
│       │   ├── reproducibility/               # Snapshot + TemperatureGuard
│       │   ├── browser-runtime/               # BrowserManager, OverlayDismisser, Rate/Circuit
│       │   ├── perception/                    # PageStateModel extractors
│       │   ├── mcp/                           # MCP server + 12 tools + ToolRegistry
│       │   │   └── tools/                     # 1 file per tool
│       │   ├── safety/                        # ActionClassifier, DomainPolicy
│       │   ├── verification/                  # ActionContract, 3 strategies, VerifyEngine
│       │   ├── analysis/
│       │   │   ├── nodes/                     # DeepPerceive, Evaluate, SelfCritique, Ground, Annotate, Store
│       │   │   ├── grounding/
│       │   │   │   └── rules/                 # GR-001 to GR-012, 1 file each
│       │   │   ├── scoring/                   # 4D scoring + IMPACT_MATRIX + EFFORT_MAP
│       │   │   ├── heuristics/                # Schema, loader, 2-stage filter
│       │   │   ├── personas/                  # PersonaContext + defaults
│       │   │   ├── cross-page/                # PatternDetector
│       │   │   ├── quality/                   # PerceptionQualityScorer
│       │   │   └── strategies/                # StaticEvaluateStrategy
│       │   ├── storage/                       # AccessModeMiddleware, TwoStore
│       │   ├── review/                        # WarmupManager
│       │   ├── delivery/                      # ExecSummary, ActionPlan, ReportGenerator
│       │   ├── observability/                 # Pino logger, EventEmitter
│       │   ├── adapters/                      # LLMAdapter, StorageAdapter, etc.
│       │   ├── db/                            # Drizzle schema + migrations
│       │   └── types/                         # cross-cutting Zod schemas + TS types
│       ├── tests/
│       │   ├── unit/                          # ★ per-module unit tests
│       │   └── integration/                   # ★ cross-module integration
│       ├── package.json
│       └── tsconfig.json
│
├── heuristics-repo/                           # 30 heuristics, JSON (private)
│   ├── README.md
│   ├── baymard.json
│   ├── nielsen.json
│   └── cialdini.json
│
├── tests/                                     # top-level acceptance suite (Playwright Test)
│   ├── acceptance/
│   │   ├── example-com.spec.ts                # T148
│   │   ├── amazon-in.spec.ts                  # T149
│   │   └── shopify-demo.spec.ts               # T150
│   └── fixtures/                              # cached pages for offline tests (v1.2)
│
└── docs/                                      # all specs + documentation
    ├── PROJECT_BRIEF.md                       # 28-section cross-LLM brief
    ├── master-architecture-checklist.md
    ├── engineering-practices/                 # cross-cutting engineering concerns
    │   ├── ai-orchestration-research-2026-04-24.md
    │   ├── code-style.md
    │   └── git-workflow.md
    ├── specs/
    │   ├── AI_Browser_Agent_Architecture_v3.1.md      # CANONICAL
    │   ├── AI_Analysis_Agent_Architecture_v1.0.md     # CANONICAL
    │   ├── final-architecture/                        # §01–§36 + §33a (38 specs)
    │   └── mvp/
    │       ├── PRD.md                         # ★ CANONICAL PRD
    │       ├── architecture.md                # ★ this file
    │       ├── testing-strategy.md            # ★ extracted from PRD §9
    │       ├── spec-driven-workflow.md        # ★ extracted from PRD §12
    │       ├── risks.md                       # ★ extracted from PRD §15
    │       ├── README.md                      # ★ entry point + document map (v2.0)
    │       ├── constitution.md                # engineering rules R1-R26
    │       ├── examples.md                    # samples, pitfalls, style guide
    │       ├── tasks-v2.md                    # 263-task master catalog (v2.3.3)
    │       ├── implementation-roadmap.md      # walking-skeleton 12-week plan (v0.3)
    │       ├── implementation-roadmap-visual.md
    │       ├── implementation-roadmap.html    # browser tracker (per-user; NOT canonical)
    │       ├── phases/                        # 15 per-phase folders (canonical spec/plan/tasks)
    │       │   ├── INDEX.md                   # phase decision table (v1.4)
    │       │   ├── phase-0-setup/
    │       │   ├── phase-0b-heuristics/
    │       │   ├── phase-{1,1b,1c,2,3,4,4b,5,5b,6,7,8,9}-*/
    │       │   └── (each: README, spec, plan, tasks, impact, checklists/, review-notes once R17.4 reviewed, phase-N-current.md once N+1 begins)
    │       ├── templates/                     # frontmatter, impact, rollup, phase-review, conformance, system-current, spec-to-code-matrix
    │       ├── scripts/                       # 6 stub scripts (spec:matrix/rollup/size/validate/index/pack); full impl Phase 9
    │       ├── sessions/                      # per-session handover notes (optional; not required for routine work)
    │       └── archive/
    │           └── 2026-04-07-walking-skeleton/
    └── superpowers/
        ├── specs/                             # design specs (from brainstorming skill)
        └── plans/                             # implementation plans (from writing-plans)
```

#### Where things go (decision tree)

| Kind of file | Location |
|---|---|
| Browser agent code | `packages/agent-core/src/browser-runtime/` or `perception/` |
| MCP tool implementation | `packages/agent-core/src/mcp/tools/<toolName>.ts` |
| Grounding rule | `packages/agent-core/src/analysis/grounding/rules/GR<NNN>.ts` |
| Heuristic JSON | `heuristics-repo/<source>.json` |
| Orchestration graph node | `packages/agent-core/src/orchestration/nodes/<NodeName>.ts` |
| External dependency wrapper | `packages/agent-core/src/adapters/<Name>Adapter.ts` |
| Zod schema | Adjacent to the module that owns it (e.g., `.../analysis/types.ts`) |
| Dashboard page | `apps/dashboard/src/app/console/<route>/page.tsx` |
| CLI subcommand | `apps/cli/src/commands/<name>.ts` |
| Unit test | `packages/*/tests/unit/<same-path>.test.ts` |
| Integration test | `packages/*/tests/integration/<name>.test.ts` |
| Acceptance (end-to-end) test | `tests/acceptance/<name>.spec.ts` |
| Design spec (new feature) | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` |
| Implementation plan | `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` |
| Architecture spec | `docs/specs/final-architecture/§NN-<name>.md` (extend existing, don't create new without approval) |

**If a new category of file doesn't fit above: STOP and ASK** (Constitution R11.3).

## Cross-references

- PRD §7 Component Breakdown — layer-by-layer detail
- PRD §10 Claude Code Operational Boundaries
- Constitution R9 (adapter pattern — mandatory for every external dep)
- Constitution R17 (lifecycle — enforced on every artifact, including this file)
- `docs/specs/final-architecture/` for per-module architecture specs
