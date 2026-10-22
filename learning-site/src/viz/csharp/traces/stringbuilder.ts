import type { Prediction, Trace } from '../../engine/types';
import { docOf, linesIn, Recorder, type CodeDoc } from '../shared/step';

/*
 * String immutability vs StringBuilder's growing buffer, from 8.C#_String/Note.md (Insert and Replace
 * return new strings) and 8.C#_String/StringBuilder.md › Full Example Demonstrating All.
 *
 * Length and Capacity after each StringBuilder call were measured by running the note's Full Example on
 * .NET 7 on Windows, where AppendLine adds "\r\n" (two characters); on Linux and macOS it adds "\n", so the
 * numbers differ slightly. The UI says so. The docs describe capacity doubling when it runs out (default
 * capacity 16); measured, Append does double (16 → 32 → 64) while this example's Insert and Replace grew it
 * by just the room they needed. The buffer is a chain of chunks inside one StringBuilder object:
 *   https://learn.microsoft.com/en-us/dotnet/fundamentals/runtime-libraries/system-text-stringbuilder
 *   https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Text/StringBuilder.cs
 * Strings are immutable; methods that appear to modify one return a new string:
 *   https://learn.microsoft.com/en-us/dotnet/fundamentals/runtime-libraries/system-string
 */

export interface SbString {
  id: string;
  value: string;
  /** Some variable refers to it. */
  referenced: boolean;
}

export interface SbState {
  /** string objects created so far (string part). */
  strings: SbString[];
  vars: { name: string; ref: string }[];
  /** StringBuilder contents (escaped for display), Length and Capacity. */
  sb: { text: string; length: number; capacity: number; growths: number[] } | null;
  output: string[];
  changed: string | null;
  /** Capacity grew in this step. */
  grew: boolean;
}

export interface SbPart {
  id: 'string' | 'builder';
  label: string;
  doc: CodeDoc;
  trace: Trace<SbState>;
}

const show = (s: string) => s.replace(/\r/g, '\\r').replace(/\n/g, '\\n');

function strings(): SbPart {
  const doc = docOf('strInsert', 'strReplace');
  const I = linesIn(doc, 0, { str: 'string str = "Hello";', ins: 'string result = str.Insert(5, " World");', print: 'Console.WriteLine(result);' });
  const R = linesIn(doc, 1, { str: 'string str = "Hello World";', rep: 'Console.WriteLine(str.Replace("World", "C#"));' });
  const r = new Recorder<SbState>();
  const s: SbState = { strings: [], vars: [], sb: null, output: [], changed: null, grew: false };
  const push = (line: number, narration: string, predict?: Prediction, action: 'start' | 'write' | 'read' | 'done' = 'write') => {
    for (const x of s.strings) x.referenced = s.vars.some((v) => v.ref === x.id);
    r.push(s, { action, line, narration, predict, vars: { 'string objects': s.strings.length } });
    s.changed = null;
  };
  s.strings.push({ id: '#1', value: 'Hello', referenced: true });
  s.vars.push({ name: 'str', ref: '#1' });
  s.changed = '#1';
  push(I.str, 'str refers to a string object "Hello".', undefined, 'start');
  s.strings.push({ id: '#2', value: 'Hello World', referenced: true });
  s.vars.push({ name: 'result', ref: '#2' });
  s.changed = '#2';
  push(I.ins, 'Insert does not change "Hello": strings are immutable. It builds a new string "Hello World" and returns it; str still refers to "Hello".', {
    question: 'After str.Insert(5, " World"), what does str hold?',
    options: ['"Hello"', '"Hello World"'],
    answer: 0,
  });
  s.output.push('Hello World');
  push(I.print, 'Prints the new string: Hello World.', undefined, 'read');
  s.vars = [{ name: 'str', ref: '#3' }];
  s.strings.push({ id: '#3', value: 'Hello World', referenced: true });
  s.changed = '#3';
  push(R.str, 'The Replace example starts with its own str, "Hello World".');
  s.strings.push({ id: '#4', value: 'Hello C#', referenced: false });
  s.changed = '#4';
  s.output.push('Hello C#');
  push(R.rep, 'Replace also returns a new string, "Hello C#", which is printed. str is unchanged. "Any operation that modifies a string creates a new string."');
  push(R.rep, `Done: ${s.strings.length} string objects for two small edits. In a loop, each concatenation allocates another one; that is what StringBuilder avoids.`, undefined, 'done');
  return { id: 'string', label: 'string: a new object each time', doc, trace: r.steps };
}

/** Measured on .NET 7 / Windows for the note's Full Example (see the header comment). */
export const SB_MEASURED = [
  { op: 'new StringBuilder("Hello")', text: 'Hello', length: 5, capacity: 16 },
  { op: 'Append(" World")', text: 'Hello World', length: 11, capacity: 16 },
  { op: 'AppendLine("!")', text: 'Hello World!\r\n', length: 14, capacity: 16 },
  { op: 'Insert(6, "C# ")', text: 'Hello C# World!\r\n', length: 17, capacity: 19 },
  { op: 'Replace("World", "Universe")', text: 'Hello C# Universe!\r\n', length: 20, capacity: 22 },
  { op: 'Remove(6, 3)', text: 'Hello Universe!\r\n', length: 17, capacity: 22 },
] as const;

function builder(): SbPart {
  const doc = docOf('sbFull');
  const L = linesIn(doc, 0, {
    make: 'StringBuilder sb = new StringBuilder("Hello");',
    append: 'sb.Append(" World");',
    line: 'sb.AppendLine("!");',
    insert: 'sb.Insert(6, "C# ");',
    replace: 'sb.Replace("World", "Universe");',
    print1: ['Console.WriteLine(sb);', 1],
    remove: 'sb.Remove(6, 3);',
    print2: ['Console.WriteLine(sb);', 2],
    stats: 'Console.WriteLine($"Length: {sb.Length}, Capacity: {sb.Capacity}");',
  });
  const r = new Recorder<SbState>();
  const s: SbState = { strings: [], vars: [], sb: null, output: [], changed: null, grew: false };
  const push = (line: number, narration: string, predict?: Prediction, action: 'start' | 'write' | 'read' | 'done' = 'write') => {
    r.push(s, { action, line, narration, predict, vars: s.sb ? { Length: s.sb.length, Capacity: s.sb.capacity } : {} });
    s.grew = false;
  };
  const apply = (k: number, line: number, narration: (grew: boolean, by: number) => string, predict?: Prediction) => {
    const m = SB_MEASURED[k]!;
    const prev = s.sb;
    const by = prev ? m.capacity - prev.capacity : 0;
    s.sb = { text: show(m.text), length: m.length, capacity: m.capacity, growths: prev ? (by > 0 ? [...prev.growths, by] : prev.growths) : [m.capacity] };
    s.grew = by > 0;
    push(line, narration(by > 0, by), predict, k === 0 ? 'start' : 'write');
  };
  apply(0, L.make, () => 'One StringBuilder object with a character buffer: "Hello" uses 5 of its 16 slots (Capacity 16).');
  apply(1, L.append, () => 'Append writes " World" into the same buffer. Length 11, still within Capacity 16: no new object, no copy.', {
    question: 'Append(" World") makes Length 11. Does the StringBuilder need more room?',
    options: ['No, 11 fits in 16', 'Yes, it must grow'],
    answer: 0,
  });
  apply(2, L.line, () => 'AppendLine adds "!" and a line break (\\r\\n on Windows): Length 14, Capacity still 16.');
  apply(3, L.insert, (g, by) => `Insert puts "C# " at index 6. Length 17 no longer fits in 16, so the StringBuilder ${g ? `adds room for ${by} more characters (Capacity 19)` : 'grows'}. It is still the same object.`, {
    question: 'Length becomes 17 but Capacity is 16. What happens?',
    options: ['A new StringBuilder object is created', 'The same object gets more room'],
    answer: 1,
  });
  apply(4, L.replace, (g, by) => `Replace swaps "World" for "Universe" inside the same StringBuilder: Length 20, so ${g ? `Capacity grows by ${by} to 22` : 'no growth'}.`);
  s.output.push('Hello C# Universe!', '');
  push(L.print1, 'Console.WriteLine(sb) prints "Hello C# Universe!", then the line break from AppendLine shows up as an empty line.', undefined, 'read');
  apply(5, L.remove, () => 'Remove(6, 3) deletes "C# ": Length 17. Capacity stays 22; removing never shrinks the buffer.');
  s.output.push('Hello Universe!', '');
  push(L.print2, 'Prints "Hello Universe!" (and the empty line again).', undefined, 'read');
  s.output.push(`Length: ${s.sb!.length}, Capacity: ${s.sb!.capacity}`);
  push(L.stats, `Length ${s.sb!.length}, Capacity ${s.sb!.capacity} (measured on .NET 7, Windows).`, {
    question: 'What does Capacity report now?',
    options: ['17', '22'],
    answer: 1,
  }, 'read');
  push(L.stats, 'Done: one StringBuilder for all five edits. Its buffer grew twice; the string version would have made a new string for every edit.', undefined, 'done');
  return { id: 'builder', label: 'StringBuilder: one growing buffer', doc, trace: r.steps };
}

export function sbPart(id: 'string' | 'builder'): SbPart {
  return id === 'string' ? strings() : builder();
}
