---
title: Phase 6 — Heuristic KB Engine
artifact_type: spec
status: draft
version: 0.4
created: 2026-04-27
updated: 2026-04-30
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (F-012 — amended 2026-04-26 for LLM-assisted authoring in Phase 0b)
  - docs/specs/mvp/constitution.md (R5 analysis agent — R5.4/R5.5; R6 IP protection — focal; R9 adapter; R15.3 provenance)
  - docs/specs/mvp/architecture.md (§6.4, §6.5)
  - docs/specs/mvp/tasks-v2.md (T101-T112 — T103-T105 are Phase 0b workstream, deferred this session; T4B-013 v0.3 extension)
  - docs/specs/final-architecture/09-heuristic-kb.md (§9.1 base + §9.10 extensions)
  - docs/specs/final-architecture/37-context-capture-layer.md §37.5 (REQ-CONTEXT-DOWNSTREAM-001 — v0.3 extension)
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md (T4B-013 — v0.3 extension)

req_ids:
  - REQ-HK-001
  - REQ-HK-EXT-001
  - REQ-HK-EXT-019
  - REQ-HK-EXT-050
  - REQ-HK-020a
  - REQ-HK-020b
  - REQ-CONTEXT-DOWNSTREAM-001          # v0.3 — loadForContext extension

impact_analysis: docs/specs/mvp/phases/phase-6-heuristics/impact.md
breaking: false
affected_contracts:
  - HeuristicSchema
  - HeuristicSchemaExtended
  - HeuristicKnowledgeBase
  - HeuristicLoader
  - HeuristicFilter
  - TierValidator
  - DecryptionAdapter

delta:
  new:
    - Phase 6 spec — heuristic engine; first runtime activation of R6 IP protection
    - AC-01..AC-10 stable IDs
    - R-01..R-08 functional requirements
    - 9 engine MVP tasks; T103-T105 (content authoring) deferred to Phase 0b
    - v0.2 — R6 enforcement scope clarified: Phase 6 activates the Pino-logs channel (loader discipline + redaction config + transport spy); Phase 7 enforces LangSmith trace redaction; Phase 8/9 enforce API + dashboard channels (analyze finding F005)
    - v0.2 — Pino redaction pattern → BenchmarkSchema discriminated-union mapping documented (analyze finding F006)
    - v0.3 — AC-11 + R-09 added for `HeuristicLoader.loadForContext(profile)` (T4B-013); manifest selectors `archetype`/`page_type`/`device` added; filter returns 12-25 heuristics for typical contexts. Wraps the existing two-stage filter (business → page) with a ContextProfile-aware entry point. Phase 4b T4B-013 lands the actual implementation; Phase 6 v0.3 documents the contract.
  changed:
    - v0.1 → v0.2 — analyze-driven xref + redaction-pattern polish
    - v0.2 → v0.3 — adds T4B-013 ContextProfile filter integration (REQ-CONTEXT-DOWNSTREAM-001); coordinated with Phase 4b
    - v0.3 → v0.4 — Session 7 /speckit.analyze polish — M1 (R10→R13 stale xref for temperature=0 in Constitution Alignment Check); coordinated with parallel plan.md v0.2→v0.4 catch-up (which absorbs v0.3 content + M1 + H3) and impact.md v0.1→v0.4 catch-up (which absorbs v0.2 redaction polish + v0.3 contract surface + H2) and tasks.md v0.3→v0.4 (which absorbs H1 — T-PHASE6-LOGGER 6-path Pino redaction config to match spec.md:101 authoritative list). No AC-NN/R-NN/SC-NNN ID changes (R18 append-only preserved).
  impacted:
    - Constitution R6.1-R6.4 — first runtime enforcement of the **logs channel**; full multi-channel enforcement spans Phase 6/7/8/9
    - Constitution R15.3 — schema enforces benchmark + provenance presence; loader rejects heuristics missing either
    - Constitution R5.4 — two-stage filter (business + page type) implemented per §9.6
    - Constitution R5.5 — injection via LLM user message format (Phase 7 consumes; Phase 6 produces ready-to-inject form)
    - Phase 4b T4B-013 — implements `loadForContext()` over Phase 6's loader
    - Phase 0b heuristic authoring — manifest schema must include `archetype`/`page_type`/`device` selectors so the v0.3 filter matches
  unchanged:
    - AC-01..AC-10 stable IDs, R-01..R-08 statements (v0.3 adds AC-11 + R-09 only)

governing_rules:
  - Constitution R5 (R5.4, R5.5)
  - Constitution R6 (IP protection — focal in Phase 6)
  - Constitution R9 (Adapter Pattern — HeuristicLoader, DecryptionAdapter)
  - Constitution R15.3 (benchmark + provenance required)
  - Constitution R17, R20
  - Constitution R23 (kill criteria)
---

# Feature Specification: Phase 6 — Heuristic KB Engine

> **Summary (~150 tokens):** The heuristic engine. **9 MVP engine tasks** (T101, T102, T106-T112; T103-T105 content authoring deferred to Phase 0b per PRD F-012 amendment + agreed scope). Defines `HeuristicSchema` (base per §9.1) + `HeuristicSchemaExtended` (with §9.10 forward-compat fields: `version`, `rule_vs_guidance`, `business_impact_weight`, `effort_category`, `preferred_states`, `status`), `HeuristicKnowledgeBase` container, `HeuristicLoader` (R6 IP boundary — content never leaves in-memory KB outside LLM evaluate prompt), two-stage filter (`filterByBusinessType` Stage 1 → `filterByPageType` Stage 2 → `prioritizeHeuristics` top 30), encryption-stub `DecryptionAdapter` (AES-256-GCM concrete deferred to v1.1), tier validator, and Phase 6 integration test against synthetic test heuristics. **First runtime activation of R6 IP protection** — Pino redaction + grep tests enforce.

**Feature Branch:** `phase-6-heuristics` (created at implementation time)
**Input:** Phase 6 scope from `docs/specs/mvp/phases/INDEX.md` row 6 + `tasks-v2.md` T101-T112 (engine subset; T103-T105 deferred to Phase 0b)

---

## Mandatory References

1. `docs/specs/mvp/constitution.md` — R5 (R5.4 heuristics filtered BEFORE LLM call; R5.5 injected in user message); R6 (R6.1 never in API/dashboard/logs/traces; R6.2 AES-256-GCM at rest — deferred to v1.1; R6.3 LangSmith redaction; R6.4 no full heuristic JSON in console/files); R9 (HeuristicLoader, DecryptionAdapter); R15.3 (every heuristic MUST have benchmark AND provenance block — R15.3.1 fields: source_url, citation_text, draft_model, verified_by, verified_date).
2. `docs/specs/mvp/PRD.md` §F-012 (heuristic KB scope) + 2026-04-26 amendment (LLM-assisted authoring in Phase 0b — Phase 6 is the engine that LOADS the content Phase 0b produces).
3. `docs/specs/mvp/architecture.md` §6.4 (Sharp not used here; no new external deps in Phase 6) + §6.5 (`packages/agent-core/src/analysis/heuristics/`).
4. `docs/specs/mvp/tasks-v2.md` T101-T112 — note T103-T105 belong to Phase 0b workstream.
5. `docs/specs/final-architecture/09-heuristic-kb.md` — §9.1 base schema + §9.10 extensions (REQ-HK-EXT-001..019, REQ-HK-EXT-050) + §9.6 two-stage filtering (REQ-HK-020a, REQ-HK-020b).
6. Phase 4 spec (Pino logger + redaction patterns; HeuristicLoader extends them).

---

## Constraints Inherited from Neural Canonical Specs

- **No new external deps.** Phase 6 is pure TypeScript + Zod + Pino + Vitest using Phase 0+4 infrastructure. AES-256-GCM concrete crypto deferred to v1.1; Phase 6 ships interface + plaintext stub.
- **R6.1 IP protection** — heuristic content (rule text, benchmark values, principle source attributions) NEVER appears in: API responses, dashboard pages, Pino logs (only IDs), LangSmith traces (redact fields), error messages. **Phase-by-phase channel activation (R6 enforcement):** Phase 6 activates the **Pino-logs channel** here (loader discipline + redaction config + transport-spy conformance test); Phase 7 EvaluateNode activates the **LangSmith trace channel** (mark heuristic fields as private metadata); Phase 8 + Phase 9 activate the **API response + dashboard channels** (no heuristic body in any Hono route response or Next.js page render). Phase 6 doesn't enforce the latter three because it doesn't expose them — it ships the *shape* (typed FilteredHeuristics) that downstream phases must redact at their respective seams. Conformance test in Phase 6: Pino transport spy captures all log entries during a fixture load + filter cycle; assert NO heuristic content strings appear in serialized log output. Grep test: `packages/agent-core/src/analysis/heuristics/` source file SHALL NOT contain any heuristic body text outside test fixtures.
- **R6.2 AES-256-GCM at rest** — DEFERRED to v1.1 per PRD §3.2 (pre-first-pilot). Phase 6 ships `DecryptionAdapter` interface with a `PlaintextDecryptor` impl that returns input unchanged (MVP uses unencrypted heuristics-repo/ since it's a private repo). v1.1 plugs `AES256GCMDecryptor` against the same interface.
- **R6.3 LangSmith redaction** — Phase 6 doesn't directly emit LangSmith traces; Phase 7 EvaluateNode does. But the shape Phase 6 hands off (filtered heuristics for the LLM user message) MUST mark fields private per LangSmith metadata feature so Phase 7 can pass-through redaction. Documented as forward contract.
- **R6.4 no full heuristic JSON in console/files** — Pino redaction config + R10.6 enforcement. **Redaction-pattern → BenchmarkSchema mapping (per analyze F006):** the Pino redact paths cover the Zod discriminated-union shape: `*.body` matches the heuristic body text; `*.benchmark.value` matches the **quantitative** branch's measurement field; `*.benchmark.standard_text` matches the **qualitative** branch's reference text; `*.benchmark.unit` and `*.benchmark.metric` also redacted (revealing units leaks IP context). Concretely the Pino config registers:`['*.body', '*.benchmark.value', '*.benchmark.standard_text', '*.benchmark.unit', '*.benchmark.metric', '*.provenance.citation_text']`. Provenance fields like `source_url` / `verified_by` are NOT redacted (they're public metadata, not IP). Conformance test asserts each redaction path is honored against fixtures from both benchmark branches.
- **R5.4 Two-stage filter BEFORE LLM** — Phase 6 implements both stages: Stage 1 in audit_setup-equivalent (Phase 8 wires; Phase 6 just provides the function), Stage 2 in page_router-equivalent. Filter is deterministic code (NOT LLM-judgment).
- **R5.5 Heuristic injection in LLM user message** — Phase 7 consumes Phase 6's filtered output and serializes it into the user message. Phase 6 produces a typed `FilteredHeuristics` shape ready for that consumption. NOT system prompt; NOT tool calls.
- **R15.3 benchmark + provenance required** — every loaded heuristic MUST have: (a) `benchmark` (quantitative or qualitative per §9.10); (b) `provenance` block with all 5 fields per R15.3.1. Loader rejects heuristics missing either with typed error; conformance test asserts.
- **R15.3.1 provenance fields** — `source_url`, `citation_text`, `draft_model` (LLM model OR `"human"`), `verified_by` (human verifier name), `verified_date` (ISO-8601). Phase 6 schema enforces all 5 as required (not optional).
- **R15.3.2 human verification** — when `draft_model !== "human"`, a manual benchmark re-derivation is REQUIRED before the heuristic is committable to Phase 0b. This is a Phase 0b workflow gate, NOT a Phase 6 runtime check (Phase 6 just trusts the loaded heuristic's provenance fields).
- **R9 adapter** — `HeuristicLoader` interface is the boundary; `FileSystemHeuristicLoader` is the MVP impl loading from `heuristics-repo/` directory. `DecryptionAdapter` is the second new adapter (PlaintextDecryptor impl). v1.1 may add `EncryptedFileHeuristicLoader` or composition.
- **No `console.log`** (R10.6) — Pino with new correlation: `heuristic_loader_session_id`, `kb_size`, `filter_stage`. **Crucially:** correlation fields are non-IP metadata (counts, IDs, timings) — not heuristic content.
- **No `any` without TODO+issue** (R2.1).
- **Files < 300 lines, functions < 50 lines** — heuristic types file may approach 300 (Extended schema is large per §9.10); split if exceeds.

---

## User Scenarios & Testing

### User Story 1 — Phase 7 EvaluateNode loads filtered heuristics ready for LLM injection (Priority: P1) 🎯 MVP

The Phase 8 orchestrator (audit_setup) calls `HeuristicLoader.loadAll()` once per audit; Stage 1 filter (`filterByBusinessType`) reduces by business type. Per page, Stage 2 (`filterByPageType`) reduces further. `prioritizeHeuristics` caps at 30. Result handed to Phase 7 EvaluateNode for LLM user-message injection. **No heuristic content escapes the in-memory KB.**

**Why this priority:** Single user story for Phase 6. Without working KB, Phase 7 evaluate cannot produce findings.

**Independent Test:** `pnpm -F @neural/agent-core test integration/phase6` against synthetic test heuristics (in `tests/fixtures/heuristics/`).

**Acceptance Scenarios:**

1. **Given** a `heuristics-repo/` directory with synthetic Baymard + Nielsen + Cialdini test files (3 files, ~10 heuristics each), **When** `HeuristicLoader.loadAll()` runs, **Then** all heuristics validate against `HeuristicSchemaExtended`; loader returns a typed `HeuristicKnowledgeBase` with each heuristic indexed by `id`.
2. **Given** a heuristic missing `benchmark` OR `provenance` field, **When** loader processes it, **Then** loader rejects with `HeuristicValidationError` listing the heuristic_id + missing field; KB does NOT include the rejected entry.
3. **Given** `filterByBusinessType(kb, 'ecommerce')` runs on ~100 heuristics, **When** filter completes, **Then** result count is 60-70 (per §9.6 acceptance); `business_type === 'ecommerce'` heuristics retained, `b2b`/`saas`-only excluded.
4. **Given** Stage 1 result + page_type='checkout', **When** `filterByPageType(stage1, 'checkout')` runs, **Then** result count is 15-20; only heuristics applicable to checkout page type retained.
5. **Given** Stage 2 result + cap=30, **When** `prioritizeHeuristics(stage2, 30)` runs, **Then** result is at most 30 entries, ordered by `business_impact_weight` descending.
6. **Given** the loaded KB, **When** the orchestrator emits any Pino log line during the load + filter cycle, **Then** **NO heuristic body text** appears in the captured log output (R6.4 conformance test asserts via transport spy).
7. **Given** a heuristic with `draft_model: 'claude-sonnet-4-...'` (LLM-drafted per Phase 0b), **When** Phase 6 loads it, **Then** loader trusts the `verified_by` + `verified_date` fields (Phase 0b's verification responsibility) and includes the heuristic in the KB.
8. **Given** `DecryptionAdapter` interface with `PlaintextDecryptor` impl, **When** loader processes a JSON file in MVP (unencrypted), **Then** decryptor returns input unchanged. v1.1 will plug `AES256GCMDecryptor` against the same interface.
9. **Given** `TierValidator.validate(heuristic)` runs on every loaded heuristic, **When** classification is `Tier 1` (visual/structural, > 75% reliable), `Tier 2` (content/persuasion, ~60%), or `Tier 3` (subjective), **Then** heuristic is admitted; otherwise rejected.
10. **Given** the Phase 6 integration test, **When** it runs against synthetic test heuristics, **Then** all 10 ACs pass within 30 s wall-clock.

### Edge Cases

- **Empty `heuristics-repo/`:** loader returns empty KB without error; Phase 7 evaluate-stage will gracefully report "no applicable heuristics" rather than crash.
- **Malformed JSON in a heuristic file:** loader logs the file path + error class (NOT content); admits other valid files; conformance test verifies partial-load doesn't crash.
- **Heuristic with `status: 'archived'`:** loader admits but filter excludes (status filter applies post-load).
- **`preferred_states` field references state pattern that doesn't exist** (e.g., `pattern_id: 'nonexistent'`): loader admits the heuristic (validates schema-shape only); runtime stage-exploration (Phase 8 §33a) handles the missing pattern as a no-op rather than an error.
- **Encryption / decryption failure** (v1.1): `DecryptionAdapter` throws; loader logs heuristic_id + error class; admits other valid files.
- **Provenance with `draft_model` but no `verified_by`:** R15.3.2 requires verification when LLM-drafted. Phase 6 schema marks both as required; absence rejects the heuristic. Phase 0b workflow ensures both are populated before commit.

---

## Acceptance Criteria *(stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked task |
|----|-----------|----------------------|-------------|
| AC-01 | `HeuristicSchema` (base) Zod validates fixtures conforming to §9.1 | `tests/conformance/heuristic-schema-base.test.ts` | T101 |
| AC-02 | `HeuristicSchemaExtended` validates fixtures with all §9.10 fields (version, rule_vs_guidance, business_impact_weight, effort_category, preferred_states, status) + R15.3.1 provenance block; rejects entries missing benchmark OR provenance | `tests/conformance/heuristic-schema-extended.test.ts` | T101 |
| AC-03 | `HeuristicKnowledgeBase` container schema indexes heuristics by `id`; provides `get`, `list`, `byBusinessType`, `byPageType` query helpers | `tests/conformance/kb-container.test.ts` | T102 |
| AC-04 | `HeuristicLoader.loadAll()` reads from `heuristics-repo/` directory; rejects malformed entries; returns typed KB; logs only IDs (R6 conformance) | `tests/conformance/heuristic-loader.test.ts` + `tests/conformance/r6-ip-boundary.test.ts` (Pino transport spy) | T106 |
| AC-05 | `filterByBusinessType(kb, businessType)` reduces ~100 → ~60-70 per §9.6 (REQ-HK-020a) | `tests/conformance/filter-business-type.test.ts` | T107 |
| AC-06 | `filterByPageType(stage1, pageType)` reduces ~60-70 → ~15-20 per §9.6 (REQ-HK-020b) | `tests/conformance/filter-page-type.test.ts` | T107 |
| AC-07 | `prioritizeHeuristics(stage2, 30)` caps at 30 entries, ordered by `business_impact_weight` descending; tie-break by `id` for determinism | `tests/conformance/prioritize.test.ts` | T107 |
| AC-08 | `DecryptionAdapter` interface accepts `PlaintextDecryptor` (MVP) impl; loader composes with adapter; conformance test injects a fixture-`MockDecryptor` to verify the seam | `tests/conformance/decryption-adapter.test.ts` | T108 |
| AC-09 | `TierValidator.validate(heuristic)` admits Tier 1/2/3; rejects unclassified; conformance test covers all 3 valid tiers + 1 invalid | `tests/conformance/tier-validator.test.ts` | T109 |
| AC-10 | Phase 6 integration test runs full load + filter + prioritize cycle on synthetic heuristics; total wall-clock < 30 s; all 10 ACs pass; **R6 enforcement**: Pino transport spy confirms no heuristic content in any log line | `tests/integration/phase6.test.ts` | T112 (Phase 6 integration test; sub-tasks T110-T111 are helpers) |
| AC-11 | `HeuristicLoader.loadForContext(profile: ContextProfile)` reads `business.archetype`, `page.type`, `traffic.device_priority` from the profile; matches against heuristic manifest fields `archetype` / `page_type` / `device`; returns 12-25 heuristics for typical contexts (D2C/PDP/mobile, SaaS/pricing/desktop, B2B/comparison/balanced, lead_gen/landing/mobile). **No weight modifiers** — filter only (Phase 13b master adds weights). **Phase 4b T4B-013 owns implementation; Phase 6 v0.3 owns the contract.** | `tests/conformance/heuristic-loader-context-filter.test.ts` (lives in Phase 4b deliverable; cross-references Phase 6 contract) | T4B-013 (Phase 4b) — Phase 6 v0.3 documents the contract |

AC-NN IDs append-only per Constitution R18 — AC-11 added in v0.3.

---

## Functional Requirements

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST define `HeuristicSchema` (base per §9.1) + `HeuristicSchemaExtended` (with §9.10 fields + R15.3.1 provenance) Zod schemas | F-012 | 09-heuristic-kb.md §9.1 + §9.10 |
| R-02 | System MUST define `HeuristicKnowledgeBase` container schema with query helpers | F-012 | 09-heuristic-kb.md |
| R-03 | System MUST implement `HeuristicLoader` interface + `FileSystemHeuristicLoader` impl (R9 adapter) | F-012 | 09-heuristic-kb.md |
| R-04 | System MUST enforce R6 IP boundary in HeuristicLoader: no heuristic content in any Pino log line; only IDs and metadata (counts, timings) logged | F-012 + R6.1/R6.4 | constitution.md R6 |
| R-05 | System MUST implement two-stage filter per REQ-HK-020a/020b (`filterByBusinessType` + `filterByPageType` + `prioritizeHeuristics`) | F-012 + R5.4 | 09-heuristic-kb.md §9.6 |
| R-06 | System MUST implement `DecryptionAdapter` interface (PlaintextDecryptor MVP impl; AES-256-GCM v1.1 deferred) | F-012 + R6.2 | constitution.md R6.2 (deferred) |
| R-07 | System MUST implement `TierValidator` for Tier 1/2/3 classification | F-012 | 09-heuristic-kb.md (tier model) |
| R-08 | System MUST provide Phase 6 integration test against synthetic test heuristics | F-012 acceptance | (integration test) |
| R-09 | System MUST extend `HeuristicLoader` with `loadForContext(profile: ContextProfile)` that filters heuristics by `business.archetype` + `page.type` + `traffic.device_priority` from the profile. Manifest selectors `archetype` / `page_type` / `device` are added to `HeuristicSchemaExtended`. Returns 12-25 heuristics for typical contexts. **Filter only** — no weight modifiers (Phase 13b master). **Phase 4b T4B-013 owns the implementation deliverable; Phase 6 v0.3 documents the contract surface.** | F-012 + F-006 | 09-heuristic-kb.md + 37-context-capture-layer.md §37.5 |

---

## Non-Functional Requirements

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| NF-Phase6-01 | Loader wall-clock for ~100 heuristics | < 1 s | Pino timing |
| NF-Phase6-02 | Two-stage filter wall-clock | < 50 ms (in-memory) | Pino timing |
| NF-Phase6-03 | Phase 6 integration test wall-clock | < 30 s | Vitest |
| NF-Phase6-04 | R6 boundary enforcement | 100% — zero heuristic-content occurrences in log output | Pino transport spy |

---

## Key Entities

- **`HeuristicSchema`** + **`HeuristicSchemaExtended`** (NEW shared) — Zod schemas; consumed by Phase 7 EvaluateNode for typed access.
- **`HeuristicKnowledgeBase`** (NEW shared) — in-memory container; query helpers.
- **`HeuristicLoader`** (NEW adapter contract; first MVP impl FileSystemHeuristicLoader) — IP boundary; R6 enforced at this seam.
- **`HeuristicFilter`** (NEW shared) — two-stage `filterByBusinessType` + `filterByPageType` + `prioritizeHeuristics` pure functions.
- **`TierValidator`** (NEW shared) — Tier 1/2/3 classifier.
- **`DecryptionAdapter`** (NEW adapter contract; PlaintextDecryptor MVP impl) — encryption seam for v1.1.

See impact.md.

---

## Success Criteria

- **SC-001:** All 10 ACs pass on synthetic test heuristics within 30 s.
- **SC-002:** R6 IP boundary verified: zero heuristic content in any test-captured Pino log line.
- **SC-003:** Forward-compat: Phase 7 EvaluateNode consumes Phase 6's filtered output without Phase 6 code changes (additive only).
- **SC-004:** v1.1 can plug AES-256-GCM via `DecryptionAdapter` without HeuristicLoader code changes.
- **SC-005:** Phase 0b heuristic content (T103-T105) loads cleanly via the same loader once it lands (forward dependency on Phase 0b session).

---

## Constitution Alignment Check

- [x] R5.3 — N/A (no findings in Phase 6)
- [x] R5.4 two-stage filter BEFORE LLM — implemented per §9.6
- [x] R5.5 LLM user message injection — Phase 6 produces ready-to-inject form (Phase 7 consumes)
- [x] R6.1-R6.4 IP boundary — first runtime enforcement; conformance test via Pino transport spy
- [x] R6.2 AES-256-GCM at rest — interface ready; concrete deferred to v1.1 per PRD §3.2 (intentional, not violation)
- [x] R7.1/R7.2/R7.4 — N/A (no DB writes in Phase 6 — KB is in-memory)
- [x] R9 adapter — HeuristicLoader + DecryptionAdapter (4th and 5th adapter categories)
- [x] R13 Forbidden Patterns: temperature=0 invariant on evaluate/self_critique/evaluate_interactive (constitution.md §13 line 411; `(R10)` was a stale xref per note_on_stale_xref) — N/A (no LLM in Phase 6)
- [x] R15.3 benchmark + provenance — schema enforces both as required
- [x] R20 impact.md — REQUIRED, MEDIUM risk, 7 contracts; authored
- [x] R23 kill criteria — default + per-task on T106 (HeuristicLoader — R6 IP boundary critical) + T107 (filter — must match §9.6 reduction targets)

---

## Out of Scope

- T103-T105 heuristic content authoring (50 Baymard + 35 Nielsen + 15 Cialdini) — **Phase 0b workstream**, deferred this session per PRD F-012 amendment
- AES-256-GCM concrete decryption — v1.1 (interface ready in MVP)
- LLM evaluate / self_critique nodes consuming filtered heuristics — Phase 7
- LangSmith trace integration — Phase 7 (Phase 6 documents the redaction-pass-through contract)
- Heuristic content updates / hot-reload — post-MVP
- Multi-language heuristics — post-MVP

---

## Assumptions

- **Phase 0b produces the heuristic content** — Phase 6 ships a directory layout convention (`heuristics-repo/<source>.json`); Phase 0b populates per F-012 amendment workflow.
- **Synthetic test heuristics** in `packages/agent-core/tests/fixtures/heuristics/` mirror the Phase 0b shape (10 fixture heuristics covering all schema fields + 3 negative-case fixtures missing benchmark/provenance).
- **Private heuristics-repo/ in MVP** — not encrypted at rest; AES-256-GCM v1.1. Repo lives in the project structure but is gitignored from public consumption (handled at deploy time, not by Phase 6 code).
- **R6 conformance via Pino transport spy** — test mode swaps Pino's transport for an in-memory spy; assertions check captured log lines.
- **Phase 7 forward contract** — Phase 6 outputs a typed `FilteredHeuristics` shape (id + body + benchmark + provenance) that Phase 7 EvaluateNode serializes into the user message. The shape is locked in Phase 6's impact.md.

---

## Next Steps

1. impact.md authored (R20 — MEDIUM risk).
2. plan.md drafted.
3. tasks.md drafted (9 MVP engine tasks; T103-T105 declared as Phase 0b deferred).
4. /speckit.analyze (Explore subagent).
5. Phase 6 implementation in a separate session.

---

## Cross-references

- Phase 4 spec, impact (Pino redaction infra; LLMAdapter for Phase 7's downstream consumption)
- `docs/specs/mvp/tasks-v2.md` T101-T112
- `docs/specs/final-architecture/09-heuristic-kb.md` §9.1, §9.6, §9.10
- `docs/specs/mvp/PRD.md` §F-012 + 2026-04-26 amendment
- `docs/specs/mvp/constitution.md` R5.4, R5.5, R6, R9, R15.3, R20, R23
