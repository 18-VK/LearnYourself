import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { lineOf } from '../engine/code';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, ChipGroup, Simplified, SourcePanel, StatusPill, VizShell } from './common/ui';
import {
  checkOrder,
  flowTokens,
  MIDDLEWARE,
  NOTE_ORDER,
  ORDER_PRESETS,
  programFor,
  SAMPLES,
  sameOrder,
  traceInAndOut,
  tracePipeline,
  type FlowState,
  type MwId,
  type PipeState,
  type RowStatus,
  type SampleId,
} from './middleware/pipeline';
import { CORS_POLICY_CODE, MIDDLEWARE_RATE_LIMIT_CODE } from './sources';

export interface MiddlewarePipelineProps {
  scenario?: 'in-and-out' | 'production-order' | string;
  /** in-and-out: the middleware names (the note uses A, B, C) */
  middleware?: string[];
  /** production-order: let the learner reorder the middleware */
  reorderable?: boolean;
  predictMode?: boolean;
  placement?: string;
}

export default function MiddlewarePipelineVisualizer(props: MiddlewarePipelineProps) {
  return props.scenario === 'production-order' ? <ProductionOrder {...props} /> : <InAndOut {...props} />;
}

// ── in-and-out ───────────────────────────────────────────────────────────────────────────────

function InAndOut(props: MiddlewarePipelineProps) {
  const names = props.middleware?.length ? props.middleware.slice(0, 5).map(String) : ['A', 'B', 'C'];
  const [short, setShort] = useState<number | null>(null);
  const trace = useMemo(() => traceInAndOut(names, short), [names.join(','), short]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${names.join(',')}:${short}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;
  const options = [{ id: 'none', label: 'Nobody (full pipeline)' }, ...names.map((n, i) => ({ id: String(i), label: `Middleware ${n}` }))];
  return (
    <VizShell title="Middleware: in and back out" label="Middleware pipeline visualizer: request in and response out" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input">
        <span className="asp-label">Short-circuit at</span>
        <ChipGroup label="Which middleware short-circuits" value={short === null ? 'none' : String(short)} options={options} onChange={(v) => setShort(v === 'none' ? null : Number(v))} />
        <label className="toggle">
          <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
        </label>
      </div>
      <div className="viz-stage asp-stage">
        <FlowRows state={s} />
        <NoteDiagram state={s} />
      </div>
      <Controls p={p} label="Middleware pipeline" />
      <div className="viz-panels asp-panels-single">
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend items={[['active', 'Running now'], ['ran', 'Already ran (in or out)'], ['swap', 'Short-circuited here'], ['idle', 'Not reached']]} />
        </div>
      </div>
    </VizShell>
  );
}

function FlowRows({ state }: { state: FlowState }) {
  return (
    <ol className="asp-pipe" aria-label="Pipeline">
      <li className="asp-row asp-client" aria-hidden="true">
        <span className="asp-lane">{state.at === -1 && <Token word="request" arrow="↓" />}</span>
        <span className="asp-box asp-box-client">Client</span>
        <span className="asp-lane">{state.at === state.rows.length && <Token word="response" arrow="↑" />}</span>
      </li>
      {state.rows.map((r, i) => {
        const st = state.status[i]!;
        const here = state.at === i;
        return (
          <li key={r} className={`asp-row st-${st}${i === state.rows.length - 1 ? ' is-endpoint' : ''}`}>
            <span className="asp-lane asp-lane-in" aria-hidden="true">{here && state.dir === 'in' && <Token word="request" arrow="↓" />}</span>
            <span className="asp-box">
              <b>{r}</b>
              <small>{rowNote(st, i === state.rows.length - 1)}</small>
            </span>
            <span className="asp-lane asp-lane-out" aria-hidden="true">{here && state.dir === 'out' && <Token word="response" arrow="↑" />}</span>
          </li>
        );
      })}
    </ol>
  );
}

function rowNote(st: RowStatus, endpoint: boolean): string {
  switch (st) {
    case 'current':
      return 'running now';
    case 'in':
      return endpoint ? 'ran' : 'called next, waiting for it to return';
    case 'out':
      return 'ran before and after next';
    case 'short':
      return "didn't call next: short-circuited";
    case 'skipped':
      return 'never reached';
    case 'done':
      return 'ran';
    default:
      return endpoint ? '' : 'waiting';
  }
}

function Token({ word, arrow }: { word: string; arrow: string }) {
  return (
    <motion.span className="asp-token" layoutId="asp-token" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
      {arrow === '↑' && <span aria-hidden="true">↑</span>}
      <span className="asp-token-word">{word}</span>
      {arrow === '↓' && <span aria-hidden="true">↓</span>}
    </motion.span>
  );
}

/** The note's two-line text diagram, with the current hop highlighted and skipped hops struck through. */
function NoteDiagram({ state }: { state: FlowState }) {
  const lines = flowTokens();
  const skipped = (l: number, k: number) => state.skipped.some((x) => x.line === l && x.index === k);
  return (
    <figure className="asp-diagram" aria-label="The note's diagram">
      <figcaption>The note&apos;s diagram</figcaption>
      {lines.map((toks, l) => (
        <p key={l} className="mono">
          {l === 1 && <span className="asp-arrow">-&gt; </span>}
          {toks.map((t, k) => {
            const cur = state.hop && state.hop.line === l && state.hop.index === k;
            return (
              <span key={k}>
                {k > 0 && <span className="asp-arrow"> -&gt; </span>}
                <span className={`asp-hop${cur ? ' is-current' : ''}${skipped(l, k) ? ' is-skipped' : ''}`} aria-current={cur ? 'step' : undefined}>
                  {t}
                </span>
              </span>
            );
          })}
        </p>
      ))}
    </figure>
  );
}

// ── production order ─────────────────────────────────────────────────────────────────────────

type CodeTab = 'pipeline' | 'cors' | 'ratelimit';
const CODE_TABS: { id: CodeTab; label: string }[] = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'cors', label: 'AddCors policy' },
  { id: 'ratelimit', label: 'AddRateLimiter' },
];

function ProductionOrder(props: MiddlewarePipelineProps) {
  const reorderable = props.reorderable !== false;
  const [order, setOrder] = useState<MwId[]>(NOTE_ORDER);
  const [sample, setSample] = useState<SampleId>('valid-token');
  const [fallback, setFallback] = useState(false);
  const trace = useMemo(() => tracePipeline(order, sample, { fallbackPolicy: fallback }), [order, sample, fallback]);
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${order.join(',')}:${sample}:${fallback}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const rules = checkOrder(order);
  const broken = rules.filter((r) => !r.ok).length;
  const code = programFor(order);
  const isNote = sameOrder(order, NOTE_ORDER);
  const preset = ORDER_PRESETS.find((x) => sameOrder(x.order, order))?.id ?? 'custom';
  const [tab, setTab] = useState<CodeTab>('pipeline');
  const atRow = step.state.at >= 0 && step.state.at < order.length ? order[step.state.at] : undefined;

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  };
  const applyPreset = (id: string) => {
    const pr = ORDER_PRESETS.find((x) => x.id === id);
    if (!pr) return;
    setOrder(pr.order);
    setSample(pr.sample);
    setFallback(Boolean(pr.fallbackPolicy));
  };

  return (
    <VizShell title="The production pipeline order" label="Middleware order visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input asp-input-stack">
        <div className="asp-field">
          <span className="asp-label">Sample request</span>
          <ChipGroup label="Sample request" value={sample} options={Object.values(SAMPLES).map((x) => ({ id: x.id, label: x.label }))} onChange={setSample} />
        </div>
        {reorderable && (
          <div className="asp-field">
            <span className="asp-label">Try an order</span>
            <ChipGroup label="Order presets" value={preset} options={ORDER_PRESETS.map((x) => ({ id: x.id, label: x.label }))} onChange={applyPreset} />
          </div>
        )}
        <div className="asp-field">
          <label className="toggle">
            <input type="checkbox" checked={fallback} onChange={(e) => setFallback(e.target.checked)} /> FallbackPolicy requires an authenticated user
          </label>
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
        </div>
      </div>
      <p className="viz-hint">{SAMPLES[sample].describe}</p>
      <div className="viz-stage asp-stage">
        <PipeRows state={step.state} reorderable={reorderable} onMove={move} />
        <ContextCard state={step.state} />
      </div>
      <Controls p={p} label="Request pipeline" />
      <div className="viz-panels">
        <div className="asp-code-col">
          <ChipGroup label="Code shown" value={tab} options={CODE_TABS} onChange={setTab} />
          {tab === 'pipeline' ? (
            <SourcePanel
              code={code}
              lines={step.codeLine ? [step.codeLine] : []}
              title={isNote ? 'Program.cs from the note' : 'Program.cs in your order'}
              note={isNote ? undefined : 'Each line is copied from the note; only the order changed.'}
            />
          ) : tab === 'cors' ? (
            <SourcePanel code={CORS_POLICY_CODE} lines={atRow === 'cors' ? [lineOf(CORS_POLICY_CODE, 'policy.WithOrigins(')] : []} title="UseCors() step 1, from the note" />
          ) : (
            <SourcePanel
              code={MIDDLEWARE_RATE_LIMIT_CODE}
              lines={atRow === 'ratelimit' ? [lineOf(MIDDLEWARE_RATE_LIMIT_CODE, 'opt.PermitLimit'), lineOf(MIDDLEWARE_RATE_LIMIT_CODE, 'opt.QueueLimit')] : []}
              title="UseRateLimiter() step 1, from the note"
              note='Step 3 in the note applies it to the action with [EnableRateLimiting("fixed")].'
            />
          )}
        </div>
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <div className="asp-rules" aria-label="Order rules">
            <p className="asp-rules-head">{broken ? `${broken} ordering rule${broken > 1 ? 's' : ''} broken` : 'Every ordering rule holds'}</p>
            <ul>
              {rules.map((r) => (
                <li key={r.id} className={r.ok ? 'ok' : 'bad'}>
                  <span className="asp-mark">
                    <span aria-hidden="true">{r.ok ? '✓' : '✗'}</span>
                    <span className="asp-vh">{r.ok ? 'Holds:' : 'Broken:'}</span>
                  </span>
                  <span>
                    {r.text}{' '}
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="asp-src">
                        {r.source}
                      </a>
                    ) : (
                      <span className="asp-src">{r.source}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <AspLegend items={[['active', 'Running now'], ['ran', 'Already ran'], ['covered', "Inside UseExceptionHandler's try/catch"], ['settled', 'Answered the request'], ['swap', 'Rejected or failed it'], ['idle', 'Not reached']]} />
          <Simplified>
            Each middleware is reduced to the decision the note describes. MapControllers stays last: its endpoints run at the end of the pipeline
            (Microsoft Learn: <a href="https://learn.microsoft.com/aspnet/core/fundamentals/middleware/" target="_blank" rel="noopener noreferrer">UseEndpoints is added at the end of the pipeline</a>).
          </Simplified>
        </div>
      </div>
    </VizShell>
  );
}

function PipeRows({ state, reorderable, onMove }: { state: PipeState; reorderable: boolean; onMove: (i: number, d: -1 | 1) => void }) {
  const E = state.order.length;
  const res = state.ctx.response;
  return (
    <ol className="asp-pipe" aria-label="Pipeline, top to bottom">
      <li className="asp-row asp-client" aria-hidden="true">
        <span className="asp-lane">{state.at === -1 && <Token word="request" arrow="↓" />}</span>
        <span className="asp-box asp-box-client">Client</span>
        <span className="asp-lane">{state.at === E + 1 && <Token word="response" arrow="↑" />}</span>
      </li>
      {[...state.order, 'endpoint' as const].map((id, i) => {
        const st = state.status[i]!;
        const here = state.at === i;
        const isShort = state.shortAt === i;
        const tone = isShort && res ? (res.status < 400 ? ' tone-ok' : ' tone-bad') : '';
        const caught = id === 'exception' && st !== 'idle' && state.dir === 'out' && here && res?.status === 500;
        const name = id === 'endpoint' ? 'MapControllers → endpoint' : MIDDLEWARE[id].name;
        const covered = state.covered && i >= state.covered[0] && i <= state.covered[1];
        return (
          <li key={id} className={`asp-row st-${st}${tone}${caught ? ' tone-ok' : ''}${id === 'endpoint' ? ' is-endpoint' : ''}${covered ? ' is-covered' : ''}`}>
            <span className="asp-lane asp-lane-in" aria-hidden="true">{here && state.dir === 'in' && <Token word="request" arrow="↓" />}</span>
            <span className="asp-box">
              <b>{name}</b>
              <small>{pipeNote(st, isShort, res, id === 'endpoint')}</small>
            </span>
            <span className="asp-lane asp-lane-out" aria-hidden="true">{here && state.dir === 'out' && <Token word="response" arrow="↑" />}</span>
            {reorderable && id !== 'endpoint' && (
              <span className="asp-move">
                <button type="button" className="ctl asp-mini" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label={`Move ${name} up`} title="Move up">
                  ↑
                </button>
                <button type="button" className="ctl asp-mini" onClick={() => onMove(i, 1)} disabled={i === E - 1} aria-label={`Move ${name} down`} title="Move down">
                  ↓
                </button>
              </span>
            )}
            {reorderable && id === 'endpoint' && <span className="asp-move asp-pinned">runs last</span>}
          </li>
        );
      })}
    </ol>
  );
}

function pipeNote(st: RowStatus, isShort: boolean, res: PipeState['ctx']['response'], endpoint: boolean): string {
  if (isShort) return res ? `short-circuited: ${res.status}` : 'short-circuited';
  switch (st) {
    case 'current':
      return 'running now';
    case 'in':
      return 'called next';
    case 'out':
      return 'ran in and out';
    case 'skipped':
      return 'never reached';
    case 'done':
      return 'ran';
    default:
      return endpoint ? 'the action' : 'waiting';
  }
}

function ContextCard({ state }: { state: PipeState }) {
  const c = state.ctx;
  return (
    <div className="asp-card" aria-label="HttpContext">
      <p className="asp-card-head">HttpContext</p>
      <dl>
        <dt>Endpoint</dt>
        <dd className="mono">{c.endpoint ?? 'null'}</dd>
        <dt>User</dt>
        <dd>{c.user}</dd>
        <dt>CORS header</dt>
        <dd>{c.cors ? 'Access-Control-Allow-Origin set' : '—'}</dd>
        <dt>Response</dt>
        <dd>{c.response ? <StatusPill code={c.response.status} text={c.response.text} /> : c.exception ? <span className="asp-bad">{c.exception} in flight</span> : '—'}</dd>
      </dl>
      {state.outcome && (
        <p className={`asp-outcome${state.outcome.blocked ? ' is-blocked' : ''}`} role="status">
          {state.outcome.blocked ? 'Blocked by the browser' : <StatusPill code={state.outcome.status} text={state.outcome.text} />}
        </p>
      )}
    </div>
  );
}
