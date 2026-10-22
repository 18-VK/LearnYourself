import { useId, useMemo, useState } from 'react';
import { usePlayer } from '../engine/usePlayer';
import { ConsoleOut, CsLegend, PartPicker, Tally, VizShell } from './shared/panels';
import { EF_STATE_PARTS, efStatePart, NP_PARTS, NP_RANGE, npPart, toEfScenario, type EfState, type EntityState, type NpPartId, type NpState } from './traces/efcore';

export interface EfCoreProps {
  /** change-tracker-states | n-plus-one */
  scenario?: string;
  predictMode?: boolean;
  placement?: string;
}

const STATE_CLASS: Record<EntityState, string> = {
  Detached: 'idle',
  Added: 'active',
  Unchanged: 'settled',
  Modified: 'compare',
  Deleted: 'swap',
};

function Tracker({ s }: { s: EfState }) {
  return (
    <div className="cs-ef">
      <section className={`cs-ef-box${s.contextOpen ? '' : ' is-closed'}`} aria-label="Change tracker">
        <div className="cs-di-head">
          DbContext change tracker <span className="muted">{s.contextOpen ? 'context open' : 'context disposed'}</span>
        </div>
        {s.entries.length ? (
          <table className="cs-ef-table">
            <thead>
              <tr>
                <th scope="col">Entity</th>
                <th scope="col">State</th>
                <th scope="col">Values</th>
              </tr>
            </thead>
            <tbody>
              {s.entries.map((e) => (
                <tr key={e.name} className={s.changed === e.name ? 'is-now' : undefined}>
                  <td className="mono">{e.name}</td>
                  <td>
                    <span className={`cs-state is-${STATE_CLASS[e.state]}`}>{e.state}</span>
                  </td>
                  <td className="cs-ef-vals">
                    {e.props.map((p) => (
                      <span key={p.name} className={p.original !== undefined && p.original !== p.current ? 'is-dirty' : undefined}>
                        {p.name} = {p.current}
                        {p.original !== undefined && p.original !== p.current && <em> (was {p.original})</em>}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="cs-empty">Nothing tracked.</p>
        )}
      </section>
      <section className="cs-ef-box is-db" aria-label={`Database table ${s.table}`}>
        <div className="cs-di-head">
          Database: {s.table} <span className="muted">table rows</span>
        </div>
        {s.rows.length ? (
          <table className="cs-ef-table">
            <thead>
              <tr>
                <th scope="col">Id</th>
                {Object.keys(s.rows[0]!.cols).map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r) => (
                <tr key={r.id} className={s.rowChanged === r.id ? 'is-changed' : undefined}>
                  <td className="mono">{r.id}</td>
                  {Object.values(r.cols).map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="cs-empty">No rows.</p>
        )}
      </section>
    </div>
  );
}

function SqlLog({ queries, title = 'SQL sent to the database (simplified)' }: { queries: string[]; title?: string }) {
  return (
    <div className="cs-console cs-sql" aria-label={title}>
      <div className="cs-console-head">{title}</div>
      {queries.length ? (
        <ol>
          {queries.map((q, i) => (
            <li key={i} className={i === queries.length - 1 ? 'is-new' : undefined}>
              <span className="cs-sql-n">{i + 1}</span>
              <code>{q}</code>
            </li>
          ))}
        </ol>
      ) : (
        <p className="cs-console-empty">No SQL yet.</p>
      )}
    </div>
  );
}

function Loading({ s }: { s: NpState }) {
  return (
    <div className="cs-np">
      <section className="cs-ef-box" aria-label="Objects in the app">
        <div className="cs-di-head">In the app</div>
        {s.parents.length ? (
          <ul className="cs-np-list">
            {s.parents.map((p, i) => (
              <li key={i} className={s.current === i ? 'is-now' : undefined}>
                <span className="mono">{p.label}</span>
                <span className={`cs-state is-${p.childrenLoaded ? 'settled' : 'idle'}`}>{p.childrenLoaded ? 'related rows loaded' : 'not loaded'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cs-empty">Nothing loaded yet.</p>
        )}
      </section>
      <div className="cs-np-trips" aria-live="off">
        <b>{s.queries.length}</b>
        <span>round trip{s.queries.length === 1 ? '' : 's'}</span>
        {s.lastResult && <em>last: {s.lastResult}</em>}
      </div>
    </div>
  );
}

export default function EfCoreVisualizer(props: EfCoreProps) {
  const scenario = toEfScenario(props.scenario);
  const [statePart, setStatePart] = useState<string>('insert');
  const [npId, setNpId] = useState<NpPartId>('per-user');
  const [n, setN] = useState<number>(NP_RANGE.default);
  const id = useId();
  const ef = useMemo(() => (scenario === 'change-tracker-states' ? efStatePart(statePart) : null), [scenario, statePart]);
  const np = useMemo(() => (scenario === 'n-plus-one' ? npPart(npId, n) : null), [scenario, npId, n]);
  const trace = (ef?.trace ?? np?.trace)!;
  const doc = (ef?.doc ?? np?.doc)!;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${scenario}:${statePart}:${npId}:${n}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const shownStep = p.awaitingPrediction && p.index > 0 ? trace[p.index - 1]! : step;

  if (ef) {
    const s = shownStep.state as EfState;
    return (
      <VizShell
        title="EF Core change tracker"
        label="EF Core change tracker visualizer"
        p={p}
        options={<PartPicker parts={[...EF_STATE_PARTS]} value={statePart} onChange={setStatePart} />}
        hint={ef.assumption}
        stage={
          <>
            <Tracker s={s} />
            <SqlLog queries={s.sql} />
            {statePart === 'insert' && <ConsoleOut lines={s.output} />}
          </>
        }
        doc={doc}
        line={step.codeLine}
        narration={step.narration}
        prediction={step.predict}
        vars={shownStep.variables}
        side={
          <>
            <Tally
              items={[
                ['Tracked entities', s.contextOpen ? s.entries.filter((e) => e.state !== 'Detached').length : 0],
                ['SQL commands', s.sql.length],
                ['Rows in table', s.rows.length],
              ]}
            />
            <CsLegend
              items={[
                { kind: 'idle', label: 'Detached: not tracked' },
                { kind: 'active', label: 'Added: will INSERT' },
                { kind: 'settled', label: 'Unchanged: matches the row' },
                { kind: 'compare', label: 'Modified: will UPDATE' },
                { kind: 'swap', label: 'Deleted: will DELETE' },
              ]}
            />
          </>
        }
      />
    );
  }

  const s = shownStep.state as NpState;
  return (
    <VizShell
      title="The N+1 query problem"
      label="EF Core N plus one query visualizer"
      p={p}
      options={
        <>
          <PartPicker parts={NP_PARTS} value={npId} onChange={(v) => setNpId(v as NpPartId)} />
          <label htmlFor={`${id}-n`}>
            {npId === 'lazy' ? 'Students' : 'Users'} <span className="mono">{n}</span>
            <input id={`${id}-n`} type="range" min={NP_RANGE.min} max={NP_RANGE.max} value={n} onChange={(e) => setN(Number(e.target.value))} />
          </label>
        </>
      }
      hint="Each SQL line is one round trip to the database. The SQL is simplified; EF Core writes the real command."
      stage={
        <>
          <Loading s={s} />
          <SqlLog queries={s.queries} />
        </>
      }
      doc={doc}
      line={step.codeLine}
      narration={step.narration}
      prediction={step.predict}
      vars={shownStep.variables}
      side={
        <>
          <Tally
            items={[
              ['Round trips', s.queries.length],
              [npId === 'lazy' ? 'Students' : 'Users', n],
              ['Loaded with related rows', s.parents.filter((x) => x.childrenLoaded).length],
            ]}
          />
          <CsLegend
            items={[
              { kind: 'settled', label: 'Related rows loaded' },
              { kind: 'idle', label: 'Not loaded yet' },
              { kind: 'active', label: 'Row the loop is on' },
            ]}
          />
        </>
      }
    />
  );
}
