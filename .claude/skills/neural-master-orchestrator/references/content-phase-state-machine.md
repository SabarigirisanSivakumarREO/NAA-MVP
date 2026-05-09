# Content-Phase State Machine — Stage 2 sub-states for human-in-the-loop content authoring

## What this file defines

A **specialization of the standard Stage-2 dispatch** documented in [`state-machine.md`](state-machine.md) for phases whose tasks produce IP-bearing content with mandatory human-in-the-loop verification (Constitution R15.3.2). The standard Stage-2 model assumes engineering tasks where subagents fully complete code + tests autonomously; content-authoring tasks have a hard verification gate that subagents cannot satisfy.

**Currently applies to:** Phase 0b (T103 Baymard / T104 Nielsen / T105 Cialdini heuristic content).
**May apply to (future):** v1.1+ heuristic pack expansions; other R15.3-bearing content phases.

## When this state machine activates

When the master orchestrator transitions `review-pending → impl` for a phase whose tasks reference any of these signals:

- Spec.md cites a Verification Methodology section (v0.7+ pattern)
- tasks.md acceptance lines reference `neural-heuristic-reviewer` skill
- Phase tasks produce content under `heuristics-repo/` (not source code)

If ANY signal fires → master uses content-phase Stage-2 sub-states below instead of the standard parallel/sequential dispatch.

## Sub-states

| Sub-state | Description | Master action while in this state |
|---|---|---|
| `stage-2a-drafting` | Drafting subagents writing LLM drafts to `.heuristic-drafts/<id>.json` (gitignored) | Dispatch drafter subagent per pack; wait for completion |
| `stage-2b-ai-reviewing` | Per-draft `neural-heuristic-reviewer` skill invocation; adds `ai_review` block | Iterate over `.heuristic-drafts/<id>.json` files; invoke skill per heuristic; aggregate dispositions |
| `stage-2c-human-gate-rendering` | Master renders human-gate UI per heuristic (or per batch); awaits stamp | Pause; render markdown gate UI; await user `[A]pprove [F]lag [R]eject [E]dit [S]kip` decision |
| `stage-2d-committing` | User-approved drafts: master fills `verified_by` + `verified_date`, runs lint, commits per CLAUDE.md §6 | Commit per heuristic OR per pack (configurable); update tasks.md `[x]` markers |
| `stage-2e-pack-spotcheck` | At pack completion (+10/+20/+30 marks per AC-12), pause for full R15.3.2 manual re-derivation on 5 random | Pause; render spot-check guidance + 5 random heuristic IDs; await user log entry to `_spot-checks.md` |
| `stage-2-content-done` | All packs complete, all spot-checks passed; transition to standard `code-review` | Resume standard state-machine flow → `code-review` → `verify` → `exit-pending` |

## Sub-state transition table

| From | Trigger | To | Notes |
|---|---|---|---|
| `impl` (entry) | Master detects content-phase signals (Verification Methodology section) | `stage-2a-drafting` | Initialize drafting subagent dispatch |
| `stage-2a-drafting` | All drafts for current pack written to `.heuristic-drafts/` | `stage-2b-ai-reviewing` | Iterate review per draft |
| `stage-2b-ai-reviewing` | All reviews complete (dispositions assigned); REJECT_REDRAFT count < kill threshold | `stage-2c-human-gate-rendering` | Render gate UI |
| `stage-2b-ai-reviewing` | REJECT_REDRAFT count ≥ 3 for any single heuristic | (paused) | 3-strike kill criteria; engineering lead reviews drafter prompt |
| `stage-2b-ai-reviewing` | FLAG_FOR_HUMAN rate >20% across pack | (paused) | Drafter prompt-protocol drift; engineering lead reviews |
| `stage-2c-human-gate-rendering` | User stamps APPROVE on heuristic | `stage-2d-committing` (per heuristic) OR queued (per batch) | Configurable: per-heuristic commit OR per-pack batch commit |
| `stage-2c-human-gate-rendering` | User stamps EDIT on heuristic | `stage-2c-human-gate-rendering` | Master applies edit; re-runs lint; re-renders for confirm-stamp |
| `stage-2c-human-gate-rendering` | User stamps REJECT on heuristic | `stage-2a-drafting` (single heuristic) | Re-dispatch drafter for that heuristic; 3-strike count increments |
| `stage-2d-committing` | Lint passes; commit lands | `stage-2c-human-gate-rendering` (next heuristic) OR `stage-2e-pack-spotcheck` (if at +10/+20/+30 mark) | Loop within pack OR transition to spot-check |
| `stage-2e-pack-spotcheck` | User logs spot-check outcome to `_spot-checks.md`; ≤1 of 5 diverged | `stage-2c-human-gate-rendering` (continue pack) OR `stage-2-content-done` (final pack done) | Pass through |
| `stage-2e-pack-spotcheck` | >1 of 5 diverged | (paused) | AC-12 kill criteria — entire batch since last good spot-check rejected; engineering lead reviews protocol |
| `stage-2-content-done` | All 3 packs complete, all 3 spot-checks passed | `code-review` (standard Stage 2.5) | Resume standard flow |

## Drafting subagent brief template (Stage 2a)

When master dispatches a drafting subagent, the brief includes:

```
TASK: Draft <count> heuristics for the <pack> pack.

INPUT CONTRACT:
- T101 HeuristicSchemaExtended: packages/agent-core/src/analysis/heuristics/types.ts
- T0B-001 drafting prompt template: docs/specs/mvp/templates/heuristic-drafting-prompt.md
- AC-NN distribution targets: docs/specs/mvp/phases/phase-0b-heuristics/spec.md AC-06/07/08

OUTPUT:
- Write each draft to .heuristic-drafts/<heuristic-id>.json (gitignored)
- Every draft MUST have provenance.verified_by = "" + provenance.verified_date = ""
  (lint will FAIL on these — INTENTIONAL; human gate fills them)
- Every draft MUST conform to T101 schema; do NOT include ai_review block
  (the neural-heuristic-reviewer skill writes that in Stage 2b)

CONSTRAINTS:
- One Anthropic SDK call per heuristic (NOT batched — keeps cost attribution clean)
- temperature: 0.3 (creative drafting; verification is deterministic per R15.3.2)
- NO LangSmith integration (R15.3.3 isolation; uses @anthropic-ai/sdk directly)
- Writes drafting transcripts to .heuristic-drafts/<id>.log (gitignored; for cost tracking)

DISTRIBUTION (T103 Baymard example):
- ~4 homepage + ~4 PDP + ~4 checkout + ~2 cart + ≥1 mobile-specific overlay (AC-06)
- PLP deferred to v1.1+ per spec.md v0.6 Out of Scope

R6 BOUNDARY:
- Drafting transcripts NEVER touch LangSmith / Pino / dashboard (R15.3.3)
- Heuristic body content stays inside .heuristic-drafts/ + heuristics-repo/ (R6.1)
```

## AI-review skill invocation (Stage 2b)

Per draft heuristic, master invokes:

```
Skill tool call:
  skill: neural-heuristic-reviewer
  args: --draft-path .heuristic-drafts/<id>.json --pack <baymard|nielsen|cialdini>
```

Skill writes `ai_review` block + saves combined output to `.heuristic-drafts/<id>.review.json`.

## Human-gate UI render template (Stage 2c)

Per heuristic, master renders to terminal:

```
══════ T<NNN> <PACK> — Heuristic <K> of <total> ══════
  ID: <heuristic_id>
  Body: <first 300 chars>...
  Benchmark: <kind> — <value/standard_text>
  Source: <source_url>  [HTTP <status> <✅|⚠️>]
  Citation: "<verbatim citation_text 200-word excerpt>"

  ── AI senior-consultant review ──
  WHY GENERATED: <ai_review.why_generated>
  HOW REVIEWED: <ai_review.how_reviewed>
    [<conf>] source       — <finding>
    [<conf>] citation     — <finding>
    [<conf>] fit          — <finding>
    [<conf>] banned_phrase — <finding>
    [<conf>] benchmark    — <finding>
    [<conf>] actionability — <finding>
  DISPOSITION: <APPROVE | FLAG_FOR_HUMAN | REJECT_REDRAFT>
  CONCERNS: <flagged_concerns or "none">

[A]pprove  [F]lag for deeper review  [R]eject + redraft  [E]dit then approve  [S]kip to next
```

## Cost ceiling adjustments for content phases

Standard cost-ceiling applies (Phase 0b cap $25 per spec.md NF-01 + plan.md §7 kill criteria) plus this allocation:

| Component | Cost per heuristic | Total (30 heuristics) |
|---|---|---|
| Drafting subagent (claude-sonnet-4-* @ ~3K tokens × 0.3 temp) | ~$0.15 | ~$4.50 |
| neural-heuristic-reviewer skill (~3K tokens + 1 WebFetch) | ~$0.06 | ~$1.80 |
| Human-gate UI render (master direct; no LLM call) | $0 | $0 |
| Lint + commit cycle (master direct) | $0 | $0 |
| **Total LLM cost** | **~$0.21** | **~$6.30** |

Sits well within the $25 phase ceiling.

## State persistence

Content-phase state file extends standard `.phase-state/<N>.json`:

```json
{
  "state": "stage-2c-human-gate-rendering",
  "content_phase_state": {
    "current_pack": "baymard",
    "total_in_pack": 15,
    "completed_in_pack": 7,
    "current_heuristic_id": "BAYMARD-CHECKOUT-003",
    "drafts_written": 15,
    "ai_reviews_complete": 15,
    "human_gate_dispositions": {
      "BAYMARD-HOMEPAGE-001": "approved",
      "BAYMARD-HOMEPAGE-002": "approved",
      "BAYMARD-HOMEPAGE-003": "edited_then_approved",
      "BAYMARD-HOMEPAGE-004": "rejected_redraft_count:1",
      "BAYMARD-PDP-001": "flagged_pending_user_review",
      ...
    },
    "spot_checks": {
      "round_1_at_+10": null,
      "round_2_at_+20": null,
      "round_3_at_+30": null
    },
    "kill_criteria_status": {
      "reject_redraft_3_strike": "no heuristic at 3 strikes yet",
      "flag_for_human_rate_pct": 7,
      "flag_for_human_rate_threshold_pct": 20
    }
  }
}
```

## Failure modes (content-phase-specific)

| Scenario | Handling |
|---|---|
| Drafter subagent produces draft that fails T101 Zod parse | Master logs; re-dispatches drafter for that heuristic with stricter prompt rider; counts toward 3-strike |
| neural-heuristic-reviewer skill returns `LOW_CONFIDENCE_REVIEW` (all dimensions LOW) | Master flags as `FLAG_FOR_HUMAN`; surfaces with critical-attention annotation at gate |
| User stamps EDIT but the edit breaks T101 schema | Master re-runs lint; surfaces error to user; user re-edits or reverts |
| User stamps SKIP repeatedly (>5 in a row) | Master pauses; asks user if they want to abort or continue; cost tracking continues |
| Spot-check round fails (>1 of 5 diverged) | Master pauses; entire batch since last good spot-check is rejected (per AC-12 + plan.md §7); engineering lead reviews protocol |
| Cost ceiling hit mid-pack | Pause per standard cost-ceiling.md flow; preserve dispatch state; user decides resume / bump / abort |
| User session times out mid-gate-rendering | Master persists current heuristic ID + queue; fresh session resumes via `/master <N> --resume` per state-machine.md "paused-context-limit" pattern |

## Cross-references

- [`SKILL.md`](../SKILL.md) — invoker (Stage 2 transition for content phases)
- [`state-machine.md`](state-machine.md) — standard state machine (this file extends Stage 2 only)
- [`task-classifier.md`](task-classifier.md) — task classification (content-phase tasks classify as `sequential` per pack ordering)
- [`../../neural-heuristic-reviewer/SKILL.md`](../../neural-heuristic-reviewer/SKILL.md) — Stage 2b reviewer skill
- `docs/specs/mvp/phases/phase-0b-heuristics/spec.md` v0.7 §Verification Methodology — methodology contract
- `docs/specs/mvp/phases/phase-0b-heuristics/plan.md` §7 — kill criteria (3-strike redraft + 20% flag rate + spot-check >1 of 5)
- `docs/specs/mvp/templates/heuristic-drafting-prompt.md` — drafter input contract
- `docs/specs/mvp/templates/heuristic-verification-protocol.md` — Tier 2 spot-check protocol
- `packages/agent-core/src/analysis/heuristics/types.ts` — T101 + v0.7 `ai_review` schema
