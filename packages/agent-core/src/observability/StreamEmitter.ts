/**
 * StreamEmitter — in-memory pub/sub for SSE-compatible events (Phase 4 T076).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-14
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T076
 *     (REQ-STREAM-EMITTER-001)
 *
 * # Contract (AC-14 conformance test = canonical)
 *
 *   const emitter = new StreamEmitter();
 *   const unsubscribe = emitter.subscribe((envelope) => { ... });
 *   emitter.publish({ event: 'audit_started', data: { audit_run_id: 'a' } });
 *   unsubscribe();
 *
 * Subscribers receive every published event in publish-order. Phase 4 buffers
 * events in memory only — there is NO HTTP transport here. Phase 9 dashboard
 * (T-PHASE9) wraps this emitter in a Hono SSE endpoint and streams envelopes
 * to clients using the standard SSE wire format documented below.
 *
 * # SSE wire format (W3C Server-Sent Events)
 *
 *   event: <event name>\n
 *   data: <JSON-serialized data>\n
 *   id: <optional id>\n
 *   \n              ← terminator (blank line)
 *
 * `serialize()` produces a frame that conforms to this format so Phase 9 can
 * write directly to the response stream without re-serializing. The trailing
 * `\n\n` is part of the SSE spec — it tells the client one event has ended.
 *
 * # Why no event buffer / replay
 *
 * Phase 4 spec only requires fan-out to live subscribers. Persistent replay
 * (e.g. for late-joining dashboard clients) is a Phase 9 concern and would
 * couple this module to storage. Keeping the emitter stateless beyond its
 * subscriber set keeps the surface < 150 LOC and the unit tests trivial.
 *
 * # R14 Pino correlation
 *
 * When subscriber callbacks throw, we log the failure with `event_type` (the
 * envelope's event name) so a noisy subscriber can be traced across logs
 * without taking down the pub/sub bus. We deliberately catch + log + continue
 * so a single bad subscriber cannot block the others (fan-out fairness).
 *
 * Anchor: @AC-14 — in-memory publish/subscribe + SSE shape.
 */
import { createLogger } from './logger.js';

const log = createLogger('stream-emitter');

/**
 * SSE-compatible envelope. `event` maps to the SSE `event:` field; `data`
 * is JSON-serialized into the `data:` field; `id` (optional) maps to `id:`.
 */
export interface StreamEventEnvelope {
  /** SSE event name (e.g. `audit_started`, `finding_produced`). */
  event: string;
  /** JSON-serializable payload. Serialized via `JSON.stringify` for SSE. */
  data: unknown;
  /** Optional SSE `id:` field for client-side last-event-id reconnection. */
  id?: string;
}

/** Subscriber callback signature. */
export type StreamSubscriber = (envelope: StreamEventEnvelope) => void;

/** Unsubscribe handle returned by `subscribe()`. Idempotent. */
export type Unsubscribe = () => void;

/**
 * In-memory pub/sub bus. One instance per audit run (or one process-global
 * instance if Phase 9 chooses to multiplex by `audit_run_id` in the envelope
 * data). Phase 4 does not prescribe lifecycle — callers own the instance.
 */
export class StreamEmitter {
  // Set semantics: fast O(1) add/remove; iteration order = insertion order
  // (ES2015+ guarantee), which preserves publish-order fairness across subs.
  private readonly subscribers: Set<StreamSubscriber> = new Set();

  /**
   * Publish an envelope to every current subscriber, synchronously and in
   * subscription order. A subscriber that throws is logged + skipped so it
   * cannot block fan-out to the rest.
   */
  publish(envelope: StreamEventEnvelope): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(envelope);
      } catch (err) {
        // Per R14: correlate with the event_type so a noisy subscriber is
        // traceable. We swallow the error to keep the bus alive (fan-out
        // fairness — see file header).
        log.error(
          { event_type: envelope.event, err: err instanceof Error ? err.message : String(err) },
          'StreamEmitter subscriber threw — skipping',
        );
      }
    }
  }

  /**
   * Register a subscriber. Returns an idempotent unsubscribe handle.
   */
  subscribe(callback: StreamSubscriber): Unsubscribe {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Serialize an envelope to the W3C SSE wire format. Phase 9 calls this when
   * writing to an HTTP response stream so the bus and the transport agree on
   * exactly one serialization. Format:
   *
   *   event: <name>\n
   *   id: <id>\n           ← omitted if envelope.id is undefined
   *   data: <JSON>\n
   *   \n
   */
  static serialize(envelope: StreamEventEnvelope): string {
    const lines: string[] = [`event: ${envelope.event}`];
    if (envelope.id !== undefined) {
      lines.push(`id: ${envelope.id}`);
    }
    lines.push(`data: ${JSON.stringify(envelope.data)}`);
    // Trailing '\n\n' terminator per W3C SSE — one '\n' per line + a blank line.
    return `${lines.join('\n')}\n\n`;
  }

  /** Subscriber count — useful for tests and Phase 9 telemetry. */
  get subscriberCount(): number {
    return this.subscribers.size;
  }
}
