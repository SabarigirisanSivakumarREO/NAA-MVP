/**
 * Phase 5b multi-viewport integration test — AC-09 / T5B-009.
 *
 * Spec: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/{spec.md AC-09, tasks.md T5B-009}.
 *
 * Wires together (Stream A surface):
 *   - MultiViewportOrchestrator (T5B-003) with a stubbed DeepPerceiveNode
 *   - ViewportDiffEngine (T5B-004)
 *   - PopupBehaviorProbe (T5B-005)
 *   - DarkPatternDetector (T5B-007)
 *   - 5 multi-viewport heuristic JSON files (T5B-008) — read from disk
 *
 * Cost assertion (NF-01a): SUM(llm_call_log.cost_usd) for the audit_run_id
 *   must be ≤ 2× baseline. We MOCK the llm_call_log as an in-memory array
 *   (Phase 6 ships the real DB writer; integration test asserts structural
 *   inequality on the mock).
 *
 * Storage assertion (impact §6): per-snapshot bytes × 2 viewports
 *   ≤ ~13KB per page per audit.
 *
 * Popup behavior fields populated for all detected popups in fixture set.
 *
 * Stubs (clearly called out):
 *   - DeepPerceiveNode (Phase 7 T117): injected `perceive()` fixture function.
 *   - llm_call_log (Phase 6): in-memory array MOCK.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { MultiViewportOrchestrator } from '../../src/orchestration/MultiViewportOrchestrator.js';
import { ViewportConfigService, type ViewportConfig } from '../../src/orchestration/ViewportConfigService.js';
import { ViewportDiffEngine, type PerceptionBundleLike } from '../../src/analysis/ViewportDiffEngine.js';
import {
  probePopupBehavior,
  type ProbablePopup,
  type PopupProbeRecord,
} from '../../src/browser-runtime/PopupBehaviorProbe.js';
import { detectDarkPatterns } from '../../src/analysis/DarkPatternDetector.js';

// --- Stubbed Phase 6 llm_call_log ---
interface LlmCallLogRow {
  readonly audit_run_id: string;
  readonly cost_usd: number;
}

// --- Stubbed Phase 7 perception fixture ---
function makeBundle(device: 'desktop' | 'mobile'): PerceptionBundleLike {
  const desktopCtas = [
    { selector: '#hero-cta', in_fold: true },
    { selector: '#secondary-cta', in_fold: true },
  ];
  const mobileCtas = [
    { selector: '#hero-cta', in_fold: false }, // mobile-only issue
    { selector: '#secondary-cta', in_fold: true },
  ];
  return {
    device_type: device,
    in_fold:
      device === 'desktop'
        ? [{ selector: '#hero' }, { selector: '#nav' }]
        : [{ selector: '#hero' }],
    ctas: device === 'desktop' ? desktopCtas : mobileCtas,
    sticky_elements:
      device === 'desktop' ? [] : [{ selector: '#sticky-bottom' }],
  };
}

describe('Phase 5b multi-viewport integration — AC-09', () => {
  it('orchestrates desktop+mobile perception, diff, popup behavior, dark patterns, and heuristics', async () => {
    const auditRunId = 'audit-integration-test';
    const llmCallLog: LlmCallLogRow[] = [];

    // Stubbed perceive(): records a synthetic LLM cost per viewport run.
    const baselineCostUsd = 0.05;
    const perceive = async (viewport: ViewportConfig) => {
      llmCallLog.push({ audit_run_id: auditRunId, cost_usd: baselineCostUsd });
      return makeBundle(viewport.device_type);
    };

    const orchestrator = new MultiViewportOrchestrator({
      viewportConfigService: new ViewportConfigService(),
      perceive,
    });

    const result = await orchestrator.run({
      viewports: ['desktop', 'mobile'],
      page: {},
      correlationId: auditRunId,
    });

    expect(result.bundles).toHaveLength(2);

    // --- ViewportDiffEngine produces mobile-only / desktop-only findings ---
    const diff = new ViewportDiffEngine();
    const findings = diff.diff({
      desktop: result.bundles[0]!.bundle as PerceptionBundleLike,
      mobile: result.bundles[1]!.bundle as PerceptionBundleLike,
    });
    const dimensions = findings.map((f) => f.dimension);
    expect(dimensions).toContain('cta_visibility');
    expect(dimensions).toContain('sticky_element');

    // --- Popup behavior probe mutates popups[] in place ---
    const popups: ProbablePopup[] = [
      {
        type: 'cookie_banner',
        selector: '#cookie',
        isInitiallyOpen: true,
        isEscapeDismissible: null,
        isClickOutsideDismissible: null,
      },
      {
        type: 'exit_intent_overlay',
        selector: '#exit',
        isInitiallyOpen: false,
        isEscapeDismissible: null,
        isClickOutsideDismissible: null,
      },
    ];
    await probePopupBehavior({
      popups,
      navigatedAt: 0,
      observations: [
        { selector: '#cookie', firstVisibleAt: 0, triggerHint: null },
        { selector: '#exit', firstVisibleAt: 8000, triggerHint: 'exit_intent' },
      ],
    });
    for (const popup of popups) {
      const probe = (popup as ProbablePopup & { _probe?: PopupProbeRecord })._probe;
      expect(probe).toBeDefined();
    }
    expect((popups[0] as ProbablePopup & { _probe?: PopupProbeRecord })._probe!.triggerType).toBe('load');
    expect((popups[1] as ProbablePopup & { _probe?: PopupProbeRecord })._probe!.triggerType).toBe('exit_intent');

    // --- DarkPatternDetector flags dark patterns in fixture set ---
    const cookieDarkPattern = detectDarkPatterns({
      selector: '#cookie',
      hasCloseButton: true,
      closeButtonAccessibleName: 'Accept',
      closeButtonAreaPx2: 1024,
      closeButtonOpacity: 1,
      blocksPrimaryContent: true,
      innerHtml: '<input type="checkbox" checked /><label>Allow tracking cookies</label>',
      isInitiallyOpen: true,
    });
    expect(cookieDarkPattern).toBe('weighted_default');

    // --- Heuristics pack — load 5 multi-viewport JSON files from disk ---
    const heuristicsDir = join(__dirname, '../../../../heuristics-repo/multi-viewport');
    const files = readdirSync(heuristicsDir).filter((f) => f.endsWith('.json'));
    expect(files).toHaveLength(5);
    for (const file of files) {
      const parsed = JSON.parse(readFileSync(join(heuristicsDir, file), 'utf-8')) as {
        id: string;
        device?: string[];
      };
      expect(parsed.id).toMatch(/^MULTIVIEW-/);
      // R-07: heuristics reference viewport.device_type === "mobile" — verify
      // via manifest selector (the body uses the string, the manifest pins
      // device:["mobile"]).
      expect(parsed.device).toEqual(['mobile']);
    }

    // --- NF-01a cost assertion: SUM(cost_usd) ≤ 2 × baseline ---
    const totalCost = llmCallLog
      .filter((row) => row.audit_run_id === auditRunId)
      .reduce((acc, row) => acc + row.cost_usd, 0);
    expect(totalCost).toBeLessThanOrEqual(2 * baselineCostUsd + 1e-9);

    // --- Storage assertion (impact §6): per-snapshot bytes × 2 ≤ 13KB ---
    const snapshotBytes = JSON.stringify(result.bundles[0]!.bundle).length;
    const totalStorageBytes = snapshotBytes * 2;
    expect(totalStorageBytes).toBeLessThanOrEqual(13_000);
  });
});
