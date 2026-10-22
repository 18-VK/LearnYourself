import { lineOf } from '../../engine/code';
import type { Step } from '../../engine/types';
import { ZERO } from '../common/zero';
import { CORS_POLICY_CODE } from '../sources';

/**
 * A browser calling the API from another origin, with the note's "AllowFrontend" policy
 * (8.ASP_MiddlewareNMore.md › UseCors(): WithOrigins("http://localhost:3000").AllowAnyHeader().AllowAnyMethod()).
 * Rules from Microsoft Learn (https://learn.microsoft.com/aspnet/core/security/cors) and MDN
 * (https://developer.mozilla.org/docs/Web/HTTP/Guides/CORS):
 * - the browser can skip the preflight only if the method is GET, HEAD or POST, the only request headers it sets are
 *   Accept, Accept-Language, Content-Language, Content-Type or Last-Event-ID, and Content-Type (if set) is
 *   application/x-www-form-urlencoded, multipart/form-data or text/plain;
 * - otherwise it first sends OPTIONS with Origin, Access-Control-Request-Method and Access-Control-Request-Headers;
 * - a denied preflight gets 204 without CORS headers, so the browser doesn't send the real request;
 * - for the real request, if the response lacks Access-Control-Allow-Origin, the browser doesn't make the response
 *   available to the page, even if the server returned success. CORS relaxes the same-origin policy; it is enforced
 *   by the browser, not the server.
 */

export const API_ORIGIN = 'https://api.example.com';
export const ALLOWED_ORIGIN = 'http://localhost:3000';
export const OTHER_ORIGIN = 'https://other-site.example';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
export interface CorsRequest {
  origin: string;
  method: Method;
  authorization: boolean;
  json: boolean;
}

export const CORS_PRESETS: { id: string; label: string; req: CorsRequest }[] = [
  { id: 'simple', label: 'Simple GET from the frontend', req: { origin: ALLOWED_ORIGIN, method: 'GET', authorization: false, json: false } },
  { id: 'preflight', label: 'PUT with JSON + token (preflight)', req: { origin: ALLOWED_ORIGIN, method: 'PUT', authorization: true, json: true } },
  { id: 'denied', label: 'Preflight from another site', req: { origin: OTHER_ORIGIN, method: 'DELETE', authorization: true, json: false } },
  { id: 'simple-blocked', label: 'Simple GET from another site', req: { origin: OTHER_ORIGIN, method: 'GET', authorization: false, json: false } },
  { id: 'same-origin', label: 'Same origin (no CORS)', req: { origin: API_ORIGIN, method: 'PUT', authorization: true, json: true } },
];

export type Lane = 'page' | 'browser' | 'cors' | 'controller';
export const CORS_LANES: { id: Lane; label: string }[] = [
  { id: 'page', label: 'Page script' },
  { id: 'browser', label: 'Browser' },
  { id: 'cors', label: 'API: UseCors' },
  { id: 'controller', label: 'API: controller' },
];

export interface CorsEvent {
  from: Lane;
  to: Lane;
  label: string;
  headers?: string[];
  tone?: 'ok' | 'bad';
}

export interface CorsState {
  events: CorsEvent[];
  preflight: boolean | null;
  reasons: string[];
  outcome: { ok: boolean; text: string } | null;
  codeLines: number[];
  serverRan: boolean;
}

export type CorsStep = Step<CorsState>;

const L = {
  origins: lineOf(CORS_POLICY_CODE, 'policy.WithOrigins("http://localhost:3000")'),
  headers: lineOf(CORS_POLICY_CODE, '.AllowAnyHeader()'),
  methods: lineOf(CORS_POLICY_CODE, '.AllowAnyMethod();'),
  policy: lineOf(CORS_POLICY_CODE, 'options.AddPolicy("AllowFrontend",'),
};

/** Why the browser must send a preflight (empty = it may skip it). */
export function preflightReasons(r: CorsRequest): string[] {
  const out: string[] = [];
  if (!['GET', 'HEAD', 'POST'].includes(r.method)) out.push(`${r.method} isn't GET, HEAD or POST`);
  if (r.authorization) out.push('the Authorization header isn\'t on the simple-header list');
  if (r.json) out.push('Content-Type: application/json isn\'t one of the three simple content types');
  return out;
}

export function traceCors(r: CorsRequest): CorsStep[] {
  const steps: CorsStep[] = [];
  const events: CorsEvent[] = [];
  const sameOrigin = r.origin === API_ORIGIN;
  const allowed = r.origin === ALLOWED_ORIGIN;
  const reasons = sameOrigin ? [] : preflightReasons(r);
  const needsPreflight = reasons.length > 0;
  let st: CorsState = { events: [], preflight: null, reasons, outcome: null, codeLines: [], serverRan: false };
  const push = (ev: CorsEvent | null, patch: Partial<CorsState>, action: CorsStep['action'], narration: string, predict?: CorsStep['predict']) => {
    if (ev) events.push(ev);
    st = { ...st, ...patch, events: [...events] };
    steps.push({ state: st, highlights: {}, action, codeLine: 0, narration, variables: { origin: r.origin, method: r.method }, counters: ZERO, predict });
  };
  const reqHeaders = [...(r.authorization ? ['Authorization: Bearer …'] : []), ...(r.json ? ['Content-Type: application/json'] : [])];
  push(
    { from: 'page', to: 'browser', label: `fetch("${API_ORIGIN}/api/tasks", { method: "${r.method}" })`, headers: reqHeaders },
    {},
    'start',
    `A script on ${r.origin} calls ${r.method} ${API_ORIGIN}/api/tasks${reqHeaders.length ? ` with ${reqHeaders.join(' and ')}` : ''}.`,
  );
  if (sameOrigin) {
    push({ from: 'browser', to: 'controller', label: `${r.method} /api/tasks`, headers: reqHeaders }, { preflight: false, serverRan: true }, 'call', 'The page and the API share an origin (scheme, host and port), so this isn\'t a cross-origin request: no preflight, no CORS headers needed.');
    push({ from: 'controller', to: 'page', label: '200 OK', tone: 'ok' }, { outcome: { ok: true, text: 'Same origin: the page reads the response.' } }, 'done', 'The response goes straight back to the page.');
    return steps;
  }
  push(
    null,
    { preflight: needsPreflight },
    'branch',
    needsPreflight ? `The origin differs from the API's, and this request isn't "simple": ${reasons.join('; ')}. So the browser must ask first, with a preflight.` : `The origin differs from the API's, but this is a "simple" request (GET, no extra headers), so the browser sends it directly, adding an Origin header.`,
    { question: 'Does the browser send a preflight OPTIONS request first?', options: ['Yes', 'No, it sends the request directly'], answer: needsPreflight ? 0 : 1 },
  );
  if (needsPreflight) {
    push(
      {
        from: 'browser',
        to: 'cors',
        label: 'OPTIONS /api/tasks (preflight)',
        headers: [`Origin: ${r.origin}`, `Access-Control-Request-Method: ${r.method}`, ...(reqHeaders.length ? [`Access-Control-Request-Headers: ${[r.authorization ? 'authorization' : '', r.json ? 'content-type' : ''].filter(Boolean).join(',')}`] : [])],
      },
      { codeLines: [L.policy] },
      'call',
      'The browser sends OPTIONS with the Origin and the method and headers it wants to use. Page code never sees this request.',
    );
    if (!allowed) {
      push(
        { from: 'cors', to: 'browser', label: '204 No Content (no CORS headers)', tone: 'bad' },
        { codeLines: [L.origins] },
        'branch',
        `UseCors checks the "AllowFrontend" policy: ${r.origin} isn't in WithOrigins("http://localhost:3000"). The preflight is denied: 204 No Content without CORS headers.`,
        { question: `Is ${r.origin} allowed by the policy?`, options: ['Yes', 'No'], answer: 1 },
      );
      push(null, { outcome: { ok: false, text: 'Blocked: the real request was never sent.' } }, 'done', 'With no Access-Control-Allow-Origin in the preflight response, the browser doesn\'t attempt the cross-origin request. The page gets a network error; the API never ran the action.');
      return steps;
    }
    const allowHeaders = [r.authorization ? 'authorization' : '', r.json ? 'content-type' : ''].filter(Boolean).join(',');
    push(
      {
        from: 'cors',
        to: 'browser',
        label: '204 No Content',
        headers: [`Access-Control-Allow-Origin: ${r.origin}`, `Access-Control-Allow-Methods: ${r.method}`, ...(allowHeaders ? [`Access-Control-Allow-Headers: ${allowHeaders}`] : []), 'Vary: Origin'],
        tone: 'ok',
      },
      { codeLines: [L.origins, L.headers, L.methods] },
      'call',
      `UseCors answers the preflight itself (the controller doesn't run): the origin is in WithOrigins, and AllowAnyHeader / AllowAnyMethod accept the requested ${r.method}${allowHeaders ? ` and ${allowHeaders}` : ''}.`,
      { question: `Is ${r.origin} allowed by the policy?`, options: ['Yes', 'No'], answer: 0 },
    );
  }
  push(
    { from: 'browser', to: 'cors', label: `${r.method} /api/tasks`, headers: [`Origin: ${r.origin}`, ...reqHeaders] },
    { codeLines: [L.origins] },
    'call',
    needsPreflight ? 'The preflight allowed it, so the browser now sends the real request, with the Origin header.' : 'The real request goes out with an Origin header.',
  );
  push(
    { from: 'cors', to: 'controller', label: 'next()' },
    { serverRan: true },
    'call',
    allowed ? 'UseCors notes that the origin is allowed and lets the request continue; the action runs.' : `UseCors finds ${r.origin} isn't allowed, so it adds no CORS headers, but it doesn't stop the request: the action still runs. CORS is enforced by the browser, not the server.`,
  );
  push(
    { from: 'controller', to: 'browser', label: '200 OK', headers: allowed ? [`Access-Control-Allow-Origin: ${r.origin}`, 'Vary: Origin'] : ['(no Access-Control-Allow-Origin)'], tone: allowed ? 'ok' : 'bad' },
    {},
    'return',
    allowed ? `The response carries Access-Control-Allow-Origin: ${r.origin}.` : 'The server returns 200 OK, without Access-Control-Allow-Origin.',
    { question: 'Can the page read this response?', options: ['Yes', 'No, the browser blocks it'], answer: allowed ? 0 : 1 },
  );
  push(
    allowed ? { from: 'browser', to: 'page', label: 'response delivered', tone: 'ok' } : null,
    { outcome: allowed ? { ok: true, text: 'Allowed: the page reads the response.' } : { ok: false, text: 'Blocked by the browser, although the server did the work.' } },
    'done',
    allowed ? 'The browser compares Access-Control-Allow-Origin with the page\'s origin, they match, and the page gets the response.' : 'Even though the server returned a successful response, the browser doesn\'t make it available to the page. That is why CORS isn\'t a security feature: it relaxes the browser\'s same-origin policy, it doesn\'t protect the API.',
  );
  return steps;
}
