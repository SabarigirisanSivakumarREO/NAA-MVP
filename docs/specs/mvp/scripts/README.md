---
status: approved
version: 1.0
governing_rules:
  - Constitution R17-R21
---

# Spec Corpus Management Scripts

> **Purpose:** Automated tooling that enforces Constitution R17-R21 (lifecycle, delta, rollup, impact, traceability). Scripts are specs-as-stubs for MVP; full implementations land in Phase 9 Foundations.

| Script | Command | Purpose | Enforces |
|---|---|---|---|
| `spec-matrix.ts` | `pnpm spec:matrix [--check]` | Regenerate `spec-to-code-matrix.md` from spec corpus + source code + tests | R21 |
| `spec-rollup.ts` | `pnpm spec:rollup --phase <N>` | Scaffold `phase-N-current.md` at phase exit | R19 |
| `spec-size.ts` | `pnpm spec:size` | Scan all spec / plan / task files; flag any > 500 lines or > 5000 tokens with suggested split points | PRD §12.5 + R19.5 |
| `spec-validate.ts` | `pnpm spec:validate` | Verify lifecycle frontmatter present + valid on every artifact; REQ-ID references resolve; impact.md present for cross-cutting PRs | R17, R20 |
| `spec-index.ts` | `pnpm spec:index` | Regenerate INDEX.md files in `phases/`, `templates/`, `scripts/` from directory contents + frontmatter | PRD §6.5 |
| `spec-pack.ts` | `pnpm spec:pack --phase <N>` | Output concatenated `context-pack.md` for phase N (read by agent as single prompt input) | PRD §12.5.2 |

## Status

All 6 scripts are **stubs** for MVP v1.0. Full implementations will land in Phase 9 as part of `docs/specs/mvp/scripts/` package.

Until scripts are implemented:
- **Matrix** — hand-maintained spot-checks; full auto-generation in v1.1
- **Rollup** — manually created from `phase-rollup.template.md` at phase exit
- **Size** — `wc -l` + manual inspection
- **Validate** — manual discipline + PR review
- **Index** — hand-written for now
- **Pack** — manual `cat` + grep

## Implementation spec (for the 6 scripts)

### `spec-matrix.ts`

**Input:** `docs/specs/**/*.md`, `packages/**/*.ts`, `apps/**/*.ts`, `tests/**/*.ts`, `git log`, conformance-test output

**Output:** `docs/specs/mvp/spec-to-code-matrix.md` (regenerated)

**Logic:**
1. Find all `REQ-[A-Z_]+-\d+` patterns in spec corpus → source of record
2. Find all `// REQ-[A-Z_]+-\d+` patterns in source code → implementation
3. Find all `// REQ-[A-Z_]+-\d+` patterns in test files → coverage
4. Read conformance test results from `<coverage-dir>/conformance-results.json` → status
5. Emit Markdown matrix per template

**Check mode:** `pnpm spec:matrix --check` — non-zero exit if:
- Any spec has `status: implemented` or later but no code reference found
- Any code reference has no spec source

### `spec-rollup.ts`

**Input:** phase number, `tasks-v2.md`, `phases/phase-<N>-<name>/tasks.md`

**Output:** `phases/phase-<N>-<name>/phase-<N>-current.md` (scaffolded from template)

**Logic:**
1. Read phase completion status from tasks
2. Populate template sections: active modules, contracts, flows, limitations, open risks
3. Leave manual-fill sections marked `<TO FILL>` for engineering lead to complete
4. Create PR for review

### `spec-size.ts`

**Input:** all `.md` files under `docs/specs/mvp/`

**Output:** stdout table + non-zero exit on violations

**Logic:**
1. Count lines per file
2. Flag files > 500 lines with WARN
3. Flag files > 800 lines with FAIL
4. Suggest split points by scanning for `## ` section headers; recommend split after every ~300 lines at a section boundary

### `spec-validate.ts`

**Input:** all `.md` files under `docs/specs/mvp/`, all `.ts` source

**Output:** validation report + non-zero exit on violations

**Logic:**
1. Parse YAML frontmatter on every file; verify required fields present (R17.1)
2. Check `status` field value is in allowed set (draft | validated | approved | implemented | verified | superseded | archived)
3. Check `delta:` present on any file updated in the last 24 hours (R18)
4. For changed PRs touching shared contracts (R20.1 list): verify a sibling `impact.md` is staged
5. For REQ-IDs referenced in code: verify they exist in a spec file (cross-reference `spec-matrix`)

### `spec-index.ts`

**Input:** target folder path

**Output:** `INDEX.md` in that folder

**Logic:**
1. Walk folder contents
2. Parse frontmatter from every `.md` file
3. Generate decision table: name, status, version, tokens, depends-on, blocks
4. Write INDEX.md with "DO NOT HAND-EDIT — regenerate with pnpm spec:index"

### `spec-pack.ts`

**Input:** phase number

**Output:** stdout (or write to `phases/phase-<N>-<name>/context-pack.md`)

**Logic:**
1. Concatenate (in order): Constitution R1-R21, PRD §10, phase README, phase spec, relevant REQ-ID excerpts from `final-architecture/`, relevant `examples.md` sections
2. Cap output at ~10K tokens; truncate with clear markers if exceeded
3. Output as single `context-pack.md` — consultant or Claude Code pastes into prompt

## When to use which script

| Trigger | Script |
|---|---|
| Starting a new task | `pnpm spec:pack --phase <N>` → feed to prompt |
| PR about to merge | `pnpm spec:validate` → must pass |
| Before phase exit | `pnpm spec:rollup --phase <N>` → produces rollup |
| After phase rollup | `pnpm spec:matrix` → regen matrix |
| Any PR touching shared contracts | impact.md must exist; `pnpm spec:validate` enforces |
| Monthly health check | `pnpm spec:size` → flag any oversized artifacts |

## Dependencies

These scripts share utilities:
- Markdown parser (e.g., `remark` + `remark-frontmatter`)
- File glob (e.g., `fast-glob`)
- TypeScript AST parser for code references (e.g., `ts-morph` or regex for simplicity in MVP)

Version-pinned in `package.json` when implemented.
