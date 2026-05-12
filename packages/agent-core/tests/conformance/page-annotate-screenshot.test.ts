/**
 * AC-10 — page_annotate_screenshot conformance (Phase 2 T047).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-10 + R-10
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T047
 *
 * AC-10 contract:
 *   - Sharp-based overlay of severity-colored boxes on input screenshot
 *   - Non-overlapping label placement
 *   - Legend included
 *
 * RED state — implementation lands at T047 (Wave 5+). All assertions
 *   `it.todo` until then.
 *
 * Anchor: @AC-10 — Sharp severity-color overlays + non-overlapping labels
 *   + legend.
 */
import { describe, it } from 'vitest';

// NOTE (R3.1): import deliberately commented out so this file compiles +
// loads cleanly until T047 lands. Uncomment when pageAnnotateScreenshot.ts exists:
// import { pageAnnotateScreenshot } from '../../src/mcp/tools/pageAnnotateScreenshot.js';

describe('page_annotate_screenshot — AC-10 conformance (Wave 0 RED)', () => {
  /**
   * @AC-10 — output Buffer is a valid image (JPEG or PNG magic bytes).
   */
  it.todo('AC-10: output Buffer starts with valid image magic bytes (JPEG or PNG)');

  /**
   * @AC-10 — annotations rendered with severity-specific colors (e.g.,
   * critical=red, high=orange, medium=yellow, low=blue) verified by sampling
   * pixel colors at annotation centers.
   */
  it.todo('AC-10: annotations rendered with severity-specific colors at expected pixel positions');

  /**
   * @AC-10 — when 2 annotations overlap, labels are placed non-overlappingly
   * (vertical or horizontal offset applied).
   */
  it.todo('AC-10: overlapping annotations produce non-overlapping label placement');

  /**
   * @AC-10 — legend image region present in output (e.g., bottom-right or
   * dedicated band).
   */
  it.todo('AC-10: legend region present in output image');

  /**
   * @AC-10 — emits Pino correlation fields per T-PHASE2-LOGGER.
   */
  it.todo('AC-10: logs tool_name + tool_call_id + client_session_id correlation fields');
});
