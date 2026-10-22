import { describe, expect, it } from 'vitest';
import { SB_MEASURED, sbPart } from '../../../src/viz/csharp/traces/stringbuilder';
import { tpPart } from '../../../src/viz/csharp/traces/threadpool';
import { expectWellFormed, lineTexts } from './helpers';

describe('string immutability (8.C#_String/Note.md)', () => {
  const p = sbPart('string');
  it('is well formed and every edit makes a new string object', () => {
    expectWellFormed(p.trace, p.doc);
    const last = p.trace.at(-1)!.state;
    expect(last.strings.map((x) => x.value)).toEqual(['Hello', 'Hello World', 'Hello World', 'Hello C#']);
    expect(last.output).toEqual(['Hello World', 'Hello C#']);
  });
  it('Insert leaves str as "Hello"', () => {
    const after = p.trace.find((s) => s.state.vars.some((v) => v.name === 'result'))!.state;
    const str = after.vars.find((v) => v.name === 'str')!;
    expect(after.strings.find((x) => x.id === str.ref)!.value).toBe('Hello');
  });
});

describe('StringBuilder (StringBuilder.md › Full Example)', () => {
  const p = sbPart('builder');
  const last = p.trace.at(-1)!.state;
  it('is well formed', () => expectWellFormed(p.trace, p.doc));
  it('prints what the note’s comments say, plus the measured Length/Capacity line', () => {
    const printed = last.output.filter((l) => l !== '');
    expect(printed).toEqual(['Hello C# Universe!', 'Hello Universe!', 'Length: 17, Capacity: 22']);
    expect(p.doc.parts[0]!.code).toContain('// Output: Hello C# Universe!');
    expect(p.doc.parts[0]!.code).toContain('// Output: Hello Universe!');
  });
  it('Length is the text length and never exceeds Capacity; Capacity never shrinks', () => {
    let cap = 0;
    for (const s of p.trace) {
      if (!s.state.sb) continue;
      expect(s.state.sb.length).toBeLessThanOrEqual(s.state.sb.capacity);
      expect(s.state.sb.capacity).toBeGreaterThanOrEqual(cap);
      cap = s.state.sb.capacity;
    }
    for (const m of SB_MEASURED) expect(m.text.length).toBe(m.length);
  });
  it('the buffer grows exactly where the measurement says (Insert, Replace)', () => {
    expect(last.sb!.growths).toEqual([16, 3, 3]);
    expect(lineTexts(p.trace, p.doc).filter((t) => t.startsWith('sb.'))).toEqual(['sb.Append(" World");', 'sb.AppendLine("!");', 'sb.Insert(6, "C# ");', 'sb.Replace("World", "Universe");', 'sb.Remove(6, 3);']);
  });
});

describe('thread pool work queue (ThreadpoolAndTask.md › 2) Example with main thread activity)', () => {
  const p = tpPart();
  const last = p.trace.at(-1)!.state;
  it('is well formed and time only moves forward', () => {
    expectWellFormed(p.trace, p.doc);
    for (let i = 1; i < p.trace.length; i++) expect(p.trace[i]!.state.now).toBeGreaterThanOrEqual(p.trace[i - 1]!.state.now);
  });
  it('prints every line the code prints, Main and Worker interleaved by time', () => {
    expect(last.output).toEqual([
      '[Main]   ID: M',
      '[Main]   Doing other work...',
      '[Worker] Started on ID: W, State: Task 1',
      '[Main]   Step 1',
      '[Worker] Processing 1',
      '[Main]   Step 2',
      '[Worker] Processing 2',
      '[Main]   Step 3',
      '[Worker] Processing 3',
      '[Main]   Step 4',
      '[Main]   Step 5',
      '[Worker] Done',
      '[Main]   Finished',
    ]);
  });
  it('uses the code’s own sleeps: Main blocked 5 × 500 + 3000 ms, worker blocked 3 × 700 ms', () => {
    const blocked = (lane: string) => last.segs.filter((x) => x.lane === lane && x.kind === 'blocked').reduce((n, x) => n + ((x.to ?? last.now) - x.from), 0);
    expect(blocked('main')).toBe(5500);
    expect(blocked('pool')).toBe(2100);
  });
});
