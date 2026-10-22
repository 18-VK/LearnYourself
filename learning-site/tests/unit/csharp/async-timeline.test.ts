import { describe, expect, it } from 'vitest';
import { SNIPPETS } from '../../../src/viz/csharp/snippets';
import { ASYNC_PARTS, asyncPart, THROTTLE, toAsyncParts, type AsyncContext, type AtState } from '../../../src/viz/csharp/traces/async-timeline';
import type { Trace } from '../../../src/viz/engine/types';
import { expectWellFormed, lineTexts } from './helpers';

const CTX: AsyncContext[] = ['console', 'ui'];

function expectTimelineInvariants(trace: Trace<AtState>): void {
  let now = 0;
  for (const step of trace) {
    const s = step.state;
    expect(s.now).toBeGreaterThanOrEqual(now);
    now = s.now;
    expect(s.now).toBeLessThanOrEqual(s.axis);
    const laneIds = new Set(s.lanes.map((l) => l.id));
    for (const seg of s.segs) {
      expect(laneIds.has(seg.lane)).toBe(true);
      expect(seg.from).toBeLessThanOrEqual(s.now);
      if (seg.to !== null) expect(seg.to).toBeGreaterThanOrEqual(seg.from);
    }
    // within a lane, segments never overlap and at most one is open
    for (const id of laneIds) {
      const segs = s.segs.filter((x) => x.lane === id);
      expect(segs.filter((x) => x.to === null).length).toBeLessThanOrEqual(1);
      for (let i = 1; i < segs.length; i++) expect(segs[i]!.from).toBeGreaterThanOrEqual(segs[i - 1]!.to ?? Infinity);
    }
    for (const f of s.focus) expect(laneIds.has(f)).toBe(true);
  }
}

describe('async timeline parts', () => {
  it('defaults to all three parts and drops unknown names', () => {
    expect(toAsyncParts(undefined)).toEqual(['sync-vs-async', 'await-releases-thread', 'when-all']);
    expect(toAsyncParts(['when-all', 'bogus'])).toEqual(['when-all']);
  });
  for (const { id } of ASYNC_PARTS) {
    for (const ctx of CTX) {
      it(`${id} (${ctx}) is well formed and keeps time consistent`, () => {
        const part = asyncPart(id, ctx);
        expectWellFormed(part.trace, part.doc);
        expectTimelineInvariants(part.trace);
      });
    }
  }
});

describe('sync vs async (DeadlockNRaceCondition.md)', () => {
  const last = (ctx: AsyncContext) => asyncPart('sync-vs-async', ctx).trace.at(-1)!.state;
  const blocked = (s: AtState, lane: string) => s.segs.filter((x) => x.lane === lane && x.kind === 'blocked').reduce((n, x) => n + ((x.to ?? s.now) - x.from), 0);
  it('console app: .Result blocks the main thread for the whole delay; await blocks nothing', () => {
    const s = last('console');
    expect(blocked(s, 's-th')).toBe(1000);
    expect(blocked(s, 'a-th')).toBe(0);
    expect(s.forever).toEqual([]);
    // the continuation ran on the thread pool in both versions
    expect(s.segs.some((x) => x.lane === 's-pool' && x.kind === 'run' && x.from === 1000)).toBe(true);
    expect(s.segs.some((x) => x.lane === 'a-pool' && x.kind === 'run' && x.from === 1000)).toBe(true);
  });
  it('UI app: .Result deadlocks; the await version resumes on the UI thread', () => {
    const s = last('ui');
    expect(s.forever).toEqual(['s-th']);
    expect(s.segs.filter((x) => x.lane === 's-th').at(-1)).toMatchObject({ kind: 'blocked', to: null });
    expect(blocked(s, 'a-th')).toBe(0);
    expect(s.segs.some((x) => x.lane === 'a-th' && x.kind === 'run' && x.from === 1000)).toBe(true);
    expect(s.lanes.some((l) => l.id.endsWith('pool'))).toBe(false);
  });
  it('asks what the thread does during the delay before showing it', () => {
    const t = asyncPart('sync-vs-async', 'console').trace;
    const q = t.find((x) => x.predict?.question.includes('1000 ms delay'))!;
    const before = t[t.indexOf(q) - 1]!.state;
    expect(before.segs.some((x) => x.kind === 'blocked')).toBe(false);
    expect(q.state.segs.some((x) => x.lane === 's-th' && x.kind === 'blocked')).toBe(true);
    expect(q.predict!.options[q.predict!.answer]).toBe('Blocked with .Result, free with await');
  });
});

describe('await releases the thread (OtherTopics.md › 3) Example)', () => {
  /** The note's sample output block, without its trailing `// …` comments. */
  const noteOutput = (code: string) => code.split('\n').map((l) => l.replace(/\s*\/\/.*$/, ''));
  it("prints the note's console output", () => {
    expect(asyncPart('await-releases-thread', 'console').trace.at(-1)!.state.output).toEqual(noteOutput(SNIPPETS.otDemoConsole.code));
  });
  it("prints the note's WPF output", () => {
    expect(asyncPart('await-releases-thread', 'ui').trace.at(-1)!.state.output).toEqual(noteOutput(SNIPPETS.otDemoWpf.code));
  });
  it('thread 1 is never blocked; only the pool thread sleeps', () => {
    for (const ctx of CTX) {
      const s = asyncPart('await-releases-thread', ctx).trace.at(-1)!.state;
      expect(s.segs.some((x) => x.lane === 't1' && x.kind === 'blocked')).toBe(false);
      expect(s.segs.find((x) => x.lane === 't4' && x.kind === 'blocked')).toMatchObject({ from: 0, to: 500 });
    }
  });
  it('follows the C# line by line', () => {
    const p = asyncPart('await-releases-thread', 'console');
    expect(lineTexts(p.trace, p.doc)).toEqual([
      'Console.WriteLine($"Before await: {Thread.CurrentThread.ManagedThreadId}");',
      'await Task.Run(() => {',
      'Console.WriteLine($"Task running on: {Thread.CurrentThread.ManagedThreadId}");',
      'Thread.Sleep(500);',
      '});',
      'Console.WriteLine($"After await:  {Thread.CurrentThread.ManagedThreadId}");',
    ]);
  });
});

describe('Task.WhenAll (OtherTopics.md › SemaphoreSlim example A)', () => {
  const part = asyncPart('when-all', 'console');
  const final = part.trace.at(-1)!.state;
  it('never has more than two workers inside the semaphore', () => {
    for (const step of part.trace) {
      const now = step.state.now;
      const inside = step.state.segs.filter((x) => x.kind === 'inside' && x.from <= now && (x.to === null || x.to > now)).length;
      expect(inside).toBeLessThanOrEqual(THROTTLE.slots);
    }
  });
  it('every worker enters, leaves and releases exactly once', () => {
    for (let i = 0; i < THROTTLE.workers; i++) {
      for (const word of ['Entered', 'Leaving', 'Released']) expect(final.output.filter((l) => l.startsWith(`[${i}] ${word}`))).toHaveLength(1);
    }
  });
  it('WhenAll completes when the last worker finishes, at 3000 ms', () => {
    const doneAll = final.segs.find((x) => x.lane === 'all' && x.kind === 'done')!;
    const lastWorker = Math.max(...final.segs.filter((x) => x.lane.startsWith('w') && x.kind === 'done').map((x) => x.from));
    expect(doneAll.from).toBe(lastWorker);
    expect(lastWorker).toBe(3000);
  });
  it('Release reports the previous count, consistent with the slots handed on', () => {
    expect(final.output).toEqual([
      '[0] Entered. CurrentCount=1',
      '[1] Entered. CurrentCount=0',
      '[0] Leaving.',
      '[0] Released (previous count was 0).',
      '[2] Entered. CurrentCount=0',
      '[1] Leaving.',
      '[1] Released (previous count was 0).',
      '[3] Entered. CurrentCount=0',
      '[2] Leaving.',
      '[2] Released (previous count was 0).',
      '[4] Entered. CurrentCount=0',
      '[3] Leaving.',
      '[3] Released (previous count was 0).',
      '[4] Leaving.',
      '[4] Released (previous count was 1).',
    ]);
  });
});
