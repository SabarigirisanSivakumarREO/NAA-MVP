# Phase 4b — Review Notes

**Phase:** 4b (Context Capture Layer v1.0)
**Gate:** 1 (Pre-flight — R17.4 status:draft → approved gate)
**Pass:** 1
**Reviewer:** neural-ai-reviewer (Stage 1b dispatch from master orchestrator)
**Risk-gate mode:** high-attention (6 shared contracts ≥3 threshold; cap=3 parallel; cost ceiling $5; two-pass critic mandatory)
**Policy applied:** fix-all-spec-defects (Session 19, 2026-05-13)
**Date:** 2026-05-15
**Branch:** feat/phase-4b-context-capture @ bd6fdd6

---

## Recommendation: REVISE

**Strictest-of(correctness=REVISE, coverage=PASS, completeness=REVISE) → REVISE**

8-action patch wave required before R17.4 status:draft → approved transition. Master orchestrator may apply the wave in this session or defer to next per user direction.

---

## Sub-audit 1: Correctness (analyze synthesis)

Re-run after Phase 4 merge per `r20-invalidation-from-phase-4.md`. Stale prior run (2026-05-15T13:55Z) overwritten.

| ID   | Severity | Class            | Category             | Finding (one-line)                                                     | Action     | Block? |
|------|----------|------------------|----------------------|------------------------------------------------------------------------|------------|--------|
| F-01 | HIGH     | spec_defect      | DEPENDENCY_CONFLICT  | impact.md missing `consumes_from:` block enumerating Phase 4 contracts | spec_patch | YES    |
| F-02 | MED      | spec_defect      | REQ_COVERAGE         | 3 dimension REQ-IDs in frontmatter w/ zero body anchors                | spec_patch | YES    |
| F-03 | LOW      | spec_defect      | INCONSISTENCY        | REQ-SAFETY-005 in spec but missing from plan + tasks req_ids           | spec_patch | YES    |
| F-04 | LOW      | spec_defect      | INCONSISTENCY        | spec.md L80 stale "Feature Branch: master"                              | spec_patch | YES    |
| F-05 | LOW      | spec_defect      | UNDERSPECIFICATION   | AC-13/NF-06 hard 12-25 vs plan.md §3 ASK-FIRST 8-25                    | spec_patch | YES    |
| F-06 | LOW      | tooling_quirk    | AMBIGUITY            | plan.md/tasks.md migration filename placeholder                          | log_only   | no     |
| F-07 | LOW      | pure_cosmetic    | INCONSISTENCY        | spec.md L54 delta.new shorthand                                         | log_only   | no     |
| F-08 | LOW      | spec_defect      | INCONSISTENCY        | affected_contracts count drift (spec/impact=6, plan/tasks=5)            | spec_patch | YES    |

**Correctness verdict:** REVISE (6 blocking).

---

## Sub-audit 2: Coverage (spec:matrix synthesis)

`pnpm spec:matrix --phase=4b --json` (fresh, 2026-05-15T17:07Z):

- Total ACs: 15
- ACs with `expected_test` path declared in spec.md: **15 (100%)** — pre-flight threshold satisfied
- Actual test files on disk: 1 of 15 (AC-07; incidental Phase 0b authoring)
- Missing test files: 14 (expected — Stage 2 lands them)
- Orphan tests in repo: 74 (cross-phase legacy; not Phase 4b defects)

**Coverage verdict:** PASS — all 15 ACs have test PLANS; test EXECUTION checked at verification gate per `coverage-audit.md` thresholds.

---

## Sub-audit 3: Completeness (auditor + adversarial critic, R5.6)

High-attention mode → two-pass critic MANDATORY. 6 categorical surfaces identified dynamically from spec text.

| # | Surface                                | Auditor verdict | Critic verdict | Final     | Action      |
|---|----------------------------------------|-----------------|----------------|-----------|-------------|
| 1 | context_dimensions (5)                 | PASS            | AGREE          | PASS      | none        |
| 2 | ContextSource_enum (6)                 | PASS            | AGREE          | PASS      | none        |
| 3 | business_archetype_universe (6 MVP)    | PASS            | EXTEND         | **SPEC_GAP** | act-007  |
| 4 | page_type_universe (~10)               | PASS            | AGREE          | PASS      | none        |
| 5 | regulated_verticals_enum (6 MVP)       | SPEC_GAP        | EXTEND         | **SPEC_GAP** | act-008  |
| 6 | R25_hard_prohibitions (10)             | PASS            | AGREE          | PASS      | act-009 (optional) |

### Surface 3 detail: business archetype universe
Auditor flagged 6-archetype MVP scope as PASS (publisher / non-profit / education / government / content-subscription handled via low-confidence + open_question fallback). Critic EXTEND: argues spec should explicitly defer the long-tail in §Out-of-Scope rather than silently rely on confidence fallback, because consultant auditing a publisher/Patreon-like site will halt at clarification with no matching heuristic library. Recommended: spec_patch (act-007) — append explicit §Out-of-Scope entry.

### Surface 5 detail: regulated verticals enum
Auditor flagged SPEC_GAP (6 MVP verticals presented as closed enum, but "regulated" implies open universe). Critic EXTEND: adds 7 verticals with citations — cannabis (state-licensed), firearms (ATF), adult_content (FOSTA/SESTA), tobacco_or_vape (FDA Deeming Rule), alcohol (TTB), financial_advice_or_RIA (SEC), telehealth (state licensure + HIPAA overlap). Each is a real audit-rejection risk. Recommended: spec_patch (act-008) — Option B (explicit deferral in §Out-of-Scope) is the minimum diff and preserves R22 ratchet.

### Surface 6 detail: R25 hard-prohibitions (10 items)
All 10 items from constitution.md §25.1 covered or partially covered by T4B-014 AST scan + Zod schema enforcement + file layout. Critic AGREE with minor citation downgrade on `no_heuristic_judgments` (regex-based field-name linter could be Zod-enforced) and a borderline flag on `no_run_perception_heuristics` (file layout prevents but no explicit AST scan). Optional polish: act-009.

**Completeness verdict:** REVISE (2 surfaces SPEC_GAP after critic EXTEND).

---

## Patch wave (8 blocking actions, 1 optional)

| Act ID  | Target                                                  | Severity | Cites                    |
|---------|---------------------------------------------------------|----------|--------------------------|
| act-001 | impact.md (frontmatter consumes_from + §3a)              | HIGH     | F-01 (R20 trigger)        |
| act-002 | spec/plan/tasks frontmatter req_ids                      | MED      | F-02                     |
| act-003 | plan/tasks frontmatter (add REQ-SAFETY-005)              | LOW      | F-03                     |
| act-004 | spec.md L80 branch label                                 | LOW      | F-04                     |
| act-005 | spec.md AC-13 + NF-06 lower bound clarification          | LOW      | F-05                     |
| act-006 | plan/tasks affected_contracts (add 6th: AnalyzePerception accessor) | LOW | F-08              |
| act-007 | spec.md Out-of-Scope (business archetype long-tail)      | MED      | completeness/business_archetype |
| act-008 | spec.md AC-09 + R-10 + Out-of-Scope (regulated verticals long-tail) | MED | completeness/regulated_verticals |
| act-009-optional | plan.md §2.4 (HeuristicLoader AST scan)          | LOW      | completeness/R25 critic   |

**Total estimate:** 40-60 min wall-clock, ~$1.50-2.50, within phase ceiling ($5).

---

## R17 + R20 gate state

| Rule  | State                                              |
|-------|---------------------------------------------------|
| R17.4 | status:draft → approved **BLOCKED** until patch wave + Pass 2 APPROVE |
| R18   | Each patch action specifies an append-only delta block — no line removal |
| R20   | act-001 closes the R20 invalidation note item 5 requirement; remaining R20 closures in act-002/003/006/008 (no new cross-phase invalidation) |
| R11.4 | All spec defects (CRITICAL/HIGH/MED + LOW spec_defect) flagged for fix BEFORE impl per fix-all-spec-defects policy |

---

## Pass 2 re-review trigger

After master applies the 8-action patch wave:
1. Re-run `/speckit.analyze` on Phase 4b folder → fresh `.phase-state/4b/preflight-correctness.json`
2. Re-run `pnpm spec:matrix --phase=4b` → fresh `.phase-state/4b/preflight-coverage.json`
3. Re-dispatch neural-ai-reviewer Pass 2 → fresh `.phase-state/4b/preflight-verdict-pass2.yaml`
4. Expected verdict: APPROVE (assuming all 8 actions land cleanly)
5. On APPROVE: bump spec.md / plan.md / tasks.md / impact.md `status: draft → approved`; commit citing `(R17.4 review approved per phase-4b/review-notes.md Pass 2)`; flip `.phase-state/4b.json` to `stage: 2-impl`.

---

## Audit trail (file locations)

| File                                              | Purpose                                                          |
|---------------------------------------------------|------------------------------------------------------------------|
| `.phase-state/4b.json`                            | Master state (gitignored; updated each stage)                     |
| `.phase-state/4b/preflight-correctness.json`      | Mechanical analyze findings (gitignored; this run overwrote stale 13:55Z run) |
| `.phase-state/4b/preflight-coverage.json`         | spec:matrix output (gitignored)                                    |
| `.phase-state/4b/preflight-verdict.yaml`          | Full verdict YAML w/ 3 sub-audits + 6 completeness surfaces (gitignored) |
| `.phase-state/4b/verify-summary.md`               | Human-stamp summary (gitignored)                                   |
| `docs/specs/mvp/phases/phase-4b-context-capture/r20-invalidation-from-phase-4.md` | R20 propagation note (committed @ d8ec532) |
| `docs/specs/mvp/phases/phase-4b-context-capture/stage-1-preflight-outputs.md`     | Audit outputs mirror (committed @ bd6fdd6) |
| `docs/specs/mvp/phases/phase-4b-context-capture/review-notes.md`                  | THIS FILE — R17.4 audit-trail (this commit)  |

---

## Reviewer notes for future sessions

1. **R20 closure batch.** Closing act-001 (impact.md consumes_from) discharges the R20 invalidation note's pre-Gate-1 requirement. The R20 note may then be moved to `r20-invalidation-from-phase-4.resolved.md` or its checklist marked complete.

2. **Stage 2 readiness.** Patch wave is contained within Phase 4b's own artifacts — no cross-phase ripple expected. After Pass 2 APPROVE, Stage 2 impl can dispatch with the corrected spec.

3. **High-attention mode.** Two-pass critic added ~$0.50-1.00 to this audit's cost (vs single-pass) and surfaced 2 SPEC_GAPs that would have caused mid-impl R11.4 confusion otherwise (business archetype long-tail, regulated verticals long-tail). Net win.

4. **Cost discipline.** This dispatch consumed ~$1.20-1.80 of the $5 phase ceiling. Patch wave estimated at $1.50-2.50. Total Stage 1 burn: $2.70-4.30 (under ceiling). Stage 2 impl will need the remaining $0.70-2.30 — tight but feasible per Phase 4 precedent (Phase 4 Stage 2 spent ~$1.50 with high-attention parallelism cap=3).

5. **Pattern detection.** The "frontmatter req_ids drift" pattern (F-02 + F-03) recurs across phases (Phase 4 had a similar drift fix in Stage 1). Consider a `spec:matrix` extension that cross-checks frontmatter req_ids against body anchors. Logged for org-wide spec-driven workflow hygiene.
