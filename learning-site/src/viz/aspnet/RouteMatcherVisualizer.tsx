import { useId, useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, SourcePanel, StatusPill, VizShell } from './common/ui';
import { ENDPOINTS, ROUTE_LINES, ROUTE_PRESETS, traceRoute } from './routing/match';
import { PRODUCTS_CONTROLLER_CODE } from './sources-t2';

export interface RouteMatcherProps {
  scenario?: string;
  predictMode?: boolean;
  placement?: string;
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;
const LABEL: Record<string, string> = {
  pending: 'not checked yet',
  testing: 'checking',
  'path-miss': 'path does not match',
  'constraint-miss': 'constraint fails',
  'method-miss': 'wrong HTTP method',
  candidate: 'candidate',
  selected: 'selected',
};

export default function RouteMatcherVisualizer(props: RouteMatcherProps) {
  const id = useId();
  const [method, setMethod] = useState<string>('GET');
  const [url, setUrl] = useState('/api/products/search?name=pen');
  const [draft, setDraft] = useState(url);
  const trace = useMemo(() => traceRoute(method, url), [method, url]);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${method} ${url}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;
  const apply = () => setUrl(draft.trim().startsWith('/') ? draft.trim() : `/${draft.trim()}`);
  const lines = s.focus ? ROUTE_LINES[s.focus]! : [];
  return (
    <VizShell title="Attribute routing: which action does this URL hit?" label="Route matcher visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input asp-input-stack">
        <div className="asp-field">
          <label htmlFor={`${id}-m`} className="asp-label">
            Request
          </label>
          <select id={`${id}-m`} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <input
            type="text"
            aria-label="URL"
            spellCheck={false}
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={apply}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
          />
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
        </div>
        <div className="presets" role="group" aria-label="Example requests">
          {ROUTE_PRESETS.map((r) => (
            <button
              key={r.label}
              type="button"
              className="chipbtn"
              aria-pressed={r.method === method && r.url === url}
              onClick={() => {
                setMethod(r.method);
                setUrl(r.url);
                setDraft(r.url);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="viz-stage">
        <div className="table-wrap rt-wrap">
          <table className="rt-table">
            <caption>Route templates of the note&apos;s ProductsController</caption>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Template</th>
                <th scope="col">Action</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => {
                const r = s.results[e.id]!;
                return (
                  <tr key={e.id} className={`rt-${r}${s.focus === e.id ? ' is-focus' : ''}`}>
                    <td className="mono">{e.method}</td>
                    <td className="mono">{e.template}</td>
                    <td className="mono">{e.action}</td>
                    <td>{s.reasons[e.id] && r !== 'selected' ? s.reasons[e.id] : LABEL[r]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(s.bound.length > 0 || s.outcome) && (
          <div className="asp-card rt-result">
            {s.bound.length > 0 && (
              <dl>
                {s.bound.map((b) => (
                  <div key={b.name} className="cap-field">
                    <dt className="mono">{b.name}</dt>
                    <dd>
                      <span className="mono">{b.value}</span> <span className="asp-muted">from the {b.source}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {s.outcome && (
              <p className="asp-outcome" role="status">
                <StatusPill code={s.outcome.status} text={s.outcome.text} /> <span className="asp-muted">{s.outcome.detail}</span>
              </p>
            )}
          </div>
        )}
      </div>
      <Controls p={p} label="Route matching" />
      <div className="viz-panels">
        <SourcePanel code={PRODUCTS_CONTROLLER_CODE} lines={lines} title="Real world example, from the note" />
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend items={[['active', 'Template being checked'], ['compare', 'Still a candidate'], ['settled', 'Selected'], ['swap', 'Ruled out']]} />
          <p className="asp-simplified">
            Matching runs in the order{' '}
            <a href="https://learn.microsoft.com/aspnet/core/fundamentals/routing" target="_blank" rel="noopener noreferrer">
              Microsoft Learn
            </a>{' '}
            describes: path, then constraints, then the HTTP method, then the most specific template. Literal segments match case-insensitively.
          </p>
        </div>
      </div>
    </VizShell>
  );
}
