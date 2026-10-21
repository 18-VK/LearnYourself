import { lines } from '../../engine/code';
import { ArrayRecorder, range } from '../../engine/recorder';
import type { Trace } from '../../engine/types';
import { SORT_CODE } from '../csharp';

const code = SORT_CODE.selection;
export const SELECTION_LINES = {
  ...lines(code, {
    n: 'int n = arr.Length;',
    outer: 'for (int i = 0; i < n - 1; i++)',
    minIdx: 'int minIdx = i;',
    compare: 'if (arr[j] < arr[minIdx]) minIdx = j;',
    check: 'if (minIdx != i)',
    swap: '(arr[i], arr[minIdx]) = (arr[minIdx], arr[i]);',
  }),
  end: code.split('\n').length,
};
const L = SELECTION_LINES;

/** Mirrors SelectionSort from the notes: find the minimum of the unsorted part, swap it to the front. */
export function traceSelection(input: readonly number[]): Trace {
  const r = new ArrayRecorder(input);
  const n = r.n;
  const settled = new Set<number>();
  const st = () => [...settled].sort((a, b) => a - b);

  r.step('start', L.n, `n = ${n}. Each pass finds the smallest remaining value and moves it to the front.`, {}, { n });
  for (let i = 0; i < n - 1; i++) {
    r.step('branch', L.outer, `Pass i = ${i}: find the minimum of arr[${i}..${n - 1}].`, { settled: st(), pointers: { i } }, { n, i });
    let minIdx = i;
    r.step('select', L.minIdx, `minIdx = ${i}. Assume arr[${i}] = ${r.values[i]} is the smallest until something smaller turns up.`, { active: [i], settled: st(), pointers: { i } }, { n, i, minIdx });
    for (let j = i + 1; j < n; j++) {
      const a = r.read(j);
      const m = r.read(minIdx);
      r.compare();
      const lt = a < m;
      r.step(
        'compare',
        L.compare,
        `Comparing arr[${j}] = ${a} with the current minimum ${m}. ${lt ? `${a} is smaller, so minIdx = ${j}.` : `${a} is not smaller, so minIdx stays ${minIdx}.`}`,
        { compare: [j], active: [minIdx], settled: st(), pointers: { i, j } },
        { n, i, j, minIdx: lt ? j : minIdx },
        {
          question: `Is arr[${j}] = ${a} smaller than the current minimum ${m}?`,
          options: ['Yes, new minimum', 'No, keep the minimum'],
          answer: lt ? 0 : 1,
        },
      );
      if (lt) minIdx = j;
    }
    const needSwap = minIdx !== i;
    r.step(
      'branch',
      L.check,
      needSwap ? `minIdx = ${minIdx} differs from i = ${i}, so swap.` : `minIdx equals i, so ${r.values[i]} is already in place and no swap is needed.`,
      { active: [minIdx], settled: st(), pointers: { i } },
      { n, i, minIdx },
    );
    if (needSwap) {
      r.swap(i, minIdx);
      settled.add(i);
      r.step('swap', L.swap, `Swapped arr[${i}] and arr[${minIdx}]. ${r.values[i]} is settled at index ${i}.`, { swap: [i, minIdx], settled: st(), pointers: { i } }, { n, i, minIdx });
    } else {
      settled.add(i);
    }
  }
  range(n).forEach((k) => settled.add(k));
  r.step('done', L.end, `Done: ${r.c.comparisons} comparisons but only ${r.c.swaps} swaps.`, { settled: st() }, { n });
  return r.steps;
}
