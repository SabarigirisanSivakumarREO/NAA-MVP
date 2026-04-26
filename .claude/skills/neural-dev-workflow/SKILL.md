---
name: neural-dev-workflow
description: Use when actively building Neural (implementing a task from docs/specs/mvp/phases/, writing a PR body, dispatching subagents via Agent tool, or reviewing subagent output). Applies AI-orchestration patterns synthesized from Addy Osmani's agentic-engineering corpus — Ralph Loop, five-layer harness, PR Contract, kill criteria, comprehension-debt pacing, Two-Agent Verification. Do NOT invoke for spec authoring (use speckit-* skills) or exploratory reading (use Explore agent).
---

# Neural Dev Workflow

Runtime playbook for AI-assisted development on Neural. Every pattern here traces to `docs/engineering-practices/ai-orchestration-research-2026-04-24.md` (Constitution R22 The Ratchet).

## When to invoke

- Any Phase task from `docs/specs/mvp/phases/phase-N-*/tasks.md`
- Any Agent tool dispatch (subagent work)
- Any PR body drafting
- Any review round after subagent output lands

## When NOT to invoke

- Spec authoring → `speckit-specify`, `speckit-plan`, `speckit-tasks`
- Code exploration → `Explore` agent directly
- Debugging → `superpowers:systematic-debugging`
- Brainstorming new features → `superpowers:brainstorming`
- Verification before claiming done → `superpowers:verification-before-completion`

## Source of truth

All patterns below trace to `docs/engineering-practices/ai-orchestration-research-2026-04-24.md`. If a pattern doesn't appear in that file, it does not belong here (Constitution R22 The Ratchet).

## Core patterns (one-line summaries)

| Pattern | Use | Reference |
|---|---|---|
| **Five-layer harness** | Diagnostic — when something breaks, find the layer with the gap: Context / Execution / Knowledge / Control / Coordination | [harness-layers.md](references/harness-layers.md) |
| **Ralph Loop** | Pick → Implement → Validate → Commit → Reset. Default flow for long-horizon work | [patterns.md](references/patterns.md) |
| **Two-Agent Verification** | Agent A implements, Agent B reviews, Agent A applies feedback. Sharpens Neural's evaluate → self-critique | [patterns.md](references/patterns.md) |
| **85% token auto-pause** | At 85% of budget, checkpoint and escalate rather than push through | [patterns.md](references/patterns.md) |
| **MAX_ITERATIONS=8** | Outer cap on retries; kill criteria triggers earlier (R23: 3 retries) | [patterns.md](references/patterns.md) |
| **Delegation matrix** | Fully delegate / delegate with checkpoints / retain. Architecture + security = always retain | [delegation-and-pacing.md](references/delegation-and-pacing.md) |
| **Comprehension-debt pacing** | Gate parallel dispatch on review capacity, not task independence. 3–5 agent ceiling | [delegation-and-pacing.md](references/delegation-and-pacing.md) |
| **PR Contract** | 4-block PR header (What/Why, Proof, Risk+AI, Review focus). Required by PRD §10.9 | [templates.md](references/templates.md) |
| **Kill criteria** | Pre-task stop conditions separate from acceptance. Required by Constitution R23 | [templates.md](references/templates.md) |
| **Brief format** | 7-block task scoping (Outcome, Context, Constraints, Non-goals, Acceptance, Integration, Verify) | [templates.md](references/templates.md) |
| **Provenance block** | `why:` frontmatter required on any new rule per R22.2 | [templates.md](references/templates.md) |

## Workflow — implementing a Phase task

1. **Scope with Brief format** → [templates.md §Brief](references/templates.md)
2. **Define kill criteria (R23)** → [templates.md §Kill Criteria](references/templates.md)
3. **Load context per PRD §10.7** — constitution + PRD §10 + target task spec + relevant examples.md section only. Target < 20K tokens.
4. **Decide: solo vs subagent** → [delegation-and-pacing.md §Delegation matrix](references/delegation-and-pacing.md)
5. **Implement** using Ralph-Loop framing → [patterns.md §Ralph Loop](references/patterns.md)
6. **Self-verify** against PRD §10.6 Spec coverage
7. **Draft PR with Contract + Spec coverage** → [templates.md §PR Contract](references/templates.md)
8. **Commit** per CLAUDE.md §6 format (`<type>(<scope>): <TaskID> <summary> (<REQ-ID>)`)

## Workflow — dispatching a subagent

1. **Pre-dispatch pacing check** — do I have capacity to REVIEW what I'm about to generate? → [delegation-and-pacing.md §Comprehension-debt pacing](references/delegation-and-pacing.md)
2. **Write Brief** — self-contained; subagent has no conversation context → [templates.md §Brief](references/templates.md)
3. **Declare kill criteria** in the Brief (R23)
4. **Dispatch** via Agent tool. One task per subagent (PRD §10.7).
5. **On return:** diff review for R13 forbidden patterns + Two-Agent Verification pass → [patterns.md §Two-Agent Verification](references/patterns.md)
6. **If any kill criterion fires:** snapshot to `wip/killed/<task>-<reason>`, log, escalate. Do NOT merge, do NOT `--no-verify`.
7. **Integrate + verify** — `pnpm test:conformance -- <component>` must pass (PRD §9.6)

## Workflow — drafting a PR body

Required sections, in this order:

1. `## PR Contract` — 4 blocks per PRD §10.9 → [templates.md §PR Contract](references/templates.md)
2. `## Spec coverage` — per PRD §10.6 — enumerate every acceptance criterion with ✅ / ❌ / 🟡
3. Test output — paste CI check summary + any conformance test results
4. Screenshots if UI-touching
5. Deviations from spec + approval reference (per PRD §10.8)

## Workflow — reviewing subagent output

1. Read Brief vs diff — are all acceptance criteria met?
2. Scan diff for R13 forbidden patterns (`any` without TODO, `console.log`, direct Anthropic/Playwright/pg imports outside adapters, disabled tests, hardcoded secrets)
3. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:conformance -- <component>`
4. Check file-by-file boundaries — did the subagent touch anything outside its declared scope?
5. Check Constitution §10.3 NEVER rules (no conversion predictions, no temp > 0 on analysis nodes, no updates to append-only tables, no heuristic-content leakage)
6. If kill criterion triggered: R23.4 protocol — do NOT silently retry

## Anti-patterns (stop immediately if you catch yourself)

- Dispatching subagents for tasks that touch the same file (merge conflict inevitable — CLAUDE.md §9)
- Using parallel dispatch to "move faster" when already behind on review (comprehension debt)
- Writing a PR body without both Spec coverage (§10.6) AND PR Contract (§10.9)
- Proceeding past a kill-criteria trigger with `--no-verify` or retrying the same failing prompt
- Adding a new rule to CLAUDE.md or a skill without a `why:` provenance line (R22.2)
- Model-tier routing on Neural's `evaluate` / `self_critique` / `evaluate_interactive` nodes (breaks R10 reproducibility)
- Carrying trust across domains — a subagent reliable on `grounding/` is not automatically reliable on `browser-runtime/`

## Cross-references

- `CLAUDE.md` §9 — sub-agent dispatch policy (operational companion)
- `docs/specs/mvp/constitution.md` R22–R23 — Ratchet + Kill criteria (rule-level)
- `docs/specs/mvp/PRD.md` §10.9–§10.10 — PR Contract + Comprehension-debt pacing (canonical)
- `docs/engineering-practices/ai-orchestration-research-2026-04-24.md` — source of truth (every pattern traces here)
