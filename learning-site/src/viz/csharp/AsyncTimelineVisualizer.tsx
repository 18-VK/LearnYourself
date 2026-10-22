import { useMemo, useState } from 'react';
import { usePlayer } from '../engine/usePlayer';
import { ConsoleOut, CsLegend, PartPicker, Tally, VizShell } from './shared/panels';
import { TimelineView } from './shared/TimelineView';
import { ASYNC_PARTS, asyncPart, toAsyncParts, type AsyncContext, type AsyncPartId } from './traces/async-timeline';

export interface AsyncTimelineProps {
  /** Which parts to offer, in order: sync-vs-async, await-releases-thread, when-all. */
  scenarios?: string[];
  /** Start in a UI app instead of a console app. */
  context?: string;
  predictMode?: boolean;
  placement?: string;
}

const CONTEXTS: { id: AsyncContext; label: string }[] = [
  { id: 'console', label: 'Console app' },
  { id: 'ui', label: 'UI app (WPF/WinForms)' },
];

export default function AsyncTimelineVisualizer(props: AsyncTimelineProps) {
  const ids = useMemo(() => toAsyncParts(props.scenarios), [props.scenarios]);
  const [partId, setPartId] = useState<AsyncPartId>(ids[0]!);
  const [ctx, setCtx] = useState<AsyncContext>(props.context === 'ui' ? 'ui' : 'console');
  const part = useMemo(() => asyncPart(partId, ctx), [partId, ctx]);
  const trace = part.trace;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${partId}:${ctx}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const shownStep = p.awaitingPrediction && p.index > 0 ? trace[p.index - 1]! : step;
  const s = shownStep.state;
  const labels = ASYNC_PARTS.filter((x) => ids.includes(x.id));

  return (
    <VizShell
      title="async and await on a timeline"
      label="async and await timeline visualizer"
      p={p}
      options={
        <>
          <PartPicker parts={labels} value={partId} onChange={(v) => setPartId(v as AsyncPartId)} />
          {part.usesContext && <PartPicker parts={CONTEXTS} value={ctx} onChange={(v) => setCtx(v as AsyncContext)} label="Run in" />}
        </>
      }
      hint={
        partId === 'when-all'
          ? 'Each worker is a task, not a thread: while it awaits, no thread is used. The order shown is one possible run.'
          : 'Simplified: one lane per thread, plus the Delay timer, which needs no thread while it counts down. Where a continuation runs follows the table in the continuations note.'
      }
      stage={
        <>
          <TimelineView s={s} forever={s.forever} />
          <ConsoleOut lines={s.output} empty={partId === 'sync-vs-async' ? 'This code prints nothing.' : 'Nothing printed yet.'} />
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
              { kind: 'blocked', label: 'Thread blocked' },
              { kind: 'free', label: 'Thread free for other work' },
              { kind: 'wait', label: 'Waiting, no thread used' },
              ...(partId === 'when-all' ? [{ kind: 'inside', label: 'Holding a semaphore slot' }] : []),
              { kind: 'settled', label: 'Finished' },
            ]}
          />
        </>
      }
    />
  );
}
