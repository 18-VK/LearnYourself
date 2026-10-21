import { lines } from '../../engine/code';
import { ArrayRecorder, range } from '../../engine/recorder';
import type { Trace } from '../../engine/types';
import { SORT_CODE } from '../csharp';

const code = SORT_CODE.insertion;
export const INSERTION_LINES = {
  ...lines(code, {
    outer: 'for (int i = 1; i < arr.Length; i++)',
    key: 'int key = arr[i];',
    j: 'int j = i - 1;',
    loop: 'while (j >= 0 && arr[j] > key)',
    shift: 'arr[j + 1] = arr[j];',
    dec: 'j--;',
    place: 'arr[j + 1] = key;',
  }),
  end: code.split('\n').length,
};
const L = INSERTION_LINES;

/** Mirrors InsertionSort from the notes: shift larger values right, then write the key into the gap. */
export function traceInsertion(input: readonly number[]): Trace {
  const r = new ArrayRecorder(input);
  const n = r.n;
  const sortedPortion = (to: number) => ({ from: 0, to, label: 'sorted portion' });

  for (let i = 1; i < n; i++) {
    const band = sortedPortion(i - 1);
    r.step('branch', L.outer, `Outer loop: i = ${i}. arr[0..${i - 1}] is the sorted portion.`, { band, pointers: { i } }, { i });
    const key = r.read(i);
    const keyId = r.ids[i]!;
    r.step('read', L.key, `key = arr[${i}] = ${key}. This is the value to insert.`, { active: [i], band, pointers: { i } }, { i, key });
    let j = i - 1;
    r.step('branch', L.j, `j = ${j}: start comparing from the right end of the sorted portion.`, { active: [i], band, pointers: { i, j } }, { i, key, j });
    for (;;) {
      if (j < 0) {
        r.step('branch', L.loop, 'j = -1, so the loop stops. Because && short-circuits, arr[j] is never read.', { band, pointers: { i } }, { i, key, j });
        break;
      }
      const v = r.read(j);
      r.compare();
      const gt = v > key;
      r.step(
        'compare',
        L.loop,
        `Comparing arr[${j}] = ${v} with key ${key}. ${gt ? `${v} is larger, so it shifts one place right.` : `${v} is not larger, so the loop stops.`}`,
        { compare: [j], band, pointers: { i, j } },
        { i, key, j },
        { question: `Is arr[${j}] = ${v} larger than key ${key}?`, options: ['Yes, shift it right', 'No, stop here'], answer: gt ? 0 : 1 },
      );
      if (!gt) break;
      r.write(j + 1, r.read(j), r.ids[j]!);
      r.step('write', L.shift, `arr[${j + 1}] = arr[${j}] = ${v}. The value sits in two places until the key is written.`, { swap: [j + 1], band, pointers: { i, j } }, { i, key, j });
      j--;
      r.step('branch', L.dec, `j-- makes j = ${j}.`, { band, pointers: j >= 0 ? { i, j } : { i } }, { i, key, j });
    }
    r.write(j + 1, key, keyId);
    r.step('write', L.place, `arr[${j + 1}] = key = ${key}. arr[0..${i}] is now in order.`, { active: [j + 1], band: sortedPortion(i), pointers: { i } }, { i, key, j });
  }
  r.step('done', L.end, `Done: ${r.c.comparisons} comparisons and ${r.c.writes} writes. Insertion sort shifts values instead of swapping them.`, { settled: range(n) }, {});
  return r.steps;
}
