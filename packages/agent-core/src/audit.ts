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
  logger.info(
    {
      node_name: 'evaluate',
      raw_finding_count: rawFindings.length,
      // R6-safe correlation: ids only (NEVER observation text — that
      // travels through the data path, not the observability path).
      finding_ids: rawFindings.map((f) => f.id),
      source: rawFindings[0]?.source ?? 'none',
    },
    'evaluated (T-SKELETON-004 stub — 2 hardcoded raw findings; observations passed R5.3 + GR-007 banned-phrase static-check)',
  );

  const selfCritique = new SelfCritiqueNode();
  const critiqued = await selfCritique.run(rawFindings);
  // Verdict distribution for demo readability + Phase 7 T121 forward
  // visibility (week 6 introduces REVISE/DOWNGRADE/REJECT verdicts).
  const verdictsSummary = critiqued.reduce<Record<string, number>>((acc, f) => {
    acc[f.verdict] = (acc[f.verdict] ?? 0) + 1;
    return acc;
  }, {});
  logger.info(
    {
      node_name: 'critique',
      count: critiqued.length,
      verdicts_summary: verdictsSummary,
    },
    'critiqued (T-SKELETON-005 stub — passthrough verdict=KEEP; Phase 7 T121 week 6 introduces SEPARATE LLM call per R5.6)',
  );

  const evidenceGrounder = new EvidenceGrounder();
  const groundResult = await evidenceGrounder.ground(critiqued);
  // Rejection breakdown by rule_id — week-1 always {} (passthrough).
  // Phase 7 T122-T130 (week 7) populates with GR-001..GR-008 + GR-012
  // counts as findings get rejected by the 9 grounding rules.
  const rejectionSummary = groundResult.rejected.reduce<Record<string, number>>((acc, r) => {
    acc[r.ruleId] = (acc[r.ruleId] ?? 0) + 1;
    return acc;
  }, {});
  logger.info(
    {
      node_name: 'ground',
      grounded: groundResult.grounded.length,
      rejected: groundResult.rejected.length,
      rejection_summary: rejectionSummary,
    },
    'grounded (T-SKELETON-006 stub — passthrough; rejected[] empty; Phase 7 T122-T130 week 7 ships 9 GR rules ★ second risk gate ★)',
  );

  const annotateNode = new AnnotateNode();
  const annotated = await annotateNode.run(groundResult.grounded);
  logger.info(
    {
      node_name: 'annotate',
      count: annotated.length,
      // Week-1 always 0 (no-op passthrough). Phase 7 T131 (week 9) populates
      // with the count of findings that received a Sharp severity-color
      // bounding-box overlay (typically equals `count` once every grounded
      // finding has a resolvable element ref).
      annotation_count: 0,
    },
    'annotated (T-SKELETON-007 stub — no-op passthrough; Phase 7 T131 week 9 introduces Sharp severity-color overlays for Phase 9 PDF delivery)',
  );

  const storeNode = new StoreNode();
  const findingsPath = await storeNode.run({ findings: annotated, outputDir, slug });
  logger.info(
    {
      node_name: 'store',
      path: findingsPath,
      findings_count: annotated.length,
    },
    'stored (T-SKELETON-008 stub — JSON to filesystem; Phase 4 T070-T072 week 3 introduces Postgres write + RLS; 3-stage promotion wk 3 / wk 9 / wk 11)',
  );

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
  logger.info(
    {
      node_name: 'report',
      path: reportPath,
      // text/plain in week 1; Phase 9 T245-T249 (week 10) transitions to
      // application/pdf with branded 8-section layout per F-018.
      report_format: 'text/plain',
      bytes_written: Buffer.byteLength(reportText, 'utf8'),
    },
    'rendered (T-SKELETON-009 stub — plain-text TXT; Phase 9 T245-T249 week 10 introduces HTML+PDF + R6 channels 3+4 first runtime)',
  );

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
