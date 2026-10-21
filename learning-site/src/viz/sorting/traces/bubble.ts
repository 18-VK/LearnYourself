import { lines } from '../../engine/code';
import { ArrayRecorder, range } from '../../engine/recorder';
import type { Trace } from '../../engine/types';
import { SORT_CODE } from '../csharp';

const code = SORT_CODE.bubble;
export const BUBBLE_LINES = {
  ...lines(code, {
    n: 'int n = arr.Length;',
    outer: 'for (int i = 0; i < n - 1; i++)',
    swappedFalse: 'bool swapped = false;',
    compare: 'if (arr[j] > arr[j + 1])',
    swap: '(arr[j], arr[j + 1]) = (arr[j + 1], arr[j]);',
    exit: 'if (!swapped) break;',
  }),
  end: code.split('\n').length,
};
const L = BUBBLE_LINES;

/** Mirrors BubbleSort from the notes: adjacent compare-and-swap passes with an early-exit flag. */
export function traceBubble(input: readonly number[]): Trace {
  const r = new ArrayRecorder(input);
  const n = r.n;
  const settled = new Set<number>();
  const st = () => [...settled].sort((a, b) => a - b);

  r.step('start', L.n, `n = ${n}. Each pass compares neighbours and swaps them when they are out of order.`, {}, { n });
  for (let i = 0; i < n - 1; i++) {
    r.step('branch', L.outer, `Pass i = ${i}: the largest unsorted value will bubble up to index ${n - i - 1}.`, { settled: st() }, { n, i });
    let swapped = false;
    r.step('branch', L.swappedFalse, 'swapped = false. If this pass makes no swaps, the array is already sorted.', { settled: st() }, { n, i, swapped });
    for (let j = 0; j < n - i - 1; j++) {
      const x = r.read(j);
      const y = r.read(j + 1);
      r.compare();
      const gt = x > y;
      r.step(
        'compare',
        L.compare,
        `Comparing arr[${j}] = ${x} with arr[${j + 1}] = ${y}. ${gt ? `${x} is larger, so they swap.` : `${x} is not larger, so they stay.`}`,
        { compare: [j, j + 1], settled: st(), pointers: { j } },
        { n, i, j, swapped },
        {
          question: `Will arr[${j}] = ${x} and arr[${j + 1}] = ${y} swap?`,
          options: ['Yes, swap them', 'No, leave them'],
          answer: gt ? 0 : 1,
        },
      );
      if (gt) {
        r.swap(j, j + 1);
        swapped = true;
        r.step('swap', L.swap, `Swapped: arr[${j}] = ${r.values[j]}, arr[${j + 1}] = ${r.values[j + 1]}. swapped = true.`, { swap: [j, j + 1], settled: st(), pointers: { j } }, { n, i, j, swapped });
      }
    }
    settled.add(n - i - 1);
    if (!swapped) {
      range(n).forEach((k) => settled.add(k));
      r.step('settle', L.exit, `No swaps in pass ${i}, so the array is already sorted and the loop exits early.`, { settled: st() }, { n, i, swapped });
      break;
    }
    r.step('settle', L.exit, `Pass ${i} done: ${r.values[n - i - 1]} is settled at index ${n - i - 1}. swapped is true, so another pass runs.`, { settled: st() }, { n, i, swapped });
  }
  range(n).forEach((k) => settled.add(k));
  r.step('done', L.end, `Done: sorted with ${r.c.comparisons} comparisons and ${r.c.swaps} swaps.`, { settled: st() }, { n });
  return r.steps;
}
