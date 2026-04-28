---
title: Phase 4b — Context Capture Layer v1.0 — Tasks
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
  - docs/specs/mvp/tasks-v2.md (T4B-001..T4B-015, lines 476-568 — CANONICAL DEFINITIONS)
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md
  - docs/specs/mvp/phases/phase-4b-context-capture/plan.md

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

impact_analysis: docs/specs/mvp/phases/phase-4b-context-capture/impact.md
breaking: false
affected_contracts:
  - ContextProfile (NEW)
  - AuditState (extended)
  - AuditRequest (extended)
  - HeuristicLoader (extended)
  - context_profiles DB table (NEW)

delta:
  new:
    - Phase 4b tasks — sourced from tasks-v2.md (T4B-001..T4B-015)
  changed: []
  impacted: []
  unchanged:
    - All 15 task IDs and acceptance criteria are CANONICAL in tasks-v2.md; this file is a phase-scoped view

governing_rules:
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R18 (Append-only IDs)
  - Constitution R25 (Context Capture MUST NOT)
---

# Phase 4b Tasks (T4B-001 to T4B-015)

> **Summary (~80 tokens):** 15 tasks. T4B-001..T4B-006 build foundations + inference primitives. T4B-007..T4B-008 produce confidence + open questions. T4B-009..T4B-011 wire intake + CLI + orchestration. T4B-012 lands DB. T4B-013 extends HeuristicLoader. T4B-014 enforces R25. T4B-015 is exit gate. Total ~22.5h ±3. Canonical defs in `tasks-v2.md` lines 476-568.

**Source of truth:** `docs/specs/mvp/tasks-v2.md` lines 476-568. Acceptance criteria, file paths, and dependencies below are mirrored verbatim — **do NOT modify this file in lieu of updating `tasks-v2.md`**.

---

## Phase 4b sequencing

Per [plan.md](plan.md) §1: Day 1 foundations (T4B-001/002/003), Day 2 inference (T4B-004/005/006), Day 3 output assembly (T4B-007/008), Day 4 orchestration + DB (T4B-009/010/011/012), Day 5 downstream + exit gate (T4B-013/014/015).

---

## T4B-001 — ContextProfile Zod schema + provenance fields
- **dep:** T002, T080 (Drizzle schema)
- **spec:** §37 §37.2 + REQ-CONTEXT-OUT-001..003
- **files:** `packages/agent-core/src/context/ContextProfile.ts`
- **acceptance:** Validate fixture profile. All 5 dimensions validate. Every field is `{value, source, confidence}`. ContextProfile immutable after `Object.freeze`. SHA-256 hash function deterministic.
- **conformance test:** `packages/agent-core/tests/conformance/context-profile-schema.test.ts` (AC-01)

## T4B-002 — URLPatternMatcher
- **dep:** T4B-001
- **spec:** §37 §37.1.2 + REQ-CONTEXT-DIM-PAGE-001
- **files:** `packages/agent-core/src/context/URLPatternMatcher.ts`
- **acceptance:** Match 30 fixture URLs covering homepage / PDP / PLP / cart / checkout / landing / blog / pricing / comparison. ≥95% accuracy on URL-pattern matchable fixtures. Returns `{value, source: "url_pattern", confidence: 0.9}` on match.
- **conformance test:** `packages/agent-core/tests/conformance/url-pattern-matcher.test.ts` (AC-02)

## T4B-003 — HtmlFetcher (cheerio + undici, no Playwright)
- **dep:** T002 + Phase 4 §11.1.1 robots utility
- **spec:** §37 §37.3 REQ-CONTEXT-FLOW-001 + REQ-SAFETY-005
- **files:** `packages/agent-core/src/context/HtmlFetcher.ts`
- **acceptance:** Fetch 5 sites with realistic UA. Single GET request. 5s timeout. Respects robots.txt (per REQ-SAFETY-005). Cache by URL+ETag. Emits `CONTEXT_FETCH_FAILED` warning on error and gracefully degrades to URL-only inference. **No Playwright dependency.**
- **R25 enforcement:** AST scan ensures no `playwright` or `@playwright/*` import; conformance failure on violation.
- **conformance test:** `packages/agent-core/tests/conformance/html-fetcher.test.ts` (AC-03)

## T4B-004 — JsonLdParser
- **dep:** T4B-003
- **spec:** §37 §37.4
- **files:** `packages/agent-core/src/context/JsonLdParser.ts`
- **acceptance:** Parse Product / Service / SoftwareApplication / Organization fixtures. Extract `@type`, `name`, `offers`, `description`. Returns null when no JSON-LD present.
- **conformance test:** `packages/agent-core/tests/conformance/json-ld-parser.test.ts` (AC-04)

## T4B-005 — BusinessArchetypeInferrer
- **dep:** T4B-001, T4B-004
- **spec:** §37 §37.1.1 + REQ-CONTEXT-DIM-BUSINESS-001
- **files:** `packages/agent-core/src/context/BusinessArchetypeInferrer.ts`
- **acceptance:** Infer on D2C / B2B / SaaS / marketplace / lead_gen / service fixtures. "Add to cart" → D2C confident (≥0.9). "Request demo" → B2B confident. "/mo" + signup → SaaS confident. Mixed signals → low confidence + open_question. Provenance on each output.
- **signal weighting:** see [plan.md §2.6](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/business-archetype-inferrer.test.ts` (AC-05)

## T4B-006 — PageTypeInferrer (consolidates §07 §7.4 logic)
- **dep:** T4B-001, T4B-002, T4B-004
- **spec:** §37 §37.1.2 + REQ-CONTEXT-DIM-PAGE-001
- **files:** `packages/agent-core/src/context/PageTypeInferrer.ts`
- **acceptance:** Infer on 30 fixture URLs + HTML. ≥0.7 confidence on 90% of fixtures. Emits `inferredPageType` shape compatible with §07 §7.4 (backward-compat — existing consumers reading `AnalyzePerception.inferredPageType` still work).
- **conformance test:** `packages/agent-core/tests/conformance/page-type-inferrer.test.ts` (AC-06)

## T4B-007 — ConfidenceScorer + ProvenanceAssembler
- **dep:** T4B-001, T4B-005, T4B-006
- **spec:** §37 §37.2 REQ-CONTEXT-OUT-001
- **files:** `packages/agent-core/src/context/ConfidenceScorer.ts` + `packages/agent-core/src/context/ProvenanceAssembler.ts`
- **acceptance:** Score 5-dimension fixture. All fields tagged with `source` ∈ {user, url_pattern, schema_org, copy_inference, layout_inference, default}. Weighted `overall_confidence` ∈ [0, 1]. Confidence thresholds applied: ≥0.9 act / 0.6-0.9 use+flag / <0.6 ask.
- **weights:** see [plan.md §2.2](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/confidence-scorer.test.ts` (AC-07)

## T4B-008 — OpenQuestionsBuilder
- **dep:** T4B-007
- **spec:** §37 §37.2 REQ-CONTEXT-OUT-002
- **files:** `packages/agent-core/src/context/OpenQuestionsBuilder.ts`
- **acceptance:** Build questions for low-confidence fixture. `open_questions[]` populated with `field_path`, human-readable `question`, `blocking: true|false`. Blocking when REQUIRED field has confidence <0.6 or value missing.
- **required fields:** `business.archetype`, `page.type`, `goal.primary_kpi`
- **conformance test:** `packages/agent-core/tests/conformance/open-questions-builder.test.ts` (AC-08)

## T4B-009 — AuditRequest intake schema (extend §18)
- **dep:** T4B-001
- **spec:** §18 + REQ-GATEWAY-INTAKE-001..002
- **files:** `packages/agent-core/src/gateway/AuditRequest.ts` (extend)
- **acceptance:** Validate intake block. `goal.primary_kpi` REQUIRED — reject without it. `constraints.regulatory` non-empty for regulated verticals (pharma / fintech / gambling / healthcare / legal / insurance). All other intake fields optional.
- **conformance test:** `packages/agent-core/tests/conformance/audit-request-intake.test.ts` (AC-09)

## T4B-010 — CLI clarification prompt
- **dep:** T4B-008
- **spec:** §37 §37.3 step 6
- **files:** `apps/cli/src/contextClarification.ts`
- **acceptance:** Prompt user via stdin for blocking questions. Validates user answers against ContextProfile schema. Merges answers into ContextProfile. Resumes audit cleanly. Prints non-blocking warnings to stderr. Idempotent — re-running same audit with same answers produces same ContextProfile hash.
- **conformance test:** `packages/agent-core/tests/conformance/cli-clarification.test.ts` (AC-10)

## T4B-011 — ContextCaptureNode (audit_setup integration)
- **dep:** T4B-002 through T4B-010, T135 (AuditState — schedule before Phase 8 task)
- **spec:** §04 audit_setup extension + §37
- **files:** `packages/agent-core/src/orchestration/nodes/ContextCaptureNode.ts`
- **acceptance:** Run before audit_setup on test audit. Halts on blocking. Populates `state.context_profile_id` and `state.context_profile_hash`. Pinned to `context_profiles` table. Cleanly resumes after user answers.
- **conformance test:** `packages/agent-core/tests/conformance/context-capture-node.test.ts` (AC-11)

## T4B-012 — context_profiles table migration
- **dep:** T070 (PostgreSQL schema)
- **spec:** §13 + §37
- **files:** `packages/agent-core/src/db/migrations/0XX_context_profiles.sql` + Drizzle schema
- **acceptance:** Migration runs cleanly. Append-only enforcement (no UPDATE, no DELETE). SHA-256 hash stored. Foreign key to `audit_runs`. Indexes on `audit_run_id`, `client_id`, `profile_hash`.
- **conformance test:** `packages/agent-core/tests/conformance/context-profiles-migration.test.ts` (AC-12)

## T4B-013 — HeuristicLoader extension (consume ContextProfile)
- **dep:** T4B-001, T106 (HeuristicLoader baseline)
- **spec:** §09 + §37 §37.5 REQ-CONTEXT-DOWNSTREAM-001
- **files:** `packages/agent-core/src/analysis/heuristics/HeuristicLoader.ts` (extend)
- **acceptance:** Load with ContextProfile. Filter by `business.archetype` + `page.type` + `traffic.device_priority` from profile. Returns 12-25 heuristics for typical context. **Phase 4b uses filtering only** — no weight modifiers (deferred to Phase 13b master track).
- **conformance test:** `packages/agent-core/tests/conformance/heuristic-loader-context-filter.test.ts` (AC-13)
- **NOTE:** This task drives the Phase 6 refresh. Coordinate with Phase 6 before T4B-013 lands.

## T4B-014 — Constitution R25 compliance check
- **dep:** T4B-001 through T4B-013
- **spec:** Constitution R25 (Context Capture MUST NOT)
- **files:** `packages/agent-core/tests/constitution/R25.test.ts`
- **acceptance:** Verify no Playwright import in `packages/agent-core/src/context/*`. No CRO judgment fields (no severity / impact / score) in ContextProfile schema. Provenance present on every output. No silent default — every default value tagged with `source: "default"`.
- **conformance test:** see acceptance — this task IS the conformance test (AC-14)

## T4B-015 — Phase 4b integration test
- **dep:** T4B-001 through T4B-014
- **spec:** Phase 4b exit gate
- **files:** `packages/agent-core/tests/integration/context-capture.test.ts`
- **acceptance:** Run on 5 fixture sites with intake variations: (1) full intake, (2) URL only, (3) regulated vertical without constraints (should reject), (4) low-confidence inference (should produce blocking question), (5) inference fetch fails (should degrade to URL-only). All 5 dimensions populated with provenance. Clarification loop fires on weak signals. Profile hashed and pinned. Audit halts then resumes correctly. R25 compliance verified.
- **integration test:** `packages/agent-core/tests/integration/context-capture.test.ts` (AC-15)

---

## Phase exit checklist

Before declaring Phase 4b complete:

- [ ] AC-01..AC-15 conformance tests all passing
- [ ] R25 compliance test (AC-14) passes — zero Playwright/LLM imports in `context/*`, no judgment fields, no silent defaults
- [ ] HeuristicLoader extension (T4B-013) returns 12-25 heuristics for typical contexts
- [ ] Idempotency: re-running same audit with same intake → identical `profile_hash`
- [ ] Cost: `llm_call_log` row count diff = 0; per-audit Phase 4b cost ≤$0.01
- [ ] context_profiles table is append-only (no UPDATE / DELETE)
- [ ] AuditState slot for `context_profile_id` + `context_profile_hash` agreed with Phase 8 owner
- [ ] `phase-4b-current.md` rollup drafted and approved
- [ ] PR Contract block (per CLAUDE.md §6) attached to merge PR
