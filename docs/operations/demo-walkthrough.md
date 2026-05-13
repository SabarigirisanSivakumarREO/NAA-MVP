# Neural — Visual Demo Walkthrough

> **Audience:** Mixed — technical leadership, non-technical agency partners, future contractors.
> **Goal:** In ~10 minutes, demonstrate what Phases 0 + 0b + 1 + 1b + 1c + 2 deliver, and how AI was orchestrated to build them with engineering discipline.
> **Format:** Live commands you can copy-paste during a meeting or screencast.

---

## Pre-flight (do once before the demo)

```powershell
# 1. Open a PowerShell terminal at the repo root
cd C:\Sabari\Neural\NBA

# 2. Fix UTF-8 rendering (em-dashes show as "ΓÇö" otherwise)
chcp 65001

# 3. Verify the workspace is healthy (~45s)
pnpm typecheck
# Expected: "Tasks: 3 successful, 3 total"

# 4. (Optional, for screencast) Resize the terminal to ~120 cols wide
```

---

## Demo 1 — The visual flagship (★ start here)

**What it shows:** Phase 0b + Phase 1 + Phase 2 all exercised against a live D2C product page, with **visible Chromium** so the audience watches the agent work.

```powershell
pnpm demo
```

That's it — one command, ~10 seconds, real browser opens, real page analyzed.

**Default URL:** Peregrine Clothing heavyweight T-shirt PDP (`https://www.peregrineclothing.co.uk/.../heavyweight-t-shirt?colour=Navy`). Custom via `pnpm demo --url=<any>`.

**What you'll see on screen:**

1. **Banner** — "Neural Phase 0b + 1 + 2 Visual Demo"
2. **Phase 0b section** — "30 CRO heuristics loaded · baymard 15 · cialdini 5 · nielsen 10"
3. **Phase 1 section** — Chromium window pops up, navigates to Peregrine, captures perception:
   - Page title: "Heavyweight T-Shirt – Peregrine Clothing" (real)
   - AX-tree nodes: ~391 (real DOM)
   - Top-30 filtered DOM: 30 (the high-relevance nodes the LLM will see)
   - Mutations observed: ~540 (real React rehydration noise)
   - Page stable: ✓ yes
4. **Phase 2 section** — page_analyze tool fires:
   - **Inferred page type: product_detail_page** (the AI classified it correctly)
   - **5 CTAs detected**, sample contrast **21:1 (WCAG PASS)** (real button colors)
   - 16 forms, 3 iframes (all closed-enum `other`)
   - 100 tab-order entries (keyboard accessibility coverage)
   - 2 schema.org blocks (e-commerce structured data)
   - Performance TTFB **43ms** (real network)
   - **F-S4 namespace contract: ✓ honored (_extensions absent)**
   - **F-S13 IframePurpose enum: ✓ honored (all closed-enum)**
5. **Phase 2 bonus** — three more MCP tools fire:
   - `browser_get_metadata` → URL + title
   - `page_get_performance` → LCP / TTFB / CLS / INP partition
   - `page_screenshot_full` → full-page JPEG saved (e.g., 1280×4607, 397KB)
6. **Summary** — "Total wall-clock: 7.8s. Phases exercised: 0b · 1 · 2"

**Artifacts produced in `./out/demo/`:**

- `heuristics-summary.txt` — Phase 0b enumeration (no IP exposure per R6)
- `page-state-model.json` — Phase 1 PageStateModel (real DOM perception)
- `analyze-perception-v2.3.json` — Phase 2 full AnalyzePerception (CTAs, forms, perf, etc.)
- `*.jpg` — Phase 2 page_screenshot_full (full-page stitched)

**Show those files mid-demo:**

```powershell
# Quick artifact tour for technical viewers
ls out/demo/
cat out/demo/heuristics-summary.txt
notepad out/demo/analyze-perception-v2.3.json    # or VS Code; the JSON is rich
start out/demo/*.jpg                              # opens the screenshot in default viewer
```

---

## Demo 2 — The test discipline proof

**What it shows:** 493 tests across 81 test files pass in ~45s with zero regression. Proves the engineering discipline behind the code.

```powershell
# Full suite (high signal in 45s)
pnpm test

# Or individual high-impact slices:
pnpm -F @neural/agent-core test integration/phase1    # Phase 1: 5 tests / 3 sites / ~10s
pnpm -F @neural/agent-core test integration/phase2    # Phase 2: 11 tests / 29 MCP tools / ~37s
pnpm -F @neural/agent-core test page-analyze-v23      # T048: amazon.in wall-clock 336ms
pnpm -F @neural/agent-core test browser-evaluate      # T043 sandbox: 9 vectors + 3 KNOWN LIMITATION pins
```

**What you'll see:** Vitest's green checkmarks scrolling, ending with `Test Files 79 passed | 2 skipped (81)` and `Tests 493 passed | 123 todo (616)`.

**Talking point:** "Every single Phase 1 + 2 acceptance criterion is pinned by an automated test. The 123 todo entries are future ACs (Phase 3+) — pre-authored as red placeholders so we can't ship a phase without filling them in."

---

## Demo 3 — Watch Chromium drive (visceral demo)

**What it shows:** Same as Demo 1, but the Chromium window stays in the foreground long enough for non-technical viewers to watch the agent navigate, settle the page, and capture state.

The default `pnpm demo` already uses **visible Chromium**. If you want to slow it down for the audience:

```powershell
# Edit packages/agent-core/scripts/demo-phases.ts and add a sleep
# between the Phase 1 capture and the Phase 2 page_analyze call.
# (Optional; the natural ~3s settle time is usually enough.)
```

For a faster headless demo (e.g., CI screencast):

```powershell
$env:DEMO_HEADLESS=1
pnpm demo
```

---

## What to say (the narrative)

### Opening (~2 min, mixed audience)

> "Over the last week, we shipped six phases of an AI-driven CRO audit platform. The platform's job is to walk a real product page like a senior conversion-optimization consultant would, perceive everything that affects buying behavior, and emit actionable findings. We're not done — the LLM-driven analysis pipeline ships in Phases 7-9 — but we've built the foundation. Let me show you."

### During Demo 1 (~5 min)

When Chromium opens:
> "Watch the browser. This is the same Chromium-based perception layer the AI will use when the audit runs. It's not screen-scraping — it's reading the page's accessibility tree, the same data structure a screen reader uses. That's how the AI 'sees' a page semantically rather than pixel-by-pixel."

When Phase 2 fires:
> "This is `page_analyze` — one of 29 MCP tools we built in Phase 2. MCP stands for Model Context Protocol, Anthropic's standard for connecting AI agents to tools. We expose 29 capabilities — navigate, click, screenshot, analyze, extract, etc. — and Claude will compose them in Phase 5 to drive the audit. Right now we're invoking `page_analyze` directly to show what it extracts: 5 CTAs with measured WCAG contrast, 16 forms, performance metrics, accessibility coverage. **Real numbers from the real page**, not stubs."

When the summary lands:
> "End to end, 7.8 seconds. Phase 7 next adds an LLM call on top of this output — the AI will reason about these signals, match them against 30 CRO heuristics, and emit grounded findings. Today the *perception* layer is real. The *analysis* layer is what we build next."

### Wrap (~2 min, technical audience)

> "What's behind this discipline? Spec-driven development, end-to-end. Every phase has a spec, a plan, a task list, an impact analysis, and two gated reviews — pre-flight before implementation starts, verification before we ship. An AI Reviewer reads the diff and stamps APPROVE only if all acceptance criteria pass; I stamp the human gate. Phase 2 specifically: 38 tasks, 13 acceptance criteria, 493 tests pass, zero regression on Phase 1. That's the rhythm. Phase 3 boots next."

---

## What was built (one paragraph per phase, non-technical)

### Phase 0 — Setup

We built the foundational scaffolding: monorepo workspace, Postgres database with vector search, message queue, CLI command shell. Like setting up the workshop before the carpenter arrives — boring but load-bearing.

### Phase 0b — Heuristic authoring

We curated **30 CRO heuristics** drawn from the world's most rigorous conversion-rate-optimization research: Baymard Institute checkout/cart/PDP research, Cialdini's six principles of influence (scarcity, social proof, authority, etc.), and Nielsen Norman Group's usability heuristics. We built an isolated module that stores these as private IP — they never leak into logs, error messages, or git-committed test fixtures. This is the agency's competitive moat.

### Phase 1 — Browser Perception Foundation

We built the perception layer: a Chromium-based capture engine that opens any URL and extracts the page's accessibility tree (the same structure assistive tech uses). Then it filters that tree down to the 30 most decision-relevant nodes using a four-factor scoring function, captures a screenshot, and emits a structured `PageStateModel` under **20,000 tokens** — small enough to fit in an LLM's context window with room for reasoning. **9.5 seconds for a 3-site benchmark**, no regression in 142 tests.

### Phase 1b — Perception Extensions

We added 10 specialized extractors that surface signals the base perception misses — pricing display patterns, click-target sizing per Fitts's Law, sticky element behavior, popup quality, friction aggregates, social proof depth, microcopy near CTAs, visual attention, commerce-specific signals (stock, shipping, returns), and currency switcher detection. These are the signals a top-1% CRO consultant evaluates that an automated tool typically misses.

### Phase 1c — PerceptionBundle Envelope

We wrapped everything into a unified `PerceptionBundle` — a single envelope that combines Phase 1's perception, Phase 1b's extensions, and Phase 2's screenshots into one structured payload. We locked four "closed taxonomies" (predictable closed enums) so downstream consumers get safety: iframe purposes (9 values), hidden-element reasons (7), non-determinism flags (9), and warning codes (12). When Phase 7 analyzes a page, it can trust these categories.

### Phase 2 — MCP Tool Surface

We built the **29-tool agent surface**: 22 browser-control tools (navigate, click, screenshot, extract, type, scroll, evaluate JavaScript, etc.), 2 agent-orchestration tools (complete, request_human), and 5 page-introspection tools (perf metrics, element info, full-page screenshot, annotate screenshot with bounding boxes, and the AnalyzePerception v2.3 producer). Every tool exposes a Zod-validated schema, runs under a typed safety classification (safe / requires_safety_check / requires_hitl / forbidden), and registers through a single MCP server adapter. **Claude will compose these 29 tools in Phase 5** to drive the full audit pipeline autonomously.

---

## How the AI was orchestrated (the discipline narrative)

**For a technical audience.** Skip if non-technical.

1. **Spec-Kit driven workflow.** Every phase started with a brainstorming session → `/speckit.specify` (problem + scope) → `/speckit.plan` (design) → `/speckit.tasks` (atomic implementation steps) → `/speckit.analyze` (cross-artifact consistency check). The specs are the source of truth; the code matches the spec, not the other way around.
2. **Master orchestrator skill.** Each phase ran through a 4-stage state machine: Stage 1 pre-flight (analyze + AI Reviewer) → Stage 2 implementation (parallel subagent fan-out for independent tasks, single-threaded for shared-contract risk) → Stage 2.5 code review → Stage 3 verification (lint + typecheck + tests) → Stage 3b AI Reviewer Gate-2 verdict → Stage 4 exit (status bumps + rollup + INDEX flip + branch push). Two human stamps per phase: one at Gate 1 (pre-flight) and one at Gate 2 (post-verification).
3. **AI Reviewer with R5.6 two-pass critic.** At each gate, an AI reviewer reads the diff, the spec artifacts, and the AC↔test matrix, then synthesizes a verdict across three sub-audits: correctness (mechanical), coverage (AC↔test traceability), and completeness (categorical surfaces with an adversarial second-pass critic). Strictest verdict wins — never relax coverage.
4. **R23 kill criteria + Path B remediation.** Phase 2's `browser_evaluate` sandbox surfaced a CRITICAL finding at Stage 2.5: three structural bypass classes the test suite hadn't covered. Rather than over-engineer the sandbox (which v1.1 will redo anyway with full isolated context), we accepted two bypasses as **documented known limitations**, gated operationally by Phase 4's DomainPolicy, and **pinned the bypasses as AC-06 tests** so future drift can never silently regress. The spec wording was revised v0.3.1 → v0.3.2 with an R18 append-only delta block recording the honest scope.
5. **Append-only spec evolution.** Every spec change appends a delta block; nothing gets line-removed. Future readers see the full history. Phase 2's `impact.md` has 7 such delta blocks documenting BrowserPage/BrowserSession surface extensions v0.2.1 → v0.2.8.

**This is novel.** Most "AI-assisted development" pipelines are either fully autonomous (and untrustworthy) or fully human-in-the-loop (and slow). The master orchestrator pattern checkpoints at exactly two human gates per phase — pre-flight and verification — and automates everything else with structured AI review at each transition. **You stamp APPROVE in under 5 minutes per phase**; the AI does the cross-artifact consistency analysis you'd otherwise have to do manually.

---

## What's next (Phases 3 → 9 in a sentence each)

| Phase | What it adds |
|---|---|
| 3 | Thin verification layer — re-run safety checks; ~2 weeks |
| 4 | Postgres writes with row-level security; cost tracking; safety policy |
| 4b | Context capture for the heuristic evaluator |
| 5 | **Browse MVP** — Claude composes the 29 MCP tools to drive a full audit autonomously |
| 5b | Multi-viewport (desktop + mobile) and cookie-policy taxonomy |
| 6 | **Heuristic KB engine** loads the 30 heuristics and scores findings |
| 7 | **Analysis pipeline** — deep_perceive → evaluate → self_critique → ground → annotate (5-node LangGraph; this is where the real AI findings happen) |
| 8 | Multi-page orchestrator with reproducibility snapshots |
| 9 | **Consultant dashboard** (Next.js + Clerk auth + 4 pages) + **branded PDF report** + executive summary + action plan |

**MVP shippable for first external pilot: ~8-10 weeks from today.** v1.1 hardens the heuristic IP encryption + browser_evaluate sandbox before any pilot launch.

---

## Numbers to drop into a deck

- **6 phases shipped in ~9 days** (Phase 0 to Phase 2, with master-orchestrator discipline)
- **493 tests / 81 test files / 0 regression** across all 6 phases
- **38 tasks delivered in Phase 2 alone**; 13 acceptance criteria all green
- **29-tool MCP surface** with AnalyzePerception v2.3 ready for Phase 7 consumption
- **30 CRO heuristics** authored + R6-IP-protected in private repo
- **AC-13 integration: 11/11 tests · 37s wall-clock** (8× under 5-min budget)
- **AC-11 amazon.in page_analyze: 336ms wall-clock** (15× under 5s budget)
- **R9 single-importer rule preserved**: `@modelcontextprotocol/sdk` only in `mcp/Server.ts`; `playwright` only in `BrowserManager.ts`
- **Zero spec drift** across 58 Phase 2 commits; every change has an R18 append-only delta block

---

## Live talk cheat sheet

Print this section. Read top-to-bottom during the demo.

```
1. cd C:\Sabari\Neural\NBA
2. chcp 65001                        # fix em-dashes in PowerShell
3. pnpm demo                          # ★ THE MAIN DEMO ★ — Chromium opens; ~10s
4. ls out/demo/                       # show artifacts
5. start out/demo/*.jpg               # open the full-page screenshot
6. pnpm test                          # 493 tests in ~45s
7. cat docs/specs/mvp/phases/phase-2-tools/phase-2-current.md | less   # spec discipline
```

If you want to demo just one thing in 60 seconds: **step 3 alone is enough.**

---

## Troubleshooting (during the live talk)

| Symptom | Fix |
|---|---|
| `pnpm demo` says "Unsupported engine: wanted Node 22" | Warning only; harmless. Node 24 works fine. |
| Em-dashes show as `ΓÇö` in PowerShell | `chcp 65001` to switch to UTF-8 codepage. |
| Chromium window doesn't appear | Re-run with `$env:DEMO_HEADLESS=1; pnpm demo` to confirm the script runs at all; then unset the var for visible mode. |
| amazon.in / peregrine.co.uk is unreachable | Use `pnpm demo --url=https://example.com` as fallback (less impressive but works offline-ish). |
| Demo takes longer than 15s | Pull up `pnpm test` instead; the test suite is fully deterministic on local fixtures. |

---

*Last updated 2026-05-13. Authored alongside `packages/agent-core/scripts/demo-phases.ts` as the visual companion to that script.*
