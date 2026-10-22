import { MotionConfig } from 'motion/react';
import { useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { SUBQUERY_EMPLOYEES, type DeptEmployee } from './notes';
import { CORRELATED_CODE, traceCorrelated } from './traces/correlated';
import { DataEditor, SqlCounters, SqlLegend, SqlPanel, Tables, VizTop } from './ui';

export default function CorrelatedSubqueryVisualizer(props: { predictMode?: boolean; placement?: string }) {
  const [es, setEs] = useState<readonly DeptEmployee[]>(SUBQUERY_EMPLOYEES);
  const trace = useMemo(() => traceCorrelated(es), [es]);
  const key = JSON.stringify(es);
  const edited = key !== JSON.stringify(SUBQUERY_EMPLOYEES);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), key, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const set = (k: number, patch: Partial<DeptEmployee>) => setEs((xs) => xs.map((e, i) => (i === k ? { ...e, ...patch } : e)));

  return (
    <MotionConfig reducedMotion="user">
      <div className="viz" role="region" aria-label="Correlated subquery visualizer" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
        <VizTop title="Correlated subquery: one inner run per outer row" />
        <div className="viz-input">
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
          <DataEditor title="Edit Employees" edited={edited} onReset={() => setEs(SUBQUERY_EMPLOYEES)}>
            {es.map((e, k) => (
              <span key={e.Id} className="sql-edit-row">
                <label>
                  {e.Name} Salary
                  <input type="number" min={0} max={999999} step={500} value={e.Salary} aria-label={`Salary of ${e.Name}`} onChange={(ev) => set(k, { Salary: Math.max(0, Math.min(999999, Number(ev.target.value) || 0)) })} />
                </label>
                <label>
                  DepartmentId
                  <select aria-label={`DepartmentId of ${e.Name}`} value={e.DepartmentId} onChange={(ev) => set(k, { DepartmentId: Number(ev.target.value) })}>
                    {[1, 2, 3].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
              </span>
            ))}
          </DataEditor>
        </div>
        <p className="viz-hint">The Employees sample table from this note.{edited ? ' You edited it, so the result is computed from your values.' : ''}</p>
        <div className="viz-stage">
          <Tables tables={step.state.tables} compact />
        </div>
        <Controls p={p} label="Correlated subquery" />
        <div className="viz-panels">
          <SqlPanel blocks={[{ code: CORRELATED_CODE }]} active={step.state.code} />
          <div className="viz-side">
            <Narration text={step.narration} prediction={step.predict} p={p} />
            <Variables vars={step.variables} />
            <SqlCounters
              items={[
                ['Inner query runs', step.counters.swaps],
                ['Rows read by inner runs', step.counters.comparisons],
                ['Result rows', step.counters.writes],
              ]}
            />
            <SqlLegend items={['active', 'compare', 'settled', 'write', 'removed']} />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
