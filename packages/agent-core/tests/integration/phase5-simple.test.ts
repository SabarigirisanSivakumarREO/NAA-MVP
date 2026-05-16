// AC-11 — Integration test: simple navigation (example.com + bbc.com)
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-11 v0.4
// REQ-IDs: R-11 + R-10
// Linked task: T092
// Status: RED — implementation pending in Stage 2 Wave 12

import { describe, it } from 'vitest';

describe('AC-11 — Phase 5 simple navigation integration', () => {
  it.fails(
    'browses https://example.com + https://www.bbc.com end-to-end; no actions taken; audit_complete with completion_reason=success',
    () => {
      throw new Error('NOT_IMPLEMENTED — T092 pending Wave 12');
    },
  );
});
