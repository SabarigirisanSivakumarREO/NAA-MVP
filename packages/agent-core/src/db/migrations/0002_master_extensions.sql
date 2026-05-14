-- ============================================================================
-- 0002_master_extensions.sql — Phase 4 T070, extensions migration (5 of 15)
--
-- Spec sources:
--   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-05, AC-12, AC-17
--   docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md
--   docs/specs/final-architecture/13-data-layer.md §13.6.3 / §13.6.5 /
--     §13.6.7 / §13.6.10 / §13.6.11 / §13.7
--   docs/specs/final-architecture/34-observability.md §34.4 (22 event types)
--
-- Idempotent: every CREATE / ALTER guarded by IF NOT EXISTS or DROP-then-CREATE.
--
-- Lands here:
--   5 extension tables: page_states, state_interactions, finding_rollups,
--                       reproducibility_snapshots, audit_requests
--   12 nullable column ALTERs on findings (Phase 6+ master-arch extensions)
--   RLS on all 10 client-scoped tables (AC-05, AC-12)
--   22-type CHECK constraint on audit_events.event_type (W1C-locked enum)
--   Composite indexes on audit_events (§34.4 + §13.7)
--   published_findings VIEW (§13.6.11)
--
-- AC-17: context_profiles table is INTENTIONALLY NOT created here. Phase 4b
-- T4B-012 owns that migration. T070 baseline reserves the slot.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- §13.6.3 page_states — explored state graph nodes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS page_states (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id              UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id                 UUID NOT NULL REFERENCES clients(id),
  page_url                  TEXT NOT NULL,
  state_id                  TEXT NOT NULL,
  parent_state_id           TEXT,
  is_default_state          BOOLEAN NOT NULL DEFAULT FALSE,
  interaction_path          JSONB NOT NULL DEFAULT '[]'::jsonb,
  discovered_in_pass        TEXT NOT NULL DEFAULT 'pass_1_heuristic_primed',
  dom_hash                  TEXT NOT NULL DEFAULT '',
  text_hash                 TEXT NOT NULL DEFAULT '',
  perception                JSONB NOT NULL DEFAULT '{}'::jsonb,
  viewport_screenshot_key   TEXT,
  fullpage_screenshot_key   TEXT,
  trigger                   JSONB,
  meaningful                BOOLEAN NOT NULL DEFAULT TRUE,
  exploration_cost_usd      NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_states_audit ON page_states(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_page_states_url ON page_states(audit_run_id, page_url);
CREATE INDEX IF NOT EXISTS idx_page_states_client ON page_states(client_id);

-- ----------------------------------------------------------------------------
-- §13.6.3 state_interactions — state-graph edges
-- Carries client_id for direct RLS (Phase 4 chose direct scoping over the
-- §13.6.3 v3 parent-derived approach; simpler + matches AC-12's 10-table list).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS state_interactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id    UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id),
  from_state_id   TEXT NOT NULL,
  to_state_id     TEXT NOT NULL,
  interaction     JSONB NOT NULL DEFAULT '{}'::jsonb,
  verify_result   JSONB,
  success         BOOLEAN NOT NULL DEFAULT FALSE,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_state_interactions_audit ON state_interactions(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_state_interactions_from ON state_interactions(from_state_id);

-- ----------------------------------------------------------------------------
-- §13.6.5 finding_rollups — parent/child finding relationships
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finding_rollups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id        UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES clients(id),
  parent_finding_id   UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  parent_scope        TEXT NOT NULL DEFAULT 'atomic',
  child_finding_id    UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  rollup_reason       TEXT NOT NULL,
  merge_count         INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rollups_parent ON finding_rollups(parent_finding_id);
CREATE INDEX IF NOT EXISTS idx_rollups_child ON finding_rollups(child_finding_id);
CREATE INDEX IF NOT EXISTS idx_rollups_audit ON finding_rollups(audit_run_id);

-- ----------------------------------------------------------------------------
-- §13.6.7 reproducibility_snapshots — pinned per audit (R10)
-- Phase 4 ships the schema; Phase 8 populates rows.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reproducibility_snapshots (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id                    UUID NOT NULL UNIQUE REFERENCES audit_runs(id) ON DELETE CASCADE,
  client_id                       UUID NOT NULL REFERENCES clients(id),
  prompt_evaluate_version         TEXT NOT NULL DEFAULT '0.0.0',
  prompt_critique_version         TEXT NOT NULL DEFAULT '0.0.0',
  prompt_comparison_version       TEXT,
  prompt_workflow_version         TEXT,
  evaluate_model                  TEXT NOT NULL DEFAULT 'claude-sonnet-4',
  evaluate_temperature            NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
  critique_model                  TEXT NOT NULL DEFAULT 'claude-sonnet-4',
  critique_temperature            NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
  vision_model                    TEXT,
  heuristic_base_version          TEXT NOT NULL DEFAULT '0.0.0',
  overlay_chain_hash              TEXT NOT NULL DEFAULT '',
  heuristic_ids                   TEXT[] NOT NULL DEFAULT '{}',
  normalizer_version              TEXT NOT NULL DEFAULT '0.0.0',
  grounding_rule_set_version      TEXT NOT NULL DEFAULT '0.0.0',
  discovery_config_version        TEXT NOT NULL DEFAULT '0.0.0',
  state_exploration_policy_version TEXT NOT NULL DEFAULT '0.0.0',
  deterministic_scoring_version   TEXT NOT NULL DEFAULT '0.0.0',
  captured_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reproducibility_temp_zero CHECK (
    evaluate_temperature = 0.00 AND critique_temperature = 0.00
  )
);
CREATE INDEX IF NOT EXISTS idx_reproducibility_audit ON reproducibility_snapshots(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_reproducibility_client ON reproducibility_snapshots(client_id);

-- ----------------------------------------------------------------------------
-- §13.6.10 audit_requests — gateway trigger log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_requests (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                 UUID NOT NULL REFERENCES clients(id),
  audit_run_id              UUID REFERENCES audit_runs(id),
  trigger_source            TEXT NOT NULL DEFAULT 'cli',
  trigger_user_id           TEXT,
  trigger_api_key_id        TEXT,
  trigger_correlation_id    TEXT,
  root_url                  TEXT NOT NULL,
  scope_config              JSONB NOT NULL DEFAULT '{}'::jsonb,
  budget_config             JSONB NOT NULL DEFAULT '{}'::jsonb,
  heuristic_config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule_config           JSONB,
  status                    TEXT NOT NULL DEFAULT 'received',
  rejection_reason          TEXT,
  queued_at                 TIMESTAMPTZ,
  started_at                TIMESTAMPTZ,
  completed_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_requests_client ON audit_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_requests_status ON audit_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_requests_run ON audit_requests(audit_run_id);

-- ============================================================================
-- ALTER findings — 12 nullable columns per tasks.md L239 (Phase 6+ ratchet)
-- All nullable; existing rows remain valid; Phase 1-5 leaves them NULL.
-- ============================================================================

ALTER TABLE findings ADD COLUMN IF NOT EXISTS scope                 TEXT;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS template_id           UUID;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS workflow_id           UUID;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS state_ids             TEXT[];
ALTER TABLE findings ADD COLUMN IF NOT EXISTS parent_finding_ids    UUID[];
ALTER TABLE findings ADD COLUMN IF NOT EXISTS polarity              TEXT;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS business_impact       NUMERIC(10, 4);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS effort                NUMERIC(10, 4);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS priority              NUMERIC(10, 4);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS source                TEXT;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS analysis_scope        TEXT;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS interaction_evidence  JSONB;

CREATE INDEX IF NOT EXISTS idx_findings_scope ON findings(scope);
CREATE INDEX IF NOT EXISTS idx_findings_polarity ON findings(polarity);

-- ============================================================================
-- audit_events: 22-type CHECK constraint + §34.4 composite indexes
-- ============================================================================

-- Drop-then-create so the CHECK can evolve alongside the W1C enum (the
-- 22 strings must mirror packages/agent-core/src/types/audit-events.ts).
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_event_type_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_event_type_check
  CHECK (event_type IN (
    'audit_started',
    'audit_completed',
    'audit_failed',
    'page_browse_started',
    'page_browse_completed',
    'page_browse_failed',
    'page_analyze_started',
    'page_analyze_completed',
    'page_analyze_skipped',
    'finding_produced',
    'finding_grounding_rejected',
    'finding_critique_rejected',
    'finding_published',
    'budget_warning',
    'budget_exceeded',
    'llm_call_completed',
    'llm_call_failed',
    'llm_provider_fallback',
    'perception_quality_low',
    'hitl_requested',
    'cross_page_analysis_completed',
    'overlay_dismissed'
  ));

CREATE INDEX IF NOT EXISTS idx_audit_events_audit ON audit_events(audit_run_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_events_client_type
  ON audit_events(client_id, event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_type_time
  ON audit_events(event_type, timestamp DESC);

-- ============================================================================
-- RLS — 10 client-scoped tables (AC-05 + AC-12). NOT applied to the 5
-- append-only tables: those use append-only triggers as their enforcement
-- (impact.md §F-02 closure).
-- Policy pattern: client_id::text = current_setting('app.client_id', true).
-- The `true` flag means "return NULL if unset", which makes RLS deny rows
-- when app.client_id has not been set (R7.2 default-deny).
-- ============================================================================

-- clients itself: row.id is the client_id surrogate.
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clients_isolation ON clients;
CREATE POLICY clients_isolation ON clients
  USING (id::text = current_setting('app.client_id', true));

ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_runs_isolation ON audit_runs;
CREATE POLICY audit_runs_isolation ON audit_runs
  USING (client_id::text = current_setting('app.client_id', true));

ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS findings_isolation ON findings;
CREATE POLICY findings_isolation ON findings
  USING (client_id::text = current_setting('app.client_id', true));

ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS screenshots_isolation ON screenshots;
CREATE POLICY screenshots_isolation ON screenshots
  USING (client_id::text = current_setting('app.client_id', true));

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sessions_isolation ON sessions;
CREATE POLICY sessions_isolation ON sessions
  USING (client_id::text = current_setting('app.client_id', true));

ALTER TABLE page_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS page_states_isolation ON page_states;
CREATE POLICY page_states_isolation ON page_states
  USING (client_id::text = current_setting('app.client_id', true));

ALTER TABLE state_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS state_interactions_isolation ON state_interactions;
CREATE POLICY state_interactions_isolation ON state_interactions
  USING (client_id::text = current_setting('app.client_id', true));

ALTER TABLE finding_rollups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finding_rollups_isolation ON finding_rollups;
CREATE POLICY finding_rollups_isolation ON finding_rollups
  USING (client_id::text = current_setting('app.client_id', true));

ALTER TABLE reproducibility_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reproducibility_snapshots_isolation ON reproducibility_snapshots;
CREATE POLICY reproducibility_snapshots_isolation ON reproducibility_snapshots
  USING (client_id::text = current_setting('app.client_id', true));

ALTER TABLE audit_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_requests_isolation ON audit_requests;
CREATE POLICY audit_requests_isolation ON audit_requests
  USING (client_id::text = current_setting('app.client_id', true));

-- ============================================================================
-- §13.6.11 published_findings VIEW — Two-Store published projection.
-- Phase 1-5 MVP serves this as a view; Phase 10+ may promote to materialized.
-- Drop-then-create for idempotent column-shape evolution.
-- ============================================================================

DROP VIEW IF EXISTS published_findings;
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
