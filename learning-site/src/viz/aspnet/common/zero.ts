import type { Counters } from '../../engine/types';

/** These traces don't count array operations; the engine's Step still carries a Counters object. */
export const ZERO: Counters = { comparisons: 0, swaps: 0, reads: 0, writes: 0 };
