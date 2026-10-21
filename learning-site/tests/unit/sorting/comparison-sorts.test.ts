import { describe, expect, it } from 'vitest';
import { SORT_CODE } from '../../../src/viz/sorting/csharp';
import { BUBBLE_LINES, traceBubble } from '../../../src/viz/sorting/traces/bubble';
import { INSERTION_LINES, traceInsertion } from '../../../src/viz/sorting/traces/insertion';
import { QUICK_LINES, traceQuick } from '../../../src/viz/sorting/traces/quick';
import { SELECTION_LINES, traceSelection } from '../../../src/viz/sorting/traces/selection';
import { expectPermutationAtSwapSteps, expectWellFormed, finalValues, isSorted, seededInputs, sortedCopy } from './helpers';

const lineCount = (code: string) => code.split('\n').length;
const inputs = seededInputs(60);

describe.each([
  ['bubble', traceBubble, SORT_CODE.bubble],
  ['selection', traceSelection, SORT_CODE.selection],
  ['insertion', traceInsertion, SORT_CODE.insertion],
  ['quick', traceQuick, SORT_CODE.quick],
] as const)('%s sort trace', (_name, trace, code) => {
  it('ends with the sorted array for every input', () => {
    for (const input of inputs) expect(finalValues(trace(input))).toEqual(sortedCopy(input));
  });
  it('is well formed at every step', () => {
    for (const input of inputs) expectWellFormed(trace(input), input, lineCount(code));
  });
});

describe.each([
  ['bubble', traceBubble],
  ['selection', traceSelection],
  ['quick', traceQuick],
] as const)('%s sort (swap-based)', (_name, trace) => {
  it('never loses or invents values at compare/swap steps', () => {
    for (const input of inputs) expectPermutationAtSwapSteps(trace(input), input);
  });
});

/** Multiset difference a − b, as a sorted list. */
function minus(a: readonly number[], b: readonly number[]): number[] {
  const rest = [...a];
  for (const v of b) {
    const k = rest.indexOf(v);
    if (k >= 0) rest.splice(k, 1);
  }
  return rest.sort((x, y) => x - y);
}

describe('bubble sort', () => {
  it('keeps the settled suffix sorted and no smaller than the rest after every pass', () => {
    for (const input of inputs) {
      for (const step of traceBubble(input)) {
        if (step.codeLine !== BUBBLE_LINES.exit) continue;
        const settled = step.highlights.settled ?? [];
        const a = step.state.values;
        const from = Math.min(...settled);
        expect(isSorted(a, from)).toBe(true);
        if (from > 0) expect(Math.max(...a.slice(0, from))).toBeLessThanOrEqual(a[from]!);
      }
    }
  });
  it('counts [3, 2, 1] by hand: 3 comparisons, 3 swaps, 12 reads, 6 writes', () => {
    const c = traceBubble([3, 2, 1]).at(-1)!.counters;
    expect(c).toEqual({ comparisons: 3, swaps: 3, reads: 12, writes: 6 });
  });
  it('exits early on sorted input: [1, 2, 3] makes 2 comparisons and no swaps', () => {
    const t = traceBubble([1, 2, 3]);
    expect(t.at(-1)!.counters).toEqual({ comparisons: 2, swaps: 0, reads: 4, writes: 0 });
    expect(t.some((s) => s.narration.includes('exits early'))).toBe(true);
  });
  it('follows the C# line by line for [2, 1]', () => {
    const L = BUBBLE_LINES;
    expect(traceBubble([2, 1]).map((s) => s.codeLine)).toEqual([L.n, L.outer, L.swappedFalse, L.compare, L.swap, L.exit, L.end]);
  });
});

describe('selection sort', () => {
  it('settles the minimum of the remaining range at index i on every pass', () => {
    for (const input of inputs) {
      const t = traceSelection(input);
      const passEnds = t.filter((s) => s.codeLine === SELECTION_LINES.check);
      passEnds.forEach((s, i) => {
        // after the swap that follows this check, arr[0..i] is sorted and holds the i+1 smallest values
        const after = t[t.indexOf(s) + 1]!.state.values;
        expect(isSorted(after, 0, i)).toBe(true);
        expect(after.slice(0, i + 1)).toEqual(sortedCopy(input).slice(0, i + 1));
      });
    }
  });
  it('counts [3, 1, 2] by hand: 3 comparisons, 2 swaps', () => {
    const c = traceSelection([3, 1, 2]).at(-1)!.counters;
    expect(c.comparisons).toBe(3);
    expect(c.swaps).toBe(2);
  });
  it('makes at most n - 1 swaps', () => {
    for (const input of inputs) expect(traceSelection(input).at(-1)!.counters.swaps).toBeLessThanOrEqual(Math.max(0, input.length - 1));
  });
  it('follows the C# line by line for [2, 1]', () => {
    const L = SELECTION_LINES;
    expect(traceSelection([2, 1]).map((s) => s.codeLine)).toEqual([L.n, L.outer, L.minIdx, L.compare, L.check, L.swap, L.end]);
  });
});

describe('insertion sort', () => {
  it('accounts for every value: the array plus the held key always equals the input', () => {
    for (const input of inputs) {
      for (const step of traceInsertion(input)) {
        const key = step.variables.key;
        if (typeof key !== 'number' || step.codeLine === INSERTION_LINES.place) continue;
        const v = step.state.values;
        const missing = minus(input, v);
        const extra = minus(v, input);
        // before the first shift nothing is missing; after it, exactly the key is missing and one shifted value is doubled
        expect(missing.length === 0 || (missing.length === 1 && missing[0] === key && extra.length === 1)).toBe(true);
      }
    }
  });
  it('keeps arr[0..i-1] sorted at the start of every outer iteration', () => {
    for (const input of inputs) {
      for (const step of traceInsertion(input)) {
        if (step.codeLine !== INSERTION_LINES.outer) continue;
        const i = step.variables.i as number;
        expect(isSorted(step.state.values, 0, i - 1)).toBe(true);
      }
    }
  });
  it("reproduces the note's example [2, 5, 7, 3] -> [2, 5, 7, 7] -> [2, 5, 5, 7] -> [2, 3, 5, 7]", () => {
    const writes = traceInsertion([2, 5, 7, 3])
      .filter((s) => s.action === 'write')
      .map((s) => s.state.values.join(','));
    // i = 1 and i = 2 write their key back in place; i = 3 produces exactly the note's sequence.
    expect(writes).toEqual(['2,5,7,3', '2,5,7,3', '2,5,7,7', '2,5,5,7', '2,3,5,7']);
  });
  it('counts [3, 1, 2] by hand: 3 comparisons, 7 reads, 4 writes, no swaps', () => {
    expect(traceInsertion([3, 1, 2]).at(-1)!.counters).toEqual({ comparisons: 3, swaps: 0, reads: 7, writes: 4 });
  });
  it('is stable: equal keys keep their original order', () => {
    const t = traceInsertion([5, 3, 5, 1]);
    const last = t.at(-1)!.state;
    const fives = last.ids.filter((_, i) => last.values[i] === 5);
    expect(fives).toEqual([0, 2]);
  });
  it('follows the C# line by line for [2, 1]', () => {
    const L = INSERTION_LINES;
    expect(traceInsertion([2, 1]).map((s) => s.codeLine)).toEqual([L.outer, L.key, L.j, L.loop, L.shift, L.dec, L.loop, L.place, L.end]);
  });
});

describe('quick sort', () => {
  it('leaves every partition with smaller-or-equal values left of the pivot and larger values right', () => {
    for (const input of inputs) {
      for (const step of traceQuick(input)) {
        if (step.codeLine !== QUICK_LINES.ret) continue;
        const { low, high, i } = step.variables as { low: number; high: number; i: number };
        const p = i + 1;
        const a = step.state.values;
        for (let k = low; k < p; k++) expect(a[k]!).toBeLessThanOrEqual(a[p]!);
        for (let k = p + 1; k <= high; k++) expect(a[k]!).toBeGreaterThan(a[p]!);
      }
    }
  });
  it('counts [3, 1, 2] by hand: 2 comparisons, 2 swaps', () => {
    const c = traceQuick([3, 1, 2]).at(-1)!.counters;
    expect(c.comparisons).toBe(2);
    expect(c.swaps).toBe(2);
  });
  it("hits the note's worst case on sorted input: n(n-1)/2 comparisons", () => {
    for (const n of [2, 5, 8, 12]) {
      const sorted = Array.from({ length: n }, (_, i) => i + 1);
      expect(traceQuick(sorted).at(-1)!.counters.comparisons).toBe((n * (n - 1)) / 2);
    }
  });
  it('follows the C# line by line for [2, 1]', () => {
    const L = QUICK_LINES;
    expect(traceQuick([2, 1]).map((s) => s.codeLine)).toEqual([
      L.signature, L.check, L.partitionCall, L.pivot, L.i, L.compare, L.place, L.ret,
      L.recurseLeft, L.check, L.recurseRight, L.check, L.end,
    ]);
  });
});
