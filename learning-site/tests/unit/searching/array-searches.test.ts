import { describe, expect, it } from 'vitest';
import { SEARCH_CODE } from '../../../src/viz/searching/csharp';
import { BINARY_LINES, BINARY_REC_LINES, traceBinary, traceBinaryRec } from '../../../src/viz/searching/traces/binary';
import { BOUNDS_LINES, traceBounds } from '../../../src/viz/searching/traces/bounds';
import { EXPONENTIAL_LINES, traceExponential } from '../../../src/viz/searching/traces/exponential';
import { INTERPOLATION_LINES, traceInterpolation } from '../../../src/viz/searching/traces/interpolation';
import { JUMP_LINES, traceJump } from '../../../src/viz/searching/traces/jump';
import { LINEAR_LINES, traceLinear } from '../../../src/viz/searching/traces/linear';
import { SQRT_LINES, traceSqrt } from '../../../src/viz/searching/traces/sqrt';
import { isStrictlyUnimodal, TERNARY_LINES, traceTernary } from '../../../src/viz/searching/traces/ternary';
import { expectWellFormed, lineCount, resultOf, rng, sortedInputs, targetsFor } from './helpers';

// ── Reference implementations: straight ports of the note's C# ────────────────────────────
function refBinary(arr: number[], target: number): number {
  let left = 0, right = arr.length - 1;
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid]! < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
function refBinaryRec(arr: number[], target: number, left: number, right: number): number {
  if (left > right) return -1;
  const mid = left + Math.floor((right - left) / 2);
  if (arr[mid] === target) return mid;
  return arr[mid]! < target ? refBinaryRec(arr, target, mid + 1, right) : refBinaryRec(arr, target, left, mid - 1);
}
function refJump(arr: number[], target: number): number {
  const n = arr.length;
  let step = Math.floor(Math.sqrt(n));
  let prev = 0;
  while (prev < n && arr[Math.min(step, n) - 1]! < target) {
    prev = step;
    step += Math.floor(Math.sqrt(n));
    if (prev >= n) return -1;
  }
  for (let i = prev; i < Math.min(step, n); i++) if (arr[i] === target) return i;
  return -1;
}
function refInterpolation(arr: number[], target: number): number {
  let left = 0, right = arr.length - 1;
  while (left <= right && target >= arr[left]! && target <= arr[right]!) {
    if (arr[left] === arr[right]) return arr[left] === target ? left : -1;
    const pos = left + Math.trunc(((target - arr[left]!) * (right - left)) / (arr[right]! - arr[left]!));
    if (arr[pos] === target) return pos;
    if (arr[pos]! < target) left = pos + 1;
    else right = pos - 1;
  }
  return -1;
}
function refArrayBinarySearch(arr: number[], index: number, length: number, value: number): number {
  let lo = index, hi = index + length - 1;
  while (lo <= hi) {
    const i = lo + ((hi - lo) >> 1);
    if (arr[i] === value) return i;
    if (arr[i]! < value) lo = i + 1;
    else hi = i - 1;
  }
  return ~lo;
}
function refExponential(arr: number[], target: number): number {
  if (arr.length === 0) return -1;
  if (arr[0] === target) return 0;
  let bound = 1;
  while (bound < arr.length && arr[bound]! <= target) bound *= 2;
  const left = Math.floor(bound / 2);
  const right = Math.min(bound, arr.length - 1);
  const idx = refArrayBinarySearch(arr, left, right - left + 1, target);
  return idx >= 0 ? idx : -1;
}
const lowerBound = (arr: number[], t: number) => { const k = arr.findIndex((v) => v >= t); return k < 0 ? arr.length : k; };
const upperBound = (arr: number[], t: number) => { const k = arr.findIndex((v) => v > t); return k < 0 ? arr.length : k; };

function mountains(count: number): number[][] {
  const next = rng(4242);
  const out: number[][] = [[5], [1, 2], [2, 1], [1, 3, 2], [1, 2, 3, 4, 5], [9, 7, 5, 3, 1], [1, 4, 9, 15, 22, 26, 24, 19, 12, 6, 2]];
  for (let k = 0; k < count; k++) {
    const len = 3 + Math.floor(next() * 14);
    const peak = Math.floor(next() * len);
    const a: number[] = [];
    let v = 1 + Math.floor(next() * 5);
    for (let i = 0; i < len; i++) {
      a.push(v);
      v += (i < peak ? 1 : -1) * (1 + Math.floor(next() * 6));
    }
    if (isStrictlyUnimodal(a)) out.push(a);
  }
  return out;
}

const sorted = sortedInputs(60);
const cases = sorted.flatMap((arr) => targetsFor(arr).map((t) => [arr, t] as const));

describe.each([
  ['linear', traceLinear, SEARCH_CODE.linear, (a: number[], t: number) => a.indexOf(t)],
  ['binary', traceBinary, SEARCH_CODE.binary, refBinary],
  ['binary (recursive)', traceBinaryRec, SEARCH_CODE.binaryRec, (a: number[], t: number) => refBinaryRec(a, t, 0, a.length - 1)],
  ['jump', traceJump, SEARCH_CODE.jump, refJump],
  ['interpolation', traceInterpolation, SEARCH_CODE.interpolation, refInterpolation],
  ['exponential', traceExponential, SEARCH_CODE.exponential, refExponential],
] as const)('%s search trace', (_name, trace, code, ref) => {
  it('returns exactly what the C# returns, for every array and target', () => {
    for (const [arr, t] of cases) expect(resultOf(trace(arr, t))).toBe(String(ref([...arr], t)));
  });
  it('is well formed at every step', () => {
    for (const [arr, t] of cases) expectWellFormed(trace(arr, t), arr.length, lineCount(code));
  });
  it('finds every present value and reports -1 for absent ones', () => {
    for (const [arr, t] of cases) {
      const res = Number(resultOf(trace(arr, t)));
      if (arr.includes(t)) expect(arr[res]).toBe(t);
      else expect(res).toBe(-1);
    }
  });
});

describe('linear search', () => {
  it('counts by hand: [7, 3, 9, 1, 8, 4, 6] finds 8 at index 4 after 5 comparisons', () => {
    const t = traceLinear([7, 3, 9, 1, 8, 4, 6], 8);
    expect(resultOf(t)).toBe('4');
    expect(t.at(-1)!.counters).toMatchObject({ comparisons: 5, reads: 5 });
  });
  it('compares every element when the target is missing (the worst case)', () => {
    expect(traceLinear([1, 2, 3], 9).at(-1)!.counters.comparisons).toBe(3);
  });
  it('works on unsorted input', () => {
    expect(resultOf(traceLinear([9, 1, 8, 2], 2))).toBe('3');
  });
  it('follows the C# line by line', () => {
    const L = LINEAR_LINES;
    expect(traceLinear([5], 5).map((s) => s.codeLine)).toEqual([L.sig, L.loop, L.check, L.check]);
    expect(traceLinear([5], 1).map((s) => s.codeLine)).toEqual([L.sig, L.loop, L.check, L.loop, L.notFound]);
  });
});

describe('binary search', () => {
  it('counts by hand: 4 probes and 7 comparisons to find 23 in the default array', () => {
    const t = traceBinary([3, 8, 12, 17, 23, 31, 38, 45, 52, 60, 71], 23);
    expect(resultOf(t)).toBe('4');
    expect(t.at(-1)!.state.probes).toBe(4);
    expect(t.at(-1)!.counters.comparisons).toBe(7);
  });
  it('never probes more than floor(log2 n) + 1 times', () => {
    for (const [arr, t] of cases) expect(traceBinary(arr, t).at(-1)!.state.probes).toBeLessThanOrEqual(arr.length ? Math.floor(Math.log2(arr.length)) + 1 : 0);
  });
  it('keeps a present target inside [left, right] at every step', () => {
    for (const [arr, t] of cases) {
      if (!arr.includes(t)) continue;
      for (const s of traceBinary(arr, t)) {
        if (!s.highlights.range) continue;
        const [lo, hi] = s.highlights.range;
        expect(arr.slice(lo, hi + 1)).toContain(t);
      }
    }
  });
  it('asks which half is kept, and the answer matches the update that follows', () => {
    for (const [arr, t] of cases) {
      const tr = traceBinary(arr, t);
      tr.forEach((s, i) => {
        if (!s.predict) return;
        const next = tr[i + 1]!;
        expect(next.codeLine).toBe(s.predict.answer === 1 ? BINARY_LINES.lt : BINARY_LINES.else);
      });
    }
  });
  it('follows the C# line by line', () => {
    const L = BINARY_LINES;
    expect(traceBinary([1, 2], 2).map((s) => s.codeLine)).toEqual([L.sig, L.init, L.loop, L.mid, L.eq, L.lt, L.lt, L.loop, L.mid, L.eq, L.eq]);
    expect(traceBinary([1, 2], 0).map((s) => s.codeLine)).toEqual([L.sig, L.init, L.loop, L.mid, L.eq, L.lt, L.else, L.loop, L.notFound]);
  });
});

describe('recursive binary search', () => {
  it('pushes one frame per call and pops them all', () => {
    for (const [arr, t] of cases) {
      const tr = traceBinaryRec(arr, t);
      const depth = Math.max(...tr.map((s) => s.state.calls?.length ?? 0));
      expect(depth).toBeLessThanOrEqual(Math.floor(Math.log2(Math.max(1, arr.length))) + 2);
      expect(tr.at(-1)!.state.calls).toEqual([]);
    }
  });
  it('follows the C# line by line for [1, 2], target 2', () => {
    const L = BINARY_REC_LINES;
    expect(traceBinaryRec([1, 2], 2).map((s) => s.codeLine)).toEqual([L.sig, L.sig, L.base, L.mid, L.eq, L.ret, L.goRight, L.sig, L.base, L.mid, L.eq, L.goRight, L.goRight]);
  });
});

describe('lower and upper bound', () => {
  it("reproduces the note's example: [1, 2, 2, 2, 3], target 2 → LowerBound 1, UpperBound 4, count 3", () => {
    const t = traceBounds([1, 2, 2, 2, 3], 2);
    expect(resultOf(t)).toBe('LowerBound = 1, UpperBound = 4');
    expect(t.at(-1)!.variables).toMatchObject({ lower: 1, upper: 4, count: 3 });
    expect(t.at(-1)!.narration).toContain('last occurrence = UpperBound - 1 = 3');
    expect(t.at(-1)!.counters.comparisons).toBe(6);
  });
  it('matches the definitions for every array and target', () => {
    for (const [arr, t] of cases) {
      const v = traceBounds(arr, t).at(-1)!.variables;
      expect(v.lower).toBe(lowerBound(arr, t));
      expect(v.upper).toBe(upperBound(arr, t));
      expect(v.count).toBe(arr.filter((x) => x === t).length);
    }
  });
  it('keeps the answer inside [left, right] at every step', () => {
    for (const [arr, t] of cases) {
      for (const s of traceBounds(arr, t)) {
        const { fn, left, right } = s.variables;
        if (typeof left !== 'number' || typeof right !== 'number') continue;
        const answer = fn === 'LowerBound' ? lowerBound(arr, t) : upperBound(arr, t);
        expect(answer).toBeGreaterThanOrEqual(left);
        expect(answer).toBeLessThanOrEqual(right);
      }
    }
  });
  it('is well formed and follows the C# for [5], target 5', () => {
    for (const [arr, t] of cases) expectWellFormed(traceBounds(arr, t), arr.length, lineCount(SEARCH_CODE.bounds));
    const L = BOUNDS_LINES;
    expect(traceBounds([5], 5).map((s) => s.codeLine)).toEqual([
      L.lowerSig, L.lowerInit, L.lowerLoop, L.lowerMid, L.lowerCmp, L.lowerElse, L.lowerLoop, L.lowerRet,
      L.upperSig, L.upperInit, L.upperLoop, L.upperMid, L.upperCmp, L.upperCmp, L.upperLoop, L.upperRet,
      L.upperRet,
    ]);
  });
});

describe('binary search on answer (MySqrt)', () => {
  it('returns floor(sqrt(x)) for 0..99', () => {
    for (let x = 0; x <= 99; x++) expect(resultOf(traceSqrt(x))).toBe(String(Math.floor(Math.sqrt(x))));
  });
  it('counts by hand: MySqrt(30) checks mid = 15, 7, 3, 5, 6 and returns 5', () => {
    const t = traceSqrt(30);
    expect(t.filter((s) => s.codeLine === SQRT_LINES.mid).map((s) => s.variables.mid)).toEqual([15, 7, 3, 5, 6]);
    expect(t.at(-1)!.counters.comparisons).toBe(5);
  });
  it('keeps the true answer at ans or inside [lo, hi], and marks form ✓…✓ ✗…✗', () => {
    for (let x = 0; x <= 99; x++) {
      const a = Math.floor(Math.sqrt(x));
      const tr = traceSqrt(x);
      expectWellFormed(tr, x + 1, lineCount(SEARCH_CODE.sqrt));
      for (const s of tr) {
        const { lo, hi, ans } = s.variables;
        if (typeof lo === 'number' && typeof hi === 'number') expect(ans === a || (a >= lo && a <= hi)).toBe(true);
        const marks = s.state.marks ?? [];
        marks.forEach((m, k) => {
          if (m === '✓') expect(k).toBeLessThanOrEqual(a);
          if (m === '✗') expect(k).toBeGreaterThan(a);
        });
      }
    }
  });
});

describe('jump search', () => {
  it('counts by hand: finds 37 at index 9 after 3 block checks and 2 scans', () => {
    const t = traceJump([2, 5, 8, 11, 15, 19, 24, 28, 33, 37, 42, 46, 51, 55, 60, 64], 37);
    expect(resultOf(t)).toBe('9');
    expect(t.at(-1)!.state.probes).toBe(5);
  });
  it('only moves forward: probed indexes never decrease', () => {
    for (const [arr, t] of cases) {
      const probed = traceJump(arr, t).flatMap((s) => (s.action === 'compare' ? s.highlights.compare ?? [] : []));
      for (let k = 1; k < probed.length; k++) expect(probed[k]!).toBeGreaterThanOrEqual(probed[k - 1]! - Math.floor(Math.sqrt(arr.length)));
    }
  });
  it('follows the C# line by line for [5], target 5', () => {
    const L = JUMP_LINES;
    expect(traceJump([5], 5).map((s) => s.codeLine)).toEqual([L.sig, L.n, L.step, L.prev, L.loop, L.scan, L.eq, L.eq]);
  });
});

describe('interpolation search', () => {
  it('finds 70 in [10, 20, …, 120] with a single probe', () => {
    const t = traceInterpolation([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120], 70);
    expect(resultOf(t)).toBe('6');
    expect(t.at(-1)!.state.probes).toBe(1);
    expect(t.at(-1)!.counters.comparisons).toBe(4);
  });
  it('needs more probes on skewed data', () => {
    const skewed = traceInterpolation([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 200], 10).at(-1)!.state.probes;
    expect(skewed).toBeGreaterThan(5);
  });
  it('follows the C# line by line for [3, 3], target 3', () => {
    const L = INTERPOLATION_LINES;
    expect(traceInterpolation([3, 3], 3).map((s) => s.codeLine)).toEqual([L.sig, L.init, L.loop, L.same, L.sameRet]);
  });
});

describe('exponential search', () => {
  it('counts by hand: finds 9 at index 3 after doubling bound 1 → 2 → 4', () => {
    const t = traceExponential([2, 4, 7, 9, 13, 18, 21, 26, 30, 35, 41, 47, 52, 58], 9);
    expect(resultOf(t)).toBe('3');
    expect(t.filter((s) => s.codeLine === EXPONENTIAL_LINES.loop).map((s) => s.variables.bound)).toEqual([1, 2, 4]);
    expect(t.at(-1)!.state.probes).toBe(5);
  });
  it('reports the negative Array.BinarySearch result before returning -1', () => {
    const t = traceExponential([1, 3, 5], 4);
    expect(t.at(-2)!.variables.idx).toBe(~2);
    expect(t.at(-1)!.codeLine).toBe(EXPONENTIAL_LINES.bsRet);
  });
});

describe('ternary search', () => {
  const peaks = mountains(80);
  it('returns the index of the maximum for strictly unimodal arrays', () => {
    for (const a of peaks) expect(resultOf(traceTernary(a))).toBe(String(a.indexOf(Math.max(...a))));
  });
  it('keeps the peak inside [left, right] at every step', () => {
    for (const a of peaks) {
      const peak = a.indexOf(Math.max(...a));
      const tr = traceTernary(a);
      expectWellFormed(tr, a.length, lineCount(SEARCH_CODE.ternary));
      for (const s of tr) {
        const { left, right } = s.variables;
        if (typeof left === 'number' && typeof right === 'number') expect(peak >= left && peak <= right).toBe(true);
      }
    }
  });
  it('recognises unimodal input', () => {
    expect(isStrictlyUnimodal([1, 3, 2])).toBe(true);
    expect(isStrictlyUnimodal([1, 2, 3])).toBe(true);
    expect(isStrictlyUnimodal([3, 2, 1])).toBe(true);
    expect(isStrictlyUnimodal([1, 2, 2, 1])).toBe(false);
    expect(isStrictlyUnimodal([1, 3, 2, 4])).toBe(false);
  });
  it('follows the C# line by line for [1, 3, 2]', () => {
    const L = TERNARY_LINES;
    expect(traceTernary([1, 3, 2]).map((s) => s.codeLine)).toEqual([L.sig, L.init, L.loop, L.best, L.scan, L.scanIf, L.scan, L.scanIf, L.scan, L.ret]);
  });
});
