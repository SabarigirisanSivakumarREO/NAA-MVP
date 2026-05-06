/**
 * HeuristicLoader — placeholder for T-SKELETON-001 orchestrator scaffolding.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 T-SKELETON-003.
 *
 * Status: minimal placeholder — returns []. T-SKELETON-003 enriches to load
 * 3 synthetic fixtures from
 * `packages/agent-core/tests/fixtures/heuristics/skeleton-{1,2,3}.json`
 * with `body` text marked "TEST FIXTURE — not a real heuristic" per R6
 * (and reusing the NEURAL_TEST_FIXTURE_BODY sentinel pattern from T0B-004
 * so future R6 conformance tests can assert against it).
 *
 * Phase 6 T106 supersedes with real FileSystemHeuristicLoader in week 4.
 *
 * R6 IP-boundary discipline (Phase 6 spec §4.1, AC-13 5-channel isolation):
 *   - Even when populated, this loader returns Heuristic objects whose
 *     `body` field MUST NEVER be serialized to logs / API responses /
 *     dashboards / LangSmith traces. Pino redaction config (T-PHASE6-LOGGER)
 *     enforces at the seam; this placeholder produces nothing to redact yet.
 *
 * R10 compliance: file ≤ 50 lines.
 */
// TODO(T-SKELETON-003): replace empty array with 3 synthetic fixtures
// loaded from packages/agent-core/tests/fixtures/heuristics/skeleton-*.json.
import { type HeuristicExtended } from './types.js';

export class HeuristicLoader {
  async loadAll(): Promise<HeuristicExtended[]> {
    return [];
  }
}
