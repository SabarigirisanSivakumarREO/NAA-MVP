# State Machine — Master Orchestrator

## States

| State | Description | Master action while in this state |
|---|---|---|
| `not-started` | Phase has never begun | Wait for `--start` command |
| `preflight` | Stage 1 running (analyze + matrix + AI Reviewer pre-flight verdict) | Execute Stage 1 sub-steps |
| `review-pending` | 🚦 Gate 1 awaiting human stamp | Render verdict; wait for `--gate-1 <decision>` |
| `re-spec` | Gate 1 returned RE-SPEC; phase paused for major redesign | Preserve state; require user resume after re-spec |
| `impl` | Stage 2 running (parallel subagent fan-out) | Monitor subagent progress; review diffs |
| `code-review` | Stage 2.5 running (semantic code review) | Run `superpowers:code-reviewer` on full impl diff |
| `verify` | Stage 3 running (lint + typecheck + tests + AI Reviewer verification verdict) | Execute Stage 3 sub-steps |
| `exit-pending` | 🚦 Gate 2 awaiting human stamp | Render verdict; wait for `--gate-2 <decision>` |
| `done` | Stage 4 complete; INDEX flipped 🟢 | No further action; phase final |
| `aborted` | User invoked `--abort`; work-in-progress preserved in `abort-snapshot/` | Wait for new `--start` |
| `paused` | Cost ceiling hit OR risk-gate user-availability flag fired | Wait for ceiling reset OR explicit `--resume` |
| `paused-context-limit` | Context hard ceiling 70% (700K tokens) hit; checkpoint authored; preserved `previous_state` for resume in fresh session | Halt session; user opens new Claude Code session and runs `/master <N> --resume` |

## Transition table

| From | Trigger | To | Notes |
|---|---|---|---|
| `not-started` | `/master <N> --start` | `preflight` | Initialize state file |
| `preflight` | Stage 1 complete (auto) | `review-pending` | Verdict written; render summary |
| `review-pending` | `/master <N> --gate-1 APPROVE` | `impl` | Bump status `draft → approved` |
| `review-pending` | `/master <N> --gate-1 REVISE` | `preflight` | Apply spec patches; re-run analyze + matrix |
| `review-pending` | `/master <N> --gate-1 RE-SPEC` | `re-spec` | Halt; escalate to user |
| `impl` | All dispatched tasks complete (auto) | `code-review` | Run Stage 2.5 |
| `code-review` | Code review complete (auto) | `verify` | No issues OR fix subagents dispatched |
| `verify` | Stage 3 complete (auto) | `exit-pending` | Verdict written; render summary |
| `exit-pending` | `/master <N> --gate-2 APPROVE` | `done` | Run Stage 4 exit |
| `exit-pending` | `/master <N> --gate-2 RETURN-TO-IMPL` | `impl` | Re-dispatch fix subagents |
| Any active state | `/master <N> --abort` | `aborted` | Snapshot WIP; rollback |
| Any active state | Cost ceiling hit OR risk-gate pause trigger | `paused` | Preserve previous state for resume |
| `paused` | Cost reset OR user `--resume` | (previous state) | Resume where paused |
| Any active state | Context hits 70% (700K tokens) | `paused-context-limit` | Checkpoint authored; halt session; see [`context-budget.md`](context-budget.md) |
| `paused-context-limit` | New session + `/master <N> --resume` | (previous state) | Fresh 700K context budget; reconcile state vs git |
| `re-spec` | User completes re-spec + new `--start` | `preflight` | Treat as fresh phase start |

## Persistence — `.phase-state/<N>.json` schema

```json
{
  "phase": "1",
  "state": "impl",
  "started_at": "2026-05-08T10:00:00Z",
  "last_transition_at": "2026-05-08T11:32:00Z",
  "previous_state": "review-pending",

  "gate_1": {
    "decision": "APPROVE",
    "decided_at": "2026-05-08T11:32:00Z",
    "verdict_path": ".phase-state/1/preflight-verdict.yaml",
    "approved_actions": ["act-001", "act-002"],
    "human_override": null
  },
  "gate_2": null,

  "tasks": {
    "T006": {
      "status": "done",
      "subagent_id": "a62f...",
      "commit": "f7a3b9c",
      "completed_at": "2026-05-08T11:48:00Z"
    },
    "T007": {
      "status": "running",
      "subagent_id": "a8e1...",
      "started_at": "2026-05-08T11:50:00Z"
    },
    "T008": {
      "status": "queued"
    }
  },

  "dispatch_plan": {
    "parallel": ["T006", "T010"],
    "sequential": ["T007", "T008", "T009"],
    "shared_contract": []
  },

  "cost": {
    "phase_total_usd": 4.32,
    "daily_total_usd": 18.50,
    "phase_ceiling_usd": 10.00,
    "daily_ceiling_usd": 50.00,
    "last_check_at": "2026-05-08T11:50:00Z"
  },

  "risk_gate_mode": false,
  "pipeline_overlap": {
    "phase_n_plus_1": null
  },

  "context_usage": {
    "boot_tokens_estimated": 152000,
    "current_session_peak": 380000,
    "warn_50_hit": null,
    "compaction_triggered": null,
    "pipeline_overlap_disabled": null,
    "hard_ceiling_70_hit": null,
    "checkpoints": [],
    "last_check_at": "2026-05-08T11:50:00Z"
  },

  "session_chain": ["session-1"],

  "last_command": "/master 1 --gate-1 APPROVE",
  "session_id": "session-1",
  "abort_snapshot": null
}
```

State file is written after EVERY transition. Atomic write (temp file + rename) to prevent corruption on interruption.

## Resume logic across sessions

When master is invoked in a fresh session:

1. Read `.phase-state/<N>.json` (if exists)
2. **Implicit resume** — if state is anything other than `not-started`, `done`, or `aborted`, master continues from current state. No `--resume` flag required.
3. **Cache warning** — if `last_transition_at` >24 hrs ago, warn user about prompt-cache cost on resume.
4. **Stale-state escalation** — if `last_transition_at` >7 days ago, refuse implicit resume; require explicit `/master <N> --resume` confirmation.

## Reconciliation rule (state file ↔ filesystem reality)

Master verifies state matches filesystem at every command invocation. Mismatches:

| State says | Filesystem says | Action |
|---|---|---|
| `impl` with tasks T1-T5 queued | All 5 tasks `[x]` in tasks.md | Reconcile to `code-review` (advance to truth) |
| `done` | INDEX.md not flipped to 🟢 | Reconcile to `exit-pending` (rollback half-step) |
| `verify` | No `verify-verdict.yaml` exists | Reconcile to `code-review` (rollback) |
| `review-pending` | `review-notes.md` doesn't exist | Reconcile to `preflight` (re-run Stage 1) |
| State file missing | Filesystem has `phase-<N>-current.md` rollup | Treat as `done`; create state file for record |
| State file says T7 done at SHA X | `git log` shows no such commit | Reconcile to T7 = queued; re-dispatch |

**Rule:** Filesystem wins. State file is a cache; truth lives in artifacts + git.

## Atomic-write protocol

State file writes use temp-file pattern:

```
1. Write proposed state to .phase-state/<N>.json.tmp
2. fsync()
3. Rename .tmp → .phase-state/<N>.json (atomic on POSIX + Windows)
4. Append transition event to .phase-state/<N>/transitions.log
```

Prevents corruption on session interruption mid-write.

## Failure modes

| Scenario | Handling |
|---|---|
| State file corrupted (invalid JSON) | Refuse to proceed; user must fix manually OR delete to reset to `not-started` |
| State file references a phase folder that doesn't exist | Refuse to proceed; escalate as data-corruption issue |
| State file says current state is X but no command Y maps from X | Refuse Y; print valid commands for state X |
| Atomic rename fails (filesystem error) | Retry once; if still fails, escalate |
| Multiple sessions run master concurrently on same phase | Lock file `.phase-state/<N>.lock`; second session refuses with clear error |

## Cross-references

- [`SKILL.md`](../SKILL.md) — invocation surface uses these states
- [`pipeline-mode.md`](pipeline-mode.md) — `pipeline_overlap` field semantics
- [`cost-ceiling.md`](cost-ceiling.md) — `cost` field semantics + pause-trigger logic
- [`risk-gate-mode.md`](risk-gate-mode.md) — `risk_gate_mode` field semantics
- `CLAUDE.md` §8c — JIT discipline aligns with single-phase state focus
