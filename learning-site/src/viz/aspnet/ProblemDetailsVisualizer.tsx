import { useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, ChipGroup, SourcePanel, StatusPill, VizShell } from './common/ui';
import { EXCEPTIONS, formatBody, IMPLS, traceProblem, type ExceptionId, type ImplId } from './errors/problem';
import { EXCEPTION_FLOW_TEXT } from './sources-t2';

export interface ProblemDetailsProps {
  scenario?: string;
  predictMode?: boolean;
  placement?: string;
}

const IMPL_ORDER: ImplId[] = ['capstone', 'note-handler', 'note-middleware'];

export default function ProblemDetailsVisualizer(props: ProblemDetailsProps) {
  const [impl, setImpl] = useState<ImplId>('capstone');
  const [ex, setEx] = useState<ExceptionId>('Exception');
  const trace = useMemo(() => traceProblem(impl, ex), [impl, ex]);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${impl}:${ex}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;
  const info = IMPLS[impl];
  return (
    <VizShell title="Global exception handling → ProblemDetails" label="Exception to ProblemDetails visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input asp-input-stack">
        <div className="asp-field">
          <span className="asp-label">Handler</span>
          <ChipGroup label="Exception handler" value={impl} options={IMPL_ORDER.map((id) => ({ id, label: IMPLS[id].label }))} onChange={setImpl} />
        </div>
        <div className="asp-field">
          <span className="asp-label">The action throws</span>
          <ChipGroup label="Exception thrown" value={ex} options={EXCEPTIONS.map((e) => ({ id: e.id, label: e.label }))} onChange={setEx} />
        </div>
        <label className="toggle">
          <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
        </label>
      </div>
      <div className="viz-stage pd-stage">
        <SourcePanel code={EXCEPTION_FLOW_TEXT} lines={[s.flowLine]} title="Full Execution Flow, from the note" lang="text" />
        <div className="asp-card" aria-label="The exception switch">
          <p className="asp-card-head">ex switch (first match wins)</p>
          <ol className="pd-arms">
            {info.arms.map((a, i) => {
              const cls = s.matched === i ? 'is-hit' : s.armsTried.includes(i) ? 'is-miss' : s.armAt === i ? 'is-current' : '';
              return (
                <li key={i} className={cls}>
                  <span className="mono">{a.type === '_' ? '_ (anything else)' : a.type}</span>
                  <span className="mono">→ {a.status}</span>
                </li>
              );
            })}
          </ol>
          <p className="asp-card-head">Response</p>
          {s.body ? (
            <>
              <p className="pd-status">
                <StatusPill code={s.status!} text={s.phase === 'sent' ? 'sent' : 'being written'} />
                <span className="asp-muted"> {info.problemDetails ? 'ProblemDetails (RFC 9457)' : 'custom JSON shape'}</span>
              </p>
              <pre className="mono pd-json">{formatBody(s.body)}</pre>
              <p className="asp-muted pd-note">traceId is a made-up example of HttpContext.TraceIdentifier.</p>
            </>
          ) : (
            <p className="asp-muted">Nothing written yet.</p>
          )}
        </div>
      </div>
      <Controls p={p} label="Exception handling" />
      <div className="viz-panels">
        <SourcePanel code={info.code} lines={s.codeLines} title={impl === 'capstone' ? 'GlobalExceptionMiddleware.cs (capstone)' : 'From the note'} />
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend items={[['active', 'Arm being tested'], ['settled', 'Arm that matched'], ['idle', 'Arm that did not match']]} />
          <p className="asp-simplified">
            ProblemDetails is the standard error body from{' '}
            <a href="https://www.rfc-editor.org/rfc/rfc9457" target="_blank" rel="noopener noreferrer">
              RFC 9457
            </a>{' '}
            (which replaced RFC 7807). Members that are null, like type here, are left out of the JSON.
          </p>
        </div>
      </div>
    </VizShell>
  );
}
