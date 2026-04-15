# Section 14 — Delivery Layer

## 14.1 CRO Audit MCP Server

**REQ-DELIVERY-001:** Exposes audit findings to LLMs via MCP protocol. Client-isolated via API key scoping.

### MCP Tools Exposed

| Tool | Description | Parameters |
|------|------------|-----------|
| `cro_get_audit_summary` | Get summary of latest audit for a client | `{ client_id }` |
| `cro_get_findings` | Get findings with filters | `{ client_id, audit_version?, severity?, category?, page_url?, status? }` |
| `cro_get_finding_detail` | Get single finding with full evidence | `{ finding_id }` |
| `cro_get_screenshot` | Get annotated screenshot URL | `{ screenshot_id }` |
| `cro_compare_versions` | Get diff between two audit versions | `{ client_id, version_a, version_b }` |
| `cro_get_competitor_comparison` | Get pairwise comparison findings | `{ client_id, audit_version?, competitor_domain? }` |
| `cro_get_consistency_issues` | Get cross-page consistency findings | `{ client_id, audit_version? }` |
| `cro_list_clients` | List accessible clients (scoped by API key) | `{}` |
| `cro_trigger_audit` | Trigger a new audit (if authorized) — **X4-FIX: contract defined in §18.3.2, implementation Phase 11+** | `{ client_id, competitor_urls? }` |

### Client Isolation

**REQ-DELIVERY-002:** API key scoping:
- Each API key is bound to one or more `client_id` values
- MCP server sets `app.client_id` PostgreSQL session variable before any query
- RLS policies enforce isolation at database level
- A key for Client A can NEVER access Client B's findings

### Response Format

**REQ-DELIVERY-003:** All MCP responses return structured JSON:

```typescript
interface CROAuditResponse {
  success: boolean;
  data: any;
  meta: {
    client_id: string;
    audit_version: number;
    generated_at: string;
    finding_count?: number;
  };
}
```

### What Clients See vs Don't See

| Visible | Hidden |
|---------|--------|
| Finding name, description | Heuristic detection logic |
| Evidence from their page | Positive/negative signal patterns |
| Severity + confidence tier | Reliability tier classification rules |
| Recommendation | Heuristic filtering rules |
| Annotated screenshot | Which heuristics were skipped |
| Source attribution ("Based on Baymard research") | Raw heuristic JSON content |
| Comparison findings | Internal grounding rule details |

## 14.2 Client Dashboard

**REQ-DELIVERY-004:** Built with Next.js 15 + shadcn/ui + Tailwind CSS.

### Pages

| Page | Content |
|------|---------|
| `/dashboard` | Audit overview: latest audit summary, finding counts by severity, improvement trend |
| `/dashboard/findings` | All findings: filterable by severity, category, page, status. Annotated screenshots. |
| `/dashboard/findings/[id]` | Single finding detail: full evidence, screenshot with annotation highlighted, recommendation |
| `/dashboard/compare` | Version comparison: resolved / persisted / new findings side-by-side |
| `/dashboard/competitors` | Competitor comparison: pairwise findings, dimension-by-dimension view |
| `/dashboard/pages/[url]` | Per-page view: all findings for a specific page, annotated screenshot |
| `/dashboard/history` | Audit version history: all runs with status, dates, finding counts |

### Key Components

| Component | Purpose |
|-----------|---------|
| `FindingCard` | Displays a single finding with severity badge, evidence, recommendation |
| `AnnotatedScreenshot` | Interactive screenshot with clickable finding pins |
| `SeverityFilter` | Filter findings by critical/high/medium/low |
| `VersionDiff` | Side-by-side comparison of two audit versions |
| `CompetitorComparison` | Pairwise comparison view per dimension |
| `AuditProgress` | Real-time progress during active audit (SSE-powered) |

## 14.3 Consultant Dashboard

**REQ-DELIVERY-005:** Extends client dashboard with review + management capabilities.

### Additional Pages

| Page | Content |
|------|---------|
| `/console/clients` | Client management: list, create, configure |
| `/console/audits` | All audits across clients: schedule, trigger, monitor |
| `/console/review` | Review gate: findings needing approval, delayed findings, rejection log |
| `/console/review/[finding_id]` | Approve / edit / reject a single finding |
| `/console/schedule` | Audit scheduling: recurring audits, next run times |
| `/console/analytics` | System analytics: findings per audit, rejection rates, cost tracking |

### Role-Based Access (Clerk)

| Role | Can Access | Can Do |
|------|-----------|--------|
| `client` | Their own dashboard only | View published findings |
| `consultant` | All client dashboards + console | Review, approve, edit, schedule audits |
| `admin` | Everything | Manage consultants, system config |

## 14.4 API Surface (Hono)

**REQ-DELIVERY-006:** REST API for dashboard + MCP server.

### Endpoints

```
# Audits
POST   /api/audits              Create new audit
GET    /api/audits/:id          Get audit status
GET    /api/audits/:id/findings Get findings for audit
POST   /api/audits/:id/trigger  Trigger re-run

# Findings
GET    /api/findings             List findings (filtered)
GET    /api/findings/:id         Get finding detail
PATCH  /api/findings/:id/review  Approve/reject/edit finding

# Screenshots
GET    /api/screenshots/:id      Get screenshot URL (signed)

# Clients
GET    /api/clients              List clients
POST   /api/clients              Create client
GET    /api/clients/:id          Get client detail

# Streaming
GET    /api/audits/:id/stream    SSE stream for audit progress

# MCP
POST   /api/mcp                  MCP protocol endpoint
```

## 14.5 SSE Streaming Events

**REQ-DELIVERY-007:** Real-time progress during active audits.

```typescript
type AuditEvent =
  | { type: "audit_started"; auditRunId: string; pagesTotal: number }
  | { type: "page_browsing"; pageUrl: string; pageIndex: number }
  | { type: "page_analyzing"; pageUrl: string; pageIndex: number }
  | { type: "findings_produced"; pageUrl: string; count: number; grounded: number; rejected: number }
  | { type: "finding_published"; findingId: string; severity: string }
  | { type: "page_complete"; pageUrl: string; findingsCount: number }
  | { type: "page_failed"; pageUrl: string; reason: string }
  | { type: "audit_progress"; pagesAnalyzed: number; pagesTotal: number; findingsTotal: number }
  | { type: "audit_complete"; summary: AuditSummary }
  | { type: "audit_error"; error: string }
```
