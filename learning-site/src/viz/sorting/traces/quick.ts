import { lines } from '../../engine/code';
import { ArrayRecorder, range } from '../../engine/recorder';
import type { Highlights, Trace } from '../../engine/types';
import { SORT_CODE } from '../csharp';

const code = SORT_CODE.quick;
export const QUICK_LINES = lines(code, {
  signature: 'void QuickSort(int[] arr, int low, int high)',
  check: 'if (low < high)',
  partitionCall: 'int pivotIndex = Partition(arr, low, high);',
  recurseLeft: 'QuickSort(arr, low, pivotIndex - 1);',
  recurseRight: 'QuickSort(arr, pivotIndex + 1, high);',
  end: ['}', 2],
  pivot: 'int pivot = arr[high];',
  i: 'int i = low - 1;',
  compare: 'if (arr[j] <= pivot)',
  swap: '(arr[i], arr[j]) = (arr[j], arr[i]);',
  place: '(arr[i + 1], arr[high]) = (arr[high], arr[i + 1]);',
  ret: 'return i + 1;',
});
const L = QUICK_LINES;

/**
 * Mirrors QuickSort + Partition from the notes: Lomuto partition with the last element as pivot.
 * On already-sorted input the pivot is always the largest value, which is the O(n²) case in the notes.
 */
export function traceQuick(input: readonly number[]): Trace {
  const r = new ArrayRecorder(input);
  const n = r.n;
  const settled = new Set<number>();
  const st = () => [...settled].sort((a, b) => a - b);
  const frames: [number, number][] = [];
  const stack = () => frames.map(([lo, hi]) => `QuickSort(${lo}, ${hi})`).join(' › ');
  const scope = (low: number, high: number): Highlights => ({
    range: [low, high],
    band: { from: low, to: high, label: `arr[${low}..${high}]` },
    settled: st(),
  });

  function partition(low: number, high: number): number {
    const pivot = r.read(high);
    r.step('select', L.pivot, `pivot = arr[${high}] = ${pivot}, the last element.`, { ...scope(low, high), active: [high], pointers: { high } }, { low, high, pivot, stack: stack() });
    let i = low - 1;
    r.step('branch', L.i, `i = ${i}. Values at index i and to its left will be ≤ ${pivot}.`, { ...scope(low, high), active: [high], pointers: { high } }, { low, high, pivot, i, stack: stack() });
    for (let j = low; j < high; j++) {
      const v = r.read(j);
      r.compare();
      const le = v <= pivot;
      const pointers: Record<string, number> = i >= low ? { i, j } : { j };
      r.step(
        'compare',
        L.compare,
        `Comparing arr[${j}] = ${v} with pivot ${pivot}. ${le ? `${v} ≤ ${pivot}, so it belongs on the left.` : `${v} is larger, so it stays on the right.`}`,
        { ...scope(low, high), compare: [j], active: [high], pointers },
        { low, high, pivot, i, j, stack: stack() },
        { question: `Is arr[${j}] = ${v} ≤ pivot ${pivot}?`, options: ['Yes, move it left', 'No, it stays right'], answer: le ? 0 : 1 },
      );
      if (le) {
        i++;
        r.swap(i, j);
        r.step(
          'swap',
          L.swap,
          i === j ? `i++ makes i = ${i}. i equals j, so the swap leaves the array unchanged.` : `i++ makes i = ${i}. Swap arr[${i}] and arr[${j}].`,
          { ...scope(low, high), swap: [i, j], active: [high], pointers: { i, j } },
          { low, high, pivot, i, j, stack: stack() },
        );
      }
    }
    r.swap(i + 1, high);
    r.step('swap', L.place, `Swap arr[${i + 1}] and arr[${high}]: pivot ${pivot} lands at index ${i + 1}, its final position.`, { ...scope(low, high), swap: [i + 1, high] }, { low, high, pivot, i, stack: stack() });
    r.step('return', L.ret, `return ${i + 1}.`, { ...scope(low, high), active: [i + 1] }, { low, high, pivot, i, stack: stack() });
    return i + 1;
  }

  function quick(low: number, high: number): void {
    frames.push([low, high]);
    const go = low < high;
    r.step(
      'call',
      L.check,
      go
        ? `low = ${low} < high = ${high}, so partition arr[${low}..${high}].`
        : `low = ${low}, high = ${high}: ${low === high ? 'a single element is already in place' : 'the range is empty'}, so return.`,
      go ? scope(low, high) : { settled: st() },
      { low, high, stack: stack() },
    );
    if (go) {
      r.step('call', L.partitionCall, `pivotIndex = Partition(arr, ${low}, ${high}).`, scope(low, high), { low, high, stack: stack() });
      const p = partition(low, high);
      settled.add(p);
      r.step('call', L.recurseLeft, `Pivot ${r.values[p]} is final at index ${p}. Recurse on the left part, arr[${low}..${p - 1}].`, { settled: st(), active: [p] }, { low, high, pivotIndex: p, stack: stack() });
      quick(low, p - 1);
      r.step('call', L.recurseRight, `Back in QuickSort(${low}, ${high}). Recurse on the right part, arr[${p + 1}..${high}].`, { settled: st() }, { low, high, pivotIndex: p, stack: stack() });
      quick(p + 1, high);
    } else if (low === high) {
      settled.add(low);
    }
    frames.pop();
  }

  r.step('start', L.signature, `Call QuickSort(arr, 0, ${n - 1}) on the whole array.`, {}, { low: 0, high: n - 1 });
  quick(0, n - 1);
  r.step('done', L.end, `Done: ${r.c.comparisons} comparisons and ${r.c.swaps} swaps (a swap of an element with itself still counts, because the C# line runs).`, { settled: range(n) }, {});
  return r.steps;
}
