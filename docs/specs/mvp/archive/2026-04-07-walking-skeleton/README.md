# Archived — 2026-04-07 Walking Skeleton Spec Kit Output

> **Archived:** 2026-04-22
> **Status:** Superseded. Historical reference only.

## Why archived

These files were the original GitHub Spec Kit output from a `/speckit.specify` / `/speckit.plan` / `/speckit.tasks` run on 2026-04-07. They describe the initial "Walking Skeleton" MVP scope:

- 5 pages per audit
- 100 heuristics loaded (filtered to 15-25 per page)
- CLI only (no dashboard)
- 8 grounding rules (GR-001 through GR-008)
- Mode B execution
- $5 audit budget cap
- Local disk + Postgres
- JSON + annotated screenshots output
- No PDF report, no email, no review workflow, no two-store pattern

Between 2026-04-07 and 2026-04-22, the product vision evolved:
- Master plan matured from an initial architecture sketch to v2.3 (38 specs, 263 tasks, 14 perception enrichments)
- MVP target shifted from "walking skeleton to prove the pipeline" to "consultant pilot ready for real client audits"
- Scope grew: 20 pages, 30 authored heuristics with benchmarks, 12 grounding rules (incl. GR-012), Next.js consultant dashboard + Clerk auth, branded PDF report, email notifications, two-store + warm-up, 4D scoring, reproducibility snapshot, token-level cost accounting

The canonical PRD for the new scope lives at `docs/specs/mvp/PRD.md`. When Spec Kit CLI is run against that PRD, it will regenerate fresh `spec.md`, `plan.md`, `tasks.md` in `docs/specs/mvp/`.

## Files in this archive

| File | What it was |
|---|---|
| `spec.md` | Original `/speckit.specify` output — functional + non-functional requirements for Walking Skeleton |
| `plan.md` | Original `/speckit.plan` output — tech stack + 8-phase build order |
| `tasks.md` | Original `/speckit.tasks` output — task breakdown |
| `data-model.md` | Spec Kit per-feature data model stub |
| `quickstart.md` | Spec Kit per-feature quickstart stub |
| `contracts/` | Spec Kit per-feature contracts folder (only README inside) |

## Do not edit

These files are frozen. Reference only. Changes to product requirements go into `docs/specs/mvp/PRD.md`.

## Recovery

If the Walking Skeleton scope is ever needed (e.g., as a genuinely smaller MVP for a time-constrained pilot), re-read these files and extract requirements. Do not revive by copying back into `docs/specs/mvp/` — run fresh Spec Kit CLI against an updated PRD instead.
