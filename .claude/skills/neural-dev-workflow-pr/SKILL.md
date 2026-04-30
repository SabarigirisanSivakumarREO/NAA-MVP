---
name: "neural-dev-workflow-pr"
description: "Draft phase-level PR Contract + Spec Coverage + R17 lifecycle bumps + R19 phase rollup + INDEX.md status flip AFTER /speckit.implement finishes processing phase tasks. Auto-invoked as after_implement hook per .specify/extensions.yml."
argument-hint: "Optional phase number/name override (defaults to active feature dir)"
metadata:
  author: "neural-dev-workflow"
  source: ".claude/skills/neural-dev-workflow/references/templates.md"
user-invocable: true
disable-model-invocation: false
---

# Neural Dev Workflow — PR + Closeout (after_implement hook)

This is the per-phase exit hook for `/speckit.implement`. Applies neural-dev-workflow discipline at phase scope AFTER task execution completes.

## When this fires

- Auto: as an `after_implement` hook from `.specify/extensions.yml` after `/speckit.implement` finishes Outline §9 Completion validation
- Manual: `/neural-dev-workflow-pr` to run the same closeout ad-hoc after a phase ships

## Pre-execution checks

1. **Resolve active phase.** Same as `before_implement` hook.

2. **Verify all tasks completed.** Read `phases/phase-<N>-<name>/tasks.md`. All items must be `- [x]` per /speckit.implement Outline §8 IMPORTANT marker. If any `- [ ]` remains, STOP. Output: "Phase {N} has {N} unchecked tasks. /speckit.implement reported completion but tasks.md disagrees. Re-run /speckit.implement or manually mark + investigate."

3. **Verify §8 self-check passed.** From recent commit messages on this branch, confirm each task carries the proper format `<type>(<scope>): <TaskID> <desc> (<REQ-ID>)` per CLAUDE.md §6. If commits are malformed, FLAG (don't STOP) — output suggested commit-message rewrite.

4. **Run final validation** (one more pass before drafting PR):
   - `pnpm lint && pnpm typecheck && pnpm test`
   - `pnpm test:conformance -- <components touched in this phase>` per `docs/specs/mvp/testing-strategy.md` §9.6 conformance matrix
   - Phase-specific acceptance test if defined (T148/T149/T150 for Phase 8; T174/T175 for Phase 9)
   - Any failure → STOP. Do not draft PR. Report failures + invoke `superpowers:systematic-debugging`.

## R17 lifecycle bumps (CLAUDE.md §8c)

Bump frontmatter `status:` per R17 lifecycle on the phase's artifacts:

| Artifact | Transition | Trigger |
|---|---|---|
| `spec.md` | `approved` → `implemented` | All tasks done, all tests green |
| `plan.md` | `approved` → `implemented` | Same |
| `tasks.md` | `approved` → `implemented` | Same |
| `impact.md` (if present) | `approved` → `implemented` | Same |
| `checklists/requirements.md` (if present) | `approved` → `implemented` | Same |

Each bump goes in the SAME commit. Append a `v_<next>` entry to the `delta:` block per R18:

```yaml
delta:
  v_<next>:
    new: []
    changed:
      - status: approved → implemented (all tasks complete; tests green; conformance matrix green)
    impacted: []
    unchanged: []
```

## R19 phase rollup scaffold

Author `phases/phase-<N>-<name>/phase-<N>-current.md` per R19 from `docs/specs/mvp/templates/phase-rollup.template.md`. Required sections:

- Active modules introduced this phase
- Data contracts now in effect
- System flows operational
- Known limitations carried forward
- Open risks for next phase
- Conformance gate status

This rollup is what Phase N+1 reads INSTEAD of this phase's full artifacts (CLAUDE.md §1b rollup-first rule). Keep ≤ 200 lines per R19.5.

`status: approved` initially; transitions to `verified` when Phase N+1 starts.

## INDEX.md status flip (CLAUDE.md §8c)

Update [`docs/specs/mvp/phases/INDEX.md`](docs/specs/mvp/phases/INDEX.md) — flip the phase row's status column:

- ⚪ not started → 🟡 in progress (when first task code lands; this normally happens earlier, not at after_implement)
- 🟡 in progress → 🟢 complete (when last task ships + R17 bumps + rollup authored)

Bump INDEX.md frontmatter `version:` and `updated:` per R18 + add a changelog entry under existing `## v<N> changes` section.

## PR Contract draft (PRD §10.9)

Output the 4-block PR Contract for the user to paste into the PR body:

```markdown
## PR Contract

1. **What / Why** (1-2 sentences):
   {extracted from phase spec.md §Goal + commit-message summaries}

2. **Proof** (concrete evidence):
   - Conformance: `pnpm test:conformance -- <components>` — {pass/fail counts}
   - Integration: {paths to integration test files modified or added}
   - Acceptance: {phase-specific acceptance test, e.g., T148 for Phase 8 or T175 for Phase 9 if applicable}
   - Manual: {screenshot / log excerpt / preview URL if UI-touching}

3. **Risk tier + AI involvement**:
   - Tier: {low | medium | high — from spec.md frontmatter or plan.md risk register}
   - AI-generated: {list of files/functions where Claude wrote the bulk; flag for extra review}
   - Human-written: {list — typically conformance test cases, security-critical logic, heuristic content per R6}

4. **Review focus** (3-5 bullets):
   {derived from impact.md §Risk + plan.md kill criteria + R23 trigger conditions}
```

## Spec Coverage section (PRD §10.6)

Output the Spec Coverage section enumerating every acceptance criterion in the phase's `tasks.md` exit criteria + `spec.md` AC-NN list:

```markdown
## Spec Coverage

| AC-ID | Met? | Evidence |
|---|---|---|
| AC-01 | ✅ Met | {file:line or test path} |
| AC-02 | ✅ Met | {evidence} |
| AC-03 | 🟡 Partial | {what's missing + plan to address} |
| AC-04 | ❌ Not met | {must NOT merge until resolved} |
| ... | ... | ... |

**Not covered by this PR (deferred):**
- {requirements explicitly out-of-scope per phase plan.md non-goals}
```

If any ❌ — STOP. Do not finalize the PR. Per CLAUDE.md §8 step 2: "do NOT declare complete; implement or escalate via ASK FIRST."

## Output

After all checks + lifecycle bumps + rollup scaffold + INDEX.md flip + PR Contract / Spec Coverage drafts, return control to /speckit.implement (or directly to user if invoked manually).

Final output is a ready-to-paste PR body + a list of files modified by this hook (status bumps, rollup, INDEX.md). The user reviews + commits + opens the PR (or invokes `/speckit-git-commit` to auto-commit).

## Cross-references

- `.claude/skills/neural-dev-workflow/SKILL.md` — main skill
- `.claude/skills/neural-dev-workflow/references/templates.md` §PR Contract — canonical template
- `docs/specs/mvp/templates/phase-rollup.template.md` — R19 rollup scaffold
- `docs/specs/mvp/templates/system-current.template.md` — system-state companion (PRODUCT side, when applicable)
- `docs/specs/mvp/PRD.md` v1.2.1 §10.6 (Spec Coverage) + §10.9 (PR Contract — 4 blocks)
- `docs/specs/mvp/constitution.md` v1.3 R17 (Lifecycle) + R18 (Delta) + R19 (Rollup) + R20 (Impact) + R21 (Traceability)
- `CLAUDE.md` §6 (commit format) + §8 (self-check) + §8c (artifact maintenance)
- `docs/specs/mvp/testing-strategy.md` §9.6 (conformance matrix — 18 rows)
- `.specify/extensions.yml` (`after_implement` hook registration)
