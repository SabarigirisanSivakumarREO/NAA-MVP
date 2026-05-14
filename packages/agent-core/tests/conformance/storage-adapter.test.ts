/**
 * AC-12 — StorageAdapter conformance (Phase 4 T074).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-12 (v0.2 F-07)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T074
 *     (REQ-STORAGE-ADAPTER-001 + R7.2 RLS)
 *
 * AC-12 contract:
 *   - StorageAdapter (PostgresStorage impl) supports CRUD on the 10 RLS-protected
 *     client-scoped tables.
 *   - `SET LOCAL app.client_id = '<uuid>'` set at start of every transaction
 *     (NEVER per-statement).
 *   - Cross-client query (different `app.client_id`) returns empty for all 10 tables.
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Modules absent → import fails.
 *
 * Anchor: @AC-12 — RLS cross-client isolation across 10 tables.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// SUTs (don't exist yet — T074 lands these in Wave 2). Import fails → RED.
import { PostgresStorage } from '../../src/adapters/PostgresStorage.js';
import { getDbClient, runMigrations } from '../../src/db/client.js';

const CLIENT_A = '00000000-0000-4000-8000-000000000A01';
const CLIENT_B = '00000000-0000-4000-8000-000000000B01';

describe('StorageAdapter — AC-12 conformance (RED until T074)', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-12: DATABASE_URL must be set; tests must NOT silently skip');
    }
    await runMigrations();
  });

  afterAll(async () => {
    const db = getDbClient();
    await db.end?.();
  });

  it('AC-12: PostgresStorage exposes withClient(client_id, fn) that sets app.client_id', async () => {
    const storage = new PostgresStorage();
    await storage.withClient(CLIENT_A, async (tx) => {
      const r = await tx.query<{ current_setting: string }>(
        `SELECT current_setting('app.client_id', true) AS current_setting`,
      );
      expect(r.rows[0]?.current_setting).toBe(CLIENT_A);
    });
  });

  it('AC-12: insert a client + audit_run under CLIENT_A, then a CLIENT_B query returns 0 rows (RLS)', async () => {
    const storage = new PostgresStorage();
    const auditRunId = '00000000-0000-4000-8000-000000000A02';
    await storage.withClient(CLIENT_A, async (tx) => {
      await tx.query(`INSERT INTO clients (id) VALUES ($1) ON CONFLICT DO NOTHING`, [CLIENT_A]);
      await tx.query(
        `INSERT INTO audit_runs (id, client_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [auditRunId, CLIENT_A],
      );
    });
    await storage.withClient(CLIENT_B, async (tx) => {
      const r = await tx.query<{ id: string }>(`SELECT id FROM audit_runs WHERE id = $1`, [
        auditRunId,
      ]);
      expect(r.rows.length).toBe(0);
    });
  });

  it('AC-12: each of the 10 client-scoped tables enforces RLS (cross-client SELECT empty)', async () => {
    const tables = [
      'clients',
      'audit_runs',
      'findings',
      'screenshots',
      'sessions',
      'page_states',
      'state_interactions',
      'finding_rollups',
      'reproducibility_snapshots',
      'audit_requests',
    ];
    const storage = new PostgresStorage();
    for (const table of tables) {
      await storage.withClient(CLIENT_B, async (tx) => {
        // Even if rows exist for CLIENT_A, CLIENT_B must see none.
        const r = await tx.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM ${table} WHERE client_id = $1`,
          [CLIENT_A],
        );
        expect(Number(r.rows[0]?.count ?? '0')).toBe(0);
      });
    }
  });
});
