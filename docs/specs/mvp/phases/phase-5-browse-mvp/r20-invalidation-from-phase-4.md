# R20 invalidation — Phase 4 landed 2026-05-14

Phase 4 (Safety + Infrastructure + Cost) shipped 19 NEW shared contracts and is now `status: verified` per `.phase-state/4/verify-verdict.yaml` Gate 2 APPROVE. Any pre-flight `/speckit.analyze` + `pnpm spec:matrix` output produced for Phase 5 against the old Phase 4 surface is invalidated.

**Required before Phase 5 Gate 1 (Stage 1 pre-flight):**

1. Re-run `/speckit.analyze` on `phase-5-browse-mvp/` against the new Phase 4 contract surface.
2. Re-run `pnpm spec:matrix --phase 5` to refresh coverage trace.
3. Read `phase-4-safety-infra-cost/phase-4-current.md` rollup §1 (19 active modules) + §2 (data contracts now in effect) FIRST per CLAUDE.md §1b rollup-first rule.
4. Read `phase-4-safety-infra-cost/phase-4-validation.md` §4 AC→impl→test matrix for the contract surface Phase 5 BrowseNode imports.

**Phase 5 is the highest-fan-out downstream consumer in MVP.** Phase 5 BrowseNode imports the following Phase 4 contracts simultaneously:

- `safety/SafetyCheck` — wraps every browse action (29 MCP tools × 4-path dispatch)
- `safety/RobotsChecker` — gates browse-mode navigation per REQ-SAFETY-005
- `adapters/ScreenshotStorage` + `LocalDiskStorage` — page screenshots
- `adapters/PostgresStorage.withClient(client_id, fn)` — RLS-aware transaction boundary for all DB writes
- `observability/AuditLogger.log()` — append-only audit_log writes
- `observability/SessionRecorder.recordEvent()` — 22-type AuditEvent emission (all 22 types LOCKED — new types require fresh impact.md cycle)
- `observability/StreamEmitter.publish()` — SSE event broadcast

**Two HIGH Phase 5 acceptance items carried forward from Phase 4 Stage 2.5:**

- **H1:** AnthropicAdapter currently uses `PLACEHOLDER_UUID` for the RLS scope on its llm_call_log writes. Phase 5 orchestrator MUST thread `req.client_id` through `LLMCompleteRequest.client_id` (the field is already in the schema). Phase 5 Gate 1 should explicitly enumerate this as an acceptance criterion (act-004 in `.phase-state/4/verify-verdict.yaml`).
- **H2:** `#tryWriteRow` in AnthropicAdapter currently swallows write failures on `outcome='ok'` best-effort paths. Phase 5 closes the FK gap once H1 lands (FK rejection that drives best-effort goes away once real client_id flows).

**One MED Phase 5 polish item from Phase 4 Stage 2.5:**

- **M3:** Budget concurrency serialization inside `withClient` transaction. Current impl uses row-level lock on `audit_runs.budget_remaining_usd` via `SELECT ... FOR UPDATE`; cross-transaction race may need hardening once parallel LLM calls land in Phase 5.

**One MED test-infra item (act-005):**

- W1A parallel-migration deadlock — current workaround `--no-file-parallelism` costs ~30s per test run. Options: (a) Postgres advisory lock around migration application; (b) vitest globalSetup centralization; (c) `__migrations__` table for idempotency detection.
