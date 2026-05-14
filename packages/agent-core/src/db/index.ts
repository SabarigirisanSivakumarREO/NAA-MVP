/**
 * Phase 4 T070 — db barrel.
 *
 * Re-exports the Drizzle schema (15 tables), the Drizzle client, the raw pg
 * client, the migration runner, the append-only brand type, AND the
 * derived row-shape type aliases for each table. Consumers import
 * `@neural/agent-core/db` or `from '../../db/index.js'`.
 *
 * R10.2 named exports only. R9: this barrel is the allowed import surface;
 * code outside `db/` and `adapters/PostgresStorage.ts` must NOT directly
 * import `pg` / `drizzle-orm`. The `Row*` / `Insert*` aliases below let
 * downstream code consume row shapes without naming `drizzle-orm` in its
 * own imports (the R9 grep test treats any source line matching
 * `from 'drizzle-orm'` outside the allowed paths as a violation).
 */
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type {
  auditEvents,
  auditLog,
  auditRequests,
  auditRuns,
  clients,
  findingEdits,
  findingRollups,
  findings,
  llmCallLog,
  pageStates,
  rejectedFindings,
  reproducibilitySnapshots,
  screenshots,
  sessions,
  stateInteractions,
} from './schema.js';

export * from './schema.js';
export {
  getDb,
  getDbClient,
  getPool,
  runMigrations,
  type DbPool,
  type DbDrizzle,
  type RawDbClient,
} from './client.js';

// ── Insert-row aliases ─────────────────────────────────────────────────
export type ClientInsert = InferInsertModel<typeof clients>;
export type AuditRunInsert = InferInsertModel<typeof auditRuns>;
export type FindingInsert = InferInsertModel<typeof findings>;
export type ScreenshotInsert = InferInsertModel<typeof screenshots>;
export type SessionInsert = InferInsertModel<typeof sessions>;
export type PageStateInsert = InferInsertModel<typeof pageStates>;
export type StateInteractionInsert = InferInsertModel<typeof stateInteractions>;
export type FindingRollupInsert = InferInsertModel<typeof findingRollups>;
export type ReproducibilitySnapshotInsert = InferInsertModel<typeof reproducibilitySnapshots>;
export type AuditRequestInsert = InferInsertModel<typeof auditRequests>;
export type AuditLogInsert = InferInsertModel<typeof auditLog>;
export type RejectedFindingInsert = InferInsertModel<typeof rejectedFindings>;
export type FindingEditInsert = InferInsertModel<typeof findingEdits>;
export type AuditEventInsert = InferInsertModel<typeof auditEvents>;
export type LLMCallLogInsert = InferInsertModel<typeof llmCallLog>;

// ── Select-row aliases (read shapes) ───────────────────────────────────
export type FindingRow = InferSelectModel<typeof findings>;
export type AuditRunRow = InferSelectModel<typeof auditRuns>;
export type ClientRow = InferSelectModel<typeof clients>;
