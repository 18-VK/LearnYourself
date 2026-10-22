import { describe, expect, it } from 'vitest';
import { loadNote } from '../../../scripts/lib/notes';
import { CHAIN_CODE, CHAIN_PIECES, LQ_PARTS, lqPart, lqPartsFor, type LqState } from '../../../src/viz/csharp/traces/linq-pipeline';
import { SNIPPETS } from '../../../src/viz/csharp/snippets';
import type { Trace } from '../../../src/viz/engine/types';
import { expectWellFormed, lineTexts } from './helpers';

/** The ```text block that follows a code block in the note (its printed output). */
function noteOutputAfter(code: string): string[] {
  const note = loadNote(SNIPPETS.dviDeferred.file);
  const i = note.fences.findIndex((f) => note.lines.slice(f.start + 1, f.end).join('\n').includes(code));
  const out = note.fences.slice(i + 1).find((f) => f.lang === 'text')!;
  return note.lines.slice(out.start + 1, out.end);
}

/** W<n> when Where tests n, S<n> when Select gets n, F<n> when foreach receives n: the pull order. */
function pullOrder(trace: Trace<LqState>): string[] {
  const out: string[] = [];
  for (const s of trace) {
    const st = s.state.stages.find((x) => x.id === s.state.active);
    if (!st || st.value === null) continue;
    out.push(`${st.id === 'where' ? 'W' : st.id === 'select' ? 'S' : st.id === 'foreach' ? 'F' : 'L'}${st.value}`);
  }
  return out;
}

describe('LINQ pipeline parts', () => {
  it('offers ToList() only when the placement asks to compare', () => {
    expect(lqPartsFor(true)).toEqual(['deferred', 'immediate', 'chain']);
    expect(lqPartsFor(false)).toEqual(['deferred', 'chain']);
  });
  for (const { id } of LQ_PARTS) {
    it(`${id} is well formed`, () => {
      const p = lqPart(id);
      expectWellFormed(p.trace, p.doc);
    });
  }
});

describe('deferred execution (the note’s first example)', () => {
  const p = lqPart('deferred');
  it('prints exactly the note’s output', () => {
    expect(p.trace.at(-1)!.state.output).toEqual(noteOutputAfter(SNIPPETS.dviDeferred.code));
  });
  it('runs no predicate until foreach starts, then reads each element exactly once, in order', () => {
    const where = (s: LqState) => s.stages.find((x) => x.id === 'where')!.calls;
    const firstForeach = p.trace.findIndex((s) => p.doc.parts[0]!.code.split('\n')[s.codeLine - 1]!.includes('foreach'));
    expect(p.trace.slice(0, firstForeach).every((s) => where(s.state) === 0 && !s.state.executed)).toBe(true);
    expect(pullOrder(p.trace)).toEqual(['W1', 'W2', 'W3', 'F3', 'W4', 'F4', 'W5', 'F5']);
    expect(where(p.trace.at(-1)!.state)).toBe(5);
  });
  it('follows the C# line by line', () => {
    expect(lineTexts(p.trace, p.doc)).toEqual([
      'var numbers = new List<int> { 1, 2, 3, 4 };',
      'var query = numbers.Where(n => n > 2);',
      'numbers.Add(5);',
      'foreach (var n in query)',
      'Console.WriteLine(n);',
      'foreach (var n in query)',
      'Console.WriteLine(n);',
      'foreach (var n in query)',
      'Console.WriteLine(n);',
      'foreach (var n in query)',
    ]);
  });
});

describe('immediate execution (the note’s ToList() example)', () => {
  const p = lqPart('immediate');
  const last = p.trace.at(-1)!.state;
  it('prints exactly the note’s output', () => {
    expect(last.output).toEqual(noteOutputAfter(SNIPPETS.dviImmediate.code));
  });
  it('ToList() reads all four elements before numbers.Add(5); 5 never reaches result', () => {
    expect(last.result).toEqual([3, 4]);
    expect(last.source).toEqual([1, 2, 3, 4, 5]);
    expect(last.stages.find((x) => x.id === 'where')!.calls).toBe(4);
    const addStep = p.trace.findIndex((s) => s.state.source.length === 5);
    expect(p.trace[addStep - 1]!.state.result).toEqual([3, 4]);
  });
});

describe('Where → Select chain (composed from two note examples)', () => {
  const p = lqPart('chain');
  it('streams one element through the whole chain before reading the next', () => {
    // the order observed by running the same chain with logging lambdas on .NET
    expect(pullOrder(p.trace)).toEqual(['W1', 'W2', 'W3', 'S3', 'F9', 'W4', 'S4', 'F16', 'W5', 'S5', 'F25']);
    expect(p.trace.at(-1)!.state.output).toEqual(['9', '16', '25']);
  });
  it('is labelled as not a block from the notes and reuses the notes’ own pieces', () => {
    expect(p.doc.parts[0]!.key).toBeNull();
    for (const { from, piece } of CHAIN_PIECES) {
      expect(from).toContain(piece);
      expect(CHAIN_CODE).toContain(piece);
    }
  });
});
