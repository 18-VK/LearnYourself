import { MotionConfig } from 'motion/react';
import { useId, useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { CUSTOMERS } from './notes';
import { ALL_STAGES, isExtra, NOTE_QO_DATA, QUERIES, QUERY_ORDER, traceQueryOrder, type QoData, type QueryId } from './traces/query-order';
import { DataEditor, SqlCounters, SqlLegend, SqlPanel, Tables, VizTop } from './ui';

export interface QueryOrderVisualizerProps {
  stages?: string[];
  query?: string;
  predictMode?: boolean;
  placement?: string;
}

const IDS = [1, 2, 3, 4, 5];

export default function QueryOrderVisualizer(props: QueryOrderVisualizerProps) {
  const stages = useMemo(() => {
    const s = (props.stages ?? []).filter((x) => (ALL_STAGES as readonly string[]).includes(x));
    return s.length ? s : [...ALL_STAGES];
  }, [props.stages]);
  const [query, setQuery] = useState<QueryId>(() => (QUERY_ORDER as string[]).includes(props.query ?? '') ? (props.query as QueryId) : 'where-mistake');
  const [data, setData] = useState<QoData>(NOTE_QO_DATA);
  const id = useId();
  const q = QUERIES[query];
  const trace = useMemo(() => traceQueryOrder(query, stages, data), [query, stages, data]);
  const dataKey = JSON.stringify(data);
  const edited = dataKey !== JSON.stringify(NOTE_QO_DATA);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${query}:${dataKey}:${stages.join()}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const st = step.state;
  const uses5 = query === 'group-count';

  const setOrder = (k: number, patch: Partial<{ CustomerId: number; Amount: number }>) => setData((d) => ({ ...d, orders: d.orders.map((o, i) => (i === k ? { ...o, ...patch } : o)) }));
  const setOrder5 = (k: number, cid: number) => setData((d) => ({ ...d, orders5: d.orders5.map((o, i) => (i === k ? { ...o, CustomerId: cid } : o)) }));

  return (
    <MotionConfig reducedMotion="user">
      <div className="viz" role="region" aria-label="Logical query processing order visualizer" onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
        <VizTop title="Logical query processing order" />
        <div className="viz-input">
          <label htmlFor={`${id}-q`}>Query</label>
          <select id={`${id}-q`} value={query} onChange={(e) => setQuery(e.target.value as QueryId)}>
            {QUERY_ORDER.map((k) => (
              <option key={k} value={k}>{QUERIES[k].label}</option>
            ))}
          </select>
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
          <DataEditor title={query === 'apply-inner' ? 'Edit the data and the customer' : 'Edit Orders'} edited={edited} onReset={() => setData(NOTE_QO_DATA)}>
            {query === 'apply-inner' && (
              <label>
                c.CustomerId
                <select aria-label="Customer the subquery runs for" value={data.applyCustomer} onChange={(e) => setData((d) => ({ ...d, applyCustomer: Number(e.target.value) }))}>
                  {CUSTOMERS.map((c) => (
                    <option key={c.CustomerId} value={c.CustomerId}>{c.CustomerId} ({c.Name})</option>
                  ))}
                </select>
              </label>
            )}
            {uses5
              ? data.orders5.map((o, k) => (
                  <label key={o.Id}>
                    Order {o.Id} CustomerId
                    <select aria-label={`CustomerId of order ${o.Id}`} value={o.CustomerId} onChange={(e) => setOrder5(k, Number(e.target.value))}>
                      {IDS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                ))
              : data.orders.map((o, k) => (
                  <span key={o.OrderId} className="sql-edit-row">
                    <label>
                      {o.OrderId} CustomerId
                      <select aria-label={`CustomerId of order ${o.OrderId}`} value={o.CustomerId} onChange={(e) => setOrder(k, { CustomerId: Number(e.target.value) })}>
                        {IDS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Amount
                      <input type="number" min={0} max={9999} step={5} value={o.Amount} aria-label={`Amount of order ${o.OrderId}`} onChange={(e) => setOrder(k, { Amount: Math.max(0, Math.min(9999, Number(e.target.value) || 0)) })} />
                    </label>
                  </span>
                ))}
          </DataEditor>
        </div>
        <p className="viz-hint">{q.source}{edited ? ' You edited the data, so the result is computed from your values.' : ''}</p>
        <div className="viz-stage">
          <ol className="qo-pipe" aria-label="Logical processing order">
            {st.stages.map((s, i) => {
              const cls = [isExtra(s) ? 'is-extra' : '', st.used[i] ? '' : 'is-unused', i === st.stage ? 'is-active' : i < st.stage ? 'is-done' : ''].filter(Boolean).join(' ');
              return (
                <li key={s} className={cls || undefined} aria-current={i === st.stage ? 'step' : undefined}>
                  {s}
                  {isExtra(s) && <span className="tag">extra</span>}
                  {!st.used[i] && <span className="sql-vh"> (not in this query)</span>}
                </li>
              );
            })}
          </ol>
          {st.stage >= 0 && st.stage < st.stages.length && (
            <p className={`qo-clause${st.clause ? '' : ' is-none'}`}>{st.clause ?? `${st.stages[st.stage]} is not in this query.`}</p>
          )}
          <Tables tables={st.tables} />
        </div>
        <Controls p={p} label="Query order" />
        <div className="viz-panels">
          <SqlPanel blocks={[{ code: q.sql.code, faded: q.faded }]} active={st.code} />
          <div className="viz-side">
            <Narration text={step.narration} prediction={step.predict} p={p} />
            <Variables vars={step.variables} />
            <SqlCounters
              items={[
                ['Stages processed', step.counters.reads],
                ['Clauses in this query applied', step.counters.comparisons],
              ]}
            />
            <SqlLegend items={['write', 'settled', 'removed']} extra={[['sw-extra', 'Dashed stage: extra step in the note\'s full list']]} />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
