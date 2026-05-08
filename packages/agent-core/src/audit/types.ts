/**
 * Audit orchestrator local types — minimal shapes connecting the 8 stub nodes.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 (T-SKELETON-001
 *         orchestrator + §3 stub conventions).
 *
 * Why local types (not yet Zod-validated): the canonical Finding lifecycle
 * (Phase 7 T117/T119 raw → T120/T121 critiqued → T122-T130 grounded/rejected)
 * lands week 5-7 and supersedes these shapes. Until then the orchestrator
 * uses plain TypeScript types — the only schema-validated boundaries this
 * week are the inputs PageStateModel (T014) and HeuristicExtended (T101),
 * which already have their own Zod schemas in the canonical files.
 *
 * R10 compliance: file ≤ 300 lines; named exports only; zero z.any().
 *
 * R5.3 + GR-007 (applies to stubs per roadmap §10):
 *   The `observation` string MUST NOT contain banned conversion-prediction
 *   phrasing. Stub fixtures (T-SKELETON-004 onwards) must satisfy this — not
 *   enforced at the type level; static-check unit test on the stub data
 *   per the T-SKELETON-004 acceptance.
 */

/** Input to the audit orchestrator (week 1 minimal — Phase 9 T156 supersedes). */
export interface AuditInput {
  url: string;
  /** Default: ./out (relative to repo root). */
  outputDir?: string;
}

/**
 * Raw finding — output of EvaluateNode. Week 1 stub returns 2 hardcoded;
 * week 5 real Claude call replaces. Phase 7 T117/T119 defines the canonical
 * AnalyzePerception+Finding shape that supersedes this minimal local type.
 */
export interface RawFinding {
  id: string;
  /**
   * Telemetry tag identifying the producer. Week 1 stub data uses
   * 'skeleton-stub'; Phase 7 EvaluateNode will tag with model id +
   * temperature snapshot per R10/R14.1.
   */
  source: 'skeleton-stub' | string;
  heuristic_id: string;
  page_url: string;
  /** Plain-text observation — banned-phrase regex applies (R5.3 + GR-007). */
  observation: string;
}

/** Self-critique verdict (Phase 7 T120 supersedes with R5.6 enforcement). */
export type CritiqueVerdict = 'KEEP' | 'REVISE' | 'DOWNGRADE' | 'REJECT';

export interface CritiqueFinding extends RawFinding {
  verdict: CritiqueVerdict;
}

/**
 * Grounded finding — output of EvidenceGrounder. Week 1 alias for
 * CritiqueFinding (passthrough); Phase 7 T122-T130 grounding rules
 * supersede with rule-attestation fields.
 */
export type GroundedFinding = CritiqueFinding;

/**
 * EvidenceGrounder result envelope — both the kept findings and the
 * rejected ones. Week 1 stub returns all-grounded / empty-rejected;
 * Phase 7 T130 supersedes with full R20 Finding lifecycle gates.
 */
export interface GroundResult {
  grounded: GroundedFinding[];
  rejected: Array<{
    finding: CritiqueFinding;
    ruleId: string;
    reason: string;
  }>;
}

/**
 * Final audit outcome — the orchestrator returns this to the CLI for
 * exit-code + summary printing. Phase 9 T156 AuditRequest contract
 * supersedes with full delivery surface (PDF path, R2 url, etc.).
 */
export interface AuditOutcome {
  auditRunId: string;
  url: string;
  durationMs: number;
  findingsPath: string;
  reportPath: string;
  findingsCount: number;
  rejectedCount: number;
}
