PROJECT: AI CRO Audit System (REO Digital / Neural Product)
STATUS: Architecture LOCKED + REVIEWED. 213 tasks ready. Implementation starts now.
METHOD: Spec-Driven Development with Claude Code

WARNING: This HANDOVER replaces the previous version entirely.
Previous version referenced 18 specs, 155 tasks, 8 phases — all outdated.
Current: 35 specs, 213 tasks, 11 phases. Read THIS file, not the old one.

===============================================================
CURRENT STATE (April 2026)
===============================================================

ARCHITECTURE:
  35 spec files in docs/specs/final-architecture/ (§01-§30 + §31 superseded + §32 superseded + §33 + §33a)
  1 master diagram: docs/specs/final-architecture/diagrams/master-architecture.html (3800+ lines, 10 tabs)
  7 archived diagrams in diagrams/archive/
  2 source-of-truth specs UNTOUCHED (canonical, never edit):
    - docs/specs/AI_Browser_Agent_Architecture_v3.1.md
    - docs/specs/AI_Analysis_Agent_Architecture_v1.0.md

IMPLEMENTATION PLAN:
  docs/specs/mvp/tasks-v2.md — 213 tasks across 11 phases (v2.1)

DEMO GUIDE:
  docs/specs/demo-guide.md — full walkthrough of master-architecture.html

ARCHITECTURE REVIEW: COMPLETE
  6 critical + 7 major + 4 minor issues found and ALL FIXED
  Cross-section consistency verified across all 35 specs
  MVP tasks synchronized with every architecture change

===============================================================
SYSTEM SUMMARY (memorize these numbers)
===============================================================

Architecture:   5 layers (Orchestration → Browser Agent → Analysis Engine → Data → Delivery)
Tools:          28 total (23 browse + 5 analysis) + 3 composition output tools (§33)
Heuristics:     100 (50 Baymard + 35 Nielsen + 15 Cialdini)
Grounding:      11 rules (GR-001 through GR-011)
Tiers:          3 reliability tiers (~42 Tier 1, ~42 Tier 2, ~16 Tier 3)
Failure modes:  110 catalogued (12 browse + 10 analysis + 16 composition + 72 platform)
Pipeline:       5-step: perceive → evaluate → self-critique → ground → annotate
Filter:         3-layer hallucination filter: CoT (~50%) → Self-Critique (~30%) → Evidence Ground (~95%)
Composition:    §33 — Browser Agent tools injected into Analysis Agent evaluate node
Modes:          Interactive (default after Phase 11) + Static (budget, Phases 1-10 default)
Phases:         11 phases, 213 tasks, ~17 weeks
Cost:           $0.35/page (static) to $1.80/page (deep interactive)

Tech stack:     TypeScript 5.x, Node.js 22, Turborepo + pnpm
                LangGraph.js, Playwright + stealth + ghost-cursor
                Claude Sonnet 4 (primary), GPT-4o (fallback), LangSmith
                PostgreSQL 16 + pgvector, Drizzle ORM, Redis/Upstash, BullMQ
                Hono 4.x, SSE, Next.js 15, shadcn/ui, Tailwind CSS
                Clerk auth, Cloudflare R2, Docker (dev), Fly.io (prod)
                Temporal (durable orchestration, Phase 6+)

===============================================================
WHAT TO READ (in priority order)
===============================================================

BEFORE ANY TASK — read these:

  1. THIS FILE (you're reading it)

  2. docs/specs/mvp/tasks-v2.md
     → 213 tasks (T001-T213) across 11 phases
     → Find the NEXT uncompleted task
     → Each task has: dep, spec REQ-ID, file path, smoke test, acceptance

  3. docs/specs/mvp/constitution.md
     → Non-negotiable engineering rules (see RULES section below)

FOR THE CURRENT TASK — read the relevant spec:

  Phase 1-5 (Browse Agent, T001-T100):
    → docs/specs/final-architecture/06-browse-mode.md
    → Source: AI_Browser_Agent_Architecture_v3.1.md (canonical)

  Phase 6 (Heuristic KB, T101-T112):
    → docs/specs/final-architecture/09-heuristic-kb.md
    → TWO-STAGE filtering: §9.6 REQ-HK-020a (business type in audit_setup) + REQ-HK-020b (page type in page_router)

  Phase 7 (Analysis Pipeline, T113-T134):
    → docs/specs/final-architecture/07-analyze-mode.md
    → §33a: EvaluateStrategy pattern (StaticEvaluateStrategy default, InteractiveEvaluateStrategy Phase 11)
    → Source: AI_Analysis_Agent_Architecture_v1.0.md (canonical)

  Phase 8 (Orchestrator, T135-T155):
    → docs/specs/final-architecture/04-orchestration.md
    → docs/specs/final-architecture/05-unified-state.md
    → §33a: Session passing browse→analyze, restore_state node

  Phase 9 (Master Foundations, T156-T175):
    → docs/specs/final-architecture/18-trigger-gateway.md
    → docs/specs/final-architecture/25-reproducibility.md
    → docs/specs/final-architecture/24-two-store-pattern.md
    → docs/specs/final-architecture/23-findings-engine-extended.md

  Phase 10 (State Exploration, T176-T192):
    → docs/specs/final-architecture/20-state-exploration.md
    → docs/specs/final-architecture/07-analyze-mode.md §7.4a (per-state screenshots)

  Phase 11 (Agent Composition, T193-T212):
    → docs/specs/final-architecture/33-agent-composition-model.md
    → docs/specs/final-architecture/33a-composition-integration.md
    → NOTE: §31 and §32 are SUPERSEDED by §33. Do NOT implement from §31/§32.

CROSS-CUTTING SPECS (read when relevant):
    → 03-architecture-layers.md — 5-layer contracts, REQ-LAYER-005 v3
    → 08-tool-manifest.md — all 28 tools with TypeScript interfaces
    → 11-safety-cost.md — safety classification, rate limits, cost model
    → 13-data-layer.md — 25+ tables, RLS, R2, published_findings view
    → 14-delivery-layer.md — MCP server, dashboards, SSE events
    → 15-failure-modes.md — 110 failure modes
    → 17-context-preservation.md — repo structure, adapter interfaces
    → 21-workflow-orchestration.md — funnel traversal
    → 26-cost-and-guardrails.md — budget enforcement, kill-switch
    → 27-durable-orchestration.md — Temporal + LangGraph integration

VISUAL REFERENCE (open in browser during development):
    → docs/specs/final-architecture/diagrams/master-architecture.html

===============================================================
NON-NEGOTIABLE RULES
===============================================================

R1: SOURCE OF TRUTH
   Browse mode: AI_Browser_Agent_Architecture_v3.1.md
   Analyze mode: AI_Analysis_Agent_Architecture_v1.0.md
   Composition: 33-agent-composition-model.md
   System: docs/specs/final-architecture/ (§01-§30 + §33 + §33a)
   If specs disagree: ASK USER. Don't pick arbitrarily.

R2: TYPE SAFETY FIRST
   Zod schemas BEFORE implementation
   No `any` types without justification
   Every external boundary validated at runtime

R3: TEST-DRIVEN
   Write the test first, then implement
   Each task has a smoke test in tasks-v2.md
   NEVER disable a failing test

R4: BROWSE MODE
   Tool names from v3.1 are EXACT (browser_get_state, NOT page_snapshot)
   Confidence is MULTIPLICATIVE (current * 0.97), not additive
   Verify EVERY action — no exceptions
   Safety gate is CODE, not LLM judgment
   Browser session created by ORCHESTRATOR, not by browse graph (§33a REQ-COMP-PHASE5-001)

R5: ANALYZE MODE
   Findings are HYPOTHESES, not verdicts
   Three-layer filter: CoT → self-critique → evidence grounding
   Self-critique is a SEPARATE LLM call with DIFFERENT persona (SD-07)
   NEVER predict conversion impact (GR-007 enforces)
   Two-stage heuristic filtering:
     Stage 1: filterByBusinessType in audit_setup (100 → ~60-70)
     Stage 2: filterByPageType in page_router (~60-70 → 15-20)
   Heuristics injected into USER MESSAGE, not system prompt
   Evaluate node uses EvaluateStrategy pattern (§33a REQ-COMP-PHASE7-001):
     StaticEvaluateStrategy = default (Phases 1-10)
     InteractiveEvaluateStrategy = Phase 11

R6: HEURISTIC IP
   Heuristic content NEVER in API responses or dashboards
   AES-256-GCM encryption at rest, decrypted in memory only
   Only heuristic_id references stored in DB
   Redacted in LangSmith traces

R7: LOOSE COUPLING
   All external deps via adapters: LLMAdapter, StorageAdapter,
     ScreenshotStorage, BrowserEngine, HeuristicLoader,
     BrowserSessionManager (§33a), ToolRegistry (§33a)
   No direct imports of Anthropic SDK / Playwright / pg
     OUTSIDE adapter modules

R8: SPEC-DRIVEN DISCIPLINE
   Every implementation decision must trace to a REQ-ID
   When spec is unclear: ASK, don't invent
   Commit messages reference task ID + REQ-ID

R9: §33 INTERFACE-FIRST (NEW)
   These interfaces MUST be built in earlier phases, not bolted on later:
     Phase 2: ToolRegistry with getToolsForContext() — REQ-COMP-PHASE2-001
     Phase 4: SafetyContext with callingNode field — REQ-COMP-PHASE4-001
     Phase 4: BrowserSessionManager (create/get/close) — REQ-COMP-PHASE4-002
     Phase 5: Browse graph accepts external session — REQ-COMP-PHASE5-001
     Phase 7: EvaluateStrategy interface — REQ-COMP-PHASE7-001
     Phase 8: Session passing + restore_state node — REQ-COMP-PHASE8-001/002
   Static mode is the default. Interactive mode activates in Phase 11.
   If you're building Phase 2-8: check tasks-v2.md for §33a modifications.

R10: REPRODUCIBILITY (NEW)
   temperature = 0 for: evaluate, evaluate_interactive, self_critique
   Reproducibility snapshot created by GATEWAY (§18), loaded by audit_setup
   Snapshot is IMMUTABLE after creation — mutation throws Error
   Same inputs → same outputs (deterministic grounding)

===============================================================
§33 AGENT COMPOSITION MODEL (critical context)
===============================================================

The analysis agent can use browser tools during evaluation (Phase 11).
This changes fundamental interfaces — which is why §33a bakes them
into earlier phases.

KEY CONCEPTS:
  - Browser Agent = reusable capability library (23 tools, stealth, verification)
  - Analysis Agent = CRO domain expert (5-step pipeline, heuristic evaluation)
  - Composition = tool injection (9 browser tools + 6 analysis tools during evaluate)
  - Navigation tools EXCLUDED from analysis (navigate, go_back, go_forward, tab_manage)
  - Sensitive actions BLOCKED during analysis
  - REQ-LAYER-005 v3: analysis MAY use browser tools, SHALL NOT navigate

DUAL-MODE EVALUATION:
  Pass 1: Heuristic-driven (filtered heuristics, interactive CoT, scope split)
  Pass 2: Open observation ("what did heuristics miss?", static-only, max 5, Tier 3)
  Both feed → self-critique → evidence grounding → annotate

TWO OPERATING MODES:
  Interactive: browser tools during evaluate, Pass 2 enabled, 5-15 interactions/page
  Static: single-shot evaluate, no browser tools, no Pass 2 (Phases 1-10 default)

POST-AUDIT LIFECYCLE:
  Two-store: INTERNAL (consultant sees all) + PUBLISHED (client sees approved only)
  Warm-up: new clients → all findings held until ≥3 audits + <25% rejection
  Learning: consultant decisions → calibration engine → improved future audits
  Crystallization: approved open observations → candidate heuristics → KB growth

===============================================================
AUDIT LIFECYCLE (7 phases, the complete journey)
===============================================================

PHASE 1: TRIGGER & INITIALIZATION
  Trigger → Gateway validates → Reproducibility snapshot (temp=0) →
  Load client + heuristics (AES-256-GCM) → Stage 1 filter (business type) →
  Discover pages → Build queue → Budget: $15 total, $5/page

PHASE 2: PAGE LOOP (per page, max 50)
  page_router → browse (navigate + stabilize + HITL if needed) →
  [explore_states §20: Pass 1 heuristic-primed + Pass 2 bounded-exhaustive → StateGraph] →
  deep_perceive (page_analyze + screenshots + per-state screenshots) →
  evaluate (interactive CoT or static, scope split: global/per_state/transition) →
  Pass 2 open observation (static, max 5, Tier 3) →
  self_critique (SEPARATE call, 5 checks, KEEP/REVISE/DOWNGRADE/REJECT) →
  evidence ground (11 rules, deterministic code, NO LLM) →
  annotate + store → review gate (Tier 1 auto / Tier 2 24hr / Tier 3 held) →
  restore_state → back to page_router

PHASE 3: WORKFLOW (if funnel items in queue)
  Continuous session → per-step browse+analysis → cross-step synthesis

PHASE 4: COMPLETION
  Summary → cross-page consistency → competitor comparison (pairwise) → version diff

PHASE 5: REVIEW GATE + TWO-STORE
  Internal store (all findings) → Tier routing → Warm-up override →
  Consultant review (approve/edit/reject) → Published store (client-visible)

PHASE 6: DELIVERY
  CLI + PostgreSQL (RLS) + R2 + MCP Server (9 tools) + Client Dashboard + Consultant Dashboard

PHASE 7: LEARNING LOOP
  Consultant decisions → Calibration engine (30+ samples, reliability_delta) →
  Open observation crystallization → Overlay chain (base→brand→learned→client) →
  Scheduled re-audits with version diff

===============================================================
IMPLEMENTATION MILESTONES
===============================================================

Phase 0-4:   Foundation (setup, perception, tools, verification, safety)
Phase 5:     ★ BROWSE WORKS — agent navigates real sites
Phase 6-7:   Analysis pipeline (heuristics + 5-step pipeline)
Phase 8:     ★ MVP AUDIT — single-site audit end-to-end
Phase 9:     Master foundations (gateway, reproducibility, two-store, scoring)
Phase 10:    State exploration (§20, per-state analysis)
Phase 11:    ★ FULL PRODUCT — interactive composition (§33), the competitive moat

§33a INTERFACE MODIFICATIONS (built into earlier phases):
  T024 (Phase 2): ToolRegistry
  T066 (Phase 4): BrowserSessionManager
  T071 (Phase 4): SafetyContext with callingNode
  T081 (Phase 5): External browser session injection
  T127 (Phase 7): EvaluateStrategy pattern
  T143 (Phase 8): Session passing + restore_state

===============================================================
WHAT I NEED FROM YOU NOW
===============================================================

1. Read tasks-v2.md — find the next uncompleted task (start with T001)
2. Read the relevant spec for that task's phase
3. Tell me which task you're picking up (cite T### ID)
4. Confirm you understand the §33a interface requirements for that phase
5. Wait for my approval before writing code

DO NOT start coding until I confirm. Ask if anything is unclear.
DO NOT implement from §31 or §32 — they are SUPERSEDED by §33.
DO check tasks-v2.md for §33a modifications on tasks T024, T066, T071, T081, T127, T143.
