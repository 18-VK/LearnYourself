import { MotionConfig } from 'motion/react';
import { useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { SQL, WINDOW_EMPLOYEES, type WindowEmployee } from './notes';
import { FRAME_ENDS, FRAME_STARTS, NOTE_FRAME, RANK_FNS, runningTotalCode, traceRanking, traceRunningTotal, type FrameEnd, type FrameStart, type RankFn } from './traces/window';
import { DataEditor, Pick, SqlCounters, SqlLegend, SqlPanel, Tables, VizTop } from './ui';

export interface WindowFunctionVisualizerProps {
  functions?: string[];
  frame?: string;
  predictMode?: boolean;
  placement?: string;
}

const FN_BLOCK: Record<RankFn, string> = { ROW_NUMBER: SQL.rowNumber.code, RANK: SQL.rank.code, DENSE_RANK: SQL.denseRank.code };

export default function WindowFunctionVisualizer(props: WindowFunctionVisualizerProps) {
  const running = props.frame === 'running-total' || (props.functions ?? []).includes('SUM');
  const fns = useMemo(() => {
    const f = (props.functions ?? []).filter((x): x is RankFn => (RANK_FNS as string[]).includes(x));
    return f.length ? f : RANK_FNS;
  }, [props.functions]);
  const [es, setEs] = useState<readonly WindowEmployee[]>(WINDOW_EMPLOYEES);
  const [partition, setPartition] = useState(false);
  const [start, setStart] = useState<FrameStart>(NOTE_FRAME.start);
  const [end, setEnd] = useState<FrameEnd>(NOTE_FRAME.end);
  const trace = useMemo(() => (running ? traceRunningTotal({ start, end }, partition, es) : traceRanking(fns, partition, es)), [running, start, end, partition, es, fns]);
  const key = JSON.stringify([es, partition, start, end]);
  const edited = JSON.stringify(es) !== JSON.stringify(WINDOW_EMPLOYEES);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), key, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const setSalary = (k: number, v: number) => setEs((xs) => xs.map((e, i) => (i === k ? { ...e, Salary: v } : e)));
  const tie = () => setEs(WINDOW_EMPLOYEES.map((e) => (e.Name === 'Rahul' ? { ...e, Salary: 60000 } : e)));

  const rt = runningTotalCode({ start, end }, partition);
  const blocks = running ? [{ code: rt.code }] : partition ? [{ code: SQL.deptRank.code, label: 'ROW_NUMBER() with PARTITION BY' }] : fns.map((f) => ({ code: FN_BLOCK[f], label: `${f}()` }));
  const title = running ? 'Running total with a window frame' : partition ? 'ROW_NUMBER per department' : fns.join(', ');
  const codeTitle = running && !rt.fromNote ? "Your variation of the note's query" : 'SQL from the notes';

  return (
    <MotionConfig reducedMotion="user">
      <div className="viz" role="region" aria-label={`${title} visualizer`} onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
        <VizTop title={title} />
        <div className="viz-input">
          <label className="toggle">
            <input type="checkbox" checked={partition} onChange={(e) => setPartition(e.target.checked)} /> PARTITION BY Department
          </label>
          {running && (
            <>
              <Pick label="ROWS BETWEEN" value={start} onChange={setStart} options={FRAME_STARTS.map((s) => ({ id: s, label: s }))} />
              <Pick label="AND" value={end} onChange={setEnd} options={FRAME_ENDS.map((s) => ({ id: s, label: s }))} />
            </>
          )}
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
          <DataEditor title="Edit salaries" edited={edited} onReset={() => setEs(WINDOW_EMPLOYEES)}>
            {es.map((e, k) => (
              <label key={e.Id}>
                {e.Name}
                <input type="number" min={0} max={999999} step={5000} value={e.Salary} aria-label={`Salary of ${e.Name}`} onChange={(ev) => setSalary(k, Math.max(0, Math.min(999999, Number(ev.target.value) || 0)))} />
              </label>
            ))}
            {!running && (
              <button type="button" className="chipbtn" onClick={tie}>
                Make a tie (Rahul = 60000)
              </button>
            )}
          </DataEditor>
        </div>
        {!running && !partition && fns.includes('RANK') && <p className="viz-hint">The note's RANK() query has a comma before FROM, which SQL Server would reject; the visualizer evaluates RANK() OVER (ORDER BY Salary DESC).</p>}
        {!running && partition && <p className="viz-hint">The note shows PARTITION BY with ROW_NUMBER only (its DeptRank example), so this view shows ROW_NUMBER.</p>}
        {edited && <p className="viz-hint">You edited the salaries, so the values are computed from your data.</p>}
        <div className="viz-stage">
          <Tables tables={step.state.tables} />
        </div>
        <Controls p={p} label={title} />
        <div className="viz-panels">
          <SqlPanel title={codeTitle} blocks={blocks} active={step.state.code} />
          <div className="viz-side">
            <Narration text={step.narration} prediction={step.predict} p={p} />
            <Variables vars={step.variables} />
            <SqlCounters
              items={
                running
                  ? [
                      ['Rows summed', step.counters.reads],
                      ['Values computed', step.counters.writes],
                    ]
                  : [
                      ['Salary comparisons', step.counters.comparisons],
                      ['Values computed', step.counters.writes],
                    ]
              }
            />
            <SqlLegend items={['active', 'compare', 'write', 'settled']} labels={running ? { compare: 'In the window frame', write: 'Just computed' } : { compare: 'Previous row (compared)', write: 'Just computed' }} />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
