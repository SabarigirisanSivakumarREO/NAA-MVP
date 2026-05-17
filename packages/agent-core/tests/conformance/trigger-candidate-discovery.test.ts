/**
 * Conformance AC-15 — T5B-015 TriggerCandidateDiscovery.
 *
 * Spec: phase-5b spec §20 + AC-15 + R-17.
 *   Prioritization: variant > tabs > accordions > modals > cart > sticky >
 *   hover > carousels. R26 budget: ≤10 per (trigger_type, state, page).
 *   Dedupe by (element_id, trigger_type).
 *
 * @AC-15
 */
import { describe, expect, test } from 'vitest';

import {
  TriggerCandidateDiscovery,
  PER_TYPE_BUDGET,
  PRIORITY_ORDER,
  type InteractiveNode,
  type TriggerCandidate,
} from '../../src/browser-runtime/triggers/TriggerCandidateDiscovery.js';

function node(p: Partial<InteractiveNode>): InteractiveNode {
  return {
    element_id: p.element_id ?? 'n-x',
    selector: p.selector ?? '.x',
    role: p.role ?? 'button',
    kind: p.kind ?? 'cart',
    has_hover_rule: p.has_hover_rule ?? false,
    has_aria_haspopup: p.has_aria_haspopup ?? false,
    has_mouseleave_script: p.has_mouseleave_script ?? false,
    is_form_field: p.is_form_field ?? false,
  };
}

describe('TriggerCandidateDiscovery (AC-15)', () => {
  test('budget = 10 per (trigger_type, state, page)', () => {
    expect(PER_TYPE_BUDGET).toBe(10);
  });

  test('priority order: variant > tabs > accordions > modals > cart > sticky > hover > carousels', () => {
    expect(PRIORITY_ORDER).toEqual([
      'variant',
      'tabs',
      'accordions',
      'modals',
      'cart',
      'sticky',
      'hover',
      'carousels',
    ]);
  });

  test('emits hover candidate when node has_hover_rule on desktop', () => {
    const d = new TriggerCandidateDiscovery();
    const out = d.discover({
      interactive_nodes: [node({ element_id: 'a', has_hover_rule: true })],
      viewport: { device_type: 'desktop' },
      page_url: 'https://x.test/',
      state_id: 's0',
    });
    expect(out.candidates.some((c) => c.trigger_type === 'hover' && c.element_id === 'a')).toBe(true);
  });

  test('does NOT emit hover candidate on mobile viewport (no-op semantics)', () => {
    const d = new TriggerCandidateDiscovery();
    const out = d.discover({
      interactive_nodes: [node({ element_id: 'a', has_hover_rule: true })],
      viewport: { device_type: 'mobile' },
      page_url: 'https://x.test/',
      state_id: 's0',
    });
    expect(out.candidates.some((c) => c.trigger_type === 'hover')).toBe(false);
  });

  test('always emits time candidate exactly once', () => {
    const d = new TriggerCandidateDiscovery();
    const out = d.discover({
      interactive_nodes: [],
      viewport: { device_type: 'desktop' },
      page_url: 'https://x.test/',
      state_id: 's0',
    });
    expect(out.candidates.filter((c) => c.trigger_type === 'time').length).toBe(1);
  });

  test('emits exit_intent only when mouseleave detected AND not mobile', () => {
    const d = new TriggerCandidateDiscovery();
    const desktop = d.discover({
      interactive_nodes: [node({ has_mouseleave_script: true })],
      viewport: { device_type: 'desktop' },
      page_url: 'https://x.test/',
      state_id: 's0',
    });
    expect(desktop.candidates.some((c) => c.trigger_type === 'exit_intent')).toBe(true);

    const mobile = d.discover({
      interactive_nodes: [node({ has_mouseleave_script: true })],
      viewport: { device_type: 'mobile' },
      page_url: 'https://x.test/',
      state_id: 's0',
    });
    expect(mobile.candidates.some((c) => c.trigger_type === 'exit_intent')).toBe(false);
  });

  test('dedupes by (element_id, trigger_type)', () => {
    const d = new TriggerCandidateDiscovery();
    const out = d.discover({
      interactive_nodes: [
        node({ element_id: 'dup', has_hover_rule: true }),
        node({ element_id: 'dup', has_hover_rule: true }),
        node({ element_id: 'dup', has_hover_rule: true }),
      ],
      viewport: { device_type: 'desktop' },
      page_url: 'https://x.test/',
      state_id: 's0',
    });
    const hoverDups = out.candidates.filter((c) => c.element_id === 'dup' && c.trigger_type === 'hover');
    expect(hoverDups.length).toBe(1);
  });

  test('caps each trigger_type at ≤10 per (state, page)', () => {
    const d = new TriggerCandidateDiscovery();
    const nodes: InteractiveNode[] = [];
    for (let i = 0; i < 25; i++) nodes.push(node({ element_id: `c${i}`, kind: 'cart' }));
    const out = d.discover({
      interactive_nodes: nodes,
      viewport: { device_type: 'desktop' },
      page_url: 'https://x.test/',
      state_id: 's0',
    });
    const clicks = out.candidates.filter((c) => c.trigger_type === 'click');
    expect(clicks.length).toBeLessThanOrEqual(PER_TYPE_BUDGET);
  });

  test('priority order survives sort: variant before cart before sticky', () => {
    const d = new TriggerCandidateDiscovery();
    const out = d.discover({
      interactive_nodes: [
        node({ element_id: 'cart-1', kind: 'cart' }),
        node({ element_id: 'sticky-1', kind: 'sticky' }),
        node({ element_id: 'variant-1', kind: 'variant' }),
      ],
      viewport: { device_type: 'desktop' },
      page_url: 'https://x.test/',
      state_id: 's0',
    });
    const clickOrder: string[] = out.candidates
      .filter((c: TriggerCandidate) => c.trigger_type === 'click')
      .map((c) => c.element_id);
    expect(clickOrder.indexOf('variant-1')).toBeLessThan(clickOrder.indexOf('cart-1'));
    expect(clickOrder.indexOf('cart-1')).toBeLessThan(clickOrder.indexOf('sticky-1'));
  });
});
