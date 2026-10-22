import { useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, ChipGroup, SourcePanel, VizShell } from './common/ui';
import { SeqDiagram } from './common/seq';
import { ALLOWED_ORIGIN, API_ORIGIN, CORS_LANES, CORS_PRESETS, OTHER_ORIGIN, preflightReasons, traceCors, type CorsRequest, type Method } from './cors/preflight';
import { CORS_POLICY_CODE } from './sources';

export interface CorsPreflightProps {
  predictMode?: boolean;
  placement?: string;
}

export default function CorsPreflightVisualizer(props: CorsPreflightProps) {
  const [req, setReq] = useState<CorsRequest>(CORS_PRESETS[1]!.req);
  const trace = useMemo(() => traceCors(req), [req]);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), JSON.stringify(req), { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;
  const preset = CORS_PRESETS.find((x) => JSON.stringify(x.req) === JSON.stringify(req))?.id ?? 'custom';
  const reasons = req.origin === API_ORIGIN ? [] : preflightReasons(req);
  return (
    <VizShell title="CORS: simple requests and the preflight" label="CORS preflight visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input asp-input-stack">
        <div className="asp-field">
          <span className="asp-label">Try</span>
          <ChipGroup label="Example requests" value={preset} options={CORS_PRESETS.map((x) => ({ id: x.id, label: x.label }))} onChange={(id) => setReq(CORS_PRESETS.find((x) => x.id === id)!.req)} />
        </div>
        <div className="asp-field">
          <span className="asp-label">Or build one</span>
          <ChipGroup
            label="Page origin"
            value={req.origin}
            options={[
              { id: ALLOWED_ORIGIN, label: ALLOWED_ORIGIN },
              { id: OTHER_ORIGIN, label: OTHER_ORIGIN },
              { id: API_ORIGIN, label: `${API_ORIGIN} (same origin)` },
            ]}
            onChange={(origin) => setReq({ ...req, origin })}
          />
          <ChipGroup label="Method" value={req.method} options={(['GET', 'POST', 'PUT', 'DELETE'] as Method[]).map((m) => ({ id: m, label: m }))} onChange={(method) => setReq({ ...req, method })} />
          <label className="toggle">
            <input type="checkbox" checked={req.authorization} onChange={(e) => setReq({ ...req, authorization: e.target.checked })} /> Authorization header
          </label>
          <label className="toggle">
            <input type="checkbox" checked={req.json} onChange={(e) => setReq({ ...req, json: e.target.checked })} /> JSON body
          </label>
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
        </div>
        <p className="asp-muted cors-why">{req.origin === API_ORIGIN ? 'Same origin: CORS doesn’t apply.' : reasons.length ? `Needs a preflight: ${reasons.join('; ')}.` : 'A simple request: no preflight.'}</p>
      </div>
      <div className="viz-stage cors-stage">
        <SeqDiagram lanes={CORS_LANES} items={s.events} label="CORS sequence" />
        {s.outcome && (
          <p className={`asp-outcome${s.outcome.ok ? '' : ' is-blocked'}`} role="status">
            {s.outcome.text}
          </p>
        )}
      </div>
      <Controls p={p} label="CORS" />
      <div className="viz-panels">
        <SourcePanel code={CORS_POLICY_CODE} lines={s.codeLines} title='UseCors() step 1 ("AllowFrontend"), from the note' />
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend items={[['active', 'Latest message'], ['settled', 'Allowed'], ['swap', 'Blocked or missing CORS headers']]} />
          <p className="asp-simplified">
            Preflight rules and responses as{' '}
            <a href="https://learn.microsoft.com/aspnet/core/security/cors" target="_blank" rel="noopener noreferrer">
              Microsoft Learn
            </a>{' '}
            and{' '}
            <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS" target="_blank" rel="noopener noreferrer">
              MDN
            </a>{' '}
            describe them; the allowed methods and headers are shown echoed back (AllowAnyMethod, AllowAnyHeader). Origins are examples.
          </p>
        </div>
      </div>
    </VizShell>
  );
}
