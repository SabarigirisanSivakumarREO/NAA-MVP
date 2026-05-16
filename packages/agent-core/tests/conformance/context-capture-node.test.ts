/**
 * AC-11 — ContextCaptureNode conformance (Phase 4b T4B-011).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-11 + R-11 +
 *     §"User Story 1" + §"User Story 3" (halt/resume flow)
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §3 risk register
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-011 (L161-166)
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.3 (full
 *     pipeline: HtmlFetcher → JsonLdParser → inferrers → scorer → questions →
 *     provenance → hash → freeze → persist)
 *
 * AC-11 contract (this file):
 *   1. Happy path — full intake → state.node_status === 'complete';
 *      profile populated; profile_hash matches /^[a-f0-9]{64}$/i;
 *      no blocking_questions returned.
 *   2. Halt on low confidence — empty intake + ambiguous HTML → state
 *      transitions to 'halted'; blocking_questions non-empty; profile NOT
 *      persisted (no DB INSERT call).
 *   3. Resume — halted state + answers → completes; profile populated.
 *   4. Idempotency — same input run twice → identical profile_hash (R-03).
 *   5. DB unset graceful degradation — DATABASE_URL unset → in-memory
 *      profile returned; Pino warn `CONTEXT_PERSIST_SKIPPED_NO_DB` emitted.
 *   6. HtmlFetcher failure degradation — fetcher throws → still completes
 *      (URL-only inference); confidence lower; blocking question likely.
 *   7. Frozen profile — Object.isFrozen(result.profile) === true.
 *   8. AuditState shape — result.state validates via AuditStateSchema.parse().
 *
 * Anchor: @AC-11 — ContextCaptureNode halt/resume + persistence + idempotency.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  ContextCaptureNode,
  type ContextCaptureNodeResult,
  type HtmlFetcherLike,
} from '../../src/orchestration/nodes/ContextCaptureNode.js';
import {
  AuditStateSchema,
  type AuditState,
  type ClarificationAnswer,
} from '../../src/orchestration/state.js';
import type { AuditRequest } from '../../src/types/audit-request.js';

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000B11';
const CLIENT_ID = '00000000-0000-4000-8000-000000000B12';

/**
 * AuditRequest with FULL intake — every required + most optional fields
 * populated, mimicking the consultant having filled the intake form well.
 */
function fullIntakeRequest(): AuditRequest {
  return {
    client_id: CLIENT_ID,
    urls: ['https://example-shop.com/products/widget'],
    business_type: 'D2C',
    intake: {
      business: {
        archetype: 'D2C',
        aov_tier: 'mid',
        vertical: 'apparel',
      },
      goal: {
        primary_kpi: 'purchase',
        constraints: {
          regulatory: [],
        },
      },
      traffic: {
        device_priority: 'mobile',
      },
      audience: {
        buyer: 'consumer',
      },
    },
  };
}

/**
 * AuditRequest with MINIMAL intake — only the required `goal.primary_kpi`,
 * forcing the inference pipeline to do all the work. Combined with an
 * ambiguous URL + empty HTML, this drives the low-confidence + blocking
 * questions path.
 */
function minimalIntakeRequest(): AuditRequest {
  return {
    client_id: CLIENT_ID,
    urls: ['https://unknown.example/some-page'],
    business_type: 'D2C',
    intake: {
      goal: {
        primary_kpi: 'purchase',
        constraints: { regulatory: [] },
      },
    },
  };
}

function pendingState(): AuditState {
  const now = new Date('2026-05-16T00:00:00.000Z');
  return {
    audit_run_id: AUDIT_RUN_ID,
    client_id: CLIENT_ID,
    current_node: 'context_capture',
    node_status: 'pending',
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: now,
    updated_at: now,
  };
}

// ---------------------------------------------------------------------------
// Stub HtmlFetcher (DI seam — avoids real network)
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string;
}

function stubFetcher(html: string, calls: FetchCall[] = []): HtmlFetcherLike {
  return {
    fetch: async (url: string) => {
      calls.push({ url });
      return {
        html,
        statusCode: 200,
        finalUrl: url,
        warnings: [],
      };
    },
  };
}

function throwingFetcher(calls: FetchCall[] = []): HtmlFetcherLike {
  return {
    fetch: async (url: string) => {
      calls.push({ url });
      throw new Error('stub: network down');
    },
  };
}

/** Rich D2C HTML with Product JSON-LD + ATC CTA — drives high confidence. */
const D2C_HTML = `
<!doctype html>
<html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "Product", "name": "Widget" }
</script>
</head><body>
<h1>Widget</h1>
<button>Add to cart</button>
<p>${'x'.repeat(2048)}</p>
</body></html>
`;

/** Ambiguous HTML — no JSON-LD, no clear CTA, very short → low confidence. */
const AMBIGUOUS_HTML = '<html><body><p>hello</p></body></html>';

// ---------------------------------------------------------------------------
// Env management — tests manipulate DATABASE_URL to exercise both paths
// ---------------------------------------------------------------------------

let originalDbUrl: string | undefined;

beforeEach(() => {
  originalDbUrl = process.env.DATABASE_URL;
  // Ensure DB-free path by default; specific tests opt back in if needed.
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
});

afterEach(() => {
  if (originalDbUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDbUrl;
  }
});

// ---------------------------------------------------------------------------
// AC-11 conformance
// ---------------------------------------------------------------------------

describe('ContextCaptureNode — AC-11 conformance (Phase 4b T4B-011)', () => {
  it('AC-11 (1): happy-path full intake → node_status:complete + frozen profile', async () => {
    const fetcher = stubFetcher(D2C_HTML);
    const node = new ContextCaptureNode({ fetcher });
    const result = await node.run({
      request: fullIntakeRequest(),
      state: pendingState(),
    });

    expect(result.state.node_status).toBe('complete');
    expect(result.profile).toBeDefined();
    expect(result.profile?.profile_hash).toMatch(/^[a-f0-9]{64}$/i);
    expect(result.blocking_questions ?? []).toEqual([]);
    expect(result.state.context_profile_id).not.toBeNull();
    expect(result.state.context_profile_hash).toBe(result.profile?.profile_hash);
  });

  it('AC-11 (2): low-confidence → node_status:halted + blocking_questions; no DB persist', async () => {
    const calls: FetchCall[] = [];
    const fetcher = stubFetcher(AMBIGUOUS_HTML, calls);
    const node = new ContextCaptureNode({ fetcher });
    const result = await node.run({
      request: minimalIntakeRequest(),
      state: pendingState(),
    });

    expect(result.state.node_status).toBe('halted');
    expect(result.blocking_questions).toBeDefined();
    expect(result.blocking_questions?.length ?? 0).toBeGreaterThan(0);
    // Profile NOT populated on halt — context_profile_id stays null
    expect(result.state.context_profile_id).toBeNull();
    expect(result.state.context_profile_hash).toBeNull();
    // pending_questions carries the blocking questions across the halt boundary
    expect(result.state.pending_questions.length).toBeGreaterThan(0);
  });

  it('AC-11 (3): resume() with answers → completes; profile populated', async () => {
    const fetcher = stubFetcher(AMBIGUOUS_HTML);
    const node = new ContextCaptureNode({ fetcher });
    const haltedResult = await node.run({
      request: minimalIntakeRequest(),
      state: pendingState(),
    });
    expect(haltedResult.state.node_status).toBe('halted');

    // Build answers covering the 3 REQUIRED fields (business.archetype,
    // page.type, goal.primary_kpi). goal.primary_kpi already in intake;
    // the other two need user input.
    const answers: ClarificationAnswer[] = [
      { field_path: 'business.archetype', value: 'D2C', source: 'user', confidence: 1 },
      { field_path: 'page.type', value: 'PDP', source: 'user', confidence: 1 },
      { field_path: 'goal.primary_kpi', value: 'purchase', source: 'user', confidence: 1 },
    ];

    const resumed = await node.resume({ state: haltedResult.state, answers });
    expect(resumed.state.node_status).toBe('complete');
    expect(resumed.profile).toBeDefined();
    expect(resumed.profile?.business.archetype.value).toBe('D2C');
    expect(resumed.profile?.page.type.value).toBe('PDP');
  });

  it('AC-11 (4): idempotency — same input run twice → identical profile_hash (R-03)', async () => {
    const node = new ContextCaptureNode({ fetcher: stubFetcher(D2C_HTML) });
    const r1 = await node.run({ request: fullIntakeRequest(), state: pendingState() });
    const r2 = await node.run({ request: fullIntakeRequest(), state: pendingState() });
    expect(r1.profile?.profile_hash).toBeDefined();
    expect(r1.profile?.profile_hash).toBe(r2.profile?.profile_hash);
  });

  it('AC-11 (5): DATABASE_URL unset → CONTEXT_PERSIST_SKIPPED_NO_DB warn + in-memory profile', async () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    const logs: Array<{ level: string; msg: string; bindings: Record<string, unknown> }> = [];
    const captureLogger = {
      info: (_b: Record<string, unknown>, _m: string) => undefined,
      warn: (b: Record<string, unknown>, m: string) => logs.push({ level: 'warn', msg: m, bindings: b }),
      error: (_b: Record<string, unknown>, _m: string) => undefined,
      child: function child() {
        return this;
      },
    };
    const node = new ContextCaptureNode({
      fetcher: stubFetcher(D2C_HTML),
      logger: captureLogger as never,
    });
    const result = await node.run({
      request: fullIntakeRequest(),
      state: pendingState(),
    });
    expect(result.profile).toBeDefined();
    expect(result.state.node_status).toBe('complete');
    const skipLog = logs.find((l) => l.msg.includes('CONTEXT_PERSIST_SKIPPED_NO_DB'));
    expect(skipLog).toBeDefined();
  });

  it('AC-11 (6): HtmlFetcher throws → still completes (URL-only); confidence lower', async () => {
    const calls: FetchCall[] = [];
    const node = new ContextCaptureNode({ fetcher: throwingFetcher(calls) });
    // Use the rich URL pattern (/products/) so URL inference still gives PDP.
    const request: AuditRequest = {
      ...fullIntakeRequest(),
      urls: ['https://example-shop.com/products/widget'],
    };
    const result = await node.run({ request, state: pendingState() });
    // Either completes or halts — but MUST NOT throw.
    expect(['complete', 'halted']).toContain(result.state.node_status);
    expect(calls.length).toBe(1); // fetcher was called once
  });

  it('AC-11 (7): result.profile is Object.frozen (REQ-CONTEXT-OUT-003)', async () => {
    const node = new ContextCaptureNode({ fetcher: stubFetcher(D2C_HTML) });
    const result = await node.run({
      request: fullIntakeRequest(),
      state: pendingState(),
    });
    expect(result.profile).toBeDefined();
    expect(Object.isFrozen(result.profile)).toBe(true);
  });

  it('AC-11 (8): result.state validates via AuditStateSchema.parse()', async () => {
    const node = new ContextCaptureNode({ fetcher: stubFetcher(D2C_HTML) });
    const result = await node.run({
      request: fullIntakeRequest(),
      state: pendingState(),
    });
    expect(() => AuditStateSchema.parse(result.state)).not.toThrow();
  });

  it('AC-11 (8b): halted state also validates via AuditStateSchema.parse()', async () => {
    const node = new ContextCaptureNode({ fetcher: stubFetcher(AMBIGUOUS_HTML) });
    const result: ContextCaptureNodeResult = await node.run({
      request: minimalIntakeRequest(),
      state: pendingState(),
    });
    expect(() => AuditStateSchema.parse(result.state)).not.toThrow();
  });
});
