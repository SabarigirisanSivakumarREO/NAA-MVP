/**
 * StoreNode — placeholder for T-SKELETON-001 orchestrator scaffolding.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 T-SKELETON-008.
 *
 * Status: writes findings array as JSON to
 * `<outputDir>/<slug>-findings.json`. Empty array writes `[]`. Same form
 * will satisfy T-SKELETON-008 acceptance (week 1 stub: filesystem only).
 *
 * Phase 4 T070-T072 schema lands week 3 → T-SKELETON-008 promotion stage 1
 * (basic Postgres write + RLS-enforced).
 * Phase 7 T132 lands week 9 → stage 2 (StoreNode w/ grounding lifecycle).
 * Phase 9 T164 lands week 11 → stage 3 (two-store warm-up aware — final).
 *
 * R7.4 stub-time enforcement (roadmap §10): pre-Phase-4 (weeks 1-2) the
 * placeholder MUST NOT attempt DB writes. This implementation is filesystem
 * only and contains no `pg` import.
 *
 * R10 compliance: file ≤ 50 lines.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type GroundedFinding } from '../../audit/types.js';

export interface StoreInput {
  findings: readonly GroundedFinding[];
  outputDir: string;
  slug: string;
}

export class StoreNode {
  async run({ findings, outputDir, slug }: StoreInput): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const path = join(outputDir, `${slug}-findings.json`);
    await writeFile(path, JSON.stringify(findings, null, 2), 'utf8');
    return path;
  }
}
