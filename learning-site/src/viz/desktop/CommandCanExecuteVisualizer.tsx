import { useMemo, useState } from 'react';
import { CodePanel, Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { CODE, commandTrace, type CommandVariant } from './command';
import { dedent } from './csharp';
import './desktop.css';

export interface CommandCanExecuteVisualizerProps {
  scenario?: string;
  /** start with this variant: manual | commandmanager | none */
  variant?: CommandVariant;
  placement?: string;
}

const VARIANTS: { id: CommandVariant; label: string }[] = [
  { id: 'manual', label: 'RaiseCanExecuteChanged (manual)' },
  { id: 'commandmanager', label: 'CommandManager.InvalidateRequerySuggested' },
  { id: 'none', label: 'No notification' },
];

export default function CommandCanExecuteVisualizer(props: CommandCanExecuteVisualizerProps) {
  const [variant, setVariant] = useState<CommandVariant>(props.variant ?? 'manual');
  const [select, setSelect] = useState(1);
  const trace = useMemo(() => commandTrace({ variant, select }), [variant, select]);
  const p = usePlayer(trace.length, () => false, `${variant}:${select}`);
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const st = step.state;
  const code = CODE[step.file];

  return (
    <div className="viz desk" role="region" aria-label="ICommand.CanExecute visualizer" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
      <div className="viz-top">
        <span className="eyebrow viz-eyebrow">Visualizer</span>
        <strong className="viz-title">ICommand.CanExecute: enabling the Delete button</strong>
        <span className="viz-keys muted">Space plays or pauses · ← → step</span>
      </div>
      <div className="viz-input">
        <div className="presets" role="group" aria-label="How the command is told to re-check">
          {VARIANTS.map((v) => (
            <button key={v.id} type="button" className="chipbtn" aria-pressed={variant === v.id} onClick={() => setVariant(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="presets" role="group" aria-label="Row to select">
          {[
            [1, 'Select Food 200'],
            [2, 'Select Salary 50000'],
          ].map(([id, label]) => (
            <button key={id} type="button" className="chipbtn" aria-pressed={select === id} onClick={() => setSelect(id as number)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="viz-stage cmd-stage">
        <div className="cmd-window" aria-label="Window">
          <table className="cmd-grid">
            <thead>
              <tr><th>Id</th><th>Category</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {st.rows.length === 0 && (
                <tr><td colSpan={3} className="muted">(no rows yet)</td></tr>
              )}
              {st.rows.map((r) => (
                <tr key={r.id} className={st.selected === r.id ? 'is-selected' : undefined} aria-selected={st.selected === r.id}>
                  <td>{r.id}</td><td>{r.category}</td><td>{r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cmd-buttonrow">
            <span className={`cmd-button${st.button === 'enabled' ? ' is-enabled' : ''}${st.clicked ? ' is-clicked' : ''}${st.stale ? ' is-stale' : ''}`} data-testid="delete-button" aria-disabled={st.button !== 'enabled'}>
              Delete
            </span>
            {st.asking && <span className="cmd-bubble">CanExecute?</span>}
            {st.stale && <span className="cmd-stale">button state is out of date</span>}
          </div>
        </div>
        <div className="cmd-signals" aria-label="Signals">
          <span className={`cmd-signal${st.event === 'CanExecuteChanged' ? ' is-on' : ''}`}>CanExecuteChanged</span>
          <span className={`cmd-signal${st.event === 'RequerySuggested' ? ' is-on' : ''}`}>CommandManager.RequerySuggested</span>
          <span className={`cmd-result${st.canExecute === null ? '' : st.canExecute ? ' is-true' : ' is-false'}`}>
            CanExecute → {st.canExecute === null ? '—' : String(st.canExecute)}
          </span>
        </div>
      </div>

      <Controls p={p} label="CanExecute" />
      <div className="viz-panels">
        <CodePanel code={dedent(code.code)} line={step.codeLine} title={`${code.title} (C# from the notes)`} />
        <div className="viz-side">
          <Narration text={step.narration} prediction={undefined} p={p} />
          <Variables vars={{ SelectedTransaction: st.selected === null ? 'null' : `${st.rows.find((r) => r.id === st.selected)?.category ?? ''} (Id ${st.selected})`, Button: st.button }} />
          <ul className="legend" aria-label="Colour legend">
            <li><span className="sw sw-active" aria-hidden="true" />Notification raised</li>
            <li><span className="sw sw-settled" aria-hidden="true" />Enabled / CanExecute true</li>
            <li><span className="sw sw-swap" aria-hidden="true" />Out of date</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
