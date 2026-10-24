import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { decide } from '../../../scripts/sqlrun/check';
import { formatValue, runScript, scaleOf } from '../../../src/scripts/sqlrun/engine';

const SETUP = `CREATE TABLE Orders (Id INT PRIMARY KEY, Customer VARCHAR(20), Amount DECIMAL(9,2));
INSERT INTO Orders VALUES (1, 'Ann', 100), (2, 'Bo', 2.5), (3, 'Ann', 40);`;

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

describe('runnable SQL: the engine (shared by the build check and the browser)', () => {
  it('formats values as SQL Server shows them', () => {
    expect(scaleOf('DECIMAL(9,2)')).toBe(2);
    expect(scaleOf('NUMERIC(5)')).toBe(0);
    expect(scaleOf('MONEY')).toBe(4);
    expect(scaleOf('INT')).toBeNull();
    expect(formatValue(100, 'DECIMAL(9,2)')).toBe('100.00');
    expect(formatValue(2.5, '')).toBe('2.5');
    expect(formatValue(null)).toBeNull();
    expect(formatValue(new Uint8Array([1, 255]))).toBe('0x01FF');
  });

  it('runs the setup and then the code in a fresh database, with declared decimals applied', () => {
    const r = runScript(SQL, SETUP, 'SELECT Id, Amount FROM Orders ORDER BY Id;');
    expect(r.error).toBeUndefined();
    expect(r.statements).toHaveLength(1);
    const t = r.statements[0]!.table!;
    expect(t.columns).toEqual(['Id', 'Amount']);
    expect(t.rows).toEqual([
      ['1', '100.00'],
      ['2', '2.50'],
      ['3', '40.00'],
    ]);
    expect(t.total).toBe(3);
  });

  it('reports errors with the phase and the line of the failing statement', () => {
    const r = runScript(SQL, SETUP, '-- a comment\nSELECT 1 AS x;\n\nSELECT * FROM Nope;');
    expect(r.statements).toHaveLength(1);
    expect(r.error).toMatchObject({ phase: 'code', line: 4 });
    expect(r.error!.message).toMatch(/no such table: Nope/);
    expect(runScript(SQL, 'CREATE TABLE', 'SELECT 1').error?.phase).toBe('setup');
  });

  it('counts changed rows, truncates long results, and can reverse the stored row order', () => {
    const r = runScript(SQL, SETUP, "UPDATE Orders SET Amount = 0 WHERE Customer = 'Ann'; SELECT Id FROM Orders;", { maxRows: 2 });
    expect(r.statements[0]).toMatchObject({ kind: 'changes', changes: 2 });
    expect(r.statements[1]!.table).toMatchObject({ total: 3, truncated: true });
    expect(r.statements[1]!.table!.rows).toHaveLength(2);
    // (a column without an index: `SELECT Id` would read the primary key's index, which is always in key order)
    const reversed = runScript(SQL, SETUP, 'SELECT Amount FROM Orders;', { reverseBeforeFirstQuery: true });
    expect(reversed.statements[0]!.table!.rows).toEqual([['40.00'], ['2.50'], ['100.00']]);
  });
});

describe('runnable SQL: the build decision for one block', () => {
  const d = (code: string, forcedOff?: string) => decide(SQL, { code, setupCode: SETUP, forcedOff });

  it('runs plain queries on the sample data and records their rows', () => {
    const r = d('SELECT Customer, COUNT(*) AS Orders FROM Orders GROUP BY Customer ORDER BY Customer;');
    expect(r.category).toBe('runnable');
    expect(r.expected![0]).toMatchObject({ kind: 'rows', columns: ['Customer', 'Orders'], total: 2 });
    expect(r.expected![0]!.rows).toEqual([
      ['Ann', '2'],
      ['Bo', '1'],
    ]);
    // arithmetic on a DECIMAL column is where SQLite's typing can differ: kept off the Run button on purpose
    expect(d('SELECT SUM(Amount) FROM Orders;').category).toBe('typing');
  });

  it('notes when SQL Server may order the rows differently', () => {
    expect(d('SELECT Id FROM Orders;').expected![0]!.order).toBe('none');
    expect(d('SELECT Id FROM Orders ORDER BY Id;').expected![0]!.order).toBeUndefined();
    // the two Ann rows tie on Customer: the rows are the same, their order is not guaranteed
    expect(d('SELECT Id FROM Orders ORDER BY Customer;').expected![0]!.order).toBe('ties');
  });

  it('keeps T-SQL-only, missing-data and resultless blocks off the Run button', () => {
    expect(d('SELECT TOP 1 * FROM Orders;')).toMatchObject({ category: 'tsql-only', construct: 'TOP' });
    expect(d('SELECT * FROM Orders LIMIT 1;').category).toBe('not-tsql');
    expect(d('SELECT * FROM Customers;')).toMatchObject({ category: 'no-data' });
    expect(d('UPDATE Orders SET Amount = 1;').category).toBe('no-result');
    expect(d('SELECT * FROM Orders;', 'prints differently').category).toBe('forced-off');
    expect(d('SELEC 1;').category).toBe('syntax');
  });
});
