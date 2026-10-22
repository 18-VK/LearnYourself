import type { Highlights } from '../engine/types';
import type { SearchState } from './recorder';

/** Pointer names in the order their label rows are stacked, so a name keeps its row from step to step. */
const POINTER_ORDER = ['left', 'lo', 'prev', 'i', 'm1', 'mid', 'pos', 'end', 'm2', 'right', 'hi', 'bound', 'idx', 'best', 'lower', 'upper', 'ans'];
const rank = (name: string) => {
  const k = POINTER_ORDER.indexOf(name);
  return k < 0 ? POINTER_ORDER.length : k;
};
export const sortPointers = (p: Record<string, number>) => Object.entries(p).sort((a, b) => rank(a[0]) - rank(b[0]));

/** The colour class for index i: compare beats active beats found; outside the live range is dimmed. */
export function cellClass(i: number, h: Highlights): string {
  const cls: string[] = [];
  if (h.compare?.includes(i)) cls.push('is-compare');
  else if (h.active?.includes(i)) cls.push('is-active');
  else if (h.settled?.includes(i)) cls.push('is-settled');
  if (h.range && (i < h.range[0] || i > h.range[1])) cls.push('is-out');
  return cls.join(' ');
}

/** How many pointer rows a whole trace needs, so the stage does not jump in height while playing. */
export function pointerRows(steps: readonly { highlights: Highlights }[]): number {
  return Math.max(1, ...steps.map((s) => Object.keys(s.highlights.pointers ?? {}).length));
}

function PointerRows({ pointers, columns, offset, rows }: { pointers: Record<string, number>; columns: number; offset: number; rows: number }) {
  const list = sortPointers(pointers);
  return (
    <div className="sv-ptrs" aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => {
        const p = list[r];
        return (
          <div className="sv-ptr-row" key={r} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 56px))` }}>
            {p && (
              <span className="sv-ptr" style={{ gridColumn: p[1] + offset + 1 }}>
                <span className="sv-caret">▲</span>
                {p[0]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** An index just outside the array that a pointer can hold (right = arr.Length, or right = -1). */
function Ghost({ label, index }: { label: string; index: number }) {
  return (
    <div className="bar sv-ghost" aria-hidden="true">
      <div className="bar-col" />
      <div className="bar-val">{label}</div>
      <div className="sv-idx">{index}</div>
    </div>
  );
}

/** The array as bars with indexes; pointers (left, mid, right…) sit under the bars, one row per name. */
export function SearchBars({ state, highlights, rows, max }: { state: SearchState; highlights: Highlights; rows: number; max: number }) {
  const n = state.values.length;
  const ptrs = highlights.pointers ?? {};
  const ghostLeft = Object.values(ptrs).some((i) => i === -1);
  const ghostRight = Object.values(ptrs).some((i) => i === n);
  const offset = ghostLeft ? 1 : 0;
  const columns = n + offset + (ghostRight ? 1 : 0);
  const band = highlights.band;
  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(0, 56px))` };
  return (
    <div className="sv-bars-wrap">
      <div className="sv-bars" style={grid} role="img" aria-label={`Array: ${state.values.join(', ')}`}>
        {ghostLeft && <Ghost label="·" index={-1} />}
        {state.values.map((v, i) => (
          <div key={i} className={`bar ${cellClass(i, highlights)}`}>
            <div className="bar-col">
              <div className="bar-fill" style={{ height: `${max > 0 ? 6 + (94 * v) / max : 6}%` }} />
            </div>
            <div className="bar-val">{v}</div>
            <div className="sv-idx">{i}</div>
          </div>
        ))}
        {ghostRight && <Ghost label="end" index={n} />}
      </div>
      <div className="sv-band" style={grid} aria-hidden="true">
        {band && <span style={{ gridColumn: `${band.from + offset + 1} / ${band.to + offset + 2}` }}>{band.label}</span>}
      </div>
      <PointerRows pointers={ptrs} columns={columns} offset={offset} rows={rows} />
    </div>
  );
}

/** Binary search on the answer: every candidate 0..x as a cell, marked ✓ or ✗ once it has been checked. */
export function AnswerGrid({ state, highlights }: { state: SearchState; highlights: Highlights }) {
  const n = state.values.length;
  const at = new Map<number, string[]>();
  for (const [name, i] of sortPointers(highlights.pointers ?? {})) at.set(i, [...(at.get(i) ?? []), name]);
  return (
    <div className="sv-grid" style={{ gridTemplateColumns: `repeat(${Math.min(10, n)}, minmax(0, 46px))` }} role="img" aria-label={`Candidates 0 to ${n - 1}`}>
      {state.values.map((v, i) => {
        const mark = state.marks?.[i];
        return (
          <div key={i} className={`sv-cell ${cellClass(i, highlights)}`}>
            <span className="sv-cell-v">{v}</span>
            <span className={`sv-mark${mark === '✓' ? ' ok' : mark === '✗' ? ' no' : ''}`}>{mark ?? ''}</span>
            <span className="sv-cell-ptr">
              {(at.get(i) ?? []).map((name) => (
                <span key={name}>{name}</span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Ternary search: the array drawn as a unimodal function, with left, m1, m2 and right as vertical markers. */
export function FunctionPlot({ state, highlights, rows }: { state: SearchState; highlights: Highlights; rows: number }) {
  const vals = state.values;
  const n = vals.length;
  const W = 320;
  const pad = 16;
  const plotH = 150;
  const rowH = 13;
  const H = plotH + 18 + rows * rowH;
  const max = Math.max(1, ...vals);
  const x = (i: number) => (n === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => plotH - 8 - (v / max) * (plotH - 30);
  const range = highlights.range;
  const ptrs = sortPointers(highlights.pointers ?? {});
  const step = n > 1 ? (W - 2 * pad) / (n - 1) : W;
  return (
    <svg className="sv-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Unimodal function: ${vals.join(', ')}`}>
      {range && range[0] > 0 && <rect className="sv-plot-out" x={0} y={0} width={x(range[0]) - step / 2} height={plotH} />}
      {range && range[1] < n - 1 && <rect className="sv-plot-out" x={x(range[1]) + step / 2} y={0} width={W - x(range[1]) - step / 2} height={plotH} />}
      <line className="sv-plot-axis" x1={pad / 2} x2={W - pad / 2} y1={plotH - 4} y2={plotH - 4} />
      {ptrs.map(([name, i]) => (
        <line key={name} className={`sv-plot-marker${name === 'm1' || name === 'm2' ? ' is-mid' : ''}`} x1={x(i)} x2={x(i)} y1={10} y2={plotH - 4} />
      ))}
      <polyline className="sv-plot-line" points={vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      {vals.map((v, i) => (
        <g key={i} className={`sv-plot-pt ${cellClass(i, highlights)}`}>
          <circle cx={x(i)} cy={y(v)} r={5} />
          <text x={x(i)} y={y(v) - 9} textAnchor="middle">{v}</text>
          <text className="sv-plot-idx" x={x(i)} y={plotH + 10} textAnchor="middle">{i}</text>
        </g>
      ))}
      {ptrs.map(([name, i], r) => (
        <text key={name} className="sv-plot-ptr" x={x(i)} y={plotH + 18 + (r + 1) * rowH - 2} textAnchor="middle">▲ {name}</text>
      ))}
    </svg>
  );
}

export function CallStack({ calls }: { calls: readonly string[] }) {
  return (
    <div className="sv-stack" aria-label="Call stack">
      <span className="eyebrow">Call stack</span>
      {calls.length === 0 ? (
        <p className="muted sv-empty">empty</p>
      ) : (
        <ol>
          {[...calls].reverse().map((c, k) => (
            <li key={`${c}-${calls.length - k}`} className={k === 0 ? 'is-top' : undefined}>
              {c}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
