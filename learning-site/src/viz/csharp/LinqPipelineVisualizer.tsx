import { useMemo, useState } from 'react';
import { usePlayer } from '../engine/usePlayer';
import { ConsoleOut, CsLegend, PartPicker, Tally, VizShell } from './shared/panels';
import { LQ_PARTS, lqPart, lqPartsFor, type LqPartId, type LqStage, type LqState } from './traces/linq-pipeline';

export interface LinqPipelineProps {
  scenario?: string;
  /** Also offer the note's ToList() example. */
  compareToList?: boolean;
  predictMode?: boolean;
  placement?: string;
}

const CALLS_LABEL: Record<LqStage['id'], string> = {
  where: 'predicate calls',
  select: 'selector calls',
  tolist: 'items stored',
  foreach: 'items received',
};

function Stage({ x, s }: { x: LqStage; s: LqState }) {
  const active = s.active === x.id;
  const cls = `cs-lq-stage${active ? ' is-active' : ''}${x.verdict === 'pass' ? ' is-pass' : ''}`;
  return (
    <div className={cls}>
      <div className="cs-lq-stage-head">
        <span className="mono">{x.label}</span>
        {!s.executed && x.id !== 'foreach' && <span className="cs-badge">plan only</span>}
      </div>
      {x.id === 'tolist' && s.result ? (
        <div className="cs-lq-cells" aria-label={`result: ${s.result.join(', ') || 'empty'}`}>
          {s.result.length ? (
            s.result.map((v, i) => (
              <span key={i} className={`cs-lq-cell${active && x.value !== null && i === s.result!.length - 1 ? ' is-swap' : ''}`}>
                {v}
              </span>
            ))
          ) : (
            <span className="cs-empty">empty list</span>
          )}
        </div>
      ) : (
        <div className="cs-lq-val">
          {x.value !== null ? (
            <>
              <span className={`cs-lq-cell${active ? (x.verdict === 'fail' ? ' is-fail' : ' is-compare') : ''}`}>{x.id === 'foreach' ? `n = ${x.value}` : x.value}</span>
              {x.verdict && <span className={`cs-lq-verdict is-${x.verdict}`}>{x.verdict === 'pass' ? '✓ passes' : '✗ skipped'}</span>}
            </>
          ) : (
            <span className="cs-lq-idle">{x.id === 'foreach' && !s.executed ? 'not started' : 'waiting'}</span>
          )}
        </div>
      )}
      <div className="cs-lq-calls">
        {CALLS_LABEL[x.id]}: {x.calls}
      </div>
    </div>
  );
}

export default function LinqPipelineVisualizer(props: LinqPipelineProps) {
  const ids = lqPartsFor(props.compareToList !== false);
  const [partId, setPartId] = useState<LqPartId>(ids[0]!);
  const part = useMemo(() => lqPart(partId), [partId]);
  const trace = part.trace;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), partId, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const shownStep = p.awaitingPrediction && p.index > 0 ? trace[p.index - 1]! : step;
  const s = shownStep.state;
  const where = s.stages.find((x) => x.id === 'where')!;

  return (
    <VizShell
      title="LINQ: deferred vs immediate execution"
      label="LINQ deferred versus immediate execution visualizer"
      p={p}
      options={<PartPicker parts={LQ_PARTS.filter((x) => ids.includes(x.id))} value={partId} onChange={(v) => setPartId(v as LqPartId)} />}
      hint={
        partId === 'chain'
          ? 'The notes have no chained example, so this one joins the note’s Where with the Select from LINQ basics (n => n * n) to show how elements stream through a chain.'
          : 'Each step is one pull: foreach asks for the next element, and the request travels back to numbers.'
      }
      stage={
        <>
          <div className="cs-lq" role="group" aria-label="Query pipeline">
            <div className={`cs-lq-src${s.active === 'source' ? ' is-active' : ''}`}>
              <div className="cs-lq-stage-head">
                <span className="mono">numbers</span>
                <span className="cs-type">List&lt;int&gt;</span>
              </div>
              <div className="cs-lq-cells" aria-label={`numbers: ${s.source.join(', ')}`}>
                {s.source.map((v, i) => (
                  <span key={i} className={`cs-lq-cell${s.reading === i ? ' is-compare' : i < s.readUpTo && s.executed ? ' is-read' : ''}`}>
                    {v}
                  </span>
                ))}
              </div>
              <div className="cs-lq-calls">elements read: {s.executed ? s.readUpTo : 0}</div>
            </div>
            {s.stages.map((x) => (
              <Stage key={x.id} x={x} s={s} />
            ))}
          </div>
          <ConsoleOut lines={s.output} />
        </>
      }
      doc={part.doc}
      codeTitle={partId === 'chain' ? 'C# composed from two note examples' : undefined}
      line={step.codeLine}
      narration={step.narration}
      prediction={step.predict}
      vars={shownStep.variables}
      side={
        <>
          <Tally
            items={[
              ['Elements read', s.executed ? s.readUpTo : 0],
              ['Predicate calls', where.calls],
              ['Printed', s.output.length],
            ]}
          />
          <CsLegend
            items={[
              { kind: 'compare', label: 'Element being read or tested' },
              { kind: 'active', label: 'Stage working now' },
              { kind: 'swap', label: 'Stored by ToList()' },
              { kind: 'idle', label: 'Already read (dashed)' },
            ]}
          />
        </>
      }
    />
  );
}
