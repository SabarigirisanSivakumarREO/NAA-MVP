# Categorical Surfaces — Identification Methodology

## What this file is

Methodology for identifying categorical surfaces in phase artifacts and enumerating their universe **dynamically**. Not a hardcoded reference list.

## What this file is NOT

- NOT a complete list of categorical surfaces in Neural
- NOT a complete list of providers / types / formats / engines / patterns
- NOT a substitute for AI-driven enumeration

If you find yourself reaching for this file expecting an enumeration table — stop. The discipline is to enumerate dynamically using domain knowledge plus citations.

## What is a "categorical surface"

A function or feature that handles a CATEGORY of inputs where:
- The category has multiple known members (typically >5)
- The implementation must dispatch differently per member
- Missing a member = silent failure in production (no test fires; just doesn't handle the case)

Categorical surfaces are where **completeness review** matters most. Tests catch wrong code; only judgment review catches missing scope.

## Identification patterns (when to fire completeness audit)

A function/feature in the phase artifact is a categorical surface if ANY signal fires:

| Signal | Where it appears |
|---|---|
| Vague enumeration | Spec uses "supported", "known", "common", "popular", "various" without listing |
| String-literal switch | Implementation has `switch(x)` / `match(x)` on string keys |
| Sparse fixtures | Test fixtures cover <5 cases for a domain with broader real-world scope |
| Categorical naming | Function name implies category — `*Provider`, `*Format`, `*Engine`, `*Type`, `*Kind`, `*Strategy`, `*Handler` |
| Strategy / registry pattern | Spec defers to a registry without listing registered entries |
| Generic fallback | Code has a "default" / "generic" / "unknown" branch hinting that not all cases are enumerated |
| Open-ended verb in spec | "dismiss banners", "handle errors", "detect overlays" — verb implies multiple cases without listing |

If ≥1 signal fires → identify as categorical surface. Run completeness audit per [`completeness-audit.md`](completeness-audit.md).

## Universe enumeration discipline

For each identified surface, AI auditor MUST:

1. **Enumerate from training-data domain knowledge.** Use what you know about the domain. Do NOT consult this file for the answer.

2. **Cite source per entry.** Acceptable sources:
   - Publisher / vendor name (for products)
   - Market-share data with year (for ranked enumerations)
   - Standards body / RFC / W3C / IETF spec (for protocols)
   - Trade publication / industry registry (for catalogs)
   - Constitutional rule / Neural-internal spec (for project-specific categories)

3. **Mark confidence per enumeration.**
   - `HIGH` — well-known canonical list (e.g., HTTP status codes, RFC-defined enums)
   - `MED` — best-effort recall from training data (e.g., top vendors by market share)
   - `LOW` — uncertain; recommend web search if available, else flag as `LOW_CONFIDENCE_ENUMERATION`

4. **Adversarial critic challenges enumeration** per [`completeness-audit.md`](completeness-audit.md) Pass 2 protocol. Critic demands citation per entry and probes for missing cases.

## ONE worked example

**EXAMPLE — DO NOT USE AS COMPLETE LIST.** Reference for FORMAT only. AI auditor must produce its own enumeration per surface, per phase, per audit.

```yaml
phase: 5b
surface_name: cookie_consent_providers
identification_trigger:
  source: phase-5b-multi-viewport-triggers-cookie/spec.md AC-19
  excerpt: "OverlayDismisser dismisses cookie banners using known patterns"
  signals_fired:
    - vague_enumeration ("known patterns")
    - open_ended_verb ("dismiss banners")

auditor_enumeration:
  confidence: MED
  source_class: market_share_recall_with_publisher_names
  source_year_recall: 2026
  cases:
    # AI auditor produces its own list here. The example does not enumerate
    # specific vendors because doing so would create the exact anti-pattern
    # this file forbids — a hardcoded universe.
    # Format per entry:
    #   - id: <kebab-case-name>
    #     source: <publisher | market-share data | RFC | etc.>
    #     confidence: HIGH | MED | LOW
  caveats: |
    Recall-based enumeration. Web search recommended to verify current
    top providers by market share. Long-tail providers (each <1% share)
    intentionally not enumerated; covered by generic fallback per spec.

critic_pass:
  # See completeness-audit.md Pass 2 for critic protocol.
  # Critic challenges: cited sources verifiable? cases missed? hallucinated?
```

[END EXAMPLE]

The example shows **structure and discipline** — not content to copy.

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Read this file for "the list" of any category | Enumerate dynamically using training-data recall + citations |
| Anchor on the example's enumeration shape | Treat example as format reference only |
| Skip enumeration if "list seems standard" | Always enumerate; cite source even for canonical lists |
| Trust AI's first-pass list without challenge | Pass 2 critic must demand citations and probe for missing cases |
| Hardcode market-share rankings in this file | Recall + cite source year per audit; rankings drift |
| Add new surface entries to this file as they're discovered | Surface identification is dynamic; signals in this file stay generic |

## Cross-references

- [`completeness-audit.md`](completeness-audit.md) — auditor + critic prompt definitions and verdict synthesis
- [`SKILL.md`](../SKILL.md) — entry point and gate triggers
- `docs/specs/mvp/constitution.md` R5.6 — separate-persona pattern (auditor vs critic)
- `docs/specs/mvp/PRD.md` §10.10 — comprehension-debt pacing (why dynamic enumeration matters)
