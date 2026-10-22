import { scaleLinear } from 'd3-scale';
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { doublingFactor, formatLog10, N_STEPS, pickClasses, superscript, type GrowthClass } from './bigo';
import './dsa.css';

export interface BigOGrowthVisualizerProps {
  /** Growth classes to compare, as the roadmap note writes them: "O(1)", "O(log n)", … "O(2ⁿ)". */
  classes?: string[];
  placement?: string;
}

/**
 * Series colours follow the class, never its rank, so hiding a line never repaints the others. They are
 * set as --bo-1 … --bo-6 in dsa.css (validated for colour-vision deficiency in both themes) and every line
 * also carries a direct label, so colour is never the only cue.
 */
const SLOT: Record<string, number> = { 'O(1)': 1, 'O(log n)': 2, 'O(n)': 3, 'O(n log n)': 4, 'O(n²)': 5, 'O(2ⁿ)': 6 };
const colour = (c: GrowthClass) => `var(--bo-${SLOT[c.id] ?? 1})`;

const H = 260;
const M = { top: 14, right: 84, bottom: 30, left: 56 };

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((es) => setW(Math.max(260, Math.round(es[0]!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const tickLabel = (k: number) => (k <= 4 ? (10 ** k).toLocaleString('en-US') : `10${superscript(k)}`);

export default function BigOGrowthVisualizer(props: BigOGrowthVisualizerProps) {
  const id = useId();
  const classes = useMemo(() => pickClasses(props.classes), [props.classes]);
  const [stepIdx, setStepIdx] = useState(N_STEPS.indexOf(8));
  const [log, setLog] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, width] = useWidth<HTMLDivElement>(640);
  const n = N_STEPS[stepIdx]!;
  const visible = classes.filter((c) => !hidden.has(c.id));

  // x samples: every integer for small n, otherwise 160 evenly spaced points (always ending at n)
  const xs = useMemo(() => {
    if (n <= 160) return Array.from({ length: n }, (_, k) => k + 1);
    return Array.from({ length: 161 }, (_, k) => 1 + ((n - 1) * k) / 160);
  }, [n]);

  const chart = useMemo(() => {
    const innerW = width - M.left - M.right;
    const innerH = H - M.top - M.bottom;
    const x = scaleLinear().domain([1, Math.max(2, n)]).range([0, innerW]);
    const atN = visible.map((c) => ({ c, l: c.log10(n) }));
    const sorted = [...atN].sort((a, b) => b.l - a.l);
    let clipped: GrowthClass | null = null;
    let yMaxLog = Math.max(0, sorted[0]?.l ?? 0);
    // In linear mode a 2ⁿ curve a million times above the next one would flatten every other line:
    // keep the scale for the others and say plainly that 2ⁿ leaves the chart.
    if (!log && sorted.length > 1 && sorted[0]!.c.id === 'O(2ⁿ)' && sorted[0]!.l > Math.max(0, sorted[1]!.l) + 6) {
      clipped = sorted[0]!.c;
      yMaxLog = Math.max(0, sorted[1]!.l);
    }
    const yMax = log ? Math.max(1, Math.ceil(yMaxLog)) : Math.max(1, 10 ** yMaxLog);
    const y = scaleLinear().domain([0, yMax]).range([innerH, 0]);
    const yOf = (l: number) => {
      if (log) return y(Math.max(0, l));
      const v = l === -Infinity ? 0 : 10 ** Math.min(l, yMaxLog + 3);
      return y(v);
    };
    const paths = visible.map((c) => ({ c, d: xs.map((xv, k) => `${k ? 'L' : 'M'}${x(xv).toFixed(1)},${yOf(c.log10(xv)).toFixed(1)}`).join('') }));
    // direct labels at the right end, pushed apart so they never overlap
    const labels = visible
      .map((c) => ({ c, y: c === clipped ? 0 : Math.min(innerH, Math.max(0, yOf(c.log10(n)))) }))
      .sort((a, b) => a.y - b.y);
    for (let k = 1; k < labels.length; k++) labels[k]!.y = Math.max(labels[k]!.y, labels[k - 1]!.y + 13);
    for (let k = labels.length - 1; k >= 0; k--) {
      const limit = k === labels.length - 1 ? innerH : labels[k + 1]!.y - 13;
      labels[k]!.y = Math.min(labels[k]!.y, limit);
    }
    const ticks = log
      ? Array.from({ length: Math.ceil(yMax) + 1 }, (_, k) => k).filter((k, _, a) => a.length <= 7 || k % Math.ceil(a.length / 6) === 0)
      : y.ticks(5);
    return { innerW, innerH, x, y, paths, labels, ticks, clipped };
  }, [width, n, visible, xs, log]);

  const toggle = (c: GrowthClass) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(c.id)) next.delete(c.id);
      else if (classes.length - next.size > 1) next.add(c.id);
      return next;
    });

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const xv = chart.x.invert(((e.clientX - r.left) / r.width) * chart.innerW);
    let best = 0;
    xs.forEach((v, k) => {
      if (Math.abs(v - xv) < Math.abs(xs[best]! - xv)) best = k;
    });
    setHover(best);
  };
  const hx = hover !== null ? xs[hover] : null;
  const roundX = (v: number) => (Number.isInteger(v) ? v : Math.round(v));

  return (
    <div className="viz bo" role="region" aria-label="Big-O growth comparison">
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Visualizer</span>
        <strong className="viz-title">Big-O growth</strong>
        <span className="viz-keys muted">How the operation count grows with n</span>
      </div>
      <div className="viz-input">
        <label htmlFor={`${id}-n`}>
          n = <span className="mono bo-n">{n.toLocaleString('en-US')}</span>
        </label>
        <input
          id={`${id}-n`}
          type="range"
          min={0}
          max={N_STEPS.length - 1}
          value={stepIdx}
          onChange={(e) => setStepIdx(Number(e.target.value))}
          aria-valuetext={`n = ${n}`}
          className="bo-slider"
        />
        <div className="presets" role="group" aria-label="Jump to n">
          {[10, 100, 1000, 100_000].map((v) => (
            <button key={v} type="button" className="chipbtn" aria-pressed={n === v} onClick={() => setStepIdx(N_STEPS.indexOf(v))}>
              n = {v === 100_000 ? '10⁵' : v.toLocaleString('en-US')}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> Log scale (y)
        </label>
      </div>

      <div className="bo-legend" role="group" aria-label="Show or hide a growth class">
        {classes.map((c) => (
          <button key={c.id} type="button" className="bo-key" aria-pressed={!hidden.has(c.id)} onClick={() => toggle(c)}>
            <span className="bo-sw" style={{ background: colour(c) }} aria-hidden="true" />
            {c.label}
          </button>
        ))}
      </div>

      <div className="bo-chart" ref={wrapRef}>
        <svg width={width} height={H} role="img" aria-label={`Operation counts from n = 1 to ${n} on a ${log ? 'logarithmic' : 'linear'} scale. The table below lists the values.`}>
          <defs>
            <clipPath id={`${id}-clip`}>
              <rect x={0} y={-2} width={chart.innerW + 2} height={chart.innerH + 4} />
            </clipPath>
          </defs>
          <g transform={`translate(${M.left},${M.top})`}>
            {chart.ticks.map((t) => (
              <g key={t} transform={`translate(0,${chart.y(t)})`}>
                <line className="bo-grid" x1={0} x2={chart.innerW} />
                <text className="bo-tick" x={-8} dy="0.32em" textAnchor="end">
                  {log ? tickLabel(t) : formatLog10(Math.log10(t))}
                </text>
              </g>
            ))}
            {chart.x.ticks(Math.max(2, Math.floor(chart.innerW / 90))).map((t) => (
              <text key={t} className="bo-tick" x={chart.x(t)} y={chart.innerH + 18} textAnchor="middle">
                {t.toLocaleString('en-US')}
              </text>
            ))}
            <line className="bo-axis" x1={0} x2={chart.innerW} y1={chart.innerH} y2={chart.innerH} />
            <text className="bo-axis-label" x={chart.innerW + 26} y={chart.innerH + 18}>
              n
            </text>
            <g clipPath={`url(#${id}-clip)`}>
              {chart.paths.map(({ c, d }) => (
                <path key={c.id} className="bo-line" d={d} style={{ stroke: colour(c) }} />
              ))}
            </g>
            {chart.labels.map(({ c, y }) => (
              <g key={c.id} transform={`translate(${chart.innerW + 6},${y})`}>
                <circle r={3} style={{ fill: colour(c) }} />
                <text className="bo-label" x={6} dy="0.32em">
                  {c === chart.clipped ? `${c.label} ↑` : c.label}
                </text>
              </g>
            ))}
            {hx !== null && hx !== undefined && <line className="bo-cross" x1={chart.x(hx)} x2={chart.x(hx)} y1={0} y2={chart.innerH} />}
            <rect className="bo-hit" width={chart.innerW} height={chart.innerH} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hx !== null && hx !== undefined && (
          <div className="bo-tip" style={{ left: Math.min(M.left + chart.x(hx) + 10, width - 170), top: M.top }} aria-hidden="true">
            <b>n = {roundX(hx).toLocaleString('en-US')}</b>
            {[...visible]
              .sort((a, b) => b.log10(roundX(hx)) - a.log10(roundX(hx)))
              .map((c) => (
                <span key={c.id}>
                  <i style={{ background: colour(c) }} aria-hidden="true" />
                  {c.label}: {formatLog10(c.log10(roundX(hx)))}
                </span>
              ))}
          </div>
        )}
      </div>
      {chart.clipped && (
        <p className="viz-hint" role="status">
          {chart.clipped.label} at n = {n.toLocaleString('en-US')} is {formatLog10(chart.clipped.log10(n))}, far above the top of this chart, so it runs off the top. Turn on the log scale to see it.
        </p>
      )}

      <div className="bo-table-wrap" tabIndex={0} role="region" aria-label={`Operation counts at n = ${n}`}>
        <table className="bo-table">
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col" className="bo-formula">Operations</th>
              <th scope="col">At n = {n.toLocaleString('en-US')}</th>
              <th scope="col">When n doubles</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id} className={hidden.has(c.id) ? 'is-hidden' : undefined}>
                <th scope="row">
                  <span className="bo-sw" style={{ background: colour(c) }} aria-hidden="true" />
                  {c.label}
                </th>
                <td className="mono bo-formula">{c.formula}</td>
                <td className="mono">{formatLog10(c.log10(n))}</td>
                <td className="mono">{doublingFactor(c, n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="viz-hint bo-foot">
        From the roadmap's Level 0: learn to pick an approach from the limits, for example <q>n ≤ 10⁵ → need O(n log n) or better</q>. log is log₂ here: the number of times n can be halved.
      </p>
    </div>
  );
}
