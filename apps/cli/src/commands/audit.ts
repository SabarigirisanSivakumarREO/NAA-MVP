/**
 * `cro-audit audit --url=<URL>` CLI subcommand.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 T-SKELETON-001.
 *
 * Why raw process.argv parsing (PD-07 option c, locked Session 10
 * 2026-05-05): Phase 0 T003 §Constraints set the precedent — no
 * commander/yargs until Phase 5 (T081-T100) brings the full subcommand
 * surface. Single-flag parsing here is ~6 LOC of `find(a =>
 * a.startsWith('--url='))?.slice(6)`; library swap is trivial later.
 *
 * Why process.stdout.write (NOT console.log): R10.6 forbids console.log in
 * production server code. CLI stdout is user-facing output, not
 * observability — process.stdout.write is the permitted path. Phase 0 T003
 * established this pattern; this subcommand inherits it.
 *
 * Why no Pino at the CLI seam: Pino is the agent-core observability path
 * (R6 channel 1). The orchestrator inside `audit()` uses Pino for
 * correlated structured events; the CLI prints a final human-readable
 * summary line for terminal users.
 *
 * R10 compliance: file ≤ 100 lines.
 */
import { audit, type AuditInput } from '@neural/agent-core/audit';

export interface ParsedArgs {
  url?: string | undefined;
  outputDir?: string | undefined;
}

/**
 * Parse `--url=<value>` and `--output=<value>` from argv. Returns parsed
 * fields; the runner validates required fields. Unknown flags are tolerated
 * (forward-compat with future flags landing in Phase 5+).
 */
export function parseAuditArgs(argv: readonly string[]): ParsedArgs {
  const result: ParsedArgs = {};
  for (const arg of argv) {
    if (arg.startsWith('--url=')) {
      result.url = arg.slice('--url='.length);
    } else if (arg.startsWith('--output=')) {
      result.outputDir = arg.slice('--output='.length);
    }
  }
  return result;
}

/**
 * Run the audit subcommand. Returns the process exit code (0 = success;
 * non-zero = input or runtime failure). Caller is responsible for calling
 * `process.exit(code)` so this function stays testable.
 */
export async function runAudit(argv: readonly string[]): Promise<number> {
  const parsed = parseAuditArgs(argv);

  if (!parsed.url) {
    process.stderr.write('Error: --url=<URL> is required.\n');
    process.stderr.write('Usage: pnpm cro:audit --url=https://example.com [--output=./out]\n');
    return 2;
  }

  try {
    new URL(parsed.url);
  } catch {
    process.stderr.write(`Error: --url='${parsed.url}' is not a valid URL.\n`);
    return 2;
  }

  const input: AuditInput = parsed.outputDir
    ? { url: parsed.url, outputDir: parsed.outputDir }
    : { url: parsed.url };

  try {
    const outcome = await audit(input);
    process.stdout.write(
      [
        `✓ Audit ${outcome.auditRunId} completed in ${outcome.durationMs}ms`,
        `  Findings: ${outcome.findingsCount} grounded, ${outcome.rejectedCount} rejected`,
        `  Wrote: ${outcome.findingsPath}`,
        `  Wrote: ${outcome.reportPath}`,
        '',
      ].join('\n'),
    );
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Audit failed: ${message}\n`);
    return 1;
  }
}
