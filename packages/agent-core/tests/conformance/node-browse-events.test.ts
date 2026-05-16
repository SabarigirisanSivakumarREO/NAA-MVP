// AC-17 — BrowseNode AuditEvent emission (page_browse_*)
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-17 v0.4
// REQ-IDs: R-04 + LOCKED AuditEventTypeEnum (22 names)
// Linked task: T085
// Status: RED — implementation pending in Stage 2 Wave 4

import { describe, it } from 'vitest';

describe('AC-17 — BrowseNode page_browse_* events', () => {
  it.fails(
    'emits LOCKED `page_browse_started` on browse-node entry per page + `page_browse_completed` on successful exit + `page_browse_failed` on unrecoverable failure (no non-LOCKED names)',
    () => {
      throw new Error('NOT_IMPLEMENTED — T085 pending Wave 4');
    },
  );
});
