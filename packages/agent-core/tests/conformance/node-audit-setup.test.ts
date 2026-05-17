// AC-02 — audit_setup LangGraph node
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-02 v0.4
// REQ-IDs: REQ-BROWSE-NODE-001 + R-02 + R-06
// Linked task: T082
// Status: GREEN after T082 (Wave 2)
//
// Strategy: this is a UNIT conformance test, not an integration test. The
// node's two side-effects — `audit_runs` INSERT + `audit_events` INSERT —
// flow through `StorageAdapter` and `SessionRecorder` adapter interfaces
// (R9). We inject in-memory spies for both and assert call shapes; the
// real Postgres-backed path is covered by Wave 7 integration tests against
// a live DB (out of scope for this AC).

import { describe, expect, it, vi } from 'vitest';

import {
  createAuditSetupNode,
  type SessionRecorderLike,
} from '../../src/orchestration/nodes/AuditSetupNode.js';
import { AuditStateBrowseSubsetSchema } from '../../src/orchestration/AuditState.js';
import type {
  AuditLogInsert,
  AuditRunInsert,
  FindingInsert,
  ReproducibilitySnapshotInsert,
  StorageAdapter,
  StorageTx,
} from '../../src/adapters/StorageAdapter.js';
import type { AuditEvent } from '../../src/types/audit-events.js';
import type { LLMCallRecord } from '../../src/types/llm.js';
import type { FindingRow } from '../../src/db/index.js';
import type { AuditEventInput } from '../../src/observability/SessionRecorder.js';

// ---------------------------------------------------------------------------
// In-memory adapter doubles (R9-compliant; no pg/drizzle imports)
// ---------------------------------------------------------------------------

interface CapturedCalls {
  createAuditRun: AuditRunInsert[];
  appendAuditEvent: AuditEvent[];
}

function makeFakeStorage(): { storage: StorageAdapter; calls: CapturedCalls; nextRunId: string } {
  const calls: CapturedCalls = { createAuditRun: [], appendAuditEvent: [] };
  const FIXED_RUN_ID = '99999999-9999-4999-8999-999999999999';

  const storage: StorageAdapter = {
    withClient: async <T,>(_clientId: string, fn: (tx: StorageTx) => Promise<T>): Promise<T> => {
      // Minimal tx double — the AuditSetupNode never calls withClient directly,
      // but the type requires the method exist.
      const tx: StorageTx = {
        query: async () => ({ rows: [] }),
        appendAuditLog: async () => undefined,
        appendAuditEvent: async (event: AuditEvent) => {
          calls.appendAuditEvent.push(event);
        },
        appendLLMCallLog: async () => undefined,
      };
      return fn(tx);
    },
    appendAuditLog: async (_entry: AuditLogInsert): Promise<void> => undefined,
    appendAuditEvent: async (event: AuditEvent): Promise<void> => {
      calls.appendAuditEvent.push(event);
    },
    appendLLMCallLog: async (_record: LLMCallRecord): Promise<void> => undefined,
    createAuditRun: async (entry: AuditRunInsert): Promise<string> => {
      calls.createAuditRun.push(entry);
      return FIXED_RUN_ID;
    },
    finalizeAuditRun: async (): Promise<void> => undefined,
    getFindings: async (): Promise<readonly FindingRow[]> => [],
    appendFinding: async (_entry: FindingInsert): Promise<string> => 'unused-finding-id',
    writeReproducibilitySnapshot: async (_entry: ReproducibilitySnapshotInsert): Promise<void> =>
      undefined,
  };

  return { storage, calls, nextRunId: FIXED_RUN_ID };
}

function makeFakeRecorder(): { recorder: SessionRecorderLike; events: AuditEventInput[] } {
  const events: AuditEventInput[] = [];
  const recorder: SessionRecorderLike = {
    recordEvent: vi.fn(async (input: AuditEventInput): Promise<void> => {
      events.push(input);
    }),
  };
  return { recorder, events };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Note: incoming state's `audit_run_id` is a placeholder that AuditSetupNode
// REPLACES with the freshly-minted id from storage.createAuditRun. The
// browse-subset schema requires a UUID-shaped slot to be present pre-node.
const SEED_CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const SEED_PLACEHOLDER_RUN_ID = '11111111-1111-4111-8111-111111111111';

function makeIncomingState() {
  return AuditStateBrowseSubsetSchema.parse({
    audit_run_id: SEED_PLACEHOLDER_RUN_ID,
    client_id: SEED_CLIENT_ID,
    current_node: 'audit_setup',
    node_status: 'pending' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-16T00:00:00Z'),
    updated_at: new Date('2026-05-16T00:00:00Z'),
    urls_remaining: ['https://example.com/', 'https://example.com/products'],
    budget_remaining_usd: 15.0,
    business_type: 'ecommerce' as const,
  });
}

// ---------------------------------------------------------------------------
// AC-02 conformance
// ---------------------------------------------------------------------------

describe('AC-02 — audit_setup node', () => {
  it('creates audit_run row via StorageAdapter and returns its new id in the state slice', async () => {
    const { storage, calls, nextRunId } = makeFakeStorage();
    const { recorder } = makeFakeRecorder();
    const node = createAuditSetupNode({ storage, recorder });

    const patch = await node(makeIncomingState());

    // (a) createAuditRun called exactly once, scoped to incoming client
    expect(calls.createAuditRun).toHaveLength(1);
    expect(calls.createAuditRun[0]?.clientId).toBe(SEED_CLIENT_ID);
    expect(calls.createAuditRun[0]?.rootUrl).toBe('https://example.com/');

    // (a) returned patch carries the NEW audit_run_id (not the seed placeholder)
    expect(patch.audit_run_id).toBe(nextRunId);
    expect(patch.audit_run_id).not.toBe(SEED_PLACEHOLDER_RUN_ID);
  });

  it('emits LOCKED `audit_started` AuditEvent with metadata + null page_url (§34.4)', async () => {
    const { storage, nextRunId } = makeFakeStorage();
    const { recorder, events } = makeFakeRecorder();
    const node = createAuditSetupNode({ storage, recorder });

    await node(makeIncomingState());

    // (b) exactly one event emitted, of LOCKED type 'audit_started'
    expect(events).toHaveLength(1);
    const evt = events[0]!;
    expect(evt.event_type).toBe('audit_started');
    expect(evt.audit_run_id).toBe(nextRunId);
    expect(evt.client_id).toBe(SEED_CLIENT_ID);
    expect(evt.page_url).toBeNull();

    // metadata carries urls_count + business_type for downstream observability
    const md = evt.metadata as { urls_count: number; business_type: string };
    expect(md.urls_count).toBe(2);
    expect(md.business_type).toBe('ecommerce');
  });

  it('returned state slice validates against AuditStateBrowseSubsetSchema.partial()', async () => {
    const { storage, nextRunId } = makeFakeStorage();
    const { recorder } = makeFakeRecorder();
    const node = createAuditSetupNode({ storage, recorder });

    const patch = await node(makeIncomingState());

    // (c) patch parses cleanly through the strict partial schema (R2.2)
    expect(() => AuditStateBrowseSubsetSchema.partial().parse(patch)).not.toThrow();

    // canonical browse-subset orchestration fields on the slice
    expect(patch.audit_run_id).toBe(nextRunId);
    expect(patch.current_node).toBe('audit_setup');
    expect(patch.node_status).toBe('complete');
    expect(patch.updated_at).toBeInstanceOf(Date);
  });

  it('state-flowed fields (urls_remaining, budget_remaining_usd, business_type) reach the downstream consumer', async () => {
    // Phase-5 contract: AuditSetupNode does NOT need to re-emit unchanged state
    // fields — LangGraph merges the patch onto incoming state, so the merged
    // result MUST carry every browse-subset field. We assert the merge here
    // directly rather than re-relying on the LangGraph runtime.
    const { storage } = makeFakeStorage();
    const { recorder } = makeFakeRecorder();
    const node = createAuditSetupNode({ storage, recorder });

    const incoming = makeIncomingState();
    const patch = await node(incoming);
    const merged = { ...incoming, ...patch };

    expect(merged.audit_run_id).not.toBe(SEED_PLACEHOLDER_RUN_ID);
    expect(merged.client_id).toBe(SEED_CLIENT_ID);
    expect(merged.urls_remaining).toEqual(['https://example.com/', 'https://example.com/products']);
    expect(merged.budget_remaining_usd).toBe(15.0);
    expect(merged.business_type).toBe('ecommerce');
  });
});
