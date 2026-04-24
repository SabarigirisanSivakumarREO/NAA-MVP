---
status: approved
version: 1.0
lifecycle_authority: Constitution R17-R21 (v1.1)
---

# Spec Artifact Templates

> **Purpose:** Canonical templates for every spec artifact governed by Constitution R17-R21. Use these to produce consistent, lifecycle-managed, traceable artifacts.

Every artifact in our spec corpus falls into one of these templates. Copy the template, fill in the fields, and commit. CI enforces frontmatter presence (Rule 17.1) and matrix coverage (Rule 21.3).

## Templates in this folder

| Template | Purpose | Governing rule |
|---|---|---|
| `frontmatter-lifecycle.template.md` | YAML frontmatter block required on every artifact | R17.1, R17.5 |
| `impact.template.md` | Impact analysis for cross-cutting changes | R20 |
| `phase-rollup.template.md` | Phase-exit system state snapshot | R19 |
| `system-current.template.md` | Live compressed current-system view | R17 concept, §12 PRD |
| `spec-to-code-matrix.template.md` | Auto-generated traceability matrix format | R21 |

## Usage

### Creating a new artifact

1. Pick the relevant template
2. Copy it to the target location (e.g., `docs/superpowers/specs/2026-MM-DD-<feature>.md`)
3. Fill in frontmatter: `status: draft`, `version: 0.1`, author, date
4. Write content
5. When ready for review: commit with `docs(spec): draft <feature> spec`
6. After review: owner updates frontmatter to `status: validated`
7. After approval: PR reviewer updates to `status: approved` + merges

### Updating an existing artifact

1. Load current artifact
2. Update content
3. Update frontmatter: bump `version`, add `delta:` block per R18
4. Commit with `docs(spec): <type> <section> (<REQ-ID>)`
5. If superseding an older version: mark old as `status: superseded` + add `supersededBy: <path>` pointer

### Rules summary

- R17: every artifact has a lifecycle state
- R18: every update has a delta entry
- R19: every phase produces a rollup before next phase begins
- R20: every cross-cutting change has an impact.md
- R21: every REQ-ID appears in the spec-to-code matrix

See `docs/specs/mvp/constitution.md` §17-21 for full rules.
