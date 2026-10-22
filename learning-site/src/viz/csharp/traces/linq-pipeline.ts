import type { Prediction, Trace } from '../../engine/types';
import { docOf, linesIn, Recorder, type CodeDoc } from '../shared/step';
import { SNIPPETS } from '../snippets';

/*
 * Deferred vs immediate execution, from DeferredVsImmediate.md: the note's two examples, stepped one pull at
 * a time, plus a Where → Select chain composed from the note's Where example and the Select example in LINQ
 * basics (the notes have no chained example; the code panel says so, and CONTENT_ISSUES.md records it).
 *
 * Runtime detail the notes summarise as "streamed as you iterate": Where and Select are deferred streaming
 * operators, so foreach pulls one element at a time and each element passes through the whole chain before
 * the next is read; ToList is immediate and reads the whole source when called:
 * https://learn.microsoft.com/en-us/dotnet/csharp/linq/get-started/introduction-to-linq-queries#classification-of-standard-query-operators-by-manner-of-execution
 * (Checked by running the chain with logging predicates: W1 W2 W3 S3 F9 W4 S4 F16 W5 S5 F25.)
 */

export type LqStageId = 'where' | 'select' | 'tolist' | 'foreach';

export interface LqStage {
  id: LqStageId;
  label: string;
  /** The value in this stage right now, if any. */
  value: number | null;
  /** pass/fail for Where's last test. */
  verdict: 'pass' | 'fail' | null;
  calls: number;
}

export interface LqState {
  /** numbers: the source list. */
  source: number[];
  /** Index of the source element being read in this step. */
  reading: number | null;
  /** Source elements already read by the current enumeration. */
  readUpTo: number;
  stages: LqStage[];
  /** ToList's list (immediate example). */
  result: number[] | null;
  output: string[];
  /** Has the query run at all yet? */
  executed: boolean;
  /** Which stage moved in this step. */
  active: LqStageId | 'source' | null;
}

export type LqPartId = 'deferred' | 'immediate' | 'chain';

export interface LqPart {
  id: LqPartId;
  label: string;
  doc: CodeDoc;
  trace: Trace<LqState>;
}

/** The composed chain: the deferred example with the note's Select (`n => n * n`) after its Where. */
export const CHAIN_CODE = `var numbers = new List<int> { 1, 2, 3, 4 };
var query = numbers.Where(n => n > 2).Select(n => n * n);
numbers.Add(5);
foreach (var n in query)
{
    Console.WriteLine(n);
}`;

const stage = (id: LqStageId, label: string): LqStage => ({ id, label, value: null, verdict: null, calls: 0 });

class Sim {
  readonly r = new Recorder<LqState>();
  s: LqState;
  constructor(stages: LqStage[]) {
    this.s = { source: [], reading: null, readUpTo: 0, stages, result: null, output: [], executed: false, active: null };
  }
  st(id: LqStageId): LqStage {
    return this.s.stages.find((x) => x.id === id)!;
  }
  clear(): void {
    for (const x of this.s.stages) {
      x.value = null;
      x.verdict = null;
    }
    this.s.reading = null;
  }
  step(line: number, narration: string, active: LqState['active'], opts: { predict?: Prediction; action?: 'start' | 'read' | 'compare' | 'write' | 'done' } = {}): void {
    this.s.active = active;
    const vars: Record<string, string | number> = { numbers: `[${this.s.source.join(', ')}]` };
    const w = this.s.stages.find((x) => x.id === 'where');
    if (w) vars['predicate calls'] = w.calls;
    const sel = this.s.stages.find((x) => x.id === 'select');
    if (sel) vars['selector calls'] = sel.calls;
    if (this.s.result) vars.result = `[${this.s.result.join(', ')}]`;
    this.r.push(this.s, { action: opts.action ?? 'read', line, narration, predict: opts.predict, vars });
  }
}

const PRED = (n: number) => n > 2;
const SQUARE = (n: number) => n * n;

/** Pulls the source through Where (and Select) one element at a time, the way foreach drives it. */
function pullAll(sim: Sim, L: { foreach: number; print: number }, withSelect: boolean): void {
  const s = sim.s;
  const where = sim.st('where');
  const fe = sim.st('foreach');
  let i = 0;
  for (;;) {
    sim.clear();
    if (i >= s.source.length) {
      s.readUpTo = i;
      sim.step(L.foreach, `foreach asks for the next element. Where finds no more elements in numbers, so MoveNext returns false and the loop ends.`, 'foreach');
      return;
    }
    const v = s.source[i]!;
    s.reading = i;
    s.readUpTo = i + 1;
    where.value = v;
    where.calls++;
    const ok = PRED(v);
    where.verdict = ok ? 'pass' : 'fail';
    sim.step(
      L.foreach,
      ok
        ? `foreach asks for the next element. Where reads ${v} from numbers and tests ${v} > 2: true, so ${v} goes on down the pipeline.`
        : `foreach asks for the next element. Where reads ${v} from numbers and tests ${v} > 2: false, so Where skips it and reads the next one.`,
      'where',
      {
        action: 'compare',
        predict: i === 0 ? { question: `Where reads ${v}. Does it pass n > 2?`, options: ['Yes', 'No'], answer: ok ? 0 : 1 } : undefined,
      },
    );
    i++;
    if (!ok) continue;
    let out = v;
    if (withSelect) {
      const sel = sim.st('select');
      sel.value = v;
      sel.calls++;
      out = SQUARE(v);
      sim.step(L.foreach, `Select receives ${v} straight away and computes ${v} * ${v} = ${out}. Where has not read the next element yet.`, 'select', {
        action: 'write',
        predict: v === 3 ? { question: 'Select now has 3. Has Where already read 4 from numbers?', options: ['Yes, Where filters everything first', 'No, 3 travels the whole chain first'], answer: 1 } : undefined,
      });
    }
    fe.value = out;
    fe.calls++;
    s.output.push(String(out));
    sim.step(L.print, `foreach gets n = ${out} and prints it. Only now will it ask for the next element.`, 'foreach', { action: 'write' });
  }
}

function deferred(): LqPart {
  const doc = docOf('dviDeferred');
  const L = linesIn(doc, 0, { list: 'var numbers = new List<int> { 1, 2, 3, 4 };', query: 'var query = numbers.Where(n => n > 2);', add: 'numbers.Add(5);', foreach: 'foreach (var n in query)', print: 'Console.WriteLine(n);' });
  const sim = new Sim([stage('where', 'Where(n => n > 2)'), stage('foreach', 'foreach')]);
  sim.s.source = [1, 2, 3, 4];
  sim.step(L.list, 'numbers holds 1, 2, 3, 4.', 'source', { action: 'start' });
  sim.step(L.query, '"Query definition (not executed yet)": query is a plan that remembers numbers and the predicate. Nothing has been filtered and the predicate has not run.', 'where', {
    predict: { question: 'How many times has n => n > 2 run so far?', options: ['0', '4'], answer: 0 },
  });
  sim.s.source.push(5);
  sim.step(L.add, 'numbers.Add(5) changes the source before anyone iterates. The query still has not run.', 'source', {
    action: 'write',
    predict: { question: 'The query was defined before 5 was added. Will 5 be printed?', options: ['Yes', 'No'], answer: 0 },
  });
  sim.s.executed = true;
  pullAll(sim, L, false);
  sim.clear();
  sim.step(
    L.foreach,
    `Done: printed 3, 4, 5. "Because the query executes after adding 5, the new element is included." Each time you iterate, the query re-executes on the current data source.`,
    null,
    { action: 'done' },
  );
  return { id: 'deferred', label: 'Deferred: foreach', doc, trace: sim.r.steps };
}

function immediate(): LqPart {
  const doc = docOf('dviImmediate');
  const L = linesIn(doc, 0, { list: 'var numbers = new List<int> { 1, 2, 3, 4 };', tolist: 'var result = numbers.Where(n => n > 2).ToList();', add: 'numbers.Add(5);', foreach: 'foreach (var n in result)', print: 'Console.WriteLine(n);' });
  const sim = new Sim([stage('where', 'Where(n => n > 2)'), stage('tolist', 'ToList()'), stage('foreach', 'foreach')]);
  const where = sim.st('where');
  const tl = sim.st('tolist');
  sim.s.source = [1, 2, 3, 4];
  sim.step(L.list, 'numbers holds 1, 2, 3, 4.', 'source', { action: 'start' });
  sim.s.executed = true;
  sim.s.result = [];
  for (let i = 0; i < sim.s.source.length; i++) {
    sim.clear();
    const v = sim.s.source[i]!;
    sim.s.reading = i;
    sim.s.readUpTo = i + 1;
    where.value = v;
    where.calls++;
    const ok = PRED(v);
    where.verdict = ok ? 'pass' : 'fail';
    if (ok) {
      tl.value = v;
      tl.calls++;
      sim.s.result.push(v);
    }
    sim.step(L.tolist, `ToList() runs the query now, pulling every element: Where tests ${v} > 2: ${ok ? `true, so ToList stores ${v} in the new list` : 'false, skipped'}.`, ok ? 'tolist' : 'where', { action: ok ? 'write' : 'compare' });
  }
  sim.clear();
  sim.step(L.tolist, `"Query executed immediately by ToList()": result is a new List holding [${sim.s.result.join(', ')}]. The query is finished; result does not remember numbers.`, 'tolist', { action: 'write' });
  sim.s.source.push(5);
  sim.step(L.add, 'numbers.Add(5) changes the source, but result was already built.', 'source', {
    action: 'write',
    predict: { question: 'Will 5 be printed?', options: ['Yes', 'No'], answer: 1 },
  });
  const fe = sim.st('foreach');
  for (const v of sim.s.result) {
    sim.clear();
    fe.value = v;
    fe.calls++;
    sim.s.output.push(String(v));
    sim.step(L.print, `foreach walks the stored list: prints ${v}. The predicate does not run again.`, 'foreach', { action: 'write' });
  }
  sim.clear();
  sim.step(L.foreach, `Done: printed 3, 4. "Because ToList() executed the query immediately, it captured the results before 5 was added."`, null, { action: 'done' });
  return { id: 'immediate', label: 'Immediate: ToList()', doc, trace: sim.r.steps };
}

function chain(): LqPart {
  const doc: CodeDoc = {
    parts: [{ key: null, title: "Composed from DeferredVsImmediate.md's Where example and Notes.md › Select(selector)", code: CHAIN_CODE }],
  };
  const L = linesIn(doc, 0, { list: 'var numbers = new List<int> { 1, 2, 3, 4 };', query: 'var query = numbers.Where(n => n > 2).Select(n => n * n);', add: 'numbers.Add(5);', foreach: 'foreach (var n in query)', print: 'Console.WriteLine(n);' });
  const sim = new Sim([stage('where', 'Where(n => n > 2)'), stage('select', 'Select(n => n * n)'), stage('foreach', 'foreach')]);
  sim.s.source = [1, 2, 3, 4];
  sim.step(L.list, 'Same list as the deferred example: 1, 2, 3, 4.', 'source', { action: 'start' });
  sim.step(L.query, 'Where and Select are both deferred: query is now a two-stage plan. Neither lambda has run.', 'select');
  sim.s.source.push(5);
  sim.step(L.add, 'numbers.Add(5) before iterating, as in the note.', 'source', { action: 'write' });
  sim.s.executed = true;
  pullAll(sim, L, true);
  sim.clear();
  sim.step(L.foreach, 'Done: printed 9, 16, 25. Each element went through Where, then Select, then foreach before the next element was read: the pipeline streams one item at a time.', null, { action: 'done' });
  return { id: 'chain', label: 'Where → Select', doc, trace: sim.r.steps };
}

export const LQ_PARTS: { id: LqPartId; label: string }[] = [
  { id: 'deferred', label: 'Deferred: foreach' },
  { id: 'immediate', label: 'Immediate: ToList()' },
  { id: 'chain', label: 'Where → Select' },
];

export function lqPart(id: LqPartId): LqPart {
  return id === 'immediate' ? immediate() : id === 'chain' ? chain() : deferred();
}

/** Parts for a placement: the note's deferred example, ToList() when compareToList, and the chain. */
export function lqPartsFor(compareToList: boolean): LqPartId[] {
  return compareToList ? ['deferred', 'immediate', 'chain'] : ['deferred', 'chain'];
}

// The composed chain must reuse the notes' own pieces verbatim.
export const CHAIN_PIECES = [
  { from: SNIPPETS.dviDeferred.code, piece: 'var numbers = new List<int> { 1, 2, 3, 4 };' },
  { from: SNIPPETS.dviDeferred.code, piece: 'numbers.Where(n => n > 2)' },
  { from: SNIPPETS.linqSelect.code, piece: '.Select(n => n * n)' },
  { from: SNIPPETS.dviDeferred.code, piece: 'numbers.Add(5);' },
  { from: SNIPPETS.dviDeferred.code, piece: 'foreach (var n in query)' },
  { from: SNIPPETS.dviDeferred.code, piece: 'Console.WriteLine(n);' },
] as const;
