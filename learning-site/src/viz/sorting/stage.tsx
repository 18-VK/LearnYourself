import { hierarchy, tree as d3tree } from 'd3-hierarchy';
import { motion, useReducedMotion } from 'motion/react';
import type { ArrayState, AuxArray, Highlights } from '../engine/types';

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const LETTERS = 'abcdefghij';

/** For each original element id, a letter if its value occurs more than once in the input (a = first occurrence). */
export function tieLetters(input: readonly number[]): (string | null)[] {
  const seen = new Map<number, number>();
  const counts = new Map<number, number>();
  input.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return input.map((v) => {
    if ((counts.get(v) ?? 0) < 2) return null;
    const k = seen.get(v) ?? 0;
    seen.set(v, k + 1);
    return LETTERS[k] ?? String(k + 1);
  });
}

function classFor(i: number, h: Highlights, state: ArrayState): string {
  const cls = ['bar'];
  if (h.swap?.includes(i)) cls.push('is-swap');
  else if (h.compare?.includes(i)) cls.push('is-compare');
  else if (h.active?.includes(i)) cls.push('is-active');
  else if (h.settled?.includes(i)) cls.push('is-settled');
  if (h.range && (i < h.range[0] || i > h.range[1])) cls.push('is-out');
  if (state.heapSize !== undefined && i >= state.heapSize && !h.settled?.includes(i)) cls.push('is-out');
  return cls.join(' ');
}

export function Bars({
  state,
  highlights,
  max,
  ties,
  labels,
}: {
  state: ArrayState;
  highlights: Highlights;
  max: number;
  ties: (string | null)[] | null;
  labels?: readonly string[];
}) {
  const reduce = useReducedMotion();
  const n = state.values.length;
  const pointers = new Map<number, string[]>();
  for (const [name, i] of Object.entries(highlights.pointers ?? {})) if (i >= 0 && i < n) pointers.set(i, [...(pointers.get(i) ?? []), name]);
  const band = highlights.band;
  return (
    <div className="viz-bars-wrap">
      <div className="viz-bars" role="img" aria-label={`Array: ${state.values.map(fmt).join(', ')}`}>
        {state.values.map((v, i) => {
          const id = state.ids[i];
          const tie = ties && id !== null && id !== undefined ? ties[id] : null;
          const pct = max > 0 ? 8 + (92 * v) / max : 8;
          return (
            <div key={i} className={classFor(i, highlights, state)} data-tie={tie ?? undefined}>
              <div className="bar-col">
                <motion.div className="bar-fill" initial={false} animate={{ height: `${pct}%` }} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />
              </div>
              <div className="bar-val">
                {fmt(v)}
                {tie && <sub className="tie">{tie}</sub>}
              </div>
              {labels && <div className="bar-label">{id !== null && id !== undefined ? labels[id] : '—'}</div>}
              <div className="bar-ptr">{pointers.get(i)?.join(' ') ?? ''}</div>
            </div>
          );
        })}
      </div>
      <div className="viz-band" aria-hidden="true">
        {band && (
          <span style={{ left: `${(band.from / n) * 100}%`, width: `${((band.to - band.from + 1) / n) * 100}%` }}>{band.label}</span>
        )}
      </div>
    </div>
  );
}

export function AuxRows({ aux, ties }: { aux: AuxArray[]; ties: (string | null)[] | null }) {
  return (
    <div className="viz-aux">
      {aux.map((a) => (
        <div className="aux-row" key={a.name}>
          <span className="aux-name">{a.name}</span>
          <div className="aux-cells" role="img" aria-label={`${a.name}: ${a.values.map((v) => (v === null ? 'empty' : fmt(v))).join(', ')}`}>
            {a.values.length === 0 && <span className="aux-empty">empty</span>}
            {a.values.map((v, i) => {
              const hl = a.highlight;
              const cls = ['aux-cell', hl?.write?.includes(i) ? 'is-swap' : hl?.compare?.includes(i) ? 'is-compare' : hl?.active?.includes(i) ? 'is-active' : ''].join(' ');
              const id = a.ids?.[i];
              const tie = ties && id !== null && id !== undefined ? ties[id] : null;
              const ptr = Object.entries(a.pointers ?? {}).filter(([, k]) => k === i).map(([name]) => name).join(' ');
              return (
                <div className="aux-col" key={i}>
                  <span className="aux-ptr">{ptr}</span>
                  <span className={cls}>
                    {v === null ? '' : fmt(v)}
                    {tie && <sub className="tie">{tie}</sub>}
                  </span>
                  <span className="aux-idx">{a.labels?.[i] ?? i}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TreeDatum {
  i: number;
  children?: TreeDatum[];
}

/** Heap view: the array as the complete binary tree it represents (children of i at 2i+1 and 2i+2). */
export function HeapTree({ state, highlights }: { state: ArrayState; highlights: Highlights }) {
  const n = state.values.length;
  if (n === 0) return null;
  const build = (i: number): TreeDatum => {
    const kids = [2 * i + 1, 2 * i + 2].filter((k) => k < n).map(build);
    return kids.length ? { i, children: kids } : { i };
  };
  const root = d3tree<TreeDatum>().nodeSize([44, 58])(hierarchy(build(0)));
  const nodes = root.descendants();
  const xs = nodes.map((d) => d.x);
  const minX = Math.min(...xs) - 26;
  const width = Math.max(...xs) - minX + 26;
  const height = Math.max(...nodes.map((d) => d.y)) + 50;
  return (
    <svg className="heap-tree" viewBox={`${minX} -24 ${width} ${height}`} role="img" aria-label="The array drawn as a binary heap">
      {root.links().map((l) => (
        <line key={`${l.source.data.i}-${l.target.data.i}`} x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} className={state.heapSize !== undefined && l.target.data.i >= state.heapSize ? 'edge is-out' : 'edge'} />
      ))}
      {nodes.map((d) => {
        const i = d.data.i;
        const cls = classFor(i, highlights, state).replace('bar', 'node');
        return (
          <g key={i} className={cls} transform={`translate(${d.x},${d.y})`}>
            <circle r={18} />
            <text dy="0.35em" textAnchor="middle">{fmt(state.values[i]!)}</text>
            <text className="node-idx" dy="2.6em" textAnchor="middle">[{i}]</text>
          </g>
        );
      })}
    </svg>
  );
}
