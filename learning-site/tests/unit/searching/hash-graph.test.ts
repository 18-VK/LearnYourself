import { describe, expect, it } from 'vitest';
import { bucketOf, chains, keysOf, sizeOf } from '../../../src/viz/dsa/hash/model';
import { SEARCH_CODE } from '../../../src/viz/searching/csharp';
import { BFS_LINES, DFS_LINES, traceBFS, traceDFS, type Adjacency, type GraphTrace } from '../../../src/viz/searching/traces/graph';
import { HASH_LINES, traceHash } from '../../../src/viz/searching/traces/hash';
import { buildAdjacency, GRAPH_PRESET, gridGraph } from '../../../src/viz/searching/graph-model';
import { expectWellFormed, lineCount, resultOf, rng } from './helpers';

function randomArrays(count: number): number[][] {
  const next = rng(777);
  const out: number[][] = [[5], [5, 5], [12, 3, 25, 7, 14, 40, 9, 3], [0, 3, 6, 9, 12, 15]];
  for (let k = 0; k < count; k++) out.push(Array.from({ length: 1 + Math.floor(next() * 12) }, () => Math.floor(next() * 100)));
  return out;
}

describe('hash-based search trace', () => {
  const arrays = randomArrays(60);
  it('answers Contains correctly and is well formed', () => {
    for (const arr of arrays) {
      for (const t of [arr[0]!, 100, arr[arr.length - 1]! + 1]) {
        const tr = traceHash(arr, t);
        expect(resultOf(tr)).toBe(`exists = ${arr.includes(t)}`);
        expectWellFormed(tr, arr.length, lineCount(SEARCH_CODE.hash));
      }
    }
  });
  it('ends with a set of the distinct values and a dictionary of last indexes, each key in bucket key % size', () => {
    for (const arr of arrays) {
      const h = traceHash(arr, 0).at(-1)!.state.hash!;
      const seen = h.seen!;
      const index = h.index!;
      expect(keysOf(seen).sort((a, b) => a - b)).toEqual([...new Set(arr)].sort((a, b) => a - b));
      for (const t of [seen, index]) {
        chains(t).forEach((chain, b) => chain.forEach((i) => expect(bucketOf(t.entries[i]!.key, t.buckets!.length)).toBe(b)));
      }
      expect(sizeOf(index)).toBe(new Set(arr).size);
      for (const c of chains(index)) for (const i of c) expect(index.entries[i]!.value).toBe(arr.lastIndexOf(index.entries[i]!.key));
    }
  });
  it("walks the note's collision chain: Contains(3) compares 14, then 25, then 3", () => {
    const tr = traceHash([12, 3, 25, 7, 14, 40, 9, 3], 3);
    const contains = tr.filter((s) => s.codeLine === HASH_LINES.contains && s.action === 'compare' && s.state.hash?.hl.compare !== undefined);
    expect(contains.map((s) => s.state.hash!.seen!.entries[s.state.hash!.hl.compare!]!.key)).toEqual([14, 25, 3]);
    expect(tr.at(-1)!.variables.collisions).toBe(3);
  });
  it('visits the four lines in order', () => {
    const order = [...new Set(traceHash([1, 2], 2).map((s) => s.codeLine))];
    expect(order).toEqual([HASH_LINES.set, HASH_LINES.contains, HASH_LINES.dict, HASH_LINES.loop]);
  });
});

/** Reference BFS distances. */
function distances(g: Adjacency, start: number): Map<number, number> {
  const d = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const u = q.shift()!;
    for (const v of g.get(u) ?? []) if (!d.has(v)) (d.set(v, d.get(u)! + 1), q.push(v));
  }
  return d;
}
/** Reference DFS call order (the note's recursion, without a target). */
function dfsOrder(g: Adjacency, start: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  const go = (u: number) => {
    out.push(u);
    seen.add(u);
    for (const v of g.get(u) ?? []) if (!seen.has(v)) go(v);
  };
  go(start);
  return out;
}

function graphProblems(trace: GraphTrace, codeLines: number): string[] {
  const p: string[] = [];
  trace.forEach((s, k) => {
    if (s.codeLine < 1 || s.codeLine > codeLines) p.push(`step ${k}: line ${s.codeLine}`);
    if (!s.narration || /undefined|NaN/.test(s.narration)) p.push(`step ${k}: narration`);
    if (new Set(s.state.visited).size !== s.state.visited.length) p.push(`step ${k}: visited has duplicates`);
    if (s.predict && !(s.predict.answer >= 0 && s.predict.answer < s.predict.options.length)) p.push(`step ${k}: predict`);
  });
  if (trace.at(-1)!.action !== 'done') p.push('no done step');
  return p;
}

const graphs: { name: string; g: Adjacency; nodes: number[] }[] = [
  { name: 'preset graph', g: buildAdjacency(GRAPH_PRESET.edges), nodes: GRAPH_PRESET.nodes.map((n) => n.id) },
  { name: '4×5 grid with walls', ...(() => { const gg = gridGraph(4, 5, new Set([6, 7, 12])); return { g: gg.graph, nodes: gg.open }; })() },
  { name: 'two components', g: buildAdjacency([[0, 1], [1, 2], [3, 4]]), nodes: [0, 1, 2, 3, 4] },
];

describe.each(graphs)('BFS and DFS on the $name', ({ g, nodes }) => {
  it('BFS returns the shortest distance or -1, and dequeues in non-decreasing distance', () => {
    for (const start of nodes) {
      const d = distances(g, start);
      for (const target of [...nodes, -1]) {
        const tr = traceBFS(g, start, target);
        expect(graphProblems(tr, lineCount(SEARCH_CODE.bfs))).toEqual([]);
        expect(resultOf(tr as never)).toBe(String(d.get(target) ?? -1));
        const order = tr.at(-1)!.state.order;
        const ds = order.map((n) => d.get(n)!);
        for (let k = 1; k < ds.length; k++) expect(ds[k]!).toBeGreaterThanOrEqual(ds[k - 1]!);
      }
    }
  });
  it('DFS returns whether the target is reachable and calls nodes in the recursive order', () => {
    for (const start of nodes) {
      const reach = distances(g, start);
      for (const target of [...nodes, -1]) {
        const tr = traceDFS(g, start, target);
        expect(graphProblems(tr, lineCount(SEARCH_CODE.dfs))).toEqual([]);
        expect(resultOf(tr as never)).toBe(String(reach.has(target)));
        if (target < 0) expect(tr.at(-1)!.state.order).toEqual(dfsOrder(g, start));
        expect(tr.at(-1)!.state.stack).toEqual([]);
      }
    }
  });
});

describe('graph traces follow the C#', () => {
  const g = buildAdjacency([[0, 1]]);
  it('BFS from 0 to 1', () => {
    const L = BFS_LINES;
    expect(traceBFS(g, 0, 1).map((s) => s.codeLine)).toEqual([
      L.sig, L.queue, L.visited, L.enqueueStart,
      L.loop, L.dequeue, L.check, L.foreach, L.add, L.enqueue,
      L.loop, L.dequeue, L.check,
    ]);
  });
  it('DFS from 0 to 1', () => {
    const L = DFS_LINES;
    expect(traceDFS(g, 0, 1).map((s) => s.codeLine)).toEqual([L.sig, L.check, L.add, L.foreach, L.cond, L.sig, L.check, L.cond, L.retTrue, L.check]);
  });
  it('BFS counts its work: the queue never holds a node twice', () => {
    const tr = traceBFS(buildAdjacency(GRAPH_PRESET.edges), 0, -1);
    for (const s of tr) {
      const q = s.state.queue!.map((e) => e.node);
      expect(new Set(q).size).toBe(q.length);
    }
    expect(tr.at(-1)!.state.stats.visits).toBe(GRAPH_PRESET.nodes.length);
  });
});
