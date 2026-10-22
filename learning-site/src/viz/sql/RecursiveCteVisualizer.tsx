import { MotionConfig } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { CTE_EMPLOYEES, type CteEmployee } from './notes';
import { RECURSIVE_CODE, traceRecursive, type CteRow } from './traces/recursive';
import { DataEditor, SqlCounters, SqlLegend, SqlPanel, Tables, VizTop } from './ui';

/** The hierarchy found so far, as an indented list (children under their manager). */
function Tree({ rows, fresh }: { rows: CteRow[]; fresh: number[] }) {
  const kids = (id: number | null, level: number): CteRow[] => rows.filter((r) => r.Level === level && (level === 0 ? r.ManagerId === null : r.ManagerId === id));
  const render = (r: CteRow): ReactNode => (
    <li key={r.Id} style={{ paddingLeft: `${r.Level * 1.4}em` }}>
      <span className={fresh.includes(r.Id) ? 'is-swap' : undefined}>{r.Level > 0 ? '└ ' : ''}{r.Name}</span>
      <span className="lvl">Level {r.Level}</span>
    </li>
  );
  const walk = (r: CteRow): ReactNode[] => [render(r), ...kids(r.Id, r.Level + 1).flatMap(walk)];
  return (
    <div className="iso-box">
      <h4>Hierarchy found so far</h4>
      {rows.length ? <ul className="cte-tree">{kids(null, 0).flatMap(walk)}</ul> : <p className="none">Nothing yet</p>}
    </div>
  );
}

export default function RecursiveCteVisualizer(props: { predictMode?: boolean; placement?: string }) {
  const [es, setEs] = useState<readonly CteEmployee[]>(CTE_EMPLOYEES);
  const trace = useMemo(() => traceRecursive(es), [es]);
  const key = JSON.stringify(es);
  const edited = key !== JSON.stringify(CTE_EMPLOYEES);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), key, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const st = step.state;

  return (
    <MotionConfig reducedMotion="user">
      <div className="viz" role="region" aria-label="Recursive CTE visualizer" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
        <VizTop title="Recursive CTE, iteration by iteration" />
        <div className="viz-input">
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
          <DataEditor title="Edit Employees.ManagerId" edited={edited} onReset={() => setEs(CTE_EMPLOYEES)}>
            {es.map((e, k) => (
              <label key={e.Id}>
                {e.Name}
                <select aria-label={`ManagerId of ${e.Name}`} value={e.ManagerId ?? ''} onChange={(ev) => setEs((xs) => xs.map((x, i) => (i === k ? { ...x, ManagerId: ev.target.value === '' ? null : Number(ev.target.value) } : x)))}>
                  <option value="">NULL</option>
                  {es.filter((m) => m.Id !== e.Id).map((m) => (
                    <option key={m.Id} value={m.Id}>{m.Id} ({m.Name})</option>
                  ))}
                </select>
              </label>
            ))}
          </DataEditor>
        </div>
        <p className="viz-hint">The Employees sample data from this note. The note doesn't print this query's result; it is computed here.{edited ? ' You edited the managers, so the result follows your values.' : ''}</p>
        <div className="viz-stage">
          <div className="cte-iters" aria-label="Iterations">
            {st.iterations.map((it, k) => (
              <span key={k} className={k === st.iteration ? 'is-active' : undefined}>{k === 0 ? 'Anchor' : `Iteration ${k}`}: {it.length}</span>
            ))}
            {step.action === 'branch' || step.action === 'done' ? <span>Iteration {st.iterations.length}: 0, stop</span> : null}
          </div>
          <Tables tables={st.tables} compact />
          <Tree rows={st.iterations.flat()} fresh={st.fresh} />
        </div>
        <Controls p={p} label="Recursive CTE" />
        <div className="viz-panels">
          <SqlPanel blocks={[{ code: RECURSIVE_CODE }]} active={st.code} />
          <div className="viz-side">
            <Narration text={step.narration} prediction={step.predict} p={p} />
            <Variables vars={step.variables} />
            <SqlCounters
              items={[
                ['Recursive runs', step.counters.swaps],
                ['Join checks', step.counters.comparisons],
                ['Rows in the CTE', step.counters.writes],
              ]}
            />
            <SqlLegend items={['compare', 'settled', 'write']} />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
