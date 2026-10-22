import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../engine/usePlayer';
import { ConsoleOut, CsLegend, PartPicker, Tally, VizShell } from './shared/panels';
import {
  completeSchedule,
  THREADS,
  TI_INCREMENTS,
  TI_PRESETS,
  TI_SCENARIOS,
  tiRun,
  toTiScenario,
  usesCounter,
  type ThreadId,
  type TiState,
  type TiVariant,
} from './traces/interleaving';

export interface ThreadInterleavingProps {
  /** race-count-increment | deadlock-lock-order */
  scenario?: string;
  /** Offer the lock (and Interlocked) fixes next to the race. */
  showLockFix?: boolean;
  predictMode?: boolean;
  placement?: string;
}

/** Wait-for graph: locks point at their owner ("held by"), blocked threads point at the lock they want. */
function WaitForGraph({ s }: { s: TiState }) {
  const pos: Record<string, [number, number]> = { T1: [52, 30], T2: [248, 30], lockA: [52, 112], lockB: [248, 112] };
  if (s.locks.length === 1) {
    pos.sync = [150, 112];
  }
  const edges: { from: string; to: string; kind: 'holds' | 'waits' }[] = [];
  for (const l of s.locks) if (l.owner) edges.push({ from: l.name, to: l.owner, kind: 'holds' });
  for (const t of s.threads) if (t.waitsFor && t.status === 'blocked') edges.push({ from: t.id, to: t.waitsFor, kind: 'waits' });
  const line = (a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const r = 24;
    return { x1: a[0] + (dx / len) * r, y1: a[1] + (dy / len) * r, x2: b[0] - (dx / len) * (r + 4), y2: b[1] - (dy / len) * (r + 4) };
  };
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <figure className="cs-wfg">
      <svg viewBox="0 0 300 145" role="img" aria-label={`Wait-for graph. ${edges.map((e) => (e.kind === 'holds' ? `${e.to} holds ${e.from}` : `${e.from} waits for ${e.to}`)).join('. ') || 'No locks held.'}${s.deadlock ? ' The arrows form a cycle: deadlock.' : ''}`}>
        <defs>
          <marker id={`wh-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="cs-wfg-head" />
          </marker>
          <marker id={`ww-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="cs-wfg-head-wait" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = pos[e.from];
          const b = pos[e.to];
          if (!a || !b) return null;
          const l = line(a, b);
          return <line key={i} {...l} className={`cs-wfg-edge is-${e.kind}${s.deadlock ? ' is-cycle' : ''}`} markerEnd={`url(#${e.kind === 'holds' ? 'wh' : 'ww'}-${id})`} />;
        })}
        {s.threads.map((t) => (
          <g key={t.id} className={`cs-wfg-node is-thread is-${t.status}${s.ran === t.id ? ' is-ran' : ''}`} transform={`translate(${pos[t.id]![0]},${pos[t.id]![1]})`}>
            <circle r="22" />
            <text dy="5">{t.id}</text>
          </g>
        ))}
        {s.locks.map((l) => (
          <g key={l.name} className={`cs-wfg-node is-lock${l.owner ? ' is-held' : ''}`} transform={`translate(${pos[l.name]![0]},${pos[l.name]![1]})`}>
            <rect x="-30" y="-15" width="60" height="30" rx="7" />
            <text dy="4">{l.name}</text>
          </g>
        ))}
      </svg>
      <figcaption>
        <span className="cs-wfg-key is-holds">lock → thread: held by</span> <span className="cs-wfg-key is-waits">thread → lock: waits for</span>
      </figcaption>
    </figure>
  );
}

export default function ThreadInterleavingVisualizer(props: ThreadInterleavingProps) {
  const scenario = toTiScenario(props.scenario);
  const def = TI_SCENARIOS[scenario];
  const parts = scenario === 'race-count-increment' && props.showLockFix === false ? def.parts.slice(0, 1) : def.parts;
  const [variant, setVariant] = useState<TiVariant>(parts[0]!.id);
  const [n, setN] = useState<number>(TI_INCREMENTS.default);
  const [schedule, setSchedule] = useState<ThreadId[]>(() => TI_PRESETS[parts[0]!.id][0]!.schedule(TI_INCREMENTS.default));
  const [preset, setPreset] = useState<string | null>('turns');
  const run = useMemo(() => tiRun(variant, schedule, n), [variant, schedule, n]);
  const trace = run.trace;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${variant}:${n}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const shownStep = p.awaitingPrediction && p.index > 0 ? trace[p.index - 1]! : step;
  const s = shownStep.state;
  const counter = usesCounter(variant);
  const idPrefix = useId();

  // after a scheduling choice, jump to the newly recorded step
  const pendingSeek = useRef<number | null>(null);
  useEffect(() => {
    if (pendingSeek.current !== null) {
      p.seek(Math.min(pendingSeek.current, trace.length - 1));
      pendingSeek.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace]);

  const applyPreset = (v: TiVariant, id: string, count = n) => {
    const pr = TI_PRESETS[v].find((x) => x.id === id) ?? TI_PRESETS[v][0]!;
    setSchedule(pr.schedule(count));
    setPreset(pr.id);
    p.reset();
  };
  const changeVariant = (v: TiVariant) => {
    setVariant(v);
    applyPreset(v, 'turns');
  };
  const choose = (t: ThreadId) => {
    // branch from the step on screen: keep the choices up to here, then add this one
    const keep = schedule.slice(0, step.state.schedLen);
    setSchedule([...keep, t]);
    setPreset(null);
    pendingSeek.current = p.index + 1;
  };
  const finish = () => {
    setSchedule(completeSchedule(variant, schedule.slice(0, step.state.schedLen), n));
    setPreset(null);
    pendingSeek.current = p.index + 1;
  };

  const histBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = histBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [p.index, trace]);

  const atEnd = p.index >= trace.length - 1;
  const halted = step.state.deadlock || step.state.finished;
  const history = trace.slice(1, p.index + 1).filter((x) => x.state.ran);

  return (
    <VizShell
      title={def.title}
      label={`${def.title} visualizer`}
      p={p}
      options={
        <>
          <PartPicker parts={parts} value={variant} onChange={(v) => changeVariant(v as TiVariant)} />
          {counter && (
            <label htmlFor={`${idPrefix}-n`}>
              Increments per thread <span className="mono">{n}</span>
              <input
                id={`${idPrefix}-n`}
                type="range"
                min={TI_INCREMENTS.min}
                max={TI_INCREMENTS.max}
                value={n}
                onChange={(e) => {
                  const k = Number(e.target.value);
                  setN(k);
                  applyPreset(variant, preset ?? 'turns', k);
                }}
              />
            </label>
          )}
        </>
      }
      hint={
        counter
          ? 'Simplified: two threads and a few increments instead of the note’s 10 threads × 100_000. counter++ is drawn as its three machine steps: load into a register, add 1, store.'
          : 'Simplified: Thread.Sleep(100) is one step. Each thread runs one step whenever you pick it.'
      }
      stage={
        <>
          <div className="cs-sched" role="group" aria-label="Scheduler">
            <span className="cs-sched-label">{halted ? (step.state.deadlock ? 'Deadlocked: no thread can run.' : 'Both threads finished.') : 'You are the scheduler. Run next:'}</span>
            {THREADS.map((t) => {
              const th = step.state.threads.find((x) => x.id === t)!;
              const can = !halted && th.status === 'ready';
              return (
                <button key={t} type="button" className={`btn cs-run cs-run-${t}`} disabled={!can || p.awaitingPrediction} onClick={() => choose(t)}>
                  <b>{t}</b> <span>{th.status === 'ready' ? `▸ ${th.next}` : th.next}</span>
                </button>
              );
            })}
            <div className="presets" role="group" aria-label="Ready-made schedules">
              {TI_PRESETS[variant].map((pr) => (
                <button key={pr.id} type="button" className="chipbtn" aria-pressed={preset === pr.id} onClick={() => applyPreset(variant, pr.id)}>
                  {pr.label}
                </button>
              ))}
              {!run.complete && atEnd && (
                <button type="button" className="chipbtn" onClick={finish}>
                  Finish by taking turns
                </button>
              )}
            </div>
          </div>

          <div className="cs-ti">
            {s.threads.map((t) => (
              <div key={t.id} className={`cs-thread is-${t.status}${s.ran === t.id ? ' is-ran' : ''}`}>
                <div className="cs-thread-head">
                  <b>{t.id}</b>
                  <span className={`cs-badge is-${t.status}`}>{t.status === 'blocked' ? `blocked on ${t.waitsFor}` : t.status}</span>
                </div>
                {counter && variant !== 'interlocked' && (
                  <div className="cs-reg">
                    register <span className="mono">{t.reg === null ? '—' : t.reg}</span>
                  </div>
                )}
                {!counter && <div className="cs-reg">holds <span className="mono">{t.holds.length ? t.holds.join(', ') : 'nothing'}</span></div>}
                {t.status === 'ready' && <div className="cs-thread-next">next: {t.next}</div>}
              </div>
            ))}
            {counter ? (
              <div className={`cs-shared${s.overwrote ? ' is-lost' : s.ran ? '' : ''}`}>
                <span className="cs-shared-name">counter</span>
                <span className="cs-shared-val">{s.counter}</span>
                <span className="cs-shared-sub">shared memory</span>
              </div>
            ) : (
              <WaitForGraph s={s} />
            )}
            {counter && s.locks.length > 0 && (
              <div className={`cs-lockcard${s.locks[0]!.owner ? ' is-held' : ''}`}>
                lock <b className="mono">sync</b>: {s.locks[0]!.owner ? `held by ${s.locks[0]!.owner}` : 'free'}
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="cs-hist-wrap" ref={histBox}>
              <table className="cs-hist">
                <caption>Interleaving so far</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">T1</th>
                    <th scope="col">T2</th>
                    {counter && <th scope="col">counter</th>}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => {
                    const text = h.narration.split('. ')[0]!.replace(/^T[12] /, '').replace(/\.$/, '');
                    return (
                      <tr key={i} className={h.state.overwrote ? 'is-lost' : h === step ? 'is-now' : undefined}>
                        <td className="mono">{i + 1}</td>
                        <td>{h.state.ran === 'T1' ? text : ''}</td>
                        <td>{h.state.ran === 'T2' ? text : ''}</td>
                        {counter && <td className="mono">{h.state.counter}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {variant === 'deadlock' && <ConsoleOut lines={s.output} />}
        </>
      }
      doc={run.doc}
      line={step.codeLine}
      also={step.state.also}
      narration={step.narration}
      prediction={step.predict}
      vars={shownStep.variables}
      side={
        <>
          {counter ? (
            <Tally
              items={[
                ['counter', s.counter ?? 0],
                ['Increments done', s.threads.reduce((k, t) => k + t.increments, 0)],
                ['Updates lost', s.lost],
              ]}
            />
          ) : (
            <Tally
              items={[
                ['Locks held', s.locks.filter((l) => l.owner).length],
                ['Threads blocked', s.threads.filter((t) => t.status === 'blocked').length],
                ['Deadlock', s.deadlock ? 'yes' : 'no'],
              ]}
            />
          )}
          <CsLegend
            items={[
              { kind: 'active', label: 'Thread that just ran' },
              { kind: 'blocked', label: 'Blocked' },
              { kind: 'settled', label: 'Finished' },
              ...(counter ? [{ kind: 'lost', label: 'Store that lost an update' }] : [{ kind: 'swap', label: 'Cycle in the wait-for graph' }]),
            ]}
          />
        </>
      }
    />
  );
}
