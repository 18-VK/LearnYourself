import { lines } from '../../engine/code';
import { SEARCH_CODE } from '../csharp';
import { SearchRecorder, type SearchTrace } from '../recorder';

export const SQRT_LINES = lines(SEARCH_CODE.sqrt, {
  sig: 'int MySqrt(int x)',
  init: 'int lo = 0, hi = x, ans = 0;',
  loop: 'while (lo <= hi)',
  mid: 'int mid = lo + (hi - lo) / 2;',
  check: 'if ((long)mid * mid <= x) { ans = mid; lo = mid + 1; }',
  else: 'else hi = mid - 1;',
  ret: 'return ans;',
});

/** Largest x the visualizer accepts: the answer space 0..x is drawn as one cell per candidate. */
export const SQRT_MAX_X = 99;

/**
 * Mirrors MySqrt from the notes (binary search on the answer). The "array" is the answer space 0..x:
 * values[k] = k. Each probed candidate is marked ✓ when mid * mid <= x and ✗ otherwise, which shows the
 * monotonic true…true, false…false pattern the note's idea relies on.
 */
export function traceSqrt(x: number): SearchTrace {
  const L = SQRT_LINES;
  const r = new SearchRecorder(Array.from({ length: x + 1 }, (_, k) => k));
  r.marks = new Array<string | null>(x + 1).fill(null);
  r.step('start', L.sig, `MySqrt(${x}): find the largest whole number whose square is ≤ ${x}. The candidates are 0..${x}.`, {}, { x });
  let lo = 0;
  let hi = x;
  let ans = 0;
  const ptr = (extra: Record<string, number> = {}) => ({ lo, hi, ...extra, ...(ans > 0 || lo > 0 ? { ans } : {}) });
  r.step('branch', L.init, `lo = 0, hi = x = ${x}, ans = 0.`, { range: [lo, hi], pointers: ptr() }, { x, lo, hi, ans });
  for (;;) {
    const go = lo <= hi;
    r.step('branch', L.loop, go ? `lo = ${lo} ≤ hi = ${hi}: ${hi - lo + 1} candidate${hi === lo ? '' : 's'} left.` : `lo = ${lo} > hi = ${hi}: no candidates left, so the loop ends.`, { range: [lo, hi], pointers: ptr() }, { x, lo, hi, ans });
    if (!go) break;
    const mid = lo + Math.floor((hi - lo) / 2);
    r.probe();
    r.step('select', L.mid, `mid = ${lo} + (${hi} - ${lo}) / 2 = ${mid}.`, { range: [lo, hi], active: [mid], pointers: ptr({ mid }) }, { x, lo, hi, ans, mid });
    r.compare();
    const ok = mid * mid <= x;
    r.step(
      'compare',
      L.check,
      ok
        ? `${mid} × ${mid} = ${mid * mid} ≤ ${x}: ${mid} works, and so does every smaller candidate.`
        : `${mid} × ${mid} = ${mid * mid} > ${x}: ${mid} is too big, and so is every larger candidate.`,
      { range: [lo, hi], compare: [mid], pointers: ptr({ mid }) },
      { x, lo, hi, ans, mid, 'mid * mid': mid * mid },
      {
        question: `Is ${mid} × ${mid} ≤ ${x}?`,
        options: [`Yes: ans = ${mid}, then search higher`, 'No: search lower'],
        answer: ok ? 0 : 1,
      },
    );
    r.marks![mid] = ok ? '✓' : '✗';
    if (ok) {
      ans = mid;
      lo = mid + 1;
      r.step('write', L.check, `ans = ${mid}, lo = mid + 1 = ${lo}. The best answer so far is ${ans}; look for a bigger one.`, { range: [lo, hi], active: [ans], pointers: ptr() }, { x, lo, hi, ans, mid });
    } else {
      hi = mid - 1;
      r.step('write', L.else, `hi = mid - 1 = ${hi}.`, { range: [lo, hi], pointers: ptr() }, { x, lo, hi, ans, mid });
    }
  }
  r.step('done', L.ret, `return ${ans}: ${ans} × ${ans} = ${ans * ans} ≤ ${x} < ${ans + 1} × ${ans + 1} = ${(ans + 1) * (ans + 1)}. That took ${r.probes} checks instead of trying all ${x + 1} candidates.`, { settled: [ans], pointers: { ans } }, { x, ans }, undefined, String(ans));
  return r.steps;
}
