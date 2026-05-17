/**
 * HeuristicLoader — file-system loader for the heuristic KB.
 *
 * Provenance:
 *   - T-SKELETON-003 (week 1): walking-skeleton stub loading
 *     `skeleton-*.json` fixtures with NEURAL_TEST_FIXTURE_BODY sentinel.
 *     Zero-arg `new HeuristicLoader()` preserves this legacy mode.
 *   - T4B-013 (Phase 4b): `loadForContext(profile, opts?)` filters by
 *     business.archetype + page.type + traffic.device_priority via a
 *     LOCKED → PRELIMINARY value-mapper (no enum reconciliation; Phase
 *     13b reshape pending). LOCKED-only values (`service`, `post_purchase`,
 *     `category`, `blog`, `about`) map to `null` → skip that dimension's
 *     filter ("applies to all"). Filter only — no weight modifiers (R-13).
 *   - T106 (Phase 6, this revision): extended constructor accepts
 *     `{ heuristicsDir, decryptor, logger }`; `loadAll()` reads ALL
 *     `*.json` files from the configured directory (single object or
 *     array per file), decrypts via DecryptionAdapter, Zod-validates,
 *     and emits Pino logs with `heuristic_loader_session_id` / `kb_size`
 *     correlation only — NEVER heuristic body / benchmark / provenance
 *     content (R6 IP boundary; T-PHASE6-LOGGER redact paths enforce at
 *     the seam). Exports `IHeuristicLoader` interface (R9) +
 *     `FileSystemHeuristicLoader` class + `HeuristicLoader` alias.
 *
 * R10 compliance: file < 300 lines.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { Logger } from 'pino';

import type {
  BusinessArchetype,
  ContextProfile,
  PageType,
} from '../../types/context-profile.js';
import { createLogger } from '../../observability/logger.js';
import {
  type DecryptionAdapter,
  PlaintextDecryptor,
} from '../../adapters/DecryptionAdapter.js';
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

// Phase 4b T4B-013 — value mappers (LOCKED → PRELIMINARY). `null` means
// "no preliminary counterpart in MVP" → caller skips that dimension's
// filter ("applies to all" semantics). Phase 13b reconciles enums.

type PreliminaryArchetype = (typeof PRELIMINARY_BUSINESS_ARCHETYPES)[number];
type PreliminaryPageType = (typeof PRELIMINARY_PAGE_TYPES)[number];
type PreliminaryDevice = (typeof PRELIMINARY_DEVICES)[number];

const ARCHETYPE_MAP: Record<BusinessArchetype, PreliminaryArchetype | null> = {
  D2C: 'D2C',
  B2B: 'B2B',
  SaaS: 'SaaS',
  marketplace: 'marketplace',
  lead_gen: 'lead_gen',
  service: null, // no preliminary counterpart in MVP
};

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

/**
 * Phase 6 T106 — extended constructor config. All fields optional so the
 * legacy zero-arg signature continues to work (walking-skeleton compat:
 * audit.ts `new HeuristicLoader()` defaults to FIXTURE_DIR + skeleton-only
 * load). When `heuristicsDir` is explicitly supplied, the loader reads
 * ALL `*.json` files (no skeleton-* pattern restriction).
 */
export interface HeuristicLoaderConfig {
  heuristicsDir?: string;
  decryptor?: DecryptionAdapter;
  logger?: Logger;
}

/** R9 interface boundary for the loader (T106). */
export interface IHeuristicLoader {
  loadAll(): Promise<HeuristicExtended[]>;
  loadForContext(
    profile: ContextProfile,
    opts?: LoadForContextOptions,
  ): Promise<HeuristicExtended[]>;
}

/**
 * Typed load error — never carries heuristic content in `.message`. Path
 * + error class only (R6.1/R6.4 IP boundary).
 */
export class HeuristicLoadError extends Error {
  readonly filePath: string;
  readonly errorClass: string;
  constructor(filePath: string, errorClass: string, cause?: unknown) {
    super(`HeuristicLoadError: ${errorClass} at ${filePath}`, cause !== undefined ? { cause } : undefined);
    this.filePath = filePath;
    this.errorClass = errorClass;
    this.name = 'HeuristicLoadError';
  }
}

export class FileSystemHeuristicLoader implements IHeuristicLoader {
  private readonly heuristicsDir: string;
  private readonly decryptor: DecryptionAdapter;
  private readonly logger: Logger;
  private readonly restrictToSkeleton: boolean;

  constructor(config: HeuristicLoaderConfig = {}) {
    this.heuristicsDir = config.heuristicsDir ?? FIXTURE_DIR;
    this.decryptor = config.decryptor ?? new PlaintextDecryptor();
    this.logger = config.logger ?? createLogger('heuristic-loader');
    // Legacy mode: zero-arg / default FIXTURE_DIR restricts to skeleton-*.json
    // (preserves walking-skeleton T-SKELETON-003 acceptance test).
    this.restrictToSkeleton = config.heuristicsDir === undefined;
  }

  async loadAll(): Promise<HeuristicExtended[]> {
    const heuristic_loader_session_id = randomUUID();
    this.logger.info(
      { heuristic_loader_session_id, heuristicsDir: this.heuristicsDir },
      'heuristic loader started',
    );

    const dirEntries = await readdir(this.heuristicsDir, { withFileTypes: true });
    const files = dirEntries
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name)
      .filter((name) => (this.restrictToSkeleton ? SKELETON_FIXTURE_PATTERN.test(name) : true))
      .sort();

    const admitted: HeuristicExtended[] = [];
    let rejected_count = 0;

    for (const file of files) {
      const path = join(this.heuristicsDir, file);
      let parsed: unknown;
      try {
        const raw = await readFile(path, 'utf8');
        const decrypted = await this.decryptor.decrypt(raw);
        parsed = JSON.parse(decrypted) as unknown;
      } catch (e) {
        const error_class = e instanceof Error ? e.constructor.name : 'UnknownError';
        this.logger.warn(
          {
            heuristic_loader_session_id,
            kb_size_so_far: admitted.length,
            error_class,
            rejected_id: path,
          },
          'heuristic rejected',
        );
        throw new HeuristicLoadError(path, error_class, e);
      }

      const entries = Array.isArray(parsed) ? (parsed as unknown[]) : [parsed];
      for (const entry of entries) {
        // Pre-extract id (string only) for rejection log without exposing body.
        const candidateId =
          entry && typeof entry === 'object' && 'id' in entry && typeof (entry as { id: unknown }).id === 'string'
            ? ((entry as { id: string }).id)
            : path;
        try {
          admitted.push(HeuristicSchemaExtended.parse(entry));
        } catch (e) {
          rejected_count += 1;
          const error_class = e instanceof Error ? e.constructor.name : 'UnknownError';
          this.logger.warn(
            {
              heuristic_loader_session_id,
              kb_size_so_far: admitted.length,
              error_class,
              rejected_id: candidateId,
            },
            'heuristic rejected',
          );
          throw new HeuristicLoadError(path, error_class, e);
        }
      }
    }

    admitted.sort((a, b) => a.id.localeCompare(b.id));
    this.logger.info(
      { heuristic_loader_session_id, kb_size: admitted.length, rejected_count },
      'heuristic loader complete',
    );
    return admitted;
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

/**
 * Back-compat alias — pre-T106 callers (audit.ts, walking-skeleton acceptance,
 * Phase 4b conformance) import `HeuristicLoader` from this module. Keeping the
 * historical name resolving to the same impl preserves their `new HeuristicLoader()`
 * + `new HeuristicLoader({...})` call sites without an R20 contract change.
 */
export { FileSystemHeuristicLoader as HeuristicLoader };
