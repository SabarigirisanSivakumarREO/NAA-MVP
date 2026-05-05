#!/usr/bin/env node
/**
 * Neural CLI — cro-audit entry point.
 *
 * Source: docs/specs/mvp/phases/phase-0-setup/{spec,plan,tasks}.md
 *         (T003 + AC-03 + plan §Phase 1 Design item 2).
 *
 * Phase 0 surface: --version (and -v alias) only. Real subcommands
 * (audit, etc.) land in Phase 5+ (T081-T100) and Phase 9 (T156+).
 *
 * Why process.stdout.write (NOT console.log): R10.6 forbids console.log in
 * production server code. Per spec.md §Constraints Inherited, CLI tool
 * stdout is user-facing output, not server-side observability — the
 * permitted path is process.stdout.write directly. Pino remains the sole
 * observability path inside packages/agent-core.
 *
 * Why no commander/yargs in Phase 0: tasks.md T003 §Constraints — keep
 * minimal until Phase 5 subcommand surface forces a proper CLI library.
 */
import pkg from '../package.json' with { type: 'json' };

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
  process.stdout.write(`${pkg.version}\n`);
  process.exit(0);
}

process.stderr.write('Subcommands not yet implemented (Phase 5+).\n');
process.exit(0);
