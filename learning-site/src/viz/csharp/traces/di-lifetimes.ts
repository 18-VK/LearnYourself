import type { Prediction, Trace } from '../../engine/types';
import { docOf, linesIn, Recorder, type CodeDoc } from '../shared/step';

/*
 * DI lifetimes from Dependency_Injection.md: the note's ICounter / ServiceA / ServiceB / TestController
 * example under each lifetime (its output blocks are the expected result), and the captive-dependency trap
 * with its IServiceScopeFactory fix.
 *
 * Runtime facts beyond the note:
 *  - transient: created each time it's requested; scoped: once per request (scope); singleton: the first
 *    time it's requested, then reused:
 *    https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes
 *  - a scoped service resolved from the root provider (which is what a singleton's constructor uses) is
 *    effectively promoted to a singleton; in the Development environment the default provider validates
 *    scopes and refuses scoped services injected into singletons:
 *    https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview#scope-validation
 *  - scoped services are disposed at the end of their scope:
 *    https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes#scoped
 */

export type Lifetime = 'Transient' | 'Scoped' | 'Singleton';
export const LIFETIMES: Lifetime[] = ['Transient', 'Scoped', 'Singleton'];

export interface DiInstance {
  /** "Counter #1" */
  name: string;
  type: string;
  /** Where the container keeps it: the root (singletons and anything resolved from root) or a request scope. */
  owner: 'root' | number | 'none';
  disposed?: boolean;
}

export interface DiScope {
  id: number;
  label: string;
  ended: boolean;
  /** Resolved objects in this scope: holder → what it holds. */
  graph: { holder: string; field: string; target: string }[];
}

export interface DiState {
  instances: DiInstance[];
  scopes: DiScope[];
  output: string[];
  /** Instance names created or reused in this step. */
  created: string[];
  reused: string[];
  error: string | null;
  /** Times Counter (or the scoped service) was constructed. */
  constructed: number;
}

export interface DiPart {
  id: string;
  label: string;
  doc: CodeDoc;
  trace: Trace<DiState>;
}

class Run {
  readonly r = new Recorder<DiState>();
  s: DiState = { instances: [], scopes: [], output: [], created: [], reused: [], error: null, constructed: 0 };
  constructor(private readonly countLabel = 'Counter objects built') {}
  step(line: number, narration: string, opts: { created?: string[]; reused?: string[]; predict?: Prediction; action?: 'start' | 'call' | 'write' | 'read' | 'return' | 'done' } = {}): void {
    this.s.created = opts.created ?? [];
    this.s.reused = opts.reused ?? [];
    const vars: Record<string, string | number> = { [this.countLabel]: this.s.constructed };
    this.r.push(this.s, { action: opts.action ?? 'call', line, narration, predict: opts.predict, vars });
  }
  scope(id: number): DiScope {
    return this.s.scopes.find((x) => x.id === id)!;
  }
}

/** The note's output line for one request (its text blocks, without the trailing "← …" remark). */
export function outputLine(request: number, a: number, b: number): string {
  return `Request ${request}:  ServiceA gets Counter #${a},  ServiceB gets Counter #${b}`;
}

export function lifetimesPart(lifetime: Lifetime, requests = 2): DiPart {
  const doc = docOf('diCounter');
  const L = linesIn(doc, 0, {
    counterId: 'public int Id { get; } = Interlocked.Increment(ref _next);',
    a: 'public ServiceA(ICounter counter) => Counter = counter;',
    b: 'public ServiceB(ICounter counter) => Counter = counter;',
    ctrl: 'public TestController(ServiceA a, ServiceB b)',
    get: 'public IActionResult Get()',
    ok: 'return Ok(new {',
  });
  const run = new Run();
  let next = 0;
  let singleton: string | null = null;
  run.step(
    L.ctrl,
    `ICounter is registered as ${lifetime}. TestController needs a ServiceA and a ServiceB, and both need an ICounter. (The note doesn't show how ServiceA and ServiceB are registered; they are drawn as transient, which gives the note's output.)`,
    { action: 'start' },
  );
  for (let r = 1; r <= requests; r++) {
    run.s.scopes.push({ id: r, label: `Request ${r}`, ended: false, graph: [] });
    let scoped: string | null = null;
    const resolveCounter = (): { name: string; isNew: boolean } => {
      if (lifetime === 'Singleton' && singleton) return { name: singleton, isNew: false };
      if (lifetime === 'Scoped' && scoped) return { name: scoped, isNew: false };
      next++;
      const name = `Counter #${next}`;
      run.s.constructed++;
      run.s.instances.push({ name, type: 'Counter', owner: lifetime === 'Singleton' ? 'root' : r });
      if (lifetime === 'Singleton') singleton = name;
      if (lifetime === 'Scoped') scoped = name;
      return { name, isNew: true };
    };
    run.step(L.ctrl, `Request ${r} arrives. ASP.NET Core creates a scope for it and asks the container for TestController, which needs ServiceA and ServiceB.`, { action: 'call' });
    const ids: number[] = [];
    for (const who of ['ServiceA', 'ServiceB'] as const) {
      const { name, isNew } = resolveCounter();
      ids.push(Number(name.split('#')[1]));
      const svc = `${who} (request ${r})`;
      run.s.instances.push({ name: svc, type: who, owner: r });
      run.scope(r).graph.push({ holder: svc, field: 'Counter', target: name });
      const why = isNew
        ? lifetime === 'Transient'
          ? 'Transient: a brand new Counter every time one is requested'
          : lifetime === 'Scoped'
            ? `Scoped: the first ICounter requested in request ${r}, so the container builds one and keeps it for this request`
            : 'Singleton: the first ICounter requested in the app, so the container builds one and keeps it forever'
        : lifetime === 'Scoped'
          ? `Scoped: request ${r} already has ${name}, so the container hands out the same one`
          : `Singleton: the container already has ${name} and reuses it`;
      if (isNew) run.step(L.counterId, `Building ${name}: Interlocked.Increment(ref _next) gives it Id ${name.split('#')[1]}.`, { created: [name], action: 'write' });
      const question: Prediction | undefined =
        who === 'ServiceB'
          ? { question: `ServiceB also needs an ICounter. Does it get ServiceA's ${run.scope(r).graph[0]!.target}?`, options: ['Yes, the same instance', 'No, a different one'], answer: lifetime === 'Transient' ? 1 : 0 }
          : r > 1
            ? { question: `Request ${r}: will ServiceA get a Counter it has seen before?`, options: ['Yes, an existing one', 'No, a new one'], answer: lifetime === 'Singleton' ? 0 : 1 }
            : undefined;
      run.step(who === 'ServiceA' ? L.a : L.b, `${who} gets ${name}. ${why}.`, { created: isNew ? [name, svc] : [svc], reused: isNew ? [] : [name], predict: question });
    }
    run.s.instances.push({ name: `TestController (request ${r})`, type: 'TestController', owner: r });
    run.s.output.push(outputLine(r, ids[0]!, ids[1]!));
    run.step(L.ok, `Get() returns ServiceA_CounterId = ${ids[0]} and ServiceB_CounterId = ${ids[1]}: ${ids[0] === ids[1] ? 'the SAME Counter' : 'different Counters'}.`, { action: 'return' });
    run.scope(r).ended = true;
    for (const x of run.s.instances) if (x.owner === r) x.disposed = true;
    run.step(L.get, `Request ${r} ends and its scope is disposed: everything created for it is let go${lifetime === 'Singleton' ? `, but the singleton ${singleton} lives on in the root container` : ''}.`, { action: 'return' });
  }
  const summary: Record<Lifetime, string> = {
    Transient: 'Transient: a new Counter for every injection, even within one request.',
    Scoped: 'Scoped: one Counter per request, shared by ServiceA and ServiceB, and a new one for the next request.',
    Singleton: 'Singleton: one Counter for the whole app, shared by every request.',
  };
  run.step(L.get, `${summary[lifetime]} Compare the output with the note's.`, { action: 'done' });
  return { id: `lifetime-${lifetime.toLowerCase()}`, label: lifetime, doc, trace: run.r.steps };
}

export function captivePart(validate: boolean): DiPart {
  const doc = docOf('diCaptive');
  const L = linesIn(doc, 0, { cls: 'public class MySingleton', field: 'private readonly IScopedService _scoped;', ctor: 'public MySingleton(IScopedService scoped) => _scoped = scoped;' });
  const run = new Run('scoped objects built');
  run.step(
    L.cls,
    'MySingleton is registered as a singleton and IScopedService as scoped (the names say so; the registrations are not in the note). MySingleton asks for IScopedService in its constructor.',
    { action: 'start' },
  );
  run.s.scopes.push({ id: 1, label: 'Request 1', ended: false, graph: [] });
  if (validate) {
    run.s.error = 'InvalidOperationException: a scoped service cannot be consumed from a singleton';
    run.step(
      L.ctor,
      'Request 1 needs MySingleton. With scope validation on (the default in the Development environment), the container sees a scoped service being injected into a singleton and throws an InvalidOperationException instead of building it.',
      {
        predict: { question: 'Scope validation is on. What happens when MySingleton is first resolved?', options: ['It gets the scoped service', 'The container throws InvalidOperationException'], answer: 1 },
      },
    );
    run.step(L.ctor, 'The bug is caught at development time. Turn validation off to see what happens when nobody checks.', { action: 'done' });
    return { id: 'captive', label: 'Captive dependency', doc, trace: run.r.steps };
  }
  run.s.instances.push({ name: 'MySingleton #1', type: 'MySingleton', owner: 'root' });
  run.s.instances.push({ name: 'ScopedService #1', type: 'IScopedService', owner: 'root' });
  run.s.constructed = 1;
  run.scope(1).graph.push({ holder: 'MySingleton #1', field: '_scoped', target: 'ScopedService #1' });
  run.step(
    L.ctor,
    "Request 1 needs MySingleton. A singleton is built by the root container, so its IScopedService comes from the root too: ScopedService #1. MySingleton stores it in _scoped.",
    { created: ['MySingleton #1', 'ScopedService #1'] },
  );
  run.scope(1).ended = true;
  run.step(L.field, 'Request 1 ends. A scoped service should die with its request, but MySingleton still holds ScopedService #1: "This instance lives forever now!"', { action: 'return', reused: ['ScopedService #1'] });
  run.s.scopes.push({ id: 2, label: 'Request 2', ended: false, graph: [] });
  run.scope(2).graph.push({ holder: 'MySingleton #1', field: '_scoped', target: 'ScopedService #1' });
  run.step(L.field, 'Request 2 gets the same MySingleton, and with it the same ScopedService #1 from request 1. Any per-request state in it (current user, DbContext changes) leaks into this request.', {
    reused: ['MySingleton #1', 'ScopedService #1'],
    predict: { question: 'Request 2 resolves MySingleton. Which scoped service does it hold?', options: ['A new one for request 2', 'ScopedService #1 from request 1'], answer: 1 },
  });
  run.scope(2).ended = true;
  run.step(L.cls, 'Captive dependency: the longer-lived singleton captured a shorter-lived service. The fix is the IServiceScopeFactory pattern (next example).', { action: 'done' });
  return { id: 'captive', label: 'Captive dependency', doc, trace: run.r.steps };
}

export function scopeFactoryPart(): DiPart {
  const doc = docOf('diScopeFactory');
  const L = linesIn(doc, 0, {
    cls: 'public class MyBackgroundService : BackgroundService',
    ctor: 'public MyBackgroundService(IServiceScopeFactory factory) => _factory = factory;',
    exec: 'protected override async Task ExecuteAsync(CancellationToken ct)',
    scope: 'using var scope = _factory.CreateScope();',
    db: 'var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();',
    note: '// db is now properly scoped to this block',
  });
  const run = new Run('scoped objects built');
  run.s.instances.push({ name: 'MyBackgroundService', type: 'BackgroundService', owner: 'root' });
  run.s.instances.push({ name: 'IServiceScopeFactory', type: 'IServiceScopeFactory', owner: 'root' });
  run.step(L.ctor, 'The background service lives as long as the app, like a singleton. It asks only for IServiceScopeFactory, which is a singleton itself, so nothing short-lived is captured.', {
    action: 'start',
    created: ['MyBackgroundService'],
  });
  run.step(L.exec, 'ExecuteAsync runs.', { action: 'call' });
  run.s.scopes.push({ id: 1, label: 'Scope from CreateScope()', ended: false, graph: [] });
  run.step(L.scope, 'CreateScope() makes a new scope just for this block of work.', { action: 'call' });
  run.s.instances.push({ name: 'AppDbContext #1', type: 'AppDbContext', owner: 1 });
  run.s.constructed = 1;
  run.scope(1).graph.push({ holder: 'db', field: '', target: 'AppDbContext #1' });
  run.step(L.db, 'AppDbContext is scoped, and it is resolved from the new scope: AppDbContext #1 belongs to this scope, not to the app.', { created: ['AppDbContext #1'] });
  run.step(L.note, '"db is now properly scoped to this block."', { action: 'read' });
  run.scope(1).ended = true;
  for (const x of run.s.instances) if (x.owner === 1) x.disposed = true;
  run.step(L.exec, 'At the end of the method, using var disposes the scope, and the scope disposes AppDbContext #1. The next unit of work would get a fresh scope and a fresh DbContext.', {
    action: 'return',
    predict: { question: 'ExecuteAsync finishes. What happens to AppDbContext #1?', options: ['It lives on in the singleton', 'It is disposed with the scope'], answer: 1 },
  });
  run.step(L.cls, 'Done: the singleton never holds the scoped service; it only creates scopes when it needs one.', { action: 'done' });
  return { id: 'scope-factory', label: 'Fix: IServiceScopeFactory', doc, trace: run.r.steps };
}

export type DiScenario = 'lifetimes' | 'captive-dependency';
export function toDiScenario(s: unknown): DiScenario {
  return s === 'captive-dependency' ? 'captive-dependency' : 'lifetimes';
}
