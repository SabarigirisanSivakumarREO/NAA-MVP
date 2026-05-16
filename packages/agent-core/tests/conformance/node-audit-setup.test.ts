// AC-02 — audit_setup LangGraph node
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-02 v0.4
// REQ-IDs: REQ-BROWSE-NODE-001 + R-02 + R-06
// Linked task: T082
// Status: RED — implementation pending in Stage 2 Wave 2

import { describe, it } from 'vitest';

describe('AC-02 — audit_setup node', () => {
  it.fails(
    'creates audit_run row in DB, initializes AuditState, emits LOCKED `audit_started` AuditEvent',
    () => {
      throw new Error('NOT_IMPLEMENTED — T082 pending Wave 2');
    },
  );
});
