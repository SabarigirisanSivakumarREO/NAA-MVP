---
title: Git Workflow (branches, commits, PRs)
artifact_type: engineering-practice
status: approved
version: 1.0
created: 2026-04-24
updated: 2026-04-24
owner: engineering lead
authors: [REO Digital team, Claude]

supersedes: "docs/specs/mvp/PRD.md §11.5 (v1.2 and earlier — inline content extracted to this file)"
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (v1.2 §11.5 — extracted)
  - docs/specs/mvp/constitution.md R11 (Spec-Driven Development Discipline)
  - docs/specs/mvp/PRD.md §10.6 (Spec coverage)
  - docs/specs/mvp/PRD.md §10.9 (PR Contract)

governing_rules:
  - Constitution R11.5 (commit message format)
  - PRD §10.6 (Spec coverage required in PR body)
  - PRD §10.9 (PR Contract required in PR body)

delta:
  new:
    - File created by extracting PRD §11.5 to separate engineering-practice doc
  changed:
    - Pre-commit checklist updated to reference PRD §10.9 (PR Contract) in addition to §10.6 (Spec coverage)
  impacted:
    - docs/specs/mvp/PRD.md §11.5 (content replaced with pointer here)
    - CLAUDE.md §6 (pointer added)
  unchanged:
    - Branch naming, commit message template, pre-commit checklist, PR policy, branching model
---

# Git Workflow — branches, commits, PRs

> **Summary (~80 tokens):** Git conventions for Neural — branch naming, commit message template with TaskID + REQ-ID, pre-commit checklist (lint + typecheck + test + conformance), PR policy requiring Spec coverage (§10.6) + PR Contract (§10.9), branching model. Extracted from PRD §11.5 to separate engineering-practice from product requirements.

## 1. Branch naming

```
<type>/<phase>-<task-id>-<short-kebab-name>

Types: feat, fix, refactor, test, docs, chore, perf
```

**Examples:**

```
feat/phase-1-m1.5-mutation-monitor
feat/phase-7-m7.16-gr-007-no-conversion-predictions
fix/m7.10-gr-001-off-by-one
refactor/heuristic-loader-async
test/phase-8-m8.15-example-com-acceptance
docs/prd-v1.1-add-conformance-suite
chore/bump-claude-sonnet-to-latest
```

**Rules:**
- Lowercase only
- Kebab-case for the short name
- Include task ID (`m7.16`, not just "gr-007")
- Keep `<short-kebab-name>` under 40 chars

## 2. Commit message template

**Full form:**

```
<type>(<scope>): <TaskID> <imperative summary> (<REQ-ID>)

<body explaining WHY — not WHAT>

<optional: Spec coverage section per §10.6>

<trailer>
```

**Real example — grounding rule implementation:**

```
feat(grounding): M7.16 add GR-007 no-conversion-predictions rule (REQ-GROUND-007)

GR-007 is the absolute ban on conversion impact predictions. The rule
runs deterministically after self-critique and rejects any finding whose
observation, assessment, or recommendation contains banned phrases
("increase conversion", "%lift", "ROI of N", etc.).

Design choice: regex-based pattern list rather than LLM check, because
grounding must be deterministic (R13, REQ-GROUND-007). Patterns cover
the most common LLM hallucinations observed during prompt testing.

Spec coverage for M7.16 (REQ-GROUND-007):
  ✅ Regex pattern list covers "increase conversion", "%lift", "ROI of N"
     - packages/agent-core/src/analysis/grounding/rules/GR007.ts:5-10
  ✅ Case-insensitive matching (i flag on every pattern)
  ✅ Scans observation + assessment + recommendation (not just one field)
  ✅ Returns structured {pass, reason} result
  ✅ Conformance test added: tests/conformance/gr007.test.ts

Not covered by this PR:
  - Integration into EvidenceGrounder chain → M7.22 (separate PR)
  - Rejected-finding storage → M7.26 (StoreNode task)

Task: M7.16
Spec: docs/specs/final-architecture/07-analyze-mode.md §7.7 GR-007
```

**Short form (for small / unambiguous changes):**

```
fix(grounding): M7.10 off-by-one on GR-001 element index lookup (REQ-GROUND-001)

Array index was 1-based in spec example but 0-based in implementation.
Aligned to 0-based per TypeScript/JS convention.
```

**Rules:**
- Lowercase `<type>`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`
- `<scope>` in parentheses. Common: `grounding`, `perception`, `orchestration`, `dashboard`, `adapters`, `scoring`, `prd`, `docs`
- `<TaskID>` always present for implementation commits (`M7.16` or `T117`)
- `<REQ-ID>` in parens at end of subject
- Subject line < 72 chars including prefix
- Body required for any non-trivial change; explain WHY, not WHAT
- **Spec coverage section required** (per PRD §10.6) for tasks tied to acceptance criteria

## 3. Pre-commit checklist

Claude Code (and humans) MUST run before every commit:

1. `pnpm lint` → zero warnings
2. `pnpm typecheck` → no TS errors
3. `pnpm test` (affected workspace) → green
4. `pnpm test:conformance -- <component>` if task touches a component with a conformance test (PRD §9.6)
5. Task's smoke test → passes (from `tasks-v2.md`)
6. Verify changed files match task scope — no drive-by edits (PRD §10.6)
7. Sanity-check `.env` is NOT staged; no secrets, no large logs, no `node_modules`
8. Commit message follows §2 format above; Spec coverage section present (PRD §10.6)

## 4. Pull request policy

- **One task = one PR** (unless tasks are trivially sequential and break intermediate state)
- **PR title = commit subject line format**
- **PR body** MUST include:
  1. **PR Contract** (4 blocks per PRD §10.9) — What/Why, Proof, Risk+AI involvement, Review focus
  2. **Spec coverage** section (PRD §10.6) — every acceptance criterion with ✅ / ❌ / 🟡
  3. Test output (paste CI check summary)
  4. Screenshots if UI-touching
  5. Any deviations from spec + approval reference (PRD §10.8)
- **Phase exit criteria met** before merging the last PR of a phase (Spec Kit `tasks.md` has these)
- **No** `--no-verify` / hook bypass / signing bypass without written approval in PR body
- **Never** force-push to `main`
- **Never** merge a PR with any red CI check

## 5. Branching model

```
main ────────────────────────────────────────────────────────────────►
  │                                                    ▲
  ├──► feat/phase-1-m1.5-mutation-monitor  ────────────┤
  │                                                    │  (PR, review, merge)
  ├──► fix/m7.10-gr-001-off-by-one  ───────────────────┤
  │                                                    │
  └──► docs/prd-v1.1-add-conformance-suite ────────────┘
```

- `main` is always deployable
- No long-lived feature branches (merge after each task)
- Short-lived branches (1-3 days max)
- If a task is truly multi-day, split it into smaller tasks first

## Cross-references

- Constitution R11.5 — commit message format rule
- PRD §10.6 — Spec coverage requirement (PR body)
- PRD §10.9 — PR Contract requirement (PR body)
- PRD §10.8 — reasoning log guidelines
- `.claude/skills/neural-dev-workflow/references/templates.md` — copy-paste templates for PR Contract and Kill Criteria
