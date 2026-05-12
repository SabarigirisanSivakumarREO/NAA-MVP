/**
 * WarningEmitter — Phase 1c T1C-009.
 *
 * Source: docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md
 *           AC-09 + R-09 (v0.2);
 *         docs/specs/mvp/phases/phase-1c-perception-bundle/plan.md
 *           §2.6 (severity routing);
 *         docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-009.
 *
 * Capture-only buffer for the closed 12-code WarningCode enum that
 * downstream pipeline stages (settle predicate, shadow-DOM traverser,
 * iframe-policy engine, element-graph builder, extension runner,
 * security detectors) emit while building the PerceptionBundle envelope.
 *
 * Closed 12-code enum (v0.2 — v0.1 had 9; v0.2 added EXTENSION_OUTPUT_MISSING
 * + 3 security-sensitive iframe-purpose variants CAPTCHA_DETECTED /
 * CMP_DETECTED / PAYMENT_3DS_DETECTED):
 *   - SETTLE_TIMEOUT_5S            — settle predicate hit 5s ceiling
 *   - SHADOW_DOM_NOT_TRAVERSED     — depth>5 / cross-origin host
 *   - IFRAME_SKIPPED               — generic iframe non-descent (see purpose)
 *   - FONTS_NOT_READY              — document.fonts.ready did not fire
 *   - ANIMATION_NOT_SETTLED        — Web Animations API still running
 *   - COOKIE_BANNER_BLOCKING_FOLD  — visible cookie banner over fold area
 *   - AUTH_REQUIRED_DETECTED       — login wall blocks public capture
 *   - ELEMENT_GRAPH_TRUNCATED      — element-graph node cap reached
 *   - EXTENSION_OUTPUT_MISSING     — extension runner returned no output
 *   - CAPTCHA_DETECTED             — security: captcha iframe purpose
 *   - CMP_DETECTED                 — informational: consent management iframe
 *   - PAYMENT_3DS_DETECTED         — security: 3-D Secure payment iframe
 *
 * Severity routing (per spec R-05 v0.2 + R-09 v0.2 + plan §2.6):
 *   - info:  CMP_DETECTED (Phase 5b owns consent dismissal)
 *            — IFRAME_SKIPPED when purpose === 'analytics' uses per-call
 *              override (default warn here matches the generic case)
 *   - warn:  SETTLE_TIMEOUT_5S, SHADOW_DOM_NOT_TRAVERSED, IFRAME_SKIPPED,
 *            FONTS_NOT_READY, ANIMATION_NOT_SETTLED,
 *            COOKIE_BANNER_BLOCKING_FOLD, AUTH_REQUIRED_DETECTED,
 *            ELEMENT_GRAPH_TRUNCATED, EXTENSION_OUTPUT_MISSING,
 *            CAPTCHA_DETECTED, PAYMENT_3DS_DETECTED
 *   - error: (none in MVP — reserved)
 *
 * Constitutional compliance:
 *   - R10.1 file ≤ 300 LOC (target ≤ 150)
 *   - R10.2 functions ≤ 50 LOC
 *   - R10.3 named exports only
 *   - R3.1  test RED → GREEN
 *   - R13   no `any`
 *   - R24   capture-only; no judgment (no scoring, no policy decisions)
 */
import { z } from 'zod';

/**
 * Closed 12-code WarningCode enum (R-09 v0.2). Frozen tuple for type-narrowing
 * via `(typeof WARNING_CODE_ENUM)[number]`.
 */
export const WARNING_CODE_ENUM = [
  'SETTLE_TIMEOUT_5S',
  'SHADOW_DOM_NOT_TRAVERSED',
  'IFRAME_SKIPPED',
  'FONTS_NOT_READY',
  'ANIMATION_NOT_SETTLED',
  'COOKIE_BANNER_BLOCKING_FOLD',
  'AUTH_REQUIRED_DETECTED',
  'ELEMENT_GRAPH_TRUNCATED',
  'EXTENSION_OUTPUT_MISSING',
  'CAPTCHA_DETECTED',
  'CMP_DETECTED',
  'PAYMENT_3DS_DETECTED',
] as const;

export type WarningCode = (typeof WARNING_CODE_ENUM)[number];

export const WarningCodeSchema = z.enum(WARNING_CODE_ENUM);

/** Severity enum — error reserved for post-MVP. */
export const SEVERITY_ENUM = ['info', 'warn', 'error'] as const;

export type Severity = (typeof SEVERITY_ENUM)[number];

export const SeveritySchema = z.enum(SEVERITY_ENUM);

/** Closed Warning shape per R-09 v0.2: `{code, message, severity}`. */
export interface Warning {
  code: WarningCode;
  message: string;
  severity: Severity;
}

export const WarningSchema = z
  .object({
    code: WarningCodeSchema,
    message: z.string(),
    severity: SeveritySchema,
  })
  .strict();

/**
 * Default severity per code. IFRAME_SKIPPED defaults to `warn` for the
 * generic (video / social_embed / other / cross_origin) case; the
 * iframe-policy engine MUST pass `severity: 'info'` when purpose ===
 * 'analytics' (per R-05 v0.2).
 */
export const WARNING_SEVERITY_MAP: Readonly<Record<WarningCode, Severity>> =
  Object.freeze({
    SETTLE_TIMEOUT_5S: 'warn',
    SHADOW_DOM_NOT_TRAVERSED: 'warn',
    IFRAME_SKIPPED: 'warn',
    FONTS_NOT_READY: 'warn',
    ANIMATION_NOT_SETTLED: 'warn',
    COOKIE_BANNER_BLOCKING_FOLD: 'warn',
    AUTH_REQUIRED_DETECTED: 'warn',
    ELEMENT_GRAPH_TRUNCATED: 'warn',
    EXTENSION_OUTPUT_MISSING: 'warn',
    CAPTCHA_DETECTED: 'warn',
    CMP_DETECTED: 'info',
    PAYMENT_3DS_DETECTED: 'warn',
  });

/**
 * Capture-only Warning buffer. One instance per PerceptionBundle build;
 * downstream stages call `emit()`; the bundle assembler calls `collect()`
 * once at envelope-finalization time.
 *
 * Closed-enum guard: `emit()` throws on an off-enum code so silent typos
 * cannot drift through to the bundle. (Test AC-09 case 5 exercises this.)
 */
export class WarningEmitter {
  private readonly warnings: Warning[] = [];

  /**
   * Append one warning to the buffer.
   *
   * @param code      one of the 12 WarningCode values
   * @param message   human-readable detail (default: empty string)
   * @param severity  per-call override; defaults to WARNING_SEVERITY_MAP[code]
   * @throws Error    when `code` is not in WARNING_CODE_ENUM
   */
  emit(code: WarningCode, message?: string, severity?: Severity): void {
    if (!WARNING_CODE_ENUM.includes(code)) {
      throw new Error(
        `WarningEmitter.emit: off-enum code "${String(code)}" rejected (closed 12-code contract)`,
      );
    }
    const resolvedSeverity: Severity = severity ?? WARNING_SEVERITY_MAP[code];
    this.warnings.push({
      code,
      message: message ?? '',
      severity: resolvedSeverity,
    });
  }

  /**
   * Return an immutable snapshot of all emitted warnings (insertion order).
   * The returned array is a fresh frozen copy — callers cannot mutate
   * the internal buffer.
   */
  collect(): readonly Warning[] {
    return Object.freeze(this.warnings.map((w) => ({ ...w })));
  }
}
