import { lines } from '../../engine/code';
import { ArrayRecorder, range } from '../../engine/recorder';
import type { AuxArray, Trace } from '../../engine/types';
import { SORT_CODE } from '../csharp';

/*
 * Counters policy (all three counting sorts):
 * - reads/writes count accesses to any array: arr (or employees), count and output.
 * - comparisons stays 0: counting sort compares no element values. `arr.Max()`/`arr.Min()` (and the
 *   `e => e.Age` overloads) count as n reads each and no comparisons. `while (count[i] > 0)` tests a
 *   count, not an element, so it is 1 read and no comparison.
 * - `foreach (int num in arr)` is 1 read per element; `count[x]++` and `count[x]--` are 1 read + 1 write;
 *   `count[i] += count[i - 1]` is 2 reads + 1 write; `Array.Copy(output, arr, n)` is n reads + n writes.
 * - Every array access written in the C# counts, so `output[count[arr[i] - min] - 1] = arr[i]` is 3 reads
 *   (arr[i] twice, count once) + 1 write, while the employee version reads `employees[i]` once into `e`.
 * - `e.Age` is a field of an element already read, not another array access.
 * - No swaps happen.
 */

type AuxHighlight = NonNullable<AuxArray['highlight']>;

const countAux = (values: readonly number[], labels: readonly string[], highlight?: AuxHighlight): AuxArray => ({
  name: 'count',
  values: [...values],
  labels: [...labels],
  ...(highlight ? { highlight } : {}),
});
const outputAux = (values: readonly (number | null)[], ids: readonly (number | null)[], highlight?: AuxHighlight): AuxArray => ({
  name: 'output',
  values: [...values],
  ids: [...ids],
  ...(highlight ? { highlight } : {}),
});

/** Three output-slot options for predict mode: the right one, the classic off-by-one, and a neighbour. */
function slotPrediction(question: string, slot: number, i: number, n: number) {
  const picks = [slot];
  for (const c of [slot + 1, slot - 1, i, slot + 2, slot - 2]) {
    if (picks.length < 3 && c >= 0 && c < n && !picks.includes(c)) picks.push(c);
  }
  for (const c of [slot + 1, slot + 2, slot + 3]) if (picks.length < 3 && !picks.includes(c)) picks.push(c);
  picks.sort((a, b) => a - b);
  return { question, options: picks.map((p) => `output[${p}]`), answer: picks.indexOf(slot) };
}

const plural = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------------------------------------
// 1. Stable version (cumulative count)
// ---------------------------------------------------------------------------------------------------

const stableCode = SORT_CODE.countingStable;
export const COUNTING_STABLE_LINES = {
  ...lines(stableCode, {
    guard: 'if (arr.Length == 0) return;',
    maxMin: 'int max = arr.Max(), min = arr.Min();',
    range: 'int range = max - min + 1;',
    count: 'int[] count = new int[range];',
    tally: 'foreach (int num in arr) count[num - min]++;',
    cumulative: 'for (int i = 1; i < range; i++) count[i] += count[i - 1];',
    output: 'int[] output = new int[arr.Length];',
    placeLoop: 'for (int i = arr.Length - 1; i >= 0; i--)',
    place: 'output[count[arr[i] - min] - 1] = arr[i];',
    dec: 'count[arr[i] - min]--;',
    copy: 'Array.Copy(output, arr, arr.Length);',
  }),
  end: stableCode.split('\n').length,
};

/**
 * Mirrors CountingSort (stable) from the notes: count each value, turn the counts into cumulative end
 * positions, then place elements right to left so equal values keep their original order.
 */
export function traceCountingStable(input: readonly number[]): Trace {
  const L = COUNTING_STABLE_LINES;
  const r = new ArrayRecorder(input);
  const n = r.n;
  if (n === 0) {
    r.step('branch', L.guard, 'arr.Length is 0, so the method returns straight away.', {}, {});
    r.step('done', L.end, 'Done: an empty array is already sorted.', {}, {});
    return r.steps;
  }
  r.step('branch', L.guard, `arr.Length = ${n}, so the sort goes ahead.`, {}, {});

  let max = -Infinity;
  for (let p = 0; p < n; p++) max = Math.max(max, r.read(p));
  let min = Infinity;
  for (let p = 0; p < n; p++) min = Math.min(min, r.read(p));
  r.step('read', L.maxMin, `max = ${max} and min = ${min}. arr.Max() and arr.Min() each scan all ${n} elements.`, {}, { max, min });

  const rng = max - min + 1;
  r.step('branch', L.range, `range = ${max} - ${min} + 1 = ${rng}: one count slot for every value from ${min} to ${max}.`, {}, { max, min, range: rng });

  const count = new Array<number>(rng).fill(0);
  const labels = range(rng).map((k) => String(k + min));
  const out: (number | null)[] = new Array<number | null>(n).fill(null);
  const outIds: (number | null)[] = new Array<number | null>(n).fill(null);
  let showOutput = false;
  const show = (ch?: AuxHighlight, oh?: AuxHighlight) => {
    r.aux = [countAux(count, labels, ch)];
    if (showOutput) r.aux.push(outputAux(out, outIds, oh));
  };
  const vars = (extra: Record<string, number> = {}) => ({ max, min, range: rng, ...extra });

  show();
  r.step(
    'branch',
    L.count,
    `count = new int[${rng}], all zeros. count[k] counts the value k + min, so count[0] is for ${min}${rng > 1 ? ` and count[${rng - 1}] is for ${max}` : ''}.`,
    {},
    vars(),
  );

  // Step 1: count occurrences
  for (let p = 0; p < n; p++) {
    const num = r.read(p);
    const slot = num - min;
    r.c.reads++;
    r.c.writes++;
    count[slot] = count[slot]! + 1;
    show({ write: [slot] });
    r.step('write', L.tally, `num = arr[${p}] = ${num}: count[${num} - ${min}] = count[${slot}] goes up to ${count[slot]}.`, { active: [p] }, vars({ num }));
  }

  // Step 2: cumulative counts
  if (rng === 1) {
    show();
    r.step('branch', L.cumulative, `range = 1, so the loop body never runs. count[0] = ${count[0]} already says the only value fills output[0..${n - 1}].`, {}, vars());
  }
  for (let i = 1; i < rng; i++) {
    const cur = count[i]!;
    const prev = count[i - 1]!;
    r.c.reads += 2;
    r.c.writes++;
    count[i] = cur + prev;
    const total = count[i]!;
    const value = i + min;
    show({ active: [i - 1], write: [i] });
    r.step(
      'write',
      L.cumulative,
      `count[${i}] += count[${i - 1}]: ${cur} + ${prev} = ${total}. ${
        cur === 0
          ? `${value} does not occur, so count[${i}] just carries the running total.`
          : `${plural(total, 'value')} ${total === 1 ? 'is' : 'are'} ≤ ${value}, so the last ${value} belongs at output[${total - 1}].`
      }`,
      {},
      vars({ i }),
    );
  }

  // Step 3: place right to left
  showOutput = true;
  show();
  r.step('branch', L.output, `output = new int[${n}]. Each element is placed into its exact slot, walking arr from right to left.`, {}, vars());
  for (let i = n - 1; i >= 0; i--) {
    const val = r.values[i]!;
    const slot = val - min;
    const target = count[slot]! - 1;
    show({ active: [slot] });
    r.step(
      'branch',
      L.placeLoop,
      `i = ${i}: arr[${i}] = ${val}. count[${val} - ${min}] = count[${slot}] = ${count[slot]}, so it goes to output[${count[slot]} - 1] = output[${target}].`,
      { active: [i], pointers: { i } },
      vars({ i }),
      slotPrediction(`Which output slot will arr[${i}] = ${val} go to?`, target, i, n),
    );

    r.read(i);
    r.c.reads++;
    const moved = r.read(i);
    out[target] = moved;
    outIds[target] = r.ids[i]!;
    r.c.writes++;
    show({ active: [slot] }, { write: [target] });
    r.step('write', L.place, `output[count[${slot}] - 1] = output[${target}] = ${val}.`, { active: [i], pointers: { i } }, vars({ i }));

    r.read(i);
    r.c.reads++;
    r.c.writes++;
    count[slot] = count[slot]! - 1;
    const left = r.values.slice(0, i).includes(val);
    show({ write: [slot] });
    r.step(
      'write',
      L.dec,
      `count[${slot}]-- leaves ${count[slot]}. ${
        left
          ? `The next ${val} to the left will go to output[${count[slot]! - 1}], before this one, so equal values keep their original order.`
          : `No other ${val} is left to place.`
      }`,
      { active: [i], pointers: { i } },
      vars({ i }),
    );
  }

  // Step 4: copy back
  for (let p = 0; p < n; p++) {
    r.c.reads++;
    r.write(p, out[p]!, outIds[p]!);
  }
  show(undefined, { active: range(n) });
  r.step('write', L.copy, `Array.Copy(output, arr, ${n}) copies output back into arr: ${n} reads and ${n} writes.`, { swap: range(n) }, vars());

  r.aux = undefined;
  r.step(
    'done',
    L.end,
    `Done with no element comparisons: ${r.c.reads} reads and ${r.c.writes} writes. Equal values kept their original order, because each element was moved, not rewritten.`,
    { settled: range(n) },
    {},
  );
  return r.steps;
}

// ---------------------------------------------------------------------------------------------------
// 2. Simple/unstable version
// ---------------------------------------------------------------------------------------------------

const simpleCode = SORT_CODE.countingSimple;
export const COUNTING_SIMPLE_LINES = {
  ...lines(simpleCode, {
    guard: 'if (arr.Length == 0) return;',
    min: 'int min = arr.Min();',
    max: 'int max = arr.Max();',
    count: 'int[] count = new int[max - min + 1];',
    tally: 'count[num - min]++;',
    index: 'int index = 0;',
    forLoop: 'for (int i = 0; i < count.Length; i++)',
    whileCheck: 'while (count[i] > 0)',
    write: 'arr[index] = i + min;',
    dec: 'count[i]--;',
  }),
  end: simpleCode.split('\n').length,
};

/**
 * Mirrors CountingSortSimple from the notes: count each value, then rewrite arr value by value from the
 * counts. The rewritten slots get id null: they are rebuilt values, not the original elements.
 */
export function traceCountingSimple(input: readonly number[]): Trace {
  const L = COUNTING_SIMPLE_LINES;
  const r = new ArrayRecorder(input);
  const n = r.n;
  if (n === 0) {
    r.step('branch', L.guard, 'arr.Length is 0, so the method returns straight away.', {}, {});
    r.step('done', L.end, 'Done: an empty array is already sorted.', {}, {});
    return r.steps;
  }
  r.step('branch', L.guard, `arr.Length = ${n}, so the sort goes ahead.`, {}, {});

  let min = Infinity;
  for (let p = 0; p < n; p++) min = Math.min(min, r.read(p));
  r.step('read', L.min, `min = arr.Min() = ${min}, after scanning all ${n} elements.`, {}, { min });
  let max = -Infinity;
  for (let p = 0; p < n; p++) max = Math.max(max, r.read(p));
  r.step('read', L.max, `max = arr.Max() = ${max}, after scanning all ${n} elements again.`, {}, { min, max });

  const size = max - min + 1;
  const count = new Array<number>(size).fill(0);
  const labels = range(size).map((k) => String(k + min));
  const show = (ch?: AuxHighlight) => {
    r.aux = [countAux(count, labels, ch)];
  };
  show();
  r.step('branch', L.count, `count = new int[${max} - ${min} + 1] = new int[${size}], all zeros. count[k] counts the value k + min.`, {}, { min, max });

  for (let p = 0; p < n; p++) {
    const num = r.read(p);
    const slot = num - min;
    r.c.reads++;
    r.c.writes++;
    count[slot] = count[slot]! + 1;
    show({ write: [slot] });
    r.step('write', L.tally, `num = arr[${p}] = ${num}: count[${num} - ${min}] = count[${slot}] goes up to ${count[slot]}.`, { active: [p] }, { min, max, num });
  }

  let index = 0;
  show();
  r.step('branch', L.index, 'index = 0. arr is now rewritten from the front, one value at a time.', { pointers: { index } }, { min, max, index });

  let firstWrite = true;
  for (let i = 0; i < size; i++) {
    const value = i + min;
    const ptr = (): Record<string, number> => (index < n ? { index } : {});
    show({ active: [i] });
    r.step('branch', L.forLoop, `i = ${i}: count[${i}] = ${count[i]} for the value ${value}.`, { pointers: ptr() }, { min, max, i, index });
    for (;;) {
      const c = count[i]!;
      r.c.reads++;
      const more = c > 0;
      show({ compare: [i] });
      r.step(
        'branch',
        L.whileCheck,
        more ? `count[${i}] = ${c} > 0, so write ${value} once more.` : `count[${i}] = 0, so every ${value} has been written. Move on to the next value.`,
        { pointers: ptr() },
        { min, max, i, index },
      );
      if (!more) break;

      r.write(index, value, null);
      show({ active: [i] });
      r.step(
        'write',
        L.write,
        `arr[${index}] = i + min = ${i} + ${min} = ${value}. index++ makes index ${index + 1}.${
          firstWrite ? ' This value is rebuilt from the count, so it has no link to any original element.' : ''
        }`,
        { swap: [index], pointers: { index } },
        { min, max, i, index },
      );
      firstWrite = false;
      index++;

      r.c.reads++;
      r.c.writes++;
      count[i] = count[i]! - 1;
      show({ write: [i] });
      r.step('write', L.dec, `count[${i}]-- leaves ${count[i]}.`, { pointers: ptr() }, { min, max, i, index });
    }
  }

  r.aux = undefined;
  r.step(
    'done',
    L.end,
    `Done with no element comparisons: ${r.c.reads} reads and ${r.c.writes} writes. Every value was rewritten from count, so none of them is an original element. For plain ints that makes no difference.`,
    { settled: range(n) },
    {},
  );
  return r.steps;
}

// ---------------------------------------------------------------------------------------------------
// 3. Worked example: sorting objects (Employee) by a key (Age)
// ---------------------------------------------------------------------------------------------------

/** The input from the note's worked example. */
export const NOTES_EMPLOYEES = [
  { name: 'Aman', age: 30 },
  { name: 'Riya', age: 25 },
  { name: 'Karan', age: 30 },
  { name: 'Sana', age: 25 },
  { name: 'Vikram', age: 28 },
] as const;

const byAgeCode = SORT_CODE.countingByAge;
export const COUNTING_BY_AGE_LINES = {
  ...lines(byAgeCode, {
    guard: 'if (employees.Length == 0) return;',
    min: 'int min = employees.Min(e => e.Age);',
    max: 'int max = employees.Max(e => e.Age);',
    range: 'int range = max - min + 1;',
    count: 'int[] count = new int[range];',
    tally: 'count[e.Age - min]++;',
    cumulativeLoop: 'for (int i = 1; i < range; i++)',
    cumulative: 'count[i] += count[i - 1];',
    output: 'Employee[] output = new Employee[employees.Length];',
    placeLoop: 'for (int i = employees.Length - 1; i >= 0; i--)',
    pick: 'var e = employees[i];',
    place: 'output[count[e.Age - min] - 1] = e;',
    dec: 'count[e.Age - min]--;',
    copy: 'Array.Copy(output, employees, employees.Length);',
  }),
  end: byAgeCode.split('\n').length,
};

/**
 * Mirrors CountingSortByAge from the notes. The main array holds the employees' ages and each id is the
 * employee's original index, so the stability the note describes (Riya before Sana, Aman before Karan)
 * is visible in the ids. Names come from `names`, or from NOTES_EMPLOYEES when the ages are the note's.
 */
export function traceCountingByAge(ages: readonly number[], names?: readonly string[]): Trace {
  const L = COUNTING_BY_AGE_LINES;
  const r = new ArrayRecorder(ages);
  const n = r.n;
  const noteAges: readonly number[] = NOTES_EMPLOYEES.map((e) => e.age);
  const useNames: readonly string[] | undefined =
    names ?? (ages.length === noteAges.length && ages.every((a, k) => a === noteAges[k]) ? NOTES_EMPLOYEES.map((e) => e.name) : undefined);
  const who = (id: number) => {
    const name = useNames?.[id];
    return name !== undefined ? `${name} (${ages[id]})` : `employee ${id} (${ages[id]})`;
  };

  if (n === 0) {
    r.step('branch', L.guard, 'employees.Length is 0, so the method returns straight away.', {}, {});
    r.step('done', L.end, 'Done: an empty array is already sorted.', {}, {});
    return r.steps;
  }
  r.step('branch', L.guard, `employees.Length = ${n}, so the sort goes ahead.`, {}, {});

  let min = Infinity;
  for (let p = 0; p < n; p++) min = Math.min(min, r.read(p));
  r.step('read', L.min, `min = ${min}, the youngest age, after scanning all ${n} employees.`, {}, { min });
  let max = -Infinity;
  for (let p = 0; p < n; p++) max = Math.max(max, r.read(p));
  r.step('read', L.max, `max = ${max}, the oldest age, after scanning all ${n} employees again.`, {}, { min, max });

  const rng = max - min + 1;
  r.step('branch', L.range, `range = ${max} - ${min} + 1 = ${rng}: one count slot for every age from ${min} to ${max}.`, {}, { min, max, range: rng });

  const count = new Array<number>(rng).fill(0);
  const labels = range(rng).map((k) => String(k + min));
  const out: (number | null)[] = new Array<number | null>(n).fill(null);
  const outIds: (number | null)[] = new Array<number | null>(n).fill(null);
  let showOutput = false;
  const show = (ch?: AuxHighlight, oh?: AuxHighlight) => {
    r.aux = [countAux(count, labels, ch)];
    if (showOutput) r.aux.push(outputAux(out, outIds, oh));
  };
  const vars = (extra: Record<string, number | string> = {}) => ({ min, max, range: rng, ...extra });

  show();
  r.step('branch', L.count, `count = new int[${rng}], all zeros. count[k] counts the employees aged k + min.`, {}, vars());

  // Step 1: count employees per age
  for (let p = 0; p < n; p++) {
    const age = r.read(p);
    const id = r.ids[p]!;
    const slot = age - min;
    r.c.reads++;
    r.c.writes++;
    count[slot] = count[slot]! + 1;
    show({ write: [slot] });
    r.step('write', L.tally, `e = ${who(id)}: count[${age} - ${min}] = count[${slot}] goes up to ${count[slot]}.`, { active: [p] }, vars({ e: who(id) }));
  }

  // Step 2: cumulative counts
  if (rng === 1) {
    show();
    r.step('branch', L.cumulativeLoop, `range = 1, so the loop body never runs. Everyone has the same age and fills output[0..${n - 1}].`, {}, vars());
  }
  for (let i = 1; i < rng; i++) {
    const cur = count[i]!;
    const prev = count[i - 1]!;
    r.c.reads += 2;
    r.c.writes++;
    count[i] = cur + prev;
    const total = count[i]!;
    const age = i + min;
    show({ active: [i - 1], write: [i] });
    r.step(
      'write',
      L.cumulative,
      `count[${i}] += count[${i - 1}]: ${cur} + ${prev} = ${total}. ${
        cur === 0
          ? `Nobody is ${age}, so count[${i}] just carries the running total.`
          : `${plural(total, 'employee')} ${total === 1 ? 'is' : 'are'} aged ${age} or younger, so the last one aged ${age} belongs at output[${total - 1}].`
      }`,
      {},
      vars({ i }),
    );
  }

  // Step 3: place employees right to left
  showOutput = true;
  show();
  r.step('branch', L.output, `output = new Employee[${n}]. Each employee is moved into its exact slot, walking from right to left.`, {}, vars());
  for (let i = n - 1; i >= 0; i--) {
    const age = r.values[i]!;
    const id = r.ids[i]!;
    const slot = age - min;
    const target = count[slot]! - 1;
    show({ active: [slot] });
    r.step(
      'branch',
      L.placeLoop,
      `i = ${i}: next is ${who(id)}. count[${age} - ${min}] = count[${slot}] = ${count[slot]}, so they go to output[${target}].`,
      { active: [i], pointers: { i } },
      vars({ i }),
      slotPrediction(`Which output slot will ${who(id)} go to?`, target, i, n),
    );

    r.read(i);
    show({ active: [slot] });
    r.step('read', L.pick, `e = employees[${i}] = ${who(id)}.`, { active: [i], pointers: { i } }, vars({ i, e: who(id) }));

    r.c.reads++;
    out[target] = age;
    outIds[target] = id;
    r.c.writes++;
    show({ active: [slot] }, { write: [target] });
    r.step('write', L.place, `output[count[${slot}] - 1] = output[${target}] = ${who(id)}. The whole object moves, not just the age.`, { active: [i], pointers: { i } }, vars({ i, e: who(id) }));

    r.c.reads++;
    r.c.writes++;
    count[slot] = count[slot]! - 1;
    let earlier: number | null = null;
    for (let p = i - 1; p >= 0 && earlier === null; p--) if (r.values[p] === age) earlier = r.ids[p]!;
    show({ write: [slot] });
    r.step(
      'write',
      L.dec,
      `count[${slot}]-- leaves ${count[slot]}. ${
        earlier !== null
          ?`${who(earlier)} comes earlier in the input with the same age, so they will land at output[${count[slot]! - 1}], before ${who(id)}.`
          : `Nobody else aged ${age} is left to place.`
      }`,
      { active: [i], pointers: { i } },
      vars({ i, e: who(id) }),
    );
  }

  for (let p = 0; p < n; p++) {
    r.c.reads++;
    r.write(p, out[p]!, outIds[p]!);
  }
  show(undefined, { active: range(n) });
  const order = r.ids.map((id) => (id === null ? '?' : who(id))).join(', ');
  r.step('write', L.copy, `Array.Copy(output, employees, ${n}) copies output back: ${order}.`, { swap: range(n) }, vars());

  r.aux = undefined;
  r.step(
    'done',
    L.end,
    `Done: sorted by age with ${r.c.reads} reads, ${r.c.writes} writes and no comparisons. Employees who share an age kept their original relative order.`,
    { settled: range(n) },
    {},
  );
  return r.steps;
}
