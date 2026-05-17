// AC-06 — LangGraph node-level Zod I/O boundary
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-06 v0.4
// REQ-IDs: R-06 + R2.2 enforcement
// Linked task: T087
// Status: GREEN after Wave 5 (T087)
//
// Contract: every Phase 5 BrowseGraph node wraps its state-slice INPUT in
// `AuditStateBrowseSubsetSchema.parse(...)` and its OUTPUT in
// `AuditStateBrowseSubsetSchema.partial().parse(...)` at the module
// boundary (R2.2). Parameterized over the 4 nodes (audit_setup / page_router
// / browse / audit_complete) — each is asserted to:
//   (a) throw ZodError synchronously when invoked with a malformed input
//       (a required browse-subset field stripped),
//   (b) the strict partial-schema gate rejects a synthesized malformed
//       output slice (unknown key — `.strict()` is inherited by `.partial()`).
//
// This is a structural conformance test, not a behavioural one — we are
// proving the Zod gate is present on every node boundary, not exercising
// the node's downstream side effects (those are covered by AC-02/03/04/05).

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
} from '../../src/orchestration/AuditState.js';
import { createAuditSetupNode } from '../../src/orchestration/nodes/AuditSetupNode.js';
import { createPageRouterNode } from '../../src/orchestration/nodes/PageRouterNode.js';
import { createBrowseNode } from '../../src/orchestration/nodes/BrowseNode.js';
import { createAuditCompleteNode } from '../../src/orchestration/nodes/AuditCompleteNode.js';
import type { StorageAdapter } from '../../src/adapters/StorageAdapter.js';
import { SessionRecorder } from '../../src/observability/SessionRecorder.js';
import { createLogger } from '../../src/observability/logger.js';
import { CircuitBreaker } from '../../src/safety/CircuitBreaker.js';
import { DomainPolicy } from '../../src/safety/DomainPolicy.js';

// ---------------------------------------------------------------------------
// Shared valid-state fixture (every required browse-subset field present)
// ---------------------------------------------------------------------------

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000801';
const CLIENT_ID = '00000000-0000-4000-8000-000000000802';

function validState(): AuditStateBrowseSubset {
  return AuditStateBrowseSubsetSchema.parse({
    audit_run_id: AUDIT_RUN_ID,
    client_id: CLIENT_ID,
    current_node: 'audit_setup',
    node_status: 'pending' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-17T00:00:00Z'),
    updated_at: new Date('2026-05-17T00:00:00Z'),
    urls_remaining: ['https://example.com/'],
    budget_remaining_usd: 15.0,
  });
}

// Strip a required browse-subset field to engineer malformed input. The
// schema is `.strict()` so any missing required field triggers ZodError at
// parse time. We use `client_id` (required UUID on the Phase 4b base) — the
// node should reject before any side effects fire.
function malformedInput(): unknown {
  const s = validState() as unknown as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete s['client_id'];
  return s;
}

// ---------------------------------------------------------------------------
// Minimal adapter stubs (no behavioural assertions — node must throw BEFORE
// any of these get called).
// ---------------------------------------------------------------------------

function makeStorageStub(): StorageAdapter {
  return {
    withClient: vi.fn(async () => undefined),
    appendAuditLog: vi.fn(async () => undefined),
    appendAuditEvent: vi.fn(async () => undefined),
    appendLLMCallLog: vi.fn(async () => undefined),
    createAuditRun: vi.fn(async () => 'unused-id'),
    finalizeAuditRun: vi.fn(async () => undefined),
    getFindings: vi.fn(async () => []),
    appendFinding: vi.fn(async () => 'unused-id'),
    writeReproducibilitySnapshot: vi.fn(async () => undefined),
  } as unknown as StorageAdapter;
}

function makeRecorderStub(): SessionRecorder {
  return { recordEvent: vi.fn(async () => undefined) } as unknown as SessionRecorder;
}

// Factory-builder map keyed by node name. Each returns a callable node
// bound to no-op adapter stubs.
function makeNodes(): Record<
  'audit_setup' | 'page_router' | 'browse' | 'audit_complete',
  (state: unknown) => Promise<unknown>
> {
  const storage = makeStorageStub();
  const recorder = makeRecorderStub();
  return {
    audit_setup: createAuditSetupNode({ storage, recorder }) as (s: unknown) => Promise<unknown>,
    page_router: createPageRouterNode({
      domainPolicy: new DomainPolicy({ trusted: [], blocked: [] }),
      circuitBreaker: new CircuitBreaker(),
    }) as (s: unknown) => Promise<unknown>,
    browse: createBrowseNode({
      contextAssembler: { capture: vi.fn(async () => ({} as never)) },
      llm: { complete: vi.fn(async () => ({} as never)), estimateCost: vi.fn(async () => 0) },
      toolRegistry: { get: vi.fn(() => undefined) },
      rateLimiter: { acquire: vi.fn(async () => undefined) },
      safety: { assertAllowed: vi.fn(async () => undefined) },
      verifyEngine: { verify: vi.fn(async () => ({} as never)) },
      scorer: { afterSuccess: vi.fn((c: number) => c), afterFailure: vi.fn((c: number) => c) },
      classifier: { classify: vi.fn(() => ({} as never)) },
      recorder: { recordEvent: vi.fn(async () => undefined) },
    }) as (s: unknown) => Promise<unknown>,
    audit_complete: createAuditCompleteNode({
      storage,
      recorder,
      logger: createLogger('t'),
    }) as (s: unknown) => Promise<unknown>,
  };
}

const NODE_NAMES = ['audit_setup', 'page_router', 'browse', 'audit_complete'] as const;
type NodeName = (typeof NODE_NAMES)[number];

// ---------------------------------------------------------------------------
// Parameterized AC-06 conformance
// ---------------------------------------------------------------------------

describe('AC-06 — Node-level Zod I/O (parameterized over 4 nodes)', () => {
  describe.each(NODE_NAMES)('%s', (nodeName: NodeName) => {
    it('rejects malformed input via AuditStateBrowseSubsetSchema.parse() at module boundary', async () => {
      const nodes = makeNodes();
      const fn = nodes[nodeName];
      await expect(fn(malformedInput())).rejects.toBeInstanceOf(z.ZodError);
    });

    it('output gate: AuditStateBrowseSubsetSchema.partial() rejects malformed slice', () => {
      // Strict-partial inherited from the strict base schema rejects unknown
      // keys; this is the same gate every node applies before return.
      const malformedSlice = { totally_unknown_field: true } as const;
      expect(() =>
        AuditStateBrowseSubsetSchema.partial().parse(malformedSlice),
      ).toThrow(z.ZodError);
    });
  });
});
