/**
 * HeuristicLoader — week-1 stub: load 3 synthetic skeleton fixtures.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-003
 *         (acceptance: returns 3 synthetic heuristics from
 *         `packages/agent-core/tests/fixtures/heuristics/skeleton-{1,2,3}.json`
 *         with body marked `"TEST FIXTURE — not a real heuristic"` AND
 *         embedding the literal sentinel `NEURAL_TEST_FIXTURE_BODY` per
 *         Phase 0b T0B-004 D1 BINDING precedent for cross-package R6
 *         conformance grep).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Reads all
 * `skeleton-*.json` files from the tests/fixtures/heuristics/ directory,
 * Zod-parses each via `HeuristicSchemaExtended.strict()`, returns sorted
 * by id (deterministic per stub conventions).
 *
 * Phase 6 T106 supersedes with real `FileSystemHeuristicLoader` reading
 * `heuristics-repo/` in week 4. R20 impact.md required at that transition
 * (HeuristicLoader interface + R6 channel 1 first runtime activation).
 *
 * Phase 4b T4B-013 EXTENSION (this file):
 *   `loadForContext(profile, opts?)` filters loadAll() output by
 *   ContextProfile.business.archetype + page.type +
 *   traffic.device_priority. Filter only — no weight modifiers (Phase 13b
 *   master track per R-13). Spec: phase-4b spec.md AC-13 + tasks.md
 *   T4B-013 + final-architecture/37 §37.5 REQ-CONTEXT-DOWNSTREAM-001.
 *
 *   Why a value-mapper (not enum reconciliation): the manifest selectors
 *   in types.ts use PRELIMINARY_* enums (case + naming differ from the
 *   LOCKED Phase 4b enums in types/context-profile.ts; e.g. lowercase
 *   `pdp` vs LOCKED `PDP`, `homepage` vs LOCKED `home`). Reconciling
 *   would touch 30 real heuristics-repo fixtures + 3 skeleton fixtures
 *   + R20 impact cycle — out of scope for T4B-013. The mapper bridges
 *   in-process; preliminary enums remain the authoritative manifest
 *   shape until Phase 13b reshape.
 *
 *   LOCKED-only enum values that have no preliminary counterpart
 *   (`service` archetype; `post_purchase` / `category` / `blog` /
 *   `about` page types) map to `null` and SKIP that dimension's filter
 *   ("applies to all" semantics — same as matchesSelector with an
 *   undefined selector). Documented per AC-13 reading.
 *
 * R6 IP-boundary discipline (CRITICAL):
 *   - Loader returns Heuristic objects whose `body` field MUST NEVER be
 *     serialized to logs / API responses / dashboards / LangSmith traces.
 *   - Phase 6 T-PHASE6-LOGGER (week 4) tightens Pino redaction config at
 *     the seam; until then, the orchestrator log line for `loadHeuristics`
 *     in audit.ts logs ONLY `count` + `heuristic_ids` — NEVER body.
 *   - Roadmap §6 special kill trigger: stub heuristic body content
 *     appearing in any log = STOP per R23.
 *
 * R3.3 stub conventions: throws on fixture load / Zod parse failure are
 * acceptable runtime errors with specific causes; the orchestrator catches
 * these in apps/cli/src/commands/audit.ts.
 *
 * Why `fs.readdir` (not `glob` dep): kept agent-core deps narrow per Phase
 * 0 baseline. Filtering for `skeleton-*.json` is trivial regex; adding a
 * `glob` dep mirrors apps/cli but here we don't need its full surface.
 *
 * R10 compliance: file ≤ 300 lines.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type {
  BusinessArchetype,
  ContextProfile,
  PageType,
} from '../../types/context-profile.js';
import {
  HeuristicSchemaExtended,
  matchesSelector,
  type HeuristicExtended,
} from './types.js';
import type {
  PRELIMINARY_BUSINESS_ARCHETYPES,
  PRELIMINARY_DEVICES,
  PRELIMINARY_PAGE_TYPES,
} from './types.js';

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'tests',
  'fixtures',
  'heuristics',
);

const SKELETON_FIXTURE_PATTERN = /^skeleton-\d+\.json$/;

// ---------------------------------------------------------------------------
// Phase 4b T4B-013 — value mappers (LOCKED → PRELIMINARY)
// ---------------------------------------------------------------------------

type PreliminaryArchetype = (typeof PRELIMINARY_BUSINESS_ARCHETYPES)[number];
type PreliminaryPageType = (typeof PRELIMINARY_PAGE_TYPES)[number];
type PreliminaryDevice = (typeof PRELIMINARY_DEVICES)[number];

/**
 * Maps the LOCKED 6-value BusinessArchetype enum to the preliminary
 * manifest-selector archetype enum. `null` means "no preliminary
 * counterpart in MVP" → caller skips archetype filter for that profile
 * (Phase 13b reconciles).
 */
const ARCHETYPE_MAP: Record<BusinessArchetype, PreliminaryArchetype | null> = {
  D2C: 'D2C',
  B2B: 'B2B',
  SaaS: 'SaaS',
  marketplace: 'marketplace',
  lead_gen: 'lead_gen',
  service: null, // no preliminary counterpart in MVP
};

/**
 * Maps the LOCKED 12-value PageType enum to the preliminary
 * manifest-selector page_type enum. `null` means "no preliminary
 * counterpart in MVP" → caller skips page filter for that profile
 * (Phase 13b reconciles).
 */
const PAGE_TYPE_MAP: Record<PageType, PreliminaryPageType | null> = {
  home: 'homepage',
  PLP: 'plp',
  PDP: 'pdp',
  cart: 'cart',
  checkout: 'checkout',
  pricing: 'pricing',
  comparison: 'comparison',
  landing: 'landing',
  post_purchase: null,
  category: null,
  blog: null,
  about: null,
};

/** Devices map 1:1 — LOCKED `mobile|desktop|balanced` ⊂ preliminary. */
const DEVICE_MAP: Record<
  ContextProfile['traffic']['device_priority']['value'],
  PreliminaryDevice
> = {
  mobile: 'mobile',
  desktop: 'desktop',
  balanced: 'balanced',
};

// ---------------------------------------------------------------------------
// HeuristicLoader
// ---------------------------------------------------------------------------

/**
 * Optional input for `loadForContext`. The `heuristics` field is a TEST
 * SEAM (R3 conformance test isolation) — when supplied, the loader skips
 * the file-system `loadAll()` call. Not a public API contract for runtime
 * callers; production callers always omit `opts`.
 */
export interface LoadForContextOptions {
  heuristics?: HeuristicExtended[];
}

export class HeuristicLoader {
  async loadAll(): Promise<HeuristicExtended[]> {
    const entries = await readdir(FIXTURE_DIR);
    const fixtureFiles = entries.filter((name) => SKELETON_FIXTURE_PATTERN.test(name)).sort();

    const heuristics = await Promise.all(
      fixtureFiles.map(async (file) => {
        const raw = JSON.parse(await readFile(join(FIXTURE_DIR, file), 'utf8')) as unknown;
        return HeuristicSchemaExtended.parse(raw);
      }),
    );

    return heuristics.sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Phase 4b T4B-013 — filter the heuristic library by ContextProfile.
   *
   * Reads ONLY three fields off the profile per spec.md §"Key Entities"
   * (HeuristicLoader extended): `business.archetype`, `page.type`,
   * `traffic.device_priority`. NO weight modifiers (filter only — Phase
   * 13b master track adds weights per R-13).
   *
   * Returns heuristics whose manifest selectors match all three mapped
   * dimensions, treating undefined / empty selectors as "applies to all"
   * (delegated to `matchesSelector` in types.ts).
   *
   * @param profile  ContextProfile to read filter inputs from.
   * @param opts     Test seam — see `LoadForContextOptions`.
   */
  async loadForContext(
    profile: ContextProfile,
    opts?: LoadForContextOptions,
  ): Promise<HeuristicExtended[]> {
    const all = opts?.heuristics ?? (await this.loadAll());

    const archetypeValue = profile.business.archetype.value;
    const pageTypeValue = profile.page.type.value;
    const deviceValue = profile.traffic.device_priority.value;

    const mappedArchetype = ARCHETYPE_MAP[archetypeValue];
    const mappedPageType = PAGE_TYPE_MAP[pageTypeValue];
    const mappedDevice = DEVICE_MAP[deviceValue];

    return all.filter((h) => {
      // null mapped value → skip this dimension's filter (= "applies to all")
      if (mappedArchetype !== null && !matchesSelector(h.archetype, mappedArchetype)) {
        return false;
      }
      if (mappedPageType !== null && !matchesSelector(h.page_type, mappedPageType)) {
        return false;
      }
      if (!matchesSelector(h.device, mappedDevice)) {
        return false;
      }
      return true;
    });
  }
}
