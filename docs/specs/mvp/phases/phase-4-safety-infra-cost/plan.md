---
title: Implementation Plan — Phase 4 Safety + Infra + Cost
artifact_type: plan
status: draft
version: 0.2
created: 2026-04-27
updated: 2026-04-28
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md
  - docs/specs/mvp/architecture.md (§6.4, §6.5)
  - docs/specs/mvp/constitution.md (R1-R23; especially R7, R9, R10, R14)

req_ids:
  - REQ-SAFETY-CLASSIFIER-001
  - REQ-SAFETY-CHECK-001
  - REQ-DATA-SCHEMA-001
  - REQ-DATA-RLS-001
  - REQ-DATA-APPEND-ONLY-001
  - REQ-LLM-ADAPTER-001
  - REQ-LLM-TEMPERATURE-GUARD-001
  - REQ-LLM-FAILOVER-001
  - REQ-LLM-COST-LOG-001
  - REQ-STORAGE-ADAPTER-001
  - REQ-SCREENSHOT-STORAGE-001

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
  - AuditLogger
  - SessionRecorder
  - StreamEmitter
  - DBSchema
  - LLMCallRecord
  - AuditEvent

delta:
  new:
    - First plan introducing 18 simultaneous shared contracts (largest in MVP)
    - First Drizzle migrations (T070 — replaces Phase 0 stub)
    - First LLM adapter (T073 — third adapter category lands; ESLint rule activates)
    - v0.2 — T080a RobotsChecker (§11.1.1) added; T070 schema baseline reserves context_profiles slot
  changed:
    - v0.1 → v0.2 — adds §11.1.1 robots/ToS utility + context_profiles slot reservation; both unblock Phase 4b T4B-003 + T4B-012
  impacted:
    - Phase 4b T4B-003 HtmlFetcher imports `RobotsChecker.isAllowed()` — Phase 4 must ship this utility before Phase 4b begins
    - Phase 4b T4B-012 lands the actual context_profiles migration — Phase 4 reserves the slot in the T070 schema baseline
    - Phase 5 browse-mode navigation gates on RobotsChecker — Phase 5 imports the same utility
  unchanged:
    - All baseline tasks T066-T076 + T080 (12 MVP tasks unchanged)
    - Architecture (no new deps; undici cheerio already used by adapters elsewhere; robots parsing uses `robots-parser` npm or hand-rolled — chosen at implementation time)

governing_rules:
  - Constitution R7 (DB)
  - Constitution R8 (Cost + Safety)
  - Constitution R9 (Adapter)
  - Constitution R10 (Temperature)
  - Constitution R14 (Cost Accountability)
  - Constitution R17, R20, R23
---

# Implementation Plan: Phase 4 — Safety + Infra + Cost

> **Summary (~120 tokens):** Build the infrastructure spine in 12 MVP tasks. T066-T069 safety primitives. T070 Drizzle schema (12 tables + RLS + append-only triggers across two migrations). T071-T072 audit observability. **T073 the cornerstone**: LLMAdapter + AnthropicAdapter + TemperatureGuard + BudgetGate + atomic logging + failover protocol — all in ONE coherent module set. T074-T076 storage + screenshot + stream. T080 integration test. ESLint `no-restricted-imports` rule activates here (third adapter category). Adds Anthropic SDK + Drizzle + pg deps. impact.md HIGH-risk (18 contracts).

**Branch:** `phase-4-safety-infra-cost`
**Date:** 2026-04-27
**Spec:** spec.md | **Impact:** impact.md

---

## Summary

Phase 4 is the densest infrastructure phase in MVP. Three pillars built in parallel:

1. **Safety pillar (T066-T069):** ActionClassifier consumes Phase 2's SafetyClass; SafetyCheck wraps action invocation with HITL emission; DomainPolicy + CircuitBreaker round out the safety surface.
2. **Data pillar (T070-T072):** Drizzle migrations land 12 tables with RLS + append-only triggers; AuditLogger writes append-only to `audit_log`; SessionRecorder emits 22 audit_event types.
3. **LLM + storage pillar (T073-T076):** LLMAdapter + AnthropicAdapter + TemperatureGuard + BudgetGate (the cornerstone task T073); StorageAdapter + ScreenshotStorage; StreamEmitter for SSE.

All three pillars converge in T080 integration test.

---

## Technical Context

| Field | Value | Used in Phase 4? |
|---|---|---|
| TypeScript | 5.x | ✅ |
| Node | 22 LTS | ✅ |
| Zod | 3.x | ✅ (LLMCallRecord, AuditEvent, every adapter I/O) |
| Anthropic SDK | `@anthropic-ai/sdk` (NEW Phase 4 dep — only in AnthropicAdapter.ts) | ✅ |
| Drizzle ORM | (NEW Phase 4 dep — only in db/ + PostgresStorage) | ✅ |
| pg | (NEW Phase 4 dep — only in PostgresStorage / Drizzle init) | ✅ |
| Sharp | already pinned | ❌ Phase 4 doesn't use; Phase 5+ |
| BullMQ | pinned | ⏸️ Phase 4 sets up StreamEmitter SSE only; queue work Phase 8 |
| Postgres + pgvector | Phase 0 container | ✅ |
| Pino | already pinned | ✅ (new correlation: audit_run_id, client_id, llm_call_id, event_type, safety_class, domain) |
| Vitest | already pinned | ✅ |
| All other deps | various | later phases |

**Performance / Scale targets:** NF-Phase4-01..05 (migration < 30 s; LLM overhead < 100 ms; RLS 100% enforcement; append-only 100% enforcement; integration < 2 min).

**Project Type:** monorepo extension. Adds `db/` directory (NEW). No new top-level structure.

---

## Constitution Check

- [x] R5.3 + GR-007 — N/A (no findings)
- [x] R6 heuristic boundary — N/A (no heuristics yet)
- [x] R7.1 Drizzle-only — yes; raw SQL ONLY in `db/migrations/*.sql` for triggers + RLS policies (allowed exception)
- [x] R7.2 RLS — enforced on 10 client-scoped tables via Postgres RLS policies; PostgresStorage `SET LOCAL app.client_id` per transaction
- [x] R7.4 append-only — DB triggers on `audit_log`, `rejected_findings`, `finding_edits`, `llm_call_log`, `audit_events`; Drizzle schema also omits update/delete methods at type level
- [x] R8.1/R8.2 budget — BudgetGate enforces per-call; audit/page budget tracked in `audit_runs` columns
- [x] R8.3 rate limiting — Phase 2 RateLimiter consumed; CircuitBreaker is per-domain failure layer
- [x] R8.4 HITL — SafetyCheck emits `hitl_requested` to `audit_events`; orchestrator (Phase 5) routes
- [x] R9 adapter — third adapter category (LLM) + StorageAdapter + ScreenshotStorage. ESLint `no-restricted-imports` rule lands now. AnthropicAdapter is the SOLE Anthropic importer; PostgresStorage is the SOLE pg/Drizzle importer outside `db/`
- [x] R10 TemperatureGuard — at AnthropicAdapter boundary; rejects temp > 0 on evaluate / self_critique / evaluate_interactive
- [x] R10.1-R10.6 file/function size, no console.log — declared per task; LLMAdapter is the largest (~250 lines, may need split into LLMAdapter.ts + AnthropicAdapter.ts + TemperatureGuard.ts + BudgetGate.ts to stay under 300/file)
- [x] R11.2 REQ-ID tracing — 16 REQ-IDs cited
- [x] R14.1 atomic log — log row written BEFORE return
- [x] R14.2 pre-call budget — BudgetGate is structural
- [x] R14.5 failover protocol — 3 primary retries → throw; v1.2 plugs fallback
- [x] R14.6 model_mismatch flag — `findings.model_mismatch` column added in T070; populated by Phase 7
- [x] R20 impact.md — REQUIRED, HIGH risk, 18 contracts; authored
- [x] R23 kill criteria — default block + per-task on T070 (DB schema; > 2hr; shared contract; HIGH risk) + T073 (LLM adapter; > 2hr; shared contract; R10 enforcement)

---

## Project Structure

```
docs/specs/mvp/phases/phase-4-safety-infra-cost/
├── README.md
├── spec.md
├── impact.md           # R20 — HIGH risk (18 contracts)
├── plan.md             # this file
├── tasks.md
├── checklists/requirements.md
└── phase-4-current.md  # rollup at exit (R19; created by user)
```

### Source Code

```
packages/agent-core/src/
├── adapters/                                  # extends Phase 1 (BrowserEngine) + Phase 2 (MCP)
│   ├── README.md                              # MODIFIED — list LLMAdapter, StorageAdapter, ScreenshotStorage as new categories
│   ├── BrowserEngine.ts                       # (Phase 1)
│   ├── LLMAdapter.ts                          # T073 — interface
│   ├── AnthropicAdapter.ts                    # T073 — concrete (SOLE @anthropic-ai/sdk importer)
│   ├── TemperatureGuard.ts                    # T073 — R10 enforcement
│   ├── BudgetGate.ts                          # T073 — R14.2 enforcement
│   ├── StorageAdapter.ts                      # T074 — interface
│   ├── PostgresStorage.ts                     # T074 — Drizzle impl (SOLE pg + Drizzle importer outside db/)
│   ├── ScreenshotStorage.ts                   # T075 — interface
│   ├── LocalDiskStorage.ts                    # T075 — concrete
│   └── index.ts                               # barrel
│
├── safety/                                    # NEW directory
│   ├── ActionClassifier.ts                    # T066
│   ├── SafetyCheck.ts                         # T067
│   ├── DomainPolicy.ts                        # T068
│   ├── CircuitBreaker.ts                      # T069
│   └── index.ts
│
├── db/                                        # NEW directory
│   ├── schema.ts                              # Drizzle table definitions
│   ├── migrations/
│   │   ├── 0001_initial.sql                   # 7 tables (Phase 1 of master plan §13.1-§13.5)
│   │   └── 0002_master_extensions.sql         # 5 extension tables + ALTER findings + RLS + append-only triggers
│   ├── client.ts                              # Drizzle client init (uses pg internally)
│   └── index.ts
│
├── observability/                             # extends Phase 0+1+2+3
│   ├── logger.ts                              # MODIFIED — add audit_run_id, client_id, llm_call_id, event_type, safety_class, domain
│   ├── AuditLogger.ts                         # T071
│   ├── SessionRecorder.ts                     # T072
│   ├── StreamEmitter.ts                       # T076
│   └── index.ts
│
└── types/                                     # cross-cutting Zod
    ├── llm.ts                                 # LLMCallRecord
    ├── audit-events.ts                        # AuditEvent (22-type enum)
    └── index.ts
```

### Test Layout

```
packages/agent-core/tests/
├── conformance/
│   ├── action-classifier.test.ts              # AC-01
│   ├── safety-check.test.ts                   # AC-02
│   ├── domain-policy.test.ts                  # AC-03
│   ├── circuit-breaker.test.ts                # AC-04
│   ├── db-schema.test.ts                      # AC-05 (a)
│   ├── db-rls.test.ts                         # AC-05 (b) — cross-client query test
│   ├── db-append-only.test.ts                 # AC-05 (c) — UPDATE/DELETE attempts
│   ├── audit-logger.test.ts                   # AC-06
│   ├── session-recorder.test.ts               # AC-07
│   ├── llm-adapter.test.ts                    # AC-08 (uses MockAnthropicAdapter)
│   ├── temperature-guard.test.ts              # AC-09
│   ├── budget-gate.test.ts                    # AC-10
│   ├── llm-failover.test.ts                   # AC-11
│   ├── storage-adapter.test.ts                # AC-12
│   ├── screenshot-storage.test.ts             # AC-13
│   ├── stream-emitter.test.ts                 # AC-14
│   └── adapter-import-boundary.test.ts        # NEW — grep test verifying R9 boundaries (no @anthropic-ai/sdk outside AnthropicAdapter.ts; no pg outside PostgresStorage.ts)
└── integration/
    └── phase4.test.ts                          # AC-15 — fresh DB + LocalDisk + MockAnthropic
```

`package.json` adds: `@anthropic-ai/sdk`, `drizzle-orm`, `drizzle-kit`, `pg`. ESLint config gets `no-restricted-imports` rule.

---

## Phase 0 — Research

**Open design choices resolved:**

1. **Drizzle migration strategy:** two SQL files (`0001_initial.sql` + `0002_master_extensions.sql`) per master plan §13. Drizzle `meta` table tracks applied migrations; `pnpm db:migrate` is idempotent.
2. **RLS implementation:** Postgres RLS policies CREATE'd in `0002_master_extensions.sql`. PostgresStorage opens transactions with `SET LOCAL app.client_id = '<uuid>'` — never per-statement to avoid leaks.
3. **Append-only enforcement:** SQL trigger function (single `enforce_append_only()` plpgsql) attached to 5 append-only tables via `CREATE TRIGGER ... BEFORE UPDATE OR DELETE`. Drizzle schema additionally type-level removes update/delete methods.
4. **TemperatureGuard placement:** at top of `AnthropicAdapter.complete()` BEFORE any API call. Operation class is required field on `LLMCompleteRequest` — no inference, caller must declare.
5. **BudgetGate placement:** also in `AnthropicAdapter.complete()`, AFTER TemperatureGuard, BEFORE API call. Reads `audit_runs.budget_remaining_usd` with row-level lock.
6. **Failover protocol:** 3 primary retries with exponential backoff (1s, 2s, 4s). After 3 failures: write log row with `outcome='unavailable'`, throw `LLMUnavailableError`. v1.2 will register a fallback adapter that the protocol invokes after primary exhaustion.
7. **22 audit_event types:** enumerated in `types/audit-events.ts` Zod enum per §34.4. Examples: `audit_started`, `audit_complete`, `tool_invoked`, `hitl_requested`, `hitl_approved`, `hitl_rejected`, `circuit_breaker_tripped`, `budget_warning`, `budget_exceeded`, `llm_call_made`, `llm_call_failed`, `finding_created`, `finding_grounded`, `finding_rejected`, etc.
8. **MockAnthropicAdapter:** lives in `tests/test-utils/MockAnthropicAdapter.ts`; never imported from production code. Phase 4 also lands a generic `MockLLMAdapter` for use across phases (Phase 7 will use it for unit tests).

---

## Phase 1 — Design

(Detailed in spec.md + impact.md — design captured there to keep this plan compact.)

Key design decisions inline:

1. **LLMAdapter is interface only; AnthropicAdapter is the concrete impl.** Splitting into `LLMAdapter.ts` (interface + types) + `AnthropicAdapter.ts` (impl) keeps each file < 200 lines.
2. **TemperatureGuard + BudgetGate are pure modules** (one class each, ~50 lines). Imported by AnthropicAdapter.
3. **Drizzle schema split:** initial 7 tables in `0001_initial.sql` + 5 extension tables (page_states, state_interactions, finding_rollups, reproducibility_snapshots, audit_requests) + ALTER on findings + RLS policies + append-only triggers in `0002_master_extensions.sql`. Single migration could work but splitting matches master plan §13 phasing.
4. **PostgresStorage exposes typed methods per entity** (`createAuditRun`, `getFindings`, etc.) rather than raw query passthrough — keeps R9 strict.
5. **R9 boundary test** (`adapter-import-boundary.test.ts`) is grep-based, similar to Phase 3's R4.4 enforcement: reads `packages/agent-core/src/` recursively, asserts no file outside the adapter directory imports `@anthropic-ai/sdk`, `pg`, or `drizzle-orm`.
6. **22 audit_event types** are a sealed Zod enum; expansion requires Phase 4 amendment + impact.md cycle (per impact.md "Forward stability").

---

## Complexity Tracking

**None — plan respects all 23 Constitution rules.**

The 18-contract surface is the *expected* outcome of materializing R7 + R9 + R10 + R14 simultaneously. Not a violation; impact.md provides provenance per R22.

---

## Approval Gates

| Gate | Approver | Evidence |
|---|---|---|
| Spec → Plan transition | spec author + product owner + engineering lead | spec `approved` AND impact.md `approved` (HIGH risk gate) |
| Tech stack adherence | engineering lead | All §6.4 fields match (3 new deps activated: anthropic-ai-sdk, drizzle-orm, pg) |
| Constitution check | engineering lead | All checkboxes ticked |
| R7.1/R7.2/R7.4 enforcement | engineering lead | T070 conformance suite designed; kill criterion in place |
| R10 TemperatureGuard | engineering lead | T073 conformance test designed; kill criterion in place |
| R14 cost accountability | engineering lead | T073 sub-tests designed (atomic log, budget gate, failover) |
| Plan → Tasks transition | engineering lead | This plan `approved` |

---

## Cross-references

- spec.md, impact.md (this folder)
- Phase 2 spec, impact (SafetyClass enum, MCPToolRegistry consumed)
- Phase 3 spec, impact (FailureClassifier consumed)
- `docs/specs/mvp/tasks-v2.md` T066-T080
- `docs/specs/final-architecture/11-safety-cost.md`
- `docs/specs/final-architecture/13-data-layer.md`
- `docs/specs/final-architecture/34-observability.md`
- `docs/specs/mvp/constitution.md` R7, R8, R9, R10, R14, R20, R23
