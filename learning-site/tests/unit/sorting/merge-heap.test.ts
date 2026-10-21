import { describe, expect, it } from 'vitest';
import { SORT_CODE } from '../../../src/viz/sorting/csharp';
import { HEAP_LINES, traceHeap } from '../../../src/viz/sorting/traces/heap';
import { MERGE_LINES, traceMerge } from '../../../src/viz/sorting/traces/merge';
import {
  expectIdsTrackInput,
  expectPermutationAtSwapSteps,
  expectStableFinal,
  expectWellFormed,
  finalValues,
  isSorted,
  seededInputs,
  sortedCopy,
} from './helpers';

const lineCount = (code: string) => code.split('\n').length;
const lineText = (code: string, line: number) => code.split('\n')[line - 1];
const inputs = [
  ...seededInputs(60),
  [4, 4, 1, 4, 1, 1],
  [9, 9, 9, 9, 9, 9, 9],
  Array.from({ length: 14 }, (_, k) => k + 1),
  Array.from({ length: 14 }, (_, k) => 14 - k),
];

describe.each([
  ['merge', traceMerge, SORT_CODE.merge],
  ['heap', traceHeap, SORT_CODE.heap],
] as const)('%s sort trace', (_name, trace, code) => {
  it('ends with the sorted array for every input', () => {
    for (const input of inputs) expect(finalValues(trace(input))).toEqual(sortedCopy(input));
  });
  it('is well formed at every step', () => {
    for (const input of inputs) expectWellFormed(trace(input), input, lineCount(code));
  });
  it('keeps every id attached to its original value', () => {
    for (const input of inputs) expectIdsTrackInput(trace(input), input);
  });
  it('ends on the closing brace of the outer method', () => {
    const t = trace([3, 1, 2]);
    const end = t.at(-1)!.codeLine;
    expect(lineText(code, end)).toBe('}');
    expect(lineText(code, end + 1)).toBe(''); // the blank line between the two methods
  });
});

describe('merge sort', () => {
  const L = MERGE_LINES;

  it('leaves arr[left..right] sorted after every Merge', () => {
    for (const input of inputs) {
      const merges = traceMerge(input).filter((s) => s.codeLine === L.mergeEnd);
      expect(merges.length).toBe(Math.max(0, input.length - 1));
      for (const s of merges) {
        const { left, right } = s.variables as { left: number; right: number };
        expect(isSorted(s.state.values, left, right)).toBe(true);
      }
    }
  });
  it('copies exactly arr[left..mid] into leftArr and arr[mid + 1..right] into rightArr', () => {
    for (const input of inputs) {
      for (const s of traceMerge(input)) {
        const { left, mid, right } = s.variables as { left: number; mid: number; right: number };
        if (s.codeLine === L.sliceLeft) expect(s.state.aux![0]!.values).toEqual(s.state.values.slice(left, mid + 1));
        if (s.codeLine === L.sliceRight) expect(s.state.aux![1]!.values).toEqual(s.state.values.slice(mid + 1, right + 1));
      }
    }
  });
  it('is stable: equal values keep their original order', () => {
    for (const input of inputs) expectStableFinal(traceMerge(input));
    const last = traceMerge([5, 3, 5, 1, 5]).at(-1)!.state;
    expect(last.ids.filter((_, k) => last.values[k] === 5)).toEqual([0, 2, 4]);
  });
  it('writes the value its predict answer names', () => {
    for (const input of inputs) {
      const t = traceMerge(input);
      t.forEach((s, k) => {
        if (s.action !== 'compare') return;
        const next = t[k + 1]!;
        const chosen = Number(s.predict!.options[s.predict!.answer]!.split('= ')[1]);
        expect(next.codeLine).toBe(L.take);
        expect(next.state.values[next.highlights.swap![0]!]).toBe(chosen);
      });
    }
  });
  it('never swaps, and every read that is not part of a comparison is paired with a write', () => {
    for (const input of inputs) {
      const c = traceMerge(input).at(-1)!.counters;
      expect(c.swaps).toBe(0);
      expect(c.reads).toBe(c.writes + 2 * c.comparisons);
    }
  });
  it('counts [2, 1] by hand: 1 comparison, 6 reads, 4 writes, no swaps', () => {
    // MergeSort(0, 1) -> mid = 0 -> Merge(0, 0, 1):
    //   leftArr = arr[0..1]  -> 1 read + 1 write
    //   rightArr = arr[1..2] -> 1 read + 1 write
    //   main loop once: leftArr[0] <= rightArr[0] is 2 reads + 1 comparison (2 <= 1 is false),
    //                   then rightArr[0] is read and written to arr[0] -> 1 read + 1 write
    //   tail: arr[1] = leftArr[0] -> 1 read + 1 write
    // reads 1 + 1 + 2 + 1 + 1 = 6, writes 1 + 1 + 1 + 1 = 4
    expect(traceMerge([2, 1]).at(-1)!.counters).toEqual({ comparisons: 1, swaps: 0, reads: 6, writes: 4 });
  });
  it('follows the C# line by line for [2, 1]', () => {
    expect(traceMerge([2, 1]).map((s) => s.codeLine)).toEqual([
      L.signature, L.check, L.mid,
      L.recurseLeft, L.check,
      L.recurseRight, L.check,
      L.mergeCall, L.sliceLeft, L.sliceRight, L.init,
      L.take, L.take, // compare, then write rightArr[0]
      L.loop, // j == rightArr.Length, so the main loop stops
      L.tailLeft, // copies leftArr[0]
      L.tailRight, // nothing left in rightArr
      L.mergeEnd, L.end,
    ]);
  });
  it('handles empty and single-element input with an immediate return', () => {
    const L2 = MERGE_LINES;
    expect(traceMerge([]).map((s) => s.codeLine)).toEqual([L2.signature, L2.check, L2.end]);
    expect(traceMerge([7]).map((s) => s.codeLine)).toEqual([L2.signature, L2.check, L2.end]);
  });
});

describe('heap sort', () => {
  const L = HEAP_LINES;
  /** Max-heap property for every parent p >= from inside a heap of the given size. */
  const heapOk = (a: readonly number[], size: number, from = 0) => {
    for (let p = Math.max(0, from); p < size; p++) {
      for (const c of [2 * p + 1, 2 * p + 2]) if (c < size && a[c]! > a[p]!) return false;
    }
    return true;
  };
  const span = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, k) => from + k);

  it('never loses or invents values at compare/swap steps', () => {
    for (const input of inputs) expectPermutationAtSwapSteps(traceHeap(input), input);
  });
  it('builds the heap bottom-up: before each build-loop Heapify, every subtree below i is a max-heap', () => {
    for (const input of inputs) {
      const builds = traceHeap(input).filter((s) => s.codeLine === L.buildLoop);
      for (const s of builds) {
        expect(s.state.heapSize).toBe(input.length);
        expect(heapOk(s.state.values, input.length, (s.variables.i as number) + 1)).toBe(true);
      }
      // the last build-loop step is the loop exit (i = -1): the whole array is a max-heap
      expect(builds.at(-1)!.variables.i).toBe(-1);
      expect(heapOk(builds.at(-1)!.state.values, input.length)).toBe(true);
    }
  });
  it('restores the heap property whenever a Heapify call chain returns', () => {
    for (const input of inputs) {
      let root = 0;
      for (const s of traceHeap(input)) {
        if (s.codeLine === L.buildLoop) root = s.variables.i as number;
        if (s.codeLine === L.sortLoop) root = 0;
        const { i, largest, n } = s.variables as { i: number; largest: number; n: number };
        // `largest != i` is false: this call returns, and so does every caller (the recursion is the last statement)
        if (s.codeLine === L.checkSwap && largest === i) expect(heapOk(s.state.values, n, root)).toBe(true);
      }
    }
  });
  it('keeps a max-heap in arr[0..heapSize-1] and a sorted, settled tail at every sort-loop step', () => {
    for (const input of inputs) {
      const n = input.length;
      for (const s of traceHeap(input)) {
        if (s.codeLine !== L.sortLoop) continue;
        const size = s.state.heapSize!;
        const a = s.state.values;
        expect(heapOk(a, size)).toBe(true);
        expect(isSorted(a, size)).toBe(true);
        if (size > 0 && size < n) expect(Math.max(...a.slice(0, size))).toBeLessThanOrEqual(a[size]!);
        expect(s.highlights.settled).toEqual(span(size, n));
      }
    }
  });
  it('shrinks heapSize by one at every root swap, from n down to 1', () => {
    for (const input of inputs) {
      const n = input.length;
      const t = traceHeap(input);
      const firstRootSwap = t.findIndex((s) => s.codeLine === L.rootSwap);
      t.slice(0, firstRootSwap < 0 ? t.length - 2 : firstRootSwap).forEach((s) => expect(s.state.heapSize).toBe(n));
      const sizes = t.filter((s) => s.codeLine === L.rootSwap).map((s) => s.state.heapSize);
      expect(sizes).toEqual(span(1, n).reverse());
      t.filter((s) => s.codeLine === L.rootSwap).forEach((s) => expect(s.state.heapSize).toBe(s.variables.i));
      expect(t.at(-1)!.state.heapSize).toBe(0);
    }
  });
  it('asks "will the parent swap?" with the answer the trace then takes', () => {
    for (const input of inputs) {
      const t = traceHeap(input);
      t.forEach((s, k) => {
        if (s.codeLine !== L.largest || !s.predict) return;
        const verdict = t.slice(k).find((x) => x.codeLine === L.checkSwap)!;
        const swaps = verdict.variables.largest !== verdict.variables.i;
        expect(s.predict.answer).toBe(swaps ? 0 : 1);
      });
    }
  });
  it('short-circuits the child checks: a single element costs no reads', () => {
    expect(traceHeap([7]).at(-1)!.counters).toEqual({ comparisons: 0, swaps: 0, reads: 0, writes: 0 });
  });
  it('counts [1, 2] by hand: 1 comparison, 2 swaps, 6 reads, 4 writes', () => {
    // Build: i = 2 / 2 - 1 = 0. Heapify(arr, 2, 0): left = 1 < 2, so arr[1] > arr[0] reads 2 and compares once (2 > 1).
    //        right = 2 is not < 2, so no reads. largest = 1 != 0 -> swap: 2 reads, 2 writes. arr = [2, 1].
    //        Heapify(arr, 2, 1): both children are outside the heap -> no reads.
    // Sort: i = 1: swap arr[0] and arr[1]: 2 reads, 2 writes. arr = [1, 2]. Heapify(arr, 1, 0): no children -> no reads.
    // comparisons 1, swaps 2, reads 2 + 2 + 2 = 6, writes 2 + 2 = 4
    expect(traceHeap([1, 2]).at(-1)!.counters).toEqual({ comparisons: 1, swaps: 2, reads: 6, writes: 4 });
  });
  it('follows the C# line by line for [1, 2]', () => {
    const heapify = (swaps: boolean) =>
      swaps
        ? [L.largest, L.left, L.right, L.checkLeft, L.checkRight, L.checkSwap, L.swap, L.recurse]
        : [L.largest, L.left, L.right, L.checkLeft, L.checkRight, L.checkSwap];
    expect(traceHeap([1, 2]).map((s) => s.codeLine)).toEqual([
      L.n,
      L.buildLoop, L.buildCall, ...heapify(true), ...heapify(false), // Heapify(2, 0) swaps, then Heapify(2, 1) on a leaf
      L.buildLoop, // i = -1: build loop ends
      L.sortLoop, L.rootSwap, L.sortCall, ...heapify(false), // i = 1: Heapify(1, 0) has nothing to do
      L.sortLoop, // i = 0: loop ends
      L.end,
    ]);
  });
  it('handles empty input', () => {
    expect(traceHeap([]).map((s) => s.codeLine)).toEqual([L.n, L.buildLoop, L.sortLoop, L.end]);
  });
});
