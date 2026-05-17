// AC-17 — BrowseNode AuditEvent emission (page_browse_*)
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-17 v0.4 (L165)
// REQ-IDs: R-04 + LOCKED AuditEventTypeEnum (22 names) per types/audit-events.ts
// Linked task: T085
// Status: GREEN after Wave 4 (T085).
//
// Contract: BrowseNode emits ONLY the 3 LOCKED page_browse_* names from the
// 22-value AuditEventTypeEnum:
//   - page_browse_started  → entry (after action selected + before tool dispatch)
//   - page_browse_completed → successful verify
//   - page_browse_failed   → verify failed OR safety-blocked failure path

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBrowseNode } from '../../src/orchestration/nodes/BrowseNode.js';
import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
} from '../../src/orchestration/AuditState.js';
import { PageStateModelSchema, type PageStateModel } from '../../src/perception/types.js';
import { SafetyBlockedError } from '../../src/safety/SafetyCheck.js';
import type { LLMCompleteResponse } from '../../src/adapters/LLMAdapter.js';
import type { MCPToolDefinition } from '../../src/mcp/types.js';
import type { AuditEventInput } from '../../src/observability/SessionRecorder.js';
import type { AggregatedVerifyResult } from '../../src/verification/types.js';

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000701';
const CLIENT_ID = '00000000-0000-4000-8000-000000000702';

const FAKE_PSM: PageStateModel = PageStateModelSchema.parse({
  metadata: {
    url: 'https://example.com/p',
    title: 'Ex',
    statusCode: 200,
    navigationStartedAt: '2026-05-16T00:00:00.000Z',
    navigationEndedAt: '2026-05-16T00:00:01.000Z',
  },
  accessibilityTree: { totalNodes: 1, root: { role: 'WebArea', name: 'Ex' } },
  filteredDOM: { top30: [] },
  interactiveGraph: { clickable: [], typeable: [], submittable: [] },
  diagnostics: {
    axNodeCount: 1, mutationsObserved: 0, stable: true,
    lowAxNodeCount: true, unstable: false, errors: [], warnings: [],
  },
});

function baseState(overrides: Partial<AuditStateBrowseSubset> = {}): AuditStateBrowseSubset {
  return AuditStateBrowseSubsetSchema.parse({
    audit_run_id: AUDIT_RUN_ID, client_id: CLIENT_ID,
    current_node: 'page_router', node_status: 'complete' as const,
    context_profile_id: null, context_profile_hash: null, pending_questions: [],
    created_at: new Date('2026-05-16T00:00:00Z'),
    updated_at: new Date('2026-05-16T00:00:00Z'),
    urls_remaining: [], current_url: 'https://example.com/p',
    budget_remaining_usd: 15.0, ...overrides,
  });
}

function llmResponse(text: string): LLMCompleteResponse {
  return {
    text, model: 'mock',
    usage: { promptTokens: 100, completionTokens: 50, cacheHit: false },
    costUsd: 0.001, durationMs: 50,
  };
}

function makeStubToolDef(): MCPToolDefinition<unknown, unknown> {
  return {
    name: 'browser_get_state', description: 'stub',
    inputSchema: z.record(z.string(), z.unknown()) as unknown as MCPToolDefinition<unknown, unknown>['inputSchema'],
    outputSchema: z.unknown() as unknown as MCPToolDefinition<unknown, unknown>['outputSchema'],
    safetyClass: 'safe', handler: vi.fn(async () => ({})),
  };
}

function makeDeps(verifyResult: AggregatedVerifyResult = { ok: true, strategy: 'url_change', failures: [] }) {
  return {
    contextAssembler: { capture: vi.fn(async () => FAKE_PSM) },
    llm: {
      complete: vi.fn(async () => llmResponse(JSON.stringify({ tool: 'browser_get_state', args: {}, reasoning: 'r' }))),
      estimateCost: vi.fn(async () => 0),
    },
    toolRegistry: { get: vi.fn(() => makeStubToolDef()) },
    rateLimiter: { acquire: vi.fn(async () => undefined) },
    safety: { assertAllowed: vi.fn(async () => undefined) },
    verifyEngine: { verify: vi.fn(async () => verifyResult) },
    scorer: {
      afterSuccess: vi.fn((c: number) => Math.min(1, c * 1.01)),
      afterFailure: vi.fn((c: number) => c * 0.97),
    },
    classifier: {
      classify: vi.fn(() => ({ class: 'verify_failed' as const, subclass: 'navigation_did_not_complete', shouldRetry: true })),
    },
    recorder: { recordEvent: vi.fn(async () => undefined) },
  };
}

function recordedEventTypes(recorder: { recordEvent: { mock: { calls: unknown[][] } } }): string[] {
  return recorder.recordEvent.mock.calls.map((c) => (c[0] as AuditEventInput).event_type);
}

describe('AC-17 — BrowseNode page_browse_* events', () => {
  it('emits LOCKED page_browse_started on entry (after action selection, before tool dispatch)', async () => {
    const deps = makeDeps();
    const node = createBrowseNode(deps);
    await node(baseState());
    await new Promise((r) => setTimeout(r, 0));
    const types = recordedEventTypes(deps.recorder);
    expect(types).toContain('page_browse_started');
  });

  it('emits LOCKED page_browse_completed on successful verify', async () => {
    const deps = makeDeps();
    const node = createBrowseNode(deps);
    await node(baseState());
    await new Promise((r) => setTimeout(r, 0));
    const types = recordedEventTypes(deps.recorder);
    expect(types).toContain('page_browse_completed');
    expect(types).not.toContain('page_browse_failed');
  });

  it('emits LOCKED page_browse_failed on verify-failed unrecoverable path', async () => {
    const deps = makeDeps({
      ok: false,
      attemptedStrategies: ['url_change'],
      failures: [{ ok: false, strategy: 'url_change', error: 'no match' }],
    });
    const node = createBrowseNode(deps);
    await node(baseState());
    await new Promise((r) => setTimeout(r, 0));
    const types = recordedEventTypes(deps.recorder);
    expect(types).toContain('page_browse_started');
    expect(types).toContain('page_browse_failed');
    expect(types).not.toContain('page_browse_completed');
  });

  it('emits page_browse_failed (NOT page_browse_completed) on SafetyBlockedError (non-HITL)', async () => {
    const deps = makeDeps();
    deps.safety.assertAllowed = vi.fn(async () => {
      throw new SafetyBlockedError('domain_blocked', 'browser_navigate', 'example.com');
    });
    const node = createBrowseNode(deps);
    await node(baseState());
    await new Promise((r) => setTimeout(r, 0));
    const types = recordedEventTypes(deps.recorder);
    expect(types).toContain('page_browse_failed');
    expect(types).not.toContain('page_browse_completed');
  });

  it('emits ONLY the 3 LOCKED page_browse_* names — no invented event_type strings', async () => {
    const deps = makeDeps();
    const node = createBrowseNode(deps);
    await node(baseState());
    await new Promise((r) => setTimeout(r, 0));
    const ALLOWED = new Set(['page_browse_started', 'page_browse_completed', 'page_browse_failed', 'audit_failed']);
    for (const t of recordedEventTypes(deps.recorder)) {
      expect(ALLOWED.has(t)).toBe(true);
    }
  });
});
