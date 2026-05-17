// AC-16 — client_id thread-through (H1+H2 closure)
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-16 v0.4 (L164)
// REQ-IDs: R-14 + R14.1 + R14.4 (Phase 4 Stage 2.5 H1+H2 carry-forward closure)
// Linked task: T097
// Status: GREEN after Wave 4 (T084 wired `client_id: state.client_id` into
//   LLMCompleteRequest at BrowseNode.ts:121); this conformance test gates
//   the assertion mechanically so any future regression that re-introduces
//   PLACEHOLDER_UUID (or any well-known UUID-zero placeholder) is caught at
//   CI time, not in production llm_call_log forensics.
//
// AC-16 contract:
//   For every LLMAdapter.complete invocation reachable from BrowseNode
//   (action selection + corrective retries), the LLMCompleteRequest MUST
//   carry `client_id` populated from `AuditState.client_id`. The value
//   MUST equal the seeded client UUID; MUST NOT equal any of the known
//   placeholder strings used in Phase 4 (PLACEHOLDER_UUID literal at
//   src/adapters/AnthropicAdapter.ts:40 = '00000000-0000-0000-0000-000000000000').

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBrowseNode } from '../../src/orchestration/nodes/BrowseNode.js';
import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
} from '../../src/orchestration/AuditState.js';
import { PageStateModelSchema, type PageStateModel } from '../../src/perception/types.js';
import type {
  LLMCompleteRequest,
  LLMCompleteResponse,
} from '../../src/adapters/LLMAdapter.js';
import type { MCPToolDefinition } from '../../src/mcp/types.js';
import type { AggregatedVerifyResult } from '../../src/verification/types.js';

// Seeded UUIDs — UUIDv4-shaped, non-zero, distinct from any known placeholder.
const SEEDED_AUDIT_RUN_ID = '11111111-1111-4111-8111-111111111111';
const SEEDED_CLIENT_ID = '22222222-2222-4222-8222-222222222222';

// Known placeholder strings the test must prove never reach LLMAdapter.complete.
// Mirrors AnthropicAdapter.ts:40 + any historical/legacy literals teams may
// reintroduce; failing this list catches the H1 regression mechanically.
const PLACEHOLDER_STRINGS = [
  '00000000-0000-0000-0000-000000000000',
  'PLACEHOLDER_UUID',
  'placeholder-uuid',
  '00000000-0000-4000-8000-000000000000',
] as const;

const FAKE_PSM: PageStateModel = PageStateModelSchema.parse({
  metadata: {
    url: 'https://example.com/landing',
    title: 'Landing',
    statusCode: 200,
    navigationStartedAt: '2026-05-16T00:00:00.000Z',
    navigationEndedAt: '2026-05-16T00:00:01.000Z',
  },
  accessibilityTree: { totalNodes: 1, root: { role: 'WebArea', name: 'Landing' } },
  filteredDOM: { top30: [] },
  interactiveGraph: { clickable: [], typeable: [], submittable: [] },
  diagnostics: {
    axNodeCount: 1, mutationsObserved: 0, stable: true,
    lowAxNodeCount: true, unstable: false, errors: [], warnings: [],
  },
});

function okProposal(): string {
  return JSON.stringify({ tool: 'browser_get_state', args: {}, reasoning: 'capture state' });
}

function llmResp(text: string): LLMCompleteResponse {
  return {
    text, model: 'mock-claude',
    usage: { promptTokens: 100, completionTokens: 50, cacheHit: false },
    costUsd: 0.001, durationMs: 50,
  };
}

function passingVerify(): AggregatedVerifyResult {
  return { ok: true, strategy: 'url_change', failures: [] };
}

function stubTool(): MCPToolDefinition<unknown, unknown> {
  return {
    name: 'browser_get_state', description: 'stub',
    inputSchema: z.record(z.string(), z.unknown()) as unknown as MCPToolDefinition<unknown, unknown>['inputSchema'],
    outputSchema: z.unknown() as unknown as MCPToolDefinition<unknown, unknown>['outputSchema'],
    safetyClass: 'safe',
    handler: vi.fn(async () => ({ ok: true })),
  };
}

function seededState(loopIter: number): AuditStateBrowseSubset {
  return AuditStateBrowseSubsetSchema.parse({
    audit_run_id: SEEDED_AUDIT_RUN_ID,
    client_id: SEEDED_CLIENT_ID,
    current_node: 'page_router',
    node_status: 'complete' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-16T00:00:00Z'),
    updated_at: new Date('2026-05-16T00:00:00Z'),
    urls_remaining: [],
    current_url: 'https://example.com/landing',
    budget_remaining_usd: 15.0,
    _phase8_extensions: { browse_loop_iteration: loopIter },
  });
}

describe('AC-16 — Browse-mode LLM client_id thread-through (H1+H2 closure)', () => {
  it('every LLMAdapter.complete invocation across multiple BrowseNode iterations carries state.client_id (never a placeholder)', async () => {
    const llmCalls: LLMCompleteRequest[] = [];
    const llm = {
      complete: vi.fn(async (req: LLMCompleteRequest): Promise<LLMCompleteResponse> => {
        llmCalls.push(req);
        return llmResp(okProposal());
      }),
      estimateCost: vi.fn(async () => 0),
    };
    const deps = {
      contextAssembler: { capture: vi.fn(async () => FAKE_PSM) },
      llm,
      toolRegistry: { get: vi.fn(() => stubTool()) },
      rateLimiter: { acquire: vi.fn(async () => undefined) },
      safety: { assertAllowed: vi.fn(async () => undefined) },
      verifyEngine: { verify: vi.fn(async () => passingVerify()) },
      scorer: {
        afterSuccess: vi.fn((c: number) => Math.min(1, c * 1.01)),
        afterFailure: vi.fn((c: number) => c * 0.97),
      },
      classifier: {
        classify: vi.fn(() => ({
          class: 'verify_failed' as const,
          subclass: 'navigation_did_not_complete',
          shouldRetry: true,
        })),
      },
      recorder: { recordEvent: vi.fn(async () => undefined) },
    };
    const node = createBrowseNode(deps);

    // Drive three successive browse iterations against the SAME seeded state.
    await node(seededState(0));
    await node(seededState(1));
    await node(seededState(2));

    // Each successful iteration takes exactly ONE LLM call (proposal accepted
    // on first attempt; no corrective retries on a passing parse).
    expect(llmCalls).toHaveLength(3);

    // Every call carries the seeded client_id AND audit_run_id.
    for (const call of llmCalls) {
      expect(call.client_id).toBe(SEEDED_CLIENT_ID);
      expect(call.audit_run_id).toBe(SEEDED_AUDIT_RUN_ID);
      // Negative assertion — defends against H1 regression.
      for (const placeholder of PLACEHOLDER_STRINGS) {
        expect(call.client_id).not.toBe(placeholder);
        expect(call.audit_run_id).not.toBe(placeholder);
      }
    }
  });

  it('corrective-retry LLM calls (operation="classify") also carry state.client_id (H1 defends across all attempts)', async () => {
    // Drive 3 LLM calls in a single iteration: primary parse fails twice,
    // exhausts retries; all 3 calls must carry seeded client_id.
    const llmCalls: LLMCompleteRequest[] = [];
    const llm = {
      complete: vi.fn(async (req: LLMCompleteRequest): Promise<LLMCompleteResponse> => {
        llmCalls.push(req);
        // Return a payload that fails ActionProposalSchema (unknown tool).
        return llmResp('{"tool": "made_up_tool", "args": {}, "reasoning": "x"}');
      }),
      estimateCost: vi.fn(async () => 0),
    };
    const deps = {
      contextAssembler: { capture: vi.fn(async () => FAKE_PSM) },
      llm,
      toolRegistry: { get: vi.fn(() => stubTool()) },
      rateLimiter: { acquire: vi.fn(async () => undefined) },
      safety: { assertAllowed: vi.fn(async () => undefined) },
      verifyEngine: { verify: vi.fn(async () => passingVerify()) },
      scorer: {
        afterSuccess: vi.fn((c: number) => c),
        afterFailure: vi.fn((c: number) => c),
      },
      classifier: {
        classify: vi.fn(() => ({
          class: 'verify_failed' as const,
          subclass: 'navigation_did_not_complete',
          shouldRetry: true,
        })),
      },
      recorder: { recordEvent: vi.fn(async () => undefined) },
    };
    const node = createBrowseNode(deps);
    await node(seededState(0));

    // 1 primary (operation='other') + 2 corrective (operation='classify') = 3 max.
    expect(llmCalls).toHaveLength(3);
    const ops = llmCalls.map((c) => c.operation);
    expect(ops).toEqual(['other', 'classify', 'classify']);
    for (const call of llmCalls) {
      expect(call.client_id).toBe(SEEDED_CLIENT_ID);
      for (const placeholder of PLACEHOLDER_STRINGS) {
        expect(call.client_id).not.toBe(placeholder);
      }
    }
  });
});
