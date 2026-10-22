import { expect } from 'vitest';
import type { Trace } from '../../../src/viz/engine/types';
import { docLength, textAt, type CodeDoc } from '../../../src/viz/csharp/shared/step';

/** Invariants every C# visualizer trace satisfies. */
export function expectWellFormed<S>(trace: Trace<S>, doc: CodeDoc): void {
  expect(trace.length).toBeGreaterThan(1);
  const n = docLength(doc);
  for (const step of trace) {
    expect(step.codeLine).toBeGreaterThanOrEqual(1);
    expect(step.codeLine).toBeLessThanOrEqual(n);
    expect(step.narration.trim().length).toBeGreaterThan(0);
    if (step.predict) {
      expect(step.predict.options.length).toBeGreaterThan(1);
      expect(step.predict.answer).toBeGreaterThanOrEqual(0);
      expect(step.predict.answer).toBeLessThan(step.predict.options.length);
      expect(new Set(step.predict.options).size).toBe(step.predict.options.length);
    }
  }
  expect(trace[trace.length - 1]!.action).toBe('done');
}

/** The source text of each highlighted line, trimmed, in step order with consecutive repeats collapsed. */
export function lineTexts<S>(trace: Trace<S>, doc: CodeDoc): string[] {
  const out: string[] = [];
  for (const s of trace) {
    const t = textAt(doc, s.codeLine).trim();
    if (out[out.length - 1] !== t) out.push(t);
  }
  return out;
}

/**
 * For code whose Console.WriteLine lines end in `// <expected output>` (as the notes write them), the output
 * a step adds while highlighting that line must equal the comment.
 */
export function expectOutputsMatchComments<S extends { output: string[] }>(trace: Trace<S>, doc: CodeDoc): number {
  let checked = 0;
  for (let i = 1; i < trace.length; i++) {
    const prev = trace[i - 1]!.state.output;
    const cur = trace[i]!.state.output;
    if (cur.length === prev.length) continue;
    const m = /Console\.WriteLine\(.*\);\s*\/\/\s*(.+)$/.exec(textAt(doc, trace[i]!.codeLine));
    if (!m) continue;
    expect(cur.slice(prev.length).join(' ')).toBe(m[1]!.trim());
    checked++;
  }
  return checked;
}
