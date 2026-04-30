---
title: Neural MVP — Index + Reading Order
artifact_type: index
status: approved
version: 2.1
created: 2026-04-07
updated: 2026-05-01
owner: engineering lead
authors: [REO Digital team, Claude]

supersedes: v2.0 (2026-05-01 Round 1 full rewrite); v1.0 (2026-04-07 pre-Session 3)
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md v1.2.1
  - docs/specs/mvp/constitution.md v1.3 (R1-R26)
  - docs/specs/mvp/phases/INDEX.md v1.5
  - docs/specs/mvp/implementation-roadmap.md v0.3
  - docs/specs/mvp/sessions/session-2026-04-30-handover.md (Session 6 closeout)

req_ids: []

impact_analysis: null
breaking: false
affected_contracts: []

delta:
  v2_1:
    new:
      - "## Session bootstrap (kickoff prompt)" section added — copy-paste-ready prompt for new Claude sessions starting Phase N implementation work; consolidates Tier 2-5 reading guidance + standing directives into one discoverable block
    changed:
      - Frontmatter `derived_from` versions bumped to reflect Round 4 sync (PRD v1.2.1, constitution v1.3, INDEX v1.5)
    impacted:
      - phases/INDEX.md v1.5 changelog (Round 5 entry added)
    unchanged:
      - All other sections (Reading order, Document map, MVP scope, DoD, How to use, File structure, Timeline, Source of truth, Maintenance)
  v2_0:
    new:
      - Full rewrite (v1.0 → v2.0); document map updated to current corpus structure
      - Per-phase folder pattern documented as the canonical spec/plan/tasks location (replaces stale root-level Spec Kit artifact model)
      - 15-phase scope (was 8); MVP heuristic target 30 (was 100; F-012 v1.2 amendment 2026-04-26)
      - Walking-skeleton 12-week timeline + Wednesday demo cadence (was 8-11 weeks linear)
      - Sibling docs extracted from PRD listed (architecture / testing-strategy / risks / spec-driven-workflow)
      - DoD command corrected to `--urls ./urls.txt --business-type ecommerce`
      - Reading order matched to CLAUDE.md §1 (auto-loaded each session)
      - Constitution rule range R1-R26 (was R1-R16 implicit)
      - Status reflects 2026-05-01 — Phase 0 + 0b + 1 approved per R17.4
    changed: []
    impacted:
      - CLAUDE.md §1 reading order (Round 1 sync companion edit)
    unchanged: []

governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates)

description: "Entry point + document map for the Neural MVP corpus. Lists every file at the MVP root, every subfolder, the per-phase artifact pattern, the implementation reading order, and the source-of-truth pointers. Read FIRST before working in this corpus."
---

# Neural MVP — Index + Reading Order

> **Project:** Neural — AI CRO Audit Platform
> **Company:** REO Digital (Indian digital agency, single-tenant pilot)
> **Status (2026-05-01):** Spec corpus COMPLETE (15/15 phase folders shipped). Phase 0 + Phase 0b + Phase 1 **approved for implementation** per R17.4. Phases 1b → 9 in `status: draft`. **0% code written.**
> **Method:** Spec-Driven Development (SDD) with GitHub Spec Kit + per-phase artifact lifecycle (Constitution R17)
> **Read FIRST.** This file is the entry point. CLAUDE.md (auto-loaded) points here.

---

## Reading order

| # | File | Notes |
|---|---|---|
| 1 | This file (`README.md`) | Document map + corpus overview |
| 2 | `CLAUDE.md` (repo root) | Auto-loaded on session start; reading order, tech stack, code style, git workflow, self-check, sub-agent policy |
| 3 | [`constitution.md`](constitution.md) | 26 non-negotiable engineering rules (R1-R26). Auto-synced to `.specify/memory/constitution.md` |
| 4 | [`PRD.md`](PRD.md) | Product requirements (F-001..F-021, NF-001..NF-010), boundaries (§10), domain (§11) |
| 5 | [`phases/INDEX.md`](phases/INDEX.md) | Phase decision table — identify active phase by depends-on / blocks columns |
| 6 | `phases/phase-<N>-<name>/{README,spec,plan,tasks}.md` | **Per-phase artifacts — the only spec/plan/tasks in the corpus.** Load only the active phase, never all 15 at once |
| 7 | `phases/phase-<N-1>-<name>/phase-<N-1>-current.md` | Predecessor phase rollup (R19) — read INSTEAD OF the predecessor's full artifacts |
| 8 | Cited architecture spec in `docs/specs/final-architecture/` | Open only the section cited by the task's REQ-ID |

---

## Document map — `docs/specs/mvp/`

### Root files

| File | Purpose | Read when |
|---|---|---|
| [README.md](README.md) | This file — entry point + document map | First |
| [constitution.md](constitution.md) | R1-R26 non-negotiable engineering rules | Before any task |
| [PRD.md](PRD.md) | Canonical product requirements; F-001..F-021 + NF-001..NF-010; boundaries; domain | To understand scope, requirements, or boundaries |
| [architecture.md](architecture.md) | Five-layer stack, pipeline flow, data contracts, tech stack, project structure map *(extracted from PRD §6 on 2026-04-24)* | When implementing across layers; before Phase 4 (DB) |
| [tasks-v2.md](tasks-v2.md) | Canonical 263-task master plan catalog (v2.3.3) | When picking up a task; for REQ-ID traceability |
| [examples.md](examples.md) | Sample AuditRequest, Findings, BAD-finding patterns, style guide | Implementing grounding rules, findings, reports |
| [testing-strategy.md](testing-strategy.md) | Philosophy, stack, coverage, phase exit criteria, conformance matrix (18 rows), real-LLM policy *(extracted from PRD §9 on 2026-04-24)* | Before writing tests; per §8 self-check |
| [risks.md](risks.md) | Risk register (10 ranked), lethal-trifecta contingencies, fallback protocols *(extracted from PRD §15 on 2026-04-24)* | At incident triage; before phase reviews |
| [spec-driven-workflow.md](spec-driven-workflow.md) | R17-R21 lifecycle / delta / rollup / impact / matrix workflow *(extracted from PRD §12 on 2026-04-24)* | When updating specs, generating rollups, preparing PRs |
| [implementation-roadmap.md](implementation-roadmap.md) | **Walking-skeleton 12-week vertical-slicing plan** with Wednesday demo cadence; week 1 ships stubbed end-to-end pipeline | Always — gives weekly slice context for any task |
| [implementation-roadmap-visual.md](implementation-roadmap-visual.md) | Markdown companion (ASCII matrix + Mermaid timeline + flow + tracker) | Visual orientation |
| [implementation-roadmap.html](implementation-roadmap.html) | Browser-tracker UI with localStorage progress (per-user, **NOT canonical** — canonical state is in phase folders + INDEX.md) | Personal progress tracking |

### Subfolders

| Folder | Purpose |
|---|---|
| [phases/](phases/) | **15 per-phase folders** (0, 0b, 1, 1b, 1c, 2, 3, 4, 4b, 5, 5b, 6, 7, 8, 9). Each: `README.md`, `spec.md`, `plan.md`, `tasks.md`, `impact.md` (when shared contracts touched per R20), `checklists/`, plus `review-notes.md` once R17.4-reviewed and `phase-N-current.md` rollup once Phase N+1 begins. Plus [INDEX.md](phases/INDEX.md) — phase decision table. |
| [templates/](templates/) | `frontmatter-lifecycle.template.md`, `impact.template.md`, `phase-rollup.template.md`, `system-current.template.md`, `spec-to-code-matrix.template.md`, `conformance-test-templates.md`, **`phase-review-prompt.md`** + **`phase-review-report.template.md`** (centralized R17.4 review system per CLAUDE.md §8d) |
| [scripts/](scripts/) | 6 stub scripts (`spec:matrix`, `spec:rollup`, `spec:size`, `spec:validate`, `spec:index`, `spec:pack`) enforcing R17-R21. **All stubs in MVP** — full implementations land in Phase 9. Until then: hand-edit + manual discipline. |
| [sessions/](sessions/) | Per-session handover notes (e.g., `session-2026-04-30-handover.md`). **Optional** — read on demand when picking up where a prior session left off. Not required for routine task work. |

### Source-of-truth specs (outside `docs/specs/mvp/`)

| File | Purpose |
|---|---|
| `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` | Canonical browser agent spec |
| `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` | Canonical analysis agent spec |
| `docs/specs/final-architecture/` | 35 active spec files (§01-§30 + §33 + §33a + §34-§36); §31 + §32 superseded — **do not load** |
| `docs/PROJECT_BRIEF.md` | 28-section strategic brief (LLM analysis input; **NOT operational**) |
| `docs/master-architecture-checklist.md` | 20-section coverage verification |
| `docs/engineering-practices/code-style.md` | Naming, TypeScript patterns, error handling, adapter pattern, Pino logging |
| `docs/engineering-practices/git-workflow.md` | Branch naming, commit format, pre-commit checklist, PR policy |

---

## MVP scope

### Phases (15 — all spec-shipped)

| Phase | Name | Tasks | Risk | R17.4 status (2026-05-01) |
|---|---|---|---|---|
| **0** | Setup | M0.1-M0.5 (T001-T005) | LOW | approved |
| **0b** | Heuristic Authoring (LLM-assisted, engineering-owned) | T0B-001..T0B-005 + T103-T105 | LOW | approved |
| **1** | Browser Perception Foundation | M1.1-M1.10 (T006-T015) | MEDIUM | approved |
| **1b** | Perception Extensions v2.4 | T1B-001..T1B-012 | MEDIUM | draft |
| **1c** | PerceptionBundle Envelope v2.5 | T1C-001..T1C-012 | MEDIUM | draft |
| **2** | MCP Tools (subset) | M2.1-M2.20 (T016-T050) | MEDIUM | draft |
| **3** | Verification (thin) | M3.1-M3.8 (T053-T055 MVP; T056-T061 v1.1) | LOW | draft |
| **4** | Safety + Infrastructure + Cost | M4.1-M4.20 (T066-T076 + T080 + T080a) | MEDIUM | draft |
| **4b** | Context Capture Layer v1.0 | T4B-001..T4B-015 | MEDIUM | draft |
| **5** | Browse MVP | M5.1-M5.8 (T081-T100) | MEDIUM | draft |
| **5b** | Multi-Viewport + Trigger Taxonomy + Cookie Policy | T5B-001..T5B-019 | MEDIUM | draft |
| **6** | Heuristic KB Engine | M6.1-M6.11 (T101, T102, T106-T112) | MEDIUM | draft |
| **7** | Analysis Pipeline | M7.1-M7.22 (T113-T134) | **HIGH** | draft |
| **8** | Orchestrator + Cross-Page | M8.1-M8.21 (T135-T155) | **HIGH** | draft |
| **9** | Foundations + Delivery — ★ MVP COMPLETE ★ | T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261 (35) | **HIGH** | draft |

**Implementation order:** 0 → 0b → 1 → 1b → 1c → 2 → 3 → 4 → 4b → 5 → 5b → 6 → 7 → 8 → 9. See [phases/INDEX.md](phases/INDEX.md) for the full decision table with dependencies + blockers.

**R17 implementation status legend (in [phases/INDEX.md](phases/INDEX.md)):** ⚪ not started · 🟡 in progress · 🟢 complete · 🔴 blocked

### Out of scope (deferred)

- Multi-tenant SaaS — single-agency (REO Digital) pilot only in MVP
- Competitor analysis, version tracking / re-audit comparison
- Self-serve product — consultant-operated only
- Authenticated-page audits — deferred indefinitely
- GA4 / analytics integration — page content + structure only
- AES-256-GCM at-rest heuristic encryption — **v1.1, REQUIRED before first external pilot** (PRD §3.2)
- Stealth plugin (`playwright-extra-plugin-stealth`) — v1.1
- GPT-4o LLMAdapter failover — v1.2 (MVP is Claude-only)
- Full 250+ heuristic library — MVP ships **30** (15 universal + 10 ecommerce + 5 lead-gen per F-012 v1.2); expansion in v1.1+
- Full client dashboard self-service, scheduled audits, webhook notifications — v1.1+
- Phase 10 state exploration, Phase 11 MCP write tools, Phase 12 mobile master, Phase 13 scheduler — post-MVP

---

## MVP Definition of Done

When this command runs end-to-end successfully:

```bash
pnpm cro:audit --urls ./urls.txt --business-type ecommerce --output ./out
```

The MVP is complete when:

1. **Functional:** 5-page audit completes; outputs JSON findings + annotated PNG screenshots + branded PDF report
2. **Quality:** Unit + integration tests pass; conformance matrix (18 rows) green
3. **Cost:** 5-page audit costs **< $5** in LLM calls (per-audit hard cap $15)
4. **Time:** 5-page audit completes in **< 15 minutes**
5. **Anti-hallucination:** ≥ 1 finding rejected by self-critique or grounding per audit (proves the filters work)
6. **Annotation:** Screenshots have visible numbered pins for findings
7. **Verification:** 100% of browse actions have a verification result
8. **Phase 9 acceptance gates:** AC-21 (T175) + AC-26 (PDF) + AC-30 (email) + AC-36 (R6 channels 3+4 redaction) all green

After Phase 9 ships → MVP is shippable for **first external pilot** (with v1.1 R6.2 AES-256-GCM at-rest hardening added BEFORE the pilot per PRD §3.2).

---

## Session bootstrap (kickoff prompt)

When opening a new Claude Code session for implementation work, paste this prompt verbatim. It consolidates Tier 2-5 reading guidance + every standing directive — copy-paste-ready, no editing required (just substitute the active phase if not Phase 0).

````
Start Neural MVP implementation. Begin at Phase 0 (Setup) per phases/INDEX.md v1.5.

PROJECT ORIENTATION (read first):
- docs/specs/mvp/README.md v2.1 (entry point + document map; this prompt lives here)
- docs/specs/mvp/constitution.md v1.3 (R1-R26 — non-negotiable)
- docs/specs/mvp/phases/INDEX.md v1.5 (phase decision table; current status)
- docs/specs/mvp/PRD.md v1.2.1 §1, §2.4, §10, §11 (vision, success criteria, ALWAYS/ASK FIRST/NEVER boundaries + PR Contract + Spec Coverage, domain) — NOT full PRD
- docs/specs/mvp/implementation-roadmap.md v0.3 (walking-skeleton 12-week plan; Wednesday demo cadence)
- Latest docs/specs/mvp/sessions/ handover (last session state + binding conditions)

ACTIVE PHASE (load when starting):
- docs/specs/mvp/phases/phase-0-setup/{README,spec,plan,tasks}.md
- For Phase N+1 later: read phases/phase-<N>-current.md rollup INSTEAD of predecessor's full artifacts (R19)

PER TASK (PRD §10.7 — one task per prompt, <20K tokens):
- Single task definition from active phase tasks.md
- Cited architecture spec section from docs/specs/final-architecture/ — only the cited section
- Relevant examples.md section if a pattern exists

ON-DEMAND (load when triggered):
- architecture.md — implementing across layers
- testing-strategy.md — writing tests / conformance gate
- risks.md — incident triage
- spec-driven-workflow.md v1.1 — updating specs / R17.4 review / generating rollup
- engineering-practices/code-style.md or git-workflow.md — TS pattern / commit format
- AI_Browser_Agent_Architecture_v3.1.md — Browse mode work
- AI_Analysis_Agent_Architecture_v1.0.md — Analyze mode work
- templates/<template>.md — authoring impact / rollup / review-notes
- tasks-v2.md v2.3.3 — REQ-ID spot-lookup (NOT full read)

STANDING DIRECTIVES:
- neural-dev-workflow skill for implementation (NOT /speckit.implement) — operationalizes R22-R23 + PRD §10.9 PR Contract
- speckit-* skills for spec authoring only (per-phase folders under phases/, not root)
- TodoWrite for multi-step task tracking
- §8 self-check before commit (CLAUDE.md): re-read AC → 11-step verification → mark - [ ] → - [x] in phase tasks.md → commit format `<type>(<scope>): <TaskID> <desc> (<REQ-ID>)`
- pnpm lint && pnpm typecheck && pnpm test before every commit
- PR body MUST include Spec Coverage section per PRD §10.6
- R20 impact.md REQUIRED for any task touching shared contracts (AnalyzePerception, PageStateModel, AuditState, Finding, adapter interfaces, DB schema, MCP tool interfaces, grounding rule interfaces)
- R23 kill criteria REQUIRED for tasks > 2 hr OR shared-contract changes OR subagent dispatch OR LLM budget > $0.50
- Walking-skeleton: stubs in real file paths from week 1; de-stub in place per implementation-roadmap.md v0.3
- Wednesday demo cadence (Mon: pin URLs + author script; Tue: dry-run; Wed: 30-min demo + feedback log)
- R17.4 review gate before phase impl: /speckit.analyze → resolve CRITICAL/HIGH → phase review (templates/phase-review-prompt.md) → APPROVE → bump status: draft → approved
- Per-phase JIT analyze: NEVER bulk-analyze across phases (CLAUDE.md §8c)
- Heuristic IP boundary (R6): heuristic content NEVER in API responses, dashboards, logs, LangSmith traces, git-committed test fixtures
- temperature=0 on evaluate / self_critique / evaluate_interactive (R10/R13 + TemperatureGuard adapter; R22.6 codification deferred to constitution v1.4)
- Phase 0b binding conditions D1 + D2 (T0B-004 + T0B-005 implementers; D3 optional) — see latest session handover

IMPLEMENTATION ORDER (canonical):
0 → 0b → 1 → 1b → 1c → 2 → 3 → 4 → 4b → 5 → 5b → 6 → 7 → 8 → 9

LIFECYCLE STATUS (2026-05-01):
- Phase 0 + 0b + 1: status: approved (R17.4 reviewed; Phase 6 R17.4 pending)
- Phases 1b through 9 (excl 0b/1): status: draft — must run /speckit.analyze + phase review before bumping to approved
- Implementation: 0% — no code yet

★ MVP COMPLETE ★ when Phase 9 ships (T175 + AC-21 + AC-26 + AC-30 + AC-36 green) → MVP shippable for first external pilot, with v1.1 R6.2 AES-256-GCM at-rest heuristic hardening landing BEFORE pilot per PRD §3.2.
````

**Constitution-load note:** `constitution.md` v1.3 is ~16K tokens loaded in full. It's "always-load" per CLAUDE.md but in narrow per-task prompts (where it competes with cited specs against the <20K budget), JIT discipline says load only the rules you'll cite. Keep the full load for session orientation; per-task it's a reference.

---

## How to use this corpus with Claude Code

### Initial setup (one-time)

```bash
git clone <your-repo-url> neural-nba
cd neural-nba
claude
```

`CLAUDE.md` is auto-loaded on session start. It points at this README, the constitution, the PRD, and the phase decision table.

### Per-task workflow

1. Open [phases/INDEX.md](phases/INDEX.md), find the active phase row
2. Read `phases/phase-<N>-<name>/README.md` (~150 tokens) for phase context
3. Open `phases/phase-<N>-<name>/{spec,plan,tasks}.md` and pick the first unchecked task
4. Use the **`neural-dev-workflow` skill** (NOT `/speckit.implement`) for implementation. The skill operationalizes Constitution R22-R23 (Ratchet + Kill criteria) and PRD §10.9 PR Contract.
5. Run the §8 self-check (CLAUDE.md) before commit; mark `- [ ] → - [x]` in the phase's `tasks.md`; commit per CLAUDE.md §6 format
6. PR body includes Spec Coverage section per PRD §10.6

### Spec authoring (when changes are needed)

Use the `speckit-*` skills (`/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.analyze`, `/speckit.clarify`, `/speckit.checklist`, `/speckit.constitution`). These operate on **per-phase** artifacts under `phases/phase-<N>-<name>/`, not root-level files.

Run `/speckit.analyze` per phase **before** bumping `status: draft → approved` (CLAUDE.md §8c JIT pattern). **Never bulk-analyze across phases** — earlier phases may force changes that ripple.

### Phase review gate (R17.4 — `validated → approved`)

Before bumping `status: draft → approved` on a phase:

1. `/speckit.analyze` on the target phase (mechanical consistency)
2. Resolve CRITICAL/HIGH findings
3. Phase review using [templates/phase-review-prompt.md](templates/phase-review-prompt.md) — judgment (doom check, design soundness, kill criteria realism)
4. Recommendation: **APPROVE** / **REVISE** / **RE-SPEC**. APPROVE → bump status (per CLAUDE.md §8c + §8d).

### When things go wrong

- **Drift from spec:** re-read cited REQ-IDs in the canonical architecture spec; compare implementation; fix
- **Spec is unclear:** ASK FIRST per Constitution R1.4 — never invent
- **Tests fail:** use `superpowers:systematic-debugging` skill; never disable tests; never edit tests to fit buggy code
- **Cross-spec conflict:** Constitution R1.4 — ASK
- **Need a finding example:** [examples.md](examples.md) §8 (BAD findings caught by self-critique)

---

## File structure (built by implementation)

After all 263 tasks complete, the repo will look like (per CLAUDE.md §4):

```
neural-nba/
├── apps/
│   ├── cli/                      # pnpm cro:audit entry point
│   └── dashboard/                # Next.js 15 consultant dashboard
├── packages/
│   └── agent-core/               # Core library (TypeScript)
│       └── src/
│           ├── browser-runtime/  # BrowserManager, OverlayDismisser, RateLimiter
│           ├── perception/       # PageStateModel extractors (AX-tree, filters, mutation)
│           ├── mcp/              # MCP server + 12 tools + ToolRegistry
│           ├── safety/           # ActionClassifier, DomainPolicy, NavigationGuard
│           ├── verification/     # 3 verify strategies (MVP) + VerifyEngine
│           ├── analysis/         # nodes/, grounding/, scoring/, heuristics/, personas/, cross-page/, quality/, strategies/
│           ├── orchestration/    # AuditState, AuditGraph, nodes
│           ├── gateway/          # AuditRequest, GatewayService, DiscoveryStrategy
│           ├── reproducibility/  # SnapshotBuilder, TemperatureGuard
│           ├── storage/          # AccessModeMiddleware, TwoStore
│           ├── review/           # WarmupManager
│           ├── delivery/         # ExecutiveSummaryGenerator, ActionPlanGenerator, ReportGenerator
│           ├── observability/    # Pino, EventEmitter
│           ├── adapters/         # LLMAdapter, StorageAdapter, ScreenshotStorage, BrowserEngine, HeuristicLoader, NotificationAdapter
│           └── db/               # Drizzle schema + migrations
├── heuristics-repo/              # Private; 30 heuristics (MVP). Not encrypted until v1.1
├── docs/                         # Specs + PRD + plans (this corpus)
├── test/
│   ├── fixtures/                 # Cached pages for offline tests (v1.2)
│   └── acceptance/               # Playwright Test — Phase 8 + 9 acceptance
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Timeline (12-week walking skeleton)

Per [implementation-roadmap.md](implementation-roadmap.md) v0.3:

| Week | Slice milestone | First time |
|---|---|---|
| 1 | End-to-end stubbed pipeline (T-SKELETON-001..010 in real file paths) | `pnpm cro:audit` runs |
| 2-4 | Phase 0 + 0b + 1 + 2 implementation overlaying skeleton | Real perception extraction |
| 5 | Phase 4 + early Phase 7 — first real Claude evaluate call | Real LLM evaluate (temp=0) |
| 6 | Phase 6 + Phase 7 grounding | First grounded finding |
| 7 | Phase 7 self-critique + scoring | First finding rejected by anti-hallucination |
| 8 | Phase 3 + Phase 5 + Phase 8 — multi-page audit | Multi-page coordination |
| 9-11 | Phase 5b multi-viewport + triggers + cookie + Phase 1b/1c extensions | Mobile viewport + trigger taxonomy |
| 10 | Phase 9 PDF generation | Branded PDF report |
| 12 | Phase 9 acceptance — T175 + AC-21 + AC-26 + AC-30 + AC-36 | ★ MVP COMPLETE ★ |

**Demo cadence:** every Wednesday (Mon: pin URLs + author script; Tue: dry-run + capture screenshots; Wed: 30-min demo + post-feedback log).

After MVP ships, v1.1 R6.2 AES-256-GCM at-rest heuristic hardening lands BEFORE first external pilot.

---

## Source of truth

| Topic | Authoritative file |
|---|---|
| Engineering rules | [`constitution.md`](constitution.md) (R1-R26) |
| Product requirements | [`PRD.md`](PRD.md) (F-001..F-021 + NF-001..NF-010) |
| Architecture | [`architecture.md`](architecture.md) + `docs/specs/final-architecture/§01-§36 + §33a` |
| Browse mode (any node, tool, behavior) | `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` |
| Analyze mode (pipeline, grounding rules) | `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` |
| Master task plan | [`tasks-v2.md`](tasks-v2.md) (v2.3.3 — 263 tasks) |
| Per-phase tasks (canonical for impl) | `phases/phase-<N>-<name>/tasks.md` |
| Tech stack decisions | [`architecture.md`](architecture.md) §6.4 |
| Examples + BAD-finding patterns | [`examples.md`](examples.md) |
| Risks + fallback protocols | [`risks.md`](risks.md) |
| Testing strategy + conformance | [`testing-strategy.md`](testing-strategy.md) |
| Spec-driven workflow + lifecycle | [`spec-driven-workflow.md`](spec-driven-workflow.md) |

When in doubt: **ASK FIRST** per Constitution R1.4. Do not pick between conflicting specs arbitrarily.

---

## Maintenance

This README is hand-edited until `pnpm spec:index` lands (Phase 9). Bump `version` in frontmatter + add a `delta:` block on every change per Constitution R18.
