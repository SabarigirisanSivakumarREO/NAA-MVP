# MVP Data Model

## PostgreSQL Schema (Drizzle ORM)

This is the minimal schema for MVP. Post-MVP adds: clients (multi-tenant), comparison_findings, consistency_findings, finding_edits.

---

## Tables

### `clients` (1 row for MVP)

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'ecommerce',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**MVP usage:** Single hardcoded client created on first run.

### `audit_runs`

```sql
CREATE TABLE audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  status TEXT NOT NULL DEFAULT 'pending',
  root_url TEXT NOT NULL,
  pages_total INTEGER DEFAULT 0,
  pages_crawled INTEGER DEFAULT 0,
  pages_failed INTEGER DEFAULT 0,
  findings_count INTEGER DEFAULT 0,
  total_cost_usd FLOAT DEFAULT 0.0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status values:** `pending` | `running` | `completed` | `failed` | `budget_exceeded`

### `findings`

```sql
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  page_url TEXT NOT NULL,
  page_type TEXT,

  -- Heuristic reference (ID only, never full content)
  heuristic_id TEXT NOT NULL,
  heuristic_source TEXT NOT NULL,
  category TEXT NOT NULL,

  -- Finding content
  status TEXT NOT NULL DEFAULT 'published',
  severity TEXT NOT NULL,
  name TEXT NOT NULL,
  observation TEXT NOT NULL,
  assessment TEXT NOT NULL,
  evidence JSONB NOT NULL,
  recommendation TEXT,
  confidence_tier TEXT NOT NULL,
  confidence_basis TEXT,

  -- Annotation
  bounding_box JSONB,
  screenshot_id UUID REFERENCES screenshots(id),

  -- Grounding metadata
  grounding_rules_passed TEXT[],
  critique_verdict TEXT,
  critique_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_findings_audit_run ON findings(audit_run_id);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_heuristic ON findings(heuristic_id);
```

### `rejected_findings` (audit trail of what got filtered out)

```sql
CREATE TABLE rejected_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id),
  page_url TEXT NOT NULL,
  heuristic_id TEXT NOT NULL,
  finding_content JSONB NOT NULL,
  rejection_stage TEXT NOT NULL,
  rejection_reason TEXT NOT NULL,
  rejected_by_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Rejection stages:** `critique` | `ground` | `consultant` (last one not used in MVP)

### `screenshots`

```sql
CREATE TABLE screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id),
  page_url TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Type values:** `viewport_clean` | `viewport_annotated` | `fullpage_clean` | `fullpage_annotated`

### `sessions` (browse session tracking)

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID REFERENCES audit_runs(id),
  task TEXT NOT NULL,
  start_url TEXT NOT NULL,
  status TEXT NOT NULL,
  steps INTEGER DEFAULT 0,
  confidence FLOAT,
  cost_usd FLOAT DEFAULT 0.0,
  completion_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### `audit_log` (security events)

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  action_class TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  url TEXT NOT NULL,
  parameters JSONB,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Action class values:** `safe` | `caution` | `sensitive` | `blocked`

### LangGraph checkpoints (auto-managed)

LangGraph PostgresCheckpointer creates and manages its own tables:
- `checkpoints`
- `checkpoint_writes`

We don't define these manually; they come from `@langchain/langgraph/checkpoint-postgres`.

---

## Drizzle Schema

```typescript
// packages/agent-core/src/db/schema.ts
import { pgTable, uuid, text, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  businessType: text("business_type").notNull().default("ecommerce"),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const auditRuns = pgTable("audit_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  status: text("status").notNull().default("pending"),
  rootUrl: text("root_url").notNull(),
  pagesTotal: integer("pages_total").default(0),
  pagesCrawled: integer("pages_crawled").default(0),
  pagesFailed: integer("pages_failed").default(0),
  findingsCount: integer("findings_count").default(0),
  totalCostUsd: real("total_cost_usd").default(0.0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditRunId: uuid("audit_run_id").notNull().references(() => auditRuns.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  pageUrl: text("page_url").notNull(),
  pageType: text("page_type"),
  heuristicId: text("heuristic_id").notNull(),
  heuristicSource: text("heuristic_source").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("published"),
  severity: text("severity").notNull(),
  name: text("name").notNull(),
  observation: text("observation").notNull(),
  assessment: text("assessment").notNull(),
  evidence: jsonb("evidence").notNull(),
  recommendation: text("recommendation"),
  confidenceTier: text("confidence_tier").notNull(),
  confidenceBasis: text("confidence_basis"),
  boundingBox: jsonb("bounding_box"),
  screenshotId: uuid("screenshot_id"),
  groundingRulesPassed: text("grounding_rules_passed").array(),
  critiqueVerdict: text("critique_verdict"),
  critiqueReason: text("critique_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const rejectedFindings = pgTable("rejected_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditRunId: uuid("audit_run_id").notNull().references(() => auditRuns.id),
  pageUrl: text("page_url").notNull(),
  heuristicId: text("heuristic_id").notNull(),
  findingContent: jsonb("finding_content").notNull(),
  rejectionStage: text("rejection_stage").notNull(),
  rejectionReason: text("rejection_reason").notNull(),
  rejectedByRule: text("rejected_by_rule"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const screenshots = pgTable("screenshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditRunId: uuid("audit_run_id").notNull().references(() => auditRuns.id),
  pageUrl: text("page_url").notNull(),
  type: text("type").notNull(),
  storageKey: text("storage_key").notNull(),
  width: integer("width"),
  height: integer("height"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditRunId: uuid("audit_run_id").references(() => auditRuns.id),
  task: text("task").notNull(),
  startUrl: text("start_url").notNull(),
  status: text("status").notNull(),
  steps: integer("steps").default(0),
  confidence: real("confidence"),
  costUsd: real("cost_usd").default(0.0),
  completionReason: text("completion_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id),
  actionClass: text("action_class").notNull(),
  toolName: text("tool_name").notNull(),
  url: text("url").notNull(),
  parameters: jsonb("parameters"),
  result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

---

## Output File Structure (Disk)

```
output/
└── audit-{audit_run_id}/
    ├── summary.json
    ├── findings.json
    ├── trace.json
    └── pages/
        └── {page_url_hash}/
            ├── viewport-clean.jpg
            ├── viewport-annotated.jpg
            ├── fullpage-clean.jpg
            ├── fullpage-annotated.jpg
            └── findings.json
```

### `summary.json`

```json
{
  "audit_run_id": "a1b2c3d4-...",
  "client": { "id": "...", "name": "Example Corp" },
  "root_url": "https://example.com",
  "status": "completed",
  "pages_total": 3,
  "pages_crawled": 3,
  "pages_failed": 0,
  "findings_count": 6,
  "findings_by_severity": { "critical": 0, "high": 2, "medium": 3, "low": 1 },
  "findings_rejected_critique": 1,
  "findings_rejected_grounding": 1,
  "total_cost_usd": 1.85,
  "duration_seconds": 52,
  "started_at": "2026-04-15T10:00:00Z",
  "completed_at": "2026-04-15T10:00:52Z"
}
```

### `findings.json`

JSON array of all GroundedFinding objects (excluding heuristic content).
