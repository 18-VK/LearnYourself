import type { Prediction, Step } from '../../engine/types';
import { ZERO } from '../common/zero';

/**
 * A virtual-clock simulation of the limiters in 15.ASP_RateLimitingNmore.md.
 *
 * Fixed window, sliding window, token bucket and concurrency follow ASP.NET Core's built-in limiters as Microsoft
 * Learn describes them (https://learn.microsoft.com/aspnet/core/performance/rate-limit):
 * - fixed window: when the time window expires, a new window starts and the request limit resets;
 * - sliding window: the window slides one segment each segment interval (window / segments); requests taken in the
 *   segment that falls out of the window ("the expired segment") are added back;
 * - token bucket: a fixed number of tokens is added each replenishment period, never above the token limit;
 * - concurrency: each request takes a permit and gives it back when it completes.
 * All four queue up to QueueLimit waiting requests (OldestFirst) and reject the rest; queued requests get a permit
 * as soon as one frees up. The timers start at t = 0 (when the limiter is created).
 *
 * Leaky bucket is the note's theory only (ASP.NET Core has no built-in one): requests wait in a bucket and leave it
 * at a constant rate; a request that finds the bucket full overflows and is rejected. That overflow rule and the
 * bucket size are this simulation's choices, labelled as such in the UI.
 *
 * Rejected requests get 429, as the note's Basic Setup configures (RejectionStatusCode = 429; the default is 503).
 */

export type Algo = 'fixed-window' | 'sliding-window' | 'token-bucket' | 'concurrency' | 'leaky-bucket';
export const ALGOS: Algo[] = ['fixed-window', 'sliding-window', 'token-bucket', 'concurrency', 'leaky-bucket'];
export const ALGO_LABEL: Record<Algo, string> = {
  'fixed-window': 'Fixed window',
  'sliding-window': 'Sliding window',
  'token-bucket': 'Token bucket',
  concurrency: 'Concurrency',
  'leaky-bucket': 'Leaky bucket',
};

export interface Settings {
  'fixed-window': { permitLimit: number; windowSec: number; queueLimit: number };
  'sliding-window': { permitLimit: number; windowSec: number; segments: number; queueLimit: number };
  'token-bucket': { tokenLimit: number; tokensPerPeriod: number; periodSec: number; queueLimit: number };
  /** durationSec: how long each request runs (an example value; the note gives none) */
  concurrency: { permitLimit: number; queueLimit: number; durationSec: number };
  /** example values (the note gives no numbers for leaky bucket) */
  'leaky-bucket': { capacity: number; leakEverySec: number };
}

/** "## 2. All Four Limiter Types" in the note; leaky bucket and request duration are example values. */
export const NOTE_SETTINGS: Settings = {
  'fixed-window': { permitLimit: 10, windowSec: 60, queueLimit: 2 },
  'sliding-window': { permitLimit: 10, windowSec: 60, segments: 4, queueLimit: 2 },
  'token-bucket': { tokenLimit: 20, tokensPerPeriod: 5, periodSec: 10, queueLimit: 2 },
  concurrency: { permitLimit: 5, queueLimit: 10, durationSec: 4 },
  'leaky-bucket': { capacity: 10, leakEverySec: 6 },
};

/** Settings that come from the note (the rest are example values). */
export const FROM_NOTE: Record<Algo, string[]> = {
  'fixed-window': ['permitLimit', 'windowSec', 'queueLimit'],
  'sliding-window': ['permitLimit', 'windowSec', 'segments', 'queueLimit'],
  'token-bucket': ['tokenLimit', 'tokensPerPeriod', 'periodSec', 'queueLimit'],
  concurrency: ['permitLimit', 'queueLimit'],
  'leaky-bucket': [],
};

export type ReqStatus = 'accepted' | 'queued' | 'rejected' | 'done';

export interface ReqView {
  id: number;
  t: number;
  status: ReqStatus;
  /** when a queued request got its permit (or left the leaky bucket) */
  grantedAt?: number;
  /** concurrency: when it finished */
  doneAt?: number;
}

export interface LimiterView {
  /** fixed window: index and start of the current window; permits used in it */
  window?: { index: number; start: number; used: number };
  /** sliding window: counts per segment, oldest → current, and each segment's start time */
  segments?: { start: number; count: number }[];
  available?: number;
  tokens?: number;
  inFlight?: number[];
  queue: number[];
  /** leaky bucket: requests that have left the bucket so far */
  processed?: number;
}

export interface RlState {
  algo: Algo;
  now: number;
  requests: ReqView[];
  limiter: LimiterView;
  /** the request this step is about */
  focus: number | null;
  /** timer events so far (window resets, slides, refills, leaks), for the timeline */
  ticks: number[];
  totals: { accepted: number; queued: number; rejected: number; sent: number };
}

export type RlStep = Step<RlState> & { kind: 'start' | 'arrive' | 'tick' | 'grant' | 'complete' | 'leak' | 'done'; line: 'limit' | 'queue' | 'window' | 'segments' | 'period' | 'tokens' | null };

const r1 = (x: number) => Math.round(x * 1000) / 1000;
const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = r1(t - m * 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};
export const fmtTime = fmt;

/** Simulates `arrivals` (seconds, any order) through the chosen limiter and returns one step per event. */
export function simulate(algo: Algo, settings: Settings, arrivalsIn: readonly number[]): RlStep[] {
  const arrivals = [...arrivalsIn].map(r1).sort((a, b) => a - b);
  const reqs: ReqView[] = arrivals.map((t, id) => ({ id, t, status: 'queued' }));
  const steps: RlStep[] = [];
  const ticks: number[] = [];
  const queue: number[] = [];
  let now = 0;

  // ── limiter state ──
  const fx = settings['fixed-window'];
  const sw = settings['sliding-window'];
  const tb = settings['token-bucket'];
  const cc = settings.concurrency;
  const lk = settings['leaky-bucket'];
  let windowIndex = 0;
  let fixedAvailable = fx.permitLimit;
  const segCount = Math.max(1, Math.round(sw.segments));
  const segLen = sw.windowSec / segCount;
  const segs = new Array<number>(segCount).fill(0);
  let segIndex = 0;
  let segStart = 0;
  const segStarts = new Array<number>(segCount).fill(Number.NaN);
  segStarts[0] = 0;
  let slidingAvailable = sw.permitLimit;
  let tokens = tb.tokenLimit;
  let ccAvailable = cc.permitLimit;
  const inFlight: { id: number; end: number }[] = [];
  let processed = 0;

  const queueLimit = algo === 'fixed-window' ? fx.queueLimit : algo === 'sliding-window' ? sw.queueLimit : algo === 'token-bucket' ? tb.queueLimit : algo === 'concurrency' ? cc.queueLimit : lk.capacity;

  const view = (): LimiterView => {
    switch (algo) {
      case 'fixed-window':
        return { window: { index: windowIndex, start: windowIndex * fx.windowSec, used: fx.permitLimit - fixedAvailable }, available: fixedAvailable, queue: [...queue] };
      case 'sliding-window': {
        const order = Array.from({ length: segCount }, (_, k) => (segIndex + 1 + k) % segCount);
        return { segments: order.map((i) => ({ start: segStarts[i]!, count: segs[i]! })), available: slidingAvailable, queue: [...queue] };
      }
      case 'token-bucket':
        return { tokens, queue: [...queue] };
      case 'concurrency':
        return { inFlight: inFlight.map((x) => x.id), available: ccAvailable, queue: [...queue] };
      case 'leaky-bucket':
        return { queue: [...queue], processed };
    }
  };
  const totals = () => ({
    accepted: reqs.filter((r) => (r.status === 'accepted' || r.status === 'done') && r.t <= now).length,
    queued: queue.length,
    rejected: reqs.filter((r) => r.status === 'rejected').length,
    sent: reqs.filter((r) => r.t <= now && arrived.has(r.id)).length,
  });
  const arrived = new Set<number>();
  const push = (kind: RlStep['kind'], line: RlStep['line'], narration: string, focus: number | null, predict?: Prediction) => {
    const lim = view();
    steps.push({
      kind,
      line,
      state: {
        algo,
        now,
        requests: reqs.filter((r) => arrived.has(r.id)).map((r) => ({ ...r })),
        limiter: lim,
        focus,
        ticks: [...ticks],
        totals: totals(),
      },
      highlights: {},
      action: kind === 'arrive' ? 'compare' : kind === 'done' ? 'done' : kind === 'start' ? 'start' : 'write',
      codeLine: 0,
      narration,
      variables: variablesFor(lim),
      counters: ZERO,
      predict,
    });
  };
  const variablesFor = (l: LimiterView): Record<string, string | number> => {
    const v: Record<string, string | number> = { time: fmt(now) };
    if (l.window) v['permits used'] = `${l.window.used} / ${fx.permitLimit}`;
    if (l.segments) v['window total'] = `${sw.permitLimit - (l.available ?? 0)} / ${sw.permitLimit}`;
    if (l.tokens !== undefined) v.tokens = `${l.tokens} / ${tb.tokenLimit}`;
    if (l.inFlight) v['in flight'] = `${l.inFlight.length} / ${cc.permitLimit}`;
    if (algo === 'leaky-bucket') v['in bucket'] = `${l.queue.length} / ${lk.capacity}`;
    else v.queue = `${l.queue.length} / ${queueLimit}`;
    return v;
  };

  // can a new request get a permit right now? (OldestFirst: not while others are waiting)
  const hasPermit = (): boolean => {
    if (queue.length > 0) return false;
    switch (algo) {
      case 'fixed-window':
        return fixedAvailable > 0;
      case 'sliding-window':
        return slidingAvailable > 0;
      case 'token-bucket':
        return tokens > 0;
      case 'concurrency':
        return ccAvailable > 0;
      case 'leaky-bucket':
        return false;
    }
  };
  const take = (id: number) => {
    switch (algo) {
      case 'fixed-window':
        fixedAvailable--;
        break;
      case 'sliding-window':
        slidingAvailable--;
        segs[segIndex]!++;
        break;
      case 'token-bucket':
        tokens--;
        break;
      case 'concurrency':
        ccAvailable--;
        inFlight.push({ id, end: r1(now + cc.durationSec) });
        break;
      case 'leaky-bucket':
        break;
    }
  };
  const permitsLeft = () => (algo === 'fixed-window' ? fixedAvailable : algo === 'sliding-window' ? slidingAvailable : algo === 'token-bucket' ? tokens : ccAvailable);
  const permitWord = algo === 'token-bucket' ? 'token' : 'permit';

  /** grants waiting requests while permits last (OldestFirst) */
  const drainQueue = () => {
    while (queue.length && permitsLeft() > 0 && algo !== 'leaky-bucket') {
      const id = queue.shift()!;
      take(id);
      reqs[id]!.status = 'accepted';
      reqs[id]!.grantedAt = now;
      push('grant', 'queue', `Request #${id + 1} was waiting in the queue (oldest first) and now gets a ${permitWord}: accepted ${r1(now - reqs[id]!.t)} s after it arrived.`, id);
    }
  };

  const describe: Record<Algo, string> = {
    'fixed-window': `PermitLimit ${fx.permitLimit} per ${fx.windowSec} s window, QueueLimit ${fx.queueLimit}.`,
    'sliding-window': `PermitLimit ${sw.permitLimit} across a ${sw.windowSec} s window split into ${segCount} segments of ${r1(segLen)} s, QueueLimit ${sw.queueLimit}.`,
    'token-bucket': `The bucket starts full with ${tb.tokenLimit} tokens; ${tb.tokensPerPeriod} are added every ${tb.periodSec} s; QueueLimit ${tb.queueLimit}.`,
    concurrency: `${cc.permitLimit} requests may run at the same time; QueueLimit ${cc.queueLimit}; each request here takes ${cc.durationSec} s.`,
    'leaky-bucket': `The bucket holds ${lk.capacity} requests and lets one out every ${lk.leakEverySec} s.`,
  };
  push('start', null, `${ALGO_LABEL[algo]}: ${describe[algo]} ${arrivals.length} request${arrivals.length === 1 ? '' : 's'} will arrive.`, null);

  // ── timers ──
  const lastArrival = arrivals.length ? arrivals[arrivals.length - 1]! : 0;
  const period = algo === 'fixed-window' ? fx.windowSec : algo === 'sliding-window' ? segLen : algo === 'token-bucket' ? tb.periodSec : algo === 'leaky-bucket' ? lk.leakEverySec : Infinity;
  const nextTimer = (after: number) => (Number.isFinite(period) && period > 0 ? r1((Math.floor(after / period + 1e-9) + 1) * period) : Infinity);
  let timerAt = nextTimer(0);
  const nextCompletion = () => (inFlight.length ? Math.min(...inFlight.map((x) => x.end)) : Infinity);
  // stop once every request has been decided and nothing is left waiting (or after a safety bound)
  const settled = () => reqs.every((r) => arrived.has(r.id)) && queue.length === 0 && inFlight.length === 0;
  let ai = 0;
  let guard = 0;
  const horizon = lastArrival + 50 * Math.max(1, Number.isFinite(period) ? period : cc.durationSec) + 1;

  while (guard++ < 5000) {
    const tArr = ai < arrivals.length ? arrivals[ai]! : Infinity;
    const tDone = nextCompletion();
    const tTimer = timerAt;
    const t = Math.min(tArr, tDone, tTimer);
    if (!Number.isFinite(t) || t > horizon) break;
    if (settled() && ai >= arrivals.length) break;
    now = t;
    if (tDone === t) {
      // concurrency: a request finishes and returns its permit
      const k = inFlight.findIndex((x) => x.end === t);
      const done = inFlight.splice(k, 1)[0]!;
      ccAvailable++;
      reqs[done.id]!.status = 'done';
      reqs[done.id]!.doneAt = t;
      push('complete', 'limit', `Request #${done.id + 1} finishes, so its permit is released (on completion, not on a timer). ${ccAvailable} of ${cc.permitLimit} free.`, done.id);
      drainQueue();
      continue;
    }
    if (tTimer === t && tTimer <= tArr) {
      timerAt = nextTimer(t);
      onTimer();
      continue;
    }
    // an arrival
    const id = ai++;
    arrived.add(id);
    onArrival(id);
  }
  now = Math.max(now, lastArrival);
  push('done', null, summary(), null);
  return steps;

  function onTimer() {
    switch (algo) {
      case 'fixed-window': {
        const used = fx.permitLimit - fixedAvailable;
        windowIndex++;
        fixedAvailable = fx.permitLimit;
        ticks.push(now);
        if (used > 0 || queue.length) push('tick', 'window', `${fmt(now)}: a new ${fx.windowSec} s window starts and the counter resets: ${fx.permitLimit} permits available again (${used} were used in the last window).`, null);
        drainQueue();
        break;
      }
      case 'sliding-window': {
        segIndex = (segIndex + 1) % segCount;
        const recycled = segs[segIndex]!;
        segs[segIndex] = 0;
        segStart = now;
        segStarts[segIndex] = segStart;
        slidingAvailable += recycled;
        ticks.push(now);
        if (recycled > 0 || queue.length)
          push(
            'tick',
            'segments',
            `${fmt(now)}: the window slides one segment (${r1(segLen)} s). The segment from ${fmt(r1(now - sw.windowSec))} falls out of the window, so its ${recycled} request${recycled === 1 ? '' : 's'} ${recycled === 1 ? 'is' : 'are'} added back: ${slidingAvailable} of ${sw.permitLimit} available.`,
            null,
          );
        drainQueue();
        break;
      }
      case 'token-bucket': {
        const before = tokens;
        tokens = Math.min(tb.tokenLimit, tokens + tb.tokensPerPeriod);
        ticks.push(now);
        if (tokens !== before || queue.length)
          push(
            'tick',
            'period',
            `${fmt(now)}: replenishment adds ${tb.tokensPerPeriod} tokens${before + tb.tokensPerPeriod > tb.tokenLimit ? `, but never above TokenLimit ${tb.tokenLimit}` : ''}: ${before} → ${tokens}.`,
            null,
          );
        drainQueue();
        break;
      }
      case 'leaky-bucket': {
        ticks.push(now);
        if (queue.length) {
          const id = queue.shift()!;
          processed++;
          reqs[id]!.status = 'accepted';
          reqs[id]!.grantedAt = now;
          push('leak', null, `${fmt(now)}: the bucket leaks at its constant rate: request #${id + 1} leaves the bucket and is processed, ${r1(now - reqs[id]!.t)} s after it arrived. ${queue.length} still waiting.`, id);
        }
        break;
      }
      case 'concurrency':
        break;
    }
  }

  function onArrival(id: number) {
    const permit = hasPermit();
    const canQueue = queue.length < queueLimit;
    const answer = algo === 'leaky-bucket' ? (canQueue ? 1 : 2) : permit ? 0 : canQueue ? 1 : 2;
    // ask only when the answer isn't obvious: the limiter is at or near its limit
    const tight = algo === 'leaky-bucket' ? queue.length >= lk.capacity - 1 : permitsLeft() <= 1 || queue.length > 0;
    const predict: Prediction | undefined = tight
      ? { question: `Request #${id + 1} arrives at ${fmt(now)}. What happens to it?`, options: ['Accepted', algo === 'leaky-bucket' ? 'Waits in the bucket' : 'Queued', 'Rejected with 429'], answer }
      : undefined;
    if (algo === 'leaky-bucket') {
      if (canQueue) {
        queue.push(id);
        reqs[id]!.status = 'queued';
        push('arrive', null, `Request #${id + 1} arrives at ${fmt(now)} and drops into the bucket (${queue.length} of ${lk.capacity}). It waits for its turn at the constant outflow rate.`, id, predict);
      } else {
        reqs[id]!.status = 'rejected';
        push('arrive', null, `Request #${id + 1} arrives at ${fmt(now)} but the bucket is full (${lk.capacity} waiting), so it overflows: 429 Too Many Requests.`, id, predict);
      }
      return;
    }
    if (permit) {
      take(id);
      reqs[id]!.status = 'accepted';
      reqs[id]!.grantedAt = now;
      const left = permitsLeft();
      const what: Record<Exclude<Algo, 'leaky-bucket'>, string> = {
        'fixed-window': `it is request ${fx.permitLimit - fixedAvailable} of ${fx.permitLimit} in this window`,
        'sliding-window': `the window now holds ${sw.permitLimit - slidingAvailable} of ${sw.permitLimit}`,
        'token-bucket': `it takes a token, ${left} left`,
        concurrency: `${cc.permitLimit - ccAvailable} of ${cc.permitLimit} now running; it will finish at ${fmt(r1(now + cc.durationSec))}`,
      };
      push('arrive', 'limit', `Request #${id + 1} arrives at ${fmt(now)}: accepted (200), ${what[algo]}.`, id, predict);
      return;
    }
    const why =
      algo === 'fixed-window'
        ? `all ${fx.permitLimit} permits of this window are used`
        : algo === 'sliding-window'
          ? `the window already holds ${sw.permitLimit} requests`
          : algo === 'token-bucket'
            ? tokens > 0
              ? 'earlier requests are still waiting for tokens'
              : 'the bucket is empty'
            : `${cc.permitLimit} requests are already running`;
    if (canQueue) {
      queue.push(id);
      reqs[id]!.status = 'queued';
      push('arrive', 'queue', `Request #${id + 1} arrives at ${fmt(now)}, but ${why}. QueueLimit is ${queueLimit}, so it waits in the queue (${queue.length} of ${queueLimit}) instead of being rejected.`, id, predict);
    } else {
      reqs[id]!.status = 'rejected';
      push('arrive', 'queue', `Request #${id + 1} arrives at ${fmt(now)}, but ${why} and the queue is full (${queueLimit} waiting${queueLimit === 0 ? ': QueueLimit = 0 means no queuing at all' : ''}). Rejected: 429 Too Many Requests.`, id, predict);
    }
  }

  function summary(): string {
    const acc = reqs.filter((r) => r.status === 'accepted' || r.status === 'done').length;
    const late = reqs.filter((r) => (r.status === 'accepted' || r.status === 'done') && r.grantedAt !== undefined && r.grantedAt > r.t).length;
    const rej = reqs.filter((r) => r.status === 'rejected').length;
    const waiting = reqs.filter((r) => r.status === 'queued').length;
    return `Done: ${acc} accepted${late ? ` (${late} of them after waiting)` : ''}, ${rej} rejected with 429${waiting ? `, ${waiting} still waiting` : ''}, out of ${reqs.length}.`;
  }
}

// ── traffic patterns ─────────────────────────────────────────────────────────────────────────

export interface Pattern {
  id: string;
  label: string;
  arrivals: (s: Settings, algo: Algo) => number[];
}

const times = (n: number, at: number) => Array.from({ length: n }, () => at);
const every = (gap: number, from: number, until: number) => {
  const out: number[] = [];
  for (let t = from; t <= until + 1e-9; t += gap) out.push(r1(t));
  return out;
};

export const PATTERNS: Pattern[] = [
  // the note's test: for i in {1..15}; do curl ...; done
  { id: 'burst-15', label: '15 at once (the note’s curl test)', arrivals: () => times(15, 0) },
  {
    id: 'edge',
    label: 'Burst at a window edge',
    // the note: "100 requests at 0:59 and 100 more at 1:00", scaled to the fixed window's own limit
    arrivals: (s) => {
      const w = s['fixed-window'];
      return [...times(w.permitLimit, w.windowSec - 1), ...times(w.permitLimit, w.windowSec)];
    },
  },
  { id: 'steady', label: 'Steady: 1 every 5 s', arrivals: () => every(5, 0, 115) },
  { id: 'burst-steady', label: 'Burst, then steady', arrivals: () => [...times(12, 0), ...every(4, 4, 100)] },
];
