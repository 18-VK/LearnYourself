import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../engine/usePlayer';
import { ConsoleOut, CsLegend, PartPicker, Tally, VizShell } from './shared/panels';
import { DEFAULT_OPS, INV_SCENARIOS, invPart, sandboxPart, toInvScenario, type InvState, type SandboxOp, type SandboxOptions } from './traces/invocation';

export interface InvocationListProps {
  /** multicast-delegate | event-subscribers */
  scenario?: string;
  predictMode?: boolean;
  placement?: string;
}

function Lists({ s }: { s: InvState }) {
  return (
    <div className="cs-inv">
      <div className="cs-inv-holders" aria-label="Variables and events">
        {s.holders.map((h) => (
          <span key={h.name} className={`cs-inv-holder${s.changed === h.name ? ' is-swap' : ''}`}>
            <span className="mono">{h.name}</span> {h.ref ? <span className="cs-ref">→ {h.ref}</span> : <span className="cs-ref is-null">null</span>}
          </span>
        ))}
      </div>
      <div className="cs-inv-dels">
        {s.delegates.length ? (
          s.delegates.map((d) => (
            <section key={d.id} className="cs-inv-del" aria-label={`Delegate ${d.id}`}>
              <div className="cs-di-head">
                <span>
                  <span className="cs-obj-id">{d.id}</span> delegate object
                </span>
                <span className="muted">invocation list</span>
              </div>
              <ol className="cs-inv-list">
                {d.list.map((h, i) => {
                  const now = s.invoking?.id === d.id && s.invoking.at === i;
                  const done = s.invoking?.id === d.id && i < s.invoking.at;
                  return (
                    <li key={i} className={now ? (s.error ? 'is-swap' : 'is-active') : done ? 'is-done' : undefined}>
                      <span className="cs-inv-n">{i + 1}</span>
                      <code>{h.label}</code>
                      {s.returns[i] !== undefined && s.invoking?.id === d.id && <span className="cs-inv-ret">returns {s.returns[i]}</span>}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))
        ) : (
          <p className="cs-empty">No delegate objects: nothing is subscribed.</p>
        )}
      </div>
      {s.result !== null && (
        <p className="cs-inv-result" role="status">
          The caller gets <b className="mono">{s.result}</b>, the last handler’s return value.
        </p>
      )}
      {s.error && (
        <p className="cs-error" role="status">
          {s.error}
        </p>
      )}
    </div>
  );
}

const HANDLERS = ['A', 'B', 'C'] as const;

export default function InvocationListVisualizer(props: InvocationListProps) {
  const scenario = toInvScenario(props.scenario);
  const def = INV_SCENARIOS[scenario];
  const [partId, setPartId] = useState(def.parts[0]!.id);
  const [ops, setOps] = useState<SandboxOp[]>(DEFAULT_OPS);
  const [opts, setOpts] = useState<SandboxOptions>({ returnsValue: false, bThrows: false });
  const part = useMemo(() => (partId === 'sandbox' ? sandboxPart(ops, opts) : invPart(partId)), [partId, ops, opts]);
  const trace = part.trace;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${partId}:${JSON.stringify(opts)}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const shownStep = p.awaitingPrediction && p.index > 0 ? trace[p.index - 1]! : step;
  const s = shownStep.state;

  // a new operation jumps to the steps it produced
  const jump = useRef<number | null>(null);
  useEffect(() => {
    if (jump.current !== null) {
      p.seek(Math.min(jump.current, trace.length - 1));
      jump.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace]);
  const addOp = (op: SandboxOp) => {
    jump.current = trace.length - 1;
    setOps((o) => [...o, op]);
  };

  return (
    <VizShell
      title={def.title}
      label={`${def.title} visualizer`}
      p={p}
      options={
        <>
          <PartPicker parts={def.parts} value={partId} onChange={setPartId} />
          {partId === 'sandbox' && (
            <>
              <label className="toggle">
                <input type="checkbox" checked={opts.returnsValue} onChange={(e) => setOpts((o) => ({ ...o, returnsValue: e.target.checked }))} /> Func&lt;int&gt; (handlers return 1, 2, 3)
              </label>
              <label className="toggle">
                <input type="checkbox" checked={opts.bThrows} onChange={(e) => setOpts((o) => ({ ...o, bThrows: e.target.checked }))} /> B throws
              </label>
            </>
          )}
        </>
      }
      hint={
        partId === 'sandbox'
          ? 'Build your own sequence: each button adds a line. The rules applied are the note’s: order of +=, last return value, and a throwing handler stops the rest.'
          : 'Delegates are immutable: += and -= build a new delegate object and point the variable at it.'
      }
      stage={
        <>
          {partId === 'sandbox' && (
            <div className="cs-inv-ops" role="group" aria-label="Add an operation">
              {HANDLERS.map((h) => (
                <button key={`a${h}`} type="button" className="chipbtn" onClick={() => addOp({ kind: 'add', handler: h })}>
                  h += {h}
                </button>
              ))}
              {HANDLERS.map((h) => (
                <button key={`r${h}`} type="button" className="chipbtn" onClick={() => addOp({ kind: 'remove', handler: h })}>
                  h -= {h}
                </button>
              ))}
              <button type="button" className="chipbtn" onClick={() => addOp({ kind: 'invoke' })}>
                h()
              </button>
              <button type="button" className="chipbtn" disabled={!ops.length} onClick={() => setOps((o) => o.slice(0, -1))}>
                Undo
              </button>
              <button type="button" className="chipbtn" onClick={() => setOps(DEFAULT_OPS)}>
                Reset
              </button>
            </div>
          )}
          <Lists s={s} />
          <ConsoleOut lines={s.output} />
        </>
      }
      doc={part.doc}
      codeTitle={partId === 'sandbox' ? 'Your operations (not from the notes)' : undefined}
      line={step.codeLine}
      narration={step.narration}
      prediction={step.predict}
      vars={shownStep.variables}
      side={
        <>
          <Tally
            items={[
              ['Methods in the list', s.delegates.find((d) => d.id === s.holders[0]?.ref)?.list.length ?? 0],
              ['Delegate objects alive', s.delegates.length],
              ['Lines printed', s.output.length],
            ]}
          />
          <CsLegend
            items={[
              { kind: 'active', label: 'Method running now' },
              { kind: 'settled', label: 'Already ran in this call' },
              { kind: 'swap', label: 'Changed now, or threw' },
              { kind: 'ptr-line', label: 'Reference to a delegate object' },
            ]}
          />
        </>
      }
    />
  );
}
