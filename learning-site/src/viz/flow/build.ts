/**
 * Small helpers for authoring diagram data. They only arrange what the note shows: every label passed in
 * is copied from the original ASCII, and default narration is built from those same labels.
 */
import type { FlowDiagramData, FlowEdge, FlowNode, FlowStep } from './types';

type Meta = Pick<FlowDiagramData, 'id' | 'title' | 'source'>;
export type ChainItem = string | { label: string; lines?: string[]; kind?: FlowNode['kind'] };

/** A node's text for narration: its label plus any extra lines in the same box. */
export function describe(n: FlowNode): string {
  const extra = (n.lines ?? []).map((l) => l.replace(/^\s*[•–-]\s*/, ''));
  const paren = extra.filter((l) => /^\(.*\)$/.test(l));
  const rest = extra.filter((l) => !/^\(.*\)$/.test(l));
  let text = paren.length ? `${n.label} ${paren.join(' ')}` : n.label;
  if (rest.length) text += `${/:$/.test(text) ? ' ' : ': '}${rest.join('; ')}`;
  return text;
}

/**
 * Default steps: start on the first node, then follow every edge in declared order, highlighting the
 * node it reaches. `narration` overrides the text of individual steps (by step index).
 */
export function autoSteps(nodes: FlowNode[], edges: FlowEdge[], narration: Record<number, string> = {}): FlowStep[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const first = nodes.find((n) => !edges.some((e) => e.to === n.id)) ?? nodes[0]!;
  const steps: FlowStep[] = [{ focus: [first.id], narration: describe(first) }];
  for (const e of edges) {
    const from = byId.get(e.from)!;
    const to = byId.get(e.to)!;
    steps.push({ edge: e.id, narration: `${from.label} → ${describe(to)}${e.label ? `: ${e.label}` : ''}` });
  }
  return steps.map((s, i) => (narration[i] ? { ...s, narration: narration[i]! } : s));
}

/** A straight sequence A → B → C …, the most common shape in the notes. */
export function chain(
  meta: Meta,
  items: ChainItem[],
  opts: { edgeLabels?: Record<number, string>; narration?: Record<number, string> } = {},
): FlowDiagramData {
  const nodes: FlowNode[] = items.map((it, i) => {
    const base = typeof it === 'string' ? { label: it } : it;
    return { id: `n${i + 1}`, ...base };
  });
  const edges: FlowEdge[] = nodes.slice(1).map((n, i) => ({
    id: `e${i + 1}`,
    from: nodes[i]!.id,
    to: n.id,
    ...(opts.edgeLabels?.[i + 1] ? { label: opts.edgeLabels[i + 1] } : {}),
  }));
  return { ...meta, layout: 'chain', nodes, edges, steps: autoSteps(nodes, edges, opts.narration) };
}

/** An explicit diagram; steps default to `autoSteps`. */
export function diagram(d: Omit<FlowDiagramData, 'steps'> & { steps?: FlowStep[]; narration?: Record<number, string> }): FlowDiagramData {
  const { narration, ...rest } = d;
  return { ...rest, steps: d.steps ?? autoSteps(d.nodes, d.edges, narration) };
}

/** Where the ASCII lives: the Nth fenced block under `section` in `file` (`occurrence` when the heading repeats). */
export const src = (file: string, section: string, codeBlock = 1, occurrence?: number): FlowDiagramData['source'] =>
  occurrence && occurrence > 1 ? { file, section, codeBlock, occurrence } : { file, section, codeBlock };
