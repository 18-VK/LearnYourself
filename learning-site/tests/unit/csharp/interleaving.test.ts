import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
import { completeSchedule, THREADS, TI_PRESETS, TI_SCENARIOS, tiRun, type ThreadId, type TiVariant } from '../../../src/viz/csharp/traces/interleaving';
import { textAt } from '../../../src/viz/csharp/shared/step';
import { expectWellFormed } from './helpers';

/** Every complete schedule (each choice = a thread that can run), up to `limit` of them. */
function allSchedules(variant: TiVariant, n: number, limit = 5000): ThreadId[][] {
  const out: ThreadId[][] = [];
  const walk = (prefix: ThreadId[]) => {
    if (out.length >= limit) return;
    const run = tiRun(variant, prefix, n);
    if (run.complete) {
      out.push(prefix);
      return;
    }
    const s = run.trace.at(-1)!.state;
    for (const t of THREADS) if (s.threads.find((x) => x.id === t)!.status === 'ready') walk([...prefix, t]);
  };
  walk([]);
  return out;
}

describe('race: counter++ without a lock', () => {
  const schedules = allSchedules('race', 2);
  it('enumerates every interleaving of two threads × two increments', () => {
    // 12 micro-steps, 6 per thread: C(12, 6) orders
    expect(schedules).toHaveLength(924);
  });
  it('counter + lost updates always equals the increments done, at every step', () => {
    for (const sch of schedules) {
      for (const step of tiRun('race', sch, 2).trace) {
        const done = step.state.threads.reduce((k, t) => k + t.increments, 0);
        expect(step.state.counter! + step.state.lost).toBe(done);
        expect(step.state.lost).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('can end anywhere from 2 to 4, and loses updates exactly when a store overwrites', () => {
    const finals = new Set(schedules.map((sch) => tiRun('race', sch, 2).trace.at(-1)!.state.counter));
    expect([...finals].sort()).toEqual([2, 3, 4]);
    for (const sch of schedules) {
      const t = tiRun('race', sch, 2).trace;
      for (let i = 1; i < t.length; i++) expect(t[i]!.state.lost > t[i - 1]!.state.lost).toBe(t[i]!.state.overwrote);
    }
  });
  it('taking turns loses one update per pair of increments; T1-then-T2 loses none', () => {
    expect(tiRun('race', TI_PRESETS.race[0]!.schedule(2), 2).trace.at(-1)!.state.counter).toBe(2);
    expect(tiRun('race', TI_PRESETS.race[1]!.schedule(2), 2).trace.at(-1)!.state.counter).toBe(4);
  });
  it('is well formed and the store question names the next counter value', () => {
    for (const sch of schedules.slice(0, 100)) {
      const run = tiRun('race', sch, 2);
      expectWellFormed(run.trace, run.doc);
      for (const s of run.trace) if (s.predict) expect(Number(s.predict.options[s.predict.answer])).toBe(s.state.counter);
    }
  });
  it('highlights counter++ for each micro-step, between the thread setup and the final print', () => {
    const run = tiRun('race', ['T1', 'T1', 'T1', 'T2', 'T2', 'T2'], 1);
    const texts = run.trace.map((s) => textAt(run.doc, s.codeLine).trim());
    expect(texts[0]).toBe('threads[i] = new Thread(() =>');
    expect(texts.slice(1, 7).every((t) => t === 'counter++; // not atomic -> race')).toBe(true);
    expect(texts[7]).toMatch(/^Console\.WriteLine\(\$"Counter = \{counter\}/);
  });
});

describe('Fix A (lock) and Fix B (Interlocked)', () => {
  for (const variant of ['lock', 'interlocked'] as const) {
    it(`${variant}: every schedule ends with counter = 2 × increments and loses nothing`, () => {
      const n = variant === 'lock' ? 1 : 2;
      const schedules = allSchedules(variant, n);
      expect(schedules.length).toBeGreaterThan(1);
      for (const sch of schedules) {
        const t = tiRun(variant, sch, n).trace;
        expect(t.at(-1)!.state.counter).toBe(2 * n);
        expect(t.every((s) => s.state.lost === 0)).toBe(true);
      }
    });
  }
  it('lock: at most one thread is between acquiring and releasing sync', () => {
    for (const sch of allSchedules('lock', 1)) {
      for (const step of tiRun('lock', sch, 1).trace) {
        expect(step.state.threads.filter((t) => t.holds.includes('sync')).length).toBeLessThanOrEqual(1);
        const owner = step.state.locks[0]!.owner;
        if (owner) expect(step.state.threads.find((t) => t.id === owner)!.holds).toContain('sync');
      }
    }
  });
  it('lock: a thread that finds sync held blocks instead of running counter++', () => {
    const t = tiRun('lock', ['T1', 'T2'], 1).trace;
    expect(t.at(-1)!.state.threads.find((x) => x.id === 'T2')).toMatchObject({ status: 'blocked', waitsFor: 'sync', reg: null });
  });
});

describe('deadlock (DeadlockDemo) and Fix 1 (same order)', () => {
  it('both threads taking their first lock ends in the wait-for cycle the note describes', () => {
    const run = tiRun('deadlock', TI_PRESETS.deadlock[0]!.schedule(2));
    const s = run.trace.at(-1)!.state;
    expect(s.deadlock).toBe(true);
    expect(s.threads).toEqual([
      expect.objectContaining({ id: 'T1', status: 'blocked', holds: ['lockA'], waitsFor: 'lockB' }),
      expect.objectContaining({ id: 'T2', status: 'blocked', holds: ['lockB'], waitsFor: 'lockA' }),
    ]);
    expect(textAt(run.doc, run.trace.at(-1)!.codeLine).trim()).toBe('t1.Join(); t2.Join();');
    expect(s.output).toEqual([]);
  });
  it('T1 first, then T2 finishes and prints what the program prints', () => {
    const s = tiRun('deadlock', TI_PRESETS.deadlock[1]!.schedule(2)).trace.at(-1)!.state;
    expect(s.deadlock).toBe(false);
    expect(s.output).toEqual(['T1 got both', 'T2 got both', 'Done']);
  });
  it('deadlocks exactly when each thread holds its first lock before either takes its second', () => {
    const schedules = allSchedules('deadlock', 2);
    let deadlocks = 0;
    for (const sch of schedules) {
      const t = tiRun('deadlock', sch).trace;
      // T1 holds lockA and T2 holds lockB, and neither has got past `lock (second)` (op index 2)
      const both = t.some((s) => {
        const [t1, t2] = s.state.threads;
        return t1!.holds.join() === 'lockA' && t1!.pc <= 2 && t2!.holds.join() === 'lockB' && t2!.pc <= 2;
      });
      expect(t.at(-1)!.state.deadlock).toBe(both);
      if (both) deadlocks++;
    }
    expect(deadlocks).toBeGreaterThan(0);
    expect(deadlocks).toBeLessThan(schedules.length);
  });
  it('same lock order: no schedule deadlocks', () => {
    const schedules = allSchedules('ordered', 2);
    expect(schedules.length).toBeGreaterThan(1);
    for (const sch of schedules) {
      const run = tiRun('ordered', sch);
      expect(run.trace.at(-1)!.state.deadlock).toBe(false);
      expect(run.trace.at(-1)!.state.finished).toBe(true);
      expectWellFormed(run.trace, run.doc);
    }
  });
});

describe('scheduling', () => {
  it('a longer schedule replays the shorter one step for step (so the learner can branch)', () => {
    const full = TI_PRESETS.race[0]!.schedule(2);
    const long = tiRun('race', full, 2).trace;
    const short = tiRun('race', full.slice(0, 5), 2).trace;
    expect(long.slice(0, short.length).map((s) => s.narration)).toEqual(short.map((s) => s.narration));
    expect(short.at(-1)!.state.schedLen).toBe(5);
  });
  it('completes any prefix, and every preset completes', () => {
    for (const [variant, presets] of Object.entries(TI_PRESETS) as [TiVariant, typeof TI_PRESETS.race][]) {
      for (const pr of presets) expect(tiRun(variant, pr.schedule(2), 2).complete).toBe(true);
      expect(tiRun(variant, completeSchedule(variant, ['T2'], 2), 2).complete).toBe(true);
    }
  });
  it('the placements offer the note’s fixes', () => {
    expect(TI_SCENARIOS['race-count-increment'].parts.map((p) => p.id)).toEqual(['race', 'lock', 'interlocked']);
    expect(TI_SCENARIOS['deadlock-lock-order'].parts.map((p) => p.id)).toEqual(['deadlock', 'ordered']);
  });
});
