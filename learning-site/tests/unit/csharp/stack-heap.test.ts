import { describe, expect, it } from 'vitest';
import { SNIPPETS } from '../../../src/viz/csharp/snippets';
import { SH_PART_IDS, SH_PART_SNIPPET, SH_SCENARIOS, shPart, toShScenario, type ShState } from '../../../src/viz/csharp/traces/stack-heap';
import { expectOutputsMatchComments, expectWellFormed, lineTexts } from './helpers';

const final = (id: string): ShState => shPart(id).trace.at(-1)!.state;
const varOf = (s: ShState, name: string) => s.vars.find((x) => x.name === name)!;
const field = (fields: { name: string; value: string }[] | undefined, name: string) => fields?.find((f) => f.name === name)?.value;

describe('stack/heap parts', () => {
  it('every scenario lists known parts, and every part belongs to a scenario', () => {
    const listed = Object.values(SH_SCENARIOS).flatMap((s) => s.parts);
    expect([...listed].sort()).toEqual([...SH_PART_IDS].sort());
    expect(toShScenario('boxing')).toBe('boxing');
    expect(toShScenario('nonsense')).toBe('value-vs-reference');
  });

  describe.each(SH_PART_IDS)('%s', (id) => {
    const part = shPart(id);
    it('shows exactly its note snippet', () => {
      expect(part.doc.parts.map((p) => p.code)).toEqual([SNIPPETS[SH_PART_SNIPPET[id]!].code]);
    });
    it('is well formed', () => expectWellFormed(part.trace, part.doc));
    it('keeps every reference pointing at an existing heap object, and value types reference-free', () => {
      for (const step of part.trace) {
        const ids = new Set(step.state.heap.map((h) => h.id));
        expect(ids.size).toBe(step.state.heap.length);
        for (const x of step.state.vars) {
          if (x.kind === 'ref') {
            if (x.ref) expect(ids.has(x.ref)).toBe(true);
          } else {
            expect(x.ref).toBeUndefined();
            expect(x.value !== undefined || x.fields !== undefined).toBe(true);
          }
        }
        // an object is an orphan exactly when no variable refers to it
        for (const h of step.state.heap) expect(Boolean(h.orphan)).toBe(!step.state.vars.some((x) => x.ref === h.id));
        // marks only name things that exist
        for (const m of [...(step.state.marks.write ?? []), ...(step.state.marks.read ?? [])]) {
          const [kind, rest] = [m.slice(0, 2), m.slice(2)];
          const [name, f] = rest.split('.');
          if (kind === 'v:') {
            const x = step.state.vars.find((q) => q.name === name);
            expect(x, m).toBeDefined();
            if (f) expect(field(x!.fields, f), m).toBeDefined();
          } else {
            const h = step.state.heap.find((q) => q.id === name);
            expect(h, m).toBeDefined();
            if (f) expect(field(h!.fields, f), m).toBeDefined();
          }
        }
      }
    });
    it("prints what the note's comments say", () => {
      expectOutputsMatchComments(part.trace, part.doc);
    });
  });
});

describe('struct vs class (Struct_vs_Class.md)', () => {
  it('struct assignment copies the value: changing second leaves first alone', () => {
    const s = final('svc-struct');
    expect(field(varOf(s, 'first').fields, 'X')).toBe('10');
    expect(field(varOf(s, 'second').fields, 'X')).toBe('100');
    expect(s.heap).toHaveLength(0);
    expect(s.output).toEqual(['10', '100']);
  });
  it('class assignment copies the reference: both variables see the change', () => {
    const s = final('svc-class');
    expect(varOf(s, 'first').ref).toBe(varOf(s, 'second').ref);
    expect(s.heap).toHaveLength(1);
    expect(field(s.heap[0]!.fields, 'Name')).toBe('"Rahul"');
    expect(s.output).toEqual(['Rahul', 'Rahul']);
  });
  it('the quick example prints 1 then Rahul', () => {
    expect(final('svc-quick').output).toEqual(['1', 'Rahul']);
  });
  it('asks before revealing the mutation, and the answer matches the next state', () => {
    for (const id of ['svc-struct', 'svc-class', 'svc-quick']) {
      const t = shPart(id).trace;
      const asks = t.filter((s) => s.predict && /Does .* change/.test(s.predict.question));
      expect(asks.length).toBeGreaterThan(0);
      for (const a of asks) {
        const name = /Does (\w+)\./.exec(a.predict!.question)![1]!;
        const before = t[t.indexOf(a) - 1]!.state;
        const read = (s: ShState) => {
          const x = varOf(s, name);
          const fields = x.ref ? s.heap.find((h) => h.id === x.ref)!.fields : x.fields;
          return JSON.stringify(fields);
        };
        const changed = read(before) !== read(a.state);
        expect(a.predict!.answer).toBe(changed ? 0 : 1);
      }
    }
  });
  it('follows the C# line by line', () => {
    const p = shPart('svc-struct');
    expect(lineTexts(p.trace, p.doc)).toEqual([
      'public struct Point',
      'Point first = new Point { X = 10, Y = 20 };',
      'Point second = first;',
      'second.X = 100;',
      'Console.WriteLine(first.X);  // 10',
      'Console.WriteLine(second.X); // 100',
    ]);
  });
});

describe('value vs reference (C#_Fundamentals.md)', () => {
  it('a struct local holds its fields inline and allocates nothing', () => {
    const t = shPart('fund-struct').trace;
    expect(t.every((s) => s.state.heap.length === 0)).toBe(true);
    expect(varOf(t.at(-1)!.state, 'p').fields).toEqual([
      { name: 'X', value: '10' },
      { name: 'Y', value: '20' },
    ]);
    // declared but not yet assigned
    expect(t.some((s) => s.state.vars[0]?.fields?.every((f) => f.value === '?'))).toBe(true);
  });
  it('new Person() puts the object on the heap with default field values', () => {
    const s = final('fund-class');
    expect(s.heap[0]!.fields).toEqual([
      { name: 'Name', value: 'null' },
      { name: 'Age', value: '0' },
    ]);
    expect(varOf(s, 'p').ref).toBe(s.heap[0]!.id);
  });
  it('reassigning a string creates a new object and leaves "Aman" unchanged and unreferenced', () => {
    const s = final('fund-string');
    expect(s.heap.map((h) => h.value)).toEqual(['"Aman"', '"Rahul"']);
    expect(s.heap[0]!.orphan).toBe(true);
    expect(varOf(s, 'name').ref).toBe(s.heap[1]!.id);
  });
});

describe('boxing and unboxing', () => {
  it('boxing copies the value into a new heap object; the variable is untouched', () => {
    for (const [id, name] of [
      ['oop-box', 'num'],
      ['svc-boxing', 'number'],
    ] as const) {
      const s = final(id);
      const box = s.heap.find((h) => h.kind === 'box')!;
      expect(box.value).toBe(varOf(s, name).value);
      expect(s.vars.find((x) => x.kind === 'ref')!.ref).toBe(box.id);
    }
  });
  it('unboxing copies the boxed value back out', () => {
    expect(varOf(final('oop-unbox'), 'num').value).toBe('20');
    expect(varOf(final('svc-boxing'), 'copy').value).toBe('10');
    const s = final('oop-struct-box');
    expect(varOf(s, 'p2').fields).toEqual(varOf(s, 'p').fields);
    expect(s.copies).toBe(2);
  });
});
