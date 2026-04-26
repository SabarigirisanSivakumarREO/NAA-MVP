---
title: 25-reproducibility
artifact_type: architecture-spec
status: approved
loadPolicy: on-demand-only
version: 2.3
updated: 2026-04-24
governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R22 (The Ratchet)
note: Reference material. Do NOT load by default (CLAUDE.md Tier 3). Load only the single REQ-ID section cited by the current task.
---

# Section 25 — Reproducibility & Audit Defensibility

**Status:** Master architecture extension. Required from Phase 6 onwards; foundational for every LLM-backed audit run.

**Cross-references:**
- §5.7 (Unified State Extensions) — `ReproducibilitySnapshot` type and invariants REQ-STATE-EXT-INV-010 / REQ-STATE-EXT-INV-011
- §13.6.7 (Data Layer Extensions) — `reproducibility_snapshots` table with immutability trigger
- §9.10 (Heuristic KB Extensions) — versioning fields that feed this section

---

## 25.1 Principle

> **The goal is not bit-reproducibility. It is audit defensibility: when two runs of the same site produce different findings, the difference must be explainable from versioned inputs, not hand-waved as "the LLM changed its mind."**

Q4-R ruling: we reject both strict bit-identity (impossible without heavy caching) and vague "95% overlap" (no failure semantics). We commit to **versioned defensibility with temperature-zero variance control**.

---

## 25.2 Requirements Summary

| # | Requirement |
|---|---|
| **REQ-REPRO-001** | Every LLM call in `evaluate`, `evaluate_interactive`, and `self_critique` nodes SHALL be invoked with `temperature: 0`. No exceptions. |
| **REQ-REPRO-002** | Every audit run SHALL produce exactly one `ReproducibilitySnapshot` before the first LLM call. |
| **REQ-REPRO-003** | The snapshot SHALL be IMMUTABLE after creation. Mutation is a runtime error. Database enforcement via trigger (§13.6.7). |
| **REQ-REPRO-004** | The snapshot SHALL pin: prompt template hashes, model names + versions, temperatures, heuristic base + overlay chain, normalizer version, grounding rule set version, discovery config version, state exploration policy version, deterministic scoring version. |
| **REQ-REPRO-005** | On repeat runs within 24 hours with identical pinned inputs against the same site, finding set overlap SHALL be ≥90%. |
| **REQ-REPRO-006** | Finding overlap below 90% SHALL trigger a diagnostic alert, NOT a failure. The system continues to operate; an engineer investigates. |
| **REQ-REPRO-007** | Every LLM call made during an audit SHALL be traced to LangSmith with the audit_run_id, the finding_id(s) it contributed to, and the reproducibility_snapshot id as tags. |
| **REQ-REPRO-008** | LangSmith traces SHALL be retained for a minimum of 365 days (configurable per client). Deletion before that term requires an explicit data-deletion request (GDPR pathway). |
| **REQ-REPRO-009** | The system SHALL provide a "re-run with pinned versions" capability: given an audit_run_id, produce a new audit run using the original snapshot's versions. |
| **REQ-REPRO-010** | Deprecated heuristics SHALL remain loadable by id+version for reproducibility of past runs, even after removal from the active catalog (REQ-HK-EXT-012). |

---

## 25.3 Temperature Policy

**REQ-REPRO-020:** The LLMAdapter interface (§6.14 of v3.1) SHALL enforce `temperature: 0` on calls made by `evaluate`, `evaluate_interactive`, and `self_critique` nodes. Other nodes (discovery classification, workflow analysis) MAY use non-zero temperature but SHALL record the temperature in the snapshot.

```typescript
// Enforced at the adapter boundary
interface AnalysisLLMCall {
  node: "evaluate" | "evaluate_interactive" | "self_critique" | "comparison" | "workflow_analysis" | "discovery_classify";
  messages: BaseMessage[];
  tools?: MCPToolDefinition[];
  temperature: number;   // MUST be 0 for evaluate + evaluate_interactive + self_critique
  max_tokens: number;
  // S10-FIX: seed removed. At temperature 0, seeding is redundant (provider-level
  // non-determinism is the only variance source, and seeding doesn't help with that).
  // For non-zero-temperature calls (discovery_classify, workflow_analysis), providers'
  // seed support is inconsistent — do not rely on it.
}

// Adapter-level guard (runtime)
if ((call.node === "evaluate" || call.node === "evaluate_interactive" || call.node === "self_critique") && call.temperature !== 0) {
  throw new Error(`REQ-REPRO-020 violated: ${call.node} temperature must be 0, got ${call.temperature}`);
}
```

**Rationale:** Temperature 0 reduces output variance by roughly 80% on structured-output tasks, with negligible impact on finding quality at Claude Sonnet 4 capability level. Validated during Phase 3 benchmark runs.

**What temperature 0 does NOT give us:** bit-identity. Providers may still introduce non-determinism via tokenizer changes, load balancing, or model version hot-swaps. That's why we pin model version + capture traces.

**§33 Integration Note:** REQ-REPRO-020 applies to ALL analysis evaluation nodes, including `evaluate_interactive` introduced by §33. The temperature=0 enforcement covers any node matching the analysis evaluation pipeline: `evaluate`, `evaluate_interactive`, `self_critique`. The LLM adapter SHALL enforce temperature=0 for any call originating from these nodes regardless of composition mode.

---

## 25.4 Snapshot Contents (Canonical Definition)

**REQ-REPRO-030:** The snapshot structure is defined in §5.7.1 as `ReproducibilitySnapshot`. This section is the canonical definition of each field's source and semantics.

| Field | Source | When captured | Example |
|---|---|---|---|
| `prompt_versions.evaluate` | SHA256 of the prompt template file | Audit setup | `"sha256:a1b2c3..."` |
| `prompt_versions.critique` | SHA256 of the critique template file | Audit setup | `"sha256:d4e5f6..."` |
| `prompt_versions.comparison` | SHA256 of the comparison template | Audit setup | `"sha256:..."` |
| `prompt_versions.workflow_analysis` | SHA256 of the workflow analysis template | Audit setup | `"sha256:..."` |
| `model_versions.evaluate_model` | Model identifier at call time | Audit setup | `"claude-sonnet-4-20260301"` |
| `model_versions.evaluate_temperature` | Locked at 0 (REQ-REPRO-001) | Audit setup | `0` |
| `model_versions.critique_model` | Model identifier at call time | Audit setup | `"claude-sonnet-4-20260301"` |
| `model_versions.critique_temperature` | Locked at 0 | Audit setup | `0` |
| `model_versions.vision_model` | Vision model if used (null if none) | Audit setup | `null` |
| `heuristic_set.base_version` | Top-level HeuristicKnowledgeBase version | Audit setup | `"2.1.0"` |
| `heuristic_set.overlay_chain_hash` | SHA256 of (brand + client + learned overlays applied) | Audit setup | `"sha256:..."` |
| `heuristic_set.heuristic_ids` | Full list of heuristic IDs used this run (post-filter + overlays + calibration) | Audit setup | `["BAY-CHK-001", ...]` |
| `normalizer_version` | Git tag or file hash of perception normalizer | Audit setup | `"v1.3.2"` |
| `grounding_rule_set_version` | Git tag or file hash of grounding rule set | Audit setup | `"v1.1.0"` |
| `discovery_config_version` | Hash of discovery config (exclusion rules, template clustering params) | Audit setup | `"sha256:..."` |
| `state_exploration_policy_version` | Hash of state exploration policy (caps, rule library, escalation triggers) | Audit setup | `"sha256:..."` |
| `deterministic_scoring_version` | Hash of impact matrix + effort map + priority formula | Audit setup | `"sha256:..."` |

**REQ-REPRO-031:** The snapshot is created by the **Trigger Gateway** (§18.8 REQ-TRIGGER-PERSIST-003) during audit request validation, BEFORE the Temporal workflow starts. The gateway resolves heuristic versions, prompt hashes, and model versions at request time, writes the immutable `reproducibility_snapshots` row to the database, and passes the `snapshot_id` to the Audit Orchestrator as part of the `AuditRequest`.

**REQ-REPRO-031a:** The `audit_setup` node (§4.2) reads the existing snapshot row from the database and loads it into AuditState as `reproducibility_snapshot`. It does NOT create the row — creation is exclusively the gateway's responsibility.

**REQ-REPRO-031b:** If the snapshot row does not exist when `audit_setup` reads it, the audit FAILS with `snapshot_missing` error. This can only happen if the gateway-to-orchestrator handoff was corrupted.

**REQ-REPRO-032:** Once written to the database (via the §13.6.7 trigger), the row is immutable. The trigger raises `EXCEPTION` on any UPDATE unless the executing role is `reo_snapshot_admin` (see C3 fix for escape hatch).

---

## 25.5 Overlap Measurement

**REQ-REPRO-040:** "Finding overlap" for the 90% target is computed as follows:

```typescript
interface OverlapResult {
  run_a_id: string;
  run_b_id: string;
  finding_overlap_pct: number;       // 0..100
  evidence_overlap_pct: number;      // 0..100
  scoring_stability: number;         // avg delta in priority across matched findings
  unmatched_in_a: Finding[];
  unmatched_in_b: Finding[];
  matched: Array<{
    run_a_finding: Finding;
    run_b_finding: Finding;
    match_score: number;             // 0..1
    match_reason: "exact" | "semantic" | "evidence_overlap";
  }>;
  passes_target: boolean;            // finding_overlap_pct >= 90
}

function computeOverlap(runA: AuditRun, runB: AuditRun): OverlapResult {
  // 1. Exact matches: same heuristic_id + same page_url + same element_ref
  // 2. Semantic matches: same heuristic_id + same page_url + embedding cosine > 0.85
  // 3. Evidence matches: same heuristic_id + ≥50% evidence_id overlap
  // 4. Overlap % = (2 * matched.length) / (runA.findings.length + runB.findings.length) * 100
}
```

**REQ-REPRO-041:** Overlap measurement SHALL be runnable on-demand by consultants via the consultant dashboard (§14.3 extended). Output includes matched, unmatched, and scoring_stability.

**REQ-REPRO-042:** The system SHALL run a scheduled overlap measurement on every audit that has a previous run within 24 hours with identical pinned inputs. Results logged to observability store.

---

## 25.6 Below-Target Handling

**REQ-REPRO-050:** When `finding_overlap_pct < 90`:

1. **Do NOT fail the audit.** Reproducibility below target is a diagnostic signal, not a contract violation.
2. **Emit `reproducibility_below_target` alert** to the observability layer with run IDs, overlap %, and top 5 mismatched findings.
3. **Tag the newer audit run** with `reproducibility_warning` in `audit_runs.status` metadata.
4. **Consultant dashboard** surfaces the warning as an **informational badge** (not an error state) with a link to the overlap report. (M10-FIX) The badge text SHALL be "Overlap: X% — review diff" not "Warning: reproducibility failure." This is a diagnostic signal, not a defect indicator. The consultant can choose to investigate or accept the variance.
5. **Engineering investigates.** Common causes: (a) prompt template edited mid-cycle without version bump, (b) provider-side model drift, (c) page content genuinely changed between runs, (d) LLM sampling tail event.

**REQ-REPRO-051:** If the same pair of runs is below target **after** controlling for page content drift (e.g., both runs fetched the same cached snapshot), the snapshot diff report SHALL be used to identify which versioned input caused the change. If no version changed, it is a provider-side variance event — escalate to the model vendor.

---

## 25.7 Diff Explainer

**REQ-REPRO-060:** The system SHALL provide a finding diff explainer that, given two audit runs, explains every difference in terms of versioned inputs:

```typescript
interface FindingDiffExplainer {
  explainDifference(
    previousRun: AuditRun,
    currentRun: AuditRun,
    findingId: string
  ): Promise<DiffExplanation>;
}

interface DiffExplanation {
  finding_id: string;
  previous_state: Finding | null;
  current_state: Finding | null;
  change_type: "new" | "resolved" | "severity_changed" | "evidence_changed" | "recommendation_changed" | "unchanged";

  explained_by: Array<{
    factor: "heuristic_version" | "heuristic_overlay" | "learned_calibration" | "normalizer_version" | "grounding_rules" | "scoring_version" | "page_content" | "llm_variance";
    previous_value: string;
    current_value: string;
    confidence: "high" | "medium" | "low";
  }>;

  unexplained_residual: boolean;   // true = no versioned input explains the change; likely LLM variance
}
```

**REQ-REPRO-061:** The consultant dashboard SHALL surface the diff explainer in the version comparison view (§14.2 extended). Consultants preparing client reports SHALL be able to cite exact reasons for finding changes between audit versions.

**REQ-REPRO-062:** `unexplained_residual = true` SHALL be highlighted in the consultant UI as "variance — requires human judgment." It is NOT a bug; it is a known property of LLM-backed analysis below the 100% reproducibility ceiling.

**REQ-REPRO-063:** (S7-FIX) The diff explainer is a **best-effort heuristic**, not a proof system. When multiple versioned inputs changed simultaneously (e.g., heuristic version + model version + page content all changed between runs), attributing a finding change to a single factor is imprecise. The explainer uses a change-impact ordering heuristic: attribute to the factor with the largest known effect (page content > model version > heuristic version > scoring version > learned calibration > LLM variance). When the true cause is ambiguous, the explainer SHALL set `confidence: "low"` on the attribution AND set `unexplained_residual = true` if no factor alone explains the magnitude of the change.

---

## 25.8 Re-Run with Pinned Versions

**REQ-REPRO-070:** The system SHALL support re-running an audit with the original versions of all pinned inputs. Use cases:
- Consultant wants to reproduce last month's findings on the current site content
- Engineer wants to isolate "was this caused by a heuristic change or a content change?"
- Client wants to verify a specific finding from an archived audit

```typescript
interface RerunRequest {
  source_audit_run_id: string;
  override: {
    heuristic_set?: "latest" | "source_pinned";        // default: source_pinned
    models?: "latest" | "source_pinned";                // default: source_pinned
    prompts?: "latest" | "source_pinned";               // default: source_pinned
    target_urls?: string[];                             // default: same URLs
  };
  consultant_user_id: string;                           // audit trail
}
```

**REQ-REPRO-071:** Re-running with `source_pinned` requires that the deprecated heuristic versions remain loadable. The Heuristic KB service SHALL retain all previously-published versions of every heuristic indefinitely, archived but accessible by (id, version).

**REQ-REPRO-072:** Model version availability is a hard constraint: if the original model is no longer served by the provider, the re-run SHALL fail with an explicit error citing the unavailable model. Do NOT silently substitute a newer model.

---

## 25.9 Trace Retention

**REQ-REPRO-080:** LangSmith (or equivalent) traces for every LLM call SHALL be retained for ≥365 days. Retention is configurable per client but MUST NOT fall below 90 days.

**REQ-REPRO-081:** Each trace SHALL carry these tags:
- `audit_run_id`
- `reproducibility_snapshot_id`
- `client_id`
- `page_url`
- `state_id` (if state exploration applicable)
- `heuristic_ids` (for evaluate/critique calls)
- `node` (evaluate | critique | comparison | workflow_analysis | discovery_classify)

**REQ-REPRO-082:** Traces involving heuristic content SHALL be redacted in LangSmith — heuristic fields are replaced with `{heuristic_id}@{version}` references. Raw heuristic JSON is NEVER stored in traces (IP protection, REQ-HK-051).

**REQ-REPRO-083:** Client-facing interfaces SHALL NEVER expose raw LangSmith traces. Consultant dashboard MAY expose them behind an admin toggle.

**REQ-REPRO-084:** GDPR/CCPA data deletion requests SHALL include LangSmith trace deletion for the affected client, even if within the 90-day minimum. Legal deletion overrides retention policy.

---

## 25.10 Failure Modes Specific to Reproducibility

Add to §15 (Failure Modes):

| # | Failure | Detection | Response |
|---|---|---|---|
| **RF-01** | Snapshot creation fails during audit setup | Missing file, hash computation error, DB write fails | Fail audit immediately with clear error. Do NOT proceed without a snapshot. |
| **RF-02** | Attempt to mutate an existing snapshot | DB trigger raises EXCEPTION | Operation fails. Alert engineering. Investigate why something tried to mutate. |
| **RF-03** | Temperature non-zero on evaluate or critique call | Adapter guard throws | Fail the audit call. Alert immediately. Indicates adapter bypass. |
| **RF-04** | Reproducibility overlap < 90% on repeat run | Scheduled overlap measurement | Warn, don't fail. Surface to consultant dashboard + observability. |
| **RF-05** | Model version no longer served by provider on rerun | Provider API returns model_not_found | Fail the rerun with explicit error. Do NOT auto-substitute a newer model. |
| **RF-06** | Heuristic version not loadable on rerun | KB service can't find (id, version) | Fail the rerun. Indicates archive retention policy was violated. |
| **RF-07** | LangSmith trace write fails | Tracing API error | Audit continues; trace failure is non-blocking. Log to Sentry. |
| **RF-08** | Prompt template file hash mismatch with committed version | CI check detects untracked edit | Deployment blocks. Prompts are source-controlled and versioned. |

---

## 25.11 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **6** | Snapshot creation in `audit_setup`, immutability trigger, temperature 0 enforcement, snapshot table populated per run |
| **6** | LangSmith tagging with snapshot id, basic trace retention |
| **8** | Overlap measurement job (scheduled), diff explainer v1 |
| **9** | Consultant dashboard diff explainer UI, version comparison view extended |
| **11** | Re-run with pinned versions capability |
| **12** | 90% overlap alerting in production observability |
| **13** | GDPR deletion workflow including trace deletion |

---

## 25.12 What This Section Does NOT Promise

To set expectations honestly:

- **No bit-reproducibility.** Temperature 0 reduces variance but does not eliminate it. Providers make no API-level guarantee.
- **No reproducibility across model versions.** Switching from Claude Sonnet 4 to Claude Sonnet 5 breaks overlap regardless of other controls. That's why the snapshot pins model version.
- **No reproducibility across page content changes.** If the client edits their homepage, next audit will differ. The diff explainer will attribute it to `page_content`, which is a legitimate cause.
- **No hard guarantee of 90% overlap.** It is a target. Below-target is a diagnostic signal, handled per REQ-REPRO-050.
- **No reproducibility for non-deterministic browser behavior.** SPAs with randomized content (product recommendations, A/B splits) will produce drift. Clients running their own experiments on audited pages will see this.

---

## 25.13 Engineering Constitution Addition

Add to the 10-rule constitution in §17:

> **R11: Reproducibility is defensibility.** Every LLM-backed finding must be traceable to pinned versions. A finding that cannot be defended to a client by pointing at its versioned inputs is a finding that should not have been published.

---

**End of §25 — Reproducibility & Audit Defensibility**
