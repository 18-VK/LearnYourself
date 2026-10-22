import { lines } from '../../engine/code';
import { SEARCH_CODE } from '../csharp';
import { SearchRecorder, type SearchTrace } from '../recorder';

export const TERNARY_LINES = lines(SEARCH_CODE.ternary, {
  sig: 'int TernaryMaxIndex(int[] arr)',
  init: 'int left = 0, right = arr.Length - 1;',
  loop: 'while (right - left > 2)',
  m1: 'int m1 = left + (right - left) / 3;',
  m2: 'int m2 = right - (right - left) / 3;',
  cmp: 'if (arr[m1] < arr[m2]) left = m1;',
  else: 'else right = m2;',
  best: 'int best = left;',
  scan: 'for (int i = left + 1; i <= right; i++)',
  scanIf: 'if (arr[i] > arr[best]) best = i;',
  ret: 'return best;',
});

/** True when arr strictly increases and then strictly decreases (either part may be empty): the code's precondition. */
export function isStrictlyUnimodal(arr: readonly number[]): boolean {
  let k = 0;
  while (k + 1 < arr.length && arr[k + 1]! > arr[k]!) k++;
  while (k + 1 < arr.length && arr[k + 1]! < arr[k]!) k++;
  return k === arr.length - 1;
}

/** Mirrors TernaryMaxIndex from the notes: two midpoints cut a third of the range per round, then a short scan. */
export function traceTernary(arr: readonly number[]): SearchTrace {
  const L = TERNARY_LINES;
  const r = new SearchRecorder(arr);
  const n = r.n;
  r.step('start', L.sig, `TernaryMaxIndex(arr) looks for the peak of ${n} values that strictly rise and then strictly fall.`, {}, {});
  let left = 0;
  let right = n - 1;
  const hl = (extra: object = {}) => ({ range: [left, right] as [number, number], pointers: { left, right }, ...extra });
  r.step('branch', L.init, `left = 0, right = ${right}.`, hl(), { left, right });
  for (;;) {
    const d = right - left;
    r.step('branch', L.loop, d > 2 ? `right - left = ${d} > 2, so split the range into thirds.` : `right - left = ${d} ≤ 2: at most three candidates remain, so the loop ends.`, hl(), { left, right });
    if (!(d > 2)) break;
    const m1 = left + Math.floor(d / 3);
    r.probe();
    r.step('select', L.m1, `m1 = ${left} + ${d} / 3 = ${m1}.`, hl({ active: [m1], pointers: { left, m1, right } }), { left, right, m1 });
    const m2 = right - Math.floor(d / 3);
    r.probe();
    r.step('select', L.m2, `m2 = ${right} - ${d} / 3 = ${m2}.`, hl({ active: [m1, m2], pointers: { left, m1, m2, right } }), { left, right, m1, m2 });
    const a = r.read(m1);
    const b = r.read(m2);
    r.compare();
    const rising = a < b;
    r.step(
      'compare',
      L.cmp,
      rising
        ? `arr[m1] = ${a} < arr[m2] = ${b}: the values still rise between m1 and m2, so the peak is after m1.`
        : `arr[m1] = ${a} ≥ arr[m2] = ${b}: the values have started to fall by m2, so the peak is before m2.`,
      hl({ compare: [m1, m2], pointers: { left, m1, m2, right } }),
      { left, right, m1, m2 },
      {
        question: `arr[m1] = ${a}, arr[m2] = ${b}. Which part can be thrown away?`,
        options: [`Everything before m1 (left = m1 = ${m1})`, `Everything after m2 (right = m2 = ${m2})`],
        answer: rising ? 0 : 1,
      },
    );
    if (rising) {
      left = m1;
      r.step('write', L.cmp, `left = m1 = ${left}.`, hl(), { left, right, m1, m2 });
    } else {
      right = m2;
      r.step('write', L.else, `right = m2 = ${right}.`, hl(), { left, right, m1, m2 });
    }
  }
  let best = left;
  r.step('branch', L.best, `best = left = ${best}. Check the remaining candidates one by one.`, hl({ active: [best], pointers: { left, best, right } }), { left, right, best });
  for (let i = left + 1; ; i++) {
    if (!(i <= right)) {
      r.step('branch', L.scan, `i = ${i} > right = ${right}, so the scan ends.`, hl({ active: [best], pointers: { best } }), { left, right, best, i });
      break;
    }
    r.step('branch', L.scan, `i = ${i}.`, hl({ active: [best], pointers: { best, i } }), { left, right, best, i });
    const v = r.read(i);
    const w = r.read(best);
    r.compare();
    const bigger = v > w;
    const before = best;
    if (bigger) best = i;
    r.step('compare', L.scanIf, bigger ? `arr[${i}] = ${v} > arr[best] = ${w}, so best = ${i}.` : `arr[${i}] = ${v} is not > arr[best] = ${w}; best stays ${before}.`, hl({ compare: [i, before], pointers: { best, i } }), { left, right, best, i });
  }
  r.step('done', L.ret, `return ${best}: the peak is arr[${best}] = ${arr[best]}, found with ${r.c.comparisons} comparisons.`, { settled: [best], pointers: { best } }, { best }, undefined, String(best));
  return r.steps;
}
