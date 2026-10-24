/**
 * Web Worker for runnable SQL: loads sql.js (SQLite compiled to WebAssembly) from the site itself — Vite emits the
 * .wasm file next to the other build assets — and runs one script at a time with src/scripts/sqlrun/engine.ts.
 * A worker keeps a long query (an endless recursive CTE) off the page's thread; the page terminates it on timeout.
 *
 * page → worker  { type: 'init' } | { type: 'run', id, setup, code, maxRows }
 * worker → page  { type: 'ready', sqlite } | { type: 'result', id, result } | { type: 'fatal', id?, message }
 */
import type { SqlJsStatic } from 'sql.js';
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { runScript } from './engine';

let engine: Promise<SqlJsStatic> | null = null;
const load = () => (engine ??= initSqlJs({ locateFile: () => wasmUrl }));

self.onmessage = async (e: MessageEvent) => {
  const m = e.data as { type: string; id?: number; setup?: string; code?: string; maxRows?: number };
  try {
    const SQL = await load();
    if (m.type === 'init') {
      const db = new SQL.Database();
      const sqlite = String(db.exec('SELECT sqlite_version()')[0]?.values[0]?.[0] ?? '');
      db.close();
      self.postMessage({ type: 'ready', sqlite });
    } else if (m.type === 'run') {
      const result = runScript(SQL, m.setup ?? '', m.code ?? '', { maxRows: m.maxRows });
      self.postMessage({ type: 'result', id: m.id, result });
    }
  } catch (err) {
    engine = null;
    self.postMessage({ type: 'fatal', id: m.id, message: (err as Error).message || String(err) });
  }
};
