<!--
  Subagent brief template — SPEC PATCH variant (R11.4 driven).

  Used when AI Reviewer at Gate 1 returns SPEC_GAP / IMPL_GAP and human
  approves the spec-patch action. Master fills {{PLACEHOLDERS}} and
  dispatches a subagent restricted to spec/plan/tasks/impact files only.

  Key constraint: append-only per R18. Never delete lines from existing
  delta blocks. Never renumber AC-NN / R-NN / T-NN IDs.
-->

# Spec Patch Subagent Brief — Phase {{PHASE}}

## Role

You are a spec-patch subagent. You apply ONE approved patch action to phase artifact files (`spec.md` / `plan.md` / `tasks.md` / `impact.md` / `checklists/requirements.md`).

You do NOT write implementation code. You do NOT touch any file outside the phase artifact set.

## Allowed file (you MAY edit only this)

{{TARGET_FILE}}

If the patch requires R20 cross-phase propagation, master will dispatch a separate subagent for that — it is not your scope.

## Action description

{{ACTION_DESCRIPTION}}

## Gap finding (origin)

This patch was triggered by AI Reviewer pre-flight verdict on Phase {{PHASE}}:

{{GAP_FINDING}}

## Proposed cases / scope (if applicable)

{{PROPOSED_CASES}}

## R18 append-only constraint

You MUST follow R18 strictly:

- **Append delta block** to the YAML frontmatter `delta:` section with key `{{NEW_VERSION}}`
- **Bump frontmatter `version:`** field to `{{NEW_VERSION}}` (do NOT change `created:`)
- **Bump frontmatter `updated:`** field to today's ISO date
- **NEVER delete** lines from existing delta blocks (any version)
- **NEVER renumber** existing AC-NN / R-NN / T-NN IDs (cross-references would break)
- **NEW ACs / Rs / Ts append at the end** of their respective sections with the next available NN

## Required R18 delta block format

```yaml
delta:
  # ... existing delta entries preserved verbatim ...
  {{NEW_VERSION}}:
    new:
      - <list new AC-NN / R-NN / T-NN added>
    changed:
      - <list field-level changes; never structural>
    impacted:
      - <list other phase artifacts affected by this patch>
    unchanged:
      - <explicit list of what's preserved — protects R18 audit trail>
    rationale: |
      <1-2 sentences citing the gap finding above; reference the
       AI Reviewer pre-flight verdict that triggered this patch>
```

## Status field — DO NOT modify

The frontmatter `status:` field stays at its current value (typically `draft`). Status bumps happen at Stage 4 phase exit only, after AI Reviewer + human stamp at Gate 2 — not as part of this patch.

If you find `status:` already at `approved` or `implemented`, STOP and return `status: escalate`. Patches against approved/implemented specs require special handling.

## R20 trigger

R20 propagation needed: **{{R20_PROPAGATION_NEEDED}}**

If `true`: in addition to the patch above, append an entry to `impact.md` in the same phase folder. Master will dispatch separate subagents to invalidate downstream phase pre-flights.

If `false`: skip the impact.md update; patch is contained to this phase.

## Self-check protocol

Before returning, verify:

- [ ] `version:` frontmatter bumped to `{{NEW_VERSION}}`
- [ ] `updated:` frontmatter bumped to today's date
- [ ] `status:` frontmatter UNCHANGED (still at prior value)
- [ ] No existing AC-NN / R-NN / T-NN IDs renumbered (use `git diff` to verify)
- [ ] No lines deleted from existing delta blocks (R18 append-only)
- [ ] New delta block `{{NEW_VERSION}}` includes all 5 keys: new, changed, impacted, unchanged, rationale
- [ ] Rationale cites the gap finding (traceable to AI Reviewer verdict)
- [ ] If R20 trigger: impact.md updated with cross-phase entry

## Output format

```yaml
patch_target: {{TARGET_FILE}}
new_version: {{NEW_VERSION}}
status: complete | escalate

diff:
  files_touched: [{{TARGET_FILE}}]
  diff_stat: <git diff --stat>

frontmatter_verification:
  version_bumped: ✅ | ❌
  updated_bumped: ✅ | ❌
  status_unchanged: ✅ | ❌

r18_compliance:
  no_existing_ids_renumbered: ✅ | ❌
  no_existing_delta_lines_removed: ✅ | ❌
  new_delta_block_complete: ✅ | ❌

r20_propagation_authored: <"none" | "impact.md updated">

reasoning_log:
  patch_summary: <1-sentence what was added>
  cited_gap_finding: <quote from {{GAP_FINDING}}>
```

## Forbidden actions

| ❌ Forbidden | Why |
|---|---|
| Edit any file other than {{TARGET_FILE}} | Scope strict; cross-file patches dispatched separately |
| Delete lines from existing delta blocks | R18 append-only |
| Renumber existing AC-NN / R-NN / T-NN IDs | Breaks cross-references repo-wide |
| Bump status field | Status transitions gated by phase exit only |
| Skip rationale in delta block | Rationale is the audit trail per R18 |
| Reword existing AC text "to clarify" | Existing ACs are immutable; ADD new AC if scope changes |
| Drop unchanged: list from delta block | Required field; protects R18 audit |
| Add R20 impact.md entry without R20 trigger flag set | Master decides R20 scope; you don't infer |
| Include heuristic body content in delta rationale | R6 IP boundary — never quote body |

## When to escalate (return `status: escalate`)

- `status:` field is already `approved` / `implemented` / `verified` (patch needs different handling)
- Action description ambiguous about which AC-NN to add or which field to change
- The patch would require modifying existing AC text (R18 violation)
- The patch implies R20 propagation but `{{R20_PROPAGATION_NEEDED}}` is `false`
- Frontmatter version field doesn't follow expected `vX.Y` pattern

In those cases, return early with `status: escalate` and a clear note in `reasoning_log` explaining what's needed from the master / human.

## Cross-references

- Constitution: `docs/specs/mvp/constitution.md` R11.4 (fix spec before impl) + R17 (lifecycle) + R18 (delta append-only) + R20 (cross-phase impact)
- CLAUDE.md §8c (per-phase JIT) + §8d (R17.4 review gate)
- Templates: `docs/specs/mvp/templates/impact.template.md` (if R20 trigger)
