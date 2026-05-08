# Cross-Phase Impact Propagator (R20)

## Purpose

When Phase N exits with a shared-contract change, master detects which downstream phases (N+1, N+2, …) have stale assumptions and invalidates their cached pre-flight verdicts. Re-queues affected phase Stage 1 runs.

Closes the cross-phase drift gap discussed in pipeline-mode + state-machine.

## When master invokes this

At Stage 4 phase exit, before bumping `done` state. Triggered automatically when:
- The exiting phase's diff modified a constitutional shared-contract surface
- impact.md `affected_contracts` is non-empty for this phase
- Cross-artifact `/speckit.analyze` flagged DEPENDENCY_CONFLICT findings during Stage 1 OR Stage 3

Skipped when:
- impact.md absent AND no shared-contract files in diff (typical scope-internal phase)
- Phase aborted (no exit; nothing to propagate)

## Inputs

- Exiting phase's diff (Stage 2 + Stage 4 cumulative)
- Exiting phase's `impact.md`
- `docs/specs/mvp/phases/INDEX.md` — phase dependency graph (`depends-on` / `blocks` columns)
- `.phase-state/<N>.json` for all OTHER phases (to find which have cached pre-flight verdicts)
- `docs/specs/mvp/constitution.md` R20 — canonical shared-contract surface list

## Detection signals (read dynamically)

| Signal | Source |
|---|---|
| Diff touches AnalyzePerception / PageStateModel / AuditState / Finding lifecycle | git diff against constitutional list |
| impact.md `affected_contracts` field non-empty | YAML parse |
| impact.md `breaking: true` flag set | YAML parse |
| `/speckit.analyze` output `DEPENDENCY_CONFLICT` finding category | analyze JSON |
| Adapter interface changed (LLMAdapter / StorageAdapter / BrowserEngine / etc.) | diff scan |
| MCP tool interface changed | tool registry diff |
| Grounding rule interface changed | rule manifest diff |
| DB schema changed (Drizzle migration added) | migrations dir diff |

If ANY signal fires → propagation activates.

## Propagation algorithm

```
1. Identify changed surfaces:
   surfaces_changed = parse(exiting_phase.impact.md) ∪ detect_from_diff()

2. Identify downstream phases:
   downstream = INDEX.md phases where:
     - depends_on includes exiting_phase.id
     - OR transitively depends via the dependency graph

3. For each downstream phase D:
   D_state = read .phase-state/D.json
   
   if D_state.state in [done, aborted, not-started]:
     skip  # done/aborted already absorbed contract; not-started has no cache
   
   if D_state.state == preflight:
     mark D's preflight as STALE; re-trigger Stage 1 on next master invocation
   
   if D_state.state == review-pending:
     master re-runs Stage 1 BEFORE allowing Gate 1 stamp;
     log: "verdict invalidated by Phase N exit (surfaces: <list>)"
   
   if D_state.state in [impl, code-review, verify, exit-pending]:
     log warning + flag for human attention;
     do NOT auto-rollback (impl is committed; user decides if Phase D needs re-spec)

4. Update D's impact.md:
   append addendum: "Phase N exited with surface change <X>;
                     this phase's interpretation may be stale; re-validate at next pre-flight"

5. Cost penalty log:
   for each invalidated pre-flight verdict:
     record cost_wasted_usd in .phase-state/cross-phase-invalidations.log
     accumulator: total_invalidations_per_run

6. Master continues with Phase N's Stage 4 exit (R17 bump, R19 rollup, INDEX flip).
   Cross-phase work is async to N's exit — N is done regardless.
```

## Auto-drafted impact.md addendum format

When propagating to downstream phase D, master dispatches a spec-patch subagent (per [`templates/spec-patch-subagent-brief.template.md`](../templates/spec-patch-subagent-brief.template.md)) with:

```yaml
target: docs/specs/mvp/phases/phase-D-*/impact.md
action: append addendum entry
content: |
  ## Cross-phase invalidation from Phase {{N}} (auto-propagated, {{date}})
  
  Phase {{N}} exited with shared-contract change(s):
  {{surfaces_changed}}
  
  Downstream impact on this phase:
  - This phase's pre-flight verdict (if cached) is now STALE
  - Re-validate at next /master {{D}} --start invocation
  - Specific ACs that may be affected: {{affected_ac_ids}}
  
  Triggered by: master orchestrator R20 propagation rule
```

## Cycle detection

Phase dependency graph SHOULD be a DAG. If propagation discovers a cycle:

```
detected_cycle: A → B → C → A

Action:
  STOP propagation
  Log to .phase-state/cycle-warnings.log
  Escalate to user; cycles are spec-defect not runtime issue
```

CLAUDE.md §1c forbids cyclic phase dependencies; this is a sanity check, not normal flow.

## Cost penalty logging

Every invalidation costs ~$2-5 (the previously-cached pre-flight verdict that's now stale). Logged for pattern detection:

```
.phase-state/cross-phase-invalidations.log:
  date: 2026-05-09
  exiting_phase: 4
  surfaces_changed: [LLMAdapter, BudgetGate]
  invalidated_phases: [5, 6, 7]
  cost_wasted_usd_total: 8.40
  pattern_signal: "Phase 4 changed adapter interface that 3 downstream phases pre-flighted against"
```

If `pattern_signal` recurs >2x in MVP run → suggest reviewing whether shared-contract changes should be smaller (R20 discipline review).

## Master integration

State machine (per [`state-machine.md`](state-machine.md)) reads invalidation log on every Stage 1 boot:

```
On /master <N> --start:
  if .phase-state/<N>/invalidation-pending.flag exists:
    print "🔄 Pre-flight invalidated by upstream Phase X (surfaces: <list>); re-running Stage 1"
    delete flag
    proceed with Stage 1 from scratch (do NOT use cached verdict)
```

## Failure modes

| Scenario | Handling |
|---|---|
| Phase N's impact.md missing despite diff touching shared contract | Auto-derive surfaces from diff; warn user that impact.md should have been authored at Stage 1 |
| Downstream phase D's state file missing | Skip (D was never pre-flighted; nothing cached to invalidate) |
| Multiple upstream phases invalidate same downstream D in sequence | Accumulate; D's invalidation flag tracks all upstream sources |
| Cycle detected in dependency graph | STOP; escalate; cycles violate CLAUDE.md §1c |
| User had already stamped Gate 1 on D when invalidation fires | Master prints warning + un-stamps Gate 1; user re-stamps after re-validate |
| Invalidation triggered while D is mid-impl | Do NOT auto-rollback; flag impact.md addendum; user decides at D's Gate 2 |

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Silently invalidate without logging | Every invalidation logged with cost penalty + surfaces + reason |
| Auto-rollback downstream phases mid-impl | Flag for human; impl-in-progress is user's call |
| Skip propagation "to save the cached verdict" | Stale verdicts cause Phase 7 / 8 / 9 surprises later — pay the $2-5 now |
| Propagate without checking dependency graph | Could invalidate unrelated phases; always read INDEX.md depends-on |
| Hardcode "Phase 4 always invalidates Phase 6" | Detect dynamically from impact.md + diff signals |

## What this propagator is NOT

- NOT a build-system invalidator (no compiled artifacts; only spec/state cache)
- NOT a transaction system (best-effort invalidation; mid-impl phases preserve work)
- NOT a substitute for R20 impact.md authoring (master only auto-drafts addenda; original impact.md authored by Stage 1 + spec-patch subagents)

## Cross-references

- [`SKILL.md`](../SKILL.md) — Stage 4 invocation
- [`state-machine.md`](state-machine.md) — invalidation flag semantics
- [`pipeline-mode.md`](pipeline-mode.md) — pipelined N+1 pre-flight is the primary invalidation target
- [`templates/spec-patch-subagent-brief.template.md`](../templates/spec-patch-subagent-brief.template.md) — used to dispatch impact.md addenda
- `docs/specs/mvp/phases/INDEX.md` — phase dependency graph (canonical source)
- `docs/specs/mvp/constitution.md` R20 — shared-contract surface definition
- `CLAUDE.md` §1b (rollup-first rule) + §1c (impact-before-implementation rule)
