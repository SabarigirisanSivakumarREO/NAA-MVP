/**
 * Shim — re-exports the Stage 1 / Stage 2 filter functions from `./filter.js`.
 * Conformance tests resolve `filters.ts` (plural); spec canonicalises `filter.ts`.
 */
export { filterByBusinessType, filterByPageType, type FilterOptions } from './filter.js';
