/**
 * FrictionScorer — Phase 1b T1B-005 (AC-05, R-05, REQ-ANALYZE-PERCEPTION-V24-001).
 *
 * Source: phase-1b-perception-extensions/{spec.md AC-05+R-05, plan.md §2.4, tasks.md T1B-005}.
 *
 * Computes a deterministic friction metric from T1B-000 `formFields[]` +
 * T1B-004 `popups[]`. Pure + synchronous; ALWAYS returns a FrictionScore.
 *
 * Formula (plan.md §2.4 — implement exactly as specified):
 *   raw = totalFormFields*1 + requiredFormFields*1.5
 *       + popupCount*2 + forcedActionCount*4
 *   normalized = clamp(raw / 30, 0, 1)
 *
 * Calibration: the `30` denominator is tuned so a typical e-comm checkout
 * (15 fields, 5 required, 1 popup, 0 forced) lands near normalized ≈ 0.82
 * (raw 24.5 / 30 ≈ 0.817). Subject to revision in Phase 6.
 *
 * R5.3 + GR-007: this is a structural friction-COUNT metric, NOT a
 * conversion-rate forecast. R24: pure structural calculation — no
 * judgment of "too much friction" (Phase 6 heuristic territory).
 *
 * R10: ≤120 LOC, ≤50 LOC/fn, named exports only, no `any`.
 */

import type { FormField } from '../types.js';

/**
 * Subset of T1B-004 `Popup` shape FrictionScorer reads. Mirrored locally
 * (not imported) so adding popup fields in Phase 5b does not force a
 * recompile here. Only the dismissibility-relevant fields are needed.
 */
export interface PopupForFriction {
  blocksPrimaryContent?: boolean;
  isInitiallyOpen?: boolean;
  hasCloseButton?: boolean;
}

/** Subset of `ExtractCtx` (plan.md §2.2) consumed by T1B-005. */
export interface FrictionExtractCtx {
  formFields?: ReadonlyArray<FormField> | null;
  popups?: ReadonlyArray<PopupForFriction> | null;
}

/** AC-05 output contract — exactly 6 fields, no more, no less. */
export interface FrictionScore {
  totalFormFields: number;
  requiredFormFields: number;
  popupCount: number;
  forcedActionCount: number;
  raw: number;
  normalized: number;
}

// Formula weights — plan.md §2.4.
const WEIGHT_FIELD = 1;
const WEIGHT_REQUIRED = 1.5;
const WEIGHT_POPUP = 2;
const WEIGHT_FORCED = 4;
const NORMALIZATION_DENOMINATOR = 30;

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/**
 * "Forced action" = popup the user cannot easily dismiss. OR conditions:
 *   1. blocksPrimaryContent === true (>40% viewport per T1B-004), OR
 *   2. isInitiallyOpen === true && hasCloseButton === false
 */
function isForcedAction(p: PopupForFriction): boolean {
  if (p.blocksPrimaryContent === true) return true;
  if (p.isInitiallyOpen === true && p.hasCloseButton === false) return true;
  return false;
}

function countRequired(fields: ReadonlyArray<FormField>): number {
  let n = 0;
  for (let i = 0; i < fields.length; i += 1) {
    const f = fields[i];
    if (f && f.required === true) n += 1;
  }
  return n;
}

function countForced(popups: ReadonlyArray<PopupForFriction>): number {
  let n = 0;
  for (let i = 0; i < popups.length; i += 1) {
    const p = popups[i];
    if (p && isForcedAction(p)) n += 1;
  }
  return n;
}

/**
 * Compute the FrictionScore for a page. Defensive against null/undefined
 * substrate — empty arrays produce raw=0, normalized=0.
 */
export function computeFrictionScore(ctx: FrictionExtractCtx): FrictionScore {
  const fields: ReadonlyArray<FormField> = ctx.formFields ?? [];
  const popups: ReadonlyArray<PopupForFriction> = ctx.popups ?? [];

  const totalFormFields = fields.length;
  const requiredFormFields = countRequired(fields);
  const popupCount = popups.length;
  const forcedActionCount = countForced(popups);

  const raw =
    totalFormFields * WEIGHT_FIELD +
    requiredFormFields * WEIGHT_REQUIRED +
    popupCount * WEIGHT_POPUP +
    forcedActionCount * WEIGHT_FORCED;

  const normalized = clamp01(raw / NORMALIZATION_DENOMINATOR);

  return {
    totalFormFields,
    requiredFormFields,
    popupCount,
    forcedActionCount,
    raw,
    normalized,
  };
}
