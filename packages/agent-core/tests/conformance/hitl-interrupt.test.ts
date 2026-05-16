// AC-08 — LangGraph interrupt for HITL
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-08 v0.4
// REQ-IDs: R-08 + R8.4 + R4.3
// Linked task: T089
// Status: RED — implementation pending in Stage 2 Wave 8

import { describe, it } from 'vitest';

describe('AC-08 — HITL interrupt + resume + 5-min auto-timeout', () => {
  it.fails(
    'SafetyCheck emits `hitl_requested` → graph pauses at interrupt point → external resumeAudit(audit_run_id, decision) resumes/aborts; 5-min auto-timeout routes to escalate (hitl_timeout)',
    () => {
      throw new Error('NOT_IMPLEMENTED — T089 pending Wave 8');
    },
  );
});
