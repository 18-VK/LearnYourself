import { useMemo, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, ChipGroup, SourcePanel, VizShell } from './common/ui';
import { LatestHeaders, SeqDiagram } from './common/seq';
import { HSTS_LANES, HSTS_STORIES, traceHsts, type HstsConfig } from './https/hsts';
import { HTTPS_PROGRAM_CODE } from './sources-t2';

export interface HttpsHstsProps {
  predictMode?: boolean;
  placement?: string;
}

const NOTE_CONFIG: HstsConfig = { redirection: true, hsts: true, includeSubDomains: true, production: true };

export default function HttpsHstsVisualizer(props: HttpsHstsProps) {
  const [story, setStory] = useState(HSTS_STORIES[0]!.id);
  const [cfg, setCfg] = useState<HstsConfig>(NOTE_CONFIG);
  const visits = HSTS_STORIES.find((x) => x.id === story)!.visits;
  const trace = useMemo(() => traceHsts(cfg, visits), [cfg, visits]);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${story}:${JSON.stringify(cfg)}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;
  const toggle = (k: keyof HstsConfig, label: string) => (
    <label className="toggle">
      <input type="checkbox" checked={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} /> {label}
    </label>
  );
  return (
    <VizShell title="HTTPS redirection vs HSTS" label="HTTPS redirection and HSTS visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input asp-input-stack">
        <div className="asp-field">
          <span className="asp-label">Story</span>
          <ChipGroup label="Story" value={story} options={HSTS_STORIES.map((x) => ({ id: x.id, label: x.label }))} onChange={setStory} />
        </div>
        <div className="asp-field">
          <span className="asp-label">Settings</span>
          {toggle('redirection', 'UseHttpsRedirection')}
          {toggle('hsts', 'UseHsts')}
          {toggle('includeSubDomains', 'IncludeSubDomains')}
          {toggle('production', 'Production (not Development)')}
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
        </div>
      </div>
      <div className="viz-stage hs-stage">
        <div className="hs-left">
          <SeqDiagram lanes={HSTS_LANES} items={s.items} label="HTTPS and HSTS sequence" />
          <LatestHeaders items={s.items} />
        </div>
        <div className="asp-card hs-cache" aria-label="The browser's HSTS cache">
          <p className="asp-card-head">Browser HSTS cache</p>
          {s.cache.length ? (
            <ul>
              {s.cache.map((c) => (
                <li key={c.host}>
                  <b className="mono">{c.host}</b> {c.includeSubDomains ? '+ subdomains' : ''} <span className="asp-muted">· {c.daysLeft} days left</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="asp-muted">empty</p>
          )}
          <p className={s.insecure ? 'asp-bad' : 'asp-good'}>Plain-HTTP requests on the network: {s.insecure}</p>
          {s.outcome && (
            <p className="asp-outcome" role="status">
              {s.outcome}
            </p>
          )}
        </div>
      </div>
      <Controls p={p} label="HTTPS and HSTS" />
      <div className="viz-panels">
        <SourcePanel code={HTTPS_PROGRAM_CODE} lines={s.codeLines} title="Force HTTPS, from the note" />
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend items={[['active', 'Latest message'], ['settled', 'Over HTTPS'], ['swap', 'Plain HTTP or failure']]} />
          <p className="asp-simplified">
            Browser rules from{' '}
            <a href="https://www.rfc-editor.org/rfc/rfc6797" target="_blank" rel="noopener noreferrer">
              RFC 6797
            </a>
            . HSTS is a browser instruction: Microsoft Learn notes that other API callers such as phone or desktop apps don&apos;t obey it (
            <a href="https://learn.microsoft.com/aspnet/core/security/enforcing-ssl" target="_blank" rel="noopener noreferrer">
              Enforce HTTPS
            </a>
            ). The host names are examples.
          </p>
        </div>
      </div>
    </VizShell>
  );
}
