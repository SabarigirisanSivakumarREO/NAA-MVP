# R20 invalidation — Phase 4 landed 2026-05-14

Phase 4 (Safety + Infrastructure + Cost) shipped 19 NEW shared contracts and is now `status: verified` per `.phase-state/4/verify-verdict.yaml` Gate 2 APPROVE. Any pre-flight `/speckit.analyze` + `pnpm spec:matrix` output produced for Phase 9 against the old Phase 4 surface is invalidated.

**Required before Phase 9 Gate 1 (Stage 1 pre-flight):**

1. Re-run `/speckit.analyze` on `phase-9-delivery/` against the new Phase 4 contract surface.
2. Re-run `pnpm spec:matrix --phase 9` to refresh coverage trace.
3. Read `phase-4-safety-infra-cost/phase-4-current.md` rollup §1 + §2 FIRST per CLAUDE.md §1b.
4. Read `phase-4-safety-infra-cost/phase-4-validation.md` §1 (module dep graph) + §4 (AC→impl→test matrix).

**Phase 9 consumes Phase 4 for:**

- **All 15 DB tables via `adapters/PostgresStorage`** — Phase 9 reads `audit_runs` + `findings` + `screenshots` + `sessions` + `page_states` + `state_interactions` + `finding_rollups` + `reproducibility_snapshots` + `audit_requests` + `audit_log` + `audit_events` + `llm_call_log` + `finding_edits` + `rejected_findings` for PDF generation + dashboard rendering. All reads via `withClient(client_id, fn)` RLS-aware transaction.
- **R6 channels 3 + 4 first runtime activation** — Hono API + Next.js render MUST honor R6 (heuristic body NEVER serialized). Phase 4 ships the persistence layer; Phase 9 ships the read path. The `findings.heuristic_id` FK is the only heuristic identifier that crosses the API boundary — body content lives in `heuristics-repo/` and is loaded server-side via the AccessModeMiddleware (Phase 9 T169).
- **`observability/StreamEmitter` → Hono SSE endpoint** — Phase 9 dashboard live SSE consumes Phase 4's in-memory pub/sub via a Hono streaming endpoint. AccessModeMiddleware fails secure by default (no SSE leak under unauthorized mode).
- **`adapters/LLMAdapter` for ExecutiveSummary 1-call generation** — Phase 9 T245 ExecutiveSummaryGenerator calls `LLMAdapter.complete({ operation: 'other', model: 'claude-sonnet-4-*', ... })` with a $0.10 cap; GR-007 retry-then-fallback enforced. Uses Phase 4's R14.1 atomic logging + R14.2 budget gate + R14.5 failover protocol — same surface as Phase 7.
- **`adapters/ScreenshotStorage` + `LocalDiskStorage`** — Phase 9 PDF render embeds screenshots via the same interface (LocalDisk in dev; R2 deferred to post-MVP-pilot).
- **`audit_events` 22-type AuditEvent enum** — Phase 9 dashboard live feed consumes the firehose via Hono SSE; Phase 9 admin ops dashboard (T244, ★ LAST task in MVP ★) reads heuristic_health_metrics view derived from llm_call_log + findings + audit_events aggregations.

**Phase 4 contract behaviors Phase 9 MUST honor:**

- Phase 9 T160 SnapshotBuilder REPLACES the Phase 8 reproducibility_snapshots scaffold for v1.0 — but the underlying table shape is Phase 4 owned (R7.2 RLS + R7.4 append-only — reproducibility_snapshots is RLS-scoped, NOT append-only per spec.md §13).
- Phase 9 read-only access to `llm_call_log` is the basis for per-client cost attribution (R14.4) — the `audit_run_id → audit_runs.client_id` chain is queryable via SQL once H1 (PLACEHOLDER_UUID → real client_id) closes in Phase 5.
- The `audit_events` 22-type enum LOCK means Phase 9 cannot emit any NEW event types — only consume + display. If a new type is needed (e.g., `report_pdf_generated`, `dashboard_view`), it must go through a fresh Phase 4 impact.md amendment cycle.
- AccessModeMiddleware (Phase 9 T172) is fail-secure by default — no Phase 4 contract surface leaks under unauthorized requests.
