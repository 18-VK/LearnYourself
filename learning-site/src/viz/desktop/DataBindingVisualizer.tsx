import { useId, useMemo, useState } from 'react';
import { CodePanel, Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { bindingTrace, MODES, ROWS, type BindingMode } from './binding';
import { BINDING_VM, dedent } from './csharp';
import './desktop.css';

export interface DataBindingVisualizerProps {
  modes?: string[];
  /** show the "raise PropertyChanged" switch (the note's INotifyPropertyChanged pitfall) */
  showPropertyChanged?: boolean;
  placement?: string;
}

const ARROW: Record<BindingMode, string> = { TwoWay: '⇄', OneWay: '←', OneTime: '←' };
const CODE = dedent(BINDING_VM);

export default function DataBindingVisualizer(props: DataBindingVisualizerProps) {
  const modes = MODES.filter((m) => (props.modes?.length ? props.modes : MODES).includes(m));
  const [typed, setTyped] = useState('Riya');
  const [codeValue, setCodeValue] = useState('Aman Kumar');
  const [draft, setDraft] = useState({ typed: 'Riya', codeValue: 'Aman Kumar' });
  const [notify, setNotify] = useState(true);
  const trace = useMemo(() => bindingTrace({ typed, codeValue, notify, modes }), [typed, codeValue, notify, modes.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = usePlayer(trace.length, () => false, `${typed}|${codeValue}|${notify}|${modes.join()}`);
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const st = step.state;
  const id = useId();
  const commit = () => {
    const t = draft.typed.trim().slice(0, 24) || 'Riya';
    const c = draft.codeValue.trim().slice(0, 24) || 'Aman Kumar';
    setDraft({ typed: t, codeValue: c });
    setTyped(t);
    setCodeValue(c);
  };
  const flowOf = (m: BindingMode) => st.flows.find((f) => f.mode === m)?.to;

  return (
    <div className="viz desk" role="region" aria-label="Data binding visualizer" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Visualizer</span>
        <strong className="viz-title">Binding modes: source ⇄ target</strong>
        <span className="viz-keys muted">Space plays or pauses · ← → step</span>
      </div>
      <div className="viz-input">
        {modes.includes('TwoWay') && (
          <label htmlFor={`${id}-typed`}>
            You type
            <input id={`${id}-typed`} type="text" value={draft.typed} onChange={(e) => setDraft({ ...draft, typed: e.target.value })} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
          </label>
        )}
        <label htmlFor={`${id}-code`}>
          ViewModel sets Name to
          <input id={`${id}-code`} type="text" value={draft.codeValue} onChange={(e) => setDraft({ ...draft, codeValue: e.target.value })} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
        </label>
        {props.showPropertyChanged !== false && (
          <label className="toggle">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Raise PropertyChanged (INotifyPropertyChanged)
          </label>
        )}
      </div>

      <div className="viz-stage db-stage">
        <div className="db-grid" role="table" aria-label="Bindings">
          <div className="db-row db-headrow" role="row">
            <span role="columnheader">Target (View, XAML)</span>
            <span role="columnheader">Mode</span>
            <span role="columnheader">Source (MainViewModel)</span>
          </div>
          {modes.map((m) => {
            const row = ROWS[m];
            const flow = flowOf(m);
            const heard = st.event?.heard.includes(m);
            const deaf = st.event && st.event.property === row.path && !heard;
            return (
              <div key={m} className={`db-row${flow ? ` is-flow-${flow}` : ''}${heard ? ' is-heard' : ''}${deaf ? ' is-deaf' : ''}`} role="row" data-mode={m}>
                <div className="db-cell db-target" role="cell">
                  <span className="db-ctl">{row.control}.{row.property}</span>
                  <span className={`db-value db-${row.control.toLowerCase()}`} data-testid={`target-${m}`}>{st.target[m] || '—'}</span>
                  <code className="db-xaml">{row.xaml}</code>
                </div>
                <div className="db-cell db-mode" role="cell">
                  <span className="db-arrow" aria-hidden="true">{ARROW[m]}</span>
                  <span className="db-modename">{m}</span>
                  {m === 'OneTime' && <span className="db-once">read once</span>}
                  {heard && <span className="db-ping">heard</span>}
                </div>
                <div className="db-cell db-source" role="cell">
                  <span className="db-ctl">{row.path}</span>
                  <span className="db-value">{st.source[row.path]}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className={`db-event${st.event ? ' is-on' : ''}`} aria-live="off">
          {st.event ? (
            <>
              <code>PropertyChanged("{st.event.property}")</code>{' '}
              {st.event.heard.length ? `→ ${st.event.heard.map((m) => `${ROWS[m].control} (${m})`).join(', ')} updates` : notify ? '→ no other binding listens' : '→ not raised: nobody hears it'}
            </>
          ) : (
            <span className="muted">No PropertyChanged in this step</span>
          )}
        </p>
      </div>

      <Controls p={p} label="Data binding" />
      <div className="viz-panels">
        <CodePanel code={CODE} line={step.codeLine} title="MainViewModel (C# from the notes)" />
        <div className="viz-side">
          <Narration text={step.narration} prediction={undefined} p={p} />
          <Variables vars={{ Name: st.source.Name, Status: st.source.Status }} />
          <ul className="legend" aria-label="Colour legend">
            <li><span className="sw sw-active" aria-hidden="true" />Value being copied</li>
            <li><span className="sw sw-compare" aria-hidden="true" />PropertyChanged heard</li>
            <li><span className="sw sw-idle" aria-hidden="true" />Not listening</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
