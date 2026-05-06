/**
 * Audit orchestrator — REAL through week 12.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 T-SKELETON-001
 *         (stays real per the §8 promotion table; week 8 T-SKELETON-001
 *         refactor wraps this thin orchestrator inside an AuditGraph LangGraph
 *         composition once Phase 8 lands — R20 impact.md required at that
 *         transition).
 *
 * Sequencing per §6: capture → loadHeuristics → evaluate → critique →
 * ground → annotate → store → report. Each step calls the canonical node
 * module at its real file path; placeholder bodies in week 1 (T-SKELETON-001)
 * are progressively enriched per T-SKELETON-002..009.
 *
 * Why no LangGraph yet: Phase 8 (T135+) introduces AuditGraph composition.
 * Week 1 uses plain async/await; week 8 swap is local to this file.
 *
 * R6 (heuristic IP boundary): orchestrator logs only `heuristic_id` (never
 * `body`). Pino redaction landing in T-PHASE6-LOGGER (week 4) reinforces.
 *
 * R10 compliance: file ≤ 300 lines (≤ 50 lines per function).
 *
 * R14 (correlation fields): every Pino log line carries `audit_run_id` +
 * `node_name` + `page_url` per CLAUDE.md §5.
 */
import { createLogger } from './observability/index.js';
import { BrowserManager } from './browser-runtime/BrowserManager.js';
import { HeuristicLoader } from './analysis/heuristics/loader.js';
import { EvaluateNode } from './analysis/nodes/EvaluateNode.js';
import { SelfCritiqueNode } from './analysis/nodes/SelfCritiqueNode.js';
import { EvidenceGrounder } from './analysis/grounding/EvidenceGrounder.js';
import { AnnotateNode } from './analysis/nodes/AnnotateNode.js';
import { StoreNode } from './analysis/nodes/StoreNode.js';
import { Report } from './delivery/Report.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type AuditInput, type AuditOutcome } from './audit/types.js';

export { type AuditInput, type AuditOutcome } from './audit/types.js';

const DEFAULT_OUTPUT_DIR = './out';

/**
 * URL → filesystem slug. `https://example.com/foo` → `example-com`.
 *
 * Hostname-only is sufficient for single-page week-1 demos; week 8
 * multi-page audits may extend with path-derived suffixes per T-SKELETON-008
 * stage 2 supersession.
 */
function urlToSlug(url: string): string {
  return new URL(url).hostname.replace(/\./g, '-');
}

/** Audit-run id — base36 epoch suffix is enough for week-1 correlation. */
function newAuditRunId(): string {
  return `skl-${Date.now().toString(36)}`;
}

export async function audit(input: AuditInput): Promise<AuditOutcome> {
  const auditRunId = newAuditRunId();
  const outputDir = resolve(input.outputDir ?? DEFAULT_OUTPUT_DIR);
  const slug = urlToSlug(input.url);
  const logger = createLogger('audit').child({ audit_run_id: auditRunId, page_url: input.url });
  const wallStart = Date.now();

  await mkdir(outputDir, { recursive: true });

  logger.info({ node_name: 'orchestrator' }, 'started');

  const browserManager = new BrowserManager();
  const perception = await browserManager.capture(input.url);
  logger.info(
    {
      node_name: 'capture',
      page_title: perception.metadata.title,
      ax_node_count: perception.accessibilityTree.totalNodes,
      filtered_top30_count: perception.filteredDOM.top30.length,
    },
    'captured (T-SKELETON-002 — peregrine-pdp.json fixture)',
  );

  const heuristicLoader = new HeuristicLoader();
  const heuristics = await heuristicLoader.loadAll();
  logger.info(
    {
      node_name: 'loadHeuristics',
      count: heuristics.length,
      // R6: ids only, NEVER body. Roadmap §6 T-SKELETON-003 special kill
      // trigger: stub heuristic body content in any log = STOP.
      heuristic_ids: heuristics.map((h) => h.id),
    },
    'loaded (T-SKELETON-003 stub — 3 synthetic fixtures; bodies are R6-marked test fixtures)',
  );

  const evaluateNode = new EvaluateNode();
  const rawFindings = await evaluateNode.run(perception, heuristics);
  logger.info({ node_name: 'evaluate', count: rawFindings.length }, 'evaluated (placeholder — T-SKELETON-004 enriches)');

  const selfCritique = new SelfCritiqueNode();
  const critiqued = await selfCritique.run(rawFindings);
  logger.info({ node_name: 'critique', count: critiqued.length }, 'critiqued (placeholder — T-SKELETON-005 enriches)');

  const evidenceGrounder = new EvidenceGrounder();
  const groundResult = await evidenceGrounder.ground(critiqued);
  logger.info(
    { node_name: 'ground', grounded: groundResult.grounded.length, rejected: groundResult.rejected.length },
    'grounded (placeholder — T-SKELETON-006 enriches)',
  );

  const annotateNode = new AnnotateNode();
  const annotated = await annotateNode.run(groundResult.grounded);
  logger.info({ node_name: 'annotate', count: annotated.length }, 'annotated (placeholder — T-SKELETON-007 enriches)');

  const storeNode = new StoreNode();
  const findingsPath = await storeNode.run({ findings: annotated, outputDir, slug });
  logger.info({ node_name: 'store', path: findingsPath }, 'stored');

  const durationMs = Date.now() - wallStart;
  const report = new Report();
  const reportText = await report.render({
    url: input.url,
    auditRunId,
    findings: annotated,
    rejectedCount: groundResult.rejected.length,
    durationMs,
  });
  const reportPath = join(outputDir, `${slug}-audit.txt`);
  await writeFile(reportPath, reportText, 'utf8');
  logger.info({ node_name: 'report', path: reportPath }, 'rendered');

  logger.info({ node_name: 'orchestrator', duration_ms: durationMs }, 'completed');

  return {
    auditRunId,
    url: input.url,
    durationMs,
    findingsPath,
    reportPath,
    findingsCount: annotated.length,
    rejectedCount: groundResult.rejected.length,
  };
}
