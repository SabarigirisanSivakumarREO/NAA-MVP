// AC-03 — page_router LangGraph node
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-03 v0.4
// REQ-IDs: REQ-BROWSE-NODE-002 + R-03 + R-06
// Linked task: T083
// Status: RED — implementation pending in Stage 2 Wave 3

import { describe, it } from 'vitest';

describe('AC-03 — page_router node', () => {
  it.fails(
    'reads next URL from urls_remaining, checks budget + circuit breaker + domain policy, routes to browse OR audit_complete',
    () => {
      throw new Error('NOT_IMPLEMENTED — T083 pending Wave 3');
    },
  );
});
