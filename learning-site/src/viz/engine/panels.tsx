import { useEffect, useId, useRef } from 'react';
import { highlightCSharp } from './csharp-highlight';
import type { Counters, Prediction } from './types';
import { SPEEDS, type PlayerApi } from './usePlayer';

const Icon = {
  reset: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
  ),
  back: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>,
  fwd: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>,
  play: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>,
  pause: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>,
};

export function Controls({ p, label }: { p: PlayerApi; label: string }) {
  const speedId = useId();
  return (
    <div className="viz-ctl" role="group" aria-label={`${label} playback`}>
      <button type="button" className="ctl" onClick={p.reset} aria-label="Reset to the first step" title="Reset">{Icon.reset}</button>
      <button type="button" className="ctl" onClick={() => p.step(-1)} disabled={p.index === 0} aria-label="Step back" title="Step back (←)">{Icon.back}</button>
      <button type="button" className="ctl ctl-play" onClick={p.toggle} aria-label={p.playing ? 'Pause' : 'Play'} title="Play / pause (Space)">{p.playing ? Icon.pause : Icon.play}</button>
      <button type="button" className="ctl" onClick={() => p.step(1)} disabled={p.atEnd} aria-label="Step forward" title="Step forward (→)">{Icon.fwd}</button>
      <input
        className="scrub"
        type="range"
        min={0}
        max={Math.max(0, p.length - 1)}
        value={p.index}
        onChange={(e) => p.seek(Number(e.target.value))}
        aria-label="Timeline"
        aria-valuetext={`Step ${p.index + 1} of ${p.length}`}
      />
      <span className="stepno">Step {p.index + 1} / {p.length}</span>
      <label className="sr-only" htmlFor={speedId}>Speed</label>
      <select id={speedId} value={p.speed} onChange={(e) => p.setSpeed(Number(e.target.value))} title="Speed">
        {SPEEDS.map((s) => (
          <option key={s} value={s}>{s}×</option>
        ))}
      </select>
    </div>
  );
}

export function CodePanel({ code, line, title = 'C# from the notes' }: { code: string; line: number; title?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const lines = code.split('\n');
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-line="${line}"]`);
    const b = box.current;
    if (!el || !b) return;
    const top = el.offsetTop;
    if (top < b.scrollTop + 32 || top + el.offsetHeight > b.scrollTop + b.clientHeight) b.scrollTop = Math.max(0, top - b.clientHeight / 2);
  }, [line]);
  return (
    <div className="viz-code" ref={box} tabIndex={0} aria-label={`${title}, line ${line} is running`}>
      <div className="viz-code-head"><span>{title}</span><span className="mono">line {line}</span></div>
      <ol>
        {lines.map((l, i) => (
          <li key={i} data-line={i + 1} className={i + 1 === line ? 'is-current' : undefined} aria-current={i + 1 === line ? 'step' : undefined}>
            {l ? highlightCSharp(l) : ' '}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Narration({ text, prediction, p }: { text: string; prediction: Prediction | undefined; p: PlayerApi }) {
  const answer = p.answers.get(p.index);
  const showQuestion = p.predict && prediction;
  return (
    <div className="viz-narr-wrap">
      {showQuestion && (
        <div className="predict" role="group" aria-label="Prediction">
          <p className="q"><span className="eyebrow">Predict</span> {prediction.question}</p>
          <div className="opts">
            {prediction.options.map((o, i) => (
              <button key={o} type="button" className={`btn${answer === i ? (i === prediction.answer ? ' is-right' : ' is-wrong') : ''}`} disabled={answer !== undefined} onClick={() => p.answer(i)}>
                {o}
              </button>
            ))}
          </div>
          {answer !== undefined && <p className={`fb ${answer === prediction.answer ? 'good' : 'bad'}`}>{answer === prediction.answer ? 'Correct.' : 'Not quite. Here is what happens:'}</p>}
        </div>
      )}
      <p className="narr" aria-live="polite">{p.awaitingPrediction ? 'Make a prediction to reveal what happens next.' : text}</p>
    </div>
  );
}

export function Variables({ vars }: { vars: Record<string, string | number | boolean> }) {
  const entries = Object.entries(vars);
  if (!entries.length) return null;
  return (
    <dl className="vars" aria-label="Variables">
      {entries.map(([k, v]) => (
        <div key={k} className={k === 'stack' ? 'wide' : undefined}>
          <dt>{k}</dt>
          <dd>{typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CountersPanel({ c }: { c: Counters }) {
  const items: [string, number][] = [
    ['Comparisons', c.comparisons],
    ['Swaps', c.swaps],
    ['Writes', c.writes],
    ['Array accesses', c.reads + c.writes],
  ];
  return (
    <div className="counters" aria-label="Counters">
      {items.map(([l, v]) => (
        <div key={l}><b>{v}</b><span>{l}</span></div>
      ))}
    </div>
  );
}

export function Legend({ extra }: { extra?: [string, string][] }) {
  const items: [string, string][] = [
    ['compare', 'Comparing'],
    ['swap', 'Swapping or writing'],
    ['active', 'Key, pivot or current minimum'],
    ['settled', 'In final position'],
    ['idle', 'Not placed yet'],
    ...(extra ?? []),
  ];
  return (
    <ul className="legend" aria-label="Colour legend">
      {items.map(([k, label]) => (
        <li key={k}><span className={`sw sw-${k}`} aria-hidden="true" />{label}</li>
      ))}
      <li><span className="sw sw-ptr" aria-hidden="true">i j</span>Index pointer</li>
    </ul>
  );
}
