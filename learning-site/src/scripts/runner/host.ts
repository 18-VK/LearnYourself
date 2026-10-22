/**
 * Page side of the C# runner: owns the Web Worker (public/runner/runner-worker.js, see runner/NOTES.md) and runs one
 * program at a time.
 *
 * Limits are enforced here, on the page, because a program stuck in `while (true) { }` never yields inside the worker:
 * after the worker reports that execution started ('running'), the page waits TIMEOUT_MS and then terminates the
 * worker. Terminating is instant and needs nothing from the worker; a fresh worker boots in the background (from Cache
 * Storage, so without downloading again) for the next run.
 */

export const TIMEOUT_MS = 5000;
export const MAX_OUTPUT = 64 * 1024;
const COMPILE_TIMEOUT_MS = 60_000;

export interface Diagnostic {
  id: string;
  severity: 'error' | 'warning';
  message: string;
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}
export interface RuntimeError {
  type: string;
  message: string;
  file: string | null;
  line: number;
  stack: { method: string; file: string | null; line: number }[];
}
export interface WorkerResult {
  id: number;
  shape?: string;
  problem?: string | null;
  compiled?: boolean;
  compileMs?: number;
  diagnostics?: Diagnostic[];
  run?: { outcome: 'completed' | 'exception' | 'output-limit'; exitCode: number; truncated: boolean; ms: number; error?: RuntimeError };
  internalError?: string;
}

export type RunOutcome =
  | { kind: 'result'; result: WorkerResult; output: string }
  | { kind: 'timeout'; output: string }
  | { kind: 'fatal'; message: string; output: string };

export interface RunRequest {
  code: string;
  harness?: string | null;
  stdin?: string;
  /** Room for the tracing debugger: 'debug' requests carry their own options (see runner/NOTES.md). */
  mode?: 'run';
}

export interface RunCallbacks {
  onProgress?: (loaded: number, total: number) => void;
  onPhase?: (phase: 'loading' | 'compiling' | 'running') => void;
  onOutput?: (text: string) => void;
}

type Pending = { resolve: (o: RunOutcome) => void; callbacks: RunCallbacks; output: string; timer?: number };

const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
export const RUNNER_URL = `${base}runner/`;

class RunnerHost {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private booted = false;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private queue: Promise<unknown> = Promise.resolve();
  private progressListener: RunCallbacks['onProgress'];

  /** True once the runtime has started in this page (later runs show no loading bar). */
  get isReady(): boolean {
    return this.booted;
  }

  private start(warm = false): void {
    const worker = new Worker(`${RUNNER_URL}runner-worker.js`, { type: 'module', name: 'csharp-runner' });
    this.worker = worker;
    this.booted = false;
    this.ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data as { type: string; id?: number; [k: string]: unknown };
        if (m.type === 'progress') this.progressListener?.(m.loaded as number, m.total as number);
        else if (m.type === 'ready') {
          this.booted = true;
          resolve();
        } else if (m.type === 'phase') this.onPhase(m.id!, m.phase as string);
        else if (m.type === 'output') this.onOutput(m.id!, m.text as string);
        else if (m.type === 'result') this.finish(m.id!, { kind: 'result', result: m.result as WorkerResult, output: '' });
        else if (m.type === 'fatal') {
          if (m.id) this.finish(m.id, { kind: 'fatal', message: String(m.message), output: '' });
          else reject(new Error(String(m.message)));
        }
      };
      worker.onerror = (e) => {
        e.preventDefault();
        const message = e.message || 'The C# runner could not start.';
        reject(new Error(message));
        for (const id of [...this.pending.keys()]) this.finish(id, { kind: 'fatal', message, output: '' });
        this.reset();
      };
    });
    // a failed boot must not leave an unhandled rejection behind
    this.ready.catch(() => this.reset());
    worker.postMessage({ type: 'init', warm });
  }

  private reset(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.booted = false;
  }

  private onPhase(id: number, phase: string): void {
    const p = this.pending.get(id);
    if (!p) return;
    if (phase === 'running') {
      p.callbacks.onPhase?.('running');
      window.clearTimeout(p.timer); // the compile watchdog
      p.timer = window.setTimeout(() => {
        // the program is still running: stop it the only reliable way, then get a fresh runtime ready
        this.reset();
        this.finish(id, { kind: 'timeout', output: '' });
        this.warmUp();
      }, TIMEOUT_MS);
    }
  }

  private onOutput(id: number, text: string): void {
    const p = this.pending.get(id);
    if (!p) return;
    p.output += text;
    p.callbacks.onOutput?.(text);
  }

  private finish(id: number, outcome: RunOutcome): void {
    const p = this.pending.get(id);
    if (!p) return;
    window.clearTimeout(p.timer);
    this.pending.delete(id);
    p.resolve({ ...outcome, output: p.output });
  }

  /**
   * Starts the runtime and compiles a small program, without running anything: called when the learner presses Edit
   * (they will probably press Run next) and after a timeout, so the next Run doesn't wait for the compiler's first use.
   */
  warmUp(): void {
    if (!this.worker) this.start(true);
  }

  /** Runs programs one after another; each resolves with its result, a timeout, or a runner failure. */
  run(req: RunRequest, callbacks: RunCallbacks = {}): Promise<RunOutcome> {
    const job = this.queue.then(() => this.runNow(req, callbacks));
    this.queue = job.catch(() => undefined);
    return job;
  }

  private async runNow(req: RunRequest, callbacks: RunCallbacks): Promise<RunOutcome> {
    if (!this.worker) this.start();
    this.progressListener = callbacks.onProgress;
    if (!this.booted) callbacks.onPhase?.('loading');
    try {
      await this.ready;
    } catch (e) {
      return { kind: 'fatal', message: (e as Error).message, output: '' };
    }
    callbacks.onPhase?.('compiling');
    const id = this.nextId++;
    return new Promise<RunOutcome>((resolve) => {
      // watchdog for compiling (normally well under a second once warm): never leave the learner waiting forever
      const timer = window.setTimeout(() => {
        this.reset();
        this.finish(id, { kind: 'fatal', message: 'the compiler did not answer within a minute', output: '' });
      }, COMPILE_TIMEOUT_MS);
      this.pending.set(id, { resolve, callbacks, output: '', timer });
      this.worker!.postMessage({ type: 'run', id, code: req.code, harness: req.harness ?? null, stdin: req.stdin ?? '', maxOutput: MAX_OUTPUT });
    });
  }
}

export const runner = new RunnerHost();
