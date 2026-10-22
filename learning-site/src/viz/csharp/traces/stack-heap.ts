import type { Prediction, Trace } from '../../engine/types';
import { docOf, linesIn, Recorder, type CodeDoc } from '../shared/step';
import type { SnippetKey } from '../snippets';

/*
 * Stack vs heap, value vs reference semantics, boxing and unboxing: each "part" steps through one
 * code block from the notes. The picture is simplified on purpose: locals are drawn in one frame for the
 * code shown, which is how the notes describe it. Struct_vs_Class.md › Memory Behavior says the stack/heap
 * split is an oversimplification; the UI repeats that caveat. Runtime facts used beyond the notes:
 *  - boxing allocates an object on the managed heap and copies the value into it; unboxing checks the type
 *    and copies the value back out:
 *    https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/types/boxing-and-unboxing
 *  - a value-type variable contains the instance; assignment copies it:
 *    https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-types
 *  - fields of a new class instance start at their default values (null, 0):
 *    https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/default-values
 *  - a struct local created without `new` has unassigned fields until each is assigned:
 *    https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct#struct-initialization-and-default-values
 */

export interface ShField {
  name: string;
  /** Display text: `10`, `"Aman"`, `null`, or `?` when unassigned. */
  value: string;
}

export interface ShVar {
  name: string;
  type: string;
  kind: 'value' | 'ref';
  /** Value-type contents: a single value (int) … */
  value?: string;
  /** … or the struct's fields, stored inline in the variable. */
  fields?: ShField[];
  /** Reference types: the heap object this variable refers to (null = no object). */
  ref?: string | null;
}

export interface ShObject {
  id: string;
  type: string;
  kind: 'object' | 'string' | 'box';
  /** Box or string contents. */
  value?: string;
  fields?: ShField[];
  /** True once no variable shown refers to it any more. */
  orphan?: boolean;
}

export interface ShMarks {
  /** Written or created in this step (`is-swap`). */
  write?: string[];
  /** Read in this step (`is-compare`). */
  read?: string[];
}

export interface ShState {
  frame: string;
  vars: ShVar[];
  heap: ShObject[];
  output: string[];
  marks: ShMarks;
  /** Copies of a value made by assignment, boxing or unboxing (copying a reference doesn't count). */
  copies: number;
}

export interface ShPart {
  id: string;
  label: string;
  doc: CodeDoc;
  trace: Trace<ShState>;
}

export type ShScenario = 'value-vs-reference' | 'struct-vs-class-copy' | 'boxing';

/** Mark ids: `v:name`, `v:name.Field`, `o:#1`, `o:#1.Field`. */
const v = (name: string, field?: string) => (field ? `v:${name}.${field}` : `v:${name}`);
const o = (id: string, field?: string) => (field ? `o:${id}.${field}` : `o:${id}`);

class Mem {
  readonly r = new Recorder<ShState>();
  state: ShState = { frame: 'Main', vars: [], heap: [], output: [], marks: {}, copies: 0 };
  private next = 1;

  newObject(obj: Omit<ShObject, 'id'>): string {
    const id = `#${this.next++}`;
    this.state.heap.push({ ...obj, id });
    return id;
  }
  obj(id: string): ShObject {
    const x = this.state.heap.find((h) => h.id === id);
    if (!x) throw new Error(`no heap object ${id}`);
    return x;
  }
  var(name: string): ShVar {
    const x = this.state.vars.find((h) => h.name === name);
    if (!x) throw new Error(`no variable ${name}`);
    return x;
  }
  declare(x: ShVar): void {
    this.state.vars.push(x);
  }
  setField(fields: ShField[] | undefined, name: string, value: string): void {
    const f = fields?.find((q) => q.name === name);
    if (!f) throw new Error(`no field ${name}`);
    f.value = value;
  }
  /** Recomputes which heap objects no variable or object field refers to. */
  private refreshOrphans(): void {
    const live = new Set(this.state.vars.map((x) => x.ref).filter(Boolean) as string[]);
    for (const h of this.state.heap) h.orphan = !live.has(h.id);
  }
  step(line: number, narration: string, marks: ShMarks = {}, predict?: Prediction, action: 'start' | 'read' | 'write' | 'done' = 'write'): void {
    this.refreshOrphans();
    this.state.marks = marks;
    this.r.push(this.state, { action, line, narration, predict, vars: this.varsPanel() });
  }
  private varsPanel(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const x of this.state.vars) {
      if (x.kind === 'ref') out[x.name] = x.ref ? `→ ${x.ref}` : 'null';
      else if (x.fields) out[x.name] = `{ ${x.fields.map((f) => `${f.name} = ${f.value}`).join(', ')} }`;
      else out[x.name] = x.value ?? '?';
    }
    return out;
  }
  done(line: number, narration: string): ShPart['trace'] {
    this.step(line, narration, {}, undefined, 'done');
    return this.r.steps;
  }
}

const yesNo = (q: string, yes: string, no: string, answerYes: boolean): Prediction => ({ question: q, options: [yes, no], answer: answerYes ? 0 : 1 });
const prints = (stmt: string, options: string[], answer: string): Prediction => ({ question: `What does ${stmt} print?`, options, answer: options.indexOf(answer) });

// ── C#_Fundamentals.md ─────────────────────────────────────────────────────────────────────

function fundStruct(): ShPart {
  const doc = docOf('fundStruct');
  const L = linesIn(doc, 0, { type: 'struct Point {', decl: 'Point p;', x: 'p.X = 10;', y: 'p.Y = 20;' });
  const m = new Mem();
  m.step(L.type, 'struct Point declares a value type with two int fields. Declaring a type creates nothing in memory yet.', {}, undefined, 'start');
  m.declare({ name: 'p', type: 'Point', kind: 'value', fields: [{ name: 'X', value: '?' }, { name: 'Y', value: '?' }] });
  m.step(L.decl, 'Point p; declares a local of a value type. The variable holds the whole Point, its X and Y, directly. There is no new, no heap object and no reference. The fields are unassigned until the next lines set them.', { write: [v('p')] });
  m.setField(m.var('p').fields, 'X', '10');
  m.step(L.x, 'p.X = 10 writes straight into the X stored inside p.', { write: [v('p', 'X')] });
  m.setField(m.var('p').fields, 'Y', '20');
  m.step(L.y, 'p.Y = 20 writes the Y inside p. The heap is still empty: a value type stores the actual values.', { write: [v('p', 'Y')] });
  return { id: 'fund-struct', label: 'struct Point', doc, trace: m.done(L.y, 'Done. p is { X = 10, Y = 20 }, held in the variable itself.') };
}

function fundClass(): ShPart {
  const doc = docOf('fundClass');
  const L = linesIn(doc, 0, { type: 'class Person {', make: 'Person p = new Person();' });
  const m = new Mem();
  m.step(L.type, 'class Person declares a reference type with a string field and an int field.', {}, undefined, 'start');
  const id = m.newObject({ type: 'Person', kind: 'object', fields: [{ name: 'Name', value: 'null' }, { name: 'Age', value: '0' }] });
  m.step(L.make, `new Person() allocates a Person object on the managed heap (${id}). Its fields start at their default values: Name = null, Age = 0.`, { write: [o(id)] });
  m.declare({ name: 'p', type: 'Person', kind: 'ref', ref: id });
  m.step(L.make, `p does not contain the Person. It stores a reference to object ${id}, drawn as the arrow.`, { write: [v('p')] });
  return { id: 'fund-class', label: 'class Person', doc, trace: m.done(L.make, 'Done. One object on the heap, one reference to it in p.') };
}

function fundString(): ShPart {
  const doc = docOf('fundString');
  const L = linesIn(doc, 0, { aman: 'string name = "Aman";', rahul: 'name = "Rahul";' });
  const m = new Mem();
  const a = m.newObject({ type: 'string', kind: 'string', value: '"Aman"' });
  m.declare({ name: 'name', type: 'string', kind: 'ref', ref: a });
  m.step(L.aman, `string name = "Aman" gives name a reference to a string object holding "Aman" (${a}). string is a reference type.`, { write: [v('name'), o(a)] }, undefined, 'start');
  const r = m.newObject({ type: 'string', kind: 'string', value: '"Rahul"' });
  m.step(
    L.rahul,
    `A new string object "Rahul" is created (${r}). The "Aman" object is not touched: strings are immutable.`,
    { write: [o(r)] },
    yesNo('name = "Rahul" runs. Is the existing "Aman" object changed into "Rahul"?', 'Yes, its characters are overwritten', 'No, a new string object is created', false),
  );
  m.var('name').ref = r;
  m.step(
    L.rahul,
    `name now refers to ${r}. "You overwrote the variable reference, not the original string itself." The original "Aman" still exists in memory; nothing shown refers to it any more.`,
    { write: [v('name')] },
  );
  return {
    id: 'fund-string',
    label: 'string reassignment',
    doc,
    trace: m.done(L.rahul, 'Done. Two string objects exist and name refers to the newer one. The note: "The original "Aman" string still exists in memory (until garbage collected)."'),
  };
}

function fundObject(): ShPart {
  const doc = docOf('fundObject');
  const L = linesIn(doc, 0, { box: 'object obj = 123;' });
  const m = new Mem();
  m.step(L.box, '123 is an int, a value type. object is a reference type, so the int has to be put inside an object first.', {}, undefined, 'start');
  const id = m.newObject({ type: 'int (boxed)', kind: 'box', value: '123' });
  m.state.copies++;
  m.step(L.box, `Boxing: the runtime allocates an object on the heap (${id}) and copies 123 into it.`, { write: [o(id)] });
  m.declare({ name: 'obj', type: 'object', kind: 'ref', ref: id });
  m.step(L.box, `obj holds a reference to the box ${id}. The OOP lesson covers boxing and unboxing in detail.`, { write: [v('obj')] });
  return { id: 'fund-object', label: 'object obj = 123', doc, trace: m.done(L.box, 'Done. object can hold any value because value types are boxed when assigned to it.') };
}

// ── Struct_vs_Class.md ─────────────────────────────────────────────────────────────────────

function svcStruct(): ShPart {
  const doc = docOf('svcStruct');
  const L = linesIn(doc, 0, {
    type: 'public struct Point',
    first: 'Point first = new Point { X = 10, Y = 20 };',
    second: 'Point second = first;',
    mutate: 'second.X = 100;',
    w1: 'Console.WriteLine(first.X);',
    w2: 'Console.WriteLine(second.X);',
  });
  const m = new Mem();
  m.step(L.type, 'Point is a struct: a value type.', {}, undefined, 'start');
  m.declare({ name: 'first', type: 'Point', kind: 'value', fields: [{ name: 'X', value: '10' }, { name: 'Y', value: '20' }] });
  m.step(L.first, 'first holds a Point { X = 10, Y = 20 } directly. new on a struct initializes the value; no heap object is created.', { write: [v('first')] });
  m.declare({ name: 'second', type: 'Point', kind: 'value', fields: [{ name: 'X', value: '10' }, { name: 'Y', value: '20' }] });
  m.state.copies++;
  m.step(L.second, 'Point second = first copies the whole value. second gets its own X and Y: an independent copy.', { read: [v('first')], write: [v('second')] });
  m.setField(m.var('second').fields, 'X', '100');
  m.step(L.mutate, 'second.X = 100 changes only the copy in second. first.X is still 10.', { write: [v('second', 'X')] }, yesNo('second.X = 100 runs. Does first.X change too?', 'Yes, first.X becomes 100', 'No, first.X stays 10', false));
  m.state.output.push('10');
  m.step(L.w1, 'Prints 10: first was never touched.', { read: [v('first', 'X')] }, prints('Console.WriteLine(first.X)', ['10', '100'], '10'), 'read');
  m.state.output.push('100');
  m.step(L.w2, 'Prints 100.', { read: [v('second', 'X')] }, undefined, 'read');
  return { id: 'svc-struct', label: 'Struct: copy the value', doc, trace: m.done(L.w2, 'Changing second does not change first because the value was copied.') };
}

function svcClass(): ShPart {
  const doc = docOf('svcClass');
  const L = linesIn(doc, 0, {
    type: 'public class Person',
    first: 'Person first = new Person { Name = "Aman" };',
    second: 'Person second = first;',
    mutate: 'second.Name = "Rahul";',
    w1: 'Console.WriteLine(first.Name);',
    w2: 'Console.WriteLine(second.Name);',
  });
  const m = new Mem();
  m.step(L.type, 'Person is a class: a reference type.', {}, undefined, 'start');
  const id = m.newObject({ type: 'Person', kind: 'object', fields: [{ name: 'Name', value: '"Aman"' }] });
  m.declare({ name: 'first', type: 'Person', kind: 'ref', ref: id });
  m.step(L.first, `new Person { Name = "Aman" } creates one object on the heap (${id}); first stores a reference to it.`, { write: [v('first'), o(id)] });
  m.declare({ name: 'second', type: 'Person', kind: 'ref', ref: id });
  m.step(L.second, `Person second = first copies the reference, not the object. Both variables now point at ${id}.`, { read: [v('first')], write: [v('second')] });
  m.setField(m.obj(id).fields, 'Name', '"Rahul"');
  m.step(L.mutate, `second.Name = "Rahul" follows second's reference and changes the one shared object.`, { write: [o(id, 'Name')] }, yesNo('second.Name = "Rahul" runs. Does first.Name change too?', 'Yes, first.Name is now "Rahul"', 'No, first.Name stays "Aman"', true));
  m.state.output.push('Rahul');
  m.step(L.w1, `Prints Rahul: first refers to the same object ${id}.`, { read: [o(id, 'Name')] }, prints('Console.WriteLine(first.Name)', ['Aman', 'Rahul'], 'Rahul'), 'read');
  m.state.output.push('Rahul');
  m.step(L.w2, 'Prints Rahul.', { read: [o(id, 'Name')] }, undefined, 'read');
  return {
    id: 'svc-class',
    label: 'Class: copy the reference',
    doc,
    trace: m.done(L.w2, 'Both variables refer to the same object, so changing it through either reference is visible through the other.'),
  };
}

function svcQuick(): ShPart {
  const doc = docOf('svcQuick');
  const L = linesIn(doc, 0, {
    p1: 'Point point1 = new Point { X = 1, Y = 2 };',
    p2: 'Point point2 = point1;',
    px: 'point2.X = 10;',
    q1: 'Person person1 = new Person { Name = "Aman" };',
    q2: 'Person person2 = person1;',
    qn: 'person2.Name = "Rahul";',
    w1: 'Console.WriteLine(point1.X);',
    w2: 'Console.WriteLine(person1.Name);',
  });
  const m = new Mem();
  m.declare({ name: 'point1', type: 'Point', kind: 'value', fields: [{ name: 'X', value: '1' }, { name: 'Y', value: '2' }] });
  m.step(L.p1, 'point1 holds a Point value { X = 1, Y = 2 }.', { write: [v('point1')] }, undefined, 'start');
  m.declare({ name: 'point2', type: 'Point', kind: 'value', fields: [{ name: 'X', value: '1' }, { name: 'Y', value: '2' }] });
  m.state.copies++;
  m.step(L.p2, 'point2 = point1 copies the value.', { read: [v('point1')], write: [v('point2')] });
  m.setField(m.var('point2').fields, 'X', '10');
  m.step(L.px, 'point2.X = 10 changes the copy only.', { write: [v('point2', 'X')] }, yesNo('point2.X = 10 runs. Does point1.X change?', 'Yes', 'No', false));
  const id = m.newObject({ type: 'Person', kind: 'object', fields: [{ name: 'Name', value: '"Aman"' }] });
  m.declare({ name: 'person1', type: 'Person', kind: 'ref', ref: id });
  m.step(L.q1, `person1 refers to a new Person object (${id}).`, { write: [v('person1'), o(id)] });
  m.declare({ name: 'person2', type: 'Person', kind: 'ref', ref: id });
  m.step(L.q2, `person2 = person1 copies the reference: both refer to ${id}.`, { read: [v('person1')], write: [v('person2')] });
  m.setField(m.obj(id).fields, 'Name', '"Rahul"');
  m.step(L.qn, 'person2.Name = "Rahul" changes the shared object.', { write: [o(id, 'Name')] }, yesNo('person2.Name = "Rahul" runs. Does person1.Name change?', 'Yes', 'No', true));
  m.state.output.push('1');
  m.step(L.w1, 'Prints 1: the struct copy protected point1.', { read: [v('point1', 'X')] }, prints('Console.WriteLine(point1.X)', ['1', '10'], '1'), 'read');
  m.state.output.push('Rahul');
  m.step(L.w2, 'Prints Rahul: both Person variables share one object.', { read: [o(id, 'Name')] }, prints('Console.WriteLine(person1.Name)', ['Aman', 'Rahul'], 'Rahul'), 'read');
  return { id: 'svc-quick', label: 'Both side by side', doc, trace: m.done(L.w2, 'Struct assignment copies the value; class assignment copies the reference.') };
}

function svcBoxing(): ShPart {
  const doc = docOf('svcBoxing');
  const L = linesIn(doc, 0, { num: 'int number = 10;', box: 'object boxed = number;', unbox: 'int copy = (int)boxed;' });
  const m = new Mem();
  m.declare({ name: 'number', type: 'int', kind: 'value', value: '10' });
  m.step(L.num, 'number is an int holding 10.', { write: [v('number')] }, undefined, 'start');
  const id = m.newObject({ type: 'int (boxed)', kind: 'box', value: '10' });
  m.declare({ name: 'boxed', type: 'object', kind: 'ref', ref: id });
  m.state.copies++;
  m.step(
    L.box,
    `Boxing: a copy of the value is placed inside an object on the managed heap (${id}); boxed refers to it.`,
    { read: [v('number')], write: [o(id), v('boxed')] },
    { question: 'object boxed = number runs. What does boxed refer to?', options: ["number's own storage", 'A new heap object holding a copy of 10'], answer: 1 },
  );
  m.declare({ name: 'copy', type: 'int', kind: 'value', value: '10' });
  m.state.copies++;
  m.step(L.unbox, `Unboxing: (int)boxed checks that ${id} really holds an int, then copies 10 out into copy.`, { read: [o(id)], write: [v('copy')] });
  return { id: 'svc-boxing', label: 'Box, then unbox', doc, trace: m.done(L.unbox, 'Done. number, the box and copy are three separate copies of 10.') };
}

// ── 6.C#_OOP/Note.md ───────────────────────────────────────────────────────────────────────

function oopBox(): ShPart {
  const doc = docOf('oopBox');
  const L = linesIn(doc, 0, { num: 'int num = 10;', box: 'object obj = num;' });
  const m = new Mem();
  m.declare({ name: 'num', type: 'int', kind: 'value', value: '10' });
  m.step(L.num, 'num is a value type holding 10.', { write: [v('num')] }, undefined, 'start');
  const id = m.newObject({ type: 'int (boxed)', kind: 'box', value: '10' });
  m.state.copies++;
  m.step(
    L.box,
    `Boxing: the value is copied into a new object on the heap (${id}).`,
    { read: [v('num')], write: [o(id)] },
    { question: 'object obj = num runs. Where does obj point?', options: ['At num itself', 'At a boxed copy of num on the heap'], answer: 1 },
  );
  m.declare({ name: 'obj', type: 'object', kind: 'ref', ref: id });
  m.step(L.box, `"num still exists separately on the stack, but now obj is a reference to a boxed copy in the heap." Changing num later would not change the box.`, { write: [v('obj')] });
  return { id: 'oop-box', label: 'Boxing', doc, trace: m.done(L.box, 'Done. Boxing is implicit: no cast was needed.') };
}

function oopUnbox(): ShPart {
  const doc = docOf('oopUnbox');
  const L = linesIn(doc, 0, { box: 'object obj = 20;', unbox: 'int num = (int)obj;' });
  const m = new Mem();
  const id = m.newObject({ type: 'int (boxed)', kind: 'box', value: '20' });
  m.declare({ name: 'obj', type: 'object', kind: 'ref', ref: id });
  m.state.copies++;
  m.step(L.box, `object obj = 20 boxes the int 20 into a heap object (${id}).`, { write: [o(id), v('obj')] }, undefined, 'start');
  m.declare({ name: 'num', type: 'int', kind: 'value', value: '20' });
  m.state.copies++;
  m.step(
    L.unbox,
    `Unboxing needs an explicit cast. The runtime checks that ${id} holds an int, then copies 20 back into num. "If the type doesn't match during unboxing, you'll get an InvalidCastException."`,
    { read: [o(id)], write: [v('num')] },
    { question: 'Is (int) required here, or would int num = obj; compile?', options: ['The cast is required', 'It compiles without the cast'], answer: 0 },
  );
  return { id: 'oop-unbox', label: 'Unboxing', doc, trace: m.done(L.unbox, 'Done. num and the box each hold their own 20.') };
}

function oopStructBox(): ShPart {
  const doc = docOf('oopStructBox');
  const L = linesIn(doc, 0, { p: 'Point p = new Point { X = 1 };', box: 'object o = p;', unbox: 'Point p2 = (Point)o;' });
  const m = new Mem();
  m.declare({ name: 'p', type: 'Point', kind: 'value', fields: [{ name: 'X', value: '1' }] });
  m.step(L.p, 'p is a struct value with X = 1, stored in the variable.', { write: [v('p')] }, undefined, 'start');
  const id = m.newObject({ type: 'Point (boxed)', kind: 'box', fields: [{ name: 'X', value: '1' }] });
  m.declare({ name: 'o', type: 'object', kind: 'ref', ref: id });
  m.state.copies++;
  m.step(L.box, `Passing a struct to object boxes it: a copy of p is placed on the heap (${id}). This is the heap allocation the note warns about.`, { read: [v('p')], write: [o(id), v('o')] });
  m.declare({ name: 'p2', type: 'Point', kind: 'value', fields: [{ name: 'X', value: '1' }] });
  m.state.copies++;
  m.step(
    L.unbox,
    'Unboxing copies the Point back out into p2.',
    { read: [o(id)], write: [v('p2')] },
    { question: 'After this line, how many separate Point values exist?', options: ['1 (all share one)', '2', '3 (p, the box, p2)'], answer: 2 },
  );
  return { id: 'oop-struct-box', label: 'Boxing a struct', doc, trace: m.done(L.unbox, 'Done. p, the boxed copy and p2 are three independent values; boxing broke the "no-heap" benefit.') };
}

const BUILDERS: Record<string, () => ShPart> = {
  'fund-struct': fundStruct,
  'fund-class': fundClass,
  'fund-string': fundString,
  'fund-object': fundObject,
  'svc-struct': svcStruct,
  'svc-class': svcClass,
  'svc-quick': svcQuick,
  'svc-boxing': svcBoxing,
  'oop-box': oopBox,
  'oop-unbox': oopUnbox,
  'oop-struct-box': oopStructBox,
};

/** Which parts each placement's `scenario` offers, in order. */
export const SH_SCENARIOS: Record<ShScenario, { title: string; parts: string[] }> = {
  'value-vs-reference': { title: 'Value types vs reference types', parts: ['fund-struct', 'fund-class', 'fund-string', 'fund-object'] },
  'struct-vs-class-copy': { title: 'Copying a struct vs a class', parts: ['svc-struct', 'svc-class', 'svc-quick'] },
  boxing: { title: 'Boxing and unboxing', parts: ['oop-box', 'oop-unbox', 'oop-struct-box', 'svc-boxing'] },
};

export const SH_PART_IDS = Object.keys(BUILDERS);

export function shPart(id: string): ShPart {
  const b = BUILDERS[id];
  if (!b) throw new Error(`unknown stack/heap part ${id}`);
  return b();
}

export function toShScenario(s: unknown): ShScenario {
  return typeof s === 'string' && s in SH_SCENARIOS ? (s as ShScenario) : 'value-vs-reference';
}

/** The snippets each part copies (for tests). */
export const SH_PART_SNIPPET: Record<string, SnippetKey> = {
  'fund-struct': 'fundStruct',
  'fund-class': 'fundClass',
  'fund-string': 'fundString',
  'fund-object': 'fundObject',
  'svc-struct': 'svcStruct',
  'svc-class': 'svcClass',
  'svc-quick': 'svcQuick',
  'svc-boxing': 'svcBoxing',
  'oop-box': 'oopBox',
  'oop-unbox': 'oopUnbox',
  'oop-struct-box': 'oopStructBox',
};
