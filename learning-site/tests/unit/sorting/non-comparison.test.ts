import { describe, expect, it } from 'vitest';
import type { Step } from '../../../src/viz/engine/types';
import { SORT_CODE } from '../../../src/viz/sorting/csharp';
import { BUCKET_LINES, traceBucket } from '../../../src/viz/sorting/traces/bucket';
import {
  COUNTING_BY_AGE_LINES,
  COUNTING_SIMPLE_LINES,
  COUNTING_STABLE_LINES,
  NOTES_EMPLOYEES,
  traceCountingByAge,
  traceCountingSimple,
  traceCountingStable,
} from '../../../src/viz/sorting/traces/counting';
import { RADIX_LINES, traceRadix } from '../../../src/viz/sorting/traces/radix';
import { expectIdsTrackInput, expectStableFinal, expectWellFormed, finalValues, seededInputs, seededUnitFloats, sortedCopy } from './helpers';

const lineCount = (code: string) => code.split('\n').length;
const lineText = (code: string, line: number) => code.split('\n')[line - 1];
const auxNamed = (s: Step, name: string) => s.state.aux?.find((a) => a.name === name);

const dupHeavy = [[4, 2, 2, 8, 3, 3, 1], [3, 3, 3, 1, 1, 3], [10, 1, 10, 1, 10]];
const countingInputs = [...seededInputs(60), ...seededInputs(20, { min: -20, max: 20, seed: 99 }), ...dupHeavy];
const radixInputs = [...seededInputs(60, { min: 0, max: 999, seed: 4242 }), [170, 45, 75, 90, 802, 24, 2, 66], [0, 0, 0], [0], [100, 1, 10, 100, 1]].filter(
  (a) => a.length > 0,
);
const bucketInputs = [...seededUnitFloats(60), [0.42, 0.32, 0.23, 0.52, 0.25, 0.47, 0.51], [0.5, 0.5, 0.1, 0.5], [0.99, 0.01, 0.0]];

describe.each([
  ['countingStable', traceCountingStable, SORT_CODE.countingStable, countingInputs],
  ['countingSimple', traceCountingSimple, SORT_CODE.countingSimple, countingInputs],
  ['countingByAge', (a: readonly number[]) => traceCountingByAge(a), SORT_CODE.countingByAge, countingInputs],
  ['radix', traceRadix, SORT_CODE.radix, radixInputs],
  ['bucket', traceBucket, SORT_CODE.bucket, bucketInputs],
] as const)('%s trace', (_name, trace, code, inputs) => {
  it('ends with the sorted array for every input', () => {
    for (const input of inputs) expect(finalValues(trace(input))).toEqual(sortedCopy(input));
  });
  it('is well formed at every step', () => {
    for (const input of inputs) expectWellFormed(trace(input), input, lineCount(code));
  });
  it('compares no elements and swaps nothing (List<float>.Sort internals are not counted)', () => {
    for (const input of inputs) {
      const c = trace(input).at(-1)!.counters;
      expect(c.comparisons).toBe(0);
      expect(c.swaps).toBe(0);
    }
  });
  it('ends on the closing brace of the outer method', () => {
    const end = trace(inputs.find((a) => a.length > 1)!).at(-1)!.codeLine;
    expect(lineText(code, end)).toBe('}');
    const next = lineText(code, end + 1);
    expect(next === undefined || next === '').toBe(true);
  });
});

describe.each([
  ['countingStable', traceCountingStable, countingInputs],
  ['countingByAge', (a: readonly number[]) => traceCountingByAge(a), countingInputs],
  ['radix', traceRadix, radixInputs],
  ['bucket', traceBucket, bucketInputs],
] as const)('%s moves original elements', (_name, trace, inputs) => {
  it('keeps every id attached to its original value, in arr and in the aux arrays', () => {
    for (const input of inputs) expectIdsTrackInput(trace(input), input);
  });
});

describe.each([
  ['countingStable', traceCountingStable, countingInputs],
  ['countingByAge', (a: readonly number[]) => traceCountingByAge(a), countingInputs],
  ['radix', traceRadix, radixInputs],
] as const)('%s stability', (_name, trace, inputs) => {
  it('keeps equal values in their original order', () => {
    for (const input of inputs) expectStableFinal(trace(input));
  });
});

describe('counting sort (stable)', () => {
  const L = COUNTING_STABLE_LINES;
  it('places each element in the slot its predict answer names', () => {
    for (const input of countingInputs) {
      const t = traceCountingStable(input);
      t.forEach((s, k) => {
        if (s.codeLine !== L.placeLoop) return;
        const next = t[k + 1]!;
        expect(next.codeLine).toBe(L.place);
        const slot = auxNamed(next, 'output')!.highlight!.write![0]!;
        expect(s.predict!.options[s.predict!.answer]).toBe(`output[${slot}]`);
        expect(s.predict!.options).toHaveLength(3);
      });
    }
  });
  it('turns counts into cumulative end positions before placing anything', () => {
    for (const input of countingInputs.filter((a) => a.length > 0)) {
      const t = traceCountingStable(input);
      const atOutput = t.find((s) => s.codeLine === L.output)!;
      const count = auxNamed(atOutput, 'count')!.values as number[];
      const min = Math.min(...input);
      count.forEach((c, k) => expect(c).toBe(input.filter((v) => v <= k + min).length));
    }
  });
  it('labels each count slot with the value it stands for', () => {
    const s = traceCountingStable([7, 4, 5]).find((x) => x.codeLine === L.count)!;
    expect(auxNamed(s, 'count')!.labels).toEqual(['4', '5', '6', '7']);
  });
  it('counts [2, 1] by hand: 22 reads, 9 writes', () => {
    // arr.Max() + arr.Min(): 2 + 2 reads.
    // foreach: 2 x (arr read + count[x]++ = 1 read + 1 write) -> 4 reads, 2 writes.
    // cumulative (range 2, i = 1): count[1] += count[0] -> 2 reads, 1 write.
    // placement, per element: output[count[arr[i] - min] - 1] = arr[i] is 3 reads + 1 write,
    //   count[arr[i] - min]-- is 2 reads + 1 write -> 2 x (5 reads, 2 writes) = 10 reads, 4 writes.
    // Array.Copy: 2 reads, 2 writes.
    // reads 4 + 4 + 2 + 10 + 2 = 22, writes 2 + 1 + 4 + 2 = 9
    expect(traceCountingStable([2, 1]).at(-1)!.counters).toEqual({ comparisons: 0, swaps: 0, reads: 22, writes: 9 });
  });
  it('follows the C# line by line for [2, 1]', () => {
    expect(traceCountingStable([2, 1]).map((s) => s.codeLine)).toEqual([
      L.guard, L.maxMin, L.range, L.count,
      L.tally, L.tally,
      L.cumulative,
      L.output,
      L.placeLoop, L.place, L.dec, // i = 1
      L.placeLoop, L.place, L.dec, // i = 0
      L.copy, L.end,
    ]);
  });
  it('returns early on empty input, showing the guard line', () => {
    expect(traceCountingStable([]).map((s) => s.codeLine)).toEqual([L.guard, L.end]);
  });
  it('shows the cumulative line once when range is 1', () => {
    expect(traceCountingStable([5, 5]).filter((s) => s.codeLine === L.cumulative)).toHaveLength(1);
  });
});

describe('counting sort (simple)', () => {
  const L = COUNTING_SIMPLE_LINES;
  it('rebuilds every value from the counts, so no final element keeps an original id', () => {
    for (const input of countingInputs) {
      const t = traceCountingSimple(input);
      expect(t.at(-1)!.state.ids.every((id) => id === null)).toBe(true);
      expectIdsTrackInput(t, input, { finalIdsArePermutation: false });
    }
  });
  it('writes the slots in order, one value per write', () => {
    for (const input of countingInputs) {
      const writes = traceCountingSimple(input).filter((s) => s.codeLine === L.write);
      expect(writes.map((s) => s.highlights.swap![0])).toEqual(input.map((_, k) => k));
    }
  });
  it('counts [2, 1] by hand: 14 reads, 6 writes', () => {
    // arr.Min() + arr.Max(): 2 + 2 reads.
    // foreach: 2 x (arr read + count[x]++ = 1 read + 1 write) -> 4 reads, 2 writes.
    // i = 0: while (count[0] > 0) true -> 1 read; arr[0] = 1 -> 1 write; count[0]-- -> 1 read + 1 write;
    //        while false -> 1 read. That is 3 reads, 2 writes. i = 1 is the same: 3 reads, 2 writes.
    // reads 4 + 4 + 3 + 3 = 14, writes 2 + 2 + 2 = 6
    expect(traceCountingSimple([2, 1]).at(-1)!.counters).toEqual({ comparisons: 0, swaps: 0, reads: 14, writes: 6 });
  });
  it('follows the C# line by line for [2, 1]', () => {
    expect(traceCountingSimple([2, 1]).map((s) => s.codeLine)).toEqual([
      L.guard, L.min, L.max, L.count,
      L.tally, L.tally,
      L.index,
      L.forLoop, L.whileCheck, L.write, L.dec, L.whileCheck, // i = 0: one 1
      L.forLoop, L.whileCheck, L.write, L.dec, L.whileCheck, // i = 1: one 2
      L.end,
    ]);
  });
  it('returns early on empty input, showing the guard line', () => {
    expect(traceCountingSimple([]).map((s) => s.codeLine)).toEqual([L.guard, L.end]);
  });
});

describe('counting sort by age (Employee objects)', () => {
  const L = COUNTING_BY_AGE_LINES;
  const ages = NOTES_EMPLOYEES.map((e) => e.age);

  it("reproduces the note's output: Riya, Sana, Vikram, Aman, Karan", () => {
    expect(ages).toEqual([30, 25, 30, 25, 28]);
    const last = traceCountingByAge(ages).at(-1)!.state;
    expect(last.values).toEqual([25, 25, 28, 30, 30]);
    expect(last.ids.map((id) => NOTES_EMPLOYEES[id!]!.name)).toEqual(['Riya', 'Sana', 'Vikram', 'Aman', 'Karan']);
  });
  it("names the note's employees in the narration when the input is the note's ages", () => {
    const text = traceCountingByAge(ages).map((s) => s.narration).join('\n');
    for (const e of NOTES_EMPLOYEES) expect(text).toContain(`${e.name} (${e.age})`);
  });
  it('uses the names passed in, and generic labels otherwise', () => {
    const named = traceCountingByAge([40, 20], ['Asha', 'Ben']).map((s) => s.narration).join('\n');
    expect(named).toContain('Asha (40)');
    expect(named).toContain('Ben (20)');
    const plain = traceCountingByAge([40, 20]).map((s) => s.narration).join('\n');
    expect(plain).toContain('employee 0 (40)');
    expect(plain).not.toContain('Aman');
  });
  it('counts [2, 1] by hand: 18 reads, 9 writes', () => {
    // employees.Min + employees.Max: 2 + 2 reads.
    // foreach: 2 x (employees read + count[e.Age - min]++ = 1 read + 1 write) -> 4 reads, 2 writes.
    // cumulative: 2 reads, 1 write.
    // placement, per employee: var e = employees[i] is 1 read; output[count[...] - 1] = e is 1 read + 1 write;
    //   count[...]-- is 1 read + 1 write -> 2 x (3 reads, 2 writes) = 6 reads, 4 writes.
    // Array.Copy: 2 reads, 2 writes.
    // reads 4 + 4 + 2 + 6 + 2 = 18, writes 2 + 1 + 4 + 2 = 9
    expect(traceCountingByAge([2, 1]).at(-1)!.counters).toEqual({ comparisons: 0, swaps: 0, reads: 18, writes: 9 });
  });
  it('follows the C# line by line for [2, 1]', () => {
    expect(traceCountingByAge([2, 1]).map((s) => s.codeLine)).toEqual([
      L.guard, L.min, L.max, L.range, L.count,
      L.tally, L.tally,
      L.cumulative,
      L.output,
      L.placeLoop, L.pick, L.place, L.dec, // i = 1
      L.placeLoop, L.pick, L.place, L.dec, // i = 0
      L.copy, L.end,
    ]);
  });
  it('returns early on empty input, showing the guard line', () => {
    expect(traceCountingByAge([]).map((s) => s.codeLine)).toEqual([L.guard, L.end]);
  });
});

describe('radix sort', () => {
  const L = RADIX_LINES;
  it('after each pass, arr is sorted (and stable) on the digits seen so far', () => {
    for (const input of radixInputs) {
      for (const s of traceRadix(input)) {
        if (s.codeLine !== L.copy) continue;
        const mod = (s.variables.exp as number) * 10;
        const keys = s.state.values.map((v) => v % mod);
        for (let k = 1; k < keys.length; k++) {
          expect(keys[k]!).toBeGreaterThanOrEqual(keys[k - 1]!);
          if (keys[k] === keys[k - 1]) expect(s.state.ids[k]!).toBeGreaterThan(s.state.ids[k - 1]!);
        }
      }
    }
  });
  it('runs one pass per digit of max', () => {
    for (const input of radixInputs) {
      const max = Math.max(...input);
      const passes = traceRadix(input).filter((s) => s.codeLine === L.call).length;
      expect(passes).toBe(max === 0 ? 0 : String(max).length);
    }
  });
  it('labels the count slots with the digits 0 to 9', () => {
    const s = traceRadix([5, 3]).find((x) => x.codeLine === L.count)!;
    expect(auxNamed(s, 'count')!.labels).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });
  it('asks for the digit bucket with the digit the next line computes', () => {
    for (const input of radixInputs) {
      const t = traceRadix(input);
      t.forEach((s, k) => {
        if (s.codeLine !== L.placeLoop) return;
        const next = t[k + 1]!;
        expect(next.codeLine).toBe(L.digit);
        expect(s.predict!.options[s.predict!.answer]).toBe(`digit ${next.variables.digit}`);
        expect(s.predict!.options).toHaveLength(3);
      });
    }
  });
  it('counts [3, 1] by hand: 34 reads, 17 writes', () => {
    // arr.Max(): 2 reads. Only exp = 1 runs (3 / 10 = 0).
    // foreach: 2 x (arr read + count[d]++ = 1 read + 1 write) -> 4 reads, 2 writes.
    // cumulative: i = 1..9, each 2 reads + 1 write -> 18 reads, 9 writes.
    // placement, per element: digit = (arr[i] / exp) % 10 is 1 read; output[count[digit] - 1] = arr[i] is 2 reads + 1 write;
    //   count[digit]-- is 1 read + 1 write -> 2 x (4 reads, 2 writes) = 8 reads, 4 writes.
    // Array.Copy: 2 reads, 2 writes.
    // reads 2 + 4 + 18 + 8 + 2 = 34, writes 2 + 9 + 4 + 2 = 17
    expect(traceRadix([3, 1]).at(-1)!.counters).toEqual({ comparisons: 0, swaps: 0, reads: 34, writes: 17 });
  });
  it('follows the C# line by line for [3, 1]', () => {
    expect(traceRadix([3, 1]).map((s) => s.codeLine)).toEqual([
      L.max,
      L.loop, L.call, // exp = 1
      L.n, L.output, L.count,
      L.tally, L.tally,
      ...Array<number>(9).fill(L.cumulative),
      L.placeLoop, L.digit, L.place, L.dec, // i = 1
      L.placeLoop, L.digit, L.place, L.dec, // i = 0
      L.copy,
      L.loop, // exp = 10: 3 / 10 = 0, loop ends
      L.end,
    ]);
  });
  it('rejects input the C# in the notes cannot handle', () => {
    for (const bad of [[], [-1, 2], [1.5], [3, -7]]) {
      expect(() => traceRadix(bad)).toThrow('Radix sort in the notes needs a non-empty array of non-negative integers');
    }
  });
});

describe('bucket sort', () => {
  const L = BUCKET_LINES;
  it('puts every value in bucket floor(v * n)', () => {
    for (const input of bucketInputs) {
      const n = input.length;
      for (const s of traceBucket(input)) {
        for (const a of s.state.aux ?? []) {
          const b = Number(a.name.replace('bucket ', ''));
          expect(a.name).toBe(`bucket ${b}`);
          for (const v of a.values) expect(Math.floor(v! * n)).toBe(b);
        }
      }
    }
  });
  it('shows one bucket per element and one Sort() step per bucket', () => {
    for (const input of bucketInputs.filter((a) => a.length > 0)) {
      const t = traceBucket(input);
      expect(t.find((s) => s.codeLine === L.init)!.state.aux).toHaveLength(input.length);
      expect(t.filter((s) => s.codeLine === L.sort)).toHaveLength(input.length);
    }
  });
  it('leaves every bucket sorted after its Sort() step', () => {
    for (const input of bucketInputs) {
      const sorts = traceBucket(input).filter((s) => s.codeLine === L.sort);
      sorts.forEach((s, b) => {
        const values = s.state.aux![b]!.values as number[];
        expect(values).toEqual(sortedCopy(values));
      });
    }
  });
  it('mentions that List<T>.Sort is not guaranteed stable', () => {
    const t = traceBucket([0.5, 0.5, 0.1, 0.5]);
    expect(t.some((s) => s.codeLine === L.sort && s.narration.includes('not guaranteed stable'))).toBe(true);
  });
  it('asks for the bucket index the next line computes', () => {
    for (const input of bucketInputs) {
      const t = traceBucket(input);
      t.forEach((s, k) => {
        if (s.codeLine !== L.scatter || !s.predict) return;
        expect(s.predict.options[s.predict.answer]).toBe(`bucket ${t[k + 1]!.variables.idx}`);
      });
    }
  });
  it('counts [0.5, 0.1] by hand: 10 reads, 6 writes', () => {
    // init: buckets[0] and buckets[1] = new List<float>() -> 2 writes.
    // scatter, per value: foreach reads arr -> 1 read; buckets[idx].Add -> 1 read (buckets[idx]) + 1 write -> 4 reads, 2 writes.
    // sort: buckets[0].Sort(), buckets[1].Sort() -> 2 reads (Sort's internals are not counted).
    // gather, per bucket: foreach reads buckets[i] -> 1 read; each value: 1 read + arr[pos++] write -> 2 x (2 reads, 1 write).
    // reads 4 + 2 + 4 = 10, writes 2 + 2 + 2 = 6
    expect(traceBucket([0.5, 0.1]).at(-1)!.counters).toEqual({ comparisons: 0, swaps: 0, reads: 10, writes: 6 });
  });
  it('follows the C# line by line for [0.5, 0.1]', () => {
    expect(traceBucket([0.5, 0.1]).map((s) => s.codeLine)).toEqual([
      L.n, L.buckets, L.init,
      L.scatter, L.idx, L.add, // 0.5 -> bucket 1
      L.scatter, L.idx, L.add, // 0.1 -> bucket 0
      L.sort, L.sort,
      L.pos,
      L.gather, L.write, // bucket 0
      L.gather, L.write, // bucket 1
      L.end,
    ]);
  });
  it('handles empty and single-element input', () => {
    expect(traceBucket([]).map((s) => s.codeLine)).toEqual([L.n, L.buckets, L.init, L.pos, L.end]);
    expect(finalValues(traceBucket([0.3]))).toEqual([0.3]);
  });
  it('rejects values outside [0, 1)', () => {
    for (const bad of [[1], [-0.1], [0.5, 1.2], [Number.NaN]]) expect(() => traceBucket(bad)).toThrow('[0, 1)');
  });
});
