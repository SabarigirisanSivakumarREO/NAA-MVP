#!/usr/bin/env node
/**
 * Neural CLI — `cro-audit` entry point.
 *
 * Source: docs/specs/mvp/phases/phase-0-setup/{spec,plan,tasks}.md (T003 +
 *         AC-03) for `--version`; docs/specs/mvp/implementation-roadmap.md
 *         v0.3 §6 T-SKELETON-001 for `--url=` audit routing.
 *
 * Phase 0 surface preserved: `--version` / `-v` prints version + exits 0.
 *
 * Phase 0b+walking-skeleton surface added: `--url=<URL>` runs the audit
 * orchestrator (week 1 stubbed pipeline; weeks 2-12 progressively de-stub
 * each layer per the roadmap §8 promotion table).
 *
 * Why process.stdout.write (NOT console.log): R10.6 forbids console.log in
 * production server code. Per Phase 0 T003 §Constraints Inherited, CLI
 * stdout is user-facing output — process.stdout.write is the permitted
 * path. Pino remains the sole observability path inside agent-core.
 *
 * Why no commander/yargs (PD-07 option c, locked Session 10 2026-05-05):
 * raw process.argv parsing is sufficient through walking-skeleton; Phase 5
 * subcommand surface (T081-T100) is the right time to introduce a CLI
 * library — not week 1.
 */
import pkg from '../package.json' with { type: 'json' };
import { runAudit } from './commands/audit.js';

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
  process.stdout.write(`${pkg.version}\n`);
  process.exit(0);
}

const hasUrlFlag = args.some((arg) => arg.startsWith('--url='));

if (hasUrlFlag) {
  runAudit(args)
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Unhandled error: ${message}\n`);
      process.exit(1);
    });
} else {
  process.stderr.write('Error: --url=<URL> is required.\n');
  process.stderr.write('Usage: pnpm cro:audit --url=https://example.com [--output=./out]\n');
  process.exit(2);
}
