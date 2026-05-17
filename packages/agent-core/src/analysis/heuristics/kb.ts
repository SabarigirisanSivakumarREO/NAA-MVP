/**
 * HeuristicKnowledgeBase — read-only in-memory container for HeuristicExtended.
 *
 * Source: docs/specs/mvp/phases/phase-6-heuristics/{spec,tasks}.md
 *         AC-03 + T102 — container indexes by id; exposes get / list /
 *         byBusinessType / byPageType. Container shape is independent of
 *         the two-stage filter business logic (T107).
 *
 * R20 contract surface — consumed by:
 *   - Phase 6 T106 FileSystemHeuristicLoader (constructs the KB)
 *   - Phase 6 T107 two-stage filter (operates on KB query results)
 *   - Phase 4b T4B-013 HeuristicLoader.loadForContext (filtering entrypoint)
 *
 * R6 IP-boundary discipline: this container is data-only — NO Pino logs
 * are emitted from here. Heuristic body / benchmark / provenance never
 * cross the API / dashboard / trace boundary; this file is a passive
 * holder, redaction lives at the seams (T-PHASE6-LOGGER + T106 loader).
 *
 * R10 compliance:
 *   - File ≤ 300 lines
 *   - Named exports only
 *   - Pure read-only API (no mutation methods)
 *   - Deterministic iteration order (sorted by id)
 */
import {
  matchesSelector,
  PRELIMINARY_BUSINESS_ARCHETYPES,
  PRELIMINARY_PAGE_TYPES,
  type HeuristicExtended,
} from './types.js';

type PreliminaryArchetype = (typeof PRELIMINARY_BUSINESS_ARCHETYPES)[number];
type PreliminaryPageType = (typeof PRELIMINARY_PAGE_TYPES)[number];

/**
 * Read-only container contract over a fixed set of heuristics.
 * Implemented by {@link HeuristicKnowledgeBase} (the in-memory default).
 */
export interface IHeuristicKnowledgeBase {
  /** Lookup by canonical heuristic id; undefined if absent. */
  get(id: string): HeuristicExtended | undefined;

  /** Full set in deterministic (id-sorted) order. */
  list(): ReadonlyArray<HeuristicExtended>;

  /**
   * Heuristics whose `archetype` selector matches the value OR whose
   * selector is undefined/empty (= applies-to-all per AC-11).
   */
  byBusinessType(archetype: PreliminaryArchetype): ReadonlyArray<HeuristicExtended>;

  /**
   * Heuristics whose `page_type` selector matches the value OR whose
   * selector is undefined/empty (= applies-to-all per AC-11).
   */
  byPageType(pageType: PreliminaryPageType): ReadonlyArray<HeuristicExtended>;
}

/**
 * In-memory HeuristicKnowledgeBase. Constructor indexes by id; iteration
 * order is id-sorted ascending for determinism (R10.4 — repeatable runs).
 *
 * Duplicate ids: last-one-wins on the id index, but `list()` returns the
 * unique set sorted by id. T106 loader is responsible for rejecting
 * duplicates BEFORE construction — KB does not enforce uniqueness because
 * the container is intentionally dumb.
 */
export class HeuristicKnowledgeBase implements IHeuristicKnowledgeBase {
  readonly #byId: ReadonlyMap<string, HeuristicExtended>;
  readonly #sorted: ReadonlyArray<HeuristicExtended>;

  constructor(heuristics: ReadonlyArray<HeuristicExtended>) {
    const index = new Map<string, HeuristicExtended>();
    for (const h of heuristics) {
      index.set(h.id, h);
    }
    this.#byId = index;
    this.#sorted = [...index.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  get(id: string): HeuristicExtended | undefined {
    return this.#byId.get(id);
  }

  list(): ReadonlyArray<HeuristicExtended> {
    return this.#sorted;
  }

  byBusinessType(archetype: PreliminaryArchetype): ReadonlyArray<HeuristicExtended> {
    return this.#sorted.filter((h) => matchesSelector(h.archetype, archetype));
  }

  byPageType(pageType: PreliminaryPageType): ReadonlyArray<HeuristicExtended> {
    return this.#sorted.filter((h) => matchesSelector(h.page_type, pageType));
  }
}

/**
 * Type alias for the canonical container shape — for callers that want
 * the interface name spelled the same as the task spec ("HeuristicKnowledgeBase
 * container contract"). The class above is the concrete impl; this alias
 * lets downstream code depend on the interface only when desired.
 */
export type { IHeuristicKnowledgeBase as HeuristicKnowledgeBaseContract };
