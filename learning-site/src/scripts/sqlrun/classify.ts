/**
 * Static rules for runnable SQL: can a block from a SQL Server note run in SQLite (sql.js) *and* give the result SQL
 * Server would give? This file only looks at the text; scripts/sqlrun/check.ts adds the checks that need the data
 * (it runs every candidate in sql.js at build time).
 *
 * Categories:
 * - `tsql-only`  T-SQL syntax SQLite doesn't have (TOP, APPLY, @variables, GO, [names], + on strings, …). These blocks
 *                get the "T-SQL only" label on the page.
 * - `not-tsql`   syntax SQL Server doesn't accept (LIMIT, ||, NTH_VALUE, PostgreSQL/MySQL types, …): running it in
 *                SQLite would teach something SQL Server rejects.
 * - `typing`     runs in both, but SQLite's looser typing or collation could change the result (DECIMAL arithmetic,
 *                division, implicit conversions, CAST, decimal literals, …).
 * - `unverified` a function this check has not compared between the two dialects.
 *
 * Conservative on purpose: a false "not runnable" costs a Run button, a false "runnable" teaches a wrong result.
 * The same rules run in the browser on edited code, to warn when a learner's query leaves the common ground.
 */
import { matchParen, significant, splitStatements, stringValue, tokenize, type Token } from './tokens';

export type FindingCategory = 'tsql-only' | 'not-tsql' | 'typing' | 'unverified';

export interface Finding {
  category: FindingCategory;
  /** Short name of the construct ("TOP", "@variables", "AVG of a DECIMAL column"). */
  construct: string;
  /** One sentence for the report and the page. */
  detail: string;
  line: number;
}

/** Column kinds that matter for the typing rules. */
export type ColumnKind = 'int' | 'bit' | 'decimal' | 'text' | 'other';
export interface ColumnInfo {
  table: string;
  name: string;
  /** Declared type as written (e.g. `DECIMAL(9,2)`). */
  type: string;
  kind: ColumnKind;
}
export interface Schema {
  columns: ColumnInfo[];
}

/** Declared type → kind, using SQL Server's names. */
export function kindOfType(type: string): ColumnKind {
  const t = type.trim().toUpperCase();
  if (/^(INT|INTEGER|SMALLINT|TINYINT|BIGINT)$/.test(t)) return 'int';
  if (t === 'BIT') return 'bit';
  if (/^(DECIMAL|NUMERIC)\s*\(\s*\d+\s*(,\s*\d+\s*)?\)$/.test(t) || /^(DECIMAL|NUMERIC|MONEY|SMALLMONEY)$/.test(t)) return 'decimal';
  if (/^N?VARCHAR\s*\(\s*\d+\s*\)$/.test(t)) return 'text';
  return 'other';
}

// ── word lists ──────────────────────────────────────────────────────────────────────────────
const KEYWORDS = new Set(
  (
    'SELECT FROM WHERE GROUP BY HAVING ORDER ASC DESC AND OR NOT IN IS NULL LIKE BETWEEN EXISTS CASE WHEN THEN ELSE END AS ON ' +
    'JOIN INNER LEFT RIGHT FULL OUTER CROSS UNION ALL DISTINCT INTERSECT EXCEPT WITH OVER PARTITION ROWS RANGE GROUPS UNBOUNDED ' +
    'PRECEDING FOLLOWING CURRENT ROW INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE PRIMARY KEY FOREIGN REFERENCES DEFAULT ' +
    'UNIQUE CHECK CONSTRAINT INDEX VIEW DROP ALTER ADD COLUMN IF ESCAPE TOP ANY SOME USING NATURAL WINDOW FILTER NO ACTION CASCADE'
  ).split(' '),
);
const AGGREGATES = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STRING_AGG', 'GROUP_CONCAT', 'COUNT_BIG', 'TOTAL']);
/** Functions checked to behave the same in both dialects (for the values these notes use). */
const COMMON_FUNCTIONS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'UPPER', 'LOWER', 'ABS',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'PERCENT_RANK', 'CUME_DIST', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE',
]);
const TSQL_FUNCTIONS = new Set(
  (
    'GETDATE GETUTCDATE SYSDATETIME SYSUTCDATETIME SYSDATETIMEOFFSET CURRENT_TIMESTAMP NEWID NEWSEQUENTIALID RAND LEN DATALENGTH ' +
    'ISNULL IIF CHARINDEX PATINDEX DATEADD DATEDIFF DATEDIFF_BIG DATEPART DATENAME EOMONTH DATEFROMPARTS DATETIMEFROMPARTS YEAR ' +
    'MONTH DAY CONVERT TRY_CONVERT TRY_CAST PARSE TRY_PARSE FORMAT STRING_AGG STRING_SPLIT STUFF CHOOSE SCOPE_IDENTITY ' +
    'IDENT_CURRENT OBJECT_ID OBJECT_NAME DB_ID DB_NAME SCHEMA_NAME SUSER_NAME SUSER_SNAME USER_NAME HOST_NAME APP_NAME ' +
    'ERROR_NUMBER ERROR_MESSAGE ERROR_LINE ERROR_SEVERITY ERROR_STATE ERROR_PROCEDURE XACT_STATE ROWCOUNT_BIG CHECKSUM ' +
    'BINARY_CHECKSUM HASHBYTES COMPRESS DECOMPRESS QUOTENAME REPLICATE SPACE LEFT RIGHT REVERSE SQUARE POWER CEILING FLOOR ' +
    'ROUND PERCENTILE_CONT PERCENTILE_DISC STDEV STDEVP VAR VARP COUNT_BIG GROUPING GROUPING_ID APPROX_COUNT_DISTINCT OPENJSON ' +
    'JSON_VALUE JSON_QUERY ISJSON JSON_MODIFY CONCAT_WS TRANSLATE GREATEST LEAST OPENROWSET OPENQUERY CONTAINS FREETEXT ' +
    'ISNUMERIC ISDATE STR UNICODE NCHAR SOUNDEX DIFFERENCE GENERATE_SERIES DATE_BUCKET DATETRUNC HAS_PERMS_BY_NAME ' +
    'FN_MY_PERMISSIONS IS_MEMBER IS_ROLEMEMBER IS_SRVROLEMEMBER HAS_DBACCESS SUSER_ID USER_ID DATABASEPROPERTYEX SERVERPROPERTY'
  ).split(' '),
);
const OTHER_DIALECT_FUNCTIONS = new Set(
  (
    'IFNULL SUBSTR LENGTH INSTR GROUP_CONCAT STRFTIME DATE DATETIME JULIANDAY UNIXEPOCH PRINTF RANDOM RANDOMBLOB TOTAL ' +
    'TYPEOF LIKELY UNLIKELY CHANGES TOTAL_CHANGES LAST_INSERT_ROWID SQLITE_VERSION ZEROBLOB HEX QUOTE NTH_VALUE NOW ' +
    'DATE_ADD DATE_SUB GEN_RANDOM_UUID UUID CURDATE CURTIME TO_CHAR TO_DATE NVL'
  ).split(' '),
);
/** Words that may be followed by "(" without being a function call. */
const NOT_CALLS = new Set([
  ...KEYWORDS,
  'INT', 'INTEGER', 'SMALLINT', 'TINYINT', 'BIGINT', 'BIT', 'DECIMAL', 'NUMERIC', 'MONEY', 'SMALLMONEY', 'FLOAT', 'REAL',
  'CHAR', 'NCHAR', 'VARCHAR', 'NVARCHAR', 'TEXT', 'NTEXT', 'BINARY', 'VARBINARY', 'DATETIME2', 'DATETIMEOFFSET', 'TIME',
  'CAST', 'TABLE',
]);
const TABLE_HINTS = new Set(['NOLOCK', 'READPAST', 'ROWLOCK', 'HOLDLOCK', 'UPDLOCK', 'TABLOCK', 'TABLOCKX', 'PAGLOCK', 'XLOCK', 'READUNCOMMITTED', 'READCOMMITTED', 'REPEATABLEREAD', 'SERIALIZABLE', 'SNAPSHOT', 'NOEXPAND', 'FORCESEEK', 'FORCESCAN']);
const TSQL_STATEMENTS: Record<string, string> = {
  USE: 'USE (switching databases)',
  DECLARE: 'DECLARE (variables)',
  SET: 'SET (session options and variables)',
  PRINT: 'PRINT',
  EXEC: 'EXEC (stored procedures)',
  EXECUTE: 'EXEC (stored procedures)',
  RAISERROR: 'RAISERROR',
  THROW: 'THROW',
  WAITFOR: 'WAITFOR',
  BACKUP: 'BACKUP',
  RESTORE: 'RESTORE',
  DBCC: 'DBCC',
  GRANT: 'GRANT (permissions)',
  REVOKE: 'REVOKE (permissions)',
  DENY: 'DENY (permissions)',
  BULK: 'BULK INSERT',
  KILL: 'KILL',
  RECONFIGURE: 'RECONFIGURE',
  CHECKPOINT: 'CHECKPOINT',
  SHUTDOWN: 'SHUTDOWN',
  TRUNCATE: 'TRUNCATE TABLE',
  MERGE: 'MERGE',
  GOTO: 'GOTO',
  RETURN: 'RETURN',
  WHILE: 'WHILE loops',
  IF: 'IF … ELSE blocks',
  BEGIN: 'BEGIN … (transactions, TRY…CATCH or blocks)',
  COMMIT: 'transactions (COMMIT)',
  ROLLBACK: 'transactions (ROLLBACK)',
  SAVE: 'transactions (SAVE TRANSACTION)',
  ENABLE: 'ENABLE TRIGGER',
  DISABLE: 'DISABLE TRIGGER',
  OPEN: 'cursors',
  FETCH: 'cursors',
  CLOSE: 'cursors',
  DEALLOCATE: 'cursors',
};
const TSQL_OBJECTS = new Set(['DATABASE', 'LOGIN', 'USER', 'ROLE', 'SCHEMA', 'PROCEDURE', 'PROC', 'FUNCTION', 'TRIGGER', 'TYPE', 'SYNONYM', 'SEQUENCE', 'CLUSTERED', 'NONCLUSTERED', 'COLUMNSTORE', 'FULLTEXT', 'STATISTICS', 'ASSEMBLY', 'CERTIFICATE', 'SERVER', 'AUTHORIZATION', 'APPLICATION', 'PARTITION', 'XML', 'SPATIAL', 'EVENT', 'ENDPOINT', 'MASTER', 'CREDENTIAL', 'AVAILABILITY']);
const OTHER_DIALECT_WORDS: Record<string, string> = {
  LIMIT: 'LIMIT (SQL Server uses TOP or OFFSET … FETCH)',
  GLOB: 'GLOB',
  REGEXP: 'REGEXP',
  AUTOINCREMENT: 'AUTOINCREMENT (SQL Server uses IDENTITY)',
  AUTO_INCREMENT: 'AUTO_INCREMENT (MySQL)',
  PRAGMA: 'PRAGMA',
  VACUUM: 'VACUUM',
  ATTACH: 'ATTACH',
  DETACH: 'DETACH',
  RETURNING: 'RETURNING (SQL Server uses OUTPUT)',
  RECURSIVE: 'WITH RECURSIVE (SQL Server writes just WITH)',
  NOTNULL: 'NOTNULL',
  TRUE: 'TRUE/FALSE literals (SQL Server has no boolean literals)',
  FALSE: 'TRUE/FALSE literals (SQL Server has no boolean literals)',
  SERIAL: 'SERIAL (PostgreSQL)',
  BOOLEAN: 'BOOLEAN (SQL Server uses BIT)',
  INTERVAL: 'INTERVAL (PostgreSQL/MySQL)',
  UUID: 'UUID (PostgreSQL)',
  BLOB: 'BLOB (SQL Server uses VARBINARY)',
  STRICT: 'STRICT tables',
  ROWID: 'rowid',
  ILIKE: 'ILIKE (PostgreSQL)',
};

// ── helpers ─────────────────────────────────────────────────────────────────────────────────
// (plain booleans, not type predicates: `isOp(t, ')')` being false says nothing about whether t is a token)
const isWord = (t: Token | undefined, w?: string): boolean => Boolean(t && t.kind === 'word' && (w === undefined || t.upper === w));
const isOp = (t: Token | undefined, o?: string): boolean => Boolean(t && t.kind === 'op' && (o === undefined || t.text === o));
const isName = (t: Token | undefined): boolean => Boolean(t && ((t.kind === 'word' && !KEYWORDS.has(t.upper)) || t.kind === 'dquote' || t.kind === 'bracket'));
/** An operand ends with this token (so a following + - * / is a binary operator). */
const endsOperand = (t: Token | undefined) =>
  Boolean(t && (t.kind === 'number' || t.kind === 'string' || t.kind === 'dquote' || t.kind === 'bracket' || isOp(t, ')') || (t.kind === 'word' && (!KEYWORDS.has(t.upper) || t.upper === 'NULL' || t.upper === 'END'))));

function lookup(schema: Schema | undefined, name: string): ColumnKind | 'unknown' {
  if (!schema) return 'unknown';
  const kinds = new Set(schema.columns.filter((c) => c.name.toUpperCase() === name.toUpperCase()).map((c) => c.kind));
  return kinds.size === 1 ? [...kinds][0]! : 'unknown';
}

type OperandKind = ColumnKind | 'intlit' | 'declit' | 'strlit' | 'null' | 'expr' | 'unknown';

/** Kind of the operand that ends at index i (walking back over `t.col`). */
function operandBefore(ts: Token[], i: number, schema?: Schema): OperandKind {
  const t = ts[i];
  if (!t) return 'expr';
  if (t.kind === 'number') return /^\d+$/.test(t.text) ? 'intlit' : 'declit';
  if (t.kind === 'string') return 'strlit';
  if (isWord(t, 'NULL')) return 'null';
  if (isName(t)) return t.kind === 'word' ? lookup(schema, t.text) : 'unknown';
  return 'expr';
}
/** Kind of the operand that starts at index i (walking forward over `t.col`). */
function operandAfter(ts: Token[], i: number, schema?: Schema): OperandKind {
  const t = ts[i];
  if (!t) return 'expr';
  if (isOp(t, '-') && ts[i + 1]?.kind === 'number') return /^\d+$/.test(ts[i + 1]!.text) ? 'intlit' : 'declit';
  if (t.kind === 'number') return /^\d+$/.test(t.text) ? 'intlit' : 'declit';
  if (t.kind === 'string') return 'strlit';
  if (isWord(t, 'NULL')) return 'null';
  if (isName(t)) {
    if (isOp(ts[i + 1], '.') && isName(ts[i + 2])) return ts[i + 2]!.kind === 'word' ? lookup(schema, ts[i + 2]!.text) : 'unknown';
    if (isOp(ts[i + 1], '(')) return 'expr';
    return t.kind === 'word' ? lookup(schema, t.text) : 'unknown';
  }
  return 'expr';
}
const isNumberKind = (k: OperandKind) => k === 'int' || k === 'decimal' || k === 'bit' || k === 'intlit' || k === 'declit';
const isTextKind = (k: OperandKind) => k === 'text' || k === 'strlit';

// ── dialect rules (no schema needed) ────────────────────────────────────────────────────────
/** T-SQL-only and not-T-SQL constructs. Used for every block, its setup, and code a learner edits. */
export function dialectFindings(sql: string): Finding[] {
  const all = tokenize(sql);
  const out: Finding[] = [];
  const add = (category: FindingCategory, construct: string, detail: string, line: number) => {
    if (!out.some((f) => f.construct === construct)) out.push({ category, construct, detail, line });
  };
  const tsql = (construct: string, line: number, detail = `${construct} is T-SQL syntax that SQLite doesn't have.`) => add('tsql-only', construct, detail, line);
  const other = (construct: string, line: number, detail = `${construct} is not SQL Server syntax.`) => add('not-tsql', construct, detail, line);

  // GO on a line of its own (a batch separator for SQL Server's tools, not SQL)
  sql.split('\n').forEach((l, i) => {
    if (/^\s*GO\s*(\d+\s*)?(--.*)?$/i.test(l)) tsql('GO', i + 1, 'GO is a batch separator understood by SQL Server tools (SSMS, sqlcmd), not by SQLite.');
  });

  const ts = significant(all);
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]!;
    const prev = ts[i - 1];
    const next = ts[i + 1];
    if (t.kind === 'var') tsql(t.text.startsWith('@@') ? '@@ system functions' : '@variables', t.line, t.text.startsWith('@@') ? `${t.text} is a T-SQL system function.` : `T-SQL variables (${t.text}) don't exist in SQLite.`);
    else if (t.kind === 'temp') tsql('#temp tables', t.line, `${t.text} is a SQL Server temporary table.`);
    else if (t.kind === 'bracket') tsql('[bracketed] names', t.line, `${t.text}: square-bracket names are T-SQL; SQLite reads them differently.`);
    else if (t.kind === 'backtick') other('`backtick` names', t.line, 'Backtick-quoted names are MySQL syntax.');
    else if (t.kind === 'string' && t.national) tsql("N'…' strings", t.line, "N'…' (Unicode string literals) is T-SQL syntax.");
    else if (isOp(t, '||')) other('|| string concatenation', t.line, 'SQL Server joins strings with + or CONCAT(), not ||.');
    else if (isOp(t, '==')) other('==', t.line, 'SQL Server compares with =, not ==.');
    else if (isOp(t, '::')) other(':: casts', t.line, ':: casts are PostgreSQL syntax.');
    else if (isOp(t, '!<') || isOp(t, '!>')) tsql(t.text, t.line);
    else if (t.kind === 'word') {
      const w = t.upper;
      if (w === 'TOP') tsql('TOP', t.line, 'TOP is T-SQL; SQLite limits rows with LIMIT.');
      else if (w === 'APPLY') tsql('CROSS/OUTER APPLY', t.line, 'APPLY is T-SQL; SQLite has no APPLY.');
      else if (w === 'IDENTITY') tsql('IDENTITY', t.line, 'IDENTITY columns are T-SQL (SQLite numbers rows differently).');
      else if (w === 'OUTPUT') tsql('OUTPUT', t.line, 'OUTPUT is T-SQL.');
      else if (w === 'PIVOT' || w === 'UNPIVOT') tsql(w, t.line);
      else if (w === 'COLLATE') tsql('COLLATE', t.line, 'Collation names are specific to SQL Server.');
      else if (w === 'TRY' || w === 'CATCH') tsql('TRY…CATCH', t.line);
      else if (w === 'TRAN' || w === 'TRANSACTION' || w === 'ISOLATION') tsql('transactions', t.line, 'Transactions and isolation levels need SQL Server sessions; the browser has a single connection.');
      else if (w === 'CLUSTERED' || w === 'NONCLUSTERED' || w === 'INCLUDE' || w === 'FILLFACTOR' || w === 'COLUMNSTORE') tsql(`${w === 'NONCLUSTERED' ? 'CLUSTERED' : w} indexes`, t.line, `${w} is SQL Server index syntax.`);
      else if (TABLE_HINTS.has(w) && (isOp(prev, '(') || isOp(prev, ','))) tsql('table hints', t.line, `${w} is a SQL Server table hint.`);
      else if (w === 'WITH' && isOp(next, '(')) tsql('table hints', t.line, 'WITH (…) table hints are T-SQL.');
      else if (w === 'FOR' && (isWord(next, 'XML') || isWord(next, 'JSON') || isWord(next, 'SYSTEM_TIME') || isWord(next, 'BROWSE'))) tsql(`FOR ${next!.upper}`, t.line);
      else if (w === 'OPTION' && isOp(next, '(')) tsql('OPTION (query hints)', t.line);
      else if (w === 'FETCH' && (isWord(next, 'NEXT') || isWord(next, 'FIRST'))) tsql('OFFSET … FETCH', t.line, 'OFFSET … FETCH is T-SQL; SQLite pages with LIMIT … OFFSET.');
      else if (w === 'OFFSET' && isWord(ts[i + 2], 'ROWS')) tsql('OFFSET … FETCH', t.line, 'OFFSET … ROWS is T-SQL; SQLite pages with LIMIT … OFFSET.');
      else if ((w === 'DBO' || w === 'SYS' || w === 'INFORMATION_SCHEMA') && isOp(next, '.')) tsql(w === 'DBO' ? 'schema names (dbo.)' : 'system catalog views', t.line, `${t.text}.… names a SQL Server schema; SQLite has none.`);
      else if (/^(SP|XP)_/.test(w)) tsql('system stored procedures', t.line, `${t.text} is a SQL Server system procedure.`);
      else if (w === 'ISNULL' && !isOp(next, '(')) other('ISNULL (postfix)', t.line);
      else if (OTHER_DIALECT_WORDS[w] && !(w === 'ROWID' && isOp(prev, '.'))) other(OTHER_DIALECT_WORDS[w]!.split(' (')[0]!, t.line, `${OTHER_DIALECT_WORDS[w]} is not SQL Server syntax.`);
      else if (w === 'OR' && isWord(prev, 'INSERT')) other('INSERT OR …', t.line);
      else if (w === 'REPLACE' && isWord(next, 'INTO')) other('REPLACE INTO', t.line);
      else if (w === 'CONFLICT' && isWord(prev, 'ON')) other('ON CONFLICT', t.line);
      else if (w === 'WITHOUT' && isWord(next, 'ROWID')) other('WITHOUT ROWID', t.line);
      else if (w === 'LIKE' && ts[i + 1]?.kind === 'string' && /\[/.test(ts[i + 1]!.text)) tsql('LIKE with [ ] sets', t.line, 'LIKE patterns with [a-z] character sets are T-SQL; SQLite treats [ as a plain character.');
      else if (isOp(next, '(') && !isOp(prev, '.')) {
        if (TSQL_FUNCTIONS.has(w)) tsql(`${w}()`, t.line, `${w}() is a T-SQL function${w === 'STRING_AGG' ? ' (SQLite has one too, but without a guaranteed order)' : ''}.`);
        else if (OTHER_DIALECT_FUNCTIONS.has(w)) other(`${w}()`, t.line, `${w}() is not a SQL Server function.`);
      } else if (w === 'CURRENT_TIMESTAMP' || w === 'CURRENT_DATE' || w === 'CURRENT_TIME') tsql(w, t.line, `${w} reads the clock, so the result changes every run.`);
    }
  }

  // statement-level rules
  for (const stmt of splitStatements(all)) {
    const s = significant(stmt);
    const first = s[0];
    if (!first || first.kind !== 'word') continue;
    const w = first.upper;
    const second = s[1]?.upper ?? '';
    if (TSQL_STATEMENTS[w] && !(w === 'BEGIN' && s.length === 1)) tsql(TSQL_STATEMENTS[w]!, first.line, `${TSQL_STATEMENTS[w]} is T-SQL.`);
    if ((w === 'CREATE' || w === 'ALTER' || w === 'DROP') && (TSQL_OBJECTS.has(second) || (second === 'UNIQUE' && TSQL_OBJECTS.has(s[2]?.upper ?? '')) || (second === 'OR' && isWord(s[2], 'ALTER')))) {
      const obj = second === 'UNIQUE' ? s[2]!.upper : second === 'OR' ? 'OR ALTER' : second;
      tsql(`${w} ${obj}`, first.line, `${w} ${obj} is SQL Server ${/LOGIN|USER|ROLE|SCHEMA|DATABASE|SERVER|AUTHORIZATION/.test(obj) ? 'administration' : 'syntax'}.`);
    }
    if (w === 'ALTER' && second === 'VIEW') tsql('ALTER VIEW', first.line, 'ALTER VIEW is T-SQL (SQLite drops and recreates views).');
    if (w === 'ALTER' && second === 'INDEX') tsql('ALTER INDEX', first.line);
    if (w === 'ALTER' && second === 'TABLE') {
      const words = s.map((x) => x.upper);
      if (words.slice(2).includes('ALTER') && words.includes('COLUMN')) tsql('ALTER COLUMN', first.line, 'ALTER TABLE … ALTER COLUMN is T-SQL; SQLite cannot change a column.');
      else if (words.slice(2).includes('CONSTRAINT') || words.slice(2).includes('NOCHECK')) tsql('ALTER TABLE … CONSTRAINT', first.line, 'SQLite cannot add or drop constraints on an existing table.');
    }
    if (w === 'WITH') {
      // a CTE followed by DELETE/UPDATE/INSERT/MERGE: T-SQL can change rows *through* the CTE
      let depth = 0;
      for (const x of s) {
        if (isOp(x, '(')) depth++;
        else if (isOp(x, ')')) depth--;
        else if (depth === 0 && x.kind === 'word' && /^(DELETE|UPDATE|MERGE)$/.test(x.upper)) {
          tsql('changing rows through a CTE', x.line, `${x.upper} through a common table expression is T-SQL.`);
          break;
        } else if (depth === 0 && isWord(x, 'SELECT')) break;
      }
    }
    // SELECT … INTO new_table, UPDATE … FROM, DELETE alias FROM … JOIN
    let depth = 0;
    let sawSelect = false;
    let sawFrom = false;
    for (const x of s) {
      if (isOp(x, '(')) depth++;
      else if (isOp(x, ')')) depth--;
      if (depth !== 0 || x.kind !== 'word') continue;
      if (x.upper === 'SELECT') sawSelect = true;
      if (x.upper === 'FROM') sawFrom = true;
      if (x.upper === 'INTO' && sawSelect && !sawFrom && w !== 'INSERT') tsql('SELECT … INTO', x.line, 'SELECT … INTO creates a table in T-SQL; SQLite uses CREATE TABLE … AS SELECT.');
      if (x.upper === 'FROM' && w === 'UPDATE') tsql('UPDATE … FROM', x.line, 'UPDATE … FROM with joins follows different rules in SQLite.');
      if (x.upper === 'JOIN' && w === 'DELETE') tsql('DELETE … JOIN', x.line);
    }
  }
  return out;
}

// ── typing rules (schema-aware) ─────────────────────────────────────────────────────────────
export interface TypingOptions {
  /** Setup blocks may contain decimal literals (they go into DECIMAL columns, checked against the data). */
  setup?: boolean;
}

/**
 * Constructs whose result depends on typing or conversions: arithmetic on DECIMAL values, division, + on unknown
 * types, implicit text↔number conversions, CAST, decimal literals, SUM/AVG/MIN/MAX of DECIMAL columns, AVG of
 * anything but a plain INT column, double-quoted names, and unchecked functions.
 */
export function typingFindings(sql: string, schema?: Schema, opts: TypingOptions = {}): Finding[] {
  const out: Finding[] = [];
  for (const stmt of splitStatements(tokenize(sql))) typingOfStatement(significant(stmt), schema, opts, out);
  return out;
}

function typingOfStatement(ts: Token[], schema: Schema | undefined, opts: TypingOptions, out: Finding[]): void {
  // CREATE TABLE is checked against the data it ends up holding (scripts/sqlrun/check.ts), not here
  if (isWord(ts[0], 'CREATE') && isWord(ts[1], 'TABLE')) return;
  // values written by INSERT … VALUES go into typed columns; the data check compares them with the declared types
  const insertValues = isWord(ts[0], 'INSERT') && ts.some((t) => isWord(t, 'VALUES'));
  const add = (construct: string, detail: string, line: number, category: FindingCategory = 'typing') => {
    if (!out.some((f) => f.construct === construct)) out.push({ category, construct, detail, line });
  };
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]!;
    const prev = ts[i - 1];
    const next = ts[i + 1];
    if (t.kind === 'dquote') add('double-quoted names', `${t.text}: when no column has that name, SQLite quietly treats it as a string; SQL Server reports an error.`, t.line);
    if (!opts.setup && !insertValues && t.kind === 'number' && /[.eE]/.test(t.text)) add('decimal literals', `${t.text} is an exact DECIMAL in SQL Server and a floating-point number in SQLite.`, t.line);
    if (isWord(t, 'CAST') && isOp(next, '(')) add('CAST', 'SQL Server and SQLite convert values differently (scale, rounding, text formats).', t.line);
    // function calls nobody has compared between the dialects
    if (t.kind === 'word' && isOp(next, '(') && !isOp(prev, '.') && !NOT_CALLS.has(t.upper) && !COMMON_FUNCTIONS.has(t.upper) && !TSQL_FUNCTIONS.has(t.upper) && !OTHER_DIALECT_FUNCTIONS.has(t.upper)) {
      const close = matchParen(ts, i + 1);
      const isCall = !isWord(ts[close + 1], 'AS') && !isWord(prev, 'TABLE') && !isWord(prev, 'INTO') && !isWord(prev, 'REFERENCES') && !isWord(prev, 'ON') && !isWord(prev, 'VIEW') && !isWord(prev, 'WITH') && !isWord(prev, 'EXISTS');
      if (isCall && lookup(schema, t.text) === 'unknown') add(`${t.upper}()`, `${t.upper}() has not been checked to give the same result in SQL Server and SQLite.`, t.line, 'unverified');
    }
    // aggregates over DECIMAL columns, AVG over anything but an INT column
    if (t.kind === 'word' && (t.upper === 'SUM' || t.upper === 'AVG' || t.upper === 'MIN' || t.upper === 'MAX') && isOp(next, '(')) {
      const close = matchParen(ts, i + 1);
      const args = ts.slice(i + 2, close);
      const kinds = args.filter((a, k) => isName(a) && !isOp(args[k + 1], '.') && !isOp(args[k + 1], '(')).map((a) => (a.kind === 'word' ? lookup(schema, a.text) : 'unknown'));
      if (kinds.includes('decimal')) add(`${t.upper} of a DECIMAL column`, `SQL Server returns ${t.upper}() of a DECIMAL column as an exact DECIMAL with a fixed number of decimals; SQLite computes it in floating point.`, t.line);
      else if (t.upper === 'AVG') {
        const plain = args.filter((a) => !isWord(a, 'DISTINCT') && !isWord(a, 'ALL'));
        const single = (plain.length === 1 && isName(plain[0])) || (plain.length === 3 && isName(plain[0]) && isOp(plain[1], '.') && isName(plain[2]));
        const kind = single ? (plain[plain.length - 1]!.kind === 'word' ? lookup(schema, plain[plain.length - 1]!.text) : 'unknown') : 'expr';
        if (kind !== 'int') add('AVG of an expression', 'AVG() of anything but a plain INT column: SQL Server and SQLite give it different types.', t.line);
      } else {
        // SUM/MIN/MAX of a plain column: its type must be known (a column computed in a CTE or subquery could be DECIMAL)
        const plain = args.filter((a) => !isWord(a, 'DISTINCT') && !isWord(a, 'ALL'));
        const single = (plain.length === 1 && isName(plain[0])) || (plain.length === 3 && isName(plain[0]) && isOp(plain[1], '.') && isName(plain[2]));
        if (single) {
          const col = plain[plain.length - 1]!;
          const kind = col.kind === 'word' ? lookup(schema, col.text) : 'unknown';
          if (kind === 'unknown' || kind === 'other' || (t.upper === 'SUM' && (kind === 'text' || kind === 'bit')))
            add(`${t.upper} of a column of unknown type`, `${t.upper}(${col.text}): this check cannot see the column's type, and SQL Server types the result from it.`, t.line);
        }
      }
    }
    // binary arithmetic
    if (isOp(t) && ['+', '-', '*', '/', '%'].includes(t.text) && endsOperand(prev) && !isOp(prev, '.')) {
      if (t.text === '*' && (isOp(next, ')') || isOp(next, ',') || isWord(next, 'FROM'))) continue; // COUNT(*), SELECT a, *
      const L = operandBefore(ts, i - 1, schema);
      const R = operandAfter(ts, i + 1, schema);
      if (t.text === '+' && (isTextKind(L) || isTextKind(R))) {
        add('+ on strings', 'In T-SQL + joins strings; SQLite turns the strings into numbers and adds them.', t.line, 'tsql-only');
        continue;
      }
      if (L === 'decimal' || R === 'decimal' || L === 'declit' || R === 'declit') {
        add('arithmetic on DECIMAL values', 'SQL Server computes DECIMAL arithmetic exactly, with a result scale; SQLite uses floating point.', t.line);
        continue;
      }
      if (L === 'bit' || R === 'bit') {
        add('arithmetic on BIT values', 'BIT values do not take part in arithmetic the same way in both.', t.line);
        continue;
      }
      const intLike = (k: OperandKind) => k === 'int' || k === 'intlit';
      if (t.text === '/' || t.text === '%') {
        const okRight = R === 'intlit' && Number(ts[i + 1]!.text) !== 0;
        if (!(intLike(L) && okRight)) add('division', 'Division depends on the operand types (integer or decimal) and on how division by zero is handled, which differ between SQL Server and SQLite.', t.line);
        continue;
      }
      if (intLike(L) && intLike(R)) continue;
      // an integer literal and an operand of unknown type (Level + 1): fine unless the data has DECIMAL columns, which a
      // CTE or subquery column could come from
      const noDecimals = Boolean(schema) && !schema!.columns.some((c) => c.kind === 'decimal');
      if ((L === 'intlit' || R === 'intlit') && noDecimals && !isTextKind(L) && !isTextKind(R) && L !== 'other' && R !== 'other') continue;
      add('arithmetic on values of unknown type', `This check cannot tell the types around ${t.text}; in T-SQL + also joins strings.`, t.line);
    }
    // comparisons between text and numbers rely on implicit conversion
    if (isOp(t) && ['=', '<>', '!=', '<', '>', '<=', '>='].includes(t.text)) {
      const L = operandBefore(ts, i - 1, schema);
      const R = operandAfter(ts, i + 1, schema);
      if ((isTextKind(L) && isNumberKind(R)) || (isNumberKind(L) && isTextKind(R))) add('text compared with a number', 'Comparing text with a number relies on an implicit conversion, which SQL Server and SQLite do differently.', t.line);
    }
    if (isWord(t, 'IN') && isOp(next, '(') && !isWord(ts[i + 2], 'SELECT')) {
      const L = operandBefore(ts, i - 1, schema);
      const close = matchParen(ts, i + 1);
      for (const a of ts.slice(i + 2, close)) {
        const k: OperandKind = a.kind === 'number' ? 'intlit' : a.kind === 'string' ? 'strlit' : 'expr';
        if ((isTextKind(L) && isNumberKind(k)) || (isNumberKind(L) && isTextKind(k))) add('text compared with a number', 'IN (…) mixes text and numbers, which relies on an implicit conversion.', t.line);
      }
    }
    // COALESCE / NULLIF mixing text and numbers
    if (t.kind === 'word' && (t.upper === 'COALESCE' || t.upper === 'NULLIF') && isOp(next, '(')) {
      const close = matchParen(ts, i + 1);
      const kinds = new Set<string>();
      let depth = 0;
      for (let k = i + 2; k < close; k++) {
        const a = ts[k]!;
        if (isOp(a, '(')) depth++;
        else if (isOp(a, ')')) depth--;
        if (depth > 0) continue;
        if (isOp(ts[k - 1], ',') || k === i + 2) {
          const kind = operandAfter(ts, k, schema);
          if (isTextKind(kind)) kinds.add('text');
          else if (isNumberKind(kind)) kinds.add('number');
        }
      }
      if (kinds.size > 1) add(`${t.upper} mixing text and numbers`, `${t.upper}() picks its result type differently in SQL Server (type precedence) and SQLite (none).`, t.line);
    }
  }
}

// ── query structure ─────────────────────────────────────────────────────────────────────────
/** True if the statement ends with an ORDER BY at the top level (not inside OVER(…) or a subquery). */
export function hasTopLevelOrderBy(sql: string): boolean {
  const ts = significant(tokenize(sql));
  let depth = 0;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]!;
    if (isOp(t, '(')) depth++;
    else if (isOp(t, ')')) depth--;
    else if (depth === 0 && isWord(t, 'ORDER') && isWord(ts[i + 1], 'BY')) return true;
  }
  return false;
}

interface SelectBlock {
  items: Token[][];
  groupBy: Token[][];
  having: Token[];
  orderBy: Token[][];
  line: number;
}

function splitTop(ts: Token[]): Token[][] {
  const out: Token[][] = [];
  let cur: Token[] = [];
  let depth = 0;
  for (const t of ts) {
    if (isOp(t, '(')) depth++;
    else if (isOp(t, ')')) depth--;
    if (depth === 0 && isOp(t, ',')) {
      out.push(cur);
      cur = [];
    } else cur.push(t);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Every SELECT … in the statement (including subqueries), with its select list and grouping clauses. */
function selectBlocks(ts: Token[]): SelectBlock[] {
  const out: SelectBlock[] = [];
  for (let s = 0; s < ts.length; s++) {
    if (!isWord(ts[s], 'SELECT')) continue;
    // the block runs until its parenthesis closes, a set operator at the same depth, or the end
    let depth = 0;
    let end = ts.length;
    const clauses: Record<string, number> = {};
    for (let i = s + 1; i < ts.length; i++) {
      const t = ts[i]!;
      if (isOp(t, '(')) depth++;
      else if (isOp(t, ')')) {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      } else if (depth === 0 && t.kind === 'word') {
        if (/^(UNION|INTERSECT|EXCEPT)$/.test(t.upper) || (t.upper === 'SELECT' && i > s)) {
          end = i;
          break;
        }
        if (t.upper === 'FROM' && clauses.FROM === undefined) clauses.FROM = i;
        if (t.upper === 'WHERE' && clauses.WHERE === undefined) clauses.WHERE = i;
        if (t.upper === 'GROUP' && isWord(ts[i + 1], 'BY')) clauses.GROUP = i;
        if (t.upper === 'HAVING') clauses.HAVING = i;
        if (t.upper === 'ORDER' && isWord(ts[i + 1], 'BY')) clauses.ORDER = i;
      }
    }
    const bounds = Object.values(clauses).sort((a, b) => a - b);
    const until = (start: number) => bounds.find((b) => b > start) ?? end;
    let listStart = s + 1;
    while (isWord(ts[listStart], 'DISTINCT') || isWord(ts[listStart], 'ALL')) listStart++;
    const listEnd = clauses.FROM ?? until(s);
    out.push({
      items: splitTop(ts.slice(listStart, listEnd)),
      groupBy: clauses.GROUP !== undefined ? splitTop(ts.slice(clauses.GROUP + 2, until(clauses.GROUP + 1))) : [],
      having: clauses.HAVING !== undefined ? ts.slice(clauses.HAVING + 1, until(clauses.HAVING)) : [],
      orderBy: clauses.ORDER !== undefined ? splitTop(ts.slice(clauses.ORDER + 2, until(clauses.ORDER + 1))) : [],
      line: ts[s]!.line,
    });
  }
  return out;
}

/** Column names an expression refers to outside aggregate calls (qualifiers dropped), or null if it has a subquery. */
function bareColumns(expr: Token[]): Set<string> | null {
  const out = new Set<string>();
  for (let i = 0; i < expr.length; i++) {
    const t = expr[i]!;
    if (isWord(t, 'SELECT')) return null;
    if (t.kind === 'word' && AGGREGATES.has(t.upper) && isOp(expr[i + 1], '(')) {
      i = matchParen(expr, i + 1);
      if (isWord(expr[i + 1], 'OVER')) return null; // a window aggregate in a grouped query: not checked
      continue;
    }
    if (isWord(t, 'OVER')) return null;
    if (!isName(t) || isOp(expr[i + 1], '(') || isOp(expr[i + 1], '.')) continue;
    out.add(t.kind === 'word' ? t.upper : t.text.slice(1, -1).toUpperCase());
  }
  return out;
}

function stripAlias(item: Token[]): { expr: Token[]; alias?: string } {
  if (item.length >= 2) {
    const last = item[item.length - 1]!;
    const before = item[item.length - 2]!;
    if (isName(last) && !isOp(before, '.') && !(isOp(before) && !isOp(before, ')'))) {
      const expr = isWord(before, 'AS') ? item.slice(0, -2) : item.slice(0, -1);
      if (expr.length) return { expr, alias: last.upper };
    }
  }
  return { expr: item };
}

/** An aggregate call at this level of the expression (not inside a subquery, not a window aggregate). */
function hasAggregate(expr: Token[]): boolean {
  for (let i = 0; i < expr.length; i++) {
    const t = expr[i]!;
    if (isOp(t, '(') && isWord(expr[i + 1], 'SELECT')) {
      i = matchParen(expr, i);
      continue;
    }
    if (t.kind === 'word' && AGGREGATES.has(t.upper) && isOp(expr[i + 1], '(') && !isWord(expr[matchParen(expr, i + 1) + 1], 'OVER')) return true;
  }
  return false;
}

/**
 * SQL Server rejects a SELECT that groups (GROUP BY or an aggregate) but also lists a column that is neither grouped
 * nor aggregated; SQLite accepts it and picks a value from some row of the group.
 */
export function groupingFindings(sql: string): Finding[] {
  const out: Finding[] = [];
  for (const stmt of splitStatements(tokenize(sql))) {
    for (const b of selectBlocks(significant(stmt))) {
      const items = b.items.map(stripAlias);
      const grouped = b.groupBy.length > 0 || items.some((x) => hasAggregate(x.expr)) || b.having.length > 0;
      if (!grouped) continue;
      const groupCols = new Set<string>();
      const groupExprs = new Set<string>();
      for (const g of b.groupBy) {
        groupExprs.add(g.map((t) => t.upper).join(' '));
        for (const c of bareColumns(g) ?? []) groupCols.add(c);
      }
      const aliases = new Set(items.map((x) => x.alias).filter(Boolean) as string[]);
      const problem = (where: string) =>
        out.push({ category: 'not-tsql', construct: 'ungrouped column', detail: `${where} uses a column that is neither in GROUP BY nor inside an aggregate: SQL Server rejects that, SQLite picks a value from any row.`, line: b.line });
      for (const { expr } of items) {
        if (expr.length === 1 && isOp(expr[0], '*')) {
          problem('SELECT *');
          break;
        }
        if (groupExprs.has(expr.map((t) => t.upper).join(' '))) continue;
        const cols = bareColumns(expr);
        if (cols === null || [...cols].some((c) => !groupCols.has(c))) {
          problem('The select list');
          break;
        }
      }
      const havingCols = bareColumns(b.having);
      if (havingCols === null || [...havingCols].some((c) => !groupCols.has(c) && !aliases.has(c))) problem('HAVING');
      for (const o of b.orderBy) {
        const expr = o.filter((t) => !isWord(t, 'ASC') && !isWord(t, 'DESC'));
        const cols = bareColumns(expr);
        if (cols === null || [...cols].some((c) => !groupCols.has(c) && !aliases.has(c))) {
          if (!(expr.length === 1 && expr[0]!.kind === 'number')) problem('ORDER BY');
        }
      }
    }
  }
  return out.filter((f, i, all) => all.findIndex((g) => g.detail === f.detail) === i);
}

// ── the AVG emulation used by the build check ───────────────────────────────────────────────
/**
 * SQL Server's AVG of an INT column is an INT (the fraction is cut off); SQLite's is a float. The build runs the
 * query a second time with every `AVG(x)` written as `CAST(AVG(x) AS INTEGER)` (what SQL Server computes) and keeps
 * the block only when both runs give the same rows. Returns null when the query has no AVG.
 */
export function avgAsInteger(sql: string): string | null {
  const all = tokenize(sql);
  const sig = all.map((t, i) => ({ t, i })).filter((x) => x.t.kind !== 'ws' && x.t.kind !== 'comment');
  const inserts: { at: number; text: string }[] = [];
  for (let k = 0; k < sig.length; k++) {
    if (!isWord(sig[k]!.t, 'AVG') || !isOp(sig[k + 1]?.t, '(')) continue;
    const close = matchParen(
      sig.map((x) => x.t),
      k + 1,
    );
    // a window AVG(…) OVER (…) must be wrapped after its OVER clause
    let end = close;
    if (isWord(sig[close + 1]?.t, 'OVER') && isOp(sig[close + 2]?.t, '(')) end = matchParen(
      sig.map((x) => x.t),
      close + 2,
    );
    const endTok = sig[end];
    if (!endTok) return null;
    inserts.push({ at: sig[k]!.t.start, text: 'CAST(' }, { at: endTok.t.start + endTok.t.text.length, text: ' AS INTEGER)' });
  }
  if (!inserts.length) return null;
  let out = sql;
  for (const ins of inserts.sort((a, b) => b.at - a.at)) out = out.slice(0, ins.at) + ins.text + out.slice(ins.at);
  return out;
}

/** String literals in the code (the collation check compares them with the data). */
export function stringLiterals(sql: string): string[] {
  return tokenize(sql)
    .filter((t) => t.kind === 'string')
    .map(stringValue);
}

/** All findings for a query block (dialect, typing, grouping), most decisive first. */
export function classify(sql: string, schema?: Schema, opts: TypingOptions = {}): Finding[] {
  const order: FindingCategory[] = ['tsql-only', 'not-tsql', 'typing', 'unverified'];
  const all = [...dialectFindings(sql), ...groupingFindings(sql), ...typingFindings(sql, schema, opts)];
  return all.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}
