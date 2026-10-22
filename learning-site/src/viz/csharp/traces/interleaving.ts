import type { Prediction, Trace } from '../../engine/types';
import { docOf, lineIn, linesIn, Recorder, type CodeDoc } from '../shared/step';

/*
 * Two threads, one shared counter or two locks, and the learner as the scheduler. Code from
 * DeadlockNRaceCondition.md: RaceDemo (lost increments), Fix A (lock), Fix B (Interlocked), DeadlockDemo
 * (inconsistent lock order) and Fix 1 (consistent order).
 *
 * Simplified on purpose (and said so in the UI): two threads doing a few increments instead of ten threads
 * doing 100_000, and Thread.Sleep(100) drawn as one step.
 *
 * Runtime details the note doesn't spell out:
 *  - counter++ is three steps (load into a register, add, store), so a thread can be preempted between them
 *    and another thread's increment is lost; Interlocked.Increment does all three as one atomic operation:
 *    https://learn.microsoft.com/en-us/dotnet/api/system.threading.interlocked (Remarks)
 *  - lock lets one thread hold the lock at a time; any other thread trying to acquire it blocks until the
 *    lock is released: https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/lock
 */

export type ThreadId = 'T1' | 'T2';
export type TiVariant = 'race' | 'lock' | 'interlocked' | 'deadlock' | 'ordered';
export const THREADS: ThreadId[] = ['T1', 'T2'];

type OpKind = 'load' | 'add' | 'store' | 'atomic' | 'acquire' | 'release' | 'sleep' | 'print' | 'work';

interface Op {
  kind: OpKind;
  line: number;
  /** Lock name for acquire/release; text for print. */
  arg?: string;
  /** Short label for the scheduler button ("load counter"). */
  label: string;
}

export interface TiThread {
  id: ThreadId;
  /** Index of the next op; ops.length when finished. */
  pc: number;
  status: 'ready' | 'blocked' | 'done';
  /** The thread's private copy of counter (CPU register), null when it holds none. */
  reg: number | null;
  holds: string[];
  waitsFor: string | null;
  /** Increments this thread has completed (stores, atomic increments). */
  increments: number;
  /** What the next op does, for the scheduler button. */
  next: string;
}

export interface TiLock {
  name: string;
  owner: ThreadId | null;
}

export interface TiState {
  variant: TiVariant;
  threads: TiThread[];
  /** Shared counter (race variants), null for the lock-order variants. */
  counter: number | null;
  locks: TiLock[];
  /** Schedule entries consumed up to and including this step. */
  schedLen: number;
  /** The thread that ran in this step. */
  ran: ThreadId | null;
  deadlock: boolean;
  finished: boolean;
  /** Increments lost so far (completed increments − counter). */
  lost: number;
  output: string[];
  /** Lines of the other thread's next op (drawn with the softer highlight). */
  also: number[];
  /** A store that overwrote another thread's newer value in this step. */
  overwrote: boolean;
}

export interface TiRun {
  doc: CodeDoc;
  trace: Trace<TiState>;
  /** True once both threads finished or deadlocked. */
  complete: boolean;
}

export const TI_INCREMENTS = { min: 1, max: 3, default: 2 } as const;

function programs(variant: TiVariant, doc: CodeDoc, n: number): Record<ThreadId, Op[]> {
  if (variant === 'race' || variant === 'lock' || variant === 'interlocked') {
    const build = (): Op[] => {
      const ops: Op[] = [];
      for (let k = 0; k < n; k++) {
        if (variant === 'race') {
          const L = linesIn(doc, 0, { inc: 'counter++; // not atomic -> race' });
          ops.push({ kind: 'load', line: L.inc, label: 'load counter' }, { kind: 'add', line: L.inc, label: 'add 1' }, { kind: 'store', line: L.inc, label: 'store counter' });
        } else if (variant === 'lock') {
          const L = linesIn(doc, 0, { lock: 'lock (sync)', inc: 'counter++;', end: '}' });
          ops.push(
            { kind: 'acquire', line: L.lock, arg: 'sync', label: 'lock (sync)' },
            { kind: 'load', line: L.inc, label: 'load counter' },
            { kind: 'add', line: L.inc, label: 'add 1' },
            { kind: 'store', line: L.inc, label: 'store counter' },
            { kind: 'release', line: L.end, arg: 'sync', label: 'leave lock' },
          );
        } else {
          const L = linesIn(doc, 0, { inc: 'Interlocked.Increment(ref counter);' });
          ops.push({ kind: 'atomic', line: L.inc, label: 'Interlocked.Increment' });
        }
      }
      return ops;
    };
    return { T1: build(), T2: build() };
  }
  if (variant === 'deadlock') {
    const L = linesIn(doc, 0, {
      t1A: ['lock (lockA)', 1],
      t1Sleep: 'Thread.Sleep(100); // simulate work',
      t1B: ['lock (lockB)', 1],
      t2B: ['lock (lockB)', 2],
      t2Sleep: ['Thread.Sleep(100);', 2],
      t2A: ['lock (lockA)', 2],
    });
    const thread = (first: string, second: string, l1: number, sleep: number, l2: number, name: string): Op[] => [
      { kind: 'acquire', line: l1, arg: first, label: `lock (${first})` },
      { kind: 'sleep', line: sleep, label: 'Thread.Sleep(100)' },
      { kind: 'acquire', line: l2, arg: second, label: `lock (${second})` },
      { kind: 'print', line: l2, arg: `${name} got both`, label: 'print' },
      { kind: 'release', line: l2, arg: second, label: `leave lock (${second})` },
      { kind: 'release', line: l2 + 1, arg: first, label: `leave lock (${first})` },
    ];
    return { T1: thread('lockA', 'lockB', L.t1A, L.t1Sleep, L.t1B, 'T1'), T2: thread('lockB', 'lockA', L.t2B, L.t2Sleep, L.t2A, 'T2') };
  }
  // ordered: both threads run the Fix 1 fragment
  const L = linesIn(doc, 0, { a: 'lock (lockA)', b: 'lock (lockB)', work: '// safe', endB: ['}', 1], endA: ['}', 2] });
  const thread = (): Op[] => [
    { kind: 'acquire', line: L.a, arg: 'lockA', label: 'lock (lockA)' },
    { kind: 'acquire', line: L.b, arg: 'lockB', label: 'lock (lockB)' },
    { kind: 'work', line: L.work, label: 'work' },
    { kind: 'release', line: L.endB, arg: 'lockB', label: 'leave lock (lockB)' },
    { kind: 'release', line: L.endA, arg: 'lockA', label: 'leave lock (lockA)' },
  ];
  return { T1: thread(), T2: thread() };
}

const DOCS: Record<TiVariant, () => CodeDoc> = {
  race: () => docOf('dlRace'),
  lock: () => docOf('dlLockFix'),
  interlocked: () => docOf('dlInterlocked'),
  deadlock: () => docOf('dlDeadlock'),
  ordered: () => docOf('dlFixOrder'),
};

const isCounter = (v: TiVariant) => v === 'race' || v === 'lock' || v === 'interlocked';
const other = (t: ThreadId): ThreadId => (t === 'T1' ? 'T2' : 'T1');

/**
 * Runs `schedule` (which thread takes each next step) and records one step per scheduled op. Entries naming
 * a thread that can't run (finished or blocked) are skipped. Stops at the end of the schedule, when both
 * threads finish, or at a deadlock.
 */
export function tiRun(variant: TiVariant, schedule: readonly ThreadId[], n: number = TI_INCREMENTS.default): TiRun {
  const doc = DOCS[variant]();
  const progs = programs(variant, doc, Math.min(TI_INCREMENTS.max, Math.max(TI_INCREMENTS.min, n)));
  const counter = isCounter(variant);
  const lockNames = variant === 'lock' ? ['sync'] : variant === 'deadlock' || variant === 'ordered' ? ['lockA', 'lockB'] : [];
  const st: TiState = {
    variant,
    threads: THREADS.map((id) => ({ id, pc: 0, status: 'ready', reg: null, holds: [], waitsFor: null, increments: 0, next: progs[id][0]!.label })),
    counter: counter ? 0 : null,
    locks: lockNames.map((name) => ({ name, owner: null })),
    schedLen: 0,
    ran: null,
    deadlock: false,
    finished: false,
    lost: 0,
    output: [],
    also: [],
    overwrote: false,
  };
  const r = new Recorder<TiState>();
  const th = (id: ThreadId) => st.threads.find((t) => t.id === id)!;
  const lock = (name: string) => st.locks.find((l) => l.name === name)!;
  const canRun = (t: TiThread) => t.status === 'ready';
  const nextLine = (t: TiThread) => (t.pc < progs[t.id].length ? progs[t.id][t.pc]!.line : null);
  const vars = (): Record<string, string | number> => {
    const v: Record<string, string | number> = {};
    if (st.counter !== null) v.counter = st.counter;
    for (const t of st.threads) {
      if (counter && variant !== 'interlocked') v[`${t.id} register`] = t.reg === null ? '—' : t.reg;
      if (!counter) v[`${t.id} holds`] = t.holds.length ? t.holds.join(', ') : 'nothing';
    }
    return v;
  };
  const push = (line: number, narration: string, action: 'start' | 'read' | 'write' | 'branch' | 'done', predict?: Prediction) => {
    for (const t of st.threads) t.next = t.status === 'done' ? 'finished' : t.status === 'blocked' ? `blocked on ${t.waitsFor}` : progs[t.id][t.pc]!.label;
    const completed = st.threads.reduce((k, t) => k + t.increments, 0);
    if (st.counter !== null) st.lost = completed - st.counter;
    const others = st.threads.filter((t) => t.id !== st.ran && t.status !== 'done').map(nextLine).filter((x): x is number => x !== null && x !== line);
    st.also = others;
    r.push(st, { action, line, narration, vars: vars(), predict });
  };

  // first step
  const startLine =
    variant === 'race'
      ? lineIn(doc, 0, 'threads[i] = new Thread(() =>')
      : variant === 'deadlock'
        ? lineIn(doc, 0, 't1.Start(); t2.Start();')
        : progs.T1[0]!.line;
  push(
    startLine,
    counter
      ? `Two threads (T1 and T2) each run ${n} increment${n > 1 ? 's' : ''} of the shared counter, which starts at 0. You choose which thread runs each next step.`
      : variant === 'deadlock'
        ? 'Main starts t1 and t2. t1 takes lockA then lockB; t2 takes lockB then lockA. You choose which thread runs each next step.'
        : 'Both threads run the same code: lockA first, then lockB. You choose which thread runs each next step.',
    'start',
  );

  for (const pick of schedule) {
    if (st.finished || st.deadlock) break;
    const t = th(pick);
    st.schedLen++;
    if (!canRun(t)) continue;
    const op = progs[pick][t.pc]!;
    st.ran = pick;
    st.overwrote = false;
    let narration = '';
    let action: 'read' | 'write' | 'branch' = 'branch';
    let predict: Prediction | undefined;
    switch (op.kind) {
      case 'load':
        t.reg = st.counter!;
        narration = `${pick} loads counter (${st.counter}) into its register.`;
        action = 'read';
        t.pc++;
        break;
      case 'add':
        t.reg = t.reg! + 1;
        narration = `${pick} adds 1 in its register: ${t.reg}. counter in memory is still ${st.counter}.`;
        t.pc++;
        break;
      case 'store': {
        const before = st.counter!;
        const willLose = t.reg! <= before;
        const options = [...new Set([before, before + 1, t.reg!])].sort((x, y) => x - y).map(String);
        predict = {
          question: `${pick} stores its register (${t.reg}) back to counter, which is ${before} now. What is counter afterwards?`,
          options,
          answer: options.indexOf(String(t.reg)),
        };
        st.counter = t.reg!;
        t.increments++;
        t.reg = null;
        st.overwrote = willLose;
        const k = before + 1 - st.counter;
        narration = willLose
          ? `${pick} stores ${st.counter}, overwriting the ${before} that ${other(pick)} wrote. ${k === 1 ? `${other(pick)}'s increment is lost` : `${k} increments are lost`}: ${pick} loaded counter before ${other(pick)}'s store and never saw it.`
          : `${pick} stores ${st.counter} back to counter.`;
        action = 'write';
        t.pc++;
        break;
      }
      case 'atomic':
        st.counter = st.counter! + 1;
        t.increments++;
        narration = `${pick} runs Interlocked.Increment: load, add and store happen as one atomic operation, so no other thread can slip in between. counter = ${st.counter}.`;
        action = 'write';
        t.pc++;
        break;
      case 'acquire': {
        const l = lock(op.arg!);
        if (l.owner === null) {
          l.owner = pick;
          t.holds.push(l.name);
          t.waitsFor = null;
          narration = `${pick} acquires ${l.name}${t.holds.length > 1 ? ` (it now holds ${t.holds.join(' and ')})` : ''}.`;
          t.pc++;
        } else {
          t.status = 'blocked';
          t.waitsFor = l.name;
          narration = `${pick} tries to take ${l.name}, but ${l.owner} holds it, so ${pick} blocks until it is released.`;
        }
        break;
      }
      case 'release': {
        const l = lock(op.arg!);
        l.owner = null;
        t.holds = t.holds.filter((x) => x !== l.name);
        narration = `${pick} leaves the lock block and releases ${l.name}.`;
        const waiter = st.threads.find((x) => x.status === 'blocked' && x.waitsFor === l.name);
        if (waiter) {
          waiter.status = 'ready';
          narration += ` ${waiter.id} was waiting for it and can run again; it takes ${l.name} when it next runs.`;
        }
        t.pc++;
        break;
      }
      case 'sleep':
        narration = `${pick} sleeps 100 ms while still holding ${t.holds.join(' and ')}.`;
        t.pc++;
        break;
      case 'print':
        st.output.push(op.arg!);
        narration = `${pick} holds both locks and prints "${op.arg}".`;
        t.pc++;
        break;
      case 'work':
        narration = `${pick} holds lockA and lockB and does its work ("// safe").`;
        t.pc++;
        break;
    }
    if (t.pc >= progs[pick].length) {
      t.status = 'done';
      narration += ` ${pick} has finished.`;
    }
    // deadlock: every unfinished thread is blocked on a lock held by another blocked thread
    const live = st.threads.filter((x) => x.status !== 'done');
    if (live.length && live.every((x) => x.status === 'blocked')) st.deadlock = true;
    push(op.line, narration, action, predict);
  }

  st.overwrote = false;
  if (st.deadlock) {
    st.ran = null;
    push(
      lineIn(doc, 0, 't1.Join(); t2.Join();'),
      "Deadlock. T1 holds lockA and waits for lockB; T2 holds lockB and waits for lockA. Neither releases its first lock, so neither can continue, and Main waits in t1.Join() forever. Fix 1: take the locks in the same order everywhere.",
      'done',
    );
  } else if (st.threads.every((x) => x.status === 'done')) {
    st.finished = true;
    st.ran = null;
    if (counter) {
      const expected = st.threads.reduce((k, t) => k + t.increments, 0);
      const endLine = variant === 'race' ? lineIn(doc, 0, 'Console.WriteLine($"Counter = {counter}') : progs.T1[progs.T1.length - 1]!.line;
      push(
        endLine,
        st.counter === expected
          ? `Both threads finished: counter = ${st.counter}, as expected (${expected}).${variant === 'race' ? ' This schedule happened not to interleave inside counter++, so nothing was lost; other schedules lose updates.' : variant === 'lock' ? ' The lock let only one thread run counter++ at a time, so no schedule can lose an update.' : ' Each Interlocked.Increment is atomic, so no schedule can lose an update.'}`
          : `Both threads finished: counter = ${st.counter}, but ${expected} increments ran. ${expected - st.counter!} update${expected - st.counter! > 1 ? 's were' : ' was'} lost. With 10 threads × 100_000, the note says counter will usually be less than 1_000_000.`,
        'done',
      );
    } else {
      if (variant === 'deadlock') st.output.push('Done');
      push(
        variant === 'deadlock' ? lineIn(doc, 0, 'Console.WriteLine("Done");') : progs.T1[progs.T1.length - 1]!.line,
        variant === 'deadlock'
          ? 'Both threads finished and Main prints "Done". This schedule escaped the deadlock only because one thread got both locks before the other took its first one; the Sleep(100) in the note makes the two threads overlap.'
          : 'Both threads finished. Because both take lockA first, whoever gets lockA can always get lockB: there is no cycle, so no schedule deadlocks.',
        'done',
      );
    }
  }
  const last = r.steps[r.steps.length - 1]!;
  return { doc, trace: r.steps, complete: last.action === 'done' };
}

/** Lets the threads run in turns, skipping one that can't run, until the run completes. */
export function completeSchedule(variant: TiVariant, prefix: readonly ThreadId[], n: number, policy: 'alternate' | 'sequential' = 'alternate'): ThreadId[] {
  const sched = [...prefix];
  for (let guard = 0; guard < 200; guard++) {
    const run = tiRun(variant, sched, n);
    if (run.complete) return sched;
    const s = run.trace[run.trace.length - 1]!.state;
    const ready = s.threads.filter((t) => t.status === 'ready').map((t) => t.id);
    if (!ready.length) return sched;
    let pick: ThreadId;
    if (policy === 'sequential') pick = ready[0]!;
    else {
      const lastPick = [...sched].reverse().find(Boolean);
      pick = lastPick && ready.includes(other(lastPick)) ? other(lastPick) : ready[0]!;
    }
    sched.push(pick);
  }
  throw new Error('schedule did not complete');
}

export interface TiPreset {
  id: string;
  label: string;
  schedule: (n: number) => ThreadId[];
}

/** Ready-made schedules per variant. */
export const TI_PRESETS: Record<TiVariant, TiPreset[]> = {
  race: [
    { id: 'turns', label: 'Take turns', schedule: (n) => completeSchedule('race', [], n, 'alternate') },
    { id: 'sequential', label: 'T1 first, then T2', schedule: (n) => completeSchedule('race', [], n, 'sequential') },
  ],
  lock: [
    { id: 'turns', label: 'Take turns', schedule: (n) => completeSchedule('lock', [], n, 'alternate') },
    { id: 'sequential', label: 'T1 first, then T2', schedule: (n) => completeSchedule('lock', [], n, 'sequential') },
  ],
  interlocked: [
    { id: 'turns', label: 'Take turns', schedule: (n) => completeSchedule('interlocked', [], n, 'alternate') },
    { id: 'sequential', label: 'T1 first, then T2', schedule: (n) => completeSchedule('interlocked', [], n, 'sequential') },
  ],
  deadlock: [
    { id: 'turns', label: 'Both take their first lock', schedule: () => completeSchedule('deadlock', [], 2, 'alternate') },
    { id: 'sequential', label: 'T1 first, then T2', schedule: () => completeSchedule('deadlock', [], 2, 'sequential') },
  ],
  ordered: [
    { id: 'turns', label: 'Take turns', schedule: () => completeSchedule('ordered', [], 2, 'alternate') },
    { id: 'sequential', label: 'T1 first, then T2', schedule: () => completeSchedule('ordered', [], 2, 'sequential') },
  ],
};

export type TiScenario = 'race-count-increment' | 'deadlock-lock-order';

export const TI_SCENARIOS: Record<TiScenario, { title: string; parts: { id: TiVariant; label: string }[] }> = {
  'race-count-increment': {
    title: 'Race condition: two threads and counter++',
    parts: [
      { id: 'race', label: 'counter++ (race)' },
      { id: 'lock', label: 'Fix A: lock' },
      { id: 'interlocked', label: 'Fix B: Interlocked' },
    ],
  },
  'deadlock-lock-order': {
    title: 'Deadlock: two locks in opposite order',
    parts: [
      { id: 'deadlock', label: 'Opposite order (deadlock)' },
      { id: 'ordered', label: 'Fix 1: same order' },
    ],
  },
};

export function toTiScenario(s: unknown): TiScenario {
  return s === 'deadlock-lock-order' ? 'deadlock-lock-order' : 'race-count-increment';
}

export function usesCounter(v: TiVariant): boolean {
  return isCounter(v);
}
