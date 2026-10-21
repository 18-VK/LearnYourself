import { lines } from '../../engine/code';
import { ArrayRecorder, range } from '../../engine/recorder';
import type { Prediction, Trace } from '../../engine/types';
import { SORT_CODE } from '../csharp';

/*
 * Counters policy:
 * - reads/writes count accesses to arr.
 * - comparisons counts element-value comparisons only (`arr[left] > arr[largest]`, `arr[right] > arr[largest]`).
 *   Index checks such as `left < n` are not counted. Because && short-circuits, the two reads and the
 *   comparison happen only when the child index is inside the heap.
 * - Each tuple swap is 2 reads, 2 writes and 1 swap.
 */

const code = SORT_CODE.heap;
export const HEAP_LINES = lines(code, {
  n: 'int n = arr.Length;',
  buildLoop: 'for (int i = n / 2 - 1; i >= 0; i--)',
  buildCall: 'Heapify(arr, n, i);',
  sortLoop: 'for (int i = n - 1; i > 0; i--)',
  rootSwap: '(arr[0], arr[i]) = (arr[i], arr[0]);',
  sortCall: 'Heapify(arr, i, 0);',
  /** Closing brace of HeapSort (the outer method). */
  end: ['}', 2],
  largest: 'int largest = i;',
  left: 'int left = 2 * i + 1;',
  right: 'int right = 2 * i + 2;',
  checkLeft: 'if (left < n && arr[left] > arr[largest]) largest = left;',
  checkRight: 'if (right < n && arr[right] > arr[largest]) largest = right;',
  checkSwap: 'if (largest != i)',
  swap: '(arr[i], arr[largest]) = (arr[largest], arr[i]);',
  recurse: 'Heapify(arr, n, largest);',
});
const L = HEAP_LINES;

/**
 * Mirrors HeapSort + Heapify from the notes: build a max-heap bottom-up, then repeatedly swap the root
 * to the end of the shrinking heap and sift the new root down. `heapSize` on each step is the size of
 * the heap the code is working on; indexes at or beyond it are the sorted tail.
 */
export function traceHeap(input: readonly number[]): Trace {
  const r = new ArrayRecorder(input);
  const n = r.n;
  const settled = new Set<number>();
  const st = () => [...settled].sort((a, b) => a - b);
  const frames: string[] = [];
  const stack = () => frames.join(' › ');
  const v = (k: number) => r.values[k]!;
  r.heapSize = n;

  function heapify(hn: number, i: number): void {
    frames.push(`Heapify(n=${hn}, i=${i})`);
    let largest = i;
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    const kids = [left, right].filter((c) => c < hn);
    const childPointers = { i, ...(left < hn ? { left } : {}), ...(right < hn ? { right } : {}) };

    let predict: Prediction | undefined;
    if (kids.length > 0) {
      const maxKid = Math.max(...kids.map(v));
      predict = {
        question: `Will arr[${i}] = ${v(i)} swap with one of its children (${kids.map((c) => v(c)).join(' and ')})?`,
        options: ['Yes, a child is larger', 'No, it is already the largest'],
        answer: maxKid > v(i) ? 0 : 1,
      };
    }
    r.step(
      'select',
      L.largest,
      `largest = i = ${i}. Start by assuming arr[${i}] = ${v(i)} is the largest of itself and its children.`,
      { active: [i], settled: st(), pointers: { i } },
      { n: hn, i, largest, stack: stack() },
      predict,
    );
    r.step(
      'branch',
      L.left,
      left < hn
        ? `left = 2 × ${i} + 1 = ${left}, the index of the left child (arr[${left}] = ${v(left)}).`
        : `left = 2 × ${i} + 1 = ${left}. That is not inside the heap (n = ${hn}), so arr[${i}] has no left child.`,
      { active: [i], settled: st(), pointers: { i, ...(left < hn ? { left } : {}) } },
      { n: hn, i, largest, left, stack: stack() },
    );
    r.step(
      'branch',
      L.right,
      right < hn
        ? `right = 2 × ${i} + 2 = ${right}, the index of the right child (arr[${right}] = ${v(right)}).`
        : `right = 2 × ${i} + 2 = ${right}. That is not inside the heap (n = ${hn}), so arr[${i}] has no right child.`,
      { active: [i], settled: st(), pointers: childPointers },
      { n: hn, i, largest, left, right, stack: stack() },
    );

    const vars = () => ({ n: hn, i, largest, left, right, stack: stack() });
    const check = (child: number, side: 'left' | 'right', line: number) => {
      if (child >= hn) {
        r.step(
          'branch',
          line,
          `${side} = ${child} is not < n = ${hn}, so && short-circuits: arr[${side}] is never read and largest stays ${largest}.`,
          { active: [i], settled: st(), pointers: childPointers },
          vars(),
        );
        return;
      }
      const c = r.read(child);
      const m = r.read(largest);
      r.compare();
      const gt = c > m;
      const against = largest === i ? `the parent arr[${i}]` : `the left child arr[${largest}]`;
      r.step(
        'compare',
        line,
        `Comparing the ${side} child arr[${child}] = ${c} with ${against} = ${m}. ${gt ? `${c} is larger, so largest = ${child}.` : `${c} is not larger, so largest stays ${largest}.`}`,
        { compare: [child, largest], active: [i], settled: st(), pointers: childPointers },
        { ...vars(), largest: gt ? child : largest },
        {
          question: `Is the ${side} child arr[${child}] = ${c} larger than ${against} = ${m}?`,
          options: ['Yes, it becomes largest', 'No, largest stays'],
          answer: gt ? 0 : 1,
        },
      );
      if (gt) largest = child;
    };
    check(left, 'left', L.checkLeft);
    check(right, 'right', L.checkRight);

    const swap = largest !== i;
    r.step(
      'branch',
      L.checkSwap,
      swap
        ? `largest = ${largest} differs from i = ${i}: the child ${v(largest)} is larger than the parent ${v(i)}, so they swap.`
        : kids.length === 0
          ? `largest equals i = ${i}: arr[${i}] has no children inside the heap, so there is nothing to fix and Heapify returns.`
          : `largest equals i = ${i}: arr[${i}] = ${v(i)} is at least as large as its children, so this subtree is a max-heap and Heapify returns.`,
      { active: swap ? [i, largest] : [i], settled: st(), pointers: childPointers },
      vars(),
    );
    if (swap) {
      r.swap(i, largest);
      r.step(
        'swap',
        L.swap,
        `Swapped arr[${i}] and arr[${largest}]: ${v(i)} moves up to index ${i} and ${v(largest)} moves down to index ${largest}.`,
        { swap: [i, largest], settled: st() },
        vars(),
      );
      r.step(
        'call',
        L.recurse,
        2 * largest + 1 < hn
          ? `Heapify(arr, ${hn}, ${largest}): ${v(largest)} may now be smaller than its own children, so sift it further down.`
          : `Heapify(arr, ${hn}, ${largest}): ${v(largest)} is now a leaf, so this call will find nothing to fix.`,
        { active: [largest], settled: st(), pointers: { largest } },
        vars(),
      );
      heapify(hn, largest);
    }
    frames.pop();
  }

  r.step('start', L.n, `n = ${n}. First build a max-heap, then move the root (the maximum) to the end of the heap again and again.`, {}, { n });

  const first = Math.trunc(n / 2) - 1;
  for (let i = first; i >= 0; i--) {
    r.step(
      'branch',
      L.buildLoop,
      i === first
        ? `Build phase: i = n / 2 - 1 = ${i}, the last node that has a child. Every node after it is a leaf, and a leaf is already a heap.`
        : `i = ${i}: every subtree below index ${i} is already a max-heap, so arr[${i}] is next.`,
      { active: [i], pointers: { i } },
      { n, i },
    );
    r.step('call', L.buildCall, `Heapify(arr, ${n}, ${i}) sifts arr[${i}] = ${v(i)} down until it is no smaller than its children.`, { active: [i], pointers: { i } }, { n, i });
    heapify(n, i);
  }
  r.step(
    'branch',
    L.buildLoop,
    first < 0
      ? `i = n / 2 - 1 = ${first}, so the build loop does not run: ${n === 0 ? 'the array is empty' : 'a single element is already a heap'}.`
      : `i = -1, so the build loop ends. arr is now a max-heap: the root arr[0] = ${v(0)} is the largest value.`,
    n > 0 ? { active: [0] } : {},
    { n, i: Math.min(first, -1) },
  );

  for (let i = n - 1; i > 0; i--) {
    r.step(
      'branch',
      L.sortLoop,
      `i = ${i}: the heap is arr[0..${i}], and its root arr[0] = ${v(0)} is the largest value left in it.`,
      { active: [0], settled: st(), pointers: { i } },
      { n, i },
    );
    r.swap(0, i);
    r.heapSize = i;
    settled.add(i);
    r.step(
      'swap',
      L.rootSwap,
      `Swap the root with arr[${i}]: ${v(i)} is settled at index ${i}, and the heap shrinks to arr[0..${i - 1}].`,
      { swap: [0, i], settled: st() },
      { n, i },
    );
    r.step(
      'call',
      L.sortCall,
      i === 1
        ? 'Heapify(arr, 1, 0): a heap of one element is already valid, but the call still runs.'
        : `Heapify(arr, ${i}, 0) sifts the new root ${v(0)} down to restore the max-heap on arr[0..${i - 1}].`,
      { active: [0], settled: st() },
      { n, i },
    );
    heapify(i, 0);
  }
  r.heapSize = 0;
  range(n).forEach((k) => settled.add(k));
  r.step(
    'branch',
    L.sortLoop,
    n <= 1
      ? `i = n - 1 = ${n - 1}, so the loop does not run.`
      : `i = 0, so the loop ends. arr[0] = ${v(0)} is the smallest value and is already in place.`,
    { settled: st() },
    { n, i: Math.min(n - 1, 0) },
  );
  r.step(
    'done',
    L.end,
    `Done: ${r.c.comparisons} comparison${r.c.comparisons === 1 ? '' : 's'} and ${r.c.swaps} swap${r.c.swaps === 1 ? '' : 's'}.`,
    { settled: st() },
    { n },
  );
  return r.steps;
}
