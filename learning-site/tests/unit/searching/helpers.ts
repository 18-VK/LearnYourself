import { expect } from 'vitest';
import type { SearchTrace } from '../../../src/viz/searching/recorder';

/** Deterministic pseudo-random generator so failures are reproducible. */
export function rng(seed = 12345) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Sorted arrays (with and without duplicates) plus a few fixed edge cases. */
export function sortedInputs(count: number, seed = 99): number[][] {
  const next = rng(seed);
  const out: number[][] = [[], [5], [1, 2], [2, 2], [1, 2, 2, 2, 3], [1, 3, 5, 7, 9, 11, 13], [4, 4, 4, 4]];
  for (let k = 0; k < count; k++) {
    const len = 1 + Math.floor(next() * 16);
    out.push(Array.from({ length: len }, () => Math.floor(next() * 60)).sort((a, b) => a - b));
  }
  return out;
}

/** Targets worth trying for an array: every value, plus values below, between and above them. */
export function targetsFor(arr: readonly number[]): number[] {
  const set = new Set<number>([-1, 0, 100]);
  for (const v of arr) [v - 1, v, v + 1].forEach((t) => set.add(t));
  return [...set];
}

/** Problems with a trace, as messages (empty when it is well formed). Plain checks keep big sweeps fast. */
export function wellFormedProblems(trace: SearchTrace, n: number, codeLineCount: number): string[] {
  const p: string[] = [];
  if (trace.length === 0) return ['empty trace'];
  let prev = trace[0]!.counters;
  let probes = 0;
  trace.forEach((step, k) => {
    const at = `step ${k}`;
    if (step.codeLine < 1 || step.codeLine > codeLineCount) p.push(`${at}: codeLine ${step.codeLine}`);
    if (!step.narration || /undefined|NaN/.test(step.narration)) p.push(`${at}: narration "${step.narration}"`);
    if (step.state.values.length !== n) p.push(`${at}: ${step.state.values.length} values`);
    if (step.counters.comparisons < prev.comparisons || step.counters.reads < prev.reads) p.push(`${at}: counters went backwards`);
    if (step.state.probes < probes) p.push(`${at}: probes went backwards`);
    prev = step.counters;
    probes = step.state.probes;
    for (const i of [...(step.highlights.compare ?? []), ...(step.highlights.active ?? []), ...(step.highlights.settled ?? [])]) {
      if (!(i >= 0 && i < n)) p.push(`${at}: highlight index ${i}`);
    }
    for (const [name, i] of Object.entries(step.highlights.pointers ?? {})) {
      if (!(i >= -1 && i <= n)) p.push(`${at}: pointer ${name} = ${i}`);
    }
    if (step.predict) {
      const { answer, options } = step.predict;
      if (!(answer >= 0 && answer < options.length)) p.push(`${at}: predict answer ${answer}`);
      if (new Set(options).size !== options.length) p.push(`${at}: duplicate predict options`);
    }
    if (k < trace.length - 1 && step.action === 'done') p.push(`${at}: 'done' before the end`);
  });
  const last = trace[trace.length - 1]!;
  if (last.action !== 'done') p.push(`last step is '${last.action}'`);
  if (last.state.result === undefined) p.push('last step has no result');
  return p;
}

export function expectWellFormed(trace: SearchTrace, n: number, codeLineCount: number): void {
  expect(wellFormedProblems(trace, n, codeLineCount)).toEqual([]);
}

export const resultOf = (trace: SearchTrace) => trace[trace.length - 1]!.state.result;
export const lineCount = (code: string) => code.split('\n').length;
