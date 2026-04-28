---
title: project-context
artifact_type: reference
status: approved
loadPolicy: load-on-demand
version: 1.0
updated: 2026-04-28
note: Single-file project context. Distilled from README + §01-§36 (35 active specs, 3 superseded skipped). Use this for fast onboarding and as cache between full-spec deep-dives.
---

# Neural — Project Context

## What it is

AI CRO audit platform for REO Digital. Automates expert-level CRO consulting. Audits websites, finds conversion-blockers, ranks them, hands off to consultants.

Not a Lighthouse clone. Not SEO. Not auth-page audits. Augments consultants — doesn't replace.

## Status

0% implemented. Master plan locked at v1.0 + extensions. 38 specs, 35 active. Architecture ready for Phase 1.

---

## Tech stack

| Layer | Tech |
|---|---|
| Lang | TypeScript 5.x, Node 22 |
| Monorepo | Turborepo + pnpm |
| Orchestration | LangGraph.js (inner) + Temporal (outer durable) |
| Browser | Playwright + stealth + ghost-cursor |
| LLM primary | Claude Sonnet 4 |
| LLM fallback | GPT-4o (deferred to v1.2) |
| DB | PostgreSQL 16 + pgvector |
| ORM | Drizzle |
| Cache/Queue | Redis (Upstash) + BullMQ |
| API | Hono + MCP SDK |
| Auth | Clerk |
| Storage | Cloudflare R2 |
| Frontend | Next.js 15 + shadcn/ui + Tailwind |
| Validation | Zod |
| Image | Sharp |
| PDF | Playwright `page.pdf()` |
| Logs | Pino |
| Tracing | LangSmith |
| Errors | Sentry |
| Email | Resend / Postmark |
| Tests | Vitest (unit) + Playwright Test (integration) |
| Deploy | Fly.io (API) + Vercel (dashboard) |

---

## Architecture in 4 parts

| Part | Sections | Scope | Phases |
|---|---|---|---|
| **A — Agent internals** | §01–§17 | Browser + analysis + heuristics + orchestrator + data + delivery | 1–8 (MVP) |
| **B — Platform extensions** | §18–§30 | Gateway, discovery, workflows, retrieval, two-store, repro, cost, durable, learning, hypothesis, analytics | 9–14 |
| **C — Agent composition** | §31, §32×2, §33, §33a | Tool injection between Browser and Analysis. §31 + §32×2 superseded by §33. | 10–14 (retrofits A) |
| **D — Cross-cutting** | §34–§37 | Observability, report gen, golden tests, **context capture** (§37 v3.0) | 12–16 + 4b |

---

## Three-tier orchestration

```
Tier 1 — Audit Orchestrator (Temporal, durable)
  ├── Tier 2a — Page Orchestrator (LangGraph, per page)
  │     browse → explore_states → deep_perceive → analyze → persist
  │
  ├── Tier 2b — Workflow Orchestrator (LangGraph, per funnel)
  │     step_1 → verify_transition → step_2 → ... → workflow_analyze
  │
  └── Tier 2c — Competitor (separate audit)
```

Tier 1 owns crash recovery + scheduling. Tier 2 owns per-task graphs. Sessions owned by orchestrator, not subgraphs.

---

## Two main agents

**Browser Agent (§06)** — reusable library
- 8 layers, 10 nodes, 23 tools
- 3 modes: A=$0 deterministic / B=~$0.10 guided / C=~$0.30 vision
- Loop: perceive → reason → act → verify
- AX-tree primary, screenshot fallback when AX-tree <10 nodes
- NOT CRO-specific — works for scraping, monitoring, data extraction

**Analysis Agent (§07)** — CRO domain expert
- 5-step pipeline: perceive → evaluate → self-critique → ground → annotate
- Static path = single-shot LLM call
- Interactive path (§33) = ReAct loop with tool injection (Phase 14)
- 8 grounding rules (GR-001 to GR-008) reject hallucinations deterministically

**Composition (§33)** — dependency injection, not merge
- Browser exposes 9 of 23 tools to Analysis evaluate node
- Plus 3 perception tools + 3 analysis output tools
- Same browser session shared
- Orchestrator owns lifecycle

---

## Key contracts (just names)

| Contract | Where | Used for |
|---|---|---|
| `AuditState` | §05 | Top-level state across all subgraphs (carries `context_profile_id` v3.0) |
| `AuditRequest` | §18 | Normalized trigger payload (v3.0: optional `intake` block with constraints) |
| `ContextProfile` | §37 | **v3.0 pre-perception artifact.** 5 dimensions (business / page / audience / traffic / goal+constraints) with `{value, source, confidence}` per field + `open_questions[]` |
| `PageStateModel` | §06 §6.6 | Browse-mode perception (v2.5: Shadow DOM + Portal + pseudo-element) |
| `AnalyzePerception` | §07 §7.9 + §7.9.2 | Rich CRO perception (~30 fields + v2.4 extensions) |
| `PerceptionBundle` | §07 §7.9.3 | **v2.5 envelope** wrapping AnalyzePerception + ElementGraph + state nodes + warnings + nondeterminism flags |
| `FusedElement` / `ElementGraph` | §07 §7.9.3 | Element fusion: DOM + AX + bbox + style + crop_url joined by stable `element_id` |
| `MultiStatePerception` | §20 | Per-state perception graph |
| `Heuristic`, `HeuristicExtended` | §09 | KB entry w/ tier + scope |
| `RawFinding` → `ReviewedFinding` → `GroundedFinding` | §07 | Pipeline stages |
| `WorkflowContext`, `WorkflowAnalyzer` | §21 | Funnel-level analysis |
| `Template`, `TemplateCluster` | §19 | Discovery output |
| `ReproducibilitySnapshot` | §25 | Pinned model + prompt + heuristic versions |
| `ToolRegistry`, `ToolContext`, `SafetyContext` | §33a | Composition interfaces |
| `EvaluateStrategy` | §33a | Static vs interactive strategy switch |
| `Hypothesis`, `TestPlan`, `Variation` | §29 | A/B test handoff |

---

## Three loops in the system

1. **Page loop** — for each page in queue, run browse + analyze
2. **Browse loop** — perceive → reason → act → verify until page stable
3. **Workflow step loop** — for each funnel step, navigate + verify + analyze
4. **(Phase 14)** Interactive evaluate loop — Analysis calls injected browser tools mid-evaluation

---

## Constitution — top invariants

1. Findings are hypotheses, not verdicts. 3-layer validation before client sees them.
2. Grounding is code, not LLM (GR-001 to GR-008 deterministic).
3. Never predict conversion impact (GR-006 absolute ban).
4. Heuristic content = IP. Never in API/dashboards/logs/traces. AES-256-GCM at rest.
5. Adapter pattern mandatory — no direct external imports outside boundaries.
6. Spec-driven dev. REQ-IDs in code. Spec drift = fix spec first.
7. `temperature=0` on evaluate / self_critique / evaluate_interactive. ≥90% finding overlap on 24h re-runs.
8. Test-driven. Smoke test first. No disabled tests. No editing tests to pass.

---

## 16 phases (one-liner each)

### Track A — MVP (Phases 1–8)
- **P1** Perception foundation. PageStateModel on 3 sites.
- **P2** MCP tools + human behavior. 28 tools + ToolRegistry (§33a prep).
- **P3** Verification + confidence. 9 verify strategies.
- **P4** Safety + data layer. SafetyContext + Postgres + LLM adapter.
- **P5** Browse mode MVP. 5-node browse graph end-to-end.
- **P6** Heuristic KB. 60 heuristics, 3 tiers, filtering.
- **P7** Analysis pipeline (static). EvaluateStrategy interface.
- **P8** Audit orchestrator + single-site audit. **◆ MVP MILESTONE ◆**

### Track B — Product (Phases 9–12)
- **P9** Competitor + versioning.
- **P10** Client mgmt + review gate. Multi-tenant.
- **P11** Delivery + report generation. MCP server + dashboards + PDF.
- **P12** Production. Docker + Fly + Vercel + Sentry. **◆ PRODUCT MILESTONE ◆**

### Track C — Master (Phases 13–16)
- **P13** Trigger gateway + discovery + state exploration + workflows.
- **P14** Agent composition + interactive evaluate. Retrofits §07.
- **P15** Durable orchestration + reproducibility + two-store + cost.
- **P16** Learning + heuristic evolution + hypothesis + analytics + observability + golden tests. **◆ MASTER MILESTONE ◆**

Total ~28 weeks. ~214 artifacts.

---

## Spec map (35 active)

### §01–§17 (Part A — Agent internals)
| § | Title | Purpose |
|---|---|---|
| 01 | System identity | What we build, scope, non-goals |
| 02 | Architecture decisions | 25 locked, 6 deferred, tech stack |
| 03 | 5-layer architecture | Delivery → Data → Analysis → Browse → Orchestration |
| 04 | Audit orchestrator | 3-tier, audit_setup → page_router → ... |
| 05 | Unified state | AuditState single-object across subgraphs |
| 06 | Browse mode | 8 layers, 10 nodes, 23 tools, 3 modes |
| 07 | Analyze mode | 5-step pipeline + 8 grounding rules |
| 08 | Tool manifest | 28 tools, MCP-compliant, ToolRegistry |
| 09 | Heuristic KB | Zod schema, tiers, filtering, IP-protected |
| 10 | Competitor + versioning | Pairwise comparison, version diff |
| 11 | Safety + cost | Classifier, rate limits, budget gates |
| 12 | Review gate | Dual-mode publish, finding lifecycle |
| 13 | Data layer | Postgres + RLS + Drizzle, append-only |
| 14 | Delivery | MCP server, client + consultant dashboards |
| 15 | Failure modes | 22 modes (12 browse + 10 analysis) |
| 16 | Implementation phases | 16 phases, 3 tracks (this file's source) |
| 17 | Context preservation | Constitution, repo layout, handover |

### §18–§30 (Part B — Platform extensions)
| § | Title | Purpose |
|---|---|---|
| 18 | Trigger gateway | Single entry — CLI/MCP/dashboard/scheduler → AuditRequest |
| 19 | Discovery + templates | Template-first, 7-stage, HDBSCAN clustering |
| 20 | State exploration | Pass 1 (heuristic-primed) + Pass 2 (auto-escalated) |
| 21 | Workflow orchestration | Funnel traversal + cross-step synthesis |
| 22 | Heuristic retrieval evolution | JSON → tagged → pgvector → learned |
| 23 | Findings engine extended | Atomic/page/template/workflow scopes, dedup, 4D scoring |
| 24 | Two-store pattern | Working store ↔ publish store (immutable client view) |
| 25 | Reproducibility | Snapshot per audit, ≥90% overlap on re-run |
| 26 | Cost + guardrails | Layered budgets, pre-flight estimation |
| 27 | Durable orchestration | Temporal wraps LangGraph for resume/retry |
| 28 | Learning service | Per-client heuristic calibration from consultant decisions |
| 29 | Hypothesis pipeline | Findings → hypotheses → test plans → variations |
| 30 | Analytics bindings | GA4 / Contentsquare / FullStory correlation |

### §33–§33a (Part C — Agent composition)
| § | Title | Purpose |
|---|---|---|
| 33 | Agent composition model | Tool injection pattern, dual-mode evaluation |
| 33a | Composition integration plan | Per-phase interface prep (Phase 2/4/5/7/8) |

### §34–§36 (Part D — Cross-cutting)
| § | Title | Purpose |
|---|---|---|
| 34 | Observability | 3-layer (Pino → audit_events → metrics), correlation IDs, alerting |
| 35 | Report generation | Exec summary + action plan + branded PDF |
| 36 | Golden test suite | Frozen input/output pairs, regression detection |

### Superseded (do not load)
- §31 state-aware-analysis → §33
- §32 collaborative-agent-protocol → §33 (rejected message-bus model)
- §32 interactive-analysis → §33

---

## Known gaps + deferred items

### Deferred to v1.x post-MVP
- OpenAI fallback adapter (v1.2)
- Heuristic encryption AES-256-GCM (v1.1, before first external pilot)
- Multi-model evaluation (different LLMs per node)
- Vector heuristic retrieval (Phase 16, when KB >500)
- Custom fine-tuned CRO model (after 1000+ findings)
- Multi-browser support (Firefox/WebKit)

### Deferred to Master track
- Interactive evaluate (Phase 14)
- Durable Temporal (Phase 15)
- Learning service (Phase 12+)
- Analytics bindings (Phase 15)
- Hypothesis pipeline (Phase 14)

### Perception schema gaps — CLOSED in v2.4 (Phase 1b + 5b)

Earlier coverage audit flagged 9 gaps. All absorbed into MVP scope as of 2026-04-28:

| Gap | Closed by | Phase |
|---|---|---|
| Pricing display block | §07 §7.9.2 `pricing` / T1B-001 | 1b |
| Click target sizing (Fitt's Law) | §07 §7.9.2 `clickTargets[]` / T1B-002 | 1b |
| Sticky element detection | §07 §7.9.2 `stickyElements[]` / T1B-003 | 1b |
| Popup quality — presence layer | §07 §7.9.2 `popups[]` / T1B-004 | 1b |
| Popup quality — behavior layer (timing, dismissibility, dark patterns) | §07 §7.9.2 + T5B-005/006/007 | 5b |
| Friction score (aggregate) | §07 §7.9.2 `frictionScore` / T1B-005 | 1b |
| Social proof depth | §07 §7.9.2 `socialProofDepth` / T1B-006 | 1b |
| Microcopy near CTAs (semantic tags) | §07 §7.9.2 `microcopy.nearCtaTags[]` / T1B-007 | 1b |
| Attention / visual saliency | §07 §7.9.2 `attention.dominantElement` / T1B-008 | 1b |
| Commerce block (stock / shipping / returns) | §07 §7.9.2 `commerce` / T1B-009 | 1b |
| Currency switcher detection | §07 §7.9.2 `metadata.currencySwitcher` / T1B-010 | 1b |
| Multi-viewport diff (desktop vs mobile) | §07 §7.9.2 + T5B-001 to T5B-004 | 5b |

**Remaining open gap:** Date format pattern detection (dd/mm vs mm/dd) — flagged in Module 3 of master checklist; not in v2.4 scope; deferred to v1.1.

**Timeline impact (v2.4):** MVP grew from 11 weeks → 14 weeks (+3 weeks for 1b + 5b). Total master timeline 28 → 31 weeks. Artifact count 119 → 140 in Track A.

### v2.5 — PerceptionBundle Envelope (Phase 1c + extended Phase 5b)

Adopted `docs/Improvement/perception_layer_spec.md` build-order items 1, 2, 6 + Shadow DOM / iframe / pseudo-element traversal + trigger taxonomy widening + cookie banner policy.

| Capability added | Where | Phase |
|---|---|---|
| Settle predicate (network idle + mutation stop + fonts + animations) | §07 §7.9.3 | 1c |
| Shadow DOM / Portal / pseudo-element traversal | §06 §6.6 v2.5 | 1c |
| iframe policy engine (descend checkout/chat, skip video/analytics) | §07 §7.9.3 | 1c |
| Hidden element capture with reason flag | §06 §6.6 v2.5 | 1c |
| ElementGraph + FusedElement (top 30 elements per state, stable element_id) | §07 §7.9.3 | 1c |
| Nondeterminism flags (Optimizely / VWO / Optimize / personalization) | §07 §7.9.3 | 1c |
| Warnings list (8 codes) | §07 §7.9.3 | 1c |
| PerceptionBundle envelope (immutable, wraps existing AnalyzePerception) | §07 §7.9.3 | 1c |
| Hover / scroll / time_delay / exit_intent / form_input triggers | §20 | 5b extended |
| Cookie banner policy (dismiss / preserve) | §11 + AuditRequest | 5b extended |
| robots.txt enforcement | §11 §11.1.1 | 4 extended |
| Hard-block real form submits | §11 §11.1.1 | 4 extended |
| State graph formal edges + delta classification | §20 + Phase 13 | 13 (master track) |

**Timeline impact (v2.5):** MVP 14w → 17w (+3w for 1c + extended 5b). Total master timeline 31w → 34w. Artifact count 140 → 162 in Track A; 235 → 262 across all tracks.

**Architectural invariant added:** Perception layer captures facts only — no CRO judgments, no prioritization, no content rewriting, no autonomous form submits, no auth attempts, no state-mutating retries. Codified in `constitution.md`.

### v3.0 — Context Capture Layer (Phase 4b + Phase 13b)

Adopted `docs/Improvement/context_capture_layer_spec.md` items 1-12 (must-inherit + should-inherit). New §37 spec. Pre-perception layer that captures intake, infers from URL + lightweight HTML, halts on blocking questions.

| Capability added | Where | Phase |
|---|---|---|
| `ContextProfile` formal contract (5 dimensions + provenance per field) | §37 §37.2 | 4b |
| Provenance per field: `{value, source, confidence}` | §37 | 4b |
| Open questions + blocking flag (halt audit until answered) | §37 §37.3 | 4b |
| Constraints capture (regulatory / accessibility / brand / technical) | §37 §37.1.5 + §18 AuditRequest intake | 4b |
| Pre-perception layer ordering (audit_setup invokes Context Capture FIRST) | §04 + §37 | 4b |
| URL + JSON-LD + CTA + pricing inference | §37 §37.4 | 4b |
| `context_profiles` table (append-only) | §13 | 4b |
| AuditRequest intake (`goal.primary_kpi` REQUIRED, regulatory non-empty for regulated verticals) | §18 + REQ-GATEWAY-INTAKE-001..002 | 4b |
| HeuristicLoader filters by ContextProfile.business + page + device | §09 extension | 4b |
| Awareness levels (Schwartz: unaware → most_aware) | §37 §37.1.3 | 13b |
| Message-match field per traffic source | §37 §37.1.4 | 13b |
| `is_indexed` (SEO vs paid landing distinction) | §37 §37.1.2 | 13b |
| Decision style (impulse / researched / committee / habitual) | §37 §37.1.3 | 13b |
| Geo + locale formal capture (regulatory binding: EU→GDPR, CA→CCPA, BR→LGPD) | §37 §37.1.4 | 13b |
| ContextProfile in ReproducibilitySnapshot | §25 + §37 §37.6 | 13b |
| Per-traffic-source awareness segmentation | §37 §37.1.3 | 13b |
| Dashboard intake form (replaces CLI prompt for non-CLI audits) | §14 + §37 | 13b |
| Heuristic weight modifiers (`base × business_mod × page_mod × goal_mod`) | §37 §37.5 | deferred (calibration data needed) |

**Timeline impact (v3.0):** MVP 17w → 19w (+2w for Phase 4b). Total master timeline 34w → 37w (+3w for Phase 4b + Phase 13b). Artifact count 162 → 177 in Track A; 262 → 286 across all tracks.

**Architectural invariant added (R25):** Context Capture Layer captures intake only — no perception, no heuristic judgments, no silent guessing, no skipping clarification when confidence is low, no mutating page state, no autonomous traffic assumptions. Codified in `constitution.md`.

**Two-track context capture:**

```
Phase 4b (MVP): items 1-6 (must-inherit)
   ↓
Phase 13b (master track): items 7-12 (quality multipliers)
   ↓
Items 13-17: deferred indefinitely until calibration data justifies revisit
```

### v3.1 — State Exploration Layer enhancements (Phase 13 extension)

Adopted `docs/Improvement/state_exploration_layer_spec.md` items 1-4 (must-inherit lean version). 80% of the spec was already absorbed via §20 + Phase 5b + Phase 13 baseline; v3.1 adds the correctness pieces master plan didn't address.

| Capability added | Where | Phase |
|---|---|---|
| Hybrid State Reset Strategy (reverse-action + reload+replay) | §20 §20.9.1 | 13 (v3.1) |
| Storage Restoration Between Branches (cookies + localStorage + sessionStorage) | §20 §20.9.2 | 13 (v3.1) |
| Nondeterministic State Detection (replay-sample + hash compare) | §20 §20.9.3 | 13 (v3.1) |
| State Exploration MUST NOT (R26) | Constitution R26 | One-time |

Items 5-10 from the spec (focus trigger, network mocking, multi-viewport state contract, auth state graphs, resource caps, granular destructive detection) deliberately skipped per Option A — already-good-enough or premature optimization.

**Timeline impact (v3.1):** MVP 19w (unchanged), master 37w → 38w (+1w in Phase 13).

**Architectural invariant added (R26):** State Exploration drives perception but does not edit it. No CRO judgments. No destructive actions. No form submits unless explicitly allowed. No following external links. No auth attempts. No payment submission. Codified in `constitution.md`.

### Architectural blind spots (acknowledged)
- Single point in time (no behavioral telemetry)
- No A/B test history awareness
- No analytics binding for hypothesis validation (until §30)
- No competitor pricing/positioning context (until §10)

### Never (research-excluded)
- Conversion impact prediction. WiserUI-Bench: <30% accuracy. Hard ban via GR-006.
- Authenticated page audits. Indefinite.

---

## Cost model

- Per audit: $15 hard cap
- Per page: $5 hard cap
- Per exploration pass: $0.50 (deferred post-MVP)
- Pre-call gate via `getTokenCount` estimate
- Every LLM call logged atomically to `llm_call_log`
- Per-client cost queryable via SQL

---

## Where to look

| Need | File |
|---|---|
| Project rules + workflow | `CLAUDE.md` |
| Engineering constitution | `docs/specs/mvp/constitution.md` |
| Product requirements | `docs/specs/mvp/PRD.md` |
| Master architecture index | `docs/specs/final-architecture/README.md` |
| Phase plan | `docs/specs/final-architecture/16-implementation-phases.md` |
| Per-section spec | `docs/specs/final-architecture/NN-*.md` (read by REQ-ID) |
| Browser agent canonical | `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` |
| Analysis agent canonical | `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` |
| Master checklist (coverage audit) | `docs/cro-master-checklist.md` |
| This context file | `docs/project-context.md` |

---

## Quick load order for new sessions

1. `CLAUDE.md` (workflow, guardrails)
2. This file (architecture in one shot)
3. `docs/specs/final-architecture/16-implementation-phases.md` (current phase)
4. Specific §NN file cited by current task

Skip the rest unless the REQ-ID points there.

---

## Versioning rules

- Specs versioned per Constitution R17 (lifecycle states): approved / superseded / draft / archived
- Phase plan in §16 v2.4 is canonical numbering. Do not reopen older schemes.
- Locked decisions stay locked (R22 — The Ratchet). New phases append (P17+), do not renumber.
- This context file: v1.0 = first consolidation, 2026-04-28.

---

**End of project-context.md.** Distilled from 35 spec files. ~3500 tokens. Reload before deep-dives.
