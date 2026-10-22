import { lines } from '../../engine/code';
import { SEARCH_CODE } from '../csharp';
import { SearchRecorder, type SearchTrace } from '../recorder';

export const JUMP_LINES = lines(SEARCH_CODE.jump, {
  sig: 'int JumpSearch(int[] arr, int target)',
  n: 'int n = arr.Length;',
  step: 'int step = (int)Math.Sqrt(n);',
  prev: 'int prev = 0;',
  loop: 'while (prev < n && arr[Math.Min(step, n) - 1] < target)',
  prevSet: 'prev = step;',
  stepAdd: 'step += (int)Math.Sqrt(n);',
  overshoot: 'if (prev >= n) return -1;',
  scan: 'for (int i = prev; i < Math.Min(step, n); i++)',
  eq: 'if (arr[i] == target) return i;',
  notFound: ['return -1;', 2],
});

/** Mirrors JumpSearch from the notes: jump in blocks of (int)Math.Sqrt(n), then scan the last block. */
export function traceJump(arr: readonly number[], target: number): SearchTrace {
  const L = JUMP_LINES;
  const r = new SearchRecorder(arr);
  const n = r.n;
  const root = Math.floor(Math.sqrt(n));
  r.step('start', L.sig, `JumpSearch(arr, target = ${target}) on a sorted array of ${n} elements.`, {}, { target });
  r.step('branch', L.n, `n = ${n}.`, {}, { target, n });
  let step = root;
  r.step('branch', L.step, `step = (int)Math.Sqrt(${n}) = ${step}. The array is checked in blocks of ${step}.`, {}, { target, n, step });
  let prev = 0;
  const block = () => {
    const end = Math.min(step, n) - 1;
    return end >= prev ? { band: { from: prev, to: end, label: `block ${prev}..${end}` } } : {};
  };
  r.step('branch', L.prev, 'prev = 0: the first block starts at index 0.', { ...block(), pointers: { prev } }, { target, n, step, prev });
  for (;;) {
    if (!(prev < n)) {
      r.step('branch', L.loop, `prev = ${prev} is not < n = ${n}, so the loop ends.`, {}, { target, n, step, prev });
      break;
    }
    const last = Math.min(step, n) - 1;
    const v = r.read(last);
    r.compare();
    r.probe();
    const jump = v < target;
    r.step(
      'compare',
      L.loop,
      jump
        ? `The block's last element arr[${last}] = ${v} < ${target}, so the target is beyond this block: jump.`
        : `The block's last element arr[${last}] = ${v} is not < ${target}, so if ${target} is anywhere, it is in this block.`,
      { ...block(), compare: [last], range: [prev, n - 1], pointers: { prev, end: last } },
      { target, n, step, prev },
      {
        question: `Block ${prev}..${last} ends with arr[${last}] = ${v}. What does jump search do next?`,
        options: ['Jump to the next block', `Scan this block for ${target}`],
        answer: jump ? 0 : 1,
      },
    );
    if (!jump) break;
    prev = step;
    r.step('write', L.prevSet, `prev = step = ${prev}.`, { range: [Math.min(prev, n), n - 1], pointers: prev <= n ? { prev } : {} }, { target, n, step, prev });
    step += root;
    r.step('write', L.stepAdd, `step += ${root} makes step = ${step}.`, { ...block(), range: [Math.min(prev, n), n - 1], pointers: prev <= n ? { prev } : {} }, { target, n, step, prev });
    if (prev >= n) {
      r.step('done', L.overshoot, `prev = ${prev} ≥ n = ${n}: we jumped past the end, so return -1. Every element is smaller than ${target}.`, { range: [n, n - 1] }, { target, n, step, prev }, undefined, '-1');
      return r.steps;
    }
    r.step('branch', L.overshoot, `prev = ${prev} < n = ${n}, so check the next block.`, { ...block(), range: [prev, n - 1], pointers: { prev } }, { target, n, step, prev });
  }
  const stop = Math.min(step, n);
  const scope = (i?: number) => ({ ...block(), range: [prev, stop - 1] as [number, number], ...(i !== undefined ? { pointers: { i } } : {}) });
  for (let i = prev; ; i++) {
    if (!(i < stop)) {
      r.step('branch', L.scan, `i = ${i} is not < Math.Min(step, n) = ${stop}: the block is exhausted.`, scope(), { target, prev, step, i });
      break;
    }
    r.step('branch', L.scan, i === prev ? `Linear scan of the block: i = prev = ${i}.` : `i++ makes i = ${i}.`, scope(i), { target, prev, step, i });
    const v = r.read(i);
    r.compare();
    r.probe();
    const eq = v === target;
    r.step('compare', L.eq, `Comparing arr[${i}] = ${v} with target ${target}: ${eq ? 'equal' : 'not equal'}.`, { ...scope(i), compare: [i] }, { target, prev, step, i });
    if (eq) {
      r.step('done', L.eq, `return ${i}. Found after ${r.probes} probes (block ends and scanned elements).`, { settled: [i], pointers: { i } }, { target, i }, undefined, String(i));
      return r.steps;
    }
  }
  r.step('done', L.notFound, `return -1. ${target} is not in the array.`, { range: [n, n - 1] }, { target }, undefined, '-1');
  return r.steps;
}
