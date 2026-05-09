---
title: Phase 0b Rollup — Current System State
artifact_type: rollup
status: implemented       # immediately implemented at phase exit; → verified when Phase 6 T112 cross-phase integration test passes against the full 30-pack
version: 1.0
phase_number: 0b
phase_name: Heuristic Authoring (LLM-Assisted, Engineering-Owned)
phase_completed_on: 2026-05-09
created: 2026-05-09
updated: 2026-05-09
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []
supersedes: null
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-0b-heuristics/spec.md v0.8
  - docs/specs/mvp/phases/phase-0b-heuristics/plan.md v0.8
  - docs/specs/mvp/phases/phase-0b-heuristics/tasks.md v0.8
  - docs/specs/mvp/phases/phase-0b-heuristics/impact.md v0.6
  - heuristics-repo/_spot-checks.md (3 rounds × 5 = 15/30 Tier 2 PASS)
req_ids: [REQ-HK-001, REQ-HK-EXT-001, REQ-HK-EXT-019, REQ-HK-BENCHMARK-001, REQ-CONTEXT-DOWNSTREAM-001]
delta:
  new:
    - 30-heuristic MVP knowledge base produced via v0.7 tiered-verification pipeline
    - neural-heuristic-reviewer skill operationalized + exercised across 30 reviews
    - HeuristicSchemaExtended.ai_review optional field activated (additive; non-breaking)
    - .heuristic-drafts/ gitignored draft transcripts + .review.json files (R6 + R15.3.3 isolation working in production)
    - heuristics-repo/_spot-checks.md as Tier 2 strict R15.3.2 audit trail
  changed:
    - Phase 0b artifacts bumped status:approved → status:implemented per R17 + AC-12 final
  impacted:
    - Phase 6 implementation unblocked — T112 integration test has the 30-heuristic fixture
    - Phase 4b T4B-013 loadForContext(profile) unblocked — manifest selectors populated on all 30
    - Phase 7 EvaluateNode unblocked — heuristic content available via HeuristicLoader.loadForContext()
  unchanged:
    - Constitution R15.3.2 wording (interpretive elaboration in spec.md v0.7 §Verification Methodology, not constitutional amendment)
governing_rules:
  - Constitution R19 (Rollup per Phase)
  - Constitution R17 (Lifecycle States — approved → implemented)
  - Constitution R15.3 + R15.3.1 + R15.3.2 + R15.3.3 (benchmark + provenance + verification + IP)
  - Constitution R6 (IP — heuristic body never logged)
---

# Phase 0b — Heuristic Authoring — Current System State Rollup

> **Summary (~200 tokens):** 30/30 MVP heuristics committed (15 Baymard + 10 Nielsen + 5 Cialdini) per F-012 v1.2 amendment scope. Drafted via v0.7 tiered-verification pipeline: drafter subagent (Sonnet) → `neural-heuristic-reviewer` skill (top-1% senior CRO consultant persona; 6-dimension review protocol) → human gate stamps → lint → commit. AC-12 spot-check 3-round 15-of-30 sample = 50% Tier 2 strict R15.3.2 manual re-derivation coverage; 15/15 PASS; 0 divergence; 0 kill criteria triggers. R6 IP boundary preserved — drafter/reviewer outputs in `.heuristic-drafts/` (gitignored); committed JSONs in private repo. AC-14 (cross-phase Phase 6 T112) pending Phase 6 implementation. Phase 0b transitions to status:verified when Phase 6 ships.

> **Governed by:** Constitution R19. Rollup size cap: 300 lines / ~3000 tokens.

---

## 1. Active modules introduced this phase

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `heuristic-drafting-prompt.md` | `docs/specs/mvp/templates/heuristic-drafting-prompt.md` | T0B-001 input contract for drafter subagent; v0.4 body-string design per T101 | manual review (T0B-001) |
| `heuristic-verification-protocol.md` | `docs/specs/mvp/templates/heuristic-verification-protocol.md` | T0B-002 8-step Tier 2 strict R15.3.2 spot-check protocol | manual review |
| `heuristic-pr-proof.md` | `docs/specs/mvp/templates/heuristic-pr-proof.md` | T0B-003 PR Contract per-heuristic Proof block extension to PRD §10.9 | manual review |
| `heuristic-lint` CLI | `apps/cli/src/commands/heuristic-lint.ts` | T0B-004 Zod parse + 5-check enforcement (provenance + benchmark + manifest + banned-phrase + ai_review optional) | `apps/cli/tests/conformance/heuristic-lint.test.ts` (18 tests pass) |
| `heuristics-repo/README.md` | `heuristics-repo/README.md` | T0B-005 4-step authoring workflow + R6 forbidden-channel guard | manual review |
| `heuristics-repo/{baymard,nielsen,cialdini}/*.json` | `heuristics-repo/` | 30 heuristic content files (15+10+5); 4-5KB each | lint + 3-round spot-check |
| `heuristics-repo/_spot-checks.md` | `heuristics-repo/_spot-checks.md` | Tier 2 audit trail — 3 rounds × 5 = 15-of-30 strict R15.3.2 PASS log | self-documenting |
| `neural-heuristic-reviewer` skill | `.claude/skills/neural-heuristic-reviewer/SKILL.md` | Top-1% senior-CRO-consultant 6-dim review skill (Stage 2b) | exercised on 30 reviews; 0 FLAG_FOR_HUMAN; 0 REJECT_REDRAFT |
| `HeuristicSchemaExtended.ai_review` | `packages/agent-core/src/analysis/heuristics/types.ts` | Optional v0.7 schema field — embeds AI senior-consultant review block per heuristic | typecheck pass; 18 conformance tests still pass |
| Master orchestrator content-phase state machine | `.claude/skills/neural-master-orchestrator/references/content-phase-state-machine.md` | Stage 2 sub-states (2a-2e) for content-authoring phases (Phase 0b template; v1.1+ heuristic packs reuse) | self-documenting |

---

## 2. Data contracts now in effect

| Contract | Surface | Producer | Consumer |
|---|---|---|---|
| `HeuristicSchemaExtended` v0.7 (with optional `ai_review`) | `packages/agent-core/src/analysis/heuristics/types.ts` | T101 (Phase 6 forward-pulled to week 1) + Phase 0b v0.7 amendment | Phase 6 `HeuristicLoader.loadAll()` (week 4); Phase 4b `loadForContext(profile)`; Phase 7 EvaluateNode |
| `heuristics-repo/{baymard,nielsen,cialdini}/*.json` | filesystem | Phase 0b T103/T104/T105 (this phase) | Phase 6 loader; Phase 4b filter; Phase 7 evaluate |
| `_spot-checks.md` audit trail | `heuristics-repo/_spot-checks.md` | Phase 0b verifier (Sabari, FLAG-protocol; re-verifier by 2026-05-16) | R15.3.2 audit trail; Phase 6 T112 integration may reference |
| PR Contract Proof block | `docs/specs/mvp/templates/heuristic-pr-proof.md` | T0B-003 (committed) | Future heuristic-PR reviewers; PRD §10.9 cross-link |

---

## 3. System flows now operational

### Flow: heuristic authoring (v0.7 pipeline)

**Trigger:** master orchestrator dispatches Stage 2a drafter subagent for a pack
**Steps:** drafter writes draft to `.heuristic-drafts/<id>.json` (gitignored; verified_by/verified_date empty per design) → `neural-heuristic-reviewer` skill emits 6-dim `ai_review` block per draft → human gate stamps APPROVE/FLAG/REJECT → master fills verified_by/verified_date + embeds ai_review + lint passes + commits to `heuristics-repo/<pack>/<id>.json`
**Output:** committed JSON with full v0.7 schema (including ai_review) in private heuristics-repo
**Spec:** spec.md v0.7 §Verification Methodology Tier 1; R15.3.2 enforcement seam (empty verified_by → Zod .min(1) reject) confirmed working

### Flow: AC-12 Tier 2 spot-check

**Trigger:** at +10/+20/+30 heuristic-commit marks
**Steps:** master selects 5 random across all committed heuristics → user opens source_url + Ctrl+F citation_text + re-derives benchmark within ±20% (or paraphrase fidelity for qualitative) + scans body for banned phrases + sanity-checks manifest selectors → logs PASS/DIVERGE per heuristic in `_spot-checks.md`
**Output:** 3 rounds × 5 = 15 strict-verified entries with verifier name + timestamp + per-step outcomes
**Spec:** AC-12 + spec.md v0.7 §Verification Methodology Tier 2; v0.6 solo-verifier `<24hr-FLAGGED` protocol applied (re-verification by 2026-05-16)

### Flow: lint enforcement seam

**Trigger:** `pnpm heuristic:lint <file>` per heuristic OR pre-commit
**Steps:** Zod parse against HeuristicSchemaExtended → empty verified_by/verified_date fail Zod .min(1) (intentional drafting-stage block) → after human stamp, both populated → 5-check pass (provenance / benchmark / manifest / banned-phrase / schema)
**Output:** exit 0 (clean) or exit non-zero with field-path error (R6: never quotes body content in error messages — D1 BINDING from Session 6 review-notes.md SATISFIED)
**Spec:** AC-04 + AC-13 + T0B-004; D1 sentinel `NEURAL_TEST_FIXTURE_BODY` confirmed via `apps/cli/tests/conformance/heuristic-lint.test.ts` (18 tests)

---

## 4. Known limitations carried forward

| Limitation | Phase to resolve | Workaround in place |
|---|---|---|
| `<24hr-FLAGGED` re-verification of all 3 spot-check rounds pending by 2026-05-16 | post-Phase-0b cleanup (different engineer or self with ≥24hr defer) | Phase 0b is at status:implemented but NOT status:verified; transition to verified happens after re-verification + Phase 6 T112 cross-phase test |
| AC-14 cross-phase Phase 6 T112 integration test pending Phase 6 implementation | Phase 6 (week 4 per roadmap) | 30 heuristics produced + lint-validated; Phase 6 T112 will exercise full 30-pack against `HeuristicLoader.loadAll()` |
| 2 of 5 Cialdinis (RECIPROCITY-001 + LIKING-001) not in Tier 2 spot-check sample | post-FLAG re-verification cycle | Tier 1 AI review covered both; cumulative Tier 2 spot-check covered 3 of 5 Cialdinis (60% pack sample); re-verification of remaining 2 captured in `_spot-checks.md` re-verification log |
| 4 deferred-pack sources not enumerated in spec (WCAG 2.1 AA, GDPR-UX, HEART, etc.) | v1.1+ scope expansion | Documented in spec.md v0.6 "Out of Scope" with staged rollout rationale |
| PLP page_type heuristics deferred (0 in MVP-30 distribution) | v1.1+ Baymard 2025 catalog refresh | Spec.md v0.6 "Out of Scope" 3-point rationale (catalog maturity + dedup risk + leverage) |

---

## 5. Open risks for next phase

| Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| Re-verification by 2026-05-16 may find DIVERGE on 1-2 heuristics | LOW (per `_spot-checks.md` design — DIVERGE triggers heuristic rejection + redraft, not pack rejection) | re-verifier | If diverge: re-draft + re-spot-check the affected heuristic(s); Phase 0b stays at status:implemented; Phase 6 T112 will catch lint failures on any malformed heuristic |
| Phase 6 T112 integration test fails on 1+ heuristics (cross-phase contract drift) | MEDIUM | Phase 6 implementer | Phase 6 ships with HeuristicLoader.safeParse() per T101 design — single heuristic failure does NOT invalidate full pack; re-author affected heuristic |
| Phase 4b T4B-013 contract drift (manifest-selector enum changes) | LOW | Phase 4b implementer (week 6) | T101 currently uses PRELIMINARY enums; canonical enum migration when Phase 4b T4B-001 ratifies; backward-compatible enum extension expected |
| AI-reviewer-and-drafter shared blind spot on hallucinated benchmarks | LOW (Tier 2 spot-check on 50% sample is the residual safety net) | future re-reviewer | Already mitigated structurally — 15-of-30 Tier 2 strict pass; residual risk on the remaining 15 covered by re-verification cycle |

---

## 6. Conformance gate status

| Test | Status | Last run |
|---|---|---|
| `pnpm heuristic:lint heuristics-repo/baymard/*.json` (15 files) | ✅ 15/15 PASS | 2026-05-09 |
| `pnpm heuristic:lint heuristics-repo/nielsen/*.json` (10 files) | ✅ 10/10 PASS | 2026-05-09 |
| `pnpm heuristic:lint heuristics-repo/cialdini/*.json` (5 files) | ✅ 5/5 PASS | 2026-05-09 |
| `pnpm -F @neural/cli test` (T0B-004 conformance — AC-04 + AC-13) | ✅ 18/18 PASS | 2026-05-09 |
| AC-12 round 1 (5 random of 15 Baymards strict R15.3.2) | ✅ 5/5 PASS | 2026-05-09 (FLAGGED) |
| AC-12 round 2 (5 random of 25; cross-pack mix) | ✅ 5/5 PASS | 2026-05-09 (FLAGGED) |
| AC-12 round 3 (5 random of 30; final mix incl. 3 Cialdinis) | ✅ 5/5 PASS | 2026-05-09 (FLAGGED) |
| AC-14 cross-phase Phase 6 T112 integration | ⏳ pending Phase 6 implementation (week 4) | — |

---

## 7. What Phase 6 should read

When Phase 6 starts, the recommended reading order is:

1. **This file** (`phase-0b-current.md`) — YOU ARE HERE — compressed Phase 0b state
2. `docs/specs/mvp/phases/phase-6-heuristics/README.md` — Phase 6 summary + exit criteria
3. `docs/specs/mvp/phases/phase-6-heuristics/spec.md` — Phase 6 spec (HeuristicLoader contract; T112 integration test for AC-11/AC-14)
4. `docs/specs/mvp/phases/phase-6-heuristics/tasks.md` — T106-T112 task definitions
5. `packages/agent-core/src/analysis/heuristics/types.ts` — T101 v0.7 schema (with optional `ai_review`)
6. `heuristics-repo/baymard/BAYMARD-CHECKOUT-001.json` (or any one) — committed v0.7 reference example

For BINDING conditions from Phase 0b's R17.4 review (Session 6): see `docs/specs/mvp/phases/phase-0b-heuristics/review-notes.md` — D1 (T0B-004 Zod-error redaction; SATISFIED) + D2 (T0B-005 R6 forbidden-channel doc; SATISFIED) + D3 (pre-commit hook; deferred to v1.0.1).

Do NOT load all Phase 0b artifacts. The compression is intentional.

---

## 8. Cost + time summary (this phase)

| Metric | Target (per spec NF-01/NF-02 + plan.md §9) | Actual |
|---|---|---|
| LLM drafting cost (drafter + reviewer) | ≤$15 (NF-01); kill at >$25 | ~$1.80 (drafter ~$0.90 across 30 + reviewer $0 since parent-context AI review for smoke + scale) |
| Per-heuristic engineering time p50 | ≤45 min combined draft+verify (NF-02); kill at >90 min | ~5-8 min per heuristic (drafter wallclock ~30 min for 30 heuristics + ~30 min user gate stamps + ~2 hr spot-check across 3 rounds) |
| Engineering hours total | ~26h per plan.md §9 | ~3 hr (single-day execution; v0.7 tiered pipeline highly compressed cycle) |
| Verifier hours total | ~7h per plan.md §9 | ~1.5 hr Tier 1 stamps + ~1.5-2 hr Tier 2 spot-check = ~3-3.5 hr (significantly under budget; v0.7 efficiency dividend) |
| AC-12 spot-check divergence rate | ≤20% per round | 0% across 3 rounds × 5 = 0/15 |
| Phase 0b spec/plan/tasks/impact version bumps | minimal | 0.5 → 0.6 (REVISE-loop) → 0.7 (v0.7 methodology) → 0.8 (Stage 4 exit) |
| Branch commits | ~15-20 estimated | 14 commits on `feat/phase-0b-content` since branch-cut |
| Calendar duration | ~4 weeks alongside Phase 1-3 | ~6 hours (single-day; v0.7 pipeline collapsed calendar significantly) |

---

## Cross-references

- Phase 0b spec: `docs/specs/mvp/phases/phase-0b-heuristics/spec.md` v0.8 (status:implemented)
- Phase 0b plan: `docs/specs/mvp/phases/phase-0b-heuristics/plan.md` v0.8
- Phase 0b tasks: `docs/specs/mvp/phases/phase-0b-heuristics/tasks.md` v0.8 (T103/T104/T105 ✅ DONE 2026-05-09)
- Phase 0b impact: `docs/specs/mvp/phases/phase-0b-heuristics/impact.md` v0.6
- Phase 0b README: `docs/specs/mvp/phases/phase-0b-heuristics/README.md` v0.2
- Phase 0b R17.4 review: `phase-0b-heuristics/review-notes.md` v1.0 (Session 6)
- Spot-check audit trail: `heuristics-repo/_spot-checks.md` (3 rounds × 5 PASS)
- v0.7 pipeline build commit: `8e90389` (skill + schema + spec § + state machine)
- T103/T104/T105 commits: `8d47737` (smoke 3) + `b5cb42e` (Wave 2 12) + `7387930` (Nielsen 10) + `47fd4bd` (Cialdini 5)
- Phase 0 predecessor rollup: `docs/specs/mvp/phases/phase-0-setup/phase-0-current.md` (companion R19 doc; first phase rollup)
- Phase 1 predecessor rollup: `docs/specs/mvp/phases/phase-1-perception/phase-1-current.md` (R19 sibling; prior implemented phase)
- Session handover: `docs/specs/mvp/sessions/session-handover.md` (rolling)
- INDEX.md: row 0b flips ⚪ → 🟢 in same commit as this rollup
