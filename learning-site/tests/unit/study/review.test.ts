import { describe, expect, it } from 'vitest';
import { DAY, interleave, isDue, nextDue, schedule } from '../../../src/scripts/review-schedule';

const T0 = Date.UTC(2026, 9, 24, 9);

describe('spaced review schedule', () => {
  it('brings a wrong answer back tomorrow and a first right answer back in four days', () => {
    const wrong = schedule(undefined, false, T0);
    expect(wrong).toMatchObject({ interval: 1, right: 0, lapses: 1, last: T0 });
    expect(wrong.due).toBe(T0 + DAY);
    const right = schedule(undefined, true, T0);
    expect(right).toMatchObject({ interval: 4, right: 1, lapses: 0 });
    expect(right.due).toBe(T0 + 4 * DAY);
  });

  it('grows the interval 2.5× per right answer, resets after a lapse, and caps at 180 days', () => {
    let it = schedule(undefined, true, T0);
    it = schedule(it, true, it.due);
    expect(it.interval).toBe(10);
    it = schedule(it, true, it.due);
    expect(it.interval).toBe(25);
    const lapsed = schedule(it, false, it.due);
    expect(lapsed).toMatchObject({ interval: 1, right: 0, lapses: 1 });
    const back = schedule(lapsed, true, lapsed.due);
    expect(back).toMatchObject({ interval: 3, right: 1, lapses: 1 });
    let big = { ...back, interval: 100 };
    big = schedule(big, true, T0);
    expect(big.interval).toBe(180);
    expect(schedule(big, true, T0).interval).toBe(180);
  });

  it('knows what is due and when the next review comes', () => {
    const a = schedule(undefined, false, T0); // due T0 + 1 day
    const b = schedule(undefined, true, T0); // due T0 + 4 days
    expect(isDue(a, T0)).toBe(false);
    expect(isDue(a, T0 + DAY)).toBe(true);
    expect(nextDue([a, b], T0 + DAY)).toBe(b.due);
    expect(nextDue([a, b], T0 + 10 * DAY)).toBeNull();
  });
});

describe('interleaving', () => {
  it('alternates between groups and keeps each group’s own order', () => {
    const items = ['a1', 'a2', 'a3', 'b1', 'b2', 'c1'];
    expect(interleave(items, (x) => x[0]!)).toEqual(['a1', 'b1', 'c1', 'a2', 'b2', 'a3']);
    expect(interleave([], () => 'x')).toEqual([]);
    expect(interleave(['solo'], () => 'x')).toEqual(['solo']);
  });
});
