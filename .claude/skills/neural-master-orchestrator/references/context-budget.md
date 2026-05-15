# Context Budget — Session Handoff Protocol

## Purpose

Master tracks session context usage in real-time against Opus 4.7's 1M-token window. Two thresholds — early warning at 50%, hard ceiling with checkpoint+handoff at 70%. Protects attention quality (long-context degradation kicks in above ~600K) and enables seamless mid-phase session splits without lost work.

## Thresholds

| Level | % of 1M | Tokens | Action |
|---|---|---|---|
| **WARN** | 50% | 500K | Auto-compact non-critical refs; print warn; tighten subagent budgets; user may continue |
| **HARD CEILING** | 70% | 700K | Checkpoint + handoff; master halts session; user opens new session and runs `/master <N> --resume` |
| Window cap | 100% | 1M | Never reached; model limit |

Master never exceeds 70%. The 30% headroom protects against attention degradation, provides safety margin for mid-stage work, and ensures resume is clean.

## Tracking

Master estimates context usage from:
- Boot tokens (CLAUDE.md + handover + INDEX + phase folder + predecessor rollup): ~100-180K typical
- Subagent diff returns reviewed during Stage 2: ~5-15K each
- AI Reviewer + code reviewer outputs: ~10-50K total
- Cumulative tool returns and master's own reasoning: ~50-150K

Token counts derived from Anthropic SDK `usage` metadata on every LLM call. Persisted in `.phase-state/<N>.json` `context_usage.current_session_peak`.

## WARN protocol — at 50% (500K)

Auto-compaction fires immediately. Master adjusts behavior:

| Adjustment | Effect |
|---|---|
| Diff history compaction | Full diff text → SHA + 1-line summary per committed task |
| Pipeline overlap disabled | `--pipeline auto` switched to never; no N+1 pre-flight in this session |
| Verbose logging → summary mode | Shorter status messages; full detail only in state file |
| Subagent brief size cap tightened | 1500 → 1000 tokens per filled brief; forces tighter task scope |

User notification:

```
⚠️  CONTEXT WARN — 500K used (50% of 1M)
Master is compacting non-critical references and tightening subagent
brief budgets. Pipeline overlap disabled for this session.

Estimated remaining capacity: ~200K before hard ceiling.

If current stage won't finish under that budget, consider wrapping
cleanly at the next stage transition and starting a new session
with /master <N> --resume.
```

State file updates:
```json
"context_usage": {
  "warn_50_hit": "<ISO timestamp>",
  "compaction_triggered": "<ISO timestamp>",
  "pipeline_overlap_disabled": "<ISO timestamp>"
}
```

## HARD CEILING protocol — at 70% (700K)

Checkpoint sequence (atomic):

```
1. Wait up to 60 seconds for in-flight subagents to return
   - Returned during grace → review + commit + mark done
   - Not returned in 60s → mark task as "checkpoint-aborted"; re-queue

2. Atomic state file write:
   state.state = "paused-context-limit"
   state.previous_state = <stage that was active>
   state.context_usage.hard_ceiling_70_hit = <ISO timestamp>
   state.checkpoints.append({
     timestamp, session_id, context_at_checkpoint, stage_active,
     tasks_completed, tasks_running, tasks_queued,
     handoff_summary_path
   })

3. Author handoff document at .phase-state/<N>/handoff-<timestamp>.md
   (format: see Handoff doc section below)

4. Print resume instructions:

   🛑 CONTEXT HARD CEILING — 700K used (70% of 1M)
   Checkpoint complete. State persisted.

   To continue this phase:
   1. Open a fresh Claude Code session
   2. Run: /master <N> --resume
   3. Master loads state + handoff doc; continues from this point
      with fresh 700K budget.

   Handoff: .phase-state/<N>/handoff-<timestamp>.md

5. EXIT — master refuses further work in this session
```

Master halts even if cost ceiling has headroom. Context is the binding constraint.

## Handoff doc format

`.phase-state/<N>/handoff-<timestamp>.md`:

```markdown
# Phase <N> — Handoff: Session <M> → Session <M+1>

**Reason:** Context hard ceiling 700K hit (70% of 1M)
**Timestamp:** <ISO>
**Session ID:** <id>

## Completed in this session

- [x] Stage <X.Y>: <description>
- [x] T-NN <task name> (commit <SHA>)
- [x] T-NN <task name> (commit <SHA>)
...

## In progress at checkpoint

- T-NN <task name> — subagent dispatched at <time>; status: returned/running/aborted
  - If returned + reviewed + committed: marked done
  - If running: re-queued for next session
  - If aborted: re-queued; subagent slot freed

## Queued for next session

- T-NN, T-NN, T-NN ...
- Stage <X.Y>: <description>
- Gate <N> stamp pending
- Stage 4 exit pending

## What next session should do

1. Open fresh Claude Code session
2. Run: /master <N> --resume
3. Master loads state + this handoff
4. Verifies completed commits via git reconciliation
5. Resumes from checkpointed stage with fresh 700K budget

## Constitutional state preserved

- spec.md status: <current>
- impact.md authored: <yes/no>
- R20 propagation queued: <list of downstream phases or "none">

## Risk-gate state preserved (if applicable)

- risk_gate_mode.active: <bool>
- triggered_by: <signal list>
- Cost ceiling effective: $<X> remaining

## Cost summary

- Spent in this session: $<X>
- Phase total so far: $<Y>
- Phase ceiling: $<Z>
- Daily total: $<D>
```

## Resume protocol — `/master <N> --resume`

```
1. Verify .phase-state/<N>.json exists
   - If state.state != "paused-context-limit" AND != "paused":
       error "no resume needed; phase not paused"
   - If state file missing: error "no checkpoint to resume"

2. Load state file as source of truth

3. Read handoff doc at checkpoints[-1].handoff_summary_path

4. Reconcile state vs filesystem:
   - For each task in tasks_completed:
       verify commit SHA exists in git log; if missing, escalate (data corruption)
   - For each task in tasks_running:
       check git log for matching commit
       if found: promote to completed
       if not found: re-queue to tasks_queued
   - For tasks_queued: validate dispatch plan still applicable
       (re-run task classifier if spec.md changed since checkpoint)

5. Display resume summary:

   📂 RESUMING Phase <N> from checkpoint
   Previous session: <id> (<timestamp>)
   Completed: <X>/<Y> tasks
   Re-queued from running: <list>
   Queued: <list> + remaining stages
   Fresh context budget: 700K available

6. Resume from checkpointed previous_state with fresh budget
   - Was 'impl' → resume parallel dispatch on remaining tasks
   - Was 'code-review' → resume Stage 2.5 from full diff
   - Was 'verify' → resume Stage 3 verification
   - Was 'exit-pending' → render Gate 2 verdict; await stamp
```

## Subagent in-flight handling at checkpoint

| Subagent state | Master action |
|---|---|
| Returned diff; reviewed PASS; committed | Logged as completed; no handoff impact |
| Returned diff; reviewed PASS; not yet committed | Commit before checkpoint write; promote to completed |
| Returned diff; reviewed FAIL; in retry loop | Persist retry state; new session resumes retry |
| Running; <2 min since dispatch | Mark as "abandoned"; re-queue for next session |
| Running; >2 min since dispatch | Wait up to 60 sec; if completes → review + commit; if not → mark "checkpoint-aborted"; re-queue |

Subagents that can't complete in the 60-sec grace are NOT lost — their tasks re-queue cleanly. Subagent's own context is irrelevant; only the diff matters.

## Failure modes

| Scenario | Handling |
|---|---|
| Compaction at 50% still leads to 70% in same session | Normal; checkpoint fires; not a bug |
| User ignores 50% warn and forces continue | Honored until 70%; checkpoint fires regardless |
| Resume against state file >24h old | Stale prompt cache; warn + proceed (~$1-2 rebuild cost) |
| Checkpoint mid-Stage 2.5 code review | Code-review output incomplete; re-run on resume; cost penalty logged |
| Master in BOTH `paused-cost-limit` AND `paused-context-limit` | Both flags persist; resume requires both clear (cost bump or reset + new session) |
| State file says task completed but git has no matching commit | Reconcile fails; demote to re-queue; log to corruption-warnings.log |
| Phase needs ≥3 sessions (Phase 9 worst case) | State file `checkpoints` array accumulates; `session_chain` tracks all sessions; no upper limit |

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Ignore the 50% warn | Use the 200K buffer to wrap cleanly at next stage transition |
| Skip handoff doc to "save time" | Handoff is the bridge; without it, resume is blind |
| Override checkpoint to "just finish this one task" | At 70% attention quality is degrading; the ONE task likely produces a defect; checkpoint is the safe choice |
| Delete `.phase-state/<N>/handoff-*.md` files mid-phase | Audit trail; needed if resume reconciliation fails |
| Resume without reading handoff doc | Master reads it for orientation; user should at least skim before stamping at next gate |

## Risk-gate adjustments

When `risk_gate_mode.active: true` (per [`risk-gate-mode.md`](risk-gate-mode.md)):
- WARN threshold tightened to 40% (400K) instead of 50%
- HARD CEILING stays at 70% (no change — safety property)
- Compaction at WARN is more aggressive (drops more historical refs)
- Smaller fan-out cap already reduces context growth rate

Phase 7 + Phase 9 are the most likely candidates for context-driven session splits regardless. Plan for 2-session runs on those phases; do not treat as failure.

## Cross-references

- [`SKILL.md`](../SKILL.md) — `--resume` invocation; orchestration responsibility
- [`state-machine.md`](state-machine.md) — `paused-context-limit` state; `context_usage` field schema; resume transition row
- [`cost-ceiling.md`](cost-ceiling.md) — parallel concern; both ceilings can pause master independently
- [`pipeline-mode.md`](pipeline-mode.md) — pipeline overlap auto-disabled at 50% warn
- [`risk-gate-mode.md`](risk-gate-mode.md) — tighter WARN threshold under high-attention
- [`templates/subagent-brief.template.md`](../templates/subagent-brief.template.md) — brief size cap tightens at 50% warn
- `CLAUDE.md` §14 — master agent operating procedure (references this file)

---

## Runtime enforcement override (2026-05-15)

The thresholds described above (50% WARN / 70% HARD CEILING) are the documented design. **Runtime enforcement** via `.claude/hooks/usage-guard.mjs` uses a TIGHTER hard ceiling — **60% instead of 70%** — per `.phase-state/cost-config.json`. Rationale: empirical evidence from Phase 4 implementation showed attention-quality concerns at ~65% (Session 19 checkpoint); the 60% enforcement floor preserves ~10% safety margin.

Effective thresholds enforced at every `UserPromptSubmit`:

| Level | % of 1M | Tokens | Hook action |
|---|---|---|---|
| **WARN** | 50% | 500K | Banner via `additionalContext`; prompt proceeds |
| **HARD STOP** | 60% | 600K | `decision: "block"`; prompt refused; resume in fresh session via `/master <N> --resume` |

Hook reads transcript JSONL line-by-line and sums `usage.input_tokens + cache_creation_input_tokens + cache_read_input_tokens` per assistant message; the peak across all turns is the context-window utilization metric.

The 50/70 narrative above is **retained for historical context and rationale chain**. The single source of truth for live enforcement is the JSON config — bumping requires editing `.phase-state/cost-config.json` and committing (it is tracked).

Hooks (also R18 append-only):
- `.claude/hooks/usage-meter.mjs` — shared worker; reads JSONL, computes snapshot, persists to `.phase-state/usage-current.json` (gitignored)
- `.claude/hooks/session-banner.mjs` — `SessionStart`; emits visible usage banner every new session
- `.claude/hooks/usage-guard.mjs` — `UserPromptSubmit`; enforces WARN/STOP thresholds at runtime
