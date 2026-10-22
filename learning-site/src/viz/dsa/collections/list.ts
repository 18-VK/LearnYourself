import type { CollectionHighlight, OpStep, OpTrace, StructureDef } from './types';

/**
 * List<int>: a backing array (`_items`) of length Capacity, of which the first Count slots are in use.
 * Growth follows dotnet/runtime's List.cs: an empty list has a zero-length array, the first Add allocates
 * DefaultCapacity = 4 slots, and every later growth doubles (GetNewCapacity), copying the elements over.
 * Insert/RemoveAt shift the tail with Array.Copy; Remove(value) is IndexOf followed by RemoveAt.
 * https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/List.cs
 * Simplified: after RemoveAt, .NET leaves the old int in the slot past Count (it only clears slots for
 * reference types); the drawing shows every slot past Count as empty.
 */
export interface ListState {
  items: (number | null)[];
  count: number;
  /** The array being copied from while the list grows. */
  old: (number | null)[] | null;
  /** Element copies made by growth so far (to show the amortized cost). */
  growthCopies: number;
}

export const MAX_LIST = 32;
const DEFAULT_CAPACITY = 4;

const clone = (s: ListState): ListState => ({ ...s, items: [...s.items], old: s.old ? [...s.old] : null });
const range = (a: number, b: number) => (b < a ? [] : Array.from({ length: b - a + 1 }, (_, k) => a + k));
const newCapacity = (cap: number) => (cap === 0 ? DEFAULT_CAPACITY : 2 * cap);

class Rec {
  steps: OpStep<ListState>[] = [];
  constructor(public s: ListState) {}
  push(narration: string, hl: CollectionHighlight = {}) {
    this.steps.push({ state: clone(this.s), narration, hl });
  }
}

const COSTS = {
  add: { ops: 'Add', cost: 'O(1) amortized', source: 'notes' },
  insertRemove: { ops: 'Insert/Remove(i)', cost: 'O(n)', source: 'notes' },
  index: { ops: 'Index', cost: 'O(1)', source: 'notes' },
  removeValue: {
    ops: 'Remove(value)',
    cost: 'O(n)',
    source: 'https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.remove',
    note: 'Searches the list to find the value; removes only the first match (notes). A linear search, so O(n) (docs).',
  },
} as const;

/** Grows to the next capacity and copies the elements, leaving a gap at `gapAt` (Insert) or none (Add). */
function grow(r: Rec, gapAt: number | null): number {
  const s = r.s;
  const cap = s.items.length;
  const next = newCapacity(cap);
  s.old = [...s.items];
  s.items = new Array<number | null>(next).fill(null);
  r.push(
    cap === 0
      ? `The list has no backing array slots yet (Capacity 0), so it allocates ${next}: the default capacity.`
      : `Count ${s.count} == Capacity ${cap}: no free slot. Allocate a new array of 2 × ${cap} = ${next} slots.`,
    { out: range(0, cap - 1) },
  );
  if (s.count > 0) {
    for (let i = 0; i < s.count; i++) s.items[gapAt !== null && i >= gapAt ? i + 1 : i] = s.old[i]!;
    s.growthCopies += s.count;
    const moved = range(0, s.count).filter((i) => gapAt === null ? i < s.count : i !== gapAt);
    r.push(
      gapAt !== null && gapAt < s.count
        ? `Array.Copy moves the ${s.count} elements into the new array, leaving index ${gapAt} free for the insert.`
        : `Array.Copy moves the ${s.count} existing element${s.count === 1 ? '' : 's'} into the new array.`,
      { write: moved },
    );
  }
  s.old = null;
  return s.count;
}

export function listAdd(state: ListState, value: number): OpTrace<ListState> {
  const r = new Rec(clone(state));
  const s = r.s;
  if (s.count >= MAX_LIST) return { call: `list.Add(${value});`, cost: COSTS.add, work: 'nothing', steps: [], error: `This demo stops at ${MAX_LIST} elements.` };
  let copies = 0;
  if (s.count === s.items.length) copies = grow(r, null);
  else r.push(`Count ${s.count} < Capacity ${s.items.length}: there is a free slot, so nothing moves.`, { active: [s.count] });
  s.items[s.count] = value;
  s.count++;
  r.push(`items[${s.count - 1}] = ${value}; Count = ${s.count}.`, { write: [s.count - 1] });
  return {
    call: `list.Add(${value});`,
    cost: COSTS.add,
    work: copies ? `copied ${copies} element${copies === 1 ? '' : 's'} to grow, then wrote 1` : 'wrote 1 element',
    steps: r.steps,
  };
}

export function listInsert(state: ListState, index: number, value: number): OpTrace<ListState> {
  const call = `list.Insert(${index}, ${value});`;
  const r = new Rec(clone(state));
  const s = r.s;
  if (index < 0 || index > s.count) return { call, cost: COSTS.insertRemove, work: 'nothing', steps: [], error: `ArgumentOutOfRangeException: index must be between 0 and Count (${s.count}).` };
  if (s.count >= MAX_LIST) return { call, cost: COSTS.insertRemove, work: 'nothing', steps: [], error: `This demo stops at ${MAX_LIST} elements.` };
  let moved = 0;
  if (s.count === s.items.length) {
    grow(r, index);
    moved = s.count;
  } else if (index < s.count) {
    for (let i = s.count; i > index; i--) s.items[i] = s.items[i - 1]!;
    moved = s.count - index;
    r.push(`Array.Copy shifts items[${index}..${s.count - 1}] one place right: ${moved} element${moved === 1 ? '' : 's'} move to make room.`, { write: range(index + 1, s.count) });
  } else r.push(`Inserting at index ${index} = Count is the same as Add: nothing has to move.`, { active: [index] });
  s.items[index] = value;
  s.count++;
  r.push(`items[${index}] = ${value}; Count = ${s.count}.`, { write: [index] });
  return { call, cost: COSTS.insertRemove, work: `moved ${moved} element${moved === 1 ? '' : 's'}, wrote 1`, steps: r.steps };
}

function removeAtSteps(r: Rec, index: number): number {
  const s = r.s;
  s.count--;
  const moved = s.count - index;
  for (let i = index; i < s.count; i++) s.items[i] = s.items[i + 1]!;
  s.items[s.count] = null;
  r.push(
    moved > 0
      ? `Count = ${s.count}. Array.Copy shifts the ${moved} element${moved === 1 ? '' : 's'} after index ${index} one place left to fill the gap.`
      : `Count = ${s.count}. It was the last element, so nothing has to move.`,
    { write: range(index, s.count - 1) },
  );
  return moved;
}

export function listRemoveAt(state: ListState, index: number): OpTrace<ListState> {
  const call = `list.RemoveAt(${index});`;
  const r = new Rec(clone(state));
  if (index < 0 || index >= r.s.count) return { call, cost: COSTS.insertRemove, work: 'nothing', steps: [], error: `ArgumentOutOfRangeException: index must be less than Count (${r.s.count}) and not negative.` };
  r.push(`Remove the element at index ${index} (${r.s.items[index]}).`, { compare: [index] });
  const moved = removeAtSteps(r, index);
  return { call, cost: COSTS.insertRemove, work: `moved ${moved} element${moved === 1 ? '' : 's'}`, steps: r.steps };
}

export function listRemove(state: ListState, value: number): OpTrace<ListState> {
  const call = `list.Remove(${value});`;
  const r = new Rec(clone(state));
  const s = r.s;
  let found = -1;
  for (let i = 0; i < s.count; i++) {
    const eq = s.items[i] === value;
    r.push(`IndexOf: items[${i}] = ${s.items[i]} ${eq ? '==' : '≠'} ${value}.`, { compare: [i], out: range(0, i - 1) });
    if (eq) {
      found = i;
      break;
    }
  }
  if (found < 0) {
    r.push(`${value} is not in the list, so Remove returns false and nothing changes.`);
    return { call, cost: COSTS.removeValue, work: `compared ${s.count} element${s.count === 1 ? '' : 's'}`, steps: r.steps };
  }
  const moved = removeAtSteps(r, found);
  r.push(`Remove returns true. Only the first ${value} was removed.`, {});
  return { call, cost: COSTS.removeValue, work: `compared ${found + 1}, moved ${moved}`, steps: r.steps };
}

export function listGet(state: ListState, index: number): OpTrace<ListState> {
  const call = `list[${index}]`;
  const r = new Rec(clone(state));
  if (index < 0 || index >= r.s.count) return { call, cost: COSTS.index, work: 'nothing', steps: [], error: `ArgumentOutOfRangeException: index must be less than Count (${r.s.count}).` };
  r.push(`list[${index}] reads items[${index}] = ${r.s.items[index]} directly: one array access, however long the list is.`, { found: [index] });
  return { call, cost: COSTS.index, work: 'read 1 element', steps: r.steps };
}

export function emptyList(): ListState {
  return { items: [], count: 0, old: null, growthCopies: 0 };
}

export const LIST_DEF: StructureDef<ListState> = {
  id: 'list-capacity',
  title: 'List<T>',
  variable: 'list',
  section: '## 2. Lists & Dynamic Arrays',
  costs: [COSTS.add, COSTS.insertRemove, COSTS.index, COSTS.removeValue],
  initial: emptyList,
  setup: 'var list = new List<int>();',
  ops: [
    { id: 'add', label: 'Add', arg: 'value', run: (s, v) => listAdd(s, v) },
    { id: 'insert', label: 'Insert', arg: 'index-value', run: (s, v, i) => listInsert(s, i, v) },
    { id: 'removeAt', label: 'RemoveAt', arg: 'index', blocked: (s) => (s.count ? null : 'The list is empty.'), run: (s, _v, i) => listRemoveAt(s, i) },
    { id: 'remove', label: 'Remove', arg: 'value', blocked: (s) => (s.count ? null : 'The list is empty.'), run: (s, v) => listRemove(s, v) },
    { id: 'get', label: 'list[i]', arg: 'index', blocked: (s) => (s.count ? null : 'The list is empty.'), run: (s, _v, i) => listGet(s, i) },
  ],
  simplified: 'Slots past Count are drawn empty. For an int list, .NET leaves the old value in a slot freed by RemoveAt, but no List<T> method can see it.',
  summary: (s) => `Count ${s.count} · Capacity ${s.items.length} · ${s.growthCopies} element${s.growthCopies === 1 ? '' : 's'} copied by growth so far`,
};
