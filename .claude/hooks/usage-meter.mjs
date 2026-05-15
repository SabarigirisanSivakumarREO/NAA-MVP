// .claude/hooks/usage-meter.mjs
//
// Shared worker for usage-tracking hooks. Reads a transcript JSONL file
// and returns a cumulative + peak snapshot of token usage + cost.
//
// IMPORTANT: this module is loaded by hooks that run on every turn. Keep
// it dependency-free (Node stdlib only) and fast (< 100 ms typical).
// Read transcripts line-by-line (readline) — never fs.readFile a 100MB file.
//
// Threshold semantics:
// - peak_input_tokens = max across all turns of the *effective prompt size*
//   (input + cache_creation + cache_read). This is the "context window
//   utilization" metric — the most-tokens-ever-loaded into the prompt.
// - last_turn_input_tokens = effective prompt size of the most recent turn
//   (proxy for what the NEXT user prompt would see, before tool/output growth).
//
// Cost model: Anthropic per-token pricing per model (May 2026 table).
// Cache writes cost more than uncached input; cache reads are cheap (~10%).

import { promises as fsp, createReadStream, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

/**
 * Anthropic pricing per 1M tokens, USD. Keys are normalized model families.
 * `normalizeModel()` strips date suffixes and minor-version variants.
 */
export const PRICING = {
  'claude-sonnet-4': { input: 3.0, output: 15.0, cache_write: 3.75, cache_read: 0.3 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0, cache_write: 3.75, cache_read: 0.3 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cache_write: 3.75, cache_read: 0.3 },
  'claude-sonnet-4-7': { input: 3.0, output: 15.0, cache_write: 3.75, cache_read: 0.3 },
  'claude-opus-4': { input: 15.0, output: 75.0, cache_write: 18.75, cache_read: 1.5 },
  'claude-opus-4-1': { input: 15.0, output: 75.0, cache_write: 18.75, cache_read: 1.5 },
  'claude-opus-4-5': { input: 15.0, output: 75.0, cache_write: 18.75, cache_read: 1.5 },
  'claude-opus-4-6': { input: 15.0, output: 75.0, cache_write: 18.75, cache_read: 1.5 },
  'claude-opus-4-7': { input: 15.0, output: 75.0, cache_write: 18.75, cache_read: 1.5 },
  'claude-haiku-4': { input: 0.8, output: 4.0, cache_write: 1.0, cache_read: 0.08 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0, cache_write: 1.0, cache_read: 0.08 },
};

const DEFAULT_PRICING = PRICING['claude-opus-4-7']; // assume worst-case (most expensive) if unknown

/**
 * Strip date suffixes (e.g. "-20250514") and bracketed annotations
 * (e.g. "[1m]") to produce a stable family key for PRICING lookup.
 *
 * Examples:
 *   claude-opus-4-7-20250514     -> claude-opus-4-7
 *   claude-opus-4-7[1m]          -> claude-opus-4-7
 *   claude-sonnet-4-5-latest     -> claude-sonnet-4-5
 *   anthropic/claude-opus-4      -> claude-opus-4
 */
export function normalizeModel(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let m = raw.toLowerCase().trim();
  // drop any provider prefix like "anthropic/"
  const slash = m.lastIndexOf('/');
  if (slash !== -1) m = m.slice(slash + 1);
  // drop bracketed annotations
  m = m.replace(/\[[^\]]*\]/g, '');
  // drop trailing "-latest" / "-stable"
  m = m.replace(/-(latest|stable)$/, '');
  // drop trailing 8-digit date suffix: -YYYYMMDD
  m = m.replace(/-\d{8}$/, '');
  // try progressively shorter prefixes against PRICING keys (longest match wins)
  const parts = m.split('-');
  for (let i = parts.length; i >= 2; i--) {
    const key = parts.slice(0, i).join('-');
    if (PRICING[key]) return key;
  }
  return null;
}

/**
 * Cost in USD for one assistant turn given its usage block.
 * usage fields: input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
 */
export function computeTurnCost(usage, modelKey) {
  if (!usage) return 0;
  const p = (modelKey && PRICING[modelKey]) || DEFAULT_PRICING;
  const inT = Number(usage.input_tokens || 0);
  const outT = Number(usage.output_tokens || 0);
  const cwT = Number(usage.cache_creation_input_tokens || 0);
  const crT = Number(usage.cache_read_input_tokens || 0);
  return (
    (inT * p.input) / 1_000_000 +
    (outT * p.output) / 1_000_000 +
    (cwT * p.cache_write) / 1_000_000 +
    (crT * p.cache_read) / 1_000_000
  );
}

/**
 * Effective prompt size for one turn: sum of all prompt-side tokens
 * (input + cache_creation + cache_read). This IS the context-window
 * utilization metric — represents the total tokens loaded into the
 * model's prompt for this turn, regardless of cache hit/miss.
 */
function effectivePromptTokens(usage) {
  if (!usage) return 0;
  return (
    Number(usage.input_tokens || 0) +
    Number(usage.cache_creation_input_tokens || 0) +
    Number(usage.cache_read_input_tokens || 0)
  );
}

/**
 * Atomic write: write to .tmp, then rename. Prevents partial reads
 * if another hook fires mid-write (UserPromptSubmit can fire concurrently
 * with SessionStart in edge cases).
 */
async function atomicWriteJson(path, obj) {
  const dir = dirname(path);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = path + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fsp.rename(tmp, path);
}

/**
 * Empty snapshot (fresh session, missing transcript, or read error).
 */
function emptySnapshot(sessionId = null, reason = 'no_transcript') {
  return {
    session_id: sessionId,
    model: null,
    cumulative: {
      input: 0,
      output: 0,
      cache_creation: 0,
      cache_read: 0,
      total_input_eq: 0,
    },
    peak_input_tokens: 0,
    last_turn_input_tokens: 0,
    cost_usd: 0,
    pct_of_1M_context: 0,
    turns_count: 0,
    computed_at: new Date().toISOString(),
    reason,
  };
}

/**
 * Read transcript JSONL line-by-line and accumulate token usage.
 *
 * @param {string|null|undefined} transcriptPath  absolute path to *.jsonl
 * @returns {Promise<object>} snapshot
 */
export async function computeUsage(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') {
    return emptySnapshot(null, 'no_transcript_path');
  }
  const abs = resolve(transcriptPath);
  if (!existsSync(abs)) {
    return emptySnapshot(null, 'transcript_missing');
  }

  let cumInput = 0;
  let cumOutput = 0;
  let cumCacheCreate = 0;
  let cumCacheRead = 0;
  let peakPromptTokens = 0;
  let lastPromptTokens = 0;
  let cost = 0;
  let turns = 0;
  let sessionId = null;
  const modelCounts = {}; // model_key -> count, to infer the "primary" model

  const stream = createReadStream(abs, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (!line || !line.trim()) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch (err) {
        // corrupted line — skip silently per spec; surface to stderr for diagnostics
        process.stderr.write(`[usage-meter] skip malformed JSONL line in ${abs}\n`);
        continue;
      }
      if (!sessionId && row.sessionId) sessionId = row.sessionId;
      if (row.type !== 'assistant') continue;
      const msg = row.message;
      if (!msg || !msg.usage) continue;
      const usage = msg.usage;
      const modelKey = normalizeModel(msg.model);
      if (modelKey) modelCounts[modelKey] = (modelCounts[modelKey] || 0) + 1;

      cumInput += Number(usage.input_tokens || 0);
      cumOutput += Number(usage.output_tokens || 0);
      cumCacheCreate += Number(usage.cache_creation_input_tokens || 0);
      cumCacheRead += Number(usage.cache_read_input_tokens || 0);
      cost += computeTurnCost(usage, modelKey);
      turns += 1;
      const promptTokens = effectivePromptTokens(usage);
      lastPromptTokens = promptTokens; // overwritten each iteration → last assistant turn's value at EOF
      if (promptTokens > peakPromptTokens) peakPromptTokens = promptTokens;
    }
  } catch (err) {
    process.stderr.write(`[usage-meter] read error on ${abs}: ${err && err.message}\n`);
    return emptySnapshot(sessionId, 'read_error');
  }

  // Pick the primary model = the one with the most turns; fall back to opus-4-7
  let primaryModel = null;
  let primaryCount = -1;
  for (const [k, c] of Object.entries(modelCounts)) {
    if (c > primaryCount) {
      primaryCount = c;
      primaryModel = k;
    }
  }

  const snapshot = {
    session_id: sessionId,
    model: primaryModel,
    cumulative: {
      input: cumInput,
      output: cumOutput,
      cache_creation: cumCacheCreate,
      cache_read: cumCacheRead,
      total_input_eq: cumInput + cumCacheCreate + cumCacheRead,
    },
    peak_input_tokens: peakPromptTokens,
    last_turn_input_tokens: lastPromptTokens,
    cost_usd: Number(cost.toFixed(6)),
    pct_of_1M_context: Number(((peakPromptTokens / 1_000_000) * 100).toFixed(2)),
    turns_count: turns,
    computed_at: new Date().toISOString(),
  };

  // Persist snapshot for cross-hook reuse (best-effort; never break the hook chain)
  try {
    const repoRoot = process.cwd();
    const snapshotPath = join(repoRoot, '.phase-state', 'usage-current.json');
    await atomicWriteJson(snapshotPath, snapshot);
  } catch (err) {
    process.stderr.write(`[usage-meter] failed to persist snapshot: ${err && err.message}\n`);
  }

  return snapshot;
}

export default computeUsage;

// CLI usage:  node .claude/hooks/usage-meter.mjs <transcript_path>
//   prints the snapshot as pretty-printed JSON. Useful for ad-hoc inspection.
// (Cross-platform: pathToFileURL handles Windows drive-letter quirks that a
// raw `file://${argv[1]}` template literal does not.)
import { pathToFileURL } from 'node:url';
const _entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (_entry && import.meta.url === _entry) {
  const arg = process.argv[2];
  computeUsage(arg)
    .then((snap) => {
      process.stdout.write(JSON.stringify(snap, null, 2) + '\n');
    })
    .catch((err) => {
      process.stderr.write(`[usage-meter] fatal: ${err && err.message}\n`);
      process.exit(0); // never break callers
    });
}
