# MVP Quickstart Guide

## Setting Up the Development Environment

This guide gets you from "empty repo" to "running the audit CLI" in about 30 minutes.

---

## Prerequisites

| Tool | Version | Install Command |
|------|---------|----------------|
| Node.js | 22 LTS | https://nodejs.org/ |
| pnpm | 9.x | `npm install -g pnpm` |
| Docker | Latest | https://docker.com/ |
| Git | Any | https://git-scm.com/ |
| Anthropic API key | Active | https://console.anthropic.com/ |

---

## Step 1: Clone and Initialize

```bash
# Clone (or create) the empty repo
mkdir ai-cro-audit && cd ai-cro-audit
git init

# Copy the spec into the repo
mkdir -p docs/specs
cp -r /path/to/final-architecture docs/specs/
cp -r /path/to/mvp docs/specs/

# Initialize git
git add docs/
git commit -m "docs: initial architecture and MVP spec"
```

---

## Step 2: Open in Claude Code

```bash
claude
```

In Claude Code:

```
> Read docs/specs/mvp/README.md
> Read docs/specs/mvp/constitution.md
> Read docs/specs/mvp/spec.md
> Read docs/specs/mvp/plan.md
> Acknowledge you understand the engineering rules and MVP scope
```

Wait for Claude Code to confirm understanding before proceeding.

---

## Step 3: Execute Setup Tasks

```
> Execute task T001 from docs/specs/mvp/tasks.md
```

Claude Code will:
1. Read T001 task definition
2. Initialize the monorepo (package.json, pnpm-workspace.yaml, turbo.json)
3. Run smoke test (`pnpm install`)
4. Report completion

```
> Verify T001 smoke test passes
> Commit with message: "chore: T001 initialize monorepo"
> Execute task T002
```

Continue through T001-T005 (setup phase).

---

## Step 4: Configure Environment

```bash
# Copy env template
cp .env.example .env

# Edit .env with your values
# At minimum, set:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cro_audit_dev
ANTHROPIC_API_KEY=sk-ant-...
HEURISTIC_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

---

## Step 5: Start PostgreSQL

```bash
docker-compose up -d

# Verify it's running
docker-compose ps

# Should see: postgres running on port 5432
```

---

## Step 6: Run Database Migrations

```bash
# After T070 (Phase 4) is complete, this will work:
pnpm db:migrate

# Verify tables exist
psql $DATABASE_URL -c "\dt"
# Should see: clients, audit_runs, findings, screenshots, sessions, audit_log, rejected_findings
```

---

## Step 7: Run the Test Suite

```bash
# Unit tests
pnpm test

# Integration tests (requires Postgres + browser)
pnpm test:integration

# Specific phase test
pnpm test phase1
```

---

## Step 8: Run Your First Audit

After T148 (Phase 8 acceptance test) is complete:

```bash
# Simplest possible test
pnpm cro:audit --url https://example.com --pages 1

# Expected output:
# ✓ Audit started: a1b2c3d4
# ✓ Page 1/1: https://example.com (10s, 2 findings)
# ✓ Audit complete: 2 findings, $0.45, 12s
# ✓ Output saved to ./output/audit-a1b2c3d4/
```

---

## Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests |
| `pnpm test:integration` | Run integration tests |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Drizzle Studio (DB GUI) |
| `pnpm cro:audit --url X` | Run an audit |
| `docker-compose up -d` | Start Postgres |
| `docker-compose down` | Stop Postgres |
| `docker-compose logs -f postgres` | Watch DB logs |

---

## Directory Structure (after T001-T005)

```
ai-cro-audit/
├── docs/
│   └── specs/
│       ├── final-architecture/
│       └── mvp/
├── packages/
│   └── agent-core/
│       ├── src/
│       │   └── index.ts
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   └── cli/
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── docker-compose.yml
├── .env.example
├── .env (gitignored)
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## Troubleshooting

### "pnpm: command not found"

```bash
npm install -g pnpm
```

### "Cannot connect to PostgreSQL"

```bash
# Check Docker is running
docker ps

# Check port 5432 is free
lsof -i :5432   # macOS/Linux
netstat -ano | findstr :5432   # Windows

# Restart Postgres
docker-compose down && docker-compose up -d
```

### "ANTHROPIC_API_KEY not set"

```bash
# Check .env exists and has the key
cat .env | grep ANTHROPIC

# Reload env in your shell
source .env   # bash/zsh
```

### "Playwright browser not installed"

```bash
cd packages/agent-core
pnpm exec playwright install chromium
```

### "Audit fails on amazon.in"

Expected during early development. Test with simpler sites first:

```bash
pnpm cro:audit --url https://example.com
pnpm cro:audit --url https://news.ycombinator.com
```

---

## Working with Claude Code

### Session Handover

When starting a new Claude Code session, paste this:

```
Project: AI CRO Audit System MVP
Source of truth: docs/specs/mvp/ + docs/specs/final-architecture/
Constitution: docs/specs/mvp/constitution.md (READ THIS FIRST)
Current task: [check tasks.md for what's next]

Read these in order:
1. docs/specs/mvp/constitution.md
2. docs/specs/mvp/spec.md
3. docs/specs/mvp/tasks.md (find current task)
4. The relevant section from docs/specs/final-architecture/

Then ask: "Which task should I work on next?"
```

### When Claude Code Drifts

```
> Stop. Re-read docs/specs/mvp/constitution.md rule [X]
> Re-read the source spec for this component
> Compare your implementation against the REQ-IDs
> Fix any deviations
```

### When You Want to Ship a Phase

```
> Run all tests for Phase [N]
> Verify all exit gate criteria from docs/specs/final-architecture/16-implementation-phases.md
> If all passing, commit with message: "feat: complete Phase [N] - [name]"
> Move to Phase [N+1]
```

---

## Daily Workflow

```
Morning:
1. Pull latest from git
2. Start Docker (postgres)
3. Open Claude Code
4. Paste session handover prompt
5. Pick up next task from tasks.md

During work:
- One task at a time
- Commit after each task passes its smoke test
- If blocked, ASK before improvising

Evening:
1. Push commits
2. Stop Docker (optional)
3. Update tasks.md if you completed any tasks
```

---

## You're Ready

Once you've completed Steps 1-7, you have a working development environment. From here, work through `tasks.md` task by task with Claude Code as your pair programmer.

The constitution rules are non-negotiable. The spec is the source of truth. Trust the process — the architecture has been designed to prevent the most common failure modes.

Good luck building.
