# Neural — Project Overview

> **One-stop reference** for what Neural is, where we are, how we got here, what we've built, and what's next. Updated 2026-05-14 (post Phase 3 merge to master).
>
> **For granular drill-down**, every section in this doc cites the authoritative source file. Open those when you need depth; this doc is the index.

---

## 1. What is Neural?

**Neural is an AI-powered Conversion Rate Optimization (CRO) audit platform built for REO Digital's consultancy practice.**

It augments senior CRO consultants by automating the most labor-intensive 95% of an audit: visiting client websites, perceiving structure + interactive elements, applying a private library of 30 expert heuristics, producing evidence-grounded findings, and delivering a consultant-ready PDF report.

**The shift:** a consultant's audit drops from **40–80 hours of manual work** to **~2 hours of review on top of Neural's output**.

Authoritative source: [`docs/specs/mvp/PRD.md`](specs/mvp/PRD.md) §1–§2 (vision, users, success criteria)

---

## 2. The problem we're solving

| Pain (today's reality) | Status quo |
|---|---|
| Time-to-deliver | 4–8 weeks per audit |
| Consultant hours per site | 40–80 hours |
| Price point | $10K–$50K per audit |
| Capacity ceiling | Linear in consultant hours — agencies can't scale without hiring |
| Consistency | Different consultants find different things on the same site |
| Evidence anchoring | Hard to systematically tie every recommendation to research-backed benchmarks |

**Why existing tools don't solve it:**

- **Lighthouse / PageSpeed:** performance + a11y checklist — not CRO insight
- **Hotjar / Mouseflow:** behavior data — but needs months of traffic data
- **Optimizely / VWO:** A/B testing — but needs hypotheses first (which IS the audit's job)
- **Generic AI summarizers:** hallucinate findings; can't cite evidence; no consultant trust

**Neural's bet:** LLMs can produce *grounded* findings when paired with a rigorous hallucination filter (10 deterministic grounding rules) + research-backed benchmarks (every heuristic carries a provenance block). Human expert stays in the loop — every finding is a hypothesis, not a verdict.

Authoritative source: [`docs/specs/mvp/PRD.md`](specs/mvp/PRD.md) §2.1 (problem statement)

---

## 3. Architecture at a glance

Five-layer stack, each delivered as a sequential phase:

```
┌──────────────────────────────────────────────────────────────┐
│  Browse Mode                                                  │
│  ────────────                                                 │
│  Layer 1 — Browser Perception                                 │
│    Playwright + accessibility tree + DOM filter + screenshots │
│    Outputs: PageStateModel (browser-action decisions)         │
│                                                               │
│  Layer 2 — MCP Tool Surface (29 tools)                       │
│    22 browser_* + 2 agent_* + 5 page_*                       │
│    Sole R9 adapter for @modelcontextprotocol/sdk             │
│                                                               │
│  Layer 3 — Verification & Confidence                          │
│    Every action: ActionContract → VerifyEngine → 3 strategies │
│    Multiplicative confidence decay (R4.4)                     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Analyze Mode                                                 │
│  ─────────────                                                │
│  Layer 4 — Safety + Cost + Infra                             │
│    PostgreSQL + RLS + LLM adapter + budget guard + R2 storage│
│                                                               │
│  Layer 5 — Analysis Pipeline                                  │
│    evaluate (Claude Sonnet 4, temp=0)                        │
│      → self_critique (separate persona — R5.6)               │
│      → ground (10 deterministic grounding rules)             │
│      → annotate (Sharp screenshot overlays)                  │
│      → store (append-only Postgres)                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Delivery                                                     │
│  ────────                                                     │
│  Branded PDF (Next.js HTML → Playwright page.pdf() → R2)     │
│  Consultant dashboard (Next.js 15 + Clerk + shadcn/ui)        │
│  4D scoring + Action Plan (4-quadrant effort×impact)          │
│  Cross-page pattern detection                                │
│  Email notifications (Resend)                                │
└──────────────────────────────────────────────────────────────┘
```

**Tech stack:** TypeScript 5.x · Node 22 LTS · Turborepo + pnpm · Zod 3.x · Playwright · LangGraph.js · MCP SDK · Claude Sonnet 4 · PostgreSQL 16 + pgvector · Drizzle · Redis + BullMQ · Hono · Next.js 15 · Clerk · Cloudflare R2 · Sharp · Pino · Vitest + Playwright Test · Fly.io + Vercel

Authoritative source: [`docs/specs/mvp/architecture.md`](specs/mvp/architecture.md) (5-layer stack, data contracts, file structure)

---

## 4. How we built it — spec-driven development

Neural is built under a **spec-first discipline**: every line of code traces back to a numbered acceptance criterion in a spec, every spec lives under a 26-rule constitution, and every phase ships through 6 gated stages.

### 4a. The Constitution — 26 non-negotiable rules

Every implementation decision is governed by [`docs/specs/mvp/constitution.md`](specs/mvp/constitution.md) R1–R26. Highlights:

| Rule | What it enforces |
|---|---|
| **R1** | Source-of-truth specs (when specs disagree → ASK, never invent) |
| **R2** | Zod-first at every external boundary |
| **R3** | TDD discipline — RED tests before GREEN impl |
| **R4.2** | Verify every browse action — never open-loop |
| **R4.4** | Multiplicative confidence decay only — additive math BANNED |
| **R5.3** | No conversion-rate predictions (preserves consultant judgment as the value layer) |
| **R5.6** | Separate-persona auditor + critic (evaluator and self-critic must be distinct LLM calls) |
| **R6** | Heuristic content is IP — never in logs / API / dashboards / PDF |
| **R7.4** | Append-only DB tables (no UPDATE/DELETE on audit_events, findings, llm_call_log) |
| **R9** | Adapter pattern — vendor SDKs imported in ONE file per package |
| **R10** | File ≤ 300 LOC, function ≤ 50 LOC, no `any`, no `console.log`, named exports |
| **R11.4** | Fix spec BEFORE implementing — never silently work around a spec defect |
| **R13** | Temperature=0 on evaluate / self_critique / evaluate_interactive |
| **R14** | Every LLM call logged with cost; per-client attribution queryable |
| **R17** | Artifact lifecycle states (draft → validated → approved → implemented → verified → superseded) |
| **R18** | Append-only delta blocks on every spec edit — never silent line removal |
| **R19** | Phase rollups + validation docs at every phase exit |
| **R20** | Impact analysis required before any shared-contract change |
| **R21** | Auto-generated spec-to-code traceability matrix |
| **R22** | Every new rule must cite a specific past failure or research source ("The Ratchet") |
| **R23** | Pre-task kill criteria — every task declares its own STOP conditions |

### 4b. Progressive disclosure — never load everything

The spec corpus is **15 phase folders** + 35-section final architecture + PRD + constitution. We **never** load all of it. Pattern (per [`CLAUDE.md`](../CLAUDE.md) §1):

1. Load `CLAUDE.md` (this is automatic)
2. Load `phases/INDEX.md` (decision table)
3. Identify the active phase
4. Load **only** that phase's folder
5. For deeper context: load the predecessor phase's `phase-<N-1>-current.md` rollup (compressed system state) — NOT the full predecessor spec corpus

This keeps every task's context budget under ~20K tokens (PRD §10.7).

### 4c. Per-phase artifact structure

Every phase ships under [`docs/specs/mvp/phases/phase-<N>-<name>/`](specs/mvp/phases/INDEX.md) with this canonical file set:

```
phase-<N>-<name>/
├── README.md                  # phase entry point
├── spec.md                    # acceptance criteria (AC-NN) + functional reqs (R-NN)
├── plan.md                    # technical context + design + project structure
├── tasks.md                   # 10-30 atomic tasks (T-NN) — each maps to ≥1 AC
├── impact.md                  # required when ≥1 shared contract changes (R20)
├── checklists/requirements.md # quality gate before /speckit.analyze
├── review-notes.md            # R17.4 gate record (Gate 1 + Gate 2 narratives)
├── phase-<N>-current.md       # R19 rollup (created at Stage 4 exit)
└── phase-<N>-validation.md    # R19 sibling — 5 ASCII proof sections (Stage 4)
```

Authoritative source: [`docs/specs/mvp/README.md`](specs/mvp/README.md) (full document map)

---

## 5. The Master Orchestrator — AI-driven phase implementation

We built our own orchestration skill, [`neural-master-orchestrator`](.claude/skills/neural-master-orchestrator/SKILL.md), that drives each phase through **4 automated stages + 2 human gates** per phase with ~2 minutes of human-stamp work per phase.

### 5a. The 4 stages + 2 gates

```
  /master <N> --start
        │
        ▼
  ┌─────────────────────────────────────────┐
  │ Stage 1 — Pre-flight                    │
  │   /speckit.analyze + pnpm spec:matrix   │
  │   R20 impact.md presence check          │
  └─────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────┐
  │ Stage 1b — AI Reviewer                  │
  │   neural-ai-reviewer skill              │
  │   • Correctness (analyze synthesis)     │
  │   • Coverage (matrix synthesis)         │
  │   • Completeness (auditor + critic R5.6)│
  └─────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────┐
  │ 🚦 GATE 1 — human stamp (1 min)         │
  │   APPROVE / REVISE / RE-SPEC            │
  └─────────────────────────────────────────┘
        │ (REVISE → patch wave → re-run Stage 1 → Pass 2; loops until APPROVE clean)
        ▼
  ┌─────────────────────────────────────────┐
  │ Stage 2 — Implementation                │
  │   Task classifier partitions tasks into │
  │   parallel / sequential / shared-contract│
  │   Subagent fan-out per CLAUDE.md §9     │
  │   /speckit.implement per task           │
  │   Per-task commit (CLAUDE.md §6 format) │
  └─────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────┐
  │ Stage 2.5 — Code Review                 │
  │   superpowers:code-reviewer agent       │
  │   on full impl diff vs plan + spec      │
  └─────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────┐
  │ Stage 3 — Verification                  │
  │   pnpm typecheck + test + integration   │
  │   + conformance + lint                  │
  └─────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────┐
  │ Stage 3b — AI Reviewer (Gate 2 verdict) │
  │   Re-runs correctness/coverage/         │
  │   completeness against shipped code     │
  └─────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────┐
  │ 🚦 GATE 2 — human stamp (1 min)         │
  │   APPROVE / RETURN-TO-IMPL              │
  └─────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────┐
  │ Stage 4 — Exit                          │
  │   R17 bumps (approved → verified)       │
  │   R19 phase-<N>-current.md rollup       │
  │   R19 phase-<N>-validation.md sibling   │
  │   INDEX.md row 🟡 → 🟢                  │
  │   Branch push + PR creation             │
  └─────────────────────────────────────────┘
        │
        ▼
   Phase N complete; ready for Phase N+1 boot
```

### 5b. AI Reviewer with adversarial self-critique (R5.6 applied to review)

The [`neural-ai-reviewer`](.claude/skills/neural-ai-reviewer/SKILL.md) skill runs **two passes** at each gate:

1. **Pass 1 — Collaborative auditor:** enumerates categorical surfaces (e.g., "what's the universe of failure classes?") + identifies coverage gaps + scopes implementation against spec
2. **Pass 2 — Adversarial critic:** sees ONLY the auditor's output (not the original spec) + actively tries to FIND FAULT — challenges enumerations, demands citations, probes for hallucinations

Strictest verdict wins. False negatives at gates cost hours of mid-impl confusion; false positives cost ~5 min of patch wave.

### 5c. Fix-all-spec-defects policy (Session 19 supersession — 2026-05-13)

Originally, the orchestrator's policy was "CRITICAL/HIGH block; MED/LOW never block." Empirically, deferred MED/LOW findings accumulated comprehension debt and forced mid-impl R11.4 patches.

**Today's policy:** CRITICAL / HIGH / MED / LOW-spec-defects all block at gates. Only LOW tooling-quirks + pure-cosmetics defer. This means **every Gate APPROVE = literally zero blocking findings.**

Tradeoff: gates run ~1.3 passes on average (most phases need one ridealong patch wave), but mid-impl friction drops sharply.

### 5d. Subagent dispatch policy (CLAUDE.md §9)

Tasks within a phase fall into three buckets:

| Bucket | Dispatch | Example |
|---|---|---|
| `parallel` | Single message with N concurrent `Agent` tool calls | T053 + T054 + T055 (3 independent strategy files) |
| `sequential` | One subagent at a time | T051 → T052 (both modify same `types.ts` file) |
| `shared-contract` | One at a time + diff reviewer in strict mode + R20 impact.md update required per task | (none in Phase 3; would apply to e.g. AnalyzePerception schema changes) |

Authoritative source: [`.claude/skills/neural-master-orchestrator/`](.claude/skills/neural-master-orchestrator/) (full state machine + references)

---

## 6. Where we are today (2026-05-14)

### 6a. Phase tracker

| Phase | Scope | Status | Tests |
|---|---|---|---|
| 0 | Workspace + scaffolding | 🟢 done | 5 ACs |
| 0b | 30 private heuristics authored + verified | 🟢 done | 18 conformance |
| 1 | Browser perception foundation | 🟢 done | 10 ACs |
| 1b | Perception extensions (10 extractors) | 🟢 done | 13 ACs |
| 1c | PerceptionBundle envelope v2.5 | 🟢 done | 12 ACs |
| 2 | 29 MCP tools | 🟢 done | 13 ACs |
| **3** | **Verification & confidence (thin)** | **🟢 done (today)** | **9 ACs** |
| 4 | Safety + Infra + Cost | ⚪ **next** | — |
| 4b | Context capture layer | ⚪ | — |
| 5 | Browse MVP (LangGraph) | ⚪ | — |
| 5b | Multi-viewport + triggers + cookies | ⚪ | — |
| 6 | Heuristic KB engine | ⚪ | — |
| 7 | Analysis pipeline | ⚪ | — |
| 8 | Orchestrator + cross-page patterns | ⚪ | — |
| 9 | Foundations + delivery (PDF, dashboard, scoring) | ⚪ ★ MVP ship gate | — |

**7 of 15 phases done = 47% spec → code translation complete.**

### 6b. What works end-to-end today

```bash
pnpm cro:audit --url=https://www.peregrineclothing.co.uk/...  # exits 0 in <30s
```

This produces `out/<slug>-audit.txt` + `out/<slug>-findings.json` via stub heuristics flowing through the real perception + MCP + verification pipeline. Phase 5 will swap stubs for real LLM-driven analysis.

### 6c. Aggregate metrics

| Metric | Value |
|---|---|
| Commits to master since 2026-04-22 | 195+ (Phase 3 PR #8 merged) |
| agent-core tests passing | **574 / 574** (89 test files; 0 failures) |
| Playwright acceptance tests passing | **12 / 12** |
| Test coverage trajectory | +81 tests in Phase 3; zero regression across all prior phases |
| MCP tools shipped | **29** (22 browser_* + 2 agent_* + 5 page_*) |
| Shared contracts ratified | **15+** (locked enums; R20-gated) |
| Total cost spent on phases 0–3 | ~$30 LLM spend (vs $60/phase ceiling) |

### 6d. Constitutional invariants verified intact on master

✅ **R4.4** multiplicative confidence decay — first concrete code-level enforcement landed in Phase 3 ConfidenceScorer + source-grep conformance test
✅ **R9** adapter pattern — Playwright in `BrowserManager.ts` only; MCP SDK in `mcp/Server.ts` only; zero leakage verified at every commit
✅ **R6** heuristic IP isolation — 4 redaction channels; 5-channel conformance test asserts zero body leakage
✅ **R3.1** TDD — every phase ships RED tests FIRST (e.g., T-PHASE3-TESTS at commit `eca726d` before any T051 impl)
✅ **R17** lifecycle — every artifact tracks `status: draft → approved → verified`; phase rollups capture compressed system state
✅ **R18** append-only delta — every spec edit adds a delta block citing what changed and why
✅ **R20** impact analysis — every shared-contract addition has an impact.md before code is written

Authoritative source: [`.phase-state/<N>.json`](.phase-state/) for per-phase audit trail · [`docs/specs/mvp/phases/INDEX.md`](specs/mvp/phases/INDEX.md) for canonical phase tracker

---

## 7. Approaches we've taken (engineering bets)

### 7a. Real-LLM all the way (no mocks in MVP)

Per [`docs/specs/mvp/testing-strategy.md`](specs/mvp/testing-strategy.md) §9.5, MVP tests hit real Claude Sonnet 4 — not stubs. Mocked LLMs masked production divergence in past projects. Cost governance: $15 hard cap per audit; pre-call budget guard estimates tokens before invocation.

### 7b. Grounding-as-deterministic-code (not LLM-as-judge)

Every Phase-7 finding flows through **10 grounding rules** (GR-001..GR-012, with GR-010/011 deferred) implemented in plain code — `element_exists`, `element_visible`, `element_interactive`, `banned_phrase_check` (R5.3 enforcement), `benchmark_validation`, etc. If grounding rejects, the finding never reaches the report.

This is the **hallucination filter**. It's why we can trust LLM-produced CRO findings.

### 7c. Two-store + warm-up pattern (consultant gates client-visible content)

Per F-016 / F-019, new clients get **3 warm-up audits** where every finding is held for consultant review. Only after consultant rejection rate stabilizes < 25% does the system auto-publish for that client. Defends against early-pilot reputation risk.

### 7d. Reproducibility snapshots per audit (R10 + R13)

Every audit creates an immutable `reproducibility_snapshots` row pinning:
- Model version (e.g., `claude-sonnet-4-20250514`)
- Temperature = 0
- Prompt hashes (SHA-256 of every prompt template)
- Heuristic versions (which 30 heuristics + their commit SHAs)

This means: 6 months from now, we can regenerate any past audit bit-for-bit and validate that downstream changes didn't drift quality.

### 7e. Comprehension-debt pacing (PRD §10.10)

Each subagent task is scoped to fit a **<20K-token context budget**. Larger features split into multiple atomic tasks per phase. This prevents "wide-context fatigue" where the implementer's reasoning quality degrades on complex multi-concern PRs.

### 7f. Forward-compat seams

Every enum or strategy registry is **locked at MVP scope + v1.1 reserved slots**. Example: Phase 3's `VerifyStrategyName` has 9 entries (3 MVP + 6 reserved); `VerifyEngine.register()` has no MVP whitelist — v1.1 implementations plug in without engine code change. R20-gated; new names require impact.md cycle.

### 7g. Phase-scoped impact analysis (R20)

Before any shared-contract addition / modification, an `impact.md` is authored declaring:
- Affected contracts + risk level (LOW/MEDIUM/HIGH)
- Downstream consumer phases
- Forward Contract section (what Phase N+1 will import)
- Breaking: true/false (additive vs migration-required)

Downstream phase pre-flights are auto-invalidated when an upstream contract changes.

Authoritative source: [`docs/specs/mvp/PRD.md`](specs/mvp/PRD.md) §11 (boundaries) + §12 (workflow) + §15 (risks)

---

## 8. Roadmap

### 8a. MVP completion sequence (current target: 12 weeks total from 2026-04-22)

| Week | Phase(s) | Deliverable |
|---|---|---|
| 1 | 0, 0b + walking-skeleton stub | End-to-end pipeline with stubs (DONE) |
| 2 | 1 | Browser perception foundation (DONE) |
| 3 | 1b, 1c, 4 partial | Perception extensions + Safety infra start |
| 4 | 0b content + 6 (heuristic KB) | 30 heuristics + KB engine wiring |
| 5 | 2 + 3 | MCP tools + verification (DONE) |
| 6 | 4b | Context capture layer |
| 7 | 7 (analysis pipeline) | Real Claude evaluate + grounding |
| 8 | 5 (Browse MVP) | LangGraph orchestration |
| 9 | 8 (Orchestrator) + 5b | Cross-page patterns + multi-viewport |
| 10–12 | 9 (Delivery) | PDF + dashboard + scoring + notifications |

### 8b. Gates before first external pilot

After Phase 9 ships:

1. **AES-256-GCM at-rest encryption** on heuristic repo (R6.2 v1.1 hardening — required before any external pilot)
2. **3 of 3 REO consultants** self-serve audits without engineering help (PRD §2.4)
3. **≥ 3 real client audits shipped** in pilot (PRD §2.4)
4. **Consultant rejection rate < 30%** (false-positive proxy)
5. **System uptime ≥ 95%** during pilot

### 8c. Post-MVP v1.1 (already enum-reserved in spec)

- 6 advanced verify strategies (network_request, no_error_banner, snapshot_diff, custom_js, no_captcha, no_bot_block)
- Stealth plugin + ghost-cursor (replaces default Playwright)
- GPT-4o failover for LLM redundancy
- Full 100 heuristics (up from 30 MVP)
- NavigationCrawlDiscovery (replaces Sitemap+Manual-only)

### 8d. Post-MVP v1.2+ competitive moat

- **Agent composition / interactive evaluate** (§33) — the differentiator
- Mobile viewport auditing
- State exploration (multi-state PDP / checkout flows)
- LLM-driven cross-page funnel analysis
- Webhook notifications
- Operational admin dashboard

Authoritative sources:
- [`docs/specs/mvp/implementation-roadmap.md`](specs/mvp/implementation-roadmap.md) (12-week walking-skeleton plan)
- [`docs/specs/mvp/phases/INDEX.md`](specs/mvp/phases/INDEX.md) (phase decision table)

---

## 9. Cost + cadence so far

| Metric | Value |
|---|---|
| Days elapsed | 22 (2026-04-22 → 2026-05-14) |
| Phases completed | 7 of 15 |
| LLM spend on dev | ~$30 cumulative across phases 0–3 |
| Per-phase ceiling | $60 user-approved |
| Headroom | ~50% of ceiling unspent per phase typically |
| Wall-clock per phase (recent) | 2–4 hours (Phase 3 was 4 hours end-to-end) |
| Sessions per phase | 1–3 (Phase 3 = 1 session including 3-pass Gate 1) |
| Subagents per phase | 5–12 typically |
| Tests added per phase | 30–80 |
| Regression count across all phases | **ZERO** |

---

## 10. Where to look for granular detail

| Question | File |
|---|---|
| What's the canonical product vision? | [`docs/specs/mvp/PRD.md`](specs/mvp/PRD.md) |
| What are the 26 engineering rules? | [`docs/specs/mvp/constitution.md`](specs/mvp/constitution.md) |
| What's the 5-layer architecture? | [`docs/specs/mvp/architecture.md`](specs/mvp/architecture.md) |
| How do I pick up where the last session left off? | [`docs/specs/mvp/sessions/session-handover.md`](specs/mvp/sessions/session-handover.md) |
| Which phase am I on? | [`docs/specs/mvp/phases/INDEX.md`](specs/mvp/phases/INDEX.md) |
| What's the test strategy? | [`docs/specs/mvp/testing-strategy.md`](specs/mvp/testing-strategy.md) |
| What are the risks? | [`docs/specs/mvp/risks.md`](specs/mvp/risks.md) |
| What's the spec-driven workflow? | [`docs/specs/mvp/spec-driven-workflow.md`](specs/mvp/spec-driven-workflow.md) |
| What's the 12-week plan? | [`docs/specs/mvp/implementation-roadmap.md`](specs/mvp/implementation-roadmap.md) |
| What's the daily operating protocol for Claude Code? | [`CLAUDE.md`](../CLAUDE.md) |
| How does the master orchestrator work? | [`.claude/skills/neural-master-orchestrator/SKILL.md`](../.claude/skills/neural-master-orchestrator/SKILL.md) |
| How does the AI Reviewer work? | [`.claude/skills/neural-ai-reviewer/SKILL.md`](../.claude/skills/neural-ai-reviewer/SKILL.md) |
| What's the current state of any phase? | `.phase-state/<N>.json` (gitignored; per-session state ledger) |
| What was the last rollup written? | `docs/specs/mvp/phases/phase-<N>-*/phase-<N>-current.md` (R19 rollup) |

---

## 11. Browser agent + analysis agent canonical specs

These are the deep-dive technical specs the implementation traces back to:

- [`docs/specs/AI_Browser_Agent_Architecture_v3.1.md`](specs/AI_Browser_Agent_Architecture_v3.1.md) — canonical browse-mode spec (29 MCP tools, perception, verification)
- [`docs/specs/AI_Analysis_Agent_Architecture_v1.0.md`](specs/AI_Analysis_Agent_Architecture_v1.0.md) — canonical analyze-mode spec (evaluate/critique/ground/annotate)
- [`docs/specs/final-architecture/`](specs/final-architecture/) — 35-section detailed final architecture (per-task REQ-ID anchors)

---

*Last updated: 2026-05-14 after Phase 3 (Verification & Confidence — thin) merged to master at `e76f33c`. See `docs/specs/mvp/sessions/session-handover.md` for the rolling current state.*
