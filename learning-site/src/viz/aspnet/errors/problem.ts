import { lineOf } from '../../engine/code';
import type { Step } from '../../engine/types';
import { ZERO } from '../common/zero';
import { CAP_EXCEPTION_HANDLE, CAP_EXCEPTION_INVOKE, EXCEPTION_FLOW_TEXT, EXCEPTION_HANDLER_CODE, EXCEPTION_MIDDLEWARE_CODE } from '../sources-t2';

/**
 * Global exception handling → response body, for three implementations from the notes and the capstone:
 * - the note's IExceptionHandler (ProblemDetails),
 * - the note's first ExceptionHandlingMiddleware (an anonymous { message, status, traceId } object),
 * - the capstone's GlobalExceptionMiddleware (ProblemDetails; hides the message for 500s).
 * Each mapping is the `switch` in that code; C# switch arms are tried top to bottom and the first type pattern the
 * exception matches wins. ProblemDetails is the RFC 9457 (formerly RFC 7807) "problem details" object; ASP.NET Core
 * writes its members as type, title, status, detail, instance, then the extensions, and leaves out null ones.
 * https://www.rfc-editor.org/rfc/rfc9457 · https://learn.microsoft.com/aspnet/core/fundamentals/error-handling-api
 */

export type ImplId = 'note-handler' | 'note-middleware' | 'capstone';
export type ExceptionId = 'Exception' | 'ArgumentException' | 'KeyNotFoundException' | 'UnauthorizedAccessException' | 'NotFoundException' | 'ValidationException';

export const EXCEPTIONS: { id: ExceptionId; message: string; label: string }[] = [
  // "Database failed" is the note's own example detail
  { id: 'Exception', message: 'Database failed', label: 'Exception("Database failed")' },
  { id: 'ArgumentException', message: 'Title is too long', label: 'ArgumentException' },
  { id: 'KeyNotFoundException', message: 'Product 42 was not found', label: 'KeyNotFoundException' },
  { id: 'UnauthorizedAccessException', message: 'Attempted to perform an unauthorized operation.', label: 'UnauthorizedAccessException' },
  { id: 'NotFoundException', message: 'Task not found', label: 'NotFoundException (capstone)' },
  { id: 'ValidationException', message: 'Due date is in the past', label: 'ValidationException (capstone)' },
];

interface Arm {
  type: ExceptionId | '_';
  status: number;
  title?: string;
  /** marker for the arm's line in the code */
  marker: string;
}

export interface Impl {
  id: ImplId;
  label: string;
  file: string;
  code: string;
  arms: Arm[];
  problemDetails: boolean;
  /** detail for 500s: the exception message, or a fixed text */
  hide500?: string;
  lines: { enter: number; tryLine: number; next: number; catchLine: number; log: number; build: number[]; write: number };
}

const L = (code: string, m: string, occ = 1) => lineOf(code, m, occ);

const HANDLER = EXCEPTION_HANDLER_CODE;
const MW = EXCEPTION_MIDDLEWARE_CODE;
/** The capstone's InvokeAsync and HandleException, shown together. */
export const CAPSTONE_CODE = `${CAP_EXCEPTION_INVOKE}\n${CAP_EXCEPTION_HANDLE}`;
const CAP = CAPSTONE_CODE;

export const IMPLS: Record<ImplId, Impl> = {
  capstone: {
    id: 'capstone',
    label: 'Capstone: GlobalExceptionMiddleware',
    file: 'Examples/Task_Management_System_API/Src/API/Middlewares/GlobalExceptionMiddleware.cs',
    code: CAP,
    problemDetails: true,
    hide500: 'Internal server error',
    arms: [
      { type: 'UnauthorizedAccessException', status: 401, title: 'Unauthorized', marker: 'UnauthorizedAccessException =>' },
      { type: 'KeyNotFoundException', status: 404, title: 'Resource Not Found', marker: 'KeyNotFoundException =>' },
      { type: 'ArgumentException', status: 400, title: 'Bad request', marker: 'ArgumentException =>' },
      { type: 'NotFoundException', status: 404, title: 'Bad request, Value not found', marker: 'NotFoundException =>' },
      { type: 'ValidationException', status: 400, title: 'Bad request, Business Validation failed', marker: 'ValidationException =>' },
      { type: '_', status: 500, title: 'Internal Server Error', marker: '_ => (StatusCodes.Status500InternalServerError' },
    ],
    lines: {
      enter: L(CAP, 'public async Task InvokeAsync'),
      tryLine: L(CAP, 'try'),
      next: L(CAP, 'await _next(httpContext);'),
      catchLine: L(CAP, 'catch(Exception ex)'),
      log: L(CAP, '_logger.LogError(ex, "Exception found");'),
      build: [L(CAP, 'var response = new ProblemDetails'), L(CAP, 'Detail = statusCode switch'), L(CAP, 'response.Extensions["traceId"]')],
      write: L(CAP, 'return httpContext.Response.WriteAsJsonAsync(response);'),
    },
  },
  'note-handler': {
    id: 'note-handler',
    label: "Note: IExceptionHandler",
    file: 'Phase2-ASP.NetAndBackend/ASP.Net Core/9.ASP_GlobalExceptionHandling.md',
    code: HANDLER,
    problemDetails: true,
    arms: [
      { type: 'UnauthorizedAccessException', status: 401, title: 'Unauthorized', marker: 'UnauthorizedAccessException =>' },
      { type: 'KeyNotFoundException', status: 404, title: 'Resource Not Found', marker: 'KeyNotFoundException =>' },
      { type: '_', status: 500, title: 'Internal Server Error', marker: '_ => (StatusCodes.Status500InternalServerError' },
    ],
    lines: {
      enter: L(HANDLER, 'public async ValueTask<bool> TryHandleAsync('),
      tryLine: 0,
      next: 0,
      catchLine: L(HANDLER, 'public async ValueTask<bool> TryHandleAsync('),
      log: L(HANDLER, 'logger.LogError(exception'),
      build: [L(HANDLER, 'var problemDetails = new ProblemDetails'), L(HANDLER, 'Detail = exception.Message'), L(HANDLER, 'problemDetails.Extensions["traceId"]')],
      write: L(HANDLER, 'await httpContext.Response.WriteAsJsonAsync(problemDetails'),
    },
  },
  'note-middleware': {
    id: 'note-middleware',
    label: 'Note: ExceptionHandlingMiddleware',
    file: 'Phase2-ASP.NetAndBackend/ASP.Net Core/9.ASP_GlobalExceptionHandling.md',
    code: MW,
    problemDetails: false,
    arms: [
      { type: 'ArgumentException', status: 400, marker: 'ArgumentException =>' },
      { type: 'KeyNotFoundException', status: 404, marker: 'KeyNotFoundException =>' },
      { type: '_', status: 500, marker: '_ => StatusCodes.Status500InternalServerError' },
    ],
    lines: {
      enter: L(MW, 'public async Task InvokeAsync'),
      tryLine: L(MW, 'try'),
      next: L(MW, 'await _next(context);'),
      catchLine: L(MW, 'catch (Exception ex)'),
      log: L(MW, '_logger.LogError(ex, "Unhandled exception occurred");'),
      build: [L(MW, 'var response = new'), L(MW, 'message = ex.Message,')],
      write: L(MW, 'return context.Response.WriteAsync(JsonSerializer.Serialize(response));'),
    },
  },
};

export const FLOW_LINES = {
  arrives: lineOf(EXCEPTION_FLOW_TEXT, 'Request arrives'),
  invoke: lineOf(EXCEPTION_FLOW_TEXT, 'ExceptionMiddleware.InvokeAsync()'),
  tryLine: lineOf(EXCEPTION_FLOW_TEXT, 'try'),
  next: lineOf(EXCEPTION_FLOW_TEXT, '_next(context)'),
  controller: lineOf(EXCEPTION_FLOW_TEXT, 'Controller executes'),
  occurs: lineOf(EXCEPTION_FLOW_TEXT, 'Exception occurs'),
  returns: lineOf(EXCEPTION_FLOW_TEXT, 'Control returns to middleware'),
  catchLine: lineOf(EXCEPTION_FLOW_TEXT, 'catch block runs'),
  response: lineOf(EXCEPTION_FLOW_TEXT, 'Custom response returned'),
};

/** Which classes each exception is (its own type and its base types), for type-pattern matching. */
const IS_A: Record<ExceptionId, ExceptionId[]> = {
  Exception: ['Exception'],
  ArgumentException: ['ArgumentException', 'Exception'],
  KeyNotFoundException: ['KeyNotFoundException', 'Exception'],
  UnauthorizedAccessException: ['UnauthorizedAccessException', 'Exception'],
  NotFoundException: ['NotFoundException', 'Exception'],
  ValidationException: ['ValidationException', 'Exception'],
};

export const DEMO_PATH = '/api/products';
/** A made-up HttpContext.TraceIdentifier in Kestrel's "connection id:request number" shape. */
export const DEMO_TRACE_ID = '0HN7DEMO0TRACE:00000001';

export interface ProblemState {
  /** current line in the note's flow text */
  flowLine: number;
  /** highlighted lines in the implementation's code */
  codeLines: number[];
  /** index of the arm being tested, and the arms already rejected */
  armAt: number | null;
  armsTried: number[];
  matched: number | null;
  /** the response body once built, as ordered [key, value] pairs */
  body: [string, string | number][] | null;
  status: number | null;
  phase: 'request' | 'thrown' | 'caught' | 'mapped' | 'built' | 'sent';
}

export type ProblemStep = Step<ProblemState>;

export function traceProblem(implId: ImplId, exId: ExceptionId): ProblemStep[] {
  const impl = IMPLS[implId];
  const ex = EXCEPTIONS.find((e) => e.id === exId)!;
  const steps: ProblemStep[] = [];
  let st: ProblemState = { flowLine: FLOW_LINES.arrives, codeLines: [], armAt: null, armsTried: [], matched: null, body: null, status: null, phase: 'request' };
  const push = (patch: Partial<ProblemState>, action: ProblemStep['action'], narration: string, predict?: ProblemStep['predict']) => {
    st = { ...st, ...patch };
    steps.push({ state: st, highlights: {}, action, codeLine: 0, narration, variables: vars(), counters: ZERO, predict });
  };
  const vars = (): Record<string, string | number> => ({
    path: DEMO_PATH,
    exception: st.phase === 'request' ? '—' : ex.id,
    ...(st.status ? { status: st.status } : {}),
  });
  const handlerWord = implId === 'note-handler' ? 'the exception handler middleware' : implId === 'capstone' ? 'GlobalExceptionMiddleware' : 'ExceptionHandlingMiddleware';

  push({}, 'start', `A request for ${DEMO_PATH} arrives. ${implId === 'note-handler' ? 'The exception handler middleware is registered with AddExceptionHandler<GlobalExceptionHandler>() and AddProblemDetails().' : `${handlerWord} is the first middleware in the pipeline.`}`);
  push(
    { flowLine: FLOW_LINES.invoke, codeLines: impl.lines.enter && implId !== 'note-handler' ? [impl.lines.enter] : [] },
    'call',
    implId === 'note-handler' ? 'The exception handler middleware wraps the rest of the pipeline (it plays the part of ExceptionMiddleware.InvokeAsync in the note\'s flow).' : `${handlerWord}.InvokeAsync(HttpContext) runs.`,
  );
  push(
    { flowLine: FLOW_LINES.next, codeLines: impl.lines.next ? [impl.lines.tryLine, impl.lines.next] : [] },
    'call',
    'Inside try, it calls _next(context): "go to next middleware / controller". Everything after it now runs inside this try block.',
  );
  push({ flowLine: FLOW_LINES.controller, codeLines: [] }, 'call', 'The controller executes.');
  push(
    { flowLine: FLOW_LINES.occurs, phase: 'thrown' },
    'branch',
    `The action throws new ${ex.id}("${ex.message}"). Nothing in the controller catches it, so the exception travels back up the pipeline.`,
  );
  push(
    { flowLine: FLOW_LINES.returns, codeLines: [impl.lines.catchLine] },
    'return',
    implId === 'note-handler'
      ? 'Control returns to the exception handler middleware, which calls TryHandleAsync(httpContext, exception, cancellationToken) on the registered handler.'
      : `Control returns to ${handlerWord}: await _next(context) throws, so the catch (Exception ex) block runs.`,
  );
  push({ flowLine: FLOW_LINES.catchLine, codeLines: [impl.lines.log], phase: 'caught' }, 'call', `It logs the error${implId === 'note-handler' ? ' with the TraceId for correlation' : ''}.`);

  // the switch: arms top to bottom, the first match wins
  const types = IS_A[ex.id];
  const matchIndex = impl.arms.findIndex((a) => a.type === '_' || types.includes(a.type));
  const arm = impl.arms[matchIndex]!;
  const tried: number[] = [];
  for (let i = 0; i <= matchIndex; i++) {
    const a = impl.arms[i]!;
    const hit = i === matchIndex;
    const isLast = a.type === '_';
    push(
      { armAt: i, armsTried: [...tried], codeLines: [lineOf(impl.code, a.marker)], matched: hit ? i : null, status: hit ? a.status : null, phase: hit ? 'mapped' : 'caught' },
      'compare',
      isLast
        ? `None of the arms above matched ${ex.id}, so the discard pattern _ catches it: ${a.status}${a.title ? `, "${a.title}"` : ''}.`
        : hit
          ? `${ex.id} is ${a.type === ex.id ? 'a' : 'derived from'} ${a.type}: this arm matches, so the status is ${a.status}${a.title ? ` and the title "${a.title}"` : ''}.`
          : `Is it ${articleFor(a.type)} ${a.type}? No, keep going.`,
      i === 0
        ? {
            question: `Which status code does ${impl.label.replace(/^(Note|Capstone): /, '')} give ${ex.id}?`,
            options: [...new Set([...impl.arms.map((x) => x.status), 500])].sort((x, y) => x - y).map(String),
            answer: [...new Set([...impl.arms.map((x) => x.status), 500])].sort((x, y) => x - y).indexOf(arm.status),
          }
        : undefined,
    );
    if (!hit) tried.push(i);
  }

  const detail = arm.status === 500 && impl.hide500 ? impl.hide500 : ex.message;
  let body: [string, string | number][];
  if (impl.problemDetails) {
    body = [
      ['title', arm.title ?? ''],
      ['status', arm.status],
      ['detail', detail],
      ['instance', DEMO_PATH],
      ['traceId', DEMO_TRACE_ID],
    ];
  } else {
    body = [
      ['message', ex.message],
      ['status', arm.status],
      ['traceId', DEMO_TRACE_ID],
    ];
  }
  push(
    { body, codeLines: impl.lines.build, phase: 'built' },
    'write',
    impl.problemDetails
      ? `It builds a ProblemDetails: Title, Status, Detail ${arm.status === 500 && impl.hide500 ? `("${impl.hide500}": the capstone hides the real message for 500s)` : implId === 'note-handler' && arm.status === 500 ? '(the exception message; the note itself warns to use a generic message for 500s in production)' : '(the exception message)'}, Instance = the request path, plus a traceId extension for observability.`
      : 'It builds an anonymous object { message, status, traceId }. This is a custom shape, not ProblemDetails; the note\'s next section recommends ProblemDetails as the standard format.',
  );
  push(
    { flowLine: FLOW_LINES.response, codeLines: [impl.lines.write], phase: 'sent' },
    'done',
    `Custom response returned: ${arm.status} with the JSON body shown. The client never sees a stack trace${detail === ex.message && arm.status === 500 ? ', but it does see the raw exception message' : ''}.`,
  );
  return steps;
}

const articleFor = (t: string) => (/^[AEIOU]/.test(t) ? 'an' : 'a');

/** The JSON the client receives, formatted. */
export function formatBody(body: [string, string | number][]): string {
  return `{\n${body.map(([k, v]) => `  "${k}": ${typeof v === 'number' ? v : JSON.stringify(v)}`).join(',\n')}\n}`;
}
