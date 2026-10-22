import { useMemo, useState } from 'react';
import { usePlayer } from '../engine/usePlayer';
import { ConsoleOut, CsLegend, PartPicker, Tally, VizShell } from './shared/panels';
import { textAt } from './shared/step';
import { CS_PARTS, csPart, type CsState } from './traces/callstack';

export interface CallStackProps {
  scenario?: string;
  part?: string;
  predictMode?: boolean;
  placement?: string;
}

const STATUS_TEXT: Record<string, string> = {
  running: 'running',
  waiting: 'waiting for the call above',
  catch: 'in a catch block',
  finally: 'in finally',
  unwinding: 'being unwound',
};

function Stack({ s }: { s: CsState }) {
  const frames = [...s.frames].reverse();
  const ex = s.exception;
  return (
    <div className="cs-cst">
      <section className="cs-cst-stack" aria-label="Call stack, most recent call first">
        <div className="cs-col-head">
          <span>Call stack</span>
          <span className="muted">top = most recent call</span>
        </div>
        {frames.length ? (
          frames.map((f, i) => (
            <div key={`${f.method}-${frames.length - i}`} className={`cs-cst-frame is-${f.status}`}>
              <span className="mono">{f.method}()</span>
              <span className="cs-cst-status">{STATUS_TEXT[f.status]}</span>
              {ex && ex.at === f.method && (
                <span className={`cs-cst-ex${ex.handled ? ' is-handled' : ''}`}>
                  {ex.handled ? 'handled: ' : 'in flight: '}
                  <b>{ex.type}</b>
                </span>
              )}
            </div>
          ))
        ) : (
          <p className="cs-empty">The stack is empty: the program has finished.</p>
        )}
      </section>
      <section className="cs-cst-info" aria-label="Exception details">
        {ex ? (
          <>
            <div className="cs-col-head">
              <span>{ex.type}</span>
            </div>
            <p className="cs-cst-msg">
              Message: <span className="mono">{ex.message}</span>
            </p>
            <div className="cs-cst-trace">
              <span className="cs-type">StackTrace (where it was thrown)</span>
              {ex.trace.map((m) => (
                <code key={m}>at {m}()</code>
              ))}
            </div>
          </>
        ) : (
          <p className="cs-empty">No exception in flight.</p>
        )}
        {s.test && (
          <p className={`cs-cst-test ${s.test.match ? 'is-match' : 'is-miss'}`}>
            <code>{s.test.clause}</code> {s.test.match ? '✓ matches' : '✗ does not match'}
          </p>
        )}
      </section>
    </div>
  );
}

export default function CallStackVisualizer(props: CallStackProps) {
  const [partId, setPartId] = useState<string>(() => (CS_PARTS.some((x) => x.id === props.part) ? props.part! : 'rethrow'));
  const part = useMemo(() => csPart(partId), [partId]);
  const trace = part.trace;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), partId, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const shownStep = p.awaitingPrediction && p.index > 0 ? trace[p.index - 1]! : step;
  const s = shownStep.state;

  return (
    <VizShell
      title="An exception travels up the call stack"
      label="Exception call stack visualizer"
      p={p}
      options={<PartPicker parts={[...CS_PARTS]} value={partId} onChange={setPartId} />}
      hint="Each frame is a method call that hasn't returned yet. A thrown exception leaves frames one by one until a matching catch is found; finally blocks run on the way out."
      stage={
        <>
          <Stack s={s} />
          {s.skipped.length > 0 && (
            <div className="cs-cst-skipped">
              <span className="cs-type">Skipped because of the exception</span>
              {s.skipped.map((l) => (
                <code key={l}>{textAt(part.doc, l).trim()}</code>
              ))}
            </div>
          )}
          <ConsoleOut lines={s.output} />
        </>
      }
      doc={part.doc}
      line={step.codeLine}
      narration={step.narration}
      prediction={step.predict}
      vars={shownStep.variables}
      side={
        <>
          <Tally
            items={[
              ['Stack depth', s.frames.length],
              ['Frames unwound', s.exception ? Math.max(0, s.exception.trace.length - s.frames.length) : 0],
              ['Lines printed', s.output.length],
            ]}
          />
          <CsLegend
            items={[
              { kind: 'active', label: 'Running frame' },
              { kind: 'swap', label: 'Unwinding / exception in flight' },
              { kind: 'compare', label: 'In catch or finally' },
              { kind: 'settled', label: 'Exception handled' },
            ]}
          />
        </>
      }
    />
  );
}
