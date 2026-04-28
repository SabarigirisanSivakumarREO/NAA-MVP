---
title: Phase 0b — Heuristic Authoring — Tasks
artifact_type: tasks
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/tasks-v2.md (Phase 0b section v2.3.3+ — T0B-001..T0B-005 CANONICAL HERE; T103-T105 CANONICAL in Phase 6 section but OWNED by Phase 0b workstream)
  - docs/specs/mvp/phases/phase-0b-heuristics/spec.md
  - docs/specs/mvp/phases/phase-0b-heuristics/plan.md
  - docs/specs/mvp/phases/phase-0b-heuristics/impact.md
  - docs/specs/mvp/PRD.md F-012 v1.2 amendment 2026-04-26

req_ids:
  - REQ-HK-001
  - REQ-HK-EXT-001
  - REQ-HK-BENCHMARK-001
  - REQ-CONTEXT-DOWNSTREAM-001

impact_analysis: docs/specs/mvp/phases/phase-0b-heuristics/impact.md
breaking: false
affected_contracts:
  - heuristics-repo/*.json (NEW deliverables)

delta:
  new:
    - Phase 0b tasks — 5 infrastructure tasks (T0B-001..T0B-005) + 3 content tasks (T103/T104/T105)
    - T103-T105 ownership shifts from Phase 6 to Phase 0b workstream per F-012 v1.2 amendment 2026-04-26
    - T103-T105 counts reduced from 50/35/15 to 15/10/5 per F-012 v1.2 amendment (tasks-v2.md v2.3.3 patch)
  changed: []
  impacted:
    - tasks-v2.md v2.3.2 → v2.3.3 (Phase 0b section + reduced counts)
    - phase-6-heuristics/tasks.md already references T103-T105 as Phase 0b workstream (no change)
  unchanged:
    - HeuristicSchemaExtended Zod fields (locked by Phase 6 v0.3)
    - PR Contract template baseline (T0B-003 extends it)

governing_rules:
  - Constitution R6, R15.3, R15.3.1, R15.3.2, R15.3.3
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R23 (Kill Criteria)
---

# Phase 0b Tasks (T0B-001..T0B-005 + T103/T104/T105)

> **Summary (~80 tokens):** 8 tasks. T0B-001..T0B-005 land authoring infrastructure (drafting prompt template, verification protocol, PR Contract Proof block, `pnpm heuristic:lint` CLI, repo README) — Week 1. T103/T104/T105 land the 30-heuristic content in Weeks 2-4 (Baymard → Nielsen → Cialdini, sequential). Total effort ~26h engineering + ~7h verifier. Canonical T-IDs: T0B-NNN here in tasks-v2.md Phase 0b section; T103-T105 in Phase 6 section but OWNED by Phase 0b workstream.

**Source of truth:**
- T0B-001..T0B-005 — `docs/specs/mvp/tasks-v2.md` Phase 0b section (v2.3.3+)
- T103/T104/T105 — `docs/specs/mvp/tasks-v2.md` Phase 6 section, count reduced to 15/10/5 in v2.3.3

Acceptance criteria, file paths, and dependencies below mirror tasks-v2.md verbatim — **do NOT modify this file in lieu of updating `tasks-v2.md`**.

---

## Phase 0b sequencing

Per [plan.md](plan.md) §1: Week 1 = T0B-001..T0B-005 (infrastructure) → Week 2 = T103 (Baymard, exercises workflow) → Week 3 = T104 (Nielsen) → Week 4 = T105 (Cialdini). Spot-checks at +10/+20/+30 marks. Phase 6 T112 cross-phase acceptance closes Phase 0b verification.

---

## T0B-001 — Drafting prompt template

- **dep:** T001 (monorepo) only
- **spec:** REQ-HK-001 + R15.3.1
- **files:** `docs/specs/mvp/templates/heuristic-drafting-prompt.md`
- **acceptance:** Markdown template structured per [plan.md §2](plan.md). System block, user block with `{source, source_url, citation_text, archetype, page_types, device}` inputs, output schema reference to HeuristicSchemaExtended, banned-phrasing prohibition. Producing a draft on a known Baymard excerpt yields valid `HeuristicSchemaExtended.parse()`-compatible JSON (manual smoke).
- **conformance:** manual review (template); validated indirectly via T103-T105 outputs.

## T0B-002 — Verification protocol document

- **dep:** none
- **spec:** R15.3.2
- **files:** `docs/specs/mvp/templates/heuristic-verification-protocol.md`
- **acceptance:** 8-step protocol per [plan.md §3](plan.md): URL liveness, citation locate, ±20% benchmark re-derivation (quantitative) or text-reference (qualitative), banned-phrase check, manifest-selector check, fill `verified_by`/`verified_date`, run `pnpm heuristic:lint`, commit with PR Contract Proof block. Includes 3-strike re-draft rule + escalation criteria.
- **conformance:** manual review.

## T0B-003 — PR Contract Proof block extension

- **dep:** T0B-002, PRD §10.9 PR Contract template
- **spec:** R15.3.2 + PRD §10.9
- **files:** `docs/specs/mvp/templates/heuristic-pr-proof.md`
- **acceptance:** Per-heuristic Proof block template per [plan.md §4](plan.md): heuristic ID, file path, drafted by, verified by, verified date, source URL (with status / archive note), re-derivation note, lint status, banned-phrase check status, manifest selectors. Linked from PRD §10.9 PR Contract section.
- **conformance:** manual review; first heuristic PR cites this template in its Proof block.

## T0B-004 — `pnpm heuristic:lint` CLI helper

- **dep:** T002 (agent-core skeleton), T003 (CLI skeleton), T101 (HeuristicSchemaExtended — Phase 6)
- **spec:** R15.3, R15.3.1, R15.3.3, R5.3, GR-007
- **files:**
  - `apps/cli/src/commands/heuristic-lint.ts` (NEW)
  - `apps/cli/package.json` (add `heuristic:lint` script)
  - `apps/cli/tests/conformance/heuristic-lint.test.ts` (NEW)
- **acceptance:** CLI per [plan.md §5](plan.md). Five checks: (1) Zod parse against HeuristicSchemaExtended; (2) all 5 `provenance` fields non-empty; (3) `benchmark` discriminated union present + well-formed; (4) manifest selectors `archetype` + `page_type` + `device` present; (5) banned-phrase regex on `recommendation.summary` + `recommendation.details`. Exit non-zero on any failure. Conformance test covers all 5 fail cases + 1 pass case + AC-13 isolation assertions.
- **conformance:** `apps/cli/tests/conformance/heuristic-lint.test.ts` (AC-04, AC-13)

## T0B-005 — `heuristics-repo/README.md` + `.gitignore` for `.heuristic-drafts/`

- **dep:** T0B-001, T0B-002, T0B-003, T0B-004
- **spec:** R6, R15.3, R15.3.3
- **files:**
  - `heuristics-repo/README.md` (NEW)
  - `.gitignore` (add `.heuristic-drafts/`)
- **acceptance:** README covers: authoring workflow (draft → verify → lint → PR), R6 IP discipline (drafting subprocess isolation per [plan.md §6](plan.md)), spot-check protocol (3 rounds at +10/+20/+30; ≤1 of 5 divergence acceptance), link back to PRD F-012 + Phase 0b spec. New author can follow it without engineering-lead clarification.
- **conformance:** manual review (AC-05); first new author follows it cleanly.

---

## Cross-referenced from Phase 6 section (CANONICAL definitions there; OWNED here per F-012 v1.2)

The 3 content-authoring tasks below are **canonically defined in `tasks-v2.md` Phase 6 section** (T103-T105 entries) — Phase 0b is the OWNER workstream per F-012 v1.2 amendment. Counts reduced from v2.0's 50/35/15 to v2.3.3's 15/10/5 per F-012 v1.2.

### T103 — Author ~15 Baymard heuristics

- **dep:** T0B-001..T0B-005 + T101 (HeuristicSchemaExtended) + T4B-013 contract surface (manifest selectors)
- **spec:** F-012 v1.2 + REQ-HK-001 + REQ-HK-EXT-001..019 + REQ-HK-BENCHMARK-001..003 + REQ-CONTEXT-DOWNSTREAM-001
- **files:** `heuristics-repo/baymard/*.json` (~15 files, one per heuristic)
- **distribution:** ≈4 homepage, ≈4 PDP, ≈5 checkout, ≈2 cart, ≥1 mobile-specific
- **acceptance:**
  - All ~15 pass `pnpm heuristic:lint heuristics-repo/baymard/*.json` (AC-06)
  - Each carries `benchmark` (quantitative for structural; qualitative for content/persuasion) + `provenance` (5 fields per R15.3.1) + manifest selectors (`archetype`, `page_type`, `device`)
  - Per-heuristic PR Contract Proof block cites verification evidence (T0B-003 template)
  - Spot-check at +10 mark: ≤1 of 5 random heuristics diverges from cited source (F-012 acceptance, AC-12 round 1)
- **smoke test:** `pnpm heuristic:lint heuristics-repo/baymard/*.json` exit code 0
- **kill criteria:** if 3+ Baymard heuristics fail verification on first attempt → STOP, review drafting prompt for systematic drift

### T104 — Author ~10 Nielsen heuristics

- **dep:** T103 (workflow exercised + smoothed)
- **spec:** F-012 v1.2 + REQ-HK-001 + REQ-HK-EXT-001..019 + REQ-HK-BENCHMARK-001..003
- **files:** `heuristics-repo/nielsen/*.json` (~10 files)
- **distribution:** ≈4 visibility/feedback, ≈3 error prevention/recovery, ≈3 consistency/standards
- **acceptance:**
  - All ~10 pass `pnpm heuristic:lint heuristics-repo/nielsen/*.json` (AC-07)
  - Each carries benchmark + provenance + manifest selectors
  - Spot-check at +20 mark (5 random across full set so far): ≤1 divergence (AC-12 round 2)
- **smoke test:** `pnpm heuristic:lint heuristics-repo/nielsen/*.json` exit code 0

### T105 — Author ~5 Cialdini heuristics

- **dep:** T104
- **spec:** F-012 v1.2 + REQ-HK-001 + REQ-HK-EXT-001..019 + REQ-HK-BENCHMARK-001..003
- **files:** `heuristics-repo/cialdini/*.json` (~5 files)
- **distribution:** 1 social proof, 1 scarcity, 1 authority, 1 reciprocity, 1 liking
- **acceptance:**
  - All ~5 pass `pnpm heuristic:lint heuristics-repo/cialdini/*.json` (AC-08)
  - Each carries benchmark (mostly qualitative; persuasion principles rarely quantified) + provenance (Cialdini chapter references acceptable per spec.md edge case) + manifest selectors
  - Spot-check at +30 mark (5 random across full pack): ≤1 divergence (AC-12 round 3 — final)
  - `heuristics-repo/_spot-checks.md` log committed with all 3 rounds
- **smoke test:** `pnpm heuristic:lint heuristics-repo/cialdini/*.json` exit code 0

---

## Cross-phase acceptance (Phase 6 owns the test; Phase 0b is the producer)

After T103/T104/T105 land, Phase 6 T112 integration test runs against the full 30-heuristic pack:

- **AC-14:** Phase 6 `HeuristicLoader.loadAll()` parses all 30 under `HeuristicSchemaExtended` — zero failures.
- **AC-11 (Phase 4b acceptance — T4B-013):** representative `{ecommerce, checkout, mobile}` ContextProfile filter via `HeuristicLoader.loadForContext(profile)` returns 12-25 heuristics from the 30-pack.

If either fails → Phase 0b PAUSES, defective heuristic(s) re-authored.

---

## Phase 0b "Done" definition

All 8 tasks merged AND all of:
- ✅ T0B-001..T0B-005 infrastructure complete (Week 1)
- ✅ 30 heuristic JSON files committed across `heuristics-repo/{baymard,nielsen,cialdini}/`
- ✅ `pnpm heuristic:lint heuristics-repo/**/*.json` exit 0
- ✅ 3 spot-check rounds documented in `heuristics-repo/_spot-checks.md`, all ≤1 divergent
- ✅ R6 / R15.3.3 isolation conformance test (AC-13) green
- ✅ Phase 6 T112 cross-phase acceptance (AC-14) green against the full pack
- ✅ Phase 0b status: `verified`
