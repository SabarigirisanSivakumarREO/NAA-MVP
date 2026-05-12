/// <reference lib="dom" />
/**
 * ShadowDomTraverser — Phase 1c T1C-002 (AC-02, REQ-BROWSE-PERCEPT-007).
 *
 * Source: spec.md AC-02 + R-02; tasks.md T1C-002.
 *
 * Recursively walks open `shadowRoot` chains starting from a host element /
 * document, collecting elements reachable through nested shadow roots. The
 * subject scope is **shadow content only** — the light DOM is consumed by
 * AccessibilityExtractor + HardFilter (Phase 1). Closed shadow roots are
 * intentionally unreachable (browser-enforced — no API path).
 *
 * Depth contract (R-02 hard cap):
 *   - Depth 0 = the supplied root host (not collected itself).
 *   - Depth N = an element nested N shadow-root attachments deep.
 *   - SHADOW_DOM_MAX_DEPTH = 5 is the deepest level collected.
 *   - If any descendant shadowRoot exists at depth 5 (would push content to
 *     depth 6), emit `SHADOW_DOM_NOT_TRAVERSED` (severity `warn`) and stop
 *     descending that subtree. Sibling subtrees keep traversing.
 *
 * R10: file ≤ 300 lines; functions ≤ 50 lines; named exports (R10.3, R4.5).
 * R13: no `any`. R24 (Perception MUST NOT): capture-only — no judgment, no
 * LLM, no mutation. Pure DOM walk over jsdom-compatible nodes.
 *
 * NOTE: `WarningCode` will be canonicalized in T1C-009 (WarningEmitter,
 * Wave 3). Until then, this module emits the string literal
 * `'SHADOW_DOM_NOT_TRAVERSED'` directly per the AC-02 test contract;
 * WarningEmitter will adopt it via union-type re-export.
 */

/**
 * Hard cap on shadow-root recursion depth (R-02 — pinned by AC-02 test).
 * Bumping this value is a SPEC change, not an implementation tweak.
 */
export const SHADOW_DOM_MAX_DEPTH = 5;

/**
 * Single warning entry shape — narrow ShadowDomTraverser-local view.
 * T1C-009 WarningEmitter will widen `code` to the canonical 12-code union
 * and re-export a shared `WarningEntry` type.
 */
export interface ShadowWarning {
  code: 'SHADOW_DOM_NOT_TRAVERSED';
  message: string;
  severity: 'info' | 'warn' | 'error';
}

/**
 * Result of a shadow-DOM traversal pass.
 *
 * - `elements` — flat list of every element discovered inside any reachable
 *   shadowRoot (does NOT include the starting host itself; light-DOM
 *   descendants of hosts are excluded — those belong to the AX/DOM pipeline).
 * - `warnings` — emitted once per overflow subtree (at most one
 *   `SHADOW_DOM_NOT_TRAVERSED` aggregate is sufficient for AC-02; we emit
 *   one per truncated subtree for diagnostic richness, capped via dedupe in
 *   T1C-009 if needed).
 */
export interface ShadowDomResult {
  elements: Element[];
  warnings: ShadowWarning[];
}

/**
 * Type guard — element-with-shadowRoot. `shadowRoot` is `ShadowRoot | null`
 * on `Element`; we read it through a narrowed view to keep strict typing.
 */
function getOpenShadowRoot(el: Element): ShadowRoot | null {
  // `shadowRoot` exposes ONLY open roots (closed roots are unreachable here
  // by browser design — we do not attempt any workaround).
  return el.shadowRoot ?? null;
}

/**
 * Resolve the first Element from a `Document | Element` input.
 * For `Document` we use `documentElement` as the seed host.
 */
function resolveRoot(input: Element | Document): Element | null {
  if (input instanceof Element) return input;
  return input.documentElement ?? null;
}

/**
 * Walk a single shadowRoot subtree, descending into nested shadow roots
 * until SHADOW_DOM_MAX_DEPTH is reached. Mutates `out.elements` and
 * `out.warnings` in place (kept small + non-recursive-in-return to stay
 * under the R10.2 50-line cap).
 *
 * @param shadowRoot — the open ShadowRoot to walk
 * @param depth      — the depth of `shadowRoot`'s host's shadow-root
 *                     ancestry. Root call passes 1 (the first attachShadow
 *                     under the supplied host). Children of this root are
 *                     at depth `depth`; nested shadow roots are at depth+1.
 */
function walkShadowRoot(
  shadowRoot: ShadowRoot,
  depth: number,
  out: ShadowDomResult,
): void {
  // Collect every element under this shadow root (BFS over Element nodes).
  const queue: Element[] = Array.from(shadowRoot.children);
  while (queue.length > 0) {
    const el = queue.shift() as Element;
    out.elements.push(el);

    // Descend through nested shadow roots if we have depth headroom.
    const nested = getOpenShadowRoot(el);
    if (nested) {
      const nextDepth = depth + 1;
      if (nextDepth <= SHADOW_DOM_MAX_DEPTH) {
        walkShadowRoot(nested, nextDepth, out);
      } else {
        // Halt: this subtree would push past SHADOW_DOM_MAX_DEPTH.
        out.warnings.push({
          code: 'SHADOW_DOM_NOT_TRAVERSED',
          message: `Shadow DOM traversal halted at depth ${SHADOW_DOM_MAX_DEPTH} (R-02 cap reached).`,
          severity: 'warn',
        });
      }
    }

    // Continue scanning light-DOM children inside this shadow root —
    // shadow roots can contain elements that themselves host more shadow
    // roots, so we must descend the light subtree of every shadow-scoped
    // element to discover them.
    for (const child of Array.from(el.children)) {
      queue.push(child);
    }
  }
}

/**
 * Public entry point — traverse all open shadow roots reachable from `root`
 * up to `maxDepth` levels deep. The `root` host element itself is NOT
 * collected (only shadow-scoped content is).
 *
 * @param root      — host element or document to traverse from
 * @param maxDepth  — pin to `SHADOW_DOM_MAX_DEPTH` (parameter accepted to
 *                    allow tests/spec scenarios to assert against the
 *                    public constant; values other than the constant are
 *                    not part of the production contract).
 */
export function traverseShadowDom(
  root: Element | Document,
  maxDepth: number = SHADOW_DOM_MAX_DEPTH,
): ShadowDomResult {
  const out: ShadowDomResult = { elements: [], warnings: [] };
  const host = resolveRoot(root);
  if (!host) return out;

  // The host itself may have a shadow root — descend if present. Otherwise
  // walk light-DOM descendants of the host looking for shadow hosts (a
  // single perception-time call MUST find every shadow root reachable from
  // the supplied subtree, not only the immediate host).
  const seedQueue: Array<{ el: Element; hostDepth: number }> = [
    { el: host, hostDepth: 0 },
  ];
  while (seedQueue.length > 0) {
    const { el, hostDepth } = seedQueue.shift() as { el: Element; hostDepth: number };
    const shadow = getOpenShadowRoot(el);
    if (shadow) {
      const childDepth = hostDepth + 1;
      if (childDepth <= maxDepth) {
        walkShadowRoot(shadow, childDepth, out);
      } else {
        out.warnings.push({
          code: 'SHADOW_DOM_NOT_TRAVERSED',
          message: `Shadow DOM traversal halted at depth ${maxDepth} (R-02 cap reached).`,
          severity: 'warn',
        });
      }
    }
    // Walk light-DOM children only at the seed level (before entering any
    // shadow boundary). Once inside a shadow root, walkShadowRoot owns
    // descent and re-enters this function's nested-shadow check itself.
    for (const child of Array.from(el.children)) {
      seedQueue.push({ el: child, hostDepth });
    }
  }

  return out;
}
