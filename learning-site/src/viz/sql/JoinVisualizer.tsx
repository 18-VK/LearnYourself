import { MotionConfig } from 'motion/react';
import { useId, useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { JOIN_KINDS, JOIN_LABEL, JOIN_SQL, NOTE_JOIN_DATA, traceJoin, type JoinData, type JoinKind } from './traces/joins';
import { DataEditor, SqlCounters, SqlLegend, SqlPanel, Tables, VizTop } from './ui';

export interface JoinVisualizerProps {
  join?: string;
  predictMode?: boolean;
  placement?: string;
}

export const toJoinKind = (s: string | undefined): JoinKind => (JOIN_KINDS as string[]).includes(s ?? '') ? (s as JoinKind) : 'inner';

const CUSTOMER_IDS = [1, 2, 3, 4, 5];

export default function JoinVisualizer(props: JoinVisualizerProps) {
  const [kind, setKind] = useState<JoinKind>(() => toJoinKind(props.join));
  const [data, setData] = useState<JoinData>(NOTE_JOIN_DATA);
  const id = useId();
  const trace = useMemo(() => traceJoin(kind, data), [kind, data]);
  const dataKey = JSON.stringify(data);
  const edited = dataKey !== JSON.stringify(NOTE_JOIN_DATA);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${kind}:${dataKey}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const usesEmployees = kind === 'self';

  const setOrderCustomer = (k: number, v: number) => setData((d) => ({ ...d, orders: d.orders.map((o, i) => (i === k ? { ...o, CustomerId: v } : o)) }));
  const setManager = (k: number, v: number | null) => setData((d) => ({ ...d, employees: d.employees.map((e, i) => (i === k ? { ...e, ManagerId: v } : e)) }));

  return (
    <MotionConfig reducedMotion="user">
      <div className="viz" role="region" aria-label={`${JOIN_LABEL[kind]} visualizer`} onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
        <VizTop title={JOIN_LABEL[kind]} />
        <div className="viz-input">
          <label htmlFor={`${id}-kind`}>Join</label>
          <select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value as JoinKind)}>
            {JOIN_KINDS.map((k) => (
              <option key={k} value={k}>{JOIN_LABEL[k]}</option>
            ))}
          </select>
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
          <DataEditor title={usesEmployees ? 'Edit Employees.ManagerId' : 'Edit Orders.CustomerId'} edited={edited} onReset={() => setData(NOTE_JOIN_DATA)}>
            {usesEmployees
              ? data.employees.map((e, k) => (
                  <label key={e.EmpId}>
                    {e.Name}
                    <select aria-label={`ManagerId of ${e.Name}`} value={e.ManagerId ?? ''} onChange={(ev) => setManager(k, ev.target.value === '' ? null : Number(ev.target.value))}>
                      <option value="">NULL</option>
                      {data.employees.map((m) => (
                        <option key={m.EmpId} value={m.EmpId}>{m.EmpId}</option>
                      ))}
                    </select>
                  </label>
                ))
              : data.orders.map((o, k) => (
                  <label key={o.OrderId}>
                    {o.OrderId}
                    <select aria-label={`CustomerId of order ${o.OrderId}`} value={o.CustomerId} onChange={(ev) => setOrderCustomer(k, Number(ev.target.value))}>
                      {CUSTOMER_IDS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                ))}
          </DataEditor>
        </div>
        {kind === 'cross' && (
          <p className="viz-hint">The note's printed result for this query also lists CustomerId and Amount, but the query selects only c.Name and o.OrderId, so the result here has those two columns.</p>
        )}
        {kind === 'right' && <p className="viz-hint">The note: RIGHT JOIN is functionally identical to swapping table positions and using LEFT JOIN.</p>}
        {edited && <p className="viz-hint">You edited the data, so the result is computed from your values rather than matching the note's table.</p>}
        <div className="viz-stage">
          <Tables tables={step.state.tables} />
        </div>
        <Controls p={p} label={JOIN_LABEL[kind]} />
        <div className="viz-panels">
          <SqlPanel blocks={[{ code: JOIN_SQL[kind] }]} active={step.state.code} />
          <div className="viz-side">
            <Narration text={step.narration} prediction={step.predict} p={p} />
            <Variables vars={step.variables} />
            <SqlCounters
              items={[
                ['Condition checks', step.counters.comparisons],
                ['Rows read', step.counters.reads],
                ['Result rows', step.counters.writes],
              ]}
            />
            <SqlLegend items={['active', 'compare', 'settled', 'write', ...(kind === 'anti' || kind === 'anti-exists' || kind.endsWith('apply') ? (['removed'] as const) : [])]} />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
