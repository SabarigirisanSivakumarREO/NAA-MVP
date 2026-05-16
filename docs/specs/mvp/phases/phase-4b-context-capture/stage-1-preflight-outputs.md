# Phase 4b — Stage 1 pre-flight outputs (analyze + matrix)

> **Audit trail.** The raw JSON outputs live at `.phase-state/4b/preflight-correctness.json` and `.phase-state/4b/preflight-coverage.json` (gitignored). This markdown is the committable mirror summarizing what was found.

**Ran:** 2026-05-15 17:15 UTC, post Phase 4 merge (3312eda)
**Branch:** feat/phase-4b-context-capture @ d8ec532 (R20 invalidation note commit)
**Policy:** fix-all-spec-defects (Session 19, 2026-05-13)
**Stale file overwritten:** `.phase-state/4b/preflight-correctness.json` (prior version dated 2026-05-15 13:55 UTC, pre-Phase-4-merge, did NOT reflect RobotsChecker / AuditLogger / AuditEvent 22-type LOCKED enum / PostgresStorage)

---

## Sub-audit 1: Correctness (analyze synthesis)

8 findings: **1 HIGH, 1 MED, 4 LOW spec_defects, 2 LOW non-blocking** (tooling_quirk + pure_cosmetic).

| ID   | Sev  | Class            | Category             | Ref                                                                                                                | Action     | Block? |
|------|------|------------------|----------------------|--------------------------------------------------------------------------------------------------------------------|------------|--------|
| F-01 | HIGH | spec_defect      | DEPENDENCY_CONFLICT  | impact.md — no `consumes_from:` block enumerating Phase 4 contracts (RobotsChecker, PostgresStorage, AuditLogger, AuditEvent 22-type LOCKED, llm_call_log) | spec_patch | **YES** |
| F-02 | MED  | spec_defect      | REQ_COVERAGE         | spec/plan/tasks frontmatter req_ids include REQ-CONTEXT-DIM-AUDIENCE-001 / TRAFFIC-001 / BRAND-001 with zero body anchors             | spec_patch | **YES** |
| F-03 | LOW  | spec_defect      | INCONSISTENCY        | REQ-SAFETY-005 in spec.md req_ids + body but missing from plan.md + tasks.md req_ids                              | spec_patch | **YES** |
| F-04 | LOW  | spec_defect      | INCONSISTENCY        | spec.md L80 "Feature Branch: master" stale                                                                          | spec_patch | **YES** |
| F-05 | LOW  | spec_defect      | UNDERSPECIFICATION   | AC-13/NF-06 hard-pin 12-25 heuristics; plan.md §3 allows 8-25 lower bound (ASK FIRST) — pre-empt mid-impl confusion | spec_patch | **YES** |
| F-06 | LOW  | tooling_quirk    | AMBIGUITY            | plan.md/tasks.md migration placeholder `0XX_context_profiles.sql` — correct authoring pattern                       | log_only   | no     |
| F-07 | LOW  | pure_cosmetic    | INCONSISTENCY        | spec.md L59 delta.new narrative shorthand "AC-01..AC-15 → T4B-001..T4B-015" not strictly 1:1                       | log_only   | no     |
| F-08 | LOW  | spec_defect      | INCONSISTENCY        | spec.md + impact.md include AnalyzePerception accessor as 6th affected_contract; plan.md + tasks.md omit it          | spec_patch | **YES** |

**Verdict (correctness):** REVISE — 6 blocking findings.

---

## Sub-audit 2: Coverage (spec:matrix synthesis)

Raw output: `pnpm spec:matrix --phase=4b --json` → `.phase-state/4b/preflight-coverage.json`

| Metric                          | Value |
|---------------------------------|-------|
| Total ACs                       | 15    |
| ACs with `expected_test` path   | 15 (100%)   |
| ACs with actual test on disk    | 1 (AC-07 — confidence-scorer.test.ts, incidental name collision from Phase 0b)        |
| ACs missing actual test file    | 14 (expected at pre-flight; tests land in Stage 2 impl)    |
| Total tests in repo             | 112   |
| Anchored tests                  | 38    |
| Orphan tests                    | 74 (cross-phase; not a Phase 4b defect)    |
| Coverage % (actual files)       | 7%    |

**Gate threshold per coverage-audit.md:** "Tests for ALL ACs not required yet — only the AC↔test plan. Threshold: 0% missing test PLANS."

**All 15 ACs have an `expected_test` path declared in spec.md.** Zero plans missing. The 14 "missing" entries refer to test FILES not yet authored (correct for pre-flight; Stage 2 lands them).

Orphan tests: 74 entries are unrelated to Phase 4b (Phase 0/0b/1/2/3/4 tests that don't carry a Phase 4b AC anchor); not a Phase 4b defect; logged for awareness.

**Verdict (coverage):** PASS — all 15 ACs have test plans declared. No pre-flight coverage finding blocks the gate.

---

## Sub-audit 3: Completeness (auditor + adversarial critic)

Categorical surfaces identified in Phase 4b spec text. Each runs Pass 1 (auditor) + Pass 2 (adversarial critic) per R5.6.

Detailed enumeration in `.phase-state/4b/preflight-verdict.yaml` § completeness. Summary:

| Surface                              | Auditor verdict | Critic verdict | Final verdict |
|--------------------------------------|-----------------|----------------|---------------|
| 5 context dimensions                  | PASS            | AGREE          | PASS          |
| ContextSource enum (6 sources)        | PASS            | AGREE          | PASS          |
| Business archetype universe (6 fixtures: D2C / B2B / SaaS / marketplace / lead_gen / service) | PASS            | AGREE          | PASS          |
| Page-type universe (~10 types: home / PDP / PLP / cart / checkout / landing / blog / pricing / comparison + impl fallback) | PASS            | AGREE          | PASS          |
| Regulated verticals enum (pharma / fintech / gambling / healthcare / legal / insurance) | SPEC_GAP        | EXTEND         | **SPEC_GAP**  |
| R25 hard-prohibitions enumeration (10 items in constitution.md §25.1)  | PASS            | AGREE          | PASS          |

**Verdict (completeness):** REVISE — 1 surface (regulated verticals) found SPEC_GAP; critic extends with additional cases per market knowledge.

---

## Overall verdict (Pass 1)

**REVISE** — patch wave required before status:draft → approved transition.

Strictest of correctness=REVISE, coverage=PASS, completeness=REVISE → **REVISE**.

**Action wave (7 actions, est. 30-45 min):**

| Act ID  | Target file                          | Action                                                                                                                            | Severity | Cites finding |
|---------|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|----------|---------------|
| act-001 | impact.md                            | Add `consumes_from:` block (frontmatter) + §3a "Consumed Phase 4 contracts" subsection enumerating 5+ Phase 4 contracts          | HIGH     | F-01          |
| act-002 | spec.md / plan.md / tasks.md         | Reconcile 3 orphaned dimension REQ-IDs — either add AC rows OR remove from frontmatter req_ids with delta block (option B preferred per spec narrative) | MED      | F-02          |
| act-003 | plan.md + tasks.md                   | Add REQ-SAFETY-005 to req_ids list + R18 delta block in each                                                                       | LOW      | F-03          |
| act-004 | spec.md L80                          | Update "Feature Branch: master" → "Feature Branch: feat/phase-4b-context-capture (Stage 1 pre-flight onward)" + R18 delta block                  | LOW      | F-04          |
| act-005 | spec.md AC-13 + NF-06                | Clarify 12-25 lower bound: "≥40 lib size; 8-25 acceptable when library <40 (Phase 0b shipped 30)"                                  | LOW      | F-05          |
| act-006 | plan.md + tasks.md affected_contracts | Add "AnalyzePerception.inferredPageType (read-through accessor)" 6th entry to plan.md L43 + tasks.md L40 + R18 delta block        | LOW      | F-08          |
| act-007 | spec.md regulated verticals enumeration | Acknowledge SPEC_GAP from completeness audit + add explicit deferred-cases footnote (critic-extended set)                       | MED      | completeness  |

**Non-blocking (log only):** F-06 (migration filename placeholder — correct authoring pattern), F-07 (delta.new narrative shorthand).

Master orchestrator decides at Gate 1 stamp whether to dispatch the patch wave in this session or defer to next.

---

## R20 cross-phase trigger

F-01 is the R20 trigger (impact.md missing `consumes_from:` for Phase 4 contracts). Resolving act-001 closes the R20 invalidation referenced in `r20-invalidation-from-phase-4.md` §Required actions before Gate 1 item 5.

No new cross-phase invalidation propagation needed — the patch wave is contained within Phase 4b's own artifacts.

---

## Pass 1 cost (approx)

- Read budget: ~25K tokens (spec + plan + tasks + impact + checklists + R20 note + Phase 4 rollup snippets + AI Reviewer SKILL.md + 3 reference files + constitution R25)
- Write budget: ~3K tokens (correctness JSON + this summary)
- Wall clock so far: ~30 min including artifact reads + analyze authoring
