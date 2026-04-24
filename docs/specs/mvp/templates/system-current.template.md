---
title: Neural System — Current State
artifact_type: system-snapshot
status: approved        # rolls to verified after next sync; superseded when rewritten
version: <MAJOR.MINOR>
last_phase_rollup: phase-<N>-current.md
created: 2026-MM-DD
updated: 2026-MM-DD
owner: <engineering lead>
supersedes: <prior version>
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-<N>-<name>/phase-<N>-current.md
  - docs/specs/final-architecture/diagrams/master-architecture.html
delta:
  new: []
  changed: []
  impacted: []
  unchanged: []
governing_rules:
  - Constitution R17 (Lifecycle)
  - Constitution R19 (Rollup per Phase; this file aggregates rollups)
---

# Neural System — Current State

> **Summary (~200 tokens):** Live compressed view of the whole system as it stands today. One file that a new engineer or Claude Code session can read in 5 minutes to understand what exists, what works, what's partial, what's planned. Regenerated at each phase exit by concatenating `phase-N-current.md` rollups + distilling.

> **Intended audience:** Engineers joining mid-project, product owner syncing with team, Claude Code starting a new phase, stakeholders reviewing progress.

> **NOT authoritative for implementation details.** Use this for orientation. Implementation details live in per-phase artifacts + architecture specs.

---

## 1. What Neural is (30 seconds)

Neural is an AI-powered CRO audit platform. A consultant provides a URL; the agent browses, analyzes, and produces annotated findings + a branded PDF report. Built on Claude Sonnet 4 + Playwright + a custom hallucination-filter pipeline. Currently in MVP v1.0 development targeting consultant pilot at REO Digital.

## 2. Phase status

| Phase | Name | Status | Rollup |
|---|---|---|---|
| 0 | Setup | <not started / in progress / complete> | <link> |
| 0b | Heuristic Authoring | <status> | <link> |
| 1 | Browser Perception | <status> | <link> |
| 2 | MCP Tools (subset) | <status> | <link> |
| 3 | Verification (thin) | <status> | <link> |
| 4 | Safety + Infra + Cost | <status> | <link> |
| 5 | Browse MVP | <status> | <link> |
| 6 | Heuristic KB Engine | <status> | <link> |
| 7 | Analysis Pipeline | <status> | <link> |
| 8 | Orchestrator + Cross-Page | <status> | <link> |
| 9 | Foundations + Delivery | <status> | <link> |

## 3. What works end-to-end today

Capabilities validated by passing conformance + acceptance tests:

- <capability 1>
- <capability 2>

## 4. What's partial

Built but not fully verified:

- <capability 1> — blocked by <reason>
- <capability 2> — awaiting <next phase>

## 5. What's planned (not yet started)

- <capability 1> — Phase <N>
- <capability 2> — Phase <N>

## 6. Active contracts

Shared data contracts currently in effect. Specs cited.

| Contract | Spec | Status | Version |
|---|---|---|---|
| `AnalyzePerception` (v2.3) | §07.9 | verified | 2.3 |
| `PageStateModel` | §06 | verified | 1.0 |
| `AuditState` | §05 | ... | ... |
| `Finding` lifecycle | §07 + §23 | ... | ... |
| ... | ... | ... | ... |

## 7. Active adapters

External-dependency interfaces in use:

| Adapter | Implementation | Status |
|---|---|---|
| `LLMAdapter` | `AnthropicAdapter` (Claude Sonnet 4) | active |
| `StorageAdapter` | `PostgresStorage` (Drizzle) | active |
| `ScreenshotStorage` | `R2Storage` (prod) / `LocalDiskStorage` (dev) | active |
| ... | ... | ... |

## 8. Known limitations (system-wide)

- Desktop only — mobile viewport deferred to Phase 12
- Claude-only LLM — failover to GPT-4o deferred to v1.2
- No state exploration — PDP hidden content (~30%) not captured; Phase 10
- No interactive composition — §33 deferred to Phase 11

## 9. Open issues

Tracked in GitHub issues; high-level summary:

- <issue 1>
- <issue 2>

## 10. Resource status

| Resource | State |
|---|---|
| Engineering lead | <name>, full-time, 12 weeks |
| Frontend engineer | <name>, full-time Weeks 9-12 |
| CRO specialist | <name>, Phase 0b through Week 4 |
| Postgres | local Docker dev; Fly.io prod deferred |
| R2 bucket | dev + prod buckets provisioned |
| Clerk | dev org set up |
| Anthropic API | active key; daily budget alert set to $200 |
