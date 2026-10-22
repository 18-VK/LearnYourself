import type { CollectionHighlight, Cost, OpStep, OpTrace, StructureDef } from './types';

/**
 * PriorityQueue<int, int>: an array-backed min-heap. .NET's is QUATERNARY (each node has up to four children:
 * parent of i is (i − 1) / 4, children are 4i + 1 … 4i + 4). Enqueue moves the new node up while its priority
 * is strictly smaller than its parent's; Dequeue takes the root, then moves the last node down, each time
 * swapping with the smallest of up to four children, stopping when the node's priority is ≤ that child's.
 * Like .NET, it shifts parents/children into a "hole" instead of swapping pairs.
 * https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/PriorityQueue.cs
 */
export interface PQNode {
  element: number;
  priority: number;
}
export interface PQState {
  nodes: PQNode[];
  /** Index of the empty slot being filled while a node moves up or down; the moving node is shown beside it. */
  hole: number | null;
  moving: PQNode | null;
}

export const ARITY = 4;
export const MAX_PQ = 21;
export const parentOf = (i: number) => (i - 1) >> 2;
export const firstChildOf = (i: number) => (i << 2) + 1;

const PQ_COST: Cost = { ops: 'Enqueue/Dequeue', cost: 'O(log n)', source: 'notes' };
const clone = (s: PQState): PQState => ({ nodes: s.nodes.map((n) => ({ ...n })), hole: s.hole, moving: s.moving ? { ...s.moving } : null });
const show = (n: PQNode) => (n.element === n.priority ? `${n.priority}` : `${n.element} (priority ${n.priority})`);

class Rec {
  steps: OpStep<PQState>[] = [];
  compares = 0;
  constructor(public s: PQState) {}
  push(narration: string, hl: CollectionHighlight = {}) {
    this.steps.push({ state: clone(this.s), narration, hl });
  }
}

function moveUp(r: Rec, node: PQNode, index: number) {
  const nodes = r.s.nodes;
  r.s.moving = node;
  r.s.hole = index;
  r.push(`Put ${show(node)} in a new slot at the end, index ${index}, then move it up while it beats its parent.`, { active: [index] });
  while (index > 0) {
    const p = parentOf(index);
    const parent = nodes[p]!;
    r.compares++;
    const less = node.priority < parent.priority;
    r.push(`Parent of ${index} is (${index} - 1) / 4 = ${p}, priority ${parent.priority}. ${node.priority} < ${parent.priority}? ${less ? 'Yes, so the parent moves down.' : 'No, so the node stays here.'}`, { compare: [p], active: [index] });
    if (!less) break;
    nodes[index] = parent;
    const old = index;
    index = p;
    r.s.hole = index;
    r.push(`The parent moves down into index ${old}; the free slot is now at ${index}.`, { write: [old], active: [index] });
  }
  nodes[index] = node;
  r.s.hole = null;
  r.s.moving = null;
  r.push(`${show(node)} settles at index ${index}.`, { write: [index] });
}

function moveDown(r: Rec, node: PQNode, index: number) {
  const nodes = r.s.nodes;
  const size = nodes.length;
  r.s.moving = node;
  r.s.hole = index;
  r.push(`Take the last node, ${show(node)}, and move it down from the root.`, { active: [index] });
  let i: number;
  while ((i = firstChildOf(index)) < size) {
    let min = i;
    const upper = Math.min(i + ARITY, size);
    for (let k = i + 1; k < upper; k++) {
      r.compares++;
      if (nodes[k]!.priority < nodes[min]!.priority) min = k;
    }
    const kids = Array.from({ length: upper - i }, (_, k) => i + k);
    r.push(`Children of ${index} are indexes ${i}..${upper - 1}; the smallest priority is ${nodes[min]!.priority} at ${min}.`, { compare: kids, active: [index] });
    r.compares++;
    if (node.priority <= nodes[min]!.priority) {
      r.push(`${node.priority} ≤ ${nodes[min]!.priority}, so the heap order holds here.`, { compare: [min], active: [index] });
      break;
    }
    nodes[index] = nodes[min]!;
    r.push(`${node.priority} > ${nodes[min]!.priority}: the child moves up into index ${index}.`, { write: [index], active: [min] });
    index = min;
    r.s.hole = index;
  }
  nodes[index] = node;
  r.s.hole = null;
  r.s.moving = null;
  r.push(`${show(node)} settles at index ${index}.`, { write: [index] });
}

export function pqEnqueue(state: PQState, element: number, priority: number): OpTrace<PQState> {
  const call = `pq.Enqueue(${element}, ${priority});`;
  if (state.nodes.length >= MAX_PQ) return { call, cost: PQ_COST, work: 'nothing', steps: [], error: `This demo stops at ${MAX_PQ} items.` };
  const r = new Rec(clone(state));
  r.s.nodes.push({ element: Number.NaN, priority: Number.NaN }); // the new slot, filled when the node settles
  moveUp(r, { element, priority }, r.s.nodes.length - 1);
  return { call, cost: PQ_COST, work: `${r.compares} priority comparison${r.compares === 1 ? '' : 's'}`, steps: r.steps };
}

export function pqDequeue(state: PQState): OpTrace<PQState> {
  const call = 'pq.Dequeue();';
  if (state.nodes.length === 0) return { call, cost: PQ_COST, work: 'nothing', steps: [], error: 'InvalidOperationException: the queue is empty.' };
  const r = new Rec(clone(state));
  const root = r.s.nodes[0]!;
  r.push(`Dequeue returns the root, ${show(root)}: the smallest priority. It is a min-heap.`, { found: [0] });
  const last = r.s.nodes.pop()!;
  if (r.s.nodes.length > 0) {
    r.s.nodes[0] = { element: Number.NaN, priority: Number.NaN };
    moveDown(r, last, 0);
  } else r.push('That was the only item; the queue is now empty.');
  return { call, cost: PQ_COST, work: `${r.compares} priority comparison${r.compares === 1 ? '' : 's'}`, steps: r.steps };
}

export function pqFrom(pairs: readonly (readonly [number, number])[]): PQState {
  let s: PQState = { nodes: [], hole: null, moving: null };
  for (const [e, p] of pairs) s = pqEnqueue(s, e, p).steps.at(-1)!.state;
  return s;
}

export const PQ_DEF: StructureDef<PQState> = {
  id: 'priority-queue-heap',
  title: 'PriorityQueue<TElement, TPriority>',
  variable: 'pq',
  section: '## 6. Heaps / Priority Queues',
  costs: [PQ_COST],
  initial: () => pqFrom([[5, 5], [8, 8], [3, 3], [9, 9], [6, 6], [1, 1], [7, 7]]),
  setup: 'var pq = new PriorityQueue<int, int>(); // then Enqueue 5, 8, 3, 9, 6, 1, 7 (element = priority)',
  ops: [
    { id: 'enqueue', label: 'Enqueue(element, priority)', arg: 'element-priority', run: (s, e, p) => pqEnqueue(s, e, p) },
    { id: 'enqueueMax', label: 'Enqueue(element, -priority)', arg: 'element-priority', run: (s, e, p) => ({ ...pqEnqueue(s, e, -p), call: `pq.Enqueue(${e}, -${p});` }) },
    { id: 'dequeue', label: 'Dequeue', arg: 'none', run: (s) => pqDequeue(s) },
  ],
  simplified: 'The tree is the array drawn as a 4-ary heap: .NET\'s PriorityQueue has up to four children per node, not two.',
  summary: (s) => `Count ${s.nodes.length}${s.nodes.length ? ` · next out: ${show(s.nodes[0]!)}` : ''}`,
};
