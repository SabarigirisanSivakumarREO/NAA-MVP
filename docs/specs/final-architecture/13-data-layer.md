# Section 13 — Data Layer

## 13.1 PostgreSQL Schema

**REQ-DATA-001:** All tables use UUID primary keys, TIMESTAMPTZ for dates, JSONB for flexible data.

### Client Management Tables

```sql
-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  sector TEXT,
  industry TEXT,
  business_type TEXT NOT NULL DEFAULT 'ecommerce',  -- ecommerce|saas|leadgen|marketplace|media
  config JSONB DEFAULT '{}',                         -- crawl scope, auth config, rate limits
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Runs (versioned per client)
CREATE TABLE audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  version INTEGER NOT NULL,                          -- auto-increment per client
  status TEXT NOT NULL DEFAULT 'pending',             -- pending|running|completed|failed|budget_exceeded
  root_url TEXT NOT NULL,
  crawl_scope TEXT NOT NULL DEFAULT 'domain',
  heuristic_set TEXT NOT NULL DEFAULT 'default',
  pages_total INTEGER DEFAULT 0,
  pages_crawled INTEGER DEFAULT 0,
  pages_failed INTEGER DEFAULT 0,
  findings_count INTEGER DEFAULT 0,
  findings_published INTEGER DEFAULT 0,
  findings_held INTEGER DEFAULT 0,
  findings_rejected INTEGER DEFAULT 0,
  total_cost_usd FLOAT DEFAULT 0.0,
  competitor_urls TEXT[],
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, version)
);
```

### Findings Tables

```sql
-- CRO Findings
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  page_url TEXT NOT NULL,
  page_type TEXT,

  -- Heuristic reference (ID only — never store full heuristic content)
  heuristic_id TEXT NOT NULL,
  heuristic_source TEXT NOT NULL,                    -- baymard|nielsen|cialdini
  category TEXT NOT NULL,

  -- Finding content
  status TEXT NOT NULL,                              -- see FindingStatus type
  severity TEXT NOT NULL,                            -- critical|high|medium|low
  name TEXT NOT NULL,
  observation TEXT NOT NULL,
  assessment TEXT NOT NULL,
  evidence JSONB NOT NULL,
  recommendation TEXT,
  confidence_tier TEXT NOT NULL,                     -- high|medium|low
  confidence_basis TEXT,
  needs_review BOOLEAN DEFAULT false,

  -- Review gate
  publish_status TEXT NOT NULL DEFAULT 'held',       -- published|delayed|held|rejected
  published_at TIMESTAMPTZ,
  publish_at TIMESTAMPTZ,                            -- for delayed: when to auto-publish
  reviewed_by TEXT,                                  -- consultant user ID
  reviewed_at TIMESTAMPTZ,

  -- Annotation
  bounding_box JSONB,                                -- {x, y, width, height}
  screenshot_ref TEXT,                               -- FK to screenshots table

  -- Grounding metadata
  grounding_rules_passed TEXT[],                     -- ["GR-001", "GR-002", ...]
  critique_verdict TEXT,                             -- KEEP|REVISE|DOWNGRADE
  critique_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- §13.6 C1-FIX: Master architecture extensions to findings table (Phase 6+)
-- These columns are NULLABLE — Phase 1-5 implementations leave them NULL.
ALTER TABLE findings ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'atomic';
  -- atomic|page|template|workflow|audit (FindingScope)
ALTER TABLE findings ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES templates(id);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES workflows(id);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS state_ids TEXT[] DEFAULT '{}';
  -- references page_states.state_id values
ALTER TABLE findings ADD COLUMN IF NOT EXISTS parent_finding_ids UUID[] DEFAULT '{}';
  -- for rollup findings: IDs of child findings this was rolled up from
ALTER TABLE findings ADD COLUMN IF NOT EXISTS polarity TEXT DEFAULT 'violation';
  -- violation|positive (positive findings optional, off by default)
ALTER TABLE findings ADD COLUMN IF NOT EXISTS business_impact FLOAT;
  -- deterministic: IMPACT_MATRIX[page_type][funnel_position][business_model] * (severity/4)
ALTER TABLE findings ADD COLUMN IF NOT EXISTS effort FLOAT;
  -- deterministic: EFFORT_MAP[heuristic.effort_category]
ALTER TABLE findings ADD COLUMN IF NOT EXISTS priority FLOAT;
  -- derived: (severity*2) + (business_impact*1.5) + (confidence*1) - (effort*0.5)

-- §33 Integration Columns (Phase 11+, all NULLABLE with defaults):
ALTER TABLE findings ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL;
  -- 'open_observation' for Pass 2 findings, NULL for standard heuristic findings
ALTER TABLE findings ADD COLUMN IF NOT EXISTS analysis_scope TEXT DEFAULT 'global';
  -- 'global' | 'per_state' | 'transition' (from §31 absorbed by §33)
ALTER TABLE findings ADD COLUMN IF NOT EXISTS interaction_evidence JSONB DEFAULT NULL;
  -- serialized InteractionRecord[] for findings produced during interactive evaluation;
  -- stored alongside the finding for consultant traceability

CREATE INDEX IF NOT EXISTS idx_findings_scope ON findings(scope);
CREATE INDEX IF NOT EXISTS idx_findings_template ON findings(template_id);
CREATE INDEX IF NOT EXISTS idx_findings_workflow ON findings(workflow_id);
CREATE INDEX IF NOT EXISTS idx_findings_priority ON findings(client_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_findings_polarity ON findings(polarity);

-- Finding edits (consultant modifications — original preserved)
CREATE TABLE finding_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id),
  edited_by TEXT NOT NULL,
  changes JSONB NOT NULL,                            -- {description?, recommendation?, severity?}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rejected findings (for system improvement tracking)
CREATE TABLE rejected_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  page_url TEXT NOT NULL,
  heuristic_id TEXT NOT NULL,
  finding_content JSONB NOT NULL,                    -- full finding JSON
  rejection_stage TEXT NOT NULL,                     -- critique|ground|consultant
  rejection_reason TEXT NOT NULL,
  rejected_by_rule TEXT,                             -- GR-001, GR-002, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comparison findings (client vs competitor)
CREATE TABLE comparison_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  dimension TEXT NOT NULL,
  client_page_url TEXT NOT NULL,
  client_page_type TEXT,
  competitor_domain TEXT NOT NULL,
  competitor_page_url TEXT NOT NULL,
  competitor_page_type TEXT,
  client_observation TEXT NOT NULL,
  competitor_observation TEXT NOT NULL,
  assessment TEXT NOT NULL,
  recommendation TEXT,
  evidence JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consistency findings (cross-page within same site)
CREATE TABLE consistency_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  dimension TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_pages JSONB NOT NULL,                     -- [{url, observation}]
  recommendation TEXT,
  severity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Screenshot Tables

```sql
CREATE TABLE screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  page_url TEXT NOT NULL,
  type TEXT NOT NULL,                                -- viewport_clean|viewport_annotated|fullpage_clean|fullpage_annotated
  storage_key TEXT NOT NULL,                         -- R2 key or local path
  storage_url TEXT,                                  -- public URL (R2 CDN)
  width INTEGER,
  height INTEGER,
  file_size INTEGER,                                 -- bytes
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Browser Agent Tables (from v3.1)

```sql
-- Session tracking
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  audit_run_id UUID REFERENCES audit_runs(id),
  task TEXT NOT NULL,
  start_url TEXT NOT NULL,
  status TEXT NOT NULL,
  steps INTEGER,
  confidence FLOAT,
  cost_usd FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Selector memory (pgvector)
CREATE TABLE domain_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  action_type TEXT NOT NULL,
  selector TEXT NOT NULL,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  embedding vector(1536),
  last_validated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mode A workflow recipes
CREATE TABLE workflow_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  task_pattern TEXT NOT NULL,
  task_embedding vector(1536),
  steps JSONB NOT NULL,
  success_rate FLOAT DEFAULT 0.0,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safety audit log
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

## 13.2 Row-Level Security

**REQ-DATA-002:**

```sql
-- Enable RLS on all client-scoped tables
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE consistency_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejected_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_edits ENABLE ROW LEVEL SECURITY;

-- Policy: each table filtered by client_id from session variable
CREATE POLICY client_isolation ON findings
  USING (client_id = current_setting('app.client_id')::UUID);
-- ... same pattern for all tables above
```

## 13.3 Indexes

```sql
CREATE INDEX idx_findings_audit_run ON findings(audit_run_id);
CREATE INDEX idx_findings_client_severity ON findings(client_id, severity);
CREATE INDEX idx_findings_client_status ON findings(client_id, publish_status);
CREATE INDEX idx_findings_heuristic ON findings(heuristic_id);
CREATE INDEX idx_audit_runs_client ON audit_runs(client_id, version DESC);
CREATE INDEX idx_screenshots_audit ON screenshots(audit_run_id);
CREATE INDEX idx_domain_patterns_domain ON domain_patterns(domain, action_type);
```

## 13.4 Screenshot Storage (Cloudflare R2)

**REQ-DATA-003:**

### Storage Key Convention

```
{client_id}/{audit_run_id}/{page_url_hash}/{type}.jpg

Example:
a1b2c3d4/e5f6g7h8/homepage_abc123/viewport_clean.jpg
a1b2c3d4/e5f6g7h8/homepage_abc123/viewport_annotated.jpg
a1b2c3d4/e5f6g7h8/homepage_abc123/fullpage_clean.jpg
a1b2c3d4/e5f6g7h8/homepage_abc123/fullpage_annotated.jpg
```

### 4 Images Per Page

| Type | Content | Typical Size |
|------|---------|-------------|
| `viewport_clean` | What user sees first (no annotations) | ~100-200KB |
| `viewport_annotated` | Viewport with finding pins overlaid | ~150-250KB |
| `fullpage_clean` | Entire scrollable page (no annotations) | ~500KB-2MB |
| `fullpage_annotated` | Full page with finding pins overlaid | ~600KB-2.5MB |

### Storage Interface

```typescript
interface ScreenshotStorage {
  save(image: Buffer, key: string): Promise<string>;   // returns URL
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}
```

## 13.5 Drizzle ORM Schema

**REQ-DATA-004:** All tables defined as Drizzle schemas in `packages/agent-core/src/db/schema.ts`.

```typescript
import { pgTable, uuid, text, integer, float, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { vector } from "pgvector/drizzle-orm";

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  sector: text("sector"),
  industry: text("industry"),
  businessType: text("business_type").notNull().default("ecommerce"),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const auditRuns = pgTable("audit_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  version: integer("version").notNull(),
  status: text("status").notNull().default("pending"),
  rootUrl: text("root_url").notNull(),
  // ... remaining columns
});

// ... remaining table definitions following same pattern
```

---

## 13.6 Master Architecture Extensions — New Tables (Phase 6+)

**Status:** 15 new tables required by the locked master architecture. Phase 1-5 (MVP) implementations may leave most empty; Phase 6+ implementations populate them. All tables follow the same conventions as §13.1: UUID PKs, TIMESTAMPTZ, JSONB for flexible data, RLS on client-scoped tables.

**REQ-DATA-EXT-001:** Migrations for §13.6 SHALL be additive. No §13.1 table is renamed, dropped, or has columns removed. New columns on existing tables (if any) are nullable with sane defaults.

**REQ-DATA-EXT-002:** Every client-scoped §13.6 table SHALL enable RLS with the same policy pattern as §13.2.

### 13.6.0 Heuristic Catalog (F5 — Phase 3+, C1-L2-FIX)

```sql
-- Phase 3+: Heuristic catalog with vector retrieval support
-- Replaces the encrypted JSON bundle as the runtime heuristic store
-- See §22.5 for full retrieval pipeline details
CREATE TABLE heuristic_catalog (
  id TEXT PRIMARY KEY,                           -- e.g., BAY-CHECKOUT-001
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',          -- active|deprecated|experimental
  source TEXT NOT NULL,                           -- baymard|nielsen|cialdini|research|learned|client
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  content_json JSONB NOT NULL,                   -- full HeuristicExtended JSON (encrypted at app level before INSERT)
  embedding vector NOT NULL,                     -- pgvector; dimension from embedding model (M2-FIX: unconstrained)
  embedding_model TEXT NOT NULL,                 -- which model produced this embedding
  embedding_dimension INTEGER NOT NULL,          -- e.g., 1536
  tags TEXT[] NOT NULL DEFAULT '{}',
  page_types TEXT[] NOT NULL,
  business_types TEXT[],
  brand_traits TEXT[],
  funnel_positions TEXT[],
  reliability_tier INTEGER NOT NULL,
  rule_vs_guidance TEXT NOT NULL,                 -- rule|guidance
  business_impact_weight FLOAT NOT NULL,
  effort_category TEXT NOT NULL,
  has_rule_detector BOOLEAN NOT NULL DEFAULT false,
  preferred_states JSONB,                        -- StatePattern[] JSON
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deprecated_at TIMESTAMPTZ
);

CREATE INDEX idx_catalog_page_types ON heuristic_catalog USING GIN(page_types);
CREATE INDEX idx_catalog_business ON heuristic_catalog USING GIN(business_types);
CREATE INDEX idx_catalog_status ON heuristic_catalog(status);
CREATE INDEX idx_catalog_tier ON heuristic_catalog(reliability_tier);
CREATE INDEX idx_catalog_rule ON heuristic_catalog(rule_vs_guidance);
-- IVFFlat index: lists parameter should scale with sqrt(num_heuristics)
-- At 5,000 heuristics: lists = ~70. At 50,000: lists = ~224.
CREATE INDEX idx_catalog_embedding ON heuristic_catalog
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 70);
```

**REQ-DATA-EXT-000a:** `heuristic_catalog` does NOT have RLS — heuristics are global, not client-scoped. IP protection is enforced at the application layer: `content_json` is encrypted before INSERT, decrypted in memory only, never returned in API responses.

**REQ-DATA-EXT-000b:** Phase 1-2 implementations do NOT use this table (they use the encrypted JSON bundle). Phase 3 migration populates this table from the bundle. Both can coexist during transition.

### 13.6.1 Discovery & Templates (F2)

```sql
-- Template clusters discovered per audit run
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  url_pattern TEXT,                              -- e.g., "/product/{slug}"
  structural_hash TEXT NOT NULL,                 -- minhash fingerprint
  classified_type TEXT NOT NULL,                 -- homepage|product|checkout|...
  classification_source TEXT NOT NULL,           -- rule|llm_fallback
  classification_confidence FLOAT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  representative_urls TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_audit ON templates(audit_run_id);
CREATE INDEX idx_templates_client ON templates(client_id);
CREATE INDEX idx_templates_type ON templates(classified_type);

-- Many-to-many: which pages belong to which templates
CREATE TABLE template_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  is_representative BOOLEAN NOT NULL DEFAULT false,
  similarity_score FLOAT,                        -- distance from cluster center
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- M8-FIX: removed UNIQUE(template_id, page_url) to allow soft clustering
  -- where a page could belong to >1 template with different similarity scores.
  -- Primary template assignment is the one with highest similarity_score.
  primary_assignment BOOLEAN NOT NULL DEFAULT true  -- M8-FIX: only one primary per page
);

-- M8-FIX: ensure exactly one primary assignment per page across all templates in an audit
-- Enforced at application level — DB constraint is advisory via partial unique index:
CREATE UNIQUE INDEX idx_template_members_primary ON template_members(page_url)
  WHERE primary_assignment = true;

CREATE INDEX idx_template_members_template ON template_members(template_id);
CREATE INDEX idx_template_members_url ON template_members(page_url);
```

### 13.6.2 Workflows (F4)

```sql
-- Funnel definitions (synthesised or consultant-configured)
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,                            -- e.g., "ecommerce-checkout"
  business_model TEXT NOT NULL,
  expected_steps INTEGER NOT NULL,
  steps_traversed INTEGER NOT NULL DEFAULT 0,
  abandoned BOOLEAN NOT NULL DEFAULT false,
  abandon_reason TEXT,
  budget_usd FLOAT NOT NULL DEFAULT 3.0,
  budget_spent_usd FLOAT NOT NULL DEFAULT 0.0,
  source TEXT NOT NULL,                          -- auto_synthesised|consultant_configured
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflows_audit ON workflows(audit_run_id);
CREATE INDEX idx_workflows_client ON workflows(client_id);

-- Individual steps within a workflow
CREATE TABLE workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  page_url TEXT NOT NULL,
  page_type TEXT NOT NULL,
  funnel_position TEXT NOT NULL,                 -- entry|discovery|decision|intent|conversion|post_conversion
  entry_state_id TEXT,                           -- references page_states.state_id
  exit_state_id TEXT,
  transition_verify_result JSONB,
  traversal_success BOOLEAN NOT NULL DEFAULT false,
  step_findings_count INTEGER NOT NULL DEFAULT 0,
  step_cost_usd FLOAT NOT NULL DEFAULT 0.0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, step_index)
);

CREATE INDEX idx_workflow_steps_workflow ON workflow_steps(workflow_id);
```

### 13.6.3 State Exploration (F3)

```sql
-- Explored states per page (state graph nodes)
CREATE TABLE page_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  page_url TEXT NOT NULL,
  state_id TEXT NOT NULL,                        -- hash(url + interaction_path)
  parent_state_id TEXT,                          -- null for default state
  is_default_state BOOLEAN NOT NULL DEFAULT false,
  interaction_path JSONB NOT NULL DEFAULT '[]',  -- [] for default state
  discovered_in_pass TEXT NOT NULL,              -- pass_1_heuristic_primed|pass_2_bounded_exhaustive
  dom_hash TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  perception JSONB NOT NULL,                     -- AnalyzePerception
  viewport_screenshot_key TEXT,                  -- R2 key
  fullpage_screenshot_key TEXT,                  -- R2 key
  trigger JSONB,                                 -- ExplorationTriggerRecord
  meaningful BOOLEAN NOT NULL DEFAULT true,
  exploration_cost_usd FLOAT NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audit_run_id, state_id)
);

CREATE INDEX idx_page_states_audit ON page_states(audit_run_id);
CREATE INDEX idx_page_states_url ON page_states(audit_run_id, page_url);
CREATE INDEX idx_page_states_client ON page_states(client_id);

-- Transitions between states (state graph edges)
CREATE TABLE state_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  from_state_id TEXT NOT NULL,
  to_state_id TEXT NOT NULL,
  interaction JSONB NOT NULL,                    -- Interaction object
  verify_result JSONB,
  success BOOLEAN NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_state_interactions_audit ON state_interactions(audit_run_id);
CREATE INDEX idx_state_interactions_from ON state_interactions(from_state_id);
```

### 13.6.4 Evidence (First-Class) (F6)

```sql
-- Typed evidence artifacts — every finding links to evidence
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  page_url TEXT NOT NULL,
  state_id TEXT,                                 -- references page_states.state_id
  template_id UUID REFERENCES templates(id),
  workflow_id UUID REFERENCES workflows(id),

  type TEXT NOT NULL,
    -- dom_element|computed_style|screenshot_region|text_content|
    -- interaction_outcome|network_event|metric|state_transition
  payload JSONB NOT NULL,                        -- typed by `type`

  captured_at BIGINT NOT NULL,                   -- epoch ms
  capture_method TEXT NOT NULL,                  -- deterministic|agent_assisted

  screenshot_key TEXT,                           -- R2 key (clean)
  annotated_screenshot_key TEXT,                 -- R2 key (annotated)
  bounding_box JSONB,                            -- {x,y,width,height}
  element_ref TEXT,                              -- AX ref
  selector TEXT,                                 -- stable CSS selector

  interaction_path JSONB DEFAULT '[]',           -- empty for default state
  source_heuristic_request TEXT,                 -- heuristic_id that triggered capture

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidence_audit ON evidence(audit_run_id);
CREATE INDEX idx_evidence_client ON evidence(client_id);
CREATE INDEX idx_evidence_page ON evidence(page_url);
CREATE INDEX idx_evidence_type ON evidence(type);
CREATE INDEX idx_evidence_state ON evidence(state_id);
```

### 13.6.5 Finding Rollups (F6)

```sql
-- Parent/child relationships for finding rollups across scopes
CREATE TABLE finding_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  parent_finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  parent_scope TEXT NOT NULL,                    -- atomic|page|template|workflow|audit
  child_finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  rollup_reason TEXT NOT NULL,
    -- cross_state_merge|same_template|same_workflow|
    -- semantic_duplicate|cross_page_consistency
  merge_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_finding_id, child_finding_id)
);

CREATE INDEX idx_rollups_parent ON finding_rollups(parent_finding_id);
CREATE INDEX idx_rollups_child ON finding_rollups(child_finding_id);
CREATE INDEX idx_rollups_audit ON finding_rollups(audit_run_id);
```

### 13.6.6 Heuristic Overlays & Calibration (F5, F11)

```sql
-- Brand/client/learned overlays applied at runtime
CREATE TABLE heuristic_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_type TEXT NOT NULL,                    -- brand|client|learned
  scope_key TEXT NOT NULL,                       -- brand_trait|client_id|"global" for learned
  base_heuristic_id TEXT NOT NULL,
  version TEXT NOT NULL,
  overlay_json JSONB NOT NULL,                   -- partial heuristic fields to override
  created_by TEXT,                               -- consultant user id (for client overlays)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,                               -- S3-FIX: audit trail for edits
  updated_at TIMESTAMPTZ DEFAULT NOW(),          -- S3-FIX
  change_reason TEXT,                            -- S3-FIX: why was this overlay changed
  UNIQUE(overlay_type, scope_key, base_heuristic_id, version)
);

-- S3-FIX: auto-update updated_at
CREATE OR REPLACE FUNCTION update_overlay_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER overlay_updated_at
  BEFORE UPDATE ON heuristic_overlays
  FOR EACH ROW EXECUTE FUNCTION update_overlay_timestamp();

CREATE INDEX idx_overlays_type_scope ON heuristic_overlays(overlay_type, scope_key);
CREATE INDEX idx_overlays_base ON heuristic_overlays(base_heuristic_id);

-- Learned per-client calibration (Phase 4 — Learning Service)
CREATE TABLE heuristic_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  heuristic_id TEXT NOT NULL,
  reliability_delta FLOAT NOT NULL DEFAULT 0,    -- -0.5..+0.5
  severity_override TEXT,                        -- critical|high|medium|low|null
  suppress_below_confidence FLOAT,               -- 0..1|null
  approval_count INTEGER NOT NULL DEFAULT 0,
  rejection_count INTEGER NOT NULL DEFAULT 0,
  approval_rate FLOAT NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  last_calibrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, heuristic_id)
);

CREATE INDEX idx_calibration_client ON heuristic_calibration(client_id);
```

### 13.6.7 Reproducibility (F8)

```sql
-- Per-run version snapshot — pinned for audit defensibility
CREATE TABLE reproducibility_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL UNIQUE REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),

  -- Prompt versions (file hashes)
  prompt_evaluate_version TEXT NOT NULL,
  prompt_critique_version TEXT NOT NULL,
  prompt_comparison_version TEXT,
  prompt_workflow_version TEXT,

  -- Model versions
  evaluate_model TEXT NOT NULL,
  evaluate_temperature NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  critique_model TEXT NOT NULL,
  critique_temperature NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  vision_model TEXT,

  -- Heuristic set
  heuristic_base_version TEXT NOT NULL,
  overlay_chain_hash TEXT NOT NULL,
  heuristic_ids TEXT[] NOT NULL,

  -- Other versioned components
  normalizer_version TEXT NOT NULL,
  grounding_rule_set_version TEXT NOT NULL,
  discovery_config_version TEXT NOT NULL,
  state_exploration_policy_version TEXT NOT NULL,
  deterministic_scoring_version TEXT NOT NULL,

  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Immutable after first insert (C3-FIX: NUMERIC for reliable equality, admin escape hatch)
  CONSTRAINT reproducibility_temp_zero CHECK (
    evaluate_temperature = 0.00 AND critique_temperature = 0.00
  )
);

CREATE INDEX idx_reproducibility_audit ON reproducibility_snapshots(audit_run_id);
CREATE INDEX idx_reproducibility_client ON reproducibility_snapshots(client_id);

-- Role for emergency admin corrections (C3-FIX: escape hatch)
-- Only reo_snapshot_admin can update; all others blocked
CREATE ROLE reo_snapshot_admin NOLOGIN;

-- Trigger to enforce immutability with admin escape hatch
CREATE OR REPLACE FUNCTION prevent_reproducibility_update() RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN (SELECT rolname FROM pg_roles WHERE oid IN (
    SELECT member FROM pg_auth_members WHERE roleid = (
      SELECT oid FROM pg_roles WHERE rolname = 'reo_snapshot_admin'
    )
  )) THEN
    RETURN NEW;  -- admin override allowed
  END IF;
  RAISE EXCEPTION 'reproducibility_snapshots is immutable. Use reo_snapshot_admin role for emergency corrections.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reproducibility_immutable
  BEFORE UPDATE ON reproducibility_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_reproducibility_update();
```

### 13.6.8 Future Pipeline Contracts (F12 — Hypothesis Pipeline)

```sql
-- Reserved for Phase 14+ — hypothesis generation pipeline
CREATE TABLE hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  source_finding_ids UUID[] NOT NULL,            -- findings this hypothesis addresses
  title TEXT NOT NULL,
  statement TEXT NOT NULL,                       -- "If X then Y because Z"
  expected_signal TEXT NOT NULL,                 -- measurable outcome to watch
  confidence TEXT NOT NULL,                      -- high|medium|low
  status TEXT NOT NULL DEFAULT 'draft',          -- draft|approved|rejected|in_test|completed
  created_by TEXT,                               -- llm|consultant
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hypotheses_audit ON hypotheses(audit_run_id);
CREATE INDEX idx_hypotheses_client ON hypotheses(client_id);
CREATE INDEX idx_hypotheses_status ON hypotheses(status);

-- Test plans derived from hypotheses
CREATE TABLE test_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis_id UUID NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  primary_metric TEXT NOT NULL,
  secondary_metrics TEXT[],
  sample_size_target INTEGER,
  duration_days INTEGER,
  platform TEXT,                                 -- vwo|optimizely|google_optimize|internal
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_test_plans_hypothesis ON test_plans(hypothesis_id);
CREATE INDEX idx_test_plans_client ON test_plans(client_id);

-- Variation ideas (control + challenger designs)
CREATE TABLE variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id UUID NOT NULL REFERENCES test_plans(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  variant_name TEXT NOT NULL,                    -- control|challenger_1|challenger_2|...
  description TEXT NOT NULL,
  changes JSONB NOT NULL,                        -- structured diff from control
  mockup_asset_key TEXT,                         -- R2 key if a mockup was generated
  code_snippet TEXT,                             -- platform-specific variant code
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variations_test_plan ON variations(test_plan_id);
```

### 13.6.9 Analytics Bindings (F13)

```sql
-- DX integrations: GA4, Contentsquare, FullStory bindings per client
CREATE TABLE analytics_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  provider TEXT NOT NULL,                        -- ga4|contentsquare|fullstory|other
  property_id TEXT NOT NULL,                     -- GA4 property, CS site id, etc.
  credential_ref TEXT NOT NULL,                  -- secret manager reference; NEVER store creds here
  scopes TEXT[] NOT NULL,                        -- read:events, read:funnels, etc.
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,                         -- success|failure|partial
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, provider, property_id)
);

CREATE INDEX idx_analytics_client ON analytics_bindings(client_id);
CREATE INDEX idx_analytics_provider ON analytics_bindings(provider);

-- Ingested signals from DX providers (aggregated, not raw events)
CREATE TABLE analytics_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_id UUID NOT NULL REFERENCES analytics_bindings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  page_url TEXT,
  template_id UUID REFERENCES templates(id),
  workflow_id UUID REFERENCES workflows(id),
  signal_type TEXT NOT NULL,                     -- traffic|bounce|exit|frustration|rage_click|scroll_depth
  signal_value FLOAT NOT NULL,
  signal_unit TEXT NOT NULL,                     -- S2-L3-FIX: ratio|count|percentage|milliseconds
  confidence FLOAT NOT NULL,
  time_window_start TIMESTAMPTZ NOT NULL,
  time_window_end TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signals_client ON analytics_signals(client_id);
CREATE INDEX idx_signals_binding ON analytics_signals(binding_id);
CREATE INDEX idx_signals_page ON analytics_signals(page_url);
CREATE INDEX idx_signals_type ON analytics_signals(signal_type);
```

### 13.6.10 Trigger Gateway — Audit Request Log (F1)

```sql
-- Every audit request, normalized from any channel
CREATE TABLE audit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  audit_run_id UUID REFERENCES audit_runs(id),   -- nullable until run is created

  -- Provenance
  trigger_source TEXT NOT NULL,                  -- cli|mcp|consultant_dashboard|client_dashboard|scheduler
  trigger_user_id TEXT,                          -- clerk user id or api key id
  trigger_api_key_id TEXT,
  trigger_correlation_id TEXT,                   -- for cross-system tracing

  -- Request content
  root_url TEXT NOT NULL,
  scope_config JSONB NOT NULL,                   -- AuditRequest.scope
  budget_config JSONB NOT NULL,                  -- AuditRequest.budget
  heuristic_config JSONB NOT NULL,               -- AuditRequest.heuristic_set
  schedule_config JSONB,                         -- if from scheduler

  -- Outcome
  status TEXT NOT NULL DEFAULT 'received',       -- received|validated|rejected|queued|running|completed|failed
  rejection_reason TEXT,
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_requests_client ON audit_requests(client_id);
CREATE INDEX idx_audit_requests_source ON audit_requests(trigger_source);
CREATE INDEX idx_audit_requests_status ON audit_requests(status);
CREATE INDEX idx_audit_requests_run ON audit_requests(audit_run_id);
```

### 13.6.11 Two-Store Pattern — Published Projection (F7)

```sql
-- Published findings: projection over findings table
-- Starts as a view in Phase 1-5 MVP, becomes a materialized table in Phase 10+ for performance

CREATE VIEW published_findings AS
SELECT
  f.*,
  fr.parent_finding_id,
  fr.parent_scope
FROM findings f
LEFT JOIN finding_rollups fr ON fr.child_finding_id = f.id
WHERE f.publish_status = 'published'
  AND f.published_at IS NOT NULL
  AND f.published_at <= NOW();

-- RLS policy: client dashboard + MCP can ONLY query this view, never the raw findings table
CREATE POLICY published_findings_read ON findings
  FOR SELECT
  USING (
    current_setting('app.access_mode', true) = 'published_only'
    AND publish_status = 'published'
  );

-- Consultant context uses a separate access mode that bypasses this restriction
-- Set by the API layer: SET LOCAL app.access_mode = 'internal' | 'published_only';
```

**REQ-DATA-EXT-003:** The client dashboard API and the MCP server SHALL set `SET LOCAL app.access_mode = 'published_only'` on every database session. The consultant dashboard SHALL set `'internal'`. Access mode enforcement is layered on top of client_id RLS (§13.2).

**REQ-DATA-EXT-004:** The `published_findings` view SHALL be promoted to a materialized view in Phase 10+ if query latency exceeds 500ms p95 on 100k+ findings. Materialized view refresh cadence: on finding status change + hourly safety refresh.

**REQ-DATA-EXT-004a:** (M6-FIX) From Phase 6 onward, the API layer SHALL log p95 query latency on the `published_findings` view as a metric: `db.published_findings.query_p95_ms`. This provides Phase 10 with data to make the view → materialized view promotion decision.

### 13.6.12 Indexes & RLS Summary

**REQ-DATA-EXT-010:** Every §13.6 table with a `client_id` column SHALL have RLS enabled via the same policy pattern as §13.2:

```sql
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE heuristic_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE reproducibility_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_requests ENABLE ROW LEVEL SECURITY;

-- Standard policy applied to each:
CREATE POLICY client_isolation ON <table>
  USING (client_id = current_setting('app.client_id')::UUID);
```

**REQ-DATA-EXT-011:** `heuristic_overlays`, `state_interactions`, `template_members`, and `workflow_steps` do NOT have a direct `client_id` column. They inherit isolation via their parent table's RLS. Join-based queries are safe because the parent (`heuristic_overlays` is global; others join to RLS-protected parents).

**REQ-DATA-EXT-011a:** (M9-FIX) `evidence.state_id`, `workflow_steps.entry_state_id`, `workflow_steps.exit_state_id`, and `findings.state_ids[]` reference `page_states.state_id` as TEXT content hashes, NOT via foreign key constraints. This is deliberate loose coupling: state_ids are content-addressed hashes computed at runtime; strict FKs would require two-phase inserts (states before findings) that complicate transaction ordering during concurrent writes. Referential integrity is enforced at application level via REQ-STATE-EXT-INV-003/004. A scheduled consistency check job (Phase 13+) detects orphaned state_id references.

### 13.6.13 Drizzle Schema Stubs

```typescript
// packages/core/src/db/schema-extensions.ts
import { pgTable, uuid, text, integer, float, timestamp, jsonb, boolean, bigint } from "drizzle-orm/pg-core";
import { clients, auditRuns, findings } from "./schema";

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditRunId: uuid("audit_run_id").notNull().references(() => auditRuns.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  urlPattern: text("url_pattern"),
  structuralHash: text("structural_hash").notNull(),
  classifiedType: text("classified_type").notNull(),
  classificationSource: text("classification_source").notNull(),
  classificationConfidence: float("classification_confidence").notNull(),
  memberCount: integer("member_count").notNull().default(0),
  representativeUrls: text("representative_urls").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

// ... 14 more table stubs following the same pattern.
// Full stubs generated at Phase 6 implementation time; this section documents the
// table contracts. Drizzle definitions SHALL match the SQL DDL above exactly.
```

### 13.6.14 Migration Ordering

**REQ-DATA-EXT-020:** Migrations for §13.6 tables SHALL be applied in this order to respect foreign keys:

```
0. heuristic_catalog              (C1-L2-FIX: Phase 3+, no FKs, can be created independently)
1. templates
2. template_members
3. workflows
4. workflow_steps
5. page_states
6. state_interactions
7. evidence
8. finding_rollups                (depends on findings + templates + workflows)
9. heuristic_overlays
10. heuristic_calibration
11. reproducibility_snapshots
12. audit_requests                 (first — but depends on audit_runs which exists in §13.1)
13. hypotheses
14. test_plans
15. variations
16. analytics_bindings
17. analytics_signals
18. published_findings VIEW        (last — depends on findings + finding_rollups)
```

**REQ-DATA-EXT-021:** Each migration SHALL be reversible. Down migrations DROP the tables in reverse order.

---

**End of §13 — Data Layer (base §13.1-13.5 + master extensions §13.6)**
