// AC-05 — audit_complete LangGraph node
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-05 v0.4
// REQ-IDs: REQ-BROWSE-NODE-002 + R-05 + R-06
// Linked task: T086
// Status: RED — implementation pending in Stage 2 Wave 5

import { describe, it } from 'vitest';

describe('AC-05 — audit_complete node', () => {
  it.fails(
    'writes terminal AuditState fields + sets audit_runs.completion_reason + emits LOCKED `audit_completed` or `audit_failed`; on completion_reason=aborted writes metadata.cause_class ∈ {hitl_timeout, bot_detected, safety_blocked, circuit_open}',
    () => {
      throw new Error('NOT_IMPLEMENTED — T086 pending Wave 5');
    },
  );
});
