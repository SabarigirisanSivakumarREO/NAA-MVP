---
name: neural-master-orchestrator
description: Use this skill when the user invokes /master <N> --start, --gate-1, --gate-2, --pipeline, or status to drive a phase implementation through 4 automated stages and 2 human gates per phase. Coordinates pre-flight (analyze + matrix + AI Reviewer), parallel subagent implementation, code review, verification, and exit (R17 status bumps + R19 rollup + INDEX flip + R20 cross-phase propagation). Tracks state in .phase-state/<N>.json (resumable across sessions). Enforces cost ceiling and risk-gate high-attention mode. Never edits code itself — delegates to subagents.
---

# Neural Master Orchestrator

## Purpose

The orchestrator agent. Drives a phase from spec to done across 4 automated stages with 2 human gates per phase. Coordinates the AI Reviewer skill, parallel subagent dispatch, diff review, R17 lifecycle bumps, R19 rollup, INDEX.md flip, R20 cross-phase propagation, cost ceiling, risk-gate attention mode.

**This skill never edits code itself.** It delegates ALL file modification to subagents — its role is orchestration only.

## Invocation surface

| Command | Effect |
|---|---|
| `/master <N> --start` | Initialize Phase N state; run Stage 1 pre-flight; pause at Gate 1 |
| `/master <N> --gate-1 APPROVE` | Resume after Gate 1; run Stage 2 impl + Stage 2.5 code review + Stage 3 verify; pause at Gate 2 |
| `/master <N> --gate-1 REVISE` | Apply approved spec patches; re-run Stage 1 |
| `/master <N> --gate-1 RE-SPEC` | Pause phase; escalate; preserve state |
| `/master <N> --gate-2 APPROVE` | Resume after Gate 2; run Stage 4 exit; suggest next phase |
| `/master <N> --gate-2 RETURN-TO-IMPL` | Re-dispatch fix subagents per identified tasks |
| `/master <N> --abort` | Roll back to last clean state; preserve work-in-progress in `.phase-state/<N>/abort-snapshot/` |
| `/master <N> --resume` | Resume from a context-limit checkpoint OR cost-ceiling pause in a fresh session; reads `.phase-state/<N>.json` + latest handoff doc; reconciles state vs git; continues from checkpointed stage with fresh 700K context budget |
| `/master <N> --high-attention` | Force risk-gate mode for this phase regardless of auto-trigger |
| `/master --pipeline auto` (default) | Master decides per-transition whether to overlap N+1 pre-flight |
| `/master --pipeline always` | Always overlap |
| `/master --pipeline never` | Always sequential |
| `/master status` | Show state of all 15 phases |

## Boot context (JIT per phase)

When invoked with `--start` or any after-gate command:

1. Read `.phase-state/<N>.json` (resume if exists; initialize if not)
2. Load required artifacts:
   - `CLAUDE.md`
   - `docs/specs/mvp/sessions/session-handover.md` (latest)
   - `docs/specs/mvp/phases/INDEX.md`
   - Active phase folder: `phase-<N>-*/{README,spec,plan,tasks,impact}.md`
   - Predecessor phase rollup: `phase-<N-1>-*/phase-<N-1>-current.md` (R19)
3. Verify state file timestamp <24 hrs; warn if older (prompt cache cost on resume)

**Never bulk-load multiple phases.** CLAUDE.md §8c discipline. JIT per phase only.

## Stage execution

| Stage | Description | Reference |
|---|---|---|
| 1 — Pre-flight | Run `/speckit.analyze` + `pnpm spec:matrix --phase <N>`; verify R20 impact.md presence | [`references/state-machine.md`](references/state-machine.md) |
| 1b — AI Review | Invoke `neural-ai-reviewer` skill with `--gate pre-flight`; receive verdict | Same |
| 🚦 Gate 1 | Pause; render verdict summary; await human stamp | Same |
| 2 — Implementation | Task classifier → dispatch plan; sequential foundation tasks → parallel subagent fan-out | Same + [`pipeline-mode.md`](references/pipeline-mode.md) |
| 2.5 — Code Review | Invoke `superpowers:code-reviewer` agent on full impl diff | Same |
| 3 — Verification | `pnpm lint + typecheck + test + test:conformance + test:integration`; classify failures | Same |
| 3b — AI Review | Invoke `neural-ai-reviewer` skill with `--gate verification`; receive verdict | Same |
| 🚦 Gate 2 | Pause; render verdict summary; await human stamp | Same |
| 4 — Exit | R17 status bumps; R19 rollup; INDEX.md flip; R20 propagation; branch push | Same |

## Skill orchestration responsibilities (delegation map)

| Responsibility | Delegated to |
|---|---|
| Cross-artifact consistency findings | `/speckit.analyze` command |
| AC↔test traceability matrix | `pnpm spec:matrix` (artifact #2) |
| Gate verdict synthesis | `neural-ai-reviewer` skill |
| Task classification (parallel/sequential/shared-contract) | Task classifier prompt (artifact #3) |
| Parallel subagent fan-out | `superpowers:dispatching-parallel-agents` skill |
| Subagent brief generation | Subagent brief template (artifact #4) |
| Diff forbidden-pattern check | Diff reviewer prompt (artifact #5) |
| Test failure classification | Test-failure classifier prompt (artifact #6) |
| Semantic code review (Stage 2.5) | `superpowers:code-reviewer` agent |
| Phase brief at impl start | `neural-dev-workflow-brief` skill (existing hook) |
| PR contract + R19 rollup at impl end | `neural-dev-workflow-pr` skill (existing hook) |
| Cross-phase R20 propagation | Artifact #9 cross-phase impact propagator |
| Context budget tracking + session handoff | [`references/context-budget.md`](references/context-budget.md) (50% WARN, 70% checkpoint+handoff) |

**Master never duplicates these.** Always invoke; never re-implement.

## Pipeline mode

See [`references/pipeline-mode.md`](references/pipeline-mode.md). Default `auto`: master recommends per-transition; user confirms with `Y/N/W` prompt. Decision logic considers shared-contract changes, risk tier, cost headroom, estimated impl duration.

## Cost ceiling

See [`references/cost-ceiling.md`](references/cost-ceiling.md). Defaults:
- **Daily ceiling:** $50 (pause at 70% = $35; stop at 100% = $50)
- **Per-phase ceiling:** $10 (pause at 70% = $7; stop at 100% = $10)
- **Per-LLM-call ceiling:** $1 (warn-level only)

Configurable via `.phase-state/cost-config.json`. Master reads on every cost check.

## Risk-gate high-attention mode

See [`references/risk-gate-mode.md`](references/risk-gate-mode.md). Auto-triggers when:
- Phase 7 first-real-Claude implementation (T117/T119)
- Phase 7 first-real-grounding implementation (T122-T130)
- Any phase touching ≥3 shared contracts (R20)
- Any phase with HIGH severity finding from prior pre-flight

Manual trigger via `/master <N> --high-attention`.

Adjustments under risk-gate mode:
- Parallel fan-out reduced (max 3 vs typical 9)
- Per-phase cost ceiling reduced 50%
- AI Reviewer two-pass critic mandatory (no skip)
- User availability flag set (master pauses for ad-hoc check-ins)
- Verbose logging mode

## Constitutional anchors

| Rule | How master enforces |
|---|---|
| R3.1 | Subagent briefs require contract test FIRST (TDD) |
| R5.6 | AI Reviewer two-pass auditor + critic mandatory at gates |
| R6 | Heuristic body NEVER in subagent briefs / commits / logs |
| R10 | File ≤300 lines / function ≤50 lines — verified by diff reviewer |
| R11.4 | Spec patches BEFORE impl when AI Reviewer flags spec gap |
| R14 | Pino correlation fields verified in subagent diffs |
| R17 | Status bumps gated by AI Reviewer verdict + human stamp |
| R18 | Spec patches append delta blocks; never line removal |
| R19 | Phase rollup auto-drafted at exit; human reviews ~5 min |
| R20 | impact.md auto-drafted on shared-contract changes; downstream invalidation |
| R23 | Kill criteria checked before each stage transition |

## Skills the master orchestrator invokes

| Skill | Stage | Purpose |
|---|---|---|
| `neural-ai-reviewer` | 1b + 3b | Gate verdicts |
| `superpowers:dispatching-parallel-agents` | 2 | Parallel subagent fan-out |
| `superpowers:subagent-driven-development` | 2 | Per-task TDD discipline |
| `superpowers:code-reviewer` | 2.5 | Semantic code review |
| `neural-dev-workflow-brief` | 1 | Phase brief (existing hook) |
| `neural-dev-workflow-pr` | 4 | PR contract + R19 rollup (existing hook) |
| `/speckit.analyze` | 1 | Cross-artifact consistency |

## Output artifacts per phase run

| Stage | Master writes |
|---|---|
| 1 | `.phase-state/<N>/preflight-correctness.json` (analyze output)<br>`.phase-state/<N>/preflight-coverage.json` (matrix output)<br>`.phase-state/<N>/preflight-verdict.yaml` (AI Reviewer output)<br>`docs/specs/mvp/phases/phase-<N>-*/review-notes.md` (rendered for human stamp) |
| 2 | Per-task commits per CLAUDE.md §6 format<br>`tasks.md` `[x]` markers |
| 2.5 | `.phase-state/<N>/code-review-findings.yaml` |
| 3 | `.phase-state/<N>/verify-test-results.json`<br>`.phase-state/<N>/verify-verdict.yaml` (AI Reviewer output) |
| 4 | `phase-<N>-current.md` (R19 rollup)<br>`INDEX.md` row status flip 🟡 → 🟢<br>`session-handover.md` close-out append<br>`impact.md` (if R20 fires)<br>Branch push |

## Integration with `.specify/extensions.yml` hooks

Master agent INVOKES `/speckit.implement` at Stage 2 start. Existing hooks fire automatically:
- `before_implement` → `neural-dev-workflow-brief` (already wired)
- `after_implement` → `neural-dev-workflow-pr` (already wired)

Master does NOT replace these hooks — orchestrates around them. Stage 2 = run `/speckit.implement` + parallel-fan-out monitoring.

## Failure modes

| Scenario | Handling |
|---|---|
| Subagent diff fails forbidden-pattern check 3× | 3-strike STOP; escalate to user |
| AI Reviewer returns `LOW_CONFIDENCE_VERDICT` | Flag for human awareness; user stamps with caveat |
| Test failure classifier ambiguous | Log; do not auto-act; user decides at Gate 2 |
| Cost ceiling hit mid-impl | Pause; preserve state; user decides bump or abort |
| Cross-phase R20 invalidates downstream | Auto-invalidate N+1, N+2 pre-flights; re-queue when N exits |
| Master state file corrupted | Refuse to proceed; require user resync |
| Skill invocation fails (Skill tool error) | Retry once; if still failing, escalate |
| User stamp delayed >24 hrs | Master checkpoints state; warn about prompt cache cost on resume |
| User invokes `--abort` mid-impl | Roll back to last clean state; preserve work-in-progress in `.phase-state/<N>/abort-snapshot/` |

## What this skill is NOT

- NOT a code editor (delegates all edits to subagents)
- NOT an analyzer (consumes `/speckit.analyze` + matrix outputs)
- NOT a reviewer (invokes `neural-ai-reviewer` skill)
- NOT a test runner (consumes test results from `pnpm` invocations)
- NOT a substitute for human judgment at Gates 1+2

## Cross-references

- [`../neural-ai-reviewer/SKILL.md`](../neural-ai-reviewer/SKILL.md) — Gate verdict skill (invoked Stage 1b + 3b)
- [`references/state-machine.md`](references/state-machine.md) — full state transitions + persistence + resume
- [`references/pipeline-mode.md`](references/pipeline-mode.md) — cross-phase overlap decision tree
- [`references/cost-ceiling.md`](references/cost-ceiling.md) — daily/per-phase budget enforcement
- [`references/risk-gate-mode.md`](references/risk-gate-mode.md) — Days 6-7 attention adjustments
- `CLAUDE.md` §8c (JIT discipline) + §8d (R17.4 review gate) + §9 (subagent dispatch policy)
- `docs/specs/mvp/constitution.md` — all R-NN rules cited
- `.specify/extensions.yml` — existing hooks fired transparently when master invokes `/speckit.implement`
