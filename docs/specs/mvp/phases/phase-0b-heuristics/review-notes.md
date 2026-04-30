---
title: Phase 0b Engineering Lead Review Notes
artifact_type: review-notes
status: complete
version: 1.0
phase_number: 0b
phase_name: heuristics
reviewed_at: 2026-04-30
reviewer: Sabari (engineering lead, solo)
template_used: docs/specs/mvp/templates/phase-review-prompt.md v1.0
analyze_pass_reference: 2026-04-30 session — /speckit.analyze run; M1+M2+M3+M4+L1-L5 findings remediated; spec.md/plan.md/tasks.md/impact.md/README.md at v0.2 post-fix; phase-6/tasks.md at v0.3 (cross-phase L5)

recommendation: APPROVE (with one polish condition — D1 — captured below)

artifacts_reviewed:
  - phase-0b-heuristics/README.md (v0.2)
  - phase-0b-heuristics/spec.md (v0.2 post-analyze)
  - phase-0b-heuristics/plan.md (v0.2 post-analyze)
  - phase-0b-heuristics/tasks.md (v0.2 post-analyze)
  - phase-0b-heuristics/impact.md (v0.2 post-analyze)
  - phase-0b-heuristics/checklists/requirements.md

constitution_version_validated: docs/specs/mvp/constitution.md R1-R26
---

# Phase 0b (Heuristic Authoring — LLM-Assisted, Engineering-Owned) — Engineering Lead Review Notes

> **One-line verdict:** APPROVE — design is sound; analyze findings remediated; all 5 R6 channels covered for drafting subprocess; one polish-grade doom-check finding (D1, MEDIUM-LOW) deferred to T0B-004 implementation phase.

---

## 1. Phase scope

| Field | Value |
|---|---|
| Phase folder | `docs/specs/mvp/phases/phase-0b-heuristics/` |
| Risk level | LOW (per impact.md §11 — content authoring; no new contracts produced) |
| Highest-risk surface | R6 / R15.3.3 IP boundary on the drafting subprocess (LLM-drafted heuristic content must NOT touch LangSmith / Pino / dashboard / API) |
| First-runtime constitutional activations | None — R6 first runtime fires later in Phase 6 (HeuristicLoader); R15.3.x are first AUTHORING-time activations here, not runtime |
| Phase precedes | Phase 6 (consumes 30-heuristic content via `HeuristicLoader.loadAll()`); Phase 7 EvaluateNode (consumes via `loadForContext()` filter) |
| Phase follows | Phase 0 (T001-T005 setup); requires T101 (Phase 6 schema) + T4B-013 (Phase 4b context filter contract) |
| Estimated effort | ~26h engineering + ~7h verifier across 4 weeks (per plan.md §9 — runs in parallel with Phases 1-3) |

---

## 2. Step 1 — Read-order findings

Findings caught during README → spec → impact → plan → tasks read pass.

| ID | Severity | Location | Finding | Recommended action |
|----|----------|----------|---------|--------------------|
| R1 | LOW (informational) | plan.md §1 sequencing | Week labels (Week 1 / Week 2 / etc.) are calendar-time anchors, not phase-order anchors. Phase 0b runs in parallel with Phases 1-3 per impact.md, so "Week 1" is relative to Phase 0b start, not project start. Could confuse a reader assuming sequential order. | Already implicit in "runs in parallel with Phase 1-3 implementation" (plan.md §9). No fix needed; flagged for clarity. |

**Read-order verdict:** Artifacts read coherently in canonical order. README sets clear goal; spec elaborates; impact captures cross-cutting effects; plan sequences; tasks decompose. Single LOW informational finding above.

---

## 3. Step 2 — Per-artifact judgment findings

### README.md

- ✅ Goal statement matches stakeholder intent: "Author the 30-heuristic MVP knowledge base via LLM-assisted drafting + mandatory human verification (per PRD F-012 v1.2 amendment)."
- ✅ Exit criteria specific: 7 checks (lint pass, spot-checks, R6/R15.3.3 conformance, Phase 6 T112 cross-phase). Unambiguously verifiable.
- ✅ Depends-on / blocks list matches INDEX.md: depends on Phase 0 + T101 + T4B-013; blocks Phase 6 + Phase 7 EvaluateNode.
- ✅ Effort estimate post-L1-fix matches plan.md §9 (~26h + 7h).

**No judgment findings on README.**

### spec.md

- ✅ User stories framed around real outcomes (engineer drafts heuristic; spot-check verifier; Phase 6 loader as consumer). All P1.
- ✅ Acceptance criteria objectively verifiable. AC-01 (post-L4 fix) now points to canonical fixture excerpts in `examples.md §10`.
- ✅ Out-of-scope list is comprehensive (7 explicit non-goals tied to PRD §3.2).
- 🟡 Constitution Alignment Check — adversarial reading: 5 of 15 ACs (AC-01/02/03/05/12) are manual-review-only. This is *acceptable* for documentation/protocol artifacts and matches Phase 0 patterns, but the manual-review path means those ACs aren't gated by CI — they rely on PR reviewer discipline. Not a finding (acceptable practice), but worth noting.
- ✅ Every R-NN has a measurable acceptance scenario or cites where measurement happens.

**No HIGH or MEDIUM findings on spec.md.** All M1-M4 + L2 + L4 from analyze remediation landed cleanly.

### impact.md

- ✅ All 11 consumers identified in §3 (Phase 6 loader, Phase 4b loadForContext, Phase 7 EvaluateNode/SelfCritiqueNode/EvidenceGrounder, Phase 8 AuditSetupNode/PageRouterNode, PR review human, spec authoring sessions, .gitignore, tasks-v2.md).
- ✅ Migration plan in §1-§3 is concrete (named consumers, named contracts, named files).
- ✅ Risk register §9 is honest — includes "Verifier rubber-stamps without re-deriving benchmark" (R15.3.2 violation) and "R6 leak via accidental console.log" (R6 violation). Not sanitized.
- ✅ R20.4 N/A — `breaking: false`; no engineering-lead-pre-implementation gate required beyond this review.

**No findings on impact.md.**

### plan.md

- ✅ Sequencing makes sense: Week 1 infra (T0B-001..005) → Week 2 Baymard → Week 3 Nielsen → Week 4 Cialdini. Smaller packs follow Baymard, which exercises the workflow first.
- ✅ Effort estimate based on concrete numbers (per-heuristic time × pack size). Not aspirational.
- ✅ Tech stack respects architecture.md §6.4 — Anthropic SDK + Zod + Pino, no alternatives proposed.
- ✅ R3 TDD ordering preserved (T0B-004 conformance test referenced in same task).

**No findings on plan.md** beyond the R1 informational note above.

### tasks.md

- ✅ Every task has a clear acceptance criterion with conformance-test path or manual-review note.
- ✅ File paths are architecture.md §6.5 compliant.
- ✅ Dependencies sensible: T0B-001..005 → T101 (cross-phase Phase 6) → T103-T105.
- ✅ Kill criteria default block applies; per-task extensions are appropriate for content-authoring phase.
- ✅ M2 cascade (T0B-004 acceptance referencing 5-channel R6 conformance test) landed correctly.

**No findings on tasks.md.**

### checklists/requirements.md

- ✅ All 11 spec quality checks pass on first review.
- ✅ Constitution alignment cross-check matches spec.md Constitution Alignment block.

**No findings.**

---

## 4. Step 3 — Doom check ★

**Highest-risk surface chosen:** R6 / R15.3.3 IP boundary on the drafting subprocess.

**Doom-check question asked:** *"If a contractor joined the team next week and ran the drafting workflow blindly, where would heuristic content leak to LangSmith / Pino / dashboard / API / external observability?"*

### Walk-through (adversarial flow)

1. **Contractor reads `heuristics-repo/README.md` (T0B-005).** They see the workflow: draft → verify → lint → PR. They open `docs/specs/mvp/templates/heuristic-drafting-prompt.md` (T0B-001).
2. **Contractor invokes the drafting subprocess** (e.g., `pnpm draft:heuristic`). Per spec.md Assumptions (post-M3), this script uses `@anthropic-ai/sdk` directly (NOT via agent-core's LLMAdapter). Per plan.md §6, no LangSmith env vars; no Pino logger.
3. **LLM response written to `.heuristic-drafts/<id>.json`** — gitignored per AC-13.(a).
4. **Contractor moves the file to `heuristics-repo/<source>/<id>.json`** for verification.
5. **Contractor runs `pnpm heuristic:lint <file>`** (T0B-004 — apps/cli command).
6. **Lint CLI loads + Zod-parses the JSON.** On failure, emits error message via `process.stdout.write` or `process.stderr.write`.
7. **Contractor reviews lint output**, fixes errors, re-runs.
8. **Once lint passes**, contractor commits the JSON + opens PR with Proof block.

### Adversarial scenarios examined

| Scenario | Existing rails coverage | Verdict |
|---|---|---|
| Contractor has `LANGSMITH_API_KEY` set in shell env globally | `@anthropic-ai/sdk` does NOT auto-trace to LangSmith (no automatic integration); LangSmith only fires via explicit `traceable` decorators or `@langchain/langgraph` imports — both forbidden by AC-13.(b) and (c). | ✅ Covered |
| Contractor copies LLM draft response into Slack to ask a colleague | No code-level rail catches this; T0B-005 README forbids it as workflow rule but relies on contractor reading README. | 🟡 D2 below — soft / human-protocol-only |
| Contractor force-commits `.heuristic-drafts/` via `git add -f` | AC-13.(a) checks gitignore but doesn't prevent force-add. Pre-commit hook would catch but isn't specified. | 🟡 D3 below — soft / minor |
| Lint CLI Zod error includes failed field VALUE in message | Plan.md §5 pseudocode `logError(file, parsed.error)` — Zod errors typically include `received: <value>` showing actual data. Lint CLI's process.stdout/stderr output could leak heuristic body content during error reporting. AC-13 covers drafting subprocess only, not lint CLI error path. | ⚠️ **D1 below — MEDIUM (real R6 channel gap)** |
| Drafting subprocess imports `@neural/agent-core/observability/*` | AC-13.(c) explicitly catches this via grep on import graph. | ✅ Covered |
| Drafting subprocess script imported into runtime modules | AC-13.(d) catches this. | ✅ Covered |
| Dashboard renders drafting transcripts | AC-13.(e) catches paths reference; dashboard doesn't read `.heuristic-drafts/`. | ✅ Covered |
| Verifier copies `citation_text` into LangSmith for unrelated debugging | Out of Phase 0b scope — not Phase 0b's responsibility |  Out of scope |

### Doom-check findings (failure paths existing rails miss)

| ID | Severity | Failure path | Why existing rails miss it | Recommended mitigation |
|----|----------|--------------|----------------------------|------------------------|
| **D1** | **MEDIUM** | Lint CLI (T0B-004) emits Zod parse error messages via stdout/stderr that include the failed heuristic field's VALUE (e.g., `recommendation.summary: "..."` body content). If terminal output is screen-recorded, piped to a log file, or shared in support tickets, heuristic body leaks outside the IP-protected channel. | AC-13.(a)-(e) covers drafting subprocess paths only. Lint CLI is in `apps/cli/` runtime path; its error-message output isn't redacted. Plan.md §5 pseudocode shows `logError(file, parsed.error)` without redaction. | T0B-004 implementer (a) wraps Zod errors before printing to strip `received: <value>` content; (b) emits error format `<file>: <field-path> — <error_class>` only (no JSON values); (c) adds conformance-test assertion: lint CLI error output never matches the heuristic's body content via grep. Update AC-13 to add 6th channel: "(f) lint CLI error messages do NOT contain heuristic field VALUES from failed JSON inputs". |
| **D2** | LOW (human-protocol; no code mitigation) | Contractor copy-pastes LLM draft response into Slack/email/chat to ask colleague for opinion. Heuristic content leaks via human channel. | No code-level rail. T0B-005 README (workflow doc) is the only mitigation. | No additional mitigation recommended for MVP — accept human-protocol risk. T0B-005 README should explicitly call out: "Drafting LLM responses MUST NOT be shared outside `.heuristic-drafts/` — no Slack, no email, no screenshots." Document and move on. |
| **D3** | LOW (force-add bypass) | Contractor uses `git add -f .heuristic-drafts/` and commits drafting transcripts to history. AC-13.(a) gitignore check is satisfied (gitignore exists) but force-add bypasses it. | Pre-commit hook would catch; AC-13 doesn't specify one. | Add a minimal pre-commit hook (or husky/simple-git-hooks config) at T0B-005 time that rejects commits matching `^.heuristic-drafts/`. Optional polish; not blocking. |

**Doom check verdict:** R6 IP boundary is mostly well-covered by AC-13's 5-channel test (post-M2 fix). One real channel gap (D1 — lint CLI error messages) requires attention during T0B-004 implementation. Two soft / human-protocol findings (D2, D3) are acceptable for MVP scope.

---

## 5. Step 4 — Kill criteria validation

For each kill criterion in plan.md §7, validate it's REAL (concrete trigger + concrete action + realistic threshold) vs DECORATIVE (vague or absent action).

| Trigger | Source (plan.md §7) | Concrete action defined? | Realistic threshold? | Verdict |
|---|---|---|---|---|
| Cumulative drafting cost > $25 | row 1 | ✅ STOP. Audit drafting prompt for token bloat. ELR review before resume. | ✅ ($15 NF-01 target × 1.67) | **REAL** |
| Per-heuristic time p50 > 90 min after smoothing first 5 | row 2 | ✅ STOP. Workflow protocol review. Likely verification protocol too rigid; adjust. | ✅ (45 min NF-02 target × 2) | **REAL** |
| Same heuristic re-drafted 3+ times | row 3 | ✅ STOP. ELR reviews `.heuristic-drafts/<id>.log` series. | ✅ (3 strikes is industry standard) | **REAL** |
| Spot-check divergence rate > 20% | row 4 | ✅ STOP. Reject batch since last good spot-check. Workflow protocol review. | ✅ (F-012 absolute requirement) | **REAL** |
| Lint failure rate > 0% AFTER human verification | row 5 | ✅ STOP. Verifier protocol failure — re-train verifier; re-verify their heuristics. | ✅ (zero tolerance — verification is the gate) | **REAL** |
| Engineer skips verification ("this one is obviously right") | row 6 | ✅ STOP. R15.3.2 non-negotiable. ESCALATE to engineering lead. | ✅ (binary trigger) | **REAL** |
| R6 boundary breach (drafting LLM response → LangSmith / Pino / dashboard) | row 7 | ✅ STOP. Constitutional violation. Audit subprocess wiring; reject all heuristics drafted in that session. | ✅ (R6 is a hard rule) | **REAL** |

**Kill criteria verdict:** All 7 triggers are REAL. Each has a concrete trigger, a concrete action, a realistic threshold, and preserves R23.4 (no `--no-verify`, no silent retry). No decorative criteria. ✅

---

## 6. Step 5 — Recommendation

### Recommendation: **APPROVE** (with one polish condition)

### Rationale

Phase 0b is in good design shape. The /speckit.analyze pass cleared cleanly after M1-M4 + L1-L5 remediation. Doom check found one real R6 channel gap (D1 — lint CLI error message redaction) which is fixable in T0B-004 implementation, not a spec defect. Kill criteria are all REAL. Constitution alignment is solid (one R10 + one R9 deviation, both justified inline). The drafting subprocess R9 exemption is now formally documented per R22.2 ratchet pattern (M3 fix mirrors Phase 0's `scripts/db-migrate-stub.mjs` exemption). Phase 0b is unambiguously ready for implementation.

The single MEDIUM finding (D1) does not justify REVISE because:
- It's an implementation-time concern (T0B-004 lint CLI behavior), not a spec error
- The fix is small (~3-5 lines in lint CLI + 1 line in conformance test)
- Phase 0b can proceed; the condition lands during T0B-004 implementation alongside the rest of the lint CLI

### Conditions on approval

| ID | Condition | Owner | When |
|---|---|---|---|
| D1 | T0B-004 implementer adds Zod-error-redaction to lint CLI: emit `<file>: <field-path> — <error_class>` only; never include heuristic field VALUES in stdout/stderr output. Update AC-13 to add 6th channel: "(f) lint CLI error messages do NOT contain heuristic field VALUES from failed JSON inputs". Update T0B-004 conformance test (`apps/cli/tests/conformance/heuristic-lint.test.ts`) to assert: when given a malformed heuristic JSON containing identifiable string `"NEURAL_TEST_FIXTURE_BODY"` in any field, the lint CLI's stdout+stderr combined output does NOT contain `"NEURAL_TEST_FIXTURE_BODY"`. | T0B-004 implementer | During T0B-004 implementation (Week 1 of Phase 0b) |
| D2 | T0B-005 README explicitly documents human-protocol R6 boundary: "Drafting LLM responses MUST NOT be shared outside `.heuristic-drafts/` — no Slack, no email, no screenshots, no support tickets." | T0B-005 author | During T0B-005 implementation (Week 1) |
| D3 (optional polish) | Add pre-commit hook rejecting commits that match `^\.heuristic-drafts/`. | T0B-005 author | During T0B-005 implementation OR deferred to v1.0.1 polish |

D1 is binding (R6 boundary). D2 is workflow doc. D3 is optional.

### What user does next

1. **Bump `status: draft → approved`** on:
   - `phase-0b-heuristics/spec.md`
   - `phase-0b-heuristics/plan.md`
   - `phase-0b-heuristics/tasks.md`
   - `phase-0b-heuristics/impact.md`
2. **Update version + delta block** on each (v0.2 → v0.3) with delta entry: `v0.2 → v0.3 — status bumped draft → approved (R17.4 review approved per phase-0b-heuristics/review-notes.md); 3 polish conditions captured (D1 binding for T0B-004; D2 binding for T0B-005; D3 optional).`
3. **Update updated date** to 2026-04-30 on each.
4. **Commit** with message including: `(R17.4 review approved per phase-0b-heuristics/review-notes.md)`.
5. **README.md** stays at v0.2 (already at correct state — no further bump needed since README doesn't gate on approved).
6. **Phase 0b implementation** can begin — week 1 starts with T0B-001 (drafting prompt template) + T0B-002 (verification protocol). T0B-004 implementer must capture D1 condition during their work.

### What does NOT happen

- INDEX.md row stays at ⚪ "not started" — Phase 0b implementation hasn't begun yet (`approved` ≠ `implemented`). INDEX.md flips to 🟡 when first task lands per CLAUDE.md §8c.
- T103-T105 cannot start until T101 (Phase 6 schema) lands. Phase 0b infrastructure (T0B-001..005) can run in parallel with other phases.

---

## 7. Sign-off

| Field | Value |
|---|---|
| Reviewer name | Sabari (engineering lead, solo MVP team) |
| Reviewed on | 2026-04-30 |
| Reviewer role | engineering lead |
| Time spent | ~25 min (LOW-risk phase per impact.md §11; doom check focused on R6/R15.3.3 surface) |
| Recommendation | **APPROVE** with 3 conditions (D1 binding, D2 binding, D3 optional) |
| Constitutional rules verified | R1-R26 with attention to: **R6** (IP — focal in this phase), **R15.3 + R15.3.1 + R15.3.2 + R15.3.3** (benchmark + provenance + verification + drafting IP), **R20** (impact.md complete; LOW risk), **R22.2** (R9 exemption provenance documented post-M3), **R23** (kill criteria validated as REAL — Step 4) |
| Status transition authorized | YES, draft → approved (post-condition: D1 captured for T0B-004; D2 captured for T0B-005) |
| Reviewer signature | Reviewed independently of authoring (analyze pass + remediation occurred earlier in same 2026-04-30 session; review pass ran fresh against post-fix artifacts). Doom check ran with adversarial framing on R6/R15.3.3 surface. Findings recorded honestly — D1 is a real polish-grade R6 channel gap, not glossed. APPROVE recommendation justified by phase risk profile (LOW per impact.md) + small magnitude of D1 fix (implementation-time, not spec-error). |

---

## Cross-references

- [phase-review-prompt.md](../../templates/phase-review-prompt.md) v1.0 — the template that generated this report
- [phase-review-report.template.md](../../templates/phase-review-report.template.md) v1.0 — output schema this report follows
- [`/speckit.analyze`](../../../../.claude/skills/speckit-analyze/) — mechanical consistency pass that preceded this review (2026-04-30; M1-M4 + L1-L5 findings; remediated before review ran)
- [Constitution R17.4](../../constitution.md) — lifecycle gate this review supports (`validated → approved`)
- [Constitution R22.2](../../constitution.md) — Ratchet provenance requirement (R9 drafting exemption now documented per pattern)
- [CLAUDE.md §8c](../../../../CLAUDE.md) — phase artifact maintenance (per task + per phase + before phase implementation)
- [CLAUDE.md §8d](../../../../CLAUDE.md) — phase review invocation (this template)
- [`phase-0b-current.md` rollup](phase-0b-current.md) — to be authored at phase exit (R19); will reference this review in its "review history" section
- Cross-phase artifact: [`phase-6-heuristics/tasks.md`](../phase-6-heuristics/tasks.md) v0.3 — carries the L5 cross-reference note added during Phase 0b analyze remediation
