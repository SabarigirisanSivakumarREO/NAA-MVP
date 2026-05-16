// AC-16 — client_id thread-through (no PLACEHOLDER_UUID in llm_call_log for browse-mode)
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-16 v0.4
// REQ-IDs: R-14 + R14.1 + R14.4 (Phase 4 H1+H2 carry-forward closure)
// Linked task: T097
// Status: RED — implementation pending in Stage 2 Wave 11

import { describe, it } from 'vitest';

describe('AC-16 — Browse-mode LLM client_id thread-through', () => {
  it.fails(
    'asserts zero llm_call_log rows where client_id = PLACEHOLDER_UUID for any browse-mode invocation; AuditState.client_id flows through LLMCompleteRequest.client_id',
    () => {
      throw new Error('NOT_IMPLEMENTED — T097 pending Wave 11');
    },
  );
});
