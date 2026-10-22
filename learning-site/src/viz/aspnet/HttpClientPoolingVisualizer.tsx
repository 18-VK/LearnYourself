import { useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, SourcePanel, VizShell } from './common/ui';
import { DEFAULT_POOL, tracePool, type PoolSettings, type SideState } from './httpclient/pool';
import { INSTANCE_MANAGEMENT_TEXT, TYPED_CLIENT_CODE } from './sources-t2';
import { lineOf } from '../engine/code';

export interface HttpClientPoolingProps {
  compare?: string[];
  predictMode?: boolean;
  placement?: string;
}

const FIELDS: { key: keyof PoolSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'requestsPerSecond', label: 'Requests per second', min: 1, max: 300, step: 1 },
  { key: 'timeWaitSeconds', label: 'TIME_WAIT (s)', min: 30, max: 240, step: 10 },
  { key: 'handlerLifetimeSeconds', label: 'Handler lifetime (s)', min: 30, max: 600, step: 30 },
];

const fmt = (n: number) => n.toLocaleString('en-US');

export default function HttpClientPoolingVisualizer(props: HttpClientPoolingProps) {
  const [settings, setSettings] = useState<PoolSettings>(DEFAULT_POOL);
  const trace = useMemo(() => tracePool(settings), [settings]);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), JSON.stringify(settings), { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;
  const ticks = trace.length - 1;
  return (
    <VizShell title="new HttpClient per call vs IHttpClientFactory" label="HttpClient pooling visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input">
        {FIELDS.map((f) => (
          <label key={f.key} className="rl-num">
            <span>{f.label}</span>
            <input
              type="number"
              min={f.min}
              max={f.max}
              step={f.step}
              value={settings[f.key]}
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                if (Number.isFinite(v)) setSettings((o) => ({ ...o, [f.key]: Math.min(f.max, Math.max(f.min, v)) }));
              }}
            />
          </label>
        ))}
        <button type="button" className="chipbtn" onClick={() => setSettings(DEFAULT_POOL)}>
          Defaults
        </button>
        <label className="toggle">
          <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
        </label>
      </div>
      <div className="viz-stage hc-stage">
        <Side title="new HttpClient() per request, then Dispose" side={s.perCall} ports={settings.ports} ticks={ticks} />
        <Side title="IHttpClientFactory (pooled handler)" side={s.factory} ports={settings.ports} ticks={ticks} extra={`handler #${s.handler.n}, replaced at ${s.handler.expiresAt} s`} />
      </div>
      <Controls p={p} label="HttpClient pooling" />
      <div className="viz-panels">
        <div className="asp-code-col">
          <SourcePanel code={INSTANCE_MANAGEMENT_TEXT} lines={[1]} title="Instance Management, from the HttpClient note" lang="text" />
          <SourcePanel code={TYPED_CLIENT_CODE} lines={[lineOf(TYPED_CLIENT_CODE, 'AddHttpClient<IProductApiClient, ProductApiClient>')]} title="Typed HttpClient, from the note" />
        </div>
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend items={[['settled', 'Open connections'], ['compare', 'Ports in TIME_WAIT'], ['swap', 'Failed requests (no free port)']]} />
          <p className="asp-simplified">
            <span className="asp-tag">Simplified</span> {fmt(settings.ports)} ports is Windows&apos; default dynamic range (49152–65535); TIME_WAIT defaults to 2 × MSL = 240 s (
            <a href="https://www.rfc-editor.org/rfc/rfc9293#section-3.6.1" target="_blank" rel="noopener noreferrer">
              RFC 9293
            </a>
            ; operating systems often use less). Handler lifetime defaults to 2 minutes (
            <a href="https://learn.microsoft.com/aspnet/core/fundamentals/http-requests" target="_blank" rel="noopener noreferrer">
              Microsoft Learn
            </a>
            ). Each request is assumed to take {settings.requestMs} ms.
          </p>
        </div>
      </div>
    </VizShell>
  );
}

function Side({ title, side, ports, ticks, extra }: { title: string; side: SideState; ports: number; ticks: number; extra?: string }) {
  const used = side.open + side.timeWait;
  const pct = (n: number) => `${Math.min(100, (100 * n) / ports)}%`;
  const W = 260;
  const H = 60;
  const pts = side.history.map((v, i) => `${(i / Math.max(1, ticks)) * W},${H - (Math.min(v, ports) / ports) * H}`).join(' ');
  return (
    <div className={`asp-card hc-side${side.failed ? ' is-bad' : ''}`}>
      <p className="asp-card-head">{title}</p>
      {extra && <p className="asp-muted hc-extra">{extra}</p>}
      <div className="hc-gauge" role="img" aria-label={`${fmt(used)} of ${fmt(ports)} ports in use: ${fmt(side.open)} open, ${fmt(side.timeWait)} in TIME_WAIT`}>
        <span className="hc-open" style={{ width: pct(side.open) }} />
        <span className="hc-wait" style={{ width: pct(side.timeWait) }} />
      </div>
      <p className="hc-line mono">
        {fmt(used)} / {fmt(ports)} ports
      </p>
      <svg className="hc-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1={0} x2={W} y1={0} y2={0} className="hc-limit" />
        <polyline points={pts} className={side.failed ? 'is-bad' : ''} />
      </svg>
      <dl className="hc-stats">
        <div>
          <dt>Requests</dt>
          <dd>{fmt(side.sent)}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd className={side.failed ? 'asp-bad' : ''}>{fmt(side.failed)}</dd>
        </div>
        <div>
          <dt>New connections</dt>
          <dd>{fmt(side.newConnections)}</dd>
        </div>
        <div>
          <dt>DNS lookups</dt>
          <dd>{fmt(side.dnsLookups)}</dd>
        </div>
        <div>
          <dt>Handlers created</dt>
          <dd>{fmt(side.handlers)}</dd>
        </div>
        <div>
          <dt>Ran out of ports at</dt>
          <dd>{side.exhaustedAt === null ? '—' : `${side.exhaustedAt} s`}</dd>
        </div>
      </dl>
    </div>
  );
}
