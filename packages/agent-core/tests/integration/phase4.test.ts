/**
 * AC-15 — Phase 4 integration test (T080).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-15
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T080
 *
 * End-to-end flow:
 *   1. Migrate a fresh DB.
 *   2. Write 1 audit_log row + 3 audit_events rows.
 *   3. 1 LLM call (success path).
 *   4. 1 LLM call (budget exceeded — verifies log row with outcome='budget_blocked').
 *   5. 1 LLM call (failover after 3 retries — verifies log row with outcome='unavailable').
 *   6. 1 screenshot to LocalDisk.
 *   7. Query findings table — empty (no findings produced this phase).
 *   8. All 15 tables queryable.
 *
 * Total wall-clock < 2 min (NF-Phase4-05).
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). SUT modules don't exist →
 * import fails. Wave 2-7 will green the test.
 *
 * Anchor: @AC-15 — Phase 4 acceptance gate.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// SUTs (don't exist yet — Wave 2-7 lands them). Import fails → RED.
import { AnthropicAdapter } from '../../src/adapters/AnthropicAdapter.js';
import { LocalDiskStorage } from '../../src/adapters/LocalDiskStorage.js';
import { getDbClient, runMigrations } from '../../src/db/client.js';
import { AuditLogger } from '../../src/observability/AuditLogger.js';
import { SessionRecorder } from '../../src/observability/SessionRecorder.js';
import { MockAnthropicAdapter } from '../test-utils/mocks/MockAnthropicAdapter.js';

const PHASE4_WALL_CLOCK_MS = 120_000;

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000F00';
const CLIENT_ID = '00000000-0000-4000-8000-000000000F01';

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

describe('Phase 4 integration — AC-15 acceptance gate (RED until T080)', () => {
  let tempScreenshotDir: string;

  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-15: DATABASE_URL must be set; tests must NOT silently skip');
    }
    tempScreenshotDir = mkdtempSync(join(tmpdir(), 'phase4-screens-'));
    process.env.SCREENSHOTS_DIR = tempScreenshotDir;
    await runMigrations();
    // Seed client + audit_run for FK targets.
    const db = getDbClient();
    await db.query(`INSERT INTO clients (id) VALUES ($1) ON CONFLICT DO NOTHING`, [CLIENT_ID]);
    await db.query(
      `INSERT INTO audit_runs (id, client_id, budget_remaining_usd) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [AUDIT_RUN_ID, CLIENT_ID, 1.0],
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

      // 1) 1 audit_log row
      await auditLogger.log({
        audit_run_id: AUDIT_RUN_ID,
        client_id: CLIENT_ID,
        event: 'phase4_ac15_started',
        payload: {},
      });

      // 2) 3 audit_events rows
      for (const kind of ['audit_started', 'page_browse_started', 'page_browse_completed'] as const) {
        await sessionRecorder.recordEvent({
          audit_run_id: AUDIT_RUN_ID,
          client_id: CLIENT_ID,
          kind,
          payload: {},
        });
      }

      // 3) LLM call — success
      const okAdapter = new AnthropicAdapter({
        apiKey: 'mock-key',
        defaultModel: 'claude-sonnet-4-mock',
        transport: new MockAnthropicAdapter({ behaviour: 'ok' }),
        retryBackoffMs: 0,
      });
      await okAdapter.complete({
        operation: 'classify',
        audit_run_id: AUDIT_RUN_ID,
        userPrompt: 'ok-path',
        temperature: 0,
        maxTokens: 16,
      });

      // 4) LLM call — budget exceeded (set budget to 0 first).
      await db.query(`UPDATE audit_runs SET budget_remaining_usd = 0 WHERE id = $1`, [AUDIT_RUN_ID]);
      let budgetThrew = false;
      try {
        await okAdapter.complete({
          operation: 'classify',
          audit_run_id: AUDIT_RUN_ID,
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
        AUDIT_RUN_ID,
      ]);

      // 5) LLM call — failover (3 retries then unavailable).
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
          audit_run_id: AUDIT_RUN_ID,
          userPrompt: 'unavailable',
          temperature: 0,
          maxTokens: 16,
        });
      } catch {
        failoverThrew = true;
      }
      expect(failoverThrew).toBe(true);

      // Verify the 3 outcomes recorded in llm_call_log.
      const r = await db.query<{ outcome: string }>(
        `SELECT outcome FROM llm_call_log WHERE audit_run_id = $1`,
        [AUDIT_RUN_ID],
      );
      const outcomes = r.rows.map((row) => row.outcome);
      expect(outcomes).toContain('ok');
      expect(outcomes).toContain('budget_blocked');
      expect(outcomes).toContain('unavailable');

      // 6) 1 screenshot to LocalDisk
      const screenshots = new LocalDiskStorage();
      await screenshots.put(Buffer.from('mock-jpeg'), {
        audit_run_id: AUDIT_RUN_ID,
        page_url: 'https://example.com/ac15',
      });

      // 7) findings table is empty for this audit_run
      const findingsR = await db.query<{ id: string }>(
        `SELECT id FROM findings WHERE audit_run_id = $1`,
        [AUDIT_RUN_ID],
      );
      expect(findingsR.rows.length).toBe(0);

      // 8) all 15 tables queryable
      for (const table of ALL_15_TABLES) {
        await expect(db.query(`SELECT 1 FROM ${table} LIMIT 0`)).resolves.toBeDefined();
      }
    },
    PHASE4_WALL_CLOCK_MS,
  );
});
