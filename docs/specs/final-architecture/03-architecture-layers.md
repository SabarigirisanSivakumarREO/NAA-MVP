---
title: 03-architecture-layers
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

# Section 3 — 5-Layer System Architecture

## 3.1 Layer Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  LAYER 5: DELIVERY                                                           │
│                                                                              │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐  │
│  │ CRO Audit MCP    │  │ Client Dashboard  │  │ Consultant Dashboard     │  │
│  │ Server           │  │                   │  │                          │  │
│  │ • NL queries     │  │ • Published       │  │ • Review gate mgmt       │  │
│  │ • API key scope  │  │   findings        │  │ • Approve/reject/edit    │  │
│  │ • Client isolate │  │ • Annotated       │  │ • Client management      │  │
│  │                   │  │   screenshots     │  │ • Audit scheduling       │  │
│  │ Tech: Hono + MCP │  │ • Version compare │  │ • Progress monitoring    │  │
│  │                   │  │ • Competitor view │  │                          │  │
│  │                   │  │                   │  │ Tech: Next.js + shadcn   │  │
│  │                   │  │ Tech: Next.js     │  │                          │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────────────┘  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 4: DATA                                                               │
│                                                                              │
│  ┌───────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ PostgreSQL 16 + pgvector          │  │ Cloudflare R2                   │  │
│  │                                    │  │                                 │  │
│  │ Tables:                            │  │ Screenshots:                    │  │
│  │ • clients                          │  │ • viewport_clean.jpg            │  │
│  │ • audit_runs (versioned)           │  │ • viewport_annotated.jpg        │  │
│  │ • findings (RLS)                   │  │ • fullpage_clean.jpg            │  │
│  │ • screenshots (RLS)                │  │ • fullpage_annotated.jpg        │  │
│  │ • domain_patterns (pgvector)       │  │                                 │  │
│  │ • workflow_recipes                 │  │ ~4,000 images/week at scale     │  │
│  │ • sessions                         │  │                                 │  │
│  │ • audit_log                        │  │ Tech: R2 (prod) / disk (dev)    │  │
│  │                                    │  │                                 │  │
│  │ Security: Row-level security       │  └─────────────────────────────────┘  │
│  │ ORM: Drizzle                       │                                      │
│  │ No PII stored                      │  ┌─────────────────────────────────┐  │
│  └───────────────────────────────────┘  │ Heuristic Repo (Private Git)    │  │
│                                          │ • 100 heuristics (JSON)         │  │
│                                          │ • Compiled at build time        │  │
│                                          │ • Encrypted at rest             │  │
│                                          │ • CRO team owns                 │  │
│                                          └─────────────────────────────────┘  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 3: ANALYSIS ENGINE                                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 5-STEP ANALYSIS PIPELINE (per page)                                    │  │
│  │                                                                        │  │
│  │ PERCEIVE ──→ EVALUATE ──→ SELF-CRITIQUE ──→ GROUND ──→ ANNOTATE       │  │
│  │ (page scan)  (LLM+CoT)   (LLM review)     (code)     (Sharp)         │  │
│  │  ~200ms       ~3-5s        ~2-3s            ~100ms     ~500ms         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │ Heuristic    │ │ Evidence     │ │ Cross-Page   │ │ Competitor        │  │
│  │ Evaluator    │ │ Grounder     │ │ Consistency  │ │ Comparator        │  │
│  │              │ │              │ │ Analyzer     │ │ (pairwise)        │  │
│  │100 heuristics│ │ 8 grounding  │ │              │ │                   │  │
│  │ 3 tiers      │ │ rules        │ │ CTA styles,  │ │ Client vs comp   │  │
│  │ Filtered by  │ │ GR-001 to    │ │ nav, colors, │ │ on specific       │  │
│  │ page+business│ │ GR-008       │ │ typography   │ │ dimensions        │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └───────────────────┘  │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────────────────┐ │
│  │ Screenshot   │ │ Version Diff │ │ Review Gate                          │ │
│  │ Annotator    │ │ Engine       │ │                                      │ │
│  │              │ │              │ │ Tier 1 → auto-publish                │ │
│  │ Sharp pins,  │ │ Resolved /   │ │ Tier 2 → 24hr delay                 │ │
│  │ severity     │ │ Persisted /  │ │ Tier 3 → consultant held            │ │
│  │ colors       │ │ New findings │ │                                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────────────────┘ │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 2: BROWSER AGENT (v3.1)                                               │
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────────┐  │
│  │ BROWSE MODE                    │  │ ANALYZE PERCEPTION                 │  │
│  │                                │  │                                    │  │
│  │ 8 layers, 10 nodes, 23 tools  │  │ 5 analysis tools                   │  │
│  │ 3 execution modes (A/B/C)     │  │ Full page scan:                    │  │
│  │ AX-tree + dual-stage filter   │  │ • Structure, content, CTAs, forms  │  │
│  │ 9 verify strategies           │  │ • Trust signals, layout, images    │  │
│  │ Multiplicative confidence     │  │ • Navigation, performance          │  │
│  │ ghost-cursor, Gaussian typing │  │ • Computed styles + bounding boxes │  │
│  │ Safety gate (deterministic)   │  │ • Viewport + fullpage screenshots  │  │
│  │ HITL for login/sensitive      │  │                                    │  │
│  │ Rate limiting + circuit break │  │ Tech: Playwright evaluate()        │  │
│  │ Mutation-aware verification   │  │                                    │  │
│  │                                │  │                                    │  │
│  │ Tech: Playwright + stealth    │  │                                    │  │
│  └────────────────────────────────┘  └────────────────────────────────────┘  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: ORCHESTRATION                                                      │
│                                                                              │
│  ┌──────────────────┐ ┌───────────────────┐ ┌────────────────────────────┐  │
│  │ Audit Orchestrator│ │ Job Scheduler     │ │ Client Manager             │  │
│  │                   │ │                   │ │                            │  │
│  │ Dual-mode graph   │ │ Scheduled re-runs │ │ Profiles, scope, auth      │  │
│  │ Browse ↔ Analyze  │ │ 20+ audits/week   │ │ API keys, data isolation   │  │
│  │ Page queue mgmt   │ │ Concurrent workers│ │ Clerk integration          │  │
│  │ Audit lifecycle   │ │ Retry policies    │ │                            │  │
│  │                   │ │                   │ │                            │  │
│  │ Tech: LangGraph.js│ │ Tech: BullMQ      │ │ Tech: Clerk + Drizzle      │  │
│  └──────────────────┘ └───────────────────┘ └────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────┐ ┌───────────────────┐                                 │
│  │ Heuristic Filter │ │ Event Emitter     │                                 │
│  │                   │ │                   │                                 │
│  │ 60 → 15-20 per   │ │ SSE progress      │                                 │
│  │ page type +       │ │ events to         │                                 │
│  │ business type     │ │ dashboards        │                                 │
│  │                   │ │                   │                                 │
│  │ Tech: code filter │ │ Tech: native SSE  │                                 │
│  └──────────────────┘ └───────────────────┘                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Interface Contracts

**REQ-LAYER-001:** Layer N SHALL only import from Layer N-1, N, or N+1 via typed adapter interfaces. No layer skipping.

**REQ-LAYER-002:** All inter-layer communication SHALL use TypeScript interfaces with Zod runtime validation.

**REQ-LAYER-003:** Layer 2 (Browser Agent) SHALL expose browse tools exclusively through MCP protocol.

**REQ-LAYER-004:** Layer 1 SHALL emit SSE events for each state transition (node entered, action taken, finding produced, audit progress).

**REQ-LAYER-005:** Layer 3 (Analysis Engine) SHALL never directly control the browser. It receives `AnalyzePerception` data FROM Layer 2 and produces findings. No Playwright calls in Layer 3.

**REQ-LAYER-006:** Layer 4 (Data) SHALL enforce client isolation via PostgreSQL row-level security on all client-scoped tables.

## 3.3 Layer Responsibilities

| Layer | Owns | Does NOT Own |
|-------|------|-------------|
| **L1: Orchestration** | Audit lifecycle, mode switching, page queue, scheduling, client management, heuristic filtering | Browser control, LLM evaluation, data storage |
| **L2: Browser Agent** | Page navigation, interaction, perception (browse + analyze), verification, safety | Heuristic evaluation, finding storage, client management |
| **L3: Analysis Engine** | Heuristic evaluation, self-critique, evidence grounding, annotation, competitor comparison, version diff, review gate | Browser control, client auth, scheduling |
| **L4: Data** | PostgreSQL, R2, heuristic repo, data integrity, client isolation | Business logic, LLM calls, browser control |
| **L5: Delivery** | MCP server, dashboards, user-facing API, auth | Crawling, analysis, data storage |

## 3.4 Data Flow Between Layers

```
L1 (Orchestrator) creates audit session, builds page queue
    │
    │ sends: { url, client_id, audit_run_id, filtered_heuristics }
    ▼
L2 (Browser Agent) navigates to page, produces perception data
    │
    │ sends: { AnalyzePerception, viewport_screenshot, fullpage_screenshot }
    ▼
L3 (Analysis Engine) evaluates against heuristics, grounds findings
    │
    │ sends: { grounded_findings[], annotated_screenshots[] }
    ▼
L4 (Data) stores findings in Postgres, screenshots in R2
    │
    │ sends: { finding_ids[], screenshot_urls[] }
    ▼
L5 (Delivery) serves findings via MCP + dashboard
    │
    │ sends: { findings, annotations, version diffs } → to users
    ▼
L1 (Orchestrator) advances page queue, repeats or completes audit
```
