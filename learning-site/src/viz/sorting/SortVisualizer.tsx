import { MotionConfig } from 'motion/react';
import { useId, useMemo, useState } from 'react';
import { CodePanel, Controls, CountersPanel, Legend, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import type { SortAlgorithm } from './csharp';
import { formatValues, makePreset, parseValues, PRESETS, type PresetName } from './inputs';
import { AuxRows, Bars, HeapTree, tieLetters } from './stage';
import { SORT_ALGORITHMS, SORT_ORDER } from './traces';

/** Manifest names (kebab-case) → registry ids. */
const ALIASES: Record<string, SortAlgorithm> = {
  'counting-stable': 'countingStable',
  'counting-simple': 'countingSimple',
  'counting-by-age': 'countingByAge',
};
export const toAlgorithm = (name: string | undefined): SortAlgorithm => {
  const id = (name && (ALIASES[name] ?? name)) as SortAlgorithm;
  return id && id in SORT_ALGORITHMS ? id : 'bubble';
};

export interface SortVisualizerProps {
  algorithm?: string;
  preset?: number[] | PresetName;
  views?: string[];
  note?: string;
  /** Names for the original elements (shown under the bars), e.g. the notes' employees. */
  labels?: string[];
  /** Start with equal keys coloured (stability view). */
  showTies?: boolean;
  /** Let the learner switch algorithm (used by demos; lesson placements are fixed). */
  switchable?: boolean;
  /** Start in predict mode. */
  predictMode?: boolean;
  placement?: string;
}

export default function SortVisualizer(props: SortVisualizerProps) {
  const [algorithm, setAlgorithm] = useState<SortAlgorithm>(() => toAlgorithm(props.algorithm));
  const info = SORT_ALGORITHMS[algorithm];
  const initial = useMemo(() => {
    if (Array.isArray(props.preset)) return props.preset;
    if (typeof props.preset === 'string') return makePreset(props.preset, Math.min(8, info.input.maxLength), info.input);
    return info.input.defaultValues;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [input, setInput] = useState<number[]>(initial);
  const [draft, setDraft] = useState(() => formatValues(initial, info.input.kind));
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(typeof props.preset === 'string' ? props.preset : null);
  const [showTies, setShowTies] = useState(Boolean(props.showTies));
  const [view, setView] = useState<'array' | 'tree' | 'both'>(props.views?.includes('tree') ? 'both' : 'array');

  const result = useMemo(() => {
    try {
      return { trace: info.trace(input), error: null };
    } catch (e) {
      return { trace: null, error: (e as Error).message };
    }
  }, [info, input]);
  const trace = result.trace ?? [];
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${algorithm}:${input.join(',')}`, { predict: props.predictMode });

  const id = useId();
  const step = trace[Math.min(p.index, trace.length - 1)];
  const max = info.input.kind === 'unit-float' ? 1 : Math.max(1, ...input);
  const ties = showTies ? tieLetters(input) : null;
  const hasTies = tieLetters(input).some(Boolean);
  const isHeap = algorithm === 'heap';
  const labels = props.labels;

  const applyInput = (values: number[], preset: string | null) => {
    setInput(values);
    setDraft(formatValues(values, info.input.kind));
    setActivePreset(preset);
    setError(null);
  };
  const changeAlgorithm = (next: SortAlgorithm) => {
    setAlgorithm(next);
    const nextInfo = SORT_ALGORITHMS[next];
    const fits = parseValues(formatValues(input, nextInfo.input.kind), nextInfo.input);
    const values = Array.isArray(fits) ? fits : nextInfo.input.defaultValues;
    setInput(values);
    setDraft(formatValues(values, nextInfo.input.kind));
  };

  // stability verdict at the end of the run
  const final = trace[trace.length - 1]?.state;
  let stableVerdict: string | null = null;
  if (final && hasTies && p.atEnd) {
    const ok = final.values.every((v, k) => k === 0 || v !== final.values[k - 1] || (final.ids[k] ?? -1) > (final.ids[k - 1] ?? -1));
    const lostIdentity = final.ids.some((x) => x === null);
    stableVerdict = lostIdentity
      ? 'This version rebuilds values from counts, so it no longer knows which original element is which.'
      : ok
        ? 'Equal keys kept their original order on this input.'
        : 'Equal keys changed their original order on this input: this run was not stable.';
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="viz" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard} aria-label={`${info.label} visualizer`} role="region">
        <div className="viz-top">
          <span className="eyebrow viz-eyebrow">Visualizer</span>
          {props.switchable ? (
            <>
              <label className="sr-only" htmlFor={`${id}-alg`}>Algorithm</label>
              <select id={`${id}-alg`} value={algorithm} onChange={(e) => changeAlgorithm(e.target.value as SortAlgorithm)}>
                {SORT_ORDER.map((a) => (
                  <option key={a} value={a}>{SORT_ALGORITHMS[a].label}</option>
                ))}
              </select>
            </>
          ) : (
            <strong className="viz-title">{info.label}</strong>
          )}
          <span className="viz-keys muted">Space plays or pauses · ← → step</span>
        </div>

        <div className="viz-input">
          <label htmlFor={`${id}-vals`}>Values</label>
          <input
            id={`${id}-vals`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const r = parseValues(draft, info.input);
              if (typeof r === 'string') setError(r);
              else applyInput(r, null);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const r = parseValues(draft, info.input);
              if (typeof r === 'string') setError(r);
              else applyInput(r, null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          <label htmlFor={`${id}-size`}>
            Size <span className="mono">{input.length}</span>
          </label>
          <input
            id={`${id}-size`}
            type="range"
            min={2}
            max={info.input.maxLength}
            value={input.length}
            onChange={(e) => applyInput(makePreset((activePreset as PresetName) ?? 'random', Number(e.target.value), info.input), activePreset)}
          />
          <div className="presets" role="group" aria-label="Presets">
            {PRESETS.map((pr) => (
              <button key={pr.id} type="button" className="chipbtn" aria-pressed={activePreset === pr.id} onClick={() => applyInput(makePreset(pr.id, Math.max(4, Math.min(input.length, info.input.maxLength)), info.input), pr.id)}>
                {pr.label}
              </button>
            ))}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
          {hasTies && (
            <label className="toggle">
              <input type="checkbox" checked={showTies} onChange={(e) => setShowTies(e.target.checked)} /> Colour equal keys
            </label>
          )}
          {isHeap && (
            <div className="presets" role="group" aria-label="View">
              {(['array', 'tree', 'both'] as const).map((v) => (
                <button key={v} type="button" className="chipbtn" aria-pressed={view === v} onClick={() => setView(v)}>
                  {v === 'both' ? 'Array + tree' : v === 'array' ? 'Array' : 'Tree'}
                </button>
              ))}
            </div>
          )}
          {error && <p className="viz-err" id={`${id}-err`} role="alert">{error}</p>}
        </div>

        {props.note && <p className="viz-hint">{props.note}</p>}
        {result.error && <p className="viz-err" role="alert">{result.error}</p>}

        {step && (
          <>
            <div className="viz-stage">
              {(!isHeap || view !== 'tree') && <Bars state={step.state} highlights={step.highlights} max={max} ties={ties} labels={labels} />}
              {isHeap && view !== 'array' && <HeapTree state={step.state} highlights={step.highlights} />}
              {step.state.aux && step.state.aux.length > 0 && <AuxRows aux={step.state.aux} ties={ties} />}
            </div>
            {stableVerdict && <p className="viz-verdict" role="status">{stableVerdict}</p>}
            <Controls p={p} label={info.label} />
            <div className="viz-panels">
              <CodePanel code={info.code} line={step.codeLine} />
              <div className="viz-side">
                <Narration text={step.narration} prediction={step.predict} p={p} />
                <Variables vars={step.variables} />
                <CountersPanel c={step.counters} />
                <Legend />
              </div>
            </div>
          </>
        )}
      </div>
    </MotionConfig>
  );
}
