import { MotionConfig } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Controls } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import type { SortAlgorithm } from './csharp';
import { formatValues, makePreset, parseValues, PRESETS, type PresetName } from './inputs';
import { Bars } from './stage';
import { toAlgorithm } from './SortVisualizer';
import { SORT_ALGORITHMS, SORT_ORDER } from './traces';

/** The note's object-sorting example is not a general algorithm, so it is not offered here. */
const CHOICES = SORT_ORDER.filter((a) => a !== 'countingByAge');
const INT_RANGE = { kind: 'int' as const, min: 1, max: 99, maxLength: 12 };
export const COMPARE_EVENT = 'ly:compare';

/** Both algorithms get the same integers 1–99; bucket sort (which needs [0, 1)) gets them divided by 100. */
const inputFor = (a: SortAlgorithm, values: number[]) => (SORT_ALGORITHMS[a].input.kind === 'unit-float' ? values.map((v) => v / 100) : values);

export default function SortCompare(props: { default?: string[]; placement?: string }) {
  const [a, setA] = useState<SortAlgorithm>(toAlgorithm(props.default?.[0] ?? 'quick'));
  const [b, setB] = useState<SortAlgorithm>(toAlgorithm(props.default?.[1] ?? 'merge'));
  const [values, setValues] = useState<number[]>(() => makePreset('random', 10, INT_RANGE));
  const [draft, setDraft] = useState(() => formatValues(values, 'int'));
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetName | null>('random');
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    const onCompare = (e: Event) => {
      const d = (e as CustomEvent<{ a: SortAlgorithm; b: SortAlgorithm }>).detail;
      setA(d.a);
      setB(d.b);
      root.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      root.current?.focus({ preventScroll: true });
    };
    window.addEventListener(COMPARE_EVENT, onCompare);
    return () => window.removeEventListener(COMPARE_EVENT, onCompare);
  }, []);

  const traceA = useMemo(() => SORT_ALGORITHMS[a].trace(inputFor(a, values)), [a, values]);
  const traceB = useMemo(() => SORT_ALGORITHMS[b].trace(inputFor(b, values)), [b, values]);
  const length = Math.max(traceA.length, traceB.length);
  const p = usePlayer(length, () => false, `${a}:${b}:${values.join(',')}`);

  const apply = (v: number[], pr: PresetName | null) => {
    setValues(v);
    setDraft(formatValues(v, 'int'));
    setPreset(pr);
    setError(null);
  };
  const commit = () => {
    const r = parseValues(draft, INT_RANGE);
    if (typeof r === 'string') setError(r);
    else apply(r, null);
  };

  const side = (alg: SortAlgorithm, trace: typeof traceA, setAlg: (x: SortAlgorithm) => void, which: string) => {
    const s = trace[Math.min(p.index, trace.length - 1)]!;
    const done = p.index >= trace.length - 1;
    const c = s.counters;
    const max = SORT_ALGORITHMS[alg].input.kind === 'unit-float' ? 1 : Math.max(1, ...values);
    return (
      <div className="race-side">
        <div className="race-head">
          <label className="sr-only" htmlFor={`${id}-${which}`}>Algorithm {which}</label>
          <select id={`${id}-${which}`} value={alg} onChange={(e) => setAlg(e.target.value as SortAlgorithm)}>
            {CHOICES.map((x) => (
              <option key={x} value={x}>{SORT_ALGORITHMS[x].label}</option>
            ))}
          </select>
          {done ? <span className="badge race-done">Finished in {trace.length} steps</span> : <span className="badge">Step {p.index + 1} of {trace.length}</span>}
        </div>
        <Bars state={s.state} highlights={s.highlights} max={max} ties={null} />
        <div className="counters race-counters" aria-live="off">
          <div><b>{c.comparisons}</b><span>Comparisons</span></div>
          <div><b>{c.swaps}</b><span>Swaps</span></div>
          <div><b>{c.writes}</b><span>Writes</span></div>
          <div><b>{c.reads + c.writes}</b><span>Array accesses</span></div>
        </div>
        <p className="narr small">{s.narration}</p>
      </div>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="viz viz-compare" ref={root} tabIndex={-1} onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard} role="region" aria-label="Compare two sorting algorithms" id="compare-mode">
        <div className="viz-top">
          <span className="eyebrow viz-eyebrow">Compare mode</span>
          <strong className="viz-title">Two algorithms, the same input</strong>
          <span className="viz-keys muted">Both advance one step per tick</span>
        </div>
        <div className="viz-input">
          <label htmlFor={`${id}-vals`}>Values</label>
          <input id={`${id}-vals`} type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} aria-invalid={Boolean(error)} />
          <div className="presets" role="group" aria-label="Presets">
            {PRESETS.map((pr) => (
              <button key={pr.id} type="button" className="chipbtn" aria-pressed={preset === pr.id} onClick={() => apply(makePreset(pr.id, values.length, INT_RANGE), pr.id)}>
                {pr.label}
              </button>
            ))}
          </div>
          {error && <p className="viz-err" role="alert">{error}</p>}
        </div>
        <div className="race">
          {side(a, traceA, setA, 'A')}
          {side(b, traceB, setB, 'B')}
        </div>
        <Controls p={p} label="Compare mode" />
      </div>
    </MotionConfig>
  );
}
