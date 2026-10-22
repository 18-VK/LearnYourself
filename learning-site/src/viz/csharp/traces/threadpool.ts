import type { Prediction, Trace } from '../../engine/types';
import { docOf, linesIn, Recorder, type CodeDoc } from '../shared/step';
import { Timeline, type Lane, type TimelineState } from '../shared/timeline';

/*
 * The thread pool's work queue, from 17..C#_ThreadsAndMultithreading/ThreadpoolAndTask.md › 2) Example with
 * main thread activity: Main queues WorkerTask with QueueUserWorkItem and keeps working while a pool thread
 * runs it. Times come from the code's own Sleep calls (500 ms per Main step, 700 ms per worker step).
 * The note doesn't show this program's output, so the thread ids it prints are shown as M and W.
 *
 * Runtime facts beyond the note:
 *  - QueueUserWorkItem queues a method for execution; it runs when a thread-pool thread becomes available:
 *    https://learn.microsoft.com/en-us/dotnet/api/system.threading.threadpool.queueuserworkitem
 *  - thread-pool threads are background threads, and a work item waits in a queue until a pool thread picks
 *    it up: https://learn.microsoft.com/en-us/dotnet/standard/threading/the-managed-thread-pool
 * Simplified: the queue is drawn as one list and the item is picked up at once (the pool has idle threads).
 */

export interface TpState extends TimelineState {
  queue: string[];
  /** Work items being run by pool threads. */
  running: string[];
  tally: [string, string][];
  also: number[];
}

export interface TpPart {
  doc: CodeDoc;
  trace: Trace<TpState>;
}

export function tpPart(): TpPart {
  const doc = docOf('tpMain');
  const L = linesIn(doc, 0, {
    id: 'Console.WriteLine($"[Main]   ID: {Thread.CurrentThread.ManagedThreadId}");',
    queue: 'ThreadPool.QueueUserWorkItem(WorkerTask, "Task 1");',
    other: 'Console.WriteLine("[Main]   Doing other work...");',
    step: 'Console.WriteLine($"[Main]   Step {i}");',
    mainSleep: 'Thread.Sleep(500);',
    wait: 'Thread.Sleep(3000);',
    finished: 'Console.WriteLine("[Main]   Finished");',
    started: 'Console.WriteLine($"[Worker] Started on ID:',
    processing: 'Console.WriteLine($"[Worker] Processing {i}");',
    workSleep: 'Thread.Sleep(700); // simulate work',
    done: 'Console.WriteLine("[Worker] Done");',
  });
  const lanes: Lane[] = [
    { id: 'main', label: 'Main thread', sub: 'foreground' },
    { id: 'queue', label: 'Work queue', sub: 'items waiting' },
    { id: 'pool', label: 'Pool thread W', sub: 'background' },
  ];
  const tl = new Timeline(lanes, 6000);
  const r = new Recorder<TpState>();
  const s = { queue: [] as string[], running: [] as string[] };
  const push = (line: number, narration: string, opts: { predict?: Prediction; action?: 'start' | 'call' | 'write' | 'read' | 'return' | 'done'; also?: number } = {}) => {
    const st: TpState = {
      ...tl.state,
      queue: [...s.queue],
      running: [...s.running],
      also: opts.also ? [opts.also] : [],
      tally: [
        ['Queued items', String(s.queue.length)],
        ['Pool threads busy', String(s.running.length)],
        ['Main blocked (ms)', String(tl.total('main', 'blocked'))],
      ],
    };
    r.push(st, { action: opts.action ?? 'call', line, narration, predict: opts.predict, vars: { t: `${tl.state.now} ms` } });
  };

  tl.open('main', 'run', 'Main').status('main', 'runs Main').print('[Main]   ID: M').focus('main');
  push(L.id, 'Main starts on the main thread and prints its id (shown here as M).', { action: 'start' });
  s.queue.push('WorkerTask("Task 1")');
  tl.open('queue', 'wait', 'WorkerTask').status('queue', '1 item: WorkerTask with state "Task 1"').focus('queue');
  push(L.queue, 'QueueUserWorkItem puts WorkerTask (with the state "Task 1") in the thread pool’s queue and returns at once. It is fire-and-forget: no result comes back.', {
    predict: { question: 'Does Main wait for WorkerTask to finish before going on?', options: ['Yes', 'No, it returns at once'], answer: 1 },
  });
  tl.print('[Main]   Doing other work...').focus('main');
  push(L.other, 'Main carries on immediately.', { action: 'write' });
  s.queue = [];
  s.running = ['WorkerTask("Task 1")'];
  tl.close('queue').status('queue', 'empty');
  tl.open('pool', 'run', 'WorkerTask').status('pool', 'runs WorkerTask("Task 1")').print('[Worker] Started on ID: W, State: Task 1').focus('pool', 'queue');
  push(L.started, 'A pool thread (W) takes the item off the queue and runs WorkerTask("Task 1"). The state argument arrives as the object parameter.', { action: 'call' });

  // events in time order: Main steps every 500 ms, worker steps every 700 ms
  type Ev = { t: number; who: 'main' | 'pool'; k: number };
  const evs: Ev[] = [];
  for (let i = 1; i <= 5; i++) evs.push({ t: (i - 1) * 500, who: 'main', k: i });
  for (let i = 1; i <= 3; i++) evs.push({ t: (i - 1) * 700, who: 'pool', k: i });
  evs.push({ t: 2100, who: 'pool', k: 4 });
  evs.sort((a, b) => a.t - b.t || (a.who === 'main' ? -1 : 1));
  for (const e of evs) {
    tl.at(e.t);
    if (e.who === 'main') {
      tl.open('main', 'run', `Step ${e.k}`).print(`[Main]   Step ${e.k}`).focus('main');
      tl.open('main', 'blocked', 'Sleep(500)').status('main', `printed Step ${e.k}, sleeping 500 ms`);
      push(L.step, `t = ${e.t} ms: Main prints Step ${e.k}, then Thread.Sleep(500) blocks the main thread.`, { action: 'write', also: L.mainSleep });
    } else if (e.k <= 3) {
      tl.open('pool', 'run', `Processing ${e.k}`).print(`[Worker] Processing ${e.k}`).focus('pool');
      tl.open('pool', 'blocked', 'Sleep(700)').status('pool', `printed Processing ${e.k}, sleeping 700 ms`);
      push(L.processing, `t = ${e.t} ms: on its own thread, the worker prints Processing ${e.k} and sleeps 700 ms. Both threads run at the same time, so their lines interleave.`, { action: 'write' });
    } else {
      tl.open('pool', 'run', 'Done').print('[Worker] Done').focus('pool');
      s.running = [];
      tl.close('pool').status('pool', 'back in the pool, idle');
      push(L.done, 't = 2100 ms: the worker prints Done. The pool thread goes back to the pool to wait for more work.', { action: 'return' });
    }
  }
  tl.at(2500);
  tl.open('main', 'blocked', 'Sleep(3000)').status('main', 'waits 3000 ms so the worker can finish').focus('main');
  push(L.wait, 't = 2500 ms: the loop is over. Main sleeps 3 more seconds "so we can observe ThreadPool activity" (the worker already finished at 2100 ms).', { action: 'call' });
  tl.at(5500);
  tl.open('main', 'run', 'Finished').print('[Main]   Finished').status('main', 'prints Finished and ends the program').focus('main');
  push(L.finished, 't = 5500 ms: Main prints Finished.', {
    action: 'write',
    predict: { question: 'Pool threads are background threads. If WorkerTask were still running now, would it keep the program alive?', options: ['Yes', 'No, the process ends with Main'], answer: 1 },
  });
  tl.at(5750).close('main').focus();
  push(L.finished, 'Done. The order of lines printed at the same instant (t = 0) can differ between runs; this is one possible order.', { action: 'done' });
  return { doc, trace: r.steps };
}
