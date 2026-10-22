import { lineOf } from '../../engine/code';
import type { Counters, Prediction } from '../../engine/types';
import { mkStep, ZERO, type Cell, type Mark, type SqlStage, type SqlStep, type TableView } from '../model';
import { SQL, WINDOW_EMPLOYEES, type WindowEmployee } from '../notes';

/**
 * Window functions over 8.SQL_WindowsfunctionsNMore.md's sample data: ROW_NUMBER, RANK and DENSE_RANK
 * (ORDER BY Salary DESC, optionally PARTITION BY Department as in the note's DeptRank example) and the
 * running total with a ROWS frame. Counters: comparisons = salary comparisons with the previous row,
 * reads = rows read by frames, writes = values computed.
 */
export type RankFn = 'ROW_NUMBER' | 'RANK' | 'DENSE_RANK';
export const RANK_FNS: RankFn[] = ['ROW_NUMBER', 'RANK', 'DENSE_RANK'];
const ALIAS: Record<RankFn, string> = { ROW_NUMBER: 'RowNum', RANK: 'RankNum', DENSE_RANK: 'DenseRankNum' };
const FN_SQL: Record<RankFn, string> = { ROW_NUMBER: SQL.rowNumber.code, RANK: SQL.rank.code, DENSE_RANK: SQL.denseRank.code };

export const FRAME_STARTS = ['UNBOUNDED PRECEDING', '2 PRECEDING', '1 PRECEDING', 'CURRENT ROW'] as const;
export const FRAME_ENDS = ['CURRENT ROW', '1 FOLLOWING', 'UNBOUNDED FOLLOWING'] as const;
export type FrameStart = (typeof FRAME_STARTS)[number];
export type FrameEnd = (typeof FRAME_ENDS)[number];
export const NOTE_FRAME = { start: 'UNBOUNDED PRECEDING', end: 'CURRENT ROW' } as const satisfies { start: FrameStart; end: FrameEnd };

export interface WindowState extends SqlStage {
  phase: 'input' | 'partition' | 'order' | 'row' | 'done';
}
export type WindowTrace = SqlStep<WindowState>[];

interface Sorted {
  e: WindowEmployee;
  part: number;
  pos: number;
}

/** Partitions in order of first appearance, each sorted by Salary DESC (ties keep table order). */
function sortRows(es: readonly WindowEmployee[], partition: boolean): { rows: Sorted[]; parts: { name: string; from: number; to: number }[] } {
  const names = partition ? [...new Set(es.map((e) => e.Department))] : ['all'];
  const rows: Sorted[] = [];
  const parts: { name: string; from: number; to: number }[] = [];
  names.forEach((name, p) => {
    const members = es.filter((e) => !partition || e.Department === name).sort((a, b) => b.Salary - a.Salary);
    parts.push({ name, from: rows.length, to: rows.length + members.length - 1 });
    members.forEach((e, pos) => rows.push({ e, part: p, pos }));
  });
  return { rows, parts };
}

/** ROW_NUMBER, RANK and DENSE_RANK for each sorted row (restarting per partition). */
export function rankValues(es: readonly WindowEmployee[], partition = false): { e: WindowEmployee; ROW_NUMBER: number; RANK: number; DENSE_RANK: number }[] {
  const { rows } = sortRows(es, partition);
  const out: { e: WindowEmployee; ROW_NUMBER: number; RANK: number; DENSE_RANK: number }[] = [];
  rows.forEach((r, i) => {
    const prev = i > 0 && rows[i - 1]!.part === r.part ? out[i - 1] : undefined;
    const tie = prev !== undefined && prev.e.Salary === r.e.Salary;
    out.push({ e: r.e, ROW_NUMBER: r.pos + 1, RANK: tie ? prev.RANK : r.pos + 1, DENSE_RANK: tie ? prev.DENSE_RANK : (prev?.DENSE_RANK ?? 0) + 1 });
  });
  return out;
}

export function traceRanking(fns: RankFn[], partition: boolean, es: readonly WindowEmployee[] = WINDOW_EMPLOYEES): WindowTrace {
  const funcs = partition ? (['ROW_NUMBER'] as RankFn[]) : fns.length ? fns : RANK_FNS;
  const blocks = partition ? [SQL.deptRank.code] : funcs.map((f) => FN_SQL[f]);
  const fnLine = (f: RankFn) => (partition ? { block: 0, lines: [lineOf(SQL.deptRank.code, 'ROW_NUMBER() OVER')] } : { block: funcs.indexOf(f), lines: [lineOf(FN_SQL[f], `${f}() OVER`)] });
  const orderLine = partition ? { block: 0, lines: [lineOf(SQL.deptRank.code, 'ORDER BY Salary DESC')] } : fnLine(funcs[0]!);
  const partLine = { block: 0, lines: partition ? [lineOf(SQL.deptRank.code, 'PARTITION BY Department')] : [] };
  const fromLine = { block: 0, lines: [lineOf(blocks[0]!, 'FROM Employees')] };
  const vals = rankValues(es, partition);
  const { rows, parts } = sortRows(es, partition);
  const cols = partition ? ['Name', 'Department', 'Salary', 'DeptRank'] : ['Name', 'Salary', ...funcs.map((f) => ALIAS[f])];
  const filled: (number | null)[][] = rows.map(() => funcs.map(() => null));
  const c: Counters = { ...ZERO };
  const steps: WindowTrace = [];
  const groups = partition ? parts.map((p) => ({ from: p.from, to: p.to, label: `PARTITION Department = '${p.name}'` })) : undefined;

  const sortedView = (marks: (Mark | null)[], cellMarks: Record<string, Mark> = {}): TableView => ({
    id: 'win',
    caption: partition ? 'Partitioned by Department, ordered by Salary DESC' : 'Ordered by Salary DESC',
    columns: cols,
    rows: rows.map((r, i) => [r.e.Name, ...(partition ? [r.e.Department] : []), r.e.Salary, ...filled[i]!] as Cell[]),
    rowIds: rows.map((r) => `w${r.e.Id}`),
    marks,
    cellMarks,
    groups,
  });
  const input: TableView = { id: 'win', caption: 'Employees (as stored)', columns: ['Id', 'Name', 'Department', 'Salary'], rows: es.map((e) => [e.Id, e.Name, e.Department, e.Salary]), rowIds: es.map((e) => `w${e.Id}`) };
  const push = (tables: TableView[], code: SqlStage['code'], phase: WindowState['phase'], action: SqlStep['action'], narration: string, vars: SqlStep['variables'], predict?: Prediction) =>
    steps.push(mkStep({ tables, code, phase }, action, narration, vars, c, predict));

  push([input], fromLine, 'input', 'start', `The Employees sample data, ${es.length} rows. A window function adds a value to every row without collapsing rows the way GROUP BY does.`, {});
  if (partition) push([sortedView([])], partLine, 'partition', 'select', `PARTITION BY Department splits the rows into ${parts.length} partitions: ${parts.map((p) => p.name).join(', ')}. ROW_NUMBER works on each partition on its own.`, { partitions: parts.length });
  push([sortedView([])], orderLine, 'order', 'select', `ORDER BY Salary DESC orders the rows${partition ? ' inside each partition' : ''}, highest salary first. The numbering follows this order.`, {});

  const ask = (i: number): Prediction | undefined => {
    const v = vals[i];
    if (!v) return undefined;
    const f: RankFn = funcs.includes('RANK') ? 'RANK' : funcs[0]!;
    const n = partition ? parts[rows[i]!.part]!.to - parts[rows[i]!.part]!.from + 1 : rows.length;
    const options = Array.from({ length: n }, (_, k) => String(k + 1));
    return { question: `What ${f}${partition ? ' (DeptRank)' : ''} will ${v.e.Name} get?`, options, answer: v[f] - 1 };
  };
  steps[steps.length - 1]!.predict = ask(0);

  rows.forEach((r, i) => {
    const v = vals[i]!;
    const prevSame = i > 0 && rows[i - 1]!.part === r.part;
    const prev = prevSame ? vals[i - 1] : undefined;
    if (prev) c.comparisons++;
    const tie = prev !== undefined && prev.e.Salary === v.e.Salary;
    const afterTie = prev !== undefined && !tie && i >= 2 && rows[i - 2]!.part === r.part && vals[i - 2]!.e.Salary === prev.e.Salary;
    funcs.forEach((f, k) => {
      filled[i]![k] = v[f];
      c.writes++;
    });
    const cm: Record<string, Mark> = {};
    funcs.forEach((_, k) => (cm[`${i}:${cols.length - funcs.length + k}`] = 'write'));
    const marks: (Mark | null)[] = rows.map((_, k) => (k === i ? 'active' : prevSame && k === i - 1 ? 'compare' : null));
    let narration: string;
    if (!prev) narration = `${v.e.Name} (${v.e.Salary}) is first${partition ? ` in the ${parts[r.part]!.name} partition, so numbering starts again at 1` : ''}: ${funcs.map((f) => `${f} = 1`).join(', ')}.`;
    else if (tie)
      narration = `${v.e.Name} ties with ${prev.e.Name} (${v.e.Salary}). ROW_NUMBER never ties, so it is ${v.ROW_NUMBER}${funcs.includes('RANK') ? `; RANK repeats ${v.RANK}` : ''}${funcs.includes('DENSE_RANK') ? `; DENSE_RANK repeats ${v.DENSE_RANK}` : ''}.`;
    else if (afterTie)
      narration = `${v.e.Name} (${v.e.Salary}) comes after a tie. ROW_NUMBER = ${v.ROW_NUMBER}${funcs.includes('RANK') ? `; RANK skips to ${v.RANK} (it leaves a gap after the tie)` : ''}${funcs.includes('DENSE_RANK') ? `; DENSE_RANK = ${v.DENSE_RANK} (no gaps)` : ''}.`;
    else narration = `${v.e.Name} (${v.e.Salary}) earns less than ${prev.e.Name} (${prev.e.Salary}), so the numbers move on: ${funcs.map((f) => `${f} = ${v[f]}`).join(', ')}.`;
    const focus: RankFn = (tie || afterTie) && funcs.includes('RANK') ? 'RANK' : funcs[0]!;
    push([sortedView(marks, cm)], fnLine(focus), 'row', 'write', narration, { Name: v.e.Name, Salary: v.e.Salary, ...Object.fromEntries(funcs.map((f) => [partition ? 'DeptRank' : ALIAS[f], v[f]])) }, ask(i + 1));
  });
  push([sortedView(rows.map(() => 'settled'))], fromLine, 'done', 'done', partition ? 'Done: every row keeps its columns and gets a DeptRank, its position inside its own department.' : `Done: every row keeps its columns and gets ${funcs.join(', ')}.${funcs.length > 1 && !vals.some((v, i) => i > 0 && vals[i - 1]!.e.Salary === v.e.Salary) ? ' With no tied salaries all three agree; edit the data to make a tie and see them differ.' : ''}`, {});
  return steps;
}

// ── running total ───────────────────────────────────────────────────────────────────────

const OFFSET: Record<string, number> = { 'UNBOUNDED PRECEDING': -Infinity, '2 PRECEDING': -2, '1 PRECEDING': -1, 'CURRENT ROW': 0, '1 FOLLOWING': 1, 'UNBOUNDED FOLLOWING': Infinity };

/** The running-total SQL for a frame: the note's query when the frame is the note's, else the learner's variation. */
export function runningTotalCode(frame: { start: FrameStart; end: FrameEnd }, partition: boolean): { code: string; fromNote: boolean } {
  const fromNote = frame.start === NOTE_FRAME.start && frame.end === NOTE_FRAME.end && !partition;
  let code = SQL.runningTotal.code.replace('ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW', `ROWS BETWEEN ${frame.start} AND ${frame.end}`);
  if (partition) code = code.replace('           ORDER BY Salary DESC', '           PARTITION BY Department\n           ORDER BY Salary DESC');
  return { code, fromNote };
}

export function runningTotals(es: readonly WindowEmployee[], frame: { start: FrameStart; end: FrameEnd } = NOTE_FRAME, partition = false): { e: WindowEmployee; total: number; from: number; to: number }[] {
  const { rows, parts } = sortRows(es, partition);
  return rows.map((r, i) => {
    const p = parts[r.part]!;
    const from = Math.max(p.from, i + OFFSET[frame.start]!);
    const to = Math.min(p.to, i + OFFSET[frame.end]!);
    let total = 0;
    for (let k = from; k <= to; k++) total += rows[k]!.e.Salary;
    return { e: r.e, total, from, to };
  });
}

export function traceRunningTotal(frame: { start: FrameStart; end: FrameEnd } = NOTE_FRAME, partition = false, es: readonly WindowEmployee[] = WINDOW_EMPLOYEES): WindowTrace {
  const { code } = runningTotalCode(frame, partition);
  const L = { sum: lineOf(code, 'SUM(Salary) OVER'), order: lineOf(code, 'ORDER BY Salary DESC'), rows: lineOf(code, 'ROWS BETWEEN'), from: lineOf(code, 'FROM Employees') };
  const partLine = partition ? lineOf(code, 'PARTITION BY Department') : L.order;
  const { rows, parts } = sortRows(es, partition);
  const totals = runningTotals(es, frame, partition);
  const filled: (number | null)[] = rows.map(() => null);
  const cols = partition ? ['Name', 'Department', 'Salary', 'RunningTotal'] : ['Name', 'Salary', 'RunningTotal'];
  const c: Counters = { ...ZERO };
  const steps: WindowTrace = [];
  const groups = partition ? parts.map((p) => ({ from: p.from, to: p.to, label: `PARTITION Department = '${p.name}'` })) : undefined;
  const view = (marks: (Mark | null)[], notes: (string | null)[] = [], cm: Record<string, Mark> = {}): TableView => ({
    id: 'win',
    caption: partition ? 'Partitioned by Department, ordered by Salary DESC' : 'Ordered by Salary DESC',
    columns: cols,
    rows: rows.map((r, i) => [r.e.Name, ...(partition ? [r.e.Department] : []), r.e.Salary, filled[i]!] as Cell[]),
    rowIds: rows.map((r) => `w${r.e.Id}`),
    marks,
    notes,
    cellMarks: cm,
    groups,
  });
  const input: TableView = { id: 'win', caption: 'Employees (as stored)', columns: ['Id', 'Name', 'Department', 'Salary'], rows: es.map((e) => [e.Id, e.Name, e.Department, e.Salary]), rowIds: es.map((e) => `w${e.Id}`) };
  const push = (tables: TableView[], lines: number[], phase: WindowState['phase'], action: SqlStep['action'], narration: string, vars: SqlStep['variables'], predict?: Prediction) =>
    steps.push(mkStep({ tables, code: { block: 0, lines }, phase }, action, narration, vars, c, predict));
  const ask = (i: number): Prediction | undefined => {
    const t = totals[i];
    if (!t) return undefined;
    const all = rows.reduce((a, r) => a + r.e.Salary, 0);
    const opts = [...new Set([t.total, t.total - t.e.Salary, t.e.Salary, all, t.total + (rows[i + 1]?.e.Salary ?? 0)].filter((x) => x >= 0))].sort((a, b) => a - b);
    return { question: `What will RunningTotal be for ${t.e.Name}?`, options: opts.map(String), answer: opts.indexOf(t.total) };
  };

  push([input], [L.from], 'input', 'start', `The Employees sample data, ${es.length} rows. SUM(Salary) OVER (...) adds up the salaries inside each row's window frame.`, {});
  if (partition) push([view([])], [partLine], 'partition', 'select', `PARTITION BY Department: each department is summed on its own, and UNBOUNDED PRECEDING means the first row of the partition.`, { partitions: parts.length });
  push([view([])], [L.order], 'order', 'select', `ORDER BY Salary DESC fixes the row order. The frame is ROWS BETWEEN ${frame.start} AND ${frame.end}.`, { frame: `${frame.start} → ${frame.end}` }, ask(0));
  rows.forEach((r, i) => {
    const t = totals[i]!;
    const inFrame = (k: number) => k >= t.from && k <= t.to;
    c.reads += Math.max(0, t.to - t.from + 1);
    c.writes++;
    filled[i] = t.total;
    const marks = rows.map((_, k) => (k === i ? 'active' : inFrame(k) ? 'compare' : null) as Mark | null);
    const notes = rows.map((_, k) => (k === i ? (inFrame(k) ? 'current row, in frame' : 'current row') : inFrame(k) ? 'in frame' : null));
    const parts_ = rows.slice(t.from, t.to + 1).map((x) => x.e.Salary);
    const range = t.from === t.to ? `row ${t.from + 1}` : `rows ${t.from + 1}–${t.to + 1}`;
    push(
      [view(marks, notes, { [`${i}:${cols.length - 1}`]: 'write' })],
      [L.rows, L.sum],
      'row',
      'write',
      `${r.e.Name}: the frame ${frame.start} to ${frame.end} covers ${parts_.length ? range : 'no rows'}. ${parts_.length ? `${parts_.join(' + ')} = ${t.total}` : 'SUM is NULL'}.`,
      { Name: r.e.Name, Salary: r.e.Salary, 'frame rows': parts_.length, RunningTotal: t.total },
      ask(i + 1),
    );
  });
  push([view(rows.map(() => 'settled'))], [L.from], 'done', 'done', frame.start === NOTE_FRAME.start && frame.end === NOTE_FRAME.end ? 'Done: each RunningTotal is all previous rows\' salaries plus the current row\'s salary, as the note says.' : 'Done: each value is the sum of the salaries inside that row\'s frame.', {});
  return steps;
}
