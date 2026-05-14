// @ts-check
// ESLint flat config — Phase 4 T073 R9 adapter-boundary enforcement.
//
// Source:
//   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T073 (L141-149)
//   docs/specs/mvp/constitution.md R9 (Adapter Pattern)
//
// # R9 — adapter-boundary `no-restricted-imports`
//
// Vendor SDKs cross the runtime boundary in EXACTLY one file each:
//   - `@anthropic-ai/sdk` → `src/adapters/AnthropicAdapter.ts`
//   - `pg`               → `src/adapters/PostgresStorage.ts` OR `src/db/**`
//   - `drizzle-orm`      → `src/adapters/PostgresStorage.ts` OR `src/db/**`
//
// Everything else must import via the typed adapter surface
// (`@neural/agent-core/adapters`). The default rule blocks the vendor imports;
// the per-file overrides re-allow them in the SOLE legal locations.
//
// Defense-in-depth: this lint rule catches static imports; the grep
// safety-net in `tests/conformance/adapter-boundary.test.ts` catches dynamic
// imports and string-based requires.

import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const VENDOR_IMPORT_RULE = [
  'error',
  {
    paths: [
      {
        name: '@anthropic-ai/sdk',
        message:
          'Import via @neural/agent-core/adapters (LLMAdapter / AnthropicAdapter). ' +
          'AnthropicAdapter.ts is the SOLE legal importer (R9).',
      },
      {
        name: 'pg',
        message:
          'Import via @neural/agent-core/adapters (PostgresStorage) or db/ internals. ' +
          'R9 boundary — only PostgresStorage.ts and db/** may import `pg` at runtime.',
      },
      {
        name: 'drizzle-orm',
        message:
          'Import via @neural/agent-core/adapters or db/. R9 boundary — only ' +
          'PostgresStorage.ts and db/** may import `drizzle-orm` at runtime.',
      },
      {
        name: 'drizzle-orm/node-postgres',
        message:
          'Import via @neural/agent-core/adapters or db/. R9 boundary — only ' +
          'PostgresStorage.ts and db/** may import `drizzle-orm/*` subpaths.',
      },
      {
        name: 'drizzle-orm/pg-core',
        message:
          'Import via @neural/agent-core/adapters or db/. R9 boundary — only ' +
          'PostgresStorage.ts and db/** may import `drizzle-orm/*` subpaths.',
      },
    ],
  },
];

export default [
  {
    // Global ignore — never lint compiled output or vendor packages.
    ignores: ['dist/**', 'node_modules/**', 'tests/**'],
  },
  {
    files: ['src/**/*.ts'],
    linterOptions: {
      // Pre-existing inline `eslint-disable-next-line @typescript-eslint/*`
      // comments target rules this minimal Phase 4 config does not yet
      // activate. Don't warn about unused-disable so the lint stays clean
      // until Wave 9 / later phases expand the rule set.
      reportUnusedDisableDirectives: 'off',
    },
    // Load the @typescript-eslint plugin so existing inline disable
    // directives resolve to a known rule definition (otherwise ESLint
    // raises a 'Definition for rule ... was not found' error).
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      'no-restricted-imports': VENDOR_IMPORT_RULE,
    },
  },
  {
    // Per-file allowance — the 3 legal locations for vendor SDK imports.
    files: [
      'src/adapters/AnthropicAdapter.ts',
      'src/adapters/PostgresStorage.ts',
      'src/db/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
