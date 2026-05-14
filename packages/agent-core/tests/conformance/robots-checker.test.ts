/**
 * AC-16 — RobotsChecker conformance (Phase 4 T080a, v0.3 NEW).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-16 (v0.4)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T080a
 *     (REQ-SAFETY-005 + REQ-RATE-003 + REQ-SAFETY-007)
 *
 * AC-16 contract:
 *   - isAllowed(url, userAgent): { allowed, matched_directive?, warning_code? }
 *   - Parses <root>/robots.txt; falls back to ai-agent.txt (REQ-RATE-003).
 *   - Refuses UA spoofing of search-engine crawlers (REQ-SAFETY-007).
 *   - Emits ROBOTS_TXT_DISALLOWED warning with the matched directive.
 *   - Cache: in-memory Map<auditRunId, RobotsTxt>; cleanup at audit_completed.
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-16 — robots.txt allow/disallow + UA-spoof rejection.
 */
import { describe, expect, it, vi } from 'vitest';

// SUT (does not exist yet — T080a lands this in Wave 2). Import fails → RED.
import { RobotsChecker } from '../../src/safety/RobotsChecker.js';

interface FetchStub {
  fetchRobotsTxt(rootUrl: string): Promise<string | null>;
}

function stubFetcher(map: Record<string, string | null>): FetchStub {
  return {
    fetchRobotsTxt: vi.fn(async (rootUrl: string) => {
      return rootUrl in map ? (map[rootUrl] ?? null) : null;
    }),
  };
}

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000D00';

describe('RobotsChecker — AC-16 conformance (RED until T080a)', () => {
  it('AC-16 allows: a path not under any Disallow directive', async () => {
    const fetcher = stubFetcher({
      'https://example.com': 'User-agent: *\nDisallow: /private\n',
    });
    const checker = new RobotsChecker(fetcher);
    const verdict = await checker.isAllowed(
      'https://example.com/public',
      'NeuralAgent/1.0',
      AUDIT_RUN_ID,
    );
    expect(verdict.allowed).toBe(true);
  });

  it('AC-16 disallows: a path under Disallow returns warning + matched directive', async () => {
    const fetcher = stubFetcher({
      'https://example.com': 'User-agent: *\nDisallow: /private\n',
    });
    const checker = new RobotsChecker(fetcher);
    const verdict = await checker.isAllowed(
      'https://example.com/private/secret',
      'NeuralAgent/1.0',
      AUDIT_RUN_ID,
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.warning_code).toBe('ROBOTS_TXT_DISALLOWED');
    expect(verdict.matched_directive).toContain('/private');
  });

  it('AC-16 rejects UA spoofing: Googlebot-like UA from us is refused', async () => {
    const fetcher = stubFetcher({
      'https://example.com': 'User-agent: *\nAllow: /\n',
    });
    const checker = new RobotsChecker(fetcher);
    await expect(
      checker.isAllowed('https://example.com/page', 'Googlebot/2.1', AUDIT_RUN_ID),
    ).rejects.toThrow(/spoof/i);
  });

  it('AC-16 cache: 2 isAllowed calls on same audit_run + host → fetcher invoked once', async () => {
    const fetcher = stubFetcher({
      'https://example.com': 'User-agent: *\nDisallow: /private\n',
    });
    const checker = new RobotsChecker(fetcher);
    await checker.isAllowed('https://example.com/a', 'NeuralAgent/1.0', AUDIT_RUN_ID);
    await checker.isAllowed('https://example.com/b', 'NeuralAgent/1.0', AUDIT_RUN_ID);
    expect((fetcher.fetchRobotsTxt as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});
