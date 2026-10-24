import { describe, expect, it } from 'vitest';
import { diff, listItems, MARKER, parseCases } from '../../../src/scripts/practice/protocol';

const m = (n: number, what: string) => `${MARKER}${n} ${what}\n`;

describe('practice protocol: reading the harness output', () => {
  it('matches each case with its expected value, keeping what the code printed', () => {
    const out = m(1, 'start') + m(1, 'result [2, 3]') + m(2, 'start') + 'hello\n' + m(2, 'result 4');
    const cases = parseCases(out, ['[2, 3]', '5']);
    expect(cases).toEqual([
      { n: 1, status: 'pass', actual: '[2, 3]', printed: '' },
      { n: 2, status: 'fail', actual: '4', printed: 'hello\n' },
    ]);
  });

  it('reports exceptions, cases that never ran, and the case a timeout or crash interrupted', () => {
    const out = m(1, 'start') + m(1, 'error IndexOutOfRangeException: Index was outside the bounds of the array.') + m(2, 'start');
    expect(parseCases(out, ['1', '2', '3'], 'timeout').map((c) => c.status)).toEqual(['error', 'timeout', 'not-run']);
    expect(parseCases(out, ['1', '2', '3'], 'crash').map((c) => c.status)).toEqual(['error', 'crash', 'not-run']);
    expect(parseCases(out, ['1', '2', '3']).map((c) => c.status)).toEqual(['error', 'crash', 'not-run']);
    expect(parseCases(out, ['1', '2', '3'])[0]!.error).toBe('IndexOutOfRangeException: Index was outside the bounds of the array.');
  });

  it('unescapes line breaks in results and ignores marker-like text the code printed', () => {
    const out = m(1, 'start') + m(1, 'result a\\nb\\\\c') + m(2, 'start') + `${MARKER}not a real marker\n` + m(2, 'result x');
    const cases = parseCases(out, ['a\nb\\c', 'x']);
    expect(cases[0]).toMatchObject({ status: 'pass', actual: 'a\nb\\c' });
    expect(cases[1]).toMatchObject({ status: 'pass', printed: `${MARKER}not a real marker\n` });
  });
});

describe('practice protocol: comparing values', () => {
  it('splits printed lists at the top level', () => {
    expect(listItems('[1, [2, 3], 4]')).toEqual(['1', '[2, 3]', '4']);
    expect(listItems('[]')).toEqual([]);
    expect(listItems('5')).toBeNull();
    expect(listItems('[Ann (21), Bo (40)]')).toEqual(['Ann (21)', 'Bo (40)']);
  });

  it('marks the items that differ, by position', () => {
    const d = diff('[1, 2, 3]', '[1, 5, 3, 9]');
    expect(d.lists).toBe(true);
    expect(d.firstDifference).toBe(1);
    expect(d.actual.map((p) => p.differs)).toEqual([false, true, false, true]);
    expect(d.expected.map((p) => p.differs)).toEqual([false, true, false]);
    expect(diff('7', '7')).toEqual({ expected: [{ text: '7', differs: false }], actual: [{ text: '7', differs: false }], firstDifference: null, lists: false });
    expect(diff('7', '8').firstDifference).toBe(0);
  });
});
