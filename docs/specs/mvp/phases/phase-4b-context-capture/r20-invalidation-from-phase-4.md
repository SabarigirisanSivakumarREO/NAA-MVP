# R20 invalidation — Phase 4 landed 2026-05-15

Phase 4 (Safety + Infrastructure + Cost) merged to master at commit `3312eda` on 2026-05-15 with **19 NEW shared contracts**. Pre-flight analyze + matrix outputs for THIS phase (Phase 4b — Context Capture Layer) generated prior to Phase 4 merge are invalidated. Before Phase 4b's Gate 1, master MUST re-run `/speckit.analyze` and `pnpm spec:matrix --phase 4b` against the new Phase 4 surface.

## Phase 4 contracts directly consumed by Phase 4b

| Phase 4 contract | Phase 4b consumer | Reason |
|---|---|---|
| `context_profiles` DB table slot (T070 AC-17) | T4B-012 migration | Phase 4 reserved the slot via absence-assertion; T4B-012 lands the actual migration |
| `PostgresStorage` + `StorageAdapter` interface (T074) | T4B-008 ContextStore | Phase 4b consumes the standard adapter pattern; appends context_profile rows via `appendContextProfile()` (Phase 4 interface must allow extension) |
| `LLMAdapter` + `AnthropicAdapter` (T073) + `LLMCallRecord` | T4B-005 BusinessClassifier / T4B-006 PageClassifier (LLM-judge inferences if used) | Context capture LLM calls (e.g., `extract` or `classify` operation) MUST go through LLMAdapter for cost attribution + TemperatureGuard |
| `audit_log` table + `AuditLogger` (T071) | T4B-014 telemetry | Context-capture failure events emit via AuditLogger |
| `audit_events` + `SessionRecorder` (T072) | T4B-014 telemetry | `audit_started` event carries context_profile_id |
| `AuditEvent` 22-type LOCKED enum | T4B-014 emit sites | Context-capture lifecycle events must reuse LOCKED types; no enum extension at Phase 4b |
| `RobotsChecker` (T080a) | T4B-003 HtmlFetcher | HtmlFetcher must call `RobotsChecker.isAllowed()` before fetching `<root>/robots.txt`-restricted paths |
| Append-only `llm_call_log` (R14.1) | Phase 4b LLM call sites | Any classifier LLM call must produce a log row |
| RLS on `clients` + `audit_runs` (R7.2) | All Phase 4b DB writes | ContextStore + telemetry writes MUST go through `withClient(client_id, fn)` |

## Required actions before Gate 1

1. **Master re-runs `/speckit.analyze` on `docs/specs/mvp/phases/phase-4b-context-capture/`** — generates a fresh `.phase-state/4b/preflight-correctness.json`
2. **Master re-runs `pnpm spec:matrix --phase 4b`** — generates a fresh `.phase-state/4b/preflight-coverage.json`
3. **Master dispatches `neural-ai-reviewer --gate pre-flight --phase 4b`** — 3 sub-audits (correctness + coverage + completeness with adversarial critic) against the new Phase 4 surface
4. **Verify Phase 4b artifacts cite Phase 4 contracts correctly** — `spec.md` + `tasks.md` + `impact.md` should reference REQ-IDs from Phase 4 (e.g., REQ-STORAGE-ADAPTER-001 for ContextStore; REQ-LLM-ADAPTER-001 for classifier calls). If not, fix at Gate 1 patch wave per R11.4.
5. **`impact.md` MUST explicitly list Phase 4 as a consumed dependency** in the `consumes_from:` section. If absent → R11.4 spec patch required before implementation.

## Pre-existing `.phase-state/4b/preflight-correctness.json` is STALE

The file exists from a pre-Phase-4-merge run. It does NOT reflect the Phase 4 contracts now in master. Master MUST overwrite with a fresh run; do NOT trust the existing file.

## R20 propagation chain

This note is part of the R20 propagation set authored at Phase 4 Stage 4 EXIT:
- `phase-5-browse-mvp/r20-invalidation-from-phase-4.md` ✓ (Phase 4 Stage 4 exit)
- `phase-7-analysis/r20-invalidation-from-phase-4.md` ✓ (Phase 4 Stage 4 exit)
- `phase-8-orchestrator/r20-invalidation-from-phase-4.md` ✓ (Phase 4 Stage 4 exit)
- `phase-9-delivery/r20-invalidation-from-phase-4.md` ✓ (Phase 4 Stage 4 exit)
- **`phase-4b-context-capture/r20-invalidation-from-phase-4.md` ← THIS FILE** (back-fill 2026-05-15 — Phase 4 Stage 4 exit missed Phase 4b because the original brief only listed downstream phases; Phase 4b is the IMMEDIATE next phase and ALSO consumes Phase 4 contracts)

## Next action

Master orchestrator picks up Phase 4b at `/master 4b --start` (or `--resume` if state file already initialized). Stage 1 pre-flight re-run is the first thing that fires.
