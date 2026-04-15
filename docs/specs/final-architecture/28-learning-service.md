# Section 28 — Learning Service (Deferred Contract)

**Status:** Contract reserved. Implementation Phase 12. Data collection starts Phase 6 (consultant decisions are stored from day 1).

**Cross-references:**
- §9.10.2 (`learned_adjustments` on HeuristicExtended) — the field this service populates
- §13.6.6 (`heuristic_calibration` table) — storage
- §22.6 (Phase 4 retrieval) — consumer of calibration data
- §23.4 (`computeConfidence` — calibration delta) — consumer of reliability_delta
- §24.4 (Warm-up mode) — graduation criteria use rejection rate computed here

---

## 28.1 Principle

> **The system gets smarter per client over time. Every consultant approve/reject/edit decision is a training signal. The Learning Service transforms these signals into per-client heuristic calibrations — adjusting reliability, suppressing noise, and boosting what works. It does NOT retrain the LLM. It tunes the deterministic scoring layer.**

---

## 28.2 What It Learns From

| Signal | Source | Available from |
|---|---|---|
| Consultant approves a finding | `findings.publish_status = 'approved'` | Phase 6 (day 1) |
| Consultant rejects a finding | `findings.publish_status = 'rejected_consultant'` | Phase 6 |
| Consultant edits a finding (severity change) | `finding_edits.changes.severity` | Phase 6 |
| Consultant edits a finding (recommendation change) | `finding_edits.changes.recommendation` | Phase 6 |
| Warm-up graduation event | Client exits warm-up → system is "calibrated" for this client | Phase 6 |
| Analytics signal: page with finding has high bounce rate | `analytics_signals.signal_type = 'bounce'` | Phase 16 (DX bindings, aligned with §30.9) |
| Analytics signal: page with finding has rage clicks | `analytics_signals.signal_type = 'rage_click'` | Phase 16 (aligned with §30.9) |

---

## 28.3 What It Produces

| Output | Target | Effect |
|---|---|---|
| `reliability_delta` per (client, heuristic) | `heuristic_calibration` table | Adjusts confidence scoring in §23.4 |
| `severity_override` per (client, heuristic) | `heuristic_calibration` table | Overrides base severity if consultant consistently corrects it |
| `suppress_below_confidence` per (client, heuristic) | `heuristic_calibration` table | Suppresses low-value heuristics for specific clients |
| `approval_rate` per (client, heuristic) | `heuristic_calibration` table | Transparency metric for consultant dashboard |
| Warm-up graduation signal | Client profile | Auto-enables Tier 1 auto-publish (§24.4) |
| Learned heuristic crystallisation (Phase 4+) | New heuristic entry | Consultant-approved patterns become new heuristics |

---

## 28.4 Calibration Algorithm

**REQ-LEARN-001:** Calibration runs as a batch job after each completed audit for a client (NOT real-time — batched for stability):

```typescript
interface CalibrationJob {
  clientId: string;
  auditRunId: string;   // the audit that just completed
}

async function runCalibration(job: CalibrationJob): Promise<void> {
  const findings = await storage.getAllReviewedFindings(job.clientId);
  // Group by heuristic_id
  const byHeuristic = groupBy(findings, f => f.heuristic_id);

  for (const [heuristicId, hFindings] of Object.entries(byHeuristic)) {
    const approved = hFindings.filter(f => ["published", "approved", "edited"].includes(f.publish_status));
    const rejected = hFindings.filter(f => f.publish_status === "rejected_consultant");
    const sampleSize = approved.length + rejected.length;

    if (sampleSize < 30) continue;  // REQ-HK-EXT-018: min sample size

    const approvalRate = approved.length / sampleSize;

    // Reliability delta: +0.1 if approval > 80%, -0.1 if approval < 40%
    let reliabilityDelta = 0;
    if (approvalRate > 0.8) reliabilityDelta = Math.min(0.2, (approvalRate - 0.8) * 1.0);
    if (approvalRate < 0.4) reliabilityDelta = Math.max(-0.3, (approvalRate - 0.4) * 0.75);

    // Severity override: if consultant consistently changes severity
    const severityEdits = hFindings.filter(f =>
      f.finding_edits?.some(e => e.changes?.severity)
    );
    let severityOverride: Severity | null = null;
    if (severityEdits.length >= 5) {
      const editedSeverities = severityEdits.map(f =>
        f.finding_edits.find(e => e.changes?.severity)!.changes.severity
      );
      const mostCommon = mode(editedSeverities);
      if (editedSeverities.filter(s => s === mostCommon).length / editedSeverities.length > 0.7) {
        severityOverride = mostCommon;
      }
    }

    // Suppress: if approval rate < 20% with sample >= 50
    const suppressBelow = (approvalRate < 0.2 && sampleSize >= 50) ? 0.5 : undefined;

    await storage.upsertCalibration({
      client_id: job.clientId,
      heuristic_id: heuristicId,
      reliability_delta: reliabilityDelta,
      severity_override: severityOverride,
      suppress_below_confidence: suppressBelow,
      approval_count: approved.length,
      rejection_count: rejected.length,
      approval_rate: approvalRate,
      sample_size: sampleSize,
      last_calibrated_at: new Date().toISOString(),
    });
  }
}
```

**REQ-LEARN-002:** Calibration is idempotent. Running it twice with the same data produces the same result.

**REQ-LEARN-003:** Calibration deltas are bounded: `reliability_delta ∈ [-0.3, +0.2]`. The system cannot flip a Tier 3 heuristic to behave like Tier 1 — it can only nudge.

**REQ-LEARN-003a:** (M1-L3-FIX) The hardcoded thresholds (0.8 approval for positive delta, 0.4 for negative) are Phase 12 starting values. Phase 12 implementation SHOULD refine thresholds per `reliability_tier` — Tier 3 heuristics have naturally lower approval rates (~50%) so the negative threshold for Tier 3 should be ~0.3, not 0.4. Tier-specific thresholds stored in a `calibration_config` table (Phase 12).

**REQ-LEARN-004:** Calibration results are version-pinned per audit run via the reproducibility snapshot's `overlay_chain_hash` (which includes calibration state at audit start time).

---

## 28.5 Heuristic Crystallisation (Phase 4+)

**REQ-LEARN-010:** (S4-L3-FIX) Crystallisation candidates are identified by a **simple heuristic** (not NLP on edit text): same `heuristic_id` + consultant edits severity on >5 findings + edit frequency > 70% consistency. The consultant dashboard surfaces these as suggestions. The consultant decides whether to crystallise. No auto-detection of "same type of note" — that would require NLP which is out of scope.

```typescript
interface CrystallisationCandidate {
  client_id: string;
  base_heuristic_id: string;
  pattern_description: string;       // derived from consultant edits
  edit_frequency: number;            // how often this edit occurs
  confidence: number;                // how consistent the edits are
  suggested_heuristic: Partial<HeuristicExtended>;
}
```

**REQ-LEARN-011:** Crystallisation is ALWAYS consultant-approved. The system suggests; the consultant creates. No automatic heuristic creation.

**REQ-LEARN-012:** Crystallised heuristics have `source: "learned"` and `client_overlay_only: true`. They only apply to the originating client.

---

## 28.6 Failure Modes

| # | Failure | Detection | Response |
|---|---|---|---|
| **LS-01** | Calibration job fails mid-batch | Exception in calibration loop | Retry job. Partial calibration is safe (idempotent upserts). |
| **LS-02** | Stale calibration (>90 days since last audit) | `last_calibrated_at` check (REQ-RETRIEVAL HR-05) | Ignore calibration for that heuristic. Use base weights. |
| **LS-03** | Calibration delta too aggressive (flips tier behavior) | `reliability_delta` bounds check | Clamped to [-0.3, +0.2]. Cannot exceed bounds. |
| **LS-04** | Consultant behavior is inconsistent (approves and rejects same heuristic) | High variance in approval_rate across audits | Log `inconsistent_signal`. Do not calibrate until variance stabilises (std dev < 0.2 across last 5 audits). |
| **LS-05** | Crystallisation suggestion is wrong | Consultant rejects | No harm — suggestion discarded. Log rejection for system improvement. |

---

## 28.7 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **6** | Data collection: consultant decisions stored in `findings` + `finding_edits` from day 1. No calibration computation yet. |
| **12** | Calibration batch job, `heuristic_calibration` table populated, integration with §23.4 confidence scoring |
| **12** | Warm-up graduation automation using calibration data |
| **13** | Consultant dashboard: calibration inspector, per-heuristic approval rates, override controls |
| **16** | Analytics signal integration (bounce, rage clicks → calibration boost/suppress) — aligned with §30.9 |
| **16** | Heuristic crystallisation pipeline (suggest → consultant review → create) |

---

**End of §28 — Learning Service**
