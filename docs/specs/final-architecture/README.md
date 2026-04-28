---
title: Final Architecture — Directory Manifest
artifact_type: index
status: approved
loadPolicy: on-demand-only
version: 2.4
updated: 2026-04-28
governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R22 (The Ratchet)
note: Reference-material directory manifest for 38 source-of-truth architecture specs. Do NOT load by default (CLAUDE.md Tier 3). Load only the specific §NN-<name>.md file cited by the current task's REQ-IDs.
---

# AI CRO Audit System — Final Production Architecture

## REO Digital / Neural Product Team — April 2026

**Version:** 1.0 (Final) + Master Extensions v1.0 + Composition v1.0
**Status:** Architecture Lock — Ready for Implementation
**Implementation method:** Claude Code + GitHub Spec Kit
**Build approach:** Spec-Driven Development (SDD)

---

## Architecture Layering

This folder contains **four architectural layers**. Read in this order for full context, or jump to a specific section by REQ-ID.

| Part | Sections | Scope | Implementation Phases |
|------|----------|-------|----------------------|
| **A — Agent Internals** | §01–§17 | Browser agent (v3.1), analysis pipeline (v1.0), heuristic KB, audit orchestrator, data layer, delivery layer. Research-grounded and implementation-ready. | Phases 1–8 (MVP scope) |
| **B — Platform Extensions** | §18–§30 | Trigger gateway, discovery & templates, state exploration, workflow orchestration, heuristic retrieval evolution, findings engine, two-store pattern, reproducibility, cost architecture, durable orchestration, learning service, hypothesis pipeline, analytics bindings. | Phases 9–14 |
| **C — Agent Composition** | §31, §32×2, §33, §33a | Tool injection from Browser Agent into Analysis Agent's evaluate loop. §31 and the two §32 files are **superseded by §33**; §33a is the per-phase integration plan. | Phases 10–13 (retrofits A) |
| **D — Cross-Cutting** | §34–§37 + §20 v3.1 | Observability, report generation, golden test suite, context capture layer (v3.0), state exploration enhancements (v3.1: hybrid reset + storage restore + nondeterminism). Touches every layer. | Phases 4b, 12–16 |

**Source-of-truth files** (`AI_Browser_Agent_Architecture_v3.1.md`, `AI_Analysis_Agent_Architecture_v1.0.md`) live one level up at `docs/specs/` and remain canonical research provenance — they are inlined into §06 and §07 respectively. The v1.0 analysis pipeline is the **static fallback path**; the default path under the master architecture is `evaluate_interactive` per §33.

**Improvement specs** (`docs/Improvement/perception_layer_spec.md`, `docs/Improvement/context_capture_layer_spec.md`) are external designs adopted into the master plan as §06 §6.6 v2.5 / §07 §7.9.3 (perception) and §37 (context capture).

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ **approved** | Live spec. Read this. |
| 🔁 **superseded** | Retained for history. Follow `supersededBy` pointer. Do NOT implement from this. |
| 🟡 **draft** | Work-in-progress. Load only when explicitly told. |
| ⚫ **archived** | Frozen reference. Not for implementation. |

Per Constitution R17, every spec carries `status:` in its YAML frontmatter. Per Constitution R19, when picking up Phase N work, read the predecessor phase's rollup FIRST.

---

## Document Map — Specification Files (39 total)

### Part A — Agent Internals (§01–§17)

| # | File | Content | Status |
|---|------|---------|--------|
| 01 | [01-system-identity.md](01-system-identity.md) | What we're building, research principles, reality check | ✅ approved |
| 02 | [02-architecture-decisions.md](02-architecture-decisions.md) | 25 locked decisions, 6 deferred, complete tech stack | ✅ approved |
| 03 | [03-architecture-layers.md](03-architecture-layers.md) | 5-layer system architecture, interface contracts (REQ-LAYER-005 revised by §33) | ✅ approved |
| 04 | [04-orchestration.md](04-orchestration.md) | Audit orchestrator graph, dual-mode switching, routing functions (subgraph integration extended by §33) | ✅ approved |
| 05 | [05-unified-state.md](05-unified-state.md) | AuditState schema (extends BrowseState + AnalysisState), invariants (composition state extensions in §33) | ✅ approved |
| 06 | [06-browse-mode.md](06-browse-mode.md) | Full v3.1 browser agent: 8 layers, 10 nodes, 23 tools, perception, verification, safety. Source of truth: `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` | ✅ approved |
| 07 | [07-analyze-mode.md](07-analyze-mode.md) | 5-step pipeline: perceive → evaluate → self-critique → ground → annotate. Static path; §33 adds interactive evaluate. Source of truth: `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` | ✅ approved |
| 08 | [08-tool-manifest.md](08-tool-manifest.md) | Unified 28-tool manifest with TypeScript interfaces (tool injection matrix in §33) | ✅ approved |
| 09 | [09-heuristic-kb.md](09-heuristic-kb.md) | Heuristic schema, 3 tiers, filtering logic, IP protection, loading strategy (dual-mode integration in §33) | ✅ approved |
| 10 | [10-competitor-versioning.md](10-competitor-versioning.md) | Pairwise comparison, competitor detection, version diff engine, cross-page consistency | ✅ approved |
| 11 | [11-safety-cost.md](11-safety-cost.md) | Safety classification, rate limits, cost model, budget enforcement (composition cost model in §33) | ✅ approved |
| 12 | [12-review-gate.md](12-review-gate.md) | Dual-mode publishing, finding lifecycle state machine, consultant UI | ✅ approved |
| 13 | [13-data-layer.md](13-data-layer.md) | PostgreSQL schema, R2 storage, Drizzle ORM, RLS, heuristic repo | ✅ approved |
| 14 | [14-delivery-layer.md](14-delivery-layer.md) | CRO Audit MCP Server, client dashboard, consultant dashboard | ✅ approved |
| 15 | [15-failure-modes.md](15-failure-modes.md) | 22 failure modes (12 browse + 10 analysis) with detection + response | ✅ approved |
| 16 | [16-implementation-phases.md](16-implementation-phases.md) | Master phase plan covering Parts A+B+C+D | ✅ approved |
| 17 | [17-context-preservation.md](17-context-preservation.md) | Engineering constitution, handover prompt, development workflow, repo structure | ✅ approved |

### Part B — Platform Extensions (§18–§30)

| # | File | Content | Status |
|---|------|---------|--------|
| 18 | [18-trigger-gateway.md](18-trigger-gateway.md) | Single entry point that normalizes CLI / MCP / dashboard / scheduler triggers into AuditRequest | ✅ approved |
| 19 | [19-discovery-and-templates.md](19-discovery-and-templates.md) | Sitemap parsing, page-template clustering, funnel synthesis | ✅ approved |
| 20 | [20-state-exploration.md](20-state-exploration.md) | Explore interactive states (tabs, accordions, filters) before analysis | ✅ approved |
| 21 | [21-workflow-orchestration.md](21-workflow-orchestration.md) | Tier 2b orchestrator for funnel traversal + cross-step synthesis | ✅ approved |
| 22 | [22-heuristic-retrieval-evolution.md](22-heuristic-retrieval-evolution.md) | Vector retrieval, dynamic heuristic selection, evolution pipeline | ✅ approved |
| 23 | [23-findings-engine-extended.md](23-findings-engine-extended.md) | Extended findings engine: workflow-scoped, cross-page, longitudinal | ✅ approved |
| 24 | [24-two-store-pattern.md](24-two-store-pattern.md) | Working store + publish store separation for live vs. published findings | ✅ approved |
| 25 | [25-reproducibility.md](25-reproducibility.md) | Reproducibility snapshots, prompt hashing, model pinning | ✅ approved |
| 26 | [26-cost-and-guardrails.md](26-cost-and-guardrails.md) | Cost model, budget enforcement, per-client attribution | ✅ approved |
| 27 | [27-durable-orchestration.md](27-durable-orchestration.md) | Tier 1 Temporal layer for resume, retry, long-running audits | ✅ approved |
| 28 | [28-learning-service.md](28-learning-service.md) | Per-client learning loop, pattern extraction, heuristic feedback | ✅ approved |
| 29 | [29-hypothesis-pipeline.md](29-hypothesis-pipeline.md) | Hypothesis generation, prioritization, A/B test handoff | ✅ approved |
| 30 | [30-analytics-bindings.md](30-analytics-bindings.md) | GA4 / Mixpanel / Amplitude binding for finding validation | ✅ approved |

### Part C — Agent Composition (§31–§33a)

| # | File | Content | Status |
|---|------|---------|--------|
| 31 | [31-state-aware-analysis.md](31-state-aware-analysis.md) | Per-state + transition analysis scopes (early draft) | 🔁 **superseded by §33** |
| 32a | [32-collaborative-agent-protocol.md](32-collaborative-agent-protocol.md) | Evidence-request protocol between Analysis ↔ Browse ↔ Web (original §32 draft) | 🔁 **superseded by §33** |
| 32b | [32-interactive-analysis.md](32-interactive-analysis.md) | Browser tool injection during evaluate, ReAct loop (revised §32 draft) | 🔁 **superseded by §33** |
| 33 | [33-agent-composition-model.md](33-agent-composition-model.md) | **Live spec.** Agent Composition Model: tool injection, interactive CoT, dual-mode evaluation. Supersedes §31 and both §32 files. | ✅ approved |
| 33a | [33a-composition-integration.md](33a-composition-integration.md) | Per-phase integration plan for §33 interfaces | ✅ approved |

> **Note on the §32 numbering collision:** Two files share the §32 number because the section was rewritten before §33 absorbed both. They are listed as `32a` (collaborative protocol — original) and `32b` (interactive analysis — revision) for disambiguation. Both are superseded; do not implement from either.

### Part D — Cross-Cutting (§34–§37)

| # | File | Content | Status |
|---|------|---------|--------|
| 34 | [34-observability.md](34-observability.md) | Pino logging, LangSmith tracing, event emission, correlation IDs | ✅ approved |
| 35 | [35-report-generation.md](35-report-generation.md) | Executive summary generator, action plan generator, PDF report composition | ✅ approved |
| 36 | [36-golden-test-suite.md](36-golden-test-suite.md) | Golden fixtures, regression detection, acceptance test harness | ✅ approved |
| 37 | [37-context-capture-layer.md](37-context-capture-layer.md) | **v3.0 / Phase 4b.** Pre-perception context intake — 5 dimensions (business / page / audience / traffic / goal+constraints) with `{value, source, confidence}` per field + `open_questions[]` clarification loop | ✅ approved |

---

## Visual Diagrams

| File | Content | Status |
|------|---------|--------|
| [diagrams/master-architecture.html](diagrams/master-architecture.html) | Live master architecture diagram: 5 layers + audit flow + browse ↔ analyze + composition | ✅ live |
| [diagrams/demo-lifecycle-guide.md](diagrams/demo-lifecycle-guide.md) | Walkthrough guide for demo audiences | ✅ live |
| `diagrams/archive/*.html` | 7 historical diagrams (master + MVP overviews, agent interaction, data flow, phase dependency, execution loop, demo walkthrough) | ⚫ archived |

> Earlier per-phase HTML diagrams (`phase-01-perception.html` … `phase-12-production.html`) referenced by older revisions of this README never made it onto disk. The single `master-architecture.html` supersedes that intent.

---

## Quick Reference

```
SYSTEM:          AI CRO Audit Platform
MODES:           Browse (navigate) + Analyze (evaluate, static or interactive via §33)
LAYERS:          5 (Orchestration → Browser Agent → Analysis Engine → Data → Delivery)
ORCHESTRATOR:    3 tiers (Audit / Page / Workflow), Temporal-durable at Tier 1
TOOLS:           28 (23 browse + 5 analysis) + 9 injected into Analysis evaluate via §33
HEURISTICS:      60 (Baymard + Nielsen + Cialdini), 3 reliability tiers
PIPELINE:        5 steps (perceive → evaluate/CoT → self-critique → evidence ground → annotate)
GROUNDING RULES: 8 (GR-001 through GR-008), 10 active in MVP
FAILURE MODES:   22 (12 browse + 10 analysis)
PHASES:          16 main + 4 sub-phases (1b, 1c, 4b, 5b, 13b) — MVP completes at Phase 8, full master architecture at Phase 16
TECH:            TypeScript, LangGraph.js, Temporal, Playwright, PostgreSQL+pgvector, Hono, Next.js, BullMQ
COST:            ~$350-600/mo (mostly LLM API)
TIMELINE:        ~19 weeks to MVP (with v3.0 Context Capture), ~38 weeks to full master architecture (with v3.1 State Exploration enhancements)
```

---

## How to Use This Architecture

### For Implementation (Claude Code + Spec Kit)

1. Open `16-implementation-phases.md` — find the current phase
2. Read only the spec sections cited by that phase's REQ-IDs
3. For analyze-mode work after Phase 10, read §33 BEFORE §07 (composition supersedes the static pipeline)
4. Each artifact has a file path, smoke test, and pass criteria
5. Use `17-context-preservation.md` handover prompt when starting new sessions

### For Review

1. Read `01-system-identity.md` for the big picture
2. Read `02-architecture-decisions.md` for the tech stack
3. Open `diagrams/master-architecture.html` for the visual
4. Deep-dive into specific sections by REQ-ID

### For Onboarding New Team Members

1. Read this README in full
2. Open the master architecture diagram
3. Read `01-system-identity.md`
4. Read `06-browse-mode.md` and `07-analyze-mode.md`
5. Read `33-agent-composition-model.md` to see how the two compose
6. Read `16-implementation-phases.md` for current progress

---

## Reading Order Rule (Constitution R17)

| If a spec is... | Then... |
|---|---|
| `approved` / `validated` | Load when cited |
| `superseded` | Do NOT load. Follow `supersededBy:` pointer. |
| `draft` | Load only if explicitly told |
| `archived` | Reference only, never implement from |

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
| Final 1.0 | Apr 2026 | Unified architecture: all specs merged, tech stack locked, phase diagrams |
| Master Ext. v1.0 | Apr 2026 | Added §18–§30 platform extensions |
| Composition v1.0 | Apr 2026 | Added §33 + §33a; §31, §32a, §32b superseded |
| **README v2.4** | **Apr 2026** | **Full directory manifest: all 38 specs catalogued with status. Stale phase-NN diagram references removed.** |
