---
title: 24-two-store-pattern
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

# Section 24 — Two-Store Pattern & Warm-Up Mode

**Status:** Master architecture extension. Phase 6 (day 1 of post-MVP). Implements C9 locked decision.

**Cross-references:**
- §12 (Review Gate) — existing tier routing; this section adds the publish boundary
- §13.1 (findings table) + §13.6.11 (published_findings view) — storage
- §14 (Delivery Layer) — client dashboard and MCP read from published store only
- §5.7.2 (`warmup_mode_active`, `published_finding_ids`) — state fields

---

## 24.1 Principle

> **Raw AI output never reaches a client. The internal store holds everything the system produces. The published store holds only what a consultant has approved (or what survived warm-up graduation + auto-publish). The boundary between them is an ACL enforced at the database layer, not the application layer.**

---

## 24.2 Two-Store Architecture

```
┌─────────────────────────────────────┐  ┌──────────────────────────────────────┐
│          INTERNAL STORE             │  │          PUBLISHED STORE              │
│                                     │  │                                       │
│  findings table (all rows)          │  │  published_findings VIEW              │
│  • all scopes                       │  │  (WHERE publish_status = 'published'  │
│  • all statuses                     │  │   AND published_at <= NOW())           │
│  • all polarities                   │  │                                       │
│  • rejected findings visible        │  │  Only approved/auto-published findings │
│  • grounding metadata visible       │  │  No rejected, no held, no delayed     │
│  • LLM trace refs visible           │  │  No grounding metadata                │
│                                     │  │  No LLM trace refs                    │
│  WHO READS:                         │  │                                       │
│  • Consultant dashboard             │  │  WHO READS:                           │
│  • Admin/engineer debugging         │  │  • Client dashboard                   │
│  • Learning Service                 │  │  • CRO Audit MCP Server               │
│  • Finding diff engine              │  │  • Client API                         │
│                                     │  │  • PDF/CSV export                     │
│  ACCESS MODE: 'internal'            │  │                                       │
│                                     │  │  ACCESS MODE: 'published_only'        │
└─────────────────────────────────────┘  └──────────────────────────────────────┘
                │                                          ▲
                │         consultant approval              │
                │         or auto-publish (post warm-up)   │
                └──────────────────────────────────────────┘
```

---

## 24.3 Access Mode Enforcement

**REQ-TWOSTORE-001:** Every database session sets an access mode via `SET LOCAL app.access_mode`:

| Consumer | Access mode | Sees |
|---|---|---|
| Consultant dashboard | `internal` | All findings (all statuses, all scopes) |
| Admin/engineer | `internal` | Same |
| Client dashboard | `published_only` | Only `published_findings` view rows |
| CRO Audit MCP Server | `published_only` | Same |
| Client API | `published_only` | Same |
| Learning Service | `internal` | Needs rejected findings for calibration |

**REQ-TWOSTORE-002:** The `published_only` enforcement is layered:
1. **Application layer:** client-facing APIs query `published_findings` view, never the `findings` table directly
2. **Database layer:** RLS policy on `findings` table filters by `app.access_mode` (§13.6.11 REQ-DATA-EXT-003)
3. **Defense in depth:** even if application layer has a bug, RLS prevents raw findings from leaking

**REQ-TWOSTORE-003:** Setting `app.access_mode` is the responsibility of the API middleware, not individual route handlers. A single middleware function:

```typescript
async function setAccessMode(req: Request, db: DatabaseConnection): Promise<void> {
  const role = getUserRole(req); // from Clerk session
  const mode = (role === "client") ? "published_only" : "internal";
  await db.execute(sql`SET LOCAL app.access_mode = ${mode}`);
  await db.execute(sql`SET LOCAL app.client_id = ${getClientId(req)}`);
  // M4-L2-FIX: SET LOCAL is transaction-scoped. Every API request MUST be wrapped
  // in a database transaction for this to function correctly. Without a transaction,
  // SET LOCAL is equivalent to SET and persists on the connection (dangerous with pooling).
}
```

---

## 24.4 Warm-Up Mode

### Purpose

New clients should not receive auto-published findings until the system has proven its reliability on that client's specific site. Warm-up mode forces ALL findings through consultant review, building a rejection-rate baseline.

### State Machine

**REQ-TWOSTORE-010:**

```
NEW CLIENT
    │
    ▼
WARM-UP ACTIVE (warmup_mode_active = true)
    │
    │ Tier 1 auto-publish: DISABLED
    │ Tier 2 delayed publish: DISABLED (held instead)
    │ Tier 3 held: normal (held for review)
    │ ALL findings → held for consultant review
    │
    │ Consultant reviews findings across N audits...
    │
    ├── EXIT CONDITION MET:
    │   • audit_count >= 3 (configurable: warmup_audit_count)
    │   • rejection_rate < 25% (configurable: warmup_rejection_threshold)
    │   Both must be true.
    │
    ▼
WARM-UP GRADUATED (warmup_mode_active = false)
    │
    │ Tier 1: auto-publish ENABLED
    │ Tier 2: delayed publish ENABLED (24hr hold)
    │ Tier 3: held for review (unchanged)
    │
    │ Normal §12 review gate applies
    │
    ▼
CONSULTANT OVERRIDE: can manually re-enable warm-up at any time
```

### Exit Criteria Computation

**REQ-TWOSTORE-011:**

```typescript
interface WarmupStatus {
  active: boolean;
  audits_completed: number;
  audits_required: number;              // default 3
  rejection_rate: number;               // 0..1
  rejection_threshold: number;          // default 0.25
  can_graduate: boolean;
  graduation_blocked_reason?: "insufficient_audits" | "high_rejection_rate" | "consultant_hold";
}

function computeWarmupStatus(clientId: string, config: WarmupConfig): WarmupStatus {
  const audits = getCompletedAuditRuns(clientId);
  const findings = getAllFindingsForClient(clientId);
  const rejected = findings.filter(f => f.publish_status === "rejected_consultant");
  const reviewed = findings.filter(f =>
    ["published", "approved", "edited", "rejected_consultant"].includes(f.publish_status)
  );

  const rejectionRate = reviewed.length > 0 ? rejected.length / reviewed.length : 1.0;

  return {
    active: true, // caller checks this
    audits_completed: audits.length,
    audits_required: config.warmup_audit_count,
    rejection_rate: rejectionRate,
    rejection_threshold: config.warmup_rejection_threshold,
    can_graduate: audits.length >= config.warmup_audit_count && rejectionRate < config.warmup_rejection_threshold,
    graduation_blocked_reason:
      audits.length < config.warmup_audit_count ? "insufficient_audits" :
      rejectionRate >= config.warmup_rejection_threshold ? "high_rejection_rate" :
      undefined,
  };
}
```

### Warm-Up Config Defaults

**REQ-TWOSTORE-012:**

| Config | Default | Configurable by |
|---|---|---|
| `warmup_audit_count` | 3 | Consultant (per client) |
| `warmup_rejection_threshold` | 0.25 (25%) | Consultant (per client) |
| `warmup_auto_graduate` | true | Consultant — if false, consultant must manually approve graduation |
| `warmup_manual_override` | allowed | Consultant can force-enable or force-disable warm-up |

**REQ-TWOSTORE-013:** Warm-up status is displayed in the consultant dashboard client detail page with: audit count, rejection rate, projected graduation date, and a manual override toggle.

---

## 24.5 Publish Flow (Updated)

**REQ-TWOSTORE-020:** The existing §12 review gate is modified for warm-up awareness:

```typescript
function determinePublishAction(
  finding: GroundedFinding,
  warmupActive: boolean,
  tier: "high" | "medium" | "low"
): PublishAction {
  // During warm-up: everything is held
  if (warmupActive) {
    return { status: "held", reason: "warmup_mode" };
  }

  // Post warm-up: normal tier routing (§12)
  switch (tier) {
    case "high":   return { status: "published", reason: "auto_tier_1" };
    case "medium": return { status: "delayed", delay_hours: 24, reason: "auto_tier_2" };
    case "low":    return { status: "held", reason: "tier_3_review" };
  }
}
```

**REQ-TWOSTORE-021:** The delayed publish worker (§12.4) SHALL also check warm-up status before auto-publishing delayed findings. If warm-up was re-enabled between the delay start and the 24hr expiry, the finding stays held.

---

## 24.6 Client-Facing Finding Projection

**REQ-TWOSTORE-030:** The `published_findings` view (§13.6.11) strips internal fields:

| Field | Visible in published store? |
|---|---|
| `id` | Yes |
| `audit_run_id` | Yes |
| `client_id` | Yes (via RLS) |
| `page_url` | Yes |
| `page_type` | Yes |
| `scope` | Yes |
| `template_id` | Yes (clients can see template grouping) |
| `workflow_id` | Yes |
| `heuristic_id` | **No** (IP protection) |
| `heuristic_source` | Yes ("baymard", "nielsen", "cialdini" — attribution only) |
| `category` | Yes |
| `severity` | Yes |
| `confidence_tier` | Yes |
| `business_impact` | Yes |
| `effort` | Yes |
| `priority` | Yes |
| `name` | Yes |
| `observation` | Yes (consultant-approved text only if edited) |
| `assessment` | Yes |
| `recommendation` | Yes |
| `polarity` | Yes |
| `bounding_box` | Yes |
| `screenshot_ref` | Yes |
| `critique_verdict` | **No** |
| `critique_reason` | **No** |
| `grounding_rules_passed` | **No** |
| `evidence` (raw JSONB) | **No** — replaced with simplified evidence summary |
| `published_at` | Yes |

**REQ-TWOSTORE-031:** The published findings view includes a computed `evidence_summary` field:

```sql
-- In the published_findings view definition:
CASE
  WHEN evidence->>'measurement' IS NOT NULL
  THEN evidence->>'measurement'
  ELSE evidence->>'data_point'
END AS evidence_summary
```

This gives clients enough context to understand the finding without exposing the full evidence JSONB (which may contain internal references).

---

## 24.7 Failure Modes

| # | Failure | Detection | Response |
|---|---|---|---|
| **TS-01** | `app.access_mode` not set on client-facing session | Missing session variable → RLS falls back to blocking all rows | Client sees empty results. Alert on p95 empty-result rate spike. |
| **TS-02** | Consultant accidentally sets `published_only` on their own session | Consultant sees only published findings | Application bug — middleware should use role-based mode. Fix middleware. |
| **TS-03** | Warm-up graduation computed incorrectly | Rejection rate math error | Unit test: verify with known finding sets. Cross-check in consultant dashboard. |
| **TS-04** | Warm-up re-enabled after delayed findings were queued for auto-publish | Worker checks warm-up status, finds re-enabled | Finding stays held. Log the catch. |
| **TS-05** | Client API serves 0 findings despite audit being completed | All findings held (warm-up) or all rejected | Expected during warm-up. Client dashboard shows "Findings are being reviewed by your consultant." |

---

## 24.8 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **6** | `published_findings` view, `app.access_mode` middleware, warm-up state machine, publish flow updated |
| **6** | Warm-up config in client profile, graduation logic, manual override |
| **9** | Client dashboard reads only from published store |
| **9** | MCP server reads only from published store |
| **11** | Consultant dashboard: warm-up status display, override toggle, rejection rate trend |
| **12** | Warm-up auto-graduation based on learned calibration data (§28) |

---

**End of §24 — Two-Store Pattern & Warm-Up Mode**
