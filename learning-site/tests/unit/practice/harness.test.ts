import { describe, expect, it } from 'vitest';
import { buildExercise, csharpLiteral, showValue, signatures, starterFrom } from '../../../scripts/practice/harness';
import type { PracticeExercise } from '../../../scripts/practice/schema';

const BUBBLE = `void BubbleSort(int[] arr)
{
    int n = arr.Length;
    for (int i = 0; i < n - 1; i++)
        for (int j = 0; j < n - i - 1; j++)
            if (arr[j] > arr[j + 1])
                (arr[j], arr[j + 1]) = (arr[j + 1], arr[j]);
}`;

const SEARCH = `// returns the index, or -1
int LinearSearch(int[] arr, int target)
{
    for (int i = 0; i < arr.Length; i++) if (arr[i] == target) return i;
    return -1;
}

class Employee
{
    public string Name { get; set; }
    public int Age { get; set; }
}

int Count(Dictionary<int, List<int>> graph, int start) => graph[start].Count;`;

describe('practice harness: signatures and starter code', () => {
  it('reads top-level method signatures, not type members', () => {
    expect(signatures(BUBBLE)).toEqual([{ name: 'BubbleSort', returnType: 'void', params: [{ type: 'int[]', name: 'arr' }] }]);
    const s = signatures(SEARCH);
    expect(s.map((x) => x.name)).toEqual(['LinearSearch', 'Count']);
    expect(s[1]!.params).toEqual([
      { type: 'Dictionary<int, List<int>>', name: 'graph' },
      { type: 'int', name: 'start' },
    ]);
  });

  it('empties method bodies and keeps types, comments and signatures', () => {
    const starter = starterFrom(SEARCH);
    expect(starter).toContain('// returns the index, or -1');
    expect(starter).toContain('int LinearSearch(int[] arr, int target)\n{\n    // TODO: write LinearSearch\n    throw new NotImplementedException();\n}');
    expect(starter).toContain('class Employee\n{\n    public string Name { get; set; }');
    expect(starter).not.toContain('arr[i] == target');
    expect(starterFrom(BUBBLE)).toBe('void BubbleSort(int[] arr)\n{\n    // TODO: write BubbleSort\n}');
  });
});

describe('practice harness: values', () => {
  it('prints values the way the harness does', () => {
    expect(showValue([1, [2, 3]])).toBe('[1, [2, 3]]');
    expect(showValue(true)).toBe('true');
    expect(showValue('Ann')).toBe('Ann');
    expect(showValue({ csharp: 'new Employee()', show: 'Employee' })).toBe('Employee');
  });

  it('writes C# literals for the declared type', () => {
    expect(csharpLiteral([2, 5], 'int[]')).toBe('new int[] { 2, 5 }');
    expect(csharpLiteral([], 'float[]')).toBe('new float[] {  }');
    expect(csharpLiteral(1.5, 'float')).toBe('1.5f');
    expect(csharpLiteral(2, 'double')).toBe('2.0');
    expect(csharpLiteral('a"b', 'string')).toBe('"a\\"b"');
    expect(csharpLiteral(true, 'bool')).toBe('true');
    expect(csharpLiteral(7, 'long')).toBe('7L');
    expect(csharpLiteral({ csharp: 'new[] { "x" }', show: '[x]' }, 'string[]')).toBe('new[] { "x" }');
    expect(() => csharpLiteral(1.5, 'int')).toThrow(/whole number/);
    expect(() => csharpLiteral([1], 'int')).toThrow(/list/);
    expect(() => csharpLiteral(1, 'Employee')).toThrow(/csharp, show/);
  });
});

describe('practice harness: the test program', () => {
  const exercise = (over: Partial<PracticeExercise> = {}): PracticeExercise => ({
    id: 'bubble-sort',
    title: 'Write BubbleSort',
    task: 'Sort arr in place.',
    solution: { block: 1, startsWith: 'void BubbleSort' },
    call: 'BubbleSort(arr)',
    result: 'arr',
    cases: [
      { given: { arr: [2, 5, 7, 3] }, expected: [2, 3, 5, 7], reviewed: true, quote: '[2, 5, 7, 3]' },
      { given: { arr: [] }, expected: [], reviewed: false },
    ],
    ...over,
  });

  it('calls the method once per case between markers and describes each case', () => {
    const built = buildExercise(exercise(), BUBBLE);
    expect(built.signature.name).toBe('BubbleSort');
    expect(built.starter).toContain('// TODO: write BubbleSort');
    expect(built.harness).toContain('__LyCase(1, () => { int[] arr = new int[] { 2, 5, 7, 3 }; BubbleSort(arr); return arr; });');
    expect(built.harness).toContain('__LyCase(2, () => { int[] arr = new int[] {  }; BubbleSort(arr); return arr; });');
    expect(built.harness).toContain('string __LyShow(object v)');
    expect(built.cases).toEqual([
      { input: 'arr = [2, 5, 7, 3]', expected: '[2, 3, 5, 7]', call: 'BubbleSort(arr)' },
      { input: 'arr = []', expected: '[]', call: 'BubbleSort(arr)' },
    ]);
  });

  it('uses the return value when there is no result, and a case may call another method', () => {
    const ex = exercise({
      call: 'LinearSearch(arr, target)',
      result: undefined,
      cases: [
        { given: { arr: [4, 2], target: 2 }, expected: 1, reviewed: false },
        { given: { graph: { csharp: 'new Dictionary<int, List<int>> { [0] = new() { 1 } }', show: '{0: [1]}' }, start: 0 }, expected: 1, reviewed: false, call: 'Count(graph, 0)' },
      ],
    });
    const built = buildExercise(ex, SEARCH);
    expect(built.harness).toContain('__LyCase(1, () => { int[] arr = new int[] { 4, 2 }; int target = 2; return LinearSearch(arr, target); });');
    expect(built.harness).toContain('Dictionary<int, List<int>> graph = new Dictionary<int, List<int>> { [0] = new() { 1 } }; int start = 0; return Count(graph, 0);');
    expect(built.cases[1]!.input).toBe('graph = {0: [1]}, start = 0');
  });

  it('names the problem when the data file does not fit the note', () => {
    expect(() => buildExercise(exercise({ call: 'Nope(arr)' }), BUBBLE)).toThrow(/calls Nope, which the note's block doesn't declare/);
    expect(() => buildExercise(exercise({ result: undefined }), BUBBLE)).toThrow(/returns void/);
    expect(() => buildExercise(exercise({ cases: [{ given: { xs: [1] }, expected: [1], reviewed: false }] }), BUBBLE)).toThrow(/`xs` is not a parameter of BubbleSort/);
    const typed = exercise({ cases: [{ given: { xs: [1], arr: [1] }, expected: [1], reviewed: false }], types: { xs: 'int[]' } });
    expect(buildExercise(typed, BUBBLE).harness).toContain('int[] xs = new int[] { 1 }; int[] arr = new int[] { 1 };');
  });
});
