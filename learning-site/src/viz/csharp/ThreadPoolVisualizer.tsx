import { useMemo } from 'react';
import { usePlayer } from '../engine/usePlayer';
import { ConsoleOut, CsLegend, Tally, VizShell } from './shared/panels';
import { TimelineView } from './shared/TimelineView';
import { tpPart } from './traces/threadpool';

export interface ThreadPoolProps {
  scenario?: string;
  predictMode?: boolean;
  placement?: string;
}

export default function ThreadPoolVisualizer(props: ThreadPoolProps) {
  const part = useMemo(() => tpPart(), []);
  const trace = part.trace;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), 'tp', { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const shownStep = p.awaitingPrediction && p.index > 0 ? trace[p.index - 1]! : step;
  const s = shownStep.state;

  return (
    <VizShell
      title="The thread pool’s work queue"
      label="Thread pool work queue visualizer"
      p={p}
      hint="Simplified: one queue and one pool thread, which picks the item up at once. Times come from the code’s Thread.Sleep calls. M and W stand for the thread ids the program prints."
      stage={
        <>
          <div className="cs-tp">
            <section className="cs-ef-box" aria-label="Thread pool queue">
              <div className="cs-di-head">
                Queue <span className="muted">waiting for a pool thread</span>
              </div>
              {s.queue.length ? (
                s.queue.map((q) => (
                  <span key={q} className="cs-di-chip is-compare">
                    {q}
                  </span>
                ))
              ) : (
                <p className="cs-empty">empty</p>
              )}
            </section>
            <section className="cs-ef-box" aria-label="Pool threads">
              <div className="cs-di-head">
                Pool thread W <span className="muted">background thread</span>
              </div>
              {s.running.length ? (
                s.running.map((q) => (
                  <span key={q} className="cs-di-chip is-active">
                    running {q}
                  </span>
                ))
              ) : (
                <p className="cs-empty">idle</p>
              )}
            </section>
          </div>
          <TimelineView s={s} />
          <ConsoleOut lines={s.output} />
        </>
      }
      doc={part.doc}
      line={step.codeLine}
      also={step.state.also}
      narration={step.narration}
      prediction={step.predict}
      vars={shownStep.variables}
      side={
        <>
          <Tally items={s.tally} />
          <CsLegend
            items={[
              { kind: 'active', label: 'Running code' },
              { kind: 'blocked', label: 'Blocked in Thread.Sleep' },
              { kind: 'wait', label: 'Queued, waiting for a thread' },
            ]}
          />
        </>
      }
    />
  );
}
