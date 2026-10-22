import { lineOf } from '../../engine/code';
import type { Step } from '../../engine/types';
import { ZERO } from '../common/zero';
import { BINDING_EXAMPLE_CODE, BINDING_FLOW_TEXT, CREATE_PRODUCT_ACTION_CODE } from '../sources-t2';

/**
 * Model binding: where each action parameter's value comes from (4.ASP_ModelBindingNMore.md › How Model Binding
 * Works and its attribute list). With [ApiController], the binding source is inferred when no attribute is given
 * (https://learn.microsoft.com/aspnet/core/web-api/#binding-source-parameter-inference):
 *   complex type → [FromBody]; name in the route template → [FromRoute]; any other parameter → [FromQuery].
 * Names match case-insensitively. A value that can't be converted adds a ModelState error, and [ApiController]
 * then answers 400 before the action runs (https://learn.microsoft.com/aspnet/core/web-api/#automatic-http-400-responses).
 */

export type Source = 'route' | 'query' | 'header' | 'body';
export const SOURCE_LABEL: Record<Source, string> = { route: 'Route', query: 'Query string', header: 'Header', body: 'Body (JSON)' };

export interface Param {
  name: string;
  type: 'int' | 'string' | 'bool' | 'CreateProductDto';
  /** explicit attribute, or null when [ApiController] infers the source */
  attribute: string | null;
  source: Source;
  /** header name for [FromHeader(Name = …)] */
  headerName?: string;
}

export interface ActionDef {
  id: 'note-example' | 'note-dto' | 'all-sources';
  label: string;
  /** code shown; `fromNote` says whether it is copied from the note */
  code: string;
  fromNote: boolean;
  method: string;
  template: string;
  params: Param[];
  /** defaults for the request editor */
  request: RequestInput;
  marker: string;
}

export interface RequestInput {
  routeValue: string;
  query: string;
  header: string;
  body: string;
}

/** An example action built from the note's attribute list (not code from the note): one parameter per source. */
export const ALL_SOURCES_CODE = `[HttpPut("{id}")]
public IActionResult Update(
    [FromRoute] int id,
    [FromQuery] bool notify,
    [FromHeader(Name = "X-Request-Id")] string requestId,
    [FromBody] CreateProductDto dto)
{
    return Ok();
}`;

export const ACTIONS: Record<ActionDef['id'], ActionDef> = {
  'note-example': {
    id: 'note-example',
    label: "Note's Example 1: route + query",
    code: BINDING_EXAMPLE_CODE,
    fromNote: true,
    method: 'GET',
    template: 'api/products/{id}',
    params: [
      { name: 'id', type: 'int', attribute: null, source: 'route' },
      { name: 'name', type: 'string', attribute: null, source: 'query' },
    ],
    request: { routeValue: '5', query: 'name=pen', header: '', body: '' },
    marker: 'public IActionResult Get(int id, string name)',
  },
  'note-dto': {
    id: 'note-dto',
    label: "Note's DTO: body",
    code: CREATE_PRODUCT_ACTION_CODE,
    fromNote: true,
    method: 'POST',
    template: 'api/products',
    params: [{ name: 'dto', type: 'CreateProductDto', attribute: null, source: 'body' }],
    request: { routeValue: '', query: '', header: '', body: '{\n  "name": "Pen",\n  "price": 10,\n  "isAdminOnly": true\n}' },
    marker: 'public IActionResult Create(CreateProductDto dto)',
  },
  'all-sources': {
    id: 'all-sources',
    label: 'All four sources (example)',
    code: ALL_SOURCES_CODE,
    fromNote: false,
    method: 'PUT',
    template: 'api/products/{id}',
    params: [
      { name: 'id', type: 'int', attribute: '[FromRoute]', source: 'route' },
      { name: 'notify', type: 'bool', attribute: '[FromQuery]', source: 'query' },
      { name: 'requestId', type: 'string', attribute: '[FromHeader(Name = "X-Request-Id")]', source: 'header', headerName: 'X-Request-Id' },
      { name: 'dto', type: 'CreateProductDto', attribute: '[FromBody]', source: 'body' },
    ],
    request: { routeValue: '5', query: 'notify=true', header: 'abc-123', body: '{\n  "Name": "Pen",\n  "price": 12.5\n}' },
    marker: 'public IActionResult Update(',
  },
};

export const FLOW = {
  routing: lineOf(BINDING_FLOW_TEXT, 'Routing (find action)'),
  binding: lineOf(BINDING_FLOW_TEXT, 'Model Binding'),
  validation: lineOf(BINDING_FLOW_TEXT, 'Model Validation'),
  action: lineOf(BINDING_FLOW_TEXT, 'Controller Action executes'),
  response: lineOf(BINDING_FLOW_TEXT, 'Response'),
};

export interface BoundValue {
  name: string;
  source: Source;
  raw: string | null;
  value: string | null;
  error: string | null;
}

export interface BindState {
  flowLine: number;
  focus: string | null;
  focusSource: Source | null;
  bound: BoundValue[];
  modelStateValid: boolean | null;
  outcome: { status: number; text: string; detail: string } | null;
  codeLines: number[];
}

export type BindStep = Step<BindState>;

/** The lines a parameter step highlights: its own line (or the signature), plus the route template for route values. */
export function paramLines(a: ActionDef, prm: Param): number[] {
  const own = a.id === 'all-sources' ? lineOf(a.code, ` ${prm.name}${prm.name === 'dto' ? ')' : ','}`) : lineOf(a.code, a.marker);
  return prm.source === 'route' && a.id !== 'all-sources' ? [lineOf(a.code, '{id}'), own] : [own];
}

/** How a raw value is quoted in the narration: body JSON collapsed onto one line, other values in quotes. */
function shown(raw: string, source: Source): string {
  const one = raw.replace(/\s+/g, ' ').trim();
  const cut = one.length > 70 ? `${one.slice(0, 70)}…` : one;
  return source === 'body' ? cut : `"${cut}"`;
}

const isInt = (s: string) => /^-?\d+$/.test(s.trim()) && Number.isSafeInteger(Number(s));
const DTO_PROPS = { name: 'Name', price: 'Price' } as const;

export function traceBinding(actionId: ActionDef['id'], req: RequestInput): BindStep[] {
  const a = ACTIONS[actionId];
  const steps: BindStep[] = [];
  let st: BindState = { flowLine: FLOW.routing, focus: null, focusSource: null, bound: [], modelStateValid: null, outcome: null, codeLines: [] };
  const push = (patch: Partial<BindState>, action: BindStep['action'], narration: string, predict?: BindStep['predict']) => {
    st = { ...st, ...patch };
    steps.push({ state: st, highlights: {}, action, codeLine: 0, narration, variables: { action: a.marker.replace(/^public IActionResult /, '').replace(/\($/, '(…)') }, counters: ZERO, predict });
  };
  const url = `/${a.template.replace('{id}', req.routeValue || '{id}')}${req.query ? `?${req.query}` : ''}`;
  const sig = lineOf(a.code, a.marker);
  push({ codeLines: [sig] }, 'start', `${a.method} ${url}. Routing (find action) has picked ${a.marker.replace('public IActionResult ', '').replace(/\(.*$/, '')}; its route template is ${a.template}. Now model binding maps data from the request to its ${a.params.length} parameter${a.params.length === 1 ? '' : 's'}.`);

  const query = new URLSearchParams(req.query);
  const bound: BoundValue[] = [];
  for (const prm of a.params) {
    const PHRASE: Record<Source, string> = { route: 'route values', query: 'query string', header: 'request headers', body: 'request body' };
    const why = prm.attribute
      ? `${prm.attribute} says: bind from the ${PHRASE[prm.source]}`
      : prm.source === 'body'
        ? `${prm.type} is a complex type, so [ApiController] infers [FromBody]`
        : prm.source === 'route'
          ? `"${prm.name}" is a parameter in the route template, so [ApiController] infers [FromRoute]`
          : `"${prm.name}" isn't in the route template and is a simple type, so [ApiController] infers [FromQuery]`;
    let raw: string | null = null;
    let value: string | null = null;
    let error: string | null = null;
    if (prm.source === 'route') raw = req.routeValue || null;
    if (prm.source === 'query') {
      const hit = [...query.keys()].find((k) => k.toLowerCase() === prm.name.toLowerCase());
      raw = hit !== undefined ? query.get(hit) : null;
    }
    if (prm.source === 'header') raw = req.header || null;
    if (prm.source === 'body') raw = req.body.trim() || null;

    if (prm.type === 'int') {
      if (raw === null) value = '0';
      else if (isInt(raw)) value = String(Number(raw));
      else error = `"${raw}" can't be converted to int`;
    } else if (prm.type === 'bool') {
      if (raw === null) value = 'false';
      else if (/^(true|false)$/i.test(raw.trim())) value = raw.trim().toLowerCase();
      else error = `"${raw}" can't be converted to bool`;
    } else if (prm.type === 'string') {
      value = raw === null ? 'null' : `"${raw}"`;
    } else {
      if (raw === null) error = 'A non-empty request body is required.';
      else {
        try {
          const j = JSON.parse(raw) as unknown;
          if (!j || typeof j !== 'object' || Array.isArray(j)) error = 'The JSON value could not be converted to CreateProductDto.';
          else {
            const out: string[] = [];
            const ignored: string[] = [];
            for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
              const prop = DTO_PROPS[k.toLowerCase() as keyof typeof DTO_PROPS];
              if (!prop) ignored.push(k);
              else if (prop === 'Price' && typeof v !== 'number') error = `"${k}": ${JSON.stringify(v)} is not a number for Price`;
              else if (prop === 'Name' && typeof v !== 'string' && v !== null) error = `"${k}": ${JSON.stringify(v)} is not a string for Name`;
              else out.push(`${prop} = ${JSON.stringify(v)}`);
            }
            value = `{ ${out.join(', ') || 'no matching properties'} }${ignored.length ? ` (ignored: ${ignored.join(', ')})` : ''}`;
          }
        } catch {
          error = 'The request body is not valid JSON.';
        }
      }
    }
    bound.push({ name: prm.name, source: prm.source, raw, value: error ? null : value, error });
    const where = prm.source === 'header' ? `header ${prm.headerName}` : prm.source === 'route' ? 'route value {id}' : prm.source === 'query' ? `query key "${prm.name}"` : 'request body';
    const extra =
      prm.type === 'CreateProductDto' && !error && value?.includes('ignored')
        ? ' Properties the DTO doesn\'t have are ignored: that is why the note uses a DTO against overposting.'
        : prm.source === 'query' && raw === null
          ? ' The key is missing, so the parameter gets its default value.'
          : prm.type === 'CreateProductDto' && !error
            ? ' The JSON input formatter matches property names case-insensitively ("name" fills Name).'
            : '';
    push(
      { flowLine: FLOW.binding, focus: prm.name, focusSource: prm.source, bound: [...bound], codeLines: paramLines(a, prm) },
      error ? 'branch' : 'write',
      `${prm.type} ${prm.name}: ${why}. It reads the ${where}: ${raw === null ? 'nothing there' : shown(raw, prm.source)}. ${error ? `Binding fails: ${error} ModelState records the error.` : `${prm.name} = ${value}.`}${extra}`,
      { question: `Where does ${prm.name} come from?`, options: (['route', 'query', 'header', 'body'] as Source[]).map((x) => SOURCE_LABEL[x]), answer: (['route', 'query', 'header', 'body'] as Source[]).indexOf(prm.source) },
    );
  }

  const errors = bound.filter((b) => b.error);
  push(
    { flowLine: FLOW.validation, focus: null, focusSource: null, modelStateValid: errors.length === 0, codeLines: [] },
    'compare',
    errors.length ? `Model validation: ModelState has ${errors.length} error${errors.length > 1 ? 's' : ''} (${errors.map((e) => e.name).join(', ')}), so ModelState.IsValid is false.` : 'Model validation: no binding errors (and no validation attributes on these parameters), so ModelState.IsValid is true.',
    { question: 'Does the action run?', options: ['Yes', 'No: 400 Bad Request'], answer: errors.length ? 1 : 0 },
  );
  if (errors.length) {
    push(
      { flowLine: FLOW.response, outcome: { status: 400, text: 'Bad Request', detail: 'ValidationProblemDetails with the errors per field' } },
      'done',
      '[ApiController] turns an invalid ModelState into an automatic 400 Bad Request (a ValidationProblemDetails body) before the action runs. The action never sees bad input.',
    );
    return steps;
  }
  push({ flowLine: FLOW.action, codeLines: [sig] }, 'call', `The action executes with ${bound.map((b) => `${b.name} = ${b.value}`).join(', ')}.`);
  push({ flowLine: FLOW.response, outcome: { status: 200, text: 'OK', detail: 'Ok(…)' } }, 'done', 'It returns Ok(…): 200 OK.');
  return steps;
}
