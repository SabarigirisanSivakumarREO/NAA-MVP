# Section 12 — Review Gate & Finding Lifecycle

## 12.1 Dual-Mode Publishing

The review gate behaves differently depending on the interaction mode.

### Mode A: Chatbot / MCP (Real-Time)

**REQ-REVIEW-001:** When findings are produced via real-time chatbot or MCP query:

```
User: "Analyze example.com/checkout for CRO issues"
    → Agent runs browse + analyze → 5 findings produced
    → ALL findings returned in the conversation
    → Tier 1: labeled as "confirmed" findings
    → Tier 2-3: labeled with confidence caveat:
      "These findings have medium/low confidence.
       Consultant review recommended before implementing."
    → ALL findings also stored in DB for consultant dashboard
```

### Mode B: Dashboard (Async / Scheduled)

**REQ-REVIEW-002:** When findings are produced via scheduled or manually-triggered audit:

```
┌──────────────────────────────────────────┐
│          FINDING PRODUCED                 │
│   (after self-critique + evidence ground) │
└─────────────┬────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────┐
│       CONFIDENCE TIER CHECK               │
│                                           │
│ Tier 1 (high) + evidence grounded?        │
│   → AUTO-PUBLISH immediately              │
│   → Consultant notified (no gate)         │
│                                           │
│ Tier 2 (medium)?                          │
│   → DELAYED PUBLISH (24hr hold)           │
│   → Consultant can intervene during hold  │
│   → Auto-publishes after 24hr if no action│
│                                           │
│ Tier 3 (low) OR needs_review flag?        │
│   → HELD for consultant review            │
│   → NOT visible to client until approved  │
│   → Consultant: approve / reject / edit   │
│                                           │
│ Evidence grounding FAILED?                │
│   → REJECTED silently                     │
│   → Logged for system improvement         │
│   → Never shown to anyone                 │
└───────────────────────────────────────────┘
```

## 12.2 Finding Lifecycle State Machine

**REQ-REVIEW-003:**

```
GENERATED ──→ CRITIQUED ──→ GROUNDED ──→ TIERED ──→ PUBLISHED
   │              │              │           │           │
   │         (REJECT)       (REJECT)        │      (consultant
   │              │              │           │       can edit)
   │              ▼              ▼           │
   │           DEAD_CRITIQUE  DEAD_GROUND   │
   │           (logged)       (logged)      │
   │                                        │
   │                               ┌────────┴────────┐
   │                               │                 │
   │                          Tier 1            Tier 2/3
   │                               │                 │
   │                               ▼                 ▼
   │                          PUBLISHED          DELAYED (Tier 2)
   │                                             HELD (Tier 3)
   │                                                 │
   │                                            consultant
   │                                            action
   │                                                 │
   │                                    ┌────────────┼────────────┐
   │                                    ▼            ▼            ▼
   │                               APPROVED     EDITED      REJECTED_CONSULTANT
   │                               (published)  (published)  (logged)
   │
   └──→ (malformed output) ──→ RETRY (max 2x) ──→ FAILED
```

### Finding Status Values

**REQ-REVIEW-004:**

```typescript
type FindingStatus =
  | "generated"                // raw output from evaluate node
  | "critiqued"                // survived self-critique (KEEP/REVISE/DOWNGRADE)
  | "grounded"                 // survived evidence grounding
  | "published"                // visible to client (Tier 1 auto or consultant approved)
  | "delayed"                  // Tier 2: waiting for 24hr hold
  | "held"                     // Tier 3: waiting for consultant
  | "approved"                 // consultant explicitly approved
  | "edited"                   // consultant edited and published
  | "rejected_critique"        // killed by self-critique
  | "rejected_ground"          // killed by evidence grounding
  | "rejected_consultant"      // killed by consultant
  | "failed"                   // LLM output error, could not process
```

### Status Transitions

**REQ-REVIEW-005:** Valid transitions:

```typescript
const VALID_TRANSITIONS: Record<FindingStatus, FindingStatus[]> = {
  generated:             ["critiqued", "rejected_critique", "failed"],
  critiqued:             ["grounded", "rejected_ground"],
  grounded:              ["published", "delayed", "held"],
  delayed:               ["published", "edited", "rejected_consultant"],
  held:                  ["approved", "edited", "rejected_consultant"],
  published:             [],  // terminal
  approved:              [],  // terminal (same as published, explicitly reviewed)
  edited:                [],  // terminal
  rejected_critique:     [],  // terminal
  rejected_ground:       [],  // terminal
  rejected_consultant:   [],  // terminal
  failed:                [],  // terminal
};
```

## 12.3 Consultant Dashboard — Review Interface

**REQ-REVIEW-006:** The consultant dashboard SHALL provide:

### Sections

| Section | Content | Actions Available |
|---------|---------|-------------------|
| **Needs Review** | Tier 3 findings + `needs_review` flagged findings | Approve, Edit, Reject |
| **Publishing Soon** | Tier 2 findings in 24hr hold period | Edit, Remove, Hold Longer |
| **Published** | Tier 1 auto-published + consultant-approved findings | Edit (creates new version) |
| **Rejected** | All rejected findings (for system improvement tracking) | Restore (re-submit for grounding) |

### Consultant Actions

| Action | What Happens | Finding Status |
|--------|-------------|---------------|
| **Approve** | Finding becomes visible to client | `held` → `approved` |
| **Edit** | Consultant modifies description/recommendation, publishes | `held`/`delayed` → `edited` |
| **Reject** | Finding removed from client view, logged | `held`/`delayed` → `rejected_consultant` |
| **Hold Longer** | Extends 24hr delay by another 24hr | `delayed` → `delayed` (new timer) |

### Editing Rules

**REQ-REVIEW-007:**
- Original finding is NEVER modified (preserved for audit trail)
- Edit creates a new version linked to the original
- Edit history is tracked: who edited, when, what changed
- Client sees only the latest version

```typescript
interface FindingEdit {
  finding_id: string;
  original_finding: Finding;       // preserved
  edited_by: string;               // consultant user ID
  edited_at: string;
  changes: {
    description?: string;          // new description
    recommendation?: string;       // new recommendation
    severity?: string;             // new severity
  };
}
```

## 12.4 24-Hour Delay Worker

**REQ-REVIEW-008:** A background job checks for Tier 2 findings past their 24hr hold:

```typescript
// Runs every 5 minutes via BullMQ recurring job
async function publishDelayedFindings(): Promise<void> {
  const expiredFindings = await storage.getFindings({
    status: "delayed",
    publish_at_before: new Date(),  // 24hr has passed
  });

  for (const finding of expiredFindings) {
    await storage.updateFindingStatus(finding.id, "published");
    await eventBus.emit({
      type: "finding_auto_published",
      findingId: finding.id,
      clientId: finding.client_id,
    });
  }
}
```

---

## 12.5 Master Architecture Extensions (G6-FIX)

### Warm-Up Mode Integration

**REQ-REVIEW-009:** (G6-FIX) The review gate is modified for warm-up awareness per §24.4. During warm-up (`warmup_mode_active = true`):
- Tier 1 auto-publish: **DISABLED** — all findings held for consultant review
- Tier 2 delayed publish: **DISABLED** — held instead of delayed
- Tier 3 held: unchanged

Warm-up exit criteria and state machine are fully specified in §24 (Two-Store Pattern & Warm-Up Mode).

### Two-Store Boundary

**REQ-REVIEW-010:** (G6-FIX) The review gate writes to the **internal findings store** only. The `published_findings` view (§13.6.11) is the projection that client-facing interfaces read from. The boundary between internal and published is enforced at the database layer via `app.access_mode` session variable (§24.3 REQ-TWOSTORE-001..003).

### Extended Scoring Integration

**REQ-REVIEW-011:** (G6-FIX) The review gate now receives 4-dimensional scores from the Findings Engine (§23): severity, confidence, business_impact, effort, priority. The existing tier routing (Tier 1/2/3 based on `confidence_tier`) remains the primary publish gate. The `priority` score is used by the consultant dashboard to sort the review inbox — highest priority findings surface first.

### Cross-references

- §24 — Two-Store Pattern & Warm-Up Mode (full warm-up state machine, publish flow, access mode enforcement)
- §23 — Findings Engine Extended (4-dimensional scoring, suppression rules)
- §14 — Delivery Layer (client dashboard reads published store only)
