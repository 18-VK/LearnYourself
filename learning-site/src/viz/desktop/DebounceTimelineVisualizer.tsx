import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CodePanel, Controls, Narration } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { DEBOUNCE_WPF } from './csharp';
import { clampOptions, debounceTrace, type DebounceState } from './debounce';
import './desktop.css';

export interface DebounceTimelineVisualizerProps {
  delayMs?: number;
  text?: string;
  gapMs?: number;
  placement?: string;
}

export default function DebounceTimelineVisualizer(props: DebounceTimelineVisualizerProps) {
  const [opts, setOpts] = useState(() => clampOptions({ text: props.text ?? 'Task', gapMs: props.gapMs ?? 120, delayMs: props.delayMs ?? 300, pauseAfter: 0 }));
  const [draft, setDraft] = useState(opts.text);
  const trace = useMemo(() => debounceTrace(opts), [opts]);
  const p = usePlayer(trace.length, () => false, JSON.stringify(opts));
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const end = trace[trace.length - 1]!.state;
  const id = useId();
  const update = (change: Partial<typeof opts>) => setOpts(clampOptions({ ...opts, ...change }));

  return (
    <div className="viz desk" role="region" aria-label="Debounce timeline visualizer" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Visualizer</span>
        <strong className="viz-title">Debounced search: keystrokes vs searches</strong>
        <span className="viz-keys muted">Space plays or pauses · ← → step</span>
      </div>
      <div className="viz-input">
        <label htmlFor={`${id}-text`}>
          Typed text
          <input
            id={`${id}-text`}
            type="text"
            value={draft}
            maxLength={12}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              update({ text: draft });
              setDraft(clampOptions({ ...opts, text: draft }).text);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              update({ text: draft });
              setDraft(clampOptions({ ...opts, text: draft }).text);
            }}
          />
        </label>
        <label htmlFor={`${id}-gap`}>
          Gap between keys <span className="mono">{opts.gapMs} ms</span>
          <input id={`${id}-gap`} type="range" min={40} max={600} step={20} value={opts.gapMs} onChange={(e) => update({ gapMs: Number(e.target.value) })} />
        </label>
        <label htmlFor={`${id}-delay`}>
          Interval <span className="mono">{opts.delayMs} ms</span>
          <input id={`${id}-delay`} type="range" min={100} max={800} step={50} value={opts.delayMs} onChange={(e) => update({ delayMs: Number(e.target.value) })} />
        </label>
        <label htmlFor={`${id}-pause`}>
          Pause
          <select id={`${id}-pause`} value={opts.pauseAfter} onChange={(e) => update({ pauseAfter: Number(e.target.value) })}>
            <option value={0}>none</option>
            {Array.from({ length: Math.max(0, opts.text.length - 1) }, (_, i) => (
              <option key={i} value={i + 1}>after "{opts.text.slice(0, i + 1)}"</option>
            ))}
          </select>
        </label>
      </div>

      <div className="viz-stage">
        <Timeline st={step.state} endTime={Math.max(end.time, ...end.timers.map((t) => t.due))} delay={opts.delayMs} />
      </div>
      <Controls p={p} label="Debounce" />
      <div className="viz-panels">
        <CodePanel code={DEBOUNCE_WPF} line={step.codeLine} title="DebounceSearch.md, In WPF (C# from the notes)" />
        <div className="viz-side">
          <Narration text={step.narration} prediction={undefined} p={p} />
          <div className="counters" aria-label="Counters">
            <div><b>{step.state.keys.length}</b><span>Keystrokes</span></div>
            <div><b>{step.state.timers.filter((t) => t.status === 'cancelled').length}</b><span>Countdowns cancelled</span></div>
            <div><b>{step.state.searches.length}</b><span>Searches (debounced)</span></div>
            <div><b>{step.state.naive.length}</b><span>Searches without debounce</span></div>
          </div>
          <ul className="legend" aria-label="Colour legend">
            <li><span className="sw sw-active" aria-hidden="true" />Countdown running</li>
            <li><span className="sw sw-idle" aria-hidden="true" />Countdown cancelled</li>
            <li><span className="sw sw-settled" aria-hidden="true" />Tick fired, search ran</li>
            <li><span className="sw sw-compare" aria-hidden="true" />Search without debounce</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const LANES = ['Keystrokes', 'Timer', 'ApplySearch()', 'Without debounce'];

function Timeline({ st, endTime, delay }: { st: DebounceState; endTime: number; delay: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = w < 520;
  const left = narrow ? 8 : 128;
  const right = 18;
  const laneH = narrow ? 50 : 40;
  const top = 8;
  const span = Math.max(endTime + 80, delay * 2);
  const x = (t: number) => left + ((w - left - right) * t) / span;
  const laneY = (i: number) => top + i * laneH + (narrow ? 22 : 0);
  const height = laneY(LANES.length - 1) + 20 + 34;
  const step = span > 2400 ? 500 : span > 1200 ? 200 : 100;
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => i * step);
  return (
    <div ref={box} className="deb-wrap">
      <svg className="deb-svg" width={w} height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={`Timeline at ${st.time} ms: ${st.keys.length} keystrokes, ${st.searches.length} searches`}>
        {LANES.map((name, i) => (
          <g key={name}>
            <line className="deb-lane" x1={left} x2={w - right} y1={laneY(i) + 20} y2={laneY(i) + 20} />
            <text className="deb-lname" x={narrow ? left : left - 10} y={narrow ? laneY(i) - 6 : laneY(i) + 24} textAnchor={narrow ? 'start' : 'end'}>{name}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t} className="deb-tick">
            <line x1={x(t)} x2={x(t)} y1={height - 24} y2={height - 19} />
            <text x={x(t)} y={height - 8} textAnchor="middle">{t}</text>
          </g>
        ))}
        {st.keys.map((k, i) => (
          <g key={`k${i}`} className="deb-key">
            <line x1={x(k.t)} x2={x(k.t)} y1={laneY(0) + 12} y2={laneY(0) + 28} />
            <text x={x(k.t)} y={laneY(0) + 9} textAnchor="middle">{k.text.slice(-1)}</text>
          </g>
        ))}
        {st.timers.map((t, i) => {
          const stop = t.end ?? Math.max(t.start, st.time);
          return (
            <g key={`t${i}`} className={`deb-timer is-${t.status}`}>
              {t.status === 'pending' && <rect className="deb-due" x={x(t.start)} y={laneY(1) + 13} width={Math.max(2, x(t.due) - x(t.start))} height={14} rx={4} />}
              <rect x={x(t.start)} y={laneY(1) + 13} width={Math.max(2, x(stop) - x(t.start))} height={14} rx={4} />
              {t.status === 'cancelled' && <text className="deb-x" x={x(stop) + 1} y={laneY(1) + 10} textAnchor="middle">×</text>}
            </g>
          );
        })}
        {st.searches.map((s, i) => (
          <g key={`s${i}`} className="deb-search">
            <circle cx={x(s.t)} cy={laneY(2) + 20} r={7} />
            <text x={x(s.t)} y={laneY(2) + 8} textAnchor="middle">{s.text}</text>
          </g>
        ))}
        {st.naive.map((s, i) => (
          <circle key={`n${i}`} className="deb-naive" cx={x(s.t)} cy={laneY(3) + 20} r={5.5} />
        ))}
        <line className="deb-now" x1={x(st.time)} x2={x(st.time)} y1={top} y2={height - 24} />
      </svg>
    </div>
  );
}
