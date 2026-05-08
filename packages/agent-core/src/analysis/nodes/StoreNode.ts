/**
 * StoreNode — week-1 stub: write findings as JSON to filesystem.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.6 §6 T-SKELETON-008
 *         (acceptance: writes findings to `<outputDir>/<slug>-findings.json`
 *         and returns the absolute path; no DB — Phase 4 not yet landed).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Uses Node's
 * `fs/promises` only — no Postgres, no Drizzle, no `pg` import. Per R7.4
 * stub-time enforcement (roadmap §10): pre-Phase-4 (weeks 1-2) the stub
 * MUST NOT attempt DB writes — special kill trigger per roadmap §6 R23.
 *
 * Three-stage promotion path (roadmap §8 — UNIQUE among T-SKELETON tasks
 * for having a multi-stage rollout):
 *
 *   Stage 1 — week 3 (Phase 4 T070 + T072 + T074):
 *     Replace JSON-write with PostgresStorage adapter writing to the 5
 *     append-only tables (audit_runs, findings, finding_edits,
 *     audit_events, llm_call_log per Phase 4 plan §3). RLS-enforced via
 *     `SET LOCAL app.client_id` in transactions (R7.2). Append-only
 *     trigger fires `RAISE EXCEPTION` on any UPDATE / DELETE attempt
 *     (R7.4 invariant — verifiable via Phase 4 conformance test).
 *     Screenshot upload to ScreenshotStorage / R2 also lands at this
 *     stage (Phase 4 T072 lifts).
 *     R20 impact.md required: DB schema + RLS surface + 5-table
 *     append-only contract.
 *
 *   Stage 2 — week 9 (Phase 7 T132):
 *     Extend Postgres write with full Finding lifecycle gates: raw →
 *     critiqued → grounded/rejected, with rejected_findings DB rows
 *     carrying `rule_id` + `reason` from the 9 grounding rules. Atomic
 *     batch write so per-page lifecycle is consistent under partial
 *     failure (PostgresCheckpointer integration per Phase 8 T144).
 *     R20 impact.md required: Finding lifecycle gates + rejected_findings
 *     table extension.
 *
 *   Stage 3 — week 11 (Phase 9 T164):
 *     Two-store warm-up aware. Findings flow into "held" state by
 *     default (consultant review queue); WarmupManager + Phase 4
 *     access_mode_middleware promote to "published" once the warm-up
 *     graduation criteria pass per F-016. Final form at MVP completion.
 *     R20 impact.md required: warm-up + access_mode_middleware contracts
 *     + held↔published transition triggers.
 *
 * R6 — N/A this stub (filesystem write only; observation strings already
 * passed R5.3 + R6 boundary checks at upstream EvaluateNode T-SKELETON-004).
 * Stage-1 supersession (week 3) inherits R6 redaction at the DB
 * serialization seam via Phase 6 T-PHASE6-LOGGER (week 4).
 *
 * R7.4 stub-time enforcement (CRITICAL): pre-Phase-4 placeholder MUST
 * NOT attempt DB writes. This implementation contains zero `pg`,
 * `drizzle`, or `INSERT INTO` references. Roadmap §6 special kill
 * trigger: stub attempts DB write before Phase 4 lands → STOP.
 *
 * R10/R13 — N/A (no LLM).
 *
 * R10 compliance: file ≤ 80 lines.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type GroundedFinding } from '../../audit/types.js';

export interface StoreInput {
  findings: readonly GroundedFinding[];
  outputDir: string;
  slug: string;
}

export class StoreNode {
  async run({ findings, outputDir, slug }: StoreInput): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const path = join(outputDir, `${slug}-findings.json`);
    await writeFile(path, JSON.stringify(findings, null, 2), 'utf8');
    return path;
  }
}
