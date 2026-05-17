#!/usr/bin/env node
// .claude/hooks/subagent-monitor.mjs
//
// PostToolUse hook on `Agent` tool. Fires after each subagent dispatch
// completes. Reads the subagent's transcript JSONL, computes peak context
// utilization, appends a record to .phase-state/subagent-usage.jsonl, and
// surfaces a warning via additionalContext if the subagent ran context-hot.
//
// Why this exists:
// - Subagents have their own 1M context windows. The main session's
//   usage-guard.mjs only monitors the MAIN transcript — it does NOT see
//   subagent context utilization.
// - A subagent that approaches its own 60% HARD STOP risks attention-quality
//   degradation mid-task. This hook surfaces that risk to the main thread
//   AFTER the subagent finishes so the operator can decide whether to
//   re-dispatch with a tighter brief, or accept the result with eyes open.
//
// Contract:
//   stdin  -> JSON envelope: { tool_name, tool_input, tool_response,
//                              session_id, transcript_path, cwd, ... }
//   stdout -> JSON:
//     - {} (silent — subagent peak < SUBAGENT_WARN_TOKENS)
//     - { hookSpecificOutput: { hookEventName: "PostToolUse",
//                               additionalContext: "<warning>" } }
//
// Thresholds (subagent-specific; lower than main session because subagents
// should stay scoped):
//   SUBAGENT_WARN_TOKENS  = 300K (30% of 1M) — note in next-turn context
//   SUBAGENT_ALERT_TOKENS = 500K (50% of 1M) — strong alert; suggests
//                                              tighter brief on re-dispatch
//
// MUST exit 0 even on internal failure (never break the session).

import { promises as fsp, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { computeUsage } from './usage-meter.mjs';

const SUBAGENT_WARN_TOKENS = 300_000; // 30% of 1M
const SUBAGENT_ALERT_TOKENS = 500_000; // 50% of 1M
const WINDOW_TOKENS = 1_000_000;

const REPO_ROOT = process.cwd();

async function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    if (process.stdin.isTTY) return resolve('');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (buf += chunk));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
  });
}

/**
 * Derive the subagents directory for a parent session.
 *
 * transcript_path looks like:
 *   /c/Users/HP/.claude/projects/C--Sabari-Neural-NBA/<sessionId>.jsonl
 *
 * Subagent JSONLs live at:
 *   /c/Users/HP/.claude/projects/C--Sabari-Neural-NBA/<sessionId>/subagents/agent-<agentId>.jsonl
 */
function subagentsDirFor(transcriptPath, sessionId) {
  if (!transcriptPath) return null;
  const dir = dirname(transcriptPath);
  if (!sessionId) {
    // Try to derive from filename
    const base = transcriptPath.replace(/\\/g, '/').split('/').pop() || '';
    sessionId = base.replace(/\.jsonl$/, '');
  }
  if (!sessionId) return null;
  return join(dir, sessionId, 'subagents');
}

/**
 * Find the newest agent-*.jsonl under the subagents directory.
 * Returns absolute path or null.
 */
function findNewestSubagentJsonl(subagentsDir) {
  if (!subagentsDir || !existsSync(subagentsDir)) return null;
  let candidates;
  try {
    candidates = readdirSync(subagentsDir).filter((f) => /^agent-[a-z0-9]+\.jsonl$/i.test(f));
  } catch {
    return null;
  }
  if (!candidates.length) return null;
  let newest = null;
  let newestMtime = -Infinity;
  for (const f of candidates) {
    const full = join(subagentsDir, f);
    try {
      const st = statSync(full);
      if (st.mtimeMs > newestMtime) {
        newestMtime = st.mtimeMs;
        newest = full;
      }
    } catch {
      // skip
    }
  }
  return newest;
}

/**
 * Append-only record of subagent runs. One line per subagent completion.
 * Useful for postmortem analysis (which subagents ran hot, which ones
 * crashed, which patterns correlate with high context use).
 */
async function appendUsageRecord(record) {
  try {
    const dir = join(REPO_ROOT, '.phase-state');
    await fsp.mkdir(dir, { recursive: true });
    const path = join(dir, 'subagent-usage.jsonl');
    const line = JSON.stringify(record) + '\n';
    await fsp.appendFile(path, line, 'utf8');
  } catch (err) {
    process.stderr.write(`[subagent-monitor] failed to append record: ${err && err.message}\n`);
  }
}

function buildWarnBanner(peakTokens, level, agentJsonl, snapshot) {
  const pct = (peakTokens / WINDOW_TOKENS) * 100;
  const lines = [`## Subagent context ${level.toUpperCase()}`];
  if (level === 'alert') {
    lines.push(
      `**Just-completed subagent peaked at ${peakTokens.toLocaleString('en-US')} tokens (${pct.toFixed(2)}% of 1M).** Beyond ${(SUBAGENT_ALERT_TOKENS / 1_000_000) * 100}% threshold — long-context attention quality may have degraded mid-task. Review subagent output critically for mid-run drift; consider re-dispatching with a tighter brief if findings seem inconsistent.`
    );
  } else {
    lines.push(
      `**Just-completed subagent peaked at ${peakTokens.toLocaleString('en-US')} tokens (${pct.toFixed(2)}% of 1M).** Above ${(SUBAGENT_WARN_TOKENS / 1_000_000) * 100}% WARN threshold; below ${(SUBAGENT_ALERT_TOKENS / 1_000_000) * 100}% alert. Acceptable but worth noting — future subagents on similar tasks may benefit from tighter brief scoping.`
    );
  }
  lines.push(
    `Subagent: ${snapshot.turns_count} turns, ${snapshot.cost_usd ? `$${snapshot.cost_usd.toFixed(4)}` : 'cost n/a'}, model ${snapshot.model || 'unknown'}.`
  );
  lines.push(
    `Reference: \`.claude/hooks/subagent-monitor.mjs\`; per-subagent log at \`.phase-state/subagent-usage.jsonl\`.`
  );
  return lines.join('\n\n');
}

async function main() {
  let stdinJson = {};
  try {
    const raw = await readStdin();
    if (raw && raw.trim()) stdinJson = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`[subagent-monitor] bad stdin JSON: ${err && err.message}\n`);
  }

  const toolName = stdinJson.tool_name || stdinJson.toolName || '';
  if (toolName !== 'Agent') {
    // Not an Agent tool call — silent pass-through
    process.stdout.write('{}');
    return;
  }

  const transcriptPath = stdinJson.transcript_path || stdinJson.transcriptPath || null;
  const sessionId = stdinJson.session_id || stdinJson.sessionId || null;

  const subagentsDir = subagentsDirFor(transcriptPath, sessionId);
  const subagentJsonl = findNewestSubagentJsonl(subagentsDir);

  if (!subagentJsonl) {
    process.stderr.write(`[subagent-monitor] no subagent JSONL found under ${subagentsDir}\n`);
    process.stdout.write('{}');
    return;
  }

  const snapshot = await computeUsage(subagentJsonl);
  const peak = snapshot.peak_input_tokens || 0;

  const record = {
    timestamp: new Date().toISOString(),
    parent_session_id: sessionId,
    subagent_jsonl: subagentJsonl.replace(/\\/g, '/'),
    peak_input_tokens: peak,
    pct_of_1M: snapshot.pct_of_1M_context,
    cost_usd: snapshot.cost_usd,
    turns_count: snapshot.turns_count,
    model: snapshot.model,
  };
  await appendUsageRecord(record);

  let level = null;
  if (peak >= SUBAGENT_ALERT_TOKENS) level = 'alert';
  else if (peak >= SUBAGENT_WARN_TOKENS) level = 'warn';

  if (!level) {
    process.stdout.write('{}');
    return;
  }

  const out = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: buildWarnBanner(peak, level, subagentJsonl, snapshot),
    },
  };
  process.stdout.write(JSON.stringify(out));
}

main()
  .catch((err) => {
    process.stderr.write(`[subagent-monitor] fatal: ${err && err.message}\n`);
    try {
      process.stdout.write('{}');
    } catch {
      // ignore
    }
  })
  .finally(() => {
    process.exit(0);
  });
