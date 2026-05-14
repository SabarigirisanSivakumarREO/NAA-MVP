# R20 invalidation — Phase 4 landed 2026-05-14

Phase 4 (Safety + Infrastructure + Cost) shipped 19 NEW shared contracts and is now `status: verified` per `.phase-state/4/verify-verdict.yaml` Gate 2 APPROVE. Any pre-flight `/speckit.analyze` + `pnpm spec:matrix` output produced for Phase 8 against the old Phase 4 surface is invalidated.

**Required before Phase 8 Gate 1 (Stage 1 pre-flight):**

1. Re-run `/speckit.analyze` on `phase-8-orchestrator/` against the new Phase 4 contract surface.
2. Re-run `pnpm spec:matrix --phase 8` to refresh coverage trace.
3. Read `phase-4-safety-infra-cost/phase-4-current.md` rollup §1 + §2 FIRST per CLAUDE.md §1b.
4. Read `phase-4-safety-infra-cost/phase-4-validation.md` §1 (module dep graph — downstream consumer mapping) + §2 (LLMAdapter pipeline).

**Phase 8 consumes Phase 4 for:**

- **`audit_runs` lifecycle table** — Phase 8 orchestrator owns full lifecycle: INSERT on audit start, UPDATE for budget decrement (`budget_remaining_usd` with `SELECT ... FOR UPDATE` row-level lock per Phase 4 v0.4 F-09 closure), emit `audit_started` → `audit_completed` | `audit_failed` AuditEvents.
- **`reproducibility_snapshots` table** — Phase 8 writes the snapshot row at audit start (immutable: model + prompt hashes + heuristic versions + config). Phase 4 ships the table; Phase 9 T160 SnapshotBuilder REPLACES the Phase 8 scaffold for v1.0 but the schema is Phase 4 owned.
- **`finding_rollups` table** — Phase 8 cross-page PatternDetector writes PatternFinding rows aggregating findings across multiple pages of a single audit. RLS-scoped.
- **`audit_events` 22-type enum** — Phase 8 orchestrator coordinates emission across all 22 types from the firehose. New event types require fresh Phase 4 impact.md cycle.
- **`observability/AuditLogger`** — Phase 8 emits orchestration-level structured logs (`audit_started`, `pipeline_stage_transition`, `state_checkpoint_written`, `audit_completed`). Append-only via PostgresStorage.
- **`observability/StreamEmitter`** — Phase 8 publishes pipeline-stage SSE events to dashboard consumers (Phase 9 Hono SSE endpoint wraps).
- **`adapters/PostgresStorage.withClient`** — Phase 8 LangGraph state checkpointing uses this transaction boundary (PostgresCheckpointer per spec corpus).
- **`safety/SafetyCheck`** — Phase 8 orchestrator routes SafetyBlockedError → orchestration decision (HITL pause vs hard-fail).

**Phase 4 contract behaviors Phase 8 MUST honor:**

- Audit budget decrement is the **only** path that writes a non-zero `cost_usd` to `audit_runs.budget_remaining_usd` — Phase 4's AnthropicAdapter writes to llm_call_log but DOES NOT decrement audit_runs.budget_remaining_usd directly. Phase 8 orchestrator owns the decrement via a transactional update (`SELECT ... FOR UPDATE` + `UPDATE audit_runs SET budget_remaining_usd = budget_remaining_usd - $1 WHERE id = $2`).
- AuditState 3-phase coordination (Phase 4b T4B-011 + Phase 7 T113 + Phase 8 T135 per INDEX.md row 8 description) MUST consume Phase 4's `audit_events` firehose as the cross-phase coordination signal.
