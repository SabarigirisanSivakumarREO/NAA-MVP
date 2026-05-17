// AC-07 — Conditional edges routing (5-row FailureClass table + happy paths)
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-07 v0.4 (L155)
// REQ-IDs: REQ-BROWSE-GRAPH-001 + R-07 + R20-LOCKED FailureClass enum
// Linked task: T088
// Status: GREEN after T088 (Wave 7)
//
// Strategy: pure routing unit tests. We hand crafted AuditStateBrowseSubset
// fixtures (Zod-parsed from a base template) to the two exported routing
// functions and assert the destination string. NO LangGraph runtime is
// instantiated — T091 will wire these fns to addConditionalEdges().

import { describe, expect, it } from 'vitest';

import {
  BROWSE_EDGE_CONFIG,
  BROWSE_RETRY_CAP,
  routeFromBrowse,
  routeFromPageRouter,
} from '../../src/orchestration/edges.js';
import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
} from '../../src/orchestration/AuditState.js';

// ---------------------------------------------------------------------------
// Fixture builder — Zod-validated AuditStateBrowseSubset
// ---------------------------------------------------------------------------

function makeState(
  overrides: Partial<AuditStateBrowseSubset> = {},
): AuditStateBrowseSubset {
  const base = {
    audit_run_id: '11111111-1111-4111-8111-111111111111',
    client_id: '22222222-2222-4222-8222-222222222222',
    current_node: 'page_router',
    node_status: 'complete' as const,
    context_profile_id: '33333333-3333-4333-8333-333333333333',
    context_profile_hash:
      'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    pending_questions: [],
    business_type: 'unknown' as const,
    urls_remaining: ['https://example.com/next'],
    page_state_models: [],
    session_confidence: 1.0,
    budget_remaining_usd: 10.0,
    analysis_cost_usd: 0,
    created_at: new Date('2026-05-17T00:00:00Z'),
    updated_at: new Date('2026-05-17T00:00:00Z'),
    ...overrides,
  };
  return AuditStateBrowseSubsetSchema.parse(base);
}

// ---------------------------------------------------------------------------
// AC-07 — Happy paths
// ---------------------------------------------------------------------------

describe('AC-07 — BROWSE_EDGE_CONFIG static edges', () => {
  it('declares audit_setup → page_router as the only static edge', () => {
    expect(BROWSE_EDGE_CONFIG.static).toEqual([
      { from: 'audit_setup', to: 'page_router' },
    ]);
    expect(BROWSE_EDGE_CONFIG.conditional).toMatchObject({
      page_router: 'routeFromPageRouter',
      browse: 'routeFromBrowse',
    });
  });

  it('exports BROWSE_RETRY_CAP = 3 (distinct from NF-Phase5-02 cap of 5)', () => {
    expect(BROWSE_RETRY_CAP).toBe(3);
  });
});

describe('AC-07 — routeFromPageRouter (happy paths)', () => {
  it('Fixture A: PageRouter set current_url → routes to browse', () => {
    const state = makeState({ current_url: 'https://example.com/page-1' });
    expect(routeFromPageRouter(state)).toBe('browse');
  });

  it('Fixture B: PageRouter set completion_reason=success → routes to audit_complete', () => {
    const state = makeState({
      urls_remaining: [],
      completion_reason: 'success',
    });
    expect(routeFromPageRouter(state)).toBe('audit_complete');
  });

  it('Fixture B2: PageRouter set completion_reason=budget_exceeded → audit_complete', () => {
    const state = makeState({
      budget_remaining_usd: 0,
      completion_reason: 'budget_exceeded',
    });
    expect(routeFromPageRouter(state)).toBe('audit_complete');
  });

  it('Fixture B3: PageRouter dropped a URL (no current_url, no completion_reason) → re-enter page_router', () => {
    const state = makeState({
      urls_remaining: ['https://example.com/after-drop'],
    });
    expect(routeFromPageRouter(state)).toBe('page_router');
  });
});

describe('AC-07 — routeFromBrowse (happy path)', () => {
  it('Fixture C: browse success (no failure class) → routes to page_router for next URL', () => {
    const state = makeState({
      current_node: 'browse',
      current_url: 'https://example.com/just-completed',
      _phase8_extensions: { browse_loop_iteration: 1 },
    });
    expect(routeFromBrowse(state)).toBe('page_router');
  });
});

// ---------------------------------------------------------------------------
// AC-07 — 5-row FailureClass table
// ---------------------------------------------------------------------------

describe('AC-07 — routeFromBrowse 5-row FailureClass table', () => {
  it('Row 1a — verify_failed at iter < cap → retry (browse)', () => {
    const state = makeState({
      current_node: 'browse',
      current_url: 'https://example.com/x',
      _phase8_extensions: {
        browse_loop_iteration: 1,
        last_failure_class: 'verify_failed',
      },
    });
    expect(routeFromBrowse(state)).toBe('browse');
  });

  it('Row 1b — verify_failed at iter === cap-1 → still retry (browse, last attempt)', () => {
    const state = makeState({
      current_node: 'browse',
      current_url: 'https://example.com/x',
      _phase8_extensions: {
        browse_loop_iteration: BROWSE_RETRY_CAP - 1,
        last_failure_class: 'verify_failed',
      },
    });
    expect(routeFromBrowse(state)).toBe('browse');
  });

  it('Row 1c — verify_failed at iter === cap → escalate (audit_complete)', () => {
    const state = makeState({
      current_node: 'browse',
      current_url: 'https://example.com/x',
      _phase8_extensions: {
        browse_loop_iteration: BROWSE_RETRY_CAP,
        last_failure_class: 'verify_failed',
      },
    });
    expect(routeFromBrowse(state)).toBe('audit_complete');
  });

  it('Row 2 — safety_blocked → audit_complete', () => {
    const state = makeState({
      current_node: 'browse',
      current_url: 'https://example.com/x',
      _phase8_extensions: {
        browse_loop_iteration: 1,
        last_failure_class: 'safety_blocked',
      },
    });
    expect(routeFromBrowse(state)).toBe('audit_complete');
  });

  it('Row 3 — rate_limited → browse (no-op transition; RateLimiter is real gate)', () => {
    const state = makeState({
      current_node: 'browse',
      current_url: 'https://example.com/x',
      _phase8_extensions: {
        browse_loop_iteration: 2,
        last_failure_class: 'rate_limited',
      },
    });
    expect(routeFromBrowse(state)).toBe('browse');
  });

  it('Row 4 — unverifiable → page_router (skip this URL, try next)', () => {
    const state = makeState({
      current_node: 'browse',
      current_url: 'https://example.com/x',
      _phase8_extensions: {
        browse_loop_iteration: 1,
        last_failure_class: 'unverifiable',
      },
    });
    expect(routeFromBrowse(state)).toBe('page_router');
  });

  it('Row 5 — bot_detected_likely → audit_complete', () => {
    const state = makeState({
      current_node: 'browse',
      current_url: 'https://example.com/x',
      _phase8_extensions: {
        browse_loop_iteration: 1,
        last_failure_class: 'bot_detected_likely',
      },
    });
    expect(routeFromBrowse(state)).toBe('audit_complete');
  });
});

// ---------------------------------------------------------------------------
// AC-07 — Terminal & defensive cases
// ---------------------------------------------------------------------------

describe('AC-07 — routeFromBrowse terminal + defensive paths', () => {
  it('honors completion_reason set by BrowseNode abort path → audit_complete', () => {
    const state = makeState({
      current_node: 'browse',
      completion_reason: 'aborted',
      _phase8_extensions: {
        browse_loop_iteration: 1,
        cause_class: 'loop_runaway',
      },
    });
    expect(routeFromBrowse(state)).toBe('audit_complete');
  });

  it('R23 kill — throws on unknown last_failure_class (LOCKED enum drift guard)', () => {
    const state = makeState({
      current_node: 'browse',
      current_url: 'https://example.com/x',
      _phase8_extensions: {
        browse_loop_iteration: 1,
        last_failure_class: 'new_class_not_in_locked_enum',
      },
    });
    expect(() => routeFromBrowse(state)).toThrow(/unknown last_failure_class/);
  });

  it('verify_failed with no iteration field → defaults to 0, retries', () => {
    const state = makeState({
      current_node: 'browse',
      current_url: 'https://example.com/x',
      _phase8_extensions: {
        last_failure_class: 'verify_failed',
      },
    });
    expect(routeFromBrowse(state)).toBe('browse');
  });
});
