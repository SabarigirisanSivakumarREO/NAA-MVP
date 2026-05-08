/**
 * Report — week-1 stub: plain-text report header + per-finding lines.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.7 §6 T-SKELETON-009
 *         (acceptance: returns plain-text report; written to
 *         `./out/<slug>-audit.txt` by orchestrator).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Returns
 * deterministic plain-text string with header lines + per-finding
 * `[<heuristic_id>] (<verdict>) <observation>` format. No HTML, no PDF,
 * no images, no executive summary, no action plan — week 1 is text-only.
 *
 * Phase 9 T245-T249 forward path (week 10 — supersession):
 *   The real Report.render() ships a branded PDF per F-018 with 8 sections:
 *     1. Cover            (REO Digital branding)
 *     2. Executive Summary (T245 — 1 LLM call ≤$0.10 cap; GR-007 retry-then-fallback per spec.md AC-22)
 *     3. Action Plan      (T246 — deterministic 4-quadrant: quick_wins / strategic / incremental / deprioritized; per AC-24)
 *     4. Findings by Category (renders annotated screenshots inline from T-SKELETON-007 supersession week 9)
 *     5. Cross-Page Patterns (PatternFinding from Phase 8 T139)
 *     6. Methodology      (audit pipeline summary; reproducibility note)
 *     7. Appendix         (LLM call log; cost breakdown)
 *     8. Reproducibility Note (snapshot pinned: temp=0; model id; prompt hashes; heuristic versions)
 *
 *   Pipeline: T246 Next.js HTML template → T247 Playwright `page.pdf()` →
 *   T248 R2 upload → T249 returns signed URL. PDF size ≤5MB; render <30s
 *   per AC-26.
 *
 * R6 (channels 3+4 — CRITICAL first runtime activation in week 10):
 *   The Phase 9 supersession activates 2 NEW R6 channels:
 *     - Channel 3: Hono API responses (GET /api/audits/:id renders
 *                  finding metadata to dashboard JSON — heuristic body
 *                  must be redacted at this seam)
 *     - Channel 4: Next.js HTML render (consultant dashboard renders
 *                  finding lists; PDF report renders finding text — both
 *                  use only `heuristic_id` + `observation` + `verdict`,
 *                  NEVER body)
 *   Recursive deep-scan against API responses + rendered HTML must
 *   detect ZERO heuristic body fingerprints (per Phase 9 spec AC-36).
 *   Week-1 stub doesn't reference body content (only id + observation +
 *   verdict primitives) so no redaction needed yet.
 *
 * R20 impact.md required at week-10 transition (Report contract +
 * R6 channels 3+4 first runtime + PDF size/render-time invariants +
 * R2 upload surface).
 *
 * R10/R13 — N/A this week. Phase 9 T245 ExecutiveSummary introduces
 * the SECOND LLM call per audit (after evaluate week 5 + critique
 * week 6); same R10/R13 temperature=0 + R14.1 atomic logging applies.
 *
 * R5.3 + GR-007 — week-1 N/A (passthrough preserves observation text
 * from upstream). Phase 9 T245 ExecutiveSummary will run GR-007
 * retry-then-fallback to ensure executive_summary text doesn't include
 * banned conversion-prediction phrasing.
 *
 * R10 compliance: file ≤ 100 lines.
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
