# Section 2 — Architecture Decisions & Tech Stack

## 2.1 Locked Decisions (25)

### System-Level Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| SD-01 | **Dual-mode architecture** (browse + analyze) | Browse handles navigation/interaction. Analyze handles CRO evaluation. Different concerns, different tools, one orchestrator. |
| SD-02 | **Subgraph pattern** (browse graph + analyze graph inside audit orchestrator) | LangGraph.js native. Each mode is independently testable. Orchestrator controls switching. |
| SD-03 | **Heuristics as JSON data, not code** | CRO team maintains heuristics independently. Adding rules = adding JSON entries, not engineering work. |
| SD-04 | **Heuristics in separate private repo** | IP protection. CRO team owns. Compiled into app at build time. Never exposed to clients. |
| SD-05 | **3 reliability tiers** on heuristics | Research proves visual/structural >75% reliable, emotional <40%. Tier determines auto-publish eligibility. |
| SD-06 | **Evidence grounding is deterministic code, NOT LLM** | Code validates facts (element exists, measurement matches). LLMs validate reasoning. Different jobs. |
| SD-07 | **Self-critique as separate LLM call** | LLM is better at critiquing than generating. Separate call prevents confirmation bias. |
| SD-08 | **Never predict conversion impact** | WiserUI-Bench: unreliable. State violations + cite research + recommend fixes. |
| SD-09 | **Pairwise comparison for competitors** | Absolute scoring unreliable. "Client vs competitor on CTA placement" is reliable. |
| SD-10 | **Confidence-based review gate** (dual-mode: chatbot + dashboard) | Chatbot: all returned with caveats. Dashboard: tiered gate (auto/24hr/held). |
| SD-11 | **Adapter pattern for all external dependencies** | Swap any technology without changing business logic. |
| SD-12 | **Client isolation via PostgreSQL RLS** | Row-level security. One database, zero data leakage risk. |
| SD-13 | **Max 50 pages per audit** | Prevents cost explosion. Configurable per client. |
| SD-14 | **LLM-based competitor detection** | No external API dependency for MVP. Manual override available. |

### Browser Agent Decisions (from v3.1)

| # | Decision | Rationale |
|---|----------|-----------|
| BA-01 | **TypeScript 5.x** | Type safety, Zod schemas, LangGraph.js compatibility |
| BA-02 | **LangGraph.js** | State graph with conditional routing, checkpointing, interrupt() |
| BA-03 | **Playwright + stealth plugin** | Best browser automation library + anti-detection |
| BA-04 | **PostgreSQL + pgvector** | Checkpointing, memory, semantic search, audit in one DB |
| BA-05 | **LLM Adapter pattern** | Swap Anthropic/OpenAI/Gemini without graph changes |
| BA-06 | **AX-tree primary perception** | Cheaper, more reliable than vision-only |
| BA-07 | **3 execution modes** (Deterministic/Guided/Computer-Use) | Cost optimization: $0 / ~$0.10 / ~$0.30 per step |
| BA-08 | **Hard safety gates** | Not LLM-discretionary — enforced at graph level |
| BA-09 | **Monorepo** | `apps/` + `packages/` with shared types |
| BA-10 | **Confidence-based completion** | Multiplicative decay. Prevents premature task abandonment. |
| BA-11 | **MCP-native tool interface** | Access 5,000+ community servers, standardized discovery |
| BA-12 | **Docker isolation (production)** *(coverage gap fix — from v3.1 AD-10)* | Container per audit run for security. Prevents cross-tenant browser state leakage. Playwright context isolated per container. |

## 2.2 Deferred Decisions (6)

| # | Decision | Defer Until |
|---|----------|-------------|
| DD-01 | Multi-agent coordination (parallel page analysis) | After MVP — Phase 12+ |
| DD-02 | Vector search for heuristic retrieval | When heuristic count exceeds 500 |
| DD-03 | Custom fine-tuned model for CRO evaluation | After collecting 1,000+ grounded findings |
| DD-04 | Multi-browser support (Firefox/WebKit) | After Chromium stable |
| DD-05 | Kubernetes orchestration | If scale exceeds 100 audits/week |
| DD-06 | Automated heuristic weight calibration | After 6 months of consultant feedback data |
| DD-07 | **Multi-model evaluation** *(G5 coverage gap fix — from Analysis v1.0 DA-02)* — use different LLMs for evaluate vs self-critique to reduce confirmation bias | After MVP validation. The LLMAdapter already supports per-call model selection; this decision is about whether to EXERCISE that capability by default. Rationale for deferral: adds cost complexity + requires paired evaluation to prove critique quality improves with a different model. |

## 2.3 Complete Tech Stack (Locked)

### Core Runtime

| Component | Technology | Version | License | Cost |
|-----------|-----------|---------|---------|------|
| Language | TypeScript | 5.x | MIT | Free |
| Runtime | Node.js | 22 LTS | MIT | Free |
| Monorepo | Turborepo + pnpm | Latest | MIT | Free |
| Validation | Zod | 3.x | MIT | Free |

### Browser Agent

| Component | Technology | Version | License | Cost |
|-----------|-----------|---------|---------|------|
| Browser automation | Playwright | Latest | Apache 2.0 | Free |
| Anti-detection | playwright-extra + stealth | Latest | MIT | Free |
| Mouse behavior | ghost-cursor | Latest | MIT | Free |
| Orchestration | LangGraph.js | Latest | MIT | Free |
| MCP SDK | @modelcontextprotocol/sdk | Latest | MIT | Free |

### LLM

| Component | Technology | Cost |
|-----------|-----------|------|
| Primary LLM | Claude Sonnet 4 (Anthropic) | ~$3/M input, ~$15/M output |
| Fallback LLM | GPT-4o (OpenAI) | ~$2.50/M input, ~$10/M output |
| LLM adapter | Custom interface | Free |
| LLM tracing | LangSmith | ~$39/mo |

### Data

| Component | Technology | Version | License | Cost |
|-----------|-----------|---------|---------|------|
| Database | PostgreSQL | 16 | PostgreSQL License | Free |
| Vector search | pgvector | 0.7+ | PostgreSQL License | Free |
| ORM | Drizzle ORM | Latest | MIT | Free |
| Cache | Redis (Upstash prod / Docker dev) | 7 | BSD | ~$0-10/mo |
| Job queue | BullMQ | Latest | MIT | Free |
| Screenshot storage | Cloudflare R2 | N/A | Proprietary | Free tier |

### API & Server

| Component | Technology | Version | License | Cost |
|-----------|-----------|---------|---------|------|
| API framework | Hono | 4.x | MIT | Free |
| Streaming | SSE (native) | N/A | N/A | Free |

### Frontend

| Component | Technology | Version | License | Cost |
|-----------|-----------|---------|---------|------|
| Dashboard framework | Next.js | 15 (App Router) | MIT | Free |
| UI components | shadcn/ui | Latest | MIT | Free |
| Styling | Tailwind CSS | 3.x / 4.x | MIT | Free |

### Auth & Security

| Component | Technology | Cost |
|-----------|-----------|------|
| Authentication | Clerk | ~$25/mo |
| Heuristic encryption | AES-256-GCM (Node.js crypto) | Free |

### Image Processing

| Component | Technology | License | Cost |
|-----------|-----------|---------|------|
| Screenshot annotation | Sharp | Apache 2.0 | Free |

### Observability

| Component | Technology | Cost |
|-----------|-----------|------|
| LLM tracing | LangSmith | ~$39/mo |
| Error tracking | Sentry | Free tier |
| Queue monitoring | Bull Board | Free |
| Logging | Pino (structured JSON) | Free |

### Testing

| Component | Technology | License | Cost |
|-----------|-----------|---------|------|
| Unit tests | Vitest | MIT | Free |
| Integration tests | Playwright Test | Apache 2.0 | Free |

### Deployment

| Component | Technology | Cost |
|-----------|-----------|------|
| Dev environment | Docker Compose | Free |
| Production (API + workers) | Fly.io | ~$20-50/mo |
| Production (dashboard) | Vercel | Free tier / ~$20/mo |
| CI/CD | GitHub Actions | Free tier |

### Total Monthly Cost

| Category | Cost |
|----------|------|
| LLM API (Anthropic + OpenAI) | ~$200-400 |
| LangSmith | ~$39 |
| Clerk | ~$25 |
| Fly.io (API + workers) | ~$20-50 |
| Vercel (dashboard) | ~$0-20 |
| Upstash Redis | ~$0-10 |
| Cloudflare R2 | ~$0 |
| Sentry | ~$0 |
| **Total** | **~$350-600/mo** |
