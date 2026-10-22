import { describe, expect, it } from 'vitest';
import { LIMITER_LINES, linesForStep } from '../../../src/viz/aspnet/ratelimit/code';
import { ALGOS, NOTE_SETTINGS, PATTERNS, simulate, type Algo, type RlStep, type Settings } from '../../../src/viz/aspnet/ratelimit/sim';
import { ALL_FOUR_LIMITERS_CODE, LEAKY_BUCKET_TEXT, NOTES, REJECTION_CODE } from '../../../src/viz/aspnet/sources';
import { noteText } from './helpers';

const note = noteText(NOTES.rateLimiting);
const at = <T,>(n: number, v: T): T[] => Array.from({ length: n }, () => v);
const final = (t: RlStep[]) => t.at(-1)!.state;
const statuses = (t: RlStep[]) => final(t).requests.map((r) => r.status);
const count = (t: RlStep[], s: string) => statuses(t).filter((x) => x === s).length;
const with_ = <A extends Algo>(algo: A, patch: Partial<Settings[A]>): Settings => ({ ...NOTE_SETTINGS, [algo]: { ...NOTE_SETTINGS[algo], ...patch } });

describe('settings and code come from the note', () => {
  it('copies the four limiter types, the rejection setup and the leaky bucket text', () => {
    expect(note).toContain(ALL_FOUR_LIMITERS_CODE);
    expect(note).toContain(REJECTION_CODE);
    expect(note).toContain(LEAKY_BUCKET_TEXT);
  });

  it("defaults to the numbers in the note's code", () => {
    const num = (marker: string, occurrence = 1) => {
      const line = ALL_FOUR_LIMITERS_CODE.split('\n').filter((l) => l.includes(marker))[occurrence - 1]!;
      return Number(/(\d+)/.exec(line.split('=')[1]!)![1]);
    };
    expect(NOTE_SETTINGS['fixed-window']).toEqual({ permitLimit: num('opt.PermitLimit', 1), windowSec: num('opt.Window', 1), queueLimit: num('opt.QueueLimit', 1) });
    expect(NOTE_SETTINGS['sliding-window']).toEqual({ permitLimit: num('opt.PermitLimit', 2), windowSec: num('opt.Window', 2), segments: num('opt.SegmentsPerWindow'), queueLimit: num('opt.QueueLimit', 2) });
    expect(NOTE_SETTINGS['token-bucket']).toEqual({ tokenLimit: num('opt.TokenLimit'), tokensPerPeriod: num('opt.TokensPerPeriod'), periodSec: num('opt.ReplenishmentPeriod'), queueLimit: num('opt.QueueLimit', 3) });
    expect(NOTE_SETTINGS.concurrency).toMatchObject({ permitLimit: num('opt.PermitLimit', 3), queueLimit: num('opt.QueueLimit', 4) });
  });

  it("highlights each limiter's own lines", () => {
    const lines = ALL_FOUR_LIMITERS_CODE.split('\n');
    const text = (n: number[] | undefined) => (n ?? []).map((l) => lines[l - 1]!.trim());
    expect(text(LIMITER_LINES['fixed-window'].window)).toEqual(['opt.Window = TimeSpan.FromSeconds(60);']);
    expect(text(LIMITER_LINES['sliding-window'].segments)).toEqual(['opt.Window = TimeSpan.FromSeconds(60);', 'opt.SegmentsPerWindow = 4;   // divides window into 4 sub-segments']);
    expect(text(LIMITER_LINES['token-bucket'].limit)).toEqual(['opt.TokenLimit = 20;']);
    expect(text(LIMITER_LINES.concurrency.queue)).toEqual(['opt.QueueLimit = 10;']);
    expect(LIMITER_LINES['sliding-window'].limit![0]).toBeGreaterThan(LIMITER_LINES['fixed-window'].limit![0]!);
    expect(linesForStep('leaky-bucket', undefined)).toEqual([1]);
  });
});

describe('fixed window', () => {
  it("the note's curl test (15 at once): 10 accepted, 2 queued until the next window, 3 rejected", () => {
    const t = simulate('fixed-window', NOTE_SETTINGS, at(15, 0));
    expect(statuses(t)).toEqual([...at(10, 'accepted'), 'accepted', 'accepted', 'rejected', 'rejected', 'rejected']);
    expect(final(t).requests.slice(10, 12).map((r) => r.grantedAt)).toEqual([60, 60]);
  });

  it('lets 2× the limit through around a window edge', () => {
    const t = simulate('fixed-window', NOTE_SETTINGS, [...at(10, 59), ...at(10, 60)]);
    expect(count(t, 'accepted')).toBe(20);
    expect(final(t).requests.every((r) => r.grantedAt! - r.t === 0)).toBe(true);
  });

  it('QueueLimit = 0 rejects immediately', () => {
    const t = simulate('fixed-window', with_('fixed-window', { queueLimit: 0 }), at(12, 0));
    expect(count(t, 'rejected')).toBe(2);
  });
});

describe('sliding window', () => {
  it('reproduces the table on Microsoft Learn (30 s window, 3 segments, limit 100)', () => {
    // https://learn.microsoft.com/aspnet/core/performance/rate-limit#sliding-window-limiter
    const taken = [20, 30, 40, 30, 10, 10, 35];
    const carryOver = [80, 50, 10, 0, 20, 50, 45];
    const s = with_('sliding-window', { permitLimit: 100, windowSec: 30, segments: 3, queueLimit: 0 });
    const t = simulate('sliding-window', s, taken.flatMap((n, k) => at(n, k * 10)));
    expect(count(t, 'rejected')).toBe(0);
    for (const [k, carry] of carryOver.entries()) {
      // the last arrival of segment k
      const lastOfSegment = t.filter((x) => x.kind === 'arrive' && x.state.now === k * 10).at(-1)!;
      expect(lastOfSegment.state.limiter.available).toBe(carry);
    }
  });

  it('smooths the edge burst: only the limit (plus the queue) gets through', () => {
    const t = simulate('sliding-window', NOTE_SETTINGS, [...at(10, 59), ...at(10, 60)]);
    const quick = final(t).requests.filter((r) => r.grantedAt !== undefined && r.grantedAt - r.t < 1);
    expect(quick).toHaveLength(10);
    expect(count(t, 'rejected')).toBe(8);
    // the two queued requests wait until the 45–60 s segment leaves the window at 1:45
    expect(final(t).requests.filter((r) => r.t === 60 && r.status === 'accepted').map((r) => r.grantedAt)).toEqual([105, 105]);
  });
});

describe('token bucket', () => {
  it('bursts up to TokenLimit, queues 2, then refills 5 per 10 s', () => {
    const t = simulate('token-bucket', NOTE_SETTINGS, at(25, 0));
    expect(count(t, 'accepted')).toBe(22);
    expect(count(t, 'rejected')).toBe(3);
    expect(final(t).requests.slice(20, 22).map((r) => r.grantedAt)).toEqual([10, 10]);
    const refill = t.find((x) => x.kind === 'tick')!;
    expect(refill.state.now).toBe(10);
    expect(refill.state.limiter.tokens).toBe(5);
  });

  it('never refills above TokenLimit', () => {
    const t = simulate('token-bucket', NOTE_SETTINGS, [0, 30]);
    for (const s of t) expect(s.state.limiter.tokens!).toBeLessThanOrEqual(20);
  });

  it("the capstone's settings (10 tokens, 10 per 5 s, QueueLimit 0) reject the 11th request at once", () => {
    const s = with_('token-bucket', { tokenLimit: 10, tokensPerPeriod: 10, periodSec: 5, queueLimit: 0 });
    expect(statuses(simulate('token-bucket', s, at(11, 0)))).toEqual([...at(10, 'accepted'), 'rejected']);
  });
});

describe('concurrency', () => {
  it('runs 5 at a time and frees a permit when a request completes', () => {
    const t = simulate('concurrency', NOTE_SETTINGS, at(15, 0));
    expect(count(t, 'rejected')).toBe(0);
    expect(final(t).requests.map((r) => r.grantedAt)).toEqual([...at(5, 0), ...at(5, 4), ...at(5, 8)]);
    for (const s of t) expect(s.state.limiter.inFlight!.length).toBeLessThanOrEqual(5);
    expect(t.filter((x) => x.kind === 'complete')).toHaveLength(15);
  });
});

describe('leaky bucket (the note’s theory)', () => {
  it('lets requests out at a constant rate and overflows when full', () => {
    const t = simulate('leaky-bucket', NOTE_SETTINGS, at(15, 0));
    expect(count(t, 'rejected')).toBe(5);
    expect(final(t).requests.filter((r) => r.status === 'accepted').map((r) => r.grantedAt)).toEqual([6, 12, 18, 24, 30, 36, 42, 48, 54, 60]);
  });
});

describe('every limiter, every pattern', () => {
  it('stays within its limits and decides every request', () => {
    for (const algo of ALGOS)
      for (const p of PATTERNS) {
        const t = simulate(algo, NOTE_SETTINGS, p.arrivals(NOTE_SETTINGS, algo));
        const s = NOTE_SETTINGS;
        let prev = 0;
        for (const st of t) {
          expect(st.state.now).toBeGreaterThanOrEqual(prev);
          prev = st.state.now;
          const q = st.state.limiter.queue.length;
          const ql = algo === 'leaky-bucket' ? s['leaky-bucket'].capacity : algo === 'concurrency' ? s.concurrency.queueLimit : s[algo].queueLimit;
          expect(q).toBeLessThanOrEqual(ql);
          if (st.state.limiter.window) expect(st.state.limiter.window.used).toBeLessThanOrEqual(s['fixed-window'].permitLimit);
          if (algo === 'sliding-window') expect(st.state.limiter.available!).toBeGreaterThanOrEqual(0);
          if (st.predict) expect(st.predict.answer).toBeLessThan(3);
          expect(st.narration.length).toBeGreaterThan(10);
        }
        expect(t.at(-1)!.kind).toBe('done');
        const end = final(t);
        expect(end.requests).toHaveLength(p.arrivals(NOTE_SETTINGS, algo).length);
        expect(end.requests.every((r) => r.status !== 'queued'), `${algo} ${p.id}`).toBe(true);
        expect(end.totals.accepted + end.totals.rejected).toBe(end.requests.length);
      }
  });

  it('predicts the outcome it then narrates', () => {
    const t = simulate('fixed-window', NOTE_SETTINGS, at(15, 0));
    for (const st of t.filter((x) => x.predict)) {
      const r = st.state.requests.find((x) => x.id === st.state.focus)!;
      expect(['accepted', 'queued', 'rejected'][st.predict!.answer]).toBe(r.status);
    }
  });
});
