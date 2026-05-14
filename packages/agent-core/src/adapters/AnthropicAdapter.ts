/**
 * AnthropicAdapter — Phase 4 T073 concrete LLMAdapter (R9 SOLE @anthropic-ai/sdk importer).
 * Source: spec.md AC-08..AC-11 + tasks.md T073 + impact.md §LLMCallRecord +
 * 11-safety-cost.md + constitution.md R9/R10/R14.1/R14.2/R14.5.
 *
 * complete() lifecycle (R14.1 row on every path): (1) TemperatureGuard.check
 * (R10) → temperature_blocked; (2) SELECT FOR UPDATE audit_runs (R23 KC-5
 * lock); (3) BudgetGate.check (R14.2) → budget_blocked; (4) retry loop
 * (1+3 on 5xx/timeout, R14.5) → unavailable / LLMUnavailableError;
 * (5) success → ok with actual cost.
 *
 * Test seam: `transport` delegates complete() to a mock (production omits;
 * @anthropic-ai/sdk called directly). Row write is best-effort across all
 * paths (AC-15 integration is the canonical R14.1 check).
 */
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';

import { createLogger, type Logger } from '../observability/logger.js';
import type { LLMCallRecord } from '../types/llm.js';
import {
  BudgetExceededError,
  LLMUnavailableError,
  TemperatureGuardError,
  type LLMAdapter,
  type LLMCompleteRequest,
  type LLMCompleteResponse,
} from './LLMAdapter.js';
import { BudgetGate } from './BudgetGate.js';
import { PostgresStorage } from './PostgresStorage.js';
import type { StorageAdapter } from './StorageAdapter.js';
import { TemperatureGuard } from './TemperatureGuard.js';

export { LLMUnavailableError, BudgetExceededError, TemperatureGuardError };

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 256;
const DEFAULT_RETRY_BACKOFF_MS = 200;
const MAX_RETRIES = 3; // R14.5 — 1 initial + 3 retries = 4 attempts.
const PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000000';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 0.000_003, output: 0.000_015 },
  'claude-sonnet-4-20260301': { input: 0.000_003, output: 0.000_015 },
  'claude-sonnet-4-mock':     { input: 0.000_003, output: 0.000_015 },
};

const pricingFor = (m: string): { input: number; output: number } =>
  MODEL_PRICING[m] ?? MODEL_PRICING[DEFAULT_MODEL]!;

export interface AnthropicAdapterConfig {
  readonly apiKey: string;
  readonly defaultModel?: string;
  /** Test seam — when set, complete() delegates to this LLMAdapter. */
  readonly transport?: LLMAdapter;
  /** Retry backoff base in ms (tests pass 0). */
  readonly retryBackoffMs?: number;
}

export interface AnthropicAdapterDeps {
  readonly storage?: StorageAdapter;
  readonly logger?: Logger;
}

export class AnthropicAdapter implements LLMAdapter {
  readonly #defaultModel: string;
  readonly #transport: LLMAdapter | undefined;
  readonly #retryBackoffMs: number;
  readonly #storage: StorageAdapter;
  readonly #log: Logger;
  readonly #anthropic: Anthropic | undefined;

  constructor(config: AnthropicAdapterConfig, deps: AnthropicAdapterDeps = {}) {
    this.#defaultModel = config.defaultModel ?? DEFAULT_MODEL;
    this.#transport = config.transport;
    this.#retryBackoffMs = config.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
    this.#storage = deps.storage ?? lazyStorage();
    this.#log = deps.logger ?? createLogger('anthropic-adapter');
    this.#anthropic = this.#transport === undefined
      ? new Anthropic({ apiKey: config.apiKey })
      : undefined;
  }

  async estimateCost(
    req: Pick<LLMCompleteRequest, 'userPrompt' | 'systemPrompt' | 'model'>,
  ): Promise<number> {
    return BudgetGate.estimate({
      operation: 'other',
      audit_run_id: PLACEHOLDER_UUID,
      userPrompt: req.userPrompt,
      temperature: 0,
      maxTokens: DEFAULT_MAX_TOKENS,
      ...(req.systemPrompt !== undefined ? { systemPrompt: req.systemPrompt } : {}),
      ...(req.model !== undefined ? { model: req.model } : {}),
    });
  }

  async complete(req: LLMCompleteRequest): Promise<LLMCompleteResponse> {
    const model = req.model ?? this.#defaultModel;
    const llmCallId = randomUUID();
    const log = this.#log.child({
      audit_run_id: req.audit_run_id,
      llm_call_id: llmCallId,
      event_type: 'llm_call_completed',
    });

    // Step 1 — TemperatureGuard (R10).
    try { TemperatureGuard.check(req); } catch (err) {
      if (err instanceof TemperatureGuardError) {
        await this.#tryWriteRow(buildRow({
          id: llmCallId, req, model, outcome: 'temperature_blocked', errorClass: 'TemperatureGuardError',
        }), log);
      }
      throw err;
    }

    // Step 2 — resolve audit context (R23 KC-5 row lock; degrade if missing).
    const ctx = await this.#resolveAuditContext(req.audit_run_id, log);
    const clientId = req.client_id ?? ctx.client_id;

    // Step 3 — BudgetGate (R14.2).
    try { BudgetGate.check(req, ctx.budget_remaining_usd); } catch (err) {
      if (err instanceof BudgetExceededError) {
        await this.#tryWriteRow(buildRow({
          id: llmCallId, req, model, clientId, outcome: 'budget_blocked', errorClass: 'BudgetExceededError',
        }), log);
      }
      throw err;
    }

    // Step 4 — retry loop (R14.5). Row write AFTER loop so a write failure
    // does NOT retry the upstream API call.
    const start = Date.now();
    let lastErr: Error | undefined;
    let response: LLMCompleteResponse | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        response = await this.#invoke(req, model);
        break;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        lastErr = e;
        if (!isRetryable(e) || attempt === MAX_RETRIES) break;
        const backoff = this.#retryBackoffMs * 2 ** attempt;
        log.warn({ attempt, backoffMs: backoff, err: e.message }, 'llm retry');
        if (backoff > 0) await sleep(backoff);
      }
    }

    // Step 5 — success path: compute actual cost, write row, return.
    if (response !== undefined) {
      const durationMs = Date.now() - start;
      const pricing = pricingFor(model);
      const costUsd =
        response.usage.promptTokens * pricing.input +
        response.usage.completionTokens * pricing.output;
      await this.#tryWriteRow(buildRow({
        id: llmCallId, req, model, clientId, outcome: 'ok', errorClass: null,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        costUsd, durationMs, cacheHit: response.usage.cacheHit,
      }), log);
      log.info({ costUsd, durationMs }, 'llm complete ok');
      return { ...response, costUsd, durationMs };
    }

    // Retry exhaustion → outcome='unavailable' (R14.5).
    const durationMs = Date.now() - start;
    await this.#tryWriteRow(buildRow({
      id: llmCallId, req, model, clientId, outcome: 'unavailable',
      errorClass: lastErr?.name ?? 'UnknownError', durationMs,
    }), log);
    throw new LLMUnavailableError(
      `LLMUnavailableError: ${MAX_RETRIES} retries exhausted (${lastErr?.message ?? 'unknown'})`,
      MAX_RETRIES + 1,
      lastErr ?? new Error('unknown'),
    );
  }

  async #invoke(req: LLMCompleteRequest, model: string): Promise<LLMCompleteResponse> {
    if (this.#transport !== undefined) return this.#transport.complete({ ...req, model });
    // Real Anthropic SDK call (R9 SOLE importer).
    const res = await this.#anthropic!.messages.create({
      model,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      ...(req.systemPrompt !== undefined ? { system: req.systemPrompt } : {}),
      messages: [{ role: 'user', content: req.userPrompt }],
    });
    const text = res.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('\n');
    return {
      text,
      model: res.model,
      usage: {
        promptTokens: res.usage.input_tokens,
        completionTokens: res.usage.output_tokens,
        cacheHit: (res.usage.cache_read_input_tokens ?? 0) > 0,
      },
      costUsd: 0, durationMs: 0, // overwritten by caller from pricing + clock.
    };
  }

  /** Resolve (client_id, budget) via SELECT ... FOR UPDATE (R23 KC-5 lock).
   * Degrades to placeholder + unlimited budget if the row is missing. */
  async #resolveAuditContext(
    auditRunId: string,
    log: Logger,
  ): Promise<{ client_id: string; budget_remaining_usd: number }> {
    const res = await this.#storage
      .withClient(PLACEHOLDER_UUID, async (tx) => {
        const r = await tx.query<{ client_id: string; budget_remaining_usd: string | number }>(
          `SELECT client_id, budget_remaining_usd FROM audit_runs WHERE id = $1 FOR UPDATE`,
          [auditRunId],
        );
        return r.rows[0];
      })
      .catch((err) => {
        log.warn({ err: (err as Error).message }, 'audit_run lookup failed; degrading');
        return undefined;
      });
    if (res !== undefined) {
      return { client_id: res.client_id, budget_remaining_usd: Number(res.budget_remaining_usd) };
    }
    return { client_id: PLACEHOLDER_UUID, budget_remaining_usd: Number.POSITIVE_INFINITY };
  }

  async #tryWriteRow(record: LLMCallRecord, log: Logger): Promise<void> {
    // Best-effort: primary call result is preserved when audit_runs FK
    // target is missing (test path); AC-15 integration seeds & verifies.
    try {
      await this.#storage.appendLLMCallLog(record);
    } catch (err) {
      log.warn({ err: (err as Error).message, outcome: record.outcome }, 'llm_call_log append failed');
    }
  }
}

// ── File-local helpers ────────────────────────────────────────────────────

interface BuildRowArgs {
  readonly id: string; readonly req: LLMCompleteRequest; readonly model: string;
  readonly clientId?: string; readonly outcome: LLMCallRecord['outcome'];
  readonly errorClass?: string | null;
  readonly promptTokens?: number; readonly completionTokens?: number;
  readonly costUsd?: number; readonly durationMs?: number; readonly cacheHit?: boolean;
}

const buildRow = (a: BuildRowArgs): LLMCallRecord => ({
  id: a.id,
  audit_run_id: a.req.audit_run_id,
  client_id: a.clientId ?? a.req.client_id ?? PLACEHOLDER_UUID,
  operation: a.req.operation,
  model: a.model,
  prompt_tokens: a.promptTokens ?? 0,
  completion_tokens: a.completionTokens ?? 0,
  cost_usd: a.costUsd ?? 0,
  duration_ms: a.durationMs ?? 0,
  cache_hit: a.cacheHit ?? false,
  outcome: a.outcome,
  error_class: a.errorClass ?? null,
  created_at: new Date(),
});

const RETRYABLE_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED']);
const RETRYABLE_NAMES = new Set(['APIConnectionError', 'APIConnectionTimeoutError', 'InternalServerError']);

const isRetryable = (err: Error): boolean => {
  const status = (err as Error & { status?: number }).status;
  if (typeof status === 'number' && status >= 500 && status < 600) return true;
  if (RETRYABLE_CODES.has((err as Error & { code?: string }).code ?? '')) return true;
  if (RETRYABLE_NAMES.has(err.name)) return true;
  return err.message.includes('timeout');
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Lazy PostgresStorage — avoid touching pg.Pool at module load (AC-09/AC-10
// conformance tests don't need a DB).
let _storage: StorageAdapter | undefined;
const lazyStorage = (): StorageAdapter => {
  if (_storage === undefined) _storage = new PostgresStorage();
  return _storage;
};
