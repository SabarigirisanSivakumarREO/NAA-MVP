---
title: Phase 0b — Heuristic Authoring (LLM-Assisted, Engineering-Owned)
artifact_type: spec
status: approved
version: 0.3
created: 2026-04-28
updated: 2026-04-30
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (F-012 v1.2 amendment 2026-04-26 — LLM-assisted authoring; reduces MVP count to 30)
  - docs/specs/mvp/constitution.md (R6 IP — focal; R15.3 benchmark + provenance required; R15.3.1 provenance fields; R15.3.2 human verification; R15.3.3 LLM-drafted content is still IP; R11 spec discipline; R20 impact; R22 ratchet; R23 kill criteria)
  - docs/specs/mvp/architecture.md (§6.4 tech stack — no new vendor deps; §6.5 file locations — heuristics-repo/)
  - docs/specs/mvp/tasks-v2.md (T103-T105 canonical task definitions; Phase 0b section in v2.3.3+ adds T0B-001..T0B-005)
  - docs/specs/mvp/examples.md §10 (✅ GOOD / ❌ BAD heuristic JSON examples)
  - docs/specs/final-architecture/09-heuristic-kb.md §9.1 (HeuristicSchema base) + §9.10 (extensions: version, rule_vs_guidance, business_impact_weight, effort_category, preferred_states, status)
  - docs/specs/mvp/phases/phase-6-heuristics/spec.md (HeuristicSchemaExtended Zod schema is the validation gate)
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md (T4B-013 manifest selectors: archetype / page_type / device)

req_ids:
  - REQ-HK-001                 # base schema
  - REQ-HK-EXT-001             # extended schema fields
  - REQ-HK-EXT-019             # preferred_states
  - REQ-HK-BENCHMARK-001       # benchmark required
  - REQ-HK-BENCHMARK-002       # quantitative benchmarks for structural
  - REQ-HK-BENCHMARK-003       # qualitative benchmarks for content/persuasion
  - REQ-CONTEXT-DOWNSTREAM-001 # manifest selectors for loadForContext()

impact_analysis: docs/specs/mvp/phases/phase-0b-heuristics/impact.md
breaking: false
affected_contracts:
  - heuristics-repo/*.json content (NEW deliverables, NOT new contract)
  - HeuristicSchemaExtended (CONSUMER only — schema itself locked in Phase 6)

delta:
  new:
    - Phase 0b spec — engineering-owned LLM-assisted authoring workflow + 30-heuristic MVP pack
    - AC-01..AC-15 stable IDs for T0B-001..T0B-005 + T103/T104/T105 acceptance
    - R-01..R-12 functional requirements
  changed:
    - v0.1 → v0.2 applied 6 analyze-driven fixes (M1: R-01 business_types→archetype terminology drift; M2: AC-13 R6 conformance test scope expanded to 5 channels; M3: drafting-subprocess R9 exemption formally documented in Assumptions per R22.2 pattern; M4: NF-01/NF-02 marked observation-only; L2: Pino-vs-CLI wording clarified in Constraints Inherited; L4: AC-01 fixture path pointed at examples.md §10)
    - v0.2 → v0.3 — status bumped draft → approved (R17.4 review approved per phase-0b-heuristics/review-notes.md; 3 polish conditions captured — D1 binding for T0B-004 lint CLI Zod-error redaction; D2 binding for T0B-005 README human-protocol R6 boundary doc; D3 optional pre-commit hook for `.heuristic-drafts/`)
  impacted:
    - Phase 6 implementation unblocked (engine has content to validate + load in T112 integration test)
    - Phase 7 EvaluateNode consumes the 30-heuristic pack via `HeuristicLoader.loadForContext()` filter
    - tasks-v2.md v2.3.2 → v2.3.3 (add Phase 0b section + reduce T103-T105 counts to 15/10/5 per F-012 v1.2)
  unchanged:
    - HeuristicSchemaExtended Zod fields (locked by Phase 6 v0.3)
    - Constitution R6 IP boundary (Phase 0b reuses Phase 6's Pino redaction config + grep test)

governing_rules:
  - Constitution R6 (IP protection — LLM-drafted heuristic content is still IP per R15.3.3)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R15.3 (benchmark + provenance both required for Zod validation)
  - Constitution R15.3.1 (5 provenance fields)
  - Constitution R15.3.2 (human verification mandatory for LLM-drafted heuristics)
  - Constitution R15.3.3 (drafting LLM responses MUST NOT be logged to LangSmith / Pino / dashboard)
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R20 (Impact Analysis)
  - Constitution R22 (Ratchet — every claim cites a source)
  - Constitution R23 (Kill Criteria — content quality gate)
---

# Feature Specification: Phase 0b — Heuristic Authoring

> **Summary (~150 tokens — agent reads this first):** Stand up the LLM-assisted heuristic authoring workstream and ship the 30-heuristic MVP knowledge base. **Engineering-owned per PRD F-012 v1.2 amendment (2026-04-26)** — replaces the deferred CRO-parallel track. Eight tasks: T0B-001 (drafting prompt template) → T0B-002 (verification protocol per R15.3.2) → T0B-003 (PR Contract Proof block extension per PRD §10.9) → T0B-004 (`pnpm heuristic:lint` CLI helper) → T0B-005 (`heuristics-repo/README.md` onboarding doc) → T103 (~15 Baymard heuristics) → T104 (~10 Nielsen heuristics) → T105 (~5 Cialdini heuristics). Every heuristic JSON file carries `benchmark` (quantitative or qualitative) AND `provenance` (`source_url`, `citation_text`, `draft_model`, `verified_by`, `verified_date`) AND manifest selectors (`archetype`/`page_type`/`device`) consumed by Phase 4b T4B-013 `loadForContext()`. R6 IP discipline applies regardless of author — drafting LLM responses MUST NOT touch LangSmith / Pino / dashboard.

**Feature Branch:** master (spec authoring; per phase-0..phase-6 convention)
**Input:** PRD F-012 v1.2 amendment + Phase 6 v0.3 contract surface (HeuristicSchemaExtended) + Phase 4b T4B-013 manifest selectors

---

## Mandatory References

When reading this spec, agents must already have loaded:

1. `docs/specs/mvp/constitution.md` — **R6** (IP protection — focal); **R15.3** (benchmark + provenance both required); **R15.3.1** (5 provenance fields: `source_url`, `citation_text`, `draft_model`, `verified_by`, `verified_date`); **R15.3.2** (human verifier MUST manually re-derive benchmark within ±20% quantitative or text-reference qualitative BEFORE commit); **R15.3.3** (LLM-drafted heuristic content is still IP — drafting prompts + responses MUST NOT be logged to LangSmith / Pino / dashboard / API / error messages); **R11** (spec discipline); **R20** (impact); **R23** (kill criteria).
2. `docs/specs/mvp/PRD.md` §4 F-012 (Heuristic Knowledge Base — 30 heuristics MVP per v1.2 amendment) + §10.9 (PR Contract — Proof block must include verification evidence).
3. `docs/specs/mvp/examples.md` §10 (heuristic authoring examples — ✅ GOOD quantitative + qualitative + ❌ BAD).
4. `docs/specs/final-architecture/09-heuristic-kb.md` — §9.1 (HeuristicSchema base — `id`, `source`, `category`, `name`, `severity_if_violated`, `reliability_tier`, `detection`, `recommendation`, `benchmark`); §9.10 (extensions — `version`, `rule_vs_guidance`, `business_impact_weight`, `effort_category`, `preferred_states`, `status`).
5. `docs/specs/mvp/phases/phase-6-heuristics/spec.md` — HeuristicSchemaExtended Zod schema is the runtime validation gate; AC-11/R-09 v0.3 contract for `loadForContext()`.
6. `docs/specs/mvp/phases/phase-4b-context-capture/spec.md` — T4B-013 `HeuristicLoader.loadForContext(profile)` filters by `archetype + page_type + device` (manifest selectors MUST appear on each heuristic).

---

## Constraints Inherited from Neural Canonical Specs

- **R6.1 IP protection (focal):** Heuristic content (rule text, benchmark values, principle attributions) NEVER appears in: API responses, dashboard pages, Pino logs (only IDs), LangSmith traces (redact fields), error messages. **R15.3.3 amendment:** LLM-drafted heuristic content is just as protected — drafting prompts and drafting LLM responses MUST NOT touch LangSmith / Pino / dashboard / API / error messages. Drafting happens in an isolated session (Claude Code subagent or separate Anthropic SDK call) with `langsmith_disable: true` (or absence of LangSmith API key) for the drafting subprocess. Drafting logs go to a local file under `.heuristic-drafts/` (gitignored).
- **R15.3 benchmark + provenance both REQUIRED.** HeuristicSchemaExtended Zod schema rejects heuristics missing either. Phase 6 loader fails fast — Phase 0b ships the content that satisfies the schema.
- **R15.3.1 provenance fields:** `source_url` (URL or stable reference to cited research, e.g., Baymard article URL, Nielsen page, Cialdini chapter reference), `citation_text` (verbatim excerpt from source supporting the heuristic + benchmark), `draft_model` (LLM identifier OR `"human"` if hand-authored), `verified_by` (human verifier name), `verified_date` (ISO-8601).
- **R15.3.2 human verification mandatory.** When `draft_model` is an LLM, a human verifier MUST manually re-derive the benchmark from `source_url` + `citation_text` and confirm match within ±20% (quantitative) or text-reference (qualitative) BEFORE commit. Verification is captured in the PR Contract Proof block (PRD §10.9).
- **F-012 spot-check acceptance.** Spot check: 5 random heuristics re-verified by a *different* human against the cited source URL; ≤1 may diverge (the diverging heuristic is rejected and re-authored).
- **Manifest selectors REQUIRED** per Phase 4b T4B-013: every heuristic MUST declare `archetype` (e.g., "ecommerce", "saas", "leadgen"), `page_type` (per `PageTypeEnum` in §9.1), and `device` ("desktop" | "mobile" | "both") in its manifest. T4B-013 `loadForContext(profile)` filters on these selectors; missing selectors = heuristic excluded from any context.
- **F-012 v1.2 amendment scope:** 30 heuristics total (≈15 Baymard + ≈10 Nielsen + ≈5 Cialdini). NOT 100 (which is §09.3 master target — defer to v1.1+). MVP authors the 30 most-leveraged.
- **No conversion predictions (R5.3 + GR-007).** Heuristic recommendation text MUST NOT predict "X% conversion lift" — even hypothetical. GR-007 deterministic regex check rejects findings that quote heuristics with banned phrasing; safer to ban it at authoring time.
- **No new external deps.** Drafting CLI is TypeScript + Zod + Anthropic SDK (already required for Phase 7); reuses Phase 6 HeuristicSchemaExtended for validation.
- **No server-side `console.log`** in production runtime code (R10.6). Lint CLI (T0B-004) uses `process.stdout.write` for user-facing output (R10.6 CLI exception, same as Phase 0 T003); Pino is NOT required since lint is a developer-time tool, not a server runtime path. Drafting subprocess (META tooling) writes transcripts to `.heuristic-drafts/` files; no Pino logger instantiation in drafting subprocess (R15.3.3 isolation; AC-13 enforces).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Engineer drafts a Baymard heuristic with LLM assistance and human verification (Priority: P1)

An engineer assigned T103 needs to author a Baymard checkout heuristic. They consult Baymard Institute's research on guest checkout, paste the relevant excerpt + URL into the drafting prompt template, and the LLM (Claude Sonnet 4) returns a draft `BAY-CHECKOUT-001.json` matching `HeuristicSchemaExtended`. The engineer then **manually opens the cited Baymard URL** and re-derives the benchmark: the draft says "≥48% of users abandon checkout when forced to register"; the source URL confirms "44.5% per Baymard 2024 — Checkout Form Field Study", which is within ±20%. Engineer fills `verified_by` + `verified_date`, runs `pnpm heuristic:lint heuristics-repo/baymard/BAY-CHECKOUT-001.json` (passes Zod + selector + provenance checks), commits with a PR Contract Proof block citing the verification.

**Why this priority:** This is the core path. Without it the entire MVP heuristic library is blocked.
**Independent Test:** Run the drafting prompt against a known Baymard excerpt; confirm output passes `pnpm heuristic:lint`; manually verify the cited benchmark; mark verified; commit.

**Acceptance Scenarios:**

1. **Given** a Baymard URL + excerpt about checkout form fields, **When** engineer runs the drafting prompt template (T0B-001), **Then** LLM returns a JSON draft populated with `id`, `source: "baymard"`, `category`, `name`, `severity_if_violated`, `reliability_tier`, `detection`, `recommendation`, `benchmark` (quantitative kind preferred for structural), `provenance.source_url`, `provenance.citation_text`, `provenance.draft_model: "claude-sonnet-4-..."`, plus `archetype`, `page_type`, `device` manifest selectors and §9.10 extended fields with safe defaults.
2. **Given** the drafted JSON, **When** engineer manually re-derives the benchmark from `source_url`, **Then** they confirm match within ±20% (quantitative) or text-reference (qualitative); fill `verified_by` + `verified_date`.
3. **Given** the verified JSON, **When** engineer runs `pnpm heuristic:lint <file>`, **Then** the linter passes (Zod + selectors + provenance + benchmark + R5.3 banned-phrase regex check).
4. **Given** the linter passes, **When** engineer opens a PR, **Then** the PR Contract Proof block (T0B-003 template) includes verification evidence (`verified_by`, `verified_date`, link to source URL, brief re-derivation note).

---

### User Story 2 — Different human spot-checks 5 random heuristics (Priority: P1)

After Phase 0b's first commit batch (~10 heuristics), a *different* engineer (not the original author) randomly picks 5 heuristics and re-verifies each against its cited `source_url`. F-012 acceptance requires ≤1 divergence; if 2+ diverge, the entire batch is rejected and the authoring workflow is paused for protocol review.

**Why this priority:** F-012 explicit acceptance criterion. Single-verifier risk is too high for IP-bearing content; cross-checker catches systematic prompt drift.
**Independent Test:** Designate a spot-check verifier; sample 5 random committed heuristics; record outcomes in a public checkout log; confirm ≤1 divergence.

**Acceptance Scenarios:**

1. **Given** 10+ committed heuristics, **When** spot-check verifier samples 5 random ones, **Then** each is re-verified against the cited source URL.
2. **Given** spot-check results, **When** ≤1 of 5 diverges, **Then** Phase 0b proceeds; diverging heuristic is rejected (re-drafted or removed).
3. **Given** spot-check results, **When** 2+ of 5 diverge, **Then** Phase 0b PAUSES; engineering lead reviews the drafting prompt + verification protocol for systematic drift.

---

### User Story 3 — Phase 6 loader validates Phase 0b output at runtime (Priority: P1)

When Phase 6 implementation begins, the integration test (T112) loads the entire `heuristics-repo/` and validates every JSON file against `HeuristicSchemaExtended`. All 30 heuristics MUST pass. Any fail → Phase 6 blocked until Phase 0b corrects the offending heuristic.

**Why this priority:** This is the runtime contract. If any Phase 0b heuristic fails the schema, Phase 6 cannot ship.
**Independent Test:** Phase 6 T112 integration test loads all 30 heuristics; assert all pass `HeuristicSchemaExtended.parse()`.

**Acceptance Scenarios:**

1. **Given** 30 committed heuristics in `heuristics-repo/`, **When** Phase 6 `HeuristicLoader.loadAll()` runs, **Then** all 30 parse successfully under `HeuristicSchemaExtended`.
2. **Given** the parsed set, **When** `HeuristicLoader.loadForContext(profile)` runs with a `{archetype: "ecommerce", page_type: "checkout", device: "mobile"}` ContextProfile, **Then** the filter returns 12-25 heuristics (Phase 4b T4B-013 acceptance).
3. **Given** any heuristic missing `benchmark` OR `provenance` OR `archetype`/`page_type`/`device` selectors, **When** loader runs, **Then** load FAILS with a clear Zod error citing the missing field path.

---

### Edge Cases

- **Source URL goes 404 between draft and verification.** Verifier MUST find an alternative stable reference (Wayback Machine, Baymard archive, Nielsen Norman article snapshot) and update `source_url` + re-derive benchmark. If no stable reference exists, REJECT the heuristic.
- **Quantitative benchmark drifts >±20% between draft and verification.** REJECT and re-draft; do NOT silently update the benchmark to match the LLM draft (that would defeat R15.3.2).
- **LLM draft includes banned phrasing** ("increase conversions by X%", "lift checkout completion by Y%"). Linter (T0B-004) deterministic regex check rejects; engineer re-drafts with a stricter prompt rider.
- **Two heuristics overlap semantically** (e.g., two Baymard heuristics both flag guest-checkout absence). Keep one; reject the other; document in a `_dedup-log.md` under `heuristics-repo/`.
- **Cialdini citation is a chapter reference, not a URL.** `source_url` accepts a stable text reference (e.g., `"Cialdini, R. (2007). Influence: The Psychology of Persuasion. HarperCollins. Chapter 5: Liking."`); `citation_text` carries the exact passage.
- **Heuristic spans multiple page_types** (e.g., trust-badge presence applies to checkout AND product). `page_type` field accepts an array; the manifest selector matches if any value matches the ContextProfile.
- **Heuristic applies device-agnostically.** `device: "both"` (default).
- **Drafting LLM hallucinates a Baymard URL.** Verifier MUST confirm the URL resolves AND the cited research exists at that URL (LLMs frequently fabricate Baymard URLs). REJECT if not verifiable.
- **Engineer re-runs drafting prompt with a slight rider after rejection.** Each re-draft MUST log a new `draft_model` + new `provenance.draft_revision` (optional field — not in schema, but recorded in `_drafting-log.md` outside repo).

---

## Acceptance Criteria *(mandatory — stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked REQ-ID(s) |
|----|-----------|----------------------|------------------|
| AC-01 | Drafting prompt template exists at `docs/specs/mvp/templates/heuristic-drafting-prompt.md` and produces a draft conforming to `HeuristicSchemaExtended` on the canonical fixture excerpts in `docs/specs/mvp/examples.md` §10 (✅ GOOD heuristic — Baymard checkout-form-fields excerpt as the smoke fixture). | manual review (no runtime test); T0B-001 owner runs the prompt on the §10 excerpt, confirms output passes `pnpm heuristic:lint`; template validated by T0B-005 onboarding doc | R15.3.1, R15.3.3 |
| AC-02 | Verification protocol document exists at `docs/specs/mvp/templates/heuristic-verification-protocol.md` covering ±20% quantitative match, text-reference qualitative match, source-URL liveness check, and reject-and-redraft workflow on divergence. | manual review | R15.3.2 |
| AC-03 | PR Contract Proof block extension (`docs/specs/mvp/templates/heuristic-pr-proof.md`) covers per-heuristic verification evidence: `verified_by` + `verified_date` + link to source URL + brief re-derivation note. Referenced from PRD §10.9 PR Contract template. | manual review; new heuristic PRs cited in Proof block | R15.3.2 |
| AC-04 | `pnpm heuristic:lint <file-or-glob>` CLI helper passes Zod parse against `HeuristicSchemaExtended`, validates all 5 `provenance` fields present + non-empty, validates `benchmark` discriminated union, validates `archetype`/`page_type`/`device` selectors present, runs deterministic R5.3/GR-007 banned-phrase regex check on `recommendation.summary` + `recommendation.details`. Exit code non-zero on any failure. | `apps/cli/tests/conformance/heuristic-lint.test.ts` | R15.3, R15.3.1, R5.3, GR-007 |
| AC-05 | `heuristics-repo/README.md` exists with: authoring workflow steps (draft → verify → lint → PR), R6 IP discipline reminders (no LangSmith / Pino / dashboard for drafting responses), spot-check protocol, and a link back to PRD §F-012 + Phase 0b spec. | manual review; first author follows it without engineering-lead clarification | R6, R15.3 |
| AC-06 | T103 ships ~15 Baymard heuristics, all passing `pnpm heuristic:lint`, distributed approximately as: 4 homepage, 4 PDP, 5 checkout, 2 cart, ≥1 mobile-specific. | `pnpm heuristic:lint heuristics-repo/baymard/*.json` | F-012, REQ-HK-001 |
| AC-07 | T104 ships ~10 Nielsen heuristics, all passing `pnpm heuristic:lint`, distributed approximately as: 4 visibility/feedback, 3 error prevention/recovery, 3 consistency/standards. | `pnpm heuristic:lint heuristics-repo/nielsen/*.json` | F-012, REQ-HK-001 |
| AC-08 | T105 ships ~5 Cialdini heuristics, all passing `pnpm heuristic:lint`, covering: social proof, scarcity, authority, reciprocity, liking. | `pnpm heuristic:lint heuristics-repo/cialdini/*.json` | F-012, REQ-HK-001 |
| AC-09 | All 30 heuristics carry the 5 `provenance` fields (`source_url`, `citation_text`, `draft_model`, `verified_by`, `verified_date`), each non-empty and ISO-formatted where applicable. | `pnpm heuristic:lint heuristics-repo/**/*.json` | R15.3.1 |
| AC-10 | All 30 heuristics carry a `benchmark` block (quantitative or qualitative discriminated union); 0 missing benchmarks. | `pnpm heuristic:lint heuristics-repo/**/*.json` | R15.3, REQ-HK-BENCHMARK-001 |
| AC-11 | All 30 heuristics carry manifest selectors (`archetype`, `page_type`, `device`) consumable by Phase 4b T4B-013 `loadForContext(profile)`; on a representative `{ecommerce, checkout, mobile}` ContextProfile the filter returns 12-25 heuristics. | `packages/agent-core/tests/integration/load-for-context-against-mvp-pack.test.ts` (Phase 4b) | REQ-CONTEXT-DOWNSTREAM-001 |
| AC-12 | F-012 spot-check passes: a *different* human re-verifies 5 random heuristics; ≤1 of 5 diverges. Spot-check log committed under `heuristics-repo/_spot-checks.md`. | manual review + signed log | F-012 |
| AC-13 | R6 IP boundary: drafting LLM responses are NOT logged to LangSmith / Pino / dashboard. Drafting subprocess uses isolated SDK call with no LangSmith key; drafting logs go to `.heuristic-drafts/` (gitignored). | `tests/conformance/r6-drafting-isolation.test.ts` asserts: (a) `.gitignore` contains `.heuristic-drafts/`; (b) drafting subprocess source files do NOT import `langsmith` / `@langsmith/*`; (c) drafting subprocess source files do NOT import `packages/agent-core/src/observability/*` (Pino logger module — grep on import graph); (d) drafting subprocess script is NOT imported by any `apps/` or `packages/` runtime module — grep on import graph; (e) `apps/dashboard/**/*` source does NOT reference drafting subprocess paths (R6 dashboard channel preserved) | R6.1, R15.3.3 |
| AC-14 | All 30 heuristics pass `HeuristicSchemaExtended.parse()` when Phase 6's `HeuristicLoader.loadAll()` runs in T112 integration test. (Cross-phase acceptance — Phase 6 owns the test; Phase 0b is the producer.) | `packages/agent-core/tests/integration/phase6.test.ts` (Phase 6 T112) | REQ-HK-001, REQ-HK-EXT-001 |
| AC-15 | No heuristic `recommendation.summary` or `recommendation.details` matches the GR-007 banned-phrase regex (e.g., `/(increase|lift|boost|raise|grow|improve)\s+(conversion|conversions|CR|cr)\s+by\s+\d+%/i`); linter rejects on match. | included in T0B-004 linter; AC-04 covers test path | R5.3, GR-007 |

---

## Functional Requirements *(mandatory — cross-ref existing PRD F-IDs where applicable)*

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System SHALL provide a drafting prompt template (T0B-001) at `docs/specs/mvp/templates/heuristic-drafting-prompt.md` accepting `{source, source_url, citation_text, page_types, archetype, device}` inputs and instructing the LLM to produce a JSON object conforming to `HeuristicSchemaExtended` with all required fields populated and a placeholder `verified_by: ""` + `verified_date: ""` awaiting human input. | F-012 | §09.1, §09.10 |
| R-02 | System SHALL provide a verification protocol document (T0B-002) at `docs/specs/mvp/templates/heuristic-verification-protocol.md` codifying R15.3.2: human verifier opens `source_url`, finds the cited passage, re-derives the benchmark, confirms ±20% match (quantitative) or text-reference (qualitative), fills `verified_by` + `verified_date`. Includes reject-and-redraft workflow on divergence. | F-012 | — (constitution R15.3.2) |
| R-03 | System SHALL extend the PR Contract Proof block template (T0B-003) per PRD §10.9 to require per-heuristic verification evidence: `verified_by` name, `verified_date`, link to `source_url`, and a brief (1-2 sentence) re-derivation note. | F-012 | PRD §10.9 |
| R-04 | System SHALL provide a `pnpm heuristic:lint <file-or-glob>` CLI helper (T0B-004) that: (a) parses files against `HeuristicSchemaExtended`; (b) verifies all 5 `provenance` fields non-empty; (c) verifies `benchmark` discriminated union present and well-formed; (d) verifies manifest selectors `archetype` + `page_type` + `device` present; (e) runs deterministic R5.3/GR-007 banned-phrase regex check on `recommendation.summary` + `recommendation.details`. Exit non-zero on any failure. | F-012 | §09.1, §09.10 |
| R-05 | System SHALL ship `heuristics-repo/README.md` (T0B-005) covering: authoring workflow (draft → verify → lint → PR), R6 IP discipline (drafting LLM responses NOT to LangSmith/Pino/dashboard; use isolated subprocess), spot-check protocol, link back to PRD §F-012 and Phase 0b spec. | F-012 | — |
| R-06 | System SHALL ship ~15 Baymard heuristics (T103) under `heuristics-repo/baymard/*.json` distributed across homepage / PDP / checkout / cart / mobile categories per F-012 v1.2 amendment scope. | F-012 | §09.1 |
| R-07 | System SHALL ship ~10 Nielsen heuristics (T104) under `heuristics-repo/nielsen/*.json` covering visibility/feedback, error prevention/recovery, consistency/standards. | F-012 | §09.1 |
| R-08 | System SHALL ship ~5 Cialdini heuristics (T105) under `heuristics-repo/cialdini/*.json` covering social proof, scarcity, authority, reciprocity, liking. | F-012 | §09.1 |
| R-09 | Every committed heuristic SHALL declare manifest selectors `archetype` (string from BusinessTypeEnum), `page_type` (single value or array from PageTypeEnum), `device` ("desktop" \| "mobile" \| "both") consumable by Phase 4b T4B-013 `HeuristicLoader.loadForContext(profile)`. | F-012 | §09.1, REQ-CONTEXT-DOWNSTREAM-001 |
| R-10 | Every committed heuristic SHALL carry the `benchmark` discriminated union (quantitative XOR qualitative); structural heuristics MUST use quantitative; content/persuasion heuristics MUST use qualitative. | F-012 | REQ-HK-BENCHMARK-002, REQ-HK-BENCHMARK-003 |
| R-11 | Every committed heuristic SHALL carry the 5 `provenance` fields per R15.3.1: `source_url`, `citation_text`, `draft_model`, `verified_by`, `verified_date`. LLM-drafted heuristics SHALL set `draft_model` to the model identifier (e.g., `"claude-sonnet-4-20250514"`); hand-authored to `"human"`. | F-012 | R15.3.1 |
| R-12 | Drafting subprocess SHALL be isolated from observability infrastructure: no LangSmith trace, no Pino logging of drafting prompts or responses; drafting logs (if needed for debugging) go to `.heuristic-drafts/` which `.gitignore` SHALL include. | F-012 | R6.1, R15.3.3 |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-01 | Total drafting cost across 30 heuristics | ≤$15 (observation-only target — no automated gate; kill criterion fires at >$25 per plan.md §7) | NF-002 (cost) | sum of Anthropic SDK call costs in `.heuristic-drafts/_cost-log.json` (local; not LangSmith); manual review against target |
| NF-02 | Per-heuristic drafting + verification time | ≤45 minutes p50 (observation-only target — no automated gate; kill criterion fires at >90 min p50 per plan.md §7) | — | engineer log under `heuristics-repo/_authoring-time-log.md` (sampled, not exhaustive); manual observation against target |
| NF-03 | F-012 spot-check divergence rate | ≤1 of 5 (≤20%) | — | spot-check log `heuristics-repo/_spot-checks.md` |
| NF-04 | `pnpm heuristic:lint` runtime against full 30-heuristic pack | ≤2 seconds | — | CLI integration test timer |
| NF-05 | Heuristic content leakage to observability | 0 occurrences (LangSmith / Pino / dashboard) | — | T0B-004 conformance test + Phase 6 Pino transport spy + grep test on logs |

---

## Key Entities

- **HeuristicSchemaExtended (CONSUMED, not owned):** Phase 6 owns the Zod schema; Phase 0b produces JSON files conforming to it. See `packages/agent-core/src/analysis/heuristics/schema.ts` (Phase 6 T101).
- **HeuristicProvenanceBlock:** 5-field embedded object (`source_url`, `citation_text`, `draft_model`, `verified_by`, `verified_date`). R15.3.1.
- **HeuristicBenchmark:** Discriminated union — `{kind: "quantitative", metric, value, unit, tolerance?}` OR `{kind: "qualitative", standard_text}`. R15.3.
- **HeuristicManifestSelectors:** `archetype` + `page_type` + `device` fields enabling `loadForContext(profile)` filter (Phase 4b T4B-013). NEW REQUIREMENT for Phase 0b authored content.
- **DraftingPromptTemplate:** Static markdown file at `docs/specs/mvp/templates/heuristic-drafting-prompt.md` — input contract for LLM drafting. Versioned; bumps require Phase 0b spec amendment.
- **VerificationProtocolDocument:** Static markdown file at `docs/specs/mvp/templates/heuristic-verification-protocol.md` — codifies R15.3.2. Engineer follows checklist per heuristic.
- **HeuristicLintCLI:** Thin `apps/cli/src/commands/heuristic-lint.ts` wrapping Phase 6's HeuristicSchemaExtended + 5 additional checks (provenance non-empty, manifest selectors, banned-phrase regex). Read-only — no DB, no network.
- **DraftingLogDirectory:** `.heuristic-drafts/` — gitignored local directory holding LLM drafting transcripts for debugging. R15.3.3 isolation point.

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** All 30 heuristics ship under `heuristics-repo/{baymard,nielsen,cialdini}/*.json` and pass `pnpm heuristic:lint heuristics-repo/**/*.json` with exit code 0.
- **SC-002:** All 30 heuristics carry both `benchmark` and `provenance` blocks (R15.3 + R15.3.1) — zero exceptions.
- **SC-003:** All 30 heuristics carry manifest selectors (`archetype`, `page_type`, `device`); a representative ContextProfile `{ecommerce, checkout, mobile}` filter returns 12-25 heuristics (Phase 4b AC-11).
- **SC-004:** F-012 spot-check passes — a different human re-verifies 5 random heuristics; ≤1 of 5 diverges.
- **SC-005:** Drafting cost ≤$15 total (NF-01); per-heuristic time ≤45 min p50 (NF-02).
- **SC-006:** Phase 6 T112 integration test loads all 30 heuristics under `HeuristicSchemaExtended.parse()` with zero failures (cross-phase acceptance — Phase 6 runs the test, Phase 0b is the producer).
- **SC-007:** Zero heuristic content leakage to LangSmith / Pino / dashboard during drafting OR loading (R6 / R15.3.3).

---

## Constitution Alignment Check *(mandatory — must pass before status: approved)*

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — T0B-004 linter deterministic regex check rejects banned phrasing in `recommendation.summary` + `recommendation.details`; AC-15.
- [x] Does NOT auto-publish findings without consultant review (warm-up rule, F-016) — Phase 0b produces heuristics, not findings; warm-up applies at Phase 8/9 publish boundary.
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — Phase 0b is file-system authoring only; no DB writes.
- [x] Does NOT import vendor SDKs outside adapters (R9) — Drafting subprocess uses Anthropic SDK directly (allowed, not part of agent-core); `pnpm heuristic:lint` uses Zod directly (allowed in apps/cli).
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` (R10) — Drafting is a META workflow, not a runtime evaluate call; temperature flexibility (e.g., 0.3) acceptable for creative drafting; verification is deterministic (human).
- [x] Does NOT expose heuristic content outside the LLM evaluate prompt (R6) — Drafting LLM responses kept local (`.heuristic-drafts/`, gitignored); committed JSON files are IP-protected per R6 (private repo, AES at v1.1); R15.3.3 isolation enforced via T0B-004 conformance test (AC-13).
- [x] DOES include a conformance test stub for every AC-NN (PRD §9.6 + R3 TDD) — AC-04, AC-13 each have a test path; AC-01/02/03/05/12 are manual-review items (acceptable for documentation/protocol artifacts); AC-06/07/08/09/10/11/14/15 covered by the linter test + cross-phase Phase 6 integration test.
- [x] DOES carry frontmatter delta block on subsequent edits (R18)
- [x] DOES define kill criteria for tasks > 2 hrs OR shared-contract changes (R23) — tracked in plan.md (drafting-cost spike, divergence-rate spike, schema-validation failure rate).
- [x] DOES reference REQ-IDs from `docs/specs/final-architecture/` for every R-NN (R11.2) — all 12 cite REQ-HK-001 / REQ-HK-EXT-001 / REQ-HK-BENCHMARK-00x / REQ-CONTEXT-DOWNSTREAM-001 or PRD F-012.

---

## Out of Scope (cite PRD §3.2 explicit non-goals)

- **The remaining 70 heuristics** (to reach §09.3's 100-heuristic master target) — DEFERRED to v1.1+ per PRD F-012 v1.2 amendment scope reduction. MVP authors the 30 most-leveraged.
- **AES-256-GCM encryption of `heuristics-repo/`** — DEFERRED to v1.1 per Constitution R6.2 (pre-first-pilot). Phase 0b ships plaintext JSON in private repo; Phase 6's `DecryptionAdapter` interface accommodates the v1.1 swap.
- **Persona-specific heuristics** — F-013 personas are runtime evaluate-time injection, not authoring-time. Phase 0b heuristics are persona-agnostic.
- **Auto-generated heuristics from real audit findings** (machine-learned heuristics) — explicit non-goal; R15.3.3 + IP discipline require human-verified provenance per heuristic.
- **Conversion-rate predictions** (permanent non-goal, R5.3 + GR-007) — banned-phrase regex check enforces.
- **Localization / i18n of heuristic content** — DEFERRED to v1.2 internationalization phase.
- **Multi-tenant heuristic packs** (per-client custom heuristics) — DEFERRED to v1.2 multi-tenant phase. MVP is single-agency (REO Digital).

---

## Assumptions

- HeuristicSchemaExtended (Phase 6 T101) is implemented before T103 starts. T0B-001..T0B-005 can be drafted ahead of T101 since they reference the contract surface, not a built artifact.
- T4B-013 manifest selector fields (`archetype`, `page_type`, `device`) are confirmed in the v0.3 Phase 6 contract. Phase 0b authoring uses these field names verbatim.
- Anthropic SDK is available at drafting time (already required for Phase 7). Drafting model = `claude-sonnet-4-*` (latest at drafting date).
- Spot-check verifier is available — at minimum 1 engineer different from each pack's primary author. If team is too small (e.g., solo engineering during MVP), engineering lead serves as spot-checker for all 3 packs.
- Source URLs (Baymard articles, Nielsen Norman pages, Cialdini chapter references) remain stable for the spot-check window. Verifier MUST snapshot to Wayback Machine if a Baymard URL is paywalled or unstable.
- F-012 v1.2 amendment counts (15 + 10 + 5 = 30) are CANONICAL; the v2.0 tasks-v2.md counts (50 + 35 + 15 = 100) are reduced to MVP scope via tasks-v2.md v2.3.3 patch (this session).
- No new vendor dependencies — drafting uses existing Anthropic SDK; linter uses existing Zod; logging uses existing Pino.
- **Drafting subprocess (e.g., `scripts/draft-heuristic.ts`) is EXEMPT from R9 adapter boundary.** *Why:* R9 governs production runtime code that touches external services on behalf of clients (LLM, browser, DB, storage). The drafting subprocess is META authoring tooling — it produces heuristic JSON files at design-time, not customer-facing runtime. *Why not via agent-core's LLMAdapter:* agent-core's LLMAdapter wires LangSmith for trace observability, which would violate R15.3.3 (drafting LLM responses MUST NOT touch LangSmith). The drafting subprocess deliberately uses `@anthropic-ai/sdk` directly to bypass the LangSmith trace path. *Criteria for exemption:* (a) only invoked manually via a developer script (e.g., `pnpm draft:heuristic`) during heuristic authoring sessions; (b) does NOT run in production audit pipeline (no scheduled jobs, no API trigger, no on-demand client request); (c) NOT imported as a module by any `packages/` or `apps/` runtime code; (d) writes only to `.heuristic-drafts/` (gitignored) and produces JSON files for human review. *Codification:* same pattern as Phase 0's `scripts/db-migrate-stub.mjs` exemption (per Constitution R22.2 Ratchet — every rule traces to a decision); reviewed quarterly per R22.3.

---

## Next Steps

After this spec is approved (`status: draft → validated → approved`):

1. Apply tasks-v2.md v2.3.3 patch (Phase 0b section + reduce T103-T105 counts to 15/10/5 per F-012 v1.2).
2. Implement T0B-001..T0B-005 (drafting infrastructure) — can run in parallel with Phase 1/2/3 implementation.
3. T101 (Phase 6 HeuristicSchemaExtended) lands — unblocks T103-T105 content authoring.
4. Begin T103 (Baymard pack) — most-leveraged for e-commerce vertical; iteration smooths drafting prompt before T104/T105.
5. T104 (Nielsen) and T105 (Cialdini) follow.
6. F-012 spot-check at +10 heuristic mark, again at +20, again at completion (3 batches).
7. Phase 6 T112 integration test confirms all 30 load under HeuristicSchemaExtended.
8. Phase 0b status transitions: `draft → validated → approved → implemented → verified` (verified after Phase 6 T112 passes against the full pack).
