// AC-18 — Audit-level wall-clock cap (60-min MVP hardcode)
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-18 v0.4
// REQ-IDs: R-05 + R8.1 (Phase 4b R20 amendment for configurable wiring is v1.1)
// Linked task: T086
// Status: RED — implementation pending in Stage 2 Wave 5

import { describe, it } from 'vitest';

describe('AC-18 — Audit wall-clock timeout (60 min MVP)', () => {
  it.fails(
    'on 60-min wall-clock cap audit terminates cleanly with completion_reason=timeout; emits LOCKED `audit_failed` AuditEvent with metadata.cause_class=wall_clock_timeout',
    () => {
      throw new Error('NOT_IMPLEMENTED — T086 pending Wave 5');
    },
  );
});
