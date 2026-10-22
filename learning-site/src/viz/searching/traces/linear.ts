import { lines } from '../../engine/code';
import { SEARCH_CODE } from '../csharp';
import { SearchRecorder, type SearchTrace } from '../recorder';

const code = SEARCH_CODE.linear;
export const LINEAR_LINES = lines(code, {
  sig: 'int LinearSearch(int[] arr, int target)',
  loop: 'for (int i = 0; i < arr.Length; i++)',
  check: 'if (arr[i] == target) return i;',
  notFound: 'return -1;',
});
const L = LINEAR_LINES;

/** Mirrors LinearSearch from the notes: compare every element with the target, left to right. */
export function traceLinear(arr: readonly number[], target: number): SearchTrace {
  const r = new SearchRecorder(arr);
  const n = r.n;
  r.step('start', L.sig, `LinearSearch(arr, target = ${target}) checks the elements one by one from index 0. The array does not need to be sorted.`, {}, { target });
  for (let i = 0; i < n; i++) {
    r.step('branch', L.loop, i === 0 ? `i = 0. 0 < ${n}, so the loop starts.` : `i++ makes i = ${i}. ${i} < ${n}, so the loop continues.`, { range: [i, n - 1], pointers: { i } }, { target, i });
    const v = r.read(i);
    r.compare();
    r.probe();
    const eq = v === target;
    r.step(
      'compare',
      L.check,
      `Comparing arr[${i}] = ${v} with target ${target}. ${eq ? 'They are equal.' : `${v} ≠ ${target}, so keep going.`}`,
      { range: [i, n - 1], compare: [i], pointers: { i } },
      { target, i },
    );
    if (eq) {
      r.step('done', L.check, `return ${i}. Found after ${r.c.comparisons} comparison${r.c.comparisons === 1 ? '' : 's'}.`, { settled: [i], pointers: { i } }, { target, i }, undefined, String(i));
      return r.steps;
    }
  }
  r.step('branch', L.loop, n === 0 ? `i = 0. 0 < 0 is false: the array is empty, so the loop never runs.` : `i++ makes i = ${n}. ${n} < ${n} is false, so the loop ends.`, { range: [n, n - 1] }, { target, i: n });
  r.step('done', L.notFound, `return -1. ${target} is not in the array: all ${n} elements were compared, the worst case.`, { range: [n, n - 1] }, { target }, undefined, '-1');
  return r.steps;
}
