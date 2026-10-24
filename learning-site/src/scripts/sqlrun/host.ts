/**
 * Page side of runnable SQL: owns the sql.js Web Worker (src/scripts/sqlrun/worker.ts) and runs one script at a time.
 * The worker is created on the first Run, so nothing (not even the 0.3 MB WebAssembly file) loads before that.
 *
 * Like the C# runner (src/scripts/runner/host.ts), the time limit is enforced here: a query that never finishes keeps
 * the worker busy, so after TIMEOUT_MS the page terminates it and starts a fresh one on the next run.
 */
import type { RunResult } from './engine';

export const TIMEOUT_MS = 5000;
export const MAX_ROWS = 500;
const LOAD_TIMEOUT_MS = 60_000;

export type SqlOutcome = { kind: 'result'; result: RunResult } | { kind: 'timeout' } | { kind: 'fatal'; message: string };

type Pending = { resolve: (o: SqlOutcome) => void; timer?: number };

class SqlHost {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private booted = false;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private queue: Promise<unknown> = Promise.resolve();
  sqlite = '';

  /** True once the engine has loaded on this page (later runs show no loading message). */
  get isReady(): boolean {
    return this.booted;
  }

  private start(): void {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'sql-runner' });
    this.worker = worker;
    this.booted = false;
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('SQLite did not load within a minute')), LOAD_TIMEOUT_MS);
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data as { type: string; id?: number; result?: RunResult; message?: string; sqlite?: string };
        if (m.type === 'ready') {
          window.clearTimeout(timer);
          this.booted = true;
          this.sqlite = m.sqlite ?? '';
          resolve();
        } else if (m.type === 'result' && m.id) this.finish(m.id, { kind: 'result', result: m.result! });
        else if (m.type === 'fatal') {
          if (m.id) this.finish(m.id, { kind: 'fatal', message: m.message ?? 'unknown error' });
          else {
            window.clearTimeout(timer);
            reject(new Error(m.message ?? 'SQLite could not start'));
          }
        }
      };
      worker.onerror = (e) => {
        e.preventDefault();
        window.clearTimeout(timer);
        const message = e.message || 'SQLite could not start';
        reject(new Error(message));
        for (const id of [...this.pending.keys()]) this.finish(id, { kind: 'fatal', message });
        this.reset();
      };
    });
    this.ready.catch(() => this.reset());
    worker.postMessage({ type: 'init' });
  }

  private reset(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.booted = false;
  }

  private finish(id: number, outcome: SqlOutcome): void {
    const p = this.pending.get(id);
    if (!p) return;
    window.clearTimeout(p.timer);
    this.pending.delete(id);
    p.resolve(outcome);
  }

  /** Runs scripts one after another; each resolves with its result, a timeout, or an engine failure. */
  run(setup: string, code: string, onLoading?: () => void): Promise<SqlOutcome> {
    const job = this.queue.then(() => this.runNow(setup, code, onLoading));
    this.queue = job.catch(() => undefined);
    return job;
  }

  private async runNow(setup: string, code: string, onLoading?: () => void): Promise<SqlOutcome> {
    if (!this.worker) this.start();
    if (!this.booted) onLoading?.();
    try {
      await this.ready;
    } catch (e) {
      return { kind: 'fatal', message: (e as Error).message };
    }
    const id = this.nextId++;
    return new Promise<SqlOutcome>((resolve) => {
      const timer = window.setTimeout(() => {
        // still running: stop it the only reliable way; the next run starts a fresh worker
        this.reset();
        this.finish(id, { kind: 'timeout' });
      }, TIMEOUT_MS);
      this.pending.set(id, { resolve, timer });
      this.worker!.postMessage({ type: 'run', id, setup, code, maxRows: MAX_ROWS });
    });
  }
}

export const sqlHost = new SqlHost();
