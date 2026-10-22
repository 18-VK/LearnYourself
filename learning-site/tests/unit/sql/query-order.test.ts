import { describe, expect, it } from 'vitest';
import { NOTE } from '../../../src/viz/sql/notes';
import { ALL_STAGES, CORE_STAGES, isExtra, NOTE_QO_DATA, QUERIES, QUERY_ORDER, queryResult, traceQueryOrder } from '../../../src/viz/sql/traces/query-order';
import { expectWellFormed, normRows, noteTable, readNote } from './helpers';

const note = readNote(NOTE.joins);

describe('logical processing order', () => {
  it("is the full list from the note, in the note's order", () => {
    const at = note.indexOf('SQL execution order (logical processing order of a `SELECT`):');
    expect(at).toBeGreaterThan(0);
    const list = note.slice(at).split('\n').slice(2).filter((l) => l.startsWith('- ')).slice(0, ALL_STAGES.length).map((l) => l.slice(2));
    expect(list).toEqual([...ALL_STAGES]);
  });
  it('labels JOIN, WITH CUBE or WITH ROLLUP and DISTINCT as the extras beyond the core eight', () => {
    expect(CORE_STAGES).toEqual(['FROM', 'ON', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'ORDER BY', 'TOP']);
    expect(ALL_STAGES.filter(isExtra)).toEqual(['JOIN', 'WITH CUBE or WITH ROLLUP', 'DISTINCT']);
  });
});

describe('query results', () => {
  it("the LEFT JOIN + WHERE mistake returns the note's table (Carol disappears)", () => {
    expect(normRows(queryResult('where-mistake'))).toEqual(normRows(noteTable(note, '## ❌ The Mistake').rows));
  });
  it('moving the condition into ON keeps Carol with a NULL OrderId', () => {
    expect(normRows(queryResult('on-fix'))).toEqual([['Alice', 101], ['Bob', 103], ['Carol', null]]);
  });
  it('the correct LEFT JOIN without WHERE matches its printed result', () => {
    // same rows as the on-fix query's join before SELECT when the condition is always true
    const t = noteTable(note, '## ✅ Correct LEFT JOIN');
    expect(t.rows.map((r) => r[0])).toEqual(['Alice', 'Alice', 'Bob', 'Carol']);
  });
  it('DISTINCT after INNER JOIN lists each customer with orders once', () => {
    expect(normRows(queryResult('distinct'))).toEqual([[1, 'Alice'], [2, 'Bob']]);
  });
  it('LEFT JOIN + GROUP BY counts orders per customer, 0 for none (COUNT ignores NULL)', () => {
    expect(normRows(queryResult('group-count'))).toEqual([[1, 2], [2, 1], [3, 0], [4, 0]]);
  });
  it("the APPLY subquery for each customer returns the note's OUTER APPLY row", () => {
    const t = noteTable(note, '### OUTER APPLY');
    for (const r of t.rows) {
      const got = normRows(queryResult('apply-inner', { ...NOTE_QO_DATA, applyCustomer: Number(r[0]) }));
      expect(got).toEqual(r[2] === 'NULL' ? [] : [[Number(r[2]), Number(r[3])]]);
    }
  });
});

describe('query order traces', () => {
  it.each(QUERY_ORDER)('%s visits every stage once, in order, and is well formed', (id) => {
    const t = traceQueryOrder(id);
    expectWellFormed(t, QUERIES[id].sql.code.split('\n').length);
    expect(t.map((s) => s.state.stage)).toEqual([-1, ...ALL_STAGES.map((_, i) => i), ALL_STAGES.length]);
    for (const s of t.slice(1, -1)) {
      const stage = s.state.stages[s.state.stage]!;
      const used = Boolean(QUERIES[id].clauses[stage]);
      expect(s.state.used[s.state.stage]).toBe(used);
      if (used) expect(s.state.code.lines).toHaveLength(1);
      else expect(s.narration).toMatch(/not in this query|pass through unchanged/i);
    }
  });
  it('a stage the query does not use leaves the table unchanged', () => {
    for (const id of QUERY_ORDER) {
      const t = traceQueryOrder(id);
      for (let i = 2; i < t.length - 1; i++) {
        const stage = ALL_STAGES[t[i]!.state.stage]!;
        if (QUERIES[id].clauses[stage]) continue;
        const live = (k: number) => t[k]!.state.tables.map((x) => x.rows.filter((_, r) => x.marks?.[r] !== 'removed'));
        expect(live(i)).toEqual(live(i - 1));
      }
    }
  });
  it('asks "how many rows after WHERE" before WHERE runs, and the answer is right', () => {
    const t = traceQueryOrder('where-mistake');
    const where = ALL_STAGES.indexOf('WHERE');
    const pre = t[where]!; // the JOIN step
    expect(pre.predict?.question).toBe('How many rows will be left after WHERE?');
    expect(pre.predict!.options[pre.predict!.answer]).toBe('2');
  });
  it('accepts the placement order as given', () => {
    const t = traceQueryOrder('where-mistake', ['FROM', 'ON', 'JOIN', 'WHERE', 'SELECT', 'NOT A STAGE']);
    expect(t[0]!.state.stages).toEqual(['FROM', 'ON', 'JOIN', 'WHERE', 'SELECT']);
  });
});
