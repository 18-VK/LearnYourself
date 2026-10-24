/**
 * The tracing debugger's trace, as the worker sends it (Runner.Core/Debugger/Trace.cs, ExecutionTrace.ToJson), and the
 * stepping rules the controls use. Everything is precomputed, so every control is a jump to another step index:
 * stepping back costs nothing, and the visualizer engine's player (src/viz/engine/usePlayer.ts) drives the index.
 */

export const KIND = { line: 0, call: 1, return: 2, exception: 3, end: 4 } as const;
export type StepKind = (typeof KIND)[keyof typeof KIND];

/** A value snapshot (see the comment table in Runner.Core/Debugger/Recorder.cs.txt). */
export type Value =
  | { k: 'null' }
  | { k: 'v'; t: string; v: string }
  | { k: 's'; n: number; v: string }
  | { k: 'seq'; t: string; id?: number; n?: number; items: Value[]; note?: string }
  | { k: 'grid'; t: string; id?: number; r: number; c: number; items: Value[][] }
  | { k: 'map'; t: string; id?: number; n: number; items: [Value, Value][] }
  | { k: 'tup'; t: string; items: Value[] }
  | { k: 'obj'; t: string; id?: number; f: [string, Value][] }
  | { k: 'ref'; t: string; id?: number }
  | { k: 'exc'; t: string; m: string }
  | { k: 'o'; t: string; note?: string };

export interface MethodInfo {
  name: string;
  file: number;
  line: number;
  endLine: number;
  entry: boolean;
  /** For each array/list variable, the int variables used inside its brackets. */
  hints?: Record<string, string[]>;
}

export interface TraceJson {
  v: 1;
  maxSteps: number;
  /** null, or why recording stopped early: 'steps' | 'depth' | 'size'. */
  stop: string | null;
  files: string[];
  names: [string, string][];
  values: Value[];
  /** Flattened [nameIndex, valueIndex, …] lists. */
  vars: number[][];
  methods: MethodInfo[];
  /** [method, parent, depth, callFile, callLine] */
  frames: [number, number, number, number, number][];
  /** [kind, frame, file, line, outputLength, vars, value] */
  steps: [number, number, number, number, number, number, number][];
}

export interface Step {
  index: number;
  kind: StepKind;
  frame: number;
  /** 0 = the learner's code (snippet.cs), 1 = the harness. */
  file: number;
  line: number;
  /** Characters of console output written before this step. */
  out: number;
  vars: number;
  /** Return value or exception (index into values), or -1. */
  value: number;
}

export interface Variable {
  name: string;
  type: string;
  value: Value;
  /** Index into the trace's values: equal indexes mean equal snapshots. */
  id: number;
}

export interface StackEntry {
  frame: number;
  name: string;
  file: number;
  line: number;
}

export class Trace {
  readonly json: TraceJson;
  readonly length: number;
  /** For each step, the previous step of the same frame (-1 for its first). */
  private readonly prevInFrame: Int32Array;

  constructor(json: TraceJson) {
    this.json = json;
    this.length = json.steps.length;
    this.prevInFrame = new Int32Array(this.length);
    const last = new Map<number, number>();
    for (let i = 0; i < this.length; i++) {
      const f = json.steps[i]![1];
      this.prevInFrame[i] = last.get(f) ?? -1;
      last.set(f, i);
    }
  }

  static parse(text: string): Trace {
    return new Trace(JSON.parse(text) as TraceJson);
  }

  get stop(): string | null {
    return this.json.stop;
  }

  step(i: number): Step {
    const s = this.json.steps[i]!;
    return { index: i, kind: s[0] as StepKind, frame: s[1], file: s[2], line: s[3], out: s[4], vars: s[5], value: s[6] };
  }

  depth(i: number): number {
    return this.json.frames[this.json.steps[i]![1]]![2];
  }

  method(frame: number): MethodInfo {
    return this.json.methods[this.json.frames[frame]![0]]!;
  }

  value(id: number): Value | null {
    return id >= 0 ? (this.json.values[id] ?? null) : null;
  }

  /** The call stack at step i, the current frame first. Callers show the line they called from. */
  stack(i: number): StackEntry[] {
    const s = this.step(i);
    const out: StackEntry[] = [];
    let frame = s.frame;
    let file = s.file;
    let line = s.line;
    while (frame >= 0) {
      const f = this.json.frames[frame]!;
      out.push({ frame, name: this.json.methods[f[0]]!.name, file, line });
      file = f[3];
      line = f[4];
      frame = f[1];
    }
    return out;
  }

  /** The last step at or before i that belongs to `frame` (a caller's variables are those of its last step). */
  lastStepOf(frame: number, i: number): number {
    for (let j = i; j >= 0; j--) if (this.json.steps[j]![1] === frame) return j;
    return -1;
  }

  variablesOfStep(i: number): Variable[] {
    if (i < 0) return [];
    const pairs = this.json.vars[this.json.steps[i]![5]] ?? [];
    const out: Variable[] = [];
    for (let k = 0; k + 1 < pairs.length; k += 2) {
      const [name, type] = this.json.names[pairs[k]!]!;
      const id = pairs[k + 1]!;
      out.push({ name, type, id, value: this.json.values[id] ?? { k: 'null' } });
    }
    return out;
  }

  /** Variables of `frame` (default: the current one) as of step i. */
  variables(i: number, frame = this.step(i).frame): Variable[] {
    return this.variablesOfStep(this.lastStepOf(frame, i));
  }

  /** Names whose value differs from the frame's previous step (new variables count as changed; a call shows none). */
  changed(i: number): Set<string> {
    const s = this.step(i);
    const prev = this.prevInFrame[i]!;
    if (s.kind === KIND.call || prev < 0) return new Set();
    const before = new Map(this.variablesOfStep(prev).map((v) => [v.name, v.id]));
    const out = new Set<string>();
    for (const v of this.variablesOfStep(i)) if (before.get(v.name) !== v.id) out.add(v.name);
    return out;
  }

  // ── stepping (each returns the step index to go to) ──────────────────────────────────────

  private get last(): number {
    return Math.max(0, this.length - 1);
  }

  stepInto(i: number): number {
    return Math.min(this.last, i + 1);
  }

  stepBack(i: number): number {
    return Math.max(0, i - 1);
  }

  /** The next step that isn't deeper than this one: calls made on this line run without stopping. */
  stepOver(i: number): number {
    const d = this.depth(i);
    for (let j = i + 1; j < this.length; j++) if (this.depth(j) <= d) return j;
    return this.last;
  }

  /** The next step in a caller: the rest of this method runs. */
  stepOut(i: number): number {
    const d = this.depth(i);
    for (let j = i + 1; j < this.length; j++) if (this.depth(j) < d) return j;
    return this.last;
  }

  /** The next step on a line with a breakpoint (lines of the learner's code), or the last step. */
  continueTo(i: number, breakpoints: ReadonlySet<number>): number {
    if (breakpoints.size) {
      for (let j = i + 1; j < this.length; j++) {
        const s = this.json.steps[j]!;
        if ((s[0] === KIND.line || s[0] === KIND.call) && s[2] === 0 && breakpoints.has(s[3])) return j;
      }
    }
    return this.last;
  }
}
