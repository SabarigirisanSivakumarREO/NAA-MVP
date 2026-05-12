/**
 * AC-09 — page_screenshot_full conformance (Phase 2 T046).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-09 + R-09 + NF-Phase2-06
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T046
 *
 * AC-09 contract:
 *   - Scroll-stitch full-page screenshot up to 15000 px tall
 *   - JPEG output ≤ 2 MB via Sharp compression
 *   - NF-Phase2-06: < 30 s wall-clock for 15000 px page
 *
 * RED state — implementation lands at T046 (Wave 5+). All assertions
 *   `it.todo` until then.
 *
 * Anchor: @AC-09 — JPEG ≤ 2 MB ≤ 15000 px scroll-stitch via Sharp.
 */
import { describe, it } from 'vitest';

// NOTE (R3.1): import deliberately commented out so this file compiles +
// loads cleanly until T046 lands. Uncomment when pageScreenshotFull.ts exists:
// import { pageScreenshotFull } from '../../src/mcp/tools/pageScreenshotFull.js';

describe('page_screenshot_full — AC-09 conformance (Wave 0 RED)', () => {
  /**
   * @AC-09 — output Buffer is JPEG (magic-bytes start with 0xFF 0xD8).
   */
  it.todo('AC-09: output Buffer starts with JPEG magic bytes 0xFF 0xD8');

  /**
   * @AC-09 — output Buffer ≤ 2 MB on a 15000-px-tall fixture page
   * (compression target for downstream LLM token budget).
   */
  it.todo('AC-09: output Buffer length <= 2 * 1024 * 1024 bytes on 15000 px page');

  /**
   * @AC-09 — captures full scroll height (image height === page scroll height
   * up to 15000 px cap).
   */
  it.todo('AC-09: image height equals page scroll height (capped at 15000 px)');

  /**
   * @AC-09 — pages exceeding 15000 px are clipped at 15000 px (not rejected).
   */
  it.todo('AC-09: 20000 px page produces 15000 px screenshot (clip, not reject)');

  /**
   * @AC-09 — NF-Phase2-06: wall-clock < 30 s for 15000 px page.
   */
  it.todo('AC-09: NF-Phase2-06 — 15000 px screenshot completes in < 30 s');

  /**
   * @AC-09 — emits Pino correlation fields per T-PHASE2-LOGGER.
   */
  it.todo('AC-09: logs tool_name + tool_call_id + client_session_id correlation fields');
});
