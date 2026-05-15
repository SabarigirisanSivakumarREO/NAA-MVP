#!/usr/bin/env node
// .claude/hooks/session-banner.mjs
//
// SessionStart hook — fires when Claude Code starts a new session.
// Emits a markdown banner via `additionalContext` showing context-window
// utilization (vs 1M Opus window) and cost (vs phase ceiling).
//
// Contract:
//   stdin  -> JSON: { transcript_path?, session_id?, cwd?, ... }
//   stdout -> JSON: { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "..." } }
//   stderr -> diagnostics only
//
// MUST exit 0 even on internal failures — never break the session.

import { promises as fsp, readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { computeUsage } from './usage-meter.mjs';

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

async function loadJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    const raw = await fsp.readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`[session-banner] failed to read ${path}: ${err && err.message}\n`);
    return fallback;
  }
}

/**
 * Find the most-recently-updated phase state file (.phase-state/<N>.json)
 * representing the "active" phase. Returns { phaseId, ceiling, spent } or null.
 *
 * Heuristic: prefer the one with phase_<N>_complete: false; else most recent mtime.
 */
function findActivePhaseState() {
  const dir = join(REPO_ROOT, '.phase-state');
  if (!existsSync(dir)) return null;
  let candidates;
  try {
    candidates = readdirSync(dir).filter((f) => /^[0-9a-z]+\.json$/i.test(f) && f !== 'cost-config.json' && f !== 'usage-current.json' && f !== 'daily-cost.json');
  } catch (err) {
    return null;
  }
  if (!candidates.length) return null;

  const entries = [];
  for (const f of candidates) {
    const full = join(dir, f);
    try {
      const st = statSync(full);
      const raw = JSON.parse(readFileSync(full, 'utf8'));
      entries.push({ file: f, full, mtime: st.mtimeMs, data: raw });
    } catch (err) {
      // ignore unreadable
    }
  }
  if (!entries.length) return null;

  // Prefer not-complete ones; tiebreak by mtime
  entries.sort((a, b) => {
    const aDone = !!(a.data && (a.data.phase_complete || a.data.complete || a.data.state === 'done'));
    const bDone = !!(b.data && (b.data.phase_complete || b.data.complete || b.data.state === 'done'));
    if (aDone !== bDone) return aDone ? 1 : -1;
    return b.mtime - a.mtime;
  });
  const top = entries[0];
  const data = top.data || {};
  const phaseId = data.phase_id || data.phase || top.file.replace(/\.json$/, '');
  const cost = data.cost || {};
  return {
    phaseId,
    ceiling: typeof cost.phase_ceiling_usd === 'number' ? cost.phase_ceiling_usd : null,
    spent: typeof cost.phase_total_usd === 'number' ? cost.phase_total_usd : null,
  };
}

function formatBanner({ snapshot, costCfg, phase }) {
  const winCfg = costCfg.context || {};
  const window = winCfg.window_size_tokens || 1_000_000;
  const warnTokens = winCfg.warn_tokens || 500_000;
  const stopTokens = winCfg.hard_stop_tokens || 600_000;
  const warnPct = winCfg.warn_pct || 50;
  const stopPct = winCfg.hard_stop_pct || 60;

  const peak = snapshot.peak_input_tokens || 0;
  const pct = window > 0 ? (peak / window) * 100 : 0;
  let ctxStatus = 'CLEAR';
  let ctxIcon = 'OK';
  if (peak >= stopTokens) {
    ctxStatus = 'STOP';
    ctxIcon = 'STOP';
  } else if (peak >= warnTokens) {
    ctxStatus = 'WARN';
    ctxIcon = 'WARN';
  }

  const spend = snapshot.cost_usd || 0;
  const phaseCeiling =
    (phase && phase.ceiling != null ? phase.ceiling : costCfg.cost?.phase_ceiling_usd) || 10.0;
  const phasePausePct = costCfg.cost?.phase_pause_pct || 70;
  const phaseStopPct = costCfg.cost?.phase_stop_pct || 100;
  // session spend is a lower bound for phase spend — use whichever is larger
  const effectivePhaseSpend = Math.max(spend, phase && phase.spent != null ? phase.spent : 0);
  const costPct = phaseCeiling > 0 ? (effectivePhaseSpend / phaseCeiling) * 100 : 0;
  let costStatus = 'CLEAR';
  if (costPct >= phaseStopPct) costStatus = 'STOP';
  else if (costPct >= phasePausePct) costStatus = 'WARN';

  const fmtK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n));
  const phaseLabel = phase ? phase.phaseId : 'none';

  return [
    '## Usage check — Session start',
    '',
    `**Context budget** (Claude Opus 4.7 — 1M token window):`,
    `- Current peak prompt: **${peak.toLocaleString('en-US')} tokens** (${pct.toFixed(2)}% of 1M)`,
    `- WARN threshold: ${fmtK(warnTokens)} (${warnPct}%)`,
    `- HARD STOP threshold: ${fmtK(stopTokens)} (${stopPct}%)`,
    `- Status: **${ctxStatus}** [${ctxIcon}]`,
    '',
    `**Cost** (session-to-date):`,
    `- Spent: **$${spend.toFixed(4)}**`,
    `- Active phase: \`${phaseLabel}\``,
    `- Phase ceiling: $${phaseCeiling.toFixed(2)} (${costPct.toFixed(1)}% used)`,
    `- Status: **${costStatus}**`,
    '',
    `_Turns: ${snapshot.turns_count}  |  Model: ${snapshot.model || 'unknown'}  |  Updated: ${snapshot.computed_at}_`,
    '',
    `Reference: \`.claude/skills/neural-master-orchestrator/references/context-budget.md\`  `,
    `Config: \`.phase-state/cost-config.json\``,
    '',
    ctxStatus === 'STOP'
      ? '**Context HARD STOP active.** Open a fresh session and run `/master <N> --resume`. The next user prompt will be blocked by `usage-guard.mjs`.'
      : ctxStatus === 'WARN'
        ? '**Context WARN.** Plan to wrap at next stage transition; long-context attention quality degrades past 60%.'
        : 'Context budget healthy. Hooks will alert at WARN/STOP automatically.',
  ].join('\n');
}

async function main() {
  let stdinJson = {};
  try {
    const raw = await readStdin();
    if (raw && raw.trim()) stdinJson = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`[session-banner] bad stdin JSON: ${err && err.message}\n`);
  }

  const transcriptPath = stdinJson.transcript_path || stdinJson.transcriptPath || null;
  const snapshot = await computeUsage(transcriptPath);

  const costCfg = await loadJson(join(REPO_ROOT, '.phase-state', 'cost-config.json'), {
    context: { window_size_tokens: 1_000_000, warn_pct: 50, hard_stop_pct: 60, warn_tokens: 500_000, hard_stop_tokens: 600_000 },
    cost: { phase_ceiling_usd: 10, phase_pause_pct: 70, phase_stop_pct: 100, daily_ceiling_usd: 50 },
  });

  let phase = null;
  try {
    phase = findActivePhaseState();
  } catch (err) {
    process.stderr.write(`[session-banner] phase-state scan failed: ${err && err.message}\n`);
  }

  const banner = formatBanner({ snapshot, costCfg, phase });

  const out = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: banner,
    },
  };
  process.stdout.write(JSON.stringify(out));
}

main()
  .catch((err) => {
    process.stderr.write(`[session-banner] fatal: ${err && err.message}\n`);
  })
  .finally(() => {
    // Always exit 0 — never break the session
    process.exit(0);
  });
