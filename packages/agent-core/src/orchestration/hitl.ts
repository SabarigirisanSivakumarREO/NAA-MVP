/**
 * HITL helper — Phase 5 T089 (AC-08). MVP stub; T091 adapts to LangGraph's
 * interrupt at graph compile time. No `@langchain/langgraph` import here
 * (R9; vendor dep lands at T091). Spec: spec.md AC-08 v0.4 + tasks.md L194-200.
 *
 * requestHitl emits `hitl_requested` LOCKED event + registers pending entry +
 * arms 5-min default timer → resumeAudit(id,'timeout') on fire. resumeAudit
 * cancels timer + clears entry → {resolved,decision,cause_class?}; unknown id
 * → UnknownHitlError. cancelHitlTimeout clears entry without resolving.
 *
 * MVP limitation: process-local Map. Phase 9 dashboard + T091 LangGraph
 * checkpoint state persist HITL across processes.
 *
 * R10.1 ≤100 LOC; R10.2 named exports; R10.3 funcs ≤50; R13 no any /
 * console.log / vendor SDK; R14 Pino correlation on every emit.
 */
import { z } from 'zod';

import type { AuditEventInput } from '../observability/SessionRecorder.js';
import { createChildLogger, createLogger, type Logger } from '../observability/logger.js';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
type Decision = 'approve' | 'reject' | 'timeout';

export const HITLResolutionSchema = z.object({
  resolved: z.boolean(),
  decision: z.enum(['approve', 'reject', 'timeout']),
  cause_class: z.enum(['safety_blocked', 'hitl_timeout']).optional(),
}).strict();
export type HITLResolution = z.infer<typeof HITLResolutionSchema>;

export class UnknownHitlError extends Error {
  readonly audit_run_id: string;
  constructor(audit_run_id: string) {
    super(`UnknownHitlError: no pending HITL for audit_run_id=${audit_run_id}`);
    this.name = 'UnknownHitlError';
    this.audit_run_id = audit_run_id;
  }
}

/** Structural SessionRecorder shim (matches BrowseNode pattern). */
export interface HitlRecorderLike { recordEvent(input: AuditEventInput): Promise<void>; }

export interface HitlRequestOptions {
  readonly audit_run_id: string;
  readonly client_id: string;
  readonly page_url: string | null;
  readonly tool_name: string;
  readonly domain: string;
  readonly reason: string;
  readonly recorder: HitlRecorderLike;
}

export interface HitlManager {
  requestHitl(opts: HitlRequestOptions, timeoutMs?: number): Promise<void>;
  resumeAudit(audit_run_id: string, decision: Decision): Promise<HITLResolution>;
  cancelHitlTimeout(audit_run_id: string): void;
  /** Test-only: count of pending HITLs. */
  pendingCount(): number;
}

interface PendingEntry { readonly client_id: string; readonly timer: ReturnType<typeof setTimeout>; }

export function createHitlManager(logger?: Logger): HitlManager {
  const base = logger ?? createLogger('hitl');
  const registry = new Map<string, PendingEntry>();

  async function requestHitl(opts: HitlRequestOptions, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<void> {
    const log = createChildLogger(base, {
      audit_run_id: opts.audit_run_id, client_id: opts.client_id, node_name: 'browse',
      tool_name: opts.tool_name, domain: opts.domain, event_type: 'hitl_requested',
    });
    await opts.recorder.recordEvent({
      audit_run_id: opts.audit_run_id, client_id: opts.client_id, event_type: 'hitl_requested',
      page_url: opts.page_url,
      metadata: { tool_name: opts.tool_name, domain: opts.domain, reason: opts.reason },
    });
    const timer = setTimeout(() => {
      log.warn({ timeout_ms: timeoutMs }, 'hitl.auto_timeout_fired');
      void resumeAudit(opts.audit_run_id, 'timeout').catch((err: unknown) =>
        log.error({ err: (err as Error).message }, 'hitl.auto_timeout_resume_failed'));
    }, timeoutMs);
    registry.set(opts.audit_run_id, { client_id: opts.client_id, timer });
    log.info({ timeout_ms: timeoutMs, pending: registry.size }, 'hitl.requested');
  }

  async function resumeAudit(audit_run_id: string, decision: Decision): Promise<HITLResolution> {
    const entry = registry.get(audit_run_id);
    if (entry === undefined) throw new UnknownHitlError(audit_run_id);
    clearTimeout(entry.timer);
    registry.delete(audit_run_id);
    const cause_class = decision === 'reject' ? 'safety_blocked' : decision === 'timeout' ? 'hitl_timeout' : undefined;
    const resolution: HITLResolution = cause_class === undefined
      ? { resolved: true, decision } : { resolved: true, decision, cause_class };
    createChildLogger(base, { audit_run_id, client_id: entry.client_id, node_name: 'browse' })
      .info({ decision, cause_class }, 'hitl.resumed');
    return HITLResolutionSchema.parse(resolution);
  }

  function cancelHitlTimeout(audit_run_id: string): void {
    const entry = registry.get(audit_run_id);
    if (entry === undefined) return;
    clearTimeout(entry.timer);
    registry.delete(audit_run_id);
  }

  return { requestHitl, resumeAudit, cancelHitlTimeout, pendingCount: () => registry.size };
}
