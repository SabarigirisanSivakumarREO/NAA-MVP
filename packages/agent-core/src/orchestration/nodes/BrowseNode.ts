/**
 * BrowseNode — Phase 5 T084 + T085 (REQ-BROWSE-NODE-003; AC-04 + AC-17).
 * spec.md AC-04 L152 + AC-17 L165; tasks.md T084/T085 L149-166.
 *
 * Two-phase loop:
 *   T084 selectAction — ContextAssembler.capture(current_url) [R4.1] →
 *     LLMAdapter (operation 'other' temp=0.5) → ActionProposalSchema.safeParse;
 *     up to 2 corrective retries (operation='classify'); 3 LLM calls max.
 *   T085 verifyAndRoute — page_browse_started → SafetyCheck → RateLimiter →
 *     ToolRegistry dispatch → VerifyEngine.verify → ConfidenceScorer
 *     [R4.4 multiplicative] → FailureClassifier → page_browse_{completed|failed}.
 *
 * R23 kill criteria: perception-first violation; loop_iteration > 5
 *   (NF-Phase5-02); R4.4 additive math (source-grep). Iteration state held
 *   in `_phase8_extensions` escape hatch.
 *
 * R10.1 ≤250 LOC; R10.3 ≤50/fn; R10.2 named exports; R2 no `any`;
 *   R9 adapter discipline; R13 no console.log; R14 Pino correlation.
 */
import type { LLMAdapter, LLMCompleteRequest } from '../../adapters/LLMAdapter.js';
import type { ContextAssembler } from '../../perception/ContextAssembler.js';
import type { RateLimiter } from '../../browser-runtime/RateLimiter.js';
import { SafetyBlockedError, type SafetyCheck } from '../../safety/SafetyCheck.js';
import type { ToolRegistry } from '../../mcp/ToolRegistry.js';
import type { VerifyEngine } from '../../verification/VerifyEngine.js';
import type { ActionContract, AggregatedVerifyResult, FailureClassification } from '../../verification/types.js';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { ConfidenceScorer } from '../../verification/ConfidenceScorer.js';
import type { FailureClassifier } from '../../verification/FailureClassifier.js';
import type { AuditEventInput } from '../../observability/SessionRecorder.js';
import { createChildLogger, createLogger, type Logger } from '../../observability/logger.js';
import { ActionProposalSchema, BROWSE_AGENT_SYSTEM_PROMPT, BROWSE_TOOL_NAMES, type ActionProposal } from '../prompts/browse-agent.js';
import { type AuditStateBrowseSubset } from '../AuditState.js';
import type { PageStateModel } from '../../perception/types.js';

/** Structural-typed SessionRecorder shim (matches AuditSetupNode pattern). */
export interface SessionRecorderLike {
  recordEvent(input: AuditEventInput): Promise<void>;
}

export interface BrowseNodeDeps {
  readonly contextAssembler: Pick<ContextAssembler, 'capture'>;
  readonly llm: LLMAdapter;
  readonly toolRegistry: Pick<ToolRegistry, 'get'>;
  readonly rateLimiter: Pick<RateLimiter, 'acquire'>;
  readonly safety: Pick<SafetyCheck, 'assertAllowed'>;
  readonly verifyEngine: Pick<VerifyEngine, 'verify'>;
  readonly scorer: Pick<ConfidenceScorer, 'afterSuccess' | 'afterFailure'>;
  readonly classifier: Pick<FailureClassifier, 'classify'>;
  readonly recorder: SessionRecorderLike;
  /** Live BrowserSession threaded to VerifyEngine; MVP gap — see header. */
  readonly session?: BrowserSession;
  readonly logger?: Logger;
}

export type BrowseNodeFn = (
  state: AuditStateBrowseSubset,
) => Promise<Partial<AuditStateBrowseSubset>>;

const NODE = 'browse';
const SUB = 'browse' as const;
const MAX_ITER = 5; // NF-Phase5-02
const MAX_RETRIES = 2; // 1 primary + 2 corrective

export function createBrowseNode(deps: BrowseNodeDeps): BrowseNodeFn {
  const base = deps.logger ?? createLogger('browse-node');
  return async function executeBrowseStep(state) {
    const iter = readIter(state) + 1;
    const log = createChildLogger(base, {
      audit_run_id: state.audit_run_id, client_id: state.client_id,
      node_name: NODE, subgraph: SUB, loop_iteration: iter,
      ...(state.current_url !== undefined ? { page_url: state.current_url } : {}),
    });
    log.info('browse.entry');
    if (iter > MAX_ITER) {
      log.warn({ iter }, 'browse.loop_runaway');
      await deps.recorder.recordEvent(audEvt(state, 'audit_failed', { cause_class: 'loop_runaway', iter }));
      return abort(state, 'loop_runaway', iter);
    }
    const sel = await selectAction(state, deps, log, iter);
    if (sel.aborted) { log.warn('browse.exit (action_selection_failed)'); return sel.slice; }
    const merged = { ...state, ...sel.slice } as AuditStateBrowseSubset;
    const slice = await verifyAndRoute(merged, deps, log, iter);
    log.info('browse.exit');
    return slice;
  };
}

// T084 — perception-first then LLM proposal with up to 2 corrective retries.
async function selectAction(
  state: AuditStateBrowseSubset, deps: BrowseNodeDeps, log: Logger, iter: number,
): Promise<{ slice: Partial<AuditStateBrowseSubset>; aborted: boolean }> {
  const url = state.current_url;
  if (url === undefined) {
    log.warn('browse.no_current_url');
    return { slice: abort(state, 'safety_blocked', iter), aborted: true };
  }
  const pageState = await deps.contextAssembler.capture(url); // R4.1
  log.info({ ax_nodes: pageState.diagnostics.axNodeCount }, 'browse.perception_captured');
  const basePrompt = composePrompt(pageState);
  let userPrompt = basePrompt;
  let proposal: ActionProposal | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    log.info({ attempt }, 'browse.llm_call_attempt');
    const req: LLMCompleteRequest = {
      operation: attempt === 0 ? 'other' : 'classify',
      audit_run_id: state.audit_run_id, client_id: state.client_id,
      systemPrompt: BROWSE_AGENT_SYSTEM_PROMPT, userPrompt, temperature: 0.5, maxTokens: 1024,
    };
    const r = await deps.llm.complete(req);
    const p = tryParse(r.text);
    if (p.success) { proposal = p.data; log.info({ tool: proposal.tool, attempt }, 'browse.action_proposed'); break; }
    log.warn({ attempt, issue: p.error }, 'browse.action_zod_failed_retry');
    userPrompt = `${basePrompt}\n\nERROR: ${p.error}. Pick from EXACTLY: ${BROWSE_TOOL_NAMES.join(', ')}. JSON only.`;
  }
  if (proposal === undefined) {
    log.error('browse.action_zod_failed_final');
    return { slice: abort(state, 'safety_blocked', iter), aborted: true };
  }
  return { aborted: false, slice: {
    current_node: NODE, node_status: 'running',
    page_state_models: [...state.page_state_models, pageState], updated_at: new Date(),
    _phase8_extensions: { ...(state._phase8_extensions ?? {}), browse_loop_iteration: iter, last_action_proposal: proposal },
  }};
}

// T085 — page_browse_started → safety → rate-limit → dispatch → verify → score → classify → final.
async function verifyAndRoute(
  state: AuditStateBrowseSubset, deps: BrowseNodeDeps, log: Logger, iter: number,
): Promise<Partial<AuditStateBrowseSubset>> {
  const proposal = (state._phase8_extensions ?? {})['last_action_proposal'] as ActionProposal | undefined;
  if (proposal === undefined || state.current_url === undefined) return abort(state, 'safety_blocked', iter);
  const domain = safeHost(state.current_url);
  await deps.recorder.recordEvent(pageEvt(state, 'page_browse_started'));
  log.info({ event_type: 'page_browse_started' }, 'browse.event_emitted');
  try {
    await deps.safety.assertAllowed(proposal.tool, domain, { id: state.audit_run_id, client_id: state.client_id });
    log.info({ tool: proposal.tool }, 'browse.safety_check_passed');
  } catch (err) { return handleSafety(err, state, deps, log, iter); }
  await deps.rateLimiter.acquire(domain);
  const dispatched = await dispatchTool(proposal, deps, log);
  if (!dispatched.ok) return failure(state, deps, log, iter, dispatched.synthetic);
  const result = await deps.verifyEngine.verify(buildContract(proposal), deps.session ?? ({} as BrowserSession));
  log.info({ ok: result.ok }, result.ok ? 'browse.verify_ok' : 'browse.verify_failed');
  return result.ok ? success(state, deps, log, iter, result) : failure(state, deps, log, iter, result);
}

// --- dispatch + branch slices --------------------------------------------

async function dispatchTool(
  proposal: ActionProposal, deps: BrowseNodeDeps, log: Logger,
): Promise<{ ok: true } | { ok: false; synthetic: AggregatedVerifyResult }> {
  const def = deps.toolRegistry.get(proposal.tool);
  if (def === undefined) {
    log.warn({ tool: proposal.tool }, 'browse.tool_not_registered');
    return { ok: false, synthetic: { ok: false, attemptedStrategies: [], failures: [], reason: 'tool_not_registered' } };
  }
  try {
    const args = def.inputSchema.parse(proposal.args);
    await def.handler(args, { logger: log, toolCallId: uuid(), clientSessionId: 'browse-node-internal' });
    log.info({ tool: proposal.tool }, 'browse.tool_dispatched');
    return { ok: true };
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'browse.tool_threw');
    return { ok: false, synthetic: { ok: false, attemptedStrategies: [], failures: [], reason: 'tool_threw' } };
  }
}

function success(
  state: AuditStateBrowseSubset, deps: BrowseNodeDeps, log: Logger, iter: number, result: AggregatedVerifyResult,
): Partial<AuditStateBrowseSubset> {
  const c = deps.scorer.afterSuccess(state.session_confidence); // R4.4 multiplicative
  void deps.recorder.recordEvent(pageEvt(state, 'page_browse_completed'))
    .then(() => log.info({ event_type: 'page_browse_completed' }, 'browse.event_emitted'));
  return {
    current_node: NODE, node_status: 'complete', session_confidence: c, updated_at: new Date(),
    _phase8_extensions: { ...(state._phase8_extensions ?? {}), browse_loop_iteration: iter, last_verify_result: result },
  };
}

function failure(
  state: AuditStateBrowseSubset, deps: BrowseNodeDeps, log: Logger, iter: number, result: AggregatedVerifyResult,
): Partial<AuditStateBrowseSubset> {
  const c = deps.scorer.afterFailure(state.session_confidence); // R4.4 multiplicative
  const fc: FailureClassification = deps.classifier.classify(result);
  void deps.recorder.recordEvent({ ...pageEvt(state, 'page_browse_failed'), metadata: { failure_class: fc.class, subclass: fc.subclass } })
    .then(() => log.info({ event_type: 'page_browse_failed' }, 'browse.event_emitted'));
  return {
    current_node: NODE, node_status: 'complete', session_confidence: c, updated_at: new Date(),
    _phase8_extensions: { ...(state._phase8_extensions ?? {}), browse_loop_iteration: iter, last_verify_result: result, last_failure_class: fc.class },
  };
}

function handleSafety(
  err: unknown, state: AuditStateBrowseSubset, deps: BrowseNodeDeps, log: Logger, iter: number,
): Partial<AuditStateBrowseSubset> {
  const isHitl = err instanceof SafetyBlockedError && err.reason === 'hitl_requested';
  log.warn({ reason: err instanceof SafetyBlockedError ? err.reason : 'unknown' }, 'browse.safety_check_blocked');
  if (isHitl) {
    return {
      current_node: NODE, node_status: 'halted', updated_at: new Date(),
      _phase8_extensions: { ...(state._phase8_extensions ?? {}), browse_loop_iteration: iter, cause_class: 'safety_blocked', hitl_pending: true },
    };
  }
  void deps.recorder.recordEvent({ ...pageEvt(state, 'page_browse_failed'), metadata: { cause_class: 'safety_blocked' } })
    .then(() => log.info({ event_type: 'page_browse_failed' }, 'browse.event_emitted'));
  return abort(state, 'safety_blocked', iter);
}

// --- pure utilities -------------------------------------------------------

function abort(state: AuditStateBrowseSubset, cause: 'loop_runaway' | 'safety_blocked', iter: number): Partial<AuditStateBrowseSubset> {
  return {
    current_node: NODE, node_status: 'failed', completion_reason: 'aborted', updated_at: new Date(),
    _phase8_extensions: { ...(state._phase8_extensions ?? {}), browse_loop_iteration: iter, cause_class: cause },
  };
}

function pageEvt(state: AuditStateBrowseSubset, t: 'page_browse_started' | 'page_browse_completed' | 'page_browse_failed'): AuditEventInput {
  return { audit_run_id: state.audit_run_id, client_id: state.client_id, event_type: t, page_url: state.current_url ?? null, metadata: {} };
}

function audEvt(state: AuditStateBrowseSubset, t: 'audit_failed', meta: Record<string, unknown>): AuditEventInput {
  return { audit_run_id: state.audit_run_id, client_id: state.client_id, event_type: t, page_url: null, metadata: meta };
}

function buildContract(p: ActionProposal): ActionContract {
  const isNav = p.tool === 'browser_navigate' || p.tool === 'browser_reload' || p.tool === 'browser_go_back' || p.tool === 'browser_go_forward';
  if (isNav) {
    const target = typeof p.args['url'] === 'string' ? p.args['url'] : '.*';
    return { id: uuid(), type: p.tool, expected: { kind: 'urlMatches', urlMatches: target }, candidateStrategies: ['url_change'] };
  }
  const selector = typeof p.args['selector'] === 'string' ? p.args['selector'] : 'body';
  return { id: uuid(), type: p.tool, expected: { kind: 'elementAppears', selector, timeoutMs: 10_000 }, candidateStrategies: ['element_appears'] };
}

function composePrompt(ps: PageStateModel): string {
  return `URL: ${ps.metadata.url}\nTitle: ${ps.metadata.title}\nAX nodes: ${ps.diagnostics.axNodeCount}\nStable: ${String(ps.diagnostics.stable)}\nPropose ONE next action as JSON per the schema.`;
}

function tryParse(raw: string): { success: true; data: ActionProposal } | { success: false; error: string } {
  let v: unknown;
  try { v = JSON.parse(raw); } catch (e) { return { success: false, error: `invalid_json: ${(e as Error).message}` }; }
  const r = ActionProposalSchema.safeParse(v);
  if (r.success) return { success: true, data: r.data };
  const f = r.error.issues[0];
  return { success: false, error: f ? `${f.path.join('.')}: ${f.message}` : 'unknown' };
}

function readIter(state: AuditStateBrowseSubset): number {
  const raw = (state._phase8_extensions ?? {})['browse_loop_iteration'];
  return typeof raw === 'number' ? raw : 0;
}

function safeHost(url: string): string {
  try { return new URL(url).hostname; } catch { return 'unknown'; }
}

function uuid(): string {
  // Node 22 global; R9 — avoids node:crypto import for adapter discipline.
  return crypto.randomUUID();
}
