import { describe, expect, it } from 'vitest';
import { avgAsInteger, dialectFindings, groupingFindings, hasTopLevelOrderBy, kindOfType } from '../../../src/scripts/sqlrun/classify';
import { significant, tokenize } from '../../../src/scripts/sqlrun/tokens';

const constructs = (sql: string) => dialectFindings(sql).map((f) => `${f.category}: ${f.construct}`);

describe('runnable SQL: tokens', () => {
  it('tells strings, comments, names and variables apart and keeps line numbers', () => {
    const ts = significant(tokenize("SELECT N'it''s', [Name], @x, #tmp -- note\nFROM \"T\" /* c */ WHERE a <> 1.5"));
    expect(ts.map((t) => t.kind)).toEqual(['word', 'string', 'op', 'bracket', 'op', 'var', 'op', 'temp', 'word', 'dquote', 'word', 'word', 'op', 'number']);
    expect(ts[1]!.national).toBe(true);
    expect(ts.find((t) => t.upper === 'FROM')!.line).toBe(2);
  });
});

describe('runnable SQL: dialect rules', () => {
  it('labels T-SQL-only syntax', () => {
    expect(constructs('SELECT TOP 5 * FROM t')).toContain('tsql-only: TOP');
    expect(constructs('SELECT * FROM t WHERE n = @x')).toContain('tsql-only: @variables');
    expect(constructs('SELECT 1\nGO\nSELECT 2')).toContain('tsql-only: GO');
    expect(constructs('SELECT * FROM dbo.Orders')).toContain('tsql-only: schema names (dbo.)');
    expect(constructs('SELECT * FROM t ORDER BY a OFFSET 10 ROWS FETCH NEXT 5 ROWS ONLY')).toContain('tsql-only: OFFSET … FETCH');
    expect(constructs("SELECT N'x'")).toContain("tsql-only: N'…' strings");
  });

  it('rejects syntax SQL Server does not have', () => {
    expect(dialectFindings('SELECT * FROM t LIMIT 5').some((f) => f.category === 'not-tsql')).toBe(true);
    expect(constructs('SELECT a || b FROM t')).toContain('not-tsql: || string concatenation');
    expect(constructs('SELECT `a` FROM t')).toContain('not-tsql: `backtick` names');
    expect(constructs('INSERT OR REPLACE INTO t VALUES (1)')).toContain('not-tsql: INSERT OR …');
  });

  it('passes plain SQL both dialects share', () => {
    expect(dialectFindings('SELECT c.Name, COUNT(o.Id) AS Orders FROM Customers c LEFT JOIN Orders o ON o.CustomerId = c.Id GROUP BY c.Name ORDER BY Orders DESC')).toEqual([]);
    expect(dialectFindings("SELECT Name FROM Customers WHERE Name LIKE 'A%' AND Id BETWEEN 1 AND 3")).toEqual([]);
  });
});

describe('runnable SQL: grouping, ordering and types', () => {
  it('flags a non-aggregated column outside GROUP BY (SQL Server rejects it; SQLite picks a row)', () => {
    expect(groupingFindings('SELECT CustomerId, COUNT(*) FROM Orders GROUP BY CustomerId')).toEqual([]);
    expect(groupingFindings('SELECT Name, COUNT(*) FROM Orders GROUP BY CustomerId').length).toBeGreaterThan(0);
  });

  it('sees only a top-level ORDER BY', () => {
    expect(hasTopLevelOrderBy('SELECT * FROM t ORDER BY a')).toBe(true);
    expect(hasTopLevelOrderBy('SELECT ROW_NUMBER() OVER (ORDER BY a) AS n FROM t')).toBe(false);
    expect(hasTopLevelOrderBy('SELECT * FROM t')).toBe(false);
  });

  it('rewrites AVG of a column to the integer average SQL Server computes for INT columns', () => {
    expect(avgAsInteger('SELECT AVG(Amount) FROM Orders')).toContain('CAST(AVG(Amount) AS INTEGER)');
    expect(avgAsInteger('SELECT COUNT(*) FROM Orders')).toBeNull();
  });

  it('maps declared types to the kinds the data checks know', () => {
    expect(['INT', 'SMALLINT', 'BIGINT'].map(kindOfType)).toEqual(['int', 'int', 'int']);
    expect(kindOfType('DECIMAL(9,2)')).toBe('decimal');
    expect(kindOfType('NVARCHAR(50)')).toBe('text');
    expect(kindOfType('BIT')).toBe('bit');
    expect(kindOfType('DATE')).toBe('other');
  });
});
