import type { Step } from '../../engine/types';
import { ZERO } from '../common/zero';

/**
 * new HttpClient() per call vs IHttpClientFactory (6.ASP_ClientCallingWebAPI.md › Problems Solved by
 * IHttpClientFactory; 7.ASP_HttpClientClassNMore.md › Instance Management).
 *
 * Model (simplified, numbers are settings):
 * - Each HttpClient created with its own handler has its own connection pool, so a client created and disposed per
 *   request opens a new TCP connection every time, and disposing it closes that connection. "TCP ports aren't released
 *   immediately after connection closure" (TIME-WAIT lasts 2 × MSL, RFC 9293 §3.6.1, and §3.4.2 takes MSL to be 2 minutes); "if the
 *   rate of requests is high, the operating system limit of available ports might be exhausted."
 *   https://learn.microsoft.com/dotnet/fundamentals/networking/http/httpclient-guidelines
 * - IHttpClientFactory pools HttpMessageHandler instances; a new HttpClient reuses a pooled handler (and its open
 *   connections) while the handler's lifetime (default 2 minutes) hasn't expired. After that a new handler is used,
 *   which also means a fresh DNS lookup; the old one is disposed when nothing uses it any more.
 *   https://learn.microsoft.com/aspnet/core/fundamentals/http-requests#httpclient-and-lifetime-management
 * - Ports: Windows' default dynamic range is 49152–65535, 16,384 ports.
 *   https://learn.microsoft.com/troubleshoot/windows-server/networking/default-dynamic-port-range-tcpip-chang
 */

export interface PoolSettings {
  requestsPerSecond: number;
  seconds: number;
  /** how long a closed connection's port stays in TIME_WAIT */
  timeWaitSeconds: number;
  /** local ports available for outgoing connections */
  ports: number;
  /** IHttpClientFactory HandlerLifetime */
  handlerLifetimeSeconds: number;
  /** how long one request keeps its connection busy (example value) */
  requestMs: number;
}

export const DEFAULT_POOL: PoolSettings = { requestsPerSecond: 100, seconds: 300, timeWaitSeconds: 240, ports: 16384, handlerLifetimeSeconds: 120, requestMs: 100 };

export interface SideState {
  sent: number;
  failed: number;
  newConnections: number;
  open: number;
  timeWait: number;
  handlers: number;
  dnsLookups: number;
  /** ports in use (open + TIME_WAIT) sampled at every tick so far */
  history: number[];
  exhaustedAt: number | null;
}

export interface PoolState {
  t: number;
  perCall: SideState;
  factory: SideState;
  /** the factory's current handler number and when it expires */
  handler: { n: number; expiresAt: number };
}

export type PoolStep = Step<PoolState>;

const side = (): SideState => ({ sent: 0, failed: 0, newConnections: 0, open: 0, timeWait: 0, handlers: 0, dnsLookups: 0, history: [], exhaustedAt: null });

/** Ticks every `tick` seconds; within a tick, requests are spread evenly. */
export function tracePool(s: PoolSettings = DEFAULT_POOL, tick = 10): PoolStep[] {
  const steps: PoolStep[] = [];
  const pc = side();
  const fa = side();
  // TIME_WAIT expiries: [time it frees, count]
  const pcWait: [number, number][] = [];
  const faWait: [number, number][] = [];
  // concurrent connections needed by the factory's pool: requests in flight at once
  const inFlight = Math.max(1, Math.ceil((s.requestsPerSecond * s.requestMs) / 1000));
  let handler = { n: 1, expiresAt: s.handlerLifetimeSeconds };
  fa.handlers = 1;
  fa.dnsLookups = 1;
  fa.newConnections = inFlight;
  fa.open = inFlight;
  const snapshot = (t: number): PoolState => ({ t, perCall: { ...pc, history: [...pc.history] }, factory: { ...fa, history: [...fa.history] }, handler: { ...handler } });
  const push = (t: number, action: PoolStep['action'], narration: string, predict?: PoolStep['predict']) =>
    steps.push({
      state: snapshot(t),
      highlights: {},
      action,
      codeLine: 0,
      narration,
      variables: { time: `${t} s`, 'per call: ports in use': pc.open + pc.timeWait, 'factory: ports in use': fa.open + fa.timeWait },
      counters: ZERO,
      predict,
    });
  const release = (q: [number, number][], until: number, sd: SideState) => {
    while (q.length && q[0]![0] <= until) sd.timeWait -= q.shift()![1];
  };
  pc.history.push(0);
  fa.history.push(fa.open);
  const exhaustAt = Math.ceil(s.ports / Math.max(1, s.requestsPerSecond));
  push(
    0,
    'start',
    `${s.requestsPerSecond} requests per second to the same API for ${s.seconds} s. Left: a new HttpClient for every request, disposed after it. Right: clients from IHttpClientFactory, which reuses a pooled handler and its ${inFlight} open connection${inFlight === 1 ? '' : 's'}.`,
    {
      question: `With ${s.ports.toLocaleString('en-US')} ports and ${s.timeWaitSeconds} s of TIME_WAIT, does the new-client-per-request side run out of ports within ${s.seconds} s?`,
      options: ['Yes', 'No'],
      answer: s.requestsPerSecond * Math.min(s.timeWaitSeconds, s.seconds) >= s.ports ? 0 : 1,
    },
  );
  for (let t = tick; t <= s.seconds; t += tick) {
    const n = s.requestsPerSecond * tick;
    // ── per call: every request opens a connection on a new port and leaves it in TIME_WAIT after Dispose
    release(pcWait, t, pc);
    let opened = 0;
    let failed = 0;
    for (let k = 0; k < n; k++) {
      const at = t - tick + (k * tick) / n;
      release(pcWait, at, pc);
      if (pc.open + pc.timeWait >= s.ports) {
        failed++;
        continue;
      }
      opened++;
      pc.timeWait++;
      pcWait.push([at + s.requestMs / 1000 + s.timeWaitSeconds, 1]);
    }
    pc.sent += n;
    pc.failed += failed;
    pc.newConnections += opened;
    pc.dnsLookups += opened;
    pc.handlers += opened;
    if (failed && pc.exhaustedAt === null) pc.exhaustedAt = t - tick + Math.round(((n - failed) / n) * tick);
    pc.history.push(pc.open + pc.timeWait);

    // ── factory: the pooled handler's connections are reused; it is replaced when its lifetime expires
    release(faWait, t, fa);
    let rotated = false;
    if (t >= handler.expiresAt) {
      // the expired handler is disposed once its last request is done: its connections close into TIME_WAIT
      fa.timeWait += fa.open;
      faWait.push([t + s.timeWaitSeconds, fa.open]);
      handler = { n: handler.n + 1, expiresAt: handler.expiresAt + s.handlerLifetimeSeconds };
      fa.handlers++;
      fa.dnsLookups++;
      fa.newConnections += inFlight;
      fa.open = inFlight;
      rotated = true;
    }
    fa.sent += n;
    fa.history.push(fa.open + fa.timeWait);

    const pcUsed = pc.open + pc.timeWait;
    const parts: string[] = [];
    if (failed) parts.push(`Per call: ${failed.toLocaleString('en-US')} of ${n.toLocaleString('en-US')} requests failed this interval: every local port is open or still in TIME_WAIT, so new connections can't be made (SocketException).`);
    else if (pc.exhaustedAt === null)
      parts.push(`Per call: ${opened.toLocaleString('en-US')} new connections this interval, each closed on Dispose into TIME_WAIT. ${pcUsed.toLocaleString('en-US')} of ${s.ports.toLocaleString('en-US')} ports in use${t < s.timeWaitSeconds ? '; none has left TIME_WAIT yet' : ''}.`);
    else parts.push(`Per call: ports are freed as TIME_WAIT ends, and immediately used up again; ${pc.failed.toLocaleString('en-US')} requests have failed so far.`);
    parts.push(
      rotated
        ? `Factory: handler #${handler.n - 1} reached its ${s.handlerLifetimeSeconds} s lifetime. New clients get handler #${handler.n} (a fresh DNS lookup and ${inFlight} new connection${inFlight === 1 ? '' : 's'}); the old handler's connections close, ${fa.timeWait} port${fa.timeWait === 1 ? '' : 's'} in TIME_WAIT.`
        : `Factory: the same ${inFlight} connection${inFlight === 1 ? '' : 's'} carried all ${n.toLocaleString('en-US')} requests.`,
    );
    push(t, failed ? 'branch' : 'write', parts.join(' '));
  }
  const last = steps.at(-1)!;
  last.action = 'done';
  last.narration += pc.exhaustedAt !== null ? ` In total, per call ran out of ports after about ${pc.exhaustedAt} s (≈ ${exhaustAt} s = ports ÷ requests per second).` : ' Per call never ran out at this rate, but it still opened a connection (and did a DNS lookup and handshake) for every request.';
  return steps;
}
