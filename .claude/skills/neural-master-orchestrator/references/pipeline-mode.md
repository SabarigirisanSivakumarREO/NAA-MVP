# Pipeline Mode — Cross-Phase Overlap Decision Tree

## What pipelining means

Run Phase N+1's Stage 1 pre-flight (analyze + matrix + AI Reviewer verdict) **concurrently** with Phase N's Stage 2 implementation. By the time Phase N reaches Gate 2, Phase N+1's review packet is ready for Gate 1.

Pipelining never overlaps **implementations** across phases — only the pre-flight stage of N+1 with the impl stage of N. Phase dependencies make impl-impl overlap unsafe.

## Three modes

| Mode | Behavior |
|---|---|
| `auto` (default) | Master applies decision logic at every phase transition; recommends; user confirms `Y/N/W` |
| `always` | Force pipelining regardless of risk signals (use when shared-contract stability is high) |
| `never` | Always sequential; conservative; no overlap (use when budget is tight or trust is being established) |

Set globally via `/master --pipeline <mode>`. Persists in `.phase-state/cost-config.json` until changed.

## Decision logic (auto mode)

Master evaluates each phase transition (N → N+1) using these signals, read **dynamically from artifacts** — not from a hardcoded table:

```
INPUTS (read at runtime):
  phase_N.impact_md.shared_contracts_changed  # from impact.md
  phase_N.risk_tier                            # from INDEX.md / spec frontmatter
  phase_N.estimated_impl_hours                 # from plan.md effort estimates OR historical
  cost_headroom_usd = daily_ceiling - daily_total
  pipeline_overlap_cost_estimate_usd           # ~$2-5 per pre-flight

DECISION:

if phase_N.shared_contracts_changed.length > 0:
    recommendation = SEQUENTIAL
    reason = "Phase N changes shared contract(s); N+1 pre-flight assumptions
             would be invalidated and require re-run"

elif phase_N.risk_tier == "HIGH":
    recommendation = SEQUENTIAL
    reason = "Phase N is risk-tier HIGH (Day-6/Day-7 critical gate);
             wait for Gate 2 outcome before committing N+1 pre-flight cost"

elif phase_N.estimated_impl_hours < 1:
    recommendation = SEQUENTIAL
    reason = "Phase N impl too short; pipelining overhead exceeds benefit"

elif cost_headroom < (pipeline_overlap_cost_estimate * 2):
    recommendation = SEQUENTIAL
    reason = "Cost headroom insufficient for speculative N+1 pre-flight"

else:
    recommendation = PIPELINE
    reason = "Phase N impl >1hr, no shared-contract changes, no high-risk gate,
              cost headroom OK"
```

No hardcoded per-phase recommendations. Master applies the logic to whatever phase pair is at hand using current artifact state.

## User confirmation prompt

After Gate 1 stamped APPROVE on Phase N, before Stage 2 starts, master prints:

```
🚦 Gate 1 stamped APPROVE — entering Phase <N> implementation

Pipeline recommendation for Phase <N+1>: <PIPELINE | SEQUENTIAL>
Reason: <reason from decision logic>

Cost headroom: $<X> remaining today (after this phase impl est. $<Y>)
Phase <N+1> pre-flight estimated: $<Z>

Confirm? [Y]es / [N]o sequential / [W]ait until Phase <N> verify gate
> _
```

User responses:
- `Y` — accept master's recommendation
- `N` — force sequential (override PIPELINE → SEQUENTIAL)
- `W` — defer decision; revisit at Phase N's verify gate (sometimes you want to see how impl goes first)

## Invalidation rule

If pipelining is active (N+1 pre-flight running concurrently with N impl) and Phase N's exit reveals an unexpected shared-contract change:

```
ON Phase N exit detecting shared_contract change NOT predicted at Gate 1:
  1. Mark Phase N+1 pre-flight verdict as STALE
  2. Discard cached AI Reviewer verdict for N+1
  3. Re-queue Phase N+1 Stage 1 (re-run pre-flight after N exit)
  4. Cost penalty: ~$2-5 wasted (the original N+1 pre-flight)
  5. Log to .phase-state/<N+1>/invalidation.log
```

This is why `auto` mode favors SEQUENTIAL when shared-contract changes are predictable. Cost of invalidation > cost of sequential.

## What pipelining does NOT save time on

Pipelining only overlaps Stage 1 (~10-15 min) of N+1 with Stage 2 (~3-6 hrs) of N. It does NOT:
- Run N and N+1 implementations in parallel (unsafe — dependencies)
- Skip human Gate 1 stamp on N+1 (still required)
- Reduce per-phase cost (just re-orders the spend)

Net wall-clock saving per pipelined transition: **~10-15 minutes**.
Across the 14-phase MVP if 4-6 transitions pipeline successfully: **~1-1.5 hours**.

## Failure modes

| Scenario | Handling |
|---|---|
| User confirms `Y` (PIPELINE) but Phase N exit invalidates N+1 pre-flight | Auto-invalidation per rule above; log; user awareness only — no escalation |
| User confirms `Y` 3+ times in a row and master invalidates each time | Pattern: drift in shared-contract prediction; flag for `auto` mode review |
| Cost ceiling hits during pipelined pre-flight | Pause N+1 pre-flight; resume after ceiling reset; do NOT block N impl |
| User chose `W` (wait) but never came back at verify gate | Master defaults to SEQUENTIAL at exit-pending; logs decision |
| Always mode forced in cost-tight environment | Master warns at every transition: "always mode + low headroom = high re-do risk"; user can override |

## State machine integration

Pipeline overlap state lives in `.phase-state/<N>.json`:

```json
{
  "pipeline_overlap": {
    "phase_n_plus_1": "5",
    "started_at": "2026-05-08T11:50:00Z",
    "preflight_state": "running",
    "cost_so_far_usd": 1.20,
    "invalidated": false
  }
}
```

Mirrored in `.phase-state/<N+1>.json` with reverse pointer (`pipelined_from: <N>`).

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Hardcode per-phase recommendation lookup table | Read R20 impact + INDEX dependencies + cost state at runtime; apply logic |
| Pipeline impl-impl across phases | Pre-flight overlap only; impls always sequential |
| Skip user `Y/N/W` prompt under `always` mode | Even `always` should print the recommendation reason; user can still `--abort` |
| Ignore invalidation cost | Log every invalidation; if frequent, suggest `never` mode |
| Pipeline when cost headroom < 2× overlap estimate | Speculative cost without budget = recipe for stop-mid-phase |

## Cross-references

- [`SKILL.md`](../SKILL.md) — invocation surface
- [`state-machine.md`](state-machine.md) — `pipeline_overlap` field semantics
- [`cost-ceiling.md`](cost-ceiling.md) — cost headroom calculation
- [`risk-gate-mode.md`](risk-gate-mode.md) — risk-tier signal source
- `docs/specs/mvp/phases/INDEX.md` — phase dependency graph (master reads at runtime)
