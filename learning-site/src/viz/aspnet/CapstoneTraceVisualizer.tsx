import { useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { CAP_SCENARIOS, LAYERS, SNIPPETS, traceCapstone, type CapScenario, type Layer } from './capstone/trace';
import { AspLegend, ChipGroup, SourcePanel, StatusPill, VizShell } from './common/ui';

export interface CapstoneTraceProps {
  path?: string[];
  predictMode?: boolean;
  placement?: string;
}

export default function CapstoneTraceVisualizer(props: CapstoneTraceProps) {
  const ids = LAYERS.map((l) => l.id) as string[];
  const path = (props.path ?? ids).filter((x): x is Layer => ids.includes(x));
  const [scenario, setScenario] = useState<CapScenario>('created');
  const trace = useMemo(() => traceCapstone(scenario, path), [scenario, path.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), scenario, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;
  const snip = SNIPPETS[s.snippet];
  const shown = LAYERS.filter((l) => path.includes(l.id));
  const visited = new Set(trace.slice(0, p.index + 1).map((t) => t.state.layer));
  return (
    <VizShell title="One request through the Task Management API" label="Capstone request trace visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input">
        <ChipGroup label="Request" value={scenario} options={CAP_SCENARIOS} onChange={setScenario} />
        <label className="toggle">
          <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
        </label>
      </div>
      <div className="viz-stage cap-stage">
        <ol className="cap-layers" aria-label="Layers">
          {shown.map((l) => {
            const cur = s.layer === l.id;
            const inStack = s.stack.includes(l.id);
            const cls = cur ? 'is-current' : inStack ? 'is-open' : visited.has(l.id) ? 'is-done' : '';
            return (
              <li key={l.id} className={`cap-layer ${cls}`} style={{ marginLeft: `${Math.max(0, s.stack.indexOf(l.id)) * 10}px` }}>
                <span className="cap-proj">{l.project}</span>
                <b>{l.label}</b>
                {cur && <span className="cap-dir">{s.dir === 'down' ? '↓ calling' : '↑ returning'}</span>}
              </li>
            );
          })}
        </ol>
        <div className="asp-card cap-card" aria-label="Data in hand">
          <p className="asp-card-head">{s.data ? s.data.label : 'In hand'}</p>
          {s.data ? (
            <dl>
              {s.data.fields.map(([k, v]) => (
                <div key={k} className="cap-field">
                  <dt>{k}</dt>
                  <dd className="mono">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="asp-muted">—</p>
          )}
          {s.response && (
            <div className="cap-response" role="status">
              <StatusPill code={s.response.status} text={s.response.text} />
              {s.response.body && (
                <dl>
                  {s.response.body.map(([k, v]) => (
                    <div key={k} className="cap-field">
                      <dt>{k}</dt>
                      <dd className="mono">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      </div>
      <Controls p={p} label="Capstone trace" />
      <div className="viz-panels">
        <SourcePanel code={snip.code} lines={s.lines} title={snip.file.replace('Examples/Task_Management_System_API/', '')} note="Real code from Examples/Task_Management_System_API (checked against the file on every build)." />
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend items={[['active', 'Running now'], ['ran', 'Waiting for a call to return'], ['idle', 'Already returned']]} />
          <p className="asp-simplified">
            <span className="asp-tag">Simplified</span> Middleware (exception handler, rate limiter, authentication) runs before this and isn&apos;t shown. Ids, request values and the SQL line are illustrative.
          </p>
        </div>
      </div>
    </VizShell>
  );
}
