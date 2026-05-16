// AC-01 — AuditState (browse-mode subset) Zod schema
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-01 v0.4
// REQ-IDs: REQ-BROWSE-NODE-001 + R-01 + R-06
// Linked task: T081
// Status: RED — implementation pending in Stage 2 Wave 1

import { describe, it } from 'vitest';

describe('AC-01 — AuditState browse-mode subset', () => {
  it.fails(
    'Zod-parses 5 fixtures (including `_phase8_extensions` populated) and rejects schema-violating field; extends Phase 4b base via z.extend()',
    () => {
      throw new Error('NOT_IMPLEMENTED — T081 pending Wave 1');
    },
  );
});
