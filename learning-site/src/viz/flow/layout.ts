/**
 * Pure layout for FlowDiagram: turns diagram data and an available width into box rectangles, wrapped
 * label lines and edge polylines. Text is monospace, so line wrapping can be computed without measuring.
 *
 * - chain: one column on narrow screens; on wide screens rows of up to four boxes that snake
 *   (left → right, then right → left) so every arrow stays short.
 * - grid: authored row/column positions; transposed (rows ↔ columns) when the columns do not fit.
 * - tree: an indented outline, one node per row, like the ASCII it replaces.
 */
import type { FlowDiagramData, FlowEdge, FlowNode, GridPos } from './types';

export const PAD = 12;
const CHAR = 7.6; // 12.5px JetBrains Mono advance
const LINE = 17;
const BOX_PX = 10;
const BOX_PY = 8;
const LCHAR = 6.7; // 11px edge-label advance
const LLINE = 14;
const GAP_X = 30;
const GAP_Y = 30;
const MIN_COL = 84;
const INDENT = 26;

export type Pt = [number, number];
export interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  /** how many of `lines` belong to the label (the rest are the node's extra lines) */
  labelLines: number;
  plain: boolean;
}
export interface EdgeGeom {
  id: string;
  points: Pt[];
  heads: Pt[][];
  label?: { x: number; y: number; w: number; h: number; lines: string[] };
}
export interface Layout {
  width: number;
  height: number;
  boxes: Map<string, Box>;
  edges: Map<string, EdgeGeom>;
  mode: 'column' | 'rows' | 'grid' | 'grid-transposed' | 'tree';
}

/** Greedy word wrap to `max` characters; words longer than a line are broken. */
export function wrap(text: string, max: number): string[] {
  const limit = Math.max(4, Math.floor(max));
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > limit) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
      out.push(w.slice(0, limit));
      w = w.slice(limit);
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= limit) cur += ` ${w}`;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur || !out.length) out.push(cur);
  return out;
}

function boxLines(n: FlowNode, w: number): { lines: string[]; labelLines: number } {
  const max = (w - 2 * BOX_PX) / CHAR;
  const label = wrap(n.label, max);
  const extra = (n.lines ?? []).flatMap((l) => wrap(l, max));
  return { lines: [...label, ...extra], labelLines: label.length };
}
const boxHeight = (lines: number) => lines * LINE + 2 * BOX_PY;
const textWidth = (n: FlowNode) => Math.max(n.label.length, ...(n.lines ?? []).map((l) => l.length)) * CHAR + 2 * BOX_PX;

/** Grid positions for a chain: one column, or snaking rows of `perRow`. */
function chainPositions(n: number, perRow: number): GridPos[] {
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / perRow);
    const k = i % perRow;
    return { row, col: row % 2 === 0 ? k : perRow - 1 - k };
  });
}

export function layoutDiagram(d: FlowDiagramData, availWidth: number): Layout {
  const width = Math.max(260, Math.floor(availWidth));
  if (d.layout === 'tree') return layoutTree(d, width);

  let positions: GridPos[];
  let mode: Layout['mode'];
  let gapX = GAP_X;
  const longestEdgeLabel = Math.max(0, ...d.edges.map((e) => e.label?.length ?? 0));
  if (d.layout === 'chain') {
    const labelGap = longestEdgeLabel ? Math.min(150, Math.max(GAP_X, Math.ceil(Math.min(longestEdgeLabel, 18) * LCHAR) + 16)) : GAP_X;
    const fit = Math.floor((width - 2 * PAD + labelGap) / (140 + labelGap));
    const perRow = Math.min(4, d.nodes.length, fit);
    if (width >= 600 && d.nodes.length >= 3 && perRow >= 3) {
      positions = chainPositions(d.nodes.length, perRow);
      mode = 'rows';
      gapX = labelGap;
    } else {
      positions = chainPositions(d.nodes.length, 1);
      mode = 'column';
    }
  } else {
    positions = d.nodes.map((n) => n.at ?? { row: 0, col: 0 });
    mode = 'grid';
    const cols = Math.ceil(Math.max(...positions.map((p) => p.col)) + 1);
    // narrow screens: tighten the gaps first, and only turn the grid on its side if columns still don't fit
    if (cols > 1 && (width - 2 * PAD - (cols - 1) * gapX) / cols < MIN_COL) gapX = Math.max(10, (width - 2 * PAD - cols * MIN_COL) / (cols - 1));
    const colW = (width - 2 * PAD - (cols - 1) * gapX) / cols;
    if (colW < MIN_COL) {
      gapX = GAP_X;
      positions = positions.map((p) => ({ row: p.col, col: p.row }));
      mode = 'grid-transposed';
    }
  }

  const cols = Math.ceil(Math.max(...positions.map((p) => p.col)) + 1);
  const rows = Math.ceil(Math.max(...positions.map((p) => p.row)) + 1);
  let colW: number;
  if (mode === 'column') colW = Math.min(width - 2 * PAD, 340);
  else colW = Math.max(MIN_COL, Math.min(250, (width - 2 * PAD - (cols - 1) * gapX) / cols));
  // single-column chains: narrow boxes to their text so short labels don't make wide slabs
  if (mode === 'column') colW = Math.min(colW, Math.max(150, ...d.nodes.map(textWidth)));
  const contentW = cols * colW + (cols - 1) * gapX;
  const offsetX = Math.max(PAD, (width - contentW) / 2);

  const wrapped = d.nodes.map((n) => boxLines(n, colW));
  const heights = wrapped.map((w) => boxHeight(w.lines.length));
  const pos = new Map(d.nodes.map((n, i) => [n.id, positions[i]!]));
  const rowOf = (id: string) => Math.round(pos.get(id)!.row);
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(0, ...heights.filter((_, i) => Math.round(positions[i]!.row) === r)));
  // vertical gaps grow to fit labels written on arrows that cross them
  const gaps = Array.from({ length: Math.max(0, rows - 1) }, (_, r) => {
    let g = GAP_Y;
    for (const e of d.edges) {
      if (!e.label) continue;
      const a = rowOf(e.from);
      const b = rowOf(e.to);
      if (Math.min(a, b) <= r && Math.max(a, b) > r) g = Math.max(g, wrap(e.label, Math.min(170, width / 2) / LCHAR).length * LLINE + 22);
    }
    return g;
  });
  const rowTop: number[] = [];
  let y = PAD;
  for (let r = 0; r < rows; r++) {
    rowTop.push(y);
    y += rowH[r]! + (gaps[r] ?? 0);
  }

  const boxes = new Map<string, Box>();
  d.nodes.forEach((n, i) => {
    const p = positions[i]!;
    const h = heights[i]!;
    const r = Math.round(p.row);
    boxes.set(n.id, {
      id: n.id,
      x: offsetX + p.col * (colW + gapX),
      y: rowTop[r]! + (rowH[r]! - h) / 2,
      w: colW,
      h,
      lines: wrapped[i]!.lines,
      labelLines: wrapped[i]!.labelLines,
      plain: n.kind === 'plain',
    });
  });

  const edges = routeEdges(d.edges, boxes, width);
  return finish(width, boxes, edges, mode);
}

function layoutTree(d: FlowDiagramData, width: number): Layout {
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  for (const e of d.edges) {
    parent.set(e.to, e.from);
    children.set(e.from, [...(children.get(e.from) ?? []), e.to]);
  }
  const order: { id: string; depth: number }[] = [];
  const visit = (id: string, depth: number) => {
    order.push({ id, depth });
    for (const c of children.get(id) ?? []) visit(c, depth + 1);
  };
  for (const n of d.nodes) if (!parent.has(n.id)) visit(n.id, 0);
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const boxes = new Map<string, Box>();
  let y = PAD;
  for (const { id, depth } of order) {
    const n = byId.get(id)!;
    const x = PAD + depth * INDENT;
    const avail = width - x - PAD;
    const w = Math.max(80, Math.min(avail, textWidth(n), 360));
    const { lines, labelLines } = boxLines(n, w);
    const h = boxHeight(lines.length) - 4;
    boxes.set(id, { id, x, y, w, h, lines, labelLines, plain: n.kind === 'plain' });
    y += h + 8;
  }
  const edges = new Map<string, EdgeGeom>();
  for (const e of d.edges) {
    const s = boxes.get(e.from)!;
    const t = boxes.get(e.to)!;
    const sx = s.x + 12;
    const points: Pt[] = [
      [sx, s.y + s.h],
      [sx, t.y + t.h / 2],
      [t.x, t.y + t.h / 2],
    ];
    edges.set(e.id, { id: e.id, points, heads: e.plain ? [] : [arrowHead(points[1]!, points[2]!)] });
  }
  return finish(width, boxes, edges, 'tree');
}

function arrowHead(from: Pt, to: Pt, size = 7): Pt[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = to[0] - ux * size;
  const by = to[1] - uy * size;
  return [to, [bx - uy * size * 0.55, by + ux * size * 0.55], [bx + uy * size * 0.55, by - ux * size * 0.55]];
}

function routeEdges(list: FlowEdge[], boxes: Map<string, Box>, width: number): Map<string, EdgeGeom> {
  const pairCount = new Map<string, FlowEdge[]>();
  for (const e of list) {
    const k = [e.from, e.to].sort().join('|');
    pairCount.set(k, [...(pairCount.get(k) ?? []), e]);
  }
  const out = new Map<string, EdgeGeom>();
  for (const e of list) {
    const s = boxes.get(e.from)!;
    const t = boxes.get(e.to)!;
    const group = pairCount.get([e.from, e.to].sort().join('|'))!;
    const off = group.length > 1 ? (group.indexOf(e) - (group.length - 1) / 2) * 12 : 0;
    const scx = s.x + s.w / 2;
    const scy = s.y + s.h / 2;
    const tcx = t.x + t.w / 2;
    const tcy = t.y + t.h / 2;
    let points: Pt[];
    let horizontal = false;
    if (Math.abs(scy - tcy) < 2 || (t.y < s.y + s.h && t.y + t.h > s.y)) {
      horizontal = true;
      const right = tcx > scx;
      const yy = (Math.max(s.y, t.y) + Math.min(s.y + s.h, t.y + t.h)) / 2 + off;
      points = [
        [right ? s.x + s.w : s.x, yy],
        [right ? t.x : t.x + t.w, yy],
      ];
    } else {
      const down = tcy > scy;
      const sy = down ? s.y + s.h : s.y;
      const ty = down ? t.y : t.y + t.h;
      const sx = scx + off;
      const tx = tcx + off;
      if (Math.abs(sx - tx) < 2) points = [[sx, sy], [sx, ty]];
      else {
        const mid = (sy + ty) / 2;
        points = [[sx, sy], [sx, mid], [tx, mid], [tx, ty]];
      }
    }
    const heads: Pt[][] = [];
    if (!e.plain) heads.push(arrowHead(points[points.length - 2]!, points[points.length - 1]!));
    if (e.twoWay) heads.push(arrowHead(points[1]!, points[0]!));
    const geom: EdgeGeom = { id: e.id, points, heads };
    if (e.label) {
      if (horizontal) {
        const seg = Math.abs(points[1]![0] - points[0]![0]);
        const lines = wrap(e.label, Math.max(6, (seg - 6) / LCHAR));
        const w = Math.max(...lines.map((l) => l.length)) * LCHAR + 6;
        const h = lines.length * LLINE + 2;
        const cx = (points[0]![0] + points[1]![0]) / 2;
        const ly = points[0]![1];
        geom.label = { x: cx - w / 2, y: off > 0 ? ly + 4 : ly - 4 - h, w, h, lines };
      } else {
        // the longest vertical segment carries the label
        let best = 0;
        for (let i = 1; i < points.length; i++) if (Math.abs(points[i]![1] - points[i - 1]![1]) > Math.abs(points[best + 1]![1] - points[best]![1])) best = i - 1;
        const a = points[best]!;
        const b = points[best + 1]!;
        // parallel arrows put their labels on opposite sides of the lines instead of on top of each other
        const side = Math.sign(off);
        const lineX = (a[0] + b[0]) / 2;
        const avail = side === 0 ? Math.min(170, width / 2) : side < 0 ? lineX - 10 : width - lineX - 10;
        const lines = wrap(e.label, Math.max(6, avail / LCHAR));
        const w = Math.max(...lines.map((l) => l.length)) * LCHAR + 8;
        const h = lines.length * LLINE + 2;
        const x = side === 0 ? lineX - w / 2 : side < 0 ? lineX - 8 - w : lineX + 8;
        geom.label = { x, y: (a[1] + b[1]) / 2 - h / 2, w, h, lines };
      }
    }
    out.set(e.id, geom);
  }
  return out;
}

function finish(width: number, boxes: Map<string, Box>, edges: Map<string, EdgeGeom>, mode: Layout['mode']): Layout {
  let maxX = width;
  let maxY = 0;
  for (const b of boxes.values()) {
    maxX = Math.max(maxX, b.x + b.w + PAD);
    maxY = Math.max(maxY, b.y + b.h);
  }
  for (const e of edges.values()) {
    if (!e.label) continue;
    // keep labels inside the drawing
    if (e.label.x < 2) e.label.x = 2;
    if (e.label.x + e.label.w > maxX - 2) e.label.x = Math.max(2, maxX - 2 - e.label.w);
    maxY = Math.max(maxY, e.label.y + e.label.h);
  }
  return { width: Math.ceil(maxX), height: Math.ceil(maxY + PAD), boxes, edges, mode };
}

/** Total length of a polyline. */
export function pathLength(points: Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  return len;
}

/** The point at fraction `t` (0..1) along a polyline. */
export function pointAt(points: Pt[], t: number): Pt {
  const total = pathLength(points);
  let want = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (want <= seg || i === points.length - 1) {
      const f = seg ? Math.min(1, want / seg) : 1;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    want -= seg;
  }
  return points[points.length - 1]!;
}
