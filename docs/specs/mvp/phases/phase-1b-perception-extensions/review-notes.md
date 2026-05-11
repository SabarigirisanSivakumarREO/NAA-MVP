---
title: Phase 1b — R17.4 Phase Review (Pass 1)
artifact_type: phase-review
status: complete
version: 1.0
phase_number: 1b
phase_name: Perception Extensions v2.4
review_pass: 1
created: 2026-05-09
updated: 2026-05-09
owner: engineering lead (review pending)
authors: [Claude (AI Reviewer per neural-ai-reviewer skill, Gate 1 pre-flight)]
reviewers: [(Sabari — pending Gate 1 stamp)]

derived_from:
  - .phase-state/1b/preflight-correctness.json (/speckit.analyze output)
  - .phase-state/1b/preflight-coverage.json (pnpm spec:matrix output)
  - .phase-state/1b/preflight-verdict.yaml (full verdict YAML)
  - docs/specs/mvp/phases/phase-1b-perception-extensions/{spec,plan,tasks,impact}.md (v0.1, draft)
  - docs/specs/mvp/phases/phase-1-perception/phase-1-current.md (predecessor rollup R19)
  - .claude/skills/neural-ai-reviewer/SKILL.md
  - docs/specs/mvp/templates/phase-review-{prompt,report}.template.md
  - CLAUDE.md §8d (R17.4 review gate ordering)
  - docs/specs/mvp/constitution.md (R5.6, R11, R11.4, R17, R18, R20, R23)

governing_rules:
  - Constitution R17.4 (lifecycle gate — `validated → approved`)
  - Constitution R5.6 (separate-persona discipline applied to review)
---

# Phase 1b — R17.4 Phase Review (Pass 1)

> **Verdict:** **REVISE** — 5 CRITICAL + 4 HIGH correctness findings + 2 SPEC_GAP completeness findings.
>
> **Phase 1b artifacts MUST NOT bump `status: draft → approved` until the patches below land.**

## 1. Review pass summary

| Sub-audit | Verdict | Findings |
|---|---|---|
| Correctness | **REVISE** | 5 CRITICAL (C1-C5) + 4 HIGH (H1-H4) + 5 MEDIUM (M1-M5) + 4 LOW (L1-L4) |
| Coverage | **PASS** | 12/12 AC↔expected-test mapping declared; 0 impl is correct at pre-flight; 11 orphan tests all belong to earlier phases |
| Completeness (R5.6 two-pass) | **REVISE** | 2 SPEC_GAP (popup types, microcopy tags) + 2 PASS_WITH_NOTE + 1 PASS across 5 categorical surfaces audited |
| **Overall** | **REVISE** | Strictest wins. Correctness + completeness independently drive REVISE. |

## 2. The doom check (would I bet the company on this spec as-is?)

**No.** Phase 1b's spec corpus is ~11 days stale relative to Phase 1's actual implementation (Session 13 / 2026-05-09). Five CRITICAL drift signals make the artifacts unimplementable as-written:

1. The contract is named differently in spec (`AnalyzePerception`) vs code (`PageStateModel`).
2. The implementation of T1B-001/005/006/007/009 references substrate (`ctas[]`, `formFields[]`, `metadata.schemaOrg`, `metadata.ogTags`, `headings[]`, JSON-LD parses) that **does not exist** in Phase 1's actual `PageStateModel`. Phase 1 shipped a stripped-down 6-sub-schema reduction (Metadata, AccessibilityTree, FilteredDOM top-30, InteractiveGraph, Visual, Diagnostics).
3. File paths in `plan.md` (`schema.ts`, `analyzePerception.ts`) **don't exist** — Phase 1 ships `types.ts` + `ContextAssembler.ts`.
4. Token budget arithmetic is rebased against a 5K baseline that no longer exists — Phase 1 shipped at **20K** (NF-Phase1-01 v0.4 amendment).
5. `impact.md` identifies the producer as the `page_analyze` MCP tool that **doesn't exist yet** — Phase 2 (MCP layer) is ⚪ not started; Phase 1's actual producer is `contextAssembler.capture(url)`.

A subagent dispatched to T1B-001 with these artifacts would either (a) silently invent missing fields, (b) hit `Cannot find module 'schema.ts'`, or (c) re-implement Phase 1's fields under a different name and break the walking-skeleton fixture. The R11.4 patch wave below closes the gap.

## 3. Critical findings (must resolve before approval)

### C1 — Contract naming mismatch

Phase 1b: `AnalyzePerception`. Phase 1: `PageStateModel`. **All 4 artifacts cite the wrong name.**

- Verified: `packages/agent-core/src/perception/types.ts:279-297` exports `PageStateModelSchema`.
- Verified: `phase-1-perception/phase-1-current.md` lines 96-97 confirm PageStateModel is the canonical Phase 1 deliverable.
- Architecture spec `07-analyze-mode.md` §7.9 still uses the old `AnalyzePerception` name; this is a documentation lag from Phase 1's renaming.

**Action:** R11.4 patch v0.1 → v0.2 — rename `AnalyzePerception` → `PageStateModel` throughout, OR explicitly document a superset relationship in `impact.md §1` (PageStateModel is Phase 1's subset; v2.4 extensions broaden it toward the architecture-spec scope).

### C2 — Phase 1b prerequisites don't exist in Phase 1

Phase 1b's `plan.md §2.2` specifies an `ExtractCtx` carrying v2.3 outputs already computed: `ctas[]`, `formFields[]`, `metadata`, `structured-data parses`. These were assumed to exist as a v2.3 baseline. **Verified: none of these ship in Phase 1's PageStateModel.** Specifically:

| Phase 1b assumes | Actually in Phase 1 | T1B tasks affected |
|---|---|---|
| `ctas[]` | (only `FilteredDOM.top30` + `InteractiveGraph`) | T1B-007 MicrocopyTagger references `ctas[]` index |
| `formFields[]` | (only `InteractiveGraph` clickable elements) | T1B-005 FrictionScorer reads `formFields[]` |
| `metadata.schemaOrg` (JSON-LD) | (no JSON-LD extraction in Phase 1) | T1B-001 PricingExtractor JSON-LD path; T1B-006 SocialProofDepth AggregateRating; T1B-009 CommerceBlockExtractor Offer schema |
| `metadata.ogTags` | (Phase 1 has only `Metadata.title` + `requestedUrl` + `statusCode`) | not directly cited but commonly used in heuristic prompts |
| `headings[]` | (in FilteredDOM as elements but not as a structured block) | not directly cited |

**Action:** R11.4 patch — choose Path A or Path B:
- **Path A** (faster, reduced fidelity): rebase extractors against PageStateModel's actual surface (use `FilteredDOM.top30` + `InteractiveGraph` in lieu of `ctas[]`/`formFields[]`; perform raw HTML re-query inside `page.evaluate()` for JSON-LD).
- **Path B** (more correct): add a Phase 1b prerequisite task that extends PageStateModel with `ctas[]` + `formFields[]` + `schemaOrg` + `ogTags` + `headings[]`. Cost: ~+2-3h spec work + 1 prerequisite task.

**Engineering-lead decision required.**

### C3 — Stale file paths

Plan says `T1B-011` modifies `packages/agent-core/src/perception/schema.ts`. **File doesn't exist.** Phase 1 ships `types.ts`. Plan also references an `analyzePerception.ts` driver — Phase 1 ships `ContextAssembler.ts`.

**Action:** R11.4 patch — `schema.ts` → `types.ts`; `analyzePerception.ts` → `ContextAssembler.ts`. New `extensions/` subdirectory creation is fine.

### C4 — Token budget arithmetic stale

Phase 1b spec says **+1.5K tokens (5K → 6.5K, cap 8K)**. Phase 1 actually shipped at **20,000 tokens** per [phase-1-current.md:39, 96-99](docs/specs/mvp/phases/phase-1-perception/phase-1-current.md). The 5K baseline / 6.5K cap / 8K hard ceiling no longer applies. Empirical floor: amazon.in 12,485 + Peregrine 4,012.

**Action:** R11.4 patch — rebase NF-01 to PageStateModel's 20K budget. Decide cap behavior (most likely: cap stays at 20K, Phase 1b's additions absorbed into existing headroom). Recompute SC-002 + impact.md §5 + AC-11 + AC-12 thresholds.

### C5 — Producer doesn't exist

`impact.md §2` identifies the producer as the `page_analyze` MCP tool at `packages/agent-core/src/mcp/tools/page-analyze.ts`. **MCP tools ship in Phase 2** (status ⚪ not started). The actual Phase 1 producer is `contextAssembler.capture(url)` — a module-level function with no MCP layer yet.

**Action:** R11.4 patch — re-target producer to `contextAssembler.capture()`. The MCP wrapping (`browser_get_state`) consumes PageStateModel as-is; Phase 1b extensions live one layer down.

## 4. High-severity findings

| ID | Issue | Action |
|---|---|---|
| H1 | `_extensions` namespace contract not documented per [phase-1-current.md §5](docs/specs/mvp/phases/phase-1-perception/phase-1-current.md) carry-forward risk | Add `impact.md §11 'Namespace contract'` — choose top-level vs `_extensions.perception` (top-level matches architecture §7.9.2; `_extensions.perception` matches Phase 7's `_extensions.deepPerceive` namespace pattern; either is defensible if explicit) |
| H2 | `ExtractCtx` interface undeclared (plan.md §2.2 references it; spec doesn't define it) | Declare ExtractCtx Zod/TS type once C2 baseline is decided |
| H3 | Fixture set diverges — Phase 1b proposes 5 fresh fixtures (homepage/PDP/cart/checkout/content); Phase 1 ships 3 (example.com/amazon.in/Peregrine PDP); walking-skeleton uses Peregrine | Align AC-12 / SC-001 with Phase 1's reality — reuse 3 + add 2 new (cart, checkout from Peregrine or another live D2C) |
| H4 | Backward-compat claim moot — v2.3 fields don't exist in Phase 1; the "v2.3 fields keep names" assertion is mathematically empty | Rewrite Constraints + impact.md §3 against Phase 1's actual surface (PageStateModel sub-schemas, not a v2.3-named superset) |

## 5. Completeness gaps (categorical surfaces — R5.6 two-pass)

Two surfaces require spec patches; two require optional polish; one passes.

### 5.1 Popup type universe (SPEC_GAP)

R-04 enumerates 6 popup types (`modal/lightbox/drawer/toast/cookie_banner/consent_form`). Domain knowledge enumeration adds 4 high-confidence missing cases: `slide_in_panel`, `exit_intent_overlay`, `chat_widget`, `paywall`. Auditor + critic agree these are real gaps (some sub-types collapse into existing types — `notification_bar`→`cookie_banner`, `interstitial`→`modal` — but not all).

**Action:** R11.4 patch R-04 + AC-04 + Edge Cases — either (a) add 4 cases to required and bump conformance fixture count, OR (b) add `type: other` fallback enum value and explicit deferral statement in §Out of Scope.

### 5.2 Microcopy tag taxonomy (SPEC_GAP)

AC-07 enumerates 7 tags. Phase 0b T105 (Cialdini persuasion-principle pack — committed 2026-05-08 commit `47fd4bd`) enumerates 7 distinct Cialdini principles (reciprocity, commitment_consistency, social_proof, authority, liking, scarcity, unity). Phase 1b's tag taxonomy collapses Cialdini principles into broad buckets (e.g., scarcity → urgency; authority → social_proof partially). Critic concedes the collapse is defensible for regex-detectability (NF-04: ≥80% precision) but spec must EXPLICITLY state the rationale; currently silent.

**Action:** R11.4 patch — add note to R-07 / AC-07 / §Out of Scope: *"Cialdini-principle granularity (scarcity vs urgency, authority vs social_proof, reciprocity, commitment_consistency, liking) deferred to Phase 6 LLM-tagging. Phase 1b regex-tagger collapses to 7 high-precision-detectable tags."*

### 5.3 Click target element types (PASS_WITH_NOTE)

AC-02 enumerates 4 types. Universe ~9. Critic concedes 4-type coarse taxonomy is reasonable MVP scope. Optional polish recommended.

### 5.4 Sticky element type universe (PASS)

R-03 `type` field is open-string (not a closed enum). Auditor flagged a non-existent constraint; critic correctly disputed.

### 5.5 Currency switcher location universe (PASS_WITH_NOTE)

R-10 closed enum of 3 (`header/footer/none`) misses common patterns (`account_menu`, `settings_modal`, `sidebar`). Critic concedes MVP scope is reasonable; account-tied currency requires authenticated session (PRD §3.2 permanent non-goal). Optional polish recommended.

## 6. Kill criteria validation

Plan §3 defines 6 kill criteria (token budget, browser-time regression, microcopy precision, ground-truth missing, backward-compat regression, cross-cutting impact mid-impl). Each has a clear trigger + action. **Realistic and well-formed**, but:

- **Token budget kill** says "drop AttentionScorer.contrastHotspots from 3 to 1" — this assumes the 6.5K cap from C4. After C4 patch, this kill action's trigger threshold needs recomputation against the 20K baseline.
- **Browser-time regression kill** is `+200ms p50 vs v2.3` — but Phase 1 v2.3 isn't a thing; the comparison should be Phase 1's baseline (per phase-1-current.md, Peregrine PDP capture wallclock).
- All other 4 kill criteria stand.

## 7. Recommendation

**REVISE.** Apply v0.1 → v0.2 R11.4 patch wave bundling C1-C5 + H1-H4 + completeness SPEC_GAP findings (popup types + microcopy tags). Optionally include M1-M5 + L1 + completeness PASS_WITH_NOTE polish in the same delta block.

### 7.1 Order of patch operations (proposed)

1. **Engineering-lead decides C1+C2 strategy** (Path A rebase or Path B prerequisite-task) — this is the load-bearing decision.
2. Single delta-block commit per artifact (4 commits or 1 multi-file commit per CLAUDE.md §6 git workflow).
3. Re-run `/speckit.analyze phase=phase-1b-perception-extensions` → expect clean.
4. Re-run `/master 1b --gate-1 REVISE` to re-trigger Stage 1 pre-flight against patched artifacts.
5. On clean Pass 2 verdict: bump `status: draft → approved` on the 4 artifacts in same commit (R17.4 evidence).

### 7.2 Estimated effort

- Path A: ~2-3h spec work (rename + rebase) + ~30min for completeness polish + ~30min for re-analyze
- Path B: ~3-4h spec work (add prerequisite task + rebase) + ~30min for completeness polish + ~30min for re-analyze

Either is well within the per-phase $10 cost ceiling defined in `.phase-state/1b.json`.

### 7.3 Conditions to apply at impl time (if any survive REVISE wave)

None pre-impl. All findings are spec-stage; resolve before Stage 2 dispatch. (The standing-conditions pattern from Phase 1's review will reappear at Pass 2 if any per-task BINDING items emerge.)

## 8. Audit trail

| Artifact | Path |
|---|---|
| Correctness analysis (analyze output) | `.phase-state/1b/preflight-correctness.json` |
| Coverage matrix (spec:matrix output) | `.phase-state/1b/preflight-coverage.json` |
| Verdict YAML (full machine-readable) | `.phase-state/1b/preflight-verdict.yaml` |
| This review note (human-stamp render) | `docs/specs/mvp/phases/phase-1b-perception-extensions/review-notes.md` (this file) |
| Master orchestrator state file | `.phase-state/1b.json` |

---

**Pending:** engineering lead Gate 1 stamp via `/master 1b --gate-1 {APPROVE|REVISE|RE-SPEC}`.

**Recommended stamp:** **REVISE** (with C1+C2 strategy decision attached).
