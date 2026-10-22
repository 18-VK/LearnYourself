import { lines } from '../../engine/code';
import type { Counters } from '../../engine/types';
import { countOptions, mkStep, ZERO, type Cell, type Mark, type SqlStage, type SqlStep, type TableView } from '../model';
import { CTE_EMPLOYEES, SQL, type CteEmployee } from '../notes';

/**
 * 9.SQL_CTE.md › Recursive CTE: the anchor member runs once; then the recursive member runs repeatedly,
 * each iteration taking only the previous iteration's output as its input (h), until an iteration returns
 * no rows; UNION ALL then combines all iterations. Semantics as described on Microsoft Learn,
 * https://learn.microsoft.com/en-us/sql/t-sql/queries/with-common-table-expression-transact-sql
 * (guidelines for recursive CTEs; the server-wide MAXRECURSION default is 100).
 * Counters: comparisons = join checks, swaps = recursive member runs, writes = rows in EmployeeHierarchy.
 */
export const RECURSIVE_CODE = SQL.recursive.code;
const L = lines(RECURSIVE_CODE, {
  with: 'WITH EmployeeHierarchy AS',
  anchor: 'SELECT Id, Name, ManagerId, 0 AS Level',
  anchorWhere: 'WHERE ManagerId IS NULL',
  union: 'UNION ALL',
  rec: 'SELECT e.Id, e.Name, e.ManagerId, Level + 1',
  recFrom: 'FROM Employees e',
  join: 'JOIN EmployeeHierarchy h',
  on: 'ON e.ManagerId = h.Id',
  final: 'FROM EmployeeHierarchy;',
});
export const MAX_RECURSION = 100;

export interface CteRow {
  Id: number;
  Name: string;
  ManagerId: number | null;
  Level: number;
}
export interface RecursiveState extends SqlStage {
  iteration: number;
  /** Rows per iteration so far (iteration 0 = anchor). */
  iterations: CteRow[][];
  /** Ids added in this step (highlighted in the tree). */
  fresh: number[];
}
export type RecursiveTrace = SqlStep<RecursiveState>[];

const empView = (es: readonly CteEmployee[], m: Record<number, Mark>, notes: Record<number, string> = {}): TableView => ({
  id: 'emp',
  caption: 'Employees e',
  columns: ['Id', 'Name', 'ManagerId'],
  rows: es.map((e) => [e.Id, e.Name, e.ManagerId]),
  rowIds: es.map((e) => `e${e.Id}`),
  marks: es.map((_, i) => m[i] ?? null),
  notes: es.map((_, i) => notes[i] ?? null),
});
const cteCols = ['Id', 'Name', 'ManagerId', 'Level'];
const cteRows = (rs: CteRow[]): Cell[][] => rs.map((r) => [r.Id, r.Name, r.ManagerId, r.Level]);

export function traceRecursive(es: readonly CteEmployee[] = CTE_EMPLOYEES): RecursiveTrace {
  const steps: RecursiveTrace = [];
  const c: Counters = { ...ZERO };
  const iterations: CteRow[][] = [];
  let fresh: number[] = [];

  const hView = (rs: CteRow[], k: number, m: Record<number, Mark> = {}): TableView => ({ id: 'h', caption: k < 0 ? 'h (previous iteration)' : `h = iteration ${k} output`, columns: cteCols, rows: cteRows(rs), rowIds: rs.map((r) => `h${r.Id}`), marks: rs.map((_, i) => m[i] ?? null), empty: 'No rows' });
  const all = (justAdded: number[] = []): TableView => {
    const rows = iterations.flat();
    let at = 0;
    const groups = iterations.map((it, k) => {
      const g = { from: at, to: at + it.length - 1, label: k === 0 ? `Anchor (iteration 0): ${it.length} row${it.length === 1 ? '' : 's'}` : `Iteration ${k}: ${it.length} row${it.length === 1 ? '' : 's'}` };
      at += it.length;
      return g;
    }).filter((g) => g.to >= g.from);
    return { id: 'cte', caption: 'EmployeeHierarchy (UNION ALL so far)', columns: cteCols, rows: cteRows(rows), rowIds: rows.map((r) => `c${r.Id}-${r.Level}`), marks: rows.map((r) => (justAdded.includes(r.Id) ? 'write' : null)), groups, empty: 'No rows yet' };
  };
  const push = (tables: TableView[], codeLines: number[], action: SqlStep['action'], narration: string, vars: SqlStep['variables'], iteration: number, predict?: SqlStep['predict']) =>
    steps.push(mkStep({ tables, code: { block: 0, lines: codeLines }, iteration, iterations: iterations.map((x) => x.map((r) => ({ ...r }))), fresh: [...fresh] }, action, narration, vars, c, predict));

  push([empView(es, {}), hView([], -1), all()], [L.with], 'start', 'A recursive CTE runs in two parts: the anchor member runs once; then the recursive member runs again and again, each time joining Employees to only the rows the previous run returned (h). It stops when a run returns no rows, and UNION ALL stacks every run.', {}, -1);

  // anchor member
  const anchor: CteRow[] = [];
  const am: Record<number, Mark> = {};
  for (let i = 0; i < es.length; i++) {
    const e = es[i]!;
    c.comparisons++;
    const ok = e.ManagerId === null;
    am[i] = ok ? 'settled' : 'out';
    if (ok) anchor.push({ Id: e.Id, Name: e.Name, ManagerId: null, Level: 0 });
    push([empView(es, { ...am, [i]: ok ? 'settled' : 'compare' }), hView([], -1), all()], [L.anchorWhere], 'compare', `Anchor: WHERE ManagerId IS NULL for ${e.Name}: ManagerId is ${e.ManagerId ?? 'NULL'}, so ${ok ? `${e.Name} is a top-level employee (Level 0)` : 'not in the anchor'}.`, { 'e.Name': e.Name, ManagerId: e.ManagerId ?? 'NULL' }, 0);
  }
  iterations.push(anchor);
  fresh = anchor.map((r) => r.Id);
  c.writes += anchor.length;
  const nextCount = (prev: CteRow[]) => es.filter((e) => prev.some((h) => e.ManagerId !== null && e.ManagerId === h.Id)).length;
  {
    const o = countOptions(nextCount(anchor));
    push([empView(es, am), hView(anchor, 0), all(fresh)], [L.anchor], 'write', `The anchor returns ${anchor.length} row${anchor.length === 1 ? '' : 's'} with Level 0: ${anchor.map((r) => r.Name).join(', ') || 'none'}. This output becomes h for the first recursive run.`, { iteration: 0, rows: anchor.length }, 0, { question: 'How many rows will the next recursive run return?', options: o.options, answer: o.answer });
  }

  // recursive member
  let prev = anchor;
  let k = 0;
  while (prev.length && k < MAX_RECURSION) {
    k++;
    c.swaps++;
    fresh = [];
    const out: CteRow[] = [];
    push([empView(es, {}), hView(prev, k - 1), all()], [L.union, L.rec], 'call', `Iteration ${k}: run the recursive member with h = the ${prev.length} row${prev.length === 1 ? '' : 's'} from ${k === 1 ? 'the anchor' : `iteration ${k - 1}`}.`, { iteration: k, 'h rows': prev.length }, k);
    const em: Record<number, Mark> = {};
    const notes: Record<number, string> = {};
    for (let i = 0; i < es.length; i++) {
      const e = es[i]!;
      c.comparisons += prev.length;
      const hi = prev.findIndex((h) => e.ManagerId !== null && e.ManagerId === h.Id);
      const h = prev[hi];
      em[i] = h ? 'settled' : 'out';
      if (h) {
        out.push({ Id: e.Id, Name: e.Name, ManagerId: e.ManagerId, Level: h.Level + 1 });
        notes[i] = `→ Level ${h.Level + 1}`;
      }
      push(
        [empView(es, { ...em, [i]: h ? 'settled' : 'compare' }, notes), hView(prev, k - 1, h ? { [hi]: 'settled' } : {}), all()],
        [L.on],
        'compare',
        h ? `ON e.ManagerId = h.Id: ${e.Name}'s manager ${e.ManagerId} is ${h.Name}, who is in h at Level ${h.Level}, so ${e.Name} joins with Level ${h.Level} + 1 = ${h.Level + 1}.` : e.ManagerId === null ? `ON e.ManagerId = h.Id: ${e.Name}'s ManagerId is NULL, and NULL = h.Id is never true, so no match.` : `ON e.ManagerId = h.Id: ${e.Name}'s ManagerId ${e.ManagerId} matches no Id in h (${prev.map((r) => r.Id).join(', ')}).`,
        { iteration: k, 'e.Name': e.Name, 'e.ManagerId': e.ManagerId ?? 'NULL' },
        k,
      );
    }
    if (out.length) {
      iterations.push(out);
      fresh = out.map((r) => r.Id);
      c.writes += out.length;
      const o = countOptions(nextCount(out));
      push([empView(es, em, notes), hView(out, k), all(fresh)], [L.rec], 'write', `Iteration ${k} returns ${out.length} row${out.length === 1 ? '' : 's'}: ${out.map((r) => `${r.Name} (Level ${r.Level})`).join(', ')}. UNION ALL appends them, and they become h for the next run.`, { iteration: k, rows: out.length }, k, { question: 'How many rows will the next recursive run return?', options: o.options, answer: o.answer });
    } else {
      push([empView(es, em), hView([], k), all()], [L.rec], 'branch', `Iteration ${k} returns no rows: nobody reports to anyone in h. Recursion stops here.`, { iteration: k, rows: 0 }, k);
    }
    prev = out;
  }
  fresh = [];
  const total = iterations.flat().length;
  push([empView(es, {}), hView([], -1), all()], [L.final], 'done', `Done: SELECT * FROM EmployeeHierarchy returns ${total} rows from ${iterations.length} pass${iterations.length === 1 ? '' : 'es'} (the anchor and ${iterations.length - 1} recursive iteration${iterations.length - 1 === 1 ? '' : 's'}), plus one final run that returned nothing.` + (es.length > total ? ` ${es.length - total} employee${es.length - total === 1 ? ' is' : 's are'} missing: their ManagerId chain never reaches a top-level employee.` : ''), { rows: total, iterations: iterations.length }, k);
  return steps;
}

/** All rows the CTE returns, in the order of the passes. */
export function recursiveResult(es: readonly CteEmployee[] = CTE_EMPLOYEES): CteRow[] {
  return traceRecursive(es).at(-1)!.state.iterations.flat();
}
