# CLAUDE.md — Claude Code Project Guidance

> **Project:** Neural — AI CRO Audit Platform for REO Digital
> **Status:** 0% implemented. MVP v1.0 plan locked. Master plan v2.3.
> **Read this first** before doing anything in this repo.

---

## 1. Start-here reading order

Before any task, read these in order. Do not skip.

### 1a. Lifecycle-aware reading (Constitution R17)

Every spec artifact has a `status:` field in its YAML frontmatter. When loading context, apply these rules:

- ✅ **Load** artifacts in state: `validated`, `approved`, `implemented`, `verified`
- ⚠️ **Load cautiously** `draft` — only if explicitly told; content may be wrong
- ❌ **Do NOT load** `superseded`, `archived` — always follow the `supersededBy` pointer instead

### 1b. Rollup-first rule (Constitution R19)

When picking up Phase N work, read the predecessor phase's rollup (`phase-<N-1>-current.md`) FIRST — not the full predecessor artifacts. Rollups are compressed system state; full phase artifacts are reference material.

### 1c. Impact-before-implementation rule (Constitution R20)

If a task modifies a shared contract (AnalyzePerception, PageStateModel, AuditState, Finding lifecycle, adapter interfaces, DB schema, MCP tool interfaces, grounding rule interfaces), an `impact.md` MUST exist before you write implementation code. Check for it in the change folder; if missing, STOP and request one.

1. **This file (`CLAUDE.md`)** — how to operate in this repo.
2. **`docs/specs/mvp/README.md`** — entry point + document map for the entire MVP corpus. Lists every file at the MVP root + every subfolder + the per-phase artifact pattern.
3. **`docs/specs/mvp/constitution.md`** — 26 non-negotiable engineering rules (R1-R26). Auto-synced to `.specify/memory/constitution.md`.
4. **`docs/specs/mvp/PRD.md`** — canonical product requirements (vision, users, scope, F-001..F-021 functional + NF-001..NF-010 non-functional reqs, boundaries §10, domain §11). Architecture, testing, workflow, and risks were extracted on 2026-04-24 to sibling files (see Supporting docs below).
5. **`docs/specs/mvp/phases/INDEX.md`** — phase decision table. Identify the active phase by depends-on / blocks columns; load only that phase's folder. **Never load all 15 at once.**
6. **`docs/specs/mvp/phases/phase-<N>-<name>/{README,spec,plan,tasks,impact}.md`** — **per-phase spec/plan/tasks/impact (the only spec/plan/tasks files in the corpus — there are no root-level Spec Kit artifacts).** Load the active phase's `README.md` first; then `spec.md` → `tasks.md` → `plan.md` as needed. `impact.md` present when shared contracts are touched (R20).
7. **Task-specific architecture spec** in `docs/specs/final-architecture/` per the REQ-ID cited by the current task. Open only the cited section — don't load the whole 35-spec corpus. §31 + §32 are superseded — never load.

Supporting docs at MVP root (read on demand):
- `docs/specs/mvp/architecture.md` — five-layer stack, pipeline flow, data contracts, tech stack, project structure map (extracted from PRD §6).
- `docs/specs/mvp/testing-strategy.md` — philosophy, stack, conformance matrix (18 rows), real-LLM policy (extracted from PRD §9).
- `docs/specs/mvp/risks.md` — 10-risk register, lethal-trifecta contingencies, fallback protocols (extracted from PRD §15).
- `docs/specs/mvp/spec-driven-workflow.md` — R17-R21 lifecycle / delta / rollup / impact / matrix workflow (extracted from PRD §12).
- `docs/specs/mvp/implementation-roadmap.md` v0.3 — **walking-skeleton 12-week vertical-slicing plan with Wednesday demo cadence**; week 1 ships stubbed end-to-end pipeline.
- `docs/specs/mvp/tasks-v2.md` — 263-task master plan catalog (per-phase `tasks.md` references task IDs from here for REQ-ID traceability).
- `docs/specs/mvp/examples.md` — AuditRequest, Findings, BAD-finding patterns, style guide.
- `docs/specs/mvp/templates/` — frontmatter, impact, rollup, phase-review prompt + report, conformance test, system-current, spec-to-code-matrix templates.
- `docs/specs/mvp/scripts/README.md` — 6 stub scripts enforcing R17-R21 (full impl Phase 9; manual discipline until then).
- `docs/specs/mvp/sessions/` — per-session handover notes; load on demand when picking up where a prior session left off (NOT required for routine task work).
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` — canonical browser agent spec.
- `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` — canonical analysis agent spec.
- `docs/PROJECT_BRIEF.md` — 28-section strategic brief (LLM analysis input; NOT operational).
- `docs/master-architecture-checklist.md` — 20-section coverage verification.

---

## 2. Tech stack

| Layer | Tech |
|---|---|
| Language | TypeScript 5.x, Node.js 22 LTS |
| Monorepo | Turborepo + pnpm (`packages/` + `apps/` workspaces) |
| Validation | Zod 3.x — every external boundary |
| Browser | Playwright (default in MVP; stealth plugin deferred to v1.1) |
| Orchestration | LangGraph.js (state graphs, checkpointing, interrupt) |
| MCP | `@modelcontextprotocol/sdk` |
| Primary LLM | Claude Sonnet 4 (`claude-sonnet-4-*`) via `@anthropic-ai/sdk` |
| Fallback LLM | GPT-4o (**deferred to v1.2** — MVP is Claude-only) |
| Database | PostgreSQL 16 + pgvector |
| ORM | Drizzle |
| Cache / Queue | Redis (Upstash in prod) + BullMQ |
| API framework | Hono 4.x |
| Frontend | Next.js 15 App Router + shadcn/ui + Tailwind CSS |
| Auth | Clerk |
| Storage | Cloudflare R2 (local disk fallback in dev) |
| Image annotation | Sharp |
| PDF generation | Playwright `page.pdf()` |
| Logging | Pino (JSON structured) |
| Email | Resend or Postmark |
| Testing | Vitest (unit), Playwright Test (integration + acceptance) |
| Deployment | Fly.io (API) + Vercel (dashboard) |

**Version pins live in `package.json` / `pnpm-lock.yaml`.** Never upgrade a pinned version without approval.

---

## 3. Quick command reference (cheat sheet — full details in §3 below)

```bash
pnpm install                                 # setup
docker-compose up -d && pnpm db:migrate      # local DB ready

# Before every commit
pnpm lint && pnpm typecheck && pnpm test

# Run the audit
pnpm cro:audit --urls ./urls.txt --business-type ecommerce

# Conformance (per PRD §9.6)
pnpm test:conformance
pnpm test:conformance -- <component>

# Per-phase analyze (R17.4 gate before status: draft → approved)
/speckit.analyze    # Run on ONE phase folder at a time; never bulk-analyze across phases
```

## 3a. Command reference

All commands run from repo root unless noted. Full descriptions in `PRD.md` §15.

```bash
# Install + environment
pnpm install
cp .env.example .env                         # fill in secrets after
docker-compose up -d                         # start Postgres + pgvector
pnpm db:migrate

# Build + dev
pnpm build
pnpm dev                                     # Turbo dev across apps
pnpm typecheck                               # tsc --noEmit
pnpm -F @neural/agent-core build             # single workspace build

# Test
pnpm test                                    # unit (Vitest)
pnpm test:integration                        # integration (Playwright Test)
pnpm test:coverage                           # with coverage report
pnpm test:watch                              # watch mode

# Lint + format
pnpm lint                                    # ESLint
pnpm lint:fix
pnpm format                                  # Prettier write
pnpm format:check                            # Prettier check (CI)

# DB
pnpm db:migrate
pnpm db:migrate:generate
pnpm db:studio

# Application
pnpm cro:audit --urls ./urls.txt --business-type ecommerce --output ./out
pnpm cro:audit --version
```

**Always run before commit:** `pnpm lint && pnpm typecheck && pnpm test`.

---

## 4. File structure

Authoritative tree in `docs/specs/mvp/architecture.md` §6.5 and (legacy) `docs/PROJECT_BRIEF.md` §28. Summary:

```
neural-nba/
├── apps/
│   ├── cli/                         # pnpm cro:audit entry point
│   └── dashboard/                   # Next.js 15 consultant dashboard
├── packages/
│   └── agent-core/                  # Core library
│       └── src/
│           ├── browser-runtime/     # BrowserManager, OverlayDismisser, RateLimiter
│           ├── perception/          # PageStateModel extractors (AX-tree, filters, mutation)
│           ├── mcp/                 # MCP server + 12 tools + ToolRegistry
│           ├── safety/              # ActionClassifier, DomainPolicy, NavigationGuard
│           ├── verification/        # 3 verify strategies (MVP) + VerifyEngine
│           ├── analysis/
│           │   ├── nodes/           # DeepPerceive, Evaluate, SelfCritique, Ground, Annotate, Store
│           │   ├── grounding/       # GR-001..GR-012 (10 active in MVP)
│           │   ├── scoring/         # 4D scoring + IMPACT_MATRIX + EFFORT_MAP
│           │   ├── heuristics/      # Schema, loader, 2-stage filter
│           │   ├── personas/        # PersonaContext + defaults
│           │   ├── cross-page/      # PatternDetector
│           │   ├── quality/         # PerceptionQualityScorer
│           │   └── strategies/      # StaticEvaluateStrategy (+ interface for Interactive in v1.2)
│           ├── orchestration/       # AuditState, AuditGraph, nodes
│           ├── gateway/             # AuditRequest, GatewayService, DiscoveryStrategy
│           ├── reproducibility/     # SnapshotBuilder, TemperatureGuard
│           ├── storage/             # AccessModeMiddleware, TwoStore
│           ├── review/              # WarmupManager
│           ├── delivery/            # ExecutiveSummaryGenerator, ActionPlanGenerator, ReportGenerator
│           ├── observability/       # Pino logger, EventEmitter
│           ├── adapters/            # LLMAdapter, StorageAdapter, ScreenshotStorage, BrowserEngine,
│           │                         HeuristicLoader, NotificationAdapter
│           └── db/                  # Drizzle schema + migrations
├── heuristics-repo/                 # Private, 30 heuristics (MVP). JSON. Not encrypted until v1.1.
├── docs/                            # Specs + PRD + plans
├── test/
│   ├── fixtures/                    # Cached pages for offline tests (v1.2)
│   └── acceptance/                  # Playwright Test — Phase 8 + 9 acceptance
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### File structure rules (Constitution R10)

- Files SHOULD be under **300 lines**. Split when they grow.
- Functions SHOULD be under **50 lines**. Extract helpers.
- Use **named exports**. Avoid default exports.
- Files that change together live together. Split by **responsibility**, not by technical layer.
- **No commented-out code.** Delete; git remembers.

---

## 5. Code style

**Canonical reference:** [`docs/engineering-practices/code-style.md`](docs/engineering-practices/code-style.md) — naming conventions, file organization, TypeScript patterns (Zod-first, `unknown` not `any`, named exports, pure functions), error handling, adapter pattern, Pino logging.

Quick summary (from Constitution R10):

- **Comments explain WHY, not WHAT.** The code shows what; comments explain why a non-obvious decision was made (e.g., "Multiplicative decay (R4.4) — additive would accumulate unboundedly").
- **No `console.log` in production code.** Use Pino with correlation fields (audit_run_id, page_url, node_name, heuristic_id, trace_id).
- **No `any` without a `// TODO: type this` comment and a tracking issue.**
- **Every TypeScript interface from a spec is implemented EXACTLY.** Do not rename fields, change types, or add fields without spec authorization.
- **Zod schemas BEFORE implementation** at every external boundary: LLM output, MCP tool I/O, API request/response, DB row writes, adapter return types.
- **Reference REQ-IDs in comments** where decisions trace to a spec: `// REQ-ANALYZE-PERCEPTION-001: single page.evaluate() call`.

---

## 6. Git workflow

**Canonical reference:** [`docs/engineering-practices/git-workflow.md`](docs/engineering-practices/git-workflow.md) — branch naming, full commit message template with examples, pre-commit checklist, PR policy (requires PRD §10.9 PR Contract + §10.6 Spec coverage), branching model.

Quick summary:

### Commit format

```
<type>(<scope>): <TaskID> <imperative description> (<REQ-ID>)
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.

Examples:
- `feat(perception): M1.5 implement MutationMonitor (REQ-BROWSE-PERCEPT-005)`
- `feat(analysis): M7.10 add GR-001 element-exists grounding rule (REQ-GROUND-001)`
- `fix(analysis): M7.9 separate self-critique LLM persona (R5.6)`
- `docs(prd): bump to v1.0.1, add §15-18`

### Branch naming

- `feat/<phase>-<task-id>-<short-name>` — e.g., `feat/phase-1-m1.5-mutation-monitor`
- `fix/<issue-id>-<short-name>` — e.g., `fix/i42-contrast-ratio-null`
- `refactor/<scope>-<short-name>` — e.g., `refactor/heuristics-loader-async`

### Pre-commit checklist

1. `pnpm lint` — clean
2. `pnpm typecheck` — clean
3. `pnpm test` (affected workspace) — green
4. Task's smoke test — passes
5. No stray files (`.env`, large logs, node_modules)
6. Commit message follows format above

### PR policy

- One task = one PR (unless tasks are trivially sequential and would break intermediate state)
- Phase exit criteria met before merging the last PR of a phase
- No `--no-verify` / `--no-gpg-sign` / hook bypass without explicit approval
- No force-push to main, ever

---

## 7. Three-tier operational boundaries

**Canonical location:** **PRD §10** (`docs/specs/mvp/PRD.md`). Load it directly — do not rely on this section.

This CLAUDE.md section previously mirrored PRD §10 verbatim, which spent attention budget on duplication (Addy Osmani, "the curse of instructions"). The mirror has been collapsed per §10.9 PR Contract research and Constitution R22 (The Ratchet).

**When working on a task:**
- For ALWAYS/ASK FIRST/NEVER tiers → read PRD §10.1–§10.3
- For agent self-verification protocol → PRD §10.6
- For modular-prompt rule (one task per prompt) → PRD §10.7
- For agent reasoning log guidelines → PRD §10.8
- For PR Contract 4-block format → PRD §10.9
- For comprehension-debt pacing → PRD §10.10

If PRD §10 is not already in your task context, load that section before proceeding.

---

## 8. Self-check protocol (after every task)

1. Re-read task acceptance criteria in `phases/phase-<N>-<name>/tasks.md` (canonical for the active phase; cross-reference `tasks-v2.md` v2.3.3 for master-plan REQ-IDs).
2. **Agent self-verification against acceptance criteria** (per PRD §10.6):
    - Enumerate every acceptance criterion bullet
    - For each: state ✅ Met (file:line) / ❌ Not met / 🟡 Partial, with rationale
    - If any ❌ or 🟡 → do NOT declare complete; implement or escalate via ASK FIRST
    - List any unaddressed related requirements explicitly ("Not covered by this PR: X, Y, Z")
3. Run task smoke test — passes.
4. `pnpm typecheck` — clean.
5. `pnpm test` (affected workspace) — green.
6. `pnpm test:conformance -- <component>` for every component the task touched (PRD §9.6) — green.
7. `pnpm lint` — clean.
8. Verify files touched match task scope (no drive-by edits).
9. Mark `- [ ]` → `- [x]` in the phase's `tasks.md` next to the completed task ID. Commit (same commit as the impl): `<type>(<scope>): <TaskID> <description> (<REQ-ID>)`.
10. PR body MUST include Spec Coverage section per PRD §10.6.
11. Any failure → STOP. Use `superpowers:systematic-debugging` skill.

## 8a. Modular prompt rule (per PRD §10.7)

**One task per prompt.** Every prompt to Claude Code is scoped to exactly ONE atomic unit.

- ✅ "Implement GR-007 per M7.16 spec" + GR007 spec section + examples.md §8 BAD finding #4
- ❌ "Implement all grounding rules" or "implement M7.10 and M7.16"
- ❌ Pasting the whole PRD for every task

**Context budget target:** < 20K tokens per task prompt.

**Always include:** constitution.md + PRD §10 (this file §7 is the mirror) + the single task + only the cited spec section(s). See PRD §12.5 for context management rules.

## 8b. Agent reasoning log (per PRD §10.8)

Log your reasoning in commit messages / PR descriptions / inline comments at key decision points:

1. **Interpretation:** 1-2 sentences stating what you understood the task to require
2. **Spec references used:** exact REQ-IDs + file paths
3. **Key decisions + rationale** for non-obvious choices
4. **Alternatives considered + rejected** (one-liner each)
5. **Assumptions** flagged for developer review
6. **Deviations from spec** (must ASK FIRST; if proceeding after approval, log why)

Do NOT log: full chain-of-thought narrations, heuristic content (IP — R6), secrets, or PII.

## 8c. Phase artifact maintenance (per task + per phase)

The phase folders in `docs/specs/mvp/phases/` are the canonical source of truth in git. As work progresses, keep them in sync — not just the personal HTML tracker (`implementation-roadmap.html` localStorage is browser-local and not authoritative).

**Before phase implementation begins** (the `draft → approved` transition per R17):
- Run `/speckit.analyze` on THIS phase only — do NOT bulk-analyze across phases
- Triage findings; fix spec defects first per R11.4 (fix spec before implementing)
- Bump frontmatter `status:` from `draft` to `approved` only after analyze is clean
- Repeat this gate per phase as you progress through the implementation order; never analyze phases you're not about to implement
- Rationale: earlier phases may force spec changes that ripple to later phases (R20 cross-cutting impact); bulk-analyzing 15 phases produces findings against artifacts that will change

**Per task** (alongside §8 self-check, step 9):
- Mark `- [ ]` → `- [x]` in the phase's `tasks.md` next to the completed task ID
- Stage the change in the same commit as the implementation

**Per phase** (when the last task in a phase lands):
- Bump frontmatter `status:` per R17 lifecycle: `approved` → `implemented` (all tasks done; tests green) → `verified` (conformance + acceptance tests green)
- Bump `status:` on companion artifacts in the same folder (`spec.md`, `plan.md`, `impact.md`, `checklists/requirements.md`)
- Author `phase-N-current.md` rollup per R19 (active modules, contracts now in effect, system flows operational, known limitations, open risks for next phase) — template at `docs/specs/mvp/templates/phase-rollup.template.md`
- Update `docs/specs/mvp/phases/INDEX.md` — flip the phase row's status column (⚪ not started → 🟡 in progress → 🟢 complete)

**Why this matters:** if you only update the personal HTML tracker, the canonical corpus drifts; `/speckit.analyze` will flag phantom incomplete tasks; R17 lifecycle stays stuck on `draft`; phase rollups (R19) never land, so each subsequent phase loses the compressed predecessor state it's supposed to read first per CLAUDE.md §1b.

## 8d. Phase review (R17.4 lifecycle gate — `validated → approved`)

Engineering lead review is the gate before bumping `status: draft → approved` on a phase's artifacts (spec/plan/tasks/impact). It's distinct from `/speckit.analyze`:

- **`/speckit.analyze`** — mechanical cross-artifact consistency (REQ-ID coverage, dependency conflicts, terminology drift)
- **Phase review** — JUDGMENT (doom check, design soundness, kill-criteria realism)

Both are required before phase implementation begins. Run analyze FIRST; resolve CRITICAL/HIGH findings; THEN run phase review.

**Centralized templates** (DO NOT duplicate per-phase):
- [`docs/specs/mvp/templates/phase-review-prompt.md`](docs/specs/mvp/templates/phase-review-prompt.md) v1.0 — review instructions
- [`docs/specs/mvp/templates/phase-review-report.template.md`](docs/specs/mvp/templates/phase-review-report.template.md) v1.0 — output schema

**Invocation pattern:**

```
"Review phase-N-name using the phase-review template."
```

Claude reads the template + phase folder artifacts + constitution, executes the 5-step review pass (read in order → per-artifact judgment → doom check → kill criteria validation → recommendation), and emits `docs/specs/mvp/phases/phase-N-name/review-notes.md` per the report schema. Recommendation is one of: **APPROVE** / **REVISE** / **RE-SPEC**.

**Order of gates before implementation:**

1. Run `/speckit.analyze` on the target phase (mechanical consistency)
2. Resolve any CRITICAL/HIGH analyze findings
3. Run phase review using the centralized template (judgment)
4. If review recommends **APPROVE** → bump `status: draft → approved` on spec.md/plan.md/tasks.md/impact.md (per §8c "Before phase implementation begins")
5. If review recommends **REVISE** → address findings, re-run review (status stays `draft`)
6. If review recommends **RE-SPEC** → pause phase; re-open design discussion; may require `/speckit.specify` re-run

**Single-team adaptation:** When the user is their own reviewer (solo or small MVP team), the review still works — follow the calibration notes in the prompt template: time-box per phase risk (LOW ~30min, MEDIUM ~45min, HIGH ~60min), take a 2-4 hour break between authoring and review, use the doom check ruthlessly, record the review in writing.

**Recordkeeping:** every approved phase's `review-notes.md` is the audit trail justifying the R17.4 transition. Future Claude sessions reading the phase folder see why it was approved and by whom. Commit message on the status-bump commit cites: `(R17.4 review approved per phase-N/review-notes.md)`.

---

## 9. Sub-agent dispatch policy

### When to dispatch

- Independent tasks within a phase that don't share state (e.g., implementing GR-001, GR-002, GR-003 in parallel — each is a self-contained function)
- Parallel research / exploration tasks (e.g., "find all usages of X", "check if pattern Y is used anywhere")
- Independent test scaffolding across workspaces

### When NOT to dispatch

- Tasks that modify a shared schema (AnalyzePerception, AuditState, Finding) — sequential updates only
- Tasks that touch the same file
- Sequences where Task N depends on Task N-1's implementation details (not just its interface)
- Anything that needs conversation context (sub-agents start fresh)

### Review after dispatch

- Check the diff for forbidden patterns: `any`, `console.log`, direct external imports outside adapters, hardcoded secrets, disabled tests
- Verify task acceptance criteria met
- Run the self-check protocol on the sub-agent's output before committing

### Phase-level review gate

After each phase completes (per the phase's `tasks.md` exit criteria):
- Full integration test run
- `pnpm test:integration` passes
- Phase acceptance test (if defined — e.g., T148 for Phase 8)
- Manual review of changed files for drift
- Human approval before starting next phase

---

## 10. Spec-driven workflow

Gated progression — never skip a gate:

```
Requirement / vision
       │
       ▼
  Design spec       ← brainstorming skill, written to docs/superpowers/specs/
       │
       ▼
  Implementation    ← writing-plans skill, written to docs/superpowers/plans/
  plan
       │
       ▼
  Concrete tasks    ← per-phase tasks.md under phases/phase-<N>-<name>/
       │
       ▼
  Task execution    ← subagent-driven-development OR executing-plans skill
       │
       ▼
  Phase review      ← phase exit criteria + human approval
       │
       ▼
  Next phase
```

### When you discover new work mid-implementation

- **Small scope (bug fix, clarification):** document inline in task, fix, commit with note.
- **Medium scope (new subtask):** add to `phases/phase-<N>-<name>/tasks.md` (and bump `tasks-v2.md` if it's a master-plan-level addition); document in commit.
- **Large scope (new feature, spec gap):** STOP. Return to brainstorming. Do not accrete scope silently.

### Version bumps

- MVP docs (per-phase `plan.md` / `tasks.md`, `PRD.md`): v1.0 → v1.1 when scope changes. Bump R18 delta block on every edit.
- Master plan (`tasks-v2.md`, spec corpus): versioned via HANDOVER.md; currently v2.3.
- Constitution: versioned separately; breaking rule changes require full team review.

---

## 11. Reproducibility + cost discipline

- Temperature=0 on evaluate / self_critique / evaluate_interactive (R10)
- Reproducibility snapshot per audit — immutable, pins model + prompt hashes + heuristic versions
- Budget per audit: $15 hard cap; per page: $5; per exploration: $0.50 (deferred post-MVP)
- Every LLM call logged to `llm_call_log` atomically (R14.1)
- Pre-call budget gate: estimate from `getTokenCount()` before invoking
- Per-client cost attribution queryable via SQL against `llm_call_log` (R14.4)

---

## 12. Security + IP posture

- **Heuristic content is IP.** Never in API responses, dashboards, logs, LangSmith traces, or git-committed test fixtures. In MVP, heuristics live in `heuristics-repo/` (private). AES-256-GCM encryption deferred to v1.1 before first external pilot.
- **Secrets via `process.env.*` only.** `.env` gitignored; `.env.example` documents required keys.
- **Clerk handles dashboard auth.** No custom auth code.
- **RLS on all client-scoped tables.** `SET LOCAL app.client_id` in transactions (R7.2).
- **Append-only tables** never UPDATEd or DELETEd (R7.4).
- **`browser_evaluate` sandbox** — no cookies, localStorage, fetch, navigation. Blocked on untrusted domains (§08.5).

---

## 13. Where to go when stuck

| Situation | Action |
|---|---|
| Don't know what task to pick up | Open `phases/INDEX.md`, identify the active phase, then open `phases/phase-<N>-<name>/tasks.md` and pick the first unchecked task |
| Spec is ambiguous | `ASK FIRST` — don't invent (Constitution §16) |
| Test is failing in a confusing way | Use `superpowers:systematic-debugging` skill |
| Need an example of a finding / AuditRequest / PDF | `docs/specs/mvp/examples.md` |
| Conflicting specs | R1.4 — ASK |
| Want to dispatch parallel work | See §9 above |
| Need to write a new spec | `superpowers:brainstorming` skill |
| Need to plan tasks from a spec | `superpowers:writing-plans` skill |
| About to commit | Run the §8 self-check |
| About to merge a phase | Run phase exit criteria in `phases/phase-<N>-<name>/tasks.md` + complete the R17 lifecycle bumps per CLAUDE.md §8c |

---

## 14. Non-goals (what this project is NOT)

Explicit to prevent drift:

- Not a Lighthouse / Hotjar / Optimizely clone
- Not an SEO auditor (GR-007 bans conversion predictions; scope is CRO hypotheses only)
- Not a tool for auditing logged-in / authenticated pages (deferred indefinitely)
- Not a replacement for human CRO consultants — we AUGMENT; every finding needs consultant review
- Not a self-serve product in MVP — consultant-operated pilot only
- Not GA4 / analytics-integrated — page content + structure only
- Not multi-tenant SaaS in MVP — single-agency (REO Digital) deployment

---

*End of CLAUDE.md. Last updated 2026-05-01 — Round 1 reading-order sync (per-phase artifact corpus structure; sibling files extracted from PRD §6/§9/§12/§15; constitution rule range R1-R26).*

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
