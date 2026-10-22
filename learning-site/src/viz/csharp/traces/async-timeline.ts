import type { Prediction, Trace } from '../../engine/types';
import { docOf, linesIn, Recorder, type CodeDoc } from '../shared/step';
import { Timeline, type Lane, type TimelineState } from '../shared/timeline';

/*
 * async/await on a timeline. Every scenario plays code from the notes:
 *  - sync vs async: DeadlockNRaceCondition.md › Async/await deadlock (the `.Result` version and the
 *    "await all the way" fix), in a console app or a UI app;
 *  - await releases the thread: OtherTopics.md › 3) Example: seeing the thread flow, with the note's
 *    console and WPF outputs;
 *  - Task.WhenAll: OtherTopics.md › SemaphoreSlim example A (five workers, two at a time, then
 *    `await Task.WhenAll(tasks)`). (ThreadpoolAndTask.md's WhenAllExample does not compile; see
 *    CONTENT_ISSUES.md.)
 * Where the continuation runs comes from the note's own table (OtherTopics.md › 2) How continuation thread
 * selection works). Runtime details the notes don't give:
 *  - Task.Delay completes through a timer; no thread waits for it (DelayPromise uses a TimerQueueTimer):
 *    https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Threading/Tasks/Task.cs
 *  - await on an unfinished task returns control to the caller and resumes the method later:
 *    https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/await
 *  - SemaphoreSlim: the docs guarantee no order for waiters; the current source hands released slots to
 *    async waiters first-in first-out and Release returns the previous count:
 *    https://learn.microsoft.com/en-us/dotnet/api/system.threading.semaphoreslim
 *    https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Threading/SemaphoreSlim.cs
 *  - Task.WhenAll's task completes when all of the supplied tasks have completed:
 *    https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.whenall
 */

export type AsyncContext = 'console' | 'ui';
export type AsyncPartId = 'sync-vs-async' | 'await-releases-thread' | 'when-all';

export interface AtState extends TimelineState {
  /** Lanes whose blocked segment never ends (deadlock). */
  forever: string[];
  tally: [string, string][];
  /** Lines highlighted besides the step's codeLine (the other side of a comparison). */
  also: number[];
}

export interface AtPart {
  id: AsyncPartId;
  label: string;
  doc: CodeDoc;
  trace: Trace<AtState>;
  /** Whether the console/UI choice changes this part. */
  usesContext: boolean;
}

class Run {
  readonly r = new Recorder<AtState>();
  readonly tl: Timeline;
  forever: string[] = [];
  tally: [string, string][] = [];
  constructor(lanes: Lane[], axis: number) {
    this.tl = new Timeline(lanes, axis);
  }
  step(line: number, narration: string, opts: { also?: number[]; predict?: Prediction; action?: 'start' | 'call' | 'return' | 'branch' | 'done' } = {}): void {
    const state: AtState = { ...this.tl.state, forever: this.forever, tally: this.tally, also: opts.also ?? [] };
    this.r.push(state, { action: opts.action ?? 'branch', line, narration, predict: opts.predict, vars: { t: `${this.tl.state.now} ms` } });
  }
}

// ── 1. sync (.Result) vs async (await) ───────────────────────────────────────────────────

function syncVsAsync(ctx: AsyncContext): AtPart {
  const doc = docOf('dlAsyncProblem', 'dlAsyncFix');
  const P = linesIn(doc, 0, { call: 'string GetDataSync() => GetDataAsync().Result;', delay: 'await Task.Delay(1000);', ret: 'return "data";' });
  const F = linesIn(doc, 1, { await: 'string data = await GetDataAsync();', update: '// update UI' });
  const ui = ctx === 'ui';
  const th = ui ? 'UI thread' : 'Main thread';
  const thl = ui ? 'UI thread' : 'main thread';
  const lanes: Lane[] = [
    { id: 's-th', label: th, group: 'Blocking: GetDataAsync().Result' },
    { id: 's-timer', label: 'Delay timer', sub: 'no thread', group: 'Blocking: GetDataAsync().Result' },
    ...(ui ? [] : [{ id: 's-pool', label: 'Thread pool', group: 'Blocking: GetDataAsync().Result' }]),
    { id: 'a-th', label: th, group: 'Non-blocking: await GetDataAsync()' },
    { id: 'a-timer', label: 'Delay timer', sub: 'no thread', group: 'Non-blocking: await GetDataAsync()' },
    ...(ui ? [] : [{ id: 'a-pool', label: 'Thread pool', group: 'Non-blocking: await GetDataAsync()' }]),
  ];
  const run = new Run(lanes, ui ? 1500 : 1250);
  const tl = run.tl;
  const blockedTally = () => {
    run.tally = [
      ['.Result: thread blocked', run.forever.includes('s-th') ? 'forever' : `${tl.total('s-th', 'blocked')} ms`],
      ['await: thread blocked', `${tl.total('a-th', 'blocked')} ms`],
    ];
  };

  tl.open('s-th', 'run', 'GetDataSync').open('a-th', 'run', 'UseDataAsync').status('s-th', 'runs GetDataSync() → GetDataAsync()').status('a-th', 'runs UseDataAsync() → GetDataAsync()').focus('s-th', 'a-th');
  blockedTally();
  run.step(
    P.call,
    `Both versions start the same way: the ${thl} calls GetDataAsync(), from GetDataSync() in the blocking version and from UseDataAsync() in the await version.${ui ? '' : ' (The note writes this for a UI thread; this run shows a console app, which has no UI context.)'}`,
    { also: [F.await], action: 'start' },
  );

  tl.open('s-timer', 'wait', 'Task.Delay(1000)').open('a-timer', 'wait', 'Task.Delay(1000)').status('s-timer', 'counting down 1000 ms').status('a-timer', 'counting down 1000 ms').focus('s-timer', 'a-timer');
  run.step(
    P.delay,
    `await Task.Delay(1000): Task.Delay starts a timer and returns a task that is not finished yet. await registers the rest of GetDataAsync (return "data") as a continuation${ui ? ' and captures the UI context, as the comment says' : ''}, then returns an unfinished Task<string> to the caller. No thread waits for the timer.`,
    { also: [P.delay], action: 'call' },
  );

  tl.open('s-th', 'blocked', '.Result').status('s-th', 'blocked in .Result: can do nothing else');
  tl.open('a-th', 'free', ui ? 'handles clicks, repaints' : 'free').status('a-th', ui ? 'free: back in the message loop, the window stays responsive' : 'free: UseDataAsync returned at its await');
  tl.focus('s-th', 'a-th');
  blockedTally();
  run.step(
    P.call,
    `Blocking version: .Result on an unfinished task blocks the ${thl} until the task completes. await version: await sees the same unfinished task, so UseDataAsync also returns and the ${thl} is free.`,
    {
      also: [F.await],
      predict: {
        question: 'The 1000 ms delay is running. What is the calling thread doing in each version?',
        options: ['Blocked in both', 'Blocked with .Result, free with await', 'Free in both'],
        answer: 1,
      },
    },
  );

  tl.at(1000).close('s-timer').close('a-timer').status('s-timer', 'fired at 1000 ms').status('a-timer', 'fired at 1000 ms');
  if (!ui) {
    tl.open('s-pool', 'run', 'return "data"').open('a-pool', 'run', 'return "data"').status('s-pool', 'runs the continuation').status('a-pool', 'runs the continuation').focus('s-pool', 'a-pool');
    blockedTally();
    run.step(
      P.ret,
      'At 1000 ms the timer fires and the delay task completes. A console app has no context to return to, so the continuation (return "data") runs on a ThreadPool thread, in both versions. GetDataAsync\'s task now holds "data".',
      { also: [P.ret], action: 'return' },
    );
    tl.close('s-pool').close('a-pool').status('s-pool', 'done').status('a-pool', 'done');
    tl.open('s-th', 'run', 'has "data"').status('s-th', '.Result returned "data"');
    tl.open('a-pool', 'run', 'data = "data"').status('a-pool', 'UseDataAsync resumes: data = "data"');
    tl.focus('s-th', 'a-pool');
    blockedTally();
    run.step(
      P.call,
      'Blocking version: .Result unblocks and returns "data"; the main thread was stuck for the whole second. await version: UseDataAsync resumes after its await with data = "data", also on a thread-pool thread. No thread was blocked.',
      { also: [F.update], action: 'return' },
    );
    tl.status('s-th', 'continues with "data"').status('a-pool', 'continues with "data"').focus();
    blockedTally();
    run.step(P.call, 'Same result, different cost: the blocking version held a thread for 1000 ms doing nothing; the await version held no thread while it waited.', { also: [F.update], action: 'done' });
  } else {
    tl.status('s-th', 'blocked in .Result; the continuation is queued for this thread').focus('s-th', 's-timer');
    blockedTally();
    run.step(
      P.ret,
      'At 1000 ms the timer fires. Blocking version: the continuation (return "data") must run on the UI thread, because await captured the UI context. It is queued for the UI thread, but the UI thread is blocked in .Result waiting for this very task.',
      {
        also: [P.ret],
        predict: {
          question: 'The continuation is queued for the UI thread. Can it run in the .Result version?',
          options: ['Yes, the UI thread runs it', 'No, the UI thread is blocked waiting for this task'],
          answer: 1,
        },
      },
    );
    tl.open('a-th', 'run', 'return "data"').status('a-th', 'runs the continuation: return "data"').focus('a-th');
    blockedTally();
    run.step(P.ret, 'await version: the UI thread was free, so it picks up the queued continuation and runs return "data". GetDataAsync\'s task completes.', { also: [P.ret], action: 'return' });
    tl.open('a-th', 'run', 'data = "data"').status('a-th', 'UseDataAsync resumes on the UI thread: update UI').focus('a-th');
    blockedTally();
    run.step(F.update, 'await version: UseDataAsync resumes after its await, on the UI thread, with data = "data", so it can safely update the UI.', { also: [F.await], action: 'return' });
    tl.open('a-th', 'free', 'free').status('a-th', 'free again');
    tl.at(1500);
    run.forever = ['s-th'];
    tl.status('s-th', 'deadlocked: waits for the task, which waits for this thread').focus('s-th');
    blockedTally();
    run.step(
      P.call,
      'Blocking version: deadlock. "GetDataSync() blocks the UI thread waiting for the Task result. GetDataAsync() tries to resume its continuation on the UI thread (captured context) but the UI thread is blocked." The fixes from the note: await all the way (the await version), or ConfigureAwait(false) in library code.',
      { also: [F.update], action: 'done' },
    );
  }
  return { id: 'sync-vs-async', label: 'Sync vs async', doc, trace: run.r.steps, usesContext: true };
}

// ── 2. await releases the thread (OtherTopics.md › 3) Example) ───────────────────────────

/** The note's sample thread ids: before 1, Task.Run on 4, after: 5 in a console app, 1 in WPF. */
export const DEMO_IDS = { before: 1, task: 4, afterConsole: 5, afterUi: 1 } as const;

function awaitReleases(ctx: AsyncContext): AtPart {
  const doc = docOf('otDemo');
  const D = linesIn(doc, 0, {
    before: 'Console.WriteLine($"Before await:',
    run: 'await Task.Run(() => {',
    inside: 'Console.WriteLine($"Task running on:',
    sleep: 'Thread.Sleep(500);',
    close: '});',
    after: 'Console.WriteLine($"After await:',
  });
  const ui = ctx === 'ui';
  const after = ui ? DEMO_IDS.afterUi : DEMO_IDS.afterConsole;
  const lanes: Lane[] = [
    { id: 't1', label: 'Thread 1', sub: ui ? 'UI thread' : 'main thread' },
    { id: 't4', label: 'Thread 4', sub: 'thread pool' },
    ...(ui ? [] : [{ id: 't5', label: 'Thread 5', sub: 'thread pool' }]),
  ];
  const run = new Run(lanes, 750);
  const tl = run.tl;
  const tally = () => {
    run.tally = [
      ['Thread 1 in Demo', `${tl.total('t1', 'run')} ms`],
      ['Thread 4 blocked', `${tl.total('t4', 'blocked')} ms`],
    ];
  };
  tl.open('t1', 'run', 'Demo()').status('t1', 'runs Demo()').print(`Before await: ${DEMO_IDS.before}`).focus('t1');
  tally();
  run.step(D.before, 'Demo starts on thread 1 and prints its id.', { action: 'start' });

  tl.status('t1', 'queues the lambda with Task.Run').focus('t1');
  run.step(D.run, 'Task.Run queues the lambda to the thread pool and immediately returns a Task that represents it.', { action: 'call' });

  tl.close('t1');
  if (ui) tl.open('t1', 'free', 'message loop').status('t1', 'free: back in the message loop, the window stays responsive');
  else tl.open('t1', 'free', 'not in Demo').status('t1', 'left Demo; what it does next is up to the caller');
  tl.focus('t1');
  tally();
  run.step(
    D.run,
    `await finds the task unfinished, so it registers the rest of Demo as a continuation and Demo returns an unfinished Task to its caller. Thread 1 is no longer tied to Demo. ${ui ? 'In WPF it goes back to the message loop, so the window keeps responding.' : 'The note does not show the caller, so what thread 1 does next is not drawn.'}`,
    {
      predict: {
        question: 'await Task.Run(...) hits an unfinished task. What happens to thread 1?',
        options: ['It blocks until the lambda finishes', 'It leaves Demo; the rest of Demo runs later'],
        answer: 1,
      },
    },
  );

  tl.open('t4', 'run', 'lambda').status('t4', 'runs the Task.Run lambda').print(`Task running on: ${DEMO_IDS.task}`).focus('t4');
  run.step(D.inside, `A thread-pool thread (4 in the note's run) picks up the lambda and prints its id.`, { action: 'call' });

  tl.open('t4', 'blocked', 'Thread.Sleep(500)').status('t4', 'blocked in Thread.Sleep(500)').focus('t4');
  tally();
  run.step(D.sleep, 'Thread.Sleep(500) blocks thread 4 for half a second. Thread 1 is not waiting for it.');

  tl.at(500).close('t4').open('t4', 'done').status('t4', 'lambda finished; back to the pool').focus('t4');
  tally();
  run.step(D.close, 'At 500 ms the lambda returns, the Task.Run task completes and Demo\'s continuation is scheduled.', { action: 'return' });

  const lane = ui ? 't1' : 't5';
  tl.open(lane, 'run', 'after await').status(lane, 'runs the rest of Demo').print(`After await:  ${after}`).focus(lane);
  tally();
  run.step(
    D.after,
    ui
      ? 'WPF: await captured the UI context, so the rest of Demo runs back on the UI thread: "After await:  1".'
      : 'Console app: there is no context to return to, so the rest of Demo runs on a ThreadPool thread, 5 in the note\'s run. It "might be the same one as before or a different worker".',
    {
      action: 'return',
      predict: {
        question: 'Which thread runs the code after the await?',
        options: ['Thread 1, where Demo started', 'A thread-pool thread (5 in the note)'],
        answer: ui ? 0 : 1,
      },
    },
  );
  tl.at(750).close(lane).open(lane, 'done').status(lane, 'Demo finished').focus();
  tally();
  run.step(D.after, `Done. Demo held thread 1 only for the instants it was running code; the 500 ms wait happened on thread 4. Output matches the note's ${ui ? 'WPF' : 'console'} run.`, { action: 'done' });
  return { id: 'await-releases-thread', label: 'await releases the thread', doc, trace: run.r.steps, usesContext: true };
}

// ── 3. Task.WhenAll (OtherTopics.md › SemaphoreSlim example A) ────────────────────────────

export const THROTTLE = { workers: 5, slots: 2, workMs: 1000 } as const;

function whenAll(): AtPart {
  const doc = docOf('otThrottle');
  const W = linesIn(doc, 0, {
    tasks: 'var tasks = new Task[5];',
    loop: 'for (int i = 0; i < tasks.Length; i++) tasks[i] = Worker(i);',
    wait: 'await sem.WaitAsync();',
    entered: 'Console.WriteLine($"[{id}] Entered.',
    delay: 'await Task.Delay(1000);',
    leaving: 'Console.WriteLine($"[{id}] Leaving.");',
    release: 'int prev = sem.Release();',
    released: 'Console.WriteLine($"[{id}] Released',
    whenall: 'await Task.WhenAll(tasks);',
    dispose: 'sem.Dispose();',
  });
  const { workers, slots, workMs } = THROTTLE;
  const lanes: Lane[] = [
    { id: 'main', label: 'Main()' },
    ...Array.from({ length: workers }, (_, i) => ({ id: `w${i}`, label: `Worker(${i})`, sub: 'task' })),
    { id: 'all', label: 'Task.WhenAll', sub: 'task' },
  ];
  const run = new Run(lanes, Math.ceil(workers / slots) * workMs + 250);
  const tl = run.tl;
  let count = slots;
  const queue: number[] = [];
  const endAt = new Map<number, number>();
  let inside = 0;
  let maxInside = 0;
  let finished = 0;
  const tally = () => {
    run.tally = [
      ['Inside at once', `${inside} of ${slots}`],
      ['Workers finished', `${finished} of ${workers}`],
      ['CurrentCount', String(count)],
    ];
  };
  const enter = (i: number, viaRelease: boolean) => {
    inside++;
    maxInside = Math.max(maxInside, inside);
    tl.open(`w${i}`, 'inside', 'Task.Delay(1000)').status(`w${i}`, 'inside the semaphore, awaiting Task.Delay (no thread)').print(`[${i}] Entered. CurrentCount=${count}`).focus(`w${i}`);
    endAt.set(i, tl.state.now + workMs);
    tally();
    run.step(
      W.entered,
      viaRelease
        ? `Worker ${i}'s WaitAsync completes: the released slot went straight to it, so CurrentCount stays ${count}. It prints and starts its 1-second Task.Delay.`
        : `Worker(${i}) runs synchronously until its first unfinished await. WaitAsync succeeds at once (a slot was free), so it prints CurrentCount=${count} and awaits Task.Delay(1000), returning an unfinished task to Main.`,
      { action: 'call' },
    );
  };

  tl.open('main', 'run', 'Main').status('main', 'starts the workers').focus('main');
  tally();
  run.step(W.tasks, `Main creates an array for five tasks. SemaphoreSlim(2) lets two workers inside at a time.`, { action: 'start' });
  for (let i = 0; i < workers; i++) {
    if (count > 0) {
      count--;
      enter(i, false);
    } else {
      queue.push(i);
      tl.open(`w${i}`, 'wait', 'WaitAsync').status(`w${i}`, 'waiting for a free slot (no thread)').focus(`w${i}`);
      tally();
      run.step(W.wait, `Worker(${i}): the count is 0, so await sem.WaitAsync() gets an unfinished task and Worker(${i}) returns to Main right away. Waiting uses no thread.`, { action: 'call' });
    }
  }
  tl.open('main', 'wait', 'await WhenAll').status('main', 'suspended at await Task.WhenAll (no thread)');
  tl.open('all', 'wait', 'waits for 5 tasks').status('all', 'completes when all five tasks complete').focus('main', 'all');
  tally();
  run.step(W.whenall, 'Task.WhenAll(tasks) returns one task that completes when every worker task has completed. Main awaits it, so Main is suspended without holding a thread.', {
    predict: {
      question: 'When will the Task.WhenAll task complete?',
      options: ['When the first worker finishes (about 1 s)', 'When the last worker finishes (about 3 s)', 'Immediately'],
      answer: 1,
    },
  });

  while (endAt.size) {
    const t = Math.min(...endAt.values());
    tl.at(t);
    const due = [...endAt.entries()].filter(([, e]) => e === t).map(([i]) => i).sort((a, b) => a - b);
    for (const i of due) {
      endAt.delete(i);
      const prev = count;
      inside--;
      finished++;
      const next = queue.shift();
      if (next === undefined) count++;
      tl.close(`w${i}`).open(`w${i}`, 'done').status(`w${i}`, `done: printed Leaving and Released (previous count ${prev})`).print(`[${i}] Leaving.`).print(`[${i}] Released (previous count was ${prev}).`).focus(`w${i}`);
      tally();
      run.step(
        W.release,
        next === undefined
          ? `Worker ${i}'s delay ends at ${t} ms. It prints Leaving, and the finally block calls Release(): nobody is waiting, so the count goes up to ${count}. Release returns the previous count, ${prev}.`
          : `Worker ${i}'s delay ends at ${t} ms. It prints Leaving, and the finally block calls Release(), which returns the previous count (${prev}) and hands the slot to the first waiting worker, Worker(${next}).`,
        { action: 'return' },
      );
      if (next !== undefined) enter(next, true);
    }
  }
  tl.close('all').open('all', 'done').status('all', `completed at ${tl.state.now} ms`);
  tl.open('main', 'run', 'after WhenAll').status('main', 'resumes after await Task.WhenAll').focus('main', 'all');
  tally();
  run.step(W.dispose, `The last worker finished at ${tl.state.now} ms, so the WhenAll task completes and Main resumes: sem.Dispose().`, { action: 'return' });
  tl.at(tl.state.now + 250).close('main').open('main', 'done').status('main', 'finished').focus();
  run.tally = [
    ['Total time', `${tl.state.now - 250} ms`],
    ['Most inside at once', String(maxInside)],
    ['Workers finished', `${finished} of ${workers}`],
  ];
  run.step(
    W.dispose,
    `Done. Five 1-second workers took ${tl.state.now - 250} ms because at most ${maxInside} were inside at once, and WhenAll waited for the last one. Order shown is one possible run: the docs promise no order for waiters (the current runtime serves them first-in first-out).`,
    { action: 'done' },
  );
  return { id: 'when-all', label: 'Task.WhenAll', doc, trace: run.r.steps, usesContext: false };
}

export const ASYNC_PARTS: { id: AsyncPartId; label: string }[] = [
  { id: 'sync-vs-async', label: 'Sync vs async' },
  { id: 'await-releases-thread', label: 'await releases the thread' },
  { id: 'when-all', label: 'Task.WhenAll' },
];

export function asyncPart(id: AsyncPartId, ctx: AsyncContext): AtPart {
  if (id === 'sync-vs-async') return syncVsAsync(ctx);
  if (id === 'await-releases-thread') return awaitReleases(ctx);
  return whenAll();
}

export function toAsyncParts(list: unknown): AsyncPartId[] {
  const ok = new Set(ASYNC_PARTS.map((p) => p.id));
  const ids = Array.isArray(list) ? list.filter((x): x is AsyncPartId => typeof x === 'string' && ok.has(x as AsyncPartId)) : [];
  return ids.length ? ids : ASYNC_PARTS.map((p) => p.id);
}
