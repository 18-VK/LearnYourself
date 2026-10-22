import { describe, expect, it } from 'vitest';
import { CUSTOMERS, NOTE, ORDERS, SELF_EMPLOYEES, SQL } from '../../../src/viz/sql/notes';
import { finalResult, JOIN_KINDS, JOIN_SQL, NOTE_JOIN_DATA, traceJoin, type JoinData, type JoinKind } from '../../../src/viz/sql/traces/joins';
import { expectWellFormed, normRows, noteTable, readNote, table } from './helpers';

const note = readNote(NOTE.joins);
const result = (k: JoinKind, d?: JoinData) => normRows(finalResult(traceJoin(k, d)).rows);

describe('joins note sample data', () => {
  it('matches the printed Customers and Orders tables', () => {
    expect(normRows(noteTable(note, '**Customers:**').rows)).toEqual(CUSTOMERS.map((c) => [c.CustomerId, c.Name]));
    expect(normRows(noteTable(note, '**Orders:**').rows)).toEqual(ORDERS.map((o) => [o.OrderId, o.CustomerId, o.Amount]));
  });
  it("matches the note's INSERT statements, including the orphan CustomerId = 4", () => {
    expect(note).toContain("INSERT INTO Customers VALUES (1,'Alice'), (2,'Bob'), (3,'Carol');");
    for (const o of ORDERS) expect(note).toContain(` (${o.OrderId}, ${o.CustomerId}, ${o.Amount.toFixed(2)})`);
    expect(note).toContain('(104, 4, 60.00);  -- Note: CustomerId=4 has no matching customer');
    expect(note).toContain("INSERT INTO Employees VALUES (1,'John',NULL),(2,'Sarah',1),(3,'Mike',1),(4,'Anna',2);");
    expect(SELF_EMPLOYEES.map((e) => [e.EmpId, e.Name, e.ManagerId])).toEqual([[1, 'John', null], [2, 'Sarah', 1], [3, 'Mike', 1], [4, 'Anna', 2]]);
  });
  it('shows each join with the exact query from its section of the note', () => {
    const blocks = note;
    for (const k of JOIN_KINDS) expect(blocks).toContain(JOIN_SQL[k]);
  });
});

describe("join results equal the note's result tables", () => {
  it.each([
    ['inner', '## INNER JOIN (most common)'],
    ['left', '## LEFT (LEFT OUTER) JOIN'],
    ['right', '## RIGHT JOIN'],
    ['full', '## FULL OUTER JOIN'],
    ['self', '## SELF JOIN (join a table to itself)'],
    ['outer-apply', '### OUTER APPLY'],
    ['cross-apply', '### CROSS APPLY'],
  ] as const)('%s', (kind, heading) => {
    const t = noteTable(note, heading);
    expect(finalResult(traceJoin(kind)).columns).toEqual(t.header);
    expect(result(kind)).toEqual(normRows(t.rows));
  });

  it('cross join: the note prints 4 columns but the query selects c.Name and o.OrderId; those columns match', () => {
    const t = noteTable(note, '## CROSS JOIN (Cartesian product)');
    expect(t.header).toEqual(['CustomerId', 'Name', 'OrderId', 'Amount']);
    expect(SQL.cross.code.startsWith('SELECT c.Name, o.OrderId')).toBe(true);
    expect(finalResult(traceJoin('cross')).columns).toEqual(['Name', 'OrderId']);
    expect(result('cross')).toEqual(normRows(t.rows.map((r) => [r[1]!, r[2]!])));
    expect(result('cross')).toHaveLength(CUSTOMERS.length * ORDERS.length);
  });

  it('both anti-joins return Carol (CustomerId 3), as the note says', () => {
    expect(note).toContain('**Result:** Carol (CustomerId 3).');
    expect(result('anti')).toEqual([[3, 'Carol']]);
    expect(result('anti-exists')).toEqual([[3, 'Carol']]);
  });
});

describe('join traces', () => {
  it.each(JOIN_KINDS)('%s is well formed', (kind) => {
    expectWellFormed(traceJoin(kind), JOIN_SQL[kind].split('\n').length);
  });

  it.each(JOIN_KINDS)('%s adds result rows only on write steps, one at a time', (kind) => {
    const t = traceJoin(kind);
    let prev = 0;
    for (const s of t) {
      const n = table(s, 'result').rows.length;
      if (s.action === 'write') expect(n).toBe(prev + 1);
      else expect(n).toBe(prev);
      expect(s.counters.writes).toBe(n);
      prev = n;
    }
  });

  it('checks the ON condition once per customer and order pair for INNER, LEFT, RIGHT and FULL', () => {
    for (const k of ['inner', 'left', 'right', 'full'] as const) expect(traceJoin(k).at(-1)!.counters.comparisons).toBe(12);
  });

  it('NOT EXISTS stops at the first matching order: 1 + 3 + 4 checks', () => {
    expect(traceJoin('anti-exists').at(-1)!.counters.comparisons).toBe(8);
  });

  it('LEFT JOIN + IS NULL: 12 ON checks, then one WHERE check per joined row', () => {
    expect(traceJoin('anti').at(-1)!.counters.comparisons).toBe(12 + 4);
  });

  it("predicts each customer's row count correctly (LEFT JOIN: 2, 1, 1; INNER JOIN: 2, 1, 0)", () => {
    const answers = (k: JoinKind) => traceJoin(k).filter((s) => s.predict && s.action === 'select').map((s) => s.predict!.options[s.predict!.answer]);
    expect(answers('left')).toEqual(['2', '1', '1']);
    expect(answers('inner')).toEqual(['2', '1', '0']);
    expect(answers('cross')).toEqual(['4', '4', '4']);
  });

  it('shows NULL-filled columns for unmatched rows, never empty strings', () => {
    const full = finalResult(traceJoin('full'));
    expect(full.rows.filter((r) => r.includes(null))).toEqual([[3, 'Carol', null, null], [null, null, 104, 60]]);
  });

  it('highlights the ON line while comparing and the SELECT line while adding a row', () => {
    const t = traceJoin('left');
    const on = JOIN_SQL.left.split('\n').findIndex((l) => l.includes('ON c.CustomerId')) + 1;
    for (const s of t) if (s.action === 'compare') expect(s.state.code.lines).toEqual([on]);
  });
});

/** Every assignment of CustomerId 1–5 to the four orders (625 inputs). */
function* allOrderAssignments(): Generator<JoinData> {
  for (let n = 0; n < 5 ** 4; n++) {
    const ids = [0, 1, 2, 3].map((k) => (Math.floor(n / 5 ** k) % 5) + 1);
    yield { ...NOTE_JOIN_DATA, orders: ORDERS.map((o, k) => ({ ...o, CustomerId: ids[k]! })) };
  }
}

describe('joins on edited data agree with set definitions', () => {
  it('INNER ⊆ LEFT/RIGHT ⊆ FULL, anti-joins agree, APPLY keeps the latest order', () => {
    for (const d of allOrderAssignments()) {
      const pairs = d.customers.flatMap((c) => d.orders.filter((o) => o.CustomerId === c.CustomerId).map((o) => [c.CustomerId, c.Name, o.OrderId, o.Amount]));
      const lonelyC = d.customers.filter((c) => !d.orders.some((o) => o.CustomerId === c.CustomerId));
      const lonelyO = d.orders.filter((o) => !d.customers.some((c) => c.CustomerId === o.CustomerId));
      expect(result('inner', d)).toEqual(pairs);
      const left = result('left', d);
      expect(left).toHaveLength(pairs.length + lonelyC.length);
      expect(new Set(left.map((r) => r[0])).size).toBe(d.customers.length);
      const right = result('right', d);
      expect(right).toHaveLength(pairs.length + lonelyO.length);
      expect(right.map((r) => r[2])).toEqual(d.orders.flatMap((o) => Array<number>(Math.max(1, d.customers.filter((c) => c.CustomerId === o.CustomerId).length)).fill(o.OrderId)));
      expect(result('full', d)).toHaveLength(pairs.length + lonelyC.length + lonelyO.length);
      expect(result('anti', d)).toEqual(lonelyC.map((c) => [c.CustomerId, c.Name]));
      expect(result('anti-exists', d)).toEqual(lonelyC.map((c) => [c.CustomerId, c.Name]));
      const outer = result('outer-apply', d);
      expect(outer).toHaveLength(d.customers.length);
      for (const r of outer) {
        const mine = d.orders.filter((o) => o.CustomerId === r[0]).map((o) => o.OrderId);
        expect(r[2]).toBe(mine.length ? Math.max(...mine) : null);
      }
      expect(result('cross-apply', d)).toEqual(outer.filter((r) => r[2] !== null));
    }
  });

  it('SELF JOIN keeps every employee and finds the manager by EmpId (NULL never matches)', () => {
    for (let n = 0; n < 5 ** 4; n++) {
      const emps = SELF_EMPLOYEES.map((e, k) => {
        const v = Math.floor(n / 5 ** k) % 5;
        return { ...e, ManagerId: v === 0 ? null : v };
      });
      const r = result('self', { ...NOTE_JOIN_DATA, employees: emps });
      expect(r).toEqual(emps.map((e) => [e.Name, emps.find((m) => e.ManagerId !== null && m.EmpId === e.ManagerId)?.Name ?? null]));
    }
  });
});
