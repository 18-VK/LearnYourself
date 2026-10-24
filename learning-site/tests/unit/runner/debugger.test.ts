import { describe, expect, it } from 'vitest';
import { KIND, Trace, type TraceJson, type Value } from '../../../src/scripts/runner/debug/trace';
import { arrayViews, asNumber, show } from '../../../src/scripts/runner/debug/values';

const int = (v: number): Value => ({ k: 'v', t: 'int', v: String(v) });

/**
 * The trace the recorder produces for
 *   1  int Fact(int n)
 *   2  {
 *   3      if (n <= 1) return 1;
 *   4      return n * Fact(n - 1);
 *   5  }
 *   6  Console.WriteLine(Fact(2));
 */
const fact: TraceJson = {
  v: 1,
  maxSteps: 10000,
  stop: null,
  files: ['snippet.cs', 'harness.cs'],
  names: [['n', 'int']],
  values: [int(2), int(1)],
  vars: [[], [0, 0], [0, 1]],
  methods: [
    { name: 'top-level statements', file: 0, line: 6, endLine: 6, entry: true },
    { name: 'Fact', file: 0, line: 1, endLine: 5, entry: false },
  ],
  frames: [
    [0, -1, 1, 0, 0],
    [1, 0, 2, 0, 6],
    [1, 1, 3, 0, 4],
  ],
  steps: [
    [KIND.line, 0, 0, 6, 0, 0, -1], // 0  line 6
    [KIND.call, 1, 0, 1, 0, 1, -1], // 1  Fact(2)
    [KIND.line, 1, 0, 3, 0, 1, -1], // 2
    [KIND.line, 1, 0, 4, 0, 1, -1], // 3
    [KIND.call, 2, 0, 1, 0, 2, -1], // 4  Fact(1)
    [KIND.line, 2, 0, 3, 0, 2, -1], // 5
    [KIND.return, 2, 0, 3, 0, 2, 1], // 6  returns 1
    [KIND.return, 1, 0, 4, 0, 1, 0], // 7  returns 2
    [KIND.end, 0, 0, 0, 2, 0, -1], // 8  "2\n" printed
  ],
};

describe('debugger stepping (every control is a jump to a precomputed step)', () => {
  const t = new Trace(fact);

  it('Step into goes to the very next step, Step back to the previous one, both clamped', () => {
    expect(t.stepInto(3)).toBe(4);
    expect(t.stepInto(8)).toBe(8);
    expect(t.stepBack(4)).toBe(3);
    expect(t.stepBack(0)).toBe(0);
  });

  it('Step over runs the call made on this line without stopping inside it', () => {
    expect(t.depth(3)).toBe(2);
    expect(t.stepOver(3)).toBe(7);
    expect(t.stepOver(0)).toBe(8);
  });

  it('Step out runs to the first step back in a caller', () => {
    expect(t.stepOut(5)).toBe(7);
    expect(t.stepOut(2)).toBe(8);
  });

  it('Continue stops on breakpoint lines (line and call steps of the learner code), else at the end', () => {
    const bps = new Set([3]);
    expect(t.continueTo(0, bps)).toBe(2);
    expect(t.continueTo(2, bps)).toBe(5);
    expect(t.continueTo(5, bps)).toBe(8);
    expect(t.continueTo(0, new Set())).toBe(8);
    // harness lines never match a breakpoint in the learner's code
    const inHarness = new Trace({ ...fact, steps: fact.steps.map((s) => [s[0], s[1], 1, s[3], s[4], s[5], s[6]] as typeof s) });
    expect(inHarness.continueTo(0, bps)).toBe(8);
  });

  it('the call stack lists the current frame first and the line each caller is on', () => {
    expect(t.stack(5).map((f) => `${f.name}@${f.line}`)).toEqual(['Fact@3', 'Fact@4', 'top-level statements@6']);
    expect(t.stack(0).map((f) => f.name)).toEqual(['top-level statements']);
  });

  it("a caller's variables are those of its last step", () => {
    expect(t.variables(5).map((v) => `${v.name}=${show(v.value)}`)).toEqual(['n=1']);
    expect(t.variables(5, 1).map((v) => `${v.name}=${show(v.value)}`)).toEqual(['n=2']);
    expect(t.variables(0, 1)).toEqual([]);
  });

  it('marks variables whose value changed since the same frame’s previous step (never on a call)', () => {
    expect([...t.changed(1)]).toEqual([]);
    expect([...t.changed(3)]).toEqual([]);
    const loop = new Trace({
      ...fact,
      names: [['i', 'int']],
      vars: [[], [0, 0], [0, 1]],
      steps: [
        [KIND.line, 0, 0, 1, 0, 0, -1],
        [KIND.line, 0, 0, 2, 0, 1, -1],
        [KIND.line, 0, 0, 2, 0, 2, -1],
      ],
    });
    expect([...loop.changed(1)]).toEqual(['i']); // new variables count as changed
    expect([...loop.changed(2)]).toEqual(['i']);
  });

  it('return values and the console output so far come with each step', () => {
    expect(show(t.value(t.step(6).value)!)).toBe('1');
    expect(show(t.value(t.step(7).value)!)).toBe('2');
    expect(t.value(-1)).toBeNull();
    expect(t.step(8).out).toBe(2);
  });
});

describe('debugger values', () => {
  it('shows snapshots as one line of C#-like text', () => {
    expect(show({ k: 'null' })).toBe('null');
    expect(show({ k: 's', n: 3, v: 'a"b' })).toBe('"a\\"b"');
    expect(show({ k: 's', n: 500, v: 'abc' })).toBe('"abc…"');
    expect(show({ k: 'seq', t: 'int[]', n: 5, items: [int(1), int(2)] })).toBe('[1, 2, … 3 more]');
    expect(show({ k: 'grid', t: 'int[,]', r: 2, c: 2, items: [[int(1), int(2)], [int(3), int(4)]] })).toBe('[[1, 2], [3, 4]]');
    expect(show({ k: 'map', t: 'Dictionary<string, int>', n: 1, items: [[{ k: 's', n: 1, v: 'a' }, int(1)]] })).toBe('{"a": 1}');
    expect(show({ k: 'tup', t: '(int, int)', items: [int(1), int(2)] })).toBe('(1, 2)');
    expect(show({ k: 'obj', t: 'Point', f: [['X', int(1)], ['Y', int(2)]] })).toBe('Point { X = 1, Y = 2 }');
    expect(show({ k: 'ref', t: 'Node', id: 4 })).toBe('Node #4');
    expect(show({ k: 'exc', t: 'System.Exception', m: 'boom' })).toBe('System.Exception: boom');
    expect(show({ k: 'o', t: 'IEnumerable<int>', note: 'not run yet' })).toBe('IEnumerable<int> (not run yet)');
  });

  it('reads integers for pointers, and nothing else', () => {
    expect(asNumber(int(3))).toBe(3);
    expect(asNumber({ k: 'v', t: 'double', v: '0.5' })).toBeNull();
    expect(asNumber({ k: 's', n: 1, v: '3' })).toBeNull();
  });

  const v = (name: string, value: Value, id = 0) => ({ name, type: 'int', value, id });
  const arr = (...xs: number[]): Value => ({ k: 'seq', t: 'int[]', n: xs.length, items: xs.map(int) });

  it('draws arrays with the int variables the code indexes them with as pointers', () => {
    const vars = [v('arr', arr(2, 5, 5, 3)), v('i', int(2)), v('j', int(-1)), v('key', int(3))];
    const prev = [v('arr', arr(2, 5, 7, 3))];
    const [a] = arrayViews(vars, prev, { name: 'InsertionSort', file: 0, line: 1, endLine: 14, entry: false, hints: { arr: ['i', 'j'] } });
    expect(a!.cells).toEqual(['2', '5', '5', '3']);
    expect(a!.pointers).toEqual([
      { name: 'i', index: 2 },
      { name: 'j', index: -1 },
    ]);
    expect([...a!.changed]).toEqual([2]);
  });

  it('falls back to index-like names for the first array, and reads the fields of this', () => {
    const self: Value = { k: 'obj', t: 'Stack', f: [['items', arr(1, 2, 0, 0)], ['top', int(1)]] };
    const [a] = arrayViews([v('this', self), v('lo', int(0))], [], null);
    expect(a!.name).toBe('items');
    expect(a!.pointers.map((p) => p.name).sort()).toEqual(['lo', 'top']);
  });

  it('skips collections of objects and pointers far outside the array', () => {
    const people: Value = { k: 'seq', t: 'List<Person>', n: 1, items: [{ k: 'obj', t: 'Person', f: [] }] };
    expect(arrayViews([v('people', people)], [], null)).toEqual([]);
    const [a] = arrayViews([v('xs', arr(1, 2)), v('i', int(9))], [], null);
    expect(a!.pointers).toEqual([]);
  });
});
