---
title: Neural MVP — Spec-Driven Workflow + Versioning
artifact_type: spec
status: approved
version: 1.1
created: 2026-04-24
updated: 2026-05-01
owner: engineering lead
authors: [REO Digital team, Claude]

supersedes: "docs/specs/mvp/PRD.md §12 (v1.2 inline content extracted to this file on 2026-04-24)"
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (v1.2 §12 — extracted)
  - docs/specs/mvp/constitution.md R17-R21 (lifecycle, delta, rollup, impact, matrix)
  - docs/specs/mvp/phases/INDEX.md v1.4 (per-phase decision table — Sessions 4-5 realization of §12.5.2)

governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R19 (Rollup per Phase)
  - Constitution R20 (Impact Analysis)
  - Constitution R21 (Traceability Matrix)
  - Constitution R22 (The Ratchet)

delta:
  v1_1:
    new:
      - §12.1 Spec Kit integration — diagram reframed to per-phase pattern (was root-level spec.md/plan.md/tasks.md generation; now per-phase folder authoring via /speckit.specify+plan+tasks)
      - §12.3 Cross-doc synchronization — table updated to identify per-phase regeneration target via INDEX.md
      - §12.5.1 rule #3 — "Spec Kit `tasks.md`" → "phases/phase-<N>-<name>/tasks.md" cross-referencing tasks-v2.md
      - §12.5.2 Per-phase spec summary — reframed from "to be generated" to "REALIZED" via phases/phase-<N>-<name>/README.md + phases/INDEX.md v1.4 (Sessions 4-5)
      - §12.5.4 Spec summarization pipeline — split into "current state" (manual + per-phase READMEs) and "v1.2 target" (auto-regen scripts at scripts/README.md)
      - §12.6 R17.4 phase-review gate cross-reference added (CLAUDE.md §8d + centralized templates)
      - Cross-references expanded — R23-R26, PRD §10.6/§10.9/§10.10, CLAUDE.md §8c+§8d, README.md, scripts/README.md
    changed:
      - Summary line refreshed for per-phase pattern
    impacted:
      - CLAUDE.md (Round 1 §1 reading order sync companion edit on 2026-05-01)
      - docs/specs/mvp/README.md (Round 1 v1.0 → v2.0 entry-point rewrite on 2026-05-01)
    unchanged:
      - Subsection numbering preserved (12.1-12.10) per R18 append-only
      - §12.2 version-bump triggers (minor / scope / breaking)
      - §12.6-§12.10 lifecycle / delta / rollup / impact / matrix bodies
  v1_0:
    new:
      - File created by extracting PRD §12 to separate spec-driven-workflow doc (good-spec review Option A, 2026-04-24)
    changed: []
    impacted:
      - docs/specs/mvp/PRD.md §12 (replaced with pointer)
    unchanged:
      - Subsection numbering (12.1-12.10) preserved for cross-ref stability
---

# Neural MVP — Spec-Driven Workflow + Versioning

> **Summary (~110 tokens — agent reads this first):** Spec Kit CLI gated progression authored **per-phase** under `phases/phase-<N>-<name>/` (PRD + tasks-v2.md → /speckit.specify+plan+tasks per phase → /speckit.analyze per phase → R17.4 review → status: approved → implementation via `neural-dev-workflow` skill, not /speckit.implement). Semantic version bump rules, cross-doc synchronization, update process, context-management discipline (load only relevant section; target <20K tokens per task prompt), lifecycle states (R17), delta-based updates (R18), phase rollups (R19), impact analysis for cross-cutting changes (R20), and auto-generated spec-to-code traceability matrix (R21). For phase-by-phase R17 lifecycle bumps + R17.4 review gate, see CLAUDE.md §8c-§8d.

### 12.1 Spec Kit integration

The workflow follows GitHub Spec Kit's gated progression but authored **per-phase** — there are NO root-level `spec.md` / `plan.md` / `tasks.md` in this corpus. The PRD + `tasks-v2.md` catalog feed each phase folder; Spec Kit commands operate on one phase at a time.

```
PRD.md  +  tasks-v2.md  +  architecture.md / testing-strategy.md / risks.md
    │
    │  (per phase, in canonical order: 0 → 0b → 1 → 1b → 1c → 2 → 3 → 4 → 4b → 5 → 5b → 6 → 7 → 8 → 9)
    ▼
/speckit.constitution    → updates constitution.md when rule changes are needed (rare)
/speckit.specify         → generates phases/phase-<N>-<name>/spec.md
/speckit.plan            → generates phases/phase-<N>-<name>/plan.md
/speckit.tasks           → generates phases/phase-<N>-<name>/tasks.md  (cross-references tasks-v2.md task IDs)
/speckit.clarify         → fills underspecified areas with up-to-5 targeted questions
/speckit.checklist       → generates phases/phase-<N>-<name>/checklists/requirements.md
    │
    ▼  (R17.4 gate before implementation per CLAUDE.md §8d)
/speckit.analyze         → mechanical cross-artifact consistency on THIS phase only
phase review (judgment)  → APPROVE / REVISE / RE-SPEC via templates/phase-review-prompt.md
    │
    ▼  (status: draft → approved on spec.md / plan.md / tasks.md / impact.md)
neural-dev-workflow skill → executes implementation tasks (NOT /speckit.implement)
    │
    ▼  (at phase exit per R19 + CLAUDE.md §8c)
phase-N-current.md rollup → compressed system state for Phase N+1 to read first
```

**Never skip a gate.** If a gate reveals ambiguity, return to the previous artifact and fix before proceeding. Run `/speckit.analyze` and the phase review on **one phase at a time** — never bulk-analyze across phases (CLAUDE.md §8c JIT pattern: earlier phases may force changes that ripple).

### 12.2 Version bump rules

| Change type | Version bump |
|---|---|
| Typos, clarifications | 1.0.0 → 1.0.1 |
| Scope additions (new feature in §3.1) | 1.0.x → 1.1.0 |
| Scope removals (cut a feature) | 1.0.x → 1.1.0 (document rationale) |
| Breaking acceptance criteria change | 1.x.y → 2.0.0 |

Bump triggers:
- Minor clarifications: inline edit + §16 changelog entry
- Scope additions: product owner approval required; PR with rationale
- Scope removals: product owner + engineering lead approval
- Breaking: all stakeholders + version bump

### 12.3 Cross-doc synchronization

When this PRD changes, check for downstream sync. All `spec.md` / `plan.md` / `tasks.md` references below are **per-phase** under `phases/phase-<N>-<name>/` — identify which phase(s) the change touches via `phases/INDEX.md` decision table, then regenerate only those phase folders.

| This PRD changes | Sync to |
|---|---|
| Scope (§3.1) | Regenerate affected phase's `spec.md` via `/speckit.specify` (typically Phase 9 for MVP-COMPLETE gates; identify all phases touched via INDEX.md) |
| Tech stack (architecture.md §6.4) | Regenerate affected phase's `plan.md` via `/speckit.plan` (typically Phase 0 + the phase first activating the changed dependency) |
| Functional req (§4) | Regenerate affected phase's `spec.md` + `tasks.md`; bump `tasks-v2.md` if the change adds / removes / renumbers tasks |
| Boundaries (§10) | Update `CLAUDE.md` §7 + `constitution.md` if new non-negotiable rule (R22 provenance block required) |
| Commands (§8) | Update `CLAUDE.md` §3 + (if a new pnpm script) `scripts/README.md` |
| Domain knowledge (§11) | Update `examples.md` |
| Architecture / testing / risks / workflow content (PRD §6/§9/§12/§15) | Update sibling files `architecture.md` / `testing-strategy.md` / `spec-driven-workflow.md` / `risks.md` per the extraction supersession; bump R18 delta on the sibling |

### 12.4 Update process

- **Minor:** edit inline, add §16 changelog entry, commit `docs(prd): clarify <section>`.
- **Scope:** PR + rationale + product-owner approval.
- **Review cadence:** weekly during implementation (engineering lead checks §13 acceptance + §4 success metrics). End of each phase: full PRD re-read, update §16 with drift. Post-demo: incorporate feedback.

### 12.5 Context management + spec summarization

This PRD is now sharded across multiple sibling files (architecture.md, testing-strategy.md, risks.md, spec-driven-workflow.md) to keep any single artifact load well under 20K tokens. The master plan is 38 source specs. Loading everything per task wastes context, costs money, and increases agent drift. We manage this actively.

#### 12.5.1 Rule — load only the relevant section

When Claude Code works on a task, the prompt MUST include:
1. **PRD §10** (Claude Code Operational Boundaries) — always
2. **`constitution.md`** — always (it's short)
3. **The task** from `phases/phase-<N>-<name>/tasks.md` — always (cross-reference `tasks-v2.md` v2.3.3 for the master-plan REQ-IDs)
4. **Only the spec section(s) cited by the task's REQ-IDs** — use file-structure map in `architecture.md` §6.5
5. **Relevant `examples.md` section** if a pattern exists (grounding, findings, heuristics)
6. **Relevant PRD component section (§7.N)** matching the workspace being touched

**Do NOT load:**
- The full PRD (load only the relevant sections; sibling files for architecture, testing, workflow, risks are loaded on-demand)
- Unrelated architecture specs (e.g., don't give dashboard tasks §20 state-exploration spec)
- `PROJECT_BRIEF.md` for implementation tasks (it's for LLM analysis / gap analysis; strategic, not operational)

#### 12.5.2 Per-phase spec summary (REALIZED — `phases/phase-<N>-<name>/README.md` + `phases/INDEX.md` v1.4)

The per-phase summary pattern this section originally proposed has been **realized** as concrete artifacts shipped in Sessions 4-5 (2026-04-28..2026-04-29):

| Originally proposed | Realized as |
|---|---|
| `phase-summaries/phase-<N>.md` ~200-400 tokens | `phases/phase-<N>-<name>/README.md` (~150 tokens each) — phase goal, scope, dependencies, exit criteria |
| Master phase decision table | [`phases/INDEX.md`](phases/INDEX.md) v1.4 — phase status, tasks, depends-on, blocks, risk |
| Required specs / REQ-ID map | Per-phase `spec.md` cites REQ-IDs from `final-architecture/`; per-phase `tasks.md` cross-references `tasks-v2.md` task IDs |
| Common pitfalls | Per-phase `impact.md` (when shared contracts touched per R20) + cross-references to [`examples.md`](examples.md) §8 BAD-finding patterns |

**Usage:** when starting a task in Phase N, load `phases/phase-<N>-<name>/README.md` first (per CLAUDE.md §1 step 6), then the relevant `spec.md` / `tasks.md` section. Do NOT load the full PRD or all 15 phase folders.

**Still target state (v1.2):** `pnpm spec:summarize --phase <N>` to auto-generate the README from spec.md + tasks.md (currently hand-authored per phase). See `scripts/README.md` for the full stub set.

#### 12.5.3 Context-management tooling options

For MVP: manual discipline per §12.5.1.

**Post-MVP options** to manage larger spec corpus:

| Option | Purpose | Integration |
|---|---|---|
| **Context7 MCP server** | Fetch current library docs at runtime (TypeScript, Playwright, LangGraph, Zod, Drizzle, Clerk) | Already available as MCP tool; Claude Code can call `mcp__plugin_context7_context7__query-docs` |
| **Pgvector-backed RAG** | Embed the 38 architecture specs; retrieve top-k relevant chunks per query | `packages/agent-core/src/db/` has pgvector; one script to embed specs, one RAG query function |
| **Per-component spec extracts** | Pre-generate small (<500 token) summaries per §07.N spec section | Automated via summarization script; output committed alongside source specs |
| **Spec Kit `/speckit.analyze`** | Cross-artifact consistency — not RAG, but catches drift between spec/plan/tasks | Already in Spec Kit v0.7.4 |

**Recommendation:** start with Context7 (free, already available) for external library docs. Add pgvector RAG in v1.2 when the spec corpus + golden test library grow. Don't over-engineer context management before the MVP ships.

#### 12.5.4 Spec summarization pipeline (current state + v1.2 target)

**Current state (2026-05-01) — manual + per-phase READMEs realize the bulk of this:**

```
docs/specs/final-architecture/§NN-<name>.md          (source of truth, 500-1500 lines each)
   │
   ▼ (hand-authored per phase + /speckit.specify, .plan, .tasks)
phases/phase-<N>-<name>/{README,spec,plan,tasks}.md  (README ~150 tokens; spec/plan/tasks <500 lines each)
   │
   ▼ (per-phase tasks.md references tasks-v2.md task IDs which carry REQ-IDs)
Claude Code prompt context                            (compact, targeted; <20K tokens)
```

**v1.2 target — auto-regeneration via Phase 9 scripts (currently stubs at `scripts/README.md`):**

- `pnpm spec:pack --phase <N>` — concatenate `constitution.md` + PRD §10 + phase README + phase spec + cited REQ-ID excerpts + relevant `examples.md` sections into `phases/phase-<N>-<name>/context-pack.md` (~10K tokens cap)
- `pnpm spec:summarize --phase <N>` — regenerate phase README from spec.md + tasks.md
- `pnpm spec:matrix` — auto-generate `spec-to-code-matrix.md` from spec corpus + source code + tests (R21)

Until those scripts ship: manual discipline per §12.5.1, hand-authored phase READMEs, no `context-pack.md` files yet.

### 12.6 Lifecycle states (Constitution R17)

Every spec artifact carries a `status:` field in YAML frontmatter. Allowed states: `draft | validated | approved | implemented | verified | superseded | archived`. Claude Code and humans SHALL skip `draft`, `superseded`, `archived` artifacts when loading context for implementation.

**Frontmatter template:** `docs/specs/mvp/templates/frontmatter-lifecycle.template.md`.

**State transitions:**
- `draft → validated`: author self-review complete
- `validated → approved`: PR approved by product owner or engineering lead
- `approved → implemented`: code lands referencing the artifact's REQ-IDs
- `implemented → verified`: conformance + acceptance tests green
- `verified → superseded`: newer version replaces it (the new version carries `supersedes:` pointer)

Enforcement: `pnpm spec:validate` (stub; full implementation Phase 9) checks frontmatter on every PR.

**R17.4 review gate (`validated → approved`):** Engineering lead review BEFORE bumping `status: draft → approved` on a phase's artifacts. Distinct from `/speckit.analyze` (mechanical) — the review is **judgment** (doom check, design soundness, kill-criteria realism). Centralized templates: [`templates/phase-review-prompt.md`](templates/phase-review-prompt.md) v1.0 + [`templates/phase-review-report.template.md`](templates/phase-review-report.template.md) v1.0. Recommendation: **APPROVE** / **REVISE** / **RE-SPEC**. See CLAUDE.md §8d for the order-of-gates protocol (`/speckit.analyze` first → resolve CRITICAL/HIGH → phase review → bump status).

### 12.7 Delta-based updates (Constitution R18)

Every spec update MUST include a `delta:` block in frontmatter AND a changelog entry enumerating what is `new`, `changed`, `impacted`, `unchanged`. Silent edits are rejected in PR review. Delta entries are append-only — when v1.1 supersedes v1.0, both deltas remain in the changelog with v1.0 marked `superseded by v1.1`.

### 12.8 Phase rollups (Constitution R19)

At the end of every phase, a `phase-<N>-current.md` rollup SHALL be produced by `pnpm spec:rollup --phase <N>` before the next phase starts. The rollup is the compressed current-system baseline that Phase N+1 reads; Phase N+1 does NOT re-load Phase N's full artifacts.

**Rollup capture** (~200 lines max, per Rule R19.5):
- Active modules introduced
- Data contracts in effect
- System flows now operational
- Known limitations carried forward
- Open risks for next phase
- Conformance gate status

**Template:** `docs/specs/mvp/templates/phase-rollup.template.md`.

**State:** `approved` immediately at phase exit; transitions to `verified` when N+1 starts; to `superseded` when N+1 rollup lands (earlier rollups retained as `verified` history).

### 12.9 Impact analysis for cross-cutting changes (Constitution R20)

Any PR modifying a shared contract — `AnalyzePerception`, `PageStateModel`, `AuditState`, `Finding`, any adapter interface, DB schema, MCP tool interface, or grounding rule interface — MUST include an `impact.md` analysis documenting:
- Affected modules
- Affected contracts (before / after)
- Breaking / not breaking + migration steps
- Risk level (low / medium / high)
- Conformance tests that guard the change
- Downstream ripple (which other artifacts need updating)

**Template:** `docs/specs/mvp/templates/impact.template.md`.

For additive-only changes (new fields with defaults, new adapters, new grounding rules), `impact.md` is still required — the discipline of producing it catches ripple effects; content can be short.

Breaking-change PRs without an approved `impact.md` are rejected.

### 12.10 Traceability matrix (Constitution R21)

A central traceability matrix (`docs/specs/mvp/spec-to-code-matrix.md`) maps every REQ-ID → spec section → implementation file + lines → tests → status. Auto-generated by `pnpm spec:matrix`. CI runs `pnpm spec:matrix --check` on every PR; a REQ-ID referenced in a spec with `status: implemented` but no code reference fails the build.

**Template:** `docs/specs/mvp/templates/spec-to-code-matrix.template.md`.

**Code-side convention:** every REQ-ID implementation carries a comment marker:

```typescript
// REQ-GROUND-007: NEVER predict conversion impact
// Implements rule GR-007 from §07.7 (§07 analyze-mode.md).
export function groundGR007(...) { ... }
```

The matrix is read-only reference — never hand-edited (Rule 21.5). Changes flow: update specs or code → re-run `pnpm spec:matrix` → commit.

## Cross-references

- Constitution R17-R22 (lifecycle, delta, rollup, impact, matrix, Ratchet)
- Constitution R23 (Kill criteria — required pre-task per phase plan)
- Constitution R24 / R25 / R26 (Perception / Context Capture / State Exploration MUST-NOTs)
- PRD §10 (Claude Code operational boundaries — workflow consumers)
- PRD §10.6 (Agent self-verification against acceptance criteria — Spec Coverage section in PR body)
- PRD §10.7 (modular prompt rule — context budget <20K tokens per task)
- PRD §10.9 (PR Contract — 4-block format)
- PRD §10.10 (Comprehension-debt pacing)
- CLAUDE.md §8c (per-phase artifact maintenance — R17 lifecycle bumps + INDEX.md status flip)
- CLAUDE.md §8d (R17.4 phase review gate — order of gates)
- `docs/specs/mvp/README.md` v2.0 (entry point + document map)
- `docs/specs/mvp/templates/` (R17-R21 templates + centralized phase-review-prompt + report)
- `docs/specs/mvp/phases/INDEX.md` v1.4 (phase decision table — realizes §12.5.2)
- `docs/specs/mvp/scripts/README.md` (6 stub scripts; full impl Phase 9)
- `.specify/workflows/speckit/workflow.yml` (Spec Kit CLI command registry)
