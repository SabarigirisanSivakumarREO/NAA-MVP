---
title: Phase 4 — Safety + Infrastructure + Cost
artifact_type: spec
status: draft
version: 0.3
created: 2026-04-27
updated: 2026-04-28
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (F-014 cost/budget, F-016 safety, F-017 audit logging)
  - docs/specs/mvp/constitution.md (R7 DB+Storage, R8 cost+safety, R9 adapter, R10 reproducibility, R14 cost accountability)
  - docs/specs/mvp/architecture.md (§6.4, §6.5)
  - docs/specs/mvp/tasks-v2.md (T066-T080; T077-T079 reserved)
  - docs/specs/final-architecture/11-safety-cost.md
  - docs/specs/final-architecture/13-data-layer.md (12 tables + RLS + append-only)
  - docs/specs/final-architecture/34-observability.md (22 audit_event types)
  - docs/specs/mvp/phases/phase-2-tools/impact.md (SafetyClass enum + MCPToolRegistry consumed)
  - docs/specs/mvp/phases/phase-3-verification/impact.md (FailureClassifier consumed; SafetyCheck produces safety_blocked failures)

req_ids:
  - REQ-SAFETY-CLASSIFIER-001
  - REQ-SAFETY-CHECK-001
  - REQ-SAFETY-DOMAIN-POLICY-001
  - REQ-SAFETY-CIRCUIT-BREAKER-001
  - REQ-SAFETY-005          # v0.3 — robots/ToS hard rules per §11.1.1
  - REQ-DATA-SCHEMA-001
  - REQ-DATA-RLS-001
  - REQ-DATA-APPEND-ONLY-001
  - REQ-OBSERVE-AUDIT-LOG-001
  - REQ-OBSERVE-SESSION-RECORDER-001
  - REQ-LLM-ADAPTER-001
  - REQ-LLM-TEMPERATURE-GUARD-001
  - REQ-LLM-FAILOVER-001
  - REQ-LLM-COST-LOG-001
  - REQ-STORAGE-ADAPTER-001
  - REQ-SCREENSHOT-STORAGE-001
  - REQ-STREAM-EMITTER-001

impact_analysis: docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md
breaking: false
affected_contracts:
  - LLMAdapter
  - AnthropicAdapter
  - TemperatureGuard
  - BudgetGate
  - StorageAdapter
  - PostgresStorage
  - ScreenshotStorage
  - LocalDiskStorage
  - ActionClassifier
  - SafetyCheck
  - DomainPolicy
  - CircuitBreaker
  - RobotsChecker          # v0.3 — robots.txt + ai-agent.txt utility (REQ-SAFETY-005)
  - AuditLogger
  - SessionRecorder
  - StreamEmitter
  - DBSchema (12 tables + context_profiles slot reserved for Phase 4b T4B-012)
  - LLMCallRecord
  - AuditEvent

delta:
  new:
    - Phase 4 spec — largest single-phase contract surface in MVP (18 contracts; first DB schema; first LLM call)
    - AC-01..AC-15 stable IDs
    - R-01..R-15 functional requirements
    - v0.2 — AC-05 enumerates the 5 append-only tables explicitly (analyze finding F-17)
    - v0.2 — AC-09 conformance test path notes the carve-out (allows any temp on classify/extract/other) explicitly (analyze finding F-27)
    - v0.2 — AC-10 specifies cost estimation rounds UP to nearest $0.01 (analyze finding F-09)
    - v0.2 — AC-12 enumerates all 10 RLS-protected client-scoped tables explicitly (analyze finding F-07)
    - v0.3 — AC-16 + R-16 added for §11.1.1 RobotsChecker (REQ-SAFETY-005); Phase 4b T4B-003 HtmlFetcher imports this utility
    - v0.3 — AC-17 + R-17 added for context_profiles table slot reservation in T070 schema baseline (Phase 4b T4B-012 lands the actual migration)
  changed:
    - v0.1 → v0.2 — analyze-driven AC tightening (F-07, F-09, F-17, F-27); no scope changes
    - v0.2 → v0.3 — adds §11.1.1 robots/ToS utility (REQ-SAFETY-005) + context_profiles slot reservation; surfaces Phase 4b coordination dependencies
  impacted:
    - Constitution R7.1/R7.2/R7.4 — first concrete enforcement (Drizzle, RLS, append-only triggers)
    - Constitution R10 — TemperatureGuard adapter-boundary enforcement
    - Constitution R14 — atomic LLM call logging, pre-call budget gate, per-call failover
    - Phase 0 stub `db:migrate` script — Phase 4 replaces with real Drizzle migrations
    - Phase 4b — RobotsChecker is a prereq for T4B-003 HtmlFetcher; context_profiles table slot is a prereq for T4B-012 migration (v0.3)
  unchanged:
    - AC-01..AC-15 stable IDs and acceptance scenarios (R18 append-only — v0.3 adds AC-16/AC-17 only)
    - R-01..R-15 functional requirement statements
    - Out of Scope, Constitution Alignment Check sections

governing_rules:
  - Constitution R7 (DB + Storage)
  - Constitution R8 (Cost + Safety)
  - Constitution R9 (Adapter Pattern)
  - Constitution R10 (Reproducibility / Temperature)
  - Constitution R14 (Cost Accountability)
  - Constitution R17, R18, R20, R22, R23
---

# Feature Specification: Phase 4 — Safety + Infrastructure + Cost

> **Summary (~150 tokens):** Infrastructure spine. **12 MVP tasks** (T066-T076 + T080). Lands four safety primitives (ActionClassifier consuming Phase 2's SafetyClass, runtime SafetyCheck gating sensitive actions, DomainPolicy registry, CircuitBreaker), the first real **Drizzle schema (T070, 12 tables + RLS + append-only DB triggers + initial migration + extensions migration)**, audit observability (AuditLogger to `audit_log` append-only, SessionRecorder emitting 22 event types to `audit_events`), the **first LLM adapter** (LLMAdapter + AnthropicAdapter with TemperatureGuard rejecting temp > 0 on analysis nodes; pre-call BudgetGate per R14.2; atomic logging to `llm_call_log` per R14.1; per-call failover 3+2 retries per R14.5), Storage + ScreenshotStorage adapters (LocalDisk in MVP; R2 ready), StreamEmitter, and a Phase 4 integration test. Highest cross-cutting surface — every later phase depends on these contracts.

**Feature Branch:** `phase-4-safety-infra-cost` (created at implementation time)
**Input:** Phase 4 scope from `docs/specs/mvp/phases/INDEX.md` row 4 + `tasks-v2.md` T066-T080 (12 MVP tasks; T077-T079 reserved)

---

## Mandatory References

1. `docs/specs/mvp/constitution.md` — R7 (Drizzle + RLS + append-only); R8 (cost cap + rate limit + HITL); R9 (LLM, Storage, ScreenshotStorage adapters); R10 (TemperatureGuard at adapter boundary); R14 (cost accountability — atomic logging, budget gate, failover, per-client attribution); R17-R23.
2. `docs/specs/mvp/PRD.md` §F-014 (cost & budget), §F-016 (safety + warm-up), §F-017 (audit logging).
3. `docs/specs/mvp/architecture.md` §6.4 (no new top-level deps; uses pinned Anthropic SDK / pg / Drizzle / BullMQ — all wrapped in adapters here) + §6.5 (adapter file decision tree).
4. `docs/specs/mvp/tasks-v2.md` T066-T080 (T077-T079 reserved).
5. `docs/specs/final-architecture/11-safety-cost.md` — safety + cost canonical.
6. `docs/specs/final-architecture/13-data-layer.md` — 12-table schema canonical (T070 primary reference).
7. `docs/specs/final-architecture/34-observability.md` — 22 audit_event types.
8. Phase 2 impact.md (SafetyClass enum, MCPToolRegistry consumed) + Phase 3 impact.md (FailureClassifier consumed).

---

## Constraints Inherited from Neural Canonical Specs

- **Tech stack** (architecture.md §6.4 — all activated in Phase 4):
  - Anthropic SDK `@anthropic-ai/sdk` — only imported in `adapters/AnthropicAdapter.ts`
  - PostgreSQL 16 + pgvector (Phase 0 container)
  - Drizzle ORM — only imported in `db/` directory + `adapters/PostgresStorage.ts`
  - `pg` driver — only imported in Drizzle adapter file
  - BullMQ — pinned but Phase 4 only sets up the StreamEmitter SSE plumbing; queue work in Phase 8
  - Sharp — already in Phase 1+2; not new here
- **R7.1 Drizzle-only DB access** — no raw SQL except for migrations + RLS policies + append-only triggers (those are SQL by necessity).
- **R7.2 RLS enabled** on all client-scoped tables: `clients`, `audit_runs`, `findings`, `screenshots`, `sessions`, `audit_log`, `rejected_findings`, `page_states`, `state_interactions`, `finding_rollups`, `reproducibility_snapshots`, `audit_requests`. `SET LOCAL app.client_id` MUST be set on every transaction by `PostgresStorage`.
- **R7.4 Append-only tables** never UPDATEd or DELETEd: `audit_log`, `rejected_findings`, `finding_edits`, `llm_call_log`, `audit_events`. Enforcement via DB triggers (CHECK / RAISE EXCEPTION on UPDATE/DELETE) AND Drizzle table definitions that omit `update`/`delete` methods at the type level.
- **R8.1 Audit budget cap** — `audit_runs.budget_remaining_usd` decrements; when ≤ 0, audit terminates with `completion_reason='budget_exceeded'`.
- **R8.2 Page budget** — `analysis_budget_usd` per page (default $5); skip remaining steps when exhausted.
- **R8.3 Rate limiting structural** — Phase 2 RateLimiter consumed; Phase 4's CircuitBreaker is the per-domain failure-threshold layer (orthogonal to per-domain rate caps).
- **R8.4 Sensitive actions HITL** — SafetyCheck on `requires_hitl` actions emits a pause event; orchestrator (Phase 5) routes to human approval.
- **R9 Adapter pattern (third adapter category lands here):** LLMAdapter, StorageAdapter, ScreenshotStorage are the three new adapter contracts. EACH external dep (`@anthropic-ai/sdk`, `pg/Drizzle`, R2 client deferred) is imported ONLY in its adapter file. ESLint rule `no-restricted-imports` lands here (deferred from Phase 1 — Phase 4 has enough adapters to justify the rule).
- **R10 TemperatureGuard** — at the LLMAdapter boundary, `temperature > 0` on `evaluate` / `self_critique` / `evaluate_interactive` operation classes is REJECTED with a typed error. Operation class is a request-time parameter; LLM cannot bypass.
- **R14.1 Atomic LLM logging** — every `LLMAdapter.complete()` call atomically writes a row to `llm_call_log` BEFORE returning to caller, with model + tokens + cost + duration + cache_hit. No silent calls.
- **R14.2 Pre-call budget gate** — caller passes `audit_run_id`; adapter looks up `budget_remaining_usd`; estimates cost from prompt token count via `getTokenCount()`; if `estimated_cost > budget_remaining_usd`, returns `BudgetExceededError` instead of calling the API.
- **R14.4 Per-client cost attribution** — `llm_call_log.audit_run_id → audit_runs.client_id` chain queryable via SQL.
- **R14.5 Per-call failover** — primary `claude-sonnet-4-*` 3 retries; on persistent failure, fallback adapter (deferred to v1.2 per architecture.md §6.4 — but the failover protocol scaffolds in Phase 4 to throw `LLMUnavailableError` after 3 retries; v1.2 plugs in GPT-4o adapter).
- **R14.6 model_mismatch flag** — when failover occurs (post-v1.2), finding's `model_mismatch=true` so consultant UI shows badge. Phase 4 sets up the field; Phase 7 populates.
- **No `console.log`** (R10.6) — Pino with new correlation fields per phase: `audit_run_id`, `client_id`, `llm_call_id`, `event_type`, `safety_class`, `domain`.
- **No `any` without TODO+issue** (R2.1).

---

## User Scenarios & Testing

### User Story 1 — A Phase 5 orchestrator can safely + accountably invoke browser actions and LLM calls (Priority: P1) 🎯 MVP

After Phase 4: Phase 5's BrowseNode wraps every action invocation in `SafetyCheck.assertAllowed(toolName, domain, audit_run)`; on `requires_hitl`, the action pauses and emits an `audit_events.hitl_requested` event. Phase 5's analysis-prep nodes (later wired in Phase 7) call `LLMAdapter.complete({ operation: 'evaluate', ... })`; TemperatureGuard rejects temp > 0; BudgetGate skips on exhaustion; the call is logged atomically to `llm_call_log`; on persistent failure, `LLMUnavailableError` propagates after 3 retries.

**Why this priority:** Without Phase 4, Phase 5 cannot persist anything (no schema), can't safely call tools (no SafetyCheck), can't call LLMs (no adapter). It's the foundation under everything analytical.

**Independent Test:** `pnpm -F @neural/agent-core test integration/phase4`.

**Acceptance Scenarios:**

1. **Given** Drizzle migrations applied, **When** `pnpm db:migrate` runs on a fresh Postgres, **Then** all 12 tables exist, RLS enabled on each, append-only triggers fire on UPDATE/DELETE attempts.
2. **Given** an `LLMAdapter.complete({ operation: 'evaluate', temperature: 0.5, ... })` call, **When** TemperatureGuard inspects, **Then** the call is REJECTED with `TemperatureGuardError` BEFORE reaching Anthropic.
3. **Given** an audit_run with `budget_remaining_usd = 0.10` and an estimated call cost of $0.50, **When** BudgetGate inspects, **Then** the call is REJECTED with `BudgetExceededError` and `llm_call_log` records the *attempt* (with `cost_usd=0` + `outcome='budget_blocked'`).
4. **Given** a successful LLM call, **When** `LLMAdapter.complete()` returns, **Then** a row is in `llm_call_log` with model + prompt_tokens + completion_tokens + cost_usd + duration_ms + cache_hit + audit_run_id, atomically written before return.
5. **Given** the primary Anthropic API returning 5xx, **When** LLMAdapter retries 3 times, **Then** on persistent failure it throws `LLMUnavailableError` (v1.2 will failover to GPT-4o; Phase 4 just scaffolds the protocol).
6. **Given** a `requires_hitl` tool invocation, **When** SafetyCheck fires, **Then** an `audit_events` row of type `hitl_requested` is written and `FailureClassifier.classify({ kind: 'safety' })` returns `safety_blocked`.
7. **Given** an unknown domain, **When** DomainPolicy.classify(url) runs, **Then** result is `unknown` (10/min rate cap from Phase 2 RateLimiter applies); `trusted` returns 30/min cap; `blocked` returns immediate refusal.
8. **Given** 3 consecutive failures on the same domain, **When** CircuitBreaker.tripThreshold reaches, **Then** the domain is blocked for 1 hour; subsequent attempts return `CircuitBreakerOpen` immediately.
9. **Given** an audit run streaming events, **When** StreamEmitter publishes 5 events, **Then** an SSE consumer receives all 5 with correct ordering and types (Phase 9 dashboard will consume; Phase 4 just scaffolds).
10. **Given** a screenshot buffer, **When** `ScreenshotStorage.put(buf)` runs in dev, **Then** it writes to `LocalDiskStorage` returning a stable path; in prod (R2 deferred to post-MVP-pilot per PRD §3.2), the same interface accepts an R2 client.
11. **Given** the integration test suite, **When** it runs against fresh DB + LocalDisk, **Then** all 15 ACs pass within 2 minutes.

### Edge Cases

- **Anthropic API rate limit (429):** counts as a retry-eligible failure; backoff per attempt; bookkeeping in `llm_call_log`.
- **Drizzle migration partial failure (e.g., extension creation race):** migration is wrapped in a transaction; on failure, rollback. Conformance test uses a fresh DB to verify atomicity.
- **RLS misconfiguration (forgot to set `app.client_id`):** policy denies; query returns empty result; test verifies that omitting the SET fails the query for cross-client data.
- **Append-only DB trigger fails to fire (mis-grant):** conformance test attempts UPDATE on append-only table and expects `ERROR: append-only violation`; if it succeeds, R7.4 violated → R23 kill trigger.
- **TemperatureGuard bypass attempt** (e.g., constructing the request bypassing the adapter): R9 adapter pattern enforces — direct `@anthropic-ai/sdk` import outside `AnthropicAdapter.ts` is grep-detected and ESLint-rejected.
- **Budget race** (parallel LLM calls debiting the same audit_run): use Postgres advisory lock or row-level lock around `audit_runs.budget_remaining_usd` UPDATE during call accounting.

---

## Acceptance Criteria *(stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked task |
|----|-----------|----------------------|-------------|
| AC-01 | `ActionClassifier.classify(toolName)` returns the SafetyClass enum value matching MCPToolRegistry's safetyClass for that tool name (Phase 2 source of truth) | `tests/conformance/action-classifier.test.ts` | T066 |
| AC-02 | `SafetyCheck.assertAllowed(toolName, domain, auditRun)` throws `SafetyBlockedError` for `requires_hitl` (writing `audit_events` of type `hitl_requested`) and `forbidden`; passes through `safe`; checks DomainPolicy + CircuitBreaker for `requires_safety_check` | `tests/conformance/safety-check.test.ts` | T067 |
| AC-03 | `DomainPolicy.classify(url)` returns `trusted` / `unknown` / `blocked`; configurable via `domain_policy` config | `tests/conformance/domain-policy.test.ts` | T068 |
| AC-04 | `CircuitBreaker` trips after 3 consecutive failures on a domain; blocks for 1 hour; resets after window; conformance test simulates failures + verifies block window | `tests/conformance/circuit-breaker.test.ts` | T069 |
| AC-05 | `pnpm db:migrate` applies migrations 0001 (initial 7 tables) + 0002 (5 extension tables + ALTER on findings); 12 tables exist; RLS enabled on all 10 client-scoped tables; append-only triggers fire on UPDATE/DELETE for the **5 append-only tables: `audit_log`, `rejected_findings`, `finding_edits`, `llm_call_log`, `audit_events`** (each has its own BEFORE UPDATE OR DELETE trigger raising 'append-only violation'). | `tests/conformance/db-schema.test.ts` + `tests/conformance/db-rls.test.ts` + `tests/conformance/db-append-only.test.ts` (parameterized over 5 append-only tables) | T070 |
| AC-06 | `AuditLogger.log(entry)` appends to `audit_log` table; verifies UPDATE/DELETE attempts fail at DB level | `tests/conformance/audit-logger.test.ts` | T071 |
| AC-07 | `SessionRecorder.recordEvent(event)` writes to `audit_events`; supports all 22 event types per §34.4 (validated by Zod enum) | `tests/conformance/session-recorder.test.ts` | T072 |
| AC-08 | `LLMAdapter.complete({ operation, ... })` calls AnthropicAdapter with `claude-sonnet-4-*`; atomically writes `llm_call_log` row before returning; sets correlation fields | `tests/conformance/llm-adapter.test.ts` (uses MockAnthropicAdapter) | T073 |
| AC-09 | TemperatureGuard rejects `temperature > 0` on operation = `evaluate` / `self_critique` / `evaluate_interactive` (the 3 reproducibility-bound ops per R10 + R22.6 punch-list); returns `TemperatureGuardError`. For other operation classes (`classify`, `extract`, `other`), allows any temperature in [0, 1]. **Conformance test covers BOTH directions:** (a) 3 reject cases for the bound ops at temp=0.5; (b) 3 allow cases for non-bound ops at temp=0.5. | `tests/conformance/temperature-guard.test.ts` (parameterized over operation enum) | T073 |
| AC-10 | BudgetGate computes `estimated_cost = ceil(getTokenCount(prompt) * model_per_token_rate * 100) / 100` (rounds UP to nearest $0.01 to avoid false-accept on rounding errors); if `estimated_cost > budget_remaining_usd`, throws `BudgetExceededError` and writes `llm_call_log` row with `outcome='budget_blocked'` (cost_usd=0). | `tests/conformance/budget-gate.test.ts` (covers exact-match boundary + $0.001-overage rounding case) | T073 |
| AC-11 | LLMAdapter failover protocol: on Anthropic 5xx or timeout, retry 3 times with exponential backoff; on persistent failure, throw `LLMUnavailableError`. v1.2 will plug fallback adapter via the same protocol — Phase 4 verifies the retry shape and error propagation | `tests/conformance/llm-failover.test.ts` (uses MockAnthropicAdapter that fails 5x) | T073 |
| AC-12 | `StorageAdapter` (PostgresStorage implementation) supports CRUD on the **10 RLS-protected client-scoped tables**: `clients`, `audit_runs`, `findings`, `screenshots`, `sessions`, `page_states`, `state_interactions`, `finding_rollups`, `reproducibility_snapshots`, `audit_requests`. `SET LOCAL app.client_id = '<uuid>'` set at start of every transaction (NEVER per-statement). Cross-client query (different `app.client_id`) returns empty for all 10 tables. | `tests/conformance/storage-adapter.test.ts` (parameterized over 10 tables — each gets a cross-client-isolation assertion) | T074 |
| AC-13 | `ScreenshotStorage.put(buf, opts)` writes to LocalDisk in dev; returns stable URL/path; reads back via `get(id)` | `tests/conformance/screenshot-storage.test.ts` | T075 |
| AC-14 | `StreamEmitter.publish(event)` emits SSE-compatible events; Phase 4 tests buffer events and verifies serialization shape (Phase 9 dashboard wiring deferred) | `tests/conformance/stream-emitter.test.ts` | T076 |
| AC-15 | Phase 4 integration test: fresh DB + LocalDisk + MockAnthropicAdapter → migrate → write audit_log + audit_events → 1 LLM call (success) + 1 LLM call (budget exceeded) + 1 LLM call (failover after 3 retries) → 1 screenshot to LocalDisk → all 12 tables queryable; total wall-clock < 2 min | `tests/integration/phase4.test.ts` | T080 |
| AC-16 | `RobotsChecker.isAllowed(url, userAgent)` parses `<root>/robots.txt` (cached per audit) and returns `false` for disallowed paths; checks `ai-agent.txt` as fallback per REQ-RATE-003; emits `ROBOTS_TXT_DISALLOWED` warning with the matched directive; UA spoofing of search-engine crawlers (Googlebot etc.) is rejected per REQ-SAFETY-007. | `tests/conformance/robots-checker.test.ts` | T080a (NEW v0.3) |
| AC-17 | T070 Drizzle schema reserves a `context_profiles` table slot (column shapes documented in §13 + Phase 4b impact.md §6); T070 itself does NOT create the table — Phase 4b T4B-012 owns the migration. T070 conformance asserts the schema baseline does not collide with the Phase 4b shape. | `tests/conformance/db-schema.test.ts` (extended) | T070 (NEW v0.3 sub-acceptance) |

AC-NN IDs append-only per Constitution R18 — AC-16 + AC-17 added in v0.3.

---

## Functional Requirements

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST implement `ActionClassifier` consuming Phase 2's MCPToolRegistry SafetyClass | F-016 | 11-safety-cost.md |
| R-02 | System MUST implement `SafetyCheck` runtime gate with HITL emission to `audit_events` | F-016 | 11-safety-cost.md |
| R-03 | System MUST implement `DomainPolicy` registry (trusted / unknown / blocked) | F-016 | 11-safety-cost.md |
| R-04 | System MUST implement `CircuitBreaker` (3-failure / 1-hour) | F-016 | 11-safety-cost.md |
| R-05 | System MUST define + migrate the full Drizzle schema (12 tables + RLS + append-only triggers) per §13-data-layer | F-014 + F-017 | 13-data-layer.md |
| R-06 | System MUST implement `AuditLogger` writing to `audit_log` (append-only) | F-017 | 34-observability.md |
| R-07 | System MUST implement `SessionRecorder` writing 22 event types to `audit_events` | F-017 | 34-observability.md |
| R-08 | System MUST implement `LLMAdapter` interface + `AnthropicAdapter` concrete | F-007 | 11-safety-cost.md |
| R-09 | System MUST implement `TemperatureGuard` enforcing R10 at adapter boundary | F-007 + R10 | 11-safety-cost.md |
| R-10 | System MUST implement `BudgetGate` per R14.2 (pre-call cost estimate + skip on exhaustion) | F-014 + R14.2 | 11-safety-cost.md |
| R-11 | System MUST atomically log every LLM call to `llm_call_log` per R14.1 | F-014 + R14.1 | 11-safety-cost.md |
| R-12 | System MUST implement `LLMAdapter` failover protocol per R14.5 (3 retries → typed error; v1.2 will plug fallback adapter) | F-014 + R14.5 | 11-safety-cost.md |
| R-13 | System MUST implement `StorageAdapter` + `PostgresStorage` (Drizzle-based; RLS-aware) | F-017 | 13-data-layer.md |
| R-14 | System MUST implement `ScreenshotStorage` + `LocalDiskStorage` (R2 ready interface; LocalDisk impl in MVP) | F-017 | 13-data-layer.md |
| R-15 | System MUST implement `StreamEmitter` for SSE event publishing (Phase 9 dashboard consumes) | F-017 | 34-observability.md |
| R-16 | System MUST implement `RobotsChecker` (§11.1.1 REQ-SAFETY-005): fetch `<root>/robots.txt` once per audit at audit_setup; parse User-agent + Disallow rules; emit `ROBOTS_TXT_DISALLOWED` warning into PerceptionBundle when path disallowed; do not bypass via UA spoofing (REQ-SAFETY-007); fallback to `ai-agent.txt` per REQ-RATE-003. | F-016 | 11-safety-cost.md §11.1.1 |
| R-17 | System MUST reserve a `context_profiles` table slot in the T070 Drizzle schema baseline. T070 does NOT create the table (Phase 4b T4B-012 owns the migration); T070 schema MUST be designed such that adding `context_profiles` does not require a v0.4 schema rewrite. | F-017 + F-019 | 13-data-layer.md + 37-context-capture-layer.md |

---

## Non-Functional Requirements

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| NF-Phase4-01 | Drizzle migration wall-clock | < 30 s on fresh DB | Pino timing |
| NF-Phase4-02 | LLMAdapter overhead per call (excluding API time) | < 100 ms (TemperatureGuard + BudgetGate + log write) | Pino timing |
| NF-Phase4-03 | RLS query enforcement | 100% — no cross-client leakage in any test | conformance grep + cross-client query test |
| NF-Phase4-04 | Append-only enforcement | 100% — UPDATE/DELETE on any of 5 append-only tables fails at DB level | conformance test attempts each |
| NF-Phase4-05 | Phase 4 integration test wall-clock | < 2 min | Vitest |

---

## Key Entities

- **`LLMAdapter`** (NEW shared) — interface; AnthropicAdapter is the only MVP impl; v1.2 will add OpenAIAdapter
- **`AnthropicAdapter`** (NEW shared) — concrete impl; only file importing `@anthropic-ai/sdk`
- **`TemperatureGuard`** (NEW shared) — operation-class-aware temperature enforcement
- **`BudgetGate`** (NEW shared) — pre-call cost estimation + budget check
- **`StorageAdapter`** + **`PostgresStorage`** (NEW shared) — Drizzle-based DB access
- **`ScreenshotStorage`** + **`LocalDiskStorage`** (NEW shared) — R2-ready interface; LocalDisk impl
- **`ActionClassifier`** + **`SafetyCheck`** + **`DomainPolicy`** + **`CircuitBreaker`** (NEW shared) — safety primitives
- **`AuditLogger`** + **`SessionRecorder`** (NEW shared) — observability
- **`StreamEmitter`** (NEW shared) — SSE publishing
- **DB schema** (NEW shared) — 12 tables defined via Drizzle (clients, audit_runs, findings, screenshots, sessions, audit_log, rejected_findings, page_states, state_interactions, finding_rollups, reproducibility_snapshots, audit_requests) + finding_edits + llm_call_log + audit_events (the append-only ones)
- **`LLMCallRecord`** + **`AuditEvent`** (NEW shared types) — Zod-validated row shapes

See impact.md for full surface analysis.

---

## Success Criteria

- **SC-001:** `pnpm db:migrate` produces a green schema with all 12 tables + RLS + append-only triggers in < 30 s on a fresh DB.
- **SC-002:** No cross-client data leak in any RLS-enforced test (NF-Phase4-03).
- **SC-003:** No UPDATE/DELETE succeeds on append-only tables (NF-Phase4-04).
- **SC-004:** TemperatureGuard rejects temp > 0 on the 3 reproducibility-bound operation classes — verified by conformance test.
- **SC-005:** Every LLM call appears in `llm_call_log` — no silent calls (NF-Phase4 R14.1).
- **SC-006:** No direct `import` of `@anthropic-ai/sdk` / `pg` / `drizzle-orm` outside their adapter files (grep + ESLint).
- **SC-007:** Phase 4 integration test green within 2 min (NF-Phase4-05).

---

## Constitution Alignment Check

- [x] No conversion-rate predictions (R5.3) — N/A (no findings)
- [x] No auto-publish (F-016 warm-up) — Phase 4 doesn't publish; it sets up the schema for Phase 5+ to populate
- [x] No UPDATE/DELETE on append-only tables (R7.4) — DB-level triggers + Drizzle type-level removal
- [x] No vendor SDK imports outside adapters (R9) — third adapter category lands; ESLint rule activates
- [x] Temperature > 0 forbidden on evaluate/self_critique/evaluate_interactive (R10) — TemperatureGuard at adapter boundary
- [x] No heuristic content exposed (R6) — N/A (no heuristics until Phase 6)
- [x] DOES include conformance tests for every AC-NN — see AC table
- [x] DOES carry frontmatter delta block — see frontmatter
- [x] DOES define kill criteria — default block + per-task on T070 + T073 (DB schema + LLM adapter — both > 2 hr, both shared contracts)
- [x] DOES reference REQ-IDs — 16 REQ-IDs cited
- [x] DOES include impact.md — REQUIRED (HIGH risk; 18 contracts)
- [x] R14.1 atomic LLM logging — adapter writes log BEFORE returning to caller
- [x] R14.2 pre-call budget gate — BudgetGate is structural, not advisory
- [x] R14.5 per-call failover — protocol scaffolds; v1.2 plugs fallback impl

---

## Out of Scope

- LLM call routing for analysis (evaluate/self_critique nodes) — Phase 7
- LangGraph orchestration nodes — Phase 5 + Phase 8
- Real R2 (Cloudflare) wiring — keep interface ready; LocalDisk only in MVP per PRD §3.2
- Fallback LLM adapter (GPT-4o) — deferred to v1.2 per PRD §3.2
- Heuristic content + KB encryption — Phase 6 + v1.1
- Dashboard / Clerk — Phase 9
- Reproducibility snapshot composition (uses Phase 4 schema, but assembled in Phase 8)
- Email / Resend — Phase 9
- BullMQ queue work — table scaffolds in Phase 4; queue lands in Phase 8
- CI / GitHub Actions — Phase 9

---

## Assumptions

- **`claude-sonnet-4-*`** is the pinned primary model per architecture.md §6.4. Specific model identifier (e.g., `claude-sonnet-4-20260301`) chosen at adapter registration; spec doesn't pin an exact ID — it pins the *family*.
- **`pgvector`** extension is loaded by Phase 0's stub `db:migrate`; Phase 4 verifies via Drizzle migration.
- **DB triggers** are SQL (raw) per R7.1's exception clause for migrations + RLS policies + append-only enforcement. Not violating R7.1.
- **MockAnthropicAdapter** is provided in test code only (per R3 TDD); never reaches production.
- **Per-token pricing** is hardcoded per model in BudgetGate config; updates as Anthropic publishes new pricing (v1.1+ may externalize).
- **Failover scaffolding** in Phase 4 (3 primary retries → throw) is sufficient for MVP — v1.2 plugs in the fallback adapter at the same protocol seam.
- **22 audit_event types** per §34.4 are exhaustively listed in SessionRecorder's Zod enum; new types require Phase 4 amendment + impact.md cycle.

---

## Next Steps

1. impact.md authored (R20 — HIGH risk, 18 contracts).
2. plan.md drafted.
3. tasks.md drafted (12 MVP tasks).
4. /speckit.analyze (Explore subagent).
5. Phase 4 implementation in a separate session (this is the largest implementation slice in MVP — likely multiple sessions).

---

## Cross-references

- Phase 2 spec, impact (SafetyClass enum, MCPToolRegistry consumed)
- Phase 3 spec, impact (FailureClassifier consumed)
- `docs/specs/mvp/tasks-v2.md` T066-T080
- `docs/specs/final-architecture/11-safety-cost.md` (canonical safety + cost)
- `docs/specs/final-architecture/13-data-layer.md` (canonical schema)
- `docs/specs/final-architecture/34-observability.md` (audit_event types)
- `docs/specs/mvp/constitution.md` R7, R8, R9, R10, R14, R20, R23
