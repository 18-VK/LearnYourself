import { useMemo, useState } from 'react';
import { usePlayer } from '../engine/usePlayer';
import { ConsoleOut, CsLegend, PartPicker, Tally, VizShell } from './shared/panels';
import { captivePart, LIFETIMES, lifetimesPart, scopeFactoryPart, toDiScenario, type DiInstance, type DiState, type Lifetime } from './traces/di-lifetimes';

export interface DiLifetimesProps {
  /** lifetimes | captive-dependency */
  scenario?: string;
  lifetime?: string;
  predictMode?: boolean;
  placement?: string;
}

function Chip({ x, s }: { x: DiInstance; s: DiState }) {
  const cls = s.created.includes(x.name) ? ' is-swap' : s.reused.includes(x.name) ? ' is-compare' : '';
  return (
    <span className={`cs-di-chip${cls}${x.disposed ? ' is-disposed' : ''}`} title={x.disposed ? `${x.name} (disposed or released)` : x.name}>
      {x.name}
    </span>
  );
}

function Container({ s }: { s: DiState }) {
  const root = s.instances.filter((x) => x.owner === 'root');
  return (
    <div className="cs-di">
      <section className="cs-di-box is-root" aria-label="Root container">
        <div className="cs-di-head">Root container <span className="muted">lives as long as the app</span></div>
        <div className="cs-di-chips">{root.length ? root.map((x) => <Chip key={x.name} x={x} s={s} />) : <span className="cs-empty">nothing yet</span>}</div>
      </section>
      {s.scopes.map((sc) => {
        const own = s.instances.filter((x) => x.owner === sc.id);
        return (
          <section key={sc.id} className={`cs-di-box${sc.ended ? ' is-ended' : ''}`} aria-label={sc.label}>
            <div className="cs-di-head">
              {sc.label} <span className="muted">{sc.ended ? 'ended' : 'scope open'}</span>
            </div>
            <div className="cs-di-chips">{own.length ? own.map((x) => <Chip key={x.name} x={x} s={s} />) : <span className="cs-empty">nothing created in this scope</span>}</div>
            {sc.graph.length > 0 && (
              <ul className="cs-di-graph">
                {sc.graph.map((g, i) => (
                  <li key={i}>
                    <span className="mono">{g.holder}{g.field ? `.${g.field}` : ''}</span> → <b className="mono">{g.target}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function DiLifetimesVisualizer(props: DiLifetimesProps) {
  const scenario = toDiScenario(props.scenario);
  const [lifetime, setLifetime] = useState<Lifetime>(() => (LIFETIMES.includes(props.lifetime as Lifetime) ? (props.lifetime as Lifetime) : 'Scoped'));
  const [captiveView, setCaptiveView] = useState<'captive' | 'fix'>('captive');
  const [validate, setValidate] = useState<'off' | 'on'>('off');
  const part = useMemo(() => {
    if (scenario === 'lifetimes') return lifetimesPart(lifetime);
    return captiveView === 'fix' ? scopeFactoryPart() : captivePart(validate === 'on');
  }, [scenario, lifetime, captiveView, validate]);
  const trace = part.trace;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${scenario}:${lifetime}:${captiveView}:${validate}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const shownStep = p.awaitingPrediction && p.index > 0 ? trace[p.index - 1]! : step;
  const s = shownStep.state;

  return (
    <VizShell
      title={scenario === 'lifetimes' ? 'DI lifetimes: who gets which instance' : 'The captive dependency trap'}
      label={scenario === 'lifetimes' ? 'Dependency injection lifetimes visualizer' : 'Captive dependency visualizer'}
      p={p}
      options={
        scenario === 'lifetimes' ? (
          <PartPicker parts={LIFETIMES.map((l) => ({ id: l, label: l }))} value={lifetime} onChange={(v) => setLifetime(v as Lifetime)} label="ICounter is" />
        ) : (
          <>
            <PartPicker
              parts={[
                { id: 'captive', label: 'Captive dependency' },
                { id: 'fix', label: 'Fix: IServiceScopeFactory' },
              ]}
              value={captiveView}
              onChange={(v) => setCaptiveView(v as 'captive' | 'fix')}
            />
            {captiveView === 'captive' && (
              <PartPicker
                parts={[
                  { id: 'off', label: 'No scope validation' },
                  { id: 'on', label: 'Development (validation on)' },
                ]}
                value={validate}
                onChange={(v) => setValidate(v as 'off' | 'on')}
                label="Run with"
              />
            )}
          </>
        )
      }
      hint={
        scenario === 'lifetimes'
          ? 'Two requests to GET /test, as in the note. Chips show every object the container builds; a request’s objects are let go when its scope ends.'
          : 'A singleton is built once, by the root container, and keeps whatever it was given.'
      }
      stage={
        <>
          {s.error && (
            <p className="cs-error" role="status">
              {s.error}
            </p>
          )}
          <Container s={s} />
          {scenario === 'lifetimes' && <ConsoleOut lines={s.output} title="What GET /test returns (as the note writes it)" empty="No request has finished yet." />}
        </>
      }
      doc={part.doc}
      line={step.codeLine}
      narration={step.narration}
      prediction={step.predict}
      vars={shownStep.variables}
      side={
        <>
          <Tally
            items={[
              [scenario === 'lifetimes' ? 'Counters built' : 'Scoped objects built', s.constructed],
              ['Scopes', s.scopes.length],
              ['Open scopes', s.scopes.filter((x) => !x.ended).length],
            ]}
          />
          <CsLegend
            items={[
              { kind: 'swap', label: 'Built in this step' },
              { kind: 'compare', label: 'Reused in this step' },
              { kind: 'orphan', label: 'Let go with its scope' },
            ]}
          />
        </>
      }
    />
  );
}
