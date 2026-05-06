/**
 * Unit tests for BrowserManager — T-SKELETON-002 acceptance.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.4 §6 T-SKELETON-002
 *         (acceptance: returns hardcoded PageStateModel JSON validating
 *         against PageStateModelSchema).
 *
 * Coverage:
 *   - Positive: capture() loads peregrine-pdp.json fixture + Zod-parses +
 *     returns parsed PageStateModel with expected url / title / ax-node
 *     count / top30 length.
 *   - Phase 1 invariant (T014 docs): `_extensions` field is ABSENT in the
 *     returned PageStateModel (Phase 1 producer code must NOT populate;
 *     Phase 7+ namespaces deepPerceive under _extensions).
 *   - Idempotence: two consecutive captures return structurally identical
 *     PageStateModels (deterministic stub per roadmap §3 conventions).
 *   - URL-quirk acknowledgment: capture(otherUrl) still returns the
 *     Peregrine fixture (week-1 known quirk; Phase 1 T006-T013 fixes).
 */
import { describe, it, expect } from 'vitest';
import { BrowserManager } from '../../../src/browser-runtime/BrowserManager.js';
import { PageStateModelSchema } from '../../../src/perception/types.js';

const PEREGRINE_URL =
  'https://www.peregrineclothing.co.uk/collections/t-shirts/products/heavyweight-t-shirt?colour=Navy';
const PEREGRINE_TITLE = 'Heavyweight T-Shirt – Navy | Peregrine Clothing';

describe('BrowserManager (T-SKELETON-002 stub)', () => {
  it('capture() returns Peregrine PDP PageStateModel matching fixture metadata', async () => {
    const manager = new BrowserManager();
    const result = await manager.capture(PEREGRINE_URL);

    expect(result.metadata.url).toBe(PEREGRINE_URL);
    expect(result.metadata.title).toBe(PEREGRINE_TITLE);
    expect(result.metadata.statusCode).toBe(200);
  });

  it('capture() returns PageStateModel that re-validates against PageStateModelSchema', async () => {
    const manager = new BrowserManager();
    const result = await manager.capture(PEREGRINE_URL);

    // re-parse: BrowserManager already parses internally; this asserts
    // the returned shape stays valid through any consumer round-trip.
    expect(() => PageStateModelSchema.parse(result)).not.toThrow();
  });

  it('capture() returns ax-tree with realistic PDP node count + WebArea root', async () => {
    const manager = new BrowserManager();
    const result = await manager.capture(PEREGRINE_URL);

    expect(result.accessibilityTree.root.role).toBe('WebArea');
    expect(result.accessibilityTree.totalNodes).toBeGreaterThanOrEqual(5);
  });

  it('capture() returns filteredDOM.top30 with 5-30 elements representative of a PDP', async () => {
    const manager = new BrowserManager();
    const result = await manager.capture(PEREGRINE_URL);

    expect(result.filteredDOM.top30.length).toBeGreaterThanOrEqual(5);
    expect(result.filteredDOM.top30.length).toBeLessThanOrEqual(30);
    // Every element must have a positive score in (0, 1] (R4.4 multiplicative-decay invariant).
    for (const element of result.filteredDOM.top30) {
      expect(element.score).toBeGreaterThan(0);
      expect(element.score).toBeLessThanOrEqual(1);
    }
  });

  it('capture() includes typical PDP CTA in interactiveGraph.clickable', async () => {
    const manager = new BrowserManager();
    const result = await manager.capture(PEREGRINE_URL);

    // Every PDP must have at least one clickable element (the add-to-cart CTA).
    expect(result.interactiveGraph.clickable.length).toBeGreaterThan(0);
  });

  it('Phase 1 invariant — capture() returns PageStateModel without _extensions populated', async () => {
    const manager = new BrowserManager();
    const result = await manager.capture(PEREGRINE_URL);

    // T014 invariant: Phase 1 producer code MUST NOT populate _extensions.
    // Phase 7+ namespaces deepPerceive output under _extensions.deepPerceive.
    expect(result._extensions).toBeUndefined();
  });

  it('capture() is deterministic — two consecutive calls return structurally identical PageStateModels', async () => {
    const manager = new BrowserManager();
    const a = await manager.capture(PEREGRINE_URL);
    const b = await manager.capture(PEREGRINE_URL);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('week-1 known quirk — capture() returns Peregrine fixture even for non-Peregrine URL input', async () => {
    const manager = new BrowserManager();
    const result = await manager.capture('https://example.com');

    // T-SKELETON-002 acceptance: hardcoded fixture regardless of input URL.
    // Phase 1 T006-T013 (week 2) introduces real per-URL capture.
    expect(result.metadata.url).toBe(PEREGRINE_URL);
    expect(result.metadata.title).toBe(PEREGRINE_TITLE);
  });
});
