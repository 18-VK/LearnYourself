import { lines } from '../../engine/code';
import { SEARCH_CODE } from '../csharp';
import { SearchRecorder, type SearchTrace } from '../recorder';

export const INTERPOLATION_LINES = lines(SEARCH_CODE.interpolation, {
  sig: 'int InterpolationSearch(int[] arr, int target)',
  init: 'int left = 0, right = arr.Length - 1;',
  loop: 'while (left <= right && target >= arr[left] && target <= arr[right])',
  same: 'if (arr[left] == arr[right])',
  sameRet: 'return arr[left] == target ? left : -1;',
  pos: 'int pos = left + (int)(((long)(target - arr[left]) * (right - left))',
  eq: 'if (arr[pos] == target) return pos;',
  lt: 'if (arr[pos] < target) left = pos + 1;',
  else: 'else right = pos - 1;',
  notFound: 'return -1;',
});

/** Mirrors InterpolationSearch from the notes: probe where the target "should" be if values were evenly spread. */
export function traceInterpolation(arr: readonly number[], target: number): SearchTrace {
  const L = INTERPOLATION_LINES;
  const r = new SearchRecorder(arr);
  const n = r.n;
  r.step('start', L.sig, `InterpolationSearch(arr, target = ${target}) on a sorted array of ${n} elements.`, {}, { target });
  let left = 0;
  let right = n - 1;
  const hl = (extra: object = {}) => ({ range: [left, right] as [number, number], pointers: { left, right }, ...extra });
  r.step('branch', L.init, `left = 0, right = ${right}.`, hl(), { target, left, right });
  for (;;) {
    // while (left <= right && target >= arr[left] && target <= arr[right]), with && short-circuiting
    let why: string;
    let go = left <= right;
    const cmp: number[] = [];
    if (!go) why = `left = ${left} > right = ${right}: the range is empty, so the loop ends.`;
    else {
      const a = r.read(left);
      r.compare();
      cmp.push(left);
      if (target < a) {
        go = false;
        why = `target ${target} < arr[left] = ${a}: it is smaller than everything left in range, so the loop ends.`;
      } else {
        const b = r.read(right);
        r.compare();
        cmp.push(right);
        if (target > b) {
          go = false;
          why = `target ${target} > arr[right] = ${b}: it is larger than everything left in range, so the loop ends.`;
        } else why = `${a} ≤ ${target} ≤ ${b}: the target is inside the value range of arr[${left}..${right}].`;
      }
    }
    r.step('compare', L.loop, why, hl({ compare: cmp }), { target, left, right });
    if (!go) break;
    const a = r.read(left);
    const b = r.read(right);
    r.compare();
    if (a === b) {
      r.step('compare', L.same, `arr[left] == arr[right] (both ${a}): every value in range is ${a}, and the formula would divide by zero.`, hl({ compare: [left, right] }), { target, left, right });
      r.read(left);
      r.compare();
      const res = a === target ? left : -1;
      r.step('done', L.sameRet, `arr[left] ${a === target ? '==' : '≠'} ${target}, so return ${res}.`, res >= 0 ? { settled: [res], pointers: { left } } : hl(), { target, left, right }, undefined, String(res));
      return r.steps;
    }
    r.step('compare', L.same, `arr[left] = ${a} ≠ arr[right] = ${b}, so the formula is safe.`, hl({ compare: [left, right] }), { target, left, right });
    r.countReads(3); // arr[left] twice and arr[right] once in the formula
    // C# integer division truncates toward zero; every term is non-negative here, so this is a floor.
    const pos = left + Math.floor(((target - a) * (right - left)) / (b - a));
    r.probe();
    r.step(
      'select',
      L.pos,
      `pos = ${left} + (${target} - ${a}) × (${right} - ${left}) / (${b} - ${a}) = ${left} + ${(target - a) * (right - left)} / ${b - a} = ${pos}. The probe lands where ${target} would be if the values were evenly spread.`,
      hl({ active: [pos], pointers: { left, pos, right } }),
      { target, left, right, pos },
    );
    const v = r.read(pos);
    r.compare();
    if (v === target) {
      r.step('compare', L.eq, `Comparing arr[${pos}] = ${v} with target ${target}: equal.`, hl({ compare: [pos], pointers: { left, pos, right } }), { target, left, right, pos });
      r.step('done', L.eq, `return ${pos}. Found after ${r.probes} probe${r.probes === 1 ? '' : 's'}.`, { settled: [pos], pointers: { pos } }, { target, pos }, undefined, String(pos));
      return r.steps;
    }
    r.step('compare', L.eq, `Comparing arr[${pos}] = ${v} with target ${target}: not equal.`, hl({ compare: [pos], pointers: { left, pos, right } }), { target, left, right, pos });
    r.read(pos);
    r.compare();
    const less = v < target;
    r.step(
      'compare',
      L.lt,
      `Is arr[${pos}] = ${v} < ${target}? ${less ? 'Yes, so the target is to the right of pos.' : 'No, so the target is to the left of pos.'}`,
      hl({ compare: [pos], pointers: { left, pos, right } }),
      { target, left, right, pos },
      { question: `arr[${pos}] = ${v}, target ${target}. Where does the search continue?`, options: [`Left of pos (right = ${pos - 1})`, `Right of pos (left = ${pos + 1})`], answer: less ? 1 : 0 },
    );
    if (less) {
      left = pos + 1;
      r.step('write', L.lt, `left = pos + 1 = ${left}.`, hl(), { target, left, right, pos });
    } else {
      right = pos - 1;
      r.step('write', L.else, `right = pos - 1 = ${right}.`, hl(), { target, left, right, pos });
    }
  }
  r.step('done', L.notFound, `return -1. ${target} is not in the array (${r.probes} probe${r.probes === 1 ? '' : 's'}).`, hl(), { target, left, right }, undefined, '-1');
  return r.steps;
}
