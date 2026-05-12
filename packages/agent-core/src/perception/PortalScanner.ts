/**
 * PortalScanner — Phase 1c T1C-003 (AC-03, R-03, REQ-BROWSE-PERCEPT-007).
 *
 * Source: phase-1c spec.md AC-03 + R-03; tasks.md T1C-003.
 *
 * Framework-agnostic portal detection. Scans <body> direct children for
 * elements NOT reachable from a logical app-root tree. Catches:
 *   - React Portals (`createPortal()` mounts to body or custom host)
 *   - Vue Teleport (`<Teleport to="body">`)
 *   - Angular CDK Overlay (`<div class="cdk-overlay-container">`)
 *   - Plain JS `document.body.appendChild(modal)`
 *
 * Mechanism: identify app-root nodes via a default selector union
 *   ('#root', '#app', '#__next', '[data-reactroot]'); any <body> direct
 *   child that is NEITHER an app root NOR contained by one is a portal
 *   candidate. Marker (data-portal / class containing 'portal' / 'overlay'
 *   / 'teleport') captured as `host_root_marker` for FusedElement attribution.
 *
 * Pure + synchronous. R10: ≤300 LOC, functions ≤50 LOC, no `any`. R24:
 * capture-only — does not mutate the DOM.
 *
 * NOTE: agent-core tsconfig declares `lib: ["ES2022"]` (no DOM). We declare
 * a minimal structural surface here so the file typechecks standalone while
 * remaining fully compatible with browser `Element` / `Document` at runtime
 * (jsdom in tests; real DOM under Playwright in prod). Same pattern as
 * StickyElementDetector (Phase 1b).
 */

interface ElementLike {
  readonly tagName: string;
  readonly children: ArrayLike<ElementLike>;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  contains(other: ElementLike): boolean;
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
}

interface DocumentLike {
  readonly body: ElementLike | null;
}

/** Detected portal-style root mounted as a direct <body> child. */
export interface PortalCandidate {
  /** The DOM element itself (direct <body> child). */
  readonly element: ElementLike;
  /** Literal `true` — discriminator for downstream FusedElement marking. */
  readonly is_portal: true;
  /**
   * Marker class / data-attribute hint that identifies the portal host
   * (e.g. `data-portal`, `cdk-overlay-container`, `class*=portal`).
   * `null` if no convention-matching attribute is present.
   */
  readonly host_root_marker: string | null;
}

/**
 * Default app-root selector union — covers React / Vue / Next / legacy React
 * plus common variants (`#app-root`, `#__nuxt`, `#__layout`). Caller can
 * override for non-standard mount points.
 */
const DEFAULT_APP_ROOT_SELECTOR =
  '#root, #app, #app-root, #__next, #__nuxt, #__layout, [data-reactroot]';

/**
 * Convention-matching markers on a portal host. Order matters — first
 * match wins so explicit `data-portal` beats heuristic class sniffing.
 */
function detectHostMarker(el: ElementLike): string | null {
  if (el.hasAttribute('data-portal')) {
    const val = el.getAttribute('data-portal');
    return val !== null && val.length > 0 ? `data-portal="${val}"` : 'data-portal';
  }
  if (el.hasAttribute('data-teleport')) return 'data-teleport';
  const cls = el.getAttribute('class') ?? '';
  if (cls.length > 0) {
    const lc = cls.toLowerCase();
    if (lc.includes('cdk-overlay-container')) return 'cdk-overlay-container';
    if (lc.includes('portal')) return `class*="portal" (${cls})`;
    if (lc.includes('teleport')) return `class*="teleport" (${cls})`;
    if (lc.includes('overlay')) return `class*="overlay" (${cls})`;
    if (lc.includes('modal')) return `class*="modal" (${cls})`;
  }
  const role = el.getAttribute('role');
  if (role === 'dialog' || role === 'alertdialog') return `role="${role}"`;
  return null;
}

/**
 * Resolve app-root nodes inside <body> from a CSS selector union. Defensive
 * against malformed selectors — returns `[]` rather than throwing so a
 * broken caller override does not blow up perception extraction.
 */
function resolveAppRoots(body: ElementLike, selector: string): ElementLike[] {
  try {
    const matches = body.querySelectorAll(selector);
    const out: ElementLike[] = [];
    for (let i = 0; i < matches.length; i += 1) {
      const node = matches[i];
      if (node) out.push(node);
    }
    return out;
  } catch {
    return [];
  }
}

/** Skip non-portal scaffolding mounted as <body> direct children. */
function isInertScaffolding(tag: string): boolean {
  return tag === 'script' || tag === 'noscript' || tag === 'style' || tag === 'link';
}

/**
 * Scan a document for portal-style elements mounted as direct <body>
 * children outside the logical app-root tree.
 *
 * @param doc - Document to scan (jsdom-friendly; works with real `Document`).
 * @param appRootSelector - CSS selector union identifying the app root(s).
 *   Defaults to the React / Vue / Next / legacy React heuristic. Caller may
 *   override for non-standard mount points.
 * @returns Array of portal candidates — empty when no body-direct children
 *   exist outside the app-root tree.
 */
export function scanPortals(
  doc: DocumentLike,
  appRootSelector: string = DEFAULT_APP_ROOT_SELECTOR,
): PortalCandidate[] {
  const body = doc.body;
  if (!body) return [];

  const appRoots = resolveAppRoots(body, appRootSelector);
  const candidates: PortalCandidate[] = [];

  for (let i = 0; i < body.children.length; i += 1) {
    const child = body.children[i];
    if (!child) continue;
    if (isInertScaffolding(child.tagName.toLowerCase())) continue;

    // A child is a portal candidate iff it is neither an app root nor
    // contained by one — i.e. not reachable via the logical parent tree.
    if (appRoots.includes(child)) continue;
    if (appRoots.some((root) => root.contains(child))) continue;

    candidates.push({
      element: child,
      is_portal: true,
      host_root_marker: detectHostMarker(child),
    });
  }

  return candidates;
}
