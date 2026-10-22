import { lines } from '../../engine/code';
import type { ActionKind, Prediction, Step } from '../../engine/types';
import { SEARCH_CODE } from '../csharp';

/** `Dictionary<int, List<int>> graph`: keys in insertion order, each list in the order it is iterated. */
export type Adjacency = ReadonlyMap<number, readonly number[]>;

export interface GraphStats {
  /** Nodes taken off the queue (BFS) or calls made (DFS). */
  visits: number;
  /** Neighbour entries the foreach loop went through. */
  edges: number;
  /** Largest queue length (BFS) or recursion depth (DFS) so far. */
  peak: number;
}

export interface GraphState {
  /** Nodes in the visited HashSet, in the order they were added. */
  visited: number[];
  /** BFS: the queue, front first. */
  queue?: { node: number; dist: number }[];
  /** DFS: the recursion stack, outermost call first. */
  stack?: number[];
  /** The node being processed (just dequeued, or the innermost DFS call). */
  current: number | null;
  /** The neighbour the foreach loop is looking at. */
  next: number | null;
  /** BFS: dequeued nodes. DFS: calls that have returned. */
  done: number[];
  /** BFS: dequeue order. DFS: call order. */
  order: number[];
  /** BFS: the dist each node was enqueued with. */
  dist: Record<number, number>;
  found: number | null;
  stats: GraphStats;
  result?: string;
}

export type GraphStep = Step<GraphState>;
export type GraphTrace = GraphStep[];

export const BFS_LINES = lines(SEARCH_CODE.bfs, {
  sig: 'int BFS(Dictionary<int, List<int>> graph, int start, int target)',
  queue: 'var queue = new Queue<(int node, int dist)>();',
  visited: 'var visited = new HashSet<int> { start };',
  enqueueStart: 'queue.Enqueue((start, 0));',
  loop: 'while (queue.Count > 0)',
  dequeue: 'var (node, dist) = queue.Dequeue();',
  check: 'if (node == target) return dist;',
  foreach: 'foreach (int next in graph.GetValueOrDefault(node, new List<int>()))',
  add: 'if (visited.Add(next))',
  enqueue: 'queue.Enqueue((next, dist + 1));',
  notFound: 'return -1;',
});

export const DFS_LINES = lines(SEARCH_CODE.dfs, {
  sig: 'bool DFS(Dictionary<int, List<int>> graph, int node, int target, HashSet<int> visited)',
  check: 'if (node == target) return true;',
  add: 'visited.Add(node);',
  foreach: 'foreach (int next in graph.GetValueOrDefault(node, new List<int>()))',
  cond: 'if (!visited.Contains(next) && DFS(graph, next, target, visited))',
  retTrue: ['return true;', 2],
  retFalse: 'return false;',
});

const NO_COUNTERS = { comparisons: 0, swaps: 0, reads: 0, writes: 0 };

class GraphRecorder {
  readonly steps: GraphTrace = [];
  visited: number[] = [];
  queue: { node: number; dist: number }[] | undefined;
  stack: number[] | undefined;
  current: number | null = null;
  next: number | null = null;
  done: number[] = [];
  order: number[] = [];
  dist: Record<number, number> = {};
  found: number | null = null;
  stats: GraphStats = { visits: 0, edges: 0, peak: 0 };

  step(action: ActionKind, codeLine: number, narration: string, variables: Record<string, string | number | boolean>, predict?: Prediction, result?: string) {
    if (this.queue) this.stats.peak = Math.max(this.stats.peak, this.queue.length);
    if (this.stack) this.stats.peak = Math.max(this.stats.peak, this.stack.length);
    const state: GraphState = {
      visited: [...this.visited],
      current: this.current,
      next: this.next,
      done: [...this.done],
      order: [...this.order],
      dist: { ...this.dist },
      found: this.found,
      stats: { ...this.stats },
    };
    if (this.queue) state.queue = this.queue.map((q) => ({ ...q }));
    if (this.stack) state.stack = [...this.stack];
    if (result !== undefined) state.result = result;
    const s: GraphStep = { state, highlights: {}, action, codeLine, narration, variables: { ...variables }, counters: NO_COUNTERS };
    if (predict) s.predict = predict;
    this.steps.push(s);
  }
}

const list = (xs: readonly number[]) => `[${xs.join(', ')}]`;
const neighbours = (graph: Adjacency, node: number) => graph.get(node) ?? [];
const describeList = (graph: Adjacency, node: number) =>
  graph.has(node) ? `graph[${node}] = ${list(neighbours(graph, node))}` : `graph has no key ${node}, so GetValueOrDefault returns an empty list`;
const targetText = (target: number) => (target < 0 ? 'no target (every reachable node gets visited)' : `target ${target}`);

/** Mirrors BFS from the notes: a Queue of (node, dist) pairs and a visited HashSet filled when a node is enqueued. */
export function traceBFS(graph: Adjacency, start: number, target: number): GraphTrace {
  const L = BFS_LINES;
  const r = new GraphRecorder();
  r.queue = [];
  r.step('start', L.sig, `BFS(graph, start = ${start}, target = ${target}): ${targetText(target)}. It explores level by level.`, { start, target });
  r.step('branch', L.queue, 'An empty queue of (node, dist) pairs.', { start, target });
  r.visited = [start];
  r.step('write', L.visited, `visited = { ${start} }. The start counts as visited before it is dequeued, so it is never queued twice.`, { start, target });
  r.queue.push({ node: start, dist: 0 });
  r.dist[start] = 0;
  r.step('write', L.enqueueStart, `Enqueue (${start}, 0): the start is 0 steps from itself.`, { start, target });
  for (;;) {
    const go = r.queue.length > 0;
    r.current = null;
    r.next = null;
    r.step('branch', L.loop, go ? `queue.Count = ${r.queue.length} > 0, so keep going.` : 'The queue is empty, so the loop ends.', { start, target });
    if (!go) break;
    const head = r.queue[0]!;
    const nodes = [...new Set(r.queue.map((e) => e.node))].slice(0, 4).sort((a, b) => a - b);
    const predict: Prediction | undefined =
      r.queue.length > 1 ? { question: 'Which node comes out of the queue next?', options: nodes.map((n) => `Node ${n}`), answer: nodes.indexOf(head.node) } : undefined;
    r.queue.shift();
    r.current = head.node;
    r.order.push(head.node);
    r.stats.visits++;
    const { node, dist } = head;
    r.step('read', L.dequeue, `Dequeue (${node}, ${dist}): node ${node}, ${dist} step${dist === 1 ? '' : 's'} from the start. A queue is first in, first out.`, { node, dist, target }, predict);
    if (node === target) {
      r.found = node;
      r.step('done', L.check, `node ${node} == target, so return dist = ${dist}: the shortest path from ${start} to ${target} has ${dist} edge${dist === 1 ? '' : 's'}.`, { node, dist, target }, undefined, String(dist));
      return r.steps;
    }
    r.step('compare', L.check, `node ${node} ≠ target ${target < 0 ? '(no target)' : target}.`, { node, dist, target });
    const adj = neighbours(graph, node);
    if (adj.length === 0) {
      r.step('branch', L.foreach, `${describeList(graph, node)}: no neighbours to look at.`, { node, dist, target });
    }
    for (const next of adj) {
      r.next = next;
      r.stats.edges++;
      r.step('read', L.foreach, `next = ${next} (${describeList(graph, node)}).`, { node, dist, next, target });
      const added = !r.visited.includes(next);
      if (added) r.visited.push(next);
      r.step(
        'compare',
        L.add,
        added ? `visited.Add(${next}) returns true: ${next} was not seen before.` : `visited.Add(${next}) returns false: ${next} is already visited, so skip it.`,
        { node, dist, next, target },
      );
      if (added) {
        r.queue.push({ node: next, dist: dist + 1 });
        r.dist[next] = dist + 1;
        r.step('write', L.enqueue, `Enqueue (${next}, ${dist + 1}).`, { node, dist, next, target });
      }
    }
    r.next = null;
    r.done.push(node);
  }
  r.current = null;
  r.step('done', L.notFound, target < 0 ? `return -1. With no target, BFS visited every node reachable from ${start}: ${r.order.join(' → ')}.` : `return -1. ${target} cannot be reached from ${start}.`, { target }, undefined, '-1');
  return r.steps;
}

/** Mirrors the recursive DFS from the notes. The first call passes an empty visited set. */
export function traceDFS(graph: Adjacency, start: number, target: number): GraphTrace {
  const L = DFS_LINES;
  const r = new GraphRecorder();
  r.stack = [];

  function dfs(node: number): boolean {
    r.stack!.push(node);
    r.current = node;
    r.next = null;
    r.order.push(node);
    r.stats.visits++;
    const vars = (extra: Record<string, number> = {}) => ({ node, target, ...extra });
    r.step('call', L.sig, r.stack!.length === 1 ? `DFS(graph, ${node}, ${target}, visited) with an empty visited set: ${targetText(target)}.` : `Call DFS(${node}). The call stack is ${r.stack!.length} deep.`, vars());
    if (node === target) {
      r.found = node;
      r.step('return', L.check, `node ${node} == target, so return true.`, vars());
      r.stack!.pop();
      r.done.push(node);
      return true;
    }
    r.step('compare', L.check, `node ${node} ≠ target ${target < 0 ? '(no target)' : target}.`, vars());
    r.visited.push(node);
    r.step('write', L.add, `visited.Add(${node}).`, vars());
    const adj = neighbours(graph, node);
    if (adj.length === 0) r.step('branch', L.foreach, `${describeList(graph, node)}: nothing to explore.`, vars());
    for (const next of adj) {
      r.current = node;
      r.next = next;
      r.stats.edges++;
      r.step('read', L.foreach, `next = ${next} (${describeList(graph, node)}).`, vars({ next }));
      const seen = r.visited.includes(next);
      r.step(
        'compare',
        L.cond,
        seen ? `visited.Contains(${next}) is true, so && stops: no call for ${next}.` : `${next} is not visited, so call DFS(${next}) and go deeper before trying ${node}'s other neighbours.`,
        vars({ next }),
        { question: `Does DFS call itself on ${next}?`, options: [`Yes, ${next} is unvisited`, `No, ${next} is already visited`], answer: seen ? 1 : 0 },
      );
      if (seen) continue;
      const res = dfs(next);
      r.current = node;
      r.next = next;
      r.step('return', L.cond, `Back in DFS(${node}): DFS(${next}) returned ${res}.`, vars({ next }));
      if (res) {
        r.step('return', L.retTrue, 'The target was found below, so return true.', vars({ next }));
        r.stack!.pop();
        r.done.push(node);
        return true;
      }
    }
    r.next = null;
    r.step('return', L.retFalse, `No neighbour of ${node} leads to the target, so return false and backtrack.`, vars());
    r.stack!.pop();
    r.done.push(node);
    return false;
  }

  const found = dfs(start);
  r.current = null;
  r.next = null;
  r.step(
    'done',
    found ? L.check : L.retFalse,
    found
      ? `DFS returned true: a path from ${start} to ${target} exists. Call order: ${r.order.join(' → ')}.`
      : target < 0
        ? `DFS returned false. With no target, it visited every node reachable from ${start}: ${r.order.join(' → ')}.`
        : `DFS returned false: ${target} cannot be reached from ${start}.`,
    { start, target },
    undefined,
    String(found),
  );
  return r.steps;
}
