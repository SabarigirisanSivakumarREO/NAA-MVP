// AC-12 — Integration test: amazon.in multi-step workflow + CAPTCHA edge
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-12 v0.4
// REQ-IDs: R-11 + R-04 + R-07
// Linked task: T093
// Status: RED — implementation pending in Stage 2 Wave 12

import { describe, it } from 'vitest';

describe('AC-12 — Phase 5 amazon.in multi-step workflow integration', () => {
  it.fails(
    'https://www.amazon.in search "headphones" → click first result → verify product page: 3 actions + 3 verifies pass + confidence > 0.85; CAPTCHA wall edge → bot_detected_likely → completion_reason=aborted with clean rollup',
    () => {
      throw new Error('NOT_IMPLEMENTED — T093 pending Wave 12');
    },
  );
});
