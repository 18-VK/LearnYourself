import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, ChipGroup, Simplified, SourcePanel, Stats, VizShell } from './common/ui';
import { linesForStep } from './ratelimit/code';
import { ALGO_LABEL, ALGOS, fmtTime, FROM_NOTE, NOTE_SETTINGS, PATTERNS, simulate, type Algo, type RlState, type Settings } from './ratelimit/sim';
import { ALL_FOUR_LIMITERS_CODE, LEAKY_BUCKET_TEXT } from './sources';

export interface RateLimiterProps {
  algorithms?: string[];
  predictMode?: boolean;
  placement?: string;
}

type Field = { key: string; label: string; min: number; max: number; step?: number };
const FIELDS: Record<Algo, Field[]> = {
  'fixed-window': [
    { key: 'permitLimit', label: 'PermitLimit', min: 1, max: 30 },
    { key: 'windowSec', label: 'Window (s)', min: 5, max: 120 },
    { key: 'queueLimit', label: 'QueueLimit', min: 0, max: 20 },
  ],
  'sliding-window': [
    { key: 'permitLimit', label: 'PermitLimit', min: 1, max: 30 },
    { key: 'windowSec', label: 'Window (s)', min: 4, max: 120 },
    { key: 'segments', label: 'SegmentsPerWindow', min: 1, max: 8 },
    { key: 'queueLimit', label: 'QueueLimit', min: 0, max: 20 },
  ],
  'token-bucket': [
    { key: 'tokenLimit', label: 'TokenLimit', min: 1, max: 40 },
    { key: 'tokensPerPeriod', label: 'TokensPerPeriod', min: 1, max: 40 },
    { key: 'periodSec', label: 'ReplenishmentPeriod (s)', min: 1, max: 60 },
    { key: 'queueLimit', label: 'QueueLimit', min: 0, max: 20 },
  ],
  concurrency: [
    { key: 'permitLimit', label: 'PermitLimit', min: 1, max: 20 },
    { key: 'queueLimit', label: 'QueueLimit', min: 0, max: 30 },
    { key: 'durationSec', label: 'Each request takes (s)', min: 1, max: 30 },
  ],
  'leaky-bucket': [
    { key: 'capacity', label: 'Bucket size', min: 1, max: 30 },
    { key: 'leakEverySec', label: 'One request leaves every (s)', min: 1, max: 30 },
  ],
};

const MAX_REQUESTS = 120;

export default function RateLimiterVisualizer(props: RateLimiterProps) {
  const algos = (props.algorithms?.length ? props.algorithms : ALGOS).filter((a): a is Algo => (ALGOS as string[]).includes(a));
  const list = algos.length ? algos : ALGOS;
  const [algo, setAlgo] = useState<Algo>(list[0]!);
  const [settings, setSettings] = useState<Settings>(NOTE_SETTINGS);
  const [pattern, setPattern] = useState<string>(PATTERNS[0]!.id);
  const [arrivals, setArrivals] = useState<number[]>(() => PATTERNS[0]!.arrivals(NOTE_SETTINGS, list[0]!));
  const [cursor, setCursor] = useState(1);
  const trace = useMemo(() => simulate(algo, settings, arrivals), [algo, settings, arrivals]);
  const key = `${algo}:${JSON.stringify(settings[algo])}:${arrivals.join(',')}`;
  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), key, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)]!;
  const s = step.state;

  // after firing new requests, jump to the first of them and play from there
  const seekTo = useRef<number | null>(null);
  useEffect(() => {
    if (seekTo.current === null) return;
    const from = seekTo.current;
    seekTo.current = null;
    const k = trace.findIndex((t) => t.kind === 'arrive' && t.state.now >= from - 1e-9);
    if (k > 0) {
      p.seek(k - 1);
      p.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const lastArrival = arrivals.length ? Math.max(...arrivals) : 0;
  const fire = (times: number[]) => {
    const next = [...arrivals, ...times].slice(0, MAX_REQUESTS);
    seekTo.current = Math.min(...times);
    setPattern('custom');
    setArrivals(next);
  };
  const applyPattern = (pid: string) => {
    const pt = PATTERNS.find((x) => x.id === pid);
    if (!pt) return;
    const a = pt.arrivals(settings, algo);
    setPattern(pid);
    setArrivals(a);
    setCursor(Math.ceil(Math.max(...a, 0)) + 1);
  };
  const setField = (k: string, v: number) => setSettings((old) => ({ ...old, [algo]: { ...old[algo], [k]: v } }));
  const changed = FIELDS[algo].filter((f) => (settings[algo] as Record<string, number>)[f.key] !== (NOTE_SETTINGS[algo] as Record<string, number>)[f.key]);
  const fromNote = FROM_NOTE[algo];

  return (
    <VizShell title="Rate limiters" label="Rate limiter visualizer" claimKeyboard={p.claimKeyboard}>
      <div className="viz-input asp-input-stack">
        <div className="asp-field">
          <span className="asp-label">Limiter</span>
          <ChipGroup label="Limiter" value={algo} options={list.map((a) => ({ id: a, label: ALGO_LABEL[a] }))} onChange={setAlgo} />
        </div>
        <div className="asp-field rl-settings" role="group" aria-label="Limiter settings">
          <span className="asp-label">Settings</span>
          {FIELDS[algo].map((f) => (
            <label key={f.key} className="rl-num">
              <span>
                {f.label}
                {!fromNote.includes(f.key) && <sup title="Example value: the note gives none">*</sup>}
              </span>
              <input
                type="number"
                min={f.min}
                max={f.max}
                step={f.step ?? 1}
                value={(settings[algo] as Record<string, number>)[f.key]}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value));
                  if (Number.isFinite(v)) setField(f.key, Math.min(f.max, Math.max(f.min, v)));
                }}
              />
            </label>
          ))}
          <button type="button" className="chipbtn" onClick={() => setSettings((o) => ({ ...o, [algo]: NOTE_SETTINGS[algo] }))} disabled={!changed.length}>
            {fromNote.length ? "The note's values" : 'Default values'}
          </button>
        </div>
        <div className="asp-field">
          <span className="asp-label">Traffic</span>
          <ChipGroup label="Traffic pattern" value={pattern} options={PATTERNS.map((x) => ({ id: x.id, label: x.label }))} onChange={applyPattern} />
        </div>
        <div className="asp-field">
          <span className="asp-label">Fire at {fmtTime(cursor)}</span>
          <button type="button" className="chipbtn" onClick={() => setCursor((c) => Math.max(0, c - 5))} aria-label="Fire time 5 seconds earlier">
            −5 s
          </button>
          <button type="button" className="chipbtn" onClick={() => setCursor((c) => c + 5)} aria-label="Fire time 5 seconds later">
            +5 s
          </button>
          <button type="button" className="chipbtn" onClick={() => setCursor(Math.ceil(lastArrival) + 1)}>
            After the last request
          </button>
          <button type="button" className="chipbtn rl-fire" onClick={() => fire([cursor])}>
            Send 1
          </button>
          <button type="button" className="chipbtn rl-fire" onClick={() => fire(Array.from({ length: 10 }, () => cursor))}>
            Burst of 10
          </button>
          <button
            type="button"
            className="chipbtn rl-fire"
            onClick={() => {
              const t = Array.from({ length: 10 }, (_, k) => cursor + k * 3);
              fire(t);
              setCursor(cursor + 30);
            }}
          >
            Stream: 10, one every 3 s
          </button>
          <button
            type="button"
            className="chipbtn"
            onClick={() => {
              setArrivals([]);
              setPattern('custom');
              setCursor(0);
            }}
          >
            Clear
          </button>
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
        </div>
      </div>
      {arrivals.length >= MAX_REQUESTS && <p className="viz-hint">At most {MAX_REQUESTS} requests: clear some to send more.</p>}

      <div className="viz-stage rl-stage">
        <Timeline state={s} final={trace.at(-1)!.state} settings={settings} />
        <LimiterPanel state={s} settings={settings} />
        <Stats
          items={[
            ['Requests sent', s.totals.sent],
            ['Accepted (200)', s.totals.accepted, 'ok'],
            ['Waiting', s.totals.queued, 'wait'],
            ['Rejected (429)', s.totals.rejected, 'bad'],
          ]}
        />
      </div>
      <Controls p={p} label="Rate limiter" />
      <div className="viz-panels">
        {algo === 'leaky-bucket' ? (
          <SourcePanel code={LEAKY_BUCKET_TEXT} lines={[1]} title="Leaky Bucket, from the note" lang="text" wrap note="Theory only: ASP.NET Core has no built-in leaky bucket limiter." />
        ) : (
          <SourcePanel
            code={ALL_FOUR_LIMITERS_CODE}
            lines={linesForStep(algo, step)}
            title="All Four Limiter Types, from the note"
            note={changed.length ? `Running with your values: ${changed.map((f) => `${f.label} ${(settings[algo] as Record<string, number>)[f.key]}`).join(', ')}.` : undefined}
          />
        )}
        <div className="viz-side">
          <Narration text={step.narration} prediction={step.predict} p={p} />
          <Variables vars={step.variables} />
          <AspLegend
            items={[
              ['settled', 'Accepted (200)'],
              ['compare', algo === 'leaky-bucket' ? 'Waiting in the bucket' : 'Queued (waiting for a permit)'],
              ['swap', 'Rejected (429)'],
              ['active', 'This step’s request'],
              ['ran', 'Current time'],
            ]}
          />
          <Simplified>
            Limiter timers start at 0:00 and requests arriving at the same moment as a timer tick are counted after it.
            {algo === 'leaky-bucket' ? ' The bucket size and the overflow rule (a full bucket rejects with 429) are this picture’s choices; the note describes only the constant outflow.' : ''}
            {algo === 'concurrency' ? ' The request duration is an example; a real request holds its permit for as long as it runs.' : ''} Values marked * are examples.
            Rejections use 429 as the note’s Basic Setup configures (
            <a href="https://learn.microsoft.com/aspnet/core/performance/rate-limit" target="_blank" rel="noopener noreferrer">
              Microsoft Learn: rate limiting middleware
            </a>
            ).
          </Simplified>
        </div>
      </div>
    </VizShell>
  );
}

// ── timeline ─────────────────────────────────────────────────────────────────────────────────

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function Timeline({ state, final, settings }: { state: RlState; final: RlState; settings: Settings }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { algo, requests, now } = state;
  // layout (scale and stacking) comes from the whole run, so nothing jumps while it plays
  const all = final.requests;
  const period =
    algo === 'fixed-window'
      ? settings['fixed-window'].windowSec
      : algo === 'sliding-window'
        ? settings['sliding-window'].windowSec / Math.max(1, settings['sliding-window'].segments)
        : algo === 'token-bucket'
          ? settings['token-bucket'].periodSec
          : algo === 'leaky-bucket'
            ? settings['leaky-bucket'].leakEverySec
            : 0;
  const ends = all.flatMap((r) => [r.t, r.grantedAt ?? r.t, r.doneAt ?? r.t]);
  const span = Math.max(final.now, ...ends, algo === 'fixed-window' || algo === 'sliding-window' ? settings[algo].windowSec : period * 2, 10);
  const T = span * 1.06 + 1;
  const padL = 10;
  const padR = 14;
  const x = (t: number) => padL + ((width - padL - padR) * t) / T;
  // stack requests that arrive together
  const stackIdx = new Map<number, number>();
  const counts = new Map<number, number>();
  for (const r of all) {
    const k = counts.get(r.t) ?? 0;
    stackIdx.set(r.id, k);
    counts.set(r.t, k + 1);
  }
  const maxStack = Math.max(1, ...counts.values());
  const gap = Math.max(4, Math.min(10, 150 / maxStack));
  const base = 22 + maxStack * gap + 8;
  const H = base + 30;
  const tickTimes: number[] = [];
  if (period > 0) for (let t = period; t <= T; t += period) tickTimes.push(Math.round(t * 1000) / 1000);
  const labelEvery = Math.max(1, Math.ceil(tickTimes.length / Math.max(2, Math.floor(width / 70))));
  const y = (r: { id: number }) => base - 6 - (stackIdx.get(r.id) ?? 0) * gap;
  const cls = (st: string) => (st === 'rejected' ? 'is-rej' : st === 'queued' ? 'is-wait' : 'is-ok');
  // the current fixed window / sliding window span, shaded
  let shade: [number, number] | null = null;
  if (algo === 'fixed-window' && state.limiter.window) {
    const w = settings['fixed-window'].windowSec;
    shade = [state.limiter.window.start, state.limiter.window.start + w];
  } else if (algo === 'sliding-window' && state.limiter.segments) {
    const seg = settings['sliding-window'].windowSec / Math.max(1, settings['sliding-window'].segments);
    const cur = state.limiter.segments.at(-1)!.start;
    shade = [cur - seg * (state.limiter.segments.length - 1), cur + seg];
  }
  return (
    <div className="rl-timeline" ref={ref}>
      <svg width={width} height={H} role="img" aria-label={`Timeline at ${fmtTime(now)}: ${state.totals.accepted} accepted, ${state.totals.queued} waiting, ${state.totals.rejected} rejected.`}>
        {shade && <rect className="rl-shade" x={x(Math.max(0, shade[0]))} y={14} width={Math.max(0, x(shade[1]) - x(Math.max(0, shade[0])))} height={base - 14} rx={4} />}
        {shade && (
          <text className="rl-shade-label" x={x(Math.max(0, shade[0])) + 4} y={11}>
            {algo === 'fixed-window' ? 'current window' : 'sliding window'}
          </text>
        )}
        <line className="rl-axis" x1={padL} x2={width - padR} y1={base} y2={base} />
        <text className="rl-tick-label" x={padL} y={base + 14} textAnchor="start">
          0:00
        </text>
        {tickTimes.map((t, k) => (
          <g key={t}>
            <line className={`rl-grid${algo === 'fixed-window' ? ' is-window' : ''}`} x1={x(t)} x2={x(t)} y1={14} y2={base + 4} />
            {state.ticks.includes(t) && algo !== 'fixed-window' && algo !== 'sliding-window' && <path className="rl-refill" d={`M ${x(t) - 4} ${base + 9} L ${x(t) + 4} ${base + 9} L ${x(t)} ${base + 3} Z`} />}
            {(k + 1) % labelEvery === 0 && (
              <text className="rl-tick-label" x={x(t)} y={base + 22} textAnchor="middle">
                {fmtTime(t)}
              </text>
            )}
          </g>
        ))}
        {requests.map((r) => {
          const yy = y(r);
          const until = r.status === 'queued' ? now : r.grantedAt;
          return (
            <g key={r.id} className={cls(r.status)}>
              {until !== undefined && until > r.t && <line className="rl-wait" x1={x(r.t)} x2={x(until)} y1={yy} y2={yy} />}
              {algo === 'concurrency' && r.grantedAt !== undefined && (
                <line className="rl-run" x1={x(r.grantedAt)} x2={x(r.doneAt ?? now)} y1={yy} y2={yy} />
              )}
              <circle className="rl-dot" cx={x(r.t)} cy={yy} r={Math.min(4, gap / 2 + 0.5)} />
              {r.grantedAt !== undefined && r.grantedAt > r.t && <circle className="rl-grant" cx={x(r.grantedAt)} cy={yy} r={Math.min(3.5, gap / 2)} />}
              {state.focus === r.id && <circle className="rl-focus" cx={x(r.status === 'accepted' && r.grantedAt !== undefined && r.grantedAt > r.t && r.grantedAt === now ? r.grantedAt : r.t)} cy={yy} r={Math.min(7, gap / 2 + 3)} />}
            </g>
          );
        })}
        <line className="rl-now" x1={x(now)} x2={x(now)} y1={8} y2={base + 4} />
        <text className="rl-now-label" x={Math.min(width - padR - 2, Math.max(padL + 16, x(now)))} y={H - 2} textAnchor="middle">
          now {fmtTime(now)}
        </text>
      </svg>
    </div>
  );
}

// ── limiter state ────────────────────────────────────────────────────────────────────────────

function Cells({ n, filled, label, kind, ids }: { n: number; filled: number; label: string; kind: 'used' | 'free-token' | 'wait' | 'run'; ids?: number[] }) {
  const show = Math.min(n, 40);
  return (
    <div className="rl-cells-row">
      <span className="rl-cells-label">{label}</span>
      <span className="rl-cells" role="img" aria-label={`${label}: ${filled} of ${n}`}>
        {Array.from({ length: show }, (_, i) => (
          <span key={i} className={`rl-cell${i < filled ? ` is-${kind}` : ''}`}>
            {ids && i < ids.length ? `#${ids[i]! + 1}` : ''}
          </span>
        ))}
        {n > show && <span className="asp-muted"> +{n - show}</span>}
        {n === 0 && <span className="asp-muted">none (0)</span>}
      </span>
    </div>
  );
}

function LimiterPanel({ state, settings }: { state: RlState; settings: Settings }) {
  const l = state.limiter;
  const q = state.algo;
  return (
    <div className="asp-card rl-state" aria-label="Limiter state">
      <p className="asp-card-head">Inside the limiter</p>
      {q === 'fixed-window' && l.window && (
        <>
          <p className="rl-line">
            Window {l.window.index + 1}: {fmtTime(l.window.start)}–{fmtTime(l.window.start + settings['fixed-window'].windowSec)}
          </p>
          <Cells n={settings['fixed-window'].permitLimit} filled={l.window.used} label="Permits used" kind="used" />
        </>
      )}
      {q === 'sliding-window' && l.segments && (
        <>
          <div className="rl-segs" role="list" aria-label="Segments, oldest to current">
            {l.segments.map((sg, i) => (
              <div key={i} role="listitem" className={`rl-seg${i === l.segments!.length - 1 ? ' is-current' : ''}`}>
                <b>{sg.count}</b>
                <span>{Number.isNaN(sg.start) ? 'not started' : `${fmtTime(sg.start)}${i === l.segments!.length - 1 ? ' (now)' : ''}`}</span>
              </div>
            ))}
          </div>
          <p className="rl-line">
            Window total {settings['sliding-window'].permitLimit - (l.available ?? 0)} of {settings['sliding-window'].permitLimit}; {l.available} available
          </p>
        </>
      )}
      {q === 'token-bucket' && l.tokens !== undefined && <Cells n={settings['token-bucket'].tokenLimit} filled={l.tokens} label="Tokens in the bucket" kind="free-token" />}
      {q === 'concurrency' && l.inFlight && <Cells n={settings.concurrency.permitLimit} filled={l.inFlight.length} label="Running now" kind="run" ids={l.inFlight} />}
      {q === 'leaky-bucket' && (
        <>
          <Cells n={settings['leaky-bucket'].capacity} filled={l.queue.length} label="In the bucket" kind="wait" ids={l.queue} />
          <p className="rl-line">
            Leaves the bucket: 1 every {settings['leaky-bucket'].leakEverySec} s · processed so far: {l.processed ?? 0}
          </p>
        </>
      )}
      {q !== 'leaky-bucket' && (
        <Cells
          n={q === 'fixed-window' ? settings['fixed-window'].queueLimit : q === 'sliding-window' ? settings['sliding-window'].queueLimit : q === 'token-bucket' ? settings['token-bucket'].queueLimit : settings.concurrency.queueLimit}
          filled={l.queue.length}
          label="Queue"
          kind="wait"
          ids={l.queue}
        />
      )}
    </div>
  );
}
