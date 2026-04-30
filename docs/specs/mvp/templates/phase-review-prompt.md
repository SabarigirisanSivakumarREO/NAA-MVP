---
title: Phase Review Prompt — Engineering Lead Review Template
artifact_type: template
status: approved
version: 1.0
created: 2026-04-30
updated: 2026-04-30
owner: engineering lead
authors: [Claude (drafter)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/constitution.md (R17.4 lifecycle gate, R3 TDD, R5/R6 IP, R20 impact, R23 kill)
  - docs/specs/mvp/PRD.md §10 (boundaries, especially §10.6 self-verification, §10.9 PR Contract)
  - CLAUDE.md §8c (per-phase artifact maintenance)

req_ids: []

description: "Reusable engineering-lead review template. Invoked once per phase before bumping status: draft → approved per R17.4. Companion to /speckit.analyze (which handles mechanical consistency); this template handles design judgment."
---

# Phase Review Prompt — Engineering Lead Review Template

> **Purpose:** Conduct the R17.4 `validated → approved` engineering lead review on a phase's spec/plan/tasks/impact artifacts. Distinct from `/speckit.analyze` (mechanical) — this template asks JUDGMENT questions analyze can't see.
>
> **When to use:** After `/speckit.analyze` has cleared all CRITICAL/HIGH findings on the target phase, AND before bumping `status: draft → approved` on spec/plan/tasks artifacts.
>
> **How to use:** User invokes with phrasing like *"Review phase-X-name using the phase-review template."* Claude executes the 5-step review pass and emits `phase-X-name/review-notes.md` per the report template.

---

## Inputs

| Input | Source |
|---|---|
| Target phase folder | User specifies, e.g., `docs/specs/mvp/phases/phase-0b-heuristics/` |
| Constitution | `docs/specs/mvp/constitution.md` (R1-R26) |
| PRD operational boundaries | `docs/specs/mvp/PRD.md` §10 |
| Companion artifacts (recommended) | `docs/specs/mvp/PRD.md` §1-§5 (vision/scope), `docs/specs/mvp/phases/INDEX.md` (phase context) |
| Prior `/speckit.analyze` report | If recent run available — phase-N/analyze-report.md or session memory |

---

## Pre-review checklist (Claude verifies before executing)

Refuse to start the review and ASK the user if any of these fail:

- [ ] Target phase folder exists and contains at least: spec.md, plan.md, tasks.md, README.md
- [ ] Phase artifacts are at `status: draft` or `status: validated` (refuse if already `approved` — review is redundant; refuse if `superseded` — wrong artifact)
- [ ] `/speckit.analyze` has been run on this phase recently AND any CRITICAL/HIGH findings have been resolved (ask user to confirm; if not, recommend running analyze first)
- [ ] If shared contracts are touched per R20, `impact.md` exists in the phase folder
- [ ] Constitution at `docs/specs/mvp/constitution.md` is loadable (file exists, R1-R26 present)

---

## The 5-step review pass

### Step 1 — Load + read in order

Load these artifacts in this order. Do NOT skip the README — it's the goal-setting context for everything else.

1. `phase-N/README.md` — what is this phase trying to accomplish?
2. `phase-N/spec.md` — what does it require?
3. `phase-N/impact.md` (if present) — what are the cross-cutting effects?
4. `phase-N/plan.md` — how is it going to be implemented?
5. `phase-N/tasks.md` — what specific tasks decompose the plan?
6. `phase-N/checklists/requirements.md` (if present) — does the spec pass static quality?

Also load:
- `docs/specs/mvp/constitution.md` (R1-R26)
- `docs/specs/mvp/PRD.md` §10 (operational boundaries)

### Step 2 — Per-artifact judgment questions

For each artifact, ask these questions and record findings. **A finding is a JUDGMENT call analyze can't make.**

#### README.md
- Does the goal statement match what this phase is actually trying to accomplish, in language a stakeholder outside the engineering team would understand?
- Are exit criteria specific enough that you'll know unambiguously when the phase is "done"?
- Is the depends-on / blocks list accurate against INDEX.md?

#### spec.md
- Are user stories framed around real outcomes (not "implement X")?
- Are acceptance criteria objectively verifiable (someone other than the author can check them)?
- Is "out of scope" explicit enough that future agents won't drag scope back in?
- Does the Constitution Alignment Check actually hold up under adversarial reading, or are some boxes ticked optimistically?
- For every R-NN: is there a measurable acceptance scenario, OR is it a soft requirement that won't actually be enforced?

#### impact.md (if present per R20)
- Have ALL consumers been identified? (cross-check against grep for the contract name in `packages/`, `apps/`, other phase folders)
- Is the migration plan concrete (named steps, in order), or vague ("update consumers")?
- Is the risk register honest — does it include risks the author would prefer not to surface?
- Does R20.4 sign-off path apply (breaking change → engineering-lead review BEFORE implementation PR)?

#### plan.md
- Does the sequencing make sense given task dependencies (no "integration test before component lands")?
- Are kill criteria specific enough to actually fire (not "things go wrong → escalate")? Check Step 4 below.
- Is the effort estimate based on something concrete (line counts, prior similar work, rough math), or aspirational?
- Are tech-stack pins respected (architecture.md §6.4 cited, no alternatives proposed)?

#### tasks.md
- Does every task have a clear acceptance criterion that someone other than the author can verify?
- Are file paths specific (architecture.md §6.5 compliant)?
- Are dependencies between tasks correct (graph cycles? phantom deps?)?
- Is TDD ordering preserved (test before impl per R3.1)?
- Are kill criteria attached to high-risk tasks (>2hr, shared contract, subagent, LLM > $0.50 per R23)?

### Step 3 — Doom check on the highest-risk surface ★ critical

This is the core of judgment review — what analyze cannot do.

1. Identify the highest-risk surface in this phase (use risk_level from impact.md if present, otherwise infer from constitution rule activations: HIGH if R5.3/R6/R10/R7.4 first-runtime activates here; MEDIUM if shared contract introduced; LOW otherwise).

2. Ask the doom-check question: **"If a contractor joined the team next week and ran this phase's workflow blindly, where would the rails fail?"**

3. Walk through the actual flow mentally (or on paper). For each step, ask:
   - What if the input is malformed?
   - What if a dependency isn't ready?
   - What if a constitutional rule is bypassed?
   - What if the engineer is rushed and skips a verification step?
   - What if an automated tool gives a false-pass?

4. Record any failure path that the existing AC tests / kill criteria don't cover. These are HIGH findings even if they're judgment-based and not strictly cross-artifact.

**Phase-specific high-risk surfaces (examples for calibration):**

| Phase | Highest-risk surface | Doom-check angle |
|---|---|---|
| Phase 0 | Setup (no real risk) | Infrastructure failure modes — Docker daemon, Node version mismatch |
| Phase 0b | R6/R15.3.3 IP boundary on drafting | Heuristic content leak via LangSmith/Pino/dashboard during drafting |
| Phase 1 | PageStateModel token cap | What if perception extraction explodes on a real-world page? |
| Phase 4 | T070 RLS + T073 LLM cornerstone | Cross-client data leak; temperature bypass on evaluate |
| Phase 6 | R6 first runtime activation | Heuristic body in any Pino log line |
| Phase 7 | R10/R5.6/R6 first activations | TemperatureGuard bypass; combined critique call; LangSmith trace exposes body |
| Phase 8 | T148-T150 acceptance | Cross-page PatternDetector silently drops findings |
| Phase 9 | R6 channels 3+4 first activation | Heuristic body in API response or rendered HTML |

### Step 4 — Validate kill criteria

Read plan.md kill criteria block. For each trigger, ask: **"If this fires at week N, what do I actually do?"**

- If the answer is concrete (specific revert/escalate/snapshot path) → kill criterion is real
- If the answer is vague ("escalate") or absent → kill criterion is decorative; flag as a finding

For each kill criterion, also ask:
- Is the threshold realistic (not too easily triggered, not too rarely triggered)?
- Is the action reversible (snapshot WIP, escalate to human)?
- Does it preserve the constitution (no `--no-verify`, no silent retry per R23.4)?

### Step 5 — Recommendation

Based on findings from Steps 2-4, emit one of three recommendations:

| Recommendation | When | What user does |
|---|---|---|
| **APPROVE** | Zero new HIGH findings; MEDIUM findings can be deferred to polish | Bump `status: draft → approved`. Implementation may begin. |
| **REVISE** | 1-3 MEDIUM findings affect spec/plan correctness, OR 1+ doom-check finding without existing mitigation | User addresses findings, re-runs review. Status stays `draft`. |
| **RE-SPEC** | HIGH finding that questions whether this phase's design is sound | User pauses phase, re-opens design discussion. Spec may need significant rework. |

Default toward APPROVE if findings are mechanical/polish only; reserve REVISE for judgment-grade design issues; reserve RE-SPEC for fundamental design mistakes.

---

## Output

Emit a markdown report following the structure in [`phase-review-report.template.md`](phase-review-report.template.md). Save to `phase-N/review-notes.md` in the target phase folder.

The report has 7 sections:

1. **Phase scope** — what was reviewed (paths, versions, dates)
2. **Step 1 read-order findings** — issues caught during the read pass
3. **Step 2 per-artifact judgment findings** — table per artifact
4. **Step 3 doom check** — what failure paths the existing rails miss
5. **Step 4 kill criteria validation** — which triggers are real vs decorative
6. **Step 5 recommendation** — APPROVE / REVISE / RE-SPEC + rationale
7. **Sign-off block** — fillable by user; recordkeeping for R17.4 transition

---

## Calibration notes (read before first review)

- **Be honest, not nice.** A review that finds nothing is useless. If you can't surface at least 1-2 judgment findings on a non-trivial phase, you're not adversarial enough. Re-read with the doom-check lens.
- **Don't re-do analyze's work.** If you find a REQ-ID coverage gap or terminology drift, that's analyze's job. Phase review is for design judgment, not mechanical consistency.
- **Time-box.** 30 min for a small/LOW-risk phase, 60 min for HIGH-risk. Don't let it stretch into a full re-design.
- **Recommend APPROVE generously for boring phases.** Phase 0 (setup), Phase 3 (verification thin) — these don't need adversarial review. Reserve rigor for HIGH-risk phases (4, 7, 8, 9).
- **Surface the right doom check.** A doom check on Phase 0 about "what if the engineer doesn't follow TDD" is not the highest-risk surface; that's R3 enforcement, not Phase 0-specific. The doom check should target the constitutional-rule-or-architectural-invariant THAT FIRST ACTIVATES IN THIS PHASE.
- **Stay solo-team-realistic.** If the user is doing self-review (single engineer/lead), the review still has value because it forces structured adversarial reading 2-4 hours after authoring.

---

## Recording sign-off

After review completes and user accepts a recommendation:

| Recommendation | Sign-off action |
|---|---|
| APPROVE | User bumps `status: draft → approved` on spec/plan/tasks/impact. Commit message includes: `(R17.4 review approved per phase-N/review-notes.md)`. |
| REVISE | User applies fixes; re-runs review (`Review phase-N using the phase-review template.`); re-checks recommendation. Status stays `draft`. |
| RE-SPEC | User pauses phase; opens new design discussion. May trigger `/speckit.specify` re-run. |

The sign-off block in `phase-N/review-notes.md` records timestamp, reviewer name, recommendation, and any conditions. This is the audit trail.

---

## Cross-references

- Constitution R17.4 (lifecycle: validated → approved) — the gate this review supports
- CLAUDE.md §8c (Phase artifact maintenance — R17 lifecycle bumps + R19 rollups)
- CLAUDE.md §8d (Phase review — references this template)
- `/speckit.analyze` skill — runs FIRST; this review runs SECOND
- [phase-review-report.template.md](phase-review-report.template.md) — output schema
- PRD §10.6 (Agent self-verification — adjacent discipline at task-level)
- PRD §10.9 (PR Contract — review notes feed the PR Contract Proof block)
