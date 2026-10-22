import { describe, expect, it } from 'vitest';
import { CS_PARTS, csPart, CUSTOM_MESSAGE, INDEX_MESSAGE } from '../../../src/viz/csharp/traces/callstack';
import { expectWellFormed, lineTexts } from './helpers';

describe('exceptions on the call stack (12.C#_ExceptionHandling/Note.md)', () => {
  for (const { id } of CS_PARTS) {
    it(`${id}: well formed; the stack only grows by calls and shrinks by returns or unwinding`, () => {
      const p = csPart(id);
      expectWellFormed(p.trace, p.doc);
      for (let i = 1; i < p.trace.length; i++) expect(Math.abs(p.trace[i]!.state.frames.length - p.trace[i - 1]!.state.frames.length)).toBeLessThanOrEqual(1);
      expect(p.trace.at(-1)!.state.frames).toEqual([]);
      expect(p.trace.at(-1)!.state.exception).toBeNull();
    });
  }
  it('BasicExample: the first matching catch runs, the second is skipped, finally runs last', () => {
    const p = csPart('basic');
    expect(p.trace.at(-1)!.state.output).toEqual(['Before exception', 'Caught FormatException: …', 'Finally block: cleanup here']);
    expect(p.trace.at(-1)!.state.skipped.length).toBe(2);
  });
  it('Re-throwing: caught in ProcessData, re-thrown with throw;, caught again in Main', () => {
    const p = csPart('rethrow');
    expect(p.trace.at(-1)!.state.output).toEqual([`Exception caught in ProcessData: ${INDEX_MESSAGE}`, `Exception caught in Main: ${INDEX_MESSAGE}`]);
    // the stack trace recorded at the throw is kept through the rethrow
    const traces = p.trace.filter((s) => s.state.exception).map((s) => s.state.exception!.trace.join(' < '));
    expect(new Set(traces)).toEqual(new Set(['ProcessData < Main']));
    expect(lineTexts(p.trace, p.doc)).toEqual([
      'static void Main()',
      'ProcessData();',
      'int[] numbers = { 1, 2, 3 };',
      'Console.WriteLine(numbers[5]); // This will throw IndexOutOfRangeException',
      'catch (Exception ex)',
      'Console.WriteLine("Exception caught in ProcessData: " + ex.Message);',
      'throw; // Re-throws the same exception',
      'ProcessData();',
      'catch (Exception ex)',
      'Console.WriteLine("Exception caught in Main: " + ex.Message);',
      '}',
    ]);
  });
  it('custom exception: Withdraw is unwound before balance changes; the specific catch wins', () => {
    const p = csPart('custom');
    expect(p.trace.at(-1)!.state.output).toEqual([`Custom Exception Caught: ${CUSTOM_MESSAGE}`]);
    const thrown = p.trace.find((s) => s.state.exception?.at === 'Withdraw')!;
    expect(thrown.state.frames.map((f) => f.method)).toEqual(['Main', 'Withdraw']);
  });
});
