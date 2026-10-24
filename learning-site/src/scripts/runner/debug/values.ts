/**
 * Text for value snapshots (the Variables panel, return values, the status line) and the data the array
 * visualization needs. Pure functions, so they are unit-tested without a browser.
 */
import type { MethodInfo, Value, Variable } from './trace';

/** C#-flavoured one-line text: 5, "abc", [2, 5, 7], {"a": 1}, Point { X = 1, Y = 2 }, null. */
export function show(v: Value, depth = 0): string {
  const inner = (x: Value) => show(x, depth + 1);
  switch (v.k) {
    case 'null':
      return 'null';
    case 'v':
      return v.v;
    case 's':
      return JSON.stringify(v.v).replace(/"$/, v.n > v.v.length ? '…"' : '"');
    case 'seq': {
      if (depth > 2) return `${v.t} (${v.n ?? v.items.length})`;
      const more = (v.n ?? v.items.length) > v.items.length ? `, … ${(v.n ?? 0) - v.items.length} more` : '';
      return `[${v.items.map(inner).join(', ')}${more}]`;
    }
    case 'grid':
      return `[${v.items.map((row) => `[${row.map(inner).join(', ')}${v.c > row.length ? ', …' : ''}]`).join(', ')}${v.r > v.items.length ? ', …' : ''}]`;
    case 'map': {
      if (depth > 2) return `${v.t} (${v.n})`;
      const more = v.n > v.items.length ? `, … ${v.n - v.items.length} more` : '';
      return `{${v.items.map(([k, x]) => `${inner(k)}: ${inner(x)}`).join(', ')}${more}}`;
    }
    case 'tup':
      return `(${v.items.map(inner).join(', ')})`;
    case 'obj':
      if (depth > 2) return v.t;
      return v.f.length ? `${v.t} { ${v.f.map(([n, x]) => `${n} = ${inner(x)}`).join(', ')} }` : `${v.t} { }`;
    case 'ref':
      return v.id ? `${v.t} #${v.id}` : `${v.t} …`;
    case 'exc':
      return `${v.t}: ${v.m}`;
    case 'o':
      return v.note ? `${v.t} (${v.note})` : v.t;
  }
}

/** The object id of a reference value (the same id in two variables means they point to the same object). */
export const refId = (v: Value): number | undefined => ('id' in v ? v.id : undefined);

/** A primitive's number, for pointers and cells. */
export function asNumber(v: Value): number | null {
  if (v.k !== 'v') return null;
  if (!/^(int|long|short|byte|uint|ulong|ushort|sbyte)$/.test(v.t)) return null;
  const n = Number(v.v);
  return Number.isInteger(n) ? n : null;
}

/** Names that usually hold an index (for pointers under an array, when the code gives no better hint). */
const INDEX_NAME = /^(i|j|k|l|r|m|p|q|lo|hi|mid|low|high|left|right|start|end|begin|idx|index|pos|ptr|slow|fast|front|rear|top|head|tail|cur|curr|smallest|largest|parent|child|min|max|minIndex|maxIndex|minIdx|maxIdx|pivotIndex|pi)$|(Idx|Index|Ptr|Pos)$/;

export interface ArrayView {
  name: string;
  type: string;
  cells: string[];
  /** Total length (the snapshot holds the first 64 items). */
  length: number;
  /** Pointer name → index; indexes may be -1 or length (drawn at the edges). */
  pointers: { name: string; index: number }[];
  /** Cells whose value changed since the frame's previous step. */
  changed: Set<number>;
}

const isScalar = (v: Value) => v.k === 'v' || v.k === 's' || v.k === 'null';

/**
 * T2 auto-visualize: the frame's one-dimensional arrays and lists of plain values, with its int variables drawn as
 * pointers under the matching index. Which ints point into which array: the index hints from the code
 * (`arr[j + 1]` → j points into arr), then index-like names (i, lo, hi, mid, …) for the first array.
 */
export function arrayViews(vars: Variable[], previous: Variable[], method: MethodInfo | null): ArrayView[] {
  const ints = new Map<string, number>();
  for (const v of vars) {
    const n = asNumber(v.value);
    if (n !== null) ints.set(v.name, n);
  }
  // the fields of `this` count as variables too (a Stack class's items and top)
  const self = vars.find((v) => v.name === 'this' && v.value.k === 'obj');
  const candidates: { name: string; value: Value; prev?: Value }[] = vars.filter((v) => v.name !== 'this').map((v) => ({ name: v.name, value: v.value, prev: previous.find((p) => p.name === v.name)?.value }));
  if (self && self.value.k === 'obj') {
    const prevSelf = previous.find((p) => p.name === 'this')?.value;
    for (const [name, value] of self.value.f) {
      const n = asNumber(value);
      if (n !== null && !ints.has(name)) ints.set(name, n);
      const prev = prevSelf?.k === 'obj' ? prevSelf.f.find((f) => f[0] === name)?.[1] : undefined;
      candidates.push({ name, value, ...(prev ? { prev } : {}) });
    }
  }
  const arrays = candidates.filter((c) => c.value.k === 'seq' && c.value.items.length > 0 && c.value.items.every(isScalar)) as { name: string; value: Extract<Value, { k: 'seq' }>; prev?: Value }[];
  if (!arrays.length) return [];
  const hints = method?.hints ?? {};
  const hinted = new Set(Object.values(hints).flat());
  return arrays.slice(0, 4).map((a, n) => {
    const length = a.value.n ?? a.value.items.length;
    const names = new Set(hints[a.name] ?? []);
    // index-like names the code doesn't tie to another array go under the first array
    if (n === 0) for (const name of ints.keys()) if (INDEX_NAME.test(name) && !hinted.has(name)) names.add(name);
    const pointers = [...names]
      .filter((p) => ints.has(p))
      .map((p) => ({ name: p, index: ints.get(p)! }))
      .filter((p) => p.index >= -1 && p.index <= length);
    const changed = new Set<number>();
    const prev = a.prev?.k === 'seq' ? a.prev.items : null;
    if (prev) a.value.items.forEach((x, i) => prev[i] && show(prev[i]!) !== show(x) && changed.add(i));
    return { name: a.name, type: a.value.t, cells: a.value.items.map((x) => show(x)), length, pointers, changed };
  });
}
