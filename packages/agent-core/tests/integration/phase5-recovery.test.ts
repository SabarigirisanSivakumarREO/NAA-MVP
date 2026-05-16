// AC-14 — Integration test: recovery from synthetic verify_failed
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-14 v0.4
// REQ-IDs: R-11 + R-07 (FailureClass routing)
// Linked task: T095
// Status: RED — implementation pending in Stage 2 Wave 12

import { describe, it } from 'vitest';

describe('AC-14 — Phase 5 recovery integration', () => {
  it.fails(
    'synthetic verify_failed on action 2 of 4: FailureClassifier routes retry (1x) → replan (LLM picks alternate action) → success → audit_complete',
    () => {
      throw new Error('NOT_IMPLEMENTED — T095 pending Wave 12');
    },
  );
});
