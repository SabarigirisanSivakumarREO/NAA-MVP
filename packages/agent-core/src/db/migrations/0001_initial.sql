-- ============================================================================
-- 0001_initial.sql — Phase 4 T070, base migration (10 of 15 tables)
--
-- Spec sources:
--   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-05
--   docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md (canonical for
--     column shapes; supersedes §13.7 where divergent — see llm_call_log)
--   docs/specs/final-architecture/13-data-layer.md §13.1-§13.5, §13.7
--   docs/specs/final-architecture/34-observability.md §34.4 (22 event types)
--
-- Idempotent: every CREATE uses IF NOT EXISTS / OR REPLACE. Safe to run 2x.
--
-- Tables created here (10 of 15):
--   client-scoped (5):  clients, audit_runs, findings, screenshots, sessions
--   append-only (5):    audit_log, rejected_findings, finding_edits,
--                       llm_call_log, audit_events
-- Plus: enforce_append_only() trigger function + 5 BEFORE UPDATE OR DELETE
--       triggers binding it to the 5 append-only tables.
--
-- Extensions (page_states, state_interactions, finding_rollups,
-- reproducibility_snapshots, audit_requests) + RLS policies + ALTER on
-- findings + 22-type CHECK + published_findings VIEW are in 0002.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- §13.1 clients — root tenant (RLS scope target)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,
  domain        TEXT,
  sector        TEXT,
  industry      TEXT,
  business_type TEXT NOT NULL DEFAULT 'ecommerce',
  config        JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- §13.1 audit_runs — top-level pipeline invocation (R8.1 budget tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(id),
  version               INTEGER NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'pending',
  root_url              TEXT,
  crawl_scope           TEXT NOT NULL DEFAULT 'domain',
  heuristic_set         TEXT NOT NULL DEFAULT 'default',
  pages_total           INTEGER NOT NULL DEFAULT 0,
  pages_crawled         INTEGER NOT NULL DEFAULT 0,
  pages_failed          INTEGER NOT NULL DEFAULT 0,
  findings_count        INTEGER NOT NULL DEFAULT 0,
  findings_published    INTEGER NOT NULL DEFAULT 0,
  findings_held         INTEGER NOT NULL DEFAULT 0,
  findings_rejected     INTEGER NOT NULL DEFAULT 0,
  total_cost_usd        NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
  budget_remaining_usd  NUMERIC(10, 6) NOT NULL DEFAULT 15.0,
  completion_reason     TEXT,
  competitor_urls       TEXT[],
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_runs_client ON audit_runs(client_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- §13.1 findings — base; 0002 ALTERs 12 nullable cols + sets up published view
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS findings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id            UUID NOT NULL REFERENCES audit_runs(id),
  client_id               UUID NOT NULL REFERENCES clients(id),
  page_url                TEXT NOT NULL,
  page_type               TEXT,
  heuristic_id            TEXT NOT NULL,
  heuristic_source        TEXT NOT NULL,
  category                TEXT NOT NULL,
  status                  TEXT NOT NULL,
  severity                TEXT NOT NULL,
  name                    TEXT NOT NULL,
  observation             TEXT NOT NULL,
  assessment              TEXT NOT NULL,
  evidence                JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation          TEXT,
  confidence_tier         TEXT NOT NULL,
  confidence_basis        TEXT,
  needs_review            BOOLEAN NOT NULL DEFAULT FALSE,
  publish_status          TEXT NOT NULL DEFAULT 'held',
  published_at            TIMESTAMPTZ,
  publish_at              TIMESTAMPTZ,
  reviewed_by             TEXT,
  reviewed_at             TIMESTAMPTZ,
  bounding_box            JSONB,
  screenshot_ref          TEXT,
  grounding_rules_passed  TEXT[],
  critique_verdict        TEXT,
  critique_reason         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_findings_audit_run ON findings(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_findings_client_severity ON findings(client_id, severity);
CREATE INDEX IF NOT EXISTS idx_findings_client_status ON findings(client_id, publish_status);
CREATE INDEX IF NOT EXISTS idx_findings_heuristic ON findings(heuristic_id);

-- ----------------------------------------------------------------------------
-- §13.1 screenshots — image metadata; bytes live in R2 / LocalDiskStorage
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS screenshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id  UUID NOT NULL REFERENCES audit_runs(id),
  client_id     UUID NOT NULL REFERENCES clients(id),
  page_url      TEXT NOT NULL,
  type          TEXT NOT NULL,
  storage_key   TEXT NOT NULL,
  storage_url   TEXT,
  width         INTEGER,
  height        INTEGER,
  file_size     INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_screenshots_audit ON screenshots(audit_run_id);

-- ----------------------------------------------------------------------------
-- §13.1 sessions — browser session lifecycle (Phase 2+ BrowserManager)
-- Note: spec calls this "Browser Agent Tables" but Phase 4 owns the schema.
-- Added client_id for RLS scope (consistent with the other 9 client-scoped
-- tables; original §13.1 shape omitted it).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id  UUID REFERENCES audit_runs(id),
  client_id     UUID NOT NULL REFERENCES clients(id),
  task          TEXT,
  start_url     TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  steps         INTEGER NOT NULL DEFAULT 0,
  confidence    NUMERIC(3, 2),
  cost_usd      NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_audit ON sessions(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id);

-- ============================================================================
-- APPEND-ONLY tables (R7.4) — UPDATE/DELETE blocked by trigger below
-- ============================================================================

-- ----------------------------------------------------------------------------
-- audit_log — AC-06 contract (T071 AuditLogger.log writes here)
-- Test inserts (audit_run_id, client_id, event, payload) and queries by event;
-- shape diverges from §13.1 v3.1 sessions-scoped audit_log (that was for the
-- v3.1 browser-agent variant — Phase 4 owns the canonical shape).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id  UUID NOT NULL REFERENCES audit_runs(id),
  client_id     UUID NOT NULL REFERENCES clients(id),
  event         TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_audit_run ON audit_log(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event);

-- ----------------------------------------------------------------------------
-- rejected_findings — findings that failed grounding / self-critique
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rejected_findings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id      UUID NOT NULL REFERENCES audit_runs(id),
  client_id         UUID NOT NULL REFERENCES clients(id),
  page_url          TEXT NOT NULL,
  heuristic_id      TEXT NOT NULL,
  finding_content   JSONB NOT NULL,
  rejection_stage   TEXT NOT NULL,
  rejection_reason  TEXT NOT NULL,
  rejected_by_rule  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rejected_findings_audit ON rejected_findings(audit_run_id);

-- ----------------------------------------------------------------------------
-- finding_edits — consultant edit history (immutable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finding_edits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id  UUID NOT NULL REFERENCES findings(id),
  edited_by   TEXT NOT NULL,
  changes     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finding_edits_finding ON finding_edits(finding_id);

-- ----------------------------------------------------------------------------
-- llm_call_log — R14.1 atomic LLM call log
-- CANONICAL SHAPE: impact.md §LLMCallRecord (NOT §13.7). W1C's LLMCallRecord
-- Zod schema is the authoritative source — this table mirrors it exactly.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS llm_call_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id        UUID NOT NULL REFERENCES audit_runs(id),
  client_id           UUID NOT NULL REFERENCES clients(id),
  operation           TEXT NOT NULL,
  model               TEXT NOT NULL,
  prompt_tokens       INTEGER NOT NULL,
  completion_tokens   INTEGER NOT NULL,
  cost_usd            NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
  duration_ms         INTEGER NOT NULL,
  cache_hit           BOOLEAN NOT NULL DEFAULT FALSE,
  outcome             TEXT NOT NULL,
  error_class         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_call_log_audit ON llm_call_log(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_llm_call_log_outcome ON llm_call_log(outcome);
CREATE INDEX IF NOT EXISTS idx_llm_call_log_created ON llm_call_log(created_at DESC);

-- ----------------------------------------------------------------------------
-- audit_events — 22-type event stream (§34.4); CHECK + composite indexes in 0002
-- CANONICAL SHAPE: W1C AuditEvent (id, audit_run_id, client_id, event_type,
-- page_url, metadata, timestamp).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id  UUID NOT NULL REFERENCES audit_runs(id),
  client_id     UUID NOT NULL REFERENCES clients(id),
  event_type    TEXT NOT NULL,
  page_url      TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Append-only enforcement (R7.4) — DB-level trigger function + 5 triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only violation: % not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- One trigger per append-only table. DROP IF EXISTS for idempotency.
DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION enforce_append_only();

DROP TRIGGER IF EXISTS rejected_findings_append_only ON rejected_findings;
CREATE TRIGGER rejected_findings_append_only
  BEFORE UPDATE OR DELETE ON rejected_findings
  FOR EACH STATEMENT EXECUTE FUNCTION enforce_append_only();

DROP TRIGGER IF EXISTS finding_edits_append_only ON finding_edits;
CREATE TRIGGER finding_edits_append_only
  BEFORE UPDATE OR DELETE ON finding_edits
  FOR EACH STATEMENT EXECUTE FUNCTION enforce_append_only();

DROP TRIGGER IF EXISTS llm_call_log_append_only ON llm_call_log;
CREATE TRIGGER llm_call_log_append_only
  BEFORE UPDATE OR DELETE ON llm_call_log
  FOR EACH STATEMENT EXECUTE FUNCTION enforce_append_only();

DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION enforce_append_only();
