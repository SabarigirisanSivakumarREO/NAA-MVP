---
title: Tasks — Phase 4 Safety + Infra + Cost
artifact_type: tasks
status: draft
version: 0.3
created: 2026-04-27
updated: 2026-04-28
owner: engineering lead
authors: [Claude (drafter)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/plan.md
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md
  - docs/specs/mvp/tasks-v2.md (T066-T080; T077-T079 reserved)
  - docs/specs/mvp/constitution.md (R7, R8, R9, R10, R14, R23)

req_ids:
  - REQ-SAFETY-CLASSIFIER-001
  - REQ-SAFETY-CHECK-001
  - REQ-SAFETY-DOMAIN-POLICY-001
  - REQ-SAFETY-CIRCUIT-BREAKER-001
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

delta:
  new:
    - Phase 4 tasks.md — 12 MVP tasks (T066-T076 + T080); T077-T079 reserved
    - T070 + T073 carry extended kill criteria (HIGH-risk shared contracts; > 2hr each)
    - v0.3 — T080a (RobotsChecker for §11.1.1 / REQ-SAFETY-005) added; T070 acceptance extended with context_profiles slot reservation (AC-17). 13 MVP tasks total (12 baseline + T080a)
    - ESLint no-restricted-imports rule lands in T073
    - v0.2 — T075 LocalDiskStorage SCREENSHOTS_DIR env var documented (analyze finding F-29)
  changed:
    - v0.1 → v0.2 — T075 SCREENSHOTS_DIR clarification; spec AC tightening at v0.2 (F-07/F-09/F-17/F-27)
  impacted: []
  unchanged:
    - All other task bodies; default kill criteria block; dependency graph

governing_rules:
  - Constitution R3 (TDD), R7, R9, R10, R14, R20, R23

description: "Phase 4 task list — 12 MVP tasks; HIGH-risk impact (18 contracts); R7/R10/R14 first concrete enforcement."
---

# Tasks: Phase 4 — Safety + Infrastructure + Cost

**Input:** spec.md + plan.md + impact.md (this folder)
**Prerequisites:** spec.md `approved` AND impact.md `approved` (HIGH risk; explicit engineering lead sign-off)
**Test policy:** TDD per R3.1.
**Organization:** Single user story across 3 pillars (safety / data / LLM-storage).

---

## Task ID Assignment

Phase 4 IDs from `docs/specs/mvp/tasks-v2.md` — T066 through T076 + T080 (12 MVP tasks). T077-T079 reserved (no MVP scope).

---

## Path Conventions (architecture.md §6.5)

Phase 4 touches:
- `packages/agent-core/src/adapters/` (extends Phase 1+2; adds LLMAdapter, AnthropicAdapter, TemperatureGuard, BudgetGate, StorageAdapter, PostgresStorage, ScreenshotStorage, LocalDiskStorage)
- `packages/agent-core/src/safety/` (NEW)
- `packages/agent-core/src/db/` (NEW; schema + 2 migrations + Drizzle client)
- `packages/agent-core/src/observability/` (extends; AuditLogger, SessionRecorder, StreamEmitter)
- `packages/agent-core/src/types/` (extends; LLMCallRecord, AuditEvent)
- `packages/agent-core/tests/conformance/` (16 new tests; +1 boundary grep test)
- `packages/agent-core/tests/integration/phase4.test.ts`
- `packages/agent-core/package.json` (add @anthropic-ai/sdk, drizzle-orm, drizzle-kit, pg)
- ESLint config (add no-restricted-imports rule)

---

## Default Kill Criteria *(R23 — applies to all tasks)*

```yaml
kill_criteria:
  resource:
    token_budget_pct: 85
    wall_clock_factor: 2x
    iteration_limit: 3
  quality:
    - "any previously-passing test breaks"
    - "pnpm test:conformance fails"
    - "implementation reveals spec defect (R11.4)"
    - "RLS bypass detected (cross-client data leakage in any test)"
    - "append-only UPDATE/DELETE succeeds (R7.4 violation)"
    - "TemperatureGuard bypass — temp > 0 reaches Anthropic API on evaluate/self_critique/evaluate_interactive (R10 violation)"
    - "@anthropic-ai/sdk imported outside AnthropicAdapter.ts; pg or drizzle-orm imported outside PostgresStorage.ts (R9 violation)"
    - "LLM call returns without llm_call_log row written (R14.1 violation)"
  scope:
    - "diff introduces forbidden pattern (R13)"
    - "task expands beyond plan.md file table"
    - "T077-T079 implementation lands (reserved; no MVP scope)"
  on_trigger:
    - "snapshot WIP to wip/killed/<task-id>-<reason>"
    - "log to task thread"
    - "escalate to human"
    - "do NOT silently retry"
```

T070 + T073 carry extended kill criteria.

---

## Phase 1 — Setup

`impact.md` MUST be `status: approved` (HIGH risk requires explicit engineering lead sign-off).

Add Phase 4 deps to `packages/agent-core/package.json`:
- `@anthropic-ai/sdk` (latest pinned)
- `drizzle-orm` (latest)
- `drizzle-kit` (latest, dev dep)
- `pg` (latest)

Add ESLint rule (in T073 PR):
```js
'no-restricted-imports': ['error', {
  paths: [
    { name: '@anthropic-ai/sdk', message: 'Import via @neural/agent-core/adapters (LLMAdapter / AnthropicAdapter)' },
    { name: 'pg', message: 'Import via @neural/agent-core/adapters (PostgresStorage) or db/ internals' },
    { name: 'drizzle-orm', message: 'Import via @neural/agent-core/adapters or db/' },
  ],
}],
```

---

## Phase 2 — Foundational

- [ ] **T-PHASE4-TESTS [P] [SETUP]** Author all 16 conformance tests + Phase 4 integration test FIRST. AC-01..AC-15 + adapter boundary test FAIL initially. R3.1 enforcement.
- [ ] **T-PHASE4-LOGGER [SETUP]** Modify `observability/logger.ts` to register `audit_run_id`, `client_id`, `llm_call_id`, `event_type`, `safety_class`, `domain` correlation fields.
- [ ] **T-PHASE4-TYPES [SETUP]** Author `types/llm.ts` (LLMCallRecord) + `types/audit-events.ts` (22-type AuditEvent enum) Zod schemas. Land BEFORE T070 (which creates DB tables matching these shapes) and T073 (which uses LLMCallRecord).

**Checkpoint:** Tests fail; correlation fields in place; schemas in place.

---

## Phase 3 — User Story 1: Safety + Data + LLM infrastructure (Priority: P1) 🎯 MVP

**Goal:** Phase 5+ can safely call tools, persist data, call LLMs.

**Independent Test:** `pnpm -F @neural/agent-core test integration/phase4`.

**AC IDs covered:** AC-01 through AC-15.

### Safety pillar

- [ ] **T066 [P] [US-1] ActionClassifier** (AC-01, REQ-SAFETY-CLASSIFIER-001)
  - **Brief:**
    - **Outcome:** `safety/ActionClassifier.ts` exports `ActionClassifier` class with `classify(toolName: string): SafetyClass`. Reads from Phase 2's MCPToolRegistry — Phase 2 owns the source of truth.
    - **Constraints:** File < 100 lines. Pure delegation to registry.
    - **Acceptance:** AC-01 — classify returns same value as `registry.getSafetyClass(name)`.
    - **Files:** `packages/agent-core/src/safety/ActionClassifier.ts`
    - **dep:** Phase 2 MCPToolRegistry, T-PHASE4-TESTS
    - **Kill criteria:** default block

- [ ] **T067 [US-1] SafetyCheck** (AC-02, REQ-SAFETY-CHECK-001)
  - **Brief:**
    - **Outcome:** `safety/SafetyCheck.ts` exports `SafetyCheck.assertAllowed(toolName, domain, auditRun): Promise<void>`. For `safe`: passes through. For `requires_safety_check`: consults DomainPolicy + CircuitBreaker. For `requires_hitl`: writes `audit_events` row of type `hitl_requested` and throws `SafetyBlockedError`. For `forbidden`: throws immediately.
    - **Constraints:** File < 200 lines. Calls SessionRecorder for audit_events emission.
    - **Acceptance:** AC-02 — 4 paths verified.
    - **Files:** `packages/agent-core/src/safety/SafetyCheck.ts`
    - **dep:** T066, T068, T069, T072 (SessionRecorder)
    - **Kill criteria:** default block

- [ ] **T068 [P] [US-1] DomainPolicy** (AC-03, REQ-SAFETY-DOMAIN-POLICY-001)
  - **Brief:**
    - **Outcome:** `safety/DomainPolicy.ts` exports `DomainPolicy` class with `classify(url): 'trusted' | 'unknown' | 'blocked'`. Configurable via `domain_policy` config object passed to constructor.
    - **Constraints:** File < 150 lines.
    - **Acceptance:** AC-03 — 3 classification cases pass.
    - **Files:** `packages/agent-core/src/safety/DomainPolicy.ts`
    - **dep:** T-PHASE4-TESTS
    - **Kill criteria:** default block

- [ ] **T069 [P] [US-1] CircuitBreaker** (AC-04, REQ-SAFETY-CIRCUIT-BREAKER-001)
  - **Brief:**
    - **Outcome:** `safety/CircuitBreaker.ts` exports `CircuitBreaker` class with `recordFailure(domain)`, `isOpen(domain)`, `reset(domain)`. Trips after 3 consecutive failures within window; blocks for 1 hour; resets after window.
    - **Constraints:** File < 150 lines. In-memory state for MVP (Redis-backed in Phase 8).
    - **Acceptance:** AC-04 — simulated 3 failures → block; 1-hour window verified.
    - **Files:** `packages/agent-core/src/safety/CircuitBreaker.ts`
    - **dep:** T-PHASE4-TESTS
    - **Kill criteria:** default block

### Data pillar

- [ ] **T070 [US-1] PostgreSQL schema (Drizzle) [MOD]** (AC-05, AC-17, REQ-DATA-SCHEMA-001 + REQ-DATA-RLS-001 + REQ-DATA-APPEND-ONLY-001) **— extended kill criteria**
  - **Brief:**
    - **Outcome:** `db/schema.ts` defines all 12 tables via Drizzle. `db/migrations/0001_initial.sql` creates 7 base tables (clients, audit_runs, findings, screenshots, sessions, audit_log, rejected_findings) per §13.1-§13.5. `db/migrations/0002_master_extensions.sql` creates 5 extension tables (page_states, state_interactions, finding_rollups, reproducibility_snapshots, audit_requests) + ALTER on findings (adds scope, template_id, workflow_id, state_ids, parent_finding_ids, polarity, business_impact, effort, priority, source, analysis_scope, interaction_evidence — all nullable, backward-compatible) + RLS policies on all 10 client-scoped tables + append-only triggers on the 5 append-only tables (audit_log, rejected_findings, finding_edits, llm_call_log, audit_events) + `published_findings` view per §13.6.11. `db/client.ts` exports a Drizzle client with connection pooling; `pnpm db:migrate` replaces Phase 0's stub.
    - **Context:** §13-data-layer is the verbatim authority for table shapes. impact.md captures the contract.
    - **Constraints:** schema.ts < 300 lines (R10.1). Each migration SQL file is the single source of truth for that migration. Drizzle schema MUST omit `update`/`delete` methods at the type level for the 5 append-only tables (use a wrapper type or restrict the schema export).
    - **Per-task kill criteria (extends default):**
      - "RLS bypass detected (any cross-client query returns rows)" → R23 STOP. Forensic risk for any client-scoped table.
      - "Append-only UPDATE/DELETE succeeds at DB level" → R23 STOP. R7.4 enforcement violated.
      - "Migration not idempotent (second `db:migrate` run errors)" → R23 STOP. Operational risk.
      - "Drizzle schema diverges from SQL migration shape" → R23 STOP. Type/runtime drift.
    - **Acceptance:** AC-05 — 3 sub-tests (db-schema, db-rls, db-append-only) all green. **v0.3 — AC-17:** schema baseline reserves a `context_profiles` table slot (column shapes per §13 + Phase 4b impact.md §6); T070 does NOT create the table itself — Phase 4b T4B-012 owns that migration. T070 conformance asserts no shape collision with Phase 4b's planned migration.
    - **Files:** `packages/agent-core/src/db/schema.ts`, `packages/agent-core/src/db/migrations/0001_initial.sql`, `packages/agent-core/src/db/migrations/0002_master_extensions.sql`, `packages/agent-core/src/db/client.ts`, `packages/agent-core/src/db/index.ts`; modify `packages/agent-core/package.json` to add Drizzle + pg deps; modify root `package.json` to point `db:migrate` at Drizzle (replaces Phase 0 stub).
    - **dep:** T-PHASE4-TESTS, T-PHASE4-TYPES, Phase 0 (Postgres + pgvector container)

- [ ] **T071 [P] [US-1] AuditLogger** (AC-06, REQ-OBSERVE-AUDIT-LOG-001)
  - **Brief:**
    - **Outcome:** `observability/AuditLogger.ts` exports `AuditLogger.log(entry)` that appends to `audit_log` via PostgresStorage. Verifies UPDATE/DELETE attempts fail.
    - **Constraints:** File < 150 lines. INSERT-only methods.
    - **Acceptance:** AC-06.
    - **Files:** `packages/agent-core/src/observability/AuditLogger.ts`
    - **dep:** T070, T074
    - **Kill criteria:** default block

- [ ] **T072 [P] [US-1] SessionRecorder** (AC-07, REQ-OBSERVE-SESSION-RECORDER-001)
  - **Brief:**
    - **Outcome:** `observability/SessionRecorder.ts` exports `SessionRecorder.recordEvent(event: AuditEvent)` writing to `audit_events` (append-only). Validates against the 22-type Zod enum.
    - **Constraints:** File < 200 lines.
    - **Acceptance:** AC-07.
    - **Files:** `packages/agent-core/src/observability/SessionRecorder.ts`
    - **dep:** T070, T074, T-PHASE4-TYPES (AuditEvent enum)
    - **Kill criteria:** default block

### LLM + storage + stream pillar

- [ ] **T073 [US-1] LLMAdapter + AnthropicAdapter + TemperatureGuard + BudgetGate** (AC-08, AC-09, AC-10, AC-11, REQ-LLM-*) **— extended kill criteria**
  - **Brief:**
    - **Outcome:** Five files build the LLM contract surface together (split to keep each < 200 lines):
      - `adapters/LLMAdapter.ts` — interface + LLMCompleteRequest + LLMCompleteResponse types + LLMOperation enum
      - `adapters/AnthropicAdapter.ts` — concrete; calls TemperatureGuard.check() FIRST, BudgetGate.check() SECOND, atomically writes llm_call_log row, calls Anthropic API with retry-on-5xx-or-timeout (3 retries, exponential backoff), throws LLMUnavailableError after exhaustion
      - `adapters/TemperatureGuard.ts` — `static check(req)` rejects temp > 0 on the 3 reproducibility-bound operation classes
      - `adapters/BudgetGate.ts` — `static check(req, budget_remaining)` throws BudgetExceededError if estimated > remaining; estimate via `getTokenCount()` per pinned per-token rate
      - ESLint config update: add `no-restricted-imports` rule blocking `@anthropic-ai/sdk` outside AnthropicAdapter.ts
    - **Per-task kill criteria (extends default):**
      - "TemperatureGuard bypass detected (temp > 0 reaches Anthropic API on evaluate/self_critique/evaluate_interactive)" → R23 STOP. R10 violation cascades into Phase 7.
      - "LLM call returns without llm_call_log row written" → R23 STOP. R14.1 violation; cost forensics broken.
      - "Failover protocol skipped (1 retry instead of 3)" → R23 STOP. R14.5 violation.
      - "@anthropic-ai/sdk imported outside AnthropicAdapter.ts" → R23 STOP. R9 violation; ESLint should catch but kill criterion is the safety net.
      - "Budget race condition (parallel calls debit incorrectly)" → R23 STOP. Use row-level lock around `audit_runs.budget_remaining_usd` UPDATE.
    - **Constraints:** Total lines across 4 .ts files < 500. AnthropicAdapter is the SOLE @anthropic-ai/sdk importer. ESLint rule lands in same PR.
    - **Acceptance:** AC-08, AC-09, AC-10, AC-11 — 4 conformance tests + adapter-import-boundary test green.
    - **Files:** `packages/agent-core/src/adapters/LLMAdapter.ts`, `packages/agent-core/src/adapters/AnthropicAdapter.ts`, `packages/agent-core/src/adapters/TemperatureGuard.ts`, `packages/agent-core/src/adapters/BudgetGate.ts`; ESLint config; modify `packages/agent-core/package.json`.
    - **dep:** T070 (DB schema for llm_call_log), T-PHASE4-TYPES (LLMCallRecord), T-PHASE4-TESTS

- [ ] **T074 [US-1] StorageAdapter + PostgresStorage** (AC-12, REQ-STORAGE-ADAPTER-001)
  - **Brief:**
    - **Outcome:** `adapters/StorageAdapter.ts` (interface) + `adapters/PostgresStorage.ts` (Drizzle-based concrete) — typed methods per entity (createAuditRun, getFindings, writeReproducibilitySnapshot, etc. — initial subset; expanded by Phase 7+8). `SET LOCAL app.client_id = $1` set at start of every transaction. SOLE pg + Drizzle importer outside `db/`.
    - **Constraints:** Each file < 300 lines. No raw SQL.
    - **Acceptance:** AC-12 — basic CRUD on clients + audit_runs + findings; cross-client query returns empty.
    - **Files:** `packages/agent-core/src/adapters/StorageAdapter.ts`, `packages/agent-core/src/adapters/PostgresStorage.ts`
    - **dep:** T070, T-PHASE4-TESTS
    - **Kill criteria:** default block + R9 import boundary

- [ ] **T075 [P] [US-1] ScreenshotStorage + LocalDiskStorage** (AC-13, REQ-SCREENSHOT-STORAGE-001)
  - **Brief:**
    - **Outcome:** `adapters/ScreenshotStorage.ts` (interface) + `adapters/LocalDiskStorage.ts` (concrete). LocalDisk writes to `<SCREENSHOTS_DIR>/<audit_run_id>/<page_url_hash>.jpg` where `SCREENSHOTS_DIR` is read from env (default `./screenshots` relative to project root). Returns stable path; `get(id)` reads back.
    - **Constraints:** File < 200 lines. R2 client integration deferred to post-MVP-pilot per PRD §3.2; interface ready. SCREENSHOTS_DIR env var documented in `.env.example` update (Phase 0's .env.example gets the new key in this task).
    - **Acceptance:** AC-13 — write + read round-trip; verify `SCREENSHOTS_DIR` override is honored when set.
    - **Files:** `packages/agent-core/src/adapters/ScreenshotStorage.ts`, `packages/agent-core/src/adapters/LocalDiskStorage.ts`; modify `.env.example` (add SCREENSHOTS_DIR with default `./screenshots`).
    - **dep:** T-PHASE4-TESTS
    - **Kill criteria:** default block

- [ ] **T076 [P] [US-1] StreamEmitter** (AC-14, REQ-STREAM-EMITTER-001)
  - **Brief:**
    - **Outcome:** `observability/StreamEmitter.ts` exports `StreamEmitter` class with `publish(event)` + `subscribe(callback)`. Phase 4 buffers events in memory; Phase 9 dashboard wires Hono SSE endpoint. SSE format compliance (event: name, data: JSON).
    - **Constraints:** File < 150 lines. No HTTP; Phase 9 wraps.
    - **Acceptance:** AC-14.
    - **Files:** `packages/agent-core/src/observability/StreamEmitter.ts`
    - **dep:** T-PHASE4-TESTS
    - **Kill criteria:** default block

### Phase 4 acceptance gate

- [ ] **T080 [US-1] Phase 4 integration test** (AC-15)
  - **Brief:**
    - **Outcome:** `tests/integration/phase4.test.ts` against fresh DB + LocalDisk + MockAnthropicAdapter: migrate → write 1 audit_log + 3 audit_events → 1 LLM call (success path) + 1 LLM call (budget exceeded; verifies log row with outcome='budget_blocked') + 1 LLM call (failover after 3 retries; verifies log row with outcome='unavailable') → 1 screenshot to LocalDisk → query findings table empty → assert all 12 tables queryable. Total wall-clock < 2 min.
    - **Files:** `packages/agent-core/tests/integration/phase4.test.ts`
    - **dep:** T066-T076
    - **Kill criteria:** default block + extra: wall-clock > 2 min → STOP, individual component perf regression

- [ ] **T080a [US-1] RobotsChecker (§11.1.1 — v0.3 NEW)** (AC-16, REQ-SAFETY-005)
  - **Brief:**
    - **Outcome:** `safety/RobotsChecker.ts` exports `isAllowed(url: string, userAgent: string): Promise<{ allowed: boolean; matched_directive?: string; warning_code?: "ROBOTS_TXT_DISALLOWED" }>`. Fetches `<root>/robots.txt` once per audit (cache by audit_run_id), parses User-agent + Disallow rules per RFC 9309, falls back to `<root>/ai-agent.txt` if robots.txt missing (REQ-RATE-003). Refuses spoofed Googlebot/Bingbot/etc. user agents (REQ-SAFETY-007). Emits `ROBOTS_TXT_DISALLOWED` warning with the matched directive when path disallowed.
    - **Context:** Used by Phase 4b T4B-003 HtmlFetcher AND by Phase 5 browse-mode navigation. Single utility serves both.
    - **Constraints:** File < 200 lines. Cache TTL = audit lifetime (cache cleared at audit end). No retry on robots.txt fetch failure — degrade open (allow); emit `ROBOTS_TXT_FETCH_FAILED` info-severity warning.
    - **Per-task kill criteria (extends default):** UA spoofing of crawlers reaches the network layer → R23 STOP. R7 violation cascades into honest-output guarantees.
    - **Acceptance:** AC-16 — conformance test on 3 fixture sites: (a) allows path; (b) disallows path with directive; (c) UA-spoofing rejected.
    - **Files:** `packages/agent-core/src/safety/RobotsChecker.ts`
    - **dep:** T-PHASE4-TESTS, T070 (cache key `audit_run_id`)
    - **Phase 4b dependency:** T4B-003 imports this utility
    - **Phase 5 dependency:** Phase 5 browse-mode navigation gates on this utility

**Checkpoint (v0.3):** All 15 baseline ACs + AC-16 (RobotsChecker) + AC-17 (context_profiles slot in T070) pass. Phase 4 ready for rollup. Phase 4b T4B-003 / T4B-012 unblocked.

---

## Phase N — Polish

- [ ] **T-PHASE4-DOC [P]** Update root README dev quickstart (add `pnpm db:migrate` real schema; add ANTHROPIC_API_KEY to .env required keys).
- [ ] **T-PHASE4-ADAPTERS-README** Update `adapters/README.md` to list LLM, Storage, ScreenshotStorage as new categories beside BrowserEngine.
- [ ] **T-PHASE4-ROLLUP** Author `phase-4-current.md` per R19. Active modules: 18 NEW contracts. Known limitations: R2 deferred; v1.2 fallback adapter not yet plugged. Forward risks for Phase 5 (action node integration), Phase 7 (LLM call surface stability under evaluate/self-critique load), Phase 8 (reproducibility_snapshot composition).

---

## Dependencies & Execution Order

```
T-PHASE4-TESTS  +  T-PHASE4-LOGGER  +  T-PHASE4-TYPES         # SETUP (parallel)
              │              │              │
              └──────┬───────┴──────────────┘
                     ▼
                   T070                                       # Drizzle schema (foundation)
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
     T066          T071          T074                         # ActionClassifier, AuditLogger, StorageAdapter (parallel after T070)
       │             │             │
       │           T072            │                         # SessionRecorder (depends on T070+T074)
       │             │             │
     T067          T076          T075                         # SafetyCheck, StreamEmitter, ScreenshotStorage (parallel)
                     │
                   T073                                       # LLMAdapter cornerstone (depends on T070 + T-PHASE4-TYPES)
                     │
                   T080                                       # Integration test
                     │
T-PHASE4-DOC, T-PHASE4-ADAPTERS-README, T-PHASE4-ROLLUP
```

T068 + T069 land alongside T067 (used by SafetyCheck for `requires_safety_check` path).

### Comprehension-Debt Pacing (PRD §10.10)

Phase 4 is the largest in MVP. Strong pacing discipline required:

- **T070 (DB schema) is single-threaded** — do NOT parallelize. RLS + append-only trigger interaction is too subtle to split.
- **T073 (LLM adapter cornerstone) is single-threaded** — 4 files but single coherent module set; reviewed atomically.
- **Safety pillar (T066-T069)** parallelizable to 4 subagents BUT the integration into SafetyCheck (T067) is the sequencing point.
- **Storage pillar (T074-T076)** parallelizable to 3 subagents after T070.
- **Hard ceiling: 4 parallel subagents at any time.** PRD §10.10 working-memory limit.

---

## Implementation Strategy

1. SETUP — T-PHASE4-TESTS + T-PHASE4-LOGGER + T-PHASE4-TYPES.
2. T070 (DB schema) — single-threaded; gate on RLS + append-only conformance.
3. Parallel batch A: T066, T071, T074 (3 agents).
4. T067 + T072 sequential (depend on the batch).
5. Parallel batch B: T068, T069, T076, T075 (4 agents — at ceiling).
6. T073 (LLM cornerstone) — single-threaded; full review surface.
7. T080 (integration test).
8. Polish.

---

## Notes

- T077-T079 are RESERVED — kill criterion catches any implementation attempt.
- 18-contract surface = highest review burden in MVP. Apply pacing discipline.
- ESLint rule + grep boundary test together enforce R9 (defense in depth).
- DB migrations are idempotent — always design for re-run.
- Mock adapters (MockAnthropic, MockPostgres) live in `tests/test-utils/`; never production.

---

## Cross-references

- spec.md, plan.md, impact.md
- Phase 0, 1, 2, 3 specs (cross-phase consumption)
- `docs/specs/mvp/tasks-v2.md` T066-T080
- `docs/specs/final-architecture/11-safety-cost.md`, `13-data-layer.md`, `34-observability.md`
- `docs/specs/mvp/constitution.md` R7, R8, R9, R10, R14, R20, R23
