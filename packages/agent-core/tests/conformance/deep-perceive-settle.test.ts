/**
 * AC-11 — DeepPerceiveNode + settle integration conformance (REQ-PERCEPT-V25-002).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-11 + R-12
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-011
 *
 * AC-11: settle runs before AnalyzePerception capture; settle warnings
 *   propagate into bundle.warnings. (Full DeepPerceiveNode is Phase 7 —
 *   Phase 1c only wires the settle hook in a forward stub.)
 *
 * R-12: System MUST integrate waitForSettle() into the deep_perceive
 *   capture path so every capture is gated on settle; settle results
 *   propagate to bundle.warnings.
 *
 * R3.1 TDD (Wave 0 RED): import fails with "module not found" until
 *   T1C-011 lands (forward-stub interface OK if T117 not yet shipped).
 *
 * Anchor: @AC-11 — DeepPerceiveNode skeleton calls waitForSettle BEFORE
 *   ContextAssembler.capture(). SETTLE_TIMEOUT_5S warning surfaces in
 *   bundle.warnings when settle hits 5s cap.
 */
import { describe, expect, it } from 'vitest';

// @ts-expect-error - module not implemented yet (Wave 0 RED for T1C-011)
import { DeepPerceiveNode } from '../../src/analysis/nodes/DeepPerceiveNode.js';

describe('DeepPerceiveNode + settle integration — AC-11 conformance (Wave 0 RED)', () => {
  /**
   * @AC-11 — DeepPerceiveNode exists as a class / object (forward-stub OK).
   */
  it('AC-11: DeepPerceiveNode is exported (skeleton or stub)', () => {
    expect(DeepPerceiveNode).toBeDefined();
  });

  /**
   * @AC-11 — Real Playwright Page-driven settle integration:
   *   - waitForSettle runs BEFORE ContextAssembler.capture()
   *   - capture begins only after settle resolves
   *   - SETTLE_TIMEOUT_5S warning propagates into bundle.warnings on cap
   * Requires real Playwright runtime — flagged as todo. Exercised end-to-end
   * by AC-12 integration test.
   */
  it.todo('AC-11: waitForSettle called BEFORE ContextAssembler.capture()');

  it.todo('AC-11: SETTLE_TIMEOUT_5S warning surfaces in bundle.warnings on hung-fetch fixture');

  /**
   * @AC-11 — Sub-step warnings (FONTS_NOT_READY, ANIMATION_NOT_SETTLED)
   * propagate from SettlePredicate.catch paths into bundle.warnings.
   */
  it.todo('AC-11: sub-step warnings propagate from settle into bundle.warnings');

  /**
   * @AC-11 — When T117 (Phase 7 DeepPerceiveNode) is not yet shipped, T1C-011
   * MUST present a forward-stub interface that compiles + accepts the settle
   * hook without architecture change (per tasks.md T1C-011 note).
   */
  it.todo('AC-11: forward-stub interface accepts settle hook without Phase 7 dependency');
});
