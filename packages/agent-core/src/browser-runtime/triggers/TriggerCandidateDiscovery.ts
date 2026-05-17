/**
 * TriggerCandidateDiscovery — T5B-015 Phase 5b trigger taxonomy.
 *
 * Source: phase-5b spec.md §20 + §3.2 + §3.3 + AC-15 + R-17
 *   (REQ-STATE-EXPL-TRIGGER-006 candidate enumeration).
 *
 * Pulls interactive_nodes from ax_tree (Phase 1c ElementGraph T1C-007 will
 * supply these; we accept them as injected input until then) and adds
 * hover / scroll / time / exit-intent / form-input candidates.
 *
 * Returns a prioritized candidate list ordered (PRIORITY_ORDER):
 *   variant > tabs > accordions > modals > cart > sticky > hover >
 *   carousels.
 *
 * R26 budget: ≤10 candidates per (trigger_type, state, page).
 * Dedupe key: (element_id, trigger_type) within the same (state, page).
 *
 * Mobile viewport excludes hover + exit_intent candidates (R-10 + R-11).
 *
 * Anchor: @T5B-015 — TriggerCandidateDiscovery.
 */
import type { DeviceType } from '../../orchestration/ViewportConfigService.js';
import { createLogger } from '../../observability/logger.js';

/** Spec §20 union. tab / accordion remain in the type for v1.1 forward-compat. */
export type TriggerType =
  | 'click'
  | 'hover'
  | 'scroll'
  | 'time'
  | 'exit_intent'
  | 'form_input'
  | 'tab'
  | 'accordion';

/** Click-target kinds — drives PRIORITY_ORDER tie-breaking. */
export type ClickKind = 'variant' | 'tabs' | 'accordions' | 'modals' | 'cart' | 'sticky' | 'hover' | 'carousels';

export const PRIORITY_ORDER: readonly ClickKind[] = [
  'variant',
  'tabs',
  'accordions',
  'modals',
  'cart',
  'sticky',
  'hover',
  'carousels',
] as const;

/** R-17 per-type budget — ≤10 per (trigger_type, state, page). */
export const PER_TYPE_BUDGET = 10;

/** Caller-supplied node descriptor (Phase 1c ElementGraph row shape). */
export interface InteractiveNode {
  readonly element_id: string;
  readonly selector: string;
  readonly role: string;
  readonly kind: ClickKind;
  readonly has_hover_rule: boolean;
  readonly has_aria_haspopup: boolean;
  readonly has_mouseleave_script: boolean;
  readonly is_form_field: boolean;
}

export interface DiscoveryInput {
  readonly interactive_nodes: ReadonlyArray<InteractiveNode>;
  readonly viewport: { readonly device_type: DeviceType };
  readonly page_url: string;
  readonly state_id: string;
}

export interface TriggerCandidate {
  readonly element_id: string;
  readonly selector: string;
  readonly trigger_type: TriggerType;
  /** Lower = higher priority. */
  readonly priority: number;
}

export interface DiscoveryOutput {
  readonly candidates: ReadonlyArray<TriggerCandidate>;
  readonly dropped_for_budget: number;
}

export class TriggerCandidateDiscovery {
  private readonly log = createLogger('trigger-candidate-discovery');

  discover(input: DiscoveryInput): DiscoveryOutput {
    const isMobile = input.viewport.device_type === 'mobile';
    const raw: TriggerCandidate[] = [];

    for (const n of input.interactive_nodes) {
      // click candidate — kind drives priority
      raw.push({
        element_id: n.element_id,
        selector: n.selector,
        trigger_type: 'click',
        priority: PRIORITY_ORDER.indexOf(n.kind),
      });

      // hover candidate — desktop only; needs :hover rule or aria-haspopup
      if (!isMobile && (n.has_hover_rule || n.has_aria_haspopup)) {
        raw.push({
          element_id: n.element_id,
          selector: n.selector,
          trigger_type: 'hover',
          priority: PRIORITY_ORDER.indexOf('hover'),
        });
      }

      // form-input candidate
      if (n.is_form_field) {
        raw.push({
          element_id: n.element_id,
          selector: n.selector,
          trigger_type: 'form_input',
          priority: 100,
        });
      }
    }

    // page-level: time always; scroll always (page-level synthetic node).
    raw.push({ element_id: '__page__', selector: 'document', trigger_type: 'time', priority: 0 });
    raw.push({ element_id: '__page__', selector: 'document', trigger_type: 'scroll', priority: 0 });

    // page-level: exit_intent if any node carries a mouseleave script + desktop
    const hasExit = input.interactive_nodes.some((n) => n.has_mouseleave_script);
    if (hasExit && !isMobile) {
      raw.push({
        element_id: '__page__',
        selector: 'document',
        trigger_type: 'exit_intent',
        priority: 0,
      });
    }

    const deduped = dedupe(raw);
    // sort: priority asc; stable element order preserved by Array.sort on V8.
    deduped.sort((a, b) => a.priority - b.priority);

    const { kept, dropped } = applyBudget(deduped, PER_TYPE_BUDGET);
    this.log.debug(
      {
        event: 'discovery.complete',
        page_url: input.page_url,
        state_id: input.state_id,
        viewport: input.viewport.device_type,
        kept: kept.length,
        dropped,
      },
      'trigger candidates discovered',
    );
    return { candidates: kept, dropped_for_budget: dropped };
  }
}

function dedupe(list: TriggerCandidate[]): TriggerCandidate[] {
  const seen = new Set<string>();
  const out: TriggerCandidate[] = [];
  for (const c of list) {
    const k = `${c.element_id}::${c.trigger_type}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function applyBudget(
  list: TriggerCandidate[],
  budget: number,
): { kept: TriggerCandidate[]; dropped: number } {
  const counts = new Map<TriggerType, number>();
  const kept: TriggerCandidate[] = [];
  let dropped = 0;
  for (const c of list) {
    const used = counts.get(c.trigger_type) ?? 0;
    if (used >= budget) {
      dropped++;
      continue;
    }
    counts.set(c.trigger_type, used + 1);
    kept.push(c);
  }
  return { kept, dropped };
}
