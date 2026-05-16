---
title: Phase 4b Rollup — Current System State
artifact_type: rollup
status: approved
version: 1.0
phase_number: 4b
phase_name: Context Capture Layer v1.0
phase_completed_on: 2026-05-16
created: 2026-05-16
updated: 2026-05-16
owner: engineering lead
authors: [Claude (master orchestrator)]
reviewers: []
supersedes: docs/specs/mvp/phases/phase-4-safety-infra-cost/phase-4-current.md
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md (v0.4 verified)
  - docs/specs/mvp/phases/phase-4b-context-capture/tasks.md (v0.4 verified)
  - docs/specs/mvp/phases/phase-4b-context-capture/plan.md (v0.4 verified)
  - docs/specs/mvp/phases/phase-4b-context-capture/impact.md (v0.4 verified)
  - .phase-state/4b/verify-verdict-pass2.yaml (Gate 2 Pass 2 APPROVE)
  - .phase-state/4b/code-review-findings.yaml (Stage 2.5 APPROVE)
req_ids:
  - REQ-CONTEXT-DIM-BUSINESS-001
  - REQ-CONTEXT-DIM-PAGE-001
  - REQ-CONTEXT-OUT-001
  - REQ-CONTEXT-OUT-002
  - REQ-CONTEXT-OUT-003
  - REQ-CONTEXT-FLOW-001
  - REQ-CONTEXT-DOWNSTREAM-001
  - REQ-GATEWAY-INTAKE-001
  - REQ-GATEWAY-INTAKE-002
  - REQ-SAFETY-005
delta:
  new:
    - Phase 4b Context Capture Layer v1.0 — full 15-task implementation
    - 6 NEW shared contracts (ContextProfile + ContextField factory + 6 LOCKED enums + ProvenanceEntry + OpenQuestion + AuditState fwd-stub + ClarificationAnswer)
    - context_profiles append-only DB table (migration 0004) + Drizzle schema
    - ContextCaptureNode orchestration pipeline (halt/resume contract)
    - HeuristicLoader.loadForContext value-mapper bridging LOCKED→PRELIMINARY enums
  changed:
    - AuditRequest extended with intake schema (T4B-009)
    - HeuristicLoader extended with loadForContext method (T4B-013)
    - AuditState gains 2 context_profile slots (forward-stub at orchestration/state.ts; Phase 8 T135 extends)
  impacted:
    - Phase 5 Browse — ContextProfile available for safety gating + URL scoping
    - Phase 6 Heuristic KB Engine — T106 supersedes Phase 4b's stub loader; manifest selectors already match T4B-013 filter shape
    - Phase 7 Analysis Pipeline — EvaluateNode consumes ContextProfile to filter prompt heuristics + populate context block
    - Phase 8 Orchestrator — AuditState T135 extends fwd-stub from T4B-011; ContextCaptureNode wires before audit_setup
    - Phase 13b master — LLM-tag inference deferred (5 archetypes + 7 verticals + LOCKED-only enum reconciliation)
  unchanged:
    - All Phase 0/0b/1/1b/1c/2/3/4 contracts (PageStateModel + AnalyzePerception + MCPToolRegistry + VerifyEngine + 19 Phase 4 contracts)
    - 26-rule constitution
    - R25 (Context Capture MUST NOT) — enforced mechanically by T4B-014
governing_rules:
  - Constitution R19 (Rollup per Phase)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R25 (Context Capture MUST NOT)
---

# Phase 4b — Context Capture Layer v1.0 — Current System State Rollup

> **Summary (~200 tokens):** Phase 4b shipped a deterministic per-audit context capture layer that infers {business, page, audience, traffic, brand} dimensions from URL + lightweight HTML fetch + JSON-LD, plus an intake-pass-through path for consultant-declared values. Every output field is a `ContextField<T> = {value, source, confidence}` triple so downstream phases can reason about evidence quality. Output `ContextProfile` is SHA-256 hashed + Object.frozen + pinned to a new append-only `context_profiles` table. ContextCaptureNode orchestrates the pipeline with explicit halt/resume contract when blocking open_questions fire. HeuristicLoader gains `loadForContext()` filter (12-25 heuristics for typical contexts via manifest-selector matching). R25 (no Playwright / no LLMAdapter / no judgment fields / no silent defaults) verified mechanically by T4B-014. Zero net new LLM cost in MVP. Sets foundation for Phase 5 Browse (safety gating), Phase 6 KB (real loader supersession), Phase 7 Analysis (cost reduction via filtered heuristic set), Phase 8 Orchestrator (AuditState T135 extends fwd-stub).

> **Governed by:** Constitution R19. Rollup size cap: 300 lines / ~3000 tokens.

---

## 1. Active modules introduced this phase

| Module | Path | Purpose | Tests |
|---|---|---|---|
| ContextProfile schema | `packages/agent-core/src/types/context-profile.ts` | Top-level Zod schema + 6 LOCKED enums (BusinessArchetype 6 vals / PageType 12 vals / ContextSource 6 vals / ContextDimension 5 vals / ConfidenceThresholdAction 3 vals / InferenceMethod 3 vals) + ContextField factory + ProvenanceEntry + OpenQuestion | `tests/conformance/context-profile-schema.test.ts` (14 tests; AC-01) |
| URLPatternMatcher | `packages/agent-core/src/context/URLPatternMatcher.ts` | URL → PageType classifier (12 curated patterns; pure WHATWG URL; confidence 0.9 on hit) | `tests/conformance/url-pattern-matcher.test.ts` (9 tests; AC-02) |
| HtmlFetcher | `packages/agent-core/src/context/HtmlFetcher.ts` | undici + cheerio HTTP GET; 5s timeout; ETag cache; RobotsChecker-gated; CONTEXT_FETCH_FAILED degradation | `tests/conformance/html-fetcher.test.ts` (10 tests; AC-03) |
| JsonLdParser | `packages/agent-core/src/context/JsonLdParser.ts` | cheerio-based JSON-LD extraction; @graph + array flattening; 3-code warning bus (PARSE_ERROR / MISSING_TYPE / EMPTY_BLOCK) | `tests/conformance/json-ld-parser.test.ts` (13 tests; AC-04) |
| BusinessArchetypeInferrer | `packages/agent-core/src/context/BusinessArchetypeInferrer.ts` | Deterministic archetype inference per plan §2.6 weighting table; tie/close-call (gap <0.15) forces confidence 0.5 to trigger blocking open_question | `tests/conformance/business-archetype-inferrer.test.ts` (14 tests; AC-05) |
| PageTypeInferrer | `packages/agent-core/src/context/PageTypeInferrer.ts` | Cascade: URL pattern (0.9) → JSON-LD type map (0.7-0.9) → DOM/copy heuristics (0.5-0.7) → default; R-13 backward-compat with §07 §7.4 inferredPageType | `tests/conformance/page-type-inferrer.test.ts` (25 tests; AC-06) |
| ConfidenceScorer | `packages/agent-core/src/context/ConfidenceScorer.ts` | Weighted aggregate of 5-dim confidences per plan §2.2; threshold gates ≥0.9 act / 0.6-0.9 use+flag / <0.6 ask; required-field override (R-09) for business.archetype + page.type | `tests/conformance/context-confidence-scorer.test.ts` (21 tests; AC-07 — path deviation per Phase 4b #4) |
| ProvenanceAssembler | `packages/agent-core/src/context/ProvenanceAssembler.ts` | Validates + sorts (dimension, source, inferred_at) + freezes ProvenanceEntry array | Same test file as ConfidenceScorer |
| OpenQuestionsBuilder | `packages/agent-core/src/context/OpenQuestionsBuilder.ts` | Scans 6 dimensions; emits blocking questions for REQUIRED fields with conf <0.6 OR missing; non-blocking warnings 0.6-0.9; sorted (blocking desc, field_path asc) for R-03 hash stability | `tests/conformance/open-questions-builder.test.ts` (14 tests; AC-08) |
| AuditRequest intake schema | `packages/agent-core/src/types/audit-request.ts` | T4B-009 intake extension: goal.primary_kpi REQUIRED; constraints.regulatory non-empty for 6 MVP regulated verticals (pharma/fintech/gambling/healthcare/legal/insurance) | `tests/conformance/audit-request-intake.test.ts` (16 tests; AC-09) |
| CLI clarification prompt | `apps/cli/src/contextClarification.ts` | `promptForClarifications(questions, opts)` — node:readline stdin loop; blocking-only prompts; non-blocking → stderr warn; idempotent on identical replay; test-seam via injected Readable/Writable | `tests/conformance/cli-clarification.test.ts` (10 tests; AC-10) |
| ContextCaptureNode | `packages/agent-core/src/orchestration/nodes/ContextCaptureNode.ts` + `.helpers.ts` | Orchestration pipeline: AuditRequest → HtmlFetcher → JsonLdParser → URL+Business+PageInferrer → ConfidenceScorer → OpenQuestionsBuilder → ProvenanceAssembler → SHA-256 hash → freeze → persist (or graceful CONTEXT_PERSIST_SKIPPED_NO_DB warn); explicit halt/resume contract | `tests/conformance/context-capture-node.test.ts` (9 tests; AC-11) |
| AuditState fwd-stub | `packages/agent-core/src/orchestration/state.ts` | T135 forward-stub: 4 slots (audit_run_id, client_id, current_node, node_status) + 2 Phase 4b slots (context_profile_id, context_profile_hash) + pending_questions; AuditNodeStatusEnum 5 vals (pending/running/halted/complete/failed); Phase 8 T135 extends per R20 cycle | Same test file as ContextCaptureNode |
| context_profiles migration 0004 | `packages/agent-core/src/db/migrations/0004_context_profiles.sql` + Drizzle schema additions | Append-only table (id, audit_run_id, client_id, profile_hash, profile_json, created_at); PL/pgSQL trigger rejects UPDATE/DELETE; FK to audit_runs; RLS-scoped; 3 indexes | `tests/conformance/context-profiles-migration.test.ts` (10 tests; AC-12 — DATABASE_URL gated) |
| HeuristicLoader.loadForContext | `packages/agent-core/src/analysis/heuristics/loader.ts` (extended) | Filter method consuming ContextProfile; value-mapper bridges LOCKED→PRELIMINARY enums (LOCKED-only values like 'service' / 'post_purchase' / 'category' / 'blog' / 'about' skip their dimension's filter = "applies to all" semantics) | `tests/conformance/heuristic-loader-context-filter.test.ts` (11 tests; AC-13) |
| R25 compliance test | `packages/agent-core/tests/constitution/R25.test.ts` | 4-rule AST/text scan: no Playwright/@playwright imports in src/context/*; no LLMAdapter/@anthropic-ai/sdk imports; no judgment fields in ContextProfile Zod schema; no silent defaults (source:'default' paired with confidence:0) | Self-contained (4 tests; AC-14) |
| Phase 4b integration test | `packages/agent-core/tests/integration/context-capture.test.ts` | 5-fixture end-to-end: full intake / URL-only / regulated-no-constraints / low-confidence-blocking / fetch-fails; wall-clock 1.73s vs <2min target | 7 tests; AC-15 |

---

## 2. Data contracts now in effect

| Contract | Location | Spec | Notes |
|---|---|---|---|
| `ContextProfile` | `packages/agent-core/src/types/context-profile.ts` | §37 §37.2 + REQ-CONTEXT-OUT-001 | NEW shared contract; SHAPE LOCK per impact.md §1 |
| `ContextField<T>` | Same file (factory) | AC-01 | Every dimension field is `{value, source, confidence}` triple |
| `BusinessArchetypeEnum` (6 LOCKED) | Same file | AC-05 + R-07 + Out-of-Scope act-007 | D2C / B2B / SaaS / marketplace / lead_gen / service |
| `PageTypeEnum` (12 LOCKED) | Same file | §37 §37.1.2 + REQ-CONTEXT-DIM-PAGE-001 | home / PLP / PDP / cart / checkout / post_purchase / category / landing / blog / about / pricing / comparison |
| `ContextSourceEnum` (6 LOCKED) | Same file | §37 §37.2 | user / url_pattern / schema_org / copy_inference / layout_inference / default |
| `ConfidenceThresholdActionEnum` (3 LOCKED) | Same file | REQ-CONTEXT-OUT-001 | act / use_and_flag / ask |
| `InferenceMethodEnum` (3 LOCKED) | Same file | R25.1 item 10 | deterministic / heuristic / llm_judge (llm_judge FORBIDDEN in MVP per R25) |
| `ProvenanceEntry` | Same file | §37.2 | Single audit row per dimension+source emission |
| `OpenQuestion` | Same file | REQ-CONTEXT-OUT-002 | `{field_path, question, blocking, dimension?}` |
| `AuditRequest.intake` extension | `packages/agent-core/src/types/audit-request.ts` | §18 + REQ-GATEWAY-INTAKE-001..002 | T4B-009; consumed by ContextCaptureNode + Phase 6 gateway service |
| `AuditState` (fwd-stub) | `packages/agent-core/src/orchestration/state.ts` | T135 Phase 8 prereq (extends) | Phase 4b ships 6 slots; Phase 8 extends with PageStateModel + Finding slots per R20 |
| `ClarificationAnswer` | Both `apps/cli/src/contextClarification.ts` + `orchestration/state.ts` | T4B-010 + T4B-011 contract | Cross-package shared shape; locally declared in both per type-only-import discipline |
| `context_profiles` DB table | `db/migrations/0004` + `db/schema.ts` | §13 + AC-12 | Append-only (R7.4); RLS-scoped (R7.2); 3 indexes |

---

## 3. System flows now operational

### Flow: per-audit context capture

**Trigger:** new AuditRequest enters Phase 8 orchestrator (eventually); Phase 4b standalone testable via `ContextCaptureNode.run({request, state})`.

**Steps:** (1) Validate AuditRequest intake schema (rejects regulated-vertical-without-constraints). (2) HtmlFetcher single GET via undici (5s timeout, RobotsChecker-gated; degrades to URL-only on failure). (3) JsonLdParser flattens @graph + array roots; emits warnings for malformed blocks. (4) Inferrers run sequentially (URLPatternMatcher → BusinessArchetypeInferrer → PageTypeInferrer; deterministic; pure cheerio + regex). (5) ConfidenceScorer aggregates per plan §2.2 weights; threshold-gates. (6) OpenQuestionsBuilder surfaces blocking + non-blocking questions per R-09. (7) ProvenanceAssembler validates+sorts+freezes audit trail. (8) ContextProfile composed + SHA-256 canonical-JSON hashed + Object.frozen + Zod-validated. (9) Persist to `context_profiles` (or log CONTEXT_PERSIST_SKIPPED_NO_DB warn). (10) Halt branch: if blocking open_questions exist, return halted state (no persist); resume() re-runs pipeline with answers folded into synthetic AuditRequest.

**Output:** `{state, profile?, blocking_questions?}` per ContextCaptureNodeResult.

**Spec:** REQ-CONTEXT-FLOW-001 + REQ-CONTEXT-OUT-001..003 + R-11.

### Flow: heuristic library filtering by context

**Trigger:** Phase 6+ caller invokes `heuristicLoader.loadForContext(profile)`.

**Steps:** (1) loadAll() returns all heuristics from filesystem. (2) Value-mapper converts ContextProfile.business.archetype.value / page.type.value / traffic.device_priority.value → preliminary enum values; LOCKED-only values without preliminary counterpart map to null. (3) matchesSelector() filter: archetype + page_type + device must all match (or null → skip that dimension's filter). (4) Filtered set returned (target 12-25 for typical contexts when library ≥40; 8-25 acceptable when <40 per AC-13 v0.2 patch).

**Output:** `HeuristicExtended[]` (12-25 typical; 8-25 acceptable).

**Spec:** REQ-CONTEXT-DOWNSTREAM-001 + R-13.

### Flow: CLI clarification halt/resume

**Trigger:** ContextCaptureNode.run() returns halted state with blocking_questions.

**Steps:** (1) Caller (Phase 8+ orchestrator OR apps/cli/src/commands/audit.ts) passes blocking_questions to `promptForClarifications(questions)`. (2) Prompt reads stdin line-by-line for each blocking question. (3) Returns `ClarificationAnswer[]` with source:'user', confidence:1.0. (4) Caller invokes `ContextCaptureNode.resume({state, answers})`. (5) resume() folds answers into synthetic AuditRequest + re-runs run() (idempotent — same intake + answers → same profile_hash).

**Output:** completed ContextProfile with user-source overrides merged.

**Spec:** REQ-CONTEXT-OUT-002 + R-15 + User Story 3.

---

## 4. Known limitations carried forward

| Limitation | Phase to resolve | Workaround in place |
|---|---|---|
| context_profiles AC-12 + AC-17 DB-dependent tests require DATABASE_URL provisioning | Phase 5 (DB infra) | T4B-011 + T4B-015 exercise schema indirectly via Drizzle compile-time + CONTEXT_PERSIST_SKIPPED_NO_DB warn path |
| LLM-tagged context inference (archetype + awareness + decision_style) | Phase 13b master track | MVP forbids LLM in context layer per R25.1 item 10; deterministic-only inference; consultant override via blocking question |
| Per-traffic-source heuristic segmentation | Phase 13b | Coarse `traffic.device_priority` filter only; share/creative_or_message fields populated but unused by T4B-013 filter |
| Heuristic weight modifiers from ContextProfile | Phase 13b | T4B-013 filter only; no weight rebalancing per R-13 |
| Multi-page context aggregation | Phase 8 | One ContextProfile per audit even when AuditRequest has multi-URL inputs |
| Conversion-rate prediction | Permanent non-goal (R5.3 + GR-007) | R25 forbids judgment fields; T4B-014 enforces mechanically |
| Authenticated-page context capture | Permanent non-goal (PRD §3.2) | No login flow in HtmlFetcher; cookies/storage not propagated |
| Business archetypes outside D2C/B2B/SaaS/marketplace/lead_gen/service (publisher, non-profit, content-subscription, education, government) | Phase 13b | Out-of-Scope act-007; low-confidence on inference → blocking question for consultant manual override |
| Regulated verticals beyond 6 MVP (cannabis, firearms, adult_content, tobacco_or_vape, alcohol, financial_advice_or_RIA, telehealth) | Phase 13b | Out-of-Scope act-008; consultant manually populates constraints.regulatory; no auto-rejection or warn-on-uncertain in v1.0 |
| LOCKED-only enum values (`service` archetype; `post_purchase`/`category`/`blog`/`about` page types) absent from PRELIMINARY heuristic manifest enums | Phase 13b (full enum reconciliation) | T4B-013 value-mapper skips dimension filter when LOCKED-only value present ("applies to all" semantics); representative test coverage in T4B-013 |
| R10.1 ≤300 LOC soft target exceeded on ContextCaptureNode.ts (356) + helpers.ts (350) | Phase 8 AuditGraph refactor | Stage 2.5 cavecrew reviewer accepted; coupling justified for deterministic-hashing contract |
| `superpowers:code-reviewer` agent unavailable mid-session | Future Stage 2.5 dispatches | Used `caveman:cavecrew-reviewer` fallback (clean APPROVE verdict at .phase-state/4b/code-review-findings.yaml) |
| usage-guard.mjs cost-tracking semantic bug (cumulative-vs-delta concept mismatch; banner reads ~850% phase ceiling) | Phase 5 polish | Cost ceiling ENFORCEMENT DISABLED per CLAUDE.md §15.1 (2026-05-15); tracking-only; informational |

---

## 5. Open risks for next phase

| Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| Phase 6 T106 FileSystemHeuristicLoader supersedes Phase 4b's loader stub | If T106 changes loader signature, T4B-013 filter contract may need adapter shim | Phase 6 owner | T4B-013 already added `opts.heuristics` test seam; Phase 6 T106 should preserve `loadAll()` + `loadForContext()` method names + signatures |
| Phase 8 T135 AuditState extends Phase 4b fwd-stub | Phase 8 extension is additive but new slots may force Phase 4b orchestration node to handle wider state shapes | Phase 8 owner | T4B-011 reads only `state.audit_run_id`, `state.client_id`, `state.current_node`, `state.node_status`, `state.pending_questions`, `state.context_profile_*`; new Phase 8 slots safe if additive |
| Phase 7 EvaluateNode consumes ContextProfile for prompt heuristic filtering | If Phase 7 hits the AC-13 8-25 lower bound (Phase 0b only ships 30 heuristics; filter may produce <8 for niche contexts) | Phase 7 owner | AC-13 v0.2 patch allows ASK-FIRST escalation when filter count <8 OR >25; Phase 7 should call out filter size in EvaluateNode telemetry |
| LOCKED→PRELIMINARY enum mismatch will surface as Phase 13b spec scope | Phase 13b master track must reconcile by updating PRELIMINARY enums + ALL 30 real heuristics + 3 skeleton fixtures | Phase 13b roadmap owner | Mapper approach is reversible — when Phase 13b extends preliminary enums, mapper becomes identity function; no breaking change at consumer sites |
| Cost-tracker fragility — banner reads 850% phase ceiling | Operational visibility only (ENFORCEMENT DISABLED) | Phase 5 polish | Fix options: (a) track cost-at-phase-start snapshot; (b) reset transcript cost daily; (c) drop per-phase ceiling and enforce only context; recommend (a) |

---

## 6. Conformance gate status

| Test | Status | Last run |
|---|---|---|
| Phase 4b conformance suite (T4B-001..T4B-015 conformance + integration) | ✅ 187/187 GREEN | 2026-05-16 at HEAD `3985dc1` (offline path; vitest 1.54s) |
| R25 compliance (T4B-014) | ✅ 4/4 GREEN | Same |
| Cumulative agent-core (full suite) | 794/958 pass; 7 fail (DATABASE_URL infra carry-overs); 34 skipped; 123 todo | 45.99s wall-clock |
| `pnpm --filter @neural/agent-core typecheck` | ✅ clean | Same |
| `pnpm --filter @neural/agent-core lint` | ✅ clean | Same |
| `pnpm --filter @neural/cli typecheck` | ✅ clean | Same |

---

## 7. What Phase 5 should read

When Phase 5 starts, recommended reading order:

1. This file (`phase-4b-current.md`) — YOU ARE HERE
2. `docs/specs/mvp/phases/phase-5-browse-mvp/README.md`
3. `docs/specs/mvp/phases/phase-5-browse-mvp/spec.md`
4. `docs/specs/mvp/phases/phase-5-browse-mvp/tasks.md`
5. Specific REQ-IDs cited per task (open only what you need)
6. R20 propagation note from this phase (`impact.md` §downstream_impact when added) for ContextProfile consumption sites

Do NOT load all Phase 4b src files. Read the sibling validation doc (`phase-4b-validation.md`) for module dependency graph + AC→impl→test traceability matrix — those answer most cross-reference questions in ~20 min eyes-on review.

---

## 8. Cost + time summary (this phase)

| Metric | Target | Actual |
|---|---|---|
| Duration (sessions) | 1-2 (planned) | 3 (across 2026-05-15 + 2026-05-16 morning + 2026-05-16 evening) |
| Engineering hours | ~22.5h ±3 (per plan §4) | ~8-10h actual (heavy parallelism; subagent dispatch) |
| LLM spend on dev | <$5 (high-attention phase ceiling) | ~$85 (note: cost-tracker fragile per Open Threads #1; banner mis-reads; actual phase-only delta unknown) |
| Tasks completed | 15/15 | 15/15 ✅ |
| Total impl commits | ~15 | 15 (excl. handoff + Stage 4 EXIT artifacts) |
| Test count | ~150-200 target | 187/187 Phase 4b offline GREEN |
