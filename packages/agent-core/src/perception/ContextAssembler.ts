/**
 * ContextAssembler — Phase 1 T013 (AC-08, REQ-BROWSE-PERCEPT-001).
 *
 * Source: spec.md AC-08 + R-10 + Key Entities §"Oversize-handling algorithm";
 *         plan.md §"Per-extractor design" item 6; tasks.md T013.
 *
 * Orchestrates 6 perception components + the BrowserEngine into a single
 * PageStateModel capture. Owns session lifecycle — closes BrowserSession in
 * `finally` (NF-Phase1-05; no zombie Chromium).
 *
 * Pipeline: newSession → applyStealthConfig → mutationMonitor.observe (pre-nav)
 *   → page.goto(domcontentloaded) → mutationMonitor.observe (post-nav settle)
 *   → accessibilityExtractor.extract → hardFilter.apply → softFilter.apply
 *   → screenshotExtractor.capture (best-effort) → assemble → fitToTokenBudget.
 *
 * Deterministic shrink ladder (NF-Phase1-01 v0.4 — budget 20,000 tokens):
 * if tokens >= PAGE_STATE_MODEL_TOKEN_BUDGET, apply in order and re-tokenize
 * after each: (1) AX depth 10 → 6, (2) FilteredDOM top-30 → top-20,
 * (3) drop `visual`, (4) accept with diagnostics.errors:
 * ['oversized-after-shrink']. Same input → same output. NEVER throws on oversize.
 *
 * R10: file ≤ 250 lines target (R10.1 cap 300); functions ≤ 50 lines (R10.2);
 * named exports (R10.3, R4.5); Pino with session_id + page_url (R10.6); no `any` (R13).
 * R20: Phase 1 never populates `_extensions` (Phase 7+ scope per T013 kill criterion).
 */
import type { Logger } from 'pino';
import { get_encoding } from 'tiktoken';
import { BrowserManager } from '../browser-runtime/BrowserManager.js';
import { applyStealthConfig, type StealthOptions } from '../browser-runtime/StealthConfig.js';
import { createLogger } from '../observability/logger.js';
import type { BrowserSession, SessionOpts } from '../adapters/BrowserEngine.js';
import { accessibilityExtractor } from './AccessibilityExtractor.js';
import { hardFilter } from './HardFilter.js';
import { softFilter } from './SoftFilter.js';
import { mutationMonitor } from './MutationMonitor.js';
import { screenshotExtractor } from './ScreenshotExtractor.js';
import {
  SUBSTRATE_EXTRACTION_SCRIPT,
  emptySubstrate,
  type SubstrateResult,
} from './extensions/SubstrateExtension.script.js';
import {
  MIN_AX_TREE_DEPTH,
  PAGE_STATE_MODEL_TOKEN_BUDGET,
  PageStateModelSchema,
  type AccessibilityNode,
  type AccessibilityTree,
  type Diagnostics,
  type FilteredDOM,
  type Metadata,
  type PageStateModel,
  type Visual,
} from './types.js';

const log = createLogger('context-assembler');

const NAV_TIMEOUT_MS = 10_000;
const SETTLE_TIMEOUT_MS = 5_000;
const SHRUNK_TOP_N = 20;

/** Caller-facing capture options. Reserved seam for Phase 5+ overrides. */
export interface CaptureOpts {
  session?: SessionOpts;
  stealth?: StealthOptions;
}

/**
 * Tokenize the JSON-serialized model with cl100k_base. Encoder is acquired
 * + freed per call: tiktoken's wasm-backed encoder leaks bytes otherwise.
 */
function tokenizeJson(model: PageStateModel): number {
  const encoder = get_encoding('cl100k_base');
  try {
    return encoder.encode(JSON.stringify(model)).length;
  } finally {
    encoder.free();
  }
}

/** Prune AccessibilityNode children at depth > maxDepth. Pure; returns NEW tree. */
function pruneByDepth(node: AccessibilityNode, depth: number, maxDepth: number): AccessibilityNode {
  const next: AccessibilityNode = { role: node.role };
  if (node.name !== undefined) next.name = node.name;
  if (node.value !== undefined) next.value = node.value;
  if (node.description !== undefined) next.description = node.description;
  if (node.level !== undefined) next.level = node.level;
  if (node.expanded !== undefined) next.expanded = node.expanded;
  if (node.required !== undefined) next.required = node.required;
  if (node.selected !== undefined) next.selected = node.selected;
  if (node.hidden !== undefined) next.hidden = node.hidden;
  if (node.disabled !== undefined) next.disabled = node.disabled;
  if (node.focused !== undefined) next.focused = node.focused;
  if (node.boundingBox !== undefined) next.boundingBox = { ...node.boundingBox };
  if (depth < maxDepth && node.children !== undefined) {
    next.children = node.children.map((child) => pruneByDepth(child, depth + 1, maxDepth));
  }
  return next;
}

const countAxNodes = (node: AccessibilityNode): number =>
  1 + (node.children?.reduce((acc, c) => acc + countAxNodes(c), 0) ?? 0);

/** Stage 1 — AX-tree depth 10 → 6. */
function shrinkAxDepth(tree: AccessibilityTree): AccessibilityTree {
  const root = pruneByDepth(tree.root, 0, MIN_AX_TREE_DEPTH);
  return { root, totalNodes: countAxNodes(root) };
}

/** Stage 2 — FilteredDOM top-30 → top-20. */
const shrinkFilteredDom = (dom: FilteredDOM): FilteredDOM => ({ top30: dom.top30.slice(0, SHRUNK_TOP_N) });

interface CandidateInputs {
  metadata: Metadata;
  ax: AccessibilityTree;
  dom: FilteredDOM;
  visual: Visual | undefined;
  diagnostics: Diagnostics;
  substrate: SubstrateResult;
}

/**
 * Assemble candidate PageStateModel from extractor inputs. Phase 1b T1B-000
 * merges substrate fields into `metadata` (schemaOrg, ogTags) and top-level
 * (ctas, formFields, headings, primaryActions). R20 namespace contract:
 * NEVER under `_extensions.*`.
 */
function assemble(inputs: CandidateInputs): PageStateModel {
  const metadataWithSubstrate: Metadata = {
    ...inputs.metadata,
    schemaOrg: inputs.substrate.schemaOrg,
    ogTags: inputs.substrate.ogTags,
  };
  const model: PageStateModel = {
    metadata: metadataWithSubstrate,
    accessibilityTree: inputs.ax,
    filteredDOM: inputs.dom,
    interactiveGraph: { clickable: [], typeable: [], submittable: [] },
    diagnostics: inputs.diagnostics,
    ctas: inputs.substrate.ctas,
    formFields: inputs.substrate.formFields,
    headings: inputs.substrate.headings,
    primaryActions: inputs.substrate.primaryActions,
  };
  if (inputs.visual !== undefined) model.visual = inputs.visual;
  return model;
}

/**
 * Apply the deterministic shrink ladder until the model fits the token
 * budget OR all stages are exhausted. Mutates `diagnostics.warnings` /
 * `diagnostics.errors` to record outcomes.
 */
function fitToTokenBudget(candidate: PageStateModel): PageStateModel {
  const initialTokens = tokenizeJson(candidate);
  if (initialTokens < PAGE_STATE_MODEL_TOKEN_BUDGET) return candidate;

  let model = candidate;

  // Stage 1: AX depth 10 → 6.
  model = { ...model, accessibilityTree: shrinkAxDepth(model.accessibilityTree) };
  if (tokenizeJson(model) < PAGE_STATE_MODEL_TOKEN_BUDGET) {
    model.diagnostics.warnings.push(`shrunk-from-${initialTokens}-tokens`);
    return model;
  }

  // Stage 2: top-30 → top-20.
  model = { ...model, filteredDOM: shrinkFilteredDom(model.filteredDOM) };
  if (tokenizeJson(model) < PAGE_STATE_MODEL_TOKEN_BUDGET) {
    model.diagnostics.warnings.push(`shrunk-from-${initialTokens}-tokens`);
    return model;
  }

  // Stage 3: drop visual.
  const { visual: _dropped, ...rest } = model;
  void _dropped;
  model = { ...rest };
  if (tokenizeJson(model) < PAGE_STATE_MODEL_TOKEN_BUDGET) {
    model.diagnostics.warnings.push(`shrunk-from-${initialTokens}-tokens`);
    return model;
  }

  // Stage 4: accept oversized.
  model.diagnostics.errors.push('oversized-after-shrink');
  return model;
}

async function tryCaptureVisual(
  session: BrowserSession,
  pageUrl: string,
): Promise<Visual | undefined> {
  try {
    return await screenshotExtractor.capture(session.page);
  } catch (err) {
    log.warn(
      { event: 'context_assembler.visual_failed', err: (err as Error).message, page_url: pageUrl },
      'screenshot capture failed; visual section omitted',
    );
    return undefined;
  }
}

/**
 * Run T1B-000 substrate extraction inside the page. Failure-tolerant — on
 * any evaluate() error returns an empty substrate so the rest of the
 * pipeline still produces a valid PageStateModel (R20 backward compat).
 */
/** Default viewport when caller didn't supply one (matches Phase 1's stealth default). */
const DEFAULT_VIEWPORT: { width: number; height: number } = { width: 1280, height: 720 };

async function tryExtractSubstrate(
  session: BrowserSession,
  sessionLog: Logger,
  viewport: { width: number; height: number },
): Promise<SubstrateResult> {
  try {
    // Build a wrapped script that immediately invokes the IIFE with viewport.
    const script = `${SUBSTRATE_EXTRACTION_SCRIPT}(${JSON.stringify(viewport)})`;
    return await session.page.evaluate<SubstrateResult>(script);
  } catch (err) {
    sessionLog.warn(
      { event: 'context_assembler.substrate_failed', err: (err as Error).message },
      'substrate extraction failed; using empty defaults',
    );
    return emptySubstrate();
  }
}

/**
 * Page-context script for metadata read. Runs inside Playwright's evaluate
 * sandbox where `document` + `performance` are real browser globals. Sent
 * as a string so the Node-side TypeScript checker doesn't try to resolve
 * DOM lib types (matches the T011 MutationMonitor INIT_SCRIPT pattern).
 */
const READ_METADATA_SCRIPT = `(function () {
  var navTiming = performance.getEntriesByType('navigation')[0];
  return {
    title: typeof document !== 'undefined' ? document.title : '',
    statusCode: (navTiming && navTiming.responseStatus) || 200,
  };
})()`;

/**
 * Read page metadata (title + statusCode) via the existing BrowserPage
 * `evaluate` seam — no new R9 surface area. Falls back to safe defaults
 * (`'' / 200`) on evaluate failure so capture always succeeds with a
 * valid PageStateModel.
 */
async function readPageMetadata(
  session: BrowserSession,
  sessionLog: Logger,
): Promise<{ title: string; statusCode: number }> {
  try {
    const result = await session.page.evaluate<{ title: string; statusCode: number }>(
      READ_METADATA_SCRIPT,
    );
    return {
      title: typeof result.title === 'string' ? result.title : '',
      statusCode: typeof result.statusCode === 'number' ? result.statusCode : 200,
    };
  } catch (err) {
    sessionLog.warn(
      { event: 'context_assembler.metadata_failed', err: (err as Error).message },
      'page metadata read failed; using defaults',
    );
    return { title: '', statusCode: 200 };
  }
}

class ContextAssembler {
  /**
   * Capture the canonical PageStateModel for `url`. Owns session lifecycle —
   * the BrowserSession is closed in `finally` regardless of mid-capture
   * errors (NF-Phase1-05). Errors thrown by the BrowserEngine itself
   * (launch / navigation failure) propagate to the caller; per-extractor
   * failures are aggregated into `diagnostics.errors` rather than thrown.
   */
  async capture(url: string, opts?: CaptureOpts): Promise<PageStateModel> {
    const navigationStartedAt = new Date();
    const session = await new BrowserManager().newSession(opts?.session);
    const sessionLog = log.child({ session_id: session.id, page_url: url });
    sessionLog.info({ event: 'capture.started' }, 'context assembler capture started');

    try {
      await applyStealthConfig(session.context, opts?.stealth);
      // Pre-navigation observer install (idempotent re-install OK; T011 INIT_SCRIPT guards).
      await mutationMonitor.observe(session.page, { timeoutMs: SETTLE_TIMEOUT_MS });

      await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      const settle = await mutationMonitor.observe(session.page, {
        timeoutMs: SETTLE_TIMEOUT_MS,
      });

      const ax = await accessibilityExtractor.extract(session.page);
      const filtered = hardFilter.apply(ax);
      const dom = softFilter.apply(filtered.tree);
      const visual = await tryCaptureVisual(session, url);
      // T1B-000 substrate extraction (Phase 1b) — runs inside the same
      // page.evaluate sandbox; failure-tolerant via emptySubstrate fallback.
      const viewport = opts?.session?.viewport ?? DEFAULT_VIEWPORT;
      const substrate = await tryExtractSubstrate(session, sessionLog, viewport);

      // Stage 2.5 fix N3 — populate metadata.title + statusCode from real
      // page data instead of hardcoded empty / 200. Title sourced via
      // document.title (works inside CAPTCHA walls + dynamic pages).
      // StatusCode sourced from PerformanceNavigationTiming.responseStatus
      // (browser-native; available after `domcontentloaded`). Both inside
      // existing BrowserPage.evaluate seam — no new R9 surface area.
      const meta = await readPageMetadata(session, sessionLog);
      const navigationEndedAt = new Date();
      const metadata: Metadata = {
        url,
        title: meta.title,
        statusCode: meta.statusCode,
        navigationStartedAt: navigationStartedAt.toISOString(),
        navigationEndedAt: navigationEndedAt.toISOString(),
      };

      const diagnostics: Diagnostics = {
        axNodeCount: ax.totalNodes,
        mutationsObserved: settle.mutationsObserved,
        stable: settle.stable,
        lowAxNodeCount: ax.totalNodes < 10,
        unstable: !settle.stable,
        errors: [],
        warnings: [],
      };

      const candidate = assemble({ metadata, ax: filtered.tree, dom, visual, diagnostics, substrate });
      const fitted = fitToTokenBudget(candidate);
      const validated = PageStateModelSchema.parse(fitted);

      sessionLog.info(
        {
          event: 'capture.completed',
          ax_nodes: ax.totalNodes,
          stable: settle.stable,
          mutations: settle.mutationsObserved,
        },
        'context assembler capture completed',
      );
      return validated;
    } finally {
      await session.close();
    }
  }
}

export const contextAssembler = new ContextAssembler();
export type { ContextAssembler };
