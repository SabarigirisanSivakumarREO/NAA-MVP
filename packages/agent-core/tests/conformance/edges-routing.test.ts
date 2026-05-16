// AC-07 — Conditional edges with FailureClass routing table
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-07 v0.4
// REQ-IDs: R-07 + R20-LOCKED FailureClass enum
// Linked task: T088
// Status: RED — implementation pending in Stage 2 Wave 7

import { describe, it } from 'vitest';

describe('AC-07 — Conditional edges routing (5-row FailureClass table)', () => {
  it.fails(
    '5-row routing: verify_failed → retry(3) → replan → escalate; safety_blocked → audit_complete(aborted); rate_limited → RateLimiter backoff (no graph transition); unverifiable → page_router; bot_detected_likely → audit_complete(aborted)',
    () => {
      throw new Error('NOT_IMPLEMENTED — T088 pending Wave 7');
    },
  );
});
