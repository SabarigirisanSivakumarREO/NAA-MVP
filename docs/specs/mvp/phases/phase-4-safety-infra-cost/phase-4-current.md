---
title: Phase 4 Rollup — Current System State
artifact_type: rollup
status: approved
version: 1.0
phase_number: 4
phase_name: Safety + Infrastructure + Cost
phase_completed_on: 2026-05-14
created: 2026-05-14
updated: 2026-05-14
owner: engineering lead
authors: [Claude (master orchestrator Phase 4 Stage 4 EXIT subagent)]
reviewers: [Sabari (Gate 2 stamped 2026-05-14)]
supersedes: phase-3-verification/phase-3-current.md
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md v1.0
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/plan.md v1.0
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md v1.0
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md v1.0 (19 NEW shared contracts; HIGH risk; breaking:false)
  - docs/specs/final-architecture/11-safety-cost.md REQ-SAFETY-* + REQ-LLM-*
  - docs/specs/final-architecture/13-data-layer.md (15-table schema)
  - docs/specs/final-architecture/34-observability.md REQ-OBS-012 (22 audit_event types)
  - .phase-state/4/verify-verdict.yaml (Gate 2 APPROVE 2026-05-14)
req_ids:
  - REQ-SAFETY-CLASSIFIER-001
  - REQ-SAFETY-CHECK-001
  - REQ-SAFETY-DOMAIN-POLICY-001
  - REQ-SAFETY-CIRCUIT-BREAKER-001
  - REQ-SAFETY-005
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
delta:
  new:
    - 19 NEW shared contracts (v0.3 added RobotsChecker as the 19th): LLMAdapter + AnthropicAdapter + TemperatureGuard + BudgetGate + LLMCallRecord + StorageAdapter + PostgresStorage + ScreenshotStorage + LocalDiskStorage + ActionClassifier + SafetyCheck + DomainPolicy + CircuitBreaker + RobotsChecker + AuditLogger + SessionRecorder + AuditEvent + StreamEmitter + DBSchema (15 tables — 10 RLS + 5 append-only)
    - First Drizzle migrations (T070 — replaces Phase 0 stub `db:migrate`); 3 SQL migrations: `0001_initial.sql` (10 base tables) + `0002_master_extensions.sql` (5 extension tables + ALTER + RLS policies + append-only triggers) + `0003_force_rls.sql` (RLS enforcement closure: FORCE RLS + app_user role + UUID-cast helper + clients.client_id GENERATED alias)
    - First LLM contact (T073 — AnthropicAdapter SOLE `@anthropic-ai/sdk` importer; TemperatureGuard rejects temp > 0 on the 3 reproducibility-bound ops; BudgetGate enforces R14.2 pre-call; atomic llm_call_log write before return per R14.1; 3-retry failover protocol per R14.5 throws LLMUnavailableError)
    - First concrete R7.2 RLS enforcement (10 client-scoped tables) + R7.4 append-only enforcement (5 tables + DB triggers FOR EACH STATEMENT + Drizzle AppendOnlyTable<T> brand pattern at type level — defense in depth)
    - First REQ-OBS-012 22-type AuditEvent enum LOCKED (per impact.md Forward Stability; new types require fresh impact.md cycle); enforced via Zod enum + SQL CHECK constraint string-identical
    - ESLint `no-restricted-imports` rule LANDED (third adapter category; blocks `@anthropic-ai/sdk` / `pg` / `drizzle-orm` outside their adapter files); grep boundary test as defense-in-depth
    - 5 NEW Pino correlation fields registered in `observability/logger.ts` LogBindings: `audit_run_id`, `client_id`, `llm_call_id`, `event_type`, `safety_class`, `domain` (6 total fields per spec — `audit_run_id` was pre-existing)
    - SafetyCheck 4-path dispatch (safe / requires_safety_check / requires_hitl / forbidden) consuming Phase 2 SafetyClass enum + emitting Phase 3 FailureClassifier 'safety_blocked' on requires_hitl/forbidden
    - StreamEmitter in-memory pub/sub scaffold for SSE (Phase 9 dashboard wraps with Hono SSE endpoint)
  changed:
    - `observability/logger.ts` extended v0.3 → v0.4 with 6 NEW Phase 4 correlation fields (+5 vs Phase 3; R18 append-only)
    - Phase 0 stub `scripts/db-migrate-stub.mjs` REMOVED; replaced with `scripts/db-migrate.mjs` Drizzle runner (transactional; idempotent)
    - `adapters/README.md` updated to list LLM + Storage + ScreenshotStorage as adapter categories beside BrowserEngine
    - Root README dev quickstart updated (real `pnpm db:migrate`; ANTHROPIC_API_KEY documented as required env var)
  impacted:
    - Phase 5 BrowseNode — primary downstream consumer; wraps every browse action in SafetyCheck.assertAllowed; uses PostgresStorage withClient(client_id, fn) RLS-aware transactions for screenshots + sessions + state_interactions + audit_events + audit_log writes; orchestrator MUST thread `client_id` through LLMCompleteRequest.client_id to close Stage 2.5 H1 + H2 follow-up
    - Phase 5 — gates browse-mode navigation on RobotsChecker.isAllowed() (REQ-SAFETY-005)
    - Phase 7 EvaluateNode + SelfCritiqueNode + Interactive (v1.2) — call LLMAdapter.complete({operation: 'evaluate'|'self_critique'|'evaluate_interactive', ...}); R10 enforced via TemperatureGuard at adapter boundary; cost accounted to llm_call_log atomically
    - Phase 7 grounding (GR-001..GR-012) — write rejections to rejected_findings table (Two-Store rejected-projection)
    - Phase 8 Orchestrator — owns reproducibility_snapshots writes + full audit_runs lifecycle (audit_started → audit_completed | audit_failed); cross-page PatternDetector writes to finding_rollups; AuditState consumes audit_events as the firehose
    - Phase 9 Delivery — reads all 15 tables via PostgresStorage for PDF + dashboard; consumes StreamEmitter for live SSE updates
    - Phase 4b T4B-003 HtmlFetcher — imports RobotsChecker.isAllowed() (shared utility; not duplicated)
    - Phase 4b T4B-012 — lands `context_profiles` migration; T070 schema baseline reserved the slot (AC-17) so no schema rewrite required
  unchanged:
    - Phase 1 conformance suite (browser-manager, context-assembler, accessibility-extractor, hard-filter, soft-filter, mutation-monitor, screenshot-extractor, stealth-config, perception-types) — ZERO regression across 18-commit Phase 4 development
    - Phase 1b 10-extractor conformance + Phase 1c PerceptionBundle envelope + 4 closed Zod enums
    - Phase 2 MCP surface (29 tools: 22 browser_* + 2 agent_* + 5 page_*); AnalyzePerception v2.3 schema; DomainRateLimiter
    - Phase 3 verification surface (ActionContract, VerifyEngine, ConfidenceScorer, FailureClassifier + 3 MVP strategies + 6 v1.1 reserved enum slots)
    - Walking-skeleton path (apps/cli/src/commands/audit.ts) — still uses Phase 0/1 BrowserManager.capture() fixture stub; R20 supersession deferred to Phase 5
governing_rules:
  - Constitution R19 (Rollup per Phase)
  - Constitution R17.4 (Lifecycle — approved → verified bumped 2026-05-14 at Stage 4 exit by Gate 2 stamp)
  - Constitution R20 (Impact Analysis — impact.md v1.0; 19 NEW shared contracts → invalidates phase 5/7/8/9 pre-flights; R20 notes filed)
  - Constitution R7.1 (Drizzle-only DB access — first concrete enforcement)
  - Constitution R7.2 (Row-Level Security — first concrete enforcement on 10 client-scoped tables)
  - Constitution R7.4 (Append-only tables — first concrete enforcement via DB triggers + Drizzle brand)
  - Constitution R9 (Adapter Pattern — third adapter category lands; ESLint rule activates)
  - Constitution R10 (Reproducibility — TemperatureGuard at AnthropicAdapter boundary)
  - Constitution R14.1 (Atomic LLM logging) + R14.2 (Pre-call budget gate) + R14.5 (3-retry failover protocol)
  - Constitution R18 (Append-only delta — every Stage-1+Stage-4 artifact patch appended delta blocks; zero retroactive line removals)
  - Constitution R23 (Kill Criteria — T070 + T073 extended kill criteria all honored; no MVP whitelist on VerifyEngine.register surface; no @anthropic-ai/sdk import outside AnthropicAdapter)
---

# Phase 4 — Safety + Infrastructure + Cost — Current System State Rollup

> **Summary (~200 tokens):** Phase 4 ships the infrastructure spine — 19 NEW shared contracts across safety, data, LLM, storage, and observability pillars. First Drizzle migration set (15 tables: 10 RLS-protected client-scoped + 5 append-only DB-trigger-enforced). First LLM contact via AnthropicAdapter with TemperatureGuard (R10) + BudgetGate (R14.2) + atomic llm_call_log writes (R14.1) + 3-retry failover (R14.5). SafetyCheck 4-path gate consumes Phase 2 SafetyClass and produces Phase 3 FailureClassifier safety_blocked failures. RobotsChecker enforces REQ-SAFETY-005 robots.txt + ai-agent.txt compliance with UA-spoof rejection on 6 named bots. AuditLogger + SessionRecorder + StreamEmitter form the observability spine; 22-type AuditEvent enum LOCKED per Forward Stability. ESLint `no-restricted-imports` rule activated (defense in depth with grep boundary test). 17/17 ACs GREEN (73/73 Phase 4 sequential tests pass in 18.16s wall-clock; AC-15 integration test 10 sub-scenarios end-to-end across all 15 tables in <18s). Stage 2.5 + Stage 3 + Stage 3b all APPROVE. Two Phase 5 follow-up items: H1 (orchestrator threads client_id through LLMCompleteRequest) + H2 (#tryWriteRow tighten on outcome='ok' paths).

> **Governed by:** Constitution R19. Rollup size cap: 300 lines / ~3000 tokens.

---

## 1. Active modules introduced this phase

19 NEW shared contracts across 5 pillars. Paths relative to repo root.

### Safety pillar

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `ActionClassifier` | `packages/agent-core/src/safety/ActionClassifier.ts` (64 LOC) | T066 — pure delegation to Phase 2 MCPToolRegistry (`classify(toolName) → SafetyClass`); Phase 2 owns source of truth | `tests/conformance/action-classifier.test.ts` (AC-01 4/4) |
| `SafetyCheck` | `packages/agent-core/src/safety/SafetyCheck.ts` (196 LOC) | T067 — 4-path runtime gate (safe / requires_safety_check / requires_hitl / forbidden); exhaustive-switch guard; emits `audit_events.hitl_requested` + throws `SafetyBlockedError`; calls SessionRecorder + DomainPolicy + CircuitBreaker | `tests/conformance/safety-check.test.ts` (AC-02 6/6) |
| `DomainPolicy` | `packages/agent-core/src/safety/DomainPolicy.ts` (116 LOC) | T068 — config-driven URL → 'trusted'/'unknown'/'blocked' classifier | `tests/conformance/domain-policy.test.ts` (AC-03 5/5) |
| `CircuitBreaker` | `packages/agent-core/src/safety/CircuitBreaker.ts` (147 LOC) | T069 — per-domain failure tracker; 3 consecutive failures → 1-hour block; in-memory MVP state (Redis Phase 8) | `tests/conformance/circuit-breaker.test.ts` (AC-04 6/6) |
| `RobotsChecker` | `packages/agent-core/src/safety/RobotsChecker.ts` (197 LOC) | T080a — robots.txt + ai-agent.txt compliance per REQ-SAFETY-005; per-audit cache; UA-spoof rejection on 6 named bots (googlebot/bingbot/duckduckbot/yandexbot/baiduspider/facebookexternalhit) | `tests/conformance/robots-checker.test.ts` (AC-16 4/4) |

### Data pillar

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `DBSchema` (Drizzle) | `packages/agent-core/src/db/schema.ts` (300 LOC) | T070 — 15-table Drizzle schema; AppendOnlyTable<T> brand for type-level UPDATE/DELETE prevention; pgvector loaded | `tests/conformance/db-schema.test.ts` (AC-05 6/6) + `context-profiles-slot.test.ts` (AC-17 3/3) |
| `0001_initial.sql` | `packages/agent-core/src/db/migrations/0001_initial.sql` (272 LOC) | T070 — 10 base tables (7 client-scoped + 3 append-only foundational); pgvector + UUID extensions; cascade FKs | (consumed by AC-05) |
| `0002_master_extensions.sql` | `packages/agent-core/src/db/migrations/0002_master_extensions.sql` (287 LOC) | T070 — 5 extension tables + ALTER on findings (12 nullable columns) + 10 RLS policies + 5 append-only BEFORE UPDATE OR DELETE FOR EACH STATEMENT triggers + `published_findings` view | (consumed by AC-05/AC-12) |
| `0003_force_rls.sql` | `packages/agent-core/src/db/migrations/0003_force_rls.sql` (144 LOC) | T074 Stage 2.5 addendum — closes 4 RLS-enforcement defects in 0002: FORCE ROW LEVEL SECURITY + `app_user` role (bypasses superuser BYPASSRLS via `SET LOCAL ROLE`) + `public.current_client_id()` helper (UUID-cast safe) + `clients.client_id` GENERATED ALWAYS AS (id) STORED alias | (consumed by AC-12) |
| `PostgresStorage` | `packages/agent-core/src/adapters/PostgresStorage.ts` (293 LOC) | T074 — Drizzle-based StorageAdapter concrete; SOLE `pg` + `drizzle-orm` importer outside `db/`; `withClient(client_id, fn)` per-transaction `SET LOCAL app.client_id` + `SET LOCAL ROLE app_user` | `tests/conformance/storage-adapter.test.ts` (AC-12 3/3 parameterized over 10 RLS tables) |
| `db/client.ts` | `packages/agent-core/src/db/client.ts` (128 LOC) | T070 — Drizzle client factory + connection pool; reads `POSTGRES_URL` env | (consumed by PostgresStorage) |
| `AuditLogger` | `packages/agent-core/src/observability/AuditLogger.ts` (121 LOC) | T071 — append-only writer to `audit_log` via PostgresStorage; INSERT-only methods | `tests/conformance/audit-logger.test.ts` (AC-06 3/3) |
| `SessionRecorder` | `packages/agent-core/src/observability/SessionRecorder.ts` (154 LOC) | T072 — emits 22-type AuditEvent to `audit_events` (append-only); Zod-validated | `tests/conformance/session-recorder.test.ts` (AC-07 4/4) |

### LLM pillar

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `LLMAdapter` | `packages/agent-core/src/adapters/LLMAdapter.ts` (90 LOC) | T073 — interface + LLMCompleteRequest / LLMCompleteResponse types + LLMOperation enum (6 values) + LLMOutcome enum (5 values) | (consumed by AC-08) |
| `AnthropicAdapter` | `packages/agent-core/src/adapters/AnthropicAdapter.ts` (286 LOC) | T073 — concrete; SOLE `@anthropic-ai/sdk` importer; 6-step control flow (temperature → budget → API call → atomic log → outcome); 3-retry exponential backoff on 5xx/timeout/429; throws LLMUnavailableError after exhaustion | `tests/conformance/llm-adapter.test.ts` (AC-08 3/3) + `llm-failover.test.ts` (AC-11 3/3) |
| `TemperatureGuard` | `packages/agent-core/src/adapters/TemperatureGuard.ts` (49 LOC) | T073 — `static check(req)` rejects temp > 0 on 3 reproducibility-bound ops (evaluate / self_critique / evaluate_interactive); R10 enforcement at adapter boundary | `tests/conformance/temperature-guard.test.ts` (AC-09 8/8 — 3 reject + 3 allow + 2 boundary) |
| `BudgetGate` | `packages/agent-core/src/adapters/BudgetGate.ts` (74 LOC) | T073 — `static check(req, remaining)` + `static estimate(req)`; ceils to nearest $0.01; throws BudgetExceededError; writes llm_call_log with outcome='budget_blocked' | `tests/conformance/budget-gate.test.ts` (AC-10 5/5) |

### Storage pillar

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `StorageAdapter` | `packages/agent-core/src/adapters/StorageAdapter.ts` (185 LOC) | T074 — interface + typed methods (createAuditRun, getFindings, writeReproducibilitySnapshot, etc.); RLS contract documented | (consumed by AC-12) |
| `ScreenshotStorage` | `packages/agent-core/src/adapters/ScreenshotStorage.ts` (64 LOC) | T075 — interface (R2 ready; LocalDisk in MVP) | (consumed by AC-13) |
| `LocalDiskStorage` | `packages/agent-core/src/adapters/LocalDiskStorage.ts` (104 LOC) | T075 — concrete; writes `<SCREENSHOTS_DIR>/<audit_run_id>/<page_url_hash>.jpg`; honors `SCREENSHOTS_DIR` env (default `./screenshots`) | `tests/conformance/screenshot-storage.test.ts` (AC-13 3/3) |

### Observability + types

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `StreamEmitter` | `packages/agent-core/src/observability/StreamEmitter.ts` (136 LOC) | T076 — in-memory pub/sub with `publish(event)` + `subscribe(cb)`; SSE format compliance (event: name, data: JSON); Phase 9 wraps with Hono | `tests/conformance/stream-emitter.test.ts` (AC-14 3/3) |
| `types/llm.ts` | `packages/agent-core/src/types/llm.ts` (117 LOC) | T-PHASE4-TYPES — LLMCallRecord Zod schema; LLMOperation 6-value enum LOCKED; LLMOutcome 5-value enum LOCKED | (consumed throughout T073) |
| `types/audit-events.ts` | `packages/agent-core/src/types/audit-events.ts` (120 LOC) | T-PHASE4-TYPES — AuditEvent Zod schema with `event_type` 22-value enum LOCKED; `.strict()` rejects unknown keys; string-identical + order-identical to SQL CHECK constraint | (consumed throughout T072) |
| `observability/logger.ts` extension | `packages/agent-core/src/observability/logger.ts` (200 LOC; +21 LOC vs Phase 3) | T-PHASE4-LOGGER — adds 6 NEW correlation fields (audit_run_id pre-existing; client_id / llm_call_id / event_type / safety_class / domain NEW) | (consumed across pillars) |

**Test scaffolding (Wave 1):** 17 conformance test files + 1 integration test file + 1 adapter-boundary grep test, authored RED at commit `634b99d` (T-PHASE4-TESTS); 110+ RED tests driven GREEN across Waves 2-9.

**Integration test (Wave 8):** `tests/integration/phase4.test.ts` (249 LOC) — AC-15 gate; 10 sub-scenarios end-to-end across 15 tables in 18.16s sequential wall-clock (well under 2-min budget).

---

## 2. Data contracts now in effect

| Contract | Location | Spec | Notes |
|---|---|---|---|
| `LLMCallRecord` (Zod) | `packages/agent-core/src/types/llm.ts` | impact.md v1.0 §LLMCallRecord | `.strict()`; canonical Phase 4 shape: `operation` / `prompt_tokens` / `completion_tokens` / `client_id` / `outcome` / `error_class`. Phase 7+ field additions (heuristic_id / page_url / node_name) deferred — would require fresh impact.md cycle |
| `LLMOperation` 6-value enum | `packages/agent-core/src/types/llm.ts` L48-55 | spec.md AC-09 + impact.md §LLMOperation | LOCKED: `evaluate` / `self_critique` / `evaluate_interactive` (R10-bound) + `classify` / `extract` / `other` (R10 carve-out); TemperatureGuard.REPRODUCIBILITY_BOUND_OPS = `ReadonlySet<['evaluate','self_critique','evaluate_interactive']>` |
| `LLMOutcome` 5-value enum | `packages/agent-core/src/types/llm.ts` L71-77 | impact.md §LLMOutcome | LOCKED: `ok` / `budget_blocked` / `temperature_blocked` / `unavailable` / `error`; every AnthropicAdapter exit path writes a llm_call_log row with one of these (R14.1) |
| `AuditEvent` 22-value enum | `packages/agent-core/src/types/audit-events.ts` L58-81 | spec.md AC-07 + impact.md §AuditEvent | LOCKED per impact.md Forward Stability; new types require fresh impact.md cycle; string-identical + order-identical to SQL CHECK constraint in 0002 (Stage 2.5 KC-8 strength) |
| `AuditEvent` Zod schema | `packages/agent-core/src/types/audit-events.ts` | spec.md AC-07 | `.strict()` rejects unknown keys; payload shape: `{ audit_run_id, client_id, event_type, page_url?, metadata? }` |
| `SafetyClass` 4-value enum (Phase 2 contract consumed) | `packages/agent-core/src/mcp/types.ts` L31-34 | spec.md AC-02 (Phase 4 consumption) | LOCKED at Phase 2: `safe` / `requires_safety_check` / `requires_hitl` / `forbidden`; SafetyCheck exhaustive-switch guard prevents silent drift on new members |
| `FailureClass` 5-value enum (Phase 3 contract consumed) | `packages/agent-core/src/verification/types.ts` | Phase 3 impact.md v0.2 | LOCKED at Phase 3: `verify_failed` / `safety_blocked` / `rate_limited` / `unverifiable` / `bot_detected_likely`; SafetyCheck produces `safety_blocked` via FailureClassifier on requires_hitl/forbidden paths |
| `StorageAdapter` interface | `packages/agent-core/src/adapters/StorageAdapter.ts` | spec.md AC-12 + impact.md §StorageAdapter | Typed per-entity methods; `withClient(client_id, fn)` is the RLS-aware transaction boundary; all writes go through this seam |
| 15-table DB schema | `packages/agent-core/src/db/schema.ts` | spec.md AC-05 + impact.md §DBSchema | 10 RLS-protected: clients, audit_runs, findings, screenshots, sessions, page_states, state_interactions, finding_rollups, reproducibility_snapshots, audit_requests. 5 append-only: audit_log, rejected_findings, finding_edits, llm_call_log, audit_events. `context_profiles` slot reserved for Phase 4b T4B-012 (AC-17) |
| LogBindings extension (5 NEW fields) | `packages/agent-core/src/observability/logger.ts` | spec.md AS#7 + R-NN observability | Phase 4 section appended after Phase 3 fields: `client_id` (per-audit RLS scope key), `llm_call_id` (per-call UUID), `event_type` (audit_events enum value), `safety_class` (SafetyCheck dispatch path), `domain` (DomainPolicy / CircuitBreaker / RobotsChecker key) |
| RobotsChecker output shape | `packages/agent-core/src/safety/RobotsChecker.ts` | spec.md AC-16 + REQ-SAFETY-005 | Returns `{ allowed: boolean; matched_directive?: string; warning_code?: 'ROBOTS_TXT_DISALLOWED' \| 'ROBOTS_TXT_FETCH_FAILED' }`; in-memory `Map<auditRunId, RobotsTxt>` cache lifetime = audit lifetime |

---

## 3. System flows now operational

### Flow: SafetyCheck 4-path gate (R8.4 + REQ-SAFETY-CHECK-001)

**Trigger:** Future Phase 5 BrowseNode calls `await SafetyCheck.assertAllowed(toolName, domain, auditRun)` before executing any browse action.
**Steps:**
1. SafetyCheck calls `ActionClassifier.classify(toolName)` → SafetyClass (delegates to Phase 2 MCPToolRegistry).
2. Exhaustive-switch on SafetyClass:
   - `safe` → return (no-op).
   - `requires_safety_check` → DomainPolicy.classify(url) + CircuitBreaker.isOpen(domain) gate; if either blocks, throw `SafetyBlockedError('domain_blocked' | 'circuit_open')`.
   - `requires_hitl` → SessionRecorder.recordEvent({ event_type: 'hitl_requested', ... }) + throw `SafetyBlockedError('requires_hitl')`.
   - `forbidden` → throw `SafetyBlockedError('forbidden_action')` immediately (no audit_event write — forbidden actions never reach SessionRecorder).
3. Caller (Phase 5 BrowseNode) catches SafetyBlockedError → FailureClassifier.classify({ kind: 'safety' }) → `safety_blocked`.
**Output:** void on safe path; SafetyBlockedError on all 3 block paths.
**Spec:** AC-02 + REQ-SAFETY-CHECK-001 + REQ-SAFETY-CLASSIFIER-001.

### Flow: LLMAdapter.complete pipeline (R10 + R14.1 + R14.2 + R14.5)

**Trigger:** Future Phase 7 EvaluateNode (or any LLM consumer) calls `await adapter.complete({ operation, prompt, audit_run_id, client_id, ... })`.
**Steps:**
1. **TemperatureGuard.check(req)** — if `operation ∈ {'evaluate','self_critique','evaluate_interactive'}` AND `temperature > 0`, throw `TemperatureGuardError`; write llm_call_log with `outcome='temperature_blocked'` (R14.1 atomic).
2. **BudgetGate.check(req, budget_remaining_usd)** — `estimated_cost = ceil(getTokenCount(prompt) * model_rate * 100) / 100`; if `estimated_cost > budget_remaining_usd`, throw `BudgetExceededError`; write llm_call_log with `outcome='budget_blocked'` (R14.1 atomic).
3. **AnthropicAdapter.invokeAPI** — 3-retry exponential backoff on 5xx / timeout / 429; primary `claude-sonnet-4-*`.
4. **#tryWriteRow llm_call_log** — atomic write BEFORE return: model + prompt_tokens + completion_tokens + cost_usd + duration_ms + cache_hit + audit_run_id + client_id + outcome (R14.1).
5. On 3-retry exhaustion: throw `LLMUnavailableError`; write llm_call_log with `outcome='unavailable'` (R14.5 protocol; v1.2 plugs fallback adapter at the same seam).
6. On non-retryable 4xx: throw with `outcome='error'`; write log row.
**Output:** `LLMCompleteResponse { text, model, usage, cost_usd }` on `outcome='ok'`; typed error + log row on every other outcome.
**Spec:** AC-08 + AC-09 + AC-10 + AC-11 + R10 + R14.1 + R14.2 + R14.5.

### Flow: PostgresStorage.withClient RLS-aware transaction (R7.2)

**Trigger:** Any consumer needs to query / write client-scoped tables.
**Steps:**
1. `await storage.withClient(client_id, async (tx) => { ... })`.
2. Inside the transaction, PostgresStorage executes `SET LOCAL app.client_id = $1; SET LOCAL ROLE app_user;` (start of transaction; never per-statement).
3. `app_user` role does NOT have BYPASSRLS — RLS policies enforce `client_id = public.current_client_id()` for SELECT/INSERT/UPDATE/DELETE.
4. Callback runs queries via Drizzle; any cross-client query returns empty rows (RLS-filtered).
5. Transaction commit / rollback as normal.
**Output:** Whatever the callback returns; cross-client data leakage is structurally impossible.
**Spec:** AC-12 + R7.2 + NF-Phase4-03 (100% RLS enforcement).

### Flow: Append-only enforcement (R7.4 — defense in depth)

**Trigger:** Any attempt to UPDATE or DELETE on the 5 append-only tables (audit_log, rejected_findings, finding_edits, llm_call_log, audit_events).
**Steps:**
1. **Type level:** Drizzle schema.ts wraps each append-only table in `AppendOnlyTable<T>` brand — `.update()` and `.delete()` methods are not present at the type level; TS compile error.
2. **DB level:** Each table has a `BEFORE UPDATE OR DELETE ... FOR EACH STATEMENT` trigger raising `'append-only violation: <table>'`. FOR EACH STATEMENT (not FOR EACH ROW) catches empty-set tampering attempts (Stage 2.5 strength).
**Output:** Compile error (type level) OR `ERROR: append-only violation: <table>` at runtime (DB level).
**Spec:** AC-05 + R7.4 + NF-Phase4-04 (100% append-only enforcement).

### Flow: AuditLogger + SessionRecorder + StreamEmitter observability spine (REQ-OBSERVE-*)

**Trigger:** Phase 5+ pipeline emits any audit lifecycle event (audit_started / page_browse_completed / finding_published / etc.).
**Steps:**
1. `AuditLogger.log({ audit_run_id, level, message, ... })` → INSERT into `audit_log` (append-only) via PostgresStorage.withClient(client_id).
2. `SessionRecorder.recordEvent({ event_type, audit_run_id, client_id, page_url?, metadata? })` → Zod-validate against 22-type AuditEventSchema → INSERT into `audit_events` (append-only).
3. `StreamEmitter.publish({ event, data })` → broadcast to in-process subscribers in SSE format (Phase 9 dashboard wraps with Hono SSE endpoint).
**Output:** 3 durable rows + 1 ephemeral SSE event; PostgresStorage transaction ensures all-or-nothing under client_id scope.
**Spec:** AC-06 + AC-07 + AC-14 + REQ-OBSERVE-AUDIT-LOG-001 + REQ-OBSERVE-SESSION-RECORDER-001 + REQ-STREAM-EMITTER-001.

### Flow: RobotsChecker pre-navigation gate (REQ-SAFETY-005)

**Trigger:** Phase 5 browse-mode navigation OR Phase 4b T4B-003 HtmlFetcher pre-request check.
**Steps:**
1. `await checker.isAllowed(url, userAgent)`.
2. UA spoof check: if `userAgent.toLowerCase()` starts with one of the 6 named bot prefixes (googlebot/bingbot/duckduckbot/yandexbot/baiduspider/facebookexternalhit), return `{ allowed: false, warning_code: 'ROBOTS_TXT_DISALLOWED' }` BEFORE any network I/O.
3. Cache lookup: `Map<auditRunId, RobotsTxt>`; if miss, fetch `<root>/robots.txt` (fallback to `<root>/ai-agent.txt`); parse User-agent + Disallow rules per RFC 9309.
4. On fetch failure: degrade open (allow); emit `ROBOTS_TXT_FETCH_FAILED` info-severity warning.
5. Match path against cached rules; if disallowed, return `{ allowed: false, matched_directive, warning_code: 'ROBOTS_TXT_DISALLOWED' }`.
**Output:** `{ allowed, matched_directive?, warning_code? }`; Phase 5 BrowseNode skips navigation + emits PerceptionBundle warning on disallowed.
**Spec:** AC-16 + REQ-SAFETY-005 + REQ-SAFETY-007 (UA-spoof rejection).

---

## 4. Known limitations carried forward

| Limitation | Phase to resolve | Workaround in place |
|---|---|---|
| **H1 — AnthropicAdapter uses PLACEHOLDER_UUID for RLS scope** (Stage 2.5 HIGH) | Phase 5 Gate 1 acceptance criterion | Test scaffolding ships in Phase 4; LLMCompleteRequest.client_id field already in schema; Phase 5 BrowseNode/AnalyzeNode wires `req.client_id` through. Stage 2.5 confirmed PROPERLY CLASSIFIED as Phase 5 follow-up |
| **H2 — #tryWriteRow swallows errors on outcome='ok' best-effort path** (Stage 2.5 HIGH) | Phase 5 Gate 1 acceptance criterion | AC-15 integration test (FK-seeded) confirms happy-path write succeeds; closes naturally when H1 closes (FK rejection that drives best-effort goes away once real client_id flows) |
| **M3 — Budget concurrency serialization inside withClient transaction** (Stage 2.5 MED) | Phase 5 polish | Current impl uses row-level lock on `audit_runs.budget_remaining_usd` via `SELECT ... FOR UPDATE` within the same transaction that writes llm_call_log — serializable per-transaction; cross-transaction race needs Phase 5 hardening once parallel LLM calls land |
| **R2 (Cloudflare) client deferred to post-MVP-pilot** | post-MVP-pilot per PRD §3.2 | ScreenshotStorage interface is R2-ready; LocalDiskStorage is the MVP impl; honors `SCREENSHOTS_DIR` env |
| **v1.2 fallback LLM adapter (GPT-4o) deferred** | v1.2 per PRD §3.2 | LLMUnavailableError throw protocol scaffolded; v1.2 plugs fallback adapter at the same protocol seam; AC-11 verifies the retry shape |
| **W1A parallel-migration deadlock in test scaffolding** | Phase 5 polish (test infra; act-005) | `--no-file-parallelism` workaround in test runner costs ~30s per run; fix options: (a) Postgres advisory lock around migration, (b) vitest globalSetup centralization, (c) `__migrations__` table for idempotency detection |
| **R7.4 Drizzle AppendOnlyTable<T> brand prevents only Drizzle-API UPDATE/DELETE — raw SQL still requires DB trigger** | already enforced (defense in depth) | Both layers active; DB trigger is the load-bearing layer; brand is the compile-time aid |
| **6 v1.1 verify strategies not yet wired into VerifyEngine** (carry-over from Phase 3) | v1.1 backlog | Phase 3 reserved enum slots; Phase 4 doesn't extend |

---

## 5. Open risks for next phase

| Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| **Phase 5 BrowseNode is the primary downstream consumer of 19 contracts simultaneously** | Highest-fan-out integration in MVP; one slip cascades | Phase 5 lead | Pre-flight gate (R20 invalidation note filed); MUST re-run `/speckit.analyze` against new Phase 4 surface before Stage 1; READ phase-4-current.md §1+§2 first |
| **Phase 5 orchestrator MUST thread `client_id` through `LLMCompleteRequest.client_id` to close H1+H2** | Until closed, llm_call_log rows have PLACEHOLDER_UUID client_id; cross-client cost attribution (R14.4) partially broken | Phase 5 BrowseNode lead | Stage 2.5 H1+H2 documented; Phase 5 Gate 1 acceptance criterion enforces |
| **SafetyCheck wraps every browse action — Phase 5 BrowseNode MUST call it BEFORE every tool invocation, not after** | One missed wrap = R8.4 violation (HITL bypass) + audit forensics gap | Phase 5 BrowseNode lead | Phase 5 conformance test parameterized over all 29 MCP tools should assert SafetyCheck is in the call stack for each |
| **LLMOperation 6-value enum LOCKED — Phase 6 / Phase 7 must use one of the 6 values OR amend impact.md** | Phase 7 grounding (if v1.1+ LLM-judged): could need a new 'ground' operation | Phase 7 lead | Forward stability promise documented in impact.md v1.0; `other` is the safety valve (TemperatureGuard does NOT include 'other' in REPRODUCIBILITY_BOUND_OPS) |
| **AuditEvent 22-type enum LOCKED — Phase 5/7/8/9 must use one of the 22 OR amend impact.md** | Phase 7 cross-page analysis already pre-positioned (cross_page_analysis_completed = #21); Phase 8 reproducibility writes already covered | engineering lead | Forward stability promise; SQL CHECK constraint enforces at DB level; Zod enum at API level — drift detected at compile + at write time |
| **R14.6 model_mismatch flag wired but not populated (v1.2 plugs fallback)** | Phase 7 must set `findings.model_mismatch=true` when AnthropicAdapter throws LLMUnavailableError + fallback engages (v1.2) | Phase 7 lead | `findings.model_mismatch` column added in T070; Phase 7 EvaluateNode populates |
| **0003_force_rls.sql additive migration not captured in spec AC-05 wording** | Documentation hygiene only; conformance tests GREEN | engineering lead (logged in act-002 addendum) | T070 task body addendum + spec.md v1.0 delta block; impact.md "Drizzle migrations" wording accommodates |

---

## 6. Conformance gate status (at phase exit — 2026-05-14)

| Test | AC | Status | Last run |
|---|---|---|---|
| `tests/conformance/action-classifier.test.ts` | AC-01 | ✅ green (4/4) | 2026-05-14 |
| `tests/conformance/safety-check.test.ts` | AC-02 | ✅ green (6/6) | 2026-05-14 |
| `tests/conformance/domain-policy.test.ts` | AC-03 | ✅ green (5/5) | 2026-05-14 |
| `tests/conformance/circuit-breaker.test.ts` | AC-04 | ✅ green (6/6) | 2026-05-14 |
| `tests/conformance/db-schema.test.ts` | AC-05 | ✅ green (6/6) | 2026-05-14 |
| `tests/conformance/audit-logger.test.ts` | AC-06 | ✅ green (3/3) | 2026-05-14 |
| `tests/conformance/session-recorder.test.ts` | AC-07 | ✅ green (4/4) | 2026-05-14 |
| `tests/conformance/llm-adapter.test.ts` | AC-08 | ✅ green (3/3) | 2026-05-14 |
| `tests/conformance/temperature-guard.test.ts` | AC-09 | ✅ green (8/8 — 3 reject + 3 allow + 2 boundary) | 2026-05-14 |
| `tests/conformance/budget-gate.test.ts` | AC-10 | ✅ green (5/5 incl. $0.001-overage rounding case) | 2026-05-14 |
| `tests/conformance/llm-failover.test.ts` | AC-11 | ✅ green (3/3 — MockAnthropicAdapter 5x-fail) | 2026-05-14 |
| `tests/conformance/storage-adapter.test.ts` | AC-12 | ✅ green (3/3 — parameterized over 10 RLS tables; cross-client returns empty) | 2026-05-14 |
| `tests/conformance/screenshot-storage.test.ts` | AC-13 | ✅ green (3/3 — SCREENSHOTS_DIR override honored) | 2026-05-14 |
| `tests/conformance/stream-emitter.test.ts` | AC-14 | ✅ green (3/3) | 2026-05-14 |
| `tests/integration/phase4.test.ts` | AC-15 | ✅ green (10/10 sub-scenarios; 18.16s wall-clock; well under 2-min budget) | 2026-05-14 |
| `tests/conformance/robots-checker.test.ts` | AC-16 | ✅ green (4/4 — incl. UA-spoof reject) | 2026-05-14 |
| `tests/conformance/context-profiles-slot.test.ts` | AC-17 | ✅ green (3/3) | 2026-05-14 |
| `tests/conformance/adapter-boundary.test.ts` | (boundary) | ✅ green (grep-based; ESLint defense in depth) | 2026-05-14 |
| Phase 0/0b/1/1b/1c/2/3 conformance (regression) | — | ✅ green (zero regression across 18-commit Phase 4 delta; 621 passing in parallel-mode) | 2026-05-14 |
| `pnpm typecheck` | — | ✅ clean (3/3 packages turbo) | 2026-05-14 |
| `pnpm lint` | — | ✅ clean (ESLint `no-restricted-imports` rule active) | 2026-05-14 |

---

## 7. What Phase 5 should read

When Phase 5 (BrowseNode) starts (next per INDEX.md dependency order: 4 → 4b → 5), the recommended reading order is:

1. **This file** (`phase-4-safety-infra-cost/phase-4-current.md`) — YOU ARE HERE
2. `phase-4-validation.md` (sibling — 5 ASCII proof sections + 6-item trust spot-check for ~20-min calibration)
3. `phase-3-verification/phase-3-current.md` (predecessor rollup — for VerifyEngine + ConfidenceScorer + FailureClassifier context)
4. `docs/specs/mvp/phases/phase-5-browse-mvp/README.md` (when authored / re-checked post-Phase-4)
5. `docs/specs/mvp/phases/phase-5-browse-mvp/spec.md` (after re-running `/speckit.analyze` per R20 invalidation note `r20-invalidation-from-phase-4.md`)
6. `packages/agent-core/src/safety/SafetyCheck.ts` — every BrowseNode action wraps in SafetyCheck.assertAllowed
7. `packages/agent-core/src/adapters/LLMAdapter.ts` — LLMCompleteRequest.client_id is the orchestrator integration point (H1+H2 closure)
8. `packages/agent-core/src/adapters/PostgresStorage.ts` — withClient(client_id, fn) is the RLS-aware transaction boundary
9. `docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md` v1.0 (Forward Contract section — Phase 5 import patterns)

When Phase 7 starts (after Phase 5/6):

1. This file + phase-4-validation.md
2. `phase-4-safety-infra-cost/impact.md` v1.0 §Forward Contract
3. `packages/agent-core/src/adapters/LLMAdapter.ts` + `TemperatureGuard.ts` — EvaluateNode + SelfCritiqueNode call surface
4. `packages/agent-core/src/types/llm.ts` — LLMOperation enum (operation: 'evaluate' / 'self_critique' / 'evaluate_interactive')
5. `packages/agent-core/src/db/schema.ts` — findings table for evaluate writes; rejected_findings for grounding rejects

Do NOT load all Phase 4 artifacts. The compression is intentional. Shared contracts (19) live in `packages/agent-core/src/{safety,adapters,db,observability,types}/*.ts` — read those files directly.

---

## 8. Cost + time summary (this phase)

| Metric | Target | Actual |
|---|---|---|
| Duration (sessions) | 2-3 sessions (planned; highest-risk phase in MVP) | 1 session 2026-05-14 (~6-7 hr wall-clock; Gate 1 2-pass + Stage 2 9 waves + Stage 2.5 + Stage 3 + Stage 3b + Stage 4) |
| Tasks completed | 13 MVP tasks (T066-T076 + T080 + T080a) + 3 setup + 3 polish | 13/13 MVP ✅ + 3 SETUP ✅ + 3 polish ✅ (T-PHASE4-ROLLUP lands in this commit) |
| LLM spend total (Master orchestration) | $30 user-approved per-phase ceiling (50% under high-attention mode) | ~$2.15 cumulative (Gate 1 Pass 1 $1.20 + patch wave $0.00 + Gate 1 Pass 2 $0.40 + Gate 2 $0.55); $27.85 ceiling remaining |
| Phase 4 commits | (no target) | 21 commits on `feat/phase-4-safety-infra-cost` since branch cut from master `2506ff1` (3 Stage-1 + 16 Stage-2 + 3 Stage-4 close-out — incl. this rollup commit) |
| Net LOC delta (impl) | (no target) | sources ~4,191 (28 source files across safety/adapters/db/observability/types + 3 SQL migrations) + tests ~1,535 (17 conformance test files) + integration ~249 + Stage 4 docs (this file + validation; ~800) |
| Test count delta | (no target) | +73 net new Phase 4 sequential tests (574 Phase 3 baseline → 647 at phase exit; sequential mode `--no-file-parallelism` for migration safety); zero regression on Phase 0-3 |
| AC coverage | 17 ACs | 17/17 GREEN |

---

*End of phase-4-current.md. Sibling: phase-4-validation.md (5 ASCII proof sections + §6 trust spot-check list).*
