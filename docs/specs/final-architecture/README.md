# AI CRO Audit System — Final Production Architecture

## REO Digital / Neural Product Team — April 2026

**Version:** 1.0 (Final) + Master Extensions v1.0
**Status:** Architecture Lock — Ready for Implementation
**Implementation method:** Claude Code + GitHub Spec Kit
**Build approach:** Spec-Driven Development (SDD)

---

> ### G9-FIX: Architecture Layering Note
>
> This folder contains **two architectural layers**:
>
> **Part A — Agent Internals (§01-§17):** (S3-L3-FIX: renamed from "Layer A" to avoid collision with L1-L5 architecture layers in §3) The original 17 specification files covering the browser agent (v3.1), analysis pipeline (v1.0), heuristic KB (Phase 1), audit orchestrator, data layer, delivery layer, and 12-phase implementation plan. These are fully specified, research-grounded, and implementation-ready. They cover **Phase 1-5 (MVP)** of the master architecture. Source-of-truth files (`AI_Browser_Agent_Architecture_v3.1.md`, `AI_Analysis_Agent_Architecture_v1.0.md`) remain **untouched** and canonical.
>
> **Part B — Platform Extensions (§18-§30):** 13 new specification files added by the locked master architecture, covering trigger gateway, discovery & templates, state exploration, workflow orchestration, heuristic retrieval evolution, findings engine, two-store pattern, reproducibility, cost architecture, durable orchestration, learning service, hypothesis pipeline, and analytics bindings. These cover **Phases 6-16** and are forward-compatible — Phase 1-5 implementations can ignore them entirely.
>
> **The MVP is extracted from this combined architecture.** See §16.5 for the master phase map and §Q6-R ruling for the MVP re-extraction process.

---

## Document Map

This architecture is organized as 17 specification files + 13 visual diagrams. Read in order for full context, or jump to specific sections.

### Specification Files

| # | File | Content | Lines |
|---|------|---------|-------|
| 01 | [01-system-identity.md](01-system-identity.md) | What we're building, research principles, reality check | ~200 |
| 02 | [02-architecture-decisions.md](02-architecture-decisions.md) | 25 locked decisions, 6 deferred, complete tech stack | ~250 |
| 03 | [03-architecture-layers.md](03-architecture-layers.md) | 5-layer system architecture, interface contracts | ~200 |
| 04 | [04-orchestration.md](04-orchestration.md) | Audit orchestrator graph, dual-mode switching, routing functions | ~300 |
| 05 | [05-unified-state.md](05-unified-state.md) | AuditState schema (extends BrowseState + AnalysisState), invariants | ~250 |
| 06 | [06-browse-mode.md](06-browse-mode.md) | Full v3.1 browser agent: 8 layers, 10 nodes, 23 tools, perception, verification, safety | ~500 |
| 07 | [07-analyze-mode.md](07-analyze-mode.md) | 5-step pipeline: perceive → evaluate → self-critique → ground → annotate. All node specs. | ~500 |
| 08 | [08-tool-manifest.md](08-tool-manifest.md) | Unified 28-tool manifest with TypeScript interfaces | ~350 |
| 09 | [09-heuristic-kb.md](09-heuristic-kb.md) | Heuristic schema, 3 tiers, filtering logic, IP protection, loading strategy | ~300 |
| 10 | [10-competitor-versioning.md](10-competitor-versioning.md) | Pairwise comparison, competitor detection, version diff engine, cross-page consistency | ~250 |
| 11 | [11-safety-cost.md](11-safety-cost.md) | Safety classification, rate limits (browse + analysis), cost model, budget enforcement | ~250 |
| 12 | [12-review-gate.md](12-review-gate.md) | Dual-mode publishing (chatbot vs dashboard), finding lifecycle state machine, consultant UI | ~200 |
| 13 | [13-data-layer.md](13-data-layer.md) | PostgreSQL schema, R2 storage, Drizzle ORM, RLS, heuristic repo | ~250 |
| 14 | [14-delivery-layer.md](14-delivery-layer.md) | CRO Audit MCP Server, client dashboard, consultant dashboard | ~200 |
| 15 | [15-failure-modes.md](15-failure-modes.md) | 22 failure modes (12 browse + 10 analysis) with detection + response | ~200 |
| 16 | [16-implementation-phases.md](16-implementation-phases.md) | 12 phases, all artifacts with file paths, smoke tests, exit gates | ~500 |
| 17 | [17-context-preservation.md](17-context-preservation.md) | Engineering constitution, handover prompt, development workflow, repo structure | ~250 |
| 31 | [31-state-aware-analysis.md](31-state-aware-analysis.md) | Per-state + transition analysis scopes (**superseded by §33**) | ~350 |
| 32 | [32-interactive-analysis.md](32-interactive-analysis.md) | Browser tool injection during evaluate (**superseded by §33**) | ~280 |
| 33 | [33-agent-composition-model.md](33-agent-composition-model.md) | Agent Composition Model: tool injection, interactive CoT, dual-mode evaluation | ~500 |
| 33a | [33a-composition-integration.md](33a-composition-integration.md) | Per-phase integration plan for §33 interfaces | ~250 |

### Visual Diagrams

| # | File | Content |
|---|------|---------|
| 00 | [diagrams/system-architecture.html](diagrams/system-architecture.html) | Complete system: 5 layers + audit flow + browse ↔ analyze + data flow + review gate |
| 01 | [diagrams/phase-01-perception.html](diagrams/phase-01-perception.html) | Phase 1 artifacts, connections, exit gate |
| 02 | [diagrams/phase-02-tools.html](diagrams/phase-02-tools.html) | Phase 2 artifacts, connections, exit gate |
| 03 | [diagrams/phase-03-verification.html](diagrams/phase-03-verification.html) | Phase 3 artifacts, connections, exit gate |
| 04 | [diagrams/phase-04-safety.html](diagrams/phase-04-safety.html) | Phase 4 artifacts, connections, exit gate |
| 05 | [diagrams/phase-05-browse-mvp.html](diagrams/phase-05-browse-mvp.html) | Phase 5 artifacts, connections, exit gate |
| 06 | [diagrams/phase-06-heuristics.html](diagrams/phase-06-heuristics.html) | Phase 6 artifacts, connections, exit gate |
| 07 | [diagrams/phase-07-analysis.html](diagrams/phase-07-analysis.html) | Phase 7 artifacts, connections, exit gate |
| 08 | [diagrams/phase-08-orchestrator.html](diagrams/phase-08-orchestrator.html) | Phase 8 artifacts, connections, exit gate |
| 09 | [diagrams/phase-09-competitor.html](diagrams/phase-09-competitor.html) | Phase 9 artifacts, connections, exit gate |
| 10 | [diagrams/phase-10-client.html](diagrams/phase-10-client.html) | Phase 10 artifacts, connections, exit gate |
| 11 | [diagrams/phase-11-delivery.html](diagrams/phase-11-delivery.html) | Phase 11 artifacts, connections, exit gate |
| 12 | [diagrams/phase-12-production.html](diagrams/phase-12-production.html) | Phase 12 artifacts, connections, exit gate |

---

## Quick Reference

```
SYSTEM: AI CRO Audit Platform
MODES: Browse (navigate) + Analyze (evaluate)
LAYERS: 5 (Orchestration → Browser Agent → Analysis Engine → Data → Delivery)
TOOLS: 28 (23 browse + 5 analysis)
HEURISTICS: 60 (Baymard + Nielsen + Cialdini), 3 reliability tiers
PIPELINE: 5 steps (perceive → evaluate/CoT → self-critique → evidence ground → annotate)
GROUNDING RULES: 8 (GR-001 through GR-008)
FAILURE MODES: 22 (12 browse + 10 analysis)
PHASES: 12 (MVP at Phase 8, Production at Phase 12)
TECH: TypeScript, LangGraph.js, Playwright, PostgreSQL+pgvector, Hono, Next.js, BullMQ
COST: ~$350-600/mo (mostly LLM API)
TIMELINE: ~18 weeks to production
```

---

## How to Use This Architecture

### For Implementation (Claude Code + Spec Kit)

1. Start with `16-implementation-phases.md` — find the current phase
2. Read the relevant spec sections for that phase
3. Open the phase diagram for visual context
4. Each artifact has a file path, smoke test, and pass criteria
5. Use `17-context-preservation.md` handover prompt when starting new sessions

### For Review

1. Read `01-system-identity.md` for the big picture
2. Read `02-architecture-decisions.md` for the tech stack
3. Open `diagrams/system-architecture.html` for the visual
4. Deep-dive into specific sections as needed

### For Onboarding New Team Members

1. Read this README
2. Open the system architecture diagram
3. Read `01-system-identity.md`
4. Read `06-browse-mode.md` and `07-analyze-mode.md`
5. Read `16-implementation-phases.md` for current progress

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.0 | Mar 2026 | Browser agent spec (16 sections, custom tools) |
| v3.0 | Mar 2026 | MCP-native, formal REQ-IDs, confidence scoring |
| v3.1 | Mar 2026 | Merged v2.0 depth + v3.0 innovation + critical fixes |
| v4.0 | Apr 2026 | Added analysis mode (dual-mode concept) |
| v5.0 | Apr 2026 | Integrated system architecture (5 layers) |
| v5.1 | Apr 2026 | Added self-critique, heuristic loading, review gate, IP protection |
| Analysis v1.0 | Apr 2026 | Full analysis agent spec (5-step pipeline, 8 grounding rules) |
| **Final 1.0** | **Apr 2026** | **Unified architecture: all specs merged, tech stack locked, phase diagrams** |
