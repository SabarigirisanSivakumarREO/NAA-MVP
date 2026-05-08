/**
 * Phase 1 perception layer barrel — public surface for upstream consumers
 * (Phase 2 MCP tools, Phase 5 Browse MVP, Phase 7 deep_perceive).
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/plan.md §"Project
 *         Structure" (perception/index.ts barrel export);
 *         docs/specs/mvp/phases/phase-1-perception/tasks.md T013 Files.
 *
 * R10.3: named exports only. No default exports.
 */
export { contextAssembler, type CaptureOpts, type ContextAssembler } from './ContextAssembler.js';
export { accessibilityExtractor } from './AccessibilityExtractor.js';
export { hardFilter } from './HardFilter.js';
export { softFilter } from './SoftFilter.js';
export { mutationMonitor } from './MutationMonitor.js';
export { screenshotExtractor, ScreenshotExtractor } from './ScreenshotExtractor.js';
export * from './types.js';
