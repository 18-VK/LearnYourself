import { lines } from '../../engine/code';
import { ArrayRecorder, range } from '../../engine/recorder';
import type { AuxArray, Prediction, Trace } from '../../engine/types';
import { SORT_CODE } from '../csharp';

/*
 * Counters policy:
 * - reads/writes count accesses to any array: arr, the buckets array and the bucket lists.
 * - `buckets[i] = new List<float>()` is 1 write per bucket. `foreach (float num in arr)` is 1 read per element.
 *   `buckets[idx].Add(num)` is 1 read (buckets[idx]) + 1 write (the append). `buckets[i].Sort()` is 1 read
 *   (buckets[i]). `foreach (float num in buckets[i])` is 1 read of buckets[i], then 1 read per element, and
 *   `arr[pos++] = num` is 1 write.
 * - comparisons: the only element comparisons happen inside List<float>.Sort(). The trace shows each Sort()
 *   as one step and does not model .NET's internal algorithm, so those comparisons are not counted.
 * - No swaps happen.
 */

const code = SORT_CODE.bucket;
export const BUCKET_LINES = {
  ...lines(code, {
    n: 'int n = arr.Length;',
    buckets: 'var buckets = new List<float>[n];',
    init: 'for (int i = 0; i < n; i++) buckets[i] = new List<float>();',
    scatter: 'foreach (float num in arr)',
    idx: 'int idx = (int)(num * n);',
    add: 'buckets[idx].Add(num);',
    sort: 'for (int i = 0; i < n; i++) buckets[i].Sort();',
    pos: 'int pos = 0;',
    gather: 'foreach (float num in buckets[i])',
    write: 'arr[pos++] = num;',
  }),
  end: code.split('\n').length,
};
const L = BUCKET_LINES;

/**
 * `(int)(num * n)` with C# float arithmetic: num is a float, n is converted to float, the product is
 * rounded to float, then truncated toward zero.
 */
export const bucketIndex = (num: number, n: number): number => Math.trunc(Math.fround(Math.fround(num) * n));

/** Shows a float the way the notes write it, without binary noise such as 2.9399999999999995. */
const fmt = (x: number) => String(Number(x.toFixed(6)));

/**
 * Mirrors BucketSort from the notes: scatter each value into bucket (int)(num * n), sort every bucket
 * with List<float>.Sort(), then concatenate the buckets back into arr.
 */
export function traceBucket(input: readonly number[]): Trace {
  const n = input.length;
  if (input.some((v) => !Number.isFinite(v) || v < 0 || v >= 1 || bucketIndex(v, n) >= n)) {
    throw new Error('Bucket sort in the notes needs every value in [0, 1)');
  }
  const r = new ArrayRecorder(input);
  const bv: number[][] = [];
  const bid: (number | null)[][] = [];
  const show = (hl: Record<number, NonNullable<AuxArray['highlight']>> = {}) => {
    r.aux = bv.map((values, b) => {
      const a: AuxArray = { name: `bucket ${b}`, values: [...values], ids: [...bid[b]!] };
      const h = hl[b];
      if (h) a.highlight = h;
      return a;
    });
  };
  const list = (b: number) => (bv[b]!.length === 0 ? 'empty' : `[${bv[b]!.map(fmt).join(', ')}]`);

  r.step('start', L.n, `n = ${n}, so there will be ${n} bucket${n === 1 ? '' : 's'}. Bucket b collects the values in [b/n, (b+1)/n).`, {}, { n });
  r.step('branch', L.buckets, `buckets = new List<float>[${n}]: ${n} empty slots, none of them holding a list yet.`, {}, { n });

  for (let b = 0; b < n; b++) {
    bv.push([]);
    bid.push([]);
    r.c.writes++;
  }
  if (n > 0) show();
  r.step(
    'write',
    L.init,
    n === 0 ? 'n = 0, so the loop creates no lists.' : `The loop gives each of the ${n} slots its own empty List<float>, bucket 0 to bucket ${n - 1}.`,
    {},
    { n },
  );

  for (let p = 0; p < n; p++) {
    const num = r.read(p);
    const id = r.ids[p]!;
    const idx = bucketIndex(num, n);
    show();
    r.step(
      'read',
      L.scatter,
      `num = arr[${p}] = ${fmt(num)}.`,
      { active: [p] },
      { n, num: fmt(num) },
      bucketPrediction(num, idx, n),
    );
    r.step('branch', L.idx, `idx = (int)(${fmt(num)} × ${n}) = (int)${fmt(num * n)} = ${idx}. The cast drops the fraction.`, { active: [p] }, { n, num: fmt(num), idx });

    r.c.reads++;
    r.c.writes++;
    bv[idx]!.push(num);
    bid[idx]!.push(id);
    show({ [idx]: { write: [bv[idx]!.length - 1] } });
    r.step('write', L.add, `buckets[${idx}].Add(${fmt(num)}): bucket ${idx} now holds ${list(idx)}.`, { active: [p] }, { n, num: fmt(num), idx });
  }

  for (let b = 0; b < n; b++) {
    r.c.reads++;
    const before = list(b);
    // List<float>.Sort() is not guaranteed stable; this view keeps equal values in their current order.
    const order = range(bv[b]!.length).sort((x, y) => bv[b]![x]! - bv[b]![y]!);
    bv[b] = order.map((k) => bv[b]![k]!);
    bid[b] = order.map((k) => bid[b]![k]!);
    const size = bv[b]!.length;
    const hasTies = new Set(bv[b]).size < size;
    const changed = order.some((k, pos) => k !== pos);
    let text: string;
    if (size === 0) text = `buckets[${b}].Sort(): bucket ${b} is empty, so there is nothing to sort.`;
    else if (size === 1) text = `buckets[${b}].Sort(): bucket ${b} holds one value, ${fmt(bv[b]![0]!)}, which is already sorted.`;
    else if (changed) text = `buckets[${b}].Sort() reorders ${before} into ${list(b)}.`;
    else text = `buckets[${b}].Sort(): ${list(b)} is already in order.`;
    if (b === 0) text += ' List<T>.Sort() is not guaranteed stable, which is why the note says bucket sort is only stable if the sort inside each bucket is.';
    if (hasTies) text += ' This bucket has equal values; List<T>.Sort() could swap them, and here they are shown in their current order.';
    show(size > 0 ? { [b]: { active: range(size) } } : {});
    r.step('select', L.sort, text, {}, { n, i: b });
  }

  let pos = 0;
  r.step('branch', L.pos, 'pos = 0. The buckets are now copied back into arr in order: bucket 0 first.', n > 0 ? { pointers: { pos } } : {}, { n, pos });

  for (let b = 0; b < n; b++) {
    r.c.reads++;
    show({ [b]: { active: range(bv[b]!.length) } });
    r.step(
      'branch',
      L.gather,
      bv[b]!.length === 0 ? `i = ${b}: bucket ${b} is empty, so nothing is written.` : `i = ${b}: foreach walks bucket ${b}, ${list(b)}.`,
      pos < n ? { pointers: { pos } } : {},
      { n, i: b, pos },
    );
    bv[b]!.forEach((num, k) => {
      r.c.reads++;
      r.write(pos, num, bid[b]![k]!);
      show({ [b]: { active: [k] } });
      r.step(
        'write',
        L.write,
        `arr[${pos}] = ${fmt(num)} from bucket ${b}. pos++ makes pos ${pos + 1}.`,
        { swap: [pos], pointers: pos + 1 < n ? { pos: pos + 1 } : {} },
        { n, i: b, pos: pos + 1, num: fmt(num) },
      );
      pos++;
    });
  }

  r.aux = undefined;
  r.step(
    'done',
    L.end,
    `Done: ${r.c.reads} reads and ${r.c.writes} writes. The element comparisons all happen inside List<float>.Sort(), which this view does not count.`,
    { settled: range(n) },
    {},
  );
  return r.steps;
}

/** Up to three neighbouring bucket indexes, including the right one. No question when there is only one bucket. */
function bucketPrediction(num: number, idx: number, n: number): Prediction | undefined {
  const picks = [idx];
  for (const c of [idx + 1, idx - 1, idx + 2, idx - 2]) if (picks.length < 3 && c >= 0 && c < n) picks.push(c);
  if (picks.length < 2) return undefined;
  picks.sort((a, b) => a - b);
  return { question: `Which bucket will ${fmt(num)} go to?`, options: picks.map((b) => `bucket ${b}`), answer: picks.indexOf(idx) };
}
