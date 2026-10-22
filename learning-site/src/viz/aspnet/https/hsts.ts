import { lineOf } from '../../engine/code';
import type { Step } from '../../engine/types';
import { ZERO } from '../common/zero';
import { HTTPS_PROGRAM_CODE } from '../sources-t2';

/**
 * UseHttpsRedirection (a per-request server redirect) vs UseHsts (a browser-side rule, cached) as
 * HttpsImplementation.md explains them, with the note's settings (308, MaxAge 365 days, IncludeSubDomains, Preload,
 * UseHsts only outside Development). Browser behaviour follows RFC 6797 (https://www.rfc-editor.org/rfc/rfc6797):
 * - a Known HSTS Host's http:// URLs are rewritten to https:// (port 80 → 443) before anything is sent (§8.3);
 * - every Strict-Transport-Security header received over HTTPS refreshes the cached policy (§8.1), and max-age=0
 *   removes it (§6.1.1); a header received over plain HTTP is ignored (§8.1);
 * - includeSubDomains makes the policy cover subdomains (§6.1.2);
 * - for a Known HSTS Host, any secure-transport error ends the connection with no user recourse (§8.4, §12.1).
 * ASP.NET Core's UseHsts excludes localhost, 127.0.0.1 and [::1] by default
 * (https://learn.microsoft.com/aspnet/core/security/enforcing-ssl).
 */

export interface HstsConfig {
  redirection: boolean;
  hsts: boolean;
  includeSubDomains: boolean;
  production: boolean;
}

export type Visit = { kind: 'visit'; host: string; path: string; certOk: boolean } | { kind: 'clear' } | { kind: 'wait'; days: number };

export const HOST = 'yourapi.com';
export const SUB = 'staging.yourapi.com';

export const HSTS_STORIES: { id: string; label: string; visits: Visit[] }[] = [
  { id: 'first-then-repeat', label: 'First visit, then a repeat visit', visits: [{ kind: 'visit', host: HOST, path: '/api/tasks', certOk: true }, { kind: 'wait', days: 3 }, { kind: 'visit', host: HOST, path: '/api/tasks', certOk: true }] },
  { id: 'subdomain', label: 'A subdomain without HTTPS', visits: [{ kind: 'visit', host: HOST, path: '/api/tasks', certOk: true }, { kind: 'visit', host: SUB, path: '/', certOk: false }] },
  { id: 'clear', label: 'Undo with max-age=0', visits: [{ kind: 'visit', host: HOST, path: '/api/tasks', certOk: true }, { kind: 'clear' }, { kind: 'visit', host: HOST, path: '/api/tasks', certOk: true }] },
];

export type Lane = 'user' | 'browser' | 'network' | 'server';
export const HSTS_LANES: { id: Lane; label: string }[] = [
  { id: 'user', label: 'User' },
  { id: 'browser', label: 'Browser (HSTS cache)' },
  { id: 'network', label: 'Network' },
  { id: 'server', label: 'Server' },
];

export interface HstsItem {
  from: Lane;
  to: Lane;
  label: string;
  headers?: string[];
  tone?: 'ok' | 'bad';
}

export interface HstsState {
  items: HstsItem[];
  /** the browser's HSTS cache */
  cache: { host: string; includeSubDomains: boolean; daysLeft: number }[];
  /** requests that crossed the network over plain HTTP so far */
  insecure: number;
  codeLines: number[];
  outcome: string | null;
}

export type HstsStep = Step<HstsState>;

const C = (m: string) => lineOf(HTTPS_PROGRAM_CODE, m);
export const HSTS_LINES = {
  redirect: [C('options.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;'), C('app.UseHttpsRedirection();')],
  hsts: [C('options.MaxAge = TimeSpan.FromDays(365);'), C('options.IncludeSubDomains = true;'), C('options.Preload = true;'), C('app.UseHsts();')],
  devCheck: [C('if (!app.Environment.IsDevelopment())')],
};

const MAX_AGE_DAYS = 365;

export function headerValue(cfg: HstsConfig, maxAgeDays = MAX_AGE_DAYS): string {
  return `max-age=${maxAgeDays * 86400}${cfg.includeSubDomains ? '; includeSubDomains' : ''}; preload`;
}

export function traceHsts(cfg: HstsConfig, visits: readonly Visit[]): HstsStep[] {
  const steps: HstsStep[] = [];
  const items: HstsItem[] = [];
  let cache: HstsState['cache'] = [];
  let insecure = 0;
  const sendsHsts = cfg.hsts && cfg.production;
  const push = (item: HstsItem | null, codeLines: number[], action: HstsStep['action'], narration: string, extra: { predict?: HstsStep['predict']; outcome?: string } = {}) => {
    if (item) items.push(item);
    steps.push({
      state: { items: [...items], cache: cache.map((c) => ({ ...c })), insecure, codeLines, outcome: extra.outcome ?? null },
      highlights: {},
      action,
      codeLine: 0,
      narration,
      variables: { 'plain-HTTP requests sent': insecure, 'HSTS hosts cached': cache.length },
      counters: ZERO,
      predict: extra.predict,
    });
  };
  const known = (host: string) => cache.find((c) => c.host === host || (c.includeSubDomains && host.endsWith(`.${c.host}`)));
  const store = (host: string) => {
    const entry = { host, includeSubDomains: cfg.includeSubDomains, daysLeft: MAX_AGE_DAYS };
    const had = cache.some((c) => c.host === host);
    cache = [...cache.filter((c) => c.host !== host), entry];
    return had;
  };

  push(
    null,
    [],
    'start',
    `${cfg.redirection ? 'UseHttpsRedirection is on' : 'UseHttpsRedirection is off'}; ${sendsHsts ? 'UseHsts sends the Strict-Transport-Security header' : cfg.hsts ? 'UseHsts is skipped because the environment is Development (the note\'s if (!app.Environment.IsDevelopment()))' : 'UseHsts is off'}. The browser's HSTS cache starts empty.`,
  );
  for (const v of visits) {
    if (v.kind === 'wait') {
      cache = cache.map((c) => ({ ...c, daysLeft: c.daysLeft - v.days }));
      push(null, [], 'call', `${v.days} days pass. Each cached policy counts down from its max-age.`);
      continue;
    }
    if (v.kind === 'clear') {
      const had = cache.some((c) => c.host === HOST);
      cache = cache.filter((c) => c.host !== HOST);
      push(
        { from: 'server', to: 'browser', label: 'HTTPS response', headers: ['Strict-Transport-Security: max-age=0'], tone: 'ok' },
        [C('options.MaxAge = TimeSpan.FromDays(365);')],
        'write',
        had ? `The server is reconfigured with MaxAge = TimeSpan.Zero (the note's emergency undo) and the browser gets one HTTPS response from it: max-age=0 tells it to stop treating ${HOST} as a Known HSTS Host, so the cached policy is removed.` : 'max-age=0 arrives, but there was no cached policy to remove.',
      );
      continue;
    }
    const url = `http://${v.host}${v.path}`;
    const policy = known(v.host);
    push({ from: 'user', to: 'browser', label: `types ${url}` }, [], 'call', `The user types ${url} (or follows an old http:// link).`, {
      predict: { question: 'Does the browser send this request over plain HTTP?', options: ['Yes', 'No, it upgrades to HTTPS itself first'], answer: policy ? 1 : 0 },
    });
    if (policy) {
      push(
        { from: 'browser', to: 'browser', label: `HSTS: rewrite to https://${v.host}${v.path}`, tone: 'ok' },
        [],
        'branch',
        `${v.host} is a Known HSTS Host${policy.host !== v.host ? ` (covered by ${policy.host}'s includeSubDomains)` : ''}, ${policy.daysLeft} days left. The browser rewrites http:// to https:// before sending anything: no insecure first request, no redirect needed.`,
      );
      if (!v.certOk) {
        push(
          { from: 'browser', to: 'network', label: `TLS to ${v.host} fails`, tone: 'bad' },
          [HSTS_LINES.hsts[1]!],
          'done',
          `${v.host} has no valid HTTPS certificate. For a Known HSTS Host the browser must end the connection on any TLS error, and users can't click through: the subdomain is broken for everyone who has seen the parent's header, as the note warns about IncludeSubDomains.`,
          { outcome: `${v.host} is unreachable for this browser until the policy expires.` },
        );
        continue;
      }
    } else {
      insecure++;
      push(
        { from: 'browser', to: 'server', label: `GET ${url}`, headers: ['plain HTTP: the path, headers and body are readable on the way'], tone: 'bad' },
        [],
        'call',
        `The browser has no HSTS policy for ${v.host}, so the first request goes out over plain HTTP. Anyone on the network path can read or change it.`,
      );
      if (!v.certOk) {
        push({ from: 'server', to: 'browser', label: '200 OK over HTTP', tone: 'bad' }, [], 'done', `${v.host} serves plain HTTP and has no HSTS policy in this browser, so the page loads, insecurely.`, { outcome: 'Loaded over plain HTTP.' });
        continue;
      }
      if (!cfg.redirection) {
        push(
          { from: 'server', to: 'browser', label: '200 OK over HTTP', tone: 'bad' },
          [],
          'return',
          'UseHttpsRedirection is off, so the server answers the plain-HTTP request directly. Any Strict-Transport-Security header on an HTTP response would be ignored by the browser anyway.',
        );
        continue;
      }
      push(
        { from: 'server', to: 'browser', label: '308 Permanent Redirect', headers: [`Location: https://${v.host}${v.path}`] },
        HSTS_LINES.redirect,
        'return',
        'UseHttpsRedirection doesn\'t process the request; it answers 308 Permanent Redirect to the https:// URL (the note sets 308; the default is 307).',
      );
      push({ from: 'browser', to: 'server', label: `GET https://${v.host}${v.path}`, tone: 'ok' }, [], 'call', 'The browser makes a second request, this time over HTTPS.');
    }
    // the HTTPS request reaches the server
    if (sendsHsts) {
      const had = store(v.host);
      push(
        { from: 'server', to: 'browser', label: '200 OK', headers: [`Strict-Transport-Security: ${headerValue(cfg)}`], tone: 'ok' },
        HSTS_LINES.hsts,
        'write',
        `The HTTPS response carries Strict-Transport-Security: ${headerValue(cfg)}. The browser ${had ? 'refreshes' : 'stores'} the policy for ${v.host}: ${MAX_AGE_DAYS} days from now${had ? ' again (a rolling window)' : ''}${cfg.includeSubDomains ? ', subdomains included' : ''}.`,
      );
    } else {
      push(
        { from: 'server', to: 'browser', label: '200 OK (no HSTS header)' },
        cfg.hsts ? HSTS_LINES.devCheck : [],
        'write',
        cfg.hsts ? 'In Development UseHsts isn\'t called, so no Strict-Transport-Security header is sent and the browser learns nothing: the next http:// visit starts insecurely again.' : 'UseHsts is off, so the browser learns nothing: every future http:// visit starts with an insecure request and a redirect.',
      );
    }
  }
  const last = steps.at(-1)!;
  last.action = 'done';
  if (!last.state.outcome) last.state = { ...last.state, outcome: `${insecure} request${insecure === 1 ? '' : 's'} went over plain HTTP in total.` };
  return steps;
}
