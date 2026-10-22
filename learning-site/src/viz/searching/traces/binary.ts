import { lines } from '../../engine/code';
import type { Prediction } from '../../engine/types';
import { SEARCH_CODE } from '../csharp';
import { SearchRecorder, type SearchTrace } from '../recorder';

export const BINARY_LINES = lines(SEARCH_CODE.binary, {
  sig: 'int BinarySearch(int[] arr, int target)',
  init: 'int left = 0, right = arr.Length - 1;',
  loop: 'while (left <= right)',
  mid: 'int mid = left + (right - left) / 2;',
  eq: 'if (arr[mid] == target) return mid;',
  lt: 'if (arr[mid] < target) left = mid + 1;',
  else: 'else right = mid - 1;',
  notFound: 'return -1;',
});

export const BINARY_REC_LINES = lines(SEARCH_CODE.binaryRec, {
  sig: 'int BinarySearchRec(int[] arr, int target, int left, int right)',
  base: 'if (left > right) return -1;',
  mid: 'int mid = left + (right - left) / 2;',
  eq: 'if (arr[mid] == target) return mid;',
  ret: 'return arr[mid] < target',
  goRight: '? BinarySearchRec(arr, target, mid + 1, right)',
  goLeft: ': BinarySearchRec(arr, target, left, mid - 1);',
});

const rangeText = (a: number, b: number) => (a > b ? 'nothing' : a === b ? `arr[${a}]` : `arr[${a}..${b}]`);

/** The predict-mode question asked before binary search reveals which half it keeps. */
export function halfQuestion(mid: number, v: number, target: number, left: number, right: number): Prediction {
  return {
    question: `arr[${mid}] = ${v} and the target is ${target}. Which half can still hold the target?`,
    options: [`The left half, ${rangeText(left, mid - 1)}`, `The right half, ${rangeText(mid + 1, right)}`],
    answer: v < target ? 1 : 0,
  };
}

/** Mirrors the iterative BinarySearch from the notes. */
export function traceBinary(arr: readonly number[], target: number): SearchTrace {
  const L = BINARY_LINES;
  const r = new SearchRecorder(arr);
  const n = r.n;
  r.step('start', L.sig, `BinarySearch(arr, target = ${target}) on a sorted array of ${n} elements.`, {}, { target });
  let left = 0;
  let right = n - 1;
  r.step('branch', L.init, `left = 0, right = arr.Length - 1 = ${right}. The search range is the whole array.`, { range: [left, right], pointers: { left, right } }, { target, left, right });
  for (;;) {
    const go = left <= right;
    r.step(
      'branch',
      L.loop,
      go
        ? `left = ${left} ≤ right = ${right}: ${right - left + 1} element${right === left ? '' : 's'} left to search.`
        : `left = ${left} > right = ${right}: the range is empty, so the loop ends.`,
      { range: [left, right], pointers: { left, right } },
      { target, left, right },
    );
    if (!go) break;
    const mid = left + Math.floor((right - left) / 2);
    r.probe();
    r.step('select', L.mid, `mid = ${left} + (${right} - ${left}) / 2 = ${mid}. Integer division rounds down.`, { range: [left, right], active: [mid], pointers: { left, mid, right } }, { target, left, right, mid });
    const v = r.read(mid);
    r.compare();
    if (v === target) {
      r.step('compare', L.eq, `Comparing arr[${mid}] = ${v} with target ${target}: equal.`, { range: [left, right], compare: [mid], pointers: { left, mid, right } }, { target, left, right, mid });
      r.step('done', L.eq, `return ${mid}. Found after ${r.probes} probe${r.probes === 1 ? '' : 's'}.`, { settled: [mid], pointers: { mid } }, { target, mid }, undefined, String(mid));
      return r.steps;
    }
    r.step('compare', L.eq, `Comparing arr[${mid}] = ${v} with target ${target}: not equal.`, { range: [left, right], compare: [mid], pointers: { left, mid, right } }, { target, left, right, mid });
    r.read(mid);
    r.compare();
    const less = v < target;
    r.step(
      'compare',
      L.lt,
      less
        ? `Is arr[${mid}] = ${v} < ${target}? Yes. Everything up to mid is too small, so only the right half can hold ${target}.`
        : `Is arr[${mid}] = ${v} < ${target}? No, ${v} > ${target}. Everything from mid on is too big, so only the left half can hold ${target}.`,
      { range: [left, right], compare: [mid], pointers: { left, mid, right } },
      { target, left, right, mid },
      halfQuestion(mid, v, target, left, right),
    );
    if (less) {
      const old = left;
      left = mid + 1;
      r.step('write', L.lt, `left = mid + 1 = ${left}. ${rangeText(old, mid)} is ruled out.`, { range: [left, right], pointers: { left, right } }, { target, left, right, mid });
    } else {
      const old = right;
      right = mid - 1;
      r.step('write', L.else, `right = mid - 1 = ${right}. ${rangeText(mid, old)} is ruled out.`, { range: [left, right], pointers: { left, right } }, { target, left, right, mid });
    }
  }
  r.step('done', L.notFound, `return -1. ${target} is not in the array; it took ${r.probes} probe${r.probes === 1 ? '' : 's'} to be sure.`, { range: [left, right] }, { target, left, right }, undefined, '-1');
  return r.steps;
}

/** Mirrors BinarySearchRec from the notes; the recursion stack is shown in the state. */
export function traceBinaryRec(arr: readonly number[], target: number): SearchTrace {
  const L = BINARY_REC_LINES;
  const r = new SearchRecorder(arr);
  r.calls = [];
  const n = r.n;
  const frame = (a: number, b: number) => `BinarySearchRec(arr, ${target}, ${a}, ${b})`;

  function call(left: number, right: number): { result: number; line: number } {
    r.calls!.push(frame(left, right));
    const depth = r.calls!.length;
    const vars = (extra: Record<string, number> = {}) => ({ target, left, right, ...extra, depth });
    r.step('call', L.sig, depth === 1 ? `First call: ${frame(left, right)}, the whole array.` : `Call ${frame(left, right)}. Recursion depth ${depth}.`, { range: [left, right], pointers: { left, right } }, vars());
    if (left > right) {
      r.step('return', L.base, `left = ${left} > right = ${right}: the range is empty, so return -1.`, { range: [left, right] }, vars());
      r.calls!.pop();
      return { result: -1, line: L.base };
    }
    r.step('branch', L.base, `left = ${left} ≤ right = ${right}, so keep searching.`, { range: [left, right], pointers: { left, right } }, vars());
    const mid = left + Math.floor((right - left) / 2);
    r.probe();
    r.step('select', L.mid, `mid = ${left} + (${right} - ${left}) / 2 = ${mid}.`, { range: [left, right], active: [mid], pointers: { left, mid, right } }, vars({ mid }));
    const v = r.read(mid);
    r.compare();
    if (v === target) {
      r.step('compare', L.eq, `Comparing arr[${mid}] = ${v} with target ${target}: equal, so return ${mid}.`, { range: [left, right], compare: [mid], pointers: { left, mid, right } }, vars({ mid }));
      r.calls!.pop();
      return { result: mid, line: L.eq };
    }
    r.step('compare', L.eq, `Comparing arr[${mid}] = ${v} with target ${target}: not equal.`, { range: [left, right], compare: [mid], pointers: { left, mid, right } }, vars({ mid }));
    r.read(mid);
    r.compare();
    const less = v < target;
    r.step(
      'compare',
      L.ret,
      `Is arr[${mid}] = ${v} < ${target}? ${less ? 'Yes, so the target can only be in the right half.' : `No, ${v} > ${target}, so the target can only be in the left half.`}`,
      { range: [left, right], compare: [mid], pointers: { left, mid, right } },
      vars({ mid }),
      halfQuestion(mid, v, target, left, right),
    );
    const [a, b, line] = less ? [mid + 1, right, L.goRight] : [left, mid - 1, L.goLeft];
    r.step('call', line, `Recurse on ${rangeText(a, b)}: ${frame(a, b)}.`, { range: [a, b], pointers: { left: a, right: b } }, vars({ mid }));
    const inner = call(a, b);
    r.step('return', line, `Back in ${frame(left, right)}: the recursive call returned ${inner.result}, so this call returns ${inner.result} too.`, { range: [a, b], ...(inner.result >= 0 ? { settled: [inner.result] } : {}) }, vars({ mid }));
    r.calls!.pop();
    return { result: inner.result, line };
  }

  r.step('start', L.sig, `Recursive binary search for ${target} in a sorted array of ${n} elements. Each call works on arr[left..right] and keeps a frame on the call stack.`, {}, { target });
  const { result, line } = call(0, n - 1);
  const maxDepth = Math.max(...r.steps.map((s) => (s.variables.depth as number | undefined) ?? 0));
  r.step(
    'done',
    line,
    `${result >= 0 ? `Found: the first call returns ${result}.` : `Not found: the first call returns -1.`} The stack reached depth ${maxDepth}, which is the O(log n) space of the recursive version.`,
    result >= 0 ? { settled: [result], pointers: { mid: result } } : { range: [n, n - 1] },
    { target },
    undefined,
    String(result),
  );
  return r.steps;
}
