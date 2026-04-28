---
title: Phase 4b — Context Capture Layer v1.0
artifact_type: spec
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
  - docs/specs/mvp/PRD.md (F-001 Audit Intake, F-006 Heuristic Filter, F-019 Reproducibility)
  - docs/specs/mvp/constitution.md (R1-R26; especially R20 impact, R22 ratchet, R25 context capture MUST NOT)
  - docs/specs/mvp/architecture.md (§6.4 tech stack, §6.5 file locations)
  - docs/specs/mvp/tasks-v2.md (T4B-001..T4B-015, lines 476-568)
  - docs/specs/final-architecture/37-context-capture-layer.md (REQ-CONTEXT-DIM-* + REQ-CONTEXT-OUT-* + REQ-CONTEXT-FLOW-001 + REQ-CONTEXT-DOWNSTREAM-001)
  - docs/specs/final-architecture/18-trigger-gateway.md §18 (REQ-GATEWAY-INTAKE-001..002)
  - docs/specs/final-architecture/04-orchestration.md (audit_setup integration)
  - docs/specs/final-architecture/13-data-layer.md (context_profiles table)
  - docs/Improvement/context_capture_layer_spec.md (full design rationale; items 1-6)

req_ids:
  - REQ-CONTEXT-DIM-BUSINESS-001
  - REQ-CONTEXT-DIM-PAGE-001
  - REQ-CONTEXT-DIM-AUDIENCE-001
  - REQ-CONTEXT-DIM-TRAFFIC-001
  - REQ-CONTEXT-DIM-BRAND-001
  - REQ-CONTEXT-OUT-001
  - REQ-CONTEXT-OUT-002
  - REQ-CONTEXT-OUT-003
  - REQ-CONTEXT-FLOW-001
  - REQ-CONTEXT-DOWNSTREAM-001
  - REQ-GATEWAY-INTAKE-001
  - REQ-GATEWAY-INTAKE-002
  - REQ-SAFETY-005

impact_analysis: docs/specs/mvp/phases/phase-4b-context-capture/impact.md
breaking: false
affected_contracts:
  - ContextProfile (NEW shared contract)
  - AuditState (extended with `context_profile_id` + `context_profile_hash`)
  - AuditRequest (extended intake schema)
  - HeuristicLoader (extended to consume ContextProfile filter)
  - context_profiles DB table (NEW append-only table)
  - AnalyzePerception.inferredPageType (read-through to ContextProfile.page.type)

delta:
  new:
    - Phase 4b spec — introduces ContextProfile, ContextCaptureNode, context_profiles table, intake clarification flow
    - AC-01 through AC-15 stable IDs for T4B-001..T4B-015 acceptance
    - R-01 through R-15 functional requirements
  changed: []
  impacted:
    - HeuristicLoader (T106) — extended at T4B-013 to filter on ContextProfile
    - audit_setup orchestration node — gains ContextCaptureNode predecessor
    - tasks-v2.md (T4B-001..T4B-015 already canonical there)
  unchanged:
    - Constitution R25 enforces what this layer MUST NOT do (no Playwright, no judgment, no silent defaults, no LLM in MVP)
    - Phases 5/6/7/8 internal contracts (perception / browse / analyze / orchestrator)
    - GR-001..GR-008 grounding rules

governing_rules:
  - Constitution R10 (Budget — ~$0.01 per audit)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes — multiple shared contracts)
  - Constitution R22 (Ratchet)
  - Constitution R25 (Context Capture MUST NOT — no Playwright, no judgment, no silent default, no LLM in MVP)
---

# Feature Specification: Phase 4b — Context Capture Layer v1.0

> **Summary (~150 tokens — agent reads this first):** Build a pre-perception "consultant intake form, automated where possible" layer that captures 5 context dimensions (business archetype, page type + funnel, audience, traffic source + device, brand). Every output field is `{value, source, confidence}` so downstream layers can reason about evidence quality. Two input paths: explicit (user intake) and inferred (URL pattern + lightweight HTML fetch + JSON-LD — no Playwright). Confidence thresholds gate audit progress: ≥0.9 act, 0.6-0.9 use+flag, <0.6 ask. Blocking questions surface to the CLI before the audit proceeds. Output `ContextProfile` is hashed (SHA-256), pinned to the new `context_profiles` table, and consumed by the HeuristicLoader to filter the heuristic library down to 12-25 relevant rules. Fifteen tasks (T4B-001..T4B-015). Cost: ~$0.01 per audit (one HTTP fetch + ~5K-token profile). Constitution R25 forbids Playwright, judgment fields, silent defaults, and LLM calls inside this layer in MVP.

**Feature Branch:** master (spec authoring; per phase-0..phase-6 convention)
**Input:** Phase 4b scope from `docs/specs/mvp/tasks-v2.md` lines 476-568 + `docs/specs/final-architecture/37-context-capture-layer.md` + `docs/Improvement/context_capture_layer_spec.md`

---

## Mandatory References

1. `docs/specs/mvp/constitution.md` — R10, R11, R18, R20, R25.
2. `docs/specs/mvp/PRD.md` — F-001 (intake), F-006 (heuristic filter), F-019 (reproducibility).
3. `docs/specs/final-architecture/37-context-capture-layer.md` — full layer spec with REQ-CONTEXT-DIM-* / REQ-CONTEXT-OUT-* / REQ-CONTEXT-FLOW-001 / REQ-CONTEXT-DOWNSTREAM-001.
4. `docs/specs/final-architecture/18-trigger-gateway.md` — REQ-GATEWAY-INTAKE-001..002 (intake schema extension).
5. `docs/specs/final-architecture/13-data-layer.md` — context_profiles table convention.
6. `docs/specs/final-architecture/04-orchestration.md` — audit_setup node integration point.
7. `docs/specs/mvp/tasks-v2.md` lines 476-568 — T4B-001..T4B-015.
8. `docs/Improvement/context_capture_layer_spec.md` — design rationale.

---

## Constraints Inherited from Neural Canonical Specs

- **R25 (Context Capture MUST NOT):**
  - No Playwright import inside `packages/agent-core/src/context/*`
  - No CRO judgment fields (no severity, impact, score) in ContextProfile schema
  - No silent default — every default value tagged with `source: "default"` and explicitly visible to downstream consumers
  - No LLM calls in MVP (Phase 13b master adds optional LLM-tagged inference; out of MVP scope)
  - No headless-browser session, no state graph, no perception
- **Cost discipline (R10):** ~$0.01 per audit (one HTTP fetch + Zod parse). No new LLM calls.
- **Append-only `context_profiles`** (R7.4): never UPDATE, never DELETE.
- **Robots / ToS (REQ-SAFETY-005):** HtmlFetcher respects robots.txt; cross-references the §11.1.1 robots/ToS check landing in Phase 4 refresh.
- **No `console.log`** (R10.6) — Pino logger with audit_run_id, profile_hash, dimension correlation fields.
- **Tech stack pinned:** TypeScript 5, undici, cheerio (new dep — added in Phase 4b only for HtmlFetcher; no Playwright). Drizzle for DB.
- **Backward compat for `AnalyzePerception.inferredPageType`** (R5.1): `inferredPageType` becomes a thin reader of `ContextProfile.page.type`; existing consumers continue to work via accessor.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Consultant runs an audit with full intake (Priority: P1)

A REO Digital consultant kicks off an audit on a Shopify D2C site, providing intake (`business.archetype: D2C`, `goal.primary_kpi: "checkout_conversion"`, `traffic.device_priority: mobile`, regulatory: none). Phase 4b validates intake, infers remaining dimensions from URL + HTML fetch, hashes the profile, pins it to `context_profiles`, and starts perception with all 5 dimensions populated.

**Why this priority:** This is the happy path — most pilot audits begin with a consultant providing reasonable intake. Without Phase 4b, the heuristic library fires the wrong rules and findings drift into noise.
**Independent Test:** Run `pnpm cro:audit --urls fixture.com --business-type D2C ...`; confirm a `ContextProfile` row exists in `context_profiles`, all 5 dimensions populated, every field has `{value, source, confidence}`, and `state.context_profile_hash` is set on `AuditState`.

**Acceptance Scenarios:**

1. **Given** a consultant provides full intake, **When** Phase 4b runs, **Then** `ContextProfile` validates against Zod, `overall_confidence ≥ 0.8`, no blocking questions, audit proceeds.
2. **Given** the same audit re-runs with identical intake, **When** Phase 4b re-runs, **Then** `profile_hash` is identical (idempotent / reproducible).

---

### User Story 2 — Audit on a regulated vertical without constraints declared (Priority: P1)

A consultant kicks off an audit on a fintech site without declaring `constraints.regulatory`. REQ-GATEWAY-INTAKE-002 mandates regulatory disclosure for regulated verticals (pharma / fintech / gambling / healthcare / legal / insurance). Phase 4b rejects the intake.

**Why this priority:** Regulatory blind spots produce findings that cannot be published — discovery before perception saves cost AND avoids consultant rework.
**Independent Test:** Submit a fintech intake with `constraints.regulatory: []`; confirm Phase 4b rejects with a specific error citing REQ-GATEWAY-INTAKE-002.

**Acceptance Scenarios:**

1. **Given** vertical is "fintech" and `constraints.regulatory` is empty, **When** Phase 4b runs, **Then** the audit halts with error `INTAKE_REGULATORY_REQUIRED` before any HTTP fetch.

---

### User Story 3 — Low-confidence inference triggers blocking question (Priority: P1)

An audit on a mixed-signal page (some "Add to cart" + some "Request a quote" copy) produces low-confidence business archetype. `business.archetype.confidence < 0.6` triggers a blocking question. CLI prompts the consultant; consultant answers; profile is updated; audit resumes.

**Why this priority:** Honest output is core to project positioning. Silent defaults on context lead to whole-audit drift; one well-targeted question costs less than re-running.
**Independent Test:** Run on a mixed-signal fixture; confirm `open_questions[]` contains an entry with `blocking: true`; CLI prompts; after answer, `profile_hash` updates and audit resumes cleanly.

**Acceptance Scenarios:**

1. **Given** mixed CTA copy fixture, **When** Phase 4b runs, **Then** `business.archetype.confidence < 0.6` and `open_questions[]` contains an entry with `field_path: "business.archetype"` and `blocking: true`.
2. **Given** the consultant answers via CLI, **When** the answer is merged, **Then** the field is updated with `source: "user"`, `confidence: 1.0`, and audit resumes.
3. **Given** the same fixture re-runs with the recorded answer, **When** Phase 4b runs, **Then** the answer is replayed without re-prompting (idempotency).

---

### User Story 4 — HtmlFetcher fetch fails, audit degrades gracefully (Priority: P2)

The HtmlFetcher single GET to the target URL times out. Phase 4b emits `CONTEXT_FETCH_FAILED` warning, falls back to URL-only inference, and lowers confidence accordingly. If the resulting confidence is below threshold, blocking questions fire as in Story 3.

**Why this priority:** Real-world audits will hit timeouts, 4xx, and Cloudflare bot walls. Graceful degradation prevents audit-wide failures.
**Independent Test:** Mock a 5s timeout on HtmlFetcher; confirm warning emits, URL-only inference proceeds, and confidence drops accordingly.

**Acceptance Scenarios:**

1. **Given** HtmlFetcher times out, **When** Phase 4b runs, **Then** a `CONTEXT_FETCH_FAILED` warning is emitted (Pino + bundle), URL-pattern inference proceeds, and JSON-LD–dependent inferences default with `source: "default"` and `confidence: 0`.

---

### User Story 5 — HeuristicLoader filters by ContextProfile (Priority: P1)

After Phase 4b completes, the HeuristicLoader (T4B-013) reads `business.archetype + page.type + traffic.device_priority` and filters the heuristic library to 12-25 relevant rules.

**Why this priority:** This is the immediate downstream value — Phase 4b without filtering is just metadata; with filtering it cuts heuristic execution cost ~70% and improves finding precision.
**Independent Test:** Load the heuristic library with a D2C / PDP / mobile profile; confirm 12-25 heuristics returned; load with a B2B / pricing / desktop profile; confirm a different (and disjoint) 12-25 heuristics returned.

**Acceptance Scenarios:**

1. **Given** profile is `(D2C, PDP, mobile)`, **When** HeuristicLoader runs, **Then** between 12 and 25 heuristics are returned, all with manifest matching at least one of `archetype: D2C`, `page_type: PDP`, `device: mobile`.
2. **Given** profile is `(B2B, pricing, desktop)`, **When** HeuristicLoader runs, **Then** the returned set is disjoint from the D2C/PDP/mobile set on at least 80% of entries.

---

### Edge Cases

- **No JSON-LD on page** → JSON-LD-dependent inferences default with `confidence: 0` and `source: "default"`; URL pattern + copy inference still run.
- **Robots.txt disallows crawl** → emit `CONTEXT_ROBOTS_DISALLOW`, halt fetch, degrade to URL-only inference.
- **Very short HTML (<1KB)** → likely SPA shell; emit `CONTEXT_HTML_TOO_SHORT`; degrade to URL-only.
- **Multiple contradictory signals** (e.g., "free trial" + "Add to cart") → keep both candidates; pick highest-weighted; lower confidence by 0.2.
- **Locale-specific archetype** (e.g., Indian B2B page with `/buy` URL) → URL-pattern alone is misleading; require JSON-LD + CTA copy convergence.
- **Pricing in image-only banner** → JSON-LD has no pricing; copy inference picks up "₹" symbol; AOV tier inferred conservatively.
- **Subscription with one-time fallback** (e.g., "buy outright OR subscribe & save") → cadence = "subscription" with confidence 0.7, `open_questions[]` entry to confirm.
- **Default value emission** → every field that is not user-provided AND not inferred above 0.5 is set with `source: "default"`, `value` = enum default, `confidence: 0`. Never silent.

---

## Acceptance Criteria *(mandatory — stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked REQ-ID(s) |
|----|-----------|----------------------|------------------|
| AC-01 | ContextProfile Zod schema validates a fixture profile across all 5 dimensions; every field has `{value, source, confidence}`; `Object.freeze` enforces immutability post-build; SHA-256 hash deterministic on identical inputs. | `packages/agent-core/tests/conformance/context-profile-schema.test.ts` | REQ-CONTEXT-OUT-001, REQ-CONTEXT-OUT-003 |
| AC-02 | URLPatternMatcher matches 30 fixture URLs covering home / PDP / PLP / cart / checkout / landing / blog / pricing / comparison at ≥95% accuracy; returns `{value, source: "url_pattern", confidence: 0.9}` on match. | `packages/agent-core/tests/conformance/url-pattern-matcher.test.ts` | REQ-CONTEXT-DIM-PAGE-001 |
| AC-03 | HtmlFetcher fetches 5 sites with realistic UA; single GET; 5s timeout; respects robots.txt (REQ-SAFETY-005); ETag cache by URL; emits `CONTEXT_FETCH_FAILED` on error and degrades to URL-only; **NO Playwright import** anywhere in `packages/agent-core/src/context/*`. | `packages/agent-core/tests/conformance/html-fetcher.test.ts` + `packages/agent-core/tests/constitution/R25.test.ts` | REQ-CONTEXT-FLOW-001, R25 |
| AC-04 | JsonLdParser parses Product / Service / SoftwareApplication / Organization fixtures; extracts `@type`, `name`, `offers`, `description`; returns `null` when no JSON-LD. | `packages/agent-core/tests/conformance/json-ld-parser.test.ts` | REQ-CONTEXT-FLOW-001 |
| AC-05 | BusinessArchetypeInferrer infers correctly on D2C / B2B / SaaS / marketplace / lead_gen / service fixtures; "Add to cart" → D2C confident (≥0.9); "Request demo" → B2B confident; "/mo" + signup → SaaS confident; mixed signals → low confidence + open_question; provenance present on every output. | `packages/agent-core/tests/conformance/business-archetype-inferrer.test.ts` | REQ-CONTEXT-DIM-BUSINESS-001 |
| AC-06 | PageTypeInferrer infers on 30 fixtures with ≥0.7 confidence on 90% of fixtures; emits `inferredPageType` shape backward-compatible with §07 §7.4 (existing `AnalyzePerception.inferredPageType` consumers continue to work via accessor). | `packages/agent-core/tests/conformance/page-type-inferrer.test.ts` | REQ-CONTEXT-DIM-PAGE-001 |
| AC-07 | ConfidenceScorer + ProvenanceAssembler scores a 5-dimension fixture; every field tagged with `source` ∈ {user, url_pattern, schema_org, copy_inference, layout_inference, default}; weighted `overall_confidence` ∈ [0, 1]; thresholds applied (≥0.9 act / 0.6-0.9 use+flag / <0.6 ask). | `packages/agent-core/tests/conformance/confidence-scorer.test.ts` | REQ-CONTEXT-OUT-001 |
| AC-08 | OpenQuestionsBuilder produces blocking and non-blocking questions on a low-confidence fixture; `field_path` + `question` + `blocking` populated; blocking when REQUIRED field has confidence <0.6 OR value missing. | `packages/agent-core/tests/conformance/open-questions-builder.test.ts` | REQ-CONTEXT-OUT-002 |
| AC-09 | AuditRequest intake schema (extended) validates `goal.primary_kpi` REQUIRED — rejects without; `constraints.regulatory` non-empty for regulated verticals (pharma / fintech / gambling / healthcare / legal / insurance) — rejects when empty; all other intake fields optional. | `packages/agent-core/tests/conformance/audit-request-intake.test.ts` | REQ-GATEWAY-INTAKE-001, REQ-GATEWAY-INTAKE-002 |
| AC-10 | CLI clarification prompt reads blocking questions from stdin, validates user answers against ContextProfile schema, merges into profile, resumes audit; non-blocking warnings printed to stderr; idempotent on re-run with same answers (identical `profile_hash`). | `packages/agent-core/tests/conformance/cli-clarification.test.ts` | REQ-CONTEXT-OUT-002, REQ-CONTEXT-FLOW-001 |
| AC-11 | ContextCaptureNode runs before `audit_setup`; halts on blocking; populates `state.context_profile_id` + `state.context_profile_hash`; pins to `context_profiles`; resumes cleanly after user answers. | `packages/agent-core/tests/conformance/context-capture-node.test.ts` | REQ-CONTEXT-OUT-003, audit_setup integration |
| AC-12 | `context_profiles` migration runs cleanly; append-only enforcement (no UPDATE, no DELETE per R7.4); SHA-256 hash stored; FK to `audit_runs`; indexes on `audit_run_id`, `client_id`, `profile_hash`. | `packages/agent-core/tests/conformance/context-profiles-migration.test.ts` | §13 + REQ-CONTEXT-OUT-003 |
| AC-13 | HeuristicLoader extension loads with ContextProfile; filters by `business.archetype + page.type + traffic.device_priority`; returns 12-25 heuristics for typical context. **No weight modifiers** — filter only (weight modifiers deferred to Phase 13b master). | `packages/agent-core/tests/conformance/heuristic-loader-context-filter.test.ts` | REQ-CONTEXT-DOWNSTREAM-001 |
| AC-14 | Constitution R25 compliance test: no Playwright import in `packages/agent-core/src/context/*`; no judgment fields (severity / impact / score) in ContextProfile schema; provenance present on every output; no silent defaults — every default value tagged `source: "default"`. | `packages/agent-core/tests/constitution/R25.test.ts` | R25 |
| AC-15 | Phase 4b integration test on 5 fixtures: (1) full intake — proceeds; (2) URL only — degrades; (3) regulated vertical without `constraints.regulatory` — rejects; (4) low-confidence inference — produces blocking question; (5) HtmlFetcher fails — degrades to URL-only. All 5 dimensions populated with provenance; clarification loop fires; profile hashed and pinned; audit halts then resumes. R25 compliance verified. | `packages/agent-core/tests/integration/context-capture.test.ts` | All Phase 4b REQ-IDs |

---

## Functional Requirements

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST capture 5 context dimensions (business / page / audience / traffic / brand) with every field shaped as `{value, source, confidence}`. | F-001, F-006 | §37 §37.1, §37.2 |
| R-02 | System MUST validate `ContextProfile` via Zod and `Object.freeze` it after build; any post-build mutation MUST throw. | F-019 | §37 §37.2, REQ-CONTEXT-OUT-003 |
| R-03 | System MUST emit a SHA-256 hash of `ContextProfile` (canonical-JSON keys sorted). Identical inputs MUST produce identical hashes. | F-019 | §37 §37.2, REQ-CONTEXT-OUT-003 |
| R-04 | System MUST infer `page.type` from URL pattern at ≥95% precision on the 30-fixture URL set; populate provenance `source: "url_pattern", confidence: 0.9`. | F-001 | §37 §37.1.2 |
| R-05 | System MUST run a single HTTP GET (undici) with realistic UA + 5s timeout; respect robots.txt (REQ-SAFETY-005); cache by URL+ETag; degrade to URL-only inference on fetch failure with a `CONTEXT_FETCH_FAILED` warning. | F-001 | §37 §37.3, REQ-CONTEXT-FLOW-001 |
| R-06 | System MUST parse JSON-LD from fetched HTML (cheerio); extract `@type`, `name`, `offers`, `description`; ignore malformed JSON-LD silently. | F-001 | §37 §37.4 |
| R-07 | System MUST infer `business.archetype` from JSON-LD + CTA copy + URL TLD signals; emit lowest-confidence + `open_question` when signals are mixed. | F-006 | §37 §37.1.1 |
| R-08 | System MUST score `overall_confidence` as a weighted aggregate of dimension confidences (weights documented in plan.md); apply thresholds ≥0.9 act / 0.6-0.9 use+flag / <0.6 ask. | F-006 | §37 §37.2, REQ-CONTEXT-OUT-001 |
| R-09 | System MUST surface blocking questions for required fields with confidence <0.6 OR missing values; non-blocking warnings for fields with confidence 0.6-0.9. | F-001 | §37 §37.2, REQ-CONTEXT-OUT-002 |
| R-10 | System MUST extend `AuditRequest` intake schema: `goal.primary_kpi` REQUIRED; `constraints.regulatory` non-empty for regulated verticals (pharma / fintech / gambling / healthcare / legal / insurance). | F-001 | §18, REQ-GATEWAY-INTAKE-001..002 |
| R-11 | System MUST integrate `ContextCaptureNode` before `audit_setup` in the orchestration graph; halt on blocking; populate `state.context_profile_id` + `state.context_profile_hash`; resume cleanly after user answers. | F-001, F-019 | §04 audit_setup, §37 §37.3 |
| R-12 | System MUST persist `ContextProfile` to a new append-only `context_profiles` table; FK to `audit_runs`; SHA-256 hash stored; never UPDATE, never DELETE (R7.4). | F-019 | §13 + R7.4 |
| R-13 | System MUST extend HeuristicLoader to filter heuristics by `business.archetype + page.type + traffic.device_priority`; return 12-25 heuristics for typical context. **Filter only** — no weight modifiers (Phase 13b master track). | F-006 | §09, REQ-CONTEXT-DOWNSTREAM-001 |
| R-14 | System MUST satisfy Constitution R25 — no Playwright import in `packages/agent-core/src/context/*`; no judgment fields in `ContextProfile`; no silent defaults (every default emits `source: "default"`). | R25 | Constitution R25 |
| R-15 | System MUST provide a CLI clarification prompt: read blocking questions, validate user answers against ContextProfile schema, merge into profile, resume audit; idempotent on re-run with same answers. | F-001 | §37 §37.3 step 6 |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-01 | Phase 4b cost per audit | ≤$0.01 (fetch + Zod parse only — no LLM) | NF-002 | `llm_call_log` row count diff = 0; profile-build wall time |
| NF-02 | Phase 4b end-to-end p50 wall time | ≤2s on cached fetch; ≤7s on cold | NF-001 | Integration test timing |
| NF-03 | URLPatternMatcher precision on fixture set | ≥95% | — | Conformance test on 30-URL fixture |
| NF-04 | PageTypeInferrer confidence ≥0.7 on fixtures | ≥90% of fixtures | — | Conformance test on 30-URL+HTML fixture |
| NF-05 | Net new LLM cost per audit | $0 in MVP | NF-002 | `llm_call_log` row count diff |
| NF-06 | HeuristicLoader filtered set size | 12-25 heuristics for typical context | — | Conformance test on representative profiles |

---

## Key Entities

- **ContextProfile (NEW shared contract):** Top-level capture output. Fields: `business`, `page`, `audience`, `traffic`, `brand`, `goal`, `constraints`, `overall_confidence`, `open_questions[]`, `provenance`, `profile_hash`. Frozen post-build. Zod schema in `packages/agent-core/src/context/ContextProfile.ts`.
- **ContextSource:** Enum — `user | url_pattern | schema_org | copy_inference | layout_inference | default`. Every field's `source` MUST be one of these.
- **ContextField<T>:** `{ value: T; source: ContextSource; confidence: number /* 0..1 */ }`. Every dimension field is shaped this way.
- **OpenQuestion:** `{ field_path: string; question: string; blocking: boolean }`. Surfaces to CLI when `blocking: true`.
- **AuditRequest (extended):** Adds intake block per §18: `goal.primary_kpi` (required), `constraints.regulatory[]`, `business.archetype` (optional), `traffic.device_priority` (optional), `audience.buyer` (optional).
- **context_profiles table (NEW):** Append-only. Columns: `id`, `audit_run_id`, `client_id`, `profile_hash` (sha256), `profile_json` (jsonb), `created_at`. Indexes: `audit_run_id`, `client_id`, `profile_hash`.
- **ContextCaptureNode:** Orchestration node that runs before `audit_setup`. Halts audit on blocking questions; resumes after CLI answers.
- **HeuristicLoader (extended):** Adds `loadForContext(profile)` method that filters the heuristic library by `business.archetype + page.type + traffic.device_priority`.

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** All 5 dimensions populated with provenance on every Phase 4b run across the 5-fixture integration test.
- **SC-002:** Net new LLM cost = $0 per audit (Phase 4b runs no LLM calls in MVP).
- **SC-003:** Phase 4b adds ≤2s p50 wall-time (cached fetch) / ≤7s p50 (cold) to audit end-to-end.
- **SC-004:** URLPatternMatcher precision ≥95% on the 30-URL fixture set.
- **SC-005:** HeuristicLoader filtered set size lands in 12-25 range for typical contexts (D2C/PDP/mobile, SaaS/pricing/desktop, B2B/comparison/balanced, lead_gen/landing/mobile).
- **SC-006:** Constitution R25 compliance test (AC-14) passes — no Playwright in `context/*`, no judgment fields, no silent defaults.
- **SC-007:** Idempotency — re-running same audit with same intake produces identical `profile_hash`.

---

## Constitution Alignment Check

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — context capture only; no judgment fields (R25)
- [x] Does NOT auto-publish findings without consultant review — no findings emitted in this phase
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — `context_profiles` is append-only by design
- [x] Does NOT import vendor SDKs outside adapters (R9) — undici + cheerio are non-LLM-vendor utilities; no Playwright (R25); Drizzle goes through StorageAdapter
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` (R10) — no LLM calls in MVP
- [x] Does NOT expose heuristic content outside the LLM evaluate prompt (R6) — no heuristic engagement (consumes via filter only)
- [x] DOES include a conformance test stub for every AC-NN (PRD §9.6 + R3 TDD) — AC-01..AC-15 each cite a path
- [x] DOES carry frontmatter delta block on subsequent edits (R18)
- [x] DOES define kill criteria for tasks > 2 hrs OR shared-contract changes (R23) — tracked in plan.md
- [x] DOES reference REQ-IDs from `docs/specs/final-architecture/` for every R-NN (R11.2)

---

## Out of Scope (cite PRD §3.2 explicit non-goals)

- **LLM-tagged inference** for archetype / awareness_level / decision_style — Phase 13b master track.
- **Per-traffic-source segmentation** — Phase 13b.
- **Schwartz awareness model + decision_style heuristics** — Phase 13b.
- **Heuristic weight modifiers from ContextProfile** — Phase 13b master track. Phase 4b uses filter only (R-13).
- **Multi-page context aggregation** — Phase 4b is per-audit (one ContextProfile per audit, even with multi-URL inputs); cross-page synthesis is Phase 8.
- **Conversion-rate prediction** — permanent non-goal (R5.3 + GR-007).
- **Authenticated-page context capture** — PRD §3.2 permanent non-goal.

---

## Assumptions

- Phase 0 (T002 db wiring) and Phase 4 (T070 PostgreSQL schema baseline + T080 Drizzle schema) are in place. T4B-012 migration extends T070's migration file set.
- The 30-URL fixture set for URLPatternMatcher (T4B-002) is authored; if missing, ASK FIRST.
- The 5 archetype fixtures (D2C / B2B / SaaS / marketplace / lead_gen / service) for BusinessArchetypeInferrer are authored.
- The HtmlFetcher cheerio + undici dependencies are added in Phase 0 dependency setup or via a Phase 4b dep PR (no Playwright dependency).
- AuditState (`T135` Phase 8 prereq) provides the schema slot for `context_profile_id` + `context_profile_hash`. T4B-011 schedules cleanly before Phase 8 because T4B-011 extends AuditState's schema before AuditState is locked.
- Heuristic library has manifests with `archetype`, `page_type`, `device` selector fields (Phase 0b heuristic authoring covers this).
- Robots.txt parser (REQ-SAFETY-005) is implemented in Phase 4 refresh (§11.1.1) before T4B-003 lands; Phase 4b imports the robots utility.

---

## Next Steps

After approval (`status: draft → validated → approved`):

1. Run `/speckit.plan` (already drafted alongside this spec).
2. Run `/speckit.tasks` (T4B-001..T4B-015 mirrored from `tasks-v2.md`).
3. Run `/speckit.analyze` for cross-artifact consistency.
4. Phase 4b implementation begins after Phase 4 (refreshed) ships robots/ToS utility AND T070+T080 DB schema lands.
