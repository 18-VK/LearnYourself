import { MotionConfig } from 'motion/react';
import { useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { SUBQUERY_EMPLOYEES } from './notes';
import { COVER_BLOCKS, COVER_MODES, SEEK_BLOCKS, traceCovering, traceSeekScan, traceWriteCost, WRITE_BLOCKS, WRITE_OPS, type CoverMode, type PageView, type SeekQuery, type TreeView, type WriteOp } from './traces/indexes';
import { Chips, markClass, Pick, SqlCounters, SqlLegend, SqlPanel, Tables, VizTop } from './ui';

export interface IndexVisualizerProps {
  scenario?: string;
  predictMode?: boolean;
  placement?: string;
}

type Scenario = 'clustered-vs-nonclustered-covering' | 'seek-scan-lookup' | 'write-cost';
const SCENARIOS: Scenario[] = ['clustered-vs-nonclustered-covering', 'seek-scan-lookup', 'write-cost'];
const CUSTOMER_VALUES = ['123', '1', '2', '4'];

function Page({ p }: { p: PageView }) {
  return (
    <div className={`bt-page ${markClass(p.mark)}`}>
      <span className="pg">{p.label}</span>
      {p.entries.length === 0 && <span className="en muted">empty</span>}
      {p.entries.map((e, i) => (
        <span key={i} className={`en ${markClass(e.mark)}`} title={e.inc ? `${e.text} · ${e.inc}` : e.text}>
          {e.text}
          {e.inc && <span className="inc"> · {e.inc}</span>}
        </span>
      ))}
    </div>
  );
}

/** A two-level B+ tree: the root page and its leaf pages, with the followed pointers highlighted. */
function BTree({ t }: { t: TreeView }) {
  const n = t.leaves.length;
  return (
    <section className="bt" aria-label={`${t.title}: root page and ${n} leaf pages`}>
      <h4>
        {t.title}
        <small>{t.subtitle}</small>
      </h4>
      <div className="bt-scroll">
        <div style={{ minWidth: n * 108 }}>
          <div className="bt-level">
            <Page p={t.root} />
          </div>
          <svg className="bt-lines" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
            {t.leaves.map((_, i) => (
              <line key={i} x1={50} y1={0} x2={((i + 0.5) / n) * 100} y2={22} className={t.path.includes(i) ? 'is-active' : undefined} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="bt-level">
            {t.leaves.map((p) => (
              <Page key={p.id} p={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function IndexVisualizer(props: IndexVisualizerProps) {
  const scenario: Scenario = (SCENARIOS as string[]).includes(props.scenario ?? '') ? (props.scenario as Scenario) : 'clustered-vs-nonclustered-covering';
  const [mode, setMode] = useState<CoverMode>('nci');
  const [name, setName] = useState('Aman');
  const [query, setQuery] = useState<SeekQuery>('seek');
  const [cid, setCid] = useState('123');
  const [op, setOp] = useState<WriteOp>('insert-seq');
  const [ncis, setNcis] = useState(5);

  const trace = useMemo(() => {
    if (scenario === 'write-cost') return traceWriteCost(op, ncis);
    if (scenario === 'seek-scan-lookup') return traceSeekScan(query, Number(cid));
    return traceCovering(mode, name);
  }, [scenario, op, ncis, query, cid, mode, name]);
  const key = `${scenario}:${mode}:${name}:${query}:${cid}:${op}:${ncis}`;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), key, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const st = step.state;

  const title = scenario === 'write-cost' ? 'The cost of writes' : scenario === 'seek-scan-lookup' ? 'Index seek, scan and key lookup' : 'Clustered, non-clustered and covering indexes';
  const blocks =
    scenario === 'write-cost'
      ? [{ code: WRITE_BLOCKS[0]!, plain: true, label: "The note's example" }, { code: WRITE_BLOCKS[1]! }]
      : scenario === 'seek-scan-lookup'
        ? [{ code: SEEK_BLOCKS[0]! }, { code: SEEK_BLOCKS[1]! }]
        : [{ code: COVER_BLOCKS[0]! }, { code: COVER_BLOCKS[1]!, faded: mode === 'scan' ? [1, 2, 3] : mode === 'nci' ? [3] : [] }];

  return (
    <MotionConfig reducedMotion="user">
      <div className="viz" role="region" aria-label={`${title} visualizer`} onPointerDown={p.claimKeyboard} onFocus={p.claimKeyboard}>
        <VizTop title={title} />
        <div className="viz-input">
          {scenario === 'clustered-vs-nonclustered-covering' && (
            <>
              <Chips label="Indexes" value={mode} onChange={setMode} options={COVER_MODES} />
              <Pick label="WHERE Name =" value={name} onChange={setName} options={SUBQUERY_EMPLOYEES.map((e) => ({ id: e.Name, label: `'${e.Name}'` }))} />
            </>
          )}
          {scenario === 'seek-scan-lookup' && (
            <>
              <Chips label="Query" value={query} onChange={setQuery} options={[{ id: 'seek', label: 'WHERE CustomerId = …' }, { id: 'scan', label: 'WHERE Amount > 0' }]} />
              {query === 'seek' && <Pick label="CustomerId" value={cid} onChange={setCid} options={CUSTOMER_VALUES.map((v) => ({ id: v, label: v }))} />}
            </>
          )}
          {scenario === 'write-cost' && (
            <>
              <Chips label="Statement" value={op} onChange={setOp} options={WRITE_OPS} />
              <label>
                Non-clustered indexes <span className="mono">{ncis}</span>
                <input type="range" min={0} max={5} value={ncis} onChange={(e) => setNcis(Number(e.target.value))} />
              </label>
            </>
          )}
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
        </div>
        <p className="viz-hint">
          {scenario === 'clustered-vs-nonclustered-covering' && "Rows: the Employees sample table from the subqueries lesson, used for the note's Employee query. "}
          {scenario === 'seek-scan-lookup' && "Rows: the Orders sample data from the joins lesson (clustered on OrderId, its primary key), with the note's IX_Orders_CustomerID. "}
          {scenario === 'write-cost' && "Rows: the Orders sample data from the joins lesson. "}
          Each page holds two rows here so the tree has more than one page.
          {scenario === 'clustered-vs-nonclustered-covering' && name !== 'Aman' && ` Searching for '${name}' instead of the note's 'Aman'.`}
          {scenario === 'seek-scan-lookup' && query === 'seek' && cid !== '123' && ` Searching for CustomerId = ${cid} instead of the note's 123.`}
        </p>
        <div className="viz-stage">
          <div className="bt-wrap">
            {st.trees.map((t) => (
              <BTree key={t.id} t={t} />
            ))}
          </div>
          {st.ncis && (
            <div className="bt-ncis" aria-label="Non-clustered indexes">
              {st.ncis.length === 0 && <span className="muted">No non-clustered indexes</span>}
              {st.ncis.map((x) => (
                <span key={x.name} className={`bt-nci ${markClass(x.mark)}`}>
                  {x.name}
                  {x.mark === 'write' ? ' (updating)' : x.mark === 'settled' ? ' ✓' : ''}
                </span>
              ))}
            </div>
          )}
          {st.tables.length > 0 && <Tables tables={st.tables} compact />}
        </div>
        <Controls p={p} label={title} />
        <div className="viz-panels">
          <SqlPanel blocks={blocks} active={st.code} />
          <div className="viz-side">
            <Narration text={step.narration} prediction={step.predict} p={p} />
            <Variables vars={step.variables} />
            <SqlCounters
              items={
                scenario === 'write-cost'
                  ? [
                      ['Pages read', step.counters.reads],
                      ['Structures changed', step.counters.writes],
                    ]
                  : [
                      ['Pages read', step.counters.reads],
                      ['Keys or rows checked', step.counters.comparisons],
                      ['Key lookups', step.counters.swaps],
                    ]
              }
            />
            <SqlLegend items={['active', 'compare', 'settled', 'write']} labels={{ active: 'Page being read', compare: 'Key or row checked', settled: 'Match found', write: 'Written' }} />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
