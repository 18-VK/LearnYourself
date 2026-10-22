import { lines } from '../../engine/code';
import { SEARCH_CODE } from '../csharp';
import { halfQuestion } from './binary';
import { SearchRecorder, type SearchTrace } from '../recorder';

export const EXPONENTIAL_LINES = lines(SEARCH_CODE.exponential, {
  sig: 'int ExponentialSearch(int[] arr, int target)',
  empty: 'if (arr.Length == 0) return -1;',
  first: 'if (arr[0] == target) return 0;',
  boundInit: 'int bound = 1;',
  loop: 'while (bound < arr.Length && arr[bound] <= target)',
  double: 'bound *= 2;',
  left: 'int left = bound / 2;',
  right: 'int right = Math.Min(bound, arr.Length - 1);',
  bs: 'return Array.BinarySearch(arr, left, right - left + 1, target) is int idx && idx >= 0',
  bsRet: '? idx : -1;',
});

/**
 * Mirrors ExponentialSearch from the notes. The `Array.BinarySearch(arr, index, length, value)` call is
 * expanded into its own steps, following the loop in dotnet/runtime's ArraySortHelper<T>.BinarySearch:
 * lo = index, hi = index + length - 1, i = lo + ((hi - lo) >> 1), return i on a match, ~lo when not found.
 * https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/ArraySortHelper.cs
 */
export function traceExponential(arr: readonly number[], target: number): SearchTrace {
  const L = EXPONENTIAL_LINES;
  const r = new SearchRecorder(arr);
  const n = r.n;
  r.step('start', L.sig, `ExponentialSearch(arr, target = ${target}) on a sorted array of ${n} elements.`, {}, { target });
  if (n === 0) {
    r.step('done', L.empty, 'arr.Length == 0, so return -1.', {}, { target }, undefined, '-1');
    return r.steps;
  }
  r.step('branch', L.empty, `arr.Length = ${n}, not empty.`, {}, { target });
  const a0 = r.read(0);
  r.compare();
  r.probe();
  if (a0 === target) {
    r.step('compare', L.first, `arr[0] = ${a0} == ${target}.`, { compare: [0] }, { target });
    r.step('done', L.first, 'return 0. The target is the first element.', { settled: [0] }, { target }, undefined, '0');
    return r.steps;
  }
  r.step('compare', L.first, `arr[0] = ${a0} ≠ ${target}.`, { compare: [0] }, { target });
  let bound = 1;
  r.step('branch', L.boundInit, 'bound = 1.', { pointers: { bound } }, { target, bound });
  for (;;) {
    if (!(bound < n)) {
      r.step('branch', L.loop, `bound = ${bound} is not < arr.Length = ${n}: the doubling ran off the end, so it stops.`, {}, { target, bound });
      break;
    }
    const v = r.read(bound);
    r.compare();
    r.probe();
    const more = v <= target;
    r.step(
      'compare',
      L.loop,
      more ? `arr[${bound}] = ${v} ≤ ${target}: the target is further right, so double bound.` : `arr[${bound}] = ${v} > ${target}: the target, if present, lies between bound / 2 and bound.`,
      { compare: [bound], pointers: { bound } },
      { target, bound },
      { question: `arr[${bound}] = ${v}. Does bound double again?`, options: ['Yes, double it', 'No, stop and binary search'], answer: more ? 0 : 1 },
    );
    if (!more) break;
    bound *= 2;
    r.step('write', L.double, `bound *= 2 makes bound = ${bound}.`, bound < n ? { pointers: { bound } } : {}, { target, bound });
  }
  const left = Math.floor(bound / 2);
  r.step(
    'branch',
    L.left,
    bound > 1 ? `left = bound / 2 = ${left}, the previous bound, where arr[${left}] = ${arr[left]} ≤ ${target}.` : `left = bound / 2 = ${left}.`,
    { range: [left, n - 1], pointers: { left } },
    { target, bound, left },
  );
  const right = Math.min(bound, n - 1);
  const band = { from: left, to: right, label: `binary search ${left}..${right}` };
  r.step('branch', L.right, `right = Math.Min(${bound}, ${n - 1}) = ${right}.`, { range: [left, right], band, pointers: { left, right } }, { target, bound, left, right });

  // Inside Array.BinarySearch(arr, left, right - left + 1, target)
  const length = right - left + 1;
  let lo = left;
  let hi = left + length - 1;
  const inside = (extra: object = {}) => ({ range: [lo, hi] as [number, number], band, pointers: { lo, hi }, ...extra });
  const bsVars = (extra: Record<string, number> = {}) => ({ target, left, right, lo, hi, ...extra });
  r.step('call', L.bs, `Array.BinarySearch(arr, ${left}, ${length}, ${target}) searches arr[${left}..${right}]. Inside it: lo = ${lo}, hi = ${hi}.`, inside(), bsVars());
  let idx: number | null = null;
  while (lo <= hi) {
    const i = lo + ((hi - lo) >> 1);
    r.probe();
    r.step('select', L.bs, `Inside Array.BinarySearch: i = lo + ((hi - lo) >> 1) = ${i}.`, inside({ active: [i], pointers: { lo, i, hi } }), bsVars({ i }));
    const v = r.read(i);
    r.compare();
    if (v === target) {
      r.step('compare', L.bs, `arr[${i}].CompareTo(${target}) == 0: found at ${i}.`, inside({ compare: [i], pointers: { lo, i, hi } }), bsVars({ i }));
      idx = i;
      break;
    }
    const less = v < target;
    r.step(
      'compare',
      L.bs,
      `arr[${i}] = ${v} is ${less ? 'less' : 'greater'} than ${target}, so ${less ? `lo = i + 1 = ${i + 1}` : `hi = i - 1 = ${i - 1}`}.`,
      inside({ compare: [i], pointers: { lo, i, hi } }),
      bsVars({ i }),
      halfQuestion(i, v, target, lo, hi),
    );
    if (less) lo = i + 1;
    else hi = i - 1;
  }
  if (idx !== null) {
    r.step('done', L.bs, `Array.BinarySearch returned ${idx}. idx = ${idx} ≥ 0, so return ${idx}. Found after ${r.probes} probes.`, { settled: [idx], pointers: { idx } }, { target, idx }, undefined, String(idx));
    return r.steps;
  }
  const neg = ~lo;
  r.step('return', L.bs, `lo = ${lo} > hi = ${hi}: not found, so Array.BinarySearch returns ~lo = ${neg}, a negative number (the complement of the insertion index).`, { range: [lo, hi], band }, bsVars({ idx: neg }));
  r.step('done', L.bsRet, `idx = ${neg} < 0, so return -1. ${target} is not in the array.`, { range: [n, n - 1] }, { target, idx: neg }, undefined, '-1');
  return r.steps;
}
