---
# ============================================================
# STANDARD FRONTMATTER — copy to the top of every spec artifact
# Governed by Constitution R17 (Lifecycle States) + R18 (Delta)
# ============================================================

# Required fields

title: <artifact title, e.g., "Browser Agent Stealth Enhancement Spec">
artifact_type: <spec | plan | tasks | rollup | impact | matrix | prd | design>
status: draft  # draft | validated | approved | implemented | verified | superseded | archived
version: 0.1
created: 2026-MM-DD
updated: 2026-MM-DD
owner: <name / team>
authors: [<name1>, <name2>]
reviewers: [<name1>, <name2>]

# Versioning relationships (if any)

supersedes: null       # e.g., "v1.0" or null if first version
supersededBy: null     # e.g., "docs/specs/mvp/archive/2026-04-07/spec.md" — set when status → superseded

# Lineage

derived_from:          # list parent artifacts this one was generated or refined from
  - docs/specs/mvp/PRD.md §4
  - docs/specs/final-architecture/07-analyze-mode.md §7.4

# Spec traceability

req_ids:               # REQ-IDs this artifact introduces or implements
  - REQ-BROWSE-STEALTH-001
  - REQ-BROWSE-STEALTH-002

# Cross-cutting change metadata (Rule 20)

impact_analysis: null  # e.g., "docs/specs/mvp/changes/003-stealth/impact.md" — required for cross-cutting changes
breaking: false
affected_contracts: [] # e.g., ["BrowserEngine", "PageStateModel.metadata"]

# Delta (Rule 18) — required on every update

delta:
  new:
    - <what this version adds>
  changed:
    - <what this version modifies + rationale>
  impacted:
    - <downstream artifacts affected>
  unchanged:
    - <major sections preserved>

# Governance

governing_rules:
  - Constitution R17 (Lifecycle)
  - Constitution R18 (Delta)
  # + any rules specifically invoked by this artifact

---

# <Artifact Title>

> **Summary (~150 tokens — agent reads this first):** <concise 2-3 sentence summary of what this artifact covers, its status, and who should read it>

<!-- content begins here -->
