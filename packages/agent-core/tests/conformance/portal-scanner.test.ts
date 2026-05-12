/**
 * AC-03 — PortalScanner conformance (REQ-BROWSE-PERCEPT-007).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-03 + R-03
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-003
 *
 * R-03: Detect React Portals + Vue Teleport + Angular CDK Overlay by
 *   scanning <body> direct children for elements not reachable from a
 *   logical parent tree. Mark `is_portal: true`.
 *
 * R3.1 TDD (Wave 0 RED): import fails with "module not found" until
 *   T1C-003 lands.
 *
 * Anchor: @AC-03 — scanPortals(document) → PortalCandidate[];
 *   each candidate has { element, is_portal: true, host_root_marker }.
 */
import { describe, expect, it } from 'vitest';

import { scanPortals } from '../../src/perception/PortalScanner.js';

interface PortalCandidate {
  element: Element;
  is_portal: true;
  host_root_marker: string | null;
}

describe('PortalScanner — AC-03 conformance (Wave 0 RED)', () => {
  /**
   * @AC-03 — React Portal-style modal mounted as direct <body> child →
   * detected with is_portal=true.
   */
  it('AC-03: React Portal-style body-direct modal detected as portal', () => {
    document.body.innerHTML = '';
    const appRoot = document.createElement('div');
    appRoot.id = 'app-root';
    appRoot.innerHTML = '<main><h1>App</h1></main>';
    document.body.appendChild(appRoot);

    const portalRoot = document.createElement('div');
    portalRoot.setAttribute('data-portal', 'modal');
    portalRoot.innerHTML = '<div role="dialog">Hello</div>';
    document.body.appendChild(portalRoot);

    const result: PortalCandidate[] = scanPortals(document);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((p) => p.is_portal === true)).toBe(true);
  });

  /**
   * @AC-03 — page with no portal-style siblings returns [].
   */
  it('AC-03: page with single logical root returns no portals', () => {
    document.body.innerHTML = '';
    const appRoot = document.createElement('div');
    appRoot.id = 'app-root';
    appRoot.innerHTML = '<main><h1>App</h1><p>body</p></main>';
    document.body.appendChild(appRoot);

    const result: PortalCandidate[] = scanPortals(document);
    expect(result).toEqual([]);
  });

  /**
   * @AC-03 — PortalCandidate exposes is_portal=true literal + host_root_marker.
   * host_root_marker captures the marker class / data-attribute (or null) so
   * downstream FusedElement can attribute the portal back to its origin.
   */
  it('AC-03: PortalCandidate contract — { element, is_portal: true, host_root_marker }', () => {
    document.body.innerHTML = '';
    const appRoot = document.createElement('div');
    appRoot.id = 'root';
    document.body.appendChild(appRoot);
    const portalRoot = document.createElement('div');
    portalRoot.className = 'cdk-overlay-container';
    document.body.appendChild(portalRoot);

    const result: PortalCandidate[] = scanPortals(document);
    const candidate = result[0];
    expect(candidate).toBeDefined();
    expect(candidate).toHaveProperty('element');
    expect(candidate).toHaveProperty('is_portal', true);
    expect(candidate).toHaveProperty('host_root_marker');
  });
});
