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

---

# Pass 2 — Post Patch-Wave Re-Review

**Phase:** 4b (Context Capture Layer v1.0)
**Gate:** 1 (Pre-flight — R17.4 status:draft → approved gate)
**Pass:** 2
**Reviewer:** neural-ai-reviewer (Stage 1b dispatch Pass 2; high-attention mode preserved)
**Risk-gate mode:** high-attention (unchanged from Pass 1)
**Policy applied:** fix-all-spec-defects (Session 19, 2026-05-13)
**Date:** 2026-05-15
**Branch:** feat/phase-4b-context-capture @ 821c266 (patch wave commit)
**Pass 1 reference:** review-notes.md "Recommendation: REVISE" section above (commit 8965724)

---

## Recommendation: APPROVE

**Strictest-of(correctness=APPROVE, coverage=PASS, completeness=APPROVE) → APPROVE**

All 6 Pass 1 blocking findings CLOSED via 8-action patch wave (commit 821c266). Both Pass 1 completeness SPEC_GAP surfaces (business_archetype_universe, regulated_verticals_enum) CLOSED via act-007 + act-008 §Out-of-Scope additions. R17.4 lifecycle gate `status: draft → approved` is now UNBLOCKED pending master orchestrator stamp.

---

## Pass 1 finding closure table

| ID   | Severity | Act    | Pass 2 status | Closure evidence (one-line)                                           |
|------|----------|--------|---------------|------------------------------------------------------------------------|
| F-01 | HIGH     | act-001 | **CLOSED**   | impact.md v0.2 has `consumes_from:` block (9 contracts) + §3a body; R20 item 5 discharged |
| F-02 | MED      | act-002 | **CLOSED**   | 3 orphan dimension REQ-IDs removed from spec/plan/tasks frontmatter (Option B) |
| F-03 | LOW      | act-003 | **CLOSED**   | REQ-SAFETY-005 added to plan.md + tasks.md req_ids                     |
| F-04 | LOW      | act-004 | **CLOSED**   | spec.md L80 branch label updated to `feat/phase-4b-context-capture`    |
| F-05 | LOW      | act-005 | **CLOSED**   | AC-13 + NF-06 carry "12-25 / 8-25 (library <40)" lower-bound clarification |
| F-06 | LOW      | n/a     | STILL_LOG_ONLY | Migration filename placeholder (correct authoring pattern; not patched)    |
| F-07 | LOW      | n/a     | STILL_LOG_ONLY | delta.new shorthand (harmless narrative; not patched)                  |
| F-08 | LOW      | act-006 | **CLOSED**   | 6th affected_contracts entry added to plan.md + tasks.md (sibling-sync) |

**Pass 1 blocking summary:** 6 blocking findings → 6 CLOSED, 0 STILL OPEN. 2 LOW non-blocking findings (F-06, F-07) correctly remain log_only per Pass 1 disposition.

---

## Pass 1 completeness SPEC_GAP closure table

| Surface                              | Pass 1 verdict | Act     | Pass 2 status | Closure mechanism                                                       |
|--------------------------------------|----------------|---------|---------------|--------------------------------------------------------------------------|
| business_archetype_universe          | SPEC_GAP       | act-007 | **CLOSED**   | spec.md §Out-of-Scope: 5 long-tail archetypes deferred to v1.1 / Phase 13b |
| regulated_verticals_enum             | SPEC_GAP       | act-008 | **CLOSED**   | spec.md AC-09 + R-10 + §Out-of-Scope: 7 additional verticals deferred to Phase 13b |

**Critic Pass 2 verdict:** AGREE_CLOSED on both. Spec no longer relies silently on confidence-fallback; consultants now have pre-audit visibility into v1.0 archetype + regulatory coverage limits.

---

## Pass 2 new findings

| ID   | Severity | Class         | Type                       | Disposition                                            |
|------|----------|---------------|----------------------------|--------------------------------------------------------|
| G-01 | LOW      | pure_cosmetic | VERIFICATION_OBSERVATION   | log_only (positive — confirms R18 sibling-sync atomicity) |
| G-02 | LOW      | pure_cosmetic | VERIFICATION_OBSERVATION   | log_only (positive — R20 invalidation note item 5 closure cleanliness) |

**No new blocking findings introduced by the patch wave.**

---

## Sub-audit summaries

### Sub-audit 1: Correctness (Pass 2 re-analysis)
- Pass 1 blocking: 6 → Pass 2 closed: 6 (100%)
- Pass 1 non-blocking: 2 → Pass 2 still log_only: 2 (unchanged)
- Pass 2 new findings: 2 LOW pure_cosmetic positive observations
- Verdict: **APPROVE**

### Sub-audit 2: Coverage (Pass 2 re-run)
- spec:matrix --phase=4b regenerated at 2026-05-15T18:24:29Z; no AC delta (15 ACs preserved by R18 append-only)
- Same 14 missing test files (Stage 2 impl lands them); same 74 cross-phase orphans (out of Phase 4b scope)
- Verdict: **PASS** (identical to Pass 1)

### Sub-audit 3: Completeness (Pass 2 critic re-probe)
- 4 PASS surfaces from Pass 1 unchanged (patch wave did not modify their spec text; critic silent AGREE)
- 2 SPEC_GAP surfaces re-probed:
  - business_archetype_universe → critic verdict AGREE_CLOSED (act-007 closure satisfies Option B explicit deferral)
  - regulated_verticals_enum → critic verdict AGREE_CLOSED (act-008 closure satisfies Option B with all 7 verticals named + framework-cited)
- Verdict: **APPROVE**

---

## R17 + R20 gate state (Pass 2)

| Rule  | State                                                          |
|-------|----------------------------------------------------------------|
| R17.4 | status:draft → approved **UNBLOCKED** — master may stamp + bump |
| R18   | All 4 sibling artifacts bumped v0.1 → v0.2 with delta blocks; no body lines removed except orphan REQ-IDs flagged in act-002 |
| R20   | act-001 closes R20 invalidation note item 5; remaining R20-touched items (act-002/003/006/008) all CLOSED; no new R20 invalidation introduced |
| R11.2 | spec/plan/tasks now consistent at 10 REQ-IDs each; affected_contracts consistent at 6/6/6/6 |
| R11.4 | All Pass 1 spec defects (CRITICAL/HIGH/MED + LOW spec_defect) patched BEFORE impl per fix-all-spec-defects policy |
| R5.6  | Two-pass auditor + critic discharged; critic Pass 2 verdict AGREE_CLOSED on both Pass 1 SPEC_GAP surfaces |

---

## Master orchestrator next actions

1. **Stamp Pass 2 APPROVE** on Gate 1. Update `.phase-state/4b.json` with `gate_1_pass2_verdict: APPROVE` + `stamped_at` timestamp.
2. **Bump R17.4 lifecycle** — `status: draft → approved` on all 4 patched artifacts (spec.md, plan.md, tasks.md, impact.md). Commit message: `(R17.4 review approved per phase-4b/review-notes.md Pass 2)` — SEPARATE commit (not part of patch wave per dispatch policy).
3. **Flip stage** — `.phase-state/4b.json` `stage: 1-preflight → 2-impl`. Stage 2 impl can now dispatch.
4. **(Optional)** Mark `r20-invalidation-from-phase-4.md` as resolved (rename to `.resolved.md` or append §Resolved section). R20 propagation chain complete for Phase 4b.

---

## Pass 2 audit trail (file locations)

| File                                                | Pass 2 update                                                  |
|-----------------------------------------------------|----------------------------------------------------------------|
| `.phase-state/4b/preflight-correctness.json`        | Overwritten 2026-05-15T18:30Z (Pass 2 re-analyze; 0 blocking findings) |
| `.phase-state/4b/preflight-coverage.json`           | Regenerated 2026-05-15T18:24:29Z via `pnpm spec:matrix --phase=4b --json` |
| `.phase-state/4b/preflight-verdict-pass2.yaml`      | NEW — Pass 2 verdict YAML w/ 3 sub-audits + closure table        |
| `.phase-state/4b/verify-summary.md`                 | Overwritten with Pass 2 summary                                  |
| `docs/specs/mvp/phases/phase-4b-context-capture/review-notes.md` | THIS FILE — Pass 2 section appended after Pass 1 |
| `docs/specs/mvp/phases/phase-4b-context-capture/{spec,plan,tasks,impact}.md` | v0.1 → v0.2 patched (commit 821c266) |

---

## Pass 2 reviewer notes for future sessions

1. **High-attention mode efficiency.** Pass 2 critic re-probe focused only on the 2 SPEC_GAP surfaces from Pass 1 (business_archetype_universe, regulated_verticals_enum). The 4 PASS surfaces from Pass 1 were not re-probed since the patch wave did not modify their underlying spec text — a silent AGREE per critic continuity. Wall-clock ~10 min vs Pass 1's ~30 min full critic probe.

2. **Patch wave atomicity verification.** All 4 sibling artifacts (spec / plan / tasks / impact) bumped v0.1 → v0.2 in single commit 821c266. delta.changed blocks cross-reference siblings. R18 sibling-coherence verified. G-01 / G-02 are positive observations.

3. **R20 closure completeness.** act-001 discharges R20 invalidation note item 5 explicitly. Remaining R20-touched items (act-002 req_id reconciliation; act-003 REQ-SAFETY-005 backfill; act-006 affected_contracts sync; act-008 R-10 extension) are all closed. R20 propagation chain for Phase 4b complete.

4. **Cost discipline (Pass 2).** Pass 2 estimated cost ~$0.40-0.60 (focused finding-closure re-audit; no full critic deep-probe of unchanged surfaces). Combined with Pass 1 ($1.20-1.80) + patch wave (~$0.30-0.50 for the 4-file edit + commit dispatch overhead), Stage 1 + Gate 1 total burn: ~$1.90-2.90 of $5 ceiling. Stage 2 has ~$2.10-3.10 remaining headroom — comfortable per Phase 4 precedent ($1.50 with cap=3 parallelism).

5. **No-regression check.** All 15 ACs + 15 R-NN + 6 NF-NN preserved by R18 append-only. AC IDs / R IDs / NF IDs unchanged. Task IDs (T4B-001..T4B-015) unchanged. Dependency chains in plan.md §1 unchanged. R25 enforcement points in plan.md §2.4 unchanged.

6. **Stage 2 readiness.** Spec is now production-ready for parallel-subagent dispatch (cap=3 per high-attention mode). All shared contracts enumerated; consumes_from explicit; long-tail archetypes + verticals scoped; lower-bound thresholds clarified; R25 prohibitions preserved.
