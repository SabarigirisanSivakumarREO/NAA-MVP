---
title: Phase 4 — Safety + Infrastructure + Cost
artifact_type: phase-readme
status: approved
version: 1.0
phase_number: 4
phase_name: Safety + Infra + Cost
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
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
delta:
  new:
    - Phase 4 README
  changed: []
  impacted: []
  unchanged: []
governing_rules:
  - Constitution R7 (Database & Storage — R7.1 Drizzle-only, R7.2 RLS, R7.4 append-only)
  - Constitution R8 (Cost & Safety — R8.1 audit budget, R8.2 page budget, R8.4 sensitive HITL)
  - Constitution R9 (Adapter Pattern — third+ adapter categories: LLM, Storage, ScreenshotStorage)
  - Constitution R10 (Reproducibility — TemperatureGuard at adapter boundary)
  - Constitution R14 (Cost Accountability — atomic LLM logging, pre-call budget, per-client attribution, failover)
  - Constitution R17, R19, R20
  - PRD §F-014 (Cost & Budget), §F-016 (Safety), §F-017 (Audit Logging)
---

# Phase 4 — Safety + Infrastructure + Cost

> **Summary (~150 tokens):** The infrastructure spine. **12 MVP tasks** (T066-T076 + T080; T077-T079 reserved). Lands four safety primitives (ActionClassifier, SafetyCheck, DomainPolicy, CircuitBreaker), the **first real Postgres schema** via Drizzle (T070 — 12 tables + RLS + append-only triggers + ALTER on findings), audit logging (AuditLogger to `audit_log` append-only table, SessionRecorder to `audit_events`), the **first LLM adapter** (LLMAdapter + AnthropicAdapter with TemperatureGuard enforcing R10 + cost logging per R14 + per-call failover protocol per R14.5), StorageAdapter + PostgresStorage + ScreenshotStorage + LocalDiskStorage, StreamEmitter for SSE, and a Phase 4 integration test. **Highest cross-cutting surface in MVP** — third adapter category (LLM), first DB schema, first LLM call. Phase 5+ depends on every contract here.

## Goal

After Phase 4: Drizzle schema migrated; `pnpm db:migrate` applies real schema (no longer a stub from Phase 0); RLS enforced on all client-scoped tables; UPDATE/DELETE prevented on append-only tables (DB triggers + R7.4 conformance test); LLMAdapter callable with TemperatureGuard rejecting any temp > 0 on `evaluate`/`self_critique`/`evaluate_interactive`; every LLM call logged atomically to `llm_call_log` (R14.1); pre-call budget gate computes estimated cost (R14.2); per-call failover (3 retries → fallback adapter → `LLMUnavailableError`) implemented per R14.5; `findings.model_mismatch` set on fallback per R14.6; SafetyCheck + DomainPolicy + CircuitBreaker block sensitive actions and untrusted domains; storage adapter writes screenshots to R2 (prod) or LocalDisk (dev) with no base64 in DB.

## Tasks (MVP — 12 tasks)

| Task | Description |
|---|---|
| T066 | ActionClassifier — maps tool name → safety class (consumes Phase 2 SafetyClass enum) |
| T067 | SafetyCheck — runtime gate; HITL pause for `requires_hitl` |
| T068 | DomainPolicy — trusted/unknown/blocked domain registry |
| T069 | CircuitBreaker — domain failure threshold (3 failures → 1-hour block) |
| T070 | PostgreSQL schema (Drizzle) — 12 tables + RLS + append-only enforcement + initial + extensions migrations |
| T071 | AuditLogger — writes to `audit_log` (append-only) |
| T072 | SessionRecorder — writes to `audit_events` (22 event types per §34.4) |
| T073 | LLMAdapter + AnthropicAdapter — first LLM contact; TemperatureGuard; failover; cost logging |
| T074 | StorageAdapter + PostgresStorage |
| T075 | ScreenshotStorage + LocalDiskStorage (R2 upload deferred; LocalDisk only in MVP) |
| T076 | StreamEmitter (SSE for dashboard later phases) |
| T080 | Phase 4 integration test |

T077-T079 reserved (no MVP work).

Full descriptions: [tasks.md](tasks.md). Cross-reference: [tasks-v2.md T066-T080](docs/specs/mvp/tasks-v2.md).

## Exit criteria

- [ ] `pnpm db:migrate` runs full schema (no longer a stub)
- [ ] All client-scoped tables have RLS policies; conformance test verifies
- [ ] Append-only tables reject UPDATE/DELETE (DB triggers + conformance test)
- [ ] `LLMAdapter.complete(...)` works against AnthropicAdapter with `claude-sonnet-4-*` model
- [ ] `TemperatureGuard` rejects `temperature > 0` on `evaluate` / `self_critique` / `evaluate_interactive` calls
- [ ] Every LLM call appears in `llm_call_log` with model, tokens, cost, duration, cache_hit
- [ ] Pre-call budget gate skips call if `estimated_cost > budget_remaining_usd`
- [ ] Failover: primary 3 retries → fallback 2 retries → `LLMUnavailableError`; `model_mismatch=true` set on fallback-generated findings (Phase 7 will wire)
- [ ] `pnpm test:integration phase4` green: 4 tables CRUD with RLS + 1 LLM call with budget gate + 1 screenshot write to LocalDisk
- [ ] No direct imports of `@anthropic-ai/sdk`, `pg`, `drizzle-orm` outside their adapter files (R9 grep verify)

## Depends on

- **Phase 0** (Postgres container + stub `db:migrate` script — Phase 4 replaces stub with real Drizzle migrations)
- **Phase 2** (SafetyClass enum + MCPToolRegistry — ActionClassifier consumes safetyClass)
- **Phase 3** (FailureClassifier — SafetyCheck produces `safety_blocked` failures consumed by orchestrator routing)

## Blocks

- **Phase 5** (Browse MVP — needs SafetyCheck wrapping action invocation; storage for screenshots)
- **Phase 7** (Analysis Pipeline — needs LLMAdapter + AnthropicAdapter for evaluate/self_critique nodes; needs DB schema for findings persistence)
- **Phase 8** (Orchestrator — needs reproducibility_snapshots table; full audit_runs lifecycle)
- **Phase 9** (Delivery — needs all above)

## Rollup on exit

```bash
pnpm spec:rollup --phase 4
```

`phase-4-current.md` per R19. Active modules: `safety/`, `db/` (Drizzle), `adapters/` (LLM, Storage, ScreenshotStorage), `observability/` extended, `mcp/` (StreamEmitter integration). Contracts (most-impactful set in MVP): LLMAdapter, AnthropicAdapter, TemperatureGuard, BudgetGate, StorageAdapter, ScreenshotStorage, ActionClassifier, SafetyCheck, DomainPolicy, CircuitBreaker, AuditLogger, SessionRecorder, StreamEmitter, **DB schema (12 tables)**. Forward risks for Phase 5 (action node integration), Phase 7 (LLM call surface stability), Phase 8 (reproducibility snapshot composition).

## Reading order for Claude Code

1. This README
2. [tasks.md](tasks.md) — find target task (most are deeper than Phase 1-3 tasks)
3. [spec.md](spec.md), [impact.md](impact.md) — heavy due to scope
4. [plan.md](plan.md) — file map across 4 directories
5. `docs/specs/final-architecture/13-data-layer.md` — DB schema authoritative spec (T070 primary reference)
6. `docs/specs/final-architecture/11-safety-cost.md` — safety + cost authoritative
7. `docs/specs/final-architecture/34-observability.md` — audit_events 22 types, AuditLogger
8. `docs/specs/mvp/constitution.md` R7, R8, R9, R10, R14 — all heavily exercised here

Do NOT load:
- Analysis specs (§07 — Phase 7 consumes Phase 4's contracts but is its own scope)
- Other phase folders
