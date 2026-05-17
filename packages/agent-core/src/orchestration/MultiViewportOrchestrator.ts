/**
 * MultiViewportOrchestrator — Phase 5b T5B-003.
 *
 * Runs DeepPerceive sequentially per viewport on a single page. Sequential
 * (NOT parallel) per plan.md §1 + tasks.md T5B-003 acceptance ("no parallel
 * browser contexts in MVP"). Each viewport produces its own PerceptionBundle
 * stored separately + tagged with the audit correlation_id so downstream
 * ViewportDiffEngine (T5B-004) can match them.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/plan.md §2.2
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
 *     T5B-003 — acceptance + R26 sequential execution.
 *   docs/specs/final-architecture/07-analyze-mode.md §7.9.2 multi-viewport.
 *
 * Stubbed dep (Phase 7): DeepPerceiveNode arrives at T117. Until then this
 * orchestrator accepts an injected `perceive(viewport, page)` function — a
 * fixture in tests, a thin DeepPerceiveNode adapter in production once
 * Phase 7 lands. This keeps T5B-003 unblocked + testable now.
 *
 * Constitution compliance:
 *   R10.1 file ≤ 300 LOC. R10.2 named exports. R2 no `any`.
 *   R10.4 input contract is typed (no Zod here — upstream AuditRequest is
 *     Zod-validated; bundles are typed unknowns surfaced to ViewportDiffEngine).
 *
 * Anchor: @T5B-003 — MultiViewportOrchestrator (sequential per-viewport).
 */
import type { ViewportName } from '../types/audit-request.js';

import type { ViewportConfig, ViewportConfigService } from './ViewportConfigService.js';

/**
 * Per-viewport perception result envelope. The `bundle` payload is opaque
 * to this orchestrator — typed as `unknown` until Phase 7 (T117) lands the
 * canonical PerceptionBundle shape, at which point this can be tightened to
 * the precise import.
 */
export interface ViewportBundle {
  readonly device_type: 'desktop' | 'mobile';
  readonly viewport: ViewportConfig;
  readonly correlation_id: string;
  readonly bundle: unknown;
}

export interface MultiViewportRunInput {
  readonly viewports: readonly ViewportName[];
  readonly page: unknown;
  readonly correlationId: string;
}

export interface MultiViewportRunResult {
  readonly correlation_id: string;
  readonly bundles: ViewportBundle[];
}

export type PerceiveFn = (viewport: ViewportConfig, page: unknown) => Promise<unknown>;

export interface MultiViewportOrchestratorDeps {
  readonly viewportConfigService: ViewportConfigService;
  readonly perceive: PerceiveFn;
}

export class MultiViewportOrchestrator {
  private readonly viewportConfigService: ViewportConfigService;
  private readonly perceive: PerceiveFn;

  constructor(deps: MultiViewportOrchestratorDeps) {
    this.viewportConfigService = deps.viewportConfigService;
    this.perceive = deps.perceive;
  }

  /**
   * Sequentially perceive `page` at each viewport. R26 sequential — `await`
   * inside a for-loop, never Promise.all (parallel browser contexts deferred
   * to v1.2 per T5B-003 acceptance).
   */
  async run(input: MultiViewportRunInput): Promise<MultiViewportRunResult> {
    const configs = this.viewportConfigService.resolve(input.viewports);
    const bundles: ViewportBundle[] = [];

    for (const viewport of configs) {
      // Sequential: await each before next iteration.
      const bundle = await this.perceive(viewport, input.page);
      bundles.push({
        device_type: viewport.device_type,
        viewport,
        correlation_id: input.correlationId,
        bundle,
      });
    }

    return {
      correlation_id: input.correlationId,
      bundles,
    };
  }
}
