/**
 * Runs SQL in sql.js (SQLite compiled to WebAssembly) and formats the results. Shared by the build-time check
 * (scripts/sqlrun/check.ts, in Node) and the browser runner (src/scripts/sqlrun/worker.ts), so "Expected output" and
 * a learner's run come from the same engine and the same formatting.
 *
 * Every run starts from an empty in-memory database: the lesson's setup (its own CREATE TABLE / INSERT blocks), then
 * the code. Foreign keys are enforced, as SQL Server does.
 *
 * Formatting follows what SQL Server shows: NULL as NULL, and the values of DECIMAL(p,s) / NUMERIC(p,s) columns with
 * their declared number of decimals (SQLite stores 100.00 as the integer 100). The declared type of each result column
 * comes from SQLite itself (a temporary view over the query, then PRAGMA table_info), so only direct column
 * references get it; computed values are shown as SQLite returns them, and the build check only lets through queries
 * whose computed values print the same in both.
 */
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';

export type Cell = string | null;

export interface ResultTable {
  columns: string[];
  /** Declared type of each column when it is a direct column reference ('' otherwise). */
  declared: string[];
  rows: Cell[][];
  /** Rows the query returned (rows holds at most maxRows of them). */
  total: number;
  truncated: boolean;
}

export interface StatementResult {
  /** 1-based line of the statement's first token in its script. */
  line: number;
  sql: string;
  kind: 'rows' | 'changes' | 'none';
  table?: ResultTable;
  /** Rows changed by INSERT / UPDATE / DELETE. */
  changes?: number;
  /** Raw values (for the build check), only with `keepRaw`. */
  raw?: SqlValue[][];
}

export interface RunError {
  phase: 'setup' | 'code';
  message: string;
  /** Line in the setup or the code where the failing statement starts. */
  line: number | null;
}

export interface RunResult {
  statements: StatementResult[];
  error?: RunError;
  ms: number;
}

export interface RunOptions {
  /** Rows kept per result (the rest are counted). */
  maxRows?: number;
  /** Stop stepping a query after this many rows (an endless recursive CTE). */
  hardRowLimit?: number;
  keepRaw?: boolean;
  /** Build check only: rebuild every table in reverse row order right before the first query runs. */
  reverseBeforeFirstQuery?: boolean;
  /** Build check only: look at the database after the code ran (it is closed afterwards). */
  inspect?: (db: Database) => void;
}

export const MAX_ROWS = 500;
const HARD_ROW_LIMIT = 100_000;
const DECIMAL = /^\s*(DECIMAL|NUMERIC)\s*(?:\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\))?\s*$/i;

/** Number of decimals SQL Server shows for a declared type, or null if it isn't a fixed-scale type. */
export function scaleOf(declared: string): number | null {
  const m = DECIMAL.exec(declared);
  if (m) return m[3] !== undefined ? Number(m[3]) : 0;
  if (/^\s*(SMALL)?MONEY\s*$/i.test(declared)) return 4;
  return null;
}

export function formatValue(v: SqlValue, declared = ''): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') {
    const scale = scaleOf(declared);
    if (scale !== null) return v.toFixed(scale);
    return String(v);
  }
  if (typeof v === 'string') return v;
  return `0x${Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Offset of the first character that isn't whitespace or part of a comment. */
function skipTrivia(text: string, from = 0): number {
  let i = from;
  for (;;) {
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (text.startsWith('--', i)) {
      const nl = text.indexOf('\n', i);
      i = nl < 0 ? text.length : nl + 1;
    } else if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 2;
    } else return i;
  }
}
const lineAt = (text: string, offset: number) => text.slice(0, offset).split('\n').length;
const firstWord = (sql: string) => /^[A-Za-z]+/.exec(sql.slice(skipTrivia(sql)))?.[0]?.toUpperCase() ?? '';

/** Declared types of a query's result columns, via a temporary view; null if the statement isn't a query. */
function declaredTypes(db: Database, sql: string): string[] | null {
  const body = sql.slice(skipTrivia(sql)).replace(/;\s*$/, '');
  if (!/^(SELECT|WITH|VALUES)\b/i.test(body)) return null;
  try {
    db.run(`CREATE TEMP VIEW "__ly_result_types" AS ${body}\n`);
    const info = db.exec('PRAGMA temp.table_info("__ly_result_types")');
    return (info[0]?.values ?? []).map((r) => String(r[2] ?? ''));
  } catch {
    return null;
  } finally {
    try {
      db.run('DROP VIEW IF EXISTS temp."__ly_result_types"');
    } catch {
      /* the view was never created */
    }
  }
}

/** Rebuilds every table with its rows in reverse rowid order (same DDL, same indexes and views). */
export function reverseTables(db: Database): void {
  const objects = db.exec("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid")[0]?.values ?? [];
  const tables = objects.filter((o) => o[0] === 'table');
  if (!tables.length) return;
  db.run('PRAGMA foreign_keys = OFF');
  for (const [, name, , sql] of tables) {
    const n = String(name);
    const tmp = `__ly_rev_${n}`;
    const create = String(sql).replace(/^(\s*CREATE\s+TABLE\s+)("[^"]+"|\[[^\]]+\]|`[^`]+`|[\w$]+)/i, `$1"${tmp}"`);
    db.run(create);
    db.run(`INSERT INTO "${tmp}" SELECT * FROM "${n}" ORDER BY rowid DESC`);
  }
  for (const o of objects) if (o[0] === 'view') db.run(`DROP VIEW "${String(o[1])}"`);
  for (const [, name] of tables) db.run(`DROP TABLE "${String(name)}"`);
  for (const [, name] of tables) db.run(`ALTER TABLE "__ly_rev_${String(name)}" RENAME TO "${String(name)}"`);
  for (const o of objects) if (o[0] === 'index' || o[0] === 'view' || o[0] === 'trigger') db.run(String(o[3]));
  db.run('PRAGMA foreign_keys = ON');
}

function runStatements(db: Database, script: string, phase: 'setup' | 'code', opts: RunOptions, out: StatementResult[], state: { reversed: boolean }): RunError | undefined {
  const maxRows = opts.maxRows ?? MAX_ROWS;
  const hard = opts.hardRowLimit ?? HARD_ROW_LIMIT;
  const it = db.iterateStatements(script);
  for (;;) {
    const offset = script.length - it.getRemainingSQL().length;
    const line = lineAt(script, skipTrivia(script, offset));
    let next: IteratorResult<import('sql.js').Statement>;
    try {
      next = it.next();
    } catch (e) {
      return { phase, message: (e as Error).message, line };
    }
    if (next.done) return undefined;
    const stmt = next.value;
    const sql = stmt.getSQL();
    try {
      const columns = stmt.getColumnNames();
      if (columns.length > 0 && phase === 'code') {
        if (opts.reverseBeforeFirstQuery && !state.reversed) {
          state.reversed = true;
          reverseTables(db);
        }
        const declared = declaredTypes(db, sql) ?? columns.map(() => '');
        const rows: Cell[][] = [];
        const raw: SqlValue[][] = [];
        let total = 0;
        while (stmt.step()) {
          total++;
          const values = stmt.get();
          if (rows.length < maxRows) {
            rows.push(values.map((v, i) => formatValue(v, declared[i] ?? '')));
            if (opts.keepRaw) raw.push(values);
          }
          if (total >= hard) break;
        }
        const table: ResultTable = { columns, declared, rows, total, truncated: total > rows.length };
        out.push({ line, sql, kind: 'rows', table, ...(opts.keepRaw ? { raw } : {}) });
      } else {
        while (stmt.step()) {
          /* setup statements and DML: run to completion */
        }
        const verb = firstWord(sql);
        if (phase === 'code') {
          if (verb === 'INSERT' || verb === 'UPDATE' || verb === 'DELETE') out.push({ line, sql, kind: 'changes', changes: db.getRowsModified() });
          else out.push({ line, sql, kind: 'none' });
        }
      }
    } catch (e) {
      return { phase, message: (e as Error).message, line };
    } finally {
      stmt.free();
    }
  }
}

/** Runs the setup, then the code, in a fresh database. Never throws for SQL errors: they come back in `error`. */
export function runScript(SQL: SqlJsStatic, setup: string, code: string, opts: RunOptions = {}): RunResult {
  const started = Date.now();
  const db = new SQL.Database();
  const statements: StatementResult[] = [];
  const state = { reversed: false };
  try {
    db.run('PRAGMA foreign_keys = ON');
    const error = (setup.trim() ? runStatements(db, setup, 'setup', opts, statements, state) : undefined) ?? runStatements(db, code, 'code', opts, statements, state);
    opts.inspect?.(db);
    return { statements, ...(error ? { error } : {}), ms: Date.now() - started };
  } finally {
    db.close();
  }
}

// ── what the build check reads from a database ──────────────────────────────────────────────
export interface TableInfo {
  name: string;
  columns: { name: string; type: string; pk: boolean; notnull: boolean }[];
  /** Columns of UNIQUE constraints and indexes (each entry one constraint). */
  unique: string[][];
  rows: SqlValue[][];
  types: string[][];
}

export function introspect(db: Database): TableInfo[] {
  const names = (db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")[0]?.values ?? []).map((r) => String(r[0]));
  return names.map((name) => {
    const q = `"${name.replace(/"/g, '""')}"`;
    const cols = (db.exec(`PRAGMA table_info(${q})`)[0]?.values ?? []).map((r) => ({ name: String(r[1]), type: String(r[2] ?? ''), notnull: r[3] === 1, pk: Number(r[5]) > 0 }));
    const unique: string[][] = [];
    for (const idx of db.exec(`PRAGMA index_list(${q})`)[0]?.values ?? []) {
      if (idx[2] !== 1 || idx[3] === 'pk') continue;
      unique.push((db.exec(`PRAGMA index_info("${String(idx[1]).replace(/"/g, '""')}")`)[0]?.values ?? []).map((r) => String(r[2])));
    }
    const sel = cols.map((c) => `"${c.name.replace(/"/g, '""')}"`).join(', ');
    const typ = cols.map((c) => `typeof("${c.name.replace(/"/g, '""')}")`).join(', ');
    const rows = cols.length ? (db.exec(`SELECT ${sel} FROM ${q} ORDER BY rowid`)[0]?.values ?? []) : [];
    const types = cols.length ? (db.exec(`SELECT ${typ} FROM ${q} ORDER BY rowid`)[0]?.values ?? []).map((r) => r.map(String)) : [];
    return { name, columns: cols, unique, rows, types };
  });
}
