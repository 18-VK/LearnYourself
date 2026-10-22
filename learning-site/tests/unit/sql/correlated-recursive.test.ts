import { describe, expect, it } from 'vitest';
import { CTE_EMPLOYEES, NOTE, SUBQUERY_EMPLOYEES } from '../../../src/viz/sql/notes';
import { avg, CORRELATED_CODE, traceCorrelated } from '../../../src/viz/sql/traces/correlated';
import { recursiveResult, RECURSIVE_CODE, traceRecursive } from '../../../src/viz/sql/traces/recursive';
import { expectWellFormed, normRows, noteTable, readNote, table } from './helpers';

const subq = readNote(NOTE.subqueries);
const cte = readNote(NOTE.cte);

describe('correlated subquery (5.SQL_Subqueries.md)', () => {
  it("uses the note's sample Employees", () => {
    for (const e of SUBQUERY_EMPLOYEES) expect(subq).toContain(`(${e.Id}, '${e.Name}', ${e.Salary}, ${e.DepartmentId})`);
  });
  it("returns the note's Final Result (Aman, Neha)", () => {
    const t = noteTable(subq, '## Correlated Subquery');
    expect(normRows(table(traceCorrelated().at(-1)!, 'result').rows)).toEqual(normRows(t.rows));
  });
  it("computes the note's department averages: 55000, 42500, 70000", () => {
    const avgs = traceCorrelated().filter((s) => s.action === 'read').map((s) => s.variables['AVG(Salary)']);
    expect(avgs).toEqual(['55000', '55000', '42500', '42500', '70000']);
    expect(subq).toContain('Average = 55000');
    expect(subq).toContain('Average = 42500');
    expect(subq).toContain('Average = 70000');
  });
  it('runs the inner query once per outer row and reads every row each time', () => {
    const t = traceCorrelated();
    expectWellFormed(t, CORRELATED_CODE.split('\n').length);
    const end = t.at(-1)!.counters;
    expect(end.swaps).toBe(5);
    expect(end.comparisons).toBe(25);
  });
  it('agrees with a direct evaluation on edited data', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let k = 0; k < 200; k++) {
      const es = SUBQUERY_EMPLOYEES.map((e) => ({ ...e, Salary: 1000 * Math.floor(rnd() * 80), DepartmentId: 1 + Math.floor(rnd() * 3) }));
      const want = es.filter((e) => e.Salary > avg(es.filter((x) => x.DepartmentId === e.DepartmentId).map((x) => x.Salary))).map((e) => [e.Id, e.Name, e.Salary, e.DepartmentId]);
      expect(table(traceCorrelated(es).at(-1)!, 'result').rows).toEqual(want);
    }
  });
  it('predicts each employee correctly', () => {
    const answers = traceCorrelated().filter((s) => s.predict).map((s) => s.predict!.options[s.predict!.answer]);
    expect(answers).toEqual(['Yes', 'No', 'No', 'Yes', 'No']);
  });
});

describe('recursive CTE (9.SQL_CTE.md)', () => {
  it("uses the note's sample Employees", () => {
    for (const e of CTE_EMPLOYEES) expect(cte).toContain(`(${e.Id}, '${e.Name}',`);
    expect(cte).toContain("(5, 'Riya',   'HR',      42000, 4),");
  });
  it('anchor = top-level employees, iteration 1 = their reports, iteration 2 is empty', () => {
    const t = traceRecursive();
    expectWellFormed(t, RECURSIVE_CODE.split('\n').length);
    const its = t.at(-1)!.state.iterations;
    expect(its.map((it) => it.map((r) => r.Name))).toEqual([['Aman', 'Neha', 'Karan'], ['Rahul', 'Priya', 'Riya']]);
    expect(its.flat().map((r) => r.Level)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(t.some((s) => s.action === 'branch' && /no rows/.test(s.narration))).toBe(true);
    expect(t.at(-1)!.counters.swaps).toBe(2); // two recursive runs, the second returns nothing
  });
  it('each iteration only joins with the previous iteration (h), never with older rows', () => {
    const t = traceRecursive();
    for (const s of t.filter((x) => x.action === 'compare' && x.state.iteration > 0)) {
      const h = table(s, 'h');
      const prev = s.state.iterations[s.state.iteration - 1]!;
      expect(h.rows.map((r) => r[0])).toEqual(prev.map((r) => r.Id));
    }
  });
  it('level = length of the manager chain; employees whose chain never reaches the top are missing', () => {
    const chains = [
      [null, 1, 2, 3, 4, 5],
      [null, 1, 1, 2, 2, 3],
      [2, 1, null, 3, 4, 5], // 1 and 2 manage each other: unreachable
      [null, null, null, null, null, null],
    ];
    for (const ms of chains) {
      const es = CTE_EMPLOYEES.map((e, i) => ({ ...e, ManagerId: ms[i]! }));
      const depth = (id: number, seen = new Set<number>()): number | null => {
        const e = es.find((x) => x.Id === id)!;
        if (e.ManagerId === null) return 0;
        if (seen.has(id)) return null;
        seen.add(id);
        const d = depth(e.ManagerId, seen);
        return d === null ? null : d + 1;
      };
      const got = recursiveResult(es);
      const want = es.map((e) => ({ id: e.Id, d: depth(e.Id) })).filter((x) => x.d !== null);
      expect(got.map((r) => [r.Id, r.Level]).sort((a, b) => a[0]! - b[0]!)).toEqual(want.map((x) => [x.id, x.d]));
    }
  });
});
