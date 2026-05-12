/**
 * ElementGraphBuilder — Phase 1c T1C-007 (AC-07, R-07, REQ-ANALYZE-PERCEPTION-V25-001).
 * Source: phase-1c spec.md AC-07 + R-07 (v0.2); plan.md §2.3 + §2.4; tasks.md T1C-007.
 *
 * Fuses T1C-002..T1C-006 + Phase 1/1b PageStateModel arrays into an ElementGraph
 * keyed by stable element_id. Feeds PerceptionBundle (T1C-010); truncated_count
 * drives ELEMENT_GRAPH_TRUNCATED in T1C-009 WarningEmitter (no warn emit here).
 *
 * Stability (plan.md §2.3):
 *   element_id = sha256(tag + sorted_classes + dom_position_path +
 *                       text_content_prefix(50)).slice(0, 16)
 *   On hash collision: append `:N` for the Nth duplicate (rare at 16 hex).
 *
 * Selective fusion priority (plan.md §2.4) — top-30 cap HARDCODED for MVP:
 *   P1 = v2.3/v2.4 AnalyzePerception array refs (ctas, click_targets, ...)
 *   P2 = ax.role ∈ {button, link, tab, menuitem, checkbox, radio, combobox, textbox}
 *   P3 = is_interactive=true not covered above
 *   P4 = direct ancestors (parent_id chain integrity)
 *
 * R10: file ≤300 LOC, fn ≤50 LOC, no `any`. R24: capture-only (no DOM mutation).
 * agent-core tsconfig has lib:["ES2022"] — declare structural DOM surface here,
 * compatible with jsdom/Playwright Element + Document at runtime.
 */

import { createHash } from 'node:crypto';

// Structural DOM surface (no `lib.dom`).
interface ElementLike {
  readonly tagName: string;
  readonly className: string;
  readonly textContent: string | null;
  readonly children: ArrayLike<ElementLike>;
  readonly parentElement: ElementLike | null;
  readonly attributes: ArrayLike<{ readonly name: string; readonly value: string }>;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
}
interface DocumentLike {
  readonly documentElement: ElementLike | null;
  readonly body: ElementLike | null;
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
}

/** HARDCODED MVP cap (plan.md §2.4 v0.2). Configurability deferred. */
export const ELEMENT_GRAPH_CAP = 30;

const INTERACTIVE_AX_ROLES = new Set<string>([
  'button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'combobox', 'textbox',
]);
const INTERACTIVE_TAGS = new Set<string>([
  'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'SUMMARY',
]);

export interface FusedElement {
  element_id: string;
  selector: string;
  tag: string;
  text_content: string;
  attrs: Record<string, string>;
  ax: { role?: string; name?: string };
  is_interactive: boolean;
  parent_id: string | null;
  child_ids: string[];
  ref_in_analyze_perception: Record<string, number | string | undefined>;
}
export interface ElementGraph {
  elements: Map<string, FusedElement>;
  root_element_ids: string[];
  truncated_count: number;
}
export interface BuildInputs {
  doc: DocumentLike;
  /** Optional CTA index (selector + text) for ref_in_analyze_perception linkage. */
  ctasIndex?: Array<{ selector: string; text: string }>;
  /** Reserved for future cross-doc fusion. */
  ctxOrigin?: string;
}

interface Candidate {
  el: ElementLike;
  priority: 1 | 2 | 3 | 4;
  refIndex: number; // index into ctasIndex when P1, else -1
}

/** @AC-07 Build the fused ElementGraph. Pure — no side effects. */
export function buildElementGraph(inputs: BuildInputs): ElementGraph {
  const root = inputs.doc.body ?? inputs.doc.documentElement;
  if (root === null) {
    return { elements: new Map(), root_element_ids: [], truncated_count: 0 };
  }

  const candidates = collectCandidates(root, inputs.ctasIndex ?? []);
  const sorted = candidates.sort((a, b) => a.priority - b.priority);
  const kept = sorted.slice(0, ELEMENT_GRAPH_CAP);
  const truncated_count = Math.max(0, sorted.length - ELEMENT_GRAPH_CAP);

  return materializeGraph(kept, inputs.ctasIndex ?? [], truncated_count);
}

/** Walk DOM in document order, classifying each element by P1/P2/P3. */
function collectCandidates(
  root: ElementLike,
  ctasIndex: ReadonlyArray<{ selector: string; text: string }>,
): Candidate[] {
  const out: Candidate[] = [];
  const visited = new Set<ElementLike>();

  walk(root, (el) => {
    if (visited.has(el)) return;
    const refIdx = matchCtaIndex(el, ctasIndex);
    if (refIdx >= 0) {
      out.push({ el, priority: 1, refIndex: refIdx });
      visited.add(el);
      return;
    }
    const role = inferAxRole(el);
    if (role !== undefined && INTERACTIVE_AX_ROLES.has(role)) {
      out.push({ el, priority: 2, refIndex: -1 });
      visited.add(el);
      return;
    }
    if (isInteractive(el)) {
      out.push({ el, priority: 3, refIndex: -1 });
      visited.add(el);
    }
  });

  return out;
}

function walk(node: ElementLike, fn: (el: ElementLike) => void): void {
  fn(node);
  const kids = node.children;
  for (let i = 0; i < kids.length; i += 1) {
    const child = kids[i];
    if (child !== undefined) walk(child, fn);
  }
}

function matchCtaIndex(
  el: ElementLike,
  ctasIndex: ReadonlyArray<{ selector: string; text: string }>,
): number {
  const text = (el.textContent ?? '').trim();
  for (let i = 0; i < ctasIndex.length; i += 1) {
    const entry = ctasIndex[i];
    if (entry === undefined) continue;
    if (entry.text && text.startsWith(entry.text)) return i;
  }
  return -1;
}

function inferAxRole(el: ElementLike): string | undefined {
  const explicit = el.getAttribute('role');
  if (explicit !== null && explicit !== '') return explicit.trim().toLowerCase();
  const tag = el.tagName.toUpperCase();
  if (tag === 'A' && el.hasAttribute('href')) return 'link';
  if (tag === 'BUTTON') return 'button';
  if (tag === 'SELECT') return 'combobox';
  if (tag === 'TEXTAREA') return 'textbox';
  if (tag !== 'INPUT') return undefined;
  const t = (el.getAttribute('type') ?? 'text').toLowerCase();
  if (t === 'checkbox' || t === 'radio') return t;
  if (t === 'button' || t === 'submit' || t === 'reset') return 'button';
  return 'textbox';
}

function isInteractive(el: ElementLike): boolean {
  if (INTERACTIVE_TAGS.has(el.tagName.toUpperCase())) return true;
  const role = el.getAttribute('role');
  return role !== null && INTERACTIVE_AX_ROLES.has(role.trim().toLowerCase());
}

/** Materialize FusedElement records + patch parent_id / child_ids chain. */
function materializeGraph(
  kept: ReadonlyArray<Candidate>,
  ctasIndex: ReadonlyArray<{ selector: string; text: string }>,
  truncated_count: number,
): ElementGraph {
  const elements = new Map<string, FusedElement>();
  const elementByNode = new Map<ElementLike, string>();
  const hashCounts = new Map<string, number>();
  for (const cand of kept) {
    const id = assignId(cand.el, hashCounts);
    elementByNode.set(cand.el, id);
    elements.set(id, toFused(cand.el, id, cand, ctasIndex));
  }
  // Patch parent_id + child_ids using nodes already in the map.
  const rootIds: string[] = [];
  for (const [node, id] of elementByNode) {
    const fused = elements.get(id);
    if (fused === undefined) continue;
    const parent = findKeptAncestor(node, elementByNode);
    fused.parent_id = parent;
    if (parent === null) rootIds.push(id);
    else elements.get(parent)?.child_ids.push(id);
  }
  return { elements, root_element_ids: rootIds, truncated_count };
}

function findKeptAncestor(
  node: ElementLike,
  elementByNode: ReadonlyMap<ElementLike, string>,
): string | null {
  let cur: ElementLike | null = node.parentElement;
  while (cur !== null) {
    const id = elementByNode.get(cur);
    if (id !== undefined) return id;
    cur = cur.parentElement;
  }
  return null;
}

function assignId(el: ElementLike, hashCounts: Map<string, number>): string {
  const base = hashElement(el);
  const prev = hashCounts.get(base) ?? 0;
  hashCounts.set(base, prev + 1);
  return prev === 0 ? base : `${base}:${prev}`;
}

/** plan.md §2.3: sha256(tag|sorted_classes|dom_position_path|text_prefix(50))[:16] */
function hashElement(el: ElementLike): string {
  const tag = el.tagName.toLowerCase();
  const classes = sortedClassList(el.className).join(',');
  const path = domPositionPath(el);
  const textPrefix = (el.textContent ?? '').trim().slice(0, 50);
  const input = `${tag}|${classes}|${path}|${textPrefix}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function sortedClassList(className: string): string[] {
  if (className === '') return [];
  return className.trim().split(/\s+/).filter(Boolean).sort();
}

/** html>body>div:nth-child(2)>section:nth-child(1)>... — deterministic, single pass. */
function domPositionPath(el: ElementLike): string {
  const segs: string[] = [];
  let cur: ElementLike | null = el;
  while (cur !== null) {
    const idx = childIndex(cur);
    const tag = cur.tagName.toLowerCase();
    segs.unshift(idx === -1 ? tag : `${tag}:nth-child(${idx})`);
    cur = cur.parentElement;
  }
  return segs.join('>');
}

function childIndex(el: ElementLike): number {
  const parent = el.parentElement;
  if (parent === null) return -1;
  const kids = parent.children;
  for (let i = 0; i < kids.length; i += 1) {
    if (kids[i] === el) return i + 1; // CSS nth-child is 1-based
  }
  return -1;
}

function toFused(
  el: ElementLike,
  element_id: string,
  cand: Candidate,
  ctasIndex: ReadonlyArray<{ selector: string; text: string }>,
): FusedElement {
  const role = inferAxRole(el);
  const attrs: Record<string, string> = {};
  const attrList = el.attributes;
  for (let i = 0; i < attrList.length; i += 1) {
    const a = attrList[i];
    if (a !== undefined) attrs[a.name] = a.value;
  }
  const text = (el.textContent ?? '').trim().slice(0, 50);
  const ref: Record<string, number | string | undefined> = {};
  if (cand.priority === 1 && cand.refIndex >= 0) {
    ref.ctas = cand.refIndex;
    const entry = ctasIndex[cand.refIndex];
    if (entry !== undefined) ref.cta_selector = entry.selector;
  }
  const ax: { role?: string; name?: string } = {};
  if (role !== undefined) ax.role = role;
  const accName = el.getAttribute('aria-label') ?? text;
  if (accName !== '') ax.name = accName;
  return {
    element_id, selector: buildSelector(el), tag: el.tagName.toLowerCase(),
    text_content: text, attrs, ax, is_interactive: isInteractive(el),
    parent_id: null, child_ids: [], ref_in_analyze_perception: ref,
  };
}

function buildSelector(el: ElementLike): string {
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute('id');
  if (id !== null && id !== '') return `${tag}#${id}`;
  const classes = sortedClassList(el.className);
  if (classes.length > 0) return `${tag}.${classes.join('.')}`;
  return tag;
}
