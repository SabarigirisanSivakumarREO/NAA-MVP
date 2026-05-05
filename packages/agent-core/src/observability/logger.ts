/**
 * Pino logger factory for Neural agent-core.
 *
 * Source: docs/specs/mvp/architecture.md §6.4 (logging stack);
 *         docs/specs/mvp/PRD.md §10 (R6 channel 1 — Pino redaction).
 *
 * Default correlation fields populated by callers via child loggers:
 *   audit_run_id, page_url, node_name, heuristic_id, trace_id.
 *
 * Why `base: null` (Pino API): correlation fields supply identity; pid is
 * leaky across container restarts (R14 reproducibility) and noisy in logs.
 *
 * Why two `pino()` call sites instead of conditional-spread `transport`:
 * tsconfig.json sets `exactOptionalPropertyTypes: true` (R2.x strictness),
 * which forbids assigning `undefined` to optional properties even via
 * spread; the explicit branch keeps Pino's discriminated-union types clean.
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

export function createLogger(name: string): Logger {
  return isDevelopment
    ? pino({ ...baseOptions, name, transport: devTransport })
    : pino({ ...baseOptions, name });
}

export type { Logger };
