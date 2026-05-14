/**
 * AC-14 — StreamEmitter conformance (Phase 4 T076).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-14
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T076
 *     (REQ-STREAM-EMITTER-001)
 *
 * AC-14 contract:
 *   - publish(event) buffers events in memory (Phase 9 dashboard wires SSE).
 *   - subscribe(callback) receives published events in publish-order.
 *   - SSE-compatible serialization shape: { event: name, data: JSON }.
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-14 — in-memory publish/subscribe + SSE shape.
 */
import { describe, expect, it } from 'vitest';

// SUT (does not exist yet — T076 lands this in Wave 2). Import fails → RED.
import { StreamEmitter } from '../../src/observability/StreamEmitter.js';

describe('StreamEmitter — AC-14 conformance (RED until T076)', () => {
  it('AC-14: subscribe(callback) receives published events in order', () => {
    const emitter = new StreamEmitter();
    const received: Array<{ event: string; data: unknown }> = [];
    emitter.subscribe((e) => received.push(e));

    emitter.publish({ event: 'audit_started', data: { audit_run_id: 'a' } });
    emitter.publish({ event: 'audit_completed', data: { audit_run_id: 'a' } });

    expect(received.length).toBe(2);
    expect(received[0]?.event).toBe('audit_started');
    expect(received[1]?.event).toBe('audit_completed');
  });

  it('AC-14: published event shape is SSE-compatible — { event: string; data: unknown }', () => {
    const emitter = new StreamEmitter();
    const received: Array<{ event: string; data: unknown }> = [];
    emitter.subscribe((e) => received.push(e));
    emitter.publish({ event: 'finding_produced', data: { finding_id: 'f1', score: 0.8 } });

    const e = received[0];
    expect(typeof e?.event).toBe('string');
    expect(e?.data).toEqual({ finding_id: 'f1', score: 0.8 });
  });

  it('AC-14: multiple subscribers each receive every event', () => {
    const emitter = new StreamEmitter();
    const a: number[] = [];
    const b: number[] = [];
    emitter.subscribe(() => a.push(1));
    emitter.subscribe(() => b.push(1));
    emitter.publish({ event: 'tick', data: {} });
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
  });
});
