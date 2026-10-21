import { lines } from '../../engine/code';
import { ArrayRecorder, range } from '../../engine/recorder';
import type { AuxArray, Highlights, Trace } from '../../engine/types';
import { SORT_CODE } from '../csharp';

/*
 * Counters policy:
 * - reads/writes count accesses to any array: arr, leftArr and rightArr.
 * - comparisons counts element-value comparisons only (`leftArr[i] <= rightArr[j]`). Loop conditions such
 *   as `i < leftArr.Length` compare indexes and are not counted.
 * - The slice `arr[left..(mid + 1)]` is one read from arr and one write into leftArr per element (same for rightArr).
 * - `arr[k++] = leftArr[i] <= rightArr[j] ? leftArr[i++] : rightArr[j++]` is 2 reads + 1 comparison for the
 *   condition, then 1 read of the chosen element + 1 write to arr. The tail loops are 1 read + 1 write per element.
 * - Merge sort makes no swaps.
 */

const code = SORT_CODE.merge;
export const MERGE_LINES = lines(code, {
  signature: 'void MergeSort(int[] arr, int left, int right)',
  check: 'if (left >= right) return;',
  mid: 'int mid = left + (right - left) / 2;',
  recurseLeft: 'MergeSort(arr, left, mid);',
  recurseRight: 'MergeSort(arr, mid + 1, right);',
  mergeCall: 'Merge(arr, left, mid, right);',
  /** Closing brace of MergeSort (the outer method). */
  end: ['}', 1],
  sliceLeft: 'int[] leftArr = arr[left..(mid + 1)];',
  sliceRight: 'int[] rightArr = arr[(mid + 1)..(right + 1)];',
  init: 'int i = 0, j = 0, k = left;',
  loop: 'while (i < leftArr.Length && j < rightArr.Length)',
  take: 'arr[k++] = leftArr[i] <= rightArr[j] ? leftArr[i++] : rightArr[j++];',
  tailLeft: 'while (i < leftArr.Length) arr[k++] = leftArr[i++];',
  tailRight: 'while (j < rightArr.Length) arr[k++] = rightArr[j++];',
  /** Closing brace of Merge. */
  mergeEnd: ['}', 2],
});
const L = MERGE_LINES;

const span = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);
type AuxHighlight = NonNullable<AuxArray['highlight']>;
const plural = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;

/**
 * Mirrors MergeSort + Merge from the notes: split at mid, sort both halves, then merge the two sorted
 * halves back into arr[left..right] through the leftArr/rightArr copies. Ties take the left element
 * (`<=`), which is what makes the sort stable.
 */
export function traceMerge(input: readonly number[]): Trace {
  const r = new ArrayRecorder(input);
  const n = r.n;
  const frames: string[] = [];
  const stack = () => frames.join(' › ');
  const scope = (left: number, right: number): Highlights => ({
    range: [left, right],
    band: { from: left, to: right, label: `arr[${left}..${right}]` },
  });

  function merge(left: number, mid: number, right: number): void {
    frames.push(`Merge(${left}, ${mid}, ${right})`);
    const lv: number[] = [];
    const lid: (number | null)[] = [];
    const rv: number[] = [];
    const rid: (number | null)[] = [];
    let i = 0;
    let j = 0;
    let k = left;
    let showRight = false;
    /** i, j and k exist only once `int i = 0, j = 0, k = left;` has run. */
    let declared = false;

    /** Rebuilds the leftArr/rightArr panels with this step's highlights and in-range pointers. */
    const show = (lh?: AuxHighlight, rh?: AuxHighlight) => {
      const la: AuxArray = { name: 'leftArr', values: [...lv], ids: [...lid] };
      if (lh) la.highlight = lh;
      if (declared && i < lv.length) la.pointers = { i };
      r.aux = [la];
      if (showRight) {
        const ra: AuxArray = { name: 'rightArr', values: [...rv], ids: [...rid] };
        if (rh) ra.highlight = rh;
        if (declared && j < rv.length) ra.pointers = { j };
        r.aux.push(ra);
      }
    };
    const vars = (): Record<string, number | string> => (declared ? { left, mid, right, i, j, k, stack: stack() } : { left, mid, right, stack: stack() });
    const kPointer = (): Record<string, number> => (k <= right ? { k } : {});

    for (const p of span(left, mid)) {
      lv.push(r.read(p));
      lid.push(r.ids[p]!);
      r.c.writes++;
    }
    show({ write: range(lv.length) });
    r.step(
      'write',
      L.sliceLeft,
      `leftArr = arr[${left}..${mid + 1}] = [${lv.join(', ')}], a copy of indexes ${left} to ${mid}. The end of a C# range is exclusive, so index ${mid + 1} is not included.`,
      { ...scope(left, right), active: span(left, mid) },
      vars(),
    );

    for (const p of span(mid + 1, right)) {
      rv.push(r.read(p));
      rid.push(r.ids[p]!);
      r.c.writes++;
    }
    showRight = true;
    show(undefined, { write: range(rv.length) });
    r.step(
      'write',
      L.sliceRight,
      `rightArr = arr[${mid + 1}..${right + 1}] = [${rv.join(', ')}], a copy of indexes ${mid + 1} to ${right}.`,
      { ...scope(left, right), active: span(mid + 1, right) },
      vars(),
    );

    declared = true;
    show();
    r.step(
      'branch',
      L.init,
      left === 0
        ? 'i = 0 and j = 0 point at the front of leftArr and rightArr. k = 0 is where the next merged value goes in arr.'
        : `i = 0 and j = 0 point at the front of leftArr and rightArr. k = ${left}, not 0, because the merged values go back into arr[${left}..${right}].`,
      { ...scope(left, right), pointers: { k } },
      vars(),
    );

    while (i < lv.length && j < rv.length) {
      const a = lv[i]!;
      const b = rv[j]!;
      r.c.reads += 2;
      r.compare();
      const takeLeft = a <= b;
      const why = takeLeft
        ? a === b
          ? `They are equal, and <= takes the left one, so ${a} from leftArr is written to arr[${k}]. This tie rule keeps equal values in their original order.`
          : `${a} is smaller, so it is written to arr[${k}].`
        : `${b} is smaller, so it is written to arr[${k}].`;
      show({ compare: [i] }, { compare: [j] });
      r.step(
        'compare',
        L.take,
        `Comparing leftArr[${i}] = ${a} with rightArr[${j}] = ${b}. ${why}`,
        { ...scope(left, right), pointers: { k } },
        vars(),
        {
          question: `Which value is written to arr[${k}] next?`,
          options: [`Left: leftArr[${i}] = ${a}`, `Right: rightArr[${j}] = ${b}`],
          answer: takeLeft ? 0 : 1,
        },
      );

      r.c.reads++;
      let narration: string;
      if (takeLeft) {
        r.write(k, a, lid[i]!);
        narration = `arr[${k}] = leftArr[${i}] = ${a}. i++ makes i = ${i + 1}, k++ makes k = ${k + 1}.`;
        i++;
        k++;
        show({ active: [i - 1] });
      } else {
        r.write(k, b, rid[j]!);
        narration = `arr[${k}] = rightArr[${j}] = ${b}. j++ makes j = ${j + 1}, k++ makes k = ${k + 1}.`;
        j++;
        k++;
        show(undefined, { active: [j - 1] });
      }
      r.step('write', L.take, narration, { ...scope(left, right), swap: [k - 1], pointers: kPointer() }, vars());
    }

    show();
    r.step(
      'branch',
      L.loop,
      i >= lv.length
        ? `i = ${i} equals leftArr.Length, so the main loop stops. Whatever is left in rightArr is already sorted and no smaller than anything written so far, so it is copied as is.`
        : `j = ${j} equals rightArr.Length, so the main loop stops. Whatever is left in leftArr is already sorted and no smaller than anything written so far, so it is copied as is.`,
      { ...scope(left, right), pointers: kPointer() },
      vars(),
    );

    if (i >= lv.length) {
      r.step('branch', L.tailLeft, `i = ${i} equals leftArr.Length, so there is nothing left in leftArr.`, { ...scope(left, right), pointers: kPointer() }, vars());
    }
    while (i < lv.length) {
      const v = lv[i]!;
      r.c.reads++;
      r.write(k, v, lid[i]!);
      const text = `arr[${k}] = leftArr[${i}] = ${v}. i = ${i + 1}, k = ${k + 1}.`;
      i++;
      k++;
      show({ active: [i - 1] });
      r.step('write', L.tailLeft, text, { ...scope(left, right), swap: [k - 1], pointers: kPointer() }, vars());
    }

    if (j >= rv.length) {
      show();
      r.step('branch', L.tailRight, `j = ${j} equals rightArr.Length, so there is nothing left in rightArr.`, { ...scope(left, right), pointers: kPointer() }, vars());
    }
    while (j < rv.length) {
      const v = rv[j]!;
      r.c.reads++;
      r.write(k, v, rid[j]!);
      const text = `arr[${k}] = rightArr[${j}] = ${v}. j = ${j + 1}, k = ${k + 1}.`;
      j++;
      k++;
      show(undefined, { active: [j - 1] });
      r.step('write', L.tailRight, text, { ...scope(left, right), swap: [k - 1], pointers: kPointer() }, vars());
    }

    r.aux = undefined;
    r.step(
      'return',
      L.mergeEnd,
      `Merge done: arr[${left}..${right}] = [${r.values.slice(left, right + 1).join(', ')}] is sorted. leftArr and rightArr go out of scope.`,
      scope(left, right),
      vars(),
    );
    frames.pop();
  }

  function sort(left: number, right: number): void {
    frames.push(`MergeSort(${left}, ${right})`);
    const stop = left >= right;
    let text: string;
    if (!stop) text = `left = ${left} < right = ${right}, so split arr[${left}..${right}] in half.`;
    else if (left === right) text = `left = right = ${left}: a single element is already sorted, so return.`;
    else text = `left = ${left} > right = ${right}: the range is empty, so return.`;
    r.step('call', L.check, text, stop && left > right ? {} : scope(left, right), { left, right, stack: stack() });

    if (!stop) {
      const mid = left + Math.floor((right - left) / 2);
      const vars = { left, mid, right, stack: stack() };
      r.step(
        'branch',
        L.mid,
        `mid = ${left} + (${right} - ${left}) / 2 = ${mid}. The left half is arr[${left}..${mid}], the right half is arr[${mid + 1}..${right}].`,
        { ...scope(left, right), pointers: { mid } },
        vars,
      );
      r.step('call', L.recurseLeft, `Sort the left half: MergeSort(arr, ${left}, ${mid}).`, scope(left, mid), vars);
      sort(left, mid);
      r.step('call', L.recurseRight, `Back in MergeSort(${left}, ${right}). Sort the right half: MergeSort(arr, ${mid + 1}, ${right}).`, scope(mid + 1, right), { ...vars, stack: stack() });
      sort(mid + 1, right);
      r.step('call', L.mergeCall, `Back in MergeSort(${left}, ${right}). Both halves are sorted, so Merge(arr, ${left}, ${mid}, ${right}) combines them.`, scope(left, right), { ...vars, stack: stack() });
      merge(left, mid, right);
    }
    frames.pop();
  }

  r.step('start', L.signature, `Call MergeSort(arr, 0, ${n - 1}) on the whole array.`, {}, { left: 0, right: n - 1 });
  sort(0, n - 1);
  r.step(
    'done',
    L.end,
    `Done: ${plural(r.c.comparisons, 'comparison')} and ${plural(r.c.writes, 'write')}, counting the copies into leftArr and rightArr. Merge sort moves values by copying, never by swapping.`,
    { settled: range(n) },
    {},
  );
  return r.steps;
}
