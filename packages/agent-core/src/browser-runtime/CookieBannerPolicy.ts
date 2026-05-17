/**
 * CookieBannerPolicy — Phase 5b T5B-017 (AC-17, REQ-BROWSE-COOKIE-001).
 *
 * Source: phase-5b spec.md §4.4 + §11.1.1 (robots/ToS consent); tasks.md
 *   T5B-017 + act-015 (Accept-only in MVP; reject-flow deferred v1.1) +
 *   act-016 (>40% fold → COOKIE_BANNER_BLOCKING_FOLD warning).
 *
 * Executes the consultant-declared `cookie_policy` from AuditRequest
 * (T5B-018) against a BannerDescriptor produced by CookieBannerDetector
 * (T5B-016):
 *
 *   - `dismiss`  — click the descriptor.dismissibility.accept_selector
 *                  (Accept only; reject-flow deferred v1.1 per act-015).
 *   - `preserve` — keep banner present for downstream analysis; emit
 *                  COOKIE_BANNER_BLOCKING_FOLD if foldCoveragePercent
 *                  >40 (per act-016 threshold).
 *   - `block`    — REJECTED with INVALID_COOKIE_POLICY (consent breakage;
 *                  Zod at T5B-018 also rejects this, this is defense in
 *                  depth in case a caller bypasses schema validation).
 *
 * R5.3 / R24: ONE click only (the accept button). No navigation. No
 *   form submission. No PII / credential entry. Idempotent — a second
 *   call after dismissal is a no-op (selector won't resolve).
 * R10: file ≤300 LOC, functions ≤50 LOC, no `any`, named exports only.
 * R9: zero vendor deps; pure-DOM (operates on local DocumentLike).
 */

import type { BannerDescriptor } from './CookieBannerDetector.js';

// ── minimal DOM types (local — agent-core tsconfig excludes DOM lib) ─────
interface ElementLike {
  click(): void;
}
interface DocumentLike {
  querySelector(selectors: string): ElementLike | null;
}

// ── public contract ──────────────────────────────────────────────────────
export interface Viewport {
  width: number;
  height: number;
}

export type CookiePolicyDecision = 'dismiss' | 'preserve';

export interface CookiePolicyResult {
  /** The policy that was applied. */
  action: CookiePolicyDecision;
  /** `true` iff the policy was `dismiss` AND an accept click fired. */
  dismissed: boolean;
  /** Structured warning codes emitted while applying the policy. */
  warnings: string[];
}

/** Error code thrown when caller passes `block` (Zod-rejected value). */
export const INVALID_COOKIE_POLICY = 'INVALID_COOKIE_POLICY';

/** Per act-016: warn when banner covers >40% of fold + not dismissed. */
export const FOLD_BLOCKING_THRESHOLD_PCT = 40;

// ── public API ───────────────────────────────────────────────────────────

/**
 * Apply the consultant's cookie policy against a detected banner.
 *
 * @param doc Document under inspection.
 * @param descriptor BannerDescriptor from CookieBannerDetector (T5B-016).
 * @param policy AuditRequest.cookie_policy (T5B-018; `dismiss` | `preserve`).
 * @param _viewport Viewport — reserved for future per-viewport heuristics
 *                  (kept in signature so callers don't refactor when
 *                  fold-coverage recomputation moves here in v1.1).
 *
 * @throws INVALID_COOKIE_POLICY when `policy === 'block'`.
 */
export function applyCookiePolicy(
  doc: DocumentLike,
  descriptor: BannerDescriptor,
  policy: CookiePolicyDecision,
  _viewport: Viewport,
): CookiePolicyResult {
  // Defense-in-depth: Zod already rejects `block` at AuditRequest parse,
  // but a caller bypassing Zod must still trip a structured error.
  if ((policy as string) === 'block') {
    throw new Error(
      `${INVALID_COOKIE_POLICY}: cookie_policy="block" is not supported in MVP — ` +
        'breaks consent flows. Use "dismiss" or "preserve". (REQ-BROWSE-COOKIE-001)',
    );
  }
  if (policy !== 'dismiss' && policy !== 'preserve') {
    throw new Error(
      `${INVALID_COOKIE_POLICY}: unknown cookie_policy="${String(policy)}". ` +
        'Expected "dismiss" | "preserve". (REQ-BROWSE-COOKIE-001)',
    );
  }

  const warnings: string[] = [];

  if (policy === 'preserve') {
    if (descriptor.foldCoveragePercent > FOLD_BLOCKING_THRESHOLD_PCT) {
      warnings.push('COOKIE_BANNER_BLOCKING_FOLD');
    }
    return { action: 'preserve', dismissed: false, warnings };
  }

  // policy === 'dismiss' — Accept-only per act-015.
  const sel = descriptor.dismissibility.accept_selector;
  if (!sel) {
    warnings.push('COOKIE_BANNER_NO_ACCEPT_BUTTON');
    return { action: 'dismiss', dismissed: false, warnings };
  }
  const btn = doc.querySelector(sel);
  if (!btn) {
    warnings.push('COOKIE_BANNER_NO_ACCEPT_BUTTON');
    return { action: 'dismiss', dismissed: false, warnings };
  }
  try {
    btn.click();
    return { action: 'dismiss', dismissed: true, warnings };
  } catch {
    warnings.push('COOKIE_BANNER_DISMISS_FAILED');
    return { action: 'dismiss', dismissed: false, warnings };
  }
}
