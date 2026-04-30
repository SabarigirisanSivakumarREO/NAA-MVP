---
title: Phase 0b — Impact Analysis (LOW risk; content authoring only)
artifact_type: impact
status: approved
version: 0.3
created: 2026-04-28
updated: 2026-04-30
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-0b-heuristics/spec.md
  - docs/specs/mvp/phases/phase-6-heuristics/impact.md (HeuristicSchemaExtended contract — Phase 0b consumes; Phase 6 owns)
  - docs/specs/mvp/phases/phase-4b-context-capture/impact.md (T4B-013 manifest selector contract)
  - docs/specs/mvp/PRD.md F-012 v1.2 amendment 2026-04-26
  - docs/specs/mvp/constitution.md (R6, R15.3, R15.3.1, R15.3.2, R15.3.3, R20)

req_ids:
  - REQ-HK-001
  - REQ-HK-EXT-001
  - REQ-HK-BENCHMARK-001
  - REQ-CONTEXT-DOWNSTREAM-001

breaking: false
risk_level: low

affected_contracts:
  - heuristics-repo/*.json content (NEW deliverables — file system)
  - HeuristicSchemaExtended (CONSUMER ONLY — Phase 6 owns)
  - PR Contract template (additive Proof-block extension)
  - .gitignore (additive — adds `.heuristic-drafts/`)
  - tasks-v2.md (v2.3.2 → v2.3.3: adds Phase 0b section + reduces T103-T105 counts to 15/10/5)

delta:
  new:
    - Phase 0b impact analysis — required by R20 because tasks-v2.md is patched (v2.3.2 → v2.3.3) and PR Contract template gains a heuristic-specific Proof block extension
  changed:
    - v0.1 → v0.2 — companion update to spec.md/plan.md/tasks.md v0.2 analyze-driven fixes; no impact-content changes (consumer mappings unchanged); version + updated date + delta entry only per R18.2 no-silent-edits rule
    - v0.2 → v0.3 — companion update to spec.md/plan.md/tasks.md v0.3 status bumps (R17.4 review approved per phase-0b-heuristics/review-notes.md); no impact-content changes
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R6 (IP — focal)
  - Constitution R15.3, R15.3.1, R15.3.2, R15.3.3
  - Constitution R18 (Delta-Based Updates)
---

# Phase 0b Impact Analysis

> **Why this file exists:** Constitution R20. Phase 0b ships content (not new shared contracts) but it touches three cross-cutting surfaces: (a) `heuristics-repo/*.json` becomes the runtime input for Phase 6 + Phase 7 + Phase 4b T4B-013; (b) PR Contract template gains a heuristic-specific Proof block; (c) tasks-v2.md is patched v2.3.2 → v2.3.3 to add a Phase 0b section + reduce T103-T105 counts. Risk level **LOW** — Phase 0b is a CONSUMER of HeuristicSchemaExtended (Phase 6 owns the schema), not a producer of new contracts.

---

## 1. Contract changes

| Contract | Before | After | Breaking? |
|---|---|---|---|
| HeuristicSchemaExtended (Zod) | Locked in Phase 6 v0.3 with manifest selectors `archetype`/`page_type`/`device` (per T4B-013 v0.3 contract) | Phase 0b CONSUMES — produces JSON files conforming to it | **No** — additive consumer |
| `heuristics-repo/*.json` | Empty / stub | 30 JSON files (≈15 Baymard + ≈10 Nielsen + ≈5 Cialdini) | **No** — new content |
| PR Contract template (PRD §10.9) | Generic Proof block | Adds heuristic-specific Proof block (T0B-003) for heuristic-touching PRs | **No** — additive extension |
| `.gitignore` | Existing entries | Adds `.heuristic-drafts/` | **No** — additive |
| tasks-v2.md | v2.3.2 (T103-T105 in Phase 6 with 50/35/15 counts) | v2.3.3 (Phase 0b section added; T103-T105 counts reduced to 15/10/5; ownership note added) | **No** — count reduction is per F-012 v1.2 amendment (not a regression in scope; an alignment with PRD canonical) |

---

## 2. Producers affected

| Producer | File | Change required | Owner |
|---|---|---|---|
| T0B-001 drafting prompt template | `docs/specs/mvp/templates/heuristic-drafting-prompt.md` | NEW | Phase 0b |
| T0B-002 verification protocol | `docs/specs/mvp/templates/heuristic-verification-protocol.md` | NEW | Phase 0b |
| T0B-003 PR Contract Proof block extension | `docs/specs/mvp/templates/heuristic-pr-proof.md` | NEW | Phase 0b |
| T0B-004 `pnpm heuristic:lint` CLI | `apps/cli/src/commands/heuristic-lint.ts` + tests | NEW | Phase 0b |
| T0B-005 heuristics-repo README + gitignore patch | `heuristics-repo/README.md`, root `.gitignore` | NEW + additive | Phase 0b |
| T103-T105 heuristic JSON content | `heuristics-repo/{baymard,nielsen,cialdini}/*.json` | NEW (30 files) | Phase 0b workstream (per F-012 v1.2 amendment) |
| tasks-v2.md v2.3.3 patch | `docs/specs/mvp/tasks-v2.md` | Adds Phase 0b section + reduces T103-T105 counts + delta block | Phase 0b session |

---

## 3. Consumers affected (per R20 audit)

| Consumer | Location | Reads which contract? | Migration required? | Action |
|---|---|---|---|---|
| Phase 6 `HeuristicLoader.loadAll()` | `packages/agent-core/src/analysis/heuristics/loader.ts` | Reads `heuristics-repo/**/*.json` and parses against HeuristicSchemaExtended | **No** — Phase 6 schema already accommodates manifest selectors (v0.3) | T112 integration test uses the 30-pack as fixture |
| Phase 4b `HeuristicLoader.loadForContext(profile)` | `packages/agent-core/src/analysis/heuristics/loader.ts` (extension) | Filters the loaded set by `archetype` + `page_type` + `device` selectors | **No** — Phase 0b heuristics carry the selectors; T4B-013 implements filter | Filter returns 12-25 heuristics for representative ContextProfile |
| Phase 7 `EvaluateNode` | `packages/agent-core/src/analysis/nodes/EvaluateNode.ts` | Reads filtered heuristic set from `loadForContext()`; injects content into LLM user message (R5.5) | **No** — Phase 7 receives a typed `HeuristicExtended[]`; field shapes locked | None (Phase 7 unaffected by content; only by Phase 6 contract) |
| Phase 7 `SelfCritiqueNode` | `packages/agent-core/src/analysis/nodes/SelfCritiqueNode.ts` | Same | **No** | None |
| Phase 7 `EvidenceGrounder` (GR-001..GR-008 + GR-012) | `packages/agent-core/src/analysis/grounding/*` | Reads heuristic IDs only (NOT body — R6) | **No** — IDs and benchmark fields surface; body stays inside LLM prompt | GR-012 benchmark-validation grounding rule reads `benchmark` block |
| Phase 8 `AuditSetupNode` | `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts` | Calls `filterByBusinessType(allHeuristics, business_type)` (Stage 1, §9.6) | **No** — Stage 1 reads `archetype` field which Phase 0b heuristics carry | None |
| Phase 8 `PageRouterNode` | `packages/agent-core/src/orchestration/nodes/PageRouterNode.ts` | Calls `filterByPageType` (Stage 2) | **No** — Stage 2 reads `page_type` field | None |
| PR review (human) | GitHub PR template | Reads heuristic-specific Proof block | **Yes** — reviewers spot-check `source_url` per heuristic | T0B-003 documents the new Proof block; PR template referenced from PRD §10.9 |
| Spec authoring sessions (this + future) | tasks-v2.md | Reads canonical task definitions | **Yes** — v2.3.3 patch surfaces in this session's commit | Phase 0b session ships the patch; future sessions reference Phase 0b section verbatim |
| `.gitignore` | Root | Drafting subprocess writes `.heuristic-drafts/` | **Yes** — gitignore must include before any drafting | T0B-005 ships the gitignore patch |

**Net break risk:** Zero. Phase 0b is purely additive content + tooling.

---

## 4. Heuristic engine impact

Phase 6 engine is the runtime validation gate. Phase 0b content MUST pass `HeuristicSchemaExtended.parse()` for every heuristic. Phase 0b's `pnpm heuristic:lint` (T0B-004) is the developer-time gate that catches schema failures BEFORE PR; Phase 6 T112 integration test is the cross-phase gate that catches them BEFORE Phase 6 ships.

GR-012 benchmark validation (Phase 7 grounding rule) consumes the `benchmark` block at evaluate-time. Phase 0b ensures every heuristic's benchmark is verifiable against `provenance.source_url` + `citation_text` per R15.3.2 — making GR-012's runtime check trustworthy (otherwise GR-012 grounds against hallucinated benchmarks).

---

## 5. Cost impact

| Metric | Before | After | Δ |
|---|---|---|---|
| Phase 0b drafting cost | $0 | ~$5-10 (Claude Sonnet 4 × 30 heuristics × ~3K tokens/draft) | +$5-10 (one-time) |
| Phase 7 evaluate cost (per page) | unknown — depends on heuristic pack size | 12-25 heuristics × ~500 tokens each = ~6-12K tokens added to evaluate prompt | Net favorable per Phase 4b §5 estimate |
| Engineering hours | 0 | ~26h (T0B + T103-T105) | +26h (one-time over 4 weeks) |
| Verifier hours | 0 | ~7h (verification + spot-checks) | +7h (one-time) |
| Net audit cost impact | — | Same as Phase 7 estimate (heuristic pack cost) | None new beyond Phase 7's calculation |

---

## 6. Storage impact

NEW files in `heuristics-repo/`:

```
heuristics-repo/
├── README.md                       (T0B-005)
├── _spot-checks.md                 (T103/T104/T105 — 3 rounds documented)
├── _dedup-log.md                   (only if duplicates found during authoring)
├── baymard/                        (~15 files)
│   ├── BAY-HOMEPAGE-001.json
│   ├── BAY-PDP-001.json
│   ├── BAY-CHECKOUT-001.json
│   ├── ...
├── nielsen/                        (~10 files)
│   ├── NNG-VISIBILITY-001.json
│   ├── ...
└── cialdini/                       (~5 files)
    ├── CIAL-SOCIAL-001.json
    ├── ...
```

Per-file size: ~3-5 KB. Total repo footprint after Phase 0b: ~150-200 KB. Trivial.

NEW gitignored directory `.heuristic-drafts/` — local only; not committed; ~1-3 MB during active drafting (transcripts).

NO new database storage. NO new cloud storage (R2 unaffected). Heuristics-repo is Git only.

---

## 7. Reproducibility impact

Reproducibility snapshot (Phase 8 §F-015) pins `heuristic_set_version` (existing field) AND `heuristic_pack_hash` (SHA-256 of concatenated sorted heuristic IDs + their content hashes). Phase 0b commit lands the first non-stub version, so the first MVP audit's snapshot will reference this commit's hash.

Re-running an audit with the same snapshot loads the same 30 heuristics by content hash — even if `heuristics-repo/` later drifts, snapshot replay uses the historical content. Phase 6 + Phase 8 own this mechanic; Phase 0b just ships the first non-stub content.

---

## 8. Documentation impact

| Doc | Change |
|---|---|
| `docs/specs/mvp/templates/heuristic-drafting-prompt.md` | NEW (T0B-001) |
| `docs/specs/mvp/templates/heuristic-verification-protocol.md` | NEW (T0B-002) |
| `docs/specs/mvp/templates/heuristic-pr-proof.md` | NEW (T0B-003) |
| `docs/specs/mvp/PRD.md` §10.9 PR Contract | Cross-link to heuristic-pr-proof.md added (next PRD bump; not blocking Phase 0b) |
| `docs/specs/mvp/PRD.md` §F-012 | Already amended v1.2 2026-04-26; no change |
| `docs/specs/mvp/PRD.md` §14 Timeline | Already references Phase 0b "engineering-owned per F-012 v1.2 amendment"; no change |
| `docs/specs/mvp/tasks-v2.md` | v2.3.2 → v2.3.3 patch (this session) — adds Phase 0b section + reduces T103-T105 counts |
| `docs/specs/mvp/phases/INDEX.md` | v1.1 → v1.2 — Phase 0b row marked status "spec shipped" (this session) |
| `docs/specs/mvp/phases/phase-6-heuristics/{spec,plan,tasks,impact}.md` | Already references "T103-T105 are Phase 0b workstream" (no change required) |
| `heuristics-repo/README.md` | NEW (T0B-005) |
| `.gitignore` | Add `.heuristic-drafts/` (T0B-005) |
| `apps/cli/package.json` | Add `heuristic:lint` script (T0B-004) |
| `docs/specs/final-architecture/09-heuristic-kb.md` | No change — §9.1/§9.10 already canonical |

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM hallucinates Baymard URLs | High | Medium | Verification protocol step 1 (open URL, confirm 200) catches; Wayback archive fallback |
| LLM drafts banned conversion-rate phrasing | Medium | Low | T0B-004 deterministic regex check rejects |
| Verifier rubber-stamps without re-deriving benchmark | Medium | High (R15.3.2 violation) | Spot-check protocol + PR Contract Proof block requires re-derivation note (not just checkbox) |
| Phase 6 T101 schema lands AFTER drafting begins | Medium | Medium | Schedule T0B-001..T0B-005 to wait for T101 OR draft against the spec'd schema and rework if T101 amends |
| Cialdini citations as book chapters lose stability | Low | Low | Verification protocol allows stable text reference (book + chapter); verifier confirms access |
| Solo engineer / no spot-checker available | Medium | High | Engineering lead serves as universal spot-checker for all 3 packs |
| F-012 count drift back to 100 mid-session | Low | Low | tasks-v2.md v2.3.3 patch locks 15/10/5; PRD F-012 v1.2 amendment is canonical authority |
| Drafting cost > $25 (vs $15 NF-01 target) | Low | Medium | Kill criteria trigger; cumulative cost tracked in `.heuristic-drafts/_cost-log.json` |
| R6 leak via accidental console.log of draft response | Low | High (constitutional) | T0B-004 conformance test (AC-13) checks gitignore + asserts no LangSmith client in drafting subprocess; engineering review on T0B-001 prompt template |
| Heuristic count distribution skewed (e.g., all 15 Baymard are checkout) | Medium | Low | T103 acceptance distributes across homepage / PDP / checkout / cart / mobile; PR review enforces |
| Per-heuristic time blows past 90 min | Medium (early heuristics) | Medium | Kill criteria trigger after smoothing first 5; protocol tuning |

---

## 10. Sign-off requirements

Per R20:

- [x] This impact.md exists (R20 hard requirement)
- [ ] Engineering lead sign-off on Phase 0b spec.md (`status: draft → validated → approved`)
- [ ] T0B-001..T0B-005 PRs include `verified_by` engineering lead
- [ ] T103/T104/T105 PRs each include per-heuristic Proof block (T0B-003 template) with verification evidence
- [ ] Spot-check log committed under `heuristics-repo/_spot-checks.md` after each round
- [ ] Phase 6 T112 integration test passes against the full 30-heuristic pack BEFORE Phase 0b status → `verified`
- [ ] R6 / R15.3.3 isolation conformance test (T0B-004 AC-13) passes
- [ ] tasks-v2.md v2.3.3 patch applied + delta block updated

---

## 11. Provenance (R22.2)

```yaml
why:
  source: >
    docs/specs/mvp/PRD.md F-012 v1.2 amendment (2026-04-26 — LLM-assisted authoring + 30-heuristic MVP scope reduction)
    docs/specs/mvp/constitution.md R15.3, R15.3.1, R15.3.2, R15.3.3 (benchmark + provenance + verification + IP)
    docs/specs/mvp/phases/phase-6-heuristics/impact.md §"Phase 0b (separate session)" — forward contract from Phase 6
    docs/specs/mvp/phases/phase-4b-context-capture/spec.md T4B-013 — manifest selector contract
  evidence: >
    PRD F-012 v1.2 explicitly switches authoring from CRO-parallel to engineering-owned
    LLM-assisted with mandatory human verification per R15.3.2. tasks-v2.md still carries
    v2.0 counts (50/35/15 = 100) which contradicts F-012 v1.2 (30 total). Phase 6 v0.3
    impact.md already declares "Phase 0b (separate session)" as the producer of
    `heuristics-repo/*.json` content — Phase 6 is the engine; Phase 0b is the content.
    Phase 4b T4B-013 v0.3 adds manifest selectors (`archetype`/`page_type`/`device`)
    which Phase 0b heuristics MUST carry for `loadForContext(profile)` to filter correctly.
  linked_failure: >
    Anticipated risk class — LLM-drafted heuristics with hallucinated benchmarks cascade
    into false-confidence findings during real audits, eroding REO Digital's consultant
    defensibility. R15.3.2 + verification protocol + spot-check are the layered defense.
```
