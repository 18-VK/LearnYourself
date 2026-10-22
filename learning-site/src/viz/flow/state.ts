import type { FlowDiagramData, FlowStep } from './types';

/** Nodes a step highlights: its own `focus`, else the node its edge arrives at. */
export function focusOf(d: FlowDiagramData, s: FlowStep): string[] {
  if (s.focus?.length) return s.focus;
  const e = s.edge ? d.edges.find((x) => x.id === s.edge) : undefined;
  if (!e) return [];
  return [s.reverse ? e.from : e.to];
}

export interface StepView {
  focus: Set<string>;
  edge: string | undefined;
  /** nodes highlighted by earlier steps */
  visited: Set<string>;
  /** edges travelled by earlier steps */
  visitedEdges: Set<string>;
}

/** What the drawing shows at step `index`: current focus and edge, plus everything already passed. */
export function stepState(d: FlowDiagramData, index: number): StepView {
  const i = Math.min(Math.max(0, index), d.steps.length - 1);
  const visited = new Set<string>();
  const visitedEdges = new Set<string>();
  for (let k = 0; k < i; k++) {
    const s = d.steps[k]!;
    for (const id of focusOf(d, s)) visited.add(id);
    if (s.edge) {
      visitedEdges.add(s.edge);
      const e = d.edges.find((x) => x.id === s.edge);
      if (e) visited.add(s.reverse ? e.to : e.from);
    }
  }
  const s = d.steps[i]!;
  if (s.edge) {
    const e = d.edges.find((x) => x.id === s.edge);
    if (e) visited.add(s.reverse ? e.to : e.from);
  }
  const focus = new Set(focusOf(d, s));
  for (const id of focus) visited.delete(id);
  return { focus, edge: s.edge, visited, visitedEdges };
}
