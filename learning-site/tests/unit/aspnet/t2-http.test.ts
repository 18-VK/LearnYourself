import { describe, expect, it } from 'vitest';
import { ACTIONS, traceBinding } from '../../../src/viz/aspnet/binding/bind';
import { ALLOWED_ORIGIN, CORS_PRESETS, OTHER_ORIGIN, preflightReasons, traceCors } from '../../../src/viz/aspnet/cors/preflight';
import { DEFAULT_POOL, tracePool } from '../../../src/viz/aspnet/httpclient/pool';
import { headerValue, HSTS_STORIES, traceHsts, type HstsConfig } from '../../../src/viz/aspnet/https/hsts';
import { ENDPOINTS, matchTemplate, precedence, ROUTE_LINES, traceRoute } from '../../../src/viz/aspnet/routing/match';
import * as T2 from '../../../src/viz/aspnet/sources-t2';
import { noteText } from './helpers';

const NOTE = (f: string) => noteText(`Phase2-ASP.NetAndBackend/ASP.Net Core/${f}`);

describe('route matcher', () => {
  it("uses the note's ProductsController and highlights each action's attribute", () => {
    expect(NOTE('3.ASP_ControllerNRouting.md')).toContain(T2.PRODUCTS_CONTROLLER_CODE);
    const lines = T2.PRODUCTS_CONTROLLER_CODE.split('\n');
    for (const e of ENDPOINTS) expect(lines[ROUTE_LINES[e.id]![0]! - 1]!.trim()).toBe(e.marker);
  });

  const outcome = (m: string, u: string) => traceRoute(m, u).at(-1)!.state;
  it.each([
    ['GET', '/api/products', 200, 'GetAll'],
    ['GET', '/api/products/5', 200, 'Get'],
    ['GET', '/api/products/search?name=pen', 200, 'Search'],
    ['POST', '/api/products', 200, 'Create'],
    ['PUT', '/api/products/5', 200, 'Update'],
    ['DELETE', '/api/products/5', 200, 'Delete'],
    ['GET', '/API/Products/5', 200, 'Get'],
  ])('%s %s → %i via %s', (m, u, status, id) => {
    const s = outcome(m, u);
    expect(s.outcome!.status).toBe(status);
    expect(s.results[id]).toBe('selected');
  });

  it('binds route and query values by name', () => {
    expect(outcome('GET', '/api/products/5').bound).toEqual([{ name: 'id', value: '5', source: 'route' }]);
    expect(outcome('GET', '/api/products/search?name=pen').bound).toEqual([{ name: 'name', value: '"pen"', source: 'query string' }]);
  });

  it('GET …/abc: the :int constraint rules out Get, and only PUT/DELETE match the path → 405 with Allow', () => {
    const s = outcome('GET', '/api/products/abc');
    expect(s.results.Get).toBe('constraint-miss');
    expect(s.outcome).toMatchObject({ status: 405, detail: 'Allow: DELETE, PUT' });
  });

  it('DELETE …/abc matches {id} but the value is not an int → 400 from model binding', () => {
    expect(outcome('DELETE', '/api/products/abc').outcome!.status).toBe(400);
  });

  it('an unknown path → 404', () => {
    expect(outcome('GET', '/api/orders').outcome!.status).toBe(404);
  });

  it('ranks literal over constrained parameter over parameter', () => {
    expect(precedence('api/products/search')).toEqual([3, 3, 3]);
    expect(precedence('api/products/{id:int}')).toEqual([3, 3, 2]);
    expect(precedence('api/products/{id}')).toEqual([3, 3, 1]);
    expect(matchTemplate('api/products/{id:int}', '/api/products/-3')).toEqual({ ok: true, values: { id: '-3' } });
  });
});

describe('model binding', () => {
  it('copies the examples from the note', () => {
    const n4 = NOTE('4.ASP_ModelBindingNMore.md');
    for (const c of [T2.BINDING_FLOW_TEXT, T2.BINDING_EXAMPLE_CODE, T2.CREATE_PRODUCT_DTO_CODE, T2.CREATE_PRODUCT_ACTION_CODE]) expect(n4).toContain(c);
    expect(ACTIONS['all-sources'].fromNote).toBe(false);
  });

  it("the note's Example 1: id from the route, name from the query", () => {
    const t = traceBinding('note-example', ACTIONS['note-example'].request);
    expect(t.at(-1)!.state.bound.map((b) => [b.name, b.source, b.value])).toEqual([
      ['id', 'route', '5'],
      ['name', 'query', '"pen"'],
    ]);
    expect(t.at(-1)!.state.outcome!.status).toBe(200);
    // the predict answers are the real sources
    expect(t.filter((s) => s.predict).map((s) => s.predict!.options[s.predict!.answer])).toEqual(['Route', 'Query string', 'Yes']);
  });

  it('the DTO ignores isAdminOnly (no such property) and matches names case-insensitively', () => {
    const b = traceBinding('note-dto', ACTIONS['note-dto'].request).at(-1)!.state.bound[0]!;
    expect(b.value).toBe('{ Name = "Pen", Price = 10 } (ignored: isAdminOnly)');
  });

  it('a bad value or an empty body ends in an automatic 400 before the action runs', () => {
    const bad = traceBinding('note-example', { ...ACTIONS['note-example'].request, routeValue: 'abc' });
    expect(bad.at(-1)!.state.outcome!.status).toBe(400);
    expect(bad.some((s) => s.state.flowLine === 7 && s.action === 'call')).toBe(false);
    const empty = traceBinding('note-dto', { ...ACTIONS['note-dto'].request, body: '' });
    expect(empty.at(-1)!.state.bound[0]!.error).toBe('A non-empty request body is required.');
  });

  it('all four sources', () => {
    const t = traceBinding('all-sources', ACTIONS['all-sources'].request);
    expect(t.at(-1)!.state.bound.map((b) => [b.source, b.value])).toEqual([
      ['route', '5'],
      ['query', 'true'],
      ['header', '"abc-123"'],
      ['body', '{ Name = "Pen", Price = 12.5 }'],
    ]);
  });
});

describe('HttpClient pooling', () => {
  it('per call runs out of ports after ≈ ports ÷ requests per second; the factory never fails', () => {
    const last = tracePool(DEFAULT_POOL).at(-1)!.state;
    expect(last.perCall.exhaustedAt).toBeGreaterThanOrEqual(160);
    expect(last.perCall.exhaustedAt).toBeLessThanOrEqual(170);
    expect(last.perCall.failed).toBeGreaterThan(0);
    expect(last.factory.failed).toBe(0);
    expect(last.factory.handlers).toBe(1 + Math.floor(DEFAULT_POOL.seconds / DEFAULT_POOL.handlerLifetimeSeconds));
    expect(last.factory.dnsLookups).toBe(last.factory.handlers);
  });

  it('at a low rate per call never runs out, but still opens a connection per request', () => {
    const last = tracePool({ ...DEFAULT_POOL, requestsPerSecond: 20 }).at(-1)!.state;
    expect(last.perCall.failed).toBe(0);
    expect(last.perCall.newConnections).toBe(20 * DEFAULT_POOL.seconds);
    expect(last.factory.newConnections).toBeLessThan(10);
  });

  it('ports in use never exceed the limit', () => {
    for (const s of tracePool({ ...DEFAULT_POOL, requestsPerSecond: 300 })) expect(s.state.perCall.open + s.state.perCall.timeWait).toBeLessThanOrEqual(DEFAULT_POOL.ports);
  }, 30_000);

  it('copies its code and text from the notes', () => {
    expect(NOTE('6.ASP_ClientCallingWebAPI.md')).toContain(T2.TYPED_CLIENT_CODE);
    expect(NOTE('7.ASP_HttpClientClassNMore.md')).toContain(T2.INSTANCE_MANAGEMENT_TEXT);
  });
});

describe('CORS preflight', () => {
  it('decides simple vs preflight with the documented rules', () => {
    expect(preflightReasons({ origin: ALLOWED_ORIGIN, method: 'GET', authorization: false, json: false })).toEqual([]);
    expect(preflightReasons({ origin: ALLOWED_ORIGIN, method: 'PUT', authorization: true, json: true })).toHaveLength(3);
    expect(preflightReasons({ origin: ALLOWED_ORIGIN, method: 'POST', authorization: false, json: true })).toHaveLength(1);
  });

  const end = (id: string) => traceCors(CORS_PRESETS.find((p) => p.id === id)!.req).at(-1)!.state;
  it('presets end as Microsoft Learn describes', () => {
    expect(end('simple').outcome!.ok).toBe(true);
    expect(end('preflight')).toMatchObject({ preflight: true, serverRan: true, outcome: { ok: true } });
    expect(end('denied')).toMatchObject({ preflight: true, serverRan: false, outcome: { ok: false } });
    expect(end('simple-blocked')).toMatchObject({ preflight: false, serverRan: true, outcome: { ok: false } });
    expect(end('same-origin').outcome!.ok).toBe(true);
  });

  it('the preflight response echoes the allowed origin only for the allowed origin', () => {
    const ok = traceCors({ origin: ALLOWED_ORIGIN, method: 'PUT', authorization: true, json: true }).at(-1)!.state.events;
    expect(ok.find((e) => e.label === '204 No Content')!.headers).toContain(`Access-Control-Allow-Origin: ${ALLOWED_ORIGIN}`);
    const no = traceCors({ origin: OTHER_ORIGIN, method: 'PUT', authorization: true, json: true }).at(-1)!.state.events;
    expect(no.find((e) => e.label.startsWith('204'))!.label).toContain('no CORS headers');
  });

  it('copies the policy from the note', () => {
    expect(NOTE('8.ASP_MiddlewareNMore.md')).toContain(`policy.WithOrigins("${ALLOWED_ORIGIN}")`);
  });
});

describe('HTTPS redirection and HSTS', () => {
  const NOTE_CFG: HstsConfig = { redirection: true, hsts: true, includeSubDomains: true, production: true };
  const story = (id: string) => HSTS_STORIES.find((s) => s.id === id)!.visits;

  it("copies Program.cs from the note and writes the note's header", () => {
    expect(NOTE('HttpsImplementation.md')).toContain(T2.HTTPS_PROGRAM_CODE);
    expect(NOTE('HttpsImplementation.md')).toContain(`Strict-Transport-Security: ${headerValue(NOTE_CFG)}`);
  });

  it('only the very first visit goes over plain HTTP once HSTS is cached', () => {
    const last = traceHsts(NOTE_CFG, story('first-then-repeat')).at(-1)!.state;
    expect(last.insecure).toBe(1);
    expect(last.cache).toEqual([{ host: 'yourapi.com', includeSubDomains: true, daysLeft: 365 }]);
  });

  it('in Development (no UseHsts) every visit starts insecurely', () => {
    expect(traceHsts({ ...NOTE_CFG, production: false }, story('first-then-repeat')).at(-1)!.state.insecure).toBe(2);
  });

  it('includeSubDomains breaks a subdomain without HTTPS; without it the subdomain loads over HTTP', () => {
    const on = traceHsts(NOTE_CFG, story('subdomain')).at(-1)!.state;
    expect(on.outcome).toMatch(/unreachable/);
    const off = traceHsts({ ...NOTE_CFG, includeSubDomains: false }, story('subdomain')).at(-1)!.state;
    expect(off.insecure).toBe(2);
  });

  it('max-age=0 removes the policy', () => {
    const t = traceHsts(NOTE_CFG, story('clear'));
    expect(t.at(-1)!.state.insecure).toBe(2);
  });
});
