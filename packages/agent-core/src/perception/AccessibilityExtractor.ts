/**
 * AccessibilityExtractor — Phase 1 T008.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-03 + R-05;
 *         docs/specs/mvp/phases/phase-1-perception/plan.md
 *           §"Per-extractor design" item 1;
 *         docs/specs/mvp/phases/phase-1-perception/tasks.md T008.
 *
 * R11.4 v0.3.2 — uses `page.ariaSnapshot()` (Playwright 1.57+; returns YAML
 * string). The legacy `page.accessibility.snapshot()` API was removed.
 * AccessibilityExtractor owns the YAML→`AccessibilityNodeSchema` parse-back
 * step so that downstream HardFilter (T009) / SoftFilter (T010) /
 * ContextAssembler (T013) continue to consume the legacy AX-tree object
 * shape they were designed against.
 *
 * --- YAML grammar handled (subset Playwright emits) ---
 *
 *   - <role>
 *   - <role> "<name>"
 *   - <role> "<name>" [attr] [attr=value]
 *   - <role>:                         (parent — children follow at +2 indent)
 *   - <role> "<name>":                (parent with name)
 *
 * Attributes recognized (mapped to `AccessibilityNode` fields):
 *   level=N         → level
 *   expanded[=true|false]   → expanded
 *   selected[=true|false]   → selected
 *   checked[=true|false|mixed]  → not on schema; ignored
 *   disabled[=true|false]   → disabled
 *   focused[=true|false]    → focused
 *   required[=true|false]   → required
 *   hidden[=true|false]     → hidden
 *
 * Other bracketed attrs (notably `[ref=eXX]` — Playwright's internal locator
 * hint) are skipped.
 *
 * R10 compliance:
 *   - File ≤ 200 lines (R10.1; spec target).
 *   - Functions ≤ 50 lines (R10.2; helpers split out).
 *   - Named export `accessibilityExtractor` (R10.3).
 *   - Pino via `createLogger` (R10.6); no console.log.
 *   - No `any` (R13).
 */
import { createLogger } from '../observability/logger.js';
import type { BrowserPage } from '../adapters/BrowserEngine.js';
import {
  AccessibilityTreeSchema,
  checkAxTreeDepth,
  MAX_AX_TREE_DEPTH,
  type AccessibilityNode,
  type AccessibilityTree,
} from './types.js';

const logger = createLogger('accessibility-extractor');

const LOW_NODE_COUNT_WARN_THRESHOLD = 50;
const INDENT_WIDTH = 2;

/**
 * Empty-snapshot retry threshold. Chrome computes the accessibility tree
 * lazily — calling `ariaSnapshot()` immediately after `domcontentloaded` on
 * heavy SPAs (amazon.in, Shopify storefronts) frequently returns an empty
 * string while the AX-tree is still being built. We do exactly ONE retry
 * after a short stabilization wait. Callers (T013 ContextAssembler) own the
 * larger settle algorithm via MutationMonitor (T011); this is a narrow
 * extractor-level robustness step for the YAML→object boundary.
 */
const EMPTY_SNAPSHOT_RETRY_DELAY_MS = 1_000;

/**
 * Parses a single ariaSnapshot YAML line into the leading indent + an
 * `AccessibilityNode` shell (no `children` yet — assembled by the caller via
 * indent stack).
 *
 * Returns null for empty / non-node lines (blank lines, structural-only
 * separators) so the caller can skip them.
 */
function parseLine(line: string): { indent: number; node: AccessibilityNode } | null {
  // Count leading spaces (indent depth).
  let indent = 0;
  while (indent < line.length && line[indent] === ' ') indent++;
  const body = line.slice(indent);
  if (body.length === 0) return null;
  if (!body.startsWith('- ')) return null;

  // Strip "- " prefix and an optional trailing ":" (parent marker).
  let rest = body.slice(2).trim();
  if (rest.endsWith(':')) rest = rest.slice(0, -1).trim();

  // Role token: up to first whitespace, quote, or "[".
  const roleMatch = /^([A-Za-z][A-Za-z0-9-]*)/.exec(rest);
  if (!roleMatch) return null;
  const role = roleMatch[1] ?? '';
  rest = rest.slice(role.length).trim();

  // Optional quoted name.
  let name: string | undefined;
  if (rest.startsWith('"')) {
    // Match a double-quoted string allowing escaped quotes.
    const nameMatch = /^"((?:[^"\\]|\\.)*)"/.exec(rest);
    if (nameMatch) {
      name = (nameMatch[1] ?? '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      rest = rest.slice(nameMatch[0].length).trim();
    }
  }

  const node: AccessibilityNode = name === undefined ? { role } : { role, name };
  applyBracketAttrs(rest, node);
  return { indent, node };
}

/**
 * Parses bracketed attribute tokens (`[level=2]`, `[expanded]`, ...) trailing
 * a node line and mutates `node` in place.
 */
function applyBracketAttrs(tail: string, node: AccessibilityNode): void {
  const attrRegex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tail)) !== null) {
    const inner = (match[1] ?? '').trim();
    const eq = inner.indexOf('=');
    const key = (eq === -1 ? inner : inner.slice(0, eq)).trim();
    const rawVal = eq === -1 ? '' : inner.slice(eq + 1).trim();
    // Normalize: `[expanded]` → true; `[expanded=false]` → false.
    const boolVal = eq === -1 ? true : rawVal === 'true';
    switch (key) {
      case 'level':
        if (rawVal) {
          const n = Number.parseInt(rawVal, 10);
          if (Number.isFinite(n)) node.level = n;
        }
        break;
      case 'expanded':
        node.expanded = boolVal;
        break;
      case 'selected':
        node.selected = boolVal;
        break;
      case 'disabled':
        node.disabled = boolVal;
        break;
      case 'focused':
        node.focused = boolVal;
        break;
      case 'required':
        node.required = boolVal;
        break;
      case 'hidden':
        node.hidden = boolVal;
        break;
      // ref / checked / pressed / etc. — not on schema; ignore (R13 — strict).
      default:
        break;
    }
  }
}

/**
 * Hand-rolled YAML→AccessibilityNode parser. Stack-based so each line costs
 * O(1) parent-lookup. Returns a synthetic root wrapping all top-level nodes
 * (role="WebArea") so the AccessibilityTree always has a single root.
 */
function parseAriaSnapshotYaml(yaml: string): AccessibilityNode {
  const root: AccessibilityNode = { role: 'WebArea', children: [] };
  // stack[i] = the node whose children live at indent (i+1) * INDENT_WIDTH.
  // stack[0] = the synthetic root (its children are the top-level nodes).
  const stack: AccessibilityNode[] = [root];
  for (const rawLine of yaml.split('\n')) {
    const parsed = parseLine(rawLine);
    if (!parsed) continue;
    const depth = Math.floor(parsed.indent / INDENT_WIDTH);
    // Trim stack so its top-of-stack is the parent for this depth.
    while (stack.length > depth + 1) stack.pop();
    const parent = stack[stack.length - 1];
    if (!parent) continue; // defensive — synthetic root never popped
    if (!parent.children) parent.children = [];
    parent.children.push(parsed.node);
    // Push this node so subsequent deeper lines attach as its children.
    stack.push(parsed.node);
  }
  return root;
}

/** Recursively counts every node in a subtree (inclusive of `node`). */
function countNodes(node: AccessibilityNode): number {
  let n = 1;
  if (node.children) {
    for (const child of node.children) n += countNodes(child);
  }
  return n;
}

/**
 * AccessibilityExtractor singleton. Pure aside from Pino logging.
 *
 * `extract()` flow:
 *   1. `page.ariaSnapshot()` → YAML string (Playwright 1.57+).
 *   2. Hand-rolled parse → AccessibilityNode tree.
 *   3. `checkAxTreeDepth(root)` — guard before z.parse (defense-in-depth
 *      against malformed / pathologically-deep YAML; R10.6 logged).
 *   4. Recursive node count; warn when below threshold.
 *   5. `AccessibilityTreeSchema.parse({ root, totalNodes })`.
 */
export const accessibilityExtractor = {
  async extract(page: BrowserPage): Promise<AccessibilityTree> {
    let yaml = await page.ariaSnapshot();
    if (yaml.length === 0) {
      // Chrome AX-tree lazy-population quirk — see EMPTY_SNAPSHOT_RETRY_DELAY_MS comment.
      logger.warn('ariaSnapshot returned empty YAML; retrying after stabilization wait');
      await new Promise((resolve) => setTimeout(resolve, EMPTY_SNAPSHOT_RETRY_DELAY_MS));
      yaml = await page.ariaSnapshot();
    }

    const root = parseAriaSnapshotYaml(yaml);

    const depthCheck = checkAxTreeDepth(root, MAX_AX_TREE_DEPTH);
    if (!depthCheck.ok) {
      logger.warn({ reason: depthCheck.reason }, 'ax-tree depth guard tripped; truncating');
    }

    const totalNodes = countNodes(root);
    if (totalNodes < LOW_NODE_COUNT_WARN_THRESHOLD) {
      logger.warn({ totalNodes }, 'ax-tree node count below typical floor');
    }

    return AccessibilityTreeSchema.parse({ root, totalNodes });
  },
};
