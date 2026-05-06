/**
 * Report — placeholder for T-SKELETON-001 orchestrator scaffolding.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 T-SKELETON-009.
 *
 * Status: returns plain-text report header + per-finding lines. Orchestrator
 * writes the returned string to `<outputDir>/<slug>-audit.txt`. Same form
 * will satisfy T-SKELETON-009 acceptance (week 1 stub: TXT only).
 *
 * Phase 9 T245-T249 supersedes with HTML template + Playwright `page.pdf()`
 * branded PDF (8 sections per F-018) in week 10. R6 channels 3+4 first
 * runtime activation (Hono API responses + Next.js render redaction) ride
 * along with the Phase 9 implementation.
 *
 * R6 IP-boundary discipline: even when T-SKELETON-009 enriches with stub
 * findings, this rendered report MUST NOT contain heuristic body content —
 * only `heuristic_id` is referenced, never `body`.
 *
 * R10 compliance: file ≤ 50 lines.
 */
import { type GroundedFinding } from '../audit/types.js';

export interface ReportInput {
  url: string;
  auditRunId: string;
  findings: readonly GroundedFinding[];
  rejectedCount: number;
  durationMs: number;
}

export class Report {
  async render({ url, auditRunId, findings, rejectedCount, durationMs }: ReportInput): Promise<string> {
    const lines: string[] = [
      `Neural Audit — ${auditRunId}`,
      `URL: ${url}`,
      `Duration: ${durationMs}ms`,
      `Findings: ${findings.length} grounded; ${rejectedCount} rejected`,
      '',
    ];
    for (const finding of findings) {
      lines.push(`- [${finding.heuristic_id}] (${finding.verdict}) ${finding.observation}`);
    }
    return lines.join('\n');
  }
}
