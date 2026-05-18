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

// ─── Phase 7 T132: storeNodeRun (AC-20, REQ-ANALYZE-NODE-005) ───────────
//
// Persists grounded findings + rejected findings + screenshots. Findings
// land in `findings.publish_status='held'` (F-016 warm-up default;
// WarmupManager flips to 'published' at Phase 9). Rejected findings land
// in `rejected_findings` append-only (R7.4) with rule_id + reason.
// Screenshots persist via ScreenshotStorage (R2 in prod, disk in dev per
// R7.3) — NO base64 in DB.
//
// NOTE: each appendFinding / appendRejectedFinding opens its own
// withClient tx (StorageAdapter contract). Tighter atomicity (single tx
// across all rows) requires extending StorageTx with insert helpers;
// deferred to future ratchet. Append-only tables + idempotent
// screenshot put() bound partial-failure blast radius.
import type {
  GroundedFinding as Phase7GroundedFinding,
  RejectedFinding as Phase7RejectedFinding,
} from '../../orchestration/AnalysisState.js';
import type { StorageAdapter } from '../../adapters/StorageAdapter.js';
import type { ScreenshotStorage } from '../../adapters/ScreenshotStorage.js';

export interface StoreNodeInput {
  readonly grounded_findings: ReadonlyArray<Phase7GroundedFinding>;
  readonly rejected_findings: ReadonlyArray<Phase7RejectedFinding>;
  readonly auditRunId: string;
  readonly clientId: string;
  readonly pageUrl: string;
  readonly pageType?: string;
  readonly screenshots: {
    readonly viewport_clean: Buffer;
    readonly fullpage_clean: Buffer;
    readonly viewport_annotated?: Buffer;
    readonly fullpage_annotated?: Buffer;
  };
  readonly storage: StorageAdapter;
  readonly screenshotStorage: ScreenshotStorage;
}

export interface StoreNodeResult {
  readonly finding_ids: string[];
  readonly rejected_ids: string[];
  readonly screenshot_paths: {
    readonly viewport_clean: string;
    readonly fullpage_clean: string;
    readonly viewport_annotated: string | null;
    readonly fullpage_annotated: string | null;
  };
}

function buildFindingInsert(
  f: Phase7GroundedFinding,
  auditRunId: string,
  clientId: string,
  pageUrl: string,
  pageType: string | undefined,
  screenshotRef: string,
): Record<string, unknown> {
  return {
    auditRunId,
    clientId,
    pageUrl,
    pageType: pageType ?? null,
    heuristicId: f.heuristic_id,
    heuristicSource: 'evaluate',
    category: 'general',
    status: f.status,
    severity: f.severity ?? 'low',
    name: f.heuristic_id,
    observation: f.observation,
    assessment: f.assessment,
    evidence: f.evidence,
    recommendation: f.recommendation ?? null,
    confidenceTier: f.confidence_tier,
    confidenceBasis: f.confidence_basis ?? null,
    needsReview: f.needs_review ?? false,
    publishStatus: 'held', // F-016 warm-up default
    screenshotRef,
  };
}

function buildRejectedInsert(
  r: Phase7RejectedFinding,
  auditRunId: string,
  clientId: string,
  pageUrl: string,
): Record<string, unknown> {
  return {
    auditRunId,
    clientId,
    pageUrl,
    heuristicId: r.heuristic_id,
    findingContent: r,
    rejectionStage: 'grounding',
    rejectionReason: r.rejection_reason,
    rejectedByRule: r.rejected_by_rule,
  };
}

export async function storeNodeRun(input: StoreNodeInput): Promise<StoreNodeResult> {
  const {
    grounded_findings,
    rejected_findings,
    auditRunId,
    clientId,
    pageUrl,
    pageType,
    screenshots,
    storage,
    screenshotStorage,
  } = input;

  // Screenshots first — paths are needed for findings.screenshotRef.
  const putOpts = { audit_run_id: auditRunId, page_url: pageUrl };
  const viewport_clean = await screenshotStorage.put(screenshots.viewport_clean, putOpts);
  const fullpage_clean = await screenshotStorage.put(screenshots.fullpage_clean, {
    ...putOpts,
    page_url: `${pageUrl}#fullpage`,
  });
  const viewport_annotated = screenshots.viewport_annotated
    ? await screenshotStorage.put(screenshots.viewport_annotated, {
        ...putOpts,
        page_url: `${pageUrl}#vp-annot`,
      })
    : null;
  const fullpage_annotated = screenshots.fullpage_annotated
    ? await screenshotStorage.put(screenshots.fullpage_annotated, {
        ...putOpts,
        page_url: `${pageUrl}#fp-annot`,
      })
    : null;

  const finding_ids: string[] = [];
  for (const f of grounded_findings) {
    const id = await storage.appendFinding(
      buildFindingInsert(f, auditRunId, clientId, pageUrl, pageType, viewport_clean) as never,
    );
    finding_ids.push(id);
  }

  const rejected_ids: string[] = [];
  for (const r of rejected_findings) {
    const id = await storage.appendRejectedFinding(
      buildRejectedInsert(r, auditRunId, clientId, pageUrl) as never,
    );
    rejected_ids.push(id);
  }

  return {
    finding_ids,
    rejected_ids,
    screenshot_paths: {
      viewport_clean,
      fullpage_clean,
      viewport_annotated,
      fullpage_annotated,
    },
  };
}
