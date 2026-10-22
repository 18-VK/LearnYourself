import type { Cost, OpTrace, StructureDef } from './types';

/**
 * Stack<int> and Queue<int> as the cheat sheet uses them: LIFO and FIFO, with the costs from its
 * "## 5. Stack, Queue, Deque" table. Pop/Peek on an empty Stack and Dequeue on an empty Queue throw
 * InvalidOperationException (dotnet/runtime Stack.cs ThrowForEmptyStack, Queue.cs ThrowForEmptyQueue).
 * The cheat sheet's O(1) is the usual case: Microsoft's docs note that Push becomes O(n) when the
 * internal array has to grow (https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.stack-1.push);
 * see CONTENT_ISSUES.md.
 */
export interface SeqState {
  /** Stack: bottom first, top last. Queue: front first, back last. */
  items: number[];
}

export const MAX_SEQ = 12;
const STACK_COST: Cost = { ops: 'Push/Pop/Peek', cost: 'O(1)', source: 'notes' };
const QUEUE_COST: Cost = { ops: 'Enqueue/Dequeue', cost: 'O(1)', source: 'notes' };

const one = <S>(call: string, cost: Cost, work: string, state: S, narration: string, hl: object): OpTrace<S> => ({ call, cost, work, steps: [{ state, narration, hl }] });
const fail = <S>(call: string, cost: Cost, error: string): OpTrace<S> => ({ call, cost, work: 'nothing', steps: [], error });

export const STACK_DEF: StructureDef<SeqState> = {
  id: 'stack',
  title: 'Stack<T>',
  variable: 'stack',
  section: '## 5. Stack, Queue, Deque',
  costs: [STACK_COST],
  initial: () => ({ items: [4, 9, 2] }),
  setup: 'var stack = new Stack<int>(); // then Push(4), Push(9), Push(2)',
  ops: [
    {
      id: 'push',
      label: 'Push',
      arg: 'value',
      run: (s, v) =>
        s.items.length >= MAX_SEQ
          ? fail(`stack.Push(${v});`, STACK_COST, `This demo stops at ${MAX_SEQ} items.`)
          : one(`stack.Push(${v});`, STACK_COST, 'wrote 1 item on top', { items: [...s.items, v] }, `${v} goes on top. Nothing underneath moves.`, { write: [s.items.length] }),
    },
    {
      id: 'pop',
      label: 'Pop',
      arg: 'none',
      run: (s) =>
        s.items.length === 0
          ? fail('stack.Pop();', STACK_COST, 'InvalidOperationException: the stack is empty.')
          : one('stack.Pop();', STACK_COST, 'removed the top item', { items: s.items.slice(0, -1) }, `Pop returns ${s.items.at(-1)}, the last item pushed (last in, first out).`, {}),
    },
    {
      id: 'peek',
      label: 'Peek',
      arg: 'none',
      run: (s) =>
        s.items.length === 0
          ? fail('stack.Peek();', STACK_COST, 'InvalidOperationException: the stack is empty.')
          : one('stack.Peek();', STACK_COST, 'read the top item', { items: [...s.items] }, `Peek returns ${s.items.at(-1)} without removing it.`, { found: [s.items.length - 1] }),
    },
  ],
  summary: (s) => `Count ${s.items.length}${s.items.length ? ` · top ${s.items.at(-1)}` : ''}`,
};

export const QUEUE_DEF: StructureDef<SeqState> = {
  id: 'queue',
  title: 'Queue<T>',
  variable: 'queue',
  section: '## 5. Stack, Queue, Deque',
  costs: [QUEUE_COST],
  initial: () => ({ items: [4, 9, 2] }),
  setup: 'var queue = new Queue<int>(); // then Enqueue(4), Enqueue(9), Enqueue(2)',
  ops: [
    {
      id: 'enqueue',
      label: 'Enqueue',
      arg: 'value',
      run: (s, v) =>
        s.items.length >= MAX_SEQ
          ? fail(`queue.Enqueue(${v});`, QUEUE_COST, `This demo stops at ${MAX_SEQ} items.`)
          : one(`queue.Enqueue(${v});`, QUEUE_COST, 'wrote 1 item at the back', { items: [...s.items, v] }, `${v} joins at the back.`, { write: [s.items.length] }),
    },
    {
      id: 'dequeue',
      label: 'Dequeue',
      arg: 'none',
      run: (s) =>
        s.items.length === 0
          ? fail('queue.Dequeue();', QUEUE_COST, 'InvalidOperationException: the queue is empty.')
          : one('queue.Dequeue();', QUEUE_COST, 'removed the front item', { items: s.items.slice(1) }, `Dequeue returns ${s.items[0]}, the item that has waited longest (first in, first out).`, {}),
    },
  ],
  simplified: 'Drawn front to back. Internally Queue<T> keeps its items in a circular array with head and tail indexes, so dequeuing moves nothing.',
  summary: (s) => `Count ${s.items.length}${s.items.length ? ` · front ${s.items[0]}` : ''}`,
};
