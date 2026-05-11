/**
 * AttentionScorer — Phase 1b T1B-008 (AC-08, REQ-ANALYZE-PERCEPTION-V24-001).
 * Source: spec R-08 + AC-08; plan §2.2 + §3; tasks T1B-008.
 *
 * R-08: score visual attention via contrast (Sharp), size (bbox area),
 * position (above-fold weight), saturation; emit top-3 hotspots + a
 * single dominant element (or null if max score <0.3).
 *
 * PHASE 1b KILL CRITERION (plan §3): browser-time regression >+200ms p50
 * → this is the suspect. The Sharp contrast pipeline MUST run ONCE on the
 * full screenshot, NOT per-element. Per-element scoring samples the
 * precomputed bitmap — DO NOT add per-element sharp() calls.
 *
 * R10 (≤250 LOC, functions ≤50, no `any`, named exports).
 * R24: pure metric calculation; no quality judgment.
 * R5.3 + GR-007: structural score, not conversion-predictive.
 */

import sharp from 'sharp';
import type { Cta, FormField, Heading, PrimaryAction } from '../types.js';

// Minimal DOM surface — agent-core's tsconfig excludes the DOM lib.
interface DOMRectLike { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
interface ElementLike {
  readonly tagName: string;
  readonly id: string;
  getAttribute(name: string): string | null;
  getBoundingClientRect(): DOMRectLike;
}
interface DocumentLike { querySelectorAll(selectors: string): ArrayLike<ElementLike> }
declare const CSS: { escape(value: string): string } | undefined;

export interface Viewport { width: number; height: number }

/** ExtractCtx subset this extractor reads (plan.md §2.2). */
export interface ExtractCtx {
  ctas: Cta[];
  formFields: FormField[];
  metadata: { schemaOrg: Array<Record<string, unknown>>; ogTags: Record<string, string> };
  headings: Heading[];
  primaryActions: PrimaryAction | null;
}

export type AttentionElementType = 'cta' | 'image' | 'heading' | 'form' | 'other';

export interface ContrastHotspot {
  boundingBox: { x: number; y: number; width: number; height: number };
  contrastScore: number;
}

export interface Attention {
  dominantElement: { type: AttentionElementType; selector: string; score: number } | null;
  contrastHotspots: ContrastHotspot[];
}

/** Composite-score weights per spec R-08 (sum = 1.0). */
const WEIGHT_CONTRAST = 0.4;
const WEIGHT_SIZE = 0.3;
const WEIGHT_POSITION = 0.2;
const WEIGHT_SATURATION = 0.1;
const DOMINANT_SCORE_THRESHOLD = 0.3;
const CONTRAST_MAP_WIDTH = 320;
const CONTRAST_MAP_HEIGHT = 180;
const DEFAULT_CONTRAST_HEURISTIC = 0.5;
const MAX_HOTSPOTS = 3;
/** Saturated-background regex — hint that the element uses an emphasis color. */
const SATURATED_BG = /background(-color)?\s*:\s*(red|orange|yellow|green|blue|purple|#[0-9a-f]{3,6})/i;

interface ContrastMap { data: Buffer; width: number; height: number }
interface BBox { x: number; y: number; width: number; height: number }
interface Candidate {
  type: AttentionElementType;
  selector: string;
  bbox: BBox;
  saturationHint: number;
}

/** Build a stable-ish CSS selector for an element (best-effort fallback). */
function buildSelector(el: ElementLike): string {
  const escape = (s: string): string =>
    typeof CSS !== 'undefined' && CSS ? CSS.escape(s) : s;
  if (el.id) return `#${escape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const name = el.getAttribute('name');
  return name ? `${tag}[name="${escape(name)}"]` : tag;
}

/** 0..1 saturation hint from inline style — structural signal only (R24). */
function readSaturationHint(el: ElementLike): number {
  const style = el.getAttribute('style') ?? '';
  return SATURATED_BG.test(style) ? 1.0 : 0.0;
}

/** Collect candidates: substrate ctas[] + DOM h1/h2/img/form. */
function collectCandidates(doc: DocumentLike, ctx: ExtractCtx): Candidate[] {
  const out: Candidate[] = ctx.ctas.map((cta) => ({
    type: 'cta' as const,
    selector: cta.selector,
    bbox: { x: 0, y: 0, width: cta.sizePx.width, height: cta.sizePx.height },
    saturationHint: 0.0,
  }));
  const pushDom = (sel: string, type: AttentionElementType): void => {
    const list = doc.querySelectorAll(sel);
    for (let i = 0; i < list.length; i += 1) {
      const el = list[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out.push({
        type,
        selector: buildSelector(el),
        bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
        saturationHint: readSaturationHint(el),
      });
    }
  };
  pushDom('h1, h2', 'heading');
  pushDom('img', 'image');
  pushDom('form', 'form');
  return out;
}

/** Above-fold score: 1.0 fully above, 0.5 straddles, 0.0 fully below. */
function abovefoldScore(bbox: BBox, viewport: Viewport): number {
  const fold = viewport.height;
  const bottom = bbox.y + bbox.height;
  if (bottom <= fold) return 1.0;
  if (bbox.y < fold) return 0.5;
  return 0.0;
}

/** Sample contrast bitmap at a candidate's bbox; returns 0..1. */
function sampleContrast(
  bbox: BBox,
  viewport: Viewport,
  map: ContrastMap | null,
): number {
  if (!map) return DEFAULT_CONTRAST_HEURISTIC;
  const sx = Math.max(0, Math.floor((bbox.x / viewport.width) * map.width));
  const sy = Math.max(0, Math.floor((bbox.y / viewport.height) * map.height));
  const ex = Math.min(map.width, Math.ceil(((bbox.x + bbox.width) / viewport.width) * map.width));
  const ey = Math.min(map.height, Math.ceil(((bbox.y + bbox.height) / viewport.height) * map.height));
  if (ex <= sx || ey <= sy) return DEFAULT_CONTRAST_HEURISTIC;
  let sum = 0;
  let n = 0;
  for (let y = sy; y < ey; y += 1) {
    for (let x = sx; x < ex; x += 1) {
      const v = map.data[y * map.width + x];
      if (v !== undefined) { sum += v; n += 1; }
    }
  }
  return n === 0 ? DEFAULT_CONTRAST_HEURISTIC : sum / n / 255;
}

/** Composite weighted score per R-08 formula. */
function scoreCandidate(c: Candidate, viewport: Viewport, contrastMap: ContrastMap | null): number {
  const contrast = sampleContrast(c.bbox, viewport, contrastMap);
  const viewportArea = Math.max(1, viewport.width * viewport.height);
  const size = Math.min(1, (c.bbox.width * c.bbox.height) / viewportArea);
  const position = abovefoldScore(c.bbox, viewport);
  return (
    WEIGHT_CONTRAST * contrast +
    WEIGHT_SIZE * size +
    WEIGHT_POSITION * position +
    WEIGHT_SATURATION * c.saturationHint
  );
}

/** Suppress cells within `r` of (cx,cy) in `used` to enforce hotspot non-overlap. */
function suppress(used: Set<number>, cx: number, cy: number, r: number, map: ContrastMap): void {
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) used.add(ny * map.width + nx);
    }
  }
}

/** Greedy top-3 non-overlapping hotspots from the precomputed contrast map. */
function pickHotspots(map: ContrastMap, viewport: Viewport): ContrastHotspot[] {
  const cells: Array<{ idx: number; v: number }> = [];
  for (let i = 0; i < map.data.length; i += 1) {
    const v = map.data[i];
    if (v !== undefined) cells.push({ idx: i, v });
  }
  cells.sort((a, b) => b.v - a.v);
  const taken: ContrastHotspot[] = [];
  const used = new Set<number>();
  const r = Math.floor(Math.min(map.width, map.height) / 6);
  const cellW = viewport.width / map.width;
  const cellH = viewport.height / map.height;
  for (const cell of cells) {
    if (taken.length >= MAX_HOTSPOTS) break;
    if (used.has(cell.idx)) continue;
    const cx = cell.idx % map.width;
    const cy = Math.floor(cell.idx / map.width);
    taken.push({
      boundingBox: { x: cx * cellW, y: cy * cellH, width: cellW, height: cellH },
      contrastScore: cell.v / 255,
    });
    suppress(used, cx, cy, r, map);
  }
  return taken;
}

/** Single-pass Sharp contrast pipeline (plan §3 kill criterion). */
async function buildContrastMap(screenshot: Buffer): Promise<ContrastMap> {
  // 3x3 absolute-edge kernel (Sobel-magnitude approximation). One convolve
  // pass on the full reduced bitmap — no per-element Sharp calls.
  const kernel = { width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] };
  const data = await sharp(screenshot)
    .resize(CONTRAST_MAP_WIDTH, CONTRAST_MAP_HEIGHT, { fit: 'fill' })
    .greyscale()
    .convolve(kernel)
    .raw()
    .toBuffer();
  return { data, width: CONTRAST_MAP_WIDTH, height: CONTRAST_MAP_HEIGHT };
}

/** Score candidates + assemble Attention given an optional contrast map. */
function assemble(
  doc: DocumentLike,
  viewport: Viewport,
  ctx: ExtractCtx,
  contrastMap: ContrastMap | null,
): Attention {
  const candidates = collectCandidates(doc, ctx);
  let best: { c: Candidate; score: number } | null = null;
  for (const c of candidates) {
    const s = scoreCandidate(c, viewport, contrastMap);
    if (best === null || s > best.score) best = { c, score: s };
  }
  const dominantElement =
    best !== null && best.score > DOMINANT_SCORE_THRESHOLD
      ? { type: best.c.type, selector: best.c.selector, score: Math.min(1, best.score) }
      : null;
  const contrastHotspots = contrastMap !== null ? pickHotspots(contrastMap, viewport) : [];
  return { dominantElement, contrastHotspots };
}

/**
 * Synchronous entry — bbox + position + saturation scoring only; emits
 * `contrastHotspots: []`. Always returns an Attention object;
 * `dominantElement` is null when no candidate scores >0.3 (AC-08).
 */
export function extractAttention(doc: DocumentLike, viewport: Viewport, ctx: ExtractCtx): Attention {
  return assemble(doc, viewport, ctx, null);
}

/**
 * Async variant — runs the single-pass Sharp contrast pipeline ONCE on the
 * full screenshot (plan §3 kill criterion), then samples per-candidate.
 */
export async function extractAttentionAsync(
  doc: DocumentLike,
  viewport: Viewport,
  ctx: ExtractCtx,
  screenshot: Buffer,
): Promise<Attention> {
  const contrastMap = await buildContrastMap(screenshot);
  return assemble(doc, viewport, ctx, contrastMap);
}
