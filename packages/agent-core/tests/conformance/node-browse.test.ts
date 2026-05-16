// AC-04 — BrowseNode (action selection + verify+route)
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-04 v0.4
// REQ-IDs: REQ-BROWSE-NODE-003 + R-04 + R-06
// Linked tasks: T084 (action selection) + T085 (verify+route)
// Status: RED — implementation pending in Stage 2 Wave 4

import { describe, it } from 'vitest';

describe('AC-04 — BrowseNode', () => {
  describe('actionSelection (T084)', () => {
    it.fails(
      'captures PageStateModel via ContextAssembler + calls LLMAdapter with operation=other temp=0.5 + Zod-parses ActionProposalSchema',
      () => {
        throw new Error('NOT_IMPLEMENTED — T084 pending Wave 4');
      },
    );
  });
  describe('verifyAndRoute (T085)', () => {
    it.fails(
      'runs SafetyCheck → MCP tool → VerifyEngine → ConfidenceScorer → FailureClassifier in that order; updates state; emits page_browse_* AuditEvents (AC-17)',
      () => {
        throw new Error('NOT_IMPLEMENTED — T085 pending Wave 4');
      },
    );
  });
});
