---
title: Impact Analysis — Phase 4 Safety + Infra + Cost (18 new shared contracts)
artifact_type: impact
status: draft
version: 0.1
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md
  - docs/specs/mvp/phases/phase-4-safety-infra-cost/plan.md
  - docs/specs/final-architecture/11-safety-cost.md
  - docs/specs/final-architecture/13-data-layer.md
  - docs/specs/final-architecture/34-observability.md

req_ids:
  - REQ-LLM-ADAPTER-001
  - REQ-LLM-TEMPERATURE-GUARD-001
  - REQ-DATA-SCHEMA-001
  - REQ-DATA-RLS-001
  - REQ-DATA-APPEND-ONLY-001

breaking: false
risk_level: high

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
    - First impact.md introducing DB schema as shared contract; 18 simultaneous contracts
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R7
  - Constitution R8
  - Constitution R9
  - Constitution R10
  - Constitution R14
  - Constitution R18
  - Constitution R20
  - Constitution R22
---

# Impact Analysis: 18 new shared contracts (LLM + DB + Storage + Safety + Observability)

## Why R20 applies — and why risk_level is HIGH

Phase 4 introduces eighteen new shared contracts, more than any other phase. Three categories:

1. **LLM contract surface** (LLMAdapter, AnthropicAdapter, TemperatureGuard, BudgetGate, LLMCallRecord) — Neural's first LLM contact. Every later phase that calls LLMs (Phase 7 evaluate/self_critique, Phase 9 nothing) consumes this. **R10 reproducibility** + **R14 cost accountability** both materialize here.
2. **Database surface** (DBSchema with 12 tables + RLS + append-only, StorageAdapter, PostgresStorage, AuditLogger, SessionRecorder, AuditEvent) — first persistence. Phase 5 audit_runs + Phase 7 findings + Phase 8 reproducibility_snapshots + Phase 9 reports all read/write this schema. **R7.1/R7.2/R7.4** materialize here.
3. **Safety + Observability** (ActionClassifier, SafetyCheck, DomainPolicy, CircuitBreaker, ScreenshotStorage, LocalDiskStorage, StreamEmitter) — wraps every action invocation in Phase 5+ and produces the observability spine.

risk_level: **HIGH** because:
- DB schema is the most fan-out contract — touched by every phase 5+. Schema mistakes are expensive to migrate.
- LLMAdapter is Neural's reproducibility boundary (R10 enforced here). One TemperatureGuard slip-up + Phase 7 grounding produces non-reproducible findings.
- 18 contracts in one phase means 18 review surfaces — comprehension-debt risk per PRD §10.10.

Compare Phase 2 (4 contracts, HIGH risk): Phase 4 has 18 contracts and the DB schema specifically. Hence HIGH (could argue CRITICAL but holding HIGH because all additive — no migrations from prior versions).

## Affected modules

### Phase 4 itself

| File | Layer | Role |
|---|---|---|
| `packages/agent-core/src/adapters/LLMAdapter.ts` | adapters | Interface + types + LLMCallRecord schema |
| `packages/agent-core/src/adapters/AnthropicAdapter.ts` | adapters | Concrete impl; ONLY file importing `@anthropic-ai/sdk` |
| `packages/agent-core/src/adapters/TemperatureGuard.ts` | adapters | Operation-class-aware temperature enforcement |
| `packages/agent-core/src/adapters/BudgetGate.ts` | adapters | Pre-call cost estimation + budget check |
| `packages/agent-core/src/adapters/StorageAdapter.ts` | adapters | Interface |
| `packages/agent-core/src/adapters/PostgresStorage.ts` | adapters | Drizzle-based concrete impl; ONLY file importing `pg` + Drizzle |
| `packages/agent-core/src/adapters/ScreenshotStorage.ts` | adapters | Interface |
| `packages/agent-core/src/adapters/LocalDiskStorage.ts` | adapters | LocalDisk concrete impl |
| `packages/agent-core/src/safety/ActionClassifier.ts` | safety | Maps tool name → SafetyClass (consumes Phase 2 ToolRegistry) |
| `packages/agent-core/src/safety/SafetyCheck.ts` | safety | Runtime gate; emits hitl_requested events |
| `packages/agent-core/src/safety/DomainPolicy.ts` | safety | trusted/unknown/blocked |
| `packages/agent-core/src/safety/CircuitBreaker.ts` | safety | 3-failure / 1-hour |
| `packages/agent-core/src/observability/AuditLogger.ts` | observability | Writes to audit_log (append-only) |
| `packages/agent-core/src/observability/SessionRecorder.ts` | observability | 22 audit_event types |
| `packages/agent-core/src/observability/StreamEmitter.ts` | observability | SSE publish |
| `packages/agent-core/src/db/schema.ts` | db | Drizzle table definitions (12 tables) |
| `packages/agent-core/src/db/migrations/0001_initial.sql` | db | Initial 7 tables (Phase 1 of master plan) |
| `packages/agent-core/src/db/migrations/0002_master_extensions.sql` | db | 5 extension tables + ALTER on findings + RLS policies + append-only triggers |
| `packages/agent-core/src/db/index.ts` | db | barrel + connection helper |
| `packages/agent-core/src/types/llm.ts` | types | LLMCallRecord Zod schema |
| `packages/agent-core/src/types/audit-events.ts` | types | AuditEvent Zod schema (22-type enum) |

Plus modify `packages/agent-core/src/observability/logger.ts` to register new correlation fields (audit_run_id, client_id, llm_call_id, event_type, safety_class, domain).

### Downstream consumers (forward contract)

| Phase | File(s) | Imports |
|---|---|---|
| Phase 5 | `orchestration/nodes/BrowseNode.ts` | SafetyCheck, ScreenshotStorage, AuditLogger, SessionRecorder |
| Phase 5 | `orchestration/AuditState.ts` | LLMCallRecord (per-state cost tracking) |
| Phase 7 | `analysis/nodes/EvaluateNode.ts` | LLMAdapter (operation: 'evaluate', temperature must be 0) |
| Phase 7 | `analysis/nodes/SelfCritiqueNode.ts` | LLMAdapter (operation: 'self_critique', temperature must be 0) |
| Phase 7 | `analysis/nodes/StoreNode.ts` | StorageAdapter (writes findings + finding_edits) |
| Phase 7 | `analysis/nodes/AnnotateNode.ts` | ScreenshotStorage (annotated screenshots) |
| Phase 8 | `orchestration/nodes/AuditCompleteNode.ts` | StorageAdapter (writes reproducibility_snapshots, finalizes audit_runs) |
| Phase 9 | `delivery/ReportGenerator.ts` | StorageAdapter (reads everything for PDF) |
| Phase 9 | `apps/dashboard/...` | StreamEmitter (SSE consumer) |

## Affected contracts — high-level shapes

### `LLMAdapter` (NEW)

```ts
export type LLMOperation = 'evaluate' | 'self_critique' | 'evaluate_interactive' | 'classify' | 'extract' | 'other';

export interface LLMCompleteRequest {
  operation: LLMOperation;       // R10 reproducibility binding
  audit_run_id: string;           // R14 budget + cost attribution
  systemPrompt?: string;
  userPrompt: string;
  temperature: number;            // TemperatureGuard rejects > 0 for evaluate/self_critique/evaluate_interactive
  maxTokens: number;
  model?: string;                 // defaults to pinned claude-sonnet-4-*
  metadata?: Record<string, unknown>;
}

export interface LLMCompleteResponse {
  text: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; cacheHit: boolean };
  costUsd: number;
  durationMs: number;
}

export interface LLMAdapter {
  complete(req: LLMCompleteRequest): Promise<LLMCompleteResponse>;
  estimateCost(req: Pick<LLMCompleteRequest, 'userPrompt' | 'systemPrompt' | 'model'>): Promise<number>;
}
```

Implementation guarantees (atomically, before return):
- Writes one `llm_call_log` row.
- Decrements `audit_runs.budget_remaining_usd` (with row-level lock).
- On budget exceeded: writes log row with `outcome='budget_blocked'`, throws `BudgetExceededError`.
- On retry exhaustion: writes log row with `outcome='unavailable'`, throws `LLMUnavailableError`.

### `TemperatureGuard` (NEW — R10 enforcement)

```ts
export class TemperatureGuard {
  static REPRODUCIBILITY_BOUND_OPS: ReadonlySet<LLMOperation> = new Set([
    'evaluate', 'self_critique', 'evaluate_interactive',
  ]);
  static check(req: LLMCompleteRequest): void {
    if (TemperatureGuard.REPRODUCIBILITY_BOUND_OPS.has(req.operation) && req.temperature > 0) {
      throw new TemperatureGuardError(req.operation, req.temperature);
    }
  }
}
```

Called at the top of `AnthropicAdapter.complete()` BEFORE any API call.

### DB Schema (NEW — 12 tables)

Per §13-data-layer canonical:
- **Client-scoped** (RLS enforced via `app.client_id` session var): `clients`, `audit_runs`, `findings`, `screenshots`, `sessions`, `page_states`, `state_interactions`, `finding_rollups`, `reproducibility_snapshots`, `audit_requests`
- **Append-only** (UPDATE/DELETE blocked at DB level): `audit_log`, `rejected_findings`, `finding_edits`, `llm_call_log`, `audit_events`

Note: `finding_edits` + `llm_call_log` + `audit_events` are append-only too even though some may be considered observability rather than client-scoped. Append-only is enforced via Postgres trigger function:

```sql
CREATE OR REPLACE FUNCTION enforce_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only violation: % not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();
-- (and 4 more triggers for other append-only tables)
```

Drizzle schema also omits `update`/`delete` methods at the type level for these tables (TypeScript-level prevention complementing DB enforcement).

### `LLMCallRecord` (NEW shared row schema — R14.1)

```ts
export const LLMCallRecordSchema = z.object({
  id: z.string().uuid(),
  audit_run_id: z.string().uuid(),
  client_id: z.string().uuid(),
  operation: z.enum(['evaluate', 'self_critique', 'evaluate_interactive', 'classify', 'extract', 'other']),
  model: z.string(),
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  cost_usd: z.number().nonnegative(),
  duration_ms: z.number().int().nonnegative(),
  cache_hit: z.boolean(),
  outcome: z.enum(['ok', 'budget_blocked', 'temperature_blocked', 'unavailable', 'error']),
  error_class: z.string().nullable(),
  created_at: z.date(),
}).strict();
```

This is also the row shape for the `llm_call_log` Drizzle table.

## Breaking changes

None — all 18 contracts are additive.

## Migration plan

Drizzle migrations are NOT a "migration" in the v0.1 → v0.2 sense — they're the FIRST migrations from "no schema" to "12 tables". So `migration: none required at contract level`, and the `db:migrate` Phase 0 stub is replaced by real Drizzle migrations.

## Forward Contract — what later phases will import

### Phase 5 (Browse MVP)

```ts
import { SafetyCheck, AuditLogger, SessionRecorder } from '@neural/agent-core/safety';
import { ScreenshotStorage } from '@neural/agent-core/adapters';

await safety.assertAllowed(toolName, domain, audit_run);
await screenshotStorage.put(buf, { audit_run_id, page_url });
await auditLogger.log({ ... });
sessionRecorder.recordEvent({ kind: 'tool_invoked', tool_name, ... });
```

### Phase 7 (Analysis Pipeline)

```ts
import { LLMAdapter } from '@neural/agent-core/adapters';

const result = await llm.complete({
  operation: 'evaluate',
  audit_run_id,
  temperature: 0,        // anything else → TemperatureGuardError
  userPrompt: composedEvaluatePrompt,
  maxTokens: 4096,
});
// result.costUsd already debited; llm_call_log row already written
```

### Phase 8 (Orchestrator)

```ts
import { StorageAdapter } from '@neural/agent-core/adapters';
import { ReproducibilitySnapshot } from '@neural/agent-core/types';

await storage.writeReproducibilitySnapshot({ audit_run_id, model_versions, prompt_hashes, heuristic_versions });
await storage.finalizeAuditRun(audit_run_id, { completion_reason: 'success' });
```

**Forward stability promises:**
- LLMAdapter interface methods (`complete`, `estimateCost`) are LOCKED.
- `LLMOperation` enum values are LOCKED — Phase 7 hard-references these.
- `LLMCallRecord` shape is LOCKED — `outcome` enum may add values via additive migration but never remove.
- DB schema field types are LOCKED — Phase 4 amendments are additive (new columns nullable).
- `audit_events` 22-type enum is LOCKED — new types require Phase 4 amendment + impact.md.

## Risk level: HIGH — mitigations

**Mitigations (especially for the DB schema + LLM adapter):**
- T070 conformance suite (3 tests: schema, RLS, append-only) on a fresh DB.
- T070 kill criterion: any RLS test failure → STOP (cross-client leak risk).
- T073 conformance suite: TemperatureGuard, BudgetGate, atomic logging, failover protocol — each its own test.
- T073 kill criterion: any TemperatureGuard bypass → STOP (R10 violation cascades into Phase 7 reproducibility failures).
- ESLint `no-restricted-imports` rule lands in this phase per spec — enforces R9 boundaries automatically.
- 22-type AuditEvent enum sealed in this phase; new types require impact.md cycle.

## Verification

| Check | Test |
|---|---|
| 12 tables exist + RLS + append-only | `tests/conformance/db-{schema,rls,append-only}.test.ts` (AC-05) |
| TemperatureGuard rejects temp > 0 on 3 ops | `tests/conformance/temperature-guard.test.ts` (AC-09) |
| BudgetGate blocks pre-call when exhausted | `tests/conformance/budget-gate.test.ts` (AC-10) |
| Atomic LLM log written before return | `tests/conformance/llm-adapter.test.ts` (AC-08) |
| Failover protocol (3 retries → throw) | `tests/conformance/llm-failover.test.ts` (AC-11) |
| RLS prevents cross-client query | `tests/conformance/db-rls.test.ts` (AC-05 sub) |
| Append-only DB triggers fire on UPDATE/DELETE | `tests/conformance/db-append-only.test.ts` (AC-05 sub) |
| 22 audit_event types validated by Zod enum | `tests/conformance/session-recorder.test.ts` (AC-07) |
| No direct vendor imports outside adapters | grep + ESLint rule (lands in T073 PR) |

## Provenance (R22.2)

```yaml
why:
  source: >
    docs/specs/final-architecture/11-safety-cost.md (canonical safety + cost)
    docs/specs/final-architecture/13-data-layer.md (canonical schema)
    docs/specs/final-architecture/34-observability.md (22 audit_event types)
    docs/specs/mvp/constitution.md R7 + R8 + R9 + R10 + R14
  evidence: >
    R7.1 Drizzle-only retroactive audit (R22.5): "typed migrations prevent schema drift; enables R21 traceability."
    R7.4 append-only retroactive audit: "append-only is forensic evidence of what the system did during client audits."
    R10 temperature=0 retroactive audit (R22.6): "temperature > 0 on evaluate/self_critique/evaluate_interactive
    breaks reproducibility target (NF-006); TemperatureGuard at adapter boundary is the single chokepoint."
    R14.1 atomic LLM logging: "no silent calls" — observability principle that all cost/quality work depends on.
    R9 LLMAdapter retroactive audit: "the adapter boundary IS the Control Layer of Neural's five-layer harness."
  linked_failure: >
    Pilot-era console.log breaking audit_run_id correlation (drove R10.6); cross-client data exposure
    risk that drove R7.2 (RLS-first); unbounded cost during prompt iteration that drove R8.1 (hard cap).
```

## Approval

| Gate | Approver | Evidence |
|---|---|---|
| Impact analysis review | engineering lead | this `status: approved` |
| R20 compliance — HIGH risk | engineering lead | full review of 18 contracts |
| R7.1/R7.2/R7.4 enforcement | engineering lead | T070 conformance tests in place |
| R10 TemperatureGuard | engineering lead | T073 conformance + kill criterion |
| R14 cost accountability (atomic log + budget gate + failover) | engineering lead | T073 sub-tests |
| Phase 4 spec → plan transition | spec author + product owner | spec `approved` AND this `approved` |
