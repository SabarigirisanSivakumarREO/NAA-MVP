/**
 * FormInputTrigger — T5B-014 Phase 5b trigger taxonomy.
 *
 * Source: phase-5b spec.md §20 + AC-14 (REQ-STATE-EXPL-TRIGGER-006) +
 *   plan §2.7 6-category R26 exclusion list.
 *
 * Behavior: type / select on `<select>`, variant pickers, quantity, and
 *   address fields to capture variant-driven price/availability changes.
 *
 * R26 exclusions (MANDATORY — typing here would breach safety):
 *   1. `<input type="password">`
 *   2. `[autocomplete^="cc-"]` (credit-card autofill)
 *   3. `<input type="hidden">`
 *   4. `<input type="file">` (file uploads — cross-origin filesystem)
 *   5. `<input name>` matching /(ssn|tax|pin|nin|aadhaar|passport)/i (PII)
 *   6. reCAPTCHA / hCaptcha iframes (`inIframe` ∈ {recaptcha, hcaptcha})
 *
 *   Cross-origin iframes are already excluded by Phase-1 R-18; this module
 *   trusts the caller to NOT pass cross-origin fields.
 *
 * Anchor: @T5B-014 — FormInputTrigger.
 */
import { createLogger } from '../../observability/logger.js';

export type ExclusionReason =
  | 'password'
  | 'credit_card'
  | 'hidden'
  | 'file'
  | 'pii_name'
  | 'captcha_iframe';

export interface FieldDescriptor {
  readonly selector: string;
  readonly tag: 'input' | 'select' | 'textarea';
  readonly type: string;
  /** `name` attribute or null. */
  readonly name: string | null;
  /** `autocomplete` attribute or null. */
  readonly autocomplete: string | null;
  /** If field is inside an iframe, the iframe purpose label (Phase 1 IframePolicyEngine). */
  readonly inIframe: string | null;
}

export interface FormPage {
  url(): string;
  fill(selector: string, value: string): Promise<void>;
  selectOption(selector: string, values: string | string[]): Promise<string[]>;
}

export interface FormFireOutput {
  readonly fired_count: number;
  readonly skipped: ReadonlyArray<{ readonly selector: string; readonly reason: ExclusionReason }>;
}

const PII_NAME_RE = /(ssn|tax|pin|nin|aadhaar|passport)/i;
const CAPTCHA_IFRAMES = new Set(['recaptcha', 'hcaptcha']);

export function isExcluded(
  f: FieldDescriptor,
): { excluded: true; reason: ExclusionReason } | { excluded: false } {
  // Cat 1: password
  if (f.tag === 'input' && f.type.toLowerCase() === 'password') {
    return { excluded: true, reason: 'password' };
  }
  // Cat 2: credit-card autofill
  if (f.autocomplete && f.autocomplete.toLowerCase().startsWith('cc-')) {
    return { excluded: true, reason: 'credit_card' };
  }
  // Cat 3: hidden
  if (f.tag === 'input' && f.type.toLowerCase() === 'hidden') {
    return { excluded: true, reason: 'hidden' };
  }
  // Cat 4: file
  if (f.tag === 'input' && f.type.toLowerCase() === 'file') {
    return { excluded: true, reason: 'file' };
  }
  // Cat 5: PII names
  if (f.name && PII_NAME_RE.test(f.name)) {
    return { excluded: true, reason: 'pii_name' };
  }
  // Cat 6: captcha iframes
  if (f.inIframe && CAPTCHA_IFRAMES.has(f.inIframe.toLowerCase())) {
    return { excluded: true, reason: 'captcha_iframe' };
  }
  return { excluded: false };
}

export class FormInputTrigger {
  private readonly log = createLogger('form-input-trigger');

  async fire(page: FormPage, fields: ReadonlyArray<FieldDescriptor>): Promise<FormFireOutput> {
    const skipped: Array<{ selector: string; reason: ExclusionReason }> = [];
    let fired = 0;
    for (const f of fields) {
      const ex = isExcluded(f);
      if (ex.excluded) {
        skipped.push({ selector: f.selector, reason: ex.reason });
        this.log.debug(
          { event: 'form.skip', trigger_type: 'form_input', selector: f.selector, reason: ex.reason },
          'R26 form-input exclusion',
        );
        continue;
      }
      try {
        if (f.tag === 'select') {
          await page.selectOption(f.selector, sampleValue(f));
        } else {
          await page.fill(f.selector, sampleValue(f));
        }
        fired++;
      } catch (err) {
        this.log.warn({ event: 'form.fire_failed', selector: f.selector, err: String(err) }, 'fill failed');
      }
    }
    return { fired_count: fired, skipped };
  }
}

/**
 * Pick a benign sample value per field kind. Variant pickers / quantity
 * use innocuous values that don't submit a transaction.
 */
function sampleValue(f: FieldDescriptor): string {
  const t = f.type.toLowerCase();
  if (f.tag === 'select') return '1';
  if (t === 'number') return '1';
  if (t === 'email') return 'noreply@example.test';
  if (t === 'tel') return '5550000000';
  return 'test';
}
