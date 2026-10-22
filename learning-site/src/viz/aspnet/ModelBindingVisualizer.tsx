import { useMemo, useState, type ReactNode } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { ACTIONS, SOURCE_LABEL, traceBinding, type ActionDef, type RequestInput, type Source } from './binding/bind';
import { AspLegend, ChipGroup, SourcePanel, StatusPill, VizShell } from './common/ui';
import { BINDING_FLOW_TEXT } from './sources-t2';

export interface ModelBindingProps {
  sources?: string[];
  predictMode?: boolean;
  placement?: string;
}

type Id = ActionDef['id'];

export default function ModelBindingVisualizer(props: ModelBindingProps) {
  const [actionId, setActionId] = useState<Id>('note-example');
  const a = ACTIONS[actionId];
  const [req, setReq] = useState<RequestInput>(a.request);
  const [applied, setApplied] = useState<RequestInput>(a.request);
  const trace = useMemo(() => traceBinding(actionId, applied), [actionId, applied]);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${actionId}:${JSON.stringify(applied)}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;
  const used = new Set(a.params.map((x) => x.source));
  const wanted = (props.sources?.length ? props.sources : ['route', 'query', 'body', 'header']) as Source[];
  const choose = (next: Id) => {
    setActionId(next);
    setReq(ACTIONS[next].request);
    setApplied(ACTIONS[next].request);
  };
  const commit = () => setApplied(req);
  const box = (src: Source, children: ReactNode) => {
    const b = s.bound.find((x) => x.source === src && x.name === s.focus);
    const cls = s.focusSource === src ? (b?.error ? ' is-bad' : ' is-focus') : '';
    return (
      <div className={`mb-src${cls}${used.has(src) ? '' : ' is-unused'}`}>
        <span className="mb-src-name">{SOURCE_LABEL[src]}</span>
        {children}
      </div>
    );
  };
  return (
    <VizShell title="Model binding: request → action parameters" label="Model binding visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input">
        <ChipGroup label="Action" value={actionId} options={(Object.keys(ACTIONS) as Id[]).map((k) => ({ id: k, label: ACTIONS[k].label }))} onChange={choose} />
        <label className="toggle">
          <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
        </label>
      </div>
      <div className="viz-stage mb-stage">
        <div className="mb-request" role="group" aria-label="The HTTP request (editable)">
          <p className="mb-url mono">
            {a.method} /{a.template.replace('{id}', applied.routeValue || '{id}')}
            {applied.query && a.params.some((x) => x.source === 'query') ? `?${applied.query}` : ''}
          </p>
          {wanted.includes('route') &&
            box(
              'route',
              <input type="text" aria-label="Route value for {id}" disabled={!used.has('route')} value={req.routeValue} onChange={(e) => setReq({ ...req, routeValue: e.target.value })} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />,
            )}
          {wanted.includes('query') &&
            box(
              'query',
              <input type="text" aria-label="Query string" disabled={!used.has('query')} value={req.query} placeholder="key=value&…" onChange={(e) => setReq({ ...req, query: e.target.value })} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />,
            )}
          {wanted.includes('header') &&
            box(
              'header',
              <label className="mb-header">
                <span className="mono">X-Request-Id:</span>
                <input type="text" aria-label="X-Request-Id header" disabled={!used.has('header')} value={req.header} onChange={(e) => setReq({ ...req, header: e.target.value })} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
              </label>,
            )}
          {wanted.includes('body') &&
            box(
              'body',
              <textarea className="mono" aria-label="Request body (JSON)" rows={4} disabled={!used.has('body')} value={req.body} onChange={(e) => setReq({ ...req, body: e.target.value })} onBlur={commit} />,
            )}
          <p className="asp-muted mb-hint">Edit a value and leave the field to re-run the binding. Sources this action doesn&apos;t use are greyed out.</p>
        </div>
        <div className="asp-card mb-params" aria-label="Action parameters">
          <p className="asp-card-head">Parameters</p>
          <ul>
            {a.params.map((prm) => {
              const b = s.bound.find((x) => x.name === prm.name);
              const cls = s.focus === prm.name ? (b?.error ? 'is-bad' : 'is-focus') : b ? (b.error ? 'is-bad' : 'is-ok') : '';
              return (
                <li key={prm.name} className={cls}>
                  <span className="mono">
                    {prm.attribute ? `${prm.attribute} ` : ''}
                    {prm.type} {prm.name}
                  </span>
                  <span className="mb-from">← {SOURCE_LABEL[prm.source]}{prm.attribute ? '' : ' (inferred)'}</span>
                  <span className="mono mb-val">{b ? (b.error ? `✗ ${b.error}` : b.value) : '…'}</span>
                </li>
              );
            })}
          </ul>
          {s.modelStateValid !== null && <p className={s.modelStateValid ? 'asp-good' : 'asp-bad'}>ModelState.IsValid = {String(s.modelStateValid)}</p>}
          {s.outcome && (
            <p className="asp-outcome" role="status">
              <StatusPill code={s.outcome.status} text={s.outcome.text} /> <span className="asp-muted">{s.outcome.detail}</span>
            </p>
          )}
        </div>
      </div>
      <Controls p={p} label="Model binding" />
      <div className="viz-panels">
        <div className="asp-code-col">
          <SourcePanel code={a.code} lines={s.codeLines} title={a.fromNote ? 'From the note' : 'Example built from the note’s attribute list (not code from the note)'} />
          <SourcePanel code={BINDING_FLOW_TEXT} lines={[s.flowLine]} title="Big Picture Flow, from the note" lang="text" />
        </div>
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend items={[['active', 'Being bound now'], ['settled', 'Bound'], ['swap', 'Binding error']]} />
          <p className="asp-simplified">
            Without an attribute, [ApiController] infers the source:{' '}
            <a href="https://learn.microsoft.com/aspnet/core/web-api/#binding-source-parameter-inference" target="_blank" rel="noopener noreferrer">
              Microsoft Learn
            </a>
            . Type conversion is simplified to int, bool, string and the note&apos;s DTO.
          </p>
        </div>
      </div>
    </VizShell>
  );
}
