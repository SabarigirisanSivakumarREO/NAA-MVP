/**
 * ViewportConfigService — Phase 5b T5B-002.
 *
 * Resolves a list of viewport names (from AuditRequest.viewports — see
 * src/types/audit-request.ts T5B-001) to an ordered array of ViewportConfig
 * (width / height / device_type).
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/plan.md §2.2
 *     — preset map (desktop 1440×900, mobile iPhone 11 375×812).
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
 *     T5B-002 — acceptance + presets fixed in MVP. Custom widths deferred
 *     to v1.1 per spec.md Out of Scope.
 *
 * Constitution compliance:
 *   R10.1 file ≤ 300 LOC.
 *   R10.2 named exports only.
 *   R10.4 Zod-validated input boundary (AuditRequest is Zod-validated upstream;
 *     this service receives the already-parsed `viewports` field).
 *   R2 no `any`.
 *
 * Anchor: @T5B-002 — ViewportConfigService.
 */
import type { ViewportName } from '../types/audit-request.js';

export type DeviceType = 'desktop' | 'mobile';

export interface ViewportConfig {
  readonly width: number;
  readonly height: number;
  readonly device_type: DeviceType;
}

/**
 * MVP viewport presets — locked per plan.md §2.2 act-017.
 *
 * - desktop 1440×900: standard laptop baseline.
 * - mobile 375×812: iPhone 11 (median of iPhone 6/SE/11/12/13 generation).
 *   Android Pixel 5 (393×851) deferred to v1.1 per spec Out of Scope.
 */
export const VIEWPORT_PRESETS: Record<ViewportName, ViewportConfig> = {
  desktop: { width: 1440, height: 900, device_type: 'desktop' },
  mobile: { width: 375, height: 812, device_type: 'mobile' },
} as const;

/**
 * Resolves AuditRequest.viewports[] to ordered ViewportConfig[]. Order is
 * preserved — the MultiViewportOrchestrator (T5B-003) iterates sequentially
 * in this order.
 */
export class ViewportConfigService {
  resolve(viewports: readonly ViewportName[]): ViewportConfig[] {
    return viewports.map((name) => {
      const preset = VIEWPORT_PRESETS[name];
      if (preset === undefined) {
        // REQ-GATEWAY-AUDITREQ-VIEWPORTS-001: runtime guard for callers
        // that bypass the Zod-validated AuditRequestSchema upstream.
        throw new Error(
          `ViewportConfigService: unknown viewport "${String(name)}". ` +
            `MVP supports: ${Object.keys(VIEWPORT_PRESETS).join(', ')}.`
        );
      }
      return preset;
    });
  }
}
