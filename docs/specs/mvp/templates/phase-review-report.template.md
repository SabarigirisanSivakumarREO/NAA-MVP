---
title: Phase {N} Engineering Lead Review Notes
artifact_type: review-notes
status: complete
version: 1.0
phase_number: {N}
phase_name: {phase-name-slug}
reviewed_at: {YYYY-MM-DD}
reviewer: {Name}
template_used: docs/specs/mvp/templates/phase-review-prompt.md v1.0
analyze_pass_reference: {phase-N/analyze-report.md OR session timestamp}

recommendation: {APPROVE | REVISE | RE-SPEC}

artifacts_reviewed:
  - phase-N/README.md (vX.X)
  - phase-N/spec.md (vX.X)
  - phase-N/plan.md (vX.X)
  - phase-N/tasks.md (vX.X)
  - phase-N/impact.md (vX.X if present)
  - phase-N/checklists/requirements.md

constitution_version_validated: docs/specs/mvp/constitution.md R1-R26
---

# Phase {N} ({Phase Name}) — Engineering Lead Review Notes

> **One-line verdict:** {APPROVE / REVISE / RE-SPEC} — {one-sentence summary, e.g. "Design is sound; 0 HIGH findings; 2 MEDIUM polish items deferred."}

---

## 1. Phase scope

| Field | Value |
|---|---|
| Phase folder | `docs/specs/mvp/phases/phase-{N}-{name}/` |
| Risk level (per impact.md or inferred) | {LOW / MEDIUM / HIGH} |
| Highest-risk surface | {one-line description} |
| First-runtime constitutional activations | {list, e.g. "R6 first runtime; R10 first runtime; or 'none — pure setup'"} |
| Phase precedes/follows | precedes: {N+1, ...}; follows: {N-1, ...} |
| Estimated effort | {from plan.md §9 or equivalent} |

---

## 2. Step 1 — Read-order findings

Findings caught during the README → spec → impact → plan → tasks read pass. Items here are usually surface-level: missing sections, ordering issues, terminology that confused the reader on first pass.

| ID | Severity | Location | Finding | Recommended action |
|---|---|---|---|---|
| R1 | LOW | README.md L{N} | {description} | {action} |
| R2 | ... | ... | ... | ... |

If zero findings: write "No read-order findings — artifacts read coherently in canonical order."

---

## 3. Step 2 — Per-artifact judgment findings

Findings from the per-artifact judgment questions (see template §Step 2). Items here are JUDGMENT calls — design errors that analyze can't catch.

### README.md

{One paragraph or 2-3 bullet findings, OR "No judgment findings."}

### spec.md

{Findings.}

### impact.md (if present)

{Findings, OR "Not applicable — Phase touches no shared contracts (R20 N/A)."}

### plan.md

{Findings.}

### tasks.md

{Findings.}

### checklists/requirements.md

{Findings, OR "All static quality checks passing."}

---

## 4. Step 3 — Doom check ★

**Highest-risk surface chosen:** {one-line description}

**Doom-check question asked:** {the specific question, e.g. "If a contractor joined next week and ran the drafting workflow blindly, where would heuristic content leak?"}

**Walk-through:**

{2-5 paragraphs walking through the actual flow under adversarial conditions. List each step in the flow and what could go wrong. Identify any failure path that existing AC tests / kill criteria DO NOT cover.}

**Findings (failure paths the existing rails don't cover):**

| ID | Severity | Failure path | Why existing rails miss it | Recommended mitigation |
|---|---|---|---|---|
| D1 | HIGH | {description} | {analysis} | {action} |
| D2 | ... | ... | ... | ... |

If zero findings: write "Doom check passed — every failure path identified is covered by an existing AC test, kill criterion, or constitutional rule."

---

## 5. Step 4 — Kill criteria validation

For each kill criterion in plan.md, validate it's real (concrete trigger, concrete action) vs decorative (vague trigger or absent action).

| Trigger | Source (plan.md §) | Concrete action defined? | Realistic threshold? | Verdict |
|---|---|---|---|---|
| {trigger 1} | §{X} | ✅ / ❌ | ✅ / ❌ | REAL / DECORATIVE / MISSING |
| ... | ... | ... | ... | ... |

**Findings:**

{If any DECORATIVE or MISSING: list as findings with recommended action. If all REAL: "All kill criteria are real and properly defined."}

---

## 6. Step 5 — Recommendation

### Recommendation: **{APPROVE / REVISE / RE-SPEC}**

### Rationale

{2-3 sentences explaining why this recommendation. Cite specific findings from sections 2-5 if REVISE or RE-SPEC.}

### Conditions on approval (if APPROVE with conditions)

{Optional. If APPROVE but with deferred polish items, list them here as "deferred to polish PR after T{first-task-id} lands":
- L1: ...
- L2: ...
}

### What user does next

{
  If APPROVE: "Bump `status: draft → approved` on spec.md, plan.md, tasks.md, impact.md (if present). Commit with message including `(R17.4 review approved per phase-{N}/review-notes.md)`."
  If REVISE: "Address findings: [list IDs from sections 2-5]. Re-run review with `Review phase-{N} using the phase-review template`. Status stays `draft`."
  If RE-SPEC: "Pause phase. Re-open design discussion on [specific concern]. Consider re-running `/speckit.specify` to generate a revised spec."
}

---

## 7. Sign-off

| Field | Value |
|---|---|
| Reviewer name | {Engineering lead name} |
| Reviewed on | {YYYY-MM-DD} |
| Reviewer role | engineering lead |
| Time spent | {minutes — should match the phase risk level: LOW ~30min, MEDIUM ~45min, HIGH ~60min} |
| Recommendation | {APPROVE / REVISE / RE-SPEC} |
| Constitutional rules verified | R1-R26 (with attention to: {list rules first-activated in this phase}) |
| Status transition authorized | {YES, draft → approved | NO, status stays draft} |
| Reviewer signature | {sign-off note, e.g. "Reviewed independently of authoring; doom check ran fresh; 4hr after authoring break."} |

---

## Cross-references

- [phase-review-prompt.md](../../templates/phase-review-prompt.md) — the template that generated this report
- [`/speckit.analyze`](../../../../.claude/skills/speckit-analyze/) — mechanical consistency check (must precede this review)
- [Constitution R17.4](../../constitution.md) — lifecycle gate this review supports
- [CLAUDE.md §8d](../../../../CLAUDE.md) — phase review invocation guidance
- [`phase-{N}-current.md` rollup](phase-{N}-current.md) — to be authored at phase exit (R19); references this review
