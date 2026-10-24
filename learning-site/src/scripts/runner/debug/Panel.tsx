/**
 * The debugger's panel under a code block: controls, status, the array visualization, Variables, Call Stack, Console
 * and the harness. It replays a precomputed trace with the visualizer engine's player (usePlayer), so Step Back,
 * the timeline and autoplay are the same as in every visualizer, and nothing is re-run while stepping.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CodePanel } from '../../../viz/engine/panels';
import { SPEEDS, usePlayer } from '../../../viz/engine/usePlayer';
import type { CodeView } from './code-view';
import { KIND, type Step, type Trace, type Variable } from './trace';
import { arrayViews, refId, show, type ArrayView } from './values';

export interface PanelProps {
  trace: Trace;
  output: string;
  harness: string | null;
  name: string;
  /** The code view in use (it changes when the learner opens the editor); `viewKey` changes with it. */
  view: CodeView | null;
  viewKey: number;
  /** Bumped when breakpoints change, so the panel re-reads them. */
  bpKey: number;
  /** The code was edited after this trace was recorded. */
  stale: boolean;
  /** How the program ended: 'completed' | 'exception' | 'output-limit' | 'trace-limit' | 'timeout'. */
  outcome: string;
  /** Where key presses for the debugger come from: the panel itself and the code block. */
  keyTargets: HTMLElement[];
  onStop(): void;
  onDebugAgain(): void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

function frameLabel(trace: Trace, s: Step): string {
  return trace.method(s.frame).name;
}

/** One line for the status bar (also read out by screen readers). */
function describe(trace: Trace, s: Step, harness: boolean): string {
  const where = s.file === 1 ? `harness line ${s.line}` : `line ${s.line}`;
  const fn = frameLabel(trace, s);
  switch (s.kind) {
    case KIND.call: {
      const args = trace.variablesOfStep(s.index).filter((v) => v.name !== 'this');
      return `Called ${fn}(${args.map((v) => `${v.name} = ${show(v.value)}`).join(', ')}).`;
    }
    case KIND.return: {
      const v = trace.value(s.value);
      return v ? `${fn} returns ${show(v)} (${where}).` : `${fn} returns (${where}).`;
    }
    case KIND.exception: {
      const v = trace.value(s.value);
      return `Exception at ${where} in ${fn}: ${v ? show(v) : 'an exception'}.`;
    }
    case KIND.end:
      return 'The program finished.';
    default:
      return `About to run ${where} in ${fn}${harness && s.file === 1 ? ' (added code)' : ''}.`;
  }
}

function endNote(trace: Trace, outcome: string): string | null {
  const stop = trace.stop;
  if (stop === 'steps') return `Recording stopped after ${fmt(trace.json.maxSteps)} steps, the limit, so the program was stopped there (an endless loop?). These are its first steps.`;
  if (stop === 'depth') return 'Recording stopped: the call stack got deeper than 1,000 calls (endless recursion?), so the program was stopped there.';
  if (stop === 'size') return 'Recording stopped: the recorded values got too large, so the program was stopped there.';
  if (outcome === 'timeout') return 'The program was stopped after 5 seconds; the steps recorded until then are shown.';
  if (outcome === 'output-limit') return 'The program printed more than 64 KB and was stopped there.';
  return null;
}

function Cells({ a }: { a: ArrayView }) {
  const before = a.pointers.filter((p) => p.index < 0);
  const after = a.pointers.filter((p) => p.index >= a.cells.length);
  const at = (i: number) => a.pointers.filter((p) => p.index === i).map((p) => p.name);
  const cell = (key: string, value: string, index: string, names: string[], extra = '') => (
    <div key={key} className={`dbg-cell${extra}`} role="listitem" aria-label={`${a.name}[${index}] = ${value}${names.length ? `, ${names.join(' and ')} point here` : ''}`}>
      <span className="dbg-cell-v">{value}</span>
      <span className="dbg-cell-i" aria-hidden="true">{index}</span>
      <span className="dbg-cell-p" aria-hidden="true">{names.join(' ')}</span>
    </div>
  );
  return (
    <div className="dbg-cells" role="list" aria-label={`${a.name}, ${a.type} of length ${a.length}`}>
      {before.length > 0 && cell('before', '', '-1', before.map((p) => p.name), ' is-ghost')}
      {a.cells.map((c, i) => cell(String(i), c, String(i), at(i), a.changed.has(i) ? ' is-changed' : ''))}
      {a.length > a.cells.length && <div className="dbg-cell is-ghost" role="listitem" aria-label={`${a.length - a.cells.length} more`}><span className="dbg-cell-v">…</span></div>}
      {after.length > 0 && cell('after', '', String(a.length), after.map((p) => p.name), ' is-ghost')}
    </div>
  );
}

function VariablesTable({ vars, changed, stepKey, returnValue, frameName }: { vars: Variable[]; changed: Set<string>; stepKey: number; returnValue: string | null; frameName: string }) {
  const ids = new Map<number, string[]>();
  for (const v of vars) {
    const id = refId(v.value);
    if (id) ids.set(id, [...(ids.get(id) ?? []), v.name]);
  }
  return (
    <table className="dbg-vars">
      <caption>Variables <span className="dbg-sub">in {frameName}</span></caption>
      <tbody>
        {vars.length === 0 && !returnValue && (
          <tr><td className="dbg-empty" colSpan={2}>No variables yet.</td></tr>
        )}
        {vars.map((v) => {
          const id = refId(v.value);
          const shared = id && (ids.get(id)?.length ?? 0) > 1;
          const isChanged = changed.has(v.name);
          return (
            <tr key={`${v.name}:${isChanged ? stepKey : 'same'}`} className={isChanged ? 'is-changed' : undefined}>
              <th scope="row">
                <span className="dbg-name">{v.name}</span>
                <span className="dbg-type">{v.type}</span>
              </th>
              <td>
                <span className="dbg-value">{show(v.value)}</span>
                {shared && <span className="dbg-ref" title={`Same object as ${ids.get(id!)!.filter((n) => n !== v.name).join(', ')}`}>#{id}</span>}
                {isChanged && <span className="sr-only"> (changed)</span>}
              </td>
            </tr>
          );
        })}
        {returnValue !== null && (
          <tr className="is-return">
            <th scope="row"><span className="dbg-name">return value</span></th>
            <td><span className="dbg-value">{returnValue}</span></td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

const Btn = ({ label, keys, onClick, disabled, children, className }: { label: string; keys?: string; onClick: () => void; disabled?: boolean; children: ReactNode; className?: string }) => (
  <button type="button" className={`dbg-btn${className ? ` ${className}` : ''}`} onClick={onClick} disabled={disabled} aria-label={label} title={keys ? `${label} (${keys})` : label} aria-keyshortcuts={keys?.replace(/ /g, '')}>
    {children}
  </button>
);

export function DebuggerPanel(props: PanelProps) {
  const { trace, view, viewKey, bpKey, stale } = props;
  const p = usePlayer(trace.length, () => false, trace);
  const [selected, setSelected] = useState<number | null>(null);
  const step = trace.step(Math.min(p.index, trace.length - 1));
  const breakpoints = useMemo(() => view?.breakpoints() ?? new Set<number>(), [view, bpKey]);

  // start at the first breakpoint, if there is one
  const started = useRef<Trace | null>(null);
  useEffect(() => {
    if (started.current === trace) return;
    started.current = trace;
    const bps = view?.breakpoints() ?? new Set<number>();
    const first = trace.step(0);
    if (bps.size && !(first.file === 0 && bps.has(first.line))) p.seek(trace.continueTo(0, bps));
  });

  // the current line, in the code block (the learner's code) or the harness panel
  useEffect(() => {
    if (!view) return;
    if (stale || step.file !== 0 || step.kind === KIND.end || step.line <= 0) view.setCurrent(null);
    else view.setCurrent(step.line, step.kind === KIND.exception ? 'exception' : step.kind === KIND.call ? 'call' : step.kind === KIND.return ? 'return' : 'line');
  }, [view, viewKey, step.index, stale]);

  useEffect(() => setSelected(null), [p.index]);

  const go = (to: number) => {
    p.claimKeyboard();
    p.seek(to);
  };
  const atEnd = p.index >= trace.length - 1;
  const actions = {
    continue: () => go(trace.continueTo(p.index, breakpoints)),
    over: () => go(trace.stepOver(p.index)),
    into: () => go(trace.stepInto(p.index)),
    out: () => go(trace.stepOut(p.index)),
    back: () => go(trace.stepBack(p.index)),
    restart: () => go(0),
    stop: () => props.onStop(),
  };
  const latest = useRef(actions);
  latest.current = actions;

  // F5 continue, F10 step over, F11 step into, Shift+F11 step out, Shift+F5 stop (← → and Space come from usePlayer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || stale) return;
      const a = latest.current;
      const run = e.key === 'F5' && !e.shiftKey ? a.continue : e.key === 'F10' && !e.shiftKey ? a.over : e.key === 'F11' ? (e.shiftKey ? a.out : a.into) : e.key === 'F5' && e.shiftKey ? a.stop : null;
      if (!run) return;
      e.preventDefault();
      run();
    };
    for (const t of props.keyTargets) t.addEventListener('keydown', onKey);
    return () => {
      for (const t of props.keyTargets) t.removeEventListener('keydown', onKey);
    };
  }, [props.keyTargets, stale]);

  const stack = trace.stack(step.index);
  const frame = selected ?? step.frame;
  const vars = selected === null ? trace.variablesOfStep(step.index) : trace.variables(step.index, frame);
  const changed = selected === null ? trace.changed(step.index) : new Set<string>();
  const ret = step.kind === KIND.return && selected === null ? trace.value(step.value) : null;
  const prevIndex = (() => {
    for (let j = step.index - 1; j >= 0; j--) if (trace.step(j).frame === frame) return j;
    return -1;
  })();
  const arrays = arrayViews(vars, trace.variablesOfStep(prevIndex), trace.method(frame));
  const note = atEnd ? endNote(trace, props.outcome) : null;
  const exception = step.kind === KIND.exception ? trace.value(step.value) : null;
  const status = describe(trace, step, Boolean(props.harness));
  const shown = props.output.slice(0, step.out);

  return (
    <div className="dbg-body" onPointerDown={() => p.claimKeyboard()} onFocus={() => p.claimKeyboard()}>
      <div className="dbg-toolbar" role="toolbar" aria-label={`Debugger controls for ${props.name}`}>
        <Btn label="Continue to the next breakpoint" keys="F5" onClick={actions.continue} disabled={atEnd || stale} className="dbg-primary">Continue</Btn>
        <Btn label="Step over" keys="F10" onClick={actions.over} disabled={atEnd || stale}>Step over</Btn>
        <Btn label="Step into" keys="F11" onClick={actions.into} disabled={atEnd || stale}>Step into</Btn>
        <Btn label="Step out" keys="Shift+F11" onClick={actions.out} disabled={atEnd || stale}>Step out</Btn>
        <Btn label="Step back" keys="ArrowLeft" onClick={actions.back} disabled={p.index === 0 || stale}>Step back</Btn>
        <Btn label="Restart from the first step" onClick={actions.restart} disabled={p.index === 0 || stale}>Restart</Btn>
        <Btn label="Stop debugging" keys="Shift+F5" onClick={props.onStop} className="dbg-stop">Stop</Btn>
      </div>
      <div className="dbg-timeline">
        <button type="button" className="dbg-btn dbg-play" onClick={() => (p.claimKeyboard(), p.toggle())} disabled={stale} aria-label={p.playing ? 'Pause' : 'Play the steps'} title="Play / pause (Space)">
          {p.playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          className="dbg-scrub"
          min={0}
          max={Math.max(0, trace.length - 1)}
          value={p.index}
          disabled={stale}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Timeline"
          aria-valuetext={`Step ${p.index + 1} of ${trace.length}`}
        />
        <span className="dbg-stepno">Step {fmt(p.index + 1)} / {fmt(trace.length)}</span>
        <label className="sr-only" htmlFor={`dbg-speed-${props.name.replace(/\W/g, '')}`}>Speed</label>
        <select id={`dbg-speed-${props.name.replace(/\W/g, '')}`} className="dbg-speed" value={p.speed} onChange={(e) => p.setSpeed(Number(e.target.value))} title="Speed">
          {SPEEDS.map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
      </div>
      {stale ? (
        <p className="dbg-stale" role="status">
          The code changed since this trace was recorded.{' '}
          <button type="button" className="dbg-btn dbg-primary" onClick={props.onDebugAgain}>Debug the new code</button>
        </p>
      ) : (
        <p className="dbg-status" role="status" aria-live="polite" data-kind={step.kind === KIND.exception ? 'error' : step.kind === KIND.end ? 'ok' : 'info'}>
          {status}
        </p>
      )}
      {note && <p className="dbg-note">{note}</p>}
      {exception && (
        <div className="dbg-exception">
          <strong>{exception.k === 'exc' ? exception.t : 'Exception'}</strong>
          {exception.k === 'exc' && exception.m ? `: ${exception.m}` : ''}
          <span className="dbg-sub"> ({step.file === 1 ? 'harness ' : ''}line {step.line}{atEnd && props.outcome === 'exception' ? ', not caught: the program stops here' : ''})</span>
        </div>
      )}
      {arrays.length > 0 && (
        <section className="dbg-viz" aria-label="Arrays and lists">
          {arrays.map((a) => (
            <figure key={a.name} className="dbg-arr">
              <figcaption><span className="dbg-name">{a.name}</span> <span className="dbg-type">{a.type}</span></figcaption>
              <Cells a={a} />
            </figure>
          ))}
        </section>
      )}
      <div className="dbg-grid">
        <VariablesTable vars={vars} changed={changed} stepKey={step.index} returnValue={ret ? show(ret) : null} frameName={trace.method(frame).name} />
        <section className="dbg-stack" aria-label="Call stack">
          <h4 className="dbg-h">Call stack</h4>
          <ol>
            {stack.map((f, i) => (
              <li key={f.frame}>
                <button type="button" className="dbg-frame" aria-current={f.frame === frame ? 'true' : undefined} onClick={() => setSelected(i === 0 ? null : f.frame)}>
                  <span className="dbg-name">{f.name}</span>
                  <span className="dbg-sub">{f.line > 0 ? `${f.file === 1 ? 'harness ' : ''}line ${f.line}` : ''}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section className="dbg-console-box" aria-label="Console output up to this step">
        <h4 className="dbg-h">Console</h4>
        <pre className="dbg-console" tabIndex={0}>{shown || '(nothing printed yet)'}</pre>
      </section>
      {props.harness && (
        <div className="dbg-harness">
          <CodePanel code={props.harness} line={step.file === 1 && !stale ? step.line : 0} title="Harness: added code, not from the note" />
        </div>
      )}
    </div>
  );
}
