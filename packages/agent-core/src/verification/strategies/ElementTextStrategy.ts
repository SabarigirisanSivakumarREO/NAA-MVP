/**
 * ElementTextStrategy — `element_text` MVP verify strategy (Phase 3 T055).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-05 + R-05
 *     (REQ-VERIFY-003) + Scenario 3 (v0.3 F04 closure).
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T055 brief.
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §ActionContract
 *     `elementText` — `text` is flat on the discriminator variant.
 *
 * AC-05 contract:
 *   - name='element_text', priority=70 (below url_change=100, element_appears=80).
 *   - applicable(c) iff `c.expected.kind === 'elementText'`.
 *   - Single page.evaluate() returns `{ tagName, textContent, value }`. Form
 *     fields (INPUT/TEXTAREA/SELECT) read `.value`; others read `.textContent`.
 *     Absent element → `{ ok:false, error:'element_not_found' }`.
 *   - String text = case-sensitive substring (`actual.includes(expected.text)`);
 *     RegExp text = `expected.text.test(actual)`. Runtime dispatch mirrors T053.
 *
 * R9: consumes BrowserSession via Phase 1 adapter; no Playwright import. Probe
 *   is a string literal (click.ts pattern) so no `lib: ["dom"]` needed.
 * R10: file ≤ 100 LOC; named exports only; no `any`; no console.log.
 */
import type { Logger } from 'pino';

import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { ActionContract, VerifyResult, VerifyStrategy } from '../types.js';

/** Single-pass probe returned by page.evaluate(). */
interface TextProbe {
  tagName: string;
  textContent: string | null;
  value: string | null;
}

/** Page-context script — selector → TextProbe | null. String literal avoids DOM lib. */
const PROBE_SCRIPT = `(selector) => {
  const el = document.querySelector(selector);
  if (el === null) return null;
  const tag = el.tagName;
  const isField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  return { tagName: tag, textContent: el.textContent, value: isField ? el.value : null };
}`;

/** Form-field discriminator — INPUT/TEXTAREA/SELECT use .value; else .textContent. */
export function isFormField(tagName: string): boolean {
  const t = tagName.toUpperCase();
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT';
}

/** Effective text per AC-05 element-type dispatch. */
function extractText(probe: TextProbe): string {
  if (isFormField(probe.tagName)) return probe.value ?? '';
  return probe.textContent ?? '';
}

export class ElementTextStrategy implements VerifyStrategy {
  readonly name = 'element_text' as const;
  readonly priority = 70;

  constructor(private readonly logger?: Logger) {}

  applicable(contract: ActionContract): boolean {
    return contract.expected.kind === 'elementText';
  }

  async verify(contract: ActionContract, session: BrowserSession): Promise<VerifyResult> {
    if (contract.expected.kind !== 'elementText') {
      throw new Error('ElementTextStrategy received non-elementText contract');
    }
    const { selector, text: expectedText } = contract.expected;
    const child = this.logger?.child({ verify_strategy: 'element_text', action_id: contract.id });
    child?.debug({ selector }, 'verify.dispatch');

    const probe = await session.page.evaluate<TextProbe | null>(PROBE_SCRIPT, selector);
    if (probe === null) {
      child?.debug({ selector }, 'verify.element_not_found');
      return { ok: false, strategy: 'element_text', evidence: { selector }, error: 'element_not_found' };
    }

    const actualText = extractText(probe);
    const ok = expectedText instanceof RegExp
      ? expectedText.test(actualText)
      : actualText.includes(expectedText);

    if (ok) {
      child?.debug({ selector, actualText }, 'verify.ok');
      return { ok: true, strategy: 'element_text', evidence: { selector, actualText } };
    }

    child?.debug({ selector, actualText }, 'verify.mismatch');
    return { ok: false, strategy: 'element_text', evidence: { selector, actualText }, error: 'text_mismatch' };
  }
}
