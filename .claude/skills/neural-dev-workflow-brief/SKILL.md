---
name: "neural-dev-workflow-brief"
description: "Apply phase-level Brief + Kill criteria + comprehension-debt check + R17.4 verification BEFORE /speckit.implement starts processing phase tasks. Auto-invoked as before_implement hook per .specify/extensions.yml. Outputs a phase-Brief block + go/no-go decision."
argument-hint: "Optional phase number/name override (defaults to active feature dir)"
metadata:
  author: "neural-dev-workflow"
  source: ".claude/skills/neural-dev-workflow/references/templates.md"
user-invocable: true
disable-model-invocation: false
---

# Neural Dev Workflow — Brief (before_implement hook)

This is the per-phase entry hook for `/speckit.implement`. Applies neural-dev-workflow discipline at phase scope BEFORE task execution begins.

## When this fires

- Auto: as a `before_implement` hook from `.specify/extensions.yml` when `/speckit.implement` is invoked
- Manual: `/neural-dev-workflow-brief` to run the same gate ad-hoc before starting a phase

## Pre-execution checks

1. **Resolve active phase.** Parse the FEATURE_DIR from `.specify/scripts/powershell/check-prerequisites.ps1` output OR from the user-supplied phase name argument.

2. **Verify R17.4 gate (CLAUDE.md §8d).** Read `phases/phase-<N>-<name>/spec.md` frontmatter `status:` field:
   - `status: approved` → proceed (gate passed)
   - `status: draft` → STOP. Output: "Phase {N} is at status: draft. Run `/speckit.analyze` first, then phase review using `templates/phase-review-prompt.md`. Do NOT proceed to implementation until R17.4 review APPROVES the phase."
   - `status: validated` → STOP. R17.4 review pending. Same instruction as draft.
   - `status: implemented` / `verified` → STOP. Phase already complete. Output: "Phase {N} is at status: {value}. /speckit.implement should not run on a completed phase. Did you mean Phase {N+1}?"

3. **Verify R20 impact.md presence.** If `phases/phase-<N>-<name>/impact.md` exists, confirm it's also at `status: approved`. If shared contracts are touched but no impact.md exists, STOP with R20 reference.

4. **Verify predecessor rollup (R19).** If N > 0, check `phases/phase-<N-1>-<name>/phase-<N-1>-current.md` exists. If missing AND Phase N-1 is at `status: implemented` or `verified`, output a warning that the rollup wasn't authored — predecessor context will be incomplete for this phase.

## Phase-level Brief output

Output the following block (this is what /speckit.implement reads as it starts):

```markdown
## Phase Brief (per neural-dev-workflow)

**Phase ID:** phase-{N}-{name}
**Status:** approved (R17.4 reviewed)
**Tasks:** {count from tasks.md} — execution order per plan.md §sequencing
**Risk tier:** {LOW | MEDIUM | HIGH from spec.md frontmatter or plan.md}
**Dependencies satisfied:** {predecessor phase status check}

**Outcome (1 sentence):** {extracted from spec.md §Goal or §Outcome}

**Context loaded (PRD §10.7 — target <20K tokens):**
- constitution.md v1.3 (R1-R26)
- PRD §10 (boundaries) + §11 (domain)
- phases/phase-{N}-{name}/{spec,plan,tasks}.md
- impact.md (if present)
- predecessor phase-{N-1}-current.md rollup (if exists)

**Constraints (from constitution + PRD):**
- R3 TDD: tests before implementation
- R6 IP boundary: heuristic content NEVER in API responses, dashboards, logs, traces, fixtures
- R10/R13: temperature=0 on evaluate / self_critique / evaluate_interactive
- R20 impact.md present for shared-contract changes
- R23 kill criteria (see below)

**Non-goals (this phase):**
{extracted from spec.md "Out of Scope" or plan.md §non-goals}

**Acceptance criteria (phase-exit):**
{enumerated from tasks.md exit criteria + spec.md AC-NN list}

**Verification plan:**
- pnpm lint && pnpm typecheck && pnpm test
- pnpm test:conformance -- {component(s)}
- {phase-specific acceptance test if defined, e.g., T148 for Phase 8, T175 for Phase 9}
```

## Kill Criteria block (R23)

Output the following block (mandatory per R23 for any phase with > 2 hr estimate, shared-contract changes, subagent dispatch, or LLM budget > $0.50):

```markdown
## Kill Criteria (R23)

**Resource:**
- Token budget: 85% of {phase LLM budget from plan.md} → pause and escalate
- Wall-clock: phase exceeds 2× plan.md estimate → stop, re-scope
- Iterations: 3+ tries on same error → stop, reassign

**Quality:**
- Any previously-passing test breaks during this phase
- pnpm test:conformance failure (any of the {N} conformance rows touched)
- Implementation reveals spec defect → fix spec first per R11.4

**Scope:**
- Diff introduces forbidden pattern (R13: `any` without TODO, console.log, direct SDK import outside adapters, disabled test)
- Cross-cutting change emerges without impact.md (R20)
- Subagent diff drifts beyond declared scope

**On trigger (R23.4):**
1. Commit WIP to wip/killed/{phase-N-task}-{reason} branch
2. Log reason — to audit_events (PRODUCT) or task thread (META)
3. Escalate with specific failure mode
4. Do NOT silently retry or bypass with --no-verify
```

## Comprehension-debt pacing pre-check

Before /speckit.implement starts dispatching tasks (especially [P] parallel tasks), run the pre-dispatch checklist from `.claude/skills/neural-dev-workflow/references/delegation-and-pacing.md` §"Pre-dispatch checklist":

- [ ] Can I summarize what each task is doing in one sentence right now?
- [ ] Do I have ≥ 30 min of uninterrupted review time available per round?
- [ ] Are the [P] tasks independent enough that diffs won't need cross-referencing?
- [ ] Am I within the 3-5 agent realistic ceiling?
- [ ] Have I completed review of the PREVIOUS dispatch round?

If ANY answer is "no" → reduce parallel count BEFORE /speckit.implement proceeds.

## Output

After completing all checks + emitting the Phase Brief + Kill Criteria + comprehension-debt pacing notes, return control to /speckit.implement. The orchestrator continues with task execution per its Outline §3-§9.

If any STOP condition triggered above, halt and report to user. /speckit.implement should not proceed.

## Cross-references

- `.claude/skills/neural-dev-workflow/SKILL.md` — main skill (always-loaded discipline patterns)
- `.claude/skills/neural-dev-workflow/references/templates.md` §Brief + §Kill Criteria — canonical templates
- `.claude/skills/neural-dev-workflow/references/delegation-and-pacing.md` §Pre-dispatch checklist
- `docs/specs/mvp/constitution.md` v1.3 R23 (Kill Criteria) + R17.4 (review gate) + R20 (impact analysis)
- `docs/specs/mvp/PRD.md` §10.7 (modular prompt rule) + §10.10 (Comprehension-debt pacing)
- `CLAUDE.md` §8c (per-phase artifact maintenance) + §8d (R17.4 gate)
- `.specify/extensions.yml` (`before_implement` hook registration)
