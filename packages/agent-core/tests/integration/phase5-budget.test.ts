// AC-15 — Integration test: budget exhaustion
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-15 v0.4
// REQ-IDs: R-11 + R-13 + R8.1
// Linked task: T096
// Status: RED — implementation pending in Stage 2 Wave 12

import { describe, it } from 'vitest';

describe('AC-15 — Phase 5 budget exhaustion integration', () => {
  it.fails(
    'MockAnthropicAdapter cost_per_call_usd=0.03; audit_run budget_remaining_usd=0.05; loop debits across pages; on exhaustion audit terminates with completion_reason=budget_exceeded; remaining pages NOT entered',
    () => {
      throw new Error('NOT_IMPLEMENTED — T096 pending Wave 12');
    },
  );
});
