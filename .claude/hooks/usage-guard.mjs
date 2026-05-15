#!/usr/bin/env node
// .claude/hooks/usage-guard.mjs
//
// UserPromptSubmit hook — fires before each user prompt is processed by the
// model. Inspects the current transcript's cumulative usage and enforces:
//
//   * Context WARN  (peak_input_tokens >= warn_tokens, default 500K)
//   * Context STOP  (peak_input_tokens >= hard_stop_tokens, default 600K) → BLOCKS
//   * Cost  WARN    (cost_usd >= phase_ceiling * phase_pause_pct/100, default 70%)
//   * Cost  STOP    (cost_usd >= phase_ceiling * phase_stop_pct/100, default 100%) → BLOCKS
//
// Contract:
//   stdin  -> JSON: { transcript_path?, prompt?, session_id?, cwd?, ... }
//   stdout -> JSON: one of:
//     { } (silent — clean turn under all thresholds)
//     { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "<warn banner>" } }
//     { decision: "block", reason: "<why>" }  (Claude Code refuses to forward prompt)
//   stderr -> diagnostics only
//
// MUST exit 0 even on internal failure (never break the session).

import { promises as fsp, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
    process.stderr.write(`[usage-guard] failed to read ${path}: ${err && err.message}\n`);
    return fallback;
  }
}

/**
 * Best-effort: find active phase ID + ceiling from the most recently
 * touched .phase-state/<N>.json. Same heuristic as session-banner.
 */
function findActivePhaseState() {
  const dir = join(REPO_ROOT, '.phase-state');
  if (!existsSync(dir)) return null;
  let candidates;
  try {
    candidates = readdirSync(dir).filter(
      (f) =>
        /^[0-9a-z]+\.json$/i.test(f) &&
        f !== 'cost-config.json' &&
        f !== 'usage-current.json' &&
        f !== 'daily-cost.json'
    );
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
      entries.push({ file: f, mtime: st.mtimeMs, data: raw });
    } catch (err) {
      // skip
    }
  }
  if (!entries.length) return null;
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

function classify({ snapshot, costCfg, phase }) {
  const ctxCfg = costCfg.context || {};
  const window = ctxCfg.window_size_tokens || 1_000_000;
  const warnTokens = ctxCfg.warn_tokens || 500_000;
  const stopTokens = ctxCfg.hard_stop_tokens || 600_000;
  const warnPct = ctxCfg.warn_pct || 50;
  const stopPct = ctxCfg.hard_stop_pct || 60;

  const peak = snapshot.peak_input_tokens || 0;
  const last = snapshot.last_turn_input_tokens || 0;
  // Use whichever is larger; "last" represents next-turn baseline.
  const usedForCheck = Math.max(peak, last);

  let ctxLevel = 'clear';
  if (usedForCheck >= stopTokens) ctxLevel = 'stop';
  else if (usedForCheck >= warnTokens) ctxLevel = 'warn';

  const phaseCeiling =
    (phase && phase.ceiling != null ? phase.ceiling : costCfg.cost?.phase_ceiling_usd) || 10.0;
  const phasePausePct = costCfg.cost?.phase_pause_pct || 70;
  const phaseStopPct = costCfg.cost?.phase_stop_pct || 100;
  const phaseSpend = Math.max(snapshot.cost_usd || 0, phase && phase.spent != null ? phase.spent : 0);
  const phasePct = phaseCeiling > 0 ? (phaseSpend / phaseCeiling) * 100 : 0;
  let costLevel = 'clear';
  if (phasePct >= phaseStopPct) costLevel = 'stop';
  else if (phasePct >= phasePausePct) costLevel = 'warn';

  return {
    ctxLevel,
    costLevel,
    metrics: {
      peak,
      last,
      window,
      warnTokens,
      stopTokens,
      warnPct,
      stopPct,
      phaseSpend,
      phaseCeiling,
      phasePct,
      phasePausePct,
      phaseStopPct,
      phaseId: phase ? phase.phaseId : 'none',
    },
  };
}

function buildBlockReason(verdict) {
  const m = verdict.metrics;
  const lines = [];
  if (verdict.ctxLevel === 'stop') {
    lines.push(
      `Context HARD STOP reached: ${m.peak.toLocaleString('en-US')} tokens (${((m.peak / m.window) * 100).toFixed(2)}% of 1M, threshold ${m.stopPct}%).`
    );
    lines.push(
      'LLM long-context attention quality degrades beyond this point. CHECKPOINT NOW: commit any WIP, then open a fresh Claude Code session and run `/master <N> --resume`. State persists across sessions automatically via `.phase-state/<N>.json`.'
    );
  }
  if (verdict.costLevel === 'stop') {
    lines.push(
      `Cost HARD STOP reached: $${m.phaseSpend.toFixed(4)} / $${m.phaseCeiling.toFixed(2)} (${m.phasePct.toFixed(1)}%, phase ${m.phaseId}).`
    );
    lines.push(
      'Bump the phase ceiling with `/master <N> --bump-ceiling phase <new_amount>` or abort with `/master <N> --abort`.'
    );
  }
  lines.push(
    'Reference: `.claude/skills/neural-master-orchestrator/references/context-budget.md` and `cost-ceiling.md`.'
  );
  return lines.join('\n\n');
}

function buildWarnBanner(verdict) {
  const m = verdict.metrics;
  const parts = ['## Usage WARN'];
  if (verdict.ctxLevel === 'warn') {
    parts.push(
      `**Context:** ${m.peak.toLocaleString('en-US')} tokens loaded (${((m.peak / m.window) * 100).toFixed(2)}% of 1M, WARN at ${m.warnPct}%, HARD STOP at ${m.stopPct}%). Plan to wrap at the next stage transition. Long-context attention quality degrades past ${m.stopPct}%.`
    );
  }
  if (verdict.costLevel === 'warn') {
    parts.push(
      `**Cost:** $${m.phaseSpend.toFixed(4)} / $${m.phaseCeiling.toFixed(2)} for phase \`${m.phaseId}\` (${m.phasePct.toFixed(1)}%, pause at ${m.phasePausePct}%). Master will pause at ${m.phaseStopPct}% — finish current stage cleanly.`
    );
  }
  parts.push(
    `If under master orchestrator: checkpoint via handoff doc at next clean break and resume with \`/master <N> --resume\` in a new session. Reference: \`.claude/skills/neural-master-orchestrator/references/context-budget.md\`.`
  );
  return parts.join('\n\n');
}

async function main() {
  let stdinJson = {};
  try {
    const raw = await readStdin();
    if (raw && raw.trim()) stdinJson = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`[usage-guard] bad stdin JSON: ${err && err.message}\n`);
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
    process.stderr.write(`[usage-guard] phase-state scan failed: ${err && err.message}\n`);
  }

  const verdict = classify({ snapshot, costCfg, phase });

  // HARD STOP — block the prompt entirely
  if (verdict.ctxLevel === 'stop' || verdict.costLevel === 'stop') {
    const out = {
      decision: 'block',
      reason: buildBlockReason(verdict),
    };
    process.stdout.write(JSON.stringify(out));
    return;
  }

  // WARN — emit additionalContext banner but allow turn to proceed
  if (verdict.ctxLevel === 'warn' || verdict.costLevel === 'warn') {
    const out = {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: buildWarnBanner(verdict),
      },
    };
    process.stdout.write(JSON.stringify(out));
    return;
  }

  // CLEAR — silent (empty JSON object so Claude Code doesn't error on parse)
  process.stdout.write('{}');
}

main()
  .catch((err) => {
    process.stderr.write(`[usage-guard] fatal: ${err && err.message}\n`);
    // emit empty object so hook doesn't poison the prompt
    try {
      process.stdout.write('{}');
    } catch {
      // ignore
    }
  })
  .finally(() => {
    process.exit(0);
  });
