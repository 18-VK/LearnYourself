import { describe, expect, it } from 'vitest';
import { NOTE, SQL, WINDOW_EMPLOYEES } from '../../../src/viz/sql/notes';
import { FRAME_ENDS, FRAME_STARTS, rankValues, runningTotalCode, runningTotals, traceRanking, traceRunningTotal, type RankFn } from '../../../src/viz/sql/traces/window';
import { expectWellFormed, normRows, noteTable, readNote, table } from './helpers';

const note = readNote(NOTE.window);
const ALL: RankFn[] = ['ROW_NUMBER', 'RANK', 'DENSE_RANK'];
const ONLY_ROW_NUMBER: RankFn[] = ['ROW_NUMBER'];

describe('window functions (8.SQL_WindowsfunctionsNMore.md)', () => {
  it("uses the note's sample data", () => {
    for (const e of WINDOW_EMPLOYEES) expect(note).toMatch(new RegExp(`\\(${e.Id}, '${e.Name}',\\s+'${e.Department}',\\s+${e.Salary}\\)`));
  });

  it("ROW_NUMBER matches the note's result table", () => {
    const t = noteTable(note, '## ROW_NUMBER()');
    const last = table(traceRanking(ONLY_ROW_NUMBER, false).at(-1)!, 'win');
    expect(normRows(last.rows)).toEqual(normRows(t.rows));
    expect(last.columns).toEqual(t.header);
  });

  it('RANK and DENSE_RANK match the note on ties: 1, 1, 3 and 1, 1, 2', () => {
    expect(note).toContain('ranks e.g. 1, 1, 3');
    expect(note).toContain('consecutive e.g. 1, 1, 2');
    const tied = WINDOW_EMPLOYEES.map((e) => (e.Name === 'Aman' ? { ...e, Salary: 70000 } : e));
    const v = rankValues(tied);
    expect(v.slice(0, 3).map((x) => x.RANK)).toEqual([1, 1, 3]);
    expect(v.slice(0, 3).map((x) => x.DENSE_RANK)).toEqual([1, 1, 2]);
    expect(v.map((x) => x.ROW_NUMBER)).toEqual([1, 2, 3, 4, 5]);
  });

  it('the three functions agree on the untied sample data', () => {
    for (const v of rankValues(WINDOW_EMPLOYEES)) expect([v.RANK, v.DENSE_RANK]).toEqual([v.ROW_NUMBER, v.ROW_NUMBER]);
  });

  it('PARTITION BY Department restarts ROW_NUMBER in each department', () => {
    const v = rankValues(WINDOW_EMPLOYEES, true);
    expect(v.map((x) => [x.e.Name, x.ROW_NUMBER])).toEqual([
      ['Aman', 1],
      ['Rahul', 2],
      ['Neha', 1],
      ['Priya', 2],
      ['Karan', 1],
    ]);
    const t = traceRanking(ALL, true);
    expect(table(t.at(-1)!, 'win').columns).toEqual(['Name', 'Department', 'Salary', 'DeptRank']);
    expectWellFormed(t, SQL.deptRank.code.split('\n').length);
  });

  it('ranking traces are well formed and predict correctly', () => {
    const t = traceRanking(ALL, false);
    expectWellFormed(t, Math.max(SQL.rowNumber.code.split('\n').length, SQL.rank.code.split('\n').length));
    const answers = t.filter((s) => s.predict).map((s) => Number(s.predict!.options[s.predict!.answer]));
    expect(answers).toEqual(rankValues(WINDOW_EMPLOYEES).map((v) => v.RANK));
  });

  it('the running total is all previous rows plus the current row (the note)', () => {
    const r = runningTotals(WINDOW_EMPLOYEES);
    expect(r.map((x) => x.total)).toEqual([70000, 130000, 180000, 225000, 265000]);
    expect(r.map((x) => x.e.Name)).toEqual(['Karan', 'Aman', 'Rahul', 'Neha', 'Priya']);
    expect(runningTotalCode({ start: 'UNBOUNDED PRECEDING', end: 'CURRENT ROW' }, false)).toEqual({ code: SQL.runningTotal.code, fromNote: true });
    expectWellFormed(traceRunningTotal(), SQL.runningTotal.code.split('\n').length);
  });

  it('every frame sums exactly the rows between its bounds inside the partition', () => {
    for (const start of FRAME_STARTS)
      for (const end of FRAME_ENDS)
        for (const part of [false, true]) {
          const r = runningTotals(WINDOW_EMPLOYEES, { start, end }, part);
          const t = traceRunningTotal({ start, end }, part);
          const { code } = runningTotalCode({ start, end }, part);
          expect(code).toContain(`ROWS BETWEEN ${start} AND ${end}`);
          expectWellFormed(t, code.split('\n').length);
          const last = table(t.at(-1)!, 'win');
          expect(last.rows.map((row) => row.at(-1))).toEqual(r.map((x) => x.total));
          if (start === 'UNBOUNDED PRECEDING' && end === 'UNBOUNDED FOLLOWING' && !part) for (const x of r) expect(x.total).toBe(265000);
        }
  });
});
