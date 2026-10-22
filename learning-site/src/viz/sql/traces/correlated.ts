import { lines } from '../../engine/code';
import type { Counters } from '../../engine/types';
import { mkStep, ZERO, type Mark, type SqlStage, type SqlStep, type TableView } from '../model';
import { SQL, SUBQUERY_EMPLOYEES, type DeptEmployee } from '../notes';

/**
 * 5.SQL_Subqueries.md › Correlated Subquery: the inner query runs again for every outer row, with
 * e.DepartmentId set to that row's department. Counters: comparisons = inner WHERE checks,
 * reads = rows the inner queries read, swaps = inner query runs, writes = result rows.
 */
export const CORRELATED_CODE = SQL.correlated.code;
const L = lines(CORRELATED_CODE, {
  select: 'SELECT *',
  from: 'FROM Employees e',
  where: 'WHERE Salary > (',
  avg: 'SELECT AVG(Salary)',
  innerFrom: '    FROM Employees',
  innerWhere: 'WHERE DepartmentId = e.DepartmentId',
});

export type CorrelatedTrace = SqlStep<SqlStage>[];

const COLS = ['Id', 'Name', 'Salary', 'DepartmentId'];
const rowsOf = (es: readonly DeptEmployee[]) => es.map((e) => [e.Id, e.Name, e.Salary, e.DepartmentId]);
const marks = (n: number, m: Record<number, Mark>) => Array.from({ length: n }, (_, i) => m[i] ?? null);
/** AVG over DECIMAL(10,2) values, shown with up to two decimals. */
export const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
const money = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

export function traceCorrelated(es: readonly DeptEmployee[] = SUBQUERY_EMPLOYEES): CorrelatedTrace {
  const steps: CorrelatedTrace = [];
  const c: Counters = { ...ZERO };
  const result: (string | number)[][] = [];
  const outer = (m: Record<number, Mark>): TableView => ({ id: 'outer', caption: 'Employees e (outer query)', columns: COLS, rows: rowsOf(es), rowIds: es.map((e) => `e${e.Id}`), marks: marks(es.length, m) });
  const inner = (m: Record<number, Mark>, run: string): TableView => ({ id: 'inner', caption: `Employees (inner query${run})`, columns: COLS, rows: rowsOf(es), rowIds: es.map((e) => `i${e.Id}`), marks: marks(es.length, m) });
  const res = (justAdded: boolean): TableView => ({ id: 'result', caption: 'Result', columns: COLS, rows: result.map((r) => [...r]), rowIds: result.map((r) => `r${r[0]}`), marks: result.map((_, i) => (justAdded && i === result.length - 1 ? 'write' : null)), empty: 'No rows yet' });
  const push = (tables: TableView[], codeLines: number[], action: SqlStep['action'], narration: string, vars: SqlStep['variables'], predict?: SqlStep['predict']) =>
    steps.push(mkStep({ tables, code: { block: 0, lines: codeLines } }, action, narration, vars, c, predict));

  push([outer({}), inner({}, ''), res(false)], [L.from, L.where], 'start', 'The inner query depends on the outer row: it uses e.DepartmentId. So it runs once per employee, each time for that employee\'s department.', {});
  const seenDept = new Map<number, number>();
  for (let i = 0; i < es.length; i++) {
    const e = es[i]!;
    c.reads++;
    const dept = es.filter((x) => x.DepartmentId === e.DepartmentId).map((x) => x.Salary);
    const a = avg(dept);
    const keep = e.Salary > a;
    push([outer({ [i]: 'active' }), inner({}, ''), res(false)], [L.from], 'select', `Take ${e.Name} (Salary ${e.Salary}, DepartmentId ${e.DepartmentId}). Run the inner query with e.DepartmentId = ${e.DepartmentId}.`, { 'e.Name': e.Name, 'e.DepartmentId': e.DepartmentId, 'e.Salary': e.Salary }, { question: `Will ${e.Name} be in the result?`, options: ['Yes', 'No'], answer: keep ? 0 : 1 });
    c.swaps++;
    const run = ` run ${c.swaps}, DepartmentId = ${e.DepartmentId}`;
    const hit: Record<number, Mark> = {};
    for (let j = 0; j < es.length; j++) {
      const x = es[j]!;
      c.reads++;
      c.comparisons++;
      const m = x.DepartmentId === e.DepartmentId;
      if (m) hit[j] = 'settled';
      push([outer({ [i]: 'active' }), inner({ ...hit, [j]: m ? 'settled' : 'compare' }, run), res(false)], [L.innerWhere], 'compare', `Inner WHERE DepartmentId = e.DepartmentId: ${x.Name}'s ${x.DepartmentId} = ${e.DepartmentId} is ${m ? 'true' : 'false'}.`, { 'e.DepartmentId': e.DepartmentId, Name: x.Name, DepartmentId: x.DepartmentId });
    }
    const again = seenDept.get(e.DepartmentId);
    seenDept.set(e.DepartmentId, (again ?? 0) + 1);
    push([outer({ [i]: 'active' }), inner(hit, run), res(false)], [L.avg], 'read', `AVG(Salary) for DepartmentId ${e.DepartmentId}: (${dept.join(' + ')}) / ${dept.length} = ${money(a)}.` + (again ? ` The same average was already computed for an earlier employee; the correlated subquery computes it again.` : ''), { 'e.DepartmentId': e.DepartmentId, 'AVG(Salary)': money(a) });
    if (keep) result.push([e.Id, e.Name, e.Salary, e.DepartmentId]);
    if (keep) c.writes++;
    push([outer({ [i]: keep ? 'settled' : 'removed' }), inner({}, ''), res(keep)], [L.where], keep ? 'write' : 'branch', `Salary > ${money(a)}: ${e.Salary} > ${money(a)} is ${keep ? `true, so ${e.Name} is returned` : `false, so ${e.Name} is not returned`}.`, { 'e.Salary': e.Salary, 'AVG(Salary)': money(a) });
  }
  const depts = new Set(es.map((e) => e.DepartmentId)).size;
  push([outer({}), inner({}, ''), res(false)], [L.select], 'done', `Done: ${result.length} row${result.length === 1 ? '' : 's'}. The inner query ran ${c.swaps} times and read ${c.reads - es.length} rows to produce ${depts} different department averages. The JOIN version in the CTE lesson computes each average once.`, {});
  return steps;
}
