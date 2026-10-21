import { lines } from '../../engine/code';
import { ArrayRecorder, range } from '../../engine/recorder';
import type { AuxArray, Trace } from '../../engine/types';
import { SORT_CODE } from '../csharp';

/*
 * Counters policy:
 * - reads/writes count accesses to any array: arr, count and output.
 * - comparisons stays 0: radix sort compares no element values. `arr.Max()` counts as n reads.
 * - `foreach (int num in arr)` is 1 read per element; `count[d]++` and `count[digit]--` are 1 read + 1 write;
 *   `count[i] += count[i - 1]` is 2 reads + 1 write; `int digit = (arr[i] / exp) % 10` is 1 read;
 *   `output[count[digit] - 1] = arr[i]` is 2 reads + 1 write; `Array.Copy(output, arr, n)` is n reads + n writes.
 * - No swaps happen.
 */

const code = SORT_CODE.radix;
export const RADIX_LINES = lines(code, {
  max: 'int max = arr.Max();',
  loop: 'for (int exp = 1; max / exp > 0; exp *= 10)',
  call: 'CountingSortByDigit(arr, exp);',
  /** Closing brace of RadixSort (the outer method). */
  end: ['}', 1],
  n: 'int n = arr.Length;',
  output: 'int[] output = new int[n];',
  count: 'int[] count = new int[10];',
  tally: 'foreach (int num in arr) count[(num / exp) % 10]++;',
  cumulative: 'for (int i = 1; i < 10; i++) count[i] += count[i - 1];',
  placeLoop: 'for (int i = n - 1; i >= 0; i--)',
  digit: 'int digit = (arr[i] / exp) % 10;',
  place: 'output[count[digit] - 1] = arr[i];',
  dec: 'count[digit]--;',
  copy: 'Array.Copy(output, arr, n);',
});
const L = RADIX_LINES;

const INT_MAX = 2147483647;
const DIGIT_LABELS = range(10).map(String);
type AuxHighlight = NonNullable<AuxArray['highlight']>;

const PLACE: Record<number, string> = { 1: 'ones', 10: 'tens', 100: 'hundreds', 1000: 'thousands', 10000: 'ten-thousands' };
const placeName = (exp: number) => PLACE[exp] ?? `10^${Math.round(Math.log10(exp))}s`;
/** C# integer division of non-negative ints. */
const idiv = (a: number, b: number) => Math.trunc(a / b);
const digitOf = (num: number, exp: number) => idiv(num, exp) % 10;

/**
 * Mirrors RadixSort + CountingSortByDigit from the notes: one stable counting sort per decimal digit,
 * least significant first. Each pass moves the original elements, so ids show that ties on the
 * current digit keep the order the previous pass left them in.
 */
export function traceRadix(input: readonly number[]): Trace {
  if (input.length === 0 || input.some((v) => !Number.isInteger(v) || v < 0 || v > INT_MAX)) {
    throw new Error('Radix sort in the notes needs a non-empty array of non-negative integers');
  }
  const r = new ArrayRecorder(input);
  const n = r.n;

  let max = -Infinity;
  for (let p = 0; p < n; p++) max = Math.max(max, r.read(p));
  const passes = max === 0 ? 0 : String(max).length;
  r.step(
    'read',
    L.max,
    passes === 0
      ? `max = arr.Max() = 0. Every value is 0, so there is no digit pass to run.`
      : `max = arr.Max() = ${max}. It has ${passes} digit${passes === 1 ? '' : 's'}, so the loop runs ${passes} pass${passes === 1 ? '' : 'es'}, one per digit.`,
    {},
    { max },
  );

  function countingSortByDigit(exp: number): void {
    const place = placeName(exp);
    const count = new Array<number>(10).fill(0);
    const out: (number | null)[] = new Array<number | null>(n).fill(null);
    const outIds: (number | null)[] = new Array<number | null>(n).fill(null);
    let showCount = false;
    const show = (ch?: AuxHighlight, oh?: AuxHighlight) => {
      const o: AuxArray = { name: 'output', values: [...out], ids: [...outIds], ...(oh ? { highlight: oh } : {}) };
      r.aux = showCount ? [{ name: 'count', values: [...count], labels: [...DIGIT_LABELS], ...(ch ? { highlight: ch } : {}) }, o] : [o];
    };
    const vars = (extra: Record<string, number> = {}) => ({ exp, n, ...extra });

    r.aux = undefined;
    r.step('branch', L.n, `n = ${n}. This pass looks only at the ${place} digit, (num / ${exp}) % 10.`, {}, vars());
    show();
    r.step('branch', L.output, `output = new int[${n}], filled below.`, {}, vars());
    showCount = true;
    show();
    r.step('branch', L.count, 'count = new int[10], one slot per digit 0 to 9.', {}, vars());

    for (let p = 0; p < n; p++) {
      const num = r.read(p);
      const d = digitOf(num, exp);
      r.c.reads++;
      r.c.writes++;
      count[d] = count[d]! + 1;
      show({ write: [d] });
      r.step('write', L.tally, `num = ${num}: (${num} / ${exp}) % 10 = ${d}, so count[${d}] goes up to ${count[d]}.`, { active: [p] }, vars({ num }));
    }

    for (let i = 1; i < 10; i++) {
      const cur = count[i]!;
      const prev = count[i - 1]!;
      r.c.reads += 2;
      r.c.writes++;
      count[i] = cur + prev;
      const total = count[i]!;
      show({ active: [i - 1], write: [i] });
      r.step(
        'write',
        L.cumulative,
        `count[${i}] += count[${i - 1}]: ${cur} + ${prev} = ${total}. ${
          cur === 0
            ? `No number has ${place} digit ${i}, so count[${i}] just carries the running total.`
            : `Numbers with ${place} digit ${i} or less fill output[0..${total - 1}].`
        }`,
        {},
        vars({ i }),
      );
    }

    for (let i = n - 1; i >= 0; i--) {
      const val = r.values[i]!;
      const d = digitOf(val, exp);
      show();
      r.step(
        'branch',
        L.placeLoop,
        `i = ${i}: next, place arr[${i}] = ${val}. Its ${place} digit is ${d}.`,
        { active: [i], pointers: { i } },
        vars({ i }),
        digitPrediction(i, val, exp, d),
      );

      r.read(i);
      show({ active: [d] });
      r.step('read', L.digit, `digit = (${val} / ${exp}) % 10 = ${d}.`, { active: [i], pointers: { i } }, vars({ i, digit: d }));

      const target = count[d]! - 1;
      r.c.reads++;
      const moved = r.read(i);
      out[target] = moved;
      outIds[target] = r.ids[i]!;
      r.c.writes++;
      show({ active: [d] }, { write: [target] });
      r.step('write', L.place, `output[count[${d}] - 1] = output[${count[d]} - 1] = output[${target}] = ${val}.`, { active: [i], pointers: { i } }, vars({ i, digit: d }));

      r.c.reads++;
      r.c.writes++;
      count[d] = count[d]! - 1;
      const more = r.values.slice(0, i).some((x) => digitOf(x, exp) === d);
      show({ write: [d] });
      r.step(
        'write',
        L.dec,
        `count[${d}]-- leaves ${count[d]}. ${
          more ? `The next number to the left with ${place} digit ${d} goes to output[${count[d]! - 1}], just before this one.` : `No other number with ${place} digit ${d} is left to place.`
        }`,
        { active: [i], pointers: { i } },
        vars({ i, digit: d }),
      );
    }

    for (let p = 0; p < n; p++) {
      r.c.reads++;
      r.write(p, out[p]!, outIds[p]!);
    }
    show(undefined, { active: range(n) });
    r.step(
      'write',
      L.copy,
      `Array.Copy(output, arr, ${n}): arr is now ordered by the ${place} digit, [${r.values.join(', ')}]. Numbers with the same ${place} digit kept the order ${
        exp === 1 ? 'they had in the input' : 'the previous pass left them in'
      }.`,
      { swap: range(n) },
      vars(),
    );
  }

  let exp = 1;
  while (idiv(max, exp) > 0) {
    r.aux = undefined;
    r.step('branch', L.loop, `exp = ${exp}: ${max} / ${exp} = ${idiv(max, exp)} > 0, so run a pass on the ${placeName(exp)} digit.`, {}, { max, exp });
    r.step('call', L.call, `CountingSortByDigit(arr, ${exp}): a stable counting sort keyed on the ${placeName(exp)} digit.`, {}, { max, exp });
    countingSortByDigit(exp);
    // `exp *= 10` on a C# int wraps on overflow; Math.imul does the same 32-bit multiply.
    exp = Math.imul(exp, 10);
  }
  r.aux = undefined;
  r.step('branch', L.loop, `exp = ${exp}: ${max} / ${exp} = ${idiv(max, exp)}, which is not > 0, so the loop ends.`, {}, { max, exp });
  r.step(
    'done',
    L.end,
    `Done after ${passes} pass${passes === 1 ? '' : 'es'}: ${r.c.reads} reads, ${r.c.writes} writes and no comparisons.`,
    { settled: range(n) },
    {},
  );
  return r.steps;
}

/** Three digit options: the right one plus the neighbouring digit positions of the same number. */
function digitPrediction(i: number, val: number, exp: number, d: number) {
  const picks = [d];
  const others = [digitOf(val, exp * 10), exp >= 10 ? digitOf(val, exp / 10) : -1, (d + 1) % 10, (d + 9) % 10, (d + 2) % 10];
  for (const c of others) if (picks.length < 3 && c >= 0 && !picks.includes(c)) picks.push(c);
  picks.sort((a, b) => a - b);
  return {
    question: `Which digit bucket (count slot) does arr[${i}] = ${val} use when exp = ${exp}?`,
    options: picks.map((p) => `digit ${p}`),
    answer: picks.indexOf(d),
  };
}
