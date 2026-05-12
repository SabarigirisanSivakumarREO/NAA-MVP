/**
 * Pino logger factory for Neural agent-core.
 *
 * Source: docs/specs/mvp/architecture.md §6.4 (logging stack);
 *         docs/specs/mvp/PRD.md §10 (R6 channel 1 — Pino redaction);
 *         docs/specs/mvp/phases/phase-1-perception/spec.md §line 110
 *           (Phase 1 correlation fields).
 *
 * # Correlation field convention
 *
 * Callers attach correlation context via `pino`'s `child(bindings)` API.
 * The `LogBindings` interface below ENUMERATES the canonical field names
 * the codebase uses today; new fields should be added here first (with a
 * REQ-ID / phase reference) before being adopted by callers, so the
 * registry in this file stays the single source of truth.
 *
 * Phase 0 (orchestrator) fields:
 *   - `audit_run_id` — uuid; one per pipeline invocation.
 *   - `node_name`    — orchestrator node currently executing.
 *
 * Phase 1 (perception) fields (spec.md §line 110):
 *   - `session_id`   — uuid attached at BrowserSession scope (BrowserManager.ts).
 *   - `page_url`     — URL after `page.goto()` resolves (ContextAssembler.ts).
 *   - `extractor`    — name of the extractor currently running, e.g.
 *                      `accessibility`, `mutation`, `screenshot`. (Encoded
 *                      today via the logger `name` channel — e.g.
 *                      `createLogger('accessibility-extractor')` — and
 *                      reserved here for future explicit child-binding use
 *                      when an extractor needs sub-step correlation.)
 *
 * Phase 2 (MCP tools) fields (spec.md "Constraints Inherited" + R-05;
 * REQ-MCP-002 — tool_name + tool_call_id + client_session_id correlation):
 *   - `tool_name`         — exact v3.1 tool name (e.g. `browser_get_state`);
 *                           emitted by every Phase 2 MCP tool invocation.
 *   - `tool_call_id`      — uuid (or short-id) per individual tool invocation;
 *                           lets a single call be traced across log lines.
 *   - `client_session_id` — calling MCP client's session id; correlates
 *                           multiple tool calls back to the originating session.
 *
 * Future phases will extend `LogBindings` with their own correlation
 * fields (e.g. `heuristic_id`, `trace_id`) per the same convention.
 *
 * # Implementation notes
 *
 * Why `base: null` (Pino API): correlation fields supply identity; pid is
 * leaky across container restarts (R14 reproducibility) and noisy in logs.
 *
 * Why two `pino()` call sites instead of conditional-spread `transport`:
 * tsconfig.json sets `exactOptionalPropertyTypes: true` (R2.x strictness),
 * which forbids assigning `undefined` to optional properties even via
 * spread; the explicit branch keeps Pino's discriminated-union types clean.
 *
 * Why `LogBindings` is `Partial<...>` not strict: pino's `child()` accepts
 * arbitrary `Bindings`; this interface is documentation + author-time
 * type discipline, not a runtime gate. Callers may pass a subset.
 */
import pino, { type Logger, type LoggerOptions } from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  base: null,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const devTransport: NonNullable<LoggerOptions['transport']> = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:HH:MM:ss.l',
    ignore: 'pid,hostname',
  },
};

/**
 * Canonical correlation field registry. Extend here (with a phase /
 * REQ-ID reference) before adopting a new field at call sites.
 *
 * All fields are optional because not every log site has every field
 * in scope; the type encodes which keys are *recognized*, not which
 * are *required*.
 */
export interface LogBindings {
  // --- Phase 0 (orchestrator) ---
  /** UUID for one pipeline invocation. Set at audit entry. */
  audit_run_id?: string;
  /** Orchestrator node currently executing (e.g. `orchestrator`). */
  node_name?: string;

  // --- Phase 1 (perception) — spec.md §line 110 ---
  /** UUID attached at BrowserSession scope. */
  session_id?: string;
  /** URL after `page.goto()` resolves. */
  page_url?: string;
  /** Extractor name (e.g. `accessibility`, `mutation`, `screenshot`). */
  extractor?: string;

  // --- Phase 2 (MCP tools) — spec.md "Constraints Inherited" + R-05 ---
  // REQ-MCP-002: tool_name + tool_call_id + client_session_id correlation
  // Names are spec-locked; do NOT rename (e.g. tool_call_id != tool_id).
  /** Exact v3.1 tool name (e.g. `browser_get_state`). */
  tool_name?: string;
  /** UUID/short-id per tool invocation; traces one call across log lines. */
  tool_call_id?: string;
  /** Calling MCP client session id; correlates multi-call sequences. */
  client_session_id?: string;
}

/**
 * Create a root logger for a module. The `name` argument identifies
 * the source module (e.g. `browser-manager`, `accessibility-extractor`)
 * and is rendered as Pino's `name` field.
 */
export function createLogger(name: string): Logger {
  return isDevelopment
    ? pino({ ...baseOptions, name, transport: devTransport })
    : pino({ ...baseOptions, name });
}

/**
 * Create a typed child logger with correlation bindings restricted to
 * the canonical `LogBindings` registry above. Prefer this over a raw
 * `parent.child({...})` call for new code so the type-checker catches
 * field-name typos and enforces the registration discipline.
 */
export function createChildLogger(parent: Logger, bindings: LogBindings): Logger {
  return parent.child(bindings);
}

export type { Logger };
