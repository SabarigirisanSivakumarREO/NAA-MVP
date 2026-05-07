# Diff Reviewer — Forbidden-Pattern + Scope Check

## What this defines

Mechanical review applied by master agent on every subagent diff return. Pattern-grep + structural checks. No judgment — judgment lives in the AI Reviewer skill at gates. This is the per-subagent gate that decides whether to commit the diff or trigger 3-strike retry.

## When master invokes this

After every subagent return during Stage 2 (impl) and any spec patch dispatch. Runs BEFORE master commits the diff.

## Inputs

- Subagent's returned diff (`git diff` output + file list)
- Subagent's allowed-files list from the brief
- Phase + task-id + risk-gate state from `.phase-state/<N>.json`

## Check categories

### 1. Constitutional violations (CRITICAL — always FAIL)

| Pattern | Source rule | Detection |
|---|---|---|
| `console.log` / `console.error` / `console.warn` / `console.info` in production code | R10.6, CLAUDE.md §5 | regex `console\.(log\|error\|warn\|info)\(` outside `tests/`, `scripts/`, CLI stdout paths |
| `--no-verify` / `--no-gpg-sign` in any commit command in diff | CLAUDE.md §6 | git log message scan |
| Heuristic body content outside `heuristics-repo/` | R6.1 | grep `NEURAL_TEST_FIXTURE_BODY` outside designated fixtures + body-shape regex on non-`heuristics-repo/` files |
| Banned phrasing in finding/test data | R5.3 + GR-007 | regex pack: `\b(conversion lift\|%lift\|ROI of\|will increase\|will boost\|N% gain\|revenue forecast)\b` |
| Real heuristic body in test fixtures | R6.1 | sentinel-presence check; non-sentinel bodies in fixture files = FAIL |
| Hardcoded API keys / secrets | NF-04 | grep `sk-[a-zA-Z0-9]{20,}`, `pk_live_`, JWT shape, AWS keys, etc. |
| `process.env.X` outside `apps/cli/src/index.ts` config-load OR designated adapter | R13 | import-graph aware grep |

### 2. Quality violations (HIGH — FAIL by default)

| Pattern | Source rule | Detection |
|---|---|---|
| `: any` without immediately-following `// TODO: type this` comment + tracking issue | R10.4 | regex match unflagged any usage |
| File > 300 lines | R10.1 | line count per touched file |
| Function > 50 lines | R10.2 | AST-estimate (count `{` / `}` paired with function declarations) |
| `export default` | R10.5 | grep `^export default\b` |
| Direct `import` of external package outside `adapters/` | R9 | import path scan; package not in workspace + not under adapters dir = FAIL |
| Commented-out code blocks (≥3 consecutive `// <code>` lines) | R10.7 | heuristic grep |
| `--force` / `--no-verify` git operations | CLAUDE.md §6 | scan |

### 3. Scope violations (CRITICAL — always FAIL)

| Check | Detection |
|---|---|
| Files touched NOT in subagent's `{{ALLOWED_FILES}}` list | set-difference: diff files \ allowed = empty? |
| Files deleted (`=D` mode in git diff) without R10 deletion justification in commit message | filter `=D` lines |
| Spec patch subagent modifying non-spec files | variant mismatch detection |
| Frontmatter `status:` field bumped mid-task (e.g., `draft → approved`) | grep frontmatter status field changes |
| Phase artifact frontmatter `version:` NOT bumped on spec patches | required-bump check |
| Subagent attempts nested dispatch (Agent tool call in returned reasoning) | scan reasoning_log for "dispatched subagent" / "Agent tool" |

### 4. TDD violations (HIGH — FAIL)

| Check | Detection |
|---|---|
| Impl file edited but no test file in same diff | diff stat: `src/` touched, no `tests/` touched |
| Test file added but contains zero `expect()` / `toEqual()` / `toBe()` / `toThrow()` calls | weak-test detection |
| Test file uses `.skip()` on AC-anchored test (test name contains AC-NN) | grep `\.skip\(` near AC-NN |
| Test file added AFTER impl per git log timestamps (test must come first) | commit chronology in diff history |

### 5. Risk-gate mode adjustments

When master state has `risk_gate_mode.active: true` (per [`risk-gate-mode.md`](risk-gate-mode.md)):
- **MED-severity quality violations also FAIL** (normally only HIGH/CRITICAL block)
- **Stricter test-quality threshold:** ≥2 assertions per test (not just ≥1)
- **No `// TODO` exception for `any`:** even with TODO comment, `any` use = FAIL in risk-gate mode
- **Reduced strike count:** 2-strike STOP instead of 3-strike

## Output format

```yaml
diff_review:
  subagent_id: <id>
  task_id: <T-NN>
  files_touched: [<list>]
  files_added: [<list>]
  files_deleted: [<list>]
  
  violations:
    - severity: CRITICAL | HIGH | MED | LOW
      category: constitutional | quality | scope | tdd
      pattern: <which check fired>
      location: <file:line or file:range>
      rule: <R-NN if applicable>
      excerpt: <relevant diff snippet>
      remediation: <one-line hint for subagent retry>
  
  summary:
    critical_count: <N>
    high_count: <N>
    med_count: <N>
    low_count: <N>
  
  verdict: PASS | FAIL
  retry_recommended: true | false
  strike_number: 1 | 2 | 3
  next_action: commit | dispatch_retry | escalate_to_user
```

## Strike protocol

```
On FAIL:
  strike_number = (previous failures on this task) + 1
  
  If strike_number == 1:
    next_action = dispatch_retry
    Master returns brief to subagent with violations list + remediation hints verbatim
  
  If strike_number == 2:
    next_action = dispatch_retry
    Master rephrases brief — adds "PRIOR ATTEMPT FAILED ON: <patterns>" section
    Risk-gate mode: STOP at strike 2 (1 less than normal mode)
  
  If strike_number == 3:
    next_action = escalate_to_user
    Master pauses; renders strike-history summary; awaits user decision
```

Per CLAUDE.md §9 dispatch policy + heuristic-authoring 3-strike precedent (Phase 0b kill criteria).

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Re-implement linter logic | `pnpm lint` + `pnpm typecheck` run separately at Stage 3 verify; this is forbidden-pattern + scope review |
| Skip review on "trivial" diffs | Every diff reviewed; trivial diffs review in <1 sec |
| Auto-fix violations | Subagent retries with feedback; master never edits subagent output |
| Pattern-match too broadly | False positives erode trust; prefer specific regexes; maintain over-matching review log |
| Stack multiple subagent diffs into one review | One subagent, one review; preserves per-task strike count |
| Pass on FAIL because "it's only one MED" | MED + risk-gate = FAIL; outside risk-gate, MED is logged but PASSes |

## False-positive log

If a check fires but master/user judges it incorrect, log to `.phase-state/<N>/diff-review-false-positives.log` for periodic regex tuning. Do NOT silently bypass — always log + override with reason.

## Cross-references

- [`SKILL.md`](../SKILL.md) — master invokes this on every subagent return
- [`templates/subagent-brief.template.md`](../templates/subagent-brief.template.md) — defines what's promised; this enforces it
- [`templates/spec-patch-subagent-brief.template.md`](../templates/spec-patch-subagent-brief.template.md) — variant-specific scope rules
- [`risk-gate-mode.md`](risk-gate-mode.md) — adjustments under high-attention
- `CLAUDE.md` §5 (code style) + §6 (commit format) + §8 (self-check) + §9 (dispatch policy)
- Constitution rules cited per pattern
