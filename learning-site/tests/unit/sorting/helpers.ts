import { expect } from 'vitest';
import type { Trace } from '../../../src/viz/engine/types';

/** Deterministic pseudo-random inputs so failures are reproducible. */
export function seededInputs(count: number, opts: { min?: number; max?: number; maxLen?: number; seed?: number } = {}): number[][] {
  const { min = 0, max = 99, maxLen = 12 } = opts;
  let s = opts.seed ?? 12345;
  const next = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const out: number[][] = [[], [7], [2, 1], [1, 2], [5, 5, 5], [3, 1, 2], [1, 2, 3, 4, 5, 6], [6, 5, 4, 3, 2, 1]];
  for (let k = 0; k < count; k++) {
    const len = Math.floor(next() * (maxLen + 1));
    out.push(Array.from({ length: len }, () => min + Math.floor(next() * (max - min + 1))));
  }
  return out;
}

export const sortedCopy = (a: readonly number[]) => [...a].sort((x, y) => x - y);

export function finalValues(trace: Trace): number[] {
  return trace[trace.length - 1]!.state.values;
}

/** Checks invariants every trace must satisfy, whatever the algorithm. */
export function expectWellFormed(trace: Trace, input: readonly number[], codeLineCount: number): void {
  expect(trace.length).toBeGreaterThan(0);
  let prev = { comparisons: 0, swaps: 0, reads: 0, writes: 0 };
  for (const step of trace) {
    expect(step.codeLine).toBeGreaterThanOrEqual(1);
    expect(step.codeLine).toBeLessThanOrEqual(codeLineCount);
    expect(step.state.values).toHaveLength(input.length);
    expect(step.state.ids).toHaveLength(input.length);
    expect(step.narration.length).toBeGreaterThan(0);
    // counters never go backwards
    expect(step.counters.comparisons).toBeGreaterThanOrEqual(prev.comparisons);
    expect(step.counters.swaps).toBeGreaterThanOrEqual(prev.swaps);
    expect(step.counters.reads).toBeGreaterThanOrEqual(prev.reads);
    expect(step.counters.writes).toBeGreaterThanOrEqual(prev.writes);
    prev = step.counters;
    for (const i of [...(step.highlights.compare ?? []), ...(step.highlights.swap ?? []), ...(step.highlights.active ?? [])]) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(input.length);
    }
    if (step.predict) expect(step.predict.answer).toBeLessThan(step.predict.options.length);
  }
  expect(trace[trace.length - 1]!.action).toBe('done');
}

/** For in-place comparison sorts: the multiset of values never changes, only the order. */
export function expectPermutationAtSwapSteps(trace: Trace, input: readonly number[]): void {
  const ref = sortedCopy(input);
  for (const step of trace) {
    if (step.action === 'swap' || step.action === 'compare') expect(sortedCopy(step.state.values)).toEqual(ref);
  }
}

export const isSorted = (a: readonly number[], from = 0, to = a.length - 1) => {
  for (let i = from + 1; i <= to; i++) if (a[i - 1]! > a[i]!) return false;
  return true;
};

/** Deterministic two-decimal inputs in [0, 1) for bucket sort (includes the same fixed edge cases, scaled by 1/100). */
export function seededUnitFloats(count: number, opts: { maxLen?: number; seed?: number } = {}): number[][] {
  return seededInputs(count, { min: 0, max: 99, maxLen: opts.maxLen ?? 10, seed: opts.seed ?? 777 }).map((a) => a.map((v) => v / 100));
}

/** Stability: in the final state, equal values appear in their original input order (increasing ids). */
export function expectStableFinal(trace: Trace): void {
  const { values, ids } = trace[trace.length - 1]!.state;
  for (let k = 1; k < values.length; k++) {
    if (values[k] === values[k - 1]) expect(ids[k]!).toBeGreaterThan(ids[k - 1]!);
  }
}

/**
 * Identity: at every step, any cell (main array or aux array) that carries an id holds the value of that
 * original input element, and the final state holds every original element exactly once.
 */
export function expectIdsTrackInput(trace: Trace, input: readonly number[], opts: { finalIdsArePermutation?: boolean } = {}): void {
  for (const step of trace) {
    step.state.ids.forEach((id, k) => {
      if (id !== null) expect(step.state.values[k]).toBe(input[id]);
    });
    for (const aux of step.state.aux ?? []) {
      aux.ids?.forEach((id, k) => {
        if (id !== null) expect(aux.values[k]).toBe(input[id]);
      });
    }
  }
  if (opts.finalIdsArePermutation ?? true) {
    const ids = trace[trace.length - 1]!.state.ids;
    expect([...ids].sort((a, b) => a! - b!)).toEqual(input.map((_, k) => k));
  }
}
