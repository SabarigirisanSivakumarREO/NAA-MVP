# Risk-Gate Mode — High-Attention Adjustments

## What this mode does

Tightens master's behavior on phases where the cost of a wrong move is high. Reduces parallelism, lowers cost ceiling, mandates adversarial critic, raises diff-reviewer strictness, increases user check-in frequency.

Mode is per-phase. Auto-triggered or manually set. Cleared on phase exit.

## Auto-trigger logic (read dynamically from artifacts)

Master evaluates these signals at Stage 1 boot. Any one signal trips the mode — not from a hardcoded phase list:

| Signal | Source |
|---|---|
| `risk_tier: HIGH` in spec.md frontmatter | Phase artifact metadata |
| First-runtime activation of any constitutional R-rule (R6 / R10 / R13 / R14 / R20) | impact.md `first_runtime` field |
| Shared-contract changes touching ≥3 contracts | impact.md `affected_contracts` count |
| Any HIGH severity finding carried over from prior phase pre-flight | predecessor `phase-<N-1>-current.md` rollup `open_risks_for_next` field |
| Phase introduces a NEW external-system integration | impact.md `new_external_integrations` field |
| Cost overrun on prior phase (>120% of estimate) | `.phase-state/daily-cost.json` historical |

Master logs which signal(s) tripped the mode in `.phase-state/<N>.json`:

```json
"risk_gate_mode": {
  "active": true,
  "triggered_by": ["risk_tier_high", "first_runtime_R10"],
  "activated_at": "..."
}
```

## Manual trigger

```bash
/master <N> --high-attention      # force mode for this phase
/master <N> --normal-attention    # clear mode (override auto-trigger)
```

User override is logged with timestamp + optional reason.

## Adjustments under risk-gate mode

| Aspect | Normal mode | Risk-gate mode |
|---|---|---|
| **Parallel fan-out width** | up to 9 subagents | max 3 subagents |
| **Per-phase cost ceiling** | $10 default | $5 default (50%) — bump explicitly if needed |
| **AI Reviewer Pass 2 critic** | optional skip on LOW-risk surfaces | **mandatory always** |
| **Diff reviewer severity threshold** | rejects CRITICAL + HIGH | rejects CRITICAL + HIGH + **MED** |
| **User check-in frequency** | only at gates | after each subagent return + at every state transition |
| **Logging verbosity** | summary | full brief + full diff per subagent + full verdict |
| **Test failure auto-PR** | enabled for high-confidence impl bugs | disabled — every failure escalates to user |
| **Pipeline mode** | per `auto` decision | forced SEQUENTIAL (no overlap) |
| **Subagent retry on diff rejection** | up to 3 strikes | reduced to 2 strikes |

## Why these adjustments

| Adjustment | Rationale |
|---|---|
| Smaller fan-out | Easier to review 3 diffs than 9; mistakes more likely in HIGH-risk territory |
| Lower cost ceiling | Forces explicit user bump rather than silent overspend on risky phase |
| Mandatory critic | First-runtime constitutional rules catch class-of-bug only adversarial check finds |
| Stricter diff reviewer | MED issues that would pass normally become block-worthy in risky context |
| More check-ins | User context on what's happening reduces post-hoc surprise |
| Verbose logs | Audit trail when post-mortem needed; cheap insurance |
| No auto-PR | Auto-action on classified failures requires confidence; risk-gate phases shouldn't trust classifier |
| Forced sequential | Cross-phase pipelining adds invalidation risk on top of phase-internal risk |
| Tighter strikes | Wrong subagent in risky phase = real cost; abort sooner |

## Exit conditions

Mode clears when:

| Condition | Effect |
|---|---|
| Phase reaches `done` state | Mode auto-clears |
| Phase reaches `aborted` state | Mode auto-clears |
| User invokes `/master <N> --normal-attention` | Mode clears manually with logged reason |
| Phase enters `re-spec` state | Mode preserved; will re-engage when phase resumes |

## Integration with state machine

`risk_gate_mode` field in `.phase-state/<N>.json` (see [`state-machine.md`](state-machine.md)). Read at every state transition. All adjustments above apply automatically when `active: true`.

## Integration with cost ceiling

When mode active, master applies `phase_ceiling_usd × 0.5` as effective ceiling. Original ceiling preserved in config; reduced ceiling lives in transient `.phase-state/<N>.json` `cost.phase_ceiling_effective_usd` field.

User can `--bump-ceiling` as usual; bumps go against the reduced ceiling baseline.

## Integration with pipeline mode

Risk-gate forces `SEQUENTIAL` regardless of `--pipeline auto` recommendation. Master's pipeline decision logic (see [`pipeline-mode.md`](pipeline-mode.md)) checks `risk_gate_mode.active` first.

## Failure modes

| Scenario | Handling |
|---|---|
| Risk-gate triggers but no critic skill available | Refuse to proceed; AI Reviewer Pass 2 critic is non-negotiable in this mode |
| User repeatedly overrides with `--normal-attention` on auto-triggered risky phases | Pattern: log frequency; if >2 in MVP run, suggest reviewing trigger logic |
| Cost ceiling reduction surprises user mid-impl | Master always announces "RISK-GATE MODE ACTIVE — ceiling effective $X" at Stage 1 boot |
| Verbose logging fills disk | Logs rotate per session; old sessions archive to `.phase-state/<N>/archive/` |
| User invokes `--high-attention` AFTER pipelining started | Master invalidates active pipeline; re-runs without overlap |

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Hardcode "Phase 7 = always risk-gate" | Read `risk_tier` from spec.md frontmatter; multiple phases may qualify dynamically |
| Skip mandatory critic to save cost | Cost saving is false economy on risky phases; let cost ceiling pause if needed |
| Lower cost ceiling silently without announcement | Always print effective ceiling at Stage 1 boot |
| Treat manual `--high-attention` as same as auto | Manual override logged with reason; auto-trigger logged with signal |
| Allow pipeline overlap "just this once" in risk-gate | Forced SEQUENTIAL is a safety property, not a recommendation |

## Cross-references

- [`SKILL.md`](../SKILL.md) — `--high-attention` flag, auto-trigger description
- [`state-machine.md`](state-machine.md) — `risk_gate_mode` state field
- [`cost-ceiling.md`](cost-ceiling.md) — effective ceiling under reduced mode
- [`pipeline-mode.md`](pipeline-mode.md) — forced SEQUENTIAL when mode active
- `docs/specs/mvp/phases/phase-<N>-*/spec.md` — `risk_tier` frontmatter source
- `docs/specs/mvp/phases/phase-<N>-*/impact.md` — first-runtime + shared-contract signals
