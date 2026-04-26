---
title: Neural MVP — Spec-Driven Workflow + Versioning
artifact_type: spec
status: approved
version: 1.0
created: 2026-04-24
updated: 2026-04-24
owner: engineering lead
authors: [REO Digital team, Claude]

supersedes: "docs/specs/mvp/PRD.md §12 (v1.2 inline content extracted to this file on 2026-04-24)"
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (v1.2 §12 — extracted)
  - docs/specs/mvp/constitution.md R17-R21 (lifecycle, delta, rollup, impact, matrix)

governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R19 (Rollup per Phase)
  - Constitution R20 (Impact Analysis)
  - Constitution R21 (Traceability Matrix)
  - Constitution R22 (The Ratchet)

delta:
  new:
    - File created by extracting PRD §12 to separate spec-driven-workflow doc (good-spec review Option A, 2026-04-24)
  changed: []
  impacted:
    - docs/specs/mvp/PRD.md §12 (replaced with pointer)
  unchanged:
    - Subsection numbering (12.1-12.10) preserved for cross-ref stability
---

# Neural MVP — Spec-Driven Workflow + Versioning

> **Summary (~100 tokens — agent reads this first):** Spec Kit CLI gated progression (PRD → /speckit.specify → /speckit.plan → /speckit.tasks → /speckit.analyze → /speckit.implement), semantic version bump rules, cross-doc synchronization, update process, context-management discipline (load only relevant section; target <20K tokens per task prompt), lifecycle states (R17), delta-based updates (R18), phase rollups (R19), impact analysis for cross-cutting changes (R20), and auto-generated spec-to-code traceability matrix (R21).

### 12.1 Spec Kit integration

The workflow follows GitHub Spec Kit's gated progression. This PRD is the input; Spec Kit CLI produces the downstream artifacts.

```
PRD.md (this document)
    │  (run Spec Kit CLI)
    ▼
/speckit.constitution   → updates docs/specs/mvp/constitution.md if needed
/speckit.specify        → generates docs/specs/mvp/spec.md from this PRD
/speckit.plan           → generates docs/specs/mvp/plan.md from spec.md + tech stack in §6.4
/speckit.tasks          → generates docs/specs/mvp/tasks.md from plan.md
/speckit.analyze        → cross-artifact consistency check
/speckit.implement      → executes tasks (or hand off to Claude Code + superpowers skills)
```

**Never skip a gate.** If a gate reveals ambiguity, return to the previous artifact and fix before proceeding.

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

When this PRD changes, check for downstream sync:

| This PRD changes | Sync to |
|---|---|
| Scope (§3.1) | Regenerate `spec.md` via `/speckit.specify` |
| Tech stack (architecture.md §6.4) | Regenerate `plan.md` via `/speckit.plan` |
| Functional req (§4) | Regenerate `spec.md` + `tasks.md` |
| Boundaries (§10) | Update `CLAUDE.md` §7 + `constitution.md` if new non-negotiable |
| Commands (§8) | Update `CLAUDE.md` §3 |
| Domain knowledge (§11) | Update `examples.md` |

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
3. **The task** from Spec Kit `tasks.md` — always
4. **Only the spec section(s) cited by the task's REQ-IDs** — use file-structure map in `architecture.md` §6.5
5. **Relevant `examples.md` section** if a pattern exists (grounding, findings, heuristics)
6. **Relevant PRD component section (§7.N)** matching the workspace being touched

**Do NOT load:**
- The full PRD (load only the relevant sections; sibling files for architecture, testing, workflow, risks are loaded on-demand)
- Unrelated architecture specs (e.g., don't give dashboard tasks §20 state-exploration spec)
- `PROJECT_BRIEF.md` for implementation tasks (it's for LLM analysis / gap analysis; strategic, not operational)

#### 12.5.2 Per-phase spec summary (to be generated)

For each phase in Spec Kit `tasks.md`, maintain a concise phase summary (~200-400 tokens) that captures:
- Phase goal (1 sentence)
- List of tasks in phase (IDs + 1-line descriptions)
- Required specs (REQ-IDs with file paths)
- Exit criteria
- Common pitfalls for this phase (from `examples.md`)

**Script (planned):** `pnpm spec:summarize --phase <N>` generates `docs/specs/mvp/phase-summaries/phase-<N>.md` from `tasks.md` + referenced specs. Target post-MVP but can be manual until then.

**Usage:** when starting a task in Phase N, load `phase-<N>.md` as the phase-level context instead of the entire PRD + master plan.

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

#### 12.5.4 Spec summarization pipeline (target state, v1.2)

```
docs/specs/final-architecture/§NN-<name>.md              (source of truth, 500-1500 lines each)
   │
   ▼ (summarization script, prompts Claude Sonnet 4)
docs/specs/mvp/phase-summaries/phase-<N>.md              (200-400 tokens, auto-regenerated)
   │
   ▼ (Spec Kit tasks.md references phase summary)
Claude Code prompt context                                (compact, targeted)
```

Until that pipeline exists, the rule is manual discipline: load only what §12.5.1 says to load.

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
- PRD §10 (Claude Code operational boundaries — workflow consumers)
- PRD §10.7 (modular prompt rule — context budget <20K tokens)
- `docs/specs/mvp/templates/` (all five R17-R21 template files)
- `docs/specs/mvp/phases/INDEX.md` (phase navigation)
- `.specify/workflows/speckit/workflow.yml` (Spec Kit CLI command registry)
