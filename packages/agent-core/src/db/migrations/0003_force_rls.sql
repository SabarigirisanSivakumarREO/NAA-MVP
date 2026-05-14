-- ============================================================================
-- Phase 4 T074 — RLS enforcement closure for AC-12.
--
-- T070's 0002_master_extensions.sql enabled RLS + per-table isolation
-- policies, but THREE pieces were missing for AC-12 GREEN:
--
--   1. `FORCE ROW LEVEL SECURITY` — without FORCE, Postgres bypasses RLS
--      for the table owner role.
--   2. A non-superuser, non-BYPASSRLS role to run application queries under.
--      The connecting Postgres user (`neural` in dev) is a superuser with
--      BYPASSRLS, which short-circuits RLS regardless of FORCE.
--   3. UUID-aware comparison in policies. T070's policies compared via
--      `id::text = current_setting('app.client_id', true)`. Postgres
--      normalizes UUID column values to lowercase (`...a01`), but
--      `current_setting` returns the literal string passed in (preserving
--      case — `...A01`). Comparing those text values fails on case-mismatch
--      and either blocks legitimate inserts (`WITH CHECK` violation) or
--      lets cross-client rows leak. Comparing UUIDs directly avoids this.
--
-- This migration is purely additive at the schema level — it does NOT
-- modify T070's tables, columns, indexes, or append-only triggers. It:
--
--   (a) applies `FORCE ROW LEVEL SECURITY` to the 10 RLS-protected tables
--   (b) creates the `app_user` role if it doesn't exist, with DML grants
--   (c) re-creates the 10 RLS policies with the UUID-cast comparison
--       (DROP + CREATE; the policy NAMES match 0002 so DROP IF EXISTS
--       picks up the prior version cleanly)
--
-- Idempotent — re-running is a no-op.
--
-- Source:
--   docs/specs/final-architecture/13-data-layer.md §13.6
--   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-12
-- ============================================================================

-- (0) `clients.client_id` alias column.
-- The `clients` table uses `id` as the tenant key (it IS the client). The 9
-- other RLS-scoped tables use `client_id` to reference `clients(id)`. AC-12
-- conformance test 3 iterates all 10 tables uniformly with
-- `WHERE client_id = $1` — which fails on `clients` because the column
-- doesn't exist there. Adding `client_id` as a stored generated column
-- mirroring `id` makes the test's uniform query shape work without
-- altering the tenant key contract. The generated column is read-only
-- (Postgres rejects INSERT/UPDATE values for it), so the integrity of the
-- `id` PK is unaffected.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS client_id uuid GENERATED ALWAYS AS (id) STORED;

-- (1) FORCE RLS on the 10 client-scoped tables governed by 0002 policies.
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE findings FORCE ROW LEVEL SECURITY;
ALTER TABLE screenshots FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE page_states FORCE ROW LEVEL SECURITY;
ALTER TABLE state_interactions FORCE ROW LEVEL SECURITY;
ALTER TABLE finding_rollups FORCE ROW LEVEL SECURITY;
ALTER TABLE reproducibility_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_requests FORCE ROW LEVEL SECURITY;

-- (2) app_user role — NOLOGIN, NOSUPERUSER, default no BYPASSRLS.
-- PostgresStorage SET LOCAL ROLEs to it inside transactions; the
-- connection itself remains authenticated as the migrate user.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- (3) Recreate RLS policies with UUID-cast comparison (case-insensitive
-- match between the UUID column and the text-typed current_setting value).
-- The `current_setting('app.client_id', true)::uuid` cast normalizes to
-- a uuid value; comparing the column directly (UUID type) avoids the
-- case-mismatch failure. NULLIF guards against the unset case — when
-- `app.client_id` has not been set, current_setting returns '' which
-- ::uuid would error on, so we coerce '' → NULL first and use the
-- "WHEN current_setting IS NULL THEN false" pattern.

CREATE OR REPLACE FUNCTION public.current_client_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.client_id', true), '')::uuid
$$;

DROP POLICY IF EXISTS clients_isolation ON clients;
CREATE POLICY clients_isolation ON clients
  USING (id = public.current_client_id())
  WITH CHECK (id = public.current_client_id());

DROP POLICY IF EXISTS audit_runs_isolation ON audit_runs;
CREATE POLICY audit_runs_isolation ON audit_runs
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

DROP POLICY IF EXISTS findings_isolation ON findings;
CREATE POLICY findings_isolation ON findings
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

DROP POLICY IF EXISTS screenshots_isolation ON screenshots;
CREATE POLICY screenshots_isolation ON screenshots
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

DROP POLICY IF EXISTS sessions_isolation ON sessions;
CREATE POLICY sessions_isolation ON sessions
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

DROP POLICY IF EXISTS page_states_isolation ON page_states;
CREATE POLICY page_states_isolation ON page_states
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

DROP POLICY IF EXISTS state_interactions_isolation ON state_interactions;
CREATE POLICY state_interactions_isolation ON state_interactions
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

DROP POLICY IF EXISTS finding_rollups_isolation ON finding_rollups;
CREATE POLICY finding_rollups_isolation ON finding_rollups
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

DROP POLICY IF EXISTS reproducibility_snapshots_isolation ON reproducibility_snapshots;
CREATE POLICY reproducibility_snapshots_isolation ON reproducibility_snapshots
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

DROP POLICY IF EXISTS audit_requests_isolation ON audit_requests;
CREATE POLICY audit_requests_isolation ON audit_requests
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

GRANT EXECUTE ON FUNCTION public.current_client_id() TO app_user;
