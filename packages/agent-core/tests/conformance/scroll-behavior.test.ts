/**
 * AC-03 — ScrollBehavior conformance (Phase 2 T018).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-03 + R-03
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T018
 *
 * AC-03 contract:
 *   - browser-runtime/ScrollBehavior.ts exports `scrollBehavior.scroll(page, direction, distance)`
 *   - Variable-momentum motion (NOT linear page.mouse.wheel emit)
 *   - Triggers at least one lazy-loaded element in single scroll cycle on
 *     a fixture page (IntersectionObserver callback fires for off-screen img)
 *
 * RED state — implementation lands at T018 (Wave 4). The import below will
 *   fail with `Cannot find module` until then; expected R3.1 TDD RED state.
 *
 * Anchor: @AC-03 — variable-momentum scroll triggers IntersectionObserver
 *   on lazy-loaded element.
 */
import { describe, it } from 'vitest';

// NOTE (R3.1): import deliberately commented out so this file compiles +
// loads cleanly until T018 lands. Uncomment when ScrollBehavior.ts exists:
// import { scrollBehavior } from '../../src/browser-runtime/ScrollBehavior.js';

describe('ScrollBehavior — AC-03 conformance (Wave 0 RED)', () => {
  /**
   * @AC-03 — variable-momentum motion (sampled scroll deltas are not all
   * identical — confirms momentum profile rather than linear emit).
   */
  it.todo('AC-03: scroll deltas vary across the cycle (momentum profile, not linear)');

  /**
   * @AC-03 — fires IntersectionObserver callback for an off-screen lazy-load
   * image inside one scroll cycle on a fixture page.
   */
  it.todo('AC-03: triggers IntersectionObserver on lazy-loaded image in one cycle');

  /**
   * @AC-03 — direction='down' moves scrollY in positive direction;
   *  direction='up' in negative.
   */
  it.todo('AC-03: respects direction parameter (down increases scrollY, up decreases)');

  /**
   * @AC-03 — emits Pino correlation fields per T-PHASE2-LOGGER.
   */
  it.todo('AC-03: logs tool_name + tool_call_id + client_session_id correlation fields');
});
