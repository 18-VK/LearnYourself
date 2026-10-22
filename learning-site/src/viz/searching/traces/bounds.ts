import { lines } from '../../engine/code';
import { SEARCH_CODE } from '../csharp';
import { SearchRecorder, span, type SearchTrace } from '../recorder';

export const BOUNDS_LINES = lines(SEARCH_CODE.bounds, {
  lowerSig: 'int LowerBound(int[] arr, int target)',
  lowerInit: ['int left = 0, right = arr.Length;', 1],
  lowerLoop: ['while (left < right)', 1],
  lowerMid: ['int mid = left + (right - left) / 2;', 1],
  lowerCmp: 'if (arr[mid] < target) left = mid + 1;',
  lowerElse: ['else right = mid;', 1],
  lowerRet: ['return left;', 1],
  upperSig: 'int UpperBound(int[] arr, int target)',
  upperInit: ['int left = 0, right = arr.Length;', 2],
  upperLoop: ['while (left < right)', 2],
  upperMid: ['int mid = left + (right - left) / 2;', 2],
  upperCmp: 'if (arr[mid] <= target) left = mid + 1;',
  upperElse: ['else right = mid;', 2],
  upperRet: ['return left;', 2],
});

/**
 * Mirrors LowerBound and then UpperBound from the notes on the same input, and finishes with the note's
 * formulas: count = UpperBound − LowerBound, last occurrence = UpperBound − 1, insertion position = LowerBound.
 * `right` is exclusive, so it can point one past the last element (index n).
 */
export function traceBounds(arr: readonly number[], target: number): SearchTrace {
  const L = BOUNDS_LINES;
  const r = new SearchRecorder(arr);
  const n = r.n;

  function bound(kind: 'lower' | 'upper'): number {
    const lower = kind === 'lower';
    const name = lower ? 'LowerBound' : 'UpperBound';
    const op = lower ? '<' : '<=';
    const goal = lower ? `the first index where arr[i] >= ${target}` : `the first index where arr[i] > ${target}`;
    const ln = lower
      ? { sig: L.lowerSig, init: L.lowerInit, loop: L.lowerLoop, mid: L.lowerMid, cmp: L.lowerCmp, else: L.lowerElse, ret: L.lowerRet }
      : { sig: L.upperSig, init: L.upperInit, loop: L.upperLoop, mid: L.upperMid, cmp: L.upperCmp, else: L.upperElse, ret: L.upperRet };
    r.step('call', ln.sig, `${name}(arr, ${target}) looks for ${goal}.`, {}, { fn: name, target });
    let left = 0;
    let right = n;
    // `range` is inclusive, so the half-open [left, right) shows as [left, right - 1].
    const hl = (extra: object = {}) => ({ range: [left, right - 1] as [number, number], pointers: { left, right }, ...extra });
    r.step('branch', ln.init, `left = 0, right = arr.Length = ${n}. right is exclusive: the answer can be ${n}, one past the end.`, hl(), { fn: name, target, left, right });
    for (;;) {
      const go = left < right;
      r.step('branch', ln.loop, go ? `left = ${left} < right = ${right}: candidates ${left}..${right}.` : `left = ${left} == right = ${right}: one candidate is left, so the loop ends.`, hl(), { fn: name, target, left, right });
      if (!go) break;
      const mid = left + Math.floor((right - left) / 2);
      r.probe();
      r.step('select', ln.mid, `mid = ${left} + (${right} - ${left}) / 2 = ${mid}.`, hl({ active: [mid], pointers: { left, mid, right } }), { fn: name, target, left, right, mid });
      const v = r.read(mid);
      r.compare();
      const yes = lower ? v < target : v <= target;
      r.step(
        'compare',
        ln.cmp,
        yes
          ? `Is arr[${mid}] = ${v} ${op} ${target}? Yes, so index ${mid} and everything before it are too early.`
          : `Is arr[${mid}] = ${v} ${op} ${target}? No, so mid could be the answer; keep it and look left.`,
        hl({ compare: [mid], pointers: { left, mid, right } }),
        { fn: name, target, left, right, mid },
        {
          question: `arr[${mid}] = ${v}. Which way does ${name} move?`,
          options: [`left = mid + 1 (answer is after ${mid})`, `right = mid (answer is ${mid} or before)`],
          answer: yes ? 0 : 1,
        },
      );
      if (yes) {
        left = mid + 1;
        r.step('write', ln.cmp, `left = mid + 1 = ${left}.`, hl(), { fn: name, target, left, right, mid });
      } else {
        right = mid;
        r.step('write', ln.else, `right = mid = ${right}. mid stays a candidate: the answer is at most ${right}.`, hl(), { fn: name, target, left, right, mid });
      }
    }
    r.step('return', ln.ret, `${name} returns ${left}: ${goal} is ${left}${left === n ? ' (no such element, so arr.Length)' : ''}.`, { pointers: { [lower ? 'lower' : 'upper']: left } }, { fn: name, target, result: left });
    return left;
  }

  const lower = bound('lower');
  const upper = bound('upper');
  const count = upper - lower;
  const present = lower < n && arr[lower] === target;
  const firstText = present
    ? `first occurrence = lower = ${lower} (valid because arr[${lower}] == ${target})`
    : lower === n
      ? `lower = ${lower} = arr.Length, so there is no arr[${lower}] to check: ${target} is absent`
      : `arr[${lower}] = ${arr[lower]} ≠ ${target}, so ${target} is absent`;
  r.step(
    'done',
    L.upperRet,
    present
      ? `LowerBound = ${lower}, UpperBound = ${upper}. Count = ${upper} - ${lower} = ${count}; ${firstText}; last occurrence = UpperBound - 1 = ${upper - 1}.`
      : `LowerBound = ${lower}, UpperBound = ${upper}. Count = ${upper} - ${lower} = 0; ${firstText}. Insertion position = LowerBound = ${lower}.`,
    present ? { settled: span(lower, upper - 1), pointers: { lower, upper }, band: { from: lower, to: upper - 1, label: `count = ${count}` } } : { pointers: { lower, upper } },
    { target, lower, upper, count },
    undefined,
    `LowerBound = ${lower}, UpperBound = ${upper}`,
  );
  return r.steps;
}
