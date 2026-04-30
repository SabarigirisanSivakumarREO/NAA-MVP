# Five-Layer Harness (applied to Neural)

**Source:** `docs/engineering-practices/ai-orchestration-research-2026-04-24.md` §Part 1 §8 (agent-harness-engineering).

Core insight: *"A decent model with a great harness beats a great model with a bad harness."*

Use this as a diagnostic. When a Neural task is going wrong, ask which layer has the gap — then fix at that layer, don't patch around it.

## 1. Context Management

**What it is:** What the model reads before acting.

**Neural's current tools in this layer:**
- `CLAUDE.md` (always loaded)
- `docs/specs/mvp/README.md` v2.1 (entry point + document map; ships the session-bootstrap kickoff prompt)
- `docs/specs/mvp/constitution.md` v1.3 (always citeable, R1-R26)
- PRD §10 (operational boundaries — always in task context)
- Phase-sharded spec/plan/tasks under `docs/specs/mvp/phases/` (15 folders; 0 + 0b + 1 approved per R17.4)
- `docs/specs/mvp/examples.md` (pattern library)
- `docs/specs/mvp/architecture.md` / `testing-strategy.md` / `risks.md` / `spec-driven-workflow.md` v1.1 (sibling docs extracted from PRD §6/§9/§15/§12)
- `docs/specs/mvp/implementation-roadmap.md` v0.3 (walking-skeleton 12-week plan; Wednesday demo cadence)
- Skills (`.claude/skills/*/SKILL.md`) — loaded on-demand
- User auto-memory (`memory/*.md`) — persistent across sessions
- Context7 MCP — external library docs

**Gap signals:**
- Claude Code invents APIs or fields not in the spec → missing spec section loaded
- Same mistake repeats across tasks → rule missing from CLAUDE.md or skill
- Claude Code re-reads the entire PRD per task → PRD §10.7 one-task-per-prompt discipline slipping
- Spec conflicts produce silent picks → violates R1.4 (ASK when specs disagree)

## 2. Execution

**What it is:** Where code actually runs and what commands it can execute.

**Neural's current tools in this layer:**
- Bash tool (sandboxed per session)
- docker-compose (local dev stack: Postgres 16 + pgvector, Valkey 8, Mailpit)
- pnpm + Turborepo
- Playwright binary
- Git (branches, worktrees for agent isolation per CLAUDE.md §9)

**Gap signals:**
- Commands hang waiting for input → missing `-y`/`--yes` flag or interactive-mode bypass
- State bleeds between agent sessions → should be using git worktrees for parallel subagents
- Destructive ops happening by accident → Control-layer guard missing (see Layer 4)

## 3. Knowledge

**What it is:** Durable memory that survives beyond one task.

**Neural's current tools in this layer:**
- Git repo (source of truth)
- `docs/` — specs + engineering practices + synthesis docs
- `docs/specs/mvp/sessions/` — per-session handover notes (Session 6 closeout 2026-04-30; Round 1-5 doc sync 2026-05-01)
- `docs/specs/mvp/risks.md` — 10-risk register + lethal-trifecta contingencies + fallback protocols (extracted from PRD §15 on 2026-04-24)
- `memory/*.md` — user-specific auto-memory
- R21 traceability matrix (auto-generated, authoritative REQ-ID → code mapping)
- At runtime (PRODUCT side): `audit_events`, `llm_call_log`, `rejected_findings` (all append-only per R7.4)

**Gap signals:**
- Rule-relevant failures recur but the rule isn't documented → Ratchet (R22) gap: add the rule with `why:` provenance
- Agent repeats a lesson already learned → Knowledge Layer didn't surface the prior learning; check `memory/` files + most recent `sessions/` handover
- Failure in MVP that was flagged as a risk in `risks.md` 10-risk register → lessons weren't absorbed; re-read risks.md before next attempt

## 4. Control

**What it is:** Guardrails that prevent, detect, and intercept failures.

**Neural's current tools in this layer:**
- Pre-commit hooks (lint + typecheck + test + conformance per PRD §11.5.3)
- Constitution R13 forbidden-pattern list (`any` without TODO, `console.log`, direct SDK imports outside adapters, disabled tests)
- PRD §10.3 NEVER rules
- Kill criteria per R23 (pre-task definition + runtime trigger)
- CI blocks on missing PR Contract (§10.9) or Spec coverage (§10.6)
- TemperatureGuard at adapter boundary (R10)
- GR-001..GR-012 deterministic grounding rules (PRODUCT side)
- Impact analysis (`impact.md`) required for shared-contract changes (R20)
- Two-store pattern + warm-up mode (prevents auto-publish of findings)

**Known gaps (v2.2 → v2.3):**
- No pre-tool-call hook layer beyond Spec Kit and standard git hooks
- No post-edit hook that runs conformance tests before agent moves on
- "Success is silent, failures are verbose" inversion not formalized — Pino logs exist but error-injection-back-into-loop is ad-hoc

These gaps are acknowledged, not deferred. Per R22 Ratchet: when a failure recurs that a Control gap would have caught, add the hook and trace in `why:` provenance to this file.

## 5. Coordination

**What it is:** How multiple agents (or nodes) hand off work.

**Neural's current tools in this layer:**
- LangGraph.js (AuditGraph — PRODUCT coordination)
- Sub-agent dispatch policy (CLAUDE.md §9 + PRD §10.5 + §10.10)
- Two-Agent Verification pattern (see `patterns.md`)
- Reproducibility snapshot (R10 + §25) — coordinates stateful consistency across re-runs
- `MAX_ITERATIONS=8` cap (see `patterns.md`)
- R19 phase rollups (`phases/phase-N-current.md`) — per CLAUDE.md §8c; predecessor phase's compressed system state for Phase N+1 to read first INSTEAD of full predecessor artifacts
- R20 impact.md — required for any task touching shared contracts (AnalyzePerception, PageStateModel, AuditState, Finding lifecycle, adapter interfaces, DB schema, MCP tool interfaces, grounding rule interfaces)
- R17.4 phase-review templates (`docs/specs/mvp/templates/phase-review-prompt.md` + `phase-review-report.template.md`) — judgment review before status: draft → approved per CLAUDE.md §8d
- `/speckit.implement` ↔ neural-dev-workflow hook integration (`.specify/extensions.yml` `before_implement` / `after_implement`) — phase-level Brief + PR Contract handoffs

**Gap signals:**
- Subagents deliver diffs that assume conflicting states of the same file → no file-ownership rule enforced (CLAUDE.md §9 says don't; enforce in Brief)
- Cross-node data contract mismatches (e.g., AnalyzePerception shape drifts between DeepPerceive and Evaluate) → missing `impact.md` (R20) OR drift past the R17 lifecycle gate
- Agent hands off work without notifying orchestrator → Brief format missing a hand-off block

## How to use this layer diagnostic

When something goes wrong, ask in order:

1. **Context:** Did the model have what it needed to read?
2. **Knowledge:** Did the lesson already exist somewhere?
3. **Control:** Why didn't a guardrail catch this?
4. **Execution:** Did the commands run in the environment they were designed for?
5. **Coordination:** Was the handoff clean?

Fix at the layer where the gap lives. Don't patch a Context gap with a Control rule — the rule will bloat, the real fix won't happen, and R22 Ratchet will eventually surface the unused rule for removal.
