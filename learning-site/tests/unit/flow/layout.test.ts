import { describe, expect, it } from 'vitest';
import { chain, src } from '../../../src/viz/flow/build';
import { DIAGRAMS } from '../../../src/viz/flow/diagrams';
import { layoutDiagram, pathLength, pointAt, wrap, type Box } from '../../../src/viz/flow/layout';
import { stepState } from '../../../src/viz/flow/state';
import type { FlowDiagramData } from '../../../src/viz/flow/types';

const all: [string, FlowDiagramData][] = await Promise.all(Object.entries(DIAGRAMS).map(async ([id, load]) => [id, (await load()).default] as [string, FlowDiagramData]));
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const near = (a: number, b: number) => Math.abs(a - b) < 1.5;

describe('wrap', () => {
  it('breaks on spaces and splits words longer than a line', () => {
    expect(wrap('Data Access Layer (Repository / EF Core)', 20)).toEqual(['Data Access Layer', '(Repository / EF', 'Core)']);
    expect(wrap('INotifyPropertyChanged', 10)).toEqual(['INotifyPro', 'pertyChang', 'ed']);
    expect(wrap('', 10)).toEqual(['']);
  });
});

describe('polyline helpers', () => {
  it('measures and interpolates', () => {
    const pts: [number, number][] = [[0, 0], [0, 10], [10, 10]];
    expect(pathLength(pts)).toBe(20);
    expect(pointAt(pts, 0)).toEqual([0, 0]);
    expect(pointAt(pts, 0.5)).toEqual([0, 10]);
    expect(pointAt(pts, 0.75)).toEqual([5, 10]);
    expect(pointAt(pts, 1)).toEqual([10, 10]);
  });
});

describe('chain layout', () => {
  const d = chain({ id: 't', title: 't', source: src('x', '# x') }, ['A', 'B', 'C', 'D', 'E', 'F']);
  it('is one column on a phone', () => {
    const l = layoutDiagram(d, 340);
    expect(l.mode).toBe('column');
    const xs = new Set([...l.boxes.values()].map((b) => Math.round(b.x)));
    expect(xs.size).toBe(1);
  });
  it('snakes in rows on a wide screen, so every arrow joins neighbours', () => {
    const l = layoutDiagram(d, 900);
    expect(l.mode).toBe('rows');
    const b = (id: string) => l.boxes.get(id)!;
    // row 1 runs right to left: E sits under D, F to the left of E
    expect(near(b('n5').x, b('n4').x)).toBe(true);
    expect(b('n5').y).toBeGreaterThan(b('n4').y);
    expect(b('n6').x).toBeLessThan(b('n5').x);
    for (const e of d.edges) {
      const g = l.edges.get(e.id)!;
      expect(g.points.length, `${e.id} is a straight arrow`).toBe(2);
    }
  });
});

describe.each(all)('layout of %s', (_id, d) => {
  for (const width of [320, 350, 600, 900]) {
    it(`fits ${width}px without overlapping boxes`, () => {
      const l = layoutDiagram(d, width);
      const boxes = [...l.boxes.values()];
      expect(boxes.length).toBe(d.nodes.length);
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i]!;
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x + a.w).toBeLessThanOrEqual(l.width + 0.5);
        expect(a.y + a.h).toBeLessThanOrEqual(l.height);
        for (let j = i + 1; j < boxes.length; j++) expect(overlap(a, boxes[j]!), `${a.id} overlaps ${boxes[j]!.id}`).toBe(false);
      }
      // no horizontal scrolling for chains and grids
      if (d.layout !== 'tree') expect(l.width).toBeLessThanOrEqual(Math.max(260, width));
      for (const e of d.edges) {
        const g = l.edges.get(e.id)!;
        expect(g.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
        expect(pathLength(g.points), `${e.id} has length`).toBeGreaterThan(0);
        if (g.label) {
          expect(g.label.x).toBeGreaterThanOrEqual(0);
          expect(g.label.x + g.label.w).toBeLessThanOrEqual(l.width + 0.5);
        }
      }
      // every label line fits in its box (monospace, so this is exact)
      for (const b of boxes) for (const line of b.lines) expect(line.length * 7.6 + 20, `${b.id}: "${line}"`).toBeLessThanOrEqual(b.w + 0.5);
    });
  }
});

describe('step state', () => {
  const d = chain({ id: 't', title: 't', source: src('x', '# x') }, ['A', 'B', 'C']);
  it('highlights the node the edge reaches and keeps earlier ones as passed', () => {
    expect([...stepState(d, 0).focus]).toEqual(['n1']);
    const s2 = stepState(d, 2);
    expect([...s2.focus]).toEqual(['n3']);
    expect(s2.edge).toBe('e2');
    expect([...s2.visited].sort()).toEqual(['n1', 'n2']);
    expect([...s2.visitedEdges]).toEqual(['e1']);
  });
  it('clamps out-of-range indexes', () => {
    expect([...stepState(d, 99).focus]).toEqual(['n3']);
    expect([...stepState(d, -3).focus]).toEqual(['n1']);
  });
});
