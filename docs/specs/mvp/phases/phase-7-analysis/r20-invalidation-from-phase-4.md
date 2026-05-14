# R20 invalidation — Phase 4 landed 2026-05-14

Phase 4 (Safety + Infrastructure + Cost) shipped 19 NEW shared contracts and is now `status: verified` per `.phase-state/4/verify-verdict.yaml` Gate 2 APPROVE. Any pre-flight `/speckit.analyze` + `pnpm spec:matrix` output produced for Phase 7 against the old Phase 4 surface is invalidated.

**Required before Phase 7 Gate 1 (Stage 1 pre-flight):**

1. Re-run `/speckit.analyze` on `phase-7-analysis/` against the new Phase 4 contract surface.
2. Re-run `pnpm spec:matrix --phase 7` to refresh coverage trace.
3. Read `phase-4-safety-infra-cost/phase-4-current.md` rollup §1 + §2 FIRST per CLAUDE.md §1b.
4. Read `phase-4-safety-infra-cost/phase-4-validation.md` §2 (LLMAdapter pipeline data flow) — Phase 7 EvaluateNode + SelfCritiqueNode are the primary consumers of this surface.

**Phase 7 consumes Phase 4 for:**

- **`adapters/LLMAdapter` + `AnthropicAdapter`** — every Phase 7 EvaluateNode and SelfCritiqueNode call goes through `LLMAdapter.complete({ operation: 'evaluate' | 'self_critique', ... })`. R10 (temperature=0) enforced via TemperatureGuard at adapter boundary; R14.1 atomic llm_call_log written before return; R14.5 3-retry failover protocol throws LLMUnavailableError on exhaustion (v1.2 plugs fallback adapter).
- **`adapters/TemperatureGuard`** — LOCKED set `{'evaluate','self_critique','evaluate_interactive'}` rejects temp > 0. Phase 7 prompts MUST send `temperature: 0` on the 3 reproducibility-bound operations.
- **`adapters/BudgetGate`** — pre-call cost estimate via `getTokenCount`; ceils to nearest $0.01. Phase 7 must pass `audit_run_id` for budget lookup + `client_id` for RLS scope.
- **`adapters/PostgresStorage`** — Phase 7 writes `findings` (RLS-scoped) + `rejected_findings` (append-only, Two-Store rejected-projection from grounding rules) + `finding_edits` (append-only consultant audit trail). All writes go through `withClient(client_id, fn)` transaction boundary.
- **`types/llm.ts` LLMOperation 6-value enum** — LOCKED: `{'evaluate', 'self_critique', 'evaluate_interactive', 'classify', 'extract', 'other'}`. Phase 7 may use `'classify'` or `'extract'` for non-R10-bound LLM calls; new operations require fresh impact.md cycle.
- **`types/audit-events.ts` 22-type AuditEvent enum** — Phase 7 emits `page_analyze_started`, `page_analyze_completed`, `page_analyze_skipped`, `finding_produced`, `finding_grounding_rejected`, `finding_critique_rejected`, `finding_published`, `perception_quality_low`, `llm_call_completed`, `llm_call_failed`, `llm_provider_fallback` (the last is v1.2 only).

**R14.6 model_mismatch flag:** Phase 4 added the `findings.model_mismatch` column. Phase 7 MUST populate `model_mismatch=true` when the v1.2 fallback adapter generates a finding (Phase 4 wired the column; Phase 7 owns the populating).
