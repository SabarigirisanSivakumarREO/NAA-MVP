-- ============================================================================
-- 0004_context_profiles.sql — Phase 4b T4B-012, context_profiles table.
--
-- Spec sources:
--   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-12 + R-12
--   docs/specs/mvp/phases/phase-4b-context-capture/impact.md §6 (CANONICAL
--     shape — 6 columns: id, audit_run_id, client_id, profile_hash CHAR(64),
--     profile_json JSONB, created_at TIMESTAMPTZ)
--   docs/specs/final-architecture/13-data-layer.md §13.6 context_profiles
--   docs/specs/final-architecture/37-context-capture-layer.md §37.2
--   docs/specs/mvp/constitution.md R7.4 (append-only enforcement)
--
-- Phase 4 T070 (0001/0002) reserved this slot via absence-assertion (AC-17);
-- T4B-012 lands the actual migration. The Drizzle schema mirror lives in
-- packages/agent-core/src/db/schema.ts (R10.4 — divergence = kill criterion).
--
-- Append-only enforcement: BEFORE UPDATE OR DELETE trigger reuses the
-- enforce_append_only() PL/pgSQL function defined in 0001_initial.sql.
-- No UPDATE / DELETE permitted (R7.4 + spec AC-12).
--
-- RLS: ENABLE + FORCE + isolation policy using current_client_id() function
-- defined in 0003_force_rls.sql (consistent with the other 10 RLS-scoped
-- tables). app_user role grants land via 0003's default privileges (already
-- run before this migration), so no separate GRANT is needed here.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DROP POLICY IF EXISTS + CREATE POLICY, DROP TRIGGER IF EXISTS + CREATE
-- TRIGGER. Safe to run multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- impact.md §6 — context_profiles table (append-only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS context_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id  UUID NOT NULL REFERENCES audit_runs(id),
  client_id     UUID NOT NULL REFERENCES clients(id),
  profile_hash  CHAR(64) NOT NULL,                          -- SHA-256 hex (R-03)
  profile_json  JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_context_profiles_audit ON context_profiles(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_context_profiles_client ON context_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_context_profiles_hash ON context_profiles(profile_hash);

-- ----------------------------------------------------------------------------
-- R7.4 — append-only enforcement via shared trigger function from 0001.
-- enforce_append_only() RAISES on UPDATE / DELETE; statement-level trigger.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS context_profiles_append_only ON context_profiles;
CREATE TRIGGER context_profiles_append_only
  BEFORE UPDATE OR DELETE ON context_profiles
  FOR EACH STATEMENT EXECUTE FUNCTION enforce_append_only();

-- ----------------------------------------------------------------------------
-- R7.2 — RLS: tenant isolation via current_client_id() (from 0003_force_rls).
-- FORCE so the table owner (migrate role) cannot bypass; the app_user role
-- (created in 0003) is the runtime role.
-- ----------------------------------------------------------------------------
ALTER TABLE context_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS context_profiles_isolation ON context_profiles;
CREATE POLICY context_profiles_isolation ON context_profiles
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

-- ----------------------------------------------------------------------------
-- Grants — context_profiles inherits app_user grants via 0003's
-- ALTER DEFAULT PRIVILEGES, but for idempotency on re-run AND to handle the
-- case where 0003 ran before this table existed, explicitly grant DML to
-- app_user here. (No-op if grants already exist.)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE context_profiles TO app_user';
  END IF;
END
$$;
