import { MotionConfig } from 'motion/react';
import { Fragment, useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { highlightSql } from './highlight';
import { FLOW, LEVELS, type Level, type Provenance } from './traces/isolation-sql';
import { ANOMALIES, ANOMALY_COLUMN, ANOMALY_LABEL, EXPECTED_MATRIX, sessionNames, traceIsolation, type Anomaly, type IsoState, type Scenario, type Sess } from './traces/isolation';
import { Chips, Pick, SqlCounters, SqlPanel, VizTop } from './ui';

export interface IsolationSimulatorProps {
  scenario?: string;
  levels?: string[];
  predictMode?: boolean;
  placement?: string;
}

const PROV_MARK: Record<Provenance, string> = { block: '', text: 'note text', added: 'added' };
const BLOCKING_LEVELS: Level[] = ['READ COMMITTED', 'READ UNCOMMITTED', 'SNAPSHOT'];

function Stmt({ code, prov }: { code: string; prov: Provenance }) {
  return (
    <span className="iso-stmt">
      {code.split('\n').map((l, i) => (
        <Fragment key={i}>
          {i > 0 && '\n'}
          {highlightSql(l)}
        </Fragment>
      ))}
      {PROV_MARK[prov] && <span className="prov">({PROV_MARK[prov]})</span>}
    </span>
  );
}

function Timeline({ st, names }: { st: IsoState; names: Record<Sess, string> }) {
  const sess: Sess[] = ['A', 'B'];
  const hasNext = Boolean(st.next.A || st.next.B);
  return (
    <div className="iso-timeline" role="table" aria-label="Timeline: time flows down">
      <div className="h" role="columnheader">t</div>
      {sess.map((s) => (
        <div key={s} className="h" role="columnheader">{names[s]} <span className="muted">({st.levels[s]})</span></div>
      ))}
      {st.rows.map((r, i) => {
        const last = i === st.rows.length - 1 && !hasNext ? ' last' : '';
        return (
          <Fragment key={i}>
            <div className={`t${last}`} role="rowheader">{i + 1}</div>
            {sess.map((s) => {
              if (r.s !== s) {
                const waiting = r.waiting.includes(s);
                return <div key={s} className={`c${waiting ? ' is-wait' : ''}${last}`} role="cell">{waiting && <span className="iso-out"><span className="iso-badge wait">WAITING</span></span>}</div>;
              }
              const cls = ['c', i === st.current ? 'is-current' : '', r.kind === 'wait' ? 'is-wait' : '', r.kind === 'error' ? 'is-victim' : ''].filter(Boolean).join(' ');
              return (
                <div key={s} className={cls + last} role="cell" aria-current={i === st.current ? 'step' : undefined}>
                  <Stmt code={r.code} prov={r.prov} />
                  <span className="iso-out">
                    {r.kind === 'wait' && <span className="iso-badge wait">WAITS</span>}
                    {r.kind === 'resume' && <span className="iso-badge ok">RESUMES</span>}
                    {r.kind === 'error' && <span className="iso-badge err">DEADLOCK VICTIM</span>}
                    {r.out}
                  </span>
                </div>
              );
            })}
          </Fragment>
        );
      })}
      {hasNext && (
        <>
          <div className="t last" role="rowheader">next</div>
          {sess.map((s) => {
            const n = st.next[s];
            const cls = ['c', 'last', st.upNext === s ? 'is-current' : n?.waiting ? 'is-wait' : 'is-future'].join(' ');
            return (
              <div key={s} className={cls} role="cell">
                {n?.waiting ? <span className="iso-out"><span className="iso-badge wait">STILL WAITING</span></span> : n ? <Stmt code={n.code} prov={n.prov} /> : <span className="muted">—</span>}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function DataBox({ st, names }: { st: IsoState; names: Record<Sess, string> }) {
  return (
    <div className="iso-box iso-data">
      <h4>{st.orders ? 'Orders' : 'Accounts'}</h4>
      {st.orders ? (
        <table>
          <thead><tr><th>Id</th><th>CustomerId</th><th>Amount</th><th>State</th></tr></thead>
          <tbody>
            {st.orders.map((r) => (
              <tr key={r.Id}><td>{r.Id}</td><td>{r.CustomerId}</td><td>{r.Amount}</td><td>{r.pendingBy ? `uncommitted (${names[r.pendingBy]})` : 'committed'}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table>
          <thead><tr><th>Id</th><th>Committed</th><th>Uncommitted</th></tr></thead>
          <tbody>
            {st.accounts.map((a) => (
              <tr key={a.id}><td>{a.id}</td><td>{a.committed}</td><td>{a.pending ? `${a.pending.value} (${names[a.pending.by]})` : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LocksBox({ st, names }: { st: IsoState; names: Record<Sess, string> }) {
  return (
    <div className="iso-box iso-locks">
      <h4>Locks</h4>
      {st.locks.length === 0 ? (
        <p className="none">No locks held</p>
      ) : (
        <table>
          <thead><tr><th>Resource</th><th>Mode</th><th>Session</th><th>Status</th></tr></thead>
          <tbody>
            {st.locks.map((l, i) => (
              <tr key={i} className={l.waiting ? 'is-wait' : undefined}><td>{l.res}</td><td>{l.mode}</td><td>{names[l.s]}</td><td>{l.waiting ? 'waiting' : 'granted'}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Wait-for graph: an arrow from each waiting session to the session it waits for. */
function WaitGraph({ st, names }: { st: IsoState; names: Record<Sess, string> }) {
  const pos: Record<Sess, number> = { A: 60, B: 260 };
  const ab = st.waits.find((w) => w.from === 'A');
  const ba = st.waits.find((w) => w.from === 'B');
  const label = st.cycle ? 'Cycle: a deadlock' : st.waits.length ? 'Waiting, no cycle' : 'Nobody is waiting';
  return (
    <div className="iso-box">
      <h4>Who waits for whom</h4>
      <svg className="iso-graph" viewBox="0 0 320 120" role="img" aria-label={`${label}. ${st.waits.map((w) => `${names[w.from]} waits for ${names[w.to]} (${w.res})`).join('. ')}`}>
        <defs>
          <marker id="iso-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" /></marker>
          <marker id="iso-arrow-c" className="cyc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" /></marker>
        </defs>
        {ab && <path className={`edge${st.cycle ? ' is-cycle' : ''}`} d={`M${pos.A + 34} 44 Q160 4 ${pos.B - 36} 44`} markerEnd={`url(#iso-arrow${st.cycle ? '-c' : ''})`} />}
        {ab && <text className="elabel" x="160" y="18" textAnchor="middle">{ab.res}</text>}
        {ba && <path className={`edge${st.cycle ? ' is-cycle' : ''}`} d={`M${pos.B - 34} 76 Q160 116 ${pos.A + 36} 76`} markerEnd={`url(#iso-arrow${st.cycle ? '-c' : ''})`} />}
        {ba && <text className="elabel" x="160" y="114" textAnchor="middle">{ba.res}</text>}
        {(['A', 'B'] as Sess[]).map((s) => (
          <g key={s} className={`node${st.victim === s ? ' is-victim' : ''}`} transform={`translate(${pos[s]},60)`}>
            <rect x="-34" y="-16" width="68" height="32" rx="8" />
            <text textAnchor="middle" dy="0.35em">{names[s].replace('Session ', 'S')}</text>
          </g>
        ))}
      </svg>
      <p className="muted" style={{ fontSize: 12.5, margin: 0, textAlign: 'center' }}>{label}</p>
    </div>
  );
}

function Matrix({ levels, level, anomaly, onPick }: { levels: Level[]; level: Level; anomaly: Anomaly; onPick: (l: Level, a: Anomaly) => void }) {
  return (
    <div className="iso-matrix-wrap">
      <div className="iso-matrix">
        <table>
          <caption>The note's table. Pick a cell to act it out.</caption>
          <thead>
            <tr>
              <th scope="col">Isolation Level</th>
              {ANOMALIES.map((a) => (
                <th key={a} scope="col">{ANOMALY_COLUMN[a]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l}>
                <th scope="row">{l}</th>
                {ANOMALIES.map((a) => {
                  const yes = EXPECTED_MATRIX[l][a];
                  return (
                    <td key={a} className={yes ? 'is-yes' : 'is-no'}>
                      <button type="button" aria-pressed={l === level && a === anomaly} aria-label={`${l}, ${ANOMALY_LABEL[a]}: ${yes ? 'Yes' : 'No'}`} onClick={() => onPick(l, a)}>
                        {yes ? 'Yes' : 'No'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function IsolationSimulator(props: IsolationSimulatorProps) {
  const mode = (['anomalies', 'isolation-levels', 'blocking', 'deadlock'] as const).find((m) => m === props.scenario) ?? 'anomalies';
  const levels = useMemo(() => {
    const ls = (props.levels ?? []).filter((l): l is Level => (LEVELS as string[]).includes(l));
    return ls.length ? ls : LEVELS;
  }, [props.levels]);
  const [anomaly, setAnomaly] = useState<Anomaly>('dirty');
  const [level, setLevel] = useState<Level>(mode === 'isolation-levels' && levels.includes('READ COMMITTED') ? 'READ COMMITTED' : levels[0]!);
  const [ending, setEnding] = useState<'commit' | 'rollback'>(mode === 'blocking' ? 'commit' : 'rollback');
  const [blockLevel, setBlockLevel] = useState<Level>('READ COMMITTED');
  const [victim, setVictim] = useState<Sess>('B');
  const [sameOrder, setSameOrder] = useState(false);

  const scenario: Scenario = mode === 'blocking' ? 'blocking' : mode === 'deadlock' ? 'deadlock' : anomaly;
  const opts = mode === 'blocking' ? { scenario, level: blockLevel, ending } : mode === 'deadlock' ? { scenario, victim, sameOrder } : { scenario, level, ending };
  const key = JSON.stringify(opts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => traceIsolation(opts), [key]);
  const trace = result.steps;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), key, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const st = step.state;
  const names = sessionNames(scenario);
  const title = mode === 'blocking' ? 'Blocking' : mode === 'deadlock' ? 'Deadlock' : `${ANOMALY_LABEL[anomaly]} under ${level}`;
  const isAnomaly = mode === 'anomalies' || mode === 'isolation-levels';
  const expected = isAnomaly ? EXPECTED_MATRIX[level][anomaly] : null;

  const flowBlocks = mode === 'blocking' ? [{ code: FLOW.blocking.code, plain: true }] : [{ code: FLOW.deadlockRows.code, plain: true }, { code: FLOW.deadlockSessions.code, plain: true }, { code: FLOW.deadlockError.code, plain: true }];
  const flowActive = st.flow ? { block: st.flow[0], lines: [st.flow[1]] } : { block: 0, lines: [] };

  return (
    <MotionConfig reducedMotion="user">
      <div className="viz" role="region" aria-label={`${title} simulator`} onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
        <VizTop title={title} />
        <div className="viz-input">
          {isAnomaly && (
            <>
              <Chips label="Anomaly" value={anomaly} onChange={setAnomaly} options={ANOMALIES.map((a) => ({ id: a, label: ANOMALY_LABEL[a] }))} />
              <Pick label={anomaly === 'dirty' ? `${names.B}'s level` : `${names.A}'s level`} value={level} onChange={setLevel} options={levels.map((l) => ({ id: l, label: l }))} />
              {anomaly === 'dirty' && <Chips label={`${names.A} ends with`} value={ending} onChange={setEnding} options={[{ id: 'rollback', label: 'ROLLBACK' }, { id: 'commit', label: 'COMMIT' }]} />}
            </>
          )}
          {mode === 'blocking' && (
            <>
              <Pick label={`${names.B}'s level`} value={blockLevel} onChange={setBlockLevel} options={BLOCKING_LEVELS.map((l) => ({ id: l, label: l === 'READ COMMITTED' ? 'READ COMMITTED (default)' : l }))} />
              <Chips label={`${names.A} ends with`} value={ending} onChange={setEnding} options={[{ id: 'commit', label: 'COMMIT' }, { id: 'rollback', label: 'ROLLBACK' }]} />
            </>
          )}
          {mode === 'deadlock' && (
            <>
              <Chips label="Update order" value={sameOrder ? 'same' : 'note'} onChange={(v) => setSameOrder(v === 'same')} options={[{ id: 'note', label: "Opposite (the note's example)" }, { id: 'same', label: 'Same order (prevention tip 1)' }]} />
              {!sameOrder && <Chips label="Victim" value={victim} onChange={setVictim} options={[{ id: 'A', label: names.A }, { id: 'B', label: names.B }]} />}
            </>
          )}
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
        </div>
        <p className="viz-hint">
          Time flows down. Statements marked (added) are not in the note's SQL; they act out what the note describes.
          {mode === 'deadlock' && !sameOrder && ' Both sessions have done the same amount of work, so SQL Server could pick either as the victim; choose one above.'}
        </p>
        <div className="viz-stage">
          <Timeline st={st} names={names} />
          <div className="iso-side">
            <DataBox st={st} names={names} />
            <LocksBox st={st} names={names} />
            {(mode === 'blocking' || mode === 'deadlock') && <WaitGraph st={st} names={names} />}
          </div>
        </div>
        {st.outcome && (
          <p className={`iso-outcome ${st.outcome.happened ? 'happened' : 'prevented'}`} role="status">
            {st.outcome.text}
            {expected !== null && ` The note's table says ${ANOMALY_COLUMN[anomaly]} under ${level}: ${expected ? 'Yes' : 'No'}.`}
          </p>
        )}
        <Controls p={p} label={title} />
        <div className="viz-panels">
          {isAnomaly ? (
            <div className="viz-code sql-code iso-matrix-panel" style={{ padding: 10 }}>
              <Matrix
                levels={levels}
                level={level}
                anomaly={anomaly}
                onPick={(l, a) => {
                  setLevel(l);
                  setAnomaly(a);
                }}
              />
            </div>
          ) : (
            <SqlPanel title="The note's diagram" blocks={flowBlocks} active={flowActive} />
          )}
          <div className="viz-side">
            <Narration text={step.narration} prediction={step.predict} p={p} />
            <Variables vars={step.variables} />
            <SqlCounters
              items={[
                ['Statements run', step.counters.writes],
                ['Lock waits', step.counters.comparisons],
                ...(mode === 'deadlock' ? ([['Deadlocks', step.counters.swaps]] as [string, number][]) : []),
              ]}
            />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
