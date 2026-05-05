/**
 * Phase 0 — Setup acceptance test (R3.1 TDD scaffold)
 *
 * Source: docs/specs/mvp/phases/phase-0-setup/spec.md AC-01..AC-05
 *         docs/specs/mvp/phases/phase-0-setup/tasks.md T-PHASE0-TEST
 *
 * Why this exists: per R3.1 (TDD discipline), every acceptance criterion is
 * encoded as an executable test BEFORE any implementation lands. Each test()
 * block maps 1:1 to one AC-NN; tests transition FAIL -> PASS as T001-T005
 * implement the corresponding pieces.
 *
 * Cross-platform note: shell commands run via child_process.execSync. On
 * Windows the PATH is inherited from the parent shell; pnpm + docker must be
 * on PATH for these tests to function. Test runner is @playwright/test
 * (added to root package.json devDeps in T001).
 *
 * Spec drift note (AC-05): spec.md cites DATABASE_URL but pre-existing
 * .env.example (authored 2026-04-24, before the spec) uses POSTGRES_URL.
 * The required-key regex accepts either name pending T005 spec patch.
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = resolve(__dirname, '..', '..');

function shell(cmd: string, opts: { timeoutMs?: number } = {}): string {
  return execSync(cmd, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: opts.timeoutMs ?? 30_000,
  });
}

test.describe('Phase 0 — Setup acceptance (AC-01..AC-05)', () => {
  test('AC-01: pnpm install succeeds; pnpm-workspace.yaml + turbo pipelines defined; tsconfig at root', () => {
    expect(existsSync(join(REPO_ROOT, 'package.json')), 'root package.json missing').toBe(true);
    expect(existsSync(join(REPO_ROOT, 'pnpm-workspace.yaml')), 'pnpm-workspace.yaml missing').toBe(true);
    expect(existsSync(join(REPO_ROOT, 'turbo.json')), 'turbo.json missing').toBe(true);
    expect(existsSync(join(REPO_ROOT, 'tsconfig.json')), 'root tsconfig.json missing').toBe(true);

    const workspace = parseYaml(readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8')) as {
      packages?: string[];
    };
    expect(workspace.packages, 'pnpm-workspace.yaml#packages must declare workspaces').toBeDefined();
    expect(workspace.packages).toEqual(expect.arrayContaining(['packages/*', 'apps/*']));

    const turbo = JSON.parse(readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf8')) as {
      pipeline?: Record<string, unknown>;
      tasks?: Record<string, unknown>;
    };
    // Turborepo 2.x renamed `pipeline` -> `tasks`; accept either for forward compatibility
    const pipelines = turbo.tasks ?? turbo.pipeline;
    expect(pipelines, 'turbo.json must define pipelines (tasks or pipeline)').toBeDefined();
    for (const required of ['build', 'lint', 'typecheck', 'test']) {
      expect(pipelines).toHaveProperty(required);
    }

    // pnpm install must succeed against the lockfile committed in T001
    expect(() => shell('pnpm install --frozen-lockfile', { timeoutMs: 120_000 })).not.toThrow();
  });

  test('AC-02: pnpm build compiles agent-core; Vitest configured; adapters + observability scaffolded', () => {
    const agentCore = join(REPO_ROOT, 'packages/agent-core');
    expect(existsSync(join(agentCore, 'package.json')), 'agent-core package.json missing').toBe(true);
    expect(existsSync(join(agentCore, 'tsconfig.json')), 'agent-core tsconfig.json missing').toBe(true);
    expect(existsSync(join(agentCore, 'vitest.config.ts')), 'agent-core vitest.config.ts missing').toBe(true);
    expect(existsSync(join(agentCore, 'src/index.ts')), 'agent-core src/index.ts missing').toBe(true);
    expect(existsSync(join(agentCore, 'src/adapters/README.md')), 'R9 adapter boundary marker missing').toBe(true);
    expect(existsSync(join(agentCore, 'src/observability/logger.ts')), 'Pino logger skeleton missing').toBe(true);
    expect(existsSync(join(agentCore, 'src/observability/index.ts')), 'observability barrel missing').toBe(true);

    expect(() => shell('pnpm -F @neural/agent-core build', { timeoutMs: 90_000 })).not.toThrow();
    // Vitest with zero tests must exit 0 (placeholder for TDD-first phases — spec.md AC-02)
    expect(() => shell('pnpm -F @neural/agent-core test --passWithNoTests || pnpm -F @neural/agent-core test', { timeoutMs: 60_000 })).not.toThrow();
  });

  test('AC-03: pnpm cro:audit --version prints semver and exits 0', () => {
    expect(existsSync(join(REPO_ROOT, 'apps/cli/package.json')), 'apps/cli/package.json missing').toBe(true);
    expect(existsSync(join(REPO_ROOT, 'apps/cli/src/index.ts')), 'apps/cli/src/index.ts missing').toBe(true);

    // pnpm -s suppresses script-execution headers; captured stdout is exactly
    // what the CLI itself prints — the contract users would script against.
    const stdout = shell('pnpm -s cro:audit --version', { timeoutMs: 30_000 });
    // Semver: <major>.<minor>.<patch> with optional pre-release/build metadata
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
  });

  test('AC-04: docker compose brings Postgres healthy; pgvector extension queryable', () => {
    expect(existsSync(join(REPO_ROOT, 'docker-compose.yml')), 'docker-compose.yml missing').toBe(true);

    // --wait blocks until healthcheck reports healthy (Compose v2.17+); 60s budget per spec NF-Phase0-03
    expect(() => shell('docker compose up -d --wait postgres', { timeoutMs: 60_000 })).not.toThrow();

    // Verify pgvector extension exists; -tA = tuples-only + unaligned (no formatting); -c = single command
    const result = shell(
      `docker compose exec -T postgres psql -U neural -d neural -tAc "SELECT extversion FROM pg_extension WHERE extname='vector'"`,
      { timeoutMs: 15_000 },
    );
    expect(result.trim(), 'pgvector must report a non-null version').toMatch(/^\d+\.\d+/);
  });

  test('AC-05: .env.example documents all required keys; .env gitignored; pnpm db:migrate verifies pgvector', () => {
    expect(existsSync(join(REPO_ROOT, '.env.example')), '.env.example missing').toBe(true);
    expect(existsSync(join(REPO_ROOT, '.gitignore')), '.gitignore missing').toBe(true);

    const envExample = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');
    // Required keys per spec.md AC-05 + tasks.md T005. Spec drift: pre-existing
    // scaffolding uses POSTGRES_URL; spec cites DATABASE_URL. Accept either.
    const requiredKeys: Array<{ name: string; pattern: RegExp }> = [
      { name: 'POSTGRES_URL or DATABASE_URL', pattern: /^(POSTGRES_URL|DATABASE_URL)=/m },
      { name: 'ANTHROPIC_API_KEY', pattern: /^ANTHROPIC_API_KEY=/m },
      { name: 'R2_ACCOUNT_ID', pattern: /^R2_ACCOUNT_ID=/m },
      { name: 'R2_ACCESS_KEY_ID', pattern: /^R2_ACCESS_KEY_ID=/m },
      { name: 'R2_SECRET_ACCESS_KEY', pattern: /^R2_SECRET_ACCESS_KEY=/m },
      { name: 'R2_BUCKET', pattern: /^R2_BUCKET=/m },
      { name: 'CLERK_PUBLISHABLE_KEY', pattern: /^CLERK_PUBLISHABLE_KEY=/m },
      { name: 'CLERK_SECRET_KEY', pattern: /^CLERK_SECRET_KEY=/m },
      { name: 'RESEND_API_KEY', pattern: /^RESEND_API_KEY=/m },
      { name: 'REDIS_URL', pattern: /^REDIS_URL=/m },
    ];
    for (const { name, pattern } of requiredKeys) {
      expect(envExample, `.env.example must document ${name}`).toMatch(pattern);
    }

    const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8');
    expect(gitignore, '.gitignore must list .env').toMatch(/^\.env(\s|$)/m);

    expect(existsSync(join(REPO_ROOT, 'scripts/db-migrate-stub.mjs')), 'scripts/db-migrate-stub.mjs missing').toBe(true);

    const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(rootPkg.scripts?.['db:migrate'], 'package.json#scripts.db:migrate must be defined').toBeTruthy();

    // Stub script must connect to Postgres + report pgvector version (depends on AC-04 having brought up postgres)
    const stubOut = shell('pnpm db:migrate', { timeoutMs: 30_000 });
    expect(stubOut, 'db:migrate must report OK pgvector vN.N.N').toMatch(/OK pgvector v\d+\.\d+/);
  });
});
