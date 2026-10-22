import type { Adjacency } from './traces/graph';

export interface GraphNode {
  id: number;
  /** Position in the 100 × 60 drawing area. */
  x: number;
  y: number;
}
export type Edge = readonly [number, number];

/**
 * Builds the note's `Dictionary<int, List<int>> graph` for an undirected graph: each edge is added in both
 * directions, keys are in ascending order and every list is sorted ascending, so the foreach order is easy
 * to predict. A node with no edges gets no key, so GetValueOrDefault's empty-list default is what BFS/DFS see.
 */
export function buildAdjacency(edges: readonly Edge[]): Map<number, number[]> {
  const adj = new Map<number, Set<number>>();
  const add = (a: number, b: number) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const [a, b] of edges) {
    if (a === b) continue;
    add(a, b);
    add(b, a);
  }
  return new Map([...adj.keys()].sort((a, b) => a - b).map((k) => [k, [...adj.get(k)!].sort((a, b) => a - b)]));
}

export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** A sample graph with two routes from 0 to 7 of different lengths, so BFS and DFS visibly disagree. */
export const GRAPH_PRESET: { nodes: GraphNode[]; edges: Edge[]; start: number; target: number } = {
  nodes: [
    { id: 0, x: 8, y: 30 },
    { id: 1, x: 30, y: 9 },
    { id: 2, x: 30, y: 51 },
    { id: 3, x: 54, y: 9 },
    { id: 4, x: 54, y: 30 },
    { id: 5, x: 54, y: 51 },
    { id: 6, x: 78, y: 9 },
    { id: 7, x: 92, y: 34 },
  ],
  edges: [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 5],
    [3, 4],
    [4, 5],
    [3, 6],
    [6, 7],
    [5, 7],
  ],
  start: 0,
  target: 7,
};

export const GRID_PRESET = { rows: 5, cols: 6, walls: [2, 8, 14, 16, 22, 28], start: 0, target: 29 };

/**
 * A grid as a graph: cell (r, c) is node r × cols + c, and an open cell is connected to its open neighbours
 * up, left, right and down (ascending ids). Walls are left out of the dictionary entirely.
 */
export function gridGraph(rows: number, cols: number, walls: ReadonlySet<number>): { graph: Map<number, number[]>; open: number[]; edges: Edge[] } {
  const open: number[] = [];
  const edges: Edge[] = [];
  for (let id = 0; id < rows * cols; id++) {
    if (walls.has(id)) continue;
    open.push(id);
    const c = id % cols;
    if (c + 1 < cols && !walls.has(id + 1)) edges.push([id, id + 1]);
    if (id + cols < rows * cols && !walls.has(id + cols)) edges.push([id, id + cols]);
  }
  return { graph: buildAdjacency(edges), open, edges };
}

/** Parses "0-1, 0-2 1-3" into edges between existing nodes; returns an error message instead when it can't. */
export function parseEdges(text: string, nodeIds: ReadonlySet<number>): Edge[] | string {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const edges: Edge[] = [];
  for (const p of parts) {
    const m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(p);
    if (!m) return `"${p}" is not an edge. Write edges as a-b, for example 0-1, 1-2.`;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!nodeIds.has(a) || !nodeIds.has(b)) return `Edge ${a}-${b} uses a node that does not exist.`;
    if (a !== b) edges.push([a, b]);
  }
  return edges;
}

export const formatEdges = (edges: readonly Edge[]) => edges.map(([a, b]) => `${a}-${b}`).join(', ');

export type { Adjacency };
