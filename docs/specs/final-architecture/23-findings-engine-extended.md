---
title: 23-findings-engine-extended
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

# Section 23 — Findings Engine (Extended)

**Status:** Master architecture extension. Core scoring deployed Phase 6; rollups Phase 8. Extends §7 (Analyze Mode) and §12 (Review Gate).

**Cross-references:**
- §7 (Analyze Mode) — produces atomic findings; this section adds scoring + rollups
- §12 (Review Gate) — existing tier routing; this section adds scoring inputs
- §5.7.1 (`FindingScope`, `FindingRollupRef`) — types
- §13.1 + C1-FIX (`findings` table extended columns) — storage
- §13.6.5 (`finding_rollups` table) — rollup persistence
- §24 (Two-Store Pattern) — publish projection

---

## 23.1 Principle

> **Every finding is a view over evidence. Atomic findings are produced by the analysis pipeline. Page findings merge atomics across states. Template findings merge pages of the same template. Workflow findings are synthesised by the Workflow Analyzer. Audit findings summarise the whole run. Scoring is always deterministic — severity, confidence, business impact, effort, and priority are computed from data, never from LLM opinion.**

---

## 23.2 Finding Scope Hierarchy

```
ATOMIC FINDING       (one state, one page, one heuristic)
    │ dedup + merge across states of same page
    ▼
PAGE FINDING         (one page, possibly multi-state)
    │ dedup + merge across pages of same template
    ▼
TEMPLATE FINDING     (one template, 1-3 representative pages)
    │ not auto-rollup — workflow findings are synthesised independently
    │
WORKFLOW FINDING     (produced by §21 Workflow Analyzer, cross-step scope)
    │
    ▼ both feed into
AUDIT SUMMARY        (statistics, not a "finding" — computed at audit_complete)
```

---

## 23.3 Deduplication Rules

### Across states (same page)

**REQ-FINDINGS-DEDUP-001:**

```typescript
function dedupeAcrossStates(atomicFindings: Finding[]): Finding[] {
  const groups = groupBy(atomicFindings, f => `${f.heuristic_id}::${f.evidence?.element_ref ?? "no_ref"}`);

  return Object.values(groups).map(group => {
    if (group.length === 1) return group[0];

    // Merge: keep the one with highest confidence, merge evidence + state_ids
    const best = group.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    return {
      ...best,
      scope: "page" as FindingScope,
      state_ids: [...new Set(group.flatMap(f => f.state_ids ?? []))],
      evidence_ids: [...new Set(group.flatMap(f => f.evidence_ids ?? []))],
      parent_finding_ids: group.map(f => f.id),
    };
  });
}
```

### Across pages (same template)

**REQ-FINDINGS-DEDUP-002:**

```typescript
function dedupeAcrossPages(pageFindings: Finding[], template: Template): Finding[] {
  const groups = groupBy(pageFindings, f => f.heuristic_id);

  return Object.values(groups).map(group => {
    // Same heuristic on ≥60% of template's representative pages → template finding
    const threshold = Math.ceil(template.representative_urls.length * 0.6);
    if (group.length >= threshold) {
      const best = group.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
      return {
        ...best,
        scope: "template" as FindingScope,
        template_id: template.id,
        page_url: null,               // template-level, not page-specific
        parent_finding_ids: group.map(f => f.id),
        description: `${best.description} (found on ${group.length}/${template.representative_urls.length} ${template.classified_type} pages)`,
      };
    }
    // Below threshold: keep as individual page findings (not template-level)
    return group;
  }).flat();
}
```

### Semantic dedup (any scope)

**REQ-FINDINGS-DEDUP-003:** Two findings at the same scope with:
- Same `heuristic_id` AND
- Observation text embedding cosine similarity > 0.85

are candidates for merge. The one with higher confidence survives; the other becomes a `finding_rollup` child.

**REQ-FINDINGS-DEDUP-003a:** Semantic dedup is Phase 3+ (requires embeddings). Phase 1-2 uses exact `heuristic_id + element_ref` matching only.

---

## 23.4 Four-Dimensional Deterministic Scoring

**REQ-FINDINGS-SCORE-001:** Every finding receives four deterministic scores. NO score is LLM-derived.

### Severity (from heuristic + grounding)

**REQ-FINDINGS-SCORE-010:** Severity is determined by:

1. Start with `heuristic.severity_if_violated`
2. If self-critique DOWNGRADED severity → use downgraded value
3. If GR-006 rejected the original severity (no measurable evidence for critical/high) → finding already rejected

```typescript
function determineSeverity(finding: ReviewedFinding, heuristic: HeuristicExtended): Severity {
  if (finding.critique_verdict === "DOWNGRADE" && finding.severity) {
    return finding.severity; // already downgraded by critique
  }
  return heuristic.severity_if_violated;
}
```

Severity values: `critical = 4`, `high = 3`, `medium = 2`, `low = 1`.

### Confidence (from evidence quality + reliability tier)

**REQ-FINDINGS-SCORE-020:** Confidence is computed deterministically:

```typescript
function computeConfidence(
  finding: GroundedFinding,
  heuristic: HeuristicExtended,
  groundingRulesPassed: string[],
  calibration?: HeuristicCalibration
): number {
  const tierWeight = { 1: 1.0, 2: 0.7, 3: 0.4 }[heuristic.reliability_tier];
  const groundingPassRate = groundingRulesPassed.length / TOTAL_GROUNDING_RULES;
  const evidenceQuality =
    (finding.evidence?.measurement ? 0.4 : 0) +
    (finding.evidence?.element_ref ? 0.3 : 0) +
    (finding.evidence?.data_point ? 0.2 : 0) +
    (finding.evidence?.element_selector ? 0.1 : 0);

  let base = tierWeight * groundingPassRate * Math.max(evidenceQuality, 0.1);

  // Phase 4: apply learned calibration delta
  if (calibration && calibration.sample_size >= 30) {
    base = Math.max(0, Math.min(1, base + calibration.reliability_delta));
  }

  return Math.round(base * 100) / 100; // 2 decimal places
}
```

### Business Impact (deterministic matrix)

**REQ-FINDINGS-SCORE-030:** Business impact is a lookup, never LLM-derived:

```typescript
// IMPACT_MATRIX[page_type][funnel_position] → base_impact (0-10)
const IMPACT_MATRIX: Record<PageType, Record<FunnelPosition, number>> = {
  checkout:  { entry: 5, discovery: 6, decision: 7, intent: 8, conversion: 10, post_conversion: 3 },
  cart:      { entry: 4, discovery: 5, decision: 6, intent: 7, conversion: 8,  post_conversion: 2 },
  product:   { entry: 3, discovery: 4, decision: 6, intent: 5, conversion: 6,  post_conversion: 2 },
  pricing:   { entry: 4, discovery: 5, decision: 7, intent: 6, conversion: 7,  post_conversion: 2 },
  form:      { entry: 3, discovery: 4, decision: 5, intent: 7, conversion: 8,  post_conversion: 2 },
  homepage:  { entry: 5, discovery: 4, decision: 3, intent: 3, conversion: 2,  post_conversion: 1 },
  landing:   { entry: 6, discovery: 5, decision: 4, intent: 4, conversion: 3,  post_conversion: 1 },
  category:  { entry: 2, discovery: 4, decision: 3, intent: 3, conversion: 2,  post_conversion: 1 },
  search:    { entry: 2, discovery: 4, decision: 3, intent: 3, conversion: 2,  post_conversion: 1 },
  account:   { entry: 1, discovery: 1, decision: 1, intent: 1, conversion: 1,  post_conversion: 3 },
  other:     { entry: 1, discovery: 2, decision: 2, intent: 2, conversion: 2,  post_conversion: 1 },
};

// C5-L2-FIX: Default funnel position for pages not in any workflow
const DEFAULT_FUNNEL_POSITION: Record<PageType, FunnelPosition> = {
  homepage:  "entry",
  landing:   "entry",
  category:  "discovery",
  search:    "discovery",
  product:   "decision",
  pricing:   "decision",
  cart:      "intent",
  form:      "intent",
  checkout:  "conversion",
  account:   "post_conversion",
  other:     "discovery",       // safest default for unknown pages
};

function computeBusinessImpact(
  severity: Severity,
  pageType: PageType,
  funnelPosition: FunnelPosition | undefined,  // C5-L2-FIX: may be undefined for non-workflow pages
  heuristicWeight: number           // 0..1 from HeuristicExtended.business_impact_weight
): number {
  const effectivePosition = funnelPosition ?? DEFAULT_FUNNEL_POSITION[pageType] ?? "discovery";
  const severityNorm = { critical: 4, high: 3, medium: 2, low: 1 }[severity] / 4;
  const baseImpact = IMPACT_MATRIX[pageType]?.[effectivePosition] ?? 2;
  return Math.round(baseImpact * severityNorm * heuristicWeight * 10) / 10; // 0-10, 1 decimal
}
```

### Effort (deterministic category lookup)

**REQ-FINDINGS-SCORE-040:**

```typescript
const EFFORT_MAP: Record<EffortCategory, number> = {
  copy:          2,    // text/wording changes — very low effort
  content:       3,    // add/remove content blocks — low effort
  visual:        4,    // styling, color, contrast — medium effort
  layout:        6,    // structural reflow — medium-high effort
  code:          8,    // engineering changes — high effort
  architecture:  10,   // significant refactor — very high effort
};

function computeEffort(heuristic: HeuristicExtended): number {
  return EFFORT_MAP[heuristic.effort_category] ?? 5;
}
```

### Priority (derived)

**REQ-FINDINGS-SCORE-050:**

```typescript
function computePriority(severity: number, confidence: number, impact: number, effort: number): number {
  return Math.round(
    ((severity * 2.0) +
    (impact * 1.5) +
    (confidence * 1.0) -
    (effort * 0.5))
  * 100) / 100;
}
// C3-L2-FIX: Range: -3 to 24. (severity 1-4 ×2 = 2-8, impact 0-10 ×1.5 = 0-15, confidence 0-1 ×1 = 0-1, effort 0-10 ×0.5 = 0-5)
// Min = 2+0+0-5 = -3, Max = 8+15+1-0 = 24. Higher = fix first.
```

**REQ-FINDINGS-SCORE-051:** Scoring constants (`2.0, 1.5, 1.0, 0.5`) are version-pinned via `reproducibility_snapshot.deterministic_scoring_version`. Changing them = version bump.

---

## 23.5 Suppression Rules

**REQ-FINDINGS-SUPPRESS-001:** Findings are silently rejected (stored in `rejected_findings`) when:

| Condition | Rejection reason |
|---|---|
| `confidence < 0.3` | `low_confidence` |
| `evidence_ids.length === 0` | `no_evidence` |
| Grounding rule failed | `grounding_rule_{id}` (existing §7.7) |
| Conversion prediction detected (GR-007) | `conversion_prediction` |
| Duplicate by exact match (same heuristic + same element_ref + same page) | `exact_duplicate` |
| Semantic duplicate (cosine > 0.85, Phase 3+) | `semantic_duplicate` |

**REQ-FINDINGS-SUPPRESS-002:** Suppressed findings are NEVER visible to clients or consultants (unless consultant has admin toggle to view rejections for debugging).

---

## 23.6 Positive Findings (Optional)

**REQ-FINDINGS-POSITIVE-001:** When enabled (`AuditRequest.scope.include_positive_findings = true`), findings with `status = "pass"` from the evaluate step are retained with `polarity = "positive"`.

**REQ-FINDINGS-POSITIVE-002:** Positive findings:
- Bypass self-critique (nothing to critique — the page is doing well)
- Pass through evidence grounding with REDUCED rules (M3-L2-FIX): GR-001 (element exists), GR-007 (no conversion prediction), GR-008 (valid data_point). GR-006 (severity proportionality) SKIPPED because positive findings have null severity.
- Receive `confidence` and `business_impact` scores but NOT priority (they're informational)
- Have `severity = null` (not applicable — nothing is wrong)
- Stored with `scope = "page"` (not rolled up to template)

**REQ-FINDINGS-POSITIVE-003:** Use case: consultant report includes "guest checkout is properly implemented" alongside violations. Prevents reports from being 100% negative.

**REQ-FINDINGS-POSITIVE-004:** Default: `include_positive_findings = false`. Enabled per audit request.

---

## 23.7 Rollup Persistence

**REQ-FINDINGS-ROLLUP-001:** When dedup/merge creates a higher-scope finding from lower-scope children, the relationship is stored in `finding_rollups` (§13.6.5):

```typescript
async function persistRollup(
  parentFinding: Finding,
  childFindings: Finding[],
  reason: string,
  storage: StorageAdapter
): Promise<void> {
  // 1. Insert parent finding
  await storage.saveFinding(parentFinding);

  // 2. Insert rollup relationships
  for (const child of childFindings) {
    await storage.saveRollup({
      audit_run_id: parentFinding.audit_run_id,
      client_id: parentFinding.client_id,
      parent_finding_id: parentFinding.id,
      parent_scope: parentFinding.scope,
      child_finding_id: child.id,
      rollup_reason: reason,
      merge_count: childFindings.length,
    });
  }
}
```

**REQ-FINDINGS-ROLLUP-002:** Consultant dashboard renders rollups as expandable trees: template finding → click to see page findings → click to see atomic findings with per-state evidence.

---

## 23.8 Scoring Pipeline (end-to-end)

```
GroundedFinding (from §7.7)
    │
    ▼
determineSeverity(finding, heuristic)          → severity: Severity
    │
    ▼
computeConfidence(finding, heuristic, rules, calibration?) → confidence: number
    │
    ▼
computeBusinessImpact(severity, pageType, funnelPos, heuristicWeight) → impact: number
    │
    ▼
computeEffort(heuristic)                       → effort: number
    │
    ▼
computePriority(severity, confidence, impact, effort) → priority: number
    │
    ▼
Apply suppression rules                        → keep or reject
    │
    ▼
Persist to findings table with all scores
    │
    ▼
Feed to review gate (§12 / §24)
```

---

## 23.9 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **6** | (FS-4-FIX: scoring IS Phase 6 — Platform Foundation) Scoring pipeline (4 dimensions), suppression rules, scoring config versioning |
| **6** | Positive findings support (optional, off by default) |
| **9** | (FS-4-FIX: corrected from Phase 8 to Phase 9 — Workflow + Rollups per §16.5) Cross-state dedup, cross-page dedup, template rollups, workflow findings integration |
| **9** | Rollup persistence + consultant dashboard tree view |
| **11** | Client dashboard: priority-sorted finding list, severity/impact/effort badges |
| **12** | Learned calibration integration with §28 — confidence adjustments per client |

---

**End of §23 — Findings Engine (Extended)**
