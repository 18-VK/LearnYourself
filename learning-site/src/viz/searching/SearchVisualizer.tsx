import { useId, useMemo, useState } from 'react';
import { HashTableView } from '../dsa/hash/HashTableView';
import { CodePanel, Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { formatValues, makeValues, parseValues, pickMissing, pickPresent, PRESETS } from './inputs';
import type { SearchState } from './recorder';
import { AnswerGrid, CallStack, FunctionPlot, pointerRows, SearchBars } from './stage';
import { SEARCH_ALGORITHMS, SEARCH_ORDER, toSearchAlgorithm, type SearchAlgorithm } from './traces';
import './searching.css';

export interface SearchVisualizerProps {
  algorithm?: string;
  /** `[iterative, recursive]` lets the learner switch binary search between the note's two versions. */
  variants?: string[];
  predictMode?: boolean;
  /** Starting values (sorted first when the algorithm needs it). */
  preset?: number[];
  target?: number;
  /** `function-plot` draws ternary search's array as a unimodal function (the default for ternary). */
  view?: string;
  /** Hash search: mark buckets whose chain has more than one entry and count collisions. */
  showCollisions?: boolean;
  /** Let the learner pick any algorithm (playground and demos; lesson placements are fixed). */
  switchable?: boolean;
  note?: string;
  placement?: string;
}

const COUNTER_LABELS: Record<SearchAlgorithm, [probes: string | null, comparisons: string, reads: string | null]> = {
  linear: [null, 'Comparisons', 'Array reads'],
  binary: ['Probes (mid)', 'Comparisons', 'Array reads'],
  binaryRec: ['Probes (mid)', 'Comparisons', 'Array reads'],
  bounds: ['Probes (mid)', 'Comparisons', 'Array reads'],
  sqrt: [null, 'mid × mid ≤ x checks', null],
  jump: ['Probes', 'Comparisons', 'Array reads'],
  interpolation: ['Probes (pos)', 'Comparisons', 'Array reads'],
  exponential: ['Probes', 'Comparisons', 'Array reads'],
  ternary: ['Midpoints (m1, m2)', 'Comparisons', 'Array reads'],
  hash: ['Bucket lookups', 'Key comparisons', 'Array reads'],
};

function SearchCounters({ alg, state, c }: { alg: SearchAlgorithm; state: SearchState; c: { comparisons: number; reads: number } }) {
  const [probes, comparisons, reads] = COUNTER_LABELS[alg];
  const items: [string, number][] = [];
  if (probes) items.push([probes, state.probes]);
  items.push([comparisons, c.comparisons]);
  if (reads) items.push([reads, c.reads]);
  return (
    <div className="counters sv-counters" aria-label="Counters" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(([l, v]) => (
        <div key={l}>
          <b>{v}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

function SearchLegend({ alg }: { alg: SearchAlgorithm }) {
  const hash = alg === 'hash';
  const items: [string, string][] = hash
    ? [
        ['active', 'Element being added or read'],
        ['compare', 'Compared with the key'],
        ['swap', 'Just written'],
        ['settled', 'Found'],
        ['bucket', 'Bucket being looked at'],
      ]
    : [
        ['compare', alg === 'ternary' ? 'Being compared' : alg === 'sqrt' ? 'Being checked' : 'Compared with the target'],
        ['active', alg === 'ternary' ? 'Midpoint or best so far' : 'Probe position'],
        ['settled', alg === 'ternary' ? 'The peak' : 'Found'],
        ['out', 'Ruled out'],
      ];
  return (
    <ul className="legend" aria-label="Colour legend">
      {items.map(([k, label]) => (
        <li key={k}>
          <span className={`sw sw-${k}`} aria-hidden="true" />
          {label}
        </li>
      ))}
      {!hash && (
        <li>
          <span className="sw sw-ptr" aria-hidden="true">▲</span>Index pointer
        </li>
      )}
    </ul>
  );
}

export default function SearchVisualizer(props: SearchVisualizerProps) {
  const id = useId();
  const variants = props.variants ?? [];
  const [alg, setAlg] = useState<SearchAlgorithm>(() => toSearchAlgorithm(props.algorithm, variants[0]));
  const info = SEARCH_ALGORITHMS[alg];

  const initial = useMemo(() => {
    if (Array.isArray(props.preset) && props.preset.length) {
      const r = parseValues(formatValues(props.preset), info);
      if (typeof r !== 'string') return { values: r.values, target: props.target ?? info.defaults.target, notice: r.notice ?? null };
    }
    return { values: info.defaults.values, target: props.target ?? info.defaults.target, notice: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [values, setValues] = useState<number[]>(initial.values);
  const [target, setTarget] = useState<number>(info.input === 'number' ? initial.values[0]! : initial.target);
  const [draft, setDraft] = useState(() => formatValues(initial.values));
  const [targetDraft, setTargetDraft] = useState(String(initial.target));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const isNumber = info.input === 'number';
  const result = useMemo(() => {
    try {
      return { trace: info.trace(values, isNumber ? values[0]! : target), error: null };
    } catch (e) {
      return { trace: null, error: (e as Error).message };
    }
  }, [info, values, target, isNumber]);
  const trace = result.trace ?? [];
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${alg}:${values.join(',')}:${target}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)];
  const rows = useMemo(() => pointerRows(trace), [trace]);
  const hasPredict = trace.some((s) => s.predict);
  const max = Math.max(1, ...values);

  const apply = (next: number[], preset: string | null, nextTarget?: number, note: string | null = null) => {
    setValues(next);
    setDraft(formatValues(next));
    setActivePreset(preset);
    setError(null);
    setNotice(note);
    if (isNumber) setTarget(next[0]!);
    else if (nextTarget !== undefined) {
      setTarget(nextTarget);
      setTargetDraft(String(nextTarget));
    }
  };
  const commitValues = () => {
    const r = parseValues(draft, info);
    if (typeof r === 'string') setError(r);
    else apply(r.values, null, undefined, r.notice ?? null);
  };
  const commitTarget = () => {
    const t = Number(targetDraft);
    if (targetDraft.trim() === '' || !Number.isInteger(t) || t < -999 || t > 999) {
      setError('The target must be a whole number.');
      return;
    }
    setError(null);
    setTarget(t);
  };
  const regenerate = (preset: string, n: number) => {
    const next = makeValues(info, preset, n);
    const keepTarget = !info.needsTarget ? undefined : preset === 'skewed' && next.length > 3 ? next[next.length - 4] : !next.includes(target) && values.includes(target) ? pickPresent(next) : undefined;
    apply(next, preset, keepTarget);
  };
  const switchAlg = (next: SearchAlgorithm) => {
    const ni = SEARCH_ALGORITHMS[next];
    setAlg(next);
    const r = parseValues(draft, ni);
    if (typeof r === 'string' || ni.input === 'number' || info.input === 'number') {
      setValues(ni.defaults.values);
      setDraft(formatValues(ni.defaults.values));
      setTarget(ni.input === 'number' ? ni.defaults.values[0]! : ni.defaults.target);
      setTargetDraft(String(ni.defaults.target));
      setNotice(null);
    } else {
      setValues(r.values);
      setDraft(formatValues(r.values));
      setNotice(r.notice ?? null);
    }
    setError(null);
  };

  const showVariants = variants.includes('iterative') && variants.includes('recursive') && (alg === 'binary' || alg === 'binaryRec');
  const isHash = alg === 'hash';
  const plot = alg === 'ternary' && props.view !== 'bars';
  const st = step?.state;
  const done = p.atEnd && st?.result !== undefined;
  const space = alg === 'binaryRec' ? 'O(log n) recursive' : info.complexity.space;

  return (
    <div className="viz sv" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard} role="region" aria-label={`${info.label} visualizer`}>
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Visualizer</span>
        {props.switchable ? (
          <>
            <label className="sr-only" htmlFor={`${id}-alg`}>Algorithm</label>
            <select id={`${id}-alg`} value={alg} onChange={(e) => switchAlg(e.target.value as SearchAlgorithm)}>
              {SEARCH_ORDER.map((a) => (
                <option key={a} value={a}>{SEARCH_ALGORITHMS[a].label}</option>
              ))}
            </select>
          </>
        ) : (
          <strong className="viz-title">{info.label}</strong>
        )}
        {showVariants && (
          <div className="presets" role="group" aria-label="Version">
            {(['binary', 'binaryRec'] as const).map((a) => (
              <button key={a} type="button" className="chipbtn" aria-pressed={alg === a} onClick={() => switchAlg(a)}>
                {a === 'binary' ? 'Iterative' : 'Recursive'}
              </button>
            ))}
          </div>
        )}
        <span className="viz-keys muted">Space plays or pauses · ← → step</span>
      </div>

      <div className="viz-input">
        {isNumber ? (
          <label htmlFor={`${id}-x`}>
            x <span className="mono">{values[0]}</span>
          </label>
        ) : (
          <label htmlFor={`${id}-vals`}>{info.input === 'sorted' ? 'Sorted values' : 'Values'}</label>
        )}
        {isNumber ? (
          <input id={`${id}-x`} type="range" min={info.min} max={info.max} value={values[0]} onChange={(e) => apply([Number(e.target.value)], null)} />
        ) : (
          <>
            <input
              id={`${id}-vals`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitValues}
              onKeyDown={(e) => e.key === 'Enter' && commitValues()}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-err` : undefined}
            />
            <label htmlFor={`${id}-size`}>
              Size <span className="mono">{values.length}</span>
            </label>
            <input id={`${id}-size`} type="range" min={info.minLength} max={info.maxLength} value={values.length} onChange={(e) => regenerate(activePreset ?? PRESETS[info.input][0]!.id, Number(e.target.value))} />
          </>
        )}
        <div className="presets" role="group" aria-label="Presets">
          {PRESETS[info.input].map((pr) => (
            <button key={pr.id} type="button" className="chipbtn" aria-pressed={activePreset === pr.id} onClick={() => regenerate(pr.id, isNumber ? 1 : Math.max(info.minLength, values.length))}>
              {pr.label}
            </button>
          ))}
        </div>
        {info.needsTarget && (
          <div className="sv-target">
            <label htmlFor={`${id}-t`}>Target</label>
            <input
              id={`${id}-t`}
              type="number"
              inputMode="numeric"
              value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value)}
              onBlur={commitTarget}
              onKeyDown={(e) => e.key === 'Enter' && commitTarget()}
            />
            <button type="button" className="chipbtn" onClick={() => apply(values, activePreset, pickPresent(values))}>
              In the array
            </button>
            <button type="button" className="chipbtn" onClick={() => apply(values, activePreset, pickMissing(values, info))}>
              Not in the array
            </button>
          </div>
        )}
        {hasPredict && (
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
        )}
        {error && <p className="viz-err" id={`${id}-err`} role="alert">{error}</p>}
      </div>

      <p className="sv-facts">
        <span className="muted">From the notes' summary table:</span> average <b>{info.complexity.average}</b> · worst <b>{info.complexity.worst}</b> · space <b>{space}</b> · needs sorted input: <b>{info.complexity.sorted}</b>
      </p>
      {props.note && <p className="viz-hint">{props.note}</p>}
      {notice && <p className="viz-hint sv-notice" role="status">{notice}</p>}
      {result.error && <p className="viz-err" role="alert">{result.error}</p>}

      {step && st && (
        <>
          <div className="viz-stage">
            {alg === 'sqrt' ? (
              <AnswerGrid state={st} highlights={step.highlights} />
            ) : plot ? (
              <FunctionPlot state={st} highlights={step.highlights} rows={rows} />
            ) : (
              <SearchBars state={st} highlights={isHash ? { active: step.highlights.active ?? [], pointers: step.highlights.pointers ?? {} } : step.highlights} rows={isHash ? 1 : rows} max={max} />
            )}
            {isHash && st.hash && (
              <div className={`sv-hash${props.showCollisions === false ? '' : ' show-collisions'}`}>
                <HashTableView table={st.hash.focus === 'seen' ? st.hash.seen : st.hash.index} name={st.hash.focus} typeName={st.hash.focus === 'seen' ? 'HashSet<int>' : 'Dictionary<int, int>'} hl={st.hash.hl} />
                {st.hash.focus === 'index' && st.hash.seen && <p className="muted sv-other">seen (HashSet&lt;int&gt;) still holds its {st.hash.seen.count - st.hash.seen.freeCount} values; the dictionary is a separate table.</p>}
                <p className="viz-hint sv-simplified">
                  Simplified view of .NET's layout: a prime number of buckets, bucket = hash code % bucket count (an int's hash code is the int itself), and new entries go to the front of their bucket's chain. The real
                  HashSet&lt;T&gt; and Dictionary keep all entries in one array linked by index.
                </p>
              </div>
            )}
            {st.calls && <CallStack calls={st.calls} />}
          </div>
          {done && (
            <p className="viz-verdict" role="status">
              {isHash ? st.result : alg === 'bounds' ? st.result : `Returns ${st.result}`}
            </p>
          )}
          <Controls p={p} label={info.label} />
          <div className="viz-panels">
            <CodePanel code={info.code} line={step.codeLine} />
            <div className="viz-side">
              <Narration text={step.narration} prediction={step.predict} p={p} />
              <Variables vars={step.variables} />
              <SearchCounters alg={alg} state={st} c={step.counters} />
              <SearchLegend alg={alg} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
