/**
 * AC-05 — ElementTextStrategy conformance (Phase 3 T055).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-05 (v0.3 F04)
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T055
 *     (REQ-VERIFY-003)
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §ActionContract.elementText
 *
 * AC-05 contract:
 *   - name='element_text', applicable(c) === (c.expected.kind === 'elementText').
 *   - Reads `element.value` for <input>/<textarea>/<select>; `element.textContent`
 *     otherwise.
 *   - Match semantics: string text = substring match, case-sensitive;
 *     RegExp text = `.test(actual)` pattern match.
 *   - Runtime dispatch via typeof / instanceof RegExp (mirrors T053).
 *
 * RED state — Phase 3 Wave 0 (T-PHASE3-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-05 — substring match + element-type dispatch.
 */
import { describe, expect, it, vi } from 'vitest';

import { ElementTextStrategy } from '../../src/verification/strategies/ElementTextStrategy.js';
import type { ActionContract } from '../../src/verification/types.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';

interface TextProbe {
  tagName: string;
  textContent: string | null;
  value: string | null;
}

/**
 * Stub session whose page.evaluate() returns a TextProbe payload representing
 * the queried element. The strategy is expected to dispatch on tagName:
 * <input>/<textarea>/<select> → use `value`; anything else → use `textContent`.
 */
function stubSession(probe: TextProbe | null): BrowserSession {
  const evaluate = vi.fn(async () => probe);
  return {
    id: 'stub-session',
    page: { evaluate },
  } as unknown as BrowserSession;
}

function makeContract(selector: string, text: string | RegExp): ActionContract {
  return {
    id: '00000000-0000-4000-8000-000000000030',
    type: 'type',
    expected: { kind: 'elementText', selector, text },
    candidateStrategies: ['element_text'],
  } as ActionContract;
}

describe('ElementTextStrategy — AC-05 conformance (RED until T055)', () => {
  it('AC-05: name === "element_text" and applicable() gates on expected.kind', () => {
    const strategy = new ElementTextStrategy();
    expect(strategy.name).toBe('element_text');
    const contract = makeContract('input.search', 'amazon');
    expect(strategy.applicable(contract)).toBe(true);
  });

  it('AC-05: string text substring match (case-sensitive) — lowercase substring matches lowercase input value', async () => {
    const strategy = new ElementTextStrategy();
    const session = stubSession({
      tagName: 'INPUT',
      textContent: null,
      value: 'shop amazon today',
    });
    const result = await strategy.verify(makeContract('input.search', 'amazon'), session);
    expect(result.ok).toBe(true);
  });

  it('AC-05: string text substring match IS case-sensitive — capital "Amazon" does NOT match "amazon"', async () => {
    const strategy = new ElementTextStrategy();
    const session = stubSession({
      tagName: 'INPUT',
      textContent: null,
      value: 'shop amazon today',
    });
    const result = await strategy.verify(makeContract('input.search', 'Amazon'), session);
    expect(result.ok).toBe(false);
  });

  it('AC-05: RegExp text uses .test() — pattern match succeeds', async () => {
    const strategy = new ElementTextStrategy();
    const session = stubSession({
      tagName: 'INPUT',
      textContent: null,
      value: 'shop AMAZON today',
    });
    const result = await strategy.verify(
      makeContract('input.search', /amazon/i),
      session,
    );
    expect(result.ok).toBe(true);
  });

  it('AC-05: RegExp text mismatch → ok:false', async () => {
    const strategy = new ElementTextStrategy();
    const session = stubSession({
      tagName: 'INPUT',
      textContent: null,
      value: 'shop ebay today',
    });
    const result = await strategy.verify(
      makeContract('input.search', /amazon/),
      session,
    );
    expect(result.ok).toBe(false);
  });

  it('AC-05: <input> reads .value (NOT .textContent)', async () => {
    const strategy = new ElementTextStrategy();
    const session = stubSession({
      tagName: 'INPUT',
      textContent: 'IGNORED TEXTCONTENT',
      value: 'amazon',
    });
    const result = await strategy.verify(makeContract('input.search', 'amazon'), session);
    expect(result.ok).toBe(true);
  });

  it('AC-05: <textarea> reads .value (NOT .textContent)', async () => {
    const strategy = new ElementTextStrategy();
    const session = stubSession({
      tagName: 'TEXTAREA',
      textContent: 'IGNORED TEXTCONTENT',
      value: 'hello amazon',
    });
    const result = await strategy.verify(makeContract('textarea.note', 'amazon'), session);
    expect(result.ok).toBe(true);
  });

  it('AC-05: <select> reads .value (NOT .textContent)', async () => {
    const strategy = new ElementTextStrategy();
    const session = stubSession({
      tagName: 'SELECT',
      textContent: 'IGNORED TEXTCONTENT',
      value: 'option-amazon',
    });
    const result = await strategy.verify(makeContract('select.country', 'amazon'), session);
    expect(result.ok).toBe(true);
  });

  it('AC-05: non-input element (e.g. <span>) reads .textContent', async () => {
    const strategy = new ElementTextStrategy();
    const session = stubSession({
      tagName: 'SPAN',
      textContent: 'welcome to amazon',
      value: null,
    });
    const result = await strategy.verify(makeContract('span.banner', 'amazon'), session);
    expect(result.ok).toBe(true);
  });

  it('AC-05: <div> with mismatched textContent → ok:false', async () => {
    const strategy = new ElementTextStrategy();
    const session = stubSession({
      tagName: 'DIV',
      textContent: 'welcome to ebay',
      value: null,
    });
    const result = await strategy.verify(makeContract('div.banner', 'amazon'), session);
    expect(result.ok).toBe(false);
  });

  it('AC-05: missing element (probe returns null) → ok:false', async () => {
    const strategy = new ElementTextStrategy();
    const session = stubSession(null);
    const result = await strategy.verify(makeContract('input.search', 'amazon'), session);
    expect(result.ok).toBe(false);
  });
});
