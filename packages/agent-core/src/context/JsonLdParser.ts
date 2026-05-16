/**
 * Phase 4b T4B-004 — JsonLdParser: deterministic JSON-LD extraction from
 * fetched HTML, used by downstream BusinessArchetypeInferrer (T4B-005) and
 * PageTypeInferrer (T4B-006).
 *
 * Canonical sources:
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.4
 *     (REQ-CONTEXT-FLOW-001 — JSON-LD via cheerio; ignore malformed silently)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-04 + R-06
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-004 (L109-115)
 *   docs/specs/mvp/phases/phase-4b-context-capture/impact.md §2 producers
 *     "Phase 4b inference primitives — JsonLdParser (NEW per T4B-004)"
 *
 * # Contract (AC-04)
 *
 * `parse(html)` returns `{ blocks, warnings }`:
 *
 *   - `blocks: JsonLdBlock[]` — every successfully parsed JSON-LD entry,
 *     each carrying `{ type, data, raw }`. `@graph` wrappers are flattened
 *     so each graph entry appears as its own block (downstream inferrers
 *     don't need to know about the @graph wire format). Array roots are
 *     similarly flattened.
 *   - `warnings: string[]` — non-throwing diagnostics:
 *       * `JSON_LD_PARSE_ERROR` — JSON.parse failed; block skipped
 *       * `JSON_LD_MISSING_TYPE` — block parsed but has no `@type` field
 *       * `JSON_LD_EMPTY_BLOCK` — `<script type="application/ld+json">`
 *         tag was empty / whitespace-only
 *
 *   When no `<script type="application/ld+json">` tags exist, returns
 *   `{ blocks: [], warnings: [] }` (no error — common for SPA shells).
 *
 * # Determinism (R25.1 item 10 — NO LLM judgment in MVP)
 *
 * This parser is pure cheerio + JSON.parse. It does NOT classify, score, or
 * interpret JSON-LD content beyond surfacing `@type`. Archetype / page-type
 * inference is the job of T4B-005 / T4B-006 — they decide how to weigh
 * `Product` vs `Service` vs `Organization` vs `WebPage` signals.
 *
 * # R25 compliance (hard constraint per CLAUDE.md §15 + AC-14)
 *
 * ZERO `playwright` / `@playwright/*` imports. The conformance test grep-
 * scans this file's source text in addition to the directory-wide AST scan
 * in `tests/constitution/R25.test.ts`.
 *
 * # Constitution compliance
 *
 * R10.1 file ≤ 250 LOC. R10.2 named exports only. R10.3 no `console.log`
 * (warnings surface to caller via return value; Pino logging happens at
 * the HtmlFetcher/ContextCaptureNode level, not here — keeps parser pure).
 * R2 no `any`. R9 zero vendor SDK imports outside `cheerio` (already
 * installed for Phase 4b per spec.md §Assumptions).
 */
import * as cheerio from 'cheerio';

/**
 * Output shape per JSON-LD entry. `data` is the parsed JSON object minus the
 * `@type` field (lifted to the typed `type` slot for ergonomic consumer
 * access). `raw` is the original parsed JSON in case a downstream consumer
 * needs `@context` or nested `@type` inspection.
 */
export interface JsonLdBlock {
  /** Schema.org `@type` value (e.g. "Product", "Organization"). */
  readonly type: string;
  /** Parsed JSON payload (all fields). Read-only by convention. */
  readonly data: Readonly<Record<string, unknown>>;
  /** Original raw JSON object, preserved for downstream `@context`/nested type access. */
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface JsonLdParseResult {
  readonly blocks: ReadonlyArray<JsonLdBlock>;
  readonly warnings: ReadonlyArray<string>;
}

/** Recognized JSON-LD warning codes (stable strings — used in conformance assertions). */
export const JSON_LD_WARNINGS = {
  PARSE_ERROR: 'JSON_LD_PARSE_ERROR',
  MISSING_TYPE: 'JSON_LD_MISSING_TYPE',
  EMPTY_BLOCK: 'JSON_LD_EMPTY_BLOCK',
} as const;

/**
 * Type-safe predicate: narrow `unknown` to a plain JSON object.
 * Used after JSON.parse to validate the root before extracting `@type`.
 */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract the schema.org `@type` from a parsed JSON-LD entry.
 * Tolerates both string (`"@type": "Product"`) and array forms
 * (`"@type": ["Product", "Thing"]` — picks first element).
 */
function extractType(obj: Record<string, unknown>): string | null {
  const t = obj['@type'];
  if (typeof t === 'string' && t.length > 0) return t;
  if (Array.isArray(t) && t.length > 0 && typeof t[0] === 'string') return t[0] as string;
  return null;
}

/**
 * Flatten one parsed JSON-LD root into one or more typed blocks.
 *
 * Cases handled:
 *   - plain object with `@type` → 1 block
 *   - array of objects → N blocks
 *   - object with `@graph: [...]` → entries from the graph (each must have `@type`)
 *   - object missing `@type` → warning + 0 blocks
 */
function flattenRoot(
  root: unknown,
  warnings: string[],
): JsonLdBlock[] {
  // Array root: flatten each entry independently.
  if (Array.isArray(root)) {
    return root.flatMap((entry) => flattenRoot(entry, warnings));
  }

  if (!isJsonObject(root)) {
    warnings.push(`${JSON_LD_WARNINGS.MISSING_TYPE}: root is not an object`);
    return [];
  }

  // @graph wrapper: surface each graph entry as its own block.
  const graph = root['@graph'];
  if (Array.isArray(graph)) {
    return graph.flatMap((entry) => flattenRoot(entry, warnings));
  }

  const type = extractType(root);
  if (type === null) {
    warnings.push(`${JSON_LD_WARNINGS.MISSING_TYPE}: JSON-LD block has no @type`);
    return [];
  }

  // Copy data without mutating the parsed source; lift @type to typed slot.
  const data: Record<string, unknown> = { ...root };
  delete data['@type'];

  return [{
    type,
    data: Object.freeze(data),
    raw: Object.freeze({ ...root }),
  }];
}

/**
 * Deterministic JSON-LD extractor.
 *
 * Lifecycle: stateless. A single shared instance is safe for concurrent use
 * (cheerio.load creates an isolated DOM per call); the `parseJsonLd` top-
 * level function is the recommended ergonomic entry point.
 */
export class JsonLdParser {
  /**
   * Parse all `<script type="application/ld+json">` blocks from `html`.
   *
   * Never throws. Malformed blocks emit warnings and are skipped; the
   * caller decides how to surface them (HtmlFetcher / ContextCaptureNode
   * route warnings to Pino + AuditLogger via the standard warning bus).
   */
  parse(html: string): JsonLdParseResult {
    const blocks: JsonLdBlock[] = [];
    const warnings: string[] = [];

    // cheerio.load is permissive — handles malformed HTML, missing <head>,
    // SPA shells with synthesized DOM. Returns an empty CheerioAPI on
    // empty input, which is fine: the find() below yields zero elements.
    const $ = cheerio.load(html);

    $('script[type="application/ld+json"]').each((_idx, el) => {
      // cheerio's .html() returns the raw text inside <script>; .text() also
      // works since script bodies are #cdata-section / text nodes only.
      const raw = $(el).contents().text();
      const trimmed = raw.trim();
      if (trimmed === '') {
        warnings.push(`${JSON_LD_WARNINGS.EMPTY_BLOCK}: <script type="application/ld+json"> is empty`);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`${JSON_LD_WARNINGS.PARSE_ERROR}: ${msg}`);
        return;
      }

      const flat = flattenRoot(parsed, warnings);
      for (const b of flat) blocks.push(b);
    });

    return { blocks, warnings };
  }
}

/** Top-level convenience — equivalent to `new JsonLdParser().parse(html)`. */
export function parseJsonLd(html: string): JsonLdParseResult {
  return new JsonLdParser().parse(html);
}
