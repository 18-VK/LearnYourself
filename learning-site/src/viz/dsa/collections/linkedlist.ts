import type { CollectionHighlight, Cost, OpStep, OpTrace, StructureDef } from './types';

/**
 * LinkedList<int> as the cheat sheet describes it: a doubly linked list of LinkedListNode<T>, each with
 * Previous and Next, and no index access. `held` is the LinkedListNode<int> you hold after Find.
 * Simplified: .NET links the last node back to the first internally (a circular list), but First.Previous
 * and Last.Next are null through the public API, which is what the drawing shows.
 * https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/LinkedList.cs
 */
export interface LinkedNode {
  id: number;
  value: number;
}
export interface LinkedListState {
  nodes: LinkedNode[];
  /** The node reference held in `node` (from Find), or null. */
  held: number | null;
  nextId: number;
}

export const MAX_LINKED = 14;
const clone = (s: LinkedListState): LinkedListState => ({ ...s, nodes: s.nodes.map((n) => ({ ...n })) });

// Rows of the cheat sheet's LinkedList<T> complexity table, as written there.
export const LINKED_COSTS: Record<'ends' | 'beside' | 'remove' | 'search' | 'middle' | 'props', Cost> = {
  ends: { ops: '`AddFirst`, `AddLast`', cost: 'O(1)', source: 'notes' },
  beside: { ops: '`AddBefore`, `AddAfter`', cost: 'O(1)', source: 'notes', note: 'Only if you already hold the node' },
  remove: { ops: '`RemoveFirst`, `RemoveLast`, `Remove(node)`', cost: 'O(1)', source: 'notes' },
  search: { ops: '`Find`, `Contains`, `Remove(value)`', cost: 'O(n)', source: 'notes', note: 'Linear search' },
  middle: { ops: 'Insert in middle by position', cost: '**O(n)**', source: 'notes', note: 'Traversal to reach it is O(n); the insert itself is O(1)' },
  props: { ops: '`First`, `Last`, `Count`', cost: 'O(1)', source: 'notes' },
};

class Rec {
  steps: OpStep<LinkedListState>[] = [];
  constructor(public s: LinkedListState) {}
  push(narration: string, hl: CollectionHighlight = {}) {
    this.steps.push({ state: clone(this.s), narration, hl });
  }
  pos(id: number) {
    return this.s.nodes.findIndex((n) => n.id === id);
  }
}

const empty = (call: string, cost: Cost): OpTrace<LinkedListState> => ({ call, cost, work: 'nothing', steps: [], error: 'InvalidOperationException: the LinkedList is empty.' });
const full = (call: string, cost: Cost): OpTrace<LinkedListState> => ({ call, cost, work: 'nothing', steps: [], error: `This demo stops at ${MAX_LINKED} nodes.` });

function addAt(state: LinkedListState, at: 'first' | 'last', value: number): OpTrace<LinkedListState> {
  const call = at === 'first' ? `list.AddFirst(${value});` : `list.AddLast(${value});`;
  if (state.nodes.length >= MAX_LINKED) return full(call, LINKED_COSTS.ends);
  const r = new Rec(clone(state));
  const node = { id: r.s.nodes.length ? r.s.nextId : r.s.nextId, value };
  r.s.nextId++;
  if (at === 'first') r.s.nodes.unshift(node);
  else r.s.nodes.push(node);
  const k = r.pos(node.id);
  r.push(
    r.s.nodes.length === 1
      ? `The list was empty, so the new node is both First and Last.`
      : at === 'first'
        ? `New node ${value} links to the old First, and the old First's Previous now points back to it. Only two references change.`
        : `New node ${value} links back to the old Last, and the old Last's Next now points to it. Only two references change.`,
    { write: [k] },
  );
  return { call, cost: LINKED_COSTS.ends, work: 'relinked 2 references', steps: r.steps };
}

/** Find walks from First, comparing each value, and returns the first matching node (or null). */
export function linkedFind(state: LinkedListState, value: number, call = `var node = list.Find(${value});`): OpTrace<LinkedListState> {
  const r = new Rec(clone(state));
  r.s.held = null;
  let found = -1;
  for (let k = 0; k < r.s.nodes.length; k++) {
    const eq = r.s.nodes[k]!.value === value;
    r.push(`Walk from First: node ${k + 1} holds ${r.s.nodes[k]!.value}${eq ? ', a match.' : `, not ${value}; follow Next.`}`, { compare: [k] });
    if (eq) {
      found = k;
      break;
    }
  }
  if (found < 0) {
    r.push(`Reached the end without a match: Find returns null.`);
    return { call, cost: LINKED_COSTS.search, work: `visited ${r.s.nodes.length} node${r.s.nodes.length === 1 ? '' : 's'}`, steps: r.steps };
  }
  r.s.held = r.s.nodes[found]!.id;
  r.push(`Find returns the node holding ${value}. Holding this reference is what makes AddBefore, AddAfter and Remove(node) O(1).`, { found: [found] });
  return { call, cost: LINKED_COSTS.search, work: `visited ${found + 1} node${found ? 's' : ''}`, steps: r.steps };
}

function addBeside(state: LinkedListState, where: 'before' | 'after', value: number): OpTrace<LinkedListState> {
  const call = where === 'before' ? `list.AddBefore(node, ${value});` : `list.AddAfter(node, ${value});`;
  if (state.held === null) return { call, cost: LINKED_COSTS.beside, work: 'nothing', steps: [], error: 'Hold a node first: use Find.' };
  if (state.nodes.length >= MAX_LINKED) return full(call, LINKED_COSTS.beside);
  const r = new Rec(clone(state));
  const at = r.pos(state.held);
  const node = { id: r.s.nextId++, value };
  r.push(`Start from the node you hold (${r.s.nodes[at]!.value}). No walking needed.`, { active: [at] });
  r.s.nodes.splice(where === 'before' ? at : at + 1, 0, node);
  const k = r.pos(node.id);
  r.push(`Link ${value} ${where} it: the new node's Previous and Next are set, and the two neighbours point to it. O(1).`, { write: [k], active: [r.pos(state.held)] });
  return { call, cost: LINKED_COSTS.beside, work: 'relinked 4 references', steps: r.steps };
}

function removeAtPos(r: Rec, k: number, reason: string) {
  r.push(reason, { compare: [k] });
  const [gone] = r.s.nodes.splice(k, 1);
  if (r.s.held === gone!.id) r.s.held = null;
  r.push(`Unlinked: its neighbours now point to each other. The removed node ${gone!.value} is no longer in the list.`, {});
}

function removeEnd(state: LinkedListState, end: 'first' | 'last'): OpTrace<LinkedListState> {
  const call = end === 'first' ? 'list.RemoveFirst();' : 'list.RemoveLast();';
  if (!state.nodes.length) return empty(call, LINKED_COSTS.remove);
  const r = new Rec(clone(state));
  removeAtPos(r, end === 'first' ? 0 : r.s.nodes.length - 1, `${end === 'first' ? 'First' : 'Last'} is known directly, so no walking is needed.`);
  return { call, cost: LINKED_COSTS.remove, work: 'relinked 2 references', steps: r.steps };
}

export function linkedRemoveNode(state: LinkedListState, call = 'list.Remove(node);'): OpTrace<LinkedListState> {
  if (state.held === null) return { call, cost: LINKED_COSTS.remove, work: 'nothing', steps: [], error: 'Hold a node first: use Find.' };
  const r = new Rec(clone(state));
  removeAtPos(r, r.pos(state.held), 'You hold the node, so it can be unlinked without walking: O(1).');
  return { call, cost: LINKED_COSTS.remove, work: 'relinked 2 references', steps: r.steps };
}

function removeValue(state: LinkedListState, value: number): OpTrace<LinkedListState> {
  const call = `list.Remove(${value});`;
  const r = new Rec(clone(state));
  for (let k = 0; k < r.s.nodes.length; k++) {
    const eq = r.s.nodes[k]!.value === value;
    r.push(`Walk from First: ${r.s.nodes[k]!.value}${eq ? ' matches.' : ` is not ${value}.`}`, { compare: [k] });
    if (eq) {
      removeAtPos(r, k, `Remove the first node holding ${value}.`);
      r.push('Remove returns true.');
      return { call, cost: LINKED_COSTS.search, work: `visited ${k + 1} node${k ? 's' : ''}`, steps: r.steps };
    }
  }
  r.push(`No node holds ${value}: Remove returns false.`);
  return { call, cost: LINKED_COSTS.search, work: `visited ${r.s.nodes.length} nodes`, steps: r.steps };
}

/** `new LinkedList<int>(new[] { 10, 20, 30, 40 })`, the cheat sheet's example. */
export function noteList(): LinkedListState {
  return { nodes: [10, 20, 30, 40].map((value, id) => ({ id, value })), held: null, nextId: 4 };
}

export const LINKED_DEF: StructureDef<LinkedListState> = {
  id: 'linked-list',
  title: 'LinkedList<T>',
  variable: 'list',
  section: '### LinkedList<T> in C# - Quick Notes',
  costs: Object.values(LINKED_COSTS),
  initial: noteList,
  setup: 'var list = new LinkedList<int>(new[] { 10, 20, 30, 40 });',
  ops: [
    { id: 'addFirst', label: 'AddFirst', arg: 'value', run: (s, v) => addAt(s, 'first', v) },
    { id: 'addLast', label: 'AddLast', arg: 'value', run: (s, v) => addAt(s, 'last', v) },
    { id: 'find', label: 'Find', arg: 'value', run: (s, v) => linkedFind(s, v) },
    { id: 'addBefore', label: 'AddBefore(node, v)', arg: 'value', blocked: (s) => (s.held === null ? 'Find a node first.' : null), run: (s, v) => addBeside(s, 'before', v) },
    { id: 'addAfter', label: 'AddAfter(node, v)', arg: 'value', blocked: (s) => (s.held === null ? 'Find a node first.' : null), run: (s, v) => addBeside(s, 'after', v) },
    { id: 'insertAt', label: 'Insert at position', arg: 'index-value', run: (s, v, i) => insertAt(s, i, v) },
    { id: 'removeNode', label: 'Remove(node)', arg: 'none', blocked: (s) => (s.held === null ? 'Find a node first.' : null), run: (s) => linkedRemoveNode(s) },
    { id: 'removeValue', label: 'Remove(value)', arg: 'value', run: (s, v) => removeValue(s, v) },
    { id: 'removeFirst', label: 'RemoveFirst', arg: 'none', run: (s) => removeEnd(s, 'first') },
    { id: 'removeLast', label: 'RemoveLast', arg: 'none', run: (s) => removeEnd(s, 'last') },
  ],
  simplified: 'Drawn as a straight chain with null at both ends, as the public API shows it; internally .NET links Last back to First.',
  summary: (s) => `Count ${s.nodes.length}${s.held !== null ? ` · holding node ${s.nodes.find((n) => n.id === s.held)?.value}` : ''}`,
};

function insertAt(state: LinkedListState, index: number, value: number): OpTrace<LinkedListState> {
  const call = `// insert ${value} at position ${index}`;
  const n = state.nodes.length;
  if (index < 0 || index > n) return { call, cost: LINKED_COSTS.middle, work: 'nothing', steps: [], error: `Position must be between 0 and Count (${n}).` };
  if (n >= MAX_LINKED) return full(call, LINKED_COSTS.middle);
  const r = new Rec(clone(state));
  if (index === n) return { ...addAt(state, 'last', value), call, cost: LINKED_COSTS.middle };
  // there is no index access: walk from First to the node now at `index`
  for (let k = 0; k <= index; k++) r.push(k === index ? `Reached position ${index} after following Next ${index} time${index === 1 ? '' : 's'}.` : `No index access: step ${k + 1} of the walk, at ${r.s.nodes[k]!.value}.`, k === index ? { active: [k] } : { compare: [k] });
  const node = { id: r.s.nextId++, value };
  r.s.nodes.splice(index, 0, node);
  r.push(`AddBefore that node: the link itself is O(1). The walk is what made it O(n).`, { write: [index] });
  return { call, cost: LINKED_COSTS.middle, work: `walked ${index} node${index === 1 ? '' : 's'}, relinked 4 references`, steps: r.steps };
}

/** The cheat sheet's LinkedList example, verbatim; the visualizer steps through it line by line. */
export const LINKED_EXAMPLE = `var list = new LinkedList<int>(new[] { 10, 20, 30, 40 });

LinkedListNode<int> node = list.Find(30)!;  // O(n) search
list.AddBefore(node, 25);                   // O(1) insert -> 10,20,25,30,40
list.Remove(node);                          // O(1) remove -> 10,20,25,40`;

/** The cheat sheet's example, line by line: Find(30), AddBefore(node, 25), Remove(node). */
export function noteExample(): OpTrace<LinkedListState> {
  const at = (line: number) => (s: OpStep<LinkedListState>): OpStep<LinkedListState> => ({ ...s, codeLine: line });
  const steps: OpStep<LinkedListState>[] = [{ state: noteList(), narration: 'new LinkedList<int>(new[] { 10, 20, 30, 40 }) builds four linked nodes.', hl: {}, codeLine: 1 }];
  const find = linkedFind(noteList(), 30, 'list.Find(30)!');
  steps.push(...find.steps.map(at(3)));
  const before = addBeside(find.steps.at(-1)!.state, 'before', 25);
  steps.push(...before.steps.map(at(4)).map((s, k) => (k === before.steps.length - 1 ? { ...s, narration: `${s.narration} The list is now 10, 20, 25, 30, 40.` } : s)));
  const remove = linkedRemoveNode(before.steps.at(-1)!.state);
  steps.push(...remove.steps.map(at(5)).map((s, k) => (k === remove.steps.length - 1 ? { ...s, narration: `${s.narration} The list is now 10, 20, 25, 40.` } : s)));
  return { call: "Run the cheat sheet's example", cost: null, work: 'Find walked 3 nodes; the insert and the remove relinked without walking', steps };
}
