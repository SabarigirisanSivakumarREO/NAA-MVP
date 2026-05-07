# Cost Ceiling — Budget Enforcement

## Defaults

| Ceiling | Default | Pause threshold | Stop threshold |
|---|---|---|---|
| **Daily** (rolling 24h) | $50 | $35 (70%) | $50 (100%) |
| **Per-phase** | $10 | $7 (70%) | $10 (100%) |
| **Per-call** | $1 | warn-only at $1 | no hard stop |

Configurable via `.phase-state/cost-config.json` (gitignored). Master reads on every cost check.

```json
{
  "daily_ceiling_usd": 50.00,
  "daily_pause_pct": 70,
  "phase_ceiling_usd": 10.00,
  "phase_pause_pct": 70,
  "per_call_warn_usd": 1.00,
  "reset_local_time": "00:00",
  "reset_timezone": "Asia/Kolkata"
}
```

## Cost tracking source

Master extracts cost from Anthropic SDK response metadata after every LLM call:

```typescript
const response = await anthropic.messages.create(...)
const usage = response.usage  // { input_tokens, output_tokens, cache_*_tokens }
const cost = computeCost(usage, model)  // per-token pricing per model
master.recordCost(cost, { phase, stage, skill_invoked })
```

Master persists running totals in `.phase-state/<N>.json` `cost` block + global `.phase-state/daily-cost.json`.

## Pause/stop logic

| Threshold | Action |
|---|---|
| **70% (pause)** | Print warning; transition state → `paused`; preserve previous_state; require explicit `--resume` |
| **100% (stop)** | Print error; transition state → `paused`; do NOT advance; require ceiling bump OR `--abort` |
| **per-call $1** | Print warning only; do NOT pause; logged for review |

Both daily and per-phase ceilings check independently. Whichever hits first triggers pause/stop.

## Pause behavior

```
Master detects daily_total >= 70% of daily_ceiling
  → Atomic write state.state = "paused", state.previous_state = <prior>
  → Print: "🛑 PAUSED — daily cost $35.20 / $50.00 (70% reached). Resume with /master <N> --resume or bump ceiling."
  → Wait for user command
```

User options:
- `/master <N> --resume` — continue at current ceiling (master will pause again at 100%)
- `/master <N> --bump-ceiling daily 75` — raise daily ceiling to $75; resume; logged
- `/master <N> --abort` — abort current phase; preserve WIP

## Bump protocol

Bumping ceilings mid-day is allowed but logged for awareness:

```bash
/master --bump-ceiling daily <new_amount>      # e.g. 75
/master --bump-ceiling phase <N> <new_amount>  # e.g. 15 for current phase
```

Master writes to `.phase-state/cost-config-overrides.json` with timestamp + reason prompt:

```
Confirm bump:
  daily_ceiling: $50 → $75
  Reason (optional, for log): _
```

Bumps survive only until next reset; permanent changes go to `cost-config.json`.

## Reset cadence

Daily totals reset at `reset_local_time` (default 00:00) in `reset_timezone` (default `Asia/Kolkata` — adjust per your locale).

Per-phase totals reset only when phase enters `done` or `aborted` state. Carry forward across pause/resume within same phase.

## Estimated cost per phase (planning baseline)

| Stage | Typical cost |
|---|---|
| Stage 1 pre-flight (analyze + matrix + AI Reviewer with critic) | $0.50 - $2.00 |
| Stage 2 implementation (parallel subagents, ~10 tasks) | $3.00 - $7.00 |
| Stage 2.5 code review (full diff) | $0.50 - $1.50 |
| Stage 3 verification (test classification + AI Reviewer) | $0.50 - $1.50 |
| Stage 4 exit (R19 rollup author) | $0.20 - $0.50 |
| **Per phase total** | **~$5 - $12** |

Per-phase ceiling default $10 covers most phases; bump to $15 for risk-gate phases (Phase 7).

Across 14 phases: typical total **~$80 - $150**. Daily $50 default supports ~5-10 phases per day depending on complexity.

## Failure modes

| Scenario | Handling |
|---|---|
| Ceiling hit mid-subagent-fan-out | Allow currently-running subagents to finish; do NOT dispatch new ones; pause |
| Ceiling hit during AI Reviewer Pass 2 critic | Allow critic to complete (already in flight); pause before next sub-audit |
| Multiple sessions same day on different phases | Both read `.phase-state/daily-cost.json` (shared); both contribute to daily total |
| Cost-tracking metadata missing from SDK response | Use last-known-good token estimate; flag as `LOW_CONFIDENCE_COST`; warn user |
| Anthropic API pricing changes mid-run | Master uses pricing table from `.phase-state/pricing.json` (updated separately); warn if last update >30 days |
| User invokes `--bump-ceiling` 3+ times in one day | Print warning: "Frequent bumps may indicate scope creep; review phase estimates" |
| Reset timezone misconfigured | Master uses UTC fallback; flag for correction |

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Hide cost spend from user until ceiling | Print running total at every gate stamp |
| Auto-bump ceiling silently | Always require explicit user `--bump-ceiling` command |
| Reset per-phase total mid-phase | Only on phase exit (done/aborted) |
| Track only output tokens | Track input + output + cache tokens (cache reads are cheap but counted) |
| Ignore per-call $1 warning | Logged for pattern review; recurring may signal prompt bloat |

## Cross-references

- [`SKILL.md`](../SKILL.md) — invocation surface uses cost state
- [`state-machine.md`](state-machine.md) — `cost` block in phase state file
- [`pipeline-mode.md`](pipeline-mode.md) — cost headroom calculation drives pipelining decisions
- [`risk-gate-mode.md`](risk-gate-mode.md) — risk-gate mode reduces phase ceiling 50%
- [`context-budget.md`](context-budget.md) — parallel concern; context (50% WARN / 70% checkpoint) and cost (70% pause / 100% stop) ceilings can pause master independently
- Anthropic SDK docs — token/cost metadata schema
