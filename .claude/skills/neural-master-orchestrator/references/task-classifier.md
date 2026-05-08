# Task Classifier — tasks.md → Dispatch Plan

## Purpose

Master invokes this at Stage 2 start. Reads the active phase's `tasks.md` and partitions tasks into three dispatch buckets per CLAUDE.md §9 sub-agent policy. Output is the dispatch plan that drives Stage 2 parallel/sequential subagent fan-out.

## When master invokes this

Once per phase, after Gate 1 APPROVE. Output stored in `.phase-state/<N>.json` `dispatch_plan` field.

## Inputs

- `docs/specs/mvp/phases/phase-<N>-*/tasks.md` — task list
- `docs/specs/mvp/phases/phase-<N>-*/spec.md` — for AC → file scope mapping
- `docs/specs/mvp/phases/phase-<N>-*/plan.md` — for module structure
- `docs/specs/mvp/phases/phase-<N>-*/impact.md` (if exists) — for shared-contract changes
- Predecessor phase rollups via INDEX.md `depends-on` graph — for already-frozen contracts

## Three buckets (per CLAUDE.md §9)

### Bucket 1 — `parallel`

Tasks that can be dispatched concurrently. ALL of:
- Touches DIFFERENT files than other parallel-bucket tasks
- Does NOT modify a shared schema (AnalyzePerception, PageStateModel, AuditState, Finding lifecycle, adapter interfaces, DB schema, MCP tool interfaces, grounding rule interfaces)
- Does NOT depend on another task's IMPL details (only on its interface, which is already specced)
- Has its own contract test path that's independent of siblings

Examples (general patterns, no hardcoded list):
- N independent grounding rule implementations (each is a pure function, separate file)
- N independent MCP tool implementations after the registry exists
- N independent dashboard page components after design tokens exist

### Bucket 2 — `sequential`

Tasks that must run in order due to:
- Each task depends on prior task's IMPL (not just interface)
- Tasks touch the SAME file
- Foundation task that other buckets depend on (e.g., schema definition before consumers)

Examples:
- BrowserManager → OverlayDismisser → StabilityWaiter (all share browser session state)
- DB schema migration → seed data → integration test
- Type definition → consumer code that uses the type

### Bucket 3 — `shared-contract`

Tasks that touch a constitutional shared-contract surface. Dispatched STRICTLY SEQUENTIALLY with extra discipline:
- Per-task R20 impact.md update required
- Diff reviewer in stricter mode (HIGH-severity blocks even at MED)
- Each landing triggers downstream pre-flight invalidation
- 3-strike → 2-strike retry budget

Detection signals (read dynamically from impact.md):
- Task description mentions a contract surface name
- impact.md `affected_contracts` lists the surface for this task
- Predecessor rollup `open_risks_for_next` flags drift

## Classification algorithm

For each task `T-NN` in tasks.md:

```
1. Extract from spec.md / plan.md / tasks.md:
   - allowed_files[] (typically the test path + impl path columns from spec table)
   - explicit_depends_on[] (if tasks.md numbers tasks with dependencies)
   - ac_anchor (which AC-NN this task satisfies)

2. Check for shared-contract surface:
   - Cross-reference allowed_files[] against constitutional contract list
     (read from impact.md if present, otherwise from constitution.md R20 list)
   - If match → bucket = shared-contract

3. Else check for sequential constraint:
   - Does another task in this phase touch any file in allowed_files[]?
     → bucket = sequential (group with that task)
   - Does explicit_depends_on[] reference another task whose IMPL not just interface
     is needed?
     → bucket = sequential
   - Is this the foundation task others reference?
     → bucket = sequential, ordered FIRST

4. Else → bucket = parallel

5. Within parallel bucket: all tasks dispatched in single Agent tool call
6. Within sequential bucket: ordered list; one subagent at a time
7. Within shared-contract bucket: ordered list; one subagent at a time, with
   diff-reviewer strict mode + R20 update requirement
```

## Output (dispatch plan)

```yaml
phase: <N>
generated_at: <ISO 8601>

dispatch_plan:
  parallel:
    - task_id: T-NN
      ac_anchor: AC-NN
      allowed_files: [<list>]
      reasoning: <why parallel>
  sequential:
    - order: 1
      task_id: T-NN
      ac_anchor: AC-NN
      allowed_files: [<list>]
      depends_on_impl: [<task ids>]
      reasoning: <why sequential>
  shared_contract:
    - order: 1
      task_id: T-NN
      ac_anchor: AC-NN
      allowed_files: [<list>]
      contract_surface: <e.g. AuditState | Finding | LLMAdapter>
      r20_impact_required: true
      reasoning: <why shared-contract>

dispatch_strategy:
  parallel_wave_size: <max concurrent; respects risk-gate cap>
  total_tasks: <N>
  estimated_total_subagents: <count>
  estimated_wallclock_hours: <rough>
```

## Risk-gate adjustments

When master state has `risk_gate_mode.active: true`:
- Parallel wave size capped at 3 (vs typical 9)
- Tasks classified as `parallel` may be reclassified to `sequential` if total parallel count > cap
- Logged: `reclassified_due_to_risk_gate: [<task ids>]`

## Algorithmic edge cases

| Edge case | Handling |
|---|---|
| tasks.md row has NO test path column | Flag as `incomplete_classification`; require human review |
| Task touches NO files (doc-only) | Bucket: `parallel`; trivial dispatch |
| Two tasks touch overlapping files but NO sequential dependency | Bucket: `sequential`; arbitrary order; logged |
| Task in shared-contract bucket has cyclic dependency on another | STOP; escalate to user; cannot dispatch automatically |
| Phase has 1 task only | Bucket: `sequential` with order=1; no dispatch optimization possible |
| All tasks classify as shared-contract | Phase is high-coordination; warn user; recommend `--high-attention` flag |

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Force-parallelize tasks just to save time | If shared file or shared schema → sequential, regardless of cost pressure |
| Hardcode "Phase 7 has 9 parallel grounding rules" | Read tasks.md dynamically; let signals drive classification |
| Bucket all tasks as `sequential` to be safe | Over-sequential = wasted parallelism budget; trust the signals |
| Treat impact.md absence as "no shared-contract risk" | Re-derive from constitution.md R20 list; impact.md may not be authored yet |
| Skip risk-gate cap | Cap is a safety property; never bypass |

## What this classifier is NOT

- NOT a planner (consumes tasks.md; does not author it)
- NOT a scheduler (master orchestrates dispatch timing)
- NOT a dependency analyzer in the build sense (focuses on dispatch concurrency, not build order)

## Cross-references

- [`SKILL.md`](../SKILL.md) — Stage 2 invocation
- [`pipeline-mode.md`](pipeline-mode.md) — cross-phase pipelining (different concern)
- [`risk-gate-mode.md`](risk-gate-mode.md) — fan-out cap adjustments
- [`templates/subagent-brief.template.md`](../templates/subagent-brief.template.md) — `allowed_files` populates `{{ALLOWED_FILES}}`
- `CLAUDE.md` §9 — sub-agent dispatch policy (source of bucket rules)
- `docs/specs/mvp/constitution.md` R20 — shared-contract list
