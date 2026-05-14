/**
 * AC-15 — Phase 4 integration test (T080).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-15
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T080
 *
 * End-to-end flow (one happy-path traversal of every Phase 4 surface):
 *   1. Migrate a fresh DB (0001 + 0002 + 0003).
 *   2. Seed FK targets (clients + audit_runs).
 *   3. Write 1 audit_log row (T071 path).
 *   4. Write 3 audit_events rows (T072 path).
 *   5. 1 LLM call (success path) → llm_call_log outcome='ok'.
 *   6. 1 LLM call (budget exceeded) → llm_call_log outcome='budget_blocked'.
 *   7. 1 LLM call (failover after 3 retries) → llm_call_log outcome='unavailable'.
 *   8. 1 screenshot to LocalDisk (T075 path).
 *   9. Query findings table — empty (Phase 7 unimplemented).
 *  10. Assert all 15 tables queryable.
 *
 * Total wall-clock < 2 min (NF-Phase4-05 / R23 KC-extended).
 *
 * @AC-15 — Phase 4 acceptance gate.
 *
 * # LLM audit-run scoping note (T080 GREEN)
 *
 * AnthropicAdapter (T073) resolves `audit_runs` via `withClient(PLACEHOLDER_UUID)`
 * — the hardcoded scope means RLS only returns rows whose `client_id` equals
 * the all-zeroes UUID. To exercise the budget_blocked path the adapter must
 * find the audit_run; we therefore seed a SECOND audit_run owned by
 * PLACEHOLDER_CLIENT_ID for the LLM-call portion of the gate (line-level call
 * sites use `LLM_AUDIT_RUN_ID`). The audit_log + audit_events + findings paths
 * stay on the canonical (CLIENT_ID, AUDIT_RUN_ID) pair — they don't go through
 * the adapter's lookup.
 *
 * R11.4 note: this is a TEST-side scoping decision; production code is locked
 * at the T070-T076 + T067 cornerstone commits. The orchestration graph in
 * Phase 5+ will own setting RLS scope before invoking the adapter; until then
 * the placeholder fallback is the documented degrade-open behaviour.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnthropicAdapter } from '../../src/adapters/AnthropicAdapter.js';
import { LocalDiskStorage } from '../../src/adapters/LocalDiskStorage.js';
import { getDbClient, runMigrations } from '../../src/db/client.js';
import { AuditLogger } from '../../src/observability/AuditLogger.js';
import { SessionRecorder } from '../../src/observability/SessionRecorder.js';
import { MockAnthropicAdapter } from '../test-utils/mocks/MockAnthropicAdapter.js';

const PHASE4_WALL_CLOCK_MS = 120_000;

// Canonical Phase 4 scope — audit_log + audit_events + findings live here.
const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000F00';
const CLIENT_ID = '00000000-0000-4000-8000-000000000F01';

// AnthropicAdapter's hardcoded RLS lookup scope (PLACEHOLDER_UUID in T073).
// We seed a parallel audit_run owned by this placeholder so the budget_blocked
// path can be exercised end-to-end (the lookup degrades open when the audit_run
// row isn't visible to the placeholder RLS scope).
const PLACEHOLDER_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
const LLM_AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000F02';

const ALL_15_TABLES = [
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
  'audit_log',
  'rejected_findings',
  'finding_edits',
  'llm_call_log',
  'audit_events',
];

describe('Phase 4 integration — AC-15 acceptance gate', () => {
  let tempScreenshotDir: string;

  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-15: DATABASE_URL must be set; tests must NOT silently skip');
    }
    tempScreenshotDir = mkdtempSync(join(tmpdir(), 'phase4-screens-'));
    process.env.SCREENSHOTS_DIR = tempScreenshotDir;
    await runMigrations();

    // Seed FK targets. The raw `getDbClient()` runs as the connection's
    // configured Postgres user (superuser in dev), bypassing RLS — INSERTs
    // need no `app.client_id` setup. PostgresStorage.withClient is the
    // RLS-scoped path; tests don't need it for plain FK seeding.
    const db = getDbClient();
    await db.query(`INSERT INTO clients (id) VALUES ($1) ON CONFLICT DO NOTHING`, [CLIENT_ID]);
    await db.query(`INSERT INTO clients (id) VALUES ($1) ON CONFLICT DO NOTHING`, [
      PLACEHOLDER_CLIENT_ID,
    ]);
    await db.query(
      `INSERT INTO audit_runs (id, client_id, budget_remaining_usd) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [AUDIT_RUN_ID, CLIENT_ID, 1.0],
    );
    await db.query(
      `INSERT INTO audit_runs (id, client_id, budget_remaining_usd) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [LLM_AUDIT_RUN_ID, PLACEHOLDER_CLIENT_ID, 1.0],
    );
  }, PHASE4_WALL_CLOCK_MS);

  afterAll(async () => {
    const db = getDbClient();
    await db.end?.();
  });

  it(
    'AC-15: end-to-end Phase 4 acceptance gate',
    async () => {
      const db = getDbClient();
      const auditLogger = new AuditLogger();
      const sessionRecorder = new SessionRecorder();

      // 1) 1 audit_log row (T071 + AC-06).
      await auditLogger.log({
        audit_run_id: AUDIT_RUN_ID,
        client_id: CLIENT_ID,
        event: 'phase4_ac15_started',
        payload: {},
      });

      // 2) 3 audit_events rows (T072 + AC-07).
      //    Field is `event_type` per W1C AuditEventSchema (NOT `kind`);
      //    `page_url` is non-optional (nullable for audit-level events per
      //    §34.4 emit-by column); `metadata` (NOT `payload`) is the canonical
      //    JSONB column name.
      const events = [
        { event_type: 'audit_started' as const, page_url: null },
        { event_type: 'page_browse_started' as const, page_url: 'https://example.com/ac15' },
        { event_type: 'page_browse_completed' as const, page_url: 'https://example.com/ac15' },
      ];
      for (const ev of events) {
        await sessionRecorder.recordEvent({
          audit_run_id: AUDIT_RUN_ID,
          client_id: CLIENT_ID,
          event_type: ev.event_type,
          page_url: ev.page_url,
          metadata: {},
        });
      }

      // 3) LLM call — success path (T073 + AC-08).
      //    LLM_AUDIT_RUN_ID is owned by PLACEHOLDER_CLIENT_ID so the
      //    adapter's `withClient(PLACEHOLDER_UUID)` lookup finds it; the
      //    seeded budget (1.0) clears BudgetGate.check; mock returns ok.
      const okAdapter = new AnthropicAdapter({
        apiKey: 'mock-key',
        defaultModel: 'claude-sonnet-4-mock',
        transport: new MockAnthropicAdapter({ behaviour: 'ok' }),
        retryBackoffMs: 0,
      });
      await okAdapter.complete({
        operation: 'classify',
        audit_run_id: LLM_AUDIT_RUN_ID,
        userPrompt: 'ok-path',
        temperature: 0,
        maxTokens: 16,
      });

      // 4) LLM call — budget_blocked (T073 + AC-10).
      //    Drop the budget to 0; BudgetGate fires before the transport call.
      await db.query(`UPDATE audit_runs SET budget_remaining_usd = 0 WHERE id = $1`, [
        LLM_AUDIT_RUN_ID,
      ]);
      let budgetThrew = false;
      try {
        await okAdapter.complete({
          operation: 'classify',
          audit_run_id: LLM_AUDIT_RUN_ID,
          userPrompt: 'budget-blocked',
          temperature: 0,
          maxTokens: 1024,
        });
      } catch {
        budgetThrew = true;
      }
      expect(budgetThrew).toBe(true);

      // Restore budget for the failover call.
      await db.query(`UPDATE audit_runs SET budget_remaining_usd = 1.0 WHERE id = $1`, [
        LLM_AUDIT_RUN_ID,
      ]);

      // 5) LLM call — unavailable (T073 + AC-11).
      //    Mock throws synthetic 5xx every attempt; 1 initial + 3 retries =
      //    4 transport calls → LLMUnavailableError → outcome='unavailable'.
      const failoverAdapter = new AnthropicAdapter({
        apiKey: 'mock-key',
        defaultModel: 'claude-sonnet-4-mock',
        transport: new MockAnthropicAdapter({ behaviour: 'fail-5x' }),
        retryBackoffMs: 0,
      });
      let failoverThrew = false;
      try {
        await failoverAdapter.complete({
          operation: 'classify',
          audit_run_id: LLM_AUDIT_RUN_ID,
          userPrompt: 'unavailable',
          temperature: 0,
          maxTokens: 16,
        });
      } catch {
        failoverThrew = true;
      }
      expect(failoverThrew).toBe(true);

      // Verify the 3 outcomes recorded atomically in llm_call_log (R14.1).
      const r = await db.query<{ outcome: string }>(
        `SELECT outcome FROM llm_call_log WHERE audit_run_id = $1`,
        [LLM_AUDIT_RUN_ID],
      );
      const outcomes = r.rows.map((row) => row.outcome);
      expect(outcomes).toContain('ok');
      expect(outcomes).toContain('budget_blocked');
      expect(outcomes).toContain('unavailable');

      // 6) 1 screenshot to LocalDisk (T075 + AC-13).
      const screenshots = new LocalDiskStorage();
      await screenshots.put(Buffer.from('mock-jpeg'), {
        audit_run_id: AUDIT_RUN_ID,
        page_url: 'https://example.com/ac15',
      });

      // 7) findings table is empty for this audit_run (Phase 7 unimplemented).
      const findingsR = await db.query<{ id: string }>(
        `SELECT id FROM findings WHERE audit_run_id = $1`,
        [AUDIT_RUN_ID],
      );
      expect(findingsR.rows.length).toBe(0);

      // 8) all 15 tables queryable (T070 + AC-05 surface check).
      for (const table of ALL_15_TABLES) {
        await expect(db.query(`SELECT 1 FROM ${table} LIMIT 0`)).resolves.toBeDefined();
      }
    },
    PHASE4_WALL_CLOCK_MS,
  );
});
