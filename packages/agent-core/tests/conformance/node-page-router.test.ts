// AC-03 — page_router LangGraph node
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-03 v0.4
// REQ-IDs: REQ-BROWSE-NODE-002 + R-03 + R-06 (R4.3 + R8.1)
// Linked task: T083
// Status: GREEN after T083 (Wave 3)
//
// AC-03 contract:
//   page_router reads next URL from urls_remaining; gates on
//     (1) budget_remaining_usd > 0  (R8.1)
//     (2) DomainPolicy.classify(url) ≠ 'blocked'  (R4.3)
//     (3) CircuitBreaker.isOpen(domain) === false  (Phase 4)
//   Routes to `browse` (continue) OR `audit_complete` (terminate) via
//   edges (T088) by emitting a state slice whose shape encodes the decision:
//     - completion_reason in slice → edges fan to audit_complete
//     - current_url in slice → edges fan to browse
//     - neither (drop) → edges re-enter page_router on remaining queue
//
// Pure routing — no I/O beyond Phase 4 adapter calls (DomainPolicy +
// CircuitBreaker). The node makes ONE routing decision per invocation;
// dropped URLs leave a shrunk `urls_remaining` for the edges loop-back.

import { describe, expect, it, vi } from 'vitest';

import { createPageRouterNode } from '../../src/orchestration/nodes/PageRouterNode.js';
import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
} from '../../src/orchestration/AuditState.js';
import { CircuitBreaker } from '../../src/safety/CircuitBreaker.js';
import { DomainPolicy } from '../../src/safety/DomainPolicy.js';

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000501';
const CLIENT_ID = '00000000-0000-4000-8000-000000000502';

function baseState(
  overrides: Partial<AuditStateBrowseSubset> = {},
): AuditStateBrowseSubset {
  const fixture = {
    audit_run_id: AUDIT_RUN_ID,
    client_id: CLIENT_ID,
    current_node: 'audit_setup',
    node_status: 'complete' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-16T00:00:00Z'),
    updated_at: new Date('2026-05-16T00:00:00Z'),
    urls_remaining: ['https://example.com/a', 'https://example.com/b'],
    budget_remaining_usd: 15.0,
    ...overrides,
  };
  return AuditStateBrowseSubsetSchema.parse(fixture);
}

// ---------------------------------------------------------------------------
// AC-03 — four routing branches
// ---------------------------------------------------------------------------

describe('AC-03 — page_router node', () => {
  it('terminates with completion_reason=budget_exceeded when budget_remaining_usd <= 0 (R8.1)', async () => {
    const domainPolicy = new DomainPolicy({ trusted: [], blocked: [] });
    const circuitBreaker = new CircuitBreaker();
    const classifySpy = vi.spyOn(domainPolicy, 'classify');
    const isOpenSpy = vi.spyOn(circuitBreaker, 'isOpen');

    const node = createPageRouterNode({ domainPolicy, circuitBreaker });
    const state = baseState({ budget_remaining_usd: 0 });

    const slice = await node(state);

    expect(slice.current_node).toBe('page_router');
    expect(slice.node_status).toBe('complete');
    expect(slice.completion_reason).toBe('budget_exceeded');
    expect(slice.current_url).toBeUndefined();
    // Budget gate fires FIRST — no policy/breaker calls.
    expect(classifySpy).not.toHaveBeenCalled();
    expect(isOpenSpy).not.toHaveBeenCalled();
  });

  it('terminates with completion_reason=success when urls_remaining is empty', async () => {
    const domainPolicy = new DomainPolicy({ trusted: [], blocked: [] });
    const circuitBreaker = new CircuitBreaker();
    const classifySpy = vi.spyOn(domainPolicy, 'classify');
    const isOpenSpy = vi.spyOn(circuitBreaker, 'isOpen');

    const node = createPageRouterNode({ domainPolicy, circuitBreaker });
    const state = baseState({ urls_remaining: [] });

    const slice = await node(state);

    expect(slice.current_node).toBe('page_router');
    expect(slice.node_status).toBe('complete');
    expect(slice.completion_reason).toBe('success');
    expect(slice.current_url).toBeUndefined();
    expect(classifySpy).not.toHaveBeenCalled();
    expect(isOpenSpy).not.toHaveBeenCalled();
  });

  it('drops a blocked-domain URL and shrinks urls_remaining (R4.3 DomainPolicy.classify === blocked)', async () => {
    const domainPolicy = new DomainPolicy({
      trusted: [],
      blocked: ['blocked.example.com'],
    });
    const circuitBreaker = new CircuitBreaker();
    const isOpenSpy = vi.spyOn(circuitBreaker, 'isOpen');

    const node = createPageRouterNode({ domainPolicy, circuitBreaker });
    const state = baseState({
      urls_remaining: [
        'https://blocked.example.com/x',
        'https://example.com/b',
      ],
    });

    const slice = await node(state);

    expect(slice.current_node).toBe('page_router');
    expect(slice.node_status).toBe('complete');
    // Drop signal: no completion_reason, no current_url; urls_remaining
    // shrinks so edges (T088) re-enter page_router on the rest.
    expect(slice.completion_reason).toBeUndefined();
    expect(slice.current_url).toBeUndefined();
    expect(slice.urls_remaining).toEqual(['https://example.com/b']);
    // CircuitBreaker not consulted — blocked gate fires first.
    expect(isOpenSpy).not.toHaveBeenCalled();
  });

  it('drops a circuit-open URL and shrinks urls_remaining (CircuitBreaker.isOpen === true)', async () => {
    const domainPolicy = new DomainPolicy({ trusted: [], blocked: [] });
    const circuitBreaker = new CircuitBreaker({ failureThreshold: 3 });
    // Trip the breaker for example.com (3 consecutive failures).
    circuitBreaker.recordFailure('flaky.example.com');
    circuitBreaker.recordFailure('flaky.example.com');
    circuitBreaker.recordFailure('flaky.example.com');
    expect(circuitBreaker.isOpen('flaky.example.com')).toBe(true);

    const node = createPageRouterNode({ domainPolicy, circuitBreaker });
    const state = baseState({
      urls_remaining: [
        'https://flaky.example.com/x',
        'https://example.com/b',
      ],
    });

    const slice = await node(state);

    expect(slice.current_node).toBe('page_router');
    expect(slice.node_status).toBe('complete');
    expect(slice.completion_reason).toBeUndefined();
    expect(slice.current_url).toBeUndefined();
    expect(slice.urls_remaining).toEqual(['https://example.com/b']);
  });

  it('routes to browse with next URL when all gates pass (happy path)', async () => {
    const domainPolicy = new DomainPolicy({
      trusted: ['example.com'],
      blocked: [],
    });
    const circuitBreaker = new CircuitBreaker();

    const node = createPageRouterNode({ domainPolicy, circuitBreaker });
    const state = baseState({
      urls_remaining: [
        'https://example.com/a',
        'https://example.com/b',
      ],
    });

    const slice = await node(state);

    expect(slice.current_node).toBe('page_router');
    expect(slice.node_status).toBe('complete');
    expect(slice.completion_reason).toBeUndefined();
    expect(slice.current_url).toBe('https://example.com/a');
    expect(slice.urls_remaining).toEqual(['https://example.com/b']);
    expect(slice.updated_at).toBeInstanceOf(Date);
  });

  it('routes unknown-classification URLs as allowed (only blocked is dropped)', async () => {
    // DomainPolicy returns 'unknown' when neither trusted nor blocked matches.
    // Per R-03 + spec L98, unknown is allowed (with downstream rate-limiting);
    // only 'blocked' triggers a drop.
    const domainPolicy = new DomainPolicy({ trusted: [], blocked: [] });
    const circuitBreaker = new CircuitBreaker();

    const node = createPageRouterNode({ domainPolicy, circuitBreaker });
    const state = baseState({
      urls_remaining: ['https://unknown.example.com/x'],
    });

    const slice = await node(state);

    expect(slice.current_url).toBe('https://unknown.example.com/x');
    expect(slice.urls_remaining).toEqual([]);
    expect(slice.completion_reason).toBeUndefined();
  });

  it('emits a Zod-valid Partial<AuditStateBrowseSubset> slice for every branch', async () => {
    // R2.2 — slice validates against the partial schema regardless of branch.
    const domainPolicy = new DomainPolicy({
      trusted: [],
      blocked: ['blocked.example.com'],
    });
    const circuitBreaker = new CircuitBreaker();
    const node = createPageRouterNode({ domainPolicy, circuitBreaker });

    const branches: Array<Partial<AuditStateBrowseSubset>> = [
      await node(baseState({ budget_remaining_usd: 0 })),
      await node(baseState({ urls_remaining: [] })),
      await node(
        baseState({
          urls_remaining: ['https://blocked.example.com/x'],
        }),
      ),
      await node(baseState()),
    ];

    for (const slice of branches) {
      const result = AuditStateBrowseSubsetSchema.partial().safeParse(slice);
      expect(result.success).toBe(true);
    }
  });
});
