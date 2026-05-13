/**
 * T048 page_analyze v2.3 — Phase 2 Wave 14 page-introspection tool factory.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T048 (line 285-307)
 *   docs/specs/final-architecture/07-analyze-mode.md §7.9 + §7.9.1 (CANONICAL
 *     VERBATIM AUTHORITY for the AnalyzePerception shape)
 *   docs/specs/mvp/phases/phase-2-tools/impact.md §AnalyzePerception
 *     (F-G1 separate schema; F-S4 namespace contract; F-S13 IframePurpose
 *     closed enum)
 *   REQ-TOOL-PA-001 (single page.evaluate invariant) +
 *   REQ-ANALYZE-PERCEPTION-V23-001 (v2.3 enrichment categories)
 *
 * Factory pattern (locked Wave 4+): createPageAnalyzeTool({ session }) closes
 * over BrowserSession + returns MCPToolDefinition. Handler runs EXACTLY ONE
 * session.page.evaluate call producing the 9 baseline + 14 v2.3 enrichment
 * sections, then Zod-parses against AnalyzePerceptionSchema (.strict()) before
 * return. Settle precondition (F-G2) is the CALLER's responsibility; this
 * handler does NOT invoke waitForSettle.
 *
 * Module split (R10.1 ≤300 LOC): the in-page extraction script is a sibling
 * `./pageAnalyze.script.ts` module exporting `PAGE_ANALYZE_SCRIPT: string`.
 * The script file is a STRING constant — no evaluate invocation in its source
 * code (just inside the string). This factory file fires the evaluate exactly
 * once (line below). Mirror of the Wave 9b BrowserManager → BrowserPageWrapper
 * split precedent.
 *
 * R23 KILL CRITERIA (verbatim per tasks.md lines 300-305):
 *   1. Two or more page.evaluate calls in the handler → REQ-TOOL-PA-001
 *      violation. This file emits EXACTLY 1 evaluate() inside the handler.
 *   2. AnalyzePerception schema deviates from §7.9 + §7.9.1 → R11.1.
 *      Schema is in ../../analysis/types.ts (shipped); this file produces a
 *      value that .strict()-parses against it without modification.
 *   3. _extensions populated on AnalyzePerception → Phase 1c §11 violation.
 *      The returned object literal OMITS _extensions entirely (NOT undefined
 *      explicit, NOT {} — absent).
 *   4. iframes[].purposeGuess outside Phase 1c IframePurpose 9-value enum →
 *      F-S13. The in-page classifier emits ONLY enum members; defense in
 *      depth via the schema parse.
 *   5. wall-clock > 5s on amazon.in homepage → NF-Phase2-03. Single evaluate
 *      + lean in-page script (no network calls, bounded paragraph
 *      collection); conformance test pins via real-network amazon.in run.
 *
 * R9 boundary: no `playwright` import (single-importer rule). R10.1: ≤300 LOC
 * (this file ~80 LOC after script split). R13: no `any`.
 */
import { z } from 'zod';

import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import {
  AnalyzePerceptionSchema,
  type AnalyzePerception,
} from '../../analysis/index.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';
import { PAGE_ANALYZE_SCRIPT } from './pageAnalyze.script.js';

/** Strict-empty input — tool operates on the current active page. */
export const PageAnalyzeInputSchema = z.object({}).strict();
export type PageAnalyzeInput = z.infer<typeof PageAnalyzeInputSchema>;

export interface PageAnalyzeDeps {
  readonly session: BrowserSession;
}

export function createPageAnalyzeTool(
  deps: PageAnalyzeDeps,
): MCPToolDefinition<PageAnalyzeInput, AnalyzePerception> {
  return {
    name: 'page_analyze', // EXACT v3.1 (R4.5) — rename = R23 kill trigger
    description:
      'Extract full v2.3 AnalyzePerception (9 baseline + 14 enrichment sections) from the active page via a SINGLE page.evaluate call. Caller is responsible for waitForSettle precondition (F-G2). Result Zod-parses against AnalyzePerceptionSchema (.strict()).',
    inputSchema: PageAnalyzeInputSchema,
    outputSchema: AnalyzePerceptionSchema,
    safetyClass: 'safe',
    handler: async (_input, ctx: ToolContext): Promise<AnalyzePerception> => {
      // REQ-TOOL-PA-001: EXACTLY ONE page.evaluate call. The handler MUST NOT
      // call waitForSettle (F-G2 caller responsibility) or fire a second
      // evaluate for any reason.
      const raw = await deps.session.page.evaluate<unknown>(PAGE_ANALYZE_SCRIPT);
      // Schema parse is mandatory before return — never emit raw JSON. The
      // .strict() parse catches F-S4 (_extensions accidentally populated)
      // AND F-S13 (iframes[].purposeGuess outside enum) AND every other
      // §7.9 shape constraint.
      const parsed = AnalyzePerceptionSchema.parse(raw);
      ctx.logger.info(
        {
          url: parsed.metadata.url,
          ctaCount: parsed.ctas.length,
          formCount: parsed.forms.length,
          iframeCount: parsed.iframes.length,
          inferred_page_type: parsed.inferredPageType.primary,
        },
        'mcp.tool.page_analyze.done',
      );
      return parsed;
    },
  };
}
