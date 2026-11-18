// utils.mjs: a "barrel" that re-exports from other modules.
// It has no code of its own; importers get one path for several modules.

export { add, PI } from './math.mjs';
export { default as multiply } from './math.mjs';
export * as counter from './counter.mjs'; // namespace re-export (ES2020)
