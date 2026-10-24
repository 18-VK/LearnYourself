/**
 * The parts of sql.js (SQLite compiled to WebAssembly, https://github.com/sql-js/sql.js) this site uses.
 * sql.js ships no TypeScript types; these mirror its documented API (version pinned in package.json).
 */
declare module 'sql.js' {
  export type SqlValue = number | string | Uint8Array | null;
  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }
  export interface Statement {
    getSQL(): string;
    getColumnNames(): string[];
    step(): boolean;
    get(): SqlValue[];
    free(): boolean;
  }
  export interface StatementIterator extends Iterator<Statement>, Iterable<Statement> {
    getRemainingSQL(): string;
  }
  export interface Database {
    exec(sql: string): QueryExecResult[];
    run(sql: string): Database;
    iterateStatements(sql: string): StatementIterator;
    getRowsModified(): number;
    close(): void;
  }
  export interface SqlJsStatic {
    Database: new () => Database;
  }
  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }
  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}

declare module 'sql.js/dist/sql-wasm-browser.js' {
  import initSqlJs from 'sql.js';
  export default initSqlJs;
}
