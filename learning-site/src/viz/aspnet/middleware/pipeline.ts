import { lineOf } from '../../engine/code';
import type { Prediction, Step, Trace } from '../../engine/types';
import { ZERO } from '../common/zero';
import { MIDDLEWARE_FLOW_TEXT, PRODUCTION_ORDER_CODE } from '../sources';

/**
 * Request pipeline traces for 8.ASP_MiddlewareNMore.md.
 *
 * Two pictures:
 * - "in-and-out": the note's Request -> A -> B -> C -> Controller -> C -> B -> A -> Response diagram,
 *   with an optional short-circuit at any middleware.
 * - "production-order": the note's Final Production Order, which the learner can reorder, run against a
 *   sample request. Each middleware's behaviour comes from the note's "What it does" / "Important" lines;
 *   where the note doesn't say what a wrong order does, the behaviour is taken from Microsoft Learn (URLs
 *   next to each rule below). It is a model of the decisions each middleware makes, not of every detail.
 */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);


// ── in-and-out ───────────────────────────────────────────────────────────────────────────────

export type RowStatus = 'idle' | 'in' | 'out' | 'current' | 'short' | 'skipped' | 'done';

export interface FlowState {
  rows: string[];
  /** index of the row the request is at; -1 = not yet in the app, rows.length = back at the client */
  at: number;
  dir: 'in' | 'out';
  status: RowStatus[];
  shortAt: number | null;
  /** token index in the note's two-line diagram that this step corresponds to, or null */
  hop: { line: 0 | 1; index: number } | null;
  /** tokens of the note diagram that this run skips */
  skipped: { line: 0 | 1; index: number }[];
}

export type FlowStep = Step<FlowState>;

/** The note's diagram split into the hops it names. */
export function flowTokens(text = MIDDLEWARE_FLOW_TEXT): string[][] {
  return text.split('\n').map((l) => l.split('->').map((t) => t.trim()).filter(Boolean));
}

/**
 * The note's flow: each middleware runs code before `await next(context);`, the controller runs, then each
 * middleware runs its code after `next` in reverse order. With `shortCircuitAt = k` the k-th middleware
 * doesn't call next: it writes the response itself, and the response goes back through the ones before it.
 */
export function traceInAndOut(middleware: readonly string[] = ['A', 'B', 'C'], shortCircuitAt: number | null = null): Trace<FlowState> {
  const names = middleware.length ? [...middleware] : ['A', 'B', 'C'];
  const rows = [...names.map((n) => `Middleware ${n}`), 'Controller'];
  const ctrl = rows.length - 1;
  const short = shortCircuitAt !== null && shortCircuitAt >= 0 && shortCircuitAt < names.length ? shortCircuitAt : null;
  const steps: FlowStep[] = [];
  const status: RowStatus[] = rows.map(() => 'idle');
  // The note's diagram: line 0 = Request, A, B, C, Controller; line 1 = C, B, A, Response
  const n = names.length;
  const inHop = (i: number) => ({ line: 0 as const, index: i + 1 });
  const outHop = (i: number) => ({ line: 1 as const, index: n - 1 - i });
  const deepest = short ?? ctrl;
  const skipped: FlowState['skipped'] = [];
  if (short !== null) {
    for (let i = short + 1; i <= ctrl; i++) skipped.push({ line: 0, index: i + 1 });
    for (let i = short; i < n; i++) skipped.push({ line: 1, index: n - 1 - i });
  }
  const push = (s: Omit<FlowState, 'rows' | 'status' | 'shortAt' | 'skipped'>, narration: string, extra: Partial<FlowStep> = {}) =>
    steps.push({
      state: { rows, status: [...status], shortAt: short, skipped, ...s },
      highlights: {},
      action: extra.action ?? 'call',
      codeLine: 1,
      narration,
      variables: extra.variables ?? {},
      counters: ZERO,
      predict: extra.predict,
    });

  push({ at: -1, dir: 'in', hop: { line: 0, index: 0 } }, 'A request arrives. Each middleware gets the HttpContext and a reference to the next middleware in the pipeline.', {
    action: 'start',
    variables: { direction: 'in' },
  });
  for (let i = 0; i <= deepest; i++) {
    if (i === ctrl) {
      status[i] = 'current';
      push({ at: i, dir: 'in', hop: inHop(i) }, 'The controller runs and produces the response. Nothing comes after it, so from here the response travels back out.', {
        action: 'call',
        variables: { direction: 'in → out', at: 'Controller' },
      });
      status[i] = 'done';
      break;
    }
    status[i] = 'current';
    const isShort = i === short;
    const predict: Prediction | undefined =
      i === 0 || isShort
        ? {
            question: `What does Middleware ${names[i]} do after its "before" code?`,
            options: ['Calls await next(context)', 'Writes the response itself (short-circuit)'],
            answer: isShort ? 1 : 0,
          }
        : undefined;
    if (isShort) {
      push(
        { at: i, dir: 'in', hop: inHop(i) },
        `Middleware ${names[i]} does its work but doesn't call next. It writes the response itself, so the pipeline is short-circuited: ${rows.slice(i + 1).join(', ')} never see the request.`,
        { action: 'branch', variables: { direction: 'in', at: rows[i]!, 'next called': false }, predict },
      );
      status[i] = 'short';
    } else {
      push(
        { at: i, dir: 'in', hop: inHop(i) },
        `Middleware ${names[i]} runs its code before await next(context); then calls next, which hands the request to ${rows[i + 1]}.`,
        { action: 'call', variables: { direction: 'in', at: rows[i]!, 'next called': true }, predict },
      );
      status[i] = 'in';
    }
  }
  const backFrom = short === null ? n - 1 : short - 1;
  for (let i = backFrom; i >= 0; i--) {
    status[i] = 'current';
    push(
      { at: i, dir: 'out', hop: outHop(i) },
      `Back in Middleware ${names[i]}: await next(context) has returned, so the code after it runs. It can read or change the response on its way out.`,
      { action: 'return', variables: { direction: 'out', at: rows[i]! } },
    );
    status[i] = 'out';
  }
  const order = short === null ? names : names.slice(0, short + 1);
  push(
    { at: rows.length, dir: 'out', hop: { line: 1, index: n } },
    short === null
      ? `The response leaves the app. In: ${order.join(' → ')} → Controller. Out: ${[...order].reverse().join(' → ')}. That "before and after" pattern is the key.`
      : `The response leaves the app. Only ${order.join(' → ')} ran; Middleware ${names[short]} short-circuited, so the response went back through ${order.slice(0, -1).reverse().join(' → ') || 'nothing else'}.`,
    { action: 'done', variables: { direction: 'out', at: 'client' } },
  );
  return steps;
}

// ── production order ─────────────────────────────────────────────────────────────────────────

export type MwId = 'exception' | 'static' | 'routing' | 'cors' | 'authn' | 'authz' | 'ratelimit';

export interface MwInfo {
  id: MwId;
  name: string;
  /** the line from the note's Final Production Order */
  line: string;
}

const prodLines = PRODUCTION_ORDER_CODE.split('\n').filter((l) => l.trim());
const lineFor = (call: string) => {
  const l = prodLines.find((x) => x.startsWith(call));
  if (!l) throw new Error(`Production order line not found: ${call}`);
  return l;
};

export const MIDDLEWARE: Record<MwId, MwInfo> = {
  exception: { id: 'exception', name: 'UseExceptionHandler', line: lineFor('app.UseExceptionHandler(') },
  static: { id: 'static', name: 'UseStaticFiles', line: lineFor('app.UseStaticFiles(') },
  routing: { id: 'routing', name: 'UseRouting', line: lineFor('app.UseRouting(') },
  cors: { id: 'cors', name: 'UseCors', line: lineFor('app.UseCors(') },
  authn: { id: 'authn', name: 'UseAuthentication', line: lineFor('app.UseAuthentication(') },
  authz: { id: 'authz', name: 'UseAuthorization', line: lineFor('app.UseAuthorization(') },
  ratelimit: { id: 'ratelimit', name: 'UseRateLimiter', line: lineFor('app.UseRateLimiter(') },
};
export const ENDPOINT_LINE = lineFor('app.MapControllers(');

/** The note's order. */
export const NOTE_ORDER: MwId[] = ['exception', 'static', 'routing', 'cors', 'authn', 'authz', 'ratelimit'];

/** Program.cs for an order: the note's block itself for the note's order, otherwise its lines in the new order. */
export function programFor(order: readonly MwId[]): string {
  if (sameOrder(order, NOTE_ORDER)) return PRODUCTION_ORDER_CODE;
  return [...order.map((id) => MIDDLEWARE[id].line), ENDPOINT_LINE].join('\n');
}
export const sameOrder = (a: readonly MwId[], b: readonly MwId[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function lineInProgram(order: readonly MwId[], id: MwId | 'endpoint'): number {
  const code = programFor(order);
  return lineOf(code, id === 'endpoint' ? ENDPOINT_LINE : MIDDLEWARE[id].line);
}

/** Endpoints of the sample API (descriptions, not code from the notes). */
export interface EndpointInfo {
  display: string;
  /** null = no [Authorize]; {} = [Authorize]; { roles } = [Authorize(Roles = ...)] */
  authorize: null | { roles?: string };
  /** [EnableRateLimiting("fixed")] from the note's UseRateLimiter step 3 */
  rateLimit: boolean;
}
const ENDPOINTS: Record<string, EndpointInfo> = {
  '/api/tasks': { display: 'TasksController.GetAll', authorize: {}, rateLimit: true },
  '/api/admin/reports': { display: 'AdminController.Reports', authorize: { roles: 'Admin' }, rateLimit: false },
};
/** Files in wwwroot (the note's example: wwwroot/logo.png). */
const WWWROOT = new Set(['/logo.png']);

export type SampleId = 'valid-token' | 'no-token' | 'wrong-role' | 'throws' | 'static-file' | 'cross-origin' | 'rate-limited';

export interface SampleRequest {
  id: SampleId;
  label: string;
  method: 'GET';
  path: string;
  /** role carried by a valid JWT, or null for no Authorization header */
  token: string | null;
  origin?: string;
  /** the controller action throws */
  throws?: boolean;
  /** 8th request inside one 10 s window of the note's "fixed" limiter (PermitLimit 5, QueueLimit 2) */
  limitUsedUp?: boolean;
  describe: string;
}

export const SAMPLES: Record<SampleId, SampleRequest> = {
  'valid-token': { id: 'valid-token', label: 'Valid token', method: 'GET', path: '/api/tasks', token: 'User', describe: 'GET /api/tasks with a valid JWT (role User). The action has [Authorize].' },
  'no-token': { id: 'no-token', label: 'No token', method: 'GET', path: '/api/tasks', token: null, describe: 'GET /api/tasks without an Authorization header. The action has [Authorize].' },
  'wrong-role': { id: 'wrong-role', label: 'Wrong role', method: 'GET', path: '/api/admin/reports', token: 'User', describe: 'GET /api/admin/reports with a valid JWT whose role is User. The action has [Authorize(Roles = "Admin")].' },
  throws: { id: 'throws', label: 'Action throws', method: 'GET', path: '/api/tasks', token: 'User', throws: true, describe: 'GET /api/tasks with a valid JWT, but the action throws an exception.' },
  'static-file': { id: 'static-file', label: 'Static file', method: 'GET', path: '/logo.png', token: null, describe: 'GET /logo.png (a file in wwwroot), no token.' },
  'cross-origin': {
    id: 'cross-origin',
    label: 'Cross-origin, no token',
    method: 'GET',
    path: '/api/tasks',
    token: null,
    origin: 'http://localhost:3000',
    describe: 'The frontend on http://localhost:3000 calls GET /api/tasks before logging in (no token).',
  },
  'rate-limited': {
    id: 'rate-limited',
    label: 'Over the rate limit',
    method: 'GET',
    path: '/api/tasks',
    token: 'User',
    limitUsedUp: true,
    describe: 'The 8th GET /api/tasks inside one 10-second window: the "fixed" limiter (PermitLimit 5, QueueLimit 2) has 5 permits used and 2 requests queued.',
  },
};

export interface HttpCtx {
  endpoint: string | null;
  user: string;
  cors: boolean;
  response: { status: number; text: string } | null;
  exception: string | null;
}

export interface PipeState {
  order: MwId[];
  /** row index (order.length = endpoint); -1 = client before; order.length + 1 = client after */
  at: number;
  dir: 'in' | 'out';
  status: RowStatus[];
  /** rows covered by the exception handler's try/catch: [from, to] inclusive, to = endpoint row */
  covered: [number, number] | null;
  shortAt: number | null;
  ctx: HttpCtx;
  /** final outcome once known */
  outcome: Outcome | null;
}

export interface Outcome {
  status: number;
  text: string;
  /** what the client actually experiences, e.g. the browser blocking a response without CORS headers */
  client: string;
  blocked?: boolean;
}

export type PipeStep = Step<PipeState>;

export interface PipelineOptions {
  /** FallbackPolicy = RequireAuthenticatedUser (note 10 "The Fallback Policy"; the capstone uses it) */
  fallbackPolicy?: boolean;
}

/**
 * Runs one sample request through the given order. Returns every step: each middleware on the way in,
 * the endpoint (or the short-circuit), each middleware on the way out, and what the client gets.
 */
export function tracePipeline(order: readonly MwId[], sampleId: SampleId, opts: PipelineOptions = {}): Trace<PipeState> {
  const sample = SAMPLES[sampleId];
  const fallback = Boolean(opts.fallbackPolicy);
  const rows = [...order];
  const E = rows.length; // endpoint row
  const status: RowStatus[] = [...rows.map(() => 'idle' as RowStatus), 'idle'];
  const ctx: HttpCtx = { endpoint: null, user: 'anonymous', cors: false, response: null, exception: null };
  let authzSawEndpoint = false;
  let covered: [number, number] | null = null;
  let shortAt: number | null = null;
  let outcome: Outcome | null = null;
  const steps: PipeStep[] = [];
  const code = programFor(rows);
  const lineAt = (i: number) => (i >= E ? lineOf(code, ENDPOINT_LINE) : lineOf(code, MIDDLEWARE[rows[i]!].line));
  const vars = (at: string): Record<string, string> => ({
    request: `${sample.method} ${sample.path}`,
    at,
    'HttpContext.User': ctx.user,
    endpoint: ctx.endpoint ?? 'null',
    response: ctx.response ? `${ctx.response.status} ${ctx.response.text}` : ctx.exception ? 'exception in flight' : '—',
  });
  const push = (at: number, dir: 'in' | 'out', action: PipeStep['action'], narration: string, predict?: Prediction, line?: number) =>
    steps.push({
      state: { order: rows, at, dir, status: [...status], covered, shortAt, ctx: { ...ctx, response: ctx.response && { ...ctx.response } }, outcome },
      highlights: {},
      action,
      codeLine: line ?? (at >= 0 && at <= E ? lineAt(at) : 0),
      narration,
      variables: vars(at < 0 ? 'client' : at > E ? 'client' : at === E ? 'endpoint' : MIDDLEWARE[rows[at]!].name),
      counters: ZERO,
      predict,
    });

  push(-1, 'in', 'start', `${sample.describe} The request enters the pipeline at the top of Program.cs.`);

  // ── inbound ──
  let deepest = -1;
  for (let i = 0; i <= E; i++) {
    deepest = i;
    status[i] = 'current';
    if (i === E) {
      // the endpoint: MapControllers' endpoints run at the end of the pipeline
      const ep = ctx.endpoint ? ENDPOINTS[sample.path] : undefined;
      const predict: Prediction = {
        question: 'What happens when the endpoint runs?',
        options: ['The action returns 200 OK', 'An exception is thrown', 'No endpoint matched: 404'],
        answer: !ep ? 2 : ep.authorize && !authzSawEndpoint ? 1 : sample.throws ? 1 : 0,
      };
      if (!ep) {
        ctx.response = { status: 404, text: 'Not Found' };
        push(i, 'in', 'branch', `No endpoint matched ${sample.path}, so nothing handles the request and the app returns 404 Not Found.`, predict);
      } else if (ep.authorize && !authzSawEndpoint) {
        // https://source.dot.net/Microsoft.AspNetCore.Routing/EndpointMiddleware.cs.html (the check and its message)
        // https://learn.microsoft.com/aspnet/core/diagnostics/asp0001 (UseAuthorization before UseRouting "is not endpoint aware")
        ctx.exception = 'InvalidOperationException';
        push(
          i,
          'in',
          'branch',
          `${ep.display} has [Authorize], but UseAuthorization never saw this endpoint (it ran before UseRouting picked it). ASP.NET Core refuses to run it unprotected and throws InvalidOperationException: "contains authorization metadata, but a middleware was not found that supports authorization."`,
          predict,
        );
      } else if (sample.throws) {
        ctx.exception = 'Exception';
        push(i, 'in', 'branch', `${ep.display} runs and throws an exception. The exception travels back up the pipeline until something catches it.`, predict);
      } else {
        ctx.response = { status: 200, text: 'OK' };
        push(i, 'in', 'call', `${ep.display} runs and returns 200 OK with the tasks as JSON. Now the response travels back out.`, predict);
      }
      status[i] = 'done';
      break;
    }
    const id = rows[i]!;
    const r = inbound(id, i);
    if (r === 'short') {
      status[i] = 'short';
      shortAt = i;
      for (let k = i + 1; k <= E; k++) status[k] = 'skipped';
      break;
    }
    status[i] = 'in';
  }

  function inbound(id: MwId, i: number): 'next' | 'short' {
    const ep = ctx.endpoint ? ENDPOINTS[sample.path] : undefined;
    switch (id) {
      case 'exception':
        covered = [i, E];
        push(i, 'in', 'call', 'UseExceptionHandler wraps everything after it: it calls next inside a try/catch, so it can catch exceptions thrown by the middleware and endpoint that follow it.');
        return 'next';
      case 'static': {
        const isFile = WWWROOT.has(sample.path);
        const predict: Prediction = { question: `Does UseStaticFiles handle ${sample.path}?`, options: ['No, it calls next', 'Yes: it serves the file and short-circuits'], answer: isFile ? 1 : 0 };
        if (isFile) {
          ctx.response = { status: 200, text: 'OK (image/png)' };
          const before = rows.slice(0, i).filter((x) => x !== 'exception').map((x) => MIDDLEWARE[x].name);
          push(
            i,
            'in',
            'branch',
            `UseStaticFiles finds logo.png in wwwroot, writes it and doesn't call next: the pipeline is short-circuited.${before.length ? ` ${before.join(', ')} already ran for a plain file, work the note's "Should come early" avoids.` : ' Nothing after it runs, which is why the note says it should come early.'}`,
            predict,
          );
          return 'short';
        }
        push(i, 'in', 'call', `${sample.path} isn't a file in wwwroot, so UseStaticFiles calls next.`, predict);
        return 'next';
      }
      case 'routing': {
        const match = ENDPOINTS[sample.path];
        ctx.endpoint = match ? match.display : null;
        push(
          i,
          'in',
          'call',
          match
            ? `UseRouting matches ${sample.path} to ${match.display} and stores it in HttpContext. It doesn't run it; it only selects the endpoint.`
            : `UseRouting finds no endpoint for ${sample.path}; HttpContext's endpoint stays null.`,
        );
        return 'next';
      }
      case 'cors': {
        if (!sample.origin) {
          push(i, 'in', 'call', 'No Origin header, so this isn\'t a cross-origin request: UseCors has nothing to add and calls next.');
          return 'next';
        }
        ctx.cors = true;
        push(i, 'in', 'call', `UseCors("AllowFrontend") sees Origin: ${sample.origin}, which the policy allows (WithOrigins("http://localhost:3000")), so the response will carry Access-Control-Allow-Origin.`);
        return 'next';
      }
      case 'authn': {
        if (sample.token) {
          ctx.user = `authenticated (role ${sample.token})`;
          push(i, 'in', 'call', `UseAuthentication reads the Bearer token, validates it and creates HttpContext.User with role ${sample.token}. It identifies who the user is.`);
        } else {
          push(i, 'in', 'call', 'No token. UseAuthentication leaves HttpContext.User anonymous and calls next anyway: it "doesn\'t block requests by itself".');
        }
        return 'next';
      }
      case 'authz':
        return authorize(i, ep);
      case 'ratelimit': {
        const predict: Prediction = { question: 'Does the rate limiter let this request through?', options: ['Yes, it calls next', 'No, it rejects it'], answer: ep?.rateLimit && sample.limitUsedUp ? 1 : 0 };
        if (!ctx.endpoint) {
          // https://learn.microsoft.com/aspnet/core/performance/rate-limit#fixed-window-limiter
          push(
            i,
            'in',
            'call',
            sample.limitUsedUp
              ? 'UseRateLimiter runs before UseRouting, so the endpoint is still null and [EnableRateLimiting("fixed")] on the action is invisible. There is no global limiter, so the 8th request goes straight through: the limit silently does nothing. (Microsoft Learn: UseRateLimiter must be called after UseRouting when endpoint-specific policies are used.)'
              : 'UseRateLimiter runs before UseRouting, so it can\'t see the action\'s [EnableRateLimiting("fixed")]. With no global limiter, nothing is limited and it calls next.',
            predict,
          );
          return 'next';
        }
        if (!ep?.rateLimit) {
          push(i, 'in', 'call', `${ctx.endpoint} has no rate limiting policy, so UseRateLimiter calls next.`, predict);
          return 'next';
        }
        if (sample.limitUsedUp) {
          // RejectionStatusCode defaults to 503: note 15 "Global Rejection Handling" and
          // https://learn.microsoft.com/dotnet/api/microsoft.aspnetcore.ratelimiting.ratelimiteroptions.rejectionstatuscode
          ctx.response = { status: 503, text: 'Service Unavailable' };
          push(
            i,
            'in',
            'branch',
            'The "fixed" limiter has no permit left (5 used) and its queue is full (QueueLimit = 2), so UseRateLimiter rejects the request and short-circuits. The note\'s setup here doesn\'t set RejectionStatusCode, so the default 503 is used; note 15 sets it to 429.',
            predict,
          );
          return 'short';
        }
        push(i, 'in', 'call', 'The "fixed" limiter has a permit available, so UseRateLimiter takes it and calls next.', predict);
        return 'next';
      }
    }
  }

  function authorize(i: number, ep: EndpointInfo | undefined): 'next' | 'short' {
    const anonymous = ctx.user === 'anonymous';
    const tokenButNoUser = anonymous && Boolean(sample.token);
    let requirement: 'none' | 'authenticated' | 'role' = 'none';
    let source = '';
    if (!ctx.endpoint) {
      // https://learn.microsoft.com/aspnet/core/fundamentals/routing ("The endpoint is always null before UseRouting is called")
      // https://learn.microsoft.com/aspnet/core/diagnostics/asp0001 (the fallback policy, if configured, is used)
      const routingRan = rows.indexOf('routing') < i;
      const why = routingRan
        ? ` No endpoint matched ${sample.path},`
        : ' It runs before UseRouting, and the endpoint is always null before UseRouting, so it can\'t see [Authorize] on the action:';
      if (fallback) {
        requirement = 'authenticated';
        source = `${why} so only the FallbackPolicy applies, and it requires an authenticated user.`;
      } else {
        source = `${why} and there is no FallbackPolicy, so there is nothing to check.`;
      }
    } else {
      authzSawEndpoint = true;
      if (ep?.authorize?.roles) requirement = 'role';
      else if (ep?.authorize) requirement = 'authenticated';
      else if (fallback) requirement = 'authenticated';
    }
    const willChallenge = requirement !== 'none' && anonymous;
    const willForbid = requirement === 'role' && !anonymous && sample.token !== ep?.authorize?.roles;
    const predict: Prediction = {
      question: 'What does UseAuthorization do with this request?',
      options: ['Calls next', 'Short-circuits with 401 Unauthorized', 'Short-circuits with 403 Forbidden'],
      answer: willChallenge ? 1 : willForbid ? 2 : 0,
    };
    if (requirement === 'none') {
      push(i, 'in', 'call', `${source ? source.trim() : `${ctx.endpoint} has no [Authorize] and there is no FallbackPolicy.`} UseAuthorization calls next.`, predict);
      return 'next';
    }
    const lead = source ? `${source.trim()} ` : '';
    const rule = requirement === 'role' ? `[Authorize(Roles = "${ep?.authorize?.roles}")]` : ctx.endpoint && ep?.authorize ? '[Authorize]' : 'the FallbackPolicy';
    if (willChallenge) {
      // https://learn.microsoft.com/aspnet/core/security/authentication (Challenge: JWT bearer returns 401 with www-authenticate: bearer)
      ctx.response = { status: 401, text: 'Unauthorized' };
      push(
        i,
        'in',
        'branch',
        `${lead}${
          tokenButNoUser
            ? `${cap(rule)} needs an authenticated user. The request does carry a valid token, but UseAuthentication hasn't run yet, so HttpContext.User is still anonymous. Authorization challenges: 401 Unauthorized with WWW-Authenticate: Bearer.`
            : `${cap(rule)} needs an authenticated user and HttpContext.User is anonymous, so authorization challenges: 401 Unauthorized with WWW-Authenticate: Bearer.`
        }`,
        predict,
      );
      return 'short';
    }
    if (willForbid) {
      ctx.response = { status: 403, text: 'Forbidden' };
      push(i, 'in', 'branch', `The user is authenticated but has role ${sample.token}, not ${ep?.authorize?.roles}. ${rule} fails, so authorization forbids: 403 Forbidden (logged in, but no permission).`, predict);
      return 'short';
    }
    push(i, 'in', 'call', `${lead}${cap(rule)} is satisfied: HttpContext.User is ${ctx.user}. UseAuthorization calls next.`, predict);
    return 'next';
  }

  // ── outbound ──
  const startBack = shortAt !== null ? shortAt - 1 : deepest - 1;
  for (let i = startBack; i >= 0; i--) {
    status[i] = 'current';
    const id = rows[i]!;
    if (id === 'exception' && ctx.exception) {
      const what = ctx.exception;
      ctx.exception = null;
      ctx.response = { status: 500, text: 'Internal Server Error (safe error response)' };
      push(
        i,
        'out',
        'branch',
        `UseExceptionHandler catches the ${what} on its way out and returns a safe 500 response instead of a crash or a stack trace.`,
        { question: 'An exception is travelling back. What does UseExceptionHandler do?', options: ['Passes it on', 'Catches it and returns a safe 500 response'], answer: 1 },
      );
    } else {
      push(
        i,
        'out',
        'return',
        ctx.exception
          ? `The exception passes back through ${MIDDLEWARE[id].name}, which doesn't catch it.`
          : id === 'exception'
            ? 'Back in UseExceptionHandler: no exception came back, so it passes the response on.'
            : `Back in ${MIDDLEWARE[id].name}: next has returned and the response passes back through it.`,
      );
    }
    status[i] = 'out';
  }

  // ── the client ──
  if (ctx.exception) {
    ctx.exception = null;
    ctx.response = { status: 500, text: 'Internal Server Error (empty body)' };
    outcome = { status: 500, text: 'Internal Server Error', client: 'Nothing caught the exception, so the server returns a bare 500 with no body.' };
  } else {
    const res = ctx.response ?? { status: 200, text: 'OK' };
    if (sample.origin && !ctx.cors) {
      outcome = {
        status: res.status,
        text: res.text,
        blocked: true,
        client: `The server sent ${res.status}, but without Access-Control-Allow-Origin, so the browser blocks it: the frontend sees a CORS error, not the ${res.status}. (Microsoft Learn: UseCors before UseAuthorization ensures CORS headers are included for both authorized and unauthorized calls.)`,
      };
    } else if (sample.origin) {
      outcome = { status: res.status, text: res.text, client: `The response carries Access-Control-Allow-Origin: ${sample.origin}, so the browser lets the frontend read the ${res.status} and react to it (for example by showing the login page).` };
    } else {
      outcome = { status: res.status, text: res.text, client: `The client receives ${res.status} ${res.text}.` };
    }
  }
  push(E + 1, 'out', 'done', outcome.client, undefined, 0);
  return steps;
}

// ── order rules ──────────────────────────────────────────────────────────────────────────────

export interface OrderRule {
  id: string;
  text: string;
  source: 'note' | 'Microsoft Learn';
  /** URL for Microsoft Learn rules */
  url?: string;
  ok: boolean;
}

/** The ordering rules from the note's "⚠️ Important" / "⚠️ Order" lines and Microsoft Learn, checked for an order. */
export function checkOrder(order: readonly MwId[]): OrderRule[] {
  const at = (id: MwId) => order.indexOf(id);
  return [
    { id: 'exception-first', text: 'UseExceptionHandler: "Must be FIRST in pipeline."', source: 'note', ok: at('exception') === 0 },
    { id: 'static-early', text: 'UseStaticFiles: "Should come early" (before authentication and authorization).', source: 'note', ok: at('static') < at('authn') && at('static') < at('authz') },
    { id: 'routing-before-auth', text: 'UseRouting: "Must come before authentication/authorization because they need endpoint info."', source: 'note', ok: at('routing') < at('authn') && at('routing') < at('authz') },
    { id: 'authn-before-authz', text: 'UseAuthentication: "Must come before UseAuthorization()".', source: 'note', ok: at('authn') < at('authz') },
    {
      id: 'cors-between',
      text: 'UseCors must be placed after UseRouting, but before UseAuthorization (and should be before UseAuthentication).',
      source: 'Microsoft Learn',
      url: 'https://learn.microsoft.com/aspnet/core/security/cors',
      ok: at('cors') > at('routing') && at('cors') < at('authz') && at('cors') < at('authn'),
    },
    {
      id: 'ratelimit-after-routing',
      text: 'UseRateLimiter must be called after UseRouting when endpoint-specific policies such as [EnableRateLimiting] are used.',
      source: 'Microsoft Learn',
      url: 'https://learn.microsoft.com/aspnet/core/performance/rate-limit',
      ok: at('ratelimit') > at('routing'),
    },
  ];
}

/** Ready-made mistakes to try, each with the sample request that shows its consequence. */
export const ORDER_PRESETS: { id: string; label: string; order: MwId[]; sample: SampleId; fallbackPolicy?: boolean }[] = [
  { id: 'note', label: "The note's order", order: NOTE_ORDER, sample: 'valid-token' },
  { id: 'authz-first', label: 'Authorization before authentication', order: ['exception', 'static', 'routing', 'cors', 'authz', 'authn', 'ratelimit'], sample: 'valid-token' },
  { id: 'routing-late', label: 'Routing after authorization', order: ['exception', 'static', 'cors', 'authn', 'authz', 'routing', 'ratelimit'], sample: 'valid-token' },
  { id: 'exception-last', label: 'Exception handler last', order: ['static', 'routing', 'cors', 'authn', 'authz', 'ratelimit', 'exception'], sample: 'throws' },
  { id: 'static-after-auth', label: 'Static files after auth', order: ['exception', 'routing', 'cors', 'authn', 'authz', 'static', 'ratelimit'], sample: 'static-file', fallbackPolicy: true },
  { id: 'cors-after-authz', label: 'CORS after authorization', order: ['exception', 'static', 'routing', 'authn', 'authz', 'cors', 'ratelimit'], sample: 'cross-origin' },
  { id: 'ratelimit-first', label: 'Rate limiter before routing', order: ['exception', 'ratelimit', 'static', 'routing', 'cors', 'authn', 'authz'], sample: 'rate-limited' },
];
