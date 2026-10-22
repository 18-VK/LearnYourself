import { lineOf } from '../../engine/code';
import type { Step } from '../../engine/types';
import { ZERO } from '../common/zero';
import { PRODUCTS_CONTROLLER_CODE } from '../sources-t2';

/**
 * Attribute-route matching for the note's ProductsController (3.ASP_ControllerNRouting.md › Attribute Routing).
 * The phases follow Microsoft Learn's "URL matching" section
 * (https://learn.microsoft.com/aspnet/core/fundamentals/routing):
 *  1. match the URL path against every route template (literals are case-insensitive),
 *  2. drop matches whose route constraints fail ({id:int} needs an integer),
 *  3. drop matches that fail the matcher policies, here the HTTP method; if every path match was dropped only for
 *     its method, ASP.NET Core answers 405 with an Allow header
 *     (HttpMethodMatcherPolicy: https://source.dot.net/Microsoft.AspNetCore.Routing/Matching/HttpMethodMatcherPolicy.cs.html),
 *  4. pick the highest-priority survivor (literal segment > constrained parameter > plain parameter); equal
 *     priority would throw an ambiguous-match exception.
 * Then route values and query-string values are bound to the action's parameters by name.
 */

export interface RouteEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** template from [HttpX("…")], combined with the controller's [Route("api/products")] */
  template: string;
  action: string;
  /** parameters of the action: name, type, and where the note says the value comes from */
  params: { name: string; type: 'int' | 'string'; source: 'route' | 'query' }[];
  /** marker for the [HttpX] line in the code */
  marker: string;
}

const PREFIX = 'api/products';
export const ENDPOINTS: RouteEndpoint[] = [
  { id: 'GetAll', method: 'GET', template: PREFIX, action: 'GetAll()', params: [], marker: '[HttpGet]' },
  { id: 'Get', method: 'GET', template: `${PREFIX}/{id:int}`, action: 'Get(int id)', params: [{ name: 'id', type: 'int', source: 'route' }], marker: '[HttpGet("{id:int}")]' },
  { id: 'Search', method: 'GET', template: `${PREFIX}/search`, action: 'Search(string name)', params: [{ name: 'name', type: 'string', source: 'query' }], marker: '[HttpGet("search")]' },
  { id: 'Create', method: 'POST', template: PREFIX, action: 'Create()', params: [], marker: '[HttpPost]' },
  { id: 'Update', method: 'PUT', template: `${PREFIX}/{id}`, action: 'Update(int id)', params: [{ name: 'id', type: 'int', source: 'route' }], marker: '[HttpPut("{id}")]' },
  { id: 'Delete', method: 'DELETE', template: `${PREFIX}/{id}`, action: 'Delete(int id)', params: [{ name: 'id', type: 'int', source: 'route' }], marker: '[HttpDelete("{id}")]' },
];

export const ROUTE_LINES = Object.fromEntries(
  ENDPOINTS.map((e) => {
    const attr = lineOf(PRODUCTS_CONTROLLER_CODE, e.marker);
    return [e.id, [attr, attr + 1]];
  }),
) as Record<string, number[]>;

export const ROUTE_PRESETS: { method: RouteEndpoint['method']; url: string; label: string }[] = [
  { method: 'GET', url: '/api/products', label: 'GET /api/products' },
  { method: 'GET', url: '/api/products/5', label: 'GET /api/products/5' },
  { method: 'GET', url: '/api/products/search?name=pen', label: 'GET …/search?name=pen' },
  { method: 'POST', url: '/api/products', label: 'POST /api/products' },
  { method: 'DELETE', url: '/api/products/5', label: 'DELETE /api/products/5' },
  { method: 'GET', url: '/api/products/abc', label: 'GET …/abc (constraint)' },
  { method: 'GET', url: '/API/Products/5', label: 'GET /API/Products/5 (case)' },
  { method: 'GET', url: '/api/orders', label: 'GET /api/orders' },
];

type SegMatch = { ok: true; values: Record<string, string> } | { ok: false; why: string; constraint?: boolean };

const isInt = (s: string) => /^-?\d+$/.test(s) && Number.isSafeInteger(Number(s));

export function matchTemplate(template: string, path: string): SegMatch {
  const t = template.split('/').filter(Boolean);
  const p = path.split('/').filter(Boolean);
  if (t.length !== p.length) return { ok: false, why: `${p.length} segment${p.length === 1 ? '' : 's'} in the URL, ${t.length} in the template` };
  const values: Record<string, string> = {};
  for (let i = 0; i < t.length; i++) {
    const seg = t[i]!;
    const val = decodeURIComponent(p[i]!);
    const m = /^\{(\w+)(?::(\w+))?\}$/.exec(seg);
    if (!m) {
      if (seg.toLowerCase() !== val.toLowerCase()) return { ok: false, why: `literal "${seg}" ≠ "${val}"` };
      continue;
    }
    const [, name, constraint] = m;
    if (constraint === 'int' && !isInt(val)) return { ok: false, why: `"${val}" fails the :int constraint`, constraint: true };
    values[name!] = val;
  }
  return { ok: true, values };
}

/** Route template precedence for one segment: literal 3, constrained parameter 2, parameter 1 (higher wins). */
export function precedence(template: string): number[] {
  return template
    .split('/')
    .filter(Boolean)
    .map((s) => (!s.startsWith('{') ? 3 : s.includes(':') ? 2 : 1));
}

export interface RouteState {
  method: string;
  path: string;
  query: Record<string, string>;
  /** endpoint id → result so far */
  results: Record<string, 'pending' | 'testing' | 'path-miss' | 'constraint-miss' | 'method-miss' | 'candidate' | 'selected'>;
  reasons: Record<string, string>;
  focus: string | null;
  bound: { name: string; value: string; source: string }[];
  outcome: { status: number; text: string; detail: string } | null;
  phase: 'parse' | 'path' | 'method' | 'select' | 'bind' | 'done';
}

export type RouteStep = Step<RouteState>;

export function traceRoute(method: string, url: string): RouteStep[] {
  const [rawPath, rawQuery = ''] = url.split('?');
  const path = rawPath || '/';
  const query = Object.fromEntries(new URLSearchParams(rawQuery));
  const steps: RouteStep[] = [];
  let st: RouteState = {
    method,
    path,
    query,
    results: Object.fromEntries(ENDPOINTS.map((e) => [e.id, 'pending'])) as RouteState['results'],
    reasons: {},
    focus: null,
    bound: [],
    outcome: null,
    phase: 'parse',
  };
  const push = (patch: Partial<RouteState>, action: RouteStep['action'], narration: string, predict?: RouteStep['predict']) => {
    st = { ...st, ...patch, results: { ...st.results, ...(patch.results ?? {}) }, reasons: { ...st.reasons, ...(patch.reasons ?? {}) } };
    steps.push({ state: st, highlights: {}, action, codeLine: 0, narration, variables: { method, path, ...(rawQuery ? { query: rawQuery } : {}) }, counters: ZERO, predict });
  };
  const segs = path.split('/').filter(Boolean);
  push({}, 'start', `${method} ${url}. Routing splits the path into ${segs.length} segment${segs.length === 1 ? '' : 's'} (${segs.map((s) => `"${s}"`).join(', ') || 'none'})${rawQuery ? ` and keeps the query string (${rawQuery}) aside for model binding` : ''}.`);

  // phases 1 and 2: path and constraints
  const pathOk: RouteEndpoint[] = [];
  const values: Record<string, Record<string, string>> = {};
  for (const e of ENDPOINTS) {
    const m = matchTemplate(e.template, path);
    if (m.ok) {
      pathOk.push(e);
      values[e.id] = m.values;
      push({ phase: 'path', focus: e.id, results: { [e.id]: 'candidate' }, reasons: { [e.id]: Object.keys(m.values).length ? `path matches (${Object.entries(m.values).map(([k, v]) => `${k} = "${v}"`).join(', ')})` : 'path matches' } }, 'compare', `Template ${e.template} (${e.method} ${e.action}): every segment matches${Object.keys(m.values).length ? `, capturing ${Object.entries(m.values).map(([k, v]) => `${k} = "${v}"`).join(', ')}` : ''}. It stays a candidate.`);
    } else {
      push({ phase: 'path', focus: e.id, results: { [e.id]: m.constraint ? 'constraint-miss' : 'path-miss' }, reasons: { [e.id]: m.why } }, 'compare', `Template ${e.template} (${e.method} ${e.action}): ${m.why}, so it is out.${m.constraint ? ' Constraints disambiguate routes; they are not input validation.' : ''}`);
    }
  }

  if (!pathOk.length) {
    push({ phase: 'done', focus: null, outcome: { status: 404, text: 'Not Found', detail: 'No route template matches this path.' } }, 'done', 'No template matched the path, so no endpoint is selected: 404 Not Found.');
    return steps;
  }

  // phase 3: HTTP method
  const byMethod = pathOk.filter((e) => e.method === method);
  const dropped = pathOk.filter((e) => e.method !== method);
  push(
    {
      phase: 'method',
      focus: null,
      results: Object.fromEntries(dropped.map((e) => [e.id, 'method-miss'])),
      reasons: Object.fromEntries(dropped.map((e) => [e.id, `path matches, but it is ${e.method}, not ${method}`])),
    },
    'branch',
    dropped.length
      ? `The HTTP method decides next: ${pathOk.map((e) => `${e.method} ${e.action}`).join(', ')} matched the path, and only ${byMethod.length ? byMethod.map((e) => e.action).join(', ') : 'none of them'} accept${byMethod.length === 1 ? 's' : ''} ${method}.`
      : `All ${pathOk.length} path match${pathOk.length === 1 ? '' : 'es'} accept ${method}.`,
    { question: `${pathOk.length} template${pathOk.length === 1 ? '' : 's'} matched the path. What happens next?`, options: ['An action runs', '405 Method Not Allowed', '404 Not Found'], answer: byMethod.length ? 0 : 1 },
  );
  if (!byMethod.length) {
    const allow = [...new Set(pathOk.map((e) => e.method))].sort().join(', ');
    push({ phase: 'done', outcome: { status: 405, text: 'Method Not Allowed', detail: `Allow: ${allow}` } }, 'done', `Every template that matched the path was dropped only because of its method, so ASP.NET Core answers 405 Method Not Allowed with an Allow: ${allow} header.`);
    return steps;
  }

  // phase 4: select
  let best = byMethod[0]!;
  if (byMethod.length > 1) {
    const cmp = (a: RouteEndpoint, b: RouteEndpoint) => {
      const pa = precedence(a.template);
      const pb = precedence(b.template);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
      return 0;
    };
    const sorted = [...byMethod].sort(cmp);
    best = sorted[0]!;
    if (cmp(sorted[0]!, sorted[1]!) === 0) {
      push({ phase: 'done', outcome: { status: 500, text: 'AmbiguousMatchException', detail: `${sorted[0]!.action} and ${sorted[1]!.action}` } }, 'done', 'Two candidates have the same priority, so routing throws an ambiguous match exception.');
      return steps;
    }
  }
  push(
    { phase: 'select', focus: best.id, results: { [best.id]: 'selected' } },
    'select',
    byMethod.length > 1 ? `More than one candidate is left; the most specific template wins (a literal segment beats a constrained parameter, which beats a plain one): ${best.template}.` : `One candidate is left: ${best.method} ${best.template} → ${best.action}.`,
  );

  // binding
  const bound: RouteState['bound'] = [];
  let bad: string | null = null;
  for (const prm of best.params) {
    const raw = prm.source === 'route' ? values[best.id]![prm.name] : query[prm.name];
    if (raw === undefined) bound.push({ name: prm.name, value: prm.type === 'string' ? 'null' : '0', source: `${prm.source} (missing)` });
    else if (prm.type === 'int' && !isInt(raw)) {
      bad = `"${raw}" is not a valid int for ${prm.name}`;
      bound.push({ name: prm.name, value: `error: ${bad}`, source: prm.source });
    } else bound.push({ name: prm.name, value: prm.type === 'string' ? `"${raw}"` : raw, source: prm.source === 'route' ? 'route' : 'query string' });
  }
  push(
    { phase: 'bind', bound },
    'write',
    best.params.length
      ? `Model binding fills the parameters by name: ${bound.map((b) => `${b.name} = ${b.value} (from the ${b.source})`).join(', ')}.`
      : `${best.action} takes no parameters${method === 'POST' || method === 'PUT' ? ' (in the note, the data for this one would come from the request body)' : ''}.`,
  );
  if (bad) {
    // [ApiController]'s automatic 400: https://learn.microsoft.com/aspnet/core/web-api/#automatic-http-400-responses
    push({ phase: 'done', outcome: { status: 400, text: 'Bad Request', detail: bad } }, 'done', `Binding failed (${bad}), so [ApiController] returns 400 Bad Request before the action runs. (Update has {id} without :int, so the route matched but the value can't become an int.)`);
    return steps;
  }
  push({ phase: 'done', outcome: { status: 200, text: 'OK', detail: `${best.action} runs` } }, 'done', `${best.action} runs and returns Ok().`);
  return steps;
}
